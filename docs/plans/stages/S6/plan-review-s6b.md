# S6b 计划评审（plan-review-s6b）

> 角色：PLAN-REVIEWER（G1，只读）｜阶段：S6b（S6 后半；S6 仍 🟡）｜日期：2026-11-24｜版本：v2（G1 复评；v1 为首次 FAIL 记录，历史保留）
> 输入：`docs/plans/stages/S6/dispatch-s6b.md`、`docs/plans/stages/S6/s6b-plan.md`、`docs/contracts/api.v1.md` §2.7/§10.11/附录 G、`docs/contracts/event-model.v1.md` §4.4.8–§4.4.10/§7/§9/§13、`fixtures/s6b-{async,no-debug,loop}/**`、`schema/traceboard.event.v1.json`、S6a 产物（`plan-review-s6a.md`、`test-report-s6a.md`、`s6a-plan.md`、`dispatch-s6a.md`、`fixtures/s6-l2-lines/**`）、当前 `agent/demo/workbench/tools`。
> 只读声明：本文件只评审，不改计划/契约/fixture/代码；G1 后按 dispatch §4.7 冻结。评审对象为 plan-writer 输出（`api.v1.md`/`event-model.v1.md`/3 组 S6b fixture/`s6b-plan.md`）及其上游 dispatch。
> **最终结论：G1: PASS**（复评：Blocking 0；B1/B2 已关闭、N1 已写入测试口径；剩余 Non-blocking 仅为实施注记，见 §4 与 §6）。

## 1. 结论摘要

- 范围、契约、fixture、可行性、风险、安全的主干成立：S6b 只做异步创建时继承/无调试降级/循环折叠/L2 开销与 S6 最终验收；S6a/S5 行为与字节未被回退；schema/transport/status/graph/路由/meta 未变；3 组 fixture 离线 Ajv 2020-12 strict 复评实测 **6/6、2/2、4/4** 通过（`schema/traceboard.event.v1.json` 仍 `927937df…`）。
- **复评结论**：s6b-plan v1.1（`f237685d…`）已把 B1/B2 的精确迁移与“只增不减”写死，N1 的探针口径已同步到 plan §4.2/§5.2/S6B-C/D7 与 `fixtures/s6b-loop/{README.md,expected-facts.json}`；v1 的两条 Blocking 关闭，未发现新增矛盾。
  - **B1 已关闭**：§10（225–231）逐条覆盖 `S6A-B`（`appSource.includes(S6_BANNER)`、端点 7 映射、**删除“其余断言不变”**）、`S6A-D`（`S6A_WORKBENCH_TOKENS` 三个旧文案 token → `S6_*`，保留选择器 token，`S6A_EVIDENCE.workbench.tokens` 取迁移后长度、新 UI token 不回填）、`S3-1`（banner → `S6_BANNER`、`"S6a"`→`"S6"`、追加两个 btn token）、`S3-6/S4-F/S5-D/S5-E`（统一 `S6_*`）、`S5_STALE_TEXTS` 追加旧三段全文（N13 去重）、源码侧 canonical 单一来源、S6B-F 旧口径零命中。与 §4.5/§10 的“旧三段四树零命中”不再互斥。
  - **B2 已关闭**：§10（232–235）明写 `S5_FORBIDDEN_CLAIMS` **追加** 6 条并**保留** `kind=local`/`L2 已采集`、`length >= 8`；`S6A-E` 原 6 条 `claimTexts` **保留**、白名单只做路径豁免；`S3-8/S4-I/S5-H` 对非白名单文件仍全域禁 `L2/local` 与 `async-continuation`；S6B-F 增“禁项只增不减 + 旧 `S6A_*` 不再被正向引用”。
- **N1 已落实（非阻断）**：plan §4.2（95）、§5.2（140）、S6B-C（210）、D7（330）、§12（307）统一为“JDK8 实测 **4**（init/增量/if/锚点）、断言 ≥2、从 `l2_probes_installed` 记录实际值、不硬编码 3”；`fixtures/s6b-loop/README.md:44` 与 `expected-facts.json.runtimeProbeExpectations.probes` 同为 4/≥2；不再有“期望 3”的硬断言表述（正文检索无“期望 3/硬断言 3”正向口径）。

## 2. 逐项核验（PASS/FAIL）

### 2.1 范围与 S6a 不变（用户核验项 1）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 范围恰为异步上下文/无调试信息/循环与预算折叠/L2 性能/S6 最终验收；无 S7+ | PASS | `dispatch-s6b.md` §1（18–34）、§2（36–40）、§11 第 6 条（226）；`s6b-plan.md` §1（8–24）、§2（26–30）、§13（296–303）；全篇未出现 Tomcat/WAR/React/SSE/WS/持久化/CORS/鉴权/跨服务实现项 |
| 2 | S6a 不变：`#btn-reconcile`、4-span、values 1/2/1、L2 徽标/local 行/`100 → 0`/第 2 次高亮、S5 选择器 | PASS | `s6b-plan.md` §2（30）、§7（189–191）、§9 S6B-A/E（206、210）；`fixtures/s6-l2-lines/**` 未改（`git status` 无）；`workbench/src/s6/l2.ts`、`components/S4DetailPanel.vue`、`components/S3Panel.vue`、`demo/.../frontend/src/App.vue` 的 S6a 选择器仍在 |
| 3 | 无行级字段写入/对象深采/多方法 L2/CompletableFuture/@Async/长生命周期池自动传播/跨服务 | PASS | `dispatch-s6b.md` §2（39）、§11 第 6 条；`s6b-plan.md` §2（29）、§14；`api.v1.md` §10.11“仍无”段（1279–1283）；`event-model.v1.md` §9 S6b 边界（418–427）、§13.2（683–689）；fixtures 的 `negativeAssertions`/`forbiddenTexts` |
| 4 | 不把 S6b 能力写成 S6 全量；README/验收必须如实写“未支持” | PASS | `dispatch-s6b.md` §5.6（159–160）、§11 第 6 条；`s6b-plan.md` §15（320–322）；fixtures README 首段“测试数据非运行时证据” |

