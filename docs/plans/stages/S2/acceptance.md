# S2 验收报告（acceptance / G2 门）— PASS

> 验收人：acceptance（唯一 git 写入者）｜日期：2026-11-23｜阶段：S2（MVP，0 行事实链）
> 绑定简报：`docs/plans/stages/S2/dispatch.md` §1/§2/§5.6/§6/§9/§10；`dispatch-amendment-01.md`（**S2-AMD-01**）；
> `s2-plan.md` D1–D9；`plan-review.md`（**G1: PASS**，N1–N11）；`test-report.md`（42/42；§11 为 S2-AMD-01 复跑）
> 边界：本文件作者只写 `README.md`、本文件、`progress.md`、`docs/plans/archive/stage-S2-2026-11-23/**` 与 git。
> 未改任何产品代码/schema/fixture/契约/工具/测试。
> 本文件**取代** 2026-11-23 12:34 的首轮 G2 FAIL 记录；首轮失败与解除过程保留在 §2（历史留痕，删改无效）。

---

## 1. 结论

**G2: PASS**

G2 亲自复跑唯一门禁 `(cd "tools/verify" && npm ci && node verify.mjs)` 得到 **42 PASS / 0 FAIL（total 42）**、
`S2 TEST: PASS`、`node_exit=0`（2026-11-23 12:39:52–12:40:36），达到 S2 要求的 42/42。
唯一历史阻断项（demo 前端 `App.vue` 页头文案，冻结路径）已由 dispatcher 以 **S2-AMD-01** 正式授权为**单文件文案例外**，
tester 以精确文件白名单 + 文案/模板断言复跑 42/42（test-report §11），G2 复核通过。

| 项 | 值 |
|---|---|
| 独立校验 | `checks: 42 PASS / 0 FAIL (total 42)`、`S2 TEST: PASS`、`node_exit=0`（G2 本轮实测，不信报告） |
| 冻结面 | S2 G1 **9/9** SHA256 逐字一致；S0/S1 冻结 fixture **7/7** 字节未变；schema 字节不变、仅 1 份 |
| 修订合规 | 仅 `demo/.../frontend/src/App.vue` 一个文件（5+/2-，`<template>` 页头文本）；精确文件白名单、目录仍冻结；无 SDK/行为变化 |
| 范围 | 无 S3（无 SDK/traceparent/clickId/关联/回放/时间轴/SSE/WS/图库）；collector 无持久化；文案诚实 |
| 安全 | 0 secret/真实数据/遥测/CDN/第三方镜像；H2 仅嵌入式；collector 仅 `127.0.0.1:8601`；错误信封 0 回显 |
| 案例 A | 真实运行时 0 行（H2/MyBatis）；`200 {"data":true}` + 列表仍 `CREATED`；未知 id `404`；4-span 链/requests/graph 全中 |
| 基线提交 / tag | 见 §13（commit `feat(S2): zero-row fact chain — H2 defect, 4-span agent, requests/graph, request switching` + tag `s2-baseline`） |
| 归档 | `docs/plans/archive/stage-S2-2026-11-23/`（MANIFEST + SUMMARY，复制不移动） |
| 出口 | **S2 accepted；S2 stops here；S3 requires new dispatch.** 本报告与 `s2-baseline` 不构成 S3 授权，也不宣称产品完成。 |

## 2. 修订历史（首轮 G2 FAIL → S2-AMD-01 → tester 42/42 → G2 PASS）

