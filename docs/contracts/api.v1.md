# HTTP API 契约 v1（api.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23（S2 增补：2026-11-24；S3 增补：2026-11-24；S4 增补：2026-11-24；S4-AMD-01：2026-11-26，日期笔误按 2026-11-23 生效；S5 增补：2026-11-27；S6a 增补：2026-11-23；S6b 增补：2026-11-24）
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
>   **2026-11-24 S4 增补**：新增 **agent 握手**（控制通路）`POST /ingest/v1/agent-hello` 与只读状态 `GET /api/v1/sessions/{sessionId}/agent`，均为 **IMPLEMENTED**（§2.4 矩阵、§10 定义）。
>   握手是 JSON（**非 NDJSON**）、**last-wins 内存记录**、**不入 EventStore、不建会话、不改 `seq`**、meta `capabilities` 仍**恰好 5 键**（握手不是能力开关）。
>   事件 schema、`ingest`、`sessions/events/requests/graph/replay` 全部**零改动**；`stream`/`ws`/`links` 仍 RESERVED（404）；无 SSE/WS/鉴权/CORS/TLS。
>   S4 的 ×N 只是工作台对**已采集 span 按 `nodeKey` 的前端聚合**（运行时 ×3 属 S6）；`fixtures/s4-details/**` 仅为 UI/测试数据，不是运行时证据。
>   **2026-11-26 S4-AMD-01 增补（binding，日期笔误按 2026-11-23 生效）**：S4 起 `graph` 节点**加性**新增只读
>   `reason`/`source`/`confidence`（11 → **固定 14 字段**；`flags` 语义不变；`nodes`/`edges`/排序/节点数/`rootEventId`/顶层 `confidence` 与
>   `events`/`seq`/`requests`/`replay` 全部零改动；不改 schema、不改 S0–S3 fixture）。字段定义见 **§8.2** 与 **§10.8**；
>   CLI `--collector` 寻址、`diagnose` 七项/SKIP/WARN/`SUMMARY` 语义、预览响应改写规则见 `s4-plan.md` §4 与 `docs/guides/local-launcher.md`。
>   **2026-11-27 S5 增补（加性、只读；历史 §2–§10 全部保留不改写）**：graph `nodes[]` 从 S4 的 14 字段**加性**扩为**固定 15 字段**——
>   末尾追加第 15 个 `values`（事件 `values` 原样数组；事件无该字段 → `null`，**不默认 `[]`**），字段定义见 **§8.2** 与 **§10.9**；
>   `events`/`seq`/`requests`/`replay` 零改动，`edges`/排序/节点数/`rootEventId`/顶层 `confidence`/错误码/只读/两次一致不变，
>   meta `capabilities` 仍**恰好 5 键**。S5 **不新增 collector 路由**、不改任何路径/参数/状态码（§2.5）；
>   demo 侧新增 `POST /api/orders/{id}/preview-discount`（**demo 应用 API**，非 collector 路由，附录 D）与其 L1 事实；
>   前端 manifest/`source`/`SOURCE_MAPPED` 的浏览器侧形状见**附录 E** 与 `docs/guides/frontend-shallow-plugin.md`。
>   **schema 字节不变**（`values` 自 v1 起就是可选字段，见 `event-model.v1.md` §4.4）；S0–S4 fixture 字节不变。
>   **2026-11-23 S6a 增补（加性、只读；历史 §2–§10 与附录 A–E 全部保留不改写）**：demo 应用 API 新增
>   `POST /api/orders/{id}/reconcile`（**附录 F**；任何 id → `200 {"data":[100.0,0.0,100.0]}`，纯计算、无 DB），
>   demo 前端新增 `#btn-reconcile`；agent 新增 `L2DemoService#reconcileAmount` 的**行级局部变量** L2 采集
>   （`values` 中 `kind=local` + 1-based `line` + 逐次 `invocation`），一次请求 3 个同 nodeKey service span（×3）。
>   collector **零改动**：graph 仍固定 **15 字段**（`values` 原样数组，不重算/不排序）、`events/seq/requests/replay`/
>   meta 5 键/路由数/错误码不变；**schema 字节不变**（`local`/`line`/`invocation` 自 v1 起即合法，见 `event-model.v1.md` §4.4.7）；
>   S0–S5 fixture 字节不变。S6a **仅** `L2DemoService#reconcileAmount` 一个方法有 L2；异步/无调试信息/循环折叠/
>   预算/开销属 **S6b**，S6 仍为 partial（不得据此宣称 S6 完成）。
>   **2026-11-24 S6b 增补（加性、只读；历史 §2–§10 与附录 A–F 全部保留不改写）**：demo 应用 API 新增
>   `POST /api/orders/{id}/reconcile-async`、`POST /api/orders/{id}/no-debug`、`POST /api/orders/{id}/reconcile-loop?times=100`
>   （**附录 G**）。agent 新增三类事实：①异步子线程**创建时**继承上下文（flag `ASYNC_INHERITED`，仅当子 span 线程 ≠ 父帧创建线程）；
>   ②无调试信息降级（`status=NOT_COLLECTED_NO_DEBUG_INFO` + `reason="LocalVariableTable missing"` + flag `NO_DEBUG_INFO`，**无 `values`**）；
>   ③循环值折叠（`status=TRUNCATED` + `VALUES_CAPPED=<n>` + `VALUES_TOTAL=<n>`，L2 单 span 保留上限 **20**）。
>   collector **零改动**：graph 仍固定 **15 字段**、业务路由仍 **9 条**、meta `capabilities` 仍 **5 键**、错误码/只读/两次一致不变；
>   **schema 字节不变**（`ASYNC_INHERITED`/`NO_DEBUG_INFO`/`VALUES_TOTAL=<n>` 只是既有 `flags[]` 字符串，`status`/`reason`/`values` 自 v1 起合法）；
>   S0–S6a fixture 字节不变。S6b **不支持也不宣称**：行级字段写入、对象深采、多方法 L2、`CompletableFuture`/`@Async`/框架续体、
>   长生命周期/已存在线程池的自动传播、跨服务。S6 的最终验收/备份/tag 由 S6b 之后的 acceptance 卡完成。
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

### 2.3 S3 实现矩阵（S3 时权威；S4 起以 §2.4 为准）

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

### 2.4 S4 实现矩阵（当前权威；S0–S3 矩阵保留为历史）

| 方法 | 路径 | S4 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 仍**恰好 5 键**、取值与 S3 相同（`replay=true`、`realtime=false`）；握手**不是**能力键（§10.4） |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 与 S1–S3 逐字相同，仍是**唯一事件写通路** |
| POST | `/ingest/v1/agent-hello` | **IMPLEMENTED（S4 新增）** | agent 启动诊断握手；`application/json`（**非 NDJSON**）；不写事件、不建会话（§10.2） |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变；**只有握手、没有事件**的会话不出现在列表里 |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变（只读分页，**不是回放**） |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED** | 不变（S3 字段与派生 `confidence` 不变） |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED** | S4 **加性**：节点 11 → **固定 14 字段**（+`reason/source/confidence`，§8.2/§10.8）；edges `count=1`、排序/节点数不变；**无** ×N 聚合 |
| GET | `/api/v1/sessions/{sessionId}/replay?fromNs=<int>&toNs=<int>` | **IMPLEMENTED** | 不变（只读窗口，0 写） |
| GET | `/api/v1/sessions/{sessionId}/agent` | **IMPLEMENTED（S4 新增）** | 只读返回该 session 最近一次握手事实；无记录 404（§10.3） |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现（404） |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现（404） |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S6，404） |

- 端点计数：含 `/actuator/health` 共 **10 条**；collector **业务路由 9 条**（meta、ingest、hello、sessions、events、requests、graph、replay、agent），actuator 另计。
- S4 **不新增事件写通路**：`agent-hello` 是**控制/诊断通路**，与事件存储完全分离；事件写入仍只有 `POST /ingest/v1/events`。
- S3 的 7 条业务路由（meta/ingest/sessions/events/requests/graph/replay）**除 graph 节点按 §10.8 加性新增 3 个只读字段外**，形状与语义零改动；S4 只新增 hello（POST）与 agent（GET）两条。
- `stream`/`ws`/`links` 仍不得注册路径字符串；未注册 404、方法不匹配 405；错误信封见 `transport.v1.md` §4.3。
- S4 的 ×N/详情/缺口**全部在前端派生**，collector 不新增端点；graph 只按 §10.8 加性新增只读字段，不做聚合（同 `nodeKey` 多次调用仍是多个节点）；运行时 ×3 属 S6。

### 2.5 S5 实现矩阵（当前权威；S0–S4 矩阵保留为历史）

| 方法 | 路径 | S5 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 仍**恰好 5 键**、取值与 S4 **逐字相同**（`replay=true`、`realtime=false`）；L1 不是能力开关 |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 线上格式/202/400/413/415/幂等/`seq` 全部不变；`values` 是**既有 schema 可选字段**，ingest 只做 schema 校验，不做 L1 语义校验 |
| POST | `/ingest/v1/agent-hello` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变（事件计数仍按行计，不含 `values` 项数） |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变；`event` 逐字回显（S5 起可能含 `values`，因为它一直在 schema 里） |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED** | 不变（**不**因 L1 新增字段/改变 `status` 聚合） |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED** | S5 **加性**：节点 14 → **固定 15 字段**（末尾 `values`，§8.2/§10.9）；其余一切不变 |
| GET | `/api/v1/sessions/{sessionId}/replay?fromNs=&toNs=` | **IMPLEMENTED** | 不变（只读窗口；窗口内事件里的 `values` 原样回显，不新增过滤/裁剪） |
| GET | `/api/v1/sessions/{sessionId}/agent` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现（404） |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现（404） |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S6，404） |

- **S5 不新增 collector 路由**：业务路由仍 **9 条**（meta、ingest、hello、sessions、events、requests、graph、replay、agent），含 `/actuator/health` 共 **10 条**；路径/参数/状态码/错误信封零改动。
- `events`/`seq`/`requests`/`replay` 的响**形状与字节**与 S4 逐字一致；唯一加性变化是 graph 节点末尾的 `values`（只读派生，不写存储、不消耗 `seq`、不缓存）。
- `values` 的数据来源是**已存事件原值**（采集端已完成脱敏/截断/预算）；collector 不重算、不合并、不裁剪、不排序、不改写（§10.9）。
- demo 的 `POST /api/orders/{id}/preview-discount` 是 **demo 应用 API**（附录 D），不是 collector 路由；它不改变 collector 契约面，也不新增 collector 能力键。
- **没有** L2/`kind=local`/对象深采/异步续体/运行时 ×3/SSE/WS/持久化/sourcemap 解码/图库（S6+，见 §11 与附录 E 的“浅层”口径）。

