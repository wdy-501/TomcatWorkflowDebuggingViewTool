# s4-details — 节点详情 / ×N / 缺口 契约样例（游离后端根）

> 阶段：S4（本地接入 + 节点详情）｜契约样例，不是采集产物｜权威 schema：`schema/traceboard.event.v1.json`（v1 冻结，本目录不改 schema）
> 上游：`docs/plans/stages/S4/dispatch.md` §4.7/§4.8、`docs/plans/stages/S4/dispatch-amendment-01.md`（S4-AMD-01，binding；日期笔误按 2026-11-23 生效）、`docs/plans/stages/S4/s4-plan.md`
> 关联契约：`docs/contracts/api.v1.md` §2.4/§8.2/§10、`docs/contracts/event-model.v1.md` §4/§5、`docs/contracts/transport.v1.md` §6.5

## 1. 这是什么、不是什么

| 文件 | 内容 | 谁产生 |
|---|---|---|
| `events.ndjson` | 9 行同 trace 事件：一个**游离后端根** `controller(OrderController#cancel, LOST_BACKEND)` + 3 次同 `nodeKey` 的 `service(OrderService#cancel)`（×3），每次下挂 `mapper`，前两次再下挂 `sql(rowsAffected=0)`；第 3 次 `mapper` 为 `NOT_COLLECTED_POLICY`（`reason=policy:third_party_package`），其下**没有** sql | 手写固定取值，供确定性测试 |
| `expected-facts.json` | 逐条断言：根/父链/区间/状态、×3 分组、逐次 return/rows、缺口 3 项、`requests`/`graph`/`replay` 期望、工作台选择器与文案 | 手写 |

- **是**：逐行通过冻结 schema（Ajv 2020-12 strict）；用于 S4 离线门禁、工作台详情/×N/缺口开发、`requests`/`graph`/`replay` 派生断言。
- **不是**：不是运行时证据，也不是接入/预览/诊断的证据。
  - **运行时 ×3 是 S6**：本目录是 UI/测试数据，不是运行时事实，不得用于宣称 ×3 已支持。S4 工作台只对**已采集** span 按 `nodeKey` 做浏览器端聚合，不产生任何新采集能力。
  - 不得用本目录冒充“启动器已启动应用”“预览已注入”“握手已连接”——这些必须由 launcher/agent 在运行中产生（dispatch §1 item 1–4）。
- 本目录是新增目录，不改 S0–S3 fixture 字节（`fixtures/case-a-zero-rows/**`、`fixtures/s1-walking-skeleton/**`、`fixtures/s2-zero-row-chain/**`、`fixtures/s3-frontend-facts/**`），schema 字节不变。

### 1.1 与 dispatch §4.8 草图的差异（有意收敛，逐条说明）

dispatch §4.8 草图是 `ui_event → fetch → controller → 3×service + sql + mapper(NOT_COLLECTED) + 一个未关联 fetch`（click 根，`requests` EXACT）。本目录按 plan-writer 任务卡的**精确要求**落盘为游离后端根，差异如下：

| 项 | dispatch 草图 | 本 fixture | 理由 |
|---|---|---|---|
| 根 | `ui_event`（click 根）+ fetch | **孤立后端根** `controller`，`parentSpanId=null`、`confidence=LOST`、`rootEventId=click_lost_<spanId>`、flag `LOST_BACKEND` | `event-model.v1.md` §5 不变量：孤立后端根的 traceId 内**不得**出现任何前端事件（`ui_event`/`js_method`/`fetch`/`callback`/`render`），且不得与 `ui_event` 根共存。任务卡要求以 LOST 后端根演示“未采集/缺口”，二者不能同时成立 |
| 前端事件 | 有 fetch | **零**前端事件（`fetchCount=0`、`hasFrontend=false`） | 同上；LOST 根链是 S4 详情/×N/缺口最需要演示的形状（无 click 归属仍要看详情） |
| `requests` 派生 | EXACT | **LOST**，聚合状态 `NOT_COLLECTED_POLICY` | 根为孤立后端根 → 会话内该 trace 无 click 关联，只能 LOST；聚合优先级 `THREW > UNKNOWN > NOT_COLLECTED_POLICY > ... > RETURNED_FALSE > OK`，故一行 `NOT_COLLECTED_POLICY` 胜过第 3 次 `RETURNED_FALSE` |
| 缺口 ① | 未关联 fetch（`后端未采集/未关联`） | **不在本 fixture**（`gaps.notCovered`） | 本 trace 不允许有前端事件；缺口 ① 由工作台实现并由 **S4-F 测试内联的前端批次**断言（`ui_event` + 未被任何后端 `parentSpanId` 引用的 `fetch`），不得用本 fixture 冒充 |
| 事件数 | 9 | **9**（1 controller + 3 service + 3 mapper + 2 sql） | 同为 9；`graph` 仍是 9 节点/8 边（每 span 一节点，不聚合） |

