import { defineStore } from "pinia";

/**
 * Shell store: static state only.
 * No actions, no API calls, no WebSocket. The S3 board keeps its own
 * graph/timeline state in stores/s3.ts.
 */
export const useAppStore = defineStore("app", {
  state: () => ({
    appVersion: "0.1.0",
    mode: "S3 前端事实与只读回放",
    selectedRequestId: null as string | null,
    selectedNodeKey: null as string | null,
  }),
});