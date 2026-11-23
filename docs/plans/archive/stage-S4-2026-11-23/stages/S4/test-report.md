# S4 测试报告（最终：S4-A…S4-I 收口）

> 范围：tester part 4（最终收口）。只改 `tools/verify/verify.mjs`（S4-H / S4-I 两道门 + 选择器实现列表）并新增本文件；
> 未改产品 / 契约 / schema / fixture / 其他阶段文档，未执行任何 git 写操作。S4-BUILD / A–G 由 part 1–3 实现，本报告只汇总。
> 详细证据：`test-report-part1.md`（BUILD/A/B/C）、`test-report-part3.md`（F/G + S2/S3 门禁迁移）。
> 运行环境：Windows 10 x64（`Windows_NT 10.0.29708`），Node **v22.22.2**，npm 10.9.7，Maven 3.9.5，
> JDK21（`C:/Program Files/Java/jdk-21`）+ JDK8（`1.8.0_221`，`JAVA_HOME` 默认）。仓库基线 `93ccc0b`。
> 最终全量运行：2026-11-23T09:22:03Z → 09:26:29Z（约 4m26s），工作目录 `tools/verify`。
> 2026-11-23 增补：新增 §8「Flake root cause and fix」（冷启动 span 嵌套偶发越界的定因、修复与复验），并据此改写 §7 第 6 条的「已知限制」表述；
> §1–§6 的证据与历史记录未改动。本次增补只改本文件，未改产品/测试/schema/fixture/契约，未执行 git 写操作。

## 1. 命令

```bash
cd "tools/verify"

# 1) H/I 单独运行（按分派要求先跑一次）
node verify.mjs --s4=H,I
#   -> S4-H 依赖本轮 S0–S3 的 RESULTS，s4-only 模式下没有 S0–S3，故如实 FAIL（不伪造 PASS），
#      S4-I 单独 PASS。分派已允许：H 依赖全量结果时改跑一次全量。

# 2) 全量运行（H 的主体证据 + 最终判定）
node verify.mjs > /tmp/s4-full-final.log 2>&1; echo "EXIT=$?"
#   -> EXIT=0，checks: 61 PASS / 0 FAIL (total 61)，S4 TEST (full S0–S4): PASS

# 3) 附加：S4-I 独立可运行性（不依赖其他 S4 门）
node verify.mjs --s4=I        # 3 PASS / 0 FAIL（V0 + S4-BUILD + S4-I），S4 TEST: PASS，exit 0
```

CLI 现状：`S4_IMPLEMENTED = ["A","B","C","D","E","F","G","H","I"]`；`node verify.mjs --s4` 默认跑全部已实现门，
`--s4=H,I` 可单独选择。执行顺序为 S0–S3 全部门 → S4-BUILD → A…I，S4-H 在 A–G 之后读 `RESULTS`，S4-I 最后执行（能看见前序门的残留）。

## 2. 结果总览（最终全量运行）

