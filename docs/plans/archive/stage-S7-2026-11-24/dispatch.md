# S7 第二栈（React18 + Webpack5，本地基础）· 任务分发书（dispatch）

> 阶段：S7｜角色：task-dispatch｜日期：2026-11-24｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S7 行与 §4；主计划 §7.3、§8.1–8.5、§13.3、§14.2；S6 `progress.md`/`acceptance.md`/`test-report.md`；基线 `s6-baseline`（`be2f7d5`）；现有 demo/SDK/workbench/tools/verify。
> 本文件是 S7 下游子代理的唯一任务输入；除 dispatcher 外不得修改。**S7 只做一条第二栈：React18 + Webpack5 前端（本地、基础级）；不做 Tomcat/WAR，不做 React 构建插件/sourcemap 深层。**

## 0. 通用规则（所有人）

1. 一人一卡：只读「输入」、只写「输出」；路径含中文/空格，命令与路径全部双引号，从仓库根执行；G1 后契约、s7-plan、本文件冻结。
2. **只有 S7 checkpoint 角色可写 git**（add/commit；验收通过后才打 `s7-baseline`）；其他人禁止 git 写、push/force/rebase/改 config。
3. 越界、契约缺口、门禁不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改”，不许改他人路径。
4. 无真实 secret/客户数据；无 CDN、在线字体、遥测、外部网络、第三方镜像；demo 数值/ID 全为演示值；只本机回环。
5. 未做/未验证必须标 `S7 未做`；**禁止用 fixture/静态文案冒充运行时证据**；禁止伪造 EXACT、行数、0 行、截图。
6. schema、`event-model.v1.md`、`transport.v1.md`、`status-semantics.md`、S0–S6 fixture 字节、agent、collector、SDK、build-plugin、Vue demo 前后端、workbench 源码一律冻结（本阶段预期零改动）。

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 检查点 | S7：第二栈案例 A/B，React18 + Webpack5，本地可跑，支持矩阵如实标「基础」 |
| 完成信号 | React 案例 A 经 `/api`/`/ingest` 代理形成 EXACT 全链且 DB 仍 CREATED/0 行；案例 B 纯前端零请求且 SDK 可证「没发」 |

S7 收尾必须同时成立（缺一即 FAIL）：

1. **前端**：`demo/buggy-shop-boot-react/frontend/` 可 `npm ci && npm run build`；dev 固定 5175；Webpack5 + Babel React18；本地资产、无 CDN；无构建插件、无 `.map`、无 manifest。
2. **复用后端**：直接复用 `demo/buggy-shop-boot-vue/backend`（Boot 2.7/H2，JDK8）；**零业务改动**；不新建后端副本；不新增端点。
3. **SDK（基础）**：消费 `@traceboard/sdk` 的**已构建 ESM dist**；`sessionId=s_s7react`、`ingestUrl=/ingest`、`appName=OrderEdit.jsx`；自动 click/fetch 捕获；案例 B 显式 `wrapFn("validateForm")` + `uiEffect`。
4. **案例 A**：`#btn-cancel` → 同源 `POST /api/orders/1/cancel` → 2xx 显示 `操作成功`；DB 仍 `CREATED`、SQL `rowsAffected=0`。
5. **案例 B**：金额空/非数字/≤0 → `金额必须大于 0`；**不发送 fetch/XHR**；观察窗关闭后 `sdkActive=true`、`fetchCount=0`、`hasBackend=false`。
6. **关联**：前端 `traceparent` + `X-TraceBoard-Click` 经 5175 代理到达 8080；controller/service/mapper/sql 4 个后端 span 与 click/fetch **EXACT**；无 `LOST_BACKEND`。
7. **工作台**：S3/S5/S6 既有面板在 session `s_s7react` 可看同一链；案例 B 显示「已确认：本次点击因果链内没有网络请求」；无需改 UI 代码。
8. **回归/契约**：S0–S6 全量门禁 PASS；支持矩阵新增 React18/Webpack5 本地=`基础`、云端=暂不支持；无 S8+。

## 2. 范围（越界即失败）

**In**：新建 React 前端目录（package/lock、webpack/babel 配置、public、src、README）；`/api`→8080 与 `/ingest`→8601 代理；port 5175；案例 A/B；SDK ESM 接入；api.v1 S7 矩阵/附录 H；S7 计划/评审/测试/验收/备份/tag。

