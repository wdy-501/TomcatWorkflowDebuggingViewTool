# 事件模型 v1（event-model.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23｜作者：plan-writer（S0）
> 变更记录：**2026-11-23 S1 增补（G1 第 1 轮返工）**——§2/§5/§7/§9/§11 记录“游离后端根（isolated backend request）”这一**唯一例外**
>   （`parentSpanId=null` + `kind=controller` + `confidence=LOST` + 合成 `rootEventId=click_lost_<spanId>` + flag `LOST_BACKEND`）。
>   **仅文档修订：schema 与 fixture 字节未变。**
>   **2026-11-24 S2 澄清（仅短注，无字段/枚举/约束变更）**：①`sideEffects[].transaction="UNKNOWN"` 合法且 S2 默认用它（未采集事务边界，不猜 `COMMITTED`）；
>   ②controller 的 HTTP 状态码可写入 `return`（`{type:"org.springframework.http.ResponseEntity","value":200}` / 404），前端 `fetch` 仍按 §4.3 用 `{type:"http",value:200}`；
>   ③§5 第 2 条“游离后端根”在 S2 是一棵**同 trace 的子链**（根 `parentSpanId=null`，子 span 指向父、继承 `confidence=LOST` 与 `rootEventId`，`LOST_BACKEND` 只写根）。
>   **schema 字节不变**（G1 冻结面零漂移）。
> 机器可校验版本：`schema/traceboard.event.v1.json`（JSON Schema 2020-12，`$id=urn:traceboard:schema:event:v1`）
> 语义来源：主计划 §13.4 / §2.3 / §8.3 / §9.2；分发书 §4.1。本文与 schema 冲突时以 schema 为机器事实、以本文为语义解释。

## 1. 定位

- 事件流是 TraceBoard 的**唯一事实源**：图、详情、回放都是派生视图。
- 一行一个 span 事件（JSONL）；S0 只有 `type=span`，不定义会话级事件。
- schema 完全离线可校验：**无外部 `$ref`、无网络解析**；`$id` 是 URN，不指向可访问地址。
- 顶层 `additionalProperties:false`：v1 草案期新增字段必须走契约变更（见 §10），禁止静默漂移。

## 2. 顶层字段

| 字段 | 类型 | 必填 | 约束与说明 |
|---|---|---|---|
| `schema` | string | 是 | const `traceboard.event.v1` |
| `type` | string | 是 | const `span`；新事件类型需契约变更 |
| `sessionId` | string | 是 | `^s_[A-Za-z0-9_-]+$`；会话分区键 |
| `traceId` | string | 是 | `^[0-9a-f]{32}$`，W3C trace id；同一操作链共用 |
| `spanId` | string | 是 | `^[0-9a-f]{16}$`；会话内唯一 |
| `parentSpanId` | string \| null | 是 | `^[0-9a-f]{16}$` 或 `null`；根 span 为 `null`（含 §5 第 2 条的“游离后端根”唯一例外） |
| `rootEventId` | string | 是 | `^click_[A-Za-z0-9_-]{8,}$`；前端点击根 ID，后端 span 继承；游离后端根使用合成占位 `click_lost_<spanId>`（见 §5 第 2 条例外） |
| `kind` | string | 是 | 见 §3.1，11 值枚举 |
| `nodeKey` | string | 是 | 稳定节点键，1–512 字符；后端建议 `FQCN#method`，前端建议 `源文件#函数` |
| `source` | object | 否 | `{file:string\|null, line:int\|null}`；见 §4.1 |
| `thread` | object | 否 | `{id:int≥0, name:string}`；见 §4.2 |
| `startNs` | integer | 是 | ≥0；相对会话起点的单调纳秒 |
| `durNs` | integer | 是 | ≥0；纳秒 |
| `status` | string | 是 | 8 值枚举，见 §3.2 / `status-semantics.md` |
| `reason` | string | 条件必填 | 非空，1–512 字符；`NOT_COLLECTED*` 时必填（if/then 强制） |
| `return` | object \| null | 否 | `{type:string, value:any}` 或 `null`；见 §4.3 |
| `values` | array | 否 | 值级事实数组，见 §4.4；S0 案例 A 不使用 |
| `sideEffects` | array | 否 | 数据副作用，v1 仅 SQL，见 §4.5 |
| `confidence` | string | 是 | `EXACT\|INFERRED\|LOST\|MANUAL`，见 §3.3 |
| `flags` | array\<string\> | 是 | 去重，元素 `^[A-Za-z0-9_.:=+-]+$`，≤32 项；见 §7 |

