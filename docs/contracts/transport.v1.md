# 传输契约 v1（transport.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23
> 变更记录：**2026-11-23 S1 增补**——通路 A（ingest）与通路 C 的**只读会话查询**转为已实现；
>   实时推送（通路 B：SSE/WebSocket）与回放仍为预留，S1 代码中不存在。S0 的“501 骨架”行为按原样保留为 `S0` 历史注记。
>   **2026-11-23 G1 第 1 轮**：§4.5 增第 8 条，记录 S1 agent 事件的“游离后端根”语义（`event-model.v1.md` §5 第 2 条例外；仅文档，schema/fixture 未变）。
> 范围：collector 与 agent/SDK/工作台之间的数据通路。**S0 只实现骨架**：ingest 返回 501，实时与回放全部预留。
> 关联契约：`event-model.v1.md`（事件语义）、`api.v1.md`（HTTP 端点清单、S1 实现矩阵 §2.1 与 S1 定义 §7）。

## 1. 拓扑与端口（固定）

| 组件 | 地址 | S0 状态 | S1 状态 |
|---|---|---|---|
| collector | `http://127.0.0.1:8601` | 骨架可启动；仅 health/meta/ingest 501 | ingest + 会话/事件只读查询已实现；无实时、无回放 |
| demo 后端 | `http://localhost:8080` | 可启动；内存数据，无采集 | 同一进程加 `-javaagent` 后，`OrderController#cancel(long)` 产生 1 条 controller span |
| workbench（Vite dev） | `http://localhost:5173` | 仅外壳 + fixture 摘要 | 增加 S1 假点击面板；经 `/ingest`、`/api` 代理访问 collector |
| demo 前端（Vite dev） | `http://localhost:5174` | 单页；`/api` 代理到 8080 | 不变 |
| workbench preview / demo preview | 默认 4173 / 4174 | 仅本地验证，不承诺 | 不变 |

- collector 只绑定本机回环地址（`127.0.0.1`），不对局域网暴露；S0/S1 不做鉴权（本地单用户），token 预留。
- demo 前端固定 5174 的原因：workbench 已占 5173（分发书 §8 只固定 8601/8080/5173），两个 Vite 工程必须错开端口。
- 不使用任何外部 CDN/在线字体/遥测端点；所有资源本地打包。
- S1 代理：workbench 的 Vite 代理把 `/ingest` 与 `/api` 转发到 `http://127.0.0.1:8601`（IPv4 字面量，避免 `[::1]`），
  因此浏览器只发同源相对路径；collector 仍不加 CORS 头。

## 2. 三条通路（职责分离）

| 通路 | 方向 | 协议 | 阶段 |
|---|---|---|---|
| A. 批量 ingest | agent/SDK → collector | `POST /ingest/v1/events`，NDJSON | **S1 已实现**（S0 曾返回 501） |
| B. 实时推送 | collector → workbench | SSE 或 WebSocket（二选一或并存） | **预留，S1 未实现**（代码中不存在） |
| C. 只读查询 / 回放 | workbench → collector | HTTP GET | **S1：只读会话/事件查询已实现**；**回放仍预留** |

- 唯一事实源是 append-only 事件流；B/C 都是派生读取，不得改写事件。
- S0 的 demo 应用、demo 前端、workbench 与 collector **彼此不通信**（分发书 §2.2）；S1 只放开
  “workbench（假事件）→ collector” 与 “demo 后端（agent）→ collector” 两条写入，以及 workbench 的只读查询。
- S1 不做前后端关联：通路 A 的假前端批次与 agent controller span 之间没有传播头、没有合并、没有推断。

## 3. 线上 JSONL 格式（与 fixture 同规则）

1. UTF-8 无 BOM；一行一个紧凑 JSON 对象；末行带 `\n`；空行/注释非法。
2. 每行必须通过 `schema/traceboard.event.v1.json`；`additionalProperties:false`。
3. 请求体即 NDJSON；**不得**用 JSON 数组包裹，不得 base64/gzip 嵌套（压缩属后续协商，v1 不启用）。
4. 单行 ≤64KB；单批 ≤1000 行且 ≤4MB（主计划 §9.2 预算的传输投影）。

## 4. 通路 A：`POST /ingest/v1/events`（S1 已实现；S0 曾为 501）

### 4.1 请求

```http
POST /ingest/v1/events HTTP/1.1
Host: 127.0.0.1:8601
Content-Type: application/x-ndjson; charset=utf-8
Content-Length: <bytes>
```

- 无查询参数；无自定义必填 header；未来鉴权用 `Authorization: Bearer <local-token>`（预留）。
- 客户端应整批发送；不要求运行中 flush 单行（实时性由通路 B 承担）。

