#!/usr/bin/env node
/**
 * TraceBoard S0 + S1 independent verifier (tester deliverable).
 *
 * One-shot, re-runnable gate. S0 checks are kept; S1 replaces the two S0 checks that
 * the S1 contract itself supersedes (ingest 501 -> 202/400/413/415, and the S0-only
 * freeze baseline -> S1 G1 baseline + S0 regression):
 *
 *   S0 (kept)   V1/V1b/V1c/V4b case-A schema/facts/negatives/intervals; V2 real builds
 *               (root JDK21, demo JDK8, workbench, demo frontend); V3 agent bytecode 52;
 *               V6 workbench/demo artifacts + no external URLs + agent manifest;
 *               V8 secrets/telemetry/CDN hygiene.
 *   S1-A   fixtures/s1-walking-skeleton: 2-line fake batch + agent span validate against
 *          the frozen schema (Ajv 2020-12 strict); nodeKey #cancel, LOST + LOST_BACKEND,
 *          synthetic click_lost_ rootEventId, no CR/BOM, trailing LF; expected-facts.json
 *          new shape (globalAssertions.<source> + facts) evaluated by a dedicated consumer;
 *          local negative test (event carrying "seq" is rejected).
 *   S1-B   build artifacts: agent jar major 52, shaded Byte Buddy present, Premain-Class,
 *          no unrelocated net/bytebuddy; collector jar schema byte-identical to repo schema
 *          (unzip -p sha256); workbench npm ci && build; dist S1 markers; Vite proxy
 *          /ingest + /api -> http://127.0.0.1:8601.
 *   S1-C   collector 8601 (JDK21): health/meta capabilities; ingest 202 counts, per-line
 *          rejects, idempotent dropped, 415/400/413 envelopes, no body echo.
 *   S1-D   query: sessions eventCount, {"seq":N,"event":{...}} wrapper with seq outside the
 *          schema-valid event, nextSeq, limit 1 / 0 / 501, afterSeq paging/-1/abc,
 *          unknown session 404, POST/PUT 405, graph/replay/stream 404 (not implemented).
 *   S1-E   agent E2E (JDK8 absolute path + -javaagent): two cancel calls -> exactly 2
 *          controller spans (OK/LOST/LOST_BACKEND/#cancel/distinct traceIds/synthetic root,
 *          durNs>0), collector stopped -> cancel still 200 fast (fail-open), demo alive.
 *   S1-F   workbench path: POST the same fresh fake batch the workbench sends -> 202, then
 *          read the session back and assert seq ordering/shape.
 *   S1-G   regression/drift: case-A still validates, S0 builds green, S0 frozen files
 *          unchanged except the three S1-updated contracts, all files match the S1 G1
 *          freeze baseline hashes.
 *   S1-H   scope/security: no S2 features (service/mapper/SQL probes, correlation,
 *          graph/timeline/replay/SSE/WS, persistence/DB), no secrets/telemetry/CDN/mirrors,
 *          loopback only, agent fail-open structure, fake events never shown as correlated.
 *   S1-I   cleanup: ports 8601/8080/5173/5174/4173/4174 free, no new java processes,
 *          git status limited to expected S1 paths and an untouched index.
 *
 * Exit code 0 only when every gate passes. Product files are never modified; the only
 * writes are build outputs (target/, dist/, workbench/public/fixtures/) produced by the
 * product's own build commands, plus OS temp files that are deleted afterwards.
 *
 * Usage (from tools/verify):  node verify.mjs   [--json]
 */

import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..", "..");

const JDK21_HOME = process.env.TB_JDK21_HOME || "C:/Program Files/Java/jdk-21";
const JDK8_HOME = process.env.TB_JDK8_HOME || "C:/Program Files/Java/jdk1.8.0_221";
const JDK21_JAVA = `${JDK21_HOME}/bin/java.exe`;
const JDK8_JAVA = `${JDK8_HOME}/bin/java.exe`;
const JDK21_JAVAP = `${JDK21_HOME}/bin/javap.exe`;

const SCHEMA_REL = "schema/traceboard.event.v1.json";
const EVENTS_REL = "fixtures/case-a-zero-rows/events.jsonl";
const FACTS_REL = "fixtures/case-a-zero-rows/expected-facts.json";
const PLAN_REVIEW_REL = "docs/plans/stages/S0/plan-review.md";
const S1_PLAN_REVIEW_REL = "docs/plans/stages/S1/plan-review.md";

const S1_BATCH_REL = "fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson";
const S1_AGENT_SPAN_REL = "fixtures/s1-walking-skeleton/agent-controller-span.json";
const S1_FACTS_REL = "fixtures/s1-walking-skeleton/expected-facts.json";
const S1_AGENT_NODE_KEY = "com.example.shop.controller.OrderController#cancel";
const S1_AGENT_SESSION = "s_s1agent"; // -Dtraceboard.sessionId used by the E2E launch
const S1_WORKBENCH_SESSION = "s_wb_demo";
const S1_ALLOWED_PORT = 8601;
const S1_PORTS = [8601, 8080, 5173, 5174, 4173, 4174];

const COLLECTOR_BASE = "http://127.0.0.1:8601";
const DEMO_BASE = "http://localhost:8080";
const NDJSON = "application/x-ndjson";

const AGENT_JAR_REL = "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar";
const AGENT_CLASS_REL = "agent/target/classes/io/traceboard/agent/TraceAgent.class";
const COLLECTOR_JAR_REL = "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar";
const DEMO_JAR_REL = "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar";
const WORKBENCH_DIST_REL = "workbench/dist";
const DEMO_DIST_REL = "demo/buggy-shop-boot-vue/frontend/dist";

const HTTP_TIMEOUT_MS = 15000;
const START_TIMEOUT_MS = 90000;
const BUILD_TIMEOUT_MS = 900000;

const EXPECTED_SCHEMA_ID = "urn:traceboard:schema:event:v1";
const EXPECTED_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const EXPECTED_EVENT_COUNT = 9;

/* ------------------------------------------------------------------ */
/* result plumbing                                                     */
/* ------------------------------------------------------------------ */

const RESULTS = [];
let activeServer = null;
const tmpDirs = [];

function record(id, title, ok, evidence = [], repro = null) {
  RESULTS.push({ id, title, ok: Boolean(ok), evidence, repro: ok ? null : repro });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag}  [${id}] ${title}`);
  for (const line of evidence) console.log(`        ${line}`);
  if (!ok && repro) console.log(`        repro: ${repro}`);
  return Boolean(ok);
}

/** gate(): record several labelled sub-assertions as one check. */
function gate(id, title, checks, repro) {
  const bad = checks.filter((c) => !c.ok);
  const evidence = checks.map(
    (c) => `${c.ok ? "ok " : "BAD"} ${c.label}${c.detail !== undefined ? ` :: ${c.detail}` : ""}`,
  );
  return record(id, title, bad.length === 0, evidence, bad.length ? repro : null);
}

function section(title) {
  console.log("");
  console.log(`--- ${title} ---`);
}

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

function abs(rel) {
  return path.join(REPO, rel);
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function relOf(absPath) {
  return path.relative(REPO, absPath).split(path.sep).join("/");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== "object") return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function show(value) {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 160)}...` : text;
  } catch {
    return String(value);
  }
}

/** Dot path lookup per expected-facts.json "pathSyntax". */
function getByPath(root, dotted) {
  const segments = String(dotted).split(".");
  let current = root;
  for (const segment of segments) {
    if (current === null || current === undefined) return { found: false };
    if (/^\d+$/.test(segment)) {
      if (!Array.isArray(current)) return { found: false };
      const index = Number(segment);
      if (index < 0 || index >= current.length) return { found: false };
      current = current[index];
    } else {
      if (typeof current !== "object" || Array.isArray(current)) return { found: false };
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return { found: false };
      current = current[segment];
    }
  }
  return { found: true, value: current };
}

const SKIP_WALK_DIRS = new Set(["node_modules", ".git"]);

function walk(absDir, { skip = SKIP_WALK_DIRS, acc = null } = {}) {
  const out = acc ?? [];
  if (!existsSync(absDir)) return out;
  const st = statSync(absDir);
  if (st.isFile()) {
    out.push(absDir);
    return out;
  }
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const child = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      walk(child, { skip, acc: out });
    } else if (entry.isFile()) {
      out.push(child);
    }
  }
  return out;
}

function runShell(command, { cwd = REPO, env = process.env, timeout = BUILD_TIMEOUT_MS } = {}) {
  const started = Date.now();
  const result = spawnSync(command, {
    cwd,
    env,
    shell: true,
    encoding: "utf8",
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return {
    command,
    cwd,
    code: result.status,
    signal: result.signal,
    error: result.error,
    stdout,
    stderr,
    ms: Date.now() - started,
  };
}

function runExe(exe, args, { cwd = REPO, timeout = 120000 } = {}) {
  const result = spawnSync(exe, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    code: result.status,
    signal: result.signal,
    error: result.error,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function lastLines(text, count) {
  return text
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-count);
}

function listeningOn(port) {
  const result = runExe("netstat", ["-ano"], { timeout: 30000 });
  if (result.code !== 0) {
    return { supported: false, lines: [], error: result.stderr || "netstat failed" };
  }
  const pattern = new RegExp(`:${port}(?!\\d)`);
  const lines = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.includes("LISTENING") && pattern.test(line))
    .map((line) => line.trim());
  return { supported: true, lines };
}

async function pollUntil(fn, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
      lastValue = value;
    } catch (error) {
      lastValue = error;
    }
    await sleep(intervalMs);
  }
  return null;
}

const REPRO_VERIFY = `(cd "tools/verify" && npm ci && node verify.mjs)`;

/* ------------------------------------------------------------------ */
/* S1 HTTP / process / file helpers                                    */
/* ------------------------------------------------------------------ */

async function requestBase(base, pathname, init = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  try {
    const response = await fetch(base + pathname, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    return { ok: true, url: base + pathname, status: response.status, text };
  } catch (error) {
    return { ok: false, error, url: base + pathname };
  }
}

function postNdjson(pathname, body, contentType = NDJSON) {
  return requestBase(COLLECTOR_BASE, pathname, {
    method: "POST",
    headers: contentType === null ? {} : { "Content-Type": contentType },
    body,
  }, 30000);
}

/** Parse an error envelope and return label/check tuples. */
function envelopeChecks(res, expectedStatus, expectedError, label, forbiddenText = []) {
  const bodyText = res.text ?? "";
  const parsed = res.ok ? parseJson(bodyText) : { ok: false };
  const value = parsed.ok && parsed.value && typeof parsed.value === "object" ? parsed.value : {};
  const echoed = forbiddenText.filter((needle) => needle && bodyText.includes(needle));
  return [
    {
      ok: res.ok && res.status === expectedStatus,
      label: `${label}: HTTP ${expectedStatus}`,
      detail: res.ok ? `status=${res.status} body=${show(bodyText)}` : String(res.error),
    },
    {
      ok: parsed.ok && value.error === expectedError && value.apiVersion === "v1" && typeof value.message === "string",
      label: `${label}: envelope {error:${expectedError}, apiVersion:v1, message}`,
      detail: show(bodyText),
    },
    {
      ok: parsed.ok && typeof value.message === "string" && value.message.length > 0 && value.message.length <= 200,
      label: `${label}: message length 1..200`,
      detail: parsed.ok ? `${String(value.message).length} chars` : "unparsable",
    },
    {
      ok: echoed.length === 0,
      label: `${label}: no request-body echo`,
      detail: echoed.length ? `echoed=${echoed.join(",")}` : "no echo",
    },
  ];
}

/** Byte-level metadata for a UTF-8 fixture file (BOM/CR/trailing LF/lines). */
function readTextFileMeta(rel) {
  const buffer = readFileSync(abs(rel));
  const text = buffer.toString("utf8");
  const endsWithNewline = buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
  const rawSegments = text.split("\n");
  const bodySegments = endsWithNewline ? rawSegments.slice(0, -1) : rawSegments.slice();
  return {
    rel,
    buffer,
    text,
    hasBom: buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf,
    crCount: (text.match(/\r/g) ?? []).length,
    endsWithNewline,
    emptyLineCount: bodySegments.filter((line) => line.trim() === "").length,
    lines: bodySegments.filter((line) => line.trim() !== ""),
  };
}

/** Parse a plan-review "```text" block of "<sha256>  <path>" lines (optionally scoped to a heading). */
function parseFreezeBaseline(rel, headingRe = null) {
  const text = readFileSync(abs(rel), "utf8");
  let scope = text;
  if (headingRe) {
    const start = text.search(headingRe);
    if (start < 0) return [];
    const rest = text.slice(start);
    const nextHeading = rest.slice(1).search(/\n#{2,3} /);
    scope = nextHeading < 0 ? rest : rest.slice(0, nextHeading + 1);
  }
  const entries = [];
  for (const line of scope.split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s{2}(.+)$/);
    if (match) entries.push({ hash: match[1], rel: match[2].trim() });
  }
  return entries;
}

function javaPids() {
  const result = runExe("tasklist", ["/FI", "IMAGENAME eq java.exe", "/FO", "CSV", "/NH"], { timeout: 30000 });
  const pids = [];
  for (const line of (result.stdout || "").split(/\r?\n/)) {
    const match = line.match(/^"java\.exe","(\d+)"/i);
    if (match) pids.push(Number(match[1]));
  }
  return pids;
}

function gitStatusLines() {
  const result = runExe("git", ["status", "--porcelain"], { timeout: 60000 });
  if (result.code !== 0) return { ok: false, lines: [], error: result.stderr || "git status failed" };
  return { ok: true, lines: (result.stdout || "").split(/\r?\n/).filter((line) => line.trim() !== "") };
}

function zipEntries(jarAbs) {
  const result = runExe("unzip", ["-Z1", jarAbs], { timeout: 60000 });
  return {
    ok: result.code === 0,
    entries: (result.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    stderr: result.stderr || "",
  };
}

function dirTextFiles(rel) {
  const dirAbs = abs(rel);
  if (!existsSync(dirAbs)) return [];
  return walk(dirAbs, { skip: new Set(["node_modules", "target", "dist", ".git"]) })
    .filter((file) => /\.(java|ts|vue|js|mjs|yml|yaml|json|xml|html|css|md)$/i.test(file))
    .map((file) => ({ rel: relOf(file), text: readFileSync(file, "utf8") }));
}

/** Remove comments so "no retry"/"no correlation" disclaimers are not scanned as code. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"])\/\/[^\n]*/g, "$1");
}

function hexRandom(byteCount) {
  const bytes = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes.toString("hex");
}


/* ------------------------------------------------------------------ */
/* V0 environment                                                      */
/* ------------------------------------------------------------------ */

function captureEnv() {
  const java21 = runExe(JDK21_JAVA, ["-version"]);
  const java8 = existsSync(JDK8_JAVA) ? runExe(JDK8_JAVA, ["-version"]) : { stderr: "missing" };
  const mvn8 = runShell("mvn -v", { timeout: 60000 });
  const mvn21 = runShell("mvn -v", {
    timeout: 60000,
    env: { ...process.env, JAVA_HOME: JDK21_HOME },
  });
  const node = runExe(process.execPath, ["-v"], { timeout: 30000 });
  const npm = runShell("npm -v", { timeout: 60000 });
  const env = {
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    node: node.stdout.trim(),
    npm: npm.stdout.trim(),
    java21: `${java21.stdout} ${java21.stderr}`.trim().split(/\r?\n/)[0],
    java8: `${java8.stdout ?? ""} ${java8.stderr ?? ""}`.trim().split(/\r?\n/)[0],
    mvnDefault: lastLines(`${mvn8.stdout}\n${mvn8.stderr}`, 6).join(" | "),
    mvnJdk21: lastLines(`${mvn21.stdout}\n${mvn21.stderr}`, 6).join(" | "),
    jdk21Home: JDK21_HOME,
    jdk8Home: JDK8_HOME,
    cwd: REPO,
  };
  return env;
}

/* ------------------------------------------------------------------ */
/* V1 schema + fixture                                                 */
/* ------------------------------------------------------------------ */

