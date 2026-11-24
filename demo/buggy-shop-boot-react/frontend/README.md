# BuggyShop · S7 React 18 + Webpack 5 demo（第二栈，本地基础）

TraceBoard S7 的第二栈演示前端：**React 18.3.1 + react-dom 18.3.1 + Webpack 5 + Babel（preset-env / preset-react automatic）**，
消费 `@traceboard/sdk` 已构建的 ESM `dist/index.js`，提供案例 A（取消订单，有请求）与案例 B（纯前端校验，零请求）。

- **后端复用**：直接使用 `demo/buggy-shop-boot-vue/backend`（Spring Boot 2.7 / H2 / JDK8），**零业务改动、零新端点**。
  本目录**没有** `backend/` 子目录，也不复制后端。
- **只支持本地基础案例 A/B**：无 TraceBoard 构建插件、无 sourcemap、无组件映射；看不到 JS 源码文件/行号、JS 局部变量、回调内部逻辑、React 组件树；云端暂不支持；
  主计划 §14.2 的「完整（P2）」**未交付**。不做 Tomcat/WAR/SSM。
- 页面不采集输入值、请求体或 Cookie；只回显 SDK 已声明的 UI 效果与控件身份（`sessionId=s_s7react`、`appName=OrderEdit.jsx`）。

## 目录

| 文件 | 说明 |
|---|---|
| `webpack.config.js` | dev 5175（`strictPort`）、`/api`→8080、`/ingest`→8601（`changeOrigin:false`，不 rewrite）；`devtool:false` |
| `babel.config.js` | `@babel/preset-env`（`modules:false`）+ `@babel/preset-react`（`runtime:"automatic"`） |
| `public/index.html` | `#root` 挂载点；无外链脚本/字体/图片 |
| `src/index.jsx` | 先初始化 SDK（`./traceboard`），再 `createRoot` 渲染 `OrderEdit` |
| `src/traceboard.js` | `initTraceBoard({ingestUrl:"/ingest", sessionId:"s_s7react", appName:"OrderEdit.jsx", observeMs:1500})`，模块级只调用一次 |
| `src/OrderEdit.jsx` | 案例 A/B；挂载时 `GET /api/orders` 展示订单 1 状态；`validateForm` 模块级 `wrapFn` 恰一次 |
| `src/styles.css` | 本地样式，无在线字体/背景 URL |

## 先决条件

- Node.js 22 / npm 10；Git Bash；仓库根目录 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（路径含中文/空格，命令与路径全部用双引号）。
- JDK8：`C:/Program Files/Java/jdk1.8.0_221`（复用后端）；JDK21：`C:/Program Files/Java/jdk-21`（collector/agent）；Maven 3.9.5。
- 仅本机回环；npm 只使用官方 registry（`https://registry.npmjs.org/`），不使用 CDN/镜像。

## SDK 先构建（ESM dist 是依赖）

`@traceboard/sdk` 以 `file:../../../frontend/sdk` 依赖并解析到 `frontend/sdk/dist/index.js`，**必须先构建 SDK**，否则本前端构建会失败：

```bash
(cd "frontend/sdk" && npm ci && npm run build)
```

## 安装与构建

```bash
(cd "demo/buggy-shop-boot-react/frontend" && npm ci && npm run build)
```

- `npm install` 仅用于重新生成 `package-lock.json`；日常使用 `npm ci` 复现。
- 产物只有本地 `dist/app.js` 与 `dist/index.html`（样式内联在 bundle 中）：**没有 `.map`、没有 manifest、无外链资源**。
- 静态 `dist/` **没有** `/api`、`/ingest` 代理，只能证明本地产物；案例 A 的通过路径是 dev 5175。若要让静态产物连后端，需自备同源反向代理（S7 未验证）。

## 启动（Git Bash，仓库根；顺序建议：SDK build → React build → collector → 后端+agent → React dev → workbench）