### 4.2 响应语义（S1 权威；`501` 行仅为 S0 历史）

判定顺序固定为 **`415 → 413 → 400 → 逐行`**（保证测试确定性；不因一行坏行整批 400，除非信封非法）。

| 状态码 | 条件 | 响应体 |
|---|---|---|
| `202 Accepted` | 信封合法，批已处理（可能含逐行拒绝/幂等丢弃） | `{"accepted":N,"rejected":M,"dropped":K,"errors":[{"line":i,"code":"...","message":"..."}]}` |
| `400 Bad Request` | 请求信封非法：空/纯空白 body、含空行/纯空白行、末行缺 `\n`、行数 >1000、body 非 UTF-8、body 含 `\r` | 错误信封（§4.3），`error="bad_request"` |
| `413 Content Too Large` | body >4MB 或任一行（去行尾 `\n` 的原始字节）>64KB | 错误信封，`error="payload_too_large"` |
| `415 Unsupported Media Type` | `Content-Type` 不是 `application/x-ndjson`（允许 `; charset=utf-8`，大小写不敏感） | 错误信封，`error="unsupported_media_type"` |
| `501 Not Implemented` | **仅 S0 历史**：端点存在但未实现 | 错误信封，`error="not_implemented"`（S1 起不再返回） |

- **逐行校验**：schema 不通过的行计入 `rejected`，其余行照常接收；不得因一行坏行整批 400（除非信封非法）。
- 计数语义（202）：`accepted` = 本次**新写入**存储的行数；`rejected` = 逐行失败行数；`dropped` = 幂等命中跳过的行数
  （含同批内重复）；恒有 `accepted + rejected + dropped == 非空行数`。
- `errors[]` 只覆盖被拒行：`line` **1 基**；`code` 至少 `invalid_json`、`schema_violation`；`message` ≤200 字符，
  不回显请求原文或敏感值（契约 §7）。`dropped` 行不产生 error 条目。
- 幂等键：`(sessionId, traceId, spanId)`；重复行计入 `dropped`，不报错、不改写已存内容、不消耗 `seq`。
- 批量可乱序到达；读取方按 `startNs` 重排，不做合并/改写。
- 重试：客户端可整批重发（at-least-once），重复由幂等键吸收。
- 背压：collector 可返回 429（预留）并带 `Retry-After`；S1 未使用，不返回 429。

### 4.3 错误信封（v1 统一）

```json
{"error":"not_implemented","message":"ingest is reserved for S1; S0 collector skeleton stores nothing","apiVersion":"v1"}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `error` | string | 小写下划线错误码：`not_implemented`、`bad_request`、`payload_too_large`、`unsupported_media_type`、`not_found`、`method_not_allowed`、`too_many_requests`（预留） |
| `message` | string | 面向开发者的一句话说明，不含内部路径/凭据 |
| `apiVersion` | string | `v1` |

- S1 的 `405`（查询端点收到写动词）允许使用 Boot 默认响应体；其余错误必须是上述信封。
- 错误信封示例中的 `not_implemented` 为 S0 历史文案；S1 不再产生该码。

### 4.4 S0 行为（历史，S1 起不再返回 501）

- `POST /ingest/v1/events` 固定返回 `501` + 上述信封；**不解析**、**不落盘**、**不缓存**请求体。
- 该 501 是“骨架占位”，不是“功能已完成”；报告与 UI 不得写成“已支持采集”。
- S1 起该行为已被 §4.5 取代（202/400/413/415）；保留此段仅为历史对照与回归判据（不得退回 501）。

### 4.5 S1 已实现行为（权威）

1. **解析**：按字节读取原始 body（先查 `Content-Length`，超限即 413 且不无限读）；UTF-8 解码失败 → 400；
   按 `\n` 切行。**body 中出现任何 `\r` 视为信封非法 → 400**（CRLF 是格式错误，不做“宽容剥离”，与 §3 第 1 条一致）。
2. **逐行 schema 校验**：使用冻结的 `schema/traceboard.event.v1.json`（2020-12，`additionalProperties:false`），
   通过 `com.networknt:json-schema-validator` 在 collector 内校验；schema **单一来源**：构建期由 `maven-resources-plugin`
   从仓库根 `schema/` 拷入 classpath（不在 `src/main/resources` 维护副本）。
3. **存储**：内存 append-only；`ConcurrentHashMap<sessionId, 会话记录>`，每会话一个有序 `List` + 幂等 `Set`；
   `seq` 每会话从 1 连续递增，批次内按出现顺序分配；无 DB/文件/网络依赖，重启清空。
4. **会话索引**：同时维护 `sessionId → (eventCount, startedAtMs, lastEventAtMs)`；`startedAtMs` 取该会话首条被接收事件的
   collector 墙钟，`lastEventAtMs` 取最后一条（Unix 毫秒），供 `GET /api/v1/sessions` 返回（`api.v1.md` §7.2）。
5. **并发**：每会话写入加锁（先查幂等键再追加）；查询读取不可变快照，不阻塞写入、不改变 `seq`。
6. **上限**：单批 ≤4MB 且 ≤1000 行，单行 ≤64KB（`transport.v1.md` §3）；不做采样、不做淘汰、不做 429 背压。
7. **诚实性**：S1 只有 ingest 一个写端点；`GET /api/v1/sessions*` 是只读查询，**不是回放**，
   不改写事件、不重放执行、不重建图；`capabilities.replay/realtime` 仍为 `false`。
8. **S1 的 agent 事件是游离后端根**：`parentSpanId=null`、`kind=controller`、`confidence=LOST`、`rootEventId=click_lost_<spanId>`、`flags` 含 `LOST_BACKEND`；
   语义定义见 `event-model.v1.md` §5 第 2 条例外。它**不是**伪造的前端根，也不与任何前端事件关联（无 traceparent/clickId、无合并、无推断），
   collector 只做 schema 校验与存储，不做关联判定。S1 工作台只读假批次会话、不展示该事件；任何展示它的界面都必须按 `LOST` 标为游离/未归属，
   不得画成点击链的一环。

## 5. 通路 B：实时推送（预留，S0/S1 均不实现）

> S0/S1 都不暴露这些端点，不建立任何长连接；下列形状仅供后续检查点评审，不得在 S0/S1 代码中出现。

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

## 6. 通路 C：只读会话查询（S1 已实现）与回放（预留）

### 6.1 S1 只读查询（已实现；**查询不是回放**）

```http
GET /api/v1/sessions
→ 200 {"sessions":[{"sessionId":"s_...","eventCount":N,"startedAtMs":E,"lastEventAtMs":E}]}

