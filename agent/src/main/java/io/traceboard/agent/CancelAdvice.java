package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * Advice for the single instrumented method {@code OrderController#cancel(long)}.
 *
 * <p>Inlined by Byte Buddy: records a monotonic enter timestamp, then on exit (normal or
 * throwing) forwards the timestamps plus the return value / throwable to
 * {@link SpanEmitter#emit}. No application objects are created here and no business getter
 * is invoked.</p>
 */
public final class CancelAdvice {

    private CancelAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        return System.nanoTime();
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanEmitter.emit(enterNs, returned, thrown);
    }
}
