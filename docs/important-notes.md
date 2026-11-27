# TraceBoard 1.0.0 重要说明

> 本文是 TraceBoard 的正式使用说明，覆盖：适用框架、能采集/不能采集的内容、事件与界面字段含义、安装、启动、工作台使用、排错和安全边界。
>
> 版本：1.0.0｜日期：2026-11-26｜适用：generic 通用模式

## 1. TraceBoard 是什么

TraceBoard 在本机回环地址上运行，用 Java agent 观察一个可执行 Spring Boot 应用：

```text
浏览器点击/请求
  → Controller
  → Service
  → MyBatis Mapper
  → SQL 类型与影响行数
  → 方法参数、返回值、DTO/Map 请求体字段、异常
```

工作台只读取 collector 已保存的事件，**不重发请求、不写业务数据库、不上传数据**。没有采集到的内容会显示为缺口或 `NOT_COLLECTED*` / `LOST`，不会用假数据补齐。

## 2. 适用的框架和程序

### 2.1 正式支持

| 项 | 范围 | 说明 |
|---|---|---|
| 应用类型 | 可执行 Spring Boot JAR | 通过 `java -jar` 启动，内嵌 Tomcat/Jetty 等容器 |
| Spring Boot | 2.x、3.x | 2.x 使用 `javax.servlet`，3.x 使用 `jakarta.servlet` |
| Web 层 | Spring MVC | `@Controller` / `@RestController` 映射方法 |
| Service 层 | Spring Bean + 应用主包 public 方法 | `@Service` / `@Component` / `@Repository` 和自动扫包 |
| 数据访问 | MyBatis | Mapper 接口、Statement id、SQL 类型、影响行数 |
| JDK | 应用：8 / 17 / 21 | TraceBoard 自身需要 JDK 21 |
| 数据库 | 任何 MyBatis 可达的关系型数据库 | 只采集行数与语句 id；不采集 SQL 文本 |
| 前端关联 | 可选浏览器 SDK | `traceparent` + `X-TraceBoard-Click`；不接 SDK 时后端链路仍完整但标 LOST |
| 平台 | Windows 已验证 | Java 核心和浏览器界面可跨平台运行；脚本以 Windows 为主 |

### 2.2 明确不支持

| 场景 | 状态 |
|---|---|
| Spring WebFlux / Reactor | 不支持 |
| JPA / Hibernate 自动生成的 SQL | 不支持 |
| 外部 Tomcat / WAR 一键启动 | 不支持（v1 只做可执行 JAR） |
| 动态 attach 到已运行 JVM | 不支持，必须用 agent 启动 |
| 行级局部变量 | generic 模式不支持 |
| 原始 HTTP 请求体、原始响应体 | 不采集；只采集方法参数/返回值 |
| SQL 文本、绑定参数全文 | 不采集，只采集语句 id、类型、影响行数 |
| Cookie、完整请求头 | 不采集 |
| `@Async` / 线程池上下文自动传播 | 不支持；只继承新建 Thread |
| Kotlin 协程 / 响应式续体 | 未验证，不承诺 |
| 生产级鉴权、TLS、多用户 | 不提供 |

## 3. 系统组成与端口

| 组件 | 默认地址 | 作用 |
|---|---|---|
| agent | 随目标 JVM 启动 | Byte Buddy/ASM 插桩，采集并发送事件 |
| collector | `http://127.0.0.1:8601` | 接收 NDJSON、内存存储、只读查询/回放 |
| launcher | 命令行工具 | 一条命令启动 collector、UI 和目标 JAR |
| workbench | `http://127.0.0.1:5173` | 我的应用 / 追踪台界面 |
| 目标应用 | 默认 `http://127.0.0.1:8080` | 被调试的 Spring Boot JAR |

以上三个端口都可以在 `run` 时独立自定义：`--port`（应用）、`--collector-port`、`--ui-port`。三者必须互不相同。全部服务只绑定回环地址，collector 无 CORS、无鉴权、无 TLS。

