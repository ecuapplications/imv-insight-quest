# Seguridad Anti-Fraude para la Encuesta de Satisfacción Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reforzar `POST /api/encuestas.php` contra bots y uso abusivo (honeypot, chequeo de tiempo, Cloudflare Turnstile, rate-limit por IP, límite de 1 envío/día por dispositivo), agregar auditoría (`device_id` + IP, lista de "Dispositivos Sospechosos"), y agregar un mecanismo de enlaces de un solo uso generados por el staff y enviados por WhatsApp.

**Architecture:** Ver [design spec](../specs/2026-09-10-seguridad-antifraude-encuesta-design.md). Todo se integra al backend PHP (`api/*.php`) y frontend React (Vite) ya existentes — sin nuevas piezas de infraestructura.

## Global Constraints

- Sin frameworks PHP ni librerías externas por Composer (igual que el resto del proyecto) — la verificación de Turnstile se hace con `curl` (extensión nativa de PHP), no con un SDK.
- Todas las queries nuevas usan prepared statements (PDO).
- Envelope de respuesta JSON consistente: `{ "data": ..., "error": null }` / `{ "data": null, "error": "mensaje" }`, salvo el caso explícito de "falso éxito" para honeypot/timing (ver Task 3).
- No hay tests automatizados; verificación manual con `curl` + navegador, igual que en la migración anterior.
- No commitear secretos: `turnstile_secret` va en `api/config.php` (gitignored), nunca en `api/config.example.php`.
- Plazo objetivo: 3-5 días hábiles (propuesta comercial aprobada, $120 USD fijo).

---

## Task 1: Esquema de base de datos

**Files:**
- Modify: `db/schema.sql` (agregar columnas e índices, para que instalaciones nuevas del esquema ya los incluyan)
- Create: `db/migrations/2026-09-10-antifraude.sql` (script de migración incremental para la base de producción ya existente)

**Interfaces:**
- Produces: columnas `encuestas.device_id`, `encuestas.ip_address`; tabla `enlaces_encuesta` — usadas por todas las tareas siguientes.

- [ ] **Step 1: Agregar las columnas e índices a `db/schema.sql`**

Editar `db/schema.sql`, agregar después de la definición de `public.encuestas` y sus índices existentes:
```sql
ALTER TABLE public.encuestas
  ADD COLUMN device_id UUID,
  ADD COLUMN ip_address INET;

CREATE INDEX idx_encuestas_device_id ON public.encuestas(device_id);
CREATE INDEX idx_encuestas_device_fecha ON public.encuestas(device_id, fecha_creacion);
CREATE INDEX idx_encuestas_ip_fecha ON public.encuestas(ip_address, fecha_creacion);
```

Nota: en `db/schema.sql` (usado solo para instalaciones nuevas) estas columnas se pueden declarar directamente en el `CREATE TABLE` en vez de `ALTER TABLE` — usar `ALTER TABLE` ahí también está bien y mantiene el diff más simple de revisar.

Agregar la tabla nueva al final del archivo:
```sql
CREATE TABLE public.enlaces_encuesta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usado_en TIMESTAMP WITH TIME ZONE,
  encuesta_id UUID REFERENCES public.encuestas(id) ON DELETE SET NULL
);

CREATE INDEX idx_enlaces_codigo ON public.enlaces_encuesta(codigo);
```

- [ ] **Step 2: Crear el script de migración incremental**

Crear `db/migrations/2026-09-10-antifraude.sql` con el mismo contenido SQL del Step 1 (para aplicarlo a la base de producción existente, que ya tiene datos y no puede recrearse desde `schema.sql`).

- [ ] **Step 3: Aplicar en local/staging y verificar**

