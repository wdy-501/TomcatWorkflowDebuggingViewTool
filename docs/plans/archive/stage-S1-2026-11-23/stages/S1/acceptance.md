# S1 验收报告（acceptance / G2 门）

> 验收人：acceptance（唯一 git 写入者）｜日期：2026-11-23｜阶段：S1（walking skeleton）
> 绑定简报：`docs/plans/stages/S1/dispatch.md` §1/§2/§5.6/§6/§9/§11；`s1-plan.md` §9（T0–T13）、§13、§14（D1–D16）、§15；`plan-review.md` 复评（**G1: PASS**）§8 冻结基线；`test-report.md`（35/35 PASS）
> 边界：本文件作者只写 `README.md`、本文件、`progress.md`、`docs/plans/archive/stage-S1-2026-11-23/**` 与 git；未改任何代码/schema/fixture/契约/工具/测试。

---

## 1. 结论

**G2: PASS**

S1 的五条验收信号由 G2 **亲自复跑**证实（不采信报告）：独立校验 35/35 PASS（exit 0）、ingest 202/limits/幂等、sessions/events 只读查询、
Byte Buddy 对 `OrderController#cancel(long)` 的唯一方法插桩（LOST + LOST_BACKEND、distinct traceId、fail-open 3ms）、
workbench 假点击闭环（两次点击 accepted=2、eventCount 2→4、seq 1–4、新 traceId）。G1 冻结的 10 个文件哈希逐字未变，
§2.2 越界清单零实现，无 secret/真实数据/遥测/CDN/第三方镜像。基线已提交并打 tag `s1-baseline`；S1 到此停止。

| 项 | 值 |
|---|---|
| 独立校验 | `(cd "tools/verify" && npm ci && node verify.mjs)` → `checks: 35 PASS / 0 FAIL (total 35)`、`S1 TEST: PASS`、`EXIT_CODE=0` |
| 漂移 | S1 G1 基线 **10/10** 逐字节一致（schema、event-model、api、transport、3 个 S1 fixture、fixture README、s1-plan、dispatch） |
| 越界 | §2.2 零实现（见 §8；命中均为注释/占位/契约布尔/S0 冻结 fixture 展示） |
| 安全 | 0 secret、0 真实数据、0 遥测、0 外部 CDN/字体、0 第三方镜像；collector 仅 `127.0.0.1`；错误信封不回显 body |
| 基线提交 / tag | `feat(S1): walking skeleton — ingest, query, one-method agent span, workbench roundtrip` / `s1-baseline`（哈希见 §13） |
| 归档 | `docs/plans/archive/stage-S1-2026-11-23/`（MANIFEST + SUMMARY） |
| 出口 | **S1 stops here; S2 requires new dispatch.** |

## 2. 独立复跑（STEP 1，不信报告）

### 2.1 环境与预检

| 项 | 实测 |
|---|---|
| OS / Shell | Windows 10.0.29708 x64 / Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，命令均双引号） |
| Node / npm | `v22.22.2` / `10.9.7`（IDE 自述 v24 不影响 PATH 实际版本） |
| Maven / 默认 JDK | `3.9.5` / `1.8.0_221`（`D:\apache-maven-3.9.5-bin\apache-maven-3.9.5`） |
| JDK21 / JDK8 | `C:/Program Files/Java/jdk-21`（21 LTS）/ `C:/Program Files/Java/jdk1.8.0_221` |
| 端口预检 | 8080/8601/5174/4173/4174 空闲；**5173 被遗留 Vite dev server（node pid 50840，orchestrator 截图会话）占用**，G2 已 `taskkill //PID 50840 //T //F`，复检 6 端口全空 |
| Java 进程 | 预检无 `java.exe`；运行结束后仍无 |

### 2.2 校验结果与尾部

```text
--- S1-I cleanup ---
PASS  [S1-I] cleanup: ports free, no java processes, git status limited to expected S1 paths
        ok  port 8601 not LISTENING :: free
        ok  port 8080 not LISTENING :: free
        ok  port 5173 not LISTENING :: free
        ok  port 5174 not LISTENING :: free
        ok  port 4173 not LISTENING :: free
        ok  port 4174 not LISTENING :: free
        ok  no java.exe process left behind by this run :: none (baseline=0)
        ok  no git change under frozen/foreign paths (schema, case-A, demo, S0 docs) :: none
        ok  git status only shows expected S1 product/test paths :: 32 expected entries
        ok  git index untouched (no staged entries) :: all changes untracked/unstaged

--- SUMMARY ---
checks: 35 PASS / 0 FAIL (total 35)
S1 TEST: PASS
EXIT_CODE=0
```

