package io.traceboard.agent.generic;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

import io.traceboard.agent.GenericBridge;

/**
 * Writes schema-compatible {@code traceboard.event.v1} span events for the generic mode through
 * the bounded {@link io.traceboard.agent.GenericBridge} sender.
 *
 * <p>Every event carries the frozen required fields plus {@code GENERIC}-prefixed flags, {@code
 * ARGS_CAPPED/RETURN_TRUNCATED/VALUES_CAPPED/EXCEPTION/SQL_*} facts and a final {@code
 * DROP_COUNT=n}. Value arrays are pre-rendered by {@link GenericValues}; SQL facts carry a real
 * {@code rowsAffected} only for updates. Nothing is emitted for a span that was dropped by the
 * per-trace budget, and no local-scope span is ever produced.</p>
 */
final class GenericEmitter {

    static final String SCHEMA = "traceboard.event.v1";

    private static final int MAX_RETURN_TYPE_CHARS = 64;
    private static final int MAX_FLAG_CHARS = 64;
    private static final int MAX_FLAGS = 32;
    private static final int MAX_SOURCE_FILE_CHARS = 512;
    private static final int MAX_THREAD_NAME_CHARS = 128;
    private static final int MAX_SOURCE_CACHE = 4096;
    private static final StackTraceElement NO_SOURCE = new StackTraceElement("", "", "", -1);

    private static final Map<String, StackTraceElement> SOURCE_CACHE =
            new ConcurrentHashMap<String, StackTraceElement>();

    /** Clock anchor; captured once so parent/child span starts stay ordered on one machine. */
    private static volatile long clockBaseMillis;
    private static volatile long clockBaseNanos;

    private GenericEmitter() {
    }

    static void init() {
        clockBaseNanos = System.nanoTime();
        clockBaseMillis = System.currentTimeMillis();
    }

