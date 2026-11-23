# S2 0 行事实链 · 任务分发书（dispatch）

> 阶段：S2（MVP，0-row fact chain）｜角色：task-dispatch｜日期：2026-11-24｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S2 行 + §4、主计划 §2.3/§5/§8.1-8.5/§9.1-9.2/§13.1-13.4/§16 T1/T2/T5/T7、
> S1 交付（`docs/plans/stages/S1/{progress,acceptance,s1-plan}.md`）、S1 基线 `s1-baseline`。
> 本文件是 S2 六个下游子代理的唯一任务输入；除 dispatcher 外任何人不得修改本文件。**S2 只做 0 行事实链，不做 S3。**

## 0. 通用规则（所有人）

1. 一个子代理只执行一张卡：只读「输入」、只写「输出」，其余路径只读；路径含中文/空格，命令与路径必须双引号，从仓库根执行。
2. **只有 acceptance 可写 git**（add/commit/tag）；其他人禁止任何 git 写操作、禁止 push/force/rebase。
3. 需要越界、契约缺口、指标不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改一下”。
4. 不用 secret/真实数据；不换第三方镜像；不自动下载仅 GitHub 提供的资源；依赖只走 Maven Central/npm 官方源。
5. 未做/未验证的能力标“S2 未做 / 未采集 / S3 待做”，不得写成“已支持”；**禁止用 fixture 伪造运行时 0 行**。
6. G1 后契约/s2 fixture/s2-plan 冻结；schema v1 字段/枚举/约束不变。

## 1. S2 目标与验收信号（SOLO-PLAN S2 行 + 主计划 §5.8）

| 项 | 口径 |
|---|---|
| 主要工作 | agent Controller/Service/Mapper/JDBC 行数；collector 关联/存储/API；工作台请求切换 |
| 完成信号 | **首次失败点击可看到 SQL 0 行、Mapper 0、Service true、无异常** |

S2 收尾必须同时证明（缺一即 FAIL）：

1. **真实 0 行**：demo 改为 H2+MyBatis；`POST /api/orders/1/cancel` 的 `UPDATE ... AND status='PAID'` 对 `CREATED` 行产生 `rowsAffected=0`；Service 忽略返回仍 `true`；Controller `200 {"data":true}`；未知 id 仍 `404 {"data":false}`。0 行必须是**运行时 DB/SQL 事实**，不是 fixture 冒充。
2. **agent 4-span 链**：Controller/Service/Mapper/SQL 四点真实插桩，同一 traceId/rootEventId、LOST 游离根、parent/child 正确、`status=OK`（异常才 `THREW`）、`durNs>0`、返回摘要与 sideEffects 正确。
3. **collector 只读派生**：`GET .../requests` 按 traceId 分组；`GET .../graph?traceId=` 派生节点/边；未知 session/trace 与非法参数按 §4.3/§4.4；不持久化、不改写、无副作用。
4. **工作台请求切换**：请求列表/切换 + 选中请求事实链；显示 SQL 0 行、Mapper 0、Service true、Controller 200、异常 0；明确“事实摘要，不是缺陷结论”。
5. **测试**：`tools/verify` 一次命令覆盖 S2-A..S2-L（§5.5）且 exit 0；S0/S1 回归按 §4.8 迁移后全绿。
6. **契约与证据**：api 矩阵 S2、Appendix A、s2 fixture、test-report、README/progress/acceptance 齐备；G1 冻结面零漂移。

## 2. 范围

### 2.1 S2 范围内（6 项交付）

| # | 交付 | owner |
|---|---|---|
| 1 | api 契约 S2 章节 + `fixtures/s2-zero-row-chain/**` + `s2-plan.md` | plan-writer |
| 2 | demo 后端 H2+MyBatis 0 行缺陷；agent 4-span 链；collector requests/graph 只读派生 | coder-backend |
| 3 | workbench S2 请求切换 + 0 行事实图/清单 | coder-frontend |
| 4 | `tools/verify` S2 门禁 + `test-report.md` | tester |
| 5 | README、`.gitattributes`（仅必要时）、S2 验收/进度、归档、commit + tag `s2-baseline` | acceptance |
| 6 | 本分发书与 G1 审阅 | dispatcher / plan-reviewer |

### 2.2 S2 明确不做（S3 边界；越界即失败）