| 时间（2026-11-23） | 事件 | 证据 |
|---|---|---|
| 12:28:46 / 12:29:38 | tester 末轮 `verify.mjs` / `test-report.md`（当时的 42/42） | `test-report.md` 首轮章节 |
| 12:30:51 | demo 前端 `App.vue` 页头文案被修改（**晚于 tester 冻结**） | 首轮 G2 §3 diff |
| 12:31 | orchestrator 采集 `evidence/{workbench-s2,demo-s2}.png` | 截图 |
| 12:34 | **首轮 G2: FAIL（41/42）**：唯一阻断 B1——`S2-9` 将 demo 前端列为冻结路径，而工作区存在 `M demo/.../frontend/src/App.vue`；该修改违反 `dispatch.md` §2.2/§4.1/§6 | 首轮 `acceptance.md`（已由本文件取代；§2/§3 记录保留于 git 历史） |
| 12:35 | dispatcher 发布 **S2-AMD-01**：授权该单文件文案修改；`S2-9` 精确文件例外 + 文案断言；要求 tester 重跑 42/42 | `dispatch-amendment-01.md`（SHA256 `3816c166…b6928`） |
| 12:37–12:38 | tester 按 S2-AMD-01 改 `verify.mjs`（仅 `S2-9` 精确白名单 + 5 条断言），第 6 轮复跑 **42/42、exit 0** | `test-report.md` §11 |
| 12:39:52–12:40:36 | **G2 复跑同一门禁：42/42、`S2 TEST: PASS`、`node_exit=0`** → 本 PASS 报告 | §3/§4 |

- 首轮 FAIL 的唯一原因是**流程/冻结面**（未授权路径被改 + tester 未验证），不是产品事实错误；产品主体 41 项首轮即全 PASS。
- S2-AMD-01 例外**仅覆盖 `App.vue` 页头文本**：目录前缀仍在 `forbidden`，白名单按文件全等匹配；**不得作为后续先例**
  （改 `App.vue` 其它内容或任何其它 demo 前端文件须另发修订）。
- 首轮 FAIL 的处置选项 1（回退文案）未被采用；采用选项 2（正式修订），故本报告以修订后门禁为准。

## 3. 独立复跑（STEP 1，不信报告）

### 3.1 环境与预检

| 项 | 实测 |
|---|---|
| OS / Shell | Windows 10.0.29708 x64 / Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，命令均双引号） |
| Node / npm | 验证器 V0 实测 `node=v22.22.2 npm=10.9.7`（IDE 自述 v24 不影响 PATH 实际版本）；`npm ci` 0 vulnerabilities |
| Maven / 默认 JDK | `3.9.5`；默认 `JAVA_HOME`=JDK `1.8.0_221` |
| JDK21 / JDK8 | `C:/Program Files/Java/jdk-21` / `C:/Program Files/Java/jdk1.8.0_221` |
| 端口预检 | **8080/8601/5173/5174/4173/4174 全空闲**（netstat 无 LISTENING）；无 `java.exe` |
| 起始 git | 分支 `master`；41 条变更（S2 产品/测试/契约/fixture/文档 + S2-AMD-01 单文件）；索引无暂存项；无 remote |
| 执行窗口 | verify 启动 12:39:52，结束 12:40:36（含四次构建、E2E、fail-open、范围/安全/漂移） |

### 3.2 复跑结果（尾部原文）

