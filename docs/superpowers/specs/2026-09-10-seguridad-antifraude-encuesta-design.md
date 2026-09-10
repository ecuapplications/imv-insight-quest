# Seguridad Anti-Fraude para la Encuesta de Satisfacción

## Contexto y motivación

El endpoint público `POST /api/encuestas.php` no tiene ninguna protección contra abuso: cualquiera puede automatizar envíos (bots/scripts), o una misma persona puede enviar la encuesta repetidamente para inflar o distorsionar los resultados. Como la encuesta es anónima y sin login (por diseño, para que sea rápida de llenar desde el celular del paciente), no se puede resolver con autenticación tradicional.

El paciente llena la encuesta desde su propio celular vía un link/QR (dato confirmado: no es un kiosko compartido), lo que hace viables señales de dispositivo/IP sin penalizar a pacientes reales por compartir wifi.

Cliente objetivo: **IMV Health Digestive**. Propuesta comercial asociada: precio fijo $120 USD, entrega máxima en 3-5 días hábiles (ver propuesta enviada).

## Alcance

Refuerzo por capas, sin requerir login del paciente ni cambiar el flujo de 5 preguntas + comentario:

1. **Anti-bot**: honeypot, chequeo de tiempo de llenado, Cloudflare Turnstile, límite de envíos por IP.
2. **Control de uso normal**: identificador de dispositivo (`device_id`) + límite de 1 envío por día por dispositivo, validado en el servidor.
3. **Auditoría**: `device_id` + IP guardados junto a cada respuesta (solo visibles en el panel admin), y una lista de "Dispositivos Sospechosos" (más de 2 registros en los últimos 7 días) para revisión manual.
4. **Distribución controlada**: enlaces de un solo uso, generados por el staff al finalizar cada visita y enviados por WhatsApp (con un clic que abre WhatsApp con el mensaje ya redactado — el staff presiona Enviar). Al usarse, el enlace queda invalidado.

**Fuera de alcance** (explícitamente excluido, documentado en la propuesta comercial):
- Envío automático de WhatsApp sin intervención humana (requeriría WhatsApp Business API / Meta, con aprobaciones externas y costo recurrente — no es viable en el plazo de 3-5 días).
- Bloqueo automático de "dispositivos sospechosos" (solo se listan para revisión manual, no se banean).
- Roles de staff separados del admin (se usa el mismo login de administrador existente para generar enlaces).

## Arquitectura

Todo se integra al backend PHP y frontend React ya existentes (sin nuevas dependencias de infraestructura):

```
Paciente (celular) ──▶ /s/:codigo  ó  /  (SPA React)
                              │
                              ▼
                    POST /api/encuestas.php
                    (honeypot + timing + Turnstile + rate-limit IP +
                     límite diario por device_id + validación de :codigo)
                              │
                              ▼
                         PostgreSQL

Staff (panel admin) ──▶ POST /api/enlaces.php ──▶ genera código único
                              │
                              ▼
                  QR (client-side) + botón "Enviar por WhatsApp"
                  (abre wa.me con el link y el mensaje precargados)
```

## Modelo de datos

Cambios sobre `db/schema.sql` (Postgres):

```sql
ALTER TABLE public.encuestas
  ADD COLUMN device_id UUID,
  ADD COLUMN ip_address INET;

CREATE INDEX idx_encuestas_device_id ON public.encuestas(device_id);
CREATE INDEX idx_encuestas_device_fecha ON public.encuestas(device_id, fecha_creacion);
CREATE INDEX idx_encuestas_ip_fecha ON public.encuestas(ip_address, fecha_creacion);

CREATE TABLE public.enlaces_encuesta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usado_en TIMESTAMP WITH TIME ZONE,
  encuesta_id UUID REFERENCES public.encuestas(id) ON DELETE SET NULL
);

CREATE INDEX idx_enlaces_codigo ON public.enlaces_encuesta(codigo);
```

- `device_id` y `ip_address` son nullable: las 29 respuestas existentes quedan sin estos datos, sin problema (no se audita retroactivamente).
- `enlaces_encuesta.codigo`: string corto aleatorio (10 caracteres hex, `bin2hex(random_bytes(5))`), no UUID completo, para que la URL sea más corta y legible al compartirla por WhatsApp.

## Componentes y endpoints

| Endpoint | Método | Auth | Qué hace |
|---|---|---|---|
| `POST /api/encuestas.php` | POST | público | **Modificado**: valida honeypot, tiempo de llenado, Turnstile, rate-limit por IP, límite diario por `device_id` (salvo que venga un `codigo_enlace` válido), y si viene `codigo_enlace`, lo marca como usado. |
| `POST /api/enlaces.php` | POST | JWT | Genera un nuevo código único, retorna `{ codigo, url }`. |
| `GET /api/enlaces.php` | GET | JWT | Lista los últimos enlaces generados (usados/no usados), para referencia del staff. |
| `GET /api/dispositivos-sospechosos.php` | GET | JWT | `device_id` con más de 2 registros en los últimos 7 días (ventana móvil), con el detalle de cada registro. |

