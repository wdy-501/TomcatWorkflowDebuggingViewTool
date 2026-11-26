package io.traceboard.agent.generic;

import java.lang.instrument.Instrumentation;
import java.security.ProtectionDomain;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import io.traceboard.agent.GenericBridge;

import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.description.annotation.AnnotationDescription;
import net.bytebuddy.description.method.MethodDescription;
import net.bytebuddy.description.type.TypeDescription;
import net.bytebuddy.dynamic.DynamicType;
import net.bytebuddy.matcher.ElementMatcher;
import net.bytebuddy.matcher.ElementMatchers;
import net.bytebuddy.utility.JavaModule;

/**
 * Load-time installer for the generic mode ({@code traceboard.mode=generic}).
 *
 * <p>One Byte Buddy {@link AgentBuilder} with three targets:</p>
 *
 * <ol>
 *   <li>application classes: the {@code include} prefixes plus any {@code @Controller}/
 *       {@code @RestController} class (also outside {@code include}); every public, non-constructor,
 *       non-synthetic, non-bridge, non-abstract/native method is advised. Explicit
 *       {@code includeMethod} classes outside {@code include} only get their named method;</li>
 *   <li>{@code org.apache.ibatis.binding.MapperProxy#invoke} -&gt; {@code mapper};</li>
 *   <li>{@code org.apache.ibatis.executor.statement.PreparedStatementHandler}
 *       {@code query/update/batch/execute} -&gt; {@code sql}.</li>
 * </ol>
 *
 * <p>JDK, {@code javax}/{@code jakarta}, Spring, MyBatis infrastructure, logging, serializers,
 * agent/byte-code libraries, synthetic types, enums, interfaces and generated proxy classes
 * ({@code $$}) are ignored. Everything is fail-open: a class that cannot be transformed keeps its
 * original bytes and the application continues.</p>
 */
public final class GenericAgent {

    private static final String CONTROLLER = "org.springframework.stereotype.Controller";
    private static final String REST_CONTROLLER = "org.springframework.web.bind.annotation.RestController";

    private static final Set<String> CONTROLLER_ANNOTATIONS =
            new java.util.HashSet<String>(java.util.Arrays.asList(CONTROLLER, REST_CONTROLLER));

    private GenericAgent() {
    }

    public static void install(Instrumentation inst, String agentArgs) {
        try {
            GenericConfig config = GenericConfig.from(agentArgs);
            if (!config.isEnabled()) {
                GenericBridge.log("generic noop: reason=" + config.disabledReason() + " (fail-open)");
                return;
            }
            GenericConfig.setCurrent(config);
            GenericEmitter.init();
            GenericBridge.init(config.ingestUrl(), config.sessionId(),
                    Math.max(256, config.maxSpansPerTrace() * 4));
            if (!GenericBridge.active()) {
                GenericBridge.log("generic noop: sender unavailable (fail-open)");
                return;
            }
            GenericBridge.hello(config.ingestUrl(), config.sessionId());
            if (config.include().isEmpty()) {
                GenericBridge.log("generic_include_empty: only @Controller/@RestController classes"
                        + " are auto-detected; pass traceboard.include=<basePackage> to scan services");
            }
            installBuilder(inst, config);
            GenericBridge.log("generic_installed " + config.describe()
                    + " ingestUrl=" + config.ingestUrl() + " sessionId=" + config.sessionId());
        } catch (Throwable t) {
            GenericBridge.log("generic_install_failed (fail-open): " + t.getClass().getName());
        }
    }

    private static void installBuilder(Instrumentation inst, final GenericConfig config) {
        final ElementMatcher.Junction<TypeDescription> appTypes = appTypeMatcher(config);
        final ElementMatcher.Junction<MethodDescription> publicMethods = publicMethodMatcher();
        final ElementMatcher.Junction<MethodDescription> explicitMethods =
                explicitMethodMatcher(config, publicMethods);

        AgentBuilder builder = new AgentBuilder.Default()
                .disableClassFormatChanges()
                .with(AgentBuilder.RedefinitionStrategy.DISABLED)
                .ignore(ignoreMatcher(config))
                .type(appTypes)
                .transform(transformer(GenericMethodAdvice.class, publicMethods))
                .type(explicitOnlyMatcher(config, appTypes))
                .transform(transformer(GenericMethodAdvice.class, explicitMethods))
                .type(ElementMatchers.named(GenericMyBatis.MAPPER_PROXY))
                .transform(transformer(GenericMapperAdvice.class, mapperMethodMatcher()))
                .type(ElementMatchers.named(GenericMyBatis.STATEMENT_HANDLER))
                .transform(transformer(GenericSqlAdvice.class, sqlMethodMatcher()))
                .with(new GenericListener());
        builder.installOn(inst);
        GenericBridge.log("generic_targets app=true mapper=" + GenericMyBatis.MAPPER_PROXY
                + " sql=" + GenericMyBatis.STATEMENT_HANDLER
                + " explicitClasses=" + config.includeClasses().size());
    }

