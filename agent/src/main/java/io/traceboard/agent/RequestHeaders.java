package io.traceboard.agent;

import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * S3 read-only HTTP header correlation (event-model.v1.md §12.4).
 *
 * <p>Reads {@code traceparent} / {@code X-TraceBoard-Click} from the current Spring MVC request
 * through reflection only ({@code RequestContextHolder} -> {@code ServletRequestAttributes}
 * {@code #getRequest} -> {@code getHeader}); there is no compile-time Spring/Servlet dependency.
 * Lookups are cached and every failure is fail-open: the caller falls back to the S2 LOST root.
 * Header values are never logged, only a throttled {@code header_unreadable=<n>} counter is
 * written to stderr.</p>
 */
final class RequestHeaders {

    static final String TRACEPARENT = "traceparent";
    static final String CLICK_HEADER = "X-TraceBoard-Click";

    private static final Pattern TRACEPARENT_PATTERN =
            Pattern.compile("^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$");
    private static final Pattern CLICK_PATTERN = Pattern.compile("^click_[A-Za-z0-9_-]{8,}$");
    private static final String ZERO_TRACE_ID = "00000000000000000000000000000000";
    private static final String ZERO_SPAN_ID = "0000000000000000";

    private static final String HOLDER_CLASS = "org.springframework.web.context.request.RequestContextHolder";
    private static final String ATTRIBUTES_CLASS = "org.springframework.web.context.request.ServletRequestAttributes";
    private static final String SERVLET_REQUEST_CLASS = "javax.servlet.http.HttpServletRequest";

    private static final AtomicLong UNREADABLE = new AtomicLong();
    private static final AtomicLong MISSING = new AtomicLong();
    private static final AtomicLong INVALID = new AtomicLong();
    private static final AtomicLong REFLECTION = new AtomicLong();

    private static volatile boolean unavailable;
    private static volatile Method getRequestAttributes;
    private static volatile Method getRequest;
    private static volatile Method getHeader;

    private RequestHeaders() {
    }

    /**
     * @return the validated header link, or {@code null} when headers are missing/invalid or the
     *         Spring request is unreadable (S2 LOST fallback; never guesses)
     */
    static Link current() {
        try {
            String[] values = readHeaders();
            if (values == null) {
                count("reflection");
                return null;
            }
            String traceparent = values[0];
            String click = values[1];
            if (traceparent == null && click == null) {
                count("missing");
                return null;
            }
            Matcher matcher = (traceparent == null) ? null : TRACEPARENT_PATTERN.matcher(traceparent);
            if (matcher == null || !matcher.matches()
                    || ZERO_TRACE_ID.equals(matcher.group(1))
                    || ZERO_SPAN_ID.equals(matcher.group(2))
                    || click == null || !CLICK_PATTERN.matcher(click).matches()) {
                count("invalid");
                return null;
            }
            return new Link(matcher.group(1), matcher.group(2), click);
        } catch (Throwable ignored) {
            count("reflection");
            return null;
        }
    }

    /**
     * @return {@code {traceparent, click}} (values may be {@code null}), or {@code null} when the
     *         Spring/Servlet request classes cannot be resolved at all
     */
    private static String[] readHeaders() throws Exception {
        if (unavailable) {
            return null;
        }
        try {
            Object attributes = requestAttributes();
            if (attributes == null) {
                return new String[]{null, null};
            }
            Object request = request(attributes);
            if (request == null) {
                return new String[]{null, null};
            }
            Method header = headerMethod(request);
            return new String[]{
                    asString(header.invoke(request, TRACEPARENT)),
                    asString(header.invoke(request, CLICK_HEADER))
            };
        } catch (ClassNotFoundException missing) {
            unavailable = true;
            return null;
        }
    }

    private static Object requestAttributes() throws Exception {
        Method method = getRequestAttributes;
        if (method == null) {
            method = load(HOLDER_CLASS).getMethod("getRequestAttributes");
            getRequestAttributes = method;
        }
        return method.invoke(null);
    }

    private static Object request(Object attributes) throws Exception {
        Method method = getRequest;
        if (method == null) {
            method = load(ATTRIBUTES_CLASS).getMethod("getRequest");
            getRequest = method;
        }
        return method.invoke(attributes);
    }

    private static Method headerMethod(Object request) throws Exception {
        Method method = getHeader;
        if (method != null) {
            return method;
        }
        try {
            method = load(SERVLET_REQUEST_CLASS).getMethod("getHeader", String.class);
        } catch (Throwable ignored) {
            // Fallback: the request implementation always exposes the public interface method.
            method = request.getClass().getMethod("getHeader", String.class);
        }
        getHeader = method;
        return method;
    }

    private static Class<?> load(String name) throws ClassNotFoundException {
        ClassLoader context = Thread.currentThread().getContextClassLoader();
        if (context != null) {
            try {
                return Class.forName(name, true, context);
            } catch (ClassNotFoundException ignored) {
                // fall through to the agent class loader
            }
        }
        return Class.forName(name, true, RequestHeaders.class.getClassLoader());
    }

    private static String asString(Object value) {
        return (value instanceof String) ? (String) value : null;
    }

    private static void count(String reason) {
        try {
            AtomicLong perReason;
            if ("invalid".equals(reason)) {
                perReason = INVALID;
            } else if ("reflection".equals(reason)) {
                perReason = REFLECTION;
            } else {
                perReason = MISSING;
            }
            long total = UNREADABLE.incrementAndGet();
            long n = perReason.incrementAndGet();
            // Throttled, per reason: first occurrence + every 100th. Header values are never logged.
            if (n == 1L || n % 100L == 0L) {
                TraceAgent.log("header_unreadable=" + total + " reason=" + reason
                        + " reason_count=" + n);
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** Strictly validated correlation headers (header values are never logged). */
    static final class Link {
        final String traceId;
        final String parentSpanId;
        final String clickId;

        Link(String traceId, String parentSpanId, String clickId) {
            this.traceId = traceId;
            this.parentSpanId = parentSpanId;
            this.clickId = clickId;
        }
    }
}