**Out**：Tomcat/WAR/SSM（S8 候选）；React 构建插件、sourcemap/组件映射、JS 函数/文件/行号、JS 局部变量、回调内部、React 组件树；agent/collector/SDK/build-plugin 改动；后端业务/端点/DB/CORS/鉴权改动；云端/SSE/WS/持久化/像素回放；新 fixture；S8+ 任何工作。

## 3. 强制共享决策（不得协商）

| 项 | 决策 |
|---|---|
| 栈 | React 18.3.1 + react-dom 18.3.1；Webpack 5 + webpack-cli + webpack-dev-server 5；Babel（preset-env + preset-react automatic）；JS/JSX，不引入 TS/ts-loader。版本以 lockfile 固定，仅 `registry.npmjs.org`。 |
| 目录 | 仅 `demo/buggy-shop-boot-react/frontend/`；**不建 backend 子目录**；README 明确后端复用 `demo/buggy-shop-boot-vue/backend`。 |
| 后端 | 现有 Boot 2.7/H2/JDK8；seed 订单 1 `CREATED/100.00`；案例 A cancel 仍 200 但 UPDATE 0 行；不改 pom/yml/schema.sql/data.sql/Java。 |
| 会话 | SDK 与 agent 均 `s_s7react`；agent 启动 `-Dtraceboard.sessionId=s_s7react`；工作台 `#s3-session` 输入该值；不一致视为 FAIL（无 EXACT）。 |
| SDK | 只依赖 `file:../../../frontend/sdk` 的 `dist/index.js` ESM（先构建 SDK）；不 import `src`、不改 SDK；`sessionId/appName` 固定；无 manifest 时 file/line 显示「未采集」；ESM 的 `/traceboard-manifest.json` 一次性兜底允许 404/非 JSON，fail-open、不发事件。 |
| 代理 | devServer 5175（strictPort）；`/api`→`http://127.0.0.1:8080`、`/ingest`→`http://127.0.0.1:8601`；`changeOrigin=false`；同源、无 CORS；不直连 8601；代理只在 dev，静态 dist 无代理（明示限制）。 |
| 页面 | `public/index.html` + `#root`；挂载时 GET `/api/orders` 展示状态（不在 click 操作内，SDK 不记 fetch）；取消后不自动刷新；稳定选择器 `#btn-cancel`/`#success-hint`/`#order-status`、`#amount-b`/`#btn-save-b`/`#b-error`/`#b-pass`。 |
| 案例 A | 仅 `POST /api/orders/1/cancel`；2xx 后显示 `#success-hint` 文本 `操作成功` 并 `uiEffect("操作成功")`；不 wrapFn；预期 click→fetch→4 backend→render 共 7 span，EXACT。 |
| 案例 B | `validateForm` 只做前端校验；金额空/非数字/≤0 → `#b-error` `金额必须大于 0` 且 `RETURNED_FALSE`；有效 → `#b-pass` `校验通过（本案例不提交）`；全程零 fetch/XHR；按钮 `data-tb-fn="validateForm"`，函数只 wrap 一次。 |
| 构造 | 构建 `devtool=false`（dev/build 均无 `.map`）；不引入 build-plugin、不内联 manifest；无绝对 http(s) 资源；无在线字体/图片；dist 仅本地资产。 |
| 工作台 | 不改 `workbench/src/**`；默认板仍 `s_s3demo`，手输 `s_s7react`；后端节点用 S5/S6 详情，前端仅 S3 基础事实；不得把 React 显示为「完整/源码映射」。 |
| 契约 | plan-writer 只在 `api.v1.md` 加 §2.8 S7 矩阵与附录 H（React demo、命令、案例、矩阵）；**event-model/schema/transport/status 不动**；不新增 fixture；主计划 §14.2 目标矩阵不改（避免把 P2 目标写成已交付）。 |
| 矩阵 | 交付口径：React18+Webpack5+runtime SDK、本地=`基础`；可见控件/请求/响应/UI 效果+后端方法/SQL；不可见 JS 源码位置/组件映射/JS 局部变量/回调内部；无构建插件/sourcemap；云端=`暂不支持`；「完整(P2)」未交付。 |

## 4. 运行时链路与证据口径