G2 本轮一次全链路执行（`npm ci` + `node verify.mjs`，含四次构建、collector/demo 起停、agent E2E），**35 PASS / 0 FAIL**；
`V8d` 证明运行期间 78 个产品文件 SHA256 全等、无新增、git status 前后一致；`S1-I` 证明端口/进程清理。

> 说明：G2 在写完本报告与归档后又复跑一次，出现 **34 PASS / 1 FAIL**，唯一失败为 `S1-I` 的
> “expected S1 product/test paths” 报 `?? docs/plans/archive/stage-S1-2026-11-23/`——tester 的允许清单
> （`tools/verify/verify.mjs` S1-I `allowed` 数组）只含 `docs/plans/stages/S1/`，不含 acceptance 按分发书 §5.6
> 必须产出的 `docs/plans/archive/**`；属**验收产物与 tester 路径清单的预期差异**，不是产品/契约失败。
> 该目录与 S1 文档已随基线提交入库，提交后工作区干净时复跑为 **35 PASS / 0 FAIL**（记录见 §13）。
> G2 未改 `tools/verify`（禁止项）。

### 2.3 各检查组（G2 实际输出摘要）

| 组 | 证据 |
|---|---|
| V0–V1c / V4b | 环境、case-A 9/9 schema、5 事实、反例、因果区间 0 违规（S0 门禁保留） |
| V2a–V2d | 根 reactor（JDK21）、demo 后端（JDK8）、workbench `npm ci+build`、demo 前端均 exit 0 |
| V3 / V6 / V8 | agent major 52 + Premain-Class；dist 标记/fixture 副本/无外链；0 secret/0 遥测/0 CDN；`.gitattributes` present |
| S1-A | S1 三 fixture 3/3 过 schema；8 facts + 25 项 `globalAssertions` 0 fail；`seq` 负例被拒 |
| S1-B | agent jar：shaded Byte Buddy 2884 classes、未 relocate `net/bytebuddy` 0、无 `dependency-reduced-pom.xml`；collector jar 内 schema 与根 schema **字节相等**且仅 1 份；workbench dist 含按钮/横幅/`no correlation yet`；Vite 代理仅 dev |
| S1-C0–C3 | meta capabilities 恰 5 键；ingest `202 accepted=2`；重发 `dropped=2`；混合批 `accepted=1,rejected=2`（line 2/3）；415/400/413 全中、错误信封 0 回显 |
| S1-D | `{seq,event}` + `nextSeq`；`limit=1/afterSeq=1/afterSeq=2` 分页；`limit=0/501`、`afterSeq=-1/abc`→400；未知 session→404；写动词→405；graph/replay/stream/ws/links→404 |
| S1-E1/E2 | 见 §5、§7 |
| S1-F | workbench 同形批次 → `202 accepted=2`；`eventCount=4`；`seq 1..4`；新 traceId/root 不合并 |
| S1-G | S1 基线 10/10；S0 回归 7 项中 schema/case-A/status-semantics 未变，api/transport/event-model 等于 S1 基线 |
| S1-H | collector 恰 4 条路由；无 DB/关联/SSE/WS/CORS/图/回放；agent 无 service/mapper/SQL 探针；仅官方 registry/Central |
| S1-I | 6 端口无监听、无遗留 java、git 索引未动 |

## 3. 检查清单（dispatch §5.6 / 任务书 STEP 2）

