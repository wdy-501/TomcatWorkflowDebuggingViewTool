# S1 测试报告（test-report）

> 阶段：S1（walking skeleton）｜角色：tester｜日期：2026-11-23｜执行窗口：2026-11-23 11:25–11:38（本地，连续 5 轮）
> 绑定简报：`docs/plans/stages/S1/dispatch.md` §1–§4、§5.5、§9；`s1-plan.md` §9（T0–T13、D14）与 §13；G1 冻结：`plan-review.md` 复评（**G1: PASS**）§8 基线
> 契约：`api.v1.md` §2.1/§7、`transport.v1.md` §4.5、`event-model.v1.md` §5 第 2–3 条（游离后端根例外）
> 产物：`tools/verify/verify.mjs`（S0 门禁保留 + S1 门禁扩展；`package.json` 描述同步；`node_modules/` 已被根 `.gitignore` 忽略）与本文件
> 结论：**S1 TEST: PASS**（35/35 检查 PASS，连续五轮 exit 0；含一次 `npm ci && node verify.mjs` 全链路，以及“本报告存在时 + timeline/rows 扫描加入后”的最终态复跑）

---

## 1. 结论摘要

| 项 | 结果 |
|---|---|
| 一次性入口 | `(cd "tools/verify" && npm ci && node verify.mjs)`；任一 gate 失败即非零退出；打印逐项 `PASS/FAIL [ID]` |
| 检查结果 | **35 PASS / 0 FAIL**（`checks: 35 PASS / 0 FAIL (total 35)`，`S1 TEST: PASS`，exit 0） |
| 幂等 | 连续五轮完整执行（含构建、起停 collector/demo、agent E2E）均 35/35、exit 0；最后一轮在 `test-report.md` 已存在、且加入 timeline/rows 扫描后复跑，仍 35/35，无残留进程/端口 |
| 关键数字 | ingest `202 {accepted:2}` / 重发 `dropped:2` / 混合批 `accepted:1,rejected:2`（line 2 invalid_json、line 3 schema_violation）/ 415、400、413 全中；查询 `{seq,event}` + `nextSeq` 分页全中；agent 两次 cancel → **恰好 2 条 controller span**（LOST/LOST_BACKEND/`click_lost_<spanId>`/distinct traceIds）；停 collector 后 cancel **200，3ms**；workbench 假批次读回 `seq 1..4` |
| 构建产物 | agent jar `major=52`、shaded Byte Buddy 2884 classes、无未 relocate `net/bytebuddy`、`Premain-Class` 正确；collector jar 内 schema 与仓库 schema **字节等价**（`927937df…a489a`）；workbench dist 含 S1 标记 |
| 冻结哈希 | S1 G1 基线 **10/10 一致**；S0 基线 7 项中仅 `api/transport/event-model` 按 S1 契约变更（与 S1 基线一致），其余 4 项（schema、case-A 两 fixture、status-semantics）**未变** |
| 进程/端口 | 8601/8080/5173/5174/4173/4174 无 LISTENING；无遗留 `java.exe`；git 索引无暂存项 |
| 非阻断发现 | 4 条（§8：校验器自身的 S0→S1 断言替换、D16 丢弃计数方式、workbench dev 未由 tester 启动、`source.line` 只断言文件名） |

---

## 2. 环境（实测，`V0`）

| 项 | 值 |
|---|---|
| OS / Shell | Windows_NT `10.0.29708` x64；Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，命令全部双引号） |
| Node / npm | `v22.22.2` / `10.9.7` |
| Maven | Apache Maven `3.9.5`（`D:\apache-maven-3.9.5-bin\apache-maven-3.9.5`）；默认 `JAVA_HOME`=`C:\Program Files\Java\jdk1.8.0_221` |
| JDK21（根/collector） | `C:/Program Files/Java/jdk-21`，`java version "21" 2023-09-19 LTS`（21+35-LTS-2513） |
| JDK8（demo/agent E2E） | `C:/Program Files/Java/jdk1.8.0_221/bin/java.exe`，`java version "1.8.0_221"`（固定绝对路径，不依赖 PATH） |
| 校验依赖 | `ajv` **8.20.0**（`ajv/dist/2020.js`，`strict:true`、`allErrors:true`；`tools/verify/node_modules`） |
| collector 校验库 | `com.networknt:json-schema-validator:1.0.87` + `com.fasterxml.jackson.core:jackson-databind:2.15.4`（`mvn -pl server/collector dependency:tree` 实测） |
| 浏览器 | tester 不启动浏览器（orchestrator 负责浏览器证据）；workbench 仅静态断言 dist/源码/代理配置 |

