package io.traceboard.collector.web;

import java.util.List;
import java.util.regex.Pattern;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.traceboard.collector.derive.ReplayDeriver;
import io.traceboard.collector.derive.ReplayWindow;
import io.traceboard.collector.store.EventStore;
import io.traceboard.collector.store.SessionLog;
import io.traceboard.collector.store.StoredEvent;

/**
 * {@code GET /api/v1/sessions/{sessionId}/replay?fromNs=&toNs=} (api.v1.md §9.1,
 * transport.v1.md §6.4): read-only time window over already stored events.
 *
 * <p>Fixed decision order: 400 (parameter format/range/from&gt;to) -> 404 (unknown session) ->
 * 200 (empty window included). Parameters are received as strings so that non-integers,
 * negatives, blanks, signs, decimals and 64-bit overflows all become 400 instead of being
 * silently truncated/defaulted.</p>
 *
 * <p>0-write by construction: the response is rendered from an immutable snapshot, raw stored
 * JSON is embedded verbatim, no event/seq is touched, nothing is cached, the demo app is never
 * called. Two identical GETs are byte-identical. Only GET is mapped; other verbs get 405.</p>
 */
@RestController
public class ReplayController {

    private static final Pattern NS_PATTERN = Pattern.compile("^[0-9]+$");
    private static final MediaType JSON_UTF8 = MediaType.parseMediaType("application/json;charset=UTF-8");

    private final EventStore store;
    private final ReplayDeriver deriver;
    private final ObjectMapper objectMapper;

    public ReplayController(EventStore store, ReplayDeriver deriver, ObjectMapper objectMapper) {
        this.store = store;
        this.deriver = deriver;
        this.objectMapper = objectMapper;
    }

    @GetMapping(path = "/api/v1/sessions/{sessionId}/replay", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> replay(@PathVariable("sessionId") String sessionId,
                                         @RequestParam(name = "fromNs", required = false) String fromNsParam,
                                         @RequestParam(name = "toNs", required = false) String toNsParam) {
        long fromNs;
        Long toNs;
        try {
            fromNs = fromNsParam == null ? 0L : parseNs("fromNs", fromNsParam);
            toNs = toNsParam == null ? null : Long.valueOf(parseNs("toNs", toNsParam));
            if (toNs != null && fromNs > toNs) {
                throw new IllegalArgumentException("fromNs must be less than or equal to toNs");
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiError.of("bad_request", e.getMessage()));
        }

        SessionLog log = store.find(sessionId);
        if (log == null) {
            return ResponseEntity.status(404).body(ApiError.of("not_found", "unknown session"));
        }

        ReplayWindow window = deriver.window(fromNs, toNs, log.snapshot().events());
        return ResponseEntity.ok().contentType(JSON_UTF8).body(render(sessionId, window));
    }

    /**
     * Render the exact contract shape {@code {mode,readOnly,sessionId,fromNs,toNs,events}} with
     * stored event JSON embedded verbatim ({@code seq} outside the event object).
     */
    private String render(String sessionId, ReplayWindow window) {
        List<StoredEvent> events = window.events();
        StringBuilder json = new StringBuilder(96 + events.size() * 512);
        json.append("{\"mode\":\"replay\",\"readOnly\":true,\"sessionId\":")
                .append(quote(sessionId))
                .append(",\"fromNs\":").append(window.fromNs())
                .append(",\"toNs\":").append(window.toNs())
                .append(",\"events\":[");
        for (int i = 0; i < events.size(); i++) {
            StoredEvent event = events.get(i);
            if (i > 0) {
                json.append(',');
            }
            json.append("{\"seq\":").append(event.seq()).append(",\"event\":")
                    .append(event.rawEventJson()).append('}');
        }
        json.append("]}");
        return json.toString();
    }

    private String quote(String value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            // Unreachable for a String; keep the output valid JSON without echoing internals.
            return "\"\"";
        }
    }

    static long parseNs(String name, String raw) {
        if (!NS_PATTERN.matcher(raw).matches()) {
            throw new IllegalArgumentException(name + " must be a non-negative integer");
        }
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(name + " must be a non-negative integer");
        }
    }
}
