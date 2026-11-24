# S6a 计划：L2 选中方法行级局部变量 + 逐次 ×3（S6 仍 partial）

> 阶段：S6a（S6 子检查点；**S6 仍 🟡 partial**，S6b 完成后才做 S6 验收/tag）｜角色：plan-writer｜日期：2026-11-23｜版本：v2（G1 第 1 轮返工，B1–B6 + N1–N13）
> 唯一输入：`docs/plans/stages/S6/dispatch-s6a.md`（binding，下称 dispatch）、SOLO S6、主计划 §2.2/§2.3、§8.5、§9.1–9.4、§13.4、§16 T6/T7/T10、S0–S5 冻结契约/schema/fixture 与当前 demo/agent/collector/workbench。
> 本计划只描述 S6a 的设计与门禁；代码由 dispatch §5.3/§5.4 两张卡实现。G1 后本文与契约/fixture 一并冻结。
> **S6a 只做「选中方法行级局部变量 + 逐次 ×3」**；异步续体/无调试信息降级/预算与循环折叠/开销目标属 **S6b**（出现即 FAIL）。

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 检查点 | S6a：选中方法行级局部变量（LVT 探针）+ 逐次 ×3 |
| 完成信号 | 行级 `local` **100→0 在第 2 次调用**可见；同 nodeKey ×3 能指哪次坏 |

S6a 收尾必须同时成立（缺一即 FAIL；S6 仍为 partial）：

1. **Demo**：`POST /api/orders/1/reconcile` → `200 {"data":[100.0,0.0,100.0]}`；未知 id 同样 200 同形状；**无 DB 读写**；案例 A cancel 与 L1 preview-discount 行为不变。
2. **Agent L2**：一次请求内恰 3 个 `com.example.shop.service.L2DemoService#reconcileAmount` service span（同 controller 下 ×3）；第 2 个 span 的 `values` 含 `kind=local` 100→0 与行号；3 个 span 均带 `L2` flag、无 `L1`。
3. **不猜**：类/方法/LVT 缺失时 fail-open、无事件、无假值，日志计数（完整无调试信息语义属 S6b）。
4. **契约/fixture**：api/event-model 只做加性说明（graph 仍 **15 字段**、schema 字节不变）；`fixtures/s6-l2-lines/` 三件、Ajv 2020-12 strict 通过、仅测试数据。
5. **工作台**：L2 徽标、`行号 N` 与 `100 → 0`、×3 第 2 次高亮；非插桩方法不宣称 L2；S5 展示保留。
6. **门禁**：一次 `tools/verify` 覆盖 S6A-A..E + S0–S5 回归（§8.1 迁移），exit 0；S5 冻结 18 项**集合**保留，其中 api/event-model 两项由 `S6A_G1_FREEZE` **覆盖（supersede）**，不是放宽或删除断言（§8.1.1）。

## 2. S6a / S6b 边界（越界即失败）

- **S6a 内**：仅 `L2DemoService#reconcileAmount` 一个方法的行级局部变量（LVT 探针）、帧内 previous 去重、逐次 invocation；仅 `OrderController#reconcile` 一个 controller span；仅一个 demo 端点与一个前端按钮；graph 原样 `values`；工作台 L2 展示；S6a fixture。
- **S6b 内（S6a 出现即 FAIL）**：异步续体/线程池/`CompletableFuture`/`@Async` 上下文；`NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI；无 LVT 的降级事件；行级字段写入（`kind=field` + 行号）、对象深采、多方法选择；循环折叠/采样/丢弃预算、L2 开销脚本与 40% 目标；最终 S6 验收/tag/备份。
- 仍无：SSE/WS/实时、持久化/DB/CORS/鉴权、Tomcat/WAR/React/云端、sourcemap 解码、预览注入变化。

## 3. 文件地图与归属（零交集）

| 路径 | owner | 本阶段动作 |
|---|---|---|
| `docs/contracts/{api.v1,event-model.v1}.md`、`fixtures/s6-l2-lines/**`、`docs/plans/stages/S6/s6a-plan.md` | plan-writer | **已落盘**（§9；历史保留、仅加性） |
| `docs/plans/stages/S6/plan-review-s6a.md` | plan-reviewer | G1 只读复核（dispatch §5.2/§6 写作 `plan-review.md`；按本卡实际文件名登记并纳入 `S6A_G1_FREEZE`，N9） |
| `demo/.../backend/src/main/java/com/example/shop/service/L2DemoService.java`、`.../controller/OrderController.java`、`demo/.../frontend/src/App.vue`、`agent/**` | coder-agent | §4/§5 |
| `workbench/src/**`（含可新增 `s6/**`） | coder-workbench | §7 |
| `tools/verify/**`、`S6/test-report-s6a.md` | tester | §8 |
| `S6/{progress,s6a-acceptance}.md`、`STAGE-PROGRESS.md`、`README.md`、git | S6a checkpoint | report+commit；**无 tag/archive** |
| `schema/**`、`transport.v1.md`、`status-semantics.md`、S0–S5 fixture/文档、demo backend pom/yml/schema.sql/data.sql、demo frontend vite.config.ts/package.json、SDK/build-plugin | 冻结 | **一律只读** |

## 4. Demo（coder-agent，精确形状）

### 4.1 `L2DemoService`（新建；**独立于 `OrderService`**，避免 Byte Buddy/ASM 双转换器冲突）

```java
package com.example.shop.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

/**
 * S6a L2 demo (api.v1.md Appendix F, event-model.v1.md §4.4.7). Independent of
 * OrderService so the dedicated ASM transformer and the Byte Buddy advices
 * instrument two different classes. No DB, no logging, id intentionally unused.
 * The transformer reads this method's LocalVariableTable and inserts probes on
 * the two assignment lines only; no other class/method is instrumented.
 */
@Service
public class L2DemoService {

    /**
     * invocation == 2 performs the "bad" local = 0 write (the L2 100 -> 0 fact).
     */
    public double reconcileAmount(long id, double amount, int invocation) {
        double local = amount;
        if (invocation == 2) {
            local = 0.0d;
        }
        return local;
    }

