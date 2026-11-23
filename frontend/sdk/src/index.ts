/**
 * @traceboard/sdk — TraceBoard S3 runtime SDK (F0).
 *
 * What it does (only these facts):
 * - document capture-phase clicks -> `ui_event` root per click (new traceId/clickId/spanId);
 * - wraps `window.fetch` and `XMLHttpRequest` -> `fetch` spans (same click window only);
 * - `wrapFn(name, fn)` -> `js_method` spans (OK / RETURNED_FALSE / THREW);
 * - `uiEffect(text)` -> `render` spans (`return.type = "ui_effect"`; the SDK never reads/writes the DOM).
 *
 * Hard boundaries (S3; see docs/contracts/event-model.v1.md §12):
 * - no build plugin, no sourcemap, no file/line, no local variables, no `values[]`;
 * - no request/response bodies, form values, query strings/hashes, cookies, arbitrary return values;
 * - only same-origin, non-ingest requests get `traceparent` + `X-TraceBoard-Click`;
 * - ingest uses the native fetch captured at init (no recursion), NDJSON batches, fire-and-forget;
 * - `startNs` is single-machine epoch nanoseconds: round((performance.timeOrigin + performance.now()) * 1e6);
 * - all SDK failures are swallowed (fail-open) and never change page behavior.
 *
 * Intentionally NOT implemented (S4/S5): async context propagation (await/.then/timer continuations
 * fall back to the click root), background request lanes outside a click window, `callback` events,
 * `INFERRED`/`MANUAL` confidence, DOM diffing/screenshots.
 */

/** SDK version; keep in sync with package.json (asserted by the IIFE tests). */
export const version = "0.1.0";

export interface InitOptions {
  /** Ingest base path; the SDK posts NDJSON to `${ingestUrl}/v1/events`. Default `/ingest`. */
  ingestUrl?: string;
  /** TraceBoard session partition id. Default `s_s3demo`. */
  sessionId?: string;
  /** Prefix used for `js_method` node keys (`<appName>#<name>`). Default `app`. */
  appName?: string;
  /** Click observe window in milliseconds. Default 1500. */
  observeMs?: number;
}

export interface TraceBoardDiagnostics {
  /** In-flight instrumented fetch/XHR requests that belong to a click window. */
  pending: number;
  /** NDJSON lines waiting for the next transport flush. */
  queue: number;
  /** Events dropped because the transport failed or the click operation was already closed. */
  drops: number;
  /** Events successfully handed to the ingest transport. */
  sent: number;
}

export interface TraceBoardHandle {
  /** Wrap a function to emit a `js_method` span; preserves `this`, args, return value and thrown errors. */
  wrapFn<T extends (...args: any[]) => any>(name: string, fn: T): T;
  /** Record a user-visible DOM effect declared by the app (does not touch the DOM). */
  uiEffect(text: string, targetSelector?: string): void;
  /** Internal counters for tests (no network telemetry). */
  diagnostics(): TraceBoardDiagnostics;
}

type FrontendKind = "ui_event" | "js_method" | "fetch" | "render";
type FrontendStatus = "OK" | "RETURNED_FALSE" | "THREW";

interface EventReturn {
  type: string;
  value?: unknown;
}

interface SpanEvent {
  schema: "traceboard.event.v1";
  type: "span";
  sessionId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  rootEventId: string;
  kind: FrontendKind;
  nodeKey: string;
  thread: { id: number; name: string };
  startNs: number;
  durNs: number;
  status: FrontendStatus;
  return: EventReturn | null;
  confidence: "EXACT";
  flags: string[];
}

