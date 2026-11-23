# HTTP API 契约 v1（api.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23（S2 增补：2026-11-24；S3 增补：2026-11-24）
> 变更记录：**2026-11-23 S1 增补**——ingest 与两个只读查询转为 IMPLEMENTED，meta `capabilities.ingestEvents=true`；
>   S0 的矩阵/端点章节按原样保留为历史（§2、§3、§4、§6），S1 当时权威定义在 **§7**。graph/replay/stream/links 当时仍为 RESERVED。
>   **2026-11-23 G1 第 1 轮**：§7.5 补一句“agent controller span 为游离后端根”，指向 `event-model.v1.md` §5 第 2 条例外（仅文档）。
>   **2026-11-24 S2 增补**：新增 `GET .../requests` 与 `GET .../graph?traceId=` 两个**只读派生**查询为 IMPLEMENTED（§2.2 矩阵、§8 定义）；
>   `replay`/`stream`/`ws`/`links` **仍为 RESERVED**（不注册路由）。meta `capabilities` 5 键**不变**（`ingestEvents=true`、`realtime=false`、`replay=false`）。
>   demo 后端植入 0 行缺陷（H2+MyBatis），行为见**附录 B**；附录 A 保留 S0 历史。§2.1/§7 保留为 S1 历史。
>   **2026-11-24 S3 增补**：`GET .../replay?fromNs=&toNs=` 由 RESERVED 转为 **IMPLEMENTED（只读窗口，0 写）**；`requests` 追加
>   `sdkActive` 与每条 `fetchCount/hasFrontend/hasBackend/backendSpanCount` 及派生 `confidence` 规则；`graph` 形状不变但自然包含前端节点
>   （click 根 + `controller.parentSpanId=fetch.spanId`）；meta `capabilities.replay=true`（键仍 5 个）。新增 §2.3 当前矩阵、§9 S3 定义、
>   附录 C 案例 B（纯前端校验，零 fetch）；附录 A/B 与 §2/§2.1/§2.2/§7/§8 保留为 S0–S2 历史，不改写。
>   **2026-11-24 S3 G1 前补丁（时钟模型，形状/字段/状态码不变）**：S3 单机 `startNs` 为 epoch 纳秒（公式见 `event-model.v1.md` §12.10）；
>   `replay` 的 `fromNs/toNs` 与 `requests.startedAtNs/durNs` 都是**原始 epoch-ns**，collector 不转换；客户端仅显示时归一化
>   `relNs = startNs − minStartNs`（选中 trace/会话），请求仍发原始值；fixture 中的秒级数值仅示意。
> 范围：collector HTTP API + demo 应用 API（附录）。**S3 的写入面仍只有 `POST /ingest/v1/events`**，其余 collector 端点全部只读。
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
  **S2 起**：另有 `GET /api/v1/sessions/{sessionId}/requests`、`GET /api/v1/sessions/{sessionId}/graph?traceId=` 转为 IMPLEMENTED（§8）；
  **S3 起**：`GET /api/v1/sessions/{sessionId}/replay?fromNs=&toNs=` 转为 IMPLEMENTED（§9.1），`requests` 扩展（§9.2），
  `stream`/`ws`/`links` 仍为 RESERVED（S3 代码同样不得注册这些路由）。

## 2. S0 实现矩阵（S0 历史，冻结，不改写）

> S1 起 ingest 与两个查询已实现；**S3 当前权威矩阵见 §2.3**（§2.1/§2.2 为历史）。本节保留 S0 原始状态作为历史记录。

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

### 2.1 S1 实现矩阵（S1 当时权威；S2 见 §2.2、S3 起以 §2.3 为准）

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

### 2.2 S2 实现矩阵（S2 当时权威；S3 起以 §2.3 为准）

| 方法 | 路径 | S2 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 5 键与 S1 完全相同（`ingestEvents=true`，`realtime=false`，`replay=false`；§8.3） |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 与 S1 完全一致，无改动（§7.1、`transport.v1.md` §4.5） |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变（§7.2） |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变，只读分页，**不是回放**（§7.2） |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED**（S2 新增） | 按 trace 分组的请求摘要，读时派生，只读（§8.1） |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED**（S2 由 RESERVED 转正） | 单 trace 的节点/边派生视图，只读（§8.2） |
| GET | `/api/v1/sessions/{sessionId}/replay` | RESERVED | 不注册路由；`capabilities.replay` 仍为 `false` |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现 |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现 |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S4） |

- S2 的写入面仍只有 `POST /ingest/v1/events`；requests/graph 是**读时派生**，不落 DB/文件、不缓存、不改写事件、不消耗 `seq`。
- **查询 ≠ 回放**：requests/graph 不重新执行程序、不发 HTTP 写请求、不触发 SQL、不提供虚拟时钟；`capabilities.replay` 保持 `false`。
- 未注册路径 404、方法不匹配 405（Boot 默认响应体可接受）；错误信封见 `transport.v1.md` §4.3。

### 2.3 S3 实现矩阵（当前权威；S0–S2 矩阵保留为历史）

| 方法 | 路径 | S3 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 仍 5 键：`health=true`、`meta=true`、`ingestEvents=true`、`realtime=false`、**`replay=true`**（§9.5） |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 与 S1/S2 完全一致，无改动；仍是唯一写通路 |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变，只读分页，**不是回放**（§7.2） |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED** | S2 字段全部保留，追加 `sdkActive` 与 4 个每请求字段；派生 `confidence`（§9.2） |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED** | 形状与 §8.2 完全相同；节点自然混合前端/后端，click 根 + `controller.parentSpanId=fetch.spanId`（§9.4） |
| GET | `/api/v1/sessions/{sessionId}/replay?fromNs=<int>&toNs=<int>` | **IMPLEMENTED**（S3 新增） | 只读窗口；0 写、不消耗 `seq`、不调 demo、不执行程序（§9.1） |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现（404） |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现（404） |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S4，404） |

