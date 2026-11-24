# S8 验收（G2 · Tomcat 8.5 + SSM WAR + 三栈矩阵）

> 日期：2026-11-24｜基线：`s7-baseline`｜tag：`s8-baseline`
> 依据：`SOLO-PLAN.md` S8、`S8/dispatch.md`、`S8/s8-plan.md`、`S8/matrix.md`、`S8/test-report.md`、`S8/plan-review.md`（G1 复核；独立子代理超时回退，已记录）

## 1. 结论：PASS（有明确限制）

第三栈 **Tomcat 8.5.60 + SSM WAR** 本地跑通案例 A/B；三栈矩阵有运行证据；S0–S7 无回归。

| 门 | 结果 | 证据 |
|---|---|---|
| 分发/计划/矩阵 | ✅ | dispatch、s8-plan、matrix；Tomcat/SSM 选择明确 |
| G1 | ✅（风险记录） | `plan-review.md`：缺失截图/浏览器自动化、JUL 开关、日志未入库等如实记录 |
| 编码 | ✅ | WAR 12.5MB，Spring MVC/MyBatis/H2，同 FQCN；agent 源码零改 |
| S8 门禁 | ✅ 18/18 | `node s8-tomcat.mjs` → PASS（构建/Tomcat/hello/4 span EXACT/0 行/清理） |
| S0–S6 回归 | ✅ 75/75 | `node verify.mjs` → `S6 TEST (full S0–S6): PASS` |
| S7 回归 | ✅ 35/35 | `node s7-react.mjs` → PASS（E4 迁移允许 S8） |
| 浏览器 A | ✅ | preview 注入；A 7 事件全 EXACT、SQL 0、订单 CREATED、`操作成功` |
| 浏览器 B | ✅ | 3 事件、`traceboard-preview#validateForm`、零 fetch、`金额必须大于 0` |
| 矩阵/安全 | ✅ | 三栈 + 云端未做；回环 only；无 secret/CDN/agent 改动；无 S9+ |
| 备份/tag | ✅ | `docs/plans/archive/stage-S8-2026-11-24/`；tag `s8-baseline` |

## 2. 证据

- 门禁：`work/s8-gate2.log`（未入库工作日志）；`docs/plans/stages/S8/test-report.md`。
- 事件：`evidence/s8-events-partial.json`（手工 header 4 span + SDK A 的 11 事件；B 3 事件见测试报告）。
- 启动/构建：`evidence/s8-tomcat-6.log`、`evidence/s8-ssm-build.log`（若 `.gitignore` 忽略，以测试报告与门禁复跑为准）。
- 浏览器截图：**未采集**（in-app browser visibility=hidden）；不伪造、不以静态图替代。

## 3. 明确偏差/限制

1. S8 门禁不自动执行浏览器 A/B；前端注入/API 为手工证据，后端 EXACT 为自动门禁。
2. Tomcat 启动必须加 `-Djava.util.logging.manager=java.util.logging.LogManager`；这是本机实测规避 agent hello/JULI 启动死锁的开关，未改 agent。
3. `js_method` appName 为 `traceboard-preview`（preview 注入固定），不是源码行列；静态页无构建插件/sourcemap。
4. B 事件未另存 JSON；A/B 无截图；S8 `evidence/*.log` 可能因 `.gitignore` 未入库。
5. S7 `s7-react.mjs` E4 从“无 S8”迁移为“无 S9+”，使 S8 存在时 S7 回归仍可执行；不改变 S7 产品能力。
6. 仅 Tomcat 8.5/JDK8 本机，无 9/10.1、无云端 WAR、无 CI 矩阵；无 L1/L2/异步。

## 4. 下一步

S9 云端 Boot（上传/沙箱/DB/预览/保留/启动诊断），云端后置且需新分发书/安全门禁；本阶段不开始。恢复以 `STAGE-PROGRESS.md` + tag `s8-baseline` 为准。