| # | 要求 | 结果 | 证据 |
|---|---|---|---|
| 1 | 亲自重跑 tester 命令与构建，不信报告 | PASS | §2：`npm ci && node verify.mjs` 35/35、exit 0；构建由 V2a–V2d 同轮执行 |
| 2 | 漂移检查：G1 后契约/schema/S1 fixture/s1-plan 哈希不变；产品与 tester 证据一致 | PASS | §6：10/10 哈希逐字相同；S1-B/E/F 同轮重建并复核产物 |
| 3 | 越界检查：§2.2 清单零实现 | PASS | §8 逐词 grep；命中均为注释/占位/契约布尔/S0 fixture 展示 |
| 4 | 安全：无 secret/真实数据/遥测/CDN/镜像；collector 回环；错误不回显 body | PASS | §9 |
| 5 | agent 正确性：唯一方法、LOST/LOST_BACKEND、distinct traceIds、fail-open | PASS | §7（S1-E1/E2 实测） |
| 6 | `.gitattributes` 仍在；jsonl LF；workbench 代理仅 dev；preview 限制有文档 | PASS | §10；`git check-attr` / V8c；`vite.config.ts` 注释 + `workbench/README.md` + 根 README |
| 7 | README 写 S1 状态/real/not-real/精确命令/`-javaagent`/curl/verify/文档指针 | PASS | `README.md`（本检查点重写） |
| 8 | `progress.md` 按 SOLO-PLAN §4 模板 | PASS | `docs/plans/stages/S1/progress.md` |
| 9 | 按文件名 `git add` + commit + tag `s1-baseline`；分支 `master` 记录；不推送 | PASS | §13；暂存排除 `node_modules/target/dist/public/fixtures/work/logs` |
| 10 | S1 到此停止，不对 S2 作承诺 | PASS | §14 |

## 4. ingest / 查询 / 工作台构建（S1 信号 1/2/4/5）

| 项 | 实测（G2 本轮 verify） |
|---|---|
| ingest 202 | fixture 2 行 → `{"accepted":2,"rejected":0,"dropped":0,"errors":[]}` |
| 幂等 | 重发同批 → `{"accepted":0,"rejected":0,"dropped":2}`；eventCount 仍 2、seq 仍 1,2 |
| 逐行拒绝 | 混合批 `accepted=1,rejected=2`，`errors.line=2,3`（invalid_json / schema_violation），message ≤200 且不含原文 |
| 信封 | `415`（text/plain，含超大 body 仍 415）；空 body/空行/1001 行/CRLF/非 UTF-8 → `400`；65KB 行与 >4MB → `413`；统一 `{error,message,apiVersion}`，**0 回显** |
| 查询 | sessions 计数/时间正确；`{seq,event}`、`nextSeq`、`limit=1`、`afterSeq=1/2` 正确；非法参数 400、未知 session 404、写动词 405、保留路由 404 |
| meta | `capabilities={health:true,meta:true,ingestEvents:true,realtime:false,replay:false}` |
| 构建 | 根 reactor / demo 后端 / workbench（`vue-tsc --noEmit` + `vite build`）/ demo 前端全部 exit 0 |
| workbench 路径 | 生成同形 2 条新事件 → 202 accepted=2 → eventCount=4 → 读回 seq 1–4；新批次 trace/root 独立，不与旧批次合并 |

## 5. agent E2E（S1 信号 3）

G2 同轮 verify（`S1-E1`）实测：

```text
[traceboard-agent] premain installed: target=com.example.shop.controller.OrderController#cancel(long),
                   ingestUrl=http://127.0.0.1:8601/ingest/v1/events, sessionId=s_s1agent
[traceboard-agent] transformed com.example.shop.controller.OrderController
s_s1agent unknown before any cancel (404)            # 无合成启动事件
POST /api/orders/1/cancel x2 -> 200 {"data":true}
read back within 15s: events=2 (exactly 2 controller spans)
each span: kind=controller, nodeKey=...OrderController#cancel, status=OK, confidence=LOST,
           parentSpanId=null, rootEventId=click_lost_<spanId>, durNs>0,
           flags=["SKELETON","S1_ONE_METHOD","LOST_BACKEND"]
spanIds: 847a73a4b3759c64, 59f1194ca42aa938（distinct）
traceIds: 37186e01148e1448c3426d7618887685, 13a8b184ab2ee391f4e34b699515253a（distinct）
```

G2 另按 README 的 `-javaagent` 命令手工起停一次（11:43）：`premain installed` + `transformed`，`cancel` 返回 `{"data":true}`，
`s_s1agent` 读回 1 条同形 span（`source.file=OrderController.java`、`source.line=48` 为退出点、`durNs>0`）。

## 6. 浏览器证据（两次点击闭环）