### 2.6 S6a 实现矩阵（当前权威；S0–S5 矩阵保留为历史）

| 方法 | 路径 | S6a 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 仍**恰好 5 键**、取值与 S5 逐字相同（`replay=true`、`realtime=false`）；L2 不是能力开关 |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 不变；`values`（含 S6a 的 `kind=local`/`line`/`invocation`）仍只做 schema 校验，不做 L2 语义校验 |
| POST | `/ingest/v1/agent-hello` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变（事件计数仍按行计，不含 `values` 项数） |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变；`event` 逐字回显（可能含 L2 `values`） |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED** | 不变；reconcile 链 `backendSpanCount=4`（controller + 3 service），S5 链不变 |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED** | **形状零改动**：节点仍固定 **15 字段**（末尾 `values` 原样数组，§8.2/§10.9/§10.10）；同 nodeKey 3 个 service 仍是 3 个节点 |
| GET | `/api/v1/sessions/{sessionId}/replay?fromNs=&toNs=` | **IMPLEMENTED** | 不变（窗口内事件里的 L2 `values` 原样回显） |
| GET | `/api/v1/sessions/{sessionId}/agent` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现（404） |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现（404） |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S6，404） |

- **S6a 不新增 collector 路由**：业务路由仍 **9 条**（meta、ingest、hello、sessions、events、requests、graph、replay、agent），含 `/actuator/health` 共 **10 条**；路径/参数/状态码/错误信封零改动。
- `events`/`seq`/`requests`/`replay`/meta 与 S5 **逐字一致**；graph 的 15 字段/顺序/排序/边/节点数全部不变，唯一变化是 `values` 数组里可能出现 `kind=local`（采集端完成，collector 原样透传；§10.10）。
- demo 的 `POST /api/orders/{id}/reconcile` 是 **demo 应用 API**（附录 F），不是 collector 路由；它不改变 collector 契约面，也不新增 collector 能力键。
- **仍无**：异步续体/线程池/`@Async` 上下文、`NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI、无 LVT 的降级事件、行级字段写入（`kind=field` + 行号）、对象深采、多方法 L2、循环折叠/采样/丢弃预算、L2 开销门槛、SSE/WS/持久化/CORS/鉴权（S6b/S7+，越界即失败）。

### 2.7 S6b 实现矩阵（当前权威；S0–S6a 矩阵保留为历史）

| 方法 | 路径 | S6b 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 仍**恰好 5 键**、取值与 S6a **逐字相同**（`health/meta/ingestEvents=true`、`realtime=false`、`replay=true`）；异步/无调试/折叠**不是**能力键 |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 不变；`ASYNC_INHERITED`/`NO_DEBUG_INFO`/`VALUES_TOTAL=<n>` 只是既有 `flags[]` 字符串，`NOT_COLLECTED_NO_DEBUG_INFO`/`TRUNCATED`/`reason`/`values` 全是 v1 既有成员，ingest 仍只做 schema 校验（无新字段/枚举/校验分支） |
| POST | `/ingest/v1/agent-hello` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变（计数按事件行，不按 values 项/折叠前项数） |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变；`event` 逐字回显（可能含折叠后的 20 项 `values`、`status=TRUNCATED`、`NOT_COLLECTED_NO_DEBUG_INFO`） |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED** | 不变；async 链 `backendSpanCount=4`（controller + 3 service），loop/no-debug 链 `backendSpanCount=2`；`status` 仍按 §8.1 既有优先级聚合（`NOT_COLLECTED_NO_DEBUG_INFO`/`TRUNCATED` 已在其中，不新增规则） |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED** | **形状零改动**：节点仍固定 **15 字段**（§8.2/§10.9）；`values`/`status`/`reason`/`flags` 原样透传（含 20 项折叠列表与 `VALUES_CAPPED`/`VALUES_TOTAL`）；不重算丢弃数、不重新采样、不排序、不合并 3 个 async 节点 |
| GET | `/api/v1/sessions/{sessionId}/replay?fromNs=&toNs=` | **IMPLEMENTED** | 不变（窗口内事件原样回显） |
| GET | `/api/v1/sessions/{sessionId}/agent` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现（404） |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现（404） |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（S6 之后，404） |

- **S6b 不新增 collector 路由**：业务路由仍 **9 条**（meta、ingest、hello、sessions、events、requests、graph、replay、agent），含 `/actuator/health` 共 **10 条**；路径/参数/状态码/错误信封零改动；**collector 零 diff**。
- `events`/`seq`/`requests`/`replay`/meta 与 S6a **逐字一致**；graph 的 15 字段/顺序/排序/边/节点数不变。异步/无调试/折叠全部是**采集端**事实，collector 只透传（§10.11）。
- demo 的三个 S6b 端点是 **demo 应用 API**（附录 G），不是 collector 路由；它们不改变 collector 契约面，也不新增能力键。
- **仍无**（不得据此宣称已支持）：行级字段写入（`kind=field` + 行号）、对象深采、多方法/任意方法 L2（L2 仅覆盖 `reconcileAmount`/`reconcileLoop` 两个 demo 方法）、`CompletableFuture`/`@Async`/框架续体传播、长生命周期线程池/已存在线程的自动传播、跨服务/云端、SSE/WS/持久化/CORS/鉴权。

### 2.8 S7 实现矩阵（React18/Webpack5 本地基础；当前权威；S0–S6b 矩阵保留为历史）

> **2026-11-24 S7 增补（加性、只读；历史 §2–§10 与附录 A–G 全部保留不改写）**：S7 只新增第二栈前端
> `demo/buggy-shop-boot-react/frontend`（React 18.3.1 + Webpack 5 + Babel，本地 dev 5175），**复用**现有
> Boot 2.7/H2 demo 后端（`demo/buggy-shop-boot-vue/backend`，零业务改动）；collector/agent/SDK/schema **零改动**，
> **不新增 collector 路由、事件字段、fixture 或 API**。本节为自包含的 S7 增补说明，文首历史变更记录不改写。

| 方法 | 路径 | S7 状态 | 说明 |
|---|---|---|---|
| GET | `/actuator/health` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/meta` | **IMPLEMENTED** | `capabilities` 仍**恰好 5 键**、取值与 S6b 逐字相同；React 不是能力键 |
| POST | `/ingest/v1/events` | **IMPLEMENTED** | 不变；React SDK 仍发既有事件的 NDJSON，只经同源 `/ingest` 代理到 8601 |
| POST | `/ingest/v1/agent-hello` | **IMPLEMENTED** | 不变 |
| GET | `/api/v1/sessions` | **IMPLEMENTED** | 不变；新会话 `s_s7react` 正常出现 |
| GET | `/api/v1/sessions/{sessionId}/events` | **IMPLEMENTED** | 不变；React 事件逐字回显 |
| GET | `/api/v1/sessions/{sessionId}/requests` | **IMPLEMENTED** | 形状/字段/排序不变；A 行 `spanCount=7/fetchCount=1/hasFrontend=true/hasBackend=true/backendSpanCount=4/confidence=EXACT`；B 行 `spanCount=3/fetchCount=0/hasBackend=false/backendSpanCount=0/EXACT` |
| GET | `/api/v1/sessions/{sessionId}/graph?traceId=<32hex>` | **IMPLEMENTED** | 形状零改动：节点仍固定 **15 字段**；A 7 节点/6 边、B 3 节点/2 边；不新增 React 字段 |
| GET | `/api/v1/sessions/{sessionId}/replay?fromNs=&toNs=` | **IMPLEMENTED** | 不变（只读窗口） |
| GET | `/api/v1/sessions/{sessionId}/agent` | **IMPLEMENTED** | 不变；S7 用 `-Dtraceboard.sessionId=s_s7react` |
| GET | `/api/v1/stream` | RESERVED | SSE 不实现（404） |
| WS | `/ws/v1/events` | RESERVED | WebSocket 不实现（404） |
| POST | `/api/v1/sessions/{sessionId}/links` | RESERVED | 手工关联不实现（404） |

- **S7 不新增 collector 路由**：业务路由仍 **9 条**（meta、ingest、hello、sessions、events、requests、graph、replay、agent），含 `/actuator/health` 共 **10 条**；路径/参数/状态码/错误信封零改动；**collector 零 diff**。
- **复用既有 demo 端点（非 collector API）**：React demo 只调用附录 A/B 已存在的 `GET /api/orders` 与 `POST /api/orders/1/cancel`；不改后端、不加端点、不加 CORS/鉴权。`cancel` 仍 `200 {"data":true}` 但 SQL `UPDATE ... AND status='PAID'` 影响 **0 行**，订单仍 `CREATED`。
- **代理（仅 dev）**：webpack-dev-server 5175 `strictPort`；`/api` → `http://127.0.0.1:8080`、`/ingest` → `http://127.0.0.1:8601`，两路均 `changeOrigin:false`、不 rewrite；同源、无 CORS、不直连 8601。**静态 dist 无代理**，只证明本地资产，不是案例 A 的通过路径。
- **会话/appName**：SDK 与 agent 均为 `s_s7react`；SDK `ingestUrl="/ingest"`、`appName="OrderEdit.jsx"`、observe 1500ms；工作台 `#s3-session` 手输该值。`appName` 只是 `js_method` 的 nodeKey 前缀，**不是源码映射**。

**S7 交付支持矩阵（如实口径，不写「完整」）**

| 维度 | S7 口径 |
|---|---|
| React 18.3.1 + Webpack 5 + runtime SDK（本地） | **基础** |
| 云端（上传/沙箱/预览/DB） | **暂不支持** |
| 可见 | 控件/click 根、fetch 请求 URL/method/HTTP 响应状态（不采响应体）、显式 `uiEffect` 声明的 UI 效果文本（非 DOM diff/截图）；后端 controller/service/mapper/sql 方法、SQL `rowsAffected` |
| 不可见 | **JS 源码文件/行号、React 组件映射/组件树、JS 局部变量、回调内部逻辑** |
| 构建期能力 | **无构建插件、无 sourcemap**（不 AST 插桩、不生成/内联 manifest；file/line 显示「未采集」） |
| 主计划 §14.2「完整（P2）」 | **未交付**；S7 只证明本地基础案例 A/B |