    /** Not instrumented: emits no spans (S6a scope = reconcileAmount only). */
    public List<Double> reconcileBatch(long id) {
        List<Double> results = new ArrayList<Double>();
        for (int i = 1; i <= 3; i++) {
            results.add(Double.valueOf(reconcileAmount(id, 100.0d, i)));
        }
        return results;
    }
}
```

- 初始化行（`double local = amount;`）与坏行（`local = 0.0d;`）的行号由测试从该源文件重算；fixture 的 22/24 只是示意。
- 不写 `@Transactional`/日志/SQL；`id` 不使用；`reconcileBatch` **不插桩**（不产生 span）。

### 4.2 `OrderController#reconcile`（追加，不改既有方法）

```java
private final L2DemoService l2DemoService;   // 构造器追加参数（Spring 注入）

@PostMapping("/{id}/reconcile")
public ResponseEntity<Map<String, Object>> reconcile(@PathVariable long id) {
    List<Double> amounts = l2DemoService.reconcileBatch(id);
    Map<String, Object> body = new LinkedHashMap<String, Object>();
    body.put("data", amounts);
    return ResponseEntity.ok(body);
}
```

- nodeKey `com.example.shop.controller.OrderController#reconcile`；`return={"type":"org.springframework.http.ResponseEntity","value":200}`（沿用 `httpStatus()` 反射）；**无 `values`**。
- 复用 `RequestHeaders.current()`：有 `traceparent`/`X-TraceBoard-Click` → EXACT join（`parentSpanId=fetch.spanId`）；无头 → 既有 S2 LOST 游离根，**不伪造 EXACT**。
- 任何 id 纯计算：`200 {"data":[100.0,0.0,100.0]}`；**不查库、不 UPDATE**；不新增其它端点；`list()`/`cancel()`/`previewDiscount()` 一行不改。

### 4.3 demo 前端（`demo/.../frontend/src/App.vue`）

- 新增 `#btn-reconcile` 与普通 click 处理函数（**不用 `wrapFn`**）：`POST /api/orders/1/reconcile`，展示响应原文与“逐次调用：100/0/100（第 2 次为坏值）、无 DB 写入”提示；**不调用 `loadOrders`**。
- 页头能力句改为 dispatch §4.4 canonical banner；案例 A/B/L1 的 DOM/函数/请求不变（不新增 `wrapFn`、不改既有按钮）。

## 5. Agent L2（coder-agent；ASM 9.7 专用 transformer）

### 5.1 依赖与构建

- `agent/pom.xml` 增加 **`org.ow2.asm:asm`、`asm-tree`、`asm-commons` 9.7**（本机 `~/.m2` 已有，Java 8 兼容）；shade 包含 byte-buddy + 三件，relocate 到 `io.traceboard.agent.shaded.org.objectweb.asm`；jar 仍 major **52**；除 Byte Buddy 外**仅**这三个依赖。
- 断言（S6A-A）：jar 内 `io/traceboard/agent/shaded/org/objectweb/asm/**` 存在、无未 relocate 的 `org/objectweb/asm`；pom 无 Spring/Servlet/MyBatis 编译依赖。

### 5.2 专用 `ClassFileTransformer`（只匹配精确类）

- `Instrumentation.addTransformer(new L2ClassFileTransformer(), false)` 注册；`className.replace('/','.')` **精确等于** `com.example.shop.service.L2DemoService` 才处理，`classBeingRedefined != null` 直接返回 null。
- Byte Buddy builder **显式** `.ignore(ElementMatchers.named("com.example.shop.service.L2DemoService"))`（类型精确 ignore；Byte Buddy 只声明 `OrderController`/`OrderService`/`MapperProxy`/`PreparedStatementHandler`/`Order` 五个目标类型，其方法匹配器不会命中该类）；两个转换器互不接管（Byte Buddy 7 个既有 advice 不动）。
- 实现用 **asm-tree（ClassNode）** 两遍式：①读 class，定位方法 `reconcileAmount` 描述符 `(JDI)D` 与 `LocalVariableTable` 中 `name="local"`、`desc="D"` 的槽位/活性范围；②在行边界插探针，`ClassWriter(COMPUTE_FRAMES | COMPUTE_MAXS)` 输出。`ClassReader` **不得带 `SKIP_DEBUG`**（必须读到 `MethodNode.localVariables`）。类/方法/LVT/描述符任一不匹配 → **返回 null（原始字节）**并计数 `l2_no_method`/`l2_no_lvt`，不猜。
- 全程 `try/catch(Throwable)`：异常返回 null 并计数 `l2_transform_error`；安装成功打印 `l2_probes_installed method=reconcileAmount offsets=<init>,<assign> lines=<init>,<assign>`（两个探针的字节码偏移与源行，见 §5.4）；不足 2 个探针时打印 `l2_probe_missing` 并 fail-open（原字节、不伪造值）。

### 5.3 enter / exit / catch-all（支持 `THREW`）

- 分配新局部槽（`method.maxLocals` 起）：`enterNs`（long，2 槽）、`returnD`（double，2 槽）。
- enter：`enterNs = System.nanoTime();` → `SpanContext.enterL2(enterNs)`；`startNs` 与 `durNs` 用同一读数（`SpanEmitter.epochNanosFrom`）。
- exit：每个 `DRETURN` 前 `DSTORE returnD` → `LLOAD enterNs; DLOAD returnD; INVOKESTATIC SpanContext.exitL2(JD)` → `DLOAD returnD; DRETURN`。
- catch-all：`visitTryCatchBlock(start,end,handler,"java/lang/Throwable")`；handler `LLOAD enterNs; INVOKESTATIC SpanContext.exitL2Threw(J)V; ATHROW`。`exitL2`/`exitL2Threw` 都是 fail-open（内部 try/catch，异常不改变应用行为）。
- 若方法返回指令不是单一 `DRETURN`（未来签名漂移）→ 放弃整类插桩并计数，绝不半注入。

### 5.4 探针位置与行语义（B4 精确口径）

