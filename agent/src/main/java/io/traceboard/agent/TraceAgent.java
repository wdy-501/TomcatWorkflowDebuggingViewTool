package io.traceboard.agent;

import java.lang.instrument.Instrumentation;

import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.description.type.TypeDescription;
import net.bytebuddy.dynamic.DynamicType;
import net.bytebuddy.matcher.ElementMatcher;
import net.bytebuddy.matcher.ElementMatchers;
import net.bytebuddy.utility.JavaModule;

/**
 * S2 java agent: instruments exactly FOUR demo points and emits the 0-row fact chain.
 *
 * <pre>
 * controller  com.example.shop.controller.OrderController#cancel(long)               -> root span
 * service     com.example.shop.service.OrderService#cancel(long)                     -> child
 * mapper      org.apache.ibatis.binding.MapperProxy#invoke  (filter: OrderMapper#cancelById) -> child
 * sql         org.apache.ibatis.executor.statement.PreparedStatementHandler#update
 *             (filter: mapped statement id .OrderMapper.cancelById)                  -> child (rowsAffected)
 * </pre>
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

    private TraceAgent() {
        // utility class, never instantiated
    }

    /**
     * JVM entry point; never throws.
     */
    public static void premain(String agentArgs, Instrumentation inst) {
        try {
            AgentConfig config = AgentConfig.fromSystemProperties();
            if (!config.isEnabled()) {
                log("noop premain: traceboard.ingestUrl is not set or traceboard.enabled=false (fail-open)");
                return;
            }
            SpanEmitter.init(config);
            install(inst);
            // S4 handshake: daemon thread, <=3 attempts, 1s timeouts, fail-open (never blocks).
            AgentHello.start(config);
            log("premain installed: targets=" + CONTROLLER_TYPE + "#cancel(long), "
                    + SERVICE_TYPE + "#cancel(long), " + MAPPER_PROXY_TYPE + "#invoke, "
                    + STATEMENT_HANDLER_TYPE + "#update; ingestUrl=" + config.ingestUrl()
                    + ", sessionId=" + config.sessionId());
        } catch (Throwable t) {
            log("premain failed, continuing without instrumentation (fail-open): " + t);
        }
    }

    private static void install(Instrumentation inst) {
        AgentBuilder builder = new AgentBuilder.Default()
                .disableClassFormatChanges()
                .with(AgentBuilder.RedefinitionStrategy.DISABLED)
                // org.apache.ibatis.* MUST stay instrumentable (mapper + sql points); only JDK,
                // Spring, Byte Buddy and the agent itself are excluded.
                .ignore(ElementMatchers.nameStartsWith("java.")
                        .or(ElementMatchers.nameStartsWith("jdk."))
                        .or(ElementMatchers.nameStartsWith("sun."))
                        .or(ElementMatchers.nameStartsWith("com.sun."))
                        .or(ElementMatchers.nameStartsWith("org.springframework."))
                        .or(ElementMatchers.nameStartsWith("net.bytebuddy."))
                        .or(ElementMatchers.nameStartsWith("io.traceboard.agent."))
                        .or(ElementMatchers.isSynthetic()))
                .type(ElementMatchers.named(CONTROLLER_TYPE))
                .transform(advice(ControllerAdvice.class,
                        ElementMatchers.named("cancel").and(ElementMatchers.takesArguments(long.class))))
                .type(ElementMatchers.named(SERVICE_TYPE))
                .transform(advice(ServiceAdvice.class,
                        ElementMatchers.named("cancel").and(ElementMatchers.takesArguments(long.class))))
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
