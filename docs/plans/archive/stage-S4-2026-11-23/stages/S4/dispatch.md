# S4 本地接入与节点详情 · 任务分发书（dispatch）

> 阶段：S4（MVP：本地启动器 / 预览注入 / 诊断 / 节点详情）｜角色：task-dispatch｜日期：2026-11-24｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S4 行 + §4；主计划 §11（本地模式 797–880）、§12（共用/差异 894–920）、§13.1/13.3（924–993）、§16 T11（1215–1249）、§19（1301–1389）；
> 上游：S3 `docs/plans/stages/S3/{progress,acceptance,s3-plan}.md` 与基线 `s3-baseline`（`5ddb688`）。
> 本文件是 S4 八个下游子代理的唯一任务输入；除 dispatcher 外任何人不得修改。**S4 只做本地接入 + 节点详情，不做 S5/S6。**

## 0. 通用规则（所有人）

1. 一个子代理只执行一张卡：只读「输入」、只写「输出」；路径含中文/空格，命令与路径全部双引号，从仓库根执行。G1 后契约、S4 fixture、s4-plan、本文件冻结。
2. **只有 acceptance 可写 git**（add/commit/tag）；其他人禁止 git 写操作、禁止 push/force/rebase/改 config。
3. 越界、契约缺口、指标不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改一下”，不许改他人路径。
4. 无 secret/真实客户数据；不换第三方镜像；不自动下载仅 GitHub 提供的资源；依赖只走 Maven Central/npm 官方源；无 CDN/在线字体/遥测；无外部网络访问。
5. 未做/未验证能力标 `S4 未做 / 未采集 / S5/S6 待做`；**禁止用 fixture 冒充运行时事实**（×3 运行时是 S6；S4 fixture 只是 UI/测试数据）；诊断不得伪造 PASS。
6. schema v1 字段/枚举/约束不变；S0–S3 fixture 字节不变；既有 S3 面板/时间轴/回放/S0–S2 面板必须保留。

## 1. 目标与验收信号（SOLO-PLAN S4 行 + 主计划 §11.10/§16 T11）

| 项 | 口径 |
|---|---|
| 主要工作 | 本地启动器 IDEA/JAR、预览代理/SDK 注入、诊断；节点详情、×N、SQL/UI 票签、缺口 |
| 完成信号 | **新手按文档接入；案例 A/B 能走到结论；未采集有原因** |

S4 收尾必须同时证明（缺一即 FAIL）：

1. **IDEA 接入**：`idea` 只打印（不 spawn）可直接粘贴的 VM options + 步骤清单；含绝对 agent 路径/ingest/session，路径带引号。
2. **JAR 接入**：`jar` 以指定 JDK8 spawn `-javaagent`，等待端口/健康，写 PID/日志；`stop --pid-file` 干净停止；失败给出可执行诊断（token + 原因）。
3. **预览注入**：`preview` 把外部 `/traceboard/config.js` + `/traceboard/sdk.js` 注入 HTML `</body>` 前（**无内联脚本**），其余路径/头/状态/体透传；SDK IIFE 可用；CSP/无 body 等限制如实报告。
4. **握手与诊断**：agent premain 后异步 `POST /ingest/v1/agent-hello`（≤3 次、1s 超时、fail-open、不阻塞应用）；collector `GET .../agent` 返回连接事实；`diagnose` 输出 PASS/FAIL/WARN/SKIP，FAIL 时 exit≠0，404/0 事件不伪装成功。
5. **详情/×N/缺口**：工作台选中节点显示状态+reason/return/sideEffects(SQL)/UI 效果/flags/thread/source/start+dur/confidence；同一 trace 按 `nodeKey` 聚合 `×N` 并有逐次列表；缺口清单覆盖“前端 fetch 无后端”“`NOT_COLLECTED_*` + reason”“sideEffects 缺失=未采集（绝不为 0）”。
6. **测试/契约/证据**：`(cd "tools/verify" && npm ci && node verify.mjs)` 一次命令覆盖 S4-A..S4-H 与 S0–S3 回归（迁移显式列出），exit 0；api S4 矩阵、guide、fixture、s4-plan、test-report、README/progress/acceptance 齐备；G1 冻结面零漂移。
7. **案例 A/B 不回归**：S3 的 EXACT 关联、案例 B “确认没发”、只读回放 0 写在工作台仍可用；本阶段不新增任何伪造结论。

## 2. 范围与 S5 边界

### 2.1 S4 范围内（6 项交付）

| # | 交付 | owner |
|---|---|---|
| 1 | api S4 矩阵/端点、`docs/guides/local-launcher.md`、`fixtures/s4-details/**`、`s4-plan.md` | plan-writer |
| 2 | 新 Maven 模块 `server/launcher/**`（idea/jar/stop/preview/diagnose）+ 根 reactor 模块 | coder-launcher |
| 3 | agent 握手 + collector `agent-hello` / `agent` 状态 | coder-handshake |
| 4 | SDK IIFE 构建 + `window.__TRACEBOARD_CONFIG__` 自动初始化 | coder-sdk |
| 5 | 工作台节点详情、×N、SQL/UI 票签、缺口清单 | coder-workbench |
| 6 | `tools/verify` S4 门禁 + test-report；README/验收/归档/commit+tag `s4-baseline` | tester / acceptance |

