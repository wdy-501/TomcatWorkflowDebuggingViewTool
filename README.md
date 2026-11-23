# TraceBoard

面向本地 Java（Spring Boot）Web 应用的“全链路事实”调试工具。当前处于 **S1（walking skeleton）**：
一条**假前端事件**（点击/请求 → collector → 工作台读回）+ 一个**真实插桩**的 controller span（agent → collector）已打通；
不做关联、不做图/时间轴/回放。S2 需新的分发书授权，本仓库当前状态不代表 S2 能力。

## S1 已真实可用（均可复跑验证）

- **collector ingest**：`POST /ingest/v1/events` 接受 `application/x-ndjson`，按 `415 → 413 → 400 → 逐行` 判定；
  预算 4MB/1000 行/64KB；逐行冻结 schema 校验；幂等键 `(sessionId,traceId,spanId)` 去重（重复计 `dropped`）；
  内存 append-only、`seq` 连续；成功返回 `202 {"accepted","rejected","dropped","errors"}`；无 DB/文件/CORS/429。
- **只读查询**：`GET /api/v1/sessions`（eventCount/startedAtMs/lastEventAtMs）与
  `GET /api/v1/sessions/{sessionId}/events?afterSeq=&limit=`（`{"seq","event"}` 包装、`nextSeq`、1..500、404/400/405）；
  这是**会话查询**，不是回放。
- **一个真实 controller span**：Byte Buddy（shaded 1.14.19）只插桩 demo 的
  `com.example.shop.controller.OrderController#cancel(long)`；方法退出时发 1 条 `controller` span
  （`confidence=LOST`、`parentSpanId=null`、`rootEventId=click_lost_<spanId>`、flags 含 `LOST_BACKEND`），
  逐 span 随机 `traceId/spanId`；collector 停机不影响 demo（fail-open，单守护线程、有界队列 16、300/700ms、不重试）。
- **工作台闭环**：S1 面板按钮 `#btn-s1-fake` 每次生成 2 条 schema 合法假事件（`ui_event` → `fetch`，新 traceId/rootEventId）
  → `POST /ingest/v1/events` → 一次有界读回 → 原始事件表（`seq/type/kind/status/nodeKey`）；S0 fixture 事实面板保留。

## S1 明确未实现（勿据此承诺）

- 不采集 service/mapper/SQL/JDBC、行数、SQL 文本/参数、`values`/`sideEffects`；demo 业务未改。
- **无关联**：假前端事件与真实 agent span 互不关联（无浏览器 SDK、无 traceparent/clickId 传播、无合并/推断）；
  工作台只读 `s_wb_demo`，**不展示** agent 的 `s_s1agent` span。
- 无图、无时间轴、无回放、无请求切换/节点详情、无 SSE/WebSocket/轮询；`capabilities` 中 `realtime=false`、`replay=false`。
- 无持久化：collector 只在内存存储，**重启即清空**；无鉴权、无 CORS、无 429 背压；仅监听 `127.0.0.1:8601`。
- 无 launcher/cloud/Tomcat/React/MySQL；workbench 的 `/ingest`、`/api` 代理**只在 `npm run dev` 生效**，
  `npm run preview`/静态托管 `dist/` 无代理，S1 面板会显示 collector 不可达。
- 下一检查点为 **S2**，需新的分发书授权；S1 通过不构成 S2 开工许可。

## 前置条件

| 依赖 | 版本/位置 | 用途 |
|---|---|---|
| JDK 21 | `C:/Program Files/Java/jdk-21`（21 LTS） | 根 reactor、collector 构建与运行（agent 字节码仍为 Java 8 / major 52） |
| JDK 8 | `C:/Program Files/Java/jdk1.8.0_221`（本机默认 `JAVA_HOME`） | demo 后端构建与运行（`-javaagent` 要求 JDK8 运行 demo） |
| Maven | 3.9.5 | 所有 Java 构建（只用 Maven Central，无第三方镜像） |
| Node.js / npm | Node 22.x / npm 10.x | workbench、demo 前端、`tools/verify` |

Windows + Git Bash；仓库路径含中文与空格，**所有命令与路径必须双引号**，并在仓库根执行。

## 构建（精确命令）

```bash
# 根 reactor（agent + collector），必须就地覆盖 JAVA_HOME 为 JDK21
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package

# demo 后端：独立工程（非 reactor 子模块），用 JDK8 构建
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# workbench 前端（vue-tsc 严格 + vite build）
(cd "workbench" && npm ci && npm run build)

# demo 前端（可选，仅 S0 演示）
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
```

产物：`agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar`（major 52、shaded Byte Buddy）、
`server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar`（内含唯一一份根 schema 副本，字节等价）、
`demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar`。

## 本地启动（按顺序；先 collector，再 demo/工作台）

```bash
# 1) collector（JDK21，仅 127.0.0.1:8601；内存存储，重启即清空）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
# 另开终端：
curl -s "http://127.0.0.1:8601/actuator/health"   # {"status":"UP"}
curl -s "http://127.0.0.1:8601/api/v1/meta"       # capabilities.ingestEvents=true / realtime=false / replay=false

# 2) demo 后端（JDK8 + agent；-javaagent 与 -D 必须写在 -jar 之前）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s1agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
# 另开终端：
curl -s "http://localhost:8080/api/orders"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"   # {"data":true}

# 3) workbench（Vite dev server，5173；/ingest 与 /api 经代理到 127.0.0.1:8601）
(cd "workbench" && npm run dev)   # 打开 http://localhost:5173，点击“发送假点击/请求”

# 4) demo 前端（可选，5174；仅调用自身 8080，不接 collector）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)
```

