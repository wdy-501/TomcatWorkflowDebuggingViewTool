# 本地接入指南（S4）：启动器 / 预览注入 / 诊断 / 节点详情

> 适用：TraceBoard S4（本地 MVP）｜权威契约：`docs/contracts/api.v1.md` §2.4/§8.2/§10、`docs/contracts/transport.v1.md` §6.5/§6.6、`docs/plans/stages/S4/s4-plan.md`
> 口径：以 **`docs/plans/stages/S4/dispatch-amendment-01.md`（S4-AMD-01，binding）** 为准；该文件日期栏 2026-11-26 为笔误，按 2026-11-23 生效处理。
> 目标读者：第一次接触本仓库的开发者（T11：4 类接入在 80% 情况下一次成功）。
> 只在**本机回环**工作：无云、无鉴权、无 TLS、无遥测、无外部 CDN；不得填入 secret 或真实客户数据。

## 1. 前置条件

| 依赖 | 版本 | 用途 | 本机路径（示例） |
|---|---|---|---|
| JDK 8 | 1.8.0_221（major 52） | demo 应用 + javaagent **运行** | `C:/Program Files/Java/jdk1.8.0_221` |
| JDK 21 | 21 | 根构建 / collector / **launcher** | `C:/Program Files/Java/jdk-21` |
| Maven | 3.9.x | 构建 Java 模块 | `mvn`（PATH） |
| Node.js / npm | 22 / 10 | SDK IIFE、工作台构建与开发 | `node`、`npm` |

- 端口占用（全部固定，不静默改）：collector `8601`、demo `8080`、工作台 `5173`、demo 前端 `5174`、**预览 `8602`**；测试临时 HTML stub 用 `18080`（仅测试）。
- **JVM 分工**：launcher 与 collector 用 JDK21；demo 应用 + agent 用 JDK8。PATH 上的 `java` 很可能是 JDK8，**不要用裸 `java -jar` 跑 launcher**（会在任何 token 前 `UnsupportedClassVersionError`）；本指南所有 launcher 命令都写 `"$JAVA21/bin/java"`。
- 仓库路径含中文与空格（`D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`）。**所有命令与路径都用双引号**，只在仓库根执行。
- 运行顺序永远是：**先 collector → 再应用（agent）→ 再预览 → 最后工作台/诊断**。应用先于 collector 启动时，握手会失败（见 §7），事件仍可在后续请求中上报。

## 2. 一次性构建

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
export JAVA21="C:/Program Files/Java/jdk-21"
export JAVA8="C:/Program Files/Java/jdk1.8.0_221"

# 2.1 collector（JDK21）
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/collector" -am

# 2.2 agent（JDK21 构建，产物在 JDK8 应用里运行；class major 52）
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "agent" -am

# 2.3 launcher（JDK21，无 Spring、无第三方依赖）
JAVA_HOME="$JAVA21" mvn -B -q -DskipTests package -pl "server/launcher" -am

# 2.4 demo 后端（JDK8；需要 demo jar）
JAVA_HOME="$JAVA8" mvn -B -q -DskipTests package -f "demo/buggy-shop-boot-vue/backend/pom.xml"

# 2.5 SDK（ESM + d.ts + IIFE；预览注入用的是 IIFE）
cd "frontend/sdk" && npm ci && npm run build && cd "../.."

# 2.6 工作台（S4 节点详情/×N/缺口）
cd "workbench" && npm ci && npm run build && cd ".."
```

产物：

| 产物 | 路径 |
|---|---|
| collector jar | `server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar` |
| agent jar | `agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar` |
| launcher jar | `server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar` |
| demo jar | `demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar` |
| SDK IIFE | `frontend/sdk/dist/traceboard-sdk.iife.js`（全局名 `TraceBoardSDK`，无 sourcemap） |

启动 collector：

```bash
"$JAVA21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar"
# 另一个终端：
curl -s "http://127.0.0.1:8601/actuator/health"
curl -s "http://127.0.0.1:8601/api/v1/meta"
```

- **`--collector` 语义**：所有 launcher 子命令的 `--collector <base>` 只接收 **collector origin**（如 `http://127.0.0.1:8601`，末尾 `/` 归一化），**不是**完整 ingest URL、不接受 `/ingest` 路径；带路径/查询/`https`/非回环主机 → exit 2（`COLLECTOR_URL_INVALID`/`NON_LOOPBACK_TARGET`）。旧 `--ingest`/`--ingest-url` 已移除。
- 由 origin 派生：ingest = `<base>/ingest/v1/events`；诊断只读 = `<base>/actuator/health`、`<base>/api/v1/meta`、`<base>/api/v1/sessions/<id>/agent`、`<base>/api/v1/sessions/<id>/events`。**health/meta/agent/events 一律不带 `/ingest` 前缀**。
- `/api/v1/meta` 的 `capabilities` 恒为 5 键：`health, meta, ingestEvents, realtime(false), replay`；`realtime=false`，S4 仍**没有** SSE/WS。

