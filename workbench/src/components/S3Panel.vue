<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  CollectorHttpError,
  CollectorUnreachableError,
  fetchGraph,
  fetchReplay,
  fetchRequests,
  fetchSessions,
  type GraphNode,
  type RequestSummary,
  type SessionSummary,
  type SideEffectItem,
} from "../api";
import { useS3Store, type S3Error, type S3Tab } from "../stores/s3";
import S4DetailPanel from "./S4DetailPanel.vue";
import { groupNodesByNodeKey } from "../s4/derive";

const s3 = useS3Store();

/** S4: selected graph node (detail drawer); selection is display-only. */
const selectedSpanId = ref<string | null>(null);

/** Low-frequency polling only while LIVE and visible — this is not realtime. */
const POLL_INTERVAL_MS = 5000;
/** UI clock for the case-B observe window; not a network poll. */
const CLOCK_INTERVAL_MS = 1000;
/** Slider drags are debounced before calling GET /replay (read-only). */
const REPLAY_DEBOUNCE_MS = 150;
const PLAY_INTERVAL_MS = 100;
const DEFAULT_OBSERVE_MS = 1500;
const MISSING = "未采集";
const THREW_STATUS = "THREW";
const TICK_KINDS = new Set(["ui_event", "fetch", "sql", "render"]);

const sessionDraft = ref(s3.sessionId);
const nowNs = ref(Date.now() * 1_000_000);

let pollTimer: number | null = null;
let clockTimer: number | null = null;
let replayTimer: number | null = null;
let playTimer: number | null = null;
let replayRequestSeq = 0;

function describeError(cause: unknown, scope: "requests" | "graph" | "replay"): S3Error {
  if (cause instanceof CollectorUnreachableError) {
    return {
      message: "collector 不可达：http://127.0.0.1:8601",
      hint: "请先启动 collector（127.0.0.1:8601）；本板只做只读查询，回放只 GET /replay。",
    };
  }
  if (cause instanceof CollectorHttpError) {
    let hint: string | null = null;
    if (cause.status === 404) {
      hint =
        scope === "requests"
          ? "该会话尚未接收任何事件（404）。"
          : scope === "graph"
            ? "当前会话中不存在该 traceId（404）。"
            : "该会话尚未接收任何事件，或回放端点不可用（404）。";
    } else if (cause.status === 400) {
      hint =
        scope === "replay"
          ? "回放窗口参数非法（400）：fromNs/toNs 必须是原始 epoch-ns 整数。"
          : scope === "graph"
            ? "traceId 参数非法（400）。"
            : "请求参数非法（400）。";
    } else if (cause.status === 405) {
      hint = "回放只允许 GET；工作台不会发送写请求。";
    }
    return { message: `collector 返回 HTTP ${cause.status}：${cause.message}`, hint };
  }
  return {
    message: cause instanceof Error ? cause.message : String(cause),
    hint: null,
  };
}

function filterRequests(list: readonly RequestSummary[], tab: S3Tab): RequestSummary[] {
  if (tab === "requests") {
    return list.filter((item) => item.fetchCount > 0);
  }
  if (tab === "clicks") {
    // A "click" tab must be a frontend click root with zero fetch — a
    // backend-only LOST trace (fetchCount=0) is not a click.
    return list.filter(
      (item) => item.fetchCount === 0 && item.rootKind === "ui_event"
    );
  }
  return [...list];
}

async function loadSessions(): Promise<void> {
  try {
    const sessions: SessionSummary[] = await fetchSessions();
    s3.setSessions(sessions);
  } catch {
    s3.setSessions([]);
  }
}

/** After a graph lands, pin the slider to the full window and refresh replay. */
function onGraphChanged(): void {
  s3.setSlider(maxRel.value);
  if (s3.mode === "replay") {
    scheduleReplayLoad(true);
  }
}

async function loadGraphFor(traceId: string): Promise<void> {
  s3.beginGraph();
  try {
    const graph = await fetchGraph(s3.sessionId, traceId);
    s3.setGraph(graph);
    onGraphChanged();
  } catch (cause) {
    s3.failGraph(describeError(cause, "graph"));
  }
}

async function refresh(): Promise<void> {
  if (s3.refreshing) {
    return;
  }
  s3.beginRefresh();
  try {
    const response = await fetchRequests(s3.sessionId);
    s3.setRequests(response.sessionId, response.sdkActive, response.requests);
    const filtered = filterRequests(response.requests, s3.tab);
    const previous = s3.selectedTraceId;
    const kept =
      previous !== null && filtered.some((item) => item.traceId === previous);
    const next = kept ? previous : (filtered[0]?.traceId ?? null);
    if (next !== previous) {
      selectedSpanId.value = null;
    }
    if (next === null) {
      s3.selectTrace(null);
      s3.clearGraph();
    } else {
      s3.selectTrace(next);
      await loadGraphFor(next);
    }
  } catch (cause) {
    s3.failRequests(describeError(cause, "requests"));
  } finally {
    s3.finishRefresh();
  }
}

function applySession(): void {
  const next = sessionDraft.value.trim();
  if (next.length === 0) {
    sessionDraft.value = s3.sessionId;
    return;
  }
  if (next === s3.sessionId) {
    return;
  }
  s3.setSession(next);
  sessionDraft.value = next;
  void refresh();
}

function selectRequest(traceId: string): void {
  if (traceId === s3.selectedTraceId && s3.graph !== null) {
    return;
  }
  s3.selectTrace(traceId);
  selectedSpanId.value = null;
  void loadGraphFor(traceId);
}

function selectTab(tab: S3Tab): void {
  if (tab === s3.tab) {
    return;
  }
  s3.setTab(tab);
  const list = filterRequests(s3.requests, tab);
  if (list.length === 0) {
    s3.selectTrace(null);
    s3.clearGraph();
    return;
  }
  if (!list.some((item) => item.traceId === s3.selectedTraceId)) {
    selectRequest(list[0].traceId);
  }
}

function pageVisible(): boolean {
  return document.visibilityState === "visible";
}

