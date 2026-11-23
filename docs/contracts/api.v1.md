# HTTP API 契约 v1（api.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23
> 变更记录：**2026-11-23 S1 增补**——ingest 与两个只读查询转为 IMPLEMENTED，meta `capabilities.ingestEvents=true`；
>   S0 的矩阵/端点章节按原样保留为历史（§2、§3、§4、§6），S1 当前权威定义在 **§7**。graph/replay/stream/links 仍为 RESERVED。
>   **2026-11-23 G1 第 1 轮**：§7.5 补一句“agent controller span 为游离后端根”，指向 `event-model.v1.md` §5 第 2 条例外（仅文档）。
> 范围：collector HTTP API + demo 应用 API（附录）。S0 只实现 3 个 collector 端点，其余全部 RESERVED。
> 关联：`transport.v1.md`（ingest 线上格式与 202/400/413/415、查询通路 C）、`event-model.v1.md`（事件体）。

## 1. 约定

- Base URL：collector `http://127.0.0.1:8601`；demo 后端 `http://localhost:8080`；workbench dev `http://localhost:5173`；demo 前端 dev `http://localhost:5174`。
- 所有响应 `application/json; charset=utf-8`（SSE 除外，见 §4，预留）；JSON 不接受注释/尾逗号。
- 无外部 CDN、无遥测、无第三方鉴权服务；S0 collector 只监听回环地址，不做 CORS（不返回 `Access-Control-*`）。
- 版本在路径中（`/api/v1/`、`/ingest/v1/`）；事件 schema 版本在 body 中（`traceboard.event.v1`）。
- 错误统一信封（`transport.v1.md` §4.3）：

```json
{"error":"not_implemented","message":"...","apiVersion":"v1"}
```

- 状态图例：**IMPLEMENTED**（该阶段必须可验证）、**PLACEHOLDER**（端点存在但固定返回 501）、**RESERVED**（不实现、不得出现在代码路由中）。
  S1 起：`POST /ingest/v1/events`、`GET /api/v1/sessions`、`GET /api/v1/sessions/{sessionId}/events` 为 IMPLEMENTED；
  graph/replay/stream/links 仍为 RESERVED（S1 代码不得注册这些路由）。

## 2. S0 实现矩阵（S0 历史，冻结，不改写）

> S1 起 ingest 与两个查询已实现，**当前权威矩阵见 §2.1**；本节保留 S0 原始状态作为历史记录。

| 方法 | 路径 | 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | Spring Boot Actuator，`{"status":"UP"}` |
| GET | `/api/v1/meta` | **IMPLEMENTED** | 服务/schema 元信息 |
| POST | `/ingest/v1/events` | **PLACEHOLDER** | 固定 501，不解析 body、不落盘 |
| GET | `/api/v1/sessions` | RESERVED | 会话列表 |
| GET | `/api/v1/sessions/{sessionId}/events` | RESERVED | 事件分页读取（回放只读） |
| GET | `/api/v1/sessions/{sessionId}/graph` | RESERVED | 派生图（S1 关联设计） |
| GET | `/api/v1/sessions/{sessionId}/replay` | RESERVED | 只读回放视图（事件 + 派生摘要） |
| GET | `/api/v1/stream` | RESERVED | SSE 实时推送 |
| WS | `/ws/v1/events` | RESERVED | WebSocket 实时推送 |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联（S4） |

除上表 3 个 S0 端点外，collector 不暴露任何写接口；未知路径返回 404（Boot 默认即可），方法不匹配返回 405。

### 2.1 S1 实现矩阵（当前权威）