- 无浏览器 SDK/UI 采集/`traceparent`/clickId 传播/关联引擎/前端事件；S2 链是 `confidence=LOST` 的游离后端请求（无前端根，不画成点击链一环）。
- 无时间轴/回放/`replay` API/回放按钮/像素回放/虚拟时钟；无 `links` 手工关联。
- 无 SSE/WebSocket/实时订阅；工作台只做手动刷新 + 低频率轮询（非实时）。
- 无 `values[]`/字段 diff/参数值/L1-L2/行级变量/异常 payload/栈；`THREW` 只记状态与 `return=null`。
- collector 不落 DB/文件、无淘汰/采样/缓存、无 CORS/鉴权/429；graph 读时派生。
- 无 launcher/cloud/Tomcat/React/MySQL 服务/上传/沙箱。
- 不改 `schema/traceboard.event.v1.json` 字段/枚举/约束；不新增事件类型；不写第二份 schema。
- 不改 S0 `fixtures/case-a-zero-rows/**`、S1 `fixtures/s1-walking-skeleton/**`；demo 前端行为不改（200 即显示“操作成功”，无 SDK）。

## 3. 强制技术决策（不得协商）

| 项 | 决策 |
|---|---|
| 构建 | 根 reactor JDK21；agent `--release 8`、jar 名/路径不变；demo JDK8 独立构建；版本 `0.1.0-SNAPSHOT` |
| demo DB | Boot 2.7.18 + `org.mybatis.spring.boot:mybatis-spring-boot-starter:2.3.1` + H2（Boot 2.7.18 管理 2.1.214，`runtime`）；`jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1`（MODE=MySQL 可选，不强制）；`schema.sql`/`data.sql`，`spring.sql.init.mode=always`；**无 MySQL 服务依赖** |
| demo 数据 | `orders(id, order_no, status, amount)`；seed `id=1, SO-0001, CREATED, 100.00`；删除 `InMemoryOrderStore`；mapper XML `mapper/OrderMapper.xml` |
| demo 缺陷 | `cancelById`：`UPDATE orders SET status='CANCELLED' WHERE id=#{id} AND status='PAID'`（行是 CREATED → 0 行）；Service 存在性检查后**忽略** `cancelById` 返回值仍返回 true；Controller `200 {"data":true}` / 未知 id `404 {"data":false}` |
| agent 插桩 | Byte Buddy `AgentBuilder`+`Advice`，仅 4 点：`OrderController#cancel`、`OrderService#cancel`、`org.apache.ibatis.binding.MapperProxy#invoke`（Advice 内按 `Method` 过滤 `com.example.shop.mapper.OrderMapper#cancelById`）、`org.apache.ibatis.executor.statement.PreparedStatementHandler#update`（按 `mappedStatement.id == com.example.shop.mapper.OrderMapper.cancelById` 过滤） |
| agent 上下文 | `ThreadLocal` 栈（进入压帧、退出弹帧）；controller 进入创建 traceId/rootSpanId/rootEventId，子 span 继承；同线程同步链，无异步 |
| agent 传输 | 沿用 S1 `EventSender`（容量 16、单守护线程、1 次尝试、fail-open）；每 span 一行 NDJSON 以 `\n` 结尾 |
| collector | 沿用 ingest/query/store；新增 requests/graph 只读控制器，**读时派生**；无缓存/持久化/改写；meta capabilities 5 键不变 |
| workbench | 沿用 Vue3+TS+Vite+Pinia；`/api` 代理不变；新增 S2 面板；S1 假面板折叠为次级；S0 FixturePanel 保留 |
| 端口 | collector 8601（仅 127.0.0.1）、demo 8080、workbench 5173、demo 前端 5174；冲突先诊断记录，不静默改端口 |

## 4. 共享契约（下游按此实现；细节由 plan-writer 落入 api/s2-plan/s2 fixture）

### 4.1 demo 0 行行为（Appendix A）

| 方法/路径 | 行为 |
|---|---|
| `GET /api/orders` | `200 {"data":[{id,orderNo,status,amount}]}`，来自 H2（seed id=1 CREATED 100.00） |
| `POST /api/orders/1/cancel` | 执行 cancel SQL（WHERE `status='PAID'`）→ `rowsAffected=0`；Service 仍返回 true；`200 {"data":true}` |
| `POST /api/orders/{id}/cancel`（未知 id） | 存在性检查为 0 → Service 返回 false → `404 {"data":false}`；不执行 cancelById |
| demo 前端 | 不改：200 即显示“操作成功”并刷新列表，列表仍 CREATED（页面成功提示与 0 行并存，即案例 A 事实组合） |

