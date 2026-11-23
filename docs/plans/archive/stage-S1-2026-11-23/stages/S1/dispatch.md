# S1 Walking Skeleton · 任务分发书（dispatch）

> 阶段：S1（MVP，walking skeleton）｜角色：task-dispatch｜日期：2026-11-23｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md`（S1 行、§3/§4/§7）、`docs/plans/00-master-plan.md` §2.3/§8.1-8.3/§9.1-9.2/§13/§15(P0)/§16、S0 冻结契约与 fixture。
> 本文件是 S1 六个下游子代理的唯一任务输入；除 dispatcher 外任何人不得修改本文件。**S1 只做 walking skeleton，不做 S2 事实链。**

## 0. 通用规则（所有人）

1. 一个子代理只执行一张卡：只读「输入」、只写「输出」，其余路径一律只读；路径含中文/空格，命令与路径必须双引号，从仓库根执行。
2. **只有 acceptance 可写 git**（add/commit/tag）；其他人禁止任何 git 写操作、禁止 push/force/rebase。
3. 需要越界、契约缺口、指标不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改一下”。
4. 不用 secret/真实数据；不换第三方镜像；不自动下载仅 GitHub 提供的资源；所有依赖走 Maven Central/npm 官方源。
5. 未做/未验证的能力标“S1 骨架 / 未采集 / S2 待做”，不得写成“已支持”；不得用合成启动事件冒充真实插桩（见 §10）。
6. 契约在 G1 后冻结；S1 只允许本文件 §4 列出的变更，schema v1 字段不变。

## 1. S1 目标与验收信号（SOLO-PLAN S1 行 + 本阶段口径）

| 项 | 原文/口径 |
|---|---|
| 主要工作 | agent 最小插桩 + 一条事件；collector mock/ingest；工作台 fixture 板；点击/请求假事件 |
| 完成信号 | **一条假事件从“点击/请求”到工作台；main 可运行** |
| 建议范围 | MVP |

S1 收尾必须同时证明（缺一即 FAIL）：

1. **ingest 真可用**：NDJSON `POST /ingest/v1/events` 按 §4.1 返回 202/400/413/415，逐行 schema 校验、幂等去重、内存 append-only 存储，无 DB/文件。
2. **查询真可用**：`GET /api/v1/sessions` 与 `GET /api/v1/sessions/{sessionId}/events?afterSeq=&limit=` 返回真实存储数据；未知 session 404；仅 GET。
3. **agent 真插桩**：Byte Buddy 对 demo 的 `OrderController` 取消方法**唯一一个**方法插桩，方法退出时发出 1 条 `controller` span；collector 停机不破坏 demo（fail-open）；不是 noop、不是合成启动事件。
4. **工作台闭环**：S1 面板按钮 → 2 条 schema 合法假事件 NDJSON → collector → 读回 sessions/events → 渲染原始事件表（seq/type/kind/status/nodeKey）+ session id/计数；S0 fixture 事实面板保留。
5. **main 可运行**：根 reactor、demo 后端（含 `-javaagent` 启动）、workbench 全部可构建可启动；acceptance 在 `master` 上留可回滚 commit + tag `s1-baseline`。
6. **契约/测试同步**：api/transport 状态与 S1 章节更新、S1 fixtures 与测试报告齐备，无静默漂移。

## 2. 范围

### 2.1 S1 范围内（6 项交付）

| # | 交付 | owner |
|---|---|---|
| 1 | 契约状态更新 + S1 章节 + `fixtures/s1-walking-skeleton/**` + `s1-plan.md` | plan-writer |
| 2 | collector ingest + sessions/events 查询 + meta capabilities + schema 构建期单源拷贝 | coder-backend |
| 3 | agent Byte Buddy 单方法插桩 + 单事件 HTTP 发送 + fail-open 传输 | coder-backend |
| 4 | workbench S1 假点击/请求面板 + Vite `/ingest`、`/api` 代理 + 原始事件表 | coder-frontend |
| 5 | 扩展 `tools/verify`（S1 门禁）+ 测试报告 | tester |
| 6 | README（`-javaagent` 启动）、进度包、S1 验收、归档、commit+tag | acceptance |

### 2.2 S1 明确不做（S2 边界；越界即失败）

- 不插桩 service/mapper/SQL/JDBC/其它 Controller 方法；不做行数、SQL 文本/参数、JDBC 探针、`sideEffects` 采集。
- 不做前后端真实关联：无浏览器 SDK、无 traceparent/clickId 传播、无 correlation engine、无游离区合并、无手工关联写接口。
- workbench 不做图/时间轴/回放/请求切换/节点详情/×N/拖拽/SSE/WebSocket/轮询；不做浏览器像素回放。
- demo 业务不改（不植入 0 行缺陷），demo 前端不改；collector 不落 DB/文件、不鉴权、不做 CORS、不做 429 背压。
- 不实现 graph/replay/stream/links 端点（保持 RESERVED，路由不得注册）；不做 launcher/cloud/Tomcat/React/MySQL。
- 不改 `schema/traceboard.event.v1.json` 字段/枚举/约束；不新增事件类型；不写第二份手写 schema。
- 不做 L1/L2 值采集、异常 payload 契约、sourcemap、构建插件、多请求聚合。

## 3. 架构与构建决策（强制，不得协商）

| 项 | 决策 |
|---|---|
| 构建 | 根 reactor 用 JDK21（`JAVA_HOME="C:/Program Files/Java/jdk-21"`）；agent `--release 8`；demo 后端用默认 JDK8 独立构建；版本保持 `0.1.0-SNAPSHOT`（产物路径不变） |
| collector | Spring Boot 3.2.12 / Java 21，仅 `127.0.0.1:8601`；新增 ingest 与两个只读查询；无 CORS、无 DB、无文件 |
| schema 单源 | 唯一 schema = `schema/traceboard.event.v1.json`；collector 用 `maven-resources-plugin` 在构建期把根 `schema/` 拷入 `target/classes/schema/`，**不得**在 `src/main/resources` 放副本；运行时只读 classpath 这一份 |
| schema 校验库 | `com.networknt:json-schema-validator`（支持 draft 2020-12；plan 中锁定确切版本并记录 Central 证据）；若与 Boot 3.2 的 Jackson 管理版本冲突，可降/升同族版本，但**不得**改为手写校验或第二份 schema；仍不可行则 `BLOCKED` 附证据 |
| ingest 实现 | 控制器手动检查 `Content-Type`/大小/行数（不依赖 `consumes` 自动 415，以保证统一错误信封）；原始 body 按字节读取；逐行 Jackson 解析 + networknt 校验；内存存储 |
| 存储 | `ConcurrentHashMap<sessionId, 会话记录>`；每 session 一个 append-only `List` + 幂等 `Set<(sessionId,traceId,spanId)>`；`seq` 从 1 连续递增；`startedAtMs` 取该 session 首条被接收事件的 collector 墙钟；无淘汰、无持久化 |
| agent 插桩 | Byte Buddy `AgentBuilder` + `Advice`（进入记 `System.nanoTime()`，退出计算 `durNs`）；只匹配 `com.example.shop.controller.OrderController` 的 `cancel(long)`；`disableClassFormatChanges`，不重定义已加载类，不碰 JDK/框架类 |
| agent 打包 | Byte Buddy（1.14.x，Java 8 基线）经 `maven-shade-plugin` 打入 agent jar 并 relocate `net.bytebuddy` → `io.traceboard.agent.shaded.net.bytebuddy`；MANIFEST 保留 `Premain-Class: io.traceboard.agent.TraceAgent`；`major version=52` |
| agent 发送 | JDK8 `HttpURLConnection`；单守护线程 + `ArrayBlockingQueue`（容量 16）；每事件一批 NDJSON；connect 300ms / read 700ms；**1 次尝试、无重试**；队列满丢弃并 stderr 计数（不静默）；所有 `Throwable` 吞掉，绝不影响宿主 |
| agent 配置 | `-Dtraceboard.ingestUrl`（默认 `http://127.0.0.1:8601/ingest/v1/events`）、`-Dtraceboard.sessionId`（默认 `s_s1_agent`，非法则回退默认）、`-Dtraceboard.traceId`（可选 32 位小写 hex） |
| workbench | 沿用 Vue3+TS+Vite+Pinia；`server.proxy` 增加 `/ingest` 与 `/api` → `http://127.0.0.1:8601`（IPv4 字面量，避免 `[::1]`）；`strictPort:true`；不配 CORS |
| 端口 | collector 8601、workbench 5173、demo 8080、demo 前端 5174；统一 `localhost` 访问，代理 target 用 `127.0.0.1` |

## 4. 共享契约（下游一律按此实现；细节由 plan-writer 落入契约/S1 fixtures）

### 4.1 `POST /ingest/v1/events`

- 仅接受 `application/x-ndjson`（可带 `; charset=utf-8`，大小写不敏感）；其它 → **415** 错误信封。无查询参数、无必须 header。
- 校验顺序固定：**415 → 413 → 400 → 逐行**（保证测试确定性）。
- **413**：body > 4MB，或任一行（去掉行尾 `\n` 的原始字节）> 64KB。
- **400**（信封非法，整批拒绝）：空/纯空白 body；含空行/纯空白行；行数 > 1000；末行缺少 `\n`；body 非 UTF-8。
- **202**：`{"accepted":N,"rejected":M,"dropped":K,"errors":[{"line":i,"code":"...","message":"..."}]}`；`line` 1 基；`errors` 仅覆盖被拒行（code 至少 `invalid_json`、`schema_violation`；message ≤200 字符、不回显原文/敏感值）。
- 逐行校验：合法行接收，非法行计入 `rejected`，**不得**整批 400；合法行照常入库。
- 幂等键 `(sessionId, traceId, spanId)`：已存在（含同一批内重复）→ `dropped`，不报错、不改写已存内容。
- 存储为内存 append-only，按接收顺序分配连续 `seq`；重复行不消耗 `seq`；无 DB/文件/网络依赖。

### 4.2 只读查询（query，不是 replay）

- `GET /api/v1/sessions` → `200 {"sessions":[{"sessionId":"s_...","startedAtMs":<int>,"eventCount":<int>}]}`；按 `startedAtMs` 升序、`sessionId` 次序稳定；空存储返回空数组。
- `GET /api/v1/sessions/{sessionId}/events?afterSeq=<int>&limit=<1..500>`：`afterSeq` 默认 0；`limit` 默认 200；非法/越界 → 400 错误信封（不静默截断）。
- 响应 `200 {"events":[...],"nextSeq":<int>}`：`events` 为存储事件按 `seq` 升序；**每条事件对象附带查询专用只读字段 `seq`**（不属于事件 schema，ingest 仍拒绝带 `seq` 的行）；其余字段逐字返回。`nextSeq` = 本页最后一条的 `seq`，本页为空时 = `afterSeq`。
- 未知 session → **404** 错误信封 `{"error":"not_found",...}`；仅 GET，POST/PUT/PATCH/DELETE → 405（Boot 默认响应体可接受）；不存在 graph/replay/stream/links 路由。
- 契约文案必须写“会话查询/只读读取”，**不得**称为回放；回放能力仍为 false。

### 4.3 `GET /api/v1/meta`

`capabilities` 必须为：`health=true, meta=true, ingestEvents=true, realtime=false, replay=false`；其余字段（service/version/schema）不变。

### 4.4 agent controller span（唯一后端事件）

| 字段 | S1 取值 |
|---|---|
| `schema`/`type` | `traceboard.event.v1` / `span` |
| `sessionId` | `-Dtraceboard.sessionId`，默认 `s_s1_agent`（须匹配 schema） |
| `traceId` | 配置值，否则每个 span 随机 32 位小写 hex（S1 无关联，逐 span 独立） |
| `spanId` | 随机 16 位小写 hex（本会话唯一） |
| `parentSpanId` | `null`（游离根；无前端父 span） |
| `rootEventId` | 合成占位：`click_lost_` + 该 span 的 `spanId`（满足 `^click_[A-Za-z0-9_-]{8,}$`；**不伪装真实点击**） |
| `kind` | `controller` |
| `nodeKey` | `com.example.shop.controller.OrderController#cancelOrder`（沿用 S0 fixture 的稳定键；字节码匹配的是源码方法 `cancel(long)`） |
| `thread` | 当前线程 `{id,name}` |
| `startNs`/`durNs` | 相对 agent premain 的单调纳秒；`durNs = exit - enter` |
| `status` | 正常退出 `OK`；抛异常 `THREW`（S1 不采集异常 payload，`return=null`） |
| `return` | 摘要 `{"type":"object","value":{"class":"<返回类简单名>","httpStatus":<int|null>}}`；`httpStatus` 用反射读 `ResponseEntity.getStatusCodeValue()`，失败则 `null`（不猜、不调用业务 getter） |
| `confidence` | `LOST`（无前端根，不标 EXACT/INFERRED） |
| `flags` | `["SKELETON","S1_ONE_METHOD"]`（固定；不追加其它语义标记） |

- 不写 `source`（S1 无行号映射，不猜）；不写 `values`/`sideEffects`/`reason`。
- 事件必须通过冻结 schema；不做 `NOT_COLLECTED*` 语义（S2）。

### 4.5 workbench 假点击/请求批次（S1 fixture 同形）

- 一次按钮点击生成 1 个 `sessionId`（`s_s1_ui_<base36>`）、1 个 `traceId`（32 hex）、1 个 `rootEventId`（`click_<16 hex>`，即 clickId）、2 条事件，共享 traceId/rootEventId/sessionId，`confidence=EXACT`，`flags=["SKELETON"]`：
  1. `ui_event`：`nodeKey="#btn-cancel"`，`parentSpanId=null`，`startNs=0`，`durNs=5000000`，`status=OK`，`return=null`；
  2. `fetch`：`nodeKey="POST /api/orders/1/cancel"`，`parentSpanId=第 1 条 spanId`，`startNs=1000000`，`durNs=3000000`，`status=OK`，`return={"type":"http","value":200}`。
- 以 `application/x-ndjson` 整批 POST（2 行 + 末行 `\n`）；随后 `GET /api/v1/sessions` 与 `GET .../events?afterSeq=0&limit=200` 读回；UI 展示 ingest 计数与真实存储结果。
- 与 agent span 的关系：S1 **不做关联**；两者可同屏展示但不得画线/合并/推断归属。

## 5. 任务卡

### 5.1 plan-writer（契约与 S1 fixture，不写代码）

- 输入：本文件 §1–§4、S0 冻结契约/schema/fixture、SOLO-PLAN、主计划 §2.3/§8.1-8.3/§9.1-9.2/§13/§15(P0)/§16。
- 输出（只写这些）：`docs/contracts/api.v1.md`、`docs/contracts/transport.v1.md`、`fixtures/s1-walking-skeleton/{README.md,click-fetch-batch.jsonl,agent-controller-span.jsonl,expected-facts.json}`、`docs/plans/stages/S1/s1-plan.md`。
- 内容：api/transport 状态行改 S1，矩阵中 ingest 与 sessions/events 改 IMPLEMENTED，graph/replay/stream/links 保持 RESERVED；meta capabilities 改为 §4.3；transport §4 用 §4.1 语义替换 S0=501；新增简短“S1 walking skeleton”章节（含 §4.2 seq 投影、LOST/合成 rootEventId、查询≠回放）；event-model 仅在确有语义缺口时加短注，**schema 不动**。
- 完成判据：S1 fixture 每行过冻结 schema（含 agent span 的 `confidence=LOST`、flags、合成 rootEventId）；click/fetch 同 trace/root 且区间嵌套；expected-facts 可被现有校验器消费；契约与 §4 无矛盾；s1-plan 含步骤/验收命令/风险/回滚。
- 禁止：改 schema/字段/枚举、写代码/pom/TS、设计 S2 关联规则或 DB、git、真实数据/外网 `$ref`。

### 5.2 plan-reviewer（只读，G1 门）

- 输入：本文件、plan-writer 全部输出、S0 契约与 schema、主计划相关章节、SOLO-PLAN §3/§4。
- 输出（只写此文件）：`docs/plans/stages/S1/plan-review.md`——逐项 PASS/FAIL、阻断/建议、契约与 S1 fixtures 的 SHA256 冻结基线、`G1: PASS|FAIL`。
- 核查：①ingest 状态码/优先级/逐行/幂等与 §4.1 一致；②查询形状、seq 投影、404/405、capabilities 与 §4.2/§4.3 一致且“查询≠回放”；③agent 事件语义（唯一方法、LOST、合成 root、flags、无 EXACT）与 §4.4 一致；④fixtures 全行过 schema、无第二份 schema；⑤无 S2 内容、无 schema 字段变更、无 secret/真实数据。
- 禁止：替作者改文件、引入 S2、git。

### 5.3 coder-backend（collector + agent）

- 输入：本文件 §2–§4、G1 后的契约/schema/fixtures（只读）、`s1-plan.md`。
- 输出（只写这些）：`server/collector/**`、`agent/**`、`pom.xml`（仅新增插件/依赖/资源拷贝所需）。
- collector 完成判据：①构建期把根 schema 单源拷入 classpath；②`POST /ingest/v1/events` 实现 §4.1 全部状态码/计数/幂等/预算；③两个查询实现 §4.2（seq/nextSeq/404/400/405）；④meta §4.3；⑤无 DB/文件/CORS/图/回放/流；⑥冒烟脚本可复现成功。
- agent 完成判据：①Byte Buddy 真实插桩且只匹配该一个方法（证据：方法执行产生 1 条 controller span）；②jar major=52、Premain-Class 正确、shaded Byte Buddy 在内且 relocate；③事件字段符合 §4.4 并通过 schema；④collector 在线时 GET 可读回；⑤collector 停机时 demo 启动/请求正常、无重试风暴、无未捕获异常；⑥`-javaagent` 启动命令写入交付说明。
- 禁止：插桩 service/mapper/JDBC/其它方法、JDK/框架类转换、数据库/文件存储、异常 payload/行号猜测、改 demo 业务、改契约/schema/fixture/workbench、git。

### 5.4 coder-frontend（workbench）

- 输入：本文件 §3–§4、G1 契约/S1 fixtures（只读）、S0 workbench 现状。
- 输出（只写这些）：`workbench/**`（含 `vite.config.ts` 代理，S1 fixture 若需同步沿用 `scripts/sync-fixtures.mjs` 方式）。
- 完成判据：①S1 面板按钮生成 §4.5 两条假事件并 POST `/ingest/v1/events`；②读回 sessions/events，展示 session id、eventCount、accepted/rejected/dropped、nextSeq 与原始事件表（seq/type/kind/status/nodeKey）；③固定横幅文案“walking skeleton: fake frontend events; one real backend controller span; no correlation yet”；④保留 S0 fixture 事实面板；⑤`npm ci && npm run build` 绿、TS 严格无错、无 CDN；⑥collector 不可达时显示错误且不崩。
- 禁止：图/时间轴/回放/请求切换/节点详情/SSE/WebSocket/轮询、自动上报、CORS、调 demo 后端、改 S0 fixture、git。

### 5.5 tester（S1 独立验证，不改产品代码）

- 输入：全部 S1 产物、G1 冻结契约/fixtures 哈希、本文件 §1–§4。
- 输出（只写这些）：`tools/verify/**`（扩展 `verify.mjs` 为 S1 门禁或新增 `verify-s1.mjs`；node_modules 不提交）、`docs/plans/stages/S1/test-report.md`。
- 覆盖（一次命令、非 0 即 FAIL）：①S0 校验回归（schema/fixture/build）；②ingest：202 正例、415、空 body/空行/1001 行 400、单行 >64KB 与整批 >4MB 413、混合批 202 计数、`errors.line` 正确、重发幂等 dropped；③查询：sessions 计数/时间、分页 afterSeq/limit/nextSeq、limit=501→400、未知 session 404、写动词 405、无 graph/replay/stream 路由；④agent：collector + demo `-javaagent` 启动，POST cancel 后轮询读回 controller span（kind/nodeKey/status/return/confidence=LOST/flags），连续两次请求产生两个不同 spanId；停 collector 后 demo 请求仍成功且快速；⑤workbench build + 代理配置/横幅/无 SSE-WS-图 断言；⑥无 S2 实现扫描（service/mapper/JDBC/关联/图/回放/DB/第三方 schema）；⑦记录 G1 后契约/fixture 漂移哈希。
- 禁止：改产品代码/契约/fixture、放宽断言、常驻服务、git；浏览器证据由 orchestrator 提供，tester 只断言产物/API。

### 5.6 acceptance（唯一 git 写入者，G2 门）

- 输入：全部 S1 产物、6 张卡、G1 报告、tester 报告与复跑证据。
- 输出（只写这些）：`README.md`、`.gitattributes`（仅必要时）、`docs/plans/stages/S1/{acceptance.md,progress.md}`、`docs/plans/archive/stage-S1-2026-11-23/**`；git commit + tag。
- 完成判据：①亲自重跑 tester 命令与构建，不信报告；②漂移检查：G1 后契约/schema/S1 fixture 哈希不变；③越界检查：§2.2 清单零实现；④安全：无 secret/真实数据/遥测/CDN/第三方镜像；⑤README 写 S1 状态、启动顺序与 `-javaagent` 命令（含路径加引号）；⑥progress.md 按 SOLO-PLAN §4 模板；⑦按文件名 `git add`（不用 `-A`）+ commit + tag `s1-baseline`；分支实际为 `master`（记录，不改写历史）；⑧S1 到此停止，不对 S2 作承诺。
- 禁止：push/force/rebase、测试未绿打 tag、代改代码、开工 S2。

## 6. 路径归属矩阵（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S1/dispatch.md` | dispatcher | 只读 |
| `docs/contracts/**`、`fixtures/s1-walking-skeleton/**`、`docs/plans/stages/S1/s1-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S1/plan-review.md` | plan-reviewer | 只读 |
| `pom.xml`、`agent/**`、`server/collector/**` | coder-backend | 只读 |
| `workbench/**` | coder-frontend | 只读 |
| `tools/verify/**`、`docs/plans/stages/S1/test-report.md` | tester | 只读 |
| `README.md`、`.gitattributes`、`docs/plans/stages/S1/{acceptance.md,progress.md}`、`docs/plans/archive/stage-S1-2026-11-23/**`、git | acceptance | 只读 |
| `schema/**`、`fixtures/case-a-zero-rows/**`、demo/**、S0 文档 | 冻结 | 一律只读 |

## 7. 顺序与门禁

`dispatcher → plan-writer → plan-reviewer(G1) → coder-backend ∥ coder-frontend → tester → acceptance(G2，commit+tag)`

- G1 之前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 则上报，不降级放行。
- 契约/schema/S1 fixtures 在 G1 后冻结；任何字段/形状再变更必须停回 dispatcher/plan-writer 流程。
- S1 检查点到达即停；**不得开始 S2**。

## 8. 环境事实（不得改写）

- Windows 10 + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool` 含中文与空格，所有命令双引号。
- Maven 3.9.5；默认 `JAVA_HOME`=JDK 1.8.0_221；JDK21 在 `C:\Program Files\Java\jdk-21`；根/collector 构建就地覆盖 `JAVA_HOME`，不全局切换；demo 用默认 JDK8。
- Node 22.22.2 / npm 10.9.7；Maven Central/npm 官方源可达；无第三方镜像、无外部 CDN/在线字体/遥测。
- 端口：collector 8601（仅 `127.0.0.1`）、demo 8080、workbench 5173、demo 前端 5174；冲突先诊断记录，不静默改端口。
- git：分支 `master`、无 remote；只有 acceptance 写 git；不用 MySQL/外部 DB；无 secret/真实客户数据。

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Byte Buddy 在 Boot fat jar / 自定义 ClassLoader 下看不见目标类、relocate 失败 | coder-backend 先做最小 spike（只匹配一个类、打一行日志证明 transform 命中）；失败即 `BLOCKED` 附日志；不得退回合成启动事件 |
| JDK8/JDK21 混用、agent 字节码被编成 21 | agent `--release 8`；tester 断言 major=52；demo 用 JDK8 启动 |
| fail-open 失效（collector 停机拖慢/打断 demo） | 单守护线程、有界队列、300/700ms 超时、1 次尝试、全 `Throwable` 吞掉；专项测试 collector 停机 |
| 幂等/seq 竞态 | 每 session 同步追加；幂等键先查后插；批内重复也 dropped；测试重发与并发读 |
| 预算边界（4MB/1000/64KB）与信封判定顺序 | 固定 415→413→400→逐行；先判 Content-Length，再限量读取；边界值测试 |
| CORS/IPv6 代理失败 | Vite target 固定 `http://127.0.0.1:8601`；不配 CORS；统一 localhost 访问 |
| networknt 与 Boot 3.2 Jackson 版本冲突 | plan 锁版本并记录构建/启动证据；冲突则调整同族版本，不改手写校验/第二份 schema |
| 契约漂移（seq 投影、LOST、查询≠回放） | G1 冻结 + reviewer 哈希；tester/acceptance 双重漂移检查 |
| 工作台范围蔓延（图/回放/SSE） | §2.2 硬清单 + 代码扫描；越界回退 |
| 测试不稳定（agent 异步发送、端口占用） | 轮询带超时（≤10s）、先诊断端口、串行起停并清理进程 |

## 10. 停止条件

1. Byte Buddy 插桩经 spike 仍不可行 → `BLOCKED` + 证据（transform 未命中/应用起不来/类不可见）；**合成启动事件不能替代**，任何 fallback 必须先技术验证并交 G1 显式评审。
2. G1 FAIL 且一轮返工后仍 FAIL；或必须改 schema 字段/事件类型才能继续。
3. 任务卡要求改他人路径、推翻 §3 决策、或必须引入 S2 能力才能达标。
4. 测试未绿但 owner 想“先提交再说”；或出现 secret/真实数据/第三方镜像。
5. 命中任一越界（§2.2）或契约漂移。

## 11. S1 出口纪律

- S1 只证明“一条假事件从点击/请求到工作台 + 一个真实 controller span”；不证明 0 行、关联、图、回放、行级变量。
- UI/README/报告统一标注：walking skeleton；fake frontend events；one real backend controller span；no correlation yet；service/mapper/SQL 未采集。
- 未验证能力一律标“S2 待做/未采集”；S1 通过也不得宣称产品已完成。
