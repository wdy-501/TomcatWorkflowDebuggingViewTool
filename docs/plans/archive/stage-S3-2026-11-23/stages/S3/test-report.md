# S3 测试报告（tester 独立验证）

> 阶段：S3（MVP：frontend facts + read-only replay）｜角色：tester｜日期：2026-11-23｜基线：G1 PASS（`plan-review.md`）
> 交付物：`tools/verify/verify.mjs`（S0 + S1 + S2 迁移 + S3 单一命令门禁）+ 本报告
> 结论：**S3 TEST: PASS**（51/51 gate 绿，`node verify.mjs` exit 0；本报告定稿前后连续两次完整运行结果一致）
> 未修改产品/契约/schema/fixture；本报告与 `tools/verify/**` 是 tester 唯一写入路径。

---

## 1. 环境（实测）

| 项 | 值 |
|---|---|
| OS | Windows 10（Windows_NT 10.0.29708，x64） |
| 仓库 | `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文 + 空格，命令全部双引号） |
| Node / npm | `v22.22.2` / `10.9.7` |
| JDK21（根 reactor / collector） | `C:/Program Files/Java/jdk-21`（`java version "21" 2023-09-19 LTS`） |
| JDK8（demo 后端 / agent） | `C:/Program Files/Java/jdk1.8.0_221` |
| Maven | 3.9.5（JDK8 默认 JAVA_HOME；根/collector 就地覆盖为 JDK21） |
| 网络/镜像 | 仅 Maven Central / `registry.npmjs.org`；无 `.npmrc`、无第三方镜像、无 CDN/遥测 |
| 端口 | collector `127.0.0.1:8601`；demo `8080`；workbench dev `5173`；demo 前端 `5174` / preview `4174`；preview `4173` |

本次最终运行（run 7）：`started: 2026-11-23T05:58:52Z`，耗时约 3 分钟；`checks: 51 PASS / 0 FAIL (total 51)`。上一轮完整运行（run 5，`05:52:19Z`）同为 51/51、exit 0；两次运行之间只写入了本报告（`docs/plans/stages/S3/` 与 `tools/verify/` 均在 S3 白名单内），证明门禁幂等且不受报告存在影响。

## 2. 唯一命令与结果

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool/tools/verify"
npm ci
node verify.mjs
```

最终输出尾行：

```text
checks: 51 PASS / 0 FAIL (total 51)
S3 TEST: PASS
```

退出码 `0`（`node verify.mjs` 的 `NODE_EXIT=0`；非 0 即 FAIL）。门禁幂等：run 5 与本报告定稿后的复跑 run 7 均为 51/51、退出 0；`npm ci`（tools/verify）在定稿后的 `package.json` 上同样 exit 0；每次运行自动清理全部子进程、端口与临时文件。

## 3. 门禁矩阵（S0 + S1 + S2 迁移 + S3）