- S3 的写入面仍只有 `POST /ingest/v1/events`；requests/graph/replay 都是**读时派生**，不落 DB/文件、不缓存、不改写事件、不消耗 `seq`。
- 路由数 = S1/S2 六条 + `replay`，共 **7 条**；`stream`/`ws`/`links` 不得出现路径字符串。
- **回放 ≠ 实时**：replay 是“已存事件的只读时间窗视图”，不是 SSE/WS、不重跑、不重发请求；`capabilities.realtime` 仍为 `false`。
- 未注册路径 404、方法不匹配 405；错误信封见 `transport.v1.md` §4.3。

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
- **S3 起已实现**：权威形状/参数/排序/0 写见 §9.1（含 `fromNs`/`toNs` 生效值回显）；本节保留 S0 DRAFT 历史。

### 4.2 派生图（只读）

> S0 历史草案（保留对照）。**S2 起 graph 已 IMPLEMENTED**：`traceId` 必填、响应增加 `sessionId/rootEventId/confidence`、
> 节点字段固定，权威定义见 **§8.2**；本节示例不作为实现依据。

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

> S2 变更：上表 `graph` 行已由 RESERVED 转为 **IMPLEMENTED**（`GET .../graph?traceId=`，§8.2），并新增 `GET .../requests`（§8.1）；
> 上表其余 RESERVED 行在 S2 仍不注册路由。
> S3 变更：上表 `replay` 行已由 RESERVED 转为 **IMPLEMENTED**（`GET .../replay?fromNs=&toNs=`，§9.1）；`stream`/`ws`/`links` 仍不注册。

## 5. 端口、同源与代理

| 组件 | 端口 | 说明 |
|---|---|---|
| collector | 8601 | 仅 `127.0.0.1`；工作台 S0 不调用（**S1 起**工作台经 Vite 代理 `/ingest`、`/api` 调用） |
| demo 后端 | 8080 | demo 前端通过 Vite proxy `/api` 同源访问 |
| workbench dev | 5173 | S0 只读 fixture；**S1 起**经 Vite 代理 `/ingest`、`/api` → `http://127.0.0.1:8601` |
| demo 前端 dev | 5174 | 固定端口（与 workbench 5173 错开），`strictPort:true` |

- 同源代理优先（主计划 §8.3）：demo 前端只请求相对路径 `/api/...`，由 Vite 代理到 8080；不配置 CORS。
- **S3**：demo 前端另有 `/ingest` → `http://127.0.0.1:8601` 的 Vite 代理（dev + preview），runtime SDK 把 NDJSON 发到
  `/ingest/v1/events`；`/api` 仍 → 8080。workbench 仍经 `/api` 读 collector。无新端口、无 CORS。
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

## 8. S2 实现（0 行事实链的只读派生；S3 当前见 §9）

> S2 只新增两个**只读**查询：`requests`（按 trace 分组）与 `graph`（单 trace 节点/边）。二者都是**读时派生**：
> 输入是内存 append-only 事件流，输出不改写、不持久化、不缓存、不消耗 `seq`，两次相同 GET 结果一致。
> S2 **不是**回放、**不是**实时推送；`replay`/`stream`/`ws`/`links` 仍 RESERVED（路由不存在）。
> 本节的 `requests`/`graph` 形状以本文件为准；`fixtures/s2-zero-row-chain/**` 是唯一的离线样例。

### 8.1 `GET /api/v1/sessions/{sessionId}/requests`（IMPLEMENTED，只读）

```http
GET /api/v1/sessions/s_s2agent/requests HTTP/1.1
Host: 127.0.0.1:8601
```

`200 OK`：

```json
{"sessionId":"s_s2agent","requests":[
  {"traceId":"9f8e7d6c5b4a39281706f5e4d3c2b1a0","rootSpanId":"1a2b3c4d5e6f7a80","rootKind":"controller",
   "nodeKey":"com.example.shop.controller.OrderController#cancel","status":"OK","confidence":"LOST",
   "spanCount":4,"startedAtNs":1000000000,"durNs":8000000,"hasError":false}]}
```

| 字段 | 类型 | 语义 |
|---|---|---|
| `sessionId` | string | 路径参数的逐字回显（回显用于客户端断言，不参与分组） |
| `requests[].traceId` | string | 分组键，`^[0-9a-f]{32}$` |
| `requests[].rootSpanId` | string \| null | 该 trace 中 `parentSpanId=null` 的 span；无根时 `null`（诚实缺口） |
| `requests[].rootKind` | string \| null | 根 span 的 `kind`；无根时 `null` |
| `requests[].nodeKey` | string \| null | 根 span 的 `nodeKey`；无根时 `null` |
| `requests[].status` | string | 该 trace **聚合最严重级**（见下）；无根时仍按全部 span 聚合 |
| `requests[].confidence` | string | 根 span 的 `confidence`；**无根时固定 `"LOST"`**（不伪造 `EXACT`） |
| `requests[].spanCount` | int | 该 trace 已存储事件数（ingest 幂等之后的真实条数，≥1） |
| `requests[].startedAtNs` | int | 该 trace 的最小 `startNs`（原始值；S3 起为 epoch-ns，S2/fixture 的相对值仅示意） |
| `requests[].durNs` | int | `max(startNs+durNs) − min(startNs)`，`≥0`；根存在且区间包含成立时等于根 `durNs` |
| `requests[].hasError` | boolean | 该 trace 是否存在 `status="THREW"` 的 span |

- **聚合优先级**（最严重优先）：`THREW > UNKNOWN > NOT_COLLECTED_POLICY > NOT_COLLECTED_LOST > NOT_COLLECTED_NO_DEBUG_INFO > TRUNCATED > RETURNED_FALSE > OK`。
- **多根/无根的确定性**：一个 trace 出现多个 `parentSpanId=null` 的 span 时（S2 ingest 不拒绝，属上游数据异常），
  取 `startNs` 最小者；同值时取 `spanId` 字典序最小者；不合并、不推断。**无根的 trace 仍然列出**（`root*`/`nodeKey` 为 `null`、`confidence="LOST"`），
  不静默丢弃；S2 运行时 agent 总会写游离后端根（`kind=controller` + `LOST`），无根只可能是手工/异常数据。
