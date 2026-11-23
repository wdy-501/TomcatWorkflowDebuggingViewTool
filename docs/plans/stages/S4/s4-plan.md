# S4 计划：本地接入（IDEA/JAR/预览/诊断）+ 节点详情/×N/缺口

> 阶段：S4（MVP）｜角色：plan-writer｜日期：2026-11-24｜版本：v2（2026-11-26，按 G1 `plan-review.md` + `S4-AMD-01` 返工）
> 权威输入：`docs/plans/stages/S4/dispatch.md`（binding）+ **`docs/plans/stages/S4/dispatch-amendment-01.md`（S4-AMD-01，binding；与 dispatch/本文件/guide 冲突时一律以其为准）**、`plan-review.md`（B1–B6/N1–N13）、主计划 §11/§12/§13.1/§13.3/§16 T11/§19、S0–S3 契约与 schema v1、S4 G1 冻结面。
> S4-AMD-01 文件日期栏“2026-11-26”为笔误，按 **2026-11-23 生效**口径处理，不影响内容效力。
> 本文件只描述计划与命令，**不含代码**；实现由 coder-launcher / coder-handshake / coder-sdk / coder-workbench 按 §3 归属完成，tester 按 §9 落门禁。

## 1. 目标与验收信号

| # | 交付 | 验收信号（缺一即 FAIL） |
|---|---|---|
| S4-1 | 本地启动器 `server/launcher` | `idea` 只打印可粘贴 VM options + 步骤；`jar` 以 JDK8 spawn + 健康/日志/PID/detach；`stop` 校验 PID 且幂等；失败给 token + 可执行建议 |
| S4-2 | 预览反代 + 注入 | `127.0.0.1:8602` 只对上游 `200 text/html`（charset 缺省或 utf-8）在最后一个 `</body>` 前注入两个**外部**脚本（**无内联脚本**）；注入时重算 `Content-Length` 并去掉压缩/校验头；`/ingest/v1/events` 反代 `<base>/ingest/v1/events`；`X-TraceBoard-Preview` 如实标注 |
| S4-3 | agent 握手 + collector 诊断 | premain 后守护线程 ≤3 次 `POST /ingest/v1/agent-hello`（1s 超时、退避、fail-open）；`GET .../agent` 返回连接事实；hello **不写事件、不建会话** |
| S4-4 | SDK IIFE | `npm ci && npm run build` 产出无 sourcemap 的 IIFE（global `TraceBoardSDK`，含 `version`）；有 `window.__TRACEBOARD_CONFIG__` 才自动 init，guard + fail-open；ESM demo 行为不变 |
| S4-5 | 工作台详情/×N/缺口 | 选中节点显示 graph 节点 14 字段（含 `reason/source/confidence`）的 detail；同 trace 按 `nodeKey` `×N` + 逐次选择；缺口按 span 去重恰 3 条（fixture）；**“未采集”绝不为 0** |
| S4-6 | 证据 | 一次命令门禁覆盖 S4-A..S4-I + S0–S3 回归（§4.10/§9 迁移显式列出），exit 0；G1 冻结面 SHA256 零漂移；无 S5/S6 越界 |

- 用户价值口径（主计划 §16 T11）：新手按 `docs/guides/local-launcher.md` 完成 4 类接入（IDEA、JAR、预览、诊断）一次成功。
- 诚实口径：诊断 PASS 只表示“本地链路形状正确”，不表示业务正确、不表示 SDK 在浏览器执行、不表示预览覆盖全站；这些写为“未验证”。
- **运行时 ×3 是 S6**：S4 只是对已采集 span 的前端聚合，`fixtures/s4-details` 是 UI/测试数据。

## 2. S5/S6 边界（越界即失败）

- 无 L1/L2：不采参数、实体字段、局部变量、`values[]`、字段 diff；不新增脱敏/截断语义（`REDACTED`/`TRUNCATED` 仅保留既有显示）。
- 无 sourcemap / 构建插件 / 源码片段 / 函数行号 / 方法名映射（S5）；详情缺失只写“未采集”，不承诺行号。
- 无运行时 ×3、异步续体传播、后台请求车道、`/links` 手工关联、时间窗 `INFERRED`（S6）。
- 无 SSE/WS/实时推送、无持久化/DB/缓存/CORS/鉴权、无 TLS/HTTPS 代理、无浏览器扩展/CDP、无内联脚本、无 CSP 改写。
- 无 Tomcat 部署/WAR/React/云（S7+）；不改 schema、事件类型/枚举、S0–S3 fixture 字节、demo 业务与案例 A 行为。

## 3. 文件地图与归属（零交集）

| 路径 | owner | 内容 |
|---|---|---|
| `docs/contracts/api.v1.md`（§2.4、§8.2、§10、变更记录） | plan-writer | S4 端点矩阵、graph 节点 S4 加性 14 字段、hello/agent 契约、冒烟命令；S0–S3 章节只读保留 |
| `docs/contracts/transport.v1.md`（§6.3 指针、§6.5/§6.6、§7、变更记录） | plan-writer | 通路 D 握手、预览代理响应改写；最小改动 |
| `docs/guides/local-launcher.md` | plan-writer | 前置、构建、四类接入、限制、诊断、排障、安全 |
| `fixtures/s4-details/**` | plan-writer | `events.ndjson`、`expected-facts.json`、`README.md` |
| `docs/plans/stages/S4/s4-plan.md` | plan-writer | 本文件 |
| `server/launcher/**`、根 `pom.xml`（仅 `<modules>`） | coder-launcher | `idea/jar/stop/preview/diagnose`，仅 JDK API |
| `agent/**`、`server/collector/**` | coder-handshake | hello 发送 + collector hello/agent 端点 + graph 加性字段 |
| `frontend/sdk/**` | coder-sdk | `build:iife`、IIFE 全局、自动 init、`version` 导出 |
| `workbench/**` | coder-workbench | `GraphNode` 14 字段类型、详情/×N/缺口组件与 dist 文案 |
| `tools/verify/**`、`S4/test-report.md` | tester | S4 门禁 + 报告 |
| `README.md`、`S4/{acceptance,progress}.md`、archive、git | acceptance | 唯一 git 写入者 |
| `schema/**`、`S0–S3` fixture/demo/契约其余章节 | 冻结 | 一律只读 |

