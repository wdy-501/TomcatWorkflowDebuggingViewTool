package io.traceboard.launcher;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * {@code stop --session <s_xxx>} / {@code stop --pid-file <path>}: idempotent stop that refuses
 * to kill a recycled PID.
 *
 * <p>Refuses ({@code PID_MISMATCH}, exit 3) when the live process command line is empty, does not
 * contain the recorded jar (or jar file name/hint), lacks the launcher markers for the app, or the
 * process start time deviates more than 5s from the recorded {@code startedAtMs}. A reused
 * collector/UI is recorded but never stopped.</p>
 */
final class StopCommand {

    private static final long START_TOLERANCE_MS = 5000L;

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        boolean hasPidFile = args.has("--pid-file");
        boolean hasSession = args.has("--session");
        if (hasPidFile && hasSession) {
            throw LauncherException.usage("stop 的 --session 与 --pid-file 二选一（--help 查看用法）。");
        }
        if (hasSession) {
            return stopSession(SessionId.require(args.require("--session")));
        }
        if (!hasPidFile) {
            throw LauncherException.usage("stop 需要 --session <s_xxx> 或 --pid-file <path>（--help 查看用法）。");
        }
        return stopPidFile(Util.abs(args.require("--pid-file")));
    }

    // -------------------------------------------------------------------------
    // --pid-file (original behaviour)
    // -------------------------------------------------------------------------

    private int stopPidFile(Path pidFile) throws LauncherException {
        if (!Files.isRegularFile(pidFile)) {
            System.out.println("NOT_RUNNING pid_file=\"" + Util.fwd(pidFile) + "\"（未找到 PID 文件；无需停止）");
            return Launcher.EXIT_OK;
        }
        PidFile pid = PidFile.read(pidFile);
        stopApp(pidFile, pid);
        return Launcher.EXIT_OK;
    }

    private boolean stopApp(Path pidFile, PidFile pid) throws LauncherException {
        Optional<ProcessHandle> handleOpt = ProcessHandle.of(pid.pid);
        if (handleOpt.isEmpty() || !handleOpt.get().isAlive()) {
            PidFile.delete(pidFile);
            System.out.println("NOT_RUNNING pid=" + pid.pid + "（进程已不存在；已清理 PID 文件）");
            return false;
        }
        assertMatches("app", handleOpt.get(), pid.startedAtMs, pid.java, pid.jar, "", true);
        ChildProcesses.stop(handleOpt.get());
        if (handleOpt.get().isAlive()) {
            throw LauncherException.failed("STOP_FAILED", "无法停止进程 pid=" + pid.pid
                    + "（destroy → 5s → taskkill/forcible 后仍存活）；请手工检查: tasklist /FI \"PID eq "
                    + pid.pid + "\"。");
        }
        PidFile.delete(pidFile);
        System.out.println("STOPPED pid=" + pid.pid);
        return true;
    }

    // -------------------------------------------------------------------------
    // --session (app + services started by run)
    // -------------------------------------------------------------------------

    private int stopSession(String session) throws LauncherException {
        Path work = Util.abs("work");
        Path pidFile = work.resolve(session + ".pid");
        Path servicesFile = work.resolve(session + ".services.json");
        boolean hasPidFile = Files.isRegularFile(pidFile);
        boolean hasServices = Files.isRegularFile(servicesFile);
        if (!hasPidFile && !hasServices) {
            System.out.println("NOT_RUNNING session=\"" + session + "\"（未找到 work/" + session
                    + ".pid 或 services.json；无需停止）");
            return Launcher.EXIT_OK;
        }

        // Parse services before stopping the app: the run process deletes the record on exit.
        String servicesJson = readServices(servicesFile);
        ServiceRecord appFromServices = parseService(servicesJson, "app", "app");
        ServiceRecord collector = parseService(servicesJson, "collector", "collector");
        ServiceRecord ui = parseService(servicesJson, "ui", "ui");
        String uiKind = uiKind(servicesJson);

        boolean stoppedAny = false;
        if (hasPidFile) {
            PidFile pid = PidFile.read(pidFile);
            stoppedAny |= stopApp(pidFile, pid);
        } else if (appFromServices != null) {
            stoppedAny |= stopRecord(appFromServices, true);
        } else {
            System.out.println("NOT_RUNNING app（记录中没有应用进程）");
        }

        if (collector != null) {
            stoppedAny |= stopRecord(collector, false);
        } else if (servicesJson != null) {
            System.out.println("SKIP collector=reused（非本次 run 启动，不停止）");
        }

        if (ui != null) {
            if ("in-process".equals(uiKind)) {
                // The UI lives in the run/launcher process; after the app stops it should exit on
                // its own. Give it a grace period, then validate and stop the launcher if needed.
                Optional<ProcessHandle> handle = ProcessHandle.of(ui.pid);
                if (handle.isPresent() && handle.get().isAlive()
                        && handle.get().pid() != ProcessHandle.current().pid()) {
                    if (ChildProcesses.waitGone(handle.get(), 5)) {
                        System.out.println("STOPPED ui=" + ui.pid + "（随 launcher 退出）");
                        stoppedAny = true;
                    } else {
                        stoppedAny |= stopRecord(ui, false);
                    }
                }
            } else {
                stoppedAny |= stopRecord(ui, false);
            }
        } else if (servicesJson != null) {
            System.out.println("SKIP ui=" + (uiKind.isEmpty() ? "reused/none" : uiKind)
                    + "（非本次 run 启动，不停止）");
        }

        PidFile.delete(pidFile);
        try {
            Files.deleteIfExists(servicesFile);
        } catch (IOException ignored) {
            // best effort
        }
        System.out.println((stoppedAny ? "STOPPED" : "NOT_RUNNING") + " session=" + session);
        return Launcher.EXIT_OK;
    }

    private static String readServices(Path file) throws LauncherException {
        if (!Files.isRegularFile(file)) {
            return null;
        }
        try {
            return Files.readString(file, java.nio.charset.StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw LauncherException.failed("SERVICES_UNREADABLE", "无法读取服务记录 \"" + Util.fwd(file)
                    + "\"（" + e.getClass().getSimpleName() + "）；不停止任何进程。");
        }
    }

    private static String uiKind(String servicesJson) {
        if (servicesJson == null) {
            return "";
        }
        String ui = Util.Json.object(servicesJson, "ui");
        if (ui == null) {
            return "";
        }
        String kind = Util.Json.str(ui, "kind");
        return kind == null ? "" : kind;
    }

    private static ServiceRecord parseService(String servicesJson, String key, String name) {
        if (servicesJson == null) {
            return null;
        }
        String object = Util.Json.object(servicesJson, key);
        if (object == null) {
            return null;
        }
        Long pid = Util.Json.num(object, "pid");
        if (pid == null || pid <= 0) {
            return null;
        }
        Long started = Util.Json.num(object, "startedAtMs");
        String java = Util.Json.str(object, "java");
        String jar = Util.Json.str(object, "jar");
        String hint = Util.Json.str(object, "commandLineHint");
        return new ServiceRecord(name, pid, started == null ? 0L : started,
                java == null ? "" : java, jar == null ? "" : jar, hint == null ? "" : hint);
    }

    private record ServiceRecord(String name, long pid, long startedAtMs, String java, String jar,
                                 String hint) {
    }

    private boolean stopRecord(ServiceRecord record, boolean requireMarkers) throws LauncherException {
        Optional<ProcessHandle> handleOpt = ProcessHandle.of(record.pid());
        if (handleOpt.isEmpty() || !handleOpt.get().isAlive()) {
            System.out.println("NOT_RUNNING " + record.name() + "=" + record.pid() + "（进程已不存在）");
            return false;
        }
        assertMatches(record.name(), handleOpt.get(), record.startedAtMs(), record.java(), record.jar(),
                record.hint(), requireMarkers);
        ChildProcesses.stop(handleOpt.get());
        if (handleOpt.get().isAlive()) {
            throw LauncherException.failed("STOP_FAILED", "无法停止 " + record.name() + " pid=" + record.pid()
                    + "（destroy → 5s → taskkill/forcible 后仍存活）；请手工检查: tasklist /FI \"PID eq "
                    + record.pid() + "\"。");
        }
        System.out.println("STOPPED " + record.name() + "=" + record.pid());
        return true;
    }

    // -------------------------------------------------------------------------
    // PID / start-time validation (shared)
    // -------------------------------------------------------------------------

    private static void assertMatches(String label, ProcessHandle handle, long startedAtMs, String javaExe,
                                      String jar, String hint, boolean requireMarkers) throws LauncherException {
        ProcessHandle.Info info = handle.info();

        boolean timeMatch = true;
        if (startedAtMs > 0) {
            Optional<Instant> actualStart = info.startInstant();
            if (actualStart.isPresent()
                    && Math.abs(actualStart.get().toEpochMilli() - startedAtMs) > START_TOLERANCE_MS) {
                timeMatch = false;
            }
        }

        String observed = readCommandLine(handle);
        if (observed == null) {
            // ProcessHandle.commandLine() is often unavailable on Windows for processes started by
            // another JVM; fall back to command path + start time so a recycled PID is still refused.
            Optional<String> command = info.command();
            boolean javaMatch = javaExe.isEmpty() || (command.isPresent()
                    && Util.normalize(command.get()).equalsIgnoreCase(Util.normalize(javaExe)));
            if (!javaMatch || !timeMatch) {
                throw mismatch(label, handle.pid(), "(commandLine 不可读；command=" + command.orElse("?")
                        + (timeMatch ? "" : " | startInstant 偏差>5s") + ")");
            }
            System.out.println("WARN commandLine 不可读，已用 command+startInstant 校验 " + label
                    + " pid=" + handle.pid() + "（Windows 限制）。");
            return;
        }

        String normalized = Util.normalize(observed).toLowerCase(java.util.Locale.ROOT);
        String recorded = Util.normalize(jar.isEmpty() ? hint : jar).toLowerCase(java.util.Locale.ROOT);
        String basename = recorded.isEmpty() ? "" : recorded.substring(recorded.lastIndexOf('/') + 1);
        boolean jarMatch = !recorded.isEmpty()
                && (normalized.contains(recorded) || (!basename.isEmpty() && normalized.contains(basename)));
        boolean launcherMarker = !requireMarkers
                || observed.contains("-Dtraceboard.") || observed.contains("-javaagent:");
        if (!jarMatch || !launcherMarker || !timeMatch) {
            throw mismatch(label, handle.pid(), Util.oneLine(observed, 200)
                    + (timeMatch ? "" : " | startInstant 偏差>5s"));
        }
    }

    private static LauncherException mismatch(String label, long pid, String evidence) {
        return LauncherException.failed("PID_MISMATCH", label + " PID " + pid
                + " 与记录的 jar/启动时间不匹配，拒绝停止（避免误杀）: " + evidence
                + "；确认 PID 文件是否过期，或用任务管理器/stop 前重新启动 launcher 记录。");
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
            String text = new String(output, Charset.defaultCharset()).trim();
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
}