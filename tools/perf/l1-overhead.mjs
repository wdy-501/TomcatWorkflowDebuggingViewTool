#!/usr/bin/env node
/**
 * S5 L1 overhead baseline (report-only; no hard threshold).
 *
 * Runs the same demo endpoint twice on 127.0.0.1:
 *   1) demo WITHOUT the javaagent (collector is still running but receives nothing);
 *   2) demo WITH the javaagent (session s_s5perf, collector 8601).
 *
 * Each side: wait for /api/orders, warm up, then `--rounds` rounds of `--n` sequential
 * `POST /api/orders/1/preview-discount?...&note=<3000 x>` requests. Per-round p50/p95 use
 * nearest-rank; the reported p50/p95 is the median across rounds. The ratio is
 * median(agent p50) / median(base p50).
 *
 * This is a REPORT: a ratio above 1.25 only adds a WARN label, never a FAIL. The script exits
 * 0 when both sides complete (and the agent produced >0 events), 1 on setup failure, 2 on bad
 * arguments. Processes/ports/temp files are cleaned in `finally`.
 *
 * Usage: node tools/perf/l1-overhead.mjs [--n 100] [--warmup 20] [--rounds 3]
 *          [--port 8080] [--collector-port 8601]
 */

import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const JAVA21_HOME = process.env.JAVA21 || "C:/Program Files/Java/jdk-21";
const JAVA8_HOME = process.env.JAVA8 || "C:/Program Files/Java/jdk1.8.0_221";
const JAVA_EXE = process.platform === "win32" ? "java.exe" : "java";
const JAVA21 = path.join(JAVA21_HOME, "bin", JAVA_EXE);
const JAVA8 = path.join(JAVA8_HOME, "bin", JAVA_EXE);
const COLLECTOR_JAR = path.join(REPO, "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar");
const DEMO_JAR = path.join(REPO, "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar");
const AGENT_JAR = path.join(REPO, "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar");
const PERF_SESSION = "s_s5perf";
const NOTE_3000 = "x".repeat(3000);

function usage(message) {
  if (message) process.stderr.write(`PERF_ERROR:${message}\n`);
  process.stderr.write(
    "usage: node tools/perf/l1-overhead.mjs [--n 100] [--warmup 20] [--rounds 3] " +
      "[--port 8080] [--collector-port 8601]\n",
  );
  process.exit(2);
}

function integerArg(raw, name, { min = 0 } = {}) {
  if (!/^\d+$/.test(String(raw))) usage(`${name} must be a non-negative integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min) usage(`${name} must be >= ${min}`);
  return value;
}

function parseArgs(argv) {
  const options = { n: 100, warmup: 20, rounds: 3, port: 8080, collectorPort: 8601 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const take = () => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) usage(`missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === "--n") options.n = integerArg(take(), "--n", { min: 1 });
    else if (arg === "--warmup") options.warmup = integerArg(take(), "--warmup");
    else if (arg === "--rounds") options.rounds = integerArg(take(), "--rounds", { min: 1 });
    else if (arg === "--port") options.port = integerArg(take(), "--port", { min: 1 });
    else if (arg === "--collector-port") options.collectorPort = integerArg(take(), "--collector-port", { min: 1 });
    else usage(`unknown argument ${arg}`);
  }
  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function portFree(port) {
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

async function waitPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portFree(port)) return true;
    await sleep(300);
  }
  return false;
}

async function http(method, url, { body = null, timeoutMs = 15000 } = {}) {
  try {
    const response = await fetch(url, {
      method,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, text: await response.text() };
  } catch {
    return null;
  }
}

async function waitHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await http("GET", url, { timeoutMs: 5000 });
    if (response && response.status === 200) return response;
    await sleep(400);
  }
  throw new Error(`${label} did not answer 200 within ${timeoutMs}ms (${url})`);
}

function startProcess(label, exe, args, cwd, logPath) {
  const fd = openSync(logPath, "a");
  const child = spawn(exe, args, {
    cwd,
    windowsHide: true,
    stdio: ["ignore", fd, fd],
  });
  const state = { label, child, fd, logPath };
  child.on("exit", (code, signal) => {
    state.exit = { code, signal };
  });
  return state;
}

async function stopProcess(state) {
  if (!state) return;
  const { child, fd } = state;
  if (child && child.pid && state.exit === undefined) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGKILL");
    }
  }
  await new Promise((resolve) => {
    if (!child || state.exit !== undefined) resolve();
    else {
      child.once("exit", () => resolve());
      setTimeout(resolve, 5000);
    }
  });
  try {
    closeSync(fd);
  } catch {
    /* already closed */
  }
}

function percentileNearestRank(sorted, percentile) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function previewUrl(options) {
  const note = encodeURIComponent(NOTE_3000);
  return (
    `http://127.0.0.1:${options.port}/api/orders/1/preview-discount` +
    `?requestedAmount=100&demoSecret=s3cr3t&note=${note}`
  );
}

async function onePreview(options) {
  const started = process.hrtime.bigint();
  const response = await http("POST", previewUrl(options), { timeoutMs: 30000 });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (!response || response.status !== 200) {
    throw new Error(`preview-discount failed: status=${response ? response.status : "network"}`);
  }
  let body = null;
  try {
    body = JSON.parse(response.text);
  } catch {
    body = null;
  }
  if (!body || body.data !== 0) {
    throw new Error(`preview-discount body is not {"data":0}: ${String(response.text).slice(0, 80)}`);
  }
  return elapsedMs;
}

