package io.traceboard.agent.generic;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Configuration for the generic (own-project) mode ({@code traceboard.mode=generic}).
 *
 * <p>Values are read from {@code -D} system properties and, when present, from the agent
 * arguments (same {@code key=value} names, separated by {@code ;}, newline or - when every part
 * carries an {@code =} - comma). Agent arguments win over system properties.</p>
 *
 * <pre>
 * mode=generic            traceboard.mode=generic        enables this mode (default: demo)
 * ingestUrl               traceboard.ingestUrl           required; otherwise the mode is a fail-open noop
 * sessionId               traceboard.sessionId           must match ^s_[A-Za-z0-9_-]+$ (default s_generic)
 * include                 traceboard.include             package/class prefixes scanned for public methods
 * exclude                 traceboard.exclude             extra package/class prefixes to skip
 * includeMethod           traceboard.includeMethod       Class#method entries; may root a standalone trace
 * captureArgs             traceboard.captureArgs         default true
 * captureReturn           traceboard.captureReturn       default true
 * captureMyBatis          traceboard.captureMyBatis      default true
 * maxSpansPerTrace        traceboard.maxSpansPerTrace    default 256 (1..10000)
 * maxValues               traceboard.maxValues           default 64 (1..512)
 * maxString               traceboard.maxString           default 512 (8..8192)
 * maxCollection           traceboard.maxCollection       default 8 (1..128)
 * maxDepth                traceboard.maxDepth            default 64 (1..256)
 * rootForIncluded         traceboard.rootForIncluded     default true; explicit include may start a trace
 * </pre>
 *
 * <p>Nothing here loads application, Spring or MyBatis classes: only strings, ints and booleans.
 * The launcher passes the app base package as {@code include}; when it is missing the package of
 * the {@code sun.java.command} main class is used as a best-effort fallback.</p>
 */
public final class GenericConfig {

    public static final String MODE_GENERIC = "generic";

    static final String DEFAULT_SESSION_ID = "s_generic";

    private static final Pattern SESSION_ID = Pattern.compile("^s_[A-Za-z0-9_-]+$");
    private static final Pattern INGEST_URL = Pattern.compile("^https?://\\S+$");

    static final int DEFAULT_MAX_SPANS_PER_TRACE = 256;
    static final int DEFAULT_MAX_VALUES = 64;
    static final int DEFAULT_MAX_STRING = 512;
    static final int DEFAULT_MAX_COLLECTION = 8;
    static final int DEFAULT_MAX_DEPTH = 64;

    /** Maximum include entries (prefix matcher size stays bounded). */
    private static final int MAX_INCLUDE_ENTRIES = 64;
    private static final int MAX_EXCLUDE_ENTRIES = 256;
    private static final int MAX_INCLUDE_METHODS = 128;

    /**
     * Framework / runtime prefixes never auto-scanned (the two MyBatis target types are still
     * transformed through their explicit type matchers, see {@link GenericAgent}).
     */
    private static final String[] DEFAULT_EXCLUDES = {
            "java", "javax", "jakarta", "jdk", "sun", "com.sun",
            "org.springframework", "org.apache.ibatis", "org.mybatis", "org.mybatis.spring",
            "org.slf4j", "ch.qos.logback", "org.apache.logging", "org.apache.log4j",
            "org.apache.commons.logging", "org.apache.commons", "org.apache.http",
            "net.bytebuddy", "io.traceboard.agent", "org.objectweb.asm",
            "com.fasterxml.jackson", "com.alibaba.fastjson", "com.google.gson",
            "org.hibernate", "com.zaxxer.hikari", "com.mysql", "org.postgresql",
            "oracle.jdbc", "com.microsoft.sqlserver", "redis.clients", "io.lettuce",
            "io.netty", "reactor", "org.reactivestreams",
            "org.apache.tomcat", "org.eclipse.jetty", "io.undertow",
            "org.junit", "junit", "org.mockito", "org.assertj", "org.hamcrest",
            "kotlin", "scala", "groovy", "org.yaml.snakeyaml",
    };

    private static volatile GenericConfig current;

    private final boolean enabled;
    private final String ingestUrl;
    private final String sessionId;
    private final List<String> include;
    private final List<String> exclude;
    private final Set<String> includeClasses;
    private final Set<String> includeMethods;
    private final boolean captureArgs;
    private final boolean captureReturn;
    private final boolean captureMyBatis;
    private final boolean rootForIncluded;
    private final int maxSpansPerTrace;
    private final int maxValues;
    private final int maxString;
    private final int maxCollection;
    private final int maxDepth;

