package io.traceboard.agent.generic;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Static per-method metadata for the generic mode: node key, span kind, explicit-include state,
 * parameter names and capture policy.
 *
 * <p>Spring detection is name-based ({@code Controller}/{@code RestController} class annotations,
 * mapping method annotations, one meta-annotation level, plus interface/superclass declarations) so
 * the agent never references Spring types at compile time. Overloads add their short parameter
 * types to the node key ({@code FQCN#method} is used for unique names); parameter names fall back
 * to {@code argN} when the class was compiled without {@code -parameters}.</p>
 *
 * <p>All lookups are cached and fail-open: an introspection failure degrades to the plain-{@code
 * service} kind, never to a thrown exception.</p>
 */
final class GenericMeta {

    static final String KIND_CONTROLLER = "controller";
    static final String KIND_SERVICE = "service";
    static final String KIND_MAPPER = "mapper";
    static final String KIND_SQL = "sql";

    private static final Set<String> CONTROLLER_ANNOTATIONS = new HashSet<String>(Arrays.asList(
            "org.springframework.stereotype.Controller",
            "org.springframework.web.bind.annotation.RestController"));

    private static final Set<String> MAPPING_ANNOTATIONS = new HashSet<String>(Arrays.asList(
            "org.springframework.web.bind.annotation.RequestMapping",
            "org.springframework.web.bind.annotation.GetMapping",
            "org.springframework.web.bind.annotation.PostMapping",
            "org.springframework.web.bind.annotation.PutMapping",
            "org.springframework.web.bind.annotation.DeleteMapping",
            "org.springframework.web.bind.annotation.PatchMapping"));

    private static final int MAX_NODE_KEY = 512;
    private static final int MAX_PARAM_NAME = 128;
    private static final int MAX_CACHE = 20000;
    private static final int MAX_TYPE_SEARCH = 16;

    private static final ConcurrentHashMap<Method, Meta> CACHE = new ConcurrentHashMap<Method, Meta>();
    private static final ConcurrentHashMap<String, Boolean> CONTROLLER_TYPES =
            new ConcurrentHashMap<String, Boolean>();

    private GenericMeta() {
    }

    /** Immutable method facts consumed by {@link GenericSpanContext}. */
    static final class Meta {
        final String nodeKey;
        final String kind;
        final boolean controller;
        final boolean explicit;
        final boolean captureArgs;
        final boolean captureReturn;
        final String declaringClass;
        final String methodName;
        final String[] parameterNames;
        final String returnTypeName;

        Meta(String nodeKey, String kind, boolean controller, boolean explicit, boolean captureArgs,
             boolean captureReturn, String declaringClass, String methodName,
             String[] parameterNames, String returnTypeName) {
            this.nodeKey = nodeKey;
            this.kind = kind;
            this.controller = controller;
            this.explicit = explicit;
            this.captureArgs = captureArgs;
            this.captureReturn = captureReturn;
            this.declaringClass = declaringClass;
            this.methodName = methodName;
            this.parameterNames = parameterNames;
            this.returnTypeName = returnTypeName;
        }
    }

    static Meta of(Method method) {
        if (method == null) {
            return null;
        }
        try {
            Meta cached = CACHE.get(method);
            if (cached != null) {
                return cached;
            }
            Meta built = build(method);
            if (CACHE.size() > MAX_CACHE) {
                CACHE.clear();
            }
            CACHE.put(method, built);
            return built;
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** MyBatis mapper method (declared on the mapper interface, not on the proxy). */
    static Meta mapper(Method method) {
        if (method == null) {
            return null;
        }
        try {
            GenericConfig config = GenericConfig.current();
            Class<?> declaring = method.getDeclaringClass();
            return new Meta(nodeKey(method), KIND_MAPPER, false, false,
                    config == null || config.captureArgs(),
                    config == null || config.captureReturn(),
                    declaring.getName(), method.getName(), parameterNames(method),
                    returnTypeName(method));
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** SQL span metadata: the mapped statement id is the node key, no argument/return capture. */
    static Meta sql(String nodeKey) {
        return new Meta(truncate(nodeKey == null ? KIND_SQL : nodeKey, MAX_NODE_KEY), KIND_SQL,
                false, false, false, false, "", "", new String[0], null);
    }

    private static Meta build(Method method) {
        GenericConfig config = GenericConfig.current();
        Class<?> declaring = method.getDeclaringClass();
        boolean controller = isControllerMethod(method, declaring);
        String kind = controller ? KIND_CONTROLLER : KIND_SERVICE;
        boolean explicit = config != null && config.isExplicit(declaring.getName(), method.getName());
        return new Meta(nodeKey(method), kind, controller, explicit,
                config == null || config.captureArgs(),
                config == null || config.captureReturn(),
                declaring.getName(), method.getName(), parameterNames(method),
                returnTypeName(method));
    }

    // ------------------------------------------------------------------ Spring detection

    static boolean isControllerMethod(Method method, Class<?> declaring) {
        try {
            return isControllerType(declaring) && hasMappingAnnotation(method);
        } catch (Throwable ignored) {
            return false;
        }
    }

    static boolean isControllerType(Class<?> type) {
        try {
            if (type == null || isJdkType(type.getName())) {
                return false;
            }
            String name = type.getName();
            Boolean cached = CONTROLLER_TYPES.get(name);
            if (cached != null) {
                return cached.booleanValue();
            }
            boolean result = controllerInHierarchy(type);
            CONTROLLER_TYPES.put(name, Boolean.valueOf(result));
            return result;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static boolean controllerInHierarchy(Class<?> type) {
        int guard = 0;
        for (Class<?> current = type; current != null && current != Object.class && guard < MAX_TYPE_SEARCH;
             current = current.getSuperclass(), guard++) {
            if (hasAnnotationNamed(current.getDeclaredAnnotations(), CONTROLLER_ANNOTATIONS)) {
                return true;
            }
            for (Class<?> iface : current.getInterfaces()) {
                if (controllerOnInterface(iface, 0)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean controllerOnInterface(Class<?> type, int depth) {
        if (type == null || depth > 4 || isJdkType(type.getName())) {
            return false;
        }
        try {
            if (hasAnnotationNamed(type.getDeclaredAnnotations(), CONTROLLER_ANNOTATIONS)) {
                return true;
            }
            for (Class<?> parent : type.getInterfaces()) {
                if (controllerOnInterface(parent, depth + 1)) {
                    return true;
                }
            }
        } catch (Throwable ignored) {
            // fail-open: a missing annotation class just means "not a controller here"
        }
        return false;
    }

    private static boolean hasMappingAnnotation(Method method) {
        try {
            if (hasAnnotationNamed(method.getDeclaredAnnotations(), MAPPING_ANNOTATIONS)) {
                return true;
            }
            Class<?> declaring = method.getDeclaringClass();
            // Spring understands mapping annotations declared on implemented interfaces / super
            // classes; mirror that so interface-based controllers still root their requests.
            for (Class<?> type : relatedTypes(declaring)) {
                Method candidate = findMethod(type, method);
                if (candidate != null && candidate != method
                        && hasAnnotationNamed(candidate.getDeclaredAnnotations(), MAPPING_ANNOTATIONS)) {
                    return true;
                }
            }
        } catch (Throwable ignored) {
            // fail-open: treat as a plain service method
        }
        return false;
    }

    private static Method findMethod(Class<?> type, Method method) {
        try {
            return type.getDeclaredMethod(method.getName(), method.getParameterTypes());
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static List<Class<?>> relatedTypes(Class<?> type) {
        List<Class<?>> result = new ArrayList<Class<?>>();
        try {
            Set<Class<?>> seen = new HashSet<Class<?>>();
            ArrayDeque<Class<?>> queue = new ArrayDeque<Class<?>>();
            for (Class<?> iface : type.getInterfaces()) {
                queue.add(iface);
            }
            Class<?> parent = type.getSuperclass();
            if (parent != null && parent != Object.class) {
                queue.add(parent);
            }
            int guard = 0;
            while (!queue.isEmpty() && guard < MAX_TYPE_SEARCH) {
                guard++;
                Class<?> current = queue.poll();
                if (current == null || current == Object.class || !seen.add(current)) {
                    continue;
                }
                result.add(current);
                for (Class<?> iface : current.getInterfaces()) {
                    queue.add(iface);
                }
                Class<?> up = current.getSuperclass();
                if (up != null && up != Object.class) {
                    queue.add(up);
                }
            }
        } catch (Throwable ignored) {
            // partial hierarchy is fine
        }
        return result;
    }

    /**
     * Name-based annotation check, including one meta-annotation level (custom composed
     * annotations such as a project's own {@code @ApiGet}). Never loads the annotation type
     * eagerly beyond what the declaring class already references; failures are swallowed.
     */
    private static boolean hasAnnotationNamed(Annotation[] annotations, Set<String> names) {
        if (annotations == null || annotations.length == 0) {
            return false;
        }
        try {
            for (Annotation annotation : annotations) {
                if (annotation != null && names.contains(annotation.annotationType().getName())) {
                    return true;
                }
            }
            for (Annotation annotation : annotations) {
                try {
                    Class<? extends Annotation> type = annotation.annotationType();
                    for (Annotation meta : type.getDeclaredAnnotations()) {
                        if (meta != null && names.contains(meta.annotationType().getName())) {
                            return true;
                        }
                    }
                } catch (Throwable ignored) {
                    // one broken meta-annotation never hides the others
                }
            }
        } catch (Throwable ignored) {
            return false;
        }
        return false;
    }

    // ------------------------------------------------------------------ node key

    static String nodeKey(Method method) {
        try {
            String base = method.getDeclaringClass().getName() + "#" + method.getName();
            if (isOverloaded(method)) {
                base = base + "(" + shortTypes(method.getParameterTypes()) + ")";
            }
            return truncate(base, MAX_NODE_KEY);
        } catch (Throwable ignored) {
            return truncate(method.getName(), MAX_NODE_KEY);
        }
    }

    private static boolean isOverloaded(Method method) {
        try {
            Method[] declared = method.getDeclaringClass().getDeclaredMethods();
            for (Method candidate : declared) {
                if (candidate == null || !candidate.getName().equals(method.getName())) {
                    continue;
                }
                if (candidate.isSynthetic() || candidate.isBridge()) {
                    continue;
                }
                if (!Arrays.equals(candidate.getParameterTypes(), method.getParameterTypes())) {
                    return true;
                }
            }
        } catch (Throwable ignored) {
            // unknown: keep the plain node key
        }
        return false;
    }

    private static String shortTypes(Class<?>[] parameterTypes) {
        StringBuilder text = new StringBuilder();
        if (parameterTypes != null) {
            for (int i = 0; i < parameterTypes.length; i++) {
                if (i > 0) {
                    text.append(',');
                }
                Class<?> type = parameterTypes[i];
                if (type == null) {
                    text.append('?');
                } else if (type.isArray()) {
                    text.append(shortType(type.getComponentType())).append("[]");
                } else {
                    text.append(shortType(type));
                }
            }
        }
        return truncate(text.toString(), 200);
    }

    private static String shortType(Class<?> type) {
        if (type == null) {
            return "?";
        }
        try {
            String simple = type.getSimpleName();
            if (simple != null && !simple.isEmpty()) {
                return truncate(simple, 32);
            }
            String full = type.getName();
            int dot = full.lastIndexOf('.');
            return truncate(dot >= 0 ? full.substring(dot + 1) : full, 32);
        } catch (Throwable ignored) {
            return "?";
        }
    }

    // ------------------------------------------------------------------ values

    private static String[] parameterNames(Method method) {
        try {
            Parameter[] parameters = method.getParameters();
            String[] names = new String[parameters.length];
            for (int i = 0; i < parameters.length; i++) {
                String name = null;
                try {
                    Parameter parameter = parameters[i];
                    if (parameter != null && parameter.isNamePresent()) {
                        name = parameter.getName();
                    }
                } catch (Throwable ignored) {
                    name = null;
                }
                if (name == null || name.isEmpty()) {
                    name = "arg" + i;
                }
                names[i] = truncate(name, MAX_PARAM_NAME);
            }
            return names;
        } catch (Throwable ignored) {
            return new String[0];
        }
    }

    private static String returnTypeName(Method method) {
        try {
            Class<?> returnType = method.getReturnType();
            return returnType == null ? "void" : returnType.getName();
        } catch (Throwable ignored) {
            return "void";
        }
    }

    private static boolean isJdkType(String name) {
        return name == null
                || name.startsWith("java.")
                || name.startsWith("javax.")
                || name.startsWith("jakarta.")
                || name.startsWith("jdk.")
                || name.startsWith("sun.")
                || name.startsWith("com.sun.");
    }

    static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}