上述收敛不改变 S4 验收信号：同一 `nodeKey` ×3、逐次 return/rows、`NOT_COLLECTED_*` 带 reason、rows 缺失显示“未采集”、区间嵌套、SQL rows 0、无 `THREW`。

### 1.2 时间字段口径

- `startNs` 以 `5_000_000_000` 为基（**fixture 作用域示意值**，不是 epoch-ns，也不要求与运行时相等）；选小基值是为了让 JS `Number`（<2^53）精确表示，便于校验器与浏览器端直接比较。
- 断言只依赖**相对顺序、区间包含/嵌套、时长关系**与 `expected-facts.json` 内的取值；显示端用 `relNs = startNs − minStartNs` 归一化（根 `relNs=0`）。
- 运行时口径不变（`event-model.v1.md` §12.10）：agent 用 `System.currentTimeMillis()*1e6 + System.nanoTime()%1e6`。不得把本目录数值当运行时 epoch-ns 或跨进程时钟对齐依据。

## 2. 固定标识与链路（`s_s4detail`）

| 项 | 值 |
|---|---|
| `sessionId` | `s_s4detail` |
| `traceId` | `4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90` |
| `rootEventId` | `click_lost_c0a1b2c3d4e5f601`（游离后端根约定：`click_lost_<根spanId>`） |
| `thread` | `{"id":44,"name":"http-nio-8080-exec-1"}`（9 事件全部相同） |
| 根 flags | `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]`；子节点仅 `["S2_ZERO_ROW_CHAIN"]`（`LOST_BACKEND` 只在根） |
| confidence | 9 事件全部 `LOST`（同 trace 继承，无 EXACT） |

| # | kind | spanId | parentSpanId | nodeKey | startNs | durNs | status | return / sideEffects |
|---|---|---|---|---|---|---|---|---|
| 1 | `controller` | `c0a1b2c3d4e5f601` | `null`（根） | `com.example.shop.controller.OrderController#cancel` | 5000000000 | 120000000 | OK | `{"type":"org.springframework.http.ResponseEntity","value":200}` |
| 2 | `service` | `a1b2c3d4e5f60101` | `c0a1b2c3d4e5f601` | `com.example.shop.service.OrderService#cancel` | 5005000000 | 30000000 | OK | `{"type":"boolean","value":true}` |
| 3 | `mapper` | `b2c3d4e5f6010102` | `a1b2c3d4e5f60101` | `com.example.shop.mapper.OrderMapper#cancelById` | 5006000000 | 12000000 | OK | `{"type":"int","value":0}` |
| 4 | `sql` | `c3d4e5f601020103` | `b2c3d4e5f6010102` | `OrderMapper.cancelById` | 5007000000 | 8000000 | OK | `return=null`；`sideEffects[0]={type:"sql",sqlId:"OrderMapper.cancelById",rowsAffected:0,transaction:"UNKNOWN"}` |
| 5 | `service` | `d4e5f60103020104` | `c0a1b2c3d4e5f601` | `com.example.shop.service.OrderService#cancel` | 5040000000 | 30000000 | OK | `{"type":"boolean","value":true}` |
| 6 | `mapper` | `e5f6010403020105` | `d4e5f60103020104` | `com.example.shop.mapper.OrderMapper#cancelById` | 5041000000 | 12000000 | OK | `{"type":"int","value":0}` |
| 7 | `sql` | `f601050403020106` | `e5f6010403020105` | `OrderMapper.cancelById` | 5042000000 | 8000000 | OK | `return=null`；`sideEffects[0].rowsAffected=0`、`transaction="UNKNOWN"` |
| 8 | `service` | `1607060504030207` | `c0a1b2c3d4e5f601` | `com.example.shop.service.OrderService#cancel` | 5080000000 | 25000000 | RETURNED_FALSE | `{"type":"boolean","value":false}` |
| 9 | `mapper` | `2708070605040308` | `1607060504030207` | `com.example.shop.mapper.OrderMapper#cancelById` | 5081000000 | 6000000 | **NOT_COLLECTED_POLICY**（`reason="policy:third_party_package"`） | 无 `return`、无 `sideEffects` |

- **父链**：根 → 三个 service；service1 → mapper1 → sql1；service2 → mapper2 → sql2；service3 → mapper3（无 sql）。
- **区间**：根 `[5000000000, 5120000000)` ⊃ 全部子节点；每次调用内部 `service ⊃ mapper ⊃ sql` 严格嵌套；`startNs` 非递减；`durNs` 均 > 0。
- **无 `THREW`**：第 3 次是“正常返回 `false`”，不是异常；`NOT_COLLECTED_POLICY` 是采集策略缺失事实，不是错误。
- **第 3 次调用没有 sql 节点**：因此该次 `rows` 必须显示“未采集”，**绝不为 0**；mapper3 自身也没有 `sideEffects`（`sideEffects` 只属于 sql 节点）。
- **source**：9 事件都带完整 `source.file:line`（mapper3 为 `OrderMapper.java:15`）；详情按 `file:line` 显示，只有缺 `file`/`line` 时才显示 `未采集`。

