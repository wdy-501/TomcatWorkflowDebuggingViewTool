package io.traceboard.collector.store;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Append-only in-memory log for one session.
 *
 * <p>All mutation is guarded by the instance monitor: idempotency lookup then append,
 * sequence numbers start at 1 and never repeat. Readers take an immutable snapshot.</p>
 */
public final class SessionLog {

    private final String sessionId;
    private final List<StoredEvent> events = new ArrayList<>();
    private final Set<String> idempotencyKeys = new HashSet<>();
    private long startedAtMs;
    private long lastEventAtMs;

    public SessionLog(String sessionId) {
        this.sessionId = sessionId;
    }

    public String sessionId() {
        return sessionId;
    }

    /**
     * Append one accepted event unless {@code (traceId, spanId)} was already stored.
     *
     * @return the assigned sequence number, or {@code -1} when the event is a duplicate
     */
    public synchronized int append(String traceId, String spanId, String rawEventJson) {
        String key = traceId + '\u0000' + spanId;
        if (!idempotencyKeys.add(key)) {
            return -1;
        }
        long now = System.currentTimeMillis();
        int seq = events.size() + 1;
        events.add(new StoredEvent(seq, rawEventJson));
        if (seq == 1) {
            startedAtMs = now;
        }
        lastEventAtMs = now;
        return seq;
    }

    public synchronized SessionSnapshot snapshot() {
        return new SessionSnapshot(sessionId, events.size(), startedAtMs, lastEventAtMs,
                new ArrayList<>(events));
    }

    /**
     * Immutable read view of a session (events ordered by seq ascending).
     */
    public record SessionSnapshot(String sessionId, int eventCount, long startedAtMs,
                                  long lastEventAtMs, List<StoredEvent> events) {
    }
}
