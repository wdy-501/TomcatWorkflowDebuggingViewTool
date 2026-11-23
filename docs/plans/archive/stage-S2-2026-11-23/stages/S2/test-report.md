# S2 测试报告（test-report）

> 阶段：S2（MVP，0 行事实链）｜角色：tester｜日期：2026-11-23｜执行窗口：2026-11-23 12:15–12:32（本地，连续 5 轮完整运行）；S2-AMD-01 修订复跑 2026-11-23 12:37–12:38（第 6 轮，见 §11）
> 绑定输入：`docs/plans/stages/S2/dispatch.md` §5.5、`s2-plan.md` T1–T12/D9、`plan-review.md`（**G1: PASS**，N6）、
> `docs/contracts/api.v1.md` §2.2/§8/附录 B、`event-model.v1.md`、`transport.v1.md` §6.3、`fixtures/s2-zero-row-chain/**`、
> `docs/plans/stages/S2/dispatch-amendment-01.md`（**S2-AMD-01**，2026-11-23）
> 产物：`tools/verify/verify.mjs`（S0+S1+S2 单命令门禁，S1-E/S1-G/S1-H 按 dispatch §4.8 迁移）与本文件
> 结论：**S2 TEST: PASS**（42/42 检查 PASS；连续 5 轮完整执行 `node verify.mjs` 均 `exit 0`，无残留进程/端口；S2-AMD-01 修订后第 6 轮复跑仍 42/42、`exit 0`，见 §11）

---

## 1. 结论摘要

| 项 | 结果 |
|---|---|
| 单命令入口 | `(cd "tools/verify" && npm ci && node verify.mjs)`；逐项打印 `PASS/FAIL [ID]`，任一 gate 失败即非零 |
| 检查结果 | **42 PASS / 0 FAIL**（`checks: 42 PASS / 0 FAIL (total 42)`、`S2 TEST: PASS`、`node_exit=0`） |
| 幂等 | 最终态连续 5 轮完整运行（含全部构建、collector/demo 起停、agent E2E、fail-open）均 42/42、exit 0；末轮在本报告与 `tools/verify` 最终文件下复跑，仍 42/42；端口/进程零残留 |
| 真实 0 行 | `POST /api/orders/1/cancel` → `200 {"data":true}`；`GET /api/orders` **仍 `CREATED` 100.0**；`999` → `404 {"data":false}`；demo fat jar 内嵌 `h2-2.1.214.jar`、无 MySQL 驱动 |
| 4-span 链 | 每次 cancel **恰好 4 个 span**（controller→service→mapper→sql），同 trace/root、父子正确、全 `OK`/`LOST`、区间嵌套；mapper `0`、service `true`、controller `200`、SQL `rowsAffected=0`/`transaction=UNKNOWN`；第二次 cancel 生成**独立第二个 4-span trace** |
| requests/graph | runtime 与 fixture 两路均通过：`spanCount=4`、`rootKind=controller`、`OK`/`LOST`/`hasError=false`、按 `startedAtNs` 排序；graph 4 节点/3 边、按 `startNs`、两次 GET 逐字一致、事件/`seq` 不变；缺 `traceId` 400、未知 trace/session 404、POST 405、replay/stream/ws/links 404 |
| fail-open | 停 collector 后 cancel 仍 `200 {"data":true}`（**3–4ms**）、demo 存活、stderr `ingest_rejected=1 status=io_error`、无应用异常 |
| 构建/产物 | 根 JDK21、demo JDK8、workbench `npm ci && build` 全绿；agent `major=52` + shaded Byte Buddy + `Premain-Class`；collector jar 内 schema 与仓库**字节等价**；workbench dist 含 S2 事实链选择器/文案且保留 S1 假面板与 S0 FixturePanel |
| 冻结/清理 | S2 G1 **9/9 哈希一致**；S0 冻结面 7/7（3 个契约经 S1/S2 G1 链更新、其余未变）；S0/S1 fixture **7/7 字节未变**；6 端口无监听、无遗留 `java.exe`、git 索引无暂存项、产品文件 99/99 运行前后 SHA256 全等 |

---

## 2. 环境（实测，`V0`）

