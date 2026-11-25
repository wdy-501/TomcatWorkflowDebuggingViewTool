/**
 * Browser-side static simulation for the public GitHub Pages demo.
 *
 * The Pages deployment has no Java backend and no collector, so when the demo document is
 * opened with `?static=1` this module patches `window.fetch` exactly once and answers the
 * demo API/ingest paths with canned JSON (matching the local backend's shapes).
 *
 * Honest boundaries:
 * - only HTTP responses are simulated; no trace/event is fabricated here;
 * - unmatched `/api/...` paths return 404 with a console warning instead of hitting the network;
 * - nothing is installed without `?static=1`, so local dev keeps using the real proxies.
 */

/** `?static=1` (or a bare `?static`) switches the demo document into static simulation mode. */
export function isStaticSim(): boolean {
  try {
    const value = new URLSearchParams(window.location.search).get("static");
    // `?static=1` is the contract; a bare `?static` is accepted for convenience. `?static=0` stays live.
    return value === "1" || value === "";
  } catch {
    return false;
  }
}

const ORDERS_PAYLOAD =
  '{"data":[{"id":1,"orderNo":"ORD-2026-001","status":"CREATED","amount":100}]}';
const CANCEL_PAYLOAD = '{"data":true}';
const FALSE_PAYLOAD = '{"data":false}';
const DISCOUNT_PAYLOAD = '{"data":0}';
const NO_DEBUG_PAYLOAD = '{"data":200.0}';
const RECONCILE_PAYLOAD = '{"data":[100.0,0.0,100.0]}';
const RECONCILE_LOOP_PAYLOAD = '{"data":50.0}';
const INGEST_PAYLOAD = '{"accepted":0,"rejected":0,"dropped":0,"errors":[]}';

const REMARK_DEFAULTS = { reason: "改约配送时间", operator: "demo-user", priority: 2 };

let installed = false;

/** Install the fetch interception once; no-op outside static mode (called before `createApp`). */
export function installStaticSim(): void {
  if (installed || typeof window === "undefined" || !isStaticSim()) {
    return;
  }
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const simulated = simulate(input, init);
    if (simulated !== null) {
      return simulated;
    }
    return nativeFetch(input, init);
  };
}

function simulate(input: RequestInfo | URL, init?: RequestInit): Promise<Response> | null {
  const url = requestUrl(input);
  if (!url) {
    return null;
  }
  if (isIngestPath(url.pathname)) {
    return Promise.resolve(jsonResponse(202, INGEST_PAYLOAD));
  }
  const route = apiRouteOf(url.pathname);
  if (route === null) {
    return null;
  }
  return simulateApi(route, requestMethod(input, init), input, init);
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") {
      return new URL(input, window.location.href);
    }
    if (input instanceof URL) {
      return new URL(input.href);
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return new URL(input.url);
    }
  } catch {
    // fail-open: unparsable input falls through to the native fetch
  }
  return null;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init && typeof init.method === "string" && init.method !== "") {
    return init.method.toUpperCase();
  }
  if (typeof Request !== "undefined" && input instanceof Request && typeof input.method === "string") {
    return input.method.toUpperCase();
  }
  return "GET";
}

/** Base directory of the demo document, e.g. `/demo/`, `/app/demo/` or `/`. */
function demoBasePath(): string {
  try {
    return new URL(".", document.baseURI).pathname;
  } catch {
    return "/";
  }
}

/** Path after `.../api/` for this demo document; also tolerates a server-root `/api/` fallback. */
function apiRouteOf(pathname: string): string | null {
  const prefix = `${demoBasePath()}api/`;
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length);
  }
  const fallback = "/api/";
  const index = pathname.indexOf(fallback);
  return index >= 0 ? pathname.slice(index + fallback.length) : null;
}

function isIngestPath(pathname: string): boolean {
  const ingest = `${demoBasePath()}ingest`;
  return (
    pathname === ingest ||
    pathname.startsWith(`${ingest}/`) ||
    pathname === "/ingest" ||
    pathname.startsWith("/ingest/")
  );
}

function simulateApi(
  route: string,
  method: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const segments = route.split("/").filter((segment) => segment !== "");
  if (segments[0] !== "orders") {
    return Promise.resolve(unmatchedApi(route));
  }
  if (segments.length === 1) {
    // GET /api/orders and GET /api/orders?probe=1 both return the order list.
    return Promise.resolve(
      method === "GET" ? jsonResponse(200, ORDERS_PAYLOAD) : unmatchedApi(route)
    );
  }
  if (segments.length !== 3 || method !== "POST") {
    return Promise.resolve(unmatchedApi(route));
  }
  const orderId = segments[1];
  const action = segments[2];
  if (orderId === "999" && action === "cancel") {
    // Case D "unknown order": the backend answers 404, so the bridge reports a failed action.
    return Promise.resolve(jsonResponse(404, FALSE_PAYLOAD, "Not Found"));
  }
  if (orderId !== "1") {
    return Promise.resolve(unmatchedApi(route));
  }
  switch (action) {
    case "cancel":
      return Promise.resolve(jsonResponse(200, CANCEL_PAYLOAD));
    case "preview-discount":
      return Promise.resolve(jsonResponse(200, DISCOUNT_PAYLOAD));
    case "remark":
      return simulateRemark(input, init);
    case "no-debug":
      return Promise.resolve(jsonResponse(200, NO_DEBUG_PAYLOAD));
    case "reconcile":
    case "reconcile-async":
      return Promise.resolve(jsonResponse(200, RECONCILE_PAYLOAD));
    case "reconcile-loop":
      return Promise.resolve(jsonResponse(200, RECONCILE_LOOP_PAYLOAD));
    default:
      return Promise.resolve(unmatchedApi(route));
  }
}

async function simulateRemark(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let parsed: unknown = null;
  try {
    const text = await requestBodyText(input, init);
    if (typeof text === "string" && text !== "") {
      parsed = JSON.parse(text);
    }
  } catch {
    parsed = null;
  }
  const body =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  // Echo only the declared request fields; `note`/`token` are never reflected back.
  const payload = {
    data: {
      id: 1,
      reason: typeof body.reason === "string" ? body.reason : REMARK_DEFAULTS.reason,
      operator: typeof body.operator === "string" ? body.operator : REMARK_DEFAULTS.operator,
      priority:
        typeof body.priority === "number" ? body.priority : REMARK_DEFAULTS.priority,
      accepted: true
    }
  };
  return jsonResponse(200, JSON.stringify(payload));
}

async function requestBodyText(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<string | null> {
  try {
    if (init && typeof init.body === "string") {
      return init.body;
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return await input.clone().text();
    }
  } catch {
    // fail-open: unreadable bodies fall back to the canned defaults
  }
  return null;
}

function unmatchedApi(route: string): Response {
  try {
    console.warn(`[static-sim] no canned response for demo API route: ${route}`);
  } catch {
    // fail-open
  }
  return jsonResponse(404, FALSE_PAYLOAD, "Not Found");
}

function jsonResponse(status: number, body: string, statusText?: string): Response {
  const init: ResponseInit = {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  };
  if (statusText !== undefined) {
    init.statusText = statusText;
  }
  return new Response(body, init);
}