## 3. 接入一：IDEA（不启动进程，只打印）

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" idea \
  --jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" \
  --agent "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  --collector "http://127.0.0.1:8601" \
  --session "s_s4demo"
```

输出（可原样粘贴，绝对路径 + 引号）：

```text
-javaagent:"<agentAbs>" -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s4demo
```

`idea` 不改系统环境、不写文件、不 spawn 任何进程。随后：

1. 先起 collector，并确认 `curl -s "http://127.0.0.1:8601/actuator/health"` 返回 `UP`。
2. IDEA 打开 demo backend；Run/Debug Configurations → 选中 Spring Boot 应用 → **VM options**（不是 Program arguments）粘贴上面那一行。
3. 启动应用；等日志出现 `Tomcat started on port 8080`。
4. 确认握手：`curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s4demo/agent"` → `connected:true` + `version/pid/startedAtMs/lastSeenMs`（404 见 §7）。
5. 开预览（从仓库根）：
   ```bash
   "$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" preview \
     --target "http://127.0.0.1:18080" --collector "http://127.0.0.1:8601" --session "s_s4demo"
   ```
   浏览器访问 `http://127.0.0.1:8602`。
   - **demo 后端没有 HTML 页面**（`/` 是 404），不能作 preview 目标；预览注入用 §5.1 的 18080 stub 验证，或指向你自己的静态 HTML 页。
   - demo 前端（Vite 5174）已通过 `vite.config.ts` 别名内置 SDK，**不要**把 preview 指向 5174（会二次加载/二次上报）。
6. 工作台 `http://127.0.0.1:5173` 选同一 session，点 `#btn-cancel`（案例 A）/`#btn-save-b`（案例 B）。

## 4. 接入二：JAR（spawn + 健康 + PID + 日志）

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" jar \
  --jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" \
  --agent "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  --collector "http://127.0.0.1:8601" \
  --session "s_s4demo" \
  --java "$JAVA8/bin/java" \
  --port 8080 \
  --health "http://127.0.0.1:8080/api/orders" \
  --detach \
  --pid-file "work/s_s4demo.pid" \
  --log-dir "work/logs"
```

- **必须用 JDK8 跑 demo/agent**（agent 编译为 major 52，demo 按 JDK8 语义构建）：`--java` 显式给 `"$JAVA8/bin/java"`；缺省可能落到 `$JAVA_HOME/bin/java`（构建常用 JDK21）或 PATH 的 `java`，不保证是 JDK8。
- `--health` 必须是**真实 2xx 端点**：demo 用 `http://127.0.0.1:8080/api/orders`；省略则按 TCP 存活判定。demo 是 Boot 2.7 + 仅 `spring-boot-starter-web`，**没有 `/actuator/health`**；`/` 也是 404（不代表应用没起）。
- 实际 argv（不经 shell，空格/中文安全；`-javaagent`/`-D` 都在 `-jar` 之前）：

  ```text
  <java> -javaagent:<agentAbs> -Dtraceboard.ingestUrl=<base>/ingest/v1/events -Dtraceboard.sessionId=<id> [-Dserver.port=<port>] -jar <jarAbs>
  ```

- 日志：`work/logs/<session>-<timestamp>.out.log` / `.err.log`（gitignored）。子进程直接写文件（`ProcessBuilder.Redirect.appendTo`），attached 模式 launcher tail 回显；`--detach` 就绪后关闭 tail、不关闭子进程句柄，所以 launcher 退出不会丢日志。
- PID 文件（JSON）：`{"pid":N,"startedAtMs":E,"java":"...","jar":"..."}`；默认 `work/<session>.pid`。
- 就绪判定：给了 `--health` 就 GET 该 URL 期待 2xx，否则 TCP 连 `127.0.0.1:<port>`（仅存活）；超时 30s。
- `--detach` 打印 `PID=`、`PID_FILE=`、`LOG_DIR=` 后退出 0；不加 `--detach` 则跟随进程并以它的退出码退出（Ctrl+C 会带走应用）。

