# S0 测试报告（test-report）

> 阶段：S0（MVP）｜角色：tester｜日期：2026-11-23｜执行时刻：2026-11-23 10:35 / 10:36 / 10:38（本地，连续三轮）
> 绑定简报：`docs/plans/stages/S0/dispatch.md` §3/§4/§5.5/§8/§9；`s0-plan.md` §7（V1–V11 + V4b）与 §9 命令；`plan-review.md` 复评（G1: PASS）
> 产物：`tools/verify/`（`package.json`、`package-lock.json`、`verify.mjs`；`node_modules/` 已被根 `.gitignore` 忽略）与本文件
> 结论：**S0 TEST: PASS**（26/26 检查 PASS，三轮复跑一致，退出码 0）

---

## 1. 结论摘要

| 项 | 结果 |
|---|---|
| 一次性校验入口 | `(cd "tools/verify" && npm ci && node verify.mjs)`；任一 gate 失败即非零退出 |
| 检查结果 | **26 PASS / 0 FAIL**（三轮连续执行，退出码均为 0） |
| 失败的必须有 | 无 |
| 关键数字 | JSONL 9 行全过 Ajv 2020-12（strict:true）；V4b 区间违规 **0**；agent major version **52**；collector health=UP / meta schema id 正确 / ingest=**501**；demo orders=**200**（id=1）/ cancel=**200 {"data":true}** / 未知 id=**404** |
| 冻结哈希 | schema/fixtures/contracts 7 个文件与 `plan-review.md` 基线**逐字节一致**（见 §6） |
| 进程/端口 | 冒烟后 8601/8080 无 LISTENING 残留；无遗留 java/node 测试进程（见 §7） |
| 非阻断发现 | 1 条（ingest 占位 message 文案与 `api.v1.md` §3.3 示例存在后缀差异，见 §8 F-1） |

## 2. 环境（实测，2026-11-23）

| 项 | 值 |
|---|---|
| OS / Shell | Windows_NT `10.0.29708` x64（`mvn -v` 报 os name "windows 11"）；Git Bash；仓库路径含中文与空格，所有命令双引号 |
| Node / npm | `v22.22.2` / `10.9.7`（与 dispatch §8 一致） |
| Maven | Apache Maven `3.9.5`（`D:\apache-maven-3.9.5-bin\apache-maven-3.9.5`） |
| 默认 JAVA_HOME（demo 用） | `C:\Program Files\Java\jdk1.8.0_221`（`mvn -v` → Java 1.8.0_221） |
| 根/collector JDK | `C:/Program Files/Java/jdk-21`（`java version "21" 2023-09-19 LTS`，build 21+35-LTS-2513） |
| 校验依赖 | `ajv` **8.20.0**（满足 `^8.17.1`；入口 `ajv/dist/2020.js`，`strict:true`、`allErrors:true`）；无其他运行时依赖 |
| 附加可执行文件 | JDK8 `java.exe` 不在 Git Bash PATH 中，冒烟与复现均用绝对路径 `C:/Program Files/Java/jdk1.8.0_221/bin/java.exe` |

## 3. 校验工具（`tools/verify/verify.mjs`）

- 单文件 ESM；`REPO` 由 `fileURLToPath(import.meta.url)` 解析（不依赖 cwd），可在任意目录以 `node tools/verify/verify.mjs` 运行。
- 输出逐项 `PASS  [ID] 标题` / `FAIL  [ID] 标题`（含子断言 `ok/BAD`、退出码、耗时、证据片段）；失败行附 `repro:` 精确复现命令；末行 `S0 TEST: PASS|FAIL`。
- 进程管理：collector/demo 用 Node `spawn` 启动真实 jar，`finally` 中 `taskkill /PID <pid> /T /F` 兜底 + 轮询 `netstat` 至端口无 LISTENING；`process.on("exit")` 再兜底一次。
- 只写系统临时目录（`os.tmpdir()`，反例副本，用后删除）；不修改任何产品文件（见 §5 V8d：52 个产品文件运行前后 SHA256 全等）。
- 幂等：连续三轮 `node verify.mjs` 均为 26 PASS / exit 0；构建命令可重复执行。
- 编号对照（本报告/任务卡 ↔ `s0-plan.md` §7）：`V1`=V1+V2+V3；`V1b`=V4（事实）；`V1c`=V5；`V4b`=V4b；`V2`=V6；`V3`=V7；`V5`=V8+V9；`V6`=V10；`V0`=V11；`V7`（冻结漂移）与 `V8`（安全/卫生）为分发书扩充项。

