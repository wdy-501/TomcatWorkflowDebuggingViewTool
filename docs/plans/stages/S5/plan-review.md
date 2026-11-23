# S5 G1 计划评审（plan-review）

- 评审角色：PLAN-REVIEWER（G1，只读；仅写本文件）
- 评审日期：2026-11-27
- 评审基线：`HEAD 196dd68`（工作树仅含 S5 增补：api/event-model 修改，guide/fixture/S5 文档新增；S0–S4 fixture 字节未动）
- 输入：`docs/plans/stages/S5/dispatch.md`、`docs/plans/stages/S5/s5-plan.md`、`docs/contracts/api.v1.md` S5 增补（§2.5/§8.2/§9.3/§10.6/§10.9/附录 D/E）、`docs/contracts/event-model.v1.md` S5 增补（§4.4/§7/§8/§12.11）、`docs/guides/frontend-shallow-plugin.md`、`fixtures/s5-l1-values/**`、S4 冻结产物与当前代码
- 结论（首轮）：**G1: FAIL**。3 个 blocking（均可一轮内以计划/指南/门禁文字修订修复，不需要改代码、schema、fixture 或事件语义）+ 12 个 non-blocking。未改任何代码、契约、fixture、schema，未执行 git 写操作。
- **复评 2026-11-23：G1: PASS**（B1–B3 全部关闭、N1–N12 全部落实；详见 §7）。

## 1. 冻结哈希（评审时实测）

