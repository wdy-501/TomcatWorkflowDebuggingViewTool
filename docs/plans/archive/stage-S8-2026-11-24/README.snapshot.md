# TraceBoard

面向本地 Java（Spring Boot / Tomcat）Web 应用的“全链路事实”调试工具。当前完成 **S8（Tomcat 8.5 + SSM WAR 第三栈，V1 本地矩阵）**：

- S0 契约/骨架 → S1 ingest/查询 → S2 真实 H2 0 行 → S3 runtime SDK/EXACT/回放 → S4 launcher/preview/详情×N → S5 L1/manifest → S6 L2/异步 → S7 React18 + Webpack5 基础 → **S8 Tomcat 8.5 WAR/SSM：案例 A 4-span EXACT（SQL 0 行）、案例 B 零请求、三栈本地矩阵**。
- 仍**没有** S9–S10：云端上传/沙箱/DB/发布；Tomcat 仅本机 8.5/JDK8 基础，未做 9/10.1、未做云端 WAR。
- 案例 A/B/L1/S6/S7 行为不变；S8 复用现有 agent 同 FQCN，不新增采集字段。

## 已真实可用（S0–S6，均可复跑）

- **Java agent（JDK8 目标，major 52）**：Byte Buddy 插桩 demo 的 `OrderController#cancel`、`OrderService#cancel`、MyBatis `OrderMapper#cancelById`、`PreparedStatementHandler#update`，形成 controller→service→mapper→sql 4-span 链；SQL `rowsAffected=0`、transaction `UNKNOWN`；异步有界发送、fail-open。
- **EXACT 关联**：浏览器 SDK 在 fetch 上带 `traceparent` + `X-TraceBoard-Click`；agent 反射读头，controller 继承 trace/parent/root，children 继承 EXACT；无头/非法头保持 S2 的 4-span `LOST` 链，不合成成功。
- **agent 握手/诊断**：agent premain 异步 POST `/ingest/v1/agent-hello`；collector `GET /api/v1/sessions/{id}/agent` 返回 connected/version/pid/lastSeen；launcher `diagnose` 做 7 项 PASS/FAIL/WARN/SKIP 检查。
- **collector（JDK21，内存 append-only）**：NDJSON ingest（202/400/413/415、逐行 schema 校验、幂等、seq）；sessions/events/requests/graph 只读派生；`replay` 只读时间窗（0 写）；meta 5 键（`ingestEvents=true,realtime=false,replay=true`）。
- **runtime SDK（`frontend/sdk`）**：ESM + IIFE 两种产物；点击/fetch/XHR/wrapFn/uiEffect；案例 A（0 行 + EXACT）与案例 B（纯前端校验，1500ms 观察窗后 `fetchCount=0`，确认本次点击没有请求）；不采集请求体/表单值/cookie/query。
- **workbench（Vue3+TS）**：S3 混合事实树/状态图例/时间轴只读回放；**S4 节点详情**（status/reason/return/flags/thread/source/confidence、SQL/UI 页签、逐次调用、按 nodeKey ×N、缺口清单）；S0/S1/S2 面板保留为次级。
- **launcher（`server/launcher`，Java21）**：`idea` 打印 IDEA VM options；`jar` 用 JDK8 启动 demo+agent（detach/PID/日志/健康等待）、`stop`；`preview` 反代静态 HTML 并注入外部 `config.js`+`sdk.js`（仅 200 text/html、无内联脚本/CSP 改写、`not-injected:*` 原因）；`diagnose` 复核 collector/app/handshake/events/preview/SDK。
- **S5 L1 + 前端浅层**：demo `preview-discount` 在内存把 `amount 100→0`、DB 仍 100；agent 采 5 项 values（`requestedAmount` 100、`demoSecret` `[REDACTED len=6]`、`note` 截断 2KB、`amount` 100→0、`return` 0），不采局部变量/L2；graph 增加 `values`（15 字段）；workbench 详情显示 L1/脱敏/截断/old→new；`frontend/build-plugin` 生成函数 manifest，SDK 写入 `source {file,line}` + `SOURCE_MAPPED`；demo 开启 `build.sourcemap`。性能基线 ratio 1.29（WARN）。
- **S6 L2 + 异步**：`L2DemoService#reconcileAmount` ASM 行探针，第 2 次调用 `local 100→0`（行 23/25）；`reconcileBatch` ×3 逐次可指哪次坏；`reconcileAsync` 新建 worker 线程继承上下文（`ASYNC_INHERITED`，长生命周期池/@Async/CompletableFuture 不自动传播）；`NoDebugService#compute` 无 LVT → `NOT_COLLECTED_NO_DEBUG_INFO` + reason、无 values；`reconcileLoop` 100 次 local 写入折叠为 20 样本（`VALUES_CAPPED=82`/`VALUES_TOTAL=102`、`TRUNCATED`、坏 `50→0` 保留）；L2 perf ratio **1.037**。
- **S7 React18 + Webpack5（本地基础）**：`demo/buggy-shop-boot-react/frontend/`（5175）复用 Boot/H2 后端；案例 A `#btn-cancel` 经 devServer `/api` 代理形成 click→fetch→controller→service→mapper→sql→render 7 span、全部 EXACT、SQL `rowsAffected=0`；案例 B `validateForm` 纯前端 `RETURNED_FALSE`、3 span、`fetchCount=0`；SDK 经 `/ingest` 代理发事件。**无** React 构建插件/sourcemap/组件映射/JS 局部变量；静态 dist 无代理。
- **S8 Tomcat 8.5 + SSM WAR（本地基础）**：`demo/buggy-shop-ssm-war/`（JDK8、ROOT.war、8081、Spring MVC/MyBatis/H2）复用 agent 同 FQCN 4 点插桩；案例 A 带 header cancel 4 后端 span 全 EXACT、SQL 0 行、订单 CREATED；preview 注入 SDK 后 A 7 事件/B 3 事件。Tomcat 启动需 `-Djava.util.logging.manager=java.util.logging.LogManager`（规避 agent hello/JULI 死锁）；仅本机 8.5/JDK8。

