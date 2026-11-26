package io.traceboard.agent;

import java.lang.instrument.Instrumentation;

import io.traceboard.agent.generic.GenericAgent;
import io.traceboard.agent.generic.GenericConfig;

import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.description.type.TypeDescription;
import net.bytebuddy.dynamic.DynamicType;
import net.bytebuddy.matcher.ElementMatcher;
import net.bytebuddy.matcher.ElementMatchers;
import net.bytebuddy.utility.JavaModule;

/**
 * S6b java agent: instruments the S2 four-point chain, the three S5 advice points, the S6a
 * reconcile controller and the three S6b demo controllers (11 advice / 5 Byte Buddy types) plus TWO
 * dedicated ASM transformers (line-level probes in {@code L2DemoService#reconcileAmount} /
 * {@code #reconcileLoop}; enter/exit only in the no-debug {@code NoDebugService#compute}).
 *
 * <pre>
 * controller  com.example.shop.controller.OrderController#cancel(long)               -> root span
 * service     com.example.shop.service.OrderService#cancel(long)                     -> child
 * mapper      org.apache.ibatis.binding.MapperProxy#invoke  (filter: OrderMapper#cancelById) -> child
 * sql         org.apache.ibatis.executor.statement.PreparedStatementHandler#update
 *             (filter: mapped statement id .OrderMapper.cancelById)                  -> child (rowsAffected)
 * controller  com.example.shop.controller.OrderController#previewDiscount(long,double,String,String) -> span (S5, no values)
 * service     com.example.shop.service.OrderService#previewDiscount(long,double,String,String)       -> span (S5, 5 values, flag L1)
 * field       com.example.shop.model.Order#setAmount(double)                          -> no span (S5, appends amount 100->0)
 * controller  com.example.shop.controller.OrderController#reconcile(long)             -> span (S6a, no values)
 * service     com.example.shop.service.L2DemoService#reconcileAmount(long,double,int)  -> span (S6a ASM, line-level values, flag L2)
 * controller  com.example.shop.controller.OrderController#reconcileAsync(long)         -> span (S6b, no values)
 * controller  com.example.shop.controller.OrderController#noDebug(long)                -> span (S6b, no values)
 * controller  com.example.shop.controller.OrderController#reconcileLoop(long,int)      -> span (S6b, no values)
 * service     com.example.shop.service.L2DemoService#reconcileLoop(long,int)           -> span (S6b ASM, folded values, flag L2)
 * service     com.example.shop.service.NoDebugService#compute(double)                  -> span (S6b ASM, no LVT: NOT_COLLECTED_NO_DEBUG_INFO)
 * </pre>
 *
 * <p>The two service classes are instrumented by dedicated ASM transformers
 * ({@link L2ClassFileTransformer}, {@link NoDebugClassFileTransformer}; exact class match) and are
 * explicitly ignored by Byte Buddy, so no class is ever touched by both.</p>
 *
 * <p>Nothing else is instrumented. The agent is fail-open: every {@code Throwable} is swallowed and
 * the host application is never blocked or broken.</p>
 *
 * <p>S4 adds one diagnostic handshake (not an event, no extra instrumentation point): after the
 * premain configuration completes, a daemon thread posts {@code /v1/agent-hello} (see
 * {@link AgentHello}); it never blocks startup.</p>
 */
public final class TraceAgent {

    static final String CONTROLLER_TYPE = "com.example.shop.controller.OrderController";
    static final String SERVICE_TYPE = "com.example.shop.service.OrderService";
    static final String MAPPER_PROXY_TYPE = "org.apache.ibatis.binding.MapperProxy";
    static final String STATEMENT_HANDLER_TYPE = "org.apache.ibatis.executor.statement.PreparedStatementHandler";
    static final String ORDER_TYPE = "com.example.shop.model.Order";
    /** S6a: the single class handled by the dedicated ASM transformer; Byte Buddy ignores it. */
    static final String L2_SERVICE_TYPE = "com.example.shop.service.L2DemoService";
    /** S6b: no-debug class handled by its own ASM transformer; Byte Buddy ignores it. */
    static final String NO_DEBUG_SERVICE_TYPE = "com.example.shop.service.NoDebugService";

