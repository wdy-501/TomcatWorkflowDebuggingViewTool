# s3-frontend-facts — 前端事实（EXACT 关联 / 纯前端零请求）契约样例

> 阶段：S3（MVP，frontend facts + read-only replay）｜契约样例，不是采集产物｜权威 schema：`schema/traceboard.event.v1.json`（v1 冻结，本目录不改 schema）
> 上游：`docs/plans/stages/S3/dispatch.md` §4.1–§4.8、`docs/plans/stages/S3/s3-plan.md`
> 关联契约：`docs/contracts/api.v1.md` §2.3/§9/附录 C、`docs/contracts/event-model.v1.md` §12、`docs/contracts/transport.v1.md` §6.4

## 1. 两个案例是什么、不是什么

| 目录 | 内容 | 谁产生 |
|---|---|---|
| `case-a-joined-chain/` | 7 行同 trace 事件：`ui_event(#btn-cancel) → fetch(POST /api/orders/1/cancel,200) → controller(parent=fetch span,200) → service(true) → mapper(0) → sql(rows 0/UNKNOWN) → render(操作成功)`，全 `EXACT` | SDK + agent 真实链的**契约形状**（手写固定取值，供确定性测试） |
| `case-b-frontend-only/` | 3 行同 trace 事件：`ui_event(#btn-save-b) → js_method(OrderEdit.vue#validateForm, RETURNED_FALSE) → render(金额必须大于 0)`，零 fetch、零后端，全 `EXACT` | SDK 真实链的**契约形状**（手写固定取值，供确定性测试） |

- **是**：两案例都逐行通过冻结 schema；用于 S3 离线门禁、`requests`/`graph`/`replay` 派生断言与区间/父链不变量检查。
- **不是**：不是运行时证据。S3 的“真实 EXACT 关联”必须由浏览器 SDK 发出的 `traceparent`/`X-TraceBoard-Click` + JDK8 demo 的 javaagent 在运行中产生（dispatch §1 item 2）；
  S3 的“已确认没发请求”必须由浏览器运行时产生 click 根并在观察窗关闭后仍为 `fetchCount=0`（dispatch §0.5/§1 item 1）。
  **禁止**把本目录当作“demo 已确认关联 / 已确认没发”的替代，也**禁止**用 fixture 伪造运行时结论。
- 本目录是新增目录，不改 S0 `fixtures/case-a-zero-rows/**`、S1 `fixtures/s1-walking-skeleton/**`、S2 `fixtures/s2-zero-row-chain/**`；schema 字节不变。

### 1.1 与 dispatch §4.7 行数的差异（有意收敛）

dispatch §4.7 的草图写“case A 6 行（click→fetch→controller→service→mapper→sql）”“case B 4 行（click→saveB→validateForm + render）”。本目录按 plan-writer 任务卡的**精确事件清单**落盘：

| 项 | dispatch 草图 | 本 fixture | 理由 |
|---|---|---|---|
| case A | 6 行，无 render | **7 行，含 `render(操作成功)`** | 运行时案例 A 在 2xx toast 同位置调用 `uiEffect('操作成功')`，`render` 是真实 SDK 事件；不含它会让 fixture 与运行时形状不一致 |
| case B | 4 行，含 `saveB` | **3 行，`validateForm` 直接被 `wrapFn` 包裹** | demo 只包装 `validateForm`；`saveB` 只是普通点击处理器。若实现选择同时包装 `saveB`，运行时会多一个 `js_method`（`OK`），`fetchCount` 仍为 0；fixture 取最小确定形状 |

两处都不改变 S3 验收信号（EXACT 关联、HTTP 200、SQL 0、`RETURNED_FALSE`、零 fetch、DOM 效果）。

### 1.2 时间字段口径（示意值 vs 运行时 epoch-ns）

- 下表 `startNs`/`durNs` 的 `1000000000`/`2000000000` 等是为可读性选取的**示意值**（fixture 作用域），**不是**绝对 epoch-ns，也不要求与运行时相等。
- S3 运行时口径（同一台机器，详见 `docs/contracts/event-model.v1.md` §12.10）：
  - SDK：`startNs = round((performance.timeOrigin + performance.now()) * 1e6)`（epoch-ns），`durNs` 用 `performance.now()` 差值；
  - agent：`startNs = System.currentTimeMillis()*1e6 + (System.nanoTime() % 1e6)`，`durNs` 用 `System.nanoTime()` 差值。
- 断言只依赖**相对顺序、区间包含、时长关系**与 `expected-facts.json` 的 fixture 内取值；不得把本目录数值当作运行时 epoch-ns，
  也不得用于跨机器/跨进程时钟对齐（V1 仅单机，无时钟同步）。