## 4. 启动器设计（`server/launcher`）

### 4.1 模块与依赖

- Java 21，根部 reactor 新模块；**无 Spring、无第三方依赖**，只用 JDK `HttpServer`、`HttpClient`、`ProcessBuilder`、`ProcessHandle`、`Properties`。
- jar 带 `Main-Class: io.traceboard.launcher.Launcher`；所有子命令支持 `--help`；参数解析手写（无 CLI 库）。
- 出口统一：所有诊断输出走 stdout（ASCII token + 中文建议），日志/错误走 stderr；**不写仓库其他路径**（仅 `work/**`）。

```bash
export JAVA21="C:/Program Files/Java/jdk-21"
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/launcher" -am
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" --help
```

- **launcher/collector 只用 JDK21 运行**（`"$JAVA21/bin/java"` 或 `"$JAVA_HOME/bin/java"`，`JAVA_HOME` 必须指向 JDK21）；**禁止裸 `java -jar`**（PATH 上的 `java` 可能是 JDK8，会在任何 token 前 `UnsupportedClassVersionError`）。demo/agent 仍用 JDK8（§4.4）。

### 4.2 CLI（精确）与退出码

```text
idea     --jar <demo.jar> --agent <agent.jar> [--collector <base>] --session <id> [--port 8080]
jar      --jar <demo.jar> --agent <agent.jar> [--collector <base>] --session <id> [--java <java.exe>] [--port 8080] [--health <url>] [--detach] [--pid-file <path>] [--log-dir <path>]
stop     --pid-file <path>
preview  --target <url> [--port 8602] [--collector <base>] --session <id> [--sdk <path>] [--allow-non-loopback]
diagnose [--collector <base>] [--app-url <url>] --session <id> [--preview-url <url>]
```

- **`--collector <base>` 是 collector origin，不是完整 ingest URL**：只接受 `http://<loopback-host>:<port>`（末尾 `/` 归一化），缺省 `http://127.0.0.1:8601`；带路径/查询/`https`/非回环主机 → exit 2（`COLLECTOR_URL_INVALID` 或 `NON_LOOPBACK_TARGET`）。旧 `--ingest`/`--ingest-url` **移除**，传入即 exit 2 并提示改用 `--collector`。
- 派生 URL（唯一算法，禁止再加前缀）：ingest = `<base>/ingest/v1/events`；preview 转发 `/ingest/v1/events` → `<base>/ingest/v1/events`；diagnose 只读 = `<base>/actuator/health`、`<base>/api/v1/meta`、`<base>/api/v1/sessions/<id>/agent`、`<base>/api/v1/sessions/<id>/events?afterSeq=0&limit=1`。**health/meta/agent/events 一律不带 `/ingest` 前缀**（`GET <base>/ingest/actuator/health` 之类必然 404，禁止写入文档/代码）。
- `--session` **除 `stop` 外所有子命令必填**（含 `preview`，删除旧缺省 `s_s4demo`）；必须匹配 `^s_[A-Za-z0-9_-]+$`。
- `--app-url`：真实可 2xx 的应用端点；缺省 `http://localhost:8080/api/orders`。demo 只有 `/api/orders`（GET 200）与 `/api/orders/{id}/cancel`；`/` 与 `/actuator/health` 都是 404，**不得**再用作 health/app 判定。`jar --health` 若提供也必须是真实 2xx（demo 用 `/api/orders`），省略则按 TCP 存活。
- 回环边界：`--app-url`/`--preview-url`/`--health` 默认只接受回环主机，非回环 → exit 2 + `NON_LOOPBACK_TARGET`；唯一例外是 `preview --target` 显式 `--allow-non-loopback`（先打印 `WARN non-loopback target=<host>` 再继续，仍无 TLS/外部网络）。
- `--java`：demo/agent 运行必须 JDK8；guide 必须显式 `--java "C:/Program Files/Java/jdk1.8.0_221/bin/java"`（缺省可能落到 PATH 的 JDK8，不保证）。
- 退出码（全局）：`0` 成功/无 FAIL；`1` launcher 自身未预期错误（`LAUNCHER_ERROR`，不得映射检查结论）；`2` 用法/参数非法；`3` 预期失败（spawn/健康超时/stop 拒绝/diagnose 任一 FAIL）。
- token（ASCII + 中文可执行建议）：`JAVA_NOT_FOUND`、`AGENT_NOT_FOUND`、`JAR_NOT_FOUND`、`PORT_IN_USE`、`APP_EXITED`、`HEALTH_TIMEOUT`、`NOT_RUNNING`、`PID_MISMATCH`、`SDK_IIFE_MISSING`、`TARGET_TLS_UNSUPPORTED`、`INGEST_UNREACHABLE`、`COLLECTOR_URL_INVALID`（exit 2）、`NON_LOOPBACK_TARGET`（exit 2）、`LAUNCHER_ERROR`（exit 1）。
- 端口固定：collector 8601、demo 8080、工作台 5173、demo 前端 5174、预览 8602；测试静态 HTML stub 18080（仅测试）。冲突先诊断并报告占用，**不静默改端口**。

### 4.3 `idea`（不 spawn、不写文件）

- 校验 jar/agent 存在、collector origin/session 合法，打印一行：

  ```text
  -javaagent:"<agentAbs>" -Dtraceboard.ingestUrl="<base>/ingest/v1/events" -Dtraceboard.sessionId=<id>
  ```

- 再打印 checklist：①先起 collector 并 `curl "<base>/actuator/health"`；②IDEA Run/Debug → **VM options**（不是 Program arguments）；③启动后查 `GET <base>/api/v1/sessions/<id>/agent`；④按打印的 `preview --target http://127.0.0.1:18080 --collector <base> --session <id>` 开预览（**目标必须是 HTML 页面**；demo 后端 8080 无 HTML、Vite 5174 已内置 SDK，均不得作 preview 目标）；⑤工作台 5173 点 `#btn-cancel`/`#btn-save-b`。
- 断言：exit 0、输出含绝对路径 + 引号 + `<base>/ingest/v1/events` + session、不产生新 `java` 子进程；缺参 exit 2、坏路径 exit 3 + `JAR_NOT_FOUND`/`AGENT_NOT_FOUND`。

### 4.4 `jar` / `stop`

