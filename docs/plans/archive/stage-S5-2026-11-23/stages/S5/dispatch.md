# S5 L1 与前端浅层 · 任务分发书（dispatch）

> 阶段：S5（MVP 收尾：L1 参数/字段、脱敏/截断、sourcemap、Vite/Vue 浅层插件、性能基线）｜角色：task-dispatch｜日期：2026-11-27｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S5 行 + §4；主计划 §7.3（503–514）、§9.1–9.4（664–704）、§13.4（995–1027）、§16 T3/T7/T10（1233–1240）、§19 S5（1367–1388）；上游 S4 `docs/plans/stages/S4/{progress,acceptance,s4-plan}.md` 与基线 `s4-baseline`（`9d2a507`）。
> 本文件是 S5 七个下游子代理的唯一任务输入；除 dispatcher 外不得修改。**S5 只做 L1 + 前端浅层 + 性能基线，S6（L2/异步/运行时 ×3）需要新的分发书。**

## 0. 通用规则（所有人）

1. 一人一卡：只读「输入」、只写「输出」；路径含中文/空格，命令与路径全部双引号，从仓库根执行；G1 后契约、fixture、s5-plan、本文件冻结。
2. **只有 acceptance 可写 git**（add/commit/tag）；其他人禁止 git 写操作、push/force/rebase/改 config。
3. 越界、契约缺口、指标不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改”，不许改他人路径。
4. 无真实 secret/客户数据；`demoSecret=s3cr3t` 是**演示假值**，只用于证明脱敏；不换第三方镜像、不自动下载仅 GitHub 提供的资源、无 CDN/在线字体/遥测/外部网络。
5. 未做/未验证必须标 `S5 未做 / 未采集 / S6 待做`；**禁止用 fixture 冒充运行时**；禁止伪造脱敏/截断/性能数字。
6. schema v1 字段/枚举/约束字节不变；S0–S4 fixture 字节不变；S3/S4 面板/时间轴/回放/案例 A/B 行为不回归。

## 1. 目标与验收信号（SOLO-PLAN S5 行）

| 项 | 口径 |
|---|---|
| 主要工作 | L1 参数/实体字段、脱敏/截断；sourcemap；Vite/Vue 浅层插件；性能基线 |
| 完成信号 | **100→0 在参数/字段层可见；前端行号/方法名可见（有 map/插件）** |

S5 收尾必须同时证明（缺一即 FAIL）：

1. **Demo L1 事实**：`POST /api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=<3000 个 x>` → `200 {"data":0}`；DB `amount` 仍 `100.00`；案例 A（cancel）行为/0 行事实不变。
2. **Agent L1**：service span 带 `values[]`：`requestedAmount` 100、`demoSecret` 已脱敏、`note` 截断于 2KB、`amount` 字段 100→0、`return` 0；flags 含 `L1`；**无**局部变量/对象深采/L2 行级。
3. **Collector/API**：graph 节点固定 **15 字段**（第 15 个 `values`，原始数组或 `null`）；`events/seq/requests/replay` 不变；schema 不变。
4. **工作台**：详情新增 Values 区（param/field/return、from→to、100→0 高亮、脱敏/截断徽标、行号/第 i/N 次、L1 徽标）；不宣称 L2/local。
5. **前端浅层**：Vite 插件产出 manifest（函数名/文件/行号）、dev 中间件、build 产物、`transformIndexHtml` 内联；demo `build.sourcemap=true`；SDK 给 `wrapFn`/声明式 click 附加 `source` + `SOURCE_MAPPED`。
6. **性能基线**：`tools/perf/l1-overhead.mjs` 无 agent vs 有 agent、预热后 N=100、报 p50/p95/ratio；**report-only，无硬阈值，不造假**；验收记录数字。
7. **门禁/证据**：`tools/verify` 一次命令覆盖 `S5-A..S5-I` + S0–S4 回归（迁移显式列出），exit 0；S5 G1 冻结零漂移；无 S6 越界。

## 2. 范围与 S6 边界（越界即失败）

- **S5 范围内**：仅 demo `previewDiscount` 的参数/返回 + `Order#setAmount(double)` 一次字段写入；仅 `values[]`（`param|field|return`）；仅脱敏/截断/预算；仅前端 manifest 的**函数/文件/原始行号**。
- **无 L2**：不采局部变量（`kind=local`）、不采逐行写入/行级变量表、不采对象深字段、不采异常 payload/栈、不做循环折叠、不做“深度采集开关/重跑”。
- **无 S6**：无异步续体传播（await/.then/定时器）、无后台请求车道、无运行时 ×3、无 `links`、无时间窗 `INFERRED`、无采样/丢弃策略实现（仅保留既有 `DROP_COUNT`）。
- **无 sourcemap 解码**：不解析 `.map`、不做堆栈反混淆/服务端映射；`build.sourcemap=true` 只产出构建产物的 `.map` 供浏览器 devtools，工作台只用 manifest。**preview 注入不注入 manifest/内联脚本**。
- 无 SSE/WS/实时、无持久化/DB/CORS/鉴权、无 TLS、无浏览器扩展/CDP、无 Tomcat/WAR/React/云端（S7+）；不改 schema、事件类型/status 枚举、S0–S4 fixture 字节。

