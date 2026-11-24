# TraceBoard 阶段进度看板（S0–S10）

> 更新时间：2026-11-24｜最新已验收：S8（`s8-baseline`）｜下一阶段：S9
> 最近门禁：S0–S6 **75 PASS** + S7 **35 PASS** + S8 **18 PASS**；三栈本地矩阵已落
> 权威计划：[SOLO-PLAN.md](SOLO-PLAN.md)、[00-master-plan.md](00-master-plan.md)
> 用途：目标暂停/恢复/换账号后，以本文件 + git tag/阶段备份为准，不依赖聊天上下文。
> 当前分支：`master`｜最新已验收 tag：`s8-baseline`

## 1. 总览

| 阶段 | 内容 | 状态 | 证据 / 产物 |
|---|---|---|---|
| **S0** | 基础与契约：仓库/构建/schema v1/传输/API 草案/0 行 fixture | ✅ 已验收 | tag `s0-baseline`；`docs/plans/stages/S0/`；`docs/plans/archive/stage-S0-2026-11-23/` |
| **S1** | Walking skeleton：NDJSON ingest/查询 + 单方法 agent span + 工作台闭环 | ✅ 已验收 | tag `s1-baseline`；`docs/plans/stages/S1/`；archive `stage-S1-2026-11-23/` |
| **S2** | 0 行事实链：H2/MyBatis 真实缺陷 + 4 span agent + requests/graph + 请求切换 | ✅ 已验收 | tag `s2-baseline`；`docs/plans/stages/S2/`；archive `stage-S2-2026-11-23/` |
| **S3** | 前端事实与回放：runtime SDK + 案例 B 确认没发 + traceparent EXACT + 只读回放 | ✅ 已验收 | tag `s3-baseline`；`docs/plans/stages/S3/`；archive `stage-S3-2026-11-23/` |
| **S4** | 本地接入与详情：launcher IDEA/JAR、preview/SDK 注入、握手诊断、节点详情/×N/缺口 | ✅ 已验收 | tag `s4-baseline`；`docs/plans/stages/S4/`；archive `stage-S4-2026-11-23/`；61/61 PASS；flake 修复 8/8；浏览器详情/×3/缺口 + preview 注入 |
| **S5** | L1 与前端浅层：参数/字段、脱敏/截断、sourcemap、Vite/Vue 浅层、性能基线 | ✅ 已验收 | tag `s5-baseline`；`docs/plans/stages/S5/`；archive `stage-S5-2026-11-23/`；70/70；L1 100→0/脱敏/截断；manifest/source；perf 1.29 WARN |
| **S6** | L2 与异步：行级局部变量、字段写入、异步上下文、×3、预算/循环折叠 | ✅ 已验收 | tag `s6-baseline`；`docs/plans/stages/S6/`；archive `stage-S6-2026-11-24/`；75/75；行级 100→0/×3、ASYNC/no-debug/loop fold、perf 1.037 |
| **S7** | 第二栈：选择 React18/Webpack5 前端（Tomcat 留 S8 候选） | ✅ 已验收 | tag `s7-baseline`；`docs/plans/stages/S7/`；archive `stage-S7-2026-11-24/`；75+35 PASS；A 7 span/B 3 span；基础级 |
| **S8** | 第三栈/矩阵：Tomcat 8.5 + SSM WAR + 本地三栈矩阵 | ✅ 已验收 | tag `s8-baseline`；`docs/plans/stages/S8/`；archive `stage-S8-2026-11-24/`；18 PASS；A 4-span EXACT/0 行；B 零 fetch |
| **S9** | 云端 Boot：上传/沙箱/DB/预览/保留/启动诊断 | ⛔ 阻塞（无容器/云运行时） | `docs/plans/stages/S9/BLOCKED.md`；需 Docker/WSL 或云凭证；不伪造云端 |
| **S10** | 云端 WAR/发布：安全审查、发布/回滚/用户测试 | ⬜ 未开始 | 任务 #34；云端（后置） |

## 2. 多 agent 流水线执行记录