interface Operation {
  traceId: string;
  clickId: string;
  rootSpanId: string;
  nodeKey: string;
  startPerfMs: number;
  lastEndPerfMs: number;
  pending: number;
  windowClosed: boolean;
  observeMs: number;
  rootEmitted: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

interface StackEntry {
  spanId: string;
  op: Operation;
}

interface RequestPlan {
  op: Operation;
  spanId: string;
  parentSpanId: string;
  startPerfMs: number;
  nodeKey: string;
  requestInit: any;
}

const EVENT_SCHEMA = "traceboard.event.v1";
const DEFAULT_OBSERVE_MS = 1500;
const MAX_NODE_KEY = 200;
const MAX_BATCH_LINES = 100;
const MAX_BATCH_BYTES = 4 * 1024 * 1024;
const MAX_KEEPALIVE_BYTES = 60 * 1024;

function perfNow(): number {
  const perf = (globalThis as any).performance;
  if (perf && typeof perf.now === "function") {
    return perf.now();
  }
  return Date.now();
}

function epochNsFromPerfMs(perfMs: number): number {
  const perf = (globalThis as any).performance;
  let originMs: number;
  if (perf && typeof perf.timeOrigin === "number") {
    originMs = perf.timeOrigin;
  } else {
    // Degraded fallback (no High Resolution Time origin): wall clock only.
    originMs = Date.now() - perfMs;
  }
  return Math.round((originMs + perfMs) * 1e6);
}

function durationNs(startPerfMs: number, endPerfMs: number): number {
  return Math.max(0, Math.round((endPerfMs - startPerfMs) * 1e6));
}

function truncate(text: string, limit: number): string {
  if (typeof text !== "string") {
    return "";
  }
  const chars = Array.from(text);
  if (chars.length <= limit) {
    return text;
  }
  return chars.slice(0, limit).join("");
}

function randomHex(length: number): string {
  let out = "";
  const cryptoObj = (globalThis as any).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(Math.ceil(length / 2));
      cryptoObj.getRandomValues(bytes);
      for (let i = 0; i < bytes.length; i += 1) {
        out += bytes[i].toString(16).padStart(2, "0");
      }
    } catch {
      out = "";
    }
  }
  while (out.length < length) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  out = out.slice(0, length);
  if (/^0+$/.test(out)) {
    out = `1${out.slice(1)}`;
  }
  return out;
}

function byteLength(text: string): number {
  try {
    const Encoder = (globalThis as any).TextEncoder;
    if (typeof Encoder === "function") {
      return new Encoder().encode(text).length;
    }
  } catch {
    // fall through
  }
  return text.length * 3;
}

function normalizeOptions(options: InitOptions): Required<InitOptions> {
  const ingestUrl =
    typeof options.ingestUrl === "string" && options.ingestUrl.trim() !== ""
      ? options.ingestUrl.trim()
      : "/ingest";
  const sessionId =
    typeof options.sessionId === "string" && options.sessionId.trim() !== ""
      ? options.sessionId.trim()
      : "s_s3demo";
  const appName =
    typeof options.appName === "string" && options.appName.trim() !== ""
      ? options.appName.trim()
      : "app";
  const observeRaw = Number(options.observeMs);
  const observeMs =
    Number.isFinite(observeRaw) && observeRaw >= 0 ? Math.round(observeRaw) : DEFAULT_OBSERVE_MS;
  return { ingestUrl, sessionId, appName, observeMs };
}

function safeUrl(text: string, baseHref: string): URL | null {
  try {
    return new URL(text, baseHref);
  } catch {
    return null;
  }
}

function pathOf(urlText: string, baseHref: string): string {
  const parsed = safeUrl(urlText, baseHref);
  return parsed ? parsed.pathname : urlText;
}

function isIngestPath(pathname: string, ingestPath: string): boolean {
  if (!ingestPath || ingestPath === "/") {
    return false;
  }
  if (pathname === ingestPath) {
    return true;
  }
  return pathname.startsWith(`${ingestPath.replace(/\/+$/, "")}/`);
}

function isSameOrigin(parsed: URL, baseHref: string): boolean {
  try {
    return parsed.origin === new URL(baseHref).origin;
  } catch {
    return true;
  }
}

function createHeaders(input: any, init: any, win: any): any | null {
  const Ctor = (win && win.Headers) || (globalThis as any).Headers;
  if (typeof Ctor !== "function") {
    return null;
  }
  let base: any;
  if (init && typeof init === "object" && init.headers !== undefined) {
    base = init.headers;
  } else if (input && typeof input === "object" && input.headers !== undefined) {
    base = input.headers;
  }
  try {
    return new Ctor(base);
  } catch {
    return null;
  }
}

function mergeInit(init: any, headers: any): any {
  if (init && typeof init === "object") {
    return { ...init, headers };
  }
  return { headers };
}

function isPromiseLike(value: any): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function"
  );
}

