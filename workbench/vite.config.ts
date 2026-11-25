import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// S3 workbench: Vue3 + TS shell. The primary board is the S3 frontend-facts /
// read-only replay panel; S0/S1/S2 panels stay as collapsed secondary panels.
//
// Proxy (dev server only). Order matters: the demo-scoped prefixes are declared
// before the generic collector rules.
// - /demo/* is the BuggyShop demo iframe served from public/demo (same origin).
//   /demo/api/*  -> demo backend 8080, rewritten to /api/*; changeOrigin stays
//   false so the demo keeps relative API calls and its traceparent headers.
//   /demo/ingest -> collector 8601, rewritten to /ingest; runtime SDK events.
// - /ingest and /api -> the local collector at http://127.0.0.1:8601 for the
//   workbench's own read-only queries. The IPv4 literal is deliberate —
//   `localhost` may resolve to [::1] where the collector does not listen, and
//   the collector has no CORS, so requests must stay same-origin through this
//   proxy. Replay is GET-only through this proxy; the workbench never POSTs
//   except the explicitly clicked S1 fake-batch button.
//
// Known limitation: `vite preview` (and any static hosting of dist/) does NOT
// run this proxy, so the S1/S2/S3 panels will report "collector unreachable"
// there, and the demo falls back to the browser-side static responses only when
// the page provides window.__TRACEBOARD_STATIC_DEMO__. Run `npm run dev` on port
// 5173 against 8080 + 8601 for the live demo.
export default defineConfig({
  plugins: [vue()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/demo/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/demo\/api/, "/api"),
      },
      "/demo/ingest": {
        target: "http://127.0.0.1:8601",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/demo\/ingest/, "/ingest"),
      },
      "/ingest": { target: "http://127.0.0.1:8601", changeOrigin: false },
      "/api": { target: "http://127.0.0.1:8601", changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});