- **排序**：`startedAtNs` 升序；同值时 `traceId` 字典序。空会话返回 `{"sessionId":"...","requests":[]}`。
- **无分页**（S2）；不提供 `afterSeq`/`limit` 参数，未识别的额外查询参数被忽略。
- 只允许 `GET`；`POST/PUT/PATCH/DELETE` → `405`；未知 `sessionId` → `404` 错误信封 `{"error":"not_found",...}`。
- 字段对照：dispatch §4.3 的示例列 7 个字段；本节**增加** `sessionId`（顶层）、`durNs`、`hasError`（均为只读派生，不改变 dispatch 语义），见 `s2-plan.md` 偏离 D1。

### 8.2 `GET /api/v1/sessions/{sessionId}/graph?traceId=<32hex>`（IMPLEMENTED，只读）

```http
GET /api/v1/sessions/s_s2agent/graph?traceId=9f8e7d6c5b4a39281706f5e4d3c2b1a0 HTTP/1.1
Host: 127.0.0.1:8601
```

`200 OK`：

```json
{"sessionId":"s_s2agent","traceId":"9f8e7d6c5b4a39281706f5e4d3c2b1a0",
 "rootEventId":"click_lost_1a2b3c4d5e6f7a80","confidence":"LOST",
 "nodes":[
  {"spanId":"1a2b3c4d5e6f7a80","parentSpanId":null,"kind":"controller",
   "nodeKey":"com.example.shop.controller.OrderController#cancel","status":"OK",
   "return":{"type":"org.springframework.http.ResponseEntity","value":200},"sideEffects":[],
   "startNs":1000000000,"durNs":8000000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},
   "flags":["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]},
  {"spanId":"2b3c4d5e6f7a8091","parentSpanId":"1a2b3c4d5e6f7a80","kind":"service",
   "nodeKey":"com.example.shop.service.OrderService#cancel","status":"OK",
   "return":{"type":"boolean","value":true},"sideEffects":[],
   "startNs":1001000000,"durNs":6500000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},
   "flags":["S2_ZERO_ROW_CHAIN"]},
  {"spanId":"3c4d5e6f7a8091a2","parentSpanId":"2b3c4d5e6f7a8091","kind":"mapper",
   "nodeKey":"com.example.shop.mapper.OrderMapper#cancelById","status":"OK",
   "return":{"type":"int","value":0},"sideEffects":[],
   "startNs":1002000000,"durNs":5000000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},
   "flags":["S2_ZERO_ROW_CHAIN"]},
  {"spanId":"4d5e6f7a8091a2b3","parentSpanId":"3c4d5e6f7a8091a2","kind":"sql",
   "nodeKey":"OrderMapper.cancelById","status":"OK","return":null,
   "sideEffects":[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":0,"transaction":"UNKNOWN"}],
   "startNs":1003000000,"durNs":3000000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},
   "flags":["S2_ZERO_ROW_CHAIN"]}],
 "edges":[{"from":"1a2b3c4d5e6f7a80","to":"2b3c4d5e6f7a8091","count":1},
          {"from":"2b3c4d5e6f7a8091","to":"3c4d5e6f7a8091a2","count":1},
          {"from":"3c4d5e6f7a8091a2","to":"4d5e6f7a8091a2b3","count":1}]}
```

**顶层字段**

| 字段 | 类型 | 语义 |
|---|---|---|
| `sessionId` | string | 路径参数回显 |
| `traceId` | string | 请求参数回显（`^[0-9a-f]{32}$`） |
| `rootEventId` | string \| null | 根 span 的 `rootEventId`（S2 为 `click_lost_<根spanId>`）；无根时 `null` |
| `confidence` | string | 根 span 的 `confidence`；无根时固定 `"LOST"` |

**`nodes[]`（每条固定 11 个字段，字段恒出现）**

| 字段 | 类型 | 语义 |
|---|---|---|
| `spanId` | string | 事件 `spanId`（16 hex，trace 内唯一） |
| `parentSpanId` | string \| null | 事件 `parentSpanId` 原样（根为 `null`） |
| `kind` | string | 事件 `kind` 原样（S2 链为 `controller/service/mapper/sql`） |
| `nodeKey` | string | 事件 `nodeKey` 原样（不做 `class#method(descriptor)` 归一） |
| `status` | string | 事件 `status` 原样（**不**聚合到节点；`OK` 含 0/false 返回值） |
| `return` | object \| null | 事件 `return` 原样（无则 `null`；不补默认值） |
| `sideEffects` | array | 事件 `sideEffects` 原样；事件无该字段时为 `[]`（不推断） |
| `startNs` | int | 原样 |
| `durNs` | int | 原样 |
| `thread` | object \| null | 事件 `thread` 原样；事件无该字段时为 `null`（不伪造线程） |
| `flags` | array\<string\> | 事件 `flags` 原样；事件无该字段时为 `[]` |

**`edges[]`**

| 字段 | 类型 | 语义 |
|---|---|---|
| `from` | string | 父 `spanId` |
| `to` | string | 子 `spanId` |
| `count` | int | 同一 `(from,to)` 对的出现次数；**S2 恒为 1**（`spanId` 唯一、父子对唯一） |

