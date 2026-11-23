package io.traceboard.agent;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-thread span stack for the S2/S3 four-point chain (s2-plan.md 7.2/7.3, s3-plan.md §8).
 *
 * <p>Exactly four entry points are wired to this class: controller, service, MyBatis
 * {@code MapperProxy#invoke} (filtered to {@code OrderMapper#cancelById}) and MyBatis
 * {@code PreparedStatementHandler#update} (filtered to the {@code OrderMapper.cancelById} mapped
 * statement). S3: the controller reads {@code traceparent}/{@code X-TraceBoard-Click} through
 * reflection; valid headers make it an EXACT child of the SDK fetch ({@code parentSpanId=<header
 * parent-id>}, {@code rootEventId=<clickId>}, no {@code LOST_BACKEND}), while missing/invalid
 * headers keep the verbatim S2 isolated LOST root. Children inherit trace/root/confidence and
 * point at the stack top. Span start times are epoch nanoseconds (§12.10). Every method is
 * fail-open: any {@code Throwable} is swallowed and the host application is never affected.</p>
 */
public final class SpanContext {

    static final String KIND_CONTROLLER = "controller";
    static final String KIND_SERVICE = "service";
    static final String KIND_MAPPER = "mapper";
    static final String KIND_SQL = "sql";

    static final String CONFIDENCE_EXACT = "EXACT";
    static final String CONFIDENCE_LOST = "LOST";

    static final String CONTROLLER_CLASS = "com.example.shop.controller.OrderController";
    static final String SERVICE_CLASS = "com.example.shop.service.OrderService";
    static final String MAPPER_PROXY_CLASS = "org.apache.ibatis.binding.MapperProxy";
    static final String STATEMENT_HANDLER_CLASS = "org.apache.ibatis.executor.statement.PreparedStatementHandler";

    static final String CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#cancel";
    static final String SERVICE_NODE_KEY = SERVICE_CLASS + "#cancel";
    /** S5: preview-discount controller/service span keys (L1 values live on the service only). */
    static final String PREVIEW_CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#previewDiscount";
    static final String PREVIEW_SERVICE_NODE_KEY = SERVICE_CLASS + "#previewDiscount";
    static final String MAPPER_CLASS = "com.example.shop.mapper.OrderMapper";
    static final String MAPPER_METHOD = "cancelById";
    static final String MAPPER_NODE_KEY = MAPPER_CLASS + "#" + MAPPER_METHOD;
    static final String SQL_NODE_KEY = "OrderMapper.cancelById";
    static final String SQL_STATEMENT_SUFFIX = ".OrderMapper.cancelById";

    /** S5 field advice target (exact class name, never {@code instanceof}, no compile dependency). */
    static final String ORDER_CLASS = "com.example.shop.model.Order";
    static final String ORDER_AMOUNT_FIELD = "amount";
    static final String PREVIEW_SERVICE_METHOD = "previewDiscount";
    static final String MYBATIS_PACKAGE_PREFIX = "org.apache.ibatis";

    private static final int MAX_DEPTH = 64;
    private static final String MAPPED_STATEMENT_FIELD = "mappedStatement";

    private static final ThreadLocal<ArrayDeque<Frame>> STACK = new ThreadLocal<ArrayDeque<Frame>>() {
        @Override
        protected ArrayDeque<Frame> initialValue() {
            return new ArrayDeque<Frame>();
        }
    };

    private static final AtomicLong ORPHAN = new AtomicLong();
    private static final AtomicLong RESET = new AtomicLong();
    private static final AtomicLong HTTP_UNREADABLE = new AtomicLong();
    private static final AtomicLong SQL_FILTER_UNREADABLE = new AtomicLong();

    private SpanContext() {
    }

    /** Immutable stack frame; {@code traceId == null} marks a chain-less (not collected) frame. */
    static final class Frame {
        final String kind;
        final String nodeKey;
        final String spanId;
        final String traceId;
        final String rootEventId;
        final String parentSpanId;
        final long startNs;
        /** S2 isolated-backend root (LOST + {@code LOST_BACKEND}); never true for an EXACT link. */
        final boolean root;
        /** {@link #CONFIDENCE_EXACT} (valid S3 headers / SDK children) or {@link #CONFIDENCE_LOST}. */
        final String confidence;
        /** True only on the controller frame that joined a real frontend fetch via headers. */
        final boolean exactLink;
        /** S5 L1 value facts (param -> field writes -> return); empty for S2-S4 spans. */
        final java.util.List<L1Values.Item> values = new java.util.ArrayList<L1Values.Item>();
        /** S5 flags appended after {@code S2_ZERO_ROW_CHAIN} (e.g. {@code L1}, {@code VALUES_CAPPED=<n>}). */
        final java.util.List<String> extraFlags = new java.util.ArrayList<String>();
        /** S5: value facts skipped as non-scalar/unreadable, reported as {@code L1_SKIPPED=<n>}. */
        int skipped;

        Frame(String kind, String nodeKey, String spanId, String traceId, String rootEventId,
              String parentSpanId, long startNs, boolean root, String confidence, boolean exactLink) {
            this.kind = kind;
            this.nodeKey = nodeKey;
            this.spanId = spanId;
            this.traceId = traceId;
            this.rootEventId = rootEventId;
            this.parentSpanId = parentSpanId;
            this.startNs = startNs;
            this.root = root;
            this.confidence = confidence;
            this.exactLink = exactLink;
        }
    }

    // ---------------------------------------------------------------- controller

    /**
     * S3: reads {@code traceparent} / {@code X-TraceBoard-Click} from the current HTTP request
     * (reflection only). Valid headers join the SDK fetch span (EXACT); anything else keeps the
     * verbatim S2 LOST root. The local stack is still started on the controller frame so children
     * inherit trace/root/confidence.
     */
    public static void enterController(long enterNs) {
        enterController(enterNs, CONTROLLER_NODE_KEY);
    }

    /**
     * S5: {@code OrderController#previewDiscount} controller span; header join / LOST rules are
     * identical to {@link #enterController(long)} (no L1 values on the controller).
     */
    public static void enterPreviewController(long enterNs) {
        enterController(enterNs, PREVIEW_CONTROLLER_NODE_KEY);
    }

    private static void enterController(long enterNs, String nodeKey) {
        RequestHeaders.Link link = null;
        try {
            link = RequestHeaders.current();
        } catch (Throwable ignored) {
            // fail-open: treat as missing headers (S2 LOST)
        }
        enter(KIND_CONTROLLER, nodeKey, enterNs, link);
    }

    public static void exitController(long enterNs, Object returned, Throwable thrown) {
        try {
            Frame frame = exit(KIND_CONTROLLER);
            if (frame == null) {
                return;
            }
            String status = (thrown == null) ? "OK" : "THREW";
            String returnType = null;
            String returnValue = null;
            if (thrown == null) {
                if (returned == null) {
                    returnType = "void";
                    returnValue = "null";
                } else {
                    returnType = returned.getClass().getName();
                    Integer httpStatus = httpStatus(returned);
                    if (httpStatus == null) {
                        countHttpUnreadable();
                    }
                    returnValue = (httpStatus == null) ? "null" : String.valueOf(httpStatus.intValue());
                }
            }
            SpanEmitter.emit(frame, duration(enterNs), status, returnType, returnValue, null,
                    findSource(CONTROLLER_CLASS, frame.nodeKey));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- service

    public static void enterService(long enterNs) {
        enter(KIND_SERVICE, SERVICE_NODE_KEY, enterNs, null);
    }

    public static void exitService(long enterNs, boolean returned, Throwable thrown) {
        try {
            Frame frame = exit(KIND_SERVICE);
            if (frame == null) {
                return;
            }
            String status;
            String returnType = null;
            String returnValue = null;
            if (thrown != null) {
                status = "THREW";
            } else if (returned) {
                status = "OK";
                returnType = "boolean";
                returnValue = "true";
            } else {
                status = "RETURNED_FALSE";
                returnType = "boolean";
                returnValue = "false";
            }
            SpanEmitter.emit(frame, duration(enterNs), status, returnType, returnValue, null,
                    findSource(SERVICE_CLASS, frame.nodeKey));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- preview service (S5 L1)

    /**
     * S5 {@code OrderService#previewDiscount(long,double,String,String)}: opens the service frame
     * and records the three business params in declaration order. The path param {@code long id}
     * (argument index 0) is deliberately NOT captured, so the demo has exactly 3 param items.
     */
    public static void enterPreviewService(long enterNs, double requestedAmount,
                                           String demoSecret, String note) {
        try {
            Frame frame = enter(KIND_SERVICE, PREVIEW_SERVICE_NODE_KEY, enterNs, null);
            if (frame == null) {
                return;
            }
            frame.extraFlags.add(SpanEmitter.FLAG_L1);
            if (!L1Values.appendParam(frame, "requestedAmount", requestedAmount)) {
                frame.skipped++;
            }
            if (!L1Values.appendParam(frame, "demoSecret", demoSecret)) {
                frame.skipped++;
            }
            if (!L1Values.appendParam(frame, "note", note)) {
                frame.skipped++;
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * S5: emits the preview service span with {@code values} (params -> field writes -> return).
     * A {@code THREW} exit emits the params only (no return item) but still carries {@code L1}.
     */
    public static void exitPreviewService(long enterNs, double returned, Throwable thrown) {
        try {
            Frame frame = exit(KIND_SERVICE);
            if (frame == null) {
                return;
            }
            String status = (thrown == null) ? "OK" : "THREW";
            String returnType = null;
            String returnValue = null;
            if (thrown == null) {
                returnType = "double";
                returnValue = L1Values.formatDouble(returned);
                if (!L1Values.appendReturn(frame, returned)) {
                    frame.skipped++;
                }
            }
            String valuesJson = L1Values.toValuesJson(frame);
            SpanEmitter.emit(frame, duration(enterNs), status, returnType, returnValue, null,
                    findSource(SERVICE_CLASS, frame.nodeKey), valuesJson);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- field write (S5 L1)

    /**
     * S5 field advice entry for {@code com.example.shop.model.Order#setAmount(double)}. Never emits
     * its own span; appends one {@code field} item ({@code amount 100 -> 0}) to the current preview
     * service frame only when all guards hold:
     *
     * <ol>
     *   <li>{@code target} is exactly {@code com.example.shop.model.Order};</li>
     *   <li>the stack top is the {@code OrderService#previewDiscount} service frame;</li>
     *   <li>no {@code org.apache.ibatis} frame sits between this advice and that method (skips the
     *       MyBatis hydration {@code 0 -> 100} decoy);</li>
     *   <li>the old amount (read reflectively via {@code getAmount()}) differs from the new one.</li>
     * </ol>
     *
     * <p>Must stay {@code public}: the advice body is inlined into {@code com.example.shop.model.Order},
     * which lives in another package (a package-private method causes {@code IllegalAccessError}).</p>
     */
    public static void recordFieldWrite(Object target, String field, double newValue) {
        try {
            if (!SpanEmitter.isEnabled() || target == null) {
                return;
            }
            if (!ORDER_CLASS.equals(target.getClass().getName()) || !ORDER_AMOUNT_FIELD.equals(field)) {
                return;
            }
            ArrayDeque<Frame> stack = STACK.get();
            Frame top = stack.peek();
            if (top == null || !KIND_SERVICE.equals(top.kind)
                    || !PREVIEW_SERVICE_NODE_KEY.equals(top.nodeKey) || top.traceId == null) {
                return;
            }
            if (!calledFromPreviewService()) {
                return;
            }
            Object old = readAmount(target);
            if (!(old instanceof Number)) {
                return;
            }
            double oldValue = ((Number) old).doubleValue();
            if (Double.compare(oldValue, newValue) == 0) {
                return;
            }
            if (!L1Values.appendField(top, ORDER_AMOUNT_FIELD, oldValue, newValue)) {
                top.skipped++;
            }
        } catch (Throwable ignored) {
            // fail-open: the field advice never affects the host application
        }
    }

    /** True when {@code previewDiscount} is on the stack before any MyBatis frame. */
    private static boolean calledFromPreviewService() {
        StackTraceElement[] frames = new Throwable().getStackTrace();
        for (StackTraceElement frame : frames) {
            String className = frame.getClassName();
            if (SERVICE_CLASS.equals(className) && PREVIEW_SERVICE_METHOD.equals(frame.getMethodName())) {
                return true;
            }
            if (className != null && className.startsWith(MYBATIS_PACKAGE_PREFIX)) {
                return false;
            }
        }
        return false;
    }

    private static Object readAmount(Object target) {
        try {
            Method getAmount = target.getClass().getMethod("getAmount");
            return getAmount.invoke(target);
        } catch (Throwable ignored) {
            return null;
        }
    }

    // ---------------------------------------------------------------- mapper

    /**
     * @param method the intercepted {@code MapperProxy#invoke} {@link Method} argument
     * @return true only for {@code com.example.shop.mapper.OrderMapper#cancelById}
     */
    public static boolean isTargetMapperMethod(Method method) {
        try {
            if (method == null) {
                return false;
            }
            Class<?> declaringClass = method.getDeclaringClass();
            return declaringClass != null
                    && MAPPER_CLASS.equals(declaringClass.getName())
                    && MAPPER_METHOD.equals(method.getName());
        } catch (Throwable ignored) {
            return false;
        }
    }

    public static void enterMapper(long enterNs) {
        enter(KIND_MAPPER, MAPPER_NODE_KEY, enterNs, null);
    }

    public static void exitMapper(long enterNs, Object returned, Throwable thrown) {
        try {
            Frame frame = exit(KIND_MAPPER);
            if (frame == null) {
                return;
            }
            String status = (thrown == null) ? "OK" : "THREW";
            String returnType = null;
            String returnValue = null;
            if (thrown == null) {
                returnType = "int";
                returnValue = (returned instanceof Number)
                        ? String.valueOf(((Number) returned).intValue())
                        : "null";
            }
            SpanEmitter.emit(frame, duration(enterNs), status, returnType, returnValue, null,
                    findSource(MAPPER_PROXY_CLASS, frame.nodeKey));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- sql

    /**
     * @param handler the {@code PreparedStatementHandler} instance ({@code @Advice.This})
     * @return true only when the mapped statement id ends with {@code .OrderMapper.cancelById}
     */
    public static boolean isCancelStatement(Object handler) {
        try {
            String id = mappedStatementId(handler);
            if (id == null) {
                return false;
            }
            return id.endsWith(SQL_STATEMENT_SUFFIX);
        } catch (Throwable ignored) {
            return false;
        }
    }

    public static void enterSql(long enterNs) {
        enter(KIND_SQL, SQL_NODE_KEY, enterNs, null);
    }

    public static void exitSql(long enterNs, int rowsAffected, Throwable thrown) {
        try {
            Frame frame = exit(KIND_SQL);
            if (frame == null) {
                return;
            }
            String status = (thrown == null) ? "OK" : "THREW";
            String sideEffects = null;
            if (thrown == null) {
                int rows = rowsAffected < 0 ? 0 : rowsAffected;
                sideEffects = "[{\"type\":\"sql\",\"sqlId\":\"" + SQL_NODE_KEY
                        + "\",\"rowsAffected\":" + rows + ",\"transaction\":\"UNKNOWN\"}]";
            }
            SpanEmitter.emit(frame, duration(enterNs), status, null, null, sideEffects,
                    findSource(STATEMENT_HANDLER_CLASS, frame.nodeKey));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- stack

    private static Frame enter(String kind, String nodeKey, long enterNs, RequestHeaders.Link link) {
        try {
            if (!SpanEmitter.isEnabled()) {
                return null;
            }
            ArrayDeque<Frame> stack = STACK.get();
            if (stack.size() >= MAX_DEPTH) {
                stack.clear();
                TraceAgent.log("stack_reset=" + RESET.incrementAndGet() + " reason=depth");
            }
            // Use the same advice-captured nanoTime for startNs and duration. Taking startNs
            // later (inside this method) inflates parent spans on cold classloading and can
            // make a child end after its parent.
            long startNs = SpanEmitter.epochNanosFrom(enterNs);
            Frame parent = stack.peek();
            Frame frame;
            if (parent == null) {
                if (KIND_CONTROLLER.equals(kind)) {
                    if (link != null) {
                        // Joined a real frontend fetch: not a free-standing backend root.
                        frame = new Frame(kind, nodeKey, SpanEmitter.randomHex(8), link.traceId,
                                link.clickId, link.parentSpanId, startNs, false,
                                CONFIDENCE_EXACT, true);
                    } else {
                        String spanId = SpanEmitter.randomHex(8);
                        String fixedTraceId = SpanEmitter.fixedTraceId();
                        String traceId = (fixedTraceId != null) ? fixedTraceId : SpanEmitter.randomHex(16);
                        frame = new Frame(kind, nodeKey, spanId, traceId, "click_lost_" + spanId,
                                null, startNs, true, CONFIDENCE_LOST, false);
                    }
                } else {
                    // No controller root on this thread: keep the stack balanced but never fake a root.
                    frame = new Frame(kind, nodeKey, null, null, null, null, startNs, false,
                            CONFIDENCE_LOST, false);
                }
            } else {
                frame = new Frame(kind, nodeKey, SpanEmitter.randomHex(8), parent.traceId,
                        parent.rootEventId, parent.spanId, startNs, false, parent.confidence, false);
            }
            stack.push(frame);
            return frame;
        } catch (Throwable ignored) {
            // fail-open
            return null;
        }
    }

    private static Frame exit(String kind) {
        try {
            if (!SpanEmitter.isEnabled()) {
                return null;
            }
            ArrayDeque<Frame> stack = STACK.get();
            Frame top = stack.poll();
            if (stack.isEmpty()) {
                STACK.remove();
            }
            if (top == null) {
                TraceAgent.log("orphan_span=" + ORPHAN.incrementAndGet() + " kind=" + kind);
                return null;
            }
            if (!kind.equals(top.kind)) {
                TraceAgent.log("orphan_span=" + ORPHAN.incrementAndGet() + " kind=" + kind
                        + " expected=" + top.kind);
                return null;
            }
            if (top.traceId == null) {
                TraceAgent.log("orphan_span=" + ORPHAN.incrementAndGet() + " kind=" + kind);
                return null;
            }
            return top;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static long duration(long enterNs) {
        long durNs = System.nanoTime() - enterNs;
        return durNs < 0L ? 0L : durNs;
    }

    // ---------------------------------------------------------------- reflection helpers

    /**
     * Reads the inherited {@code mappedStatement} field (declared on {@code BaseStatementHandler})
     * and returns its id. Read-only; never mutates the handler.
     */
    static String mappedStatementId(Object handler) {
        if (handler == null) {
            return null;
        }
        Class<?> type = handler.getClass();
        while (type != null && type != Object.class) {
            try {
                Field field = type.getDeclaredField(MAPPED_STATEMENT_FIELD);
                field.setAccessible(true);
                Object mappedStatement = field.get(handler);
                if (mappedStatement == null) {
                    return null;
                }
                Method getId = mappedStatement.getClass().getMethod("getId");
                Object id = getId.invoke(mappedStatement);
                return (id instanceof String) ? (String) id : null;
            } catch (NoSuchFieldException notHere) {
                type = type.getSuperclass();
            } catch (Throwable failure) {
                countSqlFilterUnreadable();
                return null;
            }
        }
        countSqlFilterUnreadable();
        return null;
    }

    /**
     * Reads {@code ResponseEntity#getStatusCode()} then {@code HttpStatus#value()} via reflection.
     * Returns {@code null} when unreadable (the status is then never guessed).
     */
    static Integer httpStatus(Object returned) {
        try {
            Method getStatusCode = returned.getClass().getMethod("getStatusCode");
            Object status = getStatusCode.invoke(returned);
            if (status == null) {
                return null;
            }
            Method value = status.getClass().getMethod("value");
            Object code = value.invoke(status);
            return (code instanceof Integer) ? (Integer) code : null;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static final Map<String, StackTraceElement> SOURCE_CACHE = new ConcurrentHashMap<String, StackTraceElement>();
    private static final StackTraceElement NO_SOURCE = new StackTraceElement("", "", "", -1);

    private static StackTraceElement findSource(String className, String methodKey) {
        try {
            String key = className + "|" + (methodKey == null ? "" : methodKey);
            StackTraceElement cached = SOURCE_CACHE.get(key);
            if (cached != null) {
                return cached == NO_SOURCE ? null : cached;
            }
            StackTraceElement[] frames = new Throwable().getStackTrace();
            for (StackTraceElement candidate : frames) {
                if (className.equals(candidate.getClassName())) {
                    SOURCE_CACHE.put(key, candidate);
                    return candidate;
                }
            }
            SOURCE_CACHE.put(key, NO_SOURCE);
        } catch (Throwable ignored) {
            // source is optional
        }
        return null;
    }

    private static void countHttpUnreadable() {
        long n = HTTP_UNREADABLE.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log("http_status_unreadable=" + n);
        }
    }

    private static void countSqlFilterUnreadable() {
        long n = SQL_FILTER_UNREADABLE.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log("sql_statement_unreadable=" + n);
        }
    }
}
