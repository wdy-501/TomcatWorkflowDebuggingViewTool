# 事件模型 v1（event-model.v1）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23（S3 增补：2026-11-24；S4 增补：2026-11-24；S5 增补：2026-11-27；S6a 增补：2026-11-23）｜作者：plan-writer（S0）
> 变更记录：**2026-11-23 S1 增补（G1 第 1 轮返工）**——§2/§5/§7/§9/§11 记录“游离后端根（isolated backend request）”这一**唯一例外**
>   （`parentSpanId=null` + `kind=controller` + `confidence=LOST` + 合成 `rootEventId=click_lost_<spanId>` + flag `LOST_BACKEND`）。
>   **仅文档修订：schema 与 fixture 字节未变。**
>   **2026-11-24 S2 澄清（仅短注，无字段/枚举/约束变更）**：①`sideEffects[].transaction="UNKNOWN"` 合法且 S2 默认用它（未采集事务边界，不猜 `COMMITTED`）；
>   ②controller 的 HTTP 状态码可写入 `return`（`{type:"org.springframework.http.ResponseEntity","value":200}` / 404），前端 `fetch` 仍按 §4.3 用 `{type:"http",value:200}`；
>   ③§5 第 2 条“游离后端根”在 S2 是一棵**同 trace 的子链**（根 `parentSpanId=null`，子 span 指向父、继承 `confidence=LOST` 与 `rootEventId`，`LOST_BACKEND` 只写根）。
>   **schema 字节不变**（G1 冻结面零漂移）。
>   **2026-11-24 S3 增补（仅语义，无字段/枚举/约束变更）**：新增 §12——runtime SDK 的 `ui_event/js_method/fetch/render` 事件、click 根身份、
>   `SDK_ACTIVE`/`S3_RUNTIME_SDK`/`OBSERVE_MS=<n>` flags、`traceparent`/`X-TraceBoard-Click` 头与 controller EXACT 关联、纯前端零请求链、
>   DOM 效果语义、区间/异步回落规则、LOST 回退与无 PII。**schema 字节不变**；`status-semantics.md` 不改（S3 不新增状态语义）。
>   **2026-11-24 S3 G1 前补丁（时钟模型，仅语义，无字段/枚举/约束变更）**：`startNs` 由“相对会话/SDK init”统一为**本机 epoch 纳秒**；
>   新增 §12.10（SDK/agent 公式、collector 原样存储、工作台显示归一化、fixture 示意值、NTP/墙钟跳变风险、V1 仅单机）。
>   **schema 字节不变**：`startNs` 仍是 `integer ≥ 0`；schema 内 `description` 文字不改（其“since session start”按 §12.10 解释）。
>   **2026-11-27 S5 增补（仅语义，无字段/枚举/约束变更）**：`values[]` 首次被真实使用——S5 只输出 `param|field|return`（§4.4），
>   并新增 flag `L1`/`SOURCE_MAPPED`/`VALUES_CAPPED=<n>`/`L1_SKIPPED=<n>`（§7）、脱敏/截断/预算口径（§4.4/§8）、
>   前端 manifest 的 `source` 语义（§12.11，**不是** `.map` 解码）。**`kind=local`、行级变量、对象深采、异步续体、运行时 ×3 仍属 S6，S5 不产生。**
>   **schema 字节不变**（`values` 自 v1 起就是可选字段，`items` 已含 `param|field|return`；S5 未新增任何字段/枚举/约束）。
>   **2026-11-23 S6a 增补（仅语义，无字段/枚举/约束变更）**：`values[]` 首次使用 `kind=local`——S6a 只对
>   `com.example.shop.service.L2DemoService#reconcileAmount` 一个方法做 LVT 行级探针（§4.4.7）：`line` 为 **1-based 源行**、
>   `from`→`to` 为帧内上一值→本次值（每次调用首项 `from=null`）、`invocation` 为父 controller 帧内逐次序号（1..3，每请求重置）；
>   新增 flag `L2`（仅该 service span；§7）。**`kind=local` 不得出现在任何未插桩方法上**；异步续体/线程池/`CompletableFuture`/`@Async`、
>   `NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI、无 LVT 的降级事件、行级字段写入、对象深采、多方法选择、循环折叠/采样/丢弃预算、
>   L2 开销门槛仍属 **S6b**，S6a 不产生也不宣称。**schema 字节不变**（`local`/`line`/`invocation` 自 v1 起即合法）。
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
| `startNs` | integer | 是 | ≥0；**S3 起为本机 epoch 纳秒**（SDK/agent 同机同源墙钟，公式与限制见 §12.10）；不再表示“相对会话起点” |
| `durNs` | integer | 是 | ≥0；纳秒 |
| `status` | string | 是 | 8 值枚举，见 §3.2 / `status-semantics.md` |
| `reason` | string | 条件必填 | 非空，1–512 字符；`NOT_COLLECTED*` 时必填（if/then 强制） |
| `return` | object \| null | 否 | `{type:string, value:any}` 或 `null`；见 §4.3 |
| `values` | array | 否 | 值级事实数组，见 §4.4；S0 案例 A 不使用，S5 起 demo `previewDiscount` 使用 |
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
  用 HTTP 状态码作为 `value`，例如 `{"type":"org.springframework.http.ResponseEntity","value":200}`（S0/S2 `cancel` 未知 id 为 404 是历史口径；S5 `preview-discount` 的未知 id 仍 `200 {"data":0}`，见 `api.v1.md` 附录 D，两者不冲突）。
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

#### 4.4.1 S5 语义：`param` / `field` / `return`（唯一被使用的三种 kind）

| kind | 含义 | `from` | `to` | `line` |
|---|---|---|---|---|
| `param` | 方法**入参**（按声明顺序） | 恒 `null`（没有“旧值”） | 实参值（标量；脱敏/截断后） | `null`（S5 不行级采集） |
| `field` | **对象字段写入**的 old→new（同一方法内，按发生顺序） | 写入前的值 | 写入后的值 | `null`（S6 才带行号） |
| `return` | 方法**返回值** | 恒 `null` | 返回值（标量；脱敏/截断后） | `null` |

- S5 **只采集** `String`/`number`/`boolean` 标量；对象/数组/集合/异常**不递归**（`depth ≤4` 只是为将来的对象摘要预留，S5 不实现深采）。
- `kind=local`（局部变量）与行级写入**属 S6**：S5 事件中出现 `kind=local` 即越界。
- 顺序固定：**参数声明顺序 → 字段写入发生顺序 → 返回**；`line` 恒 `null`；单次调用省略 `invocation`（×N 逐次属 S6）。
- **省略规则**：一个 span 没有值级事实时**整个 `values` 键省略**（不得写 `[]`），以保持 S0–S4 事件字节兼容；graph 派生层把“无该键”呈现为 `values:null`（`api.v1.md` §10.9）。
- `values` 不改 `status`：`truncated=true` 是**值级**标记，事件仍是 `OK`（不改成 `TRUNCATED`）。

#### 4.4.2 脱敏（先于截断；绝不出现原值）

- 名称正则（大小写不敏感，**名称包含即命中**）：`password|token|secret|authorization|cookie|idcard|phone|email|bankcard`。
- 命中后：`redacted=true`，`to` **只能**是占位符 `[REDACTED len=<n>]`（`<n>` = 原值 UTF-8 字节数；ASCII 下等于字符数），`from` 恒 `null`（param/return）或同样占位符（field）。
  原值**不得**出现在 `to`/`from`/`flags`/`reason`/`nodeKey`/任何字段里。
- demo `demoSecret`（值 `s3cr3t`）必须命中 → `"[REDACTED len=6]"`、`redacted=true`。
- 脱敏**先于**截断：先按名字判定占位符，再谈长度预算（占位符本身远小于 2KB）。
- 无“关闭脱敏”开关（S5 不提供；主计划 §9.3 的本地关闭能力不在本阶段范围）。

#### 4.4.3 截断（值级、按 UTF-8 字符边界）

- 单值字符串上限 **2048 UTF-8 字节**；按**字符边界**截断（不切开多字节字符 / 代理对），结果 **≤2048 字节**。
- 截断时 `truncated=true`，`to` 就是**截断后的值本身**；S5 **不追加**省略号 `…` 或其他标记字符（预算只算值本身）。
- demo `note`（3000 个 `x`）→ `to` 恰为前 **2048** 个 `x`、`truncated=true`。
- 截断不改 `status`；UI 用 `已截断` 徽标呈现。

#### 4.4.4 预算与“不静默丢弃”

| 预算 | 值 | 超出时 |
|---|---|---|
| 单 span 字节 | ≤64KB（collector 行上限；**agent 侧在 `values` 序列化后自行测量，现有 `SpanEmitter`/`EventSender` 没有该限制**） | 按顺序丢弃尾部值项并追加 flag `VALUES_CAPPED=<n>`（`n`=丢弃项数），**不静默** |
| 单 span 值项数 | ≤30 | 保留前 30 项，追加 `VALUES_CAPPED=<n>`（`n`=被截掉的项数） |
| 对象深度 | ≤4（**预留**，S5 不递归对象） | 非标量参数/返回值**跳过**，追加 `L1_SKIPPED=<n>`（`n`=跳过项数） |
| 对象字段 | ≤30（**预留**，S5 不递归对象） | 对象不展开（S5 整体按“非标量”跳过并计入 `L1_SKIPPED`） |
| 单值字符串 | ≤2048 UTF-8 字节 | `truncated=true`（§4.4.3） |

- demo 的 5 个值（1 个 2KB 字符串 + 4 个标量）**不触发** `VALUES_CAPPED`/`L1_SKIPPED`；测试断言这两个 flag **不存在**（S5-B）。
- 跳过只允许发生在“非标量/不可读”上，且必须**计数可见**；静默丢弃是契约违规（主计划 §9.2）。

#### 4.4.5 S5 demo 的精确 `values`（`OrderService#previewDiscount`）