- 命名对照：`from` = 父 `spanId`，`to` = 子 `spanId`；dispatch §4.4 草案曾用 `parentSpanId`/`childSpanId` 命名，本节为 S2 权威（见 `s2-plan.md` 偏离 D2）。
- **不聚合**：S2 一个 span 一个节点，同一方法执行 N 次会出现 N 个同 `nodeKey` 节点（×N 聚合/`count`>1 属后续检查点，S2 不实现也不暗示）。
- **排序**：`nodes` 按 `startNs` 升序，同值按 `spanId` 字典序；`edges` 按父节点在 `nodes` 中的位置排序，父相同再按子节点位置。
- 父 `spanId` 不在本 trace 内：该节点**照常列出**（诚实缺口），只是**不产生边**；不补节点、不猜父。
- **派生一致**：事件快照不变时，两次相同 GET 的响应逐字一致；事件数/`seq`/存储不被修改（无缓存、无写入、无重排存储）。
- 未识别的额外查询参数被忽略。

**参数与错误**

| 判定顺序 | 状态码 | 条件 | 响应体 |
|---|---|---|---|
| 1 | `400` | `traceId` 缺失、空、或不符合 `^[0-9a-f]{32}$`（含大写/长度错/非 hex） | 错误信封 `error="bad_request"` |
| 2 | `404` | `sessionId` 从未接收过事件 | 错误信封 `error="not_found"` |
| 3 | `404` | 会话存在但其中无该 `traceId` | 错误信封 `error="not_found"` |
| 4 | `200` | 命中 | 上述形状 |

- 只允许 `GET`；写动词 → `405`（Boot 默认响应体可接受）；不静默回落默认 `traceId`、不返回空图冒充命中。
- S2 **不注册** `/replay`、`/stream`、`/ws/v1/events`、`/links`（请求 404）；graph 不是回放：不重放执行、不重建前端链、不提供虚拟时钟。

### 8.3 `GET /api/v1/meta`（S2 取值：与 S1 完全相同）

```json
{"service":"traceboard-collector","version":"0.1.0-SNAPSHOT","apiVersion":"v1",
 "schema":{"id":"urn:traceboard:schema:event:v1","version":"traceboard.event.v1","dialect":"2020-12"},
 "capabilities":{"health":true,"meta":true,"ingestEvents":true,"realtime":false,"replay":false}}
```

- S2 **不新增能力键**、不改 5 键取值：requests/graph 是只读查询能力，不是 `realtime`/`replay` 能力。
- `ingestEvents=true` 仍表示“ingest 已落地”；`realtime=false`/`replay=false` 必须保持（无 SSE/WS/回放）。
- **S3 起**：`replay=true`（只读窗口已实现），`realtime` 仍 `false`，键仍 5 个；见 §9.5。

### 8.4 S2 状态码汇总（新增部分；ingest 的 202/400/413/415 见 §7.4，不变）

| 码 | 场景（S2） |
|---|---|
| `200` | requests/graph 派生成功 |
| `400` | graph 缺失/非法 `traceId` |
| `404` | 未知 session（requests/graph）；session 内无该 trace（graph）；未注册的 RESERVED 路由 |
| `405` | requests/graph 收到非 GET 方法 |

错误信封（`transport.v1.md` §4.3）：`{"error":"<code>","message":"<≤200 字符、不含内部路径/凭据>","apiVersion":"v1"}`。

### 8.5 S2 明确未实现（仍 RESERVED / 不在 S2 范围）

- `GET .../replay`、`GET /api/v1/stream`（SSE）、`WS /ws/v1/events`、`POST .../links`：代码中不得注册路由；`capabilities.replay/realtime=false`。
- 无实时订阅/长连接/服务端推送；工作台只用“手动刷新 + 低频轮询”（非实时）。
- 无 ×N 聚合、无节点合并、无调用次数详情；`edges.count` 在 S2 恒 1。
- 无 `values[]`/字段 diff/参数值/异常 payload/栈；无前端 SDK/`traceparent`/clickId 传播/关联引擎（链是 `confidence=LOST` 的游离后端请求）。
- 无 CORS/鉴权/429/持久化/缓存/淘汰/采样；collector 重启即清空。
- demo 的 0 行是**真实 H2 SQL 事实**（附录 B），不是本 API 计算出来的结论；API 只回放已采集事实。

### 8.6 S2 冒烟命令

```bash
curl -s "http://127.0.0.1:8601/api/v1/meta"
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s2-zero-row-chain/events.ndjson"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=9f8e7d6c5b4a39281706f5e4d3c2b1a0"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/requests"                                   # 404
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph"                                          # 400
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=00000000000000000000000000000000"  # 404
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"                               # 405
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/replay"                                         # 404（未注册）
```

期望：capabilities 5 键不变 / `202 accepted=4`（重发 → `dropped=4`）/ requests 1 条 `spanCount=4`、`status=OK`、`confidence=LOST` /
graph 4 节点 3 边（按 `startNs` 排序、`return`/`sideEffects` 原样）/ `404` / `400` / `404` / `405` / `404`。

## 9. S3 实现（前端事实 + 只读回放）

> S3 只证明：①浏览器 runtime SDK 的点击/控件/请求/DOM 事件能进入事件流；②案例 A 通过 `traceparent` + `X-TraceBoard-Click`
> 与后端 4 span **EXACT** 关联；③案例 B 的纯前端校验在观察窗关闭后 `fetchCount=0`，可**确认没发请求**；④已存事件可被
> `replay` 只读回放，回放 **0 写**。S3 **不是** S4：无启动器/IDEA/JAR 接入、无 sourcemap/构建插件、无 L2/局部变量、无像素回放/SSE/WS/持久化。
> 本节是 S3 当前权威；§8 的 S2 取值保留为历史。
>
> **时钟（S3 单机 epoch-ns）**：事件 `startNs` 与本节所有 `Ns` 字段/参数都是原始 epoch-ns（SDK `round((performance.timeOrigin+performance.now())*1e6)`；
> agent `System.currentTimeMillis()*1e6+(System.nanoTime()%1e6)`，见 `event-model.v1.md` §12.10）。**API 不做归一化**；工作台仅在显示时用
> `relNs = startNs − minStartNs`（选中 trace/会话）算标签/刻度，调用 `fromNs/toNs` 前换算回原始值。fixture 的 1.0s/2.0s 等数值仅示意，不得假定与运行时绝对相等。

