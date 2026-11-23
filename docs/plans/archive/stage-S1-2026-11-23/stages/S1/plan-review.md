# S1 契约评审（G1 门）

> 评审人：plan-reviewer（只读）｜日期：2026-11-23｜阶段：S1｜轮次：第 1 轮
> 复评：2026-11-23 第 2 轮 → **G1: PASS**（见下方“复评”节；第 1 轮结论与检查表保留为历史）
> 绑定输入：`docs/plans/stages/S1/dispatch.md`（§1–§10，唯一任务输入）、`docs/plans/stages/S1/s1-plan.md`、
> `docs/contracts/{api,transport,event-model}.v1.md`、`fixtures/s1-walking-skeleton/**`、`schema/traceboard.event.v1.json`
> 权威来源：`docs/plans/00-master-plan.md` §2.3(129-144)、§8.1-8.3(588-627)、§9.1-9.2(664-680)、§13.4(995-1027)；`docs/plans/SOLO-PLAN.md` S1 行(67)、§4(104)；S0 评审冻结哈希 `docs/plans/stages/S0/plan-review.md:52-60`
> 事实来源：`demo/buggy-shop-boot-vue/backend/.../OrderController.java:42-49`（`cancel(@PathVariable long id)`，声明行 43）

---

## 复评 2026-11-23（G1 第 2 轮，终评）

**G1: PASS**

- **B1 已闭环**：`event-model.v1.md` §5 第 2 条新增“游离后端根（isolated backend request）”唯一例外，并在 §2/§3.3/§7/§9/§11 配套落文；`transport.v1.md` §4.5 第 8 条给出 ingest/展示语义；`api.v1.md` §7.5 加注。第 1 轮的两处引用失实（`s1-plan` D11、fixture README）已被改成真实存在的小节。
- **N1–N9 全部落实或显式记录**（N1→§7 词表；N2→D7/D15；N3→D14；N4→尾页读回；N5→§7.4 + D16；N6→只断言文件名；N7→DRP=false；N8→jar 内 schema 字节等价；N9→JDK8 绝对路径）。
- **本轮无阻断项**；3 条非阻断（R1 实现约束、R2 记录性偏离、R3 措辞澄清）交 coder/tester 落实，不回到 G1。
- **变更边界干净**：仅 5 个文档被改（event-model、transport、api、fixture README、s1-plan）；`schema` 与 3 个 S1 fixture **字节未动**；`agent/`、`server/`、`workbench/`、`pom.xml`、`tools/verify/`、`fixtures/case-a-zero-rows/` 零改动。
- A1–A10、A13–A18 复跑结论不变（PASS）；第 1 轮的 **A11、A12 由 FAIL → PASS**。

### 1. 变更边界（`sha256` 逐文件核对）

| 文件 | 第 1 轮基线 | 复评时点 | 判定 |
|---|---|---|---|
| `schema/traceboard.event.v1.json` | `927937df…a489a` | `927937df…a489a` | **未变**（冻结） |
| `fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson` | `6832e9f9…b972` | `6832e9f9…b972` | **未变** |
| `fixtures/s1-walking-skeleton/agent-controller-span.json` | `13a77e9d…e70c` | `13a77e9d…e70c` | **未变** |
| `fixtures/s1-walking-skeleton/expected-facts.json` | `380a0358…9bf1` | `380a0358…9bf1` | **未变** |
| `docs/contracts/event-model.v1.md` | `0820d57f…614a` | `7988d1c4…1fdf7` | 仅 B1 文档修订 |
| `docs/contracts/api.v1.md` | `c310daa1…3776` | `a717e800…6943` | §7.5 两句 + 变更记录，S1 矩阵/端点未动 |
| `docs/contracts/transport.v1.md` | `e5046283…c3c0` | `cad6224f…3ab8` | §4.5 第 8 条 + 变更记录，§4.5.1–7 未动 |
| `fixtures/s1-walking-skeleton/README.md` | `e253469c…09fc` | `b7f51b04…839a` | 语义/引用/消费方纠正 |
| `docs/plans/stages/S1/s1-plan.md` | `1e7db73c…842d` | `01c5c75b…e5e4` | D11/D14–D16 + N 项落实 |
| `docs/plans/stages/S1/dispatch.md` | `da9960fb…2668` | `da9960fb…2668` | **未变** |

`git status --porcelain`：仅 `docs/contracts/{api,event-model,transport}.v1.md` 为 `M`；`docs/plans/stages/S1/`、`fixtures/s1-walking-skeleton/` 未跟踪（新增）；无其它修改。测试脚本位于仓库外，未 `npm install`，未做 git 写操作。

### 2. B1 闭环（逐条验收）

| 第 1 轮 B1 验收点 | 现状 | 证据 |
|---|---|---|
| 唯一例外：`kind=controller`（S1）、`parentSpanId=null`、`confidence=LOST`、`flags` 含 `LOST_BACKEND` | 已落文 | `event-model.v1.md:145-150`（“S1 的根只有两种…”，例外的五个条件齐全） |
| 合成 `click_lost_<spanId>` 作为 `rootEventId`，仍满足正则 | 已落文 | `event-model.v1.md:152-153`；fixture `rootEventId:"click_lost_7c3e5a91b2d4086f"`（机器核对 `=== "click_lost_"+spanId`） |
| 专用 `traceId`，不得与前端/其它游离根相同；`ui_event` 根与游离根不得共存 | 已落文 | `event-model.v1.md:149-150` |
| 普通点击链规则**未被放松** | 操作根分支保留、§5.3 首句保留；S0 fixture 未动 | `event-model.v1.md:146`、`:151`（首句）+ `:152`（“唯一例外”追加）；`fixtures/case-a-zero-rows/**` 无改动 |
| `parentSpanId`/`rootEventId` 顶层字段行同步 | 已改 | `event-model.v1.md:26-27` |
| `confidence=LOST` 行指向该例外 | 已改 | `event-model.v1.md:84` |
| flags 词表登记 `LOST_BACKEND` 与阶段标记 | 已增 | `event-model.v1.md:172`、`:175`、`:178`；fixture `flags` 逐字 `["SKELETON","S1_ONE_METHOD","LOST_BACKEND"]`（大小写一致） |
| §9 能力边界与 §11 参考样例 | 已改 | `event-model.v1.md:197`、`:200`、`:211-215` |
| transport 的 ingest/展示语义 | 已增第 8 条（不是伪造前端根、不关联、UI 按 `LOST` 标游离） | `transport.v1.md:118-121` |
| api 注记 | 已增 | `api.v1.md:360-361` |
| 引用失实纠正 | D11 改为“G1 裁决（方案 A，仅文档）…原记录不成立”；README 改为“G1 第 1 轮裁决，已落地”并指向真实小节 | `s1-plan.md:403`、`fixtures/s1-walking-skeleton/README.md:52-55`（另 `README.md:5` 指向 `transport §4.5（第 8 条）`） |
| `grep click_lost` 在 event-model 与 transport 各 ≥1 | 满足 | `event-model.v1.md:152,172,197,214`；`transport.v1.md:118` |
| schema 与 fixture 字节不变 | 满足 | 见 §1 哈希表；Ajv 复跑 3/3 通过 |
| “`parentSpanId=null` 仅用于 ui_event”绝对句消失 | 满足 | `git diff` 显示旧第 2 条被整句替换；现文为“S1 的根只有两种” |

