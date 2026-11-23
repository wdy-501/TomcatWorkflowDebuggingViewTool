# TraceBoard

面向本地 Java（Spring Boot）Web 应用的“全链路事实”调试工具。当前处于 **S0（基础与契约）**：只交付可构建的骨架、可评审的契约草案与可读取的 0 行 fixture。

## S0 范围（只有骨架）

已交付（均可复跑验证）：

- 根 Maven reactor + `agent` noop premain 骨架 + `server/collector` 骨架（JDK21）。
- 事件模型 v1 JSON Schema（2020-12）+ 四份契约草案（事件模型 / 状态语义 / 传输 / API）。
- case A（0 行）fixture：`fixtures/case-a-zero-rows/`，9 行 JSONL + 5 条期望事实。
- demo `buggy-shop-boot-vue` 骨架（Spring Boot 2.7.18 / JDK8 后端 + Vue3 单页，**无缺陷、无采集**）。
- workbench AppShell（Vue3 + TS + Vite + Pinia，三区占位 + fixture 事实摘要）。
- 独立校验脚本 `tools/verify/verify.mjs`（26 项检查）。

**明确未支持（S0 不做，勿据此承诺）：**

- 无真实字节码插桩：`agent` 只有 noop `premain`（一行日志），无 Transformer/ASM/Byte Buddy/JDBC 探针。
- 无事件采集、无 ingest 落库：`POST /ingest/v1/events` 固定返回 `501 not_implemented`，不解析、不落盘。
- 无关联引擎、无 traceparent/clickId 传播、无游离区、无 SSE/WebSocket 推送。
- workbench 不渲染图、无时间轴、无回放、无请求切换、无节点详情（仅占位与 fixture 摘要）。
- 无 launch/cloud/MySQL/Tomcat/WAR；collector 与 demo 之间**不通信**。
- 下一阶段为 **S1（walking skeleton）**，需新的分发书授权；本仓库当前状态不代表 S1 能力。

## 前置条件

| 依赖 | 版本/位置 | 用途 |
|---|---|---|
| JDK 21 | `C:/Program Files/Java/jdk-21`（21 LTS） | 根 reactor、collector、agent 构建与运行（agent 自身字节码仍为 8） |
| JDK 8 | 默认 `JAVA_HOME`（本机 `C:/Program Files/Java/jdk1.8.0_221`） | demo 后端构建与运行 |
| Maven | 3.9.5 | 所有 Java 构建（只用 Maven Central） |
| Node.js / npm | Node 22.x / npm 10.x | workbench、demo 前端、`tools/verify` |

Windows + Git Bash；仓库路径含中文与空格，**所有命令与路径必须双引号**，并在仓库根执行。

## 构建（精确命令）

```bash
# 根 reactor（agent + collector），必须覆盖 JAVA_HOME 为 JDK21
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package

# demo 后端：独立工程（非 reactor 子模块），使用默认 JAVA_HOME = JDK8
(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)

# workbench 前端
(cd "workbench" && npm ci && npm run build)

# demo 前端
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
```

产物：`agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar`（major version 52）、
`server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar`、
`demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar`。

## 本地启动（按需起停，均用 `localhost`）

统一用 `http://localhost:<port>` 访问，**不要用 `127.0.0.1`**：Node/Vite 可能只绑定 IPv6 回环 `[::1]`，
而 collector 仅绑定 IPv4 `127.0.0.1`；`localhost` 是两者都能解析的共同入口。

```bash
# 1) collector（JDK21，8601；仅 /actuator/health、/api/v1/meta、/ingest/v1/events→501）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
curl -s "http://localhost:8601/actuator/health"   # {"status":"UP"}

# 2) demo 后端（JDK8，8080；内存数据，1 条 CREATED 订单）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
curl -s "http://localhost:8080/api/orders"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"   # {"data":true}

# 3) workbench（5173，仅外壳 + fixture 摘要；无 API/WebSocket）
(cd "workbench" && npm run dev)

# 4) demo 前端（5174，/api 经 Vite proxy 到 8080；按钮 + 原始 JSON + “操作成功”提示）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)
```

停止：前台 `Ctrl+C`；后台运行则 `taskkill //PID <pid> //T //F`，并用
`netstat -ano | grep -E ":(8601|8080|5173|5174)\s" | grep LISTENING` 确认端口已释放。
demo 后端与 collector 互不通信；本阶段没有任何采集链路。

## 校验（独立复跑，勿只看报告）

```bash
node tools/verify/verify.mjs
# 或（首次需装依赖）
(cd "tools/verify" && npm ci && node verify.mjs)
```

期望：26 项 PASS、末行 `S0 TEST: PASS`、退出码 0。任一项失败即非零退出，附 `repro:` 命令。

## 契约与 fixture

- `schema/traceboard.event.v1.json`：事件 v1（2020-12，`$id=urn:traceboard:schema:event:v1`，无网络 `$ref`）。
- `fixtures/case-a-zero-rows/events.jsonl`：9 行 append-only NDJSON；`expected-facts.json`：5 条事实
  （SQL 0 行 → Mapper 返回 0 → Service 返回 true → HTTP 200 → UI “操作成功”提示）。全部 `status=OK`、`confidence=EXACT`、`DROP_COUNT=0`。
- 工作台只做事实摘要展示，不判定“这是 bug”。
- 换行策略由根 `.gitattributes` 保护（`*.jsonl/*.json/*.md/*.java/*.ts/*.vue` 强制 LF）。

## 文档索引

| 路径 | 内容 |
|---|---|
| `docs/plans/README.md` | 单人计划入口 |
| `docs/plans/SOLO-PLAN.md` | 检查点 S0–S10 与自检协议 |
| `docs/plans/00-master-plan.md` | 产品主计划（技术事实权威） |
| `docs/plans/stages/S0/dispatch.md` | S0 任务分发书 |
| `docs/plans/stages/S0/s0-plan.md` | S0 实施计划（含 D1–D16 偏离记录） |
| `docs/plans/stages/S0/plan-review.md` | 契约评审 G1 PASS + 冻结哈希 |
| `docs/plans/stages/S0/test-report.md` | 测试报告（26 项） |
| `docs/plans/stages/S0/acceptance.md` | G2 验收结论与证据 |
| `docs/plans/stages/S0/progress.md` | S0 进度包 |
| `docs/plans/archive/stage-S0-2026-11-23/` | S0 归档快照（MANIFEST/SUMMARY） |
| `docs/contracts/` | 四份 v1 契约草案 |
