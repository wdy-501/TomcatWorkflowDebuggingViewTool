package io.traceboard.launcher;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Spawns and stops the services owned by {@code TraceBoard run}.
 *
 * <p>Only processes started by the current run are ever stopped; shutdown hooks therefore keep
 * the rule "kill only children this run started". Logs always land under {@code work/logs}.</p>
 */
final class ChildProcesses {

    private ChildProcesses() {
    }

    /** A spawned child plus the facts recorded in {@code work/<session>.services.json}. */
    record Child(String name, Process process, long startedAtMs, Path java, Path jar, Path log) {

        long pid() {
            return process.pid();
        }

        boolean alive() {
            return process.isAlive();
        }
    }

    static Child start(String name, List<String> command, Path javaExe, Path jar, Path log)
            throws LauncherException {
        if (log.getParent() != null) {
            try {
                Files.createDirectories(log.getParent());
            } catch (IOException e) {
                throw LauncherException.failed(name.toUpperCase(java.util.Locale.ROOT) + "_SPAWN_FAILED",
                        "无法创建日志目录 \"" + Util.fwd(log.getParent()) + "\"（" + e.getClass().getSimpleName() + "）。");
            }
        }
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.redirectErrorStream(true);
        builder.redirectOutput(ProcessBuilder.Redirect.appendTo(log.toFile()));
        Process process;
        try {
            process = builder.start();
        } catch (IOException e) {
            throw LauncherException.failed(name.toUpperCase(java.util.Locale.ROOT) + "_SPAWN_FAILED",
                    "无法启动 " + name + " 进程（" + e.getClass().getSimpleName() + "）: \""
                            + String.join(" ", command) + "\"；检查 java/jar 路径与权限。");
        }
        long startedAtMs = process.toHandle().info().startInstant().map(Instant::toEpochMilli)
                .orElse(System.currentTimeMillis());
        return new Child(name, process, startedAtMs, javaExe, jar, log);
    }

    /** destroy → 5s → taskkill /T /F on Windows → forcible; best effort and idempotent. */
    static void stop(Process process) {
        if (process == null) {
            return;
        }
        stop(process.toHandle());
    }

    static void stop(ProcessHandle handle) {
        if (handle == null || !handle.isAlive()) {
            return;
        }
        handle.destroy();
        if (!waitGone(handle, 5)) {
            if (Util.isWindows()) {
                taskkill(handle.pid());
            }
            if (!waitGone(handle, 5)) {
                handle.destroyForcibly();
            }
            waitGone(handle, 3);
        }
    }

    static boolean waitGone(ProcessHandle handle, int seconds) {
        if (handle == null) {
            return true;
        }
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
    static void taskkill(long pid) {
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