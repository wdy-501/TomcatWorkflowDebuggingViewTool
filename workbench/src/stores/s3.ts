import { defineStore } from "pinia";
import type {
  GraphResponse,
  ReplayResponse,
  RequestSummary,
  SessionSummary,
} from "../api";

export type S3LoadStatus = "idle" | "loading" | "ready" | "error";
export type S3Mode = "live" | "replay";
export type S3Tab = "all" | "requests" | "clicks";

export interface S3Error {
  message: string;
  hint: string | null;
}

/** Default runtime-SDK session for the S3 board (dispatch §3). */
export const S3_DEFAULT_SESSION_ID = "s_s3demo";

/**
 * S3 board state: session, request list (with S3 fields), the selected trace's
 * mixed graph, and the read-only timeline window. No HTTP calls happen here —
 * S3Panel.vue drives src/api.ts. There is no push channel, no write path and no
 * replay engine: replay is a bounded read of already-stored events.
 */
export const useS3Store = defineStore("s3", {
  state: () => ({
    sessionId: S3_DEFAULT_SESSION_ID as string,
    sessions: [] as SessionSummary[],
    requests: [] as RequestSummary[],
    sdkActive: false,
    requestsStatus: "idle" as S3LoadStatus,
    requestsError: null as S3Error | null,
    tab: "all" as S3Tab,
    selectedTraceId: null as string | null,
    graph: null as GraphResponse | null,
    graphStatus: "idle" as S3LoadStatus,
    graphError: null as S3Error | null,
    refreshing: false,
    lastRefreshedAt: null as string | null,

    // Timeline / read-only replay (display only).
    mode: "live" as S3Mode,
    sliderNs: 0,
    playing: false,
    speed: 0.01,
    replay: null as ReplayResponse | null,
    replayStatus: "idle" as S3LoadStatus,
    replayError: null as S3Error | null,
  }),
  actions: {
    setSession(sessionId: string) {
      this.sessionId = sessionId;
      this.requests = [];
      this.sdkActive = false;
      this.requestsStatus = "loading";
      this.requestsError = null;
      this.tab = "all";
      this.selectedTraceId = null;
      this.graph = null;
      this.graphStatus = "idle";
      this.graphError = null;
      this.mode = "live";
      this.sliderNs = 0;
      this.playing = false;
      this.clearReplay();
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
    setRequests(sessionId: string, sdkActive: boolean, requests: RequestSummary[]) {
      this.sessionId = sessionId;
      this.sdkActive = sdkActive;
      this.requests = requests;
      this.requestsStatus = "ready";
      this.requestsError = null;
    },
    failRequests(error: S3Error) {
      this.requestsStatus = "error";
      this.requestsError = error;
    },
    setTab(tab: S3Tab) {
      this.tab = tab;
    },
    selectTrace(traceId: string | null) {
      if (this.selectedTraceId === traceId) {
        return;
      }
      this.selectedTraceId = traceId;
      this.graph = null;
      this.graphStatus = traceId === null ? "idle" : "loading";
      this.graphError = null;
      this.sliderNs = 0;
      this.playing = false;
      this.clearReplay();
    },
    beginGraph() {
      // Keep the previous graph on screen while polling; only show "loading"
      // when there is nothing to display yet.
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
      this.playing = false;
      this.clearReplay();
    },
    failGraph(error: S3Error) {
      this.graph = null;
      this.graphStatus = "error";
      this.graphError = error;
      this.playing = false;
      this.clearReplay();
    },

    // --- timeline / replay (read-only) ---
    setMode(mode: S3Mode) {
      this.mode = mode;
      if (mode === "live") {
        this.playing = false;
        this.clearReplay();
      }
    },
    setSlider(ns: number) {
      this.sliderNs = Number.isFinite(ns) ? Math.max(0, ns) : 0;
    },
    setPlaying(playing: boolean) {
      this.playing = playing;
    },
    setSpeed(speed: number) {
      this.speed = Number.isFinite(speed) && speed > 0 ? speed : 1;
    },
    beginReplay() {
      if (this.replay === null) {
        this.replayStatus = "loading";
      }
    },
    setReplay(replay: ReplayResponse) {
      this.replay = replay;
      this.replayStatus = "ready";
      this.replayError = null;
    },
    failReplay(error: S3Error) {
      this.replayStatus = "error";
      this.replayError = error;
      // Keep the last successful window if any; the tree still filters locally.
    },
    clearReplay() {
      this.replay = null;
      this.replayStatus = "idle";
      this.replayError = null;
    },
  },
});
