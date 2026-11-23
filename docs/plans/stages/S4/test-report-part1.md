# S4 测试报告（Part 1：S4-BUILD / S4-A / S4-B / S4-C）

> 范围：tester part 1。只新增 `tools/verify/verify.mjs` 的 S4 常量/helper 之上的检查与 S4-only CLI；
> 未改动 product / contracts / schema / fixtures / 其他阶段文档。S4-D..S4-I 由 part 2/3 接入。
> 运行日期：2026-11-23（本机 Windows 10 x64，Node v22.22.2，Maven 3.9.5，JDK21 + JDK8 1.8.0_221）。

## 1. 命令

```bash
cd "tools/verify"

# S4-only（只跑 S4-BUILD + A/B/C，跳过 S0–S3）
node verify.mjs --s4=A,B,C

# 证据落盘（VERIFY_JSON 一行，含 env/results）
node verify.mjs --s4=A,B,C --json > s4-part1.json.log

# 正常全量运行（本 part 不执行；part 2/3 接入 D..I 后由集成者运行）
node verify.mjs
```

CLI 行为（已实现）：
- `const S4_ONLY = process.argv.some(a => a.startsWith("--s4"))`；`--s4=A,B,C` 选择字母，`--s4`（无值）默认全部**已实现**的门（当前 A/B/C）。
- `--s4` 模式：仍采集环境（V0）、记录 git/java 基线、跳过 S0–S3 调用，只跑选中 S4 门；summary 打印 `S4 TEST: PASS|FAIL`，`--json` 时追加 `VERIFY_JSON:{...}`（新增 `mode` / `s4Selected` 字段）。
- 正常 `node verify.mjs`：S0–S3 门全部保留，随后调用 `checkS4()`（S4-BUILD + 已实现门），最终 verdict/exit code 包含 S4 结果。main 内已留注释：part 2/3 在此处接入 S4-D..S4-I。
- 若显式请求未实现字母（如 `--s4=D`），记录 `S4-D` FAIL（“not implemented by tester part 1”），不会伪造 PASS。

## 2. 结果总览

| 门 | 标题 | 结果 |
|---|---|---|
| V0 | environment recorded（S4-only 仍采集 env/基线） | PASS |
| S4-BUILD | reactor 含 launcher；launcher Main-Class/版本/可运行；demo+agent+collector jars | PASS |
| S4-A | `idea` 精确 VM options/5 步/exit 0/无子 java；legacy 与 usage 退出码 | PASS |
| S4-B | `jar --detach` + `stop`：PID/日志、健康、握手、cancel 事件、释放 8080、NOT_RUNNING、PID_MISMATCH、无孤儿 java | PASS |
| S4-C | 握手：精确 200 body、GET agent 形状、405/415/413/400、404、last-wins、不建会话/事件/seq、meta 5 键 | PASS |

两次独立运行均为 `checks: 5 PASS / 0 FAIL (total 5)`、`S4 TEST: PASS`、exit 0（第二次带 `--json`，`mode="s4-only"`、`s4Selected=["A","B","C"]`、`verdict="PASS"`）。

## 3. 关键证据

### S4-BUILD（根 reactor 用 JDK21 构建）

- `JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -q -DskipTests package` → exit 0（增量约 5.6s）。
- 根 `pom.xml` 的 `<modules>` 含 `server/launcher`。
- launcher jar 存在（65,528 bytes）；`META-INF/MANIFEST.MF` 含 `Main-Class: io.traceboard.launcher.Launcher` 与 `Implementation-Version: 0.1.0-SNAPSHOT`；JDK21 `--help` exit 0。
- demo jar（JDK8 产物）、agent jar、collector jar 均存在；demo 缺失时会自动用 JDK8 `mvn -q -DskipTests package` 构建。

### S4-A（`idea` 只打印）

实际命令：

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" idea \
  --jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" \
  --agent "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  --collector "http://127.0.0.1:8601" --session "s_s4idea"
```

证据：exit 0；输出逐字包含

```text
-javaagent:"D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool/agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s4idea
```

以及 `步骤:` 下 `1)`–`5)` 五步；运行前后 java pid 集合不变、8080 监听数不变（未 spawn java/未写文件）。负例：`--ingest` → exit 2 + 改用 `--collector` 建议；缺 `--session` → exit 2；缺 jar/agent → exit 3 + `JAR_NOT_FOUND`/`AGENT_NOT_FOUND`。

### S4-B（JDK8 demo 经 launcher 后台启动 + 握手 + 停止）

实际命令（pid 文件为本次唯一路径 `work/s4-test-<pid>-<stamp>.pid`）：

```bash
"$JAVA21/bin/java" -jar "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar" jar \
  --jar "demo/.../demo-shop-backend-0.1.0-SNAPSHOT.jar" --agent "agent/.../traceboard-agent-0.1.0-SNAPSHOT.jar" \
  --collector "http://127.0.0.1:8601" --session "s_s4launcher" \
  --java "C:/Program Files/Java/jdk1.8.0_221/bin/java" --port 8080 --detach \
  --pid-file "work/s4-test-<unique>.pid" --log-dir "work/logs"