```json
[
 {"name":"requestedAmount","kind":"param","line":null,"from":null,"to":100,"truncated":false,"redacted":false},
 {"name":"demoSecret","kind":"param","line":null,"from":null,"to":"[REDACTED len=6]","truncated":false,"redacted":true},
 {"name":"note","kind":"param","line":null,"from":null,"to":"<恰 2048 个 x>","truncated":true,"redacted":false},
 {"name":"amount","kind":"field","line":null,"from":100,"to":0,"truncated":false,"redacted":false},
 {"name":"return","kind":"return","line":null,"from":null,"to":0,"truncated":false,"redacted":false}
]
```

- 只在 **service** span 上；`flags` 含 `L1`（并沿用 `S2_ZERO_ROW_CHAIN`）；`return={"type":"double","value":0}`。
- **参数项恰 3 个**：`requestedAmount`/`demoSecret`/`note`（按声明顺序）；服务签名的第 0 参 `long id` 是路径参数，**不进入 `values`**（不得出现 `name="id"`），因此总数恰 5 项。
- controller span **无 `values`**（链上也没有 mapper/sql span）。
- 字段 100→0 **恰一条**：MyBatis hydration 的 0→100（装载订单）必须在 advice 层被排除（类名精确匹配 + 顶层 frame 是 `previewDiscount` + 栈中无 `org.apache.ibatis` 帧 + `old != new`；见 `s5-plan.md` §6）。
- 明细行为/端点口径见 `api.v1.md` 附录 D。