GET /api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200
→ 200 {"events":[{"seq":1,"event":{<event-v1>}}],"nextSeq":1}
```

- 仅 `GET`；`POST/PUT/PATCH/DELETE` → `405`；未知 session → `404` 错误信封；`afterSeq<0`、`limit∉[1,500]` 或非整数 → `400`。
- `limit` 默认 200（1–500），`afterSeq` 默认 0（`>=0`）；`events[]` 按 `seq` 升序；`nextSeq` = 本页最后一条 `seq`，
  空页时 `= afterSeq`。
- **`seq` 是传输/存储元数据，位于 `event` 对象之外**（`{"seq":n,"event":{...}}`）：`event` 逐字返回、仍是合法的 v1 事件，
  可直接过冻结 schema；ingest 侧仍拒收带 `seq` 的事件（`additionalProperties:false`）。
- 纯读：不做重排/合并/改写，不重新执行程序，不调用 demo 后端，不发写请求，不触发 SQL，不建立派生图，不提供虚拟时钟。
- **术语纪律**：这些端点必须称为“会话查询 / 只读读取”，**不得称为回放**；`capabilities.replay` 保持 `false`。
  存在性：`/graph`、`/replay`、`/stream`、`/ws/v1/events`、`/links` 未注册路由（请求 404）。

### 6.2 回放（仍预留，S1 不实现）

- 典型形状（DRAFT，见 `api.v1.md` §4.1）：`GET /api/v1/sessions/{sessionId}/replay?fromNs=<int>&toNs=<int>`。
- 回放语义：输入是已有事件流，**不重新执行程序**；不调用 demo 后端、不发 HTTP 写请求、不触发 SQL。
- 回放响应不得包含凭据/原始敏感值；脱敏与截断标记原样保留。

## 7. 安全与合规

- 只监听 `127.0.0.1`；无外网访问；无遥测；不上传工作区外数据。
- 事件内禁止真实客户数据/secret；脱敏在产生端完成（见 `event-model.v1.md` §8）。
- 错误响应不得回显请求体原文（避免把敏感值写进日志/UI）。
- S0/S1 均不引入鉴权，也不伪造“已鉴权”；本地 token（短时随机、只存本机）属后续检查点。

## 8. 版本化

- 路径带主版本（`/ingest/v1/`、`/api/v1/`）；事件带 `schema=traceboard.event.v1`。
- 兼容性原则：新增可选字段需契约变更；语义变更必须升主版本并保留旧路径一个检查点。
- S0/S1 的所有“预留”端点不得以“已实现”名义写进 README/报告；状态以 `api.v1.md` §2.1（S1）与 §2（S0 历史）为准。
- S1 的“会话查询”≠“回放”：README/报告/UI 不得把 `GET /api/v1/sessions*` 描述为回放。