- **主计划 §14.2 的目标矩阵不改**：该表是长期目标（P1/P2/P3），S7 只在此处登记本地交付口径；不得把 P2「完整」写成已交付，也不得据此宣称 React 构建插件/sourcemap/组件映射。

- **案例 A**：`#btn-cancel` → 同源 `POST /api/orders/1/cancel`（带 `traceparent`+`X-TraceBoard-Click`）→ 4 后端 span → 200 → `#success-hint` `操作成功` + `uiEffect("操作成功")`；同 trace 恰 7 span、全 `EXACT`、SQL 0 行、订单仍 `CREATED`。
- **案例 B**：`#btn-save-b` → `OrderEdit.jsx#validateForm`（`RETURNED_FALSE`）→ `render`；同 trace 恰 3 span；`fetchCount=0`、`hasBackend=false`、`sdkActive=true`、click 根 flags 含 `OBSERVE_MS=1500`；无后端 span。
- **命令（Git Bash，仓库根，路径含中文/空格需双引号）**：
  - `(cd "frontend/sdk" && npm ci && npm run build)`（必须先构建，React 消费 `dist/index.js`）
  - `(cd "demo/buggy-shop-boot-react/frontend" && npm ci && npm run build)`；dev：`npm run dev`（5175）
  - collector：`"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"`
  - 后端+agent：JDK8 `-javaagent:... -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s7react -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"`
  - 工作台：`(cd "workbench" && npm ci && npm run build && npm run dev)`（5173）
- **仍无**（不得据此宣称）：Tomcat/WAR/SSM、React 构建插件/sourcemap/组件映射、JS 文件/行号、JS 局部变量/入参值、回调内部、云端、SSE/WS/持久化/CORS/鉴权；无新 fixture（S7-C 的 SDK 形状事件由 tester 内联构造）。
- **B 的「零请求」口径**：只指**本次 click 因果链**（`fetchCount=0`/`hasBackend=false`）。页面 mount 的 `GET /api/orders` 在 click 外，SDK 不记且 agent 未插桩 `list`，不产生后端 span；SDK ESM 初始化的一次 `/traceboard-manifest.json` 探测为 fail-open（404/非 JSON 均可、不发事件）。两者都不得被当成 B 的请求或伪造为 EXACT。

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

**`nodes[]`（S2–S3：每条固定 11 个字段；S4 起：每条固定 14 个字段；**S5 起：每条固定 15 个字段**，字段恒出现）**

> 上例为 S2 历史形状（11 字段）。S4 起每个节点**加性**多出 `reason`/`source`/`confidence` 三个只读字段（见下表末三行与 §10.8）；
> 其余字段、`nodes` 顺序、`edges`、节点数、`rootEventId`、顶层 `confidence` 不变。
> **S5 起**在末尾再加第 15 个只读字段 `values`（见下表最后一行与 §10.9）：14 字段的语义、顺序与取值一字不改，只在其后追加一项。

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
| `reason` | string \| null | **S4 加性**；事件 `reason` 原样；事件无该字段（非 `NOT_COLLECTED_*`）→ `null`；不改写/截断 |
| `source` | object \| null | **S4 加性**；事件 `source` 原样 `{"file": string\|null, "line": int\|null}`；事件无 → `null`；不补默认值 |
| `confidence` | string | **S4 加性**；事件 `confidence` 原样（`EXACT/INFERRED/LOST/MANUAL`）；不按节点重算、不伪造 |
| `values` | array \| null | **S5 加性（第 15 字段）**；事件 `values` 原样数组（元素形状见 `event-model.v1.md` §4.4）；事件无该字段 → `null`（**不默认 `[]`**）；不重算/不合并/不裁剪/不排序/不改写 |

- S4 加性字段的顺序固定为节点字段末尾：`spanId, parentSpanId, kind, nodeKey, status, return, sideEffects, startNs, durNs, thread, flags, reason, source, confidence`（14 项，每项恒出现）。
- **S5 起**顺序固定为 `spanId, parentSpanId, kind, nodeKey, status, return, sideEffects, startNs, durNs, thread, flags, reason, source, confidence, values`（**15 项**，每项恒出现；`values` 是唯一新项）。
- `values` 只描述“该节点对应事件采集到的值级事实”，**不等于** L2：S5 只允许 `param|field|return`，`kind=local`/行级变量属 S6 且 S5 不产生（§10.9）。
- **S6a（加性、无形状变更）**：`values` 仍是第 15 字段原样数组；S6a 采集端可在 `L2DemoService#reconcileAmount` 的 service 节点上写 `kind=local`（`line` 为 **1-based** 源行、`invocation` 为 1..3），collector 不重算/不合并/不排序/不补默认值（§10.10、`event-model.v1.md` §4.4.7）。
- `flags` 是**既有**字段（S2 起 11 字段之一），S4 **不改其语义**；`reason/source/confidence` 只来自该节点对应事件，不聚合、不跨节点继承。

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

> **S5 变更（取代本节“无 sourcemap/行号”的历史文案，历史保留不改写）**：S5 起 demo 前端加了浅层 Vite 插件与 `build.sourcemap=true`，
> `validateForm` 这类 `wrapFn`/`data-tb-fn` 命中 manifest 的事件会带 `source={file,line}` + flag `SOURCE_MAPPED`（附录 E、`event-model.v1.md` §12.11）。
> 因此工作台文案从 `JS 内部变量本次未采集（无构建插件/sourcemap）` 迁移为 `JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）`；
> **局部变量/行级变量仍然未采集**，`source` 只到“函数/文件/原始行号”，不是 `.map` 解码，也不是 L2。

### 9.4 `GET /api/v1/sessions/{sessionId}/graph?traceId=<32hex>`（S3 语义补充）

- 形状、节点字段、`edges[{from,to,count}]`、排序、400/404/405、只读与两次一致**全部沿用 §8.2**；S3 当时**不新增字段**、不改形状；S4 起按 §8.2/§10.8 **加性**新增 `reason/source/confidence`（其余仍不变）。
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

## 10. S4 实现（本地接入 + 诊断握手）

> S4 只新增**一条诊断握手（控制通路）**与**一个只读连接状态查询**；事件 schema、`ingest`、`sessions/events/requests/graph/replay`
> **全部零改动**（形状、字段、排序、错误码、0 写约束逐字沿用 S1–S3）。本地启动器（`server/launcher`）与预览代理（`127.0.0.1:8602`）
> 不改变 collector 线上格式：预览只把浏览器请求转发到 `--target` 与 `/ingest/v1/events`（其他 `/ingest/*` 404），并注入 `config.js`/`sdk.js` 两个**外部脚本**。
> collector 不新增 CORS、不加鉴权、不持久化；无 SSE/WS/长连接；`capabilities` 仍**恰好 5 键**（握手不是能力开关）。

### 10.1 S4 端点一览

| # | 方法 | 路径 | 类别 | 是否写事件 | 说明 |
|---|---|---|---|---|---|
| 1 | GET | `/actuator/health` | 健康 | 否 | 不变 |
| 2 | GET | `/api/v1/meta` | 元信息 | 否 | 5 键不变 |
| 3 | POST | `/ingest/v1/events` | 事件写入 | **是（唯一）** | 不变 |
| 4 | POST | `/ingest/v1/agent-hello` | 诊断握手 | 否 | S4 新增（§10.2） |
| 5 | GET | `/api/v1/sessions` | 只读查询 | 否 | 不变；不含“只有握手”的会话 |
| 6 | GET | `/api/v1/sessions/{sessionId}/events` | 只读查询 | 否 | 不变 |
| 7 | GET | `/api/v1/sessions/{sessionId}/requests` | 只读派生 | 否 | 不变 |
| 8 | GET | `/api/v1/sessions/{sessionId}/graph?traceId=` | 只读派生 | 否 | S4 加性 14 字段（§10.8）；edges/排序/节点数不变 |
| 9 | GET | `/api/v1/sessions/{sessionId}/replay?fromNs=&toNs=` | 只读派生 | 否 | 不变（0 写） |
| 10 | GET | `/api/v1/sessions/{sessionId}/agent` | 只读状态 | 否 | S4 新增（§10.3） |

- 业务路由 9 条（2–10），`/actuator/health` 另计；`stream`/`ws`/`links` 仍为 RESERVED（404）。
- 握手与 agent 状态是**诊断/连接事实**，不是事件、不是图、不是回放；两者都不得改变事件计数或 `seq`。

### 10.2 `POST /ingest/v1/agent-hello`（IMPLEMENTED，控制通路，非事件）

```http
POST /ingest/v1/agent-hello HTTP/1.1
Host: 127.0.0.1:8601
Content-Type: application/json; charset=utf-8
Content-Length: 118
```

```json
{"schema":"traceboard.agent.v1","sessionId":"s_s4demo","version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000}
```

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `schema` | string | 是 | **精确等于** `traceboard.agent.v1`（大小写敏感；**不是**事件 schema `traceboard.event.v1`） |
| `sessionId` | string | 是 | 匹配 `^s_[A-Za-z0-9_-]+$`；agent 侧取自 `-Dtraceboard.sessionId` |
| `version` | string | 是 | 非空、≤64 字符（agent jar manifest `Implementation-Version`，回退 `0.1.0-SNAPSHOT`） |
| `pid` | integer | 是 | ≥1（JVM `RuntimeMXBean.getName()` 的 `@` 前缀；解析失败则 agent 不发送） |
| `startedAtMs` | integer | 是 | ≥0，agent 侧 Unix 毫秒 |

- 未知字段**忽略**（只保留契约字段）；不要求 `traceId`/`spanId`/`rootEventId`；body 不得含 token/secret（本阶段无 token）。
- **判定顺序固定**：方法不是 `POST` → `405`；`Content-Type` 不是 `application/json`（允许 `; charset=utf-8`，大小写不敏感）→ `415`；
  body > **4096 字节** → `413`；JSON 非法或任一字段校验失败 → `400`；否则 `200`。
- `200 OK`（**精确形状**，字段顺序固定）：

```json
{"schema":"traceboard.agent.v1","sessionId":"s_s4demo","accepted":true}
```

