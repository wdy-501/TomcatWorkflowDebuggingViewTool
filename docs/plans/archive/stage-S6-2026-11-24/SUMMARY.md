# SUMMARY — S6 阶段总结（L2 与异步）

> 阶段：S6｜日期：2026-11-24｜结论：**G2 PASS，tag `s6-baseline`**
> 权威证据：`stages/S6/acceptance.md`、`test-report.md`、`plan-review-s6a/s6b.md`、`progress.md` 与 git tag。

## 1. 目标（SOLO S6）

L2 行级局部变量、×3、异步上下文、预算/循环折叠；完成信号：行级 100→0、×3 能指哪次坏、缺调试信息不猜。

## 2. 交付物

- S6a：`L2DemoService#reconcileAmount` ASM 行探针（LVT `local`），`reconcileBatch` 3 次调用；第 2 次 `local 100→0`（行 23/25），工作台 ×3 可指第 2 次；DB 不变。
- S6b：
  - `reconcileAsync`：per-request 单线程池 + `InheritableThreadLocal` 深拷贝；3 个 L2 span 同 trace/parent，`ASYNC_INHERITED`；长生命周期池/@Async/CompletableFuture 不自动传播（明示）。
  - `NoDebugService#compute`：antrun `debug=false` 无 LVT → `NOT_COLLECTED_NO_DEBUG_INFO` + reason，无 values/行号。
  - `reconcileLoop`：100 次 local 写入，L2Values cap 20（首尾/样本），`TRUNCATED`、`VALUES_CAPPED=82`/`VALUES_TOTAL=102`，坏 `50→0` 保留。
  - L2 perf：ratio **1.037**。
- 契约/API：S6a/S6b 增补、graph 15 字段、values local/line、async/no-debug/fold；schema 不变。
- 工作台：S6 L2/×3/ASYNC/NO_DEBUG/fold UI；S0–S5 选择器保留。

## 3. 证据

- 全量：`cd tools/verify && npm ci && node verify.mjs` → **75 PASS / 0 FAIL**，`S6 TEST (full S0–S6): PASS`，exit 0。
- 独立 E2E：`node work/s6a-check.mjs` / `node work/s6b-check.mjs` → PASS；DB amount 100。
- 浏览器：`evidence/workbench-s6b-async.png`（L2+ASYNC，第 2 次 100→0）、`workbench-s6b-no-debug.png`（状态/原因/无 values）、`workbench-s6b-loop.png`（已折叠 82/102、坏 50→0）。
- 冻结：S6A 8/8、S6B 14/14；S5/S6a 未变文件冻结；schema/S0–S5 fixture/transport/status 字节不变。

## 4. 结果与限制

- 结果：行级 100→0、×3 定位、异步继承、无调试信息不猜、循环折叠、L2 perf 全部通过；S0–S5 无回归。
- 限制：异步仅新建线程创建时继承；L2 仅 selected methods（无行级字段写入/对象深采/多方法）；no-debug 仅 NoDebugService；loop 折叠保留样本非全量；perf 为本地短请求基线；真实新手/视觉测试未做；分支 master；内存态；本地回环。
- 安全：无 secret/PII/CDN/镜像；error envelope 不回显；collector/launcher 回环。

## 5. 下一步

S7：第二栈（Tomcat WAR/SSM 或 React/Webpack 二选一；需新分发书）。
S8–S10 按 SOLO-PLAN；每阶段更新 `STAGE-PROGRESS.md` 并生成备份/tag。

## 6. 恢复

把本目录文件复制回仓库对应相对路径即可回看；阶段代码以 tag `s6-baseline` 为准。不要把快照当作新契约来源。