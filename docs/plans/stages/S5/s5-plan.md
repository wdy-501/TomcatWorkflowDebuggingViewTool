# S5 计划：L1 参数/字段/返回 + 前端浅层 manifest/source + 性能基线

> 阶段：S5（MVP 收尾）｜角色：plan-writer｜日期：2026-11-27｜版本：v2（G1 FAIL 返工第 1 轮）
> 唯一输入：`docs/plans/stages/S5/dispatch.md`（binding，下称 dispatch）、S0–S4 冻结契约/schema/fixture、主计划 §7.3/§9.1–9.4/§13.4/§16 T3/T7/T10/§19。
> 本计划只描述 S5 的设计与门禁；代码由 dispatch §5 的五张卡实现。G1 后本文与契约/fixture 一并冻结，任何形状改动必须回到 G1 前。

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 主要工作 | L1 参数/实体字段、脱敏/截断；sourcemap；Vite/Vue 浅层插件；性能基线 |
| 完成信号 | **100→0 在参数/字段层可见；前端行号/方法名可见（有 map/插件）** |

S5 收尾必须同时成立（缺一即 FAIL）：

1. demo：`POST /api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=<3000 x>` → `200 {"data":0}`；`GET /api/orders` 的 `amount` 仍 `100.00`；案例 A cancel 行为与 0 行事实不变。
2. agent：service span 带 `values[]` 五项（`requestedAmount` 100 / `demoSecret` 脱敏 / `note` 2KB 截断 / `amount` 100→0 / `return` 0），flags 含 `L1`；无 local/对象深采/行级。
3. collector：graph 节点固定 **15 字段**（第 15 个 `values` 原始数组或 `null`）；`events/seq/requests/replay`、schema 零改动。
4. 工作台：详情 Values 区（param/field/return、`from→to`、`100 → 0` 高亮、`已脱敏`/`已截断`、`行号未采集`、`第 i/N 次`、`L1` 徽标）；不宣称 L2。
5. 前端浅层：插件产出 manifest（函数/文件/行号）、dev 中间件、build 产物、`transformIndexHtml` 内联；demo `build.sourcemap=true`；SDK 命中后附 `source`+`SOURCE_MAPPED`。
6. 性能：`tools/perf/l1-overhead.mjs` 无 agent vs 有 agent、预热后 3×100、p50/p95/ratio，**report-only**。
7. 门禁：一次 `tools/verify` 覆盖 S5-A..S5-I + S0–S4 回归，exit 0；S5 G1 冻结零漂移。

**S5 通过 ≠ 产品完成**：本文所有“看不到”的能力都属于 S6+，报告必须如实写。

## 2. S5/S6 边界（越界即失败）

**S5 内**：demo `previewDiscount` 的参数/返回 + `Order#setAmount(double)` 一次字段写入；`values[]` 仅 `param|field|return`；脱敏/截断/预算；前端 manifest 的函数/文件/原始行号。

**S5 外**（出现即 FAIL）：局部变量/`kind=local`/行级变量表/逐行写入；对象深字段/集合元素/循环折叠；异常 payload/栈；异步续体（await/.then/定时器）；后台请求车道；运行时 ×3；`links`；时间窗 `INFERRED`；采样/丢弃策略；sourcemap 解码或上传；SSE/WS/实时；持久化/DB/CORS/鉴权/TLS/Tomcat/WAR/React/云端；preview 注入内联脚本或 manifest。

## 3. 文件地图与归属（零交集）

| 路径 | owner | 本阶段动作 |
|---|---|---|
| `fixtures/s5-l1-values/{events.ndjson,expected-facts.json,README.md}` | plan-writer | **已创建**（本文 §9） |
| `docs/contracts/{api.v1,event-model.v1}.md` | plan-writer | **已更新**（加性、历史保留） |
| `docs/guides/frontend-shallow-plugin.md` | plan-writer | **已创建**（路径按 dispatch §5.1/§6） |
| `docs/plans/stages/S5/s5-plan.md` | plan-writer | 本文 |
| `demo/.../backend/{controller/OrderController.java,service/OrderService.java,mapper/OrderMapper.java,resources/mapper/OrderMapper.xml}` | coder-L1 | §4 |
| `agent/src/main/java/io/traceboard/agent/**` | coder-L1 | §5（pom 仅 description） |
| `frontend/build-plugin/**`、`frontend/sdk/**`、`demo/.../frontend/{src,vite.config.ts,style.css}` | coder-frontend | §6（不改 package.json） |
| `server/collector/**`、`workbench/**` | coder-collector+workbench | §7 |
| `tools/verify/**`、`tools/perf/**`、`S5/test-report.md` | tester | §8/§10 |
| `schema/**`、`transport.v1.md`、`status-semantics.md`、S0–S4 fixture/文档、`README.md`、git | 冻结/acceptance | **一律只读**（acceptance 唯一写 git） |

## 4. demo 后端 L1（coder-L1）

### 4.1 端点（精确）

| 项 | 值 |
|---|---|
| 方法/路径 | `POST /api/orders/{id}/preview-discount`（除该端点外**不新增 API**） |
| Query | `requestedAmount`（double，必填）、`demoSecret`（String，必填）、`note`（String，必填）；缺参由 Spring 返回默认 400（不属 S5 断言） |
| 已知 id | `id=1` → `200`，body `{"data":0}`（`data` 为整数 `0`，不是 `0.0`） |
| 未知 id | 同样 `200 {"data":0}`；`findById=null` 时不写字段、不 NPE；**不返回 404 / `{"data":-1}` / `null`** |
| DB | 仅 SELECT；`orders.amount` 始终 `100.00`；**永不 UPDATE** |

