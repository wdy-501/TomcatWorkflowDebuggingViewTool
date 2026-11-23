/**
 * S4 read-only derivations for the node detail panel, ×N grouping and gaps.
 *
 * Everything here is pure front-end logic over ALREADY-COLLECTED graph nodes
 * (api.v1.md §8.2/§10.8, S4-AMD-01 §6/§7). It never merges statuses, never
 * treats a missing fact as zero and never claims runtime ×3 (that remains S6):
 * the workbench only groups spans the collector already returned by `nodeKey`.
 */
import type { GraphNode } from "../api";

export const MISSING = "未采集";
export const NOT_COLLECTED_NO_REASON = "未采集（无 reason）";
export const FETCH_WITHOUT_BACKEND_TEXT = "后端未采集/未关联";
export const GAP_EMPTY_TEXT = "未发现缺口（仅基于已采集数据；未采集项不会显示为成功）";
/** Static honesty line required under #s4-invocations / #s4-gaps (S4-AMD-01 §7.1). */
export const RUNTIME_X3_NOTE = "×N 为已采集 span 的前端聚合；运行时 ×3 属 S6";
/** Visible label for the ×N demo; the fixture is UI/test data only. */
export const XN_DEMO_LABEL = "×N 聚合演示（运行时 ×3 属 S6）";

const FRONTEND_KINDS = new Set(["ui_event", "js_method", "fetch", "render"]);

/** Contract order: startNs ascending, ties by spanId lexicographic. */
export function sortNodes(a: GraphNode, b: GraphNode): number {
  if (a.startNs !== b.startNs) {
    return a.startNs - b.startNs;
  }
  return a.spanId.localeCompare(b.spanId);
}

export interface NodeGroup {
  nodeKey: string;
  kind: string;
  count: number;
  badge: string;
  nodes: GraphNode[];
}

/** Group collected spans by nodeKey within the selected trace (display only). */
export function groupNodesByNodeKey(nodes: readonly GraphNode[]): NodeGroup[] {
  const map = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const list = map.get(node.nodeKey) ?? [];
    list.push(node);
    map.set(node.nodeKey, list);
  }
  const groups: NodeGroup[] = [];
  for (const [nodeKey, list] of map) {
    list.sort(sortNodes);
    groups.push({
      nodeKey,
      kind: list[0].kind,
      count: list.length,
      badge: `×${list.length}`,
      nodes: list,
    });
  }
  groups.sort((a, b) => sortNodes(a.nodes[0], b.nodes[0]));
  return groups;
}

export function isNotCollected(status: string): boolean {
  return status.startsWith("NOT_COLLECTED");
}

/** NOT_COLLECTED_* shows the verbatim reason; missing → 未采集（无 reason）. */
export function reasonText(node: GraphNode): string {
  if (node.reason !== null && node.reason.length > 0) {
    return node.reason;
  }
  return isNotCollected(node.status) ? NOT_COLLECTED_NO_REASON : "—";
}

/** `file:line` only when both parts are complete; otherwise 未采集 (no manifest source). */
export function sourceText(node: GraphNode): string {
  const source = node.source;
  if (
    source !== null &&
    typeof source.file === "string" &&
    source.file.length > 0 &&
    typeof source.line === "number" &&
    Number.isFinite(source.line)
  ) {
    return `${source.file}:${source.line}`;
  }
  return MISSING;
}

export function threadText(node: GraphNode): string {
  if (node.thread === null) {
    return MISSING;
  }
  return `${node.thread.name} #${node.thread.id}`;
}

export type GapRule =
  | "FETCH_WITHOUT_BACKEND"
  | "NOT_COLLECTED_REASON"
  | "ROWS_NOT_COLLECTED";

export interface GapItem {
  spanId: string;
  kind: string;
  nodeKey: string;
  rule: GapRule;
  ruleLabel: string;
  /** User-facing text (backend not collected / verbatim reason / 未采集). */
  text: string;
  /** Dedupe key component (F=rule id, N=event reason or NO_REASON, R=rule id). */
  internalReason: string;
}

/**
 * Gap rules (S4-AMD-01 §7.2): per span at most ONE gap, priority F > N > R,
 * emitted in span order. Different spans (×N invocations) are never merged.
 */
