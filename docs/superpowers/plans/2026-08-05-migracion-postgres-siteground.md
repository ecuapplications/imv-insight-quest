# Migración de Supabase a PostgreSQL propio (SiteGround) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `@supabase/supabase-js` (Auth + PostgREST) por un backend PHP propio (`/api/*.php`, PDO + `pgsql`) que hable con el PostgreSQL de SiteGround, con auth JWT casera, y migrar el frontend React para consumir esa API.

**Architecture:** Frontend estático (Vite/React) sin cambios de estructura, solo cambia de dónde saca los datos: en vez de `supabase-js` usa un cliente propio (`src/lib/api.ts`) que llama a endpoints PHP servidos desde el mismo dominio (`/api/*.php`). Cada endpoint usa PDO con prepared statements contra Postgres. Auth: tabla `admins` + JWT HS256 firmado a mano (sin librerías externas, para poder subir por FTP sin Composer).

**Tech Stack:** PHP 8+ con extensión `pdo_pgsql` (sin framework), PostgreSQL, React/Vite/TypeScript (ya existente).

## Global Constraints

- Sin frameworks PHP ni librerías externas (Composer) — GrowBig se sube por FTP, cero dependencias que empaquetar. Ver [design spec](../specs/2026-08-05-migracion-postgres-siteground-design.md).
- Sin Node.js en producción (no soportado por GrowBig) — el build de Vite se hace en local/CI y solo se sube `dist/`.
- Todas las queries SQL usan **prepared statements** (`PDO::prepare` + parámetros bindeados) — nunca interpolar input de usuario en SQL.
- Envelope de respuesta JSON consistente en toda la API: `{ "data": ..., "error": null }` o `{ "data": null, "error": "mensaje" }`.
- No existe suite de tests automatizados en el repo (solo ESLint). No se introduce PHPUnit/Vitest en esta migración (fuera de alcance del spec) — la verificación de cada tarea es manual: PHP built-in server + `curl` para el backend, `npm run build` (type-check) + prueba en navegador para el frontend.
- No commitear `api/config.php` (contiene credenciales) — va en `.gitignore`, solo se commitea `api/config.example.php`.

---

## Task 1: Esquema de base de datos + tabla de admin

**Files:**
- Create: `db/schema.sql`
- Create: `api/scripts/seed_admin.php`

**Interfaces:**
- Produces: tablas `encuestas`, `responsables`, `tareas` (con enum `estado_tarea`), `etiquetas`, `admins` — nombres de columna exactos que usan todos los endpoints de las tareas siguientes.

- [ ] **Step 1: Escribir el esquema combinado**

Crear `db/schema.sql`:

```sql
-- Esquema combinado, portado desde supabase/migrations/*.sql
-- (RLS de Supabase se elimina: el control de acceso ahora vive en la capa PHP)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.encuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  pregunta1_amabilidad TEXT NOT NULL CHECK (pregunta1_amabilidad IN ('Sí', 'No')),
  pregunta2_tiempo_espera TEXT NOT NULL CHECK (pregunta2_tiempo_espera IN ('Menos de 5 minutos', 'Entre 5 y 10 minutos', 'Más de 10 minutos')),
  pregunta3_resolucion_dudas TEXT NOT NULL CHECK (pregunta3_resolucion_dudas IN ('Sí', 'No', 'No tenía')),
  pregunta4_limpieza TEXT NOT NULL CHECK (pregunta4_limpieza IN ('Excelente', 'Buena', 'Regular', 'Mala')),
  pregunta5_calificacion_general TEXT NOT NULL CHECK (pregunta5_calificacion_general IN ('Excelente', 'Buena', 'Regular', 'Mala')),
  comentario TEXT,
  estado_kanban TEXT DEFAULT 'Bandeja de Entrada' CHECK (estado_kanban IN ('Bandeja de Entrada', 'Felicitaciones y Reconocimientos 👍', 'Sugerencias de Mejora 💡', 'Áreas de Oportunidad (Quejas) ⚠️', 'Archivado / Resuelto ✅')),
  etiquetas TEXT[] DEFAULT ARRAY[]::TEXT[],
  notas_internas TEXT
);

CREATE INDEX idx_encuestas_fecha_creacion ON public.encuestas(fecha_creacion DESC);
CREATE INDEX idx_encuestas_estado_kanban ON public.encuestas(estado_kanban);
CREATE INDEX idx_encuestas_etiquetas ON public.encuestas USING GIN(etiquetas);

CREATE TABLE public.responsables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TYPE public.estado_tarea AS ENUM ('Pendiente', 'Vencida', 'Descartada', 'Resuelta');

CREATE TABLE public.tareas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encuesta_id UUID NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  responsable_id UUID NOT NULL REFERENCES public.responsables(id) ON DELETE RESTRICT,
  fecha_vencimiento DATE NOT NULL,
  estado public.estado_tarea NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tareas_encuesta_id ON public.tareas(encuesta_id);
CREATE INDEX idx_tareas_responsable_id ON public.tareas(responsable_id);
CREATE INDEX idx_tareas_estado ON public.tareas(estado);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tareas_updated_at
BEFORE UPDATE ON public.tareas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.etiquetas (nombre) VALUES
  ('Atención y Trato'),
  ('Tiempos de Espera'),
  ('Claridad de la Información'),
  ('Procesos y Trámites'),
  ('Instalaciones'),
  ('Resolución de Problemas')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Aplicar el esquema al Postgres de SiteGround**

Run (reemplazando host/usuario/db por los reales de tu panel de SiteGround):
```bash
psql "postgresql://USUARIO:PASSWORD@HOST:5432/NOMBRE_DB" -f db/schema.sql
```
Expected: termina sin errores; `\dt` dentro de `psql` muestra las 5 tablas.

- [ ] **Step 3: Script para crear el admin inicial**

Crear `api/scripts/seed_admin.php`:

```php
<?php
// Uso: php seed_admin.php admin@ejemplo.com "contraseñaSegura123"
require __DIR__ . '/../lib/db.php';

if ($argc !== 3) {
    fwrite(STDERR, "Uso: php seed_admin.php <email> <password>\n");
    exit(1);
}

[$_, $email, $password] = $argv;
$hash = password_hash($password, PASSWORD_BCRYPT);

$db = get_db();
$stmt = $db->prepare(
    'INSERT INTO admins (email, password_hash) VALUES (:email, :hash)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash'
);
$stmt->execute(['email' => $email, 'hash' => $hash]);

