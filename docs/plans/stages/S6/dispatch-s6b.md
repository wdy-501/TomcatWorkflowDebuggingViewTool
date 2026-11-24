# S6b 异步 / 无调试信息 / 循环折叠 / L2 性能 · 任务分发书（dispatch-s6b）

> 阶段：S6b（S6 后半；S6a 已完成，**S6 仍 🟡**，S6b 完成后做 S6 最终验收/tag）｜角色：task-dispatch｜日期：2026-11-24｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S6 与 §4；主计划 §8.4（629–634）、§9.1–9.4（664–704）、§13.4（995–1027）、§16 T6/T7/T10（1236–1240）；`S6/{dispatch-s6a.md,s6a-plan.md,plan-review-s6a.md,test-report-s6a.md}`；S6a 基线 commit `fac9b57`；当前 demo/agent/workbench/tools。
> 本文件是 S6b 下游子代理唯一任务输入；除 dispatcher 外不得修改。**S6b 只做异步上下文、无调试信息、循环/预算折叠、L2 开销、S6 最终验收**；S6a 的行级 local/×3 与 S5 的 L1 行为/选择器不回退。

## 0. 通用规则（所有人）

1. 一人一卡：只读「输入」、只写「输出」；路径含中文/空格，命令与路径全部双引号，从仓库根执行；G1 后契约、fixture、s6b-plan、本文件冻结。
2. **只有 S6 最终 checkpoint/acceptance 角色可写 git**（add/commit/archive/tag `s6-baseline`）；coder/tester 禁止 git 写、push/force/rebase、改 config。
3. 越界、契约缺口、门禁不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改”，不许改他人路径。
4. 无真实 secret/客户数据；demo 数值/ID 全为演示值；不换第三方镜像、不下载仅 GitHub 提供的资源、无 CDN/在线字体/遥测/外部网络（Maven Central 正常依赖解析除外）。
5. 未做/未验证必须标 `S6b 未做 / 待 S7`；**禁止用 fixture 冒充运行时证据**；禁止伪造异步传播、调试信息、折叠数、性能数字。
6. schema、`transport.v1.md`、`status-semantics.md`、S0–S6a fixture 字节与案例 A/B/L1/S6a 行为不动；collector 零改动；graph 仍 **15 字段**。
7. 新增端点仅 §4.1 三条；一律纯计算、任意 id 同形、无 DB 读写、无日志；不改既有 `list/cancel/preview-discount/reconcile`。
8. **S6b 明确不做**：行级字段写入（`kind=field`+行号）、对象深采、多方法 L2（超出 §4 三个方法）、CompletableFuture/@Async/框架续体、长生命周期线程池自动传播、跨服务。S6 最终验收/README 必须如实写“未支持”，不得声称 S6 已覆盖全部主计划字段写入。

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 检查点 | S6b：异步上下文 + 无调试信息 + 循环/预算折叠 + L2 性能；随后 S6 最终验收 |
| 完成信号 | 异步子线程 3 个 L2 span 同 trace/父且带 `ASYNC_INHERITED`；无 LVT 方法出 `NOT_COLLECTED_NO_DEBUG_INFO` 且不猜；100 次循环值被折叠且计数可见；L2 开销报告可见 |

S6 收尾必须同时成立（缺一即 FAIL）：

1. **Demo**：`POST /api/orders/{id}/reconcile-async` → `200 {"data":[100.0,0.0,100.0]}`；`POST /api/orders/{id}/no-debug` → `200 {"data":200.0}`；`POST /api/orders/{id}/reconcile-loop?times=100` → `200 {"data":50.0}`；任意 id 同形、无 DB、案例 A/B/L1/S6a 不变。
2. **异步 L2**：一次请求 controller + 3 service（同 nodeKey、parent=controller、startNs 升序、return 100/0/100、invocation 1/2/3、values 1/2/1 且第 2 次 100→0）；3 个 service 的 `thread.id` 均 ≠ controller，且都带 `L2`+`ASYNC_INHERITED`；同线程 reconcile 不带 `ASYNC_INHERITED`。
3. **无调试信息**：`NoDebugService#compute` 编译后无 `LocalVariableTable`（`javap -l` 证明）；事件 `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、**无 values**、无行号探针、不猜变量名；若该类有 LVT（构建回退）测试必须 FAIL。
4. **循环折叠**：`reconcileLoop(100)` 的 span `status=TRUNCATED`，flags 含 `L2`+`VALUES_CAPPED=<丢弃数>`+`VALUES_TOTAL=<总数>`；`values` 恰 20 项（首/尾/样本），丢弃数=总数−20 且>0，`to=0` 的坏值必须保留；`reconcileAmount` 仍 1/2/1、`OK`、无 cap。
5. **契约/fixture**：api/event-model 只做加性说明（无 schema/transport/status 变更、graph 15 字段不变）；`fixtures/s6b-async|s6b-no-debug|s6b-loop` 各 3 件、Ajv 2020-12 strict、仅测试数据。
6. **工作台**：显示 `ASYNC_INHERITED` 徽标/说明、`NOT_COLLECTED_NO_DEBUG_INFO` 灰色状态+事件 reason（非成功）、`已折叠 N 次`+`VALUES_CAPPED`；S6a L2/`100 → 0`/第 2 次高亮/S5 选择器全部保留。
7. **性能**：`tools/perf/l2-overhead.mjs` 有/无 agent 各 warm-up + N=100，输出 p50/p95/ratio；仅报告，ratio>1.40 只 WARN，不删慢样本、不造假。
8. **门禁/最终 S6**：一次 `tools/verify` 覆盖 S6B-A..F + S0–S6a 全回归，exit 0；S6A/S6B G1 冻结零漂移；浏览器证据覆盖异步/无调试/折叠；S6 最终验收、备份、tag `s6-baseline`。

## 2. 边界（越界即失败）

- **S6b 内**：§4.1 三个端点；`L2DemoService#reconcileAmount|reconcileLoop` 与 `NoDebugService#compute` 三个方法；异步继承（新线程）、无调试降级、L2 values 折叠与计数、L2 开销脚本、S6b fixture、工作台三项展示、S6 最终验收。
- **S6b 不做**：行级字段写入/对象深采/多方法扩展；CompletableFuture/@Async/线程池任务边界传播；跨服务/云端；SSE/WS/持久化/CORS/鉴权；Tomcat/WAR/React；sourcemap 解码/预览注入变化。出现即越界，不得写入能力口径。
- **S6a 保留**：`#btn-reconcile`、reconcile 4-span、values 1/2/1、L2 徽标/local 行/`100 → 0`/第 2 次高亮、S5 选择器与文案；只允许把“异步/无调试/折叠/开销属 S6b”的旧口径迁移为 §4.5 canonical。

