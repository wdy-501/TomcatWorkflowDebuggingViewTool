<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  CollectorHttpError,
  CollectorUnreachableError,
  fetchGraph,
  fetchRequests,
  fetchSessions,
  type GraphNode,
  type RequestSummary,
  type SideEffectItem,
} from "../api";
import { useS2Store, type S2Error } from "../stores/s2";

const s2 = useS2Store();

/** Low-frequency polling only (non-realtime). Manual refresh is always available. */
const POLL_INTERVAL_MS = 5000;
const THREW_STATUS = "THREW";
const MISSING = "未采集";

const sessionDraft = ref(s2.sessionId);
let pollTimer: number | null = null;

function describeError(cause: unknown, scope: "requests" | "graph"): S2Error {
  if (cause instanceof CollectorUnreachableError) {
    return {
      message: "collector 不可达：http://127.0.0.1:8601",
      hint: "请先启动 collector（仅监听 127.0.0.1:8601）；本面板只做只读查询。",
    };
  }
  if (cause instanceof CollectorHttpError) {
    const hint =
      cause.status === 404
        ? scope === "requests"
          ? "该会话尚未接收任何事件（404）。"
          : "当前会话中不存在该 traceId（404）。"
        : cause.status === 400
          ? "traceId 参数非法（400）。"
          : null;
    return {
      message: `collector 返回 HTTP ${cause.status}：${cause.message}`,
      hint,
    };
  }
  return {
    message: cause instanceof Error ? cause.message : String(cause),
    hint: null,
  };
}

async function loadSessions(): Promise<void> {
  // Best-effort only: the list feeds the datalist, the session input stays usable
  // when the collector is down (an error banner is already shown by refresh()).
  try {
    s2.setSessions(await fetchSessions());
  } catch {
    s2.setSessions([]);
  }
}

async function loadGraphFor(traceId: string): Promise<void> {
  s2.beginGraph();
  try {
    const graph = await fetchGraph(s2.sessionId, traceId);
    s2.setGraph(graph);
  } catch (cause) {
    s2.failGraph(describeError(cause, "graph"));
  }
}

/**
 * One read pass: requests -> keep or pick a selection -> graph for it.
 * Events may arrive in any order (method exit order != startNs order), so the
 * selection is re-derived from the returned list every time, never from a
 * cached index.
 */
async function refresh(): Promise<void> {
  if (s2.refreshing) {
    return;
  }
  s2.beginRefresh();
  try {
    const response = await fetchRequests(s2.sessionId);
    s2.setRequests(response.requests);
    const previous = s2.selectedTraceId;
    const kept =
      previous !== null && response.requests.some((item) => item.traceId === previous);
    const next = kept ? previous : (response.requests[0]?.traceId ?? null);
    if (next === null) {
      s2.selectTrace(null);
      s2.clearGraph();
    } else {
      s2.selectTrace(next);
      await loadGraphFor(next);
    }
  } catch (cause) {
    s2.failRequests(describeError(cause, "requests"));
  } finally {
    s2.finishRefresh();
  }
}

function applySession(): void {
  const next = sessionDraft.value.trim();
  if (next.length === 0) {
    sessionDraft.value = s2.sessionId;
    return;
  }
  if (next === s2.sessionId) {
    return;
  }
  s2.setSession(next);
  sessionDraft.value = next;
  void refresh();
}

function selectRequest(traceId: string): void {
  if (traceId === s2.selectedTraceId && s2.graph !== null) {
    return;
  }
  s2.selectTrace(traceId);
  void loadGraphFor(traceId);
}

function pageVisible(): boolean {
  return document.visibilityState === "visible";
}