停止：

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" stop --pid-file "work/s_s4demo.pid"
# STOPPED pid=12345
```

- 进程不存在 → `NOT_RUNNING` + exit 0（幂等，可重复执行）。
- PID 已被别的进程复用（`commandLine` 为空、或规范化后既不含记录的 jar 路径也不含 jar 文件名、或启动时间偏差 >5s）→ `PID_MISMATCH` + exit 3，**拒绝杀**。
- 正常停止 `destroy()`，5s 未退再 `destroyForcibly()`，成功后删除 PID 文件。

## 5. 接入三：预览反代 + 脚本注入

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" preview \
  --target "http://127.0.0.1:18080" \
  --collector "http://127.0.0.1:8601" \
  --session "s_s4demo"
```

- **目标必须是静态 HTML origin**（§5.1 的 18080 stub 或你自己的静态页）。**不要**指向 demo 后端 8080（无 HTML 页）、**不要**指向 Vite demo 5174（已内置 SDK，会重复加载/上报）。
- 绑定 `127.0.0.1:8602`（`--port` 可改），**只支持 http 目标**；`https` → `TARGET_TLS_UNSUPPORTED` exit 3。`--target` 默认只接受回环主机（`127.0.0.1`/`localhost`/`::1`），非回环 → exit 2 + `NON_LOOPBACK_TARGET`；确需非回环时显式 `--allow-non-loopback`（先打印 `WARN non-loopback target=<host>`，仍无 TLS/外部网络）。
- 路由：
  - `/traceboard/config.js`：逐字 `window.__TRACEBOARD_CONFIG__ = {"sessionId":"s_s4demo","ingestUrl":"/ingest","appName":"traceboard-preview","observeMs":1500};`
  - `/traceboard/sdk.js`：IIFE 字节。解析顺序 `--sdk <path>` → 系统属性 `traceboard.sdk.iife` → 环境变量 `TRACEBOARD_SDK_IIFE` → **仓库根 CWD** `frontend/sdk/dist/traceboard-sdk.iife.js`；全都没有 → `SDK_IIFE_MISSING` exit 3（先跑 §2.5，或从仓库根启动 launcher，或设置 `--sdk`/`TRACEBOARD_SDK_IIFE`）。没有“launcher jar 上两级”的猜测路径。
  - `/ingest/v1/events`：反代到 `<base>/ingest/v1/events`（方法/体/`Content-Type` 原样）；collector 不可达 → `502` 且说明，不伪造 `202`。其他 `/ingest/*` → 404（不做开放写代理）。
- **请求侧**：转发到 `--target` 的请求**移除 `Accept-Encoding`**（不添加 `identity`），不主动协商压缩。
- **注入条件**：仅上游 `200` + `Content-Type: text/html`（参数允许）+ charset 缺失或 `utf-8`；在**最后一个**大小写不敏感 `</body>` 前插入

  ```html
  <script src="/traceboard/config.js"></script><script src="/traceboard/sdk.js"></script>
  ```

  **没有内联脚本**；不改写 CSP、不改写业务 HTML/JS。
- **注入成功的响应头**：保留状态码与端到端头；按改写后的 **UTF-8 字节重算 `Content-Length`**；移除 `Content-Encoding`、`Transfer-Encoding`、`ETag`、`Last-Modified`（若有 `Content-MD5` 也移除）；不转发 hop-by-hop 头（`Connection`/`Keep-Alive`/`TE`/`Trailer`/`Upgrade`/`Proxy-*`）；设置 `X-TraceBoard-Preview: injected`。
- **未注入**：状态/头/体**逐字节透传**，保留上游 `Content-Length`/`Content-Encoding`。
- `not-injected` 码与优先级：① `HEAD` → `head`；② `204/304` → `no_body`；③ 非 `200`（含 3xx/4xx/5xx 错误页）→ `status`；④ 非 identity 的 `Content-Encoding` → `encoding`；⑤ 非 `text/html` → `not_html`；⑥ charset 非 utf-8 → `encoding`；⑦ >2MB → `too_large`；⑧ 无 `</body>` 或 `Content-Length: 0` → `no_body`；⑨ 读取失败 → `read_error`。`X-TraceBoard-Preview` 只出现在经 target 反代的响应上；`/traceboard/*` 与 `/ingest/v1/events` 不添加该头。
- 不改写 CSP、HTML/JS 业务内容、绝对 URL/`Location`。

### 5.1 用静态 HTML 自测注入（不依赖 demo）

