package io.traceboard.agent;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Builds ONE schema-valid controller span per instrumented call and hands it to the async sender.
 *
 * <p>Field contract: s1-plan.md §7.3 / fixtures/s1-walking-skeleton/agent-controller-span.json.
 * The span is an <em>isolated backend root</em>: {@code parentSpanId=null}, {@code confidence=LOST},
 * synthetic {@code rootEventId=click_lost_<spanId>}, flags
 * {@code ["SKELETON","S1_ONE_METHOD","LOST_BACKEND"]}. No secrets, no argument values, no
 * exception payload, no values/sideEffects.</p>
 */
public final class SpanEmitter {

    private static final String SCHEMA = "traceboard.event.v1";
    private static final String TARGET_CLASS = "com.example.shop.controller.OrderController";
    private static final String TARGET_FILE = "OrderController.java";
    private static final String NODE_KEY = "com.example.shop.controller.OrderController#cancel";
    private static final String KIND = "controller";
    private static final int MAX_RETURN_TYPE_CHARS = 64;

    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile boolean enabled;
    private static String sessionId = AgentConfig.DEFAULT_SESSION_ID;
    private static String fixedTraceId;
    private static long premainNanos;
    private static EventSender sender;

    private SpanEmitter() {
    }

    /**
     * Called once from premain. Any failure keeps the emitter disabled (fail-open).
     */
    static void init(AgentConfig config) {
        premainNanos = System.nanoTime();
        sessionId = config.sessionId();
        fixedTraceId = config.traceId();
        sender = new EventSender(config.ingestUrl());
        enabled = true;
    }

    /**
     * Called from the inlined advice on method exit. NEVER throws and never blocks the request
     * beyond a bounded queue offer.
     */
    public static void emit(long enterNs, Object returned, Throwable thrown) {
        try {
            if (!enabled) {
                return;
            }
            long exitNs = System.nanoTime();
            long startNs = enterNs - premainNanos;
            if (startNs < 0L) {
                startNs = 0L;
            }
            long durNs = exitNs - enterNs;
            if (durNs < 0L) {
                durNs = 0L;
            }
            String spanId = randomHex(8);
            String traceId = (fixedTraceId != null) ? fixedTraceId : randomHex(16);
            Thread thread = Thread.currentThread();

            StringBuilder json = new StringBuilder(512);
            json.append('{');
            appendStringField(json, "schema", SCHEMA).append(',');
            appendStringField(json, "type", "span").append(',');
            appendStringField(json, "sessionId", sessionId).append(',');
            appendStringField(json, "traceId", traceId).append(',');
            appendStringField(json, "spanId", spanId).append(',');
            json.append("\"parentSpanId\":null,");
            appendStringField(json, "rootEventId", "click_lost_" + spanId).append(',');
            appendStringField(json, "kind", KIND).append(',');
            appendStringField(json, "nodeKey", NODE_KEY).append(',');

            StackTraceElement frame = findTargetFrame();
            if (frame != null) {
                String file = frame.getFileName();
                int line = frame.getLineNumber();
                if (file == null) {
                    file = TARGET_FILE;
                }
                if (line >= 0) {
                    json.append("\"source\":{");
                    appendStringField(json, "file", file).append(',');
                    json.append("\"line\":").append(line).append("},");
                }
            }

            json.append("\"thread\":{\"id\":").append(thread.getId()).append(',');
            appendStringField(json, "name", thread.getName()).append("},");
            json.append("\"startNs\":").append(startNs).append(',');
            json.append("\"durNs\":").append(durNs).append(',');
            appendStringField(json, "status", (thrown == null) ? "OK" : "THREW").append(',');
            if (thrown == null) {
                String type = (returned == null) ? "void" : returned.getClass().getName();
                json.append("\"return\":{\"type\":");
                appendQuoted(json, truncate(type)).append(",\"value\":null},");
            } else {
                json.append("\"return\":null,");
            }
            appendStringField(json, "confidence", "LOST").append(',');
            json.append("\"flags\":[\"SKELETON\",\"S1_ONE_METHOD\",\"LOST_BACKEND\"]");
            json.append("}\n");

            byte[] payload = json.toString().getBytes("UTF-8");
            if (payload.length == 0 || payload[payload.length - 1] != (byte) '\n') {
                return;
            }
            sender.offer(payload);
        } catch (Throwable ignored) {
            // fail-open: an agent bug must never affect the demo request
        }
    }

    /**
     * @return the exit-point stack frame of the instrumented class, or {@code null}
     */
    private static StackTraceElement findTargetFrame() {
        try {
            StackTraceElement[] frames = new Throwable().getStackTrace();
            for (StackTraceElement frame : frames) {
                if (TARGET_CLASS.equals(frame.getClassName())) {
                    return frame;
                }
            }
        } catch (Throwable ignored) {
            // source is optional
        }
        return null;
    }

    private static String truncate(String value) {
        return value.length() <= MAX_RETURN_TYPE_CHARS ? value : value.substring(0, MAX_RETURN_TYPE_CHARS);
    }

    private static StringBuilder appendStringField(StringBuilder json, String name, String value) {
        json.append('"').append(name).append("\":");
        return appendQuoted(json, value);
    }

    private static StringBuilder appendQuoted(StringBuilder json, String value) {
        json.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    json.append("\\\"");
                    break;
                case '\\':
                    json.append("\\\\");
                    break;
                case '\n':
                    json.append("\\n");
                    break;
                case '\r':
                    json.append("\\r");
                    break;
                case '\t':
                    json.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        json.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    } else {
                        json.append(c);
                    }
            }
        }
        return json.append('"');
    }

    private static String randomHex(int byteCount) {
        byte[] bytes = new byte[byteCount];
        RANDOM.nextBytes(bytes);
        StringBuilder hex = new StringBuilder(byteCount * 2);
        for (byte b : bytes) {
            hex.append(Character.forDigit((b >> 4) & 0xF, 16));
            hex.append(Character.forDigit(b & 0xF, 16));
        }
        return hex.toString();
    }
}
