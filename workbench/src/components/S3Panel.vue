<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CollectorHttpError,
  CollectorUnreachableError,
  clearSession,
  fetchGraph,
  fetchReplay,
  fetchRequests,
  fetchSessions,
  type GraphNode,
  type RequestSummary,
  type SessionSummary,
} from "../api";
import { useS3Store, type S3Error, type S3Tab } from "../stores/s3";
import S4DetailPanel from "./S4DetailPanel.vue";
import FlowTreeNode from "./FlowTreeNode.vue";
import {
  compactNodeKey,
  confidenceBrief,
  controlNameFor,
  isGenericAutoService,
  isGenericNode,
  kindLabel,
  nodeKindLabel,
  nodeSqlSummary,
  repoSourcePath,
} from "../s4/labels";
import { S6_BANNER } from "../s6/canonical";
import { isStaticDemoMode, staticDemoCaseTraceId } from "../demo/static-demo";
import {
  beginDemoCase,
  demoBridge,
  setDemoResult,
} from "../demo/demo-bridge";

const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });

const s3 = useS3Store();
const staticDemoMode = isStaticDemoMode();

/** S4: selected graph node (detail drawer); selection is display-only. */
const selectedSpanId = ref<string | null>(null);
const autoSelectedTraceId = ref<string | null>(null);
const showBranches = ref(true);
const treeCanvas = ref<HTMLElement | null>(null);
const requestList = ref<HTMLElement | null>(null);
const clearing = ref(false);
const clearError = ref<string | null>(null);
/** Generic auto-scanned public methods are leaves most of the time; hide them on demand. */
const hideGenericLeaves = ref(false);

/** Low-frequency polling only while LIVE and visible — this is not realtime. */
const POLL_INTERVAL_MS = 5000;
/** UI clock for the case-B observe window; not a network poll. */
const CLOCK_INTERVAL_MS = 1000;
/** Slider drags are debounced before calling GET /replay (read-only). */
const REPLAY_DEBOUNCE_MS = 150;
const PLAY_INTERVAL_MS = 32;
const MAX_PLAY_FRAME_MS = 500;
const DEFAULT_OBSERVE_MS = 1500;
const MISSING = "未采集";
const THREW_STATUS = "THREW";
/** Demo case lookup: up to 12 silent refreshes, 400 ms apart (no polling). */
const DEMO_CASE_RETRY_COUNT = 12;
const DEMO_CASE_RETRY_INTERVAL_MS = 400;

const sessionDraft = ref(s3.sessionId);
const nowNs = ref(Date.now() * 1_000_000);

let pollTimer: number | null = null;
let clockTimer: number | null = null;
let replayTimer: number | null = null;
let playTimer: number | null = null;
let playAnchorMs = 0;
let replayRequestSeq = 0;
let graphRequestSeq = 0;

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
  let filtered: readonly RequestSummary[];
  if (tab === "requests") {
    filtered = list.filter((item) => item.fetchCount > 0);
  } else if (tab === "clicks") {
    // A "click" tab must be a frontend click root with zero fetch — a
    // backend-only LOST trace (fetchCount=0) is not a click.
    filtered = list.filter(
      (item) => item.fetchCount === 0 && item.rootKind === "ui_event"
    );
  } else {
    filtered = list;
  }
  // Newest first; traceId keeps equal timestamps deterministic.
  return [...filtered].sort(
    (a, b) => b.startedAtNs - a.startedAtNs || a.traceId.localeCompare(b.traceId)
  );
}

async function loadSessions(): Promise<void> {
  try {
    const sessions: SessionSummary[] = await fetchSessions();
    s3.setSessions(sessions);
  } catch {
    s3.setSessions([]);
  }
}