#### 4.4.6 明确不在 `values` 里（S5）

- 局部变量、行级变量表、逐行写入（`kind=local`/`line` 非空，S6）。
- 对象深字段、集合元素、`toString()`/getter 调用结果（S5 不递归、不调用 getter 之外的方法）。
- 异常类型/message/栈（`THREW` 仍只表状态）。
- SQL 文本与 SQL 参数（§4.5 不变）。
- 请求/响应体、HTTP 头、cookie、表单值、查询串。

#### 4.4.7 S6a 语义：`kind=local` 行级局部变量（唯一方法：`L2DemoService#reconcileAmount`）

| 项 | S6a 精确口径 |
|---|---|
| 范围 | 仅 `com.example.shop.service.L2DemoService#reconcileAmount(long,double,int)` 一个方法（LVT 探针）；其它方法（含 `reconcileBatch`）无 L2、无值项 |
| `name` | 恒 `local`（LVT 中名为 `local`、描述符 `D` 的变量；找不到即整类不插桩、fail-open，不猜名） |
| 探针 | 读 `LocalVariableTable`（不得跳过调试信息），活性区间 **含 start**（`lvtStart <= offset < lvtStart + lvtLength`）；在行边界（下一行真实指令起点/return 前）插探针，以 jump/return/switch 结束的行不插，帧内去重兜底；初始化行探针偏移 = LVT start，必须采到首个值（100）；demo 方法恰 2 个探针（初始化行与 `local = 0` 行）；行号示例 22/24 仅为示意，测试重算 |
| `kind` | 恒 `local`；L2 span **不出现** `param`/`field`/`return` 值项（方法返回值走事件 `return` 字段；入参不采；S6a 不采行级字段写入） |
| `line` | **1-based 源行号**（探针执行所在行；来自 LVT/行表，不是 `source.line`）；第 1/3 次为初始化行，第 2 次第二项为 `local = 0` 行 |
| `from` | 帧内**上一值**；每次调用首项恒 `null`；坏行项为 `100` |
| `to` | 探针读到的当前值；第 1/3 次 `100`，第 2 次第二项 `0` |
| `invocation` | 1..3，父 controller 帧内同 nodeKey 的调用序号（每请求重置）；S6a 恒出现 |
| 去重 | `previous` 按 `(frame,name)` 保存：**帧内首次探针或值变化才追加**；同值重复探针不追加（逐行探针不会逐行刷值）。首次观测 `from=null` 只是基线，**不是值变化**（值变化判定用于 UI：`from` 非空且 `from !== to`） |
| 顺序 | 同一 span 内按探针执行顺序；键序 `name,kind,line,from,to,truncated,redacted,invocation`（项内/事件内键序不属契约） |
| 标记 | `truncated=false`、`redacted=false`（数字标量、无敏感名）；`L2` 是 span 级 flag（§7），不是值项字段 |
| 预算 | S6a demo 每 span ≤2 项，不触发 `VALUES_CAPPED`/`L1_SKIPPED`；循环折叠/采样/丢弃预算属 S6b |

**S6a 精确形状（三次调用，同一 nodeKey；示例行号 22/24 为 demo 源码示意）**

```json
[
 {"name":"local","kind":"local","line":22,"from":null,"to":100,"truncated":false,"redacted":false,"invocation":1}
]
[
 {"name":"local","kind":"local","line":22,"from":null,"to":100,"truncated":false,"redacted":false,"invocation":2},
 {"name":"local","kind":"local","line":24,"from":100,"to":0,"truncated":false,"redacted":false,"invocation":2}
]
[
 {"name":"local","kind":"local","line":22,"from":null,"to":100,"truncated":false,"redacted":false,"invocation":3}
]
```

- 行号 22/24 只是示意；运行/测试以 `L2DemoService.java` 重新计算的两行（初始化行、`local = 0` 行）为准，禁止硬编码。
- span 级：`kind=service`、`nodeKey=com.example.shop.service.L2DemoService#reconcileAmount`、`return={"type":"double","value":100|0}`、
  `status=OK`（THREW 时不编造 return）、`flags` 含 `S2_ZERO_ROW_CHAIN` + `L2`（无 `L1`；service 子 span 不带 `S3_EXACT_LINK`）、
  `confidence` 继承 controller（有合法头 `EXACT`；无 controller 父帧不 emit，不伪造 LOST 子 span）、`source` 来自 JVM 栈（`L2DemoService.java:<line>`）。
