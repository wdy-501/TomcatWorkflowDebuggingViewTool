# S4 分发改订 01 · CLI 寻址 / 诊断语义 / 预览范围 / 图节点字段 / 缺口口径

> 阶段：S4｜编号：**S4-AMD-01**｜日期：2026-11-26｜发布者：**task-dispatch（dispatcher）**｜状态：**生效（binding）**
> 依据：`docs/plans/stages/S4/plan-review.md` G1 FAIL（B1/B2/B6，及 N1/N4/N7/N8/N13）；`dispatch.md` §1.6/§3/§4.1–§4.5/§4.7–§4.10/§5.7/§10。
> 形式：以新增文件生效，`dispatch.md` 本体**不改**；本文件与 `dispatch.md`、`s4-plan.md`、`docs/guides/local-launcher.md` 冲突时，**一律以本文件为准**。
> 本文件只写文档：不含代码、不改 schema/fixture、不执行 git；plan-writer 在 G1 返工中把 plan/guide/契约对齐到本文件后，由 plan-reviewer 重算哈希复评。

## 1. 效力与取代范围

| # | 本修订取代/统一的内容 | 被取代的旧文字（位置） |
|---|---|---|
| 1 | CLI 统一用 `--collector <base>`（origin，如 `http://127.0.0.1:8601`）；agent ingest = `<base>/ingest/v1/events`；preview 转发 `/ingest/v1/events` → `<base>/ingest/v1/events` | `dispatch.md` §3 “ingest 口径”、§4.1 CLI、§4.2/§4.3/§4.4 的 `--ingest`/`--ingest-url` 与 URL 派生；`s4-plan.md` §4.2/§4.10；guide §3–§6 |
| 2 | `diagnose` 七项检查、SKIP/WARN/FAIL、SUMMARY 计数与退出码：**无 FAIL 即 exit 0，WARN/SKIP 不阻塞** | `dispatch.md` §4.1 退出码、§4.10 风险行；`s4-plan.md` §4.6；guide §6（B1 原“SKIP→SUMMARY FAIL/exit 3”建议**不采纳**，本文件为唯一权威） |
| 3 | 预览只面向**静态 HTML origin**（示例 18080），明确不向 Vite demo 5174 注入；响应体改写/头处理/`not-injected:*` 新码；`--allow-non-loopback`；`--sdk` | `dispatch.md` §4.4；guide §3 第 5 步/§5/§5.1；`s4-plan.md` §4.5/§10；`transport.v1.md` §6.6 的“头透传”表述（B3/N1/N4/N13） |
| 4 | launcher 必须用 JDK21 绝对路径（或 `$JAVA_HOME/bin/java`）运行；裸 `java` 不作数；demo/agent 仍用 JDK8 `--java` | guide §3–§6/§5.1 的裸 `java -jar`；`s4-plan.md` §10 与 guide 不一致处（B6） |
| 5 | collector graph 节点**加性**新增只读 `reason`/`source`/`confidence`（`flags` 已存在不变）：14 字段；events/`seq` 不变 | `api.v1.md` §2.4 graph 行与 §8.2 “固定 11 字段”；`workbench/src/api.ts` 注释（B4 的“前端按事件翻页 join”方案作废） |
| 6 | 详情/×N/缺口唯一口径：缺口按 span 去重、fixture 恰 3 条；逐次 `rows` 取自该次调用的 sql 子节点；缺失一律“未采集”，绝不为 0 | `dispatch.md` §4.7 缺口规则；`s4-plan.md` §7；`expected-facts.json` 的 3 条 gaps 与逐次 rows（B5） |
| 7 | Errata：transport 限制、S4-A..S4-I 字母、§4.8 fixture 草图、§4.10 门禁迁移 | `dispatch.md` §1.6/§4.8/§4.9/§4.10/§5.7/§10（见 §8） |

