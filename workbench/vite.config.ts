import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// S1 workbench: Vue3 + TS shell plus a "walking skeleton" panel that posts a
// fake click/fetch batch and reads the stored events back.
//
// Proxy (dev server only): /ingest and /api go to the local collector at
// http://127.0.0.1:8601. The IPv4 literal is deliberate — `localhost` may
// resolve to [::1] where the collector does not listen, and the collector has
// no CORS, so requests must stay same-origin through this proxy.
//
// Known limitation: `vite preview` (and any static hosting of dist/) does NOT
// run this proxy, so the S1 panel will report "collector unreachable" there.
// The S1 panel is a dev-server feature; run `npm run dev` on port 5173.
export default defineConfig({
  plugins: [vue()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/ingest": { target: "http://127.0.0.1:8601", changeOrigin: false },
      "/api": { target: "http://127.0.0.1:8601", changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
