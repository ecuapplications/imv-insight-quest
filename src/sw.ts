/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

// registerType: "autoUpdate" — el service worker nuevo toma control de
// inmediato en vez de esperar a que se cierren todas las pestañas. Evita
// repetir el bug de "index.html viejo cacheado" que ya corregimos por HTTP.
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();

// Precache del shell de la app (JS/CSS/HTML/íconos) — la lista exacta con
// hashes la inyecta vite-plugin-pwa en el build, no se mantiene a mano.
precacheAndRoute(self.__WB_MANIFEST);

// Fallback de navegación: cualquier ruta de la SPA (/admin, /s/:codigo, etc.)
// que no esté precacheada exactamente se sirve con el index.html cacheado —
// mismo comportamiento que ya hace el rewrite de .htaccess en el servidor,
// ahora también disponible offline. `/api/*` y cualquier `.php` quedan
// explícitamente afuera: esas rutas siempre deben ir a la red, nunca
// servirse desde caché (datos de pacientes, tokens de sesión).
const navigationHandler = createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`);
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/\/api\//, /\.php$/],
  }),
);

// A propósito, no se registra ningún runtimeCaching para `/api/`: sin una
// ruta que la intercepte, cualquier fetch a esas URLs simplemente no pasa
// por el service worker y va directo a la red, igual que hoy.

// El backend encola el payload ya con esta forma exacta (ver api/lib/push.php).
type PushPayload = { title: string; body: string; url?: string };

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  const data = event.data.json() as PushPayload;
  const iconUrl = `${self.registration.scope}pwa-icons/icon-192.png`;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: iconUrl,
      badge: iconUrl,
      data: { url: data.url ?? "" },
    }),
  );
});

// Al hacer clic: si ya hay una pestaña del admin abierta, la enfoca y navega
// ahí (deep-link a la pestaña relevante vía ?tab=); si no, abre una nueva.
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const relativeUrl = (event.notification.data?.url as string | undefined) ?? "";
  const adminBase = `${self.registration.scope}admin`;
  const targetUrl = `${adminBase}${relativeUrl}`;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.startsWith(adminBase) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await (client as WindowClient).navigate(targetUrl);
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
