package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * Advice for {@code com.example.shop.service.OrderService#cancel(long)} (kind {@code service}).
 * Child of the current controller frame; boolean {@code false} maps to {@code RETURNED_FALSE}.
 */
public final class ServiceAdvice {

    private ServiceAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterService(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) boolean returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitService(enterNs, returned, thrown);
    }
}
