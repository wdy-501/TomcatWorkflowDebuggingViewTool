# S7 计划评审（plan-review.md）

> 角色：PLAN-REVIEWER（G1，只读）｜阶段：S7（React18 + Webpack5 本地基础第二栈）｜日期：2026-11-24｜版本：v1
> 输入：`docs/plans/stages/S7/dispatch.md`、`docs/plans/stages/S7/s7-plan.md`、`docs/contracts/api.v1.md`（§2.8/附录 H 及 §1–§10、附录 A–G 历史段）、`docs/plans/SOLO-PLAN.md` S7、`docs/plans/00-master-plan.md` §7.3/§14.2、`frontend/sdk/src/index.ts` + 已构建 `dist/index.js`、`demo/buggy-shop-boot-vue/backend`（OrderController/OrderService/OrderMapper/data.sql）、`demo/buggy-shop-boot-vue/frontend/src/{App.vue,traceboard.ts}`、`agent/src/**`（TraceAgent/MapperAdvice/SpanContext/AgentConfig）、`server/collector/.../TraceDeriver.java`、`workbench/src/components/{S3Panel,S4DetailPanel}.vue` + `stores/s3.ts`、`tools/verify/verify.mjs`、`fixtures/s3-frontend-facts/**`、`fixtures/s6*`。
> 只读声明：本文件只评审，不改计划/契约/fixture/代码，不做任何 git 写；G1 后按 dispatch §8 冻结。
> **最终结论：G1: PASS**（Blocking **0**；非阻断建议 R1–R8，均不改变范围/契约：R1/R3/R5/R6/R8 属计划文本精度，R2/R4/R7 属门禁/验收口径，由 tester/acceptance 落地，不得放宽既有门禁）。

## 1. 结论摘要

- dispatch §5.2（74–79）八项核查 **8/8 PASS**；coder 可行性（Webpack5 + Babel React18、`file:` SDK ESM、lockfile、无 TS、5175 strictPort、`devtool:false`、逐字选择器/文案、B 非数字分支、无 `.map`/manifest、无绝对 URL）成立（§3 #3/#5/#9）。
- 案例 A 的 **7 span** 与 B 的 **3 span** 不是新发明：与冻结 fixture `fixtures/s3-frontend-facts/case-a-joined-chain`（7 行；父链 `1000→2000→3000→4000→5000→6000`，`render` 父=click 根）与 `case-b-frontend-only`（3 行；`render` 父=`OrderEdit.vue#validateForm`）**逐字段同形**，且可被当前 SDK/agent 代码路径复现（§3 #5）；A 的 7 span 以响应落在 1500ms 观察窗内为前提，plan 255 / 附录 H 1610 已如实写明降级（6 span）且禁止伪造。
- 契约只增：§2.8（242–293）+ 附录 H（1551–1612）为新增；§1–§10、附录 A–G、§10.11 的 S6b 三段逐字文案 3/3 仍在；schema/event-model/transport/status **字节不变**，S3/S6a/S6b fixture 哈希 = 冻结值（§2）。
- 矩阵如实：React 本地=**基础**、云端=**暂不支持**、四项不可见、`P2 完整`**未交付**；§14.2 目标矩阵不改（api 270–281）。
- 无 Tomcat/WAR/SSM、无 S8+、无云端/SSE/WS/持久化/CORS/鉴权、无 secret/PII/CDN/镜像/外网；后端复用、零改动、零新端点（§3 #2/#8）。
- 8 条非阻断项见 §4；其中 R2（三处旧 git 白名单未在迁移表授权）若不落实，S7-E 无法达成 75 PASS —— 这属于 tester 阻断条件，不是 coder 阻断条件。

## 2. G1 冻结（SHA256，2026-11-24 实测）

