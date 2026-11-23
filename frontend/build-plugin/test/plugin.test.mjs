import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import traceboardManifest, { scanFunctions, traceboardShallow } from "../index.mjs";

const pluginSource = readFileSync(new URL("../index.mjs", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function makeProject(files) {
  const root = mkdtempSync(path.join(tmpdir(), "traceboard-plugin-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return root;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

function lineOf(source, needle) {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  assert.notEqual(index, -1, `fixture line not found: ${needle}`);
  return index + 1;
}

const APP_VUE = `<script setup lang="ts">
import { traceboard } from "./traceboard";

// Case A: plain declaration (R1)
async function cancelOrder(): Promise<void> {
  await traceboard.uiEffect("done");
}

function rawValidateForm(): boolean {
  return true;
}

// Case B: wrapFn constant (R2)
const validateForm = traceboard.wrapFn("validateForm", rawValidateForm);

// Case L1: declaration wrapped at the call site under another name
async function previewDiscount(): Promise<void> {
  await fetch("/api/orders/1/preview-discount");
}

const previewDiscountWrapped = traceboard.wrapFn("previewDiscount", previewDiscount);

// Not scanned: export default / arrows / class methods / differently-named wrapFn
export default function ignoredDefault(): void {}
const arrow = () => true;
const otherName = traceboard.wrapFn("someOtherName", arrow);
</script>

<template>
  <button id="btn-discount" @click="previewDiscountWrapped">折扣</button>
</template>
`;

const UTIL_TS = `export function helper(value: number): number {
  return value + 1;
}

export async function loadData(): Promise<void> {
  await Promise.resolve();
}

// duplicate name: must be ignored (App.vue sorts first)
function cancelOrder(): void {}

const saveOrder = traceboard.wrapFn("saveOrder", helper);
`;

const FILES = {
  "src/App.vue": APP_VUE,
  "src/nested/util.ts": UTIL_TS,
  "src/nested/notes.md": "function markdownIsNotScanned() {}\n"
};

function waitFor(predicate, timeoutMs = 2000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("timeout waiting for dev middleware response"));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) {
        this.body += String(chunk);
      }
    }
  };
}

function installDevMiddleware(plugin, root) {
  let handler = null;
  const warnings = [];
  const config = {
    root,
    logger: {
      warn: (message) => warnings.push(String(message))
    }
  };
  plugin.configResolved(config);
  plugin.configureServer({
    config,
    middlewares: {
      use(fn) {
        handler = fn;
      }
    }
  });
  assert.equal(typeof handler, "function", "configureServer must register a middleware");
  return { handler, warnings };
}

function hooksContext() {
  const warnings = [];
  const emitted = [];
  return {
    warnings,
    emitted,
    ctx: {
      warn: (message) => warnings.push(String(message)),
      emitFile: (asset) => emitted.push(asset)
    }
  };
}

test("exports: default factory equals named alias, zero dependencies, plugin hooks", () => {
  assert.equal(typeof traceboardManifest, "function");
  assert.equal(typeof traceboardShallow, "function");
  assert.equal(traceboardShallow, traceboardManifest);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.private, true);
  assert.equal(pkg.dependencies, undefined, "the plugin must stay dependency-free");
  assert.equal(pkg.devDependencies, undefined, "the plugin must stay dependency-free");

  const plugin = traceboardManifest();
  assert.equal(plugin.name, "traceboard-shallow");
  assert.equal(typeof plugin.configResolved, "function");
  assert.equal(typeof plugin.configureServer, "function");
  assert.equal(typeof plugin.transformIndexHtml, "function");
  assert.equal(typeof plugin.generateBundle, "function");

  const imports = [...pluginSource.matchAll(/^import\s[^;]*?from\s+"([^"]+)"/gm)].map((match) => match[1]);
  assert.ok(imports.length >= 2, "index.mjs must import node builtins");
  assert.ok(
    imports.every((specifier) => specifier.startsWith("node:")),
    `index.mjs must only import node builtins, got ${imports.join(", ")}`
  );
});

