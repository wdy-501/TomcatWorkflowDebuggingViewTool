# S3 前端事实与只读回放 · 任务分发书（dispatch）

> 阶段：S3（MVP，frontend facts + read-only replay）｜角色：task-dispatch｜日期：2026-11-24｜版本：v1
> 权威来源：`docs/plans/SOLO-PLAN.md` S3 行 + §4；主计划 §6（案例 B）、§7.3、§8.1–8.5、§9.1–9.2、§13.4、§16 T4/T5/T7/T8、§19.3（S6/S7 参考线框）；
> S2 交付 `docs/plans/stages/S2/{progress,acceptance,s2-plan,dispatch-amendment-01}.md` 与基线 `s2-baseline`。
> 本文件是 S3 八个下游子代理的唯一任务输入；除 dispatcher 外任何人不得修改。**S3 只做前端事实 + 只读回放，不做 S4。**

## 0. 通用规则（所有人）

1. 一个子代理只执行一张卡：只读「输入」、只写「输出」，其余路径只读；路径含中文/空格，命令与路径必须双引号，从仓库根执行。
2. **只有 acceptance 可写 git**（add/commit/tag）；其他人禁止 git 写操作、禁止 push/force/rebase。
3. 需要越界、契约缺口、指标不达标：停止并在回复首行写 `BLOCKED: 原因`；不许“顺手改一下”。
4. 不用 secret/真实客户数据；不换第三方镜像；不自动下载仅 GitHub 提供的资源；依赖只走 Maven Central/npm 官方源；不引 CDN/在线字体/遥测。
5. 未做/未验证的能力标“S3 未做 / 未采集 / S4/S5 待做”，不得写成“已支持”；**禁止用 fixture 冒充运行时事实**（案例 B 的“没发请求”必须来自浏览器 SDK 运行时）。
6. G1 后契约/s3 fixture/s3-plan 冻结；schema v1 字段/枚举/约束不变。

## 1. 目标与验收信号（SOLO-PLAN S3 行 + 主计划 §6/§16）

| 项 | 口径 |
|---|---|
| 主要工作 | runtime SDK 点击/控件/请求/DOM；纯前端空状态；状态语义；时间轴/只读回放 |
| 完成信号 | **纯前端案例能证明“请求没发”；0 行案例可回放，回放 0 写** |

S3 收尾必须同时证明（缺一即 FAIL）：

1. **案例 B 确认没发**：浏览器点击 `#btn-save-b` 后，`s_s3demo` 中出现 click 根（`SDK_ACTIVE`）、`saveB`/`validateForm`（`RETURNED_FALSE`）与 DOM 效果（`render`）；该 trace `fetchCount=0`、`hasBackend=false`；工作台显示“已确认：本次点击因果链内没有网络请求”。
2. **案例 A 真实关联**：浏览器点击 `#btn-cancel` → SDK fetch（`POST /api/orders/1/cancel`）→ 后端 4 span 同 traceId/rootEventId，`controller.parentSpanId = fetch.spanId`，全链 `confidence=EXACT`；0 行事实（rows=0 / mapper 0 / service true / HTTP 200）不变。
3. **0 行可回放、回放 0 写**：`GET .../replay` 返回窗口内已存事件；调用前后 sessions/events/seq 与 demo H2（订单仍 CREATED）不变；回放期间 0 新事件、0 SQL 写。
4. **状态语义**：OK / RETURNED_FALSE（琥珀）/ THREW（红）/ NOT_COLLECTED_*（灰）/ TRUNCATED / REDACTED 在 UI 有不同颜色+文字；LOST 只出现在 confidence，不伪装成状态。
5. **测试**：`(cd "tools/verify" && npm ci && node verify.mjs)` 一次命令覆盖 S3-A..S3-I 与 S0–S2 回归（§4.8 迁移项显式列出），exit 0。
6. **契约/fixture/证据**：api/transport/event-model 的 S3 章节、`fixtures/s3-frontend-facts/**`、`s3-plan.md`、`test-report.md`、README/progress/acceptance 齐备；G1 冻结面零漂移。

## 2. 范围

### 2.1 S3 范围内（6 项交付）

| # | 交付 | owner |
|---|---|---|
| 1 | api/transport/event-model S3 章节 + `fixtures/s3-frontend-facts/**` + `s3-plan.md` | plan-writer |
| 2 | `frontend/sdk/**` runtime SDK（点击/fetch/XHR/wrapFn/uiEffect）+ demo 前端案例 B 与 SDK 接入 | coder-sdk |
| 3 | agent 读取 `traceparent`/`X-TraceBoard-Click`（反射，无编译期 Spring 依赖） | coder-agent |
| 4 | collector `requests` 扩展字段 + `GET .../replay` 只读回放 | coder-collector |
| 5 | workbench S3 事实板（混合树/状态语义/案例 B 空状态/时间轴回放） | coder-frontend |
| 6 | `tools/verify` S3 门禁 + test-report；README/验收/归档/commit+tag `s3-baseline` | tester / acceptance |