- **A（浏览器）**：`click #btn-cancel`（SDK root）→ `fetch POST /api/orders/1/cancel`（带 traceparent/click）→ controller → service → mapper → sql（agent）→ HTTP 200 → `render`（uiEffect）。同 trace 恰 7 span，全部 EXACT；sql `rowsAffected=0`；`GET /api/orders` 仍 `CREATED`。
- **B（浏览器）**：`click #btn-save-b`（SDK root）→ `js_method OrderEdit.jsx#validateForm`（RETURNED_FALSE）→ `render`（错误文案）；恰 3 span；`fetchCount=0`、`hasBackend=false`、`sdkActive=true`、根 flag 含 `OBSERVE_MS`；无后端 span。
- **工作台**：session `s_s7react`；A 板显示 7 span/4 后端/SQL 0 行/EXACT；B 板显示 fetchCount=0 与「已确认：本次点击因果链内没有网络请求」；S5/S6 面板未回归。
- **证据分层**：自动化门禁证明构建/代理/关联/回归；浏览器截图证明 UI 与 SDK 运行时；两者分开写，不用静态断言替代截图。

## 5. 任务卡（独立输入/输出）

### 5.1 plan-writer（契约/计划；不写代码）

- 输入：本文件 §1–§4、S0–S6 冻结契约/schema、主计划 §7.3/§8.1–8.5/§13.3/§14.2、现有 SDK/workbench/verify。
- 输出（只写）：`docs/contracts/api.v1.md`（§2.8 S7 实现矩阵、附录 H：复用端点/案例 A/B/运行命令/`s_s7react`/交付支持矩阵；保留历史矩阵）、`docs/plans/stages/S7/s7-plan.md`（≤400 行：设计、构建/运行命令、S7-A..E、回归迁移、限制/风险）。
- 完成判据：§3 全部落入契约/plan；矩阵明确「基础」与四项不可见；无新 API/事件字段/fixture；schema/event-model/transport/status 字节不变；plan 列清测试命令与 S0–S6 回归。
- 禁止：写前端代码/config/pom/JSX、改 agent/collector/SDK/workbench/Vue demo、改 schema/transport/status/event-model、git、真实 secret/外网 `$ref`、宣称 React 完整或 Tomcat 已做。

### 5.2 plan-reviewer（只读，G1 门）

- 输入：本文件、plan-writer 全部输出、S0–S6 契约/schema、现有 SDK/demo/verify。
- 输出（只写）：`docs/plans/stages/S7/plan-review.md`——逐项 PASS/FAIL、阻断/建议、SHA256 冻结清单、`G1: PASS|FAIL`。
- 核查：①React 基础边界与「无插件/sourcemap/组件映射/JS 局部」一致；②复用后端零改动、无新端点；③会话 s_s7react 前后端一致；④proxy 同源且 header 不被改写；⑤案例 A/B 断言可测；⑥S7-A..E 含 S0–S6 回归/清理；⑦矩阵不夸大；⑧无 Tomcat/S8+、无 secret/CDN/镜像。
- 禁止：替作者改文件、写代码、git、放行超范围项。

### 5.3 coder-react（仅 `demo/buggy-shop-boot-react/frontend/**`）

- 输入：本文件 §3/§4、G1 契约/s7-plan、现有 SDK dist、Vue demo 的案例 A/B 语义。
- 输出（只写）：新目录内含 `package.json`/`package-lock.json`、`webpack.config.js`、`babel.config.js`、`public/index.html`、`src/index.jsx`、`src/OrderEdit.jsx`、`src/traceboard.js`、`src/styles.css`、`README.md`；其余路径只读。
- 完成判据：`npm ci && npm run build` 绿；dev 5175 strict；代理两路正确；SDK 预构建 ESM 被 bundle 引用；A/B 行为与选择器/文案逐字；无直连 8601、无绝对 URL/CDN、无 `.map`、无 build-plugin/manifest；不修改后端仍能跑通。
- 禁止：改 Vue demo/backend/agent/collector/SDK/build-plugin/workbench/契约/fixture/tools；新增端点/CORS/鉴权；git；Tomcat/WAR；把 appName 当真实源码映射宣传。

### 5.4 tester（`tools/verify/**` + `S7/test-report.md`）