function startPolling(): void {
  stopPolling();
  pollTimer = window.setInterval(() => {
    // Poll only LIVE; REPLAY is a bounded read of stored events and must not
    // keep re-reading in the background.
    if (s3.mode === "live" && pageVisible()) {
      void refresh();
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function stopPlayTimer(): void {
  if (playTimer !== null) {
    window.clearInterval(playTimer);
    playTimer = null;
  }
}

function stopReplayTimer(): void {
  if (replayTimer !== null) {
    window.clearTimeout(replayTimer);
    replayTimer = null;
  }
}

onMounted(async () => {
  void loadSessions();
  await refresh();
  startPolling();
  clockTimer = window.setInterval(() => {
    nowNs.value = Date.now() * 1_000_000;
  }, CLOCK_INTERVAL_MS);
});

onBeforeUnmount(() => {
  stopPolling();
  stopPlayTimer();
  stopReplayTimer();
  if (clockTimer !== null) {
    window.clearInterval(clockTimer);
    clockTimer = null;
  }
});

// ---------------------------------------------------------------------------
// Selected request / case-B verdict
// ---------------------------------------------------------------------------

const selectedRequest = computed<RequestSummary | null>(() => {
  const traceId = s3.selectedTraceId;
  if (traceId === null) {
    return null;
  }
  return s3.requests.find((item) => item.traceId === traceId) ?? null;
});

const visibleRequests = computed(() => filterRequests(s3.requests, s3.tab));

const tabCounts = computed(() => ({
  all: s3.requests.length,
  requests: s3.requests.filter((item) => item.fetchCount > 0).length,
  clicks: s3.requests.filter(
    (item) => item.fetchCount === 0 && item.rootKind === "ui_event"
  ).length,
}));

const rootNode = computed<GraphNode | null>(() => {
  const nodes = s3.graph?.nodes ?? [];
  return (
    nodes.find((node) => node.parentSpanId === null && node.kind === "ui_event") ??
    nodes.find((node) => node.parentSpanId === null) ??
    null
  );
});

const observeFlag = computed<string | null>(() => {
  const flag = rootNode.value?.flags.find((item) => item.startsWith("OBSERVE_MS="));
  return flag ?? null;
});

const observeMs = computed<number>(() => {
  if (observeFlag.value === null) {
    return DEFAULT_OBSERVE_MS;
  }
  const parsed = Number.parseInt(observeFlag.value.slice("OBSERVE_MS=".length), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_OBSERVE_MS;
});

const rootStartNs = computed<number>(
  () => rootNode.value?.startNs ?? selectedRequest.value?.startedAtNs ?? 0
);

const rootConfidence = computed<string>(() => {
  const fromRequest = selectedRequest.value?.confidence ?? "";
  if (fromRequest.length > 0) {
    return fromRequest;
  }
  return s3.graph?.confidence ?? "";
});

type CaseBKind =
  | "loading"
  | "unable"
  | "none"
  | "confirmed"
  | "observing"
  | "lost"
  | "joined"
  | "orphan"
  | "partial";

interface CaseBView {
  kind: CaseBKind;
  text: string;
  detail: string | null;
}

/**
 * Case-B verdict (api.v1.md §9.3). "Confirmed no request" needs all of:
 * sdkActive, ui_event root, EXACT, fetchCount=0, hasBackend=false and a closed
 * observe window. Anything else is never rendered as success.
 */
const caseB = computed<CaseBView>(() => {
  if (
    s3.requestsStatus === "loading" ||
    (s3.requestsStatus === "idle" && s3.requests.length === 0)
  ) {
    return { kind: "loading", text: "正在读取会话事实…", detail: null };
  }
  if (!s3.sdkActive) {
    return {
      kind: "unable",
      text: "无法确认：前端采集未接入",
      detail:
        "sdkActive=false：会话中没有带 SDK_ACTIVE 的 click 根，不能推断“本次点击没发请求”。",
    };
  }
  const request = selectedRequest.value;
  if (request === null) {
    return {
      kind: "none",
      text: "暂无请求，不判定为“没发请求”",
      detail: "空态不是成功：没有 click 根/请求事实可判读。",
    };
  }
  if (s3.graphStatus === "error") {
    return {
      kind: "orphan",
      text: "无法确认：事实链读取失败（graph error），不判定为“没发请求”",
      detail: "graph 未加载时无法核对 click 根与 OBSERVE_MS；先修复读取错误。",
    };
  }
  if (s3.graphStatus === "loading" || s3.graph === null) {
    return {
      kind: "loading",
      text: "正在读取事实链…",
      detail: "事实链未就绪时不判定为“没发请求”，避免把未加载当成零事实。",
    };
  }
  if (rootNode.value === null) {
    return {
      kind: "orphan",
      text: "无法确认：未读到 click 根（graph 缺根），不判定为“没发请求”",
      detail: "需要 graph 中的 ui_event 根 + OBSERVE_MS 才能确认观察窗已关闭。",
    };
  }
  const rootKind = rootNode.value.kind || request.rootKind || "";
  if (rootKind !== "ui_event") {
    return {
      kind: "orphan",
      text: `游离请求（无 frontend click 根）· confidence ${rootConfidence.value || MISSING}`,
      detail: "游离后端请求不参与“没发请求”判定；confidence=LOST 不是状态。",
    };
  }
  if (request.fetchCount > 0 && !request.hasBackend) {
    return {
      kind: "lost",
      text: "前端已发请求但后端未采集（LOST）",
      detail: `fetchCount=${request.fetchCount} · hasBackend=false · backendSpanCount=${request.backendSpanCount}；失败 fetch 节点单独标失败，不并入“没发”。`,
    };
  }
  if (rootConfidence.value !== "EXACT") {
    return {
      kind: "orphan",
      text: `根 confidence=${rootConfidence.value || MISSING}，不满足 EXACT，不判定为“没发请求”`,
      detail: "只有 EXACT 的 ui_event 根才能进入案例 B 判定。",
    };
  }
  if (request.fetchCount === 0 && !request.hasBackend) {
    const elapsedNs = nowNs.value - rootStartNs.value;
    const windowNs = observeMs.value * 1_000_000;
    if (elapsedNs >= windowNs) {
      const earlyClosed = observeFlag.value !== null && observeMs.value < DEFAULT_OBSERVE_MS;
      return {
        kind: "confirmed",
        text: "已确认：本次点击因果链内没有网络请求",
        detail:
          `SDK 在线；观察窗 ${observeMs.value}ms 已关闭（${observeFlag.value ?? `OBSERVE_MS 未记录，按默认 ${DEFAULT_OBSERVE_MS}ms`}）；` +
          `fetch/XHR=0；后端 span=0${earlyClosed ? "；观察窗提前关闭（OBSERVE_MS < 1500）" : ""}。`,
      };
    }
    const elapsedMs = Math.max(0, elapsedNs / 1_000_000);
    const remainingMs = Math.max(0, (windowNs - elapsedNs) / 1_000_000);
    return {
      kind: "observing",
      text: "观察中…",
      detail: `观察窗 ${observeMs.value}ms 尚未关闭：已过 ${elapsedMs.toFixed(0)}ms，剩余 ${remainingMs.toFixed(0)}ms；关闭前不下结论。`,
    };
  }
  if (request.fetchCount === 0 && request.hasBackend) {
    return {
      kind: "partial",
      text: "存在后端事实但本次点击未采集 fetch，不判定为“没发请求”",
      detail: `fetchCount=0 · hasBackend=true · backendSpanCount=${request.backendSpanCount}；需检查前端采集。`,
    };
  }
  return {
    kind: "joined",
    text: "已关联：前端 fetch ↔ 后端事实链（EXACT），不写“没发请求”",
    detail: `fetchCount=${request.fetchCount} · backendSpanCount=${request.backendSpanCount} · confidence ${request.confidence}`,
  };
});

// ---------------------------------------------------------------------------
// Timeline normalisation and read-only replay
// ---------------------------------------------------------------------------

const minStartNs = computed<number>(() => {
  const nodes = s3.graph?.nodes ?? [];
  if (nodes.length === 0) {
    return selectedRequest.value?.startedAtNs ?? 0;
  }
  let min = nodes[0].startNs;
  for (const node of nodes) {
    if (node.startNs < min) {
      min = node.startNs;
    }
  }
  return Number.isFinite(min) ? min : 0;
});

/** Longest event end minus the trace minimum — the slider's 0..max range. */
const maxRel = computed<number>(() => {
  const nodes = s3.graph?.nodes ?? [];
  if (nodes.length === 0) {
    return 0;
  }
  let maxEnd = minStartNs.value;
  for (const node of nodes) {
    maxEnd = Math.max(maxEnd, node.startNs + node.durNs);
  }
  return Math.max(0, maxEnd - minStartNs.value);
});

const effectiveSliderNs = computed<number>(() =>
  Math.min(Math.max(s3.sliderNs, 0), maxRel.value)
);

/** Display cutoff: raw startNs of the selected trace at the current slider. */
const cutoffNs = computed<number>(() => minStartNs.value + effectiveSliderNs.value);

const sliderPct = computed<number>(() => {
  const max = maxRel.value;
  if (max <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, (effectiveSliderNs.value / max) * 100));
});

interface TimelineTick {
  id: string;
  kind: string;
  label: string;
  nodeKey: string;
  relNs: number;
  pct: number;
}

const TICK_LABELS: Record<string, string> = {
  ui_event: "click",
  fetch: "fetch",
  sql: "sql",
  render: "render",
};

const timelineTicks = computed<TimelineTick[]>(() => {
  const nodes = s3.graph?.nodes ?? [];
  const max = maxRel.value;
  const base = minStartNs.value;
  return nodes
    .filter((node) => TICK_KINDS.has(node.kind))
    .map((node) => {
      const relNs = Math.max(0, node.startNs - base);
      return {
        id: node.spanId,
        kind: node.kind,
        label: TICK_LABELS[node.kind] ?? node.kind,
        nodeKey: node.nodeKey,
        relNs,
        pct: max <= 0 ? 0 : Math.min(100, (relNs / max) * 100),
      };
    });
});

const visibleNodes = computed<GraphNode[]>(() => {
  const nodes = s3.graph?.nodes ?? [];
  if (s3.mode !== "replay") {
    return nodes;
  }
  return nodes.filter((node) => node.startNs <= cutoffNs.value);
});

const hiddenNodes = computed<GraphNode[]>(() => {
  if (s3.mode !== "replay") {
    return [];
  }
  return (s3.graph?.nodes ?? []).filter((node) => node.startNs > cutoffNs.value);
});

interface TreeRow {
  node: GraphNode;
  depth: number;
  orphan: boolean;
  running: boolean;
}

function sortNodes(a: GraphNode, b: GraphNode): number {
  if (a.startNs !== b.startNs) {
    return a.startNs - b.startNs;
  }
  return a.spanId.localeCompare(b.spanId);
}

/**
 * Depth comes from parentSpanId only; sibling order is startNs (then spanId).
 * A node whose parent is missing from the visible window is shown as an
 * orphan root instead of silently disappearing.
 */
function buildRows(nodes: readonly GraphNode[]): TreeRow[] {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) {
    byId.set(node.spanId, node);
  }
  const children = new Map<string, GraphNode[]>();
  const roots: GraphNode[] = [];
  for (const node of nodes) {
    if (
      node.parentSpanId !== null &&
      node.parentSpanId !== node.spanId &&
      byId.has(node.parentSpanId)
    ) {
      const list = children.get(node.parentSpanId) ?? [];
      list.push(node);
      children.set(node.parentSpanId, list);
    } else {
      roots.push(node);
    }
  }
  roots.sort(sortNodes);
  for (const list of children.values()) {
    list.sort(sortNodes);
  }
  const rows: TreeRow[] = [];
  const visited = new Set<string>();
  const walk = (node: GraphNode, depth: number): void => {
    if (visited.has(node.spanId)) {
      return;
    }
    visited.add(node.spanId);
    rows.push({
      node,
      depth,
      orphan: node.parentSpanId !== null && !byId.has(node.parentSpanId),
      running:
        s3.mode === "replay" &&
        node.startNs <= cutoffNs.value &&
        node.startNs + node.durNs > cutoffNs.value,
    });
    const list = children.get(node.spanId) ?? [];
    for (const child of list) {
      walk(child, depth + 1);
    }
  };
  for (const root of roots) {
    walk(root, 0);
  }
  // Defensive: a cycle would leave nodes unvisited; show them flat, never drop.
  for (const node of nodes) {
    if (!visited.has(node.spanId)) {
      walk(node, 0);
    }
  }
  return rows;
}

const treeRows = computed<TreeRow[]>(() => buildRows(visibleNodes.value));

// ---------------------------------------------------------------------------
// S4: selected node, ×N grouping (display only) and detail drawer
// ---------------------------------------------------------------------------

const nodeGroups = computed(() =>
  groupNodesByNodeKey(s3.graph?.nodes ?? [])
);

const groupCounts = computed<Map<string, number>>(() => {
  const counts = new Map<string, number>();
  for (const group of nodeGroups.value) {
    counts.set(group.nodeKey, group.count);
  }
  return counts;
});

function groupCount(nodeKey: string): number {
  return groupCounts.value.get(nodeKey) ?? 1;
}

function selectSpan(spanId: string): void {
  selectedSpanId.value = spanId;
}

function clearSelection(): void {
  selectedSpanId.value = null;
}

const replayTraceEventCount = computed<number>(() => {
  const traceId = s3.selectedTraceId;
  if (s3.replay === null || traceId === null) {
    return 0;
  }
  return s3.replay.events.filter((item) => item.event.traceId === traceId).length;
});

const replayWindowText = computed<string>(() => {
  if (s3.mode !== "replay") {
    return "LIVE：事实树来自 GET /graph；切到 REPLAY 后拖动滑块走 GET /replay 只读窗口。";
  }
  if (s3.replayStatus === "loading") {
    return "正在读取 GET /replay 窗口…";
  }
  const replay = s3.replay;
  if (replay === null) {
    return "REPLAY：等待回放窗口…（本地 graph 过滤仍只读）";
  }
  return (
    `GET /replay · fromNs ${replay.fromNs} → toNs ${replay.toNs} · 窗口 ${replay.events.length} 事件` +
    `（当前 trace ${replayTraceEventCount.value} 条）· mode=${replay.mode} · readOnly=${replay.readOnly ? "true" : "false"}`
  );
});

function scheduleReplayLoad(immediate = false): void {
  stopReplayTimer();
  if (s3.mode !== "replay" || s3.graph === null) {
    return;
  }
  if (immediate) {
    void loadReplayWindow();
    return;
  }
  replayTimer = window.setTimeout(() => {
    replayTimer = null;
    void loadReplayWindow();
  }, REPLAY_DEBOUNCE_MS);
}

async function loadReplayWindow(): Promise<void> {
  if (s3.mode !== "replay" || s3.graph === null) {
    return;
  }
  const fromNs = Math.floor(minStartNs.value);
  // Slider values are relative; the API only accepts raw epoch-ns.
  const toNs = Math.ceil(minStartNs.value + effectiveSliderNs.value);
  const seq = ++replayRequestSeq;
  s3.beginReplay();
  try {
    const replay = await fetchReplay(s3.sessionId, fromNs, toNs);
    if (seq === replayRequestSeq) {
      s3.setReplay(replay);
    }
  } catch (cause) {
    if (seq === replayRequestSeq) {
      s3.failReplay(describeError(cause, "replay"));
    }
  }
}

function enterReplay(): void {
  if (s3.mode === "replay") {
    return;
  }
  stopPolling();
  s3.setMode("replay");
  s3.setSlider(maxRel.value);
  scheduleReplayLoad(true);
}

function enterLive(): void {
  if (s3.mode === "live") {
    return;
  }
  stopPlayTimer();
  s3.setMode("live");
  s3.setSlider(maxRel.value);
  void refresh();
  startPolling();
}

function onSliderInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const value = Number(target.value);
  if (!Number.isFinite(value)) {
    return;
  }
  s3.setPlaying(false);
  stopPlayTimer();
  s3.setSlider(Math.min(Math.max(value, 0), maxRel.value));
  scheduleReplayLoad();
}

function togglePlay(): void {
  if (s3.mode !== "replay") {
    return;
  }
  if (s3.playing) {
    s3.setPlaying(false);
    stopPlayTimer();
    return;
  }
  if (effectiveSliderNs.value >= maxRel.value) {
    s3.setSlider(0);
    scheduleReplayLoad(true);
  }
  s3.setPlaying(true);
  stopPlayTimer();
  playTimer = window.setInterval(() => {
    if (!s3.playing || s3.mode !== "replay") {
      stopPlayTimer();
      return;
    }
    const stepNs = PLAY_INTERVAL_MS * 1_000_000 * s3.speed;
    const next = Math.min(maxRel.value, effectiveSliderNs.value + stepNs);
    s3.setSlider(next);
    scheduleReplayLoad();
    if (next >= maxRel.value) {
      s3.setPlaying(false);
      stopPlayTimer();
    }
  }, PLAY_INTERVAL_MS);
}

function onSpeedChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }
  s3.setSpeed(Number(target.value));
}

