# s1-walking-skeleton — 一条假事件到工作台 + 一个真实 controller span

> 阶段：S1（walking skeleton）｜契约样例，不是采集产物｜权威 schema：`schema/traceboard.event.v1.json`（v1 冻结，本目录不改 schema）
> 上游：`docs/plans/stages/S1/dispatch.md` §4.1–§4.5、`docs/plans/stages/S1/s1-plan.md` §14（偏离记录）
> 关联契约：`docs/contracts/api.v1.md` §7、`docs/contracts/transport.v1.md` §4.5（第 8 条）/§6.1、`docs/contracts/event-model.v1.md` §5 第 2 条例外

## 1. 两个文件分别代表什么

| 文件 | 真假 | 内容 | 谁产生 |
|---|---|---|---|
| `frontend-fake-batch.ndjson` | **假**（手写/工作台合成） | 2 条前端事件：点击 `#btn-s1-fake` → `fetch POST /api/orders/1/cancel` | 工作台 S1 面板按钮（本文件是它的契约样例） |
| `agent-controller-span.json` | **真**（真实插桩的形状） | 1 条 `kind=controller` span：`OrderController#cancel(long)` 退出时发出 | agent（Byte Buddy Advice，S1 唯一插桩方法） |

- `frontend-fake-batch.ndjson` 里的 HTTP 200 **没有真实请求**发生：它是固定值，用来证明“一条假事件能从点击/请求走到工作台”。
- `agent-controller-span.json` 是 demo 真实调用 `POST /api/orders/1/cancel` 后 agent 应发出的**唯一一条**后端事件；字段取值见 §3。
- 两者在 S1 **没有任何关联**：不同 `sessionId`、不同 `traceId`、没有任何传播头。同屏展示不代表能连线。

## 2. 标识与链路怎么算

### 2.1 假批次（2 行，文件行序）

| # | kind | nodeKey | spanId | parentSpanId | 区间 | status | confidence |
|---|---|---|---|---|---|---|---|
| 1 | `ui_event` | `#btn-s1-fake` | `0f0e0d0c0b0a0908` | `null` | `[0ms, 12ms]` | OK | EXACT |
| 2 | `fetch` | `POST /api/orders/1/cancel` | `0102030405060708` | `0f0e0d0c0b0a0908` | `[2ms, 12ms]` | OK | EXACT |

- 同 `sessionId=s_wb_demo`、同 `traceId=a1b2c3d4e5f60718293a4b5c6d7e8f90`、同 `rootEventId=click_a1b2c3d4e5`。
- `parentSpanId` 显式连成一条链；子区间 `[2ms,12ms]` 落在父区间 `[0ms,12ms]` 内（含端点，符合 `event-model.v1.md` §5 第 4 条）。
- `rootEventId` 是 `click_` + 10 位 `[A-Za-z0-9_-]`，满足 `^click_[A-Za-z0-9_-]{8,}$`；它是**假点击 id**，不对应任何真实浏览器会话。
- 时序取值说明：点击 `durNs=12000000`、fetch `2000000/10000000`。分发书 §4.5 的原值（点击 `5000000`、fetch `1000000/3000000`，即 `[1ms,4ms] ⊆ [0,5ms]`）**本来就嵌套成立**；
  本样例统一放大到 `0/12ms` 与 `2/12ms` 只是为了让毫秒刻度更易读、并让 fetch 时长贴近一次真实请求，**不是**修正越界（原理由引述失准，G1 N2 已纠正）。
- 工作台每次点击都换新 `traceId`/`spanId`/`rootEventId`，但 `sessionId` 固定为 `s_wb_demo`（读回路径固定，见 `s1-plan.md` §14-D8）。

### 2.2 agent span（1 行）

| 字段 | 值 | 说明 |
|---|---|---|
| `sessionId` | `s_s1_agent` | `-Dtraceboard.sessionId` 默认值 |
| `traceId` | `3f8a1c9d2b7e4f60a95c1d83e72b4a10` | S1 无关联；未配置时每个 span 随机 32 位小写 hex |
| `spanId` | `7c3e5a91b2d4086f` | 每 span 随机 16 位小写 hex |
| `parentSpanId` | `null` | 游离**后端**根：没有前端父 span（**不是**“真实点击的后端子节点”）；这是 `event-model.v1.md` §5 第 2 条的 S1 例外 |
| `rootEventId` | `click_lost_7c3e5a91b2d4086f` | 合成占位：`click_lost_` + 该 span 的 `spanId`；只满足 schema，不伪装真实 clickId |
| `kind` / `nodeKey` | `controller` / `com.example.shop.controller.OrderController#cancel` | 真实源码方法 `cancel(long)`；**不是** S0 fixture 里的虚构方法名 `#cancelOrder` |
| `source` | `{"file":"OrderController.java","line":43}` | 来自 `StackTraceElement` 的示例值（Advice 在**方法退出**取栈，`line` 是退出点而非声明行，跨构建不可复现）；实现无调试信息时应省略 `source`；tester **只断言文件名** |
| `thread` | `{"id":41,"name":"http-nio-8080-exec-1"}` | 采集时的当前线程 |
| `startNs` / `durNs` | `1500000000` / `3421987` | 相对 agent premain 的单调纳秒；`durNs>0` |
| `status` | `OK` | 正常退出；抛异常时为 `THREW`（S1 不采集异常 payload） |
| `return` | `{"type":"org.springframework.http.ResponseEntity","value":null}` | 只记返回类型，值未采集 |
| `confidence` | `LOST` | 只有后端一端 → 游离区；S1 不出现 `EXACT`/`INFERRED` |
| `flags` | `["SKELETON","S1_ONE_METHOD","LOST_BACKEND"]` | 固定三个标记：`LOST_BACKEND` 是 v1 使用的语义 flag，另两个是**本阶段标记**（`event-model.v1.md` §7）；flag 只作提示，不改 `status` |

