# HTTP API 契约 v1（api.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23
> 范围：collector HTTP API + demo 应用 API（附录）。S0 只实现 3 个 collector 端点，其余全部 RESERVED。
> 关联：`transport.v1.md`（ingest 线上格式与 202/400/413）、`event-model.v1.md`（事件体）。

## 1. 约定

- Base URL：collector `http://127.0.0.1:8601`；demo 后端 `http://localhost:8080`；workbench dev `http://localhost:5173`；demo 前端 dev `http://localhost:5174`。
- 所有响应 `application/json; charset=utf-8`（SSE 除外，见 §4，预留）；JSON 不接受注释/尾逗号。
- 无外部 CDN、无遥测、无第三方鉴权服务；S0 collector 只监听回环地址，不做 CORS（不返回 `Access-Control-*`）。
- 版本在路径中（`/api/v1/`、`/ingest/v1/`）；事件 schema 版本在 body 中（`traceboard.event.v1`）。
- 错误统一信封（`transport.v1.md` §4.3）：

```json
{"error":"not_implemented","message":"...","apiVersion":"v1"}
```

- 状态图例：**IMPLEMENTED**（S0 必须可验证）、**PLACEHOLDER**（端点存在但固定返回 501）、**RESERVED**（S0 不实现、不得出现在 S0 代码路由中）。

## 2. S0 实现矩阵（唯一权威）

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

## 3. S0 已实现端点

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
| `capabilities.ingestEvents` | boolean | 是 | S0 **必须为 `false`** |
| `capabilities.realtime` | boolean | 是 | S0 必须为 `false` |
| `capabilities.replay` | boolean | 是 | S0 必须为 `false` |

- `capabilities` 是“诚实开关”：S0 不得为 `true`；S1 落地后再改并更新契约。

### 3.3 `POST /ingest/v1/events`（PLACEHOLDER）

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

## 4. RESERVED 端点（DRAFT，S0 不得实现）

> 下列形状仅用于冻结方向与命名，**不是 S0 交付物**；S0 代码中不得注册这些路由。

### 4.1 会话与事件读取（只读）

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

## 5. 端口、同源与代理

| 组件 | 端口 | 说明 |
|---|---|---|
| collector | 8601 | 仅 `127.0.0.1`；工作台 S0 不调用 |
| demo 后端 | 8080 | demo 前端通过 Vite proxy `/api` 同源访问 |
| workbench dev | 5173 | 只读 fixture；不连 collector |
| demo 前端 dev | 5174 | 固定端口（与 workbench 5173 错开），`strictPort:true` |

- 同源代理优先（主计划 §8.3）：demo 前端只请求相对路径 `/api/...`，由 Vite 代理到 8080；不配置 CORS。
- 端口冲突时先诊断并记录（`netstat -ano | findstr :<port>`），不得静默改端口；确需变更须同步更新本契约。

## 6. S0 冒烟命令（Git Bash，路径加引号）

```bash
curl -s "http://127.0.0.1:8601/actuator/health"
curl -s "http://127.0.0.1:8601/api/v1/meta"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson" --data-binary @fixtures/case-a-zero-rows/events.jsonl
curl -s "http://localhost:8080/api/orders"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
```

期望：`UP` / meta JSON（`capabilities.ingestEvents=false`）/ `501` / demo 订单 JSON / `{"data":true}`。
（路径 `fixtures/...` 相对仓库根；Windows 下也可用 `--data-binary @-` 管道。）

## 附录 A：demo 应用 API（非 TraceBoard API，S0 骨架）

| 方法 | 路径 | 响应 | 说明 |
|---|---|---|---|
| GET | `/api/orders` | `200 {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.00}]}` | 内存订单列表；无 DB |
| POST | `/api/orders/1/cancel` | `200 {"data":true}` | 将状态改为 `CANCELLED`；幂等；不产生 SQL/0 行语义 |
| POST | `/api/orders/{id}/cancel`（`id` ≠ 1） | `404 {"data":false}` | 未知订单号的最小约定（见 `s0-plan.md` §13-D13）；无副作用、不产生业务错误协议；demo 前端只调 1 |

- demo 后端是**无缺陷、无采集**的普通 Boot 2.7 应用；0 行案例只存在于 fixture（S2 才在 demo 植入缺陷）。
- 失败分支口径：未知 `id` 返回 `404 {"data":false}`（D13 最小约定，仅供手测）；其它失败分支（未知路径、方法不允许、内部错误）S0 不承诺，保持 Boot 默认 404/405/500 即可，不写业务错误协议。