# TraceBoard 阶段进度看板（S0–S10）

> 更新时间：2026-11-24｜最新已验收：S8（`s8-baseline`）｜S9/S10：不做（用户确认仅内置展示）｜下一交付：GitHub Release + 最后 Qoder Site 静态展示
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
| **S9** | 云端 Boot 上传/沙箱/DB/预览/保留/诊断 | ⏸ **不做**（用户确认无上传，仅内置展示） | 不实现；无用户 JAR/WAR、无云端执行 |
| **S10** | 云端 WAR/发布/安全/回滚/用户测试 | ⏸ **不做**（依赖 S9） | 不实现；站点仅静态展示 |

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
4. ✅ 矩阵 `S8/matrix.md` 三栈+云端未做；备份/tag `s8-baseline`；S9/S10 按用户确认**不做**（仅内置展示）。

## 4.4 交付/发布状态（非阶段验收）

> 2026-11-24｜源码/本地/GitHub 发布准备

- 私有源码仓库：已切换 public；`wdy-501/TomcatWorkflowDebuggingViewTool`，MIT；`master` 已同步，`s0–s8` tags + `v0.1.0`。
- GitHub Release `v0.1.0` 已验证：portable zip / exe zip / 双 SHA256 共 4 资产，public。
- 本地站点：`http://127.0.0.1:5180/`，A/B/L2/回放/资产/截图 PASS；已加 GitHub/Release 链接；`site/traceboard/ACCEPTANCE.md`。
- Windows portable zip：本地构建/启动/停止实测；app-image EXE 本地构建/启动 3 服务实测；发布版为 Actions Temurin 构建。
- 阻塞：Qoder Site 未部署（等用户切换有 Sites 能力的账号）；当前账号不重试。
- S9/S10 按用户确认不做；站点只静态展示内置程序。

## 4.5 工作台摘要化 UI（2026-11-24，待用户审查）

- 反馈：信息过密、看不出请求从哪里开始。
- 改动：起点横幅 + 主链摘要 + 请求卡精简 + **自上而下矩形树（父节点在上、子节点/叶子在下、树形连线、主链编号、可只看主链）** + 右侧详情按需显示；控件名称、后端方法链（悬停根目录路径）、请求时间/耗时已加入；**时间轴每个节点一个可点击关键帧（点击进入回放并选中节点）**；**回放超慢档 0.0001×–4×，默认 0.01×，按真实帧间隔推进**；**Demo 新增 JSON 请求体接口，SDK 采集 query/body 字段（本地不脱敏，仅截断），工作台显示请求参数与请求体**；**Demo 新增无调试/未知订单/未接入后端三个采集缺口演示**；**flags 增加中文 tooltip 与标记说明**。最终上线界面已移除 S0/S1/S2 历史面板（仅 `?legacy=1` 调试入口保留）。
- 验证：`npm run build` PASS；50 个 S3/S4/S5/S6 静态门禁 token 仍存在；默认 DOM 无 S0/S1/S2 面板；真实浏览器 A/B/L1/回放 PASS；控制台无错误。
- 证据：`docs/plans/stages/S3/evidence/workbench-production.png`、`workbench-summary-case-{a,b}.png`、`...-l1.png`；总结 `docs/plans/stages/S3/ui-summary-2026-11-24.md`；备份 `docs/plans/archive/ui-summary-2026-11-24/`。
- 状态：本地三服务运行中（5174/5173/8080/8601/5180），会话 `s_s3demo` 保留 A/B/L1 各一条；等待用户审查，未提交/未发布。

## 4.6 站点发布准备（2026-11-24）

- 静态站升级为 5 个案例：A、B、L2、请求体、采集缺口；本地浏览器验证 PASS。
- 发布产物：`site/traceboard/dist/`（index + assets）、`traceboard-site.tar.gz`。
- 本地 Qoder Site 描述：`site/traceboard/.TraceBoard.qoder.site`（仅 design，无 publication）。
- 已切换到有 Sites 能力的账号并发布：`https://traceboard-32843bp8pzz.qoder.zone`，`published:true`，访问策略 public。站点为原版介绍风格首页 + 内嵌 5173 工作台 `/app/`（7 案例、请求体、缺口、树形链路、关键帧/慢放），public。
- 源码/站点改动仍在工作树，未自动提交/推送；发布前按需提交。

## 4.7 5173 内置交互示例（2026-11-25）

- 5173 成为唯一入口：顶部「交互示例 / 追踪台」，默认交互示例；Demo 构建到 `workbench/public/demo`，由 `/demo/` 提供。
- 本地代理：`/demo/api` → 8080，`/demo/ingest` → 8601；10 个按钮均生成真实 trace，工作台自动定位。
- 公网：`/app/demo/index.html?static=1`，浏览器内预置响应 + `demo-data.js` 的 10 个 cases；不产生 `/api`/`/ingest` 外发请求，不伪造动态 trace。
- 构建：`node scripts/build-site.mjs`（demo → workbench dist-site → app + 版本化 demo-data）；Pages workflow 已接入。
- 打包：`workbench/dist-packaged` + `.env.packaged`；`package-windows.ps1`/`package-exe.ps1` 删除并断言无 `workbench/demo`。
- 验收：本地 10/10 自动定位；公网 10/10 预置链路；打包版无示例页签；静态页 0 次接口请求。
- 5174 不再是产品运行必需端口（仅旧测试/可选 dev server）。

## 5. 恢复方法（目标暂停后）

1. 读本文件 + `SOLO-PLAN.md` 当前阶段行；不要依赖聊天记忆。
2. 查 `git log --oneline --decorate -10` 与 `git tag` 确认最后验收点。
3. 查 `docs/plans/stages/Sx/` 的 `progress.md`、`acceptance.md`、`test-report.md`。
4. 当前交付（GitHub Release / Qoder Site 静态展示）先完成剩余动作；S9/S10 不做。
5. 每个阶段结束：更新本看板 + 新备份 + tag。

## 6. 关键入口

- 总计划：[SOLO-PLAN.md](SOLO-PLAN.md)｜主计划：[00-master-plan.md](00-master-plan.md)｜索引：[README.md](README.md)
- S6 计划/评审/测试：[s6a-plan.md](stages/S6/s6a-plan.md)、[s6b-plan.md](stages/S6/s6b-plan.md)、[test-report.md](stages/S6/test-report.md)
- S7 计划/评审/测试：[s7-plan.md](stages/S7/s7-plan.md)、[plan-review.md](stages/S7/plan-review.md)、[test-report.md](stages/S7/test-report.md)
- S8 计划/矩阵/测试：[s8-plan.md](stages/S8/s8-plan.md)、[matrix.md](stages/S8/matrix.md)、[test-report.md](stages/S8/test-report.md)
- 站点/比赛交付方案：[SITE-DEPLOY.md](SITE-DEPLOY.md)（Qoder Sites 只做展示/控制面；GitHub 源码/Release；Live Demo 本地/单租户）
- 启动器指南：[docs/guides/local-launcher.md](../guides/local-launcher.md)｜前端浅层插件：[docs/guides/frontend-shallow-plugin.md](../guides/frontend-shallow-plugin.md)
- 阶段备份：`docs/plans/archive/stage-S0...stage-S8`
