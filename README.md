# TraceBoard

面向本地 Java（Spring Boot）Web 应用的“全链路事实”调试工具。当前处于 **S2（0 行事实链，MVP）**：
一个**故意缺陷**的 demo（取消返回成功，但 H2 `UPDATE ... AND status='PAID'` 命中 0 行、订单仍 `CREATED`）
已由**真实运行时**证据打通：demo H2/MyBatis 0 行 → Java agent 采集 4-span 后端链（Controller/Service/Mapper/SQL）
→ collector 只读派生 `requests`/`graph` → 工作台请求切换与 0 行事实板。

S2 只证明上述 0 行事实链；**无前端 SDK、无关联、无回放/时间轴、无实时**。4-span 链是 `confidence=LOST` 的
**游离后端请求**（无前端根），不是点击链的一环。S2 到此停止；**S3 需新的分发书授权**，本仓库当前状态不构成 S3 开工许可。

## S2 已真实可用（均可复跑验证）

- **demo 真实 0 行（非 fixture）**：Spring Boot 2.7.18 + MyBatis + 嵌入式 H2（`jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1`，
  `schema.sql`/`data.sql`，seed `id=1 / SO-0001 / CREATED / 100.00`；无 MySQL 服务）。
  `GET /api/orders` 读 DB；`POST /api/orders/1/cancel` 执行 `UPDATE ... WHERE id=? AND status='PAID'` 得 `rowsAffected=0`，
  Service 忽略返回值仍 `true`，返回 `200 {"data":true}`；未知 id 存在性检查为 0 → `404 {"data":false}`（不执行 cancelById）。
- **agent 4-span 链**：Byte Buddy（shaded 1.14.19）只插桩 4 点——`OrderController#cancel`、`OrderService#cancel`、
  `MapperProxy#invoke`（仅 `OrderMapper#cancelById`）、`PreparedStatementHandler#update`（仅 cancel mapped statement）。
  同一 `traceId`/`rootEventId`，父子正确、全部 `confidence=LOST`；根 `parentSpanId=null`、flags 含
  `S2_ZERO_ROW_CHAIN`+`LOST_BACKEND`；SQL `sideEffects.rowsAffected=0`/`transaction="UNKNOWN"`、Mapper `int 0`、
  Service `boolean true`、Controller HTTP 200；0 行是正常 `OK`（不是错误/THREW）。默认 session `s_s2agent`，每次请求独立 `traceId`。
- **collector 只读派生**：`GET /api/v1/sessions/{id}/requests`（按 traceId 分组、`spanCount`、rootKind/nodeKey/status/confidence/startedAtNs）
  与 `GET /api/v1/sessions/{id}/graph?traceId=<32hex>`（4 节点/3 边、按 `startNs` 排序、`return`/`sideEffects` 原样）。
  读时派生，两次 GET 一致且不改事件/`seq`；未知 session/trace → 404，缺失/非法 `traceId` → 400，写动词 → 405；
  不注册 `replay/stream/ws/links`，无 DB/文件/缓存。
- **工作台 S2 面板**：会话选择（默认 `s_s2agent`）+ 请求列表/tabs 切换（`#s2-requests`）+ 选中请求事实链（`#s2-chain`）；
  中性事实条 `Controller HTTP 200`、`Service 返回 true`、`Mapper 返回 0`、`SQL 影响 0 行`、`异常（THREW） 0`，
  常驻“事实摘要，不是缺陷结论”；LOST 显示“游离后端请求（无前端根）”；手动刷新 + 每 5 秒轮询（非实时）。
  S1 假面板折叠为次级（标注“假数据，非 S2 事实链”），S0 `FixturePanel` 保留。
- **demo 前端（5174）**：200 即显示“操作成功”并刷新列表，列表仍 `CREATED`——页面成功提示与 0 行并存，即案例 A 事实组合。
  页头文案已按 S2-AMD-01 改为案例 A 说明（**纯文案，无 SDK/行为变化**）。
- **fail-open**：collector 停机时 cancel 仍 `200 {"data":true}`（实测 3ms），demo 存活；丢弃/拒收仅在 stderr 计数。

## S2 明确未实现（勿据此承诺）

- **无浏览器 SDK/关联**：无 `traceparent`/clickId 传播、无 UI 事件采集、无关联引擎；工作台不画点击链，4-span 是 LOST 游离根。
- 无时间轴/回放/`replay` API/回放按钮/虚拟时钟；无 `links` 手工关联。
- 无 SSE/WebSocket/实时订阅；工作台仅手动刷新 + 5 秒轮询（明确标注“非实时”）。
- 无 `values[]`/字段 diff/参数值/L1–L2/异常 payload/栈；`THREW` 只记状态与 `return=null`。
- collector 不落 DB/文件、无淘汰/采样/缓存、无 CORS/鉴权/429；重启即清空；graph 读时派生。
- 无 launcher/cloud/Tomcat/React/MySQL 服务/上传/沙箱；H2 仅嵌入式。
- `countById`（未知 id 的存在性检查）**不插桩**：未知 id 链为 0 或 2 span（Controller 404 + Service `RETURNED_FALSE`），
  无 mapper/SQL，不伪造。