/** Keep the selected request visible when it is older than the newest rows. */
async function revealSelectedRequest(): Promise<void> {
  await nextTick();
  const list = requestList.value;
  if (list === null) {
    return;
  }
  const selected = list.querySelector<HTMLElement>(".s3-req--active");
  selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Keep the selected request's root as the visual anchor of the tree viewport. */
async function centerTreeRoot(): Promise<void> {
  await nextTick();
  const canvas = treeCanvas.value;
  const root = canvas?.querySelector<HTMLElement>(".s3-tree__root");
  if (!canvas || !root) {
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const delta =
    rootRect.left + rootRect.width / 2 - (canvasRect.left + canvasRect.width / 2);
  if (Math.abs(delta) > 1) {
    canvas.scrollLeft += delta;
  }
  canvas.scrollTop = 0;
}

/** After a graph lands, pin the slider to the full window and refresh replay. */
function onGraphChanged(): void {
  s3.setSlider(maxRel.value);
  if (s3.mode === "replay") {
    scheduleReplayLoad(true);
  }
  void centerTreeRoot();
}

async function loadGraphFor(traceId: string): Promise<void> {
  const seq = ++graphRequestSeq;
  s3.beginGraph();
  try {
    const graph = await fetchGraph(s3.sessionId, traceId);
    if (seq !== graphRequestSeq || traceId !== s3.selectedTraceId) {
      return;
    }
    s3.setGraph(graph);
    const root = findRootNode(graph.nodes);
    if (autoSelectedTraceId.value !== traceId) {
      autoSelectedTraceId.value = traceId;
      selectedSpanId.value = root?.spanId ?? null;
      showBranches.value = true;
    } else if (
      selectedSpanId.value !== null &&
      !graph.nodes.some((node) => node.spanId === selectedSpanId.value)
    ) {
      selectedSpanId.value = root?.spanId ?? null;
    }
    onGraphChanged();
  } catch (cause) {
    if (seq === graphRequestSeq && traceId === s3.selectedTraceId) {
      s3.failGraph(describeError(cause, "graph"));
    }
  }
}

/**
 * @param silent demo-case lookup: never auto-select the first request when
 * nothing is selected; an existing selection is kept and its graph reloaded.
 * Manual refresh and polling keep the original "select first" behaviour.
 */
async function refresh(silent = false): Promise<void> {
  if (s3.refreshing) {
    return;
  }
  // `?session=auto` may be opened before the app produced its first event: keep
  // retrying the session list until a newest session exists, then query it.
  if (s3.sessionAuto) {
    await loadSessions();
    const adopted = s3.adoptNewestSession();
    if (adopted !== null) {
      sessionDraft.value = adopted;
    }
  }
  s3.beginRefresh();
  try {
    const response = await fetchRequests(s3.sessionId);
    s3.setRequests(response.sessionId, response.sdkActive, response.requests);
    const filtered = filterRequests(response.requests, s3.tab);
    const previous = s3.selectedTraceId;
    const kept =
      previous !== null && filtered.some((item) => item.traceId === previous);
    const next = (kept || silent) ? previous : (filtered[0]?.traceId ?? null);
    if (next !== previous) {
      selectedSpanId.value = null;
    }
    if (next === null) {
      if (!silent) {
        s3.selectTrace(null);
        s3.clearGraph();
      }
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
  showBranches.value = true;
  void loadGraphFor(traceId);
  void revealSelectedRequest();
}

async function clearCurrentSession(): Promise<void> {
  if (staticDemoMode || clearing.value || s3.requests.length === 0) {
    return;
  }
  if (!window.confirm(`清空会话 ${s3.sessionId} 的本机记录？只删除 TraceBoard collector 内存，不影响业务数据库。`)) {
    return;
  }
  clearing.value = true;
  clearError.value = null;
  try {
    await clearSession(s3.sessionId);
    s3.setRequests(s3.sessionId, s3.sdkActive, []);
    s3.selectTrace(null);
    s3.clearGraph();
    selectedSpanId.value = null;
    await loadSessions();
  } catch (cause) {
    const error = describeError(cause, "requests");
    clearError.value = [error.message, error.hint].filter(Boolean).join(" — ");
  } finally {
    clearing.value = false;
  }
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

// ---------------------------------------------------------------------------
// Demo bridge: locate the trace captured for the clicked demo control
// ---------------------------------------------------------------------------

/** Guards against overlapping lookups; only the latest case may publish. */
let demoCaseSeq = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Highest startedAtNs already known for a nodeKey (baseline before the click). */
function demoBaselineNs(caseKey: string): number {
  let baseline = 0;
  for (const request of s3.requests) {
    if (request.nodeKey === caseKey && request.startedAtNs > baseline) {
      baseline = request.startedAtNs;
    }
  }
  return baseline;
}

/** Newest known request for the nodeKey that started after the baseline. */
function newestDemoRequest(
  caseKey: string,
  baselineNs: number
): RequestSummary | null {
  let newest: RequestSummary | null = null;
  for (const request of s3.requests) {
    if (request.nodeKey !== caseKey || request.startedAtNs <= baselineNs) {
      continue;
    }
    if (newest === null || request.startedAtNs > newest.startedAtNs) {
      newest = request;
    }
  }
  return newest;
}

function showDemoTrace(traceId: string): void {
  // Always show the "all" tab so the selected synthetic click/request is listed.
  s3.setTab("all");
  showBranches.value = true;
  selectRequest(traceId);
}

/**
 * Resolve a demo action to its trace.
 * - Static demo: traceId comes from demo-data `cases`, never invented.
 * - Live: bounded lookup (12 × 400 ms) of a silent refresh for a newer request
 *   with nodeKey === caseKey; on timeout report it instead of faking a trace.
 */
async function selectDemoCase(caseKey: string, atMs?: number): Promise<void> {
  const seq = ++demoCaseSeq;
  beginDemoCase(caseKey);

  if (staticDemoMode) {
    const traceId = staticDemoCaseTraceId(caseKey);
    if (traceId === null) {
      setDemoResult({
        caseKey,
        status: "error",
        static: true,
        message: "预置数据中没有该案例的链路（demo-data 的 cases 缺少该按钮）",
      });
      return;
    }
    showDemoTrace(traceId);
    setDemoResult({ caseKey, traceId, status: "resolved", static: true });
    return;
  }

  // The bridge timestamp prevents a stale same-button trace from winning when
  // the initial request list is empty or a session switch is still in flight.
  const actionNs =
    typeof atMs === "number" && Number.isFinite(atMs)
      ? Math.round(atMs * 1_000_000)
      : 0;
  const baselineNs = Math.max(
    demoBaselineNs(caseKey),
    actionNs > 0 ? actionNs - 2_000_000_000 : 0
  );
  for (let attempt = 0; attempt < DEMO_CASE_RETRY_COUNT; attempt += 1) {
    if (attempt > 0) {
      await sleep(DEMO_CASE_RETRY_INTERVAL_MS);
    }
    if (seq !== demoCaseSeq) {
      return;
    }
    await refresh(true);
    if (seq !== demoCaseSeq) {
      return;
    }
    const found = newestDemoRequest(caseKey, baselineNs);
    if (found !== null) {
      showDemoTrace(found.traceId);
      setDemoResult({
        caseKey,
        traceId: found.traceId,
        status: "resolved",
        static: false,
      });
      return;
    }
  }
  if (seq === demoCaseSeq) {
    setDemoResult({ caseKey, status: "timeout", static: false });
  }
}

const stopDemoWatch = watch(
  () => demoBridge.lastAction,
  (action) => {
    if (action !== null) {
      void selectDemoCase(action.caseKey, action.atMs);
    }
  }
);

const stopActiveWatch = watch(
  () => props.active,
  (active) => {
    if (active) {
      void revealSelectedRequest();
    }
    if (staticDemoMode) {
      return;
    }
    if (!active) {
      stopPolling();
      return;
    }
    void refresh();
    if (s3.mode === "live") {
      startPolling();
    }
  }
);

onBeforeUnmount(() => {
  stopDemoWatch();
  stopActiveWatch();
});

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
  // ?session=auto: adopt the newest session once the list is known. An explicit
  // ?session=s_xxx is already the store's initial session, so the first refresh
  // is guaranteed to query the session from the URL.
  await loadSessions();
  if (s3.sessionAuto) {
    const adopted = s3.adoptNewestSession();
    if (adopted !== null) {
      sessionDraft.value = adopted;
    }
  }
  await refresh();
  if (!staticDemoMode && props.active) {
    startPolling();
  }
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

function findRootNode(nodes: readonly GraphNode[]): GraphNode | null {
  return (
    nodes.find((node) => node.parentSpanId === null && node.kind === "ui_event") ??
    nodes.find((node) => node.parentSpanId === null) ??
    null
  );
}

const rootNode = computed<GraphNode | null>(() =>
  findRootNode(s3.graph?.nodes ?? [])
);

const startTitle = computed<string>(() => {
  const root = rootNode.value;
  if (root !== null) {
    if (root.kind === "ui_event") {
      return `页面点击 ${root.nodeKey}`;
    }
    if (root.kind === "fetch") {
      return `网络请求 ${root.nodeKey}`;
    }
    return `${nodeKindLabel(root)} ${compactNodeKey(root.kind, root.nodeKey)}`;
  }
  const request = selectedRequest.value;
  if (request === null) {
    return "尚未选择请求";
  }
  const kind = request.rootKind ?? "";
  const key = request.nodeKey ?? "";
  if (kind === "ui_event") {
    return `页面点击 ${key || "未采集"}`;
  }
  if (kind === "fetch") {
    return `网络请求 ${key || "未采集"}`;
  }
  return kind.length > 0 ? `${kindLabel(kind)} ${key || "未采集"}` : "起点未采集";
});

const startControlName = computed<string | null>(() => {
  const root = rootNode.value;
  if (root !== null) {
    return root.kind === "ui_event" ? controlNameFor(root.nodeKey) : null;
  }
  const request = selectedRequest.value;
  return request?.rootKind === "ui_event" ? controlNameFor(request.nodeKey) : null;
});

const startSource = computed<string | null>(() => {
  const source = rootNode.value?.source ?? null;
  if (source?.file) {
    return source.line === null ? source.file : `${source.file}:${source.line}`;
  }
  return null;
});

const backendEntrySource = computed<string | null>(() => {
  const controller = visibleNodes.value.find((node) => node.kind === "controller") ?? null;
  const source = controller?.source ?? null;
  if (source?.file) {
    return source.line === null ? source.file : `${source.file}:${source.line}`;
  }
  return null;
});

const startSourceFull = computed<string | null>(() =>
  rootNode.value === null ? null : repoSourcePath(rootNode.value)
);

const backendEntryFull = computed<string | null>(() => {
  const controller = visibleNodes.value.find((node) => node.kind === "controller") ?? null;
  return controller === null ? null : repoSourcePath(controller);
});

const startSourceKind = computed<string>(() => {
  const kind = rootNode.value?.kind ?? "";
  return kind === "ui_event" || kind === "fetch" || kind === "js_method" || kind === "render"
    ? "页面源码"
    : "后端入口";
});

const showBackendEntry = computed<boolean>(
  () => backendEntrySource.value !== null && backendEntrySource.value !== startSource.value
);

const startConfidence = computed<string>(() =>
  confidenceBrief(rootConfidence.value)
);

const sqlSummary = computed<string>(() => {
  if (s3.graphStatus === "error") {
    return "SQL 影响读取失败";
  }
  if (s3.graphStatus === "loading") {
    return "SQL 影响读取中";
  }
  const sql = visibleNodes.value.find((node) => node.kind === "sql") ?? null;
  if (sql === null) {
    const anySql = (s3.graph?.nodes ?? []).some((node) => node.kind === "sql");
    return anySql ? "SQL 影响尚未发生" : "SQL 影响未采集";
  }
  return nodeSqlSummary(sql);
});

const startMeta = computed<string>(() => {
  const request = selectedRequest.value;
  if (request === null) {
    return "";
  }
  return `${request.spanCount} 个节点 · 后端 ${request.backendSpanCount} 个 · ${request.fetchCount} 次请求`;
});

const NEXT_KIND_PREFS: Record<string, string[]> = {
  ui_event: ["fetch", "js_method", "render"],
  js_method: ["fetch", "render"],
  fetch: ["controller", "js_method"],
  controller: ["service"],
  service: ["mapper"],
  mapper: ["sql"],
};

/**
 * The short story line: start at the root and follow the first meaningful child.
 * Secondary fetches (for example the list refresh) stay in the full tree.
 */
function pickMainChild(parent: GraphNode, children: readonly GraphNode[]): GraphNode | null {
  const prefs = NEXT_KIND_PREFS[parent.kind] ?? [];
  for (const kind of prefs) {
    const candidates = children.filter((child) => child.kind === kind);
    if (candidates.length === 0) {
      continue;
    }
    if (kind === "fetch") {
      const write = candidates.find(
        (child) => !child.nodeKey.trim().toUpperCase().startsWith("GET ")
      );
      if (write !== undefined) {
        return write;
      }
    }
    return candidates[0];
  }
  return null;
}

const mainChain = computed<GraphNode[]>(() => {
  const root = rootNode.value;
  if (root === null) {
    return [];
  }
  const ids = new Set(visibleNodes.value.map((node) => node.spanId));
  if (!ids.has(root.spanId)) {
    return [];
  }
  const children = new Map<string, GraphNode[]>();
  for (const node of visibleNodes.value) {
    if (node.parentSpanId === null || !ids.has(node.parentSpanId)) {
      continue;
    }
    const list = children.get(node.parentSpanId) ?? [];
    list.push(node);
    children.set(node.parentSpanId, list);
  }
  for (const list of children.values()) {
    list.sort(sortNodes);
  }
  const chain: GraphNode[] = [root];
  const seen = new Set<string>([root.spanId]);
  while (chain.length < 8) {
    const current = chain[chain.length - 1];
    const next = pickMainChild(current, children.get(current.spanId) ?? []);
    if (next === null || seen.has(next.spanId)) {
      break;
    }
    chain.push(next);
    seen.add(next.spanId);
  }
  return chain;
});

const backendMethods = computed<GraphNode[]>(() =>
  mainChain.value.filter((node) =>
    node.kind === "controller" || node.kind === "service" || node.kind === "mapper"
  )
);

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
        "前端采集未接入（sdkActive=false）：会话中没有带采集标记的点击起点，不能推断“本次点击没发请求”。",
    };
  }
  const request = selectedRequest.value;
  if (request === null) {
    return {
      kind: "none",
      text: "暂无请求，不判定为“没发请求”",
      detail: "空态不是成功：没有点击起点或请求事实可判读。",
    };
  }
  if (s3.graphStatus === "error") {
    return {
      kind: "orphan",
      text: "无法确认：请求链路读取失败，不判定为“没发请求”",
      detail: "链路未加载时无法核对点击起点与观察窗；先修复读取错误。",
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
      text: "无法确认：没有读到点击起点，不判定为“没发请求”",
      detail: "需要点击起点与观察窗记录才能确认观察窗已关闭。",
    };
  }
  const rootKind = rootNode.value.kind || request.rootKind || "";
  if (rootKind !== "ui_event") {
    return {
      kind: "orphan",
      text: `游离请求（没有前端点击起点）· 关联方式 ${rootConfidence.value || MISSING}`,
      detail: "游离的后端请求不参与“没发请求”判定；未关联只表示前后端没有连上。",
    };
  }
  if (request.fetchCount > 0 && !request.hasBackend) {
    return {
      kind: "lost",
      text: "前端已发请求但后端未采集（LOST）",
      detail: `前端请求 ${request.fetchCount} 次；后端节点 ${request.backendSpanCount} 个；失败的请求节点会单独标记，不并入“没发”。`,
    };
  }
  if (rootConfidence.value !== "EXACT") {
    return {
      kind: "orphan",
      text: `起点关联方式为 ${confidenceBrief(rootConfidence.value)}，不满足“前后端已关联”，不判定为“没发请求”`,
      detail: "只有已关联的点击起点才能进入案例 B 判定。",
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
          `前端采集已接入；观察窗 ${observeMs.value} 毫秒已关闭；` +
          `网络请求 0 次；后端节点 0 个${earlyClosed ? "；观察窗提前关闭" : ""}。`,
      };
    }
    const elapsedMs = Math.max(0, elapsedNs / 1_000_000);
    const remainingMs = Math.max(0, (windowNs - elapsedNs) / 1_000_000);
    return {
      kind: "observing",
      text: "观察中…",
      detail: `观察窗 ${observeMs.value} 毫秒尚未关闭：已过 ${elapsedMs.toFixed(0)} 毫秒，剩余 ${remainingMs.toFixed(0)} 毫秒；关闭前不下结论。`,
    };
  }
  if (request.fetchCount === 0 && request.hasBackend) {
    return {
      kind: "partial",
      text: "存在后端节点但本次点击未采集到前端请求，不判定为“没发请求”",
      detail: `后端节点 ${request.backendSpanCount} 个；前端请求 0 次；需要检查前端采集。`,
    };
  }
  return {
    kind: "joined",
    text: "已关联：前端请求 ↔ 后端链路（EXACT），不写“没发请求”",
    detail: `前端请求 ${request.fetchCount} 次 · 后端节点 ${request.backendSpanCount} 个 · 关联方式 ${request.confidence}`,
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
  spanId: string;
  kind: string;
  label: string;
  nodeKey: string;
  relNs: number;
  pct: number;
}

const timelineTicks = computed<TimelineTick[]>(() => {
  const nodes = [...(s3.graph?.nodes ?? [])].sort(sortNodes);
  const max = maxRel.value;
  const base = minStartNs.value;
  return nodes.map((node) => {
    const relNs = Math.max(0, node.startNs - base);
    return {
      id: node.spanId,
      spanId: node.spanId,
      kind: node.kind,
      label: kindLabel(node.kind),
      nodeKey: node.nodeKey,
      relNs,
      pct: max <= 0 ? 0 : Math.min(100, (relNs / max) * 100),
    };
  });
});

/** Nodes inside the current live/replay window (before the optional generic-noise filter). */
const windowNodes = computed<GraphNode[]>(() => {
  const nodes = s3.graph?.nodes ?? [];
  if (s3.mode !== "replay") {
    return nodes;
  }
  return nodes.filter((node) => node.startNs <= cutoffNs.value);
});

/** Leaf `GENERIC_AUTO` service spans: auto-scanned public methods that add little to the story. */
const genericLeafCount = computed<number>(() => {
  const nodes = windowNodes.value;
  const childIds = new Set<string>();
  for (const node of nodes) {
    if (node.parentSpanId !== null) {
      childIds.add(node.parentSpanId);
    }
  }
  return nodes.filter(
    (node) => isGenericAutoService(node) && !childIds.has(node.spanId)
  ).length;
});

const visibleNodes = computed<GraphNode[]>(() => {
  const nodes = windowNodes.value;
  if (!hideGenericLeaves.value) {
    return nodes;
  }
  const childIds = new Set<string>();
  for (const node of nodes) {
    if (node.parentSpanId !== null) {
      childIds.add(node.parentSpanId);
    }
  }
  return nodes.filter(
    (node) => !(isGenericAutoService(node) && !childIds.has(node.spanId))
  );
});

const hiddenNodes = computed<GraphNode[]>(() => {
  if (s3.mode !== "replay") {
    return [];
  }
  return (s3.graph?.nodes ?? []).filter((node) => node.startNs > cutoffNs.value);
});

function sortNodes(a: GraphNode, b: GraphNode): number {
  if (a.startNs !== b.startNs) {
    return a.startNs - b.startNs;
  }
  return a.spanId.localeCompare(b.spanId);
}

const mainNodeIds = computed<Set<string>>(
  () => new Set(mainChain.value.map((node) => node.spanId))
);

function isMainNode(spanId: string): boolean {
  return mainNodeIds.value.has(spanId);
}


const treeNodes = computed<GraphNode[]>(() =>
  showBranches.value
    ? visibleNodes.value
    : visibleNodes.value.filter((node) => isMainNode(node.spanId))
);

const treeChildrenByParent = computed<Map<string, GraphNode[]>>(() => {
  const map = new Map<string, GraphNode[]>();
  const ids = new Set(treeNodes.value.map((node) => node.spanId));
  for (const node of treeNodes.value) {
    if (node.parentSpanId === null || !ids.has(node.parentSpanId)) {
      continue;
    }
    const list = map.get(node.parentSpanId) ?? [];
    list.push(node);
    map.set(node.parentSpanId, list);
  }
  for (const list of map.values()) {
    list.sort(sortNodes);
  }
  return map;
});

const treeRoots = computed<GraphNode[]>(() => {
  const childIds = new Set<string>();
  for (const list of treeChildrenByParent.value.values()) {
    for (const child of list) {
      childIds.add(child.spanId);
    }
  }
  return treeNodes.value.filter((node) => !childIds.has(node.spanId)).sort(sortNodes);
});

const mainSteps = computed<Map<string, number>>(
  () => new Map(mainChain.value.map((node, index) => [node.spanId, index + 1]))
);

const branchCount = computed<number>(() =>
  visibleNodes.value.filter((node) => !isMainNode(node.spanId)).length
);

/** Generic sessions must not show the demo-only S6 / NoDebugService capability banner. */
const hasGenericNodes = computed<boolean>(() =>
  (s3.graph?.nodes ?? []).some(isGenericNode)
);

function toggleBranches(): void {
  if (
    showBranches.value &&
    selectedSpanId.value !== null &&
    !isMainNode(selectedSpanId.value)
  ) {
    selectedSpanId.value = rootNode.value?.spanId ?? null;
  }
  showBranches.value = !showBranches.value;
}

// ---------------------------------------------------------------------------
// S4: selected node, ×N grouping (display only) and detail drawer
// ---------------------------------------------------------------------------

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
    return "实时：显示全部已存事件；切到回放后可拖动滑块查看历史时刻。";
  }
  if (s3.replayStatus === "loading") {
    return "正在读取回放窗口…";
  }
  const replay = s3.replay;
  if (replay === null) {
    return "回放：等待回放窗口…（本地过滤仍只读）";
  }
  return (
    `回放窗口：${replay.events.length} 个事件（当前链路 ${replayTraceEventCount.value} 个）· ` +
    `只读=${replay.readOnly ? "是" : "否"}`
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
  if (!staticDemoMode && props.active) {
    startPolling();
  }
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

function jumpToTick(tick: TimelineTick): void {
  if (s3.mode === "live") {
    stopPolling();
    s3.setMode("replay");
  }
  s3.setPlaying(false);
  stopPlayTimer();
  s3.setSlider(Math.min(Math.max(tick.relNs, 0), maxRel.value));
  scheduleReplayLoad(true);
  selectedSpanId.value = tick.spanId;
  if (!isMainNode(tick.spanId)) {
    showBranches.value = true;
  }
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
  playAnchorMs = performance.now();
  playTimer = window.setInterval(() => {
    if (!s3.playing || s3.mode !== "replay") {
      stopPlayTimer();
      return;
    }
    const nowMs = performance.now();
    const elapsedMs = Math.min(
      MAX_PLAY_FRAME_MS,
      Math.max(0, nowMs - playAnchorMs)
    );
    playAnchorMs = nowMs;
    const stepNs = Math.round(elapsedMs * 1_000_000 * s3.speed);
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
    return "缺少调试信息（该方法的 class 没有 LocalVariableTable；只证明调用与返回值，不猜变量名/行号）";
  }
  return "该事实未采集（原因未提供；检查采集开关与连接）";
}

function statusMeta(status: string): StatusMeta {
  if (status === "OK") {
    return { tone: "ok", label: "正常", hint: null, reason: null, lock: false };
  }
  if (status === "RETURNED_FALSE") {
    return {
      tone: "false",
      label: "正常返回 false",
      hint: "正常返回 false",
      reason: null,
      lock: false,
    };
  }
  if (status === THREW_STATUS) {
    return { tone: "threw", label: "抛出异常", hint: "异常/断线", reason: null, lock: false };
  }
  if (status.startsWith("NOT_COLLECTED")) {
    return {
      tone: "notcollected",
      label: "未采集",
      hint: "未采集",
      reason: notCollectedReason(status),
      lock: false,
    };
  }
  if (status === "TRUNCATED") {
    return {
      tone: "truncated",
      label: "已截断/已折叠",
      hint: "已截断/已折叠",
      reason: null,
      lock: false,
    };
  }
  if (status === "REDACTED") {
    return {
      tone: "redacted",
      label: "已脱敏",
      hint: "已脱敏",
      reason: null,
      lock: true,
    };
  }
  if (status === "UNKNOWN") {
    return { tone: "unknown", label: "未知", hint: "未知", reason: null, lock: false };
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
    reason: "如 NOT_COLLECTED_NO_DEBUG_INFO → 该方法的 class 没有 LocalVariableTable（灰色状态 + reason，未采集不是成功）",
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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function requestTime(ns: number): string {
  if (!Number.isFinite(ns) || ns <= 0) {
    return "时间未采集";
  }
  const date = new Date(Math.round(ns / 1_000_000));
  if (Number.isNaN(date.getTime())) {
    return "时间未采集";
  }
  return (
    `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  );
}

function requestTimeTitle(ns: number): string {
  if (!Number.isFinite(ns) || ns <= 0) {
    return "开始时间未采集";
  }
  const date = new Date(Math.round(ns / 1_000_000));
  return Number.isNaN(date.getTime()) ? "开始时间未采集" : date.toLocaleString("zh-CN");
}

function requestControlName(request: RequestSummary): string | null {
  return request.rootKind === "ui_event" ? controlNameFor(request.nodeKey) : null;
}

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
  const kind = request.rootKind ?? "";
  const key = request.nodeKey ?? "";
  if (kind === "ui_event") {
    return `页面点击 ${key || "未采集"}`;
  }
  if (kind === "fetch") {
    return `网络请求 ${key || "未采集"}`;
  }
  if (kind.length === 0) {
    return "起点未采集";
  }
  return `${kindLabel(kind)} ${key || "未采集"}`;
}


</script>

<template>
  <section id="s3-panel" class="s3-panel" aria-labelledby="s3-panel-title">
    <header class="s3-panel__header">
      <div>
        <h2 id="s3-panel-title" class="s3-panel__title">
          请求追踪台
        </h2>
        <p class="s3-panel__note">
          从一次页面点击开始，沿请求、控制器、服务、数据访问和 SQL 查看结果；支持只读回放，非实时。
        </p>
      </div>
      <span class="s3-panel__badge">只读事实 · 点击查看详情</span>
    </header>

    <div class="s3-controls">
      <label class="s3-controls__label" for="s3-session">会话编号</label>
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
        @click="refresh()"
      >
        {{ s3.refreshing ? "刷新中…" : "刷新" }}
      </button>
      <button
        id="s3-clear"
        type="button"
        class="s3-controls__button s3-controls__button--danger"
        :disabled="staticDemoMode || clearing || s3.requests.length === 0"
        :title="staticDemoMode ? '静态快照为预置数据，刷新页面恢复' : '只删除本机 collector 内存记录，不影响业务数据库'"
        @click="clearCurrentSession"
      >
        {{ clearing ? "清空中…" : "清空记录" }}
      </button>
      <span class="s3-controls__hint">
        {{ s3.sessionAuto ? "自动选择最新会话" : s3.sessionFromUrl ? "会话来自启动链接 ?session=" : s3.sessionId !== "s_s3demo" ? "已自动选择最新会话" : "默认会话 s_s3demo" }}
        · 输入后回车切换 ·
        {{ staticDemoMode ? "静态快照 · 不自动请求" : "每 5 秒刷新（非实时）" }}
      </span>
    </div>
    <p class="s3-controls__status">
      当前会话 <code>{{ s3.sessionId }}</code>
      <span class="s3-chip" :class="s3.sdkActive ? 's3-chip--on' : 's3-chip--off'">
        前端采集（sdkActive）{{ s3.sdkActive ? "已接入" : "未接入" }}
      </span>
      <span v-if="s3.lastRefreshedAt"> · 最近刷新 {{ s3.lastRefreshedAt }}</span>
      <span v-else> · 尚未刷新</span>
    </p>
    <p v-if="clearError" class="s3-banner s3-banner--error" role="alert">
      清空失败：{{ clearError }}
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
        含请求 <span class="s3-tab__count">{{ tabCounts.requests }}</span>
      </button>
      <button
        type="button"
        role="tab"
        class="s3-tab"
        :class="{ 's3-tab--active': s3.tab === 'clicks' }"
        :aria-selected="s3.tab === 'clicks'"
        @click="selectTab('clicks')"
      >
        纯点击 <span class="s3-tab__count">{{ tabCounts.clicks }}</span>
      </button>
    </div>

    <section
      v-if="selectedRequest !== null"
      id="s3-start"
      class="s3-start"
      aria-labelledby="s3-start-title"
    >
      <div class="s3-start__badge" aria-hidden="true">起点</div>
      <div class="s3-start__body">
        <p class="s3-start__eyebrow">这次请求从哪开始</p>
        <h3 id="s3-start-title" class="s3-start__title">
          {{ startTitle }}
          <span v-if="startControlName" class="s3-start__control-name">控件：{{ startControlName }}</span>
        </h3>
        <p v-if="backendMethods.length > 0" class="s3-start__methods">
          后端方法：
          <template v-for="(node, index) in backendMethods" :key="node.spanId">
            <span
              class="s3-start__method"
              :title="repoSourcePath(node) ?? node.nodeKey"
            >{{ compactNodeKey(node.kind, node.nodeKey) }}</span>
            <span v-if="index < backendMethods.length - 1" class="s3-start__method-arrow">→</span>
          </template>
        </p>
        <p class="s3-start__source">
          <template v-if="startSource !== null">
            {{ startSourceKind }}：<code :title="startSourceFull ?? startSource ?? undefined">{{ startSource }}</code>
            <span class="s3-start__dot">·</span>
          </template>
          <template v-else>
            {{ startSourceKind }}未采集
            <span class="s3-start__dot">·</span>
          </template>
          <template v-if="showBackendEntry">
            后端入口：<code :title="backendEntryFull ?? backendEntrySource ?? undefined">{{ backendEntrySource }}</code>
            <span class="s3-start__dot">·</span>
          </template>
          {{ startConfidence }}
          <span class="s3-start__dot">·</span>
          {{ startMeta }}
          <span class="s3-start__dot">·</span>
          {{ sqlSummary }}
        </p>
        <ol v-if="mainChain.length > 0" class="s3-start__chain" aria-label="主要调用路径">
          <li
            v-for="(step, index) in mainChain"
            :key="step.spanId"
            class="s3-start__step"
            :class="{ 's3-start__step--root': index === 0 }"
          >
            <span class="s3-start__step-no">{{ index + 1 }}</span>
            <span class="s3-start__step-kind">{{ nodeKindLabel(step) }}</span>
            <code
              class="s3-start__step-key"
              :title="repoSourcePath(step) ?? undefined"
            >{{ compactNodeKey(step.kind, step.nodeKey) }}</code>
          </li>
        </ol>
        <p v-else-if="s3.graphStatus === 'error'" class="s3-start__loading">
          请求链路读取失败，暂时无法显示调用路径。
        </p>
        <p v-else-if="s3.graphStatus === 'loading'" class="s3-start__loading">
          正在读取调用路径…
        </p>
        <p v-else class="s3-start__loading">该请求只有起点，没有已采集的后续调用。</p>
      </div>
    </section>

    <div class="s3-body">
      <section class="s3-ops-wrap" aria-labelledby="s3-ops-title">
        <h3 id="s3-ops-title" class="s3-subtitle">最近请求</h3>
        <div id="s3-ops" ref="requestList" class="s3-ops" role="tablist" aria-label="请求切换">
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
            <span class="s3-req__root">{{ rootLabel(request) }}</span>
            <span class="s3-req__meta">
              <span>{{ request.spanCount }} 个节点</span>
              <span>后端 {{ request.backendSpanCount }} 个</span>
              <span>{{ request.fetchCount }} 次请求</span>
              <span v-if="requestControlName(request)">控件 {{ requestControlName(request) }}</span>
              <span v-if="request.confidence !== 'EXACT'">关联：{{ confidenceBrief(request.confidence) }}</span>
              <span v-if="request.hasError" class="s3-req__error">含异常</span>
            </span>
            <span class="s3-req__time" :title="requestTimeTitle(request.startedAtNs)">
              {{ requestTime(request.startedAtNs) }} · 耗时 {{ formatNs(request.durNs) }}
            </span>
            <span class="s3-req__line">
              <code class="s3-req__trace">链路 {{ shortTrace(request.traceId) }}</code>
              <span class="s3-status" :class="statusClass(request.status)">
                <span v-if="statusLock(request.status)" class="s3-lock" aria-hidden="true"></span>
                {{ statusMeta(request.status).label }}
              </span>
              <span v-if="statusHint(request.status) && statusHint(request.status) !== statusMeta(request.status).label" class="s3-req__hint">
                {{ statusHint(request.status) }}
              </span>
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
          请求流程树 <span class="s3-subtitle__hint">矩形节点按父子层级展开，点击节点查看右侧详情</span>
        </h3>

        <div
          v-if="caseB.kind !== 'joined'"
          id="s3-caseb"
          class="s3-caseb"
          :class="`s3-caseb--${caseB.kind}`"
        >
          <span class="s3-caseb__label">本次判定</span>
          <strong class="s3-caseb__text">{{ caseB.text }}</strong>
          <p v-if="caseB.detail" class="s3-caseb__detail">{{ caseB.detail }}</p>
        </div>

        <p v-if="selectedRequest === null" class="s3-state">
          空态：尚未选中请求（请求列表为空时不会自动选中）；不判定为“没发请求”。
        </p>

        <template v-if="selectedRequest !== null">
          <p class="s3-chain__meta">
            链路 <code>{{ shortTrace(selectedRequest.traceId) }}</code>
            · {{ s3.graph?.nodes.length ?? 0 }} 个节点 / {{ s3.graph?.edges.length ?? 0 }} 条连线
            <span v-if="rootConfidence === 'LOST'" class="s3-chain__lost">
              前端与后端未关联；这是关联状态，不是执行状态。
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
            <div v-if="s3.mode === 'replay' && hiddenNodes.length > 0" class="s3-tree__future">
              <p>尚未发生：回放点之后还有 {{ hiddenNodes.length }} 个事件，当前已隐藏。</p>
              <details>
                <summary>查看被隐藏的事件</summary>
                <ul>
                  <li v-for="node in hiddenNodes" :key="node.spanId">
                    {{ kindLabel(node.kind) }} · {{ compactNodeKey(node.kind, node.nodeKey) }}
                  </li>
                </ul>
              </details>
            </div>

            <div class="s3-tree__viewbar">
              <span>
                树形链路 · 主链 {{ mainChain.length }} 步
                <template v-if="branchCount > 0"> · {{ branchCount }} 个旁支/叶子节点</template>
              </span>
              <span class="s3-tree__viewbar-actions">
                <label
                  v-if="genericLeafCount > 0"
                  class="s3-tree__generic-filter"
                  title="隐藏自动扫包产生的叶子业务方法（GENERIC_AUTO），保留主链与有子节点的方法"
                >
                  <input v-model="hideGenericLeaves" type="checkbox" />
                  隐藏通用插桩叶子（{{ genericLeafCount }}）
                </label>
                <button
                  v-if="branchCount > 0"
                  type="button"
                  class="s3-tree__branch-toggle"
                  :aria-pressed="showBranches"
                  @click="toggleBranches"
                >
                  {{ showBranches ? "只看主链" : `显示全部旁支（${branchCount}）` }}
                </button>
              </span>
            </div>

            <div
              v-if="treeNodes.length > 0"
              ref="treeCanvas"
              class="s3-tree__canvas"
              aria-label="请求流程树"
            >
              <div
                v-for="root in treeRoots"
                :key="root.spanId"
                class="s3-tree__root"
              >
                <FlowTreeNode
                  :node="root"
                  :children-by-parent="treeChildrenByParent"
                  :selected-span-id="selectedSpanId"
                  :main-steps="mainSteps"
                  @select="selectSpan"
                />
              </div>
            </div>
            <p v-else-if="visibleNodes.length > 0" class="s3-state">
              当前没有可显示的节点；点击“显示全部旁支”查看。
            </p>
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

        <details class="s3-legend">
          <summary class="s3-legend__summary">状态与关联说明（点击展开）</summary>
          <p class="s3-legend__note">
            技术字段仍保留原始名称（fetchCount / spanCount / backendSpanCount / sdkActive），
            界面主文案用中文解释。JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）
          </p>
          <p class="s3-legend__title">原始状态码对照（颜色 + 文字，不靠颜色单独传达）</p>
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
          <p class="s3-legend__title">关联方式（不是执行状态）</p>
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
        </details>
      </section>
    </div>

    <section id="s3-timeline" class="s3-timeline" aria-labelledby="s3-timeline-title">
      <div class="s3-timeline__header">
        <h3 id="s3-timeline-title" class="s3-subtitle">
          时间轴（相对时间）
        </h3>
        <div id="s3-replay-toggle" class="s3-mode" role="group" aria-label="实时/回放切换">
          <button
            type="button"
            class="s3-mode__button"
            :class="{ 's3-mode__button--active': s3.mode === 'live' }"
            :aria-pressed="s3.mode === 'live'"
            @click="enterLive"
          >
            实时
          </button>
          <button
            type="button"
            class="s3-mode__button"
            :class="{ 's3-mode__button--active': s3.mode === 'replay' }"
            :aria-pressed="s3.mode === 'replay'"
            @click="enterReplay"
          >
            回放
          </button>
        </div>
        <span id="s3-readonly" class="s3-readonly">只读追踪；清空仅删本机 collector 内存记录</span>
      </div>

      <template v-if="s3.graph !== null">
        <div class="s3-timeline__labels">
          <span>0（相对时间）</span>
          <span class="s3-timeline__now">当前时刻 = {{ formatNs(effectiveSliderNs) }}</span>
          <span>{{ formatNs(maxRel) }}</span>
        </div>
        <div class="s3-timeline__track" role="group" aria-label="节点关键帧">
          <button
            v-for="tick in timelineTicks"
            :key="tick.id"
            type="button"
            class="s3-tick"
            :class="`s3-tick--${tick.kind}`"
            :style="{ left: `${tick.pct}%` }"
            :title="`跳到 ${tick.label} · ${tick.nodeKey}（相对时间 ${formatNs(tick.relNs)}）`"
            :aria-label="`跳到 ${tick.label} ${tick.nodeKey} 开始时刻`"
            @click="jumpToTick(tick)"
          ></button>
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
          aria-label="回放时间轴（相对时间）"
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
            <select :value="s3.speed" title="毫秒级链路建议 0.001×–0.01×" @change="onSpeedChange">
              <optgroup label="超慢放">
                <option :value="0.0001">0.0001×（极慢）</option>
                <option :value="0.001">0.001×</option>
                <option :value="0.005">0.005×</option>
                <option :value="0.01">0.01×（默认）</option>
                <option :value="0.05">0.05×</option>
              </optgroup>
              <optgroup label="常规">
                <option :value="0.1">0.1×</option>
                <option :value="0.5">0.5×</option>
                <option :value="1">1×（实时）</option>
                <option :value="2">2×</option>
                <option :value="4">4×</option>
              </optgroup>
            </select>
          </label>
          <span class="s3-timeline__speed-hint">毫秒级建议 0.001×–0.01×</span>
          <span class="s3-timeline__mode">
            {{ s3.mode === "live" ? "实时：显示全部已存事件（切到回放才能拖动）" : "回放：只读窗口；未来事件隐藏/未发生" }}
          </span>
        </div>
        <p class="s3-timeline__window">{{ replayWindowText }}</p>
        <p class="s3-timeline__hint">
          关键帧：每个节点一个；点击轨道标记或下方文字，直接跳到该节点出现的时刻并选中它。
        </p>
        <ul class="s3-ticks">
          <li v-for="tick in timelineTicks" :key="`list-${tick.id}`">
            <button
              type="button"
              class="s3-tick-row"
              :class="`s3-tick-row--${tick.kind}`"
              :title="`跳到 ${tick.label} · ${tick.nodeKey}（相对时间 ${formatNs(tick.relNs)}）`"
              @click="jumpToTick(tick)"
            >
              <span class="s3-tick-row__dot" aria-hidden="true"></span>
              {{ tick.label }} · {{ tick.nodeKey }} · 相对时间 {{ formatNs(tick.relNs) }}
            </button>
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

    <details class="s3-help">
      <summary class="s3-help__summary">说明与边界</summary>
      <p class="s3-panel__footnote">
        本板不会重发请求、不写业务数据库、不调用 demo、不执行程序；回放只读。
        “清空记录”只删除本机 collector 内存中的当前会话事件，不影响业务数据库，也不能撤销。
        时间轴按所选链路的相对时间显示，接口参数仍是原始时间戳。
        节点详情、×N 分组和缺口清单均为已采集数据的只读派生，不推断业务对错。
      </p>
      <p v-if="!hasGenericNodes" class="s3-panel__footnote">{{ S6_BANNER }}</p>
      <p v-if="hasGenericNodes" class="s3-panel__footnote">
        通用插桩模式：采集应用主包 public 方法、MyBatis Mapper 与 SQL；行级局部变量（L2）与
        demo 专项探针不适用于用户项目。
      </p>
    </details>
  </section>
</template>
