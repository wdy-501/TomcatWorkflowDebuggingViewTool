# TraceBoard

面向本地 Java（Spring Boot）Web 应用的“全链路事实”调试工具。当前处于 **S3（前端事实 + 只读回放，MVP）**：
在 S2 的 **0 行事实链**（demo 取消返回成功但 H2 `UPDATE ... AND status='PAID'` 命中 0 行）之上，
新增**浏览器 runtime SDK**（点击/控件/请求/DOM 事实）、**前端与后端的 EXACT 关联**（`traceparent` + `X-TraceBoard-Click`）、
**纯前端案例 B 的“确认没发请求”**，以及**只读回放**（时间窗 0 写）。

S3 只证明：前端事实能进入事件流、案例 A 可 **EXACT** 关联、案例 B 的“本次点击因果链内没有网络请求”可由运行时 SDK 证明、
已存事件可只读回放（0 写、不重跑、不调 demo）。**没有**构建插件/sourcemap/行号/局部变量（S5），
**没有**启动器/IDEA/JAR 接入/详情抽屉/×N（S4），**没有** SSE/WS/实时、无持久化、无像素回放。
S3 到此停止；**S4 需新的分发书授权**，本仓库当前状态不构成 S4 开工许可，也不宣称产品完成。

## S3 已真实可用（均可复跑验证）

- **runtime SDK（`frontend/sdk`，独立 TS 包）**：`initTraceBoard({ingestUrl,sessionId,appName})` →
  `{ wrapFn(name, fn), uiEffect(text) }`。`document` 捕获阶段 click（身份优先级 `#id` → `data-tb-name` → `role` → 文本 → DOM 路径）；
  包装 `window.fetch` 与 `XMLHttpRequest`；只对**同源相对路径且非 ingest** 请求加 `traceparent: 00-<traceId>-<fetchSpanId>-01`
  与 `X-TraceBoard-Click: <clickId>`；用初始化时捕获的**原生 fetch** 以 NDJSON 上报（批 ≤100 行 / ≤4MB，末字节 `\n`），
  避免自采集递归；`wrapFn` 保留 `this`/参数/返回值（`false` → `RETURNED_FALSE`，异常 → `THREW` 后原样重抛）；
  全部 fail-open（SDK 自身异常吞掉，collector 停机不影响页面）。
  **不采集**请求/响应体、表单值、cookie、查询串/hash、任意返回值、异常栈；`nodeKey` 只含 pathname。
- **案例 A（真实 EXACT 关联）**：浏览器点击 `#btn-cancel` → SDK 发 `POST /api/orders/1/cancel`（带两个头）→
  agent 反射读头，controller `traceId/parentSpanId/rootEventId` 取自请求头、`confidence=EXACT`、无 `LOST_BACKEND`，
  service/mapper/sql 继承同一链 → 全链 `EXACT`；0 行事实（HTTP 200 / service true / mapper 0 / SQL `rowsAffected=0`）不变。
  无头或非法头**逐字沿用 S2**：独立 4-span `LOST` 链（`click_lost_<spanId>`）+ stderr `header_unreadable=<n>`，不合成 EXACT。
- **案例 B（纯前端，确认没发）**：`#amount-b` + `#btn-save-b`；`validateForm` 经 `wrapFn`，金额 ≤0 → 页面显示 `金额必须大于 0`
  且**零 fetch**；有效金额 → `校验通过（本案例不提交）` 且**零 fetch**。click 根在 1500ms 观察窗关闭后入库
  （flags `SDK_ACTIVE`/`S3_RUNTIME_SDK`/`OBSERVE_MS=<实际毫秒>`），该 trace `fetchCount=0`、`hasBackend=false`，工作台显示
  **`已确认：本次点击因果链内没有网络请求`**（SDK 在线；观察窗已关闭；fetch/XHR=0；后端 span=0）。这是**本次点击因果链内**的结论，不是“全局无请求”。
