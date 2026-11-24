# S8 G1 审阅（Tomcat 8.5 + SSM WAR + 矩阵）

> 日期：2026-11-24｜审阅角色：主协调器按 G1 清单执行；独立审阅子代理超时未产出，已明确回退，不冒充独立意见。
> 输入：`S8/dispatch.md`、`S8/s8-plan.md`、`S8/matrix.md`、WAR 源码、`tools/verify/s8-tomcat.mjs`、S8 门禁/回归日志。

## 结论：G1 PASS（有已记录限制）

实现与计划边界一致：Tomcat 8.5/SSM WAR 第三栈、agent 同 FQCN 零改动、案例 A/B、三栈矩阵；未越界到云端/S9+。

## 清单

| # | 项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 第三栈选择/边界 | PASS | dispatch §选择；无 S9+ |
| 2 | WAR 可构建/SSM 依赖 | PASS | pom；S8-B1 BUILD 12.5MB |
| 3 | agent 同 FQCN/零改 | PASS | controller/service/mapper/sql；S8-A6 冻结面 clean |
| 4 | 0 行缺陷 + seed CREATED | PASS | mapper `status='PAID'`、data.sql CREATED、C4 |
| 5 | 4 span EXACT/parent/0 行 | PASS | S8-C2/C3/C4 |
| 6 | 页面 A/B 选择器/文案/零 fetch | PASS | S8-A4；浏览器 A 7 事件/B 3 事件 |
| 7 | preview 注入/API | PASS（手工） | injected 200；`/api/orders` 200；未自动化浏览器 |
| 8 | 矩阵三栈/云端未做 | PASS | matrix §1；S8-A5 |
| 9 | 回归 75+35+18 | PASS | gate/verify/s7 logs |
| 10 | 安全/范围/清理 | PASS | 回环；无 secret/CDN；端口释放；git 仅 S8 |
| 11 | 文档/备份可恢复 | PASS（待落 tag） | dispatch/plan/matrix/progress/test/acceptance；archive |
| 12 | 诚实限制 | PASS | JUL 开关、无截图、B 未存 JSON、仅本机 8.5 |

## 风险/建议（不阻断 S8）

- R1：S8 门禁不自动跑浏览器 A/B；前端证据为手工。**后续**：可加 Playwright/浏览器 CI 或接受手工截图。
- R2：无截图（in-app viewport hidden）；已如实标注。**后续**补拍。
- R3：B trace 未另存 JSON；测试报告有事件列表。**后续**保存 trace 快照。
- R4：Tomcat JUL 死锁靠 JVM 开关规避；agent 未改。**后续**可在 AgentHello 加启动延迟/异步日志隔离，但需 S0–S7 回归迁移。
- R5：仅 Tomcat 8.5/JDK8；matrix 未覆盖 9/10.1、JDK11/17/21。
- R6：S7 gate E4 迁移为“无 S9+”以允许 S8；不是产品变更。
- R7：S8 日志/截图部分未入库；archive 已含 gate/regression 文本。
- R8：静态页 `js_method` appName=traceboard-preview，不可当源码位置。

## 冻结 SHA256

- `docs/plans/stages/S8/dispatch.md`
- `docs/plans/stages/S8/s8-plan.md`
- `docs/plans/stages/S8/matrix.md`

（哈希见 `docs/plans/archive/stage-S8-2026-11-24/MANIFEST.md`，tag `s8-baseline`。）