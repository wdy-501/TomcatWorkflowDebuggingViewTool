# S4 G1 计划评审（plan-review）

- 评审角色：PLAN-REVIEWER（G1，只读；仅写本文件）
- 评审日期：2026-11-25
- 评审基线：`HEAD 93ccc0b96f7babad883b6d6450454b2a204dcb96`
- 输入：`docs/plans/stages/S4/dispatch.md`、`docs/plans/stages/S4/s4-plan.md`、`docs/contracts/api.v1.md` §2.4/§10、`docs/contracts/transport.v1.md` §6.5/§6.6、`docs/guides/local-launcher.md`、`fixtures/s4-details/**`、`docs/plans/00-master-plan.md` §11/§12/§13.1/13.3/§19、`docs/plans/SOLO-PLAN.md` S4、当前代码。
- 结论：**G1: FAIL**。6 个 blocking（均可在一轮内以计划/指南/契约文字修订修复，不需要改代码、schema、fixture 或事件语义）+ 13 个 non-blocking。未改任何代码、契约、fixture，未执行 git 写操作。

## 1. 冻结哈希（评审时实测）

| 文件 | SHA256 | 状态 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 与任务给定一致；未变 |
| `docs/contracts/api.v1.md` | `791c806aa9f45d88c6a61db74c0d71741e4f0d517fd300c48d8d9086d5687c25` | S4 增补（§2.4/§10） |
| `docs/contracts/transport.v1.md` | `169b99e2ce296f110a3f78ddbc4c52525e1163ca7753933e41555c47b40a7231` | S4 增补（§6.5/§6.6/§7） |
| `docs/contracts/event-model.v1.md` | `06ee878e9d3acc3d6a6ff66ee1e1d95c92ac5813913cc1ad84ae3977216025c0` | 未变 |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 未变 |
| `docs/guides/local-launcher.md` | `cf3d31a1639106faa232a311129864007f25ee1402aa75ab527c7317314852b1` | 新增 |
| `fixtures/s4-details/events.ndjson` | `75274346ed7593f2aef304d2d7a0989d969e1fdcea4330169422a4cff89d853b` | 新增 |
| `fixtures/s4-details/expected-facts.json` | `80fdcf9da4e4194f6324cc04f380a5f2bffa5ca5d927f819eac972d9d09774cc` | 新增 |
| `fixtures/s4-details/README.md` | `0cda2a5abfdca6cfc41af8ff49df163d9bc7c5a34a0d8647859fec05c2f7a8d2` | 新增 |
| `docs/plans/stages/S4/s4-plan.md` | `02cb3e9e5285eb401f5d586650cbac4ad0ac6d98bd1d0c985d0962c75290996b` | 评审对象 |
| `docs/plans/stages/S4/dispatch.md` | `9dd9809f4c02bc10739e2eb9c6359fa95aef54872de3ddd87d7bb194312951eb` | 评审对象 |

评审期间实测：`fixtures/s4-details/events.ndjson` 9/9 通过 Ajv 2020-12 strict；`expected-facts.json` 可解析，groups=3、gaps=3、replay=`0..5120000000/count 9`。

## 2. PASS/FAIL 表

