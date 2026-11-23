/**
 * S1 API client: ingest a fake click/fetch batch and read the stored events back.
 *
 * Rules enforced here:
 * - Relative paths only: /ingest and /api are proxied by the Vite dev server to
 *   http://127.0.0.1:8601 (see vite.config.ts). No direct collector URL, no CORS.
 * - Query read is a bounded, explicit read (api.v1.md §7.2), not replay and not
 *   a subscription. No SSE/WebSocket/polling lives in this file.
 * - Types mirror the frozen contracts: event v1 body, query wrapper
 *   {"seq":N,"event":{...}}, sessions list, ingest result, error envelope.
 */

export type Confidence = "EXACT" | "INFERRED" | "LOST" | "MANUAL";

export interface EventThread {
  id: number;
  name: string;
}

export interface EventSourceLocation {
  file: string | null;
  line: number | null;
}

export interface EventReturn {
  type: string;
  value?: unknown;
}

/** Event v1 body as returned by the collector (query wrapper excluded). */
export interface EventBody {
  schema: string;
  type: string;
  sessionId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  rootEventId: string;
  kind: string;
  nodeKey: string;
  startNs: number;
  durNs: number;
  status: string;
  confidence: string;
  flags: string[];
  thread?: EventThread;
  source?: EventSourceLocation | null;
  return?: EventReturn | null;
}

/** Event synthesized by the S1 panel (fake frontend batch, schema v1 shaped). */
export interface SkeletonEvent extends EventBody {
  schema: "traceboard.event.v1";
  type: "span";
  kind: "ui_event" | "fetch";
  status: "OK";
  confidence: "EXACT";
  thread: EventThread;
  return: EventReturn | null;
}

/** Query wrapper: `seq` is transport/storage metadata, outside the event body. */
export interface StoredEvent {
  seq: number;
  event: EventBody;
}

export interface EventsPage {
  events: StoredEvent[];
  nextSeq: number;
}

export interface SessionSummary {
  sessionId: string;
  eventCount: number;
  startedAtMs: number;
  lastEventAtMs: number;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface IngestError {
  line: number;
  code: string;
  message: string;
}

export interface IngestResponse {
  accepted: number;
  rejected: number;
  dropped: number;
  errors: IngestError[];
}

export interface ApiErrorEnvelope {
  error: string;
  message: string;
  apiVersion: string;
}

const INGEST_PATH = "/ingest/v1/events";
const SESSIONS_PATH = "/api/v1/sessions";

/** Fetch itself failed: the collector (or the dev proxy) is not reachable. */
export class CollectorUnreachableError extends Error {
  constructor() {
    super("collector 不可达");
    this.name = "CollectorUnreachableError";
  }
}

/** The collector answered, but with a non-2xx status + error envelope. */
export class CollectorHttpError extends Error {
  readonly status: number;
  readonly envelope: ApiErrorEnvelope | null;

