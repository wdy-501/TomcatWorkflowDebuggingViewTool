package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * Advice for {@code com.example.shop.controller.OrderController#cancel(long)} (kind {@code controller}).
 * Starts the trace (isolated backend root) on entry and emits on exit.
 */
public final class ControllerAdvice {

    private ControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitController(enterNs, returned, thrown);
    }
}