## 4. 逐项结果（26 项）

| ID | 检查 | 结果 | 关键证据 |
|---|---|---|---|
| V0 | 环境记录 | PASS | node v22.22.2 / npm 10.9.7 / java21 21 LTS / mvn 3.9.5（JDK8 与 JDK21 两次 `-v`） |
| V1 | schema 可加载 + JSONL 不变量 | PASS | Ajv 2020-12 `strict:true` 编译成功；`$ref` 计数 0；9/9 行 validate=true；9 行、无 BOM、`\r`=0、末字节 `0x0a`、无空行/注释行；spanId 9 个唯一 16 位小写 hex；唯一根 `1000000000000001`（ui_event）；traceId 唯一 `4bf92f35...4736`；startNs `0,2e6,3e6,6e6,7.5e6,8e6,9e6,10e6,39e6` 非降序 |
| V1b | expected-facts 深比较 | PASS | eventCount=9；noExceptions（THREW=0）；confidence 全 EXACT；status 全 OK；9/9 行含 `DROP_COUNT=0`；traceId/rootEventId 全等；F1 `sideEffects.0.rowsAffected=0`、F2 `return.value=0`、F3 `=true`、F4 `=200`、F5 `="操作成功"` 五条全等 |
| V1c | 反例/正例自检 | PASS | `status:"SUCCESS"` 拒绝（enum）；`NOT_COLLECTED_POLICY` 缺 `reason` 拒绝（then required）；多顶层字段拒绝（additionalProperties:false）；`NOT_COLLECTED_POLICY + reason` 接受；源 fixture 哈希前后不变 |
| V4b | 因果区间包含性 | PASS | 9 个事件 **0 违规**：7 个非根非 callback span 严格落在父区间；callback 仅 1 个（`…0009`，父 `…0004` fetch）应用唯一例外并落在根 `[0,52ms]` 内；例外未外溢到其它 kind（strict=7 + callback=1） |
| V2a | 根 reactor（JDK21）`mvn -B -q -DskipTests package` | PASS | exit 0；verbose 复核：TraceBoard / Agent / Collector 三模块 SUCCESS + `BUILD SUCCESS` |
| V2b | demo 后端（默认 JDK8）`mvn -B -q -DskipTests package` | PASS | exit 0（JAVA_HOME=`C:\Program Files\Java\jdk1.8.0_221`）；verbose 复核 `spring-boot:2.7.18:repackage` + `BUILD SUCCESS` |
| V2c-1 | workbench `npm ci` | PASS | exit 0（5.2s） |
| V2c-2 | workbench `npm run build`（prebuild 同步） | PASS | exit 0；`vue-tsc --noEmit` + vite 产物 `dist/assets/index-*.js 76.61 kB` |
| V2c-3 | prebuild fixture 副本一致 | PASS | `workbench/public/fixtures/...` 两文件 SHA256 与 `fixtures/` 源一致（§6） |
| V2d-1 | demo 前端 `npm ci` | PASS | exit 0（3.4s） |
| V2d-2 | demo 前端 `npm run build` | PASS | exit 0；产物 `dist/assets/index-*.js 68.36 kB` |
| V3 | agent 字节码 52 | PASS | `javap -verbose` → `minor version: 0 / major version: 52`；class 头字节回退校验 major=52 |
| V5a | collector 冒烟 | PASS | 起 JDK21 于 8601；health `200 {"status":"UP"}`；meta `schema.id=urn:traceboard:schema:event:v1`、`capabilities={health:true,meta:true,ingestEvents:false,realtime:false,replay:false}`；`POST /ingest/v1/events`（NDJSON 9 行 body）→ **501** `{"error":"not_implemented",...,"apiVersion":"v1"}`；停止后 8601 释放 |
| V5b | demo 后端冒烟 | PASS | 起 JDK8 于 8080；`GET /api/orders` 200 `{"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100}]}`；`POST /api/orders/1/cancel` 200 `{"data":true}`；`POST /api/orders/999/cancel` 404 `{"data":false}`；停止后 8080 释放 |
| V5c | 端口释放 | PASS | 三轮冒烟后 `netstat -ano` 均无 8601/8080 LISTENING |
| V6a | workbench dist 标记 | PASS | dist JS/CSS 含 `app-shell`、`前端图`、`请求分图`、`Fixture 事实摘要` |
| V6b | dist fixture 副本 SHA256 | PASS | `workbench/dist/fixtures/case-a-zero-rows/{events.jsonl,expected-facts.json}` 与源逐字节一致 |
| V6c | demo dist 标记 | PASS | 含 `btn-cancel`、`操作成功`、`raw-json` |
| V6d | 无外部资源 URL | PASS | 构建产物共 4 个 URL，全部为惰性/回环：`www.w3.org/{2000/svg,1999/xlink,1998/Math/MathML}`（DOM 命名空间）与 `vuejs.org/error-reference/…`（Vue 运行时错误文案）；无 `src/href/url()` 外链 |
| V6e | agent MANIFEST | PASS | `Premain-Class: io.traceboard.agent.TraceAgent`；`Implementation-Title: TraceBoard Agent`；`Implementation-Version: 0.1.0-SNAPSHOT` |
| V7 | 冻结漂移 | PASS | 7 个基线哈希全部一致；另报 `fixtures/README.md`、`fixtures/case-a-zero-rows/README.md` 哈希（基线未收录，见 §6） |
| V8a | secret 扫描 | PASS | 项目源码/配置（排除 node_modules、target、dist、lock）0 命中；占位符命中 0 |
| V8b | 遥测/CDN | PASS | 16 个遥测域名与 9 个 CDN 主机在源码+dist 中 0 命中 |
| V8c | `.gitattributes`/CRLF 风险 | PASS（记录） | `.gitattributes` 不存在（G2 由 acceptance 按 D15 创建）；`core.autocrlf=true`（`file:C:/Program Files/Git/etc/gitconfig`）；fixture `\r`=0；风险与处置写入 §8 F-2 |
| V8d | 无产品写入 / git 索引干净 | PASS | 运行前后 52 个产品文件 SHA256 全等、无新增；`git status --porcelain` 全部为 `??`（仓库 0 commit，无 add/modify/delete）；`tools/verify/node_modules` 被忽略 |