### 9.1 `GET /api/v1/sessions/{sessionId}/replay?fromNs=<int>&toNs=<int>`（IMPLEMENTED，只读）

```http
GET /api/v1/sessions/s_s3demo/replay?fromNs=0&toNs=1034500000 HTTP/1.1
Host: 127.0.0.1:8601
```

`200 OK`（**精确形状**；字段顺序固定，`events[]` 可空）：

```json
{"mode":"replay","readOnly":true,"sessionId":"s_s3demo","fromNs":0,"toNs":1034500000,
 "events":[{"seq":1,"event":{"schema":"traceboard.event.v1","type":"span","sessionId":"s_s3demo","traceId":"1f2e3d4c5b6a79880a1b2c3d4e5f6071","spanId":"1000000000000001","parentSpanId":null,"rootEventId":"click_a1b2c3d4e5f60718","kind":"ui_event","nodeKey":"#btn-cancel","thread":{"id":0,"name":"browser-main"},"startNs":1000000000,"durNs":38000000,"status":"OK","return":null,"confidence":"EXACT","flags":["SDK_ACTIVE","S3_RUNTIME_SDK","OBSERVE_MS=1500"]}}]}
```

> 示例为节选（只展开 1 条事件）；`toNs=1034500000` 的实际窗口为 6 条（render 于 1035000000 起，尚未发生），完整期望见
> `fixtures/s3-frontend-facts/case-a-joined-chain/expected-facts.json` 的 `replayWindows`。

| 字段 | 类型 | 语义 |
|---|---|---|
| `mode` | string | 固定 `"replay"`（契约字段；客户端不得据此发写请求） |
| `readOnly` | boolean | 固定 `true`（契约字段） |
| `sessionId` | string | 路径参数逐字回显 |
| `fromNs` | int | **生效值**（缺省补 0 后回显） |
| `toNs` | int | **生效值**（缺省补默认值后回显；请求值大于会话最大值时仍回显请求值） |
| `events` | array | 窗口内事件，按 `startNs` 升序、同值 `spanId` 字典序；元素为 `{"seq":<int>,"event":{<event-v1>}}` |

**参数**

| 参数 | 默认 | 约束 | 非法时 |
|---|---|---|---|
| `fromNs` | `0` | 匹配 `^[0-9]+$`、可解析为 64 位有符号整数、`>= 0`；**原始 epoch-ns（S3 单机）** | `400` 错误信封 `error="bad_request"` |
| `toNs` | 会话内 `max(startNs+durNs)`；空会话 / 无事件为 `0` | 同上；**原始 epoch-ns（S3 单机）** | `400` 错误信封 `error="bad_request"` |

- **判定顺序固定**：①参数格式/范围/`fromNs<=toNs` 失败 → `400`；②未知 session（从未接收过任何事件）→ `404 not_found`；
  ③命中 → `200`（窗口为空也返回 `200` + `events:[]`，不返回 404）。
- 负号、小数点、空串、前后空格、科学计数法、超过 64 位范围都按 `400` 处理；不静默截断、不回落默认值。
- **原始值口径**：`fromNs`/`toNs` 与事件 `startNs` 同为 epoch-ns，API 不接收“相对秒/相对纳秒”语义、不做归一化。
  客户端若按相对时间展示（`relNs = startNs − minStartNs`），只转换标签/刻度，请求参数仍必须换算回原始 epoch-ns。
- 过滤条件为 **`fromNs <= startNs <= toNs`**（两端包含，按事件 **`startNs`** 判断，不看 `startNs+durNs`）。
- 排序：`startNs` 升序；同 `startNs` 按 `spanId` 字典序。`seq` 保持存储原值，**不重新编号**。
- `events[].event` 与 `/events` 的 `event` 相同：逐字来自 ingest 的已存 JSON、仍是合法 v1 事件；`seq` 在 `event` 之外。
- 只允许 `GET`；`POST/PUT/PATCH/DELETE` → `405`（Boot 默认响应体可接受）。未识别的额外查询参数被忽略。
- 无分页、无 `limit`/`afterSeq`、无 `nextSeq`；不提供 SSE/WS/长连接。

**只读（0 写）语义（硬约束）**

1. 读时派生自内存快照：不写事件、不追加存储、不消耗 `seq`、不改写/重排事件、不缓存、不落 DB/文件。
2. 不重新执行程序、不调用 demo 后端、不发 HTTP 写请求、不触发 SQL、不建立派生图、不提供服务器端播放引擎。
3. 两次相同 GET 的响应逐字一致；回放前后 `sessions`/`events`/`seq`、demo H2 订单状态（仍 `CREATED`）与事件数不变，回放期间 0 新事件。
4. `mode`/`readOnly` 只是契约字段，不授权任何写操作；工作台时间轴只是客户端按 `toNs` 隐藏未来事件。
5. 回放保留 `confidence`/`reason`/`redacted`/`truncated` 原值，不改写成 `EXACT`。

### 9.2 `GET /api/v1/sessions/{sessionId}/requests`（S3 扩展，只读）

```json
{"sessionId":"s_s3demo","sdkActive":true,"requests":[
 {"traceId":"1f2e3d4c5b6a79880a1b2c3d4e5f6071","rootSpanId":"1000000000000001","rootKind":"ui_event",
  "nodeKey":"#btn-cancel","status":"OK","confidence":"EXACT","spanCount":7,"startedAtNs":1000000000,
  "durNs":38000000,"hasError":false,"fetchCount":1,"hasFrontend":true,"hasBackend":true,"backendSpanCount":4},
 {"traceId":"3a4b5c6d7e8f90a1b2c3d4e5f6071829","rootSpanId":"8000000000000008","rootKind":"ui_event",
  "nodeKey":"#btn-save-b","status":"RETURNED_FALSE","confidence":"EXACT","spanCount":3,"startedAtNs":2000000000,
  "durNs":4000000,"hasError":false,"fetchCount":0,"hasFrontend":true,"hasBackend":false,"backendSpanCount":0}]}
```

