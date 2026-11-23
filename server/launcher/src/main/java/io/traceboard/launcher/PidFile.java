package io.traceboard.launcher;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PID file (JSON): {@code {"pid":N,"startedAtMs":E,"java":"...","jar":"..."}}.
 * Paths are stored with forward slashes; {@code stop} refuses to kill when the live process
 * command line does not match the recorded jar / start time ({@code PID_MISMATCH}).
 */
final class PidFile {

    private static final Pattern PID = Pattern.compile("\"pid\"\\s*:\\s*(\\d+)");
    private static final Pattern STARTED = Pattern.compile("\"startedAtMs\"\\s*:\\s*(-?\\d+)");
    private static final Pattern JAR = Pattern.compile("\"jar\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern JAVA = Pattern.compile("\"java\"\\s*:\\s*\"([^\"]*)\"");

    final long pid;
    final long startedAtMs;
    final String java;
    final String jar;
    final Path file;

    private PidFile(Path file, long pid, long startedAtMs, String java, String jar) {
        this.file = file;
        this.pid = pid;
        this.startedAtMs = startedAtMs;
        this.java = java;
        this.jar = jar;
    }

    static void write(Path file, long pid, long startedAtMs, Path java, Path jar) throws IOException {
        Path parent = file.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        String json = "{\"pid\":" + pid
                + ",\"startedAtMs\":" + startedAtMs
                + ",\"java\":\"" + Util.fwd(java) + "\""
                + ",\"jar\":\"" + Util.fwd(jar) + "\"}";
        Files.writeString(file, json + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    static PidFile read(Path file) throws LauncherException {
        String text;
        try {
            text = Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw LauncherException.failed("PID_MISMATCH", "无法读取 PID 文件 \"" + Util.fwd(file)
                    + "\"（" + e.getClass().getSimpleName() + "）；不停止任何进程。确认文件是 launcher jar 生成的 JSON。");
        }
        Matcher pidMatcher = PID.matcher(text);
        Matcher jarMatcher = JAR.matcher(text);
        if (!pidMatcher.find() || !jarMatcher.find()) {
            throw LauncherException.failed("PID_MISMATCH", "PID 文件不是 launcher 生成的 JSON（缺少 pid/jar）: \"" + Util.fwd(file)
                    + "\"；不停止任何进程。");
        }
        long pid = Long.parseLong(pidMatcher.group(1));
        long started = 0L;
        Matcher startedMatcher = STARTED.matcher(text);
        if (startedMatcher.find()) {
            try {
                started = Long.parseLong(startedMatcher.group(1));
            } catch (NumberFormatException ignored) {
                started = 0L;
            }
        }
        String java = "";
        Matcher javaMatcher = JAVA.matcher(text);
        if (javaMatcher.find()) {
            java = javaMatcher.group(1);
        }
        return new PidFile(file, pid, started, java, jarMatcher.group(1));
    }

    static void delete(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
            // best effort only
        }
    }
}
