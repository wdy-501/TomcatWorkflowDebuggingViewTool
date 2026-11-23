package io.traceboard.collector.ingest;

import java.util.List;

/**
 * 202 body: {@code {"accepted":N,"rejected":M,"dropped":K,"errors":[...]}}.
 * Invariant: {@code accepted + rejected + dropped == number of lines}.
 */
public record IngestResult(int accepted, int rejected, int dropped, List<LineError> errors) {

    /**
     * One rejected line. {@code line} is 1-based; {@code message} never echoes payload content.
     */
    public record LineError(int line, String code, String message) {
    }
}
