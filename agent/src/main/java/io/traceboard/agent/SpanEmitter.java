package io.traceboard.agent;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Builds ONE schema-valid span event per instrumented call and hands it to the async sender.
 *
 * <p>Field contract: s2-plan.md 7.3/7.4, event-model.v1.md §12.4 and
 * fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson. Runtime chain (S3): when the
 * controller reads valid {@code traceparent}/{@code X-TraceBoard-Click} headers it adopts the
 * frontend trace ({@code traceId}/{@code parentSpanId}/rootEventId=clickId}, {@code confidence=EXACT},
 * flag {@code S3_EXACT_LINK}, no {@code LOST_BACKEND}); without headers the S2 isolated backend root
 * is emitted verbatim ({@code parentSpanId=null}, {@code confidence=LOST}, {@code rootEventId=click_lost_<spanId>},
 * flags {@code S2_ZERO_ROW_CHAIN} + {@code LOST_BACKEND}). Children inherit trace/root/confidence.
 * S5 adds L1 {@code values[]} (params / field writes / return, redacted and truncated) on the
 * {@code OrderService#previewDiscount} service span only; spans without value facts omit the key.
 * No secrets (only {@code [REDACTED len=N]} placeholders), no local variables, no objects.</p>
 */
public final class SpanEmitter {

    static final String SCHEMA = "traceboard.event.v1";
    static final String FLAG_CHAIN = "S2_ZERO_ROW_CHAIN";
    static final String FLAG_LOST_BACKEND = "LOST_BACKEND";
    static final String FLAG_EXACT_LINK = "S3_EXACT_LINK";
    static final String FLAG_L1 = "L1";
    /** S6a: span was collected with line-level probes (only {@code L2DemoService#reconcileAmount}). */
    static final String FLAG_L2 = "L2";
    /** S6b: the context came from an inherited parent frame on a different (new) thread. */
    static final String FLAG_ASYNC_INHERITED = "ASYNC_INHERITED";
    /** S6b: the instrumented method has no {@code LocalVariableTable} (no values / line numbers). */
    static final String FLAG_NO_DEBUG_INFO = "NO_DEBUG_INFO";
    /** S6b: folded list counts (both are appended together, never one without the other). */
    static final String FLAG_VALUES_CAPPED = "VALUES_CAPPED";
    static final String FLAG_VALUES_TOTAL = "VALUES_TOTAL";

    private static final int MAX_RETURN_TYPE_CHARS = 64;

    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile boolean enabled;
    private static String sessionId = AgentConfig.DEFAULT_SESSION_ID;
    private static String fixedTraceId;
    private static EventSender sender;

    /**
     * Clock anchor (see {@link #epochNanos()}). Captured once at premain; wall-clock milliseconds
     * plus the monotonic {@code System.nanoTime()} delta.
     */
    private static volatile long clockBaseMillis;
    private static volatile long clockBaseNanos;

    private SpanEmitter() {
    }

    /**
     * Called once from premain. Any failure keeps the emitter disabled (fail-open).
     */
    static void init(AgentConfig config) {
        clockBaseNanos = System.nanoTime();
        clockBaseMillis = System.currentTimeMillis();
        sessionId = config.sessionId();
        fixedTraceId = config.traceId();
        sender = new EventSender(config.ingestUrl());
        enabled = true;
    }

    static boolean isEnabled() {
        return enabled;
    }

    /**
     * S3 clock (event-model.v1.md §12.10 intent: epoch nanoseconds on one machine, monotonic
     * within the process, durations from the monotonic delta).
     *
     * <p>Deviation recorded for S3: the literal formula
     * {@code currentTimeMillis()*1e6 + nanoTime()%1e6} is not monotonic on JDK8/Windows because
     * {@code currentTimeMillis()} only advances every ~2 ms here while the nanosecond remainder
     * wraps every 1 ms (measured: a mapper start landed 434 us before its controller start).
     * The anchor keeps the same wall-clock epoch and the same monotonic sub-millisecond part but
     * derives the latter from the elapsed {@code nanoTime} delta, so parent/child ordering and
     * interval containment hold. No NTP/offset correction; single machine only.</p>
     */
    static long epochNanos() {
        return epochNanosFrom(System.nanoTime());
    }

    /**
     * Converts an advice-captured {@link System#nanoTime()} reading to the shared epoch-ns clock.
     * Span start and duration must use the same reading, otherwise cold-start delays inside
     * {@code SpanContext.enter} can make a child appear to end after its parent.
     */
    static long epochNanosFrom(long nanoTime) {
        long baseMillis = clockBaseMillis;
        long baseNanos = clockBaseNanos;
        if (baseMillis == 0L || baseNanos == 0L) {
            synchronized (SpanEmitter.class) {
                if (clockBaseMillis == 0L || clockBaseNanos == 0L) {
                    clockBaseNanos = System.nanoTime();
                    clockBaseMillis = System.currentTimeMillis();
                }
                baseMillis = clockBaseMillis;
                baseNanos = clockBaseNanos;
            }
        }
        return baseMillis * 1_000_000L + (nanoTime - baseNanos);
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
     * @param valuesJson         pre-formatted S5 {@code values} array, or {@code null} to omit the field
     */
    static void emit(SpanContext.Frame frame, long durNs, String status, String returnType,
                     String returnValueJson, String sideEffectsJson, StackTraceElement source) {
        emit(frame, durNs, status, returnType, returnValueJson, sideEffectsJson, source, null, null);
    }

    /** S5/S6b: same as above with a pre-formatted {@code values} array (no reason). */
    static void emit(SpanContext.Frame frame, long durNs, String status, String returnType,
                     String returnValueJson, String sideEffectsJson, StackTraceElement source,
                     String valuesJson) {
        emit(frame, durNs, status, returnType, returnValueJson, sideEffectsJson, source, valuesJson, null);
    }

    /**
     * S6b: emits with an optional {@code reason} (required by the schema for {@code NOT_COLLECTED_*}
     * statuses, e.g. {@code LocalVariableTable missing}); {@code null} omits the field.
     */
    static void emit(SpanContext.Frame frame, long durNs, String status, String returnType,
                     String returnValueJson, String sideEffectsJson, StackTraceElement source,
                     String valuesJson, String reason) {
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
            if (reason != null) {
                appendStringField(json, "reason", reason).append(',');
            }

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

            String confidence = (frame.confidence != null)
                    ? frame.confidence : SpanContext.CONFIDENCE_LOST;
            appendStringField(json, "confidence", confidence).append(',');
            json.append("\"flags\":[");
            if (frame.exactLink) {
                appendQuoted(json, FLAG_EXACT_LINK);
                json.append(',');
            }
            appendQuoted(json, FLAG_CHAIN);
            if (frame.root) {
                json.append(',');
                appendQuoted(json, FLAG_LOST_BACKEND);
            }
            // S5/S6b extra flags (L1 / L2 / ASYNC_INHERITED / NO_DEBUG_INFO / VALUES_*=<n>);
            // empty for S2-S4 spans.
            for (String extraFlag : frame.extraFlags) {
                json.append(',');
                appendQuoted(json, extraFlag);
            }
            json.append(',');
            appendQuoted(json, "DROP_COUNT=" + senderDropped());
            json.append(']');
            if (valuesJson != null) {
                // S5/S6b: omitted entirely when the span has no value facts (S2-S4 byte
                // compatibility and the S6b no-debug contract "values key absent").
                json.append(",\"values\":").append(valuesJson);
            }
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

    static String quote(String value) {
        if (value == null) {
            return "null";
        }
        return appendQuoted(new StringBuilder(value.length() + 2), value).toString();
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