// ---------------------------------------------------------------------------
// Status semantics (colour + text, never colour alone)
// ---------------------------------------------------------------------------

type StatusTone =
  | "ok"
  | "false"
  | "threw"
  | "notcollected"
  | "truncated"
  | "redacted"
  | "unknown"
  | "neutral";

interface StatusMeta {
  tone: StatusTone;
  label: string;
  hint: string | null;
  reason: string | null;
  lock: boolean;
}

function notCollectedReason(status: string): string {
  if (status === "NOT_COLLECTED_POLICY") {
    return "采集策略未开启（S3 无采样/策略配置；需开启采集）";
  }
  if (status === "NOT_COLLECTED_LOST") {
    return "事件丢失（未到达 collector；检查 SDK/agent 与网络）";
  }
  if (status === "NOT_COLLECTED_NO_DEBUG_INFO") {
    return "缺少调试信息（需构建插件/sourcemap，S5 待做）";
  }
  return "该事实未采集（原因未提供；检查采集开关与连接）";
}

function statusMeta(status: string): StatusMeta {
  if (status === "OK") {
    return { tone: "ok", label: "OK", hint: null, reason: null, lock: false };
  }
  if (status === "RETURNED_FALSE") {
    return {
      tone: "false",
      label: "RETURNED_FALSE",
      hint: "正常返回 false",
      reason: null,
      lock: false,
    };
  }
  if (status === THREW_STATUS) {
    return { tone: "threw", label: "THREW", hint: "异常/断线", reason: null, lock: false };
  }
  if (status.startsWith("NOT_COLLECTED")) {
    return {
      tone: "notcollected",
      label: status,
      hint: "未采集",
      reason: notCollectedReason(status),
      lock: false,
    };
  }
  if (status === "TRUNCATED") {
    return {
      tone: "truncated",
      label: "TRUNCATED",
      hint: "已截断/已折叠",
      reason: null,
      lock: false,
    };
  }
  if (status === "REDACTED") {
    return {
      tone: "redacted",
      label: "REDACTED",
      hint: "已脱敏",
      reason: null,
      lock: true,
    };
  }
  if (status === "UNKNOWN") {
    return { tone: "unknown", label: "UNKNOWN", hint: "未知", reason: null, lock: false };
  }
  return {
    tone: "neutral",
    label: status.length > 0 ? status : MISSING,
    hint: null,
    reason: null,
    lock: false,
  };
}

