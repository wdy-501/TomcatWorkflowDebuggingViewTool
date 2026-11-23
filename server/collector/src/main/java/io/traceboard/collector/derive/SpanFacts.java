package io.traceboard.collector.derive;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Lightweight, immutable projection of one stored event, parsed at read time
 * (api.v1.md §8). Scalar fields drive grouping/aggregation; the JSON nodes are kept
 * verbatim so {@code return}/{@code sideEffects}/{@code thread}/{@code flags} are echoed
 * exactly as ingested.
 *
 * <p>{@code parentSpanId} is {@code null} for a trace root. {@code sideEffects} is never
 * {@code null} (events without the field yield an empty array); {@code thread} and
 * {@code returnValue} may be {@code null} when the event has no such field.</p>
 */
public record SpanFacts(String traceId, String spanId, String parentSpanId, String rootEventId,
                        String kind, String nodeKey, String status, String confidence,
                        long startNs, long durNs, JsonNode returnValue, JsonNode sideEffects,
                        JsonNode thread, JsonNode flags) {

    public boolean isRoot() {
        return parentSpanId == null;
    }
}