```bash
# 终端 A：18080 上跑一个最小 HTML stub（仅本机）
node -e "require('http').createServer((q,s)=>{if(q.url==='/plain'){s.writeHead(200,{'Content-Type':'text/plain'});s.end('plain-body')}else{s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end('<!doctype html><html><body><h1>stub</h1></body></html>')}}).listen(18080,'127.0.0.1')"

# 终端 B：预览指向 stub（从仓库根运行，便于解析 IIFE）
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" preview \
  --target "http://127.0.0.1:18080" --collector "http://127.0.0.1:8601" --session "s_s4demo"

# 终端 C：验证
curl -si "http://127.0.0.1:8602/" | head -n 10     # 期望 X-TraceBoard-Preview: injected；Content-Length 为改写后长度
curl -s  "http://127.0.0.1:8602/" | grep -o "<script src=\"/traceboard/[a-z.]*\"></script>"
curl -si "http://127.0.0.1:8602/plain" | head -n 8 # 期望 not-injected:not_html 且体为 plain-body
curl -s  "http://127.0.0.1:8602/traceboard/config.js"  # 含 "sessionId":"s_s4demo"
curl -s  "http://127.0.0.1:8602/traceboard/sdk.js" | head -c 200  # 含 TraceBoardSDK
curl -sI "http://127.0.0.1:8602/"                  # 期望 not-injected:head 且无 body
```

### 5.2 已知限制（如实报告，不隐瞒）

| 情况 | 表现 | 说明 |
|---|---|---|
| 页面 `script-src` 只允许 nonce/hash | 标签已注入，浏览器仍可能不执行 | launcher **不改写 CSP**、不加 nonce；诊断只能说“已注入、执行未验证”（S4 无 CDP/浏览器扩展） |
| 无 `</body>`（片段、SPA 外壳、JS 生成的 DOM） | `not-injected:no_body` | 只处理 outer HTML；不注入 `</html>` 后、不改写脚本流 |
| 上游压缩（gzip/br） | `not-injected:encoding` | 不向 target 发送 `Accept-Encoding`；上游仍压缩时放弃注入而不是破坏字节 |
| 非 HTML（JSON/JS/图片/字体） | `not-injected:not_html`，体逐字透传 | 二进制不做任何改写 |
| 上游 3xx/4xx/5xx | `not-injected:status` | 错误页也不注入；预览 404 不会判 PASS |
| HEAD / 204 / 304 | `not-injected:head` / `not-injected:no_body` | 不产生 body，不注入 |
| 响应 > 2MB | `not-injected:too_large` | 防内存风险 |
| 页面用绝对 URL（`http://localhost:8080/...`）或 302 跳出预览 | 绕开预览，前端事件不经过 `/ingest` | 不改写 URL/`Location`；请用相对路径访问，或接受“部分页面未采集” |
| https 目标 | `TARGET_TLS_UNSUPPORTED` | S4 无 TLS 代理 |
| 非回环目标 | `NON_LOOPBACK_TARGET` exit 2 | 仅 `--allow-non-loopback` 显式放行（WARN）；默认只允许本机 |
| 预览 session 与应用 session 不一致 | 前端事件与后端事件落到不同 session，关联不上 | `--session` 必须与 agent `-Dtraceboard.sessionId` 相同 |

## 6. 接入四：诊断

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" diagnose \
  --collector "http://127.0.0.1:8601" \
  --app-url "http://localhost:8080/api/orders" \
  --session "s_s4demo" \
  --preview-url "http://127.0.0.1:8602/"
