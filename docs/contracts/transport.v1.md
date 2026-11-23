# 传输契约 v1（transport.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23
> 范围：collector 与 agent/SDK/工作台之间的数据通路。**S0 只实现骨架**：ingest 返回 501，实时与回放全部预留。
> 关联契约：`event-model.v1.md`（事件语义）、`api.v1.md`（HTTP 端点清单与 S0 实现状态）。

## 1. 拓扑与端口（固定）

| 组件 | 地址 | S0 状态 |
|---|---|---|
| collector | `http://127.0.0.1:8601` | 骨架可启动；仅 health/meta/ingest 501 |
| demo 后端 | `http://localhost:8080` | 可启动；内存数据，无采集 |
| workbench（Vite dev） | `http://localhost:5173` | 仅外壳 + fixture 摘要 |
| demo 前端（Vite dev） | `http://localhost:5174` | 单页；`/api` 代理到 8080 |
| workbench preview / demo preview | 默认 4173 / 4174 | 仅本地验证，不承诺 |

- collector 只绑定本机回环地址（`127.0.0.1`），不对局域网暴露；S0 不做鉴权（本地单用户），token 预留。
- demo 前端固定 5174 的原因：workbench 已占 5173（分发书 §8 只固定 8601/8080/5173），两个 Vite 工程必须错开端口。
- 不使用任何外部 CDN/在线字体/遥测端点；所有资源本地打包。

## 2. 三条通路（职责分离）

| 通路 | 方向 | 协议 | 阶段 |
|---|---|---|---|
| A. 批量 ingest | agent/SDK → collector | `POST /ingest/v1/events`，NDJSON | S1 目标；**S0 返回 501** |
| B. 实时推送 | collector → workbench | SSE 或 WebSocket（二选一或并存） | **预留，S0 不实现** |
| C. 只读回放/查询 | workbench → collector | HTTP GET | **预留，S0 不实现** |

- 唯一事实源是 append-only 事件流；B/C 都是派生读取，不得改写事件。
- S0 的 demo 应用、demo 前端、workbench 与 collector **彼此不通信**（分发书 §2.2）。

## 3. 线上 JSONL 格式（与 fixture 同规则）

1. UTF-8 无 BOM；一行一个紧凑 JSON 对象；末行带 `\n`；空行/注释非法。
2. 每行必须通过 `schema/traceboard.event.v1.json`；`additionalProperties:false`。
3. 请求体即 NDJSON；**不得**用 JSON 数组包裹，不得 base64/gzip 嵌套（压缩属后续协商，v1 不启用）。
4. 单行 ≤64KB；单批 ≤1000 行且 ≤4MB（主计划 §9.2 预算的传输投影）。

## 4. 通路 A：`POST /ingest/v1/events`（目标语义；S0=501）

### 4.1 请求

```http
POST /ingest/v1/events HTTP/1.1
Host: 127.0.0.1:8601
Content-Type: application/x-ndjson; charset=utf-8
Content-Length: <bytes>
```

- 无查询参数；无自定义必填 header；未来鉴权用 `Authorization: Bearer <local-token>`（预留）。
- 客户端应整批发送；不要求运行中 flush 单行（实时性由通路 B 承担）。

### 4.2 响应语义（目标）

| 状态码 | 条件 | 响应体 |
|---|---|---|
| `202 Accepted` | 批已接收（可能存在逐行拒绝，见 `rejected`） | `{"accepted":N,"rejected":M,"dropped":K,"errors":[{"line":i,"code":"...","message":"..."}]}` |
| `400 Bad Request` | 请求信封非法：空 body、含空行/注释行、批量行数 >1000 | 错误信封（§4.3） |
| `413 Content Too Large` | body >4MB 或单行 >64KB | 错误信封 |
| `415 Unsupported Media Type` | Content-Type 不是 `application/x-ndjson` | 错误信封 |
| `501 Not Implemented` | **S0 占位**：端点存在但未实现 | 错误信封，`error="not_implemented"` |

