import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.COLLECTOR_BASE ?? "http://127.0.0.1:8601";
const SESSION = process.env.DEMO_SESSION ?? "s_s3demo";
const OUT = resolve(process.argv[2] ?? "site/traceboard/demo-data.js");

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}`);
  }
  return response.json();
}

const DEMO_ORDER = [
  "#btn-cancel",
  "#btn-save-b",
  "#btn-discount",
  "#btn-remark",
  "#btn-no-debug",
  "#btn-unknown-cancel",
  "#btn-unjoined"
];
const sessions = await getJson("/api/v1/sessions");
const requests = await getJson(`/api/v1/sessions/${encodeURIComponent(SESSION)}/requests`);
const latestByRoot = new Map();
for (const request of requests.requests ?? []) {
  if (!latestByRoot.has(request.nodeKey)) {
    latestByRoot.set(request.nodeKey, request);
  }
}
requests.requests = DEMO_ORDER.map((key) => latestByRoot.get(key)).filter(Boolean);
const graphs = {};
for (const request of requests.requests) {
  graphs[request.traceId] = await getJson(
    `/api/v1/sessions/${encodeURIComponent(SESSION)}/graph?traceId=${request.traceId}`
  );
}
const starts = (requests.requests ?? []).map((item) => item.startedAtNs).filter(Number.isFinite);
const ends = (requests.requests ?? [])
  .map((item) => item.startedAtNs + item.durNs)
  .filter(Number.isFinite);
const fromNs = starts.length > 0 ? Math.min(...starts) : 0;
const toNs = ends.length > 0 ? Math.max(...ends) : fromNs;
const replay = await getJson(
  `/api/v1/sessions/${encodeURIComponent(SESSION)}/replay?fromNs=${fromNs}&toNs=${toNs}`
);
const data = { sessions, requests, graphs, replays: { all: replay } };
writeFileSync(OUT, `window.__TRACEBOARD_STATIC_DEMO__ = ${JSON.stringify(data)};\n`, "utf8");
console.log(`demo data -> ${OUT} (${requests.requests?.length ?? 0} cases, ${Object.keys(graphs).length} graphs)`);