# S6b 计划：异步继承 / 无调试信息 / 循环折叠 / L2 开销（S6 收尾）

> 阶段：S6b（S6 后半；S6a 已完成、S6 仍 🟡，S6b 完成后才做 S6 最终验收/备份/tag `s6-baseline`）｜角色：plan-writer｜日期：2026-11-24｜版本：v1.1（G1 FAIL 返工第 1 轮；见 §16）
> 唯一输入：`docs/plans/stages/S6/dispatch-s6b.md`（binding，下称 dispatch）、SOLO S6、主计划 §8.4/§9.1–9.4/§13.4/§16 T6/T7/T10、S0–S6a 冻结契约/schema/fixture、当前 demo/agent/workbench/tools。
> 本计划只描述 S6b 的设计与门禁；代码由 dispatch §5.3/§5.4/§5.5 三张卡实现。G1 后本文与契约/fixture 一并冻结。
> **S6b 只做**：异步上下文（仅新建线程继承）、无调试信息降级、循环/预算折叠、L2 开销报告、S6 最终验收。**S6a 的 L2 行级与 S5 的 L1 行为零回退。**

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 检查点 | S6b：异步上下文 + 无调试信息 + 循环/预算折叠 + L2 性能；随后 S6 最终验收 |
| 完成信号 | 异步子线程 3 个 L2 span 同 trace/父且带 `ASYNC_INHERITED`；无 LVT 方法出 `NOT_COLLECTED_NO_DEBUG_INFO` 且不猜；100 次循环值被折叠且计数可见；L2 开销报告可见 |

S6 收尾必须同时成立（缺一即 FAIL）：

1. **Demo**：`POST /api/orders/{id}/reconcile-async` → `200 {"data":[100.0,0.0,100.0]}`；`POST /api/orders/{id}/no-debug` → `200 {"data":200.0}`；`POST /api/orders/{id}/reconcile-loop?times=100` → `200 {"data":50.0}`；任意 id 同形、无 DB；案例 A/B/L1/S6a 不变。
2. **异步 L2**：一次请求 controller + 3 service；同 nodeKey、parent=controller、`startNs` 升序、return 100/0/100、`invocation` 1/2/3、`values` 1/2/1 且第 2 次 `100 → 0`；3 个 service `thread.id` 相同且 ≠ controller，flags 含 `L2`+`ASYNC_INHERITED`；同线程 reconcile **不带**该 flag。
3. **无调试信息**：`NoDebugService#compute` 编译后无 `LocalVariableTable`（`javap -l` 证明）；事件 `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、**无 values**、无行号探针、不猜变量名；若仍有 LVT，S6B-B 必须 FAIL。
4. **循环折叠**：`reconcileLoop(100)` 的 span `status=TRUNCATED`、flags 含 `L2`+`VALUES_CAPPED=<d>`+`VALUES_TOTAL=<t>`；`values` 恰 20 项、`t>20`、`d=t-20`、`to=0` 坏值保留；`reconcileAmount` 仍 1/2/1、`OK`、无 cap。
5. **契约/fixture**：api/event-model 只加性（无 schema/transport/status 变更、graph 15 字段、路由 9、meta 5）；`fixtures/s6b-async|s6b-no-debug|s6b-loop` 各 3 件、Ajv 2020-12 strict、仅测试数据。
6. **工作台**：`ASYNC_INHERITED` 徽标、`NOT_COLLECTED_NO_DEBUG_INFO` 灰色 + reason、`已折叠 N 次（VALUES_CAPPED=N；共 M 次）`；S6a/S5 选择器与条件高亮全部保留。
7. **性能**：`tools/perf/l2-overhead.mjs` 有/无 agent 各 warm-up + N=100，输出 p50/p95/ratio；仅报告，ratio>1.40 只 WARN。
8. **门禁/最终 S6**：一次 `tools/verify` 覆盖 S6B-A..F + S0–S6a 全回归、exit 0；S6A/S6B G1 冻结零漂移；浏览器证据覆盖异步/无调试/折叠；S6 验收、备份、tag。

## 2. S6b / S6a 边界（越界即失败）

- **S6b 内**：dispatch §4.1 三个端点；`L2DemoService#reconcileAsync|reconcileLoop` 与 `NoDebugService#compute`；异步**创建时**继承、无调试降级、L2 values 折叠与计数、L2 开销脚本、S6b fixture、工作台三项展示、S6 最终验收。
- **S6b 不做（不得实现/宣称）**：行级字段写入（`kind=field`+行号）、对象深采、多方法 L2（超出两个 demo 方法）、`CompletableFuture`/`@Async`/框架续体、长生命周期线程池/已存在线程自动传播、跨服务/云端、SSE/WS/持久化/CORS/鉴权、Tomcat/WAR/React、sourcemap 解码/预览注入变化。
- **S6a/S5 保留**：`#s6-l2-badge`/`#s6-l2-note`/`#s5-values`/`data-invocation-diff`/`100 → 0`/第 2 次高亮/案例 A/B/L1 全部不动；只允许把 S6a 三段“异步/无调试/折叠/开销属 S6b”的绝对口径迁移为 `api.v1.md` §10.11 canonical（dispatch §4.5）。

## 3. 文件地图与归属（零交集）

| 路径 | owner | 本阶段动作 |
|---|---|---|
| `docs/contracts/{api.v1,event-model.v1}.md`、`fixtures/s6b-*/**`、`docs/plans/stages/S6/s6b-plan.md` | plan-writer | **已落盘**（§10；历史保留、仅加性） |
| `docs/plans/stages/S6/plan-review-s6b.md` | plan-reviewer | G1 只读复核（SHA256 清单 + `G1: PASS\|FAIL`） |
| `demo/.../service/{L2DemoService,NoDebugService}.java`、`.../controller/OrderController.java`、`demo/.../backend/pom.xml`、`demo/.../frontend/src/App.vue`、`agent/**` | coder-agent | §4/§5 |
| `workbench/src/**`（可新增 `s6/async.ts|no-debug.ts|fold.ts|canonical.ts`） | coder-workbench | §7 |
| `tools/verify/**`、`tools/perf/l2-overhead.mjs`、`S6/test-report-s6b.md` | tester | §9/§10 |
| `S6/{progress,s6-acceptance}.md`、`STAGE-PROGRESS.md`、`README.md`、`docs/plans/archive/stage-S6-*/`、git/tag | S6 acceptance | §15 |
| `schema/**`、`transport.v1.md`、`status-semantics.md`、S0–S6a fixture/文档、collector/SDK/build-plugin | 冻结 | **一律只读** |

