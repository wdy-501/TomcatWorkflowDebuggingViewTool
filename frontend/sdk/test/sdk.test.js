import test from "node:test";
import assert from "node:assert/strict";

// --- Minimal DOM / fetch / XHR stubs (no external dependencies) -------------------------------

let clickHandler = null;

class FakeXHR {
  constructor() {
    this.listeners = {};
    this.status = 200;
    this.requestHeaders = {};
    this.method = "";
    this.url = "";
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  send() {
    setTimeout(() => {
      this.status = 200;
      for (const fn of this.listeners.load || []) {
        fn();
      }
    }, 5);
  }

  setRequestHeader(name, value) {
    this.requestHeaders[name] = value;
  }

  addEventListener(type, fn) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(fn);
  }
}

globalThis.document = {
  addEventListener(type, handler, capture) {
    if (type === "click" && capture === true) {
      clickHandler = handler;
    }
  }
};
globalThis.window = globalThis;
globalThis.location = { href: "http://localhost:5174/" };
globalThis.XMLHttpRequest = FakeXHR;

const ingestPosts = [];
const businessRequests = [];
let businessImpl = async () => ({ status: 200 });

globalThis.fetch = function (input, init) {
  const url = typeof input === "string" ? input : String(input && input.url ? input.url : input);
  if (url.startsWith("/ingest")) {
    ingestPosts.push({ url, init });
    return Promise.resolve({ status: 202 });
  }
  businessRequests.push({ url, init });
  return businessImpl(url, init);
};

// Import after stubs exist so init captures them.
const { initTraceBoard } = await import("../dist/index.js");

const sdk = initTraceBoard({
  ingestUrl: "/ingest",
  sessionId: "s_s3demo",
  appName: "OrderEdit.vue",
  observeMs: 20
});

// --- Helpers -----------------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function el(props = {}) {
  const attrs = props.attrs || {};
  return {
    tagName: props.tag || "BUTTON",
    id: props.id || "",
    textContent: props.text || "",
    parentElement: props.parent || null,
    children: props.children || [],
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    }
  };
}

function click(target) {
  assert.ok(clickHandler, "SDK must register a capture-phase document click listener");
  clickHandler({ type: "click", target });
}

function allEvents() {
  const lines = [];
  for (const post of ingestPosts) {
    const body = post.init && typeof post.init.body === "string" ? post.init.body : "";
    for (const line of body.split("\n")) {
      if (line.trim() !== "") {
        lines.push(JSON.parse(line));
      }
    }
  }
  return lines;
}

function latestRoot(nodeKey) {
  const roots = allEvents().filter((e) => e.kind === "ui_event" && e.nodeKey === nodeKey);
  return roots[roots.length - 1];
}

function eventsForTrace(traceId) {
  return allEvents().filter((e) => e.traceId === traceId);
}

// --- Tests -------------------------------------------------------------------------------------

test("click root: shape, epoch-ns clock, flags, identity priority", async () => {
  click(el({ id: "btn-cancel", text: "取消订单", attrs: { "data-tb-name": "cancel", role: "button" } }));
  await sleep(80);

  const root = latestRoot("#btn-cancel");
  assert.ok(root, "expected #btn-cancel click root");
  assert.equal(root.schema, "traceboard.event.v1");
  assert.equal(root.type, "span");
  assert.equal(root.sessionId, "s_s3demo");
  assert.match(root.traceId, /^[0-9a-f]{32}$/);
  assert.match(root.spanId, /^[0-9a-f]{16}$/);
  assert.equal(root.parentSpanId, null);
  assert.match(root.rootEventId, /^click_[0-9a-f]{16}$/);
  assert.equal(root.kind, "ui_event");
  assert.equal(root.status, "OK");
  assert.equal(root.confidence, "EXACT");
  assert.equal(root.return, null);
  assert.deepEqual(root.thread, { id: 0, name: "browser-main" });
  assert.deepEqual(root.flags.slice(0, 2), ["SDK_ACTIVE", "S3_RUNTIME_SDK"]);
  assert.match(root.flags[2], /^OBSERVE_MS=\d+$/);
  assert.equal(root.source, undefined);
  assert.ok(Number.isInteger(root.startNs), "startNs must be an integer");
  assert.ok(root.startNs > 1.6e18, "startNs must be epoch nanoseconds");
  assert.ok(Number.isInteger(root.durNs) && root.durNs >= 0, "durNs must be a non-negative integer");

  // Identity priority: data-tb-name, role, text, DOM path.
  click(el({ attrs: { "data-tb-name": "save-b" }, text: "保存" }));
  click(el({ attrs: { role: "switch" }, text: "开关" }));
  click(el({ tag: "DIV", text: "  确认   订单 " }));
  const parent = el({ tag: "DIV", id: "", children: [] });
  const target = el({ tag: "SPAN", parent });
  parent.children.push(target);
  click(target);
  await sleep(80);

  const keys = allEvents()
    .filter((e) => e.kind === "ui_event")
    .map((e) => e.nodeKey);
  assert.ok(keys.includes("[data-tb-name=save-b]"));
  assert.ok(keys.includes("button[role=switch]"));
  assert.ok(keys.includes("确认 订单"));
  assert.ok(keys.includes("div>span"));
});