### 4.2 Controller（`OrderController.java`）

```java
@PostMapping("/{id}/preview-discount")
public ResponseEntity<Map<String, Object>> previewDiscount(
        @PathVariable long id,
        @RequestParam("requestedAmount") double requestedAmount,
        @RequestParam("demoSecret") String demoSecret,
        @RequestParam("note") String note) {
    orderService.previewDiscount(id, requestedAmount, demoSecret, note);
    Map<String, Object> body = new LinkedHashMap<String, Object>();
    body.put("data", Integer.valueOf(0));
    return ResponseEntity.ok(body);
}
```

- nodeKey：`com.example.shop.controller.OrderController#previewDiscount`；`return={"type":"org.springframework.http.ResponseEntity","value":200}`（沿用 `SpanContext.httpStatus()` 反射）；无 `values`。
- 复用 `RequestHeaders.current()`：有 `traceparent`/`X-TraceBoard-Click` → EXACT join；无头 → 既有 LOST 游离根，**不伪造 EXACT**。
- 不改 `list()`/`cancel()` 的签名与行为；不打印 query（尤其 `demoSecret`/`note`）。

### 4.3 Service（`OrderService.java`）

```java
public double previewDiscount(long id, double requestedAmount, String demoSecret, String note) {
    Order order = orderMapper.findById(id);
    if (order != null) {
        order.setAmount(0.0d);        // 仅内存；绝不 update
    }
    return 0.0d;
}
```

- 签名保留 `long id`（路径参数，供 `findById`）；**L1 参数项只采 `requestedAmount`/`demoSecret`/`note`（按这三个参数的声明顺序）**，`id` **不进入** `values`（见 §5.3；dispatch §3 只固定签名，未规定 advice 参数下标，本节为唯一实现口径）。
- 三个业务入参在业务上不使用，但不写日志、不存字段、不拼 SQL。
- 已有 `cancel(long)` 一行不动（案例 A）。

### 4.4 Mapper / XML

```java
Order findById(@Param("id") long id);   // OrderMapper.java
```

```xml
<select id="findById" resultMap="OrderMap">
  SELECT id, order_no, status, amount FROM orders WHERE id = #{id}
</select>
```

- `findById` **不插桩**：`MapperAdvice` 只匹配 `cancelById`，`SqlAdvice` 只匹配 `.cancelById` 的 mapped statement，S2 过滤逻辑不改。
- resultMap 的 `amount` 映射走 `Order#setAmount(double)` → 这条 hydration 写入是“必须排除”的诱饵（§5.4）。

### 4.5 隐私与失败语义

- 不记录 `demoSecret`/`note`/query/请求体；错误响应不回显 query（Spring 默认）。
- collector 不可达仍 `200 {"data":0}`（agent fail-open）；DB 异常按既有错误处理，不新增错误码。
- 只有 `previewDiscount` 走 `findById`；`list()`/`cancel()` 的数据路径不变。

## 5. Agent L1（coder-L1）

### 5.1 插桩总表（7 advice / 5 类型；S2 四点原样）

| # | 类型#方法 | advice | kind | emit |
|---|---|---|---|---|
| 1 | `OrderController#cancel(long)` | `ControllerAdvice` | controller | 是（不变） |
| 2 | `OrderService#cancel(long)` | `ServiceAdvice` | service | 是（不变） |
| 3 | `MapperProxy#invoke`（cancelById 过滤） | `MapperAdvice` | mapper | 是（不变） |
| 4 | `PreparedStatementHandler#update`（cancelById 过滤） | `SqlAdvice` | sql | 是（不变） |
| 5 | `OrderController#previewDiscount(long,double,String,String)` | `PreviewControllerAdvice` | controller | 是 |
| 6 | `OrderService#previewDiscount(long,double,String,String)` | `PreviewServiceAdvice` | service | 是（含 values） |
| 7 | `com.example.shop.model.Order#setAmount(double)` | `FieldWriteAdvice` | — | **否**（只追加值） |

类型集合 = `OrderController`、`OrderService`、`MapperProxy`、`PreparedStatementHandler`、`Order`。jar 仍 major 52、shaded、无新依赖。

### 5.2 Preview controller advice

- 新增 `CONTROLLER_PREVIEW_NODE_KEY`；`SpanContext` 的 `enterController/exitController` 增加带 nodeKey 的重载，旧 `cancel` 方法委托到同一实现（字节兼容）。
- `@Advice.Return(readOnly=true) Object` + `SpanContext.httpStatus()` 得 200；`THREW` 时不编造 return；LOST 分支保持 S2 规则；`flags` 仍 `[S2_ZERO_ROW_CHAIN]`（有 EXACT link 时按现有顺序加 `S3_EXACT_LINK`）。

### 5.3 Preview service advice（values 主载体）

- `@Advice.Argument(1..3)`（实现写作 `@Advice.Argument(1)`/`(2)`/`(3)` 三个注解，此区间为简写）在 enter 时按声明顺序格式化为 param 项（`requestedAmount`→`100`、`demoSecret`→占位符、`note`→2048 x）；`@Advice.Argument(0)` 是 `long id`，**不采**；参数项**固定 3 个**，不得出现 `name="id"`；`line=null`、`from=null`。
- `@Advice.Return(readOnly=true) double` 在 exit 时追加 `return` 项（`to=0`）；`status=OK`；**不得**复用 `ServiceAdvice` 的 boolean→`RETURNED_FALSE` 映射（double 0 是值，不是 false）。
- `THREW` → 只 emit params，不追加 return 项；仍带 `L1`。
- 合计**恰 5 项**：3 个 `param`（`requestedAmount`/`demoSecret`/`note`）+ 1 个 `field`（§5.4）+ 1 个 `return`；`id` 永不出现。
- span 级：`return={"type":"double","value":0}`；`flags` 加 `L1`（顺序 `S2_ZERO_ROW_CHAIN`, `L1`, 追加项, `DROP_COUNT=<n>`）；`source` 仍 `findSource(OrderService.class)`。

