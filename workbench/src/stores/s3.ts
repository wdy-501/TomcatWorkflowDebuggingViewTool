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

const S3_SESSION_PATTERN = /^s_[A-Za-z0-9_-]+$/;

export interface S3SessionResolution {
  /** Initial session to query; falls back to {@link S3_DEFAULT_SESSION_ID}. */
  sessionId: string;
  /** URL asked for `?session=auto`: adopt the newest session from /api/v1/sessions. */
  auto: boolean;
  /** A valid explicit `?session=s_xxx` was present in the URL. */
  fromUrl: boolean;
}

export function isValidS3SessionId(value: string): boolean {
  return S3_SESSION_PATTERN.test(value.trim());
}

/**
 * Resolves the session from the URL. `TraceBoard run` opens
 * `http://127.0.0.1:5173/?session=s_run_...#board`; without a (valid) parameter the
 * demo default `s_s3demo` is kept. `?session=auto` selects the newest session once
 * the session list is available.
 */
export function resolveS3Session(search?: string): S3SessionResolution {
  const query = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const raw = new URLSearchParams(query).get("session");
  if (raw === null) {
    // Static showcase is tied to the exported s_s3demo snapshot. A local/packaged
    // workbench has a live collector, so no suffix should mean "newest session".
    const staticShowcase =
      typeof window !== "undefined" &&
      window.__TRACEBOARD_STATIC_DEMO__ !== undefined;
    return {
      sessionId: S3_DEFAULT_SESSION_ID,
      auto: !staticShowcase,
      fromUrl: false,
    };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { sessionId: S3_DEFAULT_SESSION_ID, auto: false, fromUrl: false };
  }
  if (value.toLowerCase() === "auto") {
    return { sessionId: S3_DEFAULT_SESSION_ID, auto: true, fromUrl: true };
  }
  if (!S3_SESSION_PATTERN.test(value)) {
    return { sessionId: S3_DEFAULT_SESSION_ID, auto: false, fromUrl: false };
  }
  return { sessionId: value, auto: false, fromUrl: true };
}

const initialSession = resolveS3Session();

/**
 * S3 board state: session, request list (with S3 fields), the selected trace's
 * mixed graph, and the read-only timeline window. No HTTP calls happen here —
 * S3Panel.vue drives src/api.ts. There is no push channel, no write path and no
 * replay engine: replay is a bounded read of already-stored events.
 */
export const useS3Store = defineStore("s3", {
  state: () => ({
    sessionId: initialSession.sessionId as string,
    sessions: [] as SessionSummary[],
    /** `?session=auto`: adopt the newest session after the first list load. */
    sessionAuto: initialSession.auto,
    /** The initial session came from the URL (run's session link). */
    sessionFromUrl: initialSession.fromUrl,
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
      this.sessionAuto = false;
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
    /**
     * `?session=auto`: switch to the newest known session (largest lastEventAtMs,
     * then startedAtMs). Returns the adopted id, or null when no session exists yet.
     */
    adoptNewestSession(): string | null {
      let newest: SessionSummary | null = null;
      for (const session of this.sessions) {
        if (session.sessionId.length === 0 || !isValidS3SessionId(session.sessionId)) {
          continue;
        }
        if (
          newest === null ||
          session.lastEventAtMs > newest.lastEventAtMs ||
          (session.lastEventAtMs === newest.lastEventAtMs &&
            session.startedAtMs > newest.startedAtMs)
        ) {
          newest = session;
        }
      }
      if (newest === null) {
        return null;
      }
      this.setSession(newest.sessionId);
      return newest.sessionId;
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