1. `ClassReader` **不得带 `SKIP_DEBUG`**；从 `MethodNode.localVariables` 精确匹配 `name="local"`、`desc="D"`（不按槽位猜名）。
2. 活性范围用 **inclusive start** 判定：`lvtStart <= insertOffset && insertOffset < lvtStart + lvtLength`。javac8 下 `local:D` 的 `Start` 就是初始化行结束/下一行起点（探针偏移），排他实现会丢掉初始化探针、导致第 1/3 次无值或第 2 次只有 `null→0`，S6A-C 必失败。
3. 遍历指令：遇到 `LineNumberNode` 切换当前行；在**行边界**（下一行真实指令起点 / 方法结束前）插入探针，但若该行最后一个**真实指令**是 jump/return/throw/switch/label/frame 则**不插**。探针形如
   `LDC line; LDC "local"; DLOAD index; INVOKESTATIC SpanContext.recordLocal(ILjava/lang/String;D)V`。
4. 初始化行的探针必须采到首个 `local` 值（100）；同一偏移只插一次。demo 恰 2 个探针：初始化行（偏移 = LVT start）与 `local = 0` 行（偏移 = `if` 跳转目标）；`if` 行/`return` 行以跳转/返回结束，不插。
5. transformer 自检：必须恰好安装 2 个探针，日志写 `l2_probes_installed method=reconcileAmount offsets=3,12 lines=<init>,<assign>`（示例偏移来自 JDK8 `javac 1.8.0_221`；行号以 `L2DemoService.java` 重算为准）；不足 2 个 → `l2_probe_missing` + fail-open，S6A-A 必须校验该自检结果。
6. 坏行探针位于 `if_icmpne` 跳转目标，**非 2 路径也会执行**；因此 `previous` 必须按 `(frame,name)` 去重（D3 的运行时必要性），不能按 `(frame,line,name)`。line 22/24 仅为示意，测试一律重算。
7. 探针/enter/exit/record 均为 `public static`；注入代码只引用 `java/lang/System`、`io/traceboard/agent/SpanContext`，不引用 demo 之外的新编译依赖。

### 5.5 `SpanContext` 扩展（`recordLocal` 与帧）

- `Frame` 增可变字段：`boolean l2`、`int invocationIndex`、`boolean hasLocalValue`、`double lastLocalValue`、`Map<String,Integer> childCallCounts`（默认空）；**新增 `L2Values`** 承载带 `line`/`invocation` 的 local 项（`L1Values.Item` 的 `line` 固定 null、不可复用；不改 L1 行为）。
- `public static void enterL2(long enterNs)`：`SpanEmitter.isEnabled()` 为假直接返回；栈顶必须是 **controller** 帧且 `traceId != null`，否则计数 `l2_no_parent` 且**不压帧**；否则按父帧 `childCallCounts` 对 `L2_SERVICE_NODE_KEY` 自增得 `index`（1 起、每 controller 帧重置），压入 `kind=service`、`nodeKey=com.example.shop.service.L2DemoService#reconcileAmount`、`parent=controller`、继承 trace/root/confidence、`exactLink=false` 的帧，标记 `l2=true`。
- `public static void recordLocal(int line, String name, double value)`：仅当栈顶帧 `l2=true`；若帧内已有该 `name` 的 previous 且 `Double.compare(prev,value)==0` → **不追加**；否则追加一项：
  `{name,kind:"local",line,from:(首次?null:prev),to:value,truncated:false,redacted:false,invocation:index}`，并更新 previous。数字用无小数点格式（100/0）。
- `public static void exitL2(long enterNs, double returned)`：只弹**栈顶 `l2` 帧**（先 peek 校验再 poll，避免无父帧时误弹 controller）；`OK` + `return={"type":"double","value":...}` + values + flags `S2_ZERO_ROW_CHAIN`,`L2`；`source=findSource(L2DemoService)`。`exitL2Threw(enterNs)`：同样弹帧、`THREW`、`return=null`、仍带 `L2` 与已采值项。
- `previous` 只在帧内有效：每次调用首项 `from=null`；同值重复探针不追加（第 2 次恰 2 项、第 1/3 次各 1 项）。**首次观测（`from=null`）不是“值变化”，只是基线**；值变化判定只用于 UI（§7），规则 `from` 非空且 `from !== to`。

### 5.6 `ReconcileControllerAdvice`（Byte Buddy，EXACT header join）

- 新增 advice（镜像 `PreviewControllerAdvice`）：enter `System.nanoTime()` + `SpanContext.enterReconcileController(enterNs)`；exit `exitReconcileController(enterNs, returned, thrown)`。
- `SpanContext` 新增 `RECONCILE_CONTROLLER_NODE_KEY = com.example.shop.controller.OrderController#reconcile`，内部复用 `enterController/exitController(nodeKey)` 的 header 逻辑；`TraceAgent` 在 `CONTROLLER_TYPE` 上追加 `.transform(advice(ReconcileControllerAdvice.class, named("reconcile").and(takesArguments(long.class))))`（advice 变换 7→8）。
- 无 `values`；`confidence` 有合法头 `EXACT`、无头 `LOST`；不新增 mapper/sql span。

### 5.7 flags / source / 状态

- service：`flags=["S2_ZERO_ROW_CHAIN","L2", "DROP_COUNT=<n>"]`（emitter 自动追加 `DROP_COUNT`）；**无 `L1`**、子 span 无 `S3_EXACT_LINK`、无 `LOST_BACKEND`。
- `kind=service`、`status=OK`；`return={"type":"double","value":100|0}`；THREW 时 `return=null`（不编造）。
- `source` 来自真实 JVM 栈（`L2DemoService.java:<line>`）；`values[].line` 来自 LVT/行表，两者不混用。

## 6. collector / graph（零改动）

- collector 不改一行代码：graph 节点仍固定 15 字段（`values` 原样数组）、`events/seq/requests/replay`、meta 5 键、路由 9 条/10 条、错误码全部不变。
- `requests.backendSpanCount` 对 reconcile 链为 **4**（controller + 3 service）；同 nodeKey 仍是 3 个节点，×N 是前端聚合。
- ingest 只做既有 schema 校验（`local`/`line`/`invocation` 自 v1 起合法）；不重算/不排序/不补默认值。

## 7. 工作台（coder-workbench）