### 2.2 S3 明确不做（S4 边界；越界即失败）

- 无构建插件/sourcemap/源码片段/函数行号/JS 局部变量/`values[]`/字段 diff（S5）；SDK 只到 F0（显式 `wrapFn`）。
- 无 launcher/IDEA/JAR 接入向导/预览代理注入/CDP/浏览器扩展（S4）。
- 无节点详情抽屉/×N 逐次调用/手工关联 `/links`/后台轮询车道/时间窗指纹 `INFERRED`（S4/S6）。
- 无 SSE/WebSocket/实时；工作台仍是手动刷新 + 低频轮询。
- collector 不落 DB/文件、无淘汰/采样/缓存/CORS/鉴权/429；回放不写、不重跑、不调 demo。
- 无 Tomcat/React/cloud/MySQL 服务/上传/沙箱；不改 demo 后端、H2 seed 与案例 A 行为（2xx 才 toast）。
- 不改 `schema/traceboard.event.v1.json` 字段/枚举/约束；不新增事件类型；不写第二份 schema；不改 S0/S1/S2 fixture。

## 3. 强制技术决策（不得协商）

| 项 | 决策 |
|---|---|
| SDK 位置/构建 | 新目录 `frontend/sdk/`（TypeScript，独立 `package.json`+`tsconfig`，`npm run build` 产出 `dist/` ESM + `.d.ts`，`tsc` 或 vite lib 二选一）；demo 前端经 Vite alias `@traceboard/sdk` → `../../../frontend/sdk/src/index.ts` 导入（无 CDN、无构建插件） |
| SDK API | `initTraceBoard({ingestUrl:'/ingest', sessionId:'s_s3demo', appName})` → `{ wrapFn(name, fn), uiEffect(text) }`；幂等、fail-open、未初始化 no-op |
| SDK 采集 | document 捕获阶段 click（身份优先级 `id` → `data-tb-name` → `role` → 文本 → DOM 路径）；包装 `window.fetch` 与 `XMLHttpRequest`；仅同源且非 ingest 请求加头；不采集请求/响应体、表单值、cookie、查询串 |
| 传输 | SDK 用初始化时捕获的**原生 fetch** 发 NDJSON 到 `${ingestUrl}/v1/events`（批 ≤100 行/≤4MB、末字节 `\n`、`application/x-ndjson`），避免递归；collector 停机只丢弃计数，不影响页面 |
| ID/头 | 每次点击新 traceId（32 hex）+ clickId=`click_`+16 hex；每个 fetch/XHR 新 spanId（16 hex）；`traceparent: 00-<traceId>-<fetchSpanId>-01`；`X-TraceBoard-Click: <clickId>`（仅同源、非 ingest） |
| demo 前端 | `/ingest` 代理 → `http://127.0.0.1:8601`（dev+preview，保留 `/api`→8080）；`main.ts` 初始化 SDK（session `s_s3demo`）；案例 A 行为不变（200 才 toast，同位置调用 `uiEffect('操作成功')`）；新增案例 B（`#amount-b`/`#btn-save-b`/错误文本）；横幅如实写“runtime SDK、无构建插件/sourcemap、案例 A 缺陷 + 案例 B 纯前端校验” |
| agent | 仅 controller Advice 内新增请求头读取：JDK8 反射 `org.springframework.web.context.request.RequestContextHolder` → `ServletRequestAttributes#getRequest` → `getHeader`；无编译期 Spring 依赖；无新插桩点 |
| collector | `requests` 响应新增 `sdkActive`（会话级）与每条请求 `fetchCount/hasFrontend/hasBackend/backendSpanCount`；新增 `GET .../replay`（只读窗口）；graph 形状不变（自然混合前后端节点）；meta `capabilities.replay=true`（键仍 5 个） |
| workbench | S3 板为主（默认 `s_s3demo`）；S2/S1/S0 面板折叠为次级；无图库/无详情抽屉/无 S4/S5 |
| 端口 | collector 8601（仅 127.0.0.1）、demo 8080（JDK8）、workbench 5173、demo 前端 5174；冲突先诊断记录，不静默改端口 |

## 4. 共享契约（下游按此实现；细节由 plan-writer 落入契约/s3-plan/fixture）

### 4.1 SDK API 与运行时语义

```ts
initTraceBoard({ ingestUrl: string; sessionId: string; appName: string }): TraceBoardHandle
interface TraceBoardHandle {
  wrapFn<T extends (...args: any[]) => any>(name: string, fn: T): T; // 保留 this/参数/返回值
  uiEffect(text: string): void;                                      // 只记录，不读写 DOM
}
```

