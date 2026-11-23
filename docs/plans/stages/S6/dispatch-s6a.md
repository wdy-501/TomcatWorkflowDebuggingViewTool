# S6a L2 行级局部变量与逐次 ×3 · 任务分发书（dispatch-s6a）

> 阶段：S6a（S6 子检查点；**S6 仍 🟡**，S6b 完成后才做 S6 验收/tag）｜角色：task-dispatch｜日期：2026-11-23｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S6 行与 §4；主计划 §2.2/§2.3（119–156）、§8.5（636–651）、§9.1–9.4（664–704）、§13.4（995–1035）、§16 T6/T7/T10（1235–1240）；上游 S5 `progress.md`/`acceptance.md`/`s5-plan.md` 与基线 `s5-baseline`（`7b09c7b`）。
> 本文件是 S6a 下游子代理的唯一任务输入；除 dispatcher 外不得修改。**S6a 只做“选中方法行级局部变量 + 逐次 ×3”；异步/无调试信息/预算/循环折叠/开销属 S6b。**

## 0. 通用规则（所有人）

1. 一人一卡：只读「输入」、只写「输出」；路径含中文/空格，命令与路径全部双引号，从仓库根执行；G1 后契约、fixture、s6a-plan、本文件冻结。
2. **只有 S6a checkpoint 角色可写 git**（add/commit；**不打 `s6`/`s6a` tag**）；其他人禁止 git 写操作、push/force/rebase/改 config。
3. 越界、契约缺口、门禁不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改”，不许改他人路径。
4. 无真实 secret/客户数据；demo 数值/ID 全为演示值；不换第三方镜像、不下载仅 GitHub 提供的资源、无 CDN/在线字体/遥测/外部网络。
5. 未做/未验证必须标 `S6a 未做 / S6b 待做`；**禁止用 fixture 冒充运行时证据**；禁止伪造行号/值/×3。
6. schema、`transport.v1.md`、`status-semantics.md`、S0–S5 fixture 字节与案例 A/B/L1 行为不动；S5 能力不回归。

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 检查点 | S6a：选中方法行级局部变量 + 逐次 ×3（S6 的一部分） |
| 完成信号 | 行级 `local` 100→0 在**第 2 次调用**可见；同 nodeKey ×3 能指哪次坏 |

S6a 收尾必须同时成立（缺一即 FAIL；S6 仍为 partial）：

1. **Demo**：`POST /api/orders/1/reconcile` → `200 {"data":[100.0,0.0,100.0]}`；未知 id 同样 200 同形状；**无 DB 读写**；案例 A cancel 与 L1 preview-discount 不变。
2. **Agent L2**：一次请求内恰 3 个 `com.example.shop.service.L2DemoService#reconcileAmount` service span（同 controller 下 ×3），第 2 个 span 的 `values` 含 `local` 100→0 与行号；3 个 span 均带 `L2` flag。
3. **不猜**：方法/类/LVT 缺失时 fail-open、无事件、无假值，日志计数（完整无调试信息语义属 S6b）。
4. **契约/fixture**：api/event-model 只做加性说明（graph 仍 15 字段、无 schema 变更）；`fixtures/s6-l2-lines/` 3 件、schema 合法、仅测试数据。
5. **工作台**：L2 徽标、local 行号与 old→new、×3 第 2 次高亮；非插桩方法不宣称 L2；S5 保留。
6. **门禁**：一次 `tools/verify` 覆盖 S6A-A..E + S0–S5 回归（迁移显式列出），exit 0；S6a G1 冻结零漂移。

## 2. S6a / S6b 边界（越界即失败）