### 5.4 字段 advice（`Order#setAmount(double)`）

```java
@Advice.OnMethodEnter
static void enter(@Advice.This(optional = true) Object target, @Advice.Argument(0) double newValue) {
    SpanContext.recordFieldWrite(target, "amount", newValue);   // 内部全 try/catch，绝不抛
}
```

`recordFieldWrite` 依次判定（任一不满足即静默返回，**不 emit**）：

1. `target != null` 且 `target.getClass().getName().equals("com.example.shop.model.Order")`（精确类名，不 `instanceof`）。
2. 当前线程栈顶 frame 的 `kind=service` 且 `nodeKey=com.example.shop.service.OrderService#previewDiscount`。
3. `new Throwable().getStackTrace()` 中从下标 0 到首个 `OrderService.previewDiscount` 之间**没有** `org.apache.ibatis` 帧（排除 hydration 的 0→100）；找不到 `previewDiscount` 也返回。
4. 反射 `target.getClass().getMethod("getAmount").invoke(target)` 得旧值（异常→返回；不编译依赖 demo 类）。
5. `Double.compare(old, new) != 0`（相同值不产生值项）。
6. 预算内（≤30）追加 field 项（`from=old`, `to=new`）；超预算丢弃并给该 span 记 `VALUES_CAPPED=<n>`。

因此 preview 链**恰一条** `amount 100→0`；`cancel`/`list` 链 0 条（案例 A 与 `loadOrders` 不变）。

### 5.5 值格式化（脱敏 → 截断 → 预算）

| 规则 | 实现 |
|---|---|
| 名称脱敏 | 名称大小写不敏感**包含**即命中：`password|token|secret|authorization|cookie|idcard|phone|email|bankcard`；`to`/`from` 只留 `[REDACTED len=<原值 UTF-8 字节数>]`，`redacted=true`，原值绝不出现在事件任何字段 |
| 截断 | 单字符串 UTF-8 >2048B：按码点边界截到 ≤2048B，**不追加省略号**，`truncated=true`；`truncated` 不改 `status` |
| 只采标量 | `String/Number/Boolean/Character`；`null`/数组/对象/`NaN`/`Infinity` → 跳过并给 span 记 `L1_SKIPPED=<n>`（不静默丢弃） |
| 预算 | 单 span `values` ≤30（先到先留）；单 span 序列化后 >64KB（collector 行上限 `MAX_LINE_BYTES`）→ 按顺序丢弃尾部值项并追加 flag `VALUES_CAPPED=<n>`（**agent 侧自行测量，现有 `SpanEmitter`/`EventSender` 没有 64KB 限制**；`EventSender` 不负责截断，demo 5 项不触发）；参数项固定 3 个，不得出现 `id` |
| 数字 | 整数值 double 用无小数点形式（`0.0`→`0`、`100.0`→`100`，`BigDecimal.valueOf(v).stripTrailingZeros().toPlainString()`）；其余 `Double.toString` |
| 键序 | 每项固定 `name,kind,line,from,to,truncated,redacted`（**项内键序不属契约**，测试按 JSON 语义比对）；数组序 = 参数声明序 → 字段写入序 → return |
| 无值 | 无 values 的 span **省略** `values` 字段（绝不写 `[]`）；事件对象键序不参与契约 |

### 5.6 Emitter / SpanContext 扩展

- `SpanEmitter.emit(...)` 增加可空 `valuesJson`：非空时在 `flags` 之后追加 `,"values":[...]`；空则整键省略 → S2–S4 事件字节不变。
- `Frame` 增可变容器：`values` 列表 + `extraFlags` 列表（`L1`/`VALUES_CAPPED=<n>`/`L1_SKIPPED=<n>`），其余字段仍 final；`recordFieldWrite` 只改当前 service frame。
- fail-open：所有新增路径包 `try/catch(Throwable)`；collector 停服仍 `200`；不阻塞业务线程。

### 5.7 构建约束

- `agent/pom.xml` 只允许改 `description`；不加依赖；继续 shade + `maven.compiler.release=8`（jar major 52）。
- 不编译依赖 Spring/Servlet/demo 类（全部反射/字符串常量）。

## 6. 前端浅层（coder-frontend）

### 6.1 插件模块

- 目录 `frontend/build-plugin/`：`package.json`（`@traceboard/vite-plugin`、`private:true`、`type:"module"`、`exports:"./index.mjs"`、脚本 `test:"node --test test/plugin.test.mjs"`、**零依赖**）、`index.mjs`（默认导出 `traceboardShallow(options?)`）、`index.d.mts`、`test/plugin.test.mjs`。
- demo `vite.config.ts`：`import traceboardShallow from "../../../frontend/build-plugin/index.mjs"`（从 `demo/buggy-shop-boot-vue/frontend` 回溯三级到仓库根；默认导入形式与 guide §2/§3 逐字一致）；`plugins: [vue(), traceboardShallow()]`；追加 `build: { sourcemap: true }`；同步删除该文件内“no build plugin”旧注释；`package.json` 不改（相对 import，无新依赖）。
- `index.mjs` 必须 `export default traceboardShallow`（可另导出命名 `traceboardShallow`/`scanFunctions`，但冻结的接入写法是默认导入）；`index.d.mts` 必须提供默认导出声明；demo `tsconfig.json` 已是 `moduleResolution: "bundler"` 且 `include` 含 `vite.config.ts`，`vue-tsc --noEmit` 必须能解析该 `.mjs` 的类型。