- **不猜**：类/方法/LVT 缺失 → 原始字节（不插桩）、无事件、无假值，日志计数 `l2_no_method`/`l2_no_lvt` 并记录静态 `l2Reason=NO_LVT` 供 S6b；
  S6a **不**产生 `NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI（S6b）。
- L2 span 上的 `param`/`field`/`return` 值项、行级字段写入、对象深采、多方法 L2、异步续体、循环折叠、采样/丢弃预算与 L2 开销门槛**均属 S6b**，S6a 出现即越界。

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
4. 文件顺序按 `startNs` 非降序（对 fixture 与单来源文件成立；S3 混合前端/后端批次的**入库顺序不承诺**，读取端一律按 `startNs` 排序，见 §12.10）；子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。**唯一例外**：`kind=callback`（响应回调）允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span（`parentSpanId=null` 的祖先）区间内。
   **S3 解释**：`kind=render` 的 UI 效果与 `callback` 同属“父请求结束后才发生的 UI 效果”；当它的父是 `fetch` 时按同一例外处理（结束于父之后、但必须落在 click 根内）；
   当它的父是 click 根或 `js_method` 时按普通包含规则。S3 fixture 的 `render` 分别挂 click 根（案例 A）与 `validateForm`（案例 B），因此不额外放宽区间规则。
5. `startNs`/`durNs` 是整数纳秒；禁止浮点、禁止负数、禁止回退。S3 起 `startNs` 是 epoch 纳秒（同一 emitter 内不倒退），
   `durNs` 始终由单调时钟差值得到（SDK `performance.now()`、agent `System.nanoTime()`），墙钟跳变风险见 §12.10。
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
| `L2` | 该 span 走**L2** 行级采集（S6a：仅 `L2DemoService#reconcileAmount` 的 service span；`values` 含行级 `local`，见 §4.4.7） | S6a 使用（agent 写 reconcileAmount service span） |
| `SKELETON` / `S1_ONE_METHOD` / `S1_WALKING_SKELETON` | S1 walking skeleton 的**阶段标记**（只说明采集范围/来源，不承载关联语义） | 本阶段使用 |
| `S2_ZERO_ROW_CHAIN` | S2 0 行事实链的**阶段标记**（controller/service/mapper/sql 四点采集；只说明采集范围/来源，不承载关联语义） | 本阶段使用（S2 起由 agent 写入全部 4 个 span） |
| `SDK_ACTIVE` | 该事件由 runtime SDK 采集（click 根与同 operation 的前端事件）；只说明来源，不承载关联语义 | S3 使用（SDK 写入） |
| `S3_RUNTIME_SDK` | S3 runtime SDK 的**阶段标记**（F0、无构建插件/sourcemap）；advisory | S3 使用（SDK 写入 click 根） |
| `OBSERVE_MS=<n>` | click 根实际的观察窗毫秒数（正常 1500；`pagehide` 提前关闭时为实际值）；只说明窗口，不是 `durNs` | S3 使用（SDK 写 click 根） |
| `L1` | 该 span 走 **L1** 值级采集（参数/字段写入/返回摘要；**不是** L2、不含局部变量） | S5 使用（agent 写 `OrderService#previewDiscount`） |
| `SOURCE_MAPPED` | 该事件的 `source` 来自**构建 manifest** 而非 `.map` 解码（函数/文件/原始行号）；只说明来源，不承载关联语义 | S5 使用（SDK 写 manifest 命中的 `js_method`/click 根） |
| `VALUES_CAPPED=<n>` | 该 span 的值项因预算被截掉 `n` 项（`n`>0）；可见的丢弃计数 | S5 使用（demo 不触发） |
| `L1_SKIPPED=<n>` | 该 span 有 `n` 个非标量/不可读参数或返回值被跳过（未采集） | S5 使用（demo 不触发） |

- flag 是**提示**，不改变 `status`；未知 flag 读取方必须忽略而非报错（但 schema 只允许上述字符集）。
- `L2` 不再是纯预留：S6a 起只写**真实做了** LVT 行级采集的 span（当前仅 `L2DemoService#reconcileAmount`）；
  未插桩方法不得带 `L2`，也不得因写了 `L1` 就暗示 L2 可用（异步/无调试/折叠/预算由 S6b 扩展）。
- `SOURCE_MAPPED`/`values` 只在**该事件自身**上说明来源；不从父节点继承，也不按 `nodeKey` 传播。
- `SKELETON`/`S1_ONE_METHOD`/`S1_WALKING_SKELETON` 是本阶段标记：读取方一律按“未知 flag 忽略”规则处理，不得据此推断关联或能力。
- 静默丢弃不可接受：任何丢弃都必须以 `DROP_COUNT` 或 `NOT_COLLECTED_LOST + reason` 出现（主计划 §9.2）。

## 8. 隐私与预算（v1 摘要）

- 事件按 session 分区；单 span ≤64KB、单请求 ≤4MB（目标值，见 `transport.v1.md`）。
- 默认脱敏字段名/注解/正则：password、token、secret、authorization、cookie、idcard、phone、email、bankcard 等。
- 脱敏值必须是占位符/长度/哈希；`redacted=true` 但含原值属于契约违规。
- **S5（`values[]` 落地时）**：单值字符串 ≤2048 UTF-8 字节（字符边界截断）；值项 ≤30；对象深度 ≤4 预留但**不递归**；
  脱敏先于截断；占位符形如 `[REDACTED len=<n>]`；超预算必须带 `VALUES_CAPPED`/`L1_SKIPPED`，不得静默丢弃（§4.4.2–§4.4.4）。
- 无遥测、无外部上报；collector 只监听本机（S0 端口 8601）。

## 9. v1 明确不含（预留，需契约变更）

| 项 | 说明 |
|---|---|
| 异常详情（类型/message/栈） | `THREW` 只表状态；异常 payload 属 S1/S2 契约变更 |
| SQL 文本与参数 | L1 计划；v1 仅 `sqlId` + `rowsAffected`。**S5 仍不实现 SQL 参数**：`values[]` 只承载方法参数/字段写入/返回（§4.4） |
| `valueRef` 内容寻址 | 大对象去重预留；v1 只放摘要 |
| 事件类型扩展 | `session_start`/`graph_patch` 等未定义 |
| 异步上下文/跨服务字段 | `async` kind 已留，上下文传播字段未定义 |
| 关联规则表/游离区结构 | S1 起允许 §5 第 2 条的**游离后端根形状**（`parentSpanId=null` + `kind=controller` + `confidence=LOST` + `rootEventId=click_lost_<spanId>` + flag `LOST_BACKEND`）；关联规则表、时间窗推断、游离区合并/手工关联（`MANUAL`）仍属后续检查点。**S3**：`traceparent`/`X-TraceBoard-Click` 的**确定性头关联**已实现（§12.4），但不是“关联规则表/推断”：头缺失仍走 `LOST`，`INFERRED/MANUAL` 仍不实现 |