async function runBattery(options) {
  for (let index = 0; index < options.warmup; index += 1) {
    await onePreview(options);
  }
  const rounds = [];
  for (let round = 0; round < options.rounds; round += 1) {
    const samples = [];
    for (let index = 0; index < options.n; index += 1) {
      samples.push(await onePreview(options));
    }
    samples.sort((a, b) => a - b);
    rounds.push({
      n: samples.length,
      p50Ms: round3(percentileNearestRank(samples, 50)),
      p95Ms: round3(percentileNearestRank(samples, 95)),
    });
  }
  return {
    rounds,
    samples: options.rounds * options.n,
    p50Ms: round3(median(rounds.map((round) => round.p50Ms))),
    p95Ms: round3(median(rounds.map((round) => round.p95Ms))),
  };
}

async function agentEventCount(options) {
  // The events API caps limit at 500, so use nextSeq - 1 for the total when available.
  const response = await http(
    "GET",
    `http://127.0.0.1:${options.collectorPort}/api/v1/sessions/${PERF_SESSION}/events?afterSeq=0&limit=500`,
  );
  if (!response || response.status !== 200) return 0;
  try {
    const body = JSON.parse(response.text);
    const nextSeq = Number(body.nextSeq ?? 0);
    if (Number.isFinite(nextSeq) && nextSeq > 0) return nextSeq - 1;
    return Array.isArray(body.events) ? body.events.length : 0;
  } catch {
    return 0;
  }
}

async function waitAgentHello(options) {
  const deadline = Date.now() + 30000;
  const url = `http://127.0.0.1:${options.collectorPort}/api/v1/sessions/${PERF_SESSION}/agent`;
  while (Date.now() < deadline) {
    const response = await http("GET", url, { timeoutMs: 5000 });
    if (response && response.status === 200) {
      try {
        if (JSON.parse(response.text).connected === true) return true;
      } catch {
        /* not ready */
      }
    }
    await sleep(400);
  }
  return false;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const [label, file] of [
    ["JDK21 java", JAVA21],
    ["JDK8 java", JAVA8],
    ["collector jar", COLLECTOR_JAR],
    ["demo jar", DEMO_JAR],
    ["agent jar", AGENT_JAR],
  ]) {
    if (!existsSync(file)) throw new Error(`${label} missing: ${file}`);
  }
  if (!(await portFree(options.port))) throw new Error(`port ${options.port} already in use`);
  if (!(await portFree(options.collectorPort))) throw new Error(`port ${options.collectorPort} already in use`);

  const tmpDir = mkdtempSync(path.join(tmpdir(), "traceboard-perf-"));
  mkdirSync(tmpDir, { recursive: true });
  let collector = null;
  let demo = null;
  try {
    collector = startProcess(
      "collector",
      JAVA21,
      ["-jar", COLLECTOR_JAR],
      REPO,
      path.join(tmpDir, "collector.log"),
    );
    await waitHttp(
      `http://127.0.0.1:${options.collectorPort}/actuator/health`,
      90000,
      "collector health",
    );

    /* ---------------- base: demo without the agent ---------------- */
    demo = startProcess(
      "demo-base",
      JAVA8,
      [`-Dserver.port=${options.port}`, "-jar", DEMO_JAR],
      path.join(REPO, "demo/buggy-shop-boot-vue/backend"),
      path.join(tmpDir, "demo-base.log"),
    );
    await waitHttp(`http://127.0.0.1:${options.port}/api/orders`, 90000, "demo base /api/orders");
    const base = await runBattery(options);
    base.events = 0;
    await stopProcess(demo);
    demo = null;
    if (!(await waitPortFree(options.port, 30000))) {
      throw new Error(`port ${options.port} did not free after the base run`);
    }

    /* ---------------- agent: collector + demo + javaagent ---------------- */
    demo = startProcess(
      "demo-agent",
      JAVA8,
      [
        `-javaagent:${AGENT_JAR}`,
        `-Dtraceboard.ingestUrl=http://127.0.0.1:${options.collectorPort}/ingest/v1/events`,
        `-Dtraceboard.sessionId=${PERF_SESSION}`,
        `-Dserver.port=${options.port}`,
        "-jar",
        DEMO_JAR,
      ],
      path.join(REPO, "demo/buggy-shop-boot-vue/backend"),
      path.join(tmpDir, "demo-agent.log"),
    );
    await waitHttp(`http://127.0.0.1:${options.port}/api/orders`, 90000, "demo agent /api/orders");
    const hello = await waitAgentHello(options);
    if (!hello) throw new Error("agent handshake (connected:true) did not arrive within 30s");
    const agent = await runBattery(options);
    await sleep(1500);
    agent.events = await agentEventCount(options);
    agent.sessionId = PERF_SESSION;
    if (agent.events <= 0) {
      throw new Error("agent run produced 0 collector events (L1 pipeline did not run)");
    }

    const ratio = base.p50Ms > 0 ? round3(agent.p50Ms / base.p50Ms) : null;
    const result = {
      script: "tools/perf/l1-overhead.mjs",
      createdAt: new Date().toISOString(),
      n: options.n,
      warmup: options.warmup,
      rounds: options.rounds,
      port: options.port,
      collectorPort: options.collectorPort,
      base,
      agent,
      ratio,
      ratioDefinition: "median(agent p50Ms) / median(base p50Ms)",
      warn: ratio !== null && ratio > 1.25 ? "l1_overhead_ratio>1.25" : null,
      threshold: "none; 1.25 is a WARN label only (report-only)",
      reportOnly: true,
    };
    process.stdout.write(`PERF_RESULT:${JSON.stringify(result)}\n`);
    return 0;
  } finally {
    await stopProcess(demo);
    await stopProcess(collector);
    await waitPortFree(options.port, 30000);
    await waitPortFree(options.collectorPort, 30000);
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`PERF_ERROR:${error && error.message ? error.message : String(error)}\n`);
    process.exit(1);
  });