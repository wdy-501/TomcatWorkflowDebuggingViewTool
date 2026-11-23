import { createApp } from "vue";
import App from "./App.vue";
import "./traceboard";
import "./style.css";

// S3 demo: the runtime SDK is initialized before mount (see src/traceboard.ts).
// S5 build plugin emits function/file/line manifest (no .map decoding); local variables remain S6.
// SDK events go to the collector through the Vite `/ingest` proxy.
createApp(App).mount("#app");