function statusClass(status: string): string {
  return `s3-status--${statusMeta(status).tone}`;
}

function statusHint(status: string): string | null {
  return statusMeta(status).hint;
}

function statusReason(status: string): string | null {
  return statusMeta(status).reason;
}

function statusLock(status: string): boolean {
  return statusMeta(status).lock;
}

interface ConfidenceMeta {
  tone: string;
  text: string;
}

function confidenceMeta(confidence: string): ConfidenceMeta {
  if (confidence === "EXACT") {
    return { tone: "exact", text: "EXACT" };
  }
  if (confidence === "LOST") {
    return { tone: "lost", text: "LOST · 游离" };
  }
  if (confidence === "MANUAL") {
    return { tone: "manual", text: "MANUAL · 虚线（S3 不产生）" };
  }
  if (confidence === "INFERRED") {
    return { tone: "inferred", text: "INFERRED" };
  }
  return { tone: "neutral", text: confidence.length > 0 ? confidence : MISSING };
}

const STATUS_LEGEND = [
  { status: "OK", tone: "ok", hint: "常规/绿线（0/false 不是异常）", reason: null },
  { status: "RETURNED_FALSE", tone: "false", hint: "琥珀 · 正常返回 false", reason: null },
  { status: "THREW", tone: "threw", hint: "红/断线", reason: null },
  {
    status: "NOT_COLLECTED_*",
    tone: "notcollected",
    hint: "灰虚线 + reason（为什么没采到/怎么开启）",
    reason: "如 NOT_COLLECTED_NO_DEBUG_INFO → 需构建插件/sourcemap（S5 待做）",
  },
  { status: "TRUNCATED", tone: "truncated", hint: "条纹 · 已截断/已折叠", reason: null },
  { status: "REDACTED", tone: "redacted", hint: "锁形 · 值级已脱敏", reason: null },
  { status: "UNKNOWN", tone: "unknown", hint: "问号 · 未知", reason: null },
] as const;

