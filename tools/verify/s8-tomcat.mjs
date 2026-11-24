#!/usr/bin/env node
/**
 * S8 Tomcat 8.5 + SSM WAR gate.
 * Static + build + isolated CATALINA_BASE + collector + agent 4-span + cleanup.
 * Usage: node s8-tomcat.mjs [--no-e2e]
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WAR_DIR = path.join(REPO, "demo/buggy-shop-ssm-war");
const WAR = path.join(WAR_DIR, "target/traceboard-ssm.war");
const TOMCAT = "D:/apache-tomcat-8.5.60/apache-tomcat-8.5.60";
const J8 = process.env.JAVA8 || "C:/Program Files/Java/jdk1.8.0_221";
const J21 = process.env.JAVA21 || "C:/Program Files/Java/jdk-21";
const JAVA = process.platform === "win32" ? "java.exe" : "java";
const AGENT = path.join(REPO, "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar");
const COLLECTOR = path.join(REPO, "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar");
const BASE = path.join(REPO, "work/s8-gate-tomcat");
const PORTS = [8081, 8601];
let pass = 0;
let fail = 0;
const failures = [];
const NO_E2E = process.argv.includes("--no-e2e");

const ok = (label, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`); }
  else { fail += 1; failures.push(label); console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`); }
};
const read = (rel) => { try { return readFileSync(path.join(REPO, rel), "utf8"); } catch { return ""; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port });
    const done = (free) => { s.removeAllListeners(); s.destroy(); resolve(free); };
    s.setTimeout(400);
    s.once("connect", () => done(false));
    s.once("timeout", () => done(true));
    s.once("error", () => done(true));
  });
}
async function waitFree(port, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await portFree(port)) return true; await sleep(300); }
  return false;
}
async function http(method, url, options = {}) {
  try {
    const r = await fetch(url, { method, headers: options.headers, body: options.body, signal: AbortSignal.timeout(options.timeoutMs ?? 15000) });
    return { status: r.status, text: await r.text() };
  } catch { return null; }
}
async function waitHttp(url, timeout, label) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const r = await http("GET", url);
    if (r?.status === 200) return r;
    await sleep(500);
  }
  throw new Error(`${label} not ready: ${url}`);
}

const procs = [];
function start(label, exe, args, cwd, log) {
  const out = log;
  const child = spawn(exe, args, { cwd, windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
  const state = { label, child, exited: false };
  child.on("exit", () => { state.exited = true; });
  void out;
  return state;
}
async function stop(state) {
  if (!state) return;
  if (state.child?.pid && !state.exited) {
    spawnSync("taskkill", ["/PID", String(state.child.pid), "/T", "/F"], { windowsHide: true });
  }
  await new Promise((r) => { if (!state.child || state.exited) r(); else { state.child.once("exit", r); setTimeout(r, 4000); } });
}

function staticChecks() {
  const pom = read("demo/buggy-shop-ssm-war/pom.xml");
  const page = read("demo/buggy-shop-ssm-war/src/main/webapp/index.html");
  const mapper = read("demo/buggy-shop-ssm-war/src/main/resources/mapper/OrderMapper.xml");
  const matrix = read("docs/plans/stages/S8/matrix.md");
  const agentDiff = spawnSync("git", ["status", "--porcelain", "--", "agent", "server/collector", "frontend/sdk", "workbench/src"], { cwd: REPO, encoding: "utf8" }).stdout.trim();
  ok("S8-A1 WAR/SSM dependencies pinned", /<packaging>war<\/packaging>/.test(pom) && /spring-webmvc/.test(pom) && /mybatis-spring/.test(pom) && /h2/.test(pom), "");
  ok("S8-A2 same FQCN controller/service/mapper", existsSync(path.join(WAR_DIR, "src/main/java/com/example/shop/controller/OrderController.java")) && read("demo/buggy-shop-ssm-war/src/main/java/com/example/shop/controller/OrderController.java").includes("@RestController"), "");
  ok("S8-A3 0-row defect + seed CREATED", /status = 'PAID'/.test(mapper) && /CREATED/.test(read("demo/buggy-shop-ssm-war/src/main/resources/data.sql")), "");
  ok("S8-A4 page selectors/API/no B fetch", ["btn-cancel", "order-status", "success-hint", "amount-b", "btn-save-b", "b-error", "b-pass", 'data-tb-fn="validateForm"'].every((x) => page.includes(x)) && page.includes('var API = "/api/orders"') && !/fetch\([^)]*validateForm/.test(page), "");
  ok("S8-A5 matrix has 3 local stacks + cloud unsupported", /Boot/.test(matrix) && /React/.test(matrix) && /Tomcat/.test(matrix) && /云端/.test(matrix) && /未做/.test(matrix), "");
  ok("S8-A6 frozen surfaces unchanged", agentDiff === "", agentDiff || "agent/collector/SDK/workbench clean");
}
function build() {
  const env = { ...process.env, JAVA_HOME: J8 };
  const r = spawnSync("mvn", ["-B", "-q", "-DskipTests", "package"], { cwd: WAR_DIR, env, encoding: "utf8", shell: process.platform === "win32" });
  ok("S8-B1 WAR build exit 0", r.status === 0 && existsSync(WAR), r.status === 0 ? `${Math.round(statSync(WAR).size / 1024)} KiB` : (r.stderr || "").slice(-120));
}
async function e2e() {
  for (const port of PORTS) if (!(await portFree(port))) throw new Error(`port ${port} busy`);
  if (!existsSync(AGENT) || !existsSync(COLLECTOR)) throw new Error("agent/collector jar missing");
  if (!existsSync(path.join(TOMCAT, "bin/bootstrap.jar"))) throw new Error("Tomcat 8.5 not found");
  rmSync(BASE, { recursive: true, force: true });
  mkdirSync(path.join(BASE, "logs"), { recursive: true });
  mkdirSync(path.join(BASE, "temp"), { recursive: true });
  mkdirSync(path.join(BASE, "work"), { recursive: true });
  mkdirSync(path.join(BASE, "webapps"), { recursive: true });
  mkdirSync(path.join(BASE, "conf/Catalina/localhost"), { recursive: true });
  for (const name of ["server.xml", "web.xml", "context.xml", "tomcat-users.xml", "catalina.properties", "logging.properties", "jaspic-providers.xml", "jaspic-providers.xsd"]) {
    copyFileSync(path.join(TOMCAT, "conf", name), path.join(BASE, "conf", name));
  }
  const serverXml = path.join(BASE, "conf/server.xml");
  const xml = readFileSync(serverXml, "utf8").replace('port="8006"', 'port="8017"');
  writeFileSync(serverXml, xml);
  copyFileSync(WAR, path.join(BASE, "webapps/ROOT.war"));
  let collector = null;
  let tomcat = null;
  try {
    collector = start("collector", path.join(J21, "bin", JAVA), ["-jar", COLLECTOR], REPO, "");
    procs.push(collector);
    await waitHttp("http://127.0.0.1:8601/actuator/health", 90000, "collector");
    ok("S8-B2 collector healthy", true, "8601");
    tomcat = start("tomcat", path.join(J8, "bin", JAVA), [
      `-javaagent:${AGENT}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      "-Dtraceboard.sessionId=s_s8tomcat",
      "-Dfile.encoding=UTF-8",
      "-Djava.util.logging.manager=java.util.logging.LogManager",
      `-Dcatalina.home=${TOMCAT}`,
      `-Dcatalina.base=${BASE}`,
      `-Djava.io.tmpdir=${path.join(BASE, "temp")}`,
      "-classpath", `${path.join(TOMCAT, "bin/bootstrap.jar")};${path.join(TOMCAT, "bin/tomcat-juli.jar")}`,
      "org.apache.catalina.startup.Bootstrap", "start",
    ], REPO, "");
    procs.push(tomcat);
    await waitHttp("http://127.0.0.1:8081/api/orders", 90000, "Tomcat WAR");
    ok("S8-B3 WAR serves /api/orders CREATED", (await http("GET", "http://127.0.0.1:8081/api/orders"))?.text.includes('"status":"CREATED"'), "8081");
    const hello = await http("GET", "http://127.0.0.1:8601/api/v1/sessions/s_s8tomcat/agent");
    ok("S8-B4 agent hello connected s_s8tomcat", hello?.status === 200 && /"connected":true/.test(hello.text), hello?.text?.slice(0, 60) ?? "missing");
    const trace = "e".repeat(32);
    const span = "f".repeat(16);
    const click = "click_s8gate_0001";
    const res = await http("POST", "http://127.0.0.1:8081/api/orders/1/cancel", { headers: { traceparent: `00-${trace}-${span}-01`, "X-TraceBoard-Click": click } });
    ok("S8-C1 cancel returns 200", res?.status === 200, `status=${res?.status}`);
    let events = [];
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      const r = await http("GET", "http://127.0.0.1:8601/api/v1/sessions/s_s8tomcat/events?afterSeq=0&limit=100");
      if (r?.status === 200) {
        events = (JSON.parse(r.text).events ?? []).map((x) => x.event).filter((e) => e.traceId === trace);
        if (events.length >= 4) break;
      }
      await sleep(400);
    }
    const kinds = new Set(events.map((e) => e.kind));
    ok("S8-C2 4 backend spans all EXACT", events.length === 4 && ["controller", "service", "mapper", "sql"].every((k) => kinds.has(k)) && events.every((e) => e.confidence === "EXACT"), [...kinds].join(","));
    const ctrl = events.find((e) => e.kind === "controller");
    ok("S8-C3 controller.parent=traceparent span", ctrl?.parentSpanId === span && ctrl?.rootEventId === click, ctrl?.parentSpanId ?? "missing");
    const sql = events.find((e) => e.kind === "sql");
    ok("S8-C4 SQL rowsAffected=0 + order CREATED", sql?.sideEffects?.some((s) => s.rowsAffected === 0) && (await http("GET", "http://127.0.0.1:8081/api/orders"))?.text.includes('"status":"CREATED"'), "");
  } finally {
    await stop(tomcat);
    await stop(collector);
    for (const port of PORTS) await waitFree(port, 30000);
  }
}

async function main() {
  console.log("S8 Tomcat 8.5 / SSM gate");
  staticChecks();
  build();
  if (!NO_E2E) {
    try { await e2e(); } catch (e) { ok("S8-B0 E2E setup", false, e.message); }
    for (const port of PORTS) ok(`S8-E1 port ${port} free`, await waitFree(port, 10000), "");
  }
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" }).stdout.trim().split(/\r?\n/).filter(Boolean);
  const unexpected = status.filter((line) => {
    const f = line.slice(2).trim();
    return !(f === "README.md" || f.startsWith("demo/buggy-shop-ssm-war/") || f.startsWith("docs/plans/stages/S8/") || f.startsWith("docs/plans/archive/stage-S8-") || f.startsWith("docs/plans/STAGE-PROGRESS.md") || f.startsWith("tools/verify/s8-tomcat.mjs"));
  });
  ok("S8-E2 git changes limited to S8", unexpected.length === 0, unexpected.slice(0, 3).join(",") || "S8 only");
  ok("S8-E3 no S10+ work (S9 docs allowed)", !existsSync(path.join(REPO, "docs/plans/stages/S10")), "");
  console.log(`S8 SUMMARY: ${pass} PASS / ${fail} FAIL`);
  console.log(`S8 TEST (Tomcat/SSM): ${fail === 0 ? "PASS" : "FAIL"}`);
  if (fail) console.log(`S8 FAILURES: ${failures.join(" | ")}`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(`S8 FATAL: ${e.stack ?? e.message}`); process.exit(1); });