```text
(cd "tools/verify" && npm ci && node verify.mjs)
PASS  [S2-4F] requests/graph over the deterministic S2 fixture (shape, edges, determinism, 400/404/405)
PASS  [S2-3] agent E2E: each cancel -> exactly 4 spans (controller->service->mapper->sql), LOST/OK/0 rows, second call independent
PASS  [S2-4] requests/graph over the runtime 4-span chain + 400/404/405 + S1 sessions/events regression
PASS  [S2-2] demo H2/MyBatis 0-row defect: 200 true + STILL CREATED + unknown 404
PASS  [S2-3b] unknown id 999 chain (coverage limit: 0 or 2 spans, never a faked mapper/sql)
PASS  [S2-5] fail-open: collector stopped, cancel still 200 fast, demo alive, stderr ingest_rejected
...
PASS  [S2-8] scope/security: 6 routes + 4 agent points exactly, no S3/SDK/persistence/stream, H2 embedded only, no secrets/mirrors
PASS  [S2-9] cleanup: ports free, no java processes, git untouched, no product writes by verify
        ok  S2-AMD-01: only the exact file demo frontend src/App.vue is allowlisted (directory prefix stays forbidden) :: exact=demo/buggy-shop-boot-vue/frontend/src/App.vue; prefix demo/buggy-shop-boot-vue/frontend/ excluded from allowed
        ok  demo frontend: no file besides src/App.vue is changed/frozen (S2-AMD-01 scope) :: changed=[demo/buggy-shop-boot-vue/frontend/src/App.vue] others=0
        ok  S2-AMD-01 copy: case-A banner present, stale S0 “无缺陷/无采集/S0 demo 骨架” copy absent (demo frontend src + dist) :: source banner ok; dist banner ok (3 files); stale copy absent
        ok  App.vue diff is text/template only (script/fetch/button/toast/SDK unchanged; no element/attribute edits) :: script+style byte-identical to HEAD; 60 template tags identical; text nodes only
        ok  demo frontend still calls no SDK/collector (every fetch targets /api via the Vite proxy) :: 2 fetch calls, targets: /api/orders, /api/orders/1/cancel

--- SUMMARY ---
checks: 42 PASS / 0 FAIL (total 42)
S2 TEST: PASS
```

`npm ci` 与 `node verify.mjs` 均 exit 0；V2a/V2b/V2c-1/V2c-2/V2d-1/V2d-2 构建 `exit 0`。42 项完整清单见
`test-report.md` §2/§11 与本轮同构日志（S0/S1 回归、S2-1..S2-9、S2-4F、V0/V1/V1b/V1c/V2*/V3/V4b/V6*/V8*）。

## 4. 修订合规（S2-AMD-01）

| 项 | 实测 |
|---|---|
| 变更范围 | `git status --short -- demo/buggy-shop-boot-vue/frontend/` 仅 ` M .../src/App.vue`；该前缀下其它文件 0 变更 |
| diff 形状 | `1 file changed, 5 insertions(+), 2 deletions(-)`；全部在 `<template>` 页头 `<h1>` + `.subtitle` |
| 文本内容 | `BuggyShop · 取消订单（案例 A）`；副标题“S2 demo · 案例 A 故意缺陷：取消返回成功，但数据库 UPDATE 0 行；订单仍为 CREATED。后端由 Java agent 采集；前端无 SDK。接口经 Vite proxy `/api` 转发到 8080” |
| 无行为变化 | `<script setup>` 与样式区段逐字节等于 `HEAD:`；60 个模板元素/属性标记与 HEAD 全等；`fetch("/api/orders")` 与 `fetch("/api/orders/1/cancel",{method:"POST"})` 未变；无按钮/toast/确认框增删 |
| 无 SDK | 每次 `fetch` 仅指向 `/api`（2 处）；无 `/ingest`、`:8601`、`traceboard`/`traceparent`/`clickId`、EventSource/WebSocket/sendBeacon |
| 白名单 | `S2-9` 仅对精确路径 `demo/buggy-shop-boot-vue/frontend/src/App.vue` 豁免；目录前缀仍在 `forbidden`，**不可扩大** |
| 授权链 | `dispatch-amendment-01.md`（S2-AMD-01，生效）+ `test-report.md` §11（tester 复跑 42/42）+ 本报告（G2 复核） |

## 5. 漂移（G2 独立 `sha256sum`）