### 2.2 契约（用户核验项 2）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 5 | 异步**创建时**继承；`childValue` 深拷贝；per-request 单线程池；`originThreadId`/`ASYNC_INHERITED`；同线程不带 flag；长生命周期/已存在线程不计假 span、复用旧 worker 可能过期 trace 的非宣称 | PASS | `api.v1.md` §10.11 采集口径 1–2（1229–1238）；`event-model.v1.md` §4.4.8（268–282）、§13.1（669–682）；`dispatch-s6b.md` §3 async 行（46–48）、§4.2（75–81）；`s6b-plan.md` §4.1（44–75）、§5.1（126–136） |
| 6 | no-debug：`NOT_COLLECTED_NO_DEBUG_INFO`、逐字 reason、flag `NO_DEBUG_INFO`、无 `values`、无行号/变量名；LVT 回退即 FAIL；`source` 缺失或 line=null | PASS | `api.v1.md` §10.11 采集口径 3（1239–1246）、附录 G（1459–1497）；`event-model.v1.md` §4.4.9（283–296）；`dispatch-s6b.md` §3 no-debug 行（49–51）、§4.3（83–88）；`s6b-plan.md` §4.3（98–112）、§5.4（161–168） |
| 7 | 循环折叠：cap 20；首 6+后 6+中段样本；坏 `to=0` 优先；`VALUES_CAPPED`/`VALUES_TOTAL` 成对；事件级 `TRUNCATED`；保留项 `truncated=false`；无静默丢弃；`times≤~20` 不折叠；`reconcileAmount` 1/2/1 不变 | PASS（N4 语义注记） | `api.v1.md` §10.11 采集口径 4（1247–1256）；`event-model.v1.md` §4.4.10（297–311）；`dispatch-s6b.md` §3 loop 折叠行（53）、§4.4（90–95）；`s6b-plan.md` §5.3（147–159）；`fixtures/s6b-loop/**` |
| 8 | 端点附录 G 三端点；graph 15 字段；业务路由 9；meta 5；schema 不变 | PASS | `api.v1.md` §2.7（219–240，明确“collector 零 diff/9 路由/10 含 health”）、§10.11（1223–1284，15 字段/5 键/9 路由）、附录 G（1459–1497）；`schema/traceboard.event.v1.json` SHA256 `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` 未变；`transport.v1.md` `44418a3a…`、`status-semantics.md` `9a8735a0…` 未变 |
| 9 | 只加性、历史保留；不改既有 `list/cancel/preview-discount/reconcile` | PASS | `git diff --numstat`：api `135+/1-`、event-model `102+/2-`，删除行仅为头部日期行；新增 §2.7/§10.11/附录 G 与 §4.4.8–10/§7/§9/§13；demo 既有端点未改（`OrderController` 当前只有 list/cancel/previewDiscount/reconcile） |

### 2.3 Fixtures（用户核验项 3）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 10 | 离线 Ajv 2020-12 strict；schema 合法 | PASS | 本机实测 `s6b-async lines 6 schema ok 6`、`s6b-no-debug lines 2 schema ok 2`、`s6b-loop lines 4 schema ok 4`；`expected-facts.json` 均可 `JSON.parse`；未装新依赖，复用 `tools/verify/node_modules/ajv` |
| 11 | async：6 事件、同 trace/父/线程 flag、values 1/2/1、第 2 次 `100→0`、3 service `thread.id=57` 且 ≠ controller `44`、`ASYNC_INHERITED` 仅在 service | PASS | `fixtures/s6b-async/events.ndjson`（6 行）；结构实测：roots 1、服务线程 [57,57,57]、controller 44、values [1,2,1]、returns [100,0,100]、startNs 严格递增；flag 链 `S2_ZERO_ROW_CHAIN,L2,ASYNC_INHERITED`；README/expected-facts 的 `flagsAreContainsOnly`/`asyncFlagOnlyOnServiceSpanIds` |
| 12 | no-debug：2 事件、合法游离根/父、status/reason/flag、无 values、无 line/source、return 200 | PASS | `fixtures/s6b-no-debug/events.ndjson`（2 行）；controller 根 `parentSpanId=null`、`confidence=LOST`、`LOST_BACKEND`、`rootEventId=click_lost_d000000000000001`（合法 §5 例外）；service `status=NOT_COLLECTED_NO_DEBUG_INFO`、`reason="LocalVariableTable missing"`、`NO_DEBUG_INFO`、无 `values`、无 `source`、return 200；schema 2/2 通过 |
| 13 | loop：4 事件、20 values、total 102、cap 82、bad `50→0`、首 `from=null`、末 `to=50`、保留项 `truncated=false`、升序 | PASS | `fixtures/s6b-loop/events.ndjson`（4 行）；实测 `values.length=20`、`20+82=102`、badValueIndexes [9]、首项 `{from:null,to:0}`、末项 `{from:49,to:50}`；`valuesTotalFlag=102`/`valuesCappedFlag=82`；schema 4/4 通过 |
| 14 | expected facts 含请求/图/节点 15 键/values/理由/flags/工作台期望/反向断言；仅测试数据；无 secret/`s_s3demo` | PASS | 三个 `expected-facts.json` 均含 `apiExpectations`/`workbenchExpectations`/`facts`/`negativeAssertions`；README 首段“非运行时证据”；会话 `s_s6basync/s_s6bnodebug/s_s6bloop`；未发现真实 secret/CDN/镜像（扫描仅本地 URL 与“无真实 secret”说明） |

