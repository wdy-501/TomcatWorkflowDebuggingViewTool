package io.traceboard.agent;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Fail-open NDJSON sender (s1-plan.md §7.4).
 *
 * <p>One daemon thread, bounded queue (16), one NDJSON line per POST, 1 attempt, no retry storm.
 * Every failure is swallowed and only counted on stderr (throttled). The request thread is never
 * blocked beyond a queue offer.</p>
 */
final class EventSender {

    private static final int CAPACITY = 16;
    private static final int CONNECT_TIMEOUT_MS = 300;
    private static final int READ_TIMEOUT_MS = 700;
    private static final int MAX_RESPONSE_BYTES = 8192;
    private static final long SHUTDOWN_DRAIN_MS = 1000L;

    private final BlockingQueue<byte[]> queue = new ArrayBlockingQueue<byte[]>(CAPACITY);
    private final String url;
    private final Thread worker;
    private final AtomicLong dropped = new AtomicLong();
    private final AtomicLong ingestRejected = new AtomicLong();
    private volatile boolean closed;

    EventSender(String url) {
        this.url = url;
        this.worker = new Thread(new Runnable() {
            @Override
            public void run() {
                drainLoop();
            }
        }, "traceboard-agent-sender");
        this.worker.setDaemon(true);
        this.worker.start();
        try {
            Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
                @Override
                public void run() {
                    shutdown();
                }
            }, "traceboard-agent-shutdown"));
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    /**
     * Non-blocking enqueue. A full queue drops the payload and counts it (never silent).
     */
    void offer(byte[] payload) {
        try {
            if (closed) {
                countDropped();
                return;
            }
            if (!queue.offer(payload)) {
                countDropped();
            }
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    private void countDropped() {
        long n = dropped.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log("dropped=" + n + " reason=queue_full");
        }
    }

    private void drainLoop() {
        while (true) {
            byte[] payload;
            try {
                payload = queue.take();
            } catch (InterruptedException e) {
                drainOnShutdown();
                return;
            }
            send(payload);
        }
    }

    private void shutdown() {
        try {
            closed = true;
            worker.interrupt();
            worker.join(SHUTDOWN_DRAIN_MS + 100L);
        } catch (Throwable ignored) {
            // fail-open
        }
    }

    private void drainOnShutdown() {
        long deadline = System.currentTimeMillis() + SHUTDOWN_DRAIN_MS;
        byte[] payload;
        while (System.currentTimeMillis() < deadline) {
            payload = queue.poll();
            if (payload == null) {
                return;
            }
            send(payload);
        }
    }

    private void send(byte[] payload) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setUseCaches(false);
            connection.setRequestProperty("Content-Type", "application/x-ndjson; charset=utf-8");
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
            consume(response);
            if (code != HttpURLConnection.HTTP_ACCEPTED) {
                countRejected("status=" + code);
            }
        } catch (Throwable t) {
            countRejected("status=io_error");
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

    private static void consume(InputStream stream) {
        if (stream == null) {
            return;
        }
        try {
            byte[] buffer = new byte[1024];
            int total = 0;
            int read;
            while (total < MAX_RESPONSE_BYTES && (read = stream.read(buffer)) != -1) {
                total += read;
            }
        } catch (Throwable ignored) {
            // response body is irrelevant (never echoed)
        } finally {
            try {
                stream.close();
            } catch (Throwable ignored) {
                // fail-open
            }
        }
    }

    private void countRejected(String detail) {
        long n = ingestRejected.incrementAndGet();
        if (n == 1L || n % 100L == 0L) {
            TraceAgent.log("ingest_rejected=" + n + " " + detail);
        }
    }
}