onMounted(async () => {
  void loadSessions();
  await refresh();
  pollTimer = window.setInterval(() => {
    // Poll only while the page is visible; this is a low-frequency refresh,
    // not a realtime subscription.
    if (pageVisible()) {
      void refresh();
    }
  }, POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
});

const selectedRequest = computed<RequestSummary | null>(() => {
  const traceId = s2.selectedTraceId;
  if (traceId === null) {
    return null;
  }
  return s2.requests.find((item) => item.traceId === traceId) ?? null;
});

const isLost = computed(() => {
  const confidence = s2.graph?.confidence ?? selectedRequest.value?.confidence ?? "";
  return confidence === "LOST";
});

interface ValueText {
  value: string;
  missing: boolean;
}

interface FactRow extends ValueText {
  id: string;
  label: string;
}

function firstNode(nodes: readonly GraphNode[], kind: string): GraphNode | null {
  return nodes.find((node) => node.kind === kind) ?? null;
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

/** A null return means "not collected", never 0 (dispatch §4.6). */
function returnText(node: GraphNode | null): ValueText {
  if (node === null) {
    return { value: MISSING, missing: true };
  }
  if (node.return === null) {
    return { value: `${MISSING}（无返回摘要）`, missing: true };
  }
  if (node.return.value === undefined) {
    return { value: `${MISSING}（无返回值）`, missing: true };
  }
  return { value: formatValue(node.return.value), missing: false };
}

function sqlRowsText(nodes: readonly GraphNode[]): ValueText {
  const sqlNodes = nodes.filter((node) => node.kind === "sql");
  if (sqlNodes.length === 0) {
    return { value: MISSING, missing: true };
  }
  let total = 0;
  let collected = 0;
  for (const node of sqlNodes) {
    for (const effect of node.sideEffects) {
      if (effect.rowsAffected !== null) {
        total += effect.rowsAffected;
        collected += 1;
      }
    }
  }
  if (collected === 0) {
    // sideEffects missing/falsey: show 未采集, never substitute 0 rows.
    return { value: MISSING, missing: true };
  }
  return { value: `${total} 行`, missing: false };
}

function threwText(nodes: readonly GraphNode[]): ValueText {
  if (nodes.length === 0) {
    return { value: MISSING, missing: true };
  }
  const threw = nodes.filter((node) => node.status === THREW_STATUS).length;
  return { value: String(threw), missing: false };
}

/** Neutral facts computed from the selected chain; no defect verdict. */
const facts = computed<FactRow[]>(() => {
  const nodes = s2.graph?.nodes ?? [];
  return [
    { id: "controller", label: "Controller HTTP", ...returnText(firstNode(nodes, "controller")) },
    { id: "service", label: "Service 返回", ...returnText(firstNode(nodes, "service")) },
    { id: "mapper", label: "Mapper 返回", ...returnText(firstNode(nodes, "mapper")) },
    { id: "sql", label: "SQL 影响", ...sqlRowsText(nodes) },
    { id: "threw", label: "异常（THREW）", ...threwText(nodes) },
  ];
});

interface ChainRow {
  node: GraphNode;
  depth: number;
  orphan: boolean;
}

/** Nodes arrive sorted by startNs; depth comes from parentSpanId/edges only. */
const chainRows = computed<ChainRow[]>(() => {
  const graph = s2.graph;
  if (graph === null) {
    return [];
  }
  const byId = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    byId.set(node.spanId, node);
  }
  return graph.nodes.map((node) => {
    const orphan = node.parentSpanId !== null && !byId.has(node.parentSpanId);
    let depth = 0;
    let parentId = node.parentSpanId;
    const visited = new Set<string>([node.spanId]);
    while (
      parentId !== null &&
      byId.has(parentId) &&
      !visited.has(parentId) &&
      depth < 16
    ) {
      visited.add(parentId);
      depth += 1;
      parentId = byId.get(parentId)?.parentSpanId ?? null;
    }
    return { node, depth: orphan ? 0 : depth, orphan };
  });
});

function shortTrace(traceId: string): string {
  if (traceId.length === 0) {
    return "—";
  }
  return traceId.length > 8 ? `${traceId.slice(0, 8)}…` : traceId;
}

function rootLabel(request: RequestSummary): string {
  return request.nodeKey ?? "无根（未采集）";
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
  return `${(ns / 1_000_000).toFixed(2)} ms`;
}

function statusClass(status: string): string {
  // Only THREW uses the exception style; OK with 0/false stays neutral.
  return status === THREW_STATUS ? "s2-status--threw" : "s2-status--neutral";
}

function nodeReturnText(node: GraphNode): string {
  if (node.return === null) {
    return `${MISSING}（无返回摘要）`;
  }
  if (node.return.value === undefined) {
    return `${MISSING}（无返回值）`;
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
</script>

<template>
  <section id="s2-panel" class="s2-panel" aria-labelledby="s2-panel-title">
    <header class="s2-panel__header">
      <div>
        <h2 id="s2-panel-title" class="s2-panel__title">
          S2 · 0 行事实链（真实 cancel 请求 · 只读派生）
        </h2>
        <p class="s2-panel__note">
          一次 cancel 的后端事实链：controller → service → mapper → SQL，按 startNs 排列；
          数据来自 collector 的 requests / graph 只读查询，不由 fixture 伪造 0 行。
        </p>
      </div>
      <span class="s2-panel__badge">S2 · GET requests / graph</span>
    </header>

    <div class="s2-controls">
      <label class="s2-controls__label" for="s2-session">会话 sessionId</label>
      <input
        id="s2-session"
        v-model="sessionDraft"
        class="s2-controls__input"
        list="s2-session-options"
        spellcheck="false"
        autocomplete="off"
        @change="applySession"
        @keyup.enter="applySession"
      />
      <datalist id="s2-session-options">
        <option v-for="session in s2.sessions" :key="session.sessionId" :value="session.sessionId">
          {{ session.eventCount }} 条事件
        </option>
      </datalist>
      <button
        id="s2-refresh"
        type="button"
        class="s2-controls__button"
        :disabled="s2.refreshing"
        @click="refresh"
      >
        {{ s2.refreshing ? "刷新中…" : "刷新" }}
      </button>
      <span class="s2-controls__hint">
        默认 s_s2agent · 输入会话 id 后回车切换 · 每 5 秒刷新（非实时）
      </span>
    </div>
    <p class="s2-controls__status">
      当前会话 <code>{{ s2.sessionId }}</code>
      <span v-if="s2.lastRefreshedAt"> · 最近刷新 {{ s2.lastRefreshedAt }}</span>
      <span v-else> · 尚未刷新</span>
    </p>

    <p v-if="s2.requestsError" class="s2-banner s2-banner--error" role="alert">
      {{ s2.requestsError.message }}
      <span v-if="s2.requestsError.hint"> — {{ s2.requestsError.hint }}</span>
    </p>
    <p v-if="s2.graphError" class="s2-banner s2-banner--error" role="alert">
      {{ s2.graphError.message }}
      <span v-if="s2.graphError.hint"> — {{ s2.graphError.hint }}</span>
    </p>
    <p v-if="s2.requestsError && s2.requests.length > 0" class="s2-banner s2-banner--stale">
      下列请求列表来自上一次成功读取，可能已过期。
    </p>

    <div class="s2-body">
      <section class="s2-requests" aria-labelledby="s2-requests-title">
        <h3 id="s2-requests-title" class="s2-subtitle">请求列表（requests · 点选切换）</h3>
        <div id="s2-requests" class="s2-requests__list" role="tablist" aria-label="请求切换">
          <button
            v-for="request in s2.requests"
            :key="request.traceId"
            type="button"
            role="tab"
            class="s2-req"
            :class="{ 's2-req--active': request.traceId === s2.selectedTraceId }"
            :aria-selected="request.traceId === s2.selectedTraceId"
            :title="request.traceId"
            @click="selectRequest(request.traceId)"
          >
            <span class="s2-req__line">
              <code class="s2-req__trace">traceId {{ shortTrace(request.traceId) }}</code>
              <span class="s2-status" :class="statusClass(request.status)">{{ request.status }}</span>
            </span>
            <span class="s2-req__line s2-req__root">{{ rootLabel(request) }}</span>
            <span class="s2-req__line s2-req__meta">
              <span>rootKind {{ request.rootKind ?? "未采集" }}</span>
              <span>spanCount {{ request.spanCount }}</span>
              <span>confidence {{ request.confidence }}</span>
              <span>hasError {{ request.hasError ? "true" : "false" }}</span>
              <span>startedAtNs {{ request.startedAtNs }}</span>
            </span>
          </button>
        </div>

        <p
          v-if="s2.requests.length === 0 && s2.requestsError === null && s2.requestsStatus !== 'ready'"
          class="s2-requests__state"
        >
          正在读取请求列表…
        </p>
        <p
          v-else-if="s2.requests.length === 0 && s2.requestsError === null"
          class="s2-requests__state"
        >
          空态：会话 <code>{{ s2.sessionId }}</code> 暂无请求。发起一次真实 cancel 后点击“刷新”；
          collector 内存存储在重启后清空。
        </p>
      </section>

      <section id="s2-chain" class="s2-chain" aria-labelledby="s2-chain-title">
        <h3 id="s2-chain-title" class="s2-subtitle">选中请求事实链（graph · 按 startNs）</h3>

        <p v-if="selectedRequest === null" class="s2-chain__state">
          空态：尚未选中请求（请求列表为空时会自动选中第一条）。
        </p>

        <template v-else>
          <div class="s2-facts">
            <p class="s2-facts__note">事实摘要，不是缺陷结论</p>
            <ul class="s2-facts__list">
              <li
                v-for="fact in facts"
                :key="fact.id"
                class="s2-fact"
                :class="{ 's2-fact--missing': fact.missing }"
              >
                <span class="s2-fact__label">{{ fact.label }}</span>
                <strong class="s2-fact__value">{{ fact.value }}</strong>
              </li>
            </ul>
          </div>

          <p class="s2-chain__meta">
            traceId <code>{{ selectedRequest.traceId }}</code>
            · {{ s2.graph?.nodes.length ?? 0 }} 节点 / {{ s2.graph?.edges.length ?? 0 }} 边
            · dur {{ formatNs(selectedRequest.durNs) }}
          </p>
          <p v-if="isLost" class="s2-chain__lost">
            游离后端请求（无前端根）· confidence LOST · rootEventId
            <code>{{ s2.graph?.rootEventId ?? "未采集" }}</code>
          </p>

          <p v-if="s2.graphStatus === 'loading'" class="s2-chain__state">正在读取事实链…</p>

          <ol v-if="chainRows.length > 0" class="s2-tree">
            <li v-for="row in chainRows" :key="row.node.spanId" class="s2-tree__row">
              <span class="s2-tree__indent" aria-hidden="true">
                <span v-for="level in row.depth" :key="level" class="s2-tree__spacer"></span>
                <span v-if="row.depth > 0" class="s2-tree__elbow"></span>
              </span>
              <div
                class="s2-tree__card"
                :class="{ 's2-tree__card--threw': row.node.status === THREW_STATUS }"
              >
                <div class="s2-tree__head">
                  <span v-if="row.node.parentSpanId === null" class="s2-tree__root-tag">根</span>
                  <span class="s2-type">{{ row.node.kind }}</span>
                  <code class="s2-tree__node-key">{{ row.node.nodeKey }}</code>
                  <span class="s2-status" :class="statusClass(row.node.status)">{{ row.node.status }}</span>
                  <span v-if="row.orphan" class="s2-tree__orphan">父 span 未采集</span>
                </div>
                <div class="s2-tree__facts">
                  <span>return：{{ nodeReturnText(row.node) }}</span>
                  <span>sideEffects：{{ nodeSideEffectsText(row.node) }}</span>
                </div>
                <div class="s2-tree__detail">
                  线程 {{ threadText(row.node) }} · startNs {{ row.node.startNs }}
                  · dur {{ formatNs(row.node.durNs) }} · spanId
                  <code>{{ row.node.spanId }}</code>
                </div>
              </div>
            </li>
          </ol>
          <p v-else-if="s2.graphStatus !== 'loading'" class="s2-chain__state">
            图为空：该 trace 暂无节点（未采集）。
          </p>
        </template>
      </section>
    </div>

    <p class="s2-panel__footnote">
      本面板只读：GET /api/v1/sessions/{sessionId}/requests 与 /graph?traceId=；只读派生，
      不重跑程序、不触发 SQL；S1 假面板的事件（s_wb_demo）与此链（默认 s_s2agent）无关联。
    </p>
  </section>
</template>
