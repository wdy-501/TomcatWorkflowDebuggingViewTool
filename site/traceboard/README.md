# TraceBoard 站点（预置快照演示）

单页、无构建、无外部依赖的 TraceBoard 交互演示。

> 交付边界（v2）：Qoder Sites 只承载展示/静态资源/轻量 Functions，**不运行 Java JAR/WAR**。
> 真实运行留在本地或单租户 Live Demo；S9 多租户沙箱后置。完整方案见 `docs/plans/SITE-DEPLOY.md`。

## 本地预览

```bash
(cd "site/traceboard" && python -m http.server 5180 --bind 127.0.0.1)
# http://127.0.0.1:5180/
```

交互：切换案例 A/B/L2、点击事实节点看详情、拖动/播放回放；案例 B 明确显示 fetchCount=0。
数据为 S6/S7/S8 验收快照，**不是实时 collector**；云端上传/沙箱未实现，不宣称线上服务。

## 发布/GitHub 状态

- **本地验收 PASS**：A/B/L2、详情、回放、资产、截图均通过；报告 `ACCEPTANCE.md`，证据 `evidence/`。
- **GitHub 已 public**：<https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool>（MIT）。
- **Release v0.1.0 已实际存在**：4 个资产（portable zip、exe zip、双 SHA256）：
  <https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool/releases/tag/v0.1.0>
- 站点介绍已加入 GitHub 源码 / Windows 包链接；本地复验通过。
- **Qoder Site 仍未部署**：按约定最后一步；当前账号切换后再用新 action/slug 发布。
- 私有 Pages 失败工作流已删除；不重加。
- 不伪造 `published: true`，不另建 Qoder 站点。

## 文件

- `index.html`：页面与 Nudge 变量消费入口
- `assets/styles.css`：暗色仪表盘样式、响应式、reduced-motion
- `assets/app.js`：三案例数据、事实树、详情、回放
- `dist/`：准备发布的静态产物（`webDirectory=dist`）
- `traceboard-site.tar.gz`：可直接上传任意静态托管的便携包

## GitHub Pages

**已移除**：当前 GitHub 仓库是 private，Pages 工作流在私有仓库/账号能力下失败（deploy 跳过），不应继续触发。
如果以后改为 public 并确认 Pages 可用，再单独加入静态工作流；当前没有公网 URL，也不把私有仓库链接放到公开站点。