| # | 审查面 | 结论 | 关键证据 |
|---|---|---|---|
| 1 | 范围边界（只 S4，无 S5/S6/S7） | PASS | `dispatch.md` §1、`SOLO-PLAN.md` 第 70 行、`s4-plan.md` §1/§12/§13 只含 launcher/preview/握手/详情；工作树无 sourcemap、构建插件、WAR/Tomcat、SSE/WS、持久化、云端实现；launcher 为新模块、JDK-only |
| 2 | `POST /ingest/v1/agent-hello` 契约 | PASS | `api.v1.md` §10.2 字段/约束/固定顺序 `405→415→413→400→200`、4096B、精确 200 形状；`transport.v1.md` §6.5 明确 JSON 不是 NDJSON；`dispatch.md` §4.5 与 §10.2 语义一致；`s4-plan.md` §5 明确不入 EventStore、不耗 seq、不建会话、meta 5 键 |
| 3 | `GET /api/v1/sessions/{id}/agent` | PASS | `api.v1.md` §10.3 精确 200 形状、404（含形状非法）、只 GET 405；`connected` 明示为连接事实而非在线探测；无 token/secret；`s4-plan.md` §5 一致 |
| 4 | 预览反代/注入契约 | FAIL（B3） | `transport.v1.md` §6.6、`dispatch.md` §4.4、`s4-plan.md` §4.5、`guide` §5 均写“其余头透传”，但注入会改写 body 而未定义 `Content-Length`/`Content-Encoding`/`Transfer-Encoding`/HEAD/204/304 规则；其余项（仅回环、http-only、`/ingest` 502 不伪造 202、两个外部 script、`not-injected:*`、不改 CSP）均正确 |
| 5 | S3 端点与 schema 不变 | PASS | `api.v1.md` §2.4 业务路由 9 条、S0–S3 章节仍在；`schema` 哈希与给定值一致；S0–S3 fixture 未改；`event-model.v1.md`/`status-semantics.md` 哈希未变；`transport.v1.md` §7 状态指针已更新且保留 S3 语义 |
| 6 | 本地接入指南可执行性 | FAIL（B1/B2/B6） | `guide` §3/§4/§5/§6/§5.1 用裸 `java -jar` 启动 Java21 launcher；§4 `--health .../actuator/health`、§6 `--app-url .../` 指向 demo 不存在的端点；§3 第 5 步/§5 `preview --target 8080` 指向无 HTML 页的后端；§6 的 SKIP/SUMMARY 与 plan §4.6 表述不一致。其余（注入限制、CSP 限制、安全、未验证声明）合格 |
| 7 | fixture（schema/形状/README） | PASS | 9/9 Ajv strict；单一 `LOST` controller 根（`click_lost_...`、`LOST_BACKEND` 仅根、trace 无前端事件）符合 `event-model.v1.md` §5 例外；同 `nodeKey` service/mapper ×3、sql ×2；mapper3 `NOT_COLLECTED_POLICY` + `reason`；SQL rows 0；区间嵌套；`expected-facts` 的 requests/graph/replay 与 fixture 一致；README 明示“仅 UI/测试数据、运行时 ×3 是 S6” |
| 8 | launcher 可行性（Java21/无三方依赖/spawn/stop/ports） | FAIL（B2/B3） | `dispatch.md` §3/§4.1、`s4-plan.md` §4.1–§4.4 的模块、argv、PID、stop、端口设计可行；但 guide/plan 的 demo health/app 目标不可达（B2），注入响应头未定义（B3）；另有 IIFE 路径/日志/停止校验细节（N1/N2/N12） |
| 9 | SDK IIFE 构建/自动 init/ESM 不变 | PASS（N11/N6） | `s4-plan.md` §6 的 esbuild 参数、global `TraceBoardSDK`、`window.__TRACEBOARD_CONFIG__` 条件 init、`__TRACEBOARD_AUTO_INIT__` guard、fail-open、无 sourcemap 均可行；当前 `frontend/sdk/src/index.ts` 无 `version` 导出（N11）；S3-1 门禁需精确迁移（N6） |
| 10 | 握手实现与 collector 生命周期 | PASS（N10/N8） | `s4-plan.md` §5 守护线程、≤3 次、1s、退避、fail-open、URL 派生、跳过计数完整；collector 重启丢失在 guide §7/`api.v1.md` §10.4 如实说明；`agent/src` 门禁禁用 `getMessage()`（N10）；`dispatch.md` 状态码叙述顺序与 §10.2 不一致（N8） |
| 11 | 工作台详情/×N/缺口 | FAIL（B4/B5） | `s4-plan.md` §7 的字段、票签、×N 排序、保留 S3/S2/S0 面板设计合理；但详情所需 `reason/source/confidence` 不在 graph 节点（`GraphNode.java` 11 字段；`api.v1.md` §8.2；`workbench/src/api.ts` 11 字段），plan 未定义 join；缺口规则 ②/③ 会与 `expected-facts` 的 3 条冲突（未定义去重）；`#s4-group-badge` 单 id 与两组徽标冲突（N5） |
| 12 | 测试与门禁 S4-A..S4-I | FAIL（受 B1/B2 阻塞；N6） | `s4-plan.md` §9 覆盖 launcher/preview/handshake/SDK/details/gaps/diagnose/回归/范围，命令基本精确；但 S4-G“collector+demo+preview 全 PASS”当前不可执行（B2），SKIP/exit 断言不一致（B1）；S4-H 对 S3-1/S2-8/S3-8/S3-10/S1_PORTS 的迁移只写“按 §4.10”，未给精确期望（N6） |
| 13 | 安全/隐私/回环/无 secret/CDN/镜像 | PASS（N4） | `transport.v1.md` §7、`guide` §8、`s4-plan.md` §11/§13 明示仅回环、无 TLS/鉴权/遥测、无 CDN/镜像、无 secret、预览只注入同源外部 script、不改 CSP、不读页面数据；`--target/--ingest` 未限制非回环（N4） |
| 14 | 风险/偏离/停止条件 | PASS（N7） | `s4-plan.md` §11 风险表覆盖 CSP、压缩/无 body、JDK8、握手时序、×N 诚实、诊断假成功、PID 误杀、端口；§12 D1–D6 有理由与后果；但 dispatch 的 transport 不变、A..H、§4.8 fixture 草图与 D2/D3 需 dispatcher errata（N7） |

## 3. Blocking issues（必须在 G1 复评前修复）

### B1. diagnose 的 SKIP/SUMMARY/exit 语义自相矛盾

**证据**

- `s4-plan.md` §4.6：`preview_injection` “无 `--preview-url` → SKIP（不计 PASS）”，`sdk_script` “200 且含…否则 FAIL”，并写“任一 FAIL → exit 3”。
- `guide` 第 194 行：“任一 FAIL → exit 3”；第 204 行 `sdk_script` “缺失/不匹配 → FAIL”；第 207 行：“SKIP 不计入 PASS…不会让 SUMMARY 变成 PASS；SUMMARY: FAIL 一定 exit 3”。
- `dispatch.md` §4.1：“exit 3（…diagnose 有 FAIL…）”；§4.10 风险表：“无 preview=SKIP 不计 PASS；任何 FAIL exit 3”；S4-G：“无 preview → SKIP 不算 PASS”。

问题：没有 `--preview-url` 时，`preview_injection` 是 SKIP，`sdk_script` 无 URL 也无法执行；按 plan 它是 FAIL，按“SKIP 不计 PASS”又应阻止 SUMMARY PASS，但 plan 的 exit 规则只认 FAIL。实现者无法确定无 preview 时是 exit 0 + SUMMARY PASS、exit 3 + FAIL，还是 exit 0 + PASS/WARN；S4-G 无法断言。

**精确修复（统一为一条规则）**

1. 在 `s4-plan.md` §4.6 定义：
   - `preview_injection` 与 `sdk_script`：无 `--preview-url` 时**都**为 `SKIP`；有 preview 时 `sdk_script` 才做 200/`TraceBoardSDK` 判定。
   - “`SUMMARY: PASS` 当且仅当没有 `FAIL` 且没有 `SKIP`；`WARN` 不阻塞（0 事件仍是 WARN）。”
   - “任一 `FAIL` 或任一 `SKIP` → `SUMMARY: FAIL`，exit 3；exit 0 当且仅当 `SUMMARY: PASS`。”
   - 把“任一 FAIL → exit 3”改为“任一 FAIL 或 SKIP → SUMMARY: FAIL，exit 3”。
