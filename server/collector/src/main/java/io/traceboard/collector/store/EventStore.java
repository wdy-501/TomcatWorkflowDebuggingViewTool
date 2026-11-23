package io.traceboard.collector.store;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * In-memory, append-only event store: {@code sessionId -> SessionLog}.
 *
 * <p>S1 has no persistence, no eviction, no sampling. Restart clears everything.</p>
 */
@Component
public class EventStore {

    private final ConcurrentHashMap<String, SessionLog> sessions = new ConcurrentHashMap<>();

    /**
     * @return the log for {@code sessionId}, created on first accepted event only
     */
    public SessionLog getOrCreate(String sessionId) {
        return sessions.computeIfAbsent(sessionId, SessionLog::new);
    }

    /**
     * @return the log, or {@code null} when the session never received an event
     */
    public SessionLog find(String sessionId) {
        return sessions.get(sessionId);
    }

    /**
     * Session list ordered by {@code startedAtMs} ascending, ties broken by {@code sessionId}.
     */
    public List<SessionLog.SessionSnapshot> list() {
        List<SessionLog.SessionSnapshot> all = new ArrayList<>();
        for (SessionLog log : sessions.values()) {
            all.add(log.snapshot());
        }
        all.sort(Comparator.comparingLong(SessionLog.SessionSnapshot::startedAtMs)
                .thenComparing(SessionLog.SessionSnapshot::sessionId));
        return all;
    }
}