- **collector 只读派生 + 回放**：`requests` 保留 S2 全部字段并**追加** `sdkActive` 与每请求 `fetchCount/hasFrontend/hasBackend/backendSpanCount`；
  `confidence` 按派生规则（ui_event+EXACT+零 fetch → EXACT；controller 挂到 fetch → EXACT；有 fetch 无后端 → LOST；后端游离根 → LOST），
  未关联的单个 fetch（如案例 A 的刷新 `GET /api/orders`）只在节点标“后端未采集”，**不降级整链**。
  新增 `GET .../replay?fromNs&toNs`（`{mode:"replay",readOnly:true,...}`，`fromNs<=startNs<=toNs`、`startNs`/`spanId` 排序、
  400/404/405、两次 GET 逐字一致），**只读**：不写事件、不消耗 `seq`、不缓存、不落 DB、不调 demo、不执行程序。
  `meta.capabilities` 仍 5 键，仅 `replay=false→true`；路由 = S1/S2 六条 + `replay`，`stream/ws/links` 仍 404。
- **工作台 S3 板（默认 `s_s3demo`）**：混合事实树（click → js_method → fetch → controller → service → mapper → sql → render）、
  节点事实（kind/nodeKey/status/return/sideEffects/flags/线程/startNs/durNs/根 confidence）、状态图例
  （`OK`/`RETURNED_FALSE` 琥珀/`THREW` 红/`NOT_COLLECTED_*` 灰虚线+reason/`TRUNCATED`/`REDACTED`/`UNKNOWN`；`LOST` 只在 confidence）、
  案例 B 三文案、时间轴（`relNs` 显示、滑块按 `toNs` 隐藏未来事件并标“未发生/进行中”）、常驻
  `只读：不会重发请求/不写数据库`；S2/S1/S0 面板折叠为次级。仍手动刷新 + 5 秒轮询（**非实时**）。

## S3 明确未实现（勿据此承诺）

- **无构建插件/sourcemap/源码片段/函数行号/JS 局部变量/`values[]`/字段 diff**（S5）；SDK 只到 F0（显式 `wrapFn`）。
- **无 S4**：无本地启动器/IDEA 插件/JAR 接入向导/预览代理注入/CDP/浏览器扩展；无节点详情抽屉/×N 逐次调用/手工 `/links`；无时间窗 `INFERRED`。
- 无 SSE/WebSocket/实时订阅；无服务端播放引擎；无像素回放/截图/录像（“回放”仅指已存事件的只读时间窗）。
- collector 不落 DB/文件、无淘汰/采样/缓存/CORS/鉴权/429；`ingest` 仍是唯一写通路；重启即清空。
- 无 Tomcat/React/cloud/MySQL 服务/上传/沙箱；demo 后端与 H2 seed 未改，案例 A 行为不变（2xx 才 toast）。
- 观察窗外的后台请求本阶段**不采集**（UI 只声明“本次点击因果链内”）；异步续体不传播 `wrapFn` 栈（S6）。

## 前置条件

| 依赖 | 版本/位置 | 用途 |
|---|---|---|
| JDK 21 | `C:/Program Files/Java/jdk-21`（21 LTS） | 根 reactor、collector 构建与运行（agent 字节码仍为 Java 8 / major 52） |
| JDK 8 | `C:/Program Files/Java/jdk1.8.0_221`（本机默认 `JAVA_HOME`） | demo 后端构建与运行（`-javaagent` 要求 JDK8 运行 demo） |
| Maven | 3.9.5 | 所有 Java 构建（只用 Maven Central，无第三方镜像） |
| Node.js / npm | Node 22.x / npm 10.x | workbench、demo 前端、`frontend/sdk`、`tools/verify` |

Windows + Git Bash；仓库路径含中文与空格，**所有命令与路径必须双引号**，并在仓库根执行。

## 构建（精确命令）

```bash
# S3 runtime SDK（独立包：tsc 产出 dist ESM + .d.ts；先构建，demo 前端经 alias 依赖）
(cd "frontend/sdk" && npm ci && npm run build && npm test)   # 8 tests / 8 pass

# 根 reactor（agent + collector），必须就地覆盖 JAVA_HOME 为 JDK21
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package

# demo 后端：独立工程（非 reactor 子模块），用 JDK8 构建
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# workbench 前端（vue-tsc 严格 + vite build）
(cd "workbench" && npm ci && npm run build)

# demo 前端（案例 A/B 与 SDK 接入）
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
```

产物：`frontend/sdk/dist/{index.js,index.d.ts}`（无 `.map`、无构建插件输出）、
`agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar`（major 52、shaded Byte Buddy）、
`server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar`、
`demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar`（内嵌 H2，无 MySQL 驱动）。

