#!/usr/bin/env node
/**
 * TraceBoard S0 independent verifier (tester deliverable).
 *
 * One-shot, re-runnable gate for the S0 acceptance signals:
 *   V1   schema compiles under Ajv 2020-12 (strict) and every JSONL line validates;
 *        byte/lines/spanId/root/traceId/startNs invariants hold.
 *   V1b  expected-facts.json (5 facts + global assertions) matches events.jsonl.
 *   V1c  negative tests: invalid status / missing reason / extra property rejected;
 *        valid NOT_COLLECTED_POLICY + reason accepted.
 *   V4b  causal interval containment (sync strict; callback root-only exception).
 *   V2   real builds: root reactor (JDK21), demo backend (JDK8), workbench, demo frontend.
 *   V3   agent bytecode major version 52.
 *   V5   runtime smoke: collector 8601 (health/meta/ingest 501) and demo 8080,
 *        then both killed and ports proven free.
 *   V6   artifacts/parity: dist markers, fixture copy SHA256, no external asset URLs,
 *        agent manifest Premain-Class.
 *   V7   frozen-file drift vs the baseline SHA256 recorded in plan-review.md.
 *   V8   hygiene: no secrets, no telemetry/CDN, .gitattributes/CRLF risk note,
 *        no unexpected writes from the verifier, git index untouched.
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

function startJavaServer(label, exe, jarAbs, cwd) {
  const child = spawn(exe, ["-jar", jarAbs], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const log = { text: "" };
  const append = (chunk) => {
    log.text += chunk.toString("utf8");
    if (log.text.length > 200000) log.text = log.text.slice(-100000);
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
/* V5 runtime smoke                                                    */
/* ------------------------------------------------------------------ */

