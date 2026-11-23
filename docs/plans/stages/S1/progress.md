# S1 进度包（progress）

> 模板：`docs/plans/SOLO-PLAN.md` §4（检查点停止与自检协议）｜日期：2026-11-23｜作者：acceptance（G2）

```text
CHECKPOINT: S1（walking skeleton：NDJSON ingest + 会话查询 + 单方法 agent span + 工作台假点击闭环）
STATUS: done

EVIDENCE:
- 独立校验（G2 亲自复跑，不信报告）：(cd "tools/verify" && npm ci && node verify.mjs)
  → "checks: 35 PASS / 0 FAIL (total 35)"、"S1 TEST: PASS"、EXIT_CODE=0
  （同轮含 4 条构建：根 reactor JDK21 / demo 后端 JDK8 / workbench vue-tsc+build / demo 前端）
- 漂移：S1 G1 基线 10/10 SHA256 逐字一致（schema、event-model、api、transport、3 个 S1 fixture、
  fixture README、s1-plan、dispatch）；S0 的 schema 与 case-A 两 fixture 未变（S1-G）
- ingest：fixture 2 行 → 202 accepted=2；重发 → dropped=2；混合批 accepted=1,rejected=2（line 2/3）；
  415/400/413 全中；错误信封 0 回显（S1-C1/C2/C3）
- 查询：sessions 计数/时间；{seq,event} + nextSeq；limit=1、afterSeq=1/2 分页；limit=0/501、afterSeq=-1/abc→400；
  未知 session→404；写动词→405；graph/replay/stream/ws/links→404（S1-D）
- agent E2E：premain installed + transformed OrderController；cancel×2 → 恰好 2 条 controller span；
  kind=controller、nodeKey=...#cancel、status=OK、confidence=LOST、flags 含 LOST_BACKEND、
  parentSpanId=null、rootEventId=click_lost_<spanId>、durNs>0；spanId 与 traceId 均互异；取消前 s_s1agent 404（无合成启动事件）（S1-E1）
- fail-open：停 collector 后 cancel 仍 200 {"data":true}，耗时 3ms；demo 存活；stderr 出现 ingest_rejected=1 status=io_error（S1-E2）
- 工作台构建/路径：dist 含按钮/横幅/no correlation yet；Vite /ingest、/api → 127.0.0.1:8601（dev only）；
  同形假批次 202 accepted=2、eventCount=4、seq 1..4（S1-B/S1-F）
- 浏览器证据：evidence/workbench-s1.png（orchestrator 11:39，第 1 次点击：accepted=2、eventCount=2、seq 1–2）；
  G2 现场复跑（11:41，collector 8601 + npm run dev 5173）点击两次：
  第 1 次 accepted=2 → eventCount=2/nextSeq=2；第 2 次 accepted=2 → eventCount=4/nextSeq=4、seq 1–4；
  两次 traceId 不同（9fa946c8… / 613a1d8b…）、rootEventId 不同；S0 fixture 面板保留；
  控制台仅 21 条 Vite HMR "ws://localhost:5173" 连接失败（dev client），无 S1/应用错误
- 清理：6 端口（8080/8601/5173/5174/4173/4174）无 LISTENING；无 java.exe；git 索引未动（S1-I）
- 基线：commit "feat(S1): walking skeleton — ingest, query, one-method agent span, workbench roundtrip" + tag s1-baseline
  （完整哈希见下方“基线记录”）

CHANGED:
- 产品（S1 六卡）：collector ingest/store/schema 拷贝 + sessions/events 查询 + meta capabilities；
  agent Byte Buddy 单方法插桩 + fail-open NDJSON 发送；workbench S1 面板/api/store + Vite 代理；
  tools/verify S1 门禁；README 重写；S1 计划/评审/测试/验收/进度；S1 fixtures；契约 S1 章节（api/transport/event-model）
- 契约字段/API：POST /ingest/v1/events（202/400/413/415、逐行、幂等、4MB/1000/64KB）；
  GET /api/v1/sessions、GET /api/v1/sessions/{id}/events（{seq,event}、nextSeq、1..500）；
  meta capabilities.ingestEvents=true（realtime/replay 仍 false）；schema v1 字段/枚举未变
- G2 本轮只写：README.md、.gitattributes（追加 *.ndjson eol=lf，保护 S1 假批次）、
  docs/plans/stages/S1/{acceptance.md,progress.md}、archive/stage-S1-2026-11-23/**、git；
  未改任何代码/schema/fixture/契约/工具/测试

RISK:
- 未实现（S2 边界）：service/mapper/SQL/行数/values/sideEffects、关联/traceparent、图/时间轴/回放/请求切换、
  SSE/WebSocket/实时、DB/文件持久化、launcher/cloud/MySQL；不得对外宣称“已支持”
- 假前端事件与真实 agent span 无关联，工作台不展示 s_s1agent；查询 ≠ 回放
- 内存存储无淘汰、重启即清空；无鉴权/CORS/429，仅限 127.0.0.1 本机演示
- preview/静态 dist 无代理（S1 面板仅 dev server 可用）；collector 仅 IPv4 回环，浏览器统一 localhost:5173
- source.line 为方法退出点（实测 48），不可复现；测试只断言文件名
- 设置 -Dtraceboard.traceId 会让多次调用共享 traceId（违反游离根独占）；默认不设置，README 已警告
- 默认 sessionId 实现为 s_s1agent，文档/工作台文案有 s_s1_agent 旧口径；演示命令显式传参，不影响数据
- D16：丢弃/非 202 只在 stderr 计数，不写 DROP_COUNT flag（S2 契约变更再补）

NEXT: S2（需新的分发书授权；本进度包与 tag 不构成 S2 开工许可）
```

## 基线记录

- 基线 commit：`（首轮提交后由 G2 追加）`（`feat(S1): walking skeleton — ingest, query, one-method agent span, workbench roundtrip`），tag `s1-baseline` 指向同一 commit。
- 归档：`docs/plans/archive/stage-S1-2026-11-23/`（MANIFEST.md + SUMMARY.md；归档为提交前快照，不含上述哈希行）。