- 0 行来自真实 H2 SQL；fixture 只用于确定性测试，不得替代运行时证据。demo 前端 S0 页头“无缺陷”文案为历史口径，S3 接 SDK 时统一修正，S2 登记为文案瑕疵。

### 4.2 agent span 链（唯一后端事实形状）

| # | kind | nodeKey | parent | status | return | sideEffects |
|---|---|---|---|---|---|---|
| 1 | `controller` | `com.example.shop.controller.OrderController#cancel` | `null`（根） | `OK`/`THREW` | `{"type":"http","value":200}`（未知 id 为 404） | — |
| 2 | `service` | `com.example.shop.service.OrderService#cancel` | 1 | `OK`/`RETURNED_FALSE`/`THREW` | `{"type":"boolean","value":true}` | — |
| 3 | `mapper` | `com.example.shop.mapper.OrderMapper#cancelById` | 2 | `OK`/`THREW` | `{"type":"int","value":0}` | — |
| 4 | `sql` | `OrderMapper.cancelById` | 3 | `OK`/`THREW` | `null` | `[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":0,"transaction":"UNKNOWN"}]` |

- 共享：同一 `sessionId`（默认 `s_s2agent`）、同一 `traceId`（32 位小写 hex）、同一 `rootEventId=click_lost_<根 spanId>`；全部 `confidence=LOST`；根 `parentSpanId=null`，子 span 指向父；根 flags `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]`，子 flags `["S2_ZERO_ROW_CHAIN"]`。
- `thread` 取当前线程；`startNs` 相对 premain 单调纳秒；`durNs=exit-enter ≥0`；`source` 可选，只写真实栈帧的 `file`，**不猜行号**；不写 `values`/`reason`/异常 payload。
- 状态规则：返回布尔 `false` → `RETURNED_FALSE`（未知 id 的 Service）；抛异常 → `THREW`（`return=null`）；int `0` 是正常返回 → `OK`；**0 行不是错误状态**。
- 事件到达顺序 = 方法退出顺序（sql→mapper→service→controller），与 `startNs` 顺序不同；requests/graph 与测试一律按 `startNs`/span 关系，**不得假设 seq 顺序 = 起始顺序**。
- 未知 id 链：Controller 404 + Service `RETURNED_FALSE`（2 span），无 mapper/sql（cancelById 未调用）；不得伪造。
- 并发请求：每线程独立栈、独立 traceId，不合并；跨线程不传播（S6）。
- 额外 select span（存在性检查 `countById`）**默认不插桩**；若实现，必须真实且不得替代 cancel 链，禁止合成。

### 4.3 `GET /api/v1/sessions/{sessionId}/requests`（S2 IMPLEMENTED，只读）

```json
{"requests":[{"traceId":"<32hex>","rootSpanId":"<16hex>","rootKind":"controller",
  "nodeKey":"com.example.shop.controller.OrderController#cancel","spanCount":4,
  "status":"OK","confidence":"LOST","startedAtNs":1000000000}]}
```

- 按 `traceId` 分组；`rootSpanId/rootKind` 取 `parentSpanId=null` 的 span；无根时 `rootSpanId`/`rootKind`/`nodeKey` 为 `null`、`confidence="LOST"`（诚实缺口）；`spanCount` 为该 trace 事件数；`startedAtNs` = 该 trace 最小 `startNs`；`confidence` 取根 span。
- `status` 为聚合最严重级，优先级：`THREW > UNKNOWN > NOT_COLLECTED_POLICY > NOT_COLLECTED_LOST > NOT_COLLECTED_NO_DEBUG_INFO > TRUNCATED > RETURNED_FALSE > OK`。
- 排序：`startedAtNs` 升序、同值 `traceId` 字典序；未知 session → 404；写动词 → 405；空会话返回 `{"requests":[]}`；无分页（S2）。

### 4.4 `GET /api/v1/sessions/{sessionId}/graph?traceId=<32hex>`（S2 IMPLEMENTED，只读）

```json
{"traceId":"<32hex>","rootEventId":"click_lost_<16hex>","confidence":"LOST",
 "nodes":[{"spanId":"<16hex>","parentSpanId":null,"kind":"controller","nodeKey":"...",
   "status":"OK","return":{"type":"http","value":200},"sideEffects":[],"startNs":1000000000,"durNs":8000000}],
 "edges":[{"parentSpanId":"<16hex>","childSpanId":"<16hex>","count":1}]}
```