| 门 | 标题 | 结果 |
|---|---|---|
| V0 | environment recorded（node/npm/mvn/jdk、java 基线、git status 基线） | PASS |
| V1..V8 / S0–S3 | 既有 51 项门禁（S0 fixture、S1 ingest/agent/工作台、S2 0 行链、S3 SDK/相关/回放/面板/清理） | PASS（51/51） |
| S4-BUILD | reactor 含 launcher；launcher Main-Class/版本/可运行；demo+agent+collector jar | PASS |
| S4-A | `idea` 精确 VM options / 5 步 / exit 0 / 无子 java；legacy 与 usage 退出码 | PASS |
| S4-B | `jar --detach`+`stop`：PID/日志、健康、握手、cancel 事件、释放 8080、NOT_RUNNING、PID_MISMATCH、无孤儿 java | PASS |
| S4-C | 握手：精确 200 body、GET agent 形状、405/415/413/400、404、last-wins、不建会话/事件/seq、meta 5 键 | PASS |
| S4-D | 预览注入（最后一个 `</body>` 前 + 重算 Content-Length + 去头）；config/sdk；8 类 not-injected；202 vs 404；目标/采集器 down 502；SDK_IIFE_MISSING；端口释放 | PASS |
| S4-E | SDK IIFE：13/13 用例、dist 3 文件、全局 `TraceBoardSDK`/version、vm 自动初始化一次 + 双载守卫 + 无 config 不初始化 + 坏 config fail-open、无 sourcemap/外链 | PASS |
| S4-F | details/×N/缺口：9 条 schema-valid fixture → requests/graph(9/8, 14 有序字段)/replay；workbench dist+derive ×3/×3/×2、rows `未采集`≠0、恰 3 条缺口、内联 F 规则 | PASS |
| S4-G | diagnose：full preview 7 PASS/exit 0、无 preview skip=2/exit 0、缺 session / app down / 不可注入 preview 均 FAIL exit 3、四数之和恒 7、无伪造 PASS | PASS |
| **S4-H** | **回归：S0–S3 全 PASS、schema `927937df…`、S0–S3 fixture + S4 G1 冻结零漂移、hello 不是事件（span 计数不变）** | **PASS** |
| **S4-I** | **范围/安全/清理：无 S5/S6/S7、无 secret/CDN/镜像、仅外链注入 + CSP 未改、loopback 无 TLS、端口空闲、无 java/node 残留、git 未动、S4 白名单内** | **PASS** |

合计：**61 PASS / 0 FAIL（total 61）**，`S4 TEST (full S0–S4): PASS`，exit 0。
（61 = 既有 51 项 + S4-BUILD + S4-A…I 十项；part 1–3 报告的 59 项为 BUILD+A–G 阶段值。）

## 3. S4-H 证据（回归闸门）

本轮全量运行 S4-H 的子证据逐字摘录：

```text
ok  every S0–S3 gate still PASS in this run (RESULTS, >=50 prior gates) :: 51 prior gates, failed=none
ok  46 anchor gates present and PASS (S0 V1/V1b/V1c/V4b, S1 A/B/C0-C3/D/F, S2 1-8/L, S3 1-10) :: all anchors PASS
ok  frozen schema hash is 927937df…a489a (same value in the S4 G1 freeze) :: 927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a
ok  S4 G1 freeze zero drift: schema, 4 contracts, guide, 3 S4 fixtures, S4 plan/dispatch/amendment (12 files) :: 12/12 hashes match
ok  S0–S3 fixture bytes unchanged (15 frozen fixture hashes from the S2/S3 plan-review baselines) :: 15/15 match
ok  hello stays in-memory control plane: no session, no event, no seq consumed, meta stays 5 keys (S4-C evidence) :: ok  hellos consumed no seq: first real event after 4 hellos has seq=1/nextSeq=1 || ok  hello-only session does not appear in GET /api/v1/sessions :: sessions=none || ok  meta capabilities still exactly 5 keys   [三段 S4-C 证据合并引用]
ok  runtime span counts unchanged: the demo request yields exactly the 4 backend kinds (no hello/agent span) :: events=4 kinds=sql,mapper,service,controller
ok  no S3 regression: S2 4-span LOST + S3 EXACT E2E, replay 0-write, board, case B, S3-9 all PASS :: 7/7 PASS
```

实现要点（仅测试侧）：H 不在 S4-only 模式下伪造 PASS——没有 S0–S3 `RESULTS` 时直接记 FAIL 并给出原因；
锚点集合（46 项）与「无 S3 回归」集合（S2-3、S3-3、S3-4、S3-5、S3-6、S3-7、S3-9）写死在 `S4_H_ANCHORS`，
fixture 期望值取 `S4_G1_FREEZE` 覆盖值，其余取自 S2/S3 plan-review 基线解析结果，冲突即 FAIL。