### 2.2 S4 明确不做（S5/S6 边界；越界即失败）

- 无 L1/L2：不采参数/实体字段/局部变量/`values[]`/字段 diff，不加脱敏/截断新语义（S5/S6）；`REDACTED`/`TRUNCATED` 仅保留既有显示。
- 无 sourcemap/构建插件/源码片段/函数行号/方法名映射（S5）；详情缺失只写“未采集”，不承诺行号。
- **×3 运行时是 S6**：S4 的 ×N 只是对已采集 span 按 `nodeKey` 的前端聚合；`fixtures/s4-details` 的 3 次调用是 UI/测试数据，不得宣称运行时支持 ×3。
- 无异步续体传播、后台请求车道、手工关联 `/links`、时间窗 `INFERRED`（S6）；无 SSE/WS/实时；无持久化/DB/缓存/CORS/鉴权。
- 无 TLS/HTTPS 代理、无浏览器扩展/CDP、无内联脚本注入、无 CSP 改写；无 Tomcat/WAR/React/cloud（S7+）。
- 不改 schema、事件类型/枚举、S0–S3 fixture、demo 后端/H2 seed/案例 A 行为；不改 S3 契约章节既有语义。

## 3. 强制技术决策（不得协商）

| 项 | 决策 |
|---|---|
| launcher | 新模块 `server/launcher`（Java 21，根 reactor，无 Spring、无第三方依赖；JDK `HttpServer`/`HttpClient`/`ProcessBuilder`）；CLI 主类 `io.traceboard.launcher.Launcher` |
| 子命令 | `idea`（只打印，不 spawn）、`jar`（spawn/健康/pid/log/detach）、`stop --pid-file`、`preview`（JDK 反代+注入）、`diagnose`（七项检查）；全部支持 `--help` |
| ingest 口径 | `--ingest`/`--ingest-url` 接受 `http://host:port`、`.../ingest` 或 `.../ingest/v1/events`，规范化为 `.../ingest`；事件 URL=`<base>/v1/events`，hello=`<base>/v1/agent-hello`；其他形状 exit 2 |
| 端口/绑定 | preview 固定 `127.0.0.1:8602`（无 TLS）；collector 8601、demo 8080、workbench 5173、demo 前端 5174 不变；冲突先诊断，不静默改 |
| 工作产物 | 日志默认 `work/logs/`，PID 默认 `work/<session>.pid`（均 gitignored）；不写仓库其他路径、不写 secrets |
| 握手 | agent premain 配置完成后，**守护线程**异步 POST JSON（≤3 次尝试、connect/read 1s、退避 200/400ms、fail-open、绝不阻塞启动）；不新增事件类型、不改 schema |
| collector 存储 | 内存 `ConcurrentHashMap<sessionId, hello>`，**last-wins**、无 TTL/持久化；不创建事件会话；`GET .../agent` 只读；meta 仍 5 键 |
| SDK IIFE | `frontend/sdk` 新增 `build:iife`（esbuild IIFE，global `TraceBoardSDK`，无 sourcemap）；`build` = ESM+d.ts+IIFE；存在 `window.__TRACEBOARD_CONFIG__` 时自动 init，幂等 guard + fail-open；ESM demo 行为不变 |
| 工作台 | 选中节点详情面板 + `nodeKey` ×N + 逐次选择 + 缺口清单；保留 S3 板/时间轴/回放与 S0–S2 面板；无图库、无 S5/S6 |

## 4. 共享契约（实现不得漂移）

### 4.1 CLI（精确）

```text
java -jar server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar <cmd> [options]
idea     --jar <demo.jar> --agent <agent.jar> --ingest <url> --session <id> [--port 8080]
jar      --jar <demo.jar> --agent <agent.jar> --ingest <url> --session <id> [--java <java.exe>] [--port 8080] [--health <url>] [--detach] [--pid-file <path>] [--log-dir <path>]
stop     --pid-file <path>
preview  --target <url> [--port 8602] [--ingest <url>] [--session <id>]
diagnose --app-url <url> --ingest-url <url> --session <id> [--preview-url <url>]
```

- `--session` 必须匹配 `^s_[A-Za-z0-9_-]+$`；preview 默认 `s_s4demo`；其余子命令必填。
- `--java` 缺省 `$JAVA_HOME/bin/java(.exe)`，否则 PATH 的 `java`；`--port` 缺省 8080；`--health` 缺省 TCP 连 `127.0.0.1:<port>`（仅存活，不代表业务健康）。
- 退出码：`0` 成功；`2` 用法/参数非法；`3` 运行失败（spawn/健康超时/diagnose 有 FAIL/stop 拒绝）。
- 断言 token（stderr 或 stdout，ASCII）：`JAVA_NOT_FOUND`、`AGENT_NOT_FOUND`、`JAR_NOT_FOUND`、`PORT_IN_USE`、`APP_EXITED`、`HEALTH_TIMEOUT`、`PID_MISMATCH`、`SDK_IIFE_MISSING`、`TARGET_TLS_UNSUPPORTED`、`INGEST_UNREACHABLE`；每个 token 后跟中文可执行建议。
- `diagnose` 行格式 `PASS|FAIL|WARN|SKIP <check>: <detail>`，check ∈ {`collector_health`,`collector_meta`,`app_health`,`agent_handshake`,`recent_events`,`preview_injection`,`sdk_script`}；末行 `SUMMARY: PASS|FAIL`。