### 2.4 计划可行性（用户核验项 4）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 15 | `InheritableThreadLocal` `childValue` 深拷贝、per-request 单 worker、`originThreadId`/`ASYNC_INHERITED`、旧池/旧 worker 不计假 span | PASS | 当前 `SpanContext.java` 72–77 为 `ThreadLocal`、90–134 `Frame` 可变集合、370–397 `enterL2` 从父 controller 帧取 `childCallCounts`；改为 `InheritableThreadLocal` + 每帧拷贝是局部改造；`ExecutorService` 首次 submit 在请求线程创建 worker（JDK 语义），正好在 controller 帧打开后复制；无父帧走既有 `l2_no_parent`（770–775）不伪造 |
| 16 | antrun `javac debug="false"` 在 `process-classes` 覆盖 `NoDebugService`；`javap -l` 预检；agent no-LVT transformer；Ant 依赖/网络风险 | PASS（N7） | `demo/.../backend/pom.xml` 当前无 antrun，可加 3.1.0；本机 `~/.m2` 有 `maven-antrun-plugin:3.1.0`、无 `org.apache.ant:ant:1.10.12`（实测）；`dispatch-s6b.md` §8（190–195）已写依赖预检/离线停止/不换镜像；`javap -l` 口径见 `s6b-plan.md` §4.3（110–112） |
| 17 | ASM 两方法 + 独立 no-debug transformer；Byte Buddy ignore；`reconcileAmount` 仍恰 2 探针、loop ≥2；fold 6+6+样本/坏值优先；事件 `TRUNCATED` | PASS（N1） | 当前 `L2ClassFileTransformer` 140–145 对 `boundaries.size()!=2` fail-open、230–243 单 `DRETURN` 校验、358–364 计数；`TraceAgent` 100 已 ignore `L2_SERVICE_TYPE`，需新增 `NoDebugService`；`L2Values` 23 当前 30 项、64–88 尾部截断，改为 20+fold；`SpanEmitter` 116–205 当前无 reason 参数，需加可选 reason；均在 S6b 范围内 |
| 18 | workbench UI async/no-debug/fold；perf 脚本；S6B-A..F；S6 验收/备份/tag | PASS | `s6b-plan.md` §7（182–192）、§8（194–200）、§9（202–211）、§15（318–322）；当前 `S4DetailPanel` 已有 `#s6-l2-badge`/`#s6-l2-note`，新增 `#s6-async-badge`/`#s6-no-debug-*`/`#s6-fold-note` 是局部模板；`tools/perf/l1-overhead.mjs` 提供可复制骨架；S6a 已有 `tools/verify` 迁移先例 |

### 2.5 风险、安全、偏离（用户核验项 5–7）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 19 | 风险表覆盖池复用/antrun/javac/no-LVT/折叠计数/perf 方差/S6a 回归；停止条件 | PASS | `dispatch-s6b.md` §10（208–217）、§11（219–226）；`s6b-plan.md` §12（285–294）、§13（296–303）；风险缓解与实测环境（ant 缺失、JDK8/JDK21、端口）一致 |
| 20 | 无真实 secret/PII/CDN/镜像/外部网络；仅本地回环；Maven Central 例外明确 | PASS | `dispatch-s6b.md` §0 第 4 条（12）、§4.6（110）、§10 末行（217）；fixtures/docs 扫描无 secret/CDN/镜像；`api.v1.md` 既有“无外部 CDN/遥测/鉴权”约束；Maven Central 正常解析在 §0/§8 明确允许且不可换镜像 |
| 21 | 偏离 D1–D8 是否可接受、是否弱化 | PASS（N2/N3） | D1 实际 6+6 与 dispatch §3 一致（任务卡“前10+后5”引用不实，N2）；D2 事件级 `TRUNCATED` + 保留项 false 与 dispatch §3/§4.4 一致；D3 浏览器链 6/4 事件、`backendSpanCount` 4/2 与 §4.1/§10.11 的“浏览器链 6/4，脚本无头 4/2”一致；D4 reason 逐字 `LocalVariableTable missing` 满足 schema 与 event-model §6“建议”口径（N3）；D5–D6 命名/描述符一致；D7 探针以日志为准（N1）；D8 agent 用 JDK21 沿用 S6a 实测、jar major 52 不变（N8） |
| 22 | 不实现/不宣称 S7+ 与 S6b 不做项 | PASS | 契约“仍无”段、§13.2、fixtures `forbiddenTexts`、`s6b-plan.md` §2/§14；未发现 `CompletableFuture`/`@Async`/`kind=field`/`valueRef`/多方法/长生命周期自动传播的实现或宣称 |

### 2.6 门禁迁移与“不放宽”（用户核验项 4/5；v1 的 2 个 FAIL 点已在复评关闭）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 23 | G1 冻结 supersede 完整：`S6B_G1_FREEZE` 14 项、`S5_G1_FREEZE` 18 项集合/数量、`S6A_G1_FREEZE` 8 项中 6 项零漂移、api/event-model 由 S6B 覆盖；`S2-L/S3-2/S4-H/S5-G/S6A-E` 用 `LATEST_G1_FREEZE` | PASS（N9/N10） | `dispatch-s6b.md` §4.7（113–116）、§7（179–188）；`s6b-plan.md` §10（213–226）、§9 S6B-E（210）；当前 `verify.mjs` 399–480 `LATEST_G1_FREEZE`、11594–11632 S6A-E、9778–9814 S5-G 结构可迁移；`S6B_G1_FREEZE` = api+event-model+9 fixture+s6b-plan+dispatch-s6b+plan-review-s6b = 14 |
| 24 | 所有旧 S6a 文案断言的迁移闭环（S3-1/S3-6/S4-F/S5-D/S5-E **以及 S6A-B/S6A-D**） | **PASS（B1 关闭）** | v1.1 `s6b-plan.md` §10（224–231）新增 `S6A-B`/`S6A-D` 行并写死 `S3-1` 的 `"S6a"`→`"S6"`：`S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE` 取自 `api.v1.md` §10.11（`S6：L2 行级…`，banner 含“长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持”）；旧三段仅作 `S5_STALE_TEXTS` 反向字面量。原 v1 证据（`verify.mjs:11040`、`449–455`+`11477`、`5520–5533`、`9453`/`9624`、`218`/`277`）仍成立但已被覆盖；`verify.mjs` 未改动（tester 按 §10 迁移）。 |
| 25 | 禁项/白名单只增不减，不弱化既有断言 | **PASS（B2 关闭）** | v1.1 §10（232–235）：`S5_FORBIDDEN_CLAIMS`（`verify.mjs:385` 现为 `["kind=local","L2 已采集"]`）**追加** 6 条、**保留**原 2 条、`length >= 8`；`S6A-E` `claimTexts` 原 6 条（`11688–11690`）**保留**、白名单只对路径豁免；`S3-8/S4-I/S5-H` 的 `L2/local` 与 `async-continuation`（`9873` 正则）对非白名单文件仍全域禁；S6B-F 增只增不减断言。 |