    // ------------------------------------------------------------------ matchers

    private static ElementMatcher.Junction<TypeDescription> appTypeMatcher(final GenericConfig config) {
        return new ElementMatcher.Junction.AbstractBase<TypeDescription>() {
            @Override
            public boolean matches(TypeDescription target) {
                try {
                    if (!instrumentableType(target)) {
                        return false;
                    }
                    String name = target.getName();
                    if (GenericMyBatis.MAPPER_PROXY.equals(name)
                            || GenericMyBatis.STATEMENT_HANDLER.equals(name)) {
                        // handled by the dedicated mapper/sql advices only
                        return false;
                    }
                    if (config.matchesInclude(name)) {
                        return true;
                    }
                    return hasControllerAnnotation(target);
                } catch (Throwable ignored) {
                    return false;
                }
            }
        };
    }

    private static ElementMatcher.Junction<TypeDescription> explicitOnlyMatcher(
            final GenericConfig config, final ElementMatcher.Junction<TypeDescription> appTypes) {
        return new ElementMatcher.Junction.AbstractBase<TypeDescription>() {
            @Override
            public boolean matches(TypeDescription target) {
                try {
                    if (!instrumentableType(target)) {
                        return false;
                    }
                    String name = target.getName();
                    if (!config.includeClasses().contains(name)) {
                        return false;
                    }
                    return !appTypes.matches(target);
                } catch (Throwable ignored) {
                    return false;
                }
            }
        };
    }

    private static ElementMatcher.Junction<MethodDescription> publicMethodMatcher() {
        return new ElementMatcher.Junction.AbstractBase<MethodDescription>() {
            @Override
            public boolean matches(MethodDescription target) {
                try {
                    return target != null
                            && target.isMethod()
                            && target.isPublic()
                            && !target.isConstructor()
                            && !target.isTypeInitializer()
                            && !target.isAbstract()
                            && !target.isNative()
                            && !target.isSynthetic()
                            && !target.isBridge();
                } catch (Throwable ignored) {
                    return false;
                }
            }
        };
    }

    private static ElementMatcher.Junction<MethodDescription> explicitMethodMatcher(
            final GenericConfig config,
            final ElementMatcher.Junction<MethodDescription> publicMethods) {
        return new ElementMatcher.Junction.AbstractBase<MethodDescription>() {
            @Override
            public boolean matches(MethodDescription target) {
                try {
                    if (!publicMethods.matches(target)) {
                        return false;
                    }
                    String entry = target.getDeclaringType().asErasure().getName() + "#" + target.getName();
                    return config.includeMethodEntries().contains(entry);
                } catch (Throwable ignored) {
                    return false;
                }
            }
        };
    }

    private static ElementMatcher.Junction<MethodDescription> mapperMethodMatcher() {
        return new ElementMatcher.Junction.AbstractBase<MethodDescription>() {
            @Override
            public boolean matches(MethodDescription target) {
                try {
                    return target != null && target.isMethod() && target.isPublic()
                            && "invoke".equals(target.getName())
                            && target.getParameters().size() == 3;
                } catch (Throwable ignored) {
                    return false;
                }
            }
        };
    }

    private static ElementMatcher.Junction<MethodDescription> sqlMethodMatcher() {
        return new ElementMatcher.Junction.AbstractBase<MethodDescription>() {
            @Override
            public boolean matches(MethodDescription target) {
                try {
                    if (target == null || !target.isMethod() || !target.isPublic()) {
                        return false;
                    }
                    String name = target.getName();
                    return "query".equals(name) || "update".equals(name)
                            || "batch".equals(name) || "execute".equals(name);
                } catch (Throwable ignored) {
                    return false;
                }
            }
        };
    }

