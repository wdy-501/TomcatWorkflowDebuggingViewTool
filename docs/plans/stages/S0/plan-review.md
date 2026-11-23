# S0 契约评审（G1 门）

> 评审人：plan-reviewer（只读）｜日期：2026-11-23｜阶段：S0
> 绑定简报：`docs/plans/stages/S0/dispatch.md` §5.2（核 5 点）→ 本文件扩展为 22 项检查
> 权威来源：`docs/plans/00-master-plan.md` §2.3(129-144)、§8.1-8.3(588-627)、§8.5(636-641)、§13.4(995-1027)、§13.6(1037-1046)；`docs/plans/SOLO-PLAN.md` §3(S0 行, 66)、§4(80-97)

---

## 复评（Re-review 2026-11-23）

**G1: PASS**

- 第 1 轮唯一阻断 **B1 已闭环**（plan-writer 采用方案 A：只改三处文档表述，schema 与 fixture 未动）。
- **N1 已按分级处置成文**：`.gitattributes` 授权 acceptance 在 G2 创建（D15），风险行、Step 4 复核命令齐备；工作区确认该文件**尚未创建**（符合“本轮不创建”约定）。
- 无新增阻断项。N3（`return.value` 是否 required）仍为**已记录的延后项**（`s0-plan.md:411-415` §13.1），属 schema 收紧决策，不阻断 S0。
- 本轮新增 3 条非阻断备注（N9、N10、N11），均不影响冻结，可在 G2 或 S1 契约变更时消化。

### 复评依据与范围

1. 重读对象：`docs/contracts/event-model.v1.md`、`fixtures/README.md`、`fixtures/case-a-zero-rows/{README.md,expected-facts.json}`、`docs/contracts/api.v1.md`、`docs/plans/stages/S0/s0-plan.md`、`schema/traceboard.event.v1.json`、`fixtures/case-a-zero-rows/events.jsonl`、`docs/plans/stages/S0/dispatch.md`、主计划 §2.3(129-142)/§13.4(995-1027)。
2. 机器核对（只读）：临时脚本位于仓库外 `C:/Users/13357/AppData/Local/Temp/tb-g1-recheck/check.mjs`，解析 `events.jsonl` 9 行，按**修订后**契约 §5 第 4 条模拟 V4b（父存在性 + 同步 span 严格包含 + callback 根包含），并对 `expected-facts.json` 的 5 条事实逐条深比较、核对 6 项全局断言与字节规则；未写仓库、未 `npm install`、未做 git 写操作。
3. 变更面核对：以 mtime 与内容比对确认本轮被改的文件恰为 `event-model.v1.md`(10:15:08)、`fixtures/README.md`(10:15:08)、`case README`(10:15:12)、`expected-facts.json`(10:15:29)、`api.v1.md`(10:15:29)、`s0-plan.md`(10:16:29)；`schema`(10:08:05)、`events.jsonl`(10:07:20)、`dispatch.md`(10:02:06)、`status-semantics.md`(10:05)、`transport.v1.md`(10:09) 均早于修订窗口且内容与第 1 轮引用逐项一致。

