# S2 计划评审（G1 门）

> 评审人：plan-reviewer（只读）｜日期：2026-11-24｜阶段：S2（0-row fact chain）｜轮次：第 1 轮
> 绑定输入：`docs/plans/stages/S2/dispatch.md`（唯一任务输入）、`docs/plans/stages/S2/s2-plan.md`、
> `docs/contracts/{api,event-model,transport}.v1.md`、`fixtures/s2-zero-row-chain/**`、`schema/traceboard.event.v1.json`
> 权威来源：主计划 §2.3、§5（案例 A）、§8.1–8.5、§9.1–9.2、§13.4、§16 T1/T2/T5/T7；`SOLO-PLAN.md` S2 行；S1 评审 R1/R2。
> 结论：**G1: PASS**（0 个阻断项，11 个非阻断项；非阻断项不阻止冻结，由 owner 在实现/测试说明中落实）

---

## 1. 结论摘要

| 项 | 结果 |
|---|---|
| 范围（仅 S2，无 S3+） | **PASS** |
| 契约矩阵 / requests / graph | **PASS**（N1 历史指针） |
| 与 S1 ingest/query 兼容 | **PASS** |
| demo 0 行缺陷与 200/404 口径 | **PASS** |
| event-model 语义（LOST 子链 / UNKNOWN / controller HTTP） | **PASS** |
| schema 字节不变 | **PASS** |
| fixture schema / 单根 / 父子 / 嵌套 / 状态 / 行数 | **PASS** |
| expected-facts 深比较 | **PASS** |
| plan 可行性（demo/agent/collector/workbench） | **PASS**（N7/N8 实现细节） |
| S1 保留 / S1-E/S1-G/S1-H 改写 | **PASS** |
| 测试计划 / 命令 / JDK 固定 | **PASS** |
| 风险与安全 | **PASS**（N4/N6/N9/N10 备注） |
| 偏离 D1–D9 | **PASS**（N2/N3/N5 文档修正） |
| **G1** | **PASS** |

- **阻断项：0**。
- **非阻断项：11**（N1–N11，见 §6；均可一轮内文档/说明层修正，不改变 S2 验收信号）。
- 本次评审**只写本文件**；未改 schema、契约、fixture、计划、代码、pom、`tools/verify`；未执行 git 写操作。

---