Run:
```bash
psql "$DATABASE_URL_LOCAL" -f db/migrations/2026-09-10-antifraude.sql
psql "$DATABASE_URL_LOCAL" -c "\d encuestas"
psql "$DATABASE_URL_LOCAL" -c "\d enlaces_encuesta"
```
Expected: `encuestas` muestra `device_id` (uuid) e `ip_address` (inet); `enlaces_encuesta` existe con sus columnas.

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql db/migrations/2026-09-10-antifraude.sql
git commit -m "feat: add schema for anti-fraud device/IP audit and one-time links"
```

---

## Task 2: Honeypot + chequeo de tiempo de llenado

**Files:**
- Modify: `api/encuestas.php`
- Modify: `src/pages/Survey.tsx`

**Interfaces:**
- Consumes: ninguna nueva.
- Produces: comportamiento "falso éxito" en el backend cuando se detecta bot — no expone un campo de API nuevo, solo nuevos campos en el body del POST (`sitio_web`, `segundos_transcurridos`).

- [ ] **Step 1: Honeypot y tiempo en el backend**

Modify `api/encuestas.php`, al inicio del bloque `POST` (antes de la validación de campos requeridos):
```php
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Honeypot: un bot que autocompleta todo cae aquí. Se responde como éxito
    // (sin insertar) para no revelar que fue detectado.
    if (!empty($body['sitio_web'])) {
        json_ok(['id' => null]);
    }

    // Tiempo de llenado: nadie contesta 5 preguntas + comentario en <3s.
    $segundos = $body['segundos_transcurridos'] ?? null;
    if ($segundos !== null && $segundos < 3) {
        json_ok(['id' => null]);
    }

    // ... (validación existente de campos requeridos sigue igual)
```

- [ ] **Step 2: Campo honeypot y captura de tiempo en el frontend**

Modify `src/pages/Survey.tsx`:
- Agregar estado `const [formLoadedAt] = useState(() => Date.now());` y `const [honeypot, setHoneypot] = useState("");`.
- Agregar un input oculto (fuera de pantalla, no `display:none`) enlazado a `honeypot`:
```tsx
<input
  type="text"
  name="sitio_web"
  value={honeypot}
  onChange={(e) => setHoneypot(e.target.value)}
  tabIndex={-1}
  autoComplete="off"
  style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
  aria-hidden="true"
/>
```
- En `handleSubmit`, agregar al body del POST:
```typescript
sitio_web: honeypot,
segundos_transcurridos: Math.round((Date.now() - formLoadedAt) / 1000),
```

- [ ] **Step 3: Verificar con curl**

Run (con el servidor local corriendo):
```bash
curl -s -X POST http://localhost:8000/api/encuestas.php -H "Content-Type: application/json" -d '{
  "pregunta1_amabilidad":"Sí","pregunta2_tiempo_espera":"Menos de 5 minutos",
  "pregunta3_resolucion_dudas":"Sí","pregunta4_limpieza":"Excelente",
  "pregunta5_calificacion_general":"Excelente","comentario":"bot test",
  "sitio_web":"http://spam.com","segundos_transcurridos":10
}'
```
Expected: `{"data":{"id":null},"error":null}` y **no** debe aparecer una fila nueva en `encuestas`.

```bash
curl -s -X POST http://localhost:8000/api/encuestas.php -H "Content-Type: application/json" -d '{
  "pregunta1_amabilidad":"Sí","pregunta2_tiempo_espera":"Menos de 5 minutos",
  "pregunta3_resolucion_dudas":"Sí","pregunta4_limpieza":"Excelente",
  "pregunta5_calificacion_general":"Excelente","comentario":"fast bot",
  "sitio_web":"","segundos_transcurridos":1
}'
```
Expected: mismo "falso éxito", sin insertar.

- [ ] **Step 4: Commit**

```bash
git add api/encuestas.php src/pages/Survey.tsx
git commit -m "feat: add honeypot and fill-time check to survey submission"
```

---

## Task 3: Cloudflare Turnstile

**Files:**
- Create: `api/lib/turnstile.php`
- Modify: `api/encuestas.php`
- Modify: `api/config.example.php`
- Modify: `src/pages/Survey.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces: `turnstile_verify(string $token, string $secret): bool` — usada por `api/encuestas.php`.
- Consumes: `VITE_TURNSTILE_SITE_KEY` (frontend), `turnstile_secret` (backend, en `config.php`).

- [ ] **Step 1: Cuenta de Cloudflare Turnstile**

