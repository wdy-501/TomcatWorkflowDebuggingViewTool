/**
 * S6b canonical copy (single source of truth for the workbench UI).
 *
 * Every string here is the verbatim text documented in `docs/important-notes.md`
 * §10.11 (event-model.v1.md §4.4.8–§4.4.10). Components import these constants
 * instead of re-typing the copy, so `workbench/src` and `workbench/dist` stay
 * byte-identical in wording.
 *
 * Scope honesty carried by the copy itself:
 * - async inheritance happens only when a thread is CREATED (new worker);
 *   long-lived pools / already existing threads are not auto-propagated;
 * - no-debug methods only prove the call and the return value (no variable
 *   names, no line numbers, nothing guessed);
 * - loop folding is list-level (first/last/samples retained, dropped count
 *   visible via VALUES_CAPPED/VALUES_TOTAL); a retained value is NOT truncated;
 * - line-level field writes / deep object capture / multi-method L2 remain
 *   unsupported and are never claimed.
 */
import type { GraphNode } from "../api";

/** Header banner (api.v1.md §10.11). */
export const S6_BANNER =
  "S6：L2 行级（reconcileAmount）、异步继承（reconcileAsync）、无调试信息（NoDebugService#compute，NOT_COLLECTED_NO_DEBUG_INFO）、循环折叠（reconcileLoop）；长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持";

/** L2 note shown instead of the S5 note on `L2` nodes (api.v1.md §10.11). */
export const S6_L2_NOTE =
  "S6 L2：行级局部变量来自 LVT 探针（reconcileAmount 第 2 次 100 → 0；reconcileLoop 折叠保留首/尾/样本）；异步子线程创建时继承上下文（ASYNC_INHERITED）；长生命周期线程池不自动传播";

/** ×N honesty note (api.v1.md §10.11). */
export const S6_XN_NOTE =
  "×N 为已采集 span 的前端聚合；运行时 ×3 仅 L2DemoService#reconcileAmount 与 reconcileAsync（单异步线程内）演示；其他方法无运行时 ×3";

/** No-debug explanation (api.v1.md §10.11). */
export const S6_NO_DEBUG_NOTE =
  "S6 无调试信息：NoDebugService#compute 无 LocalVariableTable，状态 NOT_COLLECTED_NO_DEBUG_INFO；不猜变量名/行号";

/** Fold-note template; N = VALUES_CAPPED (dropped), M = VALUES_TOTAL. */
export const FOLD_NOTE_TEMPLATE = "已折叠 N 次（VALUES_CAPPED=N；共 M 次）";

/** Flag marker for the no-debug span (event-model.v1.md §7). */
export const NO_DEBUG_FLAG = "NO_DEBUG_INFO";

/** Status rendered only for no-debug spans (grey `notcollected`, never OK). */
export const NO_DEBUG_STATUS = "NOT_COLLECTED_NO_DEBUG_INFO";

/** True when the node flags carry `NO_DEBUG_INFO` (advisory marker only). */
export function hasNoDebugFlag(node: GraphNode): boolean {
  return node.flags.includes(NO_DEBUG_FLAG);
}