### 4.2 `idea` 行为（不 spawn）

- 校验 jar/agent 存在、ingest/session 合法后，原样打印一行可粘贴 VM options（绝对路径、`"` 包裹）：
  ```text
  -javaagent:"<agentAbs>" -Dtraceboard.ingestUrl="<base>/v1/events" -Dtraceboard.sessionId=<id>
  ```
- 再打印 checklist：①先起 collector 并 `curl /actuator/health`；②IDEA Run/Debug → VM options（**不是** Program arguments）粘贴；③启动应用后查 `GET <collector>/api/v1/sessions/<id>/agent`；④用打印的 `preview --target http://localhost:<port> --ingest <base> --session <id>` 打开预览；⑤工作台 5173 点 `#btn-cancel`/`#btn-save-b`。
- 不得启动任何进程；不写文件（除 stdout）。

### 4.3 `jar` / `stop` 行为

- spawn argv（`ProcessBuilder`，不经 shell，空格/中文安全）：
  `<java> -javaagent:<agentAbs> -Dtraceboard.ingestUrl=<base>/v1/events -Dtraceboard.sessionId=<id> [-Dserver.port=<port>] -jar <jarAbs>`
  `-Dserver.port` 只在显式 `--port` 时追加；`-javaagent`/`-D` 必须在 `-jar` 前。
- stdout/stderr 全量写 `work/logs/<session>-<timestamp>.out.log`/`.err.log`，同时回显；PID 文件 JSON：`{"pid":N,"startedAtMs":E,"java":"...","jar":"..."}`。
- 就绪：`--health` 给定时 GET 该 URL 期望 2xx；否则 TCP 连接端口；超时 30s。就绪前进程退出 → `APP_EXITED` + 日志尾 20 行；超时 → `HEALTH_TIMEOUT` + 日志尾；端口占用（显式 port）→ spawn 前 `PORT_IN_USE`。
- 非 `--detach`：wait 进程并以其退出码退出；`--detach`：就绪后打印 `PID=<n>`、`PID_FILE=`、`LOG_DIR=` 并 exit 0。
- `stop`：读 PID JSON；进程不存在 → `NOT_RUNNING` exit 0（幂等）；`ProcessHandle.info().commandLine()` 不含记录的 jar → `PID_MISMATCH` exit 3 **拒绝杀**；否则 destroy，5s 后 destroyForcibly，成功删 PID 文件并打印 `STOPPED pid=N`。

### 4.4 `preview` 行为（反代 + 注入）

- 仅绑 `127.0.0.1:<port>`（默认 8602），无 TLS；`--target` 必须是 `http://`（否则 `TARGET_TLS_UNSUPPORTED`）；无外部网络。
- 路由：`/traceboard/config.js`、`/traceboard/sdk.js` 本地生成/读取；`/ingest/*` 反代到 `--ingest`（缺省 `http://127.0.0.1:8601/ingest`，collector 不可达返回 502 且说明，不伪造 202）；其余方法/路径/查询/头/状态/体透传。
- `config.js` 逐字：`window.__TRACEBOARD_CONFIG__ = {"sessionId":"<id>","ingestUrl":"/ingest","appName":"traceboard-preview","observeMs":1500};`（仅 session 校验后拼接，无 secrets）；预览 session 必须与 agent `-Dtraceboard.sessionId` 一致才能前后端关联，guide 明示。
- `sdk.js` = `frontend/sdk/dist/traceboard-sdk.iife.js` 字节；解析顺序：系统属性 `traceboard.sdk.iife` → 环境变量 `TRACEBOARD_SDK_IIFE` → CWD `frontend/sdk/dist/...` → launcher jar 上两级同路径；缺失启动失败 `SDK_IIFE_MISSING` 并给出构建命令。
- 注入：仅 `text/html`；在**最后一个**大小写不敏感 `</body>` 前插入
  `<script src="/traceboard/config.js"></script><script src="/traceboard/sdk.js"></script>`；**无内联脚本**；响应头 `X-TraceBoard-Preview: injected`。
- 不注入时响应头 `X-TraceBoard-Preview: not-injected:<code>`，`code ∈ {encoding,content_type,no_body,too_large,read_error}`（压缩、非 HTML、无 `</body>`、>2MB、读取失败）；上游请求带 `Accept-Encoding: identity`（本地性能让步，保证可注入）。
- 不改写 CSP、不改写 HTML/JS 业务内容、不改写绝对 URL/`Location`；CSP 仅 nonce/hash 的 `script-src` 可能拦截注入，诊断只报告“标签已注入、执行未验证（无 CDP）”。已知限制写入 guide。