- `nodes` 按 `startNs` 升序、同值 `spanId` 字典序；每条字段固定为示例所列（`return`/`sideEffects` 可为 `null`/空数组）；`edges` 为父→子，按父节点起始顺序，`count` 为该父子对出现次数（S2 恒 1）。
- `traceId` 必填且 `^[0-9a-f]{32}$`，缺失/非法 → 400；未知 session → 404；session 内无该 traceId → 404；只 GET（写动词 405）。
- 派生自事件快照：两次相同 GET 结果一致、事件/seq/计数不变；不注册 replay/stream/ws/links 路由。

### 4.5 S2 fixture（`fixtures/s2-zero-row-chain/**`）

- 文件：`events.ndjson`（4 行，LF、末行 `\n`，按 `startNs` 非降序）、`expected-facts.json`、`README.md`。
- 形状同 §4.2：sessionId 固定 `s_s2agent`、固定 traceId/spanId、`startNs` 1000000000/1001000000/1002000000/1003000000、`durNs` 8000000/6500000/5000000/3000000（plan-writer 可微调但必须保持嵌套与不变量）。
- `expected-facts.json` 沿用 S1 形状（`globalAssertions` + `facts[]`，由 S2 门禁新消费器读取）：单根、共享 trace/root、`confidenceAllLost`、`statusAllOk`、`noExceptions`、父子链、区间嵌套、SQL rows 0/transaction UNKNOWN、Mapper int 0、Service boolean true、Controller http 200。
- 每行必须过冻结 schema（无 `values`/`reason`）；fixture 只用于确定性测试，不替代 §1 第 1 条运行时证据。

### 4.6 工作台 S2 事实板

- 会话选择（默认 `s_s2agent`，列表来自 `/api/v1/sessions`）+ 请求列表/tabs（来自 `/requests`）+ 选中请求事实链（来自 `/graph`）。
- 事实摘要条（中性样式，不用绿色成功/红色失败裁决）：`SQL 影响 0 行`、`Mapper 返回 0`、`Service 返回 true`、`Controller HTTP 200`、`异常 0`；常驻文案 `事实摘要，不是缺陷结论`。
- 链为 LOST 游离后端请求时显示 `游离后端请求（无前端根）`，不得画成点击/前端链；显示 span 状态徽标，`THREW` 才用异常样式，`OK` 中 0/false 不得标红。
- 刷新：手动按钮 + 每 5 秒轮询（页面可见时），文案 `每 5 秒刷新（非实时）`；无 SSE/WebSocket/时间轴/回放/SDK。
- 稳定选择器（供 tester 断言）：`#s2-panel`、`#s2-session`、`#s2-refresh`、`#s2-requests`、`#s2-chain`；S1 假面板折叠为次级并标注 `S1 walking skeleton（假数据，非 S2 事实链）`；S0 `FixturePanel` 保留。

### 4.7 契约文档变更（plan-writer）

- `docs/contracts/api.v1.md`：新增 S2 矩阵（requests/graph IMPLEMENTED；replay/stream/ws/links 仍 RESERVED）、§4.3/§4.4 形状/参数/错误/只读语义、Appendix A 缺陷行为（0 行、200 true、404 unknown、H2+MyBatis、无 MySQL 服务）。
- `docs/contracts/event-model.v1.md`：**预期不改**；仅当 sideEffects/return 语义确有缺口时追加短注（`transaction:"UNKNOWN"`、`return={type:"http",value:200}` 已在 §4.3/§4.5 允许）；schema 字节不变。
- 契约中“查询 ≠ 回放”“游离后端根”“0 行是事实不是错误”口径保持。

### 4.8 测试迁移（与 S1 冲突的旧门禁）

- 保留：S0 全部（V1/V1b/V1c/V4b/V2/V3/V6/V8）、S1-A fixture、S1-B 产物、S1-C/D ingest/查询、S1-F 假批次路径、S1 冻结 fixture 字节。
- 改写：`S1-E`（原“每次 cancel 恰好 1 条 controller span”）→ S2 4-span 链断言；`S1-H`（原“无 service/mapper/SQL 探针”）→ S2 范围扫描（无 S3+）；`S1-G` 漂移基线 → S0 冻结面 + S2 G1 基线（S1 fixture 不纳入新哈希）。
- 旧断言**不得放宽**为“存在即可”；S2 用真实运行时证据替代单 span 断言。

