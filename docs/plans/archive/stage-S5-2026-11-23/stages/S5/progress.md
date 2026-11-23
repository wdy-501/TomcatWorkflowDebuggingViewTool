# S5 进度包（progress）

> 模板：`docs/plans/SOLO-PLAN.md` §4｜日期：2026-11-23｜阶段：S5 L1 与前端浅层

```text
CHECKPOINT: S5（L1 参数/字段/返回、脱敏/截断、sourcemap/浅层 Vite 插件、性能基线）

STATUS: done

EVIDENCE:
- 全量：cd "tools/verify" && npm ci && node verify.mjs
  → "checks: 70 PASS / 0 FAIL (total 70)"、"S5 TEST (full S0–S5): PASS"、exit 0
- S5-A..H：SDK 17、build-plugin 6、demo manifest/sourcemap、L1 values 5（100/脱敏/截断/100→0/return 0）、
  graph 15 字段、workbench Values/source、S0–S4 回归、scope/cleanup
- 浏览器：evidence/workbench-s5-values.png（L1 5 行、100→0、已脱敏、已截断、L1）；
  evidence/workbench-s5-source.png（js_method source src/App.vue:104 manifest 映射；service OrderService.java:61）
- DB：preview-discount 后 GET orders amount 仍 100.0；raw s3cr3t 不在事件中
- 性能：base p50 ~0.985ms/p95 ~1.818ms；agent p50 ~1.271ms/p95 ~2.143ms；ratio 1.29（WARN，>1.25）

CHANGED:
- demo：preview-discount 端点/service/mapper findById；前端 L1 按钮/manifest/sourcemap/标题
- agent：7 advice/5 类型；values/L1；Order#setAmount 字段 advice（防 MyBatis 0→100）；Redactor/截断；source 方法级缓存
- collector：graph 15 字段 values
- frontend/sdk：manifest source/SOURCE_MAPPED；build-plugin manifest 扫描/注入
- workbench：Values/Source/L1 详情、旧 S5 文案修正
- 文档：api/event-model、frontend-shallow 指南、S5 分发/计划/G1/测试/验收
- 未改：schema、transport、status、S0–S4 fixture 字节、案例 A/B 行为

RISK:
- perf ratio 1.29 超 25% 目标（WARN；未降级/未造假）
- manifest 仅函数级；L2/局部变量/异步/×3 属 S6
- demo 前后端需同会话；unknown id 200 data 0；内存态；分支 master；本地回环
- 真实新手/视觉/用户测试未做

NEXT: S6（L2 行级局部变量、字段写入、异步上下文、运行时 ×3、预算/循环折叠；需新分发书）
```

## 基线记录

- 提交：`feat(S5): L1 values and frontend shallow source — 100→0, redaction/truncation, manifest, perf baseline`
- tag：`s5-baseline`
- 备份：`docs/plans/archive/stage-S5-2026-11-23/`（MANIFEST + SUMMARY）
- 完整哈希：见 `docs(S5): record baseline commit` 与 `git log`。