| 方法 | 路径 | S1 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities.ingestEvents=true`，`realtime=false`，`replay=false`（§7.3） |
| POST | `/ingest/v1/events` | **IMPLEMENTED**（S0 为 PLACEHOLDER） | NDJSON 逐行校验 + 幂等 + 内存存储，202/400/413/415（§7.1） |
| GET | `/api/v1/sessions` | **IMPLEMENTED**（S0 为 RESERVED） | 会话列表 + 计数（§7.2） |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED**（S0 为 RESERVED） | 只读分页查询，**不是回放**（§7.2） |
| GET | `/api/v1/sessions/{sessionId}/graph` | RESERVED | 不注册路由 |
| GET | `/api/v1/sessions/{sessionId}/replay` | RESERVED | 不注册路由；回放能力仍为 `false` |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现 |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现 |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S4） |

S1 的写入面只有 `POST /ingest/v1/events` 一个；其余全部只读。不存在 graph/replay/stream/links 路由，
未知路径 404、方法不匹配 405（Boot 默认响应体可接受）。

## 3. S0 已实现端点（S0 历史；S1 现状见 §7）

### 3.1 `GET /actuator/health`（IMPLEMENTED）

```http
GET /actuator/health HTTP/1.1
Host: 127.0.0.1:8601
```

`200 OK`：

```json
{"status":"UP"}
```

- 由 `spring-boot-starter-actuator` 提供；只暴露 `health`，不暴露 env/beans/configprops 等敏感端点。
- 冒烟判定：HTTP 200 且 `status=="UP"`。

### 3.2 `GET /api/v1/meta`（IMPLEMENTED）

> 下列响应示例与表格是 **S0 取值（历史）**；S1 起 `capabilities.ingestEvents=true`，权威定义见 §7.3。

`200 OK`：

```json
{
  "service": "traceboard-collector",
  "version": "0.1.0-SNAPSHOT",
  "apiVersion": "v1",
  "schema": {
    "id": "urn:traceboard:schema:event:v1",
    "version": "traceboard.event.v1",
    "dialect": "2020-12"
  },
  "capabilities": {
    "health": true,
    "meta": true,
    "ingestEvents": false,
    "realtime": false,
    "replay": false
  }
}
```

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `service` | string | 是 | 固定 `traceboard-collector` |
| `version` | string | 是 | 与构建版本一致（S0 为 `0.1.0-SNAPSHOT`） |
| `apiVersion` | string | 是 | `v1` |
| `schema.id` | string | 是 | 固定 URN `urn:traceboard:schema:event:v1` |
| `schema.version` | string | 是 | 固定 `traceboard.event.v1` |
| `schema.dialect` | string | 是 | 固定 `2020-12` |
| `capabilities.health` | boolean | 是 | `true` |
| `capabilities.meta` | boolean | 是 | `true` |
| `capabilities.ingestEvents` | boolean | 是 | S0 为 `false`（历史）；**S1 起为 `true`**（§7.3） |
| `capabilities.realtime` | boolean | 是 | S0/S1 均为 `false` |
| `capabilities.replay` | boolean | 是 | S0/S1 均为 `false` |

- `capabilities` 是“诚实开关”：S0 全部为 `false`；S1 只允许把 `ingestEvents` 置 `true`（ingest 已落地），
  `realtime`/`replay` 仍必须为 `false`。任何未落地的能力不得写成 `true`。

### 3.3 `POST /ingest/v1/events`（PLACEHOLDER · S0 历史；S1 已实现，见 §7.1）

```http
POST /ingest/v1/events HTTP/1.1
Host: 127.0.0.1:8601
Content-Type: application/x-ndjson; charset=utf-8
```

`501 Not Implemented`：

```json
{"error":"not_implemented","message":"ingest is reserved for S1; S0 collector skeleton stores nothing","apiVersion":"v1"}
```

- 无论 body 是否合法，S0 都返回 501（不读取/不保存 body）。
- 202/400/413/415 的完整语义见 `transport.v1.md` §4.2，属 S1 目标，S0 不实现。

## 4. RESERVED 端点（S0 历史 DRAFT；S1 状态见 §2.1/§7）

> 下列形状仅用于冻结方向与命名，**不是 S0 交付物**；S0 代码中不得注册这些路由。
> S1 变更：§4.1 的会话/事件读取已 **IMPLEMENTED**（权威形状见 §7.2，`seq` 改为 `{seq,event}` 包装）；
> `replay`（§4.1 第二段）、§4.2 graph、§4.3 stream/ws、§4.4 links **仍为 RESERVED**，S1 代码不得注册。

### 4.1 会话与事件读取（只读）

> S0 历史草案形状（保留对照）。S1 实际响应见 §7.2：会话条目增加 `lastEventAtMs`，事件页为 `{"seq":n,"event":{...}}`。

```http
GET /api/v1/sessions
→ 200 {"sessions":[{"sessionId":"s_...","startedAtMs":0,"eventCount":0}]}

