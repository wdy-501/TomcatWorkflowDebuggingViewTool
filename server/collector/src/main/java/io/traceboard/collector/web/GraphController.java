package io.traceboard.collector.web;

import java.util.regex.Pattern;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.traceboard.collector.derive.GraphResponse;
import io.traceboard.collector.derive.TraceDeriver;
import io.traceboard.collector.store.EventStore;
import io.traceboard.collector.store.SessionLog;

/**
 * {@code GET /api/v1/sessions/{sessionId}/graph?traceId=<32hex>} (api.v1.md §8.2): nodes and
 * parent/child edges of one trace, derived at read time from the in-memory snapshot.
 *
 * <p>Decision order is fixed: 400 for a missing/malformed {@code traceId}, then 404 for an
 * unknown session, then 404 when the session holds no such trace. Nodes echo event facts
 * verbatim (no aggregation, no xN merge); nothing is stored, cached or rewritten. This is a
 * query, not replay; non-GET -> 405 (Spring default body).</p>
 */
@RestController
public class GraphController {

    private static final Pattern TRACE_ID = Pattern.compile(TraceDeriver.TRACE_ID_PATTERN);

    private final EventStore store;
    private final TraceDeriver deriver;

    public GraphController(EventStore store, TraceDeriver deriver) {
        this.store = store;
        this.deriver = deriver;
    }

    @GetMapping(path = "/api/v1/sessions/{sessionId}/graph", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> graph(@PathVariable("sessionId") String sessionId,
                                        @RequestParam(name = "traceId", required = false) String traceId) {
        if (traceId == null || !TRACE_ID.matcher(traceId).matches()) {
            return ResponseEntity.badRequest()
                    .body(ApiError.of("bad_request", "traceId must be 32 lowercase hex characters"));
        }

        SessionLog log = store.find(sessionId);
        if (log == null) {
            return ResponseEntity.status(404).body(ApiError.of("not_found", "unknown session"));
        }

        GraphResponse response = deriver.graph(sessionId, traceId, log.snapshot().events());
        if (response == null) {
            return ResponseEntity.status(404).body(ApiError.of("not_found", "unknown traceId in session"));
        }
        return ResponseEntity.ok(response);
    }
}