Crear una cuenta gratuita en Cloudflare (si no existe) y un "widget" de Turnstile para el dominio `imvhealths.sg-host.com` (y `localhost` para desarrollo). Obtener el **Site Key** (público) y el **Secret Key** (privado).

- [ ] **Step 2: Helper de verificación en el backend**

Crear `api/lib/turnstile.php`:
```php
<?php

function turnstile_verify(string $token, string $secret): bool {
    if ($token === '') {
        return false;
    }
    $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['secret' => $secret, 'response' => $token]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    if ($response === false) {
        return false;
    }
    $result = json_decode($response, true);
    return !empty($result['success']);
}
```

- [ ] **Step 3: Config de ejemplo**

Modify `api/config.example.php`, agregar:
```php
'turnstile_secret' => 'CAMBIAR_POR_EL_SECRET_KEY_DE_CLOUDFLARE',
```

- [ ] **Step 4: Verificación en el endpoint**

Modify `api/encuestas.php`, después del chequeo de honeypot/tiempo (Task 2) y antes de la validación de campos requeridos:
```php
    require_once __DIR__ . '/lib/turnstile.php';
    $config = require __DIR__ . '/config.php';
    $turnstileToken = $body['turnstile_token'] ?? '';
    if (!turnstile_verify($turnstileToken, $config['turnstile_secret'])) {
        json_error('No pudimos verificar que eres una persona real. Intenta de nuevo.', 400);
    }
```

- [ ] **Step 5: Widget en el frontend**

Modify `index.html`, agregar en el `<head>`:
```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

Modify `.env.example`, agregar:
```
VITE_TURNSTILE_SITE_KEY=CAMBIAR_POR_EL_SITE_KEY_PUBLICO
```

Modify `src/pages/Survey.tsx`: renderizar el widget en el último paso (antes del botón "Enviar"), capturando el token en un estado `turnstileToken`, y agregarlo al body del POST:
```tsx
<div
  ref={turnstileRef}
  className="cf-turnstile"
  data-sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  data-callback="onTurnstileSuccess"
/>
```
(usar el patrón de callback global `window.onTurnstileSuccess = (token) => setTurnstileToken(token)` en un `useEffect`, ya que el script de Turnstile no es un módulo ES importable).

- [ ] **Step 6: Verificar con curl (token inválido) y en navegador (token real)**

Run:
```bash
curl -s -X POST http://localhost:8000/api/encuestas.php -H "Content-Type: application/json" -d '{
  "pregunta1_amabilidad":"Sí","pregunta2_tiempo_espera":"Menos de 5 minutos",
  "pregunta3_resolucion_dudas":"Sí","pregunta4_limpieza":"Excelente",
  "pregunta5_calificacion_general":"Excelente","segundos_transcurridos":10,
  "turnstile_token":"token-invalido"
}'
```
Expected: `400`, `{"data":null,"error":"No pudimos verificar..."}`.

En el navegador: completar la encuesta real, resolver el widget (usualmente invisible), confirmar que el envío funciona de punta a punta.

- [ ] **Step 7: Commit**

```bash
git add api/lib/turnstile.php api/encuestas.php api/config.example.php src/pages/Survey.tsx .env.example index.html
git commit -m "feat: add Cloudflare Turnstile verification to survey submission"
```

---

## Task 4: Rate limit por IP + límite diario por dispositivo

**Files:**
- Create: `src/lib/deviceId.ts`
- Modify: `api/encuestas.php`
- Modify: `api/config.example.php`
- Modify: `src/pages/Survey.tsx`

**Interfaces:**
- Produces: `getDeviceId()`, `hasSubmittedToday()`, `markSubmittedToday()` en `src/lib/deviceId.ts` — usadas por `Survey.tsx` y reutilizables en tareas siguientes.

- [ ] **Step 1: Generador de `device_id` en el frontend**

Crear `src/lib/deviceId.ts`:
```typescript
const DEVICE_ID_KEY = "imv_device_id";
const LAST_SUBMISSION_KEY = "imv_last_submission_date";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasSubmittedToday(): boolean {
  return localStorage.getItem(LAST_SUBMISSION_KEY) === todayIso();
}