- 冻结边界不变：schema、事件类型/枚举、S0–S3 fixture、demo、`event-model.v1.md`、`status-semantics.md` 零改动；`transport.v1.md` 只允许 S4 增补（§6.5/§6.6/§7）；`api.v1.md` 只允许 §2.4/§8.2 加性注记、§10 增补。
- 本文件新增的 graph 字段与 CLI 行为均**只读/加性**，不产生新的采集能力；运行时 ×3 仍是 S6，`fixtures/s4-details/**` 仍是 UI/测试数据。

## 2. CLI 与 collector 寻址（取代 dispatch §4.1 CLI 块）

```text
idea     --jar <demo.jar> --agent <agent.jar> [--collector <base>] --session <id> [--port 8080]
jar      --jar <demo.jar> --agent <agent.jar> [--collector <base>] --session <id> [--java <java.exe>] [--port 8080] [--health <url>] [--detach] [--pid-file <path>] [--log-dir <path>]
stop     --pid-file <path>
preview  --target <url> [--port 8602] [--collector <base>] --session <id> [--sdk <path>] [--allow-non-loopback]
diagnose [--collector <base>] [--app-url <url>] --session <id> [--preview-url <url>]
```

- `--collector <base>`：collector **origin**，只接受 `http://<loopback-host>:<port>`（末尾 `/` 归一化）；缺省 `http://127.0.0.1:8601`。路径/查询/`https`/非回环主机 → exit 2（`COLLECTOR_URL_INVALID` 或 `NON_LOOPBACK_TARGET`）。旧 `--ingest`/`--ingest-url` **移除**；传入即 exit 2，提示改用 `--collector`。
- 派生 URL（唯一算法，禁止再加前缀）：
  - agent ingest：`<base>/ingest/v1/events`（`-Dtraceboard.ingestUrl` 的值；agent 仍按既有规则把 `/v1/events` 换成 `/v1/agent-hello`）。
  - preview 转发：浏览器请求 `/ingest/v1/events`（SDK 把 `ingestUrl="/ingest"` 拼 `/v1/events`）→ `<base>/ingest/v1/events`；其他 `/ingest/*` 不代理（404）。
  - diagnose 只读：`<base>/actuator/health`、`<base>/api/v1/meta`、`<base>/api/v1/sessions/<id>/agent`、`<base>/api/v1/sessions/<id>/events?afterSeq=0&limit=1`。
- `--session` **除 `stop` 外所有子命令必填**（含 preview，删除 `s_s4demo` 缺省）；必须匹配 `^s_[A-Za-z0-9_-]+$`。
- `--app-url`：真实可 2xx 的应用端点；缺省 `http://localhost:8080/api/orders`。demo 只有 `/api/orders`（GET 200）与 `/api/orders/{id}/cancel`；`/` 与 `/actuator/health` 均为 404，**不得**再用作 health。`jar --health` 若提供也必须是真实 2xx（demo 用 `/api/orders`），省略则按 TCP 存活。`--app-url`/`--preview-url`/`--health` 同样默认只接受回环主机；非回环 → exit 2 + `NON_LOOPBACK_TARGET`（仅 preview 的 `--target` 有 `--allow-non-loopback` 例外）。
- `--preview-url`：可选；给了才执行预览两项检查；必须回环（否则 exit 2）。
- `--java`：demo/agent 运行必须 JDK8；guide 必须显式 `--java "C:/Program Files/Java/jdk1.8.0_221/bin/java"`（`--java` 缺省可能是 PATH 的 JDK8，不保证）。
- `idea` 打印的 VM options 逐字改为：
  ```text
  -javaagent:"<agentAbs>" -Dtraceboard.ingestUrl="<base>/ingest/v1/events" -Dtraceboard.sessionId=<id>
  ```
- 退出码（全局，取代 §4.1 的三码表）：`0` 成功/无 FAIL；`1` launcher 自身未预期错误（`LAUNCHER_ERROR`，不得映射检查结论）；`2` 用法/参数非法；`3` 预期失败（spawn/健康超时/stop 拒绝/diagnose 任一 FAIL）。
- token 仍为 ASCII + 中文可执行建议；既有 token 不变，本修订**新增** `COLLECTOR_URL_INVALID`、`NON_LOOPBACK_TARGET`（均 exit 2）与 `LAUNCHER_ERROR`（exit 1）。

