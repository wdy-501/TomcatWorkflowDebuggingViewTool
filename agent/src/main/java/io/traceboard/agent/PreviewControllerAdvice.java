package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S5 advice for {@code com.example.shop.controller.OrderController#previewDiscount(long,double,String,String)}
 * (kind {@code controller}). Same join rules as the S2 cancel controller (EXACT via
 * {@code traceparent}/{@code X-TraceBoard-Click}, otherwise the verbatim LOST root); the span
 * carries {@code return={"type":"org.springframework.http.ResponseEntity","value":200}} and
 * <strong>no</strong> {@code values} (L1 facts live on the service span only).
 */
public final class PreviewControllerAdvice {

    private PreviewControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterPreviewController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitController(enterNs, returned, thrown);
    }
}