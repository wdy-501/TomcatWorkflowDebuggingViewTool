# TraceBoard 新目标提示词 v2（修正版，2026-11-24）

> 取代 v1（备份：`docs/plans/archive/goal-plan-v3-2026-11-24/`）。
> 修正：**现在不做任何 Qoder Sites 部署**；先完成本地全流程 + GitHub 个人项目发布（源码与 Release），计划书完成后再提示用户切换账号部署站点。站点只展示内置程序，项目介绍放真实 GitHub 链接。

## 一、可直接粘贴的目标提示词

```text
继续执行 TraceBoard 项目：D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool。

先读权威文件：README.md、docs/plans/00-master-plan.md、docs/plans/SOLO-PLAN.md、docs/plans/STAGE-PROGRESS.md、docs/plans/SITE-DEPLOY.md、site/traceboard/ACCEPTANCE.md、docs/plans/stages/S9/BLOCKED.md、docs/plans/GOAL-PROMPT-NEXT.md；再查 git tag/log 和实际运行结果，不依赖聊天记忆。

【启动动作】
1. 查 TaskList；复用任务 #50「阶段进度 S0✅ S1✅ S2✅ S3✅ S4✅ S5✅ S6✅ S7✅ S8✅ S9⛔ S10⬜ ｜ 本地✅ GitHub⏳ 公网⏸（最后）」，保持 in_progress 并更新描述。若不存在，按这个 subject 重建；阶段栏必须始终可见。
2. 每个关键门禁/阶段后立即更新任务栏；不能只在聊天里报进度。
3. 不重做 S0–S8；测试迁移需写清证据，不改变已验收行为。

【当前事实】
- S0–S8 已验收：tag s0-baseline…s8-baseline；门禁 75/75、35/35、18/18；三栈本地矩阵已落。
- 本地站点验收 PASS：http://127.0.0.1:5180/；A/B/L2、详情、回放、资产、截图均过；报告 site/traceboard/ACCEPTANCE.md。
- Qoder Sites 只能做静态展示/控制面/轻量 Functions，不能执行 JAR/WAR，也不是强隔离沙箱。
- 当前账号没有可用 Sites 能力；旧账号站点不可迁移。**现在不做任何站点部署**，不调用 prepare_site/publish_site，不伪造公网 URL。
- GitHub 源码/Release、Windows EXE 尚未完成；GitHub 链接必须等真实可访问仓库 URL，禁止占位死链。
- S9 云端 Boot 阻塞：无 Docker/WSL/云凭证；不得伪造。S10 未开始。

【执行顺序（必须按此顺序）】
1. 本地全流程验收：保持现有本地站点、demo/collector/agent/门禁可复跑；确认 A/B/L2、回放、三栈矩阵、本地启动文档和截图。不得引入线上依赖。
2. GitHub 个人项目发布（优先）：
   - 用户提供 GitHub 用户名/仓库/License 后，整理源码仓库：README、LICENSE、SECURITY、.gitignore、CI、Release 工作流、复现步骤。
   - 源码 tag 与 Release 分开；Release 放可运行的 Windows portable zip/EXE + SHA256；不把二进制提交进 git。
   - EXE 的前置：补 launcher 的 ui/静态托管命令；使用 Eclipse Temurin JRE 8/21（不能再分发 Oracle JDK）；便携 zip 优先，安装器 EXE 可选；Windows 未签名需如实说明。
   - GitHub Pages 只作为静态展示兜底；不得把它描述成 Java 运行环境。
   - 仓库可见性：比赛展示默认 public；若坚持 private，公开站点上的 GitHub 链接评委无法访问，必须选择“公开仓库”或“公开站点不放仓库链接/只放公共 Release 下载”，不得伪造可访问链接。
3. 计划书收尾：更新 README、SITE-DEPLOY、STAGE-PROGRESS、GOAL-PROMPT、阶段备份/SUMMARY；完成本地与 GitHub 的复跑记录；确认工作树/端口清理；阶段栏更新。
4. **最后才提示用户切换账号部署站点**：只有计划书完成、用户明确说“已切换账号”后，才按新 action/新 slug/干净目录部署 Qoder Site。站点只展示**内置程序的预置快照**，不做上传/在线 Java/S9；项目介绍放真实 GitHub 链接。失败如实报告，不伪造 published。

【站点边界】
- 站点内容：内置 A/B/L2 trace、架构/矩阵/边界、GitHub 与 Release 链接；预置快照，非实时。
- 不做：用户 JAR/WAR 上传、在线运行、collector 公网暴露、Firecracker/gVisor 声称。
- 当前账号不发布；切换账号前不调用 prepare_site/publish_site，不重试旧账号，不迁移旧站点。
- 站点发布是最后一步，不是当前优先项；不要因 Sites 失败阻塞本地/GitHub 交付。

【多 agent 流程】
任务分发 → 计划书 → G1 独立审阅 → 编码师（独立路径）→ 测试（独立门禁）→ G2 验收 → 备份/总结 → tag/看板。每角色独立；agent 超时/不可用写明“回退主协调器复核”，不伪造证据。测试对照需求，不只看绿色。

【边界/完成审计】
只本机回环；无真实 secret/客户数据；不换 npm/Maven 镜像、不引 CDN/在线字体；公开仓库前查 git 历史无 secret；不改已验收行为。
只有本地全流程、GitHub 源码/Release、计划书/备份都完成，且用户切换账号后站点发布有真实 published:true，才可完成站点交付；S9/S10 未做不得标记完成。先陈述已完成、未完成、下一步。

现在先做：确认 #50 → 复核本地验收 → 准备 GitHub/Release 交付；站点部署保持暂停，等最后用户切换账号后再做。
```

## 二、当前阶段栏（#50 已同步）

```text
阶段进度 S0✅ S1✅ S2✅ S3✅ S4✅ S5✅ S6✅ S7✅ S8✅ S9⛔ S10⬜ ｜ 本地✅ GitHub⏳ 公网⏸（最后）
```

## 三、关键修正点

1. **不再把站点发布当第一优先**；先本地 + GitHub，站点最后。
2. **站点只做内置程序展示**；不上传、不运行 Java、不做 S9。
3. **GitHub 链接只在真实仓库可访问后加**；private 仓库不能放到公开站点致死链。
4. **EXE 需先补 launcher ui + Temurin/jpackage**；没有完成前不宣称已有可运行 EXE。
5. **旧账号站点不迁移**；用户切换账号后新建站点；当前账号不重试。

## 四、备份

- 旧目标提示词 v1：`docs/plans/archive/goal-plan-v3-2026-11-24/GOAL-PROMPT-NEXT.v1.md`
- 旧站点方案 v3：同目录 `SITE-DEPLOY.v3.md`
- 新站点方案 v4：`docs/plans/SITE-DEPLOY.md`