echo "Admin '$email' creado/actualizado correctamente.\n";
```

- [ ] **Step 4: Commit**

Sugerido (ejecútalo tú):
```bash
git add db/schema.sql api/scripts/seed_admin.php
git commit -m "feat: add Postgres schema and admin seed script"
```

---

## Task 2: Núcleo del backend PHP (config, conexión DB, JWT, auth helpers)

**Files:**
- Create: `api/config.example.php`
- Create: `api/lib/db.php`
- Create: `api/lib/jwt.php`
- Create: `api/lib/auth.php`
- Create: `api/bootstrap.php`
- Modify: `.gitignore` (agregar `api/config.php`)

**Interfaces:**
- Consumes: tabla `admins` de Task 1.
- Produces: `get_db(): PDO`, `jwt_encode(array $payload, string $secret): string`, `jwt_decode(string $token, string $secret): ?array`, `require_auth(): array` (retorna el payload del JWT o corta con 401), `json_ok($data)`, `json_error(string $msg, int $status)`, `apply_cors()` — funciones que usan todos los endpoints de las tareas siguientes.

- [ ] **Step 1: Config de ejemplo**

Crear `api/config.example.php`:

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'CAMBIAR_NOMBRE_DB',
        'user' => 'CAMBIAR_USUARIO',
        'password' => 'CAMBIAR_PASSWORD',
    ],
    'jwt_secret' => 'CAMBIAR_POR_UN_SECRETO_LARGO_Y_ALEATORIO',
    'jwt_ttl_seconds' => 8 * 60 * 60,
    'cors_origin' => getenv('APP_ENV') === 'dev' ? 'http://localhost:8080' : null,
];
```

- [ ] **Step 2: Agregar config.php al .gitignore**

Editar `.gitignore` (agregar al final):
```
api/config.php
```

- [ ] **Step 3: Copiar config.example.php a config.php para desarrollo local**

```bash
cp api/config.example.php api/config.php
```
Editar `api/config.php` con las credenciales reales de tu Postgres local o de SiteGround.

- [ ] **Step 4: Conexión PDO**

Crear `api/lib/db.php`:

```php
<?php

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $config = require __DIR__ . '/../config.php';
        $db = $config['db'];
        $dsn = "pgsql:host={$db['host']};port={$db['port']};dbname={$db['dbname']}";
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}
```

- [ ] **Step 5: JWT casero (HS256)**

Crear `api/lib/jwt.php`:

```php
<?php

function jwt_base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_base64url_decode(string $data): string {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_encode(array $payload, string $secret): string {
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];
    $segments = [
        jwt_base64url_encode(json_encode($header)),
        jwt_base64url_encode(json_encode($payload)),
    ];
    $signingInput = implode('.', $segments);
    $signature = hash_hmac('sha256', $signingInput, $secret, true);
    $segments[] = jwt_base64url_encode($signature);
    return implode('.', $segments);
}

function jwt_decode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$headerB64, $payloadB64, $sigB64] = $parts;
    $expectedSig = jwt_base64url_encode(hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true));
    if (!hash_equals($expectedSig, $sigB64)) {
        return null;
    }
    $payload = json_decode(jwt_base64url_decode($payloadB64), true);
    if (!is_array($payload)) {
        return null;
    }
    if (isset($payload['exp']) && time() >= $payload['exp']) {
        return null;
    }
    return $payload;
}
```

- [ ] **Step 6: Helpers de respuesta JSON, CORS y auth**

Crear `api/lib/auth.php`:

```php
<?php
require_once __DIR__ . '/jwt.php';

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_response(['data' => null, 'error' => $message], $status);
}

function json_ok($data): void {
    json_response(['data' => $data, 'error' => null]);
}

function require_auth(): array {
    $config = require __DIR__ . '/../config.php';
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        json_error('No autenticado', 401);
    }
    $payload = jwt_decode($m[1], $config['jwt_secret']);
    if ($payload === null) {
        json_error('Token inválido o expirado', 401);
    }
    return $payload;
}

function apply_cors(): void {
    $config = require __DIR__ . '/../config.php';
    if (!empty($config['cors_origin'])) {
        header('Access-Control-Allow-Origin: ' . $config['cors_origin']);
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
```

- [ ] **Step 7: Bootstrap compartido**

Crear `api/bootstrap.php`:

```php
<?php
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/jwt.php';
require_once __DIR__ . '/lib/auth.php';

apply_cors();
```

- [ ] **Step 8: Verificar que el JWT casero funciona**

Run:
```bash
php -r '
require "api/lib/jwt.php";
$token = jwt_encode(["sub" => "123", "exp" => time() + 60], "test-secret");
$payload = jwt_decode($token, "test-secret");
var_dump($payload["sub"] === "123");
$expired = jwt_encode(["exp" => time() - 1], "test-secret");
var_dump(jwt_decode($expired, "test-secret") === null);
var_dump(jwt_decode($token, "wrong-secret") === null);
'
```
Expected: tres líneas `bool(true)`.

- [ ] **Step 9: Commit**

Sugerido:
```bash
git add api/config.example.php api/lib api/bootstrap.php .gitignore
git commit -m "feat: add PHP backend core (PDO connection, homemade JWT, auth helpers)"
```

---

## Task 3: Endpoints de autenticación (login, me)

**Files:**
- Create: `api/auth/login.php`
- Create: `api/auth/me.php`

**Interfaces:**
- Consumes: `get_db()`, `jwt_encode()`, `require_auth()`, `json_ok()`, `json_error()` de Task 2.
- Produces: `POST /api/auth/login.php` → `{ data: { token, email }, error: null }`; `GET /api/auth/me.php` → `{ data: { email }, error: null }`.

- [ ] **Step 1: Endpoint de login**

Crear `api/auth/login.php`:

```php
<?php
require __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$email = trim($body['email'] ?? '');
$password = $body['password'] ?? '';

if ($email === '' || $password === '') {
    json_error('Email y contraseña son requeridos', 400);
}

$stmt = get_db()->prepare('SELECT id, email, password_hash FROM admins WHERE email = :email');
$stmt->execute(['email' => $email]);
$admin = $stmt->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    json_error('Credenciales incorrectas', 401);
}

$config = require __DIR__ . '/../config.php';
$token = jwt_encode([
    'sub' => $admin['id'],
    'email' => $admin['email'],
    'exp' => time() + $config['jwt_ttl_seconds'],
], $config['jwt_secret']);

json_ok(['token' => $token, 'email' => $admin['email']]);
```

- [ ] **Step 2: Endpoint de verificación de sesión**

Crear `api/auth/me.php`:

```php
<?php
require __DIR__ . '/../bootstrap.php';

$payload = require_auth();
json_ok(['email' => $payload['email']]);
```

- [ ] **Step 3: Crear el admin de prueba y levantar el servidor local**

Run:
```bash
php api/scripts/seed_admin.php admin@test.com "password123"
php -S localhost:8000 -t .
```

- [ ] **Step 4: Probar login y me con curl**

