package io.traceboard.launcher;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;

/** URL shape rules: collector origin, loopback-only endpoints, preview target. */
final class Urls {

    static final String DEFAULT_COLLECTOR = "http://127.0.0.1:8601";
    static final String DEFAULT_APP_URL = "http://localhost:8080/api/orders";

    private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "localhost", "::1");

    private Urls() {
    }

    /**
     * {@code --collector} is a collector <em>origin</em> ({@code http://<loopback-host>:<port>}).
     * A trailing {@code /} is normalized away; any path/query/https/non-loopback host is rejected.
     */
    static String collectorOrigin(String raw) throws LauncherException {
        String value = (raw == null || raw.isBlank()) ? DEFAULT_COLLECTOR : raw.trim();
        URI uri;
        try {
            uri = new URI(value);
        } catch (URISyntaxException e) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 不是合法 URL: \"" + value
                    + "\"；只接受 collector origin，例如 \"http://127.0.0.1:8601\"。");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http")) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 只接受 http://<loopback-host>:<port>，收到 \"" + value
                    + "\"（https 无 TLS 支持；不要带 /ingest 路径）。");
        }
        if (uri.getHost() == null) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 缺少主机名: \"" + value
                    + "\"；例如 \"http://127.0.0.1:8601\"。");
        }
        if (uri.getPort() == -1) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 必须显式带端口: \"" + value
                    + "\"；例如 \"http://127.0.0.1:8601\"。");
        }
        if (uri.getUserInfo() != null) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 不能包含用户信息: \"" + value + "\"。");
        }
        String path = uri.getPath() == null ? "" : uri.getPath();
        if (!path.isEmpty() && !path.equals("/")) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 是 origin，不接受路径 \"" + path
                    + "\"；health/meta/agent/events/ingest 的 URL 由 launcher 派生。");
        }
        if (uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw LauncherException.usage("COLLECTOR_URL_INVALID", "--collector 不能包含查询或片段: \"" + value + "\"。");
        }
        String host = stripBrackets(uri.getHost());
        if (!isLoopback(host)) {
            throw LauncherException.usage("NON_LOOPBACK_TARGET", "--collector 只允许回环主机（127.0.0.1/localhost/::1），收到 \""
                    + host + "\"；TraceBoard 只在本机工作，无外部网络。");
        }
        return "http://" + hostForUrl(host) + ":" + uri.getPort();
    }

    /** {@code --app-url} / {@code --health} / {@code --preview-url}: http(s), loopback-only, full URL. */
    static URI loopbackHttpUrl(String raw, String option) throws LauncherException {
        URI uri;
        try {
            uri = new URI(raw.trim());
        } catch (URISyntaxException e) {
            throw LauncherException.usage(option + " 不是合法 URL: \"" + raw + "\"。");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw LauncherException.usage(option + " 只支持 http:// 或 https://，收到 \"" + raw + "\"。");
        }
        if (uri.getHost() == null) {
            throw LauncherException.usage(option + " 缺少主机名: \"" + raw + "\"。");
        }
        String host = stripBrackets(uri.getHost());
        if (!isLoopback(host)) {
            throw LauncherException.usage("NON_LOOPBACK_TARGET", option + " 默认只允许回环主机（127.0.0.1/localhost/::1），收到 \""
                    + host + "\"；TraceBoard 无外部网络（preview --target 是唯一有 --allow-non-loopback 的例外）。");
        }
        return uri;
    }

    /** Preview target: http only (TLS unsupported), loopback unless explicitly allowed. */
    static Target target(String raw, boolean allowNonLoopback) throws LauncherException {
        URI uri;
        try {
            uri = new URI(raw.trim());
        } catch (URISyntaxException e) {
            throw LauncherException.usage("--target 不是合法 URL: \"" + raw + "\"。");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (scheme.equals("https")) {
            throw LauncherException.failed("TARGET_TLS_UNSUPPORTED", "preview 只支持 http:// 目标（无 TLS 反代），收到 \""
                    + raw + "\"；请改用 http://127.0.0.1:<port> 的静态 HTML 页。");
        }
        if (!scheme.equals("http")) {
            throw LauncherException.usage("--target 只支持 http://，收到 \"" + raw + "\"。");
        }
        if (uri.getHost() == null) {
            throw LauncherException.usage("--target 缺少主机名: \"" + raw + "\"。");
        }
        if (uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw LauncherException.usage("--target 不能包含用户信息/查询/片段: \"" + raw + "\"。");
        }
        String host = stripBrackets(uri.getHost());
        if (!isLoopback(host)) {
            if (!allowNonLoopback) {
                throw LauncherException.usage("NON_LOOPBACK_TARGET", "--target 默认只允许回环主机（127.0.0.1/localhost/::1），收到 \""
                        + host + "\"；确需非回环请显式加 --allow-non-loopback（仍无 TLS/外部网络）。");
            }
            System.out.println("WARN non-loopback target=" + host);
        }
        String basePath = uri.getPath() == null ? "" : uri.getPath();
        if (basePath.endsWith("/")) {
            basePath = basePath.substring(0, basePath.length() - 1);
        }
        String origin = "http://" + hostForUrl(host) + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
        return new Target(origin, basePath, host);
    }

    static String originOf(URI uri) {
        String host = stripBrackets(uri.getHost() == null ? "" : uri.getHost());
        return uri.getScheme() + "://" + hostForUrl(host) + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
    }

    static boolean isLoopback(String host) {
        if (host == null) {
            return false;
        }
        return LOOPBACK.contains(stripBrackets(host).toLowerCase(Locale.ROOT));
    }

    static String stripBrackets(String host) {
        if (host == null) {
            return "";
        }
        if (host.startsWith("[") && host.endsWith("]")) {
            return host.substring(1, host.length() - 1);
        }
        return host;
    }

    private static String hostForUrl(String host) {
        return host.contains(":") ? "[" + host + "]" : host;
    }

    /** Parsed preview target: origin without trailing slash + optional base path. */
    record Target(String origin, String basePath, String host) {
        String toUri(String rawPath, String rawQuery) {
            String path = rawPath == null ? "/" : rawPath;
            String joined = basePath + path;
            return origin + (joined.isEmpty() ? "/" : joined) + (rawQuery == null ? "" : "?" + rawQuery);
        }
    }
}
