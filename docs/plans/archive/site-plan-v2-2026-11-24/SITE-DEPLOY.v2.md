# TraceBoard 站点与比赛交付方案 v2

> 日期：2026-11-24｜取代 v1（备份：`docs/plans/archive/site-plan-v1-2026-11-24/`）
> 结论：**Qoder Sites 只做展示/控制面；Java 运行留在本机或单租户 Live Demo；GitHub 负责源码与 Release；S9 云端沙箱后置。**

## 1. 官方边界（不能违反）

- Qoder Sites 可承载：静态文件、前端工作台、项目/会话元数据/上传记录等轻量 Functions、文档。
- Qoder Sites **不能**承载：用户 Spring Boot JAR/Tomcat WAR 的 `java -jar`、Firecracker/gVisor 强隔离、多租户 30 分钟任务执行。
- 所以比赛方案不能把“上传任意 JAR 并在线运行”当成 Qoder Site 能力；那是 S9 的独立云端沙箱，当前无运行时，标后置。
- 站点演示的 trace 是**预置采集快照**，不是实时 collector；必须明确标注。

## 2. 三层交付

| 层 | 放什么 | 不做什么 |
|---|---|---|
| **Qoder Site（公网展示/控制面）** | 落地页、A/B/L2 交互 trace、架构/矩阵/门禁证据、GitHub 与 Release 链接、Live Demo 入口/预约 | 不上传/运行 Java；不冒充实时接入；不展示虚构云端成功 |
| **GitHub（源码与发布）** | 源码 tag、README、LICENSE、CI、源码 zip、Release 便携包/EXE、SHA256 | 不把 EXE/大二进制提交进 git；不放 secret/真实客户数据 |
| **Live Demo（真实运行）** | 笔记本或单租户 ECS；预置 demo JAR + agent + collector + workbench | 不接收陌生用户 JAR；不作为 S9 多租户沙箱；不承诺公网 SLA |

### 2.1 Qoder Site

- 首页优先展示“事实浏览器”，不是营销 Hero：案例 A（200 但 SQL 0 行）、案例 B（fetchCount=0）、L2（100→0）。
- 固定文案：`预置快照 · 非实时 · 无上传`。
- 增加两个 CTA（有真实 URL 后再显示）：
  - `GitHub 源码` → `https://github.com/<user>/<repo>`
  - `下载 Windows 便携版` → `.../releases/latest`
- Live Demo 按钮只指向本机/单租户环境；没有可用公网 demo 时显示“现场演示/视频”，不放死链。
- 发布状态：本地 5180 可用；Qoder 云端 `prepare_site` 受阻（见 §5）。**在拿到公网 URL 前不得写“已发布”。**

### 2.2 GitHub 开源仓库

最低结构：

```text
README.md（源码构建 + Release 使用 + 边界）
LICENSE（MIT 或 Apache-2.0，需用户确认）
SECURITY.md  CONTRIBUTING.md  .gitignore  .gitattributes
docs/  agent/  server/  workbench/  frontend/  demo/  site/
scripts/package-windows.ps1
.github/workflows/build.yml
.github/workflows/release.yml
```

发布规则：
- 源码：tag（如 `v0.1.0`）+ GitHub 自动 source zip。
- Release 资产：`TraceBoard-0.1.0-win-x64.zip`（首选）、可选 `Setup.exe`、`SHA256SUMS.txt`。
- **不提交** `target/`、`node_modules/`、`dist/`、`work/`、`.qoder.site`、EXE/zip 到 git。
- 公开前检查 git 历史无 secret；当前 demo 的 `s3cr3t` 是假演示值，仍需全仓复核。
- 第三方许可：Bundle 用 **Eclipse Temurin JRE 8/21**，不得再分发本机 Oracle JDK；保留 NOTICE/第三方许可。
- Windows EXE 未签名会触发 SmartScreen；比赛文档如实说明，不伪造签名。

### 2.3 Live Demo

首选 **比赛笔记本本机**：现有 collector + demo + workbench，断网也能演示。
需要远程评委点击时：

| 项 | 配置 |
|---|---|
| ECS | 4C/8G，100GB ESSD，Docker，Nginx/Caddy |
| 并发 | 1–2 个演示会话 |
| 内容 | 只预置现成 demo JAR；不接受用户上传 |
| 时限 | 30 分钟自动重置；无需复杂排队 |
| 暴露 | 仅反代 + 一次性 token/口令；应用端口不公网 |
| 边界 | 这是“单租户演示”，不是 S9 多租户沙箱 |

