package io.traceboard.agent;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-thread span stack for the S2 four-point chain (s2-plan.md 7.2/7.3).
 *
 * <p>Exactly four entry points are wired to this class: controller, service, MyBatis
 * {@code MapperProxy#invoke} (filtered to {@code OrderMapper#cancelById}) and MyBatis
 * {@code PreparedStatementHandler#update} (filtered to the {@code OrderMapper.cancelById} mapped
 * statement). The controller creates the isolated-backend root; children inherit
 * trace/root/confidence and point at the stack top. Every method is fail-open: any
 * {@code Throwable} is swallowed and the host application is never affected.</p>
 */
public final class SpanContext {

    static final String KIND_CONTROLLER = "controller";
    static final String KIND_SERVICE = "service";
    static final String KIND_MAPPER = "mapper";
    static final String KIND_SQL = "sql";

    static final String CONTROLLER_CLASS = "com.example.shop.controller.OrderController";
    static final String SERVICE_CLASS = "com.example.shop.service.OrderService";
    static final String MAPPER_PROXY_CLASS = "org.apache.ibatis.binding.MapperProxy";
    static final String STATEMENT_HANDLER_CLASS = "org.apache.ibatis.executor.statement.PreparedStatementHandler";

    static final String CONTROLLER_NODE_KEY = CONTROLLER_CLASS + "#cancel";
    static final String SERVICE_NODE_KEY = SERVICE_CLASS + "#cancel";
    static final String MAPPER_CLASS = "com.example.shop.mapper.OrderMapper";
    static final String MAPPER_METHOD = "cancelById";
    static final String MAPPER_NODE_KEY = MAPPER_CLASS + "#" + MAPPER_METHOD;
    static final String SQL_NODE_KEY = "OrderMapper.cancelById";
    static final String SQL_STATEMENT_SUFFIX = ".OrderMapper.cancelById";

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
        final boolean root;

        Frame(String kind, String nodeKey, String spanId, String traceId, String rootEventId,
              String parentSpanId, long startNs, boolean root) {
            this.kind = kind;
            this.nodeKey = nodeKey;
            this.spanId = spanId;
            this.traceId = traceId;
            this.rootEventId = rootEventId;
            this.parentSpanId = parentSpanId;
            this.startNs = startNs;
            this.root = root;
        }
    }

    // ---------------------------------------------------------------- controller

    public static void enterController(long enterNs) {
        enter(KIND_CONTROLLER, CONTROLLER_NODE_KEY, enterNs);
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
                    findSource(CONTROLLER_CLASS));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- service

    public static void enterService(long enterNs) {
        enter(KIND_SERVICE, SERVICE_NODE_KEY, enterNs);
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
                    findSource(SERVICE_CLASS));
        } catch (Throwable ignored) {
            // fail-open
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
        enter(KIND_MAPPER, MAPPER_NODE_KEY, enterNs);
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
                    findSource(MAPPER_PROXY_CLASS));
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
        enter(KIND_SQL, SQL_NODE_KEY, enterNs);
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
                    findSource(STATEMENT_HANDLER_CLASS));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    // ---------------------------------------------------------------- stack

    private static void enter(String kind, String nodeKey, long enterNs) {
        try {
            if (!SpanEmitter.isEnabled()) {
                return;
            }
            ArrayDeque<Frame> stack = STACK.get();
            if (stack.size() >= MAX_DEPTH) {
                stack.clear();
                TraceAgent.log("stack_reset=" + RESET.incrementAndGet() + " reason=depth");
            }
            long startNs = enterNs - SpanEmitter.premainNanos();
            if (startNs < 0L) {
                startNs = 0L;
            }
            Frame parent = stack.peek();
            Frame frame;
            if (parent == null) {
                if (KIND_CONTROLLER.equals(kind)) {
                    String spanId = SpanEmitter.randomHex(8);
                    String fixedTraceId = SpanEmitter.fixedTraceId();
                    String traceId = (fixedTraceId != null) ? fixedTraceId : SpanEmitter.randomHex(16);
                    frame = new Frame(kind, nodeKey, spanId, traceId, "click_lost_" + spanId,
                            null, startNs, true);
                } else {
                    // No controller root on this thread: keep the stack balanced but never fake a root.
                    frame = new Frame(kind, nodeKey, null, null, null, null, startNs, false);
                }
            } else {
                frame = new Frame(kind, nodeKey, SpanEmitter.randomHex(8), parent.traceId,
                        parent.rootEventId, parent.spanId, startNs, false);
            }
            stack.push(frame);
        } catch (Throwable ignored) {
            // fail-open
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

    private static StackTraceElement findSource(String className) {
        try {
            StackTraceElement[] frames = new Throwable().getStackTrace();
            for (StackTraceElement frame : frames) {
                if (className.equals(frame.getClassName())) {
                    return frame;
                }
            }
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