2. 更新 `guide` 第 194/204/207 行为同一规则：`sdk_script` 无 preview → SKIP；无 preview 的运行必须显示两行 SKIP、`SUMMARY: FAIL`、exit 3；有 preview 时才可能全 PASS。
3. `dispatch.md` 加一句 errata（建议）：“diagnose 的 `SKIP` 使 `SUMMARY: FAIL`，因此 exit 3；`WARN` 不阻塞。”——若 dispatcher 不愿改 dispatch，则 plan/guide 的 SUMMARY 语义必须逐字承担该含义，不能出现“SKIP 但 PASS”。
4. S4-G 断言拆成两组：无 preview → `SKIP preview_injection`、`SKIP sdk_script`、`SUMMARY: FAIL`、exit 3；有 preview（按 B2 的可用目标）→ 七项无 FAIL/SKIP、exit 0。

**复评断言**：三处文字一致；S4-G 有无 preview 两个分支的精确断言；不再出现“SKIP 不计 PASS”与“任一 FAIL 才 exit 3”并存。

### B2. guide/plan 的 demo health、app-url、preview target 均指向不存在的端点/页面

**证据**

- demo 后端只有 `@RequestMapping("/api/orders")`（`OrderController.java` 第 25/34/42 行）与 `@PostMapping("/{id}/cancel")`；`resources/` 只有 `application.yml`、`data.sql`、`schema.sql`、`mapper/OrderMapper.xml`，无 `index.html`/静态页；`pom.xml` 只有 `spring-boot-starter-web`（Boot 2.7.18，Java 8），**无 actuator**。
- `guide` 第 100 行：`--health "http://127.0.0.1:8080/actuator/health"` → 404，`jar` 等待 30s 后 `HEALTH_TIMEOUT` exit 3（应用其实是好的）。
- `guide` 第 188 行 / `s4-plan.md` 第 243 行：`--app-url "http://127.0.0.1:8080/"` → 404，`app_health` FAIL，diagnose exit 3。
- `guide` 第 87 行 / `s4-plan.md` 第 237–239 行：`preview --target http://127.0.0.1:8080` —— 后端无 HTML 页；浏览器访问 8602 只能看到 404/错误页（若错误页是 HTML 还会被注入）。demo 前端 5174 已通过 `vite.config.ts` 别名内置 SDK，若把 preview 指向 5174 会二次加载/二次上报。
- `s4-plan.md` §4.2 把 `--ingest` 规范化为 `.../ingest`；§4.6 却写 `GET <base>/actuator/health`、`<base>/api/v1/meta`、`<base>/api/v1/sessions/...`。按字面 `<base> = .../ingest`，路径变成 `/ingest/actuator/health`、`/ingest/api/v1/meta`，全部 404。`guide` 第 198–202 行同样如此。

**精确修复**

1. 在 `s4-plan.md` §4.2/§4.6 与 `guide` §6 定义 `collectorOrigin`：先按 §4.2 规范化 ingest 为 `<origin>/ingest`，再**去掉尾部 `/ingest`** 得到 `collectorOrigin`；`collector_health`/`collector_meta`/`agent_handshake`/`recent_events` 全部使用 `collectorOrigin + /actuator/health`、`/api/v1/meta`、`/api/v1/sessions/...`。
2. `guide` §4 的 `--health` 改为 `--health "http://127.0.0.1:8080/api/orders"`（GET 200），或直接省略 `--health`（按 TCP 存活判定）；加一句“demo 后端是 Boot 2.7 + 仅 starter-web，没有 `/actuator/health`”。
3. `guide` §6 的 `--app-url` 改为 `"http://127.0.0.1:8080/api/orders"`；注明 `/` 是 404，不是应用没起。plan §10 第 243 行同步。
4. preview 目标：
   - 在 guide §3 第 5 步/§5/§5.1 明确：“demo 后端没有 HTML 页面；预览注入用 §5.1 的 18080 stub 验证。demo 前端 5174 已内置 SDK，**不要**把 preview 指向 5174（会重复加载/上报）。”
   - `s4-plan.md` 第 237 行注释“demo 或静态 stub”改为“静态 stub（demo 后端无 HTML 页；5174 已内置 SDK）”；§4.3 checklist ④ 的 `preview --target http://localhost:<port>` 改为“指向一个 HTML 页面（示例：18080 stub）”。
5. `guide` §7 `HEALTH_TIMEOUT` 行去掉“确认 health 路径 `/actuator/health`”，改为“demo 用 `/api/orders` 或省略 `--health`”。
6. S4-G 改为“collector + demo（`/api/orders`）+ preview（18080 stub）”全 PASS exit 0；这仍然是 S4 的真实链路，不是伪造。

**复评断言**：按 guide 原样复制命令可跑通 IDEA/JAR/preview/diagnose；`collector_health/meta/agent/events` 不再出现 `/ingest/...` 双前缀；S4-G 命令与 guide 完全一致。

### B3. 预览注入的响应头/Content-Length 语义缺失，且“头透传”字面不可实现

**证据**

- `transport.v1.md` §6.6：“其余方法/路径/查询/**头**/状态/体透传。”
- `dispatch.md` §4.4 同句；`s4-plan.md` §4.5 只写响应头 `X-TraceBoard-Preview`，未定义长度/编码；`guide` 第 143 行同句。
- 注入会在最后一个 `</body>` 前插入两个 `<script>`，body 变长；若继续透传上游 `Content-Length`，客户端会截断/挂起；若上游是 `Content-Encoding: gzip` 而 body 已被解码改写，透传 `Content-Encoding` 会让浏览器解码失败；HEAD/204/304 无 body，不能注入。

**精确修复（transport §6.6 + dispatch §4.4 errata + plan §4.5 + guide §5）**

