package io.traceboard.agent.generic;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import io.traceboard.agent.GenericBridge;

/**
 * Bounded, safe value serializer for the generic mode (parameters and return values only).
 *
 * <p>Only value-like data is rendered: strings (bounded by {@code maxString}), numbers, booleans,
 * characters, enums, date/time types, UUIDs, classes, arrays, collections and maps (first
 * {@code maxCollection} elements as {@code Type[size] [...]} summaries). Application objects are
 * rendered as a shallow bounded field summary without invoking getters or {@code toString()};
 * platform objects and proxies fall back to their type name. Sensitive parameter or field names
 * are redacted before rendering. Every item carries {@code truncated}/{@code redacted}; when the
 * item budget or the JSON byte budget is exceeded the tail is dropped and the span gets
 * {@code ARGS_CAPPED=n} / {@code VALUES_CAPPED=n} - nothing is dropped silently.</p>
 */
final class GenericValues {

    static final String FLAG_ARGS_CAPPED = "ARGS_CAPPED=";
    static final String FLAG_VALUES_CAPPED = "VALUES_CAPPED=";
    static final String FLAG_RETURN_TRUNCATED = "RETURN_TRUNCATED";
    static final String REDACTED_PREFIX = "[REDACTED";

    /** Conservative values-array budget: the collector caps one NDJSON line at 64 KiB. */
    private static final int MAX_VALUES_JSON_BYTES = 48 * 1024;
    private static final int MAX_SCALAR_PREVIEW_CHARS = 96;
    private static final int MAX_NUMBER_LITERAL_CHARS = 40;
    private static final int MAX_BEAN_FIELDS = 12;
    private static final Charset UTF_8 = Charset.forName("UTF-8");

    private GenericValues() {
    }

    /** One {@code values[]} entry; the shape matches the frozen event schema. */
    static final class Item {
        final String name;
        final String kind;
        final String toJson;
        final boolean truncated;
        final boolean redacted;

        Item(String name, String kind, String toJson, boolean truncated, boolean redacted) {
            this.name = name;
            this.kind = kind;
            this.toJson = toJson;
            this.truncated = truncated;
            this.redacted = redacted;
        }

        void appendTo(StringBuilder json) {
            json.append('{');
            json.append("\"name\":").append(quote(name)).append(',');
            json.append("\"kind\":").append(quote(kind)).append(',');
            json.append("\"line\":null,\"from\":null,");
            json.append("\"to\":").append(toJson).append(',');
            json.append("\"truncated\":").append(truncated).append(',');
            json.append("\"redacted\":").append(redacted);
            json.append('}');
        }
    }

    /** Render outcome: JSON literal plus whether a bound clipped the value. */
    private static final class Rendered {
        final String json;
        final boolean truncated;

        Rendered(String json, boolean truncated) {
            this.json = json;
            this.truncated = truncated;
        }
    }

    private static final class State {
        final GenericConfig config;
        boolean truncated;

        State(GenericConfig config) {
            this.config = config;
        }
    }

    // ------------------------------------------------------------------ entry points

    static void appendArgs(GenericSpanContext.Frame frame, Object[] args, GenericMeta.Meta meta,
                           GenericConfig config) {
        try {
            if (frame == null || args == null || args.length == 0) {
                return;
            }
            int max = config.maxValues();
            int argCap = config.captureReturn() ? Math.max(0, max - 1) : max;
            int dropped = 0;
            for (int i = 0; i < args.length; i++) {
                if (frame.values.size() >= argCap) {
                    dropped++;
                    continue;
                }
                String name = parameterName(meta, i);
                append(frame, name, "param", args[i], config);
            }
            if (dropped > 0) {
                frame.flags.add(FLAG_ARGS_CAPPED + dropped);
            }
        } catch (Throwable ignored) {
            // fail-open: value capture never affects the application call
        }
    }