| 阶段 | 任务分发 | 计划书 | G1 审阅 | 编码师（独立路径） | 测试 | G2 验收 | 备份/总结 |
|---|---|---|---|---|---|---|---|
| S0 | ✅ | ✅ | ✅（1 轮返工） | ✅ 后端 + 前端 | ✅ 26/26 | ✅ | ✅ tag `s0-baseline` |
| S1 | ✅ | ✅ | ✅（1 轮返工） | ✅ 后端 + 前端 | ✅ 35/35 | ✅ | ✅ tag `s1-baseline` |
| S2 | ✅ | ✅ | ✅ | ✅ demo/agent + collector + workbench | ✅ 42/42 | ✅（S2-AMD-01） | ✅ tag `s2-baseline` |
| S3 | ✅ | ✅ | ✅ | ✅ SDK/demo + agent + collector + workbench | ✅ 51/51 | ✅ | ✅ tag `s3-baseline` |
| S4 | ✅ | ✅ | ✅（2 轮 + 终验） | ✅ launcher + handshake/collector + SDK + workbench | ✅ **61/61** | ✅ | ✅ tag `s4-baseline` |
| S5 | ✅ | ✅ | ✅（1 轮返工） | ✅ L1 demo/agent + 前端 manifest + collector/workbench values | ✅ **70/70** | ✅ | ✅ tag `s5-baseline` |
| S6 | ✅ | ✅ | ✅ | ✅ L2 ASM + async/no-debug/loop + UI/perf | ✅ **75/75** | ✅ | ✅ tag `s6-baseline` |
| S7 | ✅ | ✅ | ✅（0 blocker，R1–R8） | ✅ coder-react（独立 React 路径；后端/SDK 零改） | ✅ **35/35**（+75 回归） | ✅ | ✅ tag `s7-baseline` |
| S8 | ✅ | ✅ | ✅（独立审阅 + 风险记录） | ✅ SSM WAR（Tomcat/JDK8；agent 零改） | ✅ **18/18**（+75+35 回归） | ✅ | ✅ tag `s8-baseline` |

## 3. 当前验证与质量门

- 一条命令：`cd "tools/verify" && npm ci && node verify.mjs` → 全量 **70 PASS / 0 FAIL**（S0–S5，source-cache 优化后已复跑）。
- S5 已覆盖：demo preview-discount 200/data 0/DB 100；agent values 5（100/[REDACTED len=6]/2048 截断/amount 100→0/return 0）、L1；graph 15 字段；manifest/sourcemap；perf 报告；S0–S4 回归。
- 性能：`node tools/perf/l1-overhead.mjs` → base p50 ~0.985ms/p95 ~1.818ms，agent p50 ~1.271ms/p95 ~2.143ms，**ratio 1.29**（>1.25 目标，WARN；已加 source 缓存，仍如实记录）。
- 已修复缺陷：S4 agent span 冷启动嵌套竞态（8/8）；S5 增加 findSource 方法级缓存（行为不变，perf 仍 WARN）。
- 浏览器证据：S4 `docs/plans/stages/S4/evidence/...`；S5 `docs/plans/stages/S5/evidence/workbench-s5-values.png`（L1 100→0/脱敏/截断）、`workbench-s5-source.png`（App.vue:104 manifest 映射）。
- 端口：8080/8601/8602/5173/5174/18080 均空闲；无遗留 java/node 进程。

## 4. S5 收尾记录

1. ✅ source-cache 后全量复跑 70/70。
2. ✅ 浏览器实测：`#btn-discount` → workbench L1 5 行、100→0、已脱敏、已截断、L1；案例 B/预览 js_method `src/App.vue:104（manifest 映射）`。
3. ✅ G2：更新 README 为 S5，写 `acceptance.md`/`progress.md`，生成 `docs/plans/archive/stage-S5-2026-11-23/`。
4. ✅ 提交 S5 + tag `s5-baseline`；下一阶段 S6（需新分发书）。

## 4.1 S6 收尾记录

