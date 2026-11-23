import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

// S1: shell + S1 walking skeleton panel. No WebSocket/SSE, no graph/replay.
createApp(App).use(createPinia()).mount("#app");