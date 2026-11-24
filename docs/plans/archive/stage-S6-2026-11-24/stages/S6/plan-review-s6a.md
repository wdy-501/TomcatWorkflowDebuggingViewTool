# S6a 计划审阅（plan-review-s6a）

> 角色：PLAN-REVIEWER（G1，只读）｜日期：2026-11-23｜对象：`docs/plans/stages/S6/{dispatch-s6a.md,s6a-plan.md}`、`docs/contracts/api.v1.md` S6a/附录 F/§10.10、`docs/contracts/event-model.v1.md` §4.4.7/§7/§9/§11、`fixtures/s6-l2-lines/**`、S5 G1 冻结、当前 `agent/`/`demo/`/`workbench/`/`tools/verify/`。
> 输出路径说明：dispatch §5.2 写的评审输出名为 `plan-review.md`；本卡指定 `plan-review-s6a.md`，本文件按本卡路径输出（见 N9）。G1 冻结时请登记实际文件名。
> **结论：G1: FAIL**（Blocking 6 / Non-blocking 13；均为文档、门禁迁移与一处 LVT 边界/测试表达澄清，未触及 S6a 范围与契约形状，一轮可关闭）。
>
> **复评 2026-11-23（G1 第 2 轮）**：**G1: FAIL**。B4/B5/B6 已关闭；B1/B2/B3 仍各有 1 处门禁残留（B7–B9，见 §8）。§1–§7 为第 1 轮记录，保留不改。
> **最终复评 2026-11-23（G1 第 3 轮，s6a-plan v3）**：**G1: FAIL**。B7/B9 已关闭；B8 未关闭（S3-1 保留旧 S5 banner token 与 canonical 迁移/stale 反向断言互斥，见 §9）。
> **G1 收尾复评 2026-11-23（第 4 轮）**：**G1: PASS**。B8 已关闭，剩余 Blocking **无**；全部结论以 §10 为准（§1–§9 保留为历史）。

## 1. 总结

S6a 的范围、demo/端点、event-model 语义、fixture、ASM/Byte Buddy 设计与 S6b 边界整体成立；`fixtures/s6-l2-lines` 实测 6/6 Ajv 2020 strict 通过，链、值、×3、区间、flags 均与契约一致；schema 字节与 S0–S5 fixture 零漂移。**FAIL 的原因不在 S6a 设计方向，而在“门禁迁移/冻结”与两处表达精度**：S5-G 冻结与 api/event-model 必须修改互相矛盾；S3-6/S4-F/S5-D/S5-E 的旧文案 token 与 S2-8/S3-8/S4-I/S5-H 的 L2 标记扫描未列入迁移；S6A-D 把 Vue 动态属性当成 dist 静态字面量；`from != to` 在 `from=null` 时会误判；LVT 活性范围起点未写清（javac8 下初始化探针恰好落在 LVT start）。

## 2. PASS/FAIL 表

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 范围仅 S6a：单方法行级 local + 逐次 ×3；异步/无调试/预算/折叠/开销留 S6b；S6 仍 partial、不打 tag | PASS | `s6a-plan.md` 24–28、298–301；`dispatch-s6a.md` 5、188–193、216–223；`api.v1.md` §2.6；`event-model.v1.md` §9 S6a 边界 |
| 2 | Demo 附录 F：任意 id `200 {"data":[100.0,0.0,100.0]}`、未知 id 同形、纯计算无 DB；`reconcileBatch` 不插桩 | PASS | `api.v1.md` 1341–1362；`s6a-plan.md` 42–110；附录 D/B 不改写 |
| 3 | collector 路由/meta/graph 15 字段/无 schema 变更 | PASS | `api.v1.md` 187–208、630–635；`schema` SHA256 `927937df…a489a` 未变；`git status` 无 `schema/`、`transport/status` 变更 |
| 4 | `values` 仅 `kind=local`、`line` 1-based、`from→to`、`invocation` 1..3、L2 flag、无 L1/param/field/return | PASS | `event-model.v1.md` 221–258、306–329；`api.v1.md` 1154–1183；fixture 4–6 行 |
| 5 | S6b 边界：无 async/NO_DEBUG/降级事件/行级 field/预算/L2 开销宣称 | PASS | `s6a-plan.md` 27–28、301；`event-model.v1.md` 360–362；`api.v1.md` 208；fixture README 53–61 |
| 6 | fixture 6 事件 schema 合法（Ajv 2020 strict 离线） | PASS | 实测 `lines 6 schema ok 6`（`tools/verify/node_modules/ajv`，无网络/新依赖） |
| 7 | fixture 链/×3/值/返回/区间：click→fetch→controller→3 同 nodeKey service；inv 1/2/3；1/2/1 项；第 2 次 100→0；returns 100/0/100；区间嵌套；flags L2 | PASS | 实测 service=3、parent=controller、startNs 严格递增、`[1,2,1]`、`[100,0,100]`、第二项 `[22→24, null→100, 100→0]`；无区间违规；`flags` 含 `L2` |
| 8 | expected-facts/README：13 facts、graph 6/5/15 键、请求 1 行 EXACT/6 span/fetch=1/backend=4、README 首段逐字、测试数据非运行时、无 secret/无 s_s3demo | PASS | `expected-facts.json` 128–350；README 首段逐字 `dispatch` 4.6；`grep s_s3demo` 无；secret 正则无命中；fixture 仅测试数据 |
| 9 | ASM 9.7 专用 transformer 精确 `L2DemoService#reconcileAmount`；enter/exit/catch-all；Byte Buddy `ReconcileControllerAdvice`；组合/ignore/fail-open；不假设无 VerifyError | PASS | `s6a-plan.md` 112–161；`~/.m2` 三件 9.7 存在、ASM class major 49（实测 `javap`）；现有 `TraceAgent` 5 类型/7 advice、`SpanContext`/`SpanEmitter`/`RequestHeaders` 结构可扩展；风险/停止条件 262–284、`dispatch` 203–223 |
| 10 | LVT 槽/行探针/行号：活性范围、每行边界、同一偏移一次、`local:D`、行号重算 | **FAIL（B4）** | `s6a-plan.md` 134–140；JDK8 可行性探针见 B4：`local` LVT `Start 3 Length 12 Slot 6 D`，初始化探针偏移恰为 LVT start；计划未写 inclusive 起点，排他实现会丢掉初始化探针 |
| 11 | invocation 序号挂父 controller 帧、帧内 previous 去重、所有 return exit、catch-all THREW、不误弹 controller | PASS | `s6a-plan.md` 142–149；`event-model.v1.md` 231–232；D3 为**必要**偏离（见 §4）：line 11 探针与 `if` 跳转目标同偏移，非 2 路径也会执行；frame+name 去重恰好得到 1/2/1 |
| 12 | demo：`L2DemoService`/`reconcileBatch`/`OrderController#reconcile`/`#btn-reconcile`；不改案例 A/B/L1；无 DB | PASS | `s6a-plan.md` 42–110；现有 `OrderController` 仅 list/cancel/previewDiscount（`OrderController.java` 34–75）；`App.vue` 现有 `#btn-cancel/#btn-save-b/#btn-discount`；新增独立 `L2DemoService` 可行 |
| 13 | 工作台：L2 徽标仅 flag、local 行 `行号 N`/`100 → 0`、×3 第 2 次高亮、非 L2 不宣称、S5 保留 | **FAIL（B5/B6）** | `s6a-plan.md` 169–176；现有 `S4DetailPanel.vue` 296–304 `:data-value-kind` 动态、338 `lineFooterText`/`invocationText` 动态；`s5/values.ts` 仅 `field` 做 from→to、`isFieldDiff` 有非空守卫；S6A-D 的静态字面量断言不可实现（B6） |
| 14 | S6A-A..E 覆盖 build/ASM 产物/demo/agent ×3/第 2 次 100→0/案例 A/L1 回归/scope/cleanup；命令可复现 | **FAIL（B2/B3/B4/B6；N1）** | `s6a-plan.md` 178–194、209–258；S5/S3/S4 门禁中有旧文案 token 与 L2 标记扫描冲突（B2/B3）；`§10` 未构建 collector（N1）；S6A-D 动态字面量（B6） |
| 15 | 门禁迁移/冻结：S0–S5 锚点、S5_G1_FREEZE、S6A_G1_FREEZE、S3-8/S3-10 白名单 | **FAIL（B1/B2/B3）** | `s6a-plan.md` 190–194；`tools/verify/verify.mjs` 390–400、9659–9690、203–219、262–278、9347–9358、9516、4813–4935、6211–6266、8811–8836、9755–9782、5180–5230 |
| 16 | 风险/停止：ASM/Byte Buddy 组合、LVT 缺失、行号漂移、序号、VerifyError 失败即停 | PASS | `s6a-plan.md` 262–284；`dispatch` 203–223 |
| 17 | 安全/隐私：无 secret/CDN/镜像/外网；本地 ASM；只读 | PASS | fixture 无 secret；demo 仅 fake `demoSecret`（S5 既有）；ASM 来自 `~/.m2` 9.7；无新 CDN/字体/遥测 |
| 18 | S5 资产/零漂移：S0–S5 fixture、schema、transport、status 字节不变 | PASS（B1 除外） | `git status` 只显示 S6 文档/fixture 与 api/event-model；`transport` `44418a…`、`status` `9a8735…`、schema `927937df…` 不变；**但** S5_G1_FREEZE 旧 api/event-model 哈希与 S6a 修改冲突（B1） |
| 19 | 偏离 D1–D7：附录 F、无 DROP_COUNT、frame+name、探针位置、line selection | PASS（有注记） | `s6a-plan.md` 286–296；D3 **必要**；D5 不削弱事实；D2/D4/D6/D7 与契约一致；见 §4 |
| 20 | S6a 输出/S6 状态：partial、不开始 S6b、不打 s6/s6a tag | PASS | `s6a-plan.md` 298–301；`dispatch` 188–193、216–223 |

