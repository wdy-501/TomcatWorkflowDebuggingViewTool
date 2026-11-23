# S0 基础与契约 · 任务分发书（dispatch）

> 阶段：S0（MVP）｜角色：task-dispatch｜日期：2026-11-23｜版本：v1
> 权威来源：docs/plans/SOLO-PLAN.md、docs/plans/00-master-plan.md §2.3/§8/§9/§13/§15(P0)/§16
> 本文件是 6 个下游子代理的唯一任务输入；除 dispatcher 外任何人不得修改本文件。

## 0. 通用规则（所有人）

1. 一个子代理只执行一张卡：只读「输入」、只写「输出」，其余路径一律只读。
2. 路径含中文与空格，命令/路径必须双引号；统一在仓库根执行。
3. **只有 acceptance 可写 git（add/commit/tag）**；其他人禁止任何 git 写操作与 push。
4. 需要越界、契约缺口、无法达标：停止，并在回复首行写 `BLOCKED: 原因`；不许“顺手改一下”。
5. 不使用 secret/真实客户数据；不换第三方镜像；不自动下载仅 GitHub 提供的资源。
6. 不越到 S1（§2.2）；未做/未验证的标注“骨架/S1 待做”，不写“已支持”。

## 1. S0 目标与验收信号（照抄 SOLO-PLAN §3 的 S0 行）

| 项 | 原文 |
|---|---|
| 主要工作 | `git init`、目录/构建骨架、schema v1 草案、demo 应用骨架、0 行 fixture；不写复杂功能 |
| 验收/完成信号 | **仓库可构建；schema/传输/API 草案可评审；fixture 可读** |
| 建议范围 | MVP |

S0 收尾必须能证明（本阶段口径）：

1. 仓库可构建：根 reactor（JDK21）`package` 绿；demo 后端（JDK8）`package` 绿；workbench `npm run build` 绿。
2. 契约可评审：schema v1（JSON Schema 2020-12）+ 事件/状态/传输/API 四份草案齐全，plan-reviewer 判 PASS。
3. fixture 可读：case A 的 JSONL 逐行过 schema，工作台骨架能读出并展示 §4.4 的 5 条事实。
4. demo 骨架可启动：collector 与 demo 前后端能起能停，彼此不通信（未采集、未关联、无图）。