## 3. 强制技术决策（不得协商）

| 项 | 决策 |
|---|---|
| async demo | `L2DemoService.reconcileAsync(long id)`：**在请求线程内创建 per-request `Executors.newFixedThreadPool(1)`**，顺序 submit 3 次 `reconcileAmount(id,100.0,i)`（i=1..3），`Future.get()` join，返回 `[100.0,0.0,100.0]`；`finally` shutdown。**单线程池**保证子线程内 invocation 仍 1/2/3（固定 3 线程会各得 1，禁止）。 |
| async 上下文 | `SpanContext` 栈改为 `InheritableThreadLocal<ArrayDeque<Frame>>`；`childValue` **深拷贝**每帧（spanId/trace/root/parent/confidence/kind/startNs 原值；values/extraFlags/l2Previous/childCallCounts/l2Values 独立副本）；子线程新建时继承。仅新线程创建时复制；**长生命周期/已存在线程不自动传播**，事件/文案不得声称自动全量传播。 |
| ASYNC flag | 帧增 `originThreadId`（创建线程 id，继承副本保留）；L2/no-debug 子 span 的 enter 若 `currentThread.id != parent.originThreadId` 追加 flag `ASYNC_INHERITED`；同线程 span 不得带该 flag。 |
| no-debug 编译 | `NoDebugService.compute(double amount)` 返回 `amount*2`（demo 固定 100→200.0）；@Service、无 DB/日志；源文件正常编译后，Maven **antrun `javac debug="false"`** 在 `process-classes` 仅重编该类覆盖 `target/classes`（`-g:none`，LVT+LineNumberTable 均无）；API/注解不变。 |
| no-debug transformer | 新增独立 `NoDebugClassFileTransformer`（ASM，精确类 `com.example.shop.service.NoDebugService`、方法 `compute(D)D`）：**LVT 缺失是预期路径**，只注入 enter/exit（无行探针）；exit 发 service span `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、无 `values`、真实 return；LVT 存在则记 `nodebug_lvt_present`、返回原字节、不插桩，测试 FAIL。类/方法/return 形状不符 fail-open 计数，绝不猜名/行。 |
| no-debug status | 正常路径 status 固定 `NOT_COLLECTED_NO_DEBUG_INFO`（灰色，不是 OK）；异常路径 `THREW`（无 values）；`source` 允许缺失/line=null（无调试信息不得伪造行号）。 |
| loop demo | `L2DemoService.reconcileLoop(long id,int times)`：`local` 初始 0；每轮先让 `local` 加 1；`i==50` 时把 `local` 置 0；每轮 `if` 之后有一行**读取 `local` 但不改变它**的锚点语句，使探针能观察到 0 与后续恢复；返回最终 `local`（100 次→50.0）；`times` 默认 100、clamp 1..200；无 DB。 |
| loop 折叠 | `L2Values` 每 span 保留上限 **20**；超限：保留前 6 + 后 6 + 中段均匀样本（补足 20），**且优先保留第一条 `to=0` 的坏值**；`total`=折叠前项数、`dropped=total-20`；丢弃不得静默：flag `VALUES_CAPPED=<dropped>` + `VALUES_TOTAL=<total>`；事件级 `status=TRUNCATED`；保留项 `truncated=false`（真值未截断，列表被折叠）。`reconcileAmount`（≤2 项）不触发、仍 `OK`。 |
| fold 口径 | “已折叠 N 次”N=`VALUES_CAPPED` 值；总数=`VALUES_TOTAL`；工作台必须同屏展示两者；无 flag 时不得显示折叠文案。 |
| ASM/Byte Buddy | 两个专用 transformer（`L2ClassFileTransformer` 扩到 reconcileAmount/reconcileLoop；`NoDebugClassFileTransformer` 新）均精确类匹配、`addTransformer(...,false)`；`reconcileAmount` 仍**恰 2 探针**、`reconcileLoop` 自检 ≥2（demo 期望 3）否则 `l2_probe_missing` fail-open；Byte Buddy **显式 ignore 两个类**；不接管既有 8 个 advice。ASM 仍 9.7 shaded/relocate，jar major 52。 |
| controller | `OrderController` 追加 `reconcileAsync(long)`、`noDebug(long)`、`reconcileLoop(long,int)`；3 个 Byte Buddy advice（`AsyncControllerAdvice`/`NoDebugControllerAdvice`/`LoopControllerAdvice`）开 controller 帧（EXACT header join 同 S6a）；`.transform` 8→11、adviceClasses 8→11、Byte Buddy types 仍 5；`expectedShopClasses` 5→6。 |
| 端点 | `POST /{id}/reconcile-async`→`{"data":[100.0,0.0,100.0]}`；`POST /{id}/no-debug`→`{"data":200.0}`；`POST /{id}/reconcile-loop?times=100`→`{"data":50.0}`；任意 id 200 同形，不 404/-1/null。 |
| 契约 | api.v1 加性：S6b 矩阵、§10.11 异步/无调试/折叠只读与 canonical、附录 G 三端点；event-model 加性：§4.4.8 异步继承与 `ASYNC_INHERITED`、§4.4.9 no-debug、§4.4.10 折叠（TRUNCATED/VALUES_CAPPED/VALUES_TOTAL）；**schema/transport/status 字节不变、graph 15 字段不变、collector 零 diff**。 |
| fixture | `fixtures/s6b-async/`、`s6b-no-debug/`、`s6b-loop/` 各 `{events.ndjson,expected-facts.json,README.md}`；固定 id/session（`s_s6b*`）、仅测试数据、无 secret、无 `s_s3demo`；README 首段声明“测试数据非运行时证据”。 |
| 工作台 | 仅 flag `ASYNC_INHERITED` 显示 `#s6-async-badge`；`NOT_COLLECTED_NO_DEBUG_INFO` 沿用灰色 `notcollected` 并显示事件 `reason`（`#s6-no-debug-reason`）；`VALUES_CAPPED` 节点显示 `#s6-fold-note`=`已折叠 N 次（VALUES_CAPPED=N；共 M 次）`；S6a/S5 选择器与条件高亮保留。 |
| perf | `tools/perf/l2-overhead.mjs`：collector 8601 + demo 8080；base 无 agent、agent 有 agent（session `s_s6bperf`）；各 warm-up≥20、N=100、rounds=3；nearest-rank p50/p95、median across rounds、ratio=median(agent p50)/median(base p50)；**report-only，>1.40 仅 WARN**；校验 agent 产生 L2 事件；finally 清理。 |
| 测试/最终 | S6B-A..F 一次命令；全量 S0–S6；浏览器证据；G1 冻结；S6 验收/备份/tag。 |

