package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S6b advice for {@code com.example.shop.controller.OrderController#reconcileLoop(long,int)}
 * (kind {@code controller}). Same join rules as the S2/S5/S6a controllers; the span carries
 * {@code return={"type":"org.springframework.http.ResponseEntity","value":200}} and no
 * {@code values} (the folded loop values live on the reconcileLoop service span).
 */
public final class LoopControllerAdvice {

    private LoopControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterLoopController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitLoopController(enterNs, returned, thrown);
    }
}