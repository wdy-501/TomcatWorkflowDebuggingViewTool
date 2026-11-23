# S3 验收报告（acceptance / G2 门）— PASS

> 验收人：acceptance（唯一 git 写入者）｜日期：2026-11-23｜阶段：S3（MVP：前端事实 + 只读回放）
> 绑定简报：`docs/plans/stages/S3/dispatch.md` §1/§2/§5.8/§6/§8/§10/§11；`s3-plan.md`；
> `plan-review.md`（**G1: PASS**，N1–N16）；`test-report.md`（51/51）；契约 `api.v1.md` §2.3/§9、`event-model.v1.md` §12；
> S0–S2 验收格式（`docs/plans/stages/S2/acceptance.md`）。
> 边界：本文件作者只写 `README.md`、`docs/plans/stages/S3/{acceptance.md,progress.md}`、
> `docs/plans/archive/stage-S3-2026-11-23/**` 与 git（add/commit/tag）。
> 未改任何产品代码/schema/fixture/契约/测试。

---

## 1. 结论

**G2: PASS**

G2 亲自复跑唯一门禁 `(cd "tools/verify" && npm ci && node verify.mjs)` 得到 **51 PASS / 0 FAIL（total 51）**、
末行 `S3 TEST: PASS`、`NODE_EXIT=0`（2026-11-23，本轮实测，未采信报告）。S3 的四条硬验收信号——
①案例 B 确认没发、②案例 A 真实 EXACT 关联、③0 行可回放且回放 0 写、④状态语义——全部由运行时/构建产物证据支撑，
且 G1 冻结面 **22/22** 哈希零漂移。

| 项 | 值 |
|---|---|
| 独立校验 | `checks: 51 PASS / 0 FAIL (total 51)`、`S3 TEST: PASS`、`NODE_EXIT=0`（G2 本轮） |
| 冻结面 | S3 G1 **12/12**（schema + 3 契约 + status-semantics + 3 个 S3 fixture + README + s3-plan + dispatch）与 S0–S2 **10/10**，共 **22/22** SHA256 逐字一致 |
| schema | `schema/traceboard.event.v1.json` 字节不变（`927937df…a489a`），仓库内仅 1 份，0 个网络 `$ref` |
| 范围 | 无 S4/S5（无 launcher/IDEA/JAR attach、无 sourcemap/构建插件/L2、无像素回放、无 SSE/WS、无持久化/外部 DB）；工作台依赖仅 `vue`+`pinia`（无图库） |
| 安全 | 0 secret/真实数据/遥测/CDN/第三方镜像；SDK 不采 body/表单值/cookie/查询串/任意返回值；collector 仅 `127.0.0.1:8601`；错误信封 0 回显 |
| 案例 A | 运行时：click+fetch + agent 4 span，`controller.parentSpanId = fetch.spanId`、同 `traceId`/`rootEventId=clickId`、全 `EXACT`、无 `LOST_BACKEND`、0 行事实不变 |
| 案例 B | 运行时/派生：`sdkActive=true`、根 `ui_event` EXACT、`fetchCount=0`、`hasBackend=false`、`RETURNED_FALSE`；工作台逐字显示“已确认：本次点击因果链内没有网络请求” |
| 回放 | 窗口/排序/两次一致/400/404/405/meta 全中；回放前后 18 事件/`nextSeq=18` 逐字不变、订单仍 `CREATED`、0 新事件 |
| 出口 | **S3 accepted；S3 stops here；S4 requires new dispatch.** 本报告与 `s3-baseline` 不构成 S4 授权，也不宣称产品完成 |

## 2. 独立复跑（STEP 1，不信报告）

### 2.1 预检与一次环境性失败（如实披露）