- 无持久化：demo H2 内存库重启回到 seed；collector 内存 append-only；workbench `preview`/静态 `dist/` 无代理。

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

# demo 前端（可选，仅本机演示）
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
```

产物：`agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar`（major 52、shaded Byte Buddy）、
`server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar`（内含唯一一份根 schema 副本，字节等价）、
`demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar`（内嵌 H2，无 MySQL 驱动）。

## 本地启动（按顺序；先 collector，再 demo/工作台）

```bash
# 1) collector（JDK21，仅 127.0.0.1:8601；内存存储，重启即清空）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
# 另开终端：
curl -s "http://127.0.0.1:8601/actuator/health"   # {"status":"UP"}
curl -s "http://127.0.0.1:8601/api/v1/meta"       # capabilities.ingestEvents=true / realtime=false / replay=false

# 2) demo 后端（JDK8 + agent；-javaagent 与 -D 必须写在 -jar 之前；session 默认即 s_s2agent）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s2agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
# 另开终端（案例 A）：
curl -s "http://localhost:8080/api/orders"                    # id=1 SO-0001 CREATED 100.0（来自 H2）
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"   # {"data":true}，但随后列表仍 CREATED（真实 0 行）
curl -s -X POST "http://localhost:8080/api/orders/999/cancel" # {"data":false}（未知 id，404）

# 3) 读回 agent 4-span 事实链（只读派生，不改事件）
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
# 从上面的响应复制 32 位小写 hex traceId，替换 <traceId>：
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=<traceId>"
# 期望：requests 每个 cancel 一条（spanCount=4、rootKind=controller、status=OK、confidence=LOST）；
#       graph 4 nodes / 3 edges、SQL rowsAffected=0 / transaction=UNKNOWN、Mapper 0、Service true、Controller 200。

# 4) workbench（Vite dev server，5173；/ingest 与 /api 经代理到 127.0.0.1:8601）
(cd "workbench" && npm run dev)   # 打开 http://localhost:5173，选择会话 s_s2agent，点击“刷新”

# 5) demo 前端（可选，5174；仅调用自身 8080，不接 collector）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)
```

- agent 的 `-Dtraceboard.traceId` **默认不设置**：每次 cancel 独立 `traceId`；该参数只用于单请求诊断，
  设置后多次调用会共享同一 `traceId`，不要用于 requests 排序/并发演示。
- 不设置 `-javaagent`/`-D` 参数时 demo 回到 S0 行为（无采集）；demo 业务缺陷仍然存在。
- 停止：前台 `Ctrl+C`；后台运行则 `taskkill //PID <pid> //T //F`，并用
  `netstat -ano | grep -E ":(8601|8080|5173|5174)\s" | grep LISTENING` 确认端口已释放。

## 冒烟（contract smoke）

```bash
# requests / graph（先制造一次 cancel）
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=<32hex>"

# 负例：缺失/非法 traceId → 400；未知 session/trace → 404；写动词 → 405；保留路由 → 404
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/requests"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions"
```

期望：`health=UP`；cancel `200 {"data":true}` 且列表仍 `CREATED`；requests 每次 cancel 一条、`spanCount=4`、
root `controller`、`status=OK`、`confidence=LOST`；graph 4 节点/3 边、SQL `rowsAffected=0`/`UNKNOWN`；
缺失/非法 traceId `400`，未知 `404`，写动词 `405`；错误信封 `{error,message,apiVersion}` 不回显请求体。

## 校验（独立复跑，勿只看报告）

```bash
(cd "tools/verify" && npm ci && node verify.mjs)
# 或已装依赖后：
node tools/verify/verify.mjs
```

期望：**42 项 PASS / 0 FAIL**、末行 `S2 TEST: PASS`、退出码 0。任一项失败即非零退出，并打印 `repro:` 命令。
脚本会自行构建（根 JDK21 / demo JDK8 / workbench / demo 前端）、起停 collector/demo（含 `-javaagent`）、
执行 4-span E2E、requests/graph、fail-open、漂移与范围/安全检查，结束时清理进程与端口。

## 地址与运行限制（IPv4 / IPv6）

- collector **只绑定 `127.0.0.1:8601`（IPv4）**；agent 默认 ingest URL 也是 `http://127.0.0.1:8601/ingest/v1/events`。
  直连 collector 时建议写 `http://127.0.0.1:8601`（`localhost` 可能先解析到 `[::1]`，curl/Node 能否回退到 IPv4 取决于实现）。
- Vite dev server 绑定 `localhost`（Windows 上可能是 `[::1]`）；浏览器请统一打开 `http://localhost:5173`。
- workbench 的代理 target 固定为 `http://127.0.0.1:8601`，浏览器同源经代理访问，**不依赖 CORS**；
  该代理仅在 `npm run dev` 生效，`npm run preview`（4173）/静态 `dist/` 无代理，S2 面板会报“collector 不可达”。