**现有截图** `evidence/workbench-s1.png`（2026-11-23 11:39，orchestrator 采集）G2 已逐项查验：S1 面板、固定横幅
`walking skeleton: fake frontend events; one real backend controller span; no correlation yet`、ingest `accepted=2/rejected=0/dropped=0`、
`eventCount=2`、`nextSeq=2`、事件表 `seq 1 ui_event #btn-s1-fake` / `seq 2 fetch POST /api/orders/1/cancel`、S0 fixture 面板（9 事件/5 fact）保留；
该截图对应**第 1 次点击**。

**G2 现场复跑**（11:41，collector 8601 + `npm run dev` 5173，`http://localhost:5173` 点击 `#btn-s1-fake` 两次）：

| 点击 | ingest | eventCount / nextSeq | 事件表 |
|---|---|---|---|
| 第 1 次 | `accepted=2 rejected=0 dropped=0` | 2 / 2 | seq 1 `ui_event #btn-s1-fake`、seq 2 `fetch POST /api/orders/1/cancel` |
| 第 2 次 | `accepted=2 rejected=0 dropped=0` | **4** / **4** | **seq 1–4**（3 `ui_event`、4 `fetch`，同一新批次） |

- 读回 API 实测 `s_wb_demo eventCount=4`；两次点击的 `traceId` 分别为 `9fa946c8…042a` 与 `613a1d8b…cb5a`，`rootEventId` 分别为
  `click_148599f7…` 与 `click_59712790…`（**fresh traceIds/root，无合并**）；每条 fetch 的 `parentSpanId` 指向同批 ui_event 的 spanId。
- 控制台：21 条 error 全部为 `WebSocket connection to 'ws://localhost:5173/' failed`（Vite HMR 客户端 `/@vite/client`，dev server 的 HMR 通道），
  **无 S1/应用/代理/collector 相关控制台错误**。S1 产品本身无 SSE/WebSocket；该现象不是产品实时能力。
- G2 临时截图仅存 `%TEMP%`，未入库；仓库证据仍为 `evidence/workbench-s1.png`。
- 复跑后已停止 collector 与 workbench dev；6 端口空闲、无 `java.exe`。

## 7. 漂移（G2 独立 `sha256sum`）

| 文件 | G1 基线 | G2 实测 | 判定 |
|---|---|---|---|
| `schema/traceboard.event.v1.json` | `927937df…a489a` | `927937df…a489a` | 未变 |
| `docs/contracts/event-model.v1.md` | `7988d1c4…1fdf7` | 同 | 未变 |
| `docs/contracts/api.v1.md` | `a717e800…6943` | 同 | 未变 |
| `docs/contracts/transport.v1.md` | `cad6224f…3ab8` | 同 | 未变 |
| `fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson` | `6832e9f9…b972` | 同 | 未变 |
| `fixtures/s1-walking-skeleton/agent-controller-span.json` | `13a77e9d…e70c` | 同 | 未变 |
| `fixtures/s1-walking-skeleton/expected-facts.json` | `380a0358…9bf1` | 同 | 未变 |
| `fixtures/s1-walking-skeleton/README.md` | `b7f51b04…839a` | 同 | 未变 |
| `docs/plans/stages/S1/s1-plan.md` | `01c5c75b…e5e4` | 同 | 未变 |
| `docs/plans/stages/S1/dispatch.md` | `da9960fb…2668` | 同 | 未变 |

S0 冻结面：`schema` 仍为 S0 基线 `927937df…`；`fixtures/case-a-zero-rows/{events.jsonl,expected-facts.json}` 仍为
`2eb0b3d9…82ec9` / `8c5bbdbd…b20ea`；`docs/contracts/{api,transport,event-model}` 的变更等于 S1 G1 基线（S1 追加型契约更新，G1 已冻结）。
产品代码/产物：S1-B/E/F 在本轮重建后重新断言通过，未见与 tester 证据不一致的漂移。

## 8. 范围检查（S2 边界，越界即失败）

扫描范围：`agent/src`、`server/collector/src`、`workbench/src`、`workbench/vite.config.ts`、`workbench/package.json`、`pom.xml`、`server/collector/pom.xml`。
词表：`traceparent|correlation|replay|timeline|websocket|eventsource|cytoscape|jdbc|sql|mapper|rowsAffected|rowCount|launcher|mysql|cloud|sse`。