| 项 | 实测 |
|---|---|
| OS / Shell | Windows 10.0.29708 x64 / Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，命令全双引号） |
| Node / npm | PATH 实测 `v22.22.2` / `10.9.7`（IDE 自述 v24 不影响实际 PATH）；`tools/verify` `npm ci` → 0 vulnerabilities |
| 首次复跑（未通过） | 起始工作区存在**上一轮浏览器证据采集遗留的 `npm run dev`（workbench 5173 + demo 前端 5174）与 2 个 `esbuild.exe` 服务**；`V2c-1/V2c-2/V2d-1/V2d-2` 因 `EPERM: unlink ...@esbuild\win32-x64\esbuild.exe`（文件被占用）失败，进而 `S3-1`/`S1-B`/`S2-1` 连带失败 |
| 处置 | G2 依 dispatch §9（冲突/残留先诊断）识别为**环境残留**（非产品缺陷）：终止遗留 vite dev server（PID 41152/14600 及其子进程 50880/27252/23788/32364）与自身首轮 verify 进程，确认无 `java.exe`、6 端口无 LISTENING 后，**原样重跑同一命令** |
| 最终复跑 | **51/51、`S3 TEST: PASS`、exit 0**（本轮最终判定依据；产品代码在两次运行之间零改动，`S3-10` 断言“137 个产品文件稳定”） |

> 该失败不进入 FAIL 判定：根因是**残留 dev server 占用 node_modules 内 esbuild 二进制**，不是 S3 产物、不是断言放宽；
> 清理后同一命令一次通过。README 已加“启动前不得遗留旧 dev server”的提示。

### 2.2 复跑尾部原文（最终轮）

```text
PASS  [S3-7] case B evidence: fixture + collector requests (sdkActive/fetchCount 0/hasBackend false/EXACT) + workbench strings + SDK tests
PASS  [S3-8] scope/security: no S4/S5 (launcher/IDEA/JAR, sourcemap/build plugin/L2, pixel replay, SSE/WS, persistence), SDK no secrets/CDN/PII, loopback, no external $ref
PASS  [S3-9] regression: S2 no-header 4-span LOST + 0-row DB + unknown 404, S1 ingest/query, S0 fixture, S2 panel
PASS  [S3-10] cleanup: ports free, no java leftovers, git index untouched, git status within the S3 whitelist, product files stable

--- SUMMARY ---
checks: 51 PASS / 0 FAIL (total 51)
S3 TEST: PASS
```

`NODE_EXIT=0`；同轮含 SDK `npm ci/build/test`（8/8）、demo 前端构建、workbench 构建、根 JDK21、demo JDK8、agent major 52、
头关联 E2E、requests/graph/replay 深比较、回放 0 写、S0–S2 回归（含显式迁移）、漂移/范围/安全/清理。

## 3. 漂移（G2 独立 `sha256sum`，对照 `plan-review.md` §2 冻结基线）

