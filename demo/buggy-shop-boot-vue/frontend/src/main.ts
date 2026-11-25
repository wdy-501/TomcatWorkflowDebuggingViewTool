import { createApp } from "vue";
import App from "./App.vue";
import { installStaticSim } from "./static-sim";
import "./traceboard";
import "./style.css";

// S3 demo: the runtime SDK is initialized before mount (see src/traceboard.ts).
// S5 build plugin emits function/file/line manifest (no .map decoding); local variables remain S6.
// SDK events go to the collector through the demo document's `ingest` route.
// Public static demo (`?static=1`): fetch is patched with canned responses before the app
// issues any request, and the real SDK is skipped (see src/static-sim.ts and src/traceboard.ts).
installStaticSim();
createApp(App).mount("#app");