## 3. `diagnose`（唯一权威，取代 §4.1 诊断语义、§4.10 风险行、plan §4.6）

- 检查顺序与集合固定：`collector_health`、`collector_meta`、`app_health`、`agent_handshake`、`recent_events`、`preview_injection`、`sdk_script`。
- `preview_injection` 与 `sdk_script` **只在给了 `--preview-url` 时执行**；未给时两者均为 `SKIP <check>: reason=no_preview_url`，**绝不 FAIL**，也绝不伪造 PASS。
- 每行格式：`PASS|FAIL|WARN|SKIP <check>: <evidence>`。evidence 必须含请求 URL、HTTP 状态与至少一项关键证据（响应头、`version/pid/startedAtMs/lastSeenMs`、事件条数/`nextSeq`、脚本标签是否存在、非注入时 ≤200 字节 body 摘要）；**禁止无证据的 PASS**，禁止打印 secret/完整页面。

| check | 请求 | 判定 |
|---|---|---|
| `collector_health` | `GET <base>/actuator/health` | `200` 且 body `status="UP"` → **PASS**；连接失败 → **FAIL** + `INGEST_UNREACHABLE`；其他 → **FAIL** |
| `collector_meta` | `GET <base>/api/v1/meta` | `200` 且 `capabilities` **恰 5 键**、`realtime=false` → **PASS**；否则 **FAIL**（打印键集合） |
| `app_health` | `GET --app-url`（缺省 `http://localhost:8080/api/orders`） | `2xx` → **PASS**；否则 **FAIL**（打印状态与 Content-Type；不得把 `/` 的 404 当作应用未起） |
| `agent_handshake` | `GET <base>/api/v1/sessions/<id>/agent` | `200` 且 `connected:true` 且 sessionId 匹配 → **PASS**（打印 version/pid/startedAtMs/lastSeenMs）；`404`/其他 → **FAIL**（未握手或 collector 重启，不得显示成功） |
| `recent_events` | `GET <base>/api/v1/sessions/<id>/events?afterSeq=0&limit=1` | `200` 且 `events.length>0` → **PASS**（打印首条 seq/nextSeq）；`200` 且 0 条 → **WARN**（握手仍可能有效）；可达的 `404` → **WARN**（尚无事件）；连接失败/其他 → **FAIL** |
| `preview_injection` | 无 URL → **SKIP**；有 URL → `GET --preview-url` | 仅当 `200` + 头 `X-TraceBoard-Preview: injected` + `/traceboard/config.js` 与 `/traceboard/sdk.js` 两个 script 都在最后一个 `</body>` 之前 → **PASS**；`not-injected:*` → **FAIL**（打印 status/头/摘要）；非 2xx（含上游 4xx/5xx HTML 的 `not-injected:status`）→ **FAIL** |
| `sdk_script` | 无 URL → **SKIP**；有 URL → `GET <preview-origin>/traceboard/sdk.js`（origin = `--preview-url` 的 `scheme://host:port`） | `200` 且 body 含 `TraceBoardSDK` → **PASS**；缺失/不匹配/不可达 → **FAIL** + 构建命令 |

- 末行**精确格式**：`SUMMARY: <PASS|FAIL> pass=<n> warn=<n> fail=<n> skip=<n>`，四个计数之和恒为 7。
- `SUMMARY: PASS` **当且仅当 `fail=0`**；存在 `WARN`/`SKIP` 仍可 PASS/exit 0（这是与 plan-review B1 建议的差异，**以本文件为准**）。
- 退出码：`fail=0` → `0`；`fail>0` → `3`；用法错误 → `2`；launcher 内部未预期错误 → `1`。`WARN`/`SKIP` 不改变退出码。
- 任一检查不得因另一项失败而伪造；collector 不可达时仍继续执行 app/preview 检查并如实记录。未验证项（SDK 浏览器执行、CSP 拦截、全站覆盖、握手代表业务健康）继续输出“未验证”，不得写成 PASS。