### 4.5 agent 握手与 collector 端点（控制通路，非事件）

- agent：`-Dtraceboard.ingestUrl` 以 `/v1/events` 结尾时，替换为 `/v1/agent-hello`；否则跳过并 stderr `hello_skipped reason=ingest_url`。PID 取 `ManagementFactory.getRuntimeMXBean().getName()` 的 `@` 前缀（失败则跳过 `reason=pid`）；`startedAtMs=System.currentTimeMillis()`；`version` 取 manifest `Implementation-Version`，回退 `0.1.0-SNAPSHOT`。仅计数日志 `hello_sent=1` / `hello_failed=3`，不打印 body/响应。
- 请求（JDK8 `HttpURLConnection`，`Content-Type: application/json; charset=utf-8`）：
  ```json
  {"schema":"traceboard.agent.v1","sessionId":"s_s4demo","version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000}
  ```
- collector `POST /ingest/v1/agent-hello`：成功 `200 {"schema":"traceboard.agent.v1","sessionId":"<id>","accepted":true}`；body >4096B→413；非 JSON→415；字段缺失/非法（schema 非精确、session 不匹配、version 空/超 64、pid<1、startedAtMs<0）→400 标准错误信封（不回显 body）；写动词→405。未知字段忽略；last-wins。
- `GET /api/v1/sessions/{sessionId}/agent`：有记录 `200 {"sessionId":"<id>","connected":true,"version":"...","pid":N,"startedAtMs":E,"lastSeenMs":E}`（`lastSeenMs`=collector 接收时刻）；否则 404 错误信封；session 形状不合法按 404。无鉴权（仅回环）。
- 握手**不进入 EventStore**：只有 hello 的 session 不出现在 `/api/v1/sessions`；GET agent 独立于事件；不得因此创建空会话或改 meta（仍 5 键）。collector 业务路由 = 9 条（meta/ingest/hello/sessions/events/agent/requests/graph/replay，不含 actuator）；`stream/ws/links` 仍 404。

### 4.6 SDK IIFE（`frontend/sdk/**`）

- 新增 devDependency `esbuild`（官方 npm，锁文件）；`build:iife`：`esbuild src/index.ts --bundle --format=iife --global-name=TraceBoardSDK --target=es2020 --outfile=dist/traceboard-sdk.iife.js --legal-comments=none --sourcemap=false`；`build` 先 `tsc` 再 IIFE。
- 全局 `TraceBoardSDK = { initTraceBoard, wrapFn, uiEffect, elementIdentity, version:"0.1.0" }`；IIFE 加载后若 `window.__TRACEBOARD_CONFIG__` 为对象：校验 `sessionId`（`s_...`）、`ingestUrl`（默认 `/ingest`）、`appName`（默认 `traceboard-preview`）、`observeMs`（有限数 1..60000，默认 1500）→ 调一次 `initTraceBoard`；guard `window.__TRACEBOARD_AUTO_INIT__`；任何异常吞掉。
- 无 config 不自动 init；显式 ESM `initTraceBoard` 仍幂等（`activeRuntime` 复用），不重复监听；demo 前端不改、行为不变；无 `.map`、无 CDN、无遥测。

### 4.7 工作台节点详情 / ×N / 缺口（`workbench/**`）

- 保留 `#s3-panel/#s3-tree/#s3-timeline/#s3-replay-toggle/#s3-readonly/#s3-caseb` 与 S0–S2 面板；新选择器（稳定、dist 可断言）：`#s4-detail`、`#s4-detail-title`、`#s4-detail-status`、`#s4-detail-tabs`、`#s4-sideeffects`、`#s4-ui-effects`、`#s4-invocations`、`#s4-invocation-select`、`#s4-gaps`、`#s4-group-badge`、`#s4-detail-close`。
- 选中树节点 → 详情：`kind · nodeKey · 第 i/N 次`；status + reason（`NOT_COLLECTED_*` 显示原 reason；缺失则 `未采集（无 reason）` 并列入缺口）；return；sideEffects（SQL 表：`sqlId/rowsAffected/transaction`；无/空 → `未采集`，**绝不显示 0**）；UI 效果（`ui_effect` 文本；另列本 trace 的 render，标注“按 trace 列出，未推断与所选节点的因果”）；flags 原样 chip（未知 flag 也显示）；thread `id/name` 或 `未采集`；source `file:line` 或 `未采集`；start/dur 显示 `relNs`（原始 ns 副行）；confidence（含 `LOST` 标签，不伪装状态）。
- ×N：同一选中 trace 内按 `nodeKey` 分组（`kind` 仅展示）；树行显示 `×N`（N≥2）；`#s4-invocations` 逐次列表/选择（按 `startNs` 升序、同值 `spanId` 排序），选中后详情切换；聚合仅显示，**不改 graph/API/边**。
- 缺口 `#s4-gaps`（只读派生）：①`fetch` 节点的 `spanId` 未被任何后端节点 `parentSpanId` 引用 → `后端未采集/未关联`（逐字）；②`status ∈ NOT_COLLECTED_*` → 状态 + reason/`未采集（无 reason）`；③`kind ∈ {mapper,sql}` 且 `sideEffects` 缺失/空 → `未采集`（绝不为 0）。无缺口显示 `未发现缺口（仅基于已采集数据；未采集项不会显示为成功）`。
- 无图库/画布/SSE/WS/sourcemap/values/局部变量/行号；collector 不可达/404/空态不崩；`npm ci && npm run build` 绿。

