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
- **当前不做 Qoder Site 发布**：先完成本地 + GitHub 个人项目（源码/Release/EXE），计划书完成后再由用户切换账号部署站点。
- GitHub 链接：只在真实可访问仓库 URL 存在后加入；**private 仓库不能放到公开站点**（评委打不开），比赛默认 public；禁止占位死链。
- GitHub Pages 工作流 `.github/workflows/pages.yml` 已准备（未提交/未推送），只做静态快照兜底。
- 站点最终只展示内置程序的预置快照，不上传、不运行 Java、不做 S9。
- 不伪造 `published: true`，不另建 Qoder 站点。

## 文件

- `index.html`：页面与 Nudge 变量消费入口
- `assets/styles.css`：暗色仪表盘样式、响应式、reduced-motion
- `assets/app.js`：三案例数据、事实树、详情、回放
- `dist/`：准备发布的静态产物（`webDirectory=dist`）
- `traceboard-site.tar.gz`：可直接上传任意静态托管的便携包

## GitHub Pages 备用发布

`.github/workflows/pages.yml` 会把 `site/traceboard/` 的 `index.html` + `assets/` 发布到 GitHub Pages，
无需 Node/Java，也不执行 collector。适合 Qoder Sites 账号未开通时的公网展示兜底。

使用条件：仓库为公开（或账号支持私有 Pages）；推送后：
1. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
2. 运行 `pages` workflow。
3. 地址：`https://<user>.github.io/<repo>/`。

仍然只展示**预置快照**；Live Java 走本机/单租户 ECS；GitHub Release 单独放在 Releases，不提交二进制进 git。