## 4. Demo（coder-agent）

### 4.1 `L2DemoService#reconcileAsync(long)`（per-request 单线程池）

```java
public List<Double> reconcileAsync(long id) {
    ExecutorService pool = Executors.newFixedThreadPool(1);   // 单 worker：invocation 才会 1/2/3
    try {
        List<Future<Double>> futures = new ArrayList<Future<Double>>();
        for (int i = 1; i <= 3; i++) {
            final int invocation = i;
            futures.add(pool.submit(new Callable<Double>() {
                public Double call() { return Double.valueOf(reconcileAmount(id, 100.0d, invocation)); }
            }));
        }
        List<Double> results = new ArrayList<Double>();
        for (Future<Double> f : futures) { results.add(f.get()); }
        return results;                                       // [100.0, 0.0, 100.0]
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException(e);
    } catch (ExecutionException e) {
        throw new IllegalStateException(e.getCause());
    } finally {
        pool.shutdown();
    }
}
```

- 池在**请求线程内**、controller 帧打开后创建；worker 在第一次 `submit` 时构造，因此复制到已打开的 controller 帧。
- **禁止**固定 3 线程（每个 worker 各得 `invocation=1`）；**禁止** `CompletableFuture`/`@Async`/共享池。
- 值/线程事实见 §1 验收第 2 条；单 worker 顺序执行使 `values` 1/2/1 与 S6a 一致。

### 4.2 `L2DemoService#reconcileLoop(long,int)`（100 次 + 坏值）

```java
public double reconcileLoop(long id, int times) {
    int n = Math.max(1, Math.min(200, times));      // default 100 in controller; clamp 1..200
    double local = 0.0d;                            // init line: baseline null -> 0
    for (int i = 1; i <= n; i++) {
        local = local + 1.0d;                       // increment line (probe)
        if (i == 50) { local = 0.0d; }              // reset line: the anchor line gets the post-reset probe
        double anchor = local;                      // anchor line: reads local, never changes it (probe)
    }
    return local;                                   // single DRETURN; 100 iterations -> 50.0
}
```

- 观测约 **102** 次（基线 `null→0`、i=1..49 共 49 次增量、`49→50`、`50→0`、i=51 的 `0→1` 恢复、i=52..100 共 49 次增量到 50）；`times=5` → 6 次、不折叠。
- 锚点行是 reset 后 0 的**唯一可观测点**：reset 写在同一 `if` 行时，该行最后一条真实指令是 `dstore`（`if_icmpne` 在其前），
  探针落在**下一行（锚点）起点**并读到 0；若没有锚点行，循环体结束后没有前向行边界，reset 后的 0 就观察不到（这也是 dispatch 要求锚点语句的原因）。
  自检 **≥2** 个探针才安装；JDK8 `javap -l` 对该形状实测候选边界为 **4 个**（init 基线行/增量行/if 行/锚点行；`for` 行边界因前一条是 `if_icmpgt` 被跳过），S6B-C 只断言 ≥2 并从 `l2_probes_installed` 日志/字节码记录实际值，**不硬编码 3**；<2 → `l2_probe_missing` fail-open（见 D7/N1）。
- `id` 不用、无日志、无 DB；`reconcileBatch` 不动。

### 4.3 `NoDebugService` + antrun（无 LVT 构建）

```java
@Service
public class NoDebugService {
    public double compute(double amount) { return amount * 2.0d; }   // demo: 100 -> 200.0
}
```

- `demo/.../backend/pom.xml` 加 `maven-antrun-plugin` **3.1.0**，execution `no-debug-service`，phase **`process-classes`**（compile 之后、package 之前）：
  `javac srcdir=src/main/java destdir=${project.build.outputDirectory} includes=com/example/shop/service/NoDebugService.java debug="false" includeantruntime="false" source=1.8 target=1.8 encoding=UTF-8 fork=true executable=${java.home}/bin/javac`，
  classpath ref=`maven.compile.classpath`（保留 `@Service`）；仅覆盖该类 `.class`，不动源/其他类。
- 预检（§11）：`javap -l -p -classpath target/classes com.example.shop.service.NoDebugService` 无 `LocalVariableTable`/`LineNumberTable`；
  `L2DemoService` 的 `reconcileAmount/reconcileLoop` 仍有 `local:D`；从 Boot jar 解出 `BOOT-INF/classes/...NoDebugService.class` 复验；clean 构建可复现。
- 依赖预检：`maven-antrun-plugin:3.1.0` 本机有；`org.apache.ant:ant:1.10.12` 本机缺，首次构建需 Maven Central 正常解析；离线不可解析 → 停止上报，**不换镜像**、不跳过 no-debug。

### 4.4 `OrderController` 三方法（+ 构造器注入不变）

`@PostMapping("/{id}/reconcile-async") reconcileAsync(long)` → `l2DemoService.reconcileAsync(id)`；`@PostMapping("/{id}/no-debug") noDebug(long)` → `noDebugService.compute(100.0d)`；`@PostMapping("/{id}/reconcile-loop") reconcileLoop(long, @RequestParam(defaultValue="100") int times)` → `l2DemoService.reconcileLoop(id, times)`。
三者都 `200` + `{"data":...}`、任意 id 同形、不查库；既有 `list/cancel/previewDiscount/reconcile` 一行不改。

### 4.5 demo 前端（`demo/.../frontend/src/App.vue`）

- 新增 `#btn-reconcile-async`（`POST /api/orders/1/reconcile-async`）与 `#btn-reconcile-loop`（`POST /api/orders/1/reconcile-loop?times=100`），普通 click 处理（**不用 `wrapFn`**），展示响应原文；**不调用** `loadOrders`。
- no-debug 可仅端点（不强制按钮）；页头 banner 换为 §7 canonical `S6：...`（含“长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持”），案例 A/B/L1/S6a 的 DOM/函数/请求不变。

