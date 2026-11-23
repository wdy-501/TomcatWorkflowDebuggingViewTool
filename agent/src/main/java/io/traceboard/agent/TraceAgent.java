package io.traceboard.agent;

import java.lang.instrument.Instrumentation;

import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.description.type.TypeDescription;
import net.bytebuddy.dynamic.DynamicType;
import net.bytebuddy.matcher.ElementMatchers;
import net.bytebuddy.utility.JavaModule;

/**
 * S1 java agent: instruments exactly ONE demo method and emits one controller span per call.
 *
 * <p>Target: {@code com.example.shop.controller.OrderController#cancel(long)} only. No service,
 * mapper, SQL, JDBC or other controller method is touched. The agent is fail-open: every
 * {@code Throwable} is swallowed and the host application is never blocked or broken.</p>
 *
 * <p>Start with:
 * {@code -javaagent:traceboard-agent-0.1.0-SNAPSHOT.jar -Dtraceboard.ingestUrl=... -Dtraceboard.sessionId=...}</p>
 */
public final class TraceAgent {

    static final String TARGET_TYPE = "com.example.shop.controller.OrderController";

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
            log("premain installed: target=" + TARGET_TYPE + "#cancel(long), ingestUrl="
                    + config.ingestUrl() + ", sessionId=" + config.sessionId());
        } catch (Throwable t) {
            log("premain failed, continuing without instrumentation (fail-open): " + t);
        }
    }

    private static void install(Instrumentation inst) {
        AgentBuilder builder = new AgentBuilder.Default()
                .disableClassFormatChanges()
                .with(AgentBuilder.RedefinitionStrategy.DISABLED)
                .ignore(ElementMatchers.nameStartsWith("java.")
                        .or(ElementMatchers.nameStartsWith("jdk."))
                        .or(ElementMatchers.nameStartsWith("sun."))
                        .or(ElementMatchers.nameStartsWith("com.sun."))
                        .or(ElementMatchers.nameStartsWith("org.springframework."))
                        .or(ElementMatchers.nameStartsWith("net.bytebuddy."))
                        .or(ElementMatchers.nameStartsWith("io.traceboard.agent."))
                        .or(ElementMatchers.isSynthetic()))
                .type(ElementMatchers.named(TARGET_TYPE))
                .transform(new AgentBuilder.Transformer() {
                    @Override
                    public DynamicType.Builder<?> transform(DynamicType.Builder<?> builder,
                                                            TypeDescription typeDescription,
                                                            ClassLoader classLoader,
                                                            JavaModule module,
                                                            java.security.ProtectionDomain protectionDomain) {
                        return builder.visit(Advice.to(CancelAdvice.class)
                                .on(ElementMatchers.named("cancel")
                                        .and(ElementMatchers.takesArguments(long.class))));
                    }
                })
                .with(new LoggingListener());
        builder.installOn(inst);
    }

    static void log(String message) {
        try {
            System.err.println("[traceboard-agent] " + message);
        } catch (Throwable ignored) {
            // stderr unavailable: never affect the host application
        }
    }

    /**
     * Byte Buddy listener: proves in the log whether the transform actually hit the target type.
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
