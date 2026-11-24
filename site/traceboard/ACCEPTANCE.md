# TraceBoard 公网站点验收

> 日期：2026-11-24｜公开地址：<https://traceboard-32843bp8pzz.qoder.zone>｜访问：**public**
> 站点保留原版介绍风格，并内嵌与本地 `http://127.0.0.1:5173` 相同的工作台静态版；提供全屏入口 `/app/`。

## 1. 发布状态

| 项 | 结果 |
|---|---|
| 发布 | `published:true` |
| 访问策略 | public，无需登录 |
| 首页 | 200 |
| `demo-data.js` | 200 |
| 静态资源 | 200 |
| 运行时 | 纯前端，无 collector / Java / 上传 |

## 2. 公网交互验收

| 检查 | 结果 |
|---|---|
| 首页 | 原版介绍风格（hero、矩阵、边界） |
| 内嵌工作台 | iframe `/app/`，与 5173 相同界面 |
| 全屏入口 | `/app/` 可用 |
| 请求列表 | 7 个内置案例 |
| 树形链路 | 矩形节点、父子连线、主链编号、叶子节点 |
| 节点详情 | 状态、方法、来源、flags、变量/参数 |
| 请求体 | `body.reason/operator/priority/note/token` 原值 |
| 缺口案例 | 无调试信息、未知订单、未接入后端 |
| 时间轴 | 节点关键帧、可点击跳转、0.01× 默认慢放 |
| 控制台 | 无错误 |

## 3. 边界

- 数据为预置快照，不接实时 collector；无 Java、无上传、无数据库写入。
- 站点只展示已采集事实；未采集项显示原因或缺口。
- 本地演示不脱敏；请求体字段按采集值显示。
- S9/S10 云端执行不做。

## 4. 复跑

```bash
node workbench/scripts/export-demo-data.mjs site/traceboard/demo-data.js
# 重新构建工作台并注入 demo-data.js 后，用 Sites prepare/publish 更新
```

## 5. 证据

- `workbench-tree.png`：本地工作台树形界面
- `workbench-request-body.png`：请求体字段与值
- 本文件与 `README.md`：部署方式和边界