### 6.2 扫描（浅层正则，不引 AST）

- 范围：`src/**/*.{vue,ts}`（递归、文件名排序、UTF-8、`\r?\n` 保留行号）；`.vue` 用**全文** 1-based 行号，不剥离 `<template>`。
- 规则 R1：`^[ \t]*(?:export[ \t]+)?(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(`；R2：`^[ \t]*(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[^;\n]*wrapFn\([ \t]*["']\1["']`。
- 同名去重：首个胜出 + `this.warn`；结果按 `file,line,name` 排序；上限 500（超出按排序截断并 warn）。
- 产物 `{"functions":[{"name","file","line"}]}`：`file` 相对 demo frontend 根、POSIX 分隔；`line` 1-based 整数；`JSON.stringify(manifest, null, 2)` + 换行（dev/build 同源同字节）。

### 6.3 三个出口

| 出口 | 行为 |
|---|---|
| dev 中间件 | `GET /traceboard-manifest.json` → 200、`Content-Type: application/json; charset=utf-8`、`Cache-Control: no-store`；每次请求重扫（无缓存）；扫描异常 → 500 `{"error":"manifest_scan_failed"}`；非 GET → `405`（**不落回 Vite**；与 guide §5 逐字一致） |
| build 产物 | `generateBundle`/`this.emitFile` 产出 `traceboard-manifest.json`（与中间件同内容） |
| index.html 内联 | `transformIndexHtml`（`head-prepend`）注入 `<script>window.__TRACEBOARD_MANIFEST__ = <json>;</script>`；`<` → `\u003c`（防 `</script>` 截断）；仅构建插件，**preview（8602）不注入任何 manifest/内联** |

### 6.4 SDK（`frontend/sdk/src/index.ts`）

- 启动时同步读 `window.__TRACEBOARD_MANIFEST__`；缺失且 ESM（`__TRACEBOARD_IIFE__ === false`）时**一次** `fetch("/traceboard-manifest.json", {credentials:"same-origin", cache:"no-store"})` 兜底；无重试/无缓存/不产生事件/失败即空表；**IIFE 与 preview 不兜底**。
- 命中规则：`wrapFn` 的 `js_method` span 按 name 附加；click 根仅当目标元素有 `data-tb-fn="<name>"` 且 manifest 命中时附加；fetch/render/未命中**不猜**。附加时 `source={file,line}`（`file` 非空字符串、`line` 整数 ≥1，否则忽略）并追加 flag `SOURCE_MAPPED`；`SOURCE_MAPPED` 只表示 manifest 命中，**不是** `.map` 解码。
- 无 manifest / 未命中 → 事件字节与 S3 完全一致；SDK 不读 `.map`、不采集 values/表单值、不加 localStorage/CDN。
- 同步更新 `frontend/sdk/src/index.ts` 头注释（`Hard boundaries (S3; ...)` 与 `no build plugin, no sourcemap, no file/line...`）为 S5 真实能力：`Hard boundaries (S5; ...)`、`no .map decoding; file/line only via build manifest (SOURCE_MAPPED); no local variables/values[]`；`demo/.../src/main.ts` 注释改为 `S5 build plugin emits function/file/line manifest (no .map decoding); local variables remain S6`（B3：源码注释不得继续宣称错误能力）。

### 6.5 demo 页面与 sourcemap

- 新增 `#btn-discount`（`data-tb-fn="previewDiscount"`）与 `async function previewDiscount()`：固定 `id=1`、`requestedAmount=100`、`demoSecret=s3cr3t`（假值）、`note="x".repeat(3000)`，逐段 `encodeURIComponent` 拼 query；展示 `{"data":0}` + `仅内存返回 0、数据库金额未改`；**不调用 `loadOrders`**；不触碰案例 A/B 逻辑。
- 页头文案改为 S5 真实能力，逐字：`S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`；保留案例 A/B 说明；不得再出现 `无构建插件/sourcemap` 或“行号/局部变量属 S5，本次未采集”。
- 仅 demo `build.sourcemap=true`；`dist/` 已 gitignore，`.map` 不提交、不上传、不解析；workbench/SDK 仍无 `.map`。

### 6.6 限制（必须写进 guide/README）

`previewDiscount`/`validateForm`/`cancelOrder` 等**原始函数**行号；minify 后不能用函数名猜行号；`.vue` 行号含 template；CSP 拦内联时走 JSON 兜底（早期事件可能无 source）；preview 页无 manifest 即无 source；这是 F1/F2 浅层，不是 L2 行级变量。

## 7. collector 与 workbench（coder-collector+workbench）

### 7.1 GraphNode 15 字段

- `GraphNode` record 追加第 15 个 `JsonNode values` 并加入 `@JsonPropertyOrder`（末尾）；15 字段恒出现。
- `SpanFacts` 追加 `JsonNode values`，解析用 `event.get("values")`（缺失/`null` → `null`，**不要** `arrayOrEmpty`）；`TraceDeriver` 原样透传，不重算/合并/裁剪/排序。
- 事件无 `values` → graph `values:null`；S2/S3/S4 fixture 全部落到 `null`。
- `events`/`seq`/`requests`/`replay`/meta 5 键/错误码/只读/幂等：零改动。