## 5. Agent（coder-agent）

### 5.1 `SpanContext`：InheritableThreadLocal + 深拷贝 + `ASYNC_INHERITED`

- `ThreadLocal<ArrayDeque<Frame>>` → `InheritableThreadLocal<ArrayDeque<Frame>>`；`childValue(ArrayDeque<Frame>)` 返回新栈，**逐帧深拷贝**：
  标量字段（kind/nodeKey/spanId/traceId/rootEventId/parentSpanId/startNs/root/confidence/exactLink/l2/invocationIndex/originThreadId）按值复制；
  `values`/`extraFlags`/`l2Previous`/`l2Values`/`childCallCounts` 各建新集合。子线程修改不回流请求线程。
- `Frame` 增 `final long originThreadId`（创建线程 id，= `Thread.currentThread().getId()`；继承副本保留原值）。
- L2/无调试子 span 的 enter：`if (Thread.currentThread().getId() != parent.originThreadId) frame.extraFlags.add("ASYNC_INHERITED")`；
  `enterL2` 的父帧仍是**栈顶 controller 帧**（副本），`invocation` 来自副本 `childCallCounts`；无可继承父帧 → 计 `l2_no_parent`、不压帧、不发事件。
- 子线程只弹自己的 L2 帧；副本 controller 帧永不 emit；原线程栈不受影响。
- **限制（写入契约/UI/README）**：仅“线程创建时”继承；启动期长生命周期池/已存在线程无请求上下文；复用旧 worker 可能带过期 trace（S6 不解决）；
  per-request 建池有线程创建开销；不声称 `@Async`/`CompletableFuture`/框架传播。

### 5.2 `L2ClassFileTransformer`：两方法、精确匹配、fail-open

- 精确类 `com.example.shop.service.L2DemoService`；目标方法 `reconcileAmount(JDI)D`（仍**恰 2 探针**）与 `reconcileLoop(JI)D`（自检 **≥2** 才安装；JDK8 `javap` 实测期望 **4**（init/增量/if/锚点），测试记录实际值、不硬断言；<2 → `l2_probe_missing` fail-open）。
- 复用两遍式 asm-tree：`ClassReader` 不带 `SKIP_DEBUG`、LVT inclusive start、行边界、跳过 jump/return/switch 结束行、帧内 `(frame,name)` 去重；
  每方法各自的 `enterNs/returnD` 槽与 catch-all；`DRETURN` 必须唯一。
- 任一类/方法/LVT/描述符/返回形状不符或 `Throwable` → **返回原始字节**（整类 fail-open，不半注入）并计数 `l2_no_method`/`l2_no_lvt`/`l2_transform_error`；
  安装成功记 `l2_probes_installed method=<m> offsets=<a>,<b>(,<c>) lines=<...>`。不可猜名/行。
- 仍 `addTransformer(new L2ClassFileTransformer(), false)`；Byte Buddy **显式 ignore** 该类。

### 5.3 `L2Values` 折叠（cap 20、首/尾/样本、坏值优先、计数可见）

- `MAX_ITEMS` 30 → **20**（L2 专用；L1 的 30 项预算不动）；新增 `Fold` 结果：`json`、`total`、`dropped`、`folded`。
- 折叠算法（序列 ≤20 原样返回；>20）：
  1. 先保留前 6 与后 6（原顺序）；
  2. 对中段 `[6, size-6)` 均匀取样补足 20；
  3. **优先保留第一条** `from != null && to == 0` 的坏值（若不在已选集合，替换掉一个中段样本；仍保持升序）；
  4. 输出按原观测索引升序，`from/to/line/invocation` 原样（**不重算**，中间被丢弃项不拼接）；
  5. `total=折叠前 size`、`dropped=total-20`；保留项 `truncated=false`。
- `SpanContext.exitL2` 用 `Fold` 决定事件：`folded=true` → `status=TRUNCATED` + `extraFlags` 加 `VALUES_CAPPED=<d>`、`VALUES_TOTAL=<t>`；
  否则 `status=OK`。`reconcileAmount`（1/2/1）与 `times≤~20` 的 loop 都不触发。
- 无静默丢弃：`values.length + dropped == total`；单 span 仍受 ≤64KB 旧约束（20 项远低于）。
- 语义注记（N4）：折叠是**列表级**，不是单值截断；`status-semantics.md` §3 的“值级 `truncated=true`”不适用于列表折叠（事件级 `TRUNCATED` + 保留项 `truncated=false`），`status-semantics.md` 字节不变。
- 单 worker 语义不变：`values[].invocation` 来自父帧副本计数（loop 单次 = 1）。

### 5.4 `NoDebugClassFileTransformer`（新，独立文件）

- 精确类 `com.example.shop.service.NoDebugService`、方法 `compute(D)D`；**LVT 缺失是预期路径**：只注入 enter（`System.nanoTime` + `SpanContext.enterNoDebug`）与 exit（`DSTORE`→`exitNoDebug(JD)`→`DLOAD`→`DRETURN`），
  catch-all → `exitNoDebugThrew(J)`；**无行探针、无变量名**。