## 5. 关键证据片段

### 5.1 V1 字节与结构（独立 shell 复核）

```text
$ file "fixtures/case-a-zero-rows/events.jsonl"
fixtures/case-a-zero-rows/events.jsonl: New Line Delimited JSON text data
$ od -An -tx1 -N3 ".../events.jsonl"      -> 7b 22 73        # 无 BOM
$ tr -cd '\r' < ".../events.jsonl" | wc -c -> 0
$ wc -l < ".../events.jsonl"              -> 9
$ tail -c 1 ".../events.jsonl" | od -An -tx1 -> 0a          # 末行换行
```

Ajv 2020-12（`strict:true`, `allErrors:true`）编译通过，`validate` 对 9 行全部为 true；反例 3 个全部被拒、正例 1 个通过（V1c）。

### 5.2 V4b 区间表（0 违规）

| spanId | kind | 父 | 子区间 [start,end] ns | 父区间 ns | 判定 |
|---|---|---|---|---|---|
| …0001 | ui_event | null | [0, 52,000,000] | —（根） | 根 |
| …0002 | js_method | …0001 | [2,000,000, 48,000,000] | [0, 52,000,000] | 严格包含 |
| …0003 | js_method | …0002 | [3,000,000, 4,500,000] | [2,000,000, 48,000,000] | 严格包含 |
| …0004 | fetch | …0002 | [6,000,000, 38,000,000] | [2,000,000, 48,000,000] | 严格包含 |
| …0005 | controller | …0004 | [7,500,000, 35,500,000] | [6,000,000, 38,000,000] | 严格包含 |
| …0006 | service | …0005 | [8,000,000, 33,000,000] | [7,500,000, 35,500,000] | 严格包含 |
| …0007 | mapper | …0006 | [9,000,000, 31,000,000] | [8,000,000, 33,000,000] | 严格包含 |
| …0008 | sql | …0007 | [10,000,000, 30,000,000] | [9,000,000, 31,000,000] | 严格包含 |
| …0009 | callback | …0004 | [39,000,000, 48,000,000] | [6,000,000, 38,000,000] | 父外 1ms 启动（**唯一例外**），落根 [0,52,000,000] 内 |