- **S6a 内**：仅 `L2DemoService#reconcileAmount` 一个方法的行级局部变量（LVT 探针）、每帧 previous 去重、逐次 invocation；仅 `OrderController#reconcile` 一个 controller span；仅一个 demo 端点与一个前端按钮；graph 原样 `values`；工作台 L2 展示；S6a fixture。
- **S6b 内（S6a 出现即 FAIL）**：异步续体/线程池/CompletableFuture/@Async 上下文；`NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason/UI；无 LVT 的降级事件；行级字段写入（`kind=field` + 行号）、对象深采、多方法选择；循环折叠/采样/丢弃预算、L2 开销脚本与 40% 目标；最终 S6 验收/tag/备份。
- 仍无：SSE/WS/实时、持久化/DB/CORS/鉴权、Tomcat/WAR/React/云端、sourcemap 解码、预览注入变化。

## 3. 强制技术决策（不得协商）

| 项 | 决策 |
|---|---|
| demo 类 | 新建 `com.example.shop.service.L2DemoService`（**独立于 OrderService**，避免 Byte Buddy/ASM 双转换器冲突）。 |
| reconcileAmount | `double reconcileAmount(long id, double amount, int invocation)`：先 `local = amount`；`invocation == 2` 时 `local = 0`；返回 `local`。id 不使用、无日志、无 DB。 |
| reconcileBatch | `List<Double> reconcileBatch(long id)`：循环 i=1..3 调 `reconcileAmount(id, 100, i)` 收集结果；返回 `[100.0, 0.0, 100.0]`。 |
| 端点 | `POST /api/orders/{id}/reconcile`：`id=1` → 200 `{"data":[100.0,0.0,100.0]}`；**未知 id 同样 200 同形状**（纯计算，id 不查库）；不返回 404/-1/null；不新增其他端点。 |
| controller | `OrderController#reconcile(long)` 返回 `ResponseEntity<Map<String,Object>>`（200）；nodeKey `com.example.shop.controller.OrderController#reconcile`；agent 新增一个 controller advice（Byte Buddy）开帧/发 span。 |
| demo 前端 | 新增 `#btn-reconcile` 与普通 click 处理函数（**不用 wrapFn**）：`POST /api/orders/1/reconcile`，展示响应；不调用 loadOrders；案例 A/B/L1 的 DOM/函数/请求不变；页头加 S6a canonical 一句。 |
| ASM 依赖 | agent pom 增加 `org.ow2.asm:asm`、`asm-tree`、`asm-commons` **9.7**（本机 `~/.m2` 已有，Java 8 兼容），shade 并 relocate 到 `io.traceboard.agent.shaded.org.objectweb.asm`；jar 仍 major 52；除 Byte Buddy 外仅这三个依赖。 |
| transformer | 专用 `ClassFileTransformer` 经 `Instrumentation.addTransformer(..., false)` 注册，只匹配精确类名 `L2DemoService`；Byte Buddy 规则**显式 ignore** 该类；两者互不接管。 |
| 注入 | 方法 enter 捕获 `long enterNs`（新局部槽）并打开 L2 帧（`enterL2` 为 enter 注入的必要补充）；每个 LVT 行插探针；每个 return 前调 `exitL2(enterNs, returned)`；方法体包 catch-all 调 `exitL2Threw(enterNs)` 后原样 `athrow`（支持 `THREW`）。 |
| 探针 | 只在该方法 LVT 中变量名 `local`、描述符 `D` 的**活性范围**内、每条已执行源行的指令序列之后插入；同一位置只插一次；`recordLocal(int line, String name, double value)` 装箱传值。 |
| 值语义 | `recordLocal` 按 (frame,line,name) 保存 previous；**首次或值变化才追加** `values` 项：`kind=local`、`line`、`from`=previous 或 null、`to`=当前、`truncated/redacted=false`、`invocation`=本帧序号；同值重复探针不追加。 |
| invocation | 进入 L2 帧时，基于**父 controller 帧**内同 nodeKey 的调用计数分配 1..3（每请求重置，非全局）；无 controller 父帧则跳过并计数 `l2_no_parent`。 |
| exit/status | `exitL2` 弹帧并以 enterNs 起始发 span：`kind=service`、nodeKey L2、`status=OK`、`return={"type":"double","value":100|0}`；catch-all 发 `THREW` 且不编造 return；`source` 沿用 JVM 栈（`L2DemoService.java:<line>`）。 |
| flags | `S2_ZERO_ROW_CHAIN`（沿用 emitter 基线）+ `L2` + `DROP_COUNT=<n>`；**无 L1**；子 span 无 `LOST_BACKEND`；EXACT 继承 controller。 |
| 失败/日志 | transformer/注入/探针/emit 全部 `try/catch(Throwable)`；任何异常返回 null（原始字节）并计数 `l2_transform_error`；类/方法/LVT 缺失返回原始字节并计 `l2_no_method`/`l2_no_lvt`，并记录静态 `l2Reason=NO_LVT` 供 S6b（**不发事件**）；**不产生假 span/假值**。安装成功须留日志 `l2_probes_installed method=reconcileAmount line=<init>,<assign>`。 |
| 契约 | api.v1 加性：S6a 矩阵、graph `values` 含 local/line/invocation（15 字段与顺序不变）、附录 E reconcile；event-model 加性：`kind=local`/`line`/`invocation` 语义与 S6a 精确值；**schema/transport/status 字节不变**。 |
| fixture | `fixtures/s6-l2-lines/{events.ndjson,expected-facts.json,README.md}`：1 条 click→fetch→controller→3×service 链、3 个同 nodeKey span、值恰为 §4.2；README 首段逐字见 §4.6。 |
| 工作台 | 仅 flag 含 `L2` 显示 L2 徽标/说明；local 行显示 `行号 N` 与 `100 → 0`；×3 组中唯一“值变化”的第 2 次调用高亮；非 L2 节点不宣称 L2；S5 选择器/文案保留。 |
| 测试 | S6A-A..E 一次命令；运行时证据与 fixture 分离；行号由源码/`javap -l` 重算，不硬编码。 |

