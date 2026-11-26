package io.traceboard.agent.generic;

import net.bytebuddy.asm.Advice;
import net.bytebuddy.implementation.bytecode.assign.Assigner;

/**
 * Advice for the MyBatis {@code PreparedStatementHandler} methods
 * {@code query/update/batch/execute}. Only calls inside an instrumented trace emit a {@code sql}
 * span; the node key is the mapped statement id and the update return value is reported as the
 * real {@code rowsAffected}. The SQL text and bound parameters are never read. Dynamic return
 * typing keeps the void {@code batch} method instrumentable.
 */
public final class GenericSqlAdvice {

    private GenericSqlAdvice() {
    }

    @Advice.OnMethodEnter
    public static Object onEnter(@Advice.This Object handler,
                                 @Advice.Origin("#m") String methodName) {
        return GenericSpanContext.enterSql(handler, methodName);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter Object token,
                              @Advice.Return(readOnly = true, typing = Assigner.Typing.DYNAMIC) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        GenericSpanContext.exitSql(token, returned, thrown);
    }
}