| 项 | 值 |
|---|---|
| OS / Shell | Windows_NT `10.0.29708` x64；Git Bash；仓库 `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（中文+空格，命令/路径全部双引号） |
| Node / npm | `v22.22.2` / `10.9.7`（`tools/verify` 依赖 `ajv 8.20.0`，`ajv/dist/2020.js`，`strict:true`、`allErrors:true`） |
| Maven | Apache Maven `3.9.5`（`D:\apache-maven-3.9.5-bin\apache-maven-3.9.5`）；默认 `JAVA_HOME`=`C:\Program Files\Java\jdk1.8.0_221` |
| JDK21（根 reactor/collector） | `C:/Program Files/Java/jdk-21`，`java version "21" 2023-09-19 LTS`（构建时就地覆盖 `JAVA_HOME`） |
| JDK8（demo/agent E2E） | `C:/Program Files/Java/jdk1.8.0_221/bin/java.exe`，`java version "1.8.0_221"`（固定绝对路径，不依赖 PATH） |
| 端口 | collector `127.0.0.1:8601`、demo `8080`、workbench dev `5173`、demo 前端 `5174`（tester 不启动 Vite，仅检查 4173/4174 也空闲） |
| 浏览器 | tester 不断言截图（orchestrator 提供浏览器证据）；workbench 仅静态断言 dist/源码/代理 |

---

## 3. 执行命令与退出码

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"

# 一次性门禁（唯一入口；S0 + S1 + S2 全量）
(cd "tools/verify" && npm ci && node verify.mjs)
# 实测：checks: 42 PASS / 0 FAIL (total 42) ; S2 TEST: PASS ; node_exit=0

# 构建（门禁内部执行，等价命令）
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)
(cd "workbench" && npm ci && npm run build)
```

- 验证器内部串行起停 collector/demo（`spawn` + `-javaagent:` 单参数 argv），`finally` 与 `process.on("exit")` 双重 `taskkill /T /F` 并轮询 `netstat` 至端口无监听。
- 验证器只写构建产物（`target/`、`dist/`、`workbench/public/fixtures/`，均被 gitignore）与 `os.tmpdir()`；不改产品/契约/fixture/schema，不做任何 git 写操作。
- 开发期修正：扩展后的第一轮在 `S2-8` 因验证器自身一处未解析为绝对路径的 `readFileSync` 崩溃（非产品问题）；修正后连续 5 轮完整运行 42/42、exit 0（末轮含本报告且与最终文件逐字一致）。

---

## 4. 门禁清单（42 项，全部 PASS）

| 组 | 检查 ID | 断言摘要 | 结果 |
|---|---|---|---|
| S0 保留 | `V0/V1/V1b/V1c/V4b` | 环境；case-A schema/事实/反例/因果区间 | PASS ×5 |
| S0 保留 | `V2a–V2d`、`V2c-3` | 根 JDK21、demo JDK8、workbench、demo 前端构建；fixture 预拷贝字节等价 | PASS ×7 |
| S0 保留 | `V3`、`V6a–V6e` | agent major 52；workbench/demo 产物、无外链、MANIFEST | PASS ×6 |
| S0 保留 | `V8a–V8d` | secrets/遥测/CDN/CRLF；运行前后无产品写入 | PASS ×4 |
| S1 保留 | `S1-A`、`S1-B` | S1 fixture + expected-facts；S1 产物/代理/dist 标记 | PASS ×2 |
| S1 保留 | `S1-C0–C3`、`S1-D`、`S1-F` | ingest 202/拒绝/415/400/413；查询分页 400/404/405；workbench 假批次路径 | PASS ×6 |
| S2-7 | `S2-7` | S2 fixture 4 行过 schema、单根/共享 trace/root/LOST/OK/嵌套、0 行/UNKNOWN、6 facts + 28 globalAssertions、负例（seq/双根/断链/EXACT）被拒、S0/S1 fixture 字节未变 | PASS |
| S2-1 | `S2-1` | 根 JDK21 + demo JDK8 + workbench 构建；agent 52/shaded/premain；collector schema 字节等价且仅 1 份 | PASS |
| S2-3 | `S2-3` | agent E2E：每次 cancel 恰好 4 span，链/父子/状态/返回/行数/嵌套/flags，第二次独立 trace | PASS |
| S2-2 | `S2-2` | demo 0 行缺陷：200 true + 列表仍 CREATED + 未知 404 + 内嵌 H2 无 MySQL | PASS |
| S2-4 | `S2-4`、`S2-4F` | runtime 与 fixture 两路 requests/graph 形状/排序/确定性/400/404/405/reserved 404 + S1 sessions/events 回归 | PASS ×2 |
| S2-3b | `S2-3b` | 未知 id 若被采集为 2 span（controller 404 + service RETURNED_FALSE），无 mapper/sql；不作为 case A 失败 | PASS |
| S2-5 | `S2-5` | fail-open：停 collector 后 200/3–4ms、demo 存活、stderr ingest_rejected、无异常 | PASS |
| S2-6 | `S2-6` | dist 含 `0 行事实链`/`requests`/`graph`/`rowsAffected`/`未采集`/`事实摘要`/`traceId` + `#s2-*`；S1/S0 面板保留；无图库/S3 | PASS |
| S2-L | `S2-L` | S2 G1 9/9、S0 冻结 7/7、S1 fixture 7/7 字节一致、case-A 有效、S0 构建绿 | PASS |
| S2-8 | `S2-8` | 6 条 collector 路由、4 个 agent 插桩点、无 S3/SDK/持久化/流、H2 仅内嵌、无 secret/镜像/第二份 schema | PASS |
| S2-9 | `S2-9` | 6 端口空闲、无遗留 java、git 状态仅预期 S2 路径且索引未动、验证器未改产品文件；S2-AMD-01 例外：仅精确文件 demo 前端 `src/App.vue` 允许（目录仍冻结）+ 文案/模板级 diff 断言（见 §11） | PASS |