## 3. Blocking（必须修复；编号 + 精确修法）

### B1 S5-G 冻结与 S6a 契约修改自相矛盾（会让 S6A-E 必失败）

- **证据**：`tools/verify/verify.mjs` 390–400 的 `S5_G1_FREEZE` 明确以 S5 哈希冻结 `docs/contracts/api.v1.md`=`c95022d1…`、`event-model.v1.md`=`2a7fa58a…`；`S5-G` 在 9670–9690 对 18 项逐字节比较，label 写“api+event-model at S5 hashes”。S6a 必须修改这两个文件（见 `git diff`），当前实测哈希为 api=`0a309bc7eaac3aa34f47d79a705f3659e27fb1b7948ac04732cd6ec66ddf8152`、event-model=`1c3f1ef7a41b9020d71b6604dd6fd0f2c4d68bf7c4044a6ece10f978441915fe`。而 `s6a-plan.md` 193 仍写“`S5_G1_FREEZE` 18 项不变（S5 冻结零漂移）”，与“api/event-model 只做加性说明”不可同时成立。
- **精确修法**：沿用 S5 对 S4 的 supersede 模式——保留 `S5_G1_FREEZE` 的 18 项**集合**；在 §8.1 明确“S5-G 的冻结检查以 `S6A_G1_FREEZE` 覆盖 api/event-model 两项哈希”（例如 `const LATEST_G1_FREEZE = { ...S5_G1_FREEZE, ...S6A_G1_FREEZE }`，S5-G 用其比较），label 改为“api+event-model at S6a hashes”；S5 fixture/S5 plan/S5 dispatch/transport/status/schema 仍用 S5 哈希且零漂移。`S6A_G1_FREEZE` 建议 = `{...S5_G1_FREEZE, api: 新, event-model: 新, fixtures/s6-l2-lines/{events.ndjson,expected-facts.json,README.md}, s6a-plan.md, dispatch-s6a.md}`（是否加 `plan-review-s6a.md` 见 N9）。不要删除 18 项数量断言，也不要把 S5 冻结整体放宽。

### B2 旧 S5 文案 token 未列入迁移（S3-6 / S4-F / S5-D / S5-E 会失败；“S5-D/E 不变”自相矛盾）

- **证据**：
  - `S3_WORKBENCH_TOKENS`（verify 203–219，第 217 行）要求 dist 含 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`；`S3-6` 在 6078 对每个 token 断言。`s6a-plan.md` §7（174）要求该旧绝对口径在 src/dist 都不得残留。
  - `S4_RUNTIME_X3_NOTE`（262）与 `S4_DIST_TOKENS`（274–278）要求 dist 含 `×N 为已采集 span 的前端聚合；运行时 ×3 属 S6`；`S4-F` 在 8172 断言。S6a 的 canonical ×N 注记已改为 `…运行时 ×3 已在 L2DemoService#reconcileAmount 演示；其他方法无运行时 ×3`。
  - `S5-D` 的 `s5WorkbenchTokens`（9347–9358，第 9352 行）和 `S5-E` 的 demo dist 断言（9516）还要求旧 S5 页头句。
  - `s6a-plan.md` 194 把 `S5-B/C/D/E` 列入“不变”，而 §7 要求改文案并让旧的 `无构建期局部变量/L2（S6）`/`运行时 ×3 属 S6` 在 src+dist 消失；二者直接冲突。`S5_STALE_TEXTS`（375）/`S5_FORBIDDEN_CLAIMS`（377）也未包含 S6a 的 4 条 stale 文案。
- **精确修法**：在 `s6a-plan.md` §8.1 明确列出并修改以下常量/门禁，而不是只写“S5 文案迁移”：
  1. `S3_WORKBENCH_TOKENS`（S3-6）：把旧 S5 页头句替换为 canonical banner；其余 10 个 S3 token 保留。
  2. `S4_RUNTIME_X3_NOTE`/`S4_DIST_TOKENS`（S4-F）：把旧 ×3 注记替换为 canonical ×N 注记；`S4-DIST` 其余 token（节点详情/×N/未采集/缺口/rowsAffected/reason/逐次调用/SQL/UI/未采集（无 reason）/缺口空态）保留。
  3. `S5-D` `s5WorkbenchTokens`：旧页头 token 替换为 canonical banner；保留 `s5-values`/`s5-l1-badge`/`s5-values-note`/`s5-values-empty`/`s5-source`/`100 → 0`/`已脱敏`/`已截断`/`（manifest 映射）`/`行号未采集`/`第 1/1 次`/S5 L1 静态说明/空态/JS 内部变量说明。
  4. `S5-E` 9516：demo dist/source 的旧页头 token 替换为 canonical banner；保留 `#btn-discount`/`previewDiscount`/固定 URL/无 loadOrders。
  5. `S5_STALE_TEXTS` 增加 S6a 的 4 条反向断言：`S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`、`运行时 ×3 属 S6`、`无异步/×3`、`无构建期局部变量/L2`（src+dist 均不得出现）；`S5_FORBIDDEN_CLAIMS` 保留 `kind=local`/`L2 已采集`（新 UI 不得包含）。
  6. 把 §8.1 的“不变：…S5-B/C/D/E…”改为“S5-B/C 行为不变；S5-D/E **除上述旧文案 token 外**断言不变；`S5 perf` 仍 report-only；S4-F 的 15 字段不变，仅其 dist 旧 ×3 token 迁移”。