**S0 边界**：S0 的样例只证明“可校验的契约 + fixture 样例”，不代表已具备采集/关联能力。
**S1 边界**：S1 只有 §5 第 2 条例外描述的最小后端根采集（单方法 agent，`confidence=LOST`）；仍无任何关联/合并/推断能力。
**S2 边界**：S2 采集 4 个后端 span（`controller/service/mapper/sql` 的 `confidence=LOST` 游离后端请求链）与 SQL `rowsAffected`；
仍无前端 SDK/`traceparent`/clickId 传播、无关联/合并/推断、无 `values`/异常 payload、无回放/实时。0 行只是返回事实，不是错误状态。
**S3 边界**：S3 采集前端 `ui_event/js_method/fetch/render`（F0 runtime SDK，显式 `wrapFn`）与后端 4 span 的 **EXACT 头关联**；
纯前端零请求链可被证明；仍无构建插件/sourcemap/行号/局部变量、无 `values`/异常 payload、无 `INFERRED/MANUAL`、无 S4/S5 接入或实时。
**S4 边界**：S4 只加诊断握手与只读连接状态；事件模型**零改动**（无新事件类型/字段/枚举；`values` 仍不使用）。
**S5 边界**：S5 起 `values[]` 首次使用（只 `param|field|return`，§4.4），`source` 可由构建 manifest 提供（§12.11）；
**仍无** L2/`kind=local`/行级变量/对象深采/异常 payload/异步续体/运行时 ×3/`INFERRED`/实时/持久化；schema 字节不变（S5 当时口径）。
**S6a 边界**：S6a 起 `values[]` 可在**仅** `L2DemoService#reconcileAmount` 的 service span 上使用 `kind=local`（§4.4.7，flag `L2`），
逐次 `invocation` 1..3；**仍无**异步续体/线程池、`NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI、无 LVT 的降级事件、行级字段写入、
对象深采、多方法 L2、循环折叠/采样/丢弃预算、L2 开销门槛、其他方法的 L2/×3（S6b）；schema 字节不变。

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
- **S3 案例 A EXACT 关联样例（7 行，单 trace，全 `EXACT`/`OK`）**：`fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson`
  （click 根 → fetch → controller[parent=fetch span] → service → mapper → sql[rows 0/UNKNOWN] → render；flags `SDK_ACTIVE`/`S3_RUNTIME_SDK`/`OBSERVE_MS=1500`）；
  期望事实：同目录 `expected-facts.json`（8 条 fact + `apiExpectations` + `replayWindows`）。
- **S3 案例 B 纯前端零请求样例（3 行，单 trace，全 `EXACT`）**：`fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson`
  （click 根 → `OrderEdit.vue#validateForm` `RETURNED_FALSE` → render `金额必须大于 0`；零 fetch/后端）；
  期望事实：同目录 `expected-facts.json`（6 条 fact + `caseBVerdict` + `replayWindows`）。
- **S5 L1 值样例（4 行，单 trace，全 `EXACT`/`OK`）**：`fixtures/s5-l1-values/events.ndjson`
  （click `#btn-discount`[`source`+`SOURCE_MAPPED`] → fetch → controller[无 values] → service[`values` 5 项、flags `L1`]）；
  期望事实：同目录 `expected-facts.json`（100→0 / 脱敏 / 截断 / return 0 / graph 15 字段）。
- **S6a L2 行级样例（6 行，单 trace，全 `EXACT`/`OK`，测试数据非运行时证据）**：`fixtures/s6-l2-lines/events.ndjson`
  （click `#btn-reconcile` → fetch `POST /api/orders/1/reconcile` → controller[无 values] → 3 个同 nodeKey service span
  [`values` 仅 `kind=local`：1/2/1 项、第 2 次坏行 `100→0`、`invocation` 1/2/3、flags `S2_ZERO_ROW_CHAIN`+`L2`]）；
  期望事实：同目录 `expected-facts.json`（×3 / 逐次值/行号 / 第二次坏 / graph 6 节点 5 边 / 工作台选择器与文案）。
  行号为示意，测试从 `L2DemoService.java` 重算；运行时证据必须来自 demo+ASM agent（S6A-C），不得引用本目录冒充。
- 校验入口：`(cd "tools/verify" && node verify.mjs)`（S0/S1/S2 门禁；S3 由 tester 扩展 S3-A..S3-J）。
## 12. S3 runtime SDK 事件与头关联（仅语义；schema 字节不变）

> S3 只到 **F0**：一个页面内 runtime SDK 显式捕获点击、包装 `fetch`/XHR、显式 `wrapFn`/`uiEffect`。
> **没有**构建插件、sourcemap、源码行号、函数内部局部变量、`values[]`、字段 diff（S5）；也**没有** S4 的启动器/预览注入/CDP。
> 本节不新增 `kind`、不新增 `status`、不新增字段；所有描述都用既有 v1 字段表达。

### 12.1 SDK 本阶段产生的 kind（4 种；`callback` 不使用）

| kind | 何时产生 | 本阶段 |
|---|---|---|
| `ui_event` | `document` 捕获阶段点击；每次点击一个操作根 | 使用 |
| `js_method` | demo 显式 `wrapFn(name, fn)` 的同步/Promise 函数 | 使用 |
| `fetch` | SDK 包装的 `window.fetch` / `XMLHttpRequest` 请求-响应 | 使用 |
| `render` | demo 显式 `uiEffect(text)` 的 DOM 效果记录 | 使用 |
| `callback` | 只有在**直接包装用户回调**时才允许 | S3 demo 不产生，**不得伪造** |

- 无 `async`/`jdbc` 等后端 kind；S3 不产生 `THREW` 以外的新状态。
- 线程固定 `{"id":0,"name":"browser-main"}`；`startNs` 是 **epoch 纳秒** `round((performance.timeOrigin + performance.now()) * 1e6)`（≥0），
  `durNs` 用 `performance.now()` 差值；见 §12.10（不再“相对 SDK init”）。
