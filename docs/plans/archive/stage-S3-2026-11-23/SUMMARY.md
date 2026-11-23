# SUMMARY — S3 阶段总结（前端事实 + 只读回放 MVP）

> 阶段：S3｜日期：2026-11-23｜作者：acceptance（G2）｜结论：**G2 PASS，tag `s3-baseline`**
> 说明：本文件是阶段总结（非权威验收记录）；权威证据见 `docs/plans/stages/S3/acceptance.md`、
> `test-report.md`、`plan-review.md`、`progress.md` 与 git tag `s3-baseline`。

## 1. 目标

按 `docs/plans/SOLO-PLAN.md` S3 行与主计划 §6/§16（T4/T5/T7/T8），在 S2 的 0 行事实链之上补齐
**前端事实（点击/控件/请求/DOM）+ 案例 B“确认没发请求” + 状态语义 + 只读回放**，且**不做 S4/S5**：

- 浏览器 runtime SDK（显式 `wrapFn`/`uiEffect`、包装 fetch/XHR、同源头传播、fail-open、无 PII）；
- 案例 A：`traceparent` + `X-TraceBoard-Click` 让后端 4 span 与前端 fetch **EXACT** 关联，0 行事实不变；
- 案例 B：纯前端校验，观察窗关闭后 `fetchCount=0`，可**确认**“本次点击因果链内没有网络请求”；
- collector `requests` 扩展字段 + `GET .../replay` 只读窗口（0 写、不消耗 seq、不调 demo）；
- 工作台 S3 板（混合事实树/状态图例/案例 B 判定/时间轴回放/只读横幅），S0–S2 折叠为次级；
- 一次命令 51 项门禁（S0–S2 回归含显式迁移 + S3-1…S3-10）。

## 2. 交付物

| # | 交付 | 位置 |
|---|---|---|
| 1 | S3 契约（api §2.3/§9、transport、event-model §12）+ s3 fixture + 计划 | `docs/contracts/*.v1.md`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/s3-plan.md` |
| 2 | runtime SDK（TS 独立包，dist ESM + d.ts，8 单测） | `frontend/sdk/**` |
| 3 | demo 前端 SDK 接入 + 案例 B | `demo/buggy-shop-boot-vue/frontend/**`（9 文件） |
| 4 | agent 请求头反射读取（EXACT 继承 / 无头 LOST） | `agent/**` |
| 5 | collector requests 扩展 + 派生 confidence + replay | `server/collector/**` |
| 6 | workbench S3 板与时间轴 | `workbench/**` |
| 7 | 51 项门禁 + 测试报告 | `tools/verify/**`、`docs/plans/stages/S3/test-report.md` |
| 8 | G1 评审、验收、进度、README、归档 | `plan-review.md`、`acceptance.md`、`progress.md`、`README.md`、本目录 |

## 3. 证据

- **门禁**：G2 独立复跑 `(cd "tools/verify" && npm ci && node verify.mjs)` → **51/51 PASS**、`S3 TEST: PASS`、exit 0。
  同轮含 SDK 构建+8 单测、demo 前端/workbench 构建、根 JDK21、demo JDK8、头关联 E2E、requests/graph/replay 深比较、
  回放 0 写、S0–S2 回归（含显式迁移）、漂移/范围/安全/清理。
- **案例 A（运行时）**：click+fetch + agent 4 span 同 trace/root；`controller.parentSpanId = fetch.spanId`；
  全链 `EXACT`、无 `LOST_BACKEND`；0 行不变（200/true/0/rows 0）。无头/非法头 → 独立 4-span `LOST`。
- **案例 B（运行时/派生）**：`sdkActive=true`、根 `ui_event` EXACT、`fetchCount=0`、`hasBackend=false`、`RETURNED_FALSE`；
  工作台逐字“已确认：本次点击因果链内没有网络请求”。
- **回放**：9 个窗口 200/readOnly/排序/逐字；两次 GET byte-identical；前后 18 事件/`nextSeq=18` 不变、0 新事件；
  400/404/405/meta replay=true 全中。
- **冻结面**：22 项 SHA256 逐字一致（schema + 4 契约 + S3 fixture/plan/dispatch + S0–S2 fixture）；schema 字节不变。
- **截图**：`docs/plans/stages/S3/evidence/workbench-s3-{case-a,case-b,replay}.png`（G2 逐张目视）。

## 4. 结果

| 验收信号 | 结果 |
|---|---|
| 案例 B 确认没发（运行时） | PASS（SDK 在线 / 观察窗 1500ms 已关闭 / fetch=0 / 后端 span=0） |
| 案例 A 真实 EXACT 关联 | PASS（controller.parent = fetch.spanId；全链 EXACT；0 行不变） |
| 0 行可回放、回放 0 写 | PASS（窗口/排序/逐字；事件与 seq 不变；订单仍 CREATED） |
| 状态语义（颜色+文字） | PASS（OK/RETURNED_FALSE/THREW/NOT_COLLECTED_*/TRUNCATED/REDACTED/UNKNOWN；LOST 只在 confidence） |
| 门禁一次命令 | PASS（51/51、exit 0） |
| 范围/安全/漂移 | PASS（无 S4/S5、无 secret/CDN/镜像、22 项零漂移） |

## 5. 风险

- **未实现（S4/S5 边界）**：构建插件/sourcemap/行号/局部变量；launcher/IDEA/JAR/详情/×N；SSE/WS/实时；持久化/淘汰/缓存；
  像素回放；Tomcat/React/cloud/MySQL。**不得对外宣称已支持。**
- 观察窗仅运行时在线（1500ms，`pagehide` 提前关闭）；窗口外后台请求不采集，“确认没发”只覆盖本次点击因果链。
- 运行时案例 A 常多一条刷新 `GET /api/orders`（未插桩，标“后端未采集”，不降级整链）。
- agent 时钟锚点 µs 级偏差（契约 ≤1s 容差）；运行时 flags 含 `S3_EXACT_LINK`/`DROP_COUNT`（advisory，不与 fixture 逐字比较）。
- H2/collector 均内存：无持久化；工作台 5s 轮询非实时；preview/静态 dist 无代理。
- 环境纪律：证据采集后未停 dev server 会锁定 `node_modules` 内 `esbuild.exe`，导致下次 `npm ci` `EPERM`（本轮发生一次并解除）。
- pre-existing 文档瑕疵（EOF 无换行/历史指针）为 G1 前既有，为保护冻结面未改。

## 6. 下一步

**S4**（本地启动器 / IDEA 插件 / JAR 接入向导 / 节点详情 / ×N 逐次调用等）——**需要 dispatcher 新的分发书**。
本阶段与 `s3-baseline` 不构成 S4 开工许可；S3 通过也不宣称产品完成。