---

## 3. 校验工具（`tools/verify/verify.mjs`，单命令）

- 保持 S0 门禁：`V0` 环境、`V1/V1b/V1c` case-A schema/事实/反例、`V4b` 因果区间、`V2` 四个真实构建、`V3` agent major 52、`V6` 产物/无外链/MANIFEST、`V8` secrets/遥测/CDN/CRLF/无产品写入。
- **仅两处 S0 断言被 S1 契约取代**（不可同时成立，非放宽）：
  1. `V5a` 的 “ingest 固定 501” → S1 `§7.1` 已实现 `202/400/413/415`；现由 `S1-C0..C3` 断言新契约（更严格）。
  2. `V7` 的 “S0 单基线” → `S1-G`：以 S1 G1 基线（10 项）+ S0 回归（7 项，允许 3 个契约更新且必须等于 S1 基线）。
  3. `V5b/V5c` 的 demo 冒烟与端口释放并入 `S1-E1/E2`、`S1-I`（断言不减：orders/cancel/unknown 404、fail-open、端口）。
- 新增 S1 门禁：`S1-A` fixtures+expected-facts 新形状消费器（D14）、`S1-B` 构建产物、`S1-C0..C3` ingest、`S1-D` 查询、`S1-E1/E2` agent E2E+fail-open、`S1-F` workbench 路径、`S1-G` 回归/漂移、`S1-H` 范围/安全、`S1-I` 清理。
- 进程管理：collector/demo 用 Node `spawn`（JDK 绝对路径、`-javaagent:` 参数单独 argv），`finally` 中 `taskkill /PID <pid> /T /F` + 轮询 `netstat` 至端口无监听；`process.on("exit")` 再兜底。
- 只写 `os.tmpdir()`（无反例临时文件写盘）；构建产物仅由产品自身命令产生；运行前后 **78 个产品文件 SHA256 全等**（`V8d`），git status 前后逐行一致。

---

## 4. T0–T13 与检查项映射

| 计划项 | 检查 ID | 结果 |
|---|---|---|
| T0 S0 回归 | `V0–V4b`、`V2a–d`、`V3`、`V6`、`V8` | PASS |
| T1 S1 fixture + facts（D14 新形状） | `S1-A` | PASS |
| T2 构建 + schema 字节等价 | `V2a–d`、`V2c-3`、`S1-B` | PASS |
| T3 ingest 正例 | `S1-C1` | PASS |
| T4 幂等 | `S1-C1` | PASS |
| T5 混合批 | `S1-C2` | PASS |
| T6 信封负例 | `S1-C3` | PASS |
| T7 查询 | `S1-D` | PASS |
| T8 meta | `S1-C0` | PASS |
| T9 agent 在线 | `S1-E1` | PASS |
| T10 fail-open | `S1-E2` | PASS |
| T11 workbench | `S1-B`（dist/代理）、`S1-H`（无 SSE/WS/图） | PASS（dev server 未启动，见 §8 F-3） |
| T12 无 S2 扫描 | `S1-H` | PASS |
| T13 漂移/安全 | `S1-G`、`S1-B`、`V3`、`V8` | PASS |

---

## 5. 逐项结果（35 项）