- `expected-facts.json` 的 `startedAtNs` 与 `replayWindows.fromNs/toNs` 同样是 fixture 作用域；显示端用 `relNs = startNs − minStartNs` 归一化，API 参数仍为原始值。schema 字节不变。

## 2. 固定标识与链路

### 2.1 case A（`s_s3demo`）

| 项 | 值 |
|---|---|
| `sessionId` | `s_s3demo` |
| `traceId` | `1f2e3d4c5b6a79880a1b2c3d4e5f6071` |
| `rootEventId` / clickId | `click_a1b2c3d4e5f60718` |
| `traceparent`（SDK → 后端） | `00-1f2e3d4c5b6a79880a1b2c3d4e5f6071-2000000000000002-01` |
| `X-TraceBoard-Click` | `click_a1b2c3d4e5f60718`（必须等于该 click 的 `rootEventId`） |
| `thread`（前端） | `{"id":0,"name":"browser-main"}` |
| `thread`（后端） | `{"id":44,"name":"http-nio-8080-exec-1"}` |

| # | kind | spanId | parentSpanId | nodeKey | startNs | durNs | status | return | flags |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ui_event` | `1000000000000001` | `null`（click 根） | `#btn-cancel` | 1000000000 | 38000000 | OK | `null` | `["SDK_ACTIVE","S3_RUNTIME_SDK","OBSERVE_MS=1500"]` |
| 2 | `fetch` | `2000000000000002` | `1000000000000001` | `POST /api/orders/1/cancel` | 1002000000 | 32000000 | OK | `{"type":"http","value":200}` | `["SDK_ACTIVE"]` |
| 3 | `controller` | `3000000000000003` | `2000000000000002` | `com.example.shop.controller.OrderController#cancel` | 1005000000 | 28000000 | OK | `{"type":"org.springframework.http.ResponseEntity","value":200}` | `["S2_ZERO_ROW_CHAIN"]` |
| 4 | `service` | `4000000000000004` | `3000000000000003` | `com.example.shop.service.OrderService#cancel` | 1006000000 | 25000000 | OK | `{"type":"boolean","value":true}` | `["S2_ZERO_ROW_CHAIN"]` |
| 5 | `mapper` | `5000000000000005` | `4000000000000004` | `com.example.shop.mapper.OrderMapper#cancelById` | 1007000000 | 22000000 | OK | `{"type":"int","value":0}` | `["S2_ZERO_ROW_CHAIN"]` |
| 6 | `sql` | `6000000000000006` | `5000000000000005` | `OrderMapper.cancelById` | 1008000000 | 20000000 | OK | `null`（`sideEffects[0].rowsAffected=0`、`transaction="UNKNOWN"`） | `["S2_ZERO_ROW_CHAIN"]` |
| 7 | `render` | `7000000000000007` | `1000000000000001` | `ui_effect:操作成功` | 1035000000 | 3000000 | OK | `{"type":"ui_effect","value":"操作成功"}` | `["SDK_ACTIVE"]` |

- **父链**：click → fetch → controller → service → mapper → sql；render 的父是 click 根（异步续体不传播包装器，回落 click 根），在 fetch 结束（1034000000）后启动，但仍在 click 根区间 `[1000000000, 1038000000]` 内。
- **区间**：click ⊃ fetch ⊃ controller ⊃ service ⊃ mapper ⊃ sql；render 落在 click 内。click `durNs` = 窗口内最后一个因果事件结束 − click 开始 = `1038000000 − 1000000000`。
- **EXACT 关联**：controller 的 `parentSpanId` 必须等于 fetch 的 `spanId`；controller 的 `rootEventId` 必须等于 clickId；`LOST_BACKEND` **不出现**（它不是游离后端根）；service/mapper/sql 继承同一 trace/root/EXACT。
- **运行时补充**：案例 A 成功后 demo 会 `loadOrders()` 刷新列表，浏览器 SDK 通常会在同一 click 窗口内再采集一个 `GET /api/orders` fetch。该 fetch 没有后端 controller 关联，只在该节点标“后端未采集”，**不把整条 EXACT 链降级**（api §9.2）；因此运行时 `fetchCount` 可能是 2，fixture 取 1 只为最小链。断言时必须定位 `POST /api/orders/1/cancel` 的 fetch，而不是假设只有一条 fetch。

### 2.2 case B（`s_s3demo`）

| 项 | 值 |
|---|---|
| `sessionId` | `s_s3demo` |
| `traceId` | `3a4b5c6d7e8f90a1b2c3d4e5f6071829` |
| `rootEventId` / clickId | `click_c3d4e5f60718293a` |
| `traceparent` | **无**（零 fetch，不发请求，也就没有后端头） |
| `thread` | `{"id":0,"name":"browser-main"}` |

