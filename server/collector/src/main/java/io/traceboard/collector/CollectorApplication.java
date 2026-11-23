package io.traceboard.collector;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * S3 collector.
 *
 * <p>Exposes only: GET /actuator/health, GET /api/v1/meta, POST /ingest/v1/events,
 * GET /api/v1/sessions, GET /api/v1/sessions/{sessionId}/events (read-only query), the
 * S2 read-only derivations GET /api/v1/sessions/{sessionId}/requests and
 * GET /api/v1/sessions/{sessionId}/graph?traceId=, and the S3 read-only window
 * GET /api/v1/sessions/{sessionId}/replay (api.v1.md §9).</p>
 *
 * <p>S4 adds only the diagnostic control channel {@code POST /ingest/v1/agent-hello} and the
 * read-only connection fact {@code GET /api/v1/sessions/{sessionId}/agent} (memory-only,
 * last-wins, never an event); graph nodes gain the additive read-only
 * {@code reason}/{@code source}/{@code confidence} fields (api.v1.md §10).</p>
 *
 * <p>In-memory append-only storage only: requests/graph/replay are derived at read time, never
 * cached or persisted, and replay never writes or consumes {@code seq}. No stream/ws/links, no
 * real-time push, no launcher/cloud, no MySQL.</p>
 */
@SpringBootApplication
public class CollectorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollectorApplication.class, args);
    }
}