test("scan: R1/R2 declarations, 1-based .vue whole-file lines, sorting, duplicate warn", async () => {
  const root = makeProject(FILES);
  try {
    const warnings = [];
    const manifest = await scanFunctions({ root, warn: (message) => warnings.push(message) });
    assert.deepEqual(Object.keys(manifest), ["functions"]);

    const byName = new Map(manifest.functions.map((entry) => [entry.name, entry]));
    assert.deepEqual(
      [...byName.keys()].sort(),
      ["cancelOrder", "helper", "loadData", "previewDiscount", "rawValidateForm", "saveOrder", "validateForm"]
    );

    assert.deepEqual(byName.get("cancelOrder"), {
      name: "cancelOrder",
      file: "src/App.vue",
      line: lineOf(APP_VUE, "async function cancelOrder(")
    });
    assert.deepEqual(byName.get("validateForm"), {
      name: "validateForm",
      file: "src/App.vue",
      line: lineOf(APP_VUE, 'const validateForm = traceboard.wrapFn("validateForm"')
    });
    assert.deepEqual(byName.get("previewDiscount"), {
      name: "previewDiscount",
      file: "src/App.vue",
      line: lineOf(APP_VUE, "async function previewDiscount(")
    });
    assert.equal(byName.get("loadData").file, "src/nested/util.ts");
    assert.equal(byName.get("loadData").line, lineOf(UTIL_TS, "export async function loadData("));

    // `.vue` line numbers are whole-file (the declaration is after `<template>` only when it is).
    assert.ok(byName.get("previewDiscount").line > 15, "line must be the physical file line");
    assert.equal(
      APP_VUE.split(/\r?\n/)[byName.get("previewDiscount").line - 1].includes("function previewDiscount"),
      true
    );

    // Sorted by file, line, name.
    const sorted = [...manifest.functions].sort((a, b) =>
      a.file !== b.file
        ? a.file < b.file
          ? -1
          : 1
        : a.line !== b.line
          ? a.line - b.line
          : a.name < b.name
            ? -1
            : a.name > b.name
              ? 1
              : 0
    );
    assert.deepEqual(manifest.functions, sorted);

    assert.equal(
      manifest.functions.some((entry) => entry.name === "markdownIsNotScanned"),
      false,
      "only .vue/.ts are scanned"
    );
    assert.equal(manifest.functions.some((entry) => entry.name === "ignoredDefault"), false);
    assert.equal(manifest.functions.some((entry) => entry.name === "arrow"), false);
    assert.equal(manifest.functions.some((entry) => entry.name === "someOtherName"), false);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /duplicate function "cancelOrder"/);
    assert.match(warnings[0], /src\/nested\/util\.ts:10/);
  } finally {
    cleanup(root);
  }
});

test("scan: custom include roots, empty directory, missing directory", async () => {
  const root = makeProject({
    "app/main.ts": "export function fromApp(): void {}\n",
    "src/ignored.ts": "export function fromSrc(): void {}\n"
  });
  try {
    const manifest = await scanFunctions({ root, include: ["app/**/*.ts"] });
    assert.deepEqual(manifest.functions, [{ name: "fromApp", file: "app/main.ts", line: 1 }]);
  } finally {
    cleanup(root);
  }

  const emptyRoot = makeProject({ "README.md": "# empty\n" });
  try {
    const manifest = await scanFunctions({ root: emptyRoot });
    assert.deepEqual(manifest, { functions: [] });
  } finally {
    cleanup(emptyRoot);
  }
});