### 7.2 工作台与 demo 前端文案（`workbench/src`、`demo/.../frontend/src`）

- `api.ts`：`GraphNode` 加 `values: L1Value[] | null`；`toGraphNode` 保留 `null`，不把缺失转 `[]`；`L1Value` 含 `name,kind,line,from,to,truncated?,redacted?,invocation?`。
- 详情（`S4DetailPanel.vue`，可抽 `s5/`）新增：
  - `#s5-l1-badge`：flags 含 `L1` 时显示 `L1`；
  - `#s5-values` 区 + `#s5-values-note` 静态文案逐字：`S5 L1：参数/字段写入/返回摘要；局部变量（L2）与行级属 S6，本阶段未采集`；
  - 每行 `[data-value-kind="param|field|return"]`：名称、`from → to`（field 的 `100 → 0` 高亮）、`已脱敏`/`已截断` 徽标、页脚 `行号未采集 · 第 1/1 次`（有 `invocation` 用真实 `第 i/N 次`）；
  - 序号来源注记（N12）：值行序号来自 `values.invocation`（缺省 `第 1/1 次`），S4 ×N 组序号来自同 `nodeKey` 的已采集 span 分组；两者来源不同，UI 不得混用（S5 demo 单次，值行仍 `第 1/1 次`）；
  - `#s5-values-empty` 逐字：`未采集（该节点无 values；S5 只采参数/字段写入/返回摘要）`；
  - `#s5-source`：完整 source → `file:line`；flags 含 `SOURCE_MAPPED` → 追加 `（manifest 映射）`；缺失/不完整 → `未采集`（后端不加后缀）。
- **删除/迁移全部旧能力口径（B3；旧串在 `src` 与构建后的 `dist` 都不允许残留）**。下表为逐字替换，owner：demo 前端文案归 coder-frontend，工作台文案归 coder-collector+workbench：

  | 位置 | 旧串（删除） | S5 精确替换（逐字） |
  |---|---|---|
  | `workbench/src/App.vue:22`（页头） | `无构建插件/sourcemap/局部变量` | `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`（保留 `· 非实时（无 SSE/WS）· 回放不重发请求/不写数据库`） |
  | `workbench/src/components/S3Panel.vue:792` | `缺少调试信息（需构建插件/sourcemap，S5 待做）` | `缺少调试信息（后端 NOT_COLLECTED_NO_DEBUG_INFO；S5 manifest 只覆盖前端函数/文件/行号，局部变量属 L2/S6）` |
  | `S3Panel.vue:897` | `如 NOT_COLLECTED_NO_DEBUG_INFO → 需构建插件/sourcemap（S5 待做）` | `如 NOT_COLLECTED_NO_DEBUG_INFO → 后端缺少调试信息（S5 manifest 只覆盖前端函数/文件/行号，局部变量属 L2/S6）` |
  | `S3Panel.vue:1038`（脚注） | `无构建插件/sourcemap、无局部变量、非实时（无 SSE/WS）。` | `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）· 非实时（无 SSE/WS）。` |
  | `S3Panel.vue:1008`（节点注记） | `JS 内部变量本次未采集（无构建插件/sourcemap）` | `JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）` |
  | `S3Panel.vue:1465`（脚注） | `无 S5/S6（无 sourcemap/局部变量/行号映射/图库/SSE/WS）` | `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）、无异步/×3/图库/SSE/WS` |
  | `workbench/src/components/S4DetailPanel.vue:229` | `（无 sourcemap/行号映射；缺失即未采集）` | `（manifest 命中显示 file:line；缺失即未采集；无 .map 解码）` |
  | `demo/buggy-shop-boot-vue/frontend/src/App.vue:101`（页头） | `无构建插件/sourcemap（行号/局部变量属 S5，本次未采集）` | `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）` |
  | `frontend/sdk/src/index.ts` 头注释 / `demo/.../src/main.ts:7` / `vite.config.ts` 旧注释 | `no build plugin, no sourcemap...` / `no build plugin` | `no .map decoding; file/line only via build manifest (SOURCE_MAPPED); no local variables/values[]`；`S5 build plugin emits function/file/line manifest (no .map decoding); local variables remain S6`（B3：注释同属诚实性要求） |