| 文件 | SHA256 | 说明 |
|---|---|---|
| `docs/plans/stages/S7/dispatch.md` | `538606bfd15d8208aa02aa9ccf3fb374cbcbc886e4a61f72106bb2305148503c` | dispatcher 所有，G1 后冻结 |
| `docs/plans/stages/S7/s7-plan.md` | `9088464f5660b2747fd66754eaade513c371d340ab33de52d08aec2de60f3976` | plan-writer 输出，G1 后冻结 |
| `docs/contracts/api.v1.md` | `fedfcbe01387acccdb75152911b21e0f282c0a1459c13dfcb66e2886f659acb3` | S7 加性增补后（取代 S6b `e1d7202a…`） |

支持性不变证据（同次实测）：`schema/traceboard.event.v1.json`=`927937df…489a`、`docs/contracts/event-model.v1.md`=`06aecbfe…2f38`、`transport.v1.md`=`44418a3a…6dfe`、`status-semantics.md`=`9a8735a0…fb56`（均未变）；`fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson`=`f99e57e1…f538`、`case-b-frontend-only/events.ndjson`=`2a73ac5f…e586`、`fixtures/s6-l2-lines/events.ndjson`=`ebf68113…bebc`、`fixtures/s6b-{async,no-debug,loop}/events.ndjson`=`d03c2f8d…75df`/`caa25a1a…d4c2`/`e21c3202…9c94`（均 = 既有冻结值）。

冻结规则：以上三值任一改动即本 G1 失效；R1/R3/R5/R6/R8 若以“改 `s7-plan.md`”方式落地，则该行哈希作废并需 G1 复评重算（`api.v1.md` 与 `dispatch.md` 无需改动，哈希保持）；tester 的 S7-E 以本表三值 + `S6B_G1_FREEZE` 14 / `S6A_G1_FREEZE` 8 / `S5_G1_FREEZE` 18 零漂移为准（verify.mjs 440/514/529/546）。

## 3. 逐项核验（dispatch §5.2 ①–⑧ + 可行性 + 冻结）