test("dev middleware: GET 200 JSON no-store, 405 non-GET, pass-through other paths, 500 on scan error", async () => {
  const root = makeProject(FILES);
  try {
    const plugin = traceboardManifest();
    const { handler } = installDevMiddleware(plugin, root);

    const getRes = fakeRes();
    let nextCalls = 0;
    handler({ method: "GET", url: "/traceboard-manifest.json" }, getRes, () => {
      nextCalls += 1;
    });
    await waitFor(() => getRes.body !== "");
    assert.equal(nextCalls, 0);
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.headers["content-type"], "application/json; charset=utf-8");
    assert.equal(getRes.headers["cache-control"], "no-store");
    const body = JSON.parse(getRes.body);
    assert.ok(body.functions.some((entry) => entry.name === "previewDiscount"));

    const postRes = fakeRes();
    handler({ method: "POST", url: "/traceboard-manifest.json" }, postRes, () => {
      nextCalls += 1;
    });
    assert.equal(postRes.statusCode, 405);
    assert.equal(nextCalls, 0);
    assert.equal(JSON.parse(postRes.body).error, "method_not_allowed");

    const otherRes = fakeRes();
    handler({ method: "GET", url: "/index.html" }, otherRes, () => {
      nextCalls += 1;
    });
    assert.equal(nextCalls, 1);
    assert.equal(otherRes.statusCode, 0);

    // A file where the scan root should be a directory: the middleware reports 500, no throw.
    const brokenRoot = makeProject({ src: "not a directory" });
    try {
      const brokenPlugin = traceboardManifest();
      const broken = installDevMiddleware(brokenPlugin, brokenRoot);
      const brokenRes = fakeRes();
      broken.handler({ method: "GET", url: "/traceboard-manifest.json" }, brokenRes, () => {});
      await waitFor(() => brokenRes.body !== "");
      assert.equal(brokenRes.statusCode, 500);
      const payload = JSON.parse(brokenRes.body);
      assert.equal(payload.error, "manifest_scan_failed");
      assert.ok(typeof payload.message === "string" && payload.message.length <= 200);
    } finally {
      cleanup(brokenRoot);
    }
  } finally {
    cleanup(root);
  }
});

test("build: transformIndexHtml inlines manifest, generateBundle emits the same asset", async () => {
  const root = makeProject(FILES);
  try {
    const plugin = traceboardManifest();
    plugin.configResolved({ root });
    const { ctx, emitted, warnings } = hooksContext();

    const tags = await plugin.transformIndexHtml.call(ctx, "<html></html>");
    assert.equal(tags.length, 1);
    assert.equal(tags[0].tag, "script");
    assert.equal(tags[0].injectTo, "head-prepend");
    const prefix = "window.__TRACEBOARD_MANIFEST__ = ";
    assert.ok(tags[0].children.startsWith(prefix));
    assert.ok(tags[0].children.endsWith(";"));
    const inline = JSON.parse(tags[0].children.slice(prefix.length, -1));
    assert.ok(inline.functions.some((entry) => entry.name === "validateForm"));
    assert.ok(inline.functions.some((entry) => entry.name === "previewDiscount"));

    await plugin.generateBundle.call(ctx, {}, {});
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].type, "asset");
    assert.equal(emitted[0].fileName, "traceboard-manifest.json");
    assert.ok(emitted[0].source.endsWith("\n"));
    const asset = JSON.parse(emitted[0].source);
    assert.deepEqual(asset, inline);
    assert.equal(warnings.length, 2, "duplicate-name warning is expected once per scan");
  } finally {
    cleanup(root);
  }
});

test("build: scan errors only warn (never break the build)", async () => {
  const root = makeProject({ src: "not a directory" });
  try {
    const plugin = traceboardManifest();
    plugin.configResolved({ root });
    const { ctx, emitted, warnings } = hooksContext();

    const tags = await plugin.transformIndexHtml.call(ctx, "<html></html>");
    assert.deepEqual(tags, []);
    await plugin.generateBundle.call(ctx, {}, {});
    assert.deepEqual(emitted, []);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /traceboard-shallow/);
  } finally {
    cleanup(root);
  }
});