### 复评检查表

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| R1 | B1：三处不变量措辞**逐字一致**，callback 例外显式 | PASS | `event-model.v1.md:144`、`fixtures/README.md:44`、`case README:33-35` 为同一句：“子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。**唯一例外**：`kind=callback`（响应回调）允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span（`parentSpanId=null` 的祖先）区间内。”三者无第二种表述；`case README:37-39` 补具体数字（callback `[39ms,48ms]`、父 fetch `[6ms,38ms]`、根 `[0ms,52ms]`，晚 1ms 属设计如此） |
| R2 | B1：V4b 使不变量**机器可判定**（同步严格包含 + callback 根包含） | PASS | `s0-plan.md:232` V4b ①父 span 必须同文件出现；②非 callback：`startNs>=parent.startNs` 且 `end<=parent.end`；③callback **只**做根包含（沿 `parentSpanId` 上溯到 `parentSpanId=null`）；④上溯无唯一根 → FAIL；⑤例外**仅限** `kind=callback`，不得扩大；⑥给出 case A 逐 span 期望值。`:241` 追加证据输出字段（spanId/parentSpanId/根 spanId/kind/子父根区间）且明确“不得只查 startNs、不得整体排除 callback”；`:465`（§14.3）要求 verify.mjs 实现“V1–V11 与 V4b” |
| R3 | B1：对现有 `events.jsonl` 模拟检查 **0 违规** | PASS | 模拟输出：`strictChecked=7 callbackRootChecked=1 violations=0`。7 个非根非 callback span（行为 2–8）全部满足严格包含；callback `1000000000000009` 自区间 `[39000000,48000000]`，父 fetch `1000000000000004` `[6000000,38000000]`（起点晚 1ms），根 `1000000000000001(ui_event,[0,52000000])`，落根内 ✓ |
| R4 | B1：schema / fixture 的 `parentSpanId` 及其余字段**未变** | PASS | `schema:48-52` 仍为 `type:["string","null"]` + `pattern:"^[0-9a-f]{16}$"`；`events.jsonl:9` 仍 `parentSpanId:"1000000000000004"`、`startNs:39000000`、`durNs:9000000`；`events.jsonl:1` 仍 `parentSpanId:null`；mtime 证明两文件早于本轮修订。未采用方案 B（改父指针），fixture 语义未漂移 |
| R5 | 无新矛盾：`expected-facts.json` 仍 9 事件、5 条事实深比较全等 | PASS | `eventCount=9` 与非空行数一致；全局断言 `traceId`/`rootEventId` 全等、`noExceptions`、`confidenceAllExact`、`statusAllOk`、每行 `DROP_COUNT=0` 均成立；F1 `sideEffects.0.rowsAffected=0`、F2 `return.value=0`、F3 `=true`、F4 `=200`、F5 `="操作成功"` 五条全部 PASS（factFails=0）；F1 `summary` 已去掉事件中不存在的表名（N4 落实） |
| R6 | 无新矛盾：`api.v1` 与 demo 404 行为对齐 | PASS | `api.v1.md:198` 新增 `POST /api/orders/{id}/cancel`（`id`≠1）→ `404 {"data":false}` 行；`:200-201` 失败分支口径收窄为“未知路径/方法不允许/内部错误不承诺”，与 `s0-plan.md:180`（§5.4）、`:406`（D13）、`:436`（§14.1 OrderController“形状符合附录 A”）一致；`1` 号用例 `200 {"data":true}` 三处一致 |
| R7 | 无新矛盾：偏离项清单自洽 | PASS | 表内 `D1–D16` 共 **16** 条，与 `s0-plan.md:389-390` 的“16 条（D1–D16）”及 `:483` 修订日志一致；N1–N8 全部有处置：N1→D15、N2→api 附录、N3→§13.1 延后、N4→F1 summary、N5→D6 理由更正、N6→计数+Step 4 复述 5174、N7→D16、N8→Step 4②+V1 实测说明 |
| R8 | N1 处置成文且未擅自创建文件 | PASS | `s0-plan.md:408`（D15）授权 acceptance 创建根 `.gitattributes`（`*.jsonl/*.json/*.md/*.java text eol=lf`，或 `* text=auto` 叠加显式行）；`:50` 文件树归属 acceptance；`:100-103` 约束“plan-writer/coder/tester 均不创建”；`:370` 风险表“CRLF 回归”行含处置与复跑抽查命令；`:269-270` Step 4 要求 `git check-attr -a` 出现 `text: set`/`eol: lf` 并在 `acceptance.md` 复述授权来源。工作区实测：`.gitattributes` **不存在**，`core.autocrlf=true`（系统级）仍然如此 |
| R9 | 复确认：`status` 枚举 8 值、`kind` 11 值、`confidence` 4 值 | PASS | `schema:124-133`（OK/RETURNED_FALSE/THREW/NOT_COLLECTED_POLICY/NOT_COLLECTED_LOST/NOT_COLLECTED_NO_DEBUG_INFO/TRUNCATED/UNKNOWN）== 主计划 §13.4(`00-master-plan.md:1012`) 与 §2.3(133-141) 投影；`REDACTED` 落值级、`LOST` 落 `confidence` 未回潮 |
| R10 | 复确认：§13.4 核心字段全覆盖（19+`reason`） | PASS | `schema:8-23` required 14 键、`:24-241` properties 20 键，与 `00-master-plan.md:997-1022` 一一对应；`reason` 条件必填 if/then 仍在（`:243-264`） |
| R11 | 复确认：JSONL 字节规则与安全面 | PASS | 无 BOM（首字节 `7b`）、`\r`=0、末字节 `0x0a`、9 非空行、0 空行；`schema/`+`fixtures/`+`docs/contracts/` 无 secret（仅出现“禁止/脱敏”规则文字）、外链仅 `127.0.0.1`/`localhost` 与标准 `$schema` `json-schema.org`、无 `C:\`/`D:\` 绝对路径、schema 内 `$ref` 计数 0 |
| R12 | 复确认：未把 S1 实现写入契约或计划 | PASS | agent 仅 noop premain（`s0-plan.md:134-137`）、ingest 固定 501 不解析不落盘（`:163-165`）、RESERVED 路由不得注册（`:166`）、工作台不渲染图/无回放（`:188-207`）、§12 硬边界（`:378-385`）与 `dispatch.md:45-52` 同集；V4b 属校验项，未引入采集/关联实现 |
| R13 | 可执行性与归属矩阵（coder-backend/coder-frontend/tester/acceptance）未变 | PASS | 归属：`s0-plan.md:49`（pom→coder-backend）、`:51-89` 树 + §14.1(`:419-438`)/§14.2(`:440-458`)/§14.3(`:460-467`) 三清单零交集；`workbench/` 与 `demo/frontend/` 仍 coder-frontend，`agent|server/collector|demo backend` 仍 coder-backend，`tools/verify`+`test-report.md` 仍 tester，`README.md`/`.gitignore`/`acceptance.md`/`progress.md` 仍 acceptance，唯一新增为 `.gitattributes`→acceptance（D15）。命令仍为 `JAVA_HOME="C:/Program Files/Java/jdk-21" mvn ...`、demo JDK8 兜底、全部路径双引号；Step 0–4 顺序门禁与 `dispatch.md:216-219` 一致；`verify.mjs` 仍 V1–V11+V4b 一次执行非零退出 |

### 本轮新发现（非阻断，建议 G2/S1 消化）

| ID | 事项 | 证据 | 建议 |
|---|---|---|---|
| N9 | 契约例外的**触发条件**写作“callback 在其 `fetch` 父 span 结束后启动”，而 V4b ③ 对所有 `kind=callback` 一律只做根包含，未校验父 span 的 `kind` 是否为 `fetch`（检查口径比文字略宽） | `event-model.v1.md:144`/`fixtures/README.md:44`/`case README:33-35` vs `s0-plan.md:232` ③ | case A 的 callback 父确为 `fetch`，当前 0 违规、无实际影响；S1 引入多父形态前，把文字统一为“callback 不受父区间约束、仅受根区间约束”，或让 V4b 对父 `kind!=fetch` 的 callback 回落到严格包含。二者择一即可 |
| N10 | 不变量第 4 条的**前半句**“文件顺序按 `startNs` 非降序”没有任何 V 项断言（V4b 只覆盖包含性） | `event-model.v1.md:144`、`fixtures/README.md:26` vs `s0-plan.md:226-241` | 建议 tester 在 V4b 内加一行 `startNs` 非降序断言（当前 fixture 实测 0/2e6/3e6/6e6/7.5e6/8e6/9e6/1e7/3.9e7 严格递增，加断言零成本） |
| N11 | `dispatch.md` §6 路径归属矩阵的 acceptance 行仍未列 `.gitattributes`（只有派发书 owner 能改），当前授权依据是计划内 D15 + Step 4 | `dispatch.md:196,211` vs `s0-plan.md:408,269-270` | 由 dispatcher 在下一轮分发书批准措辞或在 §6 增补一行；acceptance 必须按 Step 4③ 在 `acceptance.md` 复述“G1 轮次新增授权”，否则追溯到派发书时会缺一环（不影响 G1 冻结） |

### 冻结基线（复评时点 sha256，供 acceptance 复核）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
0820d57f3c2f51b193a0f809cb17b0c9805ff1c06ef3fa6f8e8496b582d9614a  docs/contracts/event-model.v1.md
9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56  docs/contracts/status-semantics.md
2ca028e6225129fc913a922c20be17e161395f8584c17ab7d9a702afef2071e0  docs/contracts/transport.v1.md
88bd185fa1682599282543ff5ca42f85d29752b988e794279ca28a9622baf95c  docs/contracts/api.v1.md
```

