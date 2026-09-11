// El service worker ya NO se registra automáticamente (injectRegister:
// false en vite.config.ts) — se registra a mano, únicamente desde las
// pantallas de admin, con scope acotado a "/admin". Esto evita que Chrome
// considere instalable la encuesta pública (un SW con scope "/" haría
// instalable cualquier ruta del sitio, sin importar la lógica de
// pwaInstallPrompt.ts).

import { BASE_PATH } from "@/lib/basePath";

// Sin barra final a propósito: el scope-matching del service worker es un
// prefijo de string plano (no respeta límites de segmento de ruta), igual
// que ya asume isAdminRoute() en pwaInstallPrompt.ts — así "/admin" cubre
// tanto "/admin" como "/admin-login".
const ADMIN_SCOPE = `${BASE_PATH}/admin`;

function resolvedAdminScope(): string {
  return new URL(ADMIN_SCOPE, window.location.origin).href;
}

export function registerAdminServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: ADMIN_SCOPE }).catch((error) => {
    console.error("No se pudo registrar el service worker del admin:", error);
  });
}

// Limpieza best-effort para navegadores que ya visitaron el sitio con una
// versión anterior que registraba el service worker con scope "/" (sitio
// completo) — ese registro persiste hasta que se reemplaza o desregistra
// explícitamente, así que sin esto seguiría haciendo instalable la
// encuesta pública aunque el nuevo código ya no lo registre ahí.
export async function unregisterStrayServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const expectedScope = resolvedAdminScope();
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => registration.scope !== expectedScope)
        .map((registration) => registration.unregister()),
    );
  } catch (error) {
    console.error("No se pudo limpiar service workers previos:", error);
  }
}
