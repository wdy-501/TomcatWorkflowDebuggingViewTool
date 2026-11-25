# TraceBoard 公网站点验收

> 日期：2026-11-25｜公开主入口：<https://wdy-501.github.io/TomcatWorkflowDebuggingViewTool/>｜访问：**public**
> Qoder 备用：<https://traceboard-32843bp8pzz.qoder.zone>（当前 private/401，额度受限）
> 站点保留原版介绍风格，并内嵌与本地 `http://127.0.0.1:5173` 相同的工作台静态版；提供全屏入口 `/app/`。

## 1. 发布状态

| 项 | 结果 |
|---|---|
| GitHub Pages | 已部署，根路径与 `/app/` 均 200 |
| Qoder 发布 | 内容 `published:true`；当前 `access_mode=private`，公网 401 |
| Qoder 访问额度 | 24h PV 1344 / UV 8；单日额度很小，公开分发不可靠 |
| 首页 | 200（GitHub Pages） |
| `demo-data.js` | 200 |
| 静态资源 | 200 |
| 运行时 | 纯前端，无 collector / Java / 上传 |
| 静态模式轮询 | 已关闭；示例页签激活时 12 秒实测 0 次后台轮询 |
| 交互示例 | `/app/demo/index.html?static=1`，10 个按钮全部返回预置响应 |
| 打包版 | 无「交互示例」页签，`workbench/demo` 已删除并断言不存在 |

## 2. 公网交互验收

| 检查 | 结果 |
|---|---|
| 首页 | 原版介绍风格（hero、矩阵、边界） |
| 内嵌工作台 | iframe `/app/`，与 5173 相同界面 |
| 全屏入口 | `/app/` 可用 |
| 请求列表 | 10 个内置案例（A/B/L1/C/3 缺口/L2/异步/循环） |
| 交互示例 | 默认页签；点击任意按钮跳到对应预置链路；无 `/api`、`/ingest` 外发请求 |
| 树形链路 | 矩形节点、父子连线、主链编号、叶子节点 |
| 节点详情 | 状态、方法、来源、flags、变量/参数 |
| 请求体 | `body.reason/operator/priority/note/token` 原值 |
| 缺口案例 | 无调试信息、未知订单、未接入后端 |
| 时间轴 | 节点关键帧、可点击跳转、0.01× 默认慢放 |
| 控制台 | 无错误 |

## 3. 边界

- 公网示例按钮的 HTTP 响应是浏览器内预置模拟；链路来自已采集快照，不动态生成。
- 数据为预置快照，不接实时 collector；无 Java、无上传、无数据库写入。
- 站点只展示已采集事实；未采集项显示原因或缺口。
- 本地演示不脱敏；请求体字段按采集值显示。
- 本地真实请求走 5173 的 `/demo/api` → 8080 与 `/demo/ingest` → 8601；Windows 打包版不含示例。
- S9/S10 云端执行不做。

## 4. 复跑

```bash
node workbench/scripts/export-demo-data.mjs site/traceboard/demo-data.js
node scripts/build-site.mjs
# 之后用 GitHub Pages workflow 或 Sites prepare/publish 更新
```

## 5. 证据

- `workbench-tree.png`：本地工作台树形界面
- `workbench-request-body.png`：请求体字段与值
- 本文件与 `README.md`：部署方式和边界