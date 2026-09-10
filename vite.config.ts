import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// vite-plugin-pwa base-prefija automáticamente el <link rel="manifest">, el
// registro del service worker y la lista de precache, pero NO los valores
// start_url/scope *dentro* del manifest.webmanifest — hay que prefijarlos a
// mano con el mismo VITE_BASE_PATH que ya usa el resto de la app (ej. "/alpha"
// en el build de staging bajo subcarpeta, "" en producción).
const basePath = (process.env.VITE_BASE_PATH || "/").replace(/\/$/, "");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // injectManifest (no generateSW): necesitamos código propio en el
      // service worker para manejar notificaciones push (evento `push` /
      // `notificationclick`), así que escribimos src/sw.ts a mano y el
      // plugin solo le inyecta la lista de precache (self.__WB_MANIFEST).
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      registerType: "autoUpdate",
      includeAssets: ["pwa-icons/apple-touch-icon.png"],
      manifest: {
        name: "IMV Health Digestive - Panel Administrativo",
        short_name: "IMV Admin",
        description:
          "Panel administrativo de IMV Health Digestive para gestión de encuestas de satisfacción.",
        theme_color: "#2AF5FF",
        background_color: "#f4f5f7",
        display: "standalone",
        start_url: `${basePath}/admin-login`,
        scope: `${basePath}/`,
        icons: [
          { src: "pwa-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "pwa-icons/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "pwa-icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