## 4. `preview`（取代 §4.4 与 guide/plan 对应命令）

### 4.1 目标与范围

- `preview` 是**注入演示反代**，目标是**静态 HTML origin**（S4-D/guide 用 `127.0.0.1:18080` 的 Node stub 或用户自己的静态页）。
- **不得**宣称向现有 Vite demo（5174）注入：该页已通过 `vite.config.ts` 别名内置 SDK，再经 preview 会二次加载/二次上报。**不得**把 demo 后端 8080 当 HTML 目标：它没有 HTML 页面（`/` 404），只能作为 `/api/orders` 健康端点。
- 仅绑 `127.0.0.1:<port>`（缺省 8602）、无 TLS；`--target` 必须是 `http://`（`https` → `TARGET_TLS_UNSUPPORTED` exit 3）。
- `--target` 缺省只接受回环主机（`127.0.0.1`/`localhost`/`::1`）；非回环 → exit 2 + `NON_LOOPBACK_TARGET`，除非显式 `--allow-non-loopback`；带该开关时先打印 `WARN non-loopback target=<host>` 再继续（仍无 TLS/外部网络）。

### 4.2 路由

- `/traceboard/config.js`：本地生成，逐字
  `window.__TRACEBOARD_CONFIG__ = {"sessionId":"<id>","ingestUrl":"/ingest","appName":"traceboard-preview","observeMs":1500};`
  （`ingestUrl` 仍为 `/ingest`，SDK 自行拼 `/v1/events`，因此代理路径是 `/ingest/v1/events`。）
- `/traceboard/sdk.js`：IIFE 字节。解析优先级：`--sdk <path>` → 系统属性 `traceboard.sdk.iife` → 环境变量 `TRACEBOARD_SDK_IIFE` → **仓库根** `frontend/sdk/dist/traceboard-sdk.iife.js`。禁止“launcher jar 上两级”启发式；guide 要求从仓库根运行。全缺 → `SDK_IIFE_MISSING` exit 3 + 构建命令 `(cd "frontend/sdk" && npm ci && npm run build)`。
- `/ingest/v1/events`：反代到 `<base>/ingest/v1/events`（方法/体/`Content-Type` 原样；collector 不可达 → `502` + 说明，**不伪造 202**）。其他 `/ingest/*` → 404，不做开放写代理。
- 其余方法/路径/查询/头/状态/体：见 4.3；不再声称“所有头无条件透传”。

### 4.3 响应体改写与头（B3 修订）

- 转发到 `--target` 的请求**移除 `Accept-Encoding`**（不添加 `identity`）；不主动协商压缩。
- 仅当上游 `200` + `Content-Type: text/html`（参数允许）+ charset 缺失或 `utf-8` 时才尝试注入。
- 注入：在**最后一个**大小写不敏感 `</body>` 前插入且仅插入
  `<script src="/traceboard/config.js"></script><script src="/traceboard/sdk.js"></script>`；外部脚本、无内联脚本、不改写 CSP、不改写业务 HTML/JS。
- 注入成功时：保留状态码与端到端头；按改写后的 **UTF-8 字节重算 `Content-Length`**；移除 `Content-Encoding`、`Transfer-Encoding`、`ETag`、`Last-Modified`（以及若有 `Content-MD5`）；不转发 hop-by-hop 头（`Connection`/`Keep-Alive`/`TE`/`Trailer`/`Upgrade`/`Proxy-*`）；设置 `X-TraceBoard-Preview: injected`。
- 未注入时：状态/头/体**逐字节透传**，保留上游 `Content-Length`/`Content-Encoding`；不得先解码再声称透传。
- `HEAD`：不注入、不产生 body，返回上游头，标记 `not-injected:head`。`204`/`304`：不注入、无 body，标记 `not-injected:no_body`。其他 `3xx/4xx/5xx`：不注入（错误页也不注入），原样返回，标记 `not-injected:status`。
- `not-injected` 码与判定优先级（先命中先返回）：
  1. `HEAD` → `head`；2. `204/304` → `no_body`；3. 非 `200` → `status`；4. `Content-Encoding` 存在且非 identity → `encoding`；5. 非 `text/html` → `not_html`；6. charset 非 utf-8 → `encoding`；7. `Content-Length`/实际体 > 2MB → `too_large`；8. 无 `</body>` 或 `Content-Length: 0` → `no_body`；9. 读取失败 → `read_error`。