| # | 核验项 | 结论 | 证据 |
|---|---|---|---|
| 1 | React 基础边界：无构建插件/sourcemap/组件映射/JS 局部/回调内部 | PASS | dispatch 5/38/42–43/53/56；plan 30/111–116/147；api 277–279/291；SDK 无 `source` 时仅 nodeKey 前缀（src 779；dist 无 plugin）、file/line=「未采集」（S4DetailPanel 366/397）；plan 147 明写「无 sourcemap/插件」。未发现越界项 |
| 2 | 复用后端零改动、无新端点 | PASS | plan 18/26/30/198；api 266/291；附录 H 1553/1561–1562；OrderController 仅 `GET list`+5 个既有 POST（46/53/70/88/100/112/124），`cancel` 仍 200+UPDATE 0 行（OrderMapper 36），seed 订单 1 `SO-0001/CREATED/100.00`（data.sql 1）；无 CORS/鉴权/DB 改动 |
| 3 | 会话 `s_s7react` 前后端一致 | PASS | plan 19/76/97/174/201；api 260/268/289；SDK `normalizeOptions` 显式值优先（src 258–275）；agent `-Dtraceboard.sessionId` 正则 `^s_[A-Za-z0-9_-]+$`（AgentConfig 10/41–43）；plan 76 api 268 工作台手输同值 |
| 4 | 代理同源、`changeOrigin:false`、header 不被改写、无 CORS/不直连 8601 | PASS（R1 文本笔误） | plan 73–75/79/112；api 267；S7-C 真发 `traceparent`+`X-TraceBoard-Click` 并断言 `controller.parentSpanId=fetch`（plan 209–210），这是 header 保真的实测口径；静态无 `8601` 直连（plan 201）；**例外**：plan 45 的 ingest 终路径写成 `8601/v1/events`（见 R1） |
| 5 | A/B 断言可测，且与真实 SDK API 一致；7/3 span 可达；mount GET/manifest 探测不造假 span/EXACT | PASS | `wrapFn`→`js_method`、`false`→`RETURNED_FALSE`（src 759–817/819–839）；`uiEffect`→`render`（src 841–865，父=栈顶或 click 根）；document capture click（src 475–477/568–581）；fetch 头注入仅同源非 ingest（src 953–964）；observe 默认 1500（src 128/619–627）、根 flags 含 `OBSERVE_MS`（src 679–683）；A 7 span 与 fixture 同形（见 §1），collector 计 `spanCount/fetchCount/backendSpanCount`（TraceDeriver 108–152），`controllerLinkedToFetch`→EXACT（238–252）；B 3 span 与 case-b fixture 同形。mount GET 在 click 外、agent 只插桩 `cancel`/`cancelById`（TraceAgent 128；MapperAdvice 11–12；SpanContext 62/64）⇒ 无后端 span；ESM manifest 探测用 init 时 native fetch、一次性 fail-open（src 498–566/1300–1315）；plan 256、api 292、附录 H 1612 明写两者不得计为 B 请求或伪造 EXACT |
| 6 | S7-A..E 含 S0–S6 回归、清理/端口/git index、静态 dist 无代理限制 | PASS（R2/R4） | plan 187–228（A 187–194、B 196–203、C 205–211、D 213–218、E 220–228）；75 基线（S6 acceptance 13/21）；S7-E 222–228 含 75 不减、端口 8080/8601/5173/5174/5175/8602/18080、git index 未动、静态 dist 仅本地资产不作 A 通过路径；api 267/附录 H 1609 明示限制 |
| 7 | 矩阵不夸大 | PASS | api 270–281（本地=基础/云端=暂不支持/四项不可见/P2 未交付/§14.2 不改）；plan 147；主计划 §14.2（1062）仍为长期目标；api 291 反向列入「不得宣称」 |
| 8 | 无 Tomcat/S8+/secret/CDN/镜像；无 schema/event-model/transport/status/fixture 变更；契约只增 §2.8/H | PASS | plan 30/225–227/243；api 244–247/291；§2 哈希实测不变；§10.11 三段逐字串在 api 3/3 命中；§2–§2.7 与附录 A–G 标题/内容仍在（70–241、1337–1550）；§2.8 自带「历史不改写」声明（244–247） |
| 9 | coder 可行性（Webpack5+Babel18、`file:` ESM、lock、无 TS、5175 strict、devtool=false、逐字 UI、B 非数字、无 map/manifest、无绝对 URL） | PASS（R5/R6/R8） | plan 90（react/react-dom 18.3.1 精确、webpack5/wds5/babel 预设）、91（lock 仅 npmjs；`file:` 本地链接已成例：Vue demo package.json）、92（`devtool:false`/5175 strict/两路 proxy/`static:false`）、93（preset-env modules:false + preset-react automatic）、105–107（`file:../../../frontend/sdk`→`dist/index.js` 单文件 ESM 实测 0 import）、118–130（`#btn-cancel`/`#success-hint`/`#order-status`/`#amount-b` text+inputMode/`#btn-save-b` data-tb-fn/`#b-error`/`#b-pass`/`#root` 逐字）、116（SDK 自带 `http://localhost/` 与 `/traceboard-manifest.json` 字符串已在断言口径内豁免） |
| 10 | 冻结/历史保留 | PASS | §2 三值 + 支持性哈希；api 只增（结构性 + §10.11 逐字串）；无新 fixture/事件字段/枚举/路由（plan 243；api 291） |

## 4. 阻断（B）与非阻断（R）

**Blocking：0。**

