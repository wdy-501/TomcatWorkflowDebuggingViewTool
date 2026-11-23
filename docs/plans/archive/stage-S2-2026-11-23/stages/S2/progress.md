# S2 进度包（progress）

> 模板：`docs/plans/SOLO-PLAN.md` §4（检查点停止与自检协议）｜日期：2026-11-23｜作者：acceptance（G2）
> 依据：`docs/plans/stages/S2/dispatch.md`、`dispatch-amendment-01.md`（S2-AMD-01）、`s2-plan.md`、
> `plan-review.md`（G1 PASS）、`test-report.md`（42/42；§11 修订复跑）、`acceptance.md`（G2 PASS）。

```text
CHECKPOINT: S2（0 行事实链 MVP：demo H2/MyBatis 0 行 + agent 4-span 后端链 + collector requests/graph + 工作台请求切换事实板）
STATUS: done

EVIDENCE:
- 独立校验（G2 亲自复跑，不信报告）：(cd "tools/verify" && npm ci && node verify.mjs)
  → "checks: 42 PASS / 0 FAIL (total 42)"、"S2 TEST: PASS"、node_exit=0（2026-11-23 12:39:52–12:40:36）
  （同轮含 4 次构建：根 reactor JDK21 / demo 后端 JDK8(H2+MyBatis) / workbench vue-tsc+build / demo 前端；
    4-span E2E、requests/graph、fail-open、S0/S1 回归、范围/安全/漂移、清理）
- 修订链：首轮 G2 FAIL（12:34，41/42，唯一 B1 = demo 前端 App.vue 页头文案在 tester 冻结后修改，S2-9 拒绝）
  → dispatcher S2-AMD-01（12:35，单文件文案例外）→ tester 第 6 轮 42/42、exit 0（12:37–12:38，test-report §11）
  → G2 复跑 42/42、exit 0 → PASS
- 冻结面：S2 G1 9/9 SHA256 逐字一致（schema、api/event-model/transport 契约、s2 fixture 三件、s2-plan、dispatch）；
  S0/S1 冻结 fixture 7/7 字节未变；schema 字节不变且仓库仅 1 份
- 修订合规：demo 前端仅 src/App.vue 变更（5+/2-，仅 <template> 页头文本）；<script setup> 与样式逐字节等于 HEAD；
  60 个模板标记与 HEAD 全等；fetch 仍仅 /api（2 处）；无 SDK/traceparent/clickId；目录前缀仍 forbidden，白名单仅精确文件
- 案例 A（运行时事实，非 fixture）：GET /api/orders → id=1 SO-0001 CREATED 100.0（H2 seed）；
  POST /api/orders/1/cancel → 200 {"data":true} 且列表仍 CREATED（UPDATE ... AND status='PAID' 0 行）；
  POST /api/orders/999/cancel → 404 {"data":false}（0 或 2 span，不伪造 mapper/sql）；
  fat jar 内嵌 h2-2.1.214.jar、mysql 驱动 0 → 0 行是真实 H2/MyBatis 事实
- 4-span 链：每次 cancel 恰好 4 span controller(LOST root,200)→service(true)→mapper(0)→sql(rows 0/UNKNOWN)，
  同 trace/root、父子/嵌套、全 OK、durNs>0、THREW=0；第二次 cancel 独立 traceId（S2-3/S2-3b）
- requests/graph：2 组请求按 startedAtNs 升序；spanCount=4/rootKind=controller/OK/LOST/无 error；
  graph 4 节点/3 边、startNs 排序、SQL rowsAffected=0/transaction UNKNOWN、两次 GET 一致且事件/seq 不变；
  缺失/非法 traceId→400、未知 session/trace→404、写动词→405、replay/stream/ws/links→404（S2-4/S2-4F）
- fail-open：停 collector 后 cancel 仍 200 {"data":true}、3ms、demo 存活、stderr ingest_rejected=1 status=io_error（S2-5）
- 工作台：dist 含 0 行事实链/requests/graph/rowsAffected/未采集/事实摘要/游离后端请求（无前端根）/每 5 秒刷新（非实时）
  与 #s2-* 选择器；S1 假面板折叠、S0 FixturePanel 保留；无 SSE/WS/图库/canvas/时间轴/S3（S2-6/S2-8）
- 安全：0 secret/真实数据/遥测/CDN；npm 仅 registry.npmjs.org、Maven Central 默认；collector 仅 127.0.0.1:8601；
  H2 仅嵌入式；错误信封 1..200 字符且 0 回显（V8a–V8d/S2-8）
- 浏览器证据：evidence/workbench-s2.png（会话 s_s2agent、2 请求切换、事实条 200/true/0/0/THREW 0、
  4 节点/3 边、LOST 游离根）与 evidence/demo-s2.png（案例 A 页头、CREATED 100、{"data":true}、操作成功）；G2 已目视
- 清理：6 端口（8080/8601/5173/5174/4173/4174）无 LISTENING；无 java.exe；git 索引未动；验证器未写产品（99 文件稳定）
- 基线：commit "feat(S2): zero-row fact chain — H2 defect, 4-span agent, requests/graph, request switching" + tag s2-baseline
  （完整哈希见下方“基线记录”）
- 归档：docs/plans/archive/stage-S2-2026-11-23/（MANIFEST.md + SUMMARY.md；复制不移动）

CHANGED:
- 产品（S2 六卡）：demo 后端 H2+MyBatis（schema.sql/data.sql/OrderMapper.xml，删 InMemoryOrderStore，故意 0 行缺陷）；
  agent 4 点插桩（Controller/Service/MapperProxy/PreparedStatementHandler）+ ThreadLocal 栈 + 4-span 字段；
  collector requests/graph 只读派生（读时派生、无持久化）；workbench S2 面板/请求切换/事实链 + S1 面板折叠；
  demo 前端仅 App.vue 页头文案（S2-AMD-01）；tools/verify S2 门禁 42 项；S2 契约章节 + s2 fixture；
  S2 计划/评审/测试/验收/进度/归档；README 重写为 S2 口径
- 契约字段/API：POST /ingest/v1/events（S1 不变）；GET /api/v1/sessions、/events（S1 不变）；
  新增 GET /api/v1/sessions/{id}/requests 与 GET /api/v1/sessions/{id}/graph?traceId=（S2 IMPLEMENTED，只读）；
  replay/stream/ws/links 仍 RESERVED；meta capabilities 5 键不变；schema v1 字段/枚举/约束未变
- G2 本轮只写：README.md、docs/plans/stages/S2/{acceptance.md,progress.md}、
  docs/plans/archive/stage-S2-2026-11-23/**、git；未改代码/schema/fixture/契约/工具/测试

RISK:
- 未实现（S3 边界）：浏览器 SDK/traceparent/clickId/关联引擎、回放/时间轴/虚拟时钟、SSE/WebSocket/实时、
  values/字段 diff/异常 payload、collector 持久化/淘汰/鉴权/CORS/429、launcher/cloud/Tomcat/React/MySQL；
  4-span 是 confidence=LOST 的游离后端请求，不画点击链；不得对外宣称“已支持”
- countById 不插桩：未知 id 链 0 或 2 span（Controller 404 + Service RETURNED_FALSE），无 mapper/sql，不伪造
- EventSender 容量 16、单守护线程、1 次尝试：突发丢弃/非 202 仅 stderr 计数（dropped=/ingest_rejected=）；
  运行时 flags 含 S1 遗留 DROP_COUNT=<n>，不与 fixture 逐字比较
- 工作台 5 秒轮询非实时；手动刷新；preview/静态 dist 无代理（S2 面板会报 collector 不可达）
- H2 内存库 + collector 内存存储：无持久化，重启回到 seed/清空
- 回环口径：collector/agent 仅 IPv4 127.0.0.1；浏览器统一 localhost:5173（Vite 可能绑 [::1]）；git 分支 master、无 remote
- demo 前端 main.ts/style.css/package.json description 仍有 S0 文案（source-only，页面不展示）；
  App.vue 页头文案例外 = S2-AMD-01 单文件，不得作为后续先例
- S2 G1 文档瑕疵 N1/N2/N5/N9/N10/N11 延后；N3/N4/N6/N7/N8 已在 tester/实现说明落实
- S2 通过不宣称产品完成；S3 需新的分发书

NEXT: S3（前端 SDK/关联/回放/时间轴）— 需 dispatcher 新分发书；本进度包与 s2-baseline 不构成 S3 开工许可
```

## 基线记录

- 基线 commit：`（首轮提交后由 G2 追加）`
- tag：`s2-baseline`（指向同一 commit）
- 后续 commit：`docs(S2): record baseline commit`（仅 `acceptance.md`、`progress.md`）
- 归档：`docs/plans/archive/stage-S2-2026-11-23/`（提交前快照；SHA256 与恢复方法见其 `MANIFEST.md`）