- exit：`status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、flag `NO_DEBUG_INFO`、**valuesJson=null**、真实 return（double）；
  THREW → `THREW`、return=null、仍无 values；`source` 为 `null`/`line=null`（不伪造）。
- reason 逐字取 dispatch（`LocalVariableTable missing`），**不采用** `status-semantics.md` §6 示例 `nodebug:no_local_variable_table`；两者都满足 schema（“建议”形态），`status-semantics.md` 字节不变，验收报告注明该取舍（N3）。
- 若方法/描述符/单一 `DRETURN` 不符 → 返回原字节并计数；若**检测到 LVT**（`method.localVariables` 非空或存在 LineNumberTable）→ 记 `nodebug_lvt_present`、返回原字节、不插桩（S6B-B FAIL）。
- `TraceAgent` 显式 `.ignore` 该类；两个 ASM transformer 与 Byte Buddy 永不处理同一类。

### 5.5 `SpanEmitter` / flags / `TraceAgent` / advice

- `SpanEmitter` 新增 flags 常量 `ASYNC_INHERITED`、`NO_DEBUG_INFO`、`VALUES_TOTAL`；`emit` 已支持任意 `status`，需新增可选 `reason` 参数（仅 `NOT_COLLECTED_*` 写，`OK`/`TRUNCATED` 不写 reason）。
- 3 个 controller advice：`AsyncControllerAdvice`、`NoDebugControllerAdvice`、`LoopControllerAdvice`（enter/exit 包 `SpanContext.enterXxxController/exitXxxController`，header join 与 S6a 相同）；
  `TraceAgent` 在 `CONTROLLER_TYPE` 上追加 `.transform(advice(..., named("reconcileAsync").and(takesArguments(long.class))))` 等 3 条 → `.transform` **8→11**、`adviceClasses` **8→11**；Byte Buddy types 仍 **5**，`expectedShopClasses` **5→6**（+`NoDebugService`）。
- 既有 8 个 advice 与 S2/S3/S5 行为不动；jar 仍 major **52**，ASM 9.7 shaded/relocate 不变。

## 6. collector / graph（零改动）

- collector 不改一行：graph 节点仍固定 **15 字段**（`values`/`status`/`reason`/`flags` 原样，含 20 项折叠列表）、`events/seq/requests/replay`、meta 5 键、路由 9 条/错误码全部不变；`requests.backendSpanCount` async=4、loop/no-debug=2；`status` 聚合沿用既有优先级。
- ingest 只做 schema 校验（新 flag 是既有字符串）；不重算折叠、不重新采样、不排序、不合并节点。

## 7. 工作台（coder-workbench）

- 新增 `workbench/src/s6/canonical.ts`（单一来源）：`S6_BANNER`、`S6_L2_NOTE`、`S6_XN_NOTE`、`S6_NO_DEBUG_NOTE`、`FOLD_NOTE_TEMPLATE`，逐字取 `api.v1.md` §10.11；`App.vue`/`S3Panel.vue`/`s4/derive.ts`/`S4DetailPanel.vue` 改引用，旧 S6a 三段文案从 src+dist 移除。
- `s6/async.ts`：`ASYNC_FLAG`、`ASYNC_BADGE_TEXT="异步继承"`、`hasAsyncInherited(node)`（**只认 flag**，禁止 nodeKey/thread 推断）。
- `s6/no-debug.ts`：`isNoDebugNode(node)`（`status === "NOT_COLLECTED_NO_DEBUG_INFO"`）、`noDebugReason(node)`（取事件 `reason`；缺失 → `未采集（无 reason）`）。
- `s6/fold.ts`：解析 `VALUES_CAPPED=<n>`/`VALUES_TOTAL=<m>`（n>0 且两者齐备才有效）；`foldNote(node)` → 逐字 `已折叠 N 次（VALUES_CAPPED=N；共 M 次）`，否则 `null`。
- `S4DetailPanel.vue`：`#s6-async-badge` 仅 async 节点；`#s6-no-debug-badge` + `#s6-no-debug-reason` 仅 no-debug 节点（沿用灰色 `notcollected`，reason 取事件，不是成功色）；`#s6-fold-note` 仅 cap 节点；
  S6a 的 `#s6-l2-badge`/`#s6-l2-note`/local 行/`100 → 0`/`data-invocation-diff` 与 S5 的 `#s5-*` 全部保留；无 flag 不显示折叠/异步/无调试文案。
- **测试分层**：dist 只断言静态 token（选择器名、`已折叠`、`VALUES_CAPPED`、`共`、canonical 三段、S5/S6a 选择器）；
  条件性由 `workbench/src/s6/**` 纯函数对 fixture 断言 + S6B-A/B/C 运行时 values + 浏览器 DOM 证据证明，不把“dist 有 token”写成“条件性已证明”。
- 禁止：改 collector/demo/agent/契约/fixture；发写请求；用 nodeKey 硬编码；宣称异步全量传播/行级字段/对象深采/开销达标。

## 8. 性能脚本设计（tester，`tools/perf/l2-overhead.mjs`）

- 复制 `l1-overhead.mjs` 骨架：collector 8601 + demo 8080；**base** 无 agent、**agent** 有 agent（session `s_s6bperf`）；两侧各 warm-up ≥20、N=100、rounds=3。
- 请求 `POST /api/orders/1/reconcile`（3 次 `reconcileAmount` = L2 探针路径）；校验 body 恰 `{"data":[100.0,0.0,100.0]}`。
- 统计：每轮 nearest-rank p50/p95 → 跨轮 median；`ratio=median(agent p50)/median(base p50)`；输出 `PERF_RESULT:{...}`（含原始 rounds、ratio、warn、`reportOnly:true`）。
- **report-only**：ratio>**1.40** 只写 WARN，不 FAIL、不删慢样本、不改阈值、不冒充“达标”；`finally` 停进程/清端口/删临时目录；agent 事件必须 >0 且至少 1 条 `flags` 含 `L2`（证明 L2 链路真的跑过），否则 exit 1。
- 参数 `--n/--warmup/--rounds/--port/--collector-port`；端口占用先诊断，不静默改。

## 9. 测试计划（S6B-A..F；一次命令、串行起停、`finally` 清理）

