package io.traceboard.collector.hello;

/**
 * One accepted agent handshake (api.v1.md §10.2/§10.3). Kept in memory only, last-wins per
 * session; {@code lastSeenMs} is the collector receive time (collector clock), never derived from
 * {@code startedAtMs} (agent clock).
 */
public record AgentHello(String sessionId, String version, long pid, long startedAtMs, long lastSeenMs) {
}
