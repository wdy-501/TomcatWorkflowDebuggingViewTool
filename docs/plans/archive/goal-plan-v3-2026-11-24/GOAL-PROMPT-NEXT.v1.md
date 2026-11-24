# TraceBoard 新目标提示词（2026-11-24 同步版）

> 用法：把本文件“一、可直接粘贴的目标提示词”整段作为新目标；不要重新创建旧目标。
> 任务栏：先复用/更新任务 #50，保持阶段可视；不要重复 S0–S8。

## 一、可直接粘贴的目标提示词

```text
继续执行 TraceBoard 项目：D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool。
先读权威文件（按顺序）：README.md、docs/plans/00-master-plan.md、docs/plans/SOLO-PLAN.md、docs/plans/STAGE-PROGRESS.md、docs/plans/SITE-DEPLOY.md、site/traceboard/ACCEPTANCE.md、docs/plans/stages/S9/BLOCKED.md；再查 git tag/log。以文件、tag、实际运行结果为准，不依赖聊天记忆。

【启动动作（必须先做）】
1. 查 TaskList；找到任务 #50「阶段进度 S0✅ S1✅ S2✅ S3✅ S4✅ S5✅ S6✅ S7✅ S8✅ S9⛔ S10⬜ ｜ 站点本地✅ 公网⏳」。若存在就更新它、保持 in_progress；若不存在就按这个 subject 重建。不要新建重复的阶段进度任务。
2. 同步更新任务描述：S0–S8 已验收（s0-baseline…s8-baseline）；S9 阻塞；站点本地验收 PASS、等待切换账号发布；S10 未开始。
3. 在后续每个阶段/关键门禁后，立即更新任务栏 subject/description；阶段栏必须一直可见，不能只在聊天里报进度。
4. 不重做 S0–S8，不修改已验收行为；需要迁移测试时，必须有明确证据并记录在阶段文档。

【当前事实（2026-11-24）】
- S0–S8 全验收：tag s0-baseline…s8-baseline；门禁 S0–S6 75/75、S7 35/35、S8 18/18；三栈本地矩阵已落。
- S9 云端 Boot：阻塞。本机无 Docker/WSL/云凭证；不得伪造云端。若用户提供运行时，再按 30 分钟硬超时/强隔离/队列方案实现（参考 S9/BLOCKED.md 与阿里云配置结论）。
- S10 云端 WAR/发布：未开始，依赖 S9；不得把 S9/S10 标成完成。
- 站点 v3：Qoder Sites 只做静态展示/控制面/轻量 Functions，不能执行用户 JAR/WAR，不能当 Firecracker/gVisor 沙箱；当前账号的 Sites 能力不可用，旧账号站点不可迁移。
- 站点本地验收 PASS：http://127.0.0.1:5180/；A/B/L2、详情、回放、资产、截图均过；报告 site/traceboard/ACCEPTANCE.md；当前不在当前账号重试 prepare_site/publish_site。
- 用户已约定：先完成本地验收（已 PASS），用户切换有 Sites 能力的账号并重启 Qoder 后，再做站点发布；切换后必须用新 action/新 slug/干净目录，不复用旧账号 project/site/action。
- GitHub 源码/Release、Windows EXE 尚未完成；GitHub 链接必须等真实公开仓库 URL，禁止占位死链。

【目标与优先顺序】
A. 站点发布（用户切换账号后）：确认 Sites 面板/配额 → 准备干净站点 action（新 actionId/slug，无旧 projectId）→ prepare_site → publish_site → published:true → Desktop show_publish_confirmation → 交付 URL；失败如实报，不伪造。
B. GitHub/Release：在用户提供 GitHub 用户名/仓库/License 后，整理源码仓库、README、LICENSE、CI、Release 工作流；源码 tag 与可运行 Windows portable zip/EXE 分开发布，不把二进制提交进 git；用 Temurin JRE 8/21，不用 Oracle JDK 再分发。EXE 需先补 launcher 的 ui/静态托管命令并做干净机验收；便携 zip 优先。
C. S9 云端 Boot：仅当用户提供 Docker/WSL 或 ACK/ECI 等强隔离运行时；实现上传/校验/队列/30 分钟强制下线/DB seed/preview/retention/diagnose；不能把单机普通进程冒充沙箱。
D. S10 云端 WAR/发布：S9 通过后；安全审查、发布/回滚/用户测试；不跨阶段。
E. 比赛交付：Qoder Site 展示预置快照 + GitHub 源码/Release + 本机或单租户 Live Demo；Live Demo 不接受陌生 JAR，不等于 S9。

【多 agent 流程（每阶段）】
任务分发 → 计划书 → G1 独立审阅 → 编码师（独立路径）→ 测试（独立门禁）→ G2 验收 → 备份/总结 → tag/看板。每个 agent 任务独立、输入输出明确；不能用主协调器假装独立 agent。若 agent 超时/不可用，明确写“回退为主协调器复核”，不伪造 agent 证据。测试不能只信绿色门禁，要对照需求和证据。

【每阶段收尾（强制）】
- 跑实际构建/门禁/E2E；记录 PASS/FAIL/未验证。
- 新备份 docs/plans/archive/stage-Sx-YYYY-MM-DD/（MANIFEST/SUMMARY），更新 docs/plans/STAGE-PROGRESS.md。
- 提交（用户要求时）并打 sX-baseline tag；工作树/端口清理。
- 阶段栏任务 #50 更新后再结束本轮。

【边界与安全】
- 只本机回环测试；不暴露非回环；无真实 secret/客户数据；demo 假值也要复核。
- 不下载第三方镜像、不换 npm/Maven 镜像、不引入 CDN/在线字体；公开仓库前检查 git 历史无 secret。
- Qoder Sites 官方边界：静态/控制面/轻量 Functions；不能运行 Java，不能提供强隔离沙箱。
- 当前账号 Sites 发布失败：先账号/端点排查；未切换成功前不反复新建站点，不伪造 published。
- 完成审计：只有所有显式要求都有实际证据才算完成；S9/S10/公网站点/GitHub Release 未完成时不得调用 UpdateGoal complete；说明已完成、未完成、具体下一步。

现在先做：确认 #50 阶段栏可见 → 检查站点本地验收证据 → 等待/接收用户“已切换账号”后发布；不要重复 S0–S8，不要在当前账号重试发布。
```

## 二、当前阶段栏（新目标启动后复制到任务栏）

```text
阶段进度 S0✅ S1✅ S2✅ S3✅ S4✅ S5✅ S6✅ S7✅ S8✅ S9⛔ S10⬜ ｜ 站点本地✅ 公网⏳
```

- 任务 #50 已更新为上述 subject，保持 `in_progress`。
- 站点发布成功后改为 `站点本地✅ 公网✅`；S9 运行时到位后改为 `S9🟡`，验收后 `S9✅`。

## 三、旧方案备份（已落盘）

- 站点 v1：`docs/plans/archive/site-plan-v1-2026-11-24/`
- 站点 v2：`docs/plans/archive/site-plan-v2-2026-11-24/`
- 新 v3 方案：`docs/plans/SITE-DEPLOY.md`
- 本地验收：`site/traceboard/ACCEPTANCE.md`

## 四、说明

目标提示词保留原 SOLO 全阶段（含 S9/S10 后置），没有把云端标成已完成；用户切换账号后优先站点发布，GitHub/EXE 与 S9 按顺序推进。