## 3. Blocking（v1 记录；**G1 复评：B1/B2 均已关闭**）

### B1（Blocking；v1）S6A-B/S6A-D/S3-1 仍断言旧 S6a 文案，与 §4.5 的 stale 零命中互斥 — **已关闭**

- **关闭依据（v1.1）**：`s6b-plan.md` §10（224–231）新增 `S6A-B`（`11040` → `S6_BANNER`、端点 7 映射、删“其余断言不变”、加 async/loop btn token）、`S6A-D`（`449–455`/`11477` 三 token → `S6_*`、保留 `s6-l2-badge`/`s6-l2-note`/`data-value-kind`/`data-invocation-diff`/`行号 `/`100 → 0`/`值变化`、`11560` 取迁移后长度）、`S3-1`（banner → `S6_BANNER`、`"S6a"`→`"S6"`、追加 btn token）、`S3-6/S4-F/S5-D/S5-E`（统一 `S6_*`）、`S5_STALE_TEXTS` 追加旧三段全文、源码侧 canonical 单一来源、S6B-F 反向断言。复评实测 `api.v1.md:1270` banner 逐字以 `S6：` 开头（`S6_BANNER` 可达），旧三段与 canonical 文本互异（stale 不误报），`verify.mjs` 未改动（迁移由 tester 执行）。
- **v1 证据（历史保留）**
  - `tools/verify/verify.mjs:11040`（S6A-B）断言 demo 前端源码 `appSource.includes(S6A_BANNER)`；`s6b-plan.md:224` 明写 S6A-B“其余断言不变”。
  - `tools/verify/verify.mjs:449–455` 定义 `S6A_BANNER`/`S6A_L2_NOTE`/`S6A_XN_NOTE`，`11477` 用 `S6A_WORKBENCH_TOKENS` 对 workbench dist 逐 token 断言；`s6b-plan.md` §10 没有 S6A-D 迁移行。
  - `tools/verify/verify.mjs:5520–5533`（S3-1 `demoTokens`）含 S6a banner 与字面 token `"S6a"`；plan 的 S3-1 行只说“S6a banner/L2/×N 替换为 §4.5 canonical”，未点名 `"S6a"` token。
  - `dispatch-s6b.md` §4.5（104）与 `s6b-plan.md` §10（222）要求旧 S6a 三段在 `workbench/src`、`workbench/dist`、`demo frontend/src`、`demo dist` **全部零命中**；实现该要求后，上述 S6A-B/S6A-D 断言必然失败。
  - 同类先例：`plan-review-s6a.md` §9.1 B8 已把“旧 banner 断言”与“stale 零命中”视为互斥并作为 Blocking 处理。
- **为什么是阻断**：S6B-E 是一次 `tools/verify` 全量跑 S0–S6a；S6A-B/S6A-D 是 S6a 门禁，不在“S0–S5 锚点”豁免内。若不迁移，S6b 无论实现多正确都无法 exit 0；若为了过门禁保留旧 S6a 文案，则违反 §4.5/§10 的 stale 反向断言与 S6B-F“旧 S6a 口径零命中”。两条路都不满足 G1。
- **精确修法**
  1. 在 `s6b-plan.md` §10 增加两行（或扩展现有行）：
     - `S6A-B`：把 demo 前端静态断言从 `appSource.includes(S6A_BANNER)` 改为 `appSource.includes(S6_BANNER)`；保留 `#btn-reconcile`/`fetch("/api/orders/1/reconcile", {method:"POST"})`/plain handler/no `wrapFn`/no `loadOrders` 断言；若新增 `#btn-reconcile-async`/`#btn-reconcile-loop`，同时加对应静态 token。
     - `S6A-D`：`S6A_WORKBENCH_TOKENS` 中的 `S6A_BANNER`/`S6A_L2_NOTE`/`S6A_XN_NOTE` 替换为 `S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE`；保留 `s6-l2-badge`/`s6-l2-note`/`data-value-kind`/`data-invocation-diff`/`行号 `/`100 → 0`/`值变化` 等 S6a 选择器 token；label/detail 同步。
  2. `S3-1` `demoTokens`：把 S6a banner 替换为 `S6_BANNER`；把 `"S6a"` token 改为 `"S6"`（或删除，但不要以“其余 token 保留”名义保留 `"S6a"`）；`"L2"` 仍由 canonical 覆盖。
  3. `S6A_EVIDENCE.workbench.tokens`（`verify.mjs:11560`）改用迁移后的 token 集长度；`S6A-D` 的 label 不再写“canonical S6a banner/L2 note/×N note”。
  4. `S5_D`/`S5_E`（`9453`/`9624`）与 `S3_1`/`S3-6`/`S4-F` 已由 plan 行覆盖，但实现时统一引用 `S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE` 常量，避免再次漂移。
  5. `S5_STALE_TEXTS` 增加三整段（不是只加“属 S6b”子串）：S6a banner、S6a L2 说明、S6a ×N 注记；`workbench/src/s6/l2.ts` 的 `S6A_BANNER`/`S6A_L2_NOTE` 删除或改为 canonical re-export；`demo/.../frontend/src/App.vue`、`workbench/src/App.vue`、`components/S3Panel.vue`、`components/S4DetailPanel.vue`、`s4/derive.ts` 全部改为 canonical 引用。
  6. 加一条 S6B-F 反向断言：`workbench/src`、`workbench/dist`、`demo frontend/src`、`demo dist` 对三条旧 S6a 文案零命中（与 S5_D stale 断言同源），且 S6A-D 的旧 token 不再被任何门禁引用。