## 3. 强制技术决策（不得协商）

| 项 | 决策 |
|---|---|
| demo 端点 | `POST /api/orders/{id}/preview-discount`，query 必填 `requestedAmount`（double）、`demoSecret`、`note`；`id=1` 存在。Controller 返回 `ResponseEntity.ok({"data":0})`（200）。**除该端点外不新增 API**；未知 id 也返回 200 `{"data":0}`（`findById=null` 时不写字段、不 NPE）。 |
| demo 业务 | `OrderService.previewDiscount(long,double,String,String)`：`Order o = orderMapper.findById(id)`；`o != null` 时 `o.setAmount(0)`（**仅内存**，绝不 `update`）；`return 0`。Mapper 新增 `Order findById(@Param("id") long id)` + XML `SELECT ... WHERE id=#{id}`。DB 不动。 |
| demo 前端 | 新增固定值按钮 `#btn-discount`（`data-tb-fn="previewDiscount"`）→ `async function previewDiscount()` 发固定 URL（`note="x".repeat(3000)`，`demoSecret=s3cr3t` 假值）；显示 `{"data":0}` 与“仅内存返回 0、数据库金额未改”提示；**不调用 loadOrders**；不改变案例 A/B。 |
| agent 插桩 | 在现有 4 个 S2 点上加：Controller/Service 的 `previewDiscount` 两个 advice + `com.example.shop.model.Order#setAmount(double)` 字段 advice；均为 **advice，不新增 span 类型**。字段 advice 不 emit 事件，只把 old→new 追加到当前 service frame。 |
| 字段反射 | `@Advice.This Object o` + `o.getClass().getMethod("getAmount").invoke(o)` 读旧值，`@Advice.Argument(0) double` 为新值；**不编译依赖 demo 类**。仅当 `o.getClass().getName().equals("com.example.shop.model.Order")`、顶层 frame 是 `OrderService#previewDiscount`、且调用栈在 advice 与 `previewDiscount` 之间**没有** `org.apache.ibatis` 帧（跳过 MyBatis 装载/Hydration 的 0→100）且 `old != new` 时记录。 |
| L1 预算 | 单值字符串 UTF-8 ≤2048B（按字符边界截断）；values ≤30 项；depth ≤4 预留给对象但仍**不递归对象**；只采 `String/number/boolean` 标量；超预算/跳过必须可见：`VALUES_CAPPED=<n>`、`L1_SKIPPED=<n>`（demo 不触发）；单 span ≤64KB 沿用。 |
| 脱敏 | 名称正则（大小写不敏感，包含即命中）：`password|token|secret|authorization|cookie|idcard|phone|email|bankcard`。命中后 `to` 只能是占位符 `[REDACTED len=<n>]`、`redacted=true`，**绝不出现原值**；`demoSecret` 必须命中。 |
| graph | `GraphNode` 加第 15 个字段 `values`（原始事件 `values` 数组；事件无该字段 → `null`，**不默认 []**）；15 字段恒出现；`events/seq/requests/replay` 零改动。 |
| Vite 插件 | 新 `frontend/build-plugin/`：浅层正则扫描 `src/**/*.{vue,ts}`，识别 `function/async function` 声明与 `const x = ...wrapFn("x", ...)`；manifest `{"functions":[{name,file,line}]}`；dev 中间件 `/traceboard-manifest.json`；build 产出同名 JSON；`transformIndexHtml` 注入 `window.__TRACEBOARD_MANIFEST__`（内联仅限构建插件，**不是** preview 注入）。无第三方依赖。 |
| sourcemap | 仅 demo frontend `build.sourcemap=true`；`.map` 是构建产物（`dist/` 已 gitignore），不提交、不上传、不解析；SDK 不读 `.map`。 |
| SDK source | 启动时同步读 `window.__TRACEBOARD_MANIFEST__`；缺失时 **ESM demo** 可一次性 `fetch("/traceboard-manifest.json")` 兜底（相对路径、fail-open、无重试、无缓存、不产生事件）；**IIFE/preview 构建不发起兜底**（避免预览页额外请求与 S4-E 计数回归）。`wrapFn` 事件按 name 命中附加 `source:{file,line}` + flag `SOURCE_MAPPED`；click 根仅当目标元素有 `data-tb-fn="<name>"` 且 manifest 命中时附加；fetch/其他不附加，不猜。 |
| 性能 | `tools/perf/l1-overhead.mjs`：collector + demo（无 agent / 有 agent）各预热 20、3 轮 ×100 顺序请求；报每轮 p50/p95 与中位 ratio；**只报告**，ratio 超 1.25 仅 WARN，不改变 exit 0；setup 失败 exit 1。 |
| 案例 A | `OrderController#cancel`/`OrderService#cancel`/Mapper/SQL advice 的匹配、flags、return、rows 全部不动；字段 advice 不得在 cancel 链产生任何 values/额外事件；DB `amount` 永远 100。 |