---

## 5. S2 关键证据

### 5.1 运行时 4-span 链（collector + demo + `-javaagent`，sessionId `s_s2agent`）

启动参数（固定 JDK8 绝对路径）：

```bash
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"
"$JAVA8" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events \
  -Dtraceboard.sessionId=s_s2agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar"
```

一次 `POST /api/orders/1/cancel` 后的 4 条事件（**到达顺序 = 方法退出顺序**：sql→mapper→service→controller；消费方按 `startNs`/父子关系还原链）：

```json
{"seq":1,"kind":"sql","status":"OK","parentSpanId":"ed5858dd0042d42c","return":null,"sideEffects":[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":0,"transaction":"UNKNOWN"}],"flags":["S2_ZERO_ROW_CHAIN","DROP_COUNT=0"],"startNs":18169777800,"durNs":483700}
{"seq":2,"kind":"mapper","status":"OK","parentSpanId":"c73b2a3912cd5768","return":{"type":"int","value":0},"sideEffects":null,"flags":["S2_ZERO_ROW_CHAIN","DROP_COUNT=0"],"startNs":18168660700,"durNs":1888700}
{"seq":3,"kind":"service","status":"OK","parentSpanId":"617929db2544b366","return":{"type":"boolean","value":true},"sideEffects":null,"flags":["S2_ZERO_ROW_CHAIN","DROP_COUNT=0"],"startNs":18165032200,"durNs":5606900}
{"seq":4,"kind":"controller","status":"OK","parentSpanId":null,"return":{"type":"org.springframework.http.ResponseEntity","value":200},"sideEffects":null,"flags":["S2_ZERO_ROW_CHAIN","LOST_BACKEND","DROP_COUNT=0"],"startNs":18164804100,"durNs":7522600}
```

- 同一 trace（32 hex）/同一 `rootEventId=click_lost_<根spanId>`；根 `parentSpanId=null` + `LOST_BACKEND`（仅根）；子 span 指向父并继承 `LOST`。
- 链：controller(LOST 根, 200, dur 7.52ms) ⊃ service(true, 5.61ms) ⊃ mapper(0, 1.89ms) ⊃ sql(rows 0/UNKNOWN, 0.48ms)，全 `OK`，无 `THREW`，`durNs>0`。
- `DROP_COUNT=<n>` 是 S1 遗留的运行时 flag，**不作为断言**（不逐字比较 flags）；fixture 则断言精确 flags（见 §5.7）。
- Byte Buddy transform 日志 4/4：`OrderController`、`OrderService`、`MapperProxy`、`PreparedStatementHandler`；`premain installed` 含 4 个目标与 `sessionId=s_s2agent`。
- 第二次 cancel → 第二个独立 4-span trace（`two independent 4-span traces with distinct traceIds/root spans :: aa54e7ce(4),6c0d2f5b(4)`）。

### 5.2 demo 0 行（H2/MyBatis，运行时 DB 事实）

