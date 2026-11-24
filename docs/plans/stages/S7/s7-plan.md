# S7 计划：React 18 + Webpack 5 本地基础第二栈（案例 A/B）

> 阶段：S7｜角色：plan-writer｜日期：2026-11-24｜版本：v1
> 唯一输入：`docs/plans/stages/S7/dispatch.md`（binding，下称 dispatch）、`docs/plans/SOLO-PLAN.md` S7、主计划 §7.3/§8.1–8.5/§13.3/§14.2、S0–S6 冻结契约/schema/fixture、现有 SDK/workbench/verify。
> 本计划只描述设计与门禁；代码由 dispatch §5.3 的 coder-react 实现。G1 后本文与 `api.v1.md` 一并冻结。
> **S7 只做一条第二栈**：React 18.3.1 + Webpack 5 + Babel 的本地基础案例 A/B；不做 Tomcat/WAR/SSM，不做 React 构建插件/sourcemap/组件映射/JS 局部变量。

## 1. 目标与验收信号

| 项 | 口径 |
|---|---|
| 检查点 | S7：第二栈案例 A/B，React18 + Webpack5，本地可跑，支持矩阵如实标「基础」 |
| 完成信号 | React 案例 A 经 `/api`/`/ingest` 代理形成 EXACT 全链且 DB 仍 CREATED/0 行；案例 B 纯前端零请求且 SDK 可证「没发」 |

S7 收尾必须同时成立（缺一即 FAIL）：

1. **前端**：新目录 `demo/buggy-shop-boot-react/frontend` 可 `npm ci && npm run build`；dev 固定 5175；React 18.3.1 + Webpack 5 + Babel；本地资产、无 CDN；无 TraceBoard 构建插件、无 `.map`、无 manifest 文件。
2. **复用后端**：直接复用 `demo/buggy-shop-boot-vue/backend`（Boot 2.7/H2，JDK8）；零业务改动；不建后端副本；不新增端点。
3. **SDK（基础）**：消费 `@traceboard/sdk` 已构建 ESM `dist/index.js`；`sessionId=s_s7react`、`ingestUrl=/ingest`、`appName=OrderEdit.jsx`；自动 click/fetch；案例 B 显式 `wrapFn("validateForm")` + `uiEffect`。
4. **案例 A**：`#btn-cancel` → 同源 `POST /api/orders/1/cancel` → 2xx 显示 `操作成功`；DB 仍 `CREATED`、SQL `rowsAffected=0`。
5. **案例 B**：金额空/非数字/≤0 → `金额必须大于 0`；不发送 fetch/XHR；观察窗关闭后 `sdkActive=true`、`fetchCount=0`、`hasBackend=false`。
6. **关联**：`traceparent` + `X-TraceBoard-Click` 经 5175 代理到 8080；controller/service/mapper/sql 4 个后端 span 与 click/fetch **EXACT**；无 `LOST_BACKEND`。
7. **工作台**：S3/S5/S6 既有面板在 `s_s7react` 可看同一链；案例 B 显示「已确认：本次点击因果链内没有网络请求」；不改 `workbench/src/**`。
8. **回归/契约**：S0–S6 全量门禁 PASS；矩阵新增 React18/Webpack5 本地=`基础`、云端=暂不支持；无 S8+。

## 2. 范围与边界（越界即失败）

**In**：新 React 前端目录（package/lock、webpack/babel 配置、public、src、README）；`/api`→8080 与 `/ingest`→8601 代理；port 5175；案例 A/B；SDK ESM 接入；`api.v1.md` §2.8/附录 H；S7 计划/评审/测试/验收/备份/tag。

**Out**：Tomcat/WAR/SSM（S8 候选）；React 构建插件、sourcemap/组件映射、JS 函数/文件/行号、JS 局部变量、回调内部、React 组件树；agent/collector/SDK/build-plugin 改动；后端业务/端点/DB/CORS/鉴权改动；云端/SSE/WS/持久化/像素回放；新 fixture；S8+ 任何工作。

## 3. 架构与数据流

### 3.1 案例 A（有请求，0 行）

