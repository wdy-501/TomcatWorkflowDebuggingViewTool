# TraceBoard 1.0.0

TraceBoard 是一个本地、只读的 Java 全链路调试工具。它把一次浏览器请求经过的 Controller、Service、MyBatis Mapper、SQL、参数/返回值、Map/DTO 请求体字段和异常放到同一棵树上，并给出可以回放的时间轴。没有采集到的内容会明确标记为缺口，不用假数据补齐。

- 适用：Spring Boot 2.x / 3.x 可执行 JAR，JDK 8 / 17 / 21，Spring MVC + MyBatis。
- 不适用：WebFlux、JPA/Hibernate SQL、外部 Tomcat WAR、动态 attach、行级局部变量。
- 运行：全部服务只绑定 `127.0.0.1`；不重发请求、不写业务数据库、不上传数据。
- 版本：`1.0.0`（2026-11-26）

## 功能

- **一条命令启动**：`TraceBoard.cmd run --jar your-app.jar` 自动启动 collector、workbench 和你的应用。
- **自动包推断**：从 Spring Boot JAR 的 `Start-Class` 推断业务包并自动插桩；支持 `--include` / `--exclude` / `--include-method` 收窄。
- **真实链路**：Controller → Service → Mapper → SQL，保留节点父子关系、耗时、线程和异常类型。
- **值摘要**：参数、返回值、Map 请求体和普通 DTO 的字段值；不调用 getter/toString。
- **工作台**：我的应用 / 追踪台双页签，请求列表、树形链路、节点详情、字段值、缺口说明、慢放回放和关键帧。
- **最新在前**：请求列表按开始时间倒序；选中旧请求时自动滚动到可见位置。
- **清空记录**：本地运行时可一键清空当前会话的 collector 内存事件，不触碰业务数据库。
- **诚实边界**：LOST、NOT_COLLECTED、TRUNCATED、ARGS_CAPPED 等状态都可解释；界面不做业务对错裁判。
- **静态演示**：GitHub Pages 站点提供预置采集快照，不连接本地 collector。

## 支持范围

| 项 | 支持 |
|---|---|
| 应用类型 | 可执行 Spring Boot JAR（内嵌容器） |
| Spring | Boot 2.x（javax）/ Boot 3.x（jakarta），Spring MVC |
| JDK | 应用 JDK 8 / 17 / 21；TraceBoard 自身用 JDK 21 |
| 数据访问 | MyBatis Mapper、SQL 类型与影响行数 |
| 请求体 | Controller 方法参数中的 Map / POJO/DTO 字段；不采集原始 HTTP body |
| 前端关联 | 可选 SDK：`traceparent` + `X-TraceBoard-Click` 精确关联 |
| 本地平台 | Windows 已验证；Java 核心与浏览器界面可跨平台运行 |

完整支持矩阵、采集/不采集项、字段字典和安装步骤见 **[重要说明](docs/important-notes.md)**。

## 快速开始（源码）

### 1. 构建

需要 JDK 21、Maven 3.9+、Node.js 20+（构建工作台时）。

```bash
mvn -B -q -DskipTests package -pl agent,server/collector,server/launcher -am

cd workbench
npm ci
npm run build
cd ..
```

产物：

```text
agent/target/traceboard-agent-1.0.0.jar
server/collector/target/traceboard-collector-1.0.0.jar
server/launcher/target/traceboard-launcher-1.0.0.jar
workbench/dist/
```

打包 Windows 便携版时再运行 `npm run build:packaged`，产物为 `workbench/dist-packaged/`。

### 2. 启动自己的应用

Windows：

```bat
TraceBoard.cmd run --jar "C:\path\to\your-app.jar" --java "C:/Program Files/Java/jdk-21/bin/java.exe"
```

跨平台：

```bash
java -jar server/launcher/target/traceboard-launcher-1.0.0.jar \
  run --jar "/path/to/your-app.jar" \
  --java "/path/to/jdk/bin/java.exe"
```

启动后打开：

- 我的应用：`http://127.0.0.1:5173/#app`（默认 UI 端口；内嵌你的服务）
- 追踪台：`http://127.0.0.1:5173/#board`（默认 UI 端口；自动选择最新会话）

常用参数：

```text
--port <port>            应用端口（默认 8080；同时设置 -Dserver.port）
--collector-port <port>  collector 端口（默认 8601；自动启动内置 collector）
--ui-port <port>         workbench 端口（默认 5173）
--app-url <url>          内嵌到“我的应用”的地址（默认 http://127.0.0.1:8080/）
--include com.myapp      覆盖自动推断的业务包
--exclude com.myapp.dto  排除噪声包
--include-method com.myapp.OrderService#submit
--health <url>           等待应用健康检查
--no-open                不自动打开浏览器
--java <path>            应用使用的 java.exe
```

三个端口可同时自定义，例如：

```bat
TraceBoard.cmd run --jar "C:\path\to\your-app.jar" --java "C:/Program Files/Java/jdk-21/bin/java.exe" ^
  --port 18084 --collector-port 8602 --ui-port 5174
```

停止：复制启动日志里的 `STOP=...` 命令执行，或：

```bash
java -jar server/launcher/target/traceboard-launcher-1.0.0.jar stop --session <session-id>
```

日志：`work/logs/`。

## Windows 便携包

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-windows.ps1
```

输出 `dist/release/TraceBoard-1.0.0-win-x64-portable.zip`。运行包内 `TraceBoard.cmd`；需要 JDK 21 启动 TraceBoard，被调试应用使用 JDK 8/17/21。

## 项目结构

```text
agent/              Java agent：generic 插桩、值采集、事件发送
server/collector/   Collector：事件接收、只读查询、回放
server/launcher/    Launcher：run/ui/stop/diagnose
workbench/          Vue 3 工作台
frontend/sdk/       可选的浏览器 runtime SDK
frontend/build-plugin/
schema/             事件 schema
docs/               正式文档
site/               静态演示站点构建与发布说明
scripts/            启动与打包脚本
```

旧阶段计划、测试样例、fixtures 和开发记录已迁移到 [备份仓库](https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool_back)。主仓库只保留 1.0.0 正式运行代码、文档和静态演示产物。

## 文档

- [重要说明：支持范围、字段字典、采集边界](docs/important-notes.md)
- [1.0.0 发布说明](docs/releases/v1.0.0.md)
- [调试自己的 Spring Boot 项目](docs/guides/use-your-project.md)
- [前端 SDK / Vite 插件](docs/guides/frontend-shallow-plugin.md)
- [事件 schema](schema/traceboard.event.v1.json)

## 安全与边界

TraceBoard 是本地开发工具，不是生产 APM：

- 不提供鉴权、TLS、CORS、云端上传、多用户隔离。
- 采集到的参数和字段值会保存在本机内存与日志中；不要直接连接生产敏感数据。
- 不采集行级局部变量、SQL 文本、原始响应体、Cookie。
- 自动扫包会带来 getter/setter 噪声，可用 `--exclude` 或界面过滤收窄。

## License

MIT