```text
GET  /api/orders            -> {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.0}]}
POST /api/orders/1/cancel   -> {"data":true}                     (HTTP 200)
GET  /api/orders            -> {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.0}]}   # 仍 CREATED
POST /api/orders/999/cancel -> {"data":false}                    (HTTP 404)
```

- `UPDATE orders SET status='CANCELLED' WHERE id=? AND status='PAID'` 对 `CREATED` 行影响 0 行；Service 忽略行数仍返回 true；Controller 200。
- 证据链：H2 是 demo fat jar 内嵌运行时（`BOOT-INF/lib/h2-2.1.214.jar`，`mysql jars=0`；`jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1` + `spring.sql.init.mode=always`），**无 MySQL/外部 DB 服务**。
- 未插桩 `countById`（存在性检查）属**采集范围限定**：链固定 4 span，不合成 select span（见 §8）。

### 5.3 `GET /api/v1/sessions/s_s2agent/requests`（真实响应）

fixture ingest 后（`202 {"accepted":4,...}`）：

```json
{"sessionId":"s_s2agent","requests":[{"traceId":"9f8e7d6c5b4a39281706f5e4d3c2b1a0","rootSpanId":"1a2b3c4d5e6f7a80","rootKind":"controller","nodeKey":"com.example.shop.controller.OrderController#cancel","status":"OK","confidence":"LOST","spanCount":4,"startedAtNs":1000000000,"durNs":8000000,"hasError":false}]}
```

runtime（两次 cancel）：

```json
{"sessionId":"s_s2agent","requests":[
 {"traceId":"7b51160ed6c6963bad7c9798fd16f8db","rootSpanId":"d066349adae69c14","rootKind":"controller","nodeKey":"com.example.shop.controller.OrderController#cancel","status":"OK","confidence":"LOST","spanCount":4,"startedAtNs":3090540300,"durNs":8038300,"hasError":false},
 {"traceId":"3a24160ebe895326bdbf6835cc01b986","rootSpanId":"9764e4aade1d15e4","rootKind":"controller","nodeKey":"com.example.shop.controller.OrderController#cancel","status":"OK","confidence":"LOST","spanCount":4,"startedAtNs":4163087800,"durNs":862300,"hasError":false}]}
```

### 5.4 `GET /api/v1/sessions/s_s2agent/graph?traceId=<32hex>`（真实响应，fixture trace）

```json
{"sessionId":"s_s2agent","traceId":"9f8e7d6c5b4a39281706f5e4d3c2b1a0","rootEventId":"click_lost_1a2b3c4d5e6f7a80","confidence":"LOST","nodes":[{"spanId":"1a2b3c4d5e6f7a80","parentSpanId":null,"kind":"controller","nodeKey":"com.example.shop.controller.OrderController#cancel","status":"OK","return":{"type":"org.springframework.http.ResponseEntity","value":200},"sideEffects":[],"startNs":1000000000,"durNs":8000000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},"flags":["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]},{"spanId":"2b3c4d5e6f7a8091","parentSpanId":"1a2b3c4d5e6f7a80","kind":"service","nodeKey":"com.example.shop.service.OrderService#cancel","status":"OK","return":{"type":"boolean","value":true},"sideEffects":[],"startNs":1001000000,"durNs":6500000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},"flags":["S2_ZERO_ROW_CHAIN"]},{"spanId":"3c4d5e6f7a8091a2","parentSpanId":"2b3c4d5e6f7a8091","kind":"mapper","nodeKey":"com.example.shop.mapper.OrderMapper#cancelById","status":"OK","return":{"type":"int","value":0},"sideEffects":[],"startNs":1002000000,"durNs":5000000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},"flags":["S2_ZERO_ROW_CHAIN"]},{"spanId":"4d5e6f7a8091a2b3","parentSpanId":"3c4d5e6f7a8091a2","kind":"sql","nodeKey":"OrderMapper.cancelById","status":"OK","return":null,"sideEffects":[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":0,"transaction":"UNKNOWN"}],"startNs":1003000000,"durNs":3000000,"thread":{"id":44,"name":"http-nio-8080-exec-1"},"flags":["S2_ZERO_ROW_CHAIN"]}],"edges":[{"from":"1a2b3c4d5e6f7a80","to":"2b3c4d5e6f7a8091","count":1},{"from":"2b3c4d5e6f7a8091","to":"3c4d5e6f7a8091a2","count":1},{"from":"3c4d5e6f7a8091a2","to":"4d5e6f7a8091a2b3","count":1}]}
```

