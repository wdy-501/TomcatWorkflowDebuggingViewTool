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
 * point at the stack top. Span start times are epoch nanoseconds (§12.10).</p>
 *
 * <p>S6a adds ONE line-level entry point: the dedicated ASM transformer (not Byte Buddy) injects
 * {@link #enterL2(long)}, {@link #recordLocal(int, String, double)} and {@link #exitL2(long, double)}
 * around {@code L2DemoService#reconcileAmount}, and {@link #enterReconcileController(long)} opens
 * the reconcile controller span.</p>
 *
 * <p>S6b: the stack is an {@link InheritableThreadLocal} whose {@code childValue} deep-copies every
 * frame, so a thread created while a controller frame is open inherits trace/root/parent/confidence
 * and its own {@code childCallCounts}. Each frame records the creating thread id
 * ({@code originThreadId}); L2 / no-debug child spans opened on a different thread than the parent
 * frame add the {@code ASYNC_INHERITED} flag. Inheritance happens ONLY at thread creation:
 * long-lived pools / pre-existing threads carry no request context ({@code l2_no_parent}, no
 * fabricated span) and a recycled worker may carry a stale trace (not solved here; S7+). S6b also
 * opens the loop entry point ({@link #enterL2Loop(long)}) and the no-debug entry point
 * ({@link #enterNoDebug(long)}, {@link #exitNoDebug(long, double)}) for methods whose class file has
 * no {@code LocalVariableTable}.</p>
 *
 * <p>Every method is fail-open: any {@code Throwable} is swallowed and the host application is
 * never affected.</p>
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

    /** S6a: the single L2-instrumented class/method (ASM transformer, never Byte Buddy). */
    static final String L2_CLASS = "com.example.shop.service.L2DemoService";
    static final String L2_METHOD = "reconcileAmount";
    static final String L2_SERVICE_NODE_KEY = L2_CLASS + "#" + L2_METHOD;
    /** S6b: second ASM-instrumented method of the same class (loop value folding). */
    static final String L2_LOOP_METHOD = "reconcileLoop";
    static final String L2_LOOP_NODE_KEY = L2_CLASS + "#" + L2_LOOP_METHOD;
    /** S6b: no-debug demo service (compiled without LocalVariableTable by the antrun build). */
    static final String NO_DEBUG_CLASS = "com.example.shop.service.NoDebugService";
    static final String NO_DEBUG_METHOD = "compute";
    static final String NO_DEBUG_NODE_KEY = NO_DEBUG_CLASS + "#" + NO_DEBUG_METHOD;
    /** S6b verbatim reason for {@code NOT_COLLECTED_NO_DEBUG_INFO} (api.v1.md Appendix G). */
    static final String NO_DEBUG_REASON = "LocalVariableTable missing";
    /** S6a: the reconcile controller span (Byte Buddy advice, EXACT header join like S3/S5). */
    static final String RECONCILE_CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#reconcile";
    /** S6b controller spans (Byte Buddy advices, same header join rules). */
    static final String ASYNC_CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#reconcileAsync";
    static final String NO_DEBUG_CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#noDebug";
    static final String LOOP_CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#reconcileLoop";

    private static final int MAX_DEPTH = 64;
    private static final String MAPPED_STATEMENT_FIELD = "mappedStatement";

    /**
     * S6b: inheritable stack. {@link #childValue} returns a deep copy (each frame + every mutable
     * collection), so a thread created while the controller frame is open receives the request
     * context. This happens ONLY at thread creation; existing / long-lived pool threads start
     * without context (no fabricated span, counted as {@code l2_no_parent}).
     */
    private static final InheritableThreadLocal<ArrayDeque<Frame>> STACK =
            new InheritableThreadLocal<ArrayDeque<Frame>>() {
                @Override
                protected ArrayDeque<Frame> initialValue() {
                    return new ArrayDeque<Frame>();
                }

                @Override
                protected ArrayDeque<Frame> childValue(ArrayDeque<Frame> parentValue) {
                    ArrayDeque<Frame> copy = new ArrayDeque<Frame>();
                    try {
                        if (parentValue != null) {
                            for (Frame frame : parentValue) {
                                copy.addLast(frame.copyForInheritance());
                            }
                        }
                    } catch (Throwable ignored) {
                        // fail-open: an uncopyable stack yields an empty child stack (no fake span)
                        copy.clear();
                    }
                    return copy;
                }
            };

    private static final AtomicLong ORPHAN = new AtomicLong();
    private static final AtomicLong RESET = new AtomicLong();
    private static final AtomicLong HTTP_UNREADABLE = new AtomicLong();
    private static final AtomicLong SQL_FILTER_UNREADABLE = new AtomicLong();
    private static final AtomicLong L2_NO_PARENT = new AtomicLong();
    private static final AtomicLong L2_ORPHAN = new AtomicLong();

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
        /** S6a: true only on the L2 service frame opened by {@link #enterL2(long)}. */
        boolean l2;
        /** S6b: true only on the no-debug service frame opened by {@link #enterNoDebug(long)}. */
        boolean noDebug;
        /** S6a: 1..3 call index inside the parent controller frame (reset per request). */
        int invocationIndex;
        /** S6a: frame-local previous value per local name (never {@code (frame,line,name)}). */
        final java.util.Map<String, Double> l2Previous = new java.util.HashMap<String, Double>();
        /** S6a: line-level facts (line + invocation), emitted only on an L2 span. */
        final java.util.List<L2Values.Item> l2Values = new java.util.ArrayList<L2Values.Item>();
        /** S6a: per-nodeKey call counter owned by a controller frame (the ×3 index source). */
        final java.util.Map<String, Integer> childCallCounts = new java.util.HashMap<String, Integer>();
        /**
         * S6b: id of the thread that CREATED this frame. Inheritance copies keep the original
         * value, so a child span opened on another thread can prove {@code ASYNC_INHERITED}
         * ({@code currentThread.id != parent.originThreadId}).
         */
        final long originThreadId;

        Frame(String kind, String nodeKey, String spanId, String traceId, String rootEventId,
              String parentSpanId, long startNs, boolean root, String confidence, boolean exactLink) {
            this(kind, nodeKey, spanId, traceId, rootEventId, parentSpanId, startNs, root, confidence,
                    exactLink, Thread.currentThread().getId());
        }

        private Frame(String kind, String nodeKey, String spanId, String traceId, String rootEventId,
                      String parentSpanId, long startNs, boolean root, String confidence,
                      boolean exactLink, long originThreadId) {
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
            this.originThreadId = originThreadId;
        }

        /**
         * S6b deep copy for {@link InheritableThreadLocal#childValue}: scalar fields are copied by
         * value (including the original {@code originThreadId}); every mutable collection is a new
         * instance so child-thread mutations never flow back into the request thread.
         */
        Frame copyForInheritance() {
            Frame copy = new Frame(kind, nodeKey, spanId, traceId, rootEventId, parentSpanId,
                    startNs, root, confidence, exactLink, originThreadId);
            copy.values.addAll(values);
            copy.extraFlags.addAll(extraFlags);
            copy.skipped = skipped;
            copy.l2 = l2;
            copy.noDebug = noDebug;
            copy.invocationIndex = invocationIndex;
            copy.l2Previous.putAll(l2Previous);
            copy.l2Values.addAll(l2Values);
            copy.childCallCounts.putAll(childCallCounts);
            return copy;
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

    // ---------------------------------------------------------------- L2 service (S6a)

    /**
     * S6a {@code L2DemoService#reconcileAmount}: opens the L2 service frame under the CURRENT
     * controller frame and assigns the 1..3 invocation index from that parent frame (so the index
     * resets per request and never depends on a global counter). No controller parent, no frame:
     * the call is counted as {@code l2_no_parent} and no span is fabricated.
     *
     * <p>S6b: on an inherited stack (thread created while the controller frame was open) the parent
     * is the copied controller frame, so the invocation index continues 1..3 inside the single pool
     * worker; a thread id different from the parent frame's {@code originThreadId} adds the
     * {@code ASYNC_INHERITED} flag. Same-thread calls never carry that flag.</p>
     *
     * <p>Called from ASM-injected bytecode, therefore {@code public static}.</p>
     */
    public static void enterL2(long enterNs) {
        openL2Frame(enterNs, L2_SERVICE_NODE_KEY);
    }

    /**
     * S6b {@code L2DemoService#reconcileLoop}: same frame/index/async rules as
     * {@link #enterL2(long)}, nodeKey {@code L2DemoService#reconcileLoop}. Called from
     * ASM-injected bytecode.
     */
    public static void enterL2Loop(long enterNs) {
        openL2Frame(enterNs, L2_LOOP_NODE_KEY);
    }

    private static void openL2Frame(long enterNs, String nodeKey) {
        try {
            if (!SpanEmitter.isEnabled()) {
                return;
            }
            ArrayDeque<Frame> stack = STACK.get();
            Frame parent = stack.peek();
            if (parent == null || !KIND_CONTROLLER.equals(parent.kind) || parent.traceId == null) {
                countL2NoParent();
                return;
            }
            int index = 1;
            Integer seen = parent.childCallCounts.get(nodeKey);
            if (seen != null) {
                index = seen.intValue() + 1;
            }
            parent.childCallCounts.put(nodeKey, Integer.valueOf(index));
            Frame frame = new Frame(KIND_SERVICE, nodeKey, SpanEmitter.randomHex(8),
                    parent.traceId, parent.rootEventId, parent.spanId,
                    SpanEmitter.epochNanosFrom(enterNs), false, parent.confidence, false);
            frame.l2 = true;
            frame.invocationIndex = index;
            frame.extraFlags.add(SpanEmitter.FLAG_L2);
            markAsyncInherited(frame, parent);
            stack.push(frame);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * S6b: adds {@code ASYNC_INHERITED} only when the child span is opened on a thread different
     * from the thread that created the parent frame. The flag proves the context came from an
     * inherited parent frame; it never implies framework/thread-pool task propagation.
     */
    private static void markAsyncInherited(Frame child, Frame parent) {
        try {
            if (Thread.currentThread().getId() != parent.originThreadId) {
                child.extraFlags.add(SpanEmitter.FLAG_ASYNC_INHERITED);
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * Boxed probe entry injected by the ASM transformer (local value already boxed by
     * {@code Double.valueOf}). Delegates to {@link #recordLocal(int, String, double)}.
     */
    public static void recordLocal(int line, String name, Object value) {
        try {
            if (!(value instanceof Number)) {
                return;
            }
            recordLocal(line, name, ((Number) value).doubleValue());
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * S6a line probe. Only the top L2 frame is touched. {@code previous} is kept per
     * {@code (frame,name)}: the first observation appends {@code from=null} and an unchanged value
     * appends nothing (so the init line probe of invocations 1/3 yields exactly one item).
     */
    public static void recordLocal(int line, String name, double value) {
        try {
            if (!SpanEmitter.isEnabled() || line <= 0 || name == null || !L1Values.isFinite(value)) {
                return;
            }
            ArrayDeque<Frame> stack = STACK.get();
            Frame top = stack.peek();
            if (top == null || !top.l2) {
                return;
            }
            Double previous = top.l2Previous.get(name);
            if (previous != null && Double.compare(previous.doubleValue(), value) == 0) {
                return;
            }
            top.l2Values.add(new L2Values.Item(name, L2Values.KIND_LOCAL, line,
                    (previous == null) ? null : L1Values.formatDouble(previous.doubleValue()),
                    L1Values.formatDouble(value), top.invocationIndex));
            top.l2Previous.put(name, Double.valueOf(value));
        } catch (Throwable ignored) {
            // fail-open: a probe must never affect the demo request
        }
    }

    /**
     * S6a normal exit: pops the top L2 frame and emits the real returned value. S6b: when the
     * observation list exceeded the 20-item budget the values are folded (first 6 + last 6 +
     * uniform middle samples, first bad {@code to=0} value kept) and the event becomes
     * {@code status=TRUNCATED} with visible {@code VALUES_CAPPED=<dropped>} + {@code VALUES_TOTAL=<total>}
     * flags; retained items stay {@code truncated=false} (the values themselves were not truncated,
     * the list was folded - nothing is dropped silently).
     */
    public static void exitL2(long enterNs, double returned) {
        try {
            Frame frame = popL2Frame();
            if (frame == null) {
                return;
            }
            L2Values.Fold fold = L2Values.fold(frame);
            appendFoldFlags(frame, fold);
            SpanEmitter.emit(frame, duration(enterNs), fold.folded ? "TRUNCATED" : "OK", "double",
                    L1Values.formatDouble(returned), null,
                    findSource(L2_CLASS, frame.nodeKey), fold.json);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** S6a exceptional exit: {@code THREW} with no fabricated return, collected values kept. */
    public static void exitL2Threw(long enterNs) {
        try {
            Frame frame = popL2Frame();
            if (frame == null) {
                return;
            }
            L2Values.Fold fold = L2Values.fold(frame);
            appendFoldFlags(frame, fold);
            SpanEmitter.emit(frame, duration(enterNs), "THREW", null, null, null,
                    findSource(L2_CLASS, frame.nodeKey), fold.json);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** S6b: fold counts are visible on the event (never a silent drop). */
    private static void appendFoldFlags(Frame frame, L2Values.Fold fold) {
        if (fold.folded) {
            frame.extraFlags.add(SpanEmitter.FLAG_VALUES_CAPPED + "=" + fold.dropped);
            frame.extraFlags.add(SpanEmitter.FLAG_VALUES_TOTAL + "=" + fold.total);
        }
    }

    // ---------------------------------------------------------------- no-debug service (S6b)

    /**
     * S6b {@code NoDebugService#compute}: opens a service frame under the current controller frame.
     * The class file has no {@code LocalVariableTable} (antrun {@code javac debug="false"}), so no
     * line probe / variable name is ever injected: only the call and the real return value are
     * proven. Async inheritance rules are identical to {@link #enterL2(long)}. Called from
     * ASM-injected bytecode.
     */
    public static void enterNoDebug(long enterNs) {
        try {
            if (!SpanEmitter.isEnabled()) {
                return;
            }
            ArrayDeque<Frame> stack = STACK.get();
            Frame parent = stack.peek();
            if (parent == null || !KIND_CONTROLLER.equals(parent.kind) || parent.traceId == null) {
                countL2NoParent();
                return;
            }
            Frame frame = new Frame(KIND_SERVICE, NO_DEBUG_NODE_KEY, SpanEmitter.randomHex(8),
                    parent.traceId, parent.rootEventId, parent.spanId,
                    SpanEmitter.epochNanosFrom(enterNs), false, parent.confidence, false);
            frame.noDebug = true;
            frame.extraFlags.add(SpanEmitter.FLAG_NO_DEBUG_INFO);
            markAsyncInherited(frame, parent);
            stack.push(frame);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * S6b normal exit: {@code status=NOT_COLLECTED_NO_DEBUG_INFO}, verbatim reason, flag
     * {@code NO_DEBUG_INFO}, NO {@code values} key, real return value and NO fabricated source line.
     */
    public static void exitNoDebug(long enterNs, double returned) {
        try {
            Frame frame = popNoDebugFrame();
            if (frame == null) {
                return;
            }
            SpanEmitter.emit(frame, duration(enterNs), "NOT_COLLECTED_NO_DEBUG_INFO", "double",
                    L1Values.formatDouble(returned), null, null, null, NO_DEBUG_REASON);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /** S6b exceptional exit: {@code THREW}, no return, still no values. */
    public static void exitNoDebugThrew(long enterNs) {
        try {
            Frame frame = popNoDebugFrame();
            if (frame == null) {
                return;
            }
            SpanEmitter.emit(frame, duration(enterNs), "THREW", null, null, null, null, null, null);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * Pops only when the stack top really is the no-debug frame (peek before poll), so a missing
     * parent frame can never pop the controller.
     */
    private static Frame popNoDebugFrame() {
        if (!SpanEmitter.isEnabled()) {
            return null;
        }
        ArrayDeque<Frame> stack = STACK.get();
        Frame top = stack.peek();
        if (top == null) {
            countL2Orphan("empty");
            return null;
        }
        if (!top.noDebug) {
            countL2Orphan(top.kind);
            return null;
        }
        stack.poll();
        if (stack.isEmpty()) {
            STACK.remove();
        }
        return top.traceId == null ? null : top;
    }

    /**
     * Pops only when the stack top really is the L2 frame (peek before poll), so a missing parent
     * frame can never pop the controller.
     */
    private static Frame popL2Frame() {
        if (!SpanEmitter.isEnabled()) {
            return null;
        }
        ArrayDeque<Frame> stack = STACK.get();
        Frame top = stack.peek();
        if (top == null) {
            countL2Orphan("empty");
            return null;
        }
        if (!top.l2) {
            countL2Orphan(top.kind);
            return null;
        }
        stack.poll();
        if (stack.isEmpty()) {
            STACK.remove();
        }
        return top.traceId == null ? null : top;
    }

    /** S6a {@code OrderController#reconcile} controller span (same header join rules as S3/S5). */
    public static void enterReconcileController(long enterNs) {
        enterController(enterNs, RECONCILE_CONTROLLER_NODE_KEY);
    }

    /** S6a reconcile controller exit: {@code ResponseEntity} 200, no {@code values}. */
    public static void exitReconcileController(long enterNs, Object returned, Throwable thrown) {
        exitController(enterNs, returned, thrown);
    }

    /** S6b {@code OrderController#reconcileAsync} (header join identical to S3/S5/S6a). */
    public static void enterAsyncController(long enterNs) {
        enterController(enterNs, ASYNC_CONTROLLER_NODE_KEY);
    }

    public static void exitAsyncController(long enterNs, Object returned, Throwable thrown) {
        exitController(enterNs, returned, thrown);
    }

    /** S6b {@code OrderController#noDebug} (header join identical to S3/S5/S6a). */
    public static void enterNoDebugController(long enterNs) {
        enterController(enterNs, NO_DEBUG_CONTROLLER_NODE_KEY);
    }

    public static void exitNoDebugController(long enterNs, Object returned, Throwable thrown) {
        exitController(enterNs, returned, thrown);
    }

    /** S6b {@code OrderController#reconcileLoop} (header join identical to S3/S5/S6a). */
    public static void enterLoopController(long enterNs) {
        enterController(enterNs, LOOP_CONTROLLER_NODE_KEY);
    }

    public static void exitLoopController(long enterNs, Object returned, Throwable thrown) {
        exitController(enterNs, returned, thrown);
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

    /** S6a: a call without a controller parent is skipped (never a fabricated LOST child span). */
    private static void countL2NoParent() {
        long n = L2_NO_PARENT.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log("l2_no_parent=" + n);
        }
    }

    /** S6a: an unmatched L2 exit is counted and emits nothing (stack stays consistent). */
    private static void countL2Orphan(String detail) {
        long n = L2_ORPHAN.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log("l2_orphan=" + n + " top=" + detail);
        }
    }
}
