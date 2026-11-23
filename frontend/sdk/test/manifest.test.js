import test from "node:test";
import assert from "node:assert/strict";

// S5 manifest/source tests (ESM build). Each test imports a fresh module instance
// (query-string cache wrapper) so the module-level manifest map starts empty.

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

function installStubs({ manifest, manifestResponse }) {
  const state = { clicks: [], ingest: [], requests: [], manifestRequests: 0 };
  globalThis.document = {
    addEventListener(type, handler, capture) {
      if (type === "click" && capture === true) {
        state.clicks.push(handler);
      }
    }
  };
  globalThis.location = { href: "http://localhost:5174/" };
  delete globalThis.XMLHttpRequest;
  globalThis.fetch = function (input, init) {
    const url = typeof input === "string" ? input : String(input && input.url ? input.url : input);
    if (url === "/traceboard-manifest.json") {
      state.manifestRequests += 1;
      state.requests.push({ url, init });
      return manifestResponse ? Promise.resolve(manifestResponse) : Promise.reject(new Error("no manifest"));
    }
    if (url.startsWith("/ingest")) {
      state.ingest.push({ url, init });
      return Promise.resolve({ status: 202 });
    }
    state.requests.push({ url, init });
    return Promise.resolve({ status: 200 });
  };
  if (manifest === undefined) {
    delete globalThis.__TRACEBOARD_MANIFEST__;
  } else {
    globalThis.__TRACEBOARD_MANIFEST__ = manifest;
  }
  globalThis.window = globalThis;
  return state;
}

function allEvents(state) {
  const events = [];
  for (const post of state.ingest) {
    const body = post.init && typeof post.init.body === "string" ? post.init.body : "";
    for (const line of body.split("\n")) {
      if (line.trim() !== "") {
        events.push(JSON.parse(line));
      }
    }
  }
  return events;
}

test("inline manifest: js_method and data-tb-fn click root get source + SOURCE_MAPPED (no fallback)", async () => {
  const state = installStubs({
    manifest: {
      functions: [
        { name: "validateForm", file: "src/App.vue", line: 86 },
        { name: "previewDiscount", file: "src/App.vue", line: 120 },
        { name: "incomplete", file: "", line: 0 }
      ]
    }
  });
  const { initTraceBoard } = await import("../dist/index.js?case=inline");
  const sdk = initTraceBoard({ ingestUrl: "/ingest", sessionId: "s_s5demo", appName: "app", observeMs: 20 });
  assert.equal(state.manifestRequests, 0, "an inline manifest must never trigger the JSON fallback");

  state.clicks[0]({ type: "click", target: el({ id: "btn-discount", attrs: { "data-tb-fn": "previewDiscount" } }) });
  sdk.wrapFn("validateForm", () => false)();
  sdk.wrapFn("incomplete", () => true)();
  sdk.wrapFn("notInManifest", () => true)();
  sdk.uiEffect("done");
  await globalThis.fetch("/api/orders/1/preview-discount", { method: "POST" });
  await sleep(80);

  const events = allEvents(state);
  const root = events.find((event) => event.kind === "ui_event");
  assert.ok(root, "click root expected");
  assert.equal(root.nodeKey, "#btn-discount", "manifest never rewrites nodeKey");
  assert.deepEqual(root.source, { file: "src/App.vue", line: 120 });
  assert.ok(root.flags.includes("SOURCE_MAPPED"));
  assert.match(root.flags[root.flags.length - 1], /^OBSERVE_MS=/);

  const validate = events.find((event) => event.nodeKey === "app#validateForm");
  assert.equal(validate.status, "RETURNED_FALSE");
  assert.deepEqual(validate.source, { file: "src/App.vue", line: 86 });
  assert.deepEqual(validate.flags, ["SDK_ACTIVE", "SOURCE_MAPPED"]);

  const incomplete = events.find((event) => event.nodeKey === "app#incomplete");
  assert.equal("source" in incomplete, false, "invalid manifest entries are ignored");
  const unknown = events.find((event) => event.nodeKey === "app#notInManifest");
  assert.equal("source" in unknown, false);
  assert.deepEqual(unknown.flags, ["SDK_ACTIVE"]);

  const fetchEvent = events.find((event) => event.kind === "fetch");
  assert.equal("source" in fetchEvent, false, "fetch spans never get source");
  assert.deepEqual(fetchEvent.flags, ["SDK_ACTIVE"]);
  const render = events.find((event) => event.kind === "render");
  assert.equal("source" in render, false, "render spans never get source");
  assert.equal(state.requests.some((request) => request.url === "/traceboard-manifest.json"), false);
});