- 端口：collector 8601、demo 8080、workbench 5173、demo 前端 5174；冲突时先诊断，不静默改端口。
- collector 无鉴权、无持久化、无淘汰，仅用于本机演示；不要暴露到非回环网络。
- git 分支为 `master`（无 remote）；本仓库无 secret/真实客户数据。

## 契约与 fixture

- `schema/traceboard.event.v1.json`：事件 schema v1（2020-12，`$id=urn:traceboard:schema:event:v1`，无网络 `$ref`）；S2 **未改**字段/枚举/约束。
- `fixtures/s2-zero-row-chain/`：4 行 S2 事实链 fixture（`events.ndjson`、`expected-facts.json`、`README.md`），
  仅用于确定性测试，**不替代**运行时 0 行证据。
- `fixtures/s1-walking-skeleton/`：S1 保留（假批次、单条游离后端根、expected-facts）。
- `fixtures/case-a-zero-rows/`：S0 保留的 9 行 0 行案例（全部 `status=OK`、`confidence=EXACT`、`DROP_COUNT=0`）。
- 工作台只展示记录到的事实，不判定“这是 bug”；换行策略由根 `.gitattributes` 保护（`*.jsonl/*.ndjson/*.json/*.md/*.java/*.ts/*.vue` 强制 LF）。
- 契约：`docs/contracts/api.v1.md`（S2 矩阵：requests/graph IMPLEMENTED；replay/stream/ws/links RESERVED；Appendix A 案例 A），
  `transport.v1.md`、`event-model.v1.md`、`status-semantics.md` 保持 v1。

## 已知限制（S2）

1. `countById` 不插桩：未知 id 链为 0 或 2 span（Controller 404 + Service `RETURNED_FALSE`），无 mapper/SQL，不伪造。
2. `EventSender` 容量 16、单守护线程、1 次尝试：突发丢弃/非 202 仅 stderr 计数（`dropped=`/`ingest_rejected=`）；
   运行时 flags 含 S1 遗留 `DROP_COUNT=<n>`，**不要与 fixture flags 逐字比较**（fixture 仍精确断言）。
3. 工作台仅手动刷新 + **5 秒轮询（非实时）**，无 SSE/WS；无时间轴/回放。
4. **无前端 SDK/关联**：4-span 是 `confidence=LOST` 的游离后端请求，不画点击/前端链（S3 待做）。
5. H2 内存库（`DB_CLOSE_DELAY=-1`）与 collector 内存存储均**无持久化**，重启即回到 seed/清空。
6. git 分支实际 `master`（计划文档写 `main`），无 remote；仅 acceptance 写 git。
7. demo 前端 `src/main.ts`、`src/style.css`、`package.json` 的 description 仍含 S0 文案（source-only，页面不展示）；
   页头/横幅已按 S2-AMD-01 修正（纯文案，无 SDK/行为变化）。
8. S2 G1 非阻断文档瑕疵 N1/N2/N5/N9/N10/N11（api S0 历史指针、D4 引用、graph 加法字段未列入偏离、H2 保留字笔误、
   fixture SQL `source` 示例、s2-plan 哈希清单漏 dispatch）延后处理，不影响运行时事实与门禁。
9. S2 通过不等于产品完成：无 S3 能力；不得宣称已支持前端关联/回放/实时。

## 文档索引

| 路径 | 内容 |
|---|---|
| `docs/plans/README.md` | 单人计划入口 |
| `docs/plans/SOLO-PLAN.md` | 检查点 S0–S10 与自检协议 |
| `docs/plans/00-master-plan.md` | 产品主计划（技术事实权威） |
| `docs/plans/stages/S2/dispatch.md` | S2 任务分发书 |
| `docs/plans/stages/S2/dispatch-amendment-01.md` | S2-AMD-01（demo 前端页头文案单文件例外） |
| `docs/plans/stages/S2/s2-plan.md` | S2 实施计划（含 D1–D9 偏离记录） |
| `docs/plans/stages/S2/plan-review.md` | 契约评审 G1 PASS + 冻结哈希 |
| `docs/plans/stages/S2/test-report.md` | 测试报告（42 项；§11 为 S2-AMD-01 复跑） |
| `docs/plans/stages/S2/acceptance.md` | G2 验收结论与证据（含首轮 FAIL → 修订后 PASS） |
| `docs/plans/stages/S2/progress.md` | S2 进度包 |
| `docs/plans/archive/stage-S2-2026-11-23/` | S2 归档快照（MANIFEST/SUMMARY） |
| `docs/plans/stages/S1/` | S1 分发/计划/测试/验收/进度（历史） |
| `docs/contracts/` | 四份 v1 契约（api/transport/event-model/status-semantics） |
| `workbench/README.md` | 工作台 S1/S2 面板、代理与 preview 限制 |