```text
click #btn-cancel（document capture）
  → SDK ui_event 根（新 traceId/clickId/rootSpanId）
  → React onClick：fetch POST /api/orders/1/cancel
  → SDK fetch span（同源非 /ingest：加 traceparent: 00-<traceId>-<fetchSpanId>-01 + X-TraceBoard-Click: <clickId>）
  → devServer 5175 /api → http://127.0.0.1:8080（changeOrigin=false，不改写头/路径）
  → agent 读头 → controller → service → mapper → sql（4 后端 span，EXACT）
  → HTTP 200 {"data":true}；SQL UPDATE 影响 0 行；订单 1 仍 CREATED
  → 显示 #success-hint「操作成功」+ uiEffect("操作成功") → SDK render span（parent=click 根）
  → SDK NDJSON → 5175 /ingest → http://127.0.0.1:8601/v1/events → collector
  → 工作台（只读 GET requests/graph）选 s_s7react 查看 7 span
```

同一 trace 恰 **7 span**：`ui_event → fetch → controller → service → mapper → sql` 加 `render`；`render.parentSpanId=click 根`，`controller.parentSpanId=fetch.spanId`；6 条边；全部 `confidence=EXACT`，无 `LOST_BACKEND`；`sql.sideEffects[0].rowsAffected=0`、`transaction=UNKNOWN`；service return `true`、mapper return `0`、controller HTTP 200。

### 3.2 案例 B（纯前端，零请求）

```text
click #btn-save-b（document capture）
  → SDK ui_event 根
  → React onClick 同步调用唯一包装函数 OrderEdit.jsx#validateForm
     ├─ 空/非数字/≤0 → #b-error「金额必须大于 0」，返回 false（RETURNED_FALSE）
     └─ 有效 → #b-pass「校验通过（本案例不提交）」，返回 true（OK）
  → 两支都 uiEffect(对应文案) → SDK render（parent=js_method）
  → 全程无 fetch/XHR
  → 1500ms 观察窗关闭后 click 根入库（flags 含 SDK_ACTIVE/S3_RUNTIME_SDK/OBSERVE_MS=1500）
  → collector：spanCount=3 / fetchCount=0 / hasBackend=false / backendSpanCount=0
  → 工作台：「已确认：本次点击因果链内没有网络请求」
```

同一 trace 恰 **3 span**：`ui_event → js_method → render`；2 条边；`js_method.status=RETURNED_FALSE`（失败分支）；无 controller/service/mapper/sql。

### 3.3 同源、会话与代理

| 项 | S7 取值 |
|---|---|
| 页面 | `http://localhost:5175`（webpack-dev-server 5，`strictPort:true`） |
| API 代理 | `/api` → `http://127.0.0.1:8080`，`changeOrigin:false`，不 rewrite |
| ingest 代理 | `/ingest` → `http://127.0.0.1:8601`，`changeOrigin:false`，不 rewrite |
| 直连 8601 | 禁止；前端只经同源 `/ingest` |
| 会话 | SDK 与 agent 均 `s_s7react`；工作台 `#s3-session` 手输该值；不一致视为 FAIL |
| appName | `OrderEdit.jsx`（仅 nodeKey 前缀，不是源码映射） |
| observe | 1500ms（默认；B 必须等窗口关闭） |
| 同源/CORS | dev 同源代理；不新增 CORS/鉴权；后端 8080 不直连浏览器 |
| 工作台 | 默认板仍 `s_s3demo`；`workbench/src/**` 零改动；手输 `s_s7react`；前端只显示 S3 基础事实，后端节点用 S5/S6 详情；不得显示 React 源码/行号/组件映射 |
| 静态 dist | 无代理，不是 A 的通过路径；README 明示需自备同源反代（未验证） |
| 时钟 | SDK/agent 单机 epoch-ns，collector 原样存储；V1 不跨机器 |

## 4. 文件地图与实现约束（coder-react）

只写 `demo/buggy-shop-boot-react/frontend/**`；其余路径只读。

