# S3 实施计划（s3-plan）

> 阶段：S3（MVP，frontend facts + read-only replay）｜版本：v2（2026-11-24，G1 前补时钟模型）｜作者：plan-writer
> 上游：`docs/plans/stages/S3/dispatch.md`（绑定简报）、`docs/plans/SOLO-PLAN.md` S3 行 + §4、主计划 §6（案例 B）/§7.3/§8.1–8.5/§13.4/§16 T4/T5/T7/T8/§19 S6/S7
> 下游：coder-sdk、coder-agent、coder-collector、coder-frontend、tester、acceptance（**G1 PASS 后生效**；本文件、S3 契约、S3 fixture 冻结后只读）
> 契约：`docs/contracts/api.v1.md` §2.3/§9/附录 C、`event-model.v1.md` §12、`transport.v1.md` §6.4；fixture：`fixtures/s3-frontend-facts/**`

## 1. 目标与验收映射

S3 只证明四件事：**①runtime SDK 的点击/控件/请求/DOM 事实进入事件流；②案例 A 通过头关联得到 EXACT 全链；③案例 B 在观察窗关闭后确认没发请求；④已存事件可只读回放且 0 写**。

| 分发书 §1 信号 | 本计划落点 | 证据（owner） |
|---|---|---|
| 1 案例 B 确认没发 | §6 SDK、§7 demo、§10 工作台、api §9.3 | 浏览器 click `#btn-save-b` → click 根 + `validateForm RETURNED_FALSE` + render；`fetchCount=0`/`hasBackend=false`；文案“已确认：本次点击因果链内没有网络请求”（orchestrator 浏览器证据 + tester S3-D/F） |
| 2 案例 A 真实关联 | §6/§7/§8 agent、api §9.2 | 浏览器 click `#btn-cancel` → SDK fetch(POST) → 后端 4 span 同 trace；`controller.parentSpanId=fetch.spanId`；全链 EXACT；HTTP 200/SQL 0 不变（tester S3-D/F） |
| 3 0 行可回放、回放 0 写 | §9 collector、transport §6.4 | replay 窗口/排序/两次一致；前后 events/seq/demo 订单不变；0 新事件/0 SQL 写（tester S3-E） |
| 4 状态语义 | §10 工作台、api §9.3 | OK/RETURNED_FALSE/THREW/NOT_COLLECTED_*/TRUNCATED/REDACTED/UNKNOWN/LOST 不同颜色+文字；LOST 只在 confidence（tester S3-G） |
| 5 一次命令全绿 | §12 测试/§12.1 迁移 | `(cd "tools/verify" && npm ci && node verify.mjs)` 覆盖 S3-A..S3-J + S0–S2 回归，exit 0 |
| 6 契约/fixture/证据 | §11、`fixtures/s3-frontend-facts/**`、api/transport/event-model | G1 哈希；S3-H 零漂移；test-report/README/acceptance |

## 2. 范围与 S4 边界

### 2.1 范围内（6 项交付）

1. plan-writer：api/transport/event-model S3 章节 + `fixtures/s3-frontend-facts/**` + 本文件。
2. coder-sdk：`frontend/sdk/**`（TS 独立构建，F0 runtime SDK）+ demo 前端案例 B/SDK 接入/`/ingest` 代理/如实横幅。
3. coder-agent：controller Advice 反射读取 `traceparent`/`X-TraceBoard-Click`，EXACT 关联或 S2 LOST 回退；4 插桩点/flags 不变。
4. coder-collector：`requests` 追加字段 + 派生 confidence；`GET .../replay` 只读窗口；graph 自然混合前后端；meta `replay=true`。
5. coder-frontend：workbench S3 板（混合树/状态图例/案例 B 三文案/时间轴回放/只读横幅/S0–S2 次级）。
6. tester/acceptance：S3 门禁 + test-report；README/验收/归档/commit+tag `s3-baseline`。

### 2.2 S3 明确不做（越界即失败）

- 无构建插件/sourcemap/源码片段/函数行号/L2/JS 局部变量/`values[]`/字段 diff（S5）；SDK 只到 F0（显式 `wrapFn`）。
- 无 launcher/IDEA/JAR 接入向导/预览代理注入/CDP/浏览器扩展（S4）。
- 无节点详情抽屉/×N/手工关联 `/links`/后台轮询车道/时间窗 `INFERRED`（S4/S6）。
- 无像素回放/截图/录像；无 SSE/WebSocket/实时；工作台手动刷新 + 低频轮询。
- collector 不落 DB/文件、无淘汰/采样/缓存/CORS/鉴权/429；回放不写、不重跑、不调 demo。
- 无 Tomcat/React/cloud/MySQL 服务/上传/沙箱；不改 demo 后端、H2 seed、案例 A 行为（2xx 才 toast）。
- 不改 `schema/traceboard.event.v1.json` 字段/枚举/约束；不新增事件类型；不写第二份 schema；不改 S0/S1/S2 fixture。

## 3. 前置与冻结输入

1. G1 PASS（`docs/plans/stages/S3/plan-review.md`）；契约、S3 fixture、本文件冻结。
2. 环境：Windows 10 + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool` 含中文/空格，命令与路径**双引号**；
   Maven 3.9.5；JDK8=`C:/Program Files/Java/jdk1.8.0_221`（demo）；JDK21=`C:/Program Files/Java/jdk-21`（collector/根）；
   Node 22/npm 10；端口 collector 8601（仅 127.0.0.1）、demo 8080、workbench 5173、demo 前端 5174、preview 4173/4174。
3. 开工记录冻结哈希：

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
sha256sum "schema/traceboard.event.v1.json" "docs/contracts/api.v1.md" "docs/contracts/transport.v1.md" \
  "docs/contracts/event-model.v1.md" "fixtures/s3-frontend-facts/README.md" \
  "fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson" \
  "fixtures/s3-frontend-facts/case-a-joined-chain/expected-facts.json" \
  "fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson" \
  "fixtures/s3-frontend-facts/case-b-frontend-only/expected-facts.json" \
  "docs/plans/stages/S3/s3-plan.md" > /tmp/s3-freeze.sha256
netstat -ano | grep -E ":(8601|8080|5173|5174)" || true
```