    private TraceAgent() {
        // utility class, never instantiated
    }

    /**
     * JVM entry point; never throws.
     */
    public static void premain(String agentArgs, Instrumentation inst) {
        try {
            // Generic (own-project) mode: opt-in only (traceboard.mode=generic or mode=generic in
            // agentArgs). The demo path below is byte-for-byte the S6b installation.
            if (GenericConfig.isGenericMode(agentArgs)) {
                GenericAgent.install(inst, agentArgs);
                return;
            }
            AgentConfig config = AgentConfig.fromSystemProperties();
            if (!config.isEnabled()) {
                log("noop premain: traceboard.ingestUrl is not set or traceboard.enabled=false (fail-open)");
                return;
            }
            SpanEmitter.init(config);
            install(inst);
            // S4 handshake: daemon thread, <=3 attempts, 1s timeouts, fail-open (never blocks).
            AgentHello.start(config);
            log("premain installed: targets=" + CONTROLLER_TYPE
                    + "#cancel(long)/#previewDiscount(long,double,String,String)/#reconcile(long)"
                    + "/#reconcileAsync(long)/#noDebug(long)/#reconcileLoop(long,int), "
                    + SERVICE_TYPE + "#cancel(long)/#previewDiscount(long,double,String,String), "
                    + MAPPER_PROXY_TYPE + "#invoke, " + STATEMENT_HANDLER_TYPE + "#update, "
                    + ORDER_TYPE + "#setAmount(double), " + L2_SERVICE_TYPE
                    + "#reconcileAmount|#reconcileLoop (ASM), " + NO_DEBUG_SERVICE_TYPE
                    + "#compute (ASM, no-debug); ingestUrl="
                    + config.ingestUrl() + ", sessionId=" + config.sessionId());
        } catch (Throwable t) {
            log("premain failed, continuing without instrumentation (fail-open): " + t);
        }
    }

