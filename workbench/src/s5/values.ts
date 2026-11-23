/**
 * S5 L1 rendering helpers for the node detail's Values section
 * (api.v1.md §10.9, event-model.v1.md §4.4).
 *
 * Everything here is a pure, read-only view over graph node `values` already
 * returned by the collector: param / field-write / return summaries, the
 * redaction placeholder, the truncation flag and the optional invocation
 * number. Nothing is decoded, recomputed or inferred:
 * - no `.map` decoding: `source` is the manifest-provided `file:line` only
 *   (`SOURCE_MAPPED` marks the manifest hit, it is not a source map);
 * - no local variables / line-level values: value rows of the `local` kind and
 *   non-null `line` belong to L2/S6 and are never produced or claimed here;
 * - missing facts stay `未采集` (absence is not zero and not an empty value).
 */
import type { GraphNode, L1Value } from "../api";
import { MISSING } from "../s4/derive";

/** Static honesty note shown with the Values section (verbatim contract text). */
export const L1_STATIC_NOTE =
  "S5 L1：参数/字段写入/返回摘要；局部变量（L2）与行级属 S6，本阶段未采集";
/** Empty state (verbatim contract text; null and [] both render this). */
export const VALUES_EMPTY_TEXT = "未采集（该节点无 values；S5 只采参数/字段写入/返回摘要）";
/** Flags (event-model.v1.md §7). */
export const L1_FLAG = "L1";
export const SOURCE_MAPPED_FLAG = "SOURCE_MAPPED";
/** Appended to a complete `file:line` only when the manifest produced it. */
export const MANIFEST_SOURCE_SUFFIX = "（manifest 映射）";
/** Footer when a value row carries no line number (S5 always: line=null). */
export const LINE_MISSING_TEXT = "行号未采集";

export function hasFlag(flags: readonly string[], flag: string): boolean {
  return flags.includes(flag);
}

export function hasL1Flag(node: GraphNode): boolean {
  return hasFlag(node.flags, L1_FLAG);
}

/** Display rows in array order (param → field → return); never re-sorted. */
export function valueRows(node: GraphNode): L1Value[] {
  return node.values ?? [];
}

/**
 * Scalar text for a value (values are scalars in S5). Objects are shown as
 * compact JSON so the UI never silently drops a fact it cannot format.
 */
export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "number") {
    // JSON numbers render without re-formatting: 100 → "100", 0 → "0".
    return String(value);
  }
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

/**
 * Row value text: `field` shows the collected `from → to` write (e.g.
 * `100 → 0`); `param`/`return` show `to` (redacted rows therefore show only
 * the `[REDACTED len=N]` placeholder, never an original value).
 *
 * S6a `local` rows (L2) show `from → to` only when a previous value exists;
 * the first observation (`from=null`) shows just `to`, never `null → 100`.
 */
export function valueLineText(value: L1Value): string {
  const hasPrevious = value.from !== null && value.from !== undefined;
  if (value.kind === "field" || (value.kind === "local" && hasPrevious)) {
    return `${formatScalar(value.from)} → ${formatScalar(value.to)}`;
  }
  return formatScalar(value.to);
}

/** True for a field write whose old and new values differ (the `100 → 0` row). */
export function isFieldDiff(value: L1Value): boolean {
  return (
    value.kind === "field" &&
    value.from !== null &&
    value.from !== undefined &&
    value.to !== null &&
    value.to !== undefined &&
    formatScalar(value.from) !== formatScalar(value.to)
  );
}

/** `行号未采集` in S5 (line=null); a collected line renders `行号 N`. */
export function lineFooterText(value: L1Value): string {
  if (typeof value.line === "number" && Number.isFinite(value.line) && value.line >= 0) {
    return `行号 ${value.line}`;
  }
  return LINE_MISSING_TEXT;
}

/**
 * Invocation footer: `values.invocation` (i, 1-based) over the number of
 * collected spans with the same nodeKey; an absent invocation (S5 single call)
 * renders the verbatim `第 1/1 次`. This counter is the value-row source — it
 * is NOT the S4 ×N group selector index.
 */
export function invocationText(value: L1Value, collectedTotal: number): string {
  if (value.invocation === undefined) {
    return "第 1/1 次";
  }
  const total = Math.max(value.invocation, collectedTotal > 0 ? collectedTotal : value.invocation);
  return `第 ${value.invocation}/${total} 次`;
}

/**
 * Node `source` display: complete `file:line`, plus `（manifest 映射）` when the
 * node flags carry `SOURCE_MAPPED`; otherwise `未采集`. Backend sources come
 * from the JVM stack and never get the manifest suffix.
 */
export function s5SourceText(node: GraphNode): string {
  const source = node.source;
  if (
    source === null ||
    typeof source.file !== "string" ||
    source.file.length === 0 ||
    typeof source.line !== "number" ||
    !Number.isFinite(source.line) ||
    source.line < 1
  ) {
    return MISSING;
  }
  const base = `${source.file}:${source.line}`;
  return hasFlag(node.flags, SOURCE_MAPPED_FLAG) ? `${base}${MANIFEST_SOURCE_SUFFIX}` : base;
}