    private static ElementMatcher.Junction<TypeDescription> ignoreMatcher(final GenericConfig config) {
        return new ElementMatcher.Junction.AbstractBase<TypeDescription>() {
            @Override
            public boolean matches(TypeDescription target) {
                try {
                    if (target == null) {
                        return true;
                    }
                    String name = target.getName();
                    if (GenericMyBatis.MAPPER_PROXY.equals(name)
                            || GenericMyBatis.STATEMENT_HANDLER.equals(name)) {
                        // Explicit targets stay instrumentable even though org.apache.ibatis is a
                        // default exclude for the application scan.
                        return false;
                    }
                    if (!instrumentableType(target)) {
                        return true;
                    }
                    return config.isExcluded(name);
                } catch (Throwable ignored) {
                    return true;
                }
            }
        };
    }

    /** Type-level preconditions shared by the app matcher and the ignore matcher. */
    private static boolean instrumentableType(TypeDescription target) {
        try {
            if (target == null) {
                return false;
            }
            String name = target.getName();
            if (name == null || name.isEmpty()) {
                return false;
            }
            if (name.contains("$$")) {
                // Spring/CGLIB/Byte Buddy generated subclass: the target class is advised instead.
                return false;
            }
            return !target.isInterface()
                    && !target.isEnum()
                    && !target.isAnnotation()
                    && !target.isSynthetic()
                    && !target.isArray()
                    && !target.isPrimitive()
                    && !target.isAnonymousType()
                    && !target.isLocalType();
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static boolean hasControllerAnnotation(TypeDescription target) {
        try {
            for (AnnotationDescription annotation : target.getDeclaredAnnotations()) {
                String name = annotation.getAnnotationType().getName();
                if (CONTROLLER_ANNOTATIONS.contains(name)) {
                    return true;
                }
                for (AnnotationDescription meta : annotation.getAnnotationType().getDeclaredAnnotations()) {
                    if (CONTROLLER_ANNOTATIONS.contains(meta.getAnnotationType().getName())) {
                        return true;
                    }
                }
            }
        } catch (Throwable ignored) {
            // a missing/odd annotation type never makes a class a controller
        }
        return false;
    }

    private static AgentBuilder.Transformer transformer(final Class<?> adviceClass,
                                                       final ElementMatcher<? super MethodDescription> matcher) {
        return new AgentBuilder.Transformer() {
            @Override
            public DynamicType.Builder<?> transform(DynamicType.Builder<?> builder,
                                                    TypeDescription typeDescription,
                                                    ClassLoader classLoader,
                                                    JavaModule module,
                                                    ProtectionDomain protectionDomain) {
                return builder.visit(Advice.to(adviceClass).on(matcher));
            }
        };
    }

    /** {@code -Dtraceboard.genericDebug=true} prints full transform stacks (local debugging only). */
    static boolean debugEnabled() {
        try {
            return Boolean.parseBoolean(System.getProperty("traceboard.genericDebug"));
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Byte Buddy listener: proves in the log which classes were transformed and counts failures
     * without ever echoing an exception message.
     */
    private static final class GenericListener implements AgentBuilder.Listener {

        private final AtomicLong transformed = new AtomicLong();
        private final AtomicLong errors = new AtomicLong();

        @Override
        public void onDiscovery(String typeName, ClassLoader classLoader, JavaModule module, boolean loaded) {
            // no-op
        }

        @Override
        public void onTransformation(TypeDescription typeDescription, ClassLoader classLoader,
                                     JavaModule module, boolean loaded, DynamicType dynamicType) {
            long count = transformed.incrementAndGet();
            if (count <= 20L || count % 100L == 0L) {
                GenericBridge.log("generic_transformed=" + count + " type=" + typeDescription.getName());
            }
        }

        @Override
        public void onIgnored(TypeDescription typeDescription, ClassLoader classLoader,
                              JavaModule module, boolean loaded) {
            // no-op
        }

        @Override
        public void onError(String typeName, ClassLoader classLoader, JavaModule module,
                            boolean loaded, Throwable throwable) {
            long count = errors.incrementAndGet();
            if (count <= 20L || count % 100L == 0L) {
                GenericBridge.log("generic_transform_error=" + count + " type=" + typeName
                        + " cause=" + throwable.getClass().getName());
            }
            if (debugEnabled()) {
                try {
                    java.io.StringWriter writer = new java.io.StringWriter();
                    throwable.printStackTrace(new java.io.PrintWriter(writer));
                    GenericBridge.log("generic_transform_error_detail type=" + typeName + "\n" + writer);
                } catch (Throwable ignored) {
                    // debug output is best-effort
                }
            }
        }

        @Override
        public void onComplete(String typeName, ClassLoader classLoader, JavaModule module, boolean loaded) {
            // no-op
        }
    }
}