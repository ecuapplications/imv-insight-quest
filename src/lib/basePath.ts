// En producción es "" (sin prefijo); en un deploy de staging bajo una
// subcarpeta (ej. /alpha/) se define VITE_BASE_PATH para que las rutas
// generadas por fuera de React Router (window.location.href, URLs
// compartibles, etc.) incluyan ese prefijo también.
export const BASE_PATH = (import.meta.env.VITE_BASE_PATH as string | undefined) || "";
