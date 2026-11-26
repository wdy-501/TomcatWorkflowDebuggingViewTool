package io.traceboard.agent.generic;

import java.lang.reflect.Method;

import net.bytebuddy.asm.Advice;
import net.bytebuddy.implementation.bytecode.assign.Assigner;

/**
 * Advice applied to every public, non-constructor/synthetic/bridge method of a matched
 * application class. The enter token is the frame created by {@link GenericSpanContext}; when it
 * is {@code null} (no parent for an auto-scanned method, budget/depth drop, reentrancy) the exit is
 * a no-op. The return binding uses dynamic typing so void methods (bound to {@code null}) and
 * primitive returns are instrumentable by the same advice.
 */
public final class GenericMethodAdvice {

    private GenericMethodAdvice() {
    }

    @Advice.OnMethodEnter
    public static Object onEnter(@Advice.Origin Method method,
                                 @Advice.AllArguments Object[] args) {
        return GenericSpanContext.enter(method, args);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter Object token,
                              @Advice.Return(readOnly = true, typing = Assigner.Typing.DYNAMIC) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        GenericSpanContext.exit(token, returned, thrown);
    }
}