### 4.8 `fixtures/s4-details/`（合成 UI/测试数据，非运行时证据）

- 文件：`README.md`、`events.ndjson`、`expected-facts.json`；schema v1 合法（Ajv 2020-12 strict 离线校验），无 PII。
- 一条 `s_s4detail` trace（一个 click 根/一个 request）：`ui_event` → `fetch POST /api/orders/1/cancel` → `controller` → **同一 `nodeKey` 的 3 个 `service` span（×3）** + `sql`（`sideEffects:[{type:"sql",sqlId:"OrderMapper.cancelById",rowsAffected:0,transaction:"UNKNOWN"}]`）+ `mapper`（`status:"NOT_COLLECTED_POLICY"`，`reason:"policy:third_party_package"`）+ 一个未关联的 `fetch GET /api/orders`（用于缺口演示）。共 9 事件、同 trace/rootEventId，区间嵌套、父链完整。
- 3 次调用 distinct `spanId`、`startNs` 升序、其中一次 `RETURNED_FALSE`（便于“指哪次”）；expected 含 `groups`（nodeKey/3/spanIds/顺序）、`gaps`（未关联 fetch + NOT_COLLECTED + 缺失示例）、`apiExpectations`（requests 1 行 EXACT、graph 9 节点/8 边）、`uiExpectations`（`×3`、详情字段、缺口文案）。
- README 逐字声明：**“运行时 ×3 是 S6；本目录是 UI/测试数据，不是运行时事实，不得用于宣称 ×3 已支持”**；时间值仅 fixture 内示意。

### 4.9 契约与文档（plan-writer）

- `docs/contracts/api.v1.md`：新增 §2.4 S4 矩阵（10 个端点含 health；业务路由 9；stream/ws/links 仍 RESERVED）与 §10：agent-hello 请求/响应/400/405/413/415、agent 状态 200/404、last-wins、hello 不入事件/不建会话、meta 不变；错误信封沿用 transport §4.3。
- 新增 `docs/guides/local-launcher.md`：构建、四个接入步骤（IDEA/JAR/预览/诊断）、精确命令、CSP/无 body/压缩/绝对 URL 限制、端口/回环、work/ 日志、工作台输入同一 session、排障矩阵（agent 未加载、hello 404、端口冲突、JDK 版本、`SDK_IIFE_MISSING`、`not-injected:*`）、安全（无 secrets、仅本机）。
- 不改 `schema/**`、`docs/contracts/{transport,event-model,status-semantics}.md`、S0–S3 fixture、demo；事件模型无 S4 变更（握手不是事件）。
- `docs/plans/stages/S4/s4-plan.md`：步骤、精确命令、S4-A..S4-H 映射、风险、回滚、偏离记录。

### 4.10 S3 门禁迁移（tester 执行；不放宽其余断言）

- `S3-8`/`S2-8` 范围升级：允许 launcher/hello/预览注入/详情/×N 显示；仍禁 S5/S6（sourcemap/构建插件/L1/L2/values/links/SSE/WS/持久化/图库）；collector 路由 7→9；agent 允许 hello（插桩点仍恰 4 个）。
- `S3-6`/`S2-6`：工作台允许 S4 选择器/缺口；`#s3-*` 与 S0/S1/S2 面板保留；仍无图库/SSE/WS。
- `S3-1`：SDK 构建新增 IIFE；`S3-10` 白名单加入 `server/launcher/**`、根 `pom.xml`、`docs/guides/**`、`fixtures/s4-details/**`、`docs/plans/stages/S4/**`。
- 不变：`S2-3` 无头 4-span LOST、`S3-3` EXACT E2E、`S3-4/5` 回放 0 写、`S1-C0` meta 5 键、schema/S0–S3 fixture 字节。

## 5. 任务卡

### 5.1 plan-writer（契约/fixture/指南/计划；不写代码）
- 输入：本文件 §1–§4、S0–S3 冻结契约/schema/fixture、主计划 §11/§12/§13/§16 T11/§19。
- 输出（只写）：`docs/contracts/api.v1.md`、`docs/guides/local-launcher.md`、`fixtures/s4-details/**`、`docs/plans/stages/S4/s4-plan.md`。
- 完成判据：§4.1–§4.10 全部落入契约/guide/fixture/plan；fixture 过 Ajv strict 且满足 §4.8；guide 含精确命令与限制；schema/transport/event-model/status-semantics/S0–S3 fixture 字节不变；无 S5/S6 内容。
- 禁止：写代码/pom/TS、改 schema/既有契约章节语义、改 S0–S3 fixture、git、真实数据/外网 `$ref`。

