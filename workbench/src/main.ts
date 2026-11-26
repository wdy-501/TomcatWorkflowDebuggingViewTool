import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { installStaticDemo } from "./demo/static-demo";
import "./style.css";

installStaticDemo();

// Read-only facts/replay board. No WebSocket/SSE, no write path, no graph library.
createApp(App).use(createPinia()).mount("#app");