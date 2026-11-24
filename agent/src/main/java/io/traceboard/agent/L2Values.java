package io.traceboard.agent;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/**
 * S6a/S6b L2 value facts: one {@code values[]} item per observed local variable value
 * (event-model.v1.md 4.4.7 / 4.4.10, api.v1.md 10.10 / 10.11).
 *
 * <p>Unlike the S5 {@link L1Values} items these carry {@code line} and {@code invocation}; the
 * {@code kind} is always {@code local} and no {@code param}/{@code field}/{@code return} item is
 * ever produced (the method result travels in the event {@code return} field). Numbers are integer
 * formatted without a decimal point (100 / 0).</p>
 *
 * <p>S6b folding: at most {@link #MAX_ITEMS} (20) items are retained per span. Above the budget the
 * list is folded as first 6 + last 6 + uniform middle samples (8 slots, only when the source list is
 * longer than 20); the FIRST bad value ({@code from != null && to == 0}) is always retained by
 * replacing the middle sample closest to it. Retained items keep their original observation order
 * and their {@code from}/{@code to}/{@code line} verbatim (never spliced/smoothed); every retained
 * item stays {@code truncated=false}. The caller emits {@code status=TRUNCATED} plus
 * {@code VALUES_CAPPED=<dropped>} / {@code VALUES_TOTAL=<total>} so nothing is dropped silently.</p>
 */
final class L2Values {

    /** The only value kind allowed on a span carrying the {@code L2} flag. */
    static final String KIND_LOCAL = "local";
    /** Fixed name of the instrumented demo local (matched in the local variable table). */
    static final String NAME_LOCAL = "local";

    /** S6b per-span item cap (stricter than the S5 30-item budget, which stays untouched). */
    static final int MAX_ITEMS = 20;
    /** Head/tail budget kept verbatim before/after sampling the middle. */
    private static final int EDGE_ITEMS = 6;

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

        /** S6b: first "bad" value ({@code from} non-null and {@code to=0}) wins retention. */
        boolean isBadValue() {
            return fromJson != null && "0".equals(toJson);
        }

        void appendTo(StringBuilder json) {
            json.append('{');
            json.append("\"name\":").append(SpanEmitter.quote(name)).append(',');
            json.append("\"kind\":").append(SpanEmitter.quote(kind)).append(',');
            json.append("\"line\":").append(line).append(',');
            json.append("\"from\":").append(fromJson == null ? "null" : fromJson).append(',');
            json.append("\"to\":").append(toJson).append(',');
            // S6b: folding is list-level; the retained VALUE is not truncated.
            json.append("\"truncated\":false,");
            json.append("\"redacted\":false,");
            json.append("\"invocation\":").append(invocation);
            json.append('}');
        }
    }

    /** Folded serialization result: JSON array, pre-fold total, dropped count, fold flag. */
    static final class Fold {
        final String json;
        final int total;
        final int dropped;
        final boolean folded;

        Fold(String json, int total, int dropped, boolean folded) {
            this.json = json;
            this.total = total;
            this.dropped = dropped;
            this.folded = folded;
        }
    }

    /**
     * Serializes the frame's L2 items in probe execution order, folding above {@link #MAX_ITEMS}.
     * Returns a Fold with {@code json == null} when the span has no item at all (the {@code values}
     * key is then omitted), otherwise {@code json} is the array to emit.
     */
    static Fold fold(SpanContext.Frame frame) {
        List<Item> items = frame.l2Values;
        int total = items.size();
        if (total == 0) {
            return new Fold(null, 0, 0, false);
        }
        if (total <= MAX_ITEMS) {
            return new Fold(serialize(items, allIndices(total)), total, 0, false);
        }
        TreeSet<Integer> keep = selectIndices(items, total);
        return new Fold(serialize(items, keep), total, total - MAX_ITEMS, true);
    }

    /**
     * First 6 + last 6 + uniformly spaced middle samples to fill {@link #MAX_ITEMS}; the first bad
     * value is inserted by replacing the middle sample closest to it. Result is ascending (original
     * observation order).
     */
    private static TreeSet<Integer> selectIndices(List<Item> items, int total) {
        TreeSet<Integer> keep = new TreeSet<Integer>();
        for (int i = 0; i < EDGE_ITEMS; i++) {
            keep.add(Integer.valueOf(i));
        }
        for (int i = total - EDGE_ITEMS; i < total; i++) {
            keep.add(Integer.valueOf(i));
        }
        int middleStart = EDGE_ITEMS;
        int middleEnd = total - EDGE_ITEMS;
        int middleCount = middleEnd - middleStart;
        int samples = MAX_ITEMS - 2 * EDGE_ITEMS;
        List<Integer> middleSelected = new ArrayList<Integer>();
        for (int k = 0; k < samples; k++) {
            // Centre of each of the "samples" equal buckets (integer math, never out of range).
            int index = middleStart + (int) (((2L * k + 1L) * (long) middleCount) / (2L * samples));
            if (index >= middleEnd) {
                index = middleEnd - 1;
            }
            if (middleSelected.contains(Integer.valueOf(index))) {
                continue;
            }
            middleSelected.add(Integer.valueOf(index));
        }
        Integer bad = firstBadIndex(items, total);
        if (bad != null && !middleSelected.contains(bad)) {
            int replaceAt = 0;
            long bestDistance = Long.MAX_VALUE;
            for (int k = 0; k < middleSelected.size(); k++) {
                long distance = Math.abs((long) middleSelected.get(k).intValue() - bad.intValue());
                if (distance < bestDistance) {
                    bestDistance = distance;
                    replaceAt = k;
                }
            }
            if (!middleSelected.isEmpty()) {
                middleSelected.set(replaceAt, bad);
            }
        }
        keep.addAll(middleSelected);
        // Defensive fill: even if sampling collided, exactly MAX_ITEMS distinct indices are kept.
        int cursor = middleStart;
        while (keep.size() > MAX_ITEMS) {
            Integer lastMiddle = null;
            for (Integer index : keep) {
                if (index.intValue() >= middleStart && index.intValue() < middleEnd
                        && !index.equals(bad)) {
                    lastMiddle = index;
                }
            }
            if (lastMiddle == null) {
                break;
            }
            keep.remove(lastMiddle);
        }
        while (keep.size() < MAX_ITEMS && cursor < middleEnd) {
            keep.add(Integer.valueOf(cursor));
            cursor++;
        }
        return keep;
    }

    private static Integer firstBadIndex(List<Item> items, int total) {
        for (int i = 0; i < total; i++) {
            if (items.get(i).isBadValue()) {
                return Integer.valueOf(i);
            }
        }
        return null;
    }

    private static TreeSet<Integer> allIndices(int total) {
        TreeSet<Integer> indices = new TreeSet<Integer>();
        for (int i = 0; i < total; i++) {
            indices.add(Integer.valueOf(i));
        }
        return indices;
    }

    private static String serialize(List<Item> items, TreeSet<Integer> keep) {
        StringBuilder json = new StringBuilder(256);
        json.append('[');
        boolean first = true;
        for (Integer index : keep) {
            if (!first) {
                json.append(',');
            }
            items.get(index.intValue()).appendTo(json);
            first = false;
        }
        return json.append(']').toString();
    }
}