violations=0；`strict=7 + callback=1 + root=1 = 9`，例外仅对 `kind=callback` 生效，未扩大豁免。

### 5.3 V2 构建（绑定命令原样执行）

```bash
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)
(cd "workbench" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
```

四条命令 exit 0；verbose 复核（同命令去掉 `-q`）：根 reactor `TraceBoard/Agent/Collector SUCCESS` + `BUILD SUCCESS`；demo `spring-boot:2.7.18:repackage` + `BUILD SUCCESS`。

### 5.4 V5 冒烟实际响应

```text
GET  http://localhost:8601/actuator/health
     -> 200 {"status":"UP"}
GET  http://localhost:8601/api/v1/meta
     -> 200 {"service":"traceboard-collector","version":"0.1.0-SNAPSHOT","apiVersion":"v1",
             "schema":{"id":"urn:traceboard:schema:event:v1","version":"traceboard.event.v1","dialect":"2020-12"},
             "capabilities":{"health":true,"meta":true,"ingestEvents":false,"realtime":false,"replay":false}}
POST http://localhost:8601/ingest/v1/events   (Content-Type: application/x-ndjson, body=fixture 9 行)
     -> 501 {"error":"not_implemented","message":"ingest is reserved for S1; S0 collector skeleton stores nothing (S0 placeholder, not implemented)","apiVersion":"v1"}
GET  http://localhost:8080/api/orders
     -> 200 {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100}]}
POST http://localhost:8080/api/orders/1/cancel
     -> 200 {"data":true}
POST http://localhost:8080/api/orders/999/cancel
     -> 404 {"data":false}
```

### 5.5 V6 产物与副本

| 项 | 值 |
|---|---|
| workbench dist 标记 | `app-shell` / `前端图` / `请求分图` / `Fixture 事实摘要` 均命中 |
| demo dist 标记 | `btn-cancel` / `操作成功` / `raw-json` 均命中 |
| 外部 URL 清单 | `http://www.w3.org/2000/svg`、`http://www.w3.org/1999/xlink`、`http://www.w3.org/1998/Math/MathML`、`https://vuejs.org/error-reference/#runtime-$`（均为惰性字符串，非资源请求） |
| MANIFEST | `Premain-Class: io.traceboard.agent.TraceAgent`、`Implementation-Title: TraceBoard Agent`、`Implementation-Version: 0.1.0-SNAPSHOT` |
| javap | `minor version: 0` / `major version: 52` |

## 6. 哈希（SHA256）

### 6.1 冻结基线（`plan-review.md`「冻结基线」 vs 实测，全部一致）

| 文件 | SHA256 |
|---|---|
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` |
| `fixtures/case-a-zero-rows/events.jsonl` | `2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9` |
| `fixtures/case-a-zero-rows/expected-facts.json` | `8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea` |
| `docs/contracts/event-model.v1.md` | `0820d57f3c2f51b193a0f809cb17b0c9805ff1c06ef3fa6f8e8496b582d9614a` |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` |
| `docs/contracts/transport.v1.md` | `2ca028e6225129fc913a922c20be17e161395f8584c17ab7d9a702afef2071e0` |
| `docs/contracts/api.v1.md` | `88bd185fa1682599282543ff5ca42f85d29752b988e794279ca28a9622baf95c` |

### 6.2 副本一致性（源 == workbench 副本 == dist 副本）

| 文件 | SHA256 |
|---|---|
| `fixtures/.../events.jsonl` = `workbench/public/fixtures/...` = `workbench/dist/fixtures/...` | `2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9` |
| `fixtures/.../expected-facts.json` = 两处副本 | `8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea` |

### 6.3 基线未收录但属冻结范围的附加文件（仅报告，供 acceptance 参考）