- spawn argv（`ProcessBuilder`，不经 shell）：

  ```text
  <java> -javaagent:<agentAbs> -Dtraceboard.ingestUrl=<base>/ingest/v1/events -Dtraceboard.sessionId=<id> [-Dserver.port=<port>] -jar <jarAbs>
  ```

  `-Dserver.port` 仅在显式 `--port` 时追加；`-javaagent`/`-D` 必须在 `-jar` 前。
- `--java` 缺省 `$JAVA_HOME/bin/java(.exe)` → PATH `java`；**demo/agent 必须 JDK8**（agent major 52），guide 要求显式 `--java "C:/Program Files/Java/jdk1.8.0_221/bin/java"`；launcher 自身用 JDK21 运行。
- 日志：子进程直接写文件（`ProcessBuilder.Redirect.appendTo(out.log/err.log)`，避免 `--detach` 后父进程退出导致管道写满/丢失）；`work/logs/<session>-<timestamp>.out.log|.err.log`。**attached 模式**由 launcher tail 回显；`--detach` 就绪后关闭 tail、不关闭子进程句柄，打印 `PID=`/`PID_FILE=`/`LOG_DIR=` 并 exit 0。
- PID JSON `{"pid":N,"startedAtMs":E,"java":"...","jar":"..."}`（缺省 `work/<session>.pid`）。
- 就绪：`--health` 给定时 GET 期待 2xx（demo 用 `http://127.0.0.1:8080/api/orders`；**不要**用 `/` 或 `/actuator/health`），否则 TCP 连端口；超时 30s；就绪前退出 → `APP_EXITED` + 日志尾 20 行；超时 → `HEALTH_TIMEOUT` + 日志尾；显式端口占用 → spawn 前 `PORT_IN_USE`。
- 非 `--detach` 跟随进程并以其实退出码退出。
- `stop`：读 PID JSON；进程不存在 → `NOT_RUNNING` exit 0；`commandLine` **为空**、或规范化绝对路径后既不含记录的 jar 也不含 jar 文件名、或 `startedAtMs` 与 `ProcessHandle.info().startInstant()` 偏差 > 5s → `PID_MISMATCH` exit 3 **拒绝杀**；否则 `destroy()` → 5s → `destroyForcibly()`，成功删 PID 文件并打印 `STOPPED pid=N`。

### 4.5 `preview`（反代 + 注入）

- 目标是**静态 HTML origin**（S4 示例 `http://127.0.0.1:18080` 的 Node stub 或用户自己的静态页）；**不得**指向 demo 后端 8080（无 HTML 页，`/` 404），**不得**指向 Vite demo 5174（已通过 `vite.config.ts` 别名内置 SDK，会二次加载/二次上报）。
- 仅绑 `127.0.0.1:<port>`（缺省 8602），无 TLS；`--target` 必须 `http://`，否则 `TARGET_TLS_UNSUPPORTED` exit 3；默认只接受回环主机，非回环 → exit 2 + `NON_LOOPBACK_TARGET`，除非 `--allow-non-loopback`（打印 WARN 后继续）。
- 路由：
  - `/traceboard/config.js`：本地生成，逐字 `window.__TRACEBOARD_CONFIG__ = {"sessionId":"<id>","ingestUrl":"/ingest","appName":"traceboard-preview","observeMs":1500};`
  - `/traceboard/sdk.js`：IIFE 字节。解析优先级：`--sdk <path>` → 系统属性 `traceboard.sdk.iife` → 环境变量 `TRACEBOARD_SDK_IIFE` → **仓库根 CWD** `frontend/sdk/dist/traceboard-sdk.iife.js`。**禁止“launcher jar 上两级”启发式**；guide 要求从仓库根运行。全缺 → `SDK_IIFE_MISSING` exit 3 + 构建命令 `(cd "frontend/sdk" && npm ci && npm run build)`。
  - `/ingest/v1/events`：反代到 `<base>/ingest/v1/events`（方法/体/`Content-Type` 原样；collector 不可达 → `502` + 说明，**不伪造 202**）。其他 `/ingest/*` → 404，不做开放写代理。
- 转发到 `--target` 的请求**移除 `Accept-Encoding`**（不添加 `identity`），不主动协商压缩。
- 仅当上游 `200` + `Content-Type: text/html`（参数允许）+ charset 缺失或 `utf-8` 才注入；在**最后一个**大小写不敏感 `</body>` 前插入且仅插入 `<script src="/traceboard/config.js"></script><script src="/traceboard/sdk.js"></script>`；外部脚本、无内联、不改写 CSP、不改写业务 HTML/JS。
- 注入成功：保留状态码与端到端头；按改写后的 **UTF-8 字节重算 `Content-Length`**；移除 `Content-Encoding`、`Transfer-Encoding`、`ETag`、`Last-Modified`（以及若有 `Content-MD5`）；不转发 hop-by-hop 头（`Connection`/`Keep-Alive`/`TE`/`Trailer`/`Upgrade`/`Proxy-*`）；设置 `X-TraceBoard-Preview: injected`。
- 未注入：状态/头/体**逐字节透传**，保留上游 `Content-Length`/`Content-Encoding`；不得先解码再声称透传。
- `not-injected` 码与判定优先级（先命中先返回）：① `HEAD` → `head`；② `204/304` → `no_body`；③ 非 `200`（含 `3xx/4xx/5xx` 错误页）→ `status`；④ `Content-Encoding` 存在且非 identity → `encoding`；⑤ 非 `text/html` → `not_html`；⑥ charset 非 utf-8 → `encoding`；⑦ `Content-Length`/实际体 > 2MB → `too_large`；⑧ 无 `</body>` 或 `Content-Length: 0` → `no_body`；⑨ 读取失败 → `read_error`。`X-TraceBoard-Preview` 只出现在经 target 反代的响应上；`/traceboard/*` 与 `/ingest/v1/events` 不添加该头。
- 不改写 CSP / HTML / JS / 绝对 URL / `Location`；CSP nonce/hash-only 页面只报告“标签已注入、执行未验证（无 CDP）”。

### 4.6 `diagnose`（七项，只读；S4-AMD-01 §3 唯一权威）

检查顺序与集合固定：`collector_health`、`collector_meta`、`app_health`、`agent_handshake`、`recent_events`、`preview_injection`、`sdk_script`。

