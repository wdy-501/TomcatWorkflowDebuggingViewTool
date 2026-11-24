import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { installStaticDemo } from "./demo/static-demo";
import "./style.css";

installStaticDemo();

// S3: shell + S3 facts/replay board; S0/S1/S2 panels stay as collapsed
// secondary panels. No WebSocket/SSE, no write path, no graph library.
createApp(App).use(createPinia()).mount("#app");