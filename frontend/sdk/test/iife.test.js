import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

// IIFE bundle tests (preview injection path). No jsdom / no dependencies:
// the bundle is evaluated in a vm context with a minimal window/document stub.

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "../dist");
const iifePath = path.join(distDir, "traceboard-sdk.iife.js");
const bundle = readFileSync(iifePath, "utf8");
const pkg = JSON.parse(readFileSync(path.resolve(here, "../package.json"), "utf8"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeSandbox(options = {}) {
  const clicks = [];
  const pagehide = [];
  const posts = [];
  const warnings = [];
  const sandbox = {
    console: {
      warn(message) {
        warnings.push(String(message));
      },
      log() {},
      error() {}
    },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    TextEncoder,
    Headers,
    URL,
    Math,
    Date,
    JSON,
    Promise,
    Uint8Array,
    document: {
      addEventListener(type, handler, capture) {
        if (type === "click" && capture === true) {
          clicks.push(handler);
        }
      }
    },
    location: { href: "http://127.0.0.1:8602/" },
    addEventListener(type, handler) {
      if (type === "pagehide") {
        pagehide.push(handler);
      }
    },
    fetch(input, init) {
      const url = typeof input === "string" ? input : String(input && input.url ? input.url : input);
      posts.push({ url, init });
      return Promise.resolve({ status: 202 });
    }
  };
  sandbox.window = sandbox;
  if (options.config !== undefined) {
    sandbox.__TRACEBOARD_CONFIG__ = options.config;
  }
  if (options.manifest !== undefined) {
    sandbox.__TRACEBOARD_MANIFEST__ = options.manifest;
  }
  const context = vm.createContext(sandbox);
  return { sandbox, context, clicks, pagehide, posts, warnings };
}

function run(context) {
  vm.runInContext(bundle, context, { filename: "traceboard-sdk.iife.js" });
}

function clickTarget(id) {
  return {
    tagName: "BUTTON",
    id,
    textContent: id,
    parentElement: null,
    children: [],
    getAttribute() {
      return null;
    }
  };
}

function ingestEvents(posts) {
  const events = [];
  for (const post of posts) {
    if (!String(post.url).startsWith("/ingest")) {
      continue;
    }
    const body = post.init && typeof post.init.body === "string" ? post.init.body : "";
    for (const line of body.split("\n")) {
      if (line.trim() !== "") {
        events.push(JSON.parse(line));
      }
    }
  }
  return events;
}

test("IIFE bundle: dist file exists, global name, no sourcemap, no external URLs", () => {
  assert.ok(existsSync(iifePath), "dist/traceboard-sdk.iife.js must be built");
  const distFiles = readdirSync(distDir);
  assert.ok(distFiles.includes("index.js"), "ESM bundle must coexist with the IIFE");
  assert.ok(distFiles.includes("index.d.ts"), "type declarations must coexist with the IIFE");
  assert.ok(distFiles.every((file) => !file.endsWith(".map")), "no sourcemap files in dist");

  assert.match(bundle, /var TraceBoardSDK = /, "bundle must define the TraceBoardSDK global");
  assert.ok(bundle.includes("__TRACEBOARD_CONFIG__"), "bundle must read window.__TRACEBOARD_CONFIG__");
  assert.ok(bundle.includes("__TRACEBOARD_SDK_ACTIVE__"), "bundle must contain the idempotency guard");
  assert.ok(bundle.includes("__TRACEBOARD_AUTO_INIT__"), "bundle must contain the contract guard alias");
  assert.equal(bundle.includes("sourceMappingURL"), false, "no sourceMappingURL in the IIFE");
  assert.equal(bundle.includes("https://"), false, "no remote https URLs in the IIFE");
  assert.doesNotMatch(bundle, /jsdelivr|unpkg|cdnjs/, "no CDN references in the IIFE");
  assert.doesNotMatch(bundle, /\bimport\s*\(|\brequire\s*\(/, "bundle must be self-contained (no imports)");
});

test("IIFE load: window.__TRACEBOARD_CONFIG__ auto-inits exactly once with validated options", async () => {
  const { sandbox, context, clicks, posts } = makeSandbox({
    config: {
      sessionId: "s_preview",
      ingestUrl: "/ingest",
      appName: "traceboard-preview",
      observeMs: 25
    }
  });
  run(context);

  const sdk = sandbox.TraceBoardSDK;
  assert.equal(typeof sdk, "object", "global TraceBoardSDK must exist");
  assert.equal(typeof sdk.initTraceBoard, "function");
  assert.equal(typeof sdk.wrapFn, "function");
  assert.equal(typeof sdk.uiEffect, "function");
  assert.equal(typeof sdk.elementIdentity, "function");
  assert.equal(sdk.version, pkg.version, "global version must match package.json");
  assert.equal(sdk.version, "0.1.0");

  assert.equal(clicks.length, 1, "auto-init must install exactly one click listener");
  assert.equal(sandbox.__TRACEBOARD_SDK_ACTIVE__, true, "auto-init must set the active guard");
  assert.equal(sandbox.__TRACEBOARD_AUTO_INIT__, true, "auto-init must set the contract guard alias");

  clicks[0]({ type: "click", target: clickTarget("btn-auto") });
  await sleep(120);

  const events = ingestEvents(posts);
  const root = events.find((event) => event.kind === "ui_event" && event.nodeKey === "#btn-auto");
  assert.ok(root, "auto-init must collect a click root through the configured ingest URL");
  assert.equal(root.sessionId, "s_preview");
  assert.ok(root.flags.includes("OBSERVE_MS=25"), "observeMs from the page config must be applied");
  assert.equal(clicks.length, 1);

  // Explicit init after auto-init is idempotent: same runtime, no second listener.
  const handle = sdk.initTraceBoard({ sessionId: "s_other" });
  assert.equal(clicks.length, 1);
  assert.equal(handle.diagnostics().queue, 0);
});

test("IIFE double load: the guard prevents a second init/listener", () => {
  const { sandbox, context, clicks, warnings } = makeSandbox({
    config: { sessionId: "s_preview", ingestUrl: "/ingest", appName: "traceboard-preview", observeMs: 1500 }
  });
  run(context);
  assert.equal(clicks.length, 1);
  assert.equal(sandbox.__TRACEBOARD_SDK_ACTIVE__, true);

  run(context);
  assert.equal(clicks.length, 1, "second IIFE load must not install another click listener");
  assert.equal(sandbox.__TRACEBOARD_SDK_ACTIVE__, true);
  assert.ok(
    warnings.some((message) => message.includes("already active")),
    "second load must warn instead of re-initializing"
  );
  assert.equal(typeof sandbox.TraceBoardSDK.version, "string");
});

test("IIFE without config: no auto-init; explicit init sets the guard for later loads", () => {
  const { sandbox, context, clicks } = makeSandbox();
  run(context);
  assert.equal(clicks.length, 0, "no page config must not auto-init");
  assert.notEqual(sandbox.__TRACEBOARD_SDK_ACTIVE__, true);
  assert.equal(typeof sandbox.TraceBoardSDK.initTraceBoard, "function");

  // Explicit init (same entry point the ESM demo uses) must set the guard.
  sandbox.TraceBoardSDK.initTraceBoard({ sessionId: "s_explicit", ingestUrl: "/ingest", appName: "x", observeMs: 10 });
  assert.equal(clicks.length, 1);
  assert.equal(sandbox.__TRACEBOARD_SDK_ACTIVE__, true);

  // A later IIFE load with config must not double-init.
  sandbox.__TRACEBOARD_CONFIG__ = { sessionId: "s_preview" };
  run(context);
  assert.equal(clicks.length, 1, "explicit init guard must prevent a later IIFE auto-init");
});

test("IIFE bad config: fail-open, invalid sessionId is rejected without throwing", () => {
  const { sandbox, context, clicks, warnings } = makeSandbox({
    config: { sessionId: "s3demo", ingestUrl: "/ingest", appName: "x", observeMs: -5 }
  });
  assert.doesNotThrow(() => run(context));
  assert.equal(clicks.length, 0, "invalid sessionId must not initialize the SDK");
  assert.notEqual(sandbox.__TRACEBOARD_SDK_ACTIVE__, true);
  assert.ok(
    warnings.some((message) => message.includes("invalid sessionId")),
    "invalid sessionId must be reported as a warning"
  );
  assert.equal(typeof sandbox.TraceBoardSDK, "object");
});

test("IIFE inline manifest: data-tb-fn click and wrapFn get source; no JSON fallback", async () => {
  const manifest = {
    functions: [
      { name: "previewDiscount", file: "src/App.vue", line: 120 },
      { name: "validateForm", file: "src/App.vue", line: 86 }
    ]
  };
  const { sandbox, context, clicks, posts } = makeSandbox({
    config: { sessionId: "s_preview", ingestUrl: "/ingest", appName: "app", observeMs: 20 },
    manifest
  });
  run(context);

  assert.equal(clicks.length, 1);
  const target = {
    tagName: "BUTTON",
    id: "btn-discount",
    textContent: "折扣",
    parentElement: null,
    children: [],
    getAttribute(name) {
      return name === "data-tb-fn" ? "previewDiscount" : null;
    }
  };
  clicks[0]({ type: "click", target });
  sandbox.TraceBoardSDK.wrapFn("validateForm", () => true)();
  await sleep(120);

  const events = ingestEvents(posts);
  const root = events.find((event) => event.kind === "ui_event");
  assert.ok(root);
  assert.deepEqual(JSON.parse(JSON.stringify(root.source)), { file: "src/App.vue", line: 120 });
  assert.ok(root.flags.includes("SOURCE_MAPPED"));

  const js = events.find((event) => event.kind === "js_method");
  assert.ok(js);
  assert.deepEqual(JSON.parse(JSON.stringify(js.source)), { file: "src/App.vue", line: 86 });
  assert.ok(js.flags.includes("SOURCE_MAPPED"));

  assert.equal(
    posts.some((post) => String(post.url).includes("traceboard-manifest.json")),
    false,
    "the IIFE/preview build must never fetch the manifest fallback"
  );
});
