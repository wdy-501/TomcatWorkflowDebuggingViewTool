/**
 * Static demo adapter: when a page injects window.__TRACEBOARD_STATIC_DEMO__,
 * satisfy the workbench's read-only /api calls from that data instead of a
 * local collector. The regular dev workbench never defines the global, so this
 * module is a no-op there.
 *
 * Public Pages has no backend. A demo click therefore appends a clearly local
 * simulated request by cloning the recorded case template; it never claims to
 * be a live capture. Clearing removes only this in-memory simulation.
 */
/**
 * One pre-recorded demo case: the button selector (nodeKey) of the click and
 * the trace captured for it. Public data ships this map; local dev does not.
 */
export interface StaticDemoCase {
  traceId: string;
  label?: string;
  action?: string;
}

interface StaticRequestSummary {
  traceId: string;
  startedAtNs: number;
  [key: string]: unknown;
}

interface StaticGraphNode {
  startNs: number;
  [key: string]: unknown;
}

interface StaticGraph {
  sessionId: string;
  traceId: string;
  nodes: StaticGraphNode[];
  [key: string]: unknown;
}

interface StaticSession {
  sessionId: string;
  eventCount: number;
  startedAtMs: number;
  lastEventAtMs: number;
}

interface StaticDemoData {
  sessions: unknown;
  sessionId?: string;
  requests: unknown;
  graphs: Record<string, unknown>;
  replays?: Record<string, unknown>;
  cases?: Record<string, StaticDemoCase>;
}

interface StaticRequests {
  sessionId: string;
  sdkActive: boolean;
  requests: StaticRequestSummary[];
}

interface StaticSessions {
  sessions: StaticSession[];
}

type CaseTemplate = {
  request: StaticRequestSummary;
  graph: StaticGraph;
};

declare global {
  interface Window {
    __TRACEBOARD_STATIC_DEMO__?: StaticDemoData;
  }
}