| 组 | 断言要点 |
|---|---|
| **S6B-A** async | 前置 build/artifact（agent 52/shaded ASM、demo JDK8、antrun、workbench）。collector+demo+agent（`s_s6b`，带 `traceparent`/`X-TraceBoard-Click`）：async 200 `[100.0,0.0,100.0]`；**浏览器链总 span 6 / 后端 4**（`requests.backendSpanCount=4`，不把 4 当总 span，N11）；3 service 同 nodeKey/parent=controller/`startNs` 升序/return 100/0/100/`invocation` 1..3/values 1/2/1 且第 2 次 `100→0`；3 service `thread.id` 相同且 ≠ controller，flags 含 `L2`+`ASYNC_INHERITED`（无 `L1`/`LOST_BACKEND`）；**无头 curl（不带 headers）为合法 4 span LOST 子链**：后端仍 4 span、3 service 仍带 `ASYNC_INHERITED`、controller `LOST_BACKEND`（N6）；同步 reconcile 4 span **无** ASYNC；collector 停后端点仍 200；无 VerifyError；日志 `l2_probes_installed method=reconcileAmount` 恰 2 探针 |
| **S6B-B** no-debug | `javap -l`：NoDebugService 无 LVT/LineNumberTable（有则 FAIL）、L2DemoService 仍有 `local:D`、Boot jar 内类复验；**`javap -v` 复验无 `SourceFile`**，或明确“`source` 缺失/`line=null` 由事件断言证明、不依赖 `javap -l` 显示”（N12）；端点 200 `{"data":200.0}` 任意 id；agent 事件恰 2 span；service `status/reason/flag` 精确、无 `values`、无行号伪造；日志无 `nodebug_lvt_present`；DB amount 100/CREATED；schema 合法 |
| **S6B-C** 循环折叠 | `?times=100` 200 `{"data":50.0}`；2 后端 span；loop span `status=TRUNCATED`、flags `L2`+`VALUES_CAPPED=<d>`+`VALUES_TOTAL=<t>`、`t>20`、`d=t-20`、`values.length=20`、首项 `from=null`、末项 `to=50`、存在 `to=0`、保留项 `truncated=false`、无静默丢弃；`times=5` 不折叠（`OK`、无 cap flag、≤6 项）；`reconcileAmount` 1/2/1 逐字不变；无 DB；日志 `l2_probes_installed method=reconcileLoop` 记录**实际探针数（JDK8 实测 4：init/增量/if/锚点；断言 ≥2 且无 `l2_probe_missing`，不硬编码 3，见 D7/N1）** |
| **S6B-D** 性能 | 运行 `l2-overhead.mjs`（N=100、warmup≥20、rounds=3）：base/agent p50/p95、ratio、agent L2 事件>0；ratio>1.40 只 WARN；脚本 exit 0；报告记录原始数字与 WARN，不删样本/不改阈值；无残留进程/端口 |
| **S6B-E** 回归/冻结 | 全量 S0–S6a 锚点 PASS；案例 A/B、L1 5 值、S6a 4-span/×3/1/2/1、EXACT、回放 0 写、S2 LOST 不变；schema/transport/status/S0–S6a fixture 字节零漂移；`S5_G1_FREEZE`(18)/`S6A_G1_FREEZE`(8)/`S6B_G1_FREEZE`(14) 按 §10 supersede 零漂移；graph 15 字段；collector 零 diff |
| **S6B-F** scope/UI/cleanup | workbench build；静态 token：`s6-async-badge`/`s6-no-debug-badge`/`s6-no-debug-reason`/`s6-fold-note`/`已折叠`/`VALUES_CAPPED`/`共`+S6 canonical；纯函数/fixture 断言仅 ASYNC flag 节点、仅 no-debug 状态、仅 cap 节点显示；S6a/S5 选择器保留；旧 S6a 口径零命中；无行级字段/对象深采/多方法/框架传播宣称；无 secret/CDN/镜像；端口 8601/8080/5173/5174/8602/18080 无监听、无 java/node 残留、git index 未动 |

## 10. 门禁迁移与冻结（tester 必做，不放宽其余断言）

- **新增 `S6B_G1_FREEZE`（14 项）**：`docs/contracts/api.v1.md`、`docs/contracts/event-model.v1.md`、`fixtures/s6b-async/{events.ndjson,expected-facts.json,README.md}`、`fixtures/s6b-no-debug/{…}`、`fixtures/s6b-loop/{…}`、`docs/plans/stages/S6/{s6b-plan.md,dispatch-s6b.md,plan-review-s6b.md}`（哈希取 G1 实测值）；第 14 项 `plan-review-s6b.md` 由 tester 在本文件最终落盘后计算写入，**不写占位值、不跳过**（N10）。
- `LATEST_G1_FREEZE = { ...S5_G1_FREEZE, ...S6A_G1_FREEZE, ...S6B_G1_FREEZE }`；api/event-model 取 **S6b 哈希**（S5/S6a 旧值被 supersede）；`S5_G1_FREEZE` **18 项集合/数量**保留（schema/transport/status/S0–S5 fixture 等 16 项仍 S5 字节）；
  `S6A_G1_FREEZE` 8 项中 api/event-model 由 S6B 覆盖，其余 **6 项**（S6a fixture 3、s6a-plan、dispatch-s6a、plan-review-s6a）按 S6a 哈希零漂移；S2-L/S3-2/S4-H/S5-G/S6A-E 统一用 `LATEST_G1_FREEZE`。
- `S6A-E`（`11594–11615`）：expected 改 `LATEST_G1_FREEZE[rel]`；保留 `Object.keys(S6A_G1_FREEZE).length===8` 与 6 项实际零漂移；label 改 “api/event-model superseded by S6b”（N9）。
- `S2-8`：`.transform` **8→11**、`adviceClasses` **8→11**（3 controller advice）、`expectedShopClasses` **5→6**（+`NoDebugService`，label 同步）；`agentTargets` 保持 5；新增 `NoDebugClassFileTransformer.java` 允许 LVT/no-debug 术语；`L1Values.java` 仍禁 `"local"`、`getMessage()` 仍禁。
- `S3-8`/`S4-I`/`S5-H`：放行 `async`/`NO_DEBUG`/`fold`/`VALUES_CAPPED`/`VALUES_TOTAL`/`l2-overhead` **仅限**：agent 的 S6b 文件（`SpanContext`/`L2Values`/`SpanEmitter`/`TraceAgent`/`L2ClassFileTransformer`/`NoDebugClassFileTransformer`）、`workbench/src/s6/**`、`NoDebugService.java`、`docs/plans/stages/S6/**`、`fixtures/s6b-*/**`、`tools/perf/l2-overhead.mjs`。
  **`L2/local` 与 `async-continuation`（`AsyncContext|CompletableFuture|setTimeout(\s*span|continuationSpan|async_hooks`）对非白名单文件仍全域禁**；其余 marker（SSE/WS/Tomcat/cloud/react/持久化/像素/字段行级/runtime-x3）同样全域禁；label 改 “S6b allowed only in the S6b files; no async frameworks/field-line/deep-object”；git 白名单同步（B2-3）。