const CONFIDENCE_LEGEND = [
  { value: "EXACT", hint: "浏览器内直接观测 / 头关联成功" },
  { value: "LOST", hint: "游离（只在 confidence，不伪装成 status）" },
  { value: "MANUAL", hint: "虚线（S3 不产生）" },
] as const;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatNs(ns: number): string {
  if (!Number.isFinite(ns) || ns < 0) {
    return "—";
  }
  if (ns < 1000) {
    return `${ns} ns`;
  }
  if (ns < 1_000_000) {
    return `${(ns / 1000).toFixed(2)} µs`;
  }
  if (ns < 1_000_000_000) {
    return `${(ns / 1_000_000).toFixed(2)} ms`;
  }
  return `${(ns / 1_000_000_000).toFixed(3)} s`;
}

function shortTrace(traceId: string): string {
  if (traceId.length === 0) {
    return "—";
  }
  return traceId.length > 8 ? `${traceId.slice(0, 8)}…` : traceId;
}

function rootLabel(request: RequestSummary): string {
  const kind = request.rootKind ?? "root";
  return `${kind} · ${request.nodeKey ?? "无根（未采集）"}`;
}

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  const json = JSON.stringify(value);
  if (json === undefined) {
    return String(value);
  }
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

function nodeReturnText(node: GraphNode): string {
  if (node.return === null) {
    return `${MISSING}（无返回摘要）`;
  }
  if (node.return.value === undefined) {
    return `${node.return.type} = ${MISSING}`;
  }
  return `${node.return.type} = ${formatValue(node.return.value)}`;
}

function describeSideEffect(effect: SideEffectItem): string {
  const sqlId = effect.sqlId ?? `${MISSING} sqlId`;
  const rows =
    effect.rowsAffected === null
      ? "rowsAffected 未采集"
      : `rowsAffected ${effect.rowsAffected}`;
  const tx = effect.transaction ?? "transaction 未采集";
  return `${effect.type} · ${sqlId} · ${rows} · ${tx}`;
}

function nodeSideEffectsText(node: GraphNode): string {
  if (node.sideEffects.length === 0) {
    return node.kind === "sql" ? `${MISSING}（事件未携带 sideEffects）` : "无记录";
  }
  return node.sideEffects.map(describeSideEffect).join("；");
}

function threadText(node: GraphNode): string {
  if (node.thread === null) {
    return `${MISSING}（事件未携带线程）`;
  }
  return `${node.thread.name} #${node.thread.id}`;
}

const linkedFetchIds = computed<Set<string>>(() => {
  const set = new Set<string>();
  for (const node of s3.graph?.nodes ?? []) {
    if (node.kind === "controller" && node.parentSpanId !== null) {
      set.add(node.parentSpanId);
    }
  }
  return set;
});

/** Node-level annotations; never a business verdict. */
function nodeNotes(node: GraphNode): string[] {
  const notes: string[] = [];
  if (node.kind === "js_method") {
    notes.push("JS 内部变量本次未采集（无构建插件/sourcemap）");
  }
  if (node.kind === "fetch") {
    if (!(selectedRequest.value?.hasBackend ?? false)) {
      notes.push("后端未采集（本 trace 无后端 span）");
    } else if (!linkedFetchIds.value.has(node.spanId)) {
      notes.push("后端未采集（未关联 controller）");
    }
  }
  if (node.kind === "sql" && node.sideEffects.length === 0) {
    notes.push("sideEffects 未采集（不推断 0 行）");
  }
  return notes;
}