- runtime graph 同形状（4 节点/3 边、SQL `rowsAffected=0`/`UNKNOWN`），两次 GET 逐字一致，事件数/`seq` 不变。
- 参数/错误：缺失或大写 `traceId` → 400 信封（message 43 字符、不回显参数）；未知 trace/session → 404；`POST` → 405；`replay/stream/ws/links` → 404。

### 5.5 fail-open（停 collector）

```text
collector stopped, 8601 free                 :: no LISTENING socket
POST cancel with collector down -> 200       :: {"data":true}
fail-open latency < 3000ms                   :: 3ms（另两轮 4ms）
demo process alive after collector stop      :: GET /api/orders -> 200
agent stderr                                 :: [traceboard-agent] ingest_rejected=1 status=io_error
应用异常                                     :: 无（无 APPLICATION FAILED TO START / Exception in thread / premain failed）
```

### 5.6 工作台（dist 静态断言）

`workbench/dist` 含 `0 行事实链`、`requests`、`graph`、`rowsAffected`、`未采集`、`事实摘要`、`traceId`、`事实摘要，不是缺陷结论`、`游离后端请求（无前端根）`、`每 5 秒刷新（非实时）`、`#s2-panel/#s2-session/#s2-refresh/#s2-requests/#s2-chain`；
保留 `S1 walking skeleton（假数据，非 S2 事实链）`（S1Panel 折叠次级）与 `Fixture 事实摘要`/`case-a-zero-rows · 只读`（S0 FixturePanel）；无 `EventSource/WebSocket/sendBeacon`、无 canvas/图库、无 replay/timeline 路由或面板 id。

### 5.7 S2 fixture（`fixtures/s2-zero-row-chain/**`）

- `events.ndjson` 4 行、LF 末行、无 BOM/CR、无空行；4/4 过冻结 schema（Ajv 2020-12 strict）；不含 `seq/values/reason`。
- 单 trace/单根（controller `1a2b3c4d5e6f7a80`）、父子链 controller→service→mapper→sql、`startNs` 1000000000/1001000000/1002000000/1003000000、`durNs` 8000000/6500000/5000000/3000000 严格嵌套；全 `LOST`/全 `OK`/无 `THREW`；根 flags 精确 `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]`，子 flags 精确 `["S2_ZERO_ROW_CHAIN"]`；SQL `rowsAffected=0`/`transaction=UNKNOWN`。
- `expected-facts.json`：6 facts + 28 个 `globalAssertions.chain` 键全部深比较通过（含 `#trace.threwCount=0`、`#trace.spanCount=4`）。
- 负例：加 `seq` 被 schema 拒；双根/断父链/`confidence=EXACT` 被链不变量拒。
- fixture 只作确定性测试数据；**运行时 0 行证据来自 §5.2 的 H2+MyBatis demo + javaagent E2E，不用 fixture 冒充**。

---

## 6. 冻结哈希（实测，与 S2 G1 基线逐字一致）

