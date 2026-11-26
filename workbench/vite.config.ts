import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// TraceBoard workbench (Vue3 + TS). Generic local mode reads the collector
// through the same-origin dev proxy; the static Pages showcase is prebuilt.
//
// /ingest and /api -> local collector at 127.0.0.1:8601. The IPv4 literal is
// deliberate: `localhost` may resolve to [::1] where the collector does not
// listen, and the collector has no CORS. Replay stays GET-only. `vite preview`
// and static hosting do not run this proxy; use `npm run dev` for live data.
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