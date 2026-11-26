package io.traceboard.agent.generic;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import io.traceboard.agent.GenericBridge;

/**
 * Reflection-only MyBatis facts for the generic mode (no compile-time MyBatis dependency).
 *
 * <p>Mapper spans use {@code interface#method}; SQL spans use the mapped statement id (for example
 * {@code com.acme.OrderMapper#selectById} becomes {@code com.acme.OrderMapper.selectById}) and the
 * {@code SqlCommandType} name for the {@code SQL_SELECT/INSERT/UPDATE/DELETE} flag. The SQL text and
 * statement parameters are never read. When the id cannot be read the span keeps the real handler
 * method as its node key instead of inventing one, and a throttled counter is logged.</p>
 */
final class GenericMyBatis {

    static final String MAPPER_PROXY = "org.apache.ibatis.binding.MapperProxy";
    static final String STATEMENT_HANDLER = "org.apache.ibatis.executor.statement.PreparedStatementHandler";

    private static final String MAPPED_STATEMENT_FIELD = "mappedStatement";
    private static final Object NOT_FOUND = new Object();

    private static final ConcurrentHashMap<Class<?>, Object> FIELDS =
            new ConcurrentHashMap<Class<?>, Object>();
    private static final ConcurrentHashMap<Class<?>, Method> ID_METHODS =
            new ConcurrentHashMap<Class<?>, Method>();
    private static final ConcurrentHashMap<Class<?>, Method> COMMAND_METHODS =
            new ConcurrentHashMap<Class<?>, Method>();

    private static final AtomicLong ID_UNREADABLE = new AtomicLong();

    private GenericMyBatis() {
    }

    /** @return true for mapper interface methods handled by the MyBatis proxy */
    static boolean isMapperMethod(Method method) {
        try {
            if (method == null) {
                return false;
            }
            Class<?> declaring = method.getDeclaringClass();
            if (declaring == null || !declaring.isInterface()) {
                return false;
            }
            String name = declaring.getName();
            if (name.startsWith("java.") || name.startsWith("javax.") || name.startsWith("jakarta.")) {
                return false;
            }
            GenericConfig config = GenericConfig.current();
            return config == null || !config.isExcluded(name);
        } catch (Throwable ignored) {
            return false;
        }
    }

    /** @return the mapped statement id, or {@code null} when it cannot be read */
    static String statementId(Object handler) {
        try {
            Object mappedStatement = mappedStatement(handler);
            if (mappedStatement == null) {
                return null;
            }
            Method getId = ID_METHODS.get(mappedStatement.getClass());
            if (getId == null) {
                getId = mappedStatement.getClass().getMethod("getId");
                ID_METHODS.put(mappedStatement.getClass(), getId);
            }
            Object id = getId.invoke(mappedStatement);
            return (id instanceof String) ? (String) id : null;
        } catch (Throwable ignored) {
            countIdUnreadable();
            return null;
        }
    }

    /** @return {@code SELECT}/{@code INSERT}/{@code UPDATE}/{@code DELETE}, or {@code null} */
    static String commandName(Object handler) {
        try {
            Object mappedStatement = mappedStatement(handler);
            if (mappedStatement == null) {
                return null;
            }
            Method getCommand = COMMAND_METHODS.get(mappedStatement.getClass());
            if (getCommand == null) {
                getCommand = mappedStatement.getClass().getMethod("getSqlCommandType");
                COMMAND_METHODS.put(mappedStatement.getClass(), getCommand);
            }
            Object command = getCommand.invoke(mappedStatement);
            if (command instanceof Enum) {
                return ((Enum<?>) command).name();
            }
            return null;
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** Real handler method used only when the mapped statement id is unreadable (never invented). */
    static String fallbackNodeKey(String methodName) {
        return STATEMENT_HANDLER + "#" + (methodName == null ? "statement" : methodName);
    }

    private static Object mappedStatement(Object handler) {
        if (handler == null) {
            return null;
        }
        try {
            Field field = field(handler.getClass());
            if (field == null) {
                return null;
            }
            return field.get(handler);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static Field field(Class<?> handlerType) {
        Object cached = FIELDS.get(handlerType);
        if (cached != null) {
            return (cached == NOT_FOUND) ? null : (Field) cached;
        }
        Class<?> type = handlerType;
        while (type != null && type != Object.class) {
            try {
                Field field = type.getDeclaredField(MAPPED_STATEMENT_FIELD);
                field.setAccessible(true);
                FIELDS.put(handlerType, field);
                return field;
            } catch (NoSuchFieldException notHere) {
                type = type.getSuperclass();
            } catch (Throwable ignored) {
                FIELDS.put(handlerType, NOT_FOUND);
                return null;
            }
        }
        FIELDS.put(handlerType, NOT_FOUND);
        return null;
    }

    private static void countIdUnreadable() {
        long total = ID_UNREADABLE.incrementAndGet();
        if (total == 1L || total % 100L == 0L) {
            GenericBridge.log("generic_sql_statement_unreadable=" + total);
        }
    }
}