Run (en otra terminal, con el servidor del paso anterior corriendo):
```bash
curl -s -X POST http://localhost:8000/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'
```
Expected: `{"data":{"token":"...","email":"admin@test.com"},"error":null}`

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login.php -H "Content-Type: application/json" -d '{"email":"admin@test.com","password":"password123"}' | php -r 'echo json_decode(file_get_contents("php://stdin"), true)["data"]["token"];')
curl -s http://localhost:8000/api/auth/me.php -H "Authorization: Bearer $TOKEN"
```
Expected: `{"data":{"email":"admin@test.com"},"error":null}`

```bash
curl -s -X POST http://localhost:8000/api/auth/login.php -H "Content-Type: application/json" -d '{"email":"admin@test.com","password":"mala"}'
```
Expected: status 401, `{"data":null,"error":"Credenciales incorrectas"}`

- [ ] **Step 5: Commit**

Sugerido:
```bash
git add api/auth
git commit -m "feat: add login and session-check endpoints"
```

---

## Task 4: Cliente API del frontend

**Files:**
- Create: `src/lib/api.ts`
- Create: `.env.example` (agregar `VITE_API_URL`)

**Interfaces:**
- Produces: `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch<T>(path, body)`, `api.del<T>(path)` (todos retornan `Promise<{ data: T | null; error: string | null }>`), `login(email, password)`, `logout()`, `isAuthenticated(): boolean`, `setToken(token)` — usados por todas las páginas/componentes en las tareas siguientes.

- [ ] **Step 1: Variable de entorno para la URL de la API**

Crear/editar `.env.example`:
```
VITE_API_URL=/api
```

- [ ] **Step 2: Cliente fetch con JWT**

Crear `src/lib/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "admin_token";

export type ApiResult<T> = { data: T | null; error: string | null };

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res
    .json()
    .catch(() => ({ data: null, error: "Respuesta inválida del servidor" }));

  if (!res.ok) {
    return { data: null, error: body.error || `Error ${res.status}` };
  }
  return body as ApiResult<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function login(
  email: string,
  password: string
): Promise<ApiResult<{ token: string; email: string }>> {
  const result = await api.post<{ token: string; email: string }>("/auth/login.php", {
    email,
    password,
  });
  if (result.data) setToken(result.data.token);
  return result;
}

export function logout() {
  setToken(null);
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript en `src/lib/api.ts`.

- [ ] **Step 4: Commit**

Sugerido:
```bash
git add src/lib/api.ts .env.example
git commit -m "feat: add frontend API client to replace supabase-js"
```

---

## Task 5: Migrar páginas de autenticación (AdminLogin, AdminDashboard)

**Files:**
- Modify: `src/pages/AdminLogin.tsx`
- Modify: `src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `login()`, `logout()`, `isAuthenticated()` de `src/lib/api.ts` (Task 4).

- [ ] **Step 1: Reemplazar supabase en AdminLogin.tsx**

Modify `src/pages/AdminLogin.tsx:9` — cambiar el import:
```typescript
import { login, isAuthenticated } from "@/lib/api";
```

Modify `src/pages/AdminLogin.tsx:18-27` — reemplazar el chequeo de sesión:
```typescript
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin");
    }
  }, [navigate]);
```

Modify `src/pages/AdminLogin.tsx:29-51` — reemplazar `handleLogin`:
```typescript
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await login(email, password);
      if (error || !data) throw new Error(error ?? "Error desconocido");

      toast.success("Bienvenido al panel de administración");
      navigate("/admin");
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Credenciales incorrectas");
    } finally {
      setIsLoading(false);
    }
  };
```

- [ ] **Step 2: Reemplazar supabase en AdminDashboard.tsx**

Modify `src/pages/AdminDashboard.tsx:9` — cambiar el import:
```typescript
import { logout, isAuthenticated } from "@/lib/api";
```

Modify `src/pages/AdminDashboard.tsx:16-24` — reemplazar el chequeo de sesión:
```typescript
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin-login");
    }
  }, [navigate]);
```

Modify `src/pages/AdminDashboard.tsx:26-45` — reemplazar `handleLogout`:
```typescript
  const handleLogout = () => {
    logout();
    window.location.href = '/admin-login';
  };
```

- [ ] **Step 3: Verificar manualmente en el navegador**

Run:
```bash
php -S localhost:8000 -t . &
npm run dev
```
En el navegador (`http://localhost:8080/admin-login`):
- Login con credenciales incorrectas → debe mostrar "Credenciales incorrectas".
- Login con `admin@test.com` / `password123` (creado en Task 3) → debe redirigir a `/admin`.
- Refrescar `/admin` → debe seguir logueado (no redirige a login).
- Click en "Cerrar Sesión" → debe redirigir a `/admin-login`, y refrescar `/admin` directo debe volver a mandar a login.

- [ ] **Step 4: Commit**

Sugerido:
```bash
git add src/pages/AdminLogin.tsx src/pages/AdminDashboard.tsx
git commit -m "refactor: migrate admin auth pages from supabase to custom API client"
```

---

## Task 6: Endpoint `/api/encuestas.php`

**Files:**
- Create: `api/encuestas.php`

**Interfaces:**
- Consumes: `get_db()`, `require_auth()`, `json_ok()`, `json_error()` de Task 2.
- Produces: `POST /api/encuestas.php` (público), `GET /api/encuestas.php?since=&with_comment=` (JWT), `PATCH /api/encuestas.php?id=` (JWT, body `{ estado_kanban?, etiquetas?, notas_internas? }`).

- [ ] **Step 1: Escribir el endpoint**

Crear `api/encuestas.php`:

```php
<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $required = [
        'pregunta1_amabilidad', 'pregunta2_tiempo_espera', 'pregunta3_resolucion_dudas',
        'pregunta4_limpieza', 'pregunta5_calificacion_general',
    ];
    foreach ($required as $field) {
        if (empty($body[$field])) {
            json_error("El campo $field es requerido", 400);
        }
    }
    $comentario = $body['comentario'] ?? null;
    $stmt = $db->prepare(
        'INSERT INTO encuestas (pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, comentario, estado_kanban)
         VALUES (:p1, :p2, :p3, :p4, :p5, :comentario, :estado_kanban)
         RETURNING id'
    );
    $stmt->execute([
        'p1' => $body['pregunta1_amabilidad'],
        'p2' => $body['pregunta2_tiempo_espera'],
        'p3' => $body['pregunta3_resolucion_dudas'],
        'p4' => $body['pregunta4_limpieza'],
        'p5' => $body['pregunta5_calificacion_general'],
        'comentario' => $comentario,
        'estado_kanban' => $comentario ? 'Bandeja de Entrada' : null,
    ]);
    json_ok(['id' => $stmt->fetchColumn()]);
}

require_auth();

if ($method === 'GET') {
    $sql = 'SELECT id, fecha_creacion, pregunta1_amabilidad, pregunta2_tiempo_espera, pregunta3_resolucion_dudas, pregunta4_limpieza, pregunta5_calificacion_general, comentario, estado_kanban, etiquetas, notas_internas FROM encuestas';
    $conditions = [];
    $params = [];
    if (!empty($_GET['since'])) {
        $conditions[] = 'fecha_creacion >= :since';
        $params['since'] = $_GET['since'];
    }
    if (!empty($_GET['with_comment'])) {
        $conditions[] = 'comentario IS NOT NULL';
    }
    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY fecha_creacion DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    json_ok($stmt->fetchAll());
}

if ($method === 'PATCH') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['estado_kanban', 'etiquetas', 'notas_internas'];
    $sets = [];
    $params = ['id' => $id];
    foreach ($allowed as $field) {
        if (!array_key_exists($field, $body)) continue;
        $sets[] = "$field = :$field";
        if ($field === 'etiquetas') {
            $escaped = array_map(fn($t) => '"' . str_replace('"', '\\"', $t) . '"', $body[$field]);
            $params[$field] = '{' . implode(',', $escaped) . '}';
        } else {
            $params[$field] = $body[$field];
        }
    }
    if (!$sets) json_error('No hay campos para actualizar', 400);
    $sql = 'UPDATE encuestas SET ' . implode(', ', $sets) . ' WHERE id = :id';
    $db->prepare($sql)->execute($params);
    json_ok(['updated' => true]);
}

json_error('Método no permitido', 405);
```

- [ ] **Step 2: Probar con curl**

Run (con `php -S localhost:8000 -t .` corriendo):
```bash
curl -s -X POST http://localhost:8000/api/encuestas.php -H "Content-Type: application/json" -d '{
  "pregunta1_amabilidad": "Sí",
  "pregunta2_tiempo_espera": "Menos de 5 minutos",
  "pregunta3_resolucion_dudas": "Sí",
  "pregunta4_limpieza": "Excelente",
  "pregunta5_calificacion_general": "Excelente",
  "comentario": "Prueba de migración"
}'
```
Expected: `{"data":{"id":"..."},"error":null}` (inserta sin necesitar token — igual que el flujo público de la encuesta).

```bash
curl -s http://localhost:8000/api/encuestas.php
```
Expected: status 401 (sin token no puede leer).

```bash
curl -s "http://localhost:8000/api/encuestas.php?with_comment=1" -H "Authorization: Bearer $TOKEN"
```
Expected: status 200, incluye la encuesta insertada arriba.

- [ ] **Step 3: Commit**

Sugerido:
```bash
git add api/encuestas.php
git commit -m "feat: add encuestas endpoint (public insert, admin read/update)"
```

---

## Task 7: Migrar Survey.tsx y StatsTab.tsx

**Files:**
- Modify: `src/pages/Survey.tsx`
- Modify: `src/components/admin/StatsTab.tsx`

**Interfaces:**
- Consumes: `api.post`, `api.get` de `src/lib/api.ts` (Task 4); `POST /api/encuestas.php`, `GET /api/encuestas.php?since=` (Task 6).

- [ ] **Step 1: Migrar el envío de la encuesta pública**

Modify `src/pages/Survey.tsx:6` — cambiar el import:
```typescript
import { api } from "@/lib/api";
```