| 状态码 | 条件 | 响应体 |
|---|---|---|
| `200` | 握手合法并已记录（last-wins） | 上述 `accepted:true` 形状 |
| `400` | JSON 非法；顶层非对象；`schema` 不精确；`sessionId` 形状错；`version` 空/超长；`pid<1`；`startedAtMs<0`；空 body | 错误信封 `error="bad_request"`（`message` 只指出哪个字段不合法，**不回显 body**） |
| `405` | 非 `POST`（含 `GET`/`PUT`/`HEAD` 等） | 框架默认响应体可接受；不解析 body |
| `413` | body > 4096 字节（含超限即停读，不无限读） | 错误信封 `error="payload_too_large"` |
| `415` | `Content-Type` 缺失或不是 `application/json` | 错误信封 `error="unsupported_media_type"` |

- **不写事件**：不解析事件、不写 EventStore、不消耗 `seq`、不创建会话、不改 meta；响应不返回事件计数。
- **last-wins**：collector 内存 `ConcurrentHashMap<sessionId, hello>`，每个 session 只保留**最近一次成功**握手；同 session 多次 hello 覆盖、
  不累积、不保留历史；无 TTL、无持久化、无 TTL 清理；多应用同 session 时以最后到达者为准（诊断只表示“最近一次握手”）。
- 无鉴权（仅回环）；`transport.v1.md` §1/§7 的本地边界同样适用于本端点。

### 10.3 `GET /api/v1/sessions/{sessionId}/agent`（IMPLEMENTED，只读）

```http
GET /api/v1/sessions/s_s4demo/agent HTTP/1.1
Host: 127.0.0.1:8601
```

`200 OK`（**精确形状**，字段顺序固定）：

```json
{"sessionId":"s_s4demo","connected":true,"version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000,"lastSeenMs":1763900000456}
```

| 字段 | 类型 | 语义 |
|---|---|---|
| `sessionId` | string | 路径参数逐字回显（形状必须匹配 `^s_[A-Za-z0-9_-]+$`，否则 404） |
| `connected` | boolean | 有握手记录时恒为 `true`（该字段是“连接事实”，不是实时在线探测；无心跳/超时判定） |
| `version` | string | 最近一次握手上报的 agent 版本 |
| `pid` | int | 最近一次握手上报的 JVM pid（用于多实例辨识） |
| `startedAtMs` | int | 最近一次握手上报的 agent 启动毫秒（agent 时钟） |
| `lastSeenMs` | int | **collector 接收该握手的时刻**（collector 时钟，Unix 毫秒）；与 `startedAtMs` 不同源，不得直接相减推断时延 |

- `404`：该 session **从未**收到成功握手 → 错误信封 `error="not_found"`；`sessionId` 形状不合法一律 `404`（不返回 400，避免把手误输入当成协议错误）。
- 只允许 `GET`；`POST/PUT/PATCH/DELETE` → `405`（框架默认响应体可接受）；无查询参数（额外参数忽略）、无分页。
- 只读：不触发采集、不创建会话、不改握手记录、不读写事件存储；两次相同 GET 在无新握手时逐字一致。
- **有握手但无事件**是合法状态：agent 状态 200 与同 session 的 `/events` 404 并存，不得为了让两者一致而伪造空会话。

### 10.4 与事件通路的关系（不变式）

1. 握手**不进入 EventStore**：只有 hello 的 session **不出现**在 `GET /api/v1/sessions`；其 `/events`、`requests`、`graph`、`replay` 均 404（未知 session）。
2. 握手不改变任何既有端点输出：事件数、`seq`、`requests`/`graph`/`replay` 响应与无握手时逐字一致（可回归比对）。
3. meta `capabilities` 仍**恰好 5 键**且取值不变（`health=true`、`meta=true`、`ingestEvents=true`、`realtime=false`、`replay=true`）；
   握手**不是能力开关**：不得新增第 6 键，也不得把 `realtime` 写成 `true`。
4. 无 SSE/WS/长连接；`diagnose` 与工作台都用普通 GET 点查/轮询。
5. 多应用同 session：last-wins；`GET agent` 只反映最后一次；诊断展示 `pid`/`startedAtMs` 供辨识；文档建议一应用一 session。
6. collector 重启：事件与握手记录同在内存、一起丢失；agent 只在 premain 握手一次、不自动重发 → `GET agent` 404 直到应用重启（如实报告，不伪造 `connected`）。
7. 握手失败（连接拒绝/超时/非 2xx）对应用 **fail-open**：agent 只计数（`hello_failed=n`），不阻塞启动、不重试风暴、不影响事件上报。
8. 事件模型无 S4 变更：握手不是事件，不新增事件类型/字段/枚举；schema 字节不变。

### 10.5 S4 状态码汇总（新增部分；其余沿用 §7.4/§8.4/§9.6）

| 码 | 场景（S4） |
|---|---|
| `200` | hello 合法并记录；agent 状态命中 |
| `400` | hello JSON 非法/字段不合法/空 body |
| `404` | agent 状态：该 session 从未握手或 `sessionId` 形状不合法；未注册的 RESERVED 路由 |
| `405` | hello 收到非 POST；agent 状态收到非 GET |
| `413` | hello body > 4096 字节 |
| `415` | hello `Content-Type` 不是 `application/json` |

错误信封（`transport.v1.md` §4.3）：`{"error":"<code>","message":"<≤200 字符、不含内部路径/凭据>","apiVersion":"v1"}`。

### 10.6 S4 明确未实现（S5/S6 边界，越界即失败）

- 无 L1/L2：不采参数/实体字段/局部变量/`values[]`/字段 diff（S5/S6）；`REDACTED`/`TRUNCATED` 仅沿用既有显示语义。
- 无 sourcemap/构建插件/源码片段/函数行号/方法名映射（S5）；详情缺失只写“未采集”，不承诺行号。
- **运行时 ×3 是 S6**：S4 的 ×N 只是工作台对已采集 span 按 `nodeKey` 的前端聚合；`fixtures/s4-details/**` 的三次调用是 UI/测试数据，不是运行时能力。
- 无 SSE/WS/实时、无持久化/DB/缓存/CORS/鉴权/TLS、无手工关联 `/links`、无时间窗 `INFERRED`（S6）。
- 无 WAR/Tomcat/React/cloud（S7+）；不改 demo 后端、H2 seed 与案例 A 行为。
- 预览代理不改写 CSP、不注入内联脚本、不做 TLS、不重写绝对 URL/`Location`；受 CSP/压缩/无 `</body>` 限制（见 `docs/guides/local-launcher.md`）。

> **S5 变更（取代上文 S4 边界，其余仍有效）**：S5 起 demo `previewDiscount` 的**参数/字段写入/返回**会写入事件 `values[]` 并经 graph 第 15 字段 `values` 暴露（§10.9、附录 D）；
> demo 前端另有**浅层构建插件/manifest/`sourcemap`**（附录 E、§9.3）：只有函数/文件/原始行号，**不解析 `.map`**、无源码片段、无局部变量；preview（8602）不注入 manifest；
> **L2/局部变量/行级变量/对象深采/异步/运行时 ×3 仍不在范围内（S6）**。S4 的其余边界（无 SSE/WS/持久化、无 WAR/Tomcat/React/cloud、案例 A 行为不变）继续有效。

### 10.7 S4 冒烟命令

```bash
# 1) 握手：合法 → 200 accepted:true
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/agent-hello" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary '{"schema":"traceboard.agent.v1","sessionId":"s_s4demo","version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000}'

# 2) 只读连接事实（有记录 200 / 无记录 404）
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s4demo/agent"                 # 200 connected=true + lastSeenMs
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_none/agent"   # 404

# 3) 握手不建会话、不改事件计数（只有握手时列表不含 s_s4demo）
curl -s "http://127.0.0.1:8601/api/v1/sessions"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8601/api/v1/sessions/s_s4demo/events" # 404（无事件）

# 4) 错误码
curl -s -o /dev/null -w "%{http_code}\n" -X GET "http://127.0.0.1:8601/ingest/v1/agent-hello"                  # 405
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/api/v1/sessions/s_s4demo/agent"        # 405
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/agent-hello" \
  -H "Content-Type: application/x-ndjson" --data-binary '{}'                                                    # 415
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/agent-hello" \
  -H "Content-Type: application/json" --data-binary '{"schema":"traceboard.agent.v1"}'                          # 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/agent-hello" \
  -H "Content-Type: application/json" --data-binary @- <<< "$(printf 'a%.0s' $(seq 1 5000))"          # 413

# 5) meta 仍 5 键（握手不是能力）
curl -s "http://127.0.0.1:8601/api/v1/meta"
```

期望：`accepted:true` / agent 200 且 `lastSeenMs` 为 collector 时刻 / `s_s4demo` 不在 sessions 列表 / `404` / `405` / `405` / `415` / `400` / `413` /
capabilities 仍为 5 键（`replay=true`、`realtime=false`）。S4 不改变 `ingest` 的任何行为（§7.1 照旧）。

### 10.8 S4 注记：graph 节点的加性只读字段（`reason`/`source`/`confidence`）

> 这是**加性契约变更**，不是 schema 变更：事件字节、`events`/`seq`、`requests`/`replay`、ingest、hello 全部零改动；
> 只允许 collector 在只读派生层（`SpanFacts`/`GraphNode`/`TraceDeriver` 及对应测试）把节点从 11 字段扩为 **固定 14 字段**。

- 字段顺序固定（恒出现）：`spanId, parentSpanId, kind, nodeKey, status, return, sideEffects, startNs, durNs, thread, flags, reason, source, confidence`。
- `reason`：事件 `reason` 原样（string 或 `null`）；事件无该字段（通常非 `NOT_COLLECTED_*`）→ `null`；不改写/截断。
- `source`：事件 `source` 原样（`{"file": string|null, "line": int|null}` 或 `null`）；事件无 → `null`；不补默认值（S5 前没有行号映射）。
- `confidence`：事件 `confidence` 原样（`EXACT/INFERRED/LOST/MANUAL`）；不按节点重算、不伪造。
- `flags`：**既有字段**，保持事件 `flags` 原样（缺省 `[]`），本次**不改语义**。
- 不变：`nodes` 排序（`startNs` 升序、同值 `spanId`）、`edges`（`count` 恒 1）、节点数、`rootEventId`、顶层 `confidence`、`sessionId`/`traceId`；
  不聚合、不合并同 `nodeKey`；错误码/只读/两次一致不变。
- 工作台**直接从 graph 读取** `reason/source/confidence/flags` 展示详情，不再为这三个字段翻页 join 事件；`reason` 缺失且 status 为
  `NOT_COLLECTED_*` → `未采集（无 reason）`；`source` 非完整 `file:line` → `未采集`。
