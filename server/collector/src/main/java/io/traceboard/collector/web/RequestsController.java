package io.traceboard.collector.web;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import io.traceboard.collector.derive.TraceDeriver;
import io.traceboard.collector.store.EventStore;
import io.traceboard.collector.store.SessionLog;

/**
 * {@code GET /api/v1/sessions/{sessionId}/requests} (api.v1.md §8.1): trace-grouped request
 * summary, derived at read time from the in-memory snapshot.
 *
 * <p>Read-only by construction: no cache, no persistence, no event rewrite, no {@code seq}
 * consumption, no pagination. This is a query, not replay. Unknown session -> 404 envelope;
 * non-GET -> 405 (Spring default body).</p>
 */
@RestController
public class RequestsController {

    private final EventStore store;
    private final TraceDeriver deriver;

    public RequestsController(EventStore store, TraceDeriver deriver) {
        this.store = store;
        this.deriver = deriver;
    }

    @GetMapping(path = "/api/v1/sessions/{sessionId}/requests", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> requests(@PathVariable("sessionId") String sessionId) {
        SessionLog log = store.find(sessionId);
        if (log == null) {
            return ResponseEntity.status(404).body(ApiError.of("not_found", "unknown session"));
        }
        return ResponseEntity.ok(deriver.requests(sessionId, log.snapshot().events()));
    }
}