| 组 | Gate | 结果 | 关键断言 |
|---|---|---|---|
| S0 | V0 / V1 / V1b / V1c / V4b | PASS | 环境、case-A 9 事件 schema、5 facts、负例、区间 |
| S0 | V2a–V2d、V2c-3、V3、V6a–V6e、V8a–V8d | PASS | 真实构建（根 JDK21 / demo JDK8 / workbench / demo 前端）、agent major 52、dist 标记、URL/密钥/遥测卫生、验证器零产品写入 |
| S1 | S1-A / S1-B / S1-C0 / S1-C1 / S1-C2 / S1-C3 / S1-D / S1-F | PASS | fixtures+facts；jar shading/schema parity；**迁移**：capabilities 5 键且 `replay=true`、`/replay` 200（默认窗口 2 事件）而非 404、stream/ws/links 仍 404 |
| S2 | S2-7 / S2-1 / S2-2 / S2-3 / S2-3b / S2-4 / S2-4F / S2-5 | PASS | S2 fixture+facts；H2 0 行缺陷（200 true 但订单仍 CREATED，未知 999 → 404）；无头 4-span LOST（`s_s2agent`）；**迁移**：运行时与 fixture `/replay` 均 200（8/4 事件）而非 404 |
| S2 | S2-6 / S2-8 / S2-L | PASS | **迁移**：workbench 保留 S2 面板（S3 允许时间轴/replay）；collector 7 路由（+replay）、agent 4 插桩点精确且允许反射读头；契约哈希对 S3 G1 冻结（S2 fixture 字节不变） |
| S3 | **S3-1 Builds** | PASS | SDK `npm ci`+`tsc` 构建 + `node --test` **8 tests / 8 pass / 0 fail**；demo 前端（`file:../../../frontend/sdk`、dev+preview `/ingest`→8601、`/api`→8080、dist 含 case B 文案与 `traceparent`/`X-TraceBoard-Click`/`s_s3demo`/`无构建插件/sourcemap`）；workbench；根 JDK21；demo JDK8；agent major 52 |
| S3 | **S3-2 Fixtures** | PASS | case A 7/7、case B 3/3 过冻结 schema；父链/单根/全 EXACT/`controller.parentSpanId=fetch.spanId`/SQL rows 0/UNKNOWN/B 零 fetch 零后端；`globalAssertions` A 42 keys、B 39 keys 全评估 0 失败；facts A 8 / B 6；`replayWindows` A 5 / B 4 深比较通过；**22 个 G1 哈希全部未漂移**（schema、3 契约、S3 fixture/plan/dispatch、S0–S2 fixture） |
| S3 | **S3-3 Header EXACT join E2E** | PASS | 见 §4.1：4 后端 span 同 trace/root、controller.parent=fetch spanId、全 EXACT、无 LOST_BACKEND、0 行、无 THREW；requests/graph 正确；无头/非法头 3 次均回退 S2 LOST 4-span + stderr 计数 |
| S3 | **S3-4 Collector replay/requests** | PASS | 见 §4.2：requests A/B 整行深比较；graph A 7 节点/6 边、B 3/2；replay 9 个窗口 200/读只/排序/逐字事件；重复 GET 字节一致；400/404/405；meta replay=true；stream/ws/links 404 |
| S3 | **S3-5 Replay 0-write** | PASS | 见 §4.3：回放前后 18 事件/nextSeq=18 逐字不变、订单仍 CREATED、无 THREW；三次窗口均 `readOnly=true`；workbench 回放路径仅 GET、不调 demo |
| S3 | **S3-6 Workbench** | PASS | dist 含 10 个 `#s3-*` 选择器、三条 case B 文案、`只读`/`时间轴`/`replay`/`sdkActive`/`fetchCount`/`RETURNED_FALSE`/`OBSERVE_MS` 与 `JS 内部变量本次未采集（无构建插件/sourcemap）`；S0/S1/S2 面板保留；状态语义（OK/RETURNED_FALSE/THREW/NOT_COLLECTED_*/TRUNCATED/REDACTED/UNKNOWN/LOST）齐全；无图库/canvas/SSE/WS/sourcemap |
| S3 | **S3-7 Case B evidence** | PASS | fixture B（click `SDK_ACTIVE`+`OBSERVE_MS`+EXACT → `validateForm RETURNED_FALSE` → render）＋ collector requests B（`sdkActive=true`、`fetchCount=0`、`hasBackend=false`、`backendSpanCount=0`、`status=RETURNED_FALSE`、`confidence=EXACT`）＋ 工作台三文案/OBSERVE_MS 判定 ＋ SDK 单测（8/8，`zero fetch` 断言）；工作台不伪造事件/不发 fetch |
| S3 | **S3-8 Scope/security** | PASS | 无 S4/S5（无 launcher/IDEA/JAR attach、无 sourcemap/构建插件/L2、无像素回放、无 SSE/WS、无客户端持久化）；collector 纯内存无 CORS；SDK 不采 body/表单值/cookie/查询串（仅 pathname）；SDK 无外部 URL/CDN/遥测；仅 loopback；schema 0 个 `$ref`；无 stray 顶层目录/`.idea` |
| S3 | **S3-9 Regression** | PASS | S2 无头 4-span LOST、DB 0 行（CREATED）、未知 404、S1 ingest/query、S0 fixture、S2 工作台面板全部保留（前置 18 gate 全绿） |
| S3 | **S3-10 Cleanup** | PASS | 8080/8601/5173/5174/4173/4174 无监听、无 java 残留、git index 无 staged、git status 全部落在 S3 白名单（含 demo 前端 9 个预期文件）、验证期间产品文件 0 改动 |