- `fixtures/s4-details/**` 无需修改事件字节；S2/S3 graph 回归与 `tools/verify` 的 `GRAPH_NODE_KEYS` 迁移为 14 键（仅加性），节点值/边/顺序断言不变。

### 10.9 S5 注记：graph 节点第 15 字段 `values`（加性、只读）

> 这是**加性契约变更**，不是 schema 变更：`values` 自 v1 起就是事件的**可选**字段（`event-model.v1.md` §4.4），
> 事件字节、`events`/`seq`、`requests`/`replay`、ingest、hello 全部零改动；只允许 collector 在只读派生层
> （`SpanFacts`/`GraphNode`/`TraceDeriver` 及对应测试）把节点从 14 字段扩为 **固定 15 字段**。

**位置与恒出现**

```text
spanId, parentSpanId, kind, nodeKey, status, return, sideEffects, startNs, durNs,
thread, flags, reason, source, confidence, values        （15 项，顺序固定，每项恒出现）
```

**`values` 的取值规则（逐条硬约束）**

1. **原样**：节点 `values` = 该节点对应事件 `values` 的**逐字**反序列化结果（数组；元素携带 `name/kind/line/from/to/truncated/redacted`，单次调用可省略 `invocation`）。
2. **缺失即 `null`**：事件**没有** `values` 字段 → 节点 `values` 为 `null`；**不得**写成 `[]`、不得省略该键、不得补默认值。
3. **不加工**：不重算脱敏、不重算截断、不按 `name` 去重、不按 `nodeKey` 合并、不排序、不裁剪、不补 `line`/`invocation`。
   脱敏/截断/预算由采集端（agent / 对应 emitter）完成（`event-model.v1.md` §4.4/§8）。
4. **不聚合、不跨节点继承**：同 `nodeKey` 多次调用仍是多个节点，各自携带自己的 `values`（S6 才做 ×N 聚合与逐次选择）。
5. **不影响其它字段**：`status` 不因 `truncated=true` 改成 `TRUNCATED`（值级标记 ≠ 事件级状态）；`flags`/`reason`/`source`/`confidence`/`return`/`sideEffects` 独立原样。
6. **只读**：两次相同 GET 逐字一致；不写事件、不消耗 `seq`、不缓存、不落 DB/文件、不改变 `requests`/`replay` 的响应。
7. **能力口径**：S5 只产生 `kind=param|field|return`；`kind=local` 属 S6，S5 **不得**出现（出现即越界）。
8. **meta 不变**：`capabilities` 仍恰好 5 键；L1 不是能力开关，不新增第 6 键。

**工作台读取口径（只读派生，前端）**

- 详情 Values 区直接从 graph 节点读 `values`（无需为 `values` 翻页 join `events`），按数组顺序渲染：`param` → `field` → `return`。
- 空/缺失（`null` 或空数组）：**逐字** `未采集（该节点无 values；S5 只采参数/字段写入/返回摘要）`。
- 静态说明（逐字，必须与详情同屏）：`S5 L1：参数/字段写入/返回摘要；局部变量（L2）与行级属 S6，本阶段未采集`。
- `field` 行显示 `from → to`（含 `100 → 0` 高亮）；`redacted=true` 行标 `已脱敏` 且**只显示占位符**；`truncated=true` 行标 `已截断`；`line` 为 `null` 时显示 `行号未采集`。
- 值行页脚显示调用序号：`invocation` 缺省（S5 单次）→ 逐字 `第 1/1 次`；存在 `invocation` 时 → `第 i/N 次`（`i` 从 1 起）。
  值行序号来自 `values.invocation`；上方 S4 ×N 组序号来自同 `nodeKey` 的已采集 span 分组（前端聚合）——两者来源不同，UI 不得混用（S5 demo 单次，值行仍 `第 1/1 次`）。
- 节点 flag 含 `L1` 时显示 `L1` 徽标；**不得**出现 `local`/L2/行级变量的宣示。

**不变项（S5 回归清单）**

- `nodes` 排序（`startNs` 升序、同值 `spanId`）、`edges`（`count` 恒 1）、节点数、`rootEventId`、顶层 `confidence`、`sessionId`/`traceId`；
- `events`/`seq`/`requests`/`replay` 响应形状与字节；400/404/405、ingest 202/400/413/415、hello 200/400/413/415、只读与两次一致；
- schema 字节、S0–S4 fixture 字节、`transport.v1.md`/`status-semantics.md` 字节（S5 不改传输与状态语义）。

### 10.10 S6a 注记：`values` 中的行级 `local`（加性、只读；形状不变）

> 这是**语义增补**，不是 schema/形状变更：`kind=local`、`line`、`invocation` 自 v1 起就是 `values` 的合法成员
> （`event-model.v1.md` §4.4；`schema/traceboard.event.v1.json` 未改一个字节）；graph 节点仍固定 15 字段（§8.2），
> `events`/`seq`/`requests`/`replay`、ingest、hello、meta/路由/错误码全部零改动。

**采集口径（S6a 唯一范围）**

1. 只对 `com.example.shop.service.L2DemoService#reconcileAmount` 一个方法做 LVT 行级探针：方法 enter 开帧；读取 `LocalVariableTable` 的 `local:D`，活性区间按 **inclusive start** 判定（`lvtStart <= offset < lvtStart + lvtLength`，不得跳过调试信息）；在**行边界**（下一行真实指令起点/return 前）插 `recordLocal` 探针，以 jump/return/switch 等跳转结束的源行不插（帧内去重兜底），因此 demo 方法恰 2 个探针（初始化行、`local = 0` 行）；初始化行探针偏移等于 LVT start，必须采到首个 `local` 值（100）；return 前 exit、异常 catch-all 后 `THREW`（`event-model.v1.md` §4.4.7、`s6a-plan.md` §5.4）。
2. 值项只允许 `kind=local`（`name="local"`、`line` 为 1-based 源行、`from`=帧内上一值（首次 `null`）、`to`=本次值、`invocation`=1..3）；**不出现** `param`/`field`/`return` 值项；方法返回值走事件 `return` 字段。
3. 一次请求恰 3 个同 nodeKey 的 service span（`parentSpanId`=controller spanId、`startNs` 严格递增）；第 1/3 次各 1 项（`null→100`），第 2 次 2 项（初始化 `null→100` 与坏行 `100→0`）；3 个 span `flags` 含 `L2`（无 `L1`）。
4. `previous` 只在帧内有效（按 `(frame,name)` 记上一值），同值探针不追加；因此每次调用首项 `from=null`，且**首次观测（`from=null`）不是“值变化”**，仅为后续比较的基线。
5. 未插桩方法（含 `reconcileBatch`）**不产生** L2 span/值；类/方法/LVT 缺失时 fail-open、不猜、不发假事件（完整无调试信息语义属 S6b）。

**collector 读取口径（只读）**

- 节点 `values` = 事件 `values` 逐字（§10.9 规则 1–8 继续有效）；不重算、不补齐 `line`/`invocation`、不按 `nodeKey` 合并 3 个 span。
- 同 nodeKey 的 3 个节点仍是 3 个节点；×3 是工作台对已采集 span 的前端聚合，collector 不聚合。
- `requests.backendSpanCount` 对 reconcile 链为 **4**（1 controller + 3 service）；S5 链不变。

**工作台读取口径（前端只读派生）**

- `#s6-l2-badge` 仅在节点 `flags` 含 `L2` 时显示 `L2`；非 L2 节点不显示、不宣称 L2。
- L2 节点 `#s5-values` 内 local 行显示 `行号 N` 与 `from → to`（`100 → 0` 高亮）、页脚 `第 2/3 次`；
  `invocation` 来自 `values[].invocation`，×N 组序号来自同 nodeKey 的已采集 span 分组（两者不混用，S5 规则不变）。
- ×3 组中的“值变化”判定：`kind ∈ {local, field}` 且 `from !== null && from !== undefined && from !== to`（**首次观测 `from=null` 不算值变化**）；仅第 2 次调用（首个非空 `from` 的 `100 → 0` 项）为真并加 `data-invocation-diff="true"` 与可见 `值变化`，第 1/3 次为假、不加。此条件性由运行时 `values`（第 2 次 2 项）与浏览器 DOM 断言证明，不以 dist 静态字面量代替（`s6a-plan.md` §7/§8 S6A-D）。
- 文案（逐字）：banner `S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b`；
  L2 说明 `S6a L2：行级局部变量来自 LVT 探针（样例第 2 次调用 local 100 → 0）；异步/无调试信息/循环折叠/开销属 S6b`；
  ×N 注记 `×N 为已采集 span 的前端聚合；运行时 ×3 已在 L2DemoService#reconcileAmount 演示；其他方法无运行时 ×3`。
- 非 L2 节点保留 S5 的 `#s5-values` 文案与空态措辞；S5 选择器/徽标/`100 → 0`/`行号未采集` 断言全部保留。

**不变项（S6a 回归清单）**

- graph 15 字段及顺序、`nodes` 排序（`startNs` 升序、同值 `spanId`）、`edges`（`count` 恒 1）、节点数、`rootEventId`、顶层 `confidence`；
- `events`/`seq`/`requests`/`replay` 响应形状与字节；400/404/405、ingest 202/400/413/415、hello 200/400/413/415、只读与两次一致；
- schema 字节、S0–S5 fixture 字节、`transport.v1.md`/`status-semantics.md` 字节（S6a 不改传输与状态语义）。

### 10.11 S6b 注记：异步继承 / 无调试信息 / 循环折叠（加性、只读；形状/schema 不变）

> 这是**语义增补**，不是 schema/形状变更：`ASYNC_INHERITED`/`NO_DEBUG_INFO`/`VALUES_TOTAL=<n>` 是既有 `flags[]` 字符串，
> `NOT_COLLECTED_NO_DEBUG_INFO`/`TRUNCATED`/`reason`/`values` 全部自 v1 起合法；graph 仍固定 15 字段（§8.2），
> `events`/`seq`/`requests`/`replay`、ingest、hello、meta/路由/错误码与 collector 代码全部零改动。

**采集口径（S6b 唯一范围）**

1. **异步继承**：`SpanContext` 栈由 `ThreadLocal` 改为 `InheritableThreadLocal<ArrayDeque<Frame>>`；`childValue` **深拷贝**每帧
   （spanId/traceId/rootEventId/parentSpanId/confidence/kind/startNs 原值；`values`/`extraFlags`/`l2Previous`/`l2Values`/`childCallCounts`
   独立副本）；**仅在线程创建时**复制，已存在/长生命周期线程不自动传播。demo `L2DemoService#reconcileAsync` 在**请求线程内**创建
   per-request `Executors.newFixedThreadPool(1)`（单 worker，保证子线程内 `invocation` 仍 1/2/3），顺序 submit 3 次
   `reconcileAmount(id,100.0,i)`、`Future.get()` join、`finally` shutdown；返回 `[100.0,0.0,100.0]`。