    /**
     * Appends the {@code return} item and returns its JSON literal ({@code null} when the item
     * budget is exhausted, the caller then emits {@code return.value=null}).
     */
    static String appendReturn(GenericSpanContext.Frame frame, Object returned, GenericConfig config) {
        try {
            if (frame == null) {
                return null;
            }
            if (frame.values.size() >= config.maxValues()) {
                frame.flags.add(FLAG_VALUES_CAPPED + 1);
                return null;
            }
            State state = new State(config);
            Rendered rendered = render(returned, state);
            frame.values.add(new Item("return", "return", rendered.json, rendered.truncated, false));
            if (rendered.truncated || state.truncated) {
                frame.flags.add(FLAG_RETURN_TRUNCATED);
            }
            return rendered.json;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static void append(GenericSpanContext.Frame frame, String name, String kind, Object value,
                               GenericConfig config) {
        try {
            if (GenericBridge.isSensitiveName(name)) {
                frame.values.add(new Item(name, kind, quote(redactedPlaceholder(value)), false, true));
                return;
            }
            State state = new State(config);
            Rendered rendered = render(value, state);
            frame.values.add(new Item(name, kind, rendered.json, rendered.truncated, false));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * Builds the {@code values} array and applies the item/byte budgets. Returns {@code null} when
     * there is no value fact (the key is then omitted).
     */
    static String toValuesJson(GenericSpanContext.Frame frame, GenericConfig config) {
        try {
            if (frame == null || frame.values.isEmpty()) {
                return null;
            }
            List<Item> items = frame.values;
            int dropped = 0;
            if (items.size() > config.maxValues()) {
                dropped += items.size() - config.maxValues();
                while (items.size() > config.maxValues()) {
                    items.remove(items.size() - 1);
                }
            }
            String json = build(items);
            while (!items.isEmpty() && json.getBytes(UTF_8).length > MAX_VALUES_JSON_BYTES) {
                items.remove(items.size() - 1);
                dropped++;
                json = build(items);
            }
            if (dropped > 0) {
                frame.flags.add(FLAG_VALUES_CAPPED + dropped);
            }
            return items.isEmpty() ? null : json;
        } catch (Throwable ignored) {
            return null;
        }
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

    private static String parameterName(GenericMeta.Meta meta, int index) {
        String[] names = (meta == null) ? null : meta.parameterNames;
        if (names != null && index < names.length && names[index] != null && !names[index].isEmpty()) {
            return names[index];
        }
        return "arg" + index;
    }

    private static String redactedPlaceholder(Object value) {
        if (value instanceof CharSequence) {
            return REDACTED_PREFIX + " len=" + ((CharSequence) value).length() + "]";
        }
        return REDACTED_PREFIX + "]";
    }

    // ------------------------------------------------------------------ rendering

    private static Rendered render(Object value, State state) {
        try {
            if (value == null) {
                return new Rendered("null", false);
            }
            Class<?> type = value.getClass();
            if (value instanceof CharSequence) {
                return text(((CharSequence) value).toString(), state);
            }
            if (value instanceof Character) {
                return text(value.toString(), state);
            }
            if (value instanceof Boolean) {
                return new Rendered(Boolean.TRUE.equals(value) ? "true" : "false", false);
            }
            if (value instanceof Number) {
                return number((Number) value, state);
            }
            if (type.isEnum()) {
                return text(enumText((Enum<?>) value), state);
            }
            if (value instanceof java.time.temporal.TemporalAccessor
                    || value instanceof java.time.Duration
                    || value instanceof java.time.Period) {
                return text(value.toString(), state);
            }
            if (value instanceof java.util.Date) {
                return text(value.toString(), state);
            }
            if (value instanceof java.util.Calendar) {
                java.util.Date date = ((java.util.Calendar) value).getTime();
                return text(date == null ? "calendar" : date.toString(), state);
            }
            if (value instanceof UUID) {
                return text(value.toString(), state);
            }
            if (value instanceof Class) {
                return text("class " + ((Class<?>) value).getName(), state);
            }
            if (value instanceof Optional) {
                Optional<?> optional = (Optional<?>) value;
                if (!optional.isPresent()) {
                    return new Rendered(quote("Optional.empty"), false);
                }
                Rendered inner = render(optional.get(), state);
                return new Rendered(inner.json, inner.truncated);
            }
            if (type.isArray()) {
                return array(value, type, state);
            }
            if (value instanceof Collection) {
                return collection((Collection<?>) value, state);
            }
            if (value instanceof Map) {
                return map((Map<?, ?>) value, state);
            }
            return bean(value, type, state);
        } catch (Throwable ignored) {
            return new Rendered(quote("[unreadable]"), true);
        }
    }

    private static Rendered text(String value, State state) {
        String text = value == null ? "" : value;
        String truncatedText = truncateChars(text, state.config.maxString());
        boolean truncated = truncatedText.length() < text.length();
        if (truncated) {
            state.truncated = true;
        }
        return new Rendered(quote(truncatedText), truncated);
    }

    private static Rendered number(Number value, State state) {
        try {
            if (value instanceof Double) {
                double number = value.doubleValue();
                if (Double.isNaN(number)) {
                    return new Rendered(quote("NaN"), false);
                }
                if (Double.isInfinite(number)) {
                    return new Rendered(quote(number > 0 ? "Infinity" : "-Infinity"), false);
                }
                return new Rendered(Double.toString(number), false);
            }
            if (value instanceof Float) {
                float number = value.floatValue();
                if (Float.isNaN(number)) {
                    return new Rendered(quote("NaN"), false);
                }
                if (Float.isInfinite(number)) {
                    return new Rendered(quote(number > 0 ? "Infinity" : "-Infinity"), false);
                }
                return new Rendered(Float.toString(number), false);
            }
            if (value instanceof BigDecimal) {
                String plain = ((BigDecimal) value).toPlainString();
                if (plain.length() > MAX_NUMBER_LITERAL_CHARS) {
                    state.truncated = true;
                    return new Rendered(quote(truncateChars(plain, MAX_NUMBER_LITERAL_CHARS)), true);
                }
                return new Rendered(plain, false);
            }
            if (value instanceof BigInteger) {
                String digits = value.toString();
                if (digits.length() > MAX_NUMBER_LITERAL_CHARS) {
                    state.truncated = true;
                    return new Rendered(quote(truncateChars(digits, MAX_NUMBER_LITERAL_CHARS)), true);
                }
                return new Rendered(digits, false);
            }
            if (value instanceof Long || value instanceof Integer
                    || value instanceof Short || value instanceof Byte) {
                return new Rendered(value.toString(), false);
            }
            double fallback = value.doubleValue();
            if (Double.isNaN(fallback) || Double.isInfinite(fallback)) {
                return new Rendered(quote("NaN"), true);
            }
            return new Rendered(Double.toString(fallback), false);
        } catch (Throwable ignored) {
            return new Rendered(quote("[unreadable]"), true);
        }
    }

    private static Rendered array(Object value, Class<?> type, State state) {
        try {
            int length = Array.getLength(value);
            int shown = Math.min(length, state.config.maxCollection());
            StringBuilder summary = new StringBuilder();
            summary.append(type.getComponentType() == null ? "array" : type.getComponentType().getName());
            summary.append('[').append(length).append("] [");
            for (int i = 0; i < shown; i++) {
                if (i > 0) {
                    summary.append(", ");
                }
                summary.append(preview(Array.get(value, i), state));
            }
            if (shown < length) {
                summary.append(", ...");
                state.truncated = true;
            }
            summary.append(']');
            return withState(summary.toString(), state);
        } catch (Throwable ignored) {
            return new Rendered(quote("[unreadable]"), true);
        }
    }

    private static Rendered collection(Collection<?> values, State state) {
        try {
            int size = values.size();
            int shown = Math.min(size, state.config.maxCollection());
            StringBuilder summary = new StringBuilder();
            summary.append(values.getClass().getName()).append('[').append(size).append("] [");
            Iterator<?> iterator = values.iterator();
            int index = 0;
            while (iterator.hasNext() && index < shown) {
                if (index > 0) {
                    summary.append(", ");
                }
                summary.append(preview(iterator.next(), state));
                index++;
            }
            if (shown < size) {
                summary.append(", ...");
                state.truncated = true;
            }
            summary.append(']');
            return withState(summary.toString(), state);
        } catch (Throwable ignored) {
            return new Rendered(quote("[unreadable]"), true);
        }
    }

    private static Rendered map(Map<?, ?> values, State state) {
        try {
            int size = values.size();
            int shown = Math.min(size, state.config.maxCollection());
            StringBuilder summary = new StringBuilder();
            summary.append(values.getClass().getName()).append('[').append(size).append("] {");
            Iterator<? extends Map.Entry<?, ?>> iterator = values.entrySet().iterator();
            int index = 0;
            while (iterator.hasNext() && index < shown) {
                if (index > 0) {
                    summary.append(", ");
                }
                Map.Entry<?, ?> entry = iterator.next();
                summary.append(preview(entry.getKey(), state)).append('=')
                        .append(preview(entry.getValue(), state));
                index++;
            }
            if (shown < size) {
                summary.append(", ...");
                state.truncated = true;
            }
            summary.append('}');
            return withState(summary.toString(), state);
        } catch (Throwable ignored) {
            return new Rendered(quote("[unreadable]"), true);
        }
    }

    /**
     * Shallow field summary for application objects (request DTOs and POJO returns). Reads fields
     * directly so getters with side effects are never invoked; nested values use {@link #preview}
     * and therefore stop at one level.
     */
    private static Rendered bean(Object value, Class<?> type, State state) {
        String className = type.getName();
        if (className.indexOf("$$") >= 0 || className.indexOf("HibernateProxy") >= 0
                || isPlatformType(className)) {
            return text(className, state);
        }
        List<Field> fields = new ArrayList<Field>();
        for (Class<?> current = type; current != null && current != Object.class;
             current = current.getSuperclass()) {
            for (Field field : current.getDeclaredFields()) {
                int modifiers = field.getModifiers();
                if (Modifier.isStatic(modifiers) || Modifier.isTransient(modifiers)
                        || field.isSynthetic()) {
                    continue;
                }
                fields.add(field);
            }
        }
        if (fields.isEmpty()) {
            return text(className, state);
        }
        StringBuilder summary = new StringBuilder(256);
        summary.append(className).append(" {");
        int shown = Math.min(fields.size(), MAX_BEAN_FIELDS);
        for (int i = 0; i < shown; i++) {
            Field field = fields.get(i);
            if (i > 0) {
                summary.append(", ");
            }
            summary.append(field.getName()).append('=');
            try {
                field.setAccessible(true);
                Object fieldValue = field.get(value);
                if (GenericBridge.isSensitiveName(field.getName())) {
                    summary.append(quote(redactedPlaceholder(fieldValue)));
                } else {
                    summary.append(preview(fieldValue, state));
                }
            } catch (Throwable ignored) {
                summary.append(quote("[unreadable]"));
            }
        }
        if (fields.size() > shown) {
            summary.append(", ...");
            state.truncated = true;
        }
        summary.append('}');
        return withState(summary.toString(), state);
    }

    private static boolean isPlatformType(String className) {
        return className.startsWith("java.")
                || className.startsWith("javax.")
                || className.startsWith("jakarta.")
                || className.startsWith("jdk.")
                || className.startsWith("sun.")
                || className.startsWith("com.sun.")
                || className.startsWith("org.springframework.")
                || className.startsWith("org.apache.")
                || className.startsWith("com.fasterxml.jackson.")
                || className.startsWith("com.google.gson.")
                || className.startsWith("org.json.");
    }

    private static Rendered withState(String summary, State state) {
        Rendered rendered = text(summary, state);
        return new Rendered(rendered.json, rendered.truncated || state.truncated);
    }

    /** Scalar-only preview for container elements (never invokes an application method). */
    private static String preview(Object value, State state) {
        try {
            if (value == null) {
                return "null";
            }
            if (value instanceof CharSequence || value instanceof Character) {
                return quote(previewText(value.toString(), state));
            }
            if (value instanceof Boolean) {
                return Boolean.TRUE.equals(value) ? "true" : "false";
            }
            if (value instanceof Number) {
                Rendered rendered = number((Number) value, state);
                return unquote(rendered.json);
            }
            Class<?> type = value.getClass();
            if (type.isEnum()) {
                return enumText((Enum<?>) value);
            }
            if (value instanceof java.util.Date) {
                return previewText(value.toString(), state);
            }
            if (value instanceof java.util.Calendar) {
                java.util.Date date = ((java.util.Calendar) value).getTime();
                return date == null ? "calendar" : previewText(date.toString(), state);
            }
            if (value instanceof java.time.temporal.TemporalAccessor) {
                return previewText(value.toString(), state);
            }
            if (value instanceof UUID) {
                return value.toString();
            }
            if (type.isArray()) {
                return type.getComponentType().getName() + "[" + Array.getLength(value) + "]";
            }
            if (value instanceof Collection) {
                return type.getName() + "[" + ((Collection<?>) value).size() + "]";
            }
            if (value instanceof Map) {
                return type.getName() + "{" + ((Map<?, ?>) value).size() + "}";
            }
            return type.getName();
        } catch (Throwable ignored) {
            return "?";
        }
    }

    private static String previewText(String value, State state) {
        String shortened = truncateChars(value, MAX_SCALAR_PREVIEW_CHARS);
        if (value != null && shortened != null && shortened.length() < value.length()) {
            state.truncated = true;
        }
        return shortened;
    }

    private static String enumText(Enum<?> value) {
        try {
            String type = value.getDeclaringClass() == null ? "" : value.getDeclaringClass().getSimpleName();
            String name = value.name();
            return type == null || type.isEmpty() ? name : type + "." + name;
        } catch (Throwable ignored) {
            return "enum";
        }
    }

    // ------------------------------------------------------------------ text helpers

    static String truncateChars(String value, int max) {
        if (value == null) {
            return null;
        }
        if (value.length() <= max) {
            return value;
        }
        int end = 0;
        int count = 0;
        while (end < value.length() && count < max) {
            int codePoint = value.codePointAt(end);
            end += Character.charCount(codePoint);
            count++;
        }
        return value.substring(0, end);
    }

    static String quote(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder json = new StringBuilder(value.length() + 2);
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
        return json.append('"').toString();
    }

    /** Unquotes the small number literals emitted by {@link #number(Number, State)}. */
    private static String unquote(String json) {
        if (json != null && json.length() >= 2 && json.charAt(0) == '"'
                && json.charAt(json.length() - 1) == '"') {
            return json.substring(1, json.length() - 1);
        }
        return json;
    }
}