    private static void install(Instrumentation inst) {
        // S6a: dedicated, exact-class transformer for the line-level L2 probes. Byte Buddy never
        // touches this type (explicit ignore below), so the two transformers cannot take over the
        // same class. Errors return the original bytes (fail-open).
        try {
            inst.addTransformer(new L2ClassFileTransformer(), false);
        } catch (Throwable t) {
            log("l2_transformer_register_failed (fail-open): " + t.getClass().getName());
        }
        // S6b: dedicated exact-class transformer for the no-debug class (no LVT probe; enter/exit
        // only). Byte Buddy never touches this type (explicit ignore below). Errors return the
        // original bytes (fail-open); an LVT present in the built class is logged and NOT
        // instrumented (build fallback -> gate must fail).
        try {
            inst.addTransformer(new NoDebugClassFileTransformer(), false);
        } catch (Throwable t) {
            log("nodebug_transformer_register_failed (fail-open): " + t.getClass().getName());
        }
        AgentBuilder builder = new AgentBuilder.Default()
                .disableClassFormatChanges()
                .with(AgentBuilder.RedefinitionStrategy.DISABLED)
                // org.apache.ibatis.* MUST stay instrumentable (mapper + sql points); only JDK,
                // Spring, Byte Buddy, the agent itself and the two ASM-only service types are
                // excluded.
                .ignore(ElementMatchers.nameStartsWith("java.")
                        .or(ElementMatchers.nameStartsWith("jdk."))
                        .or(ElementMatchers.nameStartsWith("sun."))
                        .or(ElementMatchers.nameStartsWith("com.sun."))
                        .or(ElementMatchers.nameStartsWith("org.springframework."))
                        .or(ElementMatchers.nameStartsWith("net.bytebuddy."))
                        .or(ElementMatchers.nameStartsWith("io.traceboard.agent."))
                        .or(ElementMatchers.named(L2_SERVICE_TYPE))
                        .or(ElementMatchers.named(NO_DEBUG_SERVICE_TYPE))
                        .or(ElementMatchers.isSynthetic()))
                .type(ElementMatchers.named(CONTROLLER_TYPE))
                .transform(advice(ControllerAdvice.class,
                        ElementMatchers.named("cancel").and(ElementMatchers.takesArguments(long.class))))
                .transform(advice(RemarkControllerAdvice.class,
                        ElementMatchers.named("remark").and(ElementMatchers.takesArguments(2))))
                .transform(advice(PreviewControllerAdvice.class,
                        ElementMatchers.named("previewDiscount").and(ElementMatchers.takesArguments(
                                long.class, double.class, String.class, String.class))))
                .transform(advice(ReconcileControllerAdvice.class,
                        ElementMatchers.named("reconcile").and(ElementMatchers.takesArguments(long.class))))
                .transform(advice(AsyncControllerAdvice.class,
                        ElementMatchers.named("reconcileAsync").and(ElementMatchers.takesArguments(long.class))))
                .transform(advice(NoDebugControllerAdvice.class,
                        ElementMatchers.named("noDebug").and(ElementMatchers.takesArguments(long.class))))
                .transform(advice(LoopControllerAdvice.class,
                        ElementMatchers.named("reconcileLoop").and(ElementMatchers.takesArguments(
                                long.class, int.class))))
                .type(ElementMatchers.named(SERVICE_TYPE))
                .transform(advice(ServiceAdvice.class,
                        ElementMatchers.named("cancel").and(ElementMatchers.takesArguments(long.class))))
                .transform(advice(PreviewServiceAdvice.class,
                        ElementMatchers.named("previewDiscount").and(ElementMatchers.takesArguments(
                                long.class, double.class, String.class, String.class))))
                .type(ElementMatchers.named(ORDER_TYPE))
                .transform(advice(FieldWriteAdvice.class,
                        ElementMatchers.named("setAmount").and(ElementMatchers.takesArguments(double.class))))
                .type(ElementMatchers.named(MAPPER_PROXY_TYPE))
                .transform(advice(MapperAdvice.class,
                        ElementMatchers.named("invoke").and(ElementMatchers.takesArguments(3))))
                .type(ElementMatchers.named(STATEMENT_HANDLER_TYPE))
                .transform(advice(SqlAdvice.class,
                        ElementMatchers.named("update").and(ElementMatchers.takesArguments(1))))
                .with(new LoggingListener());
        builder.installOn(inst);
    }

    private static AgentBuilder.Transformer advice(final Class<?> adviceClass,
                                                   final ElementMatcher<? super net.bytebuddy.description.method.MethodDescription> methodMatcher) {
        return new AgentBuilder.Transformer() {
            @Override
            public DynamicType.Builder<?> transform(DynamicType.Builder<?> builder,
                                                    TypeDescription typeDescription,
                                                    ClassLoader classLoader,
                                                    JavaModule module,
                                                    java.security.ProtectionDomain protectionDomain) {
                return builder.visit(Advice.to(adviceClass).on(methodMatcher));
            }
        };
    }

    static void log(String message) {
        try {
            System.err.println("[traceboard-agent] " + message);
        } catch (Throwable ignored) {
            // stderr unavailable: never affect the host application
        }
    }

    /**
     * Byte Buddy listener: proves in the log whether the transform actually hit each target type.
     */
    private static final class LoggingListener implements AgentBuilder.Listener {

        @Override
        public void onDiscovery(String typeName, ClassLoader classLoader, JavaModule module, boolean loaded) {
            // no-op
        }

        @Override
        public void onTransformation(TypeDescription typeDescription, ClassLoader classLoader,
                                     JavaModule module, boolean loaded, DynamicType dynamicType) {
            log("transformed " + typeDescription.getName());
        }

        @Override
        public void onIgnored(TypeDescription typeDescription, ClassLoader classLoader,
                              JavaModule module, boolean loaded) {
            // no-op
        }

        @Override
        public void onError(String typeName, ClassLoader classLoader, JavaModule module,
                            boolean loaded, Throwable throwable) {
            log("transform error type=" + typeName + ": " + throwable);
        }

        @Override
        public void onComplete(String typeName, ClassLoader classLoader, JavaModule module, boolean loaded) {
            // no-op
        }
    }
}