## 4. 共享契约（实现不得漂移）

### 4.1 demo L1 链路（运行时形状）

```text
click #btn-discount (SDK, EXACT) -> fetch POST /api/orders/1/preview-discount (SDK)
  -> controller OrderController#previewDiscount (agent, EXACT join via traceparent/X-TraceBoard-Click)
  -> service OrderService#previewDiscount (agent, values[], flags 含 L1)
```

- 服务端只新增 **controller + service** 两个 span；`findById` 的 MyBatis mapper/sql **不插桩**（不产生 mapper/sql 节点，不改变 S2 过滤器）。
- Controller 复用 `RequestHeaders.current()` 读取头；无头时按既有 LOST 游离根规则（不伪造 EXACT）。Controller `return={"type":"org.springframework.http.ResponseEntity","value":200}`；无 values。
- Service `return={"type":"double","value":0.0}`；status `OK`；`source` 沿用 JVM 栈（`OrderService.java:<line>`）；flags `["S2_ZERO_ROW_CHAIN","L1","DROP_COUNT=<n>"]`（子节点不含 `LOST_BACKEND`）。

### 4.2 `values[]`（S5 唯一新载荷；字段顺序固定）

```json
[
 {"name":"requestedAmount","kind":"param","line":null,"from":null,"to":100.0,"truncated":false,"redacted":false},
 {"name":"demoSecret","kind":"param","line":null,"from":null,"to":"[REDACTED len=6]","truncated":false,"redacted":true},
 {"name":"note","kind":"param","line":null,"from":null,"to":"<2048 个 x>","truncated":true,"redacted":false},
 {"name":"amount","kind":"field","line":null,"from":100.0,"to":0.0,"truncated":false,"redacted":false},
 {"name":"return","kind":"return","line":null,"from":null,"to":0.0,"truncated":false,"redacted":false}
]
```

- 顺序：参数声明顺序 → 字段写入发生顺序 → 返回。每个 S5 值项固定输出 `name/kind/line/from/to/truncated/redacted`；`line` 恒 `null`（行级属 S6）；`invocation` 单次省略。
- 无 values 的 span **省略 `values` 字段**（不得写 `[]`），与 S0–S4 字节兼容；graph 才把它呈现为 `null`。
- 脱敏先于截断；`redacted=true` 时 `from/to` 只能是占位符/长度，绝不原值。`truncated=true` 是值级标记，**不改 status**。
- 预算/跳过：`values >30` 截到 30 并追加 flag `VALUES_CAPPED=<n>`；非标量参数跳过并追加 `L1_SKIPPED=<n>`（无静默丢弃）。

### 4.3 `values` 与 graph 15 字段

- 顺序固定：`spanId,parentSpanId,kind,nodeKey,status,return,sideEffects,startNs,durNs,thread,flags,reason,source,confidence,values`（15 项，恒出现）。
- `values`：事件 `values` 原样（数组，含 redacted/truncated 原值）；事件无 → `null`；不聚合、不按 nodeKey 合并、不重算。
- 不变：`nodes` 排序/`edges(count=1)`/节点数/`rootEventId`/顶层 `confidence`/错误码/只读/两次一致；`requests`/`replay`/`events`/`seq` 字节与形状不变；meta 仍 5 键。

### 4.4 前端 manifest 与 source

```json
{"functions":[{"name":"cancelOrder","file":"src/App.vue","line":44},
              {"name":"validateForm","file":"src/App.vue","line":86},
              {"name":"previewDiscount","file":"src/App.vue","line":120}]}
```

- `file`：相对 demo frontend 根、POSIX 分隔；`line`：**原始源文件 1-based 行**（`.vue` 全文行号，不剥离 `<template>`；上例行号仅示意，实际以扫描为准）。扫描按文件名排序；同名去重（首个胜出并 warn）；`functions` 按 `file,line,name` 排序；≤500 项。
- 扫描规则（浅层，正则、不引入 AST/依赖）：`^[ \t]*(?:export[ \t]+)?(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(`；`^[ \t]*(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[^;\n]*wrapFn\([ \t]*["']\1["']`。`validateForm` 由第二条命中，`cancelOrder`/`previewDiscount` 由第一条命中。
- 注入/服务：dev `configureServer` 提供 `GET /traceboard-manifest.json`（`application/json; charset=utf-8`、`Cache-Control: no-store`）；build `emitFile` 同名 JSON；`transformIndexHtml` 在 `head-prepend` 注入 `<script>window.__TRACEBOARD_MANIFEST__ = <JSON>;</script>`（`<` 转义为 `\u003c`）。CSP 拦截内联时 SDK 仍可走 JSON 兜底。
- SDK：`SOURCE_MAPPED` 仅表示“manifest 命中的原始函数/行号”，**不是** `.map` 解码；无 manifest 时事件字节与 S3 完全一致（不加 source/flag）；`wrapFn` 的 `js_method` 与带 `data-tb-fn` 的 click 根可附加；fetch/render/js_method 未命中不附加。`source` 必须 `file` 非空字符串、`line` 为 ≥1 的整数才附加（无效项忽略）。ESM demo 无内联时可一次 JSON 兜底；IIFE/preview 不做兜底（无 manifest 即无 source）。
- 工作台 source 文案：完整 source → `file:line`；flags 含 `SOURCE_MAPPED` → 追加 `（manifest 映射）`；缺失/不完整 → `未采集`。后端 source 来自 JVM 栈，不加该后缀。
- 文档必须写明：这是 **F1/F2 浅层**（函数/文件/行号），不是 S6 L2 行级变量；preview 注入页无 manifest，因此无 source；minify 后不得用函数名猜行号。