- **L2 徽标**：`#s6-l2-badge` 仅在节点 `flags` 含 `L2` 时显示 `L2`；非 L2 节点不显示、不宣称；L2 节点显示 `#s6-l2-note` canonical 说明，非 L2 保留 S5 原文。
- **local 行**：`#s5-values` 内 `[data-value-kind="local"]`（实现为 `:data-value-kind="value.kind"` 动态属性）显示名称 `local`、`行号 N`、`from → to`（`100 → 0` 高亮；首项 `from=null` 只显示 `to`）、页脚 `第 2/3 次`（`invocationText` 动态插值）。
- **值变化/×3 高亮（B5）**：判定为 `kind ∈ {local, field}` 且 `from !== null && from !== undefined && from !== to`；**首次观测 `from=null` 不是变化**。仅第 2 次调用（`b000000000000005`）的坏行项为真，第 1/3 次为假；`#s4-group-badge`/逐次列表中唯一为真的第 2 次加 `data-invocation-diff="true"`（`:data-invocation-diff` 动态）与可见 `值变化`，其余不加。
- **S6a 纯函数（供 fixture 断言，B6）**：`workbench/src/s6/**` 导出 `isL2Node(node)`（只认 `L2` flag，禁止 nodeKey 硬编码）、`localValueRows(node)`、`isValueChange(value)`（上述规则）、`invocationDiffNodes(group)`；S6A-D 用 fixture 的 3 个 service 节点直接断言（仅第二个 `isValueChange` 真/`invocationDiffNodes` 含其 spanId；第 1/3 假；第 2 次 local 行 `line=24/from=100/to=0`）。
- **测试分层（B6，写进验收）**：dist 只断言**静态 token**（选择器名 `s6-l2-badge`/`s6-l2-note`、CSS 类、`行号 `、`100 → 0`、`值变化`、canonical 三段、S5 选择器与文案）；`[data-value-kind="local"]`/`data-invocation-diff="true"`/`第 2/3 次` 是 Vue 动态属性/插值，**不作为 dist 字面量断言**。UI 条件性由 S6A-C 的运行时 values（第 2 次 2 项 `100→0`、第 1/3 次各 1 项）＋ orchestrator 浏览器 DOM/桩断言证明，记录在 `s6a-acceptance.md`；不得把“dist 有 token”写成“条件性已证明”。
- **文案迁移**：`workbench/src/App.vue` 页头、`components/S3Panel.vue` 脚注、`s4/derive.ts` 的 `RUNTIME_X3_NOTE`/`XN_DEMO_LABEL` 改为 §9 canonical banner/×N 注记；`components/S4DetailPanel.vue` 的 L2 提示仅对 L2 节点显示 canonical L2 说明（`:data-*` 动态），非 L2 保留 S5 原文与 `#s5-values-note`。旧绝对口径（`无构建期局部变量/L2（S6）`、`运行时 ×3 属 S6`、`无异步/×3`）在 `src` 与 `dist` 都不得残留。
- `api.ts` 的 `L1Value` 形状已含 `line/invocation`，无需改协议；保留 S5 选择器/徽标/`行号未采集`/空态与 S4 ×N/缺口/S3 面板。
- 禁止：用 `nodeKey` 硬编码判定 L2；只认 `L2` flag。禁止写请求/异步/无调试/折叠/开销宣称。

## 8. 测试计划（tester；一次命令、串行起停、`finally` 清理）

| 组 | 断言要点 |
|---|---|
| **S6A-A** build/artifact | collector 先构建（§10，N1）；agent 构建；jar major 52；shaded ASM 在 `io/traceboard/agent/shaded/org/objectweb/asm/**`、无未 relocate `org/objectweb/asm`；pom 仅 byte-buddy + asm trio 9.7；demo JDK8 构建；`javap -l` 证明 `reconcileAmount` 的 LVT 含 `local:D` 及 `Start/Length`（缺失则 FAIL 并给原因）；运行日志 `l2_probes_installed method=reconcileAmount offsets=<init>,<assign> lines=<init>,<assign>` 恰 2 个探针且 init offset == LVT Start（inclusive；无 `l2_probe_missing`/`l2_no_lvt`）；workbench/S5 资产构建 |
| **S6A-B** demo | reconcile 200 精确 `{"data":[100.0,0.0,100.0]}`；未知 id 200 同形状；`GET /api/orders` amount 仍 `100.00` 且状态未变；`L2DemoService.java` 无 `UPDATE`，且无 `SELECT`/`findById`/`JdbcTemplate`/`@Transactional`/`Mapper`（N7，纯计算无 DB 读写）；案例 A cancel 200 true + SQL 0 行；L1 preview 200 `{"data":0}` 且 5 值不变；除 reconcile 外无新端点；demo 前端静态 `#btn-reconcile` + `POST /api/orders/1/reconcile` + 不调用 `loadOrders`（N6；6-span 链的运行时证据仍只来自 fixture/S6A-D，S6A-C 只证明后端 4-span） |
| **S6A-C** agent L2 | collector+demo+agent（session `s_s6a`，带 traceparent/X-TraceBoard-Click）：controller + 3 service 恰 4 span；3 service 同 nodeKey、parent=controller、`startNs` 升序、return 100/0/100；flags 断言 `includes('L2')`、`includes('S2_ZERO_ROW_CHAIN')`，且**无** `L1`/`LOST_BACKEND`/`VALUES_CAPPED`/`L1_SKIPPED`（N4，不整数组深比较）；values 精确 dispatch §4.2 表（第 2 次 2 项，第 2 项 100→0 且行号=源码 `local = 0` 行重算值；第 1/3 次 1 项且 `from=null`）；`values[0].from=null` 在第 1/3 次**不得**被当作值变化/高亮（B5，事件层不改值、UI 层见 S6A-D）；无 `reconcileBatch`/额外 span；controller 无 values；每行 schema 合法；collector 停后端点仍 200；日志 `l2_probes_installed` 含 2 个 offset/line（若 `l2_no_lvt`/`l2_probe_missing` 则 FAIL）。无头 reconcile（无 traceparent）：允许 controller LOST + 3 L2 LOST 的合法 S2 子链，不得伪造 EXACT；S6a 不要求无头 L2 值（N5） |
| **S6A-D** workbench | ingest fixture：graph 6/5、每节点 15 键、service 组 3、values 与 fixture 一致。**静态 dist token（只此层）**：`s6-l2-badge`、`s6-l2-note`、`data-value-kind`、`data-invocation-diff`、`行号 `、`100 → 0`、`值变化`、canonical banner/L2 注记/×N 注记、`#s5-values`/`#s5-l1-badge`/`#s5-source`/`#s5-values-empty` 与 S3/S4 选择器仍在。**fixture/纯函数层**：`workbench/src/s6/**` 的 `isL2Node`/`localValueRows`/`isValueChange`/`invocationDiffNodes` 对 fixture 3 个 service 节点断言（仅 `b000000000000005` 为真、第 1/3 为假；仅 L2 flag 节点 `isL2Node` 真；第 2 次 local 行 `line=24/from=100/to=0`）。**不做** `[data-value-kind="local"]`/`data-invocation-diff="true"`/`第 2/3 次` 的 dist 字面量断言（动态 Vue 属性/插值，B6）；UI 条件性由 S6A-C 运行时 values + orchestrator 浏览器 DOM/桩断言记录在 `s6a-acceptance.md`，测试报告须如实标注“dist 仅静态 token，条件性由运行时/DOM 证明”。非 L2 节点无 L2 徽标文案；S5 文案保留；无异步/无调试/折叠/开销宣称 |
| **S6A-E** regression/scope | S0–S5 锚点全 PASS（按 §8.1 迁移）；S5-G 以 `{...S5_G1_FREEZE, ...S6A_G1_FREEZE}` 比较、18 项集合保留、label 为“api+event-model at S6a hashes”（B1）；S3-6/S4-F/S5-D/S5-E 用迁移后 token（S5 选择器/Values/source/`100 → 0` 保留，B2）；S2-8/S3-8/S4-I/S5-H 仅对 L2 文件放行且 `L1Values.java` 仍无 `"local"`、异步/无调试/预算/S6b 仍禁止（B3）；案例 A/B、L1 5 值、EXACT、回放 0 写、S2 LOST 4-span 不变；S0–S5 fixture 字节、schema/transport/status 零漂移；`S6A_G1_FREEZE`（含 `plan-review-s6a.md`）零漂移；无 S6b 能力（async/NO_DEBUG/loop fold/perf）；无真实 secret/CDN/镜像；端口 8601/8080/5173/5174/8602/18080 无监听、无 java/node 残留、git index 未动 |

