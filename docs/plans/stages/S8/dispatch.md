# S8 第三栈 + 本地矩阵 · 分发书

> 阶段：S8｜角色：task-dispatch｜日期：2026-11-24｜基线：`s7-baseline`（`6dcae7a`）
> 权威：`SOLO-PLAN.md` S8（另一条栈；本地矩阵；性能/兼容报告）、主计划 §2 P2/§14.2/§7.3。
> 选择：**Tomcat 8.5.60 + Spring MVC + MyBatis（SSM）WAR**，补齐 S7 未做的第三栈。**不做云端/S9+。**

## 1. 目标与验收

1. 新 `demo/buggy-shop-ssm-war/` WAR（JDK8）可构建、部署到本机 Tomcat 8.5，**复用 agent 同包 FQCN**：
   `OrderController#cancel(long)` / `OrderService#cancel(long)` / `OrderMapper#cancelById` / `PreparedStatementHandler#update`。
2. 案例 A：`POST /api/orders/1/cancel` 返回 200，UPDATE 0 行（只匹配 PAID），订单仍 CREATED；agent 4 span 全 EXACT，controller.parent = 请求 `traceparent` span。
3. 案例 B：静态页纯前端 `validateForm`，零 fetch；经 launcher preview 注入 SDK 后 3 事件（click/js_method/render），无后端。
4. 三栈本地矩阵：Boot JAR + Vue3/Vite（S0–S6）、Boot JAR + React18/Webpack5（S7）、Tomcat WAR + SSM + SDK preview（S8），云端=不支持；矩阵有命令/证据。
5. S0–S7 回归不降级（75 + 35 PASS）；S8 门禁独立可复跑；备份/tag `s8-baseline`。

## 2. 范围/冻结

- In：新 WAR demo（SSM/Spring MVC/MyBatis/H2、静态页、`ROOT.war` 部署说明）、S8 门禁/矩阵/文档/证据/备份。
- Out：agent/collector/SDK/workbench/Vue/React 源码改动；schema/event-model/transport；云端/S9+；Tomcat 版本矩阵扩展。
- 已知兼容点：agent 握手线程与 Tomcat JUL 启动存在竞态；S8 启动 Tomcat 时使用
  `-Djava.util.logging.manager=java.util.logging.LogManager`（已实测避免死锁），agent 源码不改，S0–S7 字节保持。
- 页面经 launcher preview 注入 SDK；`js_method` 的 appName 为 `traceboard-preview`（preview 固定），不是源码映射；仅基础。

## 3. 角色与输出

| 角色 | 输出 |
|---|---|
| dispatcher | 本文件 |
| plan-writer/G1 | `s8-plan.md`、`matrix.md`、`plan-review.md` |
| coder | `demo/buggy-shop-ssm-war/**`（main 执行；独立路径） |
| tester | `tools/verify/s8-tomcat.mjs`、`test-report.md`（独立脚本；main 复跑） |
| acceptance | `progress.md`、`acceptance.md`、evidence、备份、README/STAGE、tag |

## 4. 停止条件

必须改 agent/SDK/collector/schema 才能通过、需要云端/S9+、或矩阵无证据 → 停止并如实标 `S8 未完成`。