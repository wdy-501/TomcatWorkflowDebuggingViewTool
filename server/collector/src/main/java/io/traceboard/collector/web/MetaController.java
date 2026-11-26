package io.traceboard.collector.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Meta endpoint; human-readable field reference is docs/important-notes.md.
 *
 * <p>capabilities is an honesty switch: S3 implements ingest plus the read-only replay window,
 * so {@code ingestEvents=true} and {@code replay=true} while {@code realtime} stays false
 * (no SSE/WebSocket). The object keeps exactly five keys.</p>
 */
@RestController
public class MetaController {

    static final String SERVICE = "traceboard-collector";
    static final String VERSION = "1.0.0";
    static final String API_VERSION = "v1";
    static final String SCHEMA_ID = "urn:traceboard:schema:event:v1";
    static final String SCHEMA_VERSION = "traceboard.event.v1";
    static final String SCHEMA_DIALECT = "2020-12";

    @GetMapping(path = "/api/v1/meta", produces = MediaType.APPLICATION_JSON_VALUE)
    public MetaResponse meta() {
        return new MetaResponse(
                SERVICE,
                VERSION,
                API_VERSION,
                new SchemaMeta(SCHEMA_ID, SCHEMA_VERSION, SCHEMA_DIALECT),
                new Capabilities(true, true, true, false, true));
    }

    public record SchemaMeta(String id, String version, String dialect) {
    }

    public record Capabilities(boolean health, boolean meta, boolean ingestEvents,
                               boolean realtime, boolean replay) {
    }

    public record MetaResponse(String service, String version, String apiVersion,
                               SchemaMeta schema, Capabilities capabilities) {
    }
}