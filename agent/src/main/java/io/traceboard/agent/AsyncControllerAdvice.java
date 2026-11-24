package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S6b advice for {@code com.example.shop.controller.OrderController#reconcileAsync(long)}
 * (kind {@code controller}). Same join rules as the S2/S5/S6a controllers (EXACT via
 * {@code traceparent}/{@code X-TraceBoard-Click}, otherwise the verbatim LOST root); the span
 * carries {@code return={"type":"org.springframework.http.ResponseEntity","value":200}} and
 * <strong>no</strong> {@code values} (the L2 facts live on the three async
 * {@code reconcileAmount} spans, emitted from the per-request single worker thread).
 */
public final class AsyncControllerAdvice {

    private AsyncControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterAsyncController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitAsyncController(enterNs, returned, thrown);
    }
}