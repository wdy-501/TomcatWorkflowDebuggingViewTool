import { defineStore } from "pinia";

/**
 * Shell store: static state only.
 * No actions, no API calls, no WebSocket, no graph/timeline state.
 */
export const useAppStore = defineStore("app", {
  state: () => ({
    appVersion: "0.1.0",
    mode: "S2 0 行事实链",
    selectedRequestId: null as string | null,
    selectedNodeKey: null as string | null,
  }),
});