Modify `src/pages/Survey.tsx:95-115` — reemplazar `handleSubmit`:
```typescript
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await api.post("/encuestas.php", {
        pregunta1_amabilidad: answers.pregunta1_amabilidad,
        pregunta2_tiempo_espera: answers.pregunta2_tiempo_espera,
        pregunta3_resolucion_dudas: answers.pregunta3_resolucion_dudas,
        pregunta4_limpieza: answers.pregunta4_limpieza,
        pregunta5_calificacion_general: answers.pregunta5_calificacion_general,
        comentario: answers.comentario || null,
      });
      if (error) throw new Error(error);
      setCurrentStep(totalSteps);
    } catch (error) {
      console.error("Error submitting survey:", error);
      toast.error("Hubo un error al enviar la encuesta. Por favor, intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 2: Migrar StatsTab.tsx**

Modify `src/components/admin/StatsTab.tsx:4` — cambiar el import:
```typescript
import { api } from "@/lib/api";
```

Modify `src/components/admin/StatsTab.tsx:52-79` — reemplazar `fetchResponses`:
```typescript
  const fetchResponses = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      switch (filter) {
        case "day": startDate.setHours(0, 0, 0, 0); break;
        case "week": startDate.setDate(now.getDate() - 7); break;
        case "month": startDate.setMonth(now.getMonth() - 1); break;
        case "year": startDate.setFullYear(now.getFullYear() - 1); break;
      }
      const { data, error } = await api.get<EncuestaData[]>(
        `/encuestas.php?since=${encodeURIComponent(startDate.toISOString())}`
      );
      if (error) {
        toast.error("Debe iniciar sesión para ver las estadísticas");
        return;
      }
      setResponses(data || []);
    } catch (error) {
      console.error("Error fetching responses:", error);
      toast.error("Error al cargar las estadísticas");
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Verificar manualmente**

Con `php -S localhost:8000 -t .` y `npm run dev` corriendo:
- Ir a `/survey`, completar la encuesta y enviarla → debe mostrar la pantalla de "¡Gracias!".
- Loguearse en `/admin-login`, ir a la pestaña Estadísticas → debe mostrar la respuesta recién enviada en los gráficos.

- [ ] **Step 4: Commit**

Sugerido:
```bash
git add src/pages/Survey.tsx src/components/admin/StatsTab.tsx
git commit -m "refactor: migrate survey submission and stats tab to custom API client"
```

---

## Task 8: Endpoints `/api/tareas.php` y `/api/responsables.php`

**Files:**
- Create: `api/tareas.php`
- Create: `api/responsables.php`

**Interfaces:**
- Consumes: `get_db()`, `require_auth()`, `json_ok()`, `json_error()` de Task 2.
- Produces: `GET /api/tareas.php?encuesta_id=` (JWT), `POST /api/tareas.php` (JWT), `PATCH /api/tareas.php?id=` (JWT), `DELETE /api/tareas.php?id=` (JWT); `GET /api/responsables.php` (JWT), `POST /api/responsables.php` (JWT).

- [ ] **Step 1: Endpoint de tareas**

Crear `api/tareas.php`:

```php
<?php
require __DIR__ . '/bootstrap.php';
require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'GET') {
    $encuestaId = $_GET['encuesta_id'] ?? null;
    if (!$encuestaId) json_error('Falta el parámetro encuesta_id', 400);

    $stmt = $db->prepare(
        'SELECT t.*, r.nombre AS responsable_nombre
         FROM tareas t
         LEFT JOIN responsables r ON r.id = t.responsable_id
         WHERE t.encuesta_id = :encuesta_id
         ORDER BY t.created_at ASC'
    );
    $stmt->execute(['encuesta_id' => $encuestaId]);
    $tareas = $stmt->fetchAll();

    $hoy = (new DateTime('today'))->format('Y-m-d');
    foreach ($tareas as &$tarea) {
        if ($tarea['estado'] === 'Pendiente' && $tarea['fecha_vencimiento'] < $hoy) {
            $db->prepare('UPDATE tareas SET estado = :estado WHERE id = :id')
               ->execute(['estado' => 'Vencida', 'id' => $tarea['id']]);
            $tarea['estado'] = 'Vencida';
        }
    }
    unset($tarea);
    json_ok($tareas);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    foreach (['encuesta_id', 'nombre', 'responsable_id', 'fecha_vencimiento'] as $field) {
        if (empty($body[$field])) json_error("El campo $field es requerido", 400);
    }
    $stmt = $db->prepare(
        'INSERT INTO tareas (encuesta_id, nombre, descripcion, responsable_id, fecha_vencimiento, estado)
         VALUES (:encuesta_id, :nombre, :descripcion, :responsable_id, :fecha_vencimiento, :estado)
         RETURNING id'
    );
    $stmt->execute([
        'encuesta_id' => $body['encuesta_id'],
        'nombre' => $body['nombre'],
        'descripcion' => $body['descripcion'] ?? null,
        'responsable_id' => $body['responsable_id'],
        'fecha_vencimiento' => $body['fecha_vencimiento'],
        'estado' => $body['estado'] ?? 'Pendiente',
    ]);
    json_ok(['id' => $stmt->fetchColumn()]);
}

if ($method === 'PATCH') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $allowed = ['nombre', 'descripcion', 'responsable_id', 'fecha_vencimiento', 'estado'];
    $sets = [];
    $params = ['id' => $id];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $sets[] = "$field = :$field";
            $params[$field] = $body[$field];
        }
    }
    if (!$sets) json_error('No hay campos para actualizar', 400);
    $db->prepare('UPDATE tareas SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
    json_ok(['updated' => true]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $db->prepare('DELETE FROM tareas WHERE id = :id')->execute(['id' => $id]);
    json_ok(['deleted' => true]);
}

json_error('Método no permitido', 405);
```

- [ ] **Step 2: Endpoint de responsables**

Crear `api/responsables.php`:

```php
<?php
require __DIR__ . '/bootstrap.php';
require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, nombre, email, created_at FROM responsables ORDER BY nombre');
    json_ok($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    $email = trim($body['email'] ?? '');
    if ($nombre === '' || $email === '') json_error('Nombre y email son requeridos', 400);
    try {
        $stmt = $db->prepare(
            'INSERT INTO responsables (nombre, email) VALUES (:nombre, :email)
             RETURNING id, nombre, email, created_at'
        );
        $stmt->execute(['nombre' => $nombre, 'email' => $email]);
        json_ok($stmt->fetch());
    } catch (PDOException $e) {
        json_error('Ya existe un responsable con ese email', 409);
    }
}

json_error('Método no permitido', 405);
```

- [ ] **Step 3: Probar con curl**

Run (con el servidor local y `$TOKEN` del Task 3):
```bash
curl -s -X POST http://localhost:8000/api/responsables.php \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"nombre":"Juan Pérez","email":"juan@test.com"}'
```
Expected: `{"data":{"id":"...","nombre":"Juan Pérez",...},"error":null}` — guarda ese `id` como `$RESP_ID`.

```bash
ENCUESTA_ID=$(curl -s "http://localhost:8000/api/encuestas.php?with_comment=1" -H "Authorization: Bearer $TOKEN" | php -r '$d=json_decode(file_get_contents("php://stdin"),true); echo $d["data"][0]["id"];')

curl -s -X POST http://localhost:8000/api/tareas.php \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"encuesta_id\":\"$ENCUESTA_ID\",\"nombre\":\"Dar seguimiento\",\"responsable_id\":\"$RESP_ID\",\"fecha_vencimiento\":\"2020-01-01\"}"

curl -s "http://localhost:8000/api/tareas.php?encuesta_id=$ENCUESTA_ID" -H "Authorization: Bearer $TOKEN"
```
Expected: la tarea creada con fecha en el pasado aparece con `"estado":"Vencida"` (verifica el auto-marcado).

- [ ] **Step 4: Commit**

Sugerido:
```bash
git add api/tareas.php api/responsables.php
git commit -m "feat: add tareas and responsables endpoints"
```

---

## Task 9: Endpoint `/api/etiquetas.php`

**Files:**
- Create: `api/etiquetas.php`

**Interfaces:**
- Consumes: `get_db()`, `require_auth()`, `json_ok()`, `json_error()` de Task 2.
- Produces: `GET /api/etiquetas.php` (público, igual que la RLS original de Supabase), `POST /api/etiquetas.php` (JWT), `DELETE /api/etiquetas.php?id=` (JWT).

- [ ] **Step 1: Escribir el endpoint**

Crear `api/etiquetas.php`:

```php
<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = get_db();

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, nombre, created_at FROM etiquetas ORDER BY nombre');
    json_ok($stmt->fetchAll());
}

require_auth();

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    if ($nombre === '') json_error('El nombre es requerido', 400);
    try {
        $stmt = $db->prepare(
            'INSERT INTO etiquetas (nombre) VALUES (:nombre)
             RETURNING id, nombre, created_at'
        );
        $stmt->execute(['nombre' => $nombre]);
        json_ok($stmt->fetch());
    } catch (PDOException $e) {
        json_error('Ya existe una etiqueta con ese nombre', 409);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) json_error('Falta el parámetro id', 400);
    $db->prepare('DELETE FROM etiquetas WHERE id = :id')->execute(['id' => $id]);
    json_ok(['deleted' => true]);
}

json_error('Método no permitido', 405);
```

- [ ] **Step 2: Probar con curl**

Run:
```bash
curl -s http://localhost:8000/api/etiquetas.php
```
Expected: status 200 sin token (lectura pública), incluye las 6 etiquetas predefinidas del esquema.

```bash
curl -s -X POST http://localhost:8000/api/etiquetas.php -H "Content-Type: application/json" -d '{"nombre":"Prueba"}'
```
Expected: status 401 (crear requiere token).

```bash
curl -s -X POST http://localhost:8000/api/etiquetas.php -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"nombre":"Prueba"}'
```
Expected: status 200, etiqueta creada.

- [ ] **Step 3: Commit**

Sugerido:
```bash
git add api/etiquetas.php
git commit -m "feat: add etiquetas endpoint"
```

---

## Task 10: Migrar KanbanTab.tsx

**Files:**
- Modify: `src/components/admin/KanbanTab.tsx`

**Interfaces:**
- Consumes: `api.get`, `api.patch` de `src/lib/api.ts` (Task 4); `GET/PATCH /api/encuestas.php`, `GET /api/etiquetas.php`, `GET/PATCH /api/tareas.php` (Tasks 6, 8, 9).

- [ ] **Step 1: Reemplazar el import**

Modify `src/components/admin/KanbanTab.tsx:2`:
```typescript
import { api } from "@/lib/api";
```

- [ ] **Step 2: Reemplazar `fetchEtiquetas`**

Modify `src/components/admin/KanbanTab.tsx:78-90`:
```typescript
  const fetchEtiquetas = async () => {
    try {
      const { data, error } = await api.get<Etiqueta[]>("/etiquetas.php");
      if (error) throw new Error(error);
      setEtiquetasDisponibles(data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };
```

- [ ] **Step 3: Reemplazar `fetchEncuestas`**

Modify `src/components/admin/KanbanTab.tsx:94-162`:
```typescript
  const fetchEncuestas = async () => {
    setLoading(true);
    try {
      const { data: encuestasData, error } = await api.get<any[]>("/encuestas.php?with_comment=1");
      if (error) {
        toast.error("Debe iniciar sesión para ver los comentarios");
        setLoading(false);
        return;
      }

      const encuestasConTareas = await Promise.all(
        (encuestasData || []).map(async (encuesta) => {
          const { data: tareasData, error: tareasError } = await api.get<any[]>(
            `/tareas.php?encuesta_id=${encuesta.id}`
          );

          if (tareasError) {
            console.error(`Error al buscar tarea para la encuesta ${encuesta.id}:`, tareasError);
            return { ...encuesta, tarea: null };
          }

          const tarea = tareasData && tareasData.length > 0 ? tareasData[0] : null;

          if (tarea) {
            return {
              ...encuesta,
              tarea: {
                responsable_nombre: tarea.responsable_nombre || "Sin responsable",
                fecha_vencimiento: tarea.fecha_vencimiento,
                estado: tarea.estado,
              },
            };
          }
          return { ...encuesta, tarea: null };
        })
      );

      setEncuestas(encuestasConTareas);
    } catch (error) {
      console.error("Error fetching encuestas:", error);
      toast.error("Error al cargar los comentarios");
    } finally {
      setLoading(false);
    }
  };
```

Nota: el auto-marcado de tareas vencidas ("Pendiente" + fecha pasada → "Vencida") ya lo hace `GET /api/tareas.php` en el backend (Task 8, Step 1), así que se elimina esa lógica duplicada del frontend.

- [ ] **Step 4: Reemplazar `handleDrop` y `handleMoveCard`**

Modify `src/components/admin/KanbanTab.tsx:219-240`:
```typescript
  const handleDrop = async (e: React.DragEvent, nuevoEstado: string) => {
    e.preventDefault();
    if (!draggedItem) return;
    try {
      const { error } = await api.patch(`/encuestas.php?id=${draggedItem}`, { estado_kanban: nuevoEstado });
      if (error) throw new Error(error);
      setEncuestas((prev) => prev.map((enc) => (enc.id === draggedItem ? { ...enc, estado_kanban: nuevoEstado } : enc)));
      toast.success("Comentario movido exitosamente");
    } catch (error) {
      toast.error("Error al mover el comentario");
    } finally {
      setDraggedItem(null);
    }
  };
  const handleMoveCard = async (encuestaId: string, nuevoEstado: string) => {
    try {
      const { error } = await api.patch(`/encuestas.php?id=${encuestaId}`, { estado_kanban: nuevoEstado });
      if (error) throw new Error(error);
      setEncuestas((prev) => prev.map((enc) => (enc.id === encuestaId ? { ...enc, estado_kanban: nuevoEstado } : enc)));
      toast.success("Comentario movido exitosamente");
    } catch (error) {
      toast.error("Error al mover el comentario");
    }
  };
```

- [ ] **Step 5: Verificar manualmente**

En `/admin` → pestaña "Gestión de Comentarios": arrastrar una tarjeta a otra columna y confirmar que persiste tras refrescar la página; usar el menú de "Mover tarjeta" también.

- [ ] **Step 6: Commit**

Sugerido:
```bash
git add src/components/admin/KanbanTab.tsx
git commit -m "refactor: migrate KanbanTab from supabase to custom API client"
```

---

## Task 11: Migrar TagsManagementTab.tsx

**Files:**
- Modify: `src/components/admin/TagsManagementTab.tsx`

**Interfaces:**
- Consumes: `api.get`, `api.post`, `api.del`, `api.patch` de `src/lib/api.ts`; `GET/POST/DELETE /api/etiquetas.php`, `GET/PATCH /api/encuestas.php` (Tasks 6, 9).

- [ ] **Step 1: Reemplazar el import**

Modify `src/components/admin/TagsManagementTab.tsx:16`:
```typescript
import { api } from "@/lib/api";
```

- [ ] **Step 2: Reemplazar `fetchEtiquetas`**

Modify `src/components/admin/TagsManagementTab.tsx:36-52`:
```typescript
  const fetchEtiquetas = async () => {
    setLoading(true);
    try {
      const { data, error } = await api.get<Etiqueta[]>("/etiquetas.php");
      if (error) throw new Error(error);
      setEtiquetas(data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("Error al cargar las etiquetas");
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Reemplazar `handleCreateTag`**

Modify `src/components/admin/TagsManagementTab.tsx:54-81`:
```typescript
  const handleCreateTag = async () => {
    const trimmedName = newTagName.trim();

    if (!trimmedName) {
      toast.error("El nombre de la etiqueta no puede estar vacío");
      return;
    }

    if (etiquetas.some(e => e.nombre.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Ya existe una etiqueta con ese nombre");
      return;
    }

    try {
      const { error } = await api.post("/etiquetas.php", { nombre: trimmedName });
      if (error) throw new Error(error);

      toast.success("Etiqueta creada exitosamente");
      setNewTagName("");
      fetchEtiquetas();
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Error al crear la etiqueta");
    }
  };
```

- [ ] **Step 4: Reemplazar `handleDeleteTag`**

Modify `src/components/admin/TagsManagementTab.tsx:83-126`:
```typescript
  const handleDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      const { data: encuestasConTag, error: fetchError } = await api.get<{ id: string; etiquetas: string[] }[]>(
        `/encuestas.php?with_comment=1`
      );
      if (fetchError) throw new Error(fetchError);

      const afectadas = (encuestasConTag || []).filter((e) => (e.etiquetas || []).includes(tagToDelete.nombre));
      for (const encuesta of afectadas) {
        const updatedTags = (encuesta.etiquetas || []).filter((tag) => tag !== tagToDelete.nombre);
        const { error: updateError } = await api.patch(`/encuestas.php?id=${encuesta.id}`, { etiquetas: updatedTags });
        if (updateError) throw new Error(updateError);
      }

      const { error: deleteError } = await api.del(`/etiquetas.php?id=${tagToDelete.id}`);
      if (deleteError) throw new Error(deleteError);

      toast.success(`Etiqueta "${tagToDelete.nombre}" eliminada exitosamente`);
      setTagToDelete(null);
      fetchEtiquetas();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error("Error al eliminar la etiqueta");
    }
  };