### 8.1 门禁迁移（不放宽其余断言）

#### 8.1.1 冻结与 supersede（B1；tester 精确落地）

- **保留** `S5_G1_FREEZE` 的 **18 项集合**与数量断言（`Object.keys(S5_G1_FREEZE).length === 18`），不删除、不整体放宽。
- **新增** `S6A_G1_FREEZE`（键：`docs/contracts/api.v1.md`、`docs/contracts/event-model.v1.md`、`fixtures/s6-l2-lines/{events.ndjson,expected-facts.json,README.md}`、`docs/plans/stages/S6/{s6a-plan.md,dispatch-s6a.md,plan-review-s6a.md}`；哈希取 G1 实测值，plan-review 实际文件名见 N9）。
- **S5-G 改为**：`const LATEST_G1_FREEZE = { ...S5_G1_FREEZE, ...S6A_G1_FREEZE }`；仍遍历 S5 的 18 个 rel，期望值取 `LATEST_G1_FREEZE[rel] ?? S5 值`；check label 改为“S5 G1 freeze zero drift: … (18 files, api+event-model at S6a hashes, S6a files at S6a hashes)”，`gate()` 标题同步改为“S5 G1 freeze 18/18 at S6a hashes (api/event-model superseded)”；S6A 的 8 项另由 S6A-E 检查。
- **明确口径**：`S5_G1_FREEZE` 对**未改动文件**仍逐字节有效（schema/transport/status/S0–S5 fixture/S4/S5 plan+dispatch 等 16 项零漂移）；api/event-model 两项的 **S5 旧哈希被 `S6A_G1_FREEZE` supersede**（沿用 S4→S5 supersede 模式）。全量运行（S5-G 作为回归锚点）与本计划 S6A-E 都按此 supersede 口径，**不得**再写“S5 冻结 18 项哈希全不变/无 S5 契约漂移”这类与 api/event-model 加性修订冲突的表述。

#### 8.1.2 S5 旧文案 token 迁移（B2；逐常量、逐 token）

- **新增** `S6A_WORKBENCH_TOKENS`（S6A-D 静态层，contains）：`s6-l2-badge`、`s6-l2-note`、`data-value-kind`、`data-invocation-diff`、`行号 `、`100 → 0`、`值变化` 与 canonical banner/L2 注记/×N 注记三段；S6a fixture 的 `staticDistTokens` 与此一致。
- `S3_WORKBENCH_TOKENS`（S3-6）：旧 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）` 替换为 canonical banner（§9）；其余 10 个 S3 token 原样保留。
- `S4_RUNTIME_X3_NOTE` = `×N 为已采集 span 的前端聚合；运行时 ×3 属 S6` **替换**为 canonical ×N 注记（§9）；`S4_DIST_TOKENS` 其余 token（`节点详情`/`×N`/`未采集`/`缺口`/`rowsAffected`/`reason`/`逐次调用`/`SQL/数据影响`/`UI 效果`/`后端未采集/未关联`/`未采集（无 reason）`/缺口空态）全部保留。
- `S5-D` `s5WorkbenchTokens`：旧页头 token `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）` 替换为 canonical banner；其余 **14 项**（5 个选择器 + 9 条文案）原样保留：`s5-values`、`s5-l1-badge`、`s5-values-note`、`s5-values-empty`、`s5-source`、`100 → 0`、`已脱敏`、`已截断`、`（manifest 映射）`、`行号未采集`、`第 1/1 次`、`S5 L1：参数/字段写入/返回摘要；局部变量（L2）与行级属 S6，本阶段未采集`、`未采集（该节点无 values；S5 只采参数/字段写入/返回摘要）`、`JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）`。
- `S5-E` 第 9516 行：demo dist/source 的旧页头 token 替换为 canonical banner；`#btn-discount`/`previewDiscount`/`data-tb-fn="previewDiscount"`/固定 100/s3cr3t/3000-x URL/无 `loadOrders` 断言保留。
- `S5_STALE_TEXTS` **增加 4 条**（workbench/src、workbench/dist、demo frontend/src、demo dist 均不得出现）：`S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`、`运行时 ×3 属 S6`、`无异步/×3`、`无构建期局部变量/L2`。`S5_FORBIDDEN_CLAIMS` 保留 `kind=local`/`L2 已采集`（新 UI 不得包含；扫描树不变，不含 agent）。
- 修正“不变”清单：**S5-B/C 行为不变；S5-D/E 除上述旧文案 token 外断言不变**；`S5 perf` 仍 report-only；`S4-F` 的 15 字段不变，仅其 dist 旧 ×3 token 迁移；S3/S4 选择器与 Values/source/`100 → 0` 断言保留。