### 4.5 性能基线（report-only）

- 文件：`tools/perf/l1-overhead.mjs`（Node22，无第三方依赖）。参数：`--n 100 --warmup 20 --rounds 3 --port 8080`。固定请求 URL 与 demo 相同（3000 x note）。
- 流程：启动 collector（JDK21）→ demo 无 agent（JDK8，`-Dserver.port`）→ health `/api/orders` → 预热 → 3×100 顺序 `POST`，`hrtime.bigint` 计时 → 停止 → demo 有 agent（`-javaagent`，session `s_s5perf`，health/hello 等待）→ 预热 → 3×100 → 停止 → 输出 JSON/表：每轮 p50/p95、中位 p50/p95、ratio（agent/base）、agent 事件数。
- 判定：**只报告**；ratio >1.25 打印 `WARN l1_overhead_ratio>1.25`，exit 仍 0；不得删慢样本、不得用 fixture/预计算值代替实测。setup 失败 exit 1。验收把原始数字写入 `S5/test-report.md` 与 `acceptance.md`。
- 不评估前端构建开销（S5 只记录 `vite build` 墙钟一次，不作门槛；主计划 ≤25% 是后续 S7/S8 矩阵项）。

### 4.6 `fixtures/s5-l1-values/`（测试数据，非运行时证据）

- 文件：`README.md`、`events.ndjson`（4 行：click `#btn-discount` → fetch → controller → service，EXACT 链）、`expected-facts.json`。
- session `s_s5values`；固定 traceId/spanIds；service 为 `OrderService#previewDiscount`，`values` 按 §4.2 五项（note 的 `to` 恰 2048 个 `x`，`truncated=true`；demoSecret `[REDACTED len=6]`），flags 含 `L1`；controller `return=ResponseEntity/200`；click/fetch/controller 无 `values`。
- `expected-facts.json`：requests 1 行（EXACT/4 span/fetchCount=1/backendSpanCount=2）、graph 4 节点/3 边/每节点 15 键（service values 数组、其余 null）、replay 窗口、工作台选择器/文案/徽标/100→0 期望；对 note 用 `toBytes=2048`/前缀断言，不复制 2KB 全文。
- README 逐字：**“本目录是 S5 测试数据，不是运行时证据；运行时 L1 由 demo+agent 产生。不含真实 secret；demoSecret 是假值。”** 并说明无 L2/local、无对象深采。

## 5. 任务卡（独立输入/输出）

### 5.1 plan-writer（契约/fixture/指南/计划；不写代码）

- 输入：本文件 §1–§4、S0–S4 冻结契约/schema、主计划 §7.3/§9/§13.4/§16 T3/T7/T10/§19。
- 输出（只写）：`docs/contracts/api.v1.md`（§2.5 S5 矩阵、§8.2 节点 15 字段、§10.9 values、附录 B/C 补 preview-discount 与 manifest/source、变更记录）、`docs/contracts/event-model.v1.md`（§4.4 S5 语义、§7 flags `L1`/`SOURCE_MAPPED`/`VALUES_CAPPED`/`L1_SKIPPED`、§8 预算/脱敏、§12.11 manifest source、历史“无 source”章节加当前指针）、`docs/guides/frontend-shallow-plugin.md`、`fixtures/s5-l1-values/**`、`docs/plans/stages/S5/s5-plan.md`。
- 完成判据：§4.1–§4.6 全部落入契约/指南/fixture/plan；fixture 过 Ajv 2020-12 strict 且 4 行自洽；api/event-model 明确 15 字段与 `values:null` 语义；guide 写清 manifest/内联/JSON 兜底/CSP/浅层 vs S6；**transport/status-semantics/schema 字节不变**；S0–S4 fixture 字节不变。
- 禁止：写代码/pom/TS、改 schema/transport/status-semantics、改 S0–S4 fixture 字节、改 S4 文档/契约既有语义、git、真实 secret/外网 `$ref`。

### 5.2 plan-reviewer（只读，G1 门）

