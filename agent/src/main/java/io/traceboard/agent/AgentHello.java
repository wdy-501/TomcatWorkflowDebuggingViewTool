package io.traceboard.agent;

import java.io.InputStream;
import java.io.OutputStream;
import java.lang.management.ManagementFactory;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * S4 diagnostic handshake (dispatch §4.5, api.v1.md §10.2): one daemon thread posts
 * {@code {"schema":"traceboard.agent.v1","sessionId":...,"version":...,"pid":...,"startedAtMs":...}}
 * to {@code <ingest base>/v1/agent-hello} after premain configuration.
 *
 * <p>Strictly fail-open: the caller returns immediately, at most three attempts run on the daemon
 * thread (connect/read 1s, 200/400ms backoff), nothing is echoed, and the host application is never
 * blocked or broken. Only counters are logged ({@code hello_sent=1} / {@code hello_failed=3} /
 * {@code hello_skipped reason=...}); exception messages are never used.</p>
 */
final class AgentHello {

    static final String SCHEMA = "traceboard.agent.v1";
    static final String DEFAULT_VERSION = "0.1.0-SNAPSHOT";

    private static final String EVENTS_SUFFIX = "/v1/events";
    private static final String HELLO_SUFFIX = "/v1/agent-hello";
    private static final int CONNECT_TIMEOUT_MS = 1000;
    private static final int READ_TIMEOUT_MS = 1000;
    private static final int MAX_ATTEMPTS = 3;
    private static final long BACKOFF_BASE_MS = 200L;
    private static final int MAX_VERSION_CHARS = 64;

    private AgentHello() {
        // utility class, never instantiated
    }

    /**
     * Derives the hello URL, builds the body and starts the daemon sender. NEVER throws and never
     * blocks; any unsupported configuration is skipped and counted on stderr.
     */
    static void start(final AgentConfig config) {
        try {
            if (config == null || !config.isEnabled() || config.ingestUrl() == null) {
                return;
            }
            final String helloUrl = helloUrl(config.ingestUrl());
            if (helloUrl == null) {
                TraceAgent.log("hello_skipped reason=ingest_url");
                return;
            }
            final long pid = currentPid();
            if (pid < 1L) {
                TraceAgent.log("hello_skipped reason=pid");
                return;
            }
            final byte[] payload = payload(config.sessionId(), version(), pid,
                    System.currentTimeMillis());
            Thread thread = new Thread(new Runnable() {
                @Override
                public void run() {
                    send(helloUrl, payload);
                }
            }, "traceboard-agent-hello");
            thread.setDaemon(true);
            thread.start();
        } catch (Throwable ignored) {
            // fail-open: the handshake must never affect the host application
        }
    }

    /**
     * @return {@code <base>/v1/agent-hello} when the ingest URL ends with {@code /v1/events};
     *         {@code null} otherwise (handshake skipped, reason=ingest_url)
     */
    static String helloUrl(String ingestUrl) {
        if (ingestUrl == null) {
            return null;
        }
        String url = ingestUrl.trim();
        if (!url.endsWith(EVENTS_SUFFIX) || url.length() <= EVENTS_SUFFIX.length()) {
            return null;
        }
        return url.substring(0, url.length() - EVENTS_SUFFIX.length()) + HELLO_SUFFIX;
    }

    /**
     * JVM pid from {@code RuntimeMXBean.getName()} ({@code <pid>@<host>}); {@code -1} when the
     * name cannot be parsed (handshake skipped, reason=pid).
     */
    static long currentPid() {
        try {
            String name = ManagementFactory.getRuntimeMXBean().getName();
            if (name == null) {
                return -1L;
            }
            int at = name.indexOf('@');
            String prefix = at > 0 ? name.substring(0, at) : name;
            long pid = Long.parseLong(prefix.trim());
            return pid > 0L ? pid : -1L;
        } catch (Throwable ignored) {
            return -1L;
        }
    }

    /** Agent jar manifest {@code Implementation-Version}, falling back to {@value #DEFAULT_VERSION}. */
    static String version() {
        try {
            Package pkg = TraceAgent.class.getPackage();
            String manifest = (pkg == null) ? null : pkg.getImplementationVersion();
            if (manifest != null) {
                String trimmed = manifest.trim();
                if (!trimmed.isEmpty()) {
                    return trimmed.length() <= MAX_VERSION_CHARS
                            ? trimmed : trimmed.substring(0, MAX_VERSION_CHARS);
                }
            }
        } catch (Throwable ignored) {
            // fall through to the default
        }
        return DEFAULT_VERSION;
    }

    static byte[] payload(String sessionId, String version, long pid, long startedAtMs) {
        StringBuilder json = new StringBuilder(160);
        json.append('{');
        appendStringField(json, "schema", SCHEMA).append(',');
        appendStringField(json, "sessionId", sessionId).append(',');
        appendStringField(json, "version", version).append(',');
        json.append("\"pid\":").append(pid).append(',');
        json.append("\"startedAtMs\":").append(startedAtMs).append('}');
        try {
            return json.toString().getBytes("UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            return json.toString().getBytes();
        }
    }

    private static void send(String url, byte[] payload) {
        int attempts = 0;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            attempts = attempt;
            if (post(url, payload) == HttpURLConnection.HTTP_OK) {
                TraceAgent.log("hello_sent=1");
                return;
            }
            if (attempt < MAX_ATTEMPTS) {
                try {
                    Thread.sleep(BACKOFF_BASE_MS * attempt);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        TraceAgent.log("hello_failed=" + attempts);
    }

    /**
     * @return the HTTP status code, or {@code -1} on any I/O/configuration failure (fixed string,
     *         no exception message is ever read)
     */
    private static int post(String url, byte[] payload) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setUseCaches(false);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setFixedLengthStreamingMode(payload.length);
            OutputStream out = connection.getOutputStream();
            try {
                out.write(payload);
                out.flush();
            } finally {
                out.close();
            }
            int code = connection.getResponseCode();
            InputStream response = (code >= 400) ? connection.getErrorStream() : connection.getInputStream();
            drain(response);
            return code;
        } catch (Throwable ignored) {
            return -1;
        } finally {
            if (connection != null) {
                try {
                    connection.disconnect();
                } catch (Throwable ignored) {
                    // fail-open
                }
            }
        }
    }

    private static void drain(InputStream stream) {
        if (stream == null) {
            return;
        }
        try {
            byte[] buffer = new byte[256];
            while (stream.read(buffer) != -1) {
                // response body is irrelevant and never echoed
            }
        } catch (Throwable ignored) {
            // fail-open
        } finally {
            try {
                stream.close();
            } catch (Throwable ignored) {
                // fail-open
            }
        }
    }

    private static StringBuilder appendStringField(StringBuilder json, String name, String value) {
        json.append('"').append(name).append("\":");
        json.append('"');
        if (value != null) {
            for (int i = 0; i < value.length(); i++) {
                char c = value.charAt(i);
                switch (c) {
                    case '"':
                        json.append("\\\"");
                        break;
                    case '\\':
                        json.append("\\\\");
                        break;
                    case '\n':
                        json.append("\\n");
                        break;
                    case '\r':
                        json.append("\\r");
                        break;
                    case '\t':
                        json.append("\\t");
                        break;
                    default:
                        if (c < 0x20) {
                            json.append(String.format(java.util.Locale.ROOT, "\\u%04x", (int) c));
                        } else {
                            json.append(c);
                        }
                }
            }
        }
        return json.append('"');
    }
}
