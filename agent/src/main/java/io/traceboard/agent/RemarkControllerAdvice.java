package io.traceboard.agent;

import net.bytebuddy.asm.Advice;

/**
 * Advice for {@code OrderController#remark(long,Map)} (request-body demo). The controller span
 * joins the frontend fetch via headers exactly like the other controller advices; it emits no
 * service/mapper/sql children. The request body itself is captured by the runtime SDK on the
 * fetch span, not by this agent.
 */
public final class RemarkControllerAdvice {

    private RemarkControllerAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter() {
        long enterNs = System.nanoTime();
        SpanContext.enterRemarkController(enterNs);
        return enterNs;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        SpanContext.exitController(enterNs, returned, thrown);
    }
}