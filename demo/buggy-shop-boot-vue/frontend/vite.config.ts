import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import traceboardShallow from "../../../frontend/build-plugin/index.mjs";

// S3/S5 demo frontend; the 5174 dev/preview server is now an optional maintenance entry only
// (the product entry is the 5173 workbench, which serves the built demo under `/demo/`).
// - `base: "./"` emits relative asset URLs, so the same build works under `/demo/` (local 5173),
//   `/app/demo/` (GitHub Pages) and an independent document root. API/ingest paths are resolved
//   against `document.baseURI` at runtime (see src/api-base.ts); no 5174 runtime requirement.
// - `@traceboard/sdk` resolves to the repo SDK source (dev + build); its dist is also installed
//   as a file: dependency, but the alias keeps a single source of truth.
// - S5 build plugin emits function/file/line manifest (no .map decoding); local variables remain S6.
// - `build.sourcemap=true` only gives browser devtools a demo `.map` (dist is gitignored; the SDK
//   never reads or uploads it and the workbench only uses the manifest).
// - `/api`    -> demo backend 8080 (JDK8 + javaagent), same-origin semantics preserved.
// - `/ingest` -> TraceBoard collector 8601 (runtime SDK NDJSON), no CORS on either side.
// IPv4 literals avoid the localhost/[::1] resolution pitfall on Windows.
// Dev + preview proxies are included; preview serves `dist` and still needs the collector running
// for `/ingest` (a documented S3 limitation: no collector = fail-open drops, page keeps working).
// Preview (8602) never gets the manifest: it is not served by this plugin and injects no inline script.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sdkEntry = fileURLToPath(new URL("../../../frontend/sdk/src/index.ts", import.meta.url));
const backendTarget = "http://127.0.0.1:8080";
const collectorTarget = "http://127.0.0.1:8601";

export default defineConfig({
  // Relative base: one build for `/demo/`, `/app/demo/` and the document root.
  base: "./",
  plugins: [vue(), traceboardShallow()],
  build: {
    sourcemap: true
  },
  resolve: {
    alias: {
      "@traceboard/sdk": sdkEntry
    }
  },
  server: {
    port: 5174,
    strictPort: true,
    // The SDK source lives outside the demo frontend root; allow Vite to serve it in dev.
    fs: {
      allow: [repoRoot]
    },
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: false
      },
      "/ingest": {
        target: collectorTarget,
        changeOrigin: false
      }
    }
  },
  preview: {
    port: 4174,
    strictPort: true,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: false
      },
      "/ingest": {
        target: collectorTarget,
        changeOrigin: false
      }
    }
  }
});