（`fixtures/README.md`、`fixtures/case-a-zero-rows/README.md`、`s0-plan.md` 不在 `s0-plan.md:31-37` 的冻结清单内，但同样是 G1 后的只读产物；如需纳入，由 acceptance 自行补算，不改本评审。）

### 交接

1. `schema/**`、`docs/contracts/**`、`fixtures/**` 自本复评起冻结；coder/tester 只读，漂移以 `git diff` + 上述哈希核对。
2. V1（Ajv `strict:true` 编译）仍由 tester 首次运行实证（本机无 ajv，本轮未做 npm install；schema 字节未变，故第 1 轮 C21 的排查结论继续有效）。
3. N3 已登记为 S1 契约变更项；N9/N10/N11 建议在 G2 顺手消化（均不需改 schema）。

### 文件变更声明（本轮）

本轮**仅写入** `docs/plans/stages/S0/plan-review.md`（本文件）一个文件；未修改任何契约、schema、fixture、计划、代码或 git 状态。校验脚本与输出位于仓库外 `C:/Users/13357/AppData/Local/Temp/tb-g1-recheck/`。

---

> **以下为第 1 轮评审记录（2026-11-23，`G1: FAIL`），仅作历史保留；其结论已由上方复评取代。**

## 结论

**G1: FAIL**

- 阻断问题：**1 项**（B1：契约声明的父/子区间不变量被自己的“合规样例”违反，三处文档与 fixture 直接冲突）。
- 非阻断建议：**8 项**（N1–N8，其中 N1 需 dispatcher/acceptance 决策）。
- 其余 21 项检查 PASS；状态枚举、字段覆盖、5 条事实、JSONL 字节规则、端口/`$id`、传输/API 草案、安全与 S0 边界均达标。
- B1 为文档级一行修正，plan-writer 可一轮内闭环（见 B1 的“精确修法”），无需改动 schema。

### 评审方法（可复现）

