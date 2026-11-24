# S8 测试报告（Tomcat 8.5 + SSM WAR）

> 日期：2026-11-24｜基线：`s7-baseline`｜被测：`demo/buggy-shop-ssm-war/`、`tools/verify/s8-tomcat.mjs`
> 角色：S8 tester 由主协调器按独立门禁执行；G1 审阅见 `plan-review.md`。

## 1. 结论

- **S8 门禁：18 PASS / 0 FAIL**，末行 `S8 TEST (Tomcat/SSM): PASS`。
- **S0–S6：75 PASS / 0 FAIL**；**S7：35 PASS / 0 FAIL**（S7-E4 迁移为“无 S9+”以允许 S8）。
- 手工浏览器（launcher preview）：案例 A 7 事件全 EXACT；案例 B 3 事件、零 fetch；页面状态/文案正确。
- 已知限制：Tomcat 启动需 JUL manager 开关；无截图证据（in-app browser viewport 不可用），使用事件/网络/结构证据，不伪造图像。

## 2. 复跑命令与结果

```bash
# 构建 + 隔离 CATALINA_BASE + collector + agent + 4-span
(cd "tools/verify" && node s8-tomcat.mjs)
# S8 SUMMARY: 18 PASS / 0 FAIL
# S8 TEST (Tomcat/SSM): PASS

# 回归（S8 前冻结）
(cd "tools/verify" && node verify.mjs)        # 75 PASS
(cd "tools/verify" && node s7-react.mjs)      # 35 PASS（E4 已迁移允许 S8）
```

S8 组覆盖：A1–A6（WAR/SSM/FQCN/0 行/页面/矩阵/冻结面）、B1–B4（Maven WAR、Tomcat 8081、agent hello）、C1–C4（cancel 200、4 span EXACT、parent、SQL 0 行）、E1–E3（端口、范围、无 S9+）。
构建日志：`evidence/s8-ssm-build.log`（BUILD SUCCESS，WAR 12.5MB）；启动/部署日志：`evidence/s8-tomcat-6.log`。

## 3. 浏览器 E2E（launcher preview）

环境：collector 8601 + Tomcat 8081（ROOT.war + agent `s_s8tomcat`）+ preview 8602（注入 SDK）。
- 页面 `http://localhost:8602/`：`X-traceboard-preview: injected`，初始 `#order-status=CREATED`。
- **案例 A**：点击 `#btn-cancel` 后显示 `操作成功`，订单仍 `CREATED`；trace `d1a40453…` **7 事件全 EXACT**：
  `ui_event #btn-cancel` → `fetch POST /api/orders/1/cancel` → `controller#cancel` → `service#cancel` → `mapper#cancelById` → `sql OrderMapper.cancelById` → `render ui_effect:操作成功`；
  controller.parent = fetch；SQL `rowsAffected=0`。
- **案例 B**：`#amount-b=0` 点击 `#btn-save-b`，显示 `金额必须大于 0`；trace `52f16185…` **3 事件**：
  `ui_event #btn-save-b` → `js_method traceboard-preview#validateForm` → `render ui_effect:金额必须大于 0`；零 fetch、零后端。
- 手工 header 直连（无 SDK）trace `cccccccc…`：4 后端 span 全 EXACT，SQL 0，订单 CREATED；用于 S8-C。
- 事件证据：`evidence/s8-events-partial.json`（含手工 4-span + SDK A 的 11 个事件；B 的 3 事件见本报告，未另存 JSON）。
- 截图：`s8-tomcat-case-a-b.png` 未生成（in-app browser visibility=hidden）；不使用替代图。

## 4. 兼容性与限制

- Tomcat 8.5.60/JDK8/WAR，ROOT 上下文；仅本机。
- agent 源码零改动；同 FQCN 复用 4 点插桩。Tomcat 启动必须加 `-Djava.util.logging.manager=java.util.logging.LogManager` 规避 agent hello/JULI 死锁（已在门禁和手工验证）。
- 页面经 preview 注入 SDK；`js_method` appName 为 `traceboard-preview`，无源码行列/组件映射；静态页直接访问时无 SDK。
- 无 L1/L2/异步新采集；无 Tomas 9/10.1、云端 WAR、CI 矩阵。
- S8 门禁不自动执行浏览器 A/B（无 Playwright/浏览器下载）；S8-D 前端注入/API 以手工证据记录，S8 门禁只覆盖构建/部署/后端 EXACT/清理。