### B3 L2 标记扫描未迁移（S2-8 / S3-8 / S4-I / S5-H 会失败）

- **证据**：
  - `S2-8` `agentForbidden`（verify 4922–4928）对所有 `agent/src` 文件禁用 `/kind\s*=\s*["']local|LocalVariableTable|visitLocalVariable|localVariables/`；新增 `L2ClassFileTransformer`/`L2Values`/`SpanContext` L2 代码必然命中。`s6a-plan.md` 190 只泛写“允许 LVT 术语仅在 L2 ASM/值/SpanContext 新代码”，没有按文件白名单落地。`S2-8` 的 `expectedShopClasses`（4902–4908）仍是 4 类，需要加 `com.example.shop.service.L2DemoService`；但 `agentTargets`（5 个 Byte Buddy 类型）**不能**加（L2DemoService 走 ASM 且 Byte Buddy 显式 ignore）。`typeMatchers` 仍 5、`.transform` 7→8、`adviceClasses` 7→8。
  - `S3-8` `l2Hits`（6261–6266）扫描 `frontend/sdk/src`、`workbench/src`、`demo frontend/src`、`server/collector/src`、`agent/src`，同样会被 `L2ClassFileTransformer` 命中。
  - `S4-I`（8811–8836）`S4_SCOPE_TREES` 含 `agent/src`/`workbench/src`，`forbiddenMarkers` 含 `L2/local`。
  - `S5-H`（9755–9782）`productTrees` 含 `agent/src`/`workbench/src`/`demo backend/src`，`forbiddenMarkers` 含 `L2/local`；`agentL1` 仍要求 `L1Values.java` 不含 `"local"`（应保持不变）。
  - 这些门禁都不在 `s6a-plan.md` §8.1 的迁移清单（只写了 `S3-8/S3-10` 白名单与 `S2-8` 的一部分）。
- **精确修法**：在 §8.1 增加一张“L2 标记白名单”表并逐门禁落地：
  - `S2-8`：`agentForbidden` 仅对 `agent/src/main/java/io/traceboard/agent/L2ClassFileTransformer.java`、`L2Values.java`、`SpanContext.java` 放行 `LocalVariableTable|visitLocalVariable|localVariables|"local"`；其余 agent 文件（尤其 `L1Values.java`）保持禁止。`expectedShopClasses` 加 `com.example.shop.service.L2DemoService`；`agentTargets` 保持 5，`typeMatchers=5`，`.transform=8`，`adviceClasses` 加 `ReconcileControllerAdvice.class`。`exception-payload` 的 `getMessage()` 仍禁止——L2 错误日志只写 `Throwable.toString()`/类名（不要 `getMessage()`）。
  - `S3-8`：`l2Hits` 对上述 3 个 agent 文件 + `workbench/src/s6/**` 放行；其他文件保持禁止。
  - `S4-I`/`S5-H`：对同一组 agent L2 文件 + `workbench/src/s6/**` 放行；`S5-H` 的 `agentL1` 检查保持 `L1Values.java` 不含 `"local"`。
  - `S3-10`：`allowedPrefixes` 加 `fixtures/s6-l2-lines/`、`docs/plans/stages/S6/`；`S5_DEMO_BACKEND_ALLOWED`（或 S3-10 的 exact 允许）加 `demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/L2DemoService.java`；`agent/`/`workbench/` 前缀已覆盖新文件；`demo frontend/src/App.vue` 已在 `S3_DEMO_EXPECTED_FILES`。如 checkpoint 在改 `docs/plans/STAGE-PROGRESS.md` 后复跑，另加该 exact 允许（N13）。
  - 更新相应 label（S4-I/S5-H 的“no L2/local”改为“L2 allowed only in the S6a L2 files; no async/NO_DEBUG/loop-fold/perf”），不得整体删除反向断言。

### B4 LVT 活性范围起点未写清；排他实现会丢掉初始化探针（1/2/1 与 from=100 失败）

- **证据**：用 JDK8 `javac 1.8.0_221` 对 `s6a-plan.md` §4.1 的方法形状做可行性探针，`javap -l -p -c` 得到：
  - `reconcileAmount(JDI)D`：`0 dload_3 / 1 dstore 6 / 3 iload 5 / 5 iconst_2 / 6 if_icmpne 12 / 9 dconst_0 / 10 dstore 6 / 12 dload 6 / 14 dreturn`；
  - `LineNumberTable`: `line 9:0, line 10:3, line 11:9, line 13:12`；
  - `LocalVariableTable`: `local D Start 3 Length 12 Slot 6`。
  - 结论：初始化行的探针插入点（line 9 结束/line 10 起点）**恰好等于 LVT start=3**；坏行探针插入点（line 11 结束/line 13 起点）=12，同时是 `if_icmpne` 的跳转目标。若“活性范围内”按 `start < offset` 实现，初始化探针被排除，第 1/3 次没有 local 值或行号错误，第 2 次只有一项 `null→0`，S6A-C 必失败。
- **精确修法**：在 `s6a-plan.md` §5.4（以及 `api.v1.md` §10.10/`event-model.v1.md` §4.4.7 的“每个已执行源行”措辞）写明：
  1. `ClassReader` 不得带 `SKIP_DEBUG`（必须读取 `MethodNode.localVariables`），精确匹配 `name="local"`、`desc="D"`；
  2. 活性范围判定用 **inclusive start**：`lvtStart <= insertOffset && insertOffset < lvtStart + lvtLength`；初始化探针偏移 = LVT start；坏行探针偏移 = 下一行起点（即 `if` 跳转目标）；
  3. transformer 自检：必须恰好插入 2 个探针（init/assign），把两个 **offset 与 source line** 写进 `l2_probes_installed method=reconcileAmount …`；不足 2 个时写 `l2_probe_missing` 并 fail-open（返回原始字节/不伪造值），S6A-A 除 `javap -l` 外还要校验该日志/自检结果；
  4. 说明坏行探针在非 2 路径也会执行，因此 `previous` 必须按 `(frame,name)` 去重（与 D3 一致）；这一点同时作为 D3 必要性的运行时理由。

### B5 “值变化”判定 `from != to` 在 `from=null` 时误判（与“仅第 2 次”相反）

- **证据**：`api.v1.md` 1179 与 `s6a-plan.md` 173 都写“`kind=local` 且 `from != to`”；第 1/3 次 local 项是 `from=null,to=100`，按字面 `null != 100` 为真，会把第 1/3 次也标成“值变化”，与同句“其余两次不加”及 `expected-facts.json` 的 `perSpan.diff=false/false/true`、`diffOnlyOnSpanId=b000000000000005` 冲突。现有 `s5/values.ts` 的 `isFieldDiff` 已用 `from !== null && from !== undefined` 守卫，S6a 应沿用。
- **精确修法**：在 `api.v1.md` §10.10（1179）与 `s6a-plan.md` §7（173）把判定改为：`kind ∈ {local, field} && from !== null && from !== undefined && from !== to`（**首次观测 `from=null` 不算值变化**）；在 `expected-facts.json`/S6A-D 增加反向断言：第 1/3 次 `diff=false`，仅第 2 次 `diff=true`；S6A-C 也断言 `values[0].from=null` 不被当作变化（事件层不涉及 diff，但 UI 层必须）。