## 明确未实现（勿据此承诺）

- **无 S9–S10**：云端上传/沙箱/DB/发布；Tomcat 仅本机 8.5 基础，未做 9/10.1、云端 WAR；无 SSE/WS/持久化。
- **S6 限制**：L2 仅 `L2DemoService#reconcileAmount/reconcileLoop` 等选中方法；行级字段写入/对象深采/多方法 L2 未支持；异步只在**新建线程创建时**继承（长生命周期池、`@Async`、`CompletableFuture` 不自动传播）；no-debug 仅 `NoDebugService#compute`（antrun `debug=false`）；loop 折叠保留首/尾/样本非全量；L2 perf 为本地短请求基线。
- **S7 限制**：React18/Webpack5 仅本地基础、复用现有 Boot 后端；无 JS 源码位置/组件树/JS 局部变量/回调内部；无构建插件/manifest/sourcemap；只有 devServer 代理路径，静态 `dist` 无代理；未做 React 生产发布。
- **S8 限制**：仅 Tomcat 8.5.60/JDK8 本机、ROOT.war；SSM 只做案例 A/B，无 L1/L2/异步；页面需 launcher preview 注入 SDK；Tomcat 启动必须加 `-Djava.util.logging.manager=java.util.logging.LogManager`；无截图证据（浏览器 surface 不可见）；未做 9/10.1、云端 WAR、CI 矩阵。
- 无 SSE/WebSocket/实时推送；workbench 5 秒轮询；replay 只隐藏未来事件，不重跑程序、不重发请求、不写数据库。
- collector/H2 均为内存存储，重启即清空；agent 握手记录 collector 重启即丢；无鉴权/保留/淘汰/CORS。
- preview 注入仅在 `npm run dev` 的反代路径验证；Vite 的 `preview`/静态 dist 无代理。CSP 只允许 nonce/hash 的站点可能阻止外部脚本执行，launcher 只报“已注入”，不谎称“已执行”。
- **真实新手用户接入测试未做**（需人工 3–5 人）；本阶段只验证文档命令 + 自动化 launcher/preview/diagnose 路径。

## 前置条件

| 依赖 | 位置/版本 | 用途 |
|---|---|---|
| JDK 21 | `C:/Program Files/Java/jdk-21` | 根 reactor（agent+collector+launcher）构建；collector/launcher 运行 |
| JDK 8 | `C:/Program Files/Java/jdk1.8.0_221` | demo 后端构建/运行（`-javaagent` 真实验证） |
| Maven 3.9.5 | PATH | 所有 Java 构建（Maven Central，无第三方镜像） |
| Node 22 / npm 10 | PATH | SDK、workbench、demo 前端、tools/verify |

Windows + Git Bash；仓库路径含中文与空格，**所有路径/命令加双引号**，在仓库根执行。

## 构建

