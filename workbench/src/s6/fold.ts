/**
 * S6b loop-fold helpers (api.v1.md §10.11, event-model.v1.md §4.4.10).
 *
 * Folding is LIST-level, not value-level truncation: the agent keeps the first
 * six and the last six observations plus middle samples (the first bad value
 * `to=0` is always kept) and records the visible counts as span flags
 * `VALUES_CAPPED=<dropped>` / `VALUES_TOTAL=<observations before fold>`.
 * The note renders only when both flags parse with `capped > 0`; nodes without
 * the flags never get a fold note. The retained items keep `truncated=false`.
 */
import type { GraphNode } from "../api";
import { FOLD_NOTE_TEMPLATE } from "./canonical";

/** Flag prefix carrying the dropped-item count (pair of VALUES_TOTAL). */
export const VALUES_CAPPED_PREFIX = "VALUES_CAPPED=";
/** Flag prefix carrying the pre-fold observation count. */
export const VALUES_TOTAL_PREFIX = "VALUES_TOTAL=";

export interface FoldCounts {
  /** VALUES_CAPPED: items dropped by the fold (always > 0 when present). */
  capped: number;
  /** VALUES_TOTAL: observations before the fold (includes the baseline). */
  total: number;
}

function parseFlagInt(flags: readonly string[], prefix: string): number | null {
  for (const flag of flags) {
    if (flag.startsWith(prefix)) {
      const parsed = Number.parseInt(flag.slice(prefix.length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
      return null;
    }
  }
  return null;
}

/**
 * Parsed cap counts, or null when either flag is absent/invalid or `capped`
 * is 0 (the contract requires both flags together with a positive drop count).
 */
export function foldCounts(node: GraphNode): FoldCounts | null {
  const capped = parseFlagInt(node.flags, VALUES_CAPPED_PREFIX);
  const total = parseFlagInt(node.flags, VALUES_TOTAL_PREFIX);
  if (capped === null || total === null || capped <= 0 || total <= capped) {
    return null;
  }
  return { capped, total };
}

/**
 * `已折叠 N 次（VALUES_CAPPED=N；共 M 次）` with N = dropped, M = total,
 * or null when the node has no valid cap pair (no fold note then).
 */
export function foldNote(node: GraphNode): string | null {
  const counts = foldCounts(node);
  if (counts === null) {
    return null;
  }
  return `已折叠 ${counts.capped} 次（VALUES_CAPPED=${counts.capped}；共 ${counts.total} 次）`;
}

/** Tooltip copy proving the note follows the canonical template. */
export const FOLD_NOTE_TITLE =
  `${FOLD_NOTE_TEMPLATE}；N = VALUES_CAPPED（折叠丢弃数）、M = VALUES_TOTAL（折叠前总数）；保留项为首/尾/中段样本，单值未被截断`;