| 命中 | 分类 | 判定 |
|---|---|---|
| `TraceAgent.java:16`、`CollectorApplication.java:11-12`、`workbench/src/main.ts:6`、`stores/app.ts:5`、`stores/s1.ts:19` | 注释明确“不采集/不做” | 非越界 |
| `MetaController.java:37` `boolean replay/realtime` | 契约能力布尔，值 `false` | 非越界 |
| `SessionsController.java:18`、`api.ts:7,277` “query, NOT replay” | 术语澄清 | 非越界 |
| `workbench/src/api.ts:20` `EventSourceLocation` | 事件字段类型名（source 位置），非 `EventSource` 实例化 | 非越界 |
| `App.vue:18`、`S1Panel.vue:130,219` “未采集 service/mapper/SQL / no correlation yet” | 诚实标注 | 非越界 |
| `FixturePanel.vue` / `fixtures.ts` 展示 `service/mapper/sql` 行 | **S0 冻结 fixture 的只读回放数据**，非采集能力 | 非越界 |

结论：无 service/mapper/SQL 探针、无行数/`sideEffects` 采集、无关联/traceparent、无图/时间轴/回放/请求切换/节点详情、
无 SSE/WebSocket/轮询、无 DB/文件持久化、无 launcher/cloud/MySQL；collector 路由恰 4 条（meta、sessions、events、ingest）。

## 9. 安全与卫生

| 项 | 结果 |
|---|---|
| secret（password/secret/token/bearer/cookie/私钥） | 产品源码/配置 0 命中（V8a；唯一命中为 `SpanEmitter` 注释 “No secrets”） |
| 真实数据 | fixture/演示均为虚构（`s_wb_demo`、`s_s1agent`、demo `SO-0001`）；V8 无 email/phone 类数据 |
| 遥测 / CDN / 在线字体 | 0 命中；产物 URL 仅 inert（w3.org 命名空间、vuejs.org 错误文案）与回环 `127.0.0.1:8601` |
| 第三方镜像 | 无 `.npmrc`/`settings.xml`；两个 lockfile 仅 `registry.npmjs.org`；poms 无自定义 repository/mirror |
| 网络 `$ref` | schema `$ref` 计数 0 |
| 回环 | `application.yml`：`port: 8601`、`address: 127.0.0.1`；agent 默认 ingest URL 为 IPv4 回环；无 CORS/鉴权 |
| 错误信封 | `{error,message,apiVersion}`；S1-C3 对所有 400/413/415 断言 message 1..200 且 **0 回显 body**（含 4MB 标记文本） |
| 日志 | agent 仅打印状态码/计数（`dropped=`/`ingest_rejected=`），不回显响应体；collector 不落盘 |

## 10. 运行与换行约束

- 根 `.gitattributes` 仍在：`*.jsonl/*.json/*.md/*.java/*.ts/*.vue eol=lf`；G2 追加 `*.ndjson text eol=lf`——S1 假批次是
  `frontend-fake-batch.ndjson`，原规则未覆盖该后缀，`git add` 时出现 “LF will be replaced by CRLF” 警告（`core.autocrlf=true`），
  若不补将导致下一次 checkout 把 fixture 变成 CRLF 并被 ingest 400；追加后 `git check-attr` 对
  `frontend-fake-batch.ndjson` 为 `text: set` / `eol: lf`，文件 CR=0、末字节 `0x0a`，fixture 字节未变（哈希见表 §7）。
- workbench 代理 `/ingest`、`/api` → `http://127.0.0.1:8601` 仅配置在 `server.proxy`（dev server）；`vite.config.ts` 注释、
  `workbench/README.md` 与根 README 均写明 **preview/静态 dist 无代理**（S1 面板报 collector 不可达）。
- collector 仅 IPv4 回环；浏览器入口统一 `http://localhost:5173`（Vite 可能绑 `[::1]`），README 已区分 `localhost` 与 `127.0.0.1`。

## 11. 偏离与登记事项

D1–D16 与 `s1-plan.md` §14 同集，G2 判定均不削弱验收口径；本阶段新增/需强调：