## 4. 文件地图与所有权（零交集）

| 路径前缀 | owner | S3 新增/修改 |
|---|---|---|
| `docs/contracts/**`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/s3-plan.md` | plan-writer | api §2.3/§9/附录 C；event-model §12/短注；transport §6.4；4 个 fixture 文件 + README；本文件 |
| `frontend/sdk/**`、`demo/buggy-shop-boot-vue/frontend/**` | coder-sdk | SDK 包/构建/单测；`main.ts`/`App.vue`/`vite.config.ts`/`package.json`/`index.html`/样式 |
| `agent/**` | coder-agent | controller 头读取 + Frame confidence + stderr 计数；无新插桩点 |
| `server/collector/**` | coder-collector | requests 字段/派生；replay 路由；meta replay=true；graph 不改形状 |
| `workbench/**` | coder-frontend | S3 板/时间轴/回放/状态图例；S0–S2 面板次级；无图库 |
| `tools/verify/**`、`docs/plans/stages/S3/test-report.md` | tester | S3-A..S3-J + S2 迁移/回归 + 报告 |
| `README.md`、`S3/{acceptance,progress}.md`、archive、git | acceptance | 启动顺序/SDK 接入/curl/verify/案例 B；commit + tag `s3-baseline` |
| `schema/**`、S0/S1/S2 fixture、demo 后端、S0–S2 文档 | 冻结 | 一律只读 |

## 5. 共享契约摘要（实现不得漂移）

| 项 | S3 取值 |
|---|---|
| SDK API | `initTraceBoard({ingestUrl:'/ingest', sessionId:'s_s3demo', appName}) → {wrapFn(name,fn), uiEffect(text)}`；幂等、fail-open、未初始化 no-op |
| 前端事件 | 仅 `ui_event/js_method/fetch/render`；click 根 flags `["SDK_ACTIVE","S3_RUNTIME_SDK","OBSERVE_MS=<实际ms>"]`；子事件 `["SDK_ACTIVE"]`；无 `callback`（demo 不产生） |
| IDs | 每次 click 新 `traceId`(32 hex)+`clickId`(16 hex)+根 `spanId`(16 hex)；每 fetch/XHR 新 `spanId`；`rootEventId=clickId` |
| 头 | `traceparent: 00-<traceId>-<fetchSpanId>-01`；`X-TraceBoard-Click: <clickId>`；仅同源非 ingest；ingest 不加头 |
| agent | 合法头 → controller `traceId/parentSpanId/rootEventId/EXACT`、无 `LOST_BACKEND`；缺失/非法/反射失败 → S2 4-span LOST；stderr `header_unreadable=<n>` |
| requests | 顶层 `sdkActive`；每请求追加 `fetchCount/hasFrontend/hasBackend/backendSpanCount`；S2 字段/排序不变；派生 confidence 见 api §9.2 |
| replay | `{"mode":"replay","readOnly":true,"sessionId","fromNs","toNs","events":[{"seq","event"}]}`；默认 0 / max(startNs+durNs)；`fromNs<=startNs<=toNs`；400/404/405；只读 0 写 |
| graph | 形状不变（11 字段/edges count=1）；click 根 + `controller.parentSpanId=fetch.spanId`；无新字段、无 ×N |
| meta | 5 键不变：`health=true, meta=true, ingestEvents=true, realtime=false, replay=true` |
| 案例 B | `sdkActive=true` + 根为 `ui_event` + `fetchCount=0` + `hasBackend=false` + `OBSERVE_MS` 已记录 → “已确认：本次点击因果链内没有网络请求”；`!sdkActive` → “无法确认：前端采集未接入”；`fetchCount>0 && !hasBackend` → “前端已发请求但后端未采集（LOST）” |
| 时钟 | S3 单机 epoch-ns：SDK `startNs=round((performance.timeOrigin+performance.now())*1e6)`；agent `startNs=System.currentTimeMillis()*1e6+(System.nanoTime()%1e6)`；`durNs` 用单调时钟差值；collector 原样存储；显示 `relNs=startNs−minStartNs`；V1 不跨机器（§5.1、event-model §12.10） |

### 5.1 时钟模型（S3 本机 epoch-ns；G1 前补，契约见 event-model §12.10）

- **问题**：前端 SDK 若用“相对 init”的 `startNs`、后端 agent 用“相对 JVM 启动”的 `startNs`，混在同一图/时间轴/回放里，事件顺序与回放窗口都会错。
- **SDK**：`startNs = round((performance.timeOrigin + performance.now()) * 1e6)`（epoch-ns）；`durNs` 用 `performance.now()` 差值。
- **agent**：span 开始取一次 `startNs = System.currentTimeMillis()*1e6 + (System.nanoTime() % 1_000_000)`；`durNs` 用 `System.nanoTime()` 结束−开始（不用墙钟）。
- 两者同为 epoch-ns、同机可比；**V1 只支持单机**，不跨机器、不做 NTP/偏移校正。JS double 对 ~1.76e18 的 epoch-ns 分辨率约 256ns（对 ms 级墙钟与 UI 足够，不引入 BigInt）。
- **collector 原样存储** `startNs/durNs`，`requests/graph/replay` 均输出原始值，排序仍按原始 `startNs`。
- **显示归一化**：`minStartNs = min(startNs)`（选中 trace 或会话），UI 显示 `relNs = startNs − minStartNs`；滑块/刻度用 rel，
  API `fromNs/toNs` 仍为原始 epoch-ns（请求前 `minStartNs + rel` 换算；不得把相对值当参数发送）。
- fixture（S2 后端-only 相对样例、S3 `fixtures/s3-frontend-facts/**`）的秒级数值仅示意；测试不得假定与运行时绝对相等。
- **风险**：NTP/手动改时会让 `startNs` 在跳变点非单调（`durNs` 与父子链仍可信）；只在单机内承诺顺序，跨机器需后续契约变更。

## 6. SDK 设计（coder-sdk；`frontend/sdk/**`）

- 独立 TypeScript 包：`package.json` + `tsconfig.json`，`npm run build` 产出 ESM + `.d.ts`（`tsc` 或 vite lib 二选一）；无 CDN、无构建插件、无 sourcemap。
- **时间戳**：每个事件 `startNs = round((performance.timeOrigin + performance.now()) * 1e6)`（epoch-ns 整数），`durNs` 用 `performance.now()` 差值 ×1e6；
  不以 `Date.now()` 作为唯一时间来源；见 §5.1。
- `initTraceBoard({ingestUrl, sessionId, appName})`：幂等；初始化时捕获**原生 fetch**（`window.fetch.bind(window)`）供上报；`ingestUrl` 默认 `/ingest`。
  未初始化/初始化失败时 `wrapFn` 原样返回函数、`uiEffect` no-op；SDK 自身所有异常吞掉（fail-open），不改变页面行为。
- 点击采集：`document.addEventListener('click', handler, true)`（捕获阶段）；元素身份优先级 `id` → `data-tb-name` → `role` → 文本（截断）→ DOM 路径，`nodeKey` ≤200。
  每次点击：新 trace/clickId/根 spanId；开 operation；`OBSERVE_MS=1500` 后或在 `pagehide` 时关闭并入库 click 根；
  新点击提前关闭上一 operation（记录实际毫秒），各自独立 trace。
- 因果父节点：`js_method`/`fetch`/`render` 的父 = 当前同步 `wrapFn` 栈顶；无活动包装器 = click 根；`await`/`.then`/timer 续体**不传播**（S6）。
  仅 click 窗口内的事件入库；窗口外的后台请求不采集；click 根 `durNs = 最后因果事件结束 − click 开始`（≥0），不是 1500ms。
- `wrapFn(name, fn)`：保留 `this`/参数/返回值；同步立即记录；返回 Promise 的 settle 时记录；`false` → `RETURNED_FALSE` + `return={boolean:false}`；
  抛异常 → `THREW` 后**原样重抛**；其它值 → `OK` + `return=null`（不记录任意返回值）；`nodeKey=<appName>#<name>`。
- `uiEffect(text)`：记录 `render`（`nodeKey=ui_effect:<text>`，`return={ui_effect:text}`），**不读写 DOM**、不改变页面。
- fetch 包装：只对同源（相对路径）且非 ingest 请求加 `traceparent`+`X-TraceBoard-Click`；`nodeKey=<METHOD> <pathname>`（去 query/hash，≤200）；
  响应到达 → `OK` + `return={http:<status>}`；网络错误 → `THREW`；跨域请求原样放行、不加头；不读 body。
- XHR 包装：`open` 记录 method/url，`send` 时按同规则加头，`load/error` 记录 `OK/THREW`；不采集 body。
- 传输：原生 fetch 到 `${ingestUrl}/v1/events`；NDJSON（紧凑单行、`application/x-ndjson`、末字节 `\n`）；批 ≤100 行/≤4MB；
  buffer 达到阈值或空闲定时 flush；`pagehide` 用 keepalive 尽力 flush；collector 停机只计数丢弃，不影响页面；上报不带 traceparent/click 头。
- 不采集：请求/响应体、表单值、cookie、查询串/hash、任意返回值、异常 message/栈、文件/行号（无 sourcemap）；`source` 不写。
- 轻量单测（Node 内置 test + DOM/fetch stub）：身份优先级、事件形状过 schema、头格式、wrapFn false/throw/Promise、零 fetch 操作不发请求、无 PII 字段。

## 7. Demo 集成（coder-sdk；`demo/buggy-shop-boot-vue/frontend/**`）

- `main.ts`：`initTraceBoard({ingestUrl:'/ingest', sessionId:'s_s3demo', appName:'OrderEdit.vue'})`（appName 与案例 B fixture 的 `OrderEdit.vue#validateForm` 对齐）；幂等、fail-open。
- `vite.config.ts`：新增 `/ingest` → `http://127.0.0.1:8601`（dev + preview）；保留 `/api` → `http://localhost:8080`；IPv4 字面量；无 CORS。
- 案例 A（行为不变）：保留 `fetch('/api/orders/1/cancel',{method:'POST'})`、2xx 才 `showSuccess`、`loadOrders()` 刷新；在 `showSuccess=true` 同位置调用 `uiEffect('操作成功')`；**不额外 `wrapFn` `cancelOrder`**（保持 click→fetch 的 fixture 形状，fetch 由包装器自动采集）。
  不手工加头（fetch 包装自动加）；成功后刷新 GET 可能被同一 click 窗口捕获为第二个 fetch，属预期（不降级 EXACT）。
- 案例 B：新增 `#amount-b`（金额输入）、`#btn-save-b`（保存）；`validateForm` 经 `wrapFn('validateForm', ...)`：
  空/非数字/`<=0` → 显示 `金额必须大于 0` 并 `uiEffect('金额必须大于 0')`，返回 `false`；有效 → 显示 `校验通过（本案例不提交）`，返回 `true`；
  **两个分支都零 fetch**；不采集输入值。
- 横幅（如实）：`runtime SDK · 无构建插件/sourcemap · 案例 A 缺陷（成功提示 + SQL 0 行）+ 案例 B 纯前端校验（零请求）`；
  不写“已支持源码/局部变量”；同步修正 S2-AMD-01 遗留的旧页头文案。
- `npm ci && npm run build` 绿；`dist` 含案例 B id/文案/横幅；无 CDN/在线字体/遥测/构建插件/sourcemap。

## 8. Agent 头关联（coder-agent；先 spike 后完整）

- **Spike（必须先做，留日志证据）**：JDK8 demo（`-javaagent`，`-Dtraceboard.sessionId=s_s3demo`）+ curl 带/不带头 →
  带合法头：controller `confidence=EXACT`、`parentSpanId=<头 parent-id>`、`rootEventId=<clickId>`、无 `LOST_BACKEND`，4 span 同 trace；
  不带头：S2 4-span LOST。任一路径失败 → 首行 `BLOCKED: 原因` + 日志；**绝不合成 EXACT**。
- 反射读取（仅 controller Advice 内，无编译期 Spring/Servlet 依赖）：`Class.forName("org.springframework.web.context.request.RequestContextHolder")`
  → `getRequestAttributes()` → `ServletRequestAttributes#getRequest()` → `HttpServletRequest#getHeader(String)`；读不到按头缺失处理。
- **时间戳**：span 进入时取一次 `startNs = System.currentTimeMillis()*1e6 + (System.nanoTime() % 1_000_000)`；退出用 `System.nanoTime()` 差值算 `durNs`
  （不重取墙钟、不用墙钟算时长）；与 SDK 同为 epoch-ns，同机可比；见 §5.1。
- 严格解析：`traceparent` `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$` 且两 id 非全 0；`X-TraceBoard-Click` `^click_[A-Za-z0-9_-]{8,}$`。
- 合法：controller frame `traceId=<头 traceId>`、`parentSpanId=<头 parent-id>`、`rootEventId=<clickId>`、`confidence=EXACT`、root=false（不是游离根，不写 `LOST_BACKEND`）；
  **即使本地栈为空也不再建游离根**；service/mapper/sql 继承 EXACT/trace/root/父子链。`Frame` 增加 `confidence` 字段，`SpanEmitter` 按 frame 输出（不再硬编码 LOST）。
- 缺失/非法/反射不可读：逐字沿用 S2（随机 traceId、`click_lost_<根spanId>`、LOST、根 `LOST_BACKEND`）；stderr `header_unreadable=<n>`（不写头原文）。
- 不变：4 个插桩点/Advice/flags（全部 `S2_ZERO_ROW_CHAIN`）、jar major 52、shaded、Premain、fail-open、默认 session `s_s2agent`；
  S3 E2E 显式 `-Dtraceboard.sessionId=s_s3demo`；S2 无头 curl 回归仍用 `s_s2agent`。

## 9. Collector 设计（coder-collector；`server/collector/**`）

- `requests`：顶层 `sdkActive`（会话内存在 `ui_event` 且 flags 含 `SDK_ACTIVE`）；每条追加 `fetchCount/hasFrontend/hasBackend/backendSpanCount`；
  S2 字段/排序/聚合/400/404/405/无分页不变；派生 confidence 按 api §9.2（ui_event EXACT + fetchCount=0 → EXACT；controller.parentSpanId∈fetch.spanIds → EXACT；
  有 fetch 无关联 → LOST；后端游离根/无根 → LOST）；未关联 fetch 只标节点、不降级整链。
- `replay`：新增 `GET /api/v1/sessions/{sessionId}/replay`；参数以字符串接收，严格 `^[0-9]+$` + `Long.parseLong`（溢出→400）+ `fromNs<=toNs`；
  默认 `fromNs=0`、`toNs=max(startNs+durNs)`；先 400 后 404；过滤 `fromNs<=startNs<=toNs`；按 `startNs`/`spanId` 排序；
  `events[]` 用存储的 raw JSON（`{"seq":n,"event":<raw>}`，不重排/不重编号）；`mode/readOnly/sessionId/fromNs/toNs` 回显；
  两次相同 GET 逐字一致；无缓存/写入/seq 消耗/DB/文件/demo 调用。
- meta：`capabilities.replay=true`，键仍 5 个；`realtime=false` 不变。
- graph：形状/排序/错误不变；节点自然包含前端 kind（click 根、fetch、render），controller 父=fetch span；不新增字段、不聚合。
- 路由 = S1/S2 六条 + replay（7 条）；`stream/ws/links` 不注册；ingest 零改动；无 CORS/持久化/缓存/SSE/WS。

## 10. Workbench 设计（coder-frontend；`workbench/**`）

- S3 板为主（默认 `s_s3demo`）：`#s3-panel`、`#s3-session`、`#s3-refresh`、`#s3-tabs`（全部/请求/点击）、`#s3-ops`（请求列表）、`#s3-tree`（混合事实树）、
  `#s3-timeline`（relNs 0..max−min）、`#s3-replay-toggle`、`#s3-readonly`（常驻“回放不会重发请求/不写数据库”）、`#s3-caseb`（案例 B 判定区）。
- 树：click→js_method→fetch→controller→service→mapper→sql→render；节点显示 `kind/nodeKey/status/return/sideEffects/flags/thread/durNs`、根 `confidence` 与
  相对时间 `relNs = startNs − minStartNs`（同 trace 最小值；原始 `startNs` 可放在 tooltip/副行）；
  `edges` 决定父子；未关联父节点标游离；不聚合 ×N、无详情抽屉。
- 状态图例（颜色+文字）：`OK` 常规/绿线；`RETURNED_FALSE` 琥珀“正常返回 false”；`THREW` 红/断线；`NOT_COLLECTED_*` 灰虚线 + reason（为什么没采到/怎么开启）；
  `TRUNCATED` 条纹“已截断/已折叠”；`REDACTED` 锁形（fixture 不用但 UI 支持）；`UNKNOWN` 问号；`confidence=LOST` 游离标注；`MANUAL` 虚线（S3 不产生）。
- 案例 B 三文案（逐字，见 api §9.3）：`已确认：本次点击因果链内没有网络请求` / `无法确认：前端采集未接入` / `前端已发请求但后端未采集（LOST）`；
  仅当 `sdkActive=true && 该 trace 根为 ui_event && fetchCount=0 && hasBackend=false && click 根 flags 含 OBSERVE_MS` 才显示“已确认”；`validateForm` 详情只显示控件身份、`false`、DOM 文本、
  `JS 内部变量本次未采集（无构建插件/sourcemap）`，无行号/局部变量。
- 时间轴：先取选中范围（trace/会话）`minStartNs`，滑块 0..`max(startNs+durNs) − minStartNs`；标签/刻度显示 `relNs`；
  拖拽去抖（约 150ms）调用 `/replay?fromNs=<minStartNs>&toNs=<minStartNs+slider>`（**原始 epoch-ns**，不得直接发送相对值）；未来事件隐藏或标“未发生”；
  回放开关切换“全部已存事件/窗口事件”；不自动播放、无速度/暂停（S7 概念图不是 S3 承诺）；回放只 GET、不调 demo、不发写请求。
- S0 `FixturePanel`、S1 假面板、S2 面板保留并折叠为次级（如实标注）；collector 不可达/404/空态不崩；手动刷新 + 低频轮询（非实时）。
- 无图库/画布/SSE/WS/绝对 URL/CORS/自动上报；`npm ci && npm run build` 绿；dist 含上述选择器/图例/文案/只读横幅。

## 11. 契约与 fixture（本计划同步交付）

1. api：§2.3 S3 矩阵（7 路由；replay IMPLEMENTED；stream/ws/links RESERVED）；§9.1 replay 精确形状/参数/排序/400/404/405/0 写；§9.2 requests 字段/派生 confidence；
   §9.3 案例 B 三文案/图例；§9.4 graph 混合语义；§9.5 meta；§9.6 状态码；§9.7 未实现；§9.8 冒烟；附录 C 案例 B；附录 A/B 保留。
2. transport：变更记录；§1 S3 代理/端口；§2 通路 C；§6.2 回放已实现；§6.4 只读 0 写/无 SSE/WS；§7 SDK 隐私；§8 版本化。
3. event-model：§12（SDK kinds/click 根/flags/头关联/EXACT 继承/LOST 回退/纯前端零请求/DOM 效果/区间异步/无 PII）；§5.4 render 解释；§9/§11/§12 边界与样例；**schema 字节不变**。
4. `fixtures/s3-frontend-facts/`：`README.md`；`case-a-joined-chain/{events.ndjson(7),expected-facts.json}`；`case-b-frontend-only/{events.ndjson(3),expected-facts.json}`；
   含 `globalAssertions`/`facts`/`apiExpectations`/`replayWindows`；plan-writer 已用 Ajv 2020-12 strict 离线校验，tester 在 S3-A 复跑。
   **时间值均为 fixture 示意**（秒级相对值），运行时为 epoch-ns（§5.1）；fixture 事件 JSON 字节不改。
5. `status-semantics.md` 不改（S3 不新增状态语义；RETURNED_FALSE/UNKNOWN 等既有语义足够）。

## 12. 测试计划（tester；映射分发书 S3-A..S3-I，新增 S3-J 时钟门禁）

一次命令 `(cd "tools/verify" && npm ci && node verify.mjs)`，非 0 即 FAIL；串行起停，`finally` 清理进程/临时文件/证据文件。

| ID | 断言（精确） |
|---|---|
| S3-A | SDK 构建 + 轻量单测：事件形状过 schema；身份优先级；`traceparent`/`X-TraceBoard-Click` 格式；wrapFn false/throw/Promise；零 fetch 操作**不发送业务 fetch/XHR**（SDK 自身 ingest 上报除外）；无 PII 字段 |
| S3-B | demo 前端构建；dist 含 `#amount-b/#btn-save-b`、`金额必须大于 0`、`校验通过（本案例不提交）`、SDK 横幅；dev+preview `/ingest`→8601、`/api`→8080；无构建插件/sourcemap/CDN |
| S3-C | workbench 构建；dist 含 `#s3-*` 10 个选择器、状态图例、案例 B 三文案、只读横幅；S0/S1/S2 面板保留；无图库/SSE/WS |
| S3-D | 头 E2E（curl）：带合法 `traceparent`+`X-TraceBoard-Click` → controller `EXACT`、`parentSpanId=<头 parent-id>`、`rootEventId=<clickId>`、无 `LOST_BACKEND`、子 span EXACT；无头/非法头 → S2 4-span LOST、`s_s2agent` 不变；`s_s3demo` 两案例并存（浏览器证据由 orchestrator 提供） |
| S3-E | replay：默认/`toNs`/`fromNs` 窗口子集与排序；400（非整数/负数/溢出/from>to）；404 未知会话；405 写动词；两次逐字一致；事件数/seq 不变；demo 订单仍 CREATED；capabilities replay=true |
| S3-F | requests：A `EXACT/fetchCount>=1/hasBackend/backendSpanCount=4/sdkActive=true`；B `EXACT/RETURNED_FALSE/fetchCount=0/hasBackend=false` 且被列出；S2 会话 `LOST/sdkActive=false` |
| S3-G | 状态语义 dist 断言（OK/RETURNED_FALSE/THREW/NOT_COLLECTED_*/TRUNCATED/REDACTED/UNKNOWN/LOST）；无 S4/S5 能力 |
| S3-H | S0–S2 回归按 §12.1 迁移后全绿；S0/S1/S2 fixture 字节未变；S3 G1 哈希零漂移 |
| S3-I | 清理/安全：端口无监听、无 java 残留、0 secret/真实数据/遥测/CDN/镜像；demo 前端仅预期文件变更 |
| S3-J | **时钟模型**：SDK 事件 `startNs` 为 epoch-ns 量级（≥1.6e18，非 0 附近）；agent controller `startNs > fetch.startNs` 且差值 ≤1e9 ns（1s 同机容差）、controller 结束 ≤ fetch 结束 +1e9；混合链按 `relNs=startNs−minStartNs` 归一化后顺序为 click<fetch<controller≤service≤mapper≤sql、render 落在 click 内；workbench 显示 relNs 但 `/replay` 请求仍发原始 `fromNs/toNs`（`minStartNs+rel`）；同一 replay GET 两次逐字一致；测试不断言 fixture 绝对时间、不做跨机器时钟同步/校正 |

