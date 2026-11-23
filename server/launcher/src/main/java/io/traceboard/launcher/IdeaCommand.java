package io.traceboard.launcher;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * {@code idea}: print pasteable IDEA VM options plus a checklist. Never spawns a process and
 * never writes files (stdout only).
 */
final class IdeaCommand {

    int run(String[] argv) throws LauncherException {
        Args args = Args.parse(argv);
        String session = Args.session(args);
        String collector = Urls.collectorOrigin(args.get("--collector"));
        Path jar = requireExisting(args.require("--jar"), "JAR_NOT_FOUND",
                "demo jar 不存在；先构建 demo 后端: JAVA_HOME=\"$JAVA8\" mvn -B -q -DskipTests package -f \"demo/buggy-shop-boot-vue/backend/pom.xml\"。");
        Path agent = requireExisting(args.require("--agent"), "AGENT_NOT_FOUND",
                "agent jar 不存在；先构建: JAVA_HOME=\"$JAVA21\" mvn -B -q -DskipTests package -pl \"agent\" -am。");
        int port = args.port("--port", 8080);

        String ingestUrl = collector + "/ingest/v1/events";
        String vmOptions = "-javaagent:\"" + Util.fwd(agent) + "\""
                + " -Dtraceboard.ingestUrl=\"" + ingestUrl + "\""
                + " -Dtraceboard.sessionId=" + session;

        StringBuilder out = new StringBuilder();
        out.append("TraceBoard launcher (S4) — IDEA VM options（粘贴到 Run/Debug → VM options，不是 Program arguments）:\n\n");
        out.append(vmOptions).append("\n\n");
        out.append("步骤:\n");
        out.append("1) 先启动 collector，并确认健康: curl -s \"").append(collector).append("/actuator/health\" 返回 UP。\n");
        out.append("2) IDEA 打开应用（").append(Util.fwd(jar)).append("），Run/Debug Configurations → VM options 粘贴上面那一行")
                .append("（-javaagent 与 -D 必须在程序参数之前；不要放进 Program arguments）。\n");
        out.append("3) 启动应用（端口 ").append(port)
                .append("），确认握手: curl -s \"").append(collector).append("/api/v1/sessions/").append(session)
                .append("/agent\" → connected:true（404 = agent 未加载/collector 未先启动/session 不一致）。\n");
        out.append("4) 预览注入（目标必须是静态 HTML，例如 127.0.0.1:18080 的页面；不要指向 demo 后端 8080 或 Vite 5174）:\n");
        out.append("   \"$JAVA21/bin/java\" -jar \"server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar\" preview")
                .append(" --target \"http://127.0.0.1:18080\" --collector \"").append(collector)
                .append("\" --session \"").append(session).append("\"\n");
        out.append("5) 工作台 http://127.0.0.1:5173 选同一 session（").append(session)
                .append("），点 #btn-cancel（案例 A）或 #btn-save-b（案例 B）。\n");
        out.append("\n说明: idea 不启动任何进程、不写文件、不改系统环境；预览 session 必须与 -Dtraceboard.sessionId 一致，")
                .append("否则前后端事件无法关联。\n");
        System.out.print(out);
        System.out.flush();
        return Launcher.EXIT_OK;
    }

    private static Path requireExisting(String raw, String token, String advice) throws LauncherException {
        Path path = Util.abs(raw);
        if (!Files.exists(path) || Files.isDirectory(path)) {
            throw LauncherException.failed(token, "文件不存在: \"" + Util.fwd(path) + "\"；" + advice);
        }
        return path;
    }
}