  constructor(status: number, envelope: ApiErrorEnvelope | null, fallback: string) {
    super(envelope ? `${envelope.error}: ${envelope.message}` : fallback);
    this.name = "CollectorHttpError";
    this.status = status;
    this.envelope = envelope;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function parseErrorEnvelope(payload: unknown): ApiErrorEnvelope | null {
  if (!isRecord(payload) || typeof payload.error !== "string") {
    return null;
  }
  return {
    error: payload.error,
    message: asString(payload.message, ""),
    apiVersion: asString(payload.apiVersion, ""),
  };
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new CollectorUnreachableError();
  }
  const payload = await readJson(response);
  if (!response.ok) {
    const envelope = parseErrorEnvelope(payload);
    // The Vite dev proxy answers 500/502/503/504 with plain text when the
    // collector is down (ECONNREFUSED), so "no error envelope + gateway-ish
    // status" means unreachable rather than a collector HTTP error. Every
    // contract error from the collector uses the JSON envelope.
    if (envelope === null && response.status >= 500 && response.status <= 504) {
      throw new CollectorUnreachableError();
    }
    throw new CollectorHttpError(
      response.status,
      envelope,
      `HTTP ${response.status}`
    );
  }
  return payload;
}

function toEventBody(value: unknown): EventBody {
  const record = isRecord(value) ? value : {};
  const rawThread = isRecord(record.thread) ? record.thread : null;
  const rawSource = isRecord(record.source) ? record.source : null;
  const rawReturn = isRecord(record.return) ? record.return : null;

  return {
    schema: asString(record.schema, ""),
    type: asString(record.type, ""),
    sessionId: asString(record.sessionId, ""),
    traceId: asString(record.traceId, ""),
    spanId: asString(record.spanId, ""),
    parentSpanId: typeof record.parentSpanId === "string" ? record.parentSpanId : null,
    rootEventId: asString(record.rootEventId, ""),
    kind: asString(record.kind, ""),
    nodeKey: asString(record.nodeKey, ""),
    startNs: asNumber(record.startNs, 0),
    durNs: asNumber(record.durNs, 0),
    status: asString(record.status, ""),
    confidence: asString(record.confidence, ""),
    flags: asStringArray(record.flags),
    thread: rawThread
      ? { id: asNumber(rawThread.id, 0), name: asString(rawThread.name, "") }
      : undefined,
    source: rawSource
      ? {
          file: typeof rawSource.file === "string" ? rawSource.file : null,
          line: typeof rawSource.line === "number" ? rawSource.line : null,
        }
      : null,
    return: rawReturn
      ? { type: asString(rawReturn.type, ""), value: rawReturn.value }
      : null,
  };
}

function parseIngestResponse(payload: unknown): IngestResponse {
  const record = isRecord(payload) ? payload : {};
  const rawErrors = Array.isArray(record.errors) ? record.errors : [];
  const errors: IngestError[] = rawErrors.filter(isRecord).map((item) => ({
    line: asNumber(item.line, 0),
    code: asString(item.code, "unknown"),
    message: asString(item.message, ""),
  }));
  return {
    accepted: asNumber(record.accepted, 0),
    rejected: asNumber(record.rejected, 0),
    dropped: asNumber(record.dropped, 0),
    errors,
  };
}

/**
 * POST the batch as application/x-ndjson with a trailing newline.
 * The collector rejects bodies whose last line has no "\n", so the newline is
 * part of the payload contract, not cosmetics.
 */
export async function postFakeBatch(events: readonly SkeletonEvent[]): Promise<IngestResponse> {
  const body = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  const payload = await requestJson(INGEST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body,
  });
  return parseIngestResponse(payload);
}

/** GET /api/v1/sessions — session list with per-session event counts. */
export async function fetchSessions(): Promise<SessionSummary[]> {
  const payload = await requestJson(SESSIONS_PATH);
  const record = isRecord(payload) ? payload : {};
  const raw = Array.isArray(record.sessions) ? record.sessions : [];
  return raw.filter(isRecord).map((item) => ({
    sessionId: asString(item.sessionId, ""),
    eventCount: asNumber(item.eventCount, 0),
    startedAtMs: asNumber(item.startedAtMs, 0),
    lastEventAtMs: asNumber(item.lastEventAtMs, 0),
  }));
}

/**
 * GET /api/v1/sessions/{sessionId}/events?afterSeq=&limit=
 * This is a read-only page query (api.v1.md §7.2) — not replay, not a stream.
 */
export async function fetchEventsPage(
  sessionId: string,
  afterSeq: number,
  limit: number
): Promise<EventsPage> {
  const params = new URLSearchParams({
    afterSeq: String(afterSeq),
    limit: String(limit),
  });
  const path = `${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/events?${params.toString()}`;
  const payload = await requestJson(path);
  const record = isRecord(payload) ? payload : {};
  const raw = Array.isArray(record.events) ? record.events : [];
  const events: StoredEvent[] = raw.filter(isRecord).map((item) => ({
    seq: asNumber(item.seq, 0),
    event: toEventBody(item.event),
  }));
  return {
    events,
    nextSeq: asNumber(record.nextSeq, afterSeq),
  };
}