let staticData: StaticDemoData | null = null;
let templates = new Map<string, CaseTemplate>();

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function sessionIdOf(path: string): string | null {
  const match = /^\/api\/v1\/sessions\/([^/]+)/.exec(path);
  return match === null ? null : decodeURIComponent(match[1]);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requestsOf(data: StaticDemoData | null): StaticRequests | null {
  if (data === null) {
    return null;
  }
  const value = data.requests as Partial<StaticRequests> | null;
  return value !== null && Array.isArray(value.requests)
    ? (value as StaticRequests)
    : null;
}

function sessionsOf(data: StaticDemoData | null): StaticSessions | null {
  if (data === null) {
    return null;
  }
  const value = data.sessions as Partial<StaticSessions> | null;
  return value !== null && Array.isArray(value.sessions)
    ? (value as StaticSessions)
    : null;
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out.slice(0, length);
}

function buildTemplates(data: StaticDemoData): void {
  templates = new Map<string, CaseTemplate>();
  const requests = requestsOf(data);
  if (requests === null) {
    return;
  }
  for (const [caseKey, entry] of Object.entries(data.cases ?? {})) {
    const request = requests.requests.find((item) => item.traceId === entry.traceId);
    const graph = data.graphs[entry.traceId] as StaticGraph | undefined;
    if (request !== undefined && graph !== undefined) {
      templates.set(caseKey, { request: clone(request), graph: clone(graph) });
    }
  }
}

export function isStaticDemoMode(): boolean {
  return window.__TRACEBOARD_STATIC_DEMO__ !== undefined;
}

/**
 * Trace id pre-recorded for a demo case, or null when the case is missing.
 * Missing means "not captured", never a placeholder id.
 */
export function staticDemoCaseTraceId(caseKey: string): string | null {
  const entry = window.__TRACEBOARD_STATIC_DEMO__?.cases?.[caseKey];
  return typeof entry?.traceId === "string" && entry.traceId.length > 0
    ? entry.traceId
    : null;
}

/**
 * Append a local simulated request for a static demo action. The graph is a
 * clone of the recorded case graph with a new trace id and shifted timestamps;
 * this is a static snapshot, not a live capture.
 */
export function appendStaticDemoAction(caseKey: string, atMs?: number): string | null {
  const data = staticData;
  const template = templates.get(caseKey);
  const requests = requestsOf(data);
  if (data === null || template === undefined || requests === null) {
    return null;
  }
  const traceId = randomHex(32);
  const request = clone(template.request);
  const graph = clone(template.graph);
  const startedAtNs =
    typeof atMs === "number" && Number.isFinite(atMs) && atMs > 0
      ? Math.round(atMs * 1_000_000)
      : Date.now() * 1_000_000;

  request.traceId = traceId;
  request.startedAtNs = startedAtNs;
  if (graph.nodes.length > 0) {
    const oldStart = Math.min(...graph.nodes.map((node) => node.startNs));
    const shift = startedAtNs - oldStart;
    for (const node of graph.nodes) {
      node.startNs += shift;
    }
  }
  graph.traceId = traceId;
  graph.sessionId = requests.sessionId;
  data.graphs[traceId] = graph;
  requests.requests.push(request);

  const sessions = sessionsOf(data);
  const session = sessions?.sessions[0];
  if (session !== undefined) {
    session.eventCount += graph.nodes.length;
    if (session.startedAtMs === 0) {
      session.startedAtMs = Date.now();
    }
    session.lastEventAtMs = Date.now();
  }
  return traceId;
}

/** Clear only the static simulation's mutable request/graph view. */
export function clearStaticDemoData(): boolean {
  const data = staticData;
  const requests = requestsOf(data);
  if (data === null || requests === null) {
    return false;
  }
  requests.requests.length = 0;
  for (const traceId of Object.keys(data.graphs)) {
    delete data.graphs[traceId];
  }
  const session = sessionsOf(data)?.sessions[0];
  if (session !== undefined) {
    session.eventCount = 0;
    session.startedAtMs = 0;
    session.lastEventAtMs = 0;
  }
  return true;
}

export function installStaticDemo(): void {
  const data = window.__TRACEBOARD_STATIC_DEMO__;
  if (data === undefined) {
    return;
  }
  staticData = data;
  buildTemplates(data);
  const nativeFetch = window.fetch.bind(window);
  const installMarker = "__traceboardStaticFetchInstalled";
  if ((window as unknown as Record<string, unknown>)[installMarker] === true) {
    return;
  }
  (window as unknown as Record<string, unknown>)[installMarker] = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.href
    );
    const path = url.pathname;
    if (!path.startsWith("/api/") && path !== "/ingest") {
      return nativeFetch(input, init);
    }
    if (path === "/ingest" || path.startsWith("/ingest/")) {
      return jsonResponse({ accepted: 0, rejected: 0, dropped: 0, errors: [] }, 202);
    }
    if (path === "/api/v1/sessions") {
      return jsonResponse(data.sessions);
    }
    const sessionId = sessionIdOf(path);
    if (sessionId === null) {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "DELETE" && path === `/api/v1/sessions/${sessionId}`) {
      return jsonResponse({ sessionId, cleared: clearStaticDemoData() });
    }
    if (path.endsWith("/requests")) {
      return jsonResponse(data.requests);
    }
    if (path.endsWith("/graph")) {
      const traceId = url.searchParams.get("traceId") ?? "";
      const graph = data.graphs[traceId];
      return graph === undefined
        ? jsonResponse({ error: "not_found", message: "unknown trace" }, 404)
        : jsonResponse(graph);
    }
    if (path.endsWith("/replay")) {
      const replay = Object.values(data.replays ?? {})[0];
      return replay === undefined
        ? jsonResponse({ mode: "replay", readOnly: true, sessionId, fromNs: 0, toNs: 0, events: [] })
        : jsonResponse(replay);
    }
    if (path.endsWith("/agent")) {
      return jsonResponse({ sessionId, connected: true, version: "static-demo", pid: 0, startedAtMs: 0, lastSeenMs: 0 });
    }
    return jsonResponse({ error: "not_found" }, 404);
  };
}