# S4 进度包（progress）

> 模板：`docs/plans/SOLO-PLAN.md` §4｜日期：2026-11-23｜阶段：S4 本地接入与节点详情

```text
CHECKPOINT: S4（launcher IDEA/JAR、preview/SDK 注入、agent 握手/诊断、节点详情/×N/缺口）

STATUS: done

EVIDENCE:
- 全量门禁：cd "tools/verify" && npm ci && node verify.mjs
  → "checks: 61 PASS / 0 FAIL (total 61)"、"S4 TEST (full S0–S4): PASS"、exit 0（2026-11-23 复核）
- 冷启动嵌套：node work/flake-nesting.mjs → 8/8 pass；修复 startNs/durNs 时钟口径（test-report §8）
- S4-A..I：idea/jar/stop/PID_MISMATCH；handshake 200/400/413/415/405；preview 注入头/长度/not-injected/ingest 202；
  SDK IIFE 13/13；details ×3/缺口/rows 未采集；diagnose 7 项 PASS/FAIL/SKIP；S0–S3 回归；scope/cleanup
- 浏览器：docs/plans/stages/S4/evidence/workbench-s4-details.png（×3、逐次 1/3–3/3、SQL 0/0/未采集、3 缺口）
  docs/plans/stages/S4/evidence/preview-injection.png（SDK active/version 0.1.0；注入点击 → collector s_s4preview）
- 契约/fixture：schema 字节不变；S4 G1 冻结 12/12；S0–S3 fixture 15/15；S4 fixture 9/9 schema-valid

CHANGED:
- agent：AgentHello 握手；SpanContext/SpanEmitter 时钟修复（startNs 与 durNs 同源）
- collector：/ingest/v1/agent-hello、GET /api/v1/sessions/{id}/agent、graph 节点 14 字段（reason/source/confidence）
- server/launcher：idea/jar/stop/preview/diagnose（Java21 CLI，无反代 TLS/鉴权）
- frontend/sdk：IIFE 产物 + config 自动初始化 + 幂等守卫 + version
- workbench：S4 节点详情、×N/逐次调用、SQL/UI 页签、缺口清单；S0–S3 面板保留
- 文档：README、local-launcher 指南、api/transport 契约、S4 分发/修订/计划/评审/测试/验收
- 未改：schema、S0–S3 fixture 字节、案例 A/B 行为、S2 0 行事实

RISK:
- 运行时 ×3 属 S6；S4 fixture ×3 仅为 UI/测试数据，界面已明示
- preview 受 CSP/压缩/无 body/非 2xx 限制，只报 not-injected 原因；“执行”需浏览器验证
- 握手/collector/H2 内存态，重启丢失；无鉴权/持久化/保留
- launcher 需 JDK21；demo 需 JDK8；Windows stop 有 PowerShell 回退
- 真实新手用户测试未做；分支 master；回环口径 127.0.0.1 vs localhost
- S4 G1 非阻断文档瑕疵 N1/N2/N5/N9/N10/N11 已记录

NEXT: S5（L1 参数/字段、脱敏/截断、sourcemap、Vite/Vue 浅层、性能基线；需新的分发书）
```

## 基线记录

- 提交：`feat(S4): local onboarding and details — launcher, preview injection, handshake, node details/×N/gaps`
- tag：`s4-baseline`
- 备份：`docs/plans/archive/stage-S4-2026-11-23/`（MANIFEST + SUMMARY）
- 完整提交哈希：见本文档所在提交后的 `docs(S4): record baseline commit` 与 `git log`。