`schema`/`type` 为常量；`required` 的 14 个键即使值为 `null`（如 `parentSpanId`）也必须出现。

## 3. 枚举

### 3.1 `kind`（11 值，与主计划 13.4 一致）

| 值 | 含义 | 典型 emitter |
|---|---|---|
| `ui_event` | 控件点击/输入等用户事件（操作根） | 前端 |
| `js_method` | 前端函数/方法调用 | 前端 |
| `fetch` | fetch/XHR 请求-响应 | 前端 |
| `controller` | MVC 控制器方法 | 后端 agent |
| `service` | 业务服务方法 | 后端 agent |
| `mapper` | 数据访问接口方法 | 后端 agent |
| `sql` | 实际执行的 SQL 语句 | 后端 agent（JDBC 探针） |
| `jdbc` | JDBC 调用层 | 后端 agent |
| `async` | 异步任务/线程池派生 span | 前后端 |
| `callback` | 响应回调/then 处理器 | 前端 |
| `render` | 渲染/UI 效果 | 前端 |

### 3.2 `status`（事件级投影，8 值）

| 值 | 一句话语义 |
|---|---|
| `OK` | 正常返回（含 true/false 之外的一切值；0 也是正常返回） |
| `RETURNED_FALSE` | 正常返回了布尔 `false` |
| `THREW` | 抛出异常 |
| `NOT_COLLECTED_POLICY` | 被采集策略排除 |
| `NOT_COLLECTED_LOST` | 事件/关联丢失或采集中断 |
| `NOT_COLLECTED_NO_DEBUG_INFO` | 字节码无调试信息，给不出变量名/行号 |
| `TRUNCATED` | 值被截断/折叠/采样（事件级标记，展开到值级） |
| `UNKNOWN` | 进入但无正常退出（进程结束/超时/崩溃） |

`REDACTED` 不在事件级枚举：脱敏是**值级**标记 `values[].redacted=true`。
`LOST` 也不在事件级枚举：关联丢失是 `confidence=LOST`。完整语义见 `status-semantics.md`。

### 3.3 `confidence`（4 值，主计划 §8.3）

| 值 | 条件 |
|---|---|
| `EXACT` | traceparent + clickId 链路完整 |
| `INFERRED` | header 丢失但时间窗/指纹吻合（推断，可确认） |
| `LOST` | 只有一端（前端有请求后端无 span，或反之）→ 游离区；**后端有请求无前端根**的具体形状见 §5 第 2 条例外（S2 起该游离后端根可带同一 trace 的子链，子 span 继承 `LOST`） |
| `MANUAL` | 用户手工建立关联；回放保持，但不伪装自动 |

## 4. 嵌套对象

### 4.1 `source`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `file` | string \| null | 否 | 相对路径或文件名；不得写本机绝对路径 |
| `line` | integer \| null | 否 | ≥0；无调试信息时为 `null`，不猜 |

### 4.2 `thread`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | integer | 是 | ≥0；OS/JVM 线程 id |
| `name` | string | 是 | 1–128 字符，如 `http-nio-8080-exec-1`、`browser-main` |

### 4.3 `return`

