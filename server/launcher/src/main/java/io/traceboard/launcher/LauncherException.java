package io.traceboard.launcher;

/**
 * Expected launcher failure with an exit code and an optional ASCII assertion token.
 *
 * <p>Tokens are always ASCII and are followed by an actionable (Chinese) suggestion, e.g.
 * {@code JAR_NOT_FOUND: ...}. Usage errors carry {@code exitCode = 2}, expected runtime failures
 * carry {@code 3} and unexpected launcher errors carry {@code 1} ({@code LAUNCHER_ERROR}).</p>
 */
final class LauncherException extends Exception {

    final int exitCode;
    final String token;

    private LauncherException(int exitCode, String token, String detail) {
        super(detail);
        this.exitCode = exitCode;
        this.token = token;
    }

    static LauncherException usage(String detail) {
        return new LauncherException(Launcher.EXIT_USAGE, null, detail);
    }

    static LauncherException usage(String token, String detail) {
        return new LauncherException(Launcher.EXIT_USAGE, token, detail);
    }

    static LauncherException failed(String token, String detail) {
        return new LauncherException(Launcher.EXIT_FAILED, token, detail);
    }

    static LauncherException launcherError(String detail) {
        return new LauncherException(Launcher.EXIT_LAUNCHER_ERROR, "LAUNCHER_ERROR", detail);
    }

    String render() {
        if (token == null) {
            return "USAGE: " + getMessage();
        }
        return token + ": " + getMessage();
    }
}