## 5. 任务卡

### 5.1 plan-writer（契约与 s2 fixture，不写代码）

- 输入：本文件 §1–§4、S0/S1 冻结契约/schema/fixture、主计划相关章节。
- 输出（只写）：`docs/contracts/api.v1.md`（S2 章节 + Appendix A）、`docs/contracts/event-model.v1.md`（仅确需短注时）、`fixtures/s2-zero-row-chain/**`、`docs/plans/stages/S2/s2-plan.md`。
- 完成判据：§4.1–§4.7 全部落入契约/fixture；4 行 fixture 过 schema 且满足不变量；expected-facts 可被新门禁消费；s2-plan 含步骤、精确命令、T2/T5 口径、风险、回滚；无 schema 字段变更、无 S3 内容。
- 禁止：写代码/pom/TS、改 schema/字段/枚举、改 S0/S1 fixture、git、真实数据/外网 `$ref`。

### 5.2 plan-reviewer（只读，G1 门）

- 输入：本文件、plan-writer 全部输出、S0/S1 契约与 schema、主计划 §5/§8/§13。
- 输出（只写）：`docs/plans/stages/S2/plan-review.md`——逐项 PASS/FAIL、阻断/建议、契约+s2 fixture+s2-plan+dispatch 的 SHA256 冻结基线、`G1: PASS|FAIL`。
- 核查：①demo 缺陷真实且 200/404 口径一致；②span 链字段/父子/LOST/状态/0 行语义与 §4.2 一致；③requests/graph 形状/排序/聚合/错误与 §4.3/§4.4 一致；④fixture 过 schema、单根、嵌套、无 S3；⑤schema 字节不变、S0/S1 fixture 未改；⑥无 secret/真实数据。
- 禁止：替作者改文件、写代码、引入 S3、git。

### 5.3 coder-backend（demo + agent + collector）

- 输入：本文件 §2–§4、G1 冻结契约/schema/fixtures、`s2-plan.md`。
- 输出（只写）：`demo/buggy-shop-boot-vue/backend/**`、`agent/**`、`server/collector/**`。
- demo 判据：H2+MyBatis 依赖/配置/schema/data；`OrderMapper.xml`（cancelById 带 `status='PAID'`）+ 存在性方法；Service 忽略影响行数；`200 {"data":true}`/`404 {"data":false}`；`GET /api/orders` 走 DB；删 `InMemoryOrderStore`；JDK8 构建启动、seed 可读；无 MySQL 服务。
- agent 判据：先 spike（一次 cancel 命中 4 点/日志证明 transform），再完整；4 span 字段严格按 §4.2；根/子栈正确；controller HTTP 状态反射读取（失败 fail-open，不猜）；`MapperProxy` 过滤只命中 `OrderMapper#cancelById`；SQL 过滤只命中 cancel mapped statement；collector 停机不影响 demo；队列丢弃 stderr 计数；jar major=52/Premain-Class 不变；默认 session `s_s2agent`。
- collector 判据：§4.3/§4.4 全部形状/排序/聚合/400/404/405；读时派生、两次 GET 一致、事件不变；不注册 replay/stream/ws/links；meta 5 键不变；无 DB/文件/缓存。
- 禁止：S3（SDK/traceparent/replay/timeline/SSE/WS/前端事件）、`values`/异常 payload、插桩其它方法、collector 持久化、改契约/fixture/workbench/tests、git。

### 5.4 coder-frontend（workbench）

- 输入：G1 契约/s2 fixture、S0/S1 workbench 现状、本文件 §4.6。
- 输出（只写）：`workbench/**`（`src/api.ts` 类型、S2 组件/store、`App.vue`、样式）。
- 完成判据：会话选择 + `/requests` 列表/切换 + `/graph` 事实链；事实条与文案按 §4.6；LOST 标注；中性样式；手动刷新 + 5s 轮询与非实时文案；collector 不可达/404/空态不崩；S1 面板折叠次级、S0 面板保留；`npm ci && npm run build` 绿、TS 严格无错。
- 禁止：SSE/WebSocket/EventSource/时间轴/回放/图库/绝对 URL/CORS/调 demo 后端/自动上报/改 S0 fixture/git。

