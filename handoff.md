# Handoff

## 1) Objetivo

Reforzar la encuesta pública (`imv-insight-quest`) contra bots y uso abusivo, distribuir la encuesta por enlaces de un solo uso enviados por WhatsApp (sin login del paciente), identificar a los pacientes que responden, y dar al panel de administración una experiencia mobile-first con roles de acceso diferenciados (admin vs recepción).

## 2) Estado actual

Rama de trabajo: `alpha` (sin PR, por instrucción explícita del usuario — todo se pushea directo a `origin/alpha`). Todo lo de abajo está commiteado y pusheado.

**Completo y verificado (local: Postgres + PHP built-in server + `curl` + Playwright):**
- Antifraude: honeypot, chequeo de tiempo de llenado, rate limit de 10/hora por IP, límite de 1 envío/día por `device_id`, pestaña "Dispositivos Sospechosos".
- **Cloudflare Turnstile fue removido por completo** (el usuario lo consideró inviable técnicamente) — no queda código ni script de Turnstile en el proyecto.
- Enlaces de un solo uso: generar (nombre + apellido + teléfono obligatorios) → QR + botón WhatsApp + copiar mensaje → paciente abre el link → se registra cada apertura (`device_id` + IP) → al responder, se marca `usado_en` en el enlace **y** se marca `respondido = true` en la apertura (`enlace_visitas`) específica que originó la respuesta.
- Si un paciente vuelve a abrir un enlace ya respondido, la encuesta lo detecta de forma **proactiva** (antes de que intente enviar) y le muestra "Ya recibimos tu respuesta, {nombre}" con opción de dejar un **comentario adicional** (`POST /api/enlace-comentario.php`), visible en el admin dentro del enlace correspondiente.
- Panel admin rediseñado mobile-first: bottom navigation, menú hamburguesa, swipe entre pestañas, thumb-zone friendly. Todos los emojis fueron reemplazados por iconos SVG (Lucide) tanto en el formulario público como en el admin.
- Filtros de período (día/mes/año exactos, con selector de calendario) activos y funcionando en Estadísticas, Gestión de Comentarios (Kanban — el filtro estaba roto, se corrigió), Sospechosos y Enlaces.
- **Nueva pestaña "Comentarios"** (`src/components/admin/ComentariosTab.tsx`): listado de cards con nombre, apellido, teléfono (o "Anónimo" si la respuesta no viene de un enlace válido) y las 5 respuestas + comentario de cada encuesta, con búsqueda por nombre/teléfono y filtro de período. **Es la pestaña por defecto** al entrar al panel.
- Kanban: cada card ahora muestra el nombre/apellido/teléfono del paciente (o "Anónimo").
- **Roles de administrador**: `admin` (acceso total) y `recepcion` (solo ve y usa la pestaña Enlaces — todo lo demás, incluido el bottom nav y el menú de pestañas, queda oculto). Aplicado tanto en frontend (`AdminDashboard.tsx`) como en backend (`require_admin()` en `api/lib/auth.php`, aplicado a `encuestas.php`, `dispositivos-sospechosos.php`, `responsables.php`, `tareas.php`, `etiquetas.php`; `enlaces.php` queda abierto a ambos roles).
- Usuario `recepcion@imvcientific.com` / `imv#$26R` creado (rol `recepcion`) — probado con login real y verificado que solo ve Enlaces.
- Encuesta personalizada: saluda por el primer nombre del paciente cuando viene de un enlace (nunca el apellido — el apellido es dato admin-only).

**Verificado con Playwright (desktop 1280×900 y mobile 390×844):** login admin → tab Comentarios por defecto, tab Enlaces con campo Apellido, tab Kanban con identificadores, login recepción → solo ve Enlaces (desktop y mobile), pantalla de "enlace ya respondido" con formulario de comentario adicional.

**Pendiente (no iniciado en esta sesión, heredado de la Task 8 original):**
- Pruebas de integración final y despliegue a producción real (`imvhealths.sg-host.com` root) — hasta ahora todo se ha probado vía staging en `/alpha/` (mismo dominio, subcarpeta, reutilizando la base de datos de producción).
- Aplicar la migración `db/migrations/2026-09-10-comentarios-roles.sql` contra el Postgres de producción en SiteGround.
- Crear el usuario `recepcion@imvcientific.com` en la base de producción (mismo comando `seed_admin.php`, ver sección 5).

## 3) Archivos y cambios de esta sesión (Fase 9)