```

Nota: el filtro `.contains("etiquetas", [...])` de Supabase no existe en la API propia — en su lugar se trae todo con `with_comment=1` (que ya incluye la columna `etiquetas`) y se filtra en JS. Es aceptable dado el volumen bajo de encuestas con comentario; si el dataset crece mucho, se puede agregar un filtro `?tag=` al endpoint más adelante (YAGNI por ahora).

- [ ] **Step 5: Verificar manualmente**

En `/admin` → pestaña "Gestión de Etiquetas": crear una etiqueta nueva, verificar que aparece; eliminar una etiqueta que esté asignada a algún comentario y confirmar (en la pestaña Kanban) que ese comentario ya no la muestra.

- [ ] **Step 6: Commit**

Sugerido:
```bash
git add src/components/admin/TagsManagementTab.tsx
git commit -m "refactor: migrate TagsManagementTab from supabase to custom API client"
```

---

## Task 12: Migrar CommentModal.tsx

**Files:**
- Modify: `src/components/admin/CommentModal.tsx`

**Interfaces:**
- Consumes: `api.get`, `api.post`, `api.patch`, `api.del` de `src/lib/api.ts`; `GET /api/etiquetas.php`, `POST /api/etiquetas.php`, `GET/POST/PATCH/DELETE /api/tareas.php`, `GET/POST /api/responsables.php`, `PATCH /api/encuestas.php` (Tasks 6, 8, 9).

- [ ] **Step 1: Reemplazar el import**

Modify `src/components/admin/CommentModal.tsx:10`:
```typescript
import { api } from "@/lib/api";
```

- [ ] **Step 2: Reemplazar `loadEtiquetas`, `loadTareas`, `loadResponsables`**

Modify `src/components/admin/CommentModal.tsx:91-134`:
```typescript
  const loadEtiquetas = async () => {
    try {
      const { data, error } = await api.get<Etiqueta[]>("/etiquetas.php");
      if (error) throw new Error(error);
      setEtiquetasDisponibles(data || []);
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  };

  const loadTareas = async () => {
    const { data, error } = await api.get<any[]>(`/tareas.php?encuesta_id=${encuesta.id}`);

    if (error) {
      console.error("Error loading tasks:", error);
      return;
    }

    setTareas((data || []).map((t) => ({
      ...t,
      fecha_vencimiento: new Date(t.fecha_vencimiento),
    })));
  };

  const loadResponsables = async () => {
    const { data, error } = await api.get<Responsable[]>("/responsables.php");

    if (error) {
      console.error("Error loading responsables:", error);
      return;
    }

    setResponsables(data || []);
  };
```

- [ ] **Step 3: Reemplazar `handleAddNewTag`**

Modify `src/components/admin/CommentModal.tsx:137-184`:
```typescript
  const handleAddNewTag = async () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag) {
      toast.error("El nombre de la etiqueta no puede estar vacío.");
      return;
    }

    const exists = etiquetasDisponibles.some(
      (tag) => tag.nombre.toLowerCase() === trimmedTag.toLowerCase()
    );
    if (exists) {
      toast.warning(`La etiqueta "${trimmedTag}" ya existe.`);
      if (!selectedTags.includes(trimmedTag)) {
        toggleTag(trimmedTag);
      }
      setNewTag("");
      return;
    }

    try {
      const { data, error } = await api.post<{ id: string; nombre: string }>("/etiquetas.php", { nombre: trimmedTag });
      if (error || !data) throw new Error(error ?? "Error desconocido");

      toast.success("Etiqueta creada exitosamente");
      setNewTag("");

      await loadEtiquetas();
      setSelectedTags((prev) => [...prev, data.nombre]);
      onUpdate();
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("No se pudo crear la etiqueta.");
    }
  };