- `wrapFn`：同步函数立即记录；返回 Promise 的函数在 settle 时记录；`false` → `RETURNED_FALSE`，异常 → `THREW` 后**原样重抛**，其它值 → `OK` 且 `return=null`（不记录任意返回值，避免 PII）；SDK 自身异常全部吞掉（fail-open）。
- `uiEffect(text)`：记录 `render` 事件（`return={type:"ui_effect",value:<text>}`），不改变页面。
- 点击操作窗口：每次 click 开一个 operation（trace/clickId/rootSpanId），`OBSERVE_MS=1500` 后关闭（`pagehide` 提前关闭并记录实际毫秒）；click 根在关闭时入库，`durNs = 窗口内最后一个因果事件结束 − click 开始`（≥0），保证子事件区间包含于根区间。
- 因果父节点：`js_method`/`fetch`/`render` 的父 = 当前同步 `wrapFn` 栈顶 span；无活动包装器时为 click 根（异步续体不传播，S6）。仅 click 窗口内的事件入库；窗口外后台请求本阶段不采集（UI 只声明“本次点击因果链内”）。
- 线程固定 `{id:0,name:"browser-main"}`；`startNs` 相对 SDK init 的单调纳秒；S3 只产生 `ui_event/js_method/fetch/render`（`callback` 仅在直接包装用户回调时使用，demo 不产生，不得伪造）。

### 4.2 SDK 事件字段（唯一前端事实形状）

| # | kind | nodeKey | parent | status | return | flags |
|---|---|---|---|---|---|---|
| 1 | `ui_event` | 元素身份（`#btn-cancel` / `[data-tb-name=...]` / `tag[role=...]` / 截断文本 / DOM 路径，≤200） | `null` | `OK` | `null` | `["SDK_ACTIVE","OBSERVE_MS=<实际毫秒>"]` |
| 2 | `js_method` | `<appName>#<name>` | 栈顶或 click 根 | `OK`/`RETURNED_FALSE`/`THREW` | false → `{type:"boolean",value:false}`；其它 `null` | `["SDK_ACTIVE"]` |
| 3 | `fetch` | `<METHOD> <pathname>`（去 query/hash，≤200） | 栈顶或 click 根 | `OK`（收到响应）/`THREW`（网络错误） | `{type:"http",value:<status>}` / `null` | `["SDK_ACTIVE"]` |
| 4 | `render` | `ui_effect:<text>`（≤200） | 栈顶或 click 根 | `OK` | `{type:"ui_effect",value:<text>}` | `["SDK_ACTIVE"]` |

- 同一 operation 共用 `traceId`/`rootEventId=clickId`；click 根 `confidence=EXACT`（浏览器内直接观测），其余继承 `EXACT`；无 PII、无 `values`/`reason`、无异常 message/栈。
- `X-TraceBoard-Click` 值必须等于该 click 的 `rootEventId`；`traceparent` 的 parent-id 必须是该 fetch 事件自己的 `spanId`（供后端父关联）。

### 4.3 agent 头关联（S2 行为在无头时逐字保留）

- controller 进入时反射读取当前 HTTP 请求头；`traceparent` 匹配 `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$`（两 id 非全 0）、`X-TraceBoard-Click` 匹配 `^click_[A-Za-z0-9_-]{8,}$` 时：
  controller frame `traceId=<头 traceId>`、`parentSpanId=<头 parent-id>`、`rootEventId=<clickId>`、`confidence=EXACT`、**无 `LOST_BACKEND`**；service/mapper/sql 继承 `EXACT` 与链。
- 头缺失/非法/反射不可读：**完全沿用 S2**（随机 traceId、`click_lost_<根spanId>`、`LOST`、根带 `LOST_BACKEND`），stderr 计数 `header_unreadable=<n>`；不猜、不合成。
- 4 个插桩点与 flags 不变（全部 `S2_ZERO_ROW_CHAIN`；`LOST_BACKEND` 只在 LOST 根）；S3 E2E 用 `-Dtraceboard.sessionId=s_s3demo` 与 SDK 同会话；默认 session 仍 `s_s2agent`（S2 回归）。

### 4.4 `GET /api/v1/sessions/{sessionId}/requests`（S3 扩展，只读）

```json
{"sessionId":"s_s3demo","sdkActive":true,"requests":[{"traceId":"<32hex>","rootSpanId":"<16hex>",
 "rootKind":"ui_event","nodeKey":"#btn-save-b","status":"RETURNED_FALSE","confidence":"EXACT",
 "spanCount":4,"startedAtNs":0,"durNs":2100000,"hasError":false,
 "fetchCount":0,"hasFrontend":true,"hasBackend":false,"backendSpanCount":0}]}
```

