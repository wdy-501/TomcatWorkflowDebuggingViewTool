package io.traceboard.launcher;

import io.traceboard.launcher.ChildProcesses.Child;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

/**
 * {@code run --jar app.jar}: one command that starts/reuses the collector (default 8601), starts
 * the workbench UI (default 5173, in-process), derives a session + include package, spawns the
 * user JAR with the generic agent and opens
 * {@code http://127.0.0.1:<ui-port>/?session=<id>&app=<appUrl>#app}. The three ports are
 * independently configurable: {@code --port} (application), {@code --collector-port}, and
 * {@code --ui-port}. The workbench embeds the user's app as “我的应用”; the board is one tab away.
 *
 * <p>Only processes started by this run are stopped on exit (shutdown hook / app exit). Reused
 * collector or UI instances are recorded but never killed. {@code --detach} means "do not follow
 * the app log"; the run process still waits on the app so the in-process UI and collector stay
 * alive.</p>
 */
final class RunCommand {

    private static final Duration COLLECTOR_HEALTH_TIMEOUT = Duration.ofSeconds(60);
    private static final Duration APP_HEALTH_TIMEOUT = Duration.ofSeconds(60);
    private static final Duration UI_READY_TIMEOUT = Duration.ofSeconds(20);
    private static final Duration POLL = Duration.ofMillis(300);
    private static final int DEFAULT_APP_PORT = 8080;
    private static final int DEFAULT_COLLECTOR_PORT = 8601;
    private static final int DEFAULT_UI_PORT = 5173;

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        String session = SessionId.resolve(args.get("--session"));
        boolean detach = args.flag("--detach");
        boolean noOpen = args.flag("--no-open");
        boolean noUi = args.flag("--no-ui");
        boolean portExplicit = args.has("--port");
        int port = args.port("--port", DEFAULT_APP_PORT);
        int collectorPort = args.port("--collector-port", DEFAULT_COLLECTOR_PORT);
        boolean collectorPortExplicit = args.has("--collector-port");
        int uiPort = args.port("--ui-port", DEFAULT_UI_PORT);
        if (port == collectorPort || port == uiPort || collectorPort == uiPort) {
            throw LauncherException.usage("--port、--collector-port、--ui-port 必须互不相同："
                    + "app=" + port + " collector=" + collectorPort + " ui=" + uiPort + "。");
        }

        Path jar = requireFile(args.require("--jar"), "JAR_NOT_FOUND",
                "应用 JAR 不存在；确认 --jar 指向可执行的 Spring Boot / Java JAR。");
        String healthRaw = args.get("--health");
        String healthUrl = healthRaw == null ? null : Urls.loopbackHttpUrl(healthRaw, "--health").toString();

        CollectorTarget collectorTarget = collectorTarget(args.get("--collector"), collectorPort,
                collectorPortExplicit);
        String collectorOrigin = collectorTarget.origin();

        Path agent = args.has("--agent")
                ? requireFile(args.get("--agent"), "AGENT_NOT_FOUND",
                        "agent jar 不存在；先构建: JAVA_HOME=\"$JAVA21\" mvn -B -q -DskipTests package -pl \"agent\" -am。")
                : autoResolveAgent();
        Path uiDir = null;
        if (!noUi) {
            uiDir = args.has("--ui-dir")
                    ? requireUiDir(args.get("--ui-dir"))
                    : autoResolveUiDir();
        }

        List<String> explicitIncludes = args.list("--include");
        String include = explicitIncludes.isEmpty()
                ? JarScanner.appBasePackage(jar)
                : String.join(",", explicitIncludes);
        List<String> excludes = args.list("--exclude");
        List<String> includeMethods = args.list("--include-method");

        Path appJava = resolveAppJava(args.get("--java"));
        Path serviceJava = currentJava();

        System.out.println("SESSION=" + session);
        System.out.println("INCLUDE=" + (include == null
                ? "(未推导：manifest 缺少 Start-Class/Main-Class；请用 --include 指定主包)"
                : include));
        if (!excludes.isEmpty()) {
            System.out.println("EXCLUDE=" + String.join(",", excludes));
        }
        if (!includeMethods.isEmpty()) {
            System.out.println("INCLUDE_METHOD=" + String.join(",", includeMethods));
        }

