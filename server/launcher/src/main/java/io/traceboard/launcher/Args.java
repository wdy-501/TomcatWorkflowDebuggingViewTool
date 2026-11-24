package io.traceboard.launcher;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Hand-rolled CLI argument parser (no external CLI library). */
final class Args {

    private static final Set<String> BOOLEAN_FLAGS = Set.of("--detach", "--allow-non-loopback");
    private static final Set<String> LEGACY_FLAGS = Set.of("--ingest", "--ingest-url");

    private final Map<String, String> values;
    private final Set<String> flags;

    private Args(Map<String, String> values, Set<String> flags) {
        this.values = values;
        this.flags = flags;
    }

    static Args parse(String[] argv) throws LauncherException {
        Map<String, String> values = new LinkedHashMap<>();
        Set<String> flags = new java.util.LinkedHashSet<>();
        int i = 0;
        while (i < argv.length) {
            String arg = argv[i];
            if (arg == null || arg.isEmpty()) {
                i++;
                continue;
            }
            if (!arg.startsWith("--")) {
                throw LauncherException.usage("无法识别的参数 \"" + arg + "\"（选项必须以 -- 开头；--help 查看用法）。");
            }
            String name = arg;
            String inline = null;
            int eq = arg.indexOf('=');
            if (eq > 0) {
                name = arg.substring(0, eq);
                inline = arg.substring(eq + 1);
            }
            if (LEGACY_FLAGS.contains(name)) {
                throw LauncherException.usage("--ingest/--ingest-url 已移除（S4-AMD-01）；请改用 --collector <origin>，"
                        + "例如 --collector \"http://127.0.0.1:8601\"（ingest URL 由 launcher 派生为 <base>/ingest/v1/events）。");
            }
            if (BOOLEAN_FLAGS.contains(name)) {
                if (inline != null) {
                    throw LauncherException.usage(name + " 是开关参数，不接受取值。");
                }
                flags.add(name);
                i++;
                continue;
            }
            String value;
            if (inline != null) {
                value = inline;
                i++;
            } else {
                if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
                    throw LauncherException.usage("参数 " + name + " 缺少取值（--help 查看用法）。");
                }
                value = argv[i + 1];
                i += 2;
            }
            if (!isKnown(name)) {
                throw LauncherException.usage("未知参数 " + name + "（--help 查看用法）。");
            }
            values.put(name, value);
        }
        return new Args(Collections.unmodifiableMap(values), Collections.unmodifiableSet(flags));
    }

    private static boolean isKnown(String name) {
        switch (name) {
            case "--jar":
            case "--agent":
            case "--collector":
            case "--session":
            case "--java":
            case "--port":
            case "--health":
            case "--pid-file":
            case "--log-dir":
            case "--target":
            case "--sdk":
            case "--app-url":
            case "--preview-url":
            case "--dir":
                return true;
            default:
                return false;
        }
    }

    String get(String name) {
        return values.get(name);
    }

    String require(String name) throws LauncherException {
        String value = values.get(name);
        if (value == null || value.isBlank()) {
            throw LauncherException.usage("缺少必需参数 " + name + "（--help 查看用法）。");
        }
        return value;
    }

    boolean flag(String name) {
        return flags.contains(name);
    }

    int port(String name, int defaultValue) throws LauncherException {
        String raw = values.get(name);
        if (raw == null) {
            return defaultValue;
        }
        int port;
        try {
            port = Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw LauncherException.usage(name + " 必须是 1..65535 的整数，收到 \"" + raw + "\"。");
        }
        if (port < 1 || port > 65535) {
            throw LauncherException.usage(name + " 必须是 1..65535 的整数，收到 \"" + raw + "\"。");
        }
        return port;
    }

    boolean has(String name) {
        return values.containsKey(name);
    }

    static String session(Args args) throws LauncherException {
        String session = args.require("--session");
        if (!session.matches("^s_[A-Za-z0-9_-]+$")) {
            throw LauncherException.usage("--session 必须匹配 ^s_[A-Za-z0-9_-]+$（例如 s_s4demo），收到 \"" + session + "\"。");
        }
        return session;
    }
}