export function markSubmittedToday(): void {
  localStorage.setItem(LAST_SUBMISSION_KEY, todayIso());
}
```

- [ ] **Step 2: Rate limit por IP y límite diario en el backend**

Modify `api/config.example.php`, agregar:
```php
'rate_limit_ip_por_hora' => 10,
```

Modify `api/encuestas.php`, después de la verificación de Turnstile (Task 3) y antes del insert:
```php
    $deviceId = $body['device_id'] ?? null;
    $codigoEnlace = $body['codigo_enlace'] ?? null;
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;

    // Rate limit por IP (aplica siempre, incluso con enlace de un solo uso)
    $stmt = $db->prepare(
        'SELECT count(*) FROM encuestas WHERE ip_address = :ip AND fecha_creacion >= now() - interval \'1 hour\''
    );
    $stmt->execute(['ip' => $ip]);
    if ((int) $stmt->fetchColumn() >= $config['rate_limit_ip_por_hora']) {
        json_error('Demasiados envíos desde tu red. Intenta más tarde.', 429);
    }

    // Límite diario por dispositivo, salvo que se use un enlace de un solo uso
    // (la validación del enlace en sí se agrega en la Task 6)
    if (!$codigoEnlace && $deviceId) {
        $stmt = $db->prepare(
            'SELECT id FROM encuestas WHERE device_id = :device_id AND fecha_creacion::date = CURRENT_DATE LIMIT 1'
        );
        $stmt->execute(['device_id' => $deviceId]);
        if ($stmt->fetch()) {
            json_error('Ya registraste tu encuesta hoy. ¡Gracias por tu participación!', 429);
        }
    }
```

Modify el `INSERT` existente para incluir `device_id` e `ip_address`:
```php
    $stmt = $db->prepare(
        'INSERT INTO encuestas (pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, comentario, estado_kanban, device_id, ip_address)
         VALUES (:p1, :p2, :p3, :p4, :p5, :comentario, :estado_kanban, :device_id, :ip)
         RETURNING id'
    );
    $stmt->execute([
        // ... campos existentes ...
        'device_id' => $deviceId,
        'ip' => $ip,
    ]);
```

- [ ] **Step 3: Enviar `device_id` desde el frontend, y saltar el formulario si ya se respondió hoy**

Modify `src/pages/Survey.tsx`:
- Importar `getDeviceId, hasSubmittedToday, markSubmittedToday` de `@/lib/deviceId`.
- En un `useEffect` al montar (solo si no viene por `/s/:codigo`, ver Task 8): si `hasSubmittedToday()`, saltar directo a la pantalla de agradecimiento con un mensaje distinto ("Ya registraste tu opinión hoy, ¡gracias!").
- En `handleSubmit`, agregar `device_id: getDeviceId()` al body, y llamar `markSubmittedToday()` tras un envío exitoso.
- Manejar el error 429 específico del límite diario mostrando ese mismo mensaje amigable en vez del toast de error genérico (comparar el texto del error devuelto).

- [ ] **Step 4: Verificar con curl**

Run: enviar la misma encuesta dos veces con el mismo `device_id` en el mismo día.
```bash
DEVICE_ID=$(node -e "console.log(require('crypto').randomUUID())")
curl -s -X POST http://localhost:8000/api/encuestas.php -H "Content-Type: application/json" -d "{
  \"pregunta1_amabilidad\":\"Sí\",\"pregunta2_tiempo_espera\":\"Menos de 5 minutos\",
  \"pregunta3_resolucion_dudas\":\"Sí\",\"pregunta4_limpieza\":\"Excelente\",
  \"pregunta5_calificacion_general\":\"Excelente\",\"segundos_transcurridos\":10,
  \"turnstile_token\":\"$TOKEN_VALIDO_DE_PRUEBA\",\"device_id\":\"$DEVICE_ID\"
}"
```
Expected primer envío: `200`. Segundo envío con el mismo `$DEVICE_ID`: `429`, "Ya registraste tu encuesta hoy...".

Nota: para probar Turnstile en `curl` sin un token real, usar temporalmente el [modo de prueba de Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) (site keys/secrets de prueba que siempre pasan), documentado también en el `README` del proyecto tras esta tarea.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deviceId.ts api/encuestas.php api/config.example.php src/pages/Survey.tsx
git commit -m "feat: add per-IP rate limit and per-device daily submission limit"
```