**判定：B1 CLOSED。** 语义与主计划 §8.3（`LOST`=只有一端；后端有请求无前端根→游离区）与 §2.3 一致；`status-semantics.md:27,53,56` 亦不冲突。

### 3. N1–N9 处置

| ID | 处置 | 证据 |
|---|---|---|
| N1 flags 词表 | 已登记 `LOST_BACKEND`（v1 使用）与 `SKELETON/S1_ONE_METHOD/S1_WALKING_SKELETON`（本阶段标记，读取方按未知 flag 忽略） | `event-model.v1.md:172,175,178` |
| N2 D7 理由/`nodeKey` 变更 | D7 已改为“原值本已嵌套成立，放大只是可读性/贴近真实请求”；`#btn-cancel`→`#btn-s1-fake` 记为 D15 | `s1-plan.md:399`（D7）、`:407`（D15）；`README.md:30-31` |
| N3 expected-facts 消费偏离 | 记为 D14：新形状、`globalAssertions.<source>`、S1 门禁新增消费器、S0 V1b 的 5 条 fact 不动 | `s1-plan.md:406`；`README.md:59-68`；`s1-plan.md:268`（T1） |
| N4 读回尾页 | 先取 `eventCount`，`afterSeq=max(0,eventCount-200)`；`nextSeq<eventCount` 时 UI 明示“仅最近一页”；T11 断言源码无固定字面量 | `s1-plan.md:226-231`、`:278`；`README.md:100` |
| N5 发送侧换行/非 202/丢弃计数 | 每行必须以 `\n` 结尾并断言末字节 `0x0a`；非 202 计入 `ingest_rejected` 节流打印；队列满计数；D16 记录“不进事件”的已知缺口 | `s1-plan.md:183-189`、`:408`（D16） |
| N6 `source.line` 不可复现 | §7.3 声明退出点取栈、不要求可复现；README 标注为示例值；T9 只断言文件名 | `s1-plan.md:167`、`:276`；`README.md:44` |
| N7 shade `dependency-reduced-pom.xml` | `createDependencyReducedPom=false`；T2/§13.5 断言文件不存在 | `s1-plan.md:143-144`、`:269`、`:385` |
| N8 schema-in-jar 字节等价 | T2 增 `unzip -p … | sha256sum` 与根 schema 逐字相等；§13.5 有同命令 | `s1-plan.md:269`、`:382-384` |
| N9 JDK8 固定路径 | `JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"`，§7.6 与 §13.4 同变量（本机目录存在） | `s1-plan.md:205`、`:212`、`:365` |

D1–D16 记录完整（`s1-plan.md:393-408`）；本轮新增 D14/D15/D16 均不放松 schema、不虚报能力。

### 4. 一致性抽查（无新矛盾）

1. `event-model` 内部：§2（`:26-27`）、§3.3（`:84`）、§5（`:145-153`）、§7（`:172-179`）、§9（`:197`）、§11（`:211-215`）互为引用且无“仅 ui_event”式绝对句；§5 第 4 条 callback 例外与游离根不冲突（游离根本身即 `parentSpanId=null` 祖先）。
2. `transport`/`api` 的 S1 契约面未变：判定序 `415→413→400→逐行`与 4MB/1000 行/64KB（`api.v1.md:249-254`）、`{seq,event}` 包装与 `event` 逐字合法（`:306-308`）、分页 `1..500`/默认 200/`afterSeq>=0`、404/400/405、`capabilities` 仅 `ingestEvents=true`（`:327-333`）；S0 历史表与 501 段保留（`:26-43`、`:124-139`；`transport.v1.md:97-101`）。
3. `dispatch.md:134` 对 S1 契约章节“含 LOST/合成 rootEventId”的要求已满足；`dispatch` 本身未改。
4. `transport §4.5.8` 的展示纪律与 `s1-plan §8.2`（agent span 不在 S1 面板展示）一致（见 R3 的措辞澄清）。
5. S2 边界、归属零交集、T0–T13、Byte Buddy/networknt spike 与 `BLOCKED` 规则均保留：`s1-plan.md:28-35`、`:56-63`、`:129-132`、`:195-199`、`:267-283`、`:313-322`。
6. 无新范围/安全问题：无 graph/replay/stream/links、无关联/传播、无 DB/文件、无 CORS/鉴权/429、无 secret/真实数据/外链；fixture 与 schema 未动。

### 5. 机器复跑（只读，脚本在仓库外）

1. **schema**：`ajv@8.20.0`（`ajv/dist/2020.js`，`strict:true`）编译冻结 schema（`$ref=0`，`$id=urn:traceboard:schema:event:v1`）；2 行假批次 + 1 个 agent span **3/3 通过**；7 个负例（加 `seq`、非法 `confidence`、`status=LOST`、大写 traceId、缺 `parentSpanId`、重复 flag、`NOT_COLLECTED_*` 缺 `reason`）**全部被拒**。
2. **expected-facts**：8 条 fact 逐条深比较 **PASS**；`globalAssertions` 22 项 **0 fail**。
3. **字节规则**：假批次 2 非空行、0 空行；两文件 `bom=false`、`cr=0`、末字节 `0x0a`；`agent-controller-span.json` = 587 字节 + `\n`（合法 1 行 NDJSON）。
4. **结构/语义**：单一 `ui_event` 根；父链 `0f0e0d0c0b0a0908→0102030405060708`；`[2000000,12000000]⊆[0,12000000]`；agent `confidence=LOST`、`parentSpanId=null`、`rootEventId=click_lost_<spanId>`、3 flags、`durNs>0`；无 `values`/`sideEffects`；两个来源无 sessionId/traceId 交集。
5. **哈希**：见 §1/§8；与 S0 基线对比仅 `docs/contracts/{api,event-model,transport}` 变化（event-model 的变更是 B1 的直接修复）。

