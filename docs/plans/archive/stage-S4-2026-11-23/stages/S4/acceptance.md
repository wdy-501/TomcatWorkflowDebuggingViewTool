# S4 验收（G2）— 本地接入与节点详情

> 日期：2026-11-23｜门禁：**G2: PASS**｜基线：tag `s4-baseline`（提交见文末记录）
> G1：`plan-review.md` 终验 PASS（S4-AMD-01 后冻结 12 个哈希）｜独立测试：`test-report.md`（61/61）

## 1. 结论

S4 在 S0–S3 之上交付了**本地接入**与**节点详情**，且未越过 S5/S6/S7 边界：

- launcher `idea` / `jar` / `stop` / `preview` / `diagnose` 可复跑；JAR 路径真实启动 demo+agent，PID/日志/健康等待/停止/PID_MISMATCH 均有证据。
- agent 握手（`/ingest/v1/agent-hello`）与 collector `GET .../agent` 可用；`diagnose` 7 项检查 PASS/FAIL/WARN/SKIP 语义明确，无假成功。
- preview 反代注入外部 `config.js`+`sdk.js`；浏览器实测 `window.TraceBoardSDK` active/version 0.1.0，注入点击事件进入 collector `s_s4preview`。
- 工作台节点详情：状态/理由/return/flags/thread/source/confidence、SQL/UI 页签、按 nodeKey ×N 与逐次调用、缺口清单；×3/×2 与“未采集绝不为 0”在浏览器实测。
- 真实缺陷修复：agent span 冷启动嵌套竞态（`startNs` 与 `durNs` 时钟口径不一致）已修复；8/8 冷启动压力通过，全量 61/61。

**S4 到此停止；S5（L1/sourcemap/前端浅层）需要新的分发书。**

## 2. G2 复核清单

| 项 | 结果 | 证据 |
|---|---|---|
| 全量门禁 | **61 PASS / 0 FAIL**，`S4 TEST (full S0–S4): PASS`，exit 0 | `cd tools/verify && node verify.mjs`（2026-11-23） |
| 冷启动嵌套 | **8/8 PASS** | `node work/flake-nesting.mjs`；`test-report.md` §8 |
| S4-BUILD | PASS | root reactor 含 `server/launcher`；launcher jar Main-Class；SDK 3 dist/13 tests |
| S4-A idea | PASS | 输出含 `-javaagent`、`-Dtraceboard.ingestUrl=<collector>/ingest/v1/events`、session、5 步；旧 `--ingest` exit 2 |
| S4-B jar/stop | PASS | JDK8 启动、READY/PID/日志、health、handshake、cancel 4 events、stop 释放 8080、NOT_RUNNING、PID_MISMATCH exit 3 |
| S4-C handshake | PASS | 200 exact、405/415/413/400、GET agent 200/404/405、last-wins、不占 seq/不建会话、meta 5 键 |
| S4-D preview | PASS | 仅 200 text/html 注入外部脚本；Content-Length 重算；去 CE/TE/ETag/Last-Modified；`not-injected:*`；`/ingest/v1/events` 202、其他 404；target/collector down 502 |
| S4-E SDK IIFE | PASS | 13/13 tests、3 dist、global/version、auto-init once、double-load guard、no-config、bad-config fail-open、无 sourcemap/CDN |
| S4-F details/×N/gaps | PASS | 9/9 schema；requests LOST/9；graph 9/8、14 字段；service ×3/mapper ×3/sql ×2；缺口 3；rows 0/0/未采集 |
| S4-G diagnose | PASS | 7 PASS exit 0；无 preview → skip=2 exit 0；缺 session/app down/preview not-injected → exit 3；计数和=7 |
| S4-H regression | PASS | S0–S3 51 项全 PASS；hello 不占 seq/不建会话；schema/S0–S3 fixture 字节不变；S4 G1 冻结 12/12 |
| S4-I scope/security | PASS | 无 S5/S6/S7；无 secret/CDN/mirror；preview 外部脚本/CSP 不改/回环；端口与进程清理；git index 未动 |
| 浏览器详情 | PASS | `evidence/workbench-s4-details.png`：×3、逐次 1/3–3/3、OK/OK/RETURNED_FALSE、SQL 0/0/未采集、3 缺口、详情字段 |
| 浏览器注入 | PASS | `evidence/preview-injection.png`；SDK active/version 0.1.0，注入点击 → collector `s_s4preview` SDK ui_event |
| 文档 | PASS | 根 `README.md`、`docs/guides/local-launcher.md`、契约 S4 矩阵、`STAGE-PROGRESS.md` |

## 3. 范围与安全

- **未做**：sourcemap/构建插件/L1/L2、Tomcat/WAR/SSM、React/Webpack、云端、SSE/WS、像素回放、持久化、外部 MySQL。
- preview 仅绑 `127.0.0.1`、无 TLS；只注入外部同源脚本，不改 CSP、不内联；目标默认必须回环。
- 无 secret/真实客户数据；错误信封不回显 body；collector/launcher 回环；SDK 不采集表单值/cookie/请求体。

## 4. 已知限制（不阻断 S4）

1. 运行时 ×3 属 S6；`fixtures/s4-details` 的 ×3 是 UI/测试数据，界面已明示。
2. 真实新手用户接入测试（3–5 人）未做；已提供指南 + 自动化 launcher/preview/diagnose 路径。
3. preview 对 CSP nonce/hash-only、压缩、无 `</body>`、非 200 HTML 等不注入，只给 `not-injected:*` 原因；不承诺“已执行”，需浏览器验证。
4. agent 握手/collector/H2 均为内存；collector 重启丢握手与事件；无鉴权/保留/淘汰。
5. Windows `stop` 在 `ProcessHandle.commandLine()` 为空时回退 PowerShell `Get-CimInstance`；foreign PID 仍 PID_MISMATCH。
6. launcher 必须用 JDK21；demo 必须用 JDK8 `--java`；路径含中文/空格必须加引号。
7. 分支实际 `master`（计划写 `main`）；`work/` 日志/压力脚本不入 git；仅本地回环。
8. S4 G1 非阻断文档瑕疵（N1/N2/N5/N9/N10/N11 等）已记录，不改变验收结论。

## 5. 基线记录

- 提交：`feat(S4): local onboarding and details — launcher, preview injection, handshake, node details/×N/gaps`（哈希见 `progress.md`/git log）。
- tag：`s4-baseline`｜阶段备份：`docs/plans/archive/stage-S4-2026-11-23/`（MANIFEST + SUMMARY）。
- 下一步：S5（L1 参数/字段、脱敏/截断、sourcemap、Vite/Vue 浅层、性能基线）。