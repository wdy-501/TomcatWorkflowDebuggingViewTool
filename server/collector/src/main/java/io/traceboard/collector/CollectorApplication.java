package io.traceboard.collector;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * S1 collector (walking skeleton).
 *
 * <p>Exposes only: GET /actuator/health, GET /api/v1/meta, POST /ingest/v1/events,
 * GET /api/v1/sessions and GET /api/v1/sessions/{sessionId}/events (read-only query).
 * In-memory append-only storage only: no persistence, no correlation, no graph/replay/stream,
 * no launcher/cloud, no MySQL.</p>
 */
@SpringBootApplication
public class CollectorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollectorApplication.class, args);
    }
}