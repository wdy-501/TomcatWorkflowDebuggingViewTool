/**
 * Iframe -> parent bridge for the interactive demo.
 *
 * The 5173 workbench embeds the demo in a same-origin iframe and uses this message to
 * locate the trace of the button that was just clicked (`caseKey` is the stable button
 * selector). The payload is frozen by the stage plan and must keep exactly these keys.
 *
 * Posting rules:
 * - only when embedded (top-level windows post nothing);
 * - after every demo action completes, including Case B (no request, `httpStatus: 0`)
 *   and error/404 paths (`ok: false`), so the parent is never left waiting.
 */

import { isStaticSim } from "./static-sim";

export interface DemoActionMessage {
  source: "traceboard-demo";
  type: "traceboard:demo-action";
  caseKey: string;
  action: string;
  ok: boolean;
  httpStatus: number;
  static: boolean;
  atMs: number;
}

export interface DemoActionReport {
  /** Button selector, e.g. `#btn-cancel`. */
  caseKey: string;
  /** Stable action id, e.g. `cancel-order`. */
  action: string;
  /** True when the action completed with an HTTP 2xx (Case B: validation ran, no request). */
  ok: boolean;
  /** HTTP status of the action's request; 0 when no request was sent (Case B) or it failed. */
  httpStatus: number;
}

export function postDemoAction(report: DemoActionReport): void {
  try {
    if (typeof window === "undefined" || window.parent === window) {
      return;
    }
    const message: DemoActionMessage = {
      source: "traceboard-demo",
      type: "traceboard:demo-action",
      caseKey: report.caseKey,
      action: report.action,
      ok: report.ok,
      httpStatus: report.httpStatus,
      static: isStaticSim(),
      atMs: Date.now()
    };
    // Same-origin embed only; the workbench also validates source/origin.
    window.parent.postMessage(message, window.location.origin);
  } catch {
    // fail-open: the demo must keep working outside the workbench
  }
}
