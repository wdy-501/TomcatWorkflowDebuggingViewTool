/**
 * S6 L2 helpers for the node detail panel (api.v1.md §10.10/§10.11,
 * event-model.v1.md §4.4.7–§4.4.10, s6a-plan.md §7).
 *
 * Everything here is a pure, read-only view over graph nodes already returned
 * by the collector. The L2 badge/note follow the `L2` span flag only — the
 * nodeKey is never hard-coded — and a value row counts as a "value change"
 * only when a previous value exists (`from` non-null) and differs from `to`;
 * the first observation (`from=null`) is a baseline, not a change.
 *
 * S6b extends the same L2 facts to `reconcileAsync` (async inheritance flag,
 * see `s6/async.ts`) and `reconcileLoop` (list folding, see `s6/fold.ts`).
 * No-debug degradation lives in `s6/no-debug.ts`; line-level field writes,
 * deep object capture and multi-method L2 remain unsupported (canonical copy
 * in `s6/canonical.ts`).
 */
import type { GraphNode, L1Value } from "../api";
import { formatScalar } from "../s5/values";

/** Span flag that marks an L2 node (event-model.v1.md §7). */
export const L2_FLAG = "L2";
/** Badge text; shown only for nodes whose flags carry `L2`. */
export const L2_BADGE_TEXT = "L2";
/** Visible marker on the invocation whose local value changed. */
export const VALUE_CHANGE_TEXT = "值变化";

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