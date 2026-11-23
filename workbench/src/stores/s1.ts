import { defineStore } from "pinia";
import type { EventsPage, IngestResponse, SessionSummary } from "../api";

export type S1Status = "idle" | "sending" | "ok" | "error";

export interface S1Error {
  message: string;
  hint: string | null;
}

export interface S1Success {
  ingest: IngestResponse;
  session: SessionSummary | null;
  page: EventsPage;
}

/**
 * S1 panel state only. No fetch/HTTP logic here — the panel calls src/api.ts
 * directly. This store intentionally has no graph/timeline/replay/selection
 * state (S2+ scope).
 */
export const useS1Store = defineStore("s1", {
  state: () => ({
    status: "idle" as S1Status,
    lastIngest: null as IngestResponse | null,
    session: null as SessionSummary | null,
    page: null as EventsPage | null,
    error: null as S1Error | null,
    completedAt: null as string | null,
  }),
  actions: {
    begin() {
      this.status = "sending";
      this.error = null;
    },
    succeed(result: S1Success) {
      this.status = "ok";
      this.error = null;
      this.lastIngest = result.ingest;
      this.session = result.session;
      this.page = result.page;
      this.completedAt = new Date().toLocaleTimeString();
    },
    fail(error: S1Error) {
      this.status = "error";
      this.error = error;
      this.lastIngest = null;
      this.session = null;
      this.page = null;
      this.completedAt = null;
    },
  },
});