```bash
# 1) SDK（ESM + .d.ts + IIFE；17 tests）
(cd "frontend/sdk" && npm ci && npm run build && npm test)
# 1b) 前端浅层插件（manifest 扫描；6 tests）
(cd "frontend/build-plugin" && npm test)

# 2) 根 reactor（agent + collector + launcher），JDK21
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package

# 3) demo 后端（独立工程，JDK8）
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# 4) workbench / demo 前端
(cd "workbench" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)

# 5) S7 React 前端（先确保 frontend/sdk/dist 已构建）
(cd "demo/buggy-shop-boot-react/frontend" && npm ci && npm run build)

# 6) S8 Tomcat SSM WAR（JDK8；部署到 Tomcat 8.5 的独立 CATALINA_BASE）
(cd "demo/buggy-shop-ssm-war" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)
```

产物：`agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar`（major 52、shaded Byte Buddy）、
`server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar`、
`server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar`、
`demo/.../target/demo-shop-backend-0.1.0-SNAPSHOT.jar`（内嵌 H2）、
`frontend/sdk/dist/{index.js,index.d.ts,traceboard-sdk.iife.js}`。

## 本地启动（手动路径，S3/S4 事实）

```bash
# 1) collector（JDK21，127.0.0.1:8601）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"

# 2) demo 后端（JDK8 + agent；-javaagent/-D 在 -jar 前；session 自选）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s4demo \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"

# 3) demo 前端（5174）与 workbench（5173）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)
(cd "workbench" && npm run dev)
```

浏览器打开 `http://localhost:5174`：案例 A 取消成功但订单仍 `CREATED`；案例 B 金额≤0 显示错误且零请求。
工作台 `http://localhost:5173` 输入会话（如 `s_s4demo`/`s_s4detail`），查看请求、节点、详情、×N、缺口、时间轴。

## 本地接入（S4 launcher）

指南：[`docs/guides/local-launcher.md`](docs/guides/local-launcher.md)。

```bash
LAUNCHER="server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar"
JAVA21="C:/Program Files/Java/jdk-21/bin/java"
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"
AGENT="agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar"
DEMO="demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
COLLECTOR="http://127.0.0.1:8601"

# IDEA：复制打印的 VM options 到 Run Configuration（不启动进程）
"$JAVA21" -jar "$LAUNCHER" idea --jar "$DEMO" --agent "$AGENT" --collector "$COLLECTOR" --session s_s4idea

# JAR：JDK8 启动 demo+agent（detach；PID/日志在 work/）
"$JAVA21" -jar "$LAUNCHER" jar --jar "$DEMO" --agent "$AGENT" --collector "$COLLECTOR" \
  --session s_s4launcher --java "$JAVA8" --port 8080 --detach --pid-file work/s4.pid

# 诊断（collector/app/handshake/events；有 preview 时加 --preview-url）
"$JAVA21" -jar "$LAUNCHER" diagnose --collector "$COLLECTOR" \
  --app-url http://localhost:8080/api/orders --session s_s4launcher

# 停止
"$JAVA21" -jar "$LAUNCHER" stop --pid-file work/s4.pid

# 预览注入（目标必须是静态 HTML；演示站 5174 已内置 SDK，不用于本命令）
"$JAVA21" -jar "$LAUNCHER" preview --target http://127.0.0.1:18080 --port 8602 \
  --collector "$COLLECTOR" --session s_s4preview
# 浏览器访问 http://127.0.0.1:8602；只注入外部 config.js/sdk.js，不内联、不改 CSP
```

## S7 React18 + Webpack5 第二栈（本地基础，复用后端）

```bash
# SDK 先构建；React 依赖 file: frontend/sdk
(cd "frontend/sdk" && npm run build)
(cd "demo/buggy-shop-boot-react/frontend" && npm ci)

# 1) collector 8601；2) 复用 Boot/H2 后端 + agent（会话必须 s_s7react）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s7react -Dserver.port=8080 \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"

# 3) React dev 5175（/api→8080、/ingest→8601，同源代理）与 workbench 5173
(cd "demo/buggy-shop-boot-react/frontend" && npm run dev)
(cd "workbench" && npm run dev)
```

浏览器 `http://localhost:5175`：案例 A 取消成功且订单仍 `CREATED`；案例 B 金额 0 显示错误、零请求。
工作台 `http://localhost:5173` 输入 `s_s7react`：A 为 7 节点/4 后端/SQL 0 行/EXACT；B 为 3 节点、`fetchCount=0`、已确认没有网络请求。
静态 `dist` 只证明本地产物，不含代理；S7 通过路径是 devServer。

## 校验（独立复跑）