### B6 S6A-D 把 Vue 动态属性/插值当成 dist 静态字面量（不可实现，且不能证明条件性）

- **证据**：`s6a-plan.md` 185 要求“静态断言 `#s6-l2-badge`/`[data-value-kind="local"]`/`行号`/`100 → 0`/`第 2/3 次`/`data-invocation-diff="true"`”。现有工作台：
  - `S4DetailPanel.vue` 296–304 用 `:data-value-kind="value.kind"`（动态属性），dist 里只有 `data-value-kind`，没有 `[data-value-kind="local"]` 字面量；若不加 `style.css` 的 `[data-value-kind="local"]` 规则，静态断言必失败。
  - 338 行 `{{ lineFooterText(value) }} · {{ invocationText(value, valuesTotal) }}` 动态插值；`invocationText` 只在无 invocation 时返回字面量 `第 1/1 次`，`第 2/3 次` 不会出现在 dist。
  - `data-invocation-diff="true"` 若按 Vue 动态属性写，dist 只有 `data-invocation-diff`/`"true"`/`"false"` 片段，不会有完整字面量。
  - 即使字面量存在，静态 dist 也不能证明“仅第 2 次加 diff/仅 L2 节点显示徽标”。
- **精确修法**：把 S6A-D 拆成两层：
  1. **静态 dist token**：`#s6-l2-badge`、`#s6-l2-note`、`data-value-kind`、`data-invocation-diff`、`值变化`、`行号`、`100 → 0`、canonical banner/L2 注记；以及 `#s5-values`/`#s5-l1-badge`/`#s5-source`/`#s5-values-empty`、S3/S4 选择器仍在。
  2. **fixture/pure-function 断言**：在 `workbench/src/s6/**` 导出纯函数（如 `isL2Node(node)`、`localValueRows(node)`、`isValueChange(value)`、`invocationDiffNodes(group)`），由 `tools/verify` 以 fixture 的 3 个 service 节点断言：仅 `b000000000000005` 的 `isValueChange` 为真、第一/第三为假；仅 L2 flag 的节点 `isL2Node` 为真；第 2 次 local 行 `line=24/from=100/to=0`。若不想新增导出，可加一个最小 headless DOM 测试；否则必须在测试报告如实标注“仅静态 token，未做 DOM 条件断言”（不得宣称已证明）。
  3. 如确实需要 `[data-value-kind="local"]`/`data-invocation-diff="true"` 字面量，则在 `style.css` 加对应 CSS 选择器使其进入 dist，但这仍只证明样式存在，不能替代第 2 层。

## 4. Non-blocking（建议；不阻断 G1 关闭，但应在返工中一并处理）

| # | 项 | 建议 |
|---|---|---|
| N1 | `s6a-plan.md` §10 命令未构建 collector，却直接 `java -jar server/collector/target/...`（209–258） | 在“构建”段加 `JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/collector" -am`（或根 reactor package），再启动 collector；否则干净环境复现失败 |
| N2 | fixture click 行 flags 只有 `SDK_ACTIVE,OBSERVE_MS=1500`，无 `S3_RUNTIME_SDK`；service flags 无 `DROP_COUNT` | 与 S5 fixture 约定一致（D2）；README 已说明不含 DROP_COUNT，建议再补一句“`S3_RUNTIME_SDK` 同属运行时建议 flag，fixture 不写”，避免被读成运行时形状 |
| N3 | `api.v1.md` §10.10 第 1 点/`event-model.v1.md` §4.4.7 仍写“每个已执行源行探针”，与计划 D5（跳转/return 行不插）不完全一致 | 改成“在行边界（下一行起点/return 前）插探针；以 jump/return/switch 结束的行不插，帧内去重兜底”，与 D5/B4 对齐 |
| N4 | S6A-C 的 flags 断言只写“含 L2（无 L1）”（184） | 明确断言同时无 `LOST_BACKEND`/`VALUES_CAPPED`/`L1_SKIPPED`，且 `values` 项键序/`from/to`/`truncated/redacted` 精确；expected-facts 已有 `flagsRuntimeAssertion`，把它写进 S6A-C 行 |
| N5 | S6A-C 未覆盖“无 controller 父帧/无头”的 L2 行为 | 明确 S6A 不测无头 reconcile（或加一条：有 agent 无头时 controller LOST + 3 L2 LOST 属于合法 S2 子链，不得伪造 EXACT）；避免“无 controller 父帧不 emit”缺少测试证据 |
| N6 | 浏览器点击的 6-span 链只有 fixture（S6A-D 用 fixture），S6A-C 只测 4-span（184） | 加一条 demo frontend 静态断言（`#btn-reconcile` + `POST /api/orders/1/reconcile` + 不调用 `loadOrders`），或明确“6-span 只有 fixture，runtime 只证明 4-span 后端链”，与 dispatch §4.1 的两种口径一致 |
| N7 | S6A-B“源码无 UPDATE”只证明无 UPDATE，不证明无 DB 读（183） | 增加 `L2DemoService.java` 不含 `SELECT`/`findById`/`JdbcTemplate`/`@Transactional`/`Mapper` 的断言；与附录 F“无 DB 读写”一致 |
| N8 | S2-8 的两个清单容易被混用（`agentTargets` 5 个 Byte Buddy 类型 vs `expectedShopClasses` 全部 `com.example.shop.*` 引用） | 在 §8.1 明确：`expectedShopClasses` 加 `L2DemoService`；`agentTargets` 保持 5；Byte Buddy `.ignore(L2DemoService)` 不算 target（B3 已含修复，此处提示避免误加 `.type`） |
| N9 | 输出路径：dispatch §5.2/§6 写 `plan-review.md`，本卡写 `plan-review-s6a.md` | 把实际文件名写进 `S6A_G1_FREEZE`，并在 dispatch/plan 的 G1 冻结清单同步；否则 S6a G1 哈希清单可能漏审阅文件 |
| N10 | `api.v1.md` 文件末尾无换行（diff 显示 `\ No newline at end of file`） | 补一个换行，避免后续 diff/工具噪音；不影响契约 |
| N11 | dispatch §3 写 previous 按 `(frame,line,name)`，与 event-model §4.4.7/计划 D3 的 `(frame,name)` 冲突 | 采信 event-model/§4.2 与计划 D3；建议 dispatcher 记录勘误（dispatcher 可改 dispatch，plan-writer 不改）。D3 **不是弱化**：line 11 探针与 `if` 跳转目标同偏移，非 2 路径也会执行；按行键会给第 1/3 次追加一项 line 11，1/2/1 不成立；按帧+名去重恰好得到 1/2/1 |
| N12 | 环境口径：dispatch 写 Node 22/npm 10；本机 shell `node -v`=v22.22.2/npm 10.9.7（另见环境 Node 24 提示）；ASM 9.7 实测 major 49 | 命令不依赖 Node 具体小版本；建议 dispatch 环境事实用“Node 22.x/npm 10.x”并注明实际测量值；ASM major 49 与 dispatch 一致（已验证） |
| N13 | S3-10 的 exact 白名单未含 `docs/plans/STAGE-PROGRESS.md`（checkpoint 会改） | 若 checkpoint 在改该文件后复跑 S3-10，需在 `allowedExact` 加 `docs/plans/STAGE-PROGRESS.md`；否则 checkpoint 应在写 docs 前完成“复跑门禁” |

## 5. 偏离评估（D1–D7）