| check | 请求 | 判定 |
|---|---|---|
| `collector_health` | `GET <base>/actuator/health` | `200` 且 body `status="UP"` → **PASS**；连接失败 → **FAIL** + `INGEST_UNREACHABLE`；其他 → **FAIL** |
| `collector_meta` | `GET <base>/api/v1/meta` | `200` 且 `capabilities` **恰 5 键**、`realtime=false` → **PASS**；否则 **FAIL**（打印键集合） |
| `app_health` | `GET --app-url`（缺省 `http://localhost:8080/api/orders`） | `2xx` → **PASS**；否则 **FAIL**（打印状态与 Content-Type；不得把 `/` 的 404 当作应用未起） |
| `agent_handshake` | `GET <base>/api/v1/sessions/<id>/agent` | `200` 且 `connected:true` 且 sessionId 匹配 → **PASS**（打印 version/pid/startedAtMs/lastSeenMs）；`404`/其他 → **FAIL**（未握手或 collector 重启，不得显示成功） |
| `recent_events` | `GET <base>/api/v1/sessions/<id>/events?afterSeq=0&limit=1` | `200` 且 `events.length>0` → **PASS**（打印首条 seq/nextSeq）；`200` 且 0 条 → **WARN**；可达的 `404` → **WARN**（尚无事件）；连接失败/其他 → **FAIL** |
| `preview_injection` | 无 URL → **SKIP**；有 URL → `GET --preview-url` | 仅当 `200` + 头 `X-TraceBoard-Preview: injected` + `/traceboard/config.js` 与 `/traceboard/sdk.js` 两个 script 都在最后一个 `</body>` 之前 → **PASS**；`not-injected:*` → **FAIL**（打印 status/头/摘要）；非 2xx（含上游 4xx/5xx HTML 的 `not-injected:status`）→ **FAIL** |
| `sdk_script` | 无 URL → **SKIP**；有 URL → `GET <preview-origin>/traceboard/sdk.js`（origin = `--preview-url` 的 `scheme://host:port`） | `200` 且 body 含 `TraceBoardSDK` → **PASS**；缺失/不匹配/不可达 → **FAIL** + 构建命令 |

- `preview_injection` 与 `sdk_script` **只在给了 `--preview-url` 时执行**；未给时两者均为 `SKIP <check>: reason=no_preview_url`，**绝不 FAIL**，也绝不伪造 PASS。
- 每行格式：`PASS|FAIL|WARN|SKIP <check>: <evidence>`；evidence 必须含请求 URL、HTTP 状态与至少一项关键证据（响应头、`version/pid/startedAtMs/lastSeenMs`、事件条数/`nextSeq`、脚本标签是否存在、非注入时 ≤200 字节 body 摘要）；**禁止无证据的 PASS**，禁止打印 secret/完整页面。
- 末行**精确格式**：`SUMMARY: <PASS|FAIL> pass=<n> warn=<n> fail=<n> skip=<n>`，四个计数之和恒为 7。`SUMMARY: PASS` **当且仅当 `fail=0`**；存在 `WARN`/`SKIP` 仍可 PASS/exit 0。
- 退出码：`fail=0` → `0`；`fail>0` → `3`；用法错误 → `2`；launcher 内部未预期错误 → `1`。`WARN`/`SKIP` 不改变退出码。
- 任一检查不得因另一项失败而伪造；collector 不可达时仍继续执行 app/preview 检查并如实记录。未验证项（SDK 浏览器执行、CSP 拦截、全站覆盖、握手代表业务健康）继续输出“未验证”，不得写成 PASS。

### 4.7 预览自测（静态 HTML，不依赖 demo）

```bash
# 18080：最小 HTML stub（另开终端；测试用，finally 释放）
node -e "require('http').createServer((q,s)=>{if(q.url==='/plain'){s.writeHead(200,{'Content-Type':'text/plain'});s.end('plain-body')}else{s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end('<!doctype html><html><body><h1>stub</h1></body></html>')}}).listen(18080,'127.0.0.1')"

"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" preview \
  --target "http://127.0.0.1:18080" --collector "http://127.0.0.1:8601" --session "s_s4demo"

curl -si "http://127.0.0.1:8602/" | head -n 8          # injected + 两个 script + 重算后的 Content-Length
curl -si "http://127.0.0.1:8602/plain" | head -n 8     # not-injected:not_html，体逐字 plain-body
curl -s  "http://127.0.0.1:8602/traceboard/config.js"  # 含 s_s4demo
```

无 `</body>` 用例：stub 增加 `/?nobody=1` 返回 `<div>fragment</div>`（`text/html`）→ 期望 `not-injected:no_body`；`HEAD /` → `not-injected:head` 且无 body；`204/304` → `not-injected:no_body`；gzip 上游 → `not-injected:encoding` 且 body 字节不变；上游 404 HTML → `not-injected:status`；超 2MB 用例 → `too_large`（tester 侧构造，勿写仓库）。

## 5. 握手设计（控制通路，不是事件）

- agent premain 配置完成后，**守护线程**异步发送，绝不阻塞应用启动/请求。
- URL 派生：`-Dtraceboard.ingestUrl` 为 `<base>/ingest/v1/events`；以 `/v1/events` 结尾时替换为 `/v1/agent-hello`（即 `<base>/ingest/v1/agent-hello`）；否则 stderr `hello_skipped reason=ingest_url`。
- body（JDK8 `HttpURLConnection`，`Content-Type: application/json; charset=utf-8`）：

  ```json
  {"schema":"traceboard.agent.v1","sessionId":"s_s4demo","version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000}
  ```

  PID 取 `RuntimeMXBean.getName()` 的 `@` 前缀（失败 `reason=pid`，跳过发送）；version 取 manifest `Implementation-Version`，回退 `0.1.0-SNAPSHOT`。
