package io.traceboard.collector.ingest;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.ValidationMessage;

import io.traceboard.collector.schema.EventSchemaValidator;
import io.traceboard.collector.store.EventStore;
import io.traceboard.collector.store.SessionLog;

/**
 * Ingest pipeline for {@code POST /ingest/v1/events} (transport.v1.md §4.5).
 *
 * <p>Fixed decision order: 415 (controller) -> 413 -> 400 -> per-line. A bad line never turns the
 * whole batch into 400; envelope violations never reach storage.</p>
 */
@Service
public class IngestService {

    public static final int MAX_BODY_BYTES = 4 * 1024 * 1024;
    public static final int MAX_LINE_BYTES = 64 * 1024;
    public static final int MAX_LINES = 1000;
    private static final int MAX_MESSAGE_CHARS = 200;

    private final ObjectMapper strictMapper;
    private final EventSchemaValidator schemaValidator;
    private final EventStore store;

    public IngestService(ObjectMapper objectMapper, EventSchemaValidator schemaValidator, EventStore store) {
        this.strictMapper = objectMapper.copy()
                .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
        this.schemaValidator = schemaValidator;
        this.store = store;
    }

    /**
     * Process one already size-checked NDJSON body.
     *
     * @throws IngestException envelope-level rejection (400 or 413)
     */
    public IngestResult ingest(byte[] body) {
        if (body.length == 0) {
            throw IngestException.badRequest("request body is empty");
        }

        // 413 before 400: body size is checked by the controller, single-line size here.
        int lineCount = 0;
        int segmentStart = 0;
        for (int i = 0; i < body.length; i++) {
            if (body[i] == '\n') {
                if (i - segmentStart > MAX_LINE_BYTES) {
                    throw IngestException.tooLarge("a single NDJSON line exceeds 64KB");
                }
                lineCount++;
                segmentStart = i + 1;
            }
        }
        if (body.length - segmentStart > MAX_LINE_BYTES) {
            throw IngestException.tooLarge("a single NDJSON line exceeds 64KB");
        }

        // 400: envelope shape.
        if (lineCount == 0 || body[body.length - 1] != '\n') {
            throw IngestException.badRequest("the last NDJSON line must end with a newline");
        }
        if (lineCount > MAX_LINES) {
            throw IngestException.badRequest("a batch may contain at most " + MAX_LINES + " lines");
        }
        for (byte b : body) {
            if (b == '\r') {
                throw IngestException.badRequest("CR characters are not allowed; use LF line endings");
            }
        }

        String[] lines = new String[lineCount];
        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        segmentStart = 0;
        int index = 0;
        for (int i = 0; i < body.length; i++) {
            if (body[i] == '\n') {
                int length = i - segmentStart;
                String decoded;
                try {
                    decoded = decoder.decode(ByteBuffer.wrap(body, segmentStart, length)).toString();
                } catch (CharacterCodingException e) {
                    throw IngestException.badRequest("request body is not valid UTF-8");
                }
                if (decoded.trim().isEmpty()) {
                    throw IngestException.badRequest("blank lines are not allowed (line " + (index + 1) + ")");
                }
                if (decoded.trim().startsWith("#")) {
                    throw IngestException.badRequest("comment lines are not allowed (line " + (index + 1) + ")");
                }
                lines[index++] = decoded;
                segmentStart = i + 1;
            }
        }

        // Per-line: parse + frozen-schema validation + idempotent append.
        int accepted = 0;
        int rejected = 0;
        int dropped = 0;
        List<IngestResult.LineError> errors = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            int lineNo = i + 1;
            String line = lines[i];
            JsonNode event;
            try {
                event = strictMapper.readTree(line);
            } catch (JsonProcessingException | RuntimeException e) {
                errors.add(new IngestResult.LineError(lineNo, "invalid_json",
                        "line is not a single valid JSON object"));
                rejected++;
                continue;
            }
            if (event == null || !event.isObject()) {
                errors.add(new IngestResult.LineError(lineNo, "invalid_json",
                        "line is not a single valid JSON object"));
                rejected++;
                continue;
            }
            Set<ValidationMessage> violations = schemaValidator.validate(event);
            if (!violations.isEmpty()) {
                errors.add(new IngestResult.LineError(lineNo, "schema_violation",
                        schemaViolationMessage(violations)));
                rejected++;
                continue;
            }

            String sessionId = event.get("sessionId").asText();
            String traceId = event.get("traceId").asText();
            String spanId = event.get("spanId").asText();
            SessionLog log = store.find(sessionId);
            if (log == null) {
                log = store.getOrCreate(sessionId);
            }
            int seq = log.append(traceId, spanId, line);
            if (seq < 0) {
                dropped++;
            } else {
                accepted++;
            }
        }
        return new IngestResult(accepted, rejected, dropped, errors);
    }

    private static String schemaViolationMessage(Set<ValidationMessage> violations) {
        String location = "";
        try {
            location = String.valueOf(violations.iterator().next().getPath());
        } catch (RuntimeException ignored) {
            // message text is advisory only; never echo payload content
        }
        String message = "event does not match the frozen traceboard.event.v1 schema";
        if (!location.isEmpty() && !"null".equals(location)) {
            message = message + " at " + location;
        }
        return truncate(message);
    }

    private static String truncate(String value) {
        return value.length() <= MAX_MESSAGE_CHARS ? value : value.substring(0, MAX_MESSAGE_CHARS);
    }
}