## 4. 共享契约

### 4.1 运行时链路（S6a 精确形状）

浏览器 trace：`click #btn-reconcile`（SDK）→ `fetch POST /api/orders/1/reconcile`（SDK）→ `controller OrderController#reconcile`（agent，EXACT join）→ `service L2DemoService#reconcileAmount ×3`（ASM，parent=controller span）。

- 浏览器一次点击的 trace 恰 6 个 span；脚本化 agent 测试（无 SDK）为 controller + 3 service 恰 4 个 span。
- 3 个 service span 的 `nodeKey` 相同、`parentSpanId` 均等于 controller spanId、`startNs` 严格递增；controller 无 `values`。
- `reconcileBatch` **不插桩**、不产生 span；3 个 service span 的 return 依次 100、0、100，`status` 均 `OK`（THREW 路径保留能力，S6a 不作 demo 断言）。

### 4.2 `values`（L2 唯一载荷）

每项字段固定顺序：`name,kind,line,from,to,truncated,redacted,invocation`。S6a 只允许 `kind=local`；**不出现** `param`/`field`/`return` 值项；`line` 为 1-based 正整数；数字按整数无小数点格式（100、0）。

| 第 i 次（按 startNs） | 值项（按探针执行顺序） | 断言 |
|---|---|---|
| 1 | `local`，line=初始化行，from=null，to=100，invocation=1 | 恰 1 项 |
| 2 | ① 初始化行 null→100；② `local = 0` 行 100→0，invocation=2 | 恰 2 项；②是关键事实 |
| 3 | `local`，line=初始化行，from=null，to=100，invocation=3 | 恰 1 项 |

- 第 2 次的两项行号不同；测试从 `L2DemoService.java` 源码重算两行（初始化行、赋 0 行）并与事件比对，不硬编码。
- `values` 项数远低于既有 ≤30 预算；不触发 `VALUES_CAPPED`/`L1_SKIPPED`；S6a 不做循环折叠/采样。
- 同一帧内同 (line,name) 值不变时不追加；previous 只在帧内有效，所以每次调用首项 `from=null`。

### 4.3 探针位置语义