GET /api/v1/sessions/{sessionId}/events?afterSeq=0&limit=200
→ 200 {"events":[<event-v1>...],"nextSeq":200}
```

- `limit` 1–500，默认 200；`afterSeq` 为追加序号（不是 `spanId`）。
- 只允许 GET；任何写动词 405。事件体原样返回（保留 `status/reason/confidence/flags`）。

```http
GET /api/v1/sessions/{sessionId}/replay?fromNs=0&toNs=1000000000
→ 200 {"mode":"replay","readOnly":true,"events":[<event-v1>...]}
```

- 回放视图只读：不重新执行程序、不发写请求、不触发 SQL；`toNs` 是回放滑块的虚拟时钟上界。
- 响应不得包含凭据/原始敏感值；`redacted/truncated` 标记原样保留。

### 4.2 派生图（只读）

```http
GET /api/v1/sessions/{sessionId}/graph
→ 200 {"nodes":[],"edges":[]}
```

- 图是事件流的派生，不持久化为第二事实源；关联规则/游离区属 S1，本文不定义规则表。

### 4.3 实时推送（SSE / WebSocket）

```http
GET /api/v1/stream?sessionId=s_...     (Accept: text/event-stream)
WS  /ws/v1/events
```

- 形状见 `transport.v1.md` §5；S0 不建立长连接，collector 不推送任何事件。

### 4.4 手工关联（S4 预留）

```http
POST /api/v1/sessions/{sessionId}/links
{"fromSpanId":"...","toSpanId":"...","confidence":"MANUAL"}
```

- 手工关联产生 `MANUAL` 置信度；不得改写原始事件的 `EXACT/INFERRED`。
- S0 不实现，也不提供任何“纠正/合并”写接口。

### 4.5 本节的 S1 迁移摘要（权威见 §7.2）

| 方法 | 路径 | 响应 | 状态 |
|---|---|---|---|
| GET | `/api/v1/sessions` | `200 {"sessions":[{"sessionId":"s_...","eventCount":N,"startedAtMs":E,"lastEventAtMs":E}]}` | S1 **IMPLEMENTED**，只读 |
| GET | `/api/v1/sessions/{sessionId}/events?afterSeq=0&limit=200` | `200 {"events":[{"seq":1,"event":{<event-v1>}}],"nextSeq":1}` | S1 **IMPLEMENTED**，只读分页，**不是回放** |
| GET | `/api/v1/sessions/{sessionId}/replay` | — | 仍 RESERVED（不注册路由，请求 404） |
| GET | `/api/v1/sessions/{sessionId}/graph` | — | 仍 RESERVED |
| GET | `/api/v1/stream`、WS `/ws/v1/events` | — | 仍 RESERVED |
| POST | `/api/v1/sessions/{sessionId}/links` | — | 仍 RESERVED |

## 5. 端口、同源与代理

| 组件 | 端口 | 说明 |
|---|---|---|
| collector | 8601 | 仅 `127.0.0.1`；工作台 S0 不调用（**S1 起**工作台经 Vite 代理 `/ingest`、`/api` 调用） |
| demo 后端 | 8080 | demo 前端通过 Vite proxy `/api` 同源访问 |
| workbench dev | 5173 | S0 只读 fixture；**S1 起**经 Vite 代理 `/ingest`、`/api` → `http://127.0.0.1:8601` |
| demo 前端 dev | 5174 | 固定端口（与 workbench 5173 错开），`strictPort:true` |

- 同源代理优先（主计划 §8.3）：demo 前端只请求相对路径 `/api/...`，由 Vite 代理到 8080；不配置 CORS。
- 端口冲突时先诊断并记录（`netstat -ano | findstr :<port>`），不得静默改端口；确需变更须同步更新本契约。

## 6. S0 冒烟命令（历史；S1 现状见 §7.6）

```bash
curl -s "http://127.0.0.1:8601/actuator/health"
curl -s "http://127.0.0.1:8601/api/v1/meta"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson" --data-binary @fixtures/case-a-zero-rows/events.jsonl
curl -s "http://localhost:8080/api/orders"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
```

期望（**S0 历史**）：`UP` / meta JSON（`capabilities.ingestEvents=false`）/ `501` / demo 订单 JSON / `{"data":true}`。
S1 起同一 ingest 命令返回 `202`（`capabilities.ingestEvents=true`），见 §7.6。
（路径 `fixtures/...` 相对仓库根；Windows 下也可用 `--data-binary @-` 管道。）

## 7. S1 实现（walking skeleton）

> S1 只证明两件事：①**一条假事件从“点击/请求”走到工作台**；②**一个真实插桩的 controller span 能被采集并读回**。
> 不做关联、不做 service/mapper/SQL、不做图/回放/SSE/请求切换。未在此声明的能力一律 RESERVED。

### 7.1 `POST /ingest/v1/events`（IMPLEMENTED）

