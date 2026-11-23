package io.traceboard.launcher;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * {@code stop --pid-file}: idempotent stop that refuses to kill a recycled PID.
 * Refuses ({@code PID_MISMATCH}, exit 3) when the live process command line is empty, does not
 * contain the recorded jar (or jar file name), lacks the launcher markers, or the process start
 * time deviates more than 5s from the recorded {@code startedAtMs}.
 */
final class StopCommand {

    private static final long START_TOLERANCE_MS = 5000L;

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        Path pidFile = Util.abs(args.require("--pid-file"));

        if (!Files.isRegularFile(pidFile)) {
            System.out.println("NOT_RUNNING pid_file=\"" + Util.fwd(pidFile) + "\"（未找到 PID 文件；无需停止）");
            return Launcher.EXIT_OK;
        }
        PidFile pid = PidFile.read(pidFile);
        Optional<ProcessHandle> handleOpt = ProcessHandle.of(pid.pid);
        if (handleOpt.isEmpty() || !handleOpt.get().isAlive()) {
            PidFile.delete(pidFile);
            System.out.println("NOT_RUNNING pid=" + pid.pid + "（进程已不存在；已清理 PID 文件）");
            return Launcher.EXIT_OK;
        }
        ProcessHandle handle = handleOpt.get();
        ProcessHandle.Info info = handle.info();

        boolean timeMatch = true;
        if (pid.startedAtMs > 0) {
            Optional<Instant> actualStart = info.startInstant();
            if (actualStart.isPresent()
                    && Math.abs(actualStart.get().toEpochMilli() - pid.startedAtMs) > START_TOLERANCE_MS) {
                timeMatch = false;
            }
        }

        String observed = readCommandLine(handle);
        boolean commandOnly = false;
        if (observed == null) {
            // ProcessHandle.commandLine() is often unavailable on Windows for processes started by
            // another JVM; fall back to command path + start time so a recycled PID is still refused.
            Optional<String> command = info.command();
            boolean javaMatch = command.isPresent()
                    && Util.normalize(command.get()).equalsIgnoreCase(Util.normalize(pid.java));
            if (!javaMatch || !timeMatch) {
                throw mismatch(pid, "(commandLine 不可读；command=" + command.orElse("?")
                        + (timeMatch ? "" : " | startInstant 偏差>5s") + ")");
            }
            commandOnly = true;
            observed = command.get();
        } else {
            String normalized = Util.normalize(observed).toLowerCase(Locale.ROOT);
            String jarRecorded = Util.normalize(pid.jar).toLowerCase(Locale.ROOT);
            String jarName = jarRecorded.isEmpty() ? "" : jarRecorded.substring(jarRecorded.lastIndexOf('/') + 1);
            boolean jarMatch = !jarRecorded.isEmpty()
                    && (normalized.contains(jarRecorded) || (!jarName.isEmpty() && normalized.contains(jarName)));
            boolean launcherMarker = observed.contains("-Dtraceboard.") || observed.contains("-javaagent:");
            if (!jarMatch || !launcherMarker || !timeMatch) {
                throw mismatch(pid, Util.oneLine(observed, 200) + (timeMatch ? "" : " | startInstant 偏差>5s"));
            }
        }
        if (commandOnly) {
            System.out.println("WARN commandLine 不可读，已用 command+startInstant 校验 pid=" + pid.pid + "（Windows 限制）。");
        }

        handle.destroy();
        if (!waitGone(handle, 5)) {
            if (Util.isWindows()) {
                taskkill(pid.pid);
            }
            if (!waitGone(handle, 5)) {
                handle.destroyForcibly();
            }
            waitGone(handle, 3);
        }
        if (handle.isAlive()) {
            throw LauncherException.failed("STOP_FAILED", "无法停止进程 pid=" + pid.pid + "（destroy → 5s → taskkill/forcible 后仍存活）；"
                    + "请手工检查: tasklist /FI \"PID eq " + pid.pid + "\"。");
        }
        PidFile.delete(pidFile);
        System.out.println("STOPPED pid=" + pid.pid);
        return Launcher.EXIT_OK;
    }

    private static LauncherException mismatch(PidFile pid, String evidence) {
        return LauncherException.failed("PID_MISMATCH", "PID " + pid.pid + " 与记录的 jar/启动时间不匹配，拒绝停止（避免误杀）: "
                + evidence + "；确认 PID 文件是否过期，或用任务管理器/stop 前重新启动 launcher 记录。");
    }

    /** Reads the live command line: ProcessHandle first, PowerShell CIM fallback on Windows. */
    private static String readCommandLine(ProcessHandle handle) {
        Optional<String> commandLine = handle.info().commandLine();
        if (commandLine.isPresent() && !commandLine.get().isBlank()) {
            return commandLine.get();
        }
        if (!Util.isWindows()) {
            return null;
        }
        String script = "(Get-CimInstance Win32_Process -Filter 'ProcessId=" + handle.pid() + "').CommandLine";
        try {
            Process query = new ProcessBuilder("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
                    .redirectErrorStream(true)
                    .start();
            byte[] output;
            try (var stream = query.getInputStream()) {
                output = stream.readAllBytes();
            }
            if (!query.waitFor(10, TimeUnit.SECONDS)) {
                query.destroyForcibly();
                return null;
            }
            String text = new String(output, java.nio.charset.Charset.defaultCharset()).trim();
            for (String line : text.split("\\R")) {
                if (!line.isBlank() && !line.startsWith("At line:") && !line.startsWith("+")) {
                    return line;
                }
            }
            return null;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return null;
        }
    }

    private static boolean waitGone(ProcessHandle handle, int seconds) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
        while (System.nanoTime() < deadline) {
            if (!handle.isAlive()) {
                return true;
            }
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return !handle.isAlive();
            }
        }
        return !handle.isAlive();
    }

    /** Kills the whole process tree on Windows (taskkill /PID n /T /F), best effort. */
    private static void taskkill(long pid) {
        List<String> cmd = new ArrayList<>(List.of("taskkill", "/PID", Long.toString(pid), "/T", "/F"));
        try {
            Process taskkill = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            taskkill.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
            taskkill.waitFor(5, TimeUnit.SECONDS);
        } catch (IOException | InterruptedException ignored) {
            if (ignored instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
