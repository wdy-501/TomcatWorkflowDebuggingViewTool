package io.traceboard.agent.generic;

import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.traceboard.agent.GenericBridge;

/**
 * Read-only HTTP header correlation for the generic mode.
 *
 * <p>Reads {@code traceparent} / {@code X-TraceBoard-Click} from the current Spring MVC request
 * through reflection only ({@code RequestContextHolder} -> {@code ServletRequestAttributes} ->
 * {@code getRequest} -> {@code getHeader}); there is no compile-time Spring or Servlet dependency,
 * so the same code works for {@code javax.servlet} (Boot 2) and {@code jakarta.servlet} (Boot 3).
 * Values are validated strictly and never logged; only throttled counters are written.</p>
 *
 * <ul>
 *   <li>valid {@code traceparent} + valid click -> {@link Link#exact} (EXACT join);</li>
 *   <li>valid {@code traceparent} only -> {@link Link#traceparentOnly} (LOST + TRACEPARENT_ONLY);</li>
 *   <li>valid click only -> LOST backend root that keeps the real click id;</li>
 *   <li>nothing valid/unreadable -> {@code null} (LOST backend root with a synthetic click id).</li>
 * </ul>
 */
final class GenericRequestHeaders {

    static final String TRACEPARENT = "traceparent";
    static final String CLICK_HEADER = "X-TraceBoard-Click";

    private static final Pattern TRACEPARENT_PATTERN =
            Pattern.compile("^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$");
    private static final Pattern CLICK_PATTERN = Pattern.compile("^click_[A-Za-z0-9_-]{8,}$");
    private static final String ZERO_TRACE_ID = "00000000000000000000000000000000";
    private static final String ZERO_SPAN_ID = "0000000000000000";

    private static final String HOLDER_CLASS = "org.springframework.web.context.request.RequestContextHolder";
    private static final String ATTRIBUTES_CLASS = "org.springframework.web.context.request.ServletRequestAttributes";
    private static final String JAKARTA_REQUEST_CLASS = "jakarta.servlet.http.HttpServletRequest";
    private static final String JAVAX_REQUEST_CLASS = "javax.servlet.http.HttpServletRequest";

    private static final AtomicLong UNREADABLE = new AtomicLong();
    private static final AtomicLong MISSING = new AtomicLong();
    private static final AtomicLong INVALID = new AtomicLong();

    private static volatile boolean unavailable;
    private static volatile Method getRequestAttributes;
    private static volatile Method getRequest;
    private static volatile Method getHeader;

    private GenericRequestHeaders() {
    }

    /** @return the validated header link, or {@code null} when nothing usable is present */
    static Link current() {
        try {
            String[] values = readHeaders();
            if (values == null) {
                count("reflection");
                return null;
            }
            String traceparent = values[0];
            String click = values[1];
            boolean traceparentValid = isValidTraceparent(traceparent);
            boolean clickValid = click != null && CLICK_PATTERN.matcher(click).matches();
            if (traceparentValid && clickValid) {
                Matcher matcher = TRACEPARENT_PATTERN.matcher(traceparent);
                if (matcher.matches()) {
                    return new Link(matcher.group(1), matcher.group(2), click, true, false);
                }
            }
            if (traceparentValid) {
                Matcher matcher = TRACEPARENT_PATTERN.matcher(traceparent);
                if (matcher.matches()) {
                    return new Link(matcher.group(1), matcher.group(2), null, false, true);
                }
            }
            if (clickValid) {
                return new Link(null, null, click, false, false);
            }
            count(traceparent == null && click == null ? "missing" : "invalid");
            return null;
        } catch (Throwable ignored) {
            count("reflection");
            return null;
        }
    }

    private static boolean isValidTraceparent(String value) {
        try {
            if (value == null) {
                return false;
            }
            Matcher matcher = TRACEPARENT_PATTERN.matcher(value);
            return matcher.matches()
                    && !ZERO_TRACE_ID.equals(matcher.group(1))
                    && !ZERO_SPAN_ID.equals(matcher.group(2));
        } catch (Throwable ignored) {
            return false;
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

    /**
     * Resolves {@code getHeader(String)} from the request instance. Both servlet namespaces are
     * tried by name (no compile-time dependency), then the implementation class itself.
     */
    private static Method headerMethod(Object request) throws Exception {
        Method method = getHeader;
        if (method != null) {
            return method;
        }
        try {
            method = load(JAKARTA_REQUEST_CLASS).getMethod("getHeader", String.class);
        } catch (Throwable ignored) {
            method = null;
        }
        if (method == null) {
            try {
                method = load(JAVAX_REQUEST_CLASS).getMethod("getHeader", String.class);
            } catch (Throwable ignored) {
                method = null;
            }
        }
        if (method == null) {
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
        return Class.forName(name, true, GenericRequestHeaders.class.getClassLoader());
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
                perReason = UNREADABLE;
            } else {
                perReason = MISSING;
            }
            long total = perReason.incrementAndGet();
            if (total == 1L || total % 100L == 0L) {
                GenericBridge.log("generic_header_missing=" + total + " reason=" + reason);
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** Validated correlation headers (header values are never logged). */
    static final class Link {
        final String traceId;
        final String parentSpanId;
        final String clickId;
        final boolean exact;
        final boolean traceparentOnly;

        Link(String traceId, String parentSpanId, String clickId, boolean exact,
             boolean traceparentOnly) {
            this.traceId = traceId;
            this.parentSpanId = parentSpanId;
            this.clickId = clickId;
            this.exact = exact;
            this.traceparentOnly = traceparentOnly;
        }
    }
}