function parseFixture() {
  const buffer = readFileSync(abs(EVENTS_REL));
  const text = buffer.toString("utf8");
  const rawSegments = text.split("\n");
  const endsWithNewline = buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
  const bodySegments = endsWithNewline ? rawSegments.slice(0, -1) : rawSegments.slice();
  const emptyLineCount = bodySegments.filter((line) => line.trim() === "").length;
  const commentLineCount = bodySegments.filter((line) => /^\s*(\/\/|#)/.test(line)).length;
  const lines = bodySegments.filter((line) => line.trim() !== "");
  return {
    buffer,
    text,
    hasBom: buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf,
    crCount: (text.match(/\r/g) ?? []).length,
    endsWithNewline,
    emptyLineCount,
    commentLineCount,
    lines,
  };
}

function checkV1() {
  section("V1 schema + fixture");
  const checks = [];
  const fixtureHashBefore = sha256File(abs(EVENTS_REL));

  let schema = null;
  let schemaParseError = null;
  const schemaText = readFileSync(abs(SCHEMA_REL), "utf8");
  try {
    schema = JSON.parse(schemaText);
  } catch (error) {
    schemaParseError = error;
  }
  checks.push({
    ok: schema !== null,
    label: "schema JSON parses",
    detail: schemaParseError ? schemaParseError.message : SCHEMA_REL,
  });

  let validate = null;
  let compileError = null;
  if (schema) {
    const refCount = (schemaText.match(/"\$ref"/g) ?? []).length;
    const urlMatches = [...schemaText.matchAll(/https?:\/\/[^\s"']+/g)].map((m) => m[0]);
    const foreignUrls = [...new Set(urlMatches)].filter((url) => url !== EXPECTED_SCHEMA_DIALECT);
    checks.push({
      ok: schema.$schema === EXPECTED_SCHEMA_DIALECT,
      label: "$schema is 2020-12",
      detail: schema.$schema,
    });
    checks.push({
      ok: schema.$id === EXPECTED_SCHEMA_ID,
      label: "$id is the frozen URN",
      detail: schema.$id,
    });
    checks.push({ ok: refCount === 0, label: "no $ref (offline validation)", detail: `$ref count=${refCount}` });
    checks.push({
      ok: foreignUrls.length === 0,
      label: "no external schema URLs besides the 2020-12 meta-schema",
      detail: foreignUrls.length ? foreignUrls.join(", ") : "none",
    });

    try {
      const ajv = new Ajv2020({ allErrors: true, strict: true });
      validate = ajv.compile(schema);
    } catch (error) {
      compileError = error;
    }
    checks.push({
      ok: validate !== null,
      label: "Ajv 2020-12 compile with strict:true",
      detail: compileError ? String(compileError.message).slice(0, 300) : "compiled",
    });
  }

  const fixture = parseFixture();
  checks.push({
    ok: fixture.lines.length === EXPECTED_EVENT_COUNT,
    label: `exactly ${EXPECTED_EVENT_COUNT} non-empty JSONL lines`,
    detail: `lines=${fixture.lines.length}`,
  });
  checks.push({ ok: !fixture.hasBom, label: "UTF-8 without BOM", detail: `hasBom=${fixture.hasBom}` });
  checks.push({ ok: fixture.crCount === 0, label: "no CR bytes", detail: `\\r count=${fixture.crCount}` });
  checks.push({
    ok: fixture.endsWithNewline,
    label: "trailing newline at EOF",
    detail: `lastByte=0x${fixture.buffer.length ? fixture.buffer[fixture.buffer.length - 1].toString(16) : "??"}`,
  });
  checks.push({
    ok: fixture.emptyLineCount === 0,
    label: "no empty lines",
    detail: `emptyLines=${fixture.emptyLineCount}`,
  });
  checks.push({
    ok: fixture.commentLineCount === 0,
    label: "no comment lines",
    detail: `comments=${fixture.commentLineCount}`,
  });

  const parsed = [];
  const parseFailures = [];
  fixture.lines.forEach((line, index) => {
    try {
      parsed.push(JSON.parse(line));
    } catch (error) {
      parseFailures.push(`line ${index + 1}: ${error.message}`);
    }
  });
  checks.push({
    ok: parseFailures.length === 0,
    label: "every line is valid JSON",
    detail: parseFailures.length ? parseFailures.join("; ") : `${parsed.length} objects`,
  });

  const invalidLines = [];
  if (validate && parsed.length === fixture.lines.length) {
    parsed.forEach((event, index) => {
      if (!validate(event)) {
        const errors = (validate.errors ?? [])
          .slice(0, 3)
          .map((e) => `${e.instancePath || "/"} ${e.message}`)
          .join("; ");
        invalidLines.push(`line ${index + 1} spanId=${event.spanId}: ${errors}`);
      }
    });
  }
  checks.push({
    ok: validate !== null && parsed.length > 0 && invalidLines.length === 0,
    label: "every line validates against schema",
    detail: invalidLines.length ? invalidLines.slice(0, 3).join(" || ") : `${parsed.length}/${parsed.length} valid`,
  });

  const spanIds = parsed.map((e) => e.spanId);
  const badSpanIdFormat = spanIds.filter((id) => !/^[0-9a-f]{16}$/.test(String(id)));
  const uniqueSpanIds = new Set(spanIds);
  checks.push({
    ok: badSpanIdFormat.length === 0,
    label: "spanId is 16 lowercase hex",
    detail: badSpanIdFormat.length ? badSpanIdFormat.join(",") : `${spanIds.length} ids`,
  });
  checks.push({
    ok: uniqueSpanIds.size === spanIds.length,
    label: "spanIds unique",
    detail: `unique=${uniqueSpanIds.size}/${spanIds.length}`,
  });

  const roots = parsed.filter((e) => e.parentSpanId === null);
  checks.push({
    ok: roots.length === 1,
    label: "single root (parentSpanId null)",
    detail: roots.length === 1 ? `root=${roots[0].spanId} kind=${roots[0].kind}` : `roots=${roots.length}`,
  });

  const traceIds = [...new Set(parsed.map((e) => e.traceId))];
  checks.push({
    ok: traceIds.length === 1,
    label: "traceId consistent",
    detail: `distinct=${traceIds.length}${traceIds.length === 1 ? ` (${traceIds[0]})` : `: ${traceIds.join(",")}`}`,
  });

  let monotonic = true;
  const startSequence = [];
  parsed.forEach((event, index) => {
    startSequence.push(event.startNs);
    if (index > 0 && !(event.startNs >= parsed[index - 1].startNs)) monotonic = false;
  });
  checks.push({
    ok: monotonic,
    label: "startNs non-decreasing (file order)",
    detail: startSequence.join(","),
  });

  checks.push({
    ok: sha256File(abs(EVENTS_REL)) === fixtureHashBefore,
    label: "fixture bytes unchanged by validation",
    detail: `sha256=${fixtureHashBefore}`,
  });

  gate("V1", "schema (Ajv 2020-12 strict) + JSONL fixture invariants", checks, REPRO_VERIFY);
  return { parsed, validate, fixture };
}

/* ------------------------------------------------------------------ */
/* V1b expected facts                                                  */
/* ------------------------------------------------------------------ */

function checkV1b(parsed) {
  section("V1b expected facts");
  const checks = [];
  let facts = null;
  try {
    facts = JSON.parse(readFileSync(abs(FACTS_REL), "utf8"));
  } catch (error) {
    checks.push({ ok: false, label: "expected-facts.json parses", detail: error.message });
    gate("V1b", "expected facts vs events.jsonl", checks, REPRO_VERIFY);
    return;
  }

  checks.push({
    ok: facts.eventCount === EXPECTED_EVENT_COUNT && parsed.length === facts.eventCount,
    label: "eventCount matches",
    detail: `expected=${facts.eventCount} actual=${parsed.length}`,
  });
  checks.push({
    ok: facts.noExceptions === true && parsed.every((e) => e.status !== "THREW"),
    label: "noExceptions (no THREW status)",
    detail: `expected=${facts.noExceptions} threw=${parsed.filter((e) => e.status === "THREW").length}`,
  });
  checks.push({
    ok: facts.confidenceAllExact === true && parsed.every((e) => e.confidence === "EXACT"),
    label: "confidenceAllExact",
    detail: `values=${[...new Set(parsed.map((e) => e.confidence))].join(",")}`,
  });
  checks.push({
    ok: facts.statusAllOk === true && parsed.every((e) => e.status === "OK"),
    label: "statusAllOk",
    detail: `values=${[...new Set(parsed.map((e) => e.status))].join(",")}`,
  });
  checks.push({
    ok:
      typeof facts.flagRequired === "string" &&
      parsed.every((e) => Array.isArray(e.flags) && e.flags.includes(facts.flagRequired)),
    label: `every row flags contain ${facts.flagRequired}`,
    detail: `rowsWithFlag=${parsed.filter((e) => Array.isArray(e.flags) && e.flags.includes(facts.flagRequired)).length}/${parsed.length}`,
  });
  checks.push({
    ok: parsed.every((e) => e.traceId === facts.traceId),
    label: "traceId consistent with expected-facts",
    detail: facts.traceId,
  });
  checks.push({
    ok: parsed.every((e) => e.rootEventId === facts.rootEventId),
    label: "rootEventId consistent with expected-facts",
    detail: facts.rootEventId,
  });

  const factList = Array.isArray(facts.facts) ? facts.facts : [];
  checks.push({ ok: factList.length === 5, label: "5 facts present", detail: `count=${factList.length}` });

  for (const fact of factList) {
    const matches = parsed.filter((e) => e.kind === fact.kind && e.nodeKey === fact.nodeKey);
    if (matches.length !== 1) {
      checks.push({
        ok: false,
        label: `${fact.id} locate by kind+nodeKey`,
        detail: `kind=${fact.kind} nodeKey=${fact.nodeKey} matches=${matches.length}`,
      });
      continue;
    }
    const event = matches[0];
    checks.push({
      ok: event.status === fact.status,
      label: `${fact.id} status`,
      detail: `expected=${fact.status} actual=${event.status}`,
    });
    const lookup = getByPath(event, fact.assert?.path);
    const valueOk = lookup.found && deepEqual(lookup.value, fact.assert?.value);
    checks.push({
      ok: valueOk,
      label: `${fact.id} ${fact.assert?.path} deep-equals ${show(fact.assert?.value)}`,
      detail: lookup.found ? `actual=${show(lookup.value)}` : "path not found",
    });
  }

  gate("V1b", "expected-facts.json deep comparison (5 facts + global assertions)", checks, REPRO_VERIFY);
}

/* ------------------------------------------------------------------ */
/* V1c negative tests                                                  */
/* ------------------------------------------------------------------ */

function checkV1c(parsed, validate) {
  section("V1c negative tests");
  const checks = [];
  const fixtureHashBefore = sha256File(abs(EVENTS_REL));

  if (!validate || parsed.length === 0) {
    checks.push({ ok: false, label: "validator available", detail: "schema did not compile" });
    gate("V1c", "schema negative/positive tests", checks, REPRO_VERIFY);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `traceboard-s0-verify-${process.pid}-neg`);
  mkdirSync(tmpDir, { recursive: true });
  tmpDirs.push(tmpDir);

  const base = JSON.parse(JSON.stringify(parsed[0]));

  function validateCase(name, mutate) {
    const event = JSON.parse(JSON.stringify(base));
    mutate(event);
    const file = path.join(tmpDir, `${name}.jsonl`);
    writeFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
    const reread = JSON.parse(readFileSync(file, "utf8").trim());
    const ok = validate(reread);
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
    return { ok, errors, file };
  }

  const invalidStatus = validateCase("invalid-status", (e) => {
    e.status = "SUCCESS";
  });
  checks.push({
    ok: invalidStatus.ok === false,
    label: 'status "SUCCESS" rejected',
    detail: invalidStatus.ok ? "accepted (BAD)" : lastLines(invalidStatus.errors, 1)[0] ?? "rejected",
  });

  const missingReason = validateCase("missing-reason", (e) => {
    e.status = "NOT_COLLECTED_POLICY";
  });
  checks.push({
    ok: missingReason.ok === false,
    label: "NOT_COLLECTED_POLICY without reason rejected",
    detail: missingReason.ok ? "accepted (BAD)" : lastLines(missingReason.errors, 1)[0] ?? "rejected",
  });

  const extraProperty = validateCase("extra-property", (e) => {
    e.unexpectedField = "drift";
  });
  checks.push({
    ok: extraProperty.ok === false,
    label: "extra top-level property rejected (additionalProperties:false)",
    detail: extraProperty.ok ? "accepted (BAD)" : lastLines(extraProperty.errors, 1)[0] ?? "rejected",
  });

  const validPolicy = validateCase("valid-policy", (e) => {
    e.status = "NOT_COLLECTED_POLICY";
    e.reason = "policy:third_party_package";
  });
  checks.push({
    ok: validPolicy.ok === true,
    label: "valid NOT_COLLECTED_POLICY + reason accepted",
    detail: validPolicy.ok ? "accepted" : `rejected (BAD): ${validPolicy.errors}`,
  });

  checks.push({
    ok: sha256File(abs(EVENTS_REL)) === fixtureHashBefore,
    label: "source fixture untouched (hash stable)",
    detail: `sha256=${fixtureHashBefore}`,
  });

  rmSync(tmpDir, { recursive: true, force: true });
  gate("V1c", "schema self-test: negative copies rejected, positive copy accepted", checks, REPRO_VERIFY);
}

/* ------------------------------------------------------------------ */
/* V4b causal interval containment                                     */
/* ------------------------------------------------------------------ */

function checkV4b(parsed) {
  section("V4b causal interval containment");
  const checks = [];
  const byId = new Map(parsed.map((e) => [e.spanId, e]));
  const violations = [];
  const interval = (e) => `[${e.startNs},${e.startNs + e.durNs}]`;
  const strictChecked = [];
  const callbackChecked = [];

  function ascendToRoot(event) {
    const seen = new Set([event.spanId]);
    let current = event;
    while (current.parentSpanId !== null) {
      if (seen.has(current.parentSpanId)) return { ok: false, reason: "cycle" };
      const parent = byId.get(current.parentSpanId);
      if (!parent) return { ok: false, reason: `missing parent ${current.parentSpanId}` };
      seen.add(parent.spanId);
      current = parent;
    }
    return { ok: true, root: current };
  }

  for (const event of parsed) {
    if (event.parentSpanId === null) continue;
    const parent = byId.get(event.parentSpanId);
    if (!parent) {
      violations.push(
        `${event.spanId} parent=${event.parentSpanId} kind=${event.kind} -> parent span missing in file`,
      );
      continue;
    }
    if (event.kind !== "callback") {
      const childStart = event.startNs;
      const childEnd = event.startNs + event.durNs;
      const parentStart = parent.startNs;
      const parentEnd = parent.startNs + parent.durNs;
      if (childStart < parentStart || childEnd > parentEnd) {
        violations.push(
          `${event.spanId} parent=${parent.spanId} kind=${event.kind} child=${interval(event)} parent=${interval(parent)} (strict violation)`,
        );
      }
      strictChecked.push(event.spanId);
    } else {
      const ascent = ascendToRoot(event);
      if (!ascent.ok) {
        violations.push(`${event.spanId} kind=callback cannot resolve unique root: ${ascent.reason}`);
        continue;
      }
      const root = ascent.root;
      const childStart = event.startNs;
      const childEnd = event.startNs + event.durNs;
      const rootStart = root.startNs;
      const rootEnd = root.startNs + root.durNs;
      if (childStart < rootStart || childEnd > rootEnd) {
        violations.push(
          `${event.spanId} kind=callback child=${interval(event)} root=${root.spanId}${interval(root)} (root containment violation)`,
        );
      }
      callbackChecked.push({ event, parent, root, insideParent: childStart >= parent.startNs && childEnd <= parent.startNs + parent.durNs });
    }
  }

  checks.push({
    ok: violations.length === 0,
    label: "0 containment violations across 9 events",
    detail: violations.length ? violations.slice(0, 4).join(" || ") : "0 violations",
  });
  checks.push({
    ok: strictChecked.length === 7,
    label: "7 non-root non-callback spans checked strictly",
    detail: strictChecked.join(","),
  });
  checks.push({
    ok: callbackChecked.length === 1,
    label: "exactly one callback span, checked against root",
    detail: callbackChecked.map((c) => `${c.event.spanId} parent=${c.parent.spanId}(${c.parent.kind}) root=${c.root.spanId}`).join(","),
  });

  const cb = callbackChecked[0];
  if (cb) {
    checks.push({
      ok:
        cb.event.spanId === "1000000000000009" &&
        cb.parent.spanId === "1000000000000004" &&
        cb.parent.kind === "fetch" &&
        cb.root.spanId === "1000000000000001",
      label: "case-A callback is the sole exception (parent fetch, root ui_event)",
      detail: `callback=${cb.event.spanId} parent=${cb.parent.spanId}/${cb.parent.kind} root=${cb.root.spanId}`,
    });
    checks.push({
      ok: !cb.insideParent && cb.event.startNs >= cb.root.startNs && cb.event.startNs + cb.event.durNs <= cb.root.startNs + cb.root.durNs,
      label: "callback starts after its fetch parent ends but stays inside the root span",
      detail: `callback=${interval(cb.event)} parent=${interval(cb.parent)} root=${interval(cb.root)} insideParent=${cb.insideParent}`,
    });
  } else {
    checks.push({ ok: false, label: "case-A callback present", detail: "no callback span found" });
  }

  // Exemption must not leak to other kinds: assert no non-callback span violates strict containment
  // (already covered) and that no non-callback span was routed through the root-only path.
  checks.push({
    ok: callbackChecked.length === 1 && strictChecked.length === parsed.length - 2,
    label: "exception applies only to kind=callback",
    detail: `strict=${strictChecked.length} callback=${callbackChecked.length} total=${parsed.length}`,
  });

  gate("V4b", "causal intervals: parent exists, strict child containment, callback root-only", checks, REPRO_VERIFY);
}

/* ------------------------------------------------------------------ */
/* V2 builds                                                           */
/* ------------------------------------------------------------------ */

function buildAndRecord(id, title, command, { cwd, env, repro }) {
  section(`${id} build: ${command}`);
  const result = runShell(command, { cwd, env });
  const ok =
    result.code === 0 &&
    !result.error &&
    !result.signal &&
    !/BUILD FAILURE|ERR!|npm error/i.test(result.stdout + result.stderr);
  const evidence = [
    `cwd: ${cwd}`,
    `exit: ${result.code}${result.signal ? ` signal=${result.signal}` : ""}${result.error ? ` error=${result.error.message}` : ""}`,
    `duration: ${(result.ms / 1000).toFixed(1)}s`,
  ];
  if (ok) {
    const tail = lastLines(result.stdout, 3);
    if (tail.length) evidence.push(`last output: ${tail.join(" | ").slice(0, 400)}`);
  } else {
    evidence.push(...lastLines(`${result.stdout}\n${result.stderr}`, 25));
  }
  return record(id, title, ok, evidence, repro);
}

function checkV2() {
  section("V2 builds (sequential, real)");
  const results = {};

  results.root = buildAndRecord(
    "V2a",
    "root reactor (JDK21) mvn package",
    "mvn -B -q -DskipTests package",
    {
      cwd: REPO,
      env: { ...process.env, JAVA_HOME: JDK21_HOME },
      repro: `JAVA_HOME="${JDK21_HOME}" mvn -B -q -DskipTests package`,
    },
  );

  const defaultHome = process.env.JAVA_HOME || "";
  const demoHome = /1\.8|jdk8|jdk-8/i.test(defaultHome) ? defaultHome : JDK8_HOME;
  const demoEnv = { ...process.env, JAVA_HOME: demoHome };
  results.demoBackend = buildAndRecord(
    "V2b",
    `demo backend (JDK8: ${demoHome}) mvn package`,
    "mvn -B -q -DskipTests package",
    {
      cwd: abs("demo/buggy-shop-boot-vue/backend"),
      env: demoEnv,
      repro: `(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)`,
    },
  );

  results.workbenchCi = buildAndRecord("V2c-1", "workbench npm ci", "npm ci", {
    cwd: abs("workbench"),
    repro: `(cd "workbench" && npm ci)`,
  });
  results.workbenchBuild = buildAndRecord(
    "V2c-2",
    "workbench npm run build (prebuild syncs fixtures)",
    "npm run build",
    { cwd: abs("workbench"), repro: `(cd "workbench" && npm run build)` },
  );

  results.demoFrontendCi = buildAndRecord("V2d-1", "demo frontend npm ci", "npm ci", {
    cwd: abs("demo/buggy-shop-boot-vue/frontend"),
    repro: `(cd "demo/buggy-shop-boot-vue/frontend" && npm ci)`,
  });
  results.demoFrontendBuild = buildAndRecord(
    "V2d-2",
    "demo frontend npm run build",
    "npm run build",
    { cwd: abs("demo/buggy-shop-boot-vue/frontend"), repro: `(cd "demo/buggy-shop-boot-vue/frontend" && npm run build)` },
  );

  // prebuild must sync fixtures: copy present + identical to the frozen source
  const copyEvents = abs("workbench/public/fixtures/case-a-zero-rows/events.jsonl");
  const copyFacts = abs("workbench/public/fixtures/case-a-zero-rows/expected-facts.json");
  const syncChecks = [
    { ok: existsSync(copyEvents), label: "prebuild copy exists (events.jsonl)", detail: relOf(copyEvents) },
    {
      ok: existsSync(copyEvents) && sha256File(copyEvents) === sha256File(abs(EVENTS_REL)),
      label: "prebuild copy SHA256 equals fixtures source (events)",
      detail: existsSync(copyEvents) ? sha256File(copyEvents) : "missing",
    },
    {
      ok: existsSync(copyFacts) && sha256File(copyFacts) === sha256File(abs(FACTS_REL)),
      label: "prebuild copy SHA256 equals fixtures source (expected-facts)",
      detail: existsSync(copyFacts) ? sha256File(copyFacts) : "missing",
    },
  ];
  record("V2c-3", "workbench prebuild synced fixtures byte-identically", syncChecks.every((c) => c.ok),
    syncChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `(cd "workbench" && npm run sync:fixtures)`);

  return results;
}

/* ------------------------------------------------------------------ */
/* V3 agent bytecode                                                   */
/* ------------------------------------------------------------------ */

function checkV3() {
  section("V3 agent bytecode");
  const checks = [];
  const jarAbs = abs(AGENT_JAR_REL);
  checks.push({ ok: existsSync(jarAbs), label: "agent jar exists", detail: AGENT_JAR_REL });

  let major = null;
  let javapEvidence = "";
  if (existsSync(jarAbs) && existsSync(JDK21_JAVAP)) {
    const result = runExe(JDK21_JAVAP, [
      "-verbose",
      "-classpath",
      jarAbs,
      "io.traceboard.agent.TraceAgent",
    ]);
    javapEvidence = result.stdout;
    const match = result.stdout.match(/major version:\s*(\d+)/);
    if (match) major = Number(match[1]);
    checks.push({
      ok: major === 52,
      label: "javap major version",
      detail: major === null ? `not found; exit=${result.code} ${lastLines(result.stderr, 2).join(" ")}` : String(major),
    });
  } else {
    checks.push({ ok: false, label: "javap available", detail: JDK21_JAVAP });
  }

  const classAbs = abs(AGENT_CLASS_REL);
  if (existsSync(classAbs)) {
    const bytes = readFileSync(classAbs);
    const fallbackMajor = (bytes[6] << 8) | bytes[7];
    checks.push({
      ok: fallbackMajor === 52,
      label: "class file header major (bytes 6-7) is 52",
      detail: `major=${fallbackMajor} file=${AGENT_CLASS_REL}`,
    });
  } else if (major !== 52) {
    checks.push({ ok: false, label: "fallback class file", detail: `${AGENT_CLASS_REL} missing` });
  }

  const versionLine = javapEvidence.match(/minor version:\s*\d+,\s*major version:\s*(\d+)/);
  if (versionLine) checks.push({ ok: true, label: "javap raw line", detail: versionLine[0] });

  gate(
    "V3",
    "agent compiled for Java 8 (major version 52)",
    checks,
    `javap -verbose -classpath "${AGENT_JAR_REL}" io.traceboard.agent.TraceAgent | grep "major version"`,
  );
}

/* ------------------------------------------------------------------ */
/* HTTP helpers for V5                                                 */
/* ------------------------------------------------------------------ */

async function tryRequest(port, pathname, init = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const bases = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(base + pathname, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      return { ok: true, url: base + pathname, status: response.status, text };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, error: lastError, url: bases[0] + pathname };
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function startJavaServer(label, exe, args, cwd) {
  const child = spawn(exe, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const log = { text: "" };
  const append = (chunk) => {
    log.text += chunk.toString("utf8");
    if (log.text.length > 400000) log.text = log.text.slice(-200000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("error", (error) => {
    log.text += `\n[spawn error] ${error.message}`;
  });
  const server = { label, child, log, port: null };
  activeServer = server;
  console.log(`        started ${label}: pid=${child.pid} exe=${exe}`);
  return server;
}

async function stopServer(server) {
  if (!server || !server.child || server.child.exitCode !== null || server.child.pid === undefined) {
    if (activeServer === server) activeServer = null;
    return;
  }
  spawnSync("taskkill", ["/PID", String(server.child.pid), "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
  });
  await sleep(1000);
}

/* ------------------------------------------------------------------ */
/* S1-C/D/F collector: ingest + query + workbench path                 */
/* ------------------------------------------------------------------ */

function findSession(sessions, sessionId) {
  if (!Array.isArray(sessions)) return null;
  return sessions.find((item) => item && item.sessionId === sessionId) ?? null;
}

function wrapperProblems(validate, events, label) {
  const problems = [];
  if (!Array.isArray(events)) return [`${label}: events is not an array`];
  for (const item of events) {
    if (!item || typeof item !== "object" || !item.event || typeof item.event !== "object") {
      problems.push(`${label}: entry without nested event object`);
      continue;
    }
    if (!Number.isInteger(item.seq)) problems.push(`${label}: seq is not an integer`);
    if (Object.prototype.hasOwnProperty.call(item.event, "seq")) problems.push(`${label}: seq leaked inside event`);
    if (validate && !validate(item.event)) {
      const errors = (validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
      problems.push(`${label}: ${item.event.spanId} schema invalid (${errors})`);
    }
  }
  return problems;
}

async function getEventsPage(sessionId, query = "") {
  const res = await requestBase(
    COLLECTOR_BASE,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/events${query}`,
  );
  const parsed = res.ok ? parseJson(res.text) : { ok: false };
  return { res, parsed, value: parsed.ok && parsed.value && typeof parsed.value === "object" ? parsed.value : {} };
}

async function checkS1CDF(validate) {
  section("S1-C/D/F collector ingest + query + workbench path");
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const pre = listeningOn(8601);
  const preconditions = [
    { ok: pre.supported && pre.lines.length === 0, label: "port 8601 free before start", detail: pre.lines.join(" | ") || "no listener" },
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(JDK21_JAVA), label: "JDK21 java.exe exists", detail: JDK21_JAVA },
  ];
  if (!preconditions.every((c) => c.ok)) {
    record(
      "S1-C0",
      "collector health + meta capabilities",
      false,
      preconditions.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `"${JDK21_JAVA}" -jar "${COLLECTOR_JAR_REL}"`,
    );
    for (const [id, title] of [
      ["S1-C1", "ingest happy path, 202 counts, idempotent dropped"],
      ["S1-C2", "per-line rejects: invalid status + mixed batch"],
      ["S1-C3", "envelope negatives 415/400/413 + no body echo"],
      ["S1-D", "read-only query shapes, paging, 400/404/405, reserved routes"],
      ["S1-F", "workbench fake-batch path"],
    ]) {
      record(id, title, false, [{ ok: false, label: "collector not started", detail: "precondition failed" }], null);
    }
    return;
  }

  let collector = null;
  try {
    collector = startJavaServer("collector(8601)", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);

    const metaRes = health ? await requestBase(COLLECTOR_BASE, "/api/v1/meta", { method: "GET" }) : null;
    const metaParsed = metaRes && metaRes.ok ? parseJson(metaRes.text) : { ok: false };
    const meta = metaParsed.ok && metaParsed.value ? metaParsed.value : {};
    const caps = meta.capabilities ?? {};

    const c0 = [
      {
        ok: Boolean(health) && parseJson(health.text).value?.status === "UP",
        label: "health 200 {status:UP}",
        detail: health ? show(health.text) : "timeout / connection refused",
      },      {
        ok: metaRes?.ok && metaRes.status === 200 && meta.service === "traceboard-collector" &&
          meta.apiVersion === "v1" && meta.version === "0.1.0-SNAPSHOT",
        label: "meta service/version/apiVersion",
        detail: show(metaRes?.text),
      },
      {
        ok: meta.schema?.id === EXPECTED_SCHEMA_ID && meta.schema?.version === "traceboard.event.v1" &&
          meta.schema?.dialect === "2020-12",
        label: "meta schema id/version/dialect",
        detail: show(meta.schema),
      },
      {
        ok: caps.health === true && caps.meta === true && caps.ingestEvents === true &&
          caps.realtime === false && caps.replay === false,
        label: "capabilities ingestEvents=true / realtime=false / replay=false",
        detail: show(caps),
      },
      {
        ok: Object.keys(caps).length === 5,
        label: "capabilities has exactly 5 keys",
        detail: Object.keys(caps).join(","),
      },
    ];
    record(
      "S1-C0",
      "collector health + meta capabilities",
      c0.every((c) => c.ok),
      c0.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `"${JDK21_JAVA}" -jar "${COLLECTOR_JAR_REL}"`,
    );
    if (!health) {
      for (const [id, title] of [
        ["S1-C1", "ingest happy path, 202 counts, idempotent dropped"],
        ["S1-C2", "per-line rejects: invalid status + mixed batch"],
        ["S1-C3", "envelope negatives 415/400/413 + no body echo"],
        ["S1-D", "read-only query shapes, paging, 400/404/405, reserved routes"],
        ["S1-F", "workbench fake-batch path"],
      ]) {
        record(id, title, false, [{ ok: false, label: "collector health timeout", detail: "GET /actuator/health failed" }], null);
      }
      return;
    }

    const batch = readTextFileMeta(S1_BATCH_REL);
    const fixtureEvents = batch.lines.map((line) => JSON.parse(line));

    /* ---------------- S1-C1 happy path + idempotency ---------------- */
    const valid = await postNdjson("/ingest/v1/events", batch.text, `${NDJSON}; charset=utf-8`);
    const validParsed = valid.ok ? parseJson(valid.text) : { ok: false };
    const validBody = validParsed.ok ? validParsed.value ?? {} : {};
    const dup = await postNdjson("/ingest/v1/events", batch.text, `${NDJSON}; charset=utf-8`);
    const dupParsed = dup.ok ? parseJson(dup.text) : { ok: false };
    const dupBody = dupParsed.ok ? dupParsed.value ?? {} : {};

    const sessionsRes = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const sessionsParsed = sessionsRes.ok ? parseJson(sessionsRes.text) : { ok: false };
    const sessions = sessionsParsed.ok ? sessionsParsed.value?.sessions : null;
    const wbSession = findSession(sessions, S1_WORKBENCH_SESSION);
    const firstPage = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200");
    const firstEvents = Array.isArray(firstPage.value.events) ? firstPage.value.events : [];
    const firstProblems = wrapperProblems(validate, firstEvents, "s_wb_demo page");

    const c1 = [
      {
        ok: valid.ok && valid.status === 202,
        label: "valid 2-line batch -> 202",
        detail: valid.ok ? `status=${valid.status} body=${show(valid.text)}` : String(valid.error),
      },
      {
        ok: validBody.accepted === 2 && validBody.rejected === 0 && validBody.dropped === 0 &&
          Array.isArray(validBody.errors) && validBody.errors.length === 0,
        label: "202 {accepted:2,rejected:0,dropped:0,errors:[]}",
        detail: show(valid.text),
      },
      {
        ok: dup.ok && dup.status === 202 && dupBody.accepted === 0 && dupBody.rejected === 0 &&
          dupBody.dropped === 2 && Array.isArray(dupBody.errors) && dupBody.errors.length === 0,
        label: "duplicate batch -> 202 {accepted:0,rejected:0,dropped:2}",
        detail: show(dup.text),
      },
      {
        ok: Boolean(wbSession) && wbSession.eventCount === 2 &&
          Number.isInteger(wbSession.startedAtMs) && wbSession.startedAtMs > 0 &&
          Number.isInteger(wbSession.lastEventAtMs) && wbSession.lastEventAtMs >= wbSession.startedAtMs,
        label: "sessions: s_wb_demo eventCount=2, startedAtMs>0, lastEventAtMs>=startedAtMs",
        detail: show(wbSession),
      },
      {
        ok: firstPage.res.ok && firstPage.res.status === 200 && firstEvents.length === 2 &&
          firstPage.value.nextSeq === 2 &&
          firstEvents.map((entry) => entry.seq).join(",") === "1,2",
        label: "events page: 2 wrappers seq=1,2 nextSeq=2",
        detail: show(firstPage.value),
      },
      {
        ok: firstProblems.length === 0,
        label: "every returned event is schema-valid and seq stays outside the event",
        detail: firstProblems.length ? firstProblems.slice(0, 3).join(" || ") : "2/2 valid",
      },
    ];
    record(
      "S1-C1",
      "ingest happy path, 202 counts, idempotent dropped",
      c1.every((c) => c.ok),
      c1.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @"${S1_BATCH_REL}"`,
    );

    /* ---------------- S1-C2 per-line rejects ---------------- */
    const badStatus = { ...fixtureEvents[0], status: "SUCCESS" };
    const badStatusRes = await postNdjson("/ingest/v1/events", `${JSON.stringify(badStatus)}\n`);
    const badStatusParsed = badStatusRes.ok ? parseJson(badStatusRes.text) : { ok: false };
    const badStatusBody = badStatusParsed.ok ? badStatusParsed.value ?? {} : {};
    const badErrors = Array.isArray(badStatusBody.errors) ? badStatusBody.errors : [];

    const mixedSession = "s_s1_mixed";
    const mixedEvent = {
      ...fixtureEvents[0],
      sessionId: mixedSession,
      traceId: hexRandom(16),
      spanId: hexRandom(8),
      rootEventId: `click_${hexRandom(8)}`,
    };
    const mixedInvalidSchema = { ...mixedEvent, spanId: hexRandom(8), status: "NOT_A_STATUS" };
    const mixedBody = `${JSON.stringify(mixedEvent)}\n{"broken":\n${JSON.stringify(mixedInvalidSchema)}\n`;
    const mixedRes = await postNdjson("/ingest/v1/events", mixedBody);
    const mixedParsed = mixedRes.ok ? parseJson(mixedRes.text) : { ok: false };
    const mixedResult = mixedParsed.ok ? mixedParsed.value ?? {} : {};
    const mixedErrors = Array.isArray(mixedResult.errors) ? mixedResult.errors : [];
    const mixedSessionRes = await getEventsPage(mixedSession, "?afterSeq=0&limit=200");
    const mixedStored = Array.isArray(mixedSessionRes.value.events) ? mixedSessionRes.value.events : [];

    const c2 = [
      {
        ok: badStatusRes.ok && badStatusRes.status === 202 && badStatusBody.accepted === 0 &&
          badStatusBody.rejected === 1 && badStatusBody.dropped === 0 && badErrors.length === 1,
        label: "invalid status line -> 202 {accepted:0,rejected:1,dropped:0}",
        detail: show(badStatusRes.text),
      },
      {
        ok: badErrors.length === 1 && badErrors[0].line === 1 && badErrors[0].code === "schema_violation" &&
          typeof badErrors[0].message === "string" && badErrors[0].message.length <= 200 &&
          !badErrors[0].message.includes(fixtureEvents[0].traceId) && !badErrors[0].message.includes("SUCCESS"),
        label: "errors[] line=1 code=schema_violation, message<=200, no payload echo",
        detail: show(badErrors[0]),
      },
      {
        ok: mixedRes.ok && mixedRes.status === 202 && mixedResult.accepted === 1 &&
          mixedResult.rejected === 2 && mixedResult.dropped === 0,
        label: "mixed batch -> 202 {accepted:1,rejected:2,dropped:0}",
        detail: show(mixedRes.text),
      },
      {
        ok: mixedErrors.length === 2 &&
          mixedErrors.map((e) => e.line).join(",") === "2,3" &&
          mixedErrors[0]?.code === "invalid_json" && mixedErrors[1]?.code === "schema_violation" &&
          mixedErrors.every((e) => typeof e.message === "string" && e.message.length <= 200) &&
          !mixedRes.text.includes(mixedEvent.traceId) && !mixedRes.text.includes("broken"),
        label: "mixed errors line=2 invalid_json, line=3 schema_violation; no echo",
        detail: show(mixedErrors),
      },
      {
        ok: mixedSessionRes.res.ok && mixedSessionRes.res.status === 200 && mixedStored.length === 1 &&
          mixedStored[0].seq === 1 && wrapperProblems(validate, mixedStored, "s_s1_mixed").length === 0,
        label: "the one valid mixed line is stored (seq=1, schema-valid)",
        detail: show(mixedSessionRes.value),
      },
    ];
    record(
      "S1-C2",
      "per-line rejects: invalid status + mixed batch",
      c2.every((c) => c.ok),
      c2.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson" --data-binary @mixed.ndjson`,
    );

    /* ---------------- S1-C3 envelope negatives ---------------- */
    const bigLine = `ECHOMARKER_S1 ${"a".repeat(65 * 1024)}\n`;
    const hugeBody = `ECHOMARKER_S1${"a".repeat(4 * 1024 * 1024 + 1024)}`;
    const bulkLines = Array.from({ length: 1001 }, (_, index) =>
      JSON.stringify({
        ...fixtureEvents[0],
        sessionId: "s_s1_bulk",
        traceId: hexRandom(16),
        spanId: index.toString(16).padStart(16, "0"),
        rootEventId: `click_${hexRandom(8)}`,
        nodeKey: "#ECHOMARKER_S1",
      }),
    ).join("\n") + "\n";

    const r415 = await postNdjson("/ingest/v1/events", batch.text, "text/plain");
    const r415Huge = await postNdjson("/ingest/v1/events", hugeBody, "text/plain");
    const rEmpty = await postNdjson("/ingest/v1/events", "");
    const rBlank = await postNdjson("/ingest/v1/events", "\n");
    const rBulk = await postNdjson("/ingest/v1/events", bulkLines);
    const rBigLine = await postNdjson("/ingest/v1/events", bigLine);
    const rHuge = await postNdjson("/ingest/v1/events", hugeBody);
    const rNonUtf8 = await postNdjson("/ingest/v1/events", Buffer.from([0xff, 0xfe, 0x0a]));
    const bulkSession = await getEventsPage("s_s1_bulk", "?afterSeq=0&limit=200");

    const c3 = [
      ...envelopeChecks(r415, 415, "unsupported_media_type", "text/plain", ["ECHOMARKER_S1"]),
      ...envelopeChecks(r415Huge, 415, "unsupported_media_type", "wrong type + >4MB body (415 wins)", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rEmpty, 400, "bad_request", "empty body", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rBlank, 400, "bad_request", "blank line", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rBulk, 400, "bad_request", "1001 lines", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rBigLine, 413, "payload_too_large", "65KB line", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rHuge, 413, "payload_too_large", ">4MB body", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rNonUtf8, 400, "bad_request", "non-UTF-8 body", []),
      {
        ok: bulkSession.res.ok && bulkSession.res.status === 404,
        label: "rejected 1001-line batch wrote nothing (s_s1_bulk 404)",
        detail: bulkSession.res.ok ? `status=${bulkSession.res.status}` : String(bulkSession.res.error),
      },
    ];
    record(
      "S1-C3",
      "envelope negatives 415/400/413 + no body echo",
      c3.every((c) => c.ok),
      c3.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: text/plain" --data-binary '{}'`,
    );

    /* ---------------- S1-D read-only query ---------------- */
    const sessionsList = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const sessionsListParsed = sessionsList.ok ? parseJson(sessionsList.text) : { ok: false };
    const listed = sessionsListParsed.ok ? sessionsListParsed.value?.sessions : null;
    const listedWb = findSession(listed, S1_WORKBENCH_SESSION);
    const listedMixed = findSession(listed, "s_s1_mixed");

    const pageAll = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200");
    const pageOne = await getEventsPage(S1_WORKBENCH_SESSION, "?limit=1");
    const pageAfter1 = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=1");
    const pageAfter2 = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=2");
    const pageExtra = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200&foo=bar");
    const badLimit0 = await getEventsPage(S1_WORKBENCH_SESSION, "?limit=0");
    const badLimit501 = await getEventsPage(S1_WORKBENCH_SESSION, "?limit=501");
    const badAfterNegative = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=-1");
    const badAfterText = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=abc");
    const unknown = await getEventsPage("s_missing", "");
    const postSessions = await requestBase(COLLECTOR_BASE, "/api/v1/sessions", { method: "POST" });
    const putEvents = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/events`, { method: "PUT" });
    const deleteEvents = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/events`, { method: "DELETE" });
    const graph = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/graph`);
    const replay = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/replay`);
    const stream = await requestBase(COLLECTOR_BASE, "/api/v1/stream");
    const ws = await requestBase(COLLECTOR_BASE, "/ws/v1/events");
    const links = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/links`, { method: "POST" });

    const allEvents = Array.isArray(pageAll.value.events) ? pageAll.value.events : [];
    const d = [
      {
        ok: sessionsList.ok && sessionsList.status === 200 && Boolean(listedWb) && listedWb.eventCount === 2 &&
          Boolean(listedMixed) && listedMixed.eventCount === 1,
        label: "GET /api/v1/sessions: s_wb_demo=2, s_s1_mixed=1",
        detail: show(listed),
      },
      {
        ok: pageAll.res.status === 200 && allEvents.length === 2 && pageAll.value.nextSeq === 2 &&
          allEvents.map((e) => e.seq).join(",") === "1,2" &&
          wrapperProblems(validate, allEvents, "pageAll").length === 0,
        label: "wrapper {seq,event}: 2 schema-valid events, nextSeq=2",
        detail: show(pageAll.value),
      },
      {
        ok: pageOne.res.status === 200 && pageOne.value.events?.length === 1 &&
          pageOne.value.events[0].seq === 1 && pageOne.value.nextSeq === 1,
        label: "limit=1 -> 1 event seq=1 nextSeq=1",
        detail: show(pageOne.value),
      },
      {
        ok: pageAfter1.res.status === 200 && pageAfter1.value.events?.length === 1 &&
          pageAfter1.value.events[0].seq === 2 && pageAfter1.value.nextSeq === 2,
        label: "afterSeq=1 -> seq=2 nextSeq=2",
        detail: show(pageAfter1.value),
      },
      {
        ok: pageAfter2.res.status === 200 && pageAfter2.value.events?.length === 0 && pageAfter2.value.nextSeq === 2,
        label: "afterSeq=2 -> empty page nextSeq=2",
        detail: show(pageAfter2.value),
      },
      {
        ok: pageExtra.res.status === 200 && pageExtra.value.events?.length === 2,
        label: "unknown query param ignored",
        detail: `status=${pageExtra.res.status}`,
      },
      ...envelopeChecks(badLimit0.res, 400, "bad_request", "limit=0", []),
      ...envelopeChecks(badLimit501.res, 400, "bad_request", "limit=501", []),
      ...envelopeChecks(badAfterNegative.res, 400, "bad_request", "afterSeq=-1", []),
      ...envelopeChecks(badAfterText.res, 400, "bad_request", "afterSeq=abc", []),
      ...envelopeChecks(unknown.res, 404, "not_found", "unknown session", []),
      {
        ok: postSessions.ok && postSessions.status === 405,
        label: "POST /api/v1/sessions -> 405",
        detail: `status=${postSessions.status}`,
      },
      {
        ok: putEvents.ok && putEvents.status === 405 && deleteEvents.ok && deleteEvents.status === 405,
        label: "PUT/DELETE .../events -> 405",
        detail: `PUT=${putEvents.status} DELETE=${deleteEvents.status}`,
      },
      {
        ok: graph.ok && graph.status === 404 && replay.ok && replay.status === 404 &&
          stream.ok && stream.status === 404 && ws.ok && ws.status === 404 &&
          links.ok && links.status === 404,
        label: "graph/replay/stream/ws/links not registered -> 404",
        detail: `graph=${graph.status} replay=${replay.status} stream=${stream.status} ws=${ws.status} links=${links.status}`,
      },
    ];
    record(
      "S1-D",
      "read-only query shapes, paging, 400/404/405, reserved routes",
      d.every((c) => c.ok),
      d.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200"`,
    );

    /* ---------------- S1-F workbench fake-batch path ---------------- */
    const wbTraceId = hexRandom(16);
    const wbClickId = hexRandom(8);
    const wbFetchId = hexRandom(8);
    const wbRoot = `click_${hexRandom(8)}`;
    const wbClick = {
      ...fixtureEvents[0],
      traceId: wbTraceId,
      spanId: wbClickId,
      rootEventId: wbRoot,
    };
    const wbFetch = {
      ...fixtureEvents[1],
      traceId: wbTraceId,
      spanId: wbFetchId,
      parentSpanId: wbClickId,
      rootEventId: wbRoot,
    };
    const wbProblems = wrapperProblems(validate, [{ seq: 0, event: wbClick }, { seq: 1, event: wbFetch }], "generated workbench batch");
    const wbPost = await postNdjson("/ingest/v1/events", `${JSON.stringify(wbClick)}\n${JSON.stringify(wbFetch)}\n`);
    const wbPostParsed = wbPost.ok ? parseJson(wbPost.text) : { ok: false };
    const wbResult = wbPostParsed.ok ? wbPostParsed.value ?? {} : {};
    const wbSessionsRes = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const wbSessionsParsed = wbSessionsRes.ok ? parseJson(wbSessionsRes.text) : { ok: false };
    const wbSessions = wbSessionsParsed.ok ? wbSessionsParsed.value?.sessions : null;
    const wbCount = findSession(wbSessions, S1_WORKBENCH_SESSION)?.eventCount ?? -1;
    const wbPage = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200");
    const wbEvents = Array.isArray(wbPage.value.events) ? wbPage.value.events : [];
    const wbNew = wbEvents.slice(2);

    const f = [
      {
        ok: wbProblems.length === 0,
        label: "generated batch is schema-valid (same shape as fixtures/frontend-fake-batch.ndjson)",
        detail: wbProblems.length ? wbProblems.join(" || ") : "2/2 valid",
      },
      {
        ok: wbPost.ok && wbPost.status === 202 && wbResult.accepted === 2 && wbResult.rejected === 0 && wbResult.dropped === 0,
        label: "POST fake batch -> 202 accepted=2",
        detail: show(wbPost.text),
      },
      {
        ok: wbCount === 4,
        label: "sessions: s_wb_demo eventCount=4 after the second (workbench) click",
        detail: `eventCount=${wbCount}`,
      },
      {
        ok: wbPage.res.status === 200 && wbEvents.length === 4 &&
          wbEvents.map((e) => e.seq).join(",") === "1,2,3,4" && wbPage.value.nextSeq === 4,
        label: "read-back page keeps seq order 1,2,3,4 nextSeq=4",
        detail: show(wbPage.value),
      },
      {
        ok: wbNew.length === 2 && wbNew[0].seq === 3 && wbNew[1].seq === 4 &&
          wbNew[0].event.kind === "ui_event" && wbNew[0].event.parentSpanId === null &&
          wbNew[0].event.traceId === wbTraceId && wbNew[0].event.rootEventId === wbRoot &&
          wbNew[1].event.kind === "fetch" && wbNew[1].event.parentSpanId === wbClickId &&
          wbNew[1].event.traceId === wbTraceId && wbNew[1].event.rootEventId === wbRoot &&
          wbNew.every((entry) => entry.event.confidence === "EXACT" && entry.event.status === "OK"),
        label: "new page entries are the fresh ui_event root + fetch child (new trace/root, no merge)",
        detail: show(wbNew),
      },
      {
        ok: wbTraceId !== fixtureEvents[0].traceId,
        label: "fresh click uses a new traceId (repeated clicks never collide)",
        detail: `${wbTraceId}`,
      },
    ];
    record(
      "S1-F",
      "workbench fake-batch path",
      f.every((c) => c.ok),
      f.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson" --data-binary @fresh-batch.ndjson`,
    );
  } finally {
    await stopServer(collector);
    const freed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    console.log(`        collector stopped; 8601 ${freed ? "free" : "STILL LISTENING"}`);
    activeServer = null;
  }
}

/* ------------------------------------------------------------------ */
/* S1-E agent E2E + fail-open                                          */
/* ------------------------------------------------------------------ */

async function checkS1E(validate) {
  section("S1-E agent E2E + fail-open");
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const demoJar = abs(DEMO_JAR_REL);
  const agentJar = abs(AGENT_JAR_REL);
  const pre8601 = listeningOn(8601);
  const pre8080 = listeningOn(8080);
  const preconditions = [
    { ok: pre8601.supported && pre8601.lines.length === 0, label: "port 8601 free", detail: pre8601.lines.join(" | ") || "no listener" },
    { ok: pre8080.supported && pre8080.lines.length === 0, label: "port 8080 free", detail: pre8080.lines.join(" | ") || "no listener" },
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(demoJar), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(agentJar), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists", detail: JDK8_JAVA },
  ];
  if (!preconditions.every((c) => c.ok)) {
    record("S1-E1", "agent online: 2 cancel calls -> exactly 2 controller spans", false,
      preconditions.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`), null);
    record("S1-E2", "fail-open: collector stopped, cancel still 200 fast, demo alive", false,
      [{ ok: false, label: "preconditions", detail: "failed" }], null);
    return;
  }

  let collector = null;
  let demo = null;
  try {
    collector = startJavaServer("collector(8601)", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!health) {
      record("S1-E1", "agent online: 2 cancel calls -> exactly 2 controller spans", false,
        [{ ok: false, label: "collector health", detail: "timeout" }], null);
      record("S1-E2", "fail-open: collector stopped, cancel still 200 fast, demo alive", false,
        [{ ok: false, label: "collector not started", detail: "health timeout" }], null);
      return;
    }

    const startupBeforeAgentSession = await getEventsPage(S1_AGENT_SESSION, "?afterSeq=0&limit=200");
    demo = startJavaServer("demo-backend(8080)+agent", JDK8_JAVA, [
      `-javaagent:${agentJar}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      `-Dtraceboard.sessionId=${S1_AGENT_SESSION}`,
      "-jar",
      demoJar,
    ], abs("demo/buggy-shop-boot-vue/backend"));

    const orders = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    const ordersBody = orders ? parseJson(orders.text) : { ok: false };
    const firstOrder = ordersBody.ok ? ordersBody.value?.data?.[0] : undefined;
    const premainLine = demo.log.text.split(/\r?\n/).find((line) => line.includes("premain installed")) ?? "";
    const transformLine = demo.log.text.split(/\r?\n/).find((line) => line.includes("transformed com.example.shop.controller.OrderController")) ?? "";

    const cancel1 = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const cancel2 = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const cancel1Body = cancel1.ok ? parseJson(cancel1.text) : { ok: false };
    const cancel2Body = cancel2.ok ? parseJson(cancel2.text) : { ok: false };

    const polled = await pollUntil(async () => {
      const page = await getEventsPage(S1_AGENT_SESSION, "?afterSeq=0&limit=200");
      return page.res.ok && page.res.status === 200 && Array.isArray(page.value.events) && page.value.events.length >= 2
        ? page.value
        : null;
    }, 15000, 400);
    await sleep(700);
    const finalPage = await getEventsPage(S1_AGENT_SESSION, "?afterSeq=0&limit=200");
    const spans = Array.isArray(finalPage.value.events) ? finalPage.value.events.map((entry) => entry.event) : [];

    const spanIds = spans.map((span) => span.spanId);
    const traceIds = spans.map((span) => span.traceId);
    const perSpanProblems = [];
    for (const span of spans) {
      if (validate && !validate(span)) perSpanProblems.push(`${span.spanId} schema invalid`);
      if (!Object.prototype.hasOwnProperty.call(span, "parentSpanId") || span.parentSpanId !== null) perSpanProblems.push(`${span.spanId} parentSpanId!=null`);
      if (span.kind !== "controller") perSpanProblems.push(`${span.spanId} kind=${span.kind}`);
      if (span.nodeKey !== S1_AGENT_NODE_KEY) perSpanProblems.push(`${span.spanId} nodeKey=${span.nodeKey}`);
      if (span.status !== "OK") perSpanProblems.push(`${span.spanId} status=${span.status}`);
      if (span.confidence !== "LOST") perSpanProblems.push(`${span.spanId} confidence=${span.confidence}`);
      if (!Array.isArray(span.flags) || !span.flags.includes("LOST_BACKEND") || span.flags.length !== 3) {
        perSpanProblems.push(`${span.spanId} flags=${show(span.flags)}`);
      }
      if (span.rootEventId !== `click_lost_${span.spanId}`) perSpanProblems.push(`${span.spanId} rootEventId=${span.rootEventId}`);
      if (!(span.durNs > 0)) perSpanProblems.push(`${span.spanId} durNs=${span.durNs}`);
      if (typeof span.return?.type !== "string" || span.return.type.length === 0) perSpanProblems.push(`${span.spanId} return.type empty`);
      if (Object.prototype.hasOwnProperty.call(span, "values") || Object.prototype.hasOwnProperty.call(span, "sideEffects")) {
        perSpanProblems.push(`${span.spanId} has values/sideEffects`);
      }
      if (span.source && span.source.file !== "OrderController.java") perSpanProblems.push(`${span.spanId} source.file=${span.source.file}`);
    }

    const agentChecks = [
      { ok: Boolean(orders) && firstOrder?.id === 1 && firstOrder?.status === "CREATED", label: "demo started with -javaagent; GET /api/orders 200 id=1", detail: orders ? show(orders.text) : "timeout" },
      { ok: startupBeforeAgentSession.res.ok && startupBeforeAgentSession.res.status === 404, label: "s_s1agent unknown before any cancel (404)", detail: `status=${startupBeforeAgentSession.res.status}` },
      { ok: premainLine.includes(`sessionId=${S1_AGENT_SESSION}`) && premainLine.includes("OrderController#cancel(long)"), label: "agent premain installed for the single #cancel(long) target", detail: premainLine.slice(0, 240) },
      { ok: transformLine.length > 0, label: "Byte Buddy transform hit OrderController", detail: transformLine.slice(0, 240) },
      { ok: cancel1.ok && cancel1.status === 200 && deepEqual(cancel1Body.value, { data: true }), label: "cancel #1 -> 200 {data:true}", detail: cancel1.ok ? show(cancel1.text) : String(cancel1.error) },
      { ok: cancel2.ok && cancel2.status === 200 && deepEqual(cancel2Body.value, { data: true }), label: "cancel #2 -> 200 {data:true}", detail: cancel2.ok ? show(cancel2.text) : String(cancel2.error) },
      { ok: Boolean(polled), label: "read back s_s1agent events within 15s", detail: polled ? `events=${polled.events.length}` : "timeout" },
      { ok: spans.length === 2, label: "exactly 2 controller spans (no synthetic startup events)", detail: `spans=${spans.length}` },
      { ok: perSpanProblems.length === 0, label: "each span: controller/#cancel/OK/LOST/LOST_BACKEND/click_lost_<spanId>/durNs>0/3 flags", detail: perSpanProblems.slice(0, 4).join(" || ") || "2/2 conformant" },
      { ok: new Set(spanIds).size === spanIds.length && spanIds.every((id) => /^[0-9a-f]{16}$/.test(id)), label: "spanIds distinct 16 lowercase hex", detail: spanIds.join(",") },
      { ok: new Set(traceIds).size === traceIds.length && traceIds.every((id) => /^[0-9a-f]{32}$/.test(id)), label: "traceIds distinct 32 lowercase hex (one isolated root per call)", detail: traceIds.join(",") },
      { ok: finalPage.value.nextSeq === 2 && spans.every((span) => span.sessionId === S1_AGENT_SESSION), label: "nextSeq=2, sessionId=s_s1agent", detail: `nextSeq=${finalPage.value.nextSeq}` },
    ];
    record(
      "S1-E1",
      "agent online: 2 cancel calls -> exactly 2 controller spans",
      agentChecks.every((c) => c.ok),
      agentChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `"${JDK8_JAVA}" -javaagent:"${AGENT_JAR_REL}" -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events -Dtraceboard.sessionId=${S1_AGENT_SESSION} -jar "${DEMO_JAR_REL}"`,
    );

    /* -------- fail-open: stop collector, demo must stay healthy -------- */
    await stopServer(collector);
    const collectorFreed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    await sleep(500);

    const startedAt = Date.now();
    const failOpenCancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const failOpenMs = Date.now() - startedAt;
    const failOpenBody = failOpenCancel.ok ? parseJson(failOpenCancel.text) : { ok: false };
    const aliveOrders = await tryRequest(8080, "/api/orders", { method: "GET" });
    const unknownCancel = await tryRequest(8080, "/api/orders/999/cancel", { method: "POST" });
    const unknownBody = unknownCancel.ok ? parseJson(unknownCancel.text) : { ok: false };
    await sleep(1000);

    const failChecks = [
      { ok: Boolean(collectorFreed), label: "collector stopped, 8601 free", detail: collectorFreed ? "no LISTENING socket" : listeningOn(8601).lines.join(" | ") },
      { ok: failOpenCancel.ok && failOpenCancel.status === 200 && deepEqual(failOpenBody.value, { data: true }), label: "POST cancel with collector down -> 200 {data:true}", detail: failOpenCancel.ok ? show(failOpenCancel.text) : String(failOpenCancel.error) },
      { ok: failOpenMs < 3000, label: "fail-open latency < 3000ms", detail: `${failOpenMs}ms` },
      { ok: aliveOrders.ok && aliveOrders.status === 200, label: "demo process alive after collector stop", detail: `GET /api/orders -> ${aliveOrders.status}` },
      { ok: unknownCancel.ok && unknownCancel.status === 404 && unknownBody.value?.data === false, label: "S0 regression: unknown id still 404 {data:false}", detail: unknownCancel.ok ? show(unknownCancel.text) : String(unknownCancel.error) },
      { ok: /\[traceboard-agent\]\s+ingest_rejected=\d+\s+status=(io_error|\d+)/.test(demo.log.text), label: "sender counted the rejected send on stderr (not silent)", detail: (demo.log.text.match(/\[traceboard-agent\]\s+ingest_rejected=[^\r\n]*/) ?? ["not found"])[0] },
    ];
    record(
      "S1-E2",
      "fail-open: collector stopped, cancel still 200 fast, demo alive",
      failChecks.every((c) => c.ok),
      failChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `stop collector, then: curl -X POST http://localhost:8080/api/orders/1/cancel`,
    );
  } finally {
    await stopServer(demo);
    await stopServer(collector);
    const freed8080 = await pollUntil(() => listeningOn(8080).lines.length === 0, 30000, 400);
    const freed8601 = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    console.log(`        demo/collector stopped; 8080 ${freed8080 ? "free" : "STILL LISTENING"}, 8601 ${freed8601 ? "free" : "STILL LISTENING"}`);
    activeServer = null;
  }
}

/* ------------------------------------------------------------------ */
/* S1-A fixtures + expected facts                                      */
/* ------------------------------------------------------------------ */

function checkS1A(validate) {
  section("S1-A fixtures + expected facts");
  const checks = [];
  const batch = readTextFileMeta(S1_BATCH_REL);
  const agent = readTextFileMeta(S1_AGENT_SPAN_REL);
  let batchEvents = [];
  let agentSpan = null;
  try {
    batchEvents = batch.lines.map((line) => JSON.parse(line));
  } catch (error) {
    checks.push({ ok: false, label: "frontend-fake-batch.ndjson parses", detail: error.message });
  }
  try {
    agentSpan = JSON.parse(agent.lines[0]);
  } catch (error) {
    checks.push({ ok: false, label: "agent-controller-span.json parses", detail: error.message });
  }

  checks.push({ ok: batch.lines.length === 2, label: "fake batch has exactly 2 non-empty lines", detail: `lines=${batch.lines.length}` });
  checks.push({ ok: agent.lines.length === 1, label: "agent span is exactly 1 JSON object line", detail: `lines=${agent.lines.length}` });
  for (const [name, file] of [["fake batch", batch], ["agent span", agent]]) {
    checks.push({ ok: !file.hasBom, label: `${name}: UTF-8 without BOM`, detail: `hasBom=${file.hasBom}` });
    checks.push({ ok: file.crCount === 0, label: `${name}: no CR bytes`, detail: `\\r count=${file.crCount}` });
    checks.push({ ok: file.endsWithNewline, label: `${name}: trailing LF`, detail: `lastByte=0x${file.buffer.length ? file.buffer[file.buffer.length - 1].toString(16) : "??"}` });
    checks.push({ ok: file.emptyLineCount === 0, label: `${name}: no empty lines`, detail: `emptyLines=${file.emptyLineCount}` });
  }

  const invalid = [];
  if (validate) {
    batchEvents.forEach((event, index) => {
      if (!validate(event)) invalid.push(`batch line ${index + 1}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
    });
    if (agentSpan && !validate(agentSpan)) invalid.push(`agent span: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  }
  checks.push({
    ok: validate !== null && batchEvents.length === 2 && Boolean(agentSpan) && invalid.length === 0,
    label: "3/3 fixture events validate against the frozen schema (Ajv 2020-12 strict)",
    detail: invalid.length ? invalid.join(" || ") : "3/3 valid",
  });

  if (batchEvents.length === 2) {
    const [click, fetch] = batchEvents;
    checks.push({
      ok: click.kind === "ui_event" && click.nodeKey === "#btn-s1-fake" && click.parentSpanId === null &&
        click.startNs === 0 && click.durNs === 12000000 && click.status === "OK" && click.return === null,
      label: "fake click: ui_event #btn-s1-fake root [0,12ms], return null",
      detail: `${click.kind} ${click.nodeKey} startNs=${click.startNs} durNs=${click.durNs}`,
    });
    checks.push({
      ok: fetch.kind === "fetch" && fetch.nodeKey === "POST /api/orders/1/cancel" &&
        fetch.parentSpanId === click.spanId && fetch.startNs >= click.startNs &&
        fetch.startNs + fetch.durNs <= click.startNs + click.durNs &&
        deepEqual(fetch.return, { type: "http", value: 200 }),
      label: "fake fetch: child of click, interval nested, return {type:http,value:200}",
      detail: `[${fetch.startNs},${fetch.startNs + fetch.durNs}] inside [${click.startNs},${click.startNs + click.durNs}]`,
    });
    checks.push({
      ok: click.sessionId === S1_WORKBENCH_SESSION && fetch.sessionId === S1_WORKBENCH_SESSION &&
        click.traceId === fetch.traceId && click.rootEventId === fetch.rootEventId &&
        click.confidence === "EXACT" && fetch.confidence === "EXACT" &&
        [click, fetch].every((event) => Array.isArray(event.flags) &&
          event.flags.includes("SKELETON") && event.flags.includes("S1_WALKING_SKELETON")),
      label: "fake batch: same session/trace/root, EXACT + SKELETON flags",
      detail: `${click.traceId} ${click.rootEventId}`,
    });
  }

  if (agentSpan) {
    checks.push({
      ok: agentSpan.kind === "controller" && agentSpan.nodeKey === S1_AGENT_NODE_KEY && agentSpan.nodeKey.endsWith("#cancel"),
      label: "agent span: kind=controller nodeKey ...OrderController#cancel",
      detail: `${agentSpan.kind} ${agentSpan.nodeKey}`,
    });
    checks.push({
      ok: agentSpan.confidence === "LOST" && agentSpan.parentSpanId === null && agentSpan.status === "OK",
      label: "agent span: LOST, isolated root (parentSpanId null), OK",
      detail: `${agentSpan.confidence} parent=${agentSpan.parentSpanId} status=${agentSpan.status}`,
    });
    checks.push({
      ok: Array.isArray(agentSpan.flags) && agentSpan.flags.length === 3 &&
        agentSpan.flags.includes("SKELETON") && agentSpan.flags.includes("S1_ONE_METHOD") &&
        agentSpan.flags.includes("LOST_BACKEND"),
      label: "agent span flags exactly [SKELETON,S1_ONE_METHOD,LOST_BACKEND]",
      detail: show(agentSpan.flags),
    });
    checks.push({
      ok: agentSpan.rootEventId === `click_lost_${agentSpan.spanId}` &&
        /^click_[A-Za-z0-9_-]{8,}$/.test(agentSpan.rootEventId) &&
        agentSpan.rootEventId !== `click_${agentSpan.spanId}`,
      label: "agent span rootEventId is the synthetic click_lost_<spanId> placeholder",
      detail: `${agentSpan.rootEventId} (spanId=${agentSpan.spanId})`,
    });
    checks.push({
      ok: /^[0-9a-f]{32}$/.test(agentSpan.traceId) && /^[0-9a-f]{16}$/.test(agentSpan.spanId) &&
        agentSpan.durNs > 0 && agentSpan.startNs >= 0,
      label: "agent span ids/regEx/durations valid (durNs>0)",
      detail: `traceId=${agentSpan.traceId} spanId=${agentSpan.spanId} durNs=${agentSpan.durNs}`,
    });
    checks.push({
      ok: typeof agentSpan.return?.type === "string" && agentSpan.return.type.length > 0 &&
        !Object.prototype.hasOwnProperty.call(agentSpan, "values") &&
        !Object.prototype.hasOwnProperty.call(agentSpan, "sideEffects") &&
        !Object.prototype.hasOwnProperty.call(agentSpan, "reason"),
      label: "agent span has return.type and no values/sideEffects/reason",
      detail: show(agentSpan.return),
    });
    if (agentSpan.source) {
      checks.push({
        ok: agentSpan.source.file === "OrderController.java",
        label: "agent span source.file is OrderController.java (line not compared)",
        detail: `${agentSpan.source.file}:${agentSpan.source.line}`,
      });
    }
    if (batchEvents.length === 2) {
      const sessions = new Set([...batchEvents.map((e) => e.sessionId), agentSpan.sessionId]);
      const traces = new Set([...batchEvents.map((e) => e.traceId), agentSpan.traceId]);
      checks.push({
        ok: sessions.size === 2 && traces.size === 2,
        label: "fake batch and agent span share neither sessionId nor traceId (no correlation)",
        detail: `sessions=${[...sessions].join(",")} traces=${traces.size}`,
      });
    }
  }

  const seqNegative = validate && batchEvents[0] ? (() => {
    const copy = { ...batchEvents[0], seq: 1 };
    return { ok: validate(copy) === false, label: "negative: event carrying seq is rejected" };
  })() : { ok: false, label: "negative: seq rejection (validator unavailable)" };
  checks.push(seqNegative);

  /* ---- expected-facts.json NEW shape (globalAssertions.<source> + facts) ---- */
  let factsDoc = null;
  try {
    factsDoc = JSON.parse(readFileSync(abs(S1_FACTS_REL), "utf8"));
  } catch (error) {
    checks.push({ ok: false, label: "expected-facts.json parses", detail: error.message });
  }
  if (factsDoc) {
    const sourceData = {
      frontendBatch: { rel: S1_BATCH_REL, lines: batch.lines.length, events: batchEvents },
      agentSpan: { rel: S1_AGENT_SPAN_REL, lines: agent.lines.length, events: agentSpan ? [agentSpan] : [] },
    };
    checks.push({
      ok: factsDoc.caseId === "s1-walking-skeleton" && factsDoc.stage === "S1",
      label: "expected-facts identifies caseId/stage",
      detail: `${factsDoc.caseId} / ${factsDoc.stage}`,
    });

    const declaredSources = Object.entries(factsDoc.sources ?? {});
    checks.push({ ok: declaredSources.length === 2, label: "expected-facts declares 2 sources", detail: declaredSources.map(([k]) => k).join(",") });
    for (const [name, declared] of declaredSources) {
      const data = sourceData[name];
      if (!data) {
        checks.push({ ok: false, label: `source ${name} known to the S1 consumer`, detail: "unknown source" });
        continue;
      }
      checks.push({
        ok: declared.file === data.rel && declared.lineCount === data.lines && declared.eventCount === data.events.length,
        label: `source ${name}: file/lineCount/eventCount match the actual fixture`,
        detail: `file=${declared.file} lines=${data.lines}/${declared.lineCount} events=${data.events.length}/${declared.eventCount}`,
      });
    }

    const globalFails = [];
    for (const [name, assertions] of Object.entries(factsDoc.globalAssertions ?? {})) {
      const data = sourceData[name];
      if (!data) {
        globalFails.push(`${name}: unknown source`);
        continue;
      }
      const events = data.events;
      for (const [key, expected] of Object.entries(assertions)) {
        let ok = false;
        let actual = "";
        if (key === "sessionId") { ok = events.length > 0 && events.every((e) => e.sessionId === expected); actual = [...new Set(events.map((e) => e.sessionId))].join(","); }
        else if (key === "eventCount") { ok = events.length === expected; actual = String(events.length); }
        else if (key === "traceId") { ok = events.length > 0 && events.every((e) => e.traceId === expected); actual = [...new Set(events.map((e) => e.traceId))].join(","); }
        else if (key === "rootEventId") { ok = events.length > 0 && events.every((e) => e.rootEventId === expected); actual = [...new Set(events.map((e) => e.rootEventId))].join(","); }
        else if (key === "confidenceAllExact") { ok = events.length > 0 && events.every((e) => e.confidence === "EXACT"); actual = [...new Set(events.map((e) => e.confidence))].join(","); }
        else if (key === "statusAllOk") { ok = events.length > 0 && events.every((e) => e.status === "OK"); actual = [...new Set(events.map((e) => e.status))].join(","); }
        else if (key === "parentChain") {
          ok = Array.isArray(expected) && expected.length === events.length &&
            expected.every((spanId, index) => events[index].spanId === spanId) &&
            expected.slice(1).every((spanId, index) => events[index + 1].parentSpanId === events[index].spanId);
          actual = events.map((e) => `${e.spanId}<-${e.parentSpanId}`).join(",");
        } else if (key === "rootSpanId") {
          const roots = events.filter((e) => e.parentSpanId === null);
          ok = roots.length === 1 && roots[0].spanId === expected;
          actual = roots.map((e) => e.spanId).join(",");
        } else if (key === "intervalContainment") {
          const byId = new Map(events.map((e) => [e.spanId, e]));
          ok = expected === true && events.filter((e) => e.parentSpanId !== null).every((e) => {
            const parent = byId.get(e.parentSpanId);
            return parent && e.startNs >= parent.startNs && e.startNs + e.durNs <= parent.startNs + parent.durNs;
          });
          actual = `${events.filter((e) => e.parentSpanId !== null).length} child spans`;
        } else if (key === "flagsInclude") {
          ok = Array.isArray(expected) && events.length > 0 &&
            events.every((e) => expected.every((flag) => Array.isArray(e.flags) && e.flags.includes(flag)));
          actual = [...new Set(events.flatMap((e) => e.flags ?? []))].join(",");
        } else if (key === "kind") { ok = events.length === 1 && events[0].kind === expected; actual = events.map((e) => e.kind).join(","); }
        else if (key === "nodeKey") { ok = events.length === 1 && events[0].nodeKey === expected; actual = events.map((e) => e.nodeKey).join(","); }
        else if (key === "confidence") { ok = events.length === 1 && events[0].confidence === expected; actual = events.map((e) => e.confidence).join(","); }
        else if (key === "status") { ok = events.length === 1 && events[0].status === expected; actual = events.map((e) => e.status).join(","); }
        else if (key === "parentSpanId") { ok = events.length === 1 && events[0].parentSpanId === expected; actual = String(events[0]?.parentSpanId); }
        else if (key === "rootEventIdEquals") { ok = events.length === 1 && events[0].rootEventId === expected; actual = String(events[0]?.rootEventId); }
        else if (key === "rootEventIdPrefix") { ok = events.length === 1 && typeof events[0].rootEventId === "string" && events[0].rootEventId.startsWith(expected); actual = String(events[0]?.rootEventId); }
        else if (key === "rootEventIdSuffixIsSpanId") { ok = expected === true && events.length === 1 && events[0].rootEventId.endsWith(events[0].spanId); actual = String(events[0]?.rootEventId); }
        else if (key === "durNsPositive") { ok = expected === true && events.length === 1 && events[0].durNs > 0; actual = String(events[0]?.durNs); }
        else if (key === "noExceptionPayload") { ok = expected === true && !events.some((e) => /exception|stack|error/i.test(Object.keys(e).join(","))); actual = Object.keys(events[0] ?? {}).join(","); }
        else if (key === "noValues") { ok = expected === true && !events.some((e) => Object.prototype.hasOwnProperty.call(e, "values")); actual = "values absent"; }
        else if (key === "noSideEffects") { ok = expected === true && !events.some((e) => Object.prototype.hasOwnProperty.call(e, "sideEffects")); actual = "sideEffects absent"; }
        else { ok = false; actual = "unknown assertion key"; }
        if (!ok) globalFails.push(`${name}.${key} expected=${show(expected)} actual=${actual}`);
      }
    }
    checks.push({
      ok: globalFails.length === 0,
      label: "globalAssertions.<source> fully evaluated (no unknown keys)",
      detail: globalFails.length ? globalFails.slice(0, 4).join(" || ") : "0 failures",
    });

    const factList = Array.isArray(factsDoc.facts) ? factsDoc.facts : [];
    const factFails = [];
    for (const fact of factList) {
      const data = sourceData[fact.source];
      if (!data) { factFails.push(`${fact.id}: unknown source ${fact.source}`); continue; }
      const matches = data.events.filter((event) => event.kind === fact.kind && event.nodeKey === fact.nodeKey);
      if (matches.length !== 1) { factFails.push(`${fact.id}: matches=${matches.length}`); continue; }
      if (matches[0].status !== fact.status) factFails.push(`${fact.id}: status=${matches[0].status} expected=${fact.status}`);
      const lookup = getByPath(matches[0], fact.assert?.path);
      if (!lookup.found || !deepEqual(lookup.value, fact.assert?.value)) {
        factFails.push(`${fact.id}: ${fact.assert?.path}=${lookup.found ? show(lookup.value) : "not found"} expected=${show(fact.assert?.value)}`);
      }
      if (typeof fact.summary !== "string" || fact.summary.trim().length === 0) factFails.push(`${fact.id}: empty summary`);
    }
    checks.push({
      ok: factList.length === 8 && factFails.length === 0,
      label: "all 8 facts locate a unique event and deep-equal their assertion",
      detail: factFails.length ? factFails.slice(0, 4).join(" || ") : `facts=${factList.length}, 0 failures`,
    });
  }

  gate(
    "S1-A",
    "S1 fixtures + expected-facts consumer (NEW globalAssertions shape)",
    checks,
    `sha256sum "${S1_BATCH_REL}" "${S1_AGENT_SPAN_REL}" "${S1_FACTS_REL}"`,
  );
}

/* ------------------------------------------------------------------ */
/* S1-B build artifacts                                                */
/* ------------------------------------------------------------------ */

function checkS1B(builds, validate) {
  section("S1-B build artifacts");
  const checks = [];
  const agentJar = abs(AGENT_JAR_REL);
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const workbenchDist = distTextFiles(WORKBENCH_DIST_REL).map((f) => f.text).join("\n");

  checks.push({ ok: builds.root === true, label: "root reactor mvn package (JDK21) exit 0", detail: "see V2a" });
  checks.push({ ok: builds.workbenchCi === true && builds.workbenchBuild === true, label: "workbench npm ci && npm run build exit 0", detail: "see V2c-1/V2c-2" });
  checks.push({ ok: builds.demoBackend === true, label: "demo backend (JDK8) build exit 0", detail: "see V2b" });
  checks.push({ ok: builds.demoFrontendCi === true && builds.demoFrontendBuild === true, label: "demo frontend build exit 0", detail: "see V2d-1/V2d-2" });

  const agentEntries = existsSync(agentJar) ? zipEntries(agentJar) : { ok: false, entries: [], stderr: "missing" };
  const shaded = agentEntries.entries.filter((entry) => entry.startsWith("io/traceboard/agent/shaded/net/bytebuddy/") && entry.endsWith(".class"));
  const unrelocated = agentEntries.entries.filter((entry) => entry.startsWith("net/bytebuddy/") || entry === "net/bytebuddy");
  checks.push({ ok: agentEntries.ok, label: "agent jar readable (unzip -Z1)", detail: agentEntries.ok ? `${agentEntries.entries.length} entries` : agentEntries.stderr });
  checks.push({
    ok: shaded.length > 0,
    label: "shaded Byte Buddy present (io/traceboard/agent/shaded/net/bytebuddy/**)",
    detail: shaded.length ? `${shaded.length} classes, e.g. ${shaded[0]}` : "missing",
  });
  checks.push({
    ok: unrelocated.length === 0,
    label: "no unrelocated net/bytebuddy entries",
    detail: unrelocated.length ? unrelocated.slice(0, 4).join(",") : "0",
  });

  if (existsSync(agentJar)) {
    const manifest = runExe("unzip", ["-p", agentJar, "META-INF/MANIFEST.MF"]);
    const premain = (manifest.stdout || "").split(/\r?\n/).find((line) => /^Premain-Class:/i.test(line.trim())) ?? "";
    checks.push({
      ok: manifest.code === 0 && /io\.traceboard\.agent\.TraceAgent/.test(premain),
      label: "MANIFEST Premain-Class: io.traceboard.agent.TraceAgent",
      detail: premain.trim() || `unzip exit=${manifest.code}`,
    });
    checks.push({
      ok: !/^Agent-Class:/im.test(manifest.stdout || ""),
      label: "MANIFEST has no Agent-Class (no attach API)",
      detail: /^Agent-Class:/im.test(manifest.stdout || "") ? "present (BAD)" : "absent",
    });
  }
  checks.push({
    ok: !existsSync(abs("agent/dependency-reduced-pom.xml")),
    label: "agent/dependency-reduced-pom.xml absent",
    detail: existsSync(abs("agent/dependency-reduced-pom.xml")) ? "present (BAD)" : "absent",
  });

  const javap = existsSync(JDK21_JAVAP)
    ? runExe(JDK21_JAVAP, ["-verbose", "-classpath", agentJar, "io.traceboard.agent.TraceAgent"])
    : { stdout: "", stderr: "javap missing" };
  const major = Number((javap.stdout.match(/major version:\s*(\d+)/) ?? [])[1]);
  checks.push({ ok: major === 52, label: "agent jar class major version 52", detail: `major=${Number.isNaN(major) ? "?" : major}` });

  const schemaInJar = existsSync(collectorJar)
    ? runExe("unzip", ["-p", collectorJar, "BOOT-INF/classes/schema/traceboard.event.v1.json"])
    : { code: 1, stdout: "", stderr: "collector jar missing" };
  const jarSchemaHash = schemaInJar.code === 0 ? sha256Text(schemaInJar.stdout) : "unreadable";
  const repoSchemaHash = sha256File(abs(SCHEMA_REL));
  const collectorEntries = existsSync(collectorJar) ? zipEntries(collectorJar) : { ok: false, entries: [] };
  const schemaCopies = collectorEntries.entries.filter((entry) => entry.endsWith("schema/traceboard.event.v1.json"));
  checks.push({
    ok: schemaInJar.code === 0 && jarSchemaHash === repoSchemaHash,
    label: "collector jar schema byte-identical to repo schema (unzip -p sha256)",
    detail: `jar=${jarSchemaHash} repo=${repoSchemaHash}`,
  });
  checks.push({
    ok: schemaCopies.length === 1,
    label: "collector jar contains exactly one schema copy",
    detail: schemaCopies.join(",") || "none",
  });
  checks.push({
    ok: !existsSync(abs("server/collector/src/main/resources/schema")),
    label: "no schema copy under server/collector/src/main/resources",
    detail: "absent",
  });

  const distTokens = ["发送假点击/请求", "Walking skeleton", "nodeKey", "seq", "btn-s1-fake", "no correlation yet"];
  for (const token of distTokens) {
    checks.push({
      ok: workbenchDist.includes(token),
      label: `workbench dist contains "${token}"`,
      detail: "found",
    });
  }

  const viteConfig = readFileSync(abs("workbench/vite.config.ts"), "utf8");
  const proxy = (name) => new RegExp(`["']${name}["']\\s*:\\s*\\{[\\s\\S]*?target:\\s*["']http://127\\.0\\.0\\.1:8601["']`).test(viteConfig);
  checks.push({ ok: proxy("/ingest"), label: "vite proxy /ingest -> http://127.0.0.1:8601", detail: proxy("/ingest") ? "configured" : "missing" });
  checks.push({ ok: proxy("/api"), label: "vite proxy /api -> http://127.0.0.1:8601", detail: proxy("/api") ? "configured" : "missing" });
  checks.push({ ok: /strictPort:\s*true/.test(viteConfig) && /port:\s*5173/.test(viteConfig), label: "vite dev server port 5173 strictPort:true", detail: "configured" });
  checks.push({ ok: !/0\.0\.0\.0/.test(viteConfig), label: "vite config binds no 0.0.0.0 address", detail: "none" });

  if (validate) checks.push({ ok: true, label: "schema validator available for runtime gates", detail: "compiled in V1" });

  gate(
    "S1-B",
    "S1 build artifacts: jar shading/schema parity, workbench dist markers, Vite proxy",
    checks,
    `(cd "workbench" && npm ci && npm run build) && unzip -p "${COLLECTOR_JAR_REL}" "BOOT-INF/classes/schema/traceboard.event.v1.json" | sha256sum`,
  );
}

/* ------------------------------------------------------------------ */
/* S1-G regression + drift                                             */
/* ------------------------------------------------------------------ */

function resultById(id) {
  return RESULTS.find((item) => item.id === id) ?? null;
}

function checkS1G(builds) {
  section("S1-G regression + freeze drift");
  const checks = [];
  const updatedContracts = new Set([
    "docs/contracts/api.v1.md",
    "docs/contracts/transport.v1.md",
    "docs/contracts/event-model.v1.md",
  ]);

  const s1Baseline = parseFreezeBaseline(S1_PLAN_REVIEW_REL, /^#{2,3} 8\. G1 冻结基线/m);
  checks.push({ ok: s1Baseline.length === 10, label: "10 S1 G1 baseline hashes recorded in S1 plan-review.md", detail: `found=${s1Baseline.length}` });
  const s1Map = new Map(s1Baseline.map((entry) => [entry.rel, entry.hash]));
  for (const entry of s1Baseline) {
    const fileAbs = abs(entry.rel);
    const actual = existsSync(fileAbs) ? sha256File(fileAbs) : "missing";
    checks.push({ ok: actual === entry.hash, label: `S1 freeze ${entry.rel}`, detail: `actual=${actual} baseline=${entry.hash}` });
  }

  const s0Baseline = parseFreezeBaseline(PLAN_REVIEW_REL);
  checks.push({ ok: s0Baseline.length === 7, label: "7 S0 G1 baseline hashes recorded in S0 plan-review.md", detail: `found=${s0Baseline.length}` });
  const drifted = [];
  for (const entry of s0Baseline) {
    const fileAbs = abs(entry.rel);
    const actual = existsSync(fileAbs) ? sha256File(fileAbs) : "missing";
    if (updatedContracts.has(entry.rel)) {
      const expected = s1Map.get(entry.rel);
      const ok = actual === expected && actual !== entry.hash;
      checks.push({
        ok,
        label: `S0->S1 contract update ${entry.rel} (allowed only via S1 G1 freeze)`,
        detail: `s0=${entry.hash.slice(0, 12)} s1=${actual.slice(0, 12)}`,
      });
      if (!ok) drifted.push(entry.rel);
    } else {
      const ok = actual === entry.hash;
      checks.push({ ok, label: `S0 frozen unchanged ${entry.rel}`, detail: `actual=${actual} s0=${entry.hash}` });
      if (!ok) drifted.push(entry.rel);
    }
  }

  const priorIds = ["V1", "V1b", "V1c", "V4b"];
  checks.push({
    ok: priorIds.every((id) => resultById(id)?.ok === true),
    label: "S0 case-A fixture still validates (V1/V1b/V1c/V4b)",
    detail: priorIds.map((id) => `${id}=${resultById(id)?.ok ? "PASS" : "FAIL"}`).join(","),
  });
  const buildIds = ["V2a", "V2b", "V2c-1", "V2c-2", "V2d-1", "V2d-2"];
  checks.push({
    ok: buildIds.every((id) => resultById(id)?.ok === true),
    label: "S0 builds still green (root/demo/workbench/demo frontend)",
    detail: buildIds.map((id) => `${id}=${resultById(id)?.ok ? "PASS" : "FAIL"}`).join(","),
  });
  checks.push({
    ok: drifted.length === 0,
    label: "no unexplained drift (only the 3 S1-updated contracts differ from S0)",
    detail: drifted.length ? drifted.join(",") : "clean",
  });

  gate(
    "S1-G",
    "regression: case-A valid, S0 builds green, S1 G1 freeze baseline intact",
    checks,
    `sha256sum "schema/traceboard.event.v1.json" "docs/contracts/api.v1.md" "docs/contracts/transport.v1.md" "docs/contracts/event-model.v1.md" "${S1_BATCH_REL}"`,
  );
}

/* ------------------------------------------------------------------ */
/* S1-H scope / security                                               */
/* ------------------------------------------------------------------ */

function checkS1H() {
  section("S1-H scope / security");
  const checks = [];

  const collectorFiles = dirTextFiles("server/collector/src");
  const collectorCode = collectorFiles.map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const routes = [];
  for (const file of collectorCode) {
    if (!/\.java$/.test(file.rel)) continue;
    for (const match of file.text.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:path\s*=\s*)?["']([^"']+)["']/g)) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  const expectedRoutes = [
    "GET /api/v1/meta",
    "GET /api/v1/sessions",
    "GET /api/v1/sessions/{sessionId}/events",
    "POST /ingest/v1/events",
  ];
  checks.push({
    ok: routes.slice().sort().join("|") === expectedRoutes.slice().sort().join("|"),
    label: "collector registers exactly the 4 S1 routes (no graph/replay/stream/links)",
    detail: routes.sort().join(", "),
  });
  const reservedRouteLeak = collectorCode.filter((file) => /["']\/[^"']*(graph|replay|links|stream)[^"']*["']/.test(file.text));
  checks.push({
    ok: reservedRouteLeak.length === 0,
    label: "no reserved route string in collector mapping annotations",
    detail: reservedRouteLeak.map((f) => f.rel).join(",") || "none",
  });

  const collectorForbidden = [
    { name: "s2-db", re: /JdbcTemplate|java\.sql|javax\.sql|@Repository|spring-data-jpa|mybatis|hibernate/i },
    { name: "s2-persistence", re: /FileOutputStream|Files\.write|java\.nio\.file|RandomAccessFile/ },
    { name: "s2-correlation", re: /traceparent|clickId|mergeRootEvent/i },
    { name: "s2-stream", re: /SseEmitter|EventSource|WebSocket|@ServerEndpoint/ },
    { name: "cors", re: /@CrossOrigin|Access-Control-Allow/ },
  ];
  const collectorHits = [];
  for (const file of collectorCode) {
    for (const { name, re } of collectorForbidden) {
      if (re.test(file.text)) collectorHits.push(`${file.rel} [${name}]`);
    }
  }
  checks.push({ ok: collectorHits.length === 0, label: "collector has no DB/persistence/correlation/SSE-WS/CORS code", detail: collectorHits.join(",") || "none" });

  const agentFiles = dirTextFiles("agent/src");
  const agentCode = agentFiles.map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const traceAgent = agentCode.find((f) => f.rel.endsWith("TraceAgent.java"))?.text ?? "";
  const typeMatchers = (traceAgent.match(/\.type\(/g) ?? []).length;
  const adviceSites = (traceAgent.match(/Advice\.to\(/g) ?? []).length;
  checks.push({
    ok: typeMatchers === 1 && adviceSites === 1 &&
      /named\("cancel"\)/.test(traceAgent) && /takesArguments\(long\.class\)/.test(traceAgent) &&
      traceAgent.includes("com.example.shop.controller.OrderController") &&
      !/com\.example\.shop\.(service|mapper|repository)/.test(traceAgent),
    label: "agent instruments exactly one type/method (OrderController#cancel(long))",
    detail: `.type=${typeMatchers} Advice.to=${adviceSites}`,
  });
  const agentForbidden = [
    { name: "s2-sql", re: /java\.sql|PreparedStatement|ResultSet|rowsAffected/ },
    { name: "s2-correlation", re: /traceparent|clickId|correlat(?:e|ion)/ },
    { name: "s2-targets", re: /com\.example\.shop\.(service|mapper|repository)/ },
  ];
  const agentHits = [];
  for (const file of agentCode) {
    for (const { name, re } of agentForbidden) {
      if (re.test(file.text)) agentHits.push(`${file.rel} [${name}]`);
    }
  }
  checks.push({ ok: agentHits.length === 0, label: "agent has no SQL/row/service/correlation probing", detail: agentHits.join(",") || "none" });

  const workbenchFiles = dirTextFiles("workbench/src");
  const wbText = workbenchFiles.map((f) => f.text).join("\n");
  const wbCode = workbenchFiles.map((f) => stripComments(f.text)).join("\n");
  const apiText = workbenchFiles.find((f) => f.rel.endsWith("src/api.ts"))?.text ?? "";
  const apiCode = stripComments(apiText);
  checks.push({
    ok: !/\bEventSource\b|new WebSocket|setInterval/.test(wbCode),
    label: "workbench has no SSE/WebSocket/interval polling",
    detail: /\bEventSource\b|new WebSocket|setInterval/.test(wbCode) ? "stream API found" : "none",
  });
  checks.push({
    ok: !/<canvas/i.test(wbCode) && !/from\s+["'](d3|echarts|cytoscape|vis-network|chart\.js|three)/.test(wbCode),
    label: "workbench has no graph/canvas library or canvas element",
    detail: "none",
  });
  checks.push({
    ok: !/\bTimeline\b|\bid=["']timeline|import[^;]*\bReplay\b|id=["']replay/.test(wbCode),
    label: "workbench has no timeline/replay view component",
    detail: "none",
  });
  checks.push({
    ok: !/rowCount|rowsAffected|sideEffects/.test(collectorCode.map((file) => file.text).join("\n")),
    label: "collector collects no row counts/side effects (no S2 probes)",
    detail: "none",
  });
  const workbenchPkg = readFileSync(abs("workbench/package.json"), "utf8");
  checks.push({
    ok: !/"(d3|echarts|cytoscape|vis-network|chart\.js|three|sigma)"/.test(workbenchPkg),
    label: "workbench package.json has no graph/timeline dependency",
    detail: "dependencies: vue, pinia only",
  });
  const fakeBatchText = workbenchFiles.find((f) => f.rel.endsWith("src/s1/fakeBatch.ts"))?.text ?? "";
  const panelText = workbenchFiles.find((f) => f.rel.endsWith("components/S1Panel.vue"))?.text ?? "";
  const agentSessionRead = /(?:fetchEventsPage|readBack|readOnce)\s*\(\s*["'`]s_s1|sessionId\s*[:=]\s*["']s_s1/.test(panelText + apiText);
  checks.push({
    ok: /S1_SESSION_ID\s*=\s*"s_wb_demo"/.test(fakeBatchText) && /readBack\(S1_SESSION_ID\)/.test(panelText) && !agentSessionRead,
    label: "workbench reads only s_wb_demo (the agent session is never queried)",
    detail: agentSessionRead ? "agent session used in a read call" : "s_wb_demo readback only",
  });
  checks.push({
    ok: wbText.includes("no correlation yet") && /假/.test(wbText),
    label: "workbench labels the skeleton honestly (no correlation yet / fake)",
    detail: "banner present",
  });
  checks.push({
    ok: apiCode.includes('"/ingest/v1/events"') && apiCode.includes('"/api/v1/sessions"') &&
      !/["'`]https?:\/\//.test(apiCode),
    label: "workbench API client uses relative paths only (proxy, no CORS/absolute URL)",
    detail: apiCode.includes('"/ingest/v1/events"') ? "relative" : "missing",
  });

  const appYml = readFileSync(abs("server/collector/src/main/resources/application.yml"), "utf8");
  checks.push({
    ok: /address:\s*127\.0\.0\.1/.test(appYml) && /port:\s*8601/.test(appYml) && !/0\.0\.0\.0/.test(appYml),
    label: "collector binds 127.0.0.1:8601 only",
    detail: "application.yml loopback",
  });

  const agentSources = agentCode.map((f) => f.text).join("\n");
  const failOpen = (agentSources.match(/catch\s*\(\s*Throwable/g) ?? []).length;
  checks.push({
    ok: failOpen >= 4 && !/\bretry\b|for\s*\(\s*int\s+attempt/i.test(agentSources) &&
      /ArrayBlockingQueue/.test(agentSources) && /CAPACITY\s*=\s*16/.test(agentSources) &&
      /CONNECT_TIMEOUT_MS\s*=\s*300/.test(agentSources) && /READ_TIMEOUT_MS\s*=\s*700/.test(agentSources),
    label: "agent fail-open: Throwable guards, bounded queue 16, 300/700ms, no retries",
    detail: `catch(Throwable)=${failOpen}`,
  });

  const mirrorHits = [];
  for (const file of ["workbench/package-lock.json", "demo/buggy-shop-boot-vue/frontend/package-lock.json", "tools/verify/package-lock.json"]) {
    const text = readFileSync(abs(file), "utf8");
    for (const match of text.matchAll(/"resolved":\s*"([^"]+)"/g)) {
      const host = (match[1].match(/^https?:\/\/([^/]+)/) ?? [])[1] ?? "";
      if (host && host !== "registry.npmjs.org") mirrorHits.push(`${file} -> ${host}`);
    }
  }
  const npmrcFiles = [...walk(abs("."), { skip: new Set(["node_modules", ".git", "target", "dist", "work"]) })]
    .filter((file) => path.basename(file) === ".npmrc");
  checks.push({
    ok: mirrorHits.length === 0 && npmrcFiles.length === 0,
    label: "no third-party npm mirrors (.npmrc absent, all resolved hosts = registry.npmjs.org)",
    detail: mirrorHits.length ? mirrorHits.slice(0, 4).join(" | ") : "official registry only",
  });
  const pomTexts = ["pom.xml", "agent/pom.xml", "server/collector/pom.xml", "demo/buggy-shop-boot-vue/backend/pom.xml"]
    .filter((rel) => existsSync(abs(rel)))
    .map((rel) => readFileSync(abs(rel), "utf8"));
  checks.push({
    ok: pomTexts.every((text) => !/<repository>|<mirror>|<pluginRepository>/.test(text)),
    label: "no custom Maven repository/mirror in poms (Maven Central default)",
    detail: "none",
  });

  const s1FixtureText = readFileSync(abs(S1_BATCH_REL), "utf8") + readFileSync(abs(S1_AGENT_SPAN_REL), "utf8");
  checks.push({
    ok: !/[\w.+-]+@[\w-]+\.[\w.]+/.test(s1FixtureText) && !/\b1[3-9]\d{9}\b/.test(s1FixtureText),
    label: "S1 fixtures contain no email/phone-like real data",
    detail: "none",
  });

  gate(
    "S1-H",
    "scope/security: no S2 features, loopback only, fail-open, no secrets/mirrors",
    checks,
    `grep -rnE "EventSource|WebSocket|JdbcTemplate|traceparent|clickId" agent/src server/collector/src workbench/src`,
  );
}

/* ------------------------------------------------------------------ */
/* S1-I cleanup                                                        */
/* ------------------------------------------------------------------ */

function checkS1I() {
  section("S1-I cleanup");
  const checks = [];
  for (const port of S1_PORTS) {
    const state = listeningOn(port);
    checks.push({
      ok: state.supported && state.lines.length === 0,
      label: `port ${port} not LISTENING`,
      detail: state.lines.join(" | ") || "free",
    });
  }

  const nowPids = javaPids();
  const leftover = nowPids.filter((pid) => !BASELINE.javaPids.includes(pid));
  checks.push({
    ok: leftover.length === 0,
    label: "no java.exe process left behind by this run",
    detail: leftover.length ? `pids=${leftover.join(",")}` : `none (baseline=${BASELINE.javaPids.join(",") || "0"})`,
  });

  const status = gitStatusLines();
  const allowed = [
    "agent/",
    "server/",
    "workbench/",
    "pom.xml",
    "docs/contracts/api.v1.md",
    "docs/contracts/transport.v1.md",
    "docs/contracts/event-model.v1.md",
    "docs/plans/stages/S1/",
    "fixtures/s1-walking-skeleton/",
    "tools/verify/",
    "README.md",
    ".gitattributes",
  ];
  const forbidden = [
    "schema/",
    "fixtures/case-a-zero-rows/",
    "demo/",
    "docs/contracts/status-semantics.md",
    "docs/plans/stages/S0/",
    "docs/plans/00-master-plan.md",
    "docs/plans/SOLO-PLAN.md",
  ];
  const unexpected = [];
  const forbiddenHits = [];
  const staged = [];
  for (const line of status.lines) {
    const index = `${line[0] ?? " "}${line[1] ?? " "}`;
    const rel = line.slice(3).trim().replace(/^"|"$/g, "").split("/").join("/");
    if (index[0] !== " " && index[0] !== "?") staged.push(line);
    if (!allowed.some((prefix) => rel === prefix || rel.startsWith(prefix))) unexpected.push(line);
    if (forbidden.some((prefix) => rel === prefix || rel.startsWith(prefix))) forbiddenHits.push(line);
  }
  checks.push({
    ok: status.ok && forbiddenHits.length === 0,
    label: "no git change under frozen/foreign paths (schema, case-A, demo, S0 docs)",
    detail: forbiddenHits.slice(0, 4).join(" | ") || "none",
  });
  checks.push({
    ok: status.ok && unexpected.length === 0,
    label: "git status only shows expected S1 product/test paths",
    detail: unexpected.slice(0, 4).join(" | ") || `${status.lines.length} expected entries`,
  });
  checks.push({
    ok: status.ok && staged.length === 0,
    label: "git index untouched (no staged entries)",
    detail: staged.slice(0, 4).join(" | ") || "all changes untracked/unstaged",
  });

  gate(
    "S1-I",
    "cleanup: ports free, no java processes, git status limited to expected S1 paths",
    checks,
    `netstat -ano | grep -E ":(${S1_PORTS.join("|")})\\s" ; tasklist | grep -i java ; git status --porcelain`,
  );
}

/* ------------------------------------------------------------------ */
/* V6 artifacts and parity                                             */
/* ------------------------------------------------------------------ */

function distTextFiles(relDir) {
  const dirAbs = abs(relDir);
  if (!existsSync(dirAbs)) return [];
  return walk(dirAbs).filter((file) => /\.(html|js|mjs|css|json|svg|map)$/i.test(file)).map((file) => ({
    file,
    rel: relOf(file),
    text: readFileSync(file, "utf8"),
  }));
}

function checkV6() {
  section("V6 artifacts and parity");

  const workbenchFiles = distTextFiles(WORKBENCH_DIST_REL);
  const workbenchAll = workbenchFiles.map((f) => f.text).join("\n");
  const wbTokens = ["app-shell", "前端图", "请求分图", "Fixture 事实摘要"].map((token) => ({
    ok: workbenchAll.includes(token),
    label: `workbench dist contains "${token}"`,
    detail: workbenchFiles.filter((f) => f.text.includes(token)).map((f) => f.rel).join(",") || "not found",
  }));
  record(
    "V6a",
    "workbench dist contains AppShell markers",
    wbTokens.every((t) => t.ok),
    wbTokens.map((t) => `${t.ok ? "ok " : "BAD"} ${t.label} :: ${t.detail}`),
    `(cd "workbench" && npm run build)`,
  );

  const distEvents = abs(`${WORKBENCH_DIST_REL}/fixtures/case-a-zero-rows/events.jsonl`);
  const distFacts = abs(`${WORKBENCH_DIST_REL}/fixtures/case-a-zero-rows/expected-facts.json`);
  const parityChecks = [
    { ok: existsSync(distEvents), label: "dist fixture copy exists (events.jsonl)", detail: relOf(distEvents) },
    {
      ok: existsSync(distEvents) && sha256File(distEvents) === sha256File(abs(EVENTS_REL)),
      label: "events.jsonl SHA256 source == dist copy",
      detail: `source=${sha256File(abs(EVENTS_REL))} dist=${existsSync(distEvents) ? sha256File(distEvents) : "missing"}`,
    },
    {
      ok: existsSync(distFacts) && sha256File(distFacts) === sha256File(abs(FACTS_REL)),
      label: "expected-facts.json SHA256 source == dist copy",
      detail: `source=${sha256File(abs(FACTS_REL))} dist=${existsSync(distFacts) ? sha256File(distFacts) : "missing"}`,
    },
  ];
  record(
    "V6b",
    "workbench dist fixture copy byte-identical to frozen fixtures",
    parityChecks.every((c) => c.ok),
    parityChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `sha256sum "fixtures/case-a-zero-rows/events.jsonl" "workbench/dist/fixtures/case-a-zero-rows/events.jsonl"`,
  );

  const demoFiles = distTextFiles(DEMO_DIST_REL);
  const demoAll = demoFiles.map((f) => f.text).join("\n");
  const demoChecks = ["btn-cancel", "操作成功", "raw-json"].map((token) => ({
    ok: demoAll.includes(token),
    label: `demo dist contains "${token}"`,
    detail: demoFiles.filter((f) => f.text.includes(token)).map((f) => f.rel).join(",") || "not found",
  }));
  record(
    "V6c",
    "demo dist contains cancel button, success hint, raw JSON",
    demoChecks.every((c) => c.ok),
    demoChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `(cd "demo/buggy-shop-boot-vue/frontend" && npm run build)`,
  );

  // External asset URL scan over both dists plus index.html sources.
  const INERT_URL_ALLOWLIST = [
    /^https?:\/\/(www\.)?w3\.org\//, // XML/SVG/MathML namespaces (never fetched)
    /^https?:\/\/vuejs\.org\/error-reference\//, // Vue runtime error-message link (never fetched)
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/, // local dev/proxy targets
  ];
  const scanTargets = [
    ...workbenchFiles,
    ...demoFiles,
    { rel: "workbench/index.html", text: readFileSync(abs("workbench/index.html"), "utf8") },
    { rel: "demo/buggy-shop-boot-vue/frontend/index.html", text: readFileSync(abs("demo/buggy-shop-boot-vue/frontend/index.html"), "utf8") },
  ];
  const allUrls = new Map();
  for (const target of scanTargets) {
    for (const match of target.text.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+/g)) {
      const url = match[0].replace(/[.,;]+$/, "");
      if (!allUrls.has(url)) allUrls.set(url, new Set());
      allUrls.get(url).add(target.rel);
    }
  }
  const offendingUrls = [...allUrls.keys()].filter((url) => !INERT_URL_ALLOWLIST.some((re) => re.test(url)));

  const externalAssetRefs = [];
  for (const target of scanTargets.filter((t) => t.rel.endsWith(".html") || t.rel.endsWith(".css"))) {
    for (const match of target.text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      if (/^https?:\/\//i.test(match[1])) externalAssetRefs.push(`${target.rel}: ${match[1]}`);
    }
    for (const match of target.text.matchAll(/url\(\s*['"]?(https?:\/\/[^)'"]+)/g)) {
      externalAssetRefs.push(`${target.rel}: css url(${match[1]})`);
    }
  }

  const urlChecks = [
    {
      ok: offendingUrls.length === 0,
      label: "no non-inert external http(s) URLs in built assets",
      detail: offendingUrls.length ? offendingUrls.join(", ") : `${allUrls.size} distinct URLs, all inert/loopback`,
    },
    {
      ok: externalAssetRefs.length === 0,
      label: "no external src/href/url() asset references",
      detail: externalAssetRefs.length ? externalAssetRefs.join(" | ") : "none",
    },
    {
      ok: true,
      label: "observed URL inventory",
      detail: [...allUrls.keys()].sort().join(" , "),
    },
  ];
  record(
    "V6d",
    "no external CDN/asset URLs in workbench and demo builds",
    urlChecks.every((c) => c.ok),
    urlChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `grep -RhoE "https?://[^\\"' ]+" "workbench/dist" "demo/buggy-shop-boot-vue/frontend/dist" | sort -u`,
  );

  const manifestChecks = [];
  const jarAbs = abs(AGENT_JAR_REL);
  manifestChecks.push({ ok: existsSync(jarAbs), label: "agent jar exists", detail: AGENT_JAR_REL });
  if (existsSync(jarAbs)) {
    const result = runExe("unzip", ["-p", jarAbs, "META-INF/MANIFEST.MF"]);
    const manifest = result.stdout ?? "";
    const premain = manifest.split(/\r?\n/).find((line) => /^Premain-Class:/i.test(line.trim()));
    manifestChecks.push({
      ok: result.code === 0 && Boolean(premain) && /io\.traceboard\.agent\.TraceAgent/.test(premain ?? ""),
      label: "MANIFEST Premain-Class: io.traceboard.agent.TraceAgent",
      detail: premain ? premain.trim() : `unzip exit=${result.code} ${lastLines(result.stderr, 2).join(" ")}`,
    });
    manifestChecks.push({
      ok: /Implementation-Title:\s*TraceBoard Agent/i.test(manifest),
      label: "MANIFEST Implementation-Title present",
      detail: (manifest.split(/\r?\n/).find((line) => /^Implementation-Title:/i.test(line.trim())) ?? "missing").trim(),
    });
  }
  record(
    "V6e",
    "agent jar manifest declares the S1 premain entry point",
    manifestChecks.every((c) => c.ok),
    manifestChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `unzip -p "${AGENT_JAR_REL}" META-INF/MANIFEST.MF | grep -i "Premain-Class"`,
  );
}

/* ------------------------------------------------------------------ */
/* V7 frozen drift                                                     */
/* ------------------------------------------------------------------ */

// The S0-only drift gate was superseded by S1-G: it now checks the S1 G1 baseline
// (10 files) plus S0 regression (all S0 files unchanged except the three S1-updated
// contracts). Nothing to run here.

/* ------------------------------------------------------------------ */
/* V8 hygiene                                                          */
/* ------------------------------------------------------------------ */

function sourceFilesForScan() {
  const files = [];
  const addTree = (rel) => {
    walk(abs(rel), { skip: new Set(["node_modules", "target", "dist", ".git"]) }).forEach((file) => files.push(file));
  };
  ["schema", "fixtures", "docs/contracts"].forEach(addTree);
  files.push(abs("pom.xml"));
  files.push(abs(".gitignore"));
  addTree("agent/src");
  addTree("server/collector/src");
  addTree("demo/buggy-shop-boot-vue/backend/src");
  addTree("demo/buggy-shop-boot-vue/frontend/src");
  addTree("workbench/src");
  addTree("workbench/scripts");
  ["workbench/package.json", "workbench/index.html", "workbench/vite.config.ts", "workbench/tsconfig.json", "workbench/env.d.ts"].forEach((rel) => files.push(abs(rel)));
  ["demo/buggy-shop-boot-vue/frontend/package.json", "demo/buggy-shop-boot-vue/frontend/index.html", "demo/buggy-shop-boot-vue/frontend/vite.config.ts", "demo/buggy-shop-boot-vue/frontend/tsconfig.json", "demo/buggy-shop-boot-vue/frontend/env.d.ts"].forEach((rel) => files.push(abs(rel)));
  files.push(abs("demo/buggy-shop-boot-vue/backend/pom.xml"));
  files.push(abs("server/collector/pom.xml"));
  files.push(abs("agent/pom.xml"));
  return [...new Set(files)].filter((file) => existsSync(file));
}

function checkV8() {
  section("V8 hygiene");

  // V8a secrets
  const secretPatterns = [
    { name: "password-assignment", re: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\n]{3,}["']/gi },
    { name: "api-key/secret/token assignment", re: /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi },
    { name: "private-key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { name: "bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g },
    { name: "aws access key id", re: /\bAKIA[0-9A-Z]{16}\b/g },
    { name: "github token", re: /\bghp_[A-Za-z0-9]{20,}/g },
  ];
  const placeholderAllow = /placeholder|changeme|change_me|example|sample|dummy|redacted|xxx|<[^>]+>|\$\{|your_|demo|test/i;
  const secretHits = [];
  const allowedHits = [];
  for (const file of sourceFilesForScan()) {
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, index) => {
      if (/package-lock\.json/.test(file)) return;
      for (const pattern of secretPatterns) {
        pattern.re.lastIndex = 0;
        for (const match of line.matchAll(pattern.re)) {
          const hit = `${relOf(file)}:${index + 1} [${pattern.name}] ${match[0].slice(0, 80)}`;
          if (placeholderAllow.test(match[0])) allowedHits.push(hit);
          else secretHits.push(hit);
        }
      }
    });
  }
  const secretChecks = [
    { ok: secretHits.length === 0, label: "no secret material in project sources", detail: secretHits.length ? secretHits.slice(0, 6).join(" || ") : "0 hits" },
    { ok: true, label: "placeholder-only hits (allowed)", detail: allowedHits.length ? `${allowedHits.length} (e.g. ${allowedHits[0]})` : "none" },
  ];
  record(
    "V8a",
    "secret scan over project sources",
    secretChecks.every((c) => c.ok),
    secretChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `grep -rniE "(password|secret|api[_-]?key|bearer)" "agent/src" "server/collector/src" "demo/buggy-shop-boot-vue" "workbench/src" --include="*.java" --include="*.ts" --include="*.vue"`,
  );

  // V8b telemetry / CDN
  const trackingDomains = [
    "google-analytics.com", "googletagmanager.com", "doubleclick.net", "hotjar.com",
    "mixpanel.com", "segment.io", "segment.com", "sentry.io", "datadoghq", "newrelic.com",
    "hm.baidu.com", "cnzz.com", "umeng.com", "amplitude.com", "fullstory.com",
  ];
  const cdnHosts = [
    "unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com",
    "fonts.gstatic.com", "bootcdn.net", "staticfile.org", "cdn.bootcss.com", "cdn.tailwindcss.com",
  ];
  const haystackFiles = [
    ...sourceFilesForScan(),
    ...distTextFiles(WORKBENCH_DIST_REL).map((f) => f.file),
    ...distTextFiles(DEMO_DIST_REL).map((f) => f.file),
  ];
  const telemetryHits = [];
  const cdnHits = [];
  for (const file of [...new Set(haystackFiles)]) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const domain of trackingDomains) if (text.includes(domain)) telemetryHits.push(`${relOf(file)} -> ${domain}`);
    for (const host of cdnHosts) if (text.includes(host)) cdnHits.push(`${relOf(file)} -> ${host}`);
  }
  record(
    "V8b",
    "no telemetry endpoints and no external CDN hosts",
    telemetryHits.length === 0 && cdnHits.length === 0,
    [
      { ok: true, label: "telemetry hits", detail: telemetryHits.length ? telemetryHits.slice(0, 5).join(" | ") : "0" },
      { ok: true, label: "cdn hits", detail: cdnHits.length ? cdnHits.slice(0, 5).join(" | ") : "0" },
    ].map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `grep -rniE "(google-analytics|googletagmanager|unpkg|jsdelivr|cdnjs|fonts\\.googleapis|sentry)" workbench demo agent server --include="*.html" --include="*.ts" --include="*.vue" --include="*.java"`,
  );

  // V8c .gitattributes / CRLF policy
  const attrsAbs = abs(".gitattributes");
  const attrsExists = existsSync(attrsAbs);
  const autocrlf = runExe("git", ["config", "--show-origin", "--get", "core.autocrlf"]);
  const crlfEvidence = `${(autocrlf.stdout || "").trim() || "(unset)"}`;
  const attrChecks = [
    { ok: true, label: "repo .gitattributes state", detail: attrsExists ? "present" : "absent (expected: acceptance adds it at G2 per s0-plan D15)" },
    { ok: true, label: "core.autocrlf", detail: crlfEvidence },
    { ok: true, label: "CRLF risk note for acceptance", detail: "without .gitattributes a checkout with core.autocrlf=true would rewrite *.jsonl to CRLF and break V1; acceptance must add it at G2 and re-run verify" },
    { ok: true, label: "fixtures CR count now", detail: `${(readFileSync(abs(EVENTS_REL), "utf8").match(/\r/g) ?? []).length} (events.jsonl)` },
  ];
  if (attrsExists) {
    const check = runExe("git", ["check-attr", "-a", "--", EVENTS_REL]);
    attrChecks.push({ ok: true, label: "git check-attr events.jsonl", detail: (check.stdout || "").trim() });
  }
  record("V8c", ".gitattributes / CRLF risk recorded", true, attrChecks.map((c) => `note ${c.label} :: ${c.detail}`), null);

  // V8d verifier made no product writes; git status/index unchanged by this run
  const snapshotNow = sourceSnapshot();
  const changed = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) changed.push(`${rel} (${hash} -> ${snapshotNow[rel] ?? "missing"})`);
  }
  const added = Object.keys(snapshotNow).filter((rel) => !(rel in SNAPSHOT));

  const status = gitStatusLines();
  const statusNow = status.lines.slice().sort().join("\n");
  const ignoredNodeModules = runExe("git", ["check-ignore", "-q", "--", "tools/verify/node_modules/ajv/package.json"]);

  const hygieneChecks = [
    { ok: changed.length === 0, label: "no product file modified during verify", detail: changed.length ? changed.slice(0, 5).join(" | ") : `${Object.keys(SNAPSHOT).length} files stable` },
    { ok: added.length === 0, label: "no product files added during verify", detail: added.length ? added.slice(0, 5).join(" | ") : "none" },
    {
      ok: status.ok && statusNow === BASELINE.gitStatus,
      label: "git status identical before/after verify (verifier wrote no tracked product path)",
      detail: status.ok ? `${status.lines.length} entries, unchanged=${statusNow === BASELINE.gitStatus}` : status.error,
    },
    { ok: ignoredNodeModules.code === 0, label: "tools/verify/node_modules is gitignored", detail: ignoredNodeModules.code === 0 ? "ignored" : "NOT ignored" },
  ];
  record(
    "V8d",
    "verifier wrote no product files; git status unchanged by the run",
    hygieneChecks.every((c) => c.ok),
    hygieneChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `git status --porcelain`,
  );
}

/* ------------------------------------------------------------------ */
/* source snapshot (product files only)                                */
/* ------------------------------------------------------------------ */

let SNAPSHOT = {};
let BASELINE = { javaPids: [], gitStatus: "" };

function sourceSnapshot() {
  const files = [];
  const add = (rel) => {
    const fileAbs = abs(rel);
    if (existsSync(fileAbs) && statSync(fileAbs).isFile()) files.push(fileAbs);
  };
  const addTree = (rel) => {
    walk(abs(rel), { skip: new Set(["node_modules", "target", "dist", ".git", "coverage"]) }).forEach((f) => files.push(f));
  };
  ["pom.xml", ".gitignore", ".gitattributes", "agent/pom.xml", "server/collector/pom.xml", "demo/buggy-shop-boot-vue/backend/pom.xml",
    "workbench/package.json", "workbench/package-lock.json", "workbench/index.html", "workbench/vite.config.ts", "workbench/tsconfig.json", "workbench/env.d.ts", "workbench/.gitignore",
    "demo/buggy-shop-boot-vue/frontend/package.json", "demo/buggy-shop-boot-vue/frontend/package-lock.json", "demo/buggy-shop-boot-vue/frontend/index.html",
    "demo/buggy-shop-boot-vue/frontend/vite.config.ts", "demo/buggy-shop-boot-vue/frontend/tsconfig.json", "demo/buggy-shop-boot-vue/frontend/env.d.ts",
  ].forEach(add);
  ["schema", "fixtures", "docs/contracts", "agent/src", "server/collector/src", "demo/buggy-shop-boot-vue/backend/src",
    "demo/buggy-shop-boot-vue/frontend/src", "workbench/src", "workbench/scripts",
  ].forEach(addTree);
  // S0 stage docs are frozen by other owners; test-report.md is the tester's own output.
  for (const file of walk(abs("docs/plans/stages/S0"))) {
    if (path.basename(file) === "test-report.md") continue;
    files.push(file);
  }
  const map = {};
  for (const file of [...new Set(files)]) {
    if (!existsSync(file)) continue;
    map[relOf(file)] = sha256File(file);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const startedAt = new Date();
  console.log("==============================================");
  console.log("TraceBoard S0 + S1 verifier");
  console.log(`repo: ${REPO}`);
  console.log(`started: ${startedAt.toISOString()}`);
  console.log("==============================================");

  SNAPSHOT = sourceSnapshot();
  const statusBefore = gitStatusLines();
  BASELINE = {
    javaPids: javaPids(),
    gitStatus: statusBefore.lines.slice().sort().join("\n"),
  };

  const env = captureEnv();
  section("V0 environment");
  record(
    "V0",
    "environment recorded",
    Boolean(env.node && env.java21 && existsSync(JDK21_JAVA)),
    [
      `node=${env.node} npm=${env.npm}`,
      `java21=${env.java21}`,
      `java8=${env.java8}`,
      `mvn(default JAVA_HOME)=${env.mvnDefault}`,
      `mvn(JDK21)=${env.mvnJdk21}`,
      `platform=${env.platform}`,
      `baseline java pids=${BASELINE.javaPids.join(",") || "none"}; git status entries=${statusBefore.lines.length}`,
    ],
    null,
  );

  const v1 = checkV1();
  checkV1b(v1.parsed);
  checkV1c(v1.parsed, v1.validate);
  checkV4b(v1.parsed);

  const builds = checkV2();
  checkV3();

  checkS1A(v1.validate);
  checkS1B(builds, v1.validate);

  await checkS1CDF(v1.validate);
  await checkS1E(v1.validate);

  checkV6();
  checkV8();

  checkS1G(builds);
  checkS1H();
  checkS1I();

  section("SUMMARY");
  const failed = RESULTS.filter((r) => !r.ok);
  const passed = RESULTS.length - failed.length;
  console.log(`checks: ${passed} PASS / ${failed.length} FAIL (total ${RESULTS.length})`);
  if (failed.length) {
    console.log("failed checks:");
    for (const item of failed) console.log(`  - ${item.id}: ${item.title}`);
  }
  const verdict = failed.length === 0 ? "PASS" : "FAIL";
  console.log(`S1 TEST: ${verdict}`);

  if (process.argv.includes("--json")) {
    console.log(
      `VERIFY_JSON:${JSON.stringify({
        repo: REPO,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        env,
        verdict,
        results: RESULTS,
      })}`,
    );
  }

  return failed.length === 0 ? 0 : 1;
}

process.on("exit", () => {
  if (activeServer?.child?.pid) {
    spawnSync("taskkill", ["/PID", String(activeServer.child.pid), "/T", "/F"], { windowsHide: true });
  }
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("VERIFIER CRASHED:", error);
    process.exit(2);
  });