#### 8.1.3 L2 标记白名单（B3；允许 L2，仍禁 async/无调试/预算/S6b）

| 门禁 | 放行（仅这些） | 保持禁止/不变 |
|---|---|---|
| `S2-8` `agentForbidden` | `L2ClassFileTransformer.java`、`L2Values.java`、`SpanContext.java` 可含 `LocalVariableTable`/`visitLocalVariable`/`localVariables`/`"local"` | 其余 agent 文件（尤其 `L1Values.java` 不得有 `"local"`）；`getMessage()` 仍禁止（L2 日志只写 `Throwable.toString()`/类名）；`agentTargets` **保持 5**（Byte Buddy 类型）、`typeMatchers=5`、`.transform` 7→**8**、`adviceClasses` 加 `ReconcileControllerAdvice.class`（8）；`expectedShopClasses` 加 `com.example.shop.service.L2DemoService`（4→5）；`.ignore(L2DemoService)` **不算** target（N8） |
| `S3-8` `l2Hits` | 上述 3 个 agent 文件 + `workbench/src/s6/**` | 其他 SDK/agent/collector/workbench 文件仍禁止 L2/local 标记；label 改为“L2 allowed only in the S6a L2 files” |
| `S4-I` / `S5-H` `forbiddenMarkers` | 同一组 3 个 agent 文件 + `workbench/src/s6/**` | L2 以外的 marker（async-continuation/runtime-x3/SSE/WS/persistence/pixel/map-decoding/WAR/cloud/react）全部保留；label 改为“L2 allowed only in the S6a L2 files; no async/NO_DEBUG/loop-fold/perf”；`S5-H` 的 `agentL1` 检查保持 `L1Values.java` 不含 `"local"` |
| `S3-10` 白名单 | `allowedPrefixes` 加 `fixtures/s6-l2-lines/`、`docs/plans/stages/S6/`；`S5_DEMO_BACKEND_ALLOWED` 加 `demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/L2DemoService.java` | `agent/`/`workbench/` 前缀已覆盖新文件；`demo frontend/src/App.vue` 已在 `S3_DEMO_EXPECTED_FILES`；若 checkpoint 改 `docs/plans/STAGE-PROGRESS.md` 后复跑 S3-10，`allowedExact` 另加该文件（N13），否则先复跑门禁再写 docs |

- 所有白名单只放行 **L2 术语/文件**，不删除任何反向断言；S6b（异步/`NOT_COLLECTED_NO_DEBUG_INFO`/行级字段/深采/多方法/预算/折叠/开销）仍全域禁止。

#### 8.1.4 B7–B9 精确迁移（复评补充）

| 项 | 门禁 | 精确修改 |
|---|---|---|
| B7 | `S2-L`、`S3-2`、`S4-H` | 这些门禁中凡对 `docs/contracts/api.v1.md` / `event-model.v1.md` 使用 `S5_G1_FREEZE` 的哈希比较，统一改用 `LATEST_G1_FREEZE = {...S5_G1_FREEZE, ...S6A_G1_FREEZE}`；schema/transport/status/S0–S5 fixture 仍用 S5 值；label 注明 “api/event-model at S6a hashes”。 |
| B8 | `S3-1` `demoTokens` | **替换**旧 S5 banner token 为 canonical S6a banner（§9 逐字：`S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b`），**不再要求**旧 S5 banner；保留所有非 banner 的 S5 token（`#btn-discount`/`previewDiscount`/`s3cr3t`/3000-x 等），并追加 `#btn-reconcile`、`reconcileBatch`、`reconcileAmount`、`S6a`/`L2`。 |
| B9 | `S4-I`、`S5-H` git 白名单 | `allowedPrefixes`/`allowedExact` 增加 `docs/plans/stages/S6/`、`fixtures/s6-l2-lines/`、`agent/src/main/java/io/traceboard/agent/L2ClassFileTransformer.java`、`L2Values.java`、`demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/L2DemoService.java`、`workbench/src/s6/**`；其余 S6b 禁止项不变。 |

#### 8.1.5 其余

- `GRAPH_NODE_KEYS` 不变（15）；S0–S5 fixture/schema/transport/status 字节不变；S6a fixture 只新增目录，**不并入** S5 fixture 基线（S5-G 的 fixture walk 只遍历既有 freeze 条目，天然不包含 `fixtures/s6-l2-lines/`；S6a 三件由 `S6A_G1_FREEZE` 单独逐字节比较，无需改 S5-G 的 walk）。
- 不变：S2-3 4-span LOST、S3-3 EXACT、S3-4/5 回放 0 写、S4-F 15 字段、S5 perf report-only。

## 9. 契约与 fixture（本轮已落盘）

- `api.v1.md`：S6a 变更记录；§2.6 S6a 矩阵；§8.2 `values`/`local` 加性说明；§10.10 L2 只读规则与工作台 canonical 文案；**附录 F** reconcile 端点（`200 {"data":[100.0,0.0,100.0]}` 任意 id、`#btn-reconcile`）；历史 §2–§10/附录 A–E 不改写。
- `event-model.v1.md`：§4.4.7 `kind=local` 精确语义（1-based line、from→to、帧内 previous 去重、逐次 invocation、无 param/field/return、无 LVT 不猜）；§7 `L2` flag 从预留改为 S6a 使用；§9 S6a 边界；§11 fixture 指针；§12 不变。
- `fixtures/s6-l2-lines/`：`events.ndjson`（6 行、session `s_s6l2a`、固定 trace/spanIds、1/2/1 项 values、第 2 次 100→0、`L2`）、`expected-facts.json`（13 facts + requests/graph/工作台期望 + `diffRule`/`perSpan.diff=false/true/false` 反向断言 + `staticDistTokens` 与 `pureFunctionExpectations` 分层 + `flagsRuntimeAssertion` 含 `S3_RUNTIME_SDK` 建议性 flag 说明）、`README.md`（首段逐字“本目录是 S6a 测试数据，不是运行时证据；运行时 L2 由 demo+agent 产生；fixture 行号不承诺与实际编译行号一致。不含真实 secret。”；另注明 LVT inclusive start/首次观测不算变化/动态属性不做 dist 断言）。
- schema/transport/status/S0–S5 fixture：**字节不变**；Ajv 2020-12 strict 离线通过（`lines 6 schema ok 6`，无网络/新依赖）。

