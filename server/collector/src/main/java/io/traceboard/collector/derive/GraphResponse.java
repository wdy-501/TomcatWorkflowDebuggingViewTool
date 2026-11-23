package io.traceboard.collector.derive;

import java.util.List;

/**
 * {@code GET /api/v1/sessions/{sessionId}/graph?traceId=} body (api.v1.md §8.2).
 * {@code rootEventId} is {@code null} and {@code confidence} falls back to {@code "LOST"}
 * for a rootless trace.
 */
public record GraphResponse(String sessionId, String traceId, String rootEventId, String confidence,
                            List<GraphNode> nodes, List<GraphEdge> edges) {
}