1. 注入成功时：保留状态码与端到端头；**按改写后的 UTF-8 字节重算 `Content-Length`**；移除 `Content-Encoding`、`Transfer-Encoding`、`Content-MD5`、`ETag`（强校验器）；不转发 hop-by-hop 头（`Connection`、`Keep-Alive`、`TE`、`Trailer`、`Upgrade`、`Proxy-*`）；设置 `X-TraceBoard-Preview: injected`。
2. 无 body 的响应：HEAD、204、304 一律不注入、不加 body；HEAD 按上游头返回；204/304 原样。`Content-Length: 0` 的 200 可记 `not-injected:no_body`（或直接透传，但必须二选一并写死）。
3. 未注入时：body 逐字节透传，`Content-Length`/`Content-Encoding` 保持上游值；不得先解码再声称透传。
4. `/ingest/*` 不注入；collector 不可达 502。
5. S4-D 增加断言：`injected` 响应的 `Content-Length == Buffer.byteLength(body)`，且无 `Content-Encoding`/`Transfer-Encoding`；HEAD/204 无 body；gzip 上游 → `not-injected:encoding` 且 body 字节不变。

**复评断言**：四处文字一致；S4-D 有长度/编码/HEAD 用例；不再出现“头全部透传”与“body 改写”并存。

### B4. 详情字段 `reason/source/confidence` 没有数据来源，plan 未定义只读 join

**证据**

- `s4-plan.md` §7 要求详情显示：`status + reason`（`NOT_COLLECTED_*` 原样 reason）、`source file:line`、`confidence`。
- `GraphNode.java` record 只有 11 字段：`spanId/parentSpanId/kind/nodeKey/status/return/sideEffects/startNs/durNs/thread/flags`；`api.v1.md` §8.2 节点表同样 11 字段；`workbench/src/api.ts` `GraphNode` 同样 11 字段——**没有** `reason/source/confidence`。
- `reason/source/confidence` 只在事件体里（schema 顶层字段；`api.v1.md` 事件端点“原样返回”）；当前 `S3Panel.vue` 对 NOT_COLLECTED 显示的是通用提示，不是事件 `reason`。
- `expected-facts.json.uiExpectations.detailFields` 明确包含 `reason/source/confidence`。

**精确修复**

1. `s4-plan.md` §7 增加“数据源”段：结构/状态/return/sideEffects/thread/flags 取自 `GET .../graph`；`reason`、`source`、`confidence`（以及需要时的原始 status）按 `spanId` 从 `GET .../events`（`afterSeq/limit` 翻页直到 `nextSeq`）或已取回放窗口 join，**只读、不改 API/shape**；事件 404/空 → 详情仍渲染 graph 字段，缺失项显示 `未采集`（reason 缺失显示 `未采集（无 reason）`），不崩。
2. 明确 `source.file:line` 为 null 时显示 `未采集`；`reason` 必须逐字（mapper3 = `policy:third_party_package`），不得用 S3 的通用提示替代。
3. S4-F 增加断言：fixture 的 mapper3 详情 reason 精确等于 `policy:third_party_package`；`source:null` 节点显示 `未采集`；`#s4-detail-status` 不出现通用提示冒充 reason。

**复评断言**：plan §7 有数据源与 join 规则；S4-F 能按 fixture 断言 reason/source/confidence；无 graph API 变更。

### B5. 缺口规则未去重、逐次列表 `rows` 语义未定义，与冻结的 expected-facts 冲突

**证据**

- `s4-plan.md` §7 缺口规则：① 未关联 fetch；② `status ∈ NOT_COLLECTED_*`；③ `kind ∈ {mapper,sql}` 且 `sideEffects` 缺失/空。按字面，mapper3 同时满足 ② 和 ③；mapper1/mapper2 满足 ③；合计 4 条。
- `fixtures/s4-details/expected-facts.json.gaps.items` 固定为 3 条：mapper1 `ROWS_NOT_COLLECTED`、mapper2 `ROWS_NOT_COLLECTED`、mapper3 `NOT_COLLECTED_REASON`（同一 span 只出一条，reason 优先）；`order` 为 span 顺序。plan 没有去重/优先级规则，S4-F 会得到 4 或顺序不确定。
- `expected-facts.json.groups[0].invocations` 的 service 逐次项含 `rows:[0]` 与 `sqlSpanIds`（来自子 sql），mapper3 为 `rows:null` + “未采集”；而 plan §7 只说“所选节点 sideEffects 缺失/空 → 未采集”，没有定义逐次列表的 `rows` 从哪来，也没定义“子 sql 聚合”标签。若按 plan 字面，service 节点（无 sideEffects）在 SQL 票签里显示 `未采集`，但逐次列表却要显示 `[0]`，语义冲突。

**精确修复**

1. 在 `s4-plan.md` §7 增加去重规则：“同一 span 最多一条缺口；规则 ② 优先于 ③；③ 仅用于 status 不是 `NOT_COLLECTED_*` 且 `kind ∈ {mapper,sql}` 且 `sideEffects` 缺失/空；缺口按 span 的 `startNs` 升序、同值 `spanId` 字典序。”这样 fixture 正好 3 条。
2. 定义 SQL/数据影响票签 = **所选 span 自身** `sideEffects`；service/mapper 自身没有 sideEffects 时显示 `未采集`，绝不显示 0；`rowsAffected=0` 原样显示 `0`。
3. 定义 `#s4-invocations` 逐次列表的 `rows` 列：若所选 span 自身有 sideEffects → 用自身 rowsAffected；否则若其后代含 sql span → 聚合这些 sql 的 rowsAffected，列头/单元格标注“子 sql”（并列出 `sqlSpanIds`）；否则 `未采集`，绝不为 0。这样 service 第 1/2 次 `[0]`、第 3 次 `未采集`，mapper3 `未采集`，与 expected-facts 一致。
4. S4-F 增加断言：缺口恰 3 条且顺序固定；service 第 3 次 rows 文案 `未采集`；sql 自身 rows `0` 显示为 `0`；不得把子 sql 的 0 写成 service 自身 sideEffects。

**复评断言**：plan 的去重/优先级与 expected-facts 完全一致；S4-F 可同时断言缺口 3 条、逐次 rows、SQL 票签。

### B6. guide 用裸 `java -jar` 启动 Java21 launcher，JDK8 在 PATH 时会直接失败

**证据**