## 4. 共享契约

### 4.1 端点与运行时链路

- 浏览器：`click #btn-reconcile-async`→fetch→`OrderController#reconcileAsync`→3× `L2DemoService#reconcileAmount`；`#btn-reconcile-loop`→`#reconcileLoop`→1× `L2DemoService#reconcileLoop`；no-debug 可仅端点：`OrderController#noDebug`→`NoDebugService#compute`。
- 脚本化（无 SDK）：async 恰 4 span（controller+3 service）；loop 恰 2 span；no-debug 恰 2 span；每行 schema v1 合法。
- async service：nodeKey 相同、parentSpanId=controller spanId、startNs 严格升序、`thread.id` 三者相同且 ≠ controller、confidence 继承 `EXACT`、flags 含 `L2`+`ASYNC_INHERITED`、无 `L1`/`LOST_BACKEND`；invocation 1/2/3。
- loop service：nodeKey `com.example.shop.service.L2DemoService#reconcileLoop`、parent=controller、`status=TRUNCATED`、flags `L2`+`VALUES_CAPPED=<d>`+`VALUES_TOTAL=<t>`；`values.length=20`、`t>20`、`d=t-20`、`values[0].from=null`、末项 `to=50`、存在 `to=0` 项。
- no-debug service：nodeKey `com.example.shop.service.NoDebugService#compute`、parent=controller、`status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason` 逐字、flag `NO_DEBUG_INFO`、`values` 键缺失、`source.line` 为 null/缺失；return 真实 200。
- 同线程 reconcile（S6a）仍 4 span、无 `ASYNC_INHERITED`；`reconcileBatch` 仍不插桩、无 span。

### 4.2 异步上下文（InheritableThreadLocal）

- 栈由 `ThreadLocal` 改 `InheritableThreadLocal`；`childValue` 返回深拷贝帧栈；拷贝的 controller 帧保留原 spanId 作为子 span 的 parent。
- per-request 池在 controller 帧打开后创建（首次 submit 时建 worker），worker 创建时复制当前栈；同一 worker 顺序执行 3 个任务，`childCallCounts` 在副本内自增 1..3。
- 子线程退出 L2 只弹本线程副本；不得把副本 controller 帧 emit 成第二棵根；原请求线程栈不受子线程修改。
- **限制（必须写入契约/UI/README）**：仅“线程创建时”继承；启动期长生命周期池/已存在线程无请求上下文（`l2_no_parent`，不发假 span）；复用旧 worker 可能带过期 trace（S6 不解决，S7+ 显式传播）；per-request 建池有线程创建开销。
- `ASYNC_INHERITED` 只证明“上下文来自继承的父帧”，不证明框架级传播；不得声称 @Async/CompletableFuture 已支持。