## 本地启动（按顺序；先 collector，再 demo 后端/前端与工作台）

```bash
# 1) collector（JDK21，仅 127.0.0.1:8601；内存存储，重启即清空）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
# 另开终端：
curl -s "http://127.0.0.1:8601/actuator/health"   # {"status":"UP"}
curl -s "http://127.0.0.1:8601/api/v1/meta"       # capabilities 5 键，replay=true（realtime 仍 false）

# 2) demo 后端（JDK8 + agent；-javaagent 与 -D 必须写在 -jar 之前；S3 会话 s_s3demo）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s3demo \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
# 另开终端（案例 A 的 curl 路径；浏览器路径见第 4 步）
curl -s "http://localhost:8080/api/orders"                    # id=1 SO-0001 CREATED 100.0（来自 H2）
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"   # {"data":true}，列表仍 CREATED（真实 0 行；无头 → S2 LOST）

# 3) 读回事实（只读派生，不改事件）
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"      # A EXACT/fetchCount≥1/hasBackend；B RETURNED_FALSE/fetchCount 0
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay"        # 只读窗口，readOnly=true
# 从 requests 复制 32 位小写 hex traceId，替换 <traceId>：
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/graph?traceId=<traceId>"

# 4) demo 前端（5174；/ingest 与 /api 经 Vite 代理分别到 8601 / 8080）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)   # http://localhost:5174 点击 #btn-cancel / #btn-save-b

# 5) workbench（Vite dev server，5173）
(cd "workbench" && npm run dev)   # http://localhost:5173，会话默认 s_s3demo
```

- 浏览器路径（真实 SDK 事实）：打开 `http://localhost:5174` → 点“取消订单”（案例 A，成功后 toast + `uiEffect('操作成功')`）
  → 点“保存”（案例 B，金额 ≤0 或有效都会**零请求**）；再回工作台刷新，查看请求列表/事实链/案例 B 判定/时间轴回放。
- agent 的 `-Dtraceboard.traceId` **默认不设置**：每次请求独立 `traceId`；无头 curl 走 S2 的 4-span `LOST` 链（默认 session 名仍是 `s_s2agent`，
  S3 E2E 用 `s_s3demo`）。
- S2 面板在 `s_s3demo` 浏览器事件中无后端 4-span 时可能返回 404（面板已处理为“无数据”，不崩）。
- 停止：前台 `Ctrl+C`；后台运行则 `taskkill //PID <pid> //T //F`，并用
  `netstat -ano | grep LISTENING | grep -E ":(8601|8080|5173|5174|4173|4174)\s"` 确认端口已释放。
- **不要**在启动前遗留旧的 `npm run dev`/esbuild 进程：它们会锁住 `node_modules/@esbuild/.../esbuild.exe`，
  导致 `npm ci` 报 `EPERM unlink`（先停掉旧 dev server 再构建）。

## 冒烟（contract smoke）

```bash
# 案例 A：SDK 头关联（先注入 click+fetch 前缀模拟浏览器，再带同头 curl；仅测试用，非运行时证据）
head -2 "fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson" > /tmp/s3-prefix.ndjson
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @/tmp/s3-prefix.ndjson   # 202 accepted=2
curl -s -X POST "http://localhost:8080/api/orders/1/cancel" \
  -H "traceparent: 00-1f2e3d4c5b6a79880a1b2c3d4e5f6071-2000000000000002-01" \
  -H "X-TraceBoard-Click: click_a1b2c3d4e5f60718"
# 期望 requests：EXACT / rootKind=ui_event / #btn-cancel / fetchCount≥1 / hasBackend=true / backendSpanCount=4
#      graph：click>fetch>controller>service>mapper>sql（controller.parentSpanId = fetch.spanId）

# 案例 B：契约形状（运行时结论须由浏览器点击产生，见上）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson"   # 202 accepted=3
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"   # sdkActive=true；B: RETURNED_FALSE/fetchCount 0/hasBackend false

# 回放只读（0 写）：两次相同 GET 逐字一致；前后事件/seq 与订单状态不变
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay" > /tmp/r1.json
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay" > /tmp/r2.json
cmp /tmp/r1.json /tmp/r2.json && echo "replay identical"
curl -s "http://localhost:8080/api/orders"   # 仍 CREATED

# 负例：400（非整数/负数/溢出/from>to）、404（未知会话）、405（写动词）、保留路由 404
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay?fromNs=10&toNs=5"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/replay"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/stream"
```

