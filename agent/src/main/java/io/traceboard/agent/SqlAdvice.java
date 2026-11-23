package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * Advice for {@code org.apache.ibatis.executor.statement.PreparedStatementHandler#update(Statement)}
 * (kind {@code sql}).
 *
 * <p>Every statement update passes through this method, so the advice filters on the mapped
 * statement id (read reflectively from the inherited {@code mappedStatement} field): only
 * {@code com.example.shop.mapper.OrderMapper.cancelById} emits a span. The return value is the
 * real affected-row count ({@code 0} is a normal fact).</p>
 */
public final class SqlAdvice {

    private SqlAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter(@Advice.This Object handler) {
        long enterNs = System.nanoTime();
        if (SpanContext.isCancelStatement(handler)) {
            SpanContext.enterSql(enterNs);
            return enterNs;
        }
        return 0L;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) int rowsAffected,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        if (enterNs == 0L) {
            return;
        }
        SpanContext.exitSql(enterNs, rowsAffected, thrown);
    }
}