### 4.3 无调试信息（NOT_COLLECTED_NO_DEBUG_INFO）

- 构建：`NoDebugService.java` 先正常编译；antrun `javac debug=false` 仅重编该类覆盖 `target/classes`；`javap -l` 必须无 `LocalVariableTable`/`LineNumberTable`，且 L2DemoService 的 `local:D` 仍在。
- 事件：`kind=service`、status/reason/flag/无 values 如 §3；无行探针、无变量名；return 为真实方法返回值；confidence 继承 controller（EXACT/LOST 按 header）。
- 降级可见性：工作台灰色显示 status+reason（不是成功）；报告/README 写“无调试信息方法只证明调用与返回值，给不出局部变量名/行号”。
- 回退检测：若 `javap -l` 见 LVT 或 agent 日志出现 `nodebug_lvt_present`，S6B-B FAIL（构建必须回到 no-debug）；不允许“有 LVT 就当普通 L2/猜名”。

### 4.4 循环折叠与预算

- 观测序列：reconcileLoop(100) 约 102 次值变化（含 `null→0` 基线、`50→0` 坏值、`0→1` 恢复、末尾 `49→50`）；探针数由 transformer 自检记录（期望 3：for 行/if 行/锚点行；≥2 才安装，否则 `l2_probe_missing` fail-open）。
- 折叠规则见 §3；保留项按原观测顺序，不重排、不重算 `from/to`；`VALUES_TOTAL`=折叠前真实项数（含基线），`VALUES_CAPPED`=丢弃数；坏值 `to=0` 优先保留。
- `reconcileAmount` 的 1/2/1 与 S6a values 逐字不变；`reconcileLoop(times≤~20)` 不触发折叠时 status 仍 `OK`、无 cap flag（S6B-C 用 times=100 与 times=5 对照）。
- 单 span 仍受 64KB/30 项旧上限约束：`L2Values` cap 取 20（更严）；L1Values 的 30 项预算不动；无静默丢弃。

### 4.5 工作台 canonical（逐字，src+dist 同源）

- banner：`S6：L2 行级（reconcileAmount）、异步继承（reconcileAsync）、无调试信息（NoDebugService#compute，NOT_COLLECTED_NO_DEBUG_INFO）、循环折叠（reconcileLoop）；长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持`
- L2 说明：`S6 L2：行级局部变量来自 LVT 探针（reconcileAmount 第 2 次 100 → 0；reconcileLoop 折叠保留首/尾/样本）；异步子线程创建时继承上下文（ASYNC_INHERITED）；长生命周期线程池不自动传播`
- ×N 注记：`×N 为已采集 span 的前端聚合；运行时 ×3 仅 L2DemoService#reconcileAmount 与 reconcileAsync（单异步线程内）演示；其他方法无运行时 ×3`
- 无调试说明：`S6 无调试信息：NoDebugService#compute 无 LocalVariableTable，状态 NOT_COLLECTED_NO_DEBUG_INFO；不猜变量名/行号`
- 折叠：`已折叠 N 次（VALUES_CAPPED=N；共 M 次）`（N=丢弃数、M=`VALUES_TOTAL`）；无 flag 不显示；折叠文案不得把保留项说成“已截断值”。
- 旧 S6a 三段（banner/L2 说明/×N 注记）与 `异步/无调试信息/循环折叠/开销属 S6b`、`无异步/×3` 等绝对口径在 workbench/src、workbench/dist、demo frontend/src、demo dist 全部不得残留（stale 反向断言）。
- 选择器：`#s6-async-badge`、`#s6-no-debug-badge`、`#s6-no-debug-reason`、`#s6-fold-note`；S6a `#s6-l2-badge`/`#s6-l2-note`/`#s5-values`/`data-invocation-diff` 保留。

### 4.6 collector / graph / fixture

- collector 零改动：ingest 只做 schema 校验；graph 仍 15 字段（`reason`/`thread`/`values` 原样）、请求/回放/错误码/meta 5 键不变；`requests.backendSpanCount` async=4、loop/no-debug=2。
- fixture 三目录各 3 件；`expected-facts.json` 含请求/图/节点 15 键/values/理由/flags/工作台期望与反向断言；async 固定父子/线程 id、no-debug 固定 status/reason/无 values、loop 固定 `status=TRUNCATED`+20 项+cap 计数+坏 0；不得含真实会话/secret；schema 合法。
- 测试数据与运行时证据分离：fixture 只证明形状；运行时由 S6B-A/B/C 证明。

### 4.7 冻结与 supersede

