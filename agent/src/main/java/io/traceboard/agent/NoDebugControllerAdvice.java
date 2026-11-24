package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S6b advice for {@code com.example.shop.controller.OrderController#noDebug(long)}
 * (kind {@code controller}). Same join rules as the S2/S5/S6a controllers; the span carries
 * {@code return={"type":"org.springframework.http.ResponseEntity","value":200}} and no
 * {@code values} (the no-debug service span only proves the call and the real return value).
 */
public final class NoDebugControllerAdvice {

    private NoDebugControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterNoDebugController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitNoDebugController(enterNs, returned, thrown);
    }
}