- SDK 事件**不写** `source`（无 sourcemap/插件；不猜文件/行号），不写 `values`/`reason`/异常 message/栈。
  **S5 例外（见 §12.11）**：构建 manifest 命中时，`js_method` 与带 `data-tb-fn` 的 click 根**可以**写 `source` 与 flag `SOURCE_MAPPED`；
  其余规则（不猜、缺失即不写、字节与 S3 一致）不变。`values` 仍**不由 SDK** 产生。

### 12.2 事件字段（唯一前端事实形状；以 dispatch §4.2 为基础，差异见 `s3-plan.md` D3）

| kind | `nodeKey` | `parentSpanId` | `status` | `return` | `flags` |
|---|---|---|---|---|---|
| `ui_event` | 元素身份：`#id` → `[data-tb-name=...]` → `tag[role=...]` → 截断文本 → DOM 路径；≤200 字符 | `null`（click 根） | `OK` | `null` | `["SDK_ACTIVE","S3_RUNTIME_SDK","OBSERVE_MS=<实际毫秒>"]` |
| `js_method` | `<appName>#<name>`（案例 B 为 `OrderEdit.vue#validateForm`） | 当前同步 `wrapFn` 栈顶；无则为 click 根 | `OK` / `RETURNED_FALSE` / `THREW` | `false` → `{"type":"boolean","value":false}`；其它值 `null`（不记录任意返回值） | `["SDK_ACTIVE"]` |
| `fetch` | `<METHOD> <pathname>`（去 query/hash；≤200） | 栈顶或 click 根 | `OK`（收到响应）/`THREW`（网络错误） | `{"type":"http","value":<status>}` / `null` | `["SDK_ACTIVE"]` |
| `render` | `ui_effect:<text>`（≤200） | 栈顶或 click 根 | `OK` | `{"type":"ui_effect","value":<text>}` | `["SDK_ACTIVE"]` |

- `S3_RUNTIME_SDK` 是**阶段标记**（只说明“runtime SDK 采集，非构建插件”），与 `S2_ZERO_ROW_CHAIN` 同类；读取方对未知 flag 一律忽略。
  dispatch §4.2 的 click flags 只列 `SDK_ACTIVE`/`OBSERVE_MS`，本契约**增加**该阶段标记（advisory，不承载关联语义；s3-plan D3）。
- 同一操作共用 `traceId` 与 `rootEventId=clickId`；click 根 `confidence=EXACT`，其余前端事件继承 `EXACT`。
- 不采集：请求/响应体、表单值、cookie、查询串/hash、任意返回值、异常 payload、PII。

### 12.3 click 根身份与观察窗

1. 每次点击生成新 `traceId`（32 hex）、`clickId=click_` + 16 hex、根 `spanId`（16 hex）；`rootEventId=clickId`。
2. 一次点击开一个 operation；`OBSERVE_MS=1500` 后关闭并入库 click 根；`pagehide` 提前关闭并在 flag 记录**实际毫秒**。
3. 新点击开始即关闭上一个 operation（提前关闭，记录实际毫秒），各自独立 trace/根，不因时间近而合并（主计划 §8.2）。
4. click 根 `durNs` = 窗口内**最后一个因果事件结束** − click 开始（≥0），不是 1500ms 的固定值；因此根区间包含窗口内全部子事件。
5. 只有 click 窗口内的因果事件入库；窗口外的后台请求/轮询本阶段**不采集**，UI 文案只能声明“本次点击因果链内”。
6. `parentSpanId=null` 只出现在 click 根；同一 trace 只有一个根；`rootEventId` 不得是 `click_lost_<spanId>`（那是 S2 的无头回退）。

### 12.4 `traceparent` / `X-TraceBoard-Click` 与 controller EXACT 关联

**SDK 发送头（仅同源、相对路径、非 ingest 请求）**

```text
traceparent: 00-<traceId 32hex>-<fetchSpanId 16hex>-01
X-TraceBoard-Click: <clickId>          # 必须等于该 click 的 rootEventId
```

- `traceparent` 的 parent-id **必须是该 fetch 事件自己的 `spanId`**；不是 click 根、不是 controller 的 spanId。
- 跨域请求原样放行、**不加头**；ingest 上报（`POST /ingest/v1/events`）**不加这两个头**，避免自采集递归。
- 头值不得写日志/事件；不采请求体/查询串。

**agent 读取与关联（只读，无编译期 Spring 依赖）**

- controller 进入时用 JDK8 反射读当前请求头：`RequestContextHolder#getRequestAttributes` → `ServletRequestAttributes#getRequest` → `getHeader`；
  反射不可读按“头缺失”处理，fail-open。
- 严格校验：`traceparent` 匹配 `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$` 且两 id 非全 0；
  `X-TraceBoard-Click` 匹配 `^click_[A-Za-z0-9_-]{8,}$`。两者都合法才关联。
- 合法时 controller：`traceId=<头 traceId>`、`parentSpanId=<头 parent-id>`、`rootEventId=<clickId>`、`confidence=EXACT`、
  **不带 `LOST_BACKEND`**（它不是游离后端根）；service/mapper/sql 继承同一 trace/root/EXACT 与父子链。
- 头缺失/非法/反射不可读：**完全沿用 S2**——随机 `traceId`、`rootEventId=click_lost_<根spanId>`、`confidence=LOST`、根带 `LOST_BACKEND`，
  stderr 计数 `header_unreadable=<n>`；不猜、不合成 EXACT。4 个插桩点与 flags（`S2_ZERO_ROW_CHAIN`）不变。