- 重试：connect/read 各 1s，≤3 次，退避 200/400ms；只打印计数 `hello_sent=1` / `hello_failed=3`，不打印 body/响应；**不得调用异常 `getMessage()`**（S2-8 禁用项），错误只用固定字符串/计数。
- collector `POST /ingest/v1/agent-hello`：判定顺序 **405（非 POST）→ 415（非 JSON）→ 413（body >4096B）→ 400（schema/session/version/pid/startedAtMs 非法，标准错误信封，不回显 body）→ 200**（以 `api.v1.md` §10.2 为准）；200 `{"schema":"traceboard.agent.v1","sessionId":"<id>","accepted":true}`；未知字段忽略。
- 存储：`ConcurrentHashMap<sessionId, hello>`，**last-wins**、无 TTL、无持久化、不创建事件会话；重启 collector 即丢失（设计行为，guide 明示）。
- `GET /api/v1/sessions/{id}/agent`：有记录 200 `{sessionId,connected:true,version,pid,startedAtMs,lastSeenMs}`；否则 404 错误信封；session 形状非法按 404；非 GET 405；无鉴权（仅回环）。
- 不变式：hello 不进入 EventStore、不消耗 `seq`、不出现在 `/api/v1/sessions`、不改 meta（仍 5 键）；业务路由 9 条；`stream/ws/links` 仍 404。

## 6. SDK IIFE 设计（`frontend/sdk`）

- 新增 devDependency `esbuild`（官方 npm，锁文件）；脚本：

  ```text
  build:iife = esbuild src/index.ts --bundle --format=iife --global-name=TraceBoardSDK --target=es2020 --outfile=dist/traceboard-sdk.iife.js --legal-comments=none --sourcemap=false
  build      = tsc（ESM + d.ts）+ build:iife
  ```

- 源码新增 `export const version = "0.1.0"`（当前 `frontend/sdk/src/index.ts` 尚无该导出）；全局 `TraceBoardSDK = { initTraceBoard, wrapFn, uiEffect, elementIdentity, version: "0.1.0" }`。
- 自动 init：IIFE 加载后若 `window.__TRACEBOARD_CONFIG__` 是对象 → 校验 `sessionId`（`s_...`）、`ingestUrl`（默认 `/ingest`）、`appName`（默认 `traceboard-preview`）、`observeMs`（有限数 1..60000，默认 1500）→ 调**一次** `initTraceBoard`；guard `window.__TRACEBOARD_AUTO_INIT__`；任何异常吞掉（fail-open）。
- 无 config 不自动 init；显式 ESM `initTraceBoard` 仍幂等（复用 `activeRuntime`，不重复监听）；demo 前端不改，行为与 S3 一致；无 `.map`、无 CDN、无遥测。

## 7. 工作台详情 / ×N / 缺口（`workbench`）

- 保留 `#s3-panel/#s3-tree/#s3-timeline/#s3-replay-toggle/#s3-readonly/#s3-caseb` 与 `#s2-panel/#s1-panel/#fixture-panel`；新增稳定选择器：`#s4-detail`、`#s4-detail-title`、`#s4-detail-status`、`#s4-detail-tabs`、`#s4-sideeffects`、`#s4-ui-effects`、`#s4-invocations`、`#s4-invocation-select`、`#s4-gaps`、`#s4-group-badge`、`#s4-detail-close`。
- **数据源（B4）**：结构/`status`/`return`/`sideEffects`/`thread`/`flags`/`startNs`/`durNs`/`reason`/`source`/`confidence` **全部来自 `GET .../graph`**（S4 加性 14 字段，见 api §8.2/§10.8；coder-workbench 把 `workbench/src/api.ts` 的 `GraphNode` 类型与其“11 fields”注释扩为 14 字段并映射新字段）。**不再**为 `reason/source/confidence` 按 `afterSeq/limit` 翻页 join 事件；graph 404/空态 → 详情显示空态，不崩。
- 详情字段：`kind · nodeKey · 第 i/N 次`；status + reason（`NOT_COLLECTED_*` 原样 reason，缺失 `未采集（无 reason）`）；return；sideEffects（表 `sqlId/rowsAffected/transaction`；缺失/空 → `未采集`，**绝不为 0**；`rowsAffected:0` 原样 `0`）；UI 效果（`ui_effect`；另列本 trace 的 `render` 并标注“按 trace 列出，未推断与所选节点因果”）；flags 原样 chip（含未知）；thread `id/name` 或 `未采集`；source 仅当 `file` 与 `line` 都完整时显示 `file:line`，否则 `未采集`（S5 前不做映射）；start/dur 显示 `relNs`（原始 ns 副行）；confidence（`LOST` 如实标签）。
- 票签：`SQL/数据影响`、`UI 效果` 两个 tab（`#s4-detail-tabs`）。**SQL/数据影响票签 = 所选 span 自身 `sideEffects`**；service/mapper 自身没有 `sideEffects` 时显示 `未采集`，绝不显示 0。
- ×N：选中 trace 内按 `nodeKey` 分组（`kind` 仅展示），N≥2 显示 `×N`；`#s4-group-badge` 是**容器**，每组一个带 `data-node-key` 的子元素（避免重复 id），fixture 的两个 `×3` 各自一个徽标。`#s4-invocations` 逐次列表 + `#s4-invocation-select`（`startNs` 升序、同值 `spanId` 字典序）；切换只改详情，**不改 graph/API/边**。
- **逐次 `rows`（B5）**：只从该次调用的 **sql 子节点** `sideEffects` 直接读取——自身是 sql → 自身 `rowsAffected`；否则读取该次调用子树内的 sql span，列出 `sqlSpanIds` 并标注“子 sql”；无 sql 子节点 → `未采集`。fixture：service 第 1/2 次 `rows=[0]`（`sqlSpanIds` 分别为 `c3d4…`/`f601…`），第 3 次 `未采集`（mapper3 无 sql 子节点）；sql 两次自身 `rows=0` 显示 `0`；mapper3 `未采集`。任何缺失来源一律 `未采集`，绝不为 0；0 只表示已采集的 `rowsAffected=0`。
- 缺口 `#s4-gaps`（只读派生，S4-AMD-01 §7.2）：按 span 依次判定，优先级 **F > N > R**，每个 span **最多一条**：
  - F `FETCH_WITHOUT_BACKEND`：`kind="fetch"` 且其 `spanId` 未被任何后端节点（`kind ∉ {ui_event,js_method,fetch,render}`）的 `parentSpanId` 引用 → `后端未采集/未关联`（逐字）。
  - N `NOT_COLLECTED_REASON`：`status ∈ NOT_COLLECTED_*` → `未采集 · <reason>`；reason 缺失 → `未采集（无 reason）`。
  - R `ROWS_NOT_COLLECTED`：`kind ∈ {mapper,sql}` 且**自身** `sideEffects` 缺失/空，且 status **不是** `NOT_COLLECTED_*` → `未采集`。
  - 去重：缺口内部 `reason` 键为 R=`ROWS_NOT_COLLECTED`、N=事件 reason（缺失=`NO_REASON`）、F=`FETCH_WITHOUT_BACKEND`；同一 span 内以 `nodeKey+reason` 为键、按 N > R 只取一条；**不同 span（×N 的逐次调用）不跨 span 合并**。缺口按 span 顺序（`startNs` 升序、同值 `spanId`）输出。
  - fixture 结果恰 3 条：mapper1/mapper2 `ROWS_NOT_COLLECTED`（`未采集`）、mapper3 `NOT_COLLECTED_REASON`（`未采集 · policy:third_party_package`）；service ×3 与 sql ×2（自身有 `sideEffects`，含 0）不产生缺口。fixture 是 `LOST` 游离后端根，没有“未关联 fetch”（D3）；规则 F 由 S4-F 内联前端批次断言，不得用本 fixture 冒充。
  - 空列表逐字：`未发现缺口（仅基于已采集数据；未采集项不会显示为成功）`。
