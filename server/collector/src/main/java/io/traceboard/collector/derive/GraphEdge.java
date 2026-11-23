package io.traceboard.collector.derive;

/**
 * One parent → child edge (api.v1.md §8.2). S2 never aggregates: {@code count} is always 1
 * because {@code spanId} is unique inside a session.
 */
public record GraphEdge(String from, String to, int count) {
}
