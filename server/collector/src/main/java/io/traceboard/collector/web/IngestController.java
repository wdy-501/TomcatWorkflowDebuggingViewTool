package io.traceboard.collector.web;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import io.traceboard.collector.ingest.IngestException;
import io.traceboard.collector.ingest.IngestResult;
import io.traceboard.collector.ingest.IngestService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * {@code POST /ingest/v1/events} (api.v1.md §7.1, transport.v1.md §4.5).
 *
 * <p>The Content-Type and body-size gates live here (415 -> 413); everything else is
 * {@link IngestService}. No CORS, no auth, no 429, no persistence.</p>
 */
@RestController
public class IngestController {

    private static final String NDJSON = "application/x-ndjson";

    private final IngestService ingestService;

    public IngestController(IngestService ingestService) {
        this.ingestService = ingestService;
    }

    @PostMapping(path = "/ingest/v1/events", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> ingest(HttpServletRequest request) {
        if (!isNdjson(request.getContentType())) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ApiError.of("unsupported_media_type",
                            "Content-Type must be application/x-ndjson"));
        }
        if (request.getContentLengthLong() > IngestService.MAX_BODY_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ApiError.of("payload_too_large", "request body exceeds 4MB"));
        }

        byte[] body;
        try {
            body = readBounded(request.getInputStream());
        } catch (IOException e) {
            return ResponseEntity.badRequest()
                    .body(ApiError.of("bad_request", "request body could not be read"));
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ApiError.of("payload_too_large", "request body exceeds 4MB"));
        }

        try {
            IngestResult result = ingestService.ingest(body);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(result);
        } catch (IngestException e) {
            return ResponseEntity.status(e.status())
                    .body(ApiError.of(e.code(), e.getMessage()));
        }
    }

    static boolean isNdjson(String contentType) {
        if (contentType == null) {
            return false;
        }
        String base = contentType;
        int semi = base.indexOf(';');
        if (semi >= 0) {
            base = base.substring(0, semi);
        }
        return NDJSON.equalsIgnoreCase(base.trim());
    }

    /**
     * @return the body, or {@code null} when it exceeds the 4MB budget
     */
    static byte[] readBounded(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(8192);
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            if (out.size() + read > IngestService.MAX_BODY_BYTES) {
                return null;
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }
}