- S2 字段全部保留、含义不变；新增字段**追加**，不做重命名/去字段。
- `sdkActive`（顶层）= 会话内存在带 `SDK_ACTIVE` flag 的 `ui_event`；`fetchCount` = 该 trace 的 `kind=fetch` 数；`hasFrontend` = 存在 `ui_event/js_method/fetch/callback/render`；`hasBackend` = 存在 `controller/service/mapper/sql/jdbc/async`；`backendSpanCount` = 后者条数。
- `confidence` 派生（优先于 S2“取根 span”）：根为 `ui_event` 且 `EXACT` 时——`fetchCount=0` → `EXACT`（案例 B，无可关联请求）；存在 `controller.parentSpanId` 等于本 trace 某 `fetch.spanId` → `EXACT`（案例 A）；有 fetch 但无任何后端关联 → `LOST`。根为后端游离根/无根 → `LOST`（S2 不变）。未关联的单个 fetch（如 GET /api/orders 未插桩）只在该节点标“后端未采集”，**不把整条 EXACT 链降级**。
- 排序/400/404/405/无分页/只读语义不变；空会话 `{"sessionId":"...","sdkActive":false,"requests":[]}`。

### 4.5 `GET /api/v1/sessions/{sessionId}/replay?fromNs=<int>&toNs=<int>`（S3 新增，只读）

```json
{"mode":"replay","readOnly":true,"sessionId":"s_s3demo",
 "events":[{"seq":1,"event":{<event-v1>}},{"seq":2,"event":{<event-v1>}}]}
```

- `fromNs` 缺省 0；`toNs` 缺省 = 会话内 `max(startNs+durNs)`（空会话 0）；两者必须匹配 `^[0-9]+$` 且 `fromNs<=toNs`，否则 `400 bad_request`；未知 session `404 not_found`；只 GET（写动词 405）。
- 过滤 `fromNs <= startNs <= toNs`；`events[]` 按 `startNs` 升序、同值 `spanId` 字典序；item 与 `/events` 相同（`{seq,event}`，event 逐字、可过冻结 schema）。
- **只读**：读时派生自内存快照；不写事件、不消耗 seq、不缓存、不调 demo、不执行程序；两次相同 GET 逐字一致；`mode="replay"`、`readOnly=true` 为契约字段，客户端不得据此发写请求。
- meta：`capabilities.replay=true`、`realtime=false`、`ingestEvents=true`、`health/meta=true`（键仍 5 个）；`stream/ws/links` 仍 404。

### 4.6 案例 B 语义与状态图例（工作台判定规则）

| 证据组合 | 判定 | 界面文案（逐字） |
|---|---|---|
| `sdkActive=true` 且该 trace `fetchCount=0` 且 `hasBackend=false` | 确认没发（观察窗已关闭） | `已确认：本次点击因果链内没有网络请求` |
| 会话 `sdkActive=false`（SDK 未接入/无 click 根） | 无法确认 | `无法确认：前端采集未接入` |
| `fetchCount>0` 且 `hasBackend=false`（含 fetch 失败节点） | 发了但后端没记录/请求失败 | `前端已发请求但后端未采集（LOST）`；失败 fetch 节点单独标失败，不并入“没发” |
| `fetchCount>0` 且存在 link 的后端 | 关联成功 | 展示混合事实链，不写“没发” |

- 状态图例（颜色+文字，不靠颜色单独传达）：`OK` 常规/绿线；`RETURNED_FALSE` 琥珀“正常返回 false”；`THREW` 红/断线；`NOT_COLLECTED_*` 灰虚线 + `reason`（“为什么没采到/怎么开启”）；`TRUNCATED` 条纹“已截断/已折叠”；`REDACTED` 锁形（值级，S3 fixture 不使用但 UI 必须支持）；`UNKNOWN` 问号；`confidence=LOST` → 游离标注，`MANUAL` 虚线（S3 不产生）。
- 案例 B 的 `validateForm` 节点详情只显示：控件身份、返回值 `false`、DOM 效果文本、事实 `JS 内部变量本次未采集（无构建插件/sourcemap）`；**不显示行号/局部变量**。

### 4.7 契约与 fixture 变更（plan-writer）

