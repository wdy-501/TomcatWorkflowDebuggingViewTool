package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S6a advice for {@code com.example.shop.controller.OrderController#reconcile(long)}
 * (kind {@code controller}). Same join rules as the S2/S5 controllers (EXACT via
 * {@code traceparent}/{@code X-TraceBoard-Click}, otherwise the verbatim LOST root); the span
 * carries {@code return={"type":"org.springframework.http.ResponseEntity","value":200}} and
 * <strong>no</strong> {@code values} (the line-level facts live on the reconcileAmount span).
 */
public final class ReconcileControllerAdvice {

    private ReconcileControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterReconcileController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitReconcileController(enterNs, returned, thrown);
    }
}