- **S6a 旧文案迁移（B1；旧三段在 workbench/src、workbench/dist、demo frontend/src、demo dist 零命中）**：
  - 常量：`verify.mjs:449–455` 的 `S6A_BANNER`/`S6A_L2_NOTE`/`S6A_XN_NOTE` 改名为 `S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE`，逐字取 §7 `s6/canonical.ts`（即 `api.v1.md` §10.11：banner 含“长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持”，L2 说明含 reconcileLoop 折叠，×N 注记含 reconcileAsync）；旧 S6a 三段只作为 `S5_STALE_TEXTS` 反向字面量，**不得被任何正向 token 引用**。
  - `S6A-B`（`verify.mjs:11040`）：`appSource.includes(S6A_BANNER)` → `appSource.includes(S6_BANNER)`，label “S6a banner present” 改 “canonical S6b banner present”；保留 `#btn-reconcile`、`fetch("/api/orders/1/reconcile", { method: "POST" })`、plain handler、无 `wrapFn`、无 `loadOrders`；新增 `id="btn-reconcile-async"`/`id="btn-reconcile-loop"` 与对应 fetch 静态 token；端点清单断言改 list/cancel/preview-discount/reconcile + reconcile-async/no-debug/reconcile-loop（**恰 7 个**映射），**删除“其余断言不变”**；新服务仍无 DB。
  - `S6A-D`（`449–455`、`11477`）：`S6A_WORKBENCH_TOKENS` 中三个旧文案 token 替换为 `S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE`；**保留** `s6-l2-badge`/`s6-l2-note`/`data-value-kind`/`data-invocation-diff`/`行号 `/`100 → 0`/`值变化`；label 改 “canonical S6b banner/L2/×N + retained S6a selectors”；`S6A_EVIDENCE.workbench.tokens`（`11560`）取迁移后数组长度。新增 UI token（`s6-async-badge`/`s6-no-debug-badge`/`s6-no-debug-reason`/`s6-fold-note`/`已折叠`/`VALUES_CAPPED`/`共`）只在 `S6B-F` 断言，**不回填 S6A-D**（S6a 门禁不冒充 S6b 能力，也不与旧三段零命中冲突）。
  - `S3-1`（`5520–5533`）`demoTokens`：S6a banner 替换为 `S6_BANNER`；字面 token `"S6a"` 改 `"S6"`（不以“其余 token 保留”保留 `"S6a"`）；`"L2"`/`#btn-reconcile`/`reconcileAmount`/`reconcileBatch`/`__TRACEBOARD_MANIFEST__` 保留，追加 `btn-reconcile-async`/`btn-reconcile-loop`。
  - `S3-6`（`verify.mjs:218`）、`S4-F`（`277`）、`S5-D`（`9453`）、`S5-E`（`9624`）：统一换 `S6_BANNER`；`S4_RUNTIME_X3_NOTE` 换 `S6_XN_NOTE`；`100 → 0`、`第 1/1 次`、manifest、`#btn-discount` 等其余 token 保留。
  - 源码侧：`workbench/src/s6/l2.ts` 的 `S6A_*` 删除或改为 `s6/canonical.ts` re-export；`workbench/src/App.vue`、`components/S3Panel.vue`、`components/S4DetailPanel.vue`、`s4/derive.ts`、`demo/.../frontend/src/App.vue` 全部引用 canonical。
  - `S5_STALE_TEXTS`（`376–384`）：追加**旧 S6a 三段全文**（banner、L2 说明、×N 注记）；`无异步/×3`、`无构建期局部变量/L2` **已在数组内，不重复追加**（N13）；扫描范围（workbench/src、workbench/dist、demo frontend/src、demo dist）不变。
- **禁项只增不减（B2）**：
  - `S5_FORBIDDEN_CLAIMS`（`385`）：**追加** `异步全量传播`/`线程池自动传播`/`无调试可采变量`/`循环全量`/`开销达标`/`L2 开销 ≤40%`；**保留** `kind=local`/`L2 已采集`；断言 `length >= 8` 且包含原 2 条 + 新 6 条。
  - `S6A-E`（`11688–11690`）：`claimTexts` 原 6 条（`异步上下文已采集`/`无调试信息已处理`/`循环折叠已实现`/`L2 开销 ≤40%`/`全部方法 L2`/`L2 已采集`）**保留**；新增 S6b 白名单**只对 `scopeFiles` 的 `s6bHits` 做路径豁免**，不删除/改写任何 claim 文本；label 同步。
  - `S6B-F`：增“禁项只增不减”断言（`S5_FORBIDDEN_CLAIMS.length >= 8` 且含 8 条；S6A-E 6 条 claim 常量仍存在），并断言旧 `S6A_*` token 不再被任何门禁正向引用。
- `S5 L1 文案`（N5）：`S5 L1：…本阶段未采集` 是 `api.v1.md` §10.9 冻结的 S5 阶段标签（S5-D 断言），**S6b 不迁移**（不改 §10.9、不弱化 S5-D token）；在 `s6-acceptance.md` 注明“S5 阶段标签，不代表 S6b 未采 L2”。
- 不变：S2-3 4-span LOST、S3-3 EXACT、S3-4/5 回放 0 写、S4-F 15 字段、S5-B/C、S5 perf report-only、S6a 1/2/1+×3。

## 11. 精确命令（仓库根、全双引号）

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
export JAVA21="C:/Program Files/Java/jdk-21"
export JAVA8="C:/Program Files/Java/jdk1.8.0_221"

# 构建（collector 先于启动；agent 含 ASM shade；demo JDK8 + antrun；workbench）
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/collector" -am
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "agent" -am
JAVA_HOME="$JAVA8"  mvn -B -q -DskipTests clean package -f "demo/buggy-shop-boot-vue/backend/pom.xml"
(cd "workbench" && npm ci && npm run build)

# 依赖预检（N7）：antrun 本机有、Ant 首次在线解析；离线不可解析即 STOP，不换镜像
ls ~/.m2/repository/org/apache/maven/plugins/maven-antrun-plugin/3.1.0 >/dev/null 2>&1 || echo "antrun missing -> online"
ls ~/.m2/repository/org/apache/ant/ant/1.10.12 >/dev/null 2>&1 || echo "ant 1.10.12 missing -> online resolve; offline => STOP"