- **R1（计划文本，中）** plan §3.1（45）把 ingest 终路径写为 `http://127.0.0.1:8601/v1/events`；与同文 §3.3（74）/§4.2（112）“`/ingest`→8601 **不 rewrite**”矛盾。实际终路径应为 `http://127.0.0.1:8601/ingest/v1/events`（SDK `reportUrl=/ingest/v1/events`，src 460；Vue Vite 同法已证）。**风险**：coder 若按图加 `pathRewrite` 会 404。**修法（plan 45 一行）**：改为 `…/ingest/v1/events`，并加括号「无 pathRewrite」。
- **R2（迁移授权缺口，高）** plan §7 第 3 行（239）只授权改 `S6A-E` 白名单；但 verify.mjs 有 **4 处** git 变更集白名单会因未跟踪的 `demo/buggy-shop-boot-react/**` 与 `docs/plans/stages/S7/**` 而 FAIL：`S3-10`（5410–5440 前缀 / 5478–5482 断言）、`S4-I`（9219–9241 / 9260–9266）、`S5-H`（10175–10182 / 10194–10200）、`S6A-E`（11957–11964 / 11976–11982）（`S2-9` 已在 5383 并入 S3-10）。**修法（plan §7 增 3 行并写入 test-report）**：三处各“仅追加两条前缀 `demo/buggy-shop-boot-react/`、`docs/plans/stages/S7/`；`forbiddenPrefixes`/既有前缀/断言一字不删”；同时声明“不因方便加宽到 `demo/` 或 `docs/` 全域”。
- **R3（门禁口径，中）** plan §6-B（202）“`#order-status` 初值 `CREATED`”作为静态断言，等于鼓励硬编码占位（mount GET 失败也显示 CREATED），与 dispatch §0.5（13）“禁止静态文案冒充运行时证据”冲突。**修法**：S7-B 静态只断言“选择器存在 + 源码不得硬编码 `CREATED`（占位用 `加载中…`/`—`）”，`CREATED` 保留在 S7-C 的 `GET /api/orders` 运行时断言（plan 207）与 acceptance 截图。
- **R4（门禁口径，中）** plan §6-E（222）“追加 S7-A..D 全 PASS … 总计 **80 PASS**”自相矛盾（A..D=4，75+4≠80），且 80 只在“每组恰 1 条 `record`、子断言用 `gate()`”时成立（verify `record` 693–698、`gate` 700–714）。**修法**：写明“S7-A..E 五组各 1 条 record（子断言 gate 合并）→ 75+5=80；若确需新增 record，报真实总数，仍以‘75 不减’为不变式，不得为凑数合并/删断言”。
- **R5（门禁口径，中）** plan §6-D（216）bundle 断言未说清对象。dev-served bundle 含 webpack-dev-server client（`new WebSocket`/ws URL），会误触“外链/WS”类反向断言。**修法**：S7-D 的 bundle/文本断言一律针对 `npm run build` 产物 `dist/app.js`(+`dist/index.html`)；若必须看 dev bundle，只做本地 token 正向断言并显式排除 wds client 串。
- **R6（可实现性，中）** plan §4（96）要求 `OrderEdit.jsx` 模块级 `wrapFn`“恰一次”，但 ESM 求值顺序未钉死：若 `OrderEdit.jsx` 直接 `import { wrapFn } from "@traceboard/sdk"` 且其求值早于 `src/traceboard.js` 的 `initTraceBoard`，`wrapFn` 走 no-op（src 1290–1298/1321–1327）⇒ B 只剩 2 span、静态门禁全绿而运行时失败。**修法**：`src/traceboard.js` `export const traceboard = initTraceBoard({...})` 并转出 `wrapFn/uiEffect`；`OrderEdit.jsx` 只从 `./traceboard` 导入；`index.jsx` 先 `./traceboard` 后 `./OrderEdit`；S7-B 反向断言 `OrderEdit.jsx` 不含 `from "@traceboard/sdk"`。
- **R7（验收口径，中）** plan §9（267–268）“选 A 板/B 板”有歧义：工作台 `setRequests` 不自动选中（stores/s3.ts 79–91），未点选时案例 B 判定恒为「暂无请求，不判定为“没发请求”」（S3Panel 340–346）。**修法（acceptance 步骤）**：`#s3-session` 输入 `s_s7react`→回车（1046–1056）→在 `#s3-ops`（1132）点选对应 trace 行→A/B 各等 >1500ms 后再截 `#s3-caseb`（1199）；并把 dispatch §10（155）“tester 反向断言无 overclaim”落到 S7-D：README/页面/bundle 不得含「完整/sourcemap/组件映射/JS 局部变量/云端已支持/Tomcat」宣称。
- **R8（计划文本，低）** webpack 配置（plan 92/192）未写 `mode` 与 `host`：不写 `mode` 时 webpack5 告警并默认 production，`process.env.NODE_ENV`/产物文本随调用方式漂移，bundle 断言不稳定；未写 host 与 dispatch §9（141）“仅回环”脱节。**修法**：build 固定 `mode:"production"`、dev 用 `webpack serve --mode development`；`devServer.host:"127.0.0.1"`（S7-A 断言无 `0.0.0.0`）。