### Validación en `POST /api/encuestas.php` (orden de ejecución)

1. **Honeypot**: si el campo trampa (`sitio_web`, oculto en el formulario) llega no-vacío → responder como si fuera éxito (`{"data":{"id":null},"error":null}`, sin insertar) para no delatar la detección al bot.
2. **Tiempo de llenado**: el cliente envía `segundos_transcurridos` (calculado desde que se montó el formulario). Si es menor a 3 → mismo tratamiento que el honeypot (falso éxito).
3. **Cloudflare Turnstile**: se envía `turnstile_token`; el backend lo verifica contra `https://challenges.cloudflare.com/turnstile/v0/siteverify` con el secret guardado en `config.php`. Si falla → `400` con mensaje real (a diferencia de honeypot/timing, aquí sí es visible, porque un humano real podría fallar el widget por conexión lenta y merece reintentar).
4. **`codigo_enlace`** (opcional en el body): si viene, buscar en `enlaces_encuesta`. Si no existe o `usado_en IS NOT NULL` → `410` "Este enlace ya fue utilizado o no es válido." Si es válido, se marca `usado_en = now()` tras insertar la encuesta, y **se omite el paso 6** (límite diario) para esa request.
5. **Rate limit por IP**: contar encuestas con esa `ip_address` en la última hora; si supera el umbral (10) → `429`.
6. **Límite diario por dispositivo** (solo si no se usó `codigo_enlace` válido en el paso 4): si existe una fila con ese `device_id` y `fecha_creacion::date = CURRENT_DATE` → `429` "Ya registraste tu encuesta hoy. ¡Gracias por tu participación!".
7. Insertar, guardando `device_id` e `ip_address` (`$_SERVER['REMOTE_ADDR']`).

### `GET /api/dispositivos-sospechosos.php`

```sql
SELECT device_id, count(*) AS total,
       json_agg(json_build_object('id', id, 'fecha_creacion', fecha_creacion,
                                   'ip_address', ip_address, 'comentario', comentario)
                 ORDER BY fecha_creacion DESC) AS registros
FROM encuestas
WHERE device_id IS NOT NULL
  AND fecha_creacion >= now() - interval '7 days'
GROUP BY device_id
HAVING count(*) > 2
ORDER BY total DESC;
```

## Frontend

- `src/lib/deviceId.ts`: `getDeviceId()` (UUID persistido en `localStorage`), `hasSubmittedToday()` / `markSubmittedToday()` para saltar el formulario completo si ya se sabe localmente que se respondió hoy (mejora de UX; el servidor sigue siendo la autoridad real).
- `src/pages/Survey.tsx`:
  - Nuevo campo honeypot oculto (fuera de la vista, no `display:none` puro — usar posición absoluta fuera de pantalla para evitar heurísticas simples de bots que sí revisan `display:none`).
  - Captura `formLoadedAt` al montar; calcula `segundos_transcurridos` al enviar.
  - Widget de Cloudflare Turnstile en el último paso, antes de "Enviar".
  - Nueva ruta `/s/:codigo` (mismo componente `Survey`, toma `codigo` de la URL y lo manda como `codigo_enlace`).
  - Manejo de errores específicos: "ya respondiste hoy" y "enlace ya utilizado" muestran una pantalla amigable (no un toast de error genérico).
- `src/components/admin/SuspiciousDevicesTab.tsx` (nuevo): tabla con `device_id`, cantidad, y detalle expandible de sus registros.
- `src/components/admin/GenerateLinkTab.tsx` (nuevo): botón "Generar enlace" → llama `POST /api/enlaces.php` → muestra QR (generado client-side con la librería `qrcode`) + la URL + botón "Enviar por WhatsApp" que abre `https://wa.me/?text=<mensaje con la URL>` (con campo opcional para prellenar el número del paciente).
- `src/pages/AdminDashboard.tsx`: dos pestañas nuevas ("Enlaces", "Sospechosos"), mismo patrón que las tabs existentes.

## Configuración

`api/config.example.php` agrega:
```php
'turnstile_secret' => 'CAMBIAR_POR_EL_SECRET_KEY_DE_CLOUDFLARE',
'rate_limit_ip_por_hora' => 10,
```

Frontend (`.env`): `VITE_TURNSTILE_SITE_KEY=...` (clave pública, sí puede ir en el bundle del cliente).

## Testing

Sin infraestructura de tests automatizados en el repo (igual que en la migración anterior). Verificación manual:
- Bot simulado (`curl` sin honeypot vacío, o con tiempo < 3s) → respuesta "falso éxito", no debe aparecer en la base.
- Envío real desde navegador → aparece en la base con `device_id` e `ip_address` poblados.
- Segundo envío desde el mismo navegador el mismo día (sin `codigo_enlace`) → rechazado con mensaje amigable.
- Generar un enlace, responder la encuesta con ese `codigo`, e intentar reusarlo → segundo intento rechazado con 410.
- Un dispositivo con 3+ envíos en 7 días aparece en `/api/dispositivos-sospechosos.php`.
- Turnstile: probar con token inválido/vacío → rechazado con 400.