```

行格式 `PASS|FAIL|WARN|SKIP <check>: <evidence>`；末行**精确为** `SUMMARY: <PASS|FAIL> pass=<n> warn=<n> fail=<n> skip=<n>`（计数之和恒为 7）。**`SUMMARY: PASS` 当且仅当 `fail=0`；`WARN`/`SKIP` 不阻塞，仍可 exit 0。** 退出码：`0` 无 FAIL；`3` 任一 FAIL；`2` 用法/参数非法；`1` launcher 自身未预期错误（`LAUNCHER_ERROR`）。

| check | 检查内容 | 可能结果 |
|---|---|---|
| `collector_health` | `GET <base>/actuator/health` | 200 且 `status="UP"` → PASS；不可达 → `FAIL` + `INGEST_UNREACHABLE`；其他 → FAIL |
| `collector_meta` | `GET <base>/api/v1/meta`，要求 capabilities 恰 5 键且 `realtime=false` | 形状不符 → FAIL（打印键集合） |
| `app_health` | `GET --app-url`（缺省 `http://localhost:8080/api/orders`） | 2xx → PASS；否则 FAIL（打印状态与 Content-Type；`/` 的 404 不代表应用没起） |
| `agent_handshake` | `GET <base>/api/v1/sessions/<id>/agent` | 200 且 `connected:true` 且 sessionId 匹配 → PASS（打印 version/pid/startedAtMs/lastSeenMs）；404/其他 → FAIL + 原因与下一步 |
| `recent_events` | `GET <base>/api/v1/sessions/<id>/events?afterSeq=0&limit=1` | 有事件 → PASS（打印首条 seq/nextSeq）；0 事件 → **WARN**；可达的 404 → **WARN**；连接失败 → FAIL |
| `preview_injection` | 无 `--preview-url` → **SKIP**（`reason=no_preview_url`）；有则 `GET --preview-url` | 仅 200 + `X-TraceBoard-Preview: injected` + 两个 script 都在最后一个 `</body>` 前 → PASS；`not-injected:*` → FAIL；非 2xx（含上游 404）→ FAIL |
| `sdk_script` | 无 `--preview-url` → **SKIP**（`reason=no_preview_url`）；有则 `GET <preview-origin>/traceboard/sdk.js` | 200 且含 `TraceBoardSDK` → PASS；缺失/不匹配/不可达 → FAIL + 构建命令 |

- **无 preview 的运行**：`preview_injection`/`sdk_script` 两行都是 `SKIP ... reason=no_preview_url`，`skip=2`、`fail=0` → `SUMMARY: PASS`、exit 0；不是 FAIL，也不是伪造 PASS。
- **有 preview 的运行**：七项全执行；只有 `fail=0` 才是 `SUMMARY: PASS`；0 事件只是 `recent_events WARN`，不改变退出码；预览页是 404/错误页时 `preview_injection` 必须 FAIL（exit 3）。
- 每行 evidence 都含请求 URL、HTTP 状态与至少一项关键证据（头、`version/pid/startedAtMs/lastSeenMs`、事件条数/`nextSeq`、脚本标签、非注入时 ≤200 字节 body 摘要）；无证据的 PASS 不允许。
- **未验证项**（诊断不会伪造）：SDK 是否在浏览器里真正执行、页面是否因 CSP 拦截、预览是否覆盖全站、握手是否代表应用业务健康。它们只能由你打开预览页/工作台人工确认。
- collector 不可达时，诊断仍继续执行 app/preview 检查并如实记录；不会因为一项失败就伪造其他 PASS。

## 7. 排障矩阵

