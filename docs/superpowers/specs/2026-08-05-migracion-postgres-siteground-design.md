# Migración de Supabase a PostgreSQL propio (SiteGround GrowBig)

## Contexto y motivación

El proyecto usa hoy `@supabase/supabase-js` directamente desde el navegador para:
- Autenticación del panel de administración (`supabase.auth.signInWithPassword`, sesión persistida en `localStorage`).
- CRUD sobre 4 tablas Postgres (`encuestas`, `tareas`, `etiquetas`, `responsables`) vía la API REST autogenerada de Supabase (PostgREST) y protegida con RLS.

El usuario ya tiene una base de datos PostgreSQL propia dentro de su hosting SiteGround (plan GrowBig) y quiere dejar de depender de Supabase, usando exclusivamente esa base.

**Restricción clave descubierta:** GrowBig es hosting compartido y **no soporta Node.js** (confirmado en la KB de SiteGround y vigente a 2026). Sí soporta PHP nativo con la extensión `pdo_pgsql`. Un navegador tampoco puede hablar Postgres directo (protocolo binario, y expondría credenciales de la DB). Por lo tanto se necesita una capa intermedia HTTP, y esa capa debe ser PHP para correr en GrowBig.

## Alcance

Reemplazar Supabase (Auth + PostgREST) por:
1. Un backend PHP propio (`/api/*.php`) desplegado en el mismo hosting, sin framework, hablando a Postgres vía PDO.
2. Autenticación propia con JWT firmado (HS256, implementación de un solo archivo, sin librerías externas).
3. Migración del esquema y de los datos existentes desde Supabase hacia el Postgres de SiteGround.
4. Actualización del frontend React para consumir la nueva API en vez de `supabase-js`.

Fuera de alcance: soporte multi-admin/roles (hoy hay un único administrador), registro público de usuarios (los encuestados no se autentican, solo insertan una fila anónima).

## Arquitectura

```
React (Vite build estático) ──fetch──▶ /api/*.php (PDO pgsql) ──▶ PostgreSQL (SiteGround)
        │
        └─ JWT en localStorage, enviado como Authorization: Bearer <token>
```

- **Frontend**: misma estructura de componentes. Se reemplaza el import de `@/integrations/supabase/client` por un cliente propio `@/lib/api.ts` que envuelve `fetch`, agrega el header `Authorization` automáticamente y normaliza la respuesta al shape `{ data, error }` que los componentes ya esperan (minimiza el diff en cada componente).
- **Backend**: carpeta `/api` servida por el mismo dominio (sin problemas de CORS en producción). `bootstrap.php` centraliza la conexión PDO y expone `requireAuth()` para las rutas protegidas.
- **DB**: mismo esquema ya definido en `supabase/migrations/*.sql` (SQL estándar, portable tal cual a Postgres de SiteGround, sin sintaxis específica de Supabase salvo `gen_random_uuid()` que requiere la extensión `pgcrypto` habilitada).

## Componentes y endpoints

Cada endpoint es un archivo PHP delgado. `bootstrap.php` valida JWT donde aplique.

| Endpoint | Método | Auth | Reemplaza |
|---|---|---|---|
| `/api/auth/login.php` | POST | público | `supabase.auth.signInWithPassword` |
| `/api/auth/me.php` | GET | JWT | `supabase.auth.getSession()` |
| `/api/encuestas.php` | POST | público (inserta respuesta anónima) | `Survey.tsx` insert |
| `/api/encuestas.php` | GET | JWT | `StatsTab` / `KanbanTab` select |
| `/api/encuestas.php` | PATCH | JWT | actualizar `estado_kanban` |
| `/api/tareas.php` | GET / PATCH | JWT | `KanbanTab` (incl. marcar "Vencida") |
| `/api/etiquetas.php` | GET / POST / PATCH / DELETE | JWT | `TagsManagementTab` |
| `/api/responsables.php` | GET | JWT | asignación de tareas en `CommentModal` |

## Autenticación

- Tabla nueva `admins (id, email UNIQUE, password_hash, created_at)`. Un único registro inicial (admin actual).
- Login: `password_verify()` contra `password_hash` (bcrypt). Si es válido, se firma un JWT (HS256, `hash_hmac`, sin librería externa) con expiración de 8h.
- El frontend guarda el JWT en `localStorage` (mismo patrón que hoy) y lo manda en cada request protegido vía `Authorization: Bearer <token>`.
- `requireAuth()` en `bootstrap.php` valida firma + expiración; si falla, responde `401` y el frontend redirige a `/admin/login`.

## Flujo de datos y manejo de errores

1. El frontend llama `api.get(...)`/`api.post(...)` desde `src/lib/api.ts`.
2. El endpoint valida auth (si aplica) y ejecuta la query con **PDO prepared statements** (reemplaza la protección contra SQL injection que hoy da PostgREST).
3. Respuesta JSON con envelope consistente: `{ "data": ..., "error": null }` o `{ "data": null, "error": "mensaje" }`, con el status HTTP correspondiente (400 validación, 401 no autenticado, 404, 500).
4. **CORS**: no se necesita en producción (mismo dominio). En desarrollo local (Vite en `:8080` contra la API remota), se agregan headers CORS restringidos a `localhost:8080` solo cuando `APP_ENV=dev`.

## Migración de datos

1. Aplicar el esquema (`supabase/migrations/*.sql`) al Postgres de SiteGround, habilitando `pgcrypto` si no está ya.
2. Exportar los datos actuales con `pg_dump --data-only` contra la connection string de Postgres que expone Supabase (Project Settings → Database).
3. Importar con `psql` al Postgres de SiteGround.
   - **Pendiente de confirmar en la fase de implementación**: host/puerto/usuario de esa base, y si SiteGround permite conexión remota directa o si el import debe hacerse vía phpPgAdmin/Adminer del cPanel.

## Deployment

```
public_html/
├── index.html, assets/...   ← build de `vite build`
├── api/
│   ├── bootstrap.php
│   ├── auth/login.php, auth/me.php
│   ├── encuestas.php, tareas.php, etiquetas.php, responsables.php
│   └── config.php           ← credenciales DB, fuera de git (vía .env o constante local no versionada)
└── .htaccess                ← SPA rewrite a index.html, EXCEPTO rutas /api/*
```

## Testing

No hay infraestructura de tests automatizados en el repo hoy (solo ESLint). Verificación manual mediante checklist de humo tras implementar:
- Login de admin (credenciales correctas e incorrectas).
- Insertar una encuesta anónima sin JWT (debe funcionar).
- Leer `/api/encuestas` sin JWT (debe fallar con 401).
- Ver stats en `StatsTab`.
- Mover una tarjeta en el Kanban y confirmar que persiste `estado_kanban`.
- CRUD completo de etiquetas.
- Asignación de responsable en `CommentModal`.
