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
  "#btn-unjoined",
  "#btn-reconcile",
  "#btn-reconcile-async",
  "#btn-reconcile-loop"
];

// Human-readable metadata for the 10 demo buttons. `label` is the short case
// badge shown in the UI; `action` is the Chinese description of the click.
const DEMO_META = {
  "#btn-cancel": { label: "案例 A", action: "取消订单" },
  "#btn-save-b": { label: "案例 B", action: "纯前端校验" },
  "#btn-discount": { label: "L1", action: "折扣预览" },
  "#btn-remark": { label: "C", action: "请求体" },
  "#btn-no-debug": { label: "D", action: "无调试信息" },
  "#btn-unknown-cancel": { label: "D", action: "未知订单" },
  "#btn-unjoined": { label: "D", action: "未接入后端" },
  "#btn-reconcile": { label: "L2", action: "重算金额" },
  "#btn-reconcile-async": { label: "L2", action: "异步重算" },
  "#btn-reconcile-loop": { label: "L2", action: "循环重算" }
};

const sessions = await getJson("/api/v1/sessions");
const requests = await getJson(`/api/v1/sessions/${encodeURIComponent(SESSION)}/requests`);
const latestByRoot = new Map();
for (const request of requests.requests ?? []) {
  if (!latestByRoot.has(request.nodeKey)) {
    latestByRoot.set(request.nodeKey, request);
  }
}
const missingKeys = DEMO_ORDER.filter((key) => !latestByRoot.has(key));
if (missingKeys.length > 0) {
  console.warn(
    `WARN: ${missingKeys.length} demo case(s) not found in session ${SESSION}: ${missingKeys.join(", ")}`
  );
  console.warn("WARN: missing cases are omitted from demo-data.js (no placeholder data is invented).");
}
requests.requests = DEMO_ORDER.map((key) => latestByRoot.get(key)).filter(Boolean);
const cases = {};
for (const key of DEMO_ORDER) {
  const request = latestByRoot.get(key);
  if (request === undefined) {
    continue;
  }
  const meta = DEMO_META[key];
  cases[key] = {
    traceId: request.traceId,
    label: meta.label,
    action: meta.action
  };
}
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
const data = {
  sessions,
  sessionId: SESSION,
  generatedAt: new Date().toISOString(),
  requests,
  graphs,
  replays: { all: replay },
  cases
};
writeFileSync(OUT, `window.__TRACEBOARD_STATIC_DEMO__ = ${JSON.stringify(data)};\n`, "utf8");
console.log(
  `demo data -> ${OUT} (${requests.requests?.length ?? 0}/${DEMO_ORDER.length} cases, ` +
    `${Object.keys(graphs).length} graphs, session ${SESSION}, generatedAt ${data.generatedAt})`
);