- agent 的 `-Dtraceboard.traceId` **默认不设置**：每个 span 随机 `traceId`（S1 无关联，逐 span 独立）；
  该参数只用于单 span 诊断，设置后多次调用会共享同一 `traceId`，不要用于演示。
- 不设置 `-javaagent`/`-D` 参数时 demo 回到 S0 行为（无采集）。
- 停止：前台 `Ctrl+C`；后台运行则 `taskkill //PID <pid> //T //F`，并用
  `netstat -ano | grep -E ":(8601|8080|5173|5174)\s" | grep LISTENING` 确认端口已释放。

## 冒烟（contract smoke）

```bash
# 假前端批次：2 行 NDJSON → 202 accepted=2（重发同批 → dropped=2）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson"
curl -s "http://localhost:8601/api/v1/sessions"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200"

# 真实 agent span：每次 cancel 生成 1 条 controller span
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s1agent/events?afterSeq=0&limit=200"

# 负例：415 / 400 / 404 / 405
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/json" --data-binary '{}'
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/events"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions"
```

期望：`health=UP`；ingest `202 {"accepted":2,...}`；`s_wb_demo` eventCount=2、事件页 `seq 1,2`、`nextSeq=2`；
`cancel` 返回 `{"data":true}` 后 `s_s1agent` 有 1 条 `kind=controller`、`nodeKey=...#cancel`、`confidence=LOST`、
flags 3 项（`SKELETON`/`S1_ONE_METHOD`/`LOST_BACKEND`）、`durNs>0`；负例 `415/404/405`。

## 校验（独立复跑，勿只看报告）

```bash
(cd "tools/verify" && npm ci && node verify.mjs)
# 或已装依赖后：
node tools/verify/verify.mjs
```

期望：**35 项 PASS / 0 FAIL**、末行 `S1 TEST: PASS`、退出码 0。任一项失败即非零退出，并打印 `repro:` 命令。
脚本会自行构建、起停 collector/demo（含 `-javaagent`）与 fail-open 检查，结束时清理进程与端口。

## 地址与运行限制（IPv4 / IPv6）

- collector **只绑定 `127.0.0.1:8601`（IPv4）**；agent 默认 ingest URL 也是 `http://127.0.0.1:8601/ingest/v1/events`。
  直连 collector 时建议写 `http://127.0.0.1:8601`（`localhost` 可能先解析到 `[::1]`，curl/Node 能否回退到 IPv4 取决于实现）。
- Vite dev server 绑定 `localhost`（Windows 上可能是 `[::1]`）；浏览器请统一打开 `http://localhost:5173`。
- workbench 的代理 target 固定为 `http://127.0.0.1:8601`，浏览器同源经代理访问，**不依赖 CORS**；
  该代理仅在 `npm run dev` 生效，`npm run preview`（4173）/静态 `dist/` 无代理，S1 面板会报“collector 不可达”。
- 端口：collector 8601、demo 8080、workbench 5173、demo 前端 5174；冲突时先诊断，不静默改端口。
- collector 无鉴权、无持久化、无淘汰，仅用于本机演示；不要暴露到非回环网络。

## 契约与 fixture

- `schema/traceboard.event.v1.json`：事件 schema v1（2020-12，`$id=urn:traceboard:schema:event:v1`，无网络 `$ref`）。
- `fixtures/s1-walking-skeleton/`：`frontend-fake-batch.ndjson`（2 行假批次）、`agent-controller-span.json`（单条游离后端根）、
  `expected-facts.json`（8 条 fact + 分来源全局断言）。
- `fixtures/case-a-zero-rows/`：S0 保留的 9 行 0 行案例（全部 `status=OK`、`confidence=EXACT`、`DROP_COUNT=0`）。
- 工作台只展示记录到的事实，不判定“这是 bug”；换行策略由根 `.gitattributes` 保护（`*.jsonl/*.json/*.md/*.java/*.ts/*.vue` 强制 LF）。

## 文档索引

| 路径 | 内容 |
|---|---|
| `docs/plans/README.md` | 单人计划入口 |
| `docs/plans/SOLO-PLAN.md` | 检查点 S0–S10 与自检协议 |
| `docs/plans/00-master-plan.md` | 产品主计划（技术事实权威） |
| `docs/plans/stages/S1/dispatch.md` | S1 任务分发书 |
| `docs/plans/stages/S1/s1-plan.md` | S1 实施计划（含 D1–D16 偏离记录） |
| `docs/plans/stages/S1/plan-review.md` | 契约评审 G1 PASS + 冻结哈希 |
| `docs/plans/stages/S1/test-report.md` | 测试报告（35 项） |
| `docs/plans/stages/S1/acceptance.md` | G2 验收结论与证据 |
| `docs/plans/stages/S1/progress.md` | S1 进度包 |
| `docs/plans/archive/stage-S1-2026-11-23/` | S1 归档快照（MANIFEST/SUMMARY） |
| `docs/contracts/` | 四份 v1 契约（api/transport/event-model/status-semantics） |
| `workbench/README.md` | 工作台 S1 面板、代理与 preview 限制 |
