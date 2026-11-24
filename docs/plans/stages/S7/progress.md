# S7 进度（React18 + Webpack5 本地基础第二栈）

> 日期：2026-11-24｜基线：`s6-baseline`（`ba5b4a6` / S6 提交 `be2f7d5`）
> 状态：实现与浏览器 E2E 完成；等待 S7 门禁复跑与 G2 验收
> 权威：`SOLO-PLAN.md` S7 行、`00-master-plan.md` §7.3/§8.1–8.5/§13.3/§14.2、`S7/dispatch.md`、`S7/s7-plan.md`、`S7/plan-review.md`

## 1. 决策与范围

- S7 二选一选择 **React18 + Webpack5 前端**；Tomcat/WAR/SSM 不进入本阶段（S8 候选）。
- 新建 `demo/buggy-shop-boot-react/frontend/`，端口 5175；**复用** `demo/buggy-shop-boot-vue/backend`（Boot 2.7/H2/JDK8），后端零业务改动。
- 会话 `s_s7react` 前后端一致；SDK 消费 `frontend/sdk/dist/index.js` ESM；devServer 同源代理 `/api`→8080、`/ingest`→8601，`changeOrigin=false`。
- 仅基础级：无 React 构建插件、无 sourcemap、无组件映射/JS 源码位置/JS 局部变量/回调内部；静态 dist 无代理。

## 2. 多 agent 流水线

| 角色 | 输出 | 状态 |
|---|---|---|
| task-dispatch | `S7/dispatch.md`（171 行） | ✅ |
| plan-writer | `S7/s7-plan.md`（276 行）、`docs/contracts/api.v1.md` §2.8 + 附录 H（+115 行，历史未改） | ✅ |
| plan-reviewer（G1） | `S7/plan-review.md`（67 行） | ✅ `G1: PASS`（0 blocker，R1–R8） |
| coder-react | `demo/buggy-shop-boot-react/frontend/**` | ✅ 构建绿 |
| tester | `tools/verify/s7-react.mjs` + `S7/test-report.md` | 🟡 生成中 |
| acceptance（G2） | 证据、README、本文件、acceptance、备份、tag | 🟡 本文/证据已就绪，待门禁绿 |

## 3. 实现事实

- `src/traceboard.js`：模块级单次 `initTraceBoard({ingestUrl:"/ingest", sessionId:"s_s7react", appName:"OrderEdit.jsx", observeMs:1500})`。
- 案例 A：`#btn-cancel` → `POST /api/orders/1/cancel` → 2xx `#success-hint=操作成功` + `uiEffect`；不刷新订单；初始 `#order-status` 来自真实 `GET /api/orders`，非硬编码。
- 案例 B：`#amount-b` + `#btn-save-b[data-tb-fn=validateForm]`；`validateForm` 模块级仅 wrap 一次；空/非数字/≤0 → `#b-error=金额必须大于 0`（`RETURNED_FALSE`）；有效 → `#b-pass=校验通过（本案例不提交）`；两个分支零 fetch/XHR。
- Webpack5 + Babel React18；`devtool:false`；产物仅 `dist/app.js`+`dist/index.html`，无 `.map`/manifest；锁文件仅 npmjs + 本地 `file:` SDK。
- WDS5 无 `strictPort` 键：固定 `port:5175` + 数字端口，占用时 EADDRINUSE 退出（编码师已实测）。

## 4. 浏览器 E2E（真实运行）

环境：collector 8601（JDK21）+ 复用后端 8080（JDK8 + agent `s_s7react`）+ React dev 5175 + workbench 5173。
操作：打开 `http://localhost:5175`，点 `#btn-cancel`；输入 `0` 点 `#btn-save-b`；工作台输入 `s_s7react`。

- 案例 A trace `f7a57eaa…`：**7 span，全部 EXACT** = `ui_event #btn-cancel` → `fetch POST /api/orders/1/cancel` → `controller#cancel` → `service#cancel` → `mapper#cancelById` → `sql OrderMapper.cancelById` → `render ui_effect:操作成功`；controller.parent = fetch；SQL `rowsAffected=0`；`#order-status` 仍 CREATED。
- 案例 B trace `eaaa8db8…`：**3 span，全部 EXACT** = `ui_event #btn-save-b` → `js_method OrderEdit.jsx#validateForm RETURNED_FALSE` → `render ui_effect:金额必须大于 0`；`fetchCount=0`、`hasBackend=false`、`sdkActive=true`、`OBSERVE_MS=1500`；工作台显示「已确认：本次点击因果链内没有网络请求」。
- 初始 `GET /api/orders` 在点击窗外，未产生 SDK 事件；collector 总计 10 个事件、2 条 trace。
- 证据：`S7/evidence/s7-react-case-a-b.png`、`s7-workbench-case-a.png`、`s7-workbench-case-b.png`。

## 5. 待完成

1. tester 的 S7-A..E 脚本静态/全量复跑；S0–S6 75 PASS 回归。
2. G2：按证据复核、更新 README/STAGE-PROGRESS、备份 `stage-S7-2026-11-24`、提交与 tag `s7-baseline`。
3. 仍不开始 S8；不宣称 React 完整/Tomcat/云端已做。

## 6. 限制

React 仅本地基础；无构建期函数/行映射；无 JS 局部变量/组件树/回调内部；仅 devServer 代理路径（静态 dist 无代理）；无 CORS/鉴权/云端/持久化；初始 GET 与 SDK manifest 404 探测不参与点击因果链。