| 文件 | SHA256 | 状态 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 与任务给定一致；字节未变 |
| `docs/contracts/api.v1.md` | `0e873290f5eb1a0ca4e7ed97fb88b0fe3ed096c876391913072cb6fcca43ce1e` | S5 增补（历史章节保留，仅加性） |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` | 未改，与 S4 哈希一致 |
| `docs/contracts/event-model.v1.md` | `5200b93d01246b4dc8786a999569b0bc7fc1a8acb4fa741cb99d5028488fb09a` | S5 增补（§4.4/§7/§8/§12.11） |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 未改，与 S4 哈希一致 |
| `docs/guides/frontend-shallow-plugin.md` | `2413290a9f004e757b0cf708203e3bc89b8ad19d1c6f90dd89843ba9accd6667` | 新增 |
| `fixtures/s5-l1-values/events.ndjson` | `9fc9a62e11e39c933a6695282f52ac79331a094070aa2a85f5ea25b878c6126b` | 新增（4 行，4640 B） |
| `fixtures/s5-l1-values/expected-facts.json` | `d7d84697a02b3f16a0b367b859ea2820c300320713edc324ff0c21dcd3094a92` | 新增 |
| `fixtures/s5-l1-values/README.md` | `ab9350b80d82aafb6699f3052ed08148047e66427a922666ceb1d01b12fb2b79` | 新增 |
| `docs/plans/stages/S5/s5-plan.md` | `1b68ecac81ddb8eeb3faf2e4dfa679650881aad5878de409e249171205502129` | 评审对象 |
| `docs/plans/stages/S5/dispatch.md` | `dd105631426c6c755b44f5c8952431829c0358e542e7320e57f9cd0813ec5fe9` | 评审对象 |

评审期间实测：

- S5 fixture `4/4` 通过 Ajv 2020-12 strict（复用 `tools/verify/node_modules/ajv`，离线、无新依赖）。
- `events.ndjson` 恰 4 行，链 `ui_event(#btn-discount) → fetch → controller → service` 全 `EXACT`/`OK`，`startNs` 严格嵌套；仅 service 含 `values` 5 项。
- `requestedAmount=100`、`demoSecret="[REDACTED len=6]"`/`redacted=true`、`note` 恰 2048 个 `x`/`truncated=true`、`amount` 100→0、`return` 0；`flags` 含 `L1`，无 `VALUES_CAPPED`/`L1_SKIPPED`/local；`events.ndjson` 全文无 `s3cr3t`。
- `expected-facts.json` 的 10 条 `facts` 逐条与事件比对 0 差异；`#trace.*` 的 `l1FlagSpanCount=1`、`sourceMappedSpanCount=1`、`valuesSpanCount=1`、`localValueCount=0` 与事件一致。

## 2. PASS/FAIL 表

| # | 审查面 | 结论 | 关键证据 |
|---|---|---|---|
| 1 | 范围：只 S5，无 S6/S7 | PASS | `dispatch.md` §1/§2/§11、`s5-plan.md` §1/§2/§14 明确只做 L1（param/field/return）、浅层 manifest/source、perf；无 local/异步/×3/SSE/WS/持久化/Tomcat/React/云端实现；`event-model.v1.md` §4.4.1/§12.11 与 `api.v1.md` §10.9 明确 `kind=local` 属 S6 |
| 2 | api S5 矩阵与历史端点 | PASS | `api.v1.md` §2.5 仍 9 条业务路由（含 health 10 条）、`events/seq/requests/replay` 形状与字节不变、meta `capabilities` 仍 5 键；graph 仅加性 15 字段；demo `preview-discount` 明确不是 collector 路由 |
| 3 | demo Appendix D（200/data 0/DB 100/案例 A） | PASS | `api.v1.md` 附录 D 明确已知与未知 id 均 `200 {"data":0}`、`findById=null` 不写字段/不 NPE、绝不 UPDATE、DB `amount` 仍 `100.00`；`GET /api/orders` 与 cancel 0 行事实不变（附录 B/D）；`s5-plan.md` §4.1/§4.5 一致 |
| 4 | graph 第 15 字段 `values` 与顺序 | PASS | `api.v1.md` §8.2 表最后一行与 §10.9、`expected-facts.globalAssertions.graphNodeKeysOrdered`、`dispatch.md` §4.3 完全一致：末尾 `values`，事件无字段→`null`，不默认 `[]`，不重算/合并/裁剪；15 项恒出现 |
| 5 | event-model values 语义/脱敏/截断/预算/flags | PASS（N1/N2） | `event-model.v1.md` §4.4.1–§4.4.6 固定 `param|field|return`、`from→to`、`line=null`、`invocation` 省略；§4.4.2 名称正则与 `[REDACTED len=6]`；§4.4.3 恰 2048 个 `x` 不追加省略号；§4.4.4 values≤30/depth≤4/2KB；§7 新增 `L1`/`SOURCE_MAPPED`/`VALUES_CAPPED`/`L1_SKIPPED`；schema 哈希不变 |
| 6 | guide 契约内容（manifest/dev/build/内联/SDK/限制） | PASS（N5/N6/N11） | `frontend-shallow-plugin.md` §3–§8 写清 demo 接入、R1/R2 扫描、1-based 全文行号、排序/去重/500 上限、dev 中间件/build 产物/`transformIndexHtml`、ESM 一次性 JSON 兜底、IIFE/preview 不兜底、`source`+`SOURCE_MAPPED`、CSP/行号漂移/同名去重/preview 无 manifest 限制；§1/§8 明确不是 L2、不读 `.map` |
| 7 | guide 可执行路径/命令 | **FAIL（B2）** | 见 B2：guide §2/§3 的 `../../frontend/build-plugin/index.mjs` 从 `demo/buggy-shop-boot-vue/frontend` 解析为不存在的 `demo/frontend/...`；`s5-plan.md` §6.1 的 `../../../frontend/...` 才是正确相对路径。另有 N4 的 `frontend/workbench` 错误路径 |
| 8 | fixture（schema/EXACT 链/五项/README） | PASS | 4/4 Ajv strict；`parentBySpanId`/`kindChain` 与事件逐条一致；仅 service 有 values 5 项；`expected-facts` 的 requests 4 span/1 fetch/2 backend、graph 4/3/15 键、replay 4 窗口自洽；README 首段逐字包含“测试数据，不是运行时证据……demoSecret 是假值”，并写明无 L2/对象深采、hydration 排除、flag 用包含断言 |
| 9 | demo 后端与案例 A 可行性 | PASS | 当前 `OrderController`/`OrderService`/`OrderMapper` 只有 `list/cancel/countById/cancelById`；新增 `findById` + XML SELECT 不插桩、`o.setAmount(0)` 仅内存、未知 id 不 NPE 均可实现；cancel/list 不动；`data.sql` 只有 `1 ... 100.00`；`Order#setAmount(double)`/`getAmount()` 是 public，字段反射方案可行 |
| 10 | agent L1 可行性（values 五项、字段 advice、hydration 排除、fail-open） | **FAIL（B1）** | 字段 advice 的类名/顶层 frame/`org.apache.ibatis`/`old != new`/不 emit 事件设计可行；当前 `SpanContext.Frame` 可扩展 values/extraFlags、`SpanEmitter.emit` 可加可空 `valuesJson`、Byte Buddy 1.14.19 支持 `@Advice.This(optional=true)`/`@Advice.Argument`；但 `s5-plan.md` §5.3 写 `@Advice.Argument(0..3)`，服务签名第 0 参是 `long id`，按“声明顺序”会产出 6 个值项，与 §1/§4.3 及附录 D 的精确五项冲突（见 B1） |
| 11 | collector/workbench `values`/详情 | PASS（N12） | `GraphNode.java` 当前 14 字段可追加 `JsonNode values`（`@JsonPropertyOrder` 末尾）；`SpanFacts` 用 `event.get("values")`（不 `arrayOrEmpty`）→ `null`；`TraceDeriver` 透传；`workbench/src/api.ts` 的 `GraphNode` 可加 `values`，`S4DetailPanel`/`derive.ts` 可加 Values/Source/L1；现有 S4/S3 选择器与 ×N 保留 |
| 12 | Vite 插件/SDK/demo 前端 | PASS（B2/N11） | `frontend/build-plugin` 零依赖、Node 内置模块、`node --test` 可行；R1/R2 能命中现有 `cancelOrder`/`validateForm` 与新增 `previewDiscount`；`vite.config.ts` 现有 `@traceboard/sdk` 别名/端口/代理不动，可加 `vue()+traceboardShallow()` 与 `build.sourcemap`；SDK `wrapFn`/click 根可在命中时附 `source`+flag，未命中字节不变；`#btn-discount` 固定 URL/3000 x/不调 `loadOrders` 可行；唯一路径错误见 B2 |
| 13 | perf 基线设计 | PASS（N3） | `s5-plan.md` §8 与 `dispatch.md` §4.5 一致：collector+demo、无 agent/有 agent、预热 20、3×100 顺序、p50/p95/中位 ratio、report-only、ratio>1.25 仅 WARN、setup 失败 exit 1、数字入 test-report；不伪造/不删慢样本 |
| 14 | 测试 S5-A..S5-I 与迁移/命令 | PASS（N7/N8） | `s5-plan.md` §10 覆盖 demo/DB/案例 A、agent 五项/脱敏/截断/无 local、graph 15 键与其余端点、plugin build/dev/line、SDK manifest/source、workbench 选择器/文案、perf、S0–S4 回归、范围安全；§10 的迁移清单逐项对应现有 `S3-1/S3-7/S4-E/S4-F/S3-8/S3-10/S2-8/S3-6`；§11 命令可执行（mvn 模块/JDK/端口/URL 与当前仓库一致） |
| 15 | S0–S4 冻结与字节不变 | PASS | `git status` 仅改动 `api.v1.md`/`event-model.v1.md` 并新增 guide/fixture/S5 文档；`schema`、`transport`、`status` 哈希与 S4 一致；S0–S4 fixture 未改；`S4_G1_FREEZE` 的迁移要求已在 `dispatch.md` §6.1 明确 |
| 16 | 安全/隐私/风险 | PASS | 无真实 secret/PII；`s3cr3t` 明确假值；fixture 只含占位符/2048 x；无 CDN/镜像/遥测/外部网络；SDK 不读表单/cookie/query；preview 仍只注入外部脚本、无 manifest/内联；风险表覆盖 hydration、案例 A、脱敏泄漏、行号漂移、CSP、perf 方差 |
| 17 | 偏离记录（unknown id/4 行/transport/guide 名/省略号/flags） | PASS（N8/N9） | 六项偏离均在 `s5-plan.md` §13 说明且符合 dispatch：unknown id 200 有附录 D 理由、4 行 EXACT 符合 §4.6、transport 字节不变、guide 名符合 §5.1/§6、无省略号符合 §4.2、fixture flags 用包含断言；不构成降级 |

## 3. Blocking issues（必须在 G1 复评前修复）

### B1. `values` 的参数项未明确排除 `long id`，与“精确五项”冲突

**证据**

- `s5-plan.md` §4.3 的服务签名是 `previewDiscount(long id, double requestedAmount, String demoSecret, String note)`（第 82 行），`§1` 与 `dispatch.md` §4.2 要求 service `values` 精确为五项，其中 `param` 只有 `requestedAmount`/`demoSecret`/`note`（第 17 行、dispatch 第 77–82 行；附录 D 第 1205–1213 行）。
- 但 `s5-plan.md` §5.3 写“`@Advice.Argument(0..3)` 在 enter 时按声明顺序格式化为 param 项”，只列了 `requestedAmount`/`demoSecret`/`note`，没有说明第 0 个 `long id` 被排除（第 138 行）。实现者若按 `Argument(0..3)` 与“声明顺序”实现，会得到 `id/requestedAmount/demoSecret/note/amount/return` 六项，`S5-B` 的“五项精确”必失败；若实现者自行猜测排除 `id`，则计划与契约未给出唯一依据。
- 这不是可接受的偏离：`api.v1.md` §10.9 与附录 D 都已把“恰好五项/固定顺序”作为硬约束，且 `S5-B` 断言“values 五项精确”。

**精确修复**

1. `s5-plan.md` §4.3 增加一句：**服务签名保留 `long id`（路径参数），但 L1 参数项只采 `requestedAmount`/`demoSecret`/`note`（按这三个参数的声明顺序）；`id` 不进入 `values`。**
2. `s5-plan.md` §5.3 把 `@Advice.Argument(0..3)` 改为 **`@Advice.Argument(1..3)`**（0 是 `long id`，不采），并在 §5.3/§5.5 明示“参数项固定 3 个，不得出现 `id`”。
3. `dispatch.md` §4.2 或 §4.1 增加同一口径（“参数项只含三个业务参数，不含 path `id`”），避免 dispatcher 与 plan 的输入冲突。
4. `S5-B` 增加断言：`values.length === 5`、`values.filter(kind==="param").map(name)` 精确等于 `["requestedAmount","demoSecret","note"]`，且不存在 `name="id"`；`fixtures/s5-l1-values/expected-facts.json` 可加 `idParamAbsent: true`（不影响事件字节）。

### B2. guide 的插件相对导入路径错误，按文档原样接入会解析到不存在的目录

**证据**

- `docs/guides/frontend-shallow-plugin.md` §2 第 32 行与 §3 第 38 行均写 `../../frontend/build-plugin/index.mjs`。
- 该文件位于 `demo/buggy-shop-boot-vue/frontend/vite.config.ts`：`../..` 是 `demo`，因此 `../../frontend` = `demo/frontend`（不存在）；仓库实际插件在根 `frontend/build-plugin`，正确相对路径是 `../../../frontend/build-plugin/index.mjs`。
- `s5-plan.md` §6.1 第 191 行已经写对 `../../../frontend/build-plugin/index.mjs`；`dispatch.md` §5.4 又指定 guide 是 coder-frontend 的 G1 输入。两份冻结文档不一致，且 guide 的写法会让 `vue-tsc`/Vite 构建直接失败。
- 另：guide 用命名导入 `{ traceboardShallow }`，plan 用默认导入；若插件不同时导出两者，也会二次冲突（N11）。

**精确修复**

1. 将 guide §2 第 32 行、§3 第 38 行的路径统一改为 **`../../../frontend/build-plugin/index.mjs`**（与 `s5-plan.md` §6.1 和实际目录一致）。
2. 统一导入形式：guide/plan 都写 `import traceboardShallow from "../../../frontend/build-plugin/index.mjs";`，并确认 `index.mjs` 同时 `export default traceboardShallow`（或两处都改为命名导入并让 `index.d.mts`/`exports` 对齐）。
3. guide §9 的示例构建/行号校验命令改为从 demo frontend 根执行（或明确 `cd`），避免同类的 `cd`/相对路径歧义。

### B3. 旧“无构建插件/sourcemap”“S5 待做”文案未被计划/门禁覆盖，S5 交付后仍会在 UI 说谎

**证据**

- 当前仍存在、且 `s5-plan.md` §7.2 / `dispatch.md` §5.5 / `S3-6` 没有逐条列出的可见文案：
  - `workbench/src/App.vue` 第 22 行：`无构建插件/sourcemap/局部变量 · 非实时（无 SSE/WS）...`
  - `workbench/src/components/S3Panel.vue` 第 1038 行：`无构建插件/sourcemap、无局部变量、非实时（无 SSE/WS）。`
  - `S3Panel.vue` 第 792 行、第 897 行：`缺少调试信息（需构建插件/sourcemap，S5 待做）` / `... S5 待做`（S5 已交付，且构建插件只覆盖前端，不能修复后端 `NOT_COLLECTED_NO_DEBUG_INFO`）
  - `demo/buggy-shop-boot-vue/frontend/src/App.vue` 第 101 行：`无构建插件/sourcemap（行号/局部变量属 S5，本次未采集）`
- 已覆盖的仅 `S3Panel.vue:1008`、`S3Panel.vue:1465`、`S4DetailPanel.vue:229`（`s5-plan.md` §7.2 第 242 行）。`S5-F` 第 286 行只禁止“无 sourcemap/行号映射”“无 S5/S6”，不禁止 `无构建插件/sourcemap` 或 `S5 待做`；`S3-6` 也只列两条旧串。因此实现者可以完全按 plan 执行而让上述文案继续出现在构建产物中，tester 仍 PASS，违背 S5“如实写能力/限制”的硬要求。
- 这不是历史文档问题：这些字符串位于当前工作台/演示页的**可见 UI**。

**精确修复**

1. 在 `s5-plan.md` §7.2 与 `dispatch.md` §5.5 的“删除旧口径”清单中逐条加入上述 5 处（App.vue:22、S3Panel:792、S3Panel:897、S3Panel:1038、demo App.vue:101），并给出统一替换口径，例如：
   - 工作台页头/脚注：`S5：manifest 提供函数/文件/行号；局部变量（L2）与行级属 S6，本阶段未采集 · 非实时（无 SSE/WS）`
   - `NOT_COLLECTED_NO_DEBUG_INFO` 理由：`缺少调试信息（后端 NOT_COLLECTED_NO_DEBUG_INFO；S5 manifest 只覆盖前端函数/文件/行号，局部变量属 L2/S6）`
   - demo 页头：`S5：manifest 提供前端函数/文件/行号；局部变量/行级属 S6，本次未采集`
2. 在 `S5-F`（及迁移后的 `S3-6`）增加**反向断言**：`workbench/dist` 与 `demo/frontend/dist` 不得包含 `无构建插件/sourcemap`、`S5 待做`、`无 S5/S6`、`无 sourcemap/行号映射`；同时保留现有 `forbiddenTexts` 中的 `kind=local`/`L2 已采集`。
3. 同步更新 `frontend/sdk/src/index.ts` 头注释（第 9–11 行）与 `demo/.../src/main.ts` 第 7 行的“no build plugin/no sourcemap”注释，避免源码注释继续宣称错误能力（非 UI，但属同一诚实性要求）。
4. 可保留 `docs/guides/local-launcher.md` 的 S4 历史口径，但 S5 acceptance/README 必须加一行指针“S5 起 demo 前端另有浅层 manifest/sourcemap（仅函数/文件/行号）”，避免读者按 S4 指南误判当前能力。

## 4. Non-blocking issues（建议同轮修正，不单独阻断）

| # | 位置 | 问题 | 精确建议 |
|---|---|---|---|
| N1 | `event-model.v1.md` §4.3 第 125 行 | 历史示例括注“未知 id 为 404”与附录 D 的 preview `200` 并列出现，易被误读为 S5 未统一 unknown-id 口径 | 在该括注后加“（S0/S2 `cancel` 的 404 是历史；S5 `preview-discount` 未知 id 仍 200，见 api 附录 D）” |
| N2 | `event-model.v1.md` §4.4.4 第 178–183 行 | 预算表有 depth≤4/值项≤30/2KB，但缺“对象字段≤30（预留）”，只在 §4.3 出现 | 在 §4.4.4 表加一行 `对象字段 ≤30（预留，S5 不递归对象）`，与主计划 §9.2/任务摘要对齐；S5 不触发 |
| N3 | `s5-plan.md` §5.5 第 170 行 | 写“单 span ≤64KB 沿用 `SpanEmitter`”，但当前 `SpanEmitter`/`EventSender` 没有 64KB 限制；collector 的 `MAX_LINE_BYTES=64KB` 会拒收 | 明确在 values 序列化后测量并尾部丢弃 + `VALUES_CAPPED=<n>`，或删掉“沿用”并说明 demo（5 项）不接近 64KB；不要让实现者误以为已有保护 |
| N4 | guide §9 第 155 行 | `git status --porcelain -- "frontend/workbench"` 路径不存在，永远空输出，形成假绿 | 改为 `workbench/`；并检查 `demo/.../frontend/dist` 的 `.map`/manifest（dist 已 gitignore） |
| N5 | guide §5 第 94 行 vs `s5-plan.md` §6.3 第 204 行 | guide 说 dev 非 GET → 405；plan 说非 GET 落回 Vite；两者冻结前未统一 | 选一个（推荐仅 GET 提供 manifest，其他方法 405；或明确 fallback），两处逐字一致；tester 只断言 GET 200，不受影响 |
| N6 | `s5-plan.md` §9.2 第 265 行 | 称“fixture 把 values 放在 return 之后、confidence 之前”，实际 `events.ndjson` 是 `...confidence, flags, values`；键序不属契约但描述错误 | 改为“fixture 把 values 放在 flags 之后（键序不属契约，按 JSON 语义比对）”；避免复核者按错误位置检查 |
| N7 | `s5-plan.md` §10 S5-A 第 281 行 / `dispatch.md` §5.6 第 170 行 | “无新端点”与 S5 新增 `preview-discount` 字面冲突 | 改为“除 `preview-discount` 外无新端点；无新 collector 路由” |
| N8 | `fixtures/s5-l1-values/expected-facts.json` 第 54/57 行 vs README 第 54 行 | expected-facts 给 `flagsClick`/`flagsService` 精确数组，README 说运行时可能追加建议性 flag、断言用包含；tester 若按 expected-facts 精确比 runtime 会误报 | 增加 `flagsAreContainsOnly: true` 或把字段改名为 `flagsFixtureExact`，并注明 runtime 只做 `includes("L1")`/`includes("SOURCE_MAPPED")` 与禁项断言 |
| N9 | `fixtures/s5-l1-values/README.md` 第 76 行 | “全文无 `s3cr3t`”与同目录 `expected-facts.json` 第 119 行说明文字含假值字样并存，表述歧义 | 改为“`events.ndjson` 全文无 `s3cr3t`；`expected-facts` 的说明文字提及假值不构成泄漏” |
| N10 | `api.v1.md` §10.6 第 1022 行 | 历史 S4 边界仍写“无 sourcemap/构建插件/源码片段/函数行号/方法名映射（S5）”，S5 变更段只重述 `values`，未显式取代 sourcemap/build-plugin 部分 | 在 §10.6 的 S5 变更段加“demo 前端另有浅层构建插件/manifest/sourcemap（附录 E/§9.3）；仍无 `.map` 解码/源码片段/局部变量；preview 不注入 manifest” |
| N11 | guide §2/§3 与 `s5-plan.md` §6.1 | 命名导入 vs 默认导入、`index.d.mts`/`exports` 类型声明未在一处写死；`vue-tsc --noEmit` 包含 `vite.config.ts` | 选定一种导入并保证 `index.d.mts` 被 TS 解析（`moduleResolution: bundler`）；在 guide §2/§3 与 plan §6.1 逐字一致 |
| N12 | `api.v1.md` §10.9 第 1111 行 / `s5-plan.md` §7.2 第 239 行 | 值行 `第 1/1 次` 与 S4 详情按 `nodeKey` 组的 `第 i/N 次` 并列；S5 单次不冲突，但同一 service 节点进入 S4 ×N 组时可能出现两个序号 | S5 保持 `invocation` 缺省→`第 1/1 次`；在 UI 注明“值行序号来自 values.invocation，组序号来自 ×N 选择”；S5 demo 单次，不影响验收 |

## 5. 偏离记录结论

| 偏离 | 结论 | 理由 |
|---|---|---|
| 未知 id 返回 `200 {"data":0}`（而非 404/-1/null） | **可接受** | `dispatch.md` §3 强制决策；`api.v1.md` 附录 D 第 1191–1193 行显式写“不返回 404/-1/null”并给出理由；S5-A 断言 unknown id 200/0，文档诚实，不降低 L1 验收信号 |
| fixture 4 行 EXACT 链（而非 controller LOST + service） | **可接受** | `dispatch.md` §4.6 本身就要求 4 行 click→fetch→controller→service；`S5-C` 的 requests 4 span/1 fetch/2 backend 与之一致 |
| `transport.v1.md` 零修改 | **可接受** | graph `values` 只走既有 get 响应体，无新路由/编码/传输变化；transport/status 哈希与 S4 一致，符合冻结要求 |
| guide 名 `frontend-shallow-plugin.md` | **可接受** | `dispatch.md` §5.1/§6 与 G1 冻结清单只认该名；s5-plan §13 D1 已记录 |
| `note` 截断不追加省略号 | **可接受** | `dispatch.md` §4.2 与 `event-model.v1.md` §4.4.3 明确“不追加省略号”；fixture 恰 2048 个 x，反而便于精确断言 |
| fixture flags 用“包含”而非运行时精确数组 | **可接受** | README 第 54 行明示运行时可能追加 `DROP_COUNT`/`S3_*` 建议性 flag；`S5-B` 应断言包含 `L1` 且不含 `VALUES_CAPPED`/`L1_SKIPPED`，非精确数组 |
| `id` 参数排除 | **不是偏离，而是 B1 的缺口** | 契约已固定五项；必须在计划中写死“排除 `long id`”，否则实现可能产出六项 |

## 6. 最终结论（首轮 2026-11-27）

- **Blocking：3**（B1 `id` 未排除导致五项/六项冲突；B2 guide 插件导入路径错误；B3 旧 UI 能力文案未迁移且门禁不覆盖）。
- **Non-blocking：12**（N1–N12）。
- 本轮未改任何代码、schema、fixture 或事件语义；B1/B2/B3 均为计划/指南/门禁文字修订，可一轮内修复并复评。
- 修复后复评必须确认：B1 的服务参数项为 `requestedAmount/demoSecret/note` 且 `S5-B` 断言恰 5 项；B2 的 guide/plan 路径一致且 demo 构建可解析；B3 的反向断言在 `workbench/dist` 与 `demo/frontend/dist` 上真实通过；同时 `schema`/`transport`/`status`/S0–S4 fixture 零漂移。

**G1: FAIL**（首轮；复评结论见 §7）

---

## 7. 复评 2026-11-23（plan v2 返工后，G1 再评）

- 评审角色：PLAN-REVIEWER（只读；仅改本文件）
- 评审对象：`s5-plan.md` v2、`docs/guides/frontend-shallow-plugin.md`、`api.v1.md`/`event-model.v1.md` S5 修订、`fixtures/s5-l1-values/**`；`dispatch.md` 未改
- 结论：**G1: PASS**。B1/B2/B3 全部关闭；N1–N12 全部落实；**无剩余 blocking**；新增 3 条非阻断观察（N13–N15），不影响 G1 冻结。

### 7.1 复评冻结哈希（实测）

| 文件 | SHA256 | 相对首轮 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 不变（与任务给定一致） |
| `docs/contracts/api.v1.md` | `c95022d1d3e7c732d4ace6f519d245ffacb5179568a3ed3a60c39d73b78d5aa5` | 修订（首轮 `0e8732…`） |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` | 未改 |
| `docs/contracts/event-model.v1.md` | `2a7fa58a1ab56cb10eeab98e8e084da401aa1b09cc4e32d19e40578d4c290706` | 修订（首轮 `5200b9…`） |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 未改 |
| `docs/guides/frontend-shallow-plugin.md` | `5be0e29312b827c9bc60c71d1674b977af54f9b9b6886684bce0875d10136b9b` | 修订（首轮 `241329…`） |
| `fixtures/s5-l1-values/events.ndjson` | `9fc9a62e11e39c933a6695282f52ac79331a094070aa2a85f5ea25b878c6126b` | **字节未变**（4 行 / 4640 B） |
| `fixtures/s5-l1-values/expected-facts.json` | `705f5d12addf3756796cf13934f2d9cb49214ceeb8711a290e58534863c597f9` | 修订（仅非契约断言键/说明） |
| `fixtures/s5-l1-values/README.md` | `94ddce605a5fb3fd9feaee6a5fe8d23e28c6987e49f912153a7be39ff1b80b20` | 修订（N9 措辞） |
| `docs/plans/stages/S5/s5-plan.md` | `11e7fa585504e9db74f4183c323c55409b1e1702c8f4308452e23371746dc5b1` | 修订（v2） |
| `docs/plans/stages/S5/dispatch.md` | `dd105631426c6c755b44f5c8952431829c0358e542e7320e57f9cd0813ec5fe9` | 未改 |

`git status` 仅 `api.v1.md`/`event-model.v1.md` 修改 + S5 文档/fixture 新增；`schema`/`transport`/`status`/S0–S4 fixture 零漂移。

### 7.2 Blocking 复核（B1–B3 全部关闭）

**B1 PASS（参数项排除 `id`、恰 5 项）**

- `s5-plan.md` §4.3（第 82/91 行）保留 4 参签名 `previewDiscount(long id, double requestedAmount, String demoSecret, String note)`，并显式写“L1 参数项只采 `requestedAmount`/`demoSecret`/`note`，`id` 不进入 `values`”；§5.3（第 139/142 行）改为 `@Advice.Argument(1..3)`（三个注解的简写），参数项固定 3 个、不得出现 `name="id"`、合计恰 5 项。
- `api.v1.md` 附录 D（第 1216 行）与 `event-model.v1.md` §4.4.5（第 202 行）逐字写明“参数项恰 3 个、`long id` 不进入 `values`、总数恰 5 项”，并回指 plan §5.3；两处与 plan 无冲突。
- fixture `expected-facts.json`：`valueNames` 恰 `["requestedAmount","demoSecret","note","amount","return"]`、`valueParamNames` 3 项、`idParamAbsent:true`；`README.md` 第 45 行同口径。
- 门禁 `s5-plan.md` S5-B（第 303 行）断言 `values.length===5`、param 名恰三项且无 `name="id"`；S5-A/C 与附录 D 的“五项”一致。
- `dispatch.md` 未改；其 §3/§4.2 只固定 4 参签名与“五项”，未规定 advice 下标，故与 `Argument(1..3)` 不冲突（plan §13 协调项已说明）。建议 dispatcher 下次动 dispatch 时补一句“参数项不含 path `id`”（N13）。

**B2 PASS（插件相对导入路径/命令）**

- guide §2（第 32 行）与 §3（第 39 行）均为 `import traceboardShallow from "../../../frontend/build-plugin/index.mjs";`，从 `demo/buggy-shop-boot-vue/frontend` 回溯三级到仓库根，路径真实存在；与 `s5-plan.md` §6.1（第 193 行）逐字一致。
- 导入形式统一为默认导入；`index.mjs` 必须 `export default`、`index.d.mts` 提供默认声明；demo `tsconfig.json` 实测为 `moduleResolution:"bundler"` 且 `include` 含 `vite.config.ts`，`vue-tsc --noEmit` 可解析。
- guide §9 命令已改为仓库根执行 + 子 shell `cd`；`git status --porcelain -- "workbench" ...` 使用真实目录（N4）。全仓已无 `../../frontend/build-plugin` 旧写法。

**B3 PASS（旧 UI 文案/门禁）**

- `s5-plan.md` §7.2（第 247–259 行）逐条列出 5 处旧串与精确替换：`workbench/src/App.vue:22`、`S3Panel.vue:792/897/1038`、`demo/.../frontend/src/App.vue:101`，连同既有 `S3Panel:1008/1465`、`S4DetailPanel:229` 与 SDK/main.ts/vite.config 注释；owner 明确（工作台 → coder-collector+workbench；demo 前端 → coder-frontend）。
- 实测旧串与表内文本完全匹配（grep 8 处）；canonical 横幅 `S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）` 与后端专用 `NOT_COLLECTED_NO_DEBUG_INFO` 措辞均由表给出，不再出现 `S5 待做`。
- `S5-F`（第 307 行）新增 **src+dist 双向**反向断言：`workbench/src/**`、`workbench/dist/**`、`demo/.../frontend/src/**`、`demo/.../frontend/dist/**` 不含 `无构建插件/sourcemap`、`S5 待做`、`无 S5`、`S5/S6`、`无 sourcemap/行号映射`；并正向断言 dist 含 canonical 横幅与 `JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）`。`expected-facts.json` 的 `forbiddenTexts`/`staleTextsMustBeAbsentFromSrcAndDist`/`capabilityTextMustBePresentInDist` 与之一致。
- 未覆盖项：`workbench/src/s4/derive.ts:73` 内部英文注释 `(no S5 mapping)` 不在表/门禁内；非用户可见、不影响验收，建议 S5 UI 改动时顺手修正（N14）。

### 7.3 Non-blocking N1–N12 复核（全部落实）

| # | 落实位置（复评证据） |
|---|---|
| N1 | `event-model.v1.md` §4.3 第 125 行加“S0/S2 cancel 404 是历史；S5 preview 未知 id 仍 200” |
| N2 | `event-model.v1.md` §4.4.4 预算表新增 `对象字段 ≤30（预留，S5 不递归对象）` 行 |
| N3 | `s5-plan.md` §5.5 第 172 行 + `event-model.v1.md` §4.4.4 第 180 行：64KB 由 agent 序列化后自测，现有 `SpanEmitter`/`EventSender` 无限制 |
| N4 | guide §9 第 160 行 `git status --porcelain -- "workbench" ...`（真实目录） |
| N5 | guide §5 第 95 行与 `s5-plan.md` §6.3 第 207 行统一为“非 GET → 405，不落回 Vite” |
| N6 | `s5-plan.md` §9.2 第 286 行改为“`values` 在 `flags` 之后（键序不属契约）” |
| N7 | `s5-plan.md` S5-A 第 302 行“除 `preview-discount` 外无新端点（无新 collector 路由）” |
| N8 | `expected-facts.json` `flagsAreContainsOnly:true` + `flagsRuntimeAssertion`；README 第 56 行“包含断言” |
| N9 | README 第 44/78 行“`events.ndjson` 无 `s3cr3t`；expected-facts 说明文字提及假值不构成泄漏” |
| N10 | `api.v1.md` §10.6 第 1028–1029 行 S5 取代说明（浅层插件/manifest/sourcemap；仍无 `.map` 解码/局部变量；preview 无 manifest） |
| N11 | guide §2/§3 与 plan §6.1 默认导入一致；`index.d.mts`；demo `tsconfig` 实测 `moduleResolution:"bundler"` + include `vite.config.ts` |
| N12 | `s5-plan.md` §7.2 第 244 行 + `api.v1.md` §10.9 第 1113 行“值行序号来自 `values.invocation`，×N 组序号来自 S4 分组，不得混用” |

### 7.4 复评实测事实

- fixture：Ajv 2020-12 strict **4/4**、4 行、4640 B；`values` 恰 5 项且名称/顺序为 `requestedAmount`(100)/`demoSecret`(`[REDACTED len=6]`, redacted)/`note`(2048 x, truncated)/`amount`(100→0, field)/`return`(0)，**无 `id`**；service flags `["S2_ZERO_ROW_CHAIN","L1"]`，click flags `["SDK_ACTIVE","SOURCE_MAPPED","OBSERVE_MS=1500"]`，无 `VALUES_CAPPED`/`L1_SKIPPED`/local；`events.ndjson` 全文无 `s3cr3t`。
- expected-facts：10 条 facts 路径与 values 顺序一致；`graphNodeKeysOrdered` 15 项且 `values` 末尾；`sourceText` 的 click 后缀 `（manifest 映射）`、后端 source 不加后缀与 api 附录 E 一致；replay 4 窗口/requests 4 span/1 fetch/2 backend 与事件自洽。
- 冻结：`schema` 哈希 `927937…`；`transport`/`status` 与 S4 一致；S0–S4 fixture 未被 `git status` 列出；`dispatch` 未改。
- 范围/安全：`api.v1.md` §2.5 仍 9 条业务路由（health 10 条）、meta 5 键；无 S6（local/async/×3/SSE/WS/持久化/云端）、无 preview 内联；无真实 secret/PII/CDN；perf 仍 report-only。

### 7.5 复评新增非阻断观察（不影响 PASS）

| # | 位置 | 观察 | 建议 |
|---|---|---|---|
| N13 | `dispatch.md` §3/§4.2 | dispatcher 文档未同步“参数项不含 path `id`”一句；但不规定 advice 下标，与 plan 不冲突 | 下一次 dispatch 变更时补一句即可，不必为本轮重开 |
| N14 | `workbench/src/s4/derive.ts:73` | 内部注释 `(no S5 mapping)` 略显过期；不在 B3 表/S5-F 门禁内，用户不可见 | S5 实现 `#s5-source` 时顺手改为“manifest/source 缺失即 `未采集`” |
| N15 | `s5-plan.md` §6.1 vs guide §2；`api.v1.md` §9.7 | `exports` 写法 `"./index.mjs"` vs `{".":"./index.mjs"}` 等价但字面不同；§9.7 历史条目仍含“无 sourcemap/构建插件…（S5）”且无局部指针（历史章节按约定保留，§9.3/§10.6/附录 E 已取代） | 不阻断；冻结时可按需统一 `exports` 字面并给 §9.7 加一行指针 |

**复评结论：G1: PASS（Blocking 0，N1–N12 全部落实；N13–N15 为非阻断观察）。准予按 §7.1 哈希冻结 S5 契约/guide/fixture/plan，进入 S5 编码与 S5-A..S5-I 门禁实现。**