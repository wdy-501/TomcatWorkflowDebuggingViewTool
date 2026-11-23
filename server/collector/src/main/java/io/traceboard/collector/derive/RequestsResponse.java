package io.traceboard.collector.derive;

import java.util.List;

/**
 * {@code GET /api/v1/sessions/{sessionId}/requests} body (api.v1.md §8.1 + §9.2 S3 extension).
 *
 * <p>{@code sdkActive} (session-level, appended after {@code sessionId}) is {@code true} when the
 * session holds at least one {@code kind="ui_event"} event whose {@code flags} contain
 * {@code SDK_ACTIVE}: the browser runtime SDK was online and produced a click root.</p>
 */
public record RequestsResponse(String sessionId, boolean sdkActive, List<RequestSummary> requests) {
}