- `not-injected:not_html` 取代旧 `content_type`；`encoding`/`too_large`/`read_error` 保留。`X-TraceBoard-Preview` 头出现在经 target 反代的响应上（`injected` 或 `not-injected:<code>`）；`/traceboard/*` 与 `/ingest/v1/events` 不添加该头。

## 5. launcher 的 JVM（取代 guide 裸 `java` 命令）

- guide §2 固定：
  ```bash
  export JAVA21="C:/Program Files/Java/jdk-21"
  export JAVA8="C:/Program Files/Java/jdk1.8.0_221"
  ```
- 所有 launcher/collector 命令改为 `"$JAVA21/bin/java" -jar ...`（或逐字 `"C:/Program Files/Java/jdk-21/bin/java"`）；设置 `JAVA_HOME` 时必须调用 `"$JAVA_HOME/bin/java"`，**禁止裸 `java -jar`**（PATH 上的 `java` 可能是 JDK8，会在任何 token 前 `UnsupportedClassVersionError`）。
- demo 应用 + agent 仍由 `jar --java "$JAVA8/bin/java"` 以 JDK8 运行；agent major 52 门禁不变。
- guide 排障矩阵新增一行：`UnsupportedClassVersionError` → 用 `$JAVA21/bin/java` 跑 launcher（不是 demo 的 JDK8）。

## 6. graph 节点加性字段（取代 api §2.4/§8.2 “11 字段不变”）

- 授权 coder-handshake 在 collector 只读派生层（`SpanFacts`/`GraphNode`/`TraceDeriver` 及对应测试）加性新增以下字段；`GET .../graph` 节点从 11 字段变为**固定 14 字段**，字段恒出现，顺序固定为：
  `spanId, parentSpanId, kind, nodeKey, status, return, sideEffects, startNs, durNs, thread, flags, reason, source, confidence`。
- 精确形状与语义：

| 字段 | 类型 | 语义 |
|---|---|---|
| `reason` | string \| null | 事件 `reason` 原样；事件无该字段（非 `NOT_COLLECTED_*`）→ `null`；不得改写/截断 |
| `source` | object \| null | 事件 `source` 原样 `{"file": string\|null, "line": int\|null}`；事件无 → `null`；不补默认值 |
| `confidence` | string | 事件 `confidence` 原样（`EXACT/INFERRED/LOST/MANUAL`）；不按节点重算，不伪造 |
| `flags` | array\<string\> | **已存在**，保持事件 `flags` 原样（缺省 `[]`），本次不改语义 |

- `nodes` 顺序、`edges`（`count=1`）、节点数、`rootEventId`、顶层 `confidence`、`sessionId`/`traceId` 全部不变；不聚合、不合并同 `nodeKey`。
- **events/`seq` 不变**：`GET .../events`、`requests`、`replay`、ingest、hello 的输出与写入零改动；不新增存储字段、不改 schema、不改 S0–S3 fixture。
- 合同文档：plan-writer 把 `api.v1.md` §2.4 graph 行与 §8.2 节点表改为“S4 加性 14 字段”，并在 §10 加一条 S4 注记；`transport.v1.md` §6.3 仅加指针，不改线上格式。这是**加性契约变更**，不是 schema 变更。
- workbench 详情直接从 graph 读取 `reason/source/confidence/flags`，**不再**为这三个字段按 `afterSeq/limit` 翻页 join 事件（B4 的 join 方案作废）；`reason` 缺失且 status 为 `NOT_COLLECTED_*` → `未采集（无 reason）`；`source` 非完整 `file:line` → `未采集`。
- S2/S3 graph 回归与 `tools/verify` 的 `GRAPH_NODE_KEYS` 迁移为上述 14 键（仅加性），节点值/边/顺序断言不变；`fixtures/s4-details` 无需修改。