| 文件 | SHA256 |
|---|---|
| `fixtures/README.md` | `e92ded5545bbd5fecabc5b2042e42316ae0742f1fb8b46d9a064d958d95abd6e` |
| `fixtures/case-a-zero-rows/README.md` | `46a69503a37afae573750bd3413e9bc598211d5235b097695300f7f18478ab9d` |

## 7. 进程与端口清理证明

- 三轮冒烟均由 `verify.mjs` 在 `finally` 中 `taskkill /PID <pid> /T /F` 停止，并轮询 netstat；`V5c` 断言两端口无 LISTENING。
- 复跑后独立复核：

```text
$ netstat -ano | grep -E ":(8601|8080)\s" | grep LISTENING
（无输出 -> 端口无监听）
$ tasklist | grep -iE "^(java)\.exe"
（无 java 进程；现存 node.exe 均为 IDE 自身进程，创建时间 10:00:43–10:00:46，早于本报告测试窗口 10:35+）
```

- 冒烟期间使用的 pid 示例：collector 30852（JDK21）、demo 48368（JDK8）；均已退出。

## 8. 非阻断发现与移交项

| ID | 事项 | 证据/影响 | 建议处置 |
|---|---|---|---|
| F-1 | ingest 占位 `message` 文案与冻结契约示例不一致：实际为 `"ingest is reserved for S1; S0 collector skeleton stores nothing (S0 placeholder, not implemented)"`，而 `docs/contracts/api.v1.md` §3.3 与 `s0-plan.md` §5.3 写的是 `"ingest is reserved for S1; S0 collector skeleton stores nothing"`（多出后缀） | 状态码 501、`error`/`apiVersion` 字段、错误信封结构均合规，dispatch §5.3③ 与 tester 验收口径只要求 501，故**不判 FAIL**；属文案级漂移 | 由契约 owner 在 S1 契约变更时二选一对齐（改契约示例或去掉后缀）；acceptance 记录，不代改 |
| F-2 | `.gitattributes` 不存在且系统 `core.autocrlf=true`（LF 不变量在 git 层无保护） | 当前工作区 fixture `\r`=0、V1 PASS；但基线提交后重新 checkout 可能把 `*.jsonl` 变 CRLF 导致 V1 FAIL | acceptance 在 G2 按 `s0-plan.md` D15/Step 4 创建根 `.gitattributes`（至少 `*.jsonl/*.json/*.md/*.java text eol=lf`），并用 `git check-attr -a` 与 `\r` 计数复核后**重跑本工具** |
| F-3 | 根 reactor `package` 为增量执行：`mvn -B -DskipTests package` 输出 `Nothing to compile - all classes are up to date`，agent/collector jar mtime 未变（10:22/10:25），demo `repackage` 正常 | 绑定命令即分发书 §3 原命令（无 `clean`），reactor `BUILD SUCCESS`、exit 0；V3/V5 使用的是同一批产物且全部通过 | 如需“从零构建”附加证明，可另跑 `JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests clean package`（不属于绑定命令，本轮未执行） |
| F-4 | Git Bash PATH 中 `java` 不可用 | `java -version` → `command not found`；JDK8 冒烟使用绝对路径 `C:/Program Files/Java/jdk1.8.0_221/bin/java.exe` | acceptance 复跑冒烟时使用绝对路径（本报告 §9 已给出） |
| F-5 | 本机 `node -v` 实测 `v22.22.2`（与 `dispatch.md` §8 一致；与 IDE 环境自述的 v24 不同） | 仅记录，不影响判定 | 无需处置 |

## 9. 精确复现命令