| ID | 检查 | 结果 | 关键证据 |
|---|---|---|---|
| V0 | 环境记录 | PASS | node v22.22.2 / npm 10.9.7 / java21 21 LTS / java8 1.8.0_221 / mvn 3.9.5（JDK8+JDK21 两次 `-v`） |
| V1 | schema + case-A JSONL | PASS | Ajv 2020-12 `strict:true`；9/9 行合法；无 BOM/CR、末字节 `0x0a`；spanId 唯一；唯一根；traceId 一致 |
| V1b | case-A expected facts | PASS | 5 facts 深比较 + 全局断言 0 fail（S0 门禁未改） |
| V1c | 反例/正例 | PASS | `status:SUCCESS`、缺 `reason`、多字段均拒绝；`NOT_COLLECTED_POLICY+reason` 接受 |
| V4b | 因果区间 | PASS | 0 违规；7 严格包含 + 1 callback 根包含 + 1 根 |
| V2a | 根 reactor（JDK21） | PASS | `mvn -B -q -DskipTests package` exit 0（6.2s）；agent/collector 重打包 |
| V2b | demo 后端（JDK8） | PASS | exit 0（2.2s） |
| V2c-1/2 | workbench `npm ci` / `npm run build` | PASS | exit 0（1.9s / 2.9s）；vue-tsc 严格通过 |
| V2c-3 | prebuild fixture 副本 | PASS | `workbench/public/fixtures/**` SHA256 == 源 |
| V2d-1/2 | demo 前端 ci/build | PASS | exit 0（1.8s / 2.5s） |
| V3 | agent 字节码 52 | PASS | `javap` `major version: 52` + class 头兜底 |
| **S1-A** | fixtures + expected-facts | PASS | 2 行 + 1 对象 **3/3** 过冻结 schema；`nodeKey=...#cancel`；`LOST` + `LOST_BACKEND`；`rootEventId=click_lost_7c3e5a91b2d4086f`；无 BOM/CR、末行 LF；`seq` 负例被拒；新形状 `globalAssertions` **25 项**（frontendBatch 10 + agentSpan 15）0 fail；8 facts 0 fail；两来源 sessionId/traceId 无交集 |
| **S1-B** | 构建产物 | PASS | agent jar：2953 entries、shaded Byte Buddy **2884 classes**、未 relocate `net/bytebuddy` **0**、`Premain-Class: io.traceboard.agent.TraceAgent`、无 `Agent-Class`、无 `dependency-reduced-pom.xml`、major 52；collector jar：schema **唯一 1 份**且 sha256 `927937df…a489a` 与仓库逐字相等；`src/main/resources` 无副本；dist 含 `发送假点击/请求`、`Walking skeleton`、`nodeKey`、`seq`、`btn-s1-fake`、`no correlation yet`；Vite `/ingest`、`/api` → `http://127.0.0.1:8601`，`strictPort:true`，无 `0.0.0.0` |
| **S1-C0** | health + meta | PASS | health `UP`；`capabilities={health:true,meta:true,ingestEvents:true,realtime:false,replay:false}`（恰 5 键）；schema id/version/dialect 正确 |
| **S1-C1** | ingest 正例/幂等 | PASS | `202 {"accepted":2,"rejected":0,"dropped":0,"errors":[]}`；重发 `202 {"accepted":0,"rejected":0,"dropped":2}`；`s_wb_demo` eventCount=2、startedAtMs>`0`、lastEventAtMs≥startedAtMs；事件页 `seq=1,2`、`nextSeq=2`、event 内无 `seq`、逐条 schema 合法 |
| **S1-C2** | 逐行拒绝 | PASS | 非法 `status` 单行 → `202 {accepted:0,rejected:1}`，`errors[0]={line:1,code:"schema_violation"}`、message≤200 且不回显；混合批 → `{accepted:1,rejected:2}`，line 2 `invalid_json`、line 3 `schema_violation`；合法行入库 `seq=1` |
| **S1-C3** | 信封负例 | PASS | `text/plain`→415（含 >4MB body 仍 415）；空 body/空行/1001 行/非 UTF-8→400；单行 65KB→413；>4MB→413；全部统一错误信封（`error/message/apiVersion`，message 1–200 字）且 **0 回显**；1001 行批次未写入（`s_s1_bulk` 404） |
| **S1-D** | 只读查询 | PASS | `sessions`：`s_wb_demo=2`、`s_s1_mixed=1`；`{"seq":N,"event":{...}}` 2 条 schema 合法、`nextSeq=2`；`limit=1→seq1/nextSeq1`；`afterSeq=1→seq2`；`afterSeq=2→空页 nextSeq=2`；未知参数忽略；`limit=0/501`、`afterSeq=-1/abc`→400；未知 session→404；`POST sessions`/`PUT`/`DELETE events`→405；`graph/replay/stream/ws/links`→404 |
| **S1-F** | workbench 假批次路径 | PASS | 生成同形新批次（新 trace/span/root，`s_wb_demo`）→`202 accepted=2`；eventCount=**4**；读回 `seq 1,2,3,4`、`nextSeq=4`；新页为 `ui_event` 根 + `fetch` 子（同新 trace/root，未与旧批次合并） |
| **S1-E1** | agent 在线 | PASS | premain `target=...#cancel(long)`、sessionId=`s_s1agent`；`transformed com.example.shop.controller.OrderController`；cancel×2 均 200 `{data:true}`；≤15s 读回 **恰好 2 条** controller span；每条 `kind=controller`、`nodeKey=...#cancel`、`status=OK`、`confidence=LOST`、flags 恰 3 项含 `LOST_BACKEND`、`parentSpanId=null`、`rootEventId=click_lost_<spanId>`、`durNs>0`、`return.type` 非空、无 `values/sideEffects`；spanId `b08bb18c510b6505,68835abd8f540d0e` 互异；traceId `7b27e526…9faf2,df56186a…27860` 互异（R1）；取消前 `s_s1agent` 404（无合成启动事件） |
| **S1-E2** | fail-open | PASS | 停 collector 后 8601 释放；cancel → 200 `{data:true}`，**3ms**（<3000ms）；demo 存活（orders 200）；S0 回归 unknown 999→404；stderr 出现 `ingest_rejected=1 status=io_error`（丢弃不静默，D16） |
| V6a | workbench dist S0 标记 | PASS | `app-shell`、`前端图`、`请求分图`、`Fixture 事实摘要` |
| V6b | dist fixture 副本 | PASS | case-A 两文件与源逐字节一致 |
| V6c | demo dist 标记 | PASS | `btn-cancel`、`操作成功`、`raw-json` |
| V6d | 无外部资源 | PASS | 5 个 URL 全为惰性/回环（w3.org 命名空间、vuejs.org 错误文案、`127.0.0.1:8601`）；无 `src/href/url()` 外链 |
| V6e | agent MANIFEST | PASS | `Premain-Class` + `Implementation-Title: TraceBoard Agent` |
| V8a | secret 扫描 | PASS | 项目源码/配置 0 命中 |
| V8b | 遥测/CDN | PASS | 16 遥测域名 + 9 CDN 主机 0 命中 |
| V8c | `.gitattributes`/CRLF | PASS | `.gitattributes` 存在（`*.jsonl/json/md/java/ts/vue eol=lf`）；`core.autocrlf=true` 记录在案 |
| V8d | 无产品写入 | PASS | 产品文件 SHA256 全等；git status 前后逐行一致；`tools/verify/node_modules` 被忽略 |
| **S1-G** | 回归/漂移 | PASS | S1 基线 **10/10** 一致；S0 基线 7 项：schema、case-A events/facts、status-semantics 未变，`api/transport/event-model` 的更新值与 S1 基线一致；case-A 仍 9/9 合法；S0 构建 6/6 PASS |
| **S1-H** | 范围/安全 | PASS | collector 路由恰 4 条（`GET /api/v1/meta`、`GET /api/v1/sessions`、`GET /api/v1/sessions/{sessionId}/events`、`POST /ingest/v1/events`）；无 graph/replay/stream/links 注解；无 DB/文件/关联/SSE-WS/CORS 代码；无 `rowCount/rowsAffected/sideEffects` 探针；agent `.type=1`、`Advice.to=1`、无 SQL/service/mapper 探针；workbench 无 SSE/WS/interval、无图库/canvas、无 timeline/replay 组件、无 `s_s1_agent` 读取、相对路径、`no correlation yet`；collector 仅 `127.0.0.1:8601`；agent `catch(Throwable)` 11 处、队列 16、300/700ms、无 retry；无 `.npmrc`/镜像，lock resolved 全为 `registry.npmjs.org`；poms 无自定义仓库 |
| **S1-I** | 清理 | PASS | 6 个端口无 LISTENING；无新增 `java.exe`；git status 仅预期路径（32 项，全部 `M/??`、无暂存）；冻结/他人路径 0 变更 |