        if (portExplicit && !portFree(port)) {
            throw LauncherException.failed("PORT_IN_USE", "应用端口 " + port + " 已被占用；先停止旧进程或显式换端口"
                    + "（netstat -ano | findstr :" + port + " 查 PID；不静默改端口）。");
        }

        Path work = Util.abs("work");
        Path logDir = work.resolve("logs");
        try {
            Files.createDirectories(logDir);
        } catch (IOException e) {
            throw LauncherException.failed("WORK_DIR", "无法创建日志目录 \"" + Util.fwd(logDir) + "\"（"
                    + e.getClass().getSimpleName() + "）；检查工作目录权限。");
        }
        Path pidFile = work.resolve(session + ".pid");
        Path servicesFile = work.resolve(session + ".services.json");

        String configuredAppUrl = args.get("--app-url");
        String appUrl;
        if (configuredAppUrl != null) {
            appUrl = Urls.loopbackHttpUrl(configuredAppUrl, "--app-url").toString();
        } else if (portExplicit) {
            appUrl = "http://127.0.0.1:" + port + "/";
        } else {
            appUrl = "http://127.0.0.1:" + DEFAULT_APP_PORT + "/";
        }

        AtomicBoolean cleaned = new AtomicBoolean(false);
        Child collector = null;
        Child app = null;
        UiState ui = UiState.none();
        Thread hook = null;
        try {
            CollectorState collectorState = ensureCollector(collectorTarget, serviceJava, session, logDir);
            collector = collectorState.child();

            ui = noUi ? UiState.none() : ensureUi(uiDir, collectorOrigin, appUrl, uiPort);

            List<String> appCommand = buildAppCommand(appJava, agent, collectorOrigin, session, include,
                    excludes, includeMethods, portExplicit, port, jar, args);
            Path appLog = logDir.resolve(session + "-app.log");
            System.out.println("APP_CMD=" + display(appCommand));
            System.out.println("APP_LOG=\"" + Util.fwd(appLog) + "\"");
            app = ChildProcesses.start("app", appCommand, appJava, jar, appLog);

            try {
                PidFile.write(pidFile, app.pid(), app.startedAtMs(), appJava, jar);
            } catch (IOException e) {
                throw LauncherException.failed("WORK_DIR", "无法写 PID 文件 \"" + Util.fwd(pidFile) + "\"（"
                        + e.getClass().getSimpleName() + "）；检查 work/ 目录权限。");
            }
            writeServices(servicesFile, session, app, collector, ui, pidFile, uiPort);

            final Child appChild = app;
            final Child collectorChild = collector;
            hook = new Thread(() -> {
                System.out.println("STOPPING session=" + session + "（launcher 退出，停止本次启动的子进程）");
                cleanup(cleaned, appChild, collectorChild, pidFile, servicesFile);
            }, "traceboard-run-shutdown");
            Runtime.getRuntime().addShutdownHook(hook);

            System.out.println("APP=pid=" + app.pid() + " url=" + appUrl);
            if (collectorState.reused()) {
                System.out.println("COLLECTOR=reuse url=" + collectorOrigin);
            } else {
                System.out.println("COLLECTOR=start pid=" + collector.pid() + " url=" + collectorOrigin);
            }
            if (ui.kind().equals("in-process")) {
                System.out.println("UI=start url=" + ui.url() + " (in-process)");
            } else if (ui.kind().equals("reused")) {
                System.out.println("UI=reuse url=" + ui.url());
            } else {
                System.out.println("UI=disabled");
            }

            if (healthUrl != null) {
                Ready ready = awaitAppHealth(app, healthUrl);
                if (ready != Ready.READY) {
                    printTail(System.err, "应用未就绪（" + ready + "）；日志尾 20 行:", appLog);
                    if (ready == Ready.EXITED) {
                        throw LauncherException.failed("APP_EXITED", "应用在就绪前退出（pid=" + app.pid()
                                + "）；查看上面的日志尾。");
                    }
                    throw LauncherException.failed("HEALTH_TIMEOUT", "健康检查在 " + APP_HEALTH_TIMEOUT.toSeconds()
                            + "s 内未通过: \"" + healthUrl + "\"；查看上面的日志尾。");
                }
                System.out.println("READY health=" + healthUrl);
            } else if (!app.alive()) {
                printTail(System.err, "应用在打开工作台前退出；日志尾 20 行:", appLog);
                throw LauncherException.failed("APP_EXITED", "应用启动后立即退出（pid=" + app.pid() + "）。");
            }

            String openUrl = "http://127.0.0.1:" + uiPort + "/?session="
                    + URLEncoder.encode(session, StandardCharsets.UTF_8)
                    + "&app=" + URLEncoder.encode(appUrl, StandardCharsets.UTF_8)
                    + "#app";
            if (!noUi) {
                if (noOpen) {
                    System.out.println("WORKBENCH=" + openUrl);
                } else {
                    System.out.println("OPEN=" + openUrl);
                    if (!Browser.open(openUrl)) {
                        System.out.println("WARN 无法自动打开浏览器；请手工访问 " + openUrl);
                    }
                }
            }
            System.out.println("STOP=" + stopCommand(session));
            System.out.println("提示: 停止全部服务: " + stopCommand(session));
            System.out.flush();
            if (detach) {
                System.out.println("DETACH=1（不跟随应用日志；进程仍等待应用退出，Ctrl+C 会停止本次启动的服务）");
                System.out.flush();
            }

            Util.Tail tail = null;
            if (!detach) {
                tail = new Util.Tail(appLog, System.out);
                tail.start();
            }
            int exit;
            try {
                exit = app.process().waitFor();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                ChildProcesses.stop(app.process());
                exit = -1;
            } finally {
                if (tail != null) {
                    tail.stop();
                }
            }
            System.out.println("APP_STOPPED pid=" + app.pid() + " exit=" + exit);
            printTail(System.out, "应用日志尾 20 行:", appLog);
            System.out.flush();
            return exit == 0 ? Launcher.EXIT_OK : Launcher.EXIT_FAILED;
        } finally {
            cleanup(cleaned, app, collector, pidFile, servicesFile);
            if (hook != null) {
                try {
                    Runtime.getRuntime().removeShutdownHook(hook);
                } catch (IllegalStateException ignored) {
                    // shutdown already in progress
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // collector (reuse or spawn)
    // -------------------------------------------------------------------------

    private record CollectorTarget(String origin, Path jarFlag, boolean spawnable) {
    }

    private record CollectorState(Child child, boolean reused) {
    }

    /**
     * {@code --collector} keeps its original meaning (collector origin) but also accepts a
     * collector JAR path for {@code run}: a value ending in {@code .jar} is treated as the
     * artifact, everything else as an origin. Without {@code --collector}, the bundled collector
     * is started on {@code --collector-port} (default 8601).
     */
    private static CollectorTarget collectorTarget(String raw, int collectorPort,
                                                   boolean collectorPortExplicit) throws LauncherException {
        String defaultOrigin = "http://127.0.0.1:" + collectorPort;
        if (raw == null || raw.isBlank()) {
            return new CollectorTarget(defaultOrigin, null, true);
        }
        String value = raw.trim();
        if (value.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            Path jar = requireFile(value, "COLLECTOR_NOT_FOUND",
                    "collector jar 不存在；先构建: JAVA_HOME=\"$JAVA21\" mvn -B -q -DskipTests package -pl \"server/collector\" -am。");
            return new CollectorTarget(defaultOrigin, jar, true);
        }
        String origin = Urls.collectorOrigin(value);
        if (collectorPortExplicit && originPort(origin) != collectorPort) {
            throw LauncherException.usage("--collector 与 --collector-port 冲突："
                    + origin + " 的端口不是 " + collectorPort + "；只保留其中一个参数。");
        }
        return new CollectorTarget(origin, null, false);
    }

    private static int originPort(String origin) throws LauncherException {
        try {
            int port = URI.create(origin).getPort();
            if (port > 0) {
                return port;
            }
        } catch (IllegalArgumentException ignored) {
            // fall through
        }
        throw LauncherException.usage("collector origin 缺少端口: \"" + origin + "\"。");
    }

    private static CollectorState ensureCollector(CollectorTarget target, Path java, String session,
                                                  Path logDir) throws LauncherException {
        String healthUrl = target.origin() + "/actuator/health";
        if (isHealthy(healthUrl)) {
            return new CollectorState(null, true);
        }
        if (!target.spawnable()) {
            throw LauncherException.failed("COLLECTOR_UNREACHABLE", "collector 不可达: " + target.origin()
                    + "/actuator/health；使用 --collector <origin> 时不会自动启动该实例。"
                    + "请先手工启动它，或改用 --collector-port <port> 让 TraceBoard 启动内置 collector。");
        }
        int collectorPort = originPort(target.origin());
        if (!portFree(collectorPort)) {
            throw LauncherException.failed("PORT_IN_USE", "collector 端口 " + collectorPort + " 已被占用；"
                    + "先停止占用进程或用 --collector-port 换端口（不静默改端口）。");
        }
        Path collectorJar = target.jarFlag() != null ? target.jarFlag() : autoResolveCollectorJar();
        Path collectorLog = logDir.resolve(session + "-collector.log");
        List<String> collectorCommand = List.of(java.toString(), "-jar", collectorJar.toString(),
                "--server.port=" + collectorPort);
        System.out.println("COLLECTOR_CMD=" + display(collectorCommand));
        System.out.println("COLLECTOR_LOG=\"" + Util.fwd(collectorLog) + "\"");
        Child child = ChildProcesses.start("collector", collectorCommand, java, collectorJar, collectorLog);
        long deadline = System.nanoTime() + COLLECTOR_HEALTH_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            if (!child.alive()) {
                printTail(System.err, "collector 启动后退出；日志尾 20 行:", collectorLog);
                throw LauncherException.failed("COLLECTOR_EXITED",
                        "collector 在健康检查前退出（pid=" + child.pid() + "）；查看上面的日志尾。");
            }
            if (isHealthy(healthUrl)) {
                return new CollectorState(child, false);
            }
            sleep(POLL);
        }
        printTail(System.err, "collector 健康检查超时；日志尾 20 行:", collectorLog);
        ChildProcesses.stop(child.process());
        throw LauncherException.failed("COLLECTOR_HEALTH_TIMEOUT", "collector 在 "
                + COLLECTOR_HEALTH_TIMEOUT.toSeconds() + "s 内未通过健康检查: " + healthUrl
                + "；查看上面的日志尾。");
    }

    private static boolean isHealthy(String healthUrl) {
        return Http.is2xx(Http.client(Duration.ofSeconds(1)), healthUrl, Duration.ofSeconds(2));
    }

    // -------------------------------------------------------------------------
    // workbench UI (in-process UiCommand)
    // -------------------------------------------------------------------------

    private record UiState(String kind, String url, long pid, long startedAtMs, String java,
                           String jar, String commandLineHint) {

        static UiState none() {
            return new UiState("none", "", 0L, 0L, "", "", "");
        }

        static UiState reused(String url) {
            return new UiState("reused", url, 0L, 0L, "", "", "");
        }
    }

    private static UiState ensureUi(Path uiDir, String collectorOrigin, String appUrl, int uiPort)
            throws LauncherException {
        String url = "http://127.0.0.1:" + uiPort;
        if (isTraceBoardUi(url + "/")) {
            return UiState.reused(url);
        }
        AtomicReference<LauncherException> failure = new AtomicReference<>();
        Thread thread = new Thread(() -> {
            try {
                List<String> uiArgs = new ArrayList<String>();
                uiArgs.add("--dir");
                uiArgs.add(Util.fwd(uiDir));
                uiArgs.add("--port");
                uiArgs.add(String.valueOf(uiPort));
                uiArgs.add("--collector");
                uiArgs.add(collectorOrigin);
                if (appUrl != null) {
                    uiArgs.add("--app-url");
                    uiArgs.add(appUrl);
                }
                new UiCommand().run(uiArgs.toArray(new String[0]));
            } catch (LauncherException e) {
                failure.set(e);
                System.err.println(e.render());
            } catch (Throwable t) {
                System.err.println("UI_START_FAILED: " + t.getClass().getSimpleName()
                        + (t.getMessage() == null ? "" : ": " + t.getMessage()));
            }
        }, "traceboard-run-ui");
        thread.setDaemon(true);
        thread.start();

        long deadline = System.nanoTime() + UI_READY_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            LauncherException error = failure.get();
            if (error != null) {
                throw error;
            }
            if (isTraceBoardUi(url + "/")) {
                return new UiState("in-process", url, ProcessHandle.current().pid(),
                        currentStartMs(), Util.fwd(currentJava()),
                        selfJar() == null ? "" : Util.fwd(selfJar()),
                        selfJar() == null ? "io.traceboard.launcher.Launcher" : Util.fwd(selfJar()));
            }
            if (!thread.isAlive() && failure.get() == null) {
                break;
            }
            sleep(POLL);
        }
        LauncherException error = failure.get();
        if (error != null) {
            throw error;
        }
        throw LauncherException.failed("UI_HEALTH_TIMEOUT", "workbench 在 " + UI_READY_TIMEOUT.toSeconds()
                + "s 内未就绪: " + url + "；检查端口 " + uiPort + " 是否被其他程序占用。");
    }

    private static boolean isTraceBoardUi(String url) {
        Http.Resp response = Http.get(Http.client(Duration.ofSeconds(1)), url, Duration.ofSeconds(2));
        if (!response.ok() || !Http.is2xx(response.status())) {
            return false;
        }
        String body = response.bodyText();
        return body.contains("TraceBoard") || body.contains("id=\"app\"");
    }

    // -------------------------------------------------------------------------
    // app command / readiness
    // -------------------------------------------------------------------------

    private static List<String> buildAppCommand(Path java, Path agent, String collectorOrigin, String session,
                                                String include, List<String> excludes, List<String> includeMethods,
                                                boolean portExplicit, int port, Path jar, Args args) {
        List<String> command = new ArrayList<>();
        command.add(java.toString());
        command.add("-javaagent:" + Util.fwd(agent));
        command.add("-Dtraceboard.mode=generic");
        command.add("-Dtraceboard.ingestUrl=" + collectorOrigin + "/ingest/v1/events");
        command.add("-Dtraceboard.sessionId=" + session);
        if (include != null && !include.isBlank()) {
            command.add("-Dtraceboard.include=" + include);
        }
        if (!excludes.isEmpty()) {
            command.add("-Dtraceboard.exclude=" + String.join(",", excludes));
        }
        if (!includeMethods.isEmpty()) {
            command.add("-Dtraceboard.includeMethod=" + String.join(",", includeMethods));
        }
        if (portExplicit) {
            command.add("-Dserver.port=" + port);
        }
        command.addAll(args.list("--jvm-arg"));
        command.add("-jar");
        command.add(jar.toString());
        command.addAll(args.list("--app-arg"));
        return command;
    }

    private enum Ready { READY, EXITED, TIMEOUT }

    private static Ready awaitAppHealth(Child app, String healthUrl) {
        java.net.http.HttpClient client = Http.client(Duration.ofSeconds(1));
        long deadline = System.nanoTime() + APP_HEALTH_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            if (!app.alive()) {
                return Ready.EXITED;
            }
            if (Http.is2xx(client, healthUrl, Duration.ofSeconds(2))) {
                return Ready.READY;
            }
            sleep(POLL);
        }
        return app.alive() ? Ready.TIMEOUT : Ready.EXITED;
    }