| # | 偏离 | 评估 |
|---|---|---|
| D1 | 附录 E→F | **可接受**。E 已被 S5 占用，历史不改写；F 内容与 dispatch §3/§4 一致（`api.v1.md` 1344；`s6a-plan.md` 290） |
| D2 | fixture 不写 `DROP_COUNT` | **可接受，不弱化**。fixture 是形状测试数据，不是运行时字节；运行时 emitter 总写 `DROP_COUNT`；`flagsAreContainsOnly:true` + includes/禁项断言正确（`expected-facts.json` 63–64；README 60–61） |
| D3 | previous 按 `(frame,name)` 而非 dispatch 的 `(frame,line,name)` | **必要，不是弱化**。javac8 下 line 11 探针位于 `if` 跳转目标（偏移 12），非 2 路径也会执行；按行键会为第 1/3 次追加 line 11 一项，1/2/1 与 `from=100` 都不成立；按帧+名去重才是正确语义（`event-model.v1.md` 232；B4 证据）。建议 dispatcher 记录勘误（N11） |
| D4 | L2 span 只有 `kind=local`，不采 param/field/return | **可接受**。与 event-model §4.4.7（227）/api §10.10（1163）一致；返回值走事件 `return`，入参不采；没有伪造或越界 |
| D5 | 只在“上一真实指令非跳转/return”的行边界插探针，而非字面“每条已执行源行” | **可接受，不弱化**。避免在 return 后/跳转后插不可达探针；demo 恰落初始化行与坏行，帧内去重兜底；S6A-C 的 1/2/1 仍由运行时证明。建议按 N3 统一 api/event-model 措辞 |
| D6 | `source` 行号与 `values[].line` 分开 | **正确**。`source` 来自 JVM 栈，`values[].line` 来自 LVT/行表，不混用（dispatch 4.4；event-model 228） |
| D7 | invocation 计数挂父 controller 帧、每请求重置 | **正确**。与 event-model 231 一致；无 controller 父帧 skip 并计 `l2_no_parent`，不伪造 LOST 子 span |

- 其他偏离：fixture 行号 22/24 为示意、测试从 `L2DemoService.java` 重算——**可接受**；探针位置/line selection 的精确语义见 B4。
- **需要点名的弱化风险**：B5（`from != to` 对 `from=null` 误判）与 B6（仅静态 token 不能证明“仅第 2 次/仅 L2”）；这两处不是 D1–D7 的偏离，而是计划/测试表达需要修正，修好后不弱化任何事实。

## 6. 冻结哈希（实测，供 G1 重冻结）

