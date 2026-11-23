package io.traceboard.collector;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * S0 collector skeleton.
 *
 * <p>Exposes only: GET /actuator/health, GET /api/v1/meta, POST /ingest/v1/events (501 placeholder).
 * No persistence, no correlation, no launcher/cloud, no MySQL.</p>
 */
@SpringBootApplication
public class CollectorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollectorApplication.class, args);
    }
}