## 5. 允许范围（G1 放行后的显式边界）

- **coder-react**：只写 `demo/buggy-shop-boot-react/frontend/**`——`package.json`/`package-lock.json`/`webpack.config.js`/`babel.config.js`/`public/index.html`/`src/index.jsx`/`src/OrderEdit.jsx`/`src/traceboard.js`/`src/styles.css`/`README.md`；可跑 `npm install` 生成 lock、`npm run build`；不得建 backend 子目录、不得改 SDK/agent/collector/build-plugin/workbench/Vue demo/backend/契约/fixture/tools，不得 git。
- **tester**：只写 `tools/verify/**` 与 `docs/plans/stages/S7/test-report.md`；迁移仅限：`LATEST_G1_FREEZE` 的 api.v1 一项（§2 值）、`S6A-E` “api/event-model 等于 S6B”拆分（api=S7、event-model=S6B）、`S3-10/S4-I/S5-H/S6A-E` 四处白名单各追加两条前缀（R2）、`S1_PORTS` 追加 5175、React 禁项在新路径的例外；不新增依赖/fixture/浏览器下载，不放宽阈值、不删断言、不用 S7 结果替代旧事实。
- **acceptance**：只写 `docs/plans/stages/S7/{progress,acceptance}.md`、`evidence/*.png`、`STAGE-PROGRESS.md` S7 行、`README.md`、`docs/plans/archive/stage-S7-*/`，验收后 commit+tag `s7-baseline`；不得改代码/契约/门禁。
- **全员禁止**：Tomcat/WAR/SSM、S8+、云端/SSE/WS/持久化/CORS/鉴权；React 构建插件/sourcemap/组件映射/JS 局部/回调内部；schema/event-model/transport/status 与 S0–S6 fixture 字节；secret/PII/CDN/镜像/外网/非回环；任何“React 完整/源码映射/云端已支持”宣称。

## 6. 复核说明与后续

- 本次评审未使用 git（dispatch §5.2 禁止）；契约“只增”以结构性证据判定（§1/§3 #8），字节级最终判据由 S7-E 的 S7 哈希 + 既有冻结清单承担；tester 必须把 R2/R4/R7 的落地写进 `test-report.md` 并附命令输出。
- 未发现需要改 `api.v1.md` 的缺陷：§2.8/附录 H 与 dispatch §3（42–56）、plan §3（34–82）在会话、代理、案例 A/B、矩阵、命令上逐项一致；`api.v1.md` 哈希 `fedfcbe0…` 可原样进入 S7-E 冻结。
- 放行顺序不变：`coder-react → tester → acceptance(G2)`；G2 前若出现“必须改 agent/collector/后端业务/schema 才能让 React 工作”或“必须引入插件/sourcemap/组件映射才达标”，立即按 dispatch §11 停止并 `BLOCKED`，不得降级、不得以本 PASS 放行超范围项。