| 文件 | 角色与硬约束 |
|---|---|
| `package.json` | `private:true`；scripts `dev`/`build`；deps `react`/`react-dom` **18.3.1**（精确）、`@traceboard/sdk: file:../../../frontend/sdk`；devDeps webpack5、webpack-cli、webpack-dev-server5、babel-loader、@babel/core、@babel/preset-env、@babel/preset-react、html-webpack-plugin、style-loader、css-loader；无 TS/ts-loader |
| `package-lock.json` | 提交；除 `@traceboard/sdk` 的本地 `file:` 链接外，所有 registry `resolved` 仅 `https://registry.npmjs.org/`；不换镜像 |
| `webpack.config.js` | entry `src/index.jsx`；output `dist/app.js`（`clean:true`）；`devtool:false`；babel-loader 排除 `node_modules`；`resolve.symlinks:false` + extensions `.js/.jsx`；HtmlWebpackPlugin 从 `public/index.html` 产出本地 `dist/index.html`（仅注入 bundle，不内联 manifest）；devServer 5175 strictPort，proxy 两路数组，`static:false`，`historyApiFallback:false`；不 import `frontend/build-plugin` |
| `babel.config.js` | `@babel/preset-env`（`modules:false`，目标现代浏览器）+ `@babel/preset-react`（`runtime:"automatic"`）；仅 JS/JSX |
| `public/index.html` | 含 `#root`；不写外链脚本/字体/图片；不写内联 manifest；本地资产 |
| `src/index.jsx` | 先 import/初始化 `traceboard`，再用 `createRoot` 渲染 `OrderEdit` 根组件；**不用 StrictMode**（避免 mount GET 双发）；import `styles.css` |
| `src/OrderEdit.jsx` | 页面根组件；mount 时 GET `/api/orders` 一次；案例 A/B；稳定选择器与逐字文案；`validateForm` 模块级 `wrapFn` **只一次**；`#btn-save-b` 带 `data-tb-fn="validateForm"`；取消后不调用 `loadOrders` |
| `src/traceboard.js` | `initTraceBoard({ingestUrl:"/ingest", sessionId:"s_s7react", appName:"OrderEdit.jsx", observeMs:1500})`；不改 SDK |
| `src/styles.css` | 本地样式；无在线字体/背景 URL |
| `README.md` | 复用 Vue 后端；构建/运行/端口/会话/代理；静态 dist 无代理；矩阵只写「基础」与四项不可见 |

`dist/` 为构建产物，按仓库 `.gitignore` 不入库。

### 4.1 SDK ESM 消费

- 仅依赖 `file:../../../frontend/sdk`，Webpack 按包 `exports.import` 解析到 **`dist/index.js`**；禁止 import `frontend/sdk/src/**`，禁止改 SDK。
- 必须先构建 SDK（`npm ci && npm run build`），否则 React 构建失败；不因解析失败改 SDK/拷源码。
- ESM 初始化允许一次 `GET /traceboard-manifest.json` 兜底（404/非 JSON 均可，fail-open、不发事件）；**不得**在 `public/` 放 manifest、不得内联 `window.__TRACEBOARD_MANIFEST__`。
- 无 manifest → 事件无 `source`；界面/README 写「未采集」，不得显示伪造文件/行号。

### 4.2 Webpack / 代理 / 构建

- Webpack 5 + webpack-dev-server 5；proxy 用 v5 数组形式，两路均 `changeOrigin:false`；不 pathRewrite、不加 CORS 头、不直连 8601。
- `devtool:false`（dev/build 均无 `.map`）；不引入 source-map-loader、不生成 `.map`。
- 不使用 TraceBoard build-plugin（不 AST 插桩、不生成/内联 manifest）；`html-webpack-plugin` 仅产出本地 HTML，不属于 TraceBoard 构建插件。
- `static:false` + 生成式 index，保证 `/` 返回注入 bundle 的 HTML；`/traceboard-manifest.json` 404 由 SDK fail-open 容忍。
- 生产 build 只允许本地 `app.js`/`index.html`（及可选本地样式/许可证文本）；无绝对 http(s) 资源引用（SDK 内部的 `http://localhost/` 兜底基址与 `/traceboard-manifest.json` 字符串不算资源引用，断言见 §6-A）。

### 4.3 UI 契约（逐字）

| 选择器/属性 | 精确文本/行为 |
|---|---|
| `#btn-cancel` | 「取消订单」；click 只发 `POST /api/orders/1/cancel` |
| `#success-hint` | **仅 2xx** 显示，文本 `操作成功`；同点调用 `uiEffect("操作成功")` |
| `#order-status` | mount GET 后显示订单 1 状态 `CREATED`；A 成功后仍 `CREATED`（不自动刷新） |
| `#amount-b` | 金额输入；`type="text"` + `inputMode="decimal"`（允许空/非数字）；SDK 不采集输入值 |
| `#btn-save-b` | 「保存」；`data-tb-fn="validateForm"`；click 只调 `validateForm`，无 fetch/XHR |
| `#b-error` | 空/非数字/≤0 显示 `金额必须大于 0`；`RETURNED_FALSE` |
| `#b-pass` | 有效显示 `校验通过（本案例不提交）`；`OK` |
| `validateForm` | nodeKey `OrderEdit.jsx#validateForm`；模块级 `wrapFn` 恰一次；两支都 `uiEffect` |
| `#root` | `public/index.html` 挂载点 |