### 6. 剩余阻断

**无。** G1 可冻结并移交实现。

### 7. 新增非阻断项（不阻止冻结，须由 owner 在开工说明/测试中落实）

| ID | 事项 | 证据 | 处置 |
|---|---|---|---|
| R1 | `s1-plan §7.3` 允许 `traceId` 取 `-Dtraceboard.traceId` 配置值（否则逐 span 随机）。若演示时设置该值并调用两次 `#cancel`，两条游离根共享 `traceId`，违反 `event-model §5 第 2 条`的“`traceId` 由该 span 独占/同一 `traceId` 只有一个根”；T9 只断言 `spanId` 不同，不会捕获 | `s1-plan.md:162`、`:191`；`dispatch.md:69,104`；`event-model.v1.md:149` | **实现约束（不改冻结文档）**：S1 发事件一律逐 span 随机 `traceId`；`-Dtraceboard.traceId` 仅限“单 span 诊断”（或忽略）。T9 增一条“两次请求的 `traceId` 不同”。coder-backend 在交付说明中不得把配置 `traceId` 与多次调用并列宣传；建议下次文档触碰时补记为 D17 |
| R2 | `event-model §7` 仍写“任何丢弃都必须以 `DROP_COUNT` 或 `NOT_COLLECTED_LOST + reason` **出现**”，而 D16 明确 S1 agent 只在 stderr 计数、不写事件 flag | `event-model.v1.md:179`；`s1-plan.md:186-189,408` | 接受 D16 为**显式记录的偏离**（丢弃有计数、不静默，T10 以日志核对）；S1 不补 `DROP_COUNT`，事件内标记留待 S2 契约变更。tester 不得把 §7 该句作为 S1 事件的机器断言 |
| R3 | fixture README 的“同屏展示不代表能连线”是假设性警示，易被 coder-frontend 读成“S1 可以同屏展示 agent span”；`transport §4.5.8` 与 `s1-plan §8.2` 明确 S1 面板不展示该事件 | `README.md:16`；`transport.v1.md:120`；`s1-plan.md:237-238` | 以 `transport §4.5.8`/`s1-plan §8.2` 为准：S1 只读 `s_wb_demo`；将来若展示 `LOST` 事件必须标“游离/未归属” |

