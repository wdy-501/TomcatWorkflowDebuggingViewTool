package io.traceboard.launcher;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

/**
 * {@code diagnose}: seven read-only checks, fixed order. Rows are
 * {@code PASS|FAIL|WARN|SKIP <check>: <evidence>}; the last line is exactly
 * {@code SUMMARY: <PASS|FAIL> pass=<n> warn=<n> fail=<n> skip=<n>} (sum = 7).
 * {@code SUMMARY: PASS} iff {@code fail=0}; WARN/SKIP keep exit code 0.
 */
final class DiagnoseCommand {

    private static final Set<String> META_KEYS = Set.of("health", "meta", "ingestEvents", "realtime", "replay");

    private int pass;
    private int warn;
    private int fail;
    private int skip;

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        String session = Args.session(args);
        String collector = Urls.collectorOrigin(args.get("--collector"));
        String appUrl = Urls.loopbackHttpUrl(
                args.get("--app-url") == null ? Urls.DEFAULT_APP_URL : args.get("--app-url"), "--app-url").toString();
        String previewUrl = null;
        if (args.has("--preview-url")) {
            previewUrl = Urls.loopbackHttpUrl(args.get("--preview-url"), "--preview-url").toString();
        }

        HttpClient client = Http.client(Duration.ofSeconds(2));
        checkCollectorHealth(client, collector);
        checkCollectorMeta(client, collector);
        checkAppHealth(client, appUrl);
        checkAgentHandshake(client, collector, session);
        checkRecentEvents(client, collector, session);
        checkPreviewInjection(client, previewUrl);
        checkSdkScript(client, previewUrl);