- 输入：本文件、plan-writer 全部输出、S0–S4 契约/schema、主计划 §9/§13.4/§16 T3/T7/T10。
- 输出（只写）：`docs/plans/stages/S5/plan-review.md`——逐项 PASS/FAIL、阻断/建议、SHA256 冻结清单（schema、api、transport、event-model、status-semantics、guide、S5 fixture 3 件、s5-plan、dispatch）、`G1: PASS|FAIL`。
- 核查：①values 五项/顺序/脱敏/截断/预算与 §4.2 一致；②graph 15 字段/`values:null`/其余端点零改动与 §4.3 一致；③manifest 扫描/注入/dev/build/SDK source 与 §4.4 一致且不冒充 sourcemap 解码；④perf report-only 与 §4.5 一致、无硬阈值/造假；⑤fixture 过 schema、仅测试数据、无真实 secret；⑥无 S6（L2/local/async/×3/SSE/WS/持久化/云端）、无 preview 内联；⑦schema/transport/status-semantics/S0–S4 fixture 字节不变。
- 禁止：替作者改文件、写代码、引入 S6、git。

### 5.3 coder-L1（`demo/.../backend/**` + `agent/**`）

- 输入：本文件 §3/§4.1/§4.2、G1 契约/fixture、现有 demo/agent 源码。
- 输出（只写）：`demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/{controller/OrderController.java,service/OrderService.java,mapper/OrderMapper.java}`、`.../resources/mapper/OrderMapper.xml`、`agent/src/main/java/io/traceboard/agent/**`（新 advice/改 SpanContext/SpanEmitter/TraceAgent；pom 仅允许 description 文案，不得加依赖）。
- 完成判据：端点/服务/字段行为按 §3；agent 7 个 advice / 5 个类型（S2 四点原样 + preview 两点 + `Order#setAmount` 一点）；values 精确 §4.2（五项顺序/长度/占位符）；字段 100→0 恰一条、无 hydration 0→100；flags `L1`；无 local/对象深采/L2；fail-open（collector 不可达仍 200）；agent jar major 52、shaded、无新依赖；案例 A 的 4-span/0 行/return 全部不变。
- 禁止：改 demo 前端/SDK/workbench/collector/契约/fixture/schema、DB 写入、真实 secret、新端点、git。

### 5.4 coder-frontend（`frontend/build-plugin/**` + `frontend/sdk/**` + demo frontend）

- 输入：本文件 §3/§4.4、G1 guide、demo frontend/SDK 现状。
- 输出（只写）：`frontend/build-plugin/{package.json,index.mjs,index.d.mts,test/plugin.test.mjs}`、`frontend/sdk/src/index.ts`、`frontend/sdk/test/**`、`demo/buggy-shop-boot-vue/frontend/{src/App.vue,src/style.css,vite.config.ts}`（`package.json` 不改；插件用相对 import，无新依赖）。
- 完成判据：插件扫描/排序/去重/manifest/dev 中间件/build 产物/`transformIndexHtml` 内联与 §4.4 一致，单测绿；demo build 产出 `.map` + `traceboard-manifest.json`，dist 含 `__TRACEBOARD_MANIFEST__` 与 `validateForm`/`previewDiscount`；SDK 同步/兜底读取、命中附加 `source`+`SOURCE_MAPPED`、未命中零变化、坏 manifest fail-open、不读 `.map`/不采集 values/不碰表单值；`#btn-discount` 固定请求且案例 A/B 不变；页头文案改为 S5 真实能力（manifest 提供函数/行号；L2 属 S6）。
- 禁止：改后端/agent/collector/workbench/契约/fixture/schema、preview 注入/内联、新依赖/CDN/localStorage、sourcemap 解码、git。

### 5.5 coder-collector+workbench（`server/collector/**` + `workbench/**`）

- 输入：本文件 §4.2/§4.3、G1 契约/fixture、collector/workbench 现状。
- 输出（只写）：`server/collector/src/main/java/io/traceboard/collector/derive/{SpanFacts.java,GraphNode.java,TraceDeriver.java}`、`workbench/src/{api.ts,App.vue,s4/derive.ts,components/S4DetailPanel.vue,components/S3Panel.vue,style.css}`、可新增 `workbench/src/s5/**`。
- 完成判据：graph 第 15 字段 `values`（原始/null）与顺序；events/seq/requests/replay 零改动；工作台 `GraphNode` 15 字段类型；详情 `#s5-values`/`#s5-l1-badge`/`#s5-source`/`#s5-values-empty`/`#s5-values-note`（静态说明逐字：`S5 L1：参数/字段写入/返回摘要；局部变量（L2）与行级属 S6，本阶段未采集`），每行带 `data-value-kind="param|field|return"`；param/field/return 行、`100 → 0` 高亮、`已脱敏`/`已截断` 徽标、`行号未采集`、`第 i/N 次`、L1 徽标；source 支持 manifest 文案，**删除 S4 的“无 sourcemap/行号映射”与 S3Panel 的“无 S5/S6”旧口径**，改为“manifest 提供函数/行号；L2/local 属 S6”；S4 详情/×N/缺口/S3/S0–S2 面板保留；`npm ci && npm run build` 绿；无 L2/local 宣称、无图库/SSE/WS/sourcemap 解析。
- 禁止：改事件/seq/requests/replay 形状、schema、后端/SDK/demo/契约/fixture、发写请求、git。

### 5.6 tester（`tools/verify/**` + `tools/perf/**` + S5 报告）