### 8. G1 冻结基线（复评时点 sha256，T13/G2 漂移检查以此为准）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
7988d1c42c94bd2cb5f160028ecfb655ef7e401b3094fbd4c0e9944856a1fdf7  docs/contracts/event-model.v1.md
a717e800b0fa4eff237ff1d2e2ac0ac516df1dfa92e054477b2eac5c4d064943  docs/contracts/api.v1.md
cad6224f85608ce910d5a5a74d2d9b422b7cc5af5c5de7bce682fc7e6c3b3ab8  docs/contracts/transport.v1.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
01c5c75b360ba7af576602cf1172dad3c0b18c97f81274e03f5bf25ed3d9e5e4  docs/plans/stages/S1/s1-plan.md
da9960fb497f564b1eff1a3b72afabe2ad3356a11df945513b0452e717b12668  docs/plans/stages/S1/dispatch.md
```

- 与 S0 G1 基线（`docs/plans/stages/S0/plan-review.md:53-60`）对比：`schema` 仍未变；`event-model` 由 `0820d57f…` 变为 `7988d1c4…`（B1 的唯一必需变更）；`api`/`transport` 的增量属 S1 追加型更新 + 本轮 §7.5/§4.5.8 注记。
- 第 1 轮基线与本轮基线的差异**只落在文档**；`schema`、3 个 S1 fixture、S0 fixture 字节均未动。

### 9. 交接

1. **G1 PASS 生效**：`s1-plan`、`docs/contracts/{api,transport,event-model}.v1.md`、`schema`、`fixtures/s1-walking-skeleton/**` 冻结；coder-backend/coder-frontend 可动工（`dispatch.md:191`）。
2. **R1 写入 coder-backend 开工说明与 tester T9**（逐 span 随机 `traceId` + 互异断言）；**R2** 以 D16 为准（tester 用日志证据核对丢弃/拒绝计数，不把事件内 `DROP_COUNT` 作为 S1 断言）；**R3** 以 `transport §4.5.8`/`s1-plan §8.2` 为准（S1 面板不展示 agent span）。
3. 漂移检查（T13、acceptance/G2）使用 §8 哈希；`sha256sum` 命令见 `s1-plan §3`。
4. 第 1 轮 FAIL 记录（下文）保留为历史，不再作为当前门禁结论；复评脚本复用仓库外 `C:/Users/13357/AppData/Local/Temp/tb-g1-s1/check.mjs`（结果见 §5）。
5. 本轮评审**仅改本文件**；未改 `schema`、fixture、契约、计划、pom、代码或 `.gitignore`，未执行 `npm install`，未做 git 写操作。

---

## 第 1 轮结论（历史，2026-11-23）

**G1: FAIL**

- **阻断 1 项**（B1：S1 唯一的“真实后端事件”与 `event-model.v1.md` §5 不变量第 2/3 条直接冲突，且 S1 契约层根本没有记录这条游离根形状；`s1-plan.md:379`（D11）与 `fixtures/s1-walking-skeleton/README.md:51-54` 声称“已在 `transport.v1.md` §4.5 记录”，该记录**并不存在**）。
- **非阻断 9 项**（N1–N9，均为文档措辞、示例可复现性、工具链细节，不改变 S1 验收口径）。
- 其余 16 项检查 PASS：范围/S2 边界、S0 历史保留与 S1 矩阵、meta capabilities、`{seq,event}` 包装与逐字 schema 合法、ingest 判定序与计数/幂等/限额、查询分页/404/400/405 与“查询≠回放”、两个 fixture 的字节规则与 schema 校验（Ajv 2020 `strict:true`）、8 条 expected-facts 断言、Byte Buddy/networknt 方案与 spike 门、可执行性与验收映射、安全隐私、D1–D13 偏离评估、schema 未变且无第二份。
- B1 **只改文档**（不改 schema、不改 fixture 一个字节），plan-writer 可在**一轮**内闭环（精确修法见下）。

---

## 评审方法与机器核对（可复现、只读）

1. 逐文件比对（Read）：dispatch、s1-plan、api/transport/event-model、3 个 S1 fixture、S0 评审、主计划指定行段、SOLO-PLAN、demo `OrderController.java`。
2. **schema 校验**：用仓库内 `tools/verify/node_modules/ajv@8.20.0`（`ajv/dist/2020.js`，`strict:true`）编译冻结 schema（`$ref` 计数 0，`$id=urn:traceboard:schema:event:v1`），校验 2 行假批次 + 1 个 agent span：**3/3 通过，0 error**；另跑 7 个负例（加 `seq`、`confidence=SUCCESS`、`status=LOST`、大写 traceId、缺 `parentSpanId`、重复 flag、`NOT_COLLECTED_*` 缺 `reason`）**全部被拒**。
3. **结构/语义核对**（脚本解析）：spanId 唯一、单一 `ui_event` 根、同 traceId/rootEventId、全 `OK`/全 `EXACT`、父链 `0f0e0d0c0b0a0908 → 0102030405060708`、区间包含 `[2000000,12000000] ⊆ [0,12000000]`、HTTP 200 落 `fetch.return`、agent span `confidence=LOST`+`parentSpanId=null`+`rootEventId=click_lost_<spanId>`+3 flags+`durNs>0`、无 `values`/`sideEffects`、agent 与假批次**无** traceId/sessionId 交集；全部满足。
4. **expected-facts 深比较**：8 条 `assert.path` 逐条 JSON 深比较 + 22 项 `globalAssertions`：**factFails=0，globalFails=0**。
5. **字节规则**：两文件均无 BOM、`\r` 计数 0、末字节 `0x0a`、无空行；`agent-controller-span.json` = 单对象 + 换行（587 字节 + `\n`），是合法 1 行 NDJSON。
6. **哈希/差异**：`sha256sum` 见“冻结基线”；`git diff` 显示仅 `docs/contracts/{api,transport}.v1.md` 被改（S0 段落以“S0 历史”标注保留），`schema`、`event-model`、`fixtures/case-a-zero-rows/**` 未改；`git status` 未出现越权路径。
7. 临时脚本位于仓库外 `C:/Users/13357/AppData/Local/Temp/tb-g1-s1/check.mjs`；未 `npm install`、未写仓库其它文件、未做任何 git 写操作。

---

## 检查表

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| A1 | 范围=S1 walking skeleton；无 service/mapper/SQL 探针、行数、关联/traceparent、图/回放/SSE/WS/请求切换；S2 边界显式 | PASS | `s1-plan.md:28-35`（§2.2 六条硬边界）；`dispatch.md:46-54`；`api.v1.md:236-238`（S1 章首“不做关联、不做 service/mapper/SQL…”）、`:354-358`（§7.5 未实现清单）；`transport.v1.md:30-31`（通路 B 未实现）、`:36`（S1 无传播头/无合并）、`:118-120`（§5 长连接不实现）、`:166-170`（§6.2 回放仍预留）；fixture 中无 `values`/`sideEffects`/`sqlId`/traceparent（机器核对） |
| A2 | 契约变更非破坏：S0 历史保留；S1 矩阵 ingest + sessions/events=IMPLEMENTED，graph/replay/stream/links=RESERVED | PASS | `api.v1.md:25-42`（§2 S0 原表 + “S0 历史，冻结，不改写”）、`:44-60`（§2.1 S1 权威矩阵：ingest/sessions/events IMPLEMENTED，graph/replay/stream/WS/links RESERVED）、`:62-138`（§3 与 §3.3 的 501 原文保留）、`:140-206`（§4 RESERVED 保留）；`transport.v1.md:96-100`（§4.4 S0=501 保留为历史）；`git diff -U0` 删除行仅为状态/标题改写，无 S0 内容丢失 |
| A3 | meta `capabilities` = ingestEvents true / realtime false / replay false | PASS | `api.v1.md:314-337`（§7.3 JSON + 约束）、`:49`；`s1-plan.md:72`、`:122`；`dispatch.md:96` 一致 |
| A4 | 查询包装 `{"events":[{"seq":N,"event":{...}}],"nextSeq":N}`；`event` 逐字、仍过 schema；`seq` 不进事件、ingest 拒收带 `seq` 行 | PASS | `api.v1.md:282-284`（形状）、`:305-307`（seq 在 event 之外、逐字、可直接过 schema、ingest 拒收）；`transport.v1.md:153-161` 同义；`s1-plan.md:69-71`；机器核对：两 fixture 无 `seq`，负例“加 seq 被拒”成立 |
| A5 | ingest 判定序 415→413→400→202；逐行拒收不整批 400；幂等键 `(sessionId,traceId,spanId)`（含批内重复）；限额 4MB/1000 行/64KB；202 计数恒等 | PASS | `api.v1.md:248-274`（表 + 字段 + 不变量 `accepted+rejected+dropped==非空行数`）；`transport.v1.md:59-79`；`transport.v1.md:102-116`（§4.5 解析/存储/上限/并发）；`s1-plan.md:93-110`（§6.3 八步，尺寸判定先于信封 400、`\r`→400、`FAIL_ON_TRAILING_TOKENS`）；`dispatch.md:77-84` 逐项对齐 |
| A6 | 查询：limit 1–500 默认 200、afterSeq 默认 0、非法 400、未知 session 404、写动词 405、graph/replay/stream 未注册 404；“查询≠回放” | PASS | `api.v1.md:286-312`（sessions 字段/排序、分页表、404/400/405、§312“这不是回放…capabilities.replay 保持 false”）；`transport.v1.md:147-164`（§6.1 含“术语纪律”）；`s1-plan.md:113-118`；`dispatch.md:88-92` 一致（含 `lastEventAtMs` 属 D3 追加） |
| A7 | fixture 可解析、字节规则（UTF-8 无 BOM、紧凑单行、末行 `\n`、无空行/`\r`） | PASS | 机器核对：batch 2 非空行/0 空行、agent 1 行；两文件 `bom=false`、`cr=0`、`endsLF=true`、末字节 `0x0a`；`fixtures/s1-walking-skeleton/README.md:98-99` 规则一致 |
| A8 | 3 条事件全部过冻结 schema（2020-12，`additionalProperties:false`）；负例被拒，证明不是“全放行” | PASS | Ajv 2020 `strict:true`：3/3 通过、7 个负例全部拒绝（见“评审方法”第 2 条）；schema `$ref=0`、`$id` 正确；`schema/traceboard.event.v1.json:1-264` |
| A9 | id/正则、父子链、区间包含、全 OK、假批次 EXACT、agent LOST、HTTP 200、nodeKey 用真实 `OrderController#cancel`（D1）、flags、无 secret | PASS | `frontend-fake-batch.ndjson:1-2`（`0f0e0d0c0b0a0908`→`0102030405060708`，`[2ms,12ms]⊆[0,12ms]`，`return={type:http,value:200}`，`EXACT`）；`agent-controller-span.json:1`（`parentSpanId:null`、`rootEventId=click_lost_7c3e5a91b2d4086f`、`confidence:LOST`、3 flags、`OrderController#cancel`）；真实源码 `OrderController.java:42-43`（`cancel(@PathVariable long id)`，无 overload）；正则核对 `^s_…`/`^[0-9a-f]{32}$`/`^[0-9a-f]{16}$`/`^click_[A-Za-z0-9_-]{8,}$`/flag 字符集全部通过 |
| A10 | expected-facts 的 8 条断言 + 全局断言与 fixture 实际相符 | PASS | 机器核对：F1–F8 逐条 PASS（`startNs=0`、`parentSpanId=null`、父 spanId、`return.value=200`、`confidence=EXACT`、agent `confidence=LOST`、`rootEventId=click_lost_…`、`return.type=org.springframework.http.ResponseEntity`）；`globalAssertions` 22 项 0 fail；`expected-facts.json:21-50` |
| A11 | **event-model §5 不变量 vs S1 agent span** | **FAIL** | `event-model.v1.md:142`“`parentSpanId=null` 仅用于操作根（S0 为 `ui_event`）”、`:143`“所有事件共用同一 `rootEventId`；前端点击生成，后端通过 traceparent + clickId 继承”、`:24`“前端点击根 ID，后端 span 继承” 与 `agent-controller-span.json:1`（`kind=controller`、`parentSpanId:null`、合成 `rootEventId`）**直接冲突**；见 B1 |
| A12 | S1 契约层是否记录 agent 事件形状；D11/README 引用是否真实 | **FAIL** | `dispatch.md:134` 要求 S1 章节“含 … LOST/合成 rootEventId”，但 `api.v1.md` §7 与 `transport.v1.md` §4.5/§6.1 **均无** `LOST`/`parentSpanId`/`click_lost` 表述（`grep` 结果为空）；`s1-plan.md:379`（D11）与 `fixtures/s1-walking-skeleton/README.md:53` 声称“已在 `transport.v1.md` §4.5 记录”，`transport.v1.md:102-116` 实际只有 7 条 ingest 行为，**无该记录**；见 B1 |
| A13 | Byte Buddy 1.14.19 + shade/relocate + `--release 8` + 单方法 Advice 对 Boot 2.7 fat jar/JDK8 可行；有 spike 与 BLOCKED 规则（禁止合成事件兜底） | PASS（须 spike 实证） | `s1-plan.md:135-141`（§7.1 锁 1.14.19、`maven.compiler.release=8`、shade 3.5.3 + relocate + `ManifestResourceTransformer`）、`:143-151`（§7.2 `disableClassFormatChanges()` + `Advice.to(...).on(named("cancel").and(takesArguments(long.class)))`、ignore 清单、Advice 内不 new 业务对象/不调 getter）、`:183-189`（§7.5 硬门 spike：transform 命中日志 + 真实调用产生 1 条 span + demo 仍 200；失败 `BLOCKED`，**不得**合成启动事件）；`dispatch.md:207`、`:220` 同口径。技术判定：BB 1.14.x 的 Java 8 基线、Advice 内联调用 agent 类由 `-javaagent` 追加到 system classpath（LaunchedURLClassLoader 可委派）属可行路径，但**必须**由 spike 证据确认（计划已强制） |
| A14 | networknt 1.0.87 + Boot 3.2.12/Jackson 2.15.4 对 2020-12 可行；schema 构建期单源、无外部 `$ref`、fail-open 无重试风暴 | PASS（须 spike 实证） | `s1-plan.md:79-85`（锁 1.0.87、`maven-resources-plugin:3.3.1` 从根 `schema/` 拷入 `target/classes/schema/`、禁止 `src/main/resources` 副本、启动即编译 schema 失败即起不来）、`:125-130`（§6.7 spike：jar 内 schema、非法 `confidence` 必须 rejected、`dependency:tree` 记录版本）；`transport.v1.md:106-108`；workspace 实测 `server/collector/src/main/resources` 仅 `application.yml`（无第二份 schema），全仓 `traceboard.event.v1.json` 只有 `schema/` 一份；`s1-plan.md:174-181`（有界队列 16 + 单守护线程 + 300/700ms + 1 次尝试 + 全 `Throwable` 吞掉 + 丢弃计数） |
| A15 | 可执行性：归属零交集、命令含 `JAVA_HOME` 覆盖与双引号、测试覆盖全部 ingest 码/幂等/分页/agent E2E（collector 起停）/workbench 构建代理/无 S2 扫描/schema parity；验收映射 S1 完成信号 | PASS（含 N4/N8/N9 建议） | 归属：`s1-plan.md:53-62` 与 `dispatch.md:174-185` 同集且无交集；命令：`:306-363`（`JAVA_HOME="C:/Program Files/Java/jdk-21" mvn …`、`(cd "workbench" && npm ci && npm run build)`、demo JDK8 覆盖、`-javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar"`）；产物名与现存 `agent/pom.xml:14`、`server/collector/pom.xml:14`、demo `pom.xml:16`、根 `pom.xml:15-18`（仅 agent+collector 模块）一致；测试：`s1-plan.md:247-262` T0–T13 覆盖 202/400/413/415、混合批 line=2/3、重发 dropped=2、`limit=501/afterSeq=-1`→400、404/405、meta 精确、agent LOST/双 spanId、collector 停机 <3s、workbench 横幅/代理/无 SSE-WS、无 S2 扫描、major=52/Premain-Class/无未 relocate 包；验收映射 `:12-19` 六信号 ↔ `dispatch.md:24-31` |
| A16 | 安全/隐私：无 secret、无真实数据、无遥测/CDN/镜像、仅回环、错误信封不回显 | PASS | 新/改文件 grep `password/secret/bearer/cookie/PRIVATE KEY` 无命中；外链只有 `127.0.0.1`/`localhost`（`api.v1.md:11,214,223-228,363-371`、`transport.v1.md:13-22`）；无 `C:\`/`D:\` 绝对路径出现在 fixture；`transport.v1.md:172-177`（§7 只监听回环、不回显请求体、不伪造鉴权）、`api.v1.md:351-352`（错误 message ≤200、不含内部路径/凭据）；fixture 用虚构 id/金额，无客户数据 |
| A17 | 偏离 D1–D13 已记录且不削弱 S1 验收 | PASS（2 条备注） | `s1-plan.md:365-381` 共 13 条；逐条评估见下表；无一条放松 schema、无一条把未实现能力写成已支持；D4（`return` 去掉 `httpStatus`）、D7（理由引述失准）为备注项，见 N2/N6 |
| A18 | `schema/traceboard.event.v1.json` 与 S0 基线一致；无字段/枚举变更；无第二份 schema；无外部 `$ref` | PASS | `sha256=927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a`，与 `docs/plans/stages/S0/plan-review.md:53` 逐字相同；`git status` 未列出 `schema/`；全域仅一份 schema；`$ref=0` |

---

## 阻断问题（必须修复后才能冻结）

### B1（唯一阻断）S1 唯一真实后端事件与 `event-model.v1.md` §5 不变量冲突，且契约层未定义“游离后端根”

**事实**

1. `fixtures/s1-walking-skeleton/agent-controller-span.json:1` 是 S1 唯一的真实采集事件：`kind=controller`、`parentSpanId:null`、`confidence:LOST`、`rootEventId:"click_lost_7c3e5a91b2d4086f"`、`flags` 含 `LOST_BACKEND`。
2. 冻结契约 `docs/contracts/event-model.v1.md:142` 写“`parentSpanId=null` **仅**用于操作根（S0 为 `ui_event`）”，`:143` 写“所有事件共用同一 `rootEventId`；前端点击生成，后端通过 traceparent + clickId 继承”，`:24` 写“前端点击根 ID，后端 span 继承”。该文件同段声明“校验工具会检查，**评审也按此核对**”（`:138`），因此这不是“措辞宽松”，而是评审与 tester 都会据以判 FAIL 的规范。
3. `dispatch.md:134` 要求 S1 契约章节必须包含“LOST/合成 rootEventId”，但 `api.v1.md` §7 与 `transport.v1.md` §4.5/§6.1 均查无此项（`grep "LOST\|parentSpanId\|click_lost"` 在 transport 仅命中 §1 的一行进程说明与 §2 的“无传播头”）。
4. `s1-plan.md:379`（D11）与 `fixtures/s1-walking-skeleton/README.md:53` 声称“在 `transport.v1.md` §4.5 记录 S1 允许的游离区形状”——`transport.v1.md:102-116` 实际是 ingest 的 7 条行为，**没有该记录**。即：这一语义缺口既未进 `event-model`，也未进 `transport`，只存在于 fixture README 与 s1-plan，属“契约层缺位 + 引用失实”。
5. 语义本身是对的：主计划 §8.3 明确 `LOST`=“只有一端（…或后端有请求无前端根）→ 游离区”（`00-master-plan.md:620`），并给出“后端有请求但无前端根：右侧单独‘游离后端请求’入口”（`:626`）；§2.3 同样（`:142`）。`status-semantics.md:53,56` 亦已支持。因此**该修的是 `event-model` 的绝对措辞，不是 fixture，更不是 schema**。

**危害**

- G1 冻结后，`tester` 若按 §5 实现不变量检查（S0 已把“不变量必须机器可判定”写进流程），会对 S1 的**唯一真实事件**报 FAIL；若不实现，则冻结契约含一条被自己的合规样例违反的规范（与 S0 的 B1 同类缺陷，且这次发生在 G1 之后）。
- 下游 `coder-backend` 无法从契约判断“游离根是否合法、`rootEventId` 该怎么造”，只能在 fixture README 里找依据；`acceptance` 会面对“契约说不行、fixture 说行”的自相矛盾。
- 引用失实（D11/README 指向不存在的小节）会让漂移检查失去锚点。

**精确修法（方案 A：只改文档，schema 与 fixture 一个字节都不动；一轮可完成）**

1. `docs/contracts/event-model.v1.md` §5 第 2 条末尾追加例外（与第 4 条 callback 例外同风格）：
   > **S1 例外（isolated backend request）**：当一次后端请求**没有任何前端根**时，允许一条游离根 span：`parentSpanId=null`、`kind=controller`（仅此一种）、`confidence=LOST`、`flags` 必须含 `LOST_BACKEND`、`traceId` 为该 span 独占（不得与任何前端或其它游离根 `traceId` 相同）。同一 `traceId` 内仍只有一个根；`ui_event` 根与游离根不得共存于同一 `traceId`。
2. §5 第 3 条追加：“**唯一例外**是第 2 条的游离根：其 `rootEventId` 由本端合成占位 `click_lost_<该 span 的 spanId>`（仍满足 `^click_[A-Za-z0-9_-]{8,}$`），表示‘这条链没有前端点击’，不得写成真实 clickId，也不得与任何前端 `rootEventId` 相同。”
3. §2 的 `rootEventId` 行（`:24`）改为：“前端点击根 ID（后端 span 继承）；后端游离根使用合成占位 `click_lost_<spanId>`（见 §5 第 2 条例外）。”
4. §7 flags 表（`:157-166`）新增一行：`LOST_BACKEND`｜该 span 是只有后端一端的游离根（S1 起由 agent 写入）｜v1 使用；并注明 `SKELETON`/`S1_ONE_METHOD`/`S1_WALKING_SKELETON` 为本阶段标记，读取方按既有规则忽略未知 flag。
5. §9 表行（`:184`）“关联规则表/游离区结构｜S1 设计，本文不实现”改为“S1 起允许 §5 第 2 条的游离根形状（`click_lost_<spanId>` + `confidence=LOST`）；关联规则表/手工合并仍属后续检查点”；§11 参考样例（`:197-199`）补 `fixtures/s1-walking-skeleton/{frontend-fake-batch.ndjson,agent-controller-span.json}`。
6. `docs/contracts/transport.v1.md` §4.5 增第 8 条（3 行即可）：“S1 的 agent 事件是**游离后端根**（`parentSpanId=null`、`confidence=LOST`、`rootEventId=click_lost_<spanId>`、flags 含 `LOST_BACKEND`），语义定义见 `event-model.v1.md` §5 第 2 条例外；它不与任何前端事件关联。”
7. 同步修正引用：`s1-plan.md:379`（D11）与 `fixtures/s1-walking-skeleton/README.md:51-54` 的“须 G1 显式确认/留给 G1 决策”改为“G1 裁决：按方案 A 修订 `event-model` §2/§5/§7/§9/§11 与 `transport` §4.5（**仅文档，schema 不动**）”，并删掉“本阶段不改 event-model”的悬念表述。
8. 可选同轮：`api.v1.md` §7.5 加一句“agent 的 controller span 为游离后端根，按 `event-model.v1.md` §5 第 2 条例外解释；仍不存在任何关联接口或字段”。

**验收（复评时逐条复核）**

- `grep -n "click_lost" docs/contracts/event-model.v1.md docs/contracts/transport.v1.md` 各 ≥1 处，且 `event-model` §5 不再存在“`parentSpanId=null` **仅**用于 …`ui_event`”这类无例外的绝对句。
- `sha256sum schema/traceboard.event.v1.json` 仍为 `927937df…a489a`；`fixtures/s1-walking-skeleton/**` 三个文件哈希不变（本评审基线）。
- 复跑本评审第 2–4 项机器核对：3/3 schema 通过、8 条 fact + 22 项全局断言 0 fail。
- `event-model` §7 的 `LOST_BACKEND` 与 fixture `flags` 逐字一致（大小写一致）。

---

## 非阻断建议（不阻止冻结，但建议随 B1 同轮或由 tester 落实）

| ID | 事项 | 证据 | 建议 |
|---|---|---|---|
| N1 | `LOST_BACKEND`/`S1_ONE_METHOD`/`SKELETON`/`S1_WALKING_SKELETON` 未进 flags 词表；schema 允许任意合法字符、契约允许“未知 flag 读取方忽略”，故合法，但显得随意 | `event-model.v1.md:157-166`、`:165` vs `s1-plan.md:170`、`:373` | 随 B1 第 4 步登记为“本阶段标记”，避免读取方把它们当未知语义 |
| N2 | D7 的理由**引述失准**：dispatch §4.5 的点击是 `durNs=5000000`（`dispatch.md:123`），fetch `1000000/3000000` 本就落在 `[0,5ms]` 内，不存在“会让 fetch 越出父区间”；另外 `nodeKey` 由 `#btn-cancel`（`dispatch.md:123`）改为 `#btn-s1-fake` **未列入**偏离表 | `s1-plan.md:375`（D7）vs `dispatch.md:123-124`；`frontend-fake-batch.ndjson:1` | 改 D7 理由为“统一取整到 12ms/2ms/10ms 便于演示与工作台复用，非因原数值越界”；并补记 `nodeKey` 变更（与 §5.4 的按钮 id 对齐） |
| N3 | `expected-facts.json` 把 S0 的顶层全局键（`eventCount/traceId/rootEventId/noExceptions/confidenceAllExact/statusAllOk/flagRequired`）移入 `globalAssertions.<source>`，并给每条 fact 加 `source`；现校验器**无法直接消费**（它按硬编码路径读 case A，并要求恰好 5 条 fact），与 `dispatch.md:135`“expected-facts 可被现有校验器消费”字面不符 | `tools/verify/verify.mjs:494-571`、`fixtures/s1-walking-skeleton/expected-facts.json:7-51`、README `:58-64` | 作为 D14 显式记录“S1 expected-facts 为**新增形状**，由 tester 新增 S1 门禁消费”；并明确 T0 的 S0 V1b（5 fact）不得改动；README 的“沿用 S0 形状”改为“沿用 `facts[]` 条目与 `pathSyntax`，全局键下沉到 `globalAssertions`” |
| N4 | 假批次固定 `sessionId=s_wb_demo` 且读回固定 `afterSeq=0&limit=200`：同一会话累计超过 200 条（≈100 次点击）后，工作台只会重复展示**最旧**一页，最新点击不可见，演示闭环断裂 | `s1-plan.md:208-215` vs `api.v1.md:300-307` | 读回前先取 `GET /api/v1/sessions` 的 `eventCount`，用 `afterSeq=max(0, eventCount-limit)` 读尾页；或当 `nextSeq < eventCount` 时在 UI 明示“仅显示第一页” |
| N5 | agent 发送侧未明确“单行必须带结尾 `\n`”，也未要求对非 202 计数打印；目前只有“队列满丢弃”有计数。若换行缺失，每批都会 400 而**静默丢事件**，与主计划 §9.2“静默丢弃是产品不可接受的失败”相悖 | `s1-plan.md:176-180` vs `transport.v1.md:66`（末行缺 `\n`→400）、`00-master-plan.md:677-680` | §7.4 补一句“每行必须以 `\n` 结尾”；发送线程对非 202 也累加计数并按同样节流频率打印 `[traceboard-agent] ingest_rejected=<n> status=<code>`（1 次尝试、不重试，仍然是 fail-open） |
| N6 | agent fixture 的 `source.line=43` 不可复现：Advice 在**方法退出**取栈，帧行号是退出点（`OrderController.java:47-48`），不是声明行 43；README 称“当前构建下声明行” | `agent-controller-span.json:1`、`fixtures/s1-walking-skeleton/README.md:43` vs `OrderController.java:42-49` | README 标注 `line` 为示例值；T9 保持只断言 `source.file=OrderController.java`（现文案已是“若存在”，无需改测试） |
| N7 | `maven-shade-plugin` 默认 `createDependencyReducedPom=true`，会在 `agent/` 落 `dependency-reduced-pom.xml`（新增未跟踪文件） | `s1-plan.md:135-141` 未提；`git status` 当前无该文件 | 设 `<createDependencyReducedPom>false</createDependencyReducedPom>`，或由 acceptance 在 `.gitignore` 覆盖（`.gitignore` 仅 acceptance 可写） |
| N8 | “schema parity”只比对根文件哈希与“jar 内含该路径”，未做**字节级**相等断言 | `s1-plan.md:256`（T7 后无 parity 项）、`:359-361` | T2 增一条：`unzip -p "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" BOOT-INF/classes/schema/traceboard.event.v1.json | sha256sum` 必须等于根 schema 哈希 |
| N9 | agent 端到端命令用裸 `java`（`s1-plan.md:347`），依赖 PATH 恰为 JDK8；`§7.6` 只是“若 PATH 不是 JDK8 则显式用绝对路径” | `s1-plan.md:201`、`:347` | tester 侧固定 `JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"` 变量并 `"$JAVA8" -javaagent:...`，把歧义从“人判断”改为“命令固定” |

---

## 偏离项评估（D1–D13，`s1-plan.md:365-381`）

| ID | 评估 | 理由 |
|---|---|---|
| D1 `nodeKey` 改真实 `OrderController#cancel` | **接受（本评审明确认可）** | `dispatch.md:109` 的 `#cancelOrder` 是 S0 fixture 的虚构名；真实源码为 `cancel(@PathVariable long id)`（`OrderController.java:42-43`）。用不存在的名字会与“真实插桩”事实相悖；S0 fixture 未被改动 |
| D2 `seq` 改为 `{seq,event}` 包装 | 接受 | dispatch §4.2 把 `seq` 放进事件会违反 `additionalProperties:false` 且使事件不再逐字 schema 合法；包装保持“事件 = schema 合法对象”（A4/A8 实证） |
| D3 sessions 增 `lastEventAtMs` | 接受 | 纯追加字段，不改既有字段语义；`api.v1.md:290-293`、`transport.v1.md:151` 已同步 |
| D4 增 `source{file,line}`、`return` 改为 `{type:FQCN,value:null}`（不再反射 `httpStatus`） | 接受（备注 N6） | dispatch §4.4 原意是给 controller 记 HTTP 状态；本阶段 S1 完成信号不依赖 `httpStatus`，`return.type` 非空即可，且“不调业务 getter”更安全。属**信息量收缩**而非能力虚报；README 已注明 value 未采集 |
| D5 agent flags 3 项（含 `LOST_BACKEND`） | 接受（随 N1 登记） | dispatch 要求 2 项且“不追加其它语义标记”；`LOST_BACKEND` 是 S1 的关键事实（只有后端一端），显式标记优于隐含；需按 N1/B1 进词表，避免读取方当未知 flag |
| D6 fixture 文件名改为 `frontend-fake-batch.ndjson`/`agent-controller-span.json` | 接受 | 格式与内容自洽（2 行 NDJSON；单对象同时是 1 行 NDJSON，已实测）；下游四张卡均按新名引用 |
| D7 时序 5ms/1ms/3ms → 12ms/2ms/10ms | 接受（理由须改，N2） | 新数值区间包含成立（机器核对）；但理由引述失准（原值本就不越界） |
| D8 固定 `sessionId=s_wb_demo` 取代 `s_s1_ui_<base36>` | 接受（备注 N4） | 固定读回路径对 S1 演示更稳；代价是会话累计增长，见 N4 的尾页读法 |
| D9 “一次有界读回”而非轮询 | 接受 | 与 `dispatch.md:50` 禁止轮询一致；1 次 GET + 至多 1 次 300ms 重试属读回兜底，不是订阅 |
| D10 锁 networknt 1.0.87 / Byte Buddy 1.14.19 | 接受 | 版本锁定 + `dependency:tree` 证据 + spike 反例（非法 `confidence` 必须 rejected），符合“不得手写校验/第二份 schema” |
| D11 event-model 冲突留给 G1 | **接受其“停回 G1”的处置，但不接受“不改文档就冻结”** | 见 B1：G1 的裁决是“按方案 A 修订 event-model（仅文档）”；另 D11 声称的 transport §4.5 记录不存在，须一并修正 |
| D12 MANIFEST 由 shade 写 | 接受 | 避免 jar-plugin 与 shade 双写丢条目；tester 仍以 `unzip -p` 断言（工具可用：`/usr/bin/unzip`） |
| D13 body 含 `\r` → 400 | 接受 | 属**收紧**且与 `transport.v1.md:40`（UTF-8 无 BOM、LF）一致；`api.v1.md:252`、`transport.v1.md:105` 已双向落文 |

**结论：13 条偏离均不削弱 S1 验收口径**（无一条放松 schema、无一条把未落地能力写成已支持、无一条改 dispatch §3 的构建/端口/存储决策）。需随 B1/N2 修正的只是**记录准确性**（D7 理由、`nodeKey` 未记、D11 引用）。

---

## 冻结基线（本评审时点 sha256，供复评/acceptance 漂移核对）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
0820d57f3c2f51b193a0f809cb17b0c9805ff1c06ef3fa6f8e8496b582d9614a  docs/contracts/event-model.v1.md
c310daa11ff83f62aecc8f60df933fa3e77bfa4736849da0394650f4ea133776  docs/contracts/api.v1.md
e50462834446b2192c4bc92beec4f5c23611c36dd834eb104f673385f2edc3c0  docs/contracts/transport.v1.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
e253469cdead3e2bfe6ff9acfd81af6dc590a512a4122168b81d4478dc0109fc  fixtures/s1-walking-skeleton/README.md
1e7db73cd0edc38b0f4b29794f357497687090d829f557c67b6efdb6bf42842d  docs/plans/stages/S1/s1-plan.md
da9960fb497f564b1eff1a3b72afabe2ad3356a11df945513b0452e717b12668  docs/plans/stages/S1/dispatch.md
```

- 与 S0 G1 基线（`docs/plans/stages/S0/plan-review.md:53-60`）对比：`schema`、`event-model` **未变**（后者正是 B1 的成因）；`api`（`88bd185f…`→`c310daa1…`）、`transport`（`2ca028e6…`→`e5046283…`）变更属 S1 追加型更新，与 `git diff --stat`（+282/−47，删除行仅状态/标题改写）一致。
- `event-model` 未进入 S1 变更集 → 违反 `dispatch.md:134`“S1 契约章节含 LOST/合成 rootEventId”的落点要求，B1 修完须重新冻结本文件哈希。

---

## 交接

1. **返回 plan-writer 一轮**：只做 B1 的 8 处文档编辑（`event-model` §2/§5/§7/§9/§11、`transport` §4.5、`s1-plan` D11、fixture README §2.2）；**禁止**改 schema、fixture 字节、代码。
2. 建议同轮吸收 N1（flags 词表）、N2（D7 理由 + `nodeKey` 变更记录）、N3（expected-facts 形状记为 D14）。
3. N4/N5/N8/N9 属 coder/tester 实现细节，写入对应的开工说明即可，不必回到 G1。
4. 复评口径：本文件 A1–A18 全部重跑（机器核对脚本可复用 `C:/Users/13357/AppData/Local/Temp/tb-g1-s1/check.mjs`），B1 验收四条全绿即改判 `G1: PASS`，并重新登记冻结哈希。
5. G1 通过前 `coder-backend/coder-frontend` 不得动工（`dispatch.md:191`）。

## 文件变更声明

本次评审**仅创建** `docs/plans/stages/S1/plan-review.md` 一个文件；仓库内其余文件全部只读（未改 `schema/`、`fixtures/`、`docs/contracts/`、`docs/plans/**`、pom、代码或 `.gitignore`），未执行 `npm install`，未做任何 git 写操作。