    // -------------------------------------------------------------------------
    // artifact resolution (flags → packaged app/ + workbench → repo targets)
    // -------------------------------------------------------------------------

    private static Path autoResolveAgent() throws LauncherException {
        for (Path dir : packagedAppDirs()) {
            Path candidate = findJar(dir, "agent");
            if (candidate != null) {
                return candidate;
            }
        }
        Path repo = findJar(Util.abs("agent/target"), "agent");
        if (repo != null) {
            return repo;
        }
        throw LauncherException.failed("AGENT_NOT_FOUND", "找不到 agent jar（已查 app/*.jar 与 agent/target/traceboard-agent-1.0.0.jar）；"
                + "构建: JAVA_HOME=\"$JAVA21\" mvn -B -q -DskipTests package -pl \"agent\" -am；或用 --agent 指定。");
    }

    private static Path autoResolveCollectorJar() throws LauncherException {
        for (Path dir : packagedAppDirs()) {
            Path candidate = findJar(dir, "collector");
            if (candidate != null) {
                return candidate;
            }
        }
        Path repo = findJar(Util.abs("server/collector/target"), "collector");
        if (repo != null) {
            return repo;
        }
        throw LauncherException.failed("COLLECTOR_NOT_FOUND",
                "找不到 collector jar（已查 app/*.jar 与 server/collector/target/traceboard-collector-1.0.0.jar）；"
                        + "构建: JAVA_HOME=\"$JAVA21\" mvn -B -q -DskipTests package -pl \"server/collector\" -am；"
                        + "或用 --collector 指定 collector.jar（也可以指向一个已启动的 collector origin）。");
    }