### 5.5 tester（S2 独立验证，不改产品代码）

- 输入：全部 S2 产物、G1 冻结哈希、本文件 §4、冻结契约/fixture。
- 输出（只写）：`tools/verify/**`、`docs/plans/stages/S2/test-report.md`。
- 门禁（一次命令、非 0 即 FAIL，串行起停并在 `finally` 清理）：

| 组 | 断言 |
|---|---|
| S2-A | s2 fixture 4 行过 schema；单根/共享 trace/root/LOST/区间嵌套；expected-facts 全过；负例（多根/断父链/非 LOST）被拒 |
| S2-B | demo 构建；静态断言 H2/MyBatis/`schema.sql`/`data.sql`/`status='PAID'`；无 InMemoryOrderStore、无 MySQL 服务 |
| S2-C | agent jar major=52/Premain-Class/shaded；collector jar schema 字节等价；workbench `npm ci && build` 绿 |
| S2-D | 真 E2E：collector + demo（`-javaagent`）→ `POST /api/orders/1/cancel` 200 `{"data":true}`；≤10s 读回 4 span：controller/service/mapper/sql、父子正确、同 trace/root、LOST、status 全 OK、durNs>0；mapper int 0、service true、controller http 200、sql rows 0/UNKNOWN；无 THREW |
| S2-E | 未知 id → `404 {"data":false}`；Service 若被采集为 `RETURNED_FALSE`；demo 仍 200 列表 |
| S2-F | requests：分组/spanCount=4/rootKind/nodeKey/status/confidence/startedAtNs；排序；未知 session 404；写动词 405 |
| S2-G | graph：4 节点/3 边、startNs 排序、return/sideEffects 原样；未知 trace 404、缺失/非法 traceId 400；两次 GET 一致且事件数不变 |
| S2-H | workbench dist 含 §4.6 选择器/文案；无 SSE/WS/时间轴/回放/SDK；代理仍 `/api`→127.0.0.1:8601 |
| S2-I | S0/S1 回归按 §4.8：ingest/查询/fixture/构建；S1 fixture 字节未变 |
| S2-J | fail-open：停 collector → cancel 仍 200 且 <3000ms、demo 存活；恢复后可采集 |
| S2-K | 范围/安全：无 S3 能力、0 secret/真实数据/遥测/CDN/镜像、仅回环、无 schema 第二份 |
| S2-L | 漂移（G1 哈希）与清理：6 端口无监听、无遗留 java、git 索引未动（验收后干净树复跑） |

- 证据：`test-report.md` 写环境、逐项 PASS/FAIL、复现命令、E2E 输出、进程已停声明；浏览器证据由 orchestrator 提供，tester 不断言截图。
- 禁止：改产品/契约/fixture、放宽断言、常驻服务、git。

### 5.6 acceptance（唯一 git 写入者，G2 门）

- 输入：全部 S2 产物、6 张卡、G1 报告、tester 报告。
- 输出（只写）：`README.md`、`.gitattributes`（仅必要时）、`docs/plans/stages/S2/{acceptance.md,progress.md}`、`docs/plans/archive/stage-S2-2026-11-24/**`；git commit + tag `s2-baseline`。
- 完成判据：①亲自重跑 tester 命令与构建，不信报告；②G1 后契约/s2 fixture/s2-plan 哈希不变；③§2.2 越界零实现；④安全（无 secret/真实数据/遥测/CDN/镜像）；⑤README 写 S2 状态/启动顺序/`-javaagent`/curl/verify/演示路径；⑥progress.md 按 SOLO-PLAN §4；⑦按文件名 add + commit + tag；⑧S2 到此停止，不开始 S3。
- 禁止：push/force/rebase、测试未绿打 tag、代改代码、开工 S3。

## 6. 路径归属矩阵（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S2/dispatch.md` | dispatcher | 只读 |
| `docs/contracts/**`、`fixtures/s2-zero-row-chain/**`、`docs/plans/stages/S2/s2-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S2/plan-review.md` | plan-reviewer | 只读 |
| `demo/buggy-shop-boot-vue/backend/**`、`agent/**`、`server/collector/**` | coder-backend | 只读 |
| `workbench/**` | coder-frontend | 只读 |
| `tools/verify/**`、`docs/plans/stages/S2/test-report.md` | tester | 只读 |
| `README.md`、`.gitattributes`、`docs/plans/stages/S2/{acceptance.md,progress.md}`、archive、git | acceptance | 只读 |
| `schema/**`、`fixtures/case-a-zero-rows/**`、`fixtures/s1-walking-skeleton/**`、demo 前端、S0/S1 文档 | 冻结 | 一律只读 |