- 输入：全部 S7 产物、G1 冻结、S0–S6 门禁与端口/清理约定。
- 输出（只写）：`tools/verify/verify.mjs`（新增 S7-A..E 与必要迁移，不新增依赖）、`docs/plans/stages/S7/test-report.md`（命令、结果、浏览器复现步骤与期望证据；可含 demo 运行手册）。
- 门禁（一次命令、非 0 即 FAIL；串行起停、`finally` 清理进程/端口/临时文件）：
  - **S7-A build/artifact**：SDK 构建；React `npm ci && npm run build`；React18/Webpack5 版本；dist 仅本地资产、无 `.map`/manifest/外部 URL；5175 strict；proxy 目标正确；lockfile 仅 npmjs。
  - **S7-B demo 静态契约**：后端零 diff/零新端点；A 端点/文案/`uiEffect`/不刷新；B 校验无 fetch/XHR、`wrapFn` 一次、选择器/文案逐字；SDK 固定 `s_s7react`/`OrderEdit.jsx`/`/ingest`；无直连 8601。
  - **S7-C 代理与 EXACT**：collector 8601 + 后端 JDK8 + agent `s_s7react` + dev 5175；GET 经代理；SDK 形状 click+fetch 事件（内联，不新增 fixture）+ 经 5175 带 header POST cancel → 4 后端 span、controller.parent=fetch、全 EXACT、无 LOST、SQL 0 行、订单仍 CREATED；`/ingest` 经 5175=202；停 collector 后仍 200（fail-open）。
  - **S7-D serving/workbench/SDK 基础**：`/` 200、`#root`、本地产物；bundle 含 `s_s7react`/`OrderEdit.jsx`/选择器/SDK 标记、无 manifest/plugin/外链；collector requests/graph `s_s7react` 形状正确（graph 15 字段）；workbench 构建与 S3/S5/S6 选择器不变，`#s3-session` 可切 `s_s7react`。
  - **S7-E regression/scope/freeze/cleanup**：全量 S0–S6 PASS；Vue demo/agent/collector/SDK/build-plugin/workbench 零 diff；schema/event-model/transport/status/S0–S6 fixture 字节不变；G1 冻结零漂移；无 Tomcat/S8+；无 secret/CDN/镜像/CORS/持久化；端口 8080/8601/5173/5174/5175/8602/18080 释放；git index 未动。
- 完成判据：一条命令 exit 0；S7-A..E 与 S0–S6 全 PASS；浏览器步骤写清但不伪造截图；门禁迁移显式、不放宽。
- 禁止：加 Playwright/浏览器下载、改产品代码、用 fixture 冒充运行时、git、S8+。

### 5.5 S7 acceptance / checkpoint（G2、备份、tag）

- 输入：全部 S7 产物、G1 报告、tester 报告、浏览器运行手册。
- 输出（只写）：`S7/progress.md`、`S7/acceptance.md`、`S7/evidence/{s7-react-case-a,s7-workbench-case-a,s7-react-case-b,s7-workbench-case-b}.png`、`STAGE-PROGRESS.md` S7 行、`README.md`（能力/限制/矩阵/端口 5175）、`docs/plans/archive/stage-S7-2026-11-24/`（MANIFEST+SUMMARY）、git commit + tag `s7-baseline`。
- 完成判据：亲自复跑全量 exit 0；浏览器 A（toast+订单仍 CREATED+工作台 EXACT/0 行）、B（错误文案+工作台 fetchCount=0/`已确认…没有网络请求`）；`npm run build` 绿；矩阵如实「基础」；备份/tag 与 S6 同构；NEXT 写 S8（Tomcat 可选）但**不开始**。
- 禁止：改代码/契约/门禁、未绿打 tag、push/force/rebase、宣称 React 完整/云端/Tomcat 已做、开始 S8。

## 6. 测试计划（汇总）

| 组 | 内容 |
|---|---|
| S7-A..E | 上述五组一次命令；S0–S6 全量回归（约 75 项）不得减少；迁移只在确证被 S7 取代处显式记录。 |
| 浏览器 | acceptance 执行：起 collector+后端 agent+dev 5175；A 点 `#btn-cancel` 等待 toast/刷新工作台；B 输入 `0` 点 `#btn-save-b`，等 >1500ms；截图四张。 |
| 构建 | `frontend/sdk` 先 build；React `npm ci && npm run build` 与 dev 均验证；静态 dist 只做本地资产断言（无代理，不作 A 的通过路径）。 |
| 安全/清理 | 回环 only；无 secret/Cookie/表单值采集；无外链/镜像；端口/进程清理；git index 未动。 |

## 7. 路径归属（零交集）

