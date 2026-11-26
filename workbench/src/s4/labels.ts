import type { GraphNode } from "../api";

const CONTROL_NAMES: Record<string, string> = {
  "#btn-cancel": "取消订单",
  "#btn-save-b": "保存",
  "#btn-discount": "折扣预览",
  "#btn-remark": "提交请求体",
  "#btn-no-debug": "无调试信息",
  "#btn-unknown-cancel": "未知订单取消",
  "#btn-unjoined": "未接入后端请求",
  "#btn-reconcile": "重算金额",
  "#btn-reconcile-async": "异步重算",
  "#btn-reconcile-loop": "循环重算",
  "#app": "应用根节点",
};

const BACKEND_SOURCE_ROOT =
  "demo/buggy-shop-boot-vue/backend/src/main/java/";
const FRONTEND_SOURCE_ROOT = "demo/buggy-shop-boot-vue/frontend/";

const KIND_LABELS: Record<string, string> = {
  ui_event: "页面点击",
  fetch: "网络请求",
  js_method: "前端方法",
  controller: "控制器",
  service: "服务",
  mapper: "数据访问",
  sql: "SQL",
  render: "页面渲染",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? (kind.length > 0 ? kind : "未采集");
}

/** Generic (non-demo) instrumentation marker: any `GENERIC`/`GENERIC_*` flag. */
export function isGenericNode(node: Pick<GraphNode, "flags">): boolean {
  return node.flags.some(
    (flag) => flag === "GENERIC" || flag.startsWith("GENERIC_")
  );
}

/** `GENERIC_AUTO` service spans are the auto-scanned public methods (noise candidates). */
export function isGenericAutoService(
  node: Pick<GraphNode, "kind" | "flags">
): boolean {
  return node.kind === "service" && node.flags.includes("GENERIC_AUTO");
}

/**
 * Node label for the start banner / main chain. Generic service spans are labelled as
 * business methods instead of the demo's fixed `Service` vocabulary.
 */
export function nodeKindLabel(node: Pick<GraphNode, "kind" | "flags">): string {
  if (node.kind === "service" && isGenericNode(node)) {
    return "业务方法（通用插桩）";
  }
  return kindLabel(node.kind);
}

/** Drop package prefixes from Java node keys; the full key stays in the tooltip/detail. */
export function compactNodeKey(kind: string, key: string): string {
  if (kind !== "controller" && kind !== "service" && kind !== "mapper") {
    return key;
  }
  const hash = key.indexOf("#");
  const dot = key.lastIndexOf(".", hash >= 0 ? hash : key.length);
  return dot >= 0 ? key.slice(dot + 1) : key;
}

/** Friendly label for the built-in demo controls; unknown selectors stay unlabelled. */
export function controlNameFor(nodeKey: string | null): string | null {
  if (nodeKey === null || nodeKey.length === 0) {
    return null;
  }
  const mapped = CONTROL_NAMES[nodeKey];
  if (mapped !== undefined) {
    return mapped;
  }
  if (
    nodeKey.startsWith("#") ||
    nodeKey.startsWith("[") ||
    nodeKey.includes(":nth-") ||
    nodeKey === "unknown"
  ) {
    return null;
  }
  return nodeKey;
}

/**
 * Repository-relative source path used in hover tooltips. Generic-agent nodes never
 * borrow the built-in demo source root; they show the event's own source or nothing.
 */
export function repoSourcePath(node: GraphNode): string | null {
  const source = node.source;
  if (source === null || source.file === null) {
    return null;
  }
  const line = source.line === null ? "" : `:${source.line}`;
  if (isGenericNode(node)) {
    return `${source.file}${line}`;
  }
  if (source.file.startsWith("src/")) {
    return `${FRONTEND_SOURCE_ROOT}${source.file}${line}`;
  }
  const fqcn = node.nodeKey.split("#")[0] ?? "";
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(fqcn)) {
    const path = `${BACKEND_SOURCE_ROOT}${fqcn.split(".").join("/")}.java`;
    // MapperProxy line numbers belong to the proxy, not the mapper interface.
    return node.kind === "mapper" ? path : `${path}${line}`;
  }
  return `${source.file}${line}`;
}