- `null` 表示无返回值/未采集到返回值（与 `OK` 并存合法）。
- 对象形态 `{type:string, value:any}`：`type` 非空、≤64 字符；`value` 允许任意 JSON（含 `null`）。
- `type` 推荐词表（**契约建议，不强制枚举**）：`boolean`、`int`、`long`、`double`、`string`、`object`、`array`、`http`、`ui_effect`。
- **HTTP 约定**：`fetch`（或 `controller`）事件的 HTTP 状态码写在 `return={type:"http", value:200}`。
  case A 选择把它放在 `fetch` 事件上；回调事件的 `return.type="ui_effect"`，`value` 为用户可见提示文案。
- **S2 澄清（controller）**：后端 controller 没有前端 `fetch` 事件时，可直接在 controller span 上用真实返回类型的 FQCN 作为 `type`、
  用 HTTP 状态码作为 `value`，例如 `{"type":"org.springframework.http.ResponseEntity","value":200}`（未知 id 为 404）。
  这是同一 HTTP 约定的后端写法（agent 反射读取状态码，读不到就 `value=null`，不猜）；仍不记录响应 body。
- 对象值只放摘要：深度 ≤4、字段 ≤30、字符串 ≤2KB（主计划 §9.2）；大对象去重（`valueRef`）为 v1 预留，见 §9。

### 4.4 `values[]`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 变量/字段/参数名，1–128 字符 |
| `kind` | string | 是 | `local\|field\|param\|return` |
| `line` | integer \| null | 否 | ≥0；行号未知为 `null` |
| `from` | any | 否 | 旧值（可 `null`） |
| `to` | any | 否 | 新值（可 `null`） |
| `truncated` | boolean | 否 | 默认 `false`；为 `true` 表示值被截断/折叠 |
| `redacted` | boolean | 否 | 默认 `false`；为 `true` 时 `from/to` 必须已是占位符/长度/哈希，**不得含原值** |
| `invocation` | integer | 否 | ≥1；同一方法第几次调用（×N），单次可省略 |

- 值级标记是 `REDACTED`/`TRUNCATED` 语义的落点；事件级 `status=TRUNCATED` 时至少一个值项或
  `flags` 说明截断范围。
- S0 案例 A 不含 `values`（不暗示 L2 采集能力）。

### 4.5 `sideEffects[]`（v1 仅 SQL）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | string | 是 | const `sql` |
| `sqlId` | string | 是 | 稳定语句 ID，如 `OrderMapper.cancelById` |
| `rowsAffected` | integer | 是 | ≥0；`0` 是正常事实，不是错误 |
| `transaction` | string | 是 | `COMMITTED\|ROLLED_BACK\|UNKNOWN` |

- SQL 文本与参数**不进入 v1**（隐私/预算）；字段级 SQL 参数（脱敏后）是 L1 契约变更，见 §9。
- 一条事件可带多个 SQL（批处理），顺序即执行顺序。
- **S2 澄清**：`transaction="UNKNOWN"` 合法且是 S2 的默认值——S2 agent 在 MyBatis `PreparedStatementHandler#update` 处只能确定
  **影响行数**，看不到事务是否提交，因此写 `UNKNOWN`（不猜 `COMMITTED`）；`rowsAffected=0` 是正常事实，不是错误状态。

## 5. 不变量（校验工具会检查，评审也按此核对）

1. `spanId` 会话内唯一；`parentSpanId` 指向的 span 必须在同一流中出现（S0 fixture 必须满足；
   未来允许缺失并标 `NOT_COLLECTED_LOST`，需契约变更）。