---

## 6. 关键证据片段（`npm ci && node verify.mjs` 全链路运行）

### 6.1 ingest（S1-C1/C2/C3）

```text
POST /ingest/v1/events  fixture(2 行)  -> 202 {"accepted":2,"rejected":0,"dropped":0,"errors":[]}
POST /ingest/v1/events  重发同批      -> 202 {"accepted":0,"rejected":0,"dropped":2,"errors":[]}
POST /ingest/v1/events  status=SUCCESS-> 202 {"accepted":0,"rejected":1,"dropped":0,
                                               "errors":[{"line":1,"code":"schema_violation",
                                               "message":"event does not match the frozen traceboard.event.v1 schema at $.status"}]}
POST /ingest/v1/events  混合 3 行     -> 202 {"accepted":1,"rejected":2,"dropped":0,
                                               "errors":[{"line":2,"code":"invalid_json",...},
                                                         {"line":3,"code":"schema_violation",...}]}
text/plain -> 415 {"error":"unsupported_media_type",...}
空 body   -> 400 {"error":"bad_request","message":"request body is empty",...}
空行      -> 400 {"error":"bad_request","message":"blank lines are not allowed (line 1)",...}
1001 行   -> 400 {"error":"bad_request","message":"a batch may contain at most 1000 lines",...}
65KB 行   -> 413 {"error":"payload_too_large","message":"a single NDJSON line exceeds 64KB",...}
>4MB body -> 413 {"error":"payload_too_large","message":"request body exceeds 4MB",...}
非 UTF-8  -> 400 {"error":"bad_request","message":"request body is not valid UTF-8",...}
错误响应均不回显 body（含 4MB 标记文本 0 命中）
```