- A 不 wrapFn；不刷新列表、不发第二个 fetch；`#order-status` 不因 A 改变。
- B 不请求后端；不提交；`#b-error`/`#b-pass` 互斥；不采集 amount 实际值。
- 页面不采集 Cookie/请求体/表单值；无 secret/PII。

### 4.4 React 事件时序

- SDK 在 `document` capture 监听，早于 React 18 root 容器上的合成事件；click 根必须先于 onClick 中的 fetch/validateForm。
- 禁止 `stopPropagation`、portal、异步后才调用 `validateForm`；A 的 fetch 必须在 click 窗口内同步发起；B 的 validateForm 必须在 onClick 内同步返回。
- 若 SDK 仅因 React 合成事件无法观测（非配置可解），停止并记录 `BLOCKED`，不得改 SDK。

### 4.5 README 必须写明

- 后端复用 `demo/buggy-shop-boot-vue/backend`，零改动；不新建 backend。
- 端口 5175/8080/8601/5173；session `s_s7react`；SDK ESM 先构建。
- 静态 dist 无 `/api`/`/ingest` 代理（仅本地资产）；A 的通过路径是 dev 5175。
- 支持级别「基础」及四项不可见（JS 源码位置/组件映射/JS 局部变量/回调内部）；无构建插件/sourcemap；云端暂不支持；P2 完整未交付。

## 5. 构建与运行命令

环境：Windows + Git Bash；仓库路径含中文/空格，全部双引号；JDK8=`C:/Program Files/Java/jdk1.8.0_221`；JDK21=`C:/Program Files/Java/jdk-21`；Node 22/npm 10；Maven 3.9.5；仅本机回环。

```bash
# 1) SDK 先构建（ESM dist 是 React 的依赖）
(cd "frontend/sdk" && npm ci && npm run build)

# 2) React 前端构建 / dev（5175）
(cd "demo/buggy-shop-boot-react/frontend" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-react/frontend" && npm run dev)

# 3) 根 reactor（agent/collector；jar 已存在可跳过）
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package

# 4) 复用后端构建（JDK8；零改动）
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# 5) collector（JDK21，127.0.0.1:8601；先于后端）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"

# 6) 后端 + agent（JDK8；-javaagent/-D 在 -jar 前；session 必须 s_s7react）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s7react \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"

# 7) 工作台（5173；构建后可 dev）
(cd "workbench" && npm ci && npm run build && npm run dev)
```

启动顺序：SDK build → React build → collector → 后端+agent → React dev → workbench。浏览器 5175 点 A/B；工作台 5173 在 `#s3-session` 输入 `s_s7react` 后回车/刷新。会话不一致（默认 `s_s3demo` 或旧会话）视为 FAIL，无 EXACT。端口冲突先诊断，不静默改；5174 属 Vue demo，不动。

## 6. 测试门禁（tester：`tools/verify/verify.mjs` + `S7/test-report.md`）

一次命令 `(cd "tools/verify" && npm ci && node verify.mjs)`；串行启停，`finally` 清理进程/端口/临时文件；非 0 即 FAIL。不新增 fixture；S7-C/D 的 SDK 形状事件内联构造。

### S7-A 构建/工件

- SDK `npm ci && npm run build` exit 0；React `npm ci && npm run build` exit 0；`npm ci` 从 lock 可复现。
- `react`/`react-dom` 解析版本 **18.3.1**；webpack 5、webpack-cli、webpack-dev-server 5；Babel preset-env + preset-react automatic；无 TS/ts-loader。
- lockfile：除 `@traceboard/sdk` 的本地 `file:` 链接外，registry 依赖仅 `registry.npmjs.org`；无 CDN/镜像。
- `webpack.config.js`：`devtool:false`；devServer `port:5175`、`strictPort:true`；proxy 恰两路且目标/`changeOrigin:false` 正确；无 pathRewrite/CORS。
- dist 仅本地 `index.html`/`app.js`（及可选本地样式/许可证文本）：无 `.map` 文件、无 `traceboard-manifest.json` 文件、HTML 无 `__TRACEBOARD_MANIFEST__` 内联赋值、无 `frontend/build-plugin` 引用；HTML 无外链脚本/字体/图片；不把 SDK 内部 `http://localhost/` 兜底基址或 `/traceboard-manifest.json` 字符串当外链（见 §4.2）。
- 5175 预检空闲；dev 启动后 `GET /` 200 且占 5175；strictPort 生效（不漂移）。