1. 逐文件人工比对（Read，含 master/SOLO-PLAN 指定行段）。
2. 机器核对：用 Node 解析 `events.jsonl` 9 行，计算 spanId 唯一性、单根树、traceId/rootEventId 一致性、`startNs` 单调、父子区间包含、`expected-facts.json` 每条 `assert.path` 深比较（全部为读操作，未写仓库）。
3. 字节核对：`od`/`tr` 查 BOM、`\r`、行尾换行、空行（`file` 判定为 “New Line Delimited JSON”）。
4. schema 校验：**本机无 ajv**（`require.resolve("ajv")` 失败、`npm ls -g ajv` 为空、无 `tools/verify/node_modules`），**未做 npm install**；改用 OS 临时目录 `C:/Users/13357/AppData/Local/Temp/tb-g1-check/validate.mjs`（自写最小校验器，仅实现该 schema 用到的关键字）验证：9 行全部合法，且负例 `SUCCESS`/`REDACTED`/`LOST`/缺 `reason`/空 `reason`/大写 hex/15 位 spanId/多字段/重复 flag/浮点 `startNs`/负 `durNs`/缺 `flags` 均被拒，`NOT_COLLECTED_* + reason` 与 `parentSpanId:null` 正常通过。**该结果不等于 Ajv `strict:true` 编译通过**，V1 仍由 tester 实证（见 N8）。

