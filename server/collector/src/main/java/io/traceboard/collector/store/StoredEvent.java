package io.traceboard.collector.store;

/**
 * One stored event: per-session sequence number plus the exact, compact JSON line
 * that was accepted by ingest (verbatim, still a schema-valid v1 event).
 */
public record StoredEvent(int seq, String rawEventJson) {
}
