# TraceBoard 公网站点（原版介绍 + 内嵌工作台）

公开主入口（GitHub Pages，无每日额度）：<https://wdy-501.github.io/TomcatWorkflowDebuggingViewTool/>

备用（Qoder Site）：<https://traceboard-32843bp8pzz.qoder.zone> —— 当前 `access_mode=private`，公网返回 401，且每日访问额度很小。

公网首页保留原版介绍风格（头部、矩阵、边界）；中间内嵌与本地 `http://127.0.0.1:5173` 相同的工作台静态版，
并提供全屏入口 `/app/`。工作台默认进入「交互示例」页签，示例位于 `/app/demo/`；
从 `app/demo-data.js` 读取 10 个预置案例，不依赖 collector、后端或 Java。
可以直接点击 10 个示例按钮、查看树形链路、节点详情、请求体字段、变量、flags、时间轴关键帧和慢放回放。
公网按钮返回浏览器内预置响应，并跳到对应的预置链路，不伪造动态采集；静态模式不会启动 5 秒轮询，也不会向服务器发接口请求。
真实请求与自动定位需要本地启动 5173 + 8080 + 8601。

## 文件

- `dist/`：发布目录（`webDirectory=dist`）
- `dist/index.html` + `dist/assets/`：原版介绍页
- `dist/app/`：工作台构建 + 内置 `/demo/` + `demo-data.js`（10 个案例快照）
- `demo-data.js`：工作台源数据（由 `workbench/scripts/export-demo-data.mjs` 生成）
- `.TraceBoard.qoder.site`：Qoder Site 描述（含当前 publication）
- `overview/`：旧版介绍页备份，不在发布目录中
- `traceboard-site.tar.gz`：当前 dist 便携包

## 重新生成静态示例

```bash
# 1) 本地服务开启并点击全部 10 个按钮，导出案例快照
node workbench/scripts/export-demo-data.mjs site/traceboard/demo-data.js
# 2) 构建 demo + 工作台，组装 dist、注入版本化 demo-data.js
node scripts/build-site.mjs
# 快速复用已构建的 workbench/public/demo
node scripts/build-site.mjs --skip-demo-build
```

发布：GitHub Pages 使用 `.github/workflows/pages.yml` 自动构建并发布 `dist/`；Qoder Site 使用 prepare/publish（`webDirectory=dist`）。

## 边界

- 页面是预置快照，不是实时 collector；不会上传、连接 Java 或写入数据库。
- 页面只显示已采集到的数据；未采集节点显示原因/缺口，不伪造值。
- 请求体来自内置 Demo 的 fetch 节点，本地演示不脱敏。
- S9/S10 云端上传与沙箱按用户确认不做。
- Windows 打包版不包含交互示例；最终 zip 会删除 `workbench/demo` 并断言不存在。
- Qoder 发布状态：内容已发布，但当前 private/401、额度受限；公开分享使用 GitHub Pages。