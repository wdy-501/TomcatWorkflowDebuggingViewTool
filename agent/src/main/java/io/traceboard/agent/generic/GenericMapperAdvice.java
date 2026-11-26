package io.traceboard.agent.generic;

import java.lang.reflect.Method;

import net.bytebuddy.asm.Advice;
import net.bytebuddy.implementation.bytecode.assign.Assigner;

/**
 * Advice for {@code org.apache.ibatis.binding.MapperProxy#invoke}. The mapper interface method is
 * argument 1 and the call arguments are argument 2; only interface methods inside an instrumented
 * trace produce a {@code mapper} span (node key {@code interface#method}).
 */
public final class GenericMapperAdvice {

    private GenericMapperAdvice() {
    }

    @Advice.OnMethodEnter
    public static Object onEnter(@Advice.Argument(value = 1, readOnly = true) Method method,
                                 @Advice.Argument(value = 2, readOnly = true) Object[] args) {
        return GenericSpanContext.enterMapper(method, args);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter Object token,
                              @Advice.Return(readOnly = true, typing = Assigner.Typing.DYNAMIC) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        GenericSpanContext.exitMapper(token, returned, thrown);
    }
}