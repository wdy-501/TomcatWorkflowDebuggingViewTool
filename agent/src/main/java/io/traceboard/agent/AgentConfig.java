package io.traceboard.agent;

import java.util.regex.Pattern;

/**
 * Agent configuration from system properties (s1-plan.md §7.3/§7.4).
 *
 * <ul>
 *   <li>{@code -Dtraceboard.ingestUrl} — required; when absent the agent is a fail-open noop;</li>
 *   <li>{@code -Dtraceboard.sessionId} — must match {@code ^s_[A-Za-z0-9_-]+$}, else default;</li>
 *   <li>{@code -Dtraceboard.traceId} — optional fixed 32-char lowercase hex trace id;</li>
 *   <li>{@code -Dtraceboard.enabled} — {@code false} disables instrumentation.</li>
 * </ul>
 */
final class AgentConfig {

    static final String DEFAULT_SESSION_ID = "s_s2agent";

    private static final Pattern SESSION_ID = Pattern.compile("^s_[A-Za-z0-9_-]+$");
    private static final Pattern TRACE_ID = Pattern.compile("^[0-9a-f]{32}$");

    private final boolean enabled;
    private final String ingestUrl;
    private final String sessionId;
    private final String traceId;

    private AgentConfig(boolean enabled, String ingestUrl, String sessionId, String traceId) {
        this.enabled = enabled;
        this.ingestUrl = ingestUrl;
        this.sessionId = sessionId;
        this.traceId = traceId;
    }

    static AgentConfig fromSystemProperties() {
        String enabledRaw = trimToNull(System.getProperty("traceboard.enabled"));
        boolean enabled = enabledRaw == null || !"false".equalsIgnoreCase(enabledRaw);
        String url = trimToNull(System.getProperty("traceboard.ingestUrl"));
        if (!enabled || url == null) {
            return new AgentConfig(false, null, DEFAULT_SESSION_ID, null);
        }
        String sessionId = trimToNull(System.getProperty("traceboard.sessionId"));
        if (sessionId == null || !SESSION_ID.matcher(sessionId).matches()) {
            sessionId = DEFAULT_SESSION_ID;
        }
        String traceId = trimToNull(System.getProperty("traceboard.traceId"));
        if (traceId != null && !TRACE_ID.matcher(traceId).matches()) {
            traceId = null;
        }
        return new AgentConfig(true, url, sessionId, traceId);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    boolean isEnabled() {
        return enabled;
    }

    String ingestUrl() {
        return ingestUrl;
    }

    String sessionId() {
        return sessionId;
    }

    String traceId() {
        return traceId;
    }
}