### 6.2 查询（S1-D）

```text
GET /api/v1/sessions
 -> [{"sessionId":"s_wb_demo","eventCount":2,"startedAtMs":1795404881402,"lastEventAtMs":1795404881403},
     {"sessionId":"s_s1_mixed","eventCount":1,...}]
GET /api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200
 -> {"events":[{"seq":1,"event":{...ui_event...}},{"seq":2,"event":{...fetch...}}],"nextSeq":2}
GET ...?limit=1            -> 1 条 seq=1, nextSeq=1
GET ...?afterSeq=1         -> 1 条 seq=2, nextSeq=2
GET ...?afterSeq=2         -> {"events":[],"nextSeq":2}
GET ...?limit=0 | 501 | afterSeq=-1 | afterSeq=abc -> 400 bad_request
GET /api/v1/sessions/s_missing/events -> 404 not_found
POST /api/v1/sessions -> 405;  PUT/DELETE .../events -> 405
GET .../graph | .../replay | /api/v1/stream | /ws/v1/events -> 404;  POST .../links -> 404
```

### 6.3 agent E2E（S1-E1）

```text
[traceboard-agent] premain installed: target=com.example.shop.controller.OrderController#cancel(long),
                   ingestUrl=http://127.0.0.1:8601/ingest/v1/events, sessionId=s_s1agent
[traceboard-agent] transformed com.example.shop.controller.OrderController
POST /api/orders/1/cancel x2 -> 200 {"data":true}
GET /api/v1/sessions/s_s1agent/events?afterSeq=0&limit=200
 -> 2 条 {seq,event}；event: kind=controller, nodeKey=...OrderController#cancel, status=OK,
    confidence=LOST, parentSpanId=null, rootEventId=click_lost_<spanId>, durNs>0,
    flags=["SKELETON","S1_ONE_METHOD","LOST_BACKEND"], return.type=org.springframework.http.ResponseEntity
spanId=b08bb18c510b6505,68835abd8f540d0e（互异）
traceId=7b27e526e8f3fdf6509e446e34c9faf2,df56186ab6e7a5d71e02f74604c27860（互异，R1）
```

### 6.4 fail-open（S1-E2）

```text
stop collector -> netstat 8601 no LISTENING
POST /api/orders/1/cancel -> 200 {"data":true}，耗时 3ms
GET  /api/orders          -> 200（demo 存活）
POST /api/orders/999/cancel -> 404 {"data":false}（S0 回归）
agent stderr: [traceboard-agent] ingest_rejected=1 status=io_error（1 次尝试、无重试、计数不静默）
```

