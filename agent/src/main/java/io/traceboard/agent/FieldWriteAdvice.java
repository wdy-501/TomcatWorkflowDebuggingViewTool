package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * S5 field advice for {@code com.example.shop.model.Order#setAmount(double)}.
 *
 * <p>Never emits a span: on entry it reads the old amount reflectively (via {@code getAmount()}),
 * takes the new value from the argument and asks {@link SpanContext#recordFieldWrite} to append an
 * {@code amount 100 -> 0} item to the current preview service frame. All guards (exact class name,
 * preview service frame on top, no {@code org.apache.ibatis} frame between the advice and
 * {@code previewDiscount}, {@code old != new}) live in {@code SpanContext}; any {@code Throwable}
 * is swallowed (fail-open).</p>
 */
public final class FieldWriteAdvice {

    private FieldWriteAdvice() {
    }

    @Advice.OnMethodEnter
    public static void onEnter(@Advice.This(optional = true) Object target,
                               @Advice.Argument(0) double newValue) {
        SpanContext.recordFieldWrite(target, "amount", newValue);
    }
}