错误信封统一为 `{error,message,apiVersion}`，`message` 1..200 字符且**不回显请求体/凭据**。

## 校验（独立复跑，勿只看报告）

```bash
(cd "tools/verify" && npm ci && node verify.mjs)
# 或已装依赖后：
node tools/verify/verify.mjs
```

期望：**51 项 PASS / 0 FAIL**、末行 `S3 TEST: PASS`、退出码 0。任一项失败即非零退出并打印 `repro:` 命令。
脚本自行构建（SDK / demo 前端 / workbench / 根 JDK21 / demo JDK8）、起停 collector+demo（含 `-javaagent`）、
执行头关联 E2E、案例 A/B、requests/graph/replay、回放 0 写、S0–S2 回归（含显式迁移）、漂移与范围/安全检查，结束时清理进程与端口。

## 地址与运行限制（IPv4 / IPv6）

- collector **只绑定 `127.0.0.1:8601`（IPv4）**；agent 默认 ingest URL 也是 `http://127.0.0.1:8601/ingest/v1/events`。
  直连 collector 建议写 `http://127.0.0.1:8601`（`localhost` 可能先解析到 `[::1]`）。
- Vite dev server 绑定 `localhost`（Windows 上可能是 `[::1]`）；浏览器统一打开 `http://localhost:5173` / `http://localhost:5174`。
- workbench 与 demo 前端的代理 target 固定为 `http://127.0.0.1:8601`（`/ingest`）与 `http://127.0.0.1:8080`（`/api`），
  **不依赖 CORS**；代理仅在 `npm run dev` 生效，`npm run preview`（4173/4174）与静态 `dist/` 无代理（工作台会报 collector 不可达）。
- 端口：collector 8601、demo 8080、workbench 5173、demo 前端 5174、preview 4173/4174；冲突时先诊断，不静默改端口。
- collector 无鉴权、无持久化、无淘汰，仅用于本机演示；不要暴露到非回环网络。
- git 分支为 `master`（无 remote）；本仓库无 secret/真实客户数据。

## 契约与 fixture

- `schema/traceboard.event.v1.json`：事件 schema v1（2020-12，无网络 `$ref`）；**S3 字节不变**（无新 kind/status/字段）。
- `fixtures/s3-frontend-facts/`：`case-a-joined-chain/`（7 行 click→fetch→controller→service→mapper→sql，全 `EXACT`，
  `controller.parentSpanId=fetch.spanId`）、`case-b-frontend-only/`（3 行 click→`validateForm` `RETURNED_FALSE`→render，零 fetch），
  含 `expected-facts.json`（`globalAssertions`/`apiExpectations`/`replayWindows`）。**fixture 是契约形状，不是运行时证据**；
  案例 A 的 EXACT 与案例 B 的“确认没发”必须由浏览器 SDK + agent 运行时产生。
- `fixtures/s2-zero-row-chain/`、`fixtures/s1-walking-skeleton/`、`fixtures/case-a-zero-rows/`：S0–S2 保留（字节未变）。
- 契约：`docs/contracts/api.v1.md`（§2.3 S3 矩阵：replay IMPLEMENTED、requests 新字段、§9 定义；stream/ws/links RESERVED）、
  `transport.v1.md`（S3 端口/代理/回放只读）、`event-model.v1.md`（§12 SDK 事件/头关联/时钟）、`status-semantics.md`（未改）。
- 换行策略由根 `.gitattributes` 保护（`*.jsonl/*.ndjson/*.json/*.md/*.java/*.ts/*.vue` 强制 LF）。

## 已知限制（S3）

1. **无构建插件/sourcemap/行号/局部变量/L2**（S5）：节点详情只写“JS 内部变量本次未采集（无构建插件/sourcemap）”。
2. **观察窗仅运行时在线**：每次点击 1500ms（`pagehide` 提前关闭并记录实际毫秒）；新点击会提前关闭上一次；
   窗口外的后台请求**不采集**，因此“已确认没发”只覆盖**本次点击因果链内**。
