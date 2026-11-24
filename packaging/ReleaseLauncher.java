package io.traceboard.release;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Minimal launcher for the Windows app-image produced by scripts/package-exe.ps1.
 *
 * <p>The app-image contains its own JDK 21 runtime (Temurin for releases), while the
 * demo needs JDK 8. A bundled runtime/jre8 is preferred; otherwise JAVA8/JAVA8_HOME
 * or the standard local JDK8 path is used. Nothing is uploaded and all services bind
 * loopback only.</p>
 */
public final class ReleaseLauncher {

    private static final int PORT_COLLECTOR = 8601;
    private static final int PORT_DEMO = 8080;
    private static final int PORT_UI = 5173;
    private static final String SESSION = "s_demo_package";
    private static final List<Process> CHILDREN = new ArrayList<>();

    private ReleaseLauncher() {
    }

    public static void main(String[] args) {
        try {
            run();
        } catch (Throwable t) {
            System.err.println("TRACEBOARD_RELEASE_ERROR: " + (t.getMessage() == null ? t : t.getMessage()));
            stopChildren();
            System.exit(1);
        }
    }

    private static void run() throws Exception {
        Path root = locateRoot();
        Path java21 = locateJava21(root);
        Path java8 = locateJava8(root);
        Path app = root.resolve("app");
        require(java21, "JDK21 runtime (set JAVA21 or bundle runtime/jre21)");
        require(java8, "JDK8 runtime (set JAVA8 or bundle runtime/jre8)");
        for (String jar : List.of("collector.jar", "agent.jar", "launcher.jar", "demo.jar")) {
            require(app.resolve(jar), "app/" + jar);
        }
        require(root.resolve("workbench/index.html"), "workbench/index.html");
        Path logs = root.resolve("work/logs");
        Files.createDirectories(logs);

        Runtime.getRuntime().addShutdownHook(new Thread(ReleaseLauncher::stopChildren, "traceboard-release-shutdown"));

        start("collector", java21, List.of("-jar", app.resolve("collector.jar").toString()), root, logs);
        waitFor("http://127.0.0.1:" + PORT_COLLECTOR + "/actuator/health", "collector");

        List<String> demoArgs = new ArrayList<>();
        demoArgs.add("-javaagent:" + app.resolve("agent.jar"));
        demoArgs.add("-Dtraceboard.ingestUrl=http://127.0.0.1:" + PORT_COLLECTOR + "/ingest/v1/events");
        demoArgs.add("-Dtraceboard.sessionId=" + SESSION);
        demoArgs.add("-Dserver.port=" + PORT_DEMO);
        demoArgs.add("-jar");
        demoArgs.add(app.resolve("demo.jar").toString());
        start("demo", java8, demoArgs, root, logs);
        waitFor("http://127.0.0.1:" + PORT_DEMO + "/api/orders", "demo");

        start("ui", java21, List.of(
                "-jar", app.resolve("launcher.jar").toString(),
                "ui", "--dir", root.resolve("workbench").toString(),
                "--port", String.valueOf(PORT_UI),
                "--collector", "http://127.0.0.1:" + PORT_COLLECTOR
        ), root, logs);
        waitFor("http://127.0.0.1:" + PORT_UI + "/", "workbench");

        String url = "http://127.0.0.1:" + PORT_UI + "/";
        System.out.println("TRACEBOARD_READY url=" + url + " session=" + SESSION);
        System.out.println("Close this window or press Ctrl+C to stop all services.");
        try {
            new ProcessBuilder("cmd", "/c", "start", "", url).start();
        } catch (Throwable ignored) {
            // browser launch is best-effort
        }
        Thread.currentThread().join();
    }

    private static Path locateRoot() {
        String appPath = System.getProperty("jpackage.app-path");
        if (appPath != null && !appPath.isBlank()) {
            Path parent = Path.of(appPath).toAbsolutePath().normalize().getParent();
            if (parent != null) return parent;
        }
        String command = ProcessHandle.current().info().command().orElse("");
        if (!command.isBlank()) {
            Path parent = Path.of(command).toAbsolutePath().normalize().getParent();
            if (parent != null) return parent;
        }
        return Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
    }

    private static Path locateJava21(Path root) {
        Path bundled = root.resolve("runtime/jre21/bin/java.exe");
        if (Files.isRegularFile(bundled)) return bundled;
        for (String key : List.of("JAVA21", "JAVA21_HOME", "JDK21_HOME")) {
            String value = System.getenv(key);
            if (value != null && !value.isBlank()) {
                Path candidate = Path.of(value, "bin", "java.exe");
                if (Files.isRegularFile(candidate)) return candidate;
            }
        }
        Path fallback = Path.of("C:/Program Files/Java/jdk-21/bin/java.exe");
        return Files.isRegularFile(fallback) ? fallback : Path.of("__missing_java21__");
    }

    private static Path locateJava8(Path root) {
        Path bundled = root.resolve("runtime/jre8/bin/java.exe");
        if (Files.isRegularFile(bundled)) return bundled;
        for (String key : List.of("JAVA8", "JAVA8_HOME", "JDK8_HOME")) {
            String value = System.getenv(key);
            if (value != null && !value.isBlank()) {
                Path candidate = Path.of(value, "bin", "java.exe");
                if (Files.isRegularFile(candidate)) return candidate;
            }
        }
        Path fallback = Path.of("C:/Program Files/Java/jdk1.8.0_221/bin/java.exe");
        return Files.isRegularFile(fallback) ? fallback : Path.of("__missing_java8__");
    }

    private static void require(Path path, String label) {
        if (!Files.isRegularFile(path)) {
            throw new IllegalStateException("Missing " + label + ": " + path);
        }
    }

    private static void start(String name, Path java, List<String> args, Path root, Path logs) throws Exception {
        List<String> command = new ArrayList<>();
        command.add(java.toString());
        command.addAll(args);
        ProcessBuilder builder = new ProcessBuilder(command)
                .directory(root.toFile())
                .redirectErrorStream(true)
                .redirectOutput(logs.resolve(name + ".log").toFile());
        Process process = builder.start();
        CHILDREN.add(process);
        System.out.println("started " + name + " pid=" + process.pid());
    }

    private static void waitFor(String url, String name) throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        long end = System.nanoTime() + Duration.ofSeconds(90).toNanos();
        while (System.nanoTime() < end) {
            try {
                HttpResponse<Void> response = client.send(
                        HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(3)).GET().build(),
                        HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() == 200) {
                    System.out.println("READY " + name + " " + url);
                    return;
                }
            } catch (Throwable ignored) {
                // retry until timeout
            }
            Thread.sleep(500);
        }
        throw new IllegalStateException("Timed out waiting for " + name + ": " + url);
    }

    private static void stopChildren() {
        for (Process process : CHILDREN) {
            try {
                if (process.isAlive()) {
                    process.destroy();
                    if (!process.waitFor(3, java.util.concurrent.TimeUnit.SECONDS)) {
                        process.destroyForcibly();
                    }
                }
            } catch (Throwable ignored) {
                // fail-open shutdown
            }
        }
    }
}