## 2. 冻结基线（评审时点 `sha256`，G2 漂移检查以此为准）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
0bf3d28f3e6ee97339c62df6e87dcebb664e7e710b8e3a32007c8ce2fe382607  docs/contracts/api.v1.md
228ffa962ce47bf77dd5360f654aedc50b4dd113891eff39c47a6400023dae2d  docs/contracts/event-model.v1.md
cf7c0475b8da9c066d3f99408354f0b619e0aa7161fe740af1f630d7c43b59c1  docs/contracts/transport.v1.md
2d1abc0f211979aa4853fa979673ff32d82a3689f958ee965890fb6cec1535fc  fixtures/s2-zero-row-chain/events.ndjson
8869ad79cdedc490bbb4ec5d6738abe9e84c3ced5705a54976abf5527b409a69  fixtures/s2-zero-row-chain/expected-facts.json
c2ab2fc1b99b2bf9476639cccfb0642a6f573574a81e6e5e4e54d997d234585b  fixtures/s2-zero-row-chain/README.md
65f24eb2b15013060cb56bae05c22207d21b31bb558b0ac7a0dc6f8a5e7021bc  docs/plans/stages/S2/s2-plan.md
bf602001ce0bf87bde93a8cc695e32a9edffc68b8612d03d1364cc13ffc51adc  docs/plans/stages/S2/dispatch.md
```

S0/S1 冻结面（本阶段不得变化；已逐字核对）：

```text
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d  fixtures/case-a-zero-rows/README.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
```

`git diff --stat s1-baseline -- schema fixtures/case-a-zero-rows fixtures/s1-walking-skeleton` 为空：**schema 字节与 S0/S1 fixture 未变**。
当前工作树仅 `docs/contracts/{api,event-model,transport}.v1.md` 为 `M`；`docs/plans/stages/S2/` 与 `fixtures/s2-zero-row-chain/` 为新增未跟踪。

---

## 3. PASS/FAIL 表

| # | 检查项 | 判定 | 证据 |
|---|---|---|---|
| 1 | S2 范围只含 0 行事实链（demo 0 行、agent 4 span、collector requests/graph、workbench 请求切换/事实板） | **PASS** | `s2-plan.md:8-19,21-36`；`dispatch.md:35-56,62-70` |
| 2 | 无 S3+（无浏览器 SDK/traceparent/clickId、无 replay/timeline、无 SSE/WS、无 field diff/values、无 schema 改、无持久化） | **PASS** | `s2-plan.md:28-36`；`api.v1.md:568-575`；`event-model.v1.md:212-215`；`transport.v1.md:181-199` |
| 3 | api §2.2 S2 矩阵：requests/graph IMPLEMENTED，replay/stream/ws/links RESERVED | **PASS** | `api.v1.md:67-85` |
| 4 | requests 形状：traceId/rootSpanId/rootKind/nodeKey/status/confidence/spanCount/startedAtNs/durNs/hasError；排序、无根、404/405、无分页 | **PASS** | `api.v1.md:417-454`；`s2-plan.md:199-203` |
| 5 | graph 形状：nodes/edges、`from`=父/`to`=子、11 字段、排序、无 ×N、缺 traceId 400、未知 404、405、两次 GET 一致 | **PASS** | `api.v1.md:456-544`；`s2-plan.md:205-211` |
| 6 | 与 S1 ingest/query/meta 无矛盾（写入面仍仅 ingest；meta 5 键不变） | **PASS** | `api.v1.md:72-85,546-555`；`transport.v1.md:181-199`；`MetaController.java` |
| 7 | demo 缺陷真实且口径一致（CREATED 行、`status='PAID'`、0 行、Service true、HTTP 200、未知 id 404） | **PASS** | `api.v1.md:609-627`；`s2-plan.md:101-112`；`dispatch.md:62-64,74-83` |
| 8 | 缺陷是**故意**植入且不削弱 TraceBoard 诚实性（fixture 不得冒充运行时） | **PASS** | `api.v1.md:611,626`；`fixtures/s2-zero-row-chain/README.md:7-18`；`expected-facts.json:7` |
| 9 | event-model：LOST 子链继承、`LOST_BACKEND` 只在根、`transaction=UNKNOWN`、controller HTTP 状态；schema 不改 | **PASS** | `event-model.v1.md:7-10,107-116,136-148,150-170,179-192`；schema hash |
| 10 | fixture 4 行过 schema（Ajv 2020-12 strict、离线、无外部 `$ref`） | **PASS** | 本次 `Ajv({strict:true,allErrors:true})` 编译冻结 schema，4/4 通过；schema 无 `$ref` |
| 11 | fixture 单 trace/单根、controller→service→mapper→sql 父链、区间严格嵌套 | **PASS** | `events.ndjson:1-4`；本次脚本：roots=1、traceIds=1、父子 3/3、containment 3/3 |
| 12 | fixture 全 OK/全 LOST、根 `LOST_BACKEND`+`click_lost_<spanId>`、子 flags 只有阶段标记 | **PASS** | `events.ndjson:1-4`；`expected-facts.json:28-48` |
| 13 | SQL `rowsAffected=0`/`transaction=UNKNOWN`、Mapper `0`、Service `true`、Controller HTTP `200`、eventCount 4、无 THREW | **PASS** | `events.ndjson:1-4`；`expected-facts.json:53-126` |
| 14 | expected-facts 6 条 fact + globalAssertions 可深比较（含 `#trace.*` 派生） | **PASS** | 本次脚本 F1–F4 深比较 4/4；F5/F6 派生 `threwCount=0`/`spanCount=4` |
| 15 | fixture 字节规则：无 BOM、无 CR、LF 末行 `\n`、无空行、无 `seq`/`values`/`reason` | **PASS** | `wc -c`/`tr -cd '\r'`/`od`：CR=0、BOM 无、末字节 `0a`；`node` 检查 `seq/values/reason` 均 false |
| 16 | demo 可行性：Boot 2.7.18 + MyBatis starter 2.3.1 + H2 2.1.214 + JDK8；H2 表/mapper/seed/删除内存 store | **PASS** | `s2-plan.md:83-123`；本地 `spring-boot-dependencies-2.7.18.pom:66` 确认 `h2.version=2.1.214`；`demo/.../pom.xml` 现状 Boot 2.7.18/JDK8 |
| 17 | agent 可行性：4 点插桩、ThreadLocal 栈、MapperProxy 过滤、PreparedStatementHandler 反射、fail-open、spike/BLOCKED | **PASS** | `s2-plan.md:125-188,314-321`；`AgentConfig.java:17`；`TraceAgent.java:49-76`；`SpanEmitter.java:50-118`；`EventSender.java:55-70` |
| 18 | collector 可行性：读时派生、不落 DB/文件/缓存、不改 seq、不注册 replay/stream/ws/links | **PASS** | `s2-plan.md:190-216`；`SessionLog.java:50-60`；`EventStore.java:30-45`；`SessionsController.java:47-93` |
| 19 | workbench 可行性：会话选择、请求 tabs/切换、事实链、事实条、LOST 标注、5s 非实时、S1/S0 面板保留 | **PASS** | `s2-plan.md:218-231`；`workbench/src/api.ts`、`App.vue`、`S1Panel.vue` 现状可扩展 |
| 20 | S1 保留 / S1-E/S1-G/S1-H 改写合理且不放宽 | **PASS** | `dispatch.md:148-152`；`s2-plan.md:254`；`tools/verify/verify.mjs:1748,2253-2263,2289-2302,2179-2185` |
| 21 | 测试计划覆盖 E2E 真 0 行、200/404、fail-open、无 THREW、requests/graph、构建、回归、no-S3 扫描 | **PASS** | `s2-plan.md:240-260` |
| 22 | 命令/引号路径/JDK 固定：JDK21 根/collector、JDK8 demo、Node/npm、端口、`-javaagent` | **PASS** | `s2-plan.md:262-312`；`dispatch.md:238-244` |
| 23 | 风险与边界：MyBatis 反射、H2 初始化、事件顺序、LOST UI、fixture-vs-runtime、`countById` 缺口 | **PASS**（N4/N6/N9/N10） | `s2-plan.md:323-336,338-350`；`dispatch.md:246-260` |
| 24 | 安全：无 secret/真实数据/遥测/CDN/镜像；仅回环；无 SQL 文本/参数；错误信封不回显 body | **PASS** | `s2-plan.md:87,256`；`api.v1.md:566`；`transport.v1.md:201-206`；fixture 无敏感字段 |
| 25 | 偏离 D1–D9 不放松 S2 验收、不推翻 dispatch §3 决策 | **PASS**（N2/N3/N5） | `s2-plan.md:338-350`；逐条见 §4.12 |

