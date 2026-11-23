package io.traceboard.agent;

import java.lang.reflect.Method;

import net.bytebuddy.asm.Advice;

/**
 * Advice for {@code org.apache.ibatis.binding.MapperProxy#invoke} (kind {@code mapper}).
 *
 * <p>The proxy method serves every mapper interface, so the match is decided inside the advice:
 * only {@code com.example.shop.mapper.OrderMapper#cancelById} opens a frame. Other mapper methods
 * (for example the existence check {@code countById}) stay uninstrumented - a documented S2
 * coverage limit, never synthesised.</p>
 */
public final class MapperAdvice {

    private MapperAdvice() {
    }

    @Advice.OnMethodEnter
    public static long onEnter(@Advice.Argument(value = 1, readOnly = true) Method method) {
        long enterNs = System.nanoTime();
        if (SpanContext.isTargetMapperMethod(method)) {
            SpanContext.enterMapper(enterNs);
            return enterNs;
        }
        return 0L;
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void onExit(@Advice.Enter long enterNs,
                              @Advice.Return(readOnly = true) Object returned,
                              @Advice.Thrown(readOnly = true) Throwable thrown) {
        if (enterNs == 0L) {
            return;
        }
        SpanContext.exitMapper(enterNs, returned, thrown);
    }
}
