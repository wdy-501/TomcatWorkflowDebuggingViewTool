import { initTraceBoard } from "@traceboard/sdk";

/**
 * S7 React runtime SDK (basic level, runtime-only instrumentation).
 *
 * - Runs exactly once at module scope and MUST be evaluated before OrderEdit.jsx:
 *   index.jsx imports this module first, OrderEdit.jsx only imports from here (never the SDK
 *   package directly), so the module-level wrapped validateForm is live.
 * - sessionId must match the backend agent (`-Dtraceboard.sessionId=s_s7react`).
 * - appName is only the `js_method` nodeKey prefix (`OrderEdit.jsx#validateForm`); it does not
 *   identify real source files or lines.
 * - ingestUrl is the same-origin base path; the SDK posts NDJSON to `/ingest/v1/events`, which
 *   webpack-dev-server proxies to the collector on 8601 (no direct 8601 access from the page).
 * - init is idempotent and fail-open: a broken collector never breaks the page.
 */
export const traceboard = initTraceBoard({
  ingestUrl: "/ingest",
  sessionId: "s_s7react",
  appName: "OrderEdit.jsx",
  observeMs: 1500
});

/** Delegates to the initialized handle so components never import the SDK package directly. */
export function wrapFn(name, fn) {
  return traceboard.wrapFn(name, fn);
}

/** Declares a user-visible DOM effect (does not touch the DOM itself). */
export function uiEffect(text, targetSelector) {
  return traceboard.uiEffect(text, targetSelector);
}