## 4. 安装

### 4.1 环境要求

- JDK 21：运行 launcher、collector。
- JDK 8 / 17 / 21：运行被调试应用（按应用自身要求选择）。
- Maven 3.9+：从源码构建 Java 模块。
- Node.js 20+ 和 npm：构建工作台（仅从源码构建时需要）。
- 浏览器：Chrome/Edge 等现代浏览器。

### 4.2 从源码构建

```bash
# 根目录：构建 agent + collector + launcher（JDK21）
mvn -B -q -DskipTests package -pl agent,server/collector,server/launcher -am

# 工作台：本地运行版（workbench/dist）
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

制作便携包时再运行 `npm run build:packaged`，输出 `workbench/dist-packaged/`（不含内置交互示例）。

开发工作台时使用：

```bash
cd workbench
npm ci
npm run dev
```

### 4.3 Windows 便携包

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-windows.ps1
```

输出：

```text
dist/release/TraceBoard-1.0.0-win-x64-portable.zip
dist/release/TraceBoard-1.0.0-win-x64-portable.zip.sha256
```

包内 `README-PORTABLE.txt` 包含同样的安装和启动步骤。

### 4.4 自检

```bash
curl http://127.0.0.1:8601/actuator/health
curl http://127.0.0.1:5173/
```

collector 健康检查应返回 `{"status":"UP"}`。

## 5. 启动和使用

### 5.1 一条命令启动自己的应用

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

启动器会自动：

1. 启动/复用 collector（默认 `8601`，可用 `--collector-port`）；
2. 启动 workbench（默认 `5173`，可用 `--ui-port`）；
3. 从 JAR 的 `Start-Class` / `Main-Class` 推断应用主包，打印 `INCLUDE=...`；
4. 用 generic agent 启动应用（默认端口 `8080`，可用 `--port`）；
5. 生成 `s_run_<时间>` 会话，并打开“我的应用”页签。

### 5.2 常用参数

| 参数 | 作用 |
|---|---|
| `--jar <path>` | 目标 Spring Boot 可执行 JAR |
| `--java <path>` | 目标应用使用的 `java.exe` |
| `--port <port>` | 目标应用端口（默认 8080），同时设置 `-Dserver.port` |
| `--collector-port <port>` | collector 端口（默认 8601）；内置 collector 会用该端口启动 |
| `--ui-port <port>` | workbench 端口（默认 5173） |
| `--app-url <url>` | 嵌入“我的应用”的 URL；默认 `http://127.0.0.1:8080/` |
| `--include <pkg>` | 覆盖自动推断的业务包 |
| `--exclude <pkg>` | 排除噪声包（DTO、getter、第三方库等） |
| `--include-method <class#method>` | 显式采集某个方法；无父帧时可建 `GENERIC_ROOT` |
| `--health <url>` | 等待应用健康检查 URL |
| `--no-open` | 不自动打开浏览器 |
| `--detach` | 启动后返回，服务继续运行 |

三个端口同时自定义示例：

```bat
TraceBoard.cmd run --jar "C:\path\to\your-app.jar" --java "C:/Program Files/Java/jdk-21/bin/java.exe" ^
  --port 18084 --collector-port 8602 --ui-port 5174
```

工作台会带入 `?session=<会话>&app=<应用地址>`。不带 `?session=` 时，本地工作台会自动选择最新会话；静态演示站点保留自己的预置会话。

### 5.3 停止

复制启动日志中的 `STOP=...` 命令执行，或：

```bash
java -jar server/launcher/target/traceboard-launcher-1.0.0.jar stop --session <session-id>
```

日志和 PID 文件在 `work/logs/`、`work/` 下。

### 5.4 手动 agent 接入（不使用 launcher）

