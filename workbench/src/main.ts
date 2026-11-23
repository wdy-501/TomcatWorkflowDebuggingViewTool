import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

// S0: shell only. No API client, no WebSocket, no collector calls.
createApp(App).use(createPinia()).mount("#app");