```http
POST /ingest/v1/events HTTP/1.1
Host: 127.0.0.1:8601
Content-Type: application/x-ndjson; charset=utf-8
```

| 判定顺序 | 状态码 | 条件 | 响应体 |
|---|---|---|---|
| 1 | `415` | `Content-Type` 不是 `application/x-ndjson`（可带 `; charset=utf-8`，大小写不敏感） | 错误信封 `error="unsupported_media_type"` |
| 2 | `413` | body > 4MB，或任一行（去掉行尾 `\n` 的原始字节）> 64KB | 错误信封 `error="payload_too_large"` |
| 3 | `400` | 空/纯空白 body；含空行/纯空白行；行数 > 1000；末行缺 `\n`；body 非 UTF-8；body 含 `\r`（CRLF 不被宽容） | 错误信封 `error="bad_request"` |
| 4 | `202` | 信封合法（可能含逐行拒绝） | 见下 |

`202 Accepted`：

```json
{"accepted":2,"rejected":0,"dropped":0,"errors":[]}
```

| 字段 | 类型 | 语义 |
|---|---|---|
| `accepted` | int | 本次新写入存储的行数（不含 `dropped`） |
| `rejected` | int | 逐行校验失败的行数（JSON 非法或 schema 不通过），**不影响其它行入库** |
| `dropped` | int | 幂等命中（`(sessionId,traceId,spanId)` 已存在，含同批内重复）而跳过的行数 |
| `errors[]` | array | 仅覆盖被拒行；`{"line":i,"code":"invalid_json"\|"schema_violation","message":"..."}` |
| `errors[].line` | int | **1 基**行号 |
| `errors[].message` | string | ≤200 字符；不回显请求原文/敏感值 |

- 不变量：`accepted + rejected + dropped == 非空行数`（信封合法时）。
- 逐行校验使用 `schema/traceboard.event.v1.json`（单一来源，构建期拷入 classpath）；行内不得出现 `seq`（`additionalProperties:false`）。
- 幂等键 `(sessionId,traceId,spanId)`：重复行既不改写已存内容，也不消耗 `seq`。
- 存储为内存 append-only，按接收顺序分配 **每会话从 1 起的连续 `seq`**；无 DB、无文件、无淘汰。
- 不做鉴权、不返回 `Access-Control-*`、不返回 429（背压预留）。

### 7.2 只读查询（IMPLEMENTED；会话查询 ≠ 回放）

```http
GET /api/v1/sessions
→ 200 {"sessions":[{"sessionId":"s_...","eventCount":N,"startedAtMs":E,"lastEventAtMs":E}]}

GET /api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200
→ 200 {"events":[{"seq":1,"event":{<event-v1>}}],"nextSeq":1}
```

**会话列表**（无查询参数）：

| 字段 | 类型 | 语义 |
|---|---|---|
| `sessions[].sessionId` | string | 会话分区键，`^s_[A-Za-z0-9_-]+$` |
| `sessions[].eventCount` | int | 该会话已接收事件数（不含 `dropped`） |
| `sessions[].startedAtMs` | int | 该会话**第一条**被接收事件的 collector 墙钟（Unix 毫秒） |
| `sessions[].lastEventAtMs` | int | 该会话**最后一条**被接收事件的 collector 墙钟（Unix 毫秒） |

- 排序：`startedAtMs` 升序，`startedAtMs` 相同时按 `sessionId` 字典序；空存储返回 `{"sessions":[]}`。
- 只读快照：事件不改序、不改写、不合并；查询不触发采集/回放，也不产生任何副作用。

**事件分页**：

| 参数 | 默认 | 约束 | 非法时 |
|---|---|---|---|
| `afterSeq` | `0` | 整数 `>= 0`；返回 `seq > afterSeq` 的事件 | `400`（负数/非整数/无法解析） |
| `limit` | `200` | 整数 `1..500`（含端点） | `400`（0、负数、`>500`、非整数） |