## 3. ×N 分组（工作台纯前端派生，不改 `graph`/API 形状）

| kind | nodeKey | count | badge | spanId 顺序（startNs 升序） |
|---|---|---|---|---|
| `service` | `com.example.shop.service.OrderService#cancel` | 3 | `×3` | `a1b2c3d4e5f60101`, `d4e5f60103020104`, `1607060504030207` |
| `mapper` | `com.example.shop.mapper.OrderMapper#cancelById` | 3 | `×3` | `b2c3d4e5f6010102`, `e5f6010403020105`, `2708070605040308` |
| `sql` | `OrderMapper.cancelById` | 2 | `×2` | `c3d4e5f601020103`, `f601050403020106` |

逐次事实（`expected-facts.json` `groups[]`）：

| 选中 | 第 i/N 次 | status | return | rows | 备注 |
|---|---|---|---|---|---|
| service #cancel | 1/3 | OK | `true` | `[0]` | 有 sql 子节点 |
| service #cancel | 2/3 | OK | `true` | `[0]` | 有 sql 子节点 |
| service #cancel | 3/3 | RETURNED_FALSE | `false` | **未采集** | 无 sql 子节点（mapper 策略未采集） |
| mapper #cancelById | 1/3 | OK | `0` | 未采集 | 自身无 `sideEffects` |
| mapper #cancelById | 2/3 | OK | `0` | 未采集 | 自身无 `sideEffects` |
| mapper #cancelById | 3/3 | NOT_COLLECTED_POLICY | 未采集 | 未采集 | `reason=policy:third_party_package` |
| sql cancelById | 1/2 | OK | — | `0` | `transaction=UNKNOWN` |
| sql cancelById | 2/2 | OK | — | `0` | `transaction=UNKNOWN` |

- 选中标题示例：`service · com.example.shop.service.OrderService#cancel · 第 1/3 次`。
- `#s4-invocation-select` 项数 = 3（service/mapper 各 3；sql 为 2），顺序 `startNs` 升序、同值按 `spanId` 字典序；切换选中只改详情，不改图/不改 API。
- `#s4-group-badge` 是**容器**：每组一个带 `data-node-key` 的子元素（两个 `×3` 各自一个徽标），不使用重复 id。
- 逐次 `rows` 只从该次调用的 **sql 子节点** `sideEffects` 直接读取（自身是 sql → 自身 `rowsAffected`；否则子树内 sql，标注“子 sql”；无则 `未采集`）；任何缺失一律 `未采集`，绝不为 0。
- UI 必须在 `#s4-invocations` 或 `#s4-gaps` 下方静态说明：`×N 为已采集 span 的前端聚合；运行时 ×3 属 S6`。

## 4. 缺口（工作台只读派生；`expected-facts.json` `gaps[]`）

| rule | spanId | 文案 | 原因 |
|---|---|---|---|
| `ROWS_NOT_COLLECTED` | `b2c3d4e5f6010102`（mapper 第 1 次） | `未采集` | mapper 无 `sideEffects`，rows 事实只在 sql 子节点 |
| `ROWS_NOT_COLLECTED` | `e5f6010403020105`（mapper 第 2 次） | `未采集` | 同上 |
| `NOT_COLLECTED_REASON` | `2708070605040308`（mapper 第 3 次） | `未采集 · policy:third_party_package` | `NOT_COLLECTED_*` 必须原样展示 reason |

- 规则（S4-AMD-01 §7.2）：按 span 依次判定，优先级 **F > N > R**，每个 span **最多一条**缺口。缺口内部 `reason` 键：R=`ROWS_NOT_COLLECTED`、N=事件 reason（缺失=`NO_REASON`）、F=`FETCH_WITHOUT_BACKEND`；同一 span 内以 `nodeKey+reason` 为键、按 N > R 只取一条；**不同 span（×N 的逐次调用）不跨 span 合并**；按 span 顺序（`startNs` 升序、同值 `spanId`）输出。本 fixture 因此**恰 3 条**（mapper1/mapper2 命中 R，mapper3 命中 N 且 N 优先于 R）。
- `notCovered`：`FETCH_WITHOUT_BACKEND`（`后端未采集/未关联`）——本 trace 是孤立后端根，按事件模型不得含前端事件；该规则由 S4-F 测试内联前端批次断言。
- 空列表文案（逐字）：`未发现缺口（仅基于已采集数据；未采集项不会显示为成功）`。
- 缺口只是“还没看到”的如实标注，不是错误结论；`未采集` 永不显示为 `0`。