        String summary = fail == 0 ? "PASS" : "FAIL";
        System.out.println("SUMMARY: " + summary + " pass=" + pass + " warn=" + warn + " fail=" + fail + " skip=" + skip);
        System.out.flush();
        return fail == 0 ? Launcher.EXIT_OK : Launcher.EXIT_FAILED;
    }

    private void checkCollectorHealth(HttpClient client, String collector) {
        String url = collector + "/actuator/health";
        Http.Resp resp = Http.get(client, url, Duration.ofSeconds(5));
        if (!resp.ok()) {
            fail++;
            row("FAIL", "collector_health", "GET " + url + " -> connect failed(" + resp.error()
                    + ") INGEST_UNREACHABLE; 建议: 先启动 collector（\"$JAVA21/bin/java\" -jar server/collector/target/traceboard-collector-1.0.0.jar）。");
            return;
        }
        String body = resp.bodyText();
        boolean up = body.matches("(?s).*\"status\"\\s*:\\s*\"UP\".*");
        if (resp.status() == 200 && up) {
            pass++;
            row("PASS", "collector_health", "GET " + url + " -> 200 status=UP");
        } else {
            fail++;
            row("FAIL", "collector_health", "GET " + url + " -> " + resp.status() + " status!=UP body=\""
                    + Util.snippet(resp.body(), 200) + "\"; 建议: collector 健康端点应返回 200 UP。");
        }
    }

    private void checkCollectorMeta(HttpClient client, String collector) {
        String url = collector + "/api/v1/meta";
        Http.Resp resp = Http.get(client, url, Duration.ofSeconds(5));
        if (!resp.ok()) {
            fail++;
            row("FAIL", "collector_meta", "GET " + url + " -> connect failed(" + resp.error()
                    + "); 建议: 先启动 collector（meta 不带 /ingest 前缀）。");
            return;
        }
        String body = resp.bodyText();
        String capabilities = Util.Json.object(body, "capabilities");
        Set<String> keys = Util.Json.objectKeys(capabilities);
        String realtime = capabilities == null ? null : Util.Json.slice(capabilities, "realtime");
        boolean realtimeFalse = realtime != null && realtime.trim().equalsIgnoreCase("false");
        if (resp.status() == 200 && keys.equals(META_KEYS) && realtimeFalse) {
            pass++;
            row("PASS", "collector_meta", "GET " + url + " -> 200 capabilities={" + String.join(",", keys)
                    + "} realtime=false");
        } else {
            fail++;
            row("FAIL", "collector_meta", "GET " + url + " -> " + resp.status() + " capabilities={" + String.join(",", keys)
                    + "} realtime=" + (realtime == null ? "missing" : realtime.trim())
                    + "; 期望恰好 " + META_KEYS.size() + " 键 {health,meta,ingestEvents,realtime,replay} 且 realtime=false。");
        }
    }

    private void checkAppHealth(HttpClient client, String appUrl) {
        Http.Resp resp = Http.get(client, appUrl, Duration.ofSeconds(5));
        String contentType = resp.header("Content-Type");
        if (resp.ok() && Http.is2xx(resp.status())) {
            pass++;
            row("PASS", "app_health", "GET " + appUrl + " -> " + resp.status() + " Content-Type="
                    + (contentType == null ? "(missing)" : contentType));
        } else {
            fail++;
            row("FAIL", "app_health", "GET " + appUrl + " -> "
                    + (resp.ok() ? resp.status() + " Content-Type=" + (contentType == null ? "(missing)" : contentType)
                    : "connect failed(" + resp.error() + ")")
                    + "; 建议: --app-url 必须是真实 2xx 端点（/ 返回 404 不代表应用没启动）。");
        }
    }

    private void checkAgentHandshake(HttpClient client, String collector, String session) {
        String url = collector + "/api/v1/sessions/" + session + "/agent";
        Http.Resp resp = Http.get(client, url, Duration.ofSeconds(5));
        if (!resp.ok()) {
            fail++;
            row("FAIL", "agent_handshake", "GET " + url + " -> connect failed(" + resp.error()
                    + "); 建议: 先启动 collector，再带 -javaagent 重启应用。");
            return;
        }
        String body = resp.bodyText();
        boolean connected = Util.Json.hasTrue(body, "connected");
        String sessionId = Util.Json.str(body, "sessionId");
        if (resp.status() == 200 && connected && session.equals(sessionId)) {
            pass++;
            row("PASS", "agent_handshake", "GET " + url + " -> 200 connected=true version="
                    + safe(Util.Json.str(body, "version")) + " pid=" + safe(Util.Json.num(body, "pid"))
                    + " startedAtMs=" + safe(Util.Json.num(body, "startedAtMs"))
                    + " lastSeenMs=" + safe(Util.Json.num(body, "lastSeenMs")));
        } else {
            fail++;
            String reason;
            if (resp.status() == 404) {
                reason = "agent 未握手（或 collector 重启后未再收到 hello）";
            } else if (resp.status() == 200) {
                reason = "connected/sessionId 不匹配";
            } else {
                reason = "状态异常";
            }
            row("FAIL", "agent_handshake", "GET " + url + " -> " + resp.status() + " " + reason
                    + " body=\"" + Util.snippet(resp.body(), 200)
                    + "\"; 建议: 确认应用带 -javaagent 且 -Dtraceboard.sessionId=" + session + "，collector 先启动后重启应用。");
        }
    }

    private void checkRecentEvents(HttpClient client, String collector, String session) {
        String url = collector + "/api/v1/sessions/" + session + "/events?afterSeq=0&limit=1";
        Http.Resp resp = Http.get(client, url, Duration.ofSeconds(5));
        if (!resp.ok()) {
            fail++;
            row("FAIL", "recent_events", "GET " + url + " -> connect failed(" + resp.error()
                    + "); 建议: 先启动 collector 并确认 session 事件已上报。");
            return;
        }
        String body = resp.bodyText();
        if (resp.status() == 200) {
            String events = Util.Json.array(body, "events");
            String nextSeq = body.contains("\"nextSeq\"") ? Util.Json.slice(body, "nextSeq") : null;
            Long firstSeq = Util.Json.num(body, "seq");
            boolean empty = events == null || events.trim().equals("[]") || !events.contains("{");
            if (empty) {
                warn++;
                row("WARN", "recent_events", "GET " + url + " -> 200 events=0 nextSeq="
                        + (nextSeq == null ? "(missing)" : nextSeq.trim())
                        + "; 握手仍可能有效，但尚无事件（未采集 ≠ 成功）。");
            } else {
                pass++;
                row("PASS", "recent_events", "GET " + url + " -> 200 events>0 firstSeq="
                        + (firstSeq == null ? "(missing)" : firstSeq)
                        + " nextSeq=" + (nextSeq == null ? "(missing)" : nextSeq.trim()));
            }
            return;
        }
        if (resp.status() == 404) {
            warn++;
            row("WARN", "recent_events", "GET " + url + " -> 404 尚无事件（可达的 404 视为 WARN，不伪造 PASS）; body=\""
                    + Util.snippet(resp.body(), 200) + "\"");
            return;
        }
        fail++;
        row("FAIL", "recent_events", "GET " + url + " -> " + resp.status() + " body=\""
                + Util.snippet(resp.body(), 200) + "\"");
    }

    private void checkPreviewInjection(HttpClient client, String previewUrl) {
        if (previewUrl == null) {
            skip++;
            row("SKIP", "preview_injection", "reason=no_preview_url");
            return;
        }
        Http.Resp resp = Http.get(client, previewUrl, Duration.ofSeconds(10));
        if (!resp.ok()) {
            fail++;
            row("FAIL", "preview_injection", "GET " + previewUrl + " -> connect failed(" + resp.error()
                    + "); 建议: 启动 preview（launcher preview ...），并确认 --preview-url 是预览根页。");
            return;
        }
        String header = resp.header("X-TraceBoard-Preview");
        String text = resp.bodyText();
        int bodyClose = Util.lastIndexOfIgnoreCase(text, "</body>");
        String configTag = "<script src=\"/traceboard/config.js\"></script>";
        String sdkTag = "<script src=\"/traceboard/sdk.js\"></script>";
        int configIndex = text.indexOf(configTag);
        int sdkIndex = text.indexOf(sdkTag);
        boolean tagsBeforeBody = bodyClose >= 0 && configIndex >= 0 && sdkIndex >= 0
                && configIndex < bodyClose && sdkIndex < bodyClose;
        boolean injectedHeader = header != null && header.trim().equalsIgnoreCase("injected");
        if (resp.status() == 200 && injectedHeader && tagsBeforeBody) {
            pass++;
            row("PASS", "preview_injection", "GET " + previewUrl + " -> 200 X-TraceBoard-Preview=injected config.js+sdk.js before </body>");
        } else {
            fail++;
            row("FAIL", "preview_injection", "GET " + previewUrl + " -> " + resp.status() + " X-TraceBoard-Preview="
                    + (header == null ? "(missing)" : header) + " configTag=" + (configIndex >= 0)
                    + " sdkTag=" + (sdkIndex >= 0) + " beforeBody=" + tagsBeforeBody
                    + " body=\"" + Util.snippet(resp.body(), 200)
                    + "\"; 建议: 预览目标须为静态 HTML（非 2xx/压缩/无 </body> 都不会注入），且必须走 8602 预览地址。");
        }
    }

    private void checkSdkScript(HttpClient client, String previewUrl) {
        if (previewUrl == null) {
            skip++;
            row("SKIP", "sdk_script", "reason=no_preview_url");
            return;
        }
        String origin;
        try {
            origin = Urls.originOf(URI.create(previewUrl));
        } catch (RuntimeException e) {
            fail++;
            row("FAIL", "sdk_script", "--preview-url 无法解析 origin: \"" + previewUrl + "\"");
            return;
        }
        String url = origin + "/traceboard/sdk.js";
        Http.Resp resp = Http.get(client, url, Duration.ofSeconds(10));
        String body = resp.bodyText();
        if (resp.ok() && resp.status() == 200 && body.contains("TraceBoardSDK")) {
            pass++;
            row("PASS", "sdk_script", "GET " + url + " -> 200 TraceBoardSDK found bytes=" + resp.body().length);
        } else {
            fail++;
            row("FAIL", "sdk_script", "GET " + url + " -> "
                    + (resp.ok() ? resp.status() + " TraceBoardSDK=" + body.contains("TraceBoardSDK")
                    : "connect failed(" + resp.error() + ")")
                    + "; 建议: 构建 SDK (cd \"frontend/sdk\" && npm ci && npm run build)，从仓库根启动 preview 或显式 --sdk。");
        }
    }

    private void row(String level, String check, String evidence) {
        System.out.println(level + " " + check + ": " + evidence);
        System.out.flush();
    }

    private static String safe(Object value) {
        return value == null ? "?" : String.valueOf(value);
    }
}