- **时钟断言原则（S3-J 细化）**：①顺序断言一律用同一 trace 的 `relNs = startNs − min(startNs)`，不假定起点为 0；
  ②"controller 晚于 fetch"允许 ≤1s 同机容差（浏览器 `timeOrigin` 与 OS 墙钟的微小漂移），但必须严格 `controller.startNs > fetch.startNs`；
  ③replay 过滤/排序/回显全部用原始 epoch-ns，重复 GET 逐字一致（沿用 S3-E）；④fixture 只可断言本目录内数值/顺序，
  不得把 `1000000000`/`2000000000` 当运行时值；⑤V1 单机，测试不得引入跨主机时钟同步或偏移校正断言。

- 浏览器证据：orchestrator 启动 collector/demo/5174，点击案例 A/B、拖动时间轴并截图存 `evidence/`；tester 不断言截图。
- **运行时案例 B 的 handoff**：S3-F 的 B 行必须来自浏览器 SDK 真实事件。若 tester 的 fresh collector 无法保留浏览器会话，orchestrator 先导出
  `s_s3demo` 的 `/events` 为**运行时 capture**（NDJSON，注明来源/时间），tester 把它当“运行时证据”注入自己的 collector；**不得**用
  `fixtures/s3-frontend-facts/case-b-frontend-only` 冒充运行时确认。无 capture 且无浏览器会话 → S3-F 记 FAIL/BLOCKED，不降级。
