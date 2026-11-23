package io.traceboard.collector.hello;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * In-memory handshake registry (api.v1.md §10.2/§10.4): {@code sessionId -> latest hello}.
 *
 * <p>Last-wins, no TTL, no persistence, no eviction. A hello NEVER creates an event session and
 * never touches {@link io.traceboard.collector.store.EventStore}; restarting the collector clears
 * both stores together (honest 404 afterwards).</p>
 */
@Component
public class HelloStore {

    private final ConcurrentHashMap<String, AgentHello> bySession = new ConcurrentHashMap<>();

    /** Records the newest hello for the session (overwrites, never accumulates history). */
    public void record(AgentHello hello) {
        if (hello != null && hello.sessionId() != null) {
            bySession.put(hello.sessionId(), hello);
        }
    }

    /**
     * @return the latest hello for {@code sessionId}, or {@code null} when this session never
     *         completed a handshake
     */
    public AgentHello find(String sessionId) {
        return sessionId == null ? null : bySession.get(sessionId);
    }
}