export function deriveGaps(nodes: readonly GraphNode[]): GapItem[] {
  const sorted = [...nodes].sort(sortNodes);
  const referencedByBackend = new Set<string>();
  for (const node of sorted) {
    if (!FRONTEND_KINDS.has(node.kind) && node.parentSpanId !== null) {
      referencedByBackend.add(node.parentSpanId);
    }
  }
  const gaps: GapItem[] = [];
  for (const node of sorted) {
    if (node.kind === "fetch" && !referencedByBackend.has(node.spanId)) {
      gaps.push({
        spanId: node.spanId,
        kind: node.kind,
        nodeKey: node.nodeKey,
        rule: "FETCH_WITHOUT_BACKEND",
        ruleLabel: "F",
        text: FETCH_WITHOUT_BACKEND_TEXT,
        internalReason: "FETCH_WITHOUT_BACKEND",
      });
      continue;
    }
    if (isNotCollected(node.status)) {
      const reason =
        node.reason !== null && node.reason.length > 0 ? node.reason : null;
      gaps.push({
        spanId: node.spanId,
        kind: node.kind,
        nodeKey: node.nodeKey,
        rule: "NOT_COLLECTED_REASON",
        ruleLabel: "N",
        text: reason !== null ? `${MISSING} · ${reason}` : NOT_COLLECTED_NO_REASON,
        internalReason: reason ?? "NO_REASON",
      });
      continue;
    }
    if (
      (node.kind === "mapper" || node.kind === "sql") &&
      node.sideEffects.length === 0
    ) {
      gaps.push({
        spanId: node.spanId,
        kind: node.kind,
        nodeKey: node.nodeKey,
        rule: "ROWS_NOT_COLLECTED",
        ruleLabel: "R",
        text: MISSING,
        internalReason: "ROWS_NOT_COLLECTED",
      });
    }
  }
  return gaps;
}

export interface InvocationRows {
  source: "self" | "child_sql" | "none";
  /** Collected rowsAffected values in sql order; null = collected without a number. */
  values: Array<number | null>;
  sqlSpanIds: string[];
}

/**
 * Per-invocation rows come from the sql span(s) of THAT invocation only:
 * - the node itself is sql → its own sideEffects rowsAffected;
 * - otherwise its sql descendants (`子 sql`), e.g. service → mapper → sql;
 * - no sql span → 未采集 (never 0).
 */
export function rowsForInvocation(
  node: GraphNode,
  allNodes: readonly GraphNode[]
): InvocationRows {
  if (node.kind === "sql") {
    const values = node.sideEffects.map((effect) => effect.rowsAffected);
    return {
      source: values.length > 0 ? "self" : "none",
      values,
      sqlSpanIds: [],
    };
  }
  const children = new Map<string, GraphNode[]>();
  for (const item of allNodes) {
    if (item.parentSpanId !== null) {
      const list = children.get(item.parentSpanId) ?? [];
      list.push(item);
      children.set(item.parentSpanId, list);
    }
  }
  const sqlNodes: GraphNode[] = [];
  const visited = new Set<string>([node.spanId]);
  const stack: GraphNode[] = [...(children.get(node.spanId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current.spanId)) {
      continue;
    }
    visited.add(current.spanId);
    if (current.kind === "sql") {
      sqlNodes.push(current);
    }
    for (const child of children.get(current.spanId) ?? []) {
      stack.push(child);
    }
  }
  sqlNodes.sort(sortNodes);
  const values: Array<number | null> = [];
  for (const sql of sqlNodes) {
    for (const effect of sql.sideEffects) {
      values.push(effect.rowsAffected);
    }
  }
  return {
    source: sqlNodes.length > 0 ? "child_sql" : "none",
    values,
    sqlSpanIds: sqlNodes.map((sql) => sql.spanId),
  };
}

export function rowsText(rows: InvocationRows): string {
  if (rows.source === "none" || rows.values.length === 0) {
    return MISSING;
  }
  return rows.values
    .map((value) => (value === null ? MISSING : String(value)))
    .join(", ");
}

export function formatNs(ns: number): string {
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

export function formatValue(value: unknown): string {
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

export function returnText(node: GraphNode): string {
  if (node.return === null) {
    return `${MISSING}（无返回摘要）`;
  }
  if (node.return.value === undefined) {
    return `${node.return.type} = ${MISSING}`;
  }
  return `${node.return.type} = ${formatValue(node.return.value)}`;
}

export interface StatusMeta {
  tone: string;
  label: string;
}

/** Status tone classes reuse the S3 palette; per-invocation status is never merged. */
export function statusMeta(status: string): StatusMeta {
  if (status === "OK") {
    return { tone: "ok", label: "OK" };
  }
  if (status === "RETURNED_FALSE") {
    return { tone: "false", label: "RETURNED_FALSE" };
  }
  if (status === "THREW") {
    return { tone: "threw", label: "THREW" };
  }
  if (isNotCollected(status)) {
    return { tone: "notcollected", label: status };
  }
  if (status === "TRUNCATED") {
    return { tone: "truncated", label: "TRUNCATED" };
  }
  if (status === "REDACTED") {
    return { tone: "redacted", label: "REDACTED" };
  }
  if (status === "UNKNOWN") {
    return { tone: "unknown", label: "UNKNOWN" };
  }
  return { tone: "neutral", label: status.length > 0 ? status : MISSING };
}

export function confidenceText(confidence: string): string {
  if (confidence === "LOST") {
    return "LOST · 游离";
  }
  return confidence.length > 0 ? confidence : MISSING;
}

/** UI effect text of a render node (`return.type = ui_effect` or nodeKey prefix). */
export function uiEffectText(node: GraphNode): string | null {
  if (
    node.return !== null &&
    node.return.type === "ui_effect" &&
    node.return.value !== undefined
  ) {
    return formatValue(node.return.value);
  }
  if (node.nodeKey.startsWith("ui_effect:")) {
    return node.nodeKey.slice("ui_effect:".length);
  }
  return null;
}