1. 从 `L2DemoService` 方法字节码的 `LocalVariableTable` 找 `local:D`（缺失即跳过，见 §3 失败）。
2. 对行表覆盖的每条源行，在该行指令序列结束处（下一行起点/return 前）插入探针；只在该变量 LVT 活性范围内插入；同一偏移只插一次。
3. enter 的 `enterNs` 与 exit 的 `startNs` 必须同一读数（沿用 `SpanEmitter.epochNanosFrom` 约定），`durNs` 用单调差且 ≥0。
4. 探针/enter/exit 均为 public static；注入代码不得引用 demo 之外的新编译依赖；帧计算失败必须回退原始字节。

### 4.4 span/flags/source/UI canonical

- `kind=service`、`nodeKey=com.example.shop.service.L2DemoService#reconcileAmount`、`flags=["S2_ZERO_ROW_CHAIN","L2","DROP_COUNT=<n>"]`（service 子 span 不加 `S3_EXACT_LINK`）。
- `return`：OK 时 `{"type":"double","value":100|0}`；THREW 时为 null。
- `confidence`：有 controller EXACT 继承 `EXACT`；无 controller 父帧不 emit（不伪造 LOST 子 span）。
- `source`：真实栈帧 `L2DemoService.java:<line>`；`values` 的 `line` 来自 LVT，两者不混用。
- canonical 文案（工作台/页头逐字）：banner `S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b`；L2 说明 `S6a L2：行级局部变量来自 LVT 探针（样例第 2 次调用 local 100 → 0）；异步/无调试信息/循环折叠/开销属 S6b`；×N 注记 `×N 为已采集 span 的前端聚合；运行时 ×3 已在 L2DemoService#reconcileAmount 演示；其他方法无运行时 ×3`。

### 4.5 collector / API / graph

- graph 仍 **15 字段**（顺序不变，末尾 `values` 原样数组）；`events/seq/requests/replay` 零改动；无新路由、无 schema/transport 变更。
- `values` 中的 `local`/`line`/`invocation` 自 v1 schema 起即合法，collector 不重算/不排序/不补默认值。
- `requests` 的 `backendSpanCount` 对 reconcile 链为 4（controller + 3 service）；S5 链不变。

### 4.6 `fixtures/s6-l2-lines/`（测试数据，非运行时证据）

- `events.ndjson`：6 行 compact JSON，session `s_s6l2a`、固定 traceId/spanIds；click `#btn-reconcile`→fetch→controller→3×service；仅 service 有 `values`；第 2 个 service 值如 §4.2；fixture 行号是**测试数据**（以同一文件内为准）。
- `expected-facts.json`：1 条请求（EXACT、6 span、fetchCount=1、backendSpanCount=4）、graph 6 节点/5 边、每节点 15 键、service 组 ×3、3 个 service 的 values 精确、工作台选择器/文案/`第 2/3 次`/`100 → 0` 期望；不得含 `s_s3demo` 真实会话数据。
- `README.md` 首段逐字：`本目录是 S6a 测试数据，不是运行时证据；运行时 L2 由 demo+agent 产生；fixture 行号不承诺与实际编译行号一致。不含真实 secret。`
- 须过 Ajv 2020-12 strict；S0–S5 fixture 字节不变。

## 5. 任务卡（独立输入/输出）

### 5.1 plan-writer（契约/fixture/计划；不写代码）