1. ✅ S6a：行级 `local 100→0`、×3 逐次 E2E PASS；S6a-only 门禁 PASS。
2. ✅ S6b：async `[100,0,100]` + `ASYNC_INHERITED`；no-debug `NOT_COLLECTED_NO_DEBUG_INFO`/reason/无 values；loop `TRUNCATED` 20 values + `VALUES_CAPPED=82`/`VALUES_TOTAL=102`；L2 perf ratio **1.037**。
3. ✅ 全量 S0–S6 75/75；浏览器 async/no-debug/loop 截图；S6 验收/备份/tag `s6-baseline`。
4. 下一阶段 S7（Tomcat WAR/SSM 或 React/Webpack 二选一；需新分发书）。

## 4.2 S7 收尾记录

1. ✅ 二选一：React18.3.1 + Webpack5 前端基础第二栈；复用 Boot/H2 后端；Tomcat/WAR 未做（S8 候选）。
2. ✅ 案例 A：`#btn-cancel` 经 5175 `/api` 代理 → 7 span 全 EXACT、controller.parent=fetch、SQL 0 行、订单仍 CREATED；案例 B：`validateForm RETURNED_FALSE`、3 span、fetchCount=0。
3. ✅ 回归 75/75 + S7 35/35；浏览器三张证据；G1 PASS；README/API §2.8+附录 H 已更新。
4. ✅ 备份 `docs/plans/archive/stage-S7-2026-11-24/`；tag `s7-baseline`；下一阶段 S8（Tomcat 或第三栈/矩阵，需新分发书）。

## 4.3 S8 收尾记录

1. ✅ 第三栈：Tomcat 8.5.60 + SSM WAR（Spring MVC/MyBatis/H2），同 FQCN 复用 agent 4 点插桩；agent/SDK/collector 零改动。
2. ✅ 后端 A：cancel 200、4 span 全 EXACT、controller.parent=header span、SQL 0 行、订单 CREATED；preview 注入 SDK 后 A 7 事件/B 3 事件零 fetch。
3. ✅ 门禁：S8 18/18；S0–S6 75/75；S7 35/35（E4 迁移允许 S8）。已知限制：JUL manager 开关、无截图、仅本机 8.5/JDK8。
4. ✅ 矩阵 `S8/matrix.md` 三栈+云端未做；备份/tag `s8-baseline`；下一阶段 S9 云端（后置），不开始。

## 5. 恢复方法（目标暂停后）

1. 读本文件 + `SOLO-PLAN.md` 当前阶段行；不要依赖聊天记忆。
2. 查 `git log --oneline --decorate -10` 与 `git tag` 确认最后验收点。
3. 查 `docs/plans/stages/Sx/` 的 `progress.md`、`acceptance.md`、`test-report.md`。
4. 未验收阶段（当前 S9）先完成剩余动作，不跨阶段；验收后才开始 Sx+1。
5. 每个阶段结束：更新本看板 + 新备份 + tag。

## 6. 关键入口

- 总计划：[SOLO-PLAN.md](SOLO-PLAN.md)｜主计划：[00-master-plan.md](00-master-plan.md)｜索引：[README.md](README.md)
- S6 计划/评审/测试：[s6a-plan.md](stages/S6/s6a-plan.md)、[s6b-plan.md](stages/S6/s6b-plan.md)、[test-report.md](stages/S6/test-report.md)
- S7 计划/评审/测试：[s7-plan.md](stages/S7/s7-plan.md)、[plan-review.md](stages/S7/plan-review.md)、[test-report.md](stages/S7/test-report.md)
- S8 计划/矩阵/测试：[s8-plan.md](stages/S8/s8-plan.md)、[matrix.md](stages/S8/matrix.md)、[test-report.md](stages/S8/test-report.md)
- 启动器指南：[docs/guides/local-launcher.md](../guides/local-launcher.md)｜前端浅层插件：[docs/guides/frontend-shallow-plugin.md](../guides/frontend-shallow-plugin.md)
- 阶段备份：`docs/plans/archive/stage-S0...stage-S8`