### B2（Blocking；v1）“S5_FORBIDDEN_CLAIMS 更新”可能替换既有两条禁项，S6A-E 旧 overclaim 未明确保留 — **已关闭**

- **关闭依据（v1.1）**：§10（233）改为“**追加** 6 条 / **保留** `kind=local`/`L2 已采集` / `length >= 8`”；§10（234）`S6A-E` 6 条 `claimTexts` **保留**、白名单只做路径豁免；§10（222）`S3-8/S4-I/S5-H` 把 `L2/local` 与 `async-continuation`（`verify.mjs:9873` 正则）列入非白名单全域禁；§10（235）S6B-F 增只增不减与“旧 `S6A_*` 不再被正向引用”。复评实测 `verify.mjs:385` 与 `11688–11690` 的当前 2/6 条文本与 plan 引用逐字一致，白名单路径覆盖 `agent` S6b 文件/`workbench/src/s6/**`/`NoDebugService.java`/`docs/plans/stages/S6/**`/`fixtures/s6b-*/**`/`tools/perf/l2-overhead.mjs`。
- **v1 证据（历史保留）**
  - `tools/verify/verify.mjs:385` 当前 `S5_FORBIDDEN_CLAIMS = ["kind=local", "L2 已采集"]`；S5-D 在 `9477–9484` 附近按该数组扫描 workbench/demo src+dist。
  - `s6a-plan.md:209` 明确写“`S5_FORBIDDEN_CLAIMS` 保留 `kind=local`/`L2 已采集`”；`s6b-plan.md:223` 只写“`S5_FORBIDDEN_CLAIMS` 更新：禁‘异步全量传播/线程池自动传播/无调试可采变量/循环全量/开销达标/L2 开销 ≤40%’”，没有“保留”二字。
  - `tools/verify/verify.mjs:11688–11690`（S6A-E）仍有 6 条 `claimTexts`：`异步上下文已采集`、`无调试信息已处理`、`循环折叠已实现`、`L2 开销 ≤40%`、`全部方法 L2`、`L2 已采集`；plan 的 S6A-E 行（225）只说“无 S6b 能力反向断言改为白名单”，未说保留这 6 条。
  - `S3-8`/`S4-I`/`S5-H` 的 `L2/local`/`async-continuation` 标记（`6357`、`8916`、`9860` 附近）是“非白名单文件全域禁”的核心；plan 的 S3-8 行只列“SSE/WS/Tomcat/cloud/react/持久化/像素”为其余全域禁，未列 `async-continuation`。
- **为什么是阻断**：`S5_FORBIDDEN_CLAIMS` 若被“更新”为 6 条新数组，`kind=local`/`L2 已采集` 两条旧禁项消失，等于放宽既有断言；`S6A-E` 的 6 条 overclaim 是防止“把 S6b 说成 S6 全量”的最后一道静态门禁，不能因新增 S6b 白名单而删除。dispatch §7 明确“不放宽其余断言”。
- **精确修法**
  1. `s6b-plan.md` §10 的 `S5_FORBIDDEN_CLAIMS` 行改为：“**追加** `异步全量传播`/`线程池自动传播`/`无调试可采变量`/`循环全量`/`开销达标`/`L2 开销 ≤40%`；**保留** `kind=local`/`L2 已采集`；数组总数只增不减。”
  2. `S6A-E` 行明确：“`claimTexts` 原 6 条**保留**；新增 S6b 白名单只对 `scopeFiles` 的 `s6bHits` 做路径豁免，不删除/改写任何 claim 文本”；`S6A-E` 的 label 同步。
  3. `S3-8`/`S4-I`/`S5-H` 行明确：“`L2/local` 与 `async-continuation`（`AsyncContext|CompletableFuture|setTimeout(span|continuationSpan|async_hooks`）对**非 §10 白名单文件**仍全域禁；白名单仅限 `agent` 的 S6b 文件、`workbench/src/s6/**`、`NoDebugService.java`、`docs/plans/stages/S6/**`、`fixtures/s6b-*/**`、`tools/perf/l2-overhead.mjs`。”
  4. 在 S6B-F 增加一条“禁项只增不减”断言：`S5_FORBIDDEN_CLAIMS.length >= 8` 且包含原 2 条 + 新 6 条；`S6A-E` 的 6 条 claim 文本在 `claimTexts` 中仍存在（可用常量/长度断言）。

## 4. Non-blocking（建议/实施注记；可在同一轮返工顺手处理）

### N1（技术事实，必须写入测试口径；**复评：已落实**）loop 实际探针为 4 个，不是“for 行/if 行/锚点行”的 3 个

- **复评落点**：`s6b-plan.md` §4.2（95）、§5.2（140）、S6B-C（210）、D7（330）、§12（307）与 `fixtures/s6b-loop/README.md:44`、`expected-facts.json.runtimeProbeExpectations.probes` 均为“实测 4 / 自检 ≥2 / 记录实际 / 不硬断言 3”；`dispatch-s6b.md` §4.4 的“期望 3”为 dispatcher 绑定文本，已由 D7 记录偏离并以日志/字节码为准（dispatch 不在本文件修改范围，不阻断）。