- `#s4-invocations` 或 `#s4-gaps` 下方必须有静态说明：`×N 为已采集 span 的前端聚合；运行时 ×3 属 S6`。
- 不崩：collector 不可达/404/空态显示空态；无图库/画布/SSE/WS/sourcemap/values/局部变量/行号。

## 8. 契约与 fixture

- `api.v1.md`：§2.4 S4 矩阵（10 端点含 `/actuator/health`；业务路由 9；`stream/ws/links` RESERVED）；**§8.2 graph 节点改为“S2–S3 11 字段 / S4 起固定 14 字段（加性 `reason/source/confidence`）”**；§10 新增 S4 加性注记（§10.8）；§10 hello/agent 形状、判定顺序、last-wins、不写事件、meta 5 键、冒烟命令；S0–S3 其余章节原样保留。
- `transport.v1.md`：通路 D（JSON 不是 NDJSON）、预览代理（仅本机、不改 collector、无 CORS 改动）、**§6.6 响应体改写/头规则/`not-injected` 新码**、§6.3 仅加 14 字段指针、§7 安全条目、版本指针。
- `fixtures/s4-details/`：`events.ndjson` **9 行字节不变**（游离后端根 `controller` LOST + 3 次同 `nodeKey` service + 3 mapper + 2 sql；mapper3 `NOT_COLLECTED_POLICY` + reason；SQL rows 0；无 `THREW`；区间嵌套）→ 通过 Ajv 2020-12 strict；`expected-facts.json` 覆盖 ×3 分组、逐次 return/rows、缺口 **3** 项、`requests`/`graph`（14 字段与 mapper3 的 reason/source/confidence）/`replay` 期望、工作台选择器/文案、徽标容器；`README.md` 逐字声明“运行时 ×3 是 S6；本目录是 UI/测试数据”，并写明缺口去重/优先级与 rows 来源。
- 时间值 `startNs` 基 `5_000_000_000`（fixture 作用域示意，<2^53 便于 JS 精确比较）；断言只依赖相对顺序/嵌套/时长与 `expected-facts.json` 取值。
- 不改 `schema/**`、`event-model.v1.md`、`status-semantics.md`、S0–S3 fixture、demo。

## 9. 测试计划（tester；一次命令、串行起停、`finally` 清理）

| 组 | 断言（对应 dispatch §5.7 + S4-AMD-01 §8） |
|---|---|
| **S4-A** 启动器 `idea` | JDK21 构建出可执行 jar；`idea` 输出含绝对路径+引号+`<base>/ingest/v1/events`+session 与 5 步 checklist、exit 0、无新 java 子进程；缺参 exit 2；坏 jar/agent exit 3 + `JAR_NOT_FOUND`/`AGENT_NOT_FOUND`；`--ingest`/`--ingest-url` → exit 2 |
| **S4-B** 启动器 `jar`/`stop` | `"$JAVA21/bin/java"` 跑 launcher，JDK8 `--java` spawn demo+agent；`--collector`；`--health .../api/orders`（或省略）；端口就绪、PID/日志存在、hello 进入 collector；`stop` 后端口释放；重复 `stop` → `NOT_RUNNING` exit 0；坏 java/坏 jar/端口占用给对应 token；detach 日志由子进程直写、launcher 退出后不丢；无残留进程/端口 |
| **S4-C** 握手与端点 | hello 合法 200 形状；400（schema/session/version/pid/startedAt）、413（>4096B）、415、405（判定顺序 405→415→413→400）；last-wins；`GET agent` 200 字段/404/405；事件数/`seq`/`sessions` 不受 hello 影响；meta 5 键；`stream/ws/links` 404 |
| **S4-D** 预览反代与注入 | 静态 HTML stub（18080）+ collector：HTML `injected`、两 script 位于最后 `</body>` 前、无内联；`Content-Length == Buffer.byteLength(改写后 UTF-8 body)` 且无 `Content-Encoding`/`Transfer-Encoding`/`ETag`/`Last-Modified`；`sdk.js` 200 含 `TraceBoardSDK`；`config.js` 含 session；`/plain` 非 HTML 逐字透传 + `not-injected:not_html`；无 `</body>` → `no_body`；HEAD → `head` 无 body；204/304 → `no_body`；gzip 上游 → `encoding` 且 body 字节不变；上游 404 HTML → `not-injected:status` 且不得判 PASS；超 2MB → `too_large`；`/ingest/v1/events` 反代 202、其他 `/ingest/*` 404；collector 停 → 502；https 目标 `TARGET_TLS_UNSUPPORTED`；非回环 target → exit 2 `NON_LOOPBACK_TARGET`（`--allow-non-loopback` 时 WARN 继续）；SDK 缺失 `SDK_IIFE_MISSING` |
| **S4-E** SDK IIFE | 构建产物存在（dist 3 文件）、无 `sourceMappingURL`；global 含 `version`；vm 中自动 init 恰一次、二次加载不重复（guard）；坏 config fail-open；既有 ESM 单测仍 8/8 绿；demo 前端构建不变 |
| **S4-F** 详情/×3/缺口 | `fixtures/s4-details` 过 schema；ingest 后 `requests` 1 行（LOST/NOT_COLLECTED_POLICY/9 span）、`graph` 9 节点/8 边且每节点恰 14 键；mapper3 详情 `reason="policy:third_party_package"`、`source="OrderMapper.java:15"`、`confidence="LOST"`；`source` 缺 `file`/`line` 时显示 `未采集`（内联构造/单测，不改 fixture 字节）；`#s4-detail-status` 不出现通用提示冒充 reason；缺口恰 3 条且顺序固定；service 第 3 次 rows 文案 `未采集`、sql 自身 rows `0` 显示 `0`；`#s4-group-badge` 为容器且两个 `data-node-key` 子元素；**缺口 F** 由内联前端批次（`ui_event` + 未关联 `fetch`）断言；静态说明含“运行时 ×3 属 S6” |
| **S4-G** 诊断（两分支） | **无 `--preview-url`**：`preview_injection`/`sdk_script` 均 `SKIP ... reason=no_preview_url`、`skip=2`、`fail=0`、`SUMMARY: PASS`、exit 0。**有 preview（collector+demo+18080 stub+preview）**：七项全执行、`skip=0`、`fail=0`、`SUMMARY: PASS`、exit 0（0 事件允许 `recent_events WARN`）。另测：collector 停 → `fail>0`、exit 3、原因可执行；`agent` 404 → FAIL 不显示成功；上游 404 → `preview_injection` FAIL/exit 3；输出无伪造 PASS |
| **S4-H** S0–S3 回归 | 按 §4.10/本节精确迁移（见下方清单）；`S2-3` 4-span LOST、`S3-3` EXACT E2E、`S3-4/5` 回放 0 写、`S1-C0` meta 5 键不变；schema/S0–S3 fixture 字节不变 |
| **S4-I** 范围/安全/清理 | 无 S5/S6/S7 能力（sourcemap/构建插件/values/links/SSE/WS/持久化/图库/TLS/CSP 改写/内联脚本）；0 secret/0 CDN/0 遥测/0 镜像；G1 哈希零漂移；8601/8080/5173/5174/4173/4174/8602/18080 无监听、无 java/node 残留、git index 未动 |

