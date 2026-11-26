package io.traceboard.launcher;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

/**
 * {@code ui}: loopback-only static server for the built workbench.
 *
 * <p>It serves files from an explicit directory (normally {@code workbench/dist}),
 * blocks until the process is stopped, and never exposes directory listings or
 * paths outside the root. Missing extension-less routes fall back to index.html
 * so SPA links keep working.</p>
 */
final class UiCommand {

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        Path root = Util.abs(args.require("--dir"));
        if (!Files.isDirectory(root)) {
            throw LauncherException.failed("UI_DIR_MISSING",
                    "找不到静态目录 \"" + Util.fwd(root) + "\"；先构建 workbench (cd \"workbench\" && npm ci && npm run build)。");
        }
        int port = args.port("--port", 5173);
        String collector = args.has("--collector") ? Urls.collectorOrigin(args.get("--collector")) : null;
        String appUrl = args.has("--app-url")
                ? Urls.loopbackHttpUrl(args.get("--app-url"), "--app-url").toString()
                : null;
        Path base;
        try {
            base = root.toRealPath();
        } catch (IOException e) {
            throw LauncherException.failed("UI_DIR_MISSING", "无法解析静态目录 \"" + Util.fwd(root) + "\"（"
                    + e.getClass().getSimpleName() + "）。");
        }
        if (!Files.isRegularFile(base.resolve("index.html"))) {
            throw LauncherException.failed("UI_INDEX_MISSING",
                    "静态目录缺少 index.html: \"" + Util.fwd(base) + "\"；先构建 workbench。");
        }

        HttpServer server;
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 50);
        } catch (BindException e) {
            throw LauncherException.failed("PORT_IN_USE", "无法绑定 127.0.0.1:" + port + "（端口被占用）；"
                    + "先停止占用进程，或用 --port 显式换端口；不静默改端口。");
        } catch (IOException e) {
            throw LauncherException.failed("UI_BIND_FAILED", "无法创建静态服务器 127.0.0.1:" + port + "（"
                    + e.getClass().getSimpleName() + "）。");
        }

        server.setExecutor(Executors.newFixedThreadPool(4, r -> {
            Thread thread = new Thread(r, "traceboard-ui");
            thread.setDaemon(true);
            return thread;
        }));
        server.createContext("/", exchange -> serve(base, collector, appUrl, exchange));
        server.start();
        System.out.println("UI dir=\"" + Util.fwd(base) + "\"");
        if (collector != null) {
            System.out.println("UI collector=" + collector + " (GET/HEAD /api/* proxied)");
        }
        if (appUrl != null) {
            System.out.println("UI app=" + appUrl + " (注入 __TRACEBOARD_RUNTIME_APP__)");
        }
        System.out.println("UI_READY url=http://127.0.0.1:" + port);
        System.out.println("提示: 浏览器访问 http://127.0.0.1:" + port + "；仅绑 127.0.0.1，无上传、无外部网络；Ctrl+C 停止。");
        System.out.flush();

        CountDownLatch latch = new CountDownLatch(1);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            server.stop(0);
            latch.countDown();
        }, "traceboard-ui-shutdown"));
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        server.stop(0);
        return Launcher.EXIT_OK;
    }

    private static void serve(Path root, String collector, String appUrl, HttpExchange exchange) {
        try {
            String method = exchange.getRequestMethod();
            if (!"GET".equals(method) && !"HEAD".equals(method)) {
                exchange.getResponseHeaders().set("Allow", "GET, HEAD");
                send(exchange, 405, "Method Not Allowed", "text/plain; charset=utf-8", new byte[0], false);
                return;
            }
            String rawPath = exchange.getRequestURI().getPath();
            String path = URLDecoder.decode(rawPath, StandardCharsets.UTF_8);
            if (path != null && path.startsWith("/api/")) {
                if (collector == null) {
                    send(exchange, 404, "Not Found", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                proxy(collector, exchange, "HEAD".equals(method));
                return;
            }
            String relative = path == null || path.isEmpty() || "/".equals(path) ? "index.html" : path.substring(1);
            Path target = root.resolve(relative).normalize();
            if (!target.startsWith(root) || target.equals(root)) {
                send(exchange, 404, "Not Found", "text/plain; charset=utf-8", new byte[0], false);
                return;
            }
            if (!Files.isRegularFile(target)) {
                boolean assetLike = relative.contains(".");
                target = root.resolve("index.html").normalize();
                if (assetLike || !Files.isRegularFile(target)) {
                    send(exchange, 404, "Not Found", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
            }
            byte[] body = Files.readAllBytes(target);
            if (appUrl != null && "index.html".equals(target.getFileName().toString())) {
                body = injectRuntimeApp(body, appUrl);
            }
            Headers headers = exchange.getResponseHeaders();
            headers.set("Content-Type", contentType(target));
            headers.set("Cache-Control", "no-store");
            headers.set("X-Content-Type-Options", "nosniff");
            exchange.sendResponseHeaders(200, "HEAD".equals(method) ? -1 : body.length);
            if (!"HEAD".equals(method)) {
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(body);
                }
            }
        } catch (Throwable ignored) {
            try {
                send(exchange, 500, "Internal Server Error", "text/plain; charset=utf-8", new byte[0], false);
            } catch (Throwable ignoredAgain) {
                // client disconnected: fail-open for the static server
            }
        } finally {
            exchange.close();
        }
    }

    private static byte[] injectRuntimeApp(byte[] body, String appUrl) {
        try {
            String html = new String(body, StandardCharsets.UTF_8);
            String script = "<script>window.__TRACEBOARD_RUNTIME_APP__="
                    + jsonString(appUrl) + ";</script>";
            int headEnd = html.indexOf("</head>");
            if (headEnd >= 0) {
                html = html.substring(0, headEnd) + script + html.substring(headEnd);
            } else {
                html = script + html;
            }
            return html.getBytes(StandardCharsets.UTF_8);
        } catch (Throwable ignored) {
            return body;
        }
    }

    private static String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static void proxy(String collector, HttpExchange exchange, boolean head) throws Exception {
        URI incoming = exchange.getRequestURI();
        String query = incoming.getRawQuery();
        String target = collector + incoming.getRawPath() + (query == null ? "" : "?" + query);
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        HttpRequest request = HttpRequest.newBuilder(URI.create(target))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        Headers headers = exchange.getResponseHeaders();
        response.headers().firstValue("content-type").ifPresent(value -> headers.set("Content-Type", value));
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        byte[] body = response.body();
        exchange.sendResponseHeaders(response.statusCode(), head ? -1 : body.length);
        if (!head) {
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        }
    }

    private static void send(HttpExchange exchange, int status, String text, String type, byte[] body, boolean head) throws IOException {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", type);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        byte[] bytes = body.length == 0 ? text.getBytes(StandardCharsets.UTF_8) : body;
        exchange.sendResponseHeaders(status, head ? -1 : bytes.length);
        if (!head) {
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        }
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".json") || name.endsWith(".map")) return "application/json; charset=utf-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".ico")) return "image/x-icon";
        if (name.endsWith(".woff2")) return "font/woff2";
        if (name.endsWith(".txt") || name.endsWith(".md")) return "text/plain; charset=utf-8";
        return "application/octet-stream";
    }
}