    private GenericConfig(boolean enabled, String ingestUrl, String sessionId, List<String> include,
                          List<String> exclude, Set<String> includeClasses, Set<String> includeMethods,
                          boolean captureArgs, boolean captureReturn, boolean captureMyBatis,
                          boolean rootForIncluded, int maxSpansPerTrace, int maxValues, int maxString,
                          int maxCollection, int maxDepth) {
        this.enabled = enabled;
        this.ingestUrl = ingestUrl;
        this.sessionId = sessionId;
        this.include = include;
        this.exclude = exclude;
        this.includeClasses = includeClasses;
        this.includeMethods = includeMethods;
        this.captureArgs = captureArgs;
        this.captureReturn = captureReturn;
        this.captureMyBatis = captureMyBatis;
        this.rootForIncluded = rootForIncluded;
        this.maxSpansPerTrace = maxSpansPerTrace;
        this.maxValues = maxValues;
        this.maxString = maxString;
        this.maxCollection = maxCollection;
        this.maxDepth = maxDepth;
    }

    private static GenericConfig disabled(String reason) {
        GenericConfig config = new GenericConfig(false, null, DEFAULT_SESSION_ID,
                Collections.<String>emptyList(), Collections.<String>emptyList(),
                Collections.<String>emptySet(), Collections.<String>emptySet(),
                true, true, true, true, DEFAULT_MAX_SPANS_PER_TRACE, DEFAULT_MAX_VALUES,
                DEFAULT_MAX_STRING, DEFAULT_MAX_COLLECTION, DEFAULT_MAX_DEPTH);
        config.disabledReason = reason;
        return config;
    }

    private String disabledReason;