## 5. 期望的只读 API 视图

### 5.1 `GET /api/v1/sessions/s_s4detail/requests`

```json
{"sessionId":"s_s4detail","sdkActive":false,"requests":[
 {"traceId":"4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90","rootSpanId":"c0a1b2c3d4e5f601","rootKind":"controller",
  "nodeKey":"com.example.shop.controller.OrderController#cancel","status":"NOT_COLLECTED_POLICY",
  "confidence":"LOST","spanCount":9,"startedAtNs":5000000000,"durNs":120000000,
  "hasError":false,"fetchCount":0,"hasFrontend":false,"hasBackend":true,"backendSpanCount":9}]}
```

- `sdkActive=false`：本会话无 `SDK_ACTIVE` flag 的 `ui_event`。
- `confidence=LOST` 来自“孤立后端根”规则（`api.v1.md` §9.2），不是缺失数据。
- `status` 为聚合状态：`NOT_COLLECTED_POLICY` 优先于 `RETURNED_FALSE`；`hasError=false`（无 `THREW`）。

### 5.2 `GET /api/v1/sessions/s_s4detail/graph?traceId=4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90`

```text
nodes（按 startNs）= controller, service1, mapper1, sql1, service2, mapper2, sql2, service3, mapper3   （9）
edges = controller→service1, controller→service2, controller→service3,
        service1→mapper1, mapper1→sql1, service2→mapper2, mapper2→sql2, service3→mapper3           （8，count 恒 1）
```

- 每 span 一节点：**不聚合** 3 个 service / 3 个 mapper / 2 个 sql；`×N` 只是工作台显示分组。
- 根 `rootEventId=click_lost_c0a1b2c3d4e5f601`、顶层 `confidence=LOST` 不变。
- **S4 起每个节点固定 14 字段**（S2–S3 的 11 字段 + 加性只读 `reason`/`source`/`confidence`，见 `api.v1.md` §8.2/§10.8）：mapper3 (`2708070605040308`) 的 `reason="policy:third_party_package"`、`source={"file":"OrderMapper.java","line":15}`（详情显示 `OrderMapper.java:15`）、`confidence="LOST"`；其余节点 `reason=null`，`source` 为各自事件原值（9 事件都有完整 `file:line`）；`flags` 语义、`edges`、顺序、节点数（9/8）不变。
- `source` 只在 `file` 与 `line` 都完整时显示 `file:line`，否则显示 `未采集`（本 fixture 没有缺字段的 source；该回退由 S4-F 的内联构造/单测断言，不改事件字节）。
- 这是**加性契约**，不是 schema 变更：`events`/`seq`/`requests`/`replay` 与本文 `events.ndjson` 字节零改动。

### 5.3 `GET /api/v1/sessions/s_s4detail/replay?fromNs=0&toNs=5120000000`

- 9 条、`startNs` 升序；`fromNs` 缺省 0，`toNs` 缺省 = `max(startNs+durNs)` = 根结束 `5120000000`。
- `replay` 只读，不写事件、不消耗 `seq`；`seq` 只在单独入 fresh session 时成立（本文件有 9 行 → `seq` 1..9）。

## 6. 怎么用（只读）

```bash
# 1) 离线 schema 校验（Ajv 来自 tools/verify/node_modules；临时脚本，不落仓库）
node -e "const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js');const fs=require('fs');const a=new Ajv({strict:true,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));const f='fixtures/s4-details/events.ndjson';fs.readFileSync(f,'utf8').split('\n').filter(Boolean).forEach((l,i)=>{if(!v(JSON.parse(l)))throw new Error(f+' line '+(i+1)+' '+JSON.stringify(v.errors));});console.log('ok');"

# 2) 当批次提交（需 collector 已启动；期望 202 accepted=9 rejected=0 dropped=0）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s4-details/events.ndjson"

# 3) 只读派生 + 回放
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s4detail/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s4detail/graph?traceId=4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s4detail/replay?fromNs=0&toNs=5007000000"   # 前 4 条
```

- 文件规则：UTF-8 无 BOM、紧凑单行、LF、末行带 `\n`、无空行；事件行**不得**带 `seq`（collector 分配）。
- 幂等键 `(sessionId,traceId,spanId)`：重发 → `dropped=9`、事件数不变、`seq` 不变。
- 本目录在 G1 后冻结；修改需契约变更并由 reviewer 复核，不得静默追加语义。
- S4 到此为止：无 L1/L2（`values[]`/局部变量/字段 diff）、无 sourcemap/行号（S5）、无运行时 ×3/S6、无 SSE/WS/持久化。工作台显示“未采集”是如实标注，不是缺陷结论。
