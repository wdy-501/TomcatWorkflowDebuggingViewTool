package io.traceboard.collector.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Meta endpoint, shape frozen by docs/contracts/api.v1.md §3.2.
 *
 * <p>capabilities is an honesty switch: in S0 every unimplemented capability is false.</p>
 */
@RestController
public class MetaController {

    static final String SERVICE = "traceboard-collector";
    static final String VERSION = "0.1.0-SNAPSHOT";
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
                new Capabilities(true, true, false, false, false));
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