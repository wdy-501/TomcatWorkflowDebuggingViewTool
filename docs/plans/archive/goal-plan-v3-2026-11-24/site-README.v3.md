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
- 本地源码/预览/工作台：可用；`.TraceBoard.qoder.site` 是设计工作台生成的本地描述符，未发布。
- Qoder Sites 云端：当前账号调用 `prepare_site` 返回 `sites_unavailable`；旧站点属于其他账号，不能迁移。
- **当前账号不再执行发布**；等待用户切换到有 Sites 能力的账号、重启 Qoder 后，用新 action/新 slug 重建。
- GitHub 源码/Release 链接：待用户提供公开仓库 URL 后再启用，不填占位链接。
- 不伪造 `published: true`，不另建第二个站点。

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