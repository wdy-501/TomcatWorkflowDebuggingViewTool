package io.traceboard.agent;

import java.util.List;

/**
 * S6a L2 value facts: one {@code values[]} item per observed local variable value
 * (event-model.v1.md 4.4.7, api.v1.md 10.10).
 *
 * <p>Unlike the S5 {@link L1Values} items these carry {@code line} and {@code invocation}; the
 * {@code kind} is always {@code local} and no {@code param}/{@code field}/{@code return} item is
 * ever produced (the method result travels in the event {@code return} field). Numbers are integer
 * formatted without a decimal point (100 / 0). Bounded by the same 30-item budget as S5; a breach
 * is reported as {@code VALUES_CAPPED=<n>} instead of being dropped silently.</p>
 */
final class L2Values {

    /** The only value kind allowed on a span carrying the {@code L2} flag. */
    static final String KIND_LOCAL = "local";
    /** Fixed name of the instrumented demo local (matched in the local variable table). */
    static final String NAME_LOCAL = "local";

    /** Same per-span item cap as S5 (the demo emits at most 2). */
    static final int MAX_ITEMS = 30;

    private L2Values() {
    }

    /** One {@code values[]} entry: name, kind, line, from, to, truncated, redacted, invocation. */
    static final class Item {
        final String name;
        final String kind;
        final int line;
        final String fromJson;
        final String toJson;
        final int invocation;

        Item(String name, String kind, int line, String fromJson, String toJson, int invocation) {
            this.name = name;
            this.kind = kind;
            this.line = line;
            this.fromJson = fromJson;
            this.toJson = toJson;
            this.invocation = invocation;
        }

        void appendTo(StringBuilder json) {
            json.append('{');
            json.append("\"name\":").append(SpanEmitter.quote(name)).append(',');
            json.append("\"kind\":").append(SpanEmitter.quote(kind)).append(',');
            json.append("\"line\":").append(line).append(',');
            json.append("\"from\":").append(fromJson == null ? "null" : fromJson).append(',');
            json.append("\"to\":").append(toJson).append(',');
            json.append("\"truncated\":false,");
            json.append("\"redacted\":false,");
            json.append("\"invocation\":").append(invocation);
            json.append('}');
        }
    }

    /**
     * Serializes the frame's L2 items in probe execution order. Returns {@code null} when the span
     * has no item at all (the {@code values} key is then omitted).
     */
    static String toValuesJson(SpanContext.Frame frame) {
        List<Item> items = frame.l2Values;
        int dropped = 0;
        if (items.size() > MAX_ITEMS) {
            dropped += items.size() - MAX_ITEMS;
            while (items.size() > MAX_ITEMS) {
                items.remove(items.size() - 1);
            }
        }
        if (dropped > 0) {
            frame.extraFlags.add("VALUES_CAPPED=" + dropped);
        }
        if (items.isEmpty()) {
            return null;
        }
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
}