| # | kind | spanId | parentSpanId | nodeKey | startNs | durNs | status | return | flags |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ui_event` | `8000000000000008` | `null`（click 根） | `#btn-save-b` | 2000000000 | 4000000 | OK | `null` | `["SDK_ACTIVE","S3_RUNTIME_SDK","OBSERVE_MS=1500"]` |
| 2 | `js_method` | `9000000000000009` | `8000000000000008` | `OrderEdit.vue#validateForm` | 2001000000 | 3000000 | RETURNED_FALSE | `{"type":"boolean","value":false}` | `["SDK_ACTIVE"]` |
| 3 | `render` | `a00000000000000a` | `9000000000000009` | `ui_effect:金额必须大于 0` | 2002000000 | 1000000 | OK | `{"type":"ui_effect","value":"金额必须大于 0"}` | `["SDK_ACTIVE"]` |

- 零 `fetch`、零 `controller/service/mapper/sql/jdbc/async`；`fetchCount=0`、`hasBackend=false`、`backendSpanCount=0`。
- `RETURNED_FALSE` 是“正常返回 false”，不是异常；`render` 是显式 `uiEffect` 的 DOM 效果事实，不是像素回放。
- 判定文案（工作台逐字）：`已确认：本次点击因果链内没有网络请求`。前提是 `sdkActive=true`、该 trace 根为 `ui_event`、`fetchCount=0`、`hasBackend=false`，且 click 根在观察窗（`OBSERVE_MS=1500`）关闭后才入库。fixture 只提供形状，**不证明**观察窗真的关闭过。

## 3. 头与关联语义（traceparent / X-TraceBoard-Click）

1. 每次点击新 `traceId`（32 hex）+ `clickId`（`click_` + 16 hex）；`rootEventId` = clickId。
2. 每个 fetch/XHR 新 `spanId`（16 hex）；`traceparent: 00-<traceId>-<fetchSpanId>-01`，即 parent-id **必须是该 fetch 自己的 spanId**。
3. `X-TraceBoard-Click: <clickId>`，仅同源（相对路径）且非 ingest 请求携带；跨域请求原样放行、不加头。
4. ingest 上报（`POST /ingest/v1/events`）**不携带** traceparent/click 头，避免自采集递归。
5. agent 严格解析：`traceparent` 匹配 `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$` 且两 id 非全 0；`X-TraceBoard-Click` 匹配 `^click_[A-Za-z0-9_-]{8,}$`。
   两者都合法 → controller `traceId=<头 traceId>`、`parentSpanId=<头 parent-id>`、`rootEventId=<clickId>`、`confidence=EXACT`、无 `LOST_BACKEND`；service/mapper/sql 继承 EXACT 与链。
6. 头缺失/非法/反射不可读 → **完全沿用 S2**：随机 traceId、`click_lost_<根spanId>`、`confidence=LOST`、根带 `LOST_BACKEND`，stderr 计数 `header_unreadable=<n>`；不猜、不合成 EXACT。
7. **curl 单测的边界**：只发 `traceparent` + `X-TraceBoard-Click` 的 curl 链路没有 click/fetch 事件，controller 有父但 trace 无根 → `requests` 按 S2 规则显示无根/`LOST`（事件级 controller 仍是 `EXACT`）。要断言 `requests.confidence=EXACT`，必须先有该 click 的 `ui_event` 根与对应 `fetch`（浏览器运行时，或测试时先注入本 fixture 的 click+fetch 前缀）。

## 4. 期望的只读 API 视图

### 4.1 `GET /api/v1/sessions/s_s3demo/requests`（S3 扩展）

```json
{"sessionId":"s_s3demo","sdkActive":true,"requests":[
 {"traceId":"1f2e3d4c5b6a79880a1b2c3d4e5f6071","rootSpanId":"1000000000000001","rootKind":"ui_event",
  "nodeKey":"#btn-cancel","status":"OK","confidence":"EXACT","spanCount":7,"startedAtNs":1000000000,
  "durNs":38000000,"hasError":false,"fetchCount":1,"hasFrontend":true,"hasBackend":true,"backendSpanCount":4},
 {"traceId":"3a4b5c6d7e8f90a1b2c3d4e5f6071829","rootSpanId":"8000000000000008","rootKind":"ui_event",
  "nodeKey":"#btn-save-b","status":"RETURNED_FALSE","confidence":"EXACT","spanCount":3,"startedAtNs":2000000000,
  "durNs":4000000,"hasError":false,"fetchCount":0,"hasFrontend":true,"hasBackend":false,"backendSpanCount":0}]}
```

