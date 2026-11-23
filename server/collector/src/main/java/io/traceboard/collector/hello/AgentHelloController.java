package io.traceboard.collector.hello;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.traceboard.collector.web.ApiError;

import jakarta.servlet.http.HttpServletRequest;

/**
 * S4 control channel, NOT an event (api.v1.md §10.2/§10.3, dispatch §4.5):
 *
 * <ul>
 *   <li>{@code POST /ingest/v1/agent-hello} — status decision order is fixed
 *       {@code 405 -> 415 -> 413 -> 400 -> 200}; 405 is produced by Spring (only POST is
 *       mapped); the body cap is 4096 bytes; the success body is the exact
 *       {@code {"schema":"traceboard.agent.v1","sessionId":"...","accepted":true}};</li>
 *   <li>{@code GET /api/v1/sessions/{sessionId}/agent} — read-only connection fact, 200 with the
 *       last hello or 404 when absent (invalid session shape is also 404).</li>
 * </ul>
 *
 * <p>Nothing here writes events, consumes {@code seq}, creates sessions or changes meta; unknown
 * handshake fields are ignored. No auth/CORS/persistence/SSE/WS.</p>
 */
@RestController
public class AgentHelloController {

    static final String SCHEMA = "traceboard.agent.v1";
    static final int MAX_BODY_BYTES = 4096;
    static final int MAX_VERSION_CHARS = 64;

    private static final Pattern SESSION_ID = Pattern.compile("^s_[A-Za-z0-9_-]+$");
    private static final String JSON_CONTENT_TYPE = "application/json";

    private final HelloStore helloStore;
    private final ObjectMapper objectMapper;

    public AgentHelloController(HelloStore helloStore, ObjectMapper objectMapper) {
        this.helloStore = helloStore;
        this.objectMapper = objectMapper;
    }

    @PostMapping(path = "/ingest/v1/agent-hello", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> hello(HttpServletRequest request) {
        if (!isJson(request.getContentType())) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ApiError.of("unsupported_media_type",
                            "Content-Type must be application/json"));
        }
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ApiError.of("payload_too_large", "handshake body exceeds 4096 bytes"));
        }

        byte[] body;
        try {
            body = readBounded(request.getInputStream(), MAX_BODY_BYTES);
        } catch (IOException e) {
            return badRequest("request body could not be read");
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ApiError.of("payload_too_large", "handshake body exceeds 4096 bytes"));
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (IOException | RuntimeException e) {
            return badRequest("body must be a valid JSON object");
        }
        if (root == null || !root.isObject()) {
            return badRequest("body must be a valid JSON object");
        }

        JsonNode schema = root.get("schema");
        if (schema == null || !schema.isTextual() || !SCHEMA.equals(schema.textValue())) {
            return badRequest("schema must be " + SCHEMA);
        }
        JsonNode session = root.get("sessionId");
        if (session == null || !session.isTextual()
                || !SESSION_ID.matcher(session.textValue()).matches()) {
            return badRequest("sessionId must match ^s_[A-Za-z0-9_-]+$");
        }
        JsonNode version = root.get("version");
        if (version == null || !version.isTextual()
                || version.textValue().trim().isEmpty()
                || version.textValue().length() > MAX_VERSION_CHARS) {
            return badRequest("version must be a non-empty string of at most 64 characters");
        }
        JsonNode pid = root.get("pid");
        if (pid == null || !pid.isIntegralNumber() || !pid.canConvertToLong() || pid.longValue() < 1L) {
            return badRequest("pid must be an integer >= 1");
        }
        JsonNode startedAtMs = root.get("startedAtMs");
        if (startedAtMs == null || !startedAtMs.isIntegralNumber()
                || !startedAtMs.canConvertToLong() || startedAtMs.longValue() < 0L) {
            return badRequest("startedAtMs must be an integer >= 0");
        }

        String sessionId = session.textValue();
        helloStore.record(new AgentHello(sessionId, version.textValue(), pid.longValue(),
                startedAtMs.longValue(), System.currentTimeMillis()));
        return ResponseEntity.ok(new Accepted(SCHEMA, sessionId, true));
    }

    @GetMapping(path = "/api/v1/sessions/{sessionId}/agent", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> agent(@PathVariable("sessionId") String sessionId) {
        if (sessionId == null || !SESSION_ID.matcher(sessionId).matches()) {
            return notFound();
        }
        AgentHello hello = helloStore.find(sessionId);
        if (hello == null) {
            return notFound();
        }
        return ResponseEntity.ok(new AgentStatus(hello.sessionId(), true, hello.version(),
                hello.pid(), hello.startedAtMs(), hello.lastSeenMs()));
    }

    private static ResponseEntity<Object> badRequest(String message) {
        return ResponseEntity.badRequest().body(ApiError.of("bad_request", message));
    }

    private static ResponseEntity<Object> notFound() {
        return ResponseEntity.status(404).body(ApiError.of("not_found", "no handshake for session"));
    }

    static boolean isJson(String contentType) {
        if (contentType == null) {
            return false;
        }
        String base = contentType;
        int semi = base.indexOf(';');
        if (semi >= 0) {
            base = base.substring(0, semi);
        }
        return JSON_CONTENT_TYPE.equalsIgnoreCase(base.trim());
    }

    /**
     * @return the body, or {@code null} when it exceeds {@code maxBytes} (stops reading there)
     */
    static byte[] readBounded(InputStream in, int maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(512);
        byte[] buffer = new byte[512];
        int read;
        while ((read = in.read(buffer)) != -1) {
            if (out.size() + read > maxBytes) {
                return null;
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    /** Exact success body, fixed field order (api.v1.md §10.2). */
    @JsonPropertyOrder({"schema", "sessionId", "accepted"})
    public record Accepted(String schema, String sessionId, boolean accepted) {
    }

    /** Exact agent status body, fixed field order (api.v1.md §10.3). */
    @JsonPropertyOrder({"sessionId", "connected", "version", "pid", "startedAtMs", "lastSeenMs"})
    public record AgentStatus(String sessionId, boolean connected, String version, long pid,
                              long startedAtMs, long lastSeenMs) {
    }
}