---

## 4. 逐项证据

### 4.1 范围（S2-only）

- S2 只交付 6 项：契约+s2 fixture+s2-plan、demo H2/MyBatis 0 行、agent 4 span、collector requests/graph、workbench 请求切换/事实板、verify/test-report（`dispatch.md:35-44`；`s2-plan.md:21-36`）。
- 明确不做 S3：无浏览器 SDK/`traceparent`/clickId/关联引擎；无时间轴/回放/`replay` API；无 SSE/WebSocket/实时订阅；无 `values[]`/字段 diff/参数值/L1-L2/行级变量/异常 payload；collector 不落 DB/文件、无淘汰/采样/缓存；无 launcher/cloud/Tomcat/React/MySQL 服务/上传/沙箱（`s2-plan.md:28-36`；`api.v1.md:568-575`；`event-model.v1.md:212-215`；`transport.v1.md:181-199`）。
- 代码搜索未发现 S2 产物引入 replay/stream/ws/links 路由；collector 仍只有 S1 的 4 条路由 + S2 将新增的 requests/graph（`SessionsController.java`、`MetaController.java`、`IngestController.java`）。
- 说明：S2 链是 `confidence=LOST` 的游离后端请求，不画成点击链（`s2-plan.md:29-31`；`transport.v1.md:198-199`）。

### 4.2 契约矩阵

`api.v1.md:67-85` 的 S2 矩阵：

| 端点 | S2 状态 | 与 dispatch 对照 |
|---|---|---|
| `GET /actuator/health`、`GET /api/v1/meta`、`POST /ingest/v1/events`、`GET /api/v1/sessions`、`GET .../events` | IMPLEMENTED | 与 S1 一致 |
| `GET .../requests` | IMPLEMENTED（新增） | `dispatch.md:102-112` |
| `GET .../graph?traceId=<32hex>` | IMPLEMENTED（由 RESERVED 转正） | `dispatch.md:114-125` |
| `replay`/`stream`/`ws/v1/events`/`links` | RESERVED（不注册） | `dispatch.md:49-53`；`api.v1.md:78-81,544` |

- 写入面仍只有 `POST /ingest/v1/events`；requests/graph 读时派生、不落 DB/文件、不缓存、不改写事件、不消耗 `seq`（`api.v1.md:83`；`s2-plan.md:192-197`）。
- meta `capabilities` 5 键不变：`health=true, meta=true, ingestEvents=true, realtime=false, replay=false`（`api.v1.md:546-555`；`MetaController.java`）。
- **N1**：`api.v1.md:32` 的 S0 历史节仍写“当前权威矩阵见 §2.1”，S2 起应为 §2.2（非阻断，见 §6）。

### 4.3 requests 形状

`api.v1.md:417-454` 与 `s2-plan.md:199-203` 一致：

- 顶层 `{"sessionId":"...","requests":[...]}`；每条 `traceId, rootSpanId, rootKind, nodeKey, status, confidence, spanCount, startedAtNs, durNs, hasError`。
- `rootSpanId/rootKind` 取 `parentSpanId=null`；多根取 `startNs` 最小、同值 `spanId` 字典序最小（D7）；无根仍列出，`root*`/`nodeKey=null`、`confidence="LOST"`（诚实缺口）。
- `status` 聚合优先级：`THREW > UNKNOWN > NOT_COLLECTED_POLICY > NOT_COLLECTED_LOST > NOT_COLLECTED_NO_DEBUG_INFO > TRUNCATED > RETURNED_FALSE > OK`；`hasError` = 存在 `THREW`。
- 排序 `startedAtNs` 升序、同值 `traceId` 字典序；空会话 `{"sessionId":"...","requests":[]}`；无分页；未知 session 404；写动词 405；未识别查询参数忽略。
- 与 dispatch §4.3 的差异仅是**追加** `sessionId`（顶层）/`durNs`/`hasError`，D1 记录；用户任务要求的字段全部覆盖。

### 4.4 graph 形状

`api.v1.md:456-544` 与 `s2-plan.md:205-211` 一致：

