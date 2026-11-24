# S8 进度（Tomcat 8.5 + SSM WAR + 三栈矩阵）

> 日期：2026-11-24｜基线：`s7-baseline`（`6dcae7a`）｜状态：实现/浏览器/门禁已过；G1/验收进行中
> 权威：`SOLO-PLAN.md` S8、`S8/dispatch.md`、`S8/s8-plan.md`、`S8/matrix.md`

## 1. 范围与决策

- 第三栈选择 **Tomcat 8.5.60 + Spring MVC + MyBatis（SSM）WAR**；JDK8；复用 agent 同 FQCN，agent 源码零改动。
- 新目录 `demo/buggy-shop-ssm-war/`；ROOT.war + 端口 8081；H2 seed + 0 行 cancel 缺陷；静态页案例 A/B。
- 前端事实经 launcher preview 注入 SDK（8602）；后端事实经 agent（session `s_s8tomcat`）。
- 矩阵：Boot/Vue（S0–S6）、Boot/React（S7）、Tomcat/SSM（S8）；云端未做；不宣称完整 P2。

## 2. 多 agent 流水线

| 角色 | 输出 | 状态 |
|---|---|---|
| task-dispatch | `S8/dispatch.md` | ✅ |
| plan-writer | `S8/s8-plan.md`、`S8/matrix.md` | ✅ |
| G1 reviewer | `S8/plan-review.md` | ✅ 主协调器回退复核（独立子代理超时，已记录） |
| coder | `demo/buggy-shop-ssm-war/**` | ✅ 构建/部署 |
| tester | `tools/verify/s8-tomcat.mjs`、`test-report.md` | ✅ 18/18（主协调器复跑） |
| acceptance | `acceptance.md`、evidence、备份、README/STAGE、tag | 🟡 |

## 3. 已实现事实

- WAR：Spring MVC 5.3.39 + MyBatis 3.5.19/2.1.2 + H2 2.1.214 + Jackson 2.13，JDK8；Servlet 3.1；`ROOT.war`。
- 同 FQCN：`OrderController#cancel(long)`、`OrderService#cancel(long)`、`OrderMapper#cancelById`、`PreparedStatementHandler#update`，agent 4 span。
- 0 行缺陷：mapper `WHERE status='PAID'`，seed `CREATED`，service 忽略行数；GET 仍 CREATED。
- 页面：`#btn-cancel/#order-status/#success-hint`、`#amount-b/#btn-save-b/#data-tb-fn/#b-error/#b-pass`；A 成功文案 `操作成功`；B `金额必须大于 0`；无 fetch。
- 兼容：Tomcat 需 `-Djava.util.logging.manager=java.util.logging.LogManager`（agent hello/JULI 死锁）；已在门禁固定。

## 4. 验证

- S8 gate：**18 PASS / 0 FAIL**（构建、Tomcat、hello、4 span EXACT、parent、SQL 0、端口/范围）。
- S0–S6：**75 PASS**；S7：**35 PASS**（E4 迁移允许 S8）。
- 浏览器：A 7 事件 EXACT；B 3 事件零 fetch；页面/网络/事件证据见 `test-report.md`。
- 截图未采集（浏览器不可见），如实记录，不用替代图。

## 5. 待完成

1. G1 独立审阅结论落盘（若有 blocker 需修复/重新复跑）。
2. `acceptance.md`、README/STAGE 更新、`stage-S8-2026-11-24` 备份、commit + tag `s8-baseline`。
3. 不开始 S9；云端/WAR 上传仍后置。

## 6. 限制

Tomcat 8.5/JDK8 本机；SSM 只做案例 A/B；无 L1/L2/异步/源码映射；静态页需 preview 注入；无 CI 矩阵/云端 WAR；截图缺失。