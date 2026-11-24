# S7 阶段备份摘要（React18 + Webpack5 本地基础第二栈）

> 日期：2026-11-24｜阶段：S7｜验收 tag：`s7-baseline`
> 基线：`s6-baseline`｜实现提交：`e882507`、`0b91c2d`、`74e7e70`
> 权威：`docs/plans/stages/S7/{dispatch,s7-plan,plan-review,progress,test-report,acceptance}.md`

## 1. 交付

- 第二栈二选一：**React18.3.1 + Webpack5 + Babel**，新建 `demo/buggy-shop-boot-react/frontend/`（后端复用 Boot/H2，零业务改动）。
- 案例 A：`#btn-cancel` → 5175 `/api` 代理 → controller/service/mapper/sql 4 span；前端 click/fetch + render 共 7 span 全 EXACT；SQL `rowsAffected=0`；订单仍 CREATED；toast `操作成功`。
- 案例 B：`#amount-b=0` → `validateForm` `RETURNED_FALSE`；3 span；`fetchCount=0`；工作台「已确认：本次点击因果链内没有网络请求」。
- SDK 消费已构建 ESM；`sessionId=s_s7react`、`appName=OrderEdit.jsx`、`/ingest` 代理；`/api`/`/ingest` 均 `changeOrigin=false`。
- 契约：`api.v1.md` §2.8 + 附录 H；支持矩阵 React 本地=`基础`，云端/源码映射/JS 局部变量/构建插件均未交付。
- 门禁：`tools/verify/s7-react.mjs` 35 项（A 7 / B 8 / C 11 / D 2 / E 7）；S0–S6 冻结回归 75 项不变。

## 2. 验证

- `(cd "tools/verify" && node verify.mjs)` → **75 PASS / 0 FAIL**，`S6 TEST (full S0–S6): PASS`。
- `(cd "tools/verify" && node s7-react.mjs)` → **35 PASS / 0 FAIL**，`S7 TEST (React18/Webpack5): PASS`。
- 浏览器：A `f7a57eaa…` 7 span/EXACT/0 行；B `eaaa8db8…` 3 span/零 fetch；初始 GET 与 manifest 404 不入点击 trace。
- 证据：`evidence/s7-react-case-a-b.png`、`s7-workbench-case-a.png`、`s7-workbench-case-b.png`。

## 3. 限制

- React 仅本地基础；无构建插件/sourcemap/组件映射/JS 源码行号/JS 局部变量/回调内部。
- 仅 devServer 代理路径；静态 dist 无代理；未做 React 生产发布。
- 无 Tomcat/WAR/SSM、云端、SSE/WS、持久化；S8+ 未开始。
- tester 子代理超时，测试复跑由主协调器接管（报告中已如实记录）。

## 4. 下一步

S8：Tomcat WAR/SSM 或第三栈/本地矩阵；需新分发书。开始前先读 `docs/plans/STAGE-PROGRESS.md` 与 tag `s7-baseline`。