## 4. S4-I 证据（范围/安全/清理闸门）

```text
ok  S4 sources contain no S5/S6/S7 capability (sourcemap, build plugin, L1/L2 values, WAR/Tomcat, cloud, SSE/WS, pixel replay, persistence) :: 73 files clean
ok  SDK IIFE build uses esbuild without --sourcemap (no map/plugin step) :: esbuild src/index.ts --bundle --format=iife ... --outfile=dist/traceboard-sdk.iife.js
ok  no secrets, no CDN/mirror host in S4 sources/SDK bundle (V8a/V8b/V6d also PASS in a full run) :: secrets=none cdn=none hygiene=V8a=PASS,V8b=PASS,V6d=PASS
ok  lockfiles resolve only from registry.npmjs.org (233 http(s) tarballs, no third-party mirror) :: all npmjs.org
ok  preview/diagnose inject only external <script src=...> tags (4 tags, no inline script) :: <script src="/traceboard/config.js"> | <script src="/traceboard/sdk.js">
ok  preview never rewrites/relaxes CSP and adds no nonce (external same-origin scripts only) :: CSP untouched
ok  launcher preview binds 127.0.0.1 only, loopback target set {127.0.0.1,localhost,::1}, http only (no TLS), collector loopback :: bind=true loopbackSet=true noTls=true noBindAll=true
ok  ports 8601/8080/5173/5174/4173/4174/8602/18080 not LISTENING after the S4 gates :: all free
ok  no java/node process spawned by this run is still alive (verifier process tree empty; no orphan launcher/demo/preview/build) :: descendants=none (pid diff java=none node=none)
ok  git index untouched (no staged entries), HEAD/status identical to the run baseline (verifier ran no git write) :: staged=0 statusUnchanged=true head=unchanged
ok  no product file modified or added by the verify run (build outputs only) :: 170 product files stable
ok  git change set is inside the S4 whitelist only (agent/collector/launcher/sdk/demo frontend/workbench/docs contracts+guides+S4/fixtures/s4-details/tools/pom) :: 26 entries within scope
ok  S4-B/D/F/G report their own cleanup (services stopped, ports released, no orphans) :: 7 cleanup lines, bad=none
```

实现要点（仅测试侧）：
- S5/S6/S7 禁项按目录扫描（`server/launcher|collector`、`agent`、`frontend/sdk`、`workbench`、demo 前端），
  `values:` 判据沿用 S3-8 收窄后的 JSON 键形式（不是 S4 工作台的局部 `values: number[]`）。
- 残留检测不再用全局 pid 差（会被同机其他 node/java 服务误伤），改为 PowerShell CIM 按**祖先链**取 verifier 进程树；
  pid 差只作为附加信息输出。
- 端口集合固定为 8601/8080/5173/5174/4173/4174/8602/18080（`S1_PORTS` 复用），git 对比使用运行前基线（index/HEAD/status）与产品文件快照（170 个）。
- 白名单为 S4 计划内的路径前缀 + 三个根文件（`pom.xml`、`README.md`、`.gitattributes`），并显式禁止 schema/fixtures 冻结目录与 demo 后端；26 个改动项全部落在白名单内。
- 全量模式下额外要求 S4-B/D/F/G 各自的清理证据行全为 `ok `（7 行）；s4-only 模式跳过该子项（其余断言不变）。

## 5. 哈希与冻结

| 对象 | 值 / 结果 |
|---|---|
| schema `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a`（12/12 之一，零漂移） |
| S4 G1 冻结 12 文件 | 4 份 contracts、guide、3 个 `fixtures/s4-details` 文件、S4 plan/dispatch/amendment、schema：`12/12 hashes match` |
| S0–S3 fixture（S2/S3 plan-review 基线） | `15/15 match`，无冲突、无漂移 |
| 产品文件快照 | 运行前后 170 个产品文件一致（仅 `target/`、`dist/`、`work/` 构建运行产物变化） |
| git | index staged=0、HEAD 未变、status 与基线逐字一致（26 条均在白名单内） |