S2 G1 冻结面 9/9 与 `plan-review.md` §2 基线**逐字一致**：

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
0bf3d28f3e6ee97339c62df6e87dcebb664e7e710b8e3a32007c8ce2fe382607  docs/contracts/api.v1.md
228ffa962ce47bf77dd5360f654aedc50b4dd113891eff39c47a6400023dae2d  docs/contracts/event-model.v1.md
cf7c0475b8da9c066d3f99408354f0b619e0aa7161fe740af1f630d7c43b59c1  docs/contracts/transport.v1.md
2d1abc0f211979aa4853fa979673ff32d82a3689f958ee965890fb6cec1535fc  fixtures/s2-zero-row-chain/events.ndjson
8869ad79cdedc490bbb4ec5d6738abe9e84c3ced5705a54976abf5527b409a69  fixtures/s2-zero-row-chain/expected-facts.json
c2ab2fc1b99b2bf9476639cccfb0642a6f573574a81e6e5e4e54d997d234585b  fixtures/s2-zero-row-chain/README.md
65f24eb2b15013060cb56bae05c22207d21b31bb558b0ac7a0dc6f8a5e7021bc  docs/plans/stages/S2/s2-plan.md
bf602001ce0bf87bde93a8cc695e32a9edffc68b8612d03d1364cc13ffc51adc  docs/plans/stages/S2/dispatch.md
```

S0/S1 冻结面 7/7 未变：

```text
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d  fixtures/case-a-zero-rows/README.md
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
```

schema 字节不变、仓库内仅 1 份 schema；S2 fixture 4 行、LF、无 BOM、末字节 `0x0a`（S2-7 PASS）。
冻结面之外唯一产品变更是 `demo/.../frontend/src/App.vue`，已由 S2-AMD-01 授权（§4）；其余变更均属 `dispatch` §6 允许路径。

## 6. 范围（S2-only）

`S2-8` 本轮 PASS，逐项：

- 无 S3：无浏览器 SDK/`traceparent`/clickId/关联引擎/前端事件；无 replay/timeline/回放按钮/虚拟时钟；无 `links`；
  无 SSE/WebSocket/EventSource；无 `values`/字段 diff/异常 payload；collector 无 DB/文件/缓存/淘汰；无 launcher/cloud/Tomcat/MySQL。
- 路由/插桩面精确：collector 恰 6 条路由（`requests`/`graph` 已实现，`replay/stream/ws/links` 不存在）；
  agent 恰 4 个插桩类型/advice（Controller/Service/MapperProxy/PreparedStatementHandler）；
  Mapper 过滤只命中 `OrderMapper#cancelById`，SQL 过滤只命中 cancel mapped statement，`countById` 从未插桩。
- 无图库/canvas/时间轴组件：workbench 依赖仅 `vue`+`pinia`，dist 无 canvas 图/回放面板。
- 持久化：none（collector 内存 append-only；demo H2 内存；无文件/DB 落盘）。
- 文案诚实（dist 实测）：`事实摘要，不是缺陷结论`、`游离后端请求（无前端根）`、`每 5 秒刷新（非实时）`、
  `0 行事实链`、`未采集`；S1 假面板折叠并标注“假数据，非 S2 事实链”；S0 `FixturePanel` 保留。
- `S2-6` 断言 `#s2-panel/#s2-session/#s2-refresh/#s2-requests/#s2-chain` 存在、默认 `s_s2agent`、无 SSE/WS、代理仍 `/api`→`127.0.0.1:8601`。

## 7. 安全与卫生

本轮 `V8a–V8d`/`S2-8` PASS：

- 0 secret（源码扫描 0 命中）、0 真实客户数据（fixture 无邮箱/电话样数据）、0 遥测、0 外部 CDN/字体；
  构建产物无外链资源（5 个 URL 均 inert/loopback，如 `vuejs.org` 错误参考文档串）。
- 依赖源：npm 仅 `registry.npmjs.org`（无 `.npmrc` 镜像）；pom 无自定义 repository/mirror（Maven Central 默认）。
- 网络面：collector 仅 `127.0.0.1:8601`；agent ingest 默认回环；无 CORS/鉴权/429；H2 仅嵌入式（fat jar 内 `h2-2.1.214.jar`，0 MySQL 驱动）。
- 错误信封：400/404/405 均为 `{error,message,apiVersion}`，message 1..200 字符且**0 回显**请求体/参数
  （`graph` 缺/非法 traceId、未知 session/trace 均实测 `no request-body echo`）。
