# s2-zero-row-chain — 一次 cancel 请求的四段后端事实链（0 行）

> 阶段：S2（MVP，0-row fact chain）｜契约样例，不是采集产物｜权威 schema：`schema/traceboard.event.v1.json`（v1 冻结，本目录不改 schema）
> 上游：`docs/plans/stages/S2/dispatch.md` §4.1–§4.5、`docs/plans/stages/S2/s2-plan.md`
> 关联契约：`docs/contracts/api.v1.md` §2.2/§8/附录 B、`docs/contracts/event-model.v1.md` §3.3/§4.3/§4.5/§5/§7/§11、`docs/contracts/transport.v1.md` §6.3

## 1. 这个 fixture 是什么、不是什么

| 文件 | 内容 | 谁产生 |
|---|---|---|
| `events.ndjson` | 4 行同 trace 的事件：`controller → service → mapper → sql`，模拟 `POST /api/orders/1/cancel`（id=1 存在、行状态 CREATED、SQL 条件 `status='PAID'`） | agent 真实插桩的**契约形状**（手写固定取值，供确定性测试） |
| `expected-facts.json` | 6 条事实 + `globalAssertions`（单根、共享 trace/root、全 LOST/全 OK、父子链、区间嵌套、SQL 0 行/UNKNOWN、无 THREW、4 span） | plan-writer（S2 门禁消费器读取） |
| `README.md` | 本文件：编号、时序、期望 API 视图、故意缺陷、边界 | plan-writer |

- **是**：4 行、单 trace、`confidence=LOST` 的游离后端请求链；每行必须通过冻结 schema；用于 S2-A 离线门禁与 `requests`/`graph` 派生断言。
- **不是**：不是运行时证据。S2 的“真实 0 行”必须由 H2+MyBatis demo 在运行中用 `UPDATE ... WHERE id=? AND status='PAID'` 对 CREATED 行产生（dispatch §1 第 1 条）。
  **禁止**把本 fixture 当作“demo 已产生 0 行”的替代，也**禁止**用 fixture 伪造运行时 0 行结论。
- 本目录是新增目录，不改 S0 `fixtures/case-a-zero-rows/**` 与 S1 `fixtures/s1-walking-skeleton/**`；schema 字节不变。

## 2. 标识与链路

固定取值（`expected-facts.json` 与 S2 门禁按此断言）：

| 项 | 值 |
|---|---|
| `sessionId` | `s_s2agent`（agent `-Dtraceboard.sessionId` 默认值） |
| `traceId` | `9f8e7d6c5b4a39281706f5e4d3c2b1a0`（32 位小写 hex） |
| `rootSpanId` | `1a2b3c4d5e6f7a80`（16 位小写 hex） |
| `rootEventId` | `click_lost_1a2b3c4d5e6f7a80`（合成占位：`click_lost_` + 根 spanId，不伪装真实 clickId） |
| `thread` | `{"id":44,"name":"http-nio-8080-exec-1"}`（4 行相同） |

| # | kind | spanId | parentSpanId | nodeKey | startNs | durNs | status | return | sideEffects | flags |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `controller` | `1a2b3c4d5e6f7a80` | `null`（游离后端根） | `com.example.shop.controller.OrderController#cancel` | 1000000000 | 8000000 | OK | `{"type":"org.springframework.http.ResponseEntity","value":200}` | — | `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]` |
| 2 | `service` | `2b3c4d5e6f7a8091` | `1a2b3c4d5e6f7a80` | `com.example.shop.service.OrderService#cancel` | 1001000000 | 6500000 | OK | `{"type":"boolean","value":true}` | — | `["S2_ZERO_ROW_CHAIN"]` |
| 3 | `mapper` | `3c4d5e6f7a8091a2` | `2b3c4d5e6f7a8091` | `com.example.shop.mapper.OrderMapper#cancelById` | 1002000000 | 5000000 | OK | `{"type":"int","value":0}` | — | `["S2_ZERO_ROW_CHAIN"]` |
| 4 | `sql` | `4d5e6f7a8091a2b3` | `3c4d5e6f7a8091a2` | `OrderMapper.cancelById` | 1003000000 | 3000000 | OK | `null` | `[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":0,"transaction":"UNKNOWN"}]` | `["S2_ZERO_ROW_CHAIN"]` |

- 4 行**同** `sessionId`/`traceId`/`rootEventId`；仅根 `parentSpanId=null` 且唯一带 `LOST_BACKEND`；子 span 指向父（`event-model.v1.md` §5 第 2/3 条例外与共享 `rootEventId` 规则）。
- `confidence` 4 行全为 `LOST`：子 span 继承后的游离后端请求没有前端根，**不存在** `EXACT`/`INFERRED`；`LOST` 是置信度，不是状态。
- 区间：`[1.000s,1.008s] ⊃ [1.001s,1.0075s] ⊃ [1.002s,1.007s] ⊃ [1.003s,1.006s]`（严格嵌套，`event-model.v1.md` §5 第 4 条）。
- 文件行序按 `startNs` **非降序**（控制器先起）。**注意**：真实运行时事件按方法**退出**顺序到达 collector（sql→mapper→service→controller），
  因此 `seq` 顺序 ≠ `startNs` 顺序；S2 的 `requests`/`graph` 与测试一律按 `startNs` 与父子关系排序，不得假设 `seq` 顺序。
