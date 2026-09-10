// Suprime el prompt nativo de instalación de PWA en las rutas públicas
// (encuesta) — solo queremos ofrecer "instalar la app" en las rutas del
// panel de administración. Un paciente llenando la encuesta nunca debería
// ver un banner que dice "Instalar IMV Admin".
//
// `beforeinstallprompt` se dispara como máximo una vez por carga de página
// (no se repite en navegación interna de React Router), así que basta con
// evaluar la ruta una sola vez al cargar.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let stashedEvent: BeforeInstallPromptEvent | null = null;

function isAdminRoute(): boolean {
  const basePath = (import.meta.env.VITE_BASE_PATH as string | undefined) || "";
  let path = window.location.pathname;
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length);
  }
  return path.startsWith("/admin");
}

window.addEventListener("beforeinstallprompt", (event) => {
  // Siempre se previene el mini-banner automático del navegador — si la
  // ruta es de admin, guardamos el evento para dispararlo manualmente desde
  // un botón de "Instalar app" más adelante.
  event.preventDefault();
  if (isAdminRoute()) {
    stashedEvent = event as BeforeInstallPromptEvent;
  }
});

export function getStashedInstallPrompt(): BeforeInstallPromptEvent | null {
  return stashedEvent;
}

export async function promptInstall(): Promise<boolean> {
  if (!stashedEvent) return false;
  await stashedEvent.prompt();
  const { outcome } = await stashedEvent.userChoice;
  stashedEvent = null;
  return outcome === "accepted";
}