- `guide` 第 68、93、121、132、160、187 行均为 `java -jar ...traceboard-launcher...`。
- launcher 是 Java 21（`guide` §1 表格、§2.3；`dispatch.md` §3）；同一 guide 第 106 行又要求 demo/agent 用 JDK8，且说明 `JAVA_HOME` 可能指向 JDK21；新手机器/PATH 的 `java` 很可能是 JDK8 → `UnsupportedClassVersionError`，在任何 token 之前失败。
- `s4-plan.md` §10 已正确使用 `"$JAVA21/bin/java"`，与 guide 不一致。

**精确修复**

1. `guide` §2 增加：
   ```bash
   export JAVA21="C:/Program Files/Java/jdk-21"
   export JAVA8="C:/Program Files/Java/jdk1.8.0_221"
   ```
2. `guide` §3–§6 与 §5.1 的所有 launcher 命令改为 `"$JAVA21/bin/java" -jar ...`（或逐字 `"C:/Program Files/Java/jdk-21/bin/java"`）；保持 collector 启动也用 `$JAVA21`。
3. 在 §1 或 §3 加一句：“launcher/collector 用 JDK21；demo+agent 用 JDK8；PATH 上的 `java` 可能是 JDK8，不要用它跑 launcher。”
4. `guide` §7 增加一行：`UnsupportedClassVersionError` → 用 `$JAVA21/bin/java` 跑 launcher（不是 demo 的 JDK8）。

**复评断言**：guide 中不存在裸 `java -jar` 的 launcher 命令；§3/§4/§5/§6/§5.1 与 plan §10 完全一致；JDK8 PATH 下按文档可跑通。

## 4. Non-blocking issues（不阻塞 G1，但建议同一轮修）

- **N1. IIFE 路径“launcher jar 上两级”错误**：`server/launcher/target/x.jar` 上两级是 `server/`，不是仓库根；仓库根在四级之上。`s4-plan.md` 第 106 行、`guide` 第 141/222 行。改为“仓库根 CWD → `frontend/sdk/dist/...`；或 `TRACEBOARD_SDK_IIFE`；或从 jar 位置向上 4 级”；保留 CWD 优先。
- **N2. detach 日志泵**：`s4-plan.md` §4.4 要求 stdout/stderr 全量写日志并“回显”，但 `--detach` 后 launcher 退出；若父进程持有管道并退出，子进程可能写满阻塞/丢失。明确用 `ProcessBuilder.Redirect.appendTo(out.log/err.log)`（子进程直接写文件），launcher 仅在 attached 模式 tail 回显；detach 后关闭 tail，不关闭子进程句柄。
- **N3. guide 排障行 `connected=false` 不可能**：`api.v1.md` §10.3 只有 200 `connected:true` 或 404；`guide` 第 220 行应改为“有事件但 `GET .../agent` 404 = collector 重启后未再收到 hello，或应用未带 agent；重启应用”。同时补 `hello_skipped reason=ingest_url` 行（第 218 行只有 `hello_failed=3`）。
- **N4. 非回环目标未校验**：`preview --target`、`diagnose --app-url/--ingest-url` 可传任意主机；安全边界是仅回环。建议校验 host ∈ {`127.0.0.1`,`localhost`,`::1`}，否则 exit 2 或显式 WARN；至少 guide §8 写明“只允许本机目标”。`jar --health` 同理。
- **N5. `#s4-group-badge` 单 id 无法表示两组徽标**：fixture 有两个 nodeKey 的 `×3`；单 id 会重复。改为每组一个元素，用 `data-node-key` 定位（或 `#s4-group-badge-<spanId>`），`#s4-group-badge` 可作为容器；同步 S4-F/expected-facts 的选择器语义。
- **N6. 门禁迁移不够精确**（tester 执行时按此改）：
  - `S3-1`：SDK `node --test` 仍 **8/8**；`dist` 由 2 个文件变为 **3**（`index.js`、`index.d.ts`、`traceboard-sdk.iife.js`）；devDeps 由 `typescript` 变为 `typescript + esbuild`；仍禁止 runtime deps、`.map`、CDN。
  - `S2-8`：collector 路由 **7 → 9**（加 `POST /ingest/v1/agent-hello`、`GET /api/v1/sessions/{sessionId}/agent`）；agent `.type=`/`.transform=` 仍恰 **4/4**（hello 是手写 `HttpURLConnection`，不得新增 ASM 插桩）；`getMessage()` 仍禁。
  - `S3-8`：从 forbidden 标记中去掉 `launcher|intellij|idea-plugin|VirtualMachine.attach|tools.jar`（S4 允许），保留/新增 S5/S6 禁项（sourcemap、构建插件、L1/L2、values、links、SSE/WS、localStorage、图库）；不要把 `server/launcher/src` 纳入该扫描，或先移除 launcher 标记。
  - `S3-10`：白名单加 `server/launcher/**`、`docs/guides/**`、`fixtures/s4-details/**`、`docs/plans/stages/S4/**`、根 `pom.xml`。
  - `S1_PORTS`：加 **8602**、**18080**（S4-I 清理断言包含它们）。
- **N7. dispatch 需要 errata（否则 G2/G3 会按旧文字拒绝合法产物）**：
  - §4.9 “不改 transport”与已新增的 §6.5/§6.6 冲突；应改为“仅允许 §6.5/§6.6/§7 的 S4 增补”。
  - §1.6/§4.9 写 `S4-A..S4-H`，plan 写 `A..I`；统一字母（建议 A..H + I，或把 S4-I 合入 S4-H）。
  - §4.8 fixture 草图是 click 根 EXACT + 未关联 fetch，与 `event-model.v1.md` §5 及 D2/D3 的 LOST 根/无 fetch 冲突；确认 D2/D3 为合法偏离，避免 G2 按草图判 fixture 不合格。
