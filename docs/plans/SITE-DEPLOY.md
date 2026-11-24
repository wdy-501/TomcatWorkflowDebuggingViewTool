# TraceBoard 站点与比赛交付方案 v5

> 日期：2026-11-24｜取代 v4（v4 备份在 `docs/plans/archive/` 可恢复）
> **已发布：https://traceboard-32843bp8pzz.qoder.zone（public, published:true）。**
> 站点只展示内置程序的预置快照；项目介绍放真实 GitHub 链接；Qoder Sites 不执行 Java/JAR/WAR。

## 0. 当前状态（v5）

1. **本地全流程**：已完成；本地工作台 5173 含 7 个案例（A/B/L2/请求体/缺口），详情、树形链路、回放均 PASS。
2. **GitHub**：已 public + MIT；Release `v0.1.0` 的 4 个资产已核验。
3. **站点发布**：工作台静态快照版已发布到 `https://traceboard-32843bp8pzz.qoder.zone`，访问策略 public。
4. **交付形态**：原版介绍风格首页 + 内嵌工作台 `/app/`；数据来自 `demo-data.js`，不运行 collector/Java。
5. 后续更新复用现有 Project/Site，使用新 action 发布；不重试旧账号。

## 1. 本地全流程（已完成）

- 本地工作台：`http://127.0.0.1:5173/`；7 个案例、工作台树形链路、详情、回放 PASS。
- 公网组合版：`https://traceboard-32843bp8pzz.qoder.zone`，原版首页 + 内嵌工作台 `/app/`，7 个案例、请求体、缺口、关键帧/慢放，访问 public。
- 报告：`site/traceboard/ACCEPTANCE.md`；截图：`site/traceboard/evidence/`。
- 门禁：S0–S6 75/75、S7 35/35、S8 18/18；tag `s0-baseline`…`s8-baseline`。
- 本地是比赛主演示路径；不依赖 Sites 或公网。
- 请求体案例显示 `body.*` 原值（本地不脱敏）；缺口案例显示未采集原因。

## 2. GitHub 个人项目（下一优先）

### 2.1 仓库

```text
README.md  LICENSE  SECURITY.md  .gitignore  .gitattributes
docs/  agent/  server/  workbench/  frontend/  demo/  site/
scripts/package-windows.ps1
.github/workflows/build.yml  .github/workflows/release.yml
```

- 源码用 tag；GitHub 自动 source zip。
- Release 资产：`TraceBoard-0.1.0-win-x64.zip`（首选）、可选 Setup.exe、`SHA256SUMS.txt`；**不提交二进制**。
- CI 在 windows-latest 构建；Runner 带 JDK8/21；不复用本机 Oracle JDK。
- 公开前检查 git 历史无 secret；demo 假值也复核。
- 已采用 MIT；第三方 NOTICE 保留。

### 2.2 Windows 便携包

- GitHub Release `v0.1.0` 已存在：portable zip、exe zip、双 SHA256（4 资产，已由 GitHub API 核验）。
- 启动/停止：`Run-TraceBoard.cmd` / `Stop-TraceBoard.cmd`；启动 collector 8601、demo 8080、workbench 5173（`ui --collector` 反代 `/api`）；实测 UI/API/agent/demo 均 200，停止后端口释放。
- portable zip 要求本机 JDK8 + JDK21；exe zip 为 Actions/Temurin 自包含构建。
- 已完成：GitHub Release 上传；自包含 EXE 由 Actions/Temurin 构建。
- 本地 Oracle app-image 仅测试，不上传；发布版由 Actions 使用 Temurin 8/21 构建。

### 2.3 GitHub 链接与可见性

- 站点已使用真实 GitHub 源码 / Release 链接；禁止占位死链。
- 仓库已 public；站点链接已启用。

### 2.4 Pages 兜底

**不使用 Pages**：仓库已 public，但比赛展示走 Qoder Site。不重新加入 Pages 工作流；当前没有公网站点 URL。

## 3. 最后一步：Qoder Site（等用户切换账号）

- 触发条件：用户明确“已切换账号”，并完全重启 Qoder、确认 Sites 面板可用。
- 本地准备：`site/traceboard/` 为项目目录，`dist/` 为发布目录，`.TraceBoard.qoder.site` 已初始化；无 publication 字段。
- 用**新 action/新 slug/干净目录**创建新账号站点；不复用旧 project/site/action。
- 站点内容：原版介绍 + 内嵌 5173 工作台（`/app/`，7 案例、请求体、缺口、树形链路）；非实时、无上传、无 Java。
- `prepare_site`（`webDirectory=dist`）→ ready → `publish_site` → `published:true` → Desktop 发布确认 → 交付 URL；失败如实报告。
- 当前账号的 Sites 能力不可用；不重试、不伪造。

## 4. 为什么当前账号站点受阻（事实）

- `prepare_site` 多次 `sites_unavailable`；`get_publish_status` 无 action/草稿；旧站点属于其他账号，账号隔离不可迁移。
- 本地构建/设计工作台/网络均正常，问题在账号/Sites 能力。
- **即使发布，Qoder Sites 也不能执行 Java**；S9/S10 云端执行已按用户确认**不做**。

## 5. 当前资产/未完成

- 本地站与验收、S0–S8 tags/门禁、GitHub public/Release 已完成。
- 未完成：Qoder 公网站点（等账号）；S9/S10 明确不做。
- 源码/站点改动仍在工作树，未自动提交/推送；发布前按需提交。

## 6. 验收清单（比赛）

- [x] 本地 5180 全流程 PASS（5 案例、回放、详情）
- [x] GitHub 仓库可访问、LICENSE、无 secret、源码可复现
- [x] Release 含 portable zip + exe zip + SHA256（GitHub API 已核验）
- [x] 站点介绍使用真实 GitHub/Release URL，不外链死链
- [x] Qoder Site 已发布并公开：https://traceboard-32843bp8pzz.qoder.zone（public, published:true）
- [ ] 明确边界：Sites 不执行 Java；S9/S10 按用户确认不做