- 证据：用 JDK8 `javac 1.8.0_221` 编译 `s6b-plan.md` §4.2 的 loop 形状并 `javap -l -c` 实测，`local` 的 LVT 为 `Start=16 Length=39`；`LineNumberTable` 为 init/for/增量/if/锚点/return。按 `L2ClassFileTransformer` 的“上一行最后一条真实指令不以 jump/return 结束”边界规则，候选边界是 **4 个**：`local` 初始化行（基线 `null→0`）、增量行（`0→1`）、if 行（`50→0`）、锚点行（只读，不产生变化）；`for` 行边界因前一条是 `if_icmpgt` 被跳过。`s6b-plan.md` §4.2（95）与 D7（315）、`dispatch-s6b.md` §4.4（92）、`fixtures/s6b-loop/README.md` 的“期望 3”均与实测不符，但**不影响 102 次观测/20 项折叠/坏值保留**。
- 建议：把“期望 3”改为“实际 4（init/增量/if/锚点）且 ≥2 才安装”；S6B-C 只断言 `l2_probes_installed method=reconcileLoop` 存在、探针数 ≥2、无 `l2_probe_missing`，并记录实际值；不要在 S6B-C/验收报告硬断言 3。若坚持“3”，必须改 demo 代码形状（例如把 `local` 初始化与 `for` 同行会丢掉基线探针，反而破坏 `null→0`，不推荐）。
- 该条不阻断：plan 的 D7 已把“实际/≥2”写入，fixture 的 `runtimeProbeExpectations.probes` 也写“accepts >=2”；只需把“期望 3”表述修正，避免测试作者误写硬断言。

### N2 D1/D2 的“任务卡”引用不实

- `s6b-plan.md` §14 D1 写“任务卡写 cap 20‘前 10 + 后 5’”，但 `dispatch-s6b.md` §3 逐字是“前 6 + 后 6 + 中段均匀样本”；D2 写“任务卡写 loop fixture ‘truncated true’”，未找到对应任务卡原文。实际决策均与 dispatch 一致，**不弱化**；建议把“任务卡”改为“早期摘要/笔误”或直接删除引用，避免后续误读。

### N3 D4 reason 逐字值与 status-semantics 示例的张力

- `status-semantics.md` §6 示例是 `nodebug:no_local_variable_table`，并写“**建议** `category:detail` 小写形式”；`LocalVariableTable missing` 含大写/空格但非空、≤512、可解释，schema 合法，`event-model.v1.md` §6 也只说“形态建议”。dispatch §1/§3/§4.3 固定逐字值，S6b 以 dispatch 为准是正确取舍。建议在 `s6-acceptance.md` 注明“reason 采用 dispatch 逐字值，不采用 status-semantics 示例形态；status-semantics 字节未变”，避免后续把它当契约违规。

### N4 status-semantics §3“值级 truncated=true”与事件级 TRUNCATED 的语义说明

- `status-semantics.md` §3 写“截断/折叠/采样：值级 `truncated=true`；事件级可在无值项时用 `status=TRUNCATED` + flags/reason”。S6b 采用**事件级** `TRUNCATED` + `VALUES_CAPPED`/`VALUES_TOTAL`，保留项 `truncated=false`（真值未截断、列表被折叠）。`event-model.v1.md` §4.4.10 已明确该语义，且 schema/枚举未变、无静默丢弃；建议在 `s6b-plan.md`/`s6-acceptance.md` 增加一句交叉引用“折叠是列表级，不是单值截断；status-semantics 的‘值级 truncated’不适用于列表折叠”，避免评审/测试误判。该条不阻断，因为事件级 `TRUNCATED` 是 v1 既有状态且可见性满足“不得静默”。

### N5 S5 L1 面板的“局部变量（L2）与行级属 S6，本阶段未采集”仍被 S5-D 断言

- `workbench/src/s5/values.ts:20` 的 `L1_STATIC_NOTE` 仍含该句；S6a 起 L2 已在 `reconcileAmount` 落地，S6b 又加 `reconcileLoop`。该句可读作“S5 L1 清单不含局部变量”这一阶段说明，但“本阶段未采集”在 S6b 后容易被误读为“L2 未采集”。建议改为“S5 L1 清单不含局部变量；L2 行级仅 S6b 的两个 demo 方法（reconcileAmount/reconcileLoop）”，并同步 S5-D 的 `s5WorkbenchTokens`；若不想动 S5 文案，至少在验收报告注明这是 S5 阶段标签。非阻断（不构成虚假能力宣称）。

### N6 脚本无头 4-span 变体没有独立运行时断言

- `fixtures/s6b-async/README.md` 与 `expected-facts.json` 的 `scriptedVariantNote` 已说明无头 curl 是合法 4-span LOST 子链（controller 游离根 + 3 个继承 LOST 的 service），`backendSpanCount` 仍 4；但 S6B-A 的运行时表只写“带 `traceparent`/`X-TraceBoard-Click` 的浏览器链”。建议在 S6B-A 增加一条无头 curl（不带 headers）断言：4 个后端 span、3 个 service 仍带 `ASYNC_INHERITED`、controller `LOST_BACKEND`；或明确写“浏览器链 6 事件/4 后端 span 即满足 §4.1 的 4-span 口径，脚本无头变体仅形状说明”。非阻断，但能消除“脚本化（无 SDK）恰 4 span”与 fixture 6 事件的表面冲突。

### N7 Ant 1.10.12 本机缺失与 `javac` 空格路径的预检

- 本机实测 `~/.m2/repository/org/apache/maven/plugins/maven-antrun-plugin/3.1.0` 存在、`org/apache/ant/ant/1.10.12` 不存在；dispatch §8 已写“首次构建需 Maven Central 正常解析，离线不可解析即停止、不换镜像”。建议在 `s6b-plan.md` §11 增加一条 `mvn -o` 预检或 `~/.m2` 存在性检查；并确认 Ant 1.10.12 对 `executable=${java.home}/bin/javac` 的 Windows 空格路径引用（`C:/Program Files/Java/jdk1.8.0_221`）可用；若不可用，按 dispatch §8 的 compiler-plugin 二次执行需 dispatcher/acceptance 书面批准，验收口径（无 LVT/LineTable/SourceFile、L2DemoService 仍有 local:D）不变。非阻断（风险已登记）。

