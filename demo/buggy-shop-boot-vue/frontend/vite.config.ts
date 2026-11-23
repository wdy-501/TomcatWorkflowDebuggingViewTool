import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// S3 demo frontend: fixed port 5174.
// - `@traceboard/sdk` resolves to the repo SDK source (dev + build); its dist is also installed
//   as a file: dependency, but the alias keeps a single source of truth with no build plugin.
// - `/api`    -> demo backend 8080 (JDK8 + javaagent), same-origin semantics preserved.
// - `/ingest` -> TraceBoard collector 8601 (runtime SDK NDJSON), no CORS on either side.
// IPv4 literals avoid the localhost/[::1] resolution pitfall on Windows.
// Dev + preview proxies are included; preview serves `dist` and still needs the collector running
// for `/ingest` (a documented S3 limitation: no collector = fail-open drops, page keeps working).
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sdkEntry = fileURLToPath(new URL("../../../frontend/sdk/src/index.ts", import.meta.url));
const backendTarget = "http://127.0.0.1:8080";
const collectorTarget = "http://127.0.0.1:8601";

export default defineConfig({
  plugins: [vue()],
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
