# S3 计划评审（G1 门）

> 评审人：plan-reviewer（只读）｜日期：2026-11-24｜阶段：S3（frontend facts + read-only replay）｜轮次：第 1 轮（计划 v2，含时钟补丁）
> 绑定输入：`docs/plans/stages/S3/dispatch.md`（唯一任务输入）、`docs/plans/stages/S3/s3-plan.md`（v2）、
> `docs/contracts/{api,transport,event-model}.v1.md` 的 S3 章节、`fixtures/s3-frontend-facts/**`、`schema/traceboard.event.v1.json`
> 权威来源：主计划 §6（案例 B）、§8.1–8.5、§13.4、§16 T4/T5/T7/T8、§19 S6/S7；`SOLO-PLAN.md` S3 行；S2 基线 `s2-baseline`。
> 结论：**G1: PASS**（0 个阻断项，16 个非阻断项；非阻断项不阻止冻结，由 owner 在实现/测试说明中落实）。

---

## 1. 结论摘要

| 项 | 结果 |
|---|---|
| 范围（仅 runtime SDK + 前端事实 + 只读回放；无 S4/S5、无构建插件/sourcemap/L2、无 SSE/WS） | **PASS** |
| replay 契约（形状/原始 epoch-ns/窗口/排序/400/404/405/GET-only/0 写） | **PASS**（N8） |
| requests 契约（S2 字段保留 + 5 个新字段 + 派生 confidence + 案例 B 三态 + 混合 graph） | **PASS**（N6/N7） |
| SDK 事件语义（click/fetch/js_method/callback/render、flag、ID、头、EXACT 继承、LOST 回退、零请求证据、无 PII） | **PASS**（N4/N5） |
| agent 头关联（反射、严格解析、controller parent=fetch、无头=LOST、spike/BLOCKED） | **PASS** |
| 时钟模型（本机 epoch-ns、显示归一化、单机范围、schema 字节不变） | **PASS**（N11） |
| fixture（案例 A 7 行、案例 B 3 行、schema、父链、区间、replayWindows、编码） | **PASS**（N12/N13） |
| S2 API/回归保留 + S2 门禁迁移（demo SDK 为有意变更） | **PASS**（N14） |
| 计划可行性（SDK/demo/agent/collector/workbench/测试/命令/JDK） | **PASS**（N1–N3、N9、N14） |
| 风险与验收诚实性（时钟、精度、代理、头、混合根、额外 GET、案例 B、回放 0 写） | **PASS**（N5–N8、N10、N11） |
| 安全（无 secret/遥测/CDN/镜像、SDK 无 PII、localhost、错误信封不回显 body） | **PASS** |
| **G1** | **PASS** |

- **阻断项：0**。未发现会使 S3 验收信号不可达、或必须改 schema/越界 S4/S5 才能实现的问题。
- **非阻断项：16**（N1–N16；均可在一轮内以文档、任务卡、测试断言或实现细节修正，不改变 S3 验收信号与契约形状）。
- 本次评审**只写本文件**；未改 schema、契约、fixture、计划、代码、pom、`tools/verify`；未执行 git 写操作。

---

