# TraceBoard 站点与比赛交付方案 v3

> 日期：2026-11-24｜取代 v1/v2（备份：`docs/plans/archive/site-plan-v1-2026-11-24/`、`site-plan-v2-2026-11-24/`）
> 结论：**Qoder Sites 只做展示/控制面；本地验收已 PASS；当前账号不发布；等待用户切换有 Sites 能力的账号后再部署。**
> 本地验收报告：`site/traceboard/ACCEPTANCE.md`｜本地地址：`http://127.0.0.1:5180/`

## 0. 当前执行流程（v3）

1. **L1 本地验收（已完成 PASS）**：静态站 200、A/B/L2 切换、详情、回放、无外部依赖、源码=dist；截图在 `site/traceboard/evidence/`。
2. **L2 账号切换（等待用户）**：当前账号的 Sites 能力不可用；用户切到有 Sites 的账号，完全退出/重登并重启 Qoder。
3. **L3 部署（切换后才做）**：确认 Sites 面板/配额；使用**干净目录/新 action/新 slug** 发布，不复用旧账号 project/site/action；`published: true` 后才交付公网 URL。
4. **不提前发布**：当前账号不再调用 `prepare_site`/`publish_site`；不伪造公网 URL。

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
- 备用公网路径：`.github/workflows/pages.yml` 已就绪（静态 `index.html`+`assets` → GitHub Pages；无需 Node/Java），尚未提交/推送，也没有公网 URL。启用条件：公开仓库（或支持私有 Pages 的账号）+ Pages Source 选 GitHub Actions。

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

1. **当前账号的 Sites 能力不可用**：`prepare_site` 重试 5 次均 `sites_unavailable`；`get_publish_status` 返回 `sites_action_unavailable`，没有草稿/Deployment。旧站点属于曾使用的另一个账号，站点/项目按账号隔离，不能直接迁移。
2. **不是本地构建问题**：`site/traceboard/dist` 本地 200，A/B/L2 交互与截图 PASS；设计工作台已注册；`list_sites` 可读；网络端点可达。
3. **不是缺 actionId/设计文件**：设计描述符已生成；服务端在准备阶段拒绝当前账号，未进入上传/发布。
4. **即使发布成功，也不是 Java 后端**：Qoder Sites 官方能力只覆盖静态/控制面/轻量 Functions；不能运行用户 JAR/WAR，也没有强隔离沙箱。
5. **因此分两件事**：账号/Sites 能力（等待用户切换）；Java 云端执行（S9 独立运行时，后置）。不能互相替代，也不能伪造公网 URL。

## 6. 当前资产

- 本地站点：`http://127.0.0.1:5180/`（运行中；启动命令见 `site/traceboard/README.md`）。
- 本地验收：`site/traceboard/ACCEPTANCE.md`（A/B/L2、回放、资产、截图均 PASS）。
- 静态包：`site/traceboard/traceboard-site.tar.gz`（可直接上传任意静态托管）。
- 源码提交：站点 `3523b05`；v2/v1 方案备份在 `docs/plans/archive/`。
- 未完成：Qoder 公网 URL、GitHub 远端/Release、Windows EXE、S9 沙箱。

## 7. 下一步

1. **等待用户切换账号**：登出当前账号 → 登录有 Sites 的账号 → 完全重启 Qoder；确认侧栏 Sites/配额可用。
2. **切换后部署**：备份/移除当前 `.TraceBoard.qoder.site`，用干净目录或新 action/新 slug 创建**当前账号的新站点**；不复用旧 project/site/action。
3. **发布验收**：`prepare_site` → ready → `publish_site` → `published: true`；打开 Desktop 发布确认并交付 URL。
4. **备用公网**：若 Sites 短时间不可用，提交 `.github/workflows/pages.yml` 并在仓库启用 Pages；验证 `https://<user>.github.io/<repo>/` 后再加到站点链接。
5. **再往下**：GitHub 源码/Release 链接、Windows 便携包；S9 需 Docker/ACK/ECI，另立阶段。

## 8. 比赛验收清单

- [ ] 站点可访问（或明确本地/视频回退），标注预置快照非实时
- [ ] GitHub 仓库公开、LICENSE、无 secret、源码可构建
- [ ] Release 包含源码 zip、可运行 Windows 包、SHA256；干净机器跑通
- [ ] 5 分钟演示：A 0 行 → B 零请求 → L2 100→0 → 三栈矩阵
- [ ] 明确边界：Qoder Sites 不执行 Java；S9 云端沙箱未做
- [ ] 断网备份：本地环境 + 录屏/截图