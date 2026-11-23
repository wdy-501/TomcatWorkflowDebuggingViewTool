package io.traceboard.collector.derive;

/**
 * One trace's request summary (api.v1.md §8.1 + §9.2 S3 extension). {@code rootSpanId}/
 * {@code rootKind}/{@code nodeKey} are {@code null} for a rootless trace (honest gap);
 * {@code confidence} is derived by {@link TraceDeriver} (S3 rules) and falls back to
 * {@code "LOST"} for backend-only roots and rootless traces.
 *
 * <p>The S3 fields are appended after the unchanged S2 fields:
 * {@code fetchCount} = number of {@code kind="fetch"} events, {@code hasFrontend} = any of
 * ui_event/js_method/fetch/callback/render, {@code hasBackend} = any of
 * controller/service/mapper/sql/jdbc/async, {@code backendSpanCount} = their count.</p>
 */
public record RequestSummary(String traceId, String rootSpanId, String rootKind, String nodeKey,
                             String status, String confidence, int spanCount,
                             long startedAtNs, long durNs, boolean hasError,
                             int fetchCount, boolean hasFrontend, boolean hasBackend,
                             int backendSpanCount) {
}
