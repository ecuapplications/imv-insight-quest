import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/lib/pwaInstallPrompt";

createRoot(document.getElementById("root")!).render(<App />);
