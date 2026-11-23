import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// S0 workbench: standalone shell only. No proxy, no collector calls.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});