- 只发头的 curl 没有 click/fetch 事件，trace 无根：controller 事件仍可 `EXACT`，但 `requests` 按无根规则显示 `LOST`；
  `requests.confidence=EXACT` 需要真实 fetch 事件（浏览器，或测试时先注入 click+fetch 前缀）。

### 12.5 纯前端零请求链（案例 B）

```text
ui_event(#btn-save-b, SDK_ACTIVE, OBSERVE_MS=1500)
  └─ js_method(OrderEdit.vue#validateForm, RETURNED_FALSE, return=false)
       └─ render(ui_effect:金额必须大于 0)
```

- 零 `fetch`、零 `controller/service/mapper/sql/jdbc/async`；全 `EXACT`（浏览器直接观测），不是 `LOST`。
- `RETURNED_FALSE` 是“正常返回 false”，不是异常；`false` 写入 `return={type:"boolean",value:false}`。
- “已确认没发请求”需要同时满足：①存在该 click 的 `ui_event` 根且带 `SDK_ACTIVE`；②根在观察窗关闭后入库（`OBSERVE_MS` 已记录）；
  ③该 trace `fetchCount=0` 且 `hasBackend=false`。缺 SDK（`sdkActive=false`）只能“无法确认”；有 fetch 但后端未采集应标 `LOST`/失败，不并入“没发”。
- 案例 B 不证明后端正确；只证明“本次点击因果链内没有网络请求”。无构建插件/sourcemap 时，详情必须写
  `JS 内部变量本次未采集（无构建插件/sourcemap）`，不得显示行号/局部变量。

### 12.6 DOM 效果（`render`）语义

- `render` 只表示 demo **显式调用 `uiEffect(text)`** 记录的用户可见效果摘要；`return.type="ui_effect"`、`value` 是文案。
- SDK **不读写 DOM**、不做 DOM diff、不截图/录像；`uiEffect` 调用本身不改变页面。
- 页面真实变化（toast/错误文本/刷新）仍由 demo 原有逻辑产生；`render` 是对它的**声明式事实**，不是像素回放。
- `render` 允许在 `fetch` 结束后启动（与 `callback` 同类的 UI 效果），但必须落在 click 根区间内；父为 click 根/`js_method` 时按普通包含。

### 12.7 区间、异步与置信度

- 同 trace 内子事件区间落在父区间内；`render`/`callback` 的例外见 §5 第 4 条与 §12.6。
- 异步续体（`await`/`.then`/`setTimeout`）**不传播** `wrapFn` 栈；续体中的 fetch/render 父为 click 根（S6 才做异步上下文）。
- `confidence`：SDK 事件 `EXACT`；agent 有合法头 `EXACT`、无头 `LOST`；S3 不产生 `INFERRED`/`MANUAL`。
- `requests` 的派生 confidence 规则（`ui_event`+EXACT+`fetchCount=0` → EXACT；controller 挂到 fetch → EXACT；有 fetch 无后端 → LOST；
  后端游离根/无根 → LOST）见 `api.v1.md` §9.2；`LOST` 不是 `status`。
- 未关联的单个 fetch 只在该节点标“后端未采集”，不把整条 EXACT 链降级（案例 A 的刷新 GET 属此类）。

### 12.8 隐私、预算与 schema 冻结

- SDK 只产生上述 4 种 kind 的既有字段；不新增 `kind`/`status`/字段，不改枚举/约束；`schema/traceboard.event.v1.json` **字节不变**。
- 单行仍 ≤64KB、批 ≤100 行/≤4MB、末字节 `\n`、`application/x-ndjson`；SDK 用初始化时捕获的**原生 fetch**上报，避免递归。
- 不采 PII；`nodeKey`/`ui_effect` 文本只放用户可见标识/文案；不写 cookie/表单值/查询串/请求体/异常栈。
- 事件仍是唯一事实源；`requests`/`graph`/`replay` 都是读时派生，不写第二事实源。

### 12.9 S3 明确不做（事件模型层）

- 无构建插件/sourcemap/行号/局部变量/`values[]`/字段 diff（S5）；无 S4 详情抽屉/×N/手工关联/预览注入。
  > **S5 变更**：`values[]`（`param|field|return`）与 manifest `source` 已在 **§4.4/§12.11** 定义；`kind=local`/行级/对象深采仍属 S6。
- 无异步上下文传播、无跨线程/跨服务、无 `INFERRED` 时间窗推断、无后台轮询车道（S6/S4）。
- 无实时推送、无持久化、无采样/淘汰；回放只读窗口不产生新事件。

### 12.10 时钟模型（S3 单机 epoch-ns；G1 前补）

> 动机：S3 把前端 SDK 事件与后端 agent span 放进同一个图/时间轴/回放。若两端 `startNs` 原点不同（SDK init vs JVM 启动），
> 时间顺序与回放窗口都会算错。S3 因此统一为**同一台机器上的 epoch 纳秒**。

**取值公式（本阶段唯一口径）**

| emitter | `startNs` | `durNs` |
|---|---|---|
| 前端 SDK | `round((performance.timeOrigin + performance.now()) * 1e6)`（epoch-ns） | `performance.now()` 差值 ×1e6（单调） |
| 后端 agent | `System.currentTimeMillis() * 1e6 + (System.nanoTime() % 1_000_000)`（span 开始时取一次） | `System.nanoTime()` 差值（单调，不用墙钟） |

- 两者都是 epoch-ns、同一机器；`startNs` 的墙钟部分可能受 NTP/手动改时影响，`durNs` 不受影响（单调时钟差值）。
- JavaScript `Number` 对 ~1.76e18 的 epoch-ns 只有约 256ns 分辨率（>2^53）；对 ms 级墙钟与 UI 展示足够，**不引入 BigInt**（schema 仍 `integer`）。
- **V1 只支持单机**：不跨机器对齐、不做时钟同步/偏移校正/NTP 补偿；跨机器场景不在 S3 承诺内。
- 跨 emitter 的关联只依赖 `traceparent`/`X-TraceBoard-Click` 头（§12.4），**不依赖时间窗**；时间只用于展示与区间校验。