```bash
# 1) 启动 collector
java -jar server/collector/target/traceboard-collector-1.0.0.jar

# 2) 启动应用
java \
  -javaagent:/opt/traceboard/traceboard-agent-1.0.0.jar \
  -Dtraceboard.mode=generic \
  -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events \
  -Dtraceboard.sessionId=s_myapp \
  -Dtraceboard.include=com.myapp \
  -jar /opt/app/myapp.jar

# 3) 打开工作台
# http://127.0.0.1:5173/?session=s_myapp
```

### 5.5 可选的前端 SDK

不接 SDK 时，后端链路仍然完整，但请求是 `LOST_BACKEND`（没有前端点击根）。需要“浏览器点击 → 后端请求”精确关联时，接入 `frontend/sdk`，发送 `traceparent` 和 `X-TraceBoard-Click`。详见 `docs/guides/frontend-shallow-plugin.md`。

## 6. 工作台使用说明

### 6.1 页签

- **我的应用**：内嵌你启动的 JAR 服务；从这里操作页面。
- **追踪台**：查看请求列表、链路树、节点详情、字段值和回放。

### 6.2 追踪台区域

| 区域 | 用途 |
|---|---|
| 会话编号 | 切换/刷新会话；本地默认最新会话 |
| 最近请求 | 每个 trace 一行；显示根节点、节点数、耗时、关联状态 |
| 起点横幅 | 说明本次请求从哪个 Controller/方法开始 |
| 请求流程树 | 按父子层级展开展示 controller/service/mapper/sql/前端节点 |
| 节点详情 | 返回、来源、异常、同一方法多次调用、关联方式、线程、原始时间 |
| 采集到的值 | 参数、字段、返回值；含 `截断/脱敏/行号未采集` 标记 |
| 采集缺口 | 明确列出没采到的内容与原因 |
| 时间轴 | 实时/回放切换；每个节点一个关键帧；可调极慢速度 |
| 清空记录 | 可清空当前会话记录；本地只清 collector 内存，静态演示清空浏览器内模拟记录，刷新页面恢复预置快照 |

树上的 `×N` 表示同一 `nodeKey` 被调用多次；详情里可以逐次查看。隐藏“通用插桩叶子”可以过滤 getter/setter 噪声。

## 7. 能采集什么，不能采集什么

### 7.1 能采集

- Controller、Service、Mapper、SQL 节点的父子链；
- 应用主包内 public 方法的进入/退出、参数、返回值；
- 方法抛出的异常类型；
- MyBatis Mapper 语句 id、SQL 类型（SELECT/INSERT/UPDATE/DELETE）、影响行数；
- Map 请求体键值；
- POJO/DTO 的浅层字段（最多 12 个字段，直接读字段，不调用 getter）；
- 新建 Thread 的上下文继承（`ASYNC_INHERITED`）；
- 前端 SDK 的点击/请求事实与 EXACT 关联（可选）；
- 线程、来源文件/行号、耗时、关联置信度、缺口原因。

### 7.2 不能采集

- 行级局部变量（generic v1）；
- 原始 HTTP 请求体/响应体；
- SQL 文本与绑定参数全文；
- Cookie、完整请求头；
- `@Async`、已有线程池、CompletableFuture 的自动传播；
- 框架/第三方库内部方法（默认排除）；
- WebFlux、JPA/Hibernate、外部 Tomcat WAR、动态 attach；
- 业务对错结论（工具只呈现事实）。

## 8. 字段字典

### 8.1 事件字段（schema `traceboard.event.v1`）

