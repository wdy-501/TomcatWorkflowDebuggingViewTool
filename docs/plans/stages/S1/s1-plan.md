# S1 实施计划（s1-plan）

> 阶段：S1（MVP，walking skeleton）｜版本：v1.1（2026-11-23 G1 第 1 轮返工）｜作者：plan-writer
> 上游：`docs/plans/stages/S1/dispatch.md`（绑定简报）、`docs/plans/SOLO-PLAN.md` S1 行 + §4、主计划 §2.3/§8.1–8.3/§9.1–9.2/§13/§15(P0)/§16
> 下游：coder-backend、coder-frontend、tester、acceptance（**G1 PASS 后生效**；本文件与 S1 契约/fixture 冻结后只读）
> 契约：`docs/contracts/api.v1.md` §7、`transport.v1.md` §4.5（第 8 条）/§6.1、`event-model.v1.md` §5 第 2 条例外；fixture：`fixtures/s1-walking-skeleton/**`

## 1. 目标与验收映射

S1 只证明两件事：**一条假事件从“点击/请求”走到工作台** + **一个真实插桩的 controller span 能被采集并读回**。

| 分发书 §1 信号 | 本计划落点 | 证据（owner） |
|---|---|---|
| 1 ingest 真可用 | §6.3–§6.4（202/400/413/415、逐行、幂等、内存 append-only） | tester T3–T6；coder-backend 冒烟日志 |
| 2 查询真可用 | §6.5（sessions/events、seq/nextSeq、404/400/405） | tester T7 |
| 3 agent 真插桩 | §7（唯一方法 `#cancel`、LOST、fail-open） | tester T9–T10；agent 单行 transform 日志 |
| 4 工作台闭环 | §8（按钮 → 2 条假事件 → 读回 → 原始事件表） | tester T11；orchestrator 浏览器证据 |
| 5 main 可运行 | §12–§13（根 reactor、demo `-javaagent`、workbench） | tester T2；acceptance 重跑 |
| 6 契约/测试同步 | 契约 S1 章节 + 本计划 + fixtures + test-report | G1 哈希；T13 漂移检查 |

## 2. 范围

### 2.1 范围内（6 项交付，见分发书 §2.1）

plan-writer（本文件 + 契约 + `fixtures/s1-walking-skeleton/**`）→ coder-backend（collector ingest/查询/meta + agent 单方法）→
coder-frontend（workbench S1 面板 + 代理）→ tester（`tools/verify` S1 门禁 + test-report）→ acceptance（README/进度/归档/tag）。

### 2.2 明确不做（S2 边界，越界即失败）

1. 不插桩 service/mapper/SQL/JDBC/其它 Controller 方法；无行数、SQL 文本/参数、`sideEffects`、`values`。
2. 无前后端关联：无浏览器 SDK、无 `traceparent`/clickId 传播、无关联引擎、无游离区合并、无手工关联写接口。
3. workbench 不做图/时间轴/回放/请求切换/节点详情/×N/拖拽/SSE/WebSocket/持续轮询/像素回放。
4. collector 不落 DB/文件、不鉴权、不 CORS、不 429 背压、不采样淘汰、不做 graph/replay/stream/links 路由。
5. 不改 `schema/traceboard.event.v1.json`（v1 冻结）；不新增事件类型；不写第二份手写 schema。
6. 不改 demo 业务/前端；不引入 launcher/cloud/Tomcat/React/MySQL；不做 L1/L2 值采集、sourcemap、构建插件。

## 3. 前置与冻结输入

1. G1 PASS（`docs/plans/stages/S1/plan-review.md`），本文件、`docs/contracts/{api,transport,event-model}.v1.md`、`fixtures/s1-walking-skeleton/**` 冻结。
2. 环境（分发书 §8，不得改写）：Windows 10 + Git Bash；仓库路径含中文与空格，所有路径/命令双引号；
   Maven 3.9.5；默认 `JAVA_HOME`=JDK1.8.0_221；JDK21=`C:/Program Files/Java/jdk-21`；Node 22/npm 10；端口 8601/8080/5173/5174。
3. 开工记录冻结哈希：

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
sha256sum "schema/traceboard.event.v1.json" "docs/contracts/api.v1.md" "docs/contracts/transport.v1.md" \
  "docs/contracts/event-model.v1.md" \
  "fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson" \
  "fixtures/s1-walking-skeleton/agent-controller-span.json" \
  "fixtures/s1-walking-skeleton/expected-facts.json" "docs/plans/stages/S1/s1-plan.md" > /tmp/s1-freeze.sha256