S2 门禁迁移对照（`dispatch.md` §4.8 / `s3-plan.md` §12.1）：`S1-C0` replay→true；`S1-D`/`S2-4F`/`S2-4` replay 404→200（并新增窗口/逐字断言）；`S2-6`/`S2-8` 升级为 S3 口径（允许 SDK/头读取/时间轴/replay，仍禁 S4/S5）；`S2-3` 无头回归逐字保留；`S2-9` 改为 S3 白名单并拆入 S3-2（漂移）+ S3-10（清理）。其余断言未放宽。

## 4. 关键证据

### 4.1 S3-3 头关联（真实 E2E）

collector 8601（JDK21）+ demo（JDK8，`-javaagent`，`-Dtraceboard.sessionId=s_s3demo`）；先注入 `fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson` 前 2 行（click+fetch）→ 202 accepted=2；再：

```bash
curl -s -X POST "http://localhost:8080/api/orders/1/cancel" \
  -H "traceparent: 00-1f2e3d4c5b6a79880a1b2c3d4e5f6071-2000000000000002-01" \
  -H "X-TraceBoard-Click: click_a1b2c3d4e5f60718"
```

```text
POST cancel -> 200 {"data":true}
trace=1f2e3d4c5b6a79880a1b2c3d4e5f6071 root=click_a1b2c3d4e5f60718
4 backend spans: controller 48d5d8e674ed8bd2 -> service 0d4329fe0ab0ca98 -> mapper 455085315acbc02d -> sql 829f03cf200ebc83
controller.parentSpanId=2000000000000002 (= fetch spanId); service/mapper/sql inherit
all 4 confidence=EXACT; controller flags ["S3_EXACT_LINK","S2_ZERO_ROW_CHAIN","DROP_COUNT=0"]; LOST_BACKEND count=0
status all OK; controller ResponseEntity 200; service true; mapper 0;
sql sideEffects [{sqlId:OrderMapper.cancelById, rowsAffected:0, transaction:UNKNOWN}]; no THREW
requests: EXACT, rootKind=ui_event, nodeKey=#btn-cancel, fetchCount=1, hasBackend=true,
          backendSpanCount=4, spanCount=6, hasFrontend=true, sdkActive=true
graph edges: click>fetch, fetch>controller, controller>service, service>mapper, mapper>sql
```

（以上为 run 5 的逐字证据；run 7 复跑同样全部通过，agent 侧 spanId 每次运行随机不同，其余断言不变。）

无头/非法头回退（同一 `s_s3demo`，同一 demo 进程）：

```text
无头 cancel              -> 4-span controller LOST root（rootEventId=click_lost_<spanId>，root 带 LOST_BACKEND）
traceparent 合法 + click 非法（click_bad） -> 独立 4-span LOST（无合成 EXACT）
全 0 traceparent + click 合法              -> 独立 4-span LOST
agent stderr: header_unreadable=1 reason=missing reason_count=1 / header_unreadable=2 reason=invalid reason_count=1（不打印头值）
requests: 1 EXACT + 3 LOST（LOST 行均 rootKind=controller、fetchCount=0、backendSpanCount=4）
```

### 4.2 S3-4 replay 窗口（expected-facts 深比较）

