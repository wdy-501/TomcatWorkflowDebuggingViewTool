package io.traceboard.launcher;

import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * TraceBoard 1.0.0 local launcher CLI.
 *
 * <p>Subcommands: {@code run}, {@code idea}, {@code jar}, {@code stop}, {@code preview},
 * {@code diagnose}, {@code ui}.
 * Global exit codes: {@code 0} success / no FAIL, {@code 1} unexpected launcher error
 * ({@code LAUNCHER_ERROR}), {@code 2} usage error, {@code 3} expected failure (spawn / health
 * timeout / stop refused / diagnose has at least one FAIL).</p>
 *
 * <p>This class must be started with JDK 21 (class file major 65). The target application can run
 * on JDK 8/17/21 via {@code run --java} or {@code jar --java}. Never invoke it with a bare PATH
 * {@code java}.</p>
 */
public final class Launcher {

    public static final int EXIT_OK = 0;
    public static final int EXIT_LAUNCHER_ERROR = 1;
    public static final int EXIT_USAGE = 2;
    public static final int EXIT_FAILED = 3;

    private Launcher() {
    }

    public static void main(String[] argv) {
        // Git Bash tooling expects UTF-8; keep the tokens ASCII and the advice UTF-8.
        System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(new FileOutputStream(FileDescriptor.err), true, StandardCharsets.UTF_8));

