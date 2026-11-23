package io.traceboard.collector.derive;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * One graph node (api.v1.md §8.2/§10.8): exactly 14 fields, all always present.
 * Event facts are echoed verbatim — no aggregation, no ×N merge, no default invention.
 * {@code reason}/{@code source}/{@code confidence} are the S4 additive read-only fields
 * (raw event values; {@code null} when the event has no such field). {@code return} is the
 * Java keyword, hence the explicit JSON name.
 */
@JsonPropertyOrder({"spanId", "parentSpanId", "kind", "nodeKey", "status", "return",
        "sideEffects", "startNs", "durNs", "thread", "flags", "reason", "source", "confidence"})
public record GraphNode(String spanId, String parentSpanId, String kind, String nodeKey, String status,
                        @JsonProperty("return") JsonNode returnValue, JsonNode sideEffects,
                        long startNs, long durNs, JsonNode thread, JsonNode flags,
                        String reason, JsonNode source, String confidence) {
}