- **S2 字段全部保留、含义不变**（`traceId/rootSpanId/rootKind/nodeKey/status/confidence/spanCount/startedAtNs/durNs/hasError`），
  新字段**追加**，不重命名、不去字段。
- `sdkActive`（顶层，会话级）：会话内存在 `kind="ui_event"` 且 `flags` 含 `SDK_ACTIVE` 的事件时为 `true`；否则 `false`。
  它回答“前端 runtime SDK 是否在线并产生过 click 根”，不是“本请求是否前端发起”。
- `fetchCount`：该 trace 中 `kind="fetch"` 的事件数（0 表示本次点击因果链内没有 fetch/XHR）。
- `hasFrontend`：存在 `ui_event`/`js_method`/`fetch`/`callback`/`render` 任一。
- `hasBackend`：存在 `controller`/`service`/`mapper`/`sql`/`jdbc`/`async` 任一。
- `backendSpanCount`：上述后端 kind 的事件条数；`hasBackend=false` 时恒为 0。
- `status` 聚合优先级不变（S2）：`THREW > UNKNOWN > NOT_COLLECTED_POLICY > NOT_COLLECTED_LOST > NOT_COLLECTED_NO_DEBUG_INFO >
  TRUNCATED > RETURNED_FALSE > OK`。案例 B 因此为 `RETURNED_FALSE`。

**`confidence` 派生（S3 起优先于 S2“直接取根 span”）**

| 条件 | `confidence` |
|---|---|
| 根为 `ui_event` 且 `confidence=EXACT`，且 `fetchCount=0` | `EXACT`（案例 B：没有可关联的请求） |
| 根为 `ui_event` 且 `confidence=EXACT`，且存在 `controller.parentSpanId` 等于本 trace 某 `fetch.spanId` | `EXACT`（案例 A：`traceparent` 关联成功） |
| 根为 `ui_event` 且 `confidence=EXACT`，`fetchCount>0` 但没有任何上述 controller 关联 | `LOST`（前端发了、后端没记录/失败，进入游离） |
| 根为后端游离根（`controller` 等，`parentSpanId=null`）或无根 | `LOST`（S2 行为不变） |
| 根为 `ui_event` 但根 `confidence` 不是 `EXACT`（手工/异常数据） | 沿用根 `confidence`；`null` 视作 `LOST` |

- **未关联的单个 fetch 不降级整链**：案例 A 成功后 demo 刷新列表产生的 `GET /api/orders`（若有）只在该 fetch 节点标“后端未采集”，
  只要 POST fetch 与 controller 精确相连，整条 trace 仍为 `EXACT`。
- 示例中的 `spanCount=7`/`fetchCount=1` 是 fixture 值；运行时案例 A 若同一 click 窗口还捕获了刷新 `GET /api/orders`，`spanCount`/`fetchCount` 会更大，但“POST fetch ↔ controller”关联与其余字段规则不变。
- `startedAtNs`/`durNs` 是事件原始值：S3 运行为 epoch-ns（`startedAtNs` 即该 trace 最小 `startNs`），fixture 的 `1000000000`/`2000000000` 仅示意。
  排序仍按 `startedAtNs` 升序，不受显示归一化影响；客户端展示相对时间时减去所选会话/该 trace 的 `minStartNs`，不得假定与 fixture 数值相等。
- `sdkActive=false` 时，UI 对任何 trace 都不得宣称“已确认没发请求”（见 §9.3）。
- 排序、未知 session `404`、无分页、只读、空列表形状均按 S2 §8.1；S3 不新增空会话记录：未知 session 仍是 `404`，
  已存在的空会话（本 collector 不会产生）才返回 `{"sessionId":"...","sdkActive":false,"requests":[]}`。

### 9.3 案例 B 判定（工作台规则；API 只提供事实）

| 证据组合 | 判定 | 界面文案（逐字） |
|---|---|---|
| `sdkActive=true` 且该 trace 根为 `ui_event`、`fetchCount=0` 且 `hasBackend=false`，click 根已入库且 flags 含 `OBSERVE_MS`（观察窗已关闭） | 确认没发（观察窗已关闭） | `已确认：本次点击因果链内没有网络请求` |
| 会话 `sdkActive=false`（SDK 未接入/无 click 根） | 无法确认 | `无法确认：前端采集未接入` |
| `fetchCount>0` 且 `hasBackend=false`（含 fetch 失败节点） | 发了但后端没记录/请求失败 | `前端已发请求但后端未采集（LOST）`；失败 fetch 节点单独标失败，不并入“没发” |
| `fetchCount>0` 且存在关联的后端 | 关联成功 | 展示混合事实链，不写“没发请求” |

- “确认没发”的三个必要条件缺一不可；`confidence=LOST` 不是状态，不得用 `status=LOST` 表达；`OK` 中的 `false` 不是异常。
- 失败请求（CORS/断网/4xx/5xx）必须显示失败 fetch 节点，**不得**与“没发”混为一谈。
- 案例 B 的 `validateForm` 节点详情只显示：控件身份、返回值 `false`、DOM 效果文本、事实
  `JS 内部变量本次未采集（无构建插件/sourcemap）`；**不显示**行号/局部变量/源码片段（S5）。
- 状态图例（颜色+文字，不靠颜色单独传达）：`OK` 常规/绿线；`RETURNED_FALSE` 琥珀“正常返回 false”；`THREW` 红/断线；
  `NOT_COLLECTED_*` 灰虚线 + `reason`；`TRUNCATED` 条纹“已截断/已折叠”；`REDACTED` 锁形（S3 fixture 不使用但 UI 必须支持）；
  `UNKNOWN` 问号；`confidence=LOST` 游离标注；`MANUAL` 虚线（S3 不产生）。

### 9.4 `GET /api/v1/sessions/{sessionId}/graph?traceId=<32hex>`（S3 语义补充）

