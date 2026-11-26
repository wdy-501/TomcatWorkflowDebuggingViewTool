package io.traceboard.agent.generic;

import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import io.traceboard.agent.GenericBridge;

/**
 * Per-thread span stack for the generic mode.
 *
 * <p>Root rules: a Spring controller method (or an explicit {@code includeMethod} when {@code
 * rootForIncluded=true}) opened without a parent starts a trace; an auto-scanned method without a
 * parent is skipped (no root, no event) so scheduled tasks, getters and utility calls outside a
 * request never flood the board. Children inherit trace id, root event id and confidence; a span
 * opened on a thread created while a request was active adds {@code ASYNC_INHERITED}. Every root
 * carries a lifecycle claim that is closed when the root exits, so a long-lived pool thread that
 * inherited the context can never emit fabricated spans afterwards (the stale copy is dropped on
 * the next entry).</p>
 *
 * <p>Each trace owns a span budget ({@link Budget}); when it is exhausted the call is counted and
 * produces no event (a non-emitting shadow frame keeps the stack balanced so children can never be
 * re-parented to a grandparent). Framing uses the same token identity rule as the demo: the exit
 * only accepts the exact frame it created.</p>
 *
 * <p>Every entry point is fail-open and never throws into the application.</p>
 */
public final class GenericSpanContext {

    static final String CONFIDENCE_EXACT = "EXACT";
    static final String CONFIDENCE_LOST = "LOST";

    static final String FLAG_GENERIC = "GENERIC";
    static final String FLAG_AUTO = "GENERIC_AUTO";
    static final String FLAG_INCLUDED = "GENERIC_INCLUDED";
    static final String FLAG_ROOT = "GENERIC_ROOT";
    static final String FLAG_LOST_BACKEND = "LOST_BACKEND";
    static final String FLAG_TRACEPARENT_ONLY = "TRACEPARENT_ONLY";
    static final String FLAG_INHERITED = "ASYNC_INHERITED";
    static final String FLAG_EXCEPTION = "EXCEPTION=";
    static final String FLAG_SQL_SELECT = "SQL_SELECT";
    static final String FLAG_SQL_INSERT = "SQL_INSERT";
    static final String FLAG_SQL_UPDATE = "SQL_UPDATE";
    static final String FLAG_SQL_DELETE = "SQL_DELETE";

    private static final String SQL_UPDATE_METHOD = "update";

    /** Thread-local stack; new threads receive a deep copy of the current request frames. */
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

    /** Reentrancy guard: value rendering must never create spans of its own. */
    private static final ThreadLocal<Integer> AGENT_DEPTH = new ThreadLocal<Integer>();

    private static final AtomicInteger NO_PARENT = new AtomicInteger();
    private static final AtomicInteger STALE = new AtomicInteger();
    private static final AtomicInteger ORPHAN = new AtomicInteger();
    private static final AtomicInteger DEPTH_DROP = new AtomicInteger();
    private static final java.util.concurrent.atomic.AtomicLong BUDGET_DROPS =
            new java.util.concurrent.atomic.AtomicLong();

    private GenericSpanContext() {
    }

    // ------------------------------------------------------------------ entry points