**canonical 文案（逐字）**

- banner：`S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b`
- L2 说明：`S6a L2：行级局部变量来自 LVT 探针（样例第 2 次调用 local 100 → 0）；异步/无调试信息/循环折叠/开销属 S6b`
- ×N 注记：`×N 为已采集 span 的前端聚合；运行时 ×3 已在 L2DemoService#reconcileAmount 演示；其他方法无运行时 ×3`

## 10. 精确命令（仓库根、全双引号）

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
export JAVA21="C:/Program Files/Java/jdk-21"
export JAVA8="C:/Program Files/Java/jdk1.8.0_221"

# 构建（collector 先于启动；agent 含 ASM shade；demo JDK8；workbench）
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/collector" -am
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "agent" -am
JAVA_HOME="$JAVA8"  mvn -B -q -DskipTests package -f "demo/buggy-shop-boot-vue/backend/pom.xml"
(cd "workbench" && npm ci && npm run build)

# S6A-A：jar/LVT
"$JAVA8/bin/javap" -l -p -classpath "demo/buggy-shop-boot-vue/backend/target/classes" com.example.shop.service.L2DemoService
"$JAVA8/bin/jar" tf "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" | grep -E "shaded/org/objectweb/asm|org/objectweb/asm"

# collector 8601 + demo/agent（session s_s6a）
"$JAVA21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
"$JAVA8/bin/java" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s6a \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &

# S6A-B：200 {"data":[100.0,0.0,100.0]}（未知 id 同形状）；案例 A/L1 不变
curl -s -X POST "http://localhost:8080/api/orders/1/reconcile"
curl -s -X POST "http://localhost:8080/api/orders/999/reconcile"
curl -s "http://localhost:8080/api/orders"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"

# S6A-C：带 traceparent/X-TraceBoard-Click（脚本可用固定值；4 span = controller + 3 service）
curl -s -X POST "http://localhost:8080/api/orders/1/reconcile" \
  -H "traceparent: 00-6b7c8d9e0f1a2b3c4d5e6f708192a3b4-b000000000000002-01" \
  -H "X-TraceBoard-Click: click_6a5b4c3d2e1f0a9b"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s6a/events?afterSeq=0&limit=50"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s6a/requests"

# fixture 独立校验（离线，Ajv 2020 strict）
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const ajv=new Ajv({strict:true,allErrors:true});
const v=ajv.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));
const ls=fs.readFileSync('fixtures/s6-l2-lines/events.ndjson','utf8').trim().split('\n');
let n=0;ls.forEach((l,i)=>{if(v(JSON.parse(l)))n++;else{console.error(i+1,JSON.stringify(v.errors));process.exitCode=1;}});
JSON.parse(fs.readFileSync('fixtures/s6-l2-lines/expected-facts.json','utf8'));
console.log('lines',ls.length,'schema ok',n);
EOF