## 7. 详情 / ×N / 缺口（取代 §4.7 缺口与 rows 口径）

### 7.1 详情与 ×N

- 详情字段来源：结构/status/return/sideEffects/thread/flags/start/dur/reason/source/confidence 全部来自 `GET .../graph`；`ui_effect`/`render` 仍按既有 trace 事件展示并标注“按 trace 列出，未推断与所选节点的因果”。
- SQL/数据影响票签 = **所选 span 自身** `sideEffects`：无/空 → `未采集`，**绝不显示 0**；`rowsAffected:0` 原样显示 `0`。
- ×N：同一选中 trace 内按 `nodeKey` 分组（`kind` 仅展示），N≥2 显示 `×N`；`#s4-group-badge` 是**容器**，每组一个带 `data-node-key` 的子元素（避免重复 id），fixture 的两个 `×3` 各自一个徽标。
- `#s4-invocations` 逐次列表按 `startNs` 升序、同值 `spanId` 字典序；切换只改详情，不改 graph/API/边。
- `#s4-invocations` 或 `#s4-gaps` 下方必须有静态说明：`×N 为已采集 span 的前端聚合；运行时 ×3 属 S6`。

### 7.2 缺口规则（fixture 恰 3 条）

按 span 依次判定，优先级 F > N > R；每个 span **最多一条**缺口：

| 规则 | 触发 | 文案 |
|---|---|---|
| F `FETCH_WITHOUT_BACKEND` | `kind="fetch"` 且其 `spanId` 未被任何后端节点（`kind ∉ {ui_event,js_method,fetch,render}`）的 `parentSpanId` 引用 | `后端未采集/未关联`（逐字） |
| N `NOT_COLLECTED_REASON` | `status ∈ NOT_COLLECTED_*` | `未采集 · <reason>`；reason 缺失 → `未采集（无 reason）` |
| R `ROWS_NOT_COLLECTED` | `kind ∈ {mapper,sql}` 且**自身** `sideEffects` 缺失/空，且 status **不是** `NOT_COLLECTED_*` | `未采集` |

- 去重：缺口内部 `reason` 键为 R=`ROWS_NOT_COLLECTED`、N=事件 reason（缺失=`NO_REASON`）、F=`FETCH_WITHOUT_BACKEND`；同一 span 内以 `nodeKey+reason` 为键、按 N > R 只取一条；**不同 span（×N 的逐次调用）不跨 span 合并**。缺口按 span 顺序（`startNs` 升序、同值 `spanId`）输出。
- fixture 结果恰 3 条：mapper1/mapper2 `ROWS_NOT_COLLECTED`（`未采集`）、mapper3 `NOT_COLLECTED_REASON`（`未采集 · policy:third_party_package`）；service ×3 与 sql ×2（自身有 `sideEffects`，含 0）不产生缺口。
- fixture 是 `LOST` 游离后端根，**没有**“未关联 fetch”（D3）；规则 F 由 S4-F 的内联前端批次（`ui_event` + 未被引用的 `fetch`）断言，不得用本 fixture 冒充。
- 空列表逐字：`未发现缺口（仅基于已采集数据；未采集项不会显示为成功）`。

### 7.3 逐次 `rows`（与 expected-facts 对齐）