### N8 D8 agent 用 JDK21 构建与 dispatch §12 “JDK8（demo/agent）” 的差异

- `s6b-plan.md` §11 用 `JAVA_HOME="$JAVA21"` 构建 agent，D8 记录“沿用 S6a 实测”；`agent/pom.xml` 的 `maven.compiler.release=8` 保证 jar major 52。dispatch §12 的环境括注 `JDK8（demo/agent）` 是清单描述，实际 S6a 已用 JDK21 且产物 major 52。建议在 S6 验收报告明确“agent 构建 JDK21、target 8/major 52，demo 构建/运行 JDK8”，不要让测试误以为 agent 必须用 JDK8。非阻断。

### N9 `S6A_G1_FREEZE`/`S6A-E` supersede 的标签与 8 项计数

- plan §10 已写“S6A_G1_FREEZE 8 项中 api/event-model 由 S6B 覆盖，其余 6 项零漂移；`S2-L/S3-2/S4-H/S5-G/S6A-E` 统一用 `LATEST_G1_FREEZE`”。当前 `verify.mjs:11594–11615` 的 S6A-E 仍直接遍历 `S6A_G1_FREEZE` 并 label “8 files”；实现时需把 expected 改为 `LATEST_G1_FREEZE[rel]`，保留 `Object.keys(S6A_G1_FREEZE).length===8` 与 6 项实际零漂移，label 改为“api/event-model superseded by S6b”。非阻断（plan 已表达，属实施注记）。

### N10 `plan-review-s6b.md` 自身哈希的自引用

- `S6B_G1_FREEZE` 14 项含本文件；本文件无法包含自己的 SHA256（写入即变）。建议按 S6a 先例：本文件 §5 只登记其余 13 项实测哈希，第 14 项由 tester 在本文件最终落盘后计算并写入 `tools/verify`；不得把“评审文件哈希”写成占位值或跳过。非阻断。

### N11 `S6B-A` “恰 4 span”与 fixture 6 事件的措辞

- `s6b-plan.md` §9 S6B-A 写“恰 4 后端 span”，fixture 是浏览器链 6 事件；`api.v1.md` §10.11 已写“浏览器链 6/4、脚本无头 4/2”，`backendSpanCount` 是 4。建议在 S6B-A 明确“总 span 6（浏览器链）/后端 4”，避免测试把“4”误当总 span。非阻断。

### N12 `javap -l` 不能证明 `SourceFile` 缺失

- `s6b-plan.md` §9 S6B-B 用 `javap -l` 证明无 LVT/LineNumberTable；`event-model.v1.md` §4.4.9 还要求无 `SourceFile`。`javap -l` 不显示 `SourceFile`，建议 S6B-B 增加 `javap -v`（或对 `source` 缺失/`line=null` 做事件断言）以证明 `SourceFile` 也被 `-g:none` 移除；或明确“`source` 缺失/空由事件断言证明，不依赖 javap 显示 SourceFile”。非阻断（测试已断言 source 缺失）。

### N13 `S5_STALE_TEXTS` 重复加入 `无异步/×3`/`无构建期局部变量/L2`

- 这两条已在 `S5_STALE_TEXTS`（`verify.mjs:376–384`）中；plan §10 说“追加”会重复。数组重复不影响 `includes` 语义，但建议去重，保持门禁可读。非阻断。

### N14 `S5-E`/`S4-F` 的 label/detail 仍含 “S6a” 字面量（非断言）

- `verify.mjs:9628`（S5-E label “S6a canonical copy”）、`9629`（detail `demoText.includes("S6a：L2DemoService")`）、`8269`（S4 label “canonical S6a ×N note”）是显示文本/诊断字面量，不是阻断性断言；但 plan §10（225/235）要求“旧 S6a 三段不得被任何正向 token 引用、旧 `S6A_*` 不再被正向引用”。实现时把上述字面量一并改为 `S6_*`/canonical 表述，避免与 S6B-F 反向断言口径冲突。非阻断。

### N15 `dispatch-s6b.md` §7 旧措辞与 plan §10 的字面冲突

- `dispatch-s6b.md` §7 的 `S6A-B` 行仍写“其余断言不变”、`S5_FORBIDDEN_CLAIMS` 行仍只写“更新：禁 5 条”，与 plan v1.1 §10（226 明写“删除‘其余断言不变’”、233 明写“追加 6 条 + 保留 2 条”）字面相反。以 dispatch §4.5（旧的旧三段四树零命中）与 §7 标题“不放宽其余断言”为准，plan §10 是 B1/B2 的关闭方案；dispatcher 文档已冻结，不在本轮改动。S6 验收/tester 不得据 dispatch 旧句回退迁移。非阻断。

## 5. SHA256 冻结清单（G1 复评后由 tester 登记）

> 以下为 2026-11-24 评审时实测（`sha256sum`）；G1 返工后若文件变更，以复评实测为准。`S6B_G1_FREEZE` 共 14 项 = `api.v1.md` + `event-model.v1.md` + 9 个 S6b fixture 文件 + `dispatch-s6b.md` + `s6b-plan.md` + `plan-review-s6b.md` 自身（第 14 项由 tester 在本文件最终落盘后计算，避免自引用；见 N10）。下表另列 `schema`/`transport`/`status` 三项作为不变参考（属 `S5_G1_FREEZE`/S6a 冻结，不在 S6B 14 项内）。

