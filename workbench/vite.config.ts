import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// S3 workbench: Vue3 + TS shell. The primary board is the S3 frontend-facts /
// read-only replay panel; S0/S1/S2 panels stay as collapsed secondary panels.
//
// Proxy (dev server only): /ingest and /api go to the local collector at
// http://127.0.0.1:8601. The IPv4 literal is deliberate — `localhost` may
// resolve to [::1] where the collector does not listen, and the collector has
// no CORS, so requests must stay same-origin through this proxy.
// Replay is GET-only through this proxy; the workbench never POSTs except the
// explicitly clicked S1 fake-batch button.
//
// Known limitation: `vite preview` (and any static hosting of dist/) does NOT
// run this proxy, so the S1/S2/S3 panels will report "collector unreachable"
// there. Run `npm run dev` on port 5173 for the demo.
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