**S4-H 精确迁移清单（N6）**

- `S3-1`：SDK `node --test` 仍 **8/8**；`dist` 由 2 个文件变为 **3**（`index.js`、`index.d.ts`、`traceboard-sdk.iife.js`）；devDeps 由 `typescript` 变为 `typescript + esbuild`；仍禁止 runtime deps、`.map`、CDN。
- `S2-8`：collector 业务路由 **7 → 9**（加 `POST /ingest/v1/agent-hello`、`GET /api/v1/sessions/{sessionId}/agent`）；agent `.type=`/`.transform=` 仍恰 **4/4**（hello 是手写 `HttpURLConnection`，不得新增 ASM 插桩）；`getMessage()` 仍禁。
- `S3-8`：从 forbidden 标记中去掉 `launcher|intellij|idea-plugin|VirtualMachine.attach|tools.jar`（S4 允许），保留/新增 S5/S6 禁项（sourcemap、构建插件、L1/L2、values、links、SSE/WS、localStorage、图库）；不要把 `server/launcher/src` 纳入该扫描。
- `S3-10`：白名单加 `server/launcher/**`、`docs/guides/**`、`fixtures/s4-details/**`、`docs/plans/stages/S4/**`、根 `pom.xml`。
- `S1_PORTS`：加 **8602**、**18080**（S4-I 清理断言包含它们）。
- `GRAPH_NODE_KEYS`：从 11 键迁移为 **14 键**（仅加性 `reason/source/confidence`）；节点值/边/顺序/节点数断言不变。
- `S2-3`、`S3-3`、`S3-4`、`S3-5`、`S1-C0` 语义不变。

## 10. 精确命令（从仓库根、全双引号）

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
export JAVA21="C:/Program Files/Java/jdk-21"
export JAVA8="C:/Program Files/Java/jdk1.8.0_221"

# 构建（详见 guide §2）
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/collector" -am
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "agent" -am
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/launcher" -am
JAVA_HOME="$JAVA8"  mvn -B -q -DskipTests package -f "demo/buggy-shop-boot-vue/backend/pom.xml"
(cd "frontend/sdk" && npm ci && npm run build)
(cd "workbench" && npm ci && npm run build)

# collector（JDK21）
"$JAVA21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &

# idea（只打印）
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" idea \
  --jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" \
  --agent "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  --collector "http://127.0.0.1:8601" --session "s_s4demo"

# jar（JDK8 + 握手 + 健康 + detach；--health 用真实端点 /api/orders，或省略按 TCP）
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" jar \
  --jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" \
  --agent "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  --collector "http://127.0.0.1:8601" --session "s_s4demo" \
  --java "$JAVA8/bin/java" --port 8080 --health "http://127.0.0.1:8080/api/orders" \
  --detach --pid-file "work/s_s4demo.pid" --log-dir "work/logs"

curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s4demo/agent"     # connected:true

# preview（静态 HTML origin；18080 stub 见 §4.7；不要指向 8080/5174）
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" preview \
  --target "http://127.0.0.1:18080" --collector "http://127.0.0.1:8601" --session "s_s4demo"

# diagnose（有 preview 分支；--app-url 用真实 2xx 端点）
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" diagnose \
  --collector "http://127.0.0.1:8601" --app-url "http://localhost:8080/api/orders" \
  --session "s_s4demo" --preview-url "http://127.0.0.1:8602/"

# diagnose（无 preview 分支：两项 SKIP、fail=0、SUMMARY PASS、exit 0）
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" diagnose \
  --collector "http://127.0.0.1:8601" --app-url "http://localhost:8080/api/orders" --session "s_s4demo"

