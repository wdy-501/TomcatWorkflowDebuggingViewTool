import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// S0 demo frontend: fixed port 5174, /api proxied to the demo backend (8080).
// Same-origin semantics preserved (no rewrite, no CORS).
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 4174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: false,
      },
    },
  },
});