S2 G1（9/9）：

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
0bf3d28f3e6ee97339c62df6e87dcebb664e7e710b8e3a32007c8ce2fe382607  docs/contracts/api.v1.md
228ffa962ce47bf77dd5360f654aedc50b4dd113891eff39c47a6400023dae2d  docs/contracts/event-model.v1.md
cf7c0475b8da9c066d3f99408354f0b619e0aa7161fe740af1f630d7c43b59c1  docs/contracts/transport.v1.md
2d1abc0f211979aa4853fa979673ff32d82a3689f958ee965890fb6cec1535fc  fixtures/s2-zero-row-chain/events.ndjson
8869ad79cdedc490bbb4ec5d6738abe9e84c3ced5705a54976abf5527b409a69  fixtures/s2-zero-row-chain/expected-facts.json
c2ab2fc1b99b2bf9476639cccfb0642a6f573574a81e6e5e4e54d997d234585b  fixtures/s2-zero-row-chain/README.md
65f24eb2b15013060cb56bae05c22207d21b31bb558b0ac7a0dc6f8a5e7021bc  docs/plans/stages/S2/s2-plan.md
bf602001ce0bf87bde93a8cc695e32a9edffc68b8612d03d1364cc13ffc51adc  docs/plans/stages/S2/dispatch.md
```

S0/S1 冻结面（7/7 字节未变）：

```text
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d  fixtures/case-a-zero-rows/README.md
6832e9f97de378f239210b9a9bab58e56446db497f9192cd34a7d4e7aa08b972  fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson
13a77e9db2e55cd51c67a912d719040c4c983c9d3220216bf65c97f633a0e70c  fixtures/s1-walking-skeleton/agent-controller-span.json
380a03584061dbfd5105e20283fa66dc27e921b3f44c35e0e43c10e8e0c49bf1  fixtures/s1-walking-skeleton/expected-facts.json
b7f51b046f962efc50dc850a08f0a41cc931159274615b15f7bfb677803b839a  fixtures/s1-walking-skeleton/README.md
```

- S0 基线 7 项：`schema`/case-A 2 项/`status-semantics` 未变；`api`/`transport`/`event-model` 仅通过 S1→S2 G1 冻结链更新（等于 S2 基线）。

---

## 7. 清理证明（`S2-9`，最后一轮实测）

```text
port 8601/8080/5173/5174/4173/4174 not LISTENING  :: free
no java.exe process left behind                    :: none (baseline=0)
no git change under frozen/foreign paths           :: none（schema、case-A/S1 fixture、demo 前端、S0 文档）
git status only shows expected S2 product/test paths :: 39 expected entries
git index untouched                                :: all changes untracked/unstaged
no product file modified by this verify run        :: 99 product files stable
```

- collector/demo 由 `finally` + `process.on("exit")` 双重兜底停止；Vite 未由 tester 启动（5173/5174/4173/4174 仅确认空闲）。
- 全程无 git 写操作（未 add/commit/tag/push）；验证器自身输出仅 `tools/verify` 与本报告。

---

## 8. 覆盖限制与门禁迁移（不放宽）

1. **`countById` 不插桩**：demo 存在性检查用真实 SQL（`countById`），但 agent 只插桩 `OrderMapper#cancelById` → cancel 链固定 4 span。这是**采集范围限定**，不是伪造；UI/报告不得暗示“已采集全部 SQL”。
2. **未知 id 链**：`999` 被采集为 2 span（controller `200 OK`/`return.value=404` + service `RETURNED_FALSE`，无 mapper/sql），作为 coverage limit 记录，不影响 case A 的 4-span/0 行判定。
3. **运行时 flags**：含 `DROP_COUNT=<n>`（S1 遗留），S2 运行时**不逐字比较 flags**，只断言 `S2_ZERO_ROW_CHAIN` 全覆盖、`LOST_BACKEND` 只在根；fixture 仍精确断言 flags。
4. **S1 门禁迁移（dispatch §4.8）**：`S1-E`（单 controller span）→ `S2-3`（4-span 链）；`S1-G`（S1 契约哈希基线）→ `S2-L`（S0 冻结面 + S2 G1 哈希，S1 fixture 字节仍断言）；`S1-H`（无 graph/单插桩点）→ `S2-8`（6 路由 + 4 插桩点 + 无 S3）。`S1-A/S1-B/S1-C/D/S1-F` 全部保留；`S1-D` 的 `graph` 断言由 404 改为 **400（缺 traceId）**，`replay/stream/ws/links` 仍 404。
5. **S0 保留**：`V1/V1b/V1c/V4b/V2/V3/V6/V8` 全部保留；`V6a` 的 S0 占位面板字符串（`前端图（占位）`/`请求分图（占位）`，原标注“未实现（S1 不做）”）已按 S2 §4.6 被 S2 面板取代，故迁移为“AppShell + S0 FixturePanel 仍在”并额外断言旧占位文案已移除；其余 V6b–V6e 不变。
6. **浏览器证据**：由 orchestrator 提供，tester 不断言截图；workbench 仅断言 dist/源码/代理。
7. **范围声明**：S2 通过仅证明“真实 0 行 + 4-span 后端链 + 只读 requests/graph + 工作台事实板”；**无前端 SDK/关联/回放/实时**，不等同产品完成。

---

## 9. 精确复现

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"

# 1) 一次性门禁（S0+S1+S2；exit 0 仅当 42/42 全 PASS）
(cd "tools/verify" && npm ci && node verify.mjs)

# 2) 手工复现 0 行 + 4-span + requests/graph
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:8601/actuator/health" >/dev/null && break; sleep 1; done
"C:/Program Files/Java/jdk1.8.0_221/bin/java" \
  -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events \
  -Dtraceboard.sessionId=s_s2agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://localhost:8080/api/orders" >/dev/null && break; sleep 1; done