- **N8. hello 状态码叙述顺序**：`dispatch.md` §4.5 行文为 413→415→405→400，`api.v1.md` §10.2 固定为 **405→415→413→400**；加一句“判定顺序以 `api.v1.md` §10.2 为准”，否则组合违规（错 CT + 超长 body）测试可能断错。
- **N9. “UI 声明运行时 ×3 是 S6”未落地**：`s4-plan.md` §11 风险表写“README/UI/plan 三处声明”，但 §7 未要求 UI 文案；README/guide 已声明。建议在 `#s4-invocations` 或 `#s4-gaps` 下方加静态说明“×N 为已采集 span 的前端聚合；运行时 ×3 属 S6”，或把风险表改为“README/guide/plan”。
- **N10. agent 握手不得用 `getMessage()`**：`tools/verify/verify.mjs` 的 S2-8 agent forbidden 正则包含 `getMessage\(\)` 与 `"values"`；hello 代码用固定字符串记录错误（或只计数），不要调用异常 `getMessage()`。
- **N11. SDK `version` 导出**：`s4-plan.md` §6 要求 `TraceBoardSDK = {..., version:"0.1.0"}`，但当前 `frontend/sdk/src/index.ts` 没有 `version` 导出；加 `export const version = "0.1.0"`（或对象属性），保持 ESM 8/8 测试不变。
- **N12. stop 的 commandLine 匹配**：`dispatch.md` §4.3 用“`commandLine` 不含记录的 jar”判断；Windows 上 `ProcessHandle.info().commandLine()` 可能为空，或子串匹配 `/a/b.jar` 与 `/a/b.jar.bak` 误判。建议：空 commandLine → `PID_MISMATCH` 拒绝；比较规范化绝对路径（或同时比对 jar 文件名 + 启动时间 `startedAtMs` 容差），并在 guide 说明。
- **N13. `preview_injection` 对上游 4xx/5xx HTML 也会判 PASS**：只检查 `X-TraceBoard-Preview: injected` + 两 script，不检查上游状态；预览 404 错误页可能被注入而“注入检查 PASS”。不算伪造（`app_health` 另判），但建议要求上游 2xx 才 PASS，或在 detail 打印 `upstream=404` 并降为 WARN。

## 5. 验收是否被削弱 / 安全结论

- 未发现把 S5/S6/S7 能力写进 S4 的迹象；未发现源码映射、构建插件、L1/L2、WAR/Tomcat、SSE/WS、持久化、图库、CDN、镜像、secret。
- 未发现把 fixture 冒充运行时 ×3 的表述；`README`/`guide`/`expected-facts.note` 明确“运行时 ×3 是 S6、fixture 仅 UI/测试数据”。
- 未发现“SDK 在浏览器执行已证明”的虚假承诺；`guide` 第 206/242 行明确否认，诊断只证明链路形状。
- 需要特别防止的“假成功”：B1 的 SKIP/SUMMARY 二义性、B2 的 404 错误页被 preview 注入、N13 的上游 4xx 注入；前两项修复后，诊断不会把未验证项写成 PASS。
- 回环边界：`transport.v1.md` §7、`guide` §8 合格；N4 的非回环目标校验是加固项，不构成当前安全漏洞（仅本机工具，但建议加）。

## 6. 复评清单（一轮内可完成）

1. 修 B1：plan §4.6 + guide §6 统一 SKIP/SUMMARY/exit；S4-G 两分支；dispatch errata（如采纳）。
2. 修 B2：定义 `collectorOrigin`；把 demo health/app-url 改为 `/api/orders`；preview 改用 18080 stub 并说明 5174 已内置 SDK；同步 plan §10、guide §3/§4/§5/§6/§7、idea checklist ④。
3. 修 B3：transport §6.6 + plan §4.5 + guide §5 + dispatch errata 的长度/编码/HEAD 规则；S4-D 增加断言。
4. 修 B4：plan §7 增加事件 join 数据源；S4-F 增加 reason/source/confidence 断言。
5. 修 B5：plan §7 增加缺口去重/优先级与逐次 `rows` 规则；S4-F 断言 3 条缺口与 service 逐次 rows。
6. 修 B6：guide 全部 launcher 命令改 `$JAVA21/bin/java`，加 JDK21/JDK8 说明与排障行。
7. 修 N1–N5、N9–N11（文字/选择器/版本导出）；N6 交给 tester 按上表精确迁移；N7/N8 由 dispatcher errata。
8. 复评时重算本文件第 1 节哈希；G1 冻结面只允许本轮列出的文件变化；schema/event-model/status-semantics/S0–S3 fixture 必须零漂移。

## 7. 最终结论

- **Blocking：6（B1–B6）**
- **Non-blocking：13（N1–N13）**
- **G1: FAIL**

说明：FAIL 的原因是“按文档原样执行会失败/契约存在二义”，不是架构不可行；B1–B6 全部是计划/指南/契约文字与测试断言层面的修订，不需要改代码、schema、fixture 或事件语义，可在一轮内修复并复评。

## 8. Re-review 2026-11-23（G1 复评）

- 复评输入：本文件 §3–§4；`docs/plans/stages/S4/dispatch-amendment-01.md`（S4-AMD-01，binding；其日期栏 2026-11-26 按 2026-11-23 生效）；修订后的 `s4-plan.md` v2、`docs/guides/local-launcher.md`、`api.v1.md` §2.4/§8.2/§10、`transport.v1.md` §6.6、`fixtures/s4-details/{README.md,expected-facts.json}`。
- 复评实测：`fixtures/s4-details/events.ndjson` 9/9 通过 Ajv 2020-12 strict；`expected-facts.json` 可解析，groups=3、gaps=3（`ROWS_NOT_COLLECTED`×2 + `NOT_COLLECTED_REASON`）、graph `nodeFields`=14、节点/边=9/8、replay count=9；schema 哈希仍为 `927937df…a489a`；S0–S3 fixture 在 `git status`/`git diff HEAD` 中零改动；`dispatch.md` 哈希仍为 `9dd9809f…951eb`。
- 结论：**G1: FAIL**（B1/B2/B4/B5/B6 已修复；B3 仍有一处新增的契约摘要矛盾，见 R1）。本轮未改代码、schema、fixture，未执行 git 写操作。

### 8.1 复评哈希