- 输入：本文件 §1–§4、S0–S5 冻结契约/schema、主计划 §9/§13.4/§16 T6/T7/T10。
- 输出（只写）：`docs/contracts/api.v1.md`（S6a 变更记录/矩阵、§8.2/§10.9 `local`/`line`/`invocation` 只读语义、附录 E reconcile 端点与 200 形状、工作台 L2 文案）、`docs/contracts/event-model.v1.md`（§4.4 增补 local/line/invocation 与 S6a 精确值、flags `L2`、明确异步/无调试/循环折叠/开销属 S6b）、`fixtures/s6-l2-lines/**`、`docs/plans/stages/S6/s6a-plan.md`（设计/验收/迁移/命令）。
- 完成判据：§4 全部落入契约/fixture/plan；fixture schema 合法、6 行自洽；api/event-model 保留 S5 历史并只加性；schema/transport/status/S0–S5 fixture 字节不变；s6a-plan 写清 S6b 边界与测试迁移。
- 禁止：写代码/pom/TS/Vue、改 schema/transport/status、改 S0–S5 fixture 字节、git、真实 secret/外网 `$ref`、宣称异步/无调试/预算已做。

### 5.2 plan-reviewer（只读，G1 门）

- 输入：本文件、plan-writer 全部输出、S0–S5 契约/schema、当前 agent/demo/workbench。
- 输出（只写）：`docs/plans/stages/S6/plan-review.md`——逐项 PASS/FAIL、阻断/建议、SHA256 冻结清单（schema、api、transport、event-model、status、S6a fixture 3 件、s6a-plan、dispatch）、`G1: PASS|FAIL`。
- 核查：①`local`/line/invocation/×3 语义与 §3/§4 一致；②graph 15 字段与“无 schema 变更”成立；③fixture 仅测试数据、schema 合法、无真实 secret；④工作台 L2 只对 flag 节点、非 L2 不宣称、S5 保留；⑤无 S6b 实现/宣称；⑥冻结文件与 S0–S5 字节零漂移；⑦ASM 方案 fail-open、与 Byte Buddy 组合隔离。
- 禁止：替作者改文件、写代码、引入 S6b、git。

### 5.3 coder-agent（`demo/.../backend/**` + `demo/.../frontend/src/App.vue` + `agent/**`）

- 输入：本文件 §3/§4、G1 契约/plan、现有 demo/agent。
- 输出（只写）：新增 `demo/.../service/L2DemoService.java`；`controller/OrderController.java` 加 reconcile；`frontend/src/App.vue` 加 `#btn-reconcile` 段与 S6a 页头一句（不改既有函数/请求/案例 A/B/L1）；`agent/pom.xml`（ASM 9.7 shade/relocate）；`agent/src/main/java/io/traceboard/agent/**`（`L2ClassFileTransformer`、`ReconcileControllerAdvice`、`SpanContext` L2 enter/record/exit、计数/日志）。
- 完成判据：§3 全部；一次请求恰 3 个 L2 service span（parent=controller、×3、第 2 次 100→0）；案例 A 4-span/0 行、L1 5 项、preview/cancel 行为零变化；agent jar major 52、ASM 已 shade、无未 relocate asm、fail-open（collector 停仍 200）；无 LVT 时跳过并计数。
- 禁止：改 workbench/collector/契约/fixture/schema/SDK/build-plugin、DB 读写、真实 secret、新端点（除 reconcile）、git、S6b（异步/无调试事件/预算/折叠/开销）。

### 5.4 coder-workbench（`workbench/src/**`）

- 输入：本文件 §3/§4、G1 契约/fixture、workbench 现状。
- 输出（只写）：`workbench/src/{api.ts,s4/derive.ts,s5/values.ts,components/S4DetailPanel.vue,App.vue,components/S3Panel.vue}`（可新增 `workbench/src/s6/**`）。
- 完成判据：`#s6-l2-badge` 仅 flag `L2`；L2 节点 `#s5-values` 内 local 行显示 `行号 N`、`from → to`（`100 → 0` 高亮）、`第 2/3 次`；×3 组列表对“值变化”的调用加 `data-invocation-diff="true"` + 可见 `值变化`（fixture 仅第 2 次）；L2 节点显示 §4.4 canonical L2 说明，非 L2 节点保留 S5 原文；S4 ×N/缺口/S3/S0–S2 面板与 S5 选择器不删；页头/页脚旧“无 L2/局部变量”绝对口径改为 §4.4 banner；`npm ci && npm run build` 绿。
- 禁止：改 collector/SDK/demo/agent/契约/fixture/schema、发写请求、宣称异步/无调试/预算/循环折叠/开销、用 nodeKey 硬编码判定 L2、git。