test("ESM fallback: fetches /traceboard-manifest.json exactly once and maps names afterwards", async () => {
  const state = installStubs({
    manifest: undefined,
    manifestResponse: {
      status: 200,
      json: async () => ({
        functions: [
          { name: "validateForm", file: "src/App.vue", line: 86 },
          { name: "previewDiscount", file: "src/App.vue", line: 120 }
        ]
      })
    }
  });
  const { initTraceBoard } = await import("../dist/index.js?case=fallback");
  const sdk = initTraceBoard({ ingestUrl: "/ingest", sessionId: "s_s5demo", appName: "app", observeMs: 20 });

  assert.equal(state.manifestRequests, 1, "exactly one fallback fetch at init");
  const request = state.requests.find((item) => item.url === "/traceboard-manifest.json");
  assert.equal(request.init.credentials, "same-origin");
  assert.equal(request.init.cache, "no-store");

  await sleep(10); // let the fallback promise resolve
  state.clicks[0]({ type: "click", target: el({ id: "btn-discount", attrs: { "data-tb-fn": "previewDiscount" } }) });
  sdk.wrapFn("validateForm", () => true)();
  await sleep(80);

  const events = allEvents(state);
  const root = events.find((event) => event.kind === "ui_event");
  assert.deepEqual(root.source, { file: "src/App.vue", line: 120 });
  const js = events.find((event) => event.kind === "js_method");
  assert.deepEqual(js.source, { file: "src/App.vue", line: 86 });

  state.clicks[0]({ type: "click", target: el({ id: "btn-again" }) });
  sdk.wrapFn("validateForm", () => true)();
  await sleep(60);
  assert.equal(state.manifestRequests, 1, "fallback is never retried");
});

test("bad manifest: fail-open, events keep the S3 shape (no source/flag)", async () => {
  const state = installStubs({
    manifest: { functions: "not-an-array" },
    manifestResponse: { status: 404, json: async () => ({ error: "not_found" }) }
  });
  const { initTraceBoard } = await import("../dist/index.js?case=bad");
  const sdk = initTraceBoard({ ingestUrl: "/ingest", sessionId: "s_s5demo", appName: "app", observeMs: 20 });
  assert.equal(state.manifestRequests, 1, "a broken inline shape falls back once (ESM)");
  await sleep(10);

  state.clicks[0]({ type: "click", target: el({ id: "btn-b", attrs: { "data-tb-fn": "previewDiscount" } }) });
  sdk.wrapFn("validateForm", () => true)();
  await globalThis.fetch("/api/ping");
  await sleep(80);

  const events = allEvents(state);
  const root = events.find((event) => event.kind === "ui_event");
  assert.equal("source" in root, false);
  assert.deepEqual(root.flags.slice(0, 2), ["SDK_ACTIVE", "S3_RUNTIME_SDK"]);
  assert.equal(root.flags.includes("SOURCE_MAPPED"), false);
  const js = events.find((event) => event.kind === "js_method");
  assert.equal("source" in js, false);
  assert.deepEqual(js.flags, ["SDK_ACTIVE"]);
  const fetchEvent = events.find((event) => event.kind === "fetch");
  assert.equal("source" in fetchEvent, false);
  assert.deepEqual(fetchEvent.flags, ["SDK_ACTIVE"]);
});