**存储（collector）**

- collector 原样存储 `startNs`/`durNs`，**不做归一化/偏移/改写**；`requests`/`graph`/`replay` 的输出均为原始值。

**显示归一化（workbench / replay UI）**

- 选定范围（单 trace 图或整个回放会话）取 `minStartNs = min(startNs)`，显示 `relNs = startNs − minStartNs`（≥0）。
- 滑块、刻度与标签用 `relNs`；**API 参数 `fromNs`/`toNs` 仍是原始 epoch-ns**，UI 在请求前换算回原始值（`minStartNs + rel`）。
- 归一化只发生在客户端展示层；不得把相对值写回事件、存储或 API 响应。

**fixture 与 S2**

- S2 的后端-only 相对样例值（如 1.0s 起步）与 S3 fixture 的 `startNs/durNs` 都只是**示意/契约形状**，不是绝对 epoch-ns；
  客户端与测试**不得假定与运行时绝对相等**，只断言顺序、区间包含与时长关系。schema 字节不变。

**已知风险（S3 不修复，如实标注）**

- 墙钟跳变（NTP 校时/手动改时）可让相邻事件的 `startNs` 非单调，回放顺序在跳变点附近可能失真；`durNs` 与父子链仍可信。
- 单机假设不覆盖多浏览器/多 JVM/容器时钟漂移；S4+ 若跨机器再引入偏移/同步设计（需契约变更）。
- 时间容差仅用于测试断言（建议 ≤1s），不是契约字段；运行时头关联成功不要求时间窗吻合。混合链（fetch→controller）的区间包含在测试中按同一容差校验；
  EXACT 的唯一依据是 `traceparent`/`X-TraceBoard-Click`（§12.4），不是时间吻合。

### 12.11 S5 前端浅层：构建 manifest 的 `source`（仅语义；schema 字节不变）

> S5 只把前端事件从 **F0（无 source）** 提升到 **F1/F2 浅层（函数名/文件/1-based 原始行号）**：
> `source` 来自**构建插件生成的 manifest**，**不是** `.map` 解码、不是堆栈反混淆、不是服务端映射。
> 不新增字段/枚举（`source` 是 v1 既有可选对象，`SOURCE_MAPPED` 是 §7 新增 flag）；不改变无 manifest 时的事件字节。

**manifest（构建产物 / dev 端点）**

```json
{"functions":[{"name":"cancelOrder","file":"src/App.vue","line":44},
              {"name":"validateForm","file":"src/App.vue","line":86},
              {"name":"previewDiscount","file":"src/App.vue","line":120}]}
```

- `file`：相对 demo 前端根的 POSIX 路径（非绝对路径，遵守 §4.1 “不得写本机绝对路径”）；`line`：**原始源文件 1-based 行号**（`.vue` 用全文行号）。
- 行号随源码变化，上面的数字**只是示意**；测试从源文件重新计算，禁止硬编码。
- 出口：dev `GET /traceboard-manifest.json`、build `dist/traceboard-manifest.json`、build 内联 `window.__TRACEBOARD_MANIFEST__`（详见 `docs/guides/frontend-shallow-plugin.md`）。
- SDK 启动时**同步**读内联 manifest；ESM demo 缺失时可**一次性** `fetch("/traceboard-manifest.json")` 兜底（相对路径、fail-open、无重试、无缓存、不产生事件）。
  **IIFE/preview 构建不做兜底**。

**附加规则（硬约束）**

1. `js_method`（`wrapFn`）只要 manifest 有**同名**条目 → 写 `source={file,line}` + flag `SOURCE_MAPPED`；`nodeKey` 仍是 `<appName>#<name>`，不改写。
2. click 根（`ui_event`）**仅当**目标元素有 `data-tb-fn="<name>"` 且 manifest 命中该 name 时才附加同样两项；缺失则不写。
3. `fetch`/`render`/其它 kind **永不**附加（不猜）；后端 span 的 `source` 只来自 JVM 栈，且**不带** `SOURCE_MAPPED`。
4. `source` 仅在 `file` 为非空字符串、`line` 为 ≥1 整数时写入；无效/不完整条目**忽略**（整条 manifest 坏掉同样按“无 manifest”处理，fail-open）。
5. 无 manifest / 坏 manifest / CSP 拦截内联且兜底失败：事件字节与 S3 **完全一致**（无 `source`、无 `SOURCE_MAPPED`）；不得用压缩后的函数名猜行号。
6. **preview（8602）注入页不注入 manifest** → 前端事件无 `source`；工作台显示 `未采集`（如实，不是缺陷）。
7. `SOURCE_MAPPED` 只说明“来源是 manifest”，不表示 L2、不表示局部变量可得；`values[]` 不由 SDK 产生（§4.4）。
8. 工作台文案：完整 source → `file:line`；flags 含 `SOURCE_MAPPED` → 追加 `（manifest 映射）`；缺失/不完整 → `未采集`。
   旧文案 `JS 内部变量本次未采集（无构建插件/sourcemap）` 由 S5 迁移为 `JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）`。

**明确不做（S5）**

- 不解析 `.map`、不做堆栈反混淆、不做服务端 source map 映射、不上传/提交 `.map`（`build.sourcemap=true` 只服务浏览器 devtools）。
- 不采集行级变量/局部变量/对象深字段（S6）；不把“函数入口行号”冒充“赋值行号”。
- 不因 manifest 命中而改变 `status`/`return`/`confidence`/`values`。