| 项 | 记录 |
|---|---|
| `nodeKey` | `com.example.shop.controller.OrderController#cancel`（真实源码方法 `cancel(long)`），非 dispatch 的虚构 `#cancelOrder`；D1 已由 G1 明确接受 |
| `source.line` | 48 为方法**退出点**（Advice 退出取栈），不是声明行；声称不可复现，测试只断言 `source.file=OrderController.java` |
| networknt + `urn` | 冻结 schema `$id=urn:traceboard:schema:event:v1` 为多段 URN，networknt 1.0.87 默认 URI 工厂会抛错；collector 为 `urn` 注册最小 `URIFactory`，schema **逐字使用**、未删字段、无第二份 schema，jar 内副本与根 schema SHA256 相等 |
| 默认 session id | 实现默认 `s_s1agent`（`AgentConfig.DEFAULT_SESSION_ID`），而 dispatch/s1-plan 文本写 `s_s1_agent`；README/测试/验收均显式传 `-Dtraceboard.sessionId=s_s1agent`。workbench 面板与 `workbench/README.md` 的说明文字仍写 `s_s1_agent`（纯展示文案，不影响数据路径）；记录为文档口径瑕疵，不阻断 |
| agent span 不展示 | S1 面板只读 `s_wb_demo`，不展示/不关联 `s_s1agent`（transport §4.5.8 / s1-plan §8.2 / R3） |
| preview 代理 | 代理仅 dev server；preview/静态托管无代理（已在三处文档声明） |
| 分支 | 实际 `master`（计划写 `main`）；不改写历史、不重命名 |
| 存储 | 内存 append-only，重启即清空；无 DB/文件/淘汰；`seq` 从 1 连续 |
| `-Dtraceboard.traceId` | 若设置，多次调用会共享同一 traceId（违反游离根“逐 span 独占”）；默认不设置，README 明示仅用于单 span 诊断；S1-E1 断言两次 traceId 互异 |
| D16 丢弃可见性 | 队列满/非 202 只在 stderr 计数（`dropped=`/`ingest_rejected=`），不写 `DROP_COUNT` flag；S1-E2 已捕获 `ingest_rejected=1 status=io_error`，`DROP_COUNT` 留待 S2 契约变更 |
| 校验器变更 | `V5a` 的 S0 `ingest=501` 断言被 S1 `202/400/413/415` 取代、`V7` 单基线改为 `S1-G`（S0 回归 + S1 基线）；两者不可同时成立，非放宽（test-report F-1） |
| 遗留端口 | 开工时 5173 有 orchestrator 截图会话的 Vite dev server（node，非 java），G2 停止后复跑；非产品问题 |

## 12. 清理证明

```text
运行前：8080/8601/5174/4173/4174 空闲；5173 遗留 Vite dev（pid 50840）→ taskkill 后全空；无 java.exe
verify 结束：6 端口无 LISTENING；无 java.exe；git 索引未动（S1-I）
浏览器复跑后：停止 collector(8601) 与 workbench(5173)，6 端口无 LISTENING；无 java.exe
```

## 13. 基线提交与 tag

| 项 | 值 |
|---|---|
| 基线 commit | `feat(S1): walking skeleton — ingest, query, one-method agent span, workbench roundtrip` |
| 基线 commit 哈希 | `（首轮提交后由 G2 追加）` |
| tag | `s1-baseline`（lightweight，指向基线 commit） |
| 后续 commit | `docs(S1): record baseline commit`（仅 `acceptance.md`、`progress.md`；不改历史、不 amend） |
| push / config | 未 push（无 remote）；未 force/rebase；git 身份仅本次 `-c user.name/user.email`，未改 config |
| 暂存 | 按文件名/目录显式 add：`agent server workbench tools docs README.md .gitattributes pom.xml schema fixtures demo .gitignore`（仅存在变更的路径）；已断言不含 `node_modules/target/dist/workbench/public/fixtures/work/logs` |

## 14. S1 出口

- S1 只证明：一条**假前端事件**从点击/请求进入 collector 并被工作台读回 + 一个**真实插桩**的 controller span 被采集读回；二者**无关联**。
- service/mapper/SQL/行数、关联、图、时间轴、回放、请求切换、SSE/WS、持久化均未实现；README/UI 统一标注 walking skeleton。
- **S1 stops here; S2 requires new dispatch.** 本报告与 `s1-baseline` 不构成 S2 授权。