1. `docs/contracts/api.v1.md`：新增 S3 矩阵（replay IMPLEMENTED；stream/ws/links RESERVED；requests 新增字段；graph 混合节点；meta replay=true）；§9 定义 §4.4/§4.5/案例 B 判定；附录 C 案例 B（`#amount-b`/`#btn-save-b`、`金额必须大于 0`、`校验通过（本案例不提交）`、零 fetch）；附录 B（案例 A）不变。
2. `docs/contracts/transport.v1.md`：S3 变更记录、§1 端口/代理、§6.4 回放只读（0 写、不重发、不调 demo）。
3. `docs/contracts/event-model.v1.md`：S3 §12——SDK 事件/click 根/`SDK_ACTIVE`/`OBSERVE_MS`/头关联/EXACT 继承/LOST 保留；**schema 字节不变**；`status-semantics.md` 仅确需时补案例 B 判读短注。
4. `fixtures/s3-frontend-facts/`：
   - `case-a-joined-chain/{events.ndjson,expected-facts.json}`：6 行 click→fetch→controller→service→mapper→sql，同 trace/clickId、全 `EXACT`、`controller.parentSpanId=fetch.spanId`、区间嵌套、SQL rows 0/UNKNOWN、flags `SDK_ACTIVE`/`S2_ZERO_ROW_CHAIN`；expected 含 `globalAssertions` 与 `replayWindows`。
   - `case-b-frontend-only/{events.ndjson,expected-facts.json}`：4 行 click→saveB→validateForm（`RETURNED_FALSE`，`saveB` 下另有 render DOM 效果）、零 fetch/零后端、`SDK_ACTIVE`；expected 含 `replayWindows` 与 requests 字段期望（fetchCount 0 / hasBackend false / status RETURNED_FALSE）。
   - `README.md`：real-vs-synthetic——fixture 是契约形状不是运行时证据；运行时由 demo SDK E2E 提供；无 PII。
5. `docs/plans/stages/S3/s3-plan.md`：步骤、精确命令、S3-A..S3-I 映射、T4/T7/T8 口径、风险、回滚。

### 4.8 S2 门禁迁移（不得放宽其余断言）

- `S1-C0`：capabilities 期望 `replay` 由 false 改 true（键仍 5 个）；其余键不变。
- `S2-4F`：`/replay` 由 404 改为 200（默认窗口）并新增 S3 断言；`stream/ws/links` 仍 404。
- `S2-6`/`S2-8`：范围扫描升级为 S3 口径——允许 demo 前端出现 SDK/traceparent/clickId、agent 出现头读取、collector 注册 replay、workbench 出现时间轴；仍禁止 S4/S5（sourcemap/values/links/SSE/WS/持久化/图库）。
- `S2-3`：无头 curl 仍必须是 S2 的 4-span LOST 链（默认 `s_s2agent`）；`S2-9` 预期变更路径改为 S3 白名单（含 `frontend/sdk/**`、demo 前端、agent/collector/workbench/tools/verify/契约/fixture/文档）。

## 5. 任务卡