2. **`ASYNC_INHERITED`**：帧记录创建线程 `originThreadId`（继承副本保留原值）；L2/无调试子 span 的 enter 若
   `Thread.currentThread().getId() != 父帧.originThreadId` → 追加 flag `ASYNC_INHERITED`。**同线程**调用不得带该 flag；
   该 flag 只证明“上下文来自继承的父帧”，不证明 `@Async`/`CompletableFuture`/线程池任务边界/框架传播已支持。
   无可继承的 controller 父帧时计 `l2_no_parent`、**不发假 span**；复用旧 worker 可能带过期 trace（S6 不解决，S7+ 显式传播）。
3. **无调试信息**：`NoDebugService#compute(double)` 正常编译后，Maven `maven-antrun-plugin` 在 `process-classes`
   用 `javac debug="false"`（`-g:none`）仅重编该类覆盖 `target/classes`（无 `LocalVariableTable`/`LineNumberTable`/`SourceFile`）。
   `NoDebugClassFileTransformer`（ASM，精确类 `com.example.shop.service.NoDebugService`、方法 `compute(D)D`）**只注入 enter/exit**（无行探针）：
   正常路径 `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、**无 `values`**、
   `return` 为真实 `200`、无伪造行号/变量名；异常路径 `THREW`（无 values）；`source` 缺失或 `line=null`。
   LVT 存在（构建回退）→ 记 `nodebug_lvt_present`、返回原字节、不插桩，测试 **FAIL**。
4. **循环折叠**：`L2DemoService#reconcileLoop(long,int)` 单 span 观测约 **102** 次值变化（含 `null→0` 基线、`50→0` 坏值、
   `0→1` 恢复、末尾 `49→50`）；`L2Values` 单 span 保留上限 **20**：前 6 + 后 6 + 中段均匀样本（补足 20），并**优先保留第一条
   非空 `from` 且 `to=0` 的坏值**；保留项按原观测顺序、不重排、不重算 `from/to`；`VALUES_TOTAL=<total>`（折叠前项数）与
   `VALUES_CAPPED=<dropped>`（`total-20`）必须同时出现，事件级 `status=TRUNCATED`；保留项 `truncated=false`（真值未截断，列表被折叠）。
   `reconcileAmount`（≤2 项）不触发折叠、仍 `OK` 且无 cap flag；`reconcileLoop(times≤~20)` 同样不折叠（S6B-C 用 100 与 5 对照）。
   **无静默丢弃**：任何折叠都必须由 `VALUES_CAPPED`/`VALUES_TOTAL`/`TRUNCATED` 可见；`L2Values` cap 20 严于既有单 span ≤30 项预算（L1 的 30 项预算不动）。

**采集端节点形状（S6B-A/B/C 断言口径）**

| 节点 | 关键事实 |
|---|---|
| async service（3 个） | 同 `nodeKey=L2DemoService#reconcileAmount`、`parentSpanId`=controller spanId、`startNs` 严格递增、`return` 100/0/100、`values` 1/2/1 且第 2 次 `100 → 0`、`invocation` 1/2/3；三个 `thread.id` 相同且 **≠ controller**；flags 含 `L2`+`ASYNC_INHERITED`，无 `L1`/`LOST_BACKEND` |
| 同线程 reconcile | 仍 4 span、1/2/1、`OK`，**不带** `ASYNC_INHERITED`（S6a 行为零回归） |
| no-debug service | `kind=service`、`nodeKey=com.example.shop.service.NoDebugService#compute`、`parentSpanId`=controller、`status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason` 逐字、flag `NO_DEBUG_INFO`、`values` 键缺失、`source.line` 为 `null`/缺失、return 200 |
| loop service | `nodeKey=com.example.shop.service.L2DemoService#reconcileLoop`、`parentSpanId`=controller、`status=TRUNCATED`、flags `L2`+`VALUES_CAPPED=<d>`+`VALUES_TOTAL=<t>`；`values.length=20`、`t>20`、`d=t-20`、`values[0].from=null`、末项 `to=50`、存在非空 `from` 且 `to=0` 的坏值 |

**collector 读取口径（只读）**

- 节点 `values`/`status`/`reason`/`flags` = 事件逐字（§10.9 规则 1–8 继续有效）；不重算丢弃数、不重新采样、不重排、不合并同 `nodeKey` 节点。
- async 链 `requests.backendSpanCount=4`；loop/no-debug 链 2；`spanCount` 视是否含前端事件而定（浏览器链 6/4，脚本无头链 4/2）。
- graph 仍 15 字段（§8.2），meta 仍 5 键；S6b 不新增第 6 键、不新增 collector 路由。

**工作台读取口径（前端只读派生；逐字 canonical）**

- banner：`S6：L2 行级（reconcileAmount）、异步继承（reconcileAsync）、无调试信息（NoDebugService#compute，NOT_COLLECTED_NO_DEBUG_INFO）、循环折叠（reconcileLoop）；长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持`
- L2 说明：`S6 L2：行级局部变量来自 LVT 探针（reconcileAmount 第 2 次 100 → 0；reconcileLoop 折叠保留首/尾/样本）；异步子线程创建时继承上下文（ASYNC_INHERITED）；长生命周期线程池不自动传播`
- ×N 注记：`×N 为已采集 span 的前端聚合；运行时 ×3 仅 L2DemoService#reconcileAmount 与 reconcileAsync（单异步线程内）演示；其他方法无运行时 ×3`
- 无调试说明：`S6 无调试信息：NoDebugService#compute 无 LocalVariableTable，状态 NOT_COLLECTED_NO_DEBUG_INFO；不猜变量名/行号`
- 折叠：`已折叠 N 次（VALUES_CAPPED=N；共 M 次）`（N=`VALUES_CAPPED` 值、M=`VALUES_TOTAL` 值；无 flag 时不显示；不得把保留项说成“已截断值”）。
- 选择器：`#s6-async-badge` **仅** `flags` 含 `ASYNC_INHERITED` 的节点显示；`#s6-no-debug-badge`/`#s6-no-debug-reason` **仅** `status=NOT_COLLECTED_NO_DEBUG_INFO` 的节点显示（灰色 `notcollected`，reason 取事件 `reason`，不是成功色）；`#s6-fold-note` 仅同时解析到 `VALUES_CAPPED=<n>` 与 `VALUES_TOTAL=<m>` 的节点显示。
- S6a 的 `#s6-l2-badge`/`#s6-l2-note`/`#s5-values`/`data-invocation-diff`/`100 → 0`/第 2 次高亮与 S5 选择器/文案**全部保留**；旧 S6a 三段文案（含“异步/无调试信息/循环折叠/开销属 S6b”）从 src 与 dist 中移除（迁移为上方 canonical）。
- 禁止：用 `nodeKey` 硬编码判定异步/无调试/折叠；禁止显示 `ASYNC_INHERITED` 于同线程 span；禁止把 `TRUNCATED` 当失败/异常；禁止宣称异步全量传播、线程池自动传播、无调试可采变量、循环全量记录或开销达标。

**不变项（S6b 回归清单）**

- graph 15 字段及顺序、`nodes` 排序（`startNs` 升序、同值 `spanId`）、`edges`（`count` 恒 1）、节点数、`rootEventId`、顶层 `confidence`；
- `events`/`seq`/`requests`/`replay` 响应形状与字节；400/404/405、ingest 202/400/413/415、hello 200/400/413/415、只读与两次一致；
- schema 字节、S0–S6a fixture 字节、`transport.v1.md`/`status-semantics.md` 字节（S6b 不改传输与状态语义；collector 零 diff）。

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

## 附录 D：S5 demo L1（`preview-discount`；非 TraceBoard API）

> 这是 demo 应用为 S5 新增的**演示端点**，不是 collector 路由，也不改变 collector 契约面。
> 它故意把金额在**内存对象**上从 100 改成 0、数据库仍是 100.00 —— 用来演示 L1 的“参数 100 / 字段 100→0 / 返回 0”三段事实（主计划 §16 T3）。
> `demoSecret=s3cr3t` 是**演示假值**，只用于证明脱敏。

| 方法 | 路径 | 响应 | 行为 |
|---|---|---|---|
| POST | `/api/orders/{id}/preview-discount?requestedAmount=<double>&demoSecret=<string>&note=<string>` | `200 {"data":0}` | `OrderService#previewDiscount`：`findById` → `o != null` 时 `o.setAmount(0)`（**仅内存，绝不 UPDATE**）→ `return 0`；DB `amount` 仍 `100.00` |
| POST | `/api/orders/{id}/preview-discount`（未知 `id`，如 `999`） | `200 {"data":0}` | `findById=null` → **不写字段、不 NPE**；响应与已知 id 相同 |

- **精确口径（不得按“直觉 REST”改）**：未知 `id` **不返回 404**，**也不返回** `{"data":-1}` / `{"data":null}`；S5 只有 `200 {"data":0}` 一种成功形状。
  理由：未知 id 只是“不写字段”的健壮性分支（`findById=null` 不得 NPE），S5 不为它引入第二套业务错误协议；
  验收信号是 L1 三段事实（参数/字段/返回），不是错误码矩阵（dispatch §3 为 binding）。
- 缺失/非法 query（`requestedAmount` 非 double 等）保持 **Boot 默认 400**；S5 不新增业务错误码，也不对该分支做业务断言。
- **不新增其它 API**：`GET /api/orders`、`POST /api/orders/{id}/cancel` 的方法/状态码/0 行事实一字不改（附录 B 继续有效）。
- **DB 不动**：不 `UPDATE`、不写 `orders`、不改变 H2 seed；`amount` 永远 `100.00`（案例 A 的 `cancelById` 影响 0 行也照旧）。
- 前端：固定值按钮 `#btn-discount`（`data-tb-fn="previewDiscount"`）→ 固定 URL（`requestedAmount=100&demoSecret=s3cr3t&note=` + 3000 个 ASCII `x`，`encodeURIComponent`）；
  页面显示 `{"data":0}` 与“仅内存返回 0、数据库金额未改”提示；**不调用** `loadOrders`，不改变案例 A/B。
