# SUMMARY — S1 阶段总结（2026-11-23）

## 目标（SOLO-PLAN S1 / dispatch §1）

S1 = **walking skeleton**：一条**假前端事件**从“点击/请求”走到工作台 + 一个**真实插桩**的 controller span 被采集并读回；
`main` 可构建可运行。明确不做关联、图、时间轴、回放、service/mapper/SQL 采集与持久化。

验收信号：ingest 真可用、查询真可用、agent 真插桩、工作台闭环、main 可运行、契约/测试同步（缺一即 FAIL）。

## 交付物

| # | 交付 | 位置 |
|---|---|---|
| 1 | 契约 S1 章节（api/transport/event-model 游离后端根）+ 3 个 S1 fixture + `s1-plan.md` | `docs/contracts/`、`fixtures/s1-walking-skeleton/`、`docs/plans/stages/S1/` |
| 2 | collector：NDJSON ingest（202/400/413/415、逐行 schema、幂等、内存 append-only）+ sessions/events 查询 + meta | `server/collector/` |
| 3 | agent：Byte Buddy 1.14.19（shaded）单方法插桩 `OrderController#cancel(long)` + fail-open NDJSON 发送 | `agent/` |
| 4 | workbench：S1 假点击/请求面板 + 一次有界读回 + 原始事件表 + Vite dev 代理 | `workbench/` |
| 5 | 独立校验（S0 回归 + S1 门禁，35 项）与测试报告 | `tools/verify/`、`docs/plans/stages/S1/test-report.md` |
| 6 | 计划/评审（G1 PASS）/验收（G2 PASS）/进度/归档/基线提交 | `docs/plans/**`、`README.md`、tag `s1-baseline` |

## 证据

- `(cd "tools/verify" && npm ci && node verify.mjs)` → **35 PASS / 0 FAIL**、`S1 TEST: PASS`、exit 0（G2 亲自复跑；同轮 4 条构建全绿）。
- ingest：fixture → `202 accepted=2`；重发 → `dropped=2`；混合批 `accepted=1,rejected=2`；415/400/413 全中、错误信封 0 回显。
- 查询：`{seq,event}` + `nextSeq`、分页/limit/afterSeq、400/404/405、保留路由 404。
- agent：`transformed OrderController`；cancel×2 → 恰好 2 条 controller span（LOST、LOST_BACKEND、`click_lost_<spanId>`、
  `parentSpanId=null`、`durNs>0`）；spanId/traceId 均互异；取消前会话 404（无合成启动事件）；停 collector 后 cancel 仍 200、**3ms**。
- 工作台：构建绿、dist 含按钮/固定横幅/`no correlation yet`；G2 现场点击两次 → accepted=2、eventCount 2→4、seq 1–4、
  traceId/root 每次全新（`9fa946c8…` → `613a1d8b…`）；S0 fixture 面板保留。
- 浏览器截图：`stages/S1/evidence/workbench-s1.png`（2026-11-23 11:39，第 1 次点击：accepted=2、eventCount=2、seq 1–2）。
- 冻结：S1 G1 基线 10/10 SHA256 逐字一致；schema 与 case-A fixture 自 S0 未变。
- 安全：0 secret/真实数据/遥测/CDN/第三方镜像；collector 仅 `127.0.0.1`。

## 测试结果（T0–T13 映射）

| 组 | 结果 |
|---|---|
| T0 S0 回归 | PASS（case-A 9/9、5 facts、区间、4 构建、agent major 52、卫生） |
| T1–T2 fixture + 构建/字节等价 | PASS（3/3 schema、8 facts + 25 全局断言；jar 内 schema == 根 schema） |
| T3–T6 ingest | PASS（202、幂等、逐行、415/400/413） |
| T7–T8 查询/meta | PASS |
| T9–T10 agent/fail-open | PASS（2 span、LOST/LOST_BACKEND、distinct ids；3ms） |
| T11–T12 workbench/无 S2 | PASS（构建/代理/横幅；无图/回放/SSE/WS/DB/关联） |
| T13 漂移/安全 | PASS（10/10 基线；jar 52/shaded/无未 relocate） |

## 风险与未支持（如实）

- **无关联**：假前端事件与真实 agent span 独立；工作台不展示 `s_s1agent`；无 traceparent/clickId、无合并/推断。
- **未采集**：service/mapper/SQL/行数/`values`/`sideEffects`；无图/时间轴/回放/请求切换/节点详情。
- **无实时/持久化**：无 SSE/WS/轮询；collector 内存 append-only，重启即清空；无鉴权/CORS/429，仅限本机回环。
- **运行限制**：Vite 代理仅 dev server（preview/静态 dist 无代理）；collector 仅 IPv4 回环，浏览器统一 `localhost:5173`。
- **agent 细节**：`source.line` 为退出点（实测 48）不可复现；若设置 `-Dtraceboard.traceId` 会共享 traceId（默认不设）；
  默认 sessionId 实现为 `s_s1agent`，部分工作台文案仍写 `s_s1_agent`（展示口径，演示命令显式传参）。
- **丢弃可见性**：队列满/非 202 只在 stderr 计数（D16），`DROP_COUNT` 事件标记留待 S2。

## 下一步

**S2 需要新的分发书**：Boot attach、方法/SQL/行数、关联/存储/API、请求切换/事实图。
本总结与 `s1-baseline` tag 不构成 S2 开工授权；S1 到此为止。