- 输入：全部 S5 产物、G1 冻结、S0–S4 门禁。
- 输出（只写）：`tools/verify/verify.mjs`、`tools/perf/l1-overhead.mjs`、`docs/plans/stages/S5/test-report.md`。
- 门禁（一次命令、非 0 即 FAIL；串行起停、`finally` 清理进程/端口/临时文件）：

| 组 | 断言 |
|---|---|
| **S5-A** demo | JDK8 构建；preview-discount 200 `{"data":0}`；`/api/orders` amount 100.00；案例 A cancel 仍 200 true + SQL 0 行；源码/XML 含 `findById`（真实读取由 S5-B 的旧值 100 证明），无 UPDATE；无新端点；未知 id 200/0 |
| **S5-B** agent | collector+demo+agent；带 traceparent/click 调用 → controller+service 2 span（无 mapper/sql）；service values 五项精确（100/`[REDACTED len=6]`/2048+truncated/100→0/0）；flags `L1`；return double 0；无 local/`VALUES_CAPPED`/`L1_SKIPPED`；无 hydration 0→100；无原 secret；schema 合法；案例 A 4 span/0 行不变；collector 停仍 200 |
| **S5-C** collector | ingest S5 fixture：graph 4/3、每节点 15 键有序、service values 数组/其余 null；`events/seq` 不被改写、`requests` 形状不变、`replay` 原样回显（含 values）；S2/S4 graph 第 15 字段 null；400/404/405/meta 5 键不变 |
| **S5-D** plugin | 插件单测（两类声明/行号/排序/去重/空目录/坏 JSON/无依赖）；demo build 有 `.map` + `traceboard-manifest.json`；dist 内联 manifest 含 `validateForm`/`previewDiscount` 且行号=源文件对应行；dev 中间件 200 JSON；workbench/SDK dist 无 `.map`；`.map` 未入库 |
| **S5-E** SDK | 单测：manifest 同步/JSON 兜底一次/坏 manifest fail-open；`wrapFn("validateForm")` 事件命中 source+`SOURCE_MAPPED` 且 `file=src/App.vue`、line=源文件 `validateForm` 行；无 manifest 字节同 S3；fetch/render 不附加；`data-tb-fn` click 命中；不采集 values/表单值；IIFE 无 map/CDN；demo VM 事件 `src/App.vue:<line>` |
| **S5-F** UI | ingest fixture 后 dist 静态断言选择器/文案：`#s5-values`/`#s5-l1-badge`/`#s5-source`/`#s5-values-empty`/`#s5-values-note`、`100 → 0`、`已脱敏`/`已截断`、`L1`、`行号未采集`、`第 i/N 次`；空 values 逐字 `未采集（该节点无 values；S5 只采参数/字段写入/返回摘要）`；S4 选择器/缺口/×N 保留；无 local/L2 文案，且不残留旧“无 sourcemap/行号映射”“无 S5/S6”口径。5 行/100→0 的实际渲染由浏览器截图证据（orchestrator）确认，tester 不断言截图 |
| **S5-G** perf | 脚本 exit 0；输出 p50/p95/ratio（3 轮）；ratio>1.25 仅 WARN；无硬阈值；事件数>0；端口/进程清理；test-report 记录原始数字 |
| **S5-H** 回归 | S0–S4 锚点全 PASS（按 §6.1 迁移清单）；案例 A/B、EXACT、回放 0 写、S2 LOST 4-span；schema/S0–S4 fixture 字节不变；S5 G1 冻结零漂移 |
| **S5-I** 范围/安全 | 无 L2/local/async/运行时 ×3/SSE/WS/持久化/Tomcat/React/云端；无 sourcemap 解码/上传（仅 demo dist 允许 `//# sourceMappingURL` + `.map` 构建产物；源码/workbench/SDK 不允许）；preview 仍只注入外部脚本；build 内联有文档；无真实 secret/PII/CDN/镜像；端口 8601/8080/5173/5174/4173/4174/8602/18080 无监听、无 java/node 残留、git index 未动 |

### 5.7 acceptance（唯一 git 写入者，G2 门）

- 输入：全部 S5 产物、七张卡、G1 报告、tester 报告/perf 数字。
- 输出（只写）：`README.md`、`docs/plans/stages/S5/{acceptance.md,progress.md}`、`docs/plans/archive/stage-S5-<date>/**`、git commit + tag `s5-baseline`。
- 完成判据：①亲自复跑门禁/构建，不信报告；②G1 哈希不变；③§2 越界零实现；④安全/假值声明；⑤README 写 S5 状态/L1 能力/插件/sourcemap/性能数字/限制；⑥progress 按 SOLO-PLAN §4；⑦按文件名 add+commit+tag；⑧**S5 到此停止，不开始 S6**。
- 禁止：push/force/rebase、测试未绿打 tag、代改代码、开工 S6。