    static long epochNanosFrom(long nanoTime) {
        long baseMillis = clockBaseMillis;
        long baseNanos = clockBaseNanos;
        if (baseMillis == 0L || baseNanos == 0L) {
            synchronized (GenericEmitter.class) {
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

    static String randomHex(int byteCount) {
        try {
            StringBuilder hex = new StringBuilder(byteCount * 2);
            int emitted = 0;
            while (emitted < byteCount * 2) {
                long random = ThreadLocalRandom.current().nextLong();
                int nibbles = Math.min(16, byteCount * 2 - emitted);
                for (int i = nibbles - 1; i >= 0; i--) {
                    hex.append(Character.forDigit((int) ((random >>> (i * 4)) & 0xFL), 16));
                }
                emitted += nibbles;
            }
            return hex.toString();
        } catch (Throwable ignored) {
            // fail-open: a degenerate id must still be schema-valid
            StringBuilder fallback = new StringBuilder(byteCount * 2);
            for (int i = 0; i < byteCount * 2; i++) {
                fallback.append('0');
            }
            return fallback.toString();
        }
    }

    static void emit(GenericSpanContext.Frame frame, long durNs, String status, String returnType,
                     String returnJson, String sideEffectsJson, String valuesJson) {
        try {
            if (frame == null || frame.traceId == null) {
                return;
            }
            Thread thread = Thread.currentThread();
            StringBuilder json = new StringBuilder(512);
            json.append('{');
            appendStringField(json, "schema", SCHEMA).append(',');
            appendStringField(json, "type", "span").append(',');
            appendStringField(json, "sessionId", GenericBridge.sessionId()).append(',');
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

            StackTraceElement source = findSource(frame.declaringClass, frame.methodName);
            if (source != null && source.getFileName() != null) {
                json.append("\"source\":{");
                appendStringField(json, "file",
                        GenericMeta.truncate(source.getFileName(), MAX_SOURCE_FILE_CHARS)).append(',');
                int line = source.getLineNumber();
                json.append("\"line\":").append(line >= 0 ? String.valueOf(line) : "null").append("},");
            }

            json.append("\"thread\":{\"id\":").append(thread.getId()).append(',');
            appendStringField(json, "name",
                    GenericMeta.truncate(thread.getName(), MAX_THREAD_NAME_CHARS)).append("},");
            json.append("\"startNs\":").append(frame.startNs).append(',');
            json.append("\"durNs\":").append(durNs < 0L ? 0L : durNs).append(',');
            appendStringField(json, "status", status).append(',');

            if (returnType == null || returnJson == null) {
                json.append("\"return\":null,");
            } else {
                json.append("\"return\":{\"type\":");
                json.append(GenericValues.quote(
                        GenericMeta.truncate(returnType, MAX_RETURN_TYPE_CHARS)));
                json.append(",\"value\":").append(returnJson).append("},");
            }
            if (sideEffectsJson != null) {
                json.append("\"sideEffects\":").append(sideEffectsJson).append(',');
            }
            appendStringField(json, "confidence", frame.confidence).append(',');
            json.append("\"flags\":");
            appendFlags(json, frame);
            if (valuesJson != null) {
                json.append(",\"values\":").append(valuesJson);
            }
            json.append("}\n");

            byte[] payload = json.toString().getBytes("UTF-8");
            if (payload.length == 0 || payload[payload.length - 1] != (byte) '\n') {
                return;
            }
            GenericBridge.offer(payload);
        } catch (Throwable ignored) {
            // fail-open: an agent bug must never affect the application
        }
    }

    private static void appendFlags(StringBuilder json, GenericSpanContext.Frame frame) {
        Set<String> flags = new LinkedHashSet<String>();
        try {
            for (String flag : frame.flags) {
                String sanitized = sanitizeFlag(flag);
                if (sanitized != null) {
                    flags.add(sanitized);
                }
            }
            flags.add("DROP_COUNT="
                    + (GenericSpanContext.budgetDropTotal() + GenericBridge.dropped()));
        } catch (Throwable ignored) {
            flags.add("DROP_COUNT=0");
        }
        json.append('[');
        int emitted = 0;
        for (String flag : flags) {
            if (emitted >= MAX_FLAGS) {
                break;
            }
            if (emitted > 0) {
                json.append(',');
            }
            json.append(GenericValues.quote(flag));
            emitted++;
        }
        json.append(']');
    }

    /** Keeps only the flag character set accepted by the schema and caps the length. */
    static String sanitizeFlag(String flag) {
        if (flag == null) {
            return null;
        }
        StringBuilder sanitized = new StringBuilder(Math.min(flag.length(), MAX_FLAG_CHARS));
        for (int i = 0; i < flag.length() && sanitized.length() < MAX_FLAG_CHARS; i++) {
            char c = flag.charAt(i);
            boolean allowed = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
                    || (c >= '0' && c <= '9')
                    || c == '_' || c == '.' || c == ':' || c == '=' || c == '+' || c == '-';
            if (allowed) {
                sanitized.append(c);
            }
        }
        return sanitized.length() == 0 ? null : sanitized.toString();
    }

    private static StackTraceElement findSource(String className, String methodName) {
        try {
            if (className == null || className.isEmpty()) {
                return null;
            }
            String key = className + "|" + (methodName == null ? "" : methodName);
            StackTraceElement cached = SOURCE_CACHE.get(key);
            if (cached != null) {
                return cached == NO_SOURCE ? null : cached;
            }
            StackTraceElement[] frames = new Throwable().getStackTrace();
            for (StackTraceElement candidate : frames) {
                if (className.equals(candidate.getClassName())
                        && (methodName == null || methodName.equals(candidate.getMethodName()))) {
                    if (SOURCE_CACHE.size() > MAX_SOURCE_CACHE) {
                        SOURCE_CACHE.clear();
                    }
                    SOURCE_CACHE.put(key, candidate);
                    return candidate;
                }
            }
            if (SOURCE_CACHE.size() > MAX_SOURCE_CACHE) {
                SOURCE_CACHE.clear();
            }
            SOURCE_CACHE.put(key, NO_SOURCE);
        } catch (Throwable ignored) {
            // source is optional
        }
        return null;
    }

    private static StringBuilder appendStringField(StringBuilder json, String name, String value) {
        json.append('"').append(name).append("\":");
        return json.append(GenericValues.quote(value));
    }
}