```bash
(cd "tools/verify" && npm ci && node verify.mjs)
# 期望：S0–S6 全量 75 PASS / 0 FAIL，末行 S6 TEST (full S0–S6): PASS，exit 0

(cd "tools/verify" && node s7-react.mjs)
# 期望：S7 TEST (React18/Webpack5): PASS；--no-e2e 仅做静态组

(cd "tools/verify" && node s8-tomcat.mjs)
# 期望：18 PASS / 0 FAIL；S8 TEST (Tomcat/SSM): PASS（构建 WAR + 隔离 Tomcat + 4-span）
```

覆盖：S0 契约/fixture；S1 ingest/查询；S2 H2 0 行/4-span/DB 不变；S3 SDK/案例 B/EXACT/replay 0 写；
S4 launcher/握手/preview/详情×3/缺口；S5 L1 values/manifest；S6a 行级/×3；S6b async/no-debug/loop；S0–S5 回归、范围/安全/清理。
S7 React18/Webpack5：独立 35 项（A 构建/产物、B 静态契约、C 代理/4-span EXACT/E2E fail-open、D serving/workbench、E 范围/freeze/清理），见 `tools/verify/s7-react.mjs`。
性能基线（report-only）：`node tools/perf/l1-overhead.mjs` / `node tools/perf/l2-overhead.mjs` → L1 ratio 1.29 WARN；L2 ratio 1.037。
冷启动嵌套回归：`node work/flake-nesting.mjs`（S4 已修复）。

## 地址与限制

- collector/launcher preview 只绑 `127.0.0.1`；浏览器入口用 `localhost`（Vite 可能绑 `[::1]`）。
- 端口：collector 8601、demo 8080、workbench 5173、Vue demo 前端 5174、React demo 5175、Tomcat SSM 8081、preview 8602、Vite preview 4173/4174、静态测试 18080。
- 代理仅在 dev 生效；静态 dist 无代理。H2/collector 无持久化，重启清空。
- S5 demo 前后端需同一会话：demo 前端 SDK 使用 `s_s3demo`，后端 agent 也必须用 `-Dtraceboard.sessionId=s_s3demo` 才能 EXACT 关联。
- git 分支 `master`；无 secret/真实客户数据；不暴露到非回环网络。

## 契约与 fixture

- `schema/traceboard.event.v1.json`：v1 schema（2020-12，无网络 `$ref`；S5 字节不变）。
- `fixtures/s5-l1-values/`：L1 values 100→0/脱敏/截断、return 0 的测试数据；`fixtures/s4-details/`：×3/缺口 UI 测试数据（README 明确：运行时 ×3 属 S6，不是运行时证据）。
- `fixtures/s3-frontend-facts/`、`s2-zero-row-chain/`、`s1-walking-skeleton/`、`case-a-zero-rows/`：历史阶段 fixture（字节未变）。
- 契约：`docs/contracts/api.v1.md`（S5 graph 15 字段/values/preview-discount）、`transport.v1.md`（preview/握手）、`event-model.v1.md`（values/L1/SOURCE_MAPPED）、`status-semantics.md`。
- 前端浅层插件说明：`docs/guides/frontend-shallow-plugin.md`。
- 换行：`.gitattributes` 强制 jsonl/ndjson/json/md/java/ts/vue 为 LF。

## 文档索引

| 路径 | 内容 |
|---|---|
| `docs/plans/STAGE-PROGRESS.md` | **S0–S10 进度看板（持久化；暂停/恢复以此为准）** |
| `docs/plans/SOLO-PLAN.md` | 检查点 S0–S10 与自检协议 |
| `docs/plans/00-master-plan.md` | 产品主计划（技术事实权威） |
| `docs/guides/frontend-shallow-plugin.md` | S5 manifest/sourcemap 浅层插件说明 |
| `docs/plans/stages/S5/` | S5 分发/计划/G1/测试/验收/进度 |
| `docs/plans/stages/S6/` | S6 分发/计划/G1/测试/验收/进度（s6a/s6b） |
| `docs/plans/stages/S7/` | S7 分发/计划/G1/测试/验收/进度（React18/Webpack5 基础） |
| `docs/plans/stages/S8/` | S8 分发/计划/矩阵/测试/审阅/验收（Tomcat 8.5/SSM WAR） |
| `docs/guides/local-launcher.md` | IDEA/JAR/preview/diagnose 接入指南 |
| `docs/plans/stages/S4/` | S4 分发/修订/计划/G1/测试/验收/进度 |
| `docs/plans/archive/stage-S4-2026-11-23/` | S4 归档快照（MANIFEST/SUMMARY） |
| `docs/contracts/` | v1 契约（api/transport/event-model/status-semantics） |
| `frontend/sdk/`、`workbench/`、`server/launcher/` | SDK、工作台、启动器 |