- 形状、11 个节点字段、`edges[{from,to,count}]`、排序、400/404/405、只读与两次一致**全部沿用 §8.2**，S3 **不新增字段**、不改形状。
- 节点自然混合前端与后端：案例 A 的根是 `ui_event`（`parentSpanId=null`、`confidence=EXACT`），`fetch` 挂 click 根，
  `controller.parentSpanId=fetch.spanId`，`service/mapper/sql` 依次挂父，`render` 挂 click 根（异步续体回落）；
  案例 B 为 `ui_event → js_method → render`，无后端节点。
- `rootEventId` 是真实 clickId（不是 `click_lost_<spanId>`）；S2 的游离后端根仍按 §8.2 处理（`confidence=LOST`）。
- 不聚合（同 `nodeKey` 多次调用 → 多个节点）、`edges.count` 恒 1、不合并前后端重复节点。
- graph 仍是**查询**，不是回放：不提供时间窗/虚拟时钟；时间轴只读窗口走 `replay`。

### 9.5 `GET /api/v1/meta`（S3 取值）

```json
{"service":"traceboard-collector","version":"0.1.0-SNAPSHOT","apiVersion":"v1",
 "schema":{"id":"urn:traceboard:schema:event:v1","version":"traceboard.event.v1","dialect":"2020-12"},
 "capabilities":{"health":true,"meta":true,"ingestEvents":true,"realtime":false,"replay":true}}
```

- `capabilities` **仍恰好 5 键**；S3 只把 `replay` 由 `false` 改为 `true`（回放已落地），`realtime` 必须保持 `false`（无 SSE/WS）。
- 未落地的能力不得写成 `true`；`replay=true` 不代表实时、不代表重跑、不代表写。

### 9.6 S3 状态码汇总（新增部分；ingest 的 202/400/413/415 与 S2 查询错误不变）

| 码 | 场景（S3） |
|---|---|
| `200` | replay 窗口成功（含空窗口）；requests/graph 派生成功 |
| `400` | replay `fromNs/toNs` 非整数、负数、溢出、`fromNs>toNs`；graph 缺失/非法 `traceId` |
| `404` | replay/requests/graph 未知 session；graph 会话内无该 trace；未注册的 RESERVED 路由 |
| `405` | replay/requests/graph 收到非 GET 方法 |

错误信封（`transport.v1.md` §4.3）：`{"error":"<code>","message":"<≤200 字符、不含内部路径/凭据>","apiVersion":"v1"}`。

### 9.7 S3 明确未实现（仍 RESERVED / 不在 S3 范围）

- `GET /api/v1/stream`（SSE）、`WS /ws/v1/events`、`POST .../links`：代码中不得注册路由；`capabilities.realtime=false`。
- 无服务端推送/长连接/自动刷新；工作台只有手动刷新 + 低频轮询。
- 无启动器/IDEA/JAR 接入向导/预览代理注入/CDP/浏览器扩展（S4）；无节点详情抽屉/×N/手工关联/时间窗 `INFERRED`（S4/S6）。
- 无 sourcemap/构建插件/源码行号/JS 局部变量/`values[]`/字段 diff（S5）；SDK 只到 F0（显式 `wrapFn`）。
- 无像素回放/截图/录像；「回放」仅指已存事件的只读时间窗。
- collector 不落 DB/文件、无淘汰/采样/缓存/CORS/鉴权/429；回放不写、不重跑、不调 demo；`ingest` 仍是唯一写通路。
- 无 Tomcat/React/cloud/MySQL 服务/上传/沙箱；不改 demo 后端、H2 seed 与案例 A 行为。

### 9.8 S3 冒烟命令

```bash
curl -s "http://127.0.0.1:8601/api/v1/meta"                                   # capabilities.replay=true，仍 5 键
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson"  # 202 accepted=7
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson" # 202 accepted=3
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"                # sdkActive=true，A EXACT/7/1/4，B RETURNED_FALSE/3/0/0
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/graph?traceId=1f2e3d4c5b6a79880a1b2c3d4e5f6071"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay?fromNs=0&toNs=1034500000"  # 6 events
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay"                  # 默认窗口，A+B 全部 10 条
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay?fromNs=10&toNs=5"  # 400
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay?fromNs=-1"          # 400
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_missing/replay"                  # 404
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay"            # 405
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/stream"                                     # 404（未注册）
```

期望：A+B 同会话时默认 `toNs=2004000000`、`events` 共 10 条；每两次相同 GET 响应逐字一致；前后 `/events` 与 demo `GET /api/orders`
（仍 `CREATED`）不变。以上 `Ns` 数值均为 fixture 作用域；运行时是 epoch-ns，客户端显示时归一化、请求仍用原始值。

## 附录 A：demo 应用 API（非 TraceBoard API，S0 历史）

> **S2 起 demo 已改为 H2+MyBatis 并植入 0 行缺陷**：当前权威行为见**附录 B**；本附录保留 S0 内存版历史（不得据此实现 S2）。

| 方法 | 路径 | 响应 | 说明 |
|---|---|---|---|
| GET | `/api/orders` | `200 {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.00}]}` | 内存订单列表；无 DB |
| POST | `/api/orders/1/cancel` | `200 {"data":true}` | 将状态改为 `CANCELLED`；幂等；不产生 SQL/0 行语义 |
| POST | `/api/orders/{id}/cancel`（`id` ≠ 1） | `404 {"data":false}` | 未知订单号的最小约定（见 `s0-plan.md` §13-D13）；无副作用、不产生业务错误协议；demo 前端只调 1 |

- demo 后端是**无缺陷、无采集**的普通 Boot 2.7 应用；0 行案例只存在于 fixture（S2 才在 demo 植入缺陷）。
- 失败分支口径：未知 `id` 返回 `404 {"data":false}`（D13 最小约定，仅供手测）；其它失败分支（未知路径、方法不允许、内部错误）S0 不承诺，保持 Boot 默认 404/405/500 即可，不写业务错误协议。