    /** Advice entry for an auto-scanned or explicitly included application method. */
    public static Object enter(Method method, Object[] args) {
        try {
            if (guarded()) {
                return null;
            }
            GenericConfig config = GenericConfig.current();
            if (config == null || !GenericBridge.active()) {
                return null;
            }
            GenericMeta.Meta meta = GenericMeta.of(method);
            if (meta == null) {
                return null;
            }
            return open(meta, args, null, false);
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** Advice entry for {@code MapperProxy#invoke}. */
    public static Object enterMapper(Method method, Object[] args) {
        try {
            if (guarded()) {
                return null;
            }
            GenericConfig config = GenericConfig.current();
            if (config == null || !GenericBridge.active() || !config.captureMyBatis()) {
                return null;
            }
            if (!GenericMyBatis.isMapperMethod(method)) {
                return null;
            }
            if (currentParent() == null) {
                countNoParent("mapper");
                return null;
            }
            GenericMeta.Meta meta = GenericMeta.mapper(method);
            if (meta == null) {
                return null;
            }
            return open(meta, args, null, false);
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** Advice entry for {@code PreparedStatementHandler} query/update/batch/execute. */
    public static Object enterSql(Object handler, String methodName) {
        try {
            if (guarded()) {
                return null;
            }
            GenericConfig config = GenericConfig.current();
            if (config == null || !GenericBridge.active() || !config.captureMyBatis()) {
                return null;
            }
            if (currentParent() == null) {
                countNoParent("sql");
                return null;
            }
            String statementId = GenericMyBatis.statementId(handler);
            GenericMeta.Meta meta = GenericMeta.sql(statementId != null
                    ? statementId : GenericMyBatis.fallbackNodeKey(methodName));
            String sqlFlag = sqlFlag(GenericMyBatis.commandName(handler));
            boolean update = SQL_UPDATE_METHOD.equals(methodName);
            return open(meta, null, sqlFlag, update);
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** Advice exit shared by the application-method advice. */
    public static void exit(Object token, Object returned, Throwable thrown) {
        finish(token, returned, thrown);
    }

    public static void exitMapper(Object token, Object returned, Throwable thrown) {
        finish(token, returned, thrown);
    }

    public static void exitSql(Object token, Object returned, Throwable thrown) {
        finish(token, returned, thrown);
    }

    // ------------------------------------------------------------------ frame model

    /** Per-trace budget shared by every thread that inherited the request context. */
    static final class Budget {
        final int max;
        final AtomicInteger opened = new AtomicInteger();

        Budget(int max) {
            this.max = max;
        }

        boolean reserve() {
            if (opened.incrementAndGet() > max) {
                BUDGET_DROPS.incrementAndGet();
                return false;
            }
            return true;
        }
    }

    /** Budget drops across all traces (surfaced on every later span as {@code DROP_COUNT}). */
    static long budgetDropTotal() {
        return BUDGET_DROPS.get();
    }

    /** Lifecycle of one request root; closed on root exit so inherited copies become inert. */
    static final class Claim {
        volatile boolean closed;
    }

    static final class Frame {
        final String kind;
        final String nodeKey;
        final String spanId;
        final String traceId;
        final String rootEventId;
        final String parentSpanId;
        final long startNs;
        final long enterNs;
        final long originThreadId;
        final boolean root;
        final boolean exactLink;
        final boolean emit;
        final boolean captureReturn;
        final boolean sqlUpdate;
        final String confidence;
        final String declaringClass;
        final String methodName;
        final String returnTypeName;
        final Claim claim;
        final Budget budget;
        final List<String> flags = new ArrayList<String>();
        final List<GenericValues.Item> values = new ArrayList<GenericValues.Item>();

        Frame(String kind, String nodeKey, String spanId, String traceId, String rootEventId,
              String parentSpanId, long startNs, long enterNs, long originThreadId, boolean root,
              boolean exactLink, boolean emit, boolean captureReturn, boolean sqlUpdate,
              String confidence, String declaringClass, String methodName, String returnTypeName,
              Claim claim, Budget budget) {
            this.kind = kind;
            this.nodeKey = nodeKey;
            this.spanId = spanId;
            this.traceId = traceId;
            this.rootEventId = rootEventId;
            this.parentSpanId = parentSpanId;
            this.startNs = startNs;
            this.enterNs = enterNs;
            this.originThreadId = originThreadId;
            this.root = root;
            this.exactLink = exactLink;
            this.emit = emit;
            this.captureReturn = captureReturn;
            this.sqlUpdate = sqlUpdate;
            this.confidence = confidence;
            this.declaringClass = declaringClass;
            this.methodName = methodName;
            this.returnTypeName = returnTypeName;
            this.claim = claim;
            this.budget = budget;
        }

        Frame copyForInheritance() {
            Frame copy = new Frame(kind, nodeKey, spanId, traceId, rootEventId, parentSpanId,
                    startNs, enterNs, originThreadId, root, exactLink, emit, captureReturn, sqlUpdate,
                    confidence, declaringClass, methodName, returnTypeName, claim, budget);
            copy.flags.addAll(flags);
            copy.values.addAll(values);
            return copy;
        }
    }

    // ------------------------------------------------------------------ open / close

    private static Frame open(GenericMeta.Meta meta, Object[] args, String sqlFlag, boolean sqlUpdate) {
        GenericConfig config = GenericConfig.current();
        if (config == null) {
            return null;
        }
        Frame parent = currentParent();
        ArrayDeque<Frame> stack = STACK.get();
        if (stack.size() >= config.maxDepth()) {
            countDepth();
            return null;
        }
        long enterNs = System.nanoTime();
        Frame frame;
        if (parent == null) {
            boolean controller = GenericMeta.KIND_CONTROLLER.equals(meta.kind);
            boolean explicitRoot = meta.explicit && config.rootForIncluded();
            if (!controller && !explicitRoot) {
                countNoParent(meta.kind);
                return null;
            }
            frame = rootFrame(meta, enterNs, config);
        } else {
            frame = childFrame(meta, parent, enterNs, sqlFlag, sqlUpdate);
            if (frame == null) {
                return null;
            }
        }
        if (meta.captureArgs && config.captureArgs() && args != null && args.length > 0) {
            enterGuard();
            try {
                GenericValues.appendArgs(frame, args, meta, config);
            } finally {
                exitGuard();
            }
        }
        STACK.get().push(frame);
        return frame;
    }

    private static Frame rootFrame(GenericMeta.Meta meta, long enterNs, GenericConfig config) {
        String spanId = GenericEmitter.randomHex(8);
        GenericRequestHeaders.Link link = GenericRequestHeaders.current();
        Claim claim = new Claim();
        Budget budget = new Budget(config.maxSpansPerTrace());
        budget.reserve();
        long startNs = GenericEmitter.epochNanosFrom(enterNs);
        long threadId = Thread.currentThread().getId();
        Frame frame;
        boolean explicit = meta.explicit;
        if (link != null && link.exact) {
            frame = new Frame(meta.kind, meta.nodeKey, spanId, link.traceId, link.clickId,
                    link.parentSpanId, startNs, enterNs, threadId, true, true, true,
                    meta.captureReturn, false, CONFIDENCE_EXACT, meta.declaringClass, meta.methodName,
                    meta.returnTypeName, claim, budget);
            frame.flags.add(FLAG_GENERIC);
            frame.flags.add(FLAG_ROOT);
        } else if (link != null && link.traceparentOnly) {
            frame = new Frame(meta.kind, meta.nodeKey, spanId, link.traceId, "click_lost_" + spanId,
                    link.parentSpanId, startNs, enterNs, threadId, true, false, true,
                    meta.captureReturn, false, CONFIDENCE_LOST, meta.declaringClass, meta.methodName,
                    meta.returnTypeName, claim, budget);
            frame.flags.add(FLAG_GENERIC);
            frame.flags.add(FLAG_ROOT);
            frame.flags.add(FLAG_TRACEPARENT_ONLY);
        } else {
            String rootEventId = (link != null && link.clickId != null)
                    ? link.clickId : "click_lost_" + spanId;
            frame = new Frame(meta.kind, meta.nodeKey, spanId, GenericEmitter.randomHex(16), rootEventId,
                    null, startNs, enterNs, threadId, true, false, true, meta.captureReturn, false,
                    CONFIDENCE_LOST, meta.declaringClass, meta.methodName, meta.returnTypeName,
                    claim, budget);
            frame.flags.add(FLAG_GENERIC);
            frame.flags.add(FLAG_ROOT);
            frame.flags.add(FLAG_LOST_BACKEND);
        }
        if (explicit) {
            frame.flags.add(FLAG_INCLUDED);
        } else {
            frame.flags.add(FLAG_AUTO);
        }
        return frame;
    }

    private static Frame childFrame(GenericMeta.Meta meta, Frame parent, long enterNs,
                                    String sqlFlag, boolean sqlUpdate) {
        boolean emit = parent.emit;
        if (emit) {
            emit = parent.budget.reserve();
        }
        long threadId = Thread.currentThread().getId();
        Frame frame = new Frame(meta.kind, meta.nodeKey, GenericEmitter.randomHex(8), parent.traceId,
                parent.rootEventId, parent.spanId, GenericEmitter.epochNanosFrom(enterNs), enterNs,
                threadId, false, parent.exactLink, emit, meta.captureReturn, sqlUpdate,
                parent.confidence, meta.declaringClass, meta.methodName, meta.returnTypeName,
                parent.claim, parent.budget);
        frame.flags.add(FLAG_GENERIC);
        if (GenericMeta.KIND_SQL.equals(meta.kind)) {
            if (sqlFlag != null) {
                frame.flags.add(sqlFlag);
            }
        } else if (meta.explicit) {
            frame.flags.add(FLAG_INCLUDED);
        } else if (GenericMeta.KIND_SERVICE.equals(meta.kind)) {
            frame.flags.add(FLAG_AUTO);
        }
        if (threadId != parent.originThreadId) {
            frame.flags.add(FLAG_INHERITED);
        }
        return frame;
    }

    private static void finish(Object token, Object returned, Throwable thrown) {
        try {
            if (!(token instanceof Frame)) {
                return;
            }
            Frame frame = (Frame) token;
            GenericConfig config = GenericConfig.current();
            if (config == null) {
                return;
            }
            ArrayDeque<Frame> stack = STACK.get();
            boolean present;
            if (stack.peek() == frame) {
                stack.poll();
                present = true;
            } else {
                present = stack.remove(frame);
                countOrphan();
            }
            if (stack.isEmpty()) {
                STACK.remove();
            }
            if (frame.root) {
                frame.claim.closed = true;
            }
            if (!present || !frame.emit) {
                return;
            }

            String status;
            String returnType = null;
            String returnJson = null;
            if (thrown != null) {
                status = "THREW";
                frame.flags.add(FLAG_EXCEPTION + simpleName(thrown.getClass()));
            } else {
                status = "OK";
                if (frame.captureReturn && !GenericMeta.KIND_SQL.equals(frame.kind)) {
                    returnType = frame.returnTypeName == null ? "void" : frame.returnTypeName;
                    returnJson = "null";
                    if (!"void".equals(returnType)) {
                        enterGuard();
                        try {
                            returnJson = GenericValues.appendReturn(frame, returned, config);
                            if (returnJson == null) {
                                returnJson = "null";
                            }
                        } finally {
                            exitGuard();
                        }
                    }
                }
            }

            String sideEffects = null;
            if (GenericMeta.KIND_SQL.equals(frame.kind) && frame.sqlUpdate && thrown == null
                    && returned instanceof Number) {
                long rows = ((Number) returned).longValue();
                if (rows < 0L) {
                    rows = 0L;
                }
                String sqlId = GenericMeta.truncate(frame.nodeKey, 256);
                sideEffects = "[{\"type\":\"sql\",\"sqlId\":" + GenericValues.quote(sqlId)
                        + ",\"rowsAffected\":" + rows + ",\"transaction\":\"UNKNOWN\"}]";
            }

            String valuesJson = null;
            enterGuard();
            try {
                valuesJson = GenericValues.toValuesJson(frame, config);
            } finally {
                exitGuard();
            }
            long durNs = System.nanoTime() - frame.enterNs;
            if (durNs < 0L) {
                durNs = 0L;
            }
            GenericEmitter.emit(frame, durNs, status, returnType, returnJson, sideEffects, valuesJson);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ------------------------------------------------------------------ helpers

    private static Frame currentParent() {
        try {
            ArrayDeque<Frame> stack = STACK.get();
            Frame parent = stack.peek();
            if (parent != null && parent.claim != null && parent.claim.closed) {
                // The request that created this context already finished: drop the inherited copy
                // instead of emitting fabricated spans from a long-lived worker thread.
                stack.clear();
                STACK.remove();
                countStale();
                return null;
            }
            return parent;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static String sqlFlag(String command) {
        if ("SELECT".equals(command)) {
            return FLAG_SQL_SELECT;
        }
        if ("INSERT".equals(command)) {
            return FLAG_SQL_INSERT;
        }
        if ("UPDATE".equals(command)) {
            return FLAG_SQL_UPDATE;
        }
        if ("DELETE".equals(command)) {
            return FLAG_SQL_DELETE;
        }
        return null;
    }

    private static String simpleName(Class<?> type) {
        try {
            String simple = type.getSimpleName();
            if (simple == null || simple.isEmpty()) {
                String full = type.getName();
                int dot = full.lastIndexOf('.');
                simple = dot >= 0 ? full.substring(dot + 1) : full;
            }
            return GenericMeta.truncate(simple, 48);
        } catch (Throwable ignored) {
            return "Throwable";
        }
    }

    private static boolean guarded() {
        try {
            Integer depth = AGENT_DEPTH.get();
            return depth != null && depth.intValue() > 0;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static void enterGuard() {
        try {
            Integer depth = AGENT_DEPTH.get();
            AGENT_DEPTH.set(Integer.valueOf(depth == null ? 1 : depth.intValue() + 1));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    private static void exitGuard() {
        try {
            Integer depth = AGENT_DEPTH.get();
            if (depth == null) {
                return;
            }
            if (depth.intValue() <= 1) {
                AGENT_DEPTH.remove();
            } else {
                AGENT_DEPTH.set(Integer.valueOf(depth.intValue() - 1));
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    private static void countNoParent(String kind) {
        long total = NO_PARENT.incrementAndGet();
        if (total == 1L || total % 100L == 0L) {
            GenericBridge.log("generic_no_parent=" + total + " kind=" + kind);
        }
    }

    private static void countStale() {
        long total = STALE.incrementAndGet();
        if (total == 1L || total % 100L == 0L) {
            GenericBridge.log("generic_stale_context=" + total);
        }
    }

    private static void countOrphan() {
        long total = ORPHAN.incrementAndGet();
        if (total == 1L || total % 100L == 0L) {
            GenericBridge.log("generic_orphan_exit=" + total);
        }
    }

    private static void countDepth() {
        long total = DEPTH_DROP.incrementAndGet();
        if (total == 1L || total % 100L == 0L) {
            GenericBridge.log("generic_depth_drop=" + total);
        }
    }
}