### 5.5 tester（`tools/verify/**` + `S6/test-report-s6a.md`）

- 输入：全部 S6a 产物、G1 冻结、S0–S5 门禁。
- 输出（只写）：`tools/verify/verify.mjs`、`docs/plans/stages/S6/test-report-s6a.md`。
- 门禁（一次命令、非 0 即 FAIL；串行起停、`finally` 清理进程/端口/临时文件）：

| 组 | 断言 |
|---|---|
| **S6A-A** build/artifact | agent 构建；jar major 52；shaded ASM 在 `io/traceboard/agent/shaded/org/objectweb/asm/**`、无未 relocate `org/objectweb/asm`；pom 仅 byte-buddy + asm trio 9.7；demo JDK8 构建；`javap -l` 证明 `reconcileAmount` 的 LVT 含 `local:D`（缺失则 FAIL 并给原因）；workbench/S5 资产构建。 |
| **S6A-B** demo | reconcile 200 精确 `{"data":[100.0,0.0,100.0]}`；未知 id 200 同形状；GET orders amount 仍 100.00 且状态未变；源码无 UPDATE；案例 A cancel 200 true + SQL 0 行；L1 preview 200 `{"data":0}` 且 5 值不变；除 reconcile 外无新端点。 |
| **S6A-C** agent L2 | collector+demo+agent（session `s_s6a`，带 traceparent/X-TraceBoard-Click）：controller + 3 service 恰 4 span；3 service 同 nodeKey、parent=controller、startNs 升序、return 100/0/100、flags 含 `L2`（无 `L1`）；values 精确 §4.2（第 2 次 2 项，第 2 项 100→0 且行号=源码 `local = 0` 行重算值；第 1/3 次 1 项）；无 `reconcileBatch`/额外 span；controller 无 values；每行 schema 合法；collector 停后端点仍 200；日志出现 `l2_probes_installed`（或 `l2_no_lvt` 则 FAIL）。 |
| **S6A-D** workbench | ingest fixture：graph 6/5、每节点 15 键、service 组 3、values 与 fixture 一致；workbench build 后静态断言 `#s6-l2-badge`/`[data-value-kind="local"]`/`行号`/`100 → 0`/`第 2/3 次`/`data-invocation-diff="true"`；非 L2 节点无 L2 徽标文案；S5 选择器/文案保留；无异步/无调试/折叠/开销宣称。 |
| **S6A-E** regression/scope | S0–S5 锚点全 PASS（按 §6.1 迁移）；案例 A/B、L1 5 值、EXACT、回放 0 写、S2 LOST 4-span 不变；S0–S5 fixture 字节、schema/transport/status 零漂移；S6a G1 冻结零漂移；无 S6b 能力（async/NO_DEBUG/loop fold/perf）；无真实 secret/CDN/镜像；端口 8601/8080/5173/5174/8602/18080 无监听、无 java/node 残留、git index 未动。 |

### 5.6 S6a checkpoint（report + commit；**不打 tag**）

- 输入：全部 S6a 产物、G1 报告、tester 报告。
- 输出（只写）：`docs/plans/stages/S6/progress.md`（CHECKPOINT: S6a；STATUS: partial（S6 未完成）；EVIDENCE/CHANGED/RISK/NEXT: S6b）、`docs/plans/stages/S6/s6a-acceptance.md`（S6a 复核清单与证据指针）、`docs/plans/STAGE-PROGRESS.md` S6 行改为 🟡 S6a 完成/S6b 待做、`README.md` 能力口径最小更新（L2 仅 reconcileAmount；异步/无调试/预算/开销仍无）、git commit（消息含 S6a，**无 tag、无 archive**）。
- 完成判据：亲自复跑门禁/构建；S6a G1 哈希不变；§2 越界零实现；S5 不回归；报告如实写未做项；**S6 仍 partial，不开始 S6b**。
- 禁止：打 `s6`/`s6a` tag、archive 备份、push/force/rebase、测试未绿提交、代改代码、宣称 S6 完成。

