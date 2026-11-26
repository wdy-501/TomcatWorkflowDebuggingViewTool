package io.traceboard.launcher;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

/**
 * Session id rules shared by {@code run} / {@code stop --session}.
 *
 * <p>{@code run} derives {@code s_run_<yyMMddHHmmss>} when {@code --session} is absent or
 * {@code auto}; an explicit id must match {@code ^s_[A-Za-z0-9_-]+$} (same rule as the agent
 * and collector).</p>
 */
final class SessionId {

    static final Pattern PATTERN = Pattern.compile("^s_[A-Za-z0-9_-]+$");

    private static final DateTimeFormatter RUN_STAMP = DateTimeFormatter.ofPattern("yyMMddHHmmss");

    private SessionId() {
    }

    /** {@code s_run_<yyMMddHHmmss>} — deterministic, local-time based and contract-compliant. */
    static String deriveRunSession() {
        return "s_run_" + RUN_STAMP.format(LocalDateTime.now());
    }

    /**
     * Resolves an optional {@code --session}: absent/blank/{@code auto} derives a run session,
     * anything else must be a valid explicit id.
     */
    static String resolve(String raw) throws LauncherException {
        if (raw == null || raw.isBlank() || raw.trim().equalsIgnoreCase("auto")) {
            return deriveRunSession();
        }
        return require(raw);
    }

    static String require(String raw) throws LauncherException {
        String value = raw == null ? "" : raw.trim();
        if (!PATTERN.matcher(value).matches()) {
            throw LauncherException.usage("--session 必须匹配 ^s_[A-Za-z0-9_-]+$（例如 s_run_251125213000），收到 \""
                    + value + "\"。run 可省略 --session 或使用 --session auto 自动生成。");
        }
        return value;
    }
}