### 5.2 plan-reviewer（只读，G1 门）
- 输入：本文件、plan-writer 全部输出、S0–S3 契约/schema、主计划 §11/§13/§16 T11。
- 输出（只写）：`docs/plans/stages/S4/plan-review.md`——逐项 PASS/FAIL、阻断/建议、SHA256 冻结基线（schema、api/transport/event-model/status-semantics、S4 guide、S4 fixture 三件、s4-plan、dispatch）、`G1: PASS|FAIL`。
- 核查：①CLI/退出码/诊断语义与 §4.1–§4.4 一致且不伪造；②hello 形状/重试/存储/端点/错误码与 §4.5 一致、无事件变更；③IIFE/自动 init/幂等与 §4.6 一致；④详情/×N/缺口与 §4.7 一致且“未采集≠0”；⑤fixture 过 schema、×3 仅 fixture、无运行时宣称；⑥无 S5/S6、无内联脚本/CSP 改写/外部网络；⑦schema 与 S0–S3 fixture 字节不变。
- 禁止：替作者改文件、写代码、引入 S5/S6、git。

### 5.3 coder-launcher（`server/launcher/**` + 根 `pom.xml`）
- 输入：本文件 §3/§4.1–§4.4、G1 guide、demo/agent 产物路径、JDK8 绝对路径。
- 输出（只写）：`server/launcher/**`、`pom.xml`（仅 `<modules>` 增 `server/launcher`）。
- 完成判据：JDK21 构建出可执行 jar（Main-Class）；`idea` 打印精确 VM options+checklist 且不 spawn；`jar` spawn/健康/日志/PID/detach/wait 与 §4.3 一致，失败 token 可执行；`stop` PID 校验+幂等；`preview` 按 §4.4（注入/透传/`/ingest`/header/限制/缺失 SDK 失败）；`diagnose` 七项 PASS/FAIL/WARN/SKIP、exit 码正确；仅 JDK API、无 Spring/三方依赖、仅回环、无 secrets。
- 禁止：改 agent/collector/workbench/sdk/契约/fixture/demo、内联脚本、CSP 改写、TLS、外部 CDN、静默改端口、git。

### 5.4 coder-handshake（`agent/**` + `server/collector/**`）
- 输入：本文件 §4.5、agent/collector 现状、S2/S3 回归断言。
- 输出（只写）：`agent/**`、`server/collector/**`。
- 完成判据：agent premain 后守护线程 ≤3 次 POST hello（1s 超时/退避/fail-open/不阻塞）、URL 派生与跳过计数正确、jar major 52/4 插桩点/flags 不变；collector hello 端点校验/413/415/405/400、agent 状态 200/404、last-wins、仅内存、不建事件会话、meta 5 键、路由 9 条；无 auth/CORS/持久化/SSE/WS。
- 禁止：改事件 schema/ingest 语义/requests/graph/replay 输出、改 workbench/launcher/sdk/契约、阻塞 premain、伪造连接、git。

### 5.5 coder-sdk（`frontend/sdk/**`）
- 输入：本文件 §4.6、SDK 现状、G1 guide。
- 输出（只写）：`frontend/sdk/**`（源码/构建/单测/package/tsconfig）。
- 完成判据：`npm ci && npm run build` 产出 ESM+d.ts+`dist/traceboard-sdk.iife.js`（global `TraceBoardSDK`、无 map）；自动 init 仅在有 config 时、字段校验/guard/幂等/fail-open；无 config 不 init；显式 init 不重复监听；ESM demo 行为与 S3 一致；单测扩展（IIFE 存在/全局名/无 sourceMappingURL、vm 自动 init 一次、二次加载不重复、坏 config fail-open、既有 8 项保持）。
- 禁止：改 demo/agent/collector/workbench/契约/fixture、加 sourcemap/构建插件/CDN/遥测、采集新数据、git。

### 5.6 coder-workbench（`workbench/**`）
- 输入：本文件 §4.7、G1 fixture/契约、collector API、workbench S3 现状。
- 输出（只写）：`workbench/**`。
- 完成判据：§4.7 全部选择器/字段/文案/×N/逐次选择/缺口规则；保留 S3 板/时间轴/回放/案例 B 三文案/S0–S2 面板；“未采集”绝不为 0；collector 404/空态/不可达不崩；`npm ci && npm run build` 绿；无图库/SSE/WS/sourcemap/values/L2。
- 禁止：改后端/契约/fixture/sdk、发写请求/调 demo、绝对 URL/CORS、服务端新增 API、git。

### 5.7 tester（`tools/verify/**` + `docs/plans/stages/S4/test-report.md`）
- 输入：全部 S4 产物、G1 冻结哈希、本文件 §4、S0–S3 门禁。
- 输出（只写）：`tools/verify/**`、`docs/plans/stages/S4/test-report.md`。
- 门禁（一次命令、非 0 即 FAIL；串行起停、`finally` 清理进程/端口/临时文件）：

