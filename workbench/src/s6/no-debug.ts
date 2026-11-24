/**
 * S6b no-debug degradation helpers (api.v1.md §10.11,
 * event-model.v1.md §4.4.9).
 *
 * `NOT_COLLECTED_NO_DEBUG_INFO` is a grey "not collected" status, NOT a
 * success: the method bytecode carried no `LocalVariableTable`, so the agent
 * only proved the call and the real return value. No variable name, no line
 * number and no value item exists — the reason text comes verbatim from the
 * event (`LocalVariableTable missing`), never from a hard-coded guess.
 */
import type { GraphNode } from "../api";
import { NO_DEBUG_STATUS } from "./canonical";

/** Badge text for the degraded node (grey, never OK/success tone). */
export const NO_DEBUG_BADGE_TEXT = "无调试信息";
/** Shown when the event unexpectedly carries no reason (still not a guess). */
export const NO_DEBUG_REASON_MISSING_TEXT = "未采集（无 reason）";

/** True when the node status is exactly NOT_COLLECTED_NO_DEBUG_INFO only. */
export function isNoDebugNode(node: GraphNode): boolean {
  return node.status === NO_DEBUG_STATUS;
}

/** Event `reason` verbatim; a missing reason renders 未采集（无 reason）. */
export function noDebugReason(node: GraphNode): string {
  if (node.reason !== null && node.reason.length > 0) {
    return node.reason;
  }
  return NO_DEBUG_REASON_MISSING_TEXT;
}