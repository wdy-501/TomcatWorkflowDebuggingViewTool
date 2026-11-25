/**
 * Same-origin bridge between the BuggyShop demo iframe and the workbench.
 *
 * The demo posts one message after every completed action (contract frozen in
 * docs/plans/stages/demo-5173/00-contract.md):
 *
 *   {
 *     source: "traceboard-demo",
 *     type: "traceboard:demo-action",
 *     caseKey: "#btn-cancel",
 *     action: "cancel-order",
 *     ok: true,
 *     httpStatus: 200,
 *     static: false,
 *     atMs: 1730000000000
 *   }
 *
 * Only messages coming from the bound iframe window on this page's own origin
 * are accepted. A module-level reactive store is enough here (no Pinia): both
 * DemoPanel and S3Panel import the same singleton.
 */
import { reactive } from "vue";

export const DEMO_MESSAGE_SOURCE = "traceboard-demo";
export const DEMO_MESSAGE_TYPE = "traceboard:demo-action";

export interface DemoActionMessage {
  source: typeof DEMO_MESSAGE_SOURCE;
  type: typeof DEMO_MESSAGE_TYPE;
  caseKey: string;
  action?: string;
  ok?: boolean;
  httpStatus?: number | null;
  static?: boolean;
  atMs?: number;
}

/** Normalised, validated action used inside the workbench. */
export interface DemoAction {
  caseKey: string;
  action: string;
  ok: boolean;
  httpStatus: number | null;
  static: boolean;
  atMs: number;
}

export type DemoResultStatus = "resolved" | "timeout" | "error";

export interface DemoResult {
  caseKey: string;
  traceId?: string;
  status: DemoResultStatus;
  static: boolean;
  /** Human-readable reason for "timeout"/"error"; never a fabricated trace. */
  message?: string;
}

export interface DemoBridgeState {
  /** Case currently waiting for its trace, or null when idle/result is shown. */
  pendingCaseKey: string | null;
  lastResult: DemoResult | null;
  lastAction: DemoAction | null;
  /** True while an iframe window is bound (the listener is attached). */
  bound: boolean;
}

export const demoBridge = reactive<DemoBridgeState>({
  pendingCaseKey: null,
  lastResult: null,
  lastAction: null,
  bound: false,
});

let boundWindow: Window | null = null;
let listening = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Structural check for the frozen postMessage payload. */
export function isDemoActionMessage(value: unknown): value is DemoActionMessage {
  if (!isRecord(value)) {
    return false;
  }
  if (value.source !== DEMO_MESSAGE_SOURCE || value.type !== DEMO_MESSAGE_TYPE) {
    return false;
  }
  return typeof value.caseKey === "string" && value.caseKey.length > 0;
}

function handleMessage(event: MessageEvent): void {
  if (boundWindow === null || event.source !== boundWindow) {
    return;
  }
  // The demo is served from the same origin (5173 /app/); anything else is a
  // foreign frame or window and must not steer the trace selection.
  if (event.origin !== window.location.origin) {
    return;
  }
  const payload = event.data;
  if (!isDemoActionMessage(payload)) {
    return;
  }
  const action: DemoAction = {
    caseKey: payload.caseKey,
    action: typeof payload.action === "string" ? payload.action : "",
    ok: payload.ok === true,
    httpStatus: typeof payload.httpStatus === "number" ? payload.httpStatus : null,
    static: payload.static === true,
    atMs:
      typeof payload.atMs === "number" && Number.isFinite(payload.atMs)
        ? payload.atMs
        : Date.now(),
  };
  // Replacing the object (instead of mutating fields) makes a shallow watcher
  // fire even when the same button is clicked twice in a row.
  demoBridge.lastAction = action;
  demoBridge.pendingCaseKey = action.caseKey;
  demoBridge.lastResult = null;
}

/** Bind the demo iframe window; repeated calls just retarget the same listener. */
export function bindDemoFrame(frameWindow: Window | null): void {
  if (frameWindow === null) {
    return;
  }
  boundWindow = frameWindow;
  demoBridge.bound = true;
  if (!listening) {
    window.addEventListener("message", handleMessage);
    listening = true;
  }
}

/** Detach the listener and forget the iframe window (on unmount). */
export function unbindDemoFrame(): void {
  if (listening) {
    window.removeEventListener("message", handleMessage);
    listening = false;
  }
  boundWindow = null;
  demoBridge.bound = false;
}

/** Start (or restart) resolution for a case; clears the previous result. */
export function beginDemoCase(caseKey: string): void {
  demoBridge.pendingCaseKey = caseKey;
  demoBridge.lastResult = null;
}

/**
 * Publish the resolution of a demo case. Callers must only pass a real trace
 * id ("resolved") or an explicit timeout/error — never a guessed trace.
 */
export function setDemoResult(result: DemoResult): void {
  demoBridge.lastResult = result;
  demoBridge.pendingCaseKey = null;
}