## 附录 B：S2 demo 0 行行为（当前权威；非 TraceBoard API）

> **这是 demo 应用故意植入的缺陷（主计划 §5 案例 A），不是 TraceBoard 的 bug。** TraceBoard 只记录事实，不判定业务对错。

| 方法 | 路径 | 响应 | 行为 |
|---|---|---|---|
| GET | `/api/orders` | `200 {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.00}]}` | 来自 H2 表 `orders`（`schema.sql` + `data.sql` 初始化，`spring.sql.init.mode=always`）；不是内存 Map |
| POST | `/api/orders/1/cancel` | `200 {"data":true}` | 先做存在性检查（`countById`，1 行 → 存在）；执行 `UPDATE orders SET status='CANCELLED' WHERE id=#{id} AND status='PAID'` → **影响 0 行**（`id=1` 是 `CREATED`）；Service **忽略**影响行数仍返回 `true`；Controller 返回 200 |
| POST | `/api/orders/{id}/cancel`（未知 `id`） | `404 {"data":false}` | 存在性检查 0 行 → Service 返回 `false`，**不执行** `cancelById`；该请求的链只有 controller + service（`RETURNED_FALSE`），无 mapper/sql |
| demo 前端 | `http://localhost:5174` | — | **不改**：2xx 显示“操作成功”并刷新列表，列表仍是 `CREATED`（与 0 行并存 = 案例 A 的事实组合） |

- 技术事实（实现约束，不是本 API 契约的扩展）：
  - Boot **2.7.18** + `org.mybatis.spring.boot:mybatis-spring-boot-starter:2.3.1` + H2（Boot 2.7.18 管理 **2.1.214**，`runtime` scope）；
    JDBC URL `jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1`（`MODE=MySQL` 可选，不强制）。
  - 表：`orders(id BIGINT PK, order_no VARCHAR, status VARCHAR, amount DECIMAL(10,2))`；seed 仅 `1, SO-0001, CREATED, 100.00`。
  - mapper XML：`mapper/OrderMapper.xml`（`cancelById` 的 WHERE 含 `status='PAID'`）；删除 S0 的 `InMemoryOrderStore`。
  - **无 MySQL/外部数据库服务依赖**；H2 仅嵌入式；demo 后端 JDK8 独立构建，端口 8080。
- 0 行必须是**运行时 DB/SQL 事实**：`fixtures/s2-zero-row-chain/**` 只用于确定性测试，禁止用它冒充运行时证据。
- 已知文案瑕疵：demo 前端页头仍写 S0 口径“无缺陷”（S2 登记，S3 接 SDK 时统一修正）；不影响本附录行为口径。
- **S3 补充**：demo 前端已接入 runtime SDK（横幅改为“runtime SDK · 无构建插件/sourcemap · 案例 A 缺陷 + 案例 B 纯前端校验”），
  但本附录的**行为**不变：案例 A 仍只在 2xx 时显示“操作成功”并刷新列表，列表仍 `CREATED`；案例 B 见附录 C。

## 附录 C：S3 demo 案例 B（纯前端校验，零请求；非 TraceBoard API）

> 案例 B 是 **demo 前端**的纯前端校验路径（主计划 §6）。它**没有后端 API**：无论校验通过与否，都不应产生任何 `fetch`/XHR，
> 也不触碰 H2。TraceBoard 只摆前端事实，不判定业务对错；`金额必须大于 0` 是 demo 的示例文案。

| 控件/元素 | 选择器 | 行为 |
|---|---|---|
| 金额输入 | `#amount-b` | 用户输入；SDK **不采集**输入值/表单值（隐私） |
| 保存按钮 | `#btn-save-b` | 点击后由 SDK 产生 `ui_event` 根（`SDK_ACTIVE`）；处理器调用 `validateForm` |
| 校验函数 | `OrderEdit.vue#validateForm` | 经 `wrapFn` 包装；空/非数字/`<=0` → 返回 `false`（`RETURNED_FALSE`）；有效 → 返回 `true`（`OK`） |
| 错误提示 | 金额输入下方 | 校验失败显示 `金额必须大于 0`，并调用 `uiEffect('金额必须大于 0')` 记录 `render` |
| 成功提示 | 同一位置 | 校验通过显示 `校验通过（本案例不提交）`；**仍不提交/不发请求** |

- **两个分支都零请求**：`fetchCount=0`、`hasBackend=false`、`backendSpanCount=0`；没有 `controller/service/mapper/sql` 事件。
- 判定：`sdkActive=true` 且该 trace 根为 `ui_event`、`fetchCount=0` 且 `hasBackend=false`，click 根已在观察窗关闭后入库且 flags 含 `OBSERVE_MS` →
  工作台显示 **`已确认：本次点击因果链内没有网络请求`**；SDK 未接入/无 click 根时只能显示 **`无法确认：前端采集未接入`**。
- 已知限制（如实标注）：SDK 只到 F0——**无构建插件/sourcemap**，因此
  - 能看到：控件身份、`validateForm` 包装结果 `false`、DOM 效果文本、请求数 0；
  - 看不到：文件/行号、JS 局部变量/入参值/`amount` 的实际值（S5 的构建插件/sourcemap 才提供）。
  节点详情必须写 `JS 内部变量本次未采集（无构建插件/sourcemap）`，**不得**显示行号/局部变量。
- 案例 B 不能证明“后端正确”，只能证明“本次点击因果链内没有发出网络请求”；观察窗是 1.5s（`OBSERVE_MS=1500`），
  窗口外的后台轮询在本阶段不采集，UI 文案只声明“本次点击因果链内”。
- 期望 fixture：`fixtures/s3-frontend-facts/case-b-frontend-only/**`（3 行：click → validateForm `RETURNED_FALSE` → render；零 fetch）。
  fixture 是契约形状，不是运行时证据；运行时“确认没发”必须来自浏览器 SDK 的真实事件。