### S7-B demo 静态契约

- 后端零 diff、零新端点：`demo/buggy-shop-boot-vue/backend/**` 无改动；`OrderController` 方法/路径/状态码不变；A 仍只调 `POST /api/orders/1/cancel`。
- A：2xx 才显示 `#success-hint` `操作成功` + `uiEffect("操作成功")`；取消处理内无 `loadOrders`/刷新/第二个 fetch；取消不 wrapFn。
- B：`validateForm` 无 fetch/XHR；空/非数字/≤0 → `#b-error` `金额必须大于 0` 且 `RETURNED_FALSE`；有效 → `#b-pass` `校验通过（本案例不提交）`；`wrapFn("validateForm", ...)` 恰一次；`data-tb-fn="validateForm"`；选择器/文案逐字。
- SDK 固定 `sessionId:"s_s7react"`、`appName:"OrderEdit.jsx"`、`ingestUrl:"/ingest"`；依赖 `file:../../../frontend/sdk`；无 `frontend/sdk/src` import；无直连 8601。
- 页面：`public/index.html` 有 `#root`；A/B 选择器齐全；`#order-status` 初值 `CREATED`；无绝对资源 URL/CDN；无 StrictMode；mount GET 只在 effect 一次且不在 click 内。
- B 运行时口径（S7-C/D 复核）：`spanCount=3`、`fetchCount=0`、`hasBackend=false`、`backendSpanCount=0`、`sdkActive=true`，click 根 flags 含 `OBSERVE_MS=1500` 且观察窗已关闭；工作台判定文案逐字。

### S7-C 代理与 EXACT

- 前置：collector 8601 + 后端 JDK8 + agent `s_s7react` + dev 5175 全部健康；`GET 5175/api/orders` 200，订单 1 `CREATED/100.00`。
- `POST 5175/ingest/v1/events`（合法 NDJSON）→ **202**；前端源码/配置无直连 8601，ingest 只经 5175 代理。
- 内联 SDK 形状事件（不新增 fixture）：`ui_event #btn-cancel` + `fetch POST /api/orders/1/cancel` + `render ui_effect:操作成功`（同 `s_s7react`/traceId/clickId；fetch spanId=S；时间区间嵌套），随后经 5175 发 `POST /api/orders/1/cancel`，头 `traceparent: 00-<traceId>-<S>-01` 与 `X-TraceBoard-Click: <clickId>`。
- 断言：请求 200 `{"data":true}`；同 trace **恰 7 span**，`spanCount=7/fetchCount=1/hasFrontend=true/hasBackend=true/backendSpanCount=4`；kinds 恰 `ui_event,fetch,controller,service,mapper,sql,render`；graph **7 节点/6 边/15 字段**；`controller.parentSpanId=S`、`render.parentSpanId=click spanId`；全部 `EXACT`、无 `LOST_BACKEND`；`sql rowsAffected=0`、`transaction=UNKNOWN`；service true、mapper 0；`GET /api/orders` 仍 `CREATED`；无额外后端 span。
- 停 collector 后经 5175 `POST /api/orders/1/cancel` 仍 **200**（fail-open；SDK 上报失败不影响页面/业务）；代理 `/ingest` 失败不改变 A 的后端结果。

### S7-D serving/workbench/SDK 基础

- dev 5175 `GET /` 200、HTML 含 `#root`、脚本为本地 bundle；无外链。
- bundle 含 `s_s7react`、`OrderEdit.jsx`、`#btn-cancel`、`#amount-b`、`#btn-save-b`、`validateForm`、A/B 文案、SDK 标记（`SDK_ACTIVE`/`S3_RUNTIME_SDK`）；不含 TraceBoard build-plugin 注入或内联 manifest 赋值/外链；SDK 自带的 manifest 兜底字符串允许（见 §4.1/§4.2）。
- collector：`s_s7react` 的 requests/graph 形状正确（A 7/6/15；B 3/2/15；15 字段顺序不变）；无新字段/路由/meta 键。C 停 collector 后内存已清空，D 重新起 collector 并以同一内联形状重放（不新增 fixture）。
- workbench `npm run build` 绿；默认板仍 `s_s3demo`、源码零 diff；S3/S5/S6 选择器与文案不变（`#s3-session`/`#s3-refresh`/`#s3-tabs`/`#s3-ops`/`#s3-caseb`/`#s5-values`/`#s6-l2-badge` 等）；`#s3-session` 静态存在并可接受 `s_s7react`；无写请求。