- 顶层 `sessionId, traceId, rootEventId, confidence`；`nodes` 每条固定 11 字段（`spanId, parentSpanId, kind, nodeKey, status, return, sideEffects, startNs, durNs, thread, flags`）；`edges` `{from,to,count}`，`from`=父、`to`=子，S2 `count` 恒 1。
- `nodes` 按 `startNs`、同值 `spanId`；`edges` 按父节点位置再按子节点位置；父不在 trace 内则不产生边但不补节点；同 `nodeKey` 多次调用 → 多节点（×N 属 S3+）。
- `traceId` 必填且 `^[0-9a-f]{32}$`；缺失/空/大写/长度错 → 400；未知 session → 404；session 内无该 trace → 404；写动词 405；不回落默认 traceId、不返回空图冒充命中。
- 两次相同 GET 逐字一致，事件/`seq`/存储不变；不注册 replay/stream/ws/links。
- dispatch §4.4 草案的 `parentSpanId/childSpanId` 命名由 D2 改为 `from/to`，语义等价；用户任务亦要求 `from/to`。

### 4.5 与 S1 ingest/query 兼容

- ingest 的 202/400/413/415、幂等键、内存 append-only、`seq` 位置均未改（`api.v1.md:73,271-305`；`transport.v1.md:107-125`）。
- S1 查询 `GET /api/v1/sessions`、`GET .../events?afterSeq=&limit=` 形状/分页/错误不变（`api.v1.md:307-343`）。
- S2 只新增两个 GET 只读派生；`store.find==null` → 404，不自动创建会话（`s2-plan.md:197`；`EventStore.java:30-32`）。
- meta 5 键不变；collector 不新增 DB/文件依赖；无 CORS/鉴权/429（`api.v1.md:546-555`；`transport.v1.md:201-206`）。
- 历史指针：`api.v1.md:32` 的 §2.1 指针为 N1；`api.v1.md:385-391` 的 S1 “graph RESERVED”是 S1 历史，S2 §8 已转正，不构成当前矛盾。

### 4.6 demo 0 行缺陷（Appendix B）

`api.v1.md:609-627`、`s2-plan.md:101-112`、`fixtures/s2-zero-row-chain/README.md:73-80` 三处一致：

| 分支 | 行为 | 证据 |
|---|---|---|
| `POST /api/orders/1/cancel` | `countById(1)==1` → `cancelById(1)` → `UPDATE ... WHERE id=1 AND status='PAID'` 对 `CREATED` 行影响 **0**；Service **忽略**返回值 → `true`；Controller `200 {"data":true}` | `api.v1.md:616`；`s2-plan.md:105` |
| 未知 id | `countById(id)==0` → `false`，**不调用** `cancelById`；Controller `404 {"data":false}`；链只有 controller+service（`RETURNED_FALSE`） | `api.v1.md:617`；`s2-plan.md:106` |
| `GET /api/orders` | `findAll()` 来自 H2，seed `id=1, SO-0001, CREATED, 100.00` | `api.v1.md:615`；`s2-plan.md:107` |
| demo 前端 | 不改：2xx → “操作成功” + 刷新；列表仍 `CREATED` | `api.v1.md:618`；当前 `demo/.../frontend/src/App.vue:103` |

- 明确标注“这是 demo 应用故意植入的缺陷（主计划 §5 案例 A），不是 TraceBoard 的 bug；TraceBoard 只记录事实”（`api.v1.md:611`）。
- 0 行必须是运行时 H2 SQL 事实；fixture 只用于确定性测试，禁止冒充（`api.v1.md:626`；fixture README `:15-18`）。
- 已知文案瑕疵：demo 前端页头仍写 S0 “无缺陷”，S2 登记、S3 统一修正（`api.v1.md:627`；`dispatch.md:83`）。该瑕疵不改变 Appendix B 行为口径，属于已登记项。

### 4.7 event-model 与 schema

- `event-model.v1.md:7-10` 的 S2 澄清只做短注：`transaction="UNKNOWN"`、controller 可写真实返回类型 FQCN + HTTP 状态、游离后端根可带同 trace 子链且 `LOST_BACKEND` 只在根；**schema 字节不变**。
- `event-model.v1.md:159-161`：S2 子 span 指向本 trace 的父，继承 `confidence=LOST` 与同一 `rootEventId`；`LOST_BACKEND` 只写根；该 traceId 不得含前端事件。
- `event-model.v1.md:147-148`：`transaction="UNKNOWN"` 合法且为 S2 默认；`rowsAffected=0` 是正常事实。
- `event-model.v1.md:114-116`：controller 的 `return={type:<FQCN>, value:<HTTP status>}` 是同一 HTTP 约定的后端写法，不记录 body。
- `event-model.v1.md:184,188`：`LOST_BACKEND` 与 `S2_ZERO_ROW_CHAIN` 均在 flags 词表；schema `flags` 模式允许。
- schema 哈希 `927937df…a489a` 与要求完全一致；`git diff` 对 `schema/` 为空。

### 4.8 fixture（`fixtures/s2-zero-row-chain/**`）

**schema 校验**：以 `tools/verify/node_modules/ajv/dist/2020.js` 的 `Ajv({strict:true,allErrors:true})` 编译冻结 schema，4 行全部通过；schema 无外部 `$ref`，离线可校验。