### 5.1 plan-writer（契约与 fixture，不写代码）
- 输入：本文件 §1–§4、S0–S2 冻结契约/schema/fixture、主计划相关章节。
- 输出（只写）：`docs/contracts/api.v1.md`、`docs/contracts/transport.v1.md`、`docs/contracts/event-model.v1.md`（仅确需短注时）、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/s3-plan.md`。
- 完成判据：§4.1–§4.8 全部落入契约/fixture；两个 fixture 过 schema 且含 replayWindows/不变量（单 click 根、controller 父=fetch spanId、区间嵌套、零 fetch 案例 B）；s3-plan 含步骤/精确命令/风险/回滚；schema 字节不变；无 S4/S5 内容。
- 禁止：写代码/pom/TS、改 schema 字段/枚举、改 S0/S1/S2 fixture、git、真实数据/外网 `$ref`。

### 5.2 plan-reviewer（只读，G1 门）
- 输入：本文件、plan-writer 全部输出、S0–S2 契约/schema、主计划 §6/§8/§13。
- 输出（只写）：`docs/plans/stages/S3/plan-review.md`——逐项 PASS/FAIL、阻断/建议、契约+s3 fixture+s3-plan+dispatch 的 SHA256 冻结基线、`G1: PASS|FAIL`。
- 核查：①SDK API/事件/头/flag 与 §4.1/§4.2 一致且无 PII；②agent EXACT/LOST 双路径与 §4.3 一致；③requests/replay 形状/派生/错误/只读与 §4.4/§4.5 一致；④案例 B 判定与 §4.6 一致；⑤fixture 过 schema、区间/父链/replayWindows 正确；⑥schema 字节不变、S0–S2 fixture 未改；⑦无 S4/S5 越界。
- 禁止：替作者改文件、写代码、引入 S4/S5、git。

### 5.3 coder-sdk（frontend/sdk + demo 前端）
- 输入：本文件 §3–§4.2/§4.6/§4.7、G1 冻结契约/fixture、demo 前端现状。
- 输出（只写）：`frontend/sdk/**`、`demo/buggy-shop-boot-vue/frontend/**`（`src/App.vue`、`src/main.ts`、`vite.config.ts`、`package.json`、`index.html`、样式）。
- 完成判据：SDK 独立构建（tsc/vite lib，dist ESM+d.ts）+ 轻量单测（Node 内置 test + DOM/fetch stub，覆盖身份优先级/事件形状/头格式/wrapFn false/throw/Promise/零 fetch 不发请求）；`initTraceBoard`/`wrapFn`/`uiEffect` 按 §4.1；fetch+XHR 包装、仅同源非 ingest 加头、原生 fetch 批量传输；fail-open；案例 A 行为不变并调用 `uiEffect('操作成功')`；案例 B：`saveB` 与 `validateForm` 均经 wrapFn，amount<=0 → 显示 `金额必须大于 0` 且零 fetch，有效 → 显示 `校验通过（本案例不提交）` 且零 fetch，DOM 效果经 `uiEffect`；`/ingest` 代理 dev+preview；横幅如实；`npm ci && npm run build` 绿；无 CDN/插件/sourcemap。
- 禁止：改 agent/collector/workbench/契约/fixture、构建期注入插件、采集表单值/请求体/查询串/cookie、伪造事件、git。

### 5.4 coder-agent（agent/**）
- 输入：本文件 §4.3、agent 现状、S2 回归断言（`S2-3`/`S2-8`）。
- 输出（只写）：`agent/**`。
- 完成判据：先 spike（JDK8 demo + 带头 curl → EXACT；无头 → LOST；日志证据），再完整；反射 `RequestContextHolder` 读取头（无 Spring 编译依赖）；头解析/校验失败走 S2 LOST；Frame 携带 confidence 并被子 span 继承；flags/4 插桩点/jar major 52/Premain/shaded 不变；collector 停机仍 fail-open；stderr `header_unreadable` 计数；无头 S2 4-span 逐字回归。
- 禁止：新插桩点/新 Advice、Spring/MyBatis 依赖、记录头原文/请求体、伪造 EXACT、改 demo 后端/契约、git。

### 5.5 coder-collector（server/collector/**）
- 输入：本文件 §4.4/§4.5、collector 现状、S2 gate。
- 输出（只写）：`server/collector/**`。
- 完成判据：requests 新增 `sdkActive` 与每条 `fetchCount/hasFrontend/hasBackend/backendSpanCount`，S2 字段/排序/聚合不变；confidence 派生按 §4.4；replay 端点参数/窗口/排序/400/404/405/只读/两次一致；meta replay=true 且键仍 5；graph 形状不变并自然包含前端节点；无持久化/缓存/新写通路；路由 = S1/S2 六条 + replay。
- 禁止：改 ingest 语义、schema、graph 形状、stream/ws/links、DB/文件、缓存、git。

### 5.6 coder-frontend（workbench/**）
- 输入：本文件 §4.4–§4.6、G1 契约/fixture、collector API、workbench 现状。
- 输出（只写）：`workbench/**`。
- 完成判据：S3 板为主（默认 `s_s3demo`）+ `全部/请求/点击` tabs + 混合事实树（click→js_method→fetch→controller→service→mapper→sql→callback/render）；节点事实（kind/nodeKey/status/return/sideEffects/flags/thread/startNs/durNs/根 confidence）；§4.6 状态图例与案例 B 三文案；时间轴 0..max + 回放开关（拖拽去抖调用 `/replay?toNs=`，未来事件隐藏/“未发生”）；常驻 `回放不会重发请求/不写数据库`；S0/S1/S2 折叠次级；稳定选择器 `#s3-panel/#s3-session/#s3-refresh/#s3-tabs/#s3-ops/#s3-tree/#s3-timeline/#s3-replay-toggle/#s3-readonly/#s3-caseb`；collector 不可达/404/空态不崩；`npm ci && npm run build` 绿；无图库/详情抽屉/×N/S4/S5。
- 禁止：回放发写请求/调 demo 后端、绝对 URL/CORS、SSE/WS、图库、自动上报、改契约/fixture、git。

### 5.7 tester（S3 独立验证，不改产品代码）
- 输入：全部 S3 产物、G1 冻结哈希、本文件 §4、冻结契约/fixture。
- 输出（只写）：`tools/verify/**`、`docs/plans/stages/S3/test-report.md`。
- 门禁（一次命令、非 0 即 FAIL，串行起停并在 `finally` 清理）：

| 组 | 断言 |
|---|---|
| S3-A | SDK 构建 + 轻量单测：事件形状过 schema、身份优先级、`traceparent`/click 头格式、wrapFn false/throw/Promise、零 fetch 操作不发请求；无 PII 字段 |
| S3-B | demo 前端构建；dist 含案例 B id/文案/横幅；dev+preview `/ingest`→8601、`/api`→8080；无构建插件/sourcemap/CDN |
| S3-C | workbench 构建；dist 含 S3 选择器/状态图例/案例 B 文案/只读横幅；S0/S1/S2 面板保留；无图库/SSE/WS |
| S3-D | 浏览器/HTTP 关联 E2E：SDK 会话注入（或 curl 带头）→ controller EXACT、parent=fetch spanId、rootEventId=clickId、子 span EXACT；无头/非法头 → S2 LOST 4-span；`s_s3demo` 会话两案例并存 |
| S3-E | replay：默认/`toNs`/`fromNs` 窗口子集与排序；400（非整数/负数/from>to）；404 未知会话；405 写动词；两次一致；事件数/seq 不变；demo 订单仍 CREATED；capabilities replay=true |
| S3-F | requests：案例 A EXACT/fetchCount≥1/hasBackend/backendSpanCount=4/sdkActive=true；案例 B EXACT/RETURNED_FALSE/fetchCount=0/hasBackend=false 且被列出；S2 会话 LOST/sdkActive=false |
| S3-G | 状态语义 dist 断言（OK/RETURNED_FALSE/THREW/NOT_COLLECTED_*/TRUNCATED/REDACTED/UNKNOWN/LOST）；无 S4/S5 能力 |
| S3-H | S0–S2 回归按 §4.8 迁移后全绿；S0/S1/S2 fixture 字节未变；G1 哈希零漂移 |
| S3-I | 清理/安全：端口无监听、无 java 残留、0 secret/真实数据/遥测/CDN/镜像、demo 前端仅预期文件变更 |