# 门禁
(cd "tools/verify" && npm ci && node verify.mjs)
```

环境：JDK8 `C:/Program Files/Java/jdk1.8.0_221`、JDK21 `C:/Program Files/Java/jdk-21`、Node **22.x**/npm **10.x**（本机实测 v22.22.2 / 10.9.7；见 N12）、Maven 3.9.5；ASM 9.7 实测 class major **49**；端口 8601（仅 127.0.0.1）/8080/5173/5174/8602/18080；分支 `master`、无 remote；仅 checkpoint 写 git。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| ASM/Byte Buddy 转换器组合冲突、类加载失败 | 专用 transformer 只匹配精确 `L2DemoService`；Byte Buddy 显式 ignore；所有异常返回 null 原字节并计数；jar rel/relocate 断言；同一次运行回归案例 A/L1 |
| `COMPUTE_FRAMES`/`VerifyError` 导致类加载失败 | 两遍式只对目标方法插桩；异常回退原始字节；S6A-C 启动即验证（失败即停，不带病通过）；不确定即停止条件 |
| 无 LVT 或变量名不同（裁剪/无 `-g`） | 只在 LVT 存在且 `local:D` 命中时插探针；缺失跳过并计 `l2_no_lvt`，不猜名/不造假；S6A-A 用 `javap -l` 证明环境有 LVT |
| 行号漂移/探针插错位置 | 探针只在 LVT 活性范围（**含 start**）与行边界、且上一指令非跳转/return/switch 时插入；初始化探针偏移=LVT start；测试从源码/字节码重算行号；fixture 行号声明为测试数据 |
| 探针过密导致逐行刷值 | 帧内按 `(frame,name)` previous 去重，仅首次/值变化追加；S6A-C 断言 1/2/1 项与精确 values |
| 嵌套/递归/多请求交错导致父帧或序号错误 | ThreadLocal 栈；只接受顶层 controller 父帧；序号挂在**父 controller 帧**、按请求重置；无父帧跳过并计 `l2_no_parent`；exit 只弹 `l2` 帧防误弹 |
| THREW/双重 exit 破坏栈 | catch-all 后 `exitL2Threw`；`exitL2` 先 peek 校验 `l2` 再 poll；弹空计 orphan、不 emit |
| 值/状态造假或回归 S5 | 只发真实 LVT 探针值；THREW 不编造 return；无 `L1` flag；S5-B/C/D/E 与案例 A/B 全量回归（D/E 仅旧文案 token 迁移）；冻结按 §8.1.1 supersede 口径 |
| 工作台夸大能力 | L2 徽标/说明只跟 `L2` flag；非 L2 节点保留 S5 原文；canonical 文案限定“仅 reconcileAmount”；tester 反向断言无异步/无调试/折叠/开销宣称 |
| 性能/预算被提前承诺 | S6a 不设 L2 开销门槛；40%/预算/折叠属 S6b；不删慢样本、不伪造数字 |

## 12. 停止条件

1. 必须改 schema/事件类型/status 枚举/transport，或引入 S6b（异步、无调试事件、预算/折叠、行级字段写入/多方法）才能达标。
2. 必须让 L2 覆盖超过一个方法、改案例 A/B/L1 行为/DB，或放宽 S0–S5 门禁。
3. ASM 注入无法 fail-open（类加载/`VerifyError` 风险不可控），或必须关闭 Byte Buddy 既有 7 个 advice。
4. 必须引入真实 secret/PII/CDN/镜像/外部网络，或改他人路径。
5. G1 FAIL 且一轮返工仍 FAIL；测试未绿但 owner 想“先提交”。
6. S6a 只证明“单方法行级局部变量 + 逐次 ×3”；不得宣称异步/无调试/预算/开销已做，**不得打 `s6`/`s6a` tag、不得开始 S6b**。

## 13. 偏离记录

| # | 摘要说法 | 实际执行 | 依据 |
|---|---|---|---|
| D1 | dispatch §5.1 “附录 E reconcile” | 新增 **附录 F**（E 已被 S5 前端浅层占用，历史不改写）；内容与 dispatch §3 一致 | 保留历史；G1 复核只认内容 |
| D2 | fixture flags `S2_ZERO_ROW_CHAIN,L2,DROP_COUNT=<n>` | fixture 不写 `DROP_COUNT`（测试数据非运行时字节）；`flagsAreContainsOnly:true`，运行时断言包含/禁项 | 沿用 S0–S5 fixture 约定 |
| D3 | 去重“按 (frame,line,name)”字面 | previous 按 `(frame,name)`；仅首次/值变化追加；`line` 为观察到的探针行 | javac8 下坏行探针与 `if` 跳转目标同偏移，非 2 路径也会执行；按行键会给第 1/3 次追加一项，dispatch §4.2 的 1/2/1 不成立 |
| D4 | “no param/field/return values on L2 spans (or decide)” | 决定：L2 span 只有 `kind=local`；返回值在事件 `return`，入参不采，S6a 无行级字段写入 | dispatch §4.2 + S6b 边界 |
| D5 | 探针“每条执行行” | 只在“上一真实指令非跳转/return/switch”的行边界插；初始化探针偏移=LVT start（inclusive）；demo 恰落初始化行与 `local=0` 行；去重兜底 | dispatch §4.3 + 不产生不可达代码 |
| D6 | `source` 行号可当 values 行号 | `source` 来自 JVM 栈、`values[].line` 来自 LVT/行表，两者不混用 | dispatch §4.4 |
| D7 | 逐次 invocation “全局/方法计数” | 计数挂在**父 controller 帧**、按请求重置；无 controller 父帧发送跳过 | dispatch §3 invocation 行 |

### 13.1 派发单勘误（N11；由 dispatcher 记录，plan-writer 不改 `dispatch-s6a.md`）

1. dispatch §3/§4.4 的 `previous` 键写 `(frame,line,name)`，与 event-model §4.4.7/本计划 D3 的 `(frame,name)` 冲突；以 `(frame,name)` 为准（D3 必要：坏行探针与 `if` 跳转目标同偏移，非 2 路径也会执行；按行键 1/2/1 不成立）。
2. dispatch §3/§5.1/§6 写“附录 E reconcile”，实际为 **附录 F**（E 已被 S5 占用，历史不改写；D1）。
3. dispatch §5.2/§6 的评审文件名 `plan-review.md`，实际为 `plan-review-s6a.md`（N9）。

### 13.2 评审项对应

- B1→§8.1.1；B2→§8.1.2；B3→§8.1.3；B4→§5.4/§11/契约 §10.10 与 §4.4.7；B5→§7/契约 §10.10/fixture `diffRule`；B6→§7 测试分层/§8 S6A-D/fixture 分层。
- N1→§10 构建；N2→§9 与 fixture README；N3→§5.4/§10.10/§4.4.7 措辞；N4/N5/N6/N7→§8 S6A-C/S6A-B；N8→§8.1.3；N9→§3/§8.1.1；N10→api 末尾换行；N12→§10 环境；N13→§8.1.3。

## 14. S6a 完成后的状态（显式）

- **S6a 是 partial**：只证明单方法行级局部变量 + 逐次 ×3；S6 仍 🟡，**不打 `s6`/`s6a` tag、不做 archive 备份、不开始 S6b**。
- 下一检查点 **S6b**：异步续体/线程池、`NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI、无 LVT 降级事件、行级字段写入、对象深采、多方法选择、循环折叠/采样/丢弃预算、L2 开销（40%）与最终 S6 验收。

## 15. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-23 | 首版：demo `L2DemoService`/`reconcile`、ASM 9.7 LVT 探针/`recordLocal`/`exitL2`、values local/line/invocation、×3、graph 15 字段不变、workbench L2 展示、S6a fixture、S6A-A..E 与迁移、S6b 边界与停止条件。 |
| v3 | 2026-11-23 | **G1 复评补充 B7–B9**：S2-L/S3-2/S4-H 使用 LATEST_G1_FREEZE；S3-1 demoTokens 追加 S6 token；S4-I/S5-H 白名单加 S6 路径/fixture/L2DemoService/workbench s6。 |

| v2 | 2026-11-23 | **G1 第 1 轮返工（B1–B6 + N1–N13）**：B1 `S6A_G1_FREEZE` supersede api/event-model（S5 18 项集合保留）；B2 逐 token 迁移 S3-6/S4-F/S5-D/S5-E 与 4 条 stale、修正“S5-D/E 不变”；B3 L2 标记白名单表（S2-8/S3-8/S4-I/S5-H/S3-10，`expectedShopClasses` 5/`agentTargets` 5/`.transform` 8）；B4 LVT inclusive start/2 探针自检/行边界；B5 `from=null` 非变化；B6 S6A-D 静态 dist + 纯函数/DOM 分层；N1 collector 构建、N2 flags 注、N3 措辞、N4–N8 测试细化、N9 实际评审文件名、N10 换行、N11 派发勘误、N12 环境、N13 STAGE-PROGRESS 白名单。 |