- 后端实现：`OrderMapper` 新增只读查询 `Order findById(@Param("id") long id)` + XML `SELECT ... WHERE id=#{id}`；
  **该 mapper/sql 不插桩**（不产生 mapper/sql 节点；S2 的 `cancelById` 过滤器与 SQL 事实不变）。
- 隐私：不写日志、不打印 query；agent 只记录脱敏后的 `values`（占位符 + 长度），**原值绝不入库**；单请求 URL 约 3.2KB（Spring 默认头/行长度内）。

**运行时 L1 事实（S5-B 断言口径；离线 fixture 形状见 `fixtures/s5-l1-values/`）**

| # | `name` | `kind` | `line` | `from` | `to` | `truncated` | `redacted` |
|---|---|---|---|---|---|---|---|
| 1 | `requestedAmount` | `param` | `null` | `null` | `100` | `false` | `false` |
| 2 | `demoSecret` | `param` | `null` | `null` | `"[REDACTED len=6]"` | `false` | **`true`** |
| 3 | `note` | `param` | `null` | `null` | 前 **2048** 个 `x` | **`true`** | `false` |
| 4 | `amount` | `field` | `null` | `100` | `0` | `false` | `false` |
| 5 | `return` | `return` | `null` | `null` | `0` | `false` | `false` |

- 顺序固定：**参数声明顺序 → 字段写入发生顺序 → 返回**；每项固定输出 `name/kind/line/from/to/truncated/redacted`，`line` 恒 `null`，单次 `invocation` 省略。
- **参数项恰 3 个**（`requestedAmount`/`demoSecret`/`note`）；路径参数 `long id` **不进入 `values`**（不得出现 `id` 项；与 `s5-plan.md` §5.3 的 `@Advice.Argument(1..3)` 一致）。
- service span：`status=OK`、`return={"type":"double","value":0}`、`flags` 含 `L1`（并沿用 `S2_ZERO_ROW_CHAIN`）、
  `source` 来自 JVM 栈（`OrderService.java:<line>`）、`confidence` 继承（有合法头 `EXACT`、无头 `LOST`）。
- controller span：`return={"type":"org.springframework.http.ResponseEntity","value":200}`，**无 `values`**；该链**没有** mapper/sql span。
- 字段 100→0 **恰一条**：MyBatis hydration（装载订单时的 0→100）必须被排除
  （`com.example.shop.model.Order` 精确类名 + 顶层 frame 是 `OrderService#previewDiscount` + 调用栈无 `org.apache.ibatis` 帧 + `old != new`；见 `s5-plan.md` §6）。
- **这不是 L2**：没有行号、没有局部变量、没有对象深字段、没有逐行写入、没有异常 payload；`kind=local` 与行级变量属 S6。

```bash
curl -s -X POST "http://localhost:8080/api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=$(printf 'x%.0s' $(seq 1 3000))"
# 期望 200 {"data":0}；随后
curl -s "http://localhost:8080/api/orders"          # amount 仍 100.0（DB 未改）
curl -s -X POST "http://localhost:8080/api/orders/999/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=x"  # 200 {"data":0}
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"   # 案例 A 不变：200 {"data":true}
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/graph?traceId=<32hex>"   # 节点第 15 字段 values
```

## 附录 E：S5 前端浅层 manifest 与 `source`（非 TraceBoard API；浏览器/构建侧）

> 这是 demo 前端（5174）与 SDK 的**浏览器侧**形状，不属于 collector API。collector 只接收既有 `source` 字段
> （`event-model.v1.md` §4.1）与既有 `flags`；schema 不变、ingest 不变、graph 第 14 字段 `source` 的语义不变。

**manifest（构建插件产物；`frontend/build-plugin`）**

```json
{"functions":[{"name":"cancelOrder","file":"src/App.vue","line":44},
              {"name":"validateForm","file":"src/App.vue","line":86},
              {"name":"previewDiscount","file":"src/App.vue","line":120}]}
```

- `file`：相对 demo 前端根的 POSIX 路径；`line`：**原始源文件 1-based 行号**（`.vue` 按全文行号，不剥离 `<template>`）。
  上例行号仅示意；实现按扫描结果产出，测试**从源文件重新计算**，不硬编码（源码改动后行号会变）。
- 三个出口：dev `GET /traceboard-manifest.json`（`application/json; charset=utf-8`、`Cache-Control: no-store`）；
  build 产物 `dist/traceboard-manifest.json`；build 时 `transformIndexHtml` 内联 `window.__TRACEBOARD_MANIFEST__`（`<` 转义为 `\u003c`）。
- SDK 启动时**同步**读 `window.__TRACEBOARD_MANIFEST__`；ESM demo 在缺失时可**一次性** `fetch("/traceboard-manifest.json")` 兜底
  （相对路径、fail-open、无重试、无缓存、不产生事件）。**IIFE/preview 构建不做兜底**（避免预览页额外请求与 S4-E 计数回归）。

**`source` + `SOURCE_MAPPED` 的附加规则（不猜、不伪造）**

| 事件 | 附加 `source` 的条件 | flag |
|---|---|---|
| `js_method`（`wrapFn`） | manifest 中存在**同名**函数 | `SOURCE_MAPPED` |
| `ui_event`（click 根） | 目标元素有 `data-tb-fn="<name>"` **且** manifest 命中该 name | `SOURCE_MAPPED` |
| `fetch` / `render` / 其它 | **永不**附加（不猜） | 无 |

- `source` 必须 `file` 为非空字符串、`line` 为 ≥1 的整数才附加；无效/缺失项**忽略**（不写 `source`、不加 flag）。
- `SOURCE_MAPPED` 只表示“manifest 命中的**原始函数/文件/行号**”，**不是** `.map` 解码；SDK 不读 `.map`、不解析 sourcemap、不上传。
- 无 manifest（或坏 manifest / CSP 拦截内联且兜底失败）时，事件字节与 S3 **完全一致**（无 `source`、无 `SOURCE_MAPPED`）。
- **preview（8602）注入页没有 manifest** → 前端事件没有 `source`；工作台必须显示 `未采集`（如实），不得用函数名猜行号。
- 后端 `source` 来自 JVM 栈（`OrderController.java:<line>` 等），**不加** `SOURCE_MAPPED`，工作台也不追加“manifest 映射”。

- 工作台 source 文案：完整 source → `file:line`；flags 含 `SOURCE_MAPPED` → 追加 `（manifest 映射）`；缺失/不完整 → `未采集`。
- 这是 **F1/F2 浅层**（函数/文件/行号）：**没有**局部变量、没有行级变量表、没有对象深采（L2/S6）；不改 schema、不新增事件类型/枚举。
- `build.sourcemap=true` 只让 demo 构建产出 `dist/*.map` 供浏览器 devtools；**不提交、不上传、不解析**，SDK 不读。
- 详细设计、扫描规则、限制与排障见 `docs/guides/frontend-shallow-plugin.md`。

## 附录 F：S6a demo L2（`reconcile`；非 TraceBoard API）

> 这是 demo 应用为 S6a 新增的**演示端点**，不是 collector 路由，也不改变 collector 契约面。
> dispatch-s6a §5.1 将本附录写作“附录 E”，但 E 已被 S5 前端浅层占用（历史不改写）；S6a 的 demo 附录编号为 **F**，内容与 dispatch §3/§4 一致（计划偏离 D1，见 `s6a-plan.md` §13）。
> 它故意用 `invocation == 2` 把局部变量 `local` 从 100 写成 0，用来演示 L2 行级 `100 → 0` 与逐次 ×3（主计划 §2.3/§8.5/§9.1/§16 T6）。

| 方法 | 路径 | 响应 | 行为 |
|---|---|---|---|
| POST | `/api/orders/{id}/reconcile` | `200 {"data":[100.0,0.0,100.0]}` | `L2DemoService#reconcileBatch(id)` 循环 3 次调用 `reconcileAmount(id, 100.0, i)`；id 不查库、无日志 |
| POST | `/api/orders/{id}/reconcile`（未知 id，如 `999`） | `200 {"data":[100.0,0.0,100.0]}` | 纯计算：id 不参与业务，形状与已知 id 完全相同 |

- **精确口径（不得按“直觉 REST”改）**：任何 id 都 `200` 且 body 恰为 `{"data":[100.0,0.0,100.0]}`（`data` 为 3 个浮点数，Jackson 输出 `100.0`/`0.0`）；
  **不返回 404 / `{"data":-1}` / `null`**；纯计算、**无 DB 读写**（不 `SELECT`/`UPDATE`）。
- **不新增其它 API**：`GET /api/orders`、`POST /api/orders/{id}/cancel`、`POST /api/orders/{id}/preview-discount` 的方法/状态码/事实一字不改（附录 B/D 继续有效）；不新增其它 demo 端点。
- 服务实现（`com.example.shop.service.L2DemoService`，**独立于 `OrderService`**，见 `s6a-plan.md` §4）：
  `double reconcileAmount(long id, double amount, int invocation)`：`local = amount`；`invocation == 2` 时 `local = 0.0d`；`return local`（id 不使用、无日志、无 DB）；
  `List<Double> reconcileBatch(long id)`：`i=1..3` 调 `reconcileAmount(id, 100.0d, i)`，返回 `[100.0,0.0,100.0]`；**`reconcileBatch` 不插桩**，不产生 span。
- 前端：固定值按钮 `#btn-reconcile`（普通 click 处理函数，**不用 `wrapFn`**）→ `POST /api/orders/1/reconcile`，页面展示响应原文；
  **不调用** `loadOrders`，不改变案例 A/B/L1 的 DOM/函数/请求。
- 运行时 L2 事实（S6A-C 断言口径；离线 fixture 形状见 `fixtures/s6-l2-lines/`）：一次请求恰 3 个 `L2DemoService#reconcileAmount` service span
  （同 nodeKey、parent=controller、`startNs` 严格递增、`return` 100/0/100、flags 含 `L2`）；第 1/3 次各 1 项 local（`null→100`），第 2 次 2 项（`null→100` 与坏行 `100→0`）；
  `values` 行号由测试从 `L2DemoService.java` 源码重算，不硬编码；agent 的 LVT 探针/帧设计见 `s6a-plan.md` §5。
- **不是 S6b**：本附录不承诺异步续体、无调试信息降级事件、行级字段写入、对象深采、多方法 L2、循环折叠/采样/预算或 L2 开销门槛。

## 附录 G：S6b demo（`reconcile-async` / `no-debug` / `reconcile-loop`；非 TraceBoard API）

