package io.traceboard.launcher;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

/**
 * {@code preview}: loopback-only injecting reverse proxy (default 127.0.0.1:8602).
 *
 * <ul>
 *   <li>{@code /traceboard/config.js} and {@code /traceboard/sdk.js} are served locally;</li>
 *   <li>{@code /ingest/v1/events} is proxied to {@code <collector>/ingest/v1/events} (other
 *       {@code /ingest/*} → 404, no open write proxy);</li>
 *   <li>everything else is forwarded to {@code --target} with {@code Accept-Encoding} removed;
 *       200 {@code text/html} (charset missing or utf-8) gets the two external script tags right
 *       before the last case-insensitive {@code </body>} — never inline scripts, CSP untouched.</li>
 * </ul>
 */
final class PreviewCommand {

    private static final String CONFIG_PATH = "/traceboard/config.js";
    private static final String SDK_PATH = "/traceboard/sdk.js";
    private static final String INGEST_EVENTS = "/ingest/v1/events";
    private static final String INJECT_TAGS =
            "<script src=\"/traceboard/config.js\"></script><script src=\"/traceboard/sdk.js\"></script>";
    private static final int MAX_INJECT_BYTES = 2 * 1024 * 1024;

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        String session = Args.session(args);
        String collector = Urls.collectorOrigin(args.get("--collector"));
        Urls.Target target = Urls.target(args.require("--target"), args.flag("--allow-non-loopback"));
        int port = args.port("--port", 8602);
        Path sdkPath = resolveSdk(args.get("--sdk"));
        byte[] sdkBytes;
        try {
            sdkBytes = Files.readAllBytes(sdkPath);
        } catch (IOException e) {
            throw LauncherException.failed("SDK_IIFE_MISSING", "无法读取 SDK IIFE \"" + Util.fwd(sdkPath) + "\"（"
                    + e.getClass().getSimpleName() + "）；先构建 (cd \"frontend/sdk\" && npm ci && npm run build)。");
        }
        if (sdkBytes.length == 0) {
            throw LauncherException.failed("SDK_IIFE_MISSING", "SDK IIFE 为空 \"" + Util.fwd(sdkPath)
                    + "\"；先构建 (cd \"frontend/sdk\" && npm ci && npm run build)。");
        }

