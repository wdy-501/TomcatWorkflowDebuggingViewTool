# S8 阶段备份摘要（Tomcat 8.5 + SSM WAR + 三栈矩阵）

> 日期：2026-11-24｜阶段：S8｜tag：`s8-baseline`｜基线：`s7-baseline`
> 权威：`docs/plans/stages/S8/{dispatch,s8-plan,matrix,plan-review,progress,test-report,acceptance}.md`

## 1. 交付

- 第三栈：`demo/buggy-shop-ssm-war/`（Spring MVC 5.3 + MyBatis 3.5 + H2，JDK8，ROOT.war，Tomcat 8.5.60/8081）。
- 同 FQCN 复用 agent 4 点插桩（controller/service/mapper/sql），agent 源码零改动；session `s_s8tomcat`。
- 案例 A：cancel 200、4 后端 span 全 EXACT、controller.parent=header span、SQL 0 行、订单 CREATED。
- 案例 B：preview 注入 SDK，3 事件、零 fetch、`金额必须大于 0`。
- 矩阵：Boot/Vue（S0–S6）✅、Boot/React（S7）基础、Tomcat/SSM（S8）基础、云端未做。
- 已知：Tomcat 启动需 `-Djava.util.logging.manager=java.util.logging.LogManager`；仅本机 8.5/JDK8；静态页需 preview；无截图。

## 2. 验证

- `node tools/verify/s8-tomcat.mjs`：18 PASS / 0 FAIL，`S8 TEST (Tomcat/SSM): PASS`。
- `node tools/verify/verify.mjs`：75 PASS（S0–S6）。
- `node tools/verify/s7-react.mjs`：35 PASS（E4 迁移允许 S8）。
- 浏览器：A trace 7 事件 EXACT；B 3 事件；构造 header 4 span EXACT/0 行。

## 3. 限制

- 无自动浏览器 A/B（手工证据）；无截图；B 事件未另存 JSON。
- 无 L1/L2/异步、无 Tomcat 9/10.1、无云端 WAR/CI 矩阵。
- `js_method` appName=traceboard-preview，不是源码行列。
- S8 门禁只覆盖构建/部署/后端 EXACT；前端注入以手工证据记录。

## 4. 下一步

S9 云端 Boot（上传/沙箱/DB/预览/保留/诊断）；需新分发书与安全门禁，本阶段不开始。