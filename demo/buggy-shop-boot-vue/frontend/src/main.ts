import { createApp } from "vue";
import App from "./App.vue";
import "./traceboard";
import "./style.css";

// S3 demo: the runtime SDK is initialized before mount (see src/traceboard.ts).
// SDK events go to the collector through the Vite `/ingest` proxy; no build plugin, no sourcemap.
createApp(App).mount("#app");
