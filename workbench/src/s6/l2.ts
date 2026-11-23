/**
 * S6a L2 helpers for the node detail panel (api.v1.md §10.10,
 * event-model.v1.md §4.4.7, s6a-plan.md §7).
 *
 * Everything here is a pure, read-only view over graph nodes already returned
 * by the collector. The L2 badge/note follow the `L2` span flag only — the
 * nodeKey is never hard-coded — and a value row counts as a "value change"
 * only when a previous value exists (`from` non-null) and differs from `to`;
 * the first observation (`from=null`) is a baseline, not a change.
 *
 * Scope honesty: S6a collects line-level locals for exactly one method
 * (`L2DemoService#reconcileAmount`). Async continuations / no-debug-info
 * degradation / loop folding / sampling budgets / L2 overhead are S6b and are
 * never claimed here.
 */
import type { GraphNode, L1Value } from "../api";
import { formatScalar } from "../s5/values";

/** Span flag that marks an L2 node (event-model.v1.md §7). */
export const L2_FLAG = "L2";
/** Badge text; shown only for nodes whose flags carry `L2`. */
export const L2_BADGE_TEXT = "L2";
/** Visible marker on the invocation whose local value changed. */
export const VALUE_CHANGE_TEXT = "值变化";

/** Canonical S6a banner (verbatim contract text; header/footnotes). */
export const S6A_BANNER =
  "S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b";
/** Canonical L2 note (verbatim); replaces the S5 note only on L2 nodes. */
export const S6A_L2_NOTE =
  "S6a L2：行级局部变量来自 LVT 探针（样例第 2 次调用 local 100 → 0）；异步/无调试信息/循环折叠/开销属 S6b";

/** True when the node flags carry `L2` (never inferred from nodeKey). */
export function isL2Node(node: GraphNode): boolean {
  return node.flags.includes(L2_FLAG);
}

/** `kind=local` rows in collected order; other kinds (S5) are left untouched. */
export function localValueRows(node: GraphNode): L1Value[] {
  return (node.values ?? []).filter((value) => value.kind === "local");
}

/**
 * Value-change rule (api.v1.md §10.10): `kind` is `local` or `field`, `from`
 * is non-null and `from !== to`. An absent/JSON-null `from` is the first
 * observation (baseline), therefore not a change.
 */
export function isValueChange(value: L1Value): boolean {
  if (value.kind !== "local" && value.kind !== "field") {
    return false;
  }
  if (value.from === null || value.from === undefined) {
    return false;
  }
  return formatScalar(value.from) !== formatScalar(value.to);
}

/**
 * Invocations of one same-nodeKey group whose own `values` contain a value
 * change (fixture: only the 2nd L2 call). Order is the group order, untouched.
 */
export function invocationDiffNodes(group: readonly GraphNode[]): GraphNode[] {
  return group.filter((node) => (node.values ?? []).some(isValueChange));
}