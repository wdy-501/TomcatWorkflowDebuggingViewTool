import { defineStore } from "pinia";

/**
 * S0 empty-shell store: static state only.
 * No actions, no API calls, no WebSocket, no graph/timeline state.
 */
export const useAppStore = defineStore("app", {
  state: () => ({
    appVersion: "0.1.0",
    mode: "S0 骨架",
    selectedRequestId: null as string | null,
    selectedNodeKey: null as string | null,
  }),
});