| 文件 | SHA256 | 状态 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 不变（S5/S6a 冻结值） |
| `docs/contracts/api.v1.md` | `e1d7202ade2fad5f8665079e9f1b914a99ed29346a9000c9393cca6f689c6010` | S6b 加性修订（S6B supersede S6A `4c895fd7…`） |
| `docs/contracts/event-model.v1.md` | `06aecbfe82672edb4df277ee96325faf190b2be46b458f205aa04a7ab0fc2f38` | S6b 加性修订（S6B supersede S6A `fc6ad919…`） |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` | 不变 |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 不变 |
| `fixtures/s6b-async/events.ndjson` | `d03c2f8d804262569e0b2e3f33b9ecc0b74aee9bba340c60975ac6bab10275df` | S6B 新增（6 行） |
| `fixtures/s6b-async/expected-facts.json` | `7f0d484f33be5f38b113507c0bb889f2e227c9cdb3f42a158d5c3c0202b92468` | S6B 新增 |
| `fixtures/s6b-async/README.md` | `3d47e54ab389657464c7231eaef7e252072281a420fce8b9f32918e558b86a36` | S6B 新增 |
| `fixtures/s6b-no-debug/events.ndjson` | `caa25a1a6ca6ff3600705bada2ada909302ab8801c5b43cd8981734b4d8bd4c2` | S6B 新增（2 行） |
| `fixtures/s6b-no-debug/expected-facts.json` | `1e0badaa8773bbe083f0eb7bac8c04e2667ffaff617ca979072692dc7c5d50c1` | S6B 新增 |
| `fixtures/s6b-no-debug/README.md` | `58339d834972954e8b04036f0e3d91d29741efcc73ce756254f81a9bbb5ba772` | S6B 新增 |
| `fixtures/s6b-loop/events.ndjson` | `e21c3202cbf1a21a7537133d3291b872f2842e0c01c157bdd90f80e47e399c94` | S6B 新增（4 行） |
| `fixtures/s6b-loop/expected-facts.json` | `228b55c8c2f8f164b44209bb2ef9584c8129fdae2522afafc95f9e516f1a0ac6` | S6B 新增（v1.1 更新探针口径后复评值；v1 `344efdfa…` 已失效） |
| `fixtures/s6b-loop/README.md` | `15a551dd40b3334b314b003e7d3ac651a9f2dcdc7ff657e9195c299d1a030cab` | S6B 新增（v1.1 更新探针口径后复评值；v1 `4e5289ea…` 已失效） |
| `docs/plans/stages/S6/dispatch-s6b.md` | `690b16e63efc391f8d66765da96de4985c6f2c733532e78ab2203d2f405043c7` | dispatcher 所有；G1 后冻结 |
| `docs/plans/stages/S6/s6b-plan.md` | `f237685d3101f0b21d1b416a8c0162869080d6c7d88fd8bb1c59459cbbaa546b` | plan-writer v1.1（复评对象；v1 `73b545f6…` 已失效，v1.1 变更记录见其 §16） |
| `docs/plans/stages/S6/plan-review-s6b.md` | 待本文件最终落盘后由 tester 计算（第 14 项） | 不自引用（N10） |

- **S5 16 项 + S6A 6 项**：按 `LATEST_G1_FREEZE` 仍取各自冻结字节；`S5_G1_FREEZE` 18 项集合/数量断言保留，S6A 的 6 项（S6a fixture 3、s6a-plan、dispatch-s6a、plan-review-s6a）按 S6a 哈希零漂移。
- **复评重算（v2）**：v1.1 只改 `s6b-plan.md` 与 `fixtures/s6b-loop/{README.md,expected-facts.json}`；`fixtures/s6b-{async,no-debug,loop}/events.ndjson` 三个哈希与 v1 完全一致（`d03c2f8d…`/`caa25a1a…`/`e21c3202…`），`dispatch-s6b.md` 仍 `690b16e6…`，api/event-model 仍 `e1d7202a…`/`06aecbfe…`（未再改），schema/transport/status 仍 `927937df…`/`44418a3a…`/`9a8735a0…`（字节不变）。
- **字节不变实测**：`schema`/`transport`/`status` 与 S6a 冻结值一致；`git status --short` 只显示 `docs/contracts/api.v1.md`、`docs/contracts/event-model.v1.md` 修改与 S6b 文档/fixture 新增，未出现 `schema/`、`collector/`、S0–S6a fixture 改动。

## 6. 最终 G1（复评 v2）

**G1: PASS**

- Blocking：**0**。B1（S6A-B/S6A-D/S3-1 旧 S6a 文案迁移，含端点 7 映射与 `"S6a"`→`"S6"`）与 B2（`S5_FORBIDDEN_CLAIMS` 追加 6 保留 2、`S6A-E` 6 条 claim 保留、`async-continuation` 全域禁、只增不减断言）均由 `s6b-plan.md` v1.1 §10（224–235）关闭；复评实测旧证据行号/字面量仍与 `verify.mjs` 一致，plan 引用无误。
- Non-blocking：15（N1 已落实；N2–N13 为实施注记；新增 N14 字面量清理、N15 dispatch §7 旧措辞以 plan §10 为准）。
- 复评核验：B1 精确迁移（`S6_BANNER`/`S6_L2_NOTE`/`S6_XN_NOTE` 取 `api.v1.md` §10.11 逐字、旧三段仅作 stale 反向字面量）✔；B2 禁项只增不减且未弱化既有断言 ✔；N1 loop 探针 4（自检 ≥2、记录实际、不硬编码 3）同步 plan/§9/D7/README/expected-facts ✔；fixture 离线 Ajv 2020-12 strict `async 6/6`、`no-debug 2/2`、`loop 4/4`，`expected-facts.json` 可解析 ✔；`schema/traceboard.event.v1.json` 仍 `927937df…`、transport/status 字节不变、collector/graph/路由/meta 零改 ✔；未发现新增矛盾。
- 冻结：`S6B_G1_FREEZE` 14 项哈希按 §5 复评值（含本文件第 14 项由 tester 落盘后计算，N10）；`S5_G1_FREEZE` 18 / `S6A_G1_FREEZE` 8 的集合与数量不变。G1 通过后按 dispatch §7 顺序放行 coder-agent ∥ coder-workbench；剩余 N14/N15 属实施/验收注记，不阻断。