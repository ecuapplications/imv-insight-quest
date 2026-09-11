import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/lib/pwaInstallPrompt";
import { unregisterStrayServiceWorkers } from "@/lib/registerServiceWorker";

// Best-effort: limpia cualquier service worker de una versión anterior que
// lo registraba con scope "/" (sitio completo) — sin esto, un paciente que
// ya visitó el sitio seguiría teniendo instalable la encuesta pública
// aunque el código nuevo ya no registre el SW ahí. No-op en /admin, donde
// el scope registrado ahora sí coincide.
unregisterStrayServiceWorkers();

createRoot(document.getElementById("root")!).render(<App />);