- 逐次列表的 `rows` 只从该次调用的 **sql 子节点** `sideEffects` 直接读取：自身是 sql → 自身 `rowsAffected`；否则读取该次调用子树内的 sql span（fixture 的 `service → mapper → sql` 单链、`mapper → sql`），列出 `sqlSpanIds` 并标注“子 sql”；无 sql 子节点 → `未采集`。
- fixture：service 第 1/2 次 `rows=[0]`（`sqlSpanIds` 分别为 `c3d4…`/`f601…`），第 3 次 `未采集`（mapper3 无 sql 子节点）；sql 两次自身 `rows=0` 显示为 `0`；mapper3 `未采集`。
- mapper1/mapper2 的逐次 rows 若展示子 sql 的 `0`，必须标注“子 sql”，且 **SQL 票签的自身 sideEffects 仍是 `未采集`**；两者不得混写。任何缺失来源一律 `未采集`，绝不为 0；0 只表示已采集的 `rowsAffected=0`。

## 8. Errata（dispatch 条款逐条）

| 条款 | 本修订的处理 |
|---|---|
| §1.6、§2.1(6)、§5.7 | 测试组字母统一为 **S4-A..S4-I**（9 组）：H = S0–S3 回归，I = 范围/安全/清理；§5.7 的 S4-H 拆为 H/I |
| §3 “ingest 口径” | 改为 `--collector <origin>` + 派生 URL；旧 `--ingest`/`--ingest-url` 删除 |
| §3 “子命令” | 更新为 §2 的新 CLI（含 `--collector`/`--sdk`/`--allow-non-loopback`） |
| §4.1 | 整块由 §2 取代（CLI、默认值、URL、退出码、新增 token） |
| §4.2 | `idea` VM options 用 `<base>/ingest/v1/events`；checklist ④ 的预览目标改为 18080 静态 stub，不指向 demo/5174；launcher 用 JDK21 |
| §4.3 | `jar` 的 `--ingest` 改 `--collector`，argv ingest URL 改 `<base>/ingest/v1/events`；`--health` 用 `/api/orders` 或省略；`--java` JDK8 必须显式；停/杀/PID 语义不变 |
| §4.4 | 整块由 §4 取代（静态目标、回环开关、SDK 路径、body/头规则、`not-injected:status/head/not_html`） |
| §4.5 | hello/agent 契约与存储不变；agent URL 值来自 `<base>/ingest/v1/events`；状态码判定顺序仍以 `api.v1.md` §10.2 的 `405→415→413→400→200` 为准（N8） |
| §4.7 | 由 §6/§7 取代（graph 14 字段、缺口去重、rows 来源、徽标容器、S6 静态说明） |
| §4.8 | fixture 草图作废：实际冻结 fixture 是 `LOST` 游离后端根、9 事件（3 service/3 mapper/2 sql）、3 条缺口、**无未关联 fetch**；D2/D3 为合法偏离，缺口 F 由 S4-F 内联批次断言；不得改 fixture |
| §4.9 | “不改 transport”改为“只允许 `transport.v1.md` §6.5/§6.6/§7 的 S4 增补”；允许 `api.v1.md` §2.4/§8.2/§10 的 S4 加性注记（graph 14 字段）；schema/event-model/status-semantics/S0–S3 fixture 仍零改动 |
| §4.10 | 门禁迁移精确化：`S3-1` IIFE 使 dist 为 3 文件（`index.js`/`index.d.ts`/`traceboard-sdk.iife.js`）、devDeps 加 esbuild、单测仍 8/8；`S2-8` collector 业务路由 7→9、agent 插桩点仍恰 4/4、`getMessage()` 仍禁；`S3-8` 去掉 `launcher\|intellij\|idea-plugin\|VirtualMachine.attach\|tools.jar` 禁项、保留 S5/S6 禁项（sourcemap/构建插件/L1/L2/values/links/SSE/WS/localStorage/图库）、不扫描 `server/launcher/src`；`S3-10` 白名单加 `server/launcher/**`、`docs/guides/**`、`fixtures/s4-details/**`、`docs/plans/stages/S4/**`、根 `pom.xml`；`S1_PORTS` 加 8602/18080；graph 键断言迁移 14 键（仅加性）；`S2-3/S3-3/S3-4/S3-5/S1-C0` 语义不变 |
| §5.7 S4-D/F/G/I | S4-D 增 `Content-Length==UTF-8 字节数`、无 `Content-Encoding/Transfer-Encoding`、HEAD/204/304、gzip→`not-injected:encoding`、非 2xx→`not-injected:status`；S4-F 增 mapper3 reason 逐字/source/confidence、缺口恰 3 条、service 第 3 次 rows=未采集；S4-G 按 §3 的 SUMMARY/exit 断言（有无 preview 两分支）；S4-I 端口含 8602/18080 |
| §10 风险表“无 preview=SKIP 不计 PASS；任何 FAIL exit 3” | 由 §3 取代：WARN/SKIP 允许，`fail=0` 即 exit 0；仍禁止伪造 PASS |
| §11 停止条件 | 不变（不得伪造 PASS、不得把 fixture 当运行时、不得越过 S5/S6） |