## 2. 冻结基线（评审时点 `sha256`，G2 漂移检查以此为准）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
932d290186e968eaa1804757efae4e1b70307371d3e15efd3834cfcc125f31ef  docs/contracts/api.v1.md
73578e05177e89826541740db0e67ec32fa3f52dd11c4cfdcc6e6ef4191c9f8e  docs/contracts/transport.v1.md
06ee878e9d3acc3d6a6ff66ee1e1d95c92ac5813913cc1ad84ae3977216025c0  docs/contracts/event-model.v1.md
9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56  docs/contracts/status-semantics.md   （S3 未改，保留参考）
dfea23ef4fb953a28dd018ceaee28d5af462c0f18604081877c89835659cabf1  fixtures/s3-frontend-facts/README.md
f99e57e16e16e9423f2776e0e2f93b27509bb0cf8b2e92bc80bb15f8e8c0f538  fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson
0ba30446bbf7997f2bb3a1b4b2c776438c81f301992390b5e3093fba5128f698  fixtures/s3-frontend-facts/case-a-joined-chain/expected-facts.json
2a73ac5fc5f9eb9ea2acbfc94585d15549ea7a57c5624c24934a13836d26e586  fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson
1667ceeb418d8d836cc719738cceb1b31b73d942041e43744d948d3a6f690759  fixtures/s3-frontend-facts/case-b-frontend-only/expected-facts.json
84a2fdf81735f0bc710f7973314c5867ceb9b0a8bcb4341a7d7d2e77e9e9769c  docs/plans/stages/S3/s3-plan.md
e8a756c05ae5e73c4f2cf97f408ec81985b205aeabd71d188d0d3ae7daa62e14  docs/plans/stages/S3/dispatch.md
```

S0/S1/S2 冻结面（本阶段不得变化；本次已逐字核对，与 S2 G1 基线一致）：

```text
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d  fixtures/case-a-zero-rows/README.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
2d1abc0f211979aa4853fa979673ff32d82a3689f958ee965890fb6cec1535fc  fixtures/s2-zero-row-chain/events.ndjson
8869ad79cdedc490bbb4ec5d6738abe9e84c3ced5705a54976abf5527b409a69  fixtures/s2-zero-row-chain/expected-facts.json
c2ab2fc1b99b2bf9476639cccfb0642a6f573574a81e6e5e4e54d997d234585b  fixtures/s2-zero-row-chain/README.md
```

工作树证据：`git status --porcelain` 仅有 `M docs/contracts/{api,event-model,transport}.v1.md` 与新增未跟踪
`docs/plans/stages/S3/**`、`fixtures/s3-frontend-facts/**`；`git diff --stat HEAD -- schema fixtures/case-a-zero-rows
fixtures/s1-walking-skeleton fixtures/s2-zero-row-chain docs/contracts/status-semantics.md demo/buggy-shop-boot-vue/backend
agent server/collector workbench` 为空。三份契约的 diff 为 S3 追加与历史指针注记（`git diff --numstat`：api +258/−9、
event-model +178/−6、transport +49/−12），未改写 S2 端点形状/排序/错误码。

---

## 3. PASS/FAIL 表

| # | 检查项 | 判定 | 证据 |
|---|---|---|---|
| 1 | 范围：只做 runtime SDK + 前端事实 + 状态语义 + 时间轴/只读回放；无构建插件/sourcemap/L2、无 launcher/IDEA/JAR/详情/×N、无 SSE/WS | **PASS** | `s3-plan.md:21-40`；`dispatch.md:46-54`；`api.v1.md:784-792`；`transport.v1.md:211-231`；`event-model.v1.md:363-367` |
| 2 | replay 形状 `{mode,readOnly,sessionId,fromNs,toNs,events:[{seq,event}]}`；原始 epoch-ns；`fromNs <= startNs <= toNs`；startNs/spanId 排序；400/404/405；GET-only；0 写；meta `replay=true` 且 5 键、`realtime=false` | **PASS**（N8） | `api.v1.md:641-691,762-771`；`transport.v1.md:211-231`；`s3-plan.md:75-89,155-166` |
| 3 | requests：S2 字段全保留 + `sdkActive`/`fetchCount`/`hasFrontend`/`hasBackend`/`backendSpanCount`；派生 confidence；案例 B 三态；graph 形状不变、click 根、controller parent=fetch | **PASS**（N6/N7） | `api.v1.md:693-760`；`dispatch.md:108-144`；`s3-plan.md:155-166`；fixture expected `apiExpectations` |
| 4 | SDK 事件语义：click/fetch/js_method/callback/render；click 根 `SDK_ACTIVE`/`S3_RUNTIME_SDK`/`OBSERVE_MS`；`SDK_ACTIVE` 子事件；traceparent `00-<trace>-<fetchSpan>-01` + `X-TraceBoard-Click`；controller EXACT 继承；LOST 回退；纯前端零请求证据；无 PII | **PASS**（N4/N5） | `event-model.v1.md:255-354`；`s3-plan.md:75-124`；`dispatch.md:73-106`；`fixtures/s3-frontend-facts/README.md:90-99` |
| 5 | 时钟：SDK/agent 同机 epoch-ns；collector 原样；显示 `relNs`；API 原始值；单机范围；schema 字节与 `integer>=0` 不变 | **PASS**（N11） | `s3-plan.md:91-101`；`event-model.v1.md:369-405`；`api.v1.md:637-639`；`fixtures/s3-frontend-facts/README.md:31-39` |
| 6 | 案例 A fixture：7 行单 trace、click→fetch→controller(parent=fetch)→service→mapper→sql→render、全 EXACT、区间嵌套、render 异步例外、SQL 0/UNKNOWN、HTTP 200 | **PASS** | `fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson:1-7`；`expected-facts.json:16-92`；本次脚本 7/7 |
| 7 | 案例 B fixture：3 行单 trace、click→validateForm(RETURNED_FALSE)→render、零 fetch/零后端、SDK_ACTIVE、eventCount 3、文案 | **PASS** | `fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson:1-3`；`expected-facts.json:16-75,200-207` |
| 8 | fixture 过冻结 schema（Ajv 2020-12 strict 离线）；无 BOM/CR、LF 末行、无空行；README 区分 synthetic fixture 与 runtime evidence | **PASS** | 本次 Ajv 8.20.0 strict：A 7/7、B 3/3 通过；BOM=false、CR=false、endsWithLF=true；`fixtures/s3-frontend-facts/README.md:14-17,33-39,144-166` |
| 9 | expected-facts/replayWindows 深比较：图节点/边、requests 行、默认窗口、fromNs 子集、render-only、A+B=10、默认 toNs=max(startNs+durNs) | **PASS**（N12/N13） | 本次脚本全部窗口 count/spanIds 匹配；`expected-facts.json` `apiExpectations`/`replayWindows`；`api.v1.md:794-816` |
| 10 | S2 API/回归保留；schema/S0–S2 fixture 字节未变；S2 门禁迁移（S1-C0、S2-4F、S2-6、S2-8、S2-9、S2-3）显式且不放宽其余断言 | **PASS**（N14） | `git diff` 冻结面为空；`s3-plan.md:225-238`；`tools/verify/verify.mjs:1478,1914,1989,3263-3281,3413-3419,3536-3537,3693-3710` |
| 11 | SDK 设计可行：原生 fetch、`/ingest` 代理、fetch/XHR 包装、`wrapFn`/`uiEffect`、ID/时间戳、批量、fail-open、无 PII | **PASS**（N1–N4） | `s3-plan.md:103-124,287-293`；`transport.v1.md:32-35`；`event-model.v1.md:356-361` |
| 12 | demo 案例 A/B 可行：案例 A 行为不变（2xx toast、刷新）、案例 B 两分支零请求、横幅、dev+preview `/ingest` 代理 | **PASS**（N2/N3） | `s3-plan.md:126-137`；`api.v1.md:831-875`；`demo/.../frontend/src/App.vue` 现状可扩展；`vite.config.ts` 现状 `/api` |
| 13 | agent 头关联可行：先 spike；JDK8 反射 `RequestContextHolder`；严格 parse；controller parent=fetch；无头=LOST；BLOCKED 不合成 EXACT；4 插桩点/flags 不变 | **PASS** | `s3-plan.md:139-153`；`dispatch.md:101-106`；`agent/.../SpanContext.java:238-273`；`SpanEmitter.java:68-126` 现状可扩展 |
| 14 | collector replay/requests 可行：读时快照、raw JSON、不消耗 seq、不缓存/不落库、7 路由、meta 5 键、graph 形状不变 | **PASS** | `s3-plan.md:155-166`；`EventStore.java:30-45`；`SessionLog.java:35-60`；`TraceDeriver.java:73-158`；`SessionsController.java:47-93` |
| 15 | workbench：S3 板为主、混合树、状态图例、案例 B 三文案、时间轴 relNs/回放、常驻只读横幅、S0/S1/S2 次级；无图库/详情/×N/S4/S5 | **PASS**（N15） | `s3-plan.md:168-195`；`api.v1.md:735-750`；`workbench/src/{App.vue,api.ts,stores/s2.ts}` 现状可扩展 |
| 16 | 测试覆盖 S3-A..S3-J：SDK 单测、demo/workbench 构建、头 E2E 有/无 traceparent、案例 A/B、replay 只读 + DB 不变/无新事件、状态语义、S2 迁移、无 S4/S5、时钟 | **PASS**（N9/N14） | `s3-plan.md:197-223`；`dispatch.md:205-220`；`tools/verify/verify.mjs` S2 门禁现状 |
| 17 | 精确命令/JDK 固定：Node 22/npm 10、Maven 3.9.5、JDK8 demo、JDK21 根/collector、端口 8601/8080/5173/5174/4173/4174、引号路径 | **PASS**（N1/N14） | `s3-plan.md:42-60,240-285`；本机实测 Node 22.22.2/npm 10.9.7、Maven 3.9.5、JDK8/JDK21 路径存在 |
| 18 | 风险：时钟优先级、epoch-ns JS 精度、proxy/preview、头传播、混合根、运行时额外 GET、案例 B 诚实性、回放 0 写 | **PASS**（N5–N11） | `s3-plan.md:91-101,295-314`；`api.v1.md:716-733`；`event-model.v1.md:369-405`；fixture README |
| 19 | 安全：无 secret/真实数据/遥测/CDN/镜像；SDK 不采 body/表单值/cookie/query；header 不写日志；localhost；错误信封不回显 body | **PASS** | `transport.v1.md:233-241`；`api.v1.md:773-782`；`s3-plan.md:103-124,295-314`；本次扫描仅策略文字命中 |
| 20 | **G1** | **PASS** | 0 阻断；16 非阻断 |

---

## 4. 逐项证据

### 4.1 范围与 S4 边界

- S3 只交付：契约/S3 fixture/s3-plan、`frontend/sdk/**` runtime SDK、demo 案例 B/SDK 接入、agent 头读取、collector requests 扩展 + replay、workbench S3 板、`tools/verify` S3 门禁（`s3-plan.md:21-40`；`dispatch.md:35-44`）。
- 明确不做：构建插件/sourcemap/源码片段/行号/局部变量/`values[]`/字段 diff（S5）；launcher/IDEA/JAR/预览注入/CDP/浏览器扩展（S4）；详情抽屉/×N/手工 `/links`/时间窗 `INFERRED`（S4/S6）；SSE/WebSocket/实时；collector 持久化/淘汰/采样/缓存/CORS/鉴权/429；Tomcat/React/cloud/MySQL/上传/沙箱；不改 schema/demo 后端/H2 seed/S0–S2 fixture（`s3-plan.md:32-40`；`api.v1.md:784-792`；`transport.v1.md:211-231`；`event-model.v1.md:363-367`）。
- 代码/文件未发现 S4/S5 越界：当前工作树只有契约注记与新增 S3 文档/fixture；`s3-plan.md` 的 SDK 只到 F0 显式 `wrapFn`（`s3-plan.md:103-124`）。
- 案例 B 是纯前端：fixture 零 fetch/零后端（`case-b/events.ndjson:1-3`）；demo 计划两个分支都零请求（`s3-plan.md:132-134`；`api.v1.md:853-875`）。

### 4.2 replay 契约

- 形状：`{"mode":"replay","readOnly":true,"sessionId","fromNs","toNs","events":[{"seq","event"}]}`，字段顺序固定（`api.v1.md:648-665`；`s3-plan.md:75-89`）。
- 参数：`fromNs` 缺省 0；`toNs` 缺省 `max(startNs+durNs)`；均匹配 `^[0-9]+$`、64 位有符号、`>=0`、`fromNs<=toNs`；非法 400；未知 session 404；非 GET 405；判定顺序 400→404→200（`api.v1.md:667-683`；`transport.v1.md:219-227`）。
- 窗口：`fromNs <= startNs <= toNs`（两端包含，只看 `startNs`）；排序 `startNs` 升序、同值 `spanId` 字典序；`seq` 原值不重编号；`events[].event` 逐字来自 ingest（`api.v1.md:679-681`）。
- 0 写：读时快照、不追加/不改写/不消耗 seq/不缓存/不落 DB/文件、不重跑/不调 demo/不发写/不 SQL/不建图；两次相同 GET 逐字一致；回放前后 sessions/events/seq 与 demo 订单不变；`mode/readOnly` 不授权写（`api.v1.md:685-691`；`transport.v1.md:221-225`）。
- meta：`capabilities` 仍 5 键，`replay=true`、`realtime=false`（`api.v1.md:762-771`；`MetaController.java:23-39` 现状可改）。
- 本评审核对：fixture 的 5 个 replayWindows（A：WA1–WA5）与 4 个（B：WB1–WB4）均按上述规则计数/排序；A+B 默认 10 条、默认 `toNs=2004000000`（`api.v1.md:794-816`）；本次脚本 9/9 窗口匹配。

### 4.3 requests / graph

- S2 字段全部保留、含义不变；新增字段追加，不重命名/去字段（`api.v1.md:705-706`）。
- `sdkActive`（会话级）= 存在 `kind="ui_event"` 且 flags 含 `SDK_ACTIVE`；`fetchCount` = 该 trace `kind="fetch"` 数；`hasFrontend` = 5 个前端 kind 任一；`hasBackend` = 6 个后端 kind 任一；`backendSpanCount` = 后端 kind 条数（`api.v1.md:707-712`）。
- 派生 confidence：root ui_event EXACT + `fetchCount=0` → EXACT；root ui_event EXACT + `controller.parentSpanId` 等于本 trace 某 `fetch.spanId` → EXACT；有 fetch 无关联 → LOST；后端游离根/无根 → LOST；未关联单个 fetch 不降级整链（`api.v1.md:716-727`）。
- 案例 B 三态：确认没发 / 无法确认 / 前端已发但后端未采集（LOST）；文案逐字（`api.v1.md:735-742`；`s3-plan.md:177-179`）。
- graph：形状/11 字段/edges/排序/400/404/405/只读全部沿用 §8.2；节点自然混合前端后端；controller parent=fetch；click 根 rootEventId=真实 clickId；不聚合、`edges.count` 恒 1（`api.v1.md:752-760`；`s3-plan.md:165`）。
- fixture 期望：A `sdkActive=true`、EXACT、spanCount 7、fetchCount 1、hasBackend true、backendSpanCount 4；B EXACT、RETURNED_FALSE、spanCount 3、fetchCount 0、hasBackend false、backendSpanCount 0（`expected-facts.json` `apiExpectations.requests`；`README.md:103-118`）；本次脚本图节点/边/requests 行全部匹配。

### 4.4 SDK 事件与头关联

- 只产生 `ui_event/js_method/fetch/render`；`callback` 只有直接包装用户回调才允许，S3 demo 不产生、不伪造（`event-model.v1.md:261-274`；`s3-plan.md:80`）。
- click 根：`nodeKey` 元素身份优先级 `#id`→`[data-tb-name]`→`tag[role]`→截断文本→DOM 路径（≤200）；`parentSpanId=null`；`status=OK`；`return=null`；flags `SDK_ACTIVE`/`S3_RUNTIME_SDK`/`OBSERVE_MS=<实际ms>`（`event-model.v1.md:278-286`；`s3-plan.md:110-112`）。
- 子事件：`js_method` `<appName>#<name>`；`fetch` `<METHOD> <pathname>`；`render` `ui_effect:<text>`；父=同步 `wrapFn` 栈顶或 click 根；`false` → RETURNED_FALSE + `{boolean:false}`；其它返回 null；异常 THREW 后原样重抛（`event-model.v1.md:281-283`；`s3-plan.md:113-117`）。
- ID/头：每次 click 新 traceId(32hex)+clickId(`click_`+16hex)+根 spanId(16hex)；每 fetch/XHR 新 spanId；`traceparent: 00-<traceId>-<fetchSpanId>-01`；`X-TraceBoard-Click: <clickId>`；仅同源非 ingest；ingest 不带（`event-model.v1.md:301-309`；`s3-plan.md:81-82`；fixture README `90-99`）。
- agent：严格正则 + 两 id 非全 0；合法则 controller `traceId/parentSpanId/rootEventId/EXACT`、无 `LOST_BACKEND`；service/mapper/sql 继承；缺失/非法/反射不可读逐字沿用 S2 LOST；stderr `header_unreadable=<n>`；不猜、不合成（`event-model.v1.md:312-323`；`s3-plan.md:143-151`；`dispatch.md:101-106`）。
- 无 PII：不采请求/响应体、表单值、cookie、查询串/hash、任意返回值、异常 message/栈、文件/行号；SDK 不写 `source`（`event-model.v1.md:288,356-361`；`s3-plan.md:123`）。
- 本次 fixture 核对：案例 A controller.parentSpanId=`2000000000000002`=fetch.spanId、rootEventId=`click_a1b2c3d4e5f60718`、全链 EXACT、无 `LOST_BACKEND`；案例 B 全链 EXACT、无 fetch/后端；7/3 行均通过 schema（`case-a/events.ndjson:2-3`；`case-b/events.ndjson:1-3`）。

### 4.5 时钟模型

- SDK `startNs = round((performance.timeOrigin + performance.now()) * 1e6)`；`durNs` 用 `performance.now()` 差值；agent `startNs = System.currentTimeMillis()*1e6 + (System.nanoTime() % 1_000_000)`；`durNs` 用 `System.nanoTime()` 差值；collector 原样；显示 `relNs = startNs − minStartNs`；API 仍发原始 epoch-ns（`s3-plan.md:91-101`；`event-model.v1.md:374-394`；`api.v1.md:637-639`）。
- 单机范围：不跨机器、不做 NTP/偏移校正；跨 emitter 关联只依赖 `traceparent`/`X-TraceBoard-Click`，不依赖时间窗（`event-model.v1.md:383-384,401-405`）。
- JS 精度：~1.76e18 的 epoch-ns 在 double 下约 256ns 分辨率，ms 级墙钟与 UI 足够；`durNs` 短区间差值不受影响；不引入 BigInt（`s3-plan.md:96,308`；`event-model.v1.md:382`）。
- schema：`startNs` 仍 `integer >=0`，字节不变；schema 内 `description` 的 “since session start” 是注解而非约束，按 `event-model.v1.md` §12.10 解释（`event-model.v1.md` 头部与 `369-405`；`s3-plan.md` D11 `330`）。
- 测试 S3-J：SDK startNs epoch 量级、controller 晚于 fetch（严格 >，≤1s 同机容差）、controller 结束 ≤ fetch 结束+1s、relNs 顺序、render 落在 click、replay 请求仍发原始值、两次 GET 一致、不断言 fixture 绝对值、不跨机器（`s3-plan.md:212-217`）。

### 4.6 fixture 校验与深比较

本次以 `tools/verify/node_modules/ajv` 8.20.0、`{strict:true,allErrors:true}` 编译冻结 schema，离线逐行校验：

```text
case-a events.ndjson: 7 valid events, BOM=false, CR=false, endsWithLF=true
case-b events.ndjson: 3 valid events, BOM=false, CR=false, endsWithLF=true
expected-facts.json x2: JSON parse OK, BOM=false, CR=false, endsWithLF=true
```

深比较脚本结果：

- 案例 A：1 个 traceId、1 个 root（ui_event）、7 个 EXACT、7 个 OK；父链 6/6 存在；区间包含 6/6；`startNs` 非降序；root `durNs=38000000` = 最后事件结束 1038000000 − 起点 1000000000；render 起点 1035000000 > fetch 结束 1034000000；SQL `rowsAffected=0`/`transaction=UNKNOWN`；HTTP fetch/controller 200；service true；mapper 0。
- 案例 B：1 个 traceId、1 个 root（ui_event）、3 个事件；validateForm 父=click、render 父=validateForm；区间嵌套 2/2；`RETURNED_FALSE` 1 个、return false；零 fetch/零后端；root durNs 4000000=2004000000−2000000000；全 EXACT。
- 图：A 节点顺序/kindOrder/6 条边与 expected 完全一致；B 3 节点/2 条边一致；`edges.count` 恒 1。
- replayWindows：A 的 WA1–WA5、B 的 WB1–WB4 计数与 spanIds 全部匹配；A 默认 1038000000/7 条、B 默认 2004000000/3 条；A+B 默认 2004000000/10 条；`seq` 仅在 fresh session 下成立，README/expected 已注明。
- 编码：两 NDJSON 无 BOM/CR、末行 `\n`、无空行；expected JSON 可解析、无 BOM/CR。

README 明确区分：fixture 是“契约形状，不是运行时证据”；案例 A 的真实 EXACT 必须由浏览器 SDK 的 `traceparent`/`X-TraceBoard-Click` + JDK8 javaagent 运行产生；案例 B 的“确认没发”必须由浏览器运行时 click 根在观察窗关闭后仍 `fetchCount=0` 证明；禁止用 fixture 冒充运行时结论（`fixtures/s3-frontend-facts/README.md:14-17,29,88,166`）。

### 4.7 计划可行性

- **SDK**：独立 TS 包、原生 fetch 捕获、`/ingest` 代理、fetch/XHR 包装、`wrapFn`/`uiEffect`、批量 NDJSON、fail-open、无 PII（`s3-plan.md:103-124`）；`transport.v1.md:32-35` 明确“不采集 ingest 自身请求”。
- **demo**：`main.ts` 初始化 `s_s3demo`/`OrderEdit.vue`；案例 A 保留 `fetch('/api/orders/1/cancel')`、2xx toast、`loadOrders()`、同位置 `uiEffect('操作成功')`，不额外包装 `cancelOrder`、不手工加头；案例 B `#amount-b`/`#btn-save-b`、`validateForm` wrapFn、错误/成功分支零 fetch；`/ingest` dev+preview 代理；横幅如实（`s3-plan.md:126-137`；`api.v1.md:853-875`）。
- **agent**：先 spike（JDK8 demo + 带头/无头 curl），反射链、严格 parse、Frame confidence、4 插桩点/flags/jar major 52/shaded/Premain/fail-open 不变；失败 BLOCKED，不合成 EXACT（`s3-plan.md:139-153`；`agent/.../SpanContext.java:238-273`；`SpanEmitter.java:68-126`）。
- **collector**：requests 读时派生、replay 快照/raw JSON/排序/400/404/405/0 写、meta 5 键、graph 形状不变、7 路由（`s3-plan.md:155-166`；`EventStore.java`、`SessionLog.java`、`TraceDeriver.java`、`SessionsController.java` 现状可扩展）。
- **workbench**：S3 板为主、混合树、状态图例、案例 B 三文案、时间轴 relNs/回放、常驻只读横幅、S0/S1/S2 折叠；稳定选择器 10 个；无图库/详情/×N（`s3-plan.md:168-195`）。
- **测试**：S3-A..S3-J + S2 迁移；浏览器证据由 orchestrator 提供、tester 不断言截图；案例 B 运行时 capture 不得用 fixture 冒充（`s3-plan.md:197-238`）。
- **命令/JDK**：本机实测 Node 22.22.2/npm 10.9.7、Maven 3.9.5、JDK8=`C:/Program Files/Java/jdk1.8.0_221`、JDK21=`C:/Program Files/Java/jdk-21`；计划路径与端口一致（`s3-plan.md:42-60,240-285`）。SDK 新包 `npm ci` 需要首次生成 lockfile（N1）。

### 4.8 S2 回归与门禁迁移

- 契约 diff 只追加 S3 章节/注记；S2 的 §8.1/§8.2 字段/排序/错误码未改写；§8.1 `startedAtNs` 仅补“S3 起 epoch-ns”说明；S2 矩阵保留为历史（`api.v1.md:75-93,443-629`）。
- 冻结面：schema/S0/S1/S2 fixture/demo 后端/agent/collector/workbench 当前工作树无 diff；schema 与 S0–S2 fixture hash 与 S2 基线一致（§2）。
- S2 门禁迁移：`S1-C0` replay true（5 键）；`S2-4F` replay 200 + S3 断言，stream/ws/links 仍 404；`S2-3` 无头 `s_s2agent` 4-span LOST 保留；`S2-6`/`S2-8` 允许 S3 SDK/头/时间轴/replay，仍禁 S4/S5；`S2-9` 改为 S3 白名单，删除“无 SDK/collector 调用”与 template-only 断言，保留案例 A 横幅事实（`s3-plan.md:225-238`；`tools/verify/verify.mjs` 对应门禁）。
- 迁移未放宽其余断言：S2 的 0 行事实、未知 id 404、无头 LOST、requests S2 字段/LOST、graph 4 节点 3 边、fail-open、无持久化、meta 5 键仍保留（`s3-plan.md:236-238`）。

### 4.9 风险与验收诚实性

| 风险 | 计划处理 | 评审 |
|---|---|---|
| 时钟优先级 vs schema description/dispatch D11 | D11 + event-model §12.10 + api 头部；schema description 注解不改 | 通过（N11；需在 dispatch/acceptance 记录 D11 优先） |
| epoch-ns JS 精度 | 256ns 分辨率；`durNs` 短差值；不引入 BigInt | 通过（S3-J；无 blocker） |
| proxy/preview | demo `/ingest` dev+preview；workbench 预览无代理但空态不崩 | 通过（N3/N15） |
| 头传播 | 反射 + spike + 严格 parse + 无头 LOST + BLOCKED | 通过（D9；不合成 EXACT） |
| 混合根/置信度误导 | requests 派生规则 + 未关联 fetch 不降级 + S2 LOST 保留 + UI 标游离 | 通过（N6） |
| 运行时额外 GET | fixture 取最小链；S3-F 断言 fetchCount≥1 并定位 POST；未关联 GET 不降级 | 通过（`api.v1.md:728`；README `68`） |
| 案例 B 确认诚实性 | 三条件 + 三文案 + 观察窗关闭 + runtime capture handoff；fixture 不冒充 | 通过（N5/N7/N9/N10/N13） |
| 回放 0 写证明 | replay 只读快照 + GET；前后 events/seq/订单；0 新事件 | 通过（N8；订单 CREATED 是弱证据，需以无新事件为主） |

### 4.10 安全

- 无 secret/真实客户数据；无遥测/CDN/在线字体/第三方镜像；依赖走 Maven Central/npm 官方源（`s3-plan.md:3,44-47`；`dispatch.md:9-15`）。
- SDK 只采控件身份、URL pathname、HTTP 状态码、显式 `uiEffect` 文本；不采 body/表单值/cookie/query/hash/任意返回值/异常栈；header 不写日志/事件（`transport.v1.md:239-241`；`event-model.v1.md:288,310,356-361`；`s3-plan.md:123`）。
- collector 只绑 `127.0.0.1:8601`；无 CORS/鉴权/429；错误信封 `{error,message,apiVersion}` 不回显请求 body/凭据（`transport.v1.md:235-241`；`api.v1.md:782`；`ApiError.java` 现状）。
- 本次扫描 `fixtures/s3-frontend-facts/**`、S3 文档/契约：未发现 secret/真实数据/遥测/CDN；`http://localhost:8080` 与 `127.0.0.1` 仅本机地址。
- 无 S4/S5 能力；无图库/详情/×N/SSE/WS/持久化/绝对 URL（`s3-plan.md:32-40,168-195`；`api.v1.md:784-792`）。

---

## 5. 阻断问题

**无。** 未发现会阻止 G1 冻结、使 S3 验收信号不可达、或必须改 schema/越界 S4/S5 才能实现的问题。

---

## 6. 非阻断建议（不阻止冻结；owner 在实现/测试说明中落实）

| ID | 事项 | 证据 | 精确修正 |
|---|---|---|---|
| N1 | `frontend/sdk` 为新包，计划命令 `(cd "frontend/sdk" && npm ci ...)` 需要已提交的 `package-lock.json`；当前 `frontend/` 目录尚不存在，S3-A 首次执行会因无 lockfile 失败。同时 `npm test` 的 TS 运行方式/`test` script 未写明 | `s3-plan.md:245`；`frontend/` 不存在 | 在 coder-sdk 输出中加入 `frontend/sdk/package-lock.json`（首次 `npm install` 生成后提交），并在 `package.json` 增加 `test` script（如 `node --test` 运行构建后的 `dist/**/*.test.mjs`，或声明 `tsx` 运行 TS 测试）；verify 在 lockfile 存在后继续用 `npm ci` |
| N2 | demo 的 `tsconfig.json` 无 `baseUrl`/`paths`；`npm run build` 先跑 `vue-tsc --noEmit`，仅靠 Vite alias 导入 `@traceboard/sdk` 会在类型检查阶段失败 | `demo/.../frontend/tsconfig.json:1-20`；`package.json` build script | 在 `tsconfig.json` 增加 `baseUrl` + `paths: {"@traceboard/sdk": ["../../../frontend/sdk/src/index.ts"]}`（或改为相对路径导入）；把该文件加入 coder-sdk 允许清单与 S2-9 S3 白名单 |
| N3 | Vite dev 的 `server.fs.allow` 默认是 workspace root；demo 前端 root 在 `demo/.../frontend`，SDK 源码在仓库根 `frontend/sdk`，dev 下 `/@fs/.../frontend/sdk/src/index.ts` 会被 403 拒绝，浏览器 E2E 无法加载 SDK | Vite 6 配置默认 `allow: [searchForWorkspaceRoot(root)]`；`demo/.../frontend/vite.config.ts` 无 `server.fs.allow` | 在 demo `vite.config.ts` 增加 `server.fs.allow`（至少包含 SDK 目录，如 `["..","../../../frontend/sdk"]` 或 `searchForWorkspaceRoot` 的扩展），并在 S3-B 增加“dev 页面加载无 403”的 smoke 断言；preview 用 dist，不受影响 |
| N4 | 计划/transport 说“不采集 ingest 自身请求”，但 S3-A 的表述“SDK 自身 ingest 上报除外”可能被实现为“允许记录 ingest fetch”；若 flush 发生在 click 窗口内，案例 B 的 `fetchCount` 会被污染，直接破坏“确认没发” | `transport.v1.md:32-35,239-241`；`s3-plan.md:121-122,203`；`case-b` 期望 fetchCount=0 | 在 SDK 设计/测试中明确：对 `ingestUrl`（含 `${ingestUrl}/v1/events`）既不添加 `traceparent`/`X-TraceBoard-Click`，也不创建 `fetch` 事件；S3-A 增加断言“事件中不存在 nodeKey 以 `POST /ingest` 开头的 fetch”；案例 B 的 S3-F 断言 `fetchCount=0` |
| N5 | 观察窗 1500ms 关闭时，窗口内已发起但尚未 settle 的 fetch 会被丢弃；此时 `fetchCount=0`，工作台可能显示“已确认没发”，但请求实际已发出——与“确认没发 vs 未采集”的核心区分冲突 | `s3-plan.md:111-114`；`event-model.v1.md:293-297`；`api.v1.md:735-742` | 二选一并在契约/测试固定：①关闭前若存在窗口内 pending fetch，保持 operation 打开到 settle（记录实际 `OBSERVE_MS`）；②关闭时仍记录该 fetch 节点（如 `status=UNKNOWN`/`THREW`，或 flag `PENDING_REQUEST`/`NOT_SETTLED`），且“确认没发”条件必须要求 pending=0。增加一个 stub 测试：窗口内发起慢 fetch，观察窗关闭后不得显示“已确认” |
| N6 | requests 派生 confidence 第一条 `root ui_event EXACT + fetchCount=0 -> EXACT` 缺 `hasBackend=false`；若 fetch 事件丢失但后端 controller/service/mapper/sql 已入库（`fetchCount=0`、`hasBackend=true`），会错误显示 EXACT，而不是 LOST | `api.v1.md:720`；`s3-plan.md:158`；`case-b` 判定另要求 `hasBackend=false` | 将第一条改为“root ui_event EXACT + `fetchCount=0` + `hasBackend=false` → EXACT”；`fetchCount=0 && hasBackend=true` → LOST（或按根 confidence 但不得 EXACT）；同步 api §9.2、s3-plan §9、S3-F 断言；fixture 字节不变 |
| N7 | 案例 B “已确认”条件只要求根为 `ui_event`，未要求根 `confidence=EXACT`；异常/手工数据的 ui_event 根（LOST）在 `fetchCount=0`/`hasBackend=false` 时仍可能显示“已确认” | `api.v1.md:739`；`s3-plan.md:177-179` | 在 api §9.3 与工作台条件中加入“根 `confidence=EXACT`”；S3-G/ S3-J 增加一条静态/运行断言；fixture 不变 |
| N8 | 回放 0 写证明把“demo 订单仍 CREATED”作为证据，但案例 A 的 UPDATE 是 `WHERE status='PAID'` 的 0 行缺陷；即使 replay 真的调用了 demo，订单状态也不会变，这个证据不能证明“0 SQL 写” | `api.v1.md:689`；`transport.v1.md:224`；`s3-plan.md:277-281`；`fixtures/s2-zero-row-chain` 的 0 行语义 | 以“回放前后 events/seq 集合与条数完全一致、traceId/spanId 集合一致、回放期间无新 demo 请求/agent span”为主证明（可在 demo 侧开启访问日志或比较 collector 事件数/集合）；订单 CREATED 仅作辅助；S3-E 写明“订单状态不是 0 写证据” |
| N9 | S3-D 要断言“无头/非法头 → `s_s2agent` 4-span LOST”，但 §13 只启动一个 demo（`-Dtraceboard.sessionId=s_s3demo`，8080）；没有第二个 agent 进程/端口的命令，`s_s2agent` 断言无法在同一轮执行 | `s3-plan.md:206,257-263`；`dispatch.md:106` | 明确 S3-D 的无头/非法头回归在 `s_s3demo` 内断言 4-span LOST（sessionId 为 s_s3demo），`s_s2agent` 的逐字回归交给保留的 S2-3 门禁；或增加第二个 demo JVM/端口并写命令；不要假设同一 8080 进程能同时产生两个 session |
| N10 | dispatch §1 item 1 与 §5.3 要求 `saveB`/`validateForm` 均出现/均经 `wrapFn`；s3-plan D2、README §1.1 与 3 行 fixture 只有 `validateForm`，`saveB` 仅作为 click 根 `#btn-save-b` 出现 | `dispatch.md:26,181`；`s3-plan.md:321`；`fixtures/s3-frontend-facts/README.md:22-29`；`case-b/events.ndjson:1-3` | 由 dispatcher 在 G1 前后补一条明确说明：3 行形状为权威（click 根 `#btn-save-b` 即 saveB 身份，validateForm 为唯一包装函数）；或改为同时包装 saveB 并补第 4 行 `js_method(OrderEdit.vue#saveB, OK)`、更新 expected-facts/README/S3-F 断言。二选一，不由 coder 自行猜 |
| N11 | 时钟 D11 把 `startNs` 从 dispatch §4.1 的“相对 SDK init”改为本机 epoch-ns；schema 内 `description` 仍写 “Monotonic nanoseconds since the session start”。虽然 schema 约束仍是 `integer>=0`，但三处文字优先级需明确，否则 coder 可能按 dispatch/schema 实现相对值，混图/回放窗口错 | `dispatch.md:87`；`schema/traceboard.event.v1.json` `startNs.description`；`s3-plan.md:91-101,330`；`event-model.v1.md:14-16,369-405` | 在 dispatch 增加 S3 时钟修订（或 S3 amendment 文件），明确“S3 以 s3-plan §5.1/event-model §12.10 的 epoch-ns 为准；schema description 为非规范性注解，schema 字节不变”；acceptance/progress 引用该修订；不要求改 schema |
| N12 | 案例 A `expected-facts.json` 的 `globalAssertions.parentChain` 包含 `7000000000000007(render)`，但 render 的父是 click 根 `1000000000000001`（`parentBySpanId` 已正确）；若 tester 把 `parentChain` 当逐级父链做深比较会误判 | `case-a/expected-facts.json:36-44,54-62`；`case-b` 的 parentChain 是真链 | 将 `parentChain` 改名为 `spanOrder`/`nodeOrder`，或拆成 `parentChain`（click→fetch→controller→service→mapper→sql）与 `renderParentSpanId`；在 expected 注记“render 挂 click 根”；不改 `events.ndjson` 字节 |
| N13 | 案例 B `caseBVerdict.observeWindowClosed: true` 与 README “fixture 只提供形状，不证明观察窗真的关闭过”并列，易被误读为 fixture 已证明窗口关闭 | `case-b/expected-facts.json:200-207`；`fixtures/s3-frontend-facts/README.md:88` | 改名为 `observeWindowFlagPresent: true`（或增加 `runtimeProof: false`/`fixtureOnly: true`），并在 README/expected 注记“OBSERVE_MS 仅表示字段存在，运行时关闭由浏览器证据证明”；不改字节 |
| N14 | 测试/命令卫生：①`s3-plan.md` §3 冻结哈希清单未含 `dispatch.md`，而 dispatch §5.2 要求 G1 基线含 dispatch；②S2-9 的 demo frontend 冻结逻辑仍只允许 `src/App.vue` 精确文件，S3 白名单需扩到 `frontend/sdk/**`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/**` 与 demo 前端预期文件（含 `tsconfig.json`、必要时新增 `src/*.vue`），否则 coder-sdk 一改就红；③S3-D 的非法头用例建议显式列 `X-TraceBoard-Click` 缺失/格式错/全 0 traceparent 三种，并断言 stderr 只计数不回显头原文 | `s3-plan.md:50-60`；`dispatch.md:264`；`tools/verify/verify.mjs:3693-3710`；`s3-plan.md:206` | ①把 `docs/plans/stages/S3/dispatch.md` 加入 §3 `sha256sum`；②在 S2-9 迁移中写死 S3 白名单并保留 schema/S0–S2 fixture 的 forbidden；③S3-D 增加三种非法头/无头用例与 `header_unreadable` 日志断言（不打印头值） |
| N15 | 时间轴/UI 边界：①`/replay` 是会话级，工作台若选中单 trace（A）但会话含 B，窗口事件可能混入其他 trace；②滑块按 `startNs` 过滤，长 span 在“开始但未结束”时会显示为已发生；`OBSERVE_MS` 提前关闭（pagehide）时仍显示“已确认”可能被理解为完整 1.5s | `s3-plan.md:180-182`；`api.v1.md:679`；`api.v1.md:739` | ①工作台对单 trace 视图按 `traceId` 过滤 replay events，或明确标注“会话窗口”；②节点在滑块时间早于 `startNs+durNs` 时标“进行中/未结束”，不显示为完成；③若 click 根 `OBSERVE_MS < 1500`，在案例 B 区显示实际毫秒并加“观察窗提前关闭”限定，不声称完整 1.5s；S3-C/S3-J 增加相应 dist/行为断言 |
| N16 | SDK `durNs` 定义为 `performance.now()` 差值 ×1e6，但未写 `Math.round`；`performance.now()` 为小数毫秒，乘 1e6 后可能得到非整数（如 `32123000.000000004`），而 schema `durNs` 要求 `integer`，SDK 自身事件会被冻结 schema 拒绝 | `s3-plan.md:106,114`；`event-model.v1.md:43,273,378`；`schema/traceboard.event.v1.json` `durNs.type=integer`；`case-a/events.ndjson` 全整数 | 在 s3-plan §6、event-model §12.1/§12.10 明确“`durNs = Math.round((performance.now() end − start) * 1e6)`；click 根 `durNs = Math.max(0, Math.round(lastEventEnd − clickStart))`”；S3-A 增加“SDK 自产事件逐行过 schema（含 durNs 为整数）”的断言；不改 schema |

> N1–N16 均为文档、任务卡、测试断言或实现细节层；不改变 schema、S3 fixture 字节、契约字段/枚举/形状，也不改变 S3 验收信号。N4/N5/N6/N7/N8/N9/N10/N11/N16 建议在 coder 开工说明与 tester 计划中显式落实。

---

## 7. G1 冻结与交接

1. **G1 PASS 生效**：`docs/contracts/{api,transport,event-model}.v1.md`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/s3-plan.md`、`docs/plans/stages/S3/dispatch.md` 以 §2 哈希冻结；此后修改字段/形状/排序/错误码必须停回本流程（`dispatch.md:264`；`s3-plan.md:332-339`）。
2. **S3 验收信号**：案例 B 确认没发（`sdkActive=true` + 根 ui_event + `fetchCount=0` + `hasBackend=false` + `OBSERVE_MS` + 根 EXACT）；案例 A 浏览器点击 → SDK fetch → agent 4 span → controller parent=fetch → 全链 EXACT；0 行事实不变；replay 窗口/排序/两次一致/前后 events/seq/订单不变/0 新事件；状态语义颜色+文字；S2 回归迁移后全绿。
3. **实现顺序**：G1 后 coder-sdk 先做 `frontend/sdk` 独立构建+单测，再接 demo；coder-agent 先 spike 头读取；coder-collector/coder-frontend 可并行；tester 一次命令 S3-A..S3-J；acceptance 重跑并 tag `s3-baseline`（`s3-plan.md:287-293`）。
4. **不阻断但需落实**：N1–N16 由对应 owner 在实现/测试说明中落实；其中 N5–N8、N10/N11、N16 直接影响“确认没发/EXACT/0 写/事件可入库”的诚实性与可运行性，建议在 coder 开工前写进任务卡或 test-report 的口径。
5. **S4 边界**：S3 到此停止；不得开始 S4（launcher/IDEA/JAR/详情/×N），不得改 schema、S0–S2 fixture、demo 后端；S3 通过也不得宣称产品完成（`dispatch.md:292-300`；`s3-plan.md:332-339`）。
6. 本评审只写本文件；§2 哈希是 G2 漂移检查的基线。