# 停机 + 门禁
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" stop --pid-file "work/s_s4demo.pid"
(cd "tools/verify" && npm ci && node verify.mjs)
```

手动核对 fixture（不写仓库）：

```bash
node -e "const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js');const fs=require('fs');const a=new Ajv({strict:true,allErrors:true});const v=a.compile(JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8')));const f='fixtures/s4-details/events.ndjson';fs.readFileSync(f,'utf8').split('\n').filter(Boolean).forEach((l,i)=>{if(!v(JSON.parse(l)))throw new Error(f+' line '+(i+1));});console.log('ok');"
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @"fixtures/s4-details/events.ndjson"  # 202 accepted=9
```

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| CSP nonce/hash-only 拦截注入 | 只注入同源外部 script、不改 CSP；`not-injected:*` + 诊断写“执行未验证”；构建插件留 S5 |
| 无 `</body>` / 压缩 / 非 HTML / HEAD | 不向 target 发送 `Accept-Encoding`；仅 `200 text/html`（charset 缺省/utf-8）注入；2MB 上限；`no_body/encoding/not_html/head/too_large`；guide 说明只处理 outer HTML |
| 绝对 URL/302 绕过预览 → CORS/未采集 | 不改写 URL/`Location`；guide 要求相对路径或原地址；诊断不宣称全站代理 |
| spawn/中文空格/JDK 版本错 | `ProcessBuilder` argv 不经 shell、绝对路径、`--java` 校验；失败给 token；launcher/collector 用 `"$JAVA21/bin/java"`、demo JDK8 + major 52 门禁；裸 `java` 禁用 |
| stop 误杀（PID 复用） | PID JSON 记录 java/jar/startedAtMs；commandLine 为空或规范化后不含 jar、或启动时间偏差 >5s → `PID_MISMATCH` 拒绝；`destroy`→5s→`forcible` |
| 握手时序（应用先于 collector / collector 重启） | premain 守护线程异步、≤3 次退避、fail-open；guide 先起 collector；404 给原因；不阻塞不伪造 |
| 多应用同 session | hello last-wins、`agent` 只反映最后握手；guide 建议一应用一 session；诊断打印 pid/startedAt 供辨识 |
| fixture 被当运行时 ×3 | README/guide/UI/plan 四处声明“运行时 ×3 是 S6”；UI 在 `#s4-invocations`/`#s4-gaps` 下方静态说明；门禁扫描“×3 已支持”类文案；S4 只聚合已采集 span |
| 诊断“假成功” | 七项分级；无 preview 两项 SKIP；0 事件 WARN；**`fail=0` → exit 0（WARN/SKIP 不阻塞）**；任一 FAIL → exit 3；不宣称 SDK 执行/浏览器成功 |
| 端口冲突被静默改 | 固定 8601/8080/5173/5174/8602（测试 18080）；冲突先诊断；测试 `finally` 清理 |
| esbuild 新增依赖 | 官方 npm + lockfile；无 CDN/sourcemap；`build`/`test` 覆盖 |

## 12. 偏离记录

| # | 偏离 | 理由 / 处理 |
|---|---|---|
| D1 | hello 成功码用 **200**、体积上限 **4096B**（任务卡原始写法为 202 / 16KB） | dispatch §4.5 与 S4-C 门禁是 binding 契约，且 200+4096 与 collector 既有 ingest 的 413/信封风格一致；`api.v1.md` §10.2、`transport.v1.md` §6.5、guide、本文件统一按 200/4096；不改任务卡范围信号 |
| D2 | fixture 用**游离后端根**（LOST）而非 dispatch §4.8 的 click 根 EXACT 链 | `event-model.v1.md` §5 不变量禁止孤立后端根与前端事件同 trace；S4-AMD-01 §8 errata 已明确 §4.8 草图作废、D2 为合法偏离。后果：`requests` 1 行 LOST/`NOT_COLLECTED_POLICY`、`sdkActive=false`、`fetchCount=0`；`graph` 仍 9 节点/8 边 |
| D3 | fixture 中 **没有**“未关联 fetch” | 同 D2；S4-AMD-01 §8 确认。缺口 F 由 S4-F 内联前端批次（`ui_event`+未被引用 `fetch`）断言，`expected-facts.json.gaps.notCovered` 明确声明，禁止用本 fixture 冒充 |
| D4 | `startNs` 基值取 `5_000_000_000` | fixture 作用域示意值，避免 epoch-ns 超 `2^53` 导致 JS 比较失真；README 声明断言只依赖相对关系 |
| D5 | `expected-facts.json` 固定 graph 边顺序（父节点序 → 子节点序） | 便于确定性断言；若实现顺序不同，按集合比较（边形状才是契约，顺序不是）；S4-F 测试以 fixture 值为准 |
| D6 | 不新增 `THREW`/错误样本 fixture | S4 只为详情/×3/缺口提供形状；错误聚合沿用 S2/S3 既有用例，避免扩面 |
| D7 | 采纳 S4-AMD-01 取代 G1 建议的 B1/B4/B5 口径 | B1“SKIP→SUMMARY FAIL/exit 3”不采纳（改为 `fail=0` 即 exit 0，WARN/SKIP 不阻塞）；B2 `collectorOrigin` 去后缀算法不需要（`--collector` 本身是 origin）；B4 事件翻页 join 作废（graph 加性字段）；B5 缺口去重/rows 以修订 §7 为准 |

## 13. 回滚与停止条件

- 回滚：S4 全部改动可在一次提交内回退到 `s3-baseline`（`5ddb688` 的基线记录）；launcher 独立模块，删除 `<modules>` 一行即恢复 S3 reactor；SDK IIFE 是新增产物，`dist/` 不入库。
- 停止条件（命中即上报，不降级）：必须改 schema/事件枚举才能握手或详情；必须伪造诊断 PASS 或用 fixture 冒充运行时；必须改 CSP/内联脚本/TLS 才能注入；必须阻塞 premain；G1 FAIL 且一轮返工仍 FAIL；出现 secret/真实数据/第三方镜像。
- S4 完成即停：不得开始 S5（L1/sourcemap/构建插件）；README/报告必须写明“无源码/变量能力、运行时 ×3 是 S6、预览受 CSP/HTML 限制”。

## 14. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| v1 | 2026-11-24 | 首版：四项接入 + 详情/×N/缺口；S4-A..S4-I 门禁与 fixture 草图 |
| v2 | 2026-11-26 | G1 FAIL 返工（B1–B6 + N1–N13）：`--collector` origin 与派生 URL；diagnose 七项/SKIP/WARN/`SUMMARY` 计数/exit 0-1-2-3；预览静态 HTML 目标、响应体改写与头规则、`not-injected` 新码；graph 14 字段（`reason/source/confidence`）与详情数据源；缺口 F>N>R 去重与逐次 rows；JDK21 绝对路径；S4-H 精确迁移；fixture README/expected-facts 同步（事件字节不变，缺口仍 3）；变更记录与 errata 口径 |