function rawTimeTitle(node: GraphNode): string {
  return `raw startNs ${node.startNs} · durNs ${node.durNs} · relNs ${node.startNs - minStartNs.value}`;
}
</script>

<template>
  <section id="s3-panel" class="s3-panel" aria-labelledby="s3-panel-title">
    <header class="s3-panel__header">
      <div>
        <h2 id="s3-panel-title" class="s3-panel__title">
          S3 · runtime SDK 前端事实 + 只读回放（案例 A/B）
        </h2>
        <p class="s3-panel__note">
          点击/控件/请求/DOM 事实来自 collector 的 requests / graph 只读查询；状态语义区分
          OK / RETURNED_FALSE / THREW / NOT_COLLECTED_* / TRUNCATED / REDACTED。
          无构建插件/sourcemap、无局部变量、非实时（无 SSE/WS）。
        </p>
      </div>
      <span class="s3-panel__badge">S3 · GET requests / graph / replay</span>
    </header>

    <div class="s3-controls">
      <label class="s3-controls__label" for="s3-session">会话 sessionId</label>
      <input
        id="s3-session"
        v-model="sessionDraft"
        class="s3-controls__input"
        list="s3-session-options"
        spellcheck="false"
        autocomplete="off"
        @change="applySession"
        @keyup.enter="applySession"
      />
      <datalist id="s3-session-options">
        <option v-for="session in s3.sessions" :key="session.sessionId" :value="session.sessionId">
          {{ session.eventCount }} 条事件
        </option>
      </datalist>
      <button
        id="s3-refresh"
        type="button"
        class="s3-controls__button"
        :disabled="s3.refreshing"
        @click="refresh"
      >
        {{ s3.refreshing ? "刷新中…" : "刷新" }}
      </button>
      <span class="s3-controls__hint">
        默认 s_s3demo · 输入会话 id 后回车切换 · LIVE 每 5 秒刷新（非实时）
      </span>
    </div>
    <p class="s3-controls__status">
      当前会话 <code>{{ s3.sessionId }}</code>
      <span class="s3-chip" :class="s3.sdkActive ? 's3-chip--on' : 's3-chip--off'">
        sdkActive {{ s3.sdkActive ? "true" : "false" }}
      </span>
      <span v-if="s3.lastRefreshedAt"> · 最近刷新 {{ s3.lastRefreshedAt }}</span>
      <span v-else> · 尚未刷新</span>
    </p>

    <p v-if="s3.requestsError" class="s3-banner s3-banner--error" role="alert">
      {{ s3.requestsError.message }}
      <span v-if="s3.requestsError.hint"> — {{ s3.requestsError.hint }}</span>
    </p>
    <p v-if="s3.graphError" class="s3-banner s3-banner--error" role="alert">
      {{ s3.graphError.message }}
      <span v-if="s3.graphError.hint"> — {{ s3.graphError.hint }}</span>
    </p>
    <p v-if="s3.requestsError && s3.requests.length > 0" class="s3-banner s3-banner--stale">
      下列请求列表来自上一次成功读取，可能已过期；本板不会写入 collector。
    </p>

    <div id="s3-tabs" class="s3-tabs" role="tablist" aria-label="请求过滤">
      <button
        type="button"
        role="tab"
        class="s3-tab"
        :class="{ 's3-tab--active': s3.tab === 'all' }"
        :aria-selected="s3.tab === 'all'"
        @click="selectTab('all')"
      >
        全部 <span class="s3-tab__count">{{ tabCounts.all }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="s3-tab"
        :class="{ 's3-tab--active': s3.tab === 'requests' }"
        :aria-selected="s3.tab === 'requests'"
        @click="selectTab('requests')"
      >
        请求 <span class="s3-tab__count">{{ tabCounts.requests }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="s3-tab"
        :class="{ 's3-tab--active': s3.tab === 'clicks' }"
        :aria-selected="s3.tab === 'clicks'"
        @click="selectTab('clicks')"
      >
        点击 <span class="s3-tab__count">{{ tabCounts.clicks }}</span>
      </button>
    </div>

    <div class="s3-body">
      <section class="s3-ops-wrap" aria-labelledby="s3-ops-title">
        <h3 id="s3-ops-title" class="s3-subtitle">请求列表（requests · 点选切换）</h3>
        <div id="s3-ops" class="s3-ops" role="tablist" aria-label="请求切换">
          <button
            v-for="request in visibleRequests"
            :key="request.traceId"
            type="button"
            role="tab"
            class="s3-req"
            :class="{ 's3-req--active': request.traceId === s3.selectedTraceId }"
            :aria-selected="request.traceId === s3.selectedTraceId"
            :title="request.traceId"
            @click="selectRequest(request.traceId)"
          >
            <span class="s3-req__line">
              <code class="s3-req__trace">traceId {{ shortTrace(request.traceId) }}</code>
              <span class="s3-status" :class="statusClass(request.status)">
                <span v-if="statusLock(request.status)" class="s3-lock" aria-hidden="true"></span>
                {{ statusMeta(request.status).label }}
              </span>
              <span class="s3-chip" :class="s3.sdkActive ? 's3-chip--on' : 's3-chip--off'">
                sdkActive {{ s3.sdkActive ? "true" : "false" }}
              </span>
            </span>
            <span class="s3-req__root">{{ rootLabel(request) }}</span>
            <span class="s3-req__meta">
              <span>spanCount {{ request.spanCount }}</span>
              <span>confidence {{ request.confidence }}</span>
              <span>fetchCount {{ request.fetchCount }}</span>
              <span>hasBackend {{ request.hasBackend ? "true" : "false" }}</span>
              <span>backendSpanCount {{ request.backendSpanCount }}</span>
              <span>hasError {{ request.hasError ? "true" : "false" }}</span>
            </span>
            <span v-if="statusHint(request.status)" class="s3-req__hint">
              {{ statusHint(request.status) }}
              <template v-if="statusReason(request.status)"> · {{ statusReason(request.status) }}</template>
            </span>
          </button>
        </div>

        <p
          v-if="visibleRequests.length === 0 && s3.requestsError === null && s3.requestsStatus !== 'ready'"
          class="s3-state"
        >
          正在读取请求列表…
        </p>
        <p
          v-else-if="visibleRequests.length === 0 && s3.requestsError === null && s3.requests.length === 0"
          class="s3-state"
        >
          空态：会话 <code>{{ s3.sessionId }}</code> 暂无 click/请求事实。空态不是“确认没发”；
          发起一次真实点击后刷新（collector 重启会清空内存）。
        </p>
        <p
          v-else-if="visibleRequests.length === 0 && s3.requests.length > 0"
          class="s3-state"
        >
          当前 tab 无匹配请求；切回“全部”。空态不判定为“没发请求”。
        </p>
      </section>

      <section class="s3-chain" aria-labelledby="s3-chain-title">
        <h3 id="s3-chain-title" class="s3-subtitle">
          混合事实树（graph · 按 startNs · click → js_method → fetch → 后端 → render）
        </h3>
        <p class="s3-chain__note">
          中性事实：不判定业务对错；OK 的 0/false 不是异常，LOST 只在 confidence。
        </p>

        <div id="s3-caseb" class="s3-caseb" :class="`s3-caseb--${caseB.kind}`">
          <span class="s3-caseb__label">案例 B 判定</span>
          <strong class="s3-caseb__text">{{ caseB.text }}</strong>
          <p v-if="caseB.detail" class="s3-caseb__detail">{{ caseB.detail }}</p>
        </div>

        <p v-if="selectedRequest === null" class="s3-state">
          空态：尚未选中请求（请求列表为空时不会自动选中）；不判定为“没发请求”。
        </p>

        <template v-if="selectedRequest !== null">
          <p class="s3-chain__meta">
            traceId <code>{{ selectedRequest.traceId }}</code>
            · {{ s3.graph?.nodes.length ?? 0 }} 节点 / {{ s3.graph?.edges.length ?? 0 }} 边
            · 根 confidence <strong>{{ confidenceMeta(rootConfidence).text }}</strong>
            <span class="s3-conf" :class="`s3-conf--${confidenceMeta(rootConfidence).tone}`">
              {{ confidenceMeta(rootConfidence).text }}
            </span>
            <span v-if="rootConfidence === 'LOST'" class="s3-chain__lost">
              游离：前端/后端未关联，LOST 只在 confidence，不作为 status
            </span>
          </p>

          <p v-if="s3.graphStatus === 'loading'" class="s3-state">正在读取事实链…</p>
        </template>

        <div class="s4-split">
          <div id="s3-tree" class="s3-tree">
          <p v-if="selectedRequest === null" class="s3-state">
            空态：无事实树可显示；请先选择一条请求。
          </p>
          <template v-else>
            <p v-if="s3.mode === 'replay' && hiddenNodes.length > 0" class="s3-tree__future">
              未发生：{{ hiddenNodes.length }} 个事件在回放点 t={{ formatNs(effectiveSliderNs) }}（relNs）之后，
              已隐藏：{{ hiddenNodes.map((node) => `${node.kind} ${node.nodeKey}`).join("；") }}
            </p>

            <ol v-if="treeRows.length > 0" class="s3-tree__list">
              <li v-for="row in treeRows" :key="row.node.spanId" class="s3-tree__row">
                <span
                  class="s3-tree__indent"
                  :class="`s3-tone--${statusMeta(row.node.status).tone}`"
                  aria-hidden="true"
                >
                  <span v-for="level in row.depth" :key="level" class="s3-tree__spacer"></span>
                  <span v-if="row.depth > 0" class="s3-tree__elbow"></span>
                </span>
                <div
                  class="s3-node"
                  :class="[
                    `s3-node--${statusMeta(row.node.status).tone}`,
                    { 's3-node--selected': selectedSpanId === row.node.spanId },
                  ]"
                  role="button"
                  tabindex="0"
                  :aria-pressed="selectedSpanId === row.node.spanId"
                  :title="`点击查看节点详情：${row.node.kind} · ${row.node.nodeKey}`"
                  @click="selectSpan(row.node.spanId)"
                  @keydown.enter="selectSpan(row.node.spanId)"
                  @keydown.space.prevent="selectSpan(row.node.spanId)"
                >
                  <div class="s3-node__head">
                    <span v-if="row.node.parentSpanId === null" class="s3-node__root-tag">根</span>
                    <span class="s3-node__kind">{{ row.node.kind }}</span>
                    <code class="s3-node__key">{{ row.node.nodeKey }}</code>
                    <span class="s3-status" :class="statusClass(row.node.status)">
                      <span
                        v-if="statusLock(row.node.status)"
                        class="s3-lock"
                        aria-hidden="true"
                      ></span>
                      {{ statusMeta(row.node.status).label }}
                    </span>
                    <span
                      v-if="groupCount(row.node.nodeKey) >= 2"
                      class="s4-xn"
                      :title="`该 nodeKey 在所选 trace 内已采集 ${groupCount(row.node.nodeKey)} 次（前端 ×N 聚合；运行时 ×3 属 S6）`"
                    >×{{ groupCount(row.node.nodeKey) }}</span>
                    <span v-if="selectedSpanId === row.node.spanId" class="s4-node-selected">节点详情已打开</span>
                    <span v-if="statusHint(row.node.status)" class="s3-node__hint">
                      {{ statusHint(row.node.status) }}
                    </span>
                    <span v-if="row.running" class="s3-node__running">进行中（未结束）</span>
                    <span v-if="row.orphan" class="s3-node__orphan">父 span 未采集/未发生</span>
                  </div>
                  <p v-if="statusReason(row.node.status)" class="s3-node__reason">
                    reason：{{ statusReason(row.node.status) }}
                  </p>
                  <div class="s3-node__facts">
                    <span>return：{{ nodeReturnText(row.node) }}</span>
                    <span>sideEffects：{{ nodeSideEffectsText(row.node) }}</span>
                  </div>
                  <div class="s3-node__flags">
                    <span
                      v-for="flag in row.node.flags"
                      :key="flag"
                      class="s3-flag"
                    >{{ flag }}</span>
                  </div>
                  <p v-for="note in nodeNotes(row.node)" :key="note" class="s3-node__note">
                    {{ note }}
                  </p>
                  <div class="s3-node__detail" :title="rawTimeTitle(row.node)">
                    线程 {{ threadText(row.node) }}
                    · relNs {{ formatNs(row.node.startNs - minStartNs) }}
                    · dur {{ formatNs(row.node.durNs) }}
                    · spanId <code>{{ row.node.spanId }}</code>
                  </div>
                </div>
              </li>
            </ol>
            <p
              v-else-if="s3.graphStatus === 'ready' && s3.graph !== null"
              class="s3-state"
            >
              图为空：该 trace 暂无节点（未采集）；空态不判定为“没发请求”。
            </p>
          </template>
          </div>

          <S4DetailPanel
            :nodes="s3.graph?.nodes ?? []"
            :selected-span-id="selectedSpanId"
            :min-start-ns="minStartNs"
            @select="selectSpan"
            @close="clearSelection"
          />
        </div>

        <div class="s3-legend">
          <p class="s3-legend__title">状态语义图例（颜色 + 文字，不靠颜色单独传达）</p>
          <ul class="s3-legend__list">
            <li
              v-for="item in STATUS_LEGEND"
              :key="item.status"
              class="s3-legend__item"
            >
              <span class="s3-status" :class="`s3-status--${item.tone}`">
                <span v-if="item.tone === 'redacted'" class="s3-lock" aria-hidden="true"></span>
                {{ item.status }}
              </span>
              <span class="s3-legend__hint">{{ item.hint }}</span>
            </li>
          </ul>
          <p class="s3-legend__title">confidence（不是 status）</p>
          <ul class="s3-legend__list">
            <li
              v-for="item in CONFIDENCE_LEGEND"
              :key="item.value"
              class="s3-legend__item"
            >
              <span class="s3-conf" :class="`s3-conf--${confidenceMeta(item.value).tone}`">
                {{ item.value }}
              </span>
              <span class="s3-legend__hint">{{ item.hint }}</span>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <section id="s3-timeline" class="s3-timeline" aria-labelledby="s3-timeline-title">
      <div class="s3-timeline__header">
        <h3 id="s3-timeline-title" class="s3-subtitle">
          时间轴（relNs = startNs − minStartNs；滑块与刻度均为相对时间）
        </h3>
        <div id="s3-replay-toggle" class="s3-mode" role="group" aria-label="LIVE/REPLAY 切换">
          <button
            type="button"
            class="s3-mode__button"
            :class="{ 's3-mode__button--active': s3.mode === 'live' }"
            :aria-pressed="s3.mode === 'live'"
            @click="enterLive"
          >
            LIVE
          </button>
          <button
            type="button"
            class="s3-mode__button"
            :class="{ 's3-mode__button--active': s3.mode === 'replay' }"
            :aria-pressed="s3.mode === 'replay'"
            @click="enterReplay"
          >
            REPLAY
          </button>
        </div>
        <span id="s3-readonly" class="s3-readonly">只读：不会重发请求/不写数据库</span>
      </div>

      <template v-if="s3.graph !== null">
        <div class="s3-timeline__labels">
          <span>0（relNs）</span>
          <span class="s3-timeline__now">t = {{ formatNs(effectiveSliderNs) }}</span>
          <span>{{ formatNs(maxRel) }}</span>
        </div>
        <div class="s3-timeline__track" aria-hidden="true">
          <span
            v-for="tick in timelineTicks"
            :key="tick.id"
            class="s3-tick"
            :class="`s3-tick--${tick.kind}`"
            :style="{ left: `${tick.pct}%` }"
            :title="`${tick.label} · ${tick.nodeKey} · relNs ${tick.relNs}`"
          ></span>
          <span class="s3-cursor" :style="{ left: `${sliderPct}%` }"></span>
        </div>
        <input
          id="s3-slider"
          class="s3-slider"
          type="range"
          min="0"
          :max="maxRel"
          step="1"
          :value="effectiveSliderNs"
          :disabled="s3.mode !== 'replay'"
          aria-label="回放时间轴（relNs）"
          @input="onSliderInput"
        />
        <div class="s3-timeline__controls">
          <button
            type="button"
            class="s3-controls__button"
            :disabled="s3.mode !== 'replay'"
            @click="togglePlay"
          >
            {{ s3.playing ? "暂停" : "播放" }}
          </button>
          <label class="s3-timeline__speed">
            速度
            <select :value="s3.speed" @change="onSpeedChange">
              <option :value="0.5">0.5×</option>
              <option :value="1">1×</option>
              <option :value="2">2×</option>
              <option :value="4">4×</option>
            </select>
          </label>
          <span class="s3-timeline__mode">
            {{ s3.mode === "live" ? "LIVE：显示全部已存事件（切到 REPLAY 才能拖动）" : "REPLAY：只读窗口；未来事件隐藏/未发生" }}
          </span>
        </div>
        <p class="s3-timeline__window">{{ replayWindowText }}</p>
        <ul class="s3-ticks">
          <li
            v-for="tick in timelineTicks"
            :key="`list-${tick.id}`"
            class="s3-tick-row"
            :class="`s3-tick-row--${tick.kind}`"
          >
            <span class="s3-tick-row__dot" aria-hidden="true"></span>
            {{ tick.label }} · {{ tick.nodeKey }} · relNs {{ formatNs(tick.relNs) }}
          </li>
        </ul>
        <p v-if="s3.replayError" class="s3-banner s3-banner--info">
          回放窗口读取失败：{{ s3.replayError.message }}
          <span v-if="s3.replayError.hint"> — {{ s3.replayError.hint }}</span>
          ；本地 graph 过滤仍只读（GET /replay 失败不会触发任何写请求）。
        </p>
      </template>
      <p v-else class="s3-state">
        时间轴：选择请求后显示 0..maxRel；回放只 GET /replay，不重发请求、不写数据库。
      </p>
    </section>

    <p class="s3-panel__footnote">
      本板只读：GET requests / graph / replay。回放不会重发请求、不写数据库、不调用 demo、不执行程序；
      时间轴按所选 trace 的 min(startNs) 归一化显示，API 参数仍是原始 epoch-ns。
      S4 节点详情 / ×N 分组 / 缺口清单均为已采集 graph 的只读前端派生（运行时 ×3 属 S6）；
      无 S5/S6（无 sourcemap/局部变量/行号映射/图库/SSE/WS）。S0/S1/S2 面板保留在下方折叠区。
    </p>
  </section>
</template>