2. `parentSpanId=null` 只出现在**根 span**上，且同一 `traceId` 只有一个根。S1 的根只有两种，除此之外任何 `parentSpanId=null` 都是契约违规：
   - **操作根**：前端 `ui_event`（S0 样例的形状），`rootEventId` 由前端点击生成；
   - **S1 例外——游离后端根（isolated backend request）**：一次后端请求**没有任何前端根**时（主计划 §8.3“后端有请求但无前端根 → 游离区”），
     允许一条后端根 span：`parentSpanId=null`、`kind` 为后端 kind（**S1 只允许 `controller`**，且**不得**为 `ui_event`）、
     `confidence=LOST`、`flags` 必须含 `LOST_BACKEND`；其 `traceId` 由该 span 独占（不得与任何前端或其它游离根的 `traceId` 相同）。
     **S2 补充（同一条例外的子链）**：该游离后端根可以拥有**同一 `traceId` 内的子 span**（`parentSpanId` 指向本 trace 的 span，
     `kind` 为后端 kind：S2 为 `service`/`mapper`/`sql`），子 span 继承 `confidence=LOST` 与同一 `rootEventId`；
     `LOST_BACKEND` 仍**只写根**（它描述“整条链没有前端根”，不是每个子节点各带一次）。该 `traceId` 仍不得含任何前端事件（`ui_event`/`js_method`/`fetch`/`callback`/`render`）。
   `ui_event` 根与游离后端根不得共存于同一 `traceId`；游离后端根说明“这条链没有前端点击”，不表示关联失败或推断成功。
3. 同一 `traceId` 内的所有事件共用同一 `rootEventId`；前端点击生成，后端通过 traceparent + clickId 继承。
   **唯一例外**是第 2 条的游离后端根：其 `rootEventId` 由本端合成占位 `click_lost_<该 span 的 spanId>`
   （仍满足 `^click_[A-Za-z0-9_-]{8,}$`），表示“这条链没有前端点击”；不得写成真实 clickId，也不得与任何前端 `rootEventId` 相同。
4. 文件顺序按 `startNs` 非降序；子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。**唯一例外**：`kind=callback`（响应回调）允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span（`parentSpanId=null` 的祖先）区间内。
5. `startNs`/`durNs` 是整数纳秒；禁止浮点、禁止负数、禁止回退。
6. `status` 与 `confidence` 正交：`EXACT` 不等于 `OK`；`LOST` 是置信度而非状态。
7. `NOT_COLLECTED*` 必须有非空 `reason`（schema if/then 强制）。
8. 事件内不得出现真实客户数据/secret（见 §8）。

## 6. `reason` 约定

- 形态建议 `category:detail`（小写、下划线），如 `policy:third_party_package`、
  `lost:ingest_disconnected`、`nodebug:no_local_variable_table`。
- 面向用户展示时要给出“为什么没采到 + 怎么开启/改善”，不得空泛。
- `reason` 不替代 `status`；`OK` 事件不应携带 `reason`。

## 7. `flags` 约定

| flag | 含义 | 状态 |
|---|---|---|
| `DROP_COUNT=<n>` | 会话累计丢弃事件数；`0` 表示未丢弃 | v1 使用，case A 每行携带 |
| `LOST_BACKEND` | 该 span 是只有后端一端的**游离后端根**（`parentSpanId=null`、`confidence=LOST`、`rootEventId=click_lost_<spanId>`，见 §5 第 2 条例外） | v1 使用（S1 起由 agent 写入） |
| `SAMPLED` | 本 span 经过采样 | 预留（v1 可写） |
| `L2` | 该 span 走深度档采集 | 预留（v1 可写） |
| `SKELETON` / `S1_ONE_METHOD` / `S1_WALKING_SKELETON` | S1 walking skeleton 的**阶段标记**（只说明采集范围/来源，不承载关联语义） | 本阶段使用 |
| `S2_ZERO_ROW_CHAIN` | S2 0 行事实链的**阶段标记**（controller/service/mapper/sql 四点采集；只说明采集范围/来源，不承载关联语义） | 本阶段使用（S2 起由 agent 写入全部 4 个 span） |

- flag 是**提示**，不改变 `status`；未知 flag 读取方必须忽略而非报错（但 schema 只允许上述字符集）。
- `SKELETON`/`S1_ONE_METHOD`/`S1_WALKING_SKELETON` 是本阶段标记：读取方一律按“未知 flag 忽略”规则处理，不得据此推断关联或能力。
- 静默丢弃不可接受：任何丢弃都必须以 `DROP_COUNT` 或 `NOT_COLLECTED_LOST + reason` 出现（主计划 §9.2）。

