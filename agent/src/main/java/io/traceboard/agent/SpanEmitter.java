package io.traceboard.agent;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Builds ONE schema-valid span event per instrumented call and hands it to the async sender.
 *
 * <p>Field contract: s2-plan.md 7.3/7.4 and fixtures/s2-zero-row-chain/events.ndjson.
 * Runtime chain (S2): controller root (isolated backend request: {@code parentSpanId=null},
 * {@code confidence=LOST}, {@code rootEventId=click_lost_<spanId>}, flags
 * {@code S2_ZERO_ROW_CHAIN} + {@code LOST_BACKEND}) with service/mapper/sql children that inherit
 * the trace, root event and {@code LOST} confidence. No secrets, no argument values, no exception
 * payload, no {@code values[]}.</p>
 */
public final class SpanEmitter {

    static final String SCHEMA = "traceboard.event.v1";
    static final String FLAG_CHAIN = "S2_ZERO_ROW_CHAIN";
    static final String FLAG_LOST_BACKEND = "LOST_BACKEND";

    private static final String CONFIDENCE_LOST = "LOST";
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

    static boolean isEnabled() {
        return enabled;
    }

    static long premainNanos() {
        return premainNanos;
    }

    static String fixedTraceId() {
        return fixedTraceId;
    }

    /**
     * Formats the span and enqueues it. NEVER throws and never blocks the request beyond a
     * bounded queue offer.
     *
     * @param returnType         {@code return.type}; {@code null} emits {@code "return":null}
     * @param returnValueJson    pre-formatted JSON value (e.g. {@code 200}, {@code true}, {@code null})
     * @param sideEffectsJson    pre-formatted JSON array, or {@code null} to omit the field
     * @param source             real stack frame of the instrumented class, or {@code null}
     */
    static void emit(SpanContext.Frame frame, long durNs, String status, String returnType,
                     String returnValueJson, String sideEffectsJson, StackTraceElement source) {
        try {
            if (!enabled || frame == null || frame.traceId == null) {
                return;
            }
            Thread thread = Thread.currentThread();

            StringBuilder json = new StringBuilder(512);
            json.append('{');
            appendStringField(json, "schema", SCHEMA).append(',');
            appendStringField(json, "type", "span").append(',');
            appendStringField(json, "sessionId", sessionId).append(',');
            appendStringField(json, "traceId", frame.traceId).append(',');
            appendStringField(json, "spanId", frame.spanId).append(',');
            if (frame.parentSpanId == null) {
                json.append("\"parentSpanId\":null,");
            } else {
                appendStringField(json, "parentSpanId", frame.parentSpanId).append(',');
            }
            appendStringField(json, "rootEventId", frame.rootEventId).append(',');
            appendStringField(json, "kind", frame.kind).append(',');
            appendStringField(json, "nodeKey", frame.nodeKey).append(',');

            if (source != null && source.getFileName() != null) {
                json.append("\"source\":{");
                appendStringField(json, "file", source.getFileName()).append(',');
                int line = source.getLineNumber();
                json.append("\"line\":").append(line >= 0 ? String.valueOf(line) : "null").append("},");
            }

            json.append("\"thread\":{\"id\":").append(thread.getId()).append(',');
            appendStringField(json, "name", thread.getName()).append("},");
            json.append("\"startNs\":").append(frame.startNs).append(',');
            json.append("\"durNs\":").append(durNs < 0L ? 0L : durNs).append(',');
            appendStringField(json, "status", status).append(',');

            if (returnType == null || returnValueJson == null) {
                json.append("\"return\":null,");
            } else {
                json.append("\"return\":{\"type\":");
                appendQuoted(json, truncate(returnType));
                json.append(",\"value\":").append(returnValueJson).append("},");
            }
            if (sideEffectsJson != null) {
                json.append("\"sideEffects\":").append(sideEffectsJson).append(',');
            }

            appendStringField(json, "confidence", CONFIDENCE_LOST).append(',');
            json.append("\"flags\":[");
            appendQuoted(json, FLAG_CHAIN);
            if (frame.root) {
                json.append(',');
                appendQuoted(json, FLAG_LOST_BACKEND);
            }
            json.append(',');
            appendQuoted(json, "DROP_COUNT=" + senderDropped());
            json.append(']');
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

    private static long senderDropped() {
        try {
            return (sender == null) ? 0L : sender.droppedCount();
        } catch (Throwable ignored) {
            return 0L;
        }
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

    static String randomHex(int byteCount) {
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
