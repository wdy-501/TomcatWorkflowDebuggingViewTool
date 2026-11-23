package io.traceboard.collector.web;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ingest placeholder, frozen by docs/contracts/api.v1.md §3.3.
 *
 * <p>S0 behaviour: always 501. The request body is never read, never parsed, never persisted.
 * No consumes restriction: any Content-Type hits the 501 placeholder.</p>
 */
@RestController
public class IngestController {

    @PostMapping(path = "/ingest/v1/events", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> ingest() {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("error", "not_implemented");
        envelope.put("message", "ingest is reserved for S1; S0 collector skeleton stores nothing"
                + " (S0 placeholder, not implemented)");
        envelope.put("apiVersion", "v1");
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(envelope);
    }
}