    /** @return true when the mode selector asks for the generic agent (never throws) */
    public static boolean isGenericMode(String agentArgs) {
        try {
            Map<String, String> args = parseArgs(agentArgs);
            String mode = lookup(args, "mode");
            if (mode == null) {
                mode = trimToNull(System.getProperty("traceboard.mode"));
            }
            return mode != null && MODE_GENERIC.equalsIgnoreCase(mode);
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Builds the configuration from agent arguments + system properties. Never throws; an
     * unusable configuration is returned disabled (the caller then only logs a noop line).
     */
    public static GenericConfig from(String agentArgs) {
        Map<String, String> args;
        try {
            args = parseArgs(agentArgs);
        } catch (Throwable ignored) {
            args = new HashMap<String, String>();
        }
        String enabledRaw = lookup(args, "enabled");
        boolean enabled = enabledRaw == null || !"false".equalsIgnoreCase(enabledRaw.trim());
        if (!enabled) {
            return disabled("disabled");
        }
        String ingestUrl = trimToNull(lookup(args, "ingestUrl"));
        if (ingestUrl == null) {
            return disabled("ingest_url");
        }
        if (!INGEST_URL.matcher(ingestUrl).matches()) {
            return disabled("ingest_url");
        }
        String sessionId = trimToNull(lookup(args, "sessionId"));
        if (sessionId == null || !SESSION_ID.matcher(sessionId).matches()) {
            sessionId = DEFAULT_SESSION_ID;
        }

        Set<String> includeMethods = parseMethods(lookup(args, "includeMethod"), lookup(args, "includeMethods"));
        List<String> include = parseList(lookup(args, "include"), MAX_INCLUDE_ENTRIES);
        if (include.isEmpty()) {
            String derived = deriveMainPackage();
            if (derived != null) {
                include.add(derived);
            }
        }
        Set<String> includeClasses = new LinkedHashSet<String>();
        for (String entry : includeMethods) {
            int hash = entry.indexOf('#');
            if (hash > 0) {
                includeClasses.add(entry.substring(0, hash));
            }
        }

        List<String> exclude = new ArrayList<String>(Arrays.asList(DEFAULT_EXCLUDES));
        exclude.addAll(parseList(lookup(args, "exclude"), MAX_EXCLUDE_ENTRIES));

        boolean captureArgs = boolValue(lookup(args, "captureArgs"), true);
        boolean captureReturn = boolValue(lookup(args, "captureReturn"), true);
        boolean captureMyBatis = boolValue(lookup(args, "captureMyBatis"), true);
        boolean rootForIncluded = boolValue(lookup(args, "rootForIncluded"), true);
        int maxSpans = intValue(lookup(args, "maxSpansPerTrace"), DEFAULT_MAX_SPANS_PER_TRACE, 1, 10000);
        int maxValues = intValue(lookup(args, "maxValues"), DEFAULT_MAX_VALUES, 1, 512);
        int maxString = intValue(lookup(args, "maxString"), DEFAULT_MAX_STRING, 8, 8192);
        int maxCollection = intValue(lookup(args, "maxCollection"), DEFAULT_MAX_COLLECTION, 1, 128);
        int maxDepth = intValue(lookup(args, "maxDepth"), DEFAULT_MAX_DEPTH, 1, 256);

        return new GenericConfig(true, ingestUrl, sessionId,
                Collections.unmodifiableList(include),
                Collections.unmodifiableList(dedupe(exclude)),
                Collections.unmodifiableSet(includeClasses),
                Collections.unmodifiableSet(includeMethods),
                captureArgs, captureReturn, captureMyBatis, rootForIncluded,
                maxSpans, maxValues, maxString, maxCollection, maxDepth);
    }

    static void setCurrent(GenericConfig config) {
        current = config;
    }

    /** @return the active generic configuration, or {@code null} when the mode never installed */
    public static GenericConfig current() {
        return current;
    }

    // ------------------------------------------------------------------ matching helpers

    static boolean matchesPrefix(String className, String prefix) {
        if (className == null || prefix == null || prefix.isEmpty()) {
            return false;
        }
        if (className.equals(prefix)) {
            return true;
        }
        String normalized = prefix.endsWith(".") ? prefix : prefix + ".";
        return className.startsWith(normalized);
    }

    boolean matchesInclude(String className) {
        for (String prefix : include) {
            if (matchesPrefix(className, prefix)) {
                return true;
            }
        }
        return false;
    }

    boolean isExcluded(String className) {
        for (String prefix : exclude) {
            if (matchesPrefix(className, prefix)) {
                return true;
            }
        }
        return false;
    }

    boolean isExplicit(String className, String methodName) {
        return includeMethods.contains(className + "#" + methodName);
    }

    // ------------------------------------------------------------------ accessors

    public boolean isEnabled() {
        return enabled;
    }

    public String ingestUrl() {
        return ingestUrl;
    }

    public String sessionId() {
        return sessionId;
    }

    public List<String> include() {
        return include;
    }

    public Set<String> includeClasses() {
        return includeClasses;
    }

    public boolean captureArgs() {
        return captureArgs;
    }

    public boolean captureReturn() {
        return captureReturn;
    }

    public boolean captureMyBatis() {
        return captureMyBatis;
    }

    public boolean rootForIncluded() {
        return rootForIncluded;
    }

    public int maxSpansPerTrace() {
        return maxSpansPerTrace;
    }

    public int maxValues() {
        return maxValues;
    }

    public int maxString() {
        return maxString;
    }

    public int maxCollection() {
        return maxCollection;
    }

    public int maxDepth() {
        return maxDepth;
    }

    String disabledReason() {
        return disabledReason;
    }

    /** One-line summary for the premain log (no header values, no secrets). */
    public String describe() {
        return "include=" + join(include) + " exclude=" + exclude.size()
                + " includeMethod=" + includeMethods.size()
                + " captureArgs=" + captureArgs + " captureReturn=" + captureReturn
                + " captureMyBatis=" + captureMyBatis + " rootForIncluded=" + rootForIncluded
                + " maxSpansPerTrace=" + maxSpansPerTrace + " maxValues=" + maxValues
                + " maxString=" + maxString + " maxCollection=" + maxCollection
                + " maxDepth=" + maxDepth;
    }

    /** Explicit method entries {@code Class#method} (signatures, if any, are ignored). */
    public Set<String> includeMethodEntries() {
        return includeMethods;
    }

    // ------------------------------------------------------------------ parsing

    private static Map<String, String> parseArgs(String raw) {
        Map<String, String> map = new HashMap<String, String>();
        if (raw == null) {
            return map;
        }
        String text = raw.trim();
        if (text.isEmpty()) {
            return map;
        }
        String[] tokens = text.split("[;\\n\\r]");
        if (tokens.length == 1 && text.indexOf(',') >= 0) {
            String[] parts = text.split(",");
            boolean allAssignments = true;
            for (String part : parts) {
                if (part.indexOf('=') < 0) {
                    allAssignments = false;
                    break;
                }
            }
            if (allAssignments) {
                tokens = parts;
            }
        }
        for (String token : tokens) {
            int eq = token.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = token.substring(0, eq).trim();
            if (key.startsWith("traceboard.")) {
                key = key.substring("traceboard.".length());
            }
            String value = token.substring(eq + 1).trim();
            if (!key.isEmpty()) {
                map.put(key, value);
            }
        }
        return map;
    }

    private static String lookup(Map<String, String> args, String key) {
        String value = trimToNull(args.get(key));
        if (value == null) {
            value = trimToNull(args.get("traceboard." + key));
        }
        if (value == null) {
            value = trimToNull(System.getProperty("traceboard." + key));
        }
        return value;
    }

    private static Set<String> parseMethods(String singular, String plural) {
        Set<String> methods = new LinkedHashSet<String>();
        addMethods(methods, singular);
        addMethods(methods, plural);
        return methods;
    }

    private static void addMethods(Set<String> target, String raw) {
        if (raw == null) {
            return;
        }
        for (String entry : raw.split("[,;\\s]+")) {
            String normalized = normalizeMethodEntry(entry);
            if (normalized == null) {
                continue;
            }
            if (target.size() >= MAX_INCLUDE_METHODS) {
                return;
            }
            target.add(normalized);
        }
    }

    /** {@code com.acme.Foo#bar(java.lang.String)} -> {@code com.acme.Foo#bar}. */
    static String normalizeMethodEntry(String entry) {
        String value = trimToNull(entry);
        if (value == null) {
            return null;
        }
        int hash = value.indexOf('#');
        if (hash <= 0 || hash == value.length() - 1) {
            return null;
        }
        String className = value.substring(0, hash).trim();
        String method = value.substring(hash + 1).trim();
        int paren = method.indexOf('(');
        if (paren >= 0) {
            method = method.substring(0, paren).trim();
        }
        if (className.isEmpty() || method.isEmpty()) {
            return null;
        }
        return className + "#" + method;
    }

    private static List<String> parseList(String raw, int maxEntries) {
        List<String> values = new ArrayList<String>();
        if (raw == null) {
            return values;
        }
        for (String entry : raw.split("[,;\\s]+")) {
            String value = entry.trim();
            while (value.endsWith(".") && value.length() > 1) {
                value = value.substring(0, value.length() - 1);
            }
            if (value.isEmpty() || "*".equals(value)) {
                continue;
            }
            if (values.size() >= maxEntries) {
                break;
            }
            if (!values.contains(value)) {
                values.add(value);
            }
        }
        return values;
    }

    private static List<String> dedupe(List<String> values) {
        List<String> unique = new ArrayList<String>();
        Set<String> seen = new LinkedHashSet<String>();
        for (String value : values) {
            String normalized = value;
            while (normalized.endsWith(".") && normalized.length() > 1) {
                normalized = normalized.substring(0, normalized.length() - 1);
            }
            if (normalized.isEmpty() || !seen.add(normalized)) {
                continue;
            }
            unique.add(normalized);
            if (unique.size() >= MAX_EXCLUDE_ENTRIES) {
                break;
            }
        }
        return unique;
    }

    /**
     * Best-effort fallback when no {@code include} was provided: the package of the class named by
     * {@code sun.java.command}. Launchers that run a fat jar only give a jar path, so nothing is
     * derived there (the launcher passes {@code include} explicitly).
     */
    private static String deriveMainPackage() {
        try {
            String command = System.getProperty("sun.java.command");
            if (command == null) {
                return null;
            }
            String first = command.trim().split("\\s+")[0];
            if (first.isEmpty() || first.indexOf('/') >= 0 || first.indexOf('\\') >= 0) {
                return null;
            }
            String lower = first.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".jar") || lower.endsWith(".war") || lower.endsWith(".class")) {
                return null;
            }
            int lastDot = first.lastIndexOf('.');
            if (lastDot <= 0) {
                return null;
            }
            return first.substring(0, lastDot);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static boolean boolValue(String raw, boolean fallback) {
        String value = trimToNull(raw);
        if (value == null) {
            return fallback;
        }
        return !"false".equalsIgnoreCase(value) && !"0".equals(value) && !"no".equalsIgnoreCase(value);
    }

    private static int intValue(String raw, int fallback, int min, int max) {
        String value = trimToNull(raw);
        if (value == null) {
            return fallback;
        }
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < min) {
                return min;
            }
            if (parsed > max) {
                return max;
            }
            return parsed;
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String join(List<String> values) {
        StringBuilder text = new StringBuilder();
        for (String value : values) {
            if (text.length() > 0) {
                text.append(',');
            }
            text.append(value);
        }
        return text.length() == 0 ? "-" : text.toString();
    }
}