export function flagDescription(flag: string): string {
  if (flag === "SDK_ACTIVE") {
    return "该事件由前端 runtime SDK 采集";
  }
  if (flag === "S3_RUNTIME_SDK") {
    return "前端 SDK 的阶段标记，不承载关联语义";
  }
  if (flag === "SOURCE_MAPPED") {
    return "源码位置来自构建清单，不是 sourcemap 解码";
  }
  if (flag.startsWith("OBSERVE_MS=")) {
    return "点击观察窗的实际毫秒数";
  }
  if (flag === "S2_ZERO_ROW_CHAIN") {
    return "0 行演示链路的采集范围标记，不代表业务结论";
  }
  if (flag === "S3_EXACT_LINK") {
    return "前端请求与后端 controller 精确关联";
  }
  if (flag === "LOST_BACKEND") {
    return "只有后端、没有前端点击根的游离请求";
  }
  if (flag === "L1") {
    return "采集了参数、字段写入或返回值摘要";
  }
  if (flag === "L2") {
    return "采集了行级局部变量";
  }
  if (flag === "ASYNC_INHERITED") {
    return "异步线程在创建时继承了调用上下文";
  }
  if (flag === "GENERIC") {
    return "通用插桩标记：来自用户项目的动态方法，不是内置 demo 的固定类";
  }
  if (flag === "GENERIC_AUTO") {
    return "应用主包自动扫包采集的 public 业务方法（可能有 getter/工具方法噪声）";
  }
  if (flag === "GENERIC_INCLUDED") {
    return "由 --include-method 显式指定采集的方法";
  }
  if (flag === "GENERIC_ROOT") {
    return "没有上层调用时，由显式 include-method 建立的根节点";
  }
  if (flag === "TRACEPARENT_ONLY") {
    return "只有 traceparent、没有 X-TraceBoard-Click：后端请求无法与页面点击精确关联";
  }
  if (flag === "RETURN_TRUNCATED") {
    return "返回值超出采集预算，已截断（只保留摘要）";
  }
  if (flag.startsWith("ARGS_CAPPED=")) {
    return "参数列表因采集预算被截断的数量";
  }
  if (flag.startsWith("EXCEPTION=")) {
    return "方法抛出异常（只记录异常类型，不采集 message）";
  }
  if (flag === "SQL_SELECT" || flag === "SQL_INSERT" || flag === "SQL_UPDATE" || flag === "SQL_DELETE") {
    return "SQL 语句类型标记（不采集 SQL 文本）";
  }
  if (flag === "NO_DEBUG_INFO") {
    return "方法没有调试信息，无法给出变量名或行号";
  }
  if (flag.startsWith("VALUES_CAPPED=")) {
    return "值列表因预算被折叠的数量";
  }
  if (flag.startsWith("VALUES_TOTAL=")) {
    return "折叠前的值项总数";
  }
  if (flag.startsWith("DROP_COUNT=")) {
    return "采集过程中累计丢弃的事件数；0 表示没有丢弃";
  }
  if (flag.startsWith("L1_SKIPPED=")) {
    return "因非标量或不可读而跳过的值数量";
  }
  if (flag === "SAMPLED") {
    return "该节点经过了采样";
  }
  if (flag.startsWith("SKELETON") || flag.startsWith("S1_")) {
    return "早期阶段演示标记，不代表当前能力";
  }
  return "未识别的标记；读取方应忽略，不影响已有事实";
}

export function statusChinese(status: string): string {
  if (status === "OK") {
    return "正常";
  }
  if (status === "RETURNED_FALSE") {
    return "正常返回 false";
  }
  if (status === "THREW") {
    return "抛出异常";
  }
  if (status.startsWith("NOT_COLLECTED")) {
    return "未采集";
  }
  if (status === "TRUNCATED") {
    return "已截断/已折叠";
  }
  if (status === "REDACTED") {
    return "已脱敏";
  }
  if (status === "UNKNOWN") {
    return "未知";
  }
  return status.length > 0 ? status : "未采集";
}

export function confidenceBrief(confidence: string): string {
  if (confidence === "EXACT") {
    return "前后端已关联";
  }
  if (confidence === "LOST") {
    return "前后端未关联";
  }
  if (confidence === "MANUAL") {
    return "手工标注";
  }
  if (confidence === "INFERRED") {
    return "推断关联";
  }
  return "关联方式未采集";
}

export function nodeSqlSummary(node: GraphNode): string {
  if (node.sideEffects.length === 0) {
    return "影响行数未采集";
  }
  return node.sideEffects
    .map((effect) =>
      effect.rowsAffected === null
        ? "影响行数未采集"
        : `影响 ${effect.rowsAffected} 行`
    )
    .join("；");
}