```

证据链：
- `jar --detach` exit 0，输出 `READY pid=35720 url=http://127.0.0.1:8080/ probe=tcp` / `PID=` / `PID_FILE=` / `LOG_DIR=`；`tasklist` 确认 demo pid 存活，`work/logs/s_s4launcher-*.out.log|*.err.log` 均生成。
- PID JSON `{pid,startedAtMs,java(JDK8),jar(demo)}` 与启动值一致（java 为 `jdk1.8.0_221/bin/java.exe`）。
- `GET http://127.0.0.1:8080/api/orders` → 200。
- 握手：`GET /api/v1/sessions/s_s4launcher/agent` → 200 `{"sessionId":"s_s4launcher","connected":true,"version":"0.1.0-SNAPSHOT","pid":35720,"startedAtMs":...,"lastSeenMs":...}`（pid 与 demo 一致）。
- `POST /api/orders/1/cancel` → 200 `{"data":true}`；随后该 session 采集到 4 条 agent 事件（sql/mapper/service/controller）。
- `stop --pid-file` → exit 0 + `STOPPED pid=35720`；8080 释放、pid 消失、PID 文件删除；再次 stop → exit 0 + `NOT_RUNNING`。
- 伪造 pid 文件指向当前 verifier 的 node pid → exit 3 + `PID_MISMATCH`，node 进程未被杀；collector 停止后 java pid 集合与基线一致（无孤儿 java）。

### S4-C（握手契约）

同一 collector（8601，独立启动）上：
- 合法 hello → 200 逐字 `{"schema":"traceboard.agent.v1","sessionId":"s_s4hello","accepted":true}`；`GET .../agent` → 200 固定 6 字段（`sessionId,connected:true,version,pid,startedAtMs,lastSeenMs`），重复 GET 字节一致。
- 失败顺序/状态：非法 JSON → 400 `bad_request`；body >4096B（JSON）→ 413 `payload_too_large`；`text/plain` → 415 `unsupported_media_type`；超大 body + `text/plain` → 415（媒体类型先于大小判定）；`GET /ingest/v1/agent-hello` → 405；`POST .../agent` → 405；未知 session → 404 `not_found`；sessionId 形状非法 → 404。错误信封均含 `apiVersion:"v1"` 且不回显请求体。
- 失败的 400/413/415 不覆盖已有握手记录（仍为 pid=12345/version=0.1.0-SNAPSHOT）。
- last-wins：第二次合法 hello（version=9.9.9-wins/pid=222/startedAtMs=42，含未知字段）→ 200，GET agent 逐项覆盖且未知字段被忽略。
- 不变式：`s_s4hello` 不进入 `GET /api/v1/sessions`；其 `/events` → 404；在 4 次 hello 之后投递第一条真实事件得到 `seq=1`/`nextSeq=1`（hello 未消耗 seq）；`/api/v1/meta` 的 capabilities 仍恰 5 键（`health,meta,ingestEvents,realtime,replay`，`realtime=false`、`replay=true`）。

## 4. 清理

- S4-B 的 pid 文件（唯一的 `work/s4-test-*.pid`、`work/s4-test-foreign-*.pid`）在 `finally` 删除；本次生成的 `work/logs/s_s4launcher-*.out.log|*.err.log` 一并删除，未删除运行前已有的日志。
- 失败路径也由 `finally` 兜底：demo 未停则 `taskkill /PID /T /F`，collector 由 `stopServer` 停；本次两次运行后 8601/8080 均无监听、无 java 残留，`work/logs` 为空。
- 验证器只写 `tools/verify/**` 与 `work/**`（由 launcher 自身产生）；未修改 product/contracts/schema/fixtures。`git status` 中本 part 唯一新增修改为 `tools/verify/verify.mjs`（其余 M 项为 S4 产品 agent 的既有改动），本报告为新增文件。

## 5. 已知缺口（parts 2/3）

1. **S4-D..S4-I 未实现**：`preview` 注入/反代（8602/18080）、SDK IIFE、fixtures/s4-details、diagnose 七项、S4 回归与范围清理等仍未接入；`--s4=D` 等会显式 FAIL（未实现），默认选择只跑 A/B/C，绝不伪造 PASS。
2. **全量运行未在本 part 执行**（按分工）：`node verify.mjs` 的 S0–S3 由其他 agent 运行；已把 `checkS4()` 放在 `checkS3Cleanup()` 之后，最终 verdict 计入 S4，但“S3+S4 全绿”仍需 part 2/3 完成后整体回归。
3. `S4-BUILD` 每次都会跑一次根 reactor 增量构建（S4-only 必需；全量运行会与 V2a 各跑一次，属测试侧时间成本，不是产品缺陷）。
4. S4-A “无子 java” 以运行前后 `java.exe` pid 集合差判断；若同机并发跑其他 java 测试可能误报，建议全量回归串行执行。
5. S4-B 的 `--detach`/`stop` 依赖 Windows `tasklist`/`taskkill` 语义；`stop` 的 commandLine 读取在 Windows 上可能退化到 command+startInstant 分支（launcher 自带 WARN），本机实测走正常命令行校验。
6. S4-C 使用全新 collector（无事件基线）；`lastSeenMs` 为 collector 时钟，只断言为正整数，不与 `startedAtMs`（agent 时钟）做差。
