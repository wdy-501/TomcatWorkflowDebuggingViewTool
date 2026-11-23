package io.traceboard.launcher;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * {@code jar}: spawn the demo application with the javaagent on the requested JDK, stream logs to
 * {@code work/logs}, wait for readiness (health 2xx or TCP accept, 30s), write the PID file, then
 * either follow the process (default) or detach.
 */
final class JarCommand {

    private static final Duration READY_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration POLL = Duration.ofMillis(250);

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        String session = Args.session(args);
        String collector = Urls.collectorOrigin(args.get("--collector"));
        Path jar = requireFile(args.require("--jar"), "JAR_NOT_FOUND",
                "demo jar 不存在；先构建 demo 后端: JAVA_HOME=\"$JAVA8\" mvn -B -q -DskipTests package -f \"demo/buggy-shop-boot-vue/backend/pom.xml\"。");
        Path agent = requireFile(args.require("--agent"), "AGENT_NOT_FOUND",
                "agent jar 不存在；先构建: JAVA_HOME=\"$JAVA21\" mvn -B -q -DskipTests package -pl \"agent\" -am。");
        Path javaExe = resolveJava(args.get("--java"));

        boolean portExplicit = args.has("--port");
        int port = args.port("--port", 8080);
        String healthRaw = args.get("--health");
        String healthUrl = null;
        if (healthRaw != null) {
            healthUrl = Urls.loopbackHttpUrl(healthRaw, "--health").toString();
        }
        boolean detach = args.flag("--detach");
        Path pidFile = Util.abs(args.get("--pid-file") == null ? "work/" + session + ".pid" : args.get("--pid-file"));
        Path logDir = Util.abs(args.get("--log-dir") == null ? "work/logs" : args.get("--log-dir"));

        if (portExplicit && !portFree(port)) {
            throw LauncherException.failed("PORT_IN_USE", "端口 " + port + " 已被占用；先停止旧进程或显式换测试端口"
                    + "（netstat -ano | findstr :" + port + " 查 PID；不静默改端口）。");
        }
        try {
            Files.createDirectories(logDir);
        } catch (IOException e) {
            throw LauncherException.failed("LAUNCHER_ERROR", "无法创建日志目录 \"" + Util.fwd(logDir) + "\"（"
                    + e.getClass().getSimpleName() + "）；检查路径权限或 --log-dir。");
        }
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS").format(java.time.LocalDateTime.now());
        Path outLog = logDir.resolve(session + "-" + stamp + ".out.log");
        Path errLog = logDir.resolve(session + "-" + stamp + ".err.log");

        List<String> command = new ArrayList<>();
        command.add(javaExe.toString());
        command.add("-javaagent:" + Util.fwd(agent));
        command.add("-Dtraceboard.ingestUrl=" + collector + "/ingest/v1/events");
        command.add("-Dtraceboard.sessionId=" + session);
        if (portExplicit) {
            command.add("-Dserver.port=" + port);
        }
        command.add("-jar");
        command.add(jar.toString());

        System.out.println("启动: " + String.join(" ", quoteEach(command)));
        System.out.println("日志: \"" + Util.fwd(outLog) + "\" / \"" + Util.fwd(errLog) + "\"");