```

- [ ] **Step 4: Reemplazar `handleAddResponsable`, `handleSaveTask`, `handleDeleteTask`, `handleSave`**

Modify `src/components/admin/CommentModal.tsx:188-211` (`handleAddResponsable`):
```typescript
  const handleAddResponsable = async () => {
    if (!newResponsable.nombre.trim() || !newResponsable.email.trim()) {
      toast.error("Nombre y email son requeridos");
      return;
    }

    const { data, error } = await api.post<Responsable>("/responsables.php", newResponsable);

    if (error || !data) {
      toast.error("Error al crear responsable");
      console.error(error);
      return;
    }

    setResponsables([...responsables, data]);
    setTaskForm({ ...taskForm, responsable_id: data.id });
    setNewResponsable({ nombre: "", email: "" });
    setShowNewResponsable(false);
    toast.success("Responsable creado exitosamente");
  };
```

Modify `src/components/admin/CommentModal.tsx:213-279` (`handleSaveTask`):
```typescript
  const handleSaveTask = async () => {
    if (!taskForm.nombre.trim() || !taskForm.responsable_id) {
      toast.error("Nombre y responsable son requeridos");
      return;
    }

    let estadoFinal = taskForm.estado;
    const fechaVencimiento = new Date(taskForm.fecha_vencimiento);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVencimiento.setHours(0, 0, 0, 0);

    if (taskForm.estado === "Vencida" && fechaVencimiento > hoy) {
      estadoFinal = "Pendiente";
    }

    const payload = {
      nombre: taskForm.nombre,
      descripcion: taskForm.descripcion,
      responsable_id: taskForm.responsable_id,
      fecha_vencimiento: taskForm.fecha_vencimiento.toISOString().split('T')[0],
      estado: estadoFinal,
    };

    if (editingTaskId) {
      const { error } = await api.patch(`/tareas.php?id=${editingTaskId}`, payload);
      if (error) {
        toast.error("Error al actualizar tarea");
        console.error(error);
        return;
      }
      toast.success("Tarea actualizada");
    } else {
      const { error } = await api.post("/tareas.php", { encuesta_id: encuesta.id, ...payload });
      if (error) {
        toast.error("Error al crear tarea");
        console.error(error);
        return;
      }
      toast.success("Tarea creada");
    }

    setShowTaskForm(false);
    setEditingTaskId(null);
    setTaskForm({
      nombre: "",
      descripcion: "",
      responsable_id: "",
      fecha_vencimiento: new Date(),
      estado: "Pendiente",
    });

    onUpdate();
    loadTareas();
  };