> 语义归属（**G1 第 1 轮裁决，已落地**）：`event-model.v1.md` §2/§5 第 2 条给出唯一例外——后端请求**没有前端根**时允许“游离后端根”
> （`parentSpanId=null`、`kind=controller`、`confidence=LOST`、合成 `rootEventId=click_lost_<spanId>`、flags 含 `LOST_BACKEND`，见主计划 §8.3）；
> `transport.v1.md` §4.5 第 8 条记录同一语义（不是伪造的前端根、不与任何前端事件关联、UI 按 LOST 显示为游离）。
> `schema/traceboard.event.v1.json` 与 fixture 字节均**未**因此改动（G1 方案 A：只改文档）。

## 3. 机器可读期望（`expected-facts.json`）

- 形状：`facts[]` 条目与 `pathSyntax` 沿用 S0（`{id,source,kind,nodeKey,status,assert{path,value},summary}`），但**不是** S0 顶层形状：
  每条 fact 新增 `source` 字段区分两个来源（`frontendBatch` 2 行 / `agentSpan` 1 行），S0 的顶层全局键
  （`eventCount`/`traceId`/`rootEventId`/`noExceptions`/`confidenceAllExact`/`statusAllOk`/`flagRequired`）**下沉到** `globalAssertions.<source>`。
  原因：S1 有两个互不关联的来源，S0 的顶层单值键无法表达“两个 sessionId/两个 traceId”。（偏离记录：`s1-plan.md` §14-D14）
- 选取规则：在指定 `source` 内按行序取**第一条** `kind` 与 `nodeKey` 同时匹配的事件；找不到即 FAIL。
- `assert.path`：点号分段、数字段为数组下标、叶子深比较（与 S0 校验器一致）。`>`、`includes` 一类断言写进 `globalAssertions`，不塞进 `assert`。
- `globalAssertions` 覆盖：事件数、sessionId、traceId/rootEventId 一致性、`confidenceAllExact`/`statusAllOk`（仅假批次）、
  父子链、区间包含、`flagsInclude`、agent span 的 LOST/OK、`rootEventId=click_lost_+spanId`、`durNs>0`、无 `values`/`sideEffects`/异常 payload。
- 消费方：`tools/verify/verify.mjs` 的 S0 门禁 V1b 按硬编码路径读 case A 且要求恰好 5 条 fact，**不能直接消费本文件**；
  tester 在 S1 门禁（`verify-s1.mjs` 或扩展项）新增消费器，且**不得改动** S0 的 V1b（5 条 fact）。本文件不描述任何 S2 事实（行数、SQL、关联）。

## 4. S1 没有采集、也没有关联的东西

1. **没有真实前端采集**：没有浏览器 SDK、没有 DOM 事件监听、没有 fetch/XHR 拦截；两条前端事件是按钮里拼出来的。
2. **没有传播**：不发 `traceparent`、不带 `clickId`/`rootEventId` 请求头；后端 span 拿不到前端 id。
3. **没有关联引擎**：不做时间窗匹配、不做游离区合并、不做手工关联写接口；假批次与 agent span 之间**没有**父子边。
4. **只插桩一个方法**：`OrderController#cancel(long)`；service/mapper/JDBC/SQL/其它 Controller 方法一律不采集（S2）。
5. **没有行数/值/SQL 文本**：无 `sideEffects`、无 `values`、无异常类型/message/栈。
6. **没有图/时间轴/回放/SSE/WebSocket/请求切换**：工作台只有原始事件表与会话计数。
7. **不持久化**：collector 只有内存 append-only 存储，重启即清空。

## 5. 怎么用

```bash
# 1) 逐行/整文件 schema 校验（tester 的 S1 门禁，只读）
(cd "tools/verify" && node verify.mjs)

# 2) 整批提交假事件（2 行 + 末行 \n，application/x-ndjson）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson"
# 期望：202 {"accepted":2,"rejected":0,"dropped":0,"errors":[]}；重发同批 → {"accepted":0,...,"dropped":2}

# 3) agent span 同样是单行 NDJSON，可直接当 1 行批次提交（用于离线验证/演示）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson" \
  --data-binary @"fixtures/s1-walking-skeleton/agent-controller-span.json"

# 4) 只读查询（不是回放）
curl -s "http://127.0.0.1:8601/api/v1/sessions"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200"
# 刚启动的 collector 从第 1 页读即可；会话累计 >200 条时工作台按 eventCount 读尾页（见 s1-plan §8.1）
```

- `agent-controller-span.json` 是单个 JSON 对象 + 末尾换行，因此既是 JSON 文件也是合法的 1 行 NDJSON。
- 文件规则与 S0 相同：UTF-8 无 BOM、紧凑单行、末行带 `\n`、无空行；换行必须 LF（校验器拒绝 `\r`）。
- 本目录文件在 G1 后冻结；修改需契约变更并由 reviewer 复核，不得静默追加语义。