**结构**（本次脚本核对）：

- `roots=1`（`1a2b3c4d5e6f7a80`, controller）；`traceIds=1`；`rootEventIds=1`。
- 父链：`controller(1a2b…) ← root`、`service(2b3c…) ← 1a2b…`、`mapper(3c4d…) ← 2b3c…`、`sql(4d5e…) ← 3c4d…`。
- 区间：`[1.000s,1.008s] ⊃ [1.001s,1.0075s] ⊃ [1.002s,1.007s] ⊃ [1.003s,1.006s]`，containment 3/3 true。
- `startNs=1000000000/1001000000/1002000000/1003000000`；`durNs=8000000/6500000/5000000/3000000`；全部 `>0`。
- `confidence` 4/4 `LOST`；`status` 4/4 `OK`；无 `THREW`、无 `reason`、无 `values`、无 `seq`。
- flags：根 `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]`；三个子 `["S2_ZERO_ROW_CHAIN"]`；`LOST_BACKEND` 只在根。
- SQL：`sideEffects=[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":0,"transaction":"UNKNOWN"}]`；mapper `return.value=0`；service `true`；controller `return.value=200`。

**expected-facts**：

- 6 条 fact + `globalAssertions`；F1–F4 逐条深比较 `200/true/0/0` 全部 true；F5/F6 使用 `#trace.threwCount=0`、`#trace.spanCount=4`（`derivedPathSyntax` 已定义）。
- `globalAssertions` 覆盖单根、共享 trace/root、全 LOST/全 OK、无 THREW、无 reason/values、父子链、kind 链、startNs 非降、区间包含/嵌套、durNs>0、thread 相同、flags 精确、SQL 0/UNKNOWN。
- `note` 明确“fixture 是确定性测试数据；运行时 0 行证据来自 H2+MyBatis demo + javaagent E2E，不得用 fixture 替代”（`expected-facts.json:7`）。

**字节**：

- `events.ndjson` 2227 字节，4 个非空行 + 末尾 `0x0a`；CR=0；BOM 无（首字节 `7b 22 73`）。
- `expected-facts.json` 4478 字节，末尾 `0x0a`；CR=0；BOM 无。
- `README.md` 8776 字节，末尾 `0x0a`；CR=0；BOM 无。
- README 明确“是契约形状、不是运行时证据；禁止用 fixture 伪造 0 行结论”（`:11,15-18`）。

### 4.9 plan 可行性

**demo**：

- Boot 2.7.18、`mybatis-spring-boot-starter:2.3.1`（Boot 不管理，显式版本）、H2 `runtime` 版本由 Boot 管理（本地 `spring-boot-dependencies-2.7.18.pom:66` 为 `2.1.214`）、JDK8（`s2-plan.md:83-89`）。
- `jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1`、`spring.sql.init.mode=always`、`schema.sql`/`data.sql`、`mapper/OrderMapper.xml`、删除 `InMemoryOrderStore`、Service 注入 `OrderMapper`（`:86-117`）。
- 缺陷分支与 Appendix B 一致；`countById` 为真实 SQL 存在性检查（`:101-112`）；前端不改。
- **N8**：计划未点名 `@Mapper`/`@MapperScan`（见 §6），属实现细节，spike 1 会暴露；不阻断。

**agent**：

- 4 点：`OrderController#cancel(long)`、`OrderService#cancel(long)`、`MapperProxy#invoke`（Advice 内按 `Method` 过滤 `OrderMapper#cancelById`）、`PreparedStatementHandler#update`（反射 `mappedStatement` 并匹配 `OrderMapper.cancelById`）（`s2-plan.md:132-143`）。
- `ThreadLocal<ArrayDeque<Frame>>` 进入压帧/退出弹帧；controller 创建 traceId/rootSpanId/rootEventId，子 span 继承；同线程同步链；异常也弹栈；orphan/深度保护（`:145-153`）。
- `EventSender` 沿用 S1：容量 16、单守护线程、1 次尝试、fail-open、每 span 一行 NDJSON 以 `\n` 结尾（`:176-180`；`EventSender.java:18-70`）。
- `mappedStatement` 在 `BaseStatementHandler`，反射需遍历父类；读不到不产生 SQL span 并 `BLOCKED`，不得伪造 rows（`:139,143,328`）。
- `ResponseEntity#getStatusCode().value()` 反射读取；读不到 `value=null` + stderr 计数，不猜 200/404（`:169`）。
- spike A/B/C + BLOCKED，禁止 fixture/合成（`:182-188,314-321`）。
- **N7**：`-Dtraceboard.traceId` 固定值与“并发每线程独立 traceId”存在张力（见 §6）；S2 E2E 不设置该属性即可规避。
- **N3**：`source` 的 file/line 口径与 fixture README 有轻微表述差（见 §6）；不影响 tester 只断言文件名。

**collector**：