### 6.5 workbench 路径（S1-F）

```text
生成与 workbench 同形的新批次（新 traceId/spanId/rootEventId，sessionId=s_wb_demo）
POST /ingest/v1/events -> 202 {"accepted":2,"rejected":0,"dropped":0,"errors":[]}
GET /api/v1/sessions   -> s_wb_demo eventCount=4
GET .../events?afterSeq=0&limit=200 -> seq 1,2,3,4（nextSeq=4）；新页 entries:
  seq=3 ui_event  parentSpanId=null  traceId=97b19470…（新）
  seq=4 fetch     parentSpanId=<seq3.spanId>  同 traceId/rootEventId
```

### 6.6 构建/产物

```text
agent jar: 2953 entries；io/traceboard/agent/shaded/net/bytebuddy/** 2884 classes；net/bytebuddy/** 0
MANIFEST: Premain-Class: io.traceboard.agent.TraceAgent（无 Agent-Class）
collector jar: BOOT-INF/classes/schema/traceboard.event.v1.json（唯一）
  unzip -p sha256 = 927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a
  repo    sha256 = 927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a
workbench dist: 发送假点击/请求 / Walking skeleton / nodeKey / seq / btn-s1-fake / no correlation yet
vite: "/ingest" 与 "/api" -> target "http://127.0.0.1:8601"；port 5173；strictPort:true
```

---

## 7. 哈希（SHA256）

### 7.1 S1 G1 冻结基线（`plan-review.md` §8 vs 实测，10/10 一致）

| 文件 | SHA256 |
|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` |
| `docs/contracts/event-model.v1.md` | `7988d1c42c94bd2cb5f160028ecfb655ef7e401b3094fbd4c0e9944856a1fdf7` |
| `docs/contracts/api.v1.md` | `a717e800b0fa4eff237ff1d2e2ac0ac516df1dfa92e054477b2eac5c4d064943` |
| `docs/contracts/transport.v1.md` | `cad6224f85608ce910d5a5a74d2d9b422b7cc5af5c5de7bce682fc7e6c3b3ab8` |
| `fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson` | `6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972` |
| `fixtures/s1-walking-skeleton/agent-controller-span.json` | `13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c` |
| `fixtures/s1-walking-skeleton/expected-facts.json` | `380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1` |
| `fixtures/s1-walking-skeleton/README.md` | `b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a` |
| `docs/plans/stages/S1/s1-plan.md` | `01c5c75b360ba7af576602cf1172dad3c0b18c97f81274e03f5bf25ed3d9e5e4` |
| `docs/plans/stages/S1/dispatch.md` | `da9960fb497f564b1eff1a3b72afabe2ad3356a11df945513b0452e717b12668` |

### 7.2 S0 回归（`docs/plans/stages/S0/plan-review.md` 基线）

| 文件 | S0 基线 | 现状 | 判定 |
|---|---|---|---|
| `schema/traceboard.event.v1.json` | `927937df…a489a` | 同 | 未变 |
| `fixtures/case-a-zero-rows/events.jsonl` | `2eb0b3d9…82ec9` | 同 | 未变 |
| `fixtures/case-a-zero-rows/expected-facts.json` | `8c5bbdbd…b20ea` | 同 | 未变 |
| `docs/contracts/status-semantics.md` | `9a8735a0…f4fb56` | 同 | 未变 |
| `docs/contracts/event-model.v1.md` | `0820d57f…614a` | `7988d1c4…1fdf7` | S1 契约更新（=S1 基线） |
| `docs/contracts/transport.v1.md` | `2ca028e6…c3c0` | `cad6224f…3ab8` | S1 契约更新（=S1 基线） |
| `docs/contracts/api.v1.md` | `88bd185f…af95c` | `a717e800…6943` | S1 契约更新（=S1 基线） |

无未解释漂移；S1 fixture 与 schema 字节均未变。

---

## 8. 非阻断发现与移交项

| ID | 事项 | 证据/影响 | 建议处置 |
|---|---|---|---|
| F-1 | 校验器把两处 S0 断言替换为 S1 断言（`V5a` 501→S1 ingest；`V7` S0 基线→`S1-G`），并保留其余 S0 门禁 | `tools/verify/verify.mjs`；`S1 TEST: PASS` | 属契约允许的 S1 变更（501 与 202 不可同时成立）；acceptance 复跑只需一条命令，无需改断言 |
| F-2 | 校验器首轮自检曾有 2 个 FAIL，均为 tester 脚本自身误报（标题层级 `### 8.` 未匹配、把注释里的 “no correlation/no retry” 当代码扫描） | 修正：标题正则 `^#{2,3} 8\.` + `stripComments()`；之后连续三轮 35/35 | 非产品缺陷，已闭环 |
| F-3 | tester 未启动 workbench dev server（浏览器证据由 orchestrator 提供）；代理/横幅/标记为静态+构建产物断言，`S1-F` 直接驱动代理目标端点 | `S1-B`/`S1-H`/`S1-F` | orchestrator 用 `localhost:5173` 做点击闭合；若发现代理层问题，回退 frontend owner |
| F-4 | agent 事件 `source.line` 为方法退出点（实测 48），fixture 示例为 43；T9 按计划 N6 只断言 `source.file=OrderController.java` | `S1-E1` 通过；fixture 字节未改 | 文档已声明不可复现；不作为门禁比较项 |
| F-5 | D16：队列满/传输拒绝只在 agent stderr 计数（`ingest_rejected=`），不写 `DROP_COUNT` flag | `S1-E2` 捕获 `ingest_rejected=1 status=io_error` | 与 `s1-plan` D16 一致；`DROP_COUNT` 留待 S2 契约变更，acceptance 勿将其作为 S1 事件断言 |