多用户 30 分钟排队、ACK/ECI、强隔离属于 S9 产品化，不作为比赛门槛。

## 3. GitHub 链接放置

- 站点顶栏/页脚：`GitHub`、`Releases`，`target="_blank"`、`rel="noopener"`。
- README：Release/License/CI 徽章 + “源码未构建”与“下载可运行包”两段。
- 只有在仓库/Release 实际公开后启用；当前没有 GitHub 用户名/远端，**不填占位 URL**。
- 用户需提供：GitHub 用户名、仓库名、License 选择（MIT/Apache-2.0）。

## 4. Windows EXE 方案（未构建，需后续实现）

TraceBoard 是多进程工具，不是单 JAR：

```text
TraceBoard.exe（jpackage app-image 启动器）
runtime/jre21/（collector/launcher）
runtime/jre8/（Boot demo）
app/ agent/collector/launcher jars
demo/ workbench/ config/ LICENSE
```

前置缺口：
1. launcher 还没有 `ui`/静态托管命令；需补一个本地静态服务器与启动/健康检查/退出清理。
2. 需要 Temurin 8/21 JRE、jpackage；安装器 EXE 还需 WiX，便携 zip 不需要。
3. 先做 `TraceBoard-0.1.0-win-x64.zip` + `start-traceboard.cmd`；EXE 是启动器，不是把所有服务变成单进程。
4. CI 在 windows-latest 构建；Release 资产附 SHA256；不把产物提交进仓库。

## 5. 为什么站点创建受阻（事实）

1. **Qoder Sites 云端准备服务不可用**：同一 action/输入重试 5 次，`prepare_site` 均返回 `sites_unavailable`；`get_publish_status` 返回 `sites_action_unavailable`，没有生成草稿/Deployment。
2. **不是本地构建问题**：`site/traceboard/dist` 可本地 200，`open_design_workbench` 已注册并 completed，`list_sites` 可读，`openapi.qoder.com.cn`/`api.qoder.com.cn` 网络可达（HTTP 404 根路径，<0.3s）。
3. **不是缺 actionId/设计文件**：设计描述符已生成；服务端在“准备阶段”就不可用，未进入上传/发布。
4. **即使发布成功，也不是 Java 后端**：Qoder Sites 官方能力只覆盖静态/控制面/轻量 Functions；不能把用户 JAR/WAR 放到站点里执行，也没有强隔离沙箱。
5. **因此有两个独立问题**：站点发布服务/账号能力不可用；Java 云端执行需要 S9 的独立运行时。不能互相替代，也不能伪造公网 URL。

## 6. 当前资产

- 本地站点：`http://127.0.0.1:5180/`（运行中；启动命令见 `site/traceboard/README.md`）。
- 静态包：`site/traceboard/traceboard-site.tar.gz`（可直接上传任意静态托管）。
- 源码提交：站点 `3523b05`；发布受阻记录更新至本文件。
- 未完成：Qoder 公网 URL、GitHub 远端/Release、Windows EXE、S9 沙箱。

## 7. 下一步

1. **P0** 恢复 Qoder Sites 能力 → 同站点重试 `prepare_site`/`publish_site`；仍失败则明确报告。
2. **P1** 用户给 GitHub 用户名/仓库/License → 加源码仓库、Release 工作流、站点 GitHub/Release 按钮（无死链）。
3. **P2** 补 launcher `ui` + jpackage 便携包，在干净 Windows 上验收 `TraceBoard.exe`/start 脚本。
4. **P3** 若有 Docker/ACK/ECI，再做 S9 30 分钟队列沙箱；否则保持后置。

## 8. 比赛验收清单

- [ ] 站点可访问（或明确本地/视频回退），标注预置快照非实时
- [ ] GitHub 仓库公开、LICENSE、无 secret、源码可构建
- [ ] Release 包含源码 zip、可运行 Windows 包、SHA256；干净机器跑通
- [ ] 5 分钟演示：A 0 行 → B 零请求 → L2 100→0 → 三栈矩阵
- [ ] 明确边界：Qoder Sites 不执行 Java；S9 云端沙箱未做
- [ ] 断网备份：本地环境 + 录屏/截图