package io.traceboard.collector.web;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.traceboard.collector.store.EventStore;
import io.traceboard.collector.store.SessionLog;
import io.traceboard.collector.store.StoredEvent;

/**
 * Read-only session query (api.v1.md §7.2). This is a query, NOT replay: it never rewrites,
 * merges or re-executes events, and it produces no side effects.
 *
 * <p>{@code seq} is query metadata carried outside the event object:
 * {@code {"events":[{"seq":n,"event":{...}}],"nextSeq":n}}.</p>
 */
@RestController
public class SessionsController {

    private static final MediaType JSON_UTF8 = MediaType.parseMediaType("application/json;charset=UTF-8");
    private static final int DEFAULT_LIMIT = 200;
    private static final int MAX_LIMIT = 500;

    private final EventStore store;

    public SessionsController(EventStore store) {
        this.store = store;
    }

    @GetMapping(path = "/api/v1/sessions", produces = MediaType.APPLICATION_JSON_VALUE)
    public SessionsResponse sessions() {
        List<SessionSummary> sessions = new ArrayList<>();
        for (SessionLog.SessionSnapshot snapshot : store.list()) {
            sessions.add(new SessionSummary(snapshot.sessionId(), snapshot.eventCount(),
                    snapshot.startedAtMs(), snapshot.lastEventAtMs()));
        }
        return new SessionsResponse(sessions);
    }

    @DeleteMapping(path = "/api/v1/sessions/{sessionId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ClearResponse clear(@PathVariable("sessionId") String sessionId) {
        return new ClearResponse(sessionId, store.clear(sessionId));
    }

    @GetMapping(path = "/api/v1/sessions/{sessionId}/events", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> events(@PathVariable("sessionId") String sessionId,
                                         @RequestParam(name = "afterSeq", required = false) String afterSeqParam,
                                         @RequestParam(name = "limit", required = false) String limitParam) {
        long afterSeq;
        int limit;
        try {
            afterSeq = parseAfterSeq(afterSeqParam);
            limit = parseLimit(limitParam);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiError.of("bad_request", e.getMessage()));
        }

        SessionLog log = store.find(sessionId);
        if (log == null) {
            return ResponseEntity.status(404).body(ApiError.of("not_found", "unknown session"));
        }

        SessionLog.SessionSnapshot snapshot = log.snapshot();
        List<StoredEvent> page = new ArrayList<>();
        long nextSeq = afterSeq;
        for (StoredEvent event : snapshot.events()) {
            if (event.seq() <= afterSeq) {
                continue;
            }
            if (page.size() >= limit) {
                break;
            }
            page.add(event);
        }
        if (!page.isEmpty()) {
            nextSeq = page.get(page.size() - 1).seq();
        }

        StringBuilder json = new StringBuilder(64 + page.size() * 256);
        json.append("{\"events\":[");
        for (int i = 0; i < page.size(); i++) {
            StoredEvent event = page.get(i);
            if (i > 0) {
                json.append(',');
            }
            json.append("{\"seq\":").append(event.seq()).append(",\"event\":")
                    .append(event.rawEventJson()).append('}');
        }
        json.append("],\"nextSeq\":").append(nextSeq).append('}');
        return ResponseEntity.ok().contentType(JSON_UTF8).body(json.toString());
    }

    static long parseAfterSeq(String raw) {
        if (raw == null) {
            return 0L;
        }
        if (!raw.matches("[0-9]+")) {
            throw new IllegalArgumentException("afterSeq must be a non-negative integer");
        }
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("afterSeq must be a non-negative integer");
        }
    }

    static int parseLimit(String raw) {
        if (raw == null) {
            return DEFAULT_LIMIT;
        }
        if (!raw.matches("[0-9]+")) {
            throw new IllegalArgumentException("limit must be an integer between 1 and " + MAX_LIMIT);
        }
        int value;
        try {
            value = Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("limit must be an integer between 1 and " + MAX_LIMIT);
        }
        if (value < 1 || value > MAX_LIMIT) {
            throw new IllegalArgumentException("limit must be an integer between 1 and " + MAX_LIMIT);
        }
        return value;
    }

    public record SessionSummary(String sessionId, int eventCount, long startedAtMs, long lastEventAtMs) {
    }

    public record SessionsResponse(List<SessionSummary> sessions) {
    }

    public record ClearResponse(String sessionId, boolean cleared) {
    }
}