冻结 fixture 以**会话名重写**注入两个全新会话（`s_s3verify_a` / `s_s3verify_b`，事件体逐字不变），使 seq 确定且窗口互不干扰：

```text
requests A: {"traceId":"1f2e…6071", rootSpanId 1000000000000001, rootKind ui_event, nodeKey #btn-cancel,
             status OK, confidence EXACT, spanCount 7, startedAtNs 1000000000, durNs 38000000,
             hasError false, fetchCount 1, hasFrontend true, hasBackend true, backendSpanCount 4}   ← 与 expected 整行 deep-equal
requests B: {"traceId":"3a4b…1829", rootSpanId 8000000000000008, rootKind ui_event, nodeKey #btn-save-b,
             status RETURNED_FALSE, confidence EXACT, spanCount 3, fetchCount 0,
             hasFrontend true, hasBackend false, backendSpanCount 0}                                ← 与 expected 整行 deep-equal
graph A: 7 nodes / 6 edges（nodeOrder 100…1,200…2,300…3,400…4,500…5,600…6,700…7；11 字段逐字）
graph B: 3 nodes / 2 edges
replay WA1 toNs=1001000000  count=1 spanIds=1000000000000001 seqs=1
replay WA2 toNs=1034500000  count=6 seqs=1..6
replay WA3 toNs=1038000000  count=7 seqs=1..7（默认窗口）
replay WA4 fromNs=1005000000 count=5 spanIds=300…7 seqs=3..7
replay WA5 fromNs=1035000000 count=1 spanIds=700…7 seqs=7
replay WB1 toNs=2000500000  count=1
replay WB2 toNs=2001000000  count=2
replay WB3 toNs=2004000000  count=3（默认窗口）
replay WB4 fromNs=2002000000 count=1
两次相同默认 GET 逐字一致；回放前后 A 会话 7 事件/nextSeq=7 逐字不变
400: fromNs=abc / fromNs=-1 / toNs=999999999999999999999999 / fromNs=5&toNs=2 / fromNs=（空白）
     → {error:bad_request, message<=200, apiVersion:v1}，未知会话 + 坏参数 → 400（先 400 后 404）
404 未知会话；POST/PUT replay → 405；meta capabilities 5 键且 replay=true / realtime=false；stream/ws/links 404
```

### 4.3 S3-5 回放 0 写（collector + demo 运行中）

```text
before/after: 18 events, nextSeq=18, events 页逐字 identical=true
default replay: fromNs=0, toNs=max(startNs+durNs), 18 events（startNs 升序）, 两次字节一致, readOnly=true
窗口 default/toNs/fromNs: 均 200 {mode:"replay", readOnly:true, sessionId:"s_s3demo"}
demo GET /api/orders：回放前 CREATED，回放后仍 CREATED（辅助证据；主证据是事件集/seq 不变）
回放期间无新事件、无 THREW（未重跑/未写库）
workbench：src/api.ts#fetchReplay 仅相对 GET；S3Panel/stores/s3 无 fetch/XMLHttpRequest/POST、不引用 /api/orders 或 :8080
```