- `db/schema.sql`, `db/migrations/2026-09-10-comentarios-roles.sql` (nuevo) — `enlaces_encuesta.apellido_paciente`, `enlace_visitas.respondido`, tabla nueva `enlace_comentarios_adicionales`, `admins.role` (CHECK `admin`/`recepcion`, default `admin`).
- `api/encuestas.php` — GET ahora hace `LEFT JOIN` con `enlaces_encuesta` para exponer `nombre_paciente`/`apellido_paciente`/`telefono`; POST marca la apertura (`enlace_visitas`) más reciente del mismo `device_id` (o la más reciente en general si no hay match) como `respondido = true` al recibir una respuesta vía `codigo_enlace`. Ahora requiere `require_admin()` en vez de `require_auth()`.
- `api/enlaces.php` — lookup público ahora también devuelve `usado: boolean`; POST exige `apellido_paciente`; GET admin agrega `apellido_paciente`, `visitas[].respondido` y `comentarios_adicionales[]` (vía `json_agg`).
- `api/enlace-comentario.php` (nuevo) — POST público, sin auth: guarda un comentario adicional ligado a un `codigo` de enlace ya usado.
- `api/lib/auth.php` — nueva función `require_admin()` (envuelve `require_auth()` y exige `role === 'admin'`, 403 si no).
- `api/auth/login.php`, `api/auth/me.php` — el JWT y la respuesta de `/me.php` ahora incluyen `role`.
- `api/dispositivos-sospechosos.php`, `api/responsables.php`, `api/tareas.php`, `api/etiquetas.php` (POST/DELETE) — cambiados de `require_auth()` a `require_admin()`.
- `api/scripts/seed_admin.php` — acepta un tercer argumento opcional de rol (`admin`|`recepcion`, default `admin`).
- `src/lib/api.ts` — `AdminRole`, `setRole()`, `getRole()`; `login()` ahora persiste el rol devuelto por el backend; `logout()` limpia el rol también.
- `src/components/admin/ComentariosTab.tsx` (nuevo) — la pestaña de cards descrita arriba.
- `src/components/admin/KanbanTab.tsx` — cards muestran nombre/apellido/teléfono o "Anónimo".
- `src/components/admin/GenerateLinkTab.tsx` — campo Apellido (obligatorio), tipo `Enlace` extendido (`apellido_paciente`, `visitas[].respondido`, `comentarios_adicionales`), badge "Respondido"/apertura que generó la respuesta, listado de comentarios adicionales por enlace.
- `src/pages/Survey.tsx` — el lookup público al montar ahora also lee `usado`; si es `true`, salta directo a la pantalla de "ya recibimos tu respuesta" (antes solo se detectaba reactivamente al fallar el submit) con formulario de comentario adicional (`POST /api/enlace-comentario.php`).
- `src/pages/AdminDashboard.tsx` — nueva pestaña "Comentarios" (primera en la lista, pestaña por defecto); `visibleTabs` filtra las pestañas según `getRole()` (recepción solo ve "enlaces"); bottom nav usa `grid-template-columns` dinámico y se oculta si solo hay 1 pestaña visible.

**No commiteado (correcto):** `api/config.php` local (Postgres local `imv_test`), `.env.local` temporal usado solo para las pruebas de esta sesión (ya eliminado).

## 4) Intentos fallidos

- Nada digno de mención en esta sesión — todo el flujo backend se verificó de punta a punta con `curl` (login admin/recepción, generar enlace sin apellido → rechazado, generar con apellido → OK, loguear apertura, responder vía `codigo_enlace`, verificar `respondido=true` en la apertura correcta, verificar `usado=true` en el lookup público, enviar comentario adicional, verlo en el listado admin) antes de tocar el frontend, y el frontend se verificó visualmente con Playwright (desktop + mobile, ambos roles).
- Nota operativa (ya conocida de sesiones anteriores, se repitió aquí): los procesos en background (`php -S`, `vite`) a veces reportan `exit code 144` aunque sigan corriendo o mueran — siempre verificar con `ps aux` / `curl` después de lanzarlos, y usar `nohup ... & disown` en vez de subshells `(cmd &)`.

## 5) Próximos pasos (en orden)

1. Aplicar `db/migrations/2026-09-10-comentarios-roles.sql` contra el Postgres de producción en SiteGround (mismo procedimiento que las migraciones anteriores).
2. Crear el usuario de recepción en producción: `php api/scripts/seed_admin.php recepcion@imvcientific.com 'imv#$26R' recepcion` (ejecutar en el hosting, con el `config.php` de producción).
3. Build + subir a `/alpha/` (staging) para que el usuario pruebe la Fase 9 completa con datos reales antes de ir a producción — mismo procedimiento de siempre (`vite build --base=/alpha/`, empaquetar `dist/` + `api/` + `.htaccess` con `RewriteBase /alpha/` + `config.php` de staging).
4. Una vez aprobado por el usuario: definir con él cómo se pasa esto a producción real (`imvhealths.sg-host.com` root) — sigue pendiente la Task 8 original (pruebas integrales + despliegue final), nunca cerrada formalmente.
5. Si el usuario pide más cambios sobre roles/permisos: recordar que `enlaces.php` es la única ruta abierta a ambos roles; cualquier endpoint nuevo debe decidir explícitamente si usa `require_auth()` (ambos roles) o `require_admin()` (solo admin).