- `source.file` 是真实文件名（`OrderController.java`/`OrderService.java`/`OrderMapper.java`/`OrderMapper.xml`）；`source.line` 是**示例值**，
  agent 只写真实栈帧的退出点行号、不猜，跨构建不可复现 —— tester 只断言文件名，不比较行号（同 S1 口径）。
- `flags`：`S2_ZERO_ROW_CHAIN` 是 S2 阶段标记（只说明采集范围/来源）；`LOST_BACKEND` 按 `event-model.v1.md` §7 只属于游离后端**根**，子 span 不带。
- 无 `values`、无 `reason`、无异常 payload；`THREW` 只记状态与 `return=null`（本链全 OK，无异常）。

## 3. 期望的只读 API 视图（`api.v1.md` §8）

```http
GET /api/v1/sessions/s_s2agent/requests
→ 200 {"sessionId":"s_s2agent","requests":[{
    "traceId":"9f8e7d6c5b4a39281706f5e4d3c2b1a0","rootSpanId":"1a2b3c4d5e6f7a80",
    "rootKind":"controller","nodeKey":"com.example.shop.controller.OrderController#cancel",
    "status":"OK","confidence":"LOST","spanCount":4,
    "startedAtNs":1000000000,"durNs":8000000,"hasError":false}]}

GET /api/v1/sessions/s_s2agent/graph?traceId=9f8e7d6c5b4a39281706f5e4d3c2b1a0
→ 200 {"sessionId":"s_s2agent","traceId":"9f8e7d6c5b4a39281706f5e4d3c2b1a0",
    "rootEventId":"click_lost_1a2b3c4d5e6f7a80","confidence":"LOST",
    "nodes":[4 个，按 startNs 升序 = 上表 #1..#4],"edges":[
      {"from":"1a2b3c4d5e6f7a80","to":"2b3c4d5e6f7a8091","count":1},
      {"from":"2b3c4d5e6f7a8091","to":"3c4d5e6f7a8091a2","count":1},
      {"from":"3c4d5e6f7a8091a2","to":"4d5e6f7a8091a2b3","count":1}]}
```

- `requests[0].status=OK` 是**聚合最严重级**（本链 4 条全 OK）；`hasError=false`；`durNs` = trace 尾 − trace 头 = `1008000000-1000000000`。
- `graph.nodes` 每条含 `spanId,parentSpanId,kind,nodeKey,status,return,sideEffects,startNs,durNs,thread,flags`；S2 **不做 ×N 聚合**，
  同 nodeKey 多次调用会出现多个节点（本 fixture 无重复）。`edges.count` 在 S2 恒为 1（`spanId` 唯一）。
- 两次相同 GET 结果必须一致，且事件数/`seq`/存储不变（读时派生，无缓存、无写入）。

## 4. 故意缺陷（S2 demo，案例 A）

- `OrderMapper.cancelById`：`UPDATE orders SET status='CANCELLED' WHERE id=#{id} AND status='PAID'`；
  seed 行 `id=1, status='CREATED'` → **影响 0 行**。
- `OrderService.cancel(id)` 先做存在性检查（未知 id → `false`，不执行 `cancelById`），存在则调用 `cancelById` 并**忽略返回值**，仍返回 `true`。
- `OrderController.cancel` 按 `true` 返回 `200 {"data":true}`；demo 前端（不改）收到 2xx 显示“操作成功”并刷新列表，列表仍是 CREATED。
- 这是**有意植入的 demo 缺陷**（主计划 §5 案例 A），不是 TraceBoard 的 bug；TraceBoard 只摆事实（SQL 0 行、Mapper 0、Service true、HTTP 200、异常 0）。
- 未知 id：`404 {"data":false}`，该链只有 controller + service 两段（`RETURNED_FALSE`），无 mapper/sql —— 本 fixture **不是**未知 id 链，不得混用。

## 5. 怎么用（只读）

```bash
# 1) 离线 schema 校验（S2 门禁的一部分；也可用 tools/verify 的 S2-A）
node -e "const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js');const fs=require('fs');const a=new Ajv({strict:true,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));fs.readFileSync('fixtures/s2-zero-row-chain/events.ndjson','utf8').split('\n').filter(Boolean).forEach((l,i)=>{if(!v(JSON.parse(l)))throw new Error('line '+(i+1));});console.log('ok');"

# 2) 当 1 批 4 行提交（需要 collector 已启动；期望 202 accepted=4）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s2-zero-row-chain/events.ndjson"

# 3) 只读派生视图（不是回放）
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=9f8e7d6c5b4a39281706f5e4d3c2b1a0"
```

- 文件规则：UTF-8 无 BOM、紧凑单行、LF、末行带 `\n`、无空行；校验器拒绝 `\r` 与带 `seq` 的行。
- ingest 幂等键 `(sessionId,traceId,spanId)`：重发本批 → `dropped=4`，事件数不变。
- 本目录在 G1 后冻结；修改需契约变更并由 reviewer 复核，不得静默追加语义。S2 到此为止（无前端 SDK/关联/回放/时间轴/SSE/WS/`values`）。