```bash
# 0) 进入仓库根（路径含中文与空格，必须双引号）
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"

# 1) 一次性跑完 26 项（退出码 0 = PASS；任一项失败非零）
(cd "tools/verify" && npm ci && node verify.mjs)

# 2) 分项复现
# V1/V1b/V1c/V4b/V7/V8 已内置于上面的 verify.mjs；如需手工复核字节：
file "fixtures/case-a-zero-rows/events.jsonl"
tr -cd '\r' < "fixtures/case-a-zero-rows/events.jsonl" | wc -c   # 0
tail -c 1 "fixtures/case-a-zero-rows/events.jsonl" | od -An -tx1 # 0a

# V2 构建（分发书 §3 原命令 + demo 前端）
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)
(cd "workbench" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)

# V3 agent 字节码
"C:/Program Files/Java/jdk-21/bin/javap" -verbose \
  -classpath "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  io.traceboard.agent.TraceAgent | grep "major version"          # 52
unzip -p "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" META-INF/MANIFEST.MF | grep -i "Premain-Class"

# V5 冒烟（起停；停止后确认端口无监听）
"C:/Program Files/Java/jdk-21/bin/java.exe" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 60); do curl -sf "http://localhost:8601/actuator/health" >/dev/null && break; sleep 1; done
curl -s "http://localhost:8601/actuator/health"          # {"status":"UP"}
curl -s "http://localhost:8601/api/v1/meta"              # capabilities 三项 false；schema.id=urn:...
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson" --data-binary @"fixtures/case-a-zero-rows/events.jsonl"   # 501
# 结束：taskkill //PID <pid> //T //F，然后
netstat -ano | grep -E ":8601\s" | grep LISTENING || echo "8601 free"

(cd "demo/buggy-shop-boot-vue/backend" && "C:/Program Files/Java/jdk1.8.0_221/bin/java.exe" -jar "target/demo-shop-backend-0.1.0-SNAPSHOT.jar") &
for i in $(seq 1 60); do curl -sf "http://localhost:8080/api/orders" >/dev/null && break; sleep 1; done
curl -s "http://localhost:8080/api/orders"                # data[0].id=1, CREATED
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"    # {"data":true}
curl -s -X POST "http://localhost:8080/api/orders/999/cancel"  # 404 {"data":false}
# 结束：taskkill //PID <pid> //T //F，然后
netstat -ano | grep -E ":8080\s" | grep LISTENING || echo "8080 free"

# V6 副本哈希
sha256sum "fixtures/case-a-zero-rows/events.jsonl" \
  "workbench/public/fixtures/case-a-zero-rows/events.jsonl" \
  "workbench/dist/fixtures/case-a-zero-rows/events.jsonl"
sha256sum "fixtures/case-a-zero-rows/expected-facts.json" \
  "workbench/public/fixtures/case-a-zero-rows/expected-facts.json" \
  "workbench/dist/fixtures/case-a-zero-rows/expected-facts.json"

# V7 冻结哈希
sha256sum "schema/traceboard.event.v1.json" "fixtures/case-a-zero-rows/events.jsonl" \
  "fixtures/case-a-zero-rows/expected-facts.json" "docs/contracts/event-model.v1.md" \
  "docs/contracts/status-semantics.md" "docs/contracts/transport.v1.md" "docs/contracts/api.v1.md"
```

## 10. 写入声明与边界

- 本轮 tester **仅写入**：`tools/verify/package.json`、`tools/verify/package-lock.json`（`npm install` 生成）、`tools/verify/verify.mjs`、本文件；`tools/verify/node_modules/` 由根 `.gitignore` 的 `node_modules/` 覆盖，未提交。
- 未修改 `pom.xml`、`agent/**`、`server/**`、`demo/**`、`workbench/**`、`schema/**`、`fixtures/**`、`docs/contracts/**`、`dispatch.md`、`s0-plan.md`、`plan-review.md`（V8d：52 个产品文件运行前后 SHA256 全等；V7：冻结文件与基线一致）。
- 未执行任何 git 写操作（无 add/commit/tag/push）；`git status --porcelain` 全部为 `??`。
- 未放宽任何断言：所有 gate 按分发书 §5.5 / `s0-plan.md` §7 口径实现，反例必须被拒、callback 仍需通过根包含、不得只查 `startNs`。
- 未留常驻进程；所有冒烟进程已停止、端口已释放（§7）。

## 11. 最终判定

```text
S0 TEST: PASS
```

依据：`node verify.mjs` 连续三轮 26/26 PASS（exit 0）；四条构建命令可复跑；schema/fixture/副本哈希一致；agent major=52；collector health/meta/501 与 demo 200/200/404 冒烟通过；端口无残留。唯一非阻断发现 F-1（ingest 文案后缀）与移交项 F-2（`.gitattributes`）已在 §8 记录。

S0 TEST: PASS