## 6. 路径归属（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S5/dispatch.md` | dispatcher | 只读 |
| `docs/contracts/api.v1.md`、`docs/contracts/event-model.v1.md`、`docs/guides/frontend-shallow-plugin.md`、`fixtures/s5-l1-values/**`、`docs/plans/stages/S5/s5-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S5/plan-review.md` | plan-reviewer | 只读 |
| `demo/.../backend/**`、`agent/**` | coder-L1 | 只读 |
| `frontend/build-plugin/**`、`frontend/sdk/**`、`demo/.../frontend/{src,vite.config.ts,style.css}` | coder-frontend | 只读 |
| `server/collector/**`、`workbench/**` | coder-collector+workbench | 只读 |
| `tools/verify/**`、`tools/perf/**`、`docs/plans/stages/S5/test-report.md` | tester | 只读 |
| `README.md`、`S5/{acceptance,progress}.md`、archive、git | acceptance | 只读 |
| `schema/**`、`docs/contracts/{transport,status-semantics}.md`、S0–S4 fixture/文档、demo 前端 package.json/lock | 冻结 | 一律只读 |

### 6.1 S5 门禁迁移（tester 必做，不放宽其余断言）

- `S3-1`：SDK 测试数从 13 改为实际值（含新增 manifest/source 用例）；demo dist 允许 `.map`/manifest，删除“无构建插件/sourcemap”token，改断言 S5 文案 + manifest；demo vite 允许 `traceboardShallow` + `build.sourcemap=true`。
- `S4-E`/`S3-7`：SDK 测试数同步实际值（不再硬编码 13/13）；IIFE/preview 无 manifest 兜底，S4-E 的 auto-init/guard/fail-open/global/version/无 map 断言不变；`frontend/sdk/test/**` 新增 manifest/source 用例仍须绿。
- `S4-F`：S4 fixture graph 节点断言从 14 → 15 键（第 15 键 `values:null`）；其余 9/8、缺口 3、requests/replay 断言不变；新增 S5 fixture 独立断言，不改 S4 fixture 字节。
- `S4-I` **退役**：不再断言“无 S5/S6/S7/sourcemap/build plugin/L1 values”；由 **S5-I** 继承端口/进程/secret/CSP/loopback/git 清理断言，并新增“无 L2/local/async/×3/云端、sourcemap 仅 demo dist”检查。
- `S3-8`：移除 `sourcemap/build-plugin` 禁项；新增禁 S6（L2/local/async/×3/SSE/WS/持久化）；values 允许出现在 agent/collector/workbench，SDK 仍禁 `values`/`.map` 读取；demo `.map` 允许、workbench/sdk `.map` 仍禁；Vite 配置断言改为 **workbench 仅 `vue()`、demo `vue()+traceboardShallow` 且 `build.sourcemap=true`**；preview 仍禁内联/CSP 改写。
- `S3-10`：白名单加 `frontend/build-plugin/`、`tools/perf/`、`fixtures/s5-l1-values/`、`docs/plans/stages/S5/`；**demo backend 从 forbidden 移入 S5 允许**，但仅限 `OrderController.java`/`OrderService.java`/`OrderMapper.java`/`OrderMapper.xml` 四个文件（pom/application.yml/schema.sql/data.sql 仍冻结）；`fixtures/S0–S4`/schema/status-semantics 仍冻结；新增 S5-L1 断言案例 A。
- `GRAPH_NODE_KEYS`：14 → **15**（仅末尾 `values`）；S2/S3/S4 graph 节点值断言改为 `values:null`，节点数/边/顺序不变。
- `S4_G1_FREEZE` → `S5_G1_FREEZE`：schema/transport/status-semantics 沿用 S4 哈希；api/event-model + 新增 S5 guide 用 S5 新哈希；S4 fixture/S4 plan/dispatch/amendment/S4 guide 保持 S4 哈希（零漂移）；新增 S5 fixture 3 件 + s5-plan + dispatch。
- `S2-8`：agent 插桩点从“4 个方法”迁移为 **7 个 advice / 5 个类型**（S2 四点仍在）；不再断言“4 个 ASM 点”，改为 7 个 `Advice.to`、5 个 `.type(`；仍禁 Spring/Servlet 编译依赖；`Order#setAmount` advice 不 emit 事件。
- `S3-6`：工作台旧文案迁移——`JS 内部变量本次未采集（无构建插件/sourcemap）` → `JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）`；`无 S5/S6（无 sourcemap/...）` → `S5：manifest 函数/行号；无 L2/local/异步/×3/图库/SSE/WS`；其余 S3 选择器/状态语义/时间轴/回放断言不变。
- 不变：`S2-3` 4-span LOST、`S3-3` EXACT E2E、`S3-4/5` 回放 0 写、`S3-6/7`、`S1-C0` meta 5 键、schema/S0–S4 fixture 字节。

## 7. 架构（S5 数据流）

```text
demo Vue 5174（Vite 插件 manifest + build.sourcemap）── click/fetch(traceparent) ──▶ demo 8080（JDK8 + agent）
   │  SDK NDJSON /ingest ───────────────────────────────────────────────────────────▶ collector 8601
   │  click/js_method 附 source+SOURCE_MAPPED（manifest 命中）                         ├─ EventStore（values 原样）
   │                                                                                    └─ graph 15 字段（values）
   └─ workbench 5173 只读 graph/replay；详情 Values/Source/L1（纯前端派生）
preview 8602：仅外部 config.js+sdk.js 注入；无 manifest → 无 source（如实）
perf：demo ±agent，预热 + 3×100，report-only
```