## 6. 清理

- 最终状态：8601 / 8080 / 8602 / 18080 / 5173 / 5174 / 4173 / 4174 全部无 LISTENING；`java.exe` 无残留；`node.exe` 仅剩运行前已有的非 verifier 进程。
- `work/*.pid` 无残留；launcher 日志（`work/logs`）由各门 `finally` 清理；preview/stub/collector 全部关闭。
- 验证器本次只写 `tools/verify/**`（`verify.mjs`）与本报告；未产生仓库内其他文件。

## 7. 已知限制与产品风险

1. **fixture ×3 ≠ 运行时 ×3**：`fixtures/s4-details` 的 9 条事件只用于派生/渲染证据；运行时 ×3 聚合仍归 S6，本阶段不主张。
2. **预览「执行」未验证**：S4-D/G 只验证代理层行为（注入位置、Content-Length、状态码、header、不可注入分类）；真实浏览器里 SDK 是否加载/上报需要 CDP 或人工，本阶段未做（分派要求不跑浏览器测试）。
3. **CSP 限制**：预览只注入同源外链 `<script src>`，不改写也不放宽 CSP、不加 nonce。因此强制 nonce/hash 的严格 CSP 站点在真实浏览器下仍可能被拦，属既定契约边界。
4. **hello 仅内存**：握手记录不落盘、无鉴权，collector 重启即失；last-wins 语义已由 S4-C 覆盖，但跨进程/多 agent 场景不在 S4 范围。
5. **JDK8/JDK21 双路径**：demo+agent 走 JDK8（`1.8.0_221`），launcher/collector/reactor 走 JDK21；只在上述本机组合上验证，其他组合（如 JDK17 运行 launcher）未覆盖。
6. **已修复（2026-11-23）：agent 冷启动 span 嵌套偶发越界（原 S2/S3 遗留时序缺陷，非 S4 引入）**。
   现象（历史证据，保留）：首次全量运行（09:12Z）S2-3 报 `slot3 not nested inside slot2`、S2-4 报 `node3 not nested`，连带 S3-9、S4-H 失败（57 PASS / 4 FAIL，其余 57 项含 A–G、I 全 PASS）；
   冷启动探针 5 轮中 2 轮违反（`mapper->sql startDelta=3023360 endMargin=-17152`、`startDelta=1518592 endMargin=-8960`），预热后 10/10 干净；根因复现 1/8：`sql.end` 比 `mapper.end` 大 69,632 ns。
   根因：`startNs` 在 `SpanContext.enter` 内部由第二次 `epochNanos()` 取值，而 `durNs` 从 advice 入口的 `enterNs` 起算，冷启动延迟 δ 造成同一 span 的 start/end 口径不一致。
   修复：`SpanEmitter.epochNanosFrom(long enterNs)` + `SpanContext.enter(kind,nodeKey,enterNs,link)` 统一使用 advice 的 `enterNs`，详见 §8。
   修复后 `work/flake-nesting.mjs` 冷启动 8/8 PASS、全量 61 PASS / 0 FAIL（§8.4）。测试侧仍不放宽嵌套断言、不加热身——冷启动敏感性保留为常态门禁，而不是被掩盖的限制。
7. **S4-H/S4-I 的运行语义**：H 依赖本轮 S0–S3 `RESULTS`（`--s4=H` 单独运行会如实 FAIL）；I 必须在 A–G 之后跑才最有意义，且其 cleanup 证据子项只在全量模式断言。
8. **串行要求**：S4-A「无子 java」与 S4-I 的端口/残留断言假设同机串行执行，勿与其他 java/node 测试并行。