```

Modify `src/components/admin/CommentModal.tsx:293-308` (`handleDeleteTask`):
```typescript
  const handleDeleteTask = async (tareaId: string) => {
    const { error } = await api.del(`/tareas.php?id=${tareaId}`);

    if (error) {
      toast.error("Error al eliminar tarea");
      console.error(error);
      return;
    }

    toast.success("Tarea eliminada");
    onUpdate();
    loadTareas();
  };
```

Modify `src/components/admin/CommentModal.tsx:316-335` (`handleSave`):
```typescript
  const handleSave = async () => {
    try {
      const { error } = await api.patch(`/encuestas.php?id=${encuesta.id}`, {
        etiquetas: selectedTags,
        notas_internas: notasInternas,
      });

      if (error) throw new Error(error);

      toast.success("Cambios guardados exitosamente");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating data:", error);
      toast.error("Error al guardar cambios");
    }
  };
```

- [ ] **Step 5: Verificar manualmente**

Abrir un comentario en el Kanban: agregar/quitar etiquetas, escribir notas internas, crear un responsable nuevo, crear una tarea, editarla, eliminarla, y guardar — confirmar que todo persiste al reabrir el modal.

- [ ] **Step 6: Commit**

Sugerido:
```bash
git add src/components/admin/CommentModal.tsx
git commit -m "refactor: migrate CommentModal from supabase to custom API client"
```

---

## Task 13: Configuración de despliegue (.htaccess)

**Files:**
- Create: `.htaccess`

**Interfaces:**
- Ninguna — configuración de servidor, no código de aplicación.

- [ ] **Step 1: Escribir el .htaccess raíz**

Crear `.htaccess` en la raíz del repo (se sube junto al build a `public_html`):

```apache
RewriteEngine On

# No reescribir requests a /api/*.php — deben servirse tal cual
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^ - [L]

# Servir archivos y carpetas que existen tal cual (assets del build)
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Todo lo demás cae a index.html (SPA routing de React Router)
RewriteRule ^ index.html [L]
```

- [ ] **Step 2: Verificar con el servidor PHP local**

Run:
```bash
npm run build
php -S localhost:8000 -t dist
```
Nota: el servidor built-in de PHP no lee `.htaccess` (eso es específico de Apache), así que esta verificación es solo para confirmar que `dist/index.html` existe y sirve. La verificación real del `.htaccess` se hace después de subir a SiteGround: navegar a una ruta como `/admin` directamente (no solo vía links internos) y confirmar que carga la SPA en vez de un 404, y que `/api/etiquetas.php` responde JSON y no HTML.

- [ ] **Step 3: Commit**

Sugerido:
```bash
git add .htaccess
git commit -m "chore: add .htaccess for SPA routing and API passthrough"
```

---

## Task 14: Migración de datos existentes (Supabase → SiteGround)

**Files:**
- Ninguno (es un runbook operativo, no código versionado).

**Interfaces:**
- Ninguna.

- [ ] **Step 1: Obtener la connection string de Supabase**

En el dashboard de Supabase: Project Settings → Database → Connection string (modo "URI", usar el puerto de conexión directa, no el pooler de transacciones).

- [ ] **Step 2: Exportar solo los datos (el esquema ya se aplicó en Task 1)**

Run:
```bash
pg_dump "postgresql://postgres:[PASSWORD]@[SUPABASE_HOST]:5432/postgres" \
  --data-only \
  --table=public.encuestas --table=public.responsables --table=public.tareas --table=public.etiquetas \
  --column-inserts \
  -f data_dump.sql
```

- [ ] **Step 3: Importar al Postgres de SiteGround**

**Este paso requiere las credenciales reales del Postgres de SiteGround (host, puerto, usuario, nombre de DB) — pídelas antes de ejecutar.** Confirmar también si SiteGround permite conexión remota directa a Postgres o si hay que hacerlo desde phpPgAdmin/Adminer en cPanel (en cuyo caso se pega el contenido de `data_dump.sql` ahí en vez de usar `psql` por línea de comandos).

Run (si hay conexión remota):
```bash
psql "postgresql://USUARIO:PASSWORD@HOST:5432/NOMBRE_DB" -f data_dump.sql
```

- [ ] **Step 4: Verificar el conteo de filas**

Run:
```bash
psql "postgresql://USUARIO:PASSWORD@HOST:5432/NOMBRE_DB" -c "
SELECT 'encuestas' AS tabla, count(*) FROM encuestas
UNION ALL SELECT 'responsables', count(*) FROM responsables
UNION ALL SELECT 'tareas', count(*) FROM tareas
UNION ALL SELECT 'etiquetas', count(*) FROM etiquetas;
"
```
Expected: los conteos coinciden con los que tenías en Supabase (verificar con la misma query contra la connection string de Supabase).

- [ ] **Step 5: Borrar el dump local**

Run:
```bash
rm data_dump.sql
```
(Contiene datos reales de encuestas — no debe quedar en el repo ni subirse a ningún lado.)

---

## Task 15: Quitar la dependencia de Supabase

**Files:**
- Modify: `package.json` (quitar `@supabase/supabase-js`)
- Delete: `src/integrations/supabase/`
- Delete: `supabase/` (carpeta de migraciones, ya portadas a `db/schema.sql`)

**Interfaces:**
- Ninguna — limpieza final, no debe quedar ningún import de `@/integrations/supabase/client` en `src/`.

- [ ] **Step 1: Confirmar que no queda ningún import de supabase**

Run:
```bash
grep -rl "integrations/supabase\|@supabase/supabase-js" src/
```
Expected: sin resultados (si aparece algo, esa tarea de migración quedó incompleta — revisar Tasks 5, 7, 10, 11, 12 antes de continuar).

- [ ] **Step 2: Borrar la carpeta de integración y las migraciones viejas**

Run:
```bash
rm -rf src/integrations/supabase
rm -rf supabase
```

- [ ] **Step 3: Quitar el paquete de package.json**

Run:
```bash
npm uninstall @supabase/supabase-js
```

- [ ] **Step 4: Verificar que el build sigue funcionando**

Run:
```bash
npm run build
```
Expected: build exitoso sin errores de módulos faltantes.

- [ ] **Step 5: Commit**

Sugerido:
```bash
git add -A
git commit -m "chore: remove supabase dependency and legacy migrations folder"
```