        HttpServer server;
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 50);
        } catch (BindException e) {
            throw LauncherException.failed("PORT_IN_USE", "无法绑定 127.0.0.1:" + port + "（端口被占用）；"
                    + "先停止占用进程（netstat -ano | findstr :" + port + "），或用 --port 显式换端口；不静默改端口。");
        } catch (IOException e) {
            throw LauncherException.failed("LAUNCHER_ERROR", "无法创建预览服务器 127.0.0.1:" + port + "（"
                    + e.getClass().getSimpleName() + "）。");
        }

        String configBody = "window.__TRACEBOARD_CONFIG__ = {\"sessionId\":\"" + session
                + "\",\"ingestUrl\":\"/ingest\",\"appName\":\"traceboard-preview\",\"observeMs\":1500};";
        HttpClient client = Http.client(Duration.ofSeconds(3));
        server.setExecutor(Executors.newFixedThreadPool(8, r -> {
            Thread thread = new Thread(r, "traceboard-preview");
            thread.setDaemon(true);
            return thread;
        }));
        server.createContext("/", new Handler(client, collector, target,
                configBody.getBytes(StandardCharsets.UTF_8), sdkBytes));
        server.start();

        System.out.println("PREVIEW session=" + session + " target=" + target.origin() + target.basePath()
                + " collector=" + collector + " sdk=\"" + Util.fwd(sdkPath) + "\"");
        System.out.println("PREVIEW_READY url=http://127.0.0.1:" + port);
        System.out.println("提示: 浏览器访问 http://127.0.0.1:" + port + "；仅绑 127.0.0.1，无 TLS、无外部网络；Ctrl+C 停止。");
        System.out.flush();

        CountDownLatch latch = new CountDownLatch(1);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            server.stop(0);
            latch.countDown();
        }, "traceboard-preview-shutdown"));
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        server.stop(0);
        return Launcher.EXIT_OK;
    }

    private static Path resolveSdk(String explicit) throws LauncherException {
        List<String> tried = new ArrayList<>();
        if (explicit != null) {
            Path path = Util.abs(explicit);
            if (Files.isRegularFile(path)) {
                return path;
            }
            tried.add("--sdk \"" + Util.fwd(path) + "\"");
        }
        String property = System.getProperty("traceboard.sdk.iife");
        if (property != null && !property.isBlank()) {
            Path path = Util.abs(property);
            if (Files.isRegularFile(path)) {
                return path;
            }
            tried.add("-Dtraceboard.sdk.iife=\"" + Util.fwd(path) + "\"");
        }
        String env = System.getenv("TRACEBOARD_SDK_IIFE");
        if (env != null && !env.isBlank()) {
            Path path = Util.abs(env);
            if (Files.isRegularFile(path)) {
                return path;
            }
            tried.add("TRACEBOARD_SDK_IIFE=\"" + Util.fwd(path) + "\"");
        }
        Path repoRoot = Util.abs("frontend/sdk/dist/traceboard-sdk.iife.js");
        if (Files.isRegularFile(repoRoot)) {
            return repoRoot;
        }
        tried.add("CWD \"" + Util.fwd(repoRoot) + "\"");
        throw LauncherException.failed("SDK_IIFE_MISSING", "找不到 SDK IIFE（尝试: " + String.join("；", tried)
                + "）；先构建 (cd \"frontend/sdk\" && npm ci && npm run build)，并从仓库根启动 launcher，或显式 --sdk。");
    }

    private static final class Handler implements HttpHandler {

        private final HttpClient client;
        private final String collector;
        private final Urls.Target target;
        private final byte[] configBytes;
        private final byte[] sdkBytes;

        Handler(HttpClient client, String collector, Urls.Target target,
                byte[] configBytes, byte[] sdkBytes) {
            this.client = client;
            this.collector = collector;
            this.target = target;
            this.configBytes = configBytes;
            this.sdkBytes = sdkBytes;
        }

        @Override
        public void handle(HttpExchange exchange) {
            try {
                route(exchange);
            } catch (Throwable t) {
                try {
                    sendText(exchange, 502, "preview internal error: " + t.getClass().getSimpleName());
                } catch (IOException ignored) {
                    // client may be gone
                }
            } finally {
                exchange.close();
            }
        }

        private void route(HttpExchange exchange) throws IOException {
            URI uri = exchange.getRequestURI();
            String path = uri.getPath() == null ? "/" : uri.getPath();
            if (CONFIG_PATH.equals(path)) {
                serveScript(exchange, configBytes, "config.js");
                return;
            }
            if (SDK_PATH.equals(path)) {
                serveScript(exchange, sdkBytes, "sdk.js");
                return;
            }
            if (path.startsWith("/ingest/") || path.equals("/ingest")) {
                handleIngest(exchange, path);
                return;
            }
            proxyTarget(exchange, uri);
        }

        private void serveScript(HttpExchange exchange, byte[] body, String name) throws IOException {
            String method = exchange.getRequestMethod();
            if (!method.equalsIgnoreCase("GET") && !method.equalsIgnoreCase("HEAD")) {
                exchange.getResponseHeaders().set("Allow", "GET, HEAD");
                sendText(exchange, 405, "preview: /traceboard/" + name + " 只支持 GET/HEAD。");
                return;
            }
            Headers headers = exchange.getResponseHeaders();
            headers.set("Content-Type", "application/javascript; charset=utf-8");
            headers.set("Cache-Control", "no-store");
            if (method.equalsIgnoreCase("HEAD")) {
                exchange.sendResponseHeaders(200, -1);
            } else {
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        }

        private void handleIngest(HttpExchange exchange, String path) throws IOException {
            if (!INGEST_EVENTS.equals(path)) {
                sendText(exchange, 404, "preview 只代理 /ingest/v1/events 到 collector；其他 /ingest/* 不代理（不做开放写代理）。");
                return;
            }
            byte[] body = readBody(exchange);
            String method = exchange.getRequestMethod();
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(collector + INGEST_EVENTS))
                    .timeout(Duration.ofSeconds(15));
            String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
            if (contentType != null && !contentType.isBlank()) {
                builder.header("Content-Type", contentType);
            }
            builder.method(method, methodBody(method, body));
            HttpResponse<byte[]> response;
            try {
                response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                sendText(exchange, 502, "collector unreachable: " + collector + "/ingest/v1/events（"
                        + e.getClass().getSimpleName() + "）；先启动 collector 并确认 --collector 是 origin。");
                return;
            }
            sendUpstream(exchange, response, method, false, null, false);
        }

        private void proxyTarget(HttpExchange exchange, URI uri) throws IOException {
            String method = exchange.getRequestMethod();
            boolean head = method.equalsIgnoreCase("HEAD");
            byte[] requestBody = readBody(exchange);
            String url = target.toUri(uri.getRawPath(), uri.getRawQuery());
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30));
            for (Map.Entry<String, List<String>> header : exchange.getRequestHeaders().entrySet()) {
                if (skipRequestHeader(header.getKey())) {
                    continue;
                }
                for (String value : header.getValue()) {
                    builder.header(header.getKey(), value);
                }
            }
            builder.method(method, methodBody(method, requestBody));

            HttpResponse<byte[]> response;
            try {
                response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                byte[] message = ("target unreachable: " + url + "（" + e.getClass().getSimpleName()
                        + "）；确认 --target 指向的静态站点已启动。").getBytes(StandardCharsets.UTF_8);
                Headers headers = exchange.getResponseHeaders();
                headers.set("Content-Type", "text/plain; charset=utf-8");
                headers.set("X-TraceBoard-Preview", "not-injected:read_error");
                exchange.sendResponseHeaders(502, head ? -1 : message.length);
                if (!head) {
                    exchange.getResponseBody().write(message);
                }
                return;
            }

            int status = response.statusCode();
            byte[] payload = response.body() == null ? new byte[0] : response.body();
            String contentType = firstHeader(response, "Content-Type");
            String contentEncoding = firstHeader(response, "Content-Encoding");
            Long declaredLength = parseLength(firstHeader(response, "Content-Length"));

            String code = null;
            if (head) {
                code = "head";
            } else if (status == 204 || status == 304) {
                code = "no_body";
            } else if (status != 200) {
                code = "status";
            } else if (contentEncoding != null && !contentEncoding.isBlank()
                    && !contentEncoding.equalsIgnoreCase("identity")) {
                code = "encoding";
            } else if (!isHtml(contentType)) {
                code = "not_html";
            } else {
                String charset = charsetOf(contentType);
                if (charset != null && !charset.equalsIgnoreCase("utf-8")) {
                    code = "encoding";
                } else if ((declaredLength != null && declaredLength > MAX_INJECT_BYTES)
                        || payload.length > MAX_INJECT_BYTES) {
                    code = "too_large";
                } else if (payload.length == 0) {
                    code = "no_body";
                }
            }

            if (code != null) {
                sendUpstream(exchange, response, method, false, "not-injected:" + code, false);
                return;
            }
            String text = new String(payload, StandardCharsets.UTF_8);
            int bodyClose = Util.lastIndexOfIgnoreCase(text, "</body>");
            if (bodyClose < 0) {
                sendUpstream(exchange, response, method, false, "not-injected:no_body", false);
                return;
            }
            byte[] injected = (text.substring(0, bodyClose) + INJECT_TAGS + text.substring(bodyClose))
                    .getBytes(StandardCharsets.UTF_8);
            sendUpstream(exchange, response, method, true, "injected", true, injected);
        }

        private void sendUpstream(HttpExchange exchange, HttpResponse<byte[]> response, String method,
                boolean inject, String previewHeader, boolean stripped, byte[]... overrideBody) throws IOException {
            int status = response.statusCode();
            boolean head = method.equalsIgnoreCase("HEAD");
            boolean noBodyAllowed = head || status == 204 || status == 304;
            byte[] body = overrideBody.length > 0 ? overrideBody[0]
                    : (response.body() == null ? new byte[0] : response.body());

            Headers out = exchange.getResponseHeaders();
            for (Map.Entry<String, List<String>> header : response.headers().map().entrySet()) {
                String name = header.getKey();
                if (skipResponseHeader(name)) {
                    continue;
                }
                if (name.equalsIgnoreCase("Content-Length")) {
                    continue; // recomputed by sendResponseHeaders (also for byte-exact pass-through)
                }
                if (stripped && (name.equalsIgnoreCase("Content-Encoding")
                        || name.equalsIgnoreCase("ETag")
                        || name.equalsIgnoreCase("Last-Modified")
                        || name.equalsIgnoreCase("Content-MD5"))) {
                    continue;
                }
                for (String value : header.getValue()) {
                    out.add(name, value);
                }
            }
            if (previewHeader != null) {
                out.set("X-TraceBoard-Preview", previewHeader);
            }
            int length = noBodyAllowed ? -1 : body.length;
            exchange.sendResponseHeaders(status, length);
            if (length > 0) {
                exchange.getResponseBody().write(body);
            }
        }

        private static void sendText(HttpExchange exchange, int status, String text) throws IOException {
            byte[] body = text.getBytes(StandardCharsets.UTF_8);
            Headers headers = exchange.getResponseHeaders();
            headers.set("Content-Type", "text/plain; charset=utf-8");
            headers.set("Cache-Control", "no-store");
            boolean head = exchange.getRequestMethod().equalsIgnoreCase("HEAD");
            exchange.sendResponseHeaders(status, head ? -1 : body.length);
            if (!head) {
                exchange.getResponseBody().write(body);
            }
        }

        private static byte[] readBody(HttpExchange exchange) throws IOException {
            var stream = exchange.getRequestBody();
            return stream.readAllBytes();
        }

        private static HttpRequest.BodyPublisher methodBody(String method, byte[] body) {
            if (body.length == 0 && (method.equalsIgnoreCase("GET") || method.equalsIgnoreCase("HEAD"))) {
                return HttpRequest.BodyPublishers.noBody();
            }
            return HttpRequest.BodyPublishers.ofByteArray(body);
        }

        private static boolean skipRequestHeader(String name) {
            return hopByHop(name) || name.equalsIgnoreCase("Host") || name.equalsIgnoreCase("Accept-Encoding")
                    || name.equalsIgnoreCase("Content-Length") || name.equalsIgnoreCase("Expect");
        }

        private static boolean skipResponseHeader(String name) {
            return hopByHop(name) || name.equalsIgnoreCase("Date")
                    || name.equalsIgnoreCase("X-TraceBoard-Preview");
        }

        private static boolean hopByHop(String name) {
            return name.equalsIgnoreCase("Connection") || name.equalsIgnoreCase("Keep-Alive")
                    || name.equalsIgnoreCase("TE") || name.equalsIgnoreCase("Trailer")
                    || name.equalsIgnoreCase("Transfer-Encoding") || name.equalsIgnoreCase("Upgrade")
                    || name.toLowerCase(Locale.ROOT).startsWith("proxy-");
        }

        private static String firstHeader(HttpResponse<byte[]> response, String name) {
            return response.headers().firstValue(name).orElse(null);
        }

        private static Long parseLength(String value) {
            if (value == null || value.isBlank()) {
                return null;
            }
            try {
                return Long.parseLong(value.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }

        private static String charsetOf(String contentType) {
            if (contentType == null) {
                return null;
            }
            for (String part : contentType.split(";")) {
                String token = part.trim();
                if (token.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                    String value = token.substring("charset=".length()).trim();
                    if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
                        value = value.substring(1, value.length() - 1);
                    }
                    return value;
                }
            }
            return null;
        }

        private static boolean isHtml(String contentType) {
            if (contentType == null) {
                return false;
            }
            String base = contentType.split(";")[0].trim();
            return base.equalsIgnoreCase("text/html");
        }
    }
}