curl -s "http://localhost:8080/api/orders"                                  # id=1 CREATED 100.0
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"                # {"data":true}
curl -s "http://localhost:8080/api/orders"                                 # 仍 CREATED（真实 0 行）
curl -s -X POST "http://localhost:8080/api/orders/999/cancel" -w "\n%{http_code}\n"   # {"data":false}/404
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
# 取 traceId 后读图：
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=<32hex>"
# 停止：kill %1 %2（Windows 兜底 taskkill /PID <pid> /T /F）

# 3) fixture 驱动的 API 形状（确定性）
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s2-zero-row-chain/events.ndjson"                # 202 accepted=4
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=9f8e7d6c5b4a39281706f5e4d3c2b1a0"
```

---

## 10. 结论

- S2 六项完成信号全部由**真实进程/真实 H2 SQL/真实 agent 事件**验证：0 行（DB 仍 CREATED + SQL `rowsAffected=0`）、4-span 后端链、collector 只读派生 requests/graph、工作台事实板、fail-open、S0/S1 回归。
- 一次命令 `(cd "tools/verify" && npm ci && node verify.mjs)` 输出 42/42 PASS、`S2 TEST: PASS`、`node_exit=0`；连续 5 轮完整运行一致，端口/进程/git 零残留。
- 冻结面零漂移：S2 G1 9/9、S0/S1 fixture 7/7、schema 字节未变；无 S3 能力、无 secret/真实数据/遥测/CDN/镜像/第二份 schema。

**S2 TEST: PASS**

---

## 11. 修订 S2-AMD-01（demo 前端页头文案）复跑

> 依据：`docs/plans/stages/S2/dispatch-amendment-01.md`（**S2-AMD-01**，2026-11-23 生效；SHA256 `3816c16662f018cad1adad37ce6fa3dd5e369b2b0eaa77e8789245043c1b6928`）与 `acceptance.md` §11 解除阻断选项 2。
> 本轮仅改 `tools/verify/verify.mjs` 与本报告；未改产品代码/契约/fixture/schema/其它文档，无 git 写操作（无 add/commit/tag）。
> **不是 S3，也不是前端 SDK 变更**：demo 前端仍无 SDK/关联/采集调用，仅页头文案修正；S2 出口口径不变。

### 11.1 授权范围（S2-9 允许清单，最小面）

| 项 | 值 |
|---|---|
| 唯一允许文件 | `demo/buggy-shop-boot-vue/frontend/src/App.vue`（精确路径；**非**目录前缀） |
| 目录仍冻结 | `demo/buggy-shop-boot-vue/frontend/` 继续列在 `forbidden`；文件条目按全等匹配、目录条目才按前缀匹配，豁免不可扩大为任何目录前缀；同一精确路径加入 `allowed` 使“git status 仅预期 S2 路径”通过 |
| 实际 diff | **5+/2-**，全部在 `<template>` 页头（`<h1>` + `.subtitle`）：`BuggyShop · 取消订单（案例 A）`，副标题“S2 demo · 案例 A 故意缺陷：取消返回成功，但数据库 UPDATE 0 行；订单仍为 CREATED。后端由 Java agent 采集；前端无 SDK。…” |
| 未改动 | `<script setup>` 全量逻辑、`fetch("/api/orders")`、`fetch("/api/orders/1/cancel",{method:"POST"})`、`showSuccess`/`rawJson`/`loadOrders`、按钮/toast/样式类；`index.html`、`src/main.ts`、`src/style.css`、`package.json`、`vite.config.ts`、`tsconfig.json`、`env.d.ts` 均未改 |

### 11.2 新增断言（均并入 `S2-9` 单个 gate，检查总数仍为 42）

| 断言 | 实测证据 |
|---|---|
| 允许清单只含精确文件；目录前缀不在 `allowed`、仍在 `forbidden` | `ok S2-AMD-01: only the exact file ... allowlisted :: exact=demo/buggy-shop-boot-vue/frontend/src/App.vue; prefix demo/buggy-shop-boot-vue/frontend/ excluded from allowed` |
| 该前缀下除 `src/App.vue` 外无任何 git 变更（其余 demo 前端文件冻结） | `ok demo frontend: no file besides src/App.vue is changed/frozen :: changed=[demo/buggy-shop-boot-vue/frontend/src/App.vue] others=0` |
| 新案例 A 文案存在（`案例 A`/`故意缺陷`/`UPDATE 0 行`/`后端由 Java agent 采集`/`前端无 SDK`），旧串 `S0 demo 骨架`、`无采集`、`无缺陷`、`S0 demo 骨架：无采集、无缺陷、无 SDK` 在 demo 前端 `src/` 与 `dist/` 均不存在 | `ok S2-AMD-01 copy: case-A banner present, stale S0 copy absent :: source banner ok; dist banner ok (3 files); stale copy absent` |
| App.vue diff 仅文本/`<template>`：`<script setup>` 与 template 外区段逐字节等于 `HEAD:`，模板 60 个元素/属性标记清单与 HEAD 全等（无 button/toast/script 增删；`fetch` 未变） | `ok App.vue diff is text/template only :: script+style byte-identical to HEAD; 60 template tags identical; text nodes only` |
| demo 前端仍无 SDK/collector 调用：每次 `fetch` 仅 `/api`；无 `/ingest`、`:8601`、`traceboard`/`traceparent`/`clickId`、EventSource/WebSocket/sendBeacon | `ok demo frontend still calls no SDK/collector :: 2 fetch calls, targets: /api/orders, /api/orders/1/cancel` |

### 11.3 复跑结果（2026-11-23 12:37–12:38，第 6 轮完整执行）

```text
(cd "tools/verify" && npm ci && node verify.mjs)
checks: 42 PASS / 0 FAIL (total 42)
S2 TEST: PASS
NODE_EXIT=0