- 只读内存快照 + Jackson `readTree` 逐条解析；不新增存储/缓存/seq；未知 session 404；requests 分组/根选择/spanCount/startedAtNs/durNs/hasError/status 聚合/排序/空会话；graph 参数/顶层/11 字段/edges/排序/无聚合/400/404/405；不注册 replay/stream/ws/links；meta 5 键不变（`s2-plan.md:190-216`）。
- 现有 `SessionLog.snapshot()` 返回不可变事件列表，`EventStore.find` 可判未知 session，`SessionsController` 的 GET-only 映射天然对写动词 405（`SessionLog.java:50-60`；`EventStore.java:30-45`；`SessionsController.java:47-93`）。

**workbench**：

- `src/api.ts` 增加 `RequestSummary/RequestsResponse/GraphNode/GraphEdge/GraphResponse` 与 `fetchRequests/fetchGraph`；`S2Panel.vue` + `stores/s2.ts`；稳定选择器 `#s2-panel/#s2-session/#s2-refresh/#s2-requests/#s2-chain`；事实条中性文案；LOST 标注；5s 轮询（可见时）；无 SSE/WS/时间轴/回放/图库/SDK；S1 面板折叠、S0 面板保留（`s2-plan.md:218-231`）。
- 现有 `workbench/src/api.ts` 已有 `fetchSessions`/`CollectorUnreachableError`/`CollectorHttpError`，可复用；`App.vue` 已有 S1Panel 与 FixturePanel，可加 S2Panel。

### 4.10 S1 回归 / 门禁改写

- 保留：S0 全部、S1-A fixture、S1-B 产物、S1-C/D ingest/查询、S1-F 假批次、S1 fixture 字节（`dispatch.md:148-152`；`s2-plan.md:254`）。
- 改写 S1-E：原“每次 cancel 恰好 1 条 controller span”改为 S2 4-span 链（`verify.mjs:1748` 旧断言与 S2 冲突，必须改写；S2 T4）。
- 改写 S1-H：原“恰好 4 条路由/单 type 单 advice/禁止 `PreparedStatement`/`rowsAffected`”改为 S2 范围扫描（`verify.mjs:2253-2263,2289-2302`）。
- 改写 S1-G：原 S1 G1 基线包含 S1 契约哈希；S2 修改契约后改为 S0 冻结面 + S2 G1 基线，S1 fixture 不纳入新哈希但字节仍断言（`verify.mjs:2179-2185`；`s2-plan.md:254`）。
- 旧断言未放宽为“存在即可”；S2 用真实运行时证据替代（`dispatch.md:152`）。
- 合理性：S1-E/S1-H 的旧断言与 S2 的 4 span / 新增路由**直接冲突**，不改写会导致回归必红；S1-G 的契约哈希因 S2 追加型契约变更必然变化；改写是必要的，且保留 S0/S1 fixture 字节检查。

### 4.11 测试计划与命令

- T1–T12 映射 S2-A..S2-L（`s2-plan.md:240-260`）：
  - T1 fixture/schema/负例（加 `seq`、双根、断父链、`EXACT`）；
  - T2 demo 构建 + H2/MyBatis/`schema.sql`/`data.sql`/`status='PAID'`/无内存 store/无 MySQL；
  - T3 agent jar major=52/Premain-Class/shaded；collector jar schema 字节等价；workbench `npm ci && build`；
  - T4 真 E2E：200 true、≤10s 读回 4 span、父子、同 trace/root、LOST、全 OK、durNs>0、mapper 0/service true/controller 200/sql 0 UNKNOWN、无 THREW、无额外 update、列表仍 CREATED；
  - T5 未知 id 404 false、service `RETURNED_FALSE`、无 mapper/sql；
  - T6 requests 形状/排序/空会话/404/405；
  - T7 graph 4 节点 3 边/排序/原样/404/400/两次一致；
  - T8 workbench dist 选择器/文案/无 SSE/WS/时间轴/回放/SDK/代理；
  - T9 S0/S1 回归与 S1-E/S1-G/S1-H 改写；
  - T10 fail-open；
  - T11 no-S3/security；
  - T12 漂移/清理。
- 命令（`s2-plan.md:262-312`）：
  - 根/collector `JAVA_HOME="C:/Program Files/Java/jdk-21"`；demo `JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221"`；`JAVA8=".../bin/java"`。
  - 仓库路径 `D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool`，所有含空格路径双引号。
  - collector 8601、demo 8080、workbench 5173、demo 前端 5174；`netstat` 诊断；`finally` 清理。
- 与 S1 verify 现状一致：`tools/verify/verify.mjs` 已具备 S1-E 的 JDK8 绝对路径、fail-open、S1-G 基线、S1-H 扫描；S2 tester 可扩展。

### 4.12 偏离 D1–D9