- 两案例若同处一个 collector 的 `s_s3demo`，请求按 `startedAtNs` 升序：A（1.0s）在前、B（2.0s）在后。
- `sdkActive` 是**会话级**：会话内存在带 `SDK_ACTIVE` flag 的 `ui_event` 即为 `true`（A/B 都有 click 根）。
- `confidence` 派生：A 的 `controller.parentSpanId` 等于 fetch span → `EXACT`；B `fetchCount=0` → `EXACT`。
- 运行时 A 若含刷新 GET，`fetchCount` ≥1、`spanCount` ≥8；上述 7/1 是 fixture 值。

### 4.2 `GET /api/v1/sessions/s_s3demo/graph?traceId=<32hex>`（S3 混合图）

```text
case A: nodes 按 startNs = click, fetch, controller, service, mapper, sql, render
        edges = click→fetch, click→render, fetch→controller, controller→service,
                service→mapper, mapper→sql          （count 恒 1）
case B: nodes = click, js_method, render
        edges = click→validateForm, validateForm→render
```

- graph 形状不变（每节点 11 字段、`edges[{from,to,count}]`）；**没有**新增 S3 字段，**不做** ×N 聚合。
- `rootEventId` 是真实 clickId；根 `confidence=EXACT`；controller 的 `parentSpanId` 指向 fetch span（跨进程显式连接）。

### 4.3 `GET /api/v1/sessions/s_s3demo/replay?fromNs=&toNs=`（S3 新增，只读）

- 精确形状：`{"mode":"replay","readOnly":true,"sessionId":"s_s3demo","fromNs":<int>,"toNs":<int>,"events":[{"seq":<int>,"event":{<event-v1>}}]}`。
- `fromNs`/`toNs` 是**原始 epoch-ns**（S3 单机）；本 README/`expected-facts.json` 中的秒级数值仅为本 fixture 作用域，运行时请用 `requests`/`replay` 实际返回值。
- `fromNs` 缺省 0；`toNs` 缺省 = 会话内 `max(startNs+durNs)`（case A = 1038000000；case B = 2004000000；A+B 同会话 = 2004000000）。
- 过滤 `fromNs <= startNs <= toNs`；排序 `startNs` 升序、同值 `spanId` 字典序；`events[]` 的 `event` 与 `/events` 相同、逐字、过冻结 schema。
- 只读：不写事件、不消耗 `seq`、不缓存、不调 demo、不执行程序；两次相同 GET 逐字一致；`mode/readOnly` 是契约字段，客户端不得据此发写请求。
- `fromNs`/`toNs` 必须匹配 `^[0-9]+$` 且 `fromNs<=toNs`，否则 `400 bad_request`；未知 session `404 not_found`；非 GET `405`。
- 期望窗口（`expected-facts.json` 的 `replayWindows`）：A 的 before-fetch（1 条）、after-fetch-before-render（6 条）、默认（7 条）、fromNs 子集（5 条）、render-only（1 条）；B 的 before-validate（1 条）、after-validate-start（2 条）、默认（3 条）、render-only（1 条）。
- 窗口中的 `seq` 只在该 fixture 单独入 fresh session 时成立；两案例共享 `s_s3demo` 时按 `spanId`/`count`/顺序断言。

## 5. 怎么用（只读）

```bash
# 1) 离线 schema 校验（Ajv 来自 tools/verify/node_modules；临时脚本，不落仓库）
node -e "const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js');const fs=require('fs');const a=new Ajv({strict:true,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));for(const f of ['fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson','fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson']){fs.readFileSync(f,'utf8').split('\n').filter(Boolean).forEach((l,i)=>{if(!v(JSON.parse(l)))throw new Error(f+' line '+(i+1));});}console.log('ok');"

# 2) 当批次提交（需要 collector 已启动；A 期望 202 accepted=7，B 期望 202 accepted=3）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson"
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson"

# 3) 只读派生 + 回放
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/graph?traceId=1f2e3d4c5b6a79880a1b2c3d4e5f6071"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay?fromNs=0&toNs=1034500000"
```

- 文件规则：UTF-8 无 BOM、紧凑单行、LF、末行带 `\n`、无空行；校验器拒绝 `\r` 与带 `seq` 的行。
- ingest 幂等键 `(sessionId,traceId,spanId)`：重发 → `dropped=N`、事件数不变、`seq` 不变。
- 本目录在 G1 后冻结；修改需契约变更并由 reviewer 复核，不得静默追加语义。S3 到此为止（无构建插件/sourcemap/局部变量、无 S4 详情/接入、无实时/SSE/WS、无像素回放）。