    private static Path autoResolveUiDir() throws LauncherException {
        for (Path root : packagedRoots()) {
            Path workbench = root.resolve("workbench");
            if (looksBuiltUi(workbench)) {
                return workbench;
            }
        }
        Path dist = Util.abs("workbench/dist");
        if (looksBuiltUi(dist)) {
            return dist;
        }
        throw LauncherException.failed("UI_DIR_MISSING", "找不到构建后的 workbench（已查 pack 的 workbench/ 与 workbench/dist）；"
                + "构建: cd workbench && npm ci && npm run build；或用 --ui-dir 指定静态目录，或加 --no-ui 不启动界面。");
    }

    private static Path requireUiDir(String raw) throws LauncherException {
        Path dir = Util.abs(raw);
        if (!Files.isDirectory(dir)) {
            throw LauncherException.failed("UI_DIR_MISSING", "静态目录不存在: \"" + Util.fwd(dir)
                    + "\"；先构建 workbench (cd \"workbench\" && npm ci && npm run build)，或用 --no-ui。");
        }
        if (!Files.isRegularFile(dir.resolve("index.html"))) {
            throw LauncherException.failed("UI_INDEX_MISSING", "静态目录缺少 index.html: \"" + Util.fwd(dir)
                    + "\"；先构建 workbench。");
        }
        return dir;
    }