| ID | 结论 | 理由/证据 |
|---|---|---|
| D1 requests 增加 `sessionId`/`durNs`/`hasError` | **接受** | 只读派生、加法字段；用户任务要求的 requests 字段全部覆盖；api §8.1 固化 |
| D2 edges `{from,to,count}` | **接受** | 语义等价（`from`=父、`to`=子）；dispatch §4 已把细节委托 plan-writer；api §8.2 命名对照 |
| D3 controller `return` 用 FQCN+状态码 | **接受** | event-model §4.3 S2 短注明确允许；比 `type:"http"` 更真实，不记录 body |
| D4 `LOST_BACKEND` 只在根 | **接受** | 与 dispatch §4.2、event-model §5/§7 一致；**N2**：D4 对 dispatch §4.5 的引用失实 |
| D5 fixture 行号为示例、tester 只断言文件名 | **接受** | 与 S1 口径一致；**N3**：s2-plan §7.4 的“只写 file”表述需统一 |
| D6 `countById` 不插桩、链固定 4 span | **接受，须可见** | dispatch §4.2 允许“额外 select 默认不插桩”；s2-plan §6.3 明确“采集范围限定，不是伪造”；**N6**：UI 需避免暗示全量 SQL |
| D7 多根取最小 `startNs`/`spanId` | **接受** | 确定性；api §8.1 固化；无根仍列出 |
| D8 agent 默认 session `s_s1agent`→`s_s2agent` | **接受** | S1 回归显式传 `-Dtraceboard.sessionId=s_s1agent`（`verify.mjs:1689`），不受影响 |
| D9 fixture `durNs` 采用 dispatch 给定值 | **接受** | 严格嵌套；与 `expected-facts` 一致 |

- D1–D9 均**未**降低 S2 验收信号；未推翻 dispatch §3 的技术决策。
- **N5**：graph 在 dispatch §4.4 示例之外追加 `sessionId` 与 node `thread`/`flags`，D1 未覆盖，建议补记为 D10/D11（加法字段，不改变语义）。
- **N4**：`DROP_COUNT` 未写入事件，S1 D16 曾“留待 S2”，S2 §7.6 选择不扩；与 event-model §7 存在文字张力，建议补 D10 或实现（见 §6）。

---

## 5. 阻断问题

**无。** 未发现会阻止 G1 冻结或使 S2 验收信号不可达的问题。

主要理由：

1. 6 项 S2 验收信号均有可执行落点与测试映射（§1/§4.9/§4.11）。
2. 契约与 dispatch 的差异均为**加法/命名/真实类型**，且 D1–D9 记录；无 S3 能力。
3. schema 字节与 S0/S1 fixture 未动；s2 fixture 4/4 过 schema 且满足单根/父子/嵌套/状态/行数不变量。
4. demo 0 行来自真实 H2 SQL 设计；fixture 明确 test-only，不存在“fixture 冒充运行时”的表述。
5. 无 secret/真实数据/遥测/CDN/镜像；仅回环；无 SQL 文本/参数；错误信封不回显 body。

---

## 6. 非阻断建议（不阻止冻结；owner 在实现/测试说明中落实）