---

## Task 5: Endpoint de Dispositivos Sospechosos

**Files:**
- Create: `api/dispositivos-sospechosos.php`
- Create: `src/components/admin/SuspiciousDevicesTab.tsx`
- Modify: `src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `get_db()`, `require_auth()`, `json_ok()` de `api/bootstrap.php`.
- Produces: `GET /api/dispositivos-sospechosos.php` (JWT) → `[{ device_id, total, registros: [...] }]`.

- [ ] **Step 1: Endpoint backend**

Crear `api/dispositivos-sospechosos.php`:
```php
<?php
require __DIR__ . '/bootstrap.php';
require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('Método no permitido', 405);
}

$stmt = get_db()->query(
    "SELECT device_id, count(*) AS total,
            json_agg(json_build_object('id', id, 'fecha_creacion', fecha_creacion,
                                        'ip_address', ip_address, 'comentario', comentario)
                      ORDER BY fecha_creacion DESC) AS registros
     FROM encuestas
     WHERE device_id IS NOT NULL
       AND fecha_creacion >= now() - interval '7 days'
     GROUP BY device_id
     HAVING count(*) > 2
     ORDER BY total DESC"
);
$rows = $stmt->fetchAll();
foreach ($rows as &$row) {
    $row['registros'] = json_decode($row['registros'], true);
}
unset($row);

json_ok($rows);
```

- [ ] **Step 2: Pestaña en el panel admin**

Crear `src/components/admin/SuspiciousDevicesTab.tsx` (mismo patrón que `TagsManagementTab.tsx`): `useEffect` que llama `api.get("/dispositivos-sospechosos.php")`, tabla con `device_id` (truncado), `total`, y un acordeón/lista expandible con `fecha_creacion`, `ip_address`, `comentario` de cada registro.

Modify `src/pages/AdminDashboard.tsx`: agregar `TabsTrigger`/`TabsContent` para `"sospechosos"` (icono `ShieldAlert` de `lucide-react`), siguiendo el mismo patrón visual de las pestañas existentes.

- [ ] **Step 3: Verificar con curl y en navegador**

Run (tras generar 3+ encuestas con el mismo `device_id` en la Task 4):
```bash
curl -s http://localhost:8000/api/dispositivos-sospechosos.php -H "Authorization: Bearer $TOKEN"
```
Expected: incluye el `device_id` de prueba con `total >= 3`.

En el navegador: pestaña "Dispositivos Sospechosos" del panel admin muestra esa misma fila.

- [ ] **Step 4: Commit**

```bash
git add api/dispositivos-sospechosos.php src/components/admin/SuspiciousDevicesTab.tsx src/pages/AdminDashboard.tsx
git commit -m "feat: add suspicious devices audit endpoint and admin tab"
```

---

## Task 6: Enlaces de un solo uso (backend)

**Files:**
- Create: `api/enlaces.php`
- Modify: `api/encuestas.php`

**Interfaces:**
- Consumes: `get_db()`, `require_auth()`, `json_ok()`, `json_error()`.
- Produces: `POST /api/enlaces.php` (JWT) → `{ codigo, url }`; `GET /api/enlaces.php` (JWT) → lista de enlaces recientes. Modifica `POST /api/encuestas.php` para aceptar y consumir `codigo_enlace`.

- [ ] **Step 1: Endpoint de enlaces**

Crear `api/enlaces.php`:
```php
<?php
require __DIR__ . '/bootstrap.php';
require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'POST') {
    $codigo = bin2hex(random_bytes(5));
    $stmt = $db->prepare('INSERT INTO enlaces_encuesta (codigo) VALUES (:codigo)');
    $stmt->execute(['codigo' => $codigo]);
    json_ok(['codigo' => $codigo, 'url' => '/s/' . $codigo]);
}