- 响应 `events[]` 按 `seq` 升序；每条为 `{"seq":<int>,"event":{<event-v1>}}`。
- **`seq` 是传输/存储元数据，位于 `event` 对象之外**：`event` 逐字保留 ingestion 时的内容（仍是合法的 v1 事件，可直接过 schema；ingest 仍拒收带 `seq` 的行）。
- `nextSeq` = 本页最后一条的 `seq`；本页为空时 `= afterSeq`。客户端用 `afterSeq=nextSeq` 续读。
- 未知 `sessionId`（该会话从未接收过任何事件）→ `404` 错误信封 `{"error":"not_found","message":"...","apiVersion":"v1"}`。
- 参数非法 → `400` 错误信封 `error="bad_request"`（不静默截断、不回落默认值）。
- 仅允许 `GET`；`POST/PUT/PATCH/DELETE` → `405`（Boot 默认响应体可接受）。
- 未识别的额外查询参数被忽略（不影响结果）。
- **这不是回放**：不重放执行、不重建图、不提供虚拟时钟；`capabilities.replay` 保持 `false`。存在性校验：`/replay`、`/graph`、`/stream`、`/ws/v1/events`、`/links` 一律 404（路由未注册）。

### 7.3 `GET /api/v1/meta`（IMPLEMENTED，S1 取值）

```json
{
  "service": "traceboard-collector",
  "version": "0.1.0-SNAPSHOT",
  "apiVersion": "v1",
  "schema": {
    "id": "urn:traceboard:schema:event:v1",
    "version": "traceboard.event.v1",
    "dialect": "2020-12"
  },
  "capabilities": {
    "health": true,
    "meta": true,
    "ingestEvents": true,
    "realtime": false,
    "replay": false
  }
}
```

- S1 只允许 `ingestEvents=true`；`realtime`/`replay` 必须为 `false`（SSE/WS/回放均未实现）。
- `service`/`version`/`apiVersion`/`schema` 与 S0 §3.2 相同。

### 7.4 S1 状态码汇总（ingest + 查询）

| 码 | 场景 |
|---|---|
| `200` | 查询成功 |
| `202` | ingest 信封合法（含逐行拒绝/幂等丢弃） |
| `400` | ingest 信封非法；查询参数非法 |
| `404` | 未知 session；未注册的 RESERVED 路由 |
| `405` | 查询端点收到非 GET 方法 |
| `413` | ingest body >4MB 或单行 >64KB |
| `415` | ingest `Content-Type` 不是 `application/x-ndjson` |

错误统一信封（字段语义见 `transport.v1.md` §4.3）：
`{"error":"<code>","message":"<≤200 字符、不含内部路径/凭据>","apiVersion":"v1"}`。

### 7.5 S1 明确未实现（仍 RESERVED）

- `GET .../graph`、`GET .../replay`、`GET /api/v1/stream`（SSE）、`WS /ws/v1/events`、`POST .../links`：代码中不得注册路由。
- 无 CORS、无鉴权 token、无 429 背压、无持久化（重启即清空）、无采样/淘汰。
- 无前后端关联：不存在“把假前端事件与 agent controller span 连线”的接口或字段。
- agent 的 controller span 是**游离后端根**（`parentSpanId=null`、`confidence=LOST`、`rootEventId=click_lost_<spanId>`、flags 含 `LOST_BACKEND`），
  按 `event-model.v1.md` §5 第 2 条例外解释（`transport.v1.md` §4.5 第 8 条）；仍不存在任何关联/合并/推断接口或字段。

### 7.6 S1 冒烟命令

```bash
curl -s "http://127.0.0.1:8601/api/v1/meta"
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson"
curl -s "http://127.0.0.1:8601/api/v1/sessions"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/events"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?limit=501"
```

期望：`ingestEvents=true` / `202 accepted=2`（重发 → `dropped=2`）/ `s_wb_demo` 计数 2 / 2 条 `{seq,event}` 且 `nextSeq=2` /
`405` / `404` / `400`。

## 附录 A：demo 应用 API（非 TraceBoard API，S0 骨架）

| 方法 | 路径 | 响应 | 说明 |
|---|---|---|---|
| GET | `/api/orders` | `200 {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.00}]}` | 内存订单列表；无 DB |
| POST | `/api/orders/1/cancel` | `200 {"data":true}` | 将状态改为 `CANCELLED`；幂等；不产生 SQL/0 行语义 |
| POST | `/api/orders/{id}/cancel`（`id` ≠ 1） | `404 {"data":false}` | 未知订单号的最小约定（见 `s0-plan.md` §13-D13）；无副作用、不产生业务错误协议；demo 前端只调 1 |

- demo 后端是**无缺陷、无采集**的普通 Boot 2.7 应用；0 行案例只存在于 fixture（S2 才在 demo 植入缺陷）。
- 失败分支口径：未知 `id` 返回 `404 {"data":false}`（D13 最小约定，仅供手测）；其它失败分支（未知路径、方法不允许、内部错误）S0 不承诺，保持 Boot 默认 404/405/500 即可，不写业务错误协议。