22 项**逐字一致**（12 项 S3 冻结面 + 10 项 S0–S2 冻结面）：

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
932d290186e968eaa1804757efae4e1b70307371d3e15efd3834cfcc125f31ef  docs/contracts/api.v1.md
73578e05177e89826541740db0e67ec32fa3f52dd11c4cfdcc6e6ef4191c9f8e  docs/contracts/transport.v1.md
06ee878e9d3acc3d6a6ff66ee1e1d95c92ac5813913cc1ad84ae3977216025c0  docs/contracts/event-model.v1.md
9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56  docs/contracts/status-semantics.md
dfea23ef4fb953a28dd018ceaee28d5af462c0f18604081877c89835659cabf1  fixtures/s3-frontend-facts/README.md
f99e57e16e16e9423f2776e0e2f93b27509bb0cf8b2e92bc80bb15f8e8c0f538  fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson
0ba30446bbf7997f2bb3a1b4b2c776438c81f301992390b5e3093fba5128f698  fixtures/s3-frontend-facts/case-a-joined-chain/expected-facts.json
2a73ac5fc5f9eb9ea2acbfc94585d15549ea7a57c5624c24934a13836d26e586  fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson
1667ceeb418d8d836cc719738cceb1b31b73d942041e43744d948d3a6f690759  fixtures/s3-frontend-facts/case-b-frontend-only/expected-facts.json
84a2fdf81735f0bc710f7973314c5867ceb9b0a8bcb4341a7d7d2e77e9e9769c  docs/plans/stages/S3/s3-plan.md
e8a756c05ae5e73c4f2cf97f408ec81985b205aeabd71d188d0d3ae7daa62e14  docs/plans/stages/S3/dispatch.md
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d  fixtures/case-a-zero-rows/README.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
2d1abc0f211979aa4853fa979673ff32d82a3689f958ee965890fb6cec1535fc  fixtures/s2-zero-row-chain/events.ndjson
8869ad79cdedc490bbb4ec5d6738abe9e84c3ced5705a54976abf5527b409a69  fixtures/s2-zero-row-chain/expected-facts.json
c2ab2fc1b99b2bf9476639cccfb0642a6f573574a81e6e5e4e54d997d234585b  fixtures/s2-zero-row-chain/README.md
```

变更路径全部落在 `dispatch.md` §6 允许清单内：`agent/**`、`server/collector/**`、
`demo/buggy-shop-boot-vue/frontend/**`（9 个预期文件）、`frontend/sdk/**`、`workbench/**`、`tools/verify/**`、
`docs/contracts/**`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/**`、`README.md`、归档；
**未触** `schema/**`、S0–S2 fixture、demo 后端、S0–S2 文档、契约的 S2 端点形状。
`S3-10` 独立断言：demo 前端仅 9 个 S3 预期文件变更、`git status` 全在 S3 白名单、验证器未写产品（137 文件稳定）。

## 4. 范围（S3-only）

`S3-8` 本轮 PASS，G2 独立复核：

- **无 S4**：无启动器/IDEA 插件/JAR attach 向导/预览代理注入/CDP/浏览器扩展；无详情抽屉/×N/手工 `/links`/`INFERRED` 时间窗。
- **无 S5**：无构建插件/sourcemap 输出（SDK `dist` 只有 `index.js`+`index.d.ts`，`tsconfig.sourceMap=false`）、
  无源码行号/局部变量/`values[]`/字段 diff；工作台对相关能力只显示“S5 待做/本次未采集”。
- **无实时**：无 `EventSource`/`WebSocket`/`sendBeacon`/`SseEmitter`；`capabilities.realtime=false`；仍手动刷新 + 5s 轮询。
- **无持久化/外部 DB**：collector 纯内存；demo H2 嵌入式；无 JDBC 模板/MySQL 驱动；无文件/缓存/淘汰。
- **无图库**：workbench 依赖仅 `vue@3.5`+`pinia@2.3`（devDeps 只有 vite/vue-tsc/typescript/plugin-vue）；事实树是自绘 DOM。
- **路由/插桩面精确**：collector 恰 7 条路由（S1/S2 六条 + `replay`），`stream/ws/links` 路径不存在；
  agent 仍恰 4 个插桩点，新增仅为 controller advice 内的**请求头反射读取**（无编译期 Spring 依赖）。
- **文案诚实**（dist 实测）：`无构建插件/sourcemap/局部变量`、`非实时（无 SSE/WS）`、`只读：不会重发请求/不写数据库`、
  `本次点击因果链内`、`后端未采集（未关联 controller）`、`JS 内部变量本次未采集（无构建插件/sourcemap）`、
  `S5 待做`、`S0/S1/S2 面板保留在下方折叠区`。

## 5. 安全与卫生

- 0 secret（源码/文档扫描 0 命中真实凭据）、0 真实客户数据（fixture 无邮箱/电话样式数据）、0 遥测、0 外部 CDN/在线字体。
- 依赖源：npm 仅 `registry.npmjs.org`（4 个 lockfile 的 `resolved` 全部为该域，无 `.npmrc`）；Maven 无自定义 repository/mirror。
- 网络面：`application.yml` 实测 `server.port=8601`、`server.address=127.0.0.1`；SDK 只对同源相对路径加头，
  ingest 自身不加头也不产生 fetch 事件；无 CORS/鉴权/429。
- SDK 隐私：源码中无 `document.cookie`、无表单 `.value` 读取、无 `response.text()`、无 `URLSearchParams`/`searchParams`、
  无 body 读取；`nodeKey` 只保留 pathname；`return` 只记录 `false`/HTTP 状态码/`ui_effect` 文本。
- 错误信封：`400/404/405` 均为 `{error,message,apiVersion}`，`message` 1..200 字符且测例逐一断言
  `no request-body echo`（replay 的 5 类坏参数 + graph 缺/非法 traceId）。
- agent 日志只计数（`header_unreadable=<n> reason=<missing|invalid> reason_count=<n>`），**不打印头值**。

## 6. 案例 A 事实（G2 本轮 E2E 实测，`S3-3`）

```text
ingest case-A click+fetch (fixture 前 2 行，仅测试前缀) -> 202 accepted=2
demo seed: id=1 SO-0001 CREATED 100.0（H2）
POST /api/orders/1/cancel  +  traceparent: 00-1f2e…6071-2000000000000002-01  +  X-TraceBoard-Click: click_a1b2c3d4e5f60718
  -> 200 {"data":true}
同 trace 共 6 span（click+fetch + 4 backend），无多余事件
backend 顺序 controller -> service -> mapper -> sql
controller.parentSpanId = 2000000000000002 = fetch.spanId；service/mapper/sql 继承
controller.rootEventId = click_a1b2c3d4e5f60718（真实 clickId，不是 click_lost_）
4 个后端 span confidence=EXACT；controller flags 含 S3_EXACT_LINK；LOST_BACKEND 计数 0
0 行事实不变：controller 200 / service true / mapper 0 / sql rowsAffected=0 transaction=UNKNOWN；THREW=0
requests：EXACT / rootKind=ui_event / #btn-cancel / fetchCount≥1 / hasBackend=true / backendSpanCount=4 / sdkActive=true
graph 边：click>fetch>controller>service>mapper>sql
无头 → 4-span controller LOST 根（click_lost_）；click 非法 → 独立 LOST；全 0 traceparent → 独立 LOST（均不合成 EXACT）
session s_s3demo 结束 18 条 schema 合法事件（6 EXACT + 3×4 LOST），requests = 1 EXACT + 3 LOST
```

## 7. 案例 B 事实（`S3-4`/`S3-7` + 浏览器证据）

- fixture 与派生（确定性）：`sdkActive=true`、根 `ui_event` `#btn-save-b`（flags `SDK_ACTIVE`/`S3_RUNTIME_SDK`/`OBSERVE_MS=1500`、EXACT）、
  `OrderEdit.vue#validateForm` `RETURNED_FALSE`（`return={boolean:false}`）、render `ui_effect:金额必须大于 0`；
  **零 fetch、零后端**；requests 行与 expected **整行 deep-equal**：`status=RETURNED_FALSE`、`confidence=EXACT`、
  `fetchCount=0`、`hasBackend=false`、`backendSpanCount=0`、`spanCount=3`；graph 3 节点/2 边。
- 工作台（dist + 运行）：三文案齐全（`已确认：本次点击因果链内没有网络请求` / `无法确认：前端采集未接入` /
  `前端已发请求但后端未采集（LOST）`），判定条件含 `sdkActive` + 根 `ui_event` + `EXACT` + `fetchCount=0` + `hasBackend=false` + `OBSERVE_MS`；
  `validateForm` 详情只显示控件身份/`false`/DOM 效果文本/`JS 内部变量本次未采集（无构建插件/sourcemap）`。
- **运行时证据（截图）**：`workbench-s3-case-b.png` 显示 `s_s3demo`、请求 2 条（A EXACT/OK、B `RETURNED_FALSE` `fetchCount 0` `hasBackend false`）、
  案例 B 判定条逐字 `已确认：本次点击因果链内没有网络请求`，并列出 `SDK 在线；观察窗 1500ms 已关闭（OBSERVE_MS=1500）；fetch/XHR=0；后端 span=0`；
  树为 `UI_EVENT #btn-save-b → JS_METHOD OrderEdit.vue#validateForm RETURNED_FALSE → RENDER ui_effect:金额必须大于 0`，
  时间轴 `t = 200.19 µs`（总 200.19 µs）、LIVE 模式、常驻只读横幅。

## 8. 回放事实（`S3-4`/`S3-5` + 截图）

- 窗口/排序/逐字：WA1–WA5（1/6/7/5/1 条）+ WB1–WB4（1/2/3/1 条）全部 `200`、`readOnly=true`、`mode="replay"`、
  `fromNs/toNs` 回显、`startNs`+`spanId` 排序、`seq` 原值、`events[].event` 与 fixture 逐字一致；两次相同默认 GET **byte-identical**。
- 0 写（主证据 = 事件集不变）：回放前后 **18 事件 / `nextSeq=18` / 事件页逐字 identical**；回放期间 0 新事件、0 THREW；
  demo 订单 `CREATED` 前后一致（**辅助**证据——案例 A 的 UPDATE 本身命中 0 行，不能单独证明无 SQL 写）。
- 错误面：`fromNs=abc` / `-1` / `toNs` 64 位溢出 / `from>to` / 空白 → `400`（`message` 1..200、无回显）；
  未知会话 `404`；坏参数 + 未知会话按 **400 先于 404**；`POST/PUT` → `405`；`meta.capabilities` 5 键且 `replay=true`/`realtime=false`；
  `stream/ws/links` 仍 `404`。
- 只读实现：`ReplayDeriver`/`ReplayWindow` 读时派生、不消耗 `seq`、不缓存；工作台 `api.ts#fetchReplay` 仅相对 GET，
  S3 面板/store 无 `fetch`/`XMLHttpRequest`/POST、不引用 `/api/orders` 或 `:8080`。
- **截图**：`workbench-s3-replay.png` 显示 REPLAY 模式、`t = 10.00 ms`、`未发生：6 个事件在回放点之后，已隐藏`
  （controller/service/mapper/sql/render/fetch GET），请求行 `GET /replay · fromNs … · toNs … · mode=replay · readOnly=true · 窗口 2 事件`，
  节点标“进行中（未结束）”、常驻 `只读：不会重发请求/不写数据库`。

## 9. 浏览器证据（G2 目视，3 张）

| 截图 | 内容（逐项核对） |
|---|---|
| `docs/plans/stages/S3/evidence/workbench-s3-case-a.png` | 标题 `TraceBoard v0.1.0` + `S3 前端事实与只读回放`；会话 `s_s3demo`；请求 2 条；选中 A：`UL_EVENT #btn-cancel`(OK) → `FETCH POST /api/orders/1/cancel`(200) → CONTROLLER(200) → SERVICE(true) → MAPPER(0) → SQL(`rowsAffected 0`/`UNKNOWN`) → `RENDER ui_effect:操作成功`，全链 **EXACT**、`fetchCount=2 backendSpanCount=4`；判定条 `已关联：前端 fetch → 后端事实链（EXACT），不写“没发请求”`；**额外的 `FETCH GET /api/orders` 标“后端未采集（未关联 controller）”，未并入/未降级整链**；时间轴 35.30 ms |
| `docs/plans/stages/S3/evidence/workbench-s3-case-b.png` | 案例 B 判定逐字 `已确认：本次点击因果链内没有网络请求`（`SDK 在线；观察窗 1500ms 已关闭（OBSERVE_MS=1500）；fetch/XHR=0；后端 span=0`）；`validateForm` `RETURNED_FALSE`（return boolean false）+ `RENDER ui_effect:金额必须大于 0`；请求行 `fetchCount 0 / hasBackend false`；无 fetch 节点 |
| `docs/plans/stages/S3/evidence/workbench-s3-replay.png` | REPLAY 只读窗口 `t=10.00ms` 隐藏 6 个未来事件；`GET /replay … readOnly=true`；节点“进行中（未结束）”；常驻只读横幅 |

案例 A 的 **DB 仍 `CREATED` 与成功 toast** 由 `S3-3`/`S3-5`/`S3-9` 运行时断言与 `S3-10` 收敛证据支撑
（截图为工作台视图，不含 demo 页面；S3 未提供 demo 页面截图，此项以运行时 HTTP 断言为准，如实记录）。

限制：截图为静态证据、仓库内无浏览器 console 日志；G2 未再驱动浏览器（门禁已覆盖运行时关联、派生与产物文案）。

## 10. 偏离与已知限制（记录，不阻断）

1. **dispatch §4.1 时钟被 s3-plan D11 改写**：`startNs` 为**本机 epoch-ns**（SDK `round((timeOrigin+now)*1e6)`；agent 墙钟毫秒 + 单调 nano 差值），
   schema `description` 的 “since session start” 为非规范性注解；schema 字节不变。本报告以 D11 + `event-model.v1.md` §12.10 为准。
2. **`S3_RUNTIME_SDK` 加法 flag**、运行时 controller `S3_EXACT_LINK` 与 S1 遗留 `DROP_COUNT`：均为 advisory 阶段标记；
   fixture flags 仍精确断言，运行时**不得**与之逐字比较。`S3_EXACT_LINK` 只在有合法头时出现。
3. **agent 时钟锚点微偏差**：冷启动首次可能出现 SQL 结束比 Mapper 结束晚 µs 级（`startNs` 锚在上下文进入、`durNs` 从 advice 进入计时）；
   契约允许 ≤1s 同机容差，门禁按“顺序 + 包含”断言；建议 S4 前对齐锚点（非 S3 验收信号）。
4. **观察窗仅运行时在线**：`OBSERVE_MS=1500`（`pagehide` 提前关闭并记录实际毫秒）；窗口外后台请求不采集，
   因此“已确认没发”只覆盖本次点击因果链；工作台对 `OBSERVE_MS<1500` 显示实际毫秒并标“观察窗提前关闭”。
5. **运行时案例 A 多一条刷新 GET**：同一 click 窗口捕获 `GET /api/orders`（未插桩），树上标“后端未采集”，
   `fetchCount=2`、`spanCount=8`；POST↔controller 关联与整链 EXACT 不受影响（契约 §9.2 已写明）。
6. **S2 面板/会话**：同一 demo 进程内默认 `s_s2agent` 可能无数据，工作台对空/未知会话显示 404/无数据提示，不崩；
   S2 无头 4-span LOST 由 `S3-9` 逐字回归。
7. **H2 内存 + collector 内存**：无持久化，重启回 seed/清空；回放前后对比必须在同一 demo 进程内（门禁同进程比对）。
8. **工作台非实时**：手动刷新 + 5s 轮询；时间轴只按 `toNs` 隐藏未来事件，长 span 在“开始但未结束”时标“进行中”，不是服务端播放。
9. **分支/回环**：git 分支实际 `master`（无 remote，未 push）；collector/agent 仅 IPv4 `127.0.0.1`，浏览器入口 `localhost`（Vite 可能绑 `[::1]`），不可混写。
10. **S2 门禁迁移（显式且不放宽其余断言）**：`S1-C0` replay true；`S2-4/4F` replay 404→200 并加 S3 断言；
    `S2-6/8` 升级 S3 口径；`S2-3` 逐字保留；`S2-9` 改为 S3 白名单并拆入 `S3-10`。
11. **环境性阻塞（已解除，非产品缺陷）**：首轮复跑因上一轮遗留的 `npm run dev`+`esbuild.exe` 占用导致 `npm ci` `EPERM unlink`；
    清理后同一命令 51/51。README 已加提示；建议后续阶段在证据采集后立即停 dev server。
12. **pre-existing 文档瑕疵**：部分 S0/S1 历史文档与历史指针存在 EOF 无换行、指针过期等**既有**小问题（G1 前即存在），
    本轮为保护冻结面未修改；记录于此，不影响验收信号。

## 11. 清理证明

```text
G2 预检（清理残留后）：8080/8601/5173/5174/4173/4174 无 LISTENING；无 java.exe；无 esbuild.exe
verify 结束：S3-10 断言 6 端口无监听、无 java 残留、git index 未动、git status 全在 S3 白名单、137 个产品文件稳定
G2 收尾：继续无 java/无监听；提交前工作区仅 S3 产品/测试/契约/fixture/文档 + 本报告/progress/归档
```

## 12. 处置与出口

- 已按 dispatch §5.8 执行：`README.md` 重写为 S3 口径；本报告与 `progress.md` 写为 PASS；
  归档 `docs/plans/archive/stage-S3-2026-11-23/**`；按文件名 `git add` + commit + tag `s3-baseline`；不 push/force/rebase/改 config。
- 未改 schema、S0–S2 fixture、demo 后端、契约 S2 形状、测试断言（未放宽任何门禁）。
- **S3 stops here; S4 requires new dispatch.** 本报告与 `s3-baseline` 不构成 S4 授权；S3 通过不宣称产品完成。

## 13. 基线记录

| 项 | 值 |
|---|---|
| 基线 commit | `feat(S3): frontend facts and read-only replay — SDK, case B, traceparent join, timeline` |
| 基线 commit 哈希 | `（提交后由 G2 追加）` |
| tag | `s3-baseline`（lightweight，指向基线 commit） |
| 后续 commit | `docs(S3): record baseline commit`（仅 `acceptance.md`、`progress.md`；不 amend） |
| 归档 | `docs/plans/archive/stage-S3-2026-11-23/`（提交前快照；MANIFEST 记 SHA256 与恢复方法） |
| 分支 / remote | `master` / 无（未 push） |