if ($method === 'GET') {
    $stmt = $db->query(
        'SELECT codigo, creado_en, usado_en FROM enlaces_encuesta ORDER BY creado_en DESC LIMIT 50'
    );
    json_ok($stmt->fetchAll());
}

json_error('Método no permitido', 405);
```

- [ ] **Step 2: Validar y consumir el código en `encuestas.php`**

Modify `api/encuestas.php`: donde ya se lee `$codigoEnlace = $body['codigo_enlace'] ?? null;` (Task 4), agregar la validación **antes** del chequeo de rate-limit/límite diario:
```php
    $enlaceId = null;
    if ($codigoEnlace) {
        $stmt = $db->prepare('SELECT id, usado_en FROM enlaces_encuesta WHERE codigo = :codigo');
        $stmt->execute(['codigo' => $codigoEnlace]);
        $enlace = $stmt->fetch();
        if (!$enlace || $enlace['usado_en'] !== null) {
            json_error('Este enlace ya fue utilizado o no es válido.', 410);
        }
        $enlaceId = $enlace['id'];
    }
```

Después del `INSERT` de la encuesta (con el `id` retornado), si `$enlaceId` no es null, marcarlo usado:
```php
    if ($enlaceId) {
        $db->prepare('UPDATE enlaces_encuesta SET usado_en = now(), encuesta_id = :encuesta_id WHERE id = :id')
           ->execute(['encuesta_id' => $nuevaEncuestaId, 'id' => $enlaceId]);
    }
```

- [ ] **Step 3: Verificar con curl**

Run:
```bash
CODIGO=$(curl -s -X POST http://localhost:8000/api/enlaces.php -H "Authorization: Bearer $TOKEN" | php -r '$d=json_decode(file_get_contents("php://stdin"),true); echo $d["data"]["codigo"];')

curl -s -X POST http://localhost:8000/api/encuestas.php -H "Content-Type: application/json" -d "{
  \"pregunta1_amabilidad\":\"Sí\",\"pregunta2_tiempo_espera\":\"Menos de 5 minutos\",
  \"pregunta3_resolucion_dudas\":\"Sí\",\"pregunta4_limpieza\":\"Excelente\",
  \"pregunta5_calificacion_general\":\"Excelente\",\"segundos_transcurridos\":10,
  \"turnstile_token\":\"$TOKEN_VALIDO_DE_PRUEBA\",\"codigo_enlace\":\"$CODIGO\"
}"
```
Expected primer envío: `200`. Repetir el mismo request con el mismo `$CODIGO`: `410`, "Este enlace ya fue utilizado...".

- [ ] **Step 4: Commit**

```bash
git add api/enlaces.php api/encuestas.php
git commit -m "feat: add one-time survey links (generation + validation)"
```

---

## Task 7: Enlaces de un solo uso (frontend)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Survey.tsx`
- Create: `src/components/admin/GenerateLinkTab.tsx`
- Modify: `src/pages/AdminDashboard.tsx`
- Modify: `package.json` (agregar dependencia `qrcode`)

**Interfaces:**
- Consumes: `POST /api/enlaces.php`, `POST /api/encuestas.php` con `codigo_enlace` (Task 6).

- [ ] **Step 1: Instalar librería de QR**