| 组 | 断言 |
|---|---|
| S4-A | launcher JDK21 构建；`idea` 输出 VM options（绝对路径+引号+ingest+session）与 checklist，exit 0，无新 java 子进程；缺参/坏路径 exit 2/3 且 token 可执行 |
| S4-B | `jar` 以 JDK8 spawn demo+agent，端口就绪、PID/日志存在、hello 进入 collector；`stop` 停止且端口释放；重复 stop `NOT_RUNNING` exit 0；坏 jar/坏 java/端口占用给对应 token；无残留 |
| S4-C | hello：合法 200 形状；400（schema/session/pid/version/startedAt）、413、415、405；agent 200 字段与 last-wins；404 未知；事件计数/seq/sessions 不受 hello 影响；meta 5 键；stream/ws/links 404 |
| S4-D | preview（Node 临时 HTML stub + collector）：HTML `injected` 且两 script 在 `</body>` 前、无内联；`/traceboard/sdk.js` 200 含 `TraceBoardSDK`；`/traceboard/config.js` 含 session；非 HTML/二进制透传逐字；无 body/压缩给 `not-injected:*`；`/ingest` 反代 202；仅回环、无 TLS/外部网络；SDK 缺失 `SDK_IIFE_MISSING` |
| S4-E | SDK 构建含 IIFE；vm 自动 init 一次/告警 guard；坏 config fail-open；ESM 单测 8+ 绿；demo 前端构建不变、无 sourcemap/CDN |
| S4-F | `fixtures/s4-details` 过 schema；×3 同 nodeKey/一个 trace/一个 request；SQL sideEffects、`NOT_COLLECTED_POLICY`+reason、未关联 fetch；ingest 后 requests/graph/缺口期望；workbench dist 含 §4.7 选择器/文案/`后端未采集/未关联`/“未采集”且无 S5/S6 能力 |
| S4-G | `diagnose`：collector+demo+preview 全 PASS exit 0；collector 停 → FAIL exit 3 且原因可执行；无 preview → SKIP 不计 PASS；hello 404 不显示成功；输出无伪造 |
| S4-H | S0–S3 回归按 §4.10 迁移全绿；G1 哈希零漂移；schema/S0–S3 fixture 字节不变；安全（0 secret/CDN/遥测/镜像、仅回环）；清理（8601/8080/5173/5174/4173/4174/8602/18080 无监听、无 java/node 残留、git index 未动、验证器未写产品） |

- 证据：`test-report.md` 写环境、逐项 PASS/FAIL、复现命令、E2E 输出、进程已停声明；浏览器截图由 orchestrator 提供（详情/×N/缺口/预览页），tester 不断言截图。
- 禁止：改产品/契约/fixture、放宽断言、常驻服务、git。

### 5.8 acceptance（唯一 git 写入者，G2 门）
- 输入：全部 S4 产物、8 张卡、G1 报告、tester 报告。
- 输出（只写）：`README.md`、`docs/plans/stages/S4/{acceptance.md,progress.md}`、`docs/plans/archive/stage-S4-<date>/**`、git commit + tag `s4-baseline`。
- 完成判据：①亲自复跑门禁与构建，不信报告；②G1 哈希不变；③§2.2 越界零实现（无 S5/S6/SSE/WS/持久化/图库/TLS/CSP 改写）；④安全；⑤README 写 S4 状态/接入步骤/端口/诊断/限制；⑥progress 按 SOLO-PLAN §4；⑦按文件名 add+commit+tag；⑧**S4 到此停止，不开始 S5**。
- 禁止：push/force/rebase、测试未绿打 tag、代改代码、开工 S5。

## 6. 路径归属（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S4/dispatch.md` | dispatcher | 只读 |
| `docs/contracts/api.v1.md`、`docs/guides/**`、`fixtures/s4-details/**`、`docs/plans/stages/S4/s4-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S4/plan-review.md` | plan-reviewer | 只读 |
| `server/launcher/**`、根 `pom.xml` | coder-launcher | 只读 |
| `agent/**`、`server/collector/**` | coder-handshake | 只读 |
| `frontend/sdk/**` | coder-sdk | 只读 |
| `workbench/**` | coder-workbench | 只读 |
| `tools/verify/**`、`docs/plans/stages/S4/test-report.md` | tester | 只读 |
| `README.md`、`S4/{acceptance,progress}.md`、archive、git | acceptance | 只读 |
| `schema/**`、`docs/contracts/{transport,event-model,status-semantics}.md`、S0–S3 fixture、demo、S0–S3 文档 | 冻结 | 一律只读 |

## 7. 架构（S4 数据流）

```text
IDEA/JAR（用户应用 JDK8）                         collector 127.0.0.1:8601
  └─ javaagent ── 事件 NDJSON ───────────────────▶ ├─ ingest（唯一事件写通路）
       └─ 守护线程 POST /ingest/v1/agent-hello ───▶ ├─ agent-hello → 内存 handshake（last-wins）
                                                    ├─ GET .../agent（只读）
浏览器 ── preview 127.0.0.1:8602 ── 反代 ──────────▶ ├─ sessions/events/requests/graph/replay
  ├─ 注入 /traceboard/config.js + sdk.js（外部）      └─ meta/health
  ├─ SDK IIFE 自动 init → /ingest/* ────────────────┘
  └─ 其余 HTML/资源/API → --target（用户应用）
launcher（JDK21）── spawn/健康/日志/PID/stop、preview、diagnose（只读检查）
工作台 5173 ── /api 只读查询 + 既有时间轴/回放；S4 详情/×N/缺口为纯前端派生
```