本次最终全量运行在上述限制下 **61 PASS / 0 FAIL**。第 6 条的冷启动竞态已于 2026-11-23 定因并修复（§8）：修复后冷启动压力 8/8 PASS，最终全量 61/61 中 S2-3/S2-4/S3-3/S3-9/S4-H 全 PASS。
若复跑仍出现 S2-3 `not nested`，按**回归**处理（保留日志并核对 `startNs`/`durNs` 是否同源），不再作为「可重跑忽略」的既知偶发。

## 8. Flake root cause and fix (2026-11-23)

### 8.1 症状与证据

| 项 | 内容 |
|---|---|
| 首次全量（09:12Z，修复前） | S2-3 `slot3 not nested inside slot2`、S2-4 `node3 not nested`；连带 S3-9、S4-H FAIL → 57 PASS / 4 FAIL |
| 冷启动探针（修复前，5 轮） | 2 轮违反：`mapper->sql startDelta=3023360 endMargin=-17152`、`startDelta=1518592 endMargin=-8960` |
| 根因复现（修复前，8 轮） | 1/8 违反，越界量 **+69,632 ns**：`sql.end exceeds parent (mapper).end by 69632` |
| 预热对照 | 预热后 10/10 干净 → 与冷启动首执行路径（类加载/JIT）强相关，而非逻辑错误 |

两类失败形态（`c.startNs >= p.startNs` 与 `c.startNs+c.durNs <= p.startNs+p.durNs`）同时可被触发，符合「窗口整体被 δ 推后、且父子 δ 不同」的解释。

### 8.2 根因

同一 span 的 start 与 duration 取自**两次不同的 `System.nanoTime()`**：

- advice（`ControllerAdvice/ServiceAdvice/MapperAdvice/SqlAdvice` 的 `@OnMethodEnter`）取 `enterNs = System.nanoTime()`，并把它作为 `exit*` 的时长起点：`durNs = System.nanoTime() - enterNs`；
- 但 `startNs` 是在 `SpanContext.enter` **内部**才调用 `SpanEmitter.epochNanos()` 取得（第二次读时钟），中间隔着 `isEnabled()`、栈操作、`randomHex`、`Frame` 构造等首执行路径。

于是某 span 上报的区间为 `[enterNs + δ, enterNs + δ + durNs] = [enterNs + δ, exit + δ]`，δ 为该 span 在 `enter` 内的冷启动延迟。父子 δ 不等（最内层 SQL 首次执行往往最大），父 span 的区间被推后、子 span 被推后更多，`end` 差 `δ_child − δ_parent` 即可为正（实测 69,632 ns），出现「子 end 晚于父 end」；父 start 被推后也可造成「子 start 早于父 start」。预热后 δ→0，故只有冷启动首请求会命中。

关键点：不是断言过严，也不是时序抖动噪声，而是**上报口径不一致**——修的是产品侧时钟口径，测试断言保持不变。

### 8.3 改动文件与方法（产品侧，最小改动）

| 文件 | 方法 | 变更 |
|---|---|---|
| `agent/src/main/java/io/traceboard/agent/SpanEmitter.java` | `static long epochNanosFrom(long nanoTime)` | 新增：把任意 advice 侧 `nanoTime` 读数按 `clockBaseMillis * 1_000_000 + (nanoTime - clockBaseNanos)` 换算到共享 epoch-ns 时钟；未初始化时懒加载锚点（逻辑与 `init/premain` 一致） |
| 同上 | `static long epochNanos()` | 改为 `return epochNanosFrom(System.nanoTime())`，保留原语义与锚点（`clockBaseMillis/clockBaseNanos`）不变 |
| `agent/src/main/java/io/traceboard/agent/SpanContext.java` | `private static void enter(String kind, String nodeKey, long enterNs, RequestHeaders.Link link)` | `long startNs = SpanEmitter.epochNanosFrom(enterNs)`：`startNs` 与 `durNs` 共用同一 advice 读数 |
| 同上 | `enterController/enterService/enterMapper/enterSql(long enterNs)`、`duration(long enterNs)` | 签名与语义不变（已是单一 `enterNs` 来源），仅因 `enter` 内部改动而共享同一时钟口径 |