- 证据：`test-report.md` 写环境、逐项 PASS/FAIL、复现命令、E2E 输出、进程已停声明；浏览器证据由 orchestrator 提供（点击案例 A/B、拖动时间轴、截图存 `evidence/`），tester 不断言截图。
- 禁止：改产品/契约/fixture、放宽断言、常驻服务、git。

### 5.8 acceptance（唯一 git 写入者，G2 门）
- 输入：全部 S3 产物、8 张卡、G1 报告、tester 报告。
- 输出（只写）：`README.md`、`docs/plans/stages/S3/{acceptance.md,progress.md}`、`docs/plans/archive/stage-S3-2026-11-24/**`、git commit + tag `s3-baseline`。
- 完成判据：①亲自重跑门禁与构建，不信报告；②G1 后契约/s3 fixture/s3-plan 哈希不变；③§2.2 越界零实现；④安全（无 secret/真实数据/遥测/CDN/镜像）；⑤README 写 S3 状态/启动顺序/SDK 接入/curl/verify/案例 B 路径；⑥progress.md 按 SOLO-PLAN §4；⑦按文件名 add + commit + tag；⑧S3 到此停止，不开始 S4。
- 禁止：push/force/rebase、测试未绿打 tag、代改代码、开工 S4。

## 6. 路径归属矩阵（零交集）

| 路径前缀 | owner | 其他人 |
|---|---|---|
| `docs/plans/stages/S3/dispatch.md` | dispatcher | 只读 |
| `docs/contracts/**`、`fixtures/s3-frontend-facts/**`、`docs/plans/stages/S3/s3-plan.md` | plan-writer | 只读 |
| `docs/plans/stages/S3/plan-review.md` | plan-reviewer | 只读 |
| `frontend/sdk/**`、`demo/buggy-shop-boot-vue/frontend/**` | coder-sdk | 只读 |
| `agent/**` | coder-agent | 只读 |
| `server/collector/**` | coder-collector | 只读 |
| `workbench/**` | coder-frontend | 只读 |
| `tools/verify/**`、`docs/plans/stages/S3/test-report.md` | tester | 只读 |
| `README.md`、`docs/plans/stages/S3/{acceptance.md,progress.md}`、archive、git | acceptance | 只读 |
| `schema/**`、`fixtures/case-a-zero-rows/**`、`fixtures/s1-walking-skeleton/**`、`fixtures/s2-zero-row-chain/**`、demo 后端、S0–S2 文档 | 冻结 | 一律只读 |

## 7. 架构（S3 数据流）

```text
浏览器 demo 前端 5174 (Vue3)                         collector 127.0.0.1:8601
  └─ runtime SDK (frontend/sdk)                          ▲  ├─ ingest（唯一写入，202/400/413/415）
       ├─ 点击/控件/fetch/XHR/UI 效果事件 ── NDJSON ──────┘  ├─ sessions/events（只读查询）
       └─ traceparent + X-TraceBoard-Click（同源 /api）       ├─ requests（S3 字段 + 派生 confidence）
             ▼                                                ├─ graph（混合前后端节点）
   Vite proxy /api → demo 8080                                └─ replay（只读窗口，0 写）
             ▼                                                        ▲
   demo 后端 JDK8 + javaagent ── controller→service→mapper→sql ───────┘
        └─ 反射读头：EXACT 继承 / 无头=LOST；H2 内存库（0 行证据）
                                                              ▲
   工作台 5173 (Vue3+Pinia) ── /api、/ingest 代理（只读查询；时间轴回放）┘
```

## 8. 顺序与门禁

`dispatcher → plan-writer → plan-reviewer(G1) → (coder-sdk ∥ coder-agent ∥ coder-collector ∥ coder-frontend) → tester → acceptance(G2，commit+tag s3-baseline) → 阶段备份/总结`

