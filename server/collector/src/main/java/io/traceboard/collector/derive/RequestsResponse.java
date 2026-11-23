package io.traceboard.collector.derive;

import java.util.List;

/**
 * {@code GET /api/v1/sessions/{sessionId}/requests} body (api.v1.md §8.1).
 */
public record RequestsResponse(String sessionId, List<RequestSummary> requests) {
}