| 文件 | SHA256（2026-11-23 实测） | 对比上一轮 |
|---|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` | 未变（与任务给定一致） |
| `docs/contracts/api.v1.md` | `f701f424016156993e1c537aa12d370955cc023530ecfe9e72f580d83bcee4e5` | 修订（§2.4/§8.2/§10） |
| `docs/contracts/transport.v1.md` | `ce26dd8aa72282ee945a290333dfdb30c54f4f3f085b9556820954df525fec03` | 修订（新增 §1 S4 行、§6.5/§6.6/§7） |
| `docs/contracts/event-model.v1.md` | `06ee878e9d3acc3d6a6ff66ee1e1d95c92ac5813913cc1ad84ae3977216025c0` | 未变 |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` | 未变 |
| `docs/guides/local-launcher.md` | `34efa2f67dadb9ce0725b7c38f9434fc10653cd27a7128c62319b01aa253ade1` | 修订 |
| `fixtures/s4-details/events.ndjson` | `75274346ed7593f2aef304d2d7a0989d969e1fdcea4330169422a4cff89d853b` | 未变（9 行字节不变） |
| `fixtures/s4-details/expected-facts.json` | `61c2bfcc79a7a568b03cc759445495a0671ad517be2d2ea1db3a410649117980` | 修订（缺口仍 3、14 字段） |
| `fixtures/s4-details/README.md` | `b4f838500bac3970581b133e47c3bf08b57e6f49220147f4418f70c2a51a8f8a` | 修订 |
| `docs/plans/stages/S4/s4-plan.md` | `9147ce254bd8bc6e861433e02226aac87e65a6fcd7a8df3e1ec7477ff11b2300` | 修订（v2） |
| `docs/plans/stages/S4/dispatch.md` | `9dd9809f4c02bc10739e2eb9c6359fa95aef54872de3ddd87d7bb194312951eb` | 未变（按设计不改） |
| `docs/plans/stages/S4/dispatch-amendment-01.md` | `e6097f63c1c3b6e5160b077c570292bef243dd2283267a2ff7e883a65a6d59dc` | 新增 binding 修订 |

### 8.2 B1–B6 复评

| # | 结论 | 复评证据 |
|---|---|---|
| B1 | **PASS** | `s4-plan.md` §4.6、guide §6 与 S4-AMD-01 §3 一致：七项检查；无 `--preview-url` 时 `preview_injection`/`sdk_script` 均 `SKIP ... reason=no_preview_url`；`agent` 404 → FAIL；0 事件 → WARN；预览非 2xx/`not-injected:*` → FAIL；`SUMMARY` 的 PASS/FAIL 与 `pass=… warn=… fail=… skip=…` 计数和恒为 7；`fail=0` 才 PASS/exit 0，`fail>0` exit 3，用法 exit 2，launcher 内部错误 exit 1；S4-G 有无 preview 两分支均有精确断言。未再出现“SKIP 不计 PASS/exit 3”的表述。 |
| B2 | **PASS** | `--collector` 统一为 collector origin（缺省 `http://127.0.0.1:8601`），ingest 派生 `<base>/ingest/v1/events`，hello 派生 `<base>/ingest/v1/agent-hello`；diagnose 只读 URL 均为 `<base>/actuator/health`、`/api/v1/meta`、`/api/v1/sessions/<id>/agent`、`/events?afterSeq=0&limit=1`，无 `/ingest` 双前缀；`--app-url`/`--health` 用真实 `/api/orders`（demo 仅 `/api/orders` GET 200，无 actuator/静态页；已核对 `OrderController` 与 `pom.xml`）；preview 目标为 18080 静态 stub；guide/plan §10 命令一致。 |
| B3 | **FAIL（R1）** | 细节规则已一致：`transport.v1.md` §6.6、plan §4.5、guide §5、api §10 头部均要求仅 `200 text/html`（charset 缺省/utf-8）注入、移除 `Accept-Encoding`、重算 `Content-Length`、移除压缩/校验/hop-by-hop 头、HEAD/204/304/3xx/4xx/5xx `not-injected:*`、仅反代 `/ingest/v1/events`、`/traceboard/*` 本地外部脚本；S4-D 有长度/编码/HEAD/gzip/status 断言。**但 `transport.v1.md` §1 新增的 S4 预览行写“`/ingest/*` 反代到 collector，其余透传到 `--target`”**，与本文件 §6.6、S4-AMD-01 §4.2、plan §4.5、guide §5、api §10 的“仅 `/ingest/v1/events`；其他 `/ingest/*` → 404；`/traceboard/*` 本地提供”矛盾，属新增契约二义/开放写代理范围问题（见 R1）。 |
| B4 | **PASS** | `api.v1.md` §2.4/§8.2/§10.8 与 plan §7 规定 graph 节点加性固定 14 字段（末尾 `reason/source/confidence`，`flags` 语义不变）；详情数据全部来自 `GET .../graph`，明确取消事件翻页 join；`events`/`seq`/`requests`/`replay`/edges/排序/节点数不变；未改 schema（哈希不变）；expected-facts `nodeFields` 14 项与 README §5.2 对齐。 |
| B5 | **PASS（一条非阻断备注 N14）** | 缺口规则 F > N > R、每 span 最多一条、`nodeKey+reason` 去重、不跨 span 合并；fixture 恰 3 条（mapper1/2 `ROWS_NOT_COLLECTED`、mapper3 `NOT_COLLECTED_REASON` `policy:third_party_package`）；逐次 rows 从 sql 子节点读取（service 1/2 为 `[0]` + `sqlSpanIds`，第 3 次 `未采集`；sql 自身 `0`；缺失一律 `未采集` 绝不为 0）；运行时 ×3 属 S6 在 README/guide/plan/expected-facts/UI 文案落地；`events.ndjson` 字节未变。备注 N14：README §3 表把 mapper1/2 的逐次 rows 写成 `未采集`，而 plan §7/README 同节规则为“否则读子树 sql，标注子 sql”，expected-facts 对 mapper1/2 无 rows 断言；建议下一轮明确（不阻塞）。 |
| B6 | **PASS** | guide §2 固定 `JAVA21`/`JAVA8`；§3–§6、§5.1 所有 launcher/collector 命令均为 `"$JAVA21/bin/java"`，无裸 `java -jar`；demo/agent 显式 `--java "$JAVA8/bin/java"`；§7 有 `UnsupportedClassVersionError` 排障行；plan §10 同步。 |