        Process process;
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.redirectOutput(ProcessBuilder.Redirect.appendTo(outLog.toFile()));
            builder.redirectError(ProcessBuilder.Redirect.appendTo(errLog.toFile()));
            process = builder.start();
        } catch (IOException e) {
            throw LauncherException.failed("APP_EXITED", "无法启动进程（" + e.getClass().getSimpleName() + "）: \""
                    + Util.fwd(javaExe) + "\"；检查 --java 是否指向 JDK8 java 可执行文件、jar 是否可读。");
        }

        long pid = process.pid();
        long startedAtMs = process.toHandle().info().startInstant().map(Instant::toEpochMilli)
                .orElse(System.currentTimeMillis());
        try {
            PidFile.write(pidFile, pid, startedAtMs, javaExe, jar);
        } catch (IOException e) {
            process.destroyForcibly();
            throw LauncherException.failed("LAUNCHER_ERROR", "无法写 PID 文件 \"" + Util.fwd(pidFile) + "\"（"
                    + e.getClass().getSimpleName() + "）；检查目录权限或 --pid-file。");
        }

        ReadyResult ready = awaitReady(process, port, healthUrl);
        if (ready != ReadyResult.READY) {
            if (ready == ReadyResult.EXITED) {
                PidFile.delete(pidFile);
                System.err.println("APP_EXITED: 应用在就绪前退出（pid=" + pid + "）；日志尾 20 行:");
                Util.printTail(System.err, lastLines(errLog, outLog));
                System.err.println("建议: 先看 \"work/logs/*.err.log\"；常见原因 = jar 损坏/端口占用/JDK 版本不对"
                        + "（demo 需要 JDK8: --java \"$JAVA8/bin/java\"）/H2 初始化失败。");
            } else {
                System.err.println("HEALTH_TIMEOUT: " + (ready == ReadyResult.HEALTH_TIMEOUT
                        ? "健康检查在 " + READY_TIMEOUT.toSeconds() + "s 内未通过: \"" + healthUrl + "\""
                        : "TCP 连接 127.0.0.1:" + port + " 在 " + READY_TIMEOUT.toSeconds() + "s 内未就绪"));
                System.err.println("进程仍在运行（pid=" + pid + "，PID_FILE=\"" + Util.fwd(pidFile) + "\"）；日志尾 20 行:");
                Util.printTail(System.err, lastLines(errLog, outLog));
                System.err.println("建议: demo 用 --health \"http://127.0.0.1:8080/api/orders\" 或省略 --health（按 TCP）；"
                        + "启动完成后可 stop --pid-file \"" + Util.fwd(pidFile) + "\"；不静默改端口。");
            }
            return Launcher.EXIT_FAILED;
        }

        String url = "http://127.0.0.1:" + port + "/";
        System.out.println("READY pid=" + pid + " url=" + url
                + (healthUrl == null ? " probe=tcp" : " health=" + healthUrl));

        if (detach) {
            System.out.println("PID=" + pid);
            System.out.println("PID_FILE=" + Util.fwd(pidFile));
            System.out.println("LOG_DIR=" + Util.fwd(logDir));
            System.out.println("URL=" + url);
            System.out.println("提示: stop --pid-file \"" + Util.fwd(pidFile) + "\" 可停止；日志在 \"" + Util.fwd(logDir) + "\"。");
            System.out.flush();
            return Launcher.EXIT_OK;
        }

        Util.Tail outTail = new Util.Tail(outLog, System.out);
        Util.Tail errTail = new Util.Tail(errLog, System.err);
        outTail.start();
        errTail.start();
        Thread hook = new Thread(() -> {
            if (process.isAlive()) {
                process.destroy();
                try {
                    process.waitFor(3, java.util.concurrent.TimeUnit.SECONDS);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                if (process.isAlive()) {
                    process.destroyForcibly();
                }
            }
        }, "traceboard-launcher-shutdown");
        Runtime.getRuntime().addShutdownHook(hook);
        int exit;
        try {
            exit = process.waitFor();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroy();
            exit = Launcher.EXIT_FAILED;
        }
        outTail.stop();
        errTail.stop();
        PidFile.delete(pidFile);
        try {
            Runtime.getRuntime().removeShutdownHook(hook);
        } catch (IllegalStateException ignored) {
            // already in shutdown
        }
        System.out.println("APP_STOPPED pid=" + pid + " exit=" + exit);
        return exit;
    }

    private enum ReadyResult { READY, EXITED, HEALTH_TIMEOUT, TCP_TIMEOUT }

    private ReadyResult awaitReady(Process process, int port, String healthUrl) {
        long deadline = System.nanoTime() + READY_TIMEOUT.toNanos();
        boolean health = healthUrl != null;
        java.net.http.HttpClient client = Http.client(Duration.ofSeconds(1));
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) {
                return ReadyResult.EXITED;
            }
            boolean up = health
                    ? Http.is2xx(client, healthUrl, Duration.ofSeconds(2))
                    : tcpOpen(port);
            if (up && process.isAlive()) {
                return ReadyResult.READY;
            }
            try {
                Thread.sleep(POLL.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return health ? ReadyResult.HEALTH_TIMEOUT : ReadyResult.TCP_TIMEOUT;
            }
        }
        if (!process.isAlive()) {
            return ReadyResult.EXITED;
        }
        return health ? ReadyResult.HEALTH_TIMEOUT : ReadyResult.TCP_TIMEOUT;
    }

    private static boolean tcpOpen(int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", port), 300);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    private static boolean portFree(int port) {
        if (tcpOpen(port)) {
            return false;
        }
        try (java.net.ServerSocket socket = new java.net.ServerSocket()) {
            socket.setReuseAddress(false);
            socket.bind(new InetSocketAddress("127.0.0.1", port), 1);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    private static List<String> lastLines(Path errLog, Path outLog) {
        List<String> lines = Util.tailLines(errLog, 20);
        if (lines.isEmpty()) {
            lines = Util.tailLines(outLog, 20);
        }
        return lines;
    }

    private static List<String> quoteEach(List<String> parts) {
        List<String> quoted = new ArrayList<>(parts.size());
        for (String part : parts) {
            quoted.add(part.contains(" ") || part.contains("\\") ? "\"" + part + "\"" : part);
        }
        return quoted;
    }

    static Path resolveJava(String explicit) throws LauncherException {
        if (explicit != null) {
            Path path = Util.abs(explicit);
            Path exe = executable(path);
            if (exe == null) {
                throw LauncherException.failed("JAVA_NOT_FOUND", "--java 指向的 java 不存在: \"" + Util.fwd(path)
                        + "\"；demo/agent 必须用 JDK8 显式指定，例如 --java \"C:/Program Files/Java/jdk1.8.0_221/bin/java\"。");
            }
            return exe;
        }
        String javaHome = System.getenv("JAVA_HOME");
        if (javaHome != null && !javaHome.isBlank()) {
            Path candidate = executable(Util.abs(javaHome).resolve("bin").resolve(Util.isWindows() ? "java.exe" : "java"));
            if (candidate != null) {
                return candidate;
            }
        }
        String pathEnv = System.getenv("PATH");
        if (pathEnv != null) {
            for (String dir : pathEnv.split(File.pathSeparator)) {
                if (dir.isBlank()) {
                    continue;
                }
                Path candidate = executable(Util.abs(dir).resolve(Util.isWindows() ? "java.exe" : "java"));
                if (candidate != null) {
                    return candidate;
                }
            }
        }
        throw LauncherException.failed("JAVA_NOT_FOUND", "找不到 java 可执行文件（$JAVA_HOME/bin/java 与 PATH 都没有）；"
                + "显式给 --java，例如 --java \"C:/Program Files/Java/jdk1.8.0_221/bin/java\"（demo/agent 需要 JDK8）。");
    }

    /** Windows accepts `--java .../bin/java` (no .exe); resolve it to the real executable. */
    private static Path executable(Path candidate) {
        if (Files.isRegularFile(candidate)) {
            return candidate;
        }
        if (Util.isWindows()) {
            String name = candidate.getFileName() == null ? "" : candidate.getFileName().toString();
            if (!name.toLowerCase(java.util.Locale.ROOT).endsWith(".exe")) {
                Path withExe = candidate.resolveSibling(name + ".exe");
                if (Files.isRegularFile(withExe)) {
                    return withExe;
                }
            }
        }
        return null;
    }

    private static Path requireFile(String raw, String token, String advice) throws LauncherException {
        Path path = Util.abs(raw);
        if (!Files.isRegularFile(path)) {
            throw LauncherException.failed(token, "文件不存在: \"" + Util.fwd(path) + "\"；" + advice);
        }
        return path;
    }
}