### S7-E 回归/范围/冻结/清理

- 全量运行：S0–S6 既有 **75 PASS / 0 FAIL** 不得减少；追加 S7-A..D 全 PASS；最终 summary `S7 TEST (full S0–S7): PASS`，总计 **80 PASS / 0 FAIL**，exit 0。
- 零 diff：Vue demo 前后端、agent、collector、SDK、build-plugin、workbench 源码；schema/`event-model.v1.md`/`transport.v1.md`/`status-semantics.md` 与 S0–S6 fixture 字节不变。
- 冻结：S7 G1 的 `api.v1.md`/`s7-plan.md`/`dispatch.md` SHA256 零漂移；S6B_G1_FREEZE 14/14、S6A/S5 冻结不漂移（api.v1 由 S7 增补取代，见 §7）。
- 范围：product 源码中 React 仅允许在 `demo/buggy-shop-boot-react/**`；其他树仍禁止 React/Tomcat/WAR/云端/SSE/WS/持久化/像素回放；无新端点/CORS/鉴权/新事件字段/新 fixture。
- 安全：无 secret/PII/CDN/镜像/外网；仅回环；SDK 不采表单值/body/cookie；dist 无 `.map`/manifest 文件。
- 清理：端口 **8080/8601/5173/5174/5175/8602/18080**（及 4173/4174）释放；无残留 java/node；git index 未动；变更集仅在 S7 白名单（新 demo、`docs/plans/stages/S7/`、`docs/contracts/api.v1.md`、`tools/verify/`、`docs/plans/stages/S7/test-report.md`）。
- 静态 dist 只做本地资产断言，不作 A 的通过路径；README/矩阵明示无代理限制。

## 7. S0–S6 回归、迁移与冻结

- **基线**：S6 收尾为 `75 PASS / 0 FAIL`（`S6 TEST (full S0–S6): PASS`）。S7 不删/不跳过任何 S0–S6 断言；全量 = 75 + S7-A..E = **80 PASS**。
- **迁移原则**：只在旧断言的前提被 S7 授权产物**确证取代**时迁移，并在 test-report 逐条记录；禁止放宽阈值、删除检查或用 S7 结果替代旧事实。

| 迁移 | 原因（可证取代） | 做法 |
|---|---|---|
| `LATEST_G1_FREEZE["docs/contracts/api.v1.md"]` 指向 S7 哈希 | api.v1 新增 §2.8/附录 H，是 S7 授权的加性契约 | 仅替换 api.v1 一项；event-model 仍保持 S6b 哈希 |
| S6A-E「api/event-model 等于 S6B」拆分 | api.v1 被 S7 取代，event-model 未被取代 | event-model 仍 = S6B；api.v1 = S7 G1 哈希；其余 S6B 14/14 不变 |
| S6A-E 变更集白名单加入 `demo/buggy-shop-boot-react/`、`docs/plans/stages/S7/` | 新目录是 S7 唯一授权新增 | 仅新增两条前缀；旧路径/旧冻结不变 |
| S5-H/S6A-E 的 React 禁止扫描加入新路径例外 | 旧断言写于 S7 之前，当时 React 整体未授权 | React 仅在新路径允许；其他 product 树仍禁止；不删 marker |
| `S1_PORTS` 加入 5175 | S7 新 dev 端口 | 仅追加；旧端口全部保留并仍须释放 |

- **冻结/字节**：`schema/**`、`event-model.v1.md`、`transport.v1.md`、`status-semantics.md`、S0–S6 fixture 与 S6 G1 冻结清单只读；S7 不新增 fixture，不新增事件字段/枚举/路由。
- **git**：plan-writer 不写 git；tester 不写 git；仅 S7 checkpoint 在验收后提交并打 `s7-baseline`。

## 8. 风险与限制（不阻断，但必须如实标注）