- 新增 `S6B_G1_FREEZE`（14 项）：api、event-model、3 组 fixture 各 3 件、`s6b-plan.md`、`dispatch-s6b.md`、`plan-review-s6b.md`；`LATEST_G1_FREEZE={...S5_G1_FREEZE,...S6A_G1_FREEZE,...S6B_G1_FREEZE}`，api/event-model 取 S6b 哈希（S5/S6a 旧值被 supersede）。
- S5 18 项集合/数量断言保留（schema/transport/status/S0–S5 fixture 等仍 S5 哈希）；`S6A_G1_FREEZE` 8 项中 api/event-model 由 S6B 覆盖，其余 6 项（S6a fixture 3、s6a-plan、dispatch-s6a、plan-review-s6a）仍按 S6a 哈希零漂移；S0–S6a fixture 字节不变。

## 5. 任务卡（独立输入/输出）

### 5.1 plan-writer（契约/fixture/计划；不写代码）

- 输入：本文件 §1–§4、S6a 冻结产物、S5/S6a 契约、主计划 §8.4/§9/§13.4/§16。
- 输出（只写）：`docs/contracts/api.v1.md`（S6b 变更记录/矩阵、§10.11、附录 G 三端点与 200 形状、工作台 canonical）、`docs/contracts/event-model.v1.md`（§4.4.8/9/10、`ASYNC_INHERITED`/`NO_DEBUG_INFO`/`VALUES_CAPPED`/`VALUES_TOTAL`、TRUNCATED 口径、S6b 边界）、`fixtures/s6b-{async,no-debug,loop}/**`、`docs/plans/stages/S6/s6b-plan.md`（设计/验收/迁移/命令/限制）。
- 完成判据：§4 全部落入契约/fixture/plan；fixture schema 合法、自洽；api/event-model 只加性、历史保留；schema/transport/status/S0–S6a fixture 字节不变；s6b-plan 写清“不做”与 supersede/测试迁移。
- 禁止：写代码/pom/TS/Vue、改 schema/transport/status、改 S0–S6a fixture、git、真实 secret/外网 `$ref`、宣称行级字段/对象深采/长生命周期池传播已做。

### 5.2 plan-reviewer（只读，G1 门）

- 输入：本文件、plan-writer 全部输出、S0–S6a 冻结契约/schema/fixture、当前 agent/demo/workbench/tools。
- 输出（只写）：`docs/plans/stages/S6/plan-review-s6b.md`——逐项 PASS/FAIL、阻断/建议、SHA256 冻结清单（schema、api、transport、event-model、status、3 组 fixture、s6b-plan、dispatch、review）、`G1: PASS|FAIL`。
- 核查：①async 仅新线程继承、单线程池、不虚假传播；②no-debug status/reason/无 values/LVT 缺失构建与 FAIL 门禁；③折叠 cap/首尾样本/坏 0/总数/丢弃/TRUNCATED 无静默；④graph 15 字段、schema/transport/status 零漂移、collector 零改；⑤工作台只跟 flag/status、不夸大、S6a/S5 保留；⑥冻结 supersede 与门禁迁移完整；⑦fixture 仅测试数据、schema 合法；⑧S6b 不做项未被偷偷实现/宣称。
- 禁止：替作者改文件、写代码、改 schema、git。

### 5.3 coder-agent（demo 后端/前端 + agent）

- 输入：本文件 §3/§4、G1 契约/plan、现有 demo/agent。
- 输出（只写）：`demo/.../service/L2DemoService.java`（async/loop）、新增 `NoDebugService.java`、`controller/OrderController.java`（3 方法+注入）、`demo/.../backend/pom.xml`（antrun no-debug）、`demo/.../frontend/src/App.vue`（async/loop 按钮+no-debug 可选+canonical 页头）；`agent/pom.xml`（如需）、`agent/src/main/java/io/traceboard/agent/**`（SpanContext/Frame/InheritableThreadLocal、L2Values fold、SpanEmitter reason/flags、L2ClassFileTransformer loop、NoDebugClassFileTransformer、TraceAgent 11 advice/ignore、3 controller advice）。
- 完成判据：§3/§4 全部；async 4 span/ASYNC flag、no-debug 2 span/status/reason/无 values、loop 折叠 20/VALUES_CAPPED/VALUES_TOTAL/TRUNCATED/坏 0；同步 reconcile 仍 1/2/1 且无 ASYNC；案例 A/B/L1/S6a 零变化；jar major 52/ASM shaded；fail-open（collector 停仍 200）；`javap -l` 证明 L2DemoService 有 LVT、NoDebugService 无 LVT。
- 禁止：改 workbench/collector/SDK/契约/fixture/schema、DB、真实 secret、新增 §4.1 之外端点、git、S6b 不做项。

### 5.4 coder-workbench（`workbench/src/**`）

- 输入：本文件 §3/§4、G1 契约/fixture、workbench 现状。
- 输出（只写）：`workbench/src/{s6/**,components/S4DetailPanel.vue,components/S3Panel.vue,s4/derive.ts,s5/values.ts,App.vue,style.css}`（可新增 `s6/async.ts|no-debug.ts|fold.ts`）。
- 完成判据：`#s6-async-badge` 仅 `ASYNC_INHERITED`；`#s6-no-debug-badge`/`#s6-no-debug-reason` 仅 no-debug 状态，灰色且 reason 取事件；`#s6-fold-note`=`已折叠 N 次（VALUES_CAPPED=N；共 M 次）` 仅 cap 节点；S6a L2/`100 → 0`/第 2 次高亮/S5 选择器保留；旧 S6a 口径迁移为 §4.5；`npm ci && npm run build` 绿。
- 禁止：改 collector/SDK/demo/agent/契约/fixture/schema、发写请求、用 nodeKey 硬编码判定、宣称全量异步传播/行级字段/对象深采、git。