async function checkV5() {
  section("V5 runtime smoke");

  const collectorJar = abs(COLLECTOR_JAR_REL);
  const demoJar = abs(DEMO_JAR_REL);
  const pre8601 = listeningOn(8601);
  const pre8080 = listeningOn(8080);

  const collectorChecks = [];
  collectorChecks.push({
    ok: pre8601.supported && pre8601.lines.length === 0,
    label: "port 8601 free before start",
    detail: pre8601.supported ? (pre8601.lines.join(" | ") || "no listener") : "netstat unavailable",
  });
  collectorChecks.push({
    ok: existsSync(collectorJar),
    label: "collector jar exists",
    detail: COLLECTOR_JAR_REL,
  });
  collectorChecks.push({
    ok: existsSync(JDK21_JAVA),
    label: "JDK21 java.exe exists",
    detail: JDK21_JAVA,
  });

  let collectorServer = null;
  let collectorStopped = false;
  if (collectorChecks[0].ok && collectorChecks[1].ok && collectorChecks[2].ok) {
    try {
      collectorServer = startJavaServer("collector(8601)", JDK21_JAVA, collectorJar, REPO);
      const health = await pollUntil(async () => {
        const response = await tryRequest(8601, "/actuator/health", { method: "GET" }, 5000);
        return response.ok && response.status === 200 ? response : null;
      }, START_TIMEOUT_MS);
      if (!health) {
        collectorChecks.push({ ok: false, label: "GET /actuator/health within 90s", detail: "timeout / connection refused" });
      } else {
        const body = parseJson(health.text);
        collectorChecks.push({
          ok: health.status === 200 && body.ok && body.value?.status === "UP",
          label: "health 200 {status:UP}",
          detail: `status=${health.status} body=${show(health.text)}`,
        });
      }

      const metaResponse = await tryRequest(8601, "/api/v1/meta", { method: "GET" });
      const meta = metaResponse.ok ? parseJson(metaResponse.text) : { ok: false };
      const metaValue = meta.value ?? {};
      collectorChecks.push({
        ok: metaResponse.ok && metaResponse.status === 200,
        label: "GET /api/v1/meta returns 200",
        detail: metaResponse.ok ? `status=${metaResponse.status}` : String(metaResponse.error),
      });
      collectorChecks.push({
        ok: metaValue.service === "traceboard-collector" && metaValue.apiVersion === "v1" && metaValue.version === "0.1.0-SNAPSHOT",
        label: "meta service/version/apiVersion",
        detail: `${metaValue.service} / ${metaValue.version} / ${metaValue.apiVersion}`,
      });
      collectorChecks.push({
        ok: metaValue.schema?.id === EXPECTED_SCHEMA_ID && metaValue.schema?.version === "traceboard.event.v1" && metaValue.schema?.dialect === "2020-12",
        label: "meta schema id/version/dialect",
        detail: show(metaValue.schema),
      });
      collectorChecks.push({
        ok:
          metaValue.capabilities?.health === true &&
          metaValue.capabilities?.meta === true &&
          metaValue.capabilities?.ingestEvents === false &&
          metaValue.capabilities?.realtime === false &&
          metaValue.capabilities?.replay === false,
        label: "capabilities honest (ingestEvents/realtime/replay false)",
        detail: show(metaValue.capabilities),
      });

      const ingestBody = readFileSync(abs(EVENTS_REL), "utf8");
      const ingest = await tryRequest(8601, "/ingest/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        body: ingestBody,
      });
      const ingestJson = ingest.ok ? parseJson(ingest.text) : { ok: false };
      collectorChecks.push({
        ok: ingest.ok && ingest.status === 501,
        label: "POST /ingest/v1/events returns 501",
        detail: ingest.ok ? `status=${ingest.status} body=${show(ingest.text)}` : String(ingest.error),
      });
      collectorChecks.push({
        ok: ingestJson.ok && ingestJson.value?.error === "not_implemented" && ingestJson.value?.apiVersion === "v1" && typeof ingestJson.value?.message === "string",
        label: "ingest error envelope {error:not_implemented, apiVersion:v1}",
        detail: show(ingest.text),
      });
    } finally {
      await stopServer(collectorServer);
      collectorStopped = true;
      const freed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
      collectorChecks.push({
        ok: Boolean(freed),
        label: "collector stopped, port 8601 free",
        detail: freed ? "no LISTENING socket" : listeningOn(8601).lines.join(" | "),
      });
      activeServer = null;
    }
  } else {
    collectorChecks.push({ ok: false, label: "collector smoke executed", detail: "precondition failed" });
  }

  gate(
    "V5a",
    "collector smoke: health UP, meta, ingest 501, clean shutdown",
    collectorChecks,
    `"${JDK21_JAVA}" -jar "${COLLECTOR_JAR_REL}"`,
  );

  const demoChecks = [];
  demoChecks.push({
    ok: pre8080.supported && pre8080.lines.length === 0,
    label: "port 8080 free before start",
    detail: pre8080.supported ? (pre8080.lines.join(" | ") || "no listener") : "netstat unavailable",
  });
  demoChecks.push({ ok: existsSync(demoJar), label: "demo jar exists", detail: DEMO_JAR_REL });
  demoChecks.push({ ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists", detail: JDK8_JAVA });

  if (demoChecks.every((c) => c.ok)) {
    let demoServer = null;
    try {
      demoServer = startJavaServer("demo-backend(8080)", JDK8_JAVA, demoJar, abs("demo/buggy-shop-boot-vue/backend"));
      const orders = await pollUntil(async () => {
        const response = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
        return response.ok && response.status === 200 ? response : null;
      }, START_TIMEOUT_MS);
      if (!orders) {
        demoChecks.push({ ok: false, label: "GET /api/orders within 90s", detail: "timeout / connection refused" });
      } else {
        const body = parseJson(orders.text);
        const first = body.ok ? body.value?.data?.[0] : undefined;
        demoChecks.push({
          ok: first?.id === 1 && first?.orderNo === "SO-0001" && first?.status === "CREATED" && first?.amount === 100,
          label: "GET /api/orders 200 with seed order id=1",
          detail: `status=${orders.status} first=${show(first)}`,
        });
      }

      const cancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
      const cancelBody = cancel.ok ? parseJson(cancel.text) : { ok: false };
      demoChecks.push({
        ok: cancel.ok && cancel.status === 200 && cancelBody.ok && deepEqual(cancelBody.value, { data: true }),
        label: "POST /api/orders/1/cancel 200 {data:true}",
        detail: cancel.ok ? `status=${cancel.status} body=${show(cancel.text)}` : String(cancel.error),
      });

      const missing = await tryRequest(8080, "/api/orders/999/cancel", { method: "POST" });
      const missingBody = missing.ok ? parseJson(missing.text) : { ok: false };
      demoChecks.push({
        ok: missing.ok && missing.status === 404 && missingBody.ok && missingBody.value?.data === false,
        label: "POST /api/orders/999/cancel 404 {data:false}",
        detail: missing.ok ? `status=${missing.status} body=${show(missing.text)}` : String(missing.error),
      });
    } finally {
      await stopServer(demoServer);
      const freed = await pollUntil(() => listeningOn(8080).lines.length === 0, 30000, 400);
      demoChecks.push({
        ok: Boolean(freed),
        label: "demo backend stopped, port 8080 free",
        detail: freed ? "no LISTENING socket" : listeningOn(8080).lines.join(" | "),
      });
      activeServer = null;
    }
  } else {
    demoChecks.push({ ok: false, label: "demo smoke executed", detail: "precondition failed" });
  }

  gate(
    "V5b",
    "demo backend smoke: orders 200, cancel true, unknown 404, clean shutdown",
    demoChecks,
    `(cd "demo/buggy-shop-boot-vue/backend" && "${JDK8_JAVA}" -jar "${DEMO_JAR_REL}")`,
  );

  await sleep(500);
  const post8601 = listeningOn(8601);
  const post8080 = listeningOn(8080);
  gate(
    "V5c",
    "ports 8601/8080 released after smoke (no residual processes)",
    [
      { ok: post8601.supported && post8601.lines.length === 0, label: "8601 not LISTENING", detail: post8601.lines.join(" | ") || "free" },
      { ok: post8080.supported && post8080.lines.length === 0, label: "8080 not LISTENING", detail: post8080.lines.join(" | ") || "free" },
    ],
    `netstat -ano | grep -E ":(8601|8080)"`,
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
    "agent jar manifest declares the noop premain",
    manifestChecks.every((c) => c.ok),
    manifestChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `unzip -p "${AGENT_JAR_REL}" META-INF/MANIFEST.MF | grep -i "Premain-Class"`,
  );
}

/* ------------------------------------------------------------------ */
/* V7 frozen drift                                                     */
/* ------------------------------------------------------------------ */

function checkV7() {
  section("V7 frozen-file drift vs plan-review baseline");
  const checks = [];
  const baseline = [];
  let reviewText = "";
  try {
    reviewText = readFileSync(abs(PLAN_REVIEW_REL), "utf8");
  } catch (error) {
    checks.push({ ok: false, label: "plan-review.md readable", detail: error.message });
  }
  for (const line of reviewText.split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s{2}(.+)$/);
    if (match) baseline.push({ hash: match[1], rel: match[2].trim() });
  }
  checks.push({
    ok: baseline.length === 7,
    label: "7 baseline hashes recorded in plan-review.md",
    detail: `found=${baseline.length}`,
  });

  for (const entry of baseline) {
    const fileAbs = abs(entry.rel);
    const exists = existsSync(fileAbs);
    const actual = exists ? sha256File(fileAbs) : "missing";
    checks.push({
      ok: exists && actual === entry.hash,
      label: `drift ${entry.rel}`,
      detail: `actual=${actual} baseline=${entry.hash}`,
    });
  }

  // Report every frozen-scope file, including those without a recorded baseline.
  const frozenScope = [
    ...walk(abs("schema")),
    ...walk(abs("fixtures")),
    ...walk(abs("docs/contracts")),
  ].map(relOf);
  const baselined = new Set(baseline.map((b) => b.rel));
  for (const rel of frozenScope.sort()) {
    if (baselined.has(rel)) continue;
    checks.push({
      ok: true,
      label: `no baseline recorded (reported only) ${rel}`,
      detail: sha256File(abs(rel)),
    });
  }

  gate(
    "V7",
    "schema/fixtures/contracts match the G1 freeze baseline",
    checks,
    `sha256sum "schema/traceboard.event.v1.json" "fixtures/case-a-zero-rows/events.jsonl" "fixtures/case-a-zero-rows/expected-facts.json" "docs/contracts/event-model.v1.md" "docs/contracts/status-semantics.md" "docs/contracts/transport.v1.md" "docs/contracts/api.v1.md"`,
  );
}

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

  // V8d verifier made no product writes; git index untouched
  const snapshotNow = sourceSnapshot();
  const changed = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) changed.push(`${rel} (${hash} -> ${snapshotNow[rel] ?? "missing"})`);
  }
  const added = Object.keys(snapshotNow).filter((rel) => !(rel in SNAPSHOT));

  const status = runExe("git", ["status", "--porcelain"], { timeout: 60000 });
  const statusLines = (status.stdout || "").split(/\r?\n/).filter((line) => line.trim() !== "");
  const stagedOrModified = statusLines.filter((line) => !line.startsWith("??"));
  const ignoredNodeModules = runExe("git", ["check-ignore", "-q", "--", "tools/verify/node_modules/ajv/package.json"]);

  const hygieneChecks = [
    { ok: changed.length === 0, label: "no product file modified during verify", detail: changed.length ? changed.slice(0, 5).join(" | ") : `${Object.keys(SNAPSHOT).length} files stable` },
    { ok: added.length === 0, label: "no product files added during verify", detail: added.length ? added.slice(0, 5).join(" | ") : "none" },
    { ok: stagedOrModified.length === 0, label: "git index untouched (no add/modify/delete entries)", detail: stagedOrModified.length ? stagedOrModified.slice(0, 5).join(" | ") : `${statusLines.length} untracked paths, all "??"` },
    { ok: ignoredNodeModules.code === 0, label: "tools/verify/node_modules is gitignored", detail: ignoredNodeModules.code === 0 ? "ignored" : "NOT ignored" },
  ];
  record(
    "V8d",
    "verifier wrote no product files; git index untouched",
    hygieneChecks.every((c) => c.ok),
    hygieneChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `git status --porcelain`,
  );
}

/* ------------------------------------------------------------------ */
/* source snapshot (product files only)                                */
/* ------------------------------------------------------------------ */

let SNAPSHOT = {};

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
  console.log("TraceBoard S0 verifier");
  console.log(`repo: ${REPO}`);
  console.log(`started: ${startedAt.toISOString()}`);
  console.log("==============================================");

  SNAPSHOT = sourceSnapshot();

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
    ],
    null,
  );

  const v1 = checkV1();
  checkV1b(v1.parsed);
  checkV1c(v1.parsed, v1.validate);
  checkV4b(v1.parsed);

  checkV2();
  checkV3();
  await checkV5();
  checkV6();
  checkV7();
  checkV8();

  section("SUMMARY");
  const failed = RESULTS.filter((r) => !r.ok);
  const passed = RESULTS.length - failed.length;
  console.log(`checks: ${passed} PASS / ${failed.length} FAIL (total ${RESULTS.length})`);
  if (failed.length) {
    console.log("failed checks:");
    for (const item of failed) console.log(`  - ${item.id}: ${item.title}`);
  }
  const verdict = failed.length === 0 ? "PASS" : "FAIL";
  console.log(`S0 TEST: ${verdict}`);

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