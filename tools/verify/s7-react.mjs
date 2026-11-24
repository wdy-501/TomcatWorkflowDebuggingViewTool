#!/usr/bin/env node
/**
 * S7 React18/Webpack5 basic second-stack gate.
 *
 * Groups:
 *   S7-A artifact/build-static (React version, webpack config, no maps/manifest, lockfile)
 *   S7-B demo/static contract (selectors, texts, SDK wiring, zero backend diff)
 *   S7-C proxy/EXACT E2E (collector + Boot/JDK8 agent + WDS 5175; 4 backend spans, SQL 0 row)
 *   S7-D serving/workbench (dev serving, proxy API, manifest 404, workbench artifacts)
 *   S7-E scope/freeze/cleanup (frozen paths, no Tomcat/cloud, ports free)
 *
 * Usage: node s7-react.mjs [--no-e2e]
 * Exit 0 only when every enabled check passes and the final line is
 * `S7 TEST (React18/Webpack5): PASS`.
 */
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const REACT = path.join(REPO, "demo/buggy-shop-boot-react/frontend");
const SDK_DIST = path.join(REPO, "frontend/sdk/dist/index.js");
const J21 = process.env.JAVA21 || "C:/Program Files/Java/jdk-21";
const J8 = process.env.JAVA8 || "C:/Program Files/Java/jdk1.8.0_221";
const JAVA = process.platform === "win32" ? "java.exe" : "java";
const COLLECTOR = path.join(REPO, "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar");
const AGENT = path.join(REPO, "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar");
const DEMO = path.join(REPO, "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar");
const SESSION = "s_s7react";
const PORTS = [8080, 8601, 5175];
const NO_E2E = process.argv.includes("--no-e2e");
let pass = 0;
let fail = 0;
const failures = [];

function ok(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function read(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (free) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(400);
    socket.once("connect", () => done(false));
    socket.once("timeout", () => done(true));
    socket.once("error", () => done(true));
  });
}

async function waitFree(port, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await portFree(port)) return true;
    await sleep(300);
  }
  return false;
}

async function waitHttp(url, timeoutMs, label) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.status === 200) return response;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  throw new Error(`${label} not ready: ${url}`);
}

async function http(method, url, options = {}) {
  try {
    const response = await fetch(url, {
      method,
      headers: options.headers,
      body: options.body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
    });
    return { status: response.status, text: await response.text() };
  } catch {
    return null;
  }
}

function start(label, exe, args, cwd, log) {
  const fd = openSync(log, "a");
  const child = spawn(exe, args, {
    cwd,
    windowsHide: true,
    shell: process.platform === "win32" && /\.cmd$/i.test(exe),
    stdio: ["ignore", fd, fd],
  });
  const state = { label, child, fd, exited: false };
  child.on("exit", () => {
    state.exited = true;
  });
  return state;
}

async function stop(state) {
  if (!state) return;
  if (state.child?.pid && !state.exited) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(state.child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      state.child.kill("SIGKILL");
    }
  }
  await new Promise((resolve) => {
    if (!state.child || state.exited) resolve();
    else {
      state.child.once("exit", resolve);
      setTimeout(resolve, 4000);
    }
  });
  try {
    closeSync(state.fd);
  } catch {
    /* closed */
  }
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walkFiles(file, out);
    else out.push(file);
  }
  return out;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: REPO, encoding: "utf8", windowsHide: true });
  return (result.stdout ?? "").trim();
}