## 8. 门禁顺序

`dispatcher → plan-writer → plan-reviewer(G1) → (coder-launcher ∥ coder-handshake ∥ coder-sdk ∥ coder-workbench) → tester → acceptance(G2，commit+tag s4-baseline) → 阶段备份/总结`

- G1 前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 上报，不降级。
- G1 冻结：api S4 章节、guide、S4 fixture、s4-plan、dispatch 的 SHA256；之后改字段/形状必须停回本流程。
- 四个 coder 可并行，契约/guide/fixture 是唯一事实输入；workbench 可用 G1 fixture 离线开发。
- S4 到达检查点即停；**不得开始 S5（L1/sourcemap/构建插件）**。

## 9. 环境事实（不得改写）

- Windows 10 + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，命令/路径全双引号）。
- JDK8 `C:/Program Files/Java/jdk1.8.0_221`（demo/agent 运行）；JDK21 `C:/Program Files/Java/jdk-21`（根/collector/launcher）；Maven 3.9.5；Node 22/npm 10。
- 端口：collector 8601（仅 127.0.0.1）、demo 8080、workbench 5173、demo 前端 5174、**preview 8602**；测试临时 HTML stub 用 18080（仅测试，finally 释放）；冲突先诊断。
- 无第三方镜像/CDN/在线字体/遥测；Maven Central/npm 官方源；无 secret/真实客户数据；git 分支 `master`、无 remote、仅 acceptance 写 git。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| CSP 拦截注入（nonce/hash-only `script-src`） | 只用同源外部 script（无内联）；不改 CSP；`X-TraceBoard-Preview: not-injected:*` + guide/诊断如实写“标签已注入、执行未验证（无 CDP）”；建议构建插件留 S5 |
| `</body>` 缺失/压缩/SPA 壳 | 上游 `Accept-Encoding: identity`；2MB 上限；`not-injected:no_body/encoding/too_large`；guide 说明只处理 outer HTML |
| 应用绝对 URL/302 绕过预览，导致 CORS/未采集 | 不改写 URL/Location；guide 要求相对路径或直接访问原地址；诊断只检查预览根/脚本可达，不宣称全站代理 |
| JDK8 spawn/路径中文空格/版本错 | `ProcessBuilder` argv 不经 shell；绝对路径；`--java` 校验；demo JDK8 + major 52 门禁；失败给 `JAVA_NOT_FOUND/APP_EXITED/HEALTH_TIMEOUT` |
| 握手时序（应用先于 collector / collector 重启） | premain 守护线程异步、≤3 次退避、fail-open；guide 要求先起 collector；diagnose 404 给出原因；不阻塞、不伪造 |
| ×N fixture 被当运行时能力 | fixture README/UI 明确“运行时 ×3=S6、本目录仅 UI/测试数据”；门禁扫描“×3 已支持”类文案；S4 只聚合已采集 span |
| 诊断“假成功” | 七项检查分级 PASS/FAIL/WARN/SKIP；无 preview=SKIP 不计 PASS；0 事件 WARN；任何 FAIL exit 3；不宣称 SDK 执行/浏览器成功 |
| 端口冲突/静默改端口 | preview 8602/其余固定；冲突先诊断并报告占用；测试 finally 清理；不静默换端口 |
| PID 复用/误杀 | PID 文件 JSON 记录 java/jar；stop 校验 commandLine 含 jar，否则 `PID_MISMATCH` 拒绝；destroy→5s→forcible |
| 多应用同 session | hello last-wins；agent 状态只反映最后握手；guide 建议一应用一 session；诊断展示 pid/startedAt 供辨识 |
| SDK IIFE 新增 esbuild | 官方 npm + lockfile；无 CDN；`build`/`test` 覆盖；无 sourcemap |
| 工作台误加 S5/S6 | G1 冻结 + S3-6/S2-6 迁移仍禁 sourcemap/values/L2/图库；dist 扫描 |

## 11. 停止条件与出口纪律

1. 必须改 schema/事件类型/枚举才能握手或详情，或必须引入 `values[]`/局部变量/sourcemap/构建插件（S5）才能达标。
2. 必须伪造诊断 PASS、用 fixture 冒充运行时 ×3/握手/注入执行，或必须改 CSP/内联脚本/外部 CDN/TLS 才能注入。
3. agent 握手必须阻塞 premain 或让应用启动/请求失败；JDK8 spawn 无法在含中文/空格路径下工作且无法给出可执行诊断。
4. 必须改 S3 既有语义/契约形状、放宽 S2/S3 门禁、改他人路径或引入 S6 能力。
5. G1 FAIL 且一轮返工后仍 FAIL；测试未绿但 owner 想“先提交”；出现 secret/真实数据/第三方镜像。
6. S4 只证明“本地接入（IDEA/JAR/预览/诊断）+ 握手 + 节点详情/×N 显示/缺口”；README/报告必须注明无 S5 源码/变量能力、运行时 ×3 是 S6、预览受 CSP/HTML 限制；S4 通过也不得宣称产品完成，S5 需新的分发书。