- agent 失败仅 stderr 计数（`dropped=`/`ingest_rejected=`），不回显响应体；无 SQL 文本/参数采集。

## 8. 案例 A 事实（G2 本轮 E2E 实测）

| 事实 | 实测证据 |
|---|---|
| seed 来自 H2 | `GET /api/orders` → `{"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.0}]}` |
| 真实 0 行 | cancel 执行 `UPDATE ... AND status='PAID'`；`rowsAffected=0`；随后列表**仍 CREATED** |
| 成功与 0 行并存 | `POST /api/orders/1/cancel` → `200 {"data":true}`；Service 忽略行数仍 `true` |
| 未知 id | `POST /api/orders/999/cancel` → `404 {"data":false}`；无 mapper/SQL span（2-span 链：Controller 404 + Service `RETURNED_FALSE`） |
| 4-span 链 | 每次 cancel 恰好 4 span：`controller(LOST root,200) -> service(true) -> mapper(0) -> sql(rows 0/UNKNOWN)`，全 `OK`、嵌套、同 trace/root、`durNs>0`、flags `S2_ZERO_ROW_CHAIN`、根 `LOST_BACKEND` |
| 请求隔离 | 第二次 cancel 独立 `traceId`/root；requests 2 组按 `startedAtNs` 升序 |
| requests | `spanCount=4`、`rootKind=controller`、`status=OK`、`confidence=LOST`、无 error；未知 session 404、写动词 405 |
| graph | 4 节点/3 边、`startNs` 排序、`return`/`sideEffects` 原样；两次 GET 一致且事件/`seq` 不变（8→8） |
| 异常 | `THREW=0`（`noExceptions` 断言）；0 行不被标为错误 |
| 真实性 | 0 行是运行时 H2/MyBatis 事实：fat jar 内嵌 H2、无 MySQL；fixture 只用于确定性测试 |

## 9. 浏览器证据（G2 目视）

两张截图均存在（2026-11-23 12:31，orchestrator 采集），G2 已逐张查看：

| 截图 | 内容 |
|---|---|
| `evidence/demo-s2.png` | 页头 `BuggyShop · 取消订单（案例 A）`；副标题“S2 demo · 案例 A 故意缺陷：取消返回成功，但数据库 UPDATE 0 行；订单仍为 CREATED。后端由 Java agent 采集；前端无 SDK”（即 S2-AMD-01 授权文案，**与运行时事实一致**）；订单 1 `SO-0001` `CREATED` `100`；原始响应 `{"data":true}`；“操作成功”——成功提示与 0 行并存 |
| `evidence/workbench-s2.png` | 标题 `TraceBoard v0.1.0` `S2 0行事实链`；会话 `s_s2agent`；请求列表 2 条（traceId `7d76d4b0…`/`d0b25a4f…` 互异），第 2 条选中切换；事实条 `Controller HTTP 200`、`Service 返回 true`、`Mapper 返回 0`、`SQL 影响 0 行`、`异常（THREW） 0`；常驻“事实摘要，不是缺陷结论”；`4 节点 / 3 边 / 1.06 ms`；`游离后端请求（无前端根）· confidence LOST · rootEventId click_lost_be5d0a4e0d51a59`；CONTROLLER/SERVICE/MAPPER/SQL 四节点（Controller `ResponseEntity`=200、Service `boolean`=true、Mapper `int`=0、SQL `rowsAffected`=0/`UNKNOWN`，SQL return 显示“未采集”）；S1 假面板折叠、S0 Fixture 面板保留 |

限制：截图为静态证据，仓库内无浏览器 console 日志；G2 未再驱动浏览器（门禁已覆盖运行时事实与构建产物文案）。
`V6d`/`S2-6`/`S2-8` 已证明产物无外链、无 SSE/WS、无图库/S3。

## 10. 已知限制（记录，不阻断）