> 这是 demo 应用为 S6b 新增的**三个演示端点**，不是 collector 路由，也不改变 collector 契约面。
> 它们分别演示主计划 §8.4（异步上下文）、§9.2（预算/折叠）与“缺调试信息不猜”（§16 T7）：异步子线程只在**创建时**继承上下文；
> `NoDebugService#compute` 无 `LocalVariableTable`，只证明“调用 + 返回值”，给不出变量名/行号；循环值被折叠但计数可见。
> 与 S6a 一样：**任何 id 都返回同形状 200**，纯计算、无 DB 读写、无日志；S6a 的 `reconcile` 与案例 A/B/L1 行为一字不改。

| 方法 | 路径 | 响应 | 行为 |
|---|---|---|---|
| POST | `/api/orders/{id}/reconcile-async` | `200 {"data":[100.0,0.0,100.0]}` | `L2DemoService#reconcileAsync`：请求线程内建 per-request 单线程池，顺序调用 `reconcileAmount(id,100.0,i)`（i=1..3），join 后返回；`finally` shutdown |
| POST | `/api/orders/{id}/no-debug` | `200 {"data":200.0}` | `OrderController#noDebug` → `NoDebugService#compute(100.0)` 返回 `amount*2`（demo 固定 200.0）；该 service span 为 `NOT_COLLECTED_NO_DEBUG_INFO` |
| POST | `/api/orders/{id}/reconcile-loop?times=100` | `200 {"data":50.0}` | `L2DemoService#reconcileLoop`：`local=0`，每轮 `local+1`，`i==50` 时置 0，返回最终 `local`；`times` 默认 100、clamp 1..200（`times=5` → `{"data":5.0}`，不折叠） |

- **精确口径（不得按“直觉 REST”改）**：三个端点对**任何 id**（含 `999`）都 `200` 且 body 恰为上表形状；
  **不返回 404 / `{"data":-1}` / `{"data":null}`**；纯计算、**无 DB 读写**（不 `SELECT`/`UPDATE`）；不新增其它 demo 端点。
- **不新增其它 API**：`GET /api/orders`、`POST /api/orders/{id}/cancel`、`POST /api/orders/{id}/preview-discount`、
  `POST /api/orders/{id}/reconcile` 的方法/状态码/事实一字不改（附录 B/D/F 继续有效）。
- 服务实现（`com.example.shop.service`）：
  - `L2DemoService#reconcileAsync(long)`：**单线程**固定池（固定 3 线程会让每次 `invocation` 都从 1 开始，禁止）；
    worker 在第一次 submit 时创建，因此复制到**已打开的 controller 帧**；同一 worker 顺序执行 3 个任务，`childCallCounts` 在副本内自增 1..3；
    `thread.id` 三者相同且 ≠ 请求线程；返回 `[100.0,0.0,100.0]`。
  - `L2DemoService#reconcileLoop(long,int)`：`times` clamp 1..200；`local` 初始 0；每轮 `local = local + 1.0d;`；
    `i == 50` 时 `local = 0.0d;`；每轮 `if` 之后有一行**只读取 `local`、不改变它**的锚点语句（使探针能观察到 0 与后续恢复）；
    返回最终 `local`（100 次 → 50.0）。`reconcileBatch` 仍**不插桩**。
  - `NoDebugService#compute(double amount)`：`return amount * 2.0d;`；`@Service`、无 DB/日志；
    源文件先正常编译，再由 `maven-antrun-plugin` 的 `javac debug="false"` 在 `process-classes` 覆盖该 `.class`（无 LVT/LineNumberTable/SourceFile）。
- 前端：`#btn-reconcile-async` → `POST /api/orders/1/reconcile-async`；`#btn-reconcile-loop` → `POST /api/orders/1/reconcile-loop?times=100`；
  no-debug 可仅端点（不强制按钮）。按钮均为普通 click 处理（**不用 `wrapFn`**），**不调用** `loadOrders`，不改变案例 A/B/L1/S6a 的 DOM/函数/请求。
- 运行时事实（S6B-A/B/C 断言口径；离线 fixture 见 `fixtures/s6b-async|s6b-no-debug|s6b-loop`，仅形状，非运行时证据）：
  - async：后端恰 4 span（controller + 3 service）；3 service 同 nodeKey、parent=controller、`startNs` 严格递增、return 100/0/100、
    `values` 1/2/1（第 2 次 `100 → 0`）、`invocation` 1/2/3；三个 `thread.id` 相同且 ≠ controller；flags 含 `L2`+`ASYNC_INHERITED`；
    同线程 `reconcile` 仍 4 span 且**无** `ASYNC_INHERITED`。
  - no-debug：后端恰 2 span；service `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、
    **无 `values`**、无行号伪造、return 200；`javap -l` 必须证明该类无 LVT（有则 S6B-B FAIL）。
  - loop：后端恰 2 span；service `status=TRUNCATED`、flags `L2`+`VALUES_CAPPED=<d>`+`VALUES_TOTAL=<t>`、`values.length=20`、
    `t>20`、`d=t-20`、首项 `from=null`、末项 `to=50`、存在 `to=0` 的坏值；`times=5` 不折叠（`OK`、无 cap flag）；
    `reconcileAmount` 仍 1/2/1 且无 cap。
- **仍不是 S6 的全部**：本附录不承诺行级字段写入（`kind=field` + 行号）、对象深采、多方法 L2、`CompletableFuture`/`@Async`/框架续体、
  长生命周期/已存在线程池的自动传播、跨服务或云端；L2 开销只报告不设硬门槛（`tools/perf/l2-overhead.mjs`，>1.40 仅 WARN）。

## 附录 H：S7 React18/Webpack5 demo（案例 A/B；非 TraceBoard API）

> S7 的第二栈前端位于 `demo/buggy-shop-boot-react/frontend`，**复用** `demo/buggy-shop-boot-vue/backend`（Boot 2.7/H2/JDK8）：
> 后端零业务改动、零新端点；本附录只描述 demo 前端行为与运行方式，不改变 collector 契约面。S7-C 的 SDK 形状事件由 tester 内联构造，
> **不新增 fixture**；所有运行时事实必须来自浏览器/collector，不得用静态文案冒充。

**复用端点（既有，非新增）**

| 方法 | 路径 | S7 行为 |
|---|---|---|
| GET | `/api/orders` | 页面 mount 时读取订单列表（click 外）；订单 1 `SO-0001/CREATED/100.00`；用于 `#order-status` |
| POST | `/api/orders/1/cancel` | 案例 A 唯一请求；`200 {"data":true}`，但 SQL `rowsAffected=0`，订单仍 `CREATED` |

**案例 A/B 前端契约（逐字）**

| 选择器/属性 | 精确文本/行为 |
|---|---|
| `#btn-cancel` | 「取消订单」；click 只发 `POST /api/orders/1/cancel`；不 wrapFn；成功后不刷新列表/不发第二个 fetch |
| `#success-hint` | 仅 2xx 显示 `操作成功`；同点 `uiEffect("操作成功")` |
| `#order-status` | mount GET 后 `CREATED`；A 成功后仍 `CREATED` |
| `#amount-b` | 金额输入（text/inputMode=decimal）；SDK 不采集输入值 |
| `#btn-save-b` | 「保存」；`data-tb-fn="validateForm"`；click 只调 `validateForm`，无 fetch/XHR |
| `#b-error` | 空/非数字/≤0 → `金额必须大于 0`；`RETURNED_FALSE` |
| `#b-pass` | 有效 → `校验通过（本案例不提交）`；`OK` |
| `validateForm` | `OrderEdit.jsx#validateForm`；模块级 `wrapFn` 恰一次；两支都 `uiEffect` |
| `#root` | `public/index.html` 挂载点 |

**SDK / 构建**

- 依赖 `@traceboard/sdk: file:../../../frontend/sdk`，Webpack 解析到已构建的 **`dist/index.js`**；不 import `src`、不改 SDK。
- `initTraceBoard({ingestUrl:"/ingest", sessionId:"s_s7react", appName:"OrderEdit.jsx", observeMs:1500})`。
- React 18.3.1 + react-dom 18.3.1；Webpack 5 + webpack-dev-server 5；Babel preset-env + preset-react automatic；无 TS。
- `devtool:false`（dev/build 无 `.map`）；无 TraceBoard 构建插件、无 AST 插桩、无内联/产出 manifest；`file`/`line` 显示「未采集」。
- `public/index.html` + `#root`；无外链脚本/字体/图片；dist 仅本地资产。
- 不新增 `backend` 子目录；README 明示复用 Vue demo 后端。

**链路期望**

| 案例 | span 数 | 组成 | 关键断言 |
|---|---|---|---|
| A | **7** | `ui_event → fetch → controller → service → mapper → sql` + `render`（render 父=click 根） | `controller.parentSpanId=fetch.spanId`；全 `EXACT`；无 `LOST_BACKEND`；`sql rowsAffected=0/transaction=UNKNOWN`；`GET /api/orders` 仍 `CREATED` |
| B | **3** | `ui_event → js_method → render` | `RETURNED_FALSE`；`fetchCount=0/hasBackend=false/backendSpanCount=0/sdkActive=true`；`OBSERVE_MS=1500` 已关闭 |

**运行（Git Bash，仓库根，路径双引号）**

```bash
(cd "frontend/sdk" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-react/frontend" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-react/frontend" && npm run dev)            # 5175
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s7react \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
(cd "workbench" && npm ci && npm run build && npm run dev)            # 5173；#s3-session 输入 s_s7react
```

- **代理仅 dev**：5175 `/api`→8080、`/ingest`→8601，`changeOrigin:false`；静态 dist 无代理，需自备同源反代（S7 未验证）。
- **A 的 7 span 前提**：fetch + `uiEffect` 须在 1500ms 观察窗内完成；若超时导致 `render` 未入库，只能如实显示 6 span/未采集，不得伪造 7 span。B 必须等窗口关闭后再判定 `fetchCount=0`。
- **限制（如实）**：只支持本地基础案例 A/B；看不到 JS 源码位置/React 组件映射/JS 局部变量/回调内部；无构建插件/sourcemap；云端暂不支持；主计划 §14.2 的「完整（P2）」未交付；不做 Tomcat/WAR/SSM。
- **B 的「零请求」**只指本次 click 因果链；mount GET 在 click 外且 agent 未插桩 `list`；SDK ESM 一次 manifest 探测 fail-open、不发事件，两者均不得计为 B 的请求或后端 EXACT。