| 现象 | 优先检查 | 处理 |
|---|---|---|
| `UnsupportedClassVersionError`（launcher 起不来） | 是否用了 JDK8/PATH 的 `java` 跑 launcher | 用 `"$JAVA21/bin/java"`（或 `"$JAVA_HOME/bin/java"` 且 `JAVA_HOME` 指向 JDK21）跑 launcher；JDK8 只给 demo/agent |
| `JAVA_NOT_FOUND` | `--java` 路径、`JAVA_HOME` | 指到实际 `java.exe`；JDK8 给 demo、JDK21 给 launcher |
| `COLLECTOR_URL_INVALID` / `NON_LOOPBACK_TARGET` | `--collector` 是否 origin、目标是否非回环 | 只传 `http://127.0.0.1:8601`（或 `localhost`/`::1`），不带路径；非回环仅 preview `--target` 可用 `--allow-non-loopback` |
| `AGENT_NOT_FOUND` / `JAR_NOT_FOUND` | 路径拼写、是否已构建 | 重跑 §2.2/§2.4；路径用双引号 |
| 端口占用（`PORT_IN_USE`） | 8601/8080/8602 是否被旧进程占 | `netstat -ano | findstr :8080` 查 PID；先 `stop` 或换测试端口，不做静默改端口 |
| `APP_EXITED` + 日志尾 | `work/logs/*.err.log` | 常见：jar 损坏、端口占用、JDK 版本不对、H2 初始化失败 |
| `HEALTH_TIMEOUT` | 健康 URL、`--port` | demo 用 `http://127.0.0.1:8080/api/orders` **或省略 `--health`**（按 TCP）；demo 没有 `/actuator/health`；启动慢 > 30s 时手工起 |
| `GET .../agent` 返回 404（agent 未连接） | 应用是否带 `-javaagent`、`-Dtraceboard.sessionId` 是否与查询一致、collector 是否先起 | 看应用 stderr 的 `[traceboard-agent]` 计数：`hello_failed=3` 表示重试耗尽；`hello_skipped reason=ingest_url` 表示 ingest URL 形状不对（必须 `<base>/ingest/v1/events`）；重启应用最简单 |
| 有事件但 `GET .../agent` 404 | 握手是**纯内存 last-wins**，且 collector 重启后未再收到 hello | 重启应用（重新握手）；S4 不把“有事件”当“已连接”（`connected` 只可能是 200 `true` 或 404） |
| 握手在 collector 重启后消失 | 事件与握手都在 collector 内存 | 这是设计行为；重启 collector 或重启应用都会让 `connected` 消失；事件历史同样随 collector 重启清空（无持久化） |
| 预览根页没有注入 | `X-TraceBoard-Preview` 头 | `not-injected:not_html` 看 Content-Type；`no_body` 说明无 `</body>`/204/304；`encoding` 说明压缩；`status` 说明上游非 200；`too_large` 看 2MB；`read_error` 看上游 |
| `SDK_IIFE_MISSING` | 是否跑过 `npm run build`、是否从仓库根启动 | 跑 §2.5；从仓库根启动 launcher，或 `--sdk "frontend/sdk/dist/traceboard-sdk.iife.js"`，或设置 `TRACEBOARD_SDK_IIFE` |
| `/ingest/*` 返回 502 | collector 是否存活、`--collector` 是否是 origin | collector 先起；`--collector` 只收 `http://host:port`；只有 `/ingest/v1/events` 被反代，其他 `/ingest/*` 是 404 |
| 工作台详情不出现 | 是否选了同一 session、是否选中树节点 | S4 详情/×N/缺口是纯前端派生，仅基于已采集事件；无事件时为空态 |
| 详情里 `rows` 显示“未采集” | 该节点没有 `sideEffects`（如 mapper）或策略未采集；逐次 rows 无 sql 子节点 | 这是如实标注，**不等于 0 行**；看 sql 子节点（标注“子 sql”）或 reason |
| `x3` 分组只在 fixture 出现 | 运行时 ×3 是 S6 | S4 只按 `nodeKey` 聚合**已采集** span；UI 静态说明“×N 为已采集 span 的前端聚合；运行时 ×3 属 S6”，见 `fixtures/s4-details/README.md` |

退出码：`0` 成功/无 FAIL；`1` launcher 自身未预期错误；`2` 用法/参数非法（含 session 不匹配 `^s_[A-Za-z0-9_-]+$`、collector URL 形状错误、非回环目标）；`3` 预期失败（spawn/健康超时/`stop` 拒绝/diagnose 任一 FAIL）。

## 8. 安全与隐私

- 只监听 `127.0.0.1`；无鉴权、无 CORS 配置、无对外暴露；不要把 `8601/8602` 反向代理到公网。
- `--collector`/`--app-url`/`--preview-url`/`--health`/`--target` 默认只接受回环主机，非回环直接 exit 2（唯一例外：`preview --target` 的 `--allow-non-loopback`，且会打印 WARN）；仍无 TLS/外部网络能力。
- 不写 secret、不读环境变量里的凭据；`config.js` 只含 sessionId/ingestUrl/appName/observeMs。
- 日志留在 `work/logs/`（gitignored）；分享日志前自行检查是否含路径/业务信息。
- 事件上限与脱敏沿用 S1–S3：不采参数/局部变量/`values[]`（S5/S6），`REDACTED`/`TRUNCATED` 只是既有显示。
- 无 CDN/在线字体/遥测/外部网络请求；依赖只来自 Maven Central 与 npm 官方源。

## 9. S4 边界（不要据此宣称完成）

- 有：本地 IDEA/JAR 接入、预览注入（静态 HTML）、诊断七项、agent 握手与 `agent` 状态、节点详情/×N/缺口（纯前端，graph 14 字段）、SDK IIFE 自动初始化。
- 没有：L1/L2（参数/变量/字段）、sourcemap/行号/构建插件（S5）、运行时 ×3（S6）、异步续体/后台车道/`/links`/时间窗 INFERRED（S6）、SSE/WS/实时、持久化/DB/鉴权、TLS 代理、浏览器扩展/CDP、Tomcat/WAR/React/云（S7+）。
- 诊断 PASS 只证明“本地链路形状正确”，不证明业务正确、不证明 SDK 在浏览器执行、不证明预览覆盖全站。