1. `countById`（存在性检查）**不插桩**：未知 id 链为 0 或 2 span（Controller 404 + Service `RETURNED_FALSE`），无 mapper/sql，不伪造（S2-3b）。
2. `EventSender` 容量 16、单守护线程、1 次尝试；突发丢弃/非 202 仅 stderr 计数（`dropped=`/`ingest_rejected=`）。
   运行时 flags 含 S1 遗留 `DROP_COUNT=<n>`，**不与 fixture 逐字比较**；fixture 仍精确断言 flags。
3. 工作台仅手动刷新 + **5 秒轮询（非实时）**，无 SSE/WS；无时间轴/回放。
4. **无前端 SDK/关联**：4-span 是 `confidence=LOST` 的游离后端请求（无前端根），不画点击链；前端关联/回放属 S3。
5. H2 内存库（`DB_CLOSE_DELAY=-1`）与 collector 内存 append-only 均**无持久化**，重启即回到 seed/清空。
6. git 分支实际 `master`（计划写 `main`），无 remote；仅 acceptance 写 git；无 secret/真实客户数据。
7. 回环口径：collector/agent 仅 `127.0.0.1`；浏览器入口用 `localhost`（Vite 可能绑 `[::1]`），两者不可混写。
8. demo 前端 `src/main.ts`、`src/style.css`、`package.json` 的 description 仍含 S0 文案（source-only，页面不展示）；
   页头/横幅已按 S2-AMD-01 修正（纯文案，无 SDK/行为）；**不得作为后续先例**。
9. S2 G1 非阻断文档瑕疵 N1/N2/N5/N9/N10/N11（api S0 历史指针、D4 引用失实、graph 加法字段未列入偏离、H2 保留字笔误、
   fixture SQL `source` 为示例、s2-plan §3 哈希清单漏 dispatch）仍开放；N3/N4/N6/N7/N8 已在 tester/实现说明中落实（test-report §6）。
10. S2 通过仅证明“真实 0 行 + 4-span 后端链 + 只读请求/图 + 工作台事实板”；不得宣称产品完成或已支持 S3 能力。

## 11. 清理证明

```text
G2 预检（12:39）：8080/8601/5173/5174/4173/4174 无 LISTENING；无 java.exe
verify 结束（12:40）：S2-9 六端口无 LISTENING、无遗留 java（baseline=0）、git 索引无暂存项、
                      git status 仅 41 条预期 S2 条目、99 个产品文件稳定、验证器未写产品
G2 收尾：继续无 java.exe；提交前工作区仅 S2 产品/测试/契约/fixture/文档 + 本报告/progress/归档（§13）
```

## 12. 处置与出口

- 已按 dispatch §5.6/§7 执行：`README.md` 重写为 S2 口径；本报告与 `progress.md` 写为 PASS；
  归档 `docs/plans/archive/stage-S2-2026-11-23/**`；按文件名 `git add` + commit + tag `s2-baseline`；不 push/force/rebase/改 config。
- **冻结路径例外 = S2-AMD-01（单文件文案）**：仅 `demo/.../frontend/src/App.vue` 的页头文本；目录前缀仍冻结，不得类推。
- **S2 stops here; S3 requires new dispatch.** 本报告与 `s2-baseline` 不构成 S3 授权；S2 通过不宣称产品完成。

## 13. 基线记录

| 项 | 值 |
|---|---|
| 基线 commit | `feat(S2): zero-row fact chain — H2 defect, 4-span agent, requests/graph, request switching` |
| 基线 commit 哈希 | `eff152f3c1009d60f0aa33e9ac6c384ede5862ee`（`s2-baseline` 指向同一 commit） |
| tag | `s2-baseline`（lightweight，指向基线 commit） |
| 后续 commit | `docs(S2): record baseline commit`（仅 `acceptance.md`、`progress.md`；不改历史、不 amend） |
| 归档 | `docs/plans/archive/stage-S2-2026-11-23/`（提交前快照；MANIFEST 记 SHA256 与恢复方法） |
| 分支 / remote | `master` / 无（未 push） |
