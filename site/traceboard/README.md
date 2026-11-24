# TraceBoard 公网站点（原版介绍 + 内嵌工作台）

公开访问：<https://traceboard-32843bp8pzz.qoder.zone>

公网首页保留原版介绍风格（头部、矩阵、边界）；中间内嵌与本地 `http://127.0.0.1:5173` 相同的工作台静态版，
并提供全屏入口 `/app/`。工作台从 `app/demo-data.js` 读取 7 个预置案例，不依赖 collector、后端或 Java；
可以直接切换案例、查看树形链路、节点详情、请求体字段、变量、flags、时间轴关键帧和慢放回放。

## 文件

- `dist/`：发布目录（`webDirectory=dist`）
- `dist/index.html` + `dist/assets/`：原版介绍页
- `dist/app/`：工作台构建 + `demo-data.js`（7 个案例快照）
- `demo-data.js`：工作台源数据（由 `workbench/scripts/export-demo-data.mjs` 生成）
- `.TraceBoard.qoder.site`：Qoder Site 描述（含当前 publication）
- `overview/`：旧版介绍页备份，不在发布目录中
- `traceboard-site.tar.gz`：当前 dist 便携包

## 重新生成静态示例

```bash
# 1) 本地服务开启并产生示例数据
node workbench/scripts/export-demo-data.mjs site/traceboard/demo-data.js
# 2) 构建工作台
(cd workbench && npm run build)
# 3) 复制并注入 demo-data.js（保留 dist 目录，清空旧内容）
# 原版首页复制到 dist 根；工作台复制到 dist/app；注入 demo-data.js
# 在 dist/index.html 的 module script 前加入 <script src="./demo-data.js"></script>
```

随后用 Qoder Site 的 prepare/publish 流程发布 `site/traceboard`（`webDirectory=dist`）。

## 边界

- 页面是预置快照，不是实时 collector；不会上传、连接 Java 或写入数据库。
- 页面只显示已采集到的数据；未采集节点显示原因/缺口，不伪造值。
- 请求体来自内置 Demo 的 fetch 节点，本地演示不脱敏。
- S9/S10 云端上传与沙箱按用户确认不做。
- 发布状态：public，`published:true`。