## 6. 路径归属（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S6/dispatch-s6a.md` | dispatcher | 只读 |
| `docs/contracts/api.v1.md`、`docs/contracts/event-model.v1.md`、`fixtures/s6-l2-lines/**`、`docs/plans/stages/S6/s6a-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S6/plan-review.md` | plan-reviewer | 只读 |
| `demo/.../backend/src/main/java/com/example/shop/{service/L2DemoService.java,controller/OrderController.java}`、`demo/.../frontend/src/App.vue`、`agent/**` | coder-agent | 只读 |
| `workbench/src/**` | coder-workbench | 只读 |
| `tools/verify/**`、`docs/plans/stages/S6/test-report-s6a.md` | tester | 只读 |
| `S6/{progress,s6a-acceptance}.md`、`STAGE-PROGRESS.md`、`README.md`、git | S6a checkpoint | 只读 |
| `schema/**`、`transport.v1.md`、`status-semantics.md`、S0–S5 fixture/文档、demo backend pom/yml/schema.sql/data.sql、demo frontend vite.config.ts/package.json、SDK/build-plugin | 冻结 | 一律只读 |

### 6.1 门禁迁移（tester 必做，不放宽其余断言）

- `S2-8`：`.type` 仍 5、`.transform` 7→8；advice 清单加 `ReconcileControllerAdvice`；instrumented `com.example.shop.*` 清单加 `L2DemoService`；允许 LVT 术语（`LocalVariableTable`/`visitLocalVariable`/`"local"`）**仅**在 L2 ASM/值/`SpanContext` 新代码；`L1Values` 仍限 param/field/return；jar 断言加 shaded ASM/无未 relocate ASM；pom 断言 byte-buddy + asm trio（仍无 Spring/Servlet/MyBatis 编译依赖）。
- `S5` 文案迁移：工作台页头/页脚、`RUNTIME_X3_NOTE`、demo 页头旧 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）` / `×N 为已采集 span 的前端聚合；运行时 ×3 属 S6` 改为 §4.4 canonical；S5 选择器/Values/source/`100 → 0` 断言保留。
- `S3-8`/`S3-10` 白名单：加 `fixtures/s6-l2-lines/`、`docs/plans/stages/S6/`、demo `L2DemoService.java`、agent L2/ASM 文件、workbench `s6/**`；S0–S5 fixture/schema 仍冻结。
- `GRAPH_NODE_KEYS` 不变（15）；`S5_G1_FREEZE` 18 项不变（S5 冻结零漂移）；新增 `S6A_G1_FREEZE`（api/event-model/S6a fixture 3 件/s6a-plan/dispatch）。
- 不变：S2-3 4-span LOST、S3-3 EXACT、S3-4/5 回放 0 写、S4-F 15 字段、S5-B/C/D/E 与 S5 perf report-only。

## 7. 门禁顺序与冻结

`dispatcher → plan-writer → plan-reviewer(G1) → (coder-agent ∥ coder-workbench) → tester → S6a checkpoint(report+commit；无 tag) → 停 → S6b`

- G1 前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 上报，不降级。
- G1 冻结：schema（不变）、api、transport（不变）、event-model、status（不变）、S6a fixture 3 件、`s6a-plan.md`、本文件；S0–S5 fixture 字节只读。
- 两个 coder 可并行；契约/fixture 是唯一事实输入；workbench 可用 G1 fixture 离线开发；tester 必须等两者完成。
- **S6a 到达检查点即停**：S6 仍 partial，不得开始 S6b，不得打 `s6` tag。

## 8. 环境事实（不得改写）

- Windows + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，全部双引号）。
- JDK8 `C:/Program Files/Java/jdk1.8.0_221`（demo/agent 运行）；JDK21 `C:/Program Files/Java/jdk-21`（collector/launcher/root）；Node 22/npm 10；Maven 3.9.5。
- ASM 9.7 三件已在本地 `~/.m2/repository/org/ow2/asm/{asm,asm-tree,asm-commons}/9.7/`（major 49，Java 8 兼容）；不新增镜像/在线源。
- 端口：collector 8601（仅 127.0.0.1）、demo 8080、workbench 5173、demo 前端 5174、preview 8602、测试静态 stub 18080；冲突先诊断，不静默改。
- session：demo 前端 SDK 固定 `s_s3demo`（不改 `traceboard.ts`）；agent 运行时测试用 `s_s6a`；分支 `master`、无 remote；无真实 secret/客户数据。

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| ASM/Byte Buddy 转换器组合冲突、类加载失败 | 专用 transformer 只匹配精确 L2DemoService；Byte Buddy 显式 ignore；所有异常返回 null 原字节并计数；jar 双 shade/relocate 断言；同一次运行回归案例 A/L1。 |
| 无 LVT 或变量名不同（裁剪/无 -g/其他编译器） | 只在 LVT 存在且 `local:D` 命中时插探针；缺失跳过并计 `l2_no_lvt`，不猜名/不造假；S6A-A 用 `javap -l` 证明环境有 LVT；完整无调试语义留 S6b。 |
| 行号漂移/探针插错位置 | 探针只在 LVT 活性范围与行边界插入；测试从源码/字节码重算行号；fixture 行号声明为测试数据；不在 UI/契约硬编码运行时行。 |
| 嵌套/递归/多请求交错导致父帧或序号错误 | ThreadLocal 栈；只接受顶层 controller 父帧；序号挂在**父 controller 帧**、按请求重置；无父帧跳过并计 `l2_no_parent`；深度/异常时清栈并计数。 |
| ×3 分组误判（按索引猜“第 2 次”） | 分组沿用同 nodeKey + startNs 排序；第 2 次由“值变化（from≠to 的 local 项）”识别，不按序号硬编码；第 1/3 次仅单值；fixture 与运行时同口径。 |
| 值/状态造假或回归 S5 | 只发真实 LVT 探针值；THREW 不编造 return；无 `L1` flag；S5-B/C/D/E 与案例 A/B 全量回归；G1 冻结哈希。 |
| 工作台夸大能力 | L2 徽标/说明只跟 `L2` flag；非 L2 节点保留 S5 原文；canonical 文案限定“仅 reconcileAmount”；tester 反向断言无异步/无调试/折叠/开销宣称。 |
| 性能/预算被提前承诺 | S6a 只记录选中方法开销不作为门槛；L2 40% 目标/预算/折叠属 S6b；不删慢样本/不伪造数字。 |

## 10. 停止条件与出口纪律

1. 必须改 schema/事件类型/status 枚举/transport，或引入 S6b（异步、无调试事件、预算/折叠、L2 字段写入/多方法）才能达标。
2. 必须让 L2 覆盖超过一个方法、改案例 A/B/L1 行为/DB，或放宽 S0–S5 门禁。
3. ASM 注入无法 fail-open（类加载/VerifyError 风险不可控），或必须关闭 Byte Buddy 既有 7 个 advice。
4. 必须引入真实 secret/PII/CDN/镜像/外部网络，或改他人路径。
5. G1 FAIL 且一轮返工仍 FAIL；测试未绿但 owner 想“先提交”。
6. S6a 只证明“单方法行级局部变量 + 逐次 ×3”；不得宣称异步/无调试/预算/开销已做，不得打 `s6` tag、不得开始 S6b。

## 11. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-23 | 首版：S6a demo L2DemoService/reconcile 端点、ASM LVT 探针/recordLocal/exitL2、values local/line/invocation、×3、graph 15 字段不变、workbench L2 展示、S6a fixture、S6A-A..E 与迁移、S6b 边界与停止条件。 |