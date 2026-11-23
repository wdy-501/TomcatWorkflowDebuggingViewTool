package io.traceboard.collector;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * S2 collector.
 *
 * <p>Exposes only: GET /actuator/health, GET /api/v1/meta, POST /ingest/v1/events,
 * GET /api/v1/sessions, GET /api/v1/sessions/{sessionId}/events (read-only query) and the
 * S2 read-only derivations GET /api/v1/sessions/{sessionId}/requests and
 * GET /api/v1/sessions/{sessionId}/graph?traceId= (api.v1.md §8).</p>
 *
 * <p>In-memory append-only storage only: requests/graph are derived at read time, never
 * cached or persisted. No replay, no real-time push, no links, no launcher/cloud, no MySQL.</p>
 */
@SpringBootApplication
public class CollectorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollectorApplication.class, args);
    }
}