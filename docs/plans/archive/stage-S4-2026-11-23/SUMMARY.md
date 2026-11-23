# SUMMARY — S4 阶段总结（本地接入与节点详情）

> 阶段：S4｜日期：2026-11-23｜结论：**G2 PASS，tag `s4-baseline`**
> 权威证据：`stages/S4/acceptance.md`、`test-report.md`、`plan-review.md`、`progress.md` 与 git tag。

## 1. 目标（SOLO S4）

在 S0–S3 之上交付本地接入与详情：launcher（IDEA/JAR）、预览代理/SDK 注入、诊断；节点详情、×N、SQL/UI 事实与缺口。
完成信号：按文档可接入；案例 A/B 能走到结论；未采集有原因。**不做 S5/S6/S7**。

## 2. 交付物

- `server/launcher`（Java21）：`idea`、`jar`、`stop`、`preview`、`diagnose`；JDK8 启动 demo+agent、健康等待、PID/日志、停止安全校验。
- agent 握手：`POST /ingest/v1/agent-hello`；collector `GET /api/v1/sessions/{id}/agent`；diagnose 7 项 PASS/FAIL/WARN/SKIP。
- preview：静态 HTML 反代注入外部 `config.js`+`sdk.js`；仅 200 text/html、Content-Length 重算、CSP 不改、`not-injected:*` 原因；`/ingest/v1/events` 代理。
- SDK IIFE：`dist/traceboard-sdk.iife.js`，`window.__TRACEBOARD_CONFIG__` 自动初始化、幂等守卫、version；ESM 不变。
- workbench：节点详情、×N 聚合/逐次调用、SQL/UI 页签、缺口清单；S0–S3 面板保留。
- 时钟修复：agent `startNs` 与 `durNs` 使用同一 advice `nanoTime`，消除冷启动嵌套竞态。
- 文档：根 README、`docs/guides/local-launcher.md`、S4 契约/计划/评审/测试/验收。

## 3. 证据

- 全量门禁：`cd tools/verify && npm ci && node verify.mjs` → **61 PASS / 0 FAIL**，`S4 TEST (full S0–S4): PASS`，exit 0。
- 冷启动压力：`node work/flake-nesting.mjs` → **8/8 PASS**（修复后）。
- 浏览器：
  - `evidence/workbench-s4-details.png`：service/mapper ×3、sql ×2；逐次 1/3–3/3（OK/OK/RETURNED_FALSE）；SQL rows 0/0/未采集；3 条缺口原因。
  - `evidence/preview-injection.png`：注入页 `TraceBoardSDK` active/version 0.1.0；注入点击进入 collector `s_s4preview`。
- 契约：S4 G1 冻结 12/12；schema 与 S0–S3 fixture 字节不变；S4 fixture 9/9 schema-valid。

## 4. 结果与限制

- 结果：launcher/preview/handshake/details 均通过自动 + 浏览器验证；S0–S3 无回归。
- 限制：运行时 ×3 属 S6（fixture ×3 仅 UI/测试）；真实新手用户测试未做；preview 受 CSP/压缩/无 body/非 2xx 限制；握手/collector/H2 内存态；launcher 需 JDK21、demo 需 JDK8；分支 `master`；本地回环。
- 安全：无 secret/真实数据/CDN/镜像；preview 外部脚本、不内联、不改 CSP；collector/launcher 仅 `127.0.0.1`。

## 5. 下一步

S5：L1 参数/实体字段、脱敏/截断、sourcemap、Vite/Vue 浅层插件、性能基线（需新的分发书）。
S6–S10 按 SOLO-PLAN 推进；每阶段结束更新 `docs/plans/STAGE-PROGRESS.md` 并生成备份/tag。

## 6. 恢复

把本目录文件复制回仓库对应相对路径即可回看；阶段代码以 tag `s4-baseline` 为准。不要把本快照当作新契约来源。