| 字段 | 类型 | 含义 |
|---|---|---|
| `schema` | string | 固定 `traceboard.event.v1` |
| `type` | string | 固定 `span` |
| `sessionId` | string | 会话分区，形如 `s_...` |
| `traceId` | string | 32 位小写十六进制链路 id |
| `spanId` | string | 16 位小写十六进制节点 id |
| `parentSpanId` | string/null | 父节点 id；根节点为 null |
| `rootEventId` | string | 前端点击根 id；后端没有前端根时为 `click_lost_...` |
| `kind` | enum | `ui_event/js_method/fetch/controller/service/mapper/sql/jdbc/async/callback/render` |
| `nodeKey` | string | 稳定节点键，如 `com.example.OrderService#submit` |
| `source.file` | string/null | 源码文件（采集不到时为 null） |
| `source.line` | number/null | 源码行号（generic 通常只有入口行） |
| `thread.id` | number | 线程 id |
| `thread.name` | string | 线程名 |
| `startNs` | number | 会话内单调开始时间（纳秒） |
| `durNs` | number | 节点耗时（纳秒） |
| `status` | enum | 方法状态，见 8.6 |
| `reason` | string | 未采集原因；`NOT_COLLECTED_*` 时必填 |
| `return` | object/null | `{type,value}` 返回值；void 为 null |
| `values` | array | 参数/字段/返回值/局部变量事实，见 8.2 |
| `sideEffects` | array | SQL 副作用，见 8.3 |
| `confidence` | enum | 关联置信度，见 8.7 |
| `flags` | string[] | 附加标记，见 8.8 |

### 8.2 `values[]` 字段

| 字段 | 含义 |
|---|---|
| `name` | 参数名、字段名或 `return` |
| `kind` | `param` 参数 / `field` 字段 / `return` 返回值 / `local` 行级局部变量 |
| `line` | 行号；generic 通常为 null |
| `from` | 字段写入前的值（仅字段事实） |
| `to` | 当前值/参数值/返回值 |
| `truncated` | 值是否被长度、数量或预算截断 |
| `redacted` | 是否因敏感名被脱敏 |
| `invocation` | 同一方法多次调用时的第几次 |

### 8.3 `sideEffects[]` 字段

| 字段 | 含义 |
|---|---|
| `type` | 固定 `sql` |
| `sqlId` | MyBatis 语句 id |
| `rowsAffected` | 影响行数；未知时不要当成 0 |
| `transaction` | `COMMITTED/ROLLED_BACK/UNKNOWN`（generic 通常 UNKNOWN） |

### 8.4 请求摘要字段（`GET .../requests`）

| 字段 | 含义 |
|---|---|
| `traceId` | 链路 id |
| `rootSpanId` | 根节点 span id |
| `rootKind` | 根节点类型 |
| `nodeKey` | 根节点方法/路径 |
| `status` | 根节点状态 |
| `confidence` | 前后端关联置信度 |
| `spanCount` | 节点总数 |
| `startedAtNs` | 开始时间（epoch 纳秒） |
| `durNs` | 链路总耗时 |
| `hasError` | 是否有 THREW 节点 |
| `fetchCount` | 前端 fetch 数 |
| `hasFrontend` | 是否有前端事实 |
| `hasBackend` | 是否有后端事实 |
| `backendSpanCount` | 后端 span 数 |

### 8.5 链路图字段（`GET .../graph`）

| 字段 | 含义 |
|---|---|
| `sessionId` / `traceId` | 所属会话/链路 |
| `rootEventId` | 点击根 id |
| `confidence` | 链路级关联置信度 |
| `nodes[]` | 节点数组 |
| `edges[]` | `{from,to,count}` 父子边及次数 |
| 节点 `spanId/parentSpanId` | 节点 id 与父 id |
| 节点 `kind/nodeKey` | 节点类型与稳定键 |
| 节点 `status/return/sideEffects` | 状态、返回值、SQL 副作用 |
| 节点 `startNs/durNs/thread` | 时间、耗时、线程 |
| 节点 `flags/reason/source/confidence/values` | 标记、原因、源码、置信度、值数组 |

### 8.6 `status`

| 值 | 含义 |
|---|---|
| `OK` | 方法正常返回（包括 0、false、空集合） |
| `RETURNED_FALSE` | 正常返回布尔 false |
| `THREW` | 抛出异常 |
| `NOT_COLLECTED_POLICY` | 被采集策略排除 |
| `NOT_COLLECTED_LOST` | 事件/关联丢失 |
| `NOT_COLLECTED_NO_DEBUG_INFO` | 缺少调试信息，无法给局部变量 |
| `TRUNCATED` | 值被截断/折叠/采样 |
| `UNKNOWN` | 进入方法但没有正常退出 |

