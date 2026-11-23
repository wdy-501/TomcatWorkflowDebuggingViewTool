package io.traceboard.launcher;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Thin JDK HttpClient wrapper used by preview/diagnose/jar (HTTP/1.1, no redirects, no compression). */
final class Http {

    static HttpClient client(Duration connectTimeout) {
        return HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(connectTimeout)
                .build();
    }

    /** Result of a simple read-only GET; {@code error} is null when a response was received. */
    record Resp(int status, byte[] body, Map<String, List<String>> headers, String error, String url) {

        boolean ok() {
            return error == null;
        }

        String header(String name) {
            for (Map.Entry<String, List<String>> e : headers.entrySet()) {
                if (e.getKey().equalsIgnoreCase(name) && e.getValue() != null && !e.getValue().isEmpty()) {
                    return e.getValue().get(0);
                }
            }
            return null;
        }

        String bodyText() {
            return body == null ? "" : new String(body, java.nio.charset.StandardCharsets.UTF_8);
        }
    }

    private Http() {
    }

    static Resp get(HttpClient client, String url, Duration timeout) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(timeout)
                    .header("Accept", "*/*")
                    .GET()
                    .build();
            HttpResponse<byte[]> resp = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            Map<String, List<String>> headers = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
            headers.putAll(resp.headers().map());
            return new Resp(resp.statusCode(), resp.body(), headers, null, url);
        } catch (IOException | RuntimeException e) {
            return new Resp(-1, new byte[0], Map.of(), e.getClass().getSimpleName(), url);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Resp(-1, new byte[0], Map.of(), "interrupted", url);
        }
    }

    /** Health probe used by {@code jar} readiness: any 2xx means ready. */
    static boolean is2xx(HttpClient client, String url, Duration timeout) {
        Resp resp = get(client, url, timeout);
        return resp.ok() && resp.status() >= 200 && resp.status() <= 299;
    }

    static boolean is2xx(int status) {
        return status >= 200 && status <= 299;
    }
}