### 4.4 S3-2 G1 冻结哈希（22 项全部匹配；字节未变）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
932d290186e968eaa1804757efae4e1b70307371d3e15efd3834cfcc125f31ef  docs/contracts/api.v1.md
73578e05177e89826541740db0e67ec32fa3f52dd11c4cfdcc6e6ef4191c9f8e  docs/contracts/transport.v1.md
06ee878e9d3acc3d6a6ff66ee1e1d95c92ac5813913cc1ad84ae3977216025c0  docs/contracts/event-model.v1.md
9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56  docs/contracts/status-semantics.md（S3 未改）
dfea23ef4fb953a28dd018ceaee28d5af462c0f18604081877c89835659cabf1  fixtures/s3-frontend-facts/README.md
f99e57e16e16e9423f2776e0e2f93b27509bb0cf8b2e92bc80bb15f8e8c0f538  fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson
0ba30446bbf7997f2bb3a1b4b2c776438c81f301992390b5e3093fba5128f698  fixtures/s3-frontend-facts/case-a-joined-chain/expected-facts.json
2a73ac5fc5f9eb9ea2acbfc94585d15549ea7a57c5624c24934a13836d26e586  fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson
1667ceeb418d8d836cc719738cceb1b31b73d942041e43744d948d3a6f690759  fixtures/s3-frontend-facts/case-b-frontend-only/expected-facts.json
84a2fdf81735f0bc710f7973314c5867ceb9b0a8bcb4341a7d7d2e77e9e9769c  docs/plans/stages/S3/s3-plan.md
e8a756c05ae5e73c4f2cf97f408ec81985b205aeabd71d188d0d3ae7daa62e14  docs/plans/stages/S3/dispatch.md
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d  fixtures/case-a-zero-rows/README.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
2d1abc0f211979aa4853fa979673ff32d82a3689f958ee965890fb6cec1535fc  fixtures/s2-zero-row-chain/events.ndjson
8869ad79cdedc490bbb4ec5d6738abe9e84c3ced5705a54976abf5527b409a69  fixtures/s2-zero-row-chain/expected-facts.json
c2ab2fc1b99b2bf9476639cccfb0642a6f573574a81e6e5e4e54d997d234585b  fixtures/s2-zero-row-chain/README.md
```

### 4.5 S3-6 工作台 dist / S3-8 安全

```text
#s3-* 选择器 10/10：s3-panel s3-session s3-refresh s3-tabs s3-ops s3-tree s3-timeline
                    s3-replay-toggle s3-readonly s3-caseb
文案：已确认：本次点击因果链内没有网络请求 / 无法确认：前端采集未接入 /
      前端已发请求但后端未采集（LOST）/ 只读 / 时间轴 / 观察中 /
      回放不会重发请求、不写数据库、不调用 demo、不执行程序；
      JS 内部变量本次未采集（无构建插件/sourcemap）
语义：OK / RETURNED_FALSE / THREW / NOT_COLLECTED_* / TRUNCATED / REDACTED / UNKNOWN / LOST（含颜色+文字提示）
保留：app-shell、Fixture 事实摘要、S1 walking skeleton、s2-panel/s2-chain
禁止：图库/canvas/SSE/WS/sourcemap 均无
SDK 隐私：无 document.cookie / request body / response.text() / URLSearchParams / 表单 .value；nodeKey 仅 pathname
SDK URL：仅 http://localhost/（URL 解析基址）；package-lock 全部 registry.npmjs.org；无 .npmrc
```

## 5. 观察与限制（如实记录，不影响 PASS 判定）

1. **S3-4 的"独立会话"做法**：冻结 fixture 的字节不改，测试把 `sessionId` 重写为 `s_s3verify_a/b` 后注入，以获得确定的 seq 与互不干扰的窗口；`events[].event` 与 fixture 逐字深比较（除 sessionId 外全部相同，窗口断言只依赖 startNs/spanId/seq）。
2. **运行时区间包含**：`event-model.v1.md` §12.7/§405 允许区间断言使用 ≤1s 测试容差。冷启动首次调用实测出现一次 sql 结束时刻比 mapper 结束晚约 20µs（agent `startNs` 锚定在上下文进入、`durNs` 从 advice 进入计时的微秒级差值）。S3-3 按契约给出的 ≤1s 容差断言"顺序 + 包含"；S2 继承的严格包含断言（`chainProblems`，fixture/无头 4-span 链）仍按原样执行并通过。建议 coder-agent 后续（S4 前）把 `startNs` 锚点与 `enterNs` 对齐以消除该微秒级差（非 S3 验收信号）。
3. **agent 时钟实现**：`SpanEmitter.epochNanos()` 采用"premain 墙钟毫秒 + 单调 nanoTime 差值"（注释记录了 JDK8/Windows `currentTimeMillis` ~2ms 粒度导致的字面公式非单调）。测试据此断言 epoch-ns 量级（>1.6e18）、startNs 顺序与时长关系，不断言字面公式。
4. **案例 B 的运行时证据**：S3-7 证明的是"契约形状 + collector 派生 + SDK 单测 + 工作台判定"链路；浏览器真实点击（`#btn-save-b`）产生的运行时 capture 与截图由 orchestrator 提供（`s3-plan.md` §12 handoff），tester 不用 fixture 冒充运行时结论，不断言截图。
5. **demo 横幅**：保留"案例 A 故意缺陷 / UPDATE 0 行 / 案例 B 纯前端零请求 / runtime SDK / 无构建插件/sourcemap"事实；S2-AMD-01 的 template-only 例外已被 S3 白名单取代（demo 前端 9 个预期文件变更）。
6. **S2 覆盖上限不变**：`countById` 存在性检查不插桩（0 或 2 个额外 span），S2-3b 保留。