--- S2-9 cleanup ---
PASS  [S2-9] cleanup: ports free, no java processes, git untouched, no product writes by verify
        ok  no git change under frozen/foreign paths (schema, case-A/S1 fixtures, demo frontend except S2-AMD-01 src/App.vue, S0 docs) :: none
        ok  git status only shows expected S2 product/test paths :: 41 expected entries
        ok  git index untouched (no staged entries) :: all changes untracked/unstaged
        ok  S2-AMD-01: only the exact file demo frontend src/App.vue is allowlisted ... :: exact=demo/buggy-shop-boot-vue/frontend/src/App.vue; prefix .../frontend/ excluded from allowed
        ok  demo frontend: no file besides src/App.vue is changed/frozen (S2-AMD-01 scope) :: changed=[demo/buggy-shop-boot-vue/frontend/src/App.vue] others=0
        ok  S2-AMD-01 copy: case-A banner present, stale S0 copy absent (demo frontend src + dist) :: source banner ok; dist banner ok (3 files); stale copy absent
        ok  App.vue diff is text/template only (...) :: script+style byte-identical to HEAD; 60 template tags identical; text nodes only
        ok  demo frontend still calls no SDK/collector (...) :: 2 fetch calls, targets: /api/orders, /api/orders/1/cancel
        ok  no product file modified by this verify run :: 99 product files stable
```

- 同轮其余 41 项全部 PASS（S0/S1 回归、S2-1..S2-8、S2-L、S2-9 端口/进程/索引/产品快照子项）；V2a/V2b/V2c-1/V2c-2/V2d-1/V2d-2 构建 `exit 0`，4-span E2E、fail-open、requests/graph 与上一轮一致（`S2-7`/`S2-1`/`S2-3`/`S2-4`/`S2-4F`/`S2-2`/`S2-3b`/`S2-5` 全 PASS）。
- 清理：6 端口无 LISTENING、无 `java.exe` 残留；验证器未写产品（99 文件稳定）；全程无 git 写操作。
- 终态文件哈希：`tools/verify/verify.mjs` = `d75bb64b56d2b2b3c3d64b1f7fa75e98771e6bfa9e0baa6299e440e3721dcecc`；`docs/plans/stages/S2/dispatch-amendment-01.md` = `3816c16662f018cad1adad37ce6fa3dd5e369b2b0eaa77e8789245043c1b6928`。
- 该例外仅覆盖此单文件文案，须在 G2 记录为“冻结路径例外 = S2-AMD-01（单文件文案）”，**不得作为后续先例**；若需改 `App.vue` 文案以外内容或其它 demo 前端文件，须另发修订。

**S2 TEST: PASS（含 S2-AMD-01 复跑 42/42、exit 0）**