---

## 9. 进程与端口清理证明

- 所有 collector/demo 进程由 `verify.mjs` 在 `finally` 中 `taskkill /PID <pid> /T /F` 停止，并轮询 netstat；`S1-I` 断言 8601/8080/5173/5174/4173/4174 均无 LISTENING、无新增 `java.exe`、git 索引无暂存。
- 最终全链路运行的进程示例：collector `pid=49176`（JDK21）、demo `pid=39728`（JDK8，含 `-javaagent`）；均已退出。
- 独立复核（本报告成文后、最终态复跑之后执行）：

```text
$ netstat -ano | grep -E ":(8601|8080|5173|5174|4173|4174)\s" | grep LISTENING
（无输出）
$ tasklist | grep -i "java.exe"
（无输出）
$ git status --porcelain | wc -l
32   # 全部为 S1 预期修改/新增路径；docs/plans/stages/S1/ 以单个未跟踪目录条目出现（已含本报告）
```

- 说明：`S1-C/D/F` 与 `S1-E` 之间 collector 重启，内存存储按契约清空（重启即清空，无 DB/文件）；这也是 `S1-E1` 在取消前能观测到 `s_s1agent` 404 的原因（无合成启动事件）。

---

## 10. 精确复现命令

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"

# 唯一门禁命令（S0 + S1；exit 0 才算 PASS）
(cd "tools/verify" && npm ci && node verify.mjs)

# 如需单独复核关键证据（verify.mjs 内部即执行这些命令）：
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "workbench" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

unzip -p "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" \
  "BOOT-INF/classes/schema/traceboard.event.v1.json" | sha256sum
sha256sum "schema/traceboard.event.v1.json"

# agent E2E（verify.mjs 使用相同参数，先起 collector 再起 demo）
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java.exe"
"$JAVA8" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_s1agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"

# 依赖版本证据
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -pl server/collector dependency:tree \
  -Dincludes=com.networknt:json-schema-validator,com.fasterxml.jackson.core:jackson-databind
```

---

## 11. S1 出口口径声明

S1 只证明两件事：①一条**假前端事件**（`ui_event → fetch`，`EXACT` 仅描述假数据内部一致）经 `POST /ingest/v1/events` 进入 collector 并被工作台路径读回；②一个**真实插桩**的 controller span（游离后端根：`LOST` + `click_lost_<spanId>` + `LOST_BACKEND`）被采集并读回。二者**没有关联**（无 traceparent/clickId、无合并、无推断），service/mapper/SQL/图/时间轴/回放/实时/持久化均未实现，能力开关 `realtime=false`、`replay=false`。

**S1 TEST: PASS**