        int code;
        try {
            code = run(argv);
        } catch (LauncherException e) {
            System.err.println(e.render());
            code = e.exitCode;
        } catch (Throwable t) {
            System.err.println("LAUNCHER_ERROR: " + t.getClass().getSimpleName()
                    + (t.getMessage() == null ? "" : ": " + t.getMessage())
                    + "\n建议: launcher 自身异常（不代表检查结论）。确认用 JDK21 运行: "
                    + "\"$JAVA21/bin/java\" -jar \"server/launcher/target/traceboard-launcher-1.0.0.jar\" --help；"
                    + "被调试应用的 JDK 由 --java 指定。");
            code = EXIT_LAUNCHER_ERROR;
        }
        System.out.flush();
        System.err.flush();
        System.exit(code);
    }

    private static int run(String[] argv) throws LauncherException {
        if (argv.length == 0) {
            printUsage(System.out);
            return EXIT_USAGE;
        }
        String command = argv[0];
        if (command.equals("--help") || command.equals("-h") || command.equals("help")) {
            printUsage(System.out);
            return EXIT_OK;
        }
        String[] rest = Arrays.copyOfRange(argv, 1, argv.length);
        if (hasHelp(rest)) {
            printCommandUsage(command);
            return EXIT_OK;
        }
        switch (command) {
            case "run":
                return new RunCommand().run(rest);
            case "idea":
                return new IdeaCommand().run(rest);
            case "jar":
                return new JarCommand().run(rest);
            case "stop":
                return new StopCommand().run(rest);
            case "preview":
                return new PreviewCommand().run(rest);
            case "ui":
                return new UiCommand().run(rest);
            case "diagnose":
                return new DiagnoseCommand().run(rest);
            default:
                System.err.println("USAGE: 未知子命令 \"" + command + "\"；可用: run | idea | jar | stop | preview | ui | diagnose（--help 查看用法）。");
                printUsage(System.err);
                return EXIT_USAGE;
        }
    }

    private static boolean hasHelp(String[] rest) {
        for (String a : rest) {
            if (a.equals("--help") || a.equals("-h")) {
                return true;
            }
        }
        return false;
    }

    private static void printCommandUsage(String command) {
        PrintStream out = System.out;
        switch (command) {
            case "run":
                out.println("用法: run --jar <app.jar> [--java <jdk java>] [--port <appPort>] [--app-url <url>] [--health <url>]"
                        + " [--collector-port <port>] [--ui-port <port>]"
                        + " [--session <s_xxx|auto>] [--agent <agent.jar>] [--collector <origin|collector.jar>]");
                out.println("       [--ui-dir <workbench 静态目录>] [--jvm-arg <arg>]... [--app-arg <arg>]..."
                        + " [--include <pkg>]... [--exclude <pkg>]... [--include-method <Class#method>]...");
                out.println("       [--no-open] [--no-ui] [--detach]");
                out.println("一条命令启动/复用 collector 与 workbench，用 generic agent 启动应用，"
                        + "推导 s_run_<yyMMddHHmmss> 与主包 INCLUDE，打开“我的应用”页签并内嵌应用。");
                out.println("默认端口: app 8080 / collector 8601 / workbench 5173；分别用 --port、"
                        + "--collector-port、--ui-port 自定义；自定义应用 URL 用 --app-url。");
                out.println("--detach 只是不跟随应用日志；进程仍等待应用退出。--no-ui 不启动界面，--no-open 不打开浏览器。");
                out.println("取值本身以 -- 开头的参数请写成 --app-arg=<值> / --jvm-arg=<值>。");
                break;
            case "idea":
                out.println("用法: idea --jar <app.jar> --agent <agent.jar> [--collector <base>] --session <id> [--port <appPort>]");
                out.println("只打印可粘贴的 IDEA VM options 与步骤清单；不启动进程、不写文件。");
                break;
            case "jar":
                out.println("用法: jar --jar <app.jar> --agent <agent.jar> [--collector <base>] --session <id>"
                        + " [--java <app java>] [--port <appPort>] [--health <url>] [--detach]"
                        + " [--pid-file <path>] [--log-dir <path>]");
                out.println("用指定 JDK 以 -javaagent 启动应用；等待端口/健康最多 30s；日志写 work/logs/。");
                out.println("--detach 就绪后打印 PID=/PID_FILE=/LOG_DIR= 并退出；不加 --detach 则跟随进程。");
                break;
            case "stop":
                out.println("用法: stop --session <s_xxx> | stop --pid-file <path>");
                out.println("--session 读取 work/<session>.pid + work/<session>.services.json，停止应用、本次启动的 collector 与 UI；"
                        + "只停止记录在案且 PID/启动时间匹配的进程，重用的 collector/UI 不停止。");
                out.println("--pid-file 保持原有兼容行为；进程不存在时 NOT_RUNNING（exit 0），PID/命令不匹配时 PID_MISMATCH（exit 3）。");
                break;
            case "preview":
                out.println("用法: preview --target <http://静态HTML> [--port 8602] [--collector <base>] --session <id>"
                        + " [--sdk <path>] [--allow-non-loopback]");
                out.println("只绑 127.0.0.1:<port> 的注入反代：/traceboard/config.js、/traceboard/sdk.js 本地提供，"
                        + "/ingest/v1/events 反代到 collector，其余转发 target 并在 </body> 前注入两个外部脚本。");
                break;
            case "ui":
                out.println("用法: ui --dir <构建后的静态目录> [--port 5173] [--collector <base>] [--app-url <url>]");
                out.println("只绑 127.0.0.1:<port> 提供 workbench 静态文件；给 --collector 时把 GET/HEAD /api/* 反代到 collector；"
                        + "无目录列表、无上传、无外部网络；根路径返回 index.html。");
                break;
            case "diagnose":
                out.println("用法: diagnose [--collector <base>] [--app-url <url>] --session <id> [--preview-url <url>]");
                out.println("七项只读检查（collector_health/collector_meta/app_health/agent_handshake/recent_events/"
                        + "preview_injection/sdk_script），无 --preview-url 时后两项 SKIP；fail=0 → exit 0，任一 FAIL → exit 3。");
                break;
            default:
                out.println("用法: <run|idea|jar|stop|preview|diagnose|ui> ... （--help 查看子命令用法）");
                break;
        }
        out.println();
        out.println("通用: --collector 是 collector origin（默认 http://127.0.0.1:8601），不接受 --ingest/--ingest-url。");
        out.println("退出码: 0 成功/无 FAIL；1 LAUNCHER_ERROR；2 用法/参数非法；3 预期失败（spawn/健康超时/stop 拒绝/diagnose FAIL）。");
    }

    private static void printUsage(PrintStream out) {
        out.println("TraceBoard 1.0.0 本地启动器（launcher）。必须用 JDK21 运行；被调试应用的 JDK 由 --java 指定。");
        out.println();
        out.println("用法: \"$JAVA21/bin/java\" -jar \"server/launcher/target/traceboard-launcher-1.0.0.jar\" <命令> [选项]");
        out.println();
        out.println("命令:");
        out.println("  idea     --jar <app.jar> --agent <agent.jar> [--collector <base>] --session <id> [--port <appPort>]");
        out.println("  run      --jar <app.jar> [--java <jdk java>] [--port <appPort>] [--app-url <url>] [--health <url>]"
                + " [--collector-port <port>] [--ui-port <port>] [--session <s_xxx|auto>]"
                + " [--agent <agent.jar>] [--collector <origin|collector.jar>] [--ui-dir <dir>]");
        out.println("           [--jvm-arg <arg>]... [--app-arg <arg>]... [--include <pkg>]... [--exclude <pkg>]..."
                + " [--include-method <Class#method>]... [--no-open] [--no-ui] [--detach]");
        out.println("  jar      --jar <app.jar> --agent <agent.jar> [--collector <base>] --session <id> [--java <app java>]"
                + " [--port <appPort>] [--health <url>] [--detach] [--pid-file <path>] [--log-dir <path>]");
        out.println("  stop     --session <s_xxx> | --pid-file <path>");
        out.println("  preview  --target <http://静态HTML> [--port 8602] [--collector <base>] --session <id> [--sdk <path>] [--allow-non-loopback]");
        out.println("  ui       --dir <构建后的静态目录> [--port 5173] [--app-url <url>]");
        out.println("  diagnose [--collector <base>] [--app-url <url>] --session <id> [--preview-url <url>]");
        out.println();
        out.println("约定:");
        out.println("  --collector 只收 http://<loopback-host>:<port>（默认 http://127.0.0.1:8601），末尾 / 归一化；旧的 --ingest/--ingest-url 已移除。");
        out.println("  --session 必须匹配 ^s_[A-Za-z0-9_-]+$（如 s_myapp）；run 可省略或用 --session auto 生成 s_run_<yyMMddHHmmss>；stop 用 --session 或 --pid-file。");
        out.println("  端口: 应用默认 8080（--port）、collector 默认 8601（--collector-port）、workbench 默认 5173（--ui-port）；preview 默认 8602。");
        out.println("  只在本机回环工作；无 secret、无外部网络、无 CDN；日志/ PID 仅写 work/**。");
        out.println("退出码: 0 成功/无 FAIL；1 launcher 未预期错误（LAUNCHER_ERROR）；2 用法/参数非法；3 预期失败。");
    }
}
