# SUMMARY — S5 阶段总结（L1 与前端浅层）

> 阶段：S5｜日期：2026-11-23｜结论：**G2 PASS，tag `s5-baseline`**
> 权威证据：`stages/S5/acceptance.md`、`test-report.md`、`plan-review.md`、`progress.md` 与 git tag。

## 1. 目标（SOLO S5）

L1 参数/实体字段、脱敏/截断；sourcemap；Vite/Vue 浅层插件；性能基线。
完成信号：`100→0` 在参数/字段层可见；前端行号/方法名可见（有 map/插件）。**不做 S6（L2/异步/×3）**。

## 2. 交付物

- demo `preview-discount`：requestedAmount 100、demoSecret 假值、note 3000 x；内存 `amount 100→0`，DB 仍 100。
- agent L1：5 项 values（param/param/param/field/return）、`L1` flag；`Order#setAmount` 字段 advice（防 MyBatis 0→100）；脱敏 `[REDACTED len=6]`、2KB 截断；不采局部变量；source 方法级缓存。
- collector graph 第 15 字段 `values`；workbench 详情显示 L1/old→new/脱敏/截断/source。
- `frontend/build-plugin` manifest 扫描 + 注入；SDK `source {file,line}` + `SOURCE_MAPPED`；demo `build.sourcemap`。
- 文档：api/event-model S5、`docs/guides/frontend-shallow-plugin.md`、S5 分发/计划/G1/测试/验收。

## 3. 证据

- 全量：`cd tools/verify && npm ci && node verify.mjs` → **70 PASS / 0 FAIL**，`S5 TEST (full S0–S5): PASS`，exit 0（source-cache + 标题修正后）。
- 浏览器：`evidence/workbench-s5-values.png`（L1 5 行、100→0、已脱敏、已截断、return 0、L1）；
  `evidence/workbench-s5-source.png`（js_method `src/App.vue:104（manifest 映射）`、SOURCE_MAPPED；service `OrderService.java:61`）。
- DB：preview-discount 后 amount 仍 100.0；raw s3cr3t 不在事件中；case A 0 行链不变。
- 冻结：S5 G1 18/18；schema/S0–S4 fixture 字节不变；S5 fixture 4/4 schema-valid。

## 4. 结果与限制

- 结果：L1 参数/字段/返回、脱敏/截断、manifest/sourcemap、S0–S4 回归均通过。
- **性能 WARN**：base p50 ~0.985ms/p95 ~1.818ms；agent p50 ~1.271ms/p95 ~2.143ms；ratio **1.29**，高于 1.25 目标。source 方法级缓存已加但仍超标；未降级/未造假，留待 S6 优化。
- 限制：manifest 仅函数级；L2/局部变量/异步/×3 属 S6；demo 前后端需同会话；preview-discount 未知 id 200 data 0；内存态；分支 `master`；本地回环；真实新手/视觉测试未做。
- 安全：无真实 secret/PII；SDK 不采表单值/cookie/query；无 CDN/镜像/遥测；collector/launcher 回环。

## 5. 下一步

S6：L2 行级局部变量、字段写入、异步上下文、运行时 ×3、预算/循环折叠（需新分发书）。
S7–S10 按 SOLO-PLAN；每阶段更新 `STAGE-PROGRESS.md` 并生成备份/tag。性能优化可作为 S6 的先行项。

## 6. 恢复

把本目录文件复制回仓库对应相对路径即可回看；阶段代码以 tag `s5-baseline` 为准。不要把快照当作新契约来源。