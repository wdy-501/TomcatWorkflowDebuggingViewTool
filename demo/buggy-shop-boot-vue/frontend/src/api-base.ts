/**
 * Relative API helpers for the BuggyShop interactive demo.
 *
 * The same demo build must run from three different document roots:
 * - local single entry:  http://127.0.0.1:5173/demo/
 * - GitHub Pages:        https://<user>.github.io/<repo>/app/demo/
 * - standalone/root:     http://127.0.0.1:5174/
 *
 * Absolute `/api/...` URLs would always hit the server root, so every request is resolved
 * against `document.baseURI` at call time instead. `demoFetch` also looks up `window.fetch`
 * on each call (never captures it at module load) so the static simulation patch installed
 * by static-sim.ts applies even though this module is evaluated first.
 */

const API_PREFIX = "/api/";

/**
 * Fetch a demo backend path relative to the current demo document.
 *
 * `/api/orders?probe=1` under `.../demo/` becomes `.../demo/api/orders?probe=1`.
 * Method/headers/body are forwarded unchanged, so local requests stay identical to the
 * original demo and the static simulation can intercept them verbatim.
 */
export function demoFetch(path: string, init?: RequestInit): Promise<Response> {
  const relative = path.startsWith(API_PREFIX) ? path.slice(1) : path;
  const url = new URL(relative, document.baseURI);
  // Resolved at call time so the static fetch patch (and the S3 SDK patch) applies.
  return window.fetch(url.href, init);
}

/** Collector ingest URL for the demo document (`.../demo/ingest`, `.../ingest`, ...). */
export function demoIngestUrl(): string {
  return new URL("ingest", document.baseURI).href;
}