function staticChecks() {
  const pkg = JSON.parse(read(path.join(REACT, "package.json")) || "{}");
  const webpack = read(path.join(REACT, "webpack.config.js"));
  const source = read(path.join(REACT, "src/OrderEdit.jsx"));
  const traceboard = read(path.join(REACT, "src/traceboard.js"));
  const bundle = read(path.join(REACT, "dist/app.js"));
  const lock = read(path.join(REACT, "package-lock.json"));
  const indexHtml = read(path.join(REACT, "public/index.html"));

  ok("S7-A1 React18.3.1/react-dom/webpack5 pinned", pkg.dependencies?.["react"] === "18.3.1" && pkg.dependencies?.["react-dom"] === "18.3.1" && /"webpack"\s*:\s*"\^?5\./.test(JSON.stringify(pkg.devDependencies ?? {})), JSON.stringify({ react: pkg.dependencies?.react, webpack: pkg.devDependencies?.webpack }));
  ok("S7-A2 sdk local file dependency", String(pkg.dependencies?.["@traceboard/sdk"] ?? "").startsWith("file:") && existsSync(SDK_DIST), pkg.dependencies?.["@traceboard/sdk"] ?? "missing");
  ok("S7-A3 webpack devtool false + 5175 + host + proxies", /devtool\s*:\s*false/.test(webpack) && /port\s*:\s*5175/.test(webpack) && /host\s*:\s*["']127\.0\.0\.1["']/.test(webpack) && /\/api/.test(webpack) && /\/ingest/.test(webpack) && /target\s*:\s*["']http:\/\/127\.0\.0\.1:8080["']/.test(webpack) && /target\s*:\s*["']http:\/\/127\.0\.0\.1:8601["']/.test(webpack) && /changeOrigin\s*:\s*false/.test(webpack), "");
  ok("S7-A4 no dist .map/manifest; local html bundle only", existsSync(path.join(REACT, "dist/app.js")) && existsSync(path.join(REACT, "dist/index.html")) && walkFiles(path.join(REACT, "dist")).every((f) => !/\.map$|manifest/i.test(f)) && /src="app\.js"/.test(read(path.join(REACT, "dist/index.html"))) && !/https?:\/\//.test(JSON.stringify(indexHtml).replace(/"http:\/\/www\.w3\.org[^"]*"/g, "")), "");
  const resolved = Object.values(JSON.parse(lock).packages ?? {}).map((item) => item?.resolved).filter(Boolean);
  ok("S7-A5 lockfile npmjs + local SDK only", resolved.every((url) => url === "../../../frontend/sdk" || url.startsWith("https://registry.npmjs.org/")), `resolved=${resolved.length}`);
  ok("S7-A6 bundle carries S7 selectors/texts/SDK", ["s_s7react", "OrderEdit.jsx", "#btn-cancel", "#order-status", "#success-hint", "#amount-b", "#btn-save-b", "#b-error", "#b-pass", "操作成功", "金额必须大于 0", "SDK_ACTIVE", "OBSERVE_MS"].every((token) => bundle.includes(token)), `bytes=${bundle.length}`);
  ok("S7-A7 no TraceBoard build-plugin/manifest injection", !/traceboardShallow|traceboard-manifest\.json"\s*:\s*\{/.test(bundle) && !existsSync(path.join(REACT, "traceboard.manifest.json")), "");

  ok("S7-B1 single SDK init with s_s7react/OrderEdit.jsx//ingest", (traceboard.match(/initTraceBoard\(/g) ?? []).length === 1 && /sessionId:\s*"s_s7react"/.test(traceboard) && /appName:\s*"OrderEdit\.jsx"/.test(traceboard) && /ingestUrl:\s*"\/ingest"/.test(traceboard), "");
  ok("S7-B2 validateForm wrapped once at module scope", /const validateForm\s*=\s*wrapFn\("validateForm"/.test(source) && (source.match(/wrapFn\("validateForm"/g) ?? []).length === 1 && !/validateForm\s*=\s*wrapFn/.test(source.replace("const validateForm = wrapFn(\"validateForm\"", "")), "");
  ok("S7-B3 case A selectors/texts/POST/no-refresh", ["btn-cancel", "order-status", "success-hint", "操作成功", "/api/orders/1/cancel"].every((token) => source.includes(token)) && !/loadInitialOrderStatus|fetch\("\/api\/orders"\)/.test(source.split("async function cancelOrder")[1] ?? ""), "");
  ok("S7-B4 case B selectors/texts/data-tb-fn/no network in validation", ["amount-b", "btn-save-b", "b-error", "b-pass", "金额必须大于 0", "校验通过（本案例不提交）", 'data-tb-fn="validateForm"'].every((token) => source.includes(token)) && !/fetch\(|XMLHttpRequest/.test(source.slice(source.indexOf("function rawValidateForm"), source.indexOf("const validateForm"))), "");
  ok("S7-B5 initial GET is real runtime read, not hardcoded CREATED", /fetch\("\/api\/orders"\)/.test(source) && !/useState\("CREATED"\)/.test(source), "");
  ok("S7-B6 no direct 8601 runtime access from React", !/(?:https?:\/\/[^"'\s]*:8601|fetch\([^)]*8601)/.test(source + traceboard + indexHtml), "comments/proxy config excluded");
  const backendDiff = git(["status", "--porcelain", "--", "demo/buggy-shop-boot-vue/backend"]);
  const frozenDiff = git(["status", "--porcelain", "--", "frontend/sdk", "agent", "server/collector", "workbench/src", "schema", "fixtures"]);
  ok("S7-B7 backend/vue-demo/SDK/agent/collector/workbench unchanged", backendDiff === "" && git(["status", "--porcelain", "--", "demo/buggy-shop-boot-vue/frontend"]).trim() === "" && frozenDiff === "", backendDiff || "clean");
  ok("S7-B8 no Tomcat/WAR/cloud work", !existsSync(path.join(REPO, "demo/buggy-shop-boot-tomcat")) && !/tomcat|war\//i.test(webpack), "");
}

function workbenchChecks() {
  const html = read(path.join(REPO, "workbench/dist/index.html"));
  const source = read(path.join(REPO, "workbench/src/components/S3Panel.vue"));
  ok("S7-D1 workbench build exists", html.length > 0 && /<div id="app">/.test(html), "");
  ok("S7-D2 workbench S3 selectors unchanged", /s3-session/.test(source) && /fetchCount/.test(source) && /已确认/.test(source), "");
}

async function e2eChecks(tmp) {
  for (const port of PORTS) {
    if (!(await portFree(port))) throw new Error(`port ${port} already in use`);
  }
  if (![COLLECTOR, AGENT, DEMO].every(existsSync)) throw new Error("collector/agent/demo jar missing");
  let collector = null;
  let backend = null;
  let react = null;
  try {
    collector = start("collector", path.join(J21, "bin", JAVA), ["-jar", COLLECTOR], REPO, path.join(tmp, "collector.log"));
    await waitHttp("http://127.0.0.1:8601/actuator/health", 90000, "collector");
    ok("S7-C1 collector healthy 8601", true, "");
    backend = start("backend", path.join(J8, "bin", JAVA), [
      `-javaagent:${AGENT}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      `-Dtraceboard.sessionId=${SESSION}`,
      "-Dserver.port=8080",
      "-jar",
      DEMO,
    ], path.join(REPO, "demo/buggy-shop-boot-vue/backend"), path.join(tmp, "backend.log"));
    await waitHttp("http://127.0.0.1:8080/api/orders", 90000, "backend");
    react = start("react", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], REACT, path.join(tmp, "react.log"));
    await waitHttp("http://127.0.0.1:5175/", 90000, "react dev");
    ok("S7-C2 React dev 5175 serving", true, "");
    const page = await http("GET", "http://127.0.0.1:5175/");
    ok("S7-C3 page has #root and local app.js", page?.status === 200 && /id="root"/.test(page.text) && /src="app\.js"/.test(page.text), "");
    const api = await http("GET", "http://127.0.0.1:5175/api/orders");
    ok("S7-C4 /api proxy returns order CREATED", api?.status === 200 && /"id":1/.test(api.text) && /"status":"CREATED"/.test(api.text), "");
    const traceId = "a".repeat(32);
    const spanId = "b".repeat(16);
    const clickId = `click_${"c".repeat(16)}`;
    const cancelled = await http("POST", "http://127.0.0.1:5175/api/orders/1/cancel", {
      headers: { traceparent: `00-${traceId}-${spanId}-01`, "X-TraceBoard-Click": clickId },
    });
    ok("S7-C5 cancel via 5175 proxy returns 200", cancelled?.status === 200, `status=${cancelled?.status}`);
    let spans = [];
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      const events = await http("GET", `http://127.0.0.1:8601/api/v1/sessions/${SESSION}/events?afterSeq=0&limit=500`);
      if (events?.status === 200) {
        const parsed = JSON.parse(events.text);
        spans = (parsed.events ?? []).map((item) => item.event).filter((event) => event.traceId === traceId);
        if (spans.length >= 4) break;
      }
      await sleep(500);
    }
    const kinds = new Set(spans.map((event) => event.kind));
    ok("S7-C6 4 backend spans controller/service/mapper/sql all EXACT", spans.length === 4 && ["controller", "service", "mapper", "sql"].every((kind) => kinds.has(kind)) && spans.every((event) => event.confidence === "EXACT"), kinds.size ? [...kinds].join(",") : "none");
    const controller = spans.find((event) => event.kind === "controller");
    ok("S7-C7 controller.parent = fetch traceparent span", controller?.parentSpanId === spanId && controller?.rootEventId === clickId, controller?.parentSpanId ?? "missing");
    const sql = spans.find((event) => event.kind === "sql");
    ok("S7-C8 SQL rowsAffected=0 and order still CREATED", sql?.sideEffects?.some((effect) => effect.rowsAffected === 0) && /"status":"CREATED"/.test((await http("GET", "http://127.0.0.1:5175/api/orders"))?.text ?? ""), "");
    ok("S7-C9 manifest probe 404 on dev server", (await http("GET", "http://127.0.0.1:5175/traceboard-manifest.json"))?.status === 404, "");
    const fixtureDir = readdirSync(path.join(REPO, "fixtures/s3-frontend-facts"))
      .map((name) => path.join(REPO, "fixtures/s3-frontend-facts", name))
      .find((file) => /case-b|frontend-only/i.test(path.basename(file)) && statSync(file).isDirectory());
    const fixture = fixtureDir ? path.join(fixtureDir, "events.ndjson") : null;
    let ingestStatus = null;
    if (fixture && existsSync(fixture)) {
      const line = read(fixture).split(/\r?\n/).find(Boolean);
      if (line && JSON.parse(line).sessionId) {
        ingestStatus = (await http("POST", "http://127.0.0.1:5175/ingest/v1/events", {
          headers: { "content-type": "application/x-ndjson" },
          body: `${line}\n`,
        }))?.status;
      }
    }
    ok("S7-C10 /ingest proxy accepts NDJSON (202)", ingestStatus === 202, `status=${ingestStatus}`);
    workbenchChecks();
    await stop(collector);
    collector = null;
    const failOpenStart = Date.now();
    const failOpen = await http("POST", "http://127.0.0.1:5175/api/orders/1/cancel", { timeoutMs: 20000 });
    ok("S7-C11 collector down -> cancel still 2xx (fail-open)", failOpen?.status === 200, `status=${failOpen?.status} in ${Date.now() - failOpenStart}ms`);
  } finally {
    await stop(react);
    await stop(backend);
    await stop(collector);
    for (const port of PORTS) await waitFree(port, 30000);
  }
}

function scopeChecks() {
  const status = git(["status", "--porcelain"]);
  const unexpected = status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(2).trim())
    .filter((file) => {
      return !(
        file === "README.md" ||
        file === "docs/contracts/api.v1.md" ||
        file.startsWith("demo/buggy-shop-boot-react/") ||
        file.startsWith("docs/plans/stages/S7/") ||
        file.startsWith("tools/verify/s7-react.mjs") ||
        file.startsWith("docs/plans/archive/stage-S7-") ||
        file.startsWith("docs/plans/STAGE-PROGRESS.md")
      );
    });
  ok("S7-E1 git changes limited to S7 paths", unexpected.length === 0, unexpected.slice(0, 5).join(",") || "only S7");
  const forbidden = git(["status", "--porcelain", "--", "schema", "frontend/sdk", "agent", "server/collector", "workbench/src", "demo/buggy-shop-boot-vue"]);
  ok("S7-E2 frozen S0–S6 surfaces unchanged", forbidden === "", forbidden || "clean");
  const tags = git(["tag", "--list"]).split(/\r?\n/).filter(Boolean);
  ok("S7-E3 no s6a/s6b interim tags", !tags.some((tag) => /^s6[ab]$/i.test(tag)), tags.slice(-4).join(","));
  ok("S7-E4 no S10+ dirs/docs (S8/S9 docs allowed)", !existsSync(path.join(REPO, "docs/plans/stages/S10")), "");
}

async function main() {
  console.log("S7 React18/Webpack5 basic gate" + (NO_E2E ? " (static only)" : ""));
  staticChecks();
  if (!NO_E2E) {
    const tmp = mkdtempSync(path.join(tmpdir(), "traceboard-s7-"));
    try {
      await e2eChecks(tmp);
    } catch (error) {
      ok("S7-C0 E2E setup", false, error instanceof Error ? error.message : String(error));
    } finally {
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    for (const port of PORTS) {
      ok(`S7-E5 port ${port} free after cleanup`, await waitFree(port, 10000), "");
    }
  } else {
    workbenchChecks();
  }
  scopeChecks();
  console.log(`S7 SUMMARY: ${pass} PASS / ${fail} FAIL`);
  const verdict = fail === 0 ? "PASS" : "FAIL";
  console.log(`S7 TEST (React18/Webpack5): ${verdict}`);
  if (fail > 0) console.log(`S7 FAILURES: ${failures.join(" | ")}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`S7 FATAL: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});