# S6B-B 预检：无 LVT / L2 仍有 local:D / Boot jar 内类复验
"$JAVA8/bin/javap" -l -p -classpath "demo/buggy-shop-boot-vue/backend/target/classes" com.example.shop.service.NoDebugService
"$JAVA8/bin/javap" -l -p -classpath "demo/buggy-shop-boot-vue/backend/target/classes" com.example.shop.service.L2DemoService
"$JAVA8/bin/jar" tf "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" | grep -E "shaded/org/objectweb/asm|org/objectweb/asm"

# collector 8601 + demo/agent（session s_s6b）
"$JAVA21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
"$JAVA8/bin/java" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s6b \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &

# 三个端点（任意 id 同形；times=5 对照不折叠）
curl -s -X POST "http://localhost:8080/api/orders/1/reconcile-async"
curl -s -X POST "http://localhost:8080/api/orders/999/reconcile-async"
curl -s -X POST "http://localhost:8080/api/orders/1/no-debug"
curl -s -X POST "http://localhost:8080/api/orders/1/reconcile-loop?times=100"
curl -s -X POST "http://localhost:8080/api/orders/1/reconcile-loop?times=5"
curl -s -X POST "http://localhost:8080/api/orders/1/reconcile"     # S6a 1/2/1 不变
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s6b/events?afterSeq=0&limit=500"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s6b/requests"

# fixture 独立校验（离线，Ajv 2020 strict；三个目录都跑）
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const ajv=new Ajv({strict:true,allErrors:true});
const v=ajv.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));
for (const dir of ['s6b-async','s6b-no-debug','s6b-loop']) {
  const ls=fs.readFileSync(`fixtures/${dir}/events.ndjson`,'utf8').trim().split('\n');
  let n=0; ls.forEach((l,i)=>{if(v(JSON.parse(l)))n++;else{console.error(dir,i+1,JSON.stringify(v.errors));process.exitCode=1;}});
  JSON.parse(fs.readFileSync(`fixtures/${dir}/expected-facts.json`,'utf8'));
  console.log(dir,'lines',ls.length,'schema ok',n);
}
EOF

# 性能（report-only；ratio>1.40 仅 WARN）
node "tools/perf/l2-overhead.mjs" --n 100 --warmup 20 --rounds 3

# 门禁（一次命令覆盖 S6B-A..F + S0–S6a 全回归）
(cd "tools/verify" && npm ci && node verify.mjs)
```

环境：JDK8 `C:/Program Files/Java/jdk1.8.0_221`（demo 构建/运行）、JDK21 `C:/Program Files/Java/jdk-21`（agent/collector/launcher/root 构建；**agent 构建用 JDK21、target 8/major 52，测试不得要求 agent 用 JDK8**，N8）、Node 22.x/npm 10.x、Maven 3.9.5；ASM 9.7（class major 49）；`maven-antrun-plugin:3.1.0` 本机有、`org.apache.ant:ant:1.10.12` 首次构建在线解析；antrun 的 `executable=${java.home}/bin/javac` 需实测 Windows 空格路径（`C:/Program Files/...`），不可用即按 dispatch §8 停止上报（compiler-plugin 二次执行需 dispatcher/acceptance 书面批准，验收口径不变：无 LVT/LineNumberTable/SourceFile，`L2DemoService` 仍有 `local:D`）；端口 8601（仅 127.0.0.1）/8080/5173/5174/8602/18080；分支 `master`、无 remote；仅 acceptance 写 git。

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| **InheritableThreadLocal/线程池**：仅创建时继承；长生命周期池/复用 worker 带过期 trace；per-request 建池开销 | demo 严格 per-request 单线程池；`childValue` 深拷贝防串写；过期/未继承计 `l2_no_parent` 不发假 span；契约/UI/README 明写限制；不声称框架传播 |
| **antrun javac**：`debug=false` 被后续 compile 覆盖；ant 1.10.12 本机缺失；单文件类路径/注解丢失 | execution 固定 `process-classes`；仅 include 该类、classpath=`maven.compile.classpath`；`javap -l` + Boot jar 复验 + clean 构建；离线不可解析即停止，不换镜像 |
| **ASM no-LVT**：无 LineNumberTable 的探针/return 形状漂移 → VerifyError 或静默不插桩 | no-debug 只注入 enter/exit；精确类/方法/描述符/单 DRETURN 校验；异常返回原字节计数；LVT 存在即 `nodebug_lvt_present` 并 FAIL；启动即验证无 VerifyError |
| **折叠计数**：探针布局/去重导致 total 不符；坏 0 被折叠；静默丢项；探针数写死 | 测试用 times=100/5 对照并断言 `t>20`、`d=t-20`、`length=20`、坏 0 保留、首尾保留；`VALUES_TOTAL` 取折叠前真实项数；UI 同屏 total/capped；不硬编码 total；探针数不硬编码（JDK8 实测 4、≥2 安装并以日志记录，N1） |
| **perf 方差**：Windows/JIT/H2/线程创建噪声导致 ratio 抖动；误当门槛/造假 | report-only、warm-up、3 rounds median、N=100、固定脚本；>1.40 仅 WARN；保留原始样本与 WARN；不删慢样本/不调阈值/不宣称达标 |
| 其他：S6a/S5 回归、G1 漂移、UI 夸大、secret/CDN | 全量 S0–S6 回归 + LATEST freeze；canonical 限定能力；UI 反向断言；扫描 secret/CDN/镜像；端口/进程清理 |

## 13. 停止条件

1. 必须改 schema/事件类型/status 枚举/transport，或必须实现行级字段写入/对象深采/多方法/框架续体才能达标。
2. 必须让 no-debug 类保留 LVT、猜变量名，或让异步在长生命周期池中“自动传播”才能达标。
3. ASM/antrun 无法 fail-open（VerifyError/类加载不可控），或必须关闭既有 Byte Buddy advice。
4. 必须引入真实 secret/PII/CDN/镜像/外部网络，或改他人路径/冻结文件。
5. G1 FAIL 且一轮返工仍 FAIL；测试未绿但 owner 想“先提交/tag”。
6. S6b 只证明“新建线程继承 + 无调试降级 + 折叠计数 + 开销报告”；不得宣称 S6 覆盖行级字段写入/对象深采/多方法/全量异步，不得打 tag 前跳过浏览器/全量门禁。

## 14. 偏离记录

| # | 摘要说法 | 实际执行 | 依据 |
|---|---|---|---|
| D1 | 早期摘要（笔误）写 `L2Values` cap 20“前 10 + 后 5 + 样本”（无任务卡原文，N2） | **前 6 + 后 6 + 中段样本补足 20**，坏值优先 | dispatch §3（binding）逐字；主计划 §9.2“保留首/尾/样本”；G1 只认 dispatch |
| D2 | 早期摘要（笔误）写 loop fixture “truncated true”（未找到任务卡原文，N2） | 事件级 `status=TRUNCATED`；**保留项 `truncated=false`** | dispatch §3“保留项 truncated=false（真值未截断，列表被折叠）”；item 级 `truncated` 不等于折叠 |
| D3 | dispatch §4.1 “async 恰 4 span / loop 恰 2 span” | fixture 为浏览器链（async 6 事件、loop 4 事件），`backendSpanCount` 仍是 4/2；no-debug 为 2 事件 endpoint-only 链 | 单一根 + `confidence=EXACT` 不变量；no-debug 无强制按钮，不虚构 click；脚本无头变体在 expected-facts 注明 |
| D4 | `status-semantics.md` 示例 reason `nodebug:no_local_variable_table` | 逐字 `LocalVariableTable missing`（dispatch 固定值）；两者均满足 schema“建议”形态，契约字节不变，验收报告注明取舍（N3） | dispatch §1/§3/§4.3；S6b 以 dispatch 为准 |
| D5 | fixture README “不含 s_s3demo” | 三个 S6b 会话为 `s_s6basync`/`s_s6bnodebug`/`s_s6bloop`；运行时会话 `s_s6b`/`s_s6bperf` | dispatch §12；不改 S3 demo 会话 |
| D6 | `NoDebugService#compute(D)D` | 描述符 `(D)D`（double 入参/返回） | dispatch §3/§5.3；方法名/形状一致 |
| D7 | loop 探针“≥2 才安装，demo 期望 3” | 自检 <2 → `l2_probe_missing` fail-open；JDK8 `javap` 实测 **4**（init/增量/if/锚点），测试只断言 ≥2 并记录实际值（N1） | dispatch §5.5/§3；探针数以日志/字节码为准，不硬编码 |
| D8 | dispatch §12 括注 “JDK8（demo/agent）” | 沿用 S6a 实测：agent 用 **JDK21** 构建（jar major 52、shade/relocate 不变），demo 用 JDK8 | `s6a-plan.md` §10 与 S6a 测试报告；dispatch §12 的括注是环境清单，不改写命令 |
| D9 | `status-semantics.md` §3“值级 `truncated=true`” | S6b 用**事件级** `TRUNCATED` + `VALUES_CAPPED`/`VALUES_TOTAL`，保留项 `truncated=false`（列表折叠≠单值截断） | `event-model.v1.md` §4.4.10；N4；不静默丢弃 |