netstat -ano | grep -E ":(8601|8080|5173|5174)" || true
```

## 4. 文件地图与所有权（零交集）

| 路径前缀 | owner | S1 新增/修改 |
|---|---|---|
| `docs/contracts/**`、`fixtures/s1-walking-skeleton/**`、`docs/plans/stages/S1/s1-plan.md` | plan-writer | api/transport 的 S1 章节 + `event-model` §5 第 2 条例外（仅文档）；3 个 fixture 文件 + README；本文件 |
| `pom.xml`、`agent/**`、`server/collector/**` | coder-backend | collector：`ingest/`、`store/`、`query/`、schema 拷贝；agent：`TraceAgent`、`CancelAdvice`、`SpanEmitter`、`EventSender`、`AgentConfig` |
| `workbench/**` | coder-frontend | `src/api.ts`、`src/s1/*`、`components/S1Panel.vue`、`vite.config.ts` 代理 |
| `tools/verify/**`、`docs/plans/stages/S1/test-report.md` | tester | `verify-s1.mjs`（或扩展 `verify.mjs`） |
| `README.md`、`docs/plans/stages/S1/{acceptance.md,progress.md}`、archive、git | acceptance | 启动顺序、`-javaagent`、commit + tag `s1-baseline` |
| `schema/**`、`fixtures/case-a-zero-rows/**`、`demo/**`、S0 文档 | 冻结 | 只读（demo 只加启动参数，不改代码） |

## 5. 共享契约摘要（实现不得漂移）

| 项 | S1 取值 |
|---|---|
| ingest | `POST /ingest/v1/events`，仅 `application/x-ndjson`；判定序 `415→413→400→逐行`；202 `{accepted,rejected,dropped,errors[]}` |
| 查询 | `GET /api/v1/sessions` → `{"sessions":[{"sessionId","eventCount","startedAtMs","lastEventAtMs"}]}`；`GET .../events?afterSeq=0&limit=200` → `{"events":[{"seq":1,"event":{...}}],"nextSeq":1}` |
| 参数 | `limit` 1–500（默认 200）、`afterSeq>=0`（默认 0）；非法 400；未知 session 404；非 GET 405 |
| `seq` | 传输/存储元数据，**在 event 对象之外**；event 逐字返回且仍过 schema；ingest 拒收带 `seq` 的行 |
| meta | `health=true, meta=true, ingestEvents=true, realtime=false, replay=false` |
| 术语 | 查询 = “会话查询/只读读取”，**不叫回放**；回放/实时仍未实现 |
| 事件 | 唯一后端事件见 `fixtures/s1-walking-skeleton/agent-controller-span.json`；唯一前端假批次见 `frontend-fake-batch.ndjson` |
| 游离后端根 | agent span 是 `parentSpanId=null` + `kind=controller` + `confidence=LOST` + `rootEventId=click_lost_<spanId>` + flag `LOST_BACKEND` 的**游离后端根**；语义见 `event-model.v1.md` §5 第 2 条例外与 `transport.v1.md` §4.5 第 8 条；collector 不判关联，UI 按 `LOST` 显示为游离/未归属 |

## 6. Collector 设计（coder-backend）

### 6.1 依赖与构建

- Spring Boot 3.2.12 / Java 21（根 reactor，`JAVA_HOME` 就地覆盖）；端口 8601、仅 `127.0.0.1`；产物路径不变。
- 校验库锁 **`com.networknt:json-schema-validator:1.0.87`**（Boot 3.2.12 管理 Jackson 2.15.4）。
  若其传递 Jackson 与 BOM 冲突：用 `exclusion` + BOM 管理版本，或同族相邻补丁版本，**不得**改写手校验/第二份 schema；仍不可行 → `BLOCKED`。
- schema 单源：`maven-resources-plugin:3.3.1` 把 `${project.basedir}/../../schema` 拷到 `target/classes/schema/`；
  **禁止**在 `server/collector/src/main/resources` 放 schema 副本；运行时用 `getResourceAsStream("/schema/traceboard.event.v1.json")` 一次性加载。
- 启动即校验 schema 可编译（`JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)`），失败则 collector 起不来并打印明确错误（不静默降级）。

### 6.2 类结构（建议，命名可微调）

`web/IngestController`、`web/SessionsController`、`web/MetaController`（改 capabilities）、`web/ApiErrors`（统一信封）；
`ingest/IngestService`（信封判定+逐行）、`ingest/LineResult`；`store/EventStore`（ConcurrentHashMap + per-session 锁）、
`store/SessionLog`（有序 List、幂等 Set、first/lastMs）、`store/StoredEvent`（`seq` + 原样 `JsonNode`）。无 repository/DB 包。

### 6.3 ingest 流水线（顺序固定）

1. `Content-Type` 不含 `application/x-ndjson`（大小写不敏感，允许 `; charset=utf-8`）→ `415`。
2. 读取：先看 `Content-Length`（>4MB 立即 413），再按字节读入有界缓冲（上限 4MB+1）；超限 → `413`。
3. 切行：按 `\n`；**先量尺寸**：任一行（去行尾 `\n` 的原始字节）>64KB → `413`（尺寸判定先于信封 400）。
4. 信封 400：**body 含 `\r` → 400**；任一非末段为空/纯空白 → 400；末段必须为 `""`（末行缺 `\n` → 400）；行数 >1000 → 400。
5. UTF-8 严格解码失败 → `400`。
6. 逐行：Jackson `ObjectMapper.readTree`（开启 `FAIL_ON_TRAILING_TOKENS`）→ 非对象/解析失败 → `rejected/invalid_json`；
   networknt 校验冻结 schema → 失败 → `rejected/schema_violation`（`errors[].line` 1 基，message ≤200 且不回显原文）。
7. 幂等：`(sessionId,traceId,spanId)` 已存在（含同批内重复）→ `dropped`；否则加锁追加并分配 `seq`。
8. 返回 `202 {accepted,rejected,dropped,errors}`；恒有 `accepted+rejected+dropped == 行数`。

### 6.4 存储与并发

- `ConcurrentHashMap<String, SessionLog>`；每个 `SessionLog` 内含 `ArrayList<StoredEvent>`、`HashSet<String>`（幂等键）、
  `firstMs`、`lastMs`，写操作 `synchronized`（先查后插，`seq = list.size()+1`）。
- 读：在锁内复制 `List` 引用/子区间（不可变快照），不阻塞写、不改 `seq`；`startedAtMs`/`lastEventAtMs` 用 collector 墙钟（Unix ms）。
- 无淘汰、无持久化、无文件；内存上限风险在 §10 明示（S1 接受，测试串行）。

### 6.5 查询

- `GET /api/v1/sessions`：空存储 `{"sessions":[]}`；排序 `startedAtMs` 升序、同值时 `sessionId` 字典序。
- `GET /api/v1/sessions/{sessionId}/events`：`afterSeq`/`limit` 以字符串接收并严格解析（空串/非整数/负数/`limit∉[1,500]` → 400 信封）；
  过滤 `seq > afterSeq`，取前 `limit` 条，包成 `{"seq":n,"event":<原样>}`；`nextSeq` = 本页最后 `seq`，空页 = `afterSeq`。
- 未知 session → 404 `{"error":"not_found","message":"...","apiVersion":"v1"}`；写动词 → 405（Boot 默认体）；
  `/graph`、`/replay`、`/stream`、`/ws/v1/events`、`/links` **不注册**（自然 404）。

### 6.6 meta / 禁止项

- `capabilities` 改 `ingestEvents=true`，其余保持 `false`；`service/version/apiVersion/schema` 不变。
- 禁止：CORS 配置/`@CrossOrigin`、DB/文件、429、actuator 其他端点、任何 graph/replay/stream/links 路由、手写第二份 schema。

### 6.7 Spike（先行验证，先于功能联调）

- 构建后 `unzip -l` 确认 jar 内 `BOOT-INF/classes/schema/traceboard.event.v1.json` 存在（单源拷贝生效）。
- 启动 collector，用 1 行合法事件 + 1 行非法事件验证 202 计数与 `errors[].line`；确认 2020-12 方言真的生效
  （反例：`confidence` 非法值必须 `rejected`，证明不是“全放行”）。
- 记录 networknt/Jackson 实际解析版本到 test-report（`mvn -pl server/collector dependency:tree` 输出 `json-schema-validator` 与 `jackson-databind` 版本行作为 Central 证据）。

## 7. Agent 设计（coder-backend）

### 7.1 打包

- `net.bytebuddy:byte-buddy:1.14.19`（Java 8 基线）；`maven-shade-plugin:3.5.3` 打 fat jar，
  relocate `net.bytebuddy` → `io.traceboard.agent.shaded.net.bytebuddy`；`maven.compiler.release=8`；jar 名/路径不变。
- MANIFEST：用 shade 的 `ManifestResourceTransformer` 写入 `Premain-Class: io.traceboard.agent.TraceAgent` +
  `Implementation-Title/Version`（避免 jar-plugin 与 shade 双写导致丢失）；禁止 `Agent-Class`。
- 零额外依赖（不引 `byte-buddy-agent`，不做 attach）；JSON 用手写紧凑序列化（不引 Jackson）。
- 构建卫生：shade 显式设 `<createDependencyReducedPom>false</createDependencyReducedPom>`（默认 `true` 会在 `agent/` 落未跟踪的
  `dependency-reduced-pom.xml`，污染仓库）；若插件仍生成，由 acceptance 在 `.gitignore` 覆盖（`.gitignore` 仅 acceptance 可写）。

### 7.2 插桩（唯一方法）

- `AgentBuilder.Default().disableClassFormatChanges()`；
  `ignore(nameStartsWith("java.").or(nameStartsWith("jdk.")).or(nameStartsWith("sun.")).or(nameStartsWith("org.springframework."))
  .or(nameStartsWith("net.bytebuddy.")).or(nameStartsWith("io.traceboard.agent.")).or(isSynthetic()))`；
  `type(named("com.example.shop.controller.OrderController"))` + `Advice.to(CancelAdvice.class).on(named("cancel").and(takesArguments(long.class)))`。
- `CancelAdvice`（public static，`@Advice.OnMethodEnter/OnMethodExit(onThrowable=Throwable.class)`，`@Advice.Return(readOnly=true) Object`、
  `@Advice.Thrown(readOnly=true) Throwable`）：进入取 `System.nanoTime()`，退出调用 `SpanEmitter.emit(enterNs, ret, thrown)`；
  Advice 内 **不 new 任何应用对象、不调用业务 getter、不抛异常**。
- 不重定义已加载类、不碰 JDK/Spring 类、不插桩第二个方法。

### 7.3 事件字段（必须与 `agent-controller-span.json` 同形）

| 字段 | 取值 |
|---|---|
| `sessionId` | `-Dtraceboard.sessionId`，须匹配 `^s_[A-Za-z0-9_-]+$`，否则回退 `s_s1_agent` |
| `traceId` | `-Dtraceboard.traceId`（32 位小写 hex）或每 span 随机 32 位 hex（S1 不关联） |
| `spanId` | 随机 16 位小写 hex |
| `parentSpanId` | `null`（游离根） |
| `rootEventId` | `"click_lost_" + spanId`（合成占位，`^click_[A-Za-z0-9_-]{8,}$`，不伪装真实点击） |
| `kind` / `nodeKey` | `controller` / `com.example.shop.controller.OrderController#cancel` |
| `source` | 从 `new Throwable().getStackTrace()` 找 `className == 目标类` 的帧：`{file: getFileName(), line: getLineNumber()}`；文件名 null 或行号 <0 时**整体省略** `source`（不猜）。Advice 在方法**退出**取栈，`line` 是退出点而非声明行，**不要求可复现**，tester 只断言文件名 |
| `thread` | `{id: Thread.currentThread().getId(), name: getName()}` |
| `startNs` | `System.nanoTime() - premainNanos`，负数归 0 |
| `durNs` | `exitNs - enterNs`，≥0（实际 >0） |
| `status` | `thrown == null ? "OK" : "THREW"`（S1 不采集异常 payload） |
| `return` | 正常：`{"type": ret==null ? "void" : ret.getClass().getName(), "value": null}`；异常：`null` |
| `confidence` | 固定 `LOST` |
| `flags` | 固定 `["SKELETON","S1_ONE_METHOD","LOST_BACKEND"]` |

- 不写 `reason`/`values`/`sideEffects`；事件必须过冻结 schema（`additionalProperties:false`，14 个必填键齐全）。

### 7.4 传输（fail-open）

- `ArrayBlockingQueue<byte[]>(16)` + 单守护线程（`traceboard-agent-sender`）：`take()` → `HttpURLConnection`
  POST 单行 NDJSON（`Content-Type: application/x-ndjson; charset=utf-8`，`setFixedLengthStreamingMode`），
  connect 300ms / read 700ms，**1 次尝试、不重试**，读完响应 ≤8KB 后关闭。
- **每行必须以 `\n` 结尾**（`transport.v1.md` §4.2：末行缺 `\n` → 整批 400；缺换行会变成静默丢事件）。发送前断言 payload 末字节为 `0x0a`。
- 队列满：`offer` 失败 → `dropped.incrementAndGet()` 并 stderr 打印 `[traceboard-agent] dropped=<n> reason=queue_full`（首次 + 每 100 次，不静默）；
  该计数是**有界队列（容量 16）的唯一丢弃来源**，只出现在日志，不写进事件 flags（见下方缺口说明）。
- 非 202 响应（400/413/415/5xx/连接失败）：`ingestRejected.incrementAndGet()` 并按同样节流频率打印
  `[traceboard-agent] ingest_rejected=<n> status=<code|io_error>`（只记状态码，不回显响应体）；1 次尝试、不重试，仍是 fail-open。
- 已知缺口（不静默、记入 §14-D16）：`event-model` §7 要求丢弃以 `DROP_COUNT` 或 `NOT_COLLECTED_LOST + reason` 进事件；
  S1 agent flags 固定 3 项，丢弃/拒绝只在 stderr 计数，由 tester 用日志证据核对，`DROP_COUNT` 写入事件留待 S2。
- 所有 `Throwable` 吞掉（premain/Advice/sender 三层 try-catch）；`Runtime.getRuntime().addShutdownHook` 关闭队列并最多等 1s 排空。
- 配置：`-Dtraceboard.ingestUrl`（默认 `http://127.0.0.1:8601/ingest/v1/events`）、`-Dtraceboard.sessionId`、`-Dtraceboard.traceId`。

### 7.5 Spike：Boot fat-jar 类加载可见性（硬门）

- 目的：证明 demo 的 `LaunchedURLClassLoader` 能把 Advice 内联代码里的 agent helper（`SpanEmitter`）解析到系统类加载器（agent jar）。
- 做法：先实现“transform 命中一行日志 + 一条**真实调用触发**的最小事件（字段按 §7.3 构造）”，用 §13.4 命令启动 demo，`POST /api/orders/1/cancel`，
  断言：①日志出现一次 `transformed com.example.shop.controller.OrderController`；②collector 收到 1 条 controller span；③demo 响应仍 200。
- 失败（未命中 / `NoClassDefFoundError` / 应用起不来）→ **`BLOCKED` + 日志证据**；**不得**退回“合成启动事件”或 noop 冒充。
  （可选缓解：Advice 内联代码只引用 JDK 类型，helper 调用固化为静态方法；先验证再继续。）

### 7.6 启动命令（demo 后端，JDK8）

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"   # 固定绝对路径，不依赖 PATH
"$JAVA8" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s1_agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
```

- JDK8 路径固定为 `"C:/Program Files/Java/jdk1.8.0_221/bin/java"`（分发书 §8 已固定；本机已确认存在），不依赖 PATH 恰为 JDK8；
  `"$JAVA8" -version` 应先输出 `1.8.0_221`。E2E 命令（§13.4）使用同一个 `JAVA8` 变量。
- 该命令必须原样写入交付说明（README 由 acceptance 写，coder 在交付消息里给出）。

## 8. Workbench 设计（coder-frontend）

### 8.1 S1 面板行为（一次点击 = 一批）

- 按钮 `#btn-s1-fake`「发送 S1 假点击」；每次点击用 `crypto.getRandomValues` 生成新 `traceId`（32 hex）、`rootEventId`（`click_`+16 hex）、
  两个 `spanId`（16 hex）；`sessionId` 固定 `s_wb_demo`（读回路径固定，见 §14-D8）。
- 两条事件与 `frontend-fake-batch.ndjson` 同形：`ui_event #btn-s1-fake`（`parentSpanId=null`，`startNs=0`，`durNs=12000000`）→
  `fetch POST /api/orders/1/cancel`（`parentSpanId=click.spanId`，`startNs=2000000`，`durNs=10000000`，`return={"type":"http","value":200}`）；
  两条均 `status=OK`、`confidence=EXACT`、`flags=["SKELETON","S1_WALKING_SKELETON"]`。
- 提交：`POST /ingest/v1/events`（相对路径走代理），body = 两行紧凑 JSON + 末行 `\n`，`Content-Type: application/x-ndjson`。
- 读回（**有界一次**，先取计数再读**尾页**，保证新点击在累计 >200 条后仍可见）：
  1. `GET /api/v1/sessions` 取 `s_wb_demo` 的 `eventCount`（无该会话按 0）；
  2. `GET /api/v1/sessions/s_wb_demo/events?afterSeq=max(0, eventCount-200)&limit=200`（`afterSeq` 由 `eventCount` 推导，不写死 0）；
  3. 若返回 0 条且刚收到 202，允许 300ms 后重做 1 次（1)+(2)，共 ≤2 次；
  4. 若 `nextSeq < eventCount`（读回期间又有新写入，或分页未覆盖全部），UI 明示“仅显示最近一页”，不得静默隐藏最新事件。
  **不做持续轮询**（§14-D9）；工作台只读，不写 `afterSeq` 以外的查询参数。

### 8.2 渲染与错误态

- 展示：ingest `accepted/rejected/dropped/errors[]`；`sessionId`、`eventCount`、`startedAtMs/lastEventAtMs`；原始事件表列
  `seq / type / kind / status / nodeKey`；`nextSeq`。不画图、不画时间轴、不做节点详情、不做回放控件。
- 读回范围只有 `s_wb_demo`（假批次）；agent span（`s_s1_agent`）不在 S1 面板展示。若将来展示任何 `confidence=LOST` 事件，
  必须标为游离/未归属，**不得**画成点击链的一环（`transport.v1.md` §4.5 第 8 条）。
- 固定横幅：`walking skeleton: fake frontend events; one real backend controller span; no correlation yet`。
- 错误态：网络失败（collector 未起）显示「collector 不可达：http://127.0.0.1:8601（请先启动 collector）」；非 2xx 显示状态码 + 错误信封
  `message`；不崩、不静默；不自动重试写请求。
- 保留 S0 `FixturePanel`（事件数 9、5 张事实卡、`DROP_COUNT=0`）。

### 8.3 Vite 代理与类型

```ts
server: {
  port: 5173, strictPort: true,
  proxy: {
    "/ingest": { target: "http://127.0.0.1:8601", changeOrigin: false },
    "/api": { target: "http://127.0.0.1:8601", changeOrigin: false },
  },
}
```

- 新增 `src/api.ts`：`IngestError{line:number;code:string;message:string}`、`IngestResponse{accepted,rejected,dropped,errors:IngestError[]}`、
  `SessionSummary{sessionId:string;eventCount:number;startedAtMs:number;lastEventAtMs:number}`、`SessionsResponse{sessions:SessionSummary[]}`、
  `StoredEvent{seq:number;event:EventRow}`、`EventsPage{events:StoredEvent[];nextSeq:number}`；复用 `fixtures.ts` 的 `EventRow`。
- 禁止：CORS 配置、绝对 URL（必须相对路径）、SSE/WS/EventSource、图库、调 demo 后端、改 S0 fixture、自动上报。

## 9. 测试计划（tester）

一次命令、非 0 即 FAIL；串行起停进程并在 `finally` 兜底 `taskkill /PID <pid> /T /F`；临时文件只写 `os.tmpdir()`。

| # | 检查 | 期望（精确） |
|---|---|---|
| T0 | S0 回归 | 现有 `verify.mjs` 项（schema/fixture/构建/agent major=52）保持 PASS |
| T1 | S1 fixture | 2 行 + 1 对象均过 schema；`expected-facts.json` 8 条 fact 由 **S1 门禁**消费（`globalAssertions.<source>` 新形状；S0 V1b 的 5 fact 门禁不动）；反例（事件内加 `seq`）必须被拒 |
| T2 | 构建 + schema 字节等价 | 根 reactor（JDK21）、workbench `npm ci && npm run build`、demo 后端（JDK8）exit 0；`unzip -p "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" "BOOT-INF/classes/schema/traceboard.event.v1.json" \| sha256sum` 与 `sha256sum "schema/traceboard.event.v1.json"` **逐字相等**；`agent/` 下不存在 `dependency-reduced-pom.xml` |
| T3 | ingest 正例 | 新 collector + fixture → `202 {accepted:2,rejected:0,dropped:0,errors:[]}`；`sessions` 含 `s_wb_demo` `eventCount=2`、`startedAtMs>0`、`lastEventAtMs>=startedAtMs`；事件页 2 条 `seq=1,2`、`nextSeq=2`、`event` 内**无** `seq` 且逐条过 schema |
| T4 | 幂等 | 重发同批 → `{accepted:0,rejected:0,dropped:2}`；`eventCount` 仍 2；`seq` 仍 1,2 |
| T5 | 混合批 | 3 行（合法 / 非法 JSON / schema 违规）→ `{accepted:1,rejected:2}`，`errors` 2 条 `line=2,3`，message ≤200 且不含原文 |
| T6 | 信封负例 | 无/错 Content-Type → 415（含超大 body 时仍 415）；空 body/空行/1001 行/末行缺 `\n`/含 `\r` → 400；单行 65KB → 413；body >4MB → 413 |
| T7 | 查询 | `limit=1`→1 条 `nextSeq=1`；`afterSeq=1`→`seq=2`；`afterSeq=2`→空 `nextSeq=2`；`limit=501/0`、`afterSeq=-1/abc`→400；未知 session→404；`POST /api/v1/sessions`→405；`PUT .../events`→405；`GET .../graph\|replay\|stream`→404 |
| T8 | meta | `capabilities` 恰为 `{health:true,meta:true,ingestEvents:true,realtime:false,replay:false}`；`schema.id=urn:traceboard:schema:event:v1` |
| T9 | agent 在线 | collector + demo（§7.6 命令）→ `POST /api/orders/1/cancel` 得 `{"data":true}`；≤10s 内 `s_s1_agent` 出现 1 条新事件：`kind=controller`、`nodeKey=...#cancel`、`status=OK`、`confidence=LOST`、`parentSpanId=null`、`rootEventId=click_lost_+spanId`、3 个 flags、`durNs>0`、`return.type` 非空、`source.file`（若存在）为 `OrderController.java`（**只断言文件名**；`source.line` 不可复现，不比较）；再请求一次 → 2 条且 `spanId` 不同 |
| T10 | fail-open | 停 collector → `POST cancel` 仍 200 且耗时 <3000ms；demo 进程存活；恢复 collector 后可继续采集 |
| T11 | workbench | build 绿；dist 含固定横幅、`#btn-s1-fake`；`vite.config.ts` 含 `/ingest` 与 `127.0.0.1:8601`；读回按 `eventCount` 推导 `afterSeq`（源码无固定 `afterSeq=0&limit=200` 字面量）；无 `EventSource`/`WebSocket` 实例化、无图库依赖、无回放视图组件；S0 `FixturePanel` 仍在（`F1..F5`、`操作成功`） |
| T12 | 无 S2 扫描 | agent/collector/workbench 源码无 service/mapper/jdbc/sql 探针、无 traceparent/关联、无 DB 依赖；`server/collector/src/main/resources` 无 schema 副本 |
| T13 | 漂移/安全 | §3 哈希不变；agent jar `major=52`、`Premain-Class` 正确、shaded 包存在且无未 relocate 的 `net/bytebuddy`；无 secret/真实数据/外链 |

- 证据：`docs/plans/stages/S1/test-report.md` 写环境版本、逐项 PASS/FAIL、复现命令、构建/冒烟输出摘要、进程已停声明。
- 禁止：改产品代码/契约/fixture、放宽断言、常驻服务、git。

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Byte Buddy 在 Boot fat jar 下看不见目标类 / relocate 失败 | 插桩不生效或应用起不来 | §7.5 spike 先行；失败 `BLOCKED` 附日志；禁止合成事件冒充 |
| Byte Buddy 版本与 Java 8 不兼容 | agent 编成 major>52 或运行期异常 | 锁 1.14.19；`--release 8`；tester 断言 major=52 |
| networknt 1.0.87 与 Boot 3.2 Jackson 2.15 冲突 | 启动失败/校验异常 | 先 `dependency:tree` 验证；必要时 exclusion/同族补丁；不改手写校验/第二份 schema |
| 2020-12 方言未真正启用 | schema 空转（全放行） | 反例断言：非法 `confidence`/多字段必须 `rejected`（T5） |
| 异步发送 timing / 队列丢弃 | 读回偶发为空或丢事件 | 轮询 ≤10s（tester 侧）；队列 16、300/700ms、1 次尝试；丢弃与非 202 均打印计数；测试串行 |
| `-javaagent` 路径含空格/中文 | demo 起不来 | 命令双引号；`-javaagent:"<abs jar>"`；先 `java -version` 核对 JDK8 |
| Vite 代理 IPv6（`[::1]`） | 代理连不上 | target 固定 `http://127.0.0.1:8601`；浏览器统一 `localhost:5173` |
| 端口占用（8601/8080/5173） | 起停失败/误判 | 先 `netstat` 诊断记录；`strictPort:true`；不静默改端口 |
| CRLF/BOM 回归 | 行被 `rejected` 或 400 | 契约明确 body 含 `\r` → 400；fixture 校验 LF；tester 保留 `\r` 断言 |
| 内存无淘汰 | 长时间演示增长 | S1 接受（仅本地、测试串行）；README 注明“重启即清空” |
| `seq`/幂等竞态 | 重复或跳号 | per-session 锁 + 先查后插；T4 验证 |
| 契约漂移（nodeKey、`{seq,event}`、查询≠回放、游离后端根） | G1/验收 FAIL | 本文件 §14 显式记录；T13 哈希；reviewer 冻结 |

## 11. 回滚

1. 只在 acceptance 持有 git 写权；S1 绿后打 `s1-baseline`，失败不 tag。
2. 代码回滚：`git revert <s1-commit>`（保留历史）；或用 `git checkout s0-baseline -- "<path>"` 还原单文件（仅 acceptance 执行，不用 `reset --hard`/`clean -f`）。
3. 运行期回滚（不改代码）：去掉 `-javaagent` 与 `-D` 参数重启 demo → 回到 S0 行为；collector 停服即无影响。
4. 契约回滚：api/transport 的 S1 章节是**追加型**，`git checkout s0-baseline -- "docs/contracts/api.v1.md" "docs/contracts/transport.v1.md"` 即可恢复；无数据迁移（collector 不持久化）。
5. fixture 回滚：`fixtures/s1-walking-skeleton/**` 为新增目录，删除前必须回 G1 流程（不得静默删改冻结文件）。
6. 越界/失败处置：命中 §2.2 或 `BLOCKED` 条件即停止并上报，不降级放行、不“先提交再说”。

## 12. 步骤与顺序（门禁）

`plan-writer（本交付）→ plan-reviewer（G1）→ coder-backend ∥ coder-frontend → tester → acceptance（G2）`

- **Step 0（本次）**：契约 S1 章节 + 3 fixture + 本计划 → G1 评审；FAIL 最多返工一轮。
- **Step 1 coder-backend**：①collector 依赖/schema 单源拷贝（§6.1）→ 构建；②ingest（§6.3–6.4）→ T3–T6 口径冒烟；
  ③查询/meta（§6.5–6.6）→ T7–T8 口径冒烟；④agent spike（§7.5）；⑤agent 完整（§7.1–7.4）；⑥`-javaagent` 端到端（§7.6）→ 交付命令与日志摘要。
- **Step 2 coder-frontend（与 Step 1 并行）**：①`vite.config.ts` 代理 + `api.ts`；②S1 面板 + 读回 + 错误态；③保留 S0 面板；
  ④`npm ci && npm run build` 绿 → 交付构建输出与 dist 抽查。
- **Step 3 tester**：按 T0–T13 一次执行；写 `test-report.md`；退出码 0。
- **Step 4 acceptance（G2）**：重跑 tester 与 §13；漂移/越界/安全检查；写 README/acceptance/progress；按文件名 `git add` + commit + tag `s1-baseline`。
- S1 检查点到达即停；**不得开始 S2**。

## 13. 精确命令（仓库根，路径双引号）

### 13.1 构建

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "workbench" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)
```

若 demo 报 `invalid target release: 21`：`mvn -v` 不是 JDK8，按上面覆盖 `JAVA_HOME` 重跑（不改 `java.version`）。

### 13.2 collector 起停 + 契约冒烟

```bash
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:8601/actuator/health" >/dev/null && break; sleep 1; done
curl -s "http://127.0.0.1:8601/api/v1/meta"
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson"
curl -s "http://127.0.0.1:8601/api/v1/sessions"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200"
# 期望：capabilities.ingestEvents=true / 202 accepted=2 / s_wb_demo eventCount=2 / 2 条 {seq,event} nextSeq=2
# 停止：kill %1；netstat -ano | grep ":8601" 确认无监听
```

### 13.3 负例与边界（示例）

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/json" --data-binary '{}'   # 415
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson" --data-binary ''    # 400
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?limit=501"   # 400
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/events"             # 404
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions"                       # 405
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/replay"              # 404
```

### 13.4 agent 端到端（collector 已起）

```bash
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"   # 固定绝对路径（N9），不依赖 PATH
"$JAVA8" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s1_agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://localhost:8080/api/orders" >/dev/null && break; sleep 1; done
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s1_agent/events?afterSeq=0&limit=200"
# 期望：{"data":true} / 1 条 kind=controller、nodeKey=...#cancel、confidence=LOST、flags 三项
# 期望（stderr）：成功时无 dropped=/ingest_rejected= 新增行；失败时按 §7.4 节流打印，不得静默
```

### 13.5 产物证据

```bash
unzip -p "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" META-INF/MANIFEST.MF | grep -i "Premain-Class"
javap -verbose -classpath "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" io.traceboard.agent.TraceAgent | grep "major version"
unzip -l "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" | grep "schema/traceboard.event.v1.json"
# schema 字节等价（jar 内 vs 仓库根）：两条 sha256 必须逐字相同
unzip -p "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" "BOOT-INF/classes/schema/traceboard.event.v1.json" | sha256sum
sha256sum "schema/traceboard.event.v1.json"
test ! -f "agent/dependency-reduced-pom.xml" && echo "no dependency-reduced-pom.xml"
(cd "tools/verify" && npm ci && node verify.mjs)
```

## 14. 偏离记录（相对 `dispatch.md`；均由本计划收敛，不扩范围）

| ID | 事项 | 处理与理由 |
|---|---|---|
| D1 | dispatch §4.4/§5.1 的 agent `nodeKey` 写作 `OrderController#cancelOrder`（沿用 S0 **虚构**方法名） | 改为 `com.example.shop.controller.OrderController#cancel`：真实源码是 `cancel(long)`；用不存在的名字会让“真实插桩”与事实不符。S0 fixture 保持冻结不改 |
| D2 | dispatch §4.2 把 `seq` 附加在事件对象内 | 改为 `{"seq":n,"event":{...}}` 包装：`seq` 是传输元数据，放进事件会违反 `additionalProperties:false`，事件也不再“逐字 schema 合法” |
| D3 | dispatch §4.2 的 sessions 条目只有 `sessionId/startedAtMs/eventCount` | 增加 `lastEventAtMs`（会话最后一条事件的 collector 墙钟），供工作台显示“是否还在长” |
| D4 | dispatch §4.4 未要求 `source`，且其 `return` 为 `{type:"object",value:{class,httpStatus}}` | 事件带 `source{file,line}`（来自栈帧，可用则写、不可用则省略）；`return` 改为 `{type:<返回类 FQCN>, value:null}`（S1 无值采集、不反射业务 getter） |
| D5 | dispatch §4.4 的 agent `flags` 为 2 项 | 3 项 `["SKELETON","S1_ONE_METHOD","LOST_BACKEND"]`（“只有后端一端”是 S1 的关键事实，需显式标记）；假批次为 `["SKELETON","S1_WALKING_SKELETON"]` |
| D6 | dispatch §5.1 的 fixture 文件名为 `click-fetch-batch.jsonl` / `agent-controller-span.jsonl` | 采用 `frontend-fake-batch.ndjson` / `agent-controller-span.json`（假批次是 NDJSON；agent span 是单对象文件，同时是合法 1 行 NDJSON） |
| D7 | dispatch §4.5 的假批次时序是点击 `startNs=0/durNs=5000000`、fetch `startNs=1000000/durNs=3000000`（`[1ms,4ms] ⊆ [0,5ms]`，**本来就嵌套成立**）；原记录误引为“点击 `durNs=1000000`、fetch `[2ms,12ms]` 越界”，引述失准（G1 N2） | 统一改为点击 `0/12000000`、fetch `2000000/10000000`（`[2ms,12ms] ⊆ [0,12ms]`，机器复核成立）：理由是毫秒刻度更易读、fetch 时长贴近一次真实请求、工作台与 fixture 使用同一组数值；**不是**修正越界。fixture 字节不变 |
| D8 | 本阶段任务未指定假批次 `sessionId`，而工作台固定读回 `s_wb_demo` | fixture 与工作台统一用 `s_wb_demo`；每次点击仍换新 `traceId/spanId/rootEventId`（行不重复、幂等不被误触发）。dispatch §4.5 的 `s_s1_ui_<base36>` 不再使用 |
| D9 | dispatch §2.2 禁止 workbench “轮询”，而验收要求“读回” | 定义为**一次有界读回**（1 次 `GET /api/v1/sessions` 取 `eventCount` + 1 次事件尾页 GET，仅在刚 202 且结果为空时 300ms 后重做 1 次，共 ≤2 轮），不是持续轮询/实时订阅（§8.1） |
| D10 | dispatch §3 未锁版本，只要求“plan 中锁定并记录证据” | 锁 `com.networknt:json-schema-validator:1.0.87`（Boot 3.2.12 / Jackson 2.15.4）；Byte Buddy 锁 `1.14.19`；两者都要在 spike 中实证 |
| D11 | `event-model.v1.md` §5 第 2/3 条（“`parentSpanId=null` 仅用于操作根”“所有事件共用同一 `rootEventId`”）与 dispatch §4.4 的 LOST 游离根冲突；S1 契约层原先没有这条形状 | **G1 第 1 轮裁决（方案 A，仅文档）**：`event-model.v1.md` §2/§5/§7/§9/§11 增加“游离后端根”**唯一例外**（`kind=controller` + `parentSpanId=null` + `confidence=LOST` + 合成 `rootEventId=click_lost_<spanId>` + flag `LOST_BACKEND`，主计划 §8.3）；`transport.v1.md` §4.5 第 8 条记录同一语义；schema 与 fixture **字节未变**。原记录声称“已在 `transport` §4.5 记录”**不成立**（评审 B1 指出的引用失实），以本次修订为准 |
| D12 | dispatch §3 允许 shade 用 `maven-jar-plugin` 写 MANIFEST | 改由 shade `ManifestResourceTransformer` 写 `Premain-Class`（jar-plugin 与 shade 双写会丢条目），tester 仍以 `unzip -p` 断言 |
| D13 | dispatch §4.1 未规定 body 含 `\r` 的处理 | 明确 `\r` → 400（CRLF 是格式错误，不宽容剥离），写入 `api.v1.md` §7.1 与 `transport.v1.md` §4.5 |
| D14 | dispatch §5.1 要求 expected-facts “可被现有校验器消费” | S1 expected-facts 是**新增形状**：`facts[]` 与 `pathSyntax` 沿用 S0，但全局键下沉到 `globalAssertions.<source>`，每条 fact 增加 `source`（两个互不关联的来源无法用 S0 顶层单值键表达）。`tools/verify/verify.mjs` 的 V1b 按硬编码 case A 路径读取且要求恰好 5 条 fact，**不可直接消费**；由 tester 在 S1 门禁新增消费器，S0 V1b 不改（见 §9-T1 与 fixture README §3） |
| D15 | dispatch §4.5 的假点击 `nodeKey="#btn-cancel"` | 改为 `#btn-s1-fake`，与 §8.1 的按钮 id 同名：工作台只提供一个 S1 假按钮，fixture 与 DOM id 必须一致，避免“契约里的按钮不存在”；S0 fixture 不受影响 |
| D16 | `event-model` §7 要求任何丢弃以 `DROP_COUNT` 或 `NOT_COLLECTED_LOST + reason` 进事件 | S1 agent 只在 stderr 计数（`dropped=`/`ingest_rejected=`，见 §7.4），不写 `DROP_COUNT` flag（agent flags 固定 3 项）；本阶段以日志 + T10 证据代替，`DROP_COUNT` 写入事件留待 S2（丢弃仍有计数、不静默） |

## 15. 完成定义（S1 出口）

- 本文件 + api/transport 的 S1 章节 + `event-model` §5 第 2 条例外 + 3 个 S1 fixture 经 G1 PASS；fixture 每行过冻结 schema（已离线验证；schema 与 fixture 字节未因本轮返工改变）。
- coder-backend/coder-frontend/tester 清单全绿；`tools/verify` 的 S1 门禁一次退出码 0。
- T3–T13 有 PASS 证据；`-javaagent` 命令可复跑；collector 停机不影响 demo。
- README/UI/报告统一标注：walking skeleton；fake frontend events；one real backend controller span；**no correlation yet**；
  service/mapper/SQL 未采集；无图/无回放/无实时。
- acceptance 在 `master` 上留可回滚 commit + tag `s1-baseline`；不 push、不 force；不开始 S2。

## 16. 变更记录

| 日期 | 版本 | 变更 | 触及文件 |
|---|---|---|---|
| 2026-11-23 | v1 | 首版：S1 契约增补、3 个 fixture、本计划（含 D1–D13 偏离） | api.v1.md、transport.v1.md、fixtures/s1-walking-skeleton/**、本文件 |
| 2026-11-23 | v1.1 | **G1 第 1 轮返工**：B1（`event-model` §2/§5/§7/§9/§11 增“游离后端根”唯一例外；`transport` §4.5 第 8 条；`api` §7.5 一句；D11/README 引用失实纠正）+ N1–N9 低风险项（D7 理由纠正、D14 expected-facts 形状、D15 nodeKey、D16 丢弃可见性、尾页读回、发送侧 `\n`/非 202 计数、`source.line` 只断言文件名、shade `dependency-reduced-pom`、schema 字节等价、JDK8 绝对路径）。**schema 与 fixture 字节未变** | event-model.v1.md、transport.v1.md、api.v1.md、fixtures/s1-walking-skeleton/README.md、本文件 |