## 8. 门禁顺序与冻结

`dispatcher → plan-writer → reviewer(G1) → (coder-L1 ∥ coder-frontend ∥ coder-collector+workbench) → tester → acceptance(G2，commit+tag s5-baseline) → 阶段备份/总结`

- G1 前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 上报，不降级。
- G1 冻结 SHA256：`schema`、`api.v1.md`、`transport.v1.md`、`event-model.v1.md`、`status-semantics.md`、`frontend-shallow-plugin.md`、S5 fixture 3 件、`s5-plan.md`、`dispatch.md`；之后改字段/形状必须停回本流程。
- 三个 coder 可并行；契约/fixture 是唯一事实输入；workbench 可用 G1 fixture 离线开发；tester 必须等三者完成。
- S5 到达检查点即停；**不得开始 S6**。

## 9. 环境事实（不得改写）

- Windows + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，全部双引号）。
- JDK8 `C:/Program Files/Java/jdk1.8.0_221`（demo/agent 运行）；JDK21 `C:/Program Files/Java/jdk-21`（collector/launcher/root）；Node 22/npm 10；Maven 3.9.5。
- 端口：collector 8601（仅 127.0.0.1）、demo 8080、workbench 5173、demo 前端 5174、preview 8602；测试静态 stub 18080（仅测试，finally 释放）；冲突先诊断，不静默改。
- demo frontend SDK session 固定 `s_s3demo`（`src/traceboard.ts` 不改）；agent 运行必须用同 session 才能前后端关联；perf 用 `s_s5perf`。
- 分支 `master`、无 remote；仅 acceptance 写 git；无第三方镜像/CDN/遥测；无真实 secret/客户数据。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 字段 advice 反射/内联/MyBatis hydration 误采 0→100 | 精确类名/方法名过滤；顶层 frame 必须 `OrderService#previewDiscount`；调用栈含 `org.apache.ibatis` 则跳过；`old != new`；无 demo 编译依赖；fail-open；S5-B 断言恰一条 100→0 |
| 新 advice 改变案例 A / 多出 span | preview 独立 advice；cancel 四点匹配/返回/flags 不动；字段 advice 不 emit 事件；S5-B/S5-H 回归 |
| 脱敏/截断造假或泄密 | 名称正则（含 `secret`）；占位符只含长度；UTF-8 2048 边界；`truncated=true`；单测断言原值不出现；demo 假值 |
| 预算静默丢弃 | `VALUES_CAPPED`/`L1_SKIPPED` flag；demo 不触发；tester 断言无这些 flag |
| manifest 扫描/行号漂移 | 两类正则；1-based 原始行；按文件/行排序；同名去重；测试从源文件重新计算行号，不硬编码；`.vue` 全文行号 |
| 内联 manifest 被 CSP 拦 | JSON 文件兜底；文档写明；preview 不注入 manifest/内联；build 内联不属于 preview |
| sourcemap 被误当 L2/上传 | 只在 demo build 产出 `.map`；SDK 不读；workbench 只显示 manifest；S5-I 禁上传/解码 |
| perf 方差/被指标绑架 | 预热 20、3×100、中位 ratio；report-only；超 1.25 仅 WARN；原始数字入报告；不删慢样本 |
| graph 15 字段破坏 S2–S4 | `values:null` 加性；`requests/replay/events/seq` 零改动；GRAPH_NODE_KEYS 迁移；fixture 字节不变 |
| 契约/路径漂移 | G1 冻结 11 文件；S3-10 白名单显式；demo backend 仅 S5 文件允许；schema/transport/status 冻结 |
| 长度/编码（3000 note URL） | 固定 ASCII `x`；`encodeURIComponent`；Spring 默认参数长度足够；不写日志；错误不打印 query |

## 11. 停止条件与出口纪律

1. 必须改 schema/事件类型/status 枚举、引入 `kind=local`/L2/异步/运行时 ×3，或必须解析/上传 sourcemap 才能达标。
2. 必须让 preview 注入内联脚本/改写 CSP、或伪造脱敏/截断/性能数字、或用 fixture 冒充运行时。
3. 必须改变案例 A 行为/DB amount、让 cancel 链多 span、或放宽 S2–S4 门禁。
4. 必须引入真实 secret/客户数据/第三方镜像/CDN，或改他人路径。
5. G1 FAIL 且一轮返工仍 FAIL；测试未绿但 owner 想“先提交”。
6. S5 只证明“L1 参数/字段/返回 + 前端浅层 manifest/source + 性能基线”；README/报告必须写明无 L2/局部变量/异步/运行时 ×3、preview 无 manifest、sourcemap 只供浏览器。S5 通过也不得宣称产品完成，S6 需新的分发书。

## 12. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-27 | 首版：demo L1 端点/字段 advice、values 五项、graph 15 字段、Vite 浅层 manifest/sourcemap、SDK source、perf 基线、S5-A..I 门禁与迁移、S6 边界 |