## 15. S6 最终验收 / 备份 / tag（acceptance 卡）

- 产物：`S6/progress.md`（`CHECKPOINT: S6`、`STATUS: done`、EVIDENCE/CHANGED/RISK/NEXT: S7）、`S6/s6-acceptance.md`（S6a+S6b 清单、命令、perf 原始数字、限制）、`S6/evidence/*.png`（async/no-debug/fold 浏览器证据）、`STAGE-PROGRESS.md` S6 ✅、`README.md` 能力/限制、`docs/plans/archive/stage-S6-<日期>/`（MANIFEST+SUMMARY+README+docs 快照）。
- 门槛：亲自复跑 S6B-A..F 与全量 S0–S6 exit 0；S6A/S6B G1 哈希不变；S6a/S5 零回归；perf 报告原样；README/验收如实写“行级字段写入/对象深采/多方法/长生命周期池传播未支持”。
- 报告注记（N3/N5/N8）：reason 用 dispatch 逐字值（非 `status-semantics.md` 示例形态，契约字节未变）；`S5 L1…本阶段未采集` 是 S5 阶段标签，不代表 S6b 未采 L2；agent 构建 JDK21/target 8（major 52），demo 构建/运行 JDK8。
- 仅 acceptance 写 git：commit + tag `s6-baseline`；不 push/force/rebase；未绿不 tag；fixture 不当运行时证据。

## 16. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-24 | 首版：async per-request 单线程池 + InheritableThreadLocal 深拷贝/`ASYNC_INHERITED`、NoDebugService antrun `debug=false` + 无 LVT transformer + `NOT_COLLECTED_NO_DEBUG_INFO`、reconcileLoop 100 次 + L2Values cap 20（首/尾/样本/坏值）+ `TRUNCATED`/`VALUES_CAPPED`/`VALUES_TOTAL`、3 端点/3 advice/2 transformer、S6b fixture/工作台/perf、S6B-A..F 与 S6 验收/tag。 |
| v1.1 | 2026-11-24 | G1 FAIL 返工第 1 轮（对 `plan-review-s6b.md` B1/B2/N1–N13）：§10 写死 S6A-B/S6A-D/S3-1 旧 S6a 文案精确迁移（`S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE`，旧三段仅作 stale 反向字面量、`"S6a"`→`"S6"`）、`S5_FORBIDDEN_CLAIMS` 追加 6 条并**保留**原 2 条、S6A-E 6 条 claim 保留、S3-8/S4-I/S5-H 白名单收紧（`async-continuation` 仍全域禁）、S6B-F 禁项只增不减；loop 探针改实测 **4**（S6B-C 记录实际值、不硬编码 3）；N2–N13 记录（D1/D2 措辞、D4/D9 理由与折叠语义、S5 L1 标签、无头 4-span 变体、Ant 预检、JDK21/8、freeze label、自哈希、SourceFile、stale 去重）。 |