## 6. 清理与只读声明

```text
ports 8601/8080/5173/5174/4173/4174：无监听（每次 E2E finally 停止 collector/demo 并轮询端口释放）
java 进程：无残留（与运行前基线一致）
git：无 staged 条目（index 未动）；git status 全部落在 S3 白名单
产品文件：验证期间 0 改动（SNAPSHOT 对比；仅 build 输出 dist/target 与 workbench/public/fixtures 由产品自身构建产生）
临时文件：OS temp 中的验证临时目录已删除；无仓库内遗留
```

## 7. 精确复现命令

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
# 唯一门禁（S0 + S1 + S2 迁移 + S3；非 0 即 FAIL）
(cd "tools/verify" && npm ci && node verify.mjs)

# —— 分项复现（门禁内部等价命令）——
(cd "frontend/sdk" && npm ci && npm run build && npm test)                      # S3-1：8 tests / 8 pass
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)              # S3-1 demo 前端
(cd "workbench" && npm ci && npm run build)                                      # S3-1 workbench
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package           # S3-1 根（agent+collector）
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# —— S3-3 头 E2E（手工）——
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
# 健康检查后启动 demo（JDK8 + agent，会话 s_s3demo）
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s3demo \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &
head -2 "fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson" > /tmp/s3-prefix.ndjson
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @/tmp/s3-prefix.ndjson
curl -s -X POST "http://localhost:8080/api/orders/1/cancel" \
  -H "traceparent: 00-1f2e3d4c5b6a79880a1b2c3d4e5f6071-2000000000000002-01" \
  -H "X-TraceBoard-Click: click_a1b2c3d4e5f60718"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/graph?traceId=1f2e3d4c5b6a79880a1b2c3d4e5f6071"
# 无头/非法头回退
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel" -H "traceparent: 00-1f2e3d4c5b6a79880a1b2c3d4e5f6071-2000000000000002-01" -H "X-TraceBoard-Click: click_bad"

# —— S3-4/S3-5 replay 0 写 ——
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay" > /tmp/s3-replay1.json
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/replay" > /tmp/s3-replay2.json
cmp /tmp/s3-replay1.json /tmp/s3-replay2.json && echo "replay identical"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3demo/events?afterSeq=0&limit=200"
curl -s "http://localhost:8080/api/orders"    # 仍 CREATED
```

## 8. 结论

- S0–S2 回归（含 §4.8 显式迁移）与 S3-1…S3-10 全部 PASS，`node verify.mjs` 退出码 0；验证器幂等、可重复执行，结束时清理全部进程与临时文件。
- schema 字节、S0–S2 fixture 字节与 S3 G1 冻结面（契约/S3 fixture/s3-plan/dispatch）零漂移。
- S3 只证明"前端事实（点击/控件/请求/DOM）+ 案例 B 确认没发 + 状态语义 + 只读回放"；无构建插件/sourcemap/局部变量、无 S4 接入/详情/×N、无实时，不宣称产品完成。

```text
S3 TEST: PASS
```