```bash
# 0) 若根 reactor / 后端 jar 尚未构建（只需一次）
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# 1) collector（JDK21，127.0.0.1:8601；先于后端）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"

# 2) 复用后端 + agent（JDK8；session 必须为 s_s7react）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s7react \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"

# 3) React dev（固定 127.0.0.1:5175，strictPort）
(cd "demo/buggy-shop-boot-react/frontend" && npm run dev)

# 4) 工作台（127.0.0.1:5173；默认板仍为 s_s3demo）
(cd "workbench" && npm ci && npm run build && npm run dev)
```

| 端口 | 用途 |
|---|---|
| 5175 | React dev（`http://127.0.0.1:5175`，同源代理） |
| 8080 | 复用 Boot/H2 demo 后端（经 `/api` 代理访问，浏览器不直连） |
| 8601 | collector（SDK 经 `/ingest` 代理上报，浏览器不直连） |
| 5173 | workbench（`#s3-session` 手输 `s_s7react` 查看同一链） |

会话固定 `s_s7react`（SDK 与 agent 一致）；不一致时工作台看不到同一条链，也没有 EXACT。

## 浏览器验证步骤

打开 `http://127.0.0.1:5175/`（工作台同时打开 `http://127.0.0.1:5173/`）。

**案例 A（有请求，SQL 0 行）**

1. 页面挂载时自动 `GET /api/orders`，`#order-status` 显示订单 1 的真实状态 `CREATED`（不硬编码；GET 失败显示 `加载失败`）。
2. 点击 `#btn-cancel`：只发 `POST /api/orders/1/cancel`；2xx 后显示 `#success-hint`（文本 `操作成功`）并声明 `uiEffect("操作成功")`。
3. 取消后**不自动刷新**，`#order-status` 仍为 `CREATED`（故意缺陷：后端 200 但 UPDATE 影响 0 行）。
4. 工作台 `#s3-session` 输入 `s_s7react` → 回车 → 在 `#s3-ops` 点选对应 trace 行：期望 7 个 span（`ui_event → fetch → controller → service → mapper → sql` + `render`），全 EXACT，SQL `rowsAffected=0`。
5. 前提：fetch + `uiEffect` 须在 1500ms 观察窗内完成；超时导致 `render` 未上报时只能如实看到 6 span，不得伪造 7 span。

**案例 B（纯前端，零请求）**

1. 在 `#amount-b` 输入空、非数字或 `0`，点击 `#btn-save-b`：显示 `#b-error`（文本 `金额必须大于 0`），`validateForm` 返回 false（`RETURNED_FALSE`）。
2. 输入有效正数（如 `100`）再点击：显示 `#b-pass`（文本 `校验通过（本案例不提交）`），仍不发任何请求。
3. 等待 **>1500ms**（观察窗关闭）后，在工作台选中该 trace：期望 3 个 span（`ui_event → js_method → render`），`fetchCount=0`、`hasBackend=false`、`backendSpanCount=0`、`sdkActive=true`，并显示「已确认：本次点击因果链内没有网络请求」。
4. `fetchCount=0` 只指**本次点击因果链**：页面挂载的 `GET /api/orders` 在 click 之外（SDK 不记、agent 未插桩 `list`）；SDK ESM 初始化的一次 `/traceboard-manifest.json` 探测为 fail-open（404 可接受、不发事件）。两者都不算案例 B 的请求。

## 能力与限制（如实）

| 维度 | S7 口径 |
|---|---|
| React 18.3.1 + Webpack 5 + runtime SDK（本地） | **基础** |
| 可见 | 控件/click 根、fetch URL/method/HTTP 状态（不采响应体）、显式 `uiEffect` 的 UI 效果文本；后端 controller/service/mapper/sql 与 SQL `rowsAffected` |
| 不可见 | JS 源码文件/行号、React 组件映射/组件树、JS 局部变量、回调内部逻辑 |
| 构建期 | 无 TraceBoard 构建插件、无 sourcemap、无 AST 插桩；不产出/内联 manifest，`file`/`line` 显示「未采集」 |
| 云端 | 暂不支持 |
| 「完整（P2）」 | 未交付；S7 只证明本地基础案例 A/B |

`appName="OrderEdit.jsx"` 只是 `js_method` 的 nodeKey 前缀（`OrderEdit.jsx#validateForm`），不是源码映射。