Run:
```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Ruta pública `/s/:codigo`**

Modify `src/App.tsx`, agregar antes del catch-all:
```tsx
<Route path="/s/:codigo" element={<Survey />} />
```

- [ ] **Step 3: `Survey.tsx` toma el código de la URL**

Modify `src/pages/Survey.tsx`: usar `useParams<{ codigo?: string }>()` de `react-router-dom`; si existe `codigo`, incluir `codigo_enlace: codigo` en el body del POST, y **omitir** el chequeo local de `hasSubmittedToday()` (ese chequeo solo aplica a la ruta pública genérica `/`, no a enlaces de un solo uso). Manejar el error `410` del backend ("enlace ya utilizado") con una pantalla amigable distinta a la del límite diario.

- [ ] **Step 4: Pestaña admin "Generar Enlace"**

Crear `src/components/admin/GenerateLinkTab.tsx`:
- Botón "Generar nuevo enlace" → `api.post("/enlaces.php", {})` → guarda `{ codigo, url }` en estado.
- Input opcional para el número de teléfono del paciente.
- Renderizar el QR con `qrcode` (función `toDataURL` o `toCanvas`) apuntando a `${window.location.origin}${url}`.
- Botón "Enviar por WhatsApp": `<a href={`https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(mensaje)}`} target="_blank">`, donde `mensaje` incluye la URL completa del enlace.
- Tabla debajo con los últimos enlaces generados (`api.get("/enlaces.php")`), mostrando si ya fueron usados (`usado_en`).

Modify `src/pages/AdminDashboard.tsx`: agregar `TabsTrigger`/`TabsContent` para `"enlaces"` (icono `Link` o `QrCode` de `lucide-react`).

- [ ] **Step 5: Verificar manualmente en el navegador**

- Panel admin → pestaña "Enlaces" → Generar enlace → aparece QR + botón WhatsApp.
- Abrir la URL generada (`/s/:codigo`) en una ventana nueva/incógnito → completar y enviar la encuesta → confirmar que se guarda.
- Reabrir la misma URL → confirmar que muestra el mensaje de "enlace ya utilizado" (no el formulario de nuevo).
- Confirmar en la pestaña "Enlaces" que ese código ahora aparece como usado.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/Survey.tsx src/components/admin/GenerateLinkTab.tsx src/pages/AdminDashboard.tsx package.json package-lock.json
git commit -m "feat: add one-time link generation UI with QR and WhatsApp send"
```

---

## Task 8: Pruebas integrales y despliegue a producción

**Files:**
- Ninguno de código — este task es de verificación y despliegue, igual que en la migración anterior.

- [ ] **Step 1: Checklist de pruebas integrales (local)**

- Encuesta pública normal (sin `codigo_enlace`) se envía y aparece en la base.
- Bot simulado (honeypot o tiempo < 3s) → falso éxito, no se guarda.
- Token de Turnstile inválido → rechazado.
- Segundo envío mismo día, mismo `device_id`, sin enlace → rechazado (429).
- Flujo completo de enlace de un solo uso (generar → responder → reintentar) → segundo intento rechazado (410).
- Rate limit por IP: 11 envíos seguidos desde la misma IP en menos de una hora → el 11vo rechazado (429).
- Panel admin: pestañas "Dispositivos Sospechosos" y "Enlaces" muestran datos correctos.

- [ ] **Step 2: Aplicar migración a producción**

Coordinar con el cliente (mismo patrón que la migración anterior): correr `db/migrations/2026-09-10-antifraude.sql` contra el Postgres de SiteGround en producción (vía `psql` desde una máquina con IP autorizada, o phpPgAdmin/Adminer si no hay acceso remoto).

- [ ] **Step 3: Configurar Turnstile de producción**

Actualizar `api/config.php` en el servidor con el `turnstile_secret` real (no el de prueba), y el build de producción con `VITE_TURNSTILE_SITE_KEY` real.

- [ ] **Step 4: Build y despliegue**

Run:
```bash
VITE_API_URL=/api VITE_TURNSTILE_SITE_KEY=<site_key_real> npm run build
```
Subir `dist/` + `api/` actualizados a `public_html` (mismo procedimiento que el deploy anterior).

- [ ] **Step 5: Smoke test en producción**

Repetir el checklist del Step 1 contra `https://imvhealths.sg-host.com`, con especial atención a: Turnstile funcionando con las claves reales, y que el botón de WhatsApp abra correctamente desde un celular real (no solo desde el navegador de escritorio).

- [ ] **Step 6: Documentación operativa para el staff**

Agregar una nota breve en `docs/` (o directamente en el README) explicando: cómo generar un enlace desde el panel, cómo enviarlo por WhatsApp, y qué significa que un dispositivo aparezca en "Sospechosos" (no se bloquea automático, es para revisión manual).