    /** A directory counts as a built workbench when index.html no longer references Vite sources. */
    private static boolean looksBuiltUi(Path dir) {
        Path index = dir.resolve("index.html");
        if (!Files.isRegularFile(index)) {
            return false;
        }
        try {
            String html = Files.readString(index, StandardCharsets.UTF_8);
            return !html.contains("/src/main.") && !html.contains("./src/main.");
        } catch (IOException e) {
            return false;
        }
    }

    private static List<Path> packagedAppDirs() {
        Set<Path> dirs = new LinkedHashSet<>();
        Path self = selfJar();
        if (self != null && self.getParent() != null) {
            dirs.add(self.getParent());
        }
        Path app = Util.abs("app");
        if (Files.isDirectory(app)) {
            dirs.add(app);
        }
        return new ArrayList<>(dirs);
    }

    private static List<Path> packagedRoots() {
        Set<Path> roots = new LinkedHashSet<>();
        Path self = selfJar();
        if (self != null && self.getParent() != null && self.getParent().getParent() != null) {
            roots.add(self.getParent().getParent());
        }
        roots.add(Util.abs("."));
        return new ArrayList<>(roots);
    }

    /** Finds a single artifact in {@code dir}; prefers the exact {@code <hint>.jar} and plain jars. */
    private static Path findJar(Path dir, String hint) {
        if (!Files.isDirectory(dir)) {
            return null;
        }
        String lowerHint = hint.toLowerCase(Locale.ROOT);
        try (Stream<Path> stream = Files.list(dir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
                        return name.endsWith(".jar") && name.contains(lowerHint) && !name.startsWith("original-");
                    })
                    .sorted((a, b) -> {
                        String an = a.getFileName().toString().toLowerCase(Locale.ROOT);
                        String bn = b.getFileName().toString().toLowerCase(Locale.ROOT);
                        int exactA = an.equals(lowerHint + ".jar") ? 0 : 1;
                        int exactB = bn.equals(lowerHint + ".jar") ? 0 : 1;
                        if (exactA != exactB) {
                            return exactA - exactB;
                        }
                        int shadedA = an.contains("-shaded") ? 1 : 0;
                        int shadedB = bn.contains("-shaded") ? 1 : 0;
                        if (shadedA != shadedB) {
                            return shadedA - shadedB;
                        }
                        if (an.length() != bn.length()) {
                            return an.length() - bn.length();
                        }
                        return an.compareTo(bn);
                    })
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            return null;
        }
    }

    private static Path selfJar() {
        try {
            java.security.CodeSource source = RunCommand.class.getProtectionDomain().getCodeSource();
            if (source == null || source.getLocation() == null) {
                return null;
            }
            Path path = Path.of(source.getLocation().toURI()).toAbsolutePath().normalize();
            return Files.isRegularFile(path) && path.toString().toLowerCase(Locale.ROOT).endsWith(".jar") ? path : null;
        } catch (Exception e) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // services record + cleanup
    // -------------------------------------------------------------------------

    private static void writeServices(Path file, String session, Child app, Child collector, UiState ui,
                                      Path pidFile, int uiPort) throws LauncherException {
        StringBuilder json = new StringBuilder(512);
        json.append("{\"session\":").append(quote(session))
                .append(",\"createdAtMs\":").append(System.currentTimeMillis())
                .append(",\"app\":{").append(processFields(app))
                .append(",\"pidFile\":").append(quote(Util.fwd(pidFile))).append("}")
                .append(",\"collector\":");
        if (collector != null) {
            json.append('{').append(processFields(collector)).append(",\"startedByRun\":true}");
        } else {
            json.append("{\"startedByRun\":false,\"reused\":true}");
        }
        json.append(",\"ui\":");
        switch (ui.kind()) {
            case "in-process":
                json.append("{\"kind\":\"in-process\",\"pid\":").append(ui.pid())
                        .append(",\"startedAtMs\":").append(ui.startedAtMs())
                        .append(",\"java\":").append(quote(ui.java()))
                        .append(",\"jar\":").append(quote(ui.jar()))
                        .append(",\"commandLineHint\":").append(quote(ui.commandLineHint()))
                        .append(",\"port\":").append(uiPort)
                        .append(",\"url\":").append(quote(ui.url())).append('}');
                break;
            case "reused":
                json.append("{\"kind\":\"reused\",\"port\":").append(uiPort)
                        .append(",\"url\":").append(quote(ui.url())).append('}');
                break;
            default:
                json.append("{\"kind\":\"none\"}");
                break;
        }
        json.append('}');
        try {
            Files.writeString(file, json + System.lineSeparator(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw LauncherException.failed("WORK_DIR", "无法写服务记录 \"" + Util.fwd(file) + "\"（"
                    + e.getClass().getSimpleName() + "）；检查 work/ 目录权限。");
        }
    }

    private static String processFields(Child child) {
        return "\"pid\":" + child.pid()
                + ",\"startedAtMs\":" + child.startedAtMs()
                + ",\"java\":" + quote(Util.fwd(child.java()))
                + ",\"jar\":" + quote(Util.fwd(child.jar()))
                + ",\"log\":" + quote(Util.fwd(child.log()));
    }

    private static void cleanup(AtomicBoolean cleaned, Child app, Child collector, Path pidFile,
                                Path servicesFile) {
        if (!cleaned.compareAndSet(false, true)) {
            return;
        }
        if (app != null && app.alive()) {
            ChildProcesses.stop(app.process());
        }
        if (collector != null && collector.alive()) {
            ChildProcesses.stop(collector.process());
        }
        PidFile.delete(pidFile);
        try {
            Files.deleteIfExists(servicesFile);
        } catch (IOException ignored) {
            // best effort
        }
    }

    private static String stopCommand(String session) {
        Path launcher = selfJar();
        if (launcher != null) {
            return quote(Util.fwd(currentJava())) + " -jar " + quote(Util.fwd(launcher))
                    + " stop --session " + session;
        }
        // Development / classpath runs: print a command that still works instead of a jar
        // placeholder (the packaged build always has selfJar).
        String classpath = System.getProperty("java.class.path");
        if (classpath != null && !classpath.isBlank()) {
            return quote(Util.fwd(currentJava())) + " -cp " + quote(classpath.replace('\\', '/'))
                    + " " + Launcher.class.getName() + " stop --session " + session;
        }
        return quote(Util.fwd(currentJava())) + " -jar <launcher.jar> stop --session " + session;
    }

    // -------------------------------------------------------------------------
    // java / port / display helpers
    // -------------------------------------------------------------------------

    private static Path resolveAppJava(String explicit) throws LauncherException {
        if (explicit != null) {
            Path executable = executable(Util.abs(explicit));
            if (executable == null) {
                throw LauncherException.failed("JAVA_NOT_FOUND", "--java 指向的 java 不存在: \"" + Util.fwd(Util.abs(explicit))
                        + "\"；用它指定运行应用的 JDK（Spring Boot 3 用 JDK17/21，Boot 2 可按需用 JDK8）。");
            }
            return executable;
        }
        String home = System.getProperty("java.home");
        if (home != null && !home.isBlank()) {
            Path candidate = executable(Path.of(home, "bin", javaExecutableName()));
            if (candidate != null) {
                return candidate;
            }
        }
        return Path.of("java");
    }

    private static Path currentJava() {
        String home = System.getProperty("java.home");
        if (home != null && !home.isBlank()) {
            Path candidate = executable(Path.of(home, "bin", javaExecutableName()));
            if (candidate != null) {
                return candidate;
            }
        }
        return Path.of("java");
    }

    private static String javaExecutableName() {
        return Util.isWindows() ? "java.exe" : "java";
    }

    /** Windows accepts {@code --java .../bin/java} (no .exe); resolve it to the real executable. */
    private static Path executable(Path candidate) {
        if (Files.isRegularFile(candidate)) {
            return candidate;
        }
        if (Util.isWindows()) {
            String name = candidate.getFileName() == null ? "" : candidate.getFileName().toString();
            if (!name.toLowerCase(Locale.ROOT).endsWith(".exe")) {
                Path withExe = candidate.resolveSibling(name + ".exe");
                if (Files.isRegularFile(withExe)) {
                    return withExe;
                }
            }
        }
        return null;
    }

    private static boolean portFree(int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", port), 300);
            return false;
        } catch (IOException ignored) {
            // not listening: continue below
        }
        try (java.net.ServerSocket socket = new java.net.ServerSocket()) {
            socket.setReuseAddress(false);
            socket.bind(new InetSocketAddress("127.0.0.1", port), 1);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    private static long currentStartMs() {
        return ProcessHandle.current().info().startInstant().map(Instant::toEpochMilli)
                .orElse(System.currentTimeMillis());
    }

    private static Path requireFile(String raw, String token, String advice) throws LauncherException {
        Path path = Util.abs(raw);
        if (!Files.isRegularFile(path)) {
            throw LauncherException.failed(token, "文件不存在: \"" + Util.fwd(path) + "\"；" + advice);
        }
        return path;
    }

    private static void printTail(java.io.PrintStream sink, String header, Path log) {
        List<String> lines = Util.tailLines(log, 20);
        sink.println(header);
        Util.printTail(sink, lines);
        sink.flush();
    }

    private static void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static String display(List<String> command) {
        List<String> parts = new ArrayList<>(command.size());
        for (String part : command) {
            parts.add(part.contains(" ") || part.contains("\\") ? "\"" + part + "\"" : part);
        }
        return String.join(" ", parts);
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}