## 7. 顺序与门禁

`dispatcher → plan-writer → plan-reviewer(G1) → coder-backend ∥ coder-frontend → tester → acceptance(G2，commit+tag s2-baseline) → 阶段备份/总结`

- G1 之前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 则上报，不降级放行。
- G1 冻结：契约、s2 fixture、s2-plan、dispatch 哈希；此后再改字段/形状必须停回本流程。
- S2 检查点到达即停；**不得开始 S3（前端 SDK/回放/时间轴）**。

## 8. 环境事实（不得改写）

- Windows 10 + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool` 含中文与空格，所有命令双引号。
- Maven 3.9.5；默认 `JAVA_HOME`=JDK 1.8.0_221；JDK21=`C:/Program Files/Java/jdk-21`；根/collector 构建就地覆盖 `JAVA_HOME`；demo 用 JDK8 绝对路径。
- Node 22.22.2 / npm 10.9.7；Maven Central/npm 官方源可达；无第三方镜像、无外部 CDN/在线字体/遥测。
- H2 仅嵌入式（demo 内），无 MySQL/外部 DB 服务；collector 仅 `127.0.0.1:8601`；端口 8080/5173/5174；冲突先诊断。
- git：分支 `master`、无 remote；只有 acceptance 写 git；无 secret/真实客户数据。

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| MyBatis 插桩不命中（MapperProxy/PreparedStatementHandler 类加载、过滤器写错） | coder-backend 先做单次 cancel spike（transform 日志 + 4 span 读回）；失败 `BLOCKED` 附证据；禁止合成 span |
| `mappedStatement` 私有字段读取失败（BaseStatementHandler 继承） | agent helper 反射遍历父类字段、只读；失败不产生 SQL span 并 `BLOCKED`，不得伪造 rows |
| Boot fat jar/LaunchedURLClassLoader 解析 agent helper 失败 | S1 已证 app 类可解析；MyBatis 类同样在启动后加载；NoClassDefFoundError → `BLOCKED` |
| H2 2.1.214 初始化顺序/保留字/内存库早关 | `spring.sql.init.mode=always` + `DB_CLOSE_DELAY=-1`；启动后 GET /api/orders 验证 seed；版本由 Boot 管理，不手改 |
| SQL 过滤不精确（误采集其它 update） | 精确匹配 mapped statement id + nodeKey；测试只断言 cancel 链且无额外 update span |
| 状态严重度/0 行被误标为错误 | `OK` 含 0 行；Service false→`RETURNED_FALSE`；工作台中性事实条，不做绿/红裁决 |
| 事件到达顺序 ≠ startNs 顺序 | requests/graph/测试按 startNs 与父子关系；轮询按 span 集合而非 seq 位置 |
| S1 旧门禁与新 agent 冲突 | §4.8 显式迁移 S1-E/S1-G/S1-H，保留其余回归，不放宽 |
| 工作台事实板误导（把 LOST 画成点击链） | LOST 标注 + 无前端根文案 + 无点击/前端节点；常驻“事实摘要” |
| 轮询/端口/时序不稳定 | 5s 轮询 + 手动刷新；E2E 轮询 ≤10s；串行起停、先诊断端口、`finally` 清理 |

## 10. 停止条件与出口纪律

1. MyBatis/SQL 插桩经 spike 仍不可行，或必须用 fixture/合成事件才能显示 0 行 → `BLOCKED` + 日志；**不得降级**。
2. 必须改 schema v1 字段/枚举/事件类型，或必须引入 S3 能力（浏览器 SDK/traceparent/回放/时间轴）才能达标。
3. G1 FAIL 且一轮返工后仍 FAIL；任务要求改他人路径或推翻 §3 决策。
4. 测试未绿但 owner 想“先提交再说”；出现 secret/真实数据/第三方镜像。
5. 命中任一越界（§2.2）或契约漂移。
6. S2 只证明“真实 0 行 + 4-span 后端链 + 只读请求/图 + 工作台事实板”；UI/README/报告统一标注 service/mapper/SQL 已采集但**无前端 SDK/关联/回放/实时**；S2 通过也不得宣称产品完成。