3. 运行时案例 A 常在取消后刷新列表，因而同一 click 窗口还会捕获一条 `GET /api/orders`；它**未插桩**，
   在树上标“后端未采集（未关联 controller）”，`fetchCount`/`spanCount` 因此可能大于 fixture 的最小链（POST 关联与 `EXACT` 不变）。
4. 同一 demo 进程内 S2 面板默认会话 `s_s2agent` 可能为空（S3 用 `s_s3demo`），工作台对空会话显示 404/无数据提示，不崩。
5. H2 内存库（`DB_CLOSE_DELAY=-1`）与 collector 内存 append-only 均**无持久化**，重启即回到 seed/清空；回放前后比对须在同一 demo 进程内。
6. 工作台仅手动刷新 + **5 秒轮询（非实时）**，无 SSE/WS；时间轴只按 `toNs` 隐藏未来事件，不是服务端播放。
7. git 分支实际 `master`（计划文档写 `main`），无 remote；仅 acceptance 写 git。
8. 回环口径：collector/agent 仅 `127.0.0.1`；浏览器入口用 `localhost`（Vite 可能绑 `[::1]`），两者不可混写。
9. **S2 门禁已迁移**（显式且不放宽其余断言）：`S1-C0` capabilities `replay=true`；`S2-4/4F` replay 404→200 并加 S3 断言；
   `S2-6/8` 升级为 S3 口径（允许 SDK/头读取/时间轴/replay，仍禁 S4/S5）；`S2-3` 无头 `s_s2agent` 4-span LOST 逐字保留。
10. **agent 时钟锚点微偏差**：agent `startNs` 锚在上下文进入、`durNs` 从 advice 进入计时，冷启动首次可能出现 µs 级
    “sql 结束晚于 mapper 结束”；契约允许 ≤1s 同机容差，门禁按“顺序 + 包含”断言；建议 S4 前对齐锚点。
11. **`S3_EXACT_LINK` 是加法 flag**（阶段标记，advisory）：运行时 controller flags 实测为
    `["S3_EXACT_LINK","S2_ZERO_ROW_CHAIN","DROP_COUNT=0"]`（`DROP_COUNT` 为 S1 遗留），**不要与 fixture flags 逐字比较**；
    读取方对未知 flag 一律忽略。
12. 迁移/文档层面的既有小瑕疵（不阻断）：部分历史文档（S0/S1 计划、契约历史指针）存在 EOF 无换行/历史指针过期等
    **pre-existing** 瑕疵，本轮未改（修改会破坏 G1 冻结面）。
13. S3 通过仅证明“前端事实 + 案例 B 确认没发 + 状态语义 + 只读回放”；**不等于产品完成**，无 S4 接入/详情/×N，无 S5 变量。

## 文档索引

| 路径 | 内容 |
|---|---|
| `docs/plans/README.md` | 单人计划入口 |
| `docs/plans/SOLO-PLAN.md` | 检查点 S0–S10 与自检协议 |
| `docs/plans/00-master-plan.md` | 产品主计划（技术事实权威） |
| `docs/plans/stages/S3/dispatch.md` | S3 任务分发书（唯一任务输入） |
| `docs/plans/stages/S3/s3-plan.md` | S3 实施计划（步骤/精确命令/D1–D11 偏离/风险/回滚） |
| `docs/plans/stages/S3/plan-review.md` | 契约评审 G1 PASS + 22 项冻结哈希 |
| `docs/plans/stages/S3/test-report.md` | S3 测试报告（51 项；rebuild/E2E/replay 证据） |
| `docs/plans/stages/S3/acceptance.md` | G2 验收结论与证据 |
| `docs/plans/stages/S3/progress.md` | S3 进度包 |
| `docs/plans/archive/stage-S3-2026-11-23/` | S3 归档快照（MANIFEST/SUMMARY） |
| `docs/plans/stages/S2/`、`S1/`、`S0/` | 历史阶段文档 |
| `docs/contracts/` | 四份 v1 契约（api/transport/event-model/status-semantics） |
| `frontend/sdk/` | runtime SDK（源码/单测/tsconfig；dist 由构建产生） |
| `workbench/README.md` | 工作台 S3/S2 面板、代理与 preview 限制 |