### 8.7 `confidence`

| 值 | 含义 |
|---|---|
| `EXACT` | `traceparent` + 点击标记完整，前后端精确关联 |
| `INFERRED` | 只靠时间/路径等指纹推断（generic v1 不常用） |
| `LOST` | 只有一端（后端无前端根，或前端无后端） |
| `MANUAL` | 用户手工关联（如后续支持） |

### 8.8 常见 `flags`

| 标记 | 含义 |
|---|---|
| `SDK_ACTIVE` | 事件由浏览器 runtime SDK 采集 |
| `S3_RUNTIME_SDK` | SDK 的兼容阶段标记 |
| `OBSERVE_MS=n` | 点击观察窗毫秒数 |
| `S2_ZERO_ROW_CHAIN` | 旧演示链路的兼容标记 |
| `S3_EXACT_LINK` | 前端请求与后端精确关联 |
| `LOST_BACKEND` | 只有后端、没有前端点击根 |
| `TRACEPARENT_ONLY` | 只有 traceparent，没有点击标记 |
| `GENERIC` | 通用模式采集的业务事件 |
| `GENERIC_AUTO` | 应用主包自动扫包的 public 方法 |
| `GENERIC_INCLUDED` | `--include-method` 显式指定的方法 |
| `GENERIC_ROOT` | 没有上层调用时由显式方法建立的根 |
| `ASYNC_INHERITED` | 新 Thread 在创建时继承了上下文 |
| `EXCEPTION=Type` | 方法抛出的异常类型；不含 message |
| `SQL_SELECT/INSERT/UPDATE/DELETE` | SQL 类型；不含 SQL 文本 |
| `RETURN_TRUNCATED` | 返回值超出预算被截断 |
| `ARGS_CAPPED=n` | 参数列表因预算被丢弃 n 个 |
| `VALUES_CAPPED=n` | 值项因预算被折叠 n 个 |
| `VALUES_TOTAL=n` | 折叠前的值项总数（旧演示） |
| `DROP_COUNT=n` | 发送队列累计丢弃事件数；0 表示未丢弃 |
| `NO_DEBUG_INFO` | 缺少调试信息（旧 L2 演示） |
| `L1` / `L2` | 旧演示的采集层级标记 |
| `SAMPLED` | 该节点经过采样 |
| `SOURCE_MAPPED` | 源码位置来自构建清单 |

### 8.9 会话、元数据、回放和握手字段

| 字段 | 含义 |
|---|---|
| `sessionId` | 会话 id |
| `eventCount` | 会话事件总数 |
| `startedAtMs` / `lastEventAtMs` | 会话开始/最后事件时间（epoch 毫秒） |
| `service` | 固定 `traceboard-collector` |
| `version` | collector 版本，1.0.0 起为 `1.0.0` |
| `apiVersion` | HTTP API 版本，当前 `v1` |
| `schema.id` / `schema.version` / `schema.dialect` | 事件 schema 标识、版本和 JSON Schema 方言 |
| `capabilities.health` | 是否提供健康检查 |
| `capabilities.meta` | 是否提供元信息 |
| `capabilities.ingestEvents` | 是否接收事件 |
| `capabilities.realtime` | 是否实时推送（当前 false） |
| `capabilities.replay` | 是否支持只读回放（当前 true） |
| `replay.mode` | 回放模式 |
| `replay.readOnly` | 回放只读标记 |
| `replay.fromNs` / `replay.toNs` | 请求的回放窗口（原始时间） |
| `replay.events[]` | `{seq,event}` 已存事件窗口 |
| `seq` | collector 存储序号，不属于事件体 |
| `accepted` / `rejected` / `dropped` | ingest 接收、拒绝、丢弃数量 |
| `errors[].line/code/message` | ingest 拒绝行号、错误码、说明 |
| `connected` | agent 是否已握手连接 |
| `pid` | 被调试应用进程 id |
| `lastSeenMs` | agent 最近一次握手时间 |
| `agent.version` | agent 版本 |
| `agent.startedAtMs` | agent 启动时间 |