| 路径 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S7/dispatch.md` | dispatcher | 只读 |
| `docs/contracts/api.v1.md`、`docs/plans/stages/S7/s7-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S7/plan-review.md` | plan-reviewer | 只读 |
| `demo/buggy-shop-boot-react/frontend/**` | coder-react | 只读 |
| `tools/verify/**`、`docs/plans/stages/S7/test-report.md` | tester | 只读 |
| `S7/{progress,acceptance}.md`、`S7/evidence/**`、`README.md`、`STAGE-PROGRESS.md`、archive、git/tag | acceptance | 只读 |
| schema/event-model/transport/status、S0–S6 fixture/docs、agent/collector/SDK/build-plugin/workbench/Vue demo | 冻结 | 一律只读 |

## 8. 门禁顺序与冻结

`dispatcher → plan-writer → plan-reviewer(G1) → coder-react → tester → acceptance(G2) → tag/备份 → 停 → S8`

- G1 前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 上报，不降级。
- G1 冻结：`api.v1.md`、`s7-plan.md`、本文件；schema/event-model/transport/status 与 S0–S6 fixture 字节只读。
- tester 必须等 coder 完成；acceptance 必须亲自复跑门禁 + 浏览器；**S7 到达检查点即停，不得开始 S8/Tomcat**。

## 9. 环境事实（不得改写）

- Windows + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，全部双引号）。
- JDK8 `C:/Program Files/Java/jdk1.8.0_221`（后端构建/运行）；JDK21 `C:/Program Files/Java/jdk-21`（agent/collector/launcher/root）；Node 22.22.1/npm 10.9.7；Maven 3.9.5。
- 端口：collector 8601、后端 8080、React dev 5175、workbench 5173、Vue demo 5174（不改）、preview 8602、静态测试 18080；冲突先诊断，不静默改。
- session `s_s7react`；分支 `master`、无 remote；无真实 secret/客户数据；npm 仅官方 registry，不换镜像。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Webpack5 解析 `file:` SDK ESM/依赖 hoist，或 dist 未构建导致构建失败 | 固定先构建 SDK；lockfile 固定；babel-loader 排除 node_modules；bundle 断言 SDK 标记；失败先诊断依赖/字段，不改 SDK。 |
| devServer 代理丢 `traceparent`/`X-TraceBoard-Click` 或改写 Origin，EXACT 断裂 | 同源代理、`changeOrigin=false`；S7-C 经 5175 真发 header 验证 controller.parent=fetch；无 CORS 改动；失败即阻断，不伪造 EXACT。 |
| React 合成事件/root 委托导致 SDK 点不到或时机晚于 fetch | SDK 在 document capture 监听；验证 `#btn-cancel`/`#btn-save-b` 的 click root 先于 handler；避免 stopPropagation/portal；若仅改 SDK 可解→停止并记录 React 缺口。 |
| 会话漂移（SDK/agent 各用默认或旧会话） | 双端强制 `s_s7react`；启动日志与 collector agent 端点复核；工作台手输；不一致 FAIL。 |
| 案例 B 被「看起来没发」蒙混 | 必须 `sdkActive=true`+`fetchCount=0`+`hasBackend=false`+`OBSERVE_MS` 关闭；工作台判定文案；浏览器证据；不接受仅源码/静态断言。 |
| 静态 dist 无代理被误当支持路径 | dev 代理是 S7 通过路径；dist 仅证明本地资产；README/矩阵明示静态需自备同源反代（未验证）。 |
| 依赖下载/CDN/镜像违规 | lockfile 仅 npmjs；不下载浏览器；不引在线字体/脚本；安装失败上报，不换镜像。 |
| 矩阵/工作台夸大（React 完整、可看源码行号/局部变量） | 契约/README 只写「基础」及四项不可见；工作台不新增 React 源码宣称；tester 反向断言无 overclaim 文案。 |
| 范围蔓延（顺手改 agent/collector/后端/Tomcat） | 路径白名单 + 零 diff 断言；React 特有缺口先 BLOCKED 取证，交 S8 决定；本阶段不做。 |

## 11. 停止条件与出口纪律

1. 必须改 agent/collector/后端业务/schema/事件模型才能让 React 工作（非仅配置），或必须改 SDK 才能捕获 React 事件。
2. 必须引入构建插件/sourcemap/组件映射/JS 局部变量才能达标（超出 S7 基础）。
3. 必须改 CORS/鉴权、跨域直连 8601/8080，或必须让静态 dist 无代理通过。
4. 必须引入 Tomcat/WAR/SSM、云端、SSE/WS/持久化或 S8+ 任一内容。
5. 需要真实 secret/PII/CDN/镜像/外部下载，或需改他人路径/git 越权。
6. G1 FAIL 且一轮返工仍 FAIL；任一构建/门禁/浏览器证据未过但 owner 想先提交/打 tag。
7. S7 只证明「React18+Webpack5 本地基础案例 A/B」；不得宣称 React 完整、源码映射、JS 局部变量、Tomcat/云端已做。

## 12. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-24 | 首版：React18+Webpack5 本地基础第二栈；复用 Boot/H2 后端与 s_s7react；SDK ESM 基础；代理/案例 A/B；S7-A..E 与浏览器证据；矩阵只标基础；停止条件。 |