### 5.5 tester（`tools/verify/**` + `tools/perf/l2-overhead.mjs` + `S6/test-report-s6b.md`）

- 输入：全部 S6b 产物、G1 冻结、S0–S6a 门禁。
- 输出（只写）：`tools/verify/verify.mjs`、`tools/perf/l2-overhead.mjs`、`docs/plans/stages/S6/test-report-s6b.md`。
- 完成判据：S6B-A..F 见 §9；迁移 S6A/S5 门禁与冻结（§7）不放宽其余断言；一次命令串行起停、`finally` 清理；报告如实写 perf/perf WARN/未做项；**不为过门禁删断言或伪造数字**。
- 禁止：改产品代码/契约/fixture、git、真实 secret/镜像。

### 5.6 S6 最终 checkpoint/acceptance（report + backup + tag）

- 输入：全部 S6a/S6b 产物、G1 报告、tester 报告、浏览器证据。
- 输出（只写）：`S6/progress.md`（CHECKPOINT: S6；STATUS: done；EVIDENCE/CHANGED/RISK/NEXT: S7）、`S6/s6-acceptance.md`（S6a+S6b 清单、命令、perf、限制）、`S6/evidence/*.png`（async/no-debug/fold 浏览器证据）、`STAGE-PROGRESS.md` S6 ✅、`README.md` 能力/限制、`docs/plans/archive/stage-S6-<日期>/`（MANIFEST+SUMMARY+README+docs 快照）、git commit + tag `s6-baseline`。
- 完成判据：亲自复跑 S6B-A..F 与全量 S0–S6 exit 0；S6A/S6B G1 哈希不变；S6a/S5 不回归；浏览器证据覆盖 async/no-debug/fold；perf 报告原样；README/验收如实写“行级字段写入/对象深采/多方法/长生命周期池传播未支持”；tag/备份与 S5 同构。
- 禁止：push/force/rebase、测试未绿提交、代改代码、把 fixture 当运行时证据、宣称 S6 超出实际能力。

## 6. 路径归属（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S6/dispatch-s6b.md` | dispatcher | 只读 |
| `docs/contracts/{api.v1,event-model.v1}.md`、`fixtures/s6b-*/**`、`S6/s6b-plan.md` | plan-writer | 只读 |
| `S6/plan-review-s6b.md` | plan-reviewer | 只读 |
| `demo/.../service/{L2DemoService,NoDebugService}.java`、`demo/.../controller/OrderController.java`、`demo/.../backend/pom.xml`、`demo/.../frontend/src/App.vue`、`agent/**` | coder-agent | 只读 |
| `workbench/src/**` | coder-workbench | 只读 |
| `tools/verify/**`、`tools/perf/l2-overhead.mjs`、`S6/test-report-s6b.md` | tester | 只读 |
| `S6/{progress,s6-acceptance}.md`、`STAGE-PROGRESS.md`、`README.md`、`docs/plans/archive/stage-S6-*/`、git/tag | S6 acceptance | 只读 |
| `schema/**`、`transport.v1.md`、`status-semantics.md`、S0–S6a fixture/文档、collector/SDK/build-plugin | 冻结 | 一律只读 |

## 7. 门禁迁移（tester 必做，不放宽其余断言）

顺序：`dispatcher → plan-writer → plan-reviewer(G1) → (coder-agent ∥ coder-workbench) → tester → S6 acceptance(report+commit+backup+tag) → 停`；G1 前 coder 不得动工，G1 FAIL 最多返工一轮。

| 门禁/常量 | 迁移 |
|---|---|
| `S5_G1_FREEZE`(18)/`S6A_G1_FREEZE`(8) | 集合与数量断言保留；api/event-model 期望取 `LATEST_G1_FREEZE`（S6b 哈希 supersede）；S6a 其余 6 项按 S6a 哈希零漂移；新增 `S6B_G1_FREEZE`(14)。S2-L/S3-2/S4-H/S5-G/S6A-E 同用 LATEST（S6A 的 api/event-model 由 S6B 覆盖）。 |
| `S2-8` | `.transform` 8→11、adviceClasses 8→11（3 controller advice）、`expectedShopClasses` 5→6（NoDebugService，label 同步）、`agentTargets` 保持 5；新增 `NoDebugClassFileTransformer.java` 允许 LVT/no-debug 术语；`L1Values.java` 仍禁 `"local"`、`getMessage()` 仍禁。 |
| `S3-8`/`S4-I`/`S5-H` | 放行 `async`/`NO_DEBUG`/`fold`/`VALUES_CAPPED`/`l2-overhead` 仅限：agent L2/NoDebug 文件+`SpanContext`/`L2Values`/`SpanEmitter`/`TraceAgent`、`workbench/src/s6/**`、`NoDebugService.java`、`docs/plans/stages/S6/**`、`fixtures/s6b-*/**`、`tools/perf/l2-overhead.mjs`；其余 marker（SSE/WS/Tomcat/cloud/react/持久化/像素）仍全域禁；label 改“S6b allowed only in the S6b files; no async frameworks/field-line/deep-object”。git 白名单同步。 |
| `S3-1`/`S3-6`/`S4-F`/`S5-D`/`S5-E` | S6a banner/L2 说明/×N 注记替换为 §4.5 canonical；其余 S3/S4/S5 token（选择器、`100 → 0`、`第 1/1 次`、manifest、`#btn-discount` 等）保留；demo/工作台页头同源。 |
| `S5_STALE_TEXTS` | 增加 S6a 三段旧文案（含“属 S6b”）与 `无异步/×3`、`无构建期局部变量/L2`；workbench/src、workbench/dist、demo frontend/src、demo dist 零命中。`S5_FORBIDDEN_CLAIMS` 更新：禁“异步全量传播/线程池自动传播/无调试可采变量/循环全量/开销达标”。 |
| `S6A-B` | 端点清单迁移为 list/cancel/preview-discount/reconcile + 3 个 S6b 端点（恰 7 个映射）；其余断言不变；新服务仍无 DB。 |
| `S6A-E` | “无 S6b 能力”反向断言改为“S6b 仅在 §7 白名单文件/路径；无行级字段/对象深采/多方法/框架传播”；S6A/S5 其余锚点、fixture 字节、回放 0 写、15 字段不变。 |
| 不变 | S2-3 4-span LOST、S3-3 EXACT、S3-4/5 回放 0 写、S4-F 15 字段、S5-B/C、S5 perf report-only、S6a 1/2/1+×3。 |

