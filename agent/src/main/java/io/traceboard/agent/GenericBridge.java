package io.traceboard.agent;

/**
 * Small additive bridge between the generic agent package ({@code io.traceboard.agent.generic})
 * and the existing package-private infrastructure ({@link EventSender}, {@link AgentHello},
 * {@link TraceAgent#log}, {@link L1Values#isSensitiveName}).
 *
 * <p>The demo path is untouched: this bridge owns its own {@link EventSender} and never enables or
 * reconfigures {@link SpanEmitter}. Every method is fail-open.</p>
 */
public final class GenericBridge {

    private static final Object LOCK = new Object();

    private static volatile EventSender sender;
    private static volatile String sessionId = "s_generic";

    private GenericBridge() {
    }

    /** Creates the bounded sender once (later calls keep the first URL/session). */
    public static void init(String ingestUrl, String sessionIdValue) {
        init(ingestUrl, sessionIdValue, 2048);
    }

    public static void init(String ingestUrl, String sessionIdValue, int capacity) {
        try {
            if (sender != null) {
                return;
            }
            synchronized (LOCK) {
                if (sender != null) {
                    return;
                }
                if (sessionIdValue != null && !sessionIdValue.trim().isEmpty()) {
                    sessionId = sessionIdValue.trim();
                }
                sender = new EventSender(ingestUrl, capacity);
            }
        } catch (Throwable ignored) {
            // fail-open: no sender -> the generic advice still never affects the application
        }
    }

    /** @return true only when the sender exists (otherwise every generic entry point is a noop) */
    public static boolean active() {
        return sender != null;
    }

    public static void offer(byte[] payload) {
        try {
            EventSender current = sender;
            if (current != null) {
                current.offer(payload);
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** Bounded-queue drops so far (included in every span's {@code DROP_COUNT} flag). */
    public static long dropped() {
        try {
            EventSender current = sender;
            return current == null ? 0L : current.droppedCount();
        } catch (Throwable ignored) {
            return 0L;
        }
    }

    public static String sessionId() {
        return sessionId;
    }

    /** Posts the S4 diagnostic handshake (daemon thread, additive overload). */
    public static void hello(String ingestUrl, String sessionIdValue) {
        try {
            AgentHello.start(ingestUrl, sessionIdValue);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    public static void log(String message) {
        try {
            TraceAgent.log(message);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** Name-based redaction rule shared with the demo L1 values. */
    public static boolean isSensitiveName(String name) {
        try {
            return L1Values.isSensitiveName(name);
        } catch (Throwable ignored) {
            return false;
        }
    }
}