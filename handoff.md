# Handoff

## 1) Objetivo

Reforzar la encuesta pública (`imv-insight-quest`) contra bots y uso abusivo, y agregar distribución controlada por enlaces de un solo uso enviados por WhatsApp — sin login del paciente. Propuesta comercial aprobada: $120 USD fijo, entrega máxima 3-5 días.

## 2) Estado actual

Rama de trabajo: `alpha` (sin PR, por instrucción explícita del usuario). Todo lo de abajo está commiteado y pusheado a `origin/alpha`.

**Funciona y está verificado localmente** (Postgres local + PHP built-in server + `curl`):
- Honeypot y chequeo de tiempo de llenado (rechaza en silencio, sin insertar).
- Rate limit de 10 envíos/hora por IP.
- Límite de 1 envío por día por `device_id` (validado en servidor).
- Endpoint + pestaña "Dispositivos Sospechosos" (`device_id` con >2 registros en 7 días).
- Enlaces de un solo uso: generar → responder → reintentar con el mismo código → rechazado. Probado de punta a punta con `curl`.
- Pantalla admin "Generar Enlace" (QR + botón WhatsApp): compila sin errores, **no probada en navegador real**.

**Escrito pero NO probado de punta a punta:**
- Cloudflare Turnstile: el código (`api/lib/turnstile.php`) está completo y es correcto (verificado que maneja bien el caso de fallo de red), pero el camino de **éxito real** (token válido resuelto por un usuario) no se pudo probar aquí — ver sección 4.

**Pendiente (Task 8 del plan, no iniciado):**
- Claves reales de Cloudflare Turnstile (site key + secret key) — las debe generar el usuario.
- Aplicar `db/migrations/2026-09-10-antifraude.sql` a la base de producción en SiteGround.
- Build + deploy a producción con claves reales.
- Pruebas en navegador/celular real: widget de Turnstile, botón de WhatsApp, escaneo de QR.

## 3) Archivos y cambios en esta sesión

- `db/schema.sql`, `db/migrations/2026-09-10-antifraude.sql` — columnas `encuestas.device_id` (uuid), `encuestas.ip_address` (inet), tabla `enlaces_encuesta`, índices.
- `api/encuestas.php` — agrega honeypot, chequeo de tiempo, verificación Turnstile, rate-limit IP, límite diario por dispositivo, validación/consumo de `codigo_enlace`. Insert ahora guarda `device_id` e `ip_address`.
- `api/lib/turnstile.php` (nuevo) — `turnstile_verify()`.
- `api/dispositivos-sospechosos.php` (nuevo) — endpoint JWT, ventana de 7 días.
- `api/enlaces.php` (nuevo) — `POST` genera código, `GET` lista los últimos 50.
- `api/config.example.php` — agrega `turnstile_secret`, `rate_limit_ip_por_hora`.
- `src/lib/deviceId.ts` (nuevo) — `getDeviceId()`, `hasSubmittedToday()`, `markSubmittedToday()`.
- `src/pages/Survey.tsx` — honeypot oculto, captura de tiempo, widget de Turnstile, `device_id`, ruta `/s/:codigo`, pantallas de "ya respondiste hoy" y "enlace ya utilizado".
- `src/App.tsx` — ruta `/s/:codigo`.
- `src/components/admin/SuspiciousDevicesTab.tsx` (nuevo), `src/components/admin/GenerateLinkTab.tsx` (nuevo).
- `src/pages/AdminDashboard.tsx` — pestañas "Sospechosos" y "Enlaces".
- `index.html` — script de Cloudflare Turnstile.
- `.env.example`, `.env` — `VITE_TURNSTILE_SITE_KEY` (en `.env` local usa la site key pública de prueba de Cloudflare, no un secreto).
- `package.json` — dependencia `qrcode` (+ `@types/qrcode`).
- `docs/superpowers/specs/2026-09-10-seguridad-antifraude-encuesta-design.md`, `docs/superpowers/plans/2026-09-10-seguridad-antifraude-encuesta.md` — spec y plan de esta feature (creados en la sesión anterior, ya en `main-aliksf`/PR #2, no en `alpha`).

**No commiteado (correcto, no debe estarlo):** `api/config.php` local con datos de prueba (Postgres local `imv_test`, secret de Turnstile de prueba de Cloudflare).

## 4) Intentos fallidos

- **No se pudo verificar Cloudflare Turnstile de punta a punta.** El proxy de salida de este sandbox bloquea explícitamente `challenges.cloudflare.com` (confirmado con `curl` directo: `CONNECT tunnel failed, response 403`). Para poder probar el resto del flujo (tareas 4-7) se usó un bypass temporal en `api/lib/turnstile.php` (`return true;` al inicio de la función), **revertido con `git checkout` antes de cada commit** — el código commiteado siempre tiene la verificación real. No repetir el bypass en producción ni dejarlo commiteado por accidente.
- **`(php -S localhost:8000 -t . &)` en subshell fallaba intermitentemente** (el proceso moría solo, o el comando se reportaba con exit code 144). Solución: usar `nohup php -S ... > log 2>&1 & disown`.
- **Las pruebas de rate-limit por IP y de "dispositivos sospechosos" se pisaron entre sí** en la misma sesión de pruebas, porque comparten la IP `127.0.0.1` dentro de la ventana de 1 hora del rate-limit. Hubo que actualizar `fecha_creacion` manualmente vía SQL para aislar cada prueba. Si se vuelve a probar localmente: limpiar la tabla `encuestas` de prueba entre bloques, o usar `fecha_creacion` distintas a propósito.

## 5) Próximos pasos (en orden)

1. Pedir al usuario que cree una cuenta de Cloudflare Turnstile y un widget para `imvhealths.sg-host.com` (+ `localhost` para dev) — obtener site key y secret key reales.
2. Actualizar el `api/config.php` de producción con el `turnstile_secret` real (nunca commitearlo).
3. Aplicar `db/migrations/2026-09-10-antifraude.sql` contra el Postgres de producción en SiteGround (mismo procedimiento que la migración anterior — host `34.174.223.131`, confirmado que funciona desde la máquina del usuario).
4. Build de producción: `VITE_API_URL=/api VITE_TURNSTILE_SITE_KEY=<site_key_real> npm run build`.
5. Empaquetar y subir `dist/` + `api/` (incluye los archivos nuevos: `turnstile.php`, `dispositivos-sospechosos.php`, `enlaces.php`) + `index.html` actualizado a `public_html`, igual que el deploy anterior.
6. Probar en producción con dispositivos reales: encuesta normal, límite diario, generar enlace y enviarlo por WhatsApp desde un celular real, pestaña de sospechosos.
7. Confirmar con el usuario cómo se integra `alpha` a `main` (pidió explícitamente no abrir PR contra `alpha`) — o si se despliega directo desde ahí.