## 检查表

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| C1 | 事件 `status` 枚举 == 主计划 §13.4 的 8 值，不多不少 | PASS | `schema/traceboard.event.v1.json:124-133`（OK/RETURNED_FALSE/THREW/NOT_COLLECTED_POLICY/NOT_COLLECTED_LOST/NOT_COLLECTED_NO_DEBUG_INFO/TRUNCATED/UNKNOWN）对照 `00-master-plan.md:1012` 完全一致；`status-semantics.md:33-35` 声明“恰好 8 值” |
| C2 | 2.3 语义全集（10 项）被正确映射；`REDACTED` 落值级、`LOST` 落 `confidence`；无自造状态 | PASS | `status-semantics.md:16-27`（10 行顺序/含义与 `00-master-plan.md:131-142` 逐条对应）、`:31-45`（投影表 + 3 条推论“不得用 status=REDACTED/LOST”）、`:47-57`（§8.3 四值置信度与 `00-master-plan.md:616-621` 一致）；全仓 grep 未发现 SUCCESS/FAILED/ERROR/SKIPPED 等自造状态 |
| C3 | 覆盖 §13.4 全部核心字段（19 个）且含 `reason` | PASS | schema `properties`: schema/type/sessionId/traceId/spanId/parentSpanId/rootEventId/kind/nodeKey/source/thread/startNs/durNs/status/reason/return/values/sideEffects/confidence/flags（`:24-241`，20 键）；对照 `00-master-plan.md:997-1022`；`reason` 为 D4 记录的必要补齐（§13.4 注 `:1025` 要求 `NOT_COLLECTED*` 带 reason） |
| C4 | 每个字段类型明确；required/optional 合理 | PASS | `:8-23` required 14 键（含 `parentSpanId` 可为 null、`flags` 必填）；`source/thread/return/values/sideEffects/reason` 可选，与 13.4 示例与跨端实际相符；`event-model.v1.md:16-37` 类型表逐项一致（`:39` 说明“required 14 键，null 也要出现”） |
| C5 | 顶层 `additionalProperties:false` | PASS | `schema:7`；嵌套对象同样收紧：`:81`（source）、`:97`（thread）、`:150`（return）、`:168`（values[]）、`:203`（sideEffects[]）；负例“多顶层键”被拒（临时校验器） |
| C6 | 所有 `NOT_COLLECTED*` 必有非空 `reason` | PASS | `schema:243-264` if/then（`^NOT_COLLECTED_` → required reason + minLength 1）；实测：缺 reason 被拒、`reason:""` 被拒、`reason:"lost:ingest_disconnected"` 通过；契约解释 `status-semantics.md:71-80`、`event-model.v1.md:136-140,150-155` |
| C7 | id 正则：traceId 32 位小写 hex、spanId/parentSpanId 16 位、sessionId 前缀 | PASS | `schema:35` `^s_[A-Za-z0-9_-]+$`；`:40` `^[0-9a-f]{32}$`；`:45` `^[0-9a-f]{16}$`；`:50` parentSpanId 同正则 + `["string","null"]`（pattern 对 null 不生效，语义正确）；负例大写 hex/15 位 spanId/无前缀 sessionId 均被拒 |
| C8 | 无外部 `$ref`；`$id` 为 URN（离线可校验） | PASS | schema 内 `$ref` 计数为 0（grep）；`$id=urn:traceboard:schema:event:v1`（`:3`）与 `dispatch.md:64` 一致；`$schema` 为 2020-12 标准 URI（`:2`），Ajv2020 内置该元 schema，不需联网；`event-model.v1.md:11` 明示“无网络解析” |
| C9 | fixture 9 行可解析；spanId 唯一；单根因果树（根=点击）；traceId/rootEventId 一致；`startNs` 单调；全 OK/EXACT/DROP_COUNT=0 | PASS | `events.jsonl:1-9`；机器核对：9 行、spanId 唯一、唯一根为 `1000000000000001`（`ui_event #btn-cancel`，`parentSpanId:null`）、全部父节点存在且可达根、traceId 唯一 `4bf92f3577b34da6a3ce929d0e0e4736`、rootEventId 唯一 `click_a1b2c3d4`、startNs =0/2e6/3e6/6e6/7.5e6/8e6/9e6/10e6/39e6 严格递增、status 全 OK、confidence 全 EXACT、每行 flags 含 `DROP_COUNT=0` |
| C10 | `expected-facts.json` 的 5 条事实与 JSONL 逐条相符；eventCount==9 | PASS | 深比较结果：F1 `sql/OrderMapper.cancelById` → `sideEffects.0.rowsAffected`=0 ✓；F2 `mapper/...OrderMapper#cancelById` → `return.value`=0 ✓；F3 `service/...OrderServiceImpl#cancelOrder` → `return.value`=true ✓；F4 `fetch/POST /api/orders/1/cancel` → `return.value`=200 ✓；F5 `callback/OrderDetail.vue#onCancelled` → `return.value`="操作成功" ✓；`expected-facts.json:6` eventCount=9 与 9 行一致；每条 `status` 均为 OK；与 `dispatch.md:128-136` §4.4 五条事实一一对应 |
| C11 | 事件模型声明的时间不变量（子区间⊂父区间）在 fixture 中成立 | **FAIL** | 契约三处声明：`event-model.v1.md:144`“子 span 的 [startNs, startNs+durNs] 落在父 span 区间内”、`fixtures/README.md:44` 同义、`fixtures/case-a-zero-rows/README.md:33`“子 span 区间落在父 span 区间内”。但 `events.jsonl:9`（callback，parent=`…0004`，startNs=39,000,000）父 span `events.jsonl:4`（fetch，startNs=6,000,000，durNs=32,000,000 → 止于 38,000,000）：子 span 起点晚于父结束 1ms。**见 B1** |
| C12 | JSONL 字节规则：UTF-8 无 BOM、一行一对象、末行换行、无空行/CR | PASS | 首 3 字节 `7b 22 73`（无 `ef bb bf`）；`\r` 计数 0；`wc -l`=9；末字节 `0a`；空行计数 0；`file` 判定 “New Line Delimited JSON text data”；`expected-facts.json` 同样无 CR |
| C13 | append-only 规则成文且与 fixture 语义一致 | PASS | `fixtures/README.md:21-29`（无 BOM/紧凑单行/末行换行/只追加/不重排/LF/行数==eventCount）、`transport.v1.md:29`（唯一事实源=append-only）、`dispatch.md:122-126`；`case README:60` 声明 G1 后冻结 |
| C14 | 端口与 schema `$id` 与 `dispatch.md` §3 一致 | PASS | collector 8601 + `127.0.0.1`（`transport.v1.md:11`、`api.v1.md:170`、`s0-plan.md:107`）对照 `dispatch.md:60`；demo 8080（`transport.v1.md:12`、`dispatch.md:61`）；workbench 5173（`transport.v1.md:13`、`dispatch.md:63`）；demo 前端 5174 为 D1 记录且三处一致（`transport.v1.md:14`、`api.v1.md:173`、`s0-plan.md:28`）；`$id` 见 C8 |
| C15 | transport 写明“批量 HTTP ingest + SSE/WebSocket 预留 + 回放只读” | PASS | `transport.v1.md:23-27` 三通路表（A 批量 NDJSON，S0=501；B SSE/WS 预留；C 只读 HTTP 回放）；`:39-84` ingest 目标语义与 S0 501；`:86-111` SSE/WS 明确“S0 不实现、不得出现在 S0 代码”；`:113-121` 回放只读、不重新执行 |
| C16 | API 文档写明 S0 只实现 health/meta + ingest 501，未来端点标 DRAFT/RESERVED | PASS | `api.v1.md:21-36` 唯一权威矩阵（IMPLEMENTED×2 / PLACEHOLDER×1 / RESERVED×7）；`:19` 图例定义；`:38-111` 三个 S0 端点细节（meta 的 `capabilities.ingestEvents/realtime/replay=false`，`:70-94`）；`:113-115` “RESERVED 端点（DRAFT，S0 不得实现）…S0 代码中不得注册” |
| C17 | `s0-plan.md` 可执行：路径归属互斥、命令含引号与 JAVA_HOME 覆盖、证据映射 `dispatch.md` §1、显式 S0 边界 | PASS | 归属矩阵 `s0-plan.md:3`（文件树带 owner 注释）+ `:397-445`（§14.1/§14.2/§14.3 逐角色清单，无交集）；命令 `:266-340`（`JAVA_HOME="C:/Program Files/Java/jdk-21" mvn ...`、`(cd "<中文空格路径>" && ...)`、`:285` demo JDK8 兜底覆盖）；证据 `:342-350` §10 四信号 + 安全对应 `dispatch.md:24-29`；边界 `:367-374` §12 与 `dispatch.md:45-52` 同集；顺序门禁 `:240` 与 `dispatch.md:216-219` 一致 |
| C18 | 偏离项（D1–D14）逐条可接受、不削弱 S0 验收 | PASS（含 2 条备注） | 见“偏离项评估”表；注意实际为 **14 条**（D1–D14），非评审请求中提到的 11 条（D1–D13） |
| C19 | 安全/隐私：无 secret、无真实客户数据、无遥测、无外部 CDN/字体、无第三方镜像、无网络 `$ref` | PASS | fixture 仅含虚构值（`s_demo_s0_case_a`、`SO-0001`、金额 100、相对源码路径）；`fixtures/README.md:80-85` 硬规则（含“公开规范示例值”允许项，`traceId` 即 W3C 示例值）；grep `password/secret/token/bearer/cookie` 在 `schema/`+`fixtures/case-a-zero-rows/` 为 0；grep 外链仅 `json-schema.org`（标准 `$schema`）与 `127.0.0.1`/`localhost`；无 `C:\`/`D:\` 绝对路径；`transport.v1.md:123-128`、`api.v1.md:11` 明示无遥测/无 CDN/只监听回环 |
| C20 | 范围：未把 S1 实现（关联引擎/图 UI/字节码插桩/ingest 持久化）写进契约或计划 | PASS | `transport.v1.md:26-27,88`（B/C 预留且“不得在 S0 代码中出现”）；`api.v1.md:113-115,145`（图/关联“本文不定义规则表”）；`event-model.v1.md:175-184`（v1 不含异常 payload/SQL 文本/关联规则表）；`s0-plan.md:133-161`（collector 仅 3 类、501 不解析不落盘）、`:182`（不引入 Cytoscape）、`:367-374`（S0 硬边界）；agent 仅 noop premain（`s0-plan.md:128-131`） |
| C21 | schema 能端到端校验 fixture（离线） | PASS（方法受限，见说明） | 见“评审方法”第 4 条：自写最小校验器 9/9 通过、13 个负例全部按预期拒绝、2 个正例通过；**Ajv 未安装故未实证 `strict:true` 编译**（strictTypes/strictRequired 风险点已人工排查：`type:["string","null"]` 属“单个非 null 类型”合法、`{}` 空 schema 无关键字、所有 `required` 项均在 `properties` 中定义、`pattern` 均含 `type:string`、正则在 `u` 标志下合法）。V1 由 tester 实证 |
| C22 | plan-writer 产物完整（10 文件）、无越权产物 | PASS | `ls`/`git status`：`schema/traceboard.event.v1.json`、`fixtures/README.md`、`fixtures/case-a-zero-rows/{events.jsonl,expected-facts.json,README.md}`、`docs/contracts/{event-model.v1.md,status-semantics.md,transport.v1.md,api.v1.md}`、`docs/plans/stages/S0/s0-plan.md` = 10 个，无额外文件；未出现 `pom/agent/server/demo/workbench/tools` 等越权路径 |

## 阻断问题（必须修复后才能冻结）

### B1（唯一阻断）契约的“子 span 区间 ⊂ 父 span 区间”不变量与 case A fixture 直接冲突

**事实**

- `fixtures/case-a-zero-rows/events.jsonl:4` — fetch `1000000000000004`：`startNs=6000000`、`durNs=32000000` → 区间 `[6ms, 38ms]`。
- `fixtures/case-a-zero-rows/events.jsonl:9` — callback `1000000000000009`：`startNs=39000000`、`durNs=9000000`、`parentSpanId="1000000000000004"` → 起点 39ms，晚于父 span 结束 1ms。
- 三处权威文本声称该不变量成立：
  - `docs/contracts/event-model.v1.md:144`：“文件顺序按 `startNs` 非降序；子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。”
  - `fixtures/README.md:44`：“子 span 的 `startNs` 落在父 span 的 `[startNs, startNs+durNs]` 区间内。”
  - `fixtures/case-a-zero-rows/README.md:33`：“`startNs` 单调递增，子 span 区间落在父 span 区间内。”
- 同时 `event-model.v1.md:140` 声明不变量“校验工具会检查”，`:197` 又称本 fixture 为“合规样例”。

**危害**：G1 后契约被冻结，tester 若按 §5 实现包含性检查会直接 FAIL；若不实现，则契约含一条自相矛盾且无法被机器验证的规范，后续 S1/S2 采集器照此实现会误标 `NOT_COLLECTED_LOST`/返工。

**根因（供判断修法）**：“响应回调”在语义上必然是父 fetch 结束之后才发生（`00-master-plan.md:596-598` 的关联链正是“HTTP 响应 → 前端响应回调 span”），所以该不变量对 callback 不可满足。fixture 的语义是正确的，**错的是不变量表述**。

**精确修法（任选其一，推荐方案 A；必须三处一致，且不触碰 schema）**

- 方案 A（改文档，保留 fixture）：把三处不变量改为——
  “子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内；**唯一例外**：`kind=callback`（响应回调）允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span（`parentSpanId=null` 的祖先）区间内。”
  并在 `fixtures/case-a-zero-rows/README.md:31-33` 的因果链说明中补一句：“第 9 行 callback 在其父 fetch（第 4 行）结束后启动，仍落在根 span `[0,52ms]` 内”。
- 方案 B（改 fixture，保留不变量）：将 `events.jsonl:9` 的 `parentSpanId` 改为 `"1000000000000001"`（根 `ui_event`，区间 `[0ms,52ms]`），并同步 `fixtures/case-a-zero-rows/README.md:31` 的链描述（“4 → 9”改为“1 → 9”）；`expected-facts.json` 无需改动（F5 只断言 `return.value`）。
- 附加要求（建议同轮完成）：在 `s0-plan.md` §7 V4 增加一项“父子区间包含性”断言（按修正后口径），防止同类缺陷再次漂移进冻结契约。

**验收**：修正后三处文本互相一致，且对 `events.jsonl` 9 行运行包含性检查 0 违规（除方案 A 的 callback 例外）。

## 非阻断建议（不阻止冻结，建议同轮或 G2 处理）

| ID | 事项 | 证据 | 建议 |
|---|---|---|---|
| N1 | **LF 不变量在 git 层面不受保护**：系统级 `core.autocrlf=true`（`file:C:/Program Files/Git/etc/gitconfig`）且仓库无 `.gitattributes`。提交后任何 `git checkout`/重新克隆都会把 `*.jsonl` 还原成 CRLF，直接违反 `fixtures/README.md:23,29` 并使 tester 的 V2（`s0-plan.md:223`“无 `\r`”）失败 | `git config --show-origin --get core.autocrlf` → true；`ls .gitattributes` → 不存在 | **需 dispatcher 决策（卡片缺口）**：`.gitattributes` 不在任何任务卡输出清单内。建议授权 acceptance 在 G2 增加 `.gitattributes`（`*.jsonl text eol=lf`、`*.json text eol=lf`）并写入 `acceptance.md`；或在 `s0-plan.md` §11 风险表补该风险与处置 |
| N2 | `api.v1.md` 附录 A 写“失败分支（非 1 号订单、未知路径）S0 不承诺，保持 Boot 默认 404/500 即可，不写业务错误协议”，但 `s0-plan.md:174`（D13）与 `:414` 要求未知 id 返回 `404 {"data":false}` | `api.v1.md:198` vs `s0-plan.md:174,392` | 二者择一：在 `api.v1.md` 附录 A 增补 `404 {"data":false}` 行（契约仍为 DRAFT，可改），或从计划中删除该分支。当前不一致对 S0 验收不可观测（demo 前端只调 id=1） |
| N3 | schema 的 `return` 对象形态只 required `["type"]`，`value` 可缺省；而 `dispatch.md:94` 与 `event-model.v1.md:103` 均描述为 `{type, value}` | `schema:151` vs `dispatch.md:94`、`event-model.v1.md:103` | 将 `value` 加入 required（推荐，避免“有类型无值”掩盖事实），或在契约中显式写“`value` 可省略=未采集到值” |
| N4 | F1 的 `summary` 写了“SQL UPDATE orders 影响 0 行”，其中表名 `orders` 在 `events.jsonl` 中不存在（v1 只带 `sqlId`），与 `fixtures/README.md:18`“不引入事件里没有的数据”相抵 | `expected-facts.json:23` vs `fixtures/README.md:18` | 改为“SQL OrderMapper.cancelById 影响 0 行，事务 COMMITTED”；或把 summary 明确声明为叙事文案（非事实断言） |
| N5 | D6 的前提不成立：`dispatch.md` §4.1 与 §4.4 并无 “browser main” 示例（主计划 13.4 的 thread 示例是 `http-nio-8080-exec-1`） | `s0-plan.md:385` vs `dispatch.md:78-98`、`00-master-plan.md:1009` | 改写 D6 理由为“统一线程命名风格，浏览器侧用 `browser-main`”；结论无影响（schema `thread.name` 允许空格） |
| N6 | 偏离项实际为 14 条（D1–D14），评审请求提及 11 条（D1–D13）；且 `s0-plan.md:28,205` 引入 5174 而 `dispatch.md:226` 未列该端口（已由 D1 记录，可接受） | `s0-plan.md:378-393` | 更新偏离索引/计数；D1 的端口补充应确保 acceptance 在 `acceptance.md` 复述一次（契约已覆盖） |
| N7 | `dispatch.md:63` 与 `:179` 把同步脚本写作 `scripts/sync-fixtures.mjs`（未限定前缀），计划解析为 `workbench/scripts/sync-fixtures.mjs` | `dispatch.md:63` vs `s0-plan.md:197,431` | 该解析与“workbench 行”上下文一致、也避开根 `scripts/`（归属矩阵未列该路径）；建议补一条 D15 记录该消歧，避免 coder-frontend 在根目录建 `scripts/` 越界 |
| N8 | `s0-plan.md` Step 4 未复述 `dispatch.md:199`⑥ 的“分支 `master` 与计划 `main` 差异写入 `acceptance.md`”；V1 的 Ajv `strict:true` 编译尚未实证（本机无 ajv，仅人工排查） | `s0-plan.md:259-260` vs `dispatch.md:199`；本文件 C21 | Step 4 增一行“记录 master≠main 差异”；tester 首次运行 `tools/verify` 即证 V1，若 Ajv strict 报错按 `s0-plan.md:361` 预案处理（不得放宽为 `strict:false`，应先核对本评审 C21 的排查结论） |

## 偏离项评估（D1–D14）

| ID | 评估 | 理由 |
|---|---|---|
| D1 demo 前端固定 5174 | 接受 | 两 Vite 工程必须错开端口（`dispatch.md:226` 只固定 8601/8080/5173）；已同步写进 `transport.v1.md:14,18`、`api.v1.md:173`、`s0-plan.md:28`，且带 `strictPort`，不削弱验收 |
| D2 status 8 值投影 | 接受 | 与 `dispatch.md:118` 及 `00-master-plan.md:1012` 一致；`REDACTED`→`values[].redacted`、`LOST`→`confidence` 在 `status-semantics.md:31-45` 有完整落点说明 |
| D3 parentSpanId 小写 hex | 接受 | 与 `spanId` 口径统一、属收紧；fixture 全部小写（负例大写被拒） |
| D4 顶层新增可选 `reason` | 接受 | `00-master-plan.md:1025` 要求 `NOT_COLLECTED*` 带 reason，而 13.4 字段清单缺该字段；schema 用 if/then 只在需要时强制，`additionalProperties:false` 未放松 |
| D5 `rootEventId` 收紧为 `^click_[A-Za-z0-9_-]{8,}$` | 接受（备注） | 收紧不弱化；但会成为 S1/S3 前端 SDK 的产生端约束，建议在 S1 契约变更时复核 |
| D6 线程名 `browser-main` | 接受（备注 N5） | 结果无害；仅偏离理由描述失准 |
| D7 不重复 `git init` | 接受 | 与 `dispatch.md:31` 差异说明一致；`.git` 存在、`.gitignore` 覆盖 target/node_modules/dist/logs/work/data/*.log/.env/.traceboard |
| D8 只建 `TraceAgent.java` | 接受 | S0 禁插桩（`dispatch.md:47`），建空包属浪费；不预留空目录合理 |
| D9 不引入 Cytoscape | 接受 | `dispatch.md:63` 是“允许声明”而非要求；S0 不渲染图，减少安装面 |
| D10 case A 定为 9 行 | 接受 | `dispatch.md` 未定行数；9 行覆盖 ui_event→js_method→fetch→controller→service→mapper→sql→callback，`eventCount` 与行数一致 |
| D11 `expected-facts.json` 自定义形状 | 接受 | 形状简单可判定（`fixtures/README.md:57-78` 定义选取规则/路径语法/全局断言），5 条事实均可机器验证（本评审已逐条深比较通过） |
| D12 HTTP 200 落 `fetch.return`，UI 效果落 `callback.return` | 接受 | 与 `dispatch.md:135`“回调/渲染摘要”一致；契约 `event-model.v1.md:105-106` 已写明 |
| D13 demo 未知 id → `404 {"data":false}` | 接受（备注 N2） | 不影响 `dispatch.md:169`④ 的 `data:true` 验收；但与 `api.v1.md:198` 表述冲突，建议对齐 |
| D14 `workbench/.gitignore` | 接受 | `dispatch.md:176` 已授权 coder-frontend 写该文件；根 `.gitignore` 仅 acceptance 可增补 |

**结论：14 条偏离均不削弱 S0 验收口径**（无一条放松 schema 约束、无一条把 S1 能力写成已支持、无一条改 `dispatch.md` §3 的构建/端口决策）。仅 D13 与 API 附录存在表述冲突（N2）、D6 理由失准（N5）。

## 冻结建议与交接

1. 修 B1 后本评审可随即改判 `G1: PASS`（B1 只涉及 `event-model.v1.md`/`fixtures/README.md`/`case-a-zero-rows/README.md` 文本，或 fixture 一行 `parentSpanId`，均属 plan-writer 边界内）。
2. N1 需 dispatcher 决定 `.gitattributes` 归属（唯一可能影响后续复跑的项）；其余 N 项可在 G2 或 S1 契约变更时消化。
3. G1 PASS 后 `schema/**`、`docs/contracts/**`、`fixtures/**` 冻结；coder/tester 一律只读，漂移由 acceptance 用 `git diff` + 冻结哈希（`s0-plan.md:31-37`）核对。
4. 本轮评审未对 schema 提出任何修改要求：`status` 8 值、19 字段、`reason` 条件必填、id 正则、URN `$id`、`additionalProperties:false` 均经正/负例实测符合 `dispatch.md` §4 与主计划 §13.4。

## 文件变更声明

本次评审**仅创建/写入** `docs/plans/stages/S0/plan-review.md` 一个文件；仓库内其余文件全部只读（未修改 `schema/`、`fixtures/`、`docs/contracts/`、`docs/plans/**`、`pom`、代码或 `.gitignore`）。校验用临时脚本与输出位于仓库外的系统临时目录 `C:/Users/13357/AppData/Local/Temp/tb-g1-check/`，未执行 `npm install`，未做任何 git 写操作。