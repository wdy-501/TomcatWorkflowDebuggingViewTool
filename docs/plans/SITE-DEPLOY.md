# TraceBoard 站点与比赛交付方案 v4

> 日期：2026-11-24｜取代 v3（备份：`docs/plans/archive/goal-plan-v3-2026-11-24/SITE-DEPLOY.v3.md`）
> **当前不做站点部署。先本地全流程 + GitHub 个人项目发布；计划书完成后再提示用户切换账号部署站点。**
> 站点只展示内置程序的预置快照；项目介绍放真实 GitHub 链接；Qoder Sites 不执行 Java/JAR/WAR。

## 0. 执行顺序（强约束）

1. **本地全流程**：本地站点 5180、A/B/L2、回放、三栈矩阵、门禁与截图；已 PASS，保持可复跑。
2. **GitHub 个人项目**：源码仓库 + README/LICENSE/CI + Release（源码 zip、Windows portable zip/EXE、SHA256）；不把二进制提交进 git。
3. **计划书收尾**：更新 README、本方案、STAGE-PROGRESS、目标提示词、备份/SUMMARY；完整复跑记录。
4. **最后**：计划书完成后，提示用户切换账号；用户明确“已切换”后，才部署 Qoder Site。站点仅展示内置程序，不接上传/在线 Java。
5. 当前账号**不调用** `prepare_site`/`publish_site`，不重试旧账号，不伪造公网 URL。

## 1. 本地全流程（已完成）

- 本地站：`http://127.0.0.1:5180/`；A/B/L2、详情、回放、资产、截图 PASS。
- 报告：`site/traceboard/ACCEPTANCE.md`；截图：`site/traceboard/evidence/`。
- 门禁：S0–S6 75/75、S7 35/35、S8 18/18；tag `s0-baseline`…`s8-baseline`。
- 本地是比赛主演示路径；不依赖 Sites 或公网。

## 2. GitHub 个人项目（下一优先）

### 2.1 仓库

```text
README.md  LICENSE  SECURITY.md  .gitignore  .gitattributes
docs/  agent/  server/  workbench/  frontend/  demo/  site/
scripts/package-windows.ps1
.github/workflows/build.yml  .github/workflows/release.yml  .github/workflows/pages.yml
```

- 源码用 tag；GitHub 自动 source zip。
- Release 资产：`TraceBoard-0.1.0-win-x64.zip`（首选）、可选 Setup.exe、`SHA256SUMS.txt`；**不提交二进制**。
- CI 在 windows-latest 构建；Runner 带 JDK8/21；不复用本机 Oracle JDK。
- 公开前检查 git 历史无 secret；demo 假值也复核。
- 许可证由用户选（MIT/Apache-2.0）；第三方 NOTICE 保留。

### 2.2 Windows 便携包

- 已构建本地 portable zip：`dist/release/TraceBoard-0.1.0-win-x64-portable.zip`；SHA256 记录在 `docs/plans/RELEASE-UI-SMOKE.md`。
- 启动/停止：`Run-TraceBoard.cmd` / `Stop-TraceBoard.cmd`；启动 collector 8601、demo 8080、workbench 5173（`ui --collector` 反代 `/api`）；实测 UI/API/agent/demo 均 200，停止后端口释放。
- 要求本机 JDK8 + JDK21；不是自包含 EXE，也不是免 JDK。
- 仍缺：GitHub Release 上传；自包含 EXE（Temurin 8/21 + jpackage/包装）；干净 Windows 验收。
- 本地 app-image 已用 `scripts/package-exe.ps1` 冒烟：`TraceBoard.exe` 启动三服务、UI/API 200；但当前依赖系统 JDK8/21，且含本机 Oracle runtime，**不可作为发布 EXE**。需 Temurin 捆绑后重验。

### 2.3 GitHub 链接与可见性

- 只有真实可访问 URL 才加到站点；禁止占位死链。
- **private 仓库不能放到公开站点**（评委打不开）：比赛默认 public；若必须 private，站点不放仓库链接，或只放公共 Release 下载页并说明权限。
- 站点项目介绍中的 GitHub 链接只在发布后启用。

### 2.4 Pages 兜底

**已移除**：GitHub 仓库是 private，Pages 工作流 build 失败、deploy 跳过；不再触发。若以后改为 public 且账号支持 Pages，再单独加静态工作流；当前没有公网 URL，也不把私有仓库链接放到公开站点。

## 3. 最后一步：Qoder Site（等用户切换账号）

- 触发条件：本地 + GitHub + 计划书全部完成，且用户明确“已切换账号”。
- 用**新 action/新 slug/干净目录**创建当前账号站点；不复用旧 project/site/action。
- 站点内容仅：内置 A/B/L2 预置快照、架构/矩阵/边界、GitHub/Release 链接；非实时、无上传、无 Java。
- `prepare_site` → ready → `publish_site` → `published:true` → Desktop 发布确认 → 交付 URL；失败如实报告。
- 当前账号的 Sites 能力不可用；不重试、不伪造。

## 4. 为什么当前账号站点受阻（事实）

- `prepare_site` 多次 `sites_unavailable`；`get_publish_status` 无 action/草稿；旧站点属于其他账号，账号隔离不可迁移。
- 本地构建/设计工作台/网络均正常，问题在账号/Sites 能力。
- **即使发布，Qoder Sites 也不能执行 Java**；S9 云端沙箱是独立后置能力。

## 5. 当前资产/未完成

- 本地站与验收、S0–S8 tags/门禁、Pages 工作流（未提交）已完成。
- 未完成：GitHub 远端/README/LICENSE/CI/Release、Windows EXE、Qoder 公网站点、S9/S10。
- 工作树有站点方案/验收/工作流的未提交变更；按用户指示再提交，不自动推送。

## 6. 验收清单（比赛）

- [ ] 本地 5180 全流程 PASS（已完成）
- [ ] GitHub 仓库可访问、LICENSE、无 secret、源码可复现
- [ ] Release 含源码 zip + Windows 包 + SHA256，干净 Windows 跑通
- [ ] 站点介绍在真实 GitHub URL 可用后再加入，不外链死链
- [ ] 最后账号切换后 Qoder Site 仅内置展示并 `published:true`（未做）
- [ ] 明确边界：Sites 不执行 Java；S9/S10 未完成