package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S5 advice for {@code com.example.shop.service.OrderService#previewDiscount(long,double,String,String)}
 * (kind {@code service}, the only span carrying L1 {@code values}).
 *
 * <p>Arguments 1..3 are the three business params ({@code requestedAmount}/{@code demoSecret}/
 * {@code note}); argument 0 is the path {@code long id} and is deliberately not captured. The
 * {@code double} return appends the {@code return} value item (a 0 is a value, not
 * {@code RETURNED_FALSE}).</p>
 */
public final class PreviewServiceAdvice {

    private PreviewServiceAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter(@Advice.Argument(1) double requestedAmount,
                               @Advice.Argument(2) String demoSecret,
                               @Advice.Argument(3) String note) {
        long enterNs = System.nanoTime();
        SpanContext.enterPreviewService(enterNs, requestedAmount, demoSecret, note);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) double returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitPreviewService(enterNs, returned, thrown);
    }
}