advice 类（`ControllerAdvice/ServiceAdvice/MapperAdvice/SqlAdvice`）与 `exit*` 路径未改：`enterNs` 本来就是它们提供的唯一入口时间，本次只是让 `startNs` 也用它。锚点策略、`MAX_DEPTH`、fail-open、span id/trace 关联等均未触碰。

### 8.4 验证（修复后）

```text
# 冷启动压力：8 个全新 JDK8 demo JVM（每个首次加载 agent），断言父子链路 + start/end 包含
node work/flake-nesting.mjs
#   -> run 0..7 全 PASS；SUMMARY: 8/8 pass, 0 fail（修复前同脚本 1/8 违反，越界 69,632 ns）

# 全量校验（含冷启动敏感的 S2-3/S2-4/S3-3/S3-9 与 S4-H）
cd tools/verify && node verify.mjs
#   -> checks: 61 PASS / 0 FAIL (total 61)，S4 TEST (full S0–S4): PASS，exit 0
```

结论：原「偶发越界」不再是未闭合风险；测试侧未新增任何容差、未加热身、未放宽断言，8/8 与 61/61 都是在原严格判据下取得。
本报告增补时（2026-11-23）再次独立复跑 `work/flake-nesting.mjs`：`run 0…7` 全 PASS，`SUMMARY: 8/8 pass, 0 fail`，exit 0（与修复后首轮结果一致）；复跑未重建 jar、未改任何产品文件。

## 9. 结论

**S4 TEST: PASS**（全量 S0–S4：61 PASS / 0 FAIL，exit 0；S4-A…S4-I 十道门全绿）。
原第 7 节第 6 条记录的冷启动 span 嵌套偶发越界已完成定因与修复（§8）：`SpanEmitter.epochNanosFrom(enterNs)` 与 `SpanContext.enter(kind,nodeKey,enterNs,link)` 统一 start/duration 时钟口径，冷启动压力 8/8 PASS、全量 61/61 PASS。S4 无未闭合的已知偶发缺陷；测试断言与判据未曾放宽。

## 10. 复现

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool/tools/verify"

node verify.mjs                     # 全量 S0–S4：期望 61 PASS / 0 FAIL，exit 0
node verify.mjs --json              # 同上 + 一行 VERIFY_JSON（mode/s4Selected/results/env）
node verify.mjs --s4=I              # S4-I 独立：V0 + S4-BUILD + S4-I，3 PASS，exit 0
node verify.mjs --s4=A,B,C,D,E,F,G  # S4 A–G（part 1–3 阶段值：9 PASS）

# 冷启动嵌套压力（§8 修复回归证据）：8 个全新 demo JVM，断言父链 + start/end 包含
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
node work/flake-nesting.mjs         # 期望 SUMMARY: 8/8 pass, 0 fail
```

前置：Node ≥ 20（本机 v22.22.2）、npm、Maven 3.9.5、JDK21 与 JDK8 均可用；`JAVA_HOME` 默认 JDK8，verifier 内部按需切换 JDK21。

## 11. 参考

- `docs/plans/stages/S4/s4-plan.md` §9（S4-H / S4-I 定义）
- `docs/plans/stages/S4/plan-review.md`（G1 冻结表，12 个哈希）
- `docs/plans/stages/S4/test-report-part1.md`（S4-BUILD/A/B/C 证据）
- `docs/plans/stages/S4/test-report-part3.md`（S4-F/G + S2/S3 门禁迁移）
- `work/flake-nesting.mjs`（§8 冷启动嵌套压力脚本，8 轮全新 demo JVM；断言 `parentSpanId` 链、`child.startNs >= parent.startNs`、`child.end <= parent.end`）