- 证据：`docs/plans/stages/S3/test-report.md` 写环境、逐项 PASS/FAIL、复现命令、E2E 输出、进程已停声明；禁止改产品/契约/fixture/放宽断言/常驻服务/git。

### 12.1 S2 门禁迁移（§4.8；只改 tester，不放宽其余断言）

| 门禁 | 现状（S2） | S3 迁移 |
|---|---|---|
| `S1-C0` | `capabilities.replay=false` | 期望 `replay=true`；键仍 5 个；其余键不变 |
| `S2-4F` | `/replay` 404 | `/replay` 200（默认窗口）并新增 S3 断言（窗口/排序/两次一致/0 写）；`stream/ws/links` 仍 404 |
| `S2-3` | 无头 curl → `s_s2agent` 4-span LOST | **保留**；S3 头 E2E 另用 `s_s3demo`，不得改变无头回归 |
| `S2-6` | workbench 无时间轴/回放/S3 | 允许 S3 选择器/图例/时间轴/replay/案例 B；仍禁止图库/SSE/WS/详情抽屉/×N；S0/S1/S2 面板仍保留 |
| `S2-8` | collector 6 路由；agent 无 traceparent/clickId；workbench 无 replay/timeline | collector 7 路由（+replay）；agent **允许**头读取（4 插桩点仍精确）；workbench 允许时间轴/replay；仍禁止 S4/S5（sourcemap/values/links/SSE/WS/持久化/图库/CORS） |
| `S2-9` | demo 前端整目录冻结 + S2-AMD-01 单文件文案（template-only） | **改 S3 白名单**：允许 `frontend/sdk/**`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/**` 与 demo 前端预期文件（`src/App.vue`/`src/main.ts`/`vite.config.ts`/`package.json`/`package-lock.json`/`index.html`/`src/style.css`/新增 `src/*.ts`）；删除“无 SDK/collector 调用”与 template-only 断言，改为断言 SDK 接入、`s_s3demo`、`/ingest` 代理、案例 B id/文案、如实横幅、案例 A 2xx toast/刷新逻辑保留、仍只 fetch `/api`（SDK 的 ingest 走 `/ingest`）、无直连 `:8601`/绝对 URL/CDN/构建插件/sourcemap；demo 后端与 schema/S0/S1/S2 fixture 仍冻结，G1 哈希更新为 S3 基线 |

- 保留的 S2 后端事实/回归：H2 0 行（`status='PAID'`、订单仍 `CREATED`）、未知 id `404 {"data":false}`、无头 4-span LOST/`s_s2agent`/`LOST_BACKEND`、
  requests S2 字段与 LOST 派生、graph 4 节点 3 边、fail-open、collector 不持久化、meta 5 键。
- S2-AMD-01 的“单文件文案例外”被 S3 白名单**取代**，不得再作为先例；但 S2 的案例 A 横幅事实（故意缺陷/UPDATE 0 行/后端 agent 采集）必须在 S3 新横幅中保留。

## 13. 精确命令（仓库根；路径双引号）

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
# 构建顺序：SDK → demo 前端 / workbench（demo 依赖 SDK 的 alias）；agent/collector 可并行
(cd "frontend/sdk" && npm ci && npm run build && npm test)
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
(cd "workbench" && npm ci && npm run build)
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# collector（JDK21，127.0.0.1:8601）
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:8601/actuator/health" >/dev/null && break; sleep 1; done
curl -s "http://127.0.0.1:8601/api/v1/meta"     # replay=true，5 键

# demo 后端 + agent（JDK8，S3 会话）
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"
"$JAVA8" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s3demo \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://localhost:8080/api/orders" >/dev/null && break; sleep 1; done
# 无头回归（应仍是 S2 4-span LOST；用 s_s2agent 的 agent 进程另跑一遍）
curl -s -X POST "http://localhost:8080/api/orders/1/cancel" -w "\n%{http_code}\n"

# 头 E2E：先注入 click+fetch 前缀（仅契约测试，非运行时证据），再 curl 带同头
head -2 "fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson" > /tmp/s3-prefix.ndjson
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @/tmp/s3-prefix.ndjson
curl -s -X POST "http://localhost:8080/api/orders/1/cancel" \
  -H "traceparent: 00-1f2e3d4c5b6a79880a1b2c3d4e5f6071-2000000000000002-01" \
  -H "X-TraceBoard-Click: click_a1b2c3d4e5f60718" -w "\n%{http_code}\n"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"   # 期望 EXACT，controller parent=fetch span
# 浏览器：demo 前端 5174（点击 #btn-cancel / #btn-save-b）；workbench 5173（拖时间轴）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev) &
(cd "workbench" && npm run dev) &

# replay 0 写证据
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay" > /tmp/s3-replay1.json
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay" > /tmp/s3-replay2.json
cmp /tmp/s3-replay1.json /tmp/s3-replay2.json && echo "replay identical"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/events?afterSeq=0&limit=500"   # 前后 seq/事件数不变
curl -s "http://localhost:8080/api/orders"                                             # 仍 CREATED

# 门禁
(cd "tools/verify" && npm ci && node verify.mjs)
```

## 14. 构建顺序与并行

1. **G1**：契约 + S3 fixture + 本计划冻结；FAIL 最多返工一轮。
2. **coder-sdk**：先 `frontend/sdk` 独立构建 + 单测（dist ESM + `.d.ts`），再接入 demo 前端（alias `@traceboard/sdk` → `../../../frontend/sdk/src/index.ts`；无 CDN/插件）。
3. **coder-agent / coder-collector / coder-frontend** 可在 G1 后并行；workbench 可先用 G1 fixture 离线开发，不依赖浏览器。
4. **tester**：S3-A..S3-J 一次命令；S2 迁移；浏览器证据由 orchestrator 提供；test-report。
5. **acceptance**：重跑门禁/构建/案例路径；G1 哈希不变；README/progress/acceptance；commit + tag `s3-baseline`；**S3 到此停止，不开始 S4**。

## 15. 风险与缓解

| 风险 | 缓解 |
|---|---|
| SDK 递归/自采集（包装 fetch 后再上报） | 初始化捕获原生 fetch 供传输；跳过 ingest URL；上报不加头；单测断言零 fetch 操作不发请求 |
| CORS/预检（自定义头触发） | 只对同源相对路径且非 ingest 加头；demo/workbench 均走 Vite 代理；collector 不加 CORS；第三方原样放行 |
| 头反射失败（RequestContextHolder/ServletRequestAttributes 不可读） | coder-agent 先 spike；失败 fail-open 走 S2 LOST；`BLOCKED` + 日志；绝不合成 EXACT |
| 混合图根/置信度误导 | requests 派生规则固定；未关联 fetch 只标节点、不降级整链；S2 LOST 保留；UI 标游离 |
| 回放 0 写证明不足 | replay 只读快照 + GET；门禁比较前后 sessions/events/seq 与 demo 订单；测试期间监控无新事件；UI 常驻只读横幅 |
| 案例 B“确认没发”vs“未采集”混淆 | 三条件判定 + 三文案；click 根在观察窗关闭时才入库；`pagehide` 记录实际毫秒；窗口外请求不采集（只声明“本次点击因果链内”） |
| 区间包含/异步续体（fetch 后 uiEffect 越界） | click 根 `durNs` 按窗口内最后事件结束计算；异步续体回落 click 根；fixture 断言嵌套 |
| 批处理时延（click 最后到达） | E2E 轮询 ≤10s；requests/replay 按 startNs 排序；不假设 seq=起始顺序 |
| 墙钟跳变/NTP（epoch `startNs` 非单调） | `durNs` 用 `performance.now()`/`System.nanoTime()` 单调差值；不做校正/同步；单机 V1；跳变点附近顺序可能失真（UI/文档如实标注）；头关联不依赖时间窗 |
| JS Number 精度（epoch-ns ≈1.76e18 > 2^53） | 分辨率约 256ns，对 ms 级 agent 与 UI 足够；`durNs` 为短区间差值不受影响；不引入 BigInt，schema/事件形状不变 |
| PII 泄漏（表单值/请求体/查询串/头） | 只采控件身份、URL pathname、状态码、显式 uiEffect 文本；不采 amount 值/body/cookie；门禁扫描 |
| demo 行为/构建回归 | 案例 A 逻辑与 2xx toast 不变；SDK fail-open；demo JDK8 构建；SDK 独立构建 + alias |
| 契约漂移/S2 回归被放宽 | G1 哈希；§12.1 显式迁移（capabilities/replay 404→200/S3 扫描），其余断言不放宽 |
| 运行时案例 A 多一个刷新 GET | fixture 取 1 条最小链；运行时断言 `fetchCount>=1` 并定位 POST fetch；未关联 GET 不降级 |
| H2 内存库/重启 | demo 重启回到 seed；回放前后订单对比必须在同一 demo 进程内；不引入 MySQL；replay 不写 H2（订单仍 `CREATED`）；门禁报告注明进程生命周期 |
| 浏览器运行时证据与 tester 自起 collector 冲突 | orchestrator 导出运行时 capture（NDJSON）交 tester 注入；无 capture 则 FAIL/BLOCKED，不用 fixture 冒充 |

## 16. 偏离记录（相对 dispatch；均由本计划/任务卡收敛，不扩范围）

| ID | 事项 | 处理与理由 |
|---|---|---|
| D1 | dispatch §4.7 写 case A 6 行（无 render） | 按任务卡落 7 行，含 `render(操作成功)`：运行时案例 A 真实调用 `uiEffect`，6 行会与运行时形状不一致；不改验收信号 |
| D2 | dispatch §4.7 写 case B 4 行（含 saveB） | 按任务卡落 3 行（click→validateForm→render）：demo 只包装 `validateForm`；若实现同时包装 saveB，运行时多一个 `OK` js_method、`fetchCount` 仍 0 |
| D3 | dispatch §4.2 click flags 只列 `SDK_ACTIVE`/`OBSERVE_MS` | 增加 `S3_RUNTIME_SDK` 阶段标记（advisory，类似 `S2_ZERO_ROW_CHAIN`）；不承载关联语义 |
| D4 | dispatch §4.5 replay 示例未回显 `fromNs/toNs` | 按任务卡精确形状回显生效值（便于客户端断言）；不改变窗口语义 |
| D5 | dispatch §4.7 目录布局 vs 任务卡扁平文件名 | 采用 dispatch 子目录 + 每案例 `expected-facts.json`（G1 审阅按 dispatch 路径）；任务卡的“一个 expected-facts”语义由两文件合并满足 |
| D6 | 案例 A render 父级 | 异步续体不传播包装器，render 父=click 根（不是 fetch）；在 fetch 结束后启动但仍在 click 根内；fixture 断言该形状 |
| D7 | `source` 行号 | SDK 事件不写 `source`（无 sourcemap）；agent `source.line` 是示例值，tester 只断言文件名（同 S2 D5） |
| D8 | 空会话 requests | 保留 S2：未知 session 404；本 collector 不创建空会话；`requests:[]` 仅对已存在空会话的理论形状 |
| D9 | curl 单头链路无根 | 只发头的 curl 事件级 controller 可 EXACT，但 requests 无根→LOST；EXACT requests 需真实/注入的 click+fetch；在契约 §12.4 明示 |
| D10 | `status-semantics.md` | 不补 S3 短注：S3 不新增状态语义；案例 B 的“没发”是关联/请求事实，不是 status |
| D11 | dispatch §4.1 写 `startNs` 相对 SDK init；event-model 旧文写“相对会话起点”；dispatch §5.6 写时间轴 0..max | S3 统一为**本机 epoch-ns**（SDK/agent 公式见 §5.1、event-model §12.10）：混图/回放必须同源时钟；工作台时间轴改为 `relNs=startNs−minStartNs`，API `fromNs/toNs` 仍发原始 epoch-ns。schema 字节与 `integer≥0` 不变；schema 内 `description` 文字不改（按 §12.10 解释），不引入跨机器同步 |

## 17. 回滚与完成定义

1. 只有 acceptance 写 git；S3 绿后 tag `s3-baseline`；失败不 tag；不 push/force/rebase。
2. 代码回滚：`git revert <s3-commit>`；单文件还原用 `git checkout s2-baseline -- "<path>"`（仅 acceptance；禁止 `reset --hard`/`clean -f`）。
3. 运行期回滚：去掉 `-javaagent`/`-D` 重启 demo；collector 停服不影响 demo（fail-open）；SDK 初始化失败为 no-op。
4. 契约/fixture 回滚：S3 章节是**追加型**；`fixtures/s3-frontend-facts/**` 为新增目录；删除/修改须回 G1 流程，不得静默漂移。
5. 完成定义：G1 PASS；SDK/demo/agent/collector/workbench 按 §5–§10 实现（含 §5.1 时钟口径）；`tools/verify` 一次命令 exit 0（S3-A..S3-J + S2 迁移回归）；
   test-report/README/progress/acceptance 齐备；schema 字节不变；无 S4/S5 实现；统一标注“无构建插件/sourcemap/局部变量、无 S4 详情/接入、无实时”。

## 18. 变更记录

| 日期 | 版本 | 变更 | 触及文件 |
|---|---|---|---|
| 2026-11-24 | v1 | 首版：S3 SDK/头关联/案例 A/B/requests/replay/工作台/测试迁移、D1–D10 | api.v1.md、transport.v1.md、event-model.v1.md、fixtures/s3-frontend-facts/**、本文件 |
| 2026-11-24 | v2 | G1 前补时钟模型：`startNs` 统一本机 epoch-ns（SDK/agent 公式、collector 原样、显示归一化、fixture 仅示意、NTP 风险、V1 单机）；新增 §5.1、S3-J、D11；SDK/agent/工作台/API/fixture 说明同步；schema 与 fixture JSON 字节不变 | event-model.v1.md、api.v1.md、fixtures/s3-frontend-facts/README.md、本文件 |