## 8. 构建计划（antrun no-debug）

- `demo/.../backend/pom.xml` 加 `maven-antrun-plugin` **3.1.0**（本机 `~/.m2` 已有）execution `no-debug-service`，phase `process-classes`（compile 之后、package 之前）：`javac srcdir=src/main/java destdir=${project.build.outputDirectory} includes=com/example/shop/service/NoDebugService.java debug="false" includeantruntime="false" source=1.8 target=1.8 encoding=UTF-8 fork=true executable=${java.home}/bin/javac`，classpath ref=`maven.compile.classpath`（保证 @Service 注解保留）；仅覆盖该类 `.class`，不动源/其他类。
- 验收：`javap -l -p -classpath target/classes com.example.shop.service.NoDebugService` 无 `LocalVariableTable`/`LineNumberTable`；`L2DemoService` 的 `reconcileAmount/reconcileLoop` 的 `local:D` 仍在；`jar tf`/`javap` 对 Boot jar 内类复验；clean 构建可复现。
- 依赖预检：`maven-antrun-plugin:3.1.0` 本机存在；`org.apache.ant:ant:1.10.12` 本机缺失，首次构建需 Maven Central 正常解析（非镜像）；若离线不可解析 → 停止上报，不得改换镜像或静默跳过 no-debug（必要时由 dispatcher/acceptance 书面批准等价的 compiler-plugin 二次执行，验收口径不变）。
- agent：ASM 9.7 三件已在 `~/.m2`；不新增依赖；shade/relocate 规则不变；demo 构建 JDK8、agent/collector JDK21。

## 9. 测试计划（S6B-A..F；一次命令、串行起停、`finally` 清理）