差异说明：`.git` 已存在（branch `master`、0 commit；`.gitignore` 已含 target/node_modules/dist/logs/work/data/*.log/.env/.traceboard），S0 不重复 `git init`，acceptance 只核对覆盖范围。

## 2. 范围
### 2.1 S0 范围内（6 项交付）

| # | 交付 | 归属 |
|---|---|---|
| 1 | 根 Maven reactor + agent noop 骨架 + collector 骨架 | coder-backend |
| 2 | 事件模型 v1 schema + 4 份契约草案 + case A 0 行 fixture + S0 实施计划 | plan-writer |
| 3 | demo `buggy-shop-boot-vue` 骨架（Boot 2.7.18/JDK8 后端 + Vue3 单页，无缺陷、无采集） | coder-backend（backend）/ coder-frontend（frontend） |
| 4 | workbench AppShell（Vue3+TS+Vite+Pinia，仅外壳 + fixture 事实摘要） | coder-frontend |
| 5 | 独立校验工具与测试报告（schema/fixture/构建/冒烟） | tester |
| 6 | 根 README、进度包、S0 基线提交与 tag | acceptance |

### 2.2 S0 明确不做（越界即失败）

- 任何真实字节码插桩：Transformer/Byte Buddy/ASM/JDBC 探针；agent 仅 noop premain。
- ingest 落库、关联引擎、traceparent/clickId 传播、游离区、SSE/WebSocket 推送实现。
- 工作台图渲染（含 Cytoscape 实际使用）、时间轴、回放、请求切换、节点详情、×N、L2。
- 纯前端案例 B、sourcemap、构建插件（Vite/Webpack/Babel）、浏览器 SDK 事件上报。
- 本地启动器/预览代理/诊断、`server/launcher`、`server/cloud`、Tomcat/WAR、React、云端、MySQL。
- 任何 S1 walking skeleton 内容（一条假事件端到端打通）；S0 的 demo 与 collector 之间不通信。

## 3. 架构与构建决策（强制，不得协商）
| 项 | 决策 |
|---|---|
| 根工程 | `pom.xml`：groupId `io.traceboard`、artifactId `traceboard`、packaging `pom`；modules 仅 `agent`、`server/collector` |
| 构建 JDK | 根工程用 JDK21：`JAVA_HOME="C:/Program Files/Java/jdk-21" mvn ...`；根 pom `maven.compiler.release=21` |
| agent | `agent/` 强制 `<release>8</release>`；MANIFEST `Premain-Class: io.traceboard.agent.TraceAgent`；premain 只打一行日志，无插桩、无 ASM/ByteBuddy 依赖 |
| collector | `server/collector/`：Spring Boot 3.2.x + Java 21，端口 8601；仅 `GET /actuator/health`、`GET /api/v1/meta`、`POST /ingest/v1/events`→501 占位 |
| demo 后端 | `demo/buggy-shop-boot-vue/backend/`：独立 Maven 工程（非 reactor 子模块），Spring Boot 2.7.18 + Java 8，用默认 `JAVA_HOME`（JDK8）构建，端口 8080；内存数据，无 DB/MyBatis |
| demo 前端 | `demo/buggy-shop-boot-vue/frontend/`：独立 Vue3+TS+Vite 单页；proxy `/api`→`http://localhost:8080`；一个按钮 + JSON 展示 + 静态成功提示，无 SDK |
| workbench | `workbench/`：独立 Vue3+TS+Vite+Pinia 工程；允许声明 Cytoscape 但 S0 不渲染图；`public/fixtures/` 由 `scripts/sync-fixtures.mjs` 从 `fixtures/` 复制并 gitignore |
| schema | `schema/traceboard.event.v1.json`：`$schema`=2020-12，`$id`=`urn:traceboard:schema:event:v1`（避免联网解析） |
| fixtures/contracts | `fixtures/` JSONL append-only；`docs/contracts/` 四份：`event-model.v1.md`、`status-semantics.md`、`transport.v1.md`、`api.v1.md` |

构建/校验命令（仓库根，引号必需）：

```bash
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)   # 默认 JDK8
(cd "workbench" && npm ci && npm run build)
(cd "tools/verify" && npm ci && node verify.mjs)
```
## 4. 共享契约（下游一律按此实现；schema 是机器可校验版本）
### 4.1 事件模型 v1 核心字段（主计划 13.4）

| 字段 | 约束 |
|---|---|
| `schema` | const `traceboard.event.v1` |
| `type` | const `span`（S0 唯一值，新增需契约变更） |
| `sessionId` | `s_[A-Za-z0-9_-]+` |
| `traceId` | 32 位小写 hex |
| `spanId` | 16 位小写 hex |
| `parentSpanId` | 16 位 hex 或 null |
| `rootEventId` | 前端根事件 ID（即 clickId，`click_` 前缀）；后端 span 继承 |
| `kind` | `ui_event|js_method|fetch|controller|service|mapper|sql|jdbc|async|callback|render` |
| `nodeKey` | 稳定节点键，如 `com.example...OrderServiceImpl#cancelOrder` |
| `source` | `{file: string\|null, line: int\|null}` |
| `thread` | `{id: int, name: string}` |
| `startNs` | 相对会话起点的单调纳秒，int ≥ 0 |
| `durNs` | int ≥ 0 |
| `status` | 见 §4.2 |
| `return` | `{type, value}` 或 null |
| `values` | `[{name,kind,line,from,to,truncated,redacted,invocation}]` |
| `sideEffects` | `[{type:"sql", sqlId, rowsAffected, transaction}]` |
| `confidence` | `EXACT|INFERRED|LOST|MANUAL` |
| `flags` | `string[]`，如 `L2`、`SAMPLED`、`DROP_COUNT=0` |

- 所有 `NOT_COLLECTED*` 必带 `reason`；`TRUNCATED/REDACTED` 是值级标记（主计划 13.4 注）。
- 顶层 `additionalProperties: false`；v1 草案期加字段须经契约变更 + reviewer 复核，禁止静默漂移。

### 4.2 状态枚举（照抄主计划 2.3）

| 状态 | 含义 |
|---|---|
| `OK` | 方法正常返回（包括 true、数字、对象；返回 0 也是正常返回的事实） |
| `RETURNED_FALSE` | 方法正常返回了布尔 false |
| `THREW` | 方法抛出异常 |
| `NOT_COLLECTED_POLICY` | 被采集策略排除（如第三方包、未开启深度档） |
| `NOT_COLLECTED_LOST` | 事件丢失/关联丢失/采集中断 |
| `NOT_COLLECTED_NO_DEBUG_INFO` | 字节码缺少调试信息，无法给局部变量名/行号 |
| `TRUNCATED` | 值被截断/折叠/采样 |
| `REDACTED` | 字段已脱敏 |
| `UNKNOWN` | 进入方法但没有正常退出（进程结束、超时、崩溃） |
| `LOST`（关联） | 后端有请求但找不到前端根，或前端有请求但没有后端 span |

- 字段级投影：事件 `status` 用主计划 13.4 的 8 值集合（不含 `REDACTED`/`LOST`）；`REDACTED` 落在值级标记，`LOST` 落在 `confidence`。2.3 是语义全集，不可用 schema 投影替代。
- 界面表现以主计划 2.3 为准（绿/琥珀/红/灰虚线/条纹/锁形/问号/游离区），S0 只落契约不落 UI。
- S0 fixture 全部 `OK`：SQL 影响 0 行是“正常返回的事实”，不是错误状态。

### 4.3 JSONL append-only 事件流

- UTF-8 无 BOM；一行一个紧凑 JSON 对象；末行带换行；空行/注释非法。
- 只追加：不修改/删除/重排既有行；读取方按文件行序消费。
- case A：`fixtures/case-a-zero-rows/events.jsonl`；期望事实 `fixtures/case-a-zero-rows/expected-facts.json`。

### 4.4 case A fixture 事实（0 行链，必须能读出这 5 条）

| # | 节点 | 期望 |
|---|---|---|
| 1 | SQL | `OrderMapper.cancelById`，`rowsAffected=0`，`status=OK` |
| 2 | Mapper | 返回 0，`status=OK` |
| 3 | Service | `OrderServiceImpl#cancelOrder` 正常返回 `true`，`status=OK` |
| 4 | HTTP | `POST /api/orders/1/cancel` → 200 |
| 5 | UI | 回调后出现“操作成功”提示（回调/渲染摘要，非像素回放） |

- 无异常事件；`confidence` 全 `EXACT`；`flags` 含 `DROP_COUNT=0`。
- 事实组合（0 行 + 200 + 成功提示）只作摘要展示，不写“这是 bug”。

## 5. 任务卡
### 5.1 plan-writer（契约与 fixture 作者，不写代码）

- 目标：产出可评审的 schema v1、四份契约、case A fixture、S0 实施计划。
- 输入：本文件 §1–§4、docs/plans/README.md、SOLO-PLAN.md、主计划 §2.3/§8.1-8.3/§9.1-9.2/§13.1-13.6/§15(P0)/§16。
- 输出（只写这些）：`schema/traceboard.event.v1.json`、`fixtures/README.md`、`fixtures/case-a-zero-rows/{events.jsonl,expected-facts.json,README.md}`、`docs/contracts/{event-model.v1.md,status-semantics.md,transport.v1.md,api.v1.md}`、`docs/plans/stages/S0/s0-plan.md`。
- 边界：schema/fixtures/contracts 唯一作者；不写 Java/TS/构建文件，不碰 pom、demo、workbench、tools。
- 依赖：无；完成后交 plan-reviewer（G1）。
- 完成判据：10 个文件齐全；fixture 每行符合 schema；契约覆盖 §4.1–§4.4；transport 写明 “ingest 批量 HTTP + 实时 SSE/WebSocket 预留 + 回放只读 HTTP”；api 写明 S0 仅 health/meta + ingest 501 占位；s0-plan.md 含步骤、风险、验收命令。
- 禁止：设计 S1 关联实现（关联规则表/图 patch 只能标“预留”）；`$ref` 指向外网；真实数据；git。

### 5.2 plan-reviewer（只读评审，G1 门）

- 目标：独立评审 plan-writer 产物，裁决能否冻结为编码契约。
- 输入：本文件、plan-writer 全部输出、主计划 §2.3/§8.3/§13.4/§13.6、SOLO-PLAN §3/§4。
- 输出（只写此文件）：`docs/plans/stages/S0/plan-review.md`——逐项 PASS/FAIL 表 + 发现清单（阻断/建议）+ `G1: PASS|FAIL`。
- 边界：其余文件只读；不写代码/schema/fixture/契约。
- 依赖：plan-writer 完成。
- 完成判据：核 5 点——①状态枚举与 2.3 完全一致且字段投影说明正确；②13.4 核心字段无遗漏、类型明确；③fixture 事实链符合 §4.4 且全 OK；④JSONL 规则、端口、schema `$id` 与 §3 一致；⑤无 secret/真实数据/外网依赖。
- 禁止：替作者改文件（只报告）；引入 S1 需求；git。

### 5.3 coder-backend（Java 侧骨架）

- 目标：根 reactor + agent noop + collector 骨架 + demo 后端骨架，全部可构建、可启动。
- 输入：本文件 §3/§4、`docs/contracts/`（只读）、`schema/`（只读）、`docs/plans/stages/S0/s0-plan.md`、G1 PASS。
- 输出（只写这些）：`pom.xml`、`agent/**`、`server/collector/**`、`demo/buggy-shop-boot-vue/backend/**`。
- 边界：不写 `workbench/**`、`demo/buggy-shop-boot-vue/frontend/**`、`fixtures/**`、`schema/**`、`docs/**`、`tools/**`；与前端路径集零交集。
- 依赖：plan-writer 完成且 G1 PASS（契约冻结后才能定字段/路由）。
- 完成判据：①根 reactor 用 JDK21 `package` 绿；②`agent/target/*.jar` 主类 major version=52（记录 `javap` 证据）；③collector 起在 8601，health=UP，meta 返回 schema id/版本，ingest=501；④demo 后端用默认 JDK8 构建，起在 8080，`GET /api/orders`=200，`POST /api/orders/1/cancel` 返回 `data:true`；⑤交付前停止所有进程，端口无残留。
- 禁止：真实插桩、ingest 落库、关联逻辑、launcher/cloud 模块、MySQL、给 demo 用 Boot 3/JDK21、agent 引入 ASM/ByteBuddy、改契约（不符先 `BLOCKED`）、git。

### 5.4 coder-frontend（Vue 侧骨架）

- 目标：workbench AppShell（含 fixture 事实摘要）+ demo 前端单页。
- 输入：本文件 §3/§4、`fixtures/case-a-zero-rows/*`（只读）、`docs/contracts/*`（只读）、G1 PASS。
- 输出（只写这些）：`workbench/**`（含 `workbench/.gitignore` 忽略 `public/fixtures/`）、`demo/buggy-shop-boot-vue/frontend/**`。
- 边界：不写 Java/pom、`server/**`、`agent/**`、demo backend、`fixtures/**`、`schema/**`、`docs/**`、`tools/**`。
- 依赖：fixture/schema 冻结（G1）；不等待后端编码（demo 前端按约定路径 fetch）。
- 完成判据：①`npm ci && npm run build` 成功，TS 严格模式无错，无 CDN/在线字体；②AppShell 三区占位（左侧前端图/右侧请求分图/顶部标题与版本）+ fixture 面板：经 `scripts/sync-fixtures.mjs` 复制后读取 JSONL，展示事件数、每条 type/kind/status 及 §4.4 的 5 条摘要卡；③Pinia 仅空壳 store，无 API/WebSocket/图/时间轴；④demo 前端按钮经 Vite proxy 调取消接口，展示原始 JSON + 静态“操作成功”提示；⑤fixture 副本不入 git。
- 禁止：实现图/回放/请求切换/节点详情（S1+）、调用 collector、重型 E2E 工具、改后端路由、git。

### 5.5 tester（校验与测试报告，不改产品代码）

- 目标：用独立脚本证明 S0 四条验收信号，产出可复跑证据。
- 输入：全部 S0 产物、本文件 §3/§4、`docs/contracts/*`。
- 输出（只写这些）：`tools/verify/**`（`package.json`、`verify.mjs`；node_modules 不提交）、`docs/plans/stages/S0/test-report.md`。
- 边界：产品代码只读；不改 pom/源码/fixture/schema/契约；不得为通过而放宽断言（失败就写 FAIL）。
- 依赖：G1 后可先做 schema/fixture 校验；构建与冒烟待两个 coder 完成。
- 完成判据（`node verify.mjs` 一次跑完，退出码 0/非 0）：①JSONL 每行过 Ajv 2020-12，`expected-facts.json` 与文件事实一致；②反例：注入非法 `status` 的副本必须被 schema 拒绝；③三处构建全绿且记录命令/版本；④冒烟：collector health/meta/501、demo 8080、workbench 产物含 AppShell、fixture 副本哈希一致；⑤agent jar major=52；⑥报告含环境版本、逐项 PASS/FAIL、失败复现命令、进程已停止。
- 禁止：改产品代码/契约、常驻服务、git。

### 5.6 acceptance（唯一 git 写入者，S0 门禁）

- 目标：独立复核全部任务卡，写根 README 与进度包，提交 S0 基线并打 tag。
- 输入：全部产物、6 张卡、`test-report.md`、`plan-review.md`。
- 输出（只写这些）：`README.md`（根，构建/启动/校验命令）、`.gitignore`（只可增补）、`docs/plans/stages/S0/acceptance.md`、`docs/plans/stages/S0/progress.md`。
- 边界：不改任何代码/schema/fixture/契约；不达标退回 owner，不代修。
- 依赖：两个 coder 与 tester 全部完成，G1 PASS。
- 完成判据：①亲自重跑 `tools/verify` 与 §3 四条命令，不信报告；②漂移检查：coder 未改 `schema/**`、`docs/contracts/**`、`fixtures/**`（git diff 证据）；③越界检查：§2.2 清单零出现；④安全：无 secret/真实数据/遥测/外部 CDN，无第三方镜像；⑤progress.md 按 SOLO-PLAN §4 模板（CHECKPOINT/STATUS/EVIDENCE/CHANGED/RISK/NEXT: S1），STATUS 如实；⑥按文件名 `git add`（不用 `-A`）+ commit `chore(S0): baseline` + tag `s0-baseline`；分支为 `master`（与计划中 main 不同，记录进 acceptance.md，不改写历史）。
- 禁止：push/force/rebase、测试未绿打 tag、代改代码、开工 S1。

## 6. 路径归属矩阵（零交集校验用）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `pom.xml`、`agent/`、`server/collector/`、`demo/buggy-shop-boot-vue/backend/` | coder-backend | 只读 |
| `workbench/`、`demo/buggy-shop-boot-vue/frontend/` | coder-frontend | 只读 |
| `schema/`、`fixtures/`、`docs/contracts/`、`docs/plans/stages/S0/s0-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S0/plan-review.md` | plan-reviewer | 只读 |
| `tools/verify/`、`docs/plans/stages/S0/test-report.md` | tester | 只读 |
| `README.md`、`.gitignore`、`docs/plans/stages/S0/{acceptance.md,progress.md}` | acceptance | 只读 |
| `docs/plans/stages/S0/dispatch.md` 及既有 docs/plans | dispatcher | 只读 |

coder-backend ∩ coder-frontend = ∅（前两行无重叠）；跨前缀改动一律视为越界。

## 7. 顺序与门禁

`plan-writer → plan-reviewer(G1) → coder-backend ∥ coder-frontend → tester → acceptance(G2)`
G1 之前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 则上报，不降级放行。

## 8. 环境事实（子代理不得改写）

- Windows 10，Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool` 含中文与空格，命令必须双引号。
- Maven 3.9.5，默认 `JAVA_HOME`=JDK 1.8.0_221（`mvn -v` 实测）；JDK21 在 `C:\Program Files\Java\jdk-21`（21 LTS）；根/collector 构建就地覆盖 `JAVA_HOME`，不全局切换。Node 22.22.2 / npm 10.9.7；Maven Central 与 npm registry 可达。
- git 已初始化：branch `master`、0 commit；无 remote。不使用第三方镜像，不自动下载仅 GitHub 资源（JDK11/17、Tomcat 等在 S0 用不到）。
- 端口：collector 8601、demo 8080、workbench 5173，冲突先诊断记录不静默改；不使用 MySQL/外部 DB；demo 内存数据；无 secret、无真实客户数据、无遥测。

## 9. 风险与停止条件

| 风险 | 缓解 |
|---|---|
| JDK 混用（根 21 / demo 8） | demo pom 锁 1.8 且用默认 JDK8 构建；根构建报 “invalid target release: 21” 说明未覆盖 `JAVA_HOME`，按 §3 重跑，不改 release |
| agent 被编成 21 字节码 | tester 断言 major=52，失败即 FAIL |
| S1 范围蔓延（“顺手”做 ingest/图） | §2.2 硬清单 + acceptance 越界检查；违反即回退 |
| 契约漂移 | G1 后 schema/contracts/fixtures 只读；acceptance diff 检查；变更走契约变更 |
| fixture 与 workbench 副本不一致 | verify 哈希比对；副本 gitignore |
| schema 空转（全放行） | 非法 `status` 反例必须被拒 |
| 中文/空格路径、端口占用 | 全部命令加引号；启动前诊断端口并写入报告 |

停止条件（命中即停，不继续写）：

1. G1 FAIL 且一轮返工后仍 FAIL。
2. 任务卡要求改他人路径或推翻 §3 决策。
3. 验收项必须靠 S1 能力才能满足（说明分发书有误，上报而非扩围）。
4. 测试未绿但 owner 想“先提交再说”。

## 10. S0 出口纪律

- S0 到此为止：不写 S1 代码、不设计关联规则实现、不在 demo 植入 0 行缺陷（S2）、不做工作台图（S1）。
- progress.md 中 `NEXT: S1` 仅是指向，不构成授权；S1 需新的分发书。未验证能力如实标注“骨架/未采集/S1 待做”，严禁写成“已支持”。