- **逐行校验**：schema 不通过的行计入 `rejected`，其余行照常接收；不得因一行坏行整批 400（除非信封非法）。
- 幂等键：`(sessionId, traceId, spanId)`；重复行计入 `dropped`，不报错。
- 批量可乱序到达；读取方按 `startNs` 重排，不做合并/改写。
- 重试：客户端可整批重发（at-least-once），重复由幂等键吸收。
- 背压：collector 可返回 429（预留）并带 `Retry-After`；S1 未使用。

### 4.3 错误信封（v1 统一）

```json
{"error":"not_implemented","message":"ingest is reserved for S1; S0 collector skeleton stores nothing","apiVersion":"v1"}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `error` | string | 小写下划线错误码：`not_implemented`、`bad_request`、`payload_too_large`、`unsupported_media_type`、`not_found`、`method_not_allowed`、`too_many_requests`（预留） |
| `message` | string | 面向开发者的一句话说明，不含内部路径/凭据 |
| `apiVersion` | string | `v1` |

### 4.4 S0 行为（必须可验证）

- `POST /ingest/v1/events` 固定返回 `501` + 上述信封；**不解析**、**不落盘**、**不缓存**请求体。
- 该 501 是“骨架占位”，不是“功能已完成”；报告与 UI 不得写成“已支持采集”。

## 5. 通路 B：实时推送（预留，S0 不实现）

> S0 不暴露这些端点，不建立任何长连接；下列形状仅供 S1 评审，不得在 S0 代码中出现。

### 5.1 SSE（候选）

```http
GET /api/v1/stream?sessionId=s_... HTTP/1.1
Accept: text/event-stream
```

```text
event: span
data: {"schema":"traceboard.event.v1",...}

: ping
```

- 每事件一帧；`data` 为单行紧凑事件 JSON；心跳 ≤30s；断线由客户端重连并携带 `afterSeq`（预留）。

### 5.2 WebSocket（候选）

- 端点 `/ws/v1/events`（预留），消息信封 `{"type":"span","event":{...}}`；不实现双向控制命令。

约束（预留但需提前遵守）：实时只推送**已接收事件**，不推送“计划执行”的假事件；连接断开不影响 ingest；
推送失败不得丢弃事件（客户端可从回放接口补齐）。

## 6. 通路 C：只读回放/查询（预留，S0 不实现）

- 全部使用 `GET`，无写动词；`POST/PUT/PATCH/DELETE` 一律 405（预留）。
- 典型形状（DRAFT，见 `api.v1.md`）：
  - `GET /api/v1/sessions/{sessionId}/events?afterSeq=<int>&limit=<1..500>`
  - `GET /api/v1/sessions/{sessionId}/graph`（派生图，只读）
  - `GET /api/v1/sessions/{sessionId}/replay?fromNs=<int>&toNs=<int>`（只读回放视图）
- 回放语义：输入是已有事件流，**不重新执行程序**；不调用 demo 后端、不发 HTTP 写请求、不触发 SQL。
- 回放响应不得包含凭据/原始敏感值；脱敏与截断标记原样保留。

## 7. 安全与合规

- 只监听 `127.0.0.1`；无外网访问；无遥测；不上传工作区外数据。
- 事件内禁止真实客户数据/secret；脱敏在产生端完成（见 `event-model.v1.md` §8）。
- 错误响应不得回显请求体原文（避免把敏感值写进日志/UI）。
- S1 起使用的本地 token 为短时随机值，只存本机；S0 不引入鉴权，也不伪造“已鉴权”。

## 8. 版本化

- 路径带主版本（`/ingest/v1/`、`/api/v1/`）；事件带 `schema=traceboard.event.v1`。
- 兼容性原则：新增可选字段需契约变更；语义变更必须升主版本并保留旧路径一个检查点。
- S0 的所有“预留”端点不得以“已实现”名义写进 README/报告；状态以 `api.v1.md` 的矩阵为准。