| ID | 事项 | 证据 | 精确修正 |
|---|---|---|---|
| N1 | `api.v1.md` 的 S0 历史节仍写“当前权威矩阵见 §2.1” | `api.v1.md:32` | 改为“当前权威矩阵见 **§2.2**（§2.1 为 S1 历史）”；只改指针，不改矩阵 |
| N2 | D4 声称 dispatch §4.5 写“子 span flags 含 `LOST_BACKEND`”，但 dispatch 全文无此句（grep 仅 `:94`） | `s2-plan.md:345`；`dispatch.md:94,127-132` | 将 D4 的引用改为“event-model §5 第 2 条 S2 补充/§7；dispatch §4.2 已明确子 flags 只有 `S2_ZERO_ROW_CHAIN`”；行为不变 |
| N3 | `s2-plan.md` §7.4 写 `source` “只写真实栈帧的 `file`…不猜行号”，fixture README 写“`source.line` 是示例值，agent 写真实退出点行号，tester 只断言文件名” | `s2-plan.md:167`；`fixtures/s2-zero-row-chain/README.md:44-45`；`SpanEmitter.java:80-92` | 统一为“写真实栈帧的 `file`；`line` 仅在真实退出点可取时写入、不猜；tester 只断言 `file`（同 S1）”；不改 fixture 字节 |
| N4 | S1 D16 曾把 `DROP_COUNT` 写入事件“留待 S2”，S2 §7.6 选择“不扩”；event-model §7 仍要求丢弃以 `DROP_COUNT` 或 `NOT_COLLECTED_LOST + reason` 出现 | `s1-plan.md:408`；`s1-plan.md:188-189`；`s2-plan.md:180`；`event-model.v1.md:192` | 二选一：①在 `s2-plan.md` §15 增加 D10，明确“S2 仍只 stderr 计数（dispatch §4.2 授权），事件级 `DROP_COUNT` 留待后续契约变更”，并在 `test-report` 用日志证据核对；②实现根 span `flags` 追加 `DROP_COUNT=<n>`（schema 允许），同步 fixture `flagsRootExact` 与 expected-facts。**S2 验收不依赖此项**，但不得声称事件级丢弃可见 |
| N5 | graph 在 dispatch §4.4 示例之外追加顶层 `sessionId` 与 node `thread`/`flags`；D1 只记录 requests 的加法字段 | `api.v1.md:466-491`；`dispatch.md:114-125`；`s2-plan.md:342` | 在 §15 增加 D10/D11（或 api §8.2 字段注）：“graph 追加 `sessionId`/`thread`/`flags`，均为事件原样/路径回显的只读加法字段，不改变 dispatch 语义”；若要求与 dispatch 示例逐字一致，则删除这三项并同步 fixture README/测试 |
| N6 | UI 事实条只规定“某 kind 缺失时显示未采集”；若 SQL 节点存在但 `sideEffects` 为空/`status=THREW`，按“sum”会显示 `SQL 影响 0 行`，把“未采集”误报成 0 行；`return=null` 的 Mapper/Service/Controller 同理 | `s2-plan.md:225-227`；`api.v1.md:511-517` | 事实条取值增加：`sideEffects[].rowsAffected` 不存在 → “未采集”（不是 0）；`return` 为 `null` → “未采集/异常”；仅当真实值存在时才显示 `0/true/200`。S2 T4 可加一条“SQL THREW 时事实条显示未采集/异常”的静态断言（或仅文档口径） |
| N7 | `-Dtraceboard.traceId` 固定值与“并发请求每线程独立 traceId”冲突；S1 G1 R1 已提示 | `s2-plan.md:147-153`；`AgentConfig.java:45-48`；S1 评审 `R1` | 明确“S2 E2E/并发不设置 `-Dtraceboard.traceId`；该属性仅单请求诊断；若设置则不得并发/重复请求，且不得用于 requests 排序断言”；T4/T6 造两个 trace 时断言 `traceId` 互异 |
| N8 | demo 计划未点名 MyBatis mapper 注册方式（`@Mapper` 或 `@MapperScan`），否则 `OrderMapper` 可能不被 Spring 注册 | `s2-plan.md:91-100`；`ShopApplication.java`；当前 `demo/.../pom.xml` 无 MyBatis | 在 §6.2/§6.4 明确在 `OrderMapper` 加 `@Mapper`，或在 `ShopApplication` 加 `@MapperScan("com.example.shop.mapper")`；T2 增加静态断言“存在 `@Mapper` 或 `@MapperScan`” |
| N9 | §6.1 的 H2 保留字 fallback 有笔误“改名 `order_no` → `order_no` 保持” | `s2-plan.md:89` | 改为“保留 `order_no` 命名；仅必要时对 `orders`/`status` 加引号；不得手改 H2 版本” |
| N10 | fixture 的 SQL span `source.file="OrderMapper.xml"`/`line=12` 是示意值，真实 agent 在 `PreparedStatementHandler#update` 处取到的栈帧不一定是 Mapper XML；graph 不输出 `source` | `fixtures/s2-zero-row-chain/events.ndjson:4`；`fixtures/s2-zero-row-chain/README.md:44-45`；`api.v1.md:503-517` | README/D5 注明“fixture 的 `source` 仅示例；SQL span 的 `source.file` 不作为运行时可复现断言；tester 只断言 controller `source.file`（同 S1）”；不要求改 fixture 字节 |
| N11 | `s2-plan.md` §3 冻结哈希清单未包含 `dispatch.md`，而 dispatch §5.2 要求 G1 基线含 dispatch | `s2-plan.md:47-50`；`dispatch.md:166` | 在 §3 的 `sha256sum` 清单加入 `docs/plans/stages/S2/dispatch.md`（本评审 §2 已记录其哈希；只改命令清单，不改语义） |

> N1–N11 均为文档/说明/静态断言层，不改变 schema、fixture 字节、契约字段或验收信号；其中 N4/N6/N7/N8 建议在 coder/tester 开工说明中显式落实，避免“0 行/丢弃/并发”被误读。

---

## 7. G1 冻结与交接

1. **G1 PASS 生效**：`docs/contracts/{api,event-model,transport}.v1.md`、`fixtures/s2-zero-row-chain/**`、`docs/plans/stages/S2/{s2-plan.md,dispatch.md}` 以 §2 哈希冻结；此后改字段/形状/排序必须停回本流程（`dispatch.md:234-236`）。
2. **coder-backend**：按 `s2-plan.md` §13 顺序先做 demo DB spike（H2+MyBatis 0 行、200/404），再做 agent 4 span spike（4 个 `transformed` + 4 条读回），再 collector requests/graph；spike 失败首行 `BLOCKED`，禁止 fixture/合成替代。
3. **coder-frontend**：按 `s2-plan.md` §9 实现 `#s2-*` 选择器、事实条中性文案、LOST 标注、5s 非实时轮询、S1 折叠、S0 保留；`npm ci && npm run build` 绿。
4. **tester**：按 `s2-plan.md` §11 T1–T12 扩展 `tools/verify`，一次命令 exit 0；S1-E/S1-G/S1-H 按 §4.8 改写且不放宽；test-report 记录 `countById` 采集范围（D6）与 stderr 丢弃计数（N4）。
5. **acceptance/G2**：用 §2 哈希做漂移检查；重跑构建/E2E；确认无 S3、无 secret/真实数据/遥测/CDN/镜像；按文件名 add + commit + tag `s2-baseline`，不 push/force/rebase。
6. **本轮范围**：仅新增本文件；未修改任何其他路径；未执行 git 写操作。