- G1 之前 coder 不得动工；G1 FAIL 最多返工一轮，仍 FAIL 则上报，不降级放行。
- G1 冻结：契约、s3 fixture、s3-plan、dispatch 哈希；此后再改字段/形状必须停回本流程。
- 四个 coder 可并行，但契约/fixture 是唯一事实输入；workbench 可用 G1 fixture 离线开发。
- S3 检查点到达即停；**不得开始 S4（本地启动器/IDEA/JAR/详情/×N）**。

## 9. 环境事实（不得改写）

- Windows 10 + Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool` 含中文与空格，所有命令双引号。
- Maven 3.9.5；默认 `JAVA_HOME`=JDK 1.8.0_221；JDK21=`C:/Program Files/Java/jdk-21`；根/collector 就地覆盖 `JAVA_HOME`，demo 用 JDK8 绝对路径。
- Node 22.x / npm 10.x；Maven Central/npm 官方源可达；无第三方镜像、无外部 CDN/在线字体/遥测。
- collector 仅 `127.0.0.1:8601`；demo 8080；workbench 5173；demo 前端 5174；代理目标用 IPv4 字面量（避免 `[::1]`）；冲突先诊断。
- git：分支 `master`、无 remote；只有 acceptance 写 git；无 secret/真实客户数据。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| SDK 递归/自采集（包装 fetch 后再上报） | 初始化时捕获原生 fetch 供传输；跳过 ingest URL；上报不加 traceparent/click 头；单测断言 |
| CORS/代理（自定义头触发预检；cross-origin 被破坏） | 只对同源（相对路径）且非 ingest 请求加头；demo/workbench 均走 Vite 代理；collector 不加 CORS；第三方请求原样放行 |
| 头传播反射失败（RequestContextHolder/ServletRequestAttributes 不可读） | coder-agent 先 spike；失败 fail-open 走 S2 LOST；不猜；BLOCKED 需日志证据；绝不合成 EXACT |
| 混合图根/置信度误导（click 根 vs 游离后端根） | requests 派生规则固定（§4.4）；未关联 fetch 只标节点、不降级整链；S2 LOST 保留；工作台 LOST/游离标注 |
| 回放 0 写证明不足 | replay 只读快照 + GET；门禁比较前后 sessions/events/seq 与 demo 订单状态；测试期间监控无新事件；UI 常驻只读横幅 |
| 案例 B“确认没发” vs “未采集”混淆 | 三条件判定（sdkActive/fetchCount/hasBackend）+ 三文案；click 根在观察窗关闭时才入库；pagehide 提前关闭记录实际毫秒；窗口外后台请求不采集（只声明“本次点击因果链内”） |
| 区间包含/异步续体（fetch 后 uiEffect 越界） | click 根 `durNs` 按窗口内最后事件计算；异步续体回落到 click 根（不传播）；fixture 断言嵌套 |
| 批处理时延（click 最后到达） | E2E 轮询 ≤10s；requests/replay 按 startNs 排序；不假设 seq=起始顺序 |
| PII 泄漏（表单值/请求体/查询串/头） | 只采控件身份、URL pathname、状态码、显式 uiEffect 文本；不采 amount 值/body/cookie；门禁扫描事件字段 |
| demo 行为/构建回归 | 案例 A 逻辑与 2xx toast 不变；SDK fail-open；demo JDK8 构建；SDK 独立构建 + alias 导入 |
| 契约漂移/S2 回归被放宽 | G1 哈希；§4.8 显式迁移（capabilities/replay 404/S3 扫描），其余断言不放宽 |

## 11. 停止条件与出口纪律

1. 头反射在 JDK8/Spring 5 demo 经 spike 仍不可读，或必须伪造 EXACT 才能显示关联 → `BLOCKED` + 日志；不得降级。
2. 必须改 schema v1 字段/枚举/事件类型，或必须引入 `values[]`/sourcemap/构建插件（S5）才能达标。
3. 案例 B“确认没发”必须靠伪造事件/无观察窗也宣称确认；或回放必须写库/重跑程序才能实现。
4. SDK 无法避免递归/CORS，或会改变案例 A 行为/让页面报错。
5. G1 FAIL 且一轮返工后仍 FAIL；任务要求改他人路径、推翻 §3 决策、引入 S4/S5。
6. 测试未绿但 owner 想“先提交再说”；出现 secret/真实数据/第三方镜像。
7. S3 只证明“前端事实（点击/控件/请求/DOM）+ 案例 B 确认没发 + 状态语义 + 只读回放”；UI/README/报告必须注明无构建插件/sourcemap/局部变量、无 S4 详情/接入、无实时；S3 通过也不得宣称产品完成，S4 需新的分发书。
