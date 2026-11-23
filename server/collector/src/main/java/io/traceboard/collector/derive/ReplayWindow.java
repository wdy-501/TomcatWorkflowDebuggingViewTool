package io.traceboard.collector.derive;

import java.util.List;

import io.traceboard.collector.store.StoredEvent;

/**
 * Effective replay window (api.v1.md §9.1): the echoed (already defaulted) bounds plus the
 * stored events whose {@code startNs} falls inside them.
 */
public record ReplayWindow(long fromNs, long toNs, List<StoredEvent> events) {
}
