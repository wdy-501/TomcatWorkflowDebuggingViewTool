/**
 * Static demo adapter: when a page injects window.__TRACEBOARD_STATIC_DEMO__,
 * satisfy the workbench's read-only /api calls from that data instead of a
 * local collector. The regular dev workbench never defines the global, so this
 * module is a no-op there.
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

interface StaticDemoData {
  sessions: unknown;
  requests: unknown;
  graphs: Record<string, unknown>;
  replays?: Record<string, unknown>;
  cases?: Record<string, StaticDemoCase>;
}

declare global {
  interface Window {
    __TRACEBOARD_STATIC_DEMO__?: StaticDemoData;
  }
}

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

export function installStaticDemo(): void {
  const data = window.__TRACEBOARD_STATIC_DEMO__;
  if (data === undefined) {
    return;
  }
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