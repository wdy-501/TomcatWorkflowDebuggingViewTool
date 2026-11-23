import { defineStore } from "pinia";
import type { GraphResponse, RequestSummary, SessionSummary } from "../api";

export type S2LoadStatus = "idle" | "loading" | "ready" | "error";

export interface S2Error {
  message: string;
  hint: string | null;
}

/** Default agent session for the S2 zero-row chain (dispatch §4.6). */
export const S2_DEFAULT_SESSION_ID = "s_s2agent";

/**
 * S2 panel state only: session id, request list, selected trace and its graph.
 * No HTTP logic here — S2Panel.vue calls src/api.ts directly. No push-channel,
 * timeline, replay or browser-SDK state exists in this store (S2 boundary).
 */
export const useS2Store = defineStore("s2", {
  state: () => ({
    sessionId: S2_DEFAULT_SESSION_ID as string,
    sessions: [] as SessionSummary[],
    requests: [] as RequestSummary[],
    requestsStatus: "idle" as S2LoadStatus,
    requestsError: null as S2Error | null,
    selectedTraceId: null as string | null,
    graph: null as GraphResponse | null,
    graphStatus: "idle" as S2LoadStatus,
    graphError: null as S2Error | null,
    refreshing: false,
    lastRefreshedAt: null as string | null,
  }),
  actions: {
    setSession(sessionId: string) {
      this.sessionId = sessionId;
      this.requests = [];
      this.requestsStatus = "loading";
      this.requestsError = null;
      this.selectedTraceId = null;
      this.graph = null;
      this.graphStatus = "idle";
      this.graphError = null;
    },
    setSessions(sessions: SessionSummary[]) {
      this.sessions = sessions;
    },
    beginRefresh() {
      this.refreshing = true;
    },
    finishRefresh() {
      this.refreshing = false;
      this.lastRefreshedAt = new Date().toLocaleTimeString();
    },
    setRequests(requests: RequestSummary[]) {
      this.requests = requests;
      this.requestsStatus = "ready";
      this.requestsError = null;
    },
    failRequests(error: S2Error) {
      this.requestsStatus = "error";
      this.requestsError = error;
    },
    selectTrace(traceId: string | null) {
      if (this.selectedTraceId === traceId) {
        return;
      }
      this.selectedTraceId = traceId;
      this.graph = null;
      this.graphStatus = traceId === null ? "idle" : "loading";
      this.graphError = null;
    },
    beginGraph() {
      // Keep the last graph on screen while polling; show "loading" only when
      // there is nothing to display yet.
      if (this.graph === null) {
        this.graphStatus = "loading";
      }
    },
    setGraph(graph: GraphResponse) {
      this.graph = graph;
      this.graphStatus = "ready";
      this.graphError = null;
    },
    clearGraph() {
      this.graph = null;
      this.graphStatus = "idle";
      this.graphError = null;
    },
    failGraph(error: S2Error) {
      this.graph = null;
      this.graphStatus = "error";
      this.graphError = error;
    },
  },
});