test("fetch inside a click: traceparent + X-TraceBoard-Click, response event; ingest skipped", async () => {
  businessImpl = async () => ({ status: 200 });
  click(el({ id: "btn-fetch" }));
  const response = await globalThis.fetch("/api/orders/1/cancel?token=secret#frag", { method: "POST" });
  assert.equal(response.status, 200);
  await globalThis.fetch("/ingest/v1/events", { method: "POST", body: "{}" });
  await sleep(80);

  const request = businessRequests[businessRequests.length - 1];
  assert.ok(request, "business request should reach the native fetch");
  const headers = new Headers(request.init.headers);
  const traceparent = headers.get("traceparent");
  const clickHeader = headers.get("X-TraceBoard-Click");
  assert.match(traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

  const root = latestRoot("#btn-fetch");
  assert.ok(root);
  assert.equal(clickHeader, root.rootEventId);
  assert.equal(traceparent.split("-")[1], root.traceId);
  assert.equal(traceparent.split("-")[2].length, 16);

  const trace = eventsForTrace(root.traceId);
  const fetchEvent = trace.find((e) => e.kind === "fetch");
  assert.ok(fetchEvent);
  assert.equal(fetchEvent.nodeKey, "POST /api/orders/1/cancel", "query/hash must be stripped");
  assert.equal(fetchEvent.parentSpanId, root.spanId);
  assert.equal(fetchEvent.status, "OK");
  assert.deepEqual(fetchEvent.return, { type: "http", value: 200 });
  assert.deepEqual(fetchEvent.flags, ["SDK_ACTIVE"]);
  assert.equal(traceparent.split("-")[2], fetchEvent.spanId);

  assert.equal(
    allEvents().filter((e) => e.kind === "fetch" && e.nodeKey.includes("/ingest")).length,
    0,
    "ingest requests must never become fetch events"
  );
  assert.equal(
    businessRequests.filter((r) => r.url.includes("/ingest")).length,
    0,
    "ingest must bypass the business fetch path"
  );

  const ingestHeaders = new Headers(ingestPosts[0] && ingestPosts[0].init && ingestPosts[0].init.headers);
  assert.equal(ingestHeaders.get("traceparent"), null);
  assert.equal(ingestHeaders.get("X-TraceBoard-Click"), null);
});

test("cross-origin fetch: event kept, headers not added", async () => {
  businessImpl = async () => ({ status: 204 });
  click(el({ id: "btn-cross" }));
  await globalThis.fetch("https://example.com/api/cross?q=1");
  await sleep(80);

  const request = businessRequests[businessRequests.length - 1];
  const headers = new Headers(request.init ? request.init.headers : undefined);
  assert.equal(headers.get("traceparent"), null);
  assert.equal(headers.get("X-TraceBoard-Click"), null);
  const event = allEvents().find((e) => e.kind === "fetch" && e.nodeKey === "GET /api/cross");
  assert.ok(event, "cross-origin request is still a frontend fact");
});

test("wrapFn: false/throw/promise/nesting, this and args preserved", async () => {
  businessImpl = async () => ({ status: 200 });
  click(el({ id: "btn-wrap" }));

  const inner = sdk.wrapFn("validateForm", () => false);
  const outer = sdk.wrapFn("saveB", () => inner());
  assert.equal(outer(), false);

  const boom = sdk.wrapFn("boom", () => {
    throw new Error("kaboom");
  });
  assert.throws(() => boom(), /kaboom/);

  const sum = sdk.wrapFn("sum", function (a, b) {
    return this.base + a + b;
  });
  assert.equal(sum.call({ base: 100 }, 2, 3), 105);

  const asyncFalse = sdk.wrapFn("asyncCheck", async () => {
    await sleep(2);
    return false;
  });
  assert.equal(await asyncFalse(), false);

  const asyncThrow = sdk.wrapFn("asyncThrow", async () => {
    await sleep(2);
    throw new Error("async-kaboom");
  });
  await assert.rejects(asyncThrow(), /async-kaboom/);

  await sleep(80);
  const root = latestRoot("#btn-wrap");
  assert.ok(root);
  const trace = eventsForTrace(root.traceId);
  const byKey = (key) => trace.filter((e) => e.kind === "js_method" && e.nodeKey === `OrderEdit.vue#${key}`);

  const validate = byKey("validateForm")[0];
  const save = byKey("saveB")[0];
  assert.equal(validate.status, "RETURNED_FALSE");
  assert.deepEqual(validate.return, { type: "boolean", value: false });
  assert.equal(validate.parentSpanId, save.spanId);
  assert.equal(save.parentSpanId, root.spanId);
  assert.equal(byKey("boom")[0].status, "THREW");
  assert.equal(byKey("boom")[0].return, null);
  assert.equal(byKey("sum")[0].status, "OK");
  assert.equal(byKey("sum")[0].return, null);
  assert.equal(byKey("asyncCheck")[0].status, "RETURNED_FALSE");
  assert.equal(byKey("asyncThrow")[0].status, "THREW");
});

test("case B shape: click -> validateForm(RETURNED_FALSE) -> render, zero fetch", async () => {
  businessImpl = async () => ({ status: 200 });
  click(el({ id: "btn-save-b" }));
  const validateForm = sdk.wrapFn("validateForm", () => {
    sdk.uiEffect("金额必须大于 0");
    return false;
  });
  assert.equal(validateForm(), false);
  await sleep(80);

  const root = latestRoot("#btn-save-b");
  assert.ok(root);
  const trace = eventsForTrace(root.traceId);
  assert.equal(trace.length, 3);
  const js = trace.find((e) => e.kind === "js_method");
  const render = trace.find((e) => e.kind === "render");
  assert.equal(js.nodeKey, "OrderEdit.vue#validateForm");
  assert.equal(js.status, "RETURNED_FALSE");
  assert.equal(render.nodeKey, "ui_effect:金额必须大于 0");
  assert.deepEqual(render.return, { type: "ui_effect", value: "金额必须大于 0" });
  assert.equal(render.parentSpanId, js.spanId);
  assert.equal(trace.filter((e) => e.kind === "fetch").length, 0);
  assert.ok(trace.every((e) => e.confidence === "EXACT"));
  const byStart = [...trace].sort((a, b) => a.startNs - b.startNs);
  for (let i = 1; i < byStart.length; i += 1) {
    assert.ok(byStart[i].startNs >= byStart[i - 1].startNs, "startNs must be non-decreasing");
  }
  assert.ok(root.durNs >= js.durNs, "click root must contain the js_method span");

  const diagnostics = sdk.diagnostics();
  assert.equal(diagnostics.pending, 0);
  assert.equal(diagnostics.queue, 0);
  assert.equal(diagnostics.drops, 0);
});

test("XHR inside a click: headers and fetch event", async () => {
  businessImpl = async () => ({ status: 200 });
  click(el({ id: "btn-xhr" }));
  const xhr = new globalThis.XMLHttpRequest();
  xhr.open("GET", "/api/xhr-data?q=secret");
  xhr.send();
  await sleep(80);

  assert.match(xhr.requestHeaders.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  const root = latestRoot("#btn-xhr");
  assert.equal(xhr.requestHeaders["X-TraceBoard-Click"], root.rootEventId);
  const event = eventsForTrace(root.traceId).find((e) => e.kind === "fetch" && e.nodeKey === "GET /api/xhr-data");
  assert.ok(event);
  assert.equal(event.status, "OK");
  assert.equal(event.return.value, 200);
});

test("pending fetch defers the click root (N5: no false 'confirmed absent')", async () => {
  businessImpl = () =>
    new Promise((resolve) => {
      setTimeout(() => resolve({ status: 200 }), 80);
    });
  click(el({ id: "btn-slow" }));
  const pending = globalThis.fetch("/api/slow-request", { method: "GET" });
  await sleep(35);

  assert.equal(sdk.diagnostics().pending, 1);
  assert.equal(
    allEvents().filter((e) => e.kind === "ui_event" && e.nodeKey === "#btn-slow").length,
    0,
    "click root must not be emitted while its fetch is still pending"
  );

  await pending;
  await sleep(60);
  const root = latestRoot("#btn-slow");
  assert.ok(root, "root is emitted after the pending fetch settles");
  const fetchEvent = eventsForTrace(root.traceId).find((e) => e.kind === "fetch");
  assert.ok(fetchEvent);
  assert.equal(fetchEvent.nodeKey, "GET /api/slow-request");
  assert.ok(root.durNs >= fetchEvent.durNs, "root interval must contain the settled fetch");
  assert.ok(root.flags.some((flag) => flag.startsWith("OBSERVE_MS=")));
  assert.equal(sdk.diagnostics().pending, 0);
});

test("background requests outside a click window are not collected", async () => {
  businessImpl = async () => ({ status: 200 });
  await sleep(40);
  await globalThis.fetch("/api/background-poll");
  await sleep(60);

  const event = allEvents().find((e) => e.kind === "fetch" && e.nodeKey === "GET /api/background-poll");
  assert.equal(event, undefined);
  const request = businessRequests[businessRequests.length - 1];
  const headers = new Headers(request.init ? request.init.headers : undefined);
  assert.equal(headers.get("traceparent"), null);
});
