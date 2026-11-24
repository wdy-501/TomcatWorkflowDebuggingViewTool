/**
 * S6b async-inheritance helpers (api.v1.md §10.11, event-model.v1.md §4.4.8).
 *
 * The badge follows the `ASYNC_INHERITED` span flag ONLY — the nodeKey and the
 * thread id are never used as an inference signal. The flag proves that the
 * span's context came from an inherited parent frame and that the span ran on
 * a different thread than the parent frame's creator; it does NOT prove
 * `@Async` / `CompletableFuture` / framework propagation, and long-lived pools
 * or already existing threads never inherit request context automatically.
 */
import type { GraphNode } from "../api";

/** Span flag written by the agent for inherited L2/no-debug child spans. */
export const ASYNC_FLAG = "ASYNC_INHERITED";
/** Alias kept for call sites that read better with the full flag name. */
export const ASYNC_INHERITED_FLAG = ASYNC_FLAG;
/** Badge text; shown only for nodes whose flags carry `ASYNC_INHERITED`. */
export const ASYNC_BADGE_TEXT = "异步继承";
/** Visible limit note rendered next to the badge (never claims auto-propagation). */
export const ASYNC_LIMIT_NOTE =
  "仅新建线程创建时继承（ASYNC_INHERITED 只证明上下文来自继承的父帧）；长生命周期线程池/已存在线程不自动传播；@Async/CompletableFuture 未支持";

/** True when the node flags carry `ASYNC_INHERITED` (never nodeKey/thread inferred). */
export function hasAsyncInherited(node: GraphNode): boolean {
  return node.flags.includes(ASYNC_FLAG);
}