### 8.3 Non-blocking 复评

- N1–N13 已解决/已记录：N1 IIFE 仓库根 CWD/`--sdk`/env，删除“jar 上两级”；N2 `ProcessBuilder.Redirect.appendTo` + attached tail；N3 删除 `connected=false`，补 `hello_skipped reason=ingest_url` 与“有事件但 agent 404”；N4 `NON_LOOPBACK_TARGET` 回环校验与 `--allow-non-loopback`；N5 `#s4-group-badge` 容器 + `data-node-key` 子元素；N6 S3-1/S2-8/S3-8/S3-10/S1_PORTS/GRAPH_NODE_KEYS 精确迁移；N7 transport 限制与 A..I 字母、§4.8 草图由 S4-AMD-01 errata 处理；N8 hello 顺序以 api §10.2 `405→415→413→400` 为准；N9 ×3 静态说明位于 `#s4-invocations`/`#s4-gaps` 下方；N10 禁用 `getMessage()`；N11 `export const version` 与全局对象；N12 stop 空 `commandLine`/规范化路径/`startedAtMs` 偏差 >5s 拒绝；N13 上游 4xx/5xx 为 `not-injected:status` 且诊断 FAIL。
- N14（新增，非阻断）：`fixtures/s4-details/README.md` §3 的 mapper1/2 逐次 rows 表格文案与同节“子树 sql”规则需统一（expected-facts 未断言该两行，不影响 S4-F 现有断言）。

### 8.4 剩余阻断（R1）

- **R1：`docs/contracts/transport.v1.md` §1 S4 预览行（第 30 行）与 §6.6/plan/guide/api 矛盾。** 该行写“`/ingest/*` 反代到 collector，其余透传到 `--target`”，但 binding 规则是：仅 `/ingest/v1/events` 反代到 `<base>/ingest/v1/events`（其他 `/ingest/*` → 404，不做开放写代理）；`/traceboard/config.js`、`/traceboard/sdk.js` 由 launcher 本地提供；其余方法/路径/查询/头/状态/体按 §6.6 处理（未注入逐字节透传）。
- 精确修复（仅改文档一行）：把该行改为“`/ingest/v1/events` 反代到 collector（其他 `/ingest/*` → 404）；`/traceboard/*` 本地提供；其余透传到 `--target`（响应改写见 §6.6）”。修复后仅需重算 `transport.v1.md` 哈希并复核；无需改代码/schema/fixture。

### 8.5 复评结论

- **B1 PASS、B2 PASS、B3 FAIL（R1）、B4 PASS、B5 PASS、B6 PASS**
- **剩余阻断：1（R1）**；非阻断新增备注 1（N14）
- **G1: FAIL**（一轮内可完成：transport §1 一行文字修正；建议同时统一 N14 文案）

## 9. Final verification 2026-11-23（R1 关闭终验）

- 输入：仅 `docs/contracts/transport.v1.md` §1 第 30 行一处文字修正后的工作树；本文件 §8.2–§8.5 为基线。本轮只读复核 + 仅写本文件，未改代码/schema/fixture，未执行 git 写操作。
- **R1：CLOSED**。`transport.v1.md` 第 30 行现为：“…仅 `/ingest/v1/events` 反代到 collector（其余 `/ingest/*` 返回 404），`/traceboard/config.js` 与 `/traceboard/sdk.js` 由代理本地提供，其余路径透传到 `--target`；仅 200 `text/html` 注入外部脚本（§6.6）”，与 §6.6 第 271–273 行（`/traceboard/*` 本地提供；`/ingest/v1/events` 反代；其他 `/ingest/*` → 404，不做开放写代理）、第 275 行（仅上游 `200` + `text/html` + charset 缺失/utf-8 才注入）、第 281 行（未注入逐字节透传）逐项一致。
- 交叉核对无新增矛盾：`api.v1.md` 第 863 行、`local-launcher.md` 第 157/250 行、`dispatch-amendment-01.md` 第 36/85 行、`s4-plan.md` 第 118/225 行（S4-D 断言）均为“仅 `/ingest/v1/events` 反代，其他 `/ingest/*` 404”。`dispatch.md` 第 111 行仍为旧文（`/ingest/*` 反代），但该文件按设计不改、且 S4-AMD-01 §1 明示冲突时以修订为准（属既有 N7，非本轮引入）。
- B1–B6 结论沿用 §8.2：B1 PASS、B2 PASS、B3 PASS（R1 关闭）、B4 PASS、B5 PASS、B6 PASS。
- 哈希：`schema/traceboard.event.v1.json` `927937df…a489a`（未变）；`api.v1.md` `f701f424…e4e5`、`event-model.v1.md` `06ee878e…25c0`、`status-semantics.md` `9a8735a0…fb56`、`local-launcher.md` `34efa2f6…ade1`、`fixtures/s4-details/{events.ndjson 75274346…853b, expected-facts.json 61c2bfcc…7980, README.md b4f83850…8a8a}`、`s4-plan.md` `9147ce25…2300`、`dispatch.md` `9dd9809f…1eb`、`dispatch-amendment-01.md` `e6097f63…59dc` 全部与 §8.1 相同（零漂移）；仅 `transport.v1.md` 由 `ce26dd8a…fec03` 变为 `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe`（预期的一行文字修正）。
- 剩余阻断：**无**。非阻断备注：N14（`fixtures/s4-details/README.md` §3 mapper1/2 逐次 rows 文案，expected-facts 未断言，不阻塞）。
- **G1: PASS**——冻结面允许进入 S4 实现（G2/G3 按本结论与 §8 复评证据执行）。
