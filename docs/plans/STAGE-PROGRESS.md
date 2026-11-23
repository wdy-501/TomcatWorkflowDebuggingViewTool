# TraceBoard 阶段进度看板（S0–S10）

> 更新时间：2026-11-23｜最近复核：全量 `node verify.mjs` = **61 PASS / 0 FAIL**（`S4 TEST (full S0–S4): PASS`）
> 权威计划：[SOLO-PLAN.md](SOLO-PLAN.md)、[00-master-plan.md](00-master-plan.md)
> 用途：目标暂停/恢复后，以本文件 + git tag/阶段备份为准，不依赖聊天上下文。
> 当前分支：`master`｜最新已验收 tag：`s4-baseline`｜下一阶段：S5

## 1. 总览

| 阶段 | 内容 | 状态 | 证据 / 产物 |
|---|---|---|---|
| **S0** | 基础与契约：仓库/构建/schema v1/传输/API 草案/0 行 fixture | ✅ 已验收 | tag `s0-baseline`；`docs/plans/stages/S0/`；`docs/plans/archive/stage-S0-2026-11-23/` |
| **S1** | Walking skeleton：NDJSON ingest/查询 + 单方法 agent span + 工作台闭环 | ✅ 已验收 | tag `s1-baseline`；`docs/plans/stages/S1/`；archive `stage-S1-2026-11-23/` |
| **S2** | 0 行事实链：H2/MyBatis 真实缺陷 + 4 span agent + requests/graph + 请求切换 | ✅ 已验收 | tag `s2-baseline`；`docs/plans/stages/S2/`；archive `stage-S2-2026-11-23/` |
| **S3** | 前端事实与回放：runtime SDK + 案例 B 确认没发 + traceparent EXACT + 只读回放 | ✅ 已验收 | tag `s3-baseline`；`docs/plans/stages/S3/`；archive `stage-S3-2026-11-23/` |
| **S4** | 本地接入与详情：launcher IDEA/JAR、preview/SDK 注入、握手诊断、节点详情/×N/缺口 | ✅ 已验收 | tag `s4-baseline`；`docs/plans/stages/S4/`；archive `stage-S4-2026-11-23/`；61/61 PASS；flake 修复 8/8；浏览器详情/×3/缺口 + preview 注入 |
| **S5** | L1 与前端浅层：参数/字段、脱敏/截断、sourcemap、Vite/Vue 浅层、性能基线 | ⬜ 未开始 | 任务 #29；MVP 收尾 |
| **S6** | L2 与异步：行级局部变量、字段写入、异步上下文、×3、预算/循环折叠 | ⬜ 未开始 | 任务 #30；V1 |
| **S7** | 第二栈：Tomcat WAR/SSM 或 React/Webpack 二选一 | ⬜ 未开始 | 任务 #31；扩展 |
| **S8** | 第三栈/矩阵：另一栈 + 本地矩阵/兼容报告 | ⬜ 未开始 | 任务 #32；扩展 |
| **S9** | 云端 Boot：上传/隔离/DB/预览/保留/启动诊断 | ⬜ 未开始 | 任务 #33；云端（后置） |
| **S10** | 云端 WAR/发布：安全审查、发布/回滚/用户测试 | ⬜ 未开始 | 任务 #34；云端（后置） |

## 2. 多 agent 流水线执行记录

| 阶段 | 任务分发 | 计划书 | G1 审阅 | 编码师（独立路径） | 测试 | G2 验收 | 备份/总结 |
|---|---|---|---|---|---|---|---|
| S0 | ✅ | ✅ | ✅（1 轮返工） | ✅ 后端 + 前端 | ✅ 26/26 | ✅ | ✅ tag `s0-baseline` |
| S1 | ✅ | ✅ | ✅（1 轮返工） | ✅ 后端 + 前端 | ✅ 35/35 | ✅ | ✅ tag `s1-baseline` |
| S2 | ✅ | ✅ | ✅ | ✅ demo/agent + collector + workbench | ✅ 42/42 | ✅（S2-AMD-01） | ✅ tag `s2-baseline` |
| S3 | ✅ | ✅ | ✅ | ✅ SDK/demo + agent + collector + workbench | ✅ 51/51 | ✅ | ✅ tag `s3-baseline` |
| S4 | ✅ | ✅ | ✅（2 轮 + 终验） | ✅ launcher + handshake/collector + SDK + workbench | ✅ **61/61** | ✅ | ✅ tag `s4-baseline` |

## 3. 当前验证与质量门

- 一条命令：`cd "tools/verify" && npm ci && node verify.mjs` → **61 PASS / 0 FAIL**，`S4 TEST (full S0–S4): PASS`，exit 0。
- 覆盖：S0 契约/fixture；S1 ingest/查询/单 span；S2 真实 H2 0 行 + 4 span + DB 不变；S3 SDK/案例 B/EXACT 关联/replay 0 写；S4 launcher/预览注入/握手/详情×N/缺口/诊断/回归。
- 已修复缺陷：agent span 冷启动嵌套竞态（`startNs` 与 `durNs` 时钟口径不一致；修复后 `work/flake-nesting.mjs` 8/8 冷启动通过，全量 61/61）。详见 `docs/plans/stages/S4/test-report.md` §8。
- 浏览器证据：`docs/plans/stages/S4/evidence/workbench-s4-details.png`（×3/逐次调用/缺口）、`preview-injection.png`（注入 SDK 实际执行并发事件）。
- 端口：8080/8601/8602/5173/5174/18080 均空闲；无遗留 java/node 进程。

## 4. S4 收尾记录

1. ✅ 浏览器实测：session `s_s4detail` 查看 ×3 聚合、逐次调用、节点详情、SQL/UI 页签、3 条缺口。
2. ✅ preview 注入实测：`window.TraceBoardSDK` active/version 0.1.0，注入点击事件进入 collector `s_s4preview`。
3. ✅ G2：复跑 61/61，更新根 README 为 S4，写 `acceptance.md`/`progress.md`，生成 `docs/plans/archive/stage-S4-2026-11-23/`。
4. ✅ 提交 S4 改动 + tag `s4-baseline`；下一阶段 S5（需新分发书）。

## 5. 恢复方法（目标暂停后）

1. 读本文件 + `SOLO-PLAN.md` 当前阶段行；不要依赖聊天记忆。
2. 查 `git log --oneline --decorate -10` 与 `git tag` 确认最后验收点。
3. 查 `docs/plans/stages/Sx/` 的 `progress.md`、`acceptance.md`、`test-report.md`。
4. 未验收阶段（当前 S4）先完成剩余动作，不跨阶段；验收后才开始 Sx+1。
5. 每个阶段结束：更新本看板 + 新备份 + tag。

## 6. 关键入口

- 总计划：[SOLO-PLAN.md](SOLO-PLAN.md)｜主计划：[00-master-plan.md](00-master-plan.md)｜索引：[README.md](README.md)
- S4 计划/评审/测试：[s4-plan.md](stages/S4/s4-plan.md)、[plan-review.md](stages/S4/plan-review.md)、[test-report.md](stages/S4/test-report.md)
- 启动器指南：[docs/guides/local-launcher.md](../guides/local-launcher.md)
- 阶段备份：`docs/plans/archive/stage-S0...stage-S3`（S4 待生成）