package io.traceboard.agent;

import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.util.List;
import java.util.regex.Pattern;

/**
 * S5 L1 value formatting: redact first, then truncate, then budget (event-model.v1.md §4.4,
 * s5-plan.md §5.5). Only {@code String}/{@code number} scalars are captured; objects, arrays,
 * {@code null}, {@code NaN} and infinities are skipped and counted as {@code L1_SKIPPED=<n>}
 * (never dropped silently). No local variables, no objects, no line numbers: that is S6/L2.
 */
final class L1Values {

    /** Single string value cap (UTF-8 bytes, truncated on code-point boundaries). */
    static final int MAX_STRING_BYTES = 2048;
    /** Per-span value item cap; the demo uses exactly 5. */
    static final int MAX_ITEMS = 30;
    /** Conservative values-array byte budget (collector line cap is 64KB incl. the rest of the line). */
    private static final int MAX_VALUES_JSON_BYTES = 60 * 1024;

    private static final Charset UTF_8 = Charset.forName("UTF-8");
    private static final Pattern SENSITIVE_NAME = Pattern.compile(
            "(?i).*(password|token|secret|authorization|cookie|idcard|phone|email|bankcard).*");

    private L1Values() {
    }

    /** Case-insensitive "name contains" rule (event-model.v1.md §4.4.2). */
    static boolean isSensitiveName(String name) {
        try {
            return name != null && SENSITIVE_NAME.matcher(name).matches();
        } catch (Throwable ignored) {
            return false;
        }
    }

    static boolean isFinite(double value) {
        return !Double.isNaN(value) && !Double.isInfinite(value);
    }

    /** Integer-valued doubles without a decimal point (100.0 -> "100", 0.0 -> "0"). */
    static String formatDouble(double value) {
        try {
            if (value == 0.0d) {
                return "0";
            }
            return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
        } catch (Throwable ignored) {
            return Double.toString(value);
        }
    }

    /** One {@code values[]} entry, fixed fields name/kind/line/from/to/truncated/redacted. */
    static final class Item {
        final String name;
        final String kind;
        final String fromJson;
        final String toJson;
        final boolean truncated;
        final boolean redacted;

        Item(String name, String kind, String fromJson, String toJson,
             boolean truncated, boolean redacted) {
            this.name = name;
            this.kind = kind;
            this.fromJson = fromJson;
            this.toJson = toJson;
            this.truncated = truncated;
            this.redacted = redacted;
        }

        void appendTo(StringBuilder json) {
            json.append('{');
            json.append("\"name\":").append(SpanEmitter.quote(name)).append(',');
            json.append("\"kind\":").append(SpanEmitter.quote(kind)).append(',');
            json.append("\"line\":null,");
            json.append("\"from\":").append(fromJson == null ? "null" : fromJson).append(',');
            json.append("\"to\":").append(toJson).append(',');
            json.append("\"truncated\":").append(truncated).append(',');
            json.append("\"redacted\":").append(redacted);
            json.append('}');
        }
    }

    // ------------------------------------------------------------------ item factories

    /** @return false when skipped (non-finite); the caller counts {@code L1_SKIPPED}. */
    static boolean appendParam(SpanContext.Frame frame, String name, double value) {
        if (!isFinite(value)) {
            return false;
        }
        frame.values.add(new Item(name, "param", null, formatDouble(value), false, false));
        return true;
    }

    /** @return false when skipped ({@code null}); the caller counts {@code L1_SKIPPED}. */
    static boolean appendParam(SpanContext.Frame frame, String name, String value) {
        if (value == null) {
            return false;
        }
        if (isSensitiveName(name)) {
            // Redaction first: the original value never appears in any event field.
            String placeholder = "[REDACTED len=" + utf8Length(value) + "]";
            frame.values.add(new Item(name, "param", null, SpanEmitter.quote(placeholder), false, true));
            return true;
        }
        String truncatedValue = truncate(value);
        frame.values.add(new Item(name, "param", null, SpanEmitter.quote(truncatedValue),
                !truncatedValue.equals(value), false));
        return true;
    }

    /** @return false when skipped (non-finite); the caller counts {@code L1_SKIPPED}. */
    static boolean appendReturn(SpanContext.Frame frame, double value) {
        if (!isFinite(value)) {
            return false;
        }
        frame.values.add(new Item("return", "return", null, formatDouble(value), false, false));
        return true;
    }

    /** @return false when skipped (non-finite); the caller counts {@code L1_SKIPPED}. */
    static boolean appendField(SpanContext.Frame frame, String name, double oldValue, double newValue) {
        if (!isFinite(oldValue) || !isFinite(newValue)) {
            return false;
        }
        if (isSensitiveName(name)) {
            frame.values.add(new Item(name, "field",
                    SpanEmitter.quote("[REDACTED len=" + utf8Length(formatDouble(oldValue)) + "]"),
                    SpanEmitter.quote("[REDACTED len=" + utf8Length(formatDouble(newValue)) + "]"),
                    false, true));
            return true;
        }
        frame.values.add(new Item(name, "field", formatDouble(oldValue), formatDouble(newValue),
                false, false));
        return true;
    }

    // ------------------------------------------------------------------ assembly

    /**
     * Serializes the frame values (order = params -> field writes -> return) and appends
     * {@code L1_SKIPPED=<n>}/{@code VALUES_CAPPED=<n>} to the frame flags when anything was
     * skipped or dropped. Returns {@code null} when the span has no value facts (the whole
     * {@code values} key is then omitted, keeping S2-S4 event bytes intact).
     */
    static String toValuesJson(SpanContext.Frame frame) {
        List<Item> items = frame.values;
        int dropped = 0;
        if (items.size() > MAX_ITEMS) {
            dropped += items.size() - MAX_ITEMS;
            while (items.size() > MAX_ITEMS) {
                items.remove(items.size() - 1);
            }
        }
        String json = build(items);
        while (!items.isEmpty() && json.getBytes(UTF_8).length > MAX_VALUES_JSON_BYTES) {
            items.remove(items.size() - 1);
            dropped++;
            json = build(items);
        }
        if (frame.skipped > 0) {
            frame.extraFlags.add("L1_SKIPPED=" + frame.skipped);
        }
        if (dropped > 0) {
            frame.extraFlags.add("VALUES_CAPPED=" + dropped);
        }
        return items.isEmpty() ? null : json;
    }

    private static String build(List<Item> items) {
        StringBuilder json = new StringBuilder(256);
        json.append('[');
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) {
                json.append(',');
            }
            items.get(i).appendTo(json);
        }
        return json.append(']').toString();
    }

    // ------------------------------------------------------------------ truncation

    /** Truncates to at most 2048 UTF-8 bytes on a code-point boundary; never appends an ellipsis. */
    static String truncate(String value) {
        if (value.getBytes(UTF_8).length <= MAX_STRING_BYTES) {
            return value;
        }
        int total = 0;
        int end = 0;
        while (end < value.length()) {
            int codePoint = value.codePointAt(end);
            int len = utf8Length(codePoint);
            if (total + len > MAX_STRING_BYTES) {
                break;
            }
            total += len;
            end += Character.charCount(codePoint);
        }
        return value.substring(0, end);
    }

    private static int utf8Length(String value) {
        return value.getBytes(UTF_8).length;
    }

    private static int utf8Length(int codePoint) {
        if (codePoint < 0x80) {
            return 1;
        }
        if (codePoint < 0x800) {
            return 2;
        }
        if (codePoint < 0x10000) {
            return 3;
        }
        return 4;
    }
}