## 8. 隐私与预算（v1 摘要）

- 事件按 session 分区；单 span ≤64KB、单请求 ≤4MB（目标值，见 `transport.v1.md`）。
- 默认脱敏字段名/注解/正则：password、token、secret、authorization、cookie、idcard、phone、email、bankcard 等。
- 脱敏值必须是占位符/长度/哈希；`redacted=true` 但含原值属于契约违规。
- 无遥测、无外部上报；collector 只监听本机（S0 端口 8601）。

## 9. v1 明确不含（预留，需契约变更）

| 项 | 说明 |
|---|---|
| 异常详情（类型/message/栈） | `THREW` 只表状态；异常 payload 属 S1/S2 契约变更 |
| SQL 文本与参数 | L1 计划；v1 仅 `sqlId` + `rowsAffected` |
| `valueRef` 内容寻址 | 大对象去重预留；v1 只放摘要 |
| 事件类型扩展 | `session_start`/`graph_patch` 等未定义 |
| 异步上下文/跨服务字段 | `async` kind 已留，上下文传播字段未定义 |
| 关联规则表/游离区结构 | S1 起允许 §5 第 2 条的**游离后端根形状**（`parentSpanId=null` + `kind=controller` + `confidence=LOST` + `rootEventId=click_lost_<spanId>` + flag `LOST_BACKEND`）；关联规则表、时间窗推断、游离区合并/手工关联（`MANUAL`）仍属后续检查点 |

**S0 边界**：S0 的样例只证明“可校验的契约 + fixture 样例”，不代表已具备采集/关联能力。
**S1 边界**：S1 只有 §5 第 2 条例外描述的最小后端根采集（单方法 agent，`confidence=LOST`）；仍无任何关联/合并/推断能力。
**S2 边界**：S2 采集 4 个后端 span（`controller/service/mapper/sql` 的 `confidence=LOST` 游离后端请求链）与 SQL `rowsAffected`；
仍无前端 SDK/`traceparent`/clickId 传播、无关联/合并/推断、无 `values`/异常 payload、无回放/实时。0 行只是返回事实，不是错误状态。

## 10. 变更流程

1. 修改 schema 必须同时更新本文与 `fixtures/` 校验样例，并跑 `tools/verify`。
2. G1 后 schema/契约/fixtures 冻结；变更需在任务卡中显式立项并由 reviewer 复核。
3. 不允许“只加字段不写契约”“只改 fixture 不改 schema”的静默漂移；`additionalProperties:false` 会直接拒绝。
4. 语义变更（如 status 新增值）必须同步 `status-semantics.md` 与主计划 §2.3 投影说明。

## 11. 参考样例

- 合规样例（S0，前端点击链）：`fixtures/case-a-zero-rows/events.jsonl`（9 行，全 `OK`/`EXACT`）。
- 期望事实（S0）：`fixtures/case-a-zero-rows/expected-facts.json`。
- S1 假前端批次（2 行，全 `OK`/`EXACT`，点击链）：`fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson`。
- S1 游离后端根样例（1 行）：`fixtures/s1-walking-skeleton/agent-controller-span.json`
  （`kind=controller`、`parentSpanId=null`、`confidence=LOST`、`rootEventId=click_lost_<spanId>`、flags 含 `LOST_BACKEND`；§5 第 2 条例外）。
- **S2 0 行事实链样例（4 行，单 trace，全 `OK`/`LOST`）**：`fixtures/s2-zero-row-chain/events.ndjson`
  （controller 根 + service + mapper + sql 子链；SQL `rowsAffected=0`/`transaction=UNKNOWN`；flags `S2_ZERO_ROW_CHAIN`，根另含 `LOST_BACKEND`）。
  期望事实：`fixtures/s2-zero-row-chain/expected-facts.json`（6 条 fact + `globalAssertions`）。
- 校验入口：`(cd "tools/verify" && node verify.mjs)`（S0/S1 门禁；S2 由 tester 扩展 S2-A..S2-L）。