- acceptance 在 `README.md`/`acceptance.md` 加一行指针：`S5 起 demo 前端另有浅层 manifest/sourcemap（仅函数/文件/行号）；preview 页无 manifest`，避免读者按 `docs/guides/local-launcher.md` 的 S4 历史口径误判当前能力。
- canonical 串 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）` 用于能力横幅（工作台页头/脚注、demo 页头）；`NOT_COLLECTED_NO_DEBUG_INFO` 是**后端**原因，必须用表中后端专用措辞（manifest 只覆盖前端，不能宣称修复后端），且任何位置都不再出现 `S5 待做`。

- 保留 S4 详情/×N/缺口、S3 时间轴/回放、S0–S2 面板；无图表库/SSE/WS/localStorage/写请求。

## 8. 性能基线（tester：`tools/perf/l1-overhead.mjs`）

- 依赖：Node 22 标准库；参数 `--n 100 --warmup 20 --rounds 3 --port 8080`；JDK 路径默认取 `JAVA21`/`JAVA8` 环境变量，缺省用 §11 常量。
- 流程：起 collector（JDK21）→ demo 无 agent（JDK8，`-Dserver.port`）→ 等 `/api/orders` 200 → 预热 20 → 3 轮 ×100 **顺序** POST（URL 同 demo，note 3000 x，`hrtime.bigint`）→ 停 demo → demo 有 agent（`-javaagent`，session `s_s5perf`，等 hello `connected:true`）→ 预热 → 3×100 → 停 → 输出。
- 统计：每轮 p50/p95（nearest-rank）；3 轮 p50/p95 取中位数；`ratio = median(agent p50) / median(base p50)`；报告 base/agent 事件数（agent 必须 >0）。
- 判定：**只报告**；ratio >1.25 打印 `WARN l1_overhead_ratio>1.25`，exit 仍 0；**1.25 只是 WARN 文案阈值，不是验收门槛/硬指标**，不得据此判 FAIL 或伪造数字；不删慢样本、不预计算、不用 fixture 代替实测；setup 失败 exit 1；参数错误 exit 2；`finally` 停进程、释放端口/临时目录。原始数字进 `S5/test-report.md`。

## 9. 契约与 fixture（本轮已落盘）

### 9.1 契约

- `api.v1.md`：S5 变更记录；§2.5 S5 实现矩阵；§8.2 节点 15 字段（含 `values` 行）；§9.3 工作台文案；§10.6 取代说明（N10：明确浅层插件/manifest/sourcemap，仍无 `.map` 解码/局部变量）；§10.9 `values` 只读 8 条规则 + 序号来源注记（N12）；附录 D `preview-discount`（含未知 id 200/0、五项不含 path `id`）；附录 E manifest/source。
- `event-model.v1.md`：§4.4.1–4.4.6（param/field/return、脱敏、截断、预算、精确五项、排除项）；§4.3 S2 `cancel` 404 历史与 S5 `preview-discount` 200 的并列澄清（N1）；§4.4.4 预算表补“对象字段 ≤30（预留）”并说明 64KB 由 agent 序列化后测量（N2/N3）；§7 flags `L1`/`SOURCE_MAPPED`/`VALUES_CAPPED`/`L1_SKIPPED`；§12.11 manifest `source`。
- `transport.v1.md` 与 `schema/**`：**字节不变**（graph `values` 走既有 get 响应体；无新路由、无 schema 变更）。

### 9.2 `fixtures/s5-l1-values/`

- `events.ndjson`：4 行 compact JSON，session `s_s5values`、traceId `5a6b7c8d9e0f1a2b3c4d5e6f708192a3`；click `#btn-discount` → fetch → controller → service（EXACT、嵌套区间、service 带 5 项 values + `S2_ZERO_ROW_CHAIN`,`L1`；其余 3 span 省略 `values`）。
- `expected-facts.json`：requests 1 行（EXACT/4 span/`fetchCount=1`/`backendSpanCount=2`/`durNs=42000000`）、graph 4/3、每节点 15 键、4 个 replay 窗口、工作台选择器/文案/徽标/`100 → 0`；`note` 用 `toBytes=2048`/长度/正则断言，不复制 2KB；`valueNames` 恰 `["requestedAmount","demoSecret","note","amount","return"]`（无 `id`）、`valueCount=5`；`flagsClick`/`flagsService` 是 fixture 精确快照，`flagsAreContainsOnly:true` 注明**运行时只做成员包含/禁项断言**，不得整数组相等。
- `README.md` 首段逐字：`本目录是 S5 测试数据，不是运行时证据；运行时 L1 由 demo+agent 产生。不含真实 secret；demoSecret 是假值。` 并写明 hydration/字段 advice 排除、无 L2/对象深采、flag 用“包含”断言。
- fixture 事件的对象键序不属于契约：fixture 把 `values` 放在 `flags` 之后（事件最后一个键），运行时同样在 `flags` 后追加；`values` 项内键序为 `name,kind,line,from,to,truncated,redacted`，**项内/事件内键序都不作逐字字节断言**，测试按 JSON 语义比对（N6/N8）。

### 9.3 离线校验（已执行）

`Ajv 2020-12 strict`（`tools/verify/node_modules/ajv/dist/2020.js`，未安装新依赖，未改 `package.json`）：

```bash
node -e "const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;const fs=require('fs');const a=new Ajv({strict:true,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));const ls=fs.readFileSync('fixtures/s5-l1-values/events.ndjson','utf8').trim().split('\n');let n=0;ls.forEach((l,i)=>{if(v(JSON.parse(l)))n++;else{console.error('line',i+1,v.errors);process.exitCode=1;}});JSON.parse(fs.readFileSync('fixtures/s5-l1-values/expected-facts.json','utf8'));console.log('lines',ls.length,'schema ok',n);"
```

结果：`lines 4 schema ok 4`、4640 bytes、`note` 恰 2048 个 `x`、全文无 `s3cr3t`、`expected-facts.json` 10 条 facts 与事件逐条比对 0 差异。

## 10. 测试计划（tester；一次命令、串行起停、`finally` 清理）

| 组 | 断言要点 |
|---|---|
| **S5-A** demo | JDK8 构建；preview 200 `{"data":0}`；`/api/orders` amount `100.00`；案例 A cancel 仍 200 true + SQL 0 行；源码/XML 含 `findById`、无 UPDATE；**除 `preview-discount` 外无新端点（无新 collector 路由）**；未知 id 200/0 |
| **S5-B** agent | collector+demo+agent；带 traceparent/click → controller+service 2 span（无 mapper/sql）；`values.length===5`、param 的 `name` 恰 `["requestedAmount","demoSecret","note"]` 且**无 `name="id"`**（五项精确：100/`[REDACTED len=6]`/2048+truncated/100→0/0）；flags `L1`；无 local/`VALUES_CAPPED`/`L1_SKIPPED`；无 hydration 0→100；无原 secret；schema 合法；案例 A 4 span/0 行；collector 停仍 200 |
| **S5-C** collector | ingest fixture：graph 4/3、每节点 15 键有序、service values 数组/其余 `null`；`events/seq` 不改写、requests 形状不变、replay 原样回显 values；S2/S4 graph 第 15 字段 `null`；400/404/405/meta 5 键不变 |
| **S5-D** plugin | 插件单测（两类声明/行号/排序/去重/空目录/坏 JSON/零依赖）；demo build 有 `.map` + `traceboard-manifest.json`；dist 内联含 `validateForm`/`previewDiscount` 且行号=源文件重算值；dev 中间件 200 JSON；workbench/SDK dist 无 `.map`；`.map` 未入库 |
| **S5-E** SDK | manifest 同步/JSON 兜底一次/坏 manifest fail-open；`wrapFn("validateForm")` 事件带 source+`SOURCE_MAPPED`（`file=src/App.vue`、line=源文件行）；无 manifest 字节同 S3；fetch/render 不附加；`data-tb-fn` click 命中；不采 values/表单值；IIFE 无 map/CDN；demo VM 事件 `src/App.vue:<line>` |
| **S5-F** UI | ingest fixture 后 dist 静态断言选择器/文案/徽标/`100 → 0`/`行号未采集`/`第 i/N 次`/空 values 逐字；`#s5-source` 断言 `file:line`、manifest 命中追加 `（manifest 映射）`、缺失 `未采集`（后端不加后缀）；S4 选择器/缺口/×N 保留；**B3 反向断言（src+dist 同时）**：`workbench/src/**`、`workbench/dist/**`、`demo/.../frontend/src/**`、`demo/.../frontend/dist/**` 均不含 `无构建插件/sourcemap`、`S5 待做`、`无 S5`、`S5/S6`、`无 sourcemap/行号映射`；`frontend/sdk/src/**` 与 demo `vite.config.ts` 不含 `no build plugin`/`no sourcemap`；dist 必须含 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`（工作台页头/脚注 + demo 页头）与 `JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）`（工作台），并保留 forbidden `kind=local`/`L2 已采集`；浏览器截图由 orchestrator 另证 |
| **S5-G** perf | 脚本 exit 0；输出 3 轮 p50/p95/ratio；>1.25 仅 WARN；无硬阈值；agent 事件数 >0；端口/进程清理；test-report 有原始数字 |
| **S5-H** 回归 | S0–S4 锚点全 PASS；案例 A/B、EXACT、回放 0 写、S2 LOST 4-span；schema/S0–S4 fixture 字节不变；S5 G1 冻结零漂移 |
| **S5-I** 范围/安全 | 无 L2/local/async/×3/SSE/WS/持久化/Tomcat/React/云端；sourcemap 解码/上传 0（仅 demo dist 可有 `.map`/`//# sourceMappingURL`）；preview 仍只注入外部脚本；无真实 secret/PII/CDN/镜像；端口 8601/8080/5173/5174/4173/4174/8602/18080 无监听、无 java/node 残留、git index 未动 |

**门禁迁移**（不放宽其余断言）：`S4-F` graph 14→15 键；`S2-8` 4 点→7 advice/5 类型；`S3-6` 文案迁移；`S3-8` 移除 sourcemap/build-plugin 禁项、新增禁 S6、demo 允许 `.map`；`S3-10` 白名单加插件/perf/S5 fixture，demo backend 仅 4 文件允许；`S4-I` 退役由 `S5-I` 继承；`S3-1`/`S3-7`/`S4-E` 测试数改实际值；`GRAPH_NODE_KEYS` 15；`S4_G1_FREEZE`→`S5_G1_FREEZE`（api/event-model/guide/fixture/s5-plan 用 S5 哈希）。

## 11. 精确命令（仓库根、全双引号）

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
export JAVA21="C:/Program Files/Java/jdk-21"
export JAVA8="C:/Program Files/Java/jdk1.8.0_221"

# 构建
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/collector" -am
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "agent" -am
JAVA_HOME="$JAVA8"  mvn -B -q -DskipTests package -f "demo/buggy-shop-boot-vue/backend/pom.xml"
(cd "frontend/build-plugin" && node --test test/plugin.test.mjs)
(cd "frontend/sdk" && npm ci && npm test)
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
(cd "workbench" && npm ci && npm run build)

# collector 8601
"$JAVA21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &

# demo + agent（session 必须 s_s3demo 才与 demo 前端 SDK 关联）
"$JAVA8/bin/java" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s3demo \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &

# L1 手动事实（3000 x；200 {"data":0}）
NOTE="$(printf 'x%.0s' $(seq 1 3000))"
curl -s -X POST "http://127.0.0.1:8080/api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=$NOTE"
curl -s "http://127.0.0.1:8080/api/orders" | head -c 200          # amount 仍 100.00
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"  # EXACT / 4 span / backendSpanCount 2

# fixture 独立校验（离线）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @"fixtures/s5-l1-values/events.ndjson"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s5values/graph?traceId=5a6b7c8d9e0f1a2b3c4d5e6f708192a3"

# 前端浅层（dev 5174）
curl -s "http://127.0.0.1:5174/traceboard-manifest.json"
grep -c "__TRACEBOARD_MANIFEST__" "demo/buggy-shop-boot-vue/frontend/dist/index.html"

# 性能（report-only）
node "tools/perf/l1-overhead.mjs" --n 100 --warmup 20 --rounds 3 --port 8080

# 门禁
(cd "tools/verify" && npm ci && node verify.mjs)
```

环境常量：JDK8 `C:/Program Files/Java/jdk1.8.0_221`、JDK21 `C:/Program Files/Java/jdk-21`、Node 22、Maven 3.9.5；端口 8601（仅 127.0.0.1）/8080/5173/5174/4173/4174/8602/18080；分支 `master`、无 remote；仅 acceptance 写 git。

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 字段 advice 误采 hydration 0→100 | 精确类名 + 顶层 frame `previewDiscount` + 栈内无 `org.apache.ibatis` + `old != new`；S5-B 断言恰一条 |
| 新 advice 改变案例 A / 多 span | preview 独立 advice；cancel 四点不动；字段 advice 不 emit；S5-B/S5-H 回归 |
| 脱敏/截断造假或泄密 | 名称正则含 `secret`；占位符只含长度；UTF-8 2048 边界；原值不出现断言；demo 假值 |
| 预算静默丢弃 | `VALUES_CAPPED`/`L1_SKIPPED` flag；demo 不触发并断言 |
| manifest 行号漂移 | 两类正则；1-based 原始行；排序/去重；测试从源文件重算行号 |
| 内联被 CSP 拦 | JSON 兜底；preview 不注入；文档写明 |
| sourcemap 被当 L2/上传 | 仅 demo build 产出；SDK 不读；S5-I 禁上传/解码 |
| perf 方差被指标绑架 | 预热 20、3×100、中位 ratio、report-only、原始数字入报告 |
| graph 15 字段破坏 S2–S4 | `values:null` 加性；其余端点零改动；GRAPH_NODE_KEYS 迁移；fixture 字节不变 |

## 13. 偏离记录（相对任务卡摘要）

| # | 摘要说法 | 实际执行 | 依据 |
|---|---|---|---|
| D1 | guide 路径 `docs/guides/frontend-source.md` | 用 `docs/guides/frontend-shallow-plugin.md` | dispatch §5.1/§6 与 G1 冻结清单只认后者 |
| D2 | `transport.v1.md` 必要时小改 | **未改一个字节** | dispatch §6/§12 冻结；graph `values` 在 api §10.9 说明，无传输变更 |
| D3 | 未知 id 可能 404/`{"data":-1}`/`null` | 统一 `200 {"data":0}`，并在附录 D 显式写“不返回 404/-1/null” | dispatch §3 强制决策 |
| D4 | fixture“controller LOST root + service” | 4 行 EXACT click→fetch→controller→service | dispatch §4.6 与 S5-C 的 requests/span 计数 |
| D5 | `note` 截断带 `…` | 恰 2048 个 `x`，无省略号 | dispatch §4.2“不追加省略号” |
| D6 | — | fixture 不写 `DROP_COUNT`/`S3_RUNTIME_SDK`/`S3_EXACT_LINK` 等运行时建议 flag；断言用“包含” | 沿用 S3/S4 fixture 约定，避免伪装运行时精确字节 |
| D7 | G1 返工（B1/N8） | fixture `expected-facts.json` 仅加非契约断言键（`valueParamNames`/`idParamAbsent`/`flagsAreContainsOnly`），**`events.ndjson` 字节不动**（仍 5 项） | B1 精确五项 + N8 运行时包含断言；不改变 fixture 事件形状 |

- 协调项（非延期缺陷）：`dispatch.md` 属 dispatcher 所有权，本轮**未改**；其 §3 只固定服务签名 `previewDiscount(long,double,String,String)`、未规定 advice 参数下标，故与 §5.3 的 `Argument(1..3)` 不冲突。若复评要求 dispatch 同步措辞，需 dispatcher 卡处理；本计划已给出唯一实现口径。

## 14. 停止条件

1. 必须改 schema/事件类型/status 枚举，或引入 `kind=local`/L2/异步/×3/SSE/WS/持久化/云端才能达标。
2. 必须让 preview 注入内联/CSP 改写、伪造脱敏/截断/性能数字、或用 fixture 冒充运行时。
3. 必须改变案例 A 行为/DB amount、多出 span，或放宽 S2–S4 门禁。
4. 必须引入真实 secret/PII/第三方镜像/CDN，或改他人路径。
5. G1 FAIL 且一轮返工仍 FAIL；测试未绿却想先提交。
6. 任何 S6 开工意图（S5 到检查点即停，S6 需新分发书）。

## 15. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-27 | 首版：L1 demo/agent 设计、values 语义与预算、graph 15 字段、浅层 manifest/SDK source、workbench 详情、perf 脚本、契约/fixture、S5-A..I 与迁移、命令、风险、偏离 |
| v2 | 2026-11-27 | G1 FAIL 返工第 1 轮：B1 明确服务签名保留 `long id` 但只采 `@Advice.Argument(1..3)`、参数项固定 3 个/五项不含 `id`，S5-B 加断言；B2 guide 插件相对路径统一为 `../../../frontend/build-plugin/index.mjs` + 默认导入/`.d.mts` 一致；B3 逐条列出 5 处旧 UI 文案及精确替换（canonical `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`），并在 S5-F 加 src/dist 反向断言与 S5 源信息正向断言。N1–N12 全部应用（event-model §4.3/§4.4.4、api §10.6/§10.9/附录 D、guide §2/§3/§7/§9、plan §5.5/§6.1/§6.3/§9.2/§10、fixture README/expected-facts 非契约键）；无延期项。`events.ndjson`/schema/transport/status 未改。 |