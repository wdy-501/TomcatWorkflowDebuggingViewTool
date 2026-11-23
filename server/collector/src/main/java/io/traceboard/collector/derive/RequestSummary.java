package io.traceboard.collector.derive;

/**
 * One trace's request summary (api.v1.md §8.1). {@code rootSpanId}/{@code rootKind}/
 * {@code nodeKey} are {@code null} for a rootless trace (honest gap); {@code confidence}
 * falls back to {@code "LOST"} for such traces.
 */
public record RequestSummary(String traceId, String rootSpanId, String rootKind, String nodeKey,
                             String status, String confidence, int spanCount,
                             long startedAtNs, long durNs, boolean hasError) {
}