### 8.10 界面提示

- `起点未采集`：没有找到点击根，只有后端事实。
- `前后端未关联`：后端链路正常，但没有前端点击/请求根（`LOST`）。
- `前端采集（sdkActive）未接入`：会话没有启用前端 SDK。
- `未采集`：字段/行号/值不在采集范围内；不是 0，也不是 false。
- `行号未采集`：generic 值没有行级位置。
- `截断`：值超出长度/数量预算，界面只显示摘要。
- `×N`：同一方法被调用多次，详情可逐次查看。

## 9. 采集预算

| 预算 | 默认值 |
|---|---|
| 单链路最大 span 数 | 256 |
| 单节点最大值项 | 64 |
| 单字符串最大长度 | 512 |
| 列表/Map 最多展示 | 8 项 |
| 值嵌套深度 | 64 |
| DTO 字段摘要 | 最多 12 个字段、只读一层 |
| 单事件 values JSON | 48 KiB |

超出预算时会出现 `ARGS_CAPPED`、`VALUES_CAPPED`、`RETURN_TRUNCATED` 或 `truncated=true`，不会静默丢弃。可通过 `-Dtraceboard.maxValues` 等参数调整。

## 10. 故障排查

| 现象 | 检查 |
|---|---|
| `TraceBoard.cmd` 找不到 launcher | 先构建 launcher，或使用便携包 |
| 应用没启动 | `--java` 是否匹配应用 JDK；看 `work/logs/<session>-app.log` |
| 只有 Controller，没有 Service/Mapper | `INCLUDE=` 是否是业务包；Mapper 是否被 MyBatis 代理；看 agent 日志 |
| 自动扫包太吵 | `--exclude com.myapp.model`，或界面过滤 |
| 没有 EXACT | 是否接入 SDK；`traceparent` 与 `X-TraceBoard-Click` 是否同源发送 |
| 看不到局部变量 | generic v1 不支持行级局部变量 |
| 看不到 SQL 文本 | 设计边界：只采集语句 id 和行数 |
| 应用返回 404 | 确认访问的是应用真实路径；内嵌 iframe 需要页面可嵌入 |
| 端口被占用 | 应用用 `--port`，collector 用 `--collector-port`，界面用 `--ui-port`；三个端口不能相同 |
| 页面仍是旧缓存 | `Ctrl+F5` 强刷 |

## 11. 安全与隐私

- 仅本机开发使用；不要连接生产数据库或真实敏感数据。
- 采集的参数/字段值保存在本机内存和日志中；不做云端上传/遥测。
- collector 无鉴权/TLS/CORS；不要绑定到公网地址。
- 工作台回放只读：不重发请求、不写业务数据库。
- 本地“清空记录”会调用 `DELETE /api/v1/sessions/{sessionId}`，只删除本机 collector 内存中的该会话事件（保留会话 id）；不影响业务库，不能撤销。
- 公网静态演示没有后端，点击示例会在浏览器内追加一条**模拟请求**（克隆预置链路，时间戳为当前时间），不代表真实采集；清空只删除这些模拟记录，刷新页面恢复预置快照。
- 需要分享链路时，请先清理包含密码、Token、个人数据的日志/截图。

## 12. 版本与兼容

- 当前正式版本：`1.0.0`。
- 事件 schema：`traceboard.event.v1`（字段向后兼容）。
- 旧开发阶段代码和测试样例归档在：<https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool_back>。
- 机器可读事件契约见 `schema/traceboard.event.v1.json`；旧版详细 API/事件契约已归档到 back 仓库。