function attributeOf(el: any, name: string): string | null {
  try {
    if (el && typeof el.getAttribute === "function") {
      const value = el.getAttribute(name);
      return value === null || value === undefined ? null : String(value);
    }
    if (el && el.dataset) {
      const camel = name.replace(/^data-/, "").replace(/-([a-z])/g, (_all: string, c: string) => c.toUpperCase());
      const value = el.dataset[camel];
      return value === undefined || value === null ? null : String(value);
    }
  } catch {
    return null;
  }
  return null;
}

function tagOf(el: any): string {
  const raw = (el && (el.tagName || el.nodeName)) || "node";
  return String(raw).toLowerCase();
}

function textOf(el: any): string {
  try {
    const raw = el && el.textContent;
    if (typeof raw !== "string") {
      return "";
    }
    return raw.replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function domPathOf(el: any): string {
  const segments: string[] = [];
  let node: any = el;
  let guard = 0;
  while (node && guard < 20) {
    guard += 1;
    let segment = tagOf(node);
    if (node.id) {
      segment += `#${String(node.id)}`;
    } else {
      const parent = node.parentElement;
      const siblings = parent && parent.children ? Array.from(parent.children as ArrayLike<any>) : [];
      const sameTag = siblings.filter((child: any) => tagOf(child) === tagOf(node));
      if (sameTag.length > 1) {
        segment += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }
    segments.unshift(segment);
    if (node.id || !node.parentElement) {
      break;
    }
    node = node.parentElement;
  }
  return segments.join(">");
}

/** Element identity priority: `#id` -> `[data-tb-name=...]` -> `tag[role=...]` -> text -> DOM path. */
export function elementIdentity(target: any): string {
  try {
    if (!target || typeof target !== "object") {
      return "unknown";
    }
    if (target.id) {
      return truncate(`#${String(target.id)}`, MAX_NODE_KEY);
    }
    const dataName = attributeOf(target, "data-tb-name");
    if (dataName) {
      return truncate(`[data-tb-name=${dataName}]`, MAX_NODE_KEY);
    }
    const role = attributeOf(target, "role");
    if (role) {
      return truncate(`${tagOf(target)}[role=${role}]`, MAX_NODE_KEY);
    }
    const text = textOf(target);
    if (text) {
      return truncate(text, MAX_NODE_KEY);
    }
    return truncate(domPathOf(target), MAX_NODE_KEY) || "unknown";
  } catch {
    return "unknown";
  }
}

class TraceBoardRuntime {
  readonly handle: TraceBoardHandle;

  private readonly opts: Required<InitOptions>;
  private readonly win: any;
  private readonly doc: any;
  private readonly baseHref: string;
  private readonly ingestPath: string;
  private readonly reportUrl: string;
  private nativeFetch: ((input: any, init?: any) => any) | null = null;
  private currentOp: Operation | null = null;
  private readonly openOps: Set<Operation> = new Set();
  private readonly stack: StackEntry[] = [];
  private readonly queue: string[] = [];
  private flushScheduled = false;
  private flushing = false;
  private drops = 0;
  private sent = 0;
  private pendingCount = 0;

  constructor(opts: Required<InitOptions>) {
    this.opts = opts;
    const globalObj: any = typeof globalThis !== "undefined" ? (globalThis as any) : {};
    this.win = globalObj.window !== undefined && globalObj.window !== null ? globalObj.window : globalObj;
    this.doc = (this.win && this.win.document) || globalObj.document;
    const locationObject = (this.win && this.win.location) || globalObj.location;
    const locationHref =
      locationObject && typeof locationObject.href === "string"
        ? locationObject.href
        : "http://localhost/";
    this.baseHref = locationHref;
    this.ingestPath = pathOf(opts.ingestUrl, this.baseHref).replace(/\/+$/, "") || "/ingest";
    this.reportUrl = `${opts.ingestUrl.replace(/\/+$/, "")}/v1/events`;
    this.handle = {
      wrapFn: <T extends (...args: any[]) => any>(name: string, fn: T): T => this.wrapFn(name, fn),
      uiEffect: (text: string, targetSelector?: string): void => this.uiEffect(text, targetSelector),
      diagnostics: () => ({
        pending: this.pendingCount,
        queue: this.queue.length,
        drops: this.drops,
        sent: this.sent
      })
    };
  }

  install(): void {
    try {
      if (this.doc && typeof this.doc.addEventListener === "function") {
        this.doc.addEventListener("click", this.onClick, true);
      }
    } catch {
      // fail-open
    }
    try {
      if (this.win && typeof this.win.addEventListener === "function") {
        this.win.addEventListener("pagehide", this.onPagehide);
      }
    } catch {
      // fail-open
    }
    this.installFetch();
    this.installXhr();
  }

  private onClick = (event: any): void => {
    try {
      this.beginOperation(elementIdentity(event && event.target));
    } catch {
      // fail-open
    }
  };

  private onPagehide = (): void => {
    try {
      this.closeCurrentOperation();
      for (const op of Array.from(this.openOps)) {
        if (!op.windowClosed) {
          op.windowClosed = true;
          op.observeMs = Math.max(0, Math.round(perfNow() - op.startPerfMs));
        }
        this.emitRoot(op);
      }
      this.flush(true);
    } catch {
      // fail-open
    }
  };

  private beginOperation(nodeKey: string): void {
    this.closeCurrentOperation();
    const startPerfMs = perfNow();
    const op: Operation = {
      traceId: randomHex(32),
      clickId: `click_${randomHex(16)}`,
      rootSpanId: randomHex(16),
      nodeKey,
      startPerfMs,
      lastEndPerfMs: startPerfMs,
      pending: 0,
      windowClosed: false,
      observeMs: 0,
      rootEmitted: false,
      timer: null
    };
    this.currentOp = op;
    this.openOps.add(op);
    try {
      op.timer = setTimeout(() => {
        op.timer = null;
        // Natural expiry of the configured observation window: report the window length
        // (1500 by default). Early closes (new click/pagehide) report the actual milliseconds.
        this.closeWindow(op, true);
      }, this.opts.observeMs);
    } catch {
      op.timer = null;
    }
  }

  private closeCurrentOperation(): void {
    const op = this.currentOp;
    if (!op) {
      return;
    }
    this.currentOp = null;
    this.closeWindow(op, false);
  }

  private closeWindow(op: Operation, natural: boolean): void {
    if (!op.windowClosed) {
      op.windowClosed = true;
      op.observeMs = natural
        ? this.opts.observeMs
        : Math.max(0, Math.round(perfNow() - op.startPerfMs));
    }
    if (op.timer !== null) {
      try {
        clearTimeout(op.timer);
      } catch {
        // fail-open
      }
      op.timer = null;
    }
    if (op.pending === 0) {
      this.emitRoot(op);
    }
  }

  private currentOpenOperation(): Operation | null {
    const op = this.currentOp;
    return op && !op.windowClosed ? op : null;
  }

  private parentFor(op: Operation): string {
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      if (this.stack[i].op === op) {
        return this.stack[i].spanId;
      }
    }
    return op.rootSpanId;
  }

  private emitRoot(op: Operation): void {
    if (op.rootEmitted) {
      return;
    }
    op.rootEmitted = true;
    this.openOps.delete(op);
    this.enqueue({
      schema: EVENT_SCHEMA,
      type: "span",
      sessionId: this.opts.sessionId,
      traceId: op.traceId,
      spanId: op.rootSpanId,
      parentSpanId: null,
      rootEventId: op.clickId,
      kind: "ui_event",
      nodeKey: op.nodeKey,
      thread: { id: 0, name: "browser-main" },
      startNs: epochNsFromPerfMs(op.startPerfMs),
      durNs: durationNs(op.startPerfMs, op.lastEndPerfMs),
      status: "OK",
      return: null,
      confidence: "EXACT",
      flags: ["SDK_ACTIVE", "S3_RUNTIME_SDK", `OBSERVE_MS=${op.observeMs}`]
    });
  }

  private emitChild(
    op: Operation,
    kind: FrontendKind,
    nodeKey: string,
    spanId: string,
    parentSpanId: string,
    startPerfMs: number,
    endPerfMs: number,
    status: FrontendStatus,
    returnValue: EventReturn | null
  ): void {
    if (op.rootEmitted) {
      this.drops += 1;
      return;
    }
    op.lastEndPerfMs = Math.max(op.lastEndPerfMs, endPerfMs);
    this.enqueue({
      schema: EVENT_SCHEMA,
      type: "span",
      sessionId: this.opts.sessionId,
      traceId: op.traceId,
      spanId,
      parentSpanId,
      rootEventId: op.clickId,
      kind,
      nodeKey: truncate(nodeKey, MAX_NODE_KEY),
      thread: { id: 0, name: "browser-main" },
      startNs: epochNsFromPerfMs(startPerfMs),
      durNs: durationNs(startPerfMs, endPerfMs),
      status,
      return: returnValue,
      confidence: "EXACT",
      flags: ["SDK_ACTIVE"]
    });
  }

  private afterChild(op: Operation): void {
    if (op.windowClosed && op.pending === 0 && !op.rootEmitted) {
      this.emitRoot(op);
    }
  }

  private wrapFn<T extends (...args: any[]) => any>(name: string, fn: T): T {
    if (typeof fn !== "function") {
      return fn;
    }
    const runtime = this;
    const wrapped = function (this: any, ...args: any[]): any {
      let op: Operation | null = null;
      try {
        op = runtime.currentOpenOperation();
      } catch {
        op = null;
      }
      if (!op) {
        return fn.apply(this, args);
      }
      const startPerfMs = perfNow();
      const spanId = randomHex(16);
      const parentSpanId = runtime.parentFor(op);
      const nodeKey = `${runtime.opts.appName}#${name}`;
      runtime.stack.push({ spanId, op });
      let result: any;
      try {
        result = fn.apply(this, args);
      } catch (error) {
        runtime.stack.pop();
        runtime.emitChild(
          op,
          "js_method",
          nodeKey,
          spanId,
          parentSpanId,
          startPerfMs,
          perfNow(),
          "THREW",
          null
        );
        runtime.afterChild(op);
        throw error;
      }
      runtime.stack.pop();
      if (isPromiseLike(result)) {
        try {
          result.then(
            (value: any) => runtime.finishJsMethod(op!, nodeKey, spanId, parentSpanId, startPerfMs, value, false),
            () => runtime.finishJsMethod(op!, nodeKey, spanId, parentSpanId, startPerfMs, undefined, true)
          );
        } catch {
          // Non-standard thenable: keep behavior, skip the completion record.
        }
        return result;
      }
      runtime.finishJsMethod(op, nodeKey, spanId, parentSpanId, startPerfMs, result, false);
      return result;
    };
    return wrapped as T;
  }

  private finishJsMethod(
    op: Operation,
    nodeKey: string,
    spanId: string,
    parentSpanId: string,
    startPerfMs: number,
    value: any,
    threw: boolean
  ): void {
    let status: FrontendStatus = "OK";
    let returnValue: EventReturn | null = null;
    if (threw) {
      status = "THREW";
    } else if (value === false) {
      status = "RETURNED_FALSE";
      returnValue = { type: "boolean", value: false };
    }
    this.emitChild(op, "js_method", nodeKey, spanId, parentSpanId, startPerfMs, perfNow(), status, returnValue);
    this.afterChild(op);
  }

  private uiEffect(text: string, _targetSelector?: string): void {
    try {
      const op = this.currentOpenOperation();
      if (!op) {
        return;
      }
      const value = typeof text === "string" ? text : String(text === undefined || text === null ? "" : text);
      const startPerfMs = perfNow();
      const spanId = randomHex(16);
      this.emitChild(
        op,
        "render",
        `ui_effect:${value}`,
        spanId,
        this.parentFor(op),
        startPerfMs,
        perfNow(),
        "OK",
        { type: "ui_effect", value }
      );
      this.afterChild(op);
    } catch {
      // fail-open
    }
  }

  private installFetch(): void {
    const globalObj: any = typeof globalThis !== "undefined" ? (globalThis as any) : {};
    const host =
      this.win && typeof this.win.fetch === "function"
        ? this.win
        : typeof globalObj.fetch === "function"
          ? globalObj
          : null;
    if (!host) {
      return;
    }
    let native: (input: any, init?: any) => any;
    try {
      native = host.fetch.bind(host);
    } catch {
      return;
    }
    this.nativeFetch = native;
    const runtime = this;
    try {
      host.fetch = function (input: any, init?: any): any {
        return runtime.handleFetch(native, input, init);
      };
    } catch {
      // fail-open
    }
  }

  private handleFetch(native: (input: any, init?: any) => any, input: any, init: any): any {
    let plan: RequestPlan | null = null;
    try {
      plan = this.prepareRequest(input, init, "fetch");
    } catch {
      plan = null;
    }
    if (!plan) {
      return native(input, init);
    }
    const requestPlan = plan;
    let response: any;
    try {
      response = native(input, requestPlan.requestInit);
    } catch (error) {
      this.settleRequest(requestPlan, false, 0);
      throw error;
    }
    if (!isPromiseLike(response)) {
      this.settleRequest(requestPlan, true, response && typeof response.status === "number" ? response.status : 0);
      return response;
    }
    return response.then(
      (resolved: any) => {
        this.settleRequest(requestPlan, true, resolved && typeof resolved.status === "number" ? resolved.status : 0);
        return resolved;
      },
      (error: any) => {
        this.settleRequest(requestPlan, false, 0);
        throw error;
      }
    );
  }

  private prepareRequest(input: any, init: any, transport: "fetch" | "xhr"): RequestPlan | null {
    const urlText =
      typeof input === "string"
        ? input
        : input && typeof input.url === "string"
          ? input.url
          : String(input);
    const parsed = safeUrl(urlText, this.baseHref);
    if (!parsed || isIngestPath(parsed.pathname, this.ingestPath)) {
      return null;
    }
    const op = this.currentOpenOperation();
    if (!op) {
      return null;
    }
    const method = String(
      (init && typeof init === "object" && init.method) ||
        (input && typeof input === "object" && input.method) ||
        "GET"
    ).toUpperCase();
    const spanId = randomHex(16);
    const parentSpanId = this.parentFor(op);
    const startPerfMs = perfNow();
    let requestInit = init;
    if (transport === "fetch" && isSameOrigin(parsed, this.baseHref)) {
      try {
        const headers = createHeaders(input, init, this.win);
        if (headers) {
          headers.set("traceparent", `00-${op.traceId}-${spanId}-01`);
          headers.set("X-TraceBoard-Click", op.clickId);
          requestInit = mergeInit(init, headers);
        }
      } catch {
        requestInit = init;
      }
    }
    op.pending += 1;
    this.pendingCount += 1;
    return {
      op,
      spanId,
      parentSpanId,
      startPerfMs,
      nodeKey: `${method} ${parsed.pathname}`,
      requestInit
    };
  }

  private settleRequest(plan: RequestPlan, ok: boolean, statusCode: number): void {
    const op = plan.op;
    op.pending = Math.max(0, op.pending - 1);
    this.pendingCount = Math.max(0, this.pendingCount - 1);
    this.emitChild(
      op,
      "fetch",
      plan.nodeKey,
      plan.spanId,
      plan.parentSpanId,
      plan.startPerfMs,
      perfNow(),
      ok ? "OK" : "THREW",
      ok ? { type: "http", value: statusCode } : null
    );
    this.afterChild(op);
  }

  private installXhr(): void {
    const globalObj: any = typeof globalThis !== "undefined" ? (globalThis as any) : {};
    const XHR =
      (this.win && this.win.XMLHttpRequest) || (globalObj && globalObj.XMLHttpRequest);
    if (!XHR || !XHR.prototype) {
      return;
    }
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    if (typeof origOpen !== "function" || typeof origSend !== "function") {
      return;
    }
    const runtime = this;
    const states = new WeakMap<object, { method: string; url: string }>();
    try {
      XHR.prototype.open = function (this: any, method: any, url: any, ...rest: any[]): any {
        try {
          states.set(this, {
            method: String(method === undefined || method === null ? "GET" : method).toUpperCase(),
            url: String(url)
          });
        } catch {
          // fail-open
        }
        return origOpen.apply(this, [method, url, ...rest] as any);
      };
      XHR.prototype.send = function (this: any, body?: any): any {
        let plan: (Omit<RequestPlan, "requestInit"> & { xhr: any }) | null = null;
        try {
          plan = runtime.prepareXhr(this, states.get(this));
        } catch {
          plan = null;
        }
        if (!plan) {
          return origSend.call(this, body);
        }
        const xhrPlan = plan;
        let settled = false;
        const finish = (ok: boolean, statusCode: number): void => {
          if (settled) {
            return;
          }
          settled = true;
          runtime.settleRequest({ ...xhrPlan, requestInit: undefined }, ok, statusCode);
        };
        try {
          this.addEventListener("load", () => finish(true, typeof this.status === "number" ? this.status : 0));
          this.addEventListener("error", () => finish(false, 0));
          this.addEventListener("timeout", () => finish(false, 0));
          this.addEventListener("abort", () => finish(false, 0));
        } catch {
          // fail-open
        }
        try {
          return origSend.call(this, body);
        } catch (error) {
          finish(false, 0);
          throw error;
        }
      };
    } catch {
      // fail-open
    }
  }

  private prepareXhr(
    xhr: any,
    state: { method: string; url: string } | undefined
  ): (Omit<RequestPlan, "requestInit"> & { xhr: any }) | null {
    if (!state) {
      return null;
    }
    const parsed = safeUrl(state.url, this.baseHref);
    if (!parsed || isIngestPath(parsed.pathname, this.ingestPath)) {
      return null;
    }
    const op = this.currentOpenOperation();
    if (!op) {
      return null;
    }
    const spanId = randomHex(16);
    const parentSpanId = this.parentFor(op);
    const startPerfMs = perfNow();
    if (isSameOrigin(parsed, this.baseHref)) {
      try {
        xhr.setRequestHeader("traceparent", `00-${op.traceId}-${spanId}-01`);
        xhr.setRequestHeader("X-TraceBoard-Click", op.clickId);
      } catch {
        // fail-open: headers are best effort
      }
    }
    op.pending += 1;
    this.pendingCount += 1;
    return {
      op,
      spanId,
      parentSpanId,
      startPerfMs,
      nodeKey: `${state.method} ${parsed.pathname}`,
      xhr
    };
  }

  private enqueue(event: SpanEvent): void {
    try {
      this.queue.push(JSON.stringify(event));
      this.scheduleFlush();
    } catch {
      this.drops += 1;
    }
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    const run = (): void => {
      this.flushScheduled = false;
      this.flush(false);
    };
    try {
      if (typeof queueMicrotask === "function") {
        queueMicrotask(run);
        return;
      }
    } catch {
      // fall through to timer
    }
    try {
      setTimeout(run, 0);
    } catch {
      this.flushScheduled = false;
    }
  }

  private flush(keepalive: boolean): void {
    if (this.flushing || this.queue.length === 0) {
      return;
    }
    const native = this.nativeFetch;
    if (!native) {
      this.drops += this.queue.length;
      this.queue.length = 0;
      return;
    }
    const batch: string[] = [];
    let bytes = 0;
    while (this.queue.length > 0 && batch.length < MAX_BATCH_LINES) {
      const line = this.queue[0];
      const lineBytes = byteLength(line) + 1;
      if (batch.length > 0 && bytes + lineBytes > MAX_BATCH_BYTES) {
        break;
      }
      batch.push(line);
      this.queue.shift();
      bytes += lineBytes;
    }
    const body = `${batch.join("\n")}\n`;
    const init: any = {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      body
    };
    if (keepalive && body.length <= MAX_KEEPALIVE_BYTES) {
      init.keepalive = true;
    }
    this.flushing = true;
    let result: any;
    try {
      result = native(this.reportUrl, init);
    } catch {
      this.finishFlush(batch.length, false);
      return;
    }
    if (isPromiseLike(result)) {
      try {
        result.then(
          () => this.finishFlush(batch.length, true),
          () => this.finishFlush(batch.length, false)
        );
      } catch {
        this.finishFlush(batch.length, false);
      }
      return;
    }
    this.finishFlush(batch.length, true);
  }

  private finishFlush(count: number, ok: boolean): void {
    if (ok) {
      this.sent += count;
    } else {
      this.drops += count;
    }
    this.flushing = false;
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }
}

let activeRuntime: TraceBoardRuntime | null = null;

// Replaced with `true` by the esbuild IIFE build (`--define:__TRACEBOARD_IIFE__=true`).
// The ESM build keeps this undefined, so page-config auto-init never runs on import.
declare const __TRACEBOARD_IIFE__: boolean;

const SESSION_ID_PATTERN = /^s_[A-Za-z0-9_-]+$/;
const CONFIG_GUARD_ACTIVE = "__TRACEBOARD_SDK_ACTIVE__";
const CONFIG_GUARD_AUTO = "__TRACEBOARD_AUTO_INIT__";

function windowObject(): any | null {
  try {
    const globalObj: any = typeof globalThis !== "undefined" ? (globalThis as any) : null;
    if (!globalObj) {
      return null;
    }
    return globalObj.window !== undefined && globalObj.window !== null ? globalObj.window : globalObj;
  } catch {
    return null;
  }
}

/** Mark the page as already instrumented (explicit ESM init and IIFE auto-init both set it). */
function markSdkActive(win: any): void {
  if (!win) {
    return;
  }
  try {
    win[CONFIG_GUARD_ACTIVE] = true;
  } catch {
    // fail-open
  }
  try {
    // Contract alias: dispatch §4.6 names this guard `window.__TRACEBOARD_AUTO_INIT__`.
    win[CONFIG_GUARD_AUTO] = true;
  } catch {
    // fail-open
  }
}

function safeWarn(message: string): void {
  try {
    const consoleObj = (globalThis as any).console;
    if (consoleObj && typeof consoleObj.warn === "function") {
      consoleObj.warn(`[traceboard-sdk] ${message}`);
    }
  } catch {
    // fail-open
  }
}

function configText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/**
 * Preview injection entry point: called once when the IIFE script loads and
 * `window.__TRACEBOARD_CONFIG__` (served by the launcher) is an object.
 * Validates sessionId/ingestUrl/appName/observeMs, inits exactly once, never throws.
 */
function autoInitFromPageConfig(): void {
  try {
    const win = windowObject();
    if (!win) {
      return;
    }
    const config = win.__TRACEBOARD_CONFIG__;
    if (config === null || typeof config !== "object") {
      return;
    }
    if (win[CONFIG_GUARD_ACTIVE] || win[CONFIG_GUARD_AUTO]) {
      safeWarn("auto-init skipped: SDK already active");
      return;
    }
    const sessionId = configText((config as any).sessionId, "");
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      safeWarn("auto-init skipped: invalid sessionId (expected s_[A-Za-z0-9_-]+)");
      return;
    }
    const ingestUrl = configText((config as any).ingestUrl, "/ingest");
    const appName = configText((config as any).appName, "traceboard-preview");
    const observeRaw = (config as any).observeMs;
    const observeMs =
      typeof observeRaw === "number" && Number.isFinite(observeRaw) && observeRaw >= 1 && observeRaw <= 60000
        ? Math.round(observeRaw)
        : DEFAULT_OBSERVE_MS;
    initTraceBoard({ ingestUrl, sessionId, appName, observeMs });
    markSdkActive(win);
  } catch {
    // fail-open: a broken config must never break the host page
  }
}

function createNoopHandle(): TraceBoardHandle {
  return {
    wrapFn: <T extends (...args: any[]) => any>(_name: string, fn: T): T => fn,
    uiEffect: (_text: string, _targetSelector?: string): void => {
      // no-op until initTraceBoard succeeds
    },
    diagnostics: () => ({ pending: 0, queue: 0, drops: 0, sent: 0 })
  };
}

export function initTraceBoard(options: InitOptions = {}): TraceBoardHandle {
  try {
    if (activeRuntime) {
      markSdkActive(windowObject());
      return activeRuntime.handle;
    }
    const runtime = new TraceBoardRuntime(normalizeOptions(options));
    runtime.install();
    activeRuntime = runtime;
    markSdkActive(windowObject());
    return runtime.handle;
  } catch {
    return createNoopHandle();
  }
}

if (typeof __TRACEBOARD_IIFE__ !== "undefined" && __TRACEBOARD_IIFE__) {
  autoInitFromPageConfig();
}

export function wrapFn<T extends (...args: any[]) => any>(name: string, fn: T): T {
  try {
    return activeRuntime ? activeRuntime.handle.wrapFn(name, fn) : fn;
  } catch {
    return fn;
  }
}

export function uiEffect(text: string, targetSelector?: string): void {
  try {
    if (activeRuntime) {
      activeRuntime.handle.uiEffect(text, targetSelector);
    }
  } catch {
    // fail-open
  }
}
