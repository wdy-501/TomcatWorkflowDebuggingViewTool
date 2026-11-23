package io.traceboard.collector.ingest;

/**
 * Envelope-level ingest rejection (whole batch refused).
 *
 * <p>Status is limited to 413 ({@code payload_too_large}) and 400 ({@code bad_request}); the
 * 415 case is decided by the controller before the body is read.</p>
 */
public final class IngestException extends RuntimeException {

    private final int status;
    private final String code;

    public IngestException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int status() {
        return status;
    }

    public String code() {
        return code;
    }

    public static IngestException badRequest(String message) {
        return new IngestException(400, "bad_request", message);
    }

    public static IngestException tooLarge(String message) {
        return new IngestException(413, "payload_too_large", message);
    }
}