| 风险/限制 | 缓解/口径 |
|---|---|
| Webpack 解析 `file:` SDK ESM 失败或 dist 未构建 | 固定先构建 SDK；`resolve.symlinks:false`；babel-loader 排除 node_modules；失败诊断依赖，不改 SDK |
| devServer 代理丢 `traceparent`/`X-TraceBoard-Click` 或改写 Origin | 同源代理、`changeOrigin:false`、无 rewrite；S7-C 真发头验证 controller.parent=fetch；失败即阻断，不伪造 EXACT |
| React 合成事件/root 委托导致 click 晚于 handler | SDK document capture 先于 React root；避免 stopPropagation/portal/异步；仅配置不可解则 `BLOCKED`，不改 SDK |
| 会话漂移（SDK/agent 默认或旧会话） | 双端固定 `s_s7react`；启动日志/agent 端点复核；工作台手输；不一致 FAIL |
| 案例 B 被「看起来没发」蒙混 | 必须 `sdkActive=true` + `fetchCount=0` + `hasBackend=false` + `OBSERVE_MS` 关闭 + 工作台判定文案 + 浏览器证据；不接受仅静态断言 |
| A 首次请求慢于 1500ms 观察窗，render 可能被 SDK 丢弃（只剩 6 span） | 本地先预热/重试；S7-C 内联事件固定区间；浏览器 A 以正常本地延迟取证；仍失败则诊断并如实记录，不伪造 7 span |
| 页面 mount GET 与 SDK manifest 兜底被误读为「B 发了请求」 | B 的「零请求」只指**本次 click 因果链**（fetchCount=0/hasBackend=false）；mount GET 在 click 外、SDK 不记；ESM 一次 manifest 探测 fail-open、不发事件；mount GET 不产生后端 span（agent 未插桩 list），不得据此伪造 EXACT |
| bundle 含 SDK 自带 manifest 字符串 | 断言「无产出 manifest 文件/无内联 manifest/无 build-plugin 引用」，不是「bundle 无该字符串」；SDK ESM 必须原样消费 |
| 静态 dist 无代理被误当支持路径 | dev 5175 是唯一通过路径；dist 仅证明本地资产；README/矩阵明示需自备同源反代（未验证） |
| 矩阵/工作台夸大（React 完整、可看源码行号/局部） | 契约/README 只写「基础」+四项不可见；工作台不加 React 源码宣称；tester 反向断言无 overclaim |
| 范围蔓延（顺手改 agent/collector/后端/Tomcat） | 路径白名单 + 零 diff + 冻结；React 特有缺口先 `BLOCKED` 取证，交 S8 决定 |
| 依赖下载/CDN/镜像违规 | lock 仅 npmjs；不下载浏览器；无在线字体/脚本；失败上报不换镜像 |

## 9. 验收清单与证据（acceptance）

1. 亲自复跑 `(cd "tools/verify" && npm ci && node verify.mjs)` → 80 PASS/0 FAIL、exit 0。
2. 构建：SDK build、React `npm ci && npm run build`、workbench build 全绿；dist 无 `.map`/manifest/外链。
3. 浏览器 A：起 collector+后端 agent+dev 5175；点 `#btn-cancel`，见 `#success-hint` `操作成功`；`#order-status` 仍 `CREATED`；工作台 s_s7react 选 A 板：7 span/4 后端/EXACT/SQL 0 行。
4. 浏览器 B：输入 `0` 点 `#btn-save-b`，见 `#b-error` `金额必须大于 0`；等 >1500ms；工作台 B 板：fetchCount=0/hasBackend=false/「已确认：本次点击因果链内没有网络请求」。
5. 截图四张（acceptance 写 `docs/plans/stages/S7/evidence/`）：`s7-react-case-a.png`、`s7-workbench-case-a.png`、`s7-react-case-b.png`、`s7-workbench-case-b.png`；自动化门禁与浏览器证据分开写。
6. 矩阵/README：React18+Webpack5 本地=`基础`、云端=暂不支持；四项不可见；P2 完整未交付；无 Tomcat/云端/S8+。
7. `progress.md`/`acceptance.md`/`STAGE-PROGRESS.md`/README/archive/tag `s7-baseline` 由 acceptance 负责；**S7 到此停止，NEXT 写 S8（Tomcat 可选）但不开始**。

## 10. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-24 | 首版：React18+Webpack5 本地基础第二栈；复用 Boot/H2 后端与 `s_s7react`；SDK ESM；代理/案例 A/B；S7-A..E；矩阵只标「基础」。 |