- 附注：plan-review B1 的“SKIP → SUMMARY FAIL/exit 3”建议不采纳；B2 的 `collectorOrigin` 去后缀算法不再需要（`--collector` 本身就是 origin）；B4 的“事件翻页 join”改由 graph 加性字段解决；B5 的去重/rows 口径以 §7 为准；B6 以 §5 为准。

## 9. 下游返工与门禁

- **plan-writer**：改 `s4-plan.md` §4.1–§4.7/§7/§9/§10、`local-launcher.md` §2–§7（含全部命令、`/api/orders`、18080、JDK21、SKIP/SUMMARY）、`api.v1.md` §2.4/§8.2/§10、`transport.v1.md` §6.6；同步处理 plan-review 的 N1–N5、N9–N12（N5 徽标容器、N9 静态说明、N11 `version` 导出、N12 stop 匹配、N2 日志重定向、N3 排障行）；不改 schema/fixture/S0–S3 契约章节。
- **coder-launcher**：按 §2–§5 实现 CLI/preview/diagnose；**coder-handshake**：按 §6 加 graph 字段（events/seq/hello 不变）；**coder-workbench**：按 §6/§7 改 `GraphNode` 类型与详情/缺口；**coder-sdk**：路径/构建不变，补 `version` 导出（N11）。
- **tester**：按 §8 迁移 S4-A..S4-I 与 S0–S3 断言；新增 graph 14 键、预览头/长度、诊断两分支；不得放宽“未采集≠0/无伪造 PASS”。
- **plan-reviewer**：复评时重算 G1 哈希（dispatch.md 本体哈希不变；本文件、api/transport/guide/s4-plan 新哈希入表），只允许本修订列出的文件变化。

## 10. 范围边界（不变）

- 本修订不新增 S5/S6/S7 能力：无 L1/L2/参数/变量/`values[]`/字段 diff、无 sourcemap/行号/构建插件、无运行时 ×3（S6）、无异步续体/后台车道/`/links`/时间窗 `INFERRED`（S6）、无 SSE/WS/实时、无持久化/DB/缓存/CORS/鉴权/TLS、无浏览器扩展/CDP、无内联脚本/CSP 改写、无 Tomcat/WAR/React/云。
- 运行时 ×3 仍是 S6；`fixtures/s4-details/**` 仍是 UI/测试数据，不得作为运行时证据；诊断 PASS 只证明本地链路形状，不证明业务正确/SDK 浏览器执行/预览全站覆盖。
- 不改 schema、事件类型/枚举、S0–S3 fixture、demo、H2 seed、案例 A 行为；无 secret/真实客户数据；无代码与 git 写操作（本文件仅文档）。

## 11. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| S4-AMD-01 | 2026-11-26 | 首次发布：`--collector` 统一寻址与 URL 派生；diagnose 七项/SKIP/WARN/SUMMARY/exit 0-3-2-1；预览静态目标、回环开关、body/头改写与 `not_injected` 新码、`--sdk`；launcher JDK21；graph 14 字段加性契约；缺口三规则与逐次 rows；dispatch §1.6/§4.1–§4.10/§5.7/§10 errata；S5/S6/S7 边界不变 |