| 组 | 断言要点 |
|---|---|
| **S6B-A** async 线程/池 | 前置 build/artifact（agent 52/shaded ASM、demo JDK8、antrun、workbench）。collector+demo+agent（`s_s6b`）：async 200 `[100.0,0.0,100.0]`；恰 4 span；3 service 同 nodeKey/parent=controller/startNs 升序/return 100/0/100/invocation 1..3/values 1/2/1 且第 2 次 100→0；3 service `thread.id` 相同且 ≠ controller，flags 含 `L2`+`ASYNC_INHERITED`（无 L1/LOST_BACKEND）；同步 reconcile 4 span 无 ASYNC；collector 停后端点仍 200；无 VerifyError。 |
| **S6B-B** no-debug | `javap -l`：NoDebugService 无 LVT/LineNumberTable（有则 FAIL）、L2DemoService 仍有 `local:D`；端点 200 `{"data":200.0}` 任意 id；agent 事件恰 2 span；service `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、无 `values`、无行号伪造；日志无 `nodebug_lvt_present`；DB amount 100/CREATED；schema 合法。 |
| **S6B-C** 循环折叠 | `reconcile-loop?times=100` 200 `{"data":50.0}`；2 span；loop span `status=TRUNCATED`、flags `L2`+`VALUES_CAPPED=<d>`+`VALUES_TOTAL=<t>`、`t>20`、`d=t-20`、`values.length=20`、首项 `from=null`、末项 `to=50`、存在 `to=0`、无静默丢弃；`times=5` 不折叠（`OK`、无 cap flag）；`reconcileAmount` 1/2/1 与 S6a 逐字不变；无 DB；schema 合法。 |
| **S6B-D** 性能 | 运行 `tools/perf/l2-overhead.mjs`（N=100、warmup≥20、rounds=3）：base/agent p50/p95、ratio、agent L2 事件>0；ratio>1.40 只 WARN；脚本 exit 0；报告记录原始数字与 WARN，不删样本/不改阈值；无残留进程/端口。 |
| **S6B-E** S0–S6a 回归 | 全量 S0–S6a 锚点 PASS；案例 A/B、L1 5 值、S6a 4-span/×3/1/2/1、EXACT、回放 0 写、S2 LOST 不变；schema/transport/status/S0–S6a fixture 字节零漂移；`S6A_G1_FREEZE` 与 `S6B_G1_FREEZE`（含 supersede）零漂移；graph 15 字段；collector 零 diff。 |
| **S6B-F** scope/cleanup/UI | workbench build；静态 token：`s6-async-badge`/`s6-no-debug-badge`/`s6-no-debug-reason`/`s6-fold-note`/`已折叠`/`VALUES_CAPPED`/`共`+S6 canonical；纯函数/fixture 断言仅 ASYNC flag 节点、仅 no-debug 状态、仅 cap 节点显示；S6a/S5 选择器保留；旧 S6a 口径零命中；无行级字段/对象深采/多方法/框架传播宣称；无真实 secret/CDN/镜像；端口 8601/8080/5173/5174/8602/18080 无监听、无 java/node 残留、git index 未动。 |

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| **InheritableThreadLocal/线程池**：仅线程创建时继承；长生命周期池/复用 worker 带过期 trace；per-request 建池开销 | demo 严格 per-request 单线程池；childValue 深拷贝防串写；过期/未继承计入 `l2_no_parent` 不发假 span；契约/UI/README 明写限制；不声称框架传播。 |
| **antrun javac**：`debug=false` 可能被后续 compile 覆盖；ant 1.10.12 本机缺失需在线解析；只重编单文件类路径/注解丢失 | execution 固定在 `process-classes`（compile 后）；仅 include 该类、classpath=`maven.compile.classpath`；`javap -l` 门禁 + clean 构建复验；离线不可解析即停止，不换镜像。 |
| **ASM no-LVT**：无调试类缺 LineNumberTable，探针锚点/return 形状漂移导致 VerifyError 或静默不插桩 | no-debug 只注入 enter/exit（无行探针）；精确类/方法/描述符/单 DRETURN 校验；任何异常返回原字节计数；LVT 存在即 `nodebug_lvt_present` 并 FAIL；启动即验证无 VerifyError。 |
| **折叠计数**：探针布局/去重导致 total 与期望不符；坏 0 被折叠掉；静默丢项 | 测试用 times=100/5 对照并断言 `t>20`、`d=t-20`、`length=20`、坏 0 保留、首尾保留；`VALUES_TOTAL` 取折叠前真实项数；UI 同屏显示 total/capped；不硬编码 total。 |
| **perf 方差**：Windows/JIT/H2/线程创建噪声导致 ratio 抖动；误当门槛/造假 | report-only、warm-up、3 rounds median、N=100、固定脚本；>1.40 仅 WARN；保留原始样本与 WARN；不删慢样本、不调阈值、不宣称达标。 |
| 其他：S6a/S5 回归、G1 漂移、UI 夸大、secret/CDN | 全量 S0–S6 回归 + LATEST freeze；canonical 限定能力；UI 反向断言；扫描 secret/CDN/镜像；端口/进程清理。 |

## 11. 停止条件与出口纪律

1. 必须改 schema/事件类型/status 枚举/transport，或必须实现行级字段写入/对象深采/多方法/框架续体才能达标。
2. 必须让 no-debug 类保留 LVT、猜变量名，或让异步在长生命周期池中“自动传播”才能达标。
3. ASM/antrun 无法 fail-open（VerifyError/类加载不可控），或必须关闭既有 Byte Buddy advice。
4. 必须引入真实 secret/PII/CDN/镜像/外部网络，或改他人路径/冻结文件。
5. G1 FAIL 且一轮返工仍 FAIL；测试未绿但 owner 想“先提交/tag”。
6. S6b 只证明“新建线程继承 + 无调试降级 + 折叠计数 + 开销报告”；不得宣称 S6 覆盖行级字段写入/对象深采/多方法/全量异步，不得打 tag 前跳过浏览器/全量门禁。

## 12. 环境事实（不得改写）

- Windows + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，全部双引号）。
- JDK8 `C:/Program Files/Java/jdk1.8.0_221`（demo/agent）；JDK21 `C:/Program Files/Java/jdk-21`（collector/launcher/root）；Node 22.x/npm 10.x；Maven 3.9.5；ASM 9.7 本机 major 49；`maven-antrun-plugin:3.1.0` 本机有、`org.apache.ant:ant:1.10.12` 本机无（见 §8）。
- 端口：collector 8601（仅 127.0.0.1）、demo 8080、workbench 5173、demo 前端 5174、preview 8602、测试静态 stub 18080；冲突先诊断，不静默改。
- session：demo 前端 SDK 固定 `s_s3demo`；agent 运行时测试 `s_s6b`/`s_s6bperf`；分支 `master`、无 remote；仅 acceptance 写 git。

## 13. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-24 | 首版：S6b async 单线程 per-request 池 + InheritableThreadLocal 深拷贝/ASYNC_INHERITED、NoDebugService antrun debug=false + NOT_COLLECTED_NO_DEBUG_INFO、reconcileLoop 折叠 20+VALUES_CAPPED/VALUES_TOTAL+TRUNCATED、3 端点/3 advice/2 transformer、S6b fixture/工作台/perf、S6B-A..F 与 S6 验收/tag。 |