| 文件 | SHA256 | 状态 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 不变（与任务给定一致） |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` | 不变（S5 哈希） |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 不变（S5 哈希） |
| `docs/contracts/api.v1.md` | `0a309bc7eaac3aa34f47d79a705f3659e27fb1b7948ac04732cd6ec66ddf8152` | S6a 修订；S5 冻结旧值 `c95022d1…`（B1） |
| `docs/contracts/event-model.v1.md` | `1c3f1ef7a41b9020d71b6604dd6fd0f2c4d68bf7c4044a6ece10f978441915fe` | S6a 修订；S5 冻结旧值 `2a7fa58a…`（B1） |
| `fixtures/s6-l2-lines/events.ndjson` | `ebf681135400c1dc6729c7f24135cf18e0243e660b24833689fda0832ab8bebc` | 新增（测试数据；6 行） |
| `fixtures/s6-l2-lines/expected-facts.json` | `29c78a53f16985669adb5d405451c5ae3f77e2aaef4cc1939648dc3b94fa3c1d` | 新增（13 facts） |
| `fixtures/s6-l2-lines/README.md` | `b8126f80635c73bd67d6f623da3ccbc8c4004d3e7346ec8f207254eb4fcdbb53` | 新增（首段逐字） |
| `docs/plans/stages/S6/s6a-plan.md` | `7e1ef1c8bdc5ed3d4c2b2ecec26d1ff45785afff990934b95c8580b25432364a` | 评审对象 |
| `docs/plans/stages/S6/dispatch-s6a.md` | `c6dbda4d9a3d738d4168f875710fdd81ed10104b52273af1b2fb8156e4a52160` | 评审对象（dispatcher 所有） |

- `git status` 仅 `docs/contracts/api.v1.md`、`docs/contracts/event-model.v1.md` 修改，`docs/plans/stages/S6/` 与 `fixtures/s6-l2-lines/` 新增；`schema/`、`transport`、`status`、S0–S5 fixture 无改动——**零漂移成立**（除 B1 的 S5_G1_FREEZE 语义）。
- `fixtures/s6-l2-lines` 实测：`lines 6 schema ok 6`；service 3、同 nodeKey、parent=controller、startNs 严格递增、values 1/2/1、returns 100/0/100、第二项 22/24、区间嵌套、无 secret、无 `s_s3demo`。

## 7. 最终 G1

**G1: FAIL**（Blocking 6：B1–B6；Non-blocking 13：N1–N13）。

- 阻塞项全部是**文档/门禁迁移与测试表达**层面的修复，不需要改 schema/事件类型/status/transport，不需要扩大 S6a 范围，也不改变 S6a 设计方向；按 §3 的精确修法返工一轮即可重评。
- 重评时的最小证据：S5-G 冻结用 S6A 覆盖后 18 项仍 PASS；S3-6/S4-F/S5-D/S5-E 旧文案 token 迁移后仍保留 S5/S3 选择器与 Values 断言；S2-8/S3-8/S4-I/S5-H 仅对 L2 文件放行且 `L1Values` 仍纯净；S6A-A 能证明 2 个探针/行号（含 LVT start inclusive）；S6A-D 能对 fixture 证明“仅第 2 次 diff/仅 L2 徽标”（纯函数或 DOM），而不是只做 dist 字面量。

## 8. 复评 2026-11-23（G1 第 2 轮）

> 角色：PLAN-REVIEWER（只读）｜对象：修订后的 `s6a-plan.md` v2、`api.v1.md` §10.10/附录 F、`event-model.v1.md` §4.4.7、`fixtures/s6-l2-lines/**`、`tools/verify/verify.mjs` 现行门禁。
> **最终结论：G1: FAIL**（剩余 Blocking 3：B7–B9，均为第 1 轮 B1/B2/B3 的门禁残留；B4–B6 已关闭；N1–N13 已落实，另见 N14–N16）。§1–§7 保留为第 1 轮历史，最终以本节为准。

### 8.1 B 状态（复评）

| # | 状态 | 复评证据 |
|---|---|---|
| B1 | **部分关闭（残留 B7）** | `s6a-plan.md` §8.1.1 已写 `S6A_G1_FREEZE` + `LATEST_G1_FREEZE`、S5 18 项集合保留、S5-G label/口径；但同类冻结比较还有 3 处未迁移（B7）。 |
| B2 | **部分关闭（残留 B8）** | §8.1.2 已逐常量迁移 S3-6/S4-F/S5-D/S5-E、4 条 stale、修正“S5-D/E 不变”；但 S3-1 的 demo dist token 仍要求旧 S5 banner（B8）。 |
| B3 | **部分关闭（残留 B9）** | §8.1.3 的 L2 标记白名单（S2-8/S3-8/S4-I/S5-H/S3-10）与 `expectedShopClasses` 5、`agentTargets` 5、`.transform` 8、advice 8 已对齐；但 S4-I/S5-H 的 **git 变更白名单**未加 S6a 路径（B9）。 |
| B4 | **关闭** | `api.v1.md` 1162、`event-model.v1.md` 227、`s6a-plan.md` §5.4 均写 inclusive start（`lvtStart <= offset < lvtStart + lvtLength`）、不 `SKIP_DEBUG`、恰 2 探针、init offset=LVT start、`l2_probe_missing` fail-open；S6A-A 校验 `javap -l`+日志。 |
| B5 | **关闭** | `api.v1.md` 1179、`s6a-plan.md` §7、fixture `workbenchExpectations.diffRule`/`perSpan`/`perSpanDiff` 均为 `from !== null && from !== undefined && from !== to`；首次观测 `from=null` 不算变化；仅 `b000000000000005` diff=true。 |
| B6 | **关闭** | `s6a-plan.md` §7/§8 S6A-D 已分层：dist 仅静态 token；`[data-value-kind="local"]`/`data-invocation-diff="true"`/`第 2/3 次` 仅动态 DOM；条件性由 S6A-C 运行时 values + 浏览器 DOM/桩断言记录在 `s6a-acceptance.md`；fixture `staticDistTokens`/`dynamicDomOnly`/`pureFunctionExpectations`/`diffConditionalityProof` 与之一致，验收要求如实标注。 |

### 8.2 剩余 Blocking（必须修复）

#### B7（B1 残留）S2-L / S3-2 / S4-H 仍用 `S5_G1_FREEZE` 比较 api/event-model，S6a 后必失败

- **证据**：除 S5-G 外，还有三处读取 S5 旧哈希：
  - `S2-L`（verify 4724 `latestMap = new Map([...s3Map, ...Object.entries(S5_G1_FREEZE)])`；随后对 api/event-model 断言 actual===latest）——S6a 后 api=`4c895fd7…`、event-model=`fc6ad919…`，与 S5 旧哈希不符 → 失败。
  - `S3-2`（verify 5634 `const expected = S5_G1_FREEZE[entry.rel] ?? entry.hash`，遍历 `s3FreezeSections()` 的 contracts，含 api/event-model）→ 失败。
  - `S4-H`（verify 8725 `Object.entries(S5_G1_FREEZE)` 18 项逐字节；label 仍写 S5）→ 失败。
- 这三处都在 S6A-E 的“S0–S5 锚点全 PASS”与 S5-G 的 `S4_H_ANCHORS`/`s4Gates` 内；只改 S5-G 不够。
- **精确修法**：在 `s6a-plan.md` §8.1.1 明确列出 `S2-L`、`S3-2`、`S4-H` 也改用 `LATEST_G1_FREEZE`（同一 `{...S5_G1_FREEZE, ...S6A_G1_FREEZE}`），labels 改为“latest = S6a G1 freeze（api/event-model superseded）”；`S5_G1_FREEZE` 18 项数量断言、schema/transport/status/S0–S5 fixture 仍按 S5 哈希。

#### B8（B2 残留）S3-1 `demoTokens` 仍要求旧 S5 banner，与 demo canonical 迁移 + stale 反向断言冲突

- **证据**：`checkS3Builds`（S3-1，verify 5431–5437）的 `demoTokens` 仍包含 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`。S6a 要求 `demo frontend/src/App.vue` 页头改为 canonical banner，且 `S5_STALE_TEXTS` 新增的 4 条要在 demo src+dist 不出现；两门禁同时执行时 S3-1 必失败。
- **精确修法**：在 §8.1.2 增加 S3-1：把 `demoTokens` 的旧 banner 替换为 §9 canonical banner（保留 `amount-b`/`btn-save-b`/`金额必须大于 0`/`校验通过（本案例不提交）`/`traceparent`/`X-TraceBoard-Click`/`s_s3demo`/`__TRACEBOARD_MANIFEST__`/`previewDiscount` 等其余 token），并同步 S3-1 label/detail 中“旧 banner”措辞。

#### B9（B3 残留）S4-I / S5-H 的 git 变更白名单未含 S6a 新路径，全量运行会报 unexpected

- **证据**：
  - `S4-I`（verify 8984–9018）：`allowedPrefixes` 只有 `docs/plans/stages/S4/`、`S5/` 与 `fixtures/s4-details/`、`s5-l1-values/`，没有 `docs/plans/stages/S6/`、`fixtures/s6-l2-lines/`；S6a 的 plan/dispatch/plan-review 与 fixture 是未跟踪新增，`unexpected` 非空 → 失败。
  - `S5-H`（verify 9922–9937）：同样只有 S5 路径；`docs/plans/stages/S6/`、`fixtures/s6-l2-lines/` 会报 unexpected → 失败。
  - `s6a-plan.md` §8.1.3 只为 `S3-10` 列了白名单迁移，未列 S4-I/S5-H。
- **精确修法**：在 §8.1.3 增加 `S4-I`/`S5-H` 的 git 白名单迁移：`allowedPrefixes` 加 `docs/plans/stages/S6/`、`fixtures/s6-l2-lines/`；若 checkpoint 在复跑前写 `docs/plans/STAGE-PROGRESS.md`，两处 `allowedExact` 也加该文件（N13 同样适用于 S4-I/S5-H，不只 S3-10）。`S5_DEMO_BACKEND_ALLOWED` 加 `L2DemoService.java` 已覆盖 demo backend；`agent/`/`workbench/` 前缀已覆盖 L2 文件。

### 8.3 N 状态与新增非阻断

- N1–N12 已落实（§10 构建 collector、README `S3_RUNTIME_SDK` 注、行边界措辞、S6A-B/C/D 断言、无头 reconcile、demo 前端静态断言、无 DB 读断言、expectedShopClasses 5 vs agentTargets 5、评审文件名入 `S6A_G1_FREEZE`、api 末尾换行、派发勘误、Node 22.x）；N13 仅覆盖 S3-10，按 B9 扩到 S4-I/S5-H。
- **N14**：`workbench/src/components/S3Panel.vue:1274` 与 `components/S4DetailPanel.vue:207` 仍有 `运行时 ×3 属 S6` 的 tooltip 文案，§7“文案迁移”只点名 App.vue/S3Panel 脚注/derive.ts；虽 `S5_STALE_TEXTS` 会兜底，建议在 §7 一并点名这两个文件，避免 coder 漏改。
- **N15**：§8.1.2 写 S3-6“其余 10 个 S3 token”，实际 `S3_WORKBENCH_TOKENS` 还有 S5 迁移留下的 `JS 内部变量本次未采集（局部变量属 L2/S6；…）` 共 11 个非 banner token；建议改为“其余 10 个 S3 token + 1 个 JS 内部变量说明保留”，避免误删。
- **N16**：dispatch §3/§5.5 日志写 `l2_probes_installed method=reconcileAmount line=<init>,<assign>`，计划/契约/fixture 写 `offsets=… lines=…`；建议在 §13.1 记一条派发勘误，或 S6A-A 同时接受 `line=` 子串（不降低“恰 2 探针”断言）。

### 8.4 复评实测（供重冻结）

| 文件 | SHA256 | 状态 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 不变 |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` | 不变 |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 不变 |
| `docs/contracts/api.v1.md` | `4c895fd776c51f45eafcb4d31589d076270d11c0278afc16af16fb14c540d8f3` | S6a v2 修订（旧 `c95022d1…` 由 S6A 覆盖） |
| `docs/contracts/event-model.v1.md` | `fc6ad919a65ae63367a251b4015596c81bb30d21116d48472ffc4d601f2d65c9` | S6a v2 修订（旧 `2a7fa58a…` 由 S6A 覆盖） |
| `fixtures/s6-l2-lines/events.ndjson` | `ebf681135400c1dc6729c7f24135cf18e0243e660b24833689fda0832ab8bebc` | 与第 1 轮同（6 行） |
| `fixtures/s6-l2-lines/expected-facts.json` | `5a9f1ea795a95fa8f76350be6fdf86a88a37eb6ad3139db9aadc17aab664969d` | v2（13 facts + diff/分层字段） |
| `fixtures/s6-l2-lines/README.md` | `827247e3a7ed61da55e5c34c81e9e928d0fc11a449496713dfab869f62680b5a` | v2（首段逐字仍成立） |
| `docs/plans/stages/S6/s6a-plan.md` | `c732eb10c0c8b61eebcb6310bbea65109561ce8cd946648596753e9909980d35` | 复评对象 v2 |
| `docs/plans/stages/S6/dispatch-s6a.md` | `c6dbda4d9a3d738d4168f875710fdd81ed10104b52273af1b2fb8156e4a52160` | dispatcher 所有，未改 |

- 实测：`fixtures/s6-l2-lines` Ajv 2020-12 strict **6/6** 通过；service=3 同 nodeKey、parent=controller、startNs 升序、values 1/2/1、`[null→100]`/`[null→100,100→0]`/`[null→100]`、return 100/0/100、flags 含 `L2`；`expected-facts.json` 13 facts、`diffRule`/`perSpanDiff`/`staticDistTokens`/`pureFunctionExpectations`/`flagsRuntimeAssertion` 均在（部分嵌于 `globalAssertions.chain`/`workbenchExpectations`，路径需按实际层级读取）。
- `git status` 仍只有 api/event-model 修改与 S6 文档/fixture 新增；schema/transport/status/S0–S5 fixture 字节零漂移（S2-L/S3-2/S4-H 的失败只因读取 S5 旧契约哈希，而非字节漂移）。
- 无新增 secret/CDN/镜像/外网、无 S6b 能力、无 schema/事件类型/status/transport 变更；B4–B6 不弱化任何事实。

### 8.5 重评最小证据（修 B7–B9 后）

1. `S2-L`/`S3-2`/`S4-H`/`S5-G` 四处的 api/event-model 期望均取 `LATEST_G1_FREEZE`，且 S5 18 项集合/数量断言保留；
2. `S3-1` 与 `S3-6`/`S4-F`/`S5-D`/`S5-E` 使用同一 canonical banner/×N 注记，旧 4 条 stale 在 src+dist 零命中；
3. `S4-I`/`S5-H` 的 git 白名单允许 `docs/plans/stages/S6/`、`fixtures/s6-l2-lines/`（及复跑前写入的 `STAGE-PROGRESS.md`），其余禁项不变；
4. 一次 `tools/verify` 全量 exit 0（S6A-A..E + S0–S5 锚点），S6A-D 仍如实标注“dist 仅静态 token，条件性由运行时/DOM 证明”。

## 9. 最终复评 2026-11-23（G1 第 3 轮，s6a-plan v3）

> 角色：PLAN-REVIEWER（只读）｜对象：`s6a-plan.md` v3（§8.1.4 B7–B9 + §15 changelog v3）、`api.v1.md` §10.10/附录 F、`event-model.v1.md` §4.4.7、`fixtures/s6-l2-lines/**`、现行 `tools/verify/verify.mjs`。§1–§8 保留为历史。
> **最终结论：G1: FAIL**（剩余 Blocking 1：B8；B7/B9 关闭；B1–B6 仍满足）。

### 9.1 B7–B9 状态

| # | 状态 | 复评证据 |
|---|---|---|
| B7 | **关闭（有实施注记）** | §8.1.4 已写：S2-L/S3-2/S4-H 中凡对 `api.v1.md`/`event-model.v1.md` 使用 `S5_G1_FREEZE` 的哈希比较统一改用 `LATEST_G1_FREEZE = {...S5_G1_FREEZE, ...S6A_G1_FREEZE}`，schema/transport/status/S0–S5 fixture 仍取 S5 值，label 注明 “api/event-model at S6a hashes”；与 verify 4724/5634/8725 现状对齐。实施注记：S4-H 必须保留对 S5 的 **18 项遍历**（仅 expected 取 LATEST），不得改成 `Object.entries(LATEST_G1_FREEZE)`（否则 `frozenEntries.length === 18` 失败并纳入 S6 文件）。 |
| B8 | **未关闭（Blocking）** | §8.1.4 写 “保留 S5 banner token，追加 S6 必需 token”，仅去掉“旧 banner 唯一/排他”仍保留旧 banner 断言。S3-1 `demoTokens`（verify 5431–5437）若继续要求 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`，则与 §4.3（页头能力句改为 canonical banner）、§8.1.2（S5-E 把 demo 旧 banner 替换为 canonical；`S5_STALE_TEXTS` 4 条含旧 banner 与 `无构建期局部变量/L2`，在 workbench/src、workbench/dist、demo frontend/src、demo dist 零命中）直接互斥：保留旧 token → S5-D/S5-E 失败；替换旧 token → S3-1 失败。两门禁同在 S6A-E 全量运行。 |
| B9 | **关闭（有实施注记）** | §8.1.4 已加 `docs/plans/stages/S6/`、`fixtures/s6-l2-lines/`、L2 agent 文件、`L2DemoService.java`、`workbench/src/s6`；`L2DemoService.java` 须加入 `S5_DEMO_BACKEND_ALLOWED`（§8.1.3；S3-10/S4-I/S5-H 共用该常量）才能豁免 `demo/.../backend/` 的 forbiddenPrefixes；`agent/`、`workbench/` 前缀本已覆盖新文件，冗余条目无害。 |

### 9.2 B1–B6 与零漂移（实测）

- B1（§8.1.1 S6A_G1_FREEZE/LATEST/S5 18 项集合）、B2（§8.1.2 逐常量迁移）、B3（§8.1.3 L2 白名单）、B4（`api.v1.md` 1162、`event-model.v1.md` 227、§5.4 inclusive start/2 探针自检）、B5（`api.v1.md` 1179、§7、fixture `diffRule`/`perSpanDiff`）、B6（§7/§8 S6A-D 静态 dist + 纯函数/DOM 分层）仍成立。
- fixture Ajv 2020-12 strict 实测 **6/6**；schema `927937df…a489a`、transport `44418a3a…`、status `9a8735a0…` 字节不变；`git status` 仅 api/event-model 修改 + S6 文档/fixture 新增，S0–S5 fixture 无改动。
- v3 实测哈希：api `4c895fd776c5…`、event-model `fc6ad919a65a…`、`s6a-plan.md` `83fcb186e316…`、`dispatch-s6a.md` `c6dbda4d9a3d…`（未改）、fixture 三件不变（`ebf681…`/`5a9f1e…`/`827247…`）。
- 无新增范围/安全/S6b 问题；B4–B6 未弱化。

### 9.3 剩余 Blocking 与最小修法

- **B8（唯一阻塞）**：把 §8.1.4 B8 的 “保留 S5 banner token” 改为第 1 轮 B8 的精确修法——S3-1 `demoTokens` 的旧 S5 banner **替换**为 §9 canonical banner（其余 token `amount-b`/`btn-save-b`/`金额必须大于 0`/`校验通过（本案例不提交）`/`traceparent`/`X-TraceBoard-Click`/`s_s3demo`/`__TRACEBOARD_MANIFEST__`/`previewDiscount` 原样保留），并同步 S3-1 label/detail；可另加 `#btn-reconcile`/`reconcileBatch`/`reconcileAmount` 作为 S6 token，但不得再要求旧 banner。若坚持保留旧 banner，则必须同时把它从 `S5_STALE_TEXTS` 与 S5-E 迁移中删除，这会与 §4.3/§8.1.2 及“旧绝对口径不残留”冲突，不推荐。
- **非阻断**：N17—S4-I/S5-H 的 `allowedExact` 若 checkpoint 在复跑前写 `docs/plans/STAGE-PROGRESS.md`，也应加该文件（与 N13 同理）；N18—S4-H 保留 18 项遍历（见 §9.1 B7 注记）。

### 9.4 最终 G1

**G1: FAIL**（Blocking：B8；B7/B9 关闭；N17/N18 建议）。B1–B6 保持满足，fixture 6/6、schema/S0–S5 零漂移、无新增范围/安全/S6b 问题；B8 按 §9.3 做一处 token 替换即可重评。

## 10. G1 收尾复评 2026-11-23（第 4 轮，只读）

> 角色：PLAN-REVIEWER（只读）｜对象：`s6a-plan.md`（§8.1.4 B8 行 + §9 canonical 文案）、现行 `tools/verify/verify.mjs`（S3-1 5431–5437、S5-E 9513–9521）、`fixtures/s6-l2-lines/**`、`api.v1.md`/`event-model.v1.md`/schema/transport/status 哈希。
> **最终结论：G1: PASS**。B8 关闭；剩余 Blocking **无**；B1–B7 保持满足。

### 10.1 B8 关闭证据（对齐 §9.3 最小修法）

- `s6a-plan.md` §8.1.4 B8 行（228）已由“保留 S5 banner token”改为：**替换**旧 S5 banner 为 §9 canonical banner（逐字 `S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b`），**不再要求**旧 S5 banner，保留所有非 banner 的 S5 token，并追加 `#btn-reconcile`/`reconcileBatch`/`reconcileAmount`/`S6a`/`L2`。
- canonical 逐字一致：§8.1.4 B8 行 == §9 “banner”（245）== dispatch §4.4（dispatch-s6a.md:99），三处无差异；§4.3（110）与 §8.1.2 S5-E（208）同指该 banner，故 S3-1 与 S3-6/S4-F/S5-D/S5-E 使用同一页头句。
- 互斥已消除：现行 `verify.mjs` S3-1 `demoTokens`（5431–5437）仍含旧 banner、S5-E（9513–9521）要求 demo dist/source 含旧 banner —— 迁移后二者都取 canonical，且 `S5_STALE_TEXTS` 4 条（含旧 banner 与 `无构建期局部变量/L2`）在 src+dist 零命中，不再出现“保留旧 token → S5-D/E 失败 / 替换旧 token → S3-1 失败”。

### 10.2 B1–B7 仍满足（未回退）

- B1 §8.1.1 `S6A_G1_FREEZE` + `LATEST_G1_FREEZE` + S5 18 项集合/数量断言；B2 §8.1.2 逐常量迁移 + 4 条 stale；B3 §8.1.3 L2 白名单（`expectedShopClasses` 5/`agentTargets` 5/`.transform` 8/advice 8/`L1Values.java` 仍禁 `"local"`）；B4/B5/B6 见 §8.1/§9.2 结论未变；B7 §8.1.4（227）S2-L/S3-2/S4-H 用 `LATEST_G1_FREEZE` + S4-H 保留 18 项遍历注记，且 B9（229）白名单条目未改。
- 本轮只改 §8.1.4 B8 一行，无新增范围/安全/S6b 内容，无契约/schema/fixture 变更。

### 10.3 实测（供 S6a G1 冻结）

| 文件 | SHA256 | 状态 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 不变 |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` | 不变 |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 不变 |
| `docs/contracts/api.v1.md` | `4c895fd776c51f45eafcb4d31589d076270d11c0278afc16af16fb14c540d8f3` | 与第 3 轮同（S6a supersede `c95022d1…`） |
| `docs/contracts/event-model.v1.md` | `fc6ad919a65ae63367a251b4015596c81bb30d21116d48472ffc4d601f2d65c9` | 与第 3 轮同（S6a supersede `2a7fa58a…`） |
| `fixtures/s6-l2-lines/events.ndjson` | `ebf681135400c1dc6729c7f24135cf18e0243e660b24833689fda0832ab8bebc` | 不变（6 行） |
| `fixtures/s6-l2-lines/expected-facts.json` | `5a9f1ea795a95fa8f76350be6fdf86a88a37eb6ad3139db9aadc17aab664969d` | 不变（13 facts） |
| `fixtures/s6-l2-lines/README.md` | `827247e3a7ed61da55e5c34c81e9e928d0fc11a449496713dfab869f62680b5a` | 不变 |
| `docs/plans/stages/S6/s6a-plan.md` | `957f2409b6b6ec6b7626d54cbbfc45f7517f0e4e73376c927d6f494985248f8c` | 本轮 B8 修订（v3 为 `83fcb186…`） |
| `docs/plans/stages/S6/dispatch-s6a.md` | `c6dbda4d9a3d738d4168f875710fdd81ed10104b52273af1b2fb8156e4a52160` | 未改（dispatcher 所有） |

- fixture Ajv 2020-12 strict 离线实测 **`lines 6 schema ok 6`**；service=3、parent=controller、1/2/1、`[null→100]`/`[null→100,100→0]`/`[null→100]`、return 100/0/100、flags 含 `L2`。
- `git status --porcelain` 仅 `M docs/contracts/api.v1.md`、`M docs/contracts/event-model.v1.md`、`?? docs/plans/stages/S6/`、`?? fixtures/s6-l2-lines/`；`schema/`、`transport`、`status`、S0–S5 fixture 字节零漂移（S0–S5 零漂移成立）。

### 10.4 非阻断注记（不影响 PASS，交 coder/dispatcher 顺手处理）

- **N19**：`s6a-plan.md` §15 变更记录 v3 行仍写“S3-1 demoTokens **追加** S6 token”，与 §8.1.4 B8 的“替换”不一致，且无 v4 行；以 §8.1.4 表为准，建议 coder 落地时按“替换”实现（不得同时保留旧 banner），dispatcher 可补 changelog。
- **N20**：§8.1.4 B8 的非 banner 举例混用了 S3-1 与 S5-E token（`#btn-discount`/`s3cr3t`/`3000-x` 属 S5-E）；语义无误（“保留所有非 banner 的 S5 token”已覆盖 S3-1 的 `amount-b`/`btn-save-b`/`金额必须大于 0`/`校验通过（本案例不提交）`/`traceparent`/`X-TraceBoard-Click`/`s_s3demo`/`__TRACEBOARD_MANIFEST__`/`previewDiscount`），仅措辞可更精确。
- N17/N18 仍为实施建议（`S4-I`/`S5-H` 的 `allowedExact` 视 checkpoint 是否先写 `STAGE-PROGRESS.md`；S4-H 保留 18 项遍历），不阻断。

### 10.5 最终 G1

**G1: PASS**（Blocking：无；B1–B7 满足，B8 关闭，B9 关闭；N17–N20 为非阻断建议）。G1 冻结清单：`S6A_G1_FREEZE` 8 项按 §10.3 实测值登记（含 `plan-review-s6a.md` 实际文件名，N9）；`api.v1.md`/`event-model.v1.md` 由 S6A 哈希 supersede S5 旧值，其余 S5 16 项、schema/transport/status、S0–S5 fixture 仍取 S5 冻结值并零漂移。