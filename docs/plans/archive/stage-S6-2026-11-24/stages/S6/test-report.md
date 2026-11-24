# S6 测试报告（最终）

> 日期：2026-11-24｜范围：S6a 行级 L2/×3 + S6b 异步/无调试/循环折叠/性能｜结论：**S6 TEST PASS**
> 全量：`cd tools/verify && npm ci && node verify.mjs` → **75 PASS / 0 FAIL**，`S6 TEST (full S0–S6): PASS`，exit 0。

## 1. S6a：行级局部变量 + ×3

独立 E2E：`node work/s6a-check.mjs` → `S6A PASS`
- `POST /api/orders/1/reconcile` → `[100,0,100]`；DB 仍 100。
- 一次请求 controller + 3× `L2DemoService#reconcileAmount`；returns 100/0/100；values 1/2/1；第 2 次 `line23 null→100`、`line25 100→0`；flags L2；无 VerifyError。
- 门禁：`--s6a=A..E` PASS；S6A_G1_FREEZE 8/8。

## 2. S6b：异步 / 无调试 / 折叠 / 性能

独立 E2E：`node work/s6b-check.mjs` → `S6B PASS`
```text
async=[100,0,100]; 3 L2 spans; asyncValues=1/2/1; ASYNC_INHERITED; worker thread≠controller
noDebug=200; status=NOT_COLLECTED_NO_DEBUG_INFO; reason=LocalVariableTable missing; NO_DEBUG_INFO; no values
loop=50; status=TRUNCATED; 20 values; VALUES_CAPPED=82; VALUES_TOTAL=102; bad 50→0 kept
DB amount=100
```
性能：`node tools/perf/l2-overhead.mjs` → base p50 0.926ms/p95 1.439ms；agent p50 0.960ms/p95 1.586ms；**ratio 1.037**（<1.40 目标，无 WARN）。

浏览器（`docs/plans/stages/S6/evidence/`）：
- `workbench-s6b-async.png`：L2 + `ASYNC_INHERITED`，第 2/3 次 `100 → 0`（行 29/31），worker `pool-1-thread-1`。
- `workbench-s6b-no-debug.png`：`NOT_COLLECTED_NO_DEBUG_INFO`、reason、`NO_DEBUG_INFO`、无 values。
- `workbench-s6b-loop.png`：`TRUNCATED`、20 values、`已折叠 82 次（VALUES_CAPPED=82；共 102 次）`、坏 `50→0` 保留。

## 3. 全量门禁（75 项）

覆盖：S0 契约/fixture；S1 ingest/查询；S2 H2 0 行/4-span；S3 SDK/案例 B/EXACT/replay 0 写；S4 launcher/握手/preview/详情×N；S5 L1/values/manifest；S6a 行级/×3；S6b async/no-debug/loop/perf；S0–S6 回归、scope/security/cleanup/freeze。
- S6B_G1_FREEZE 14/14；S5/S6a 未变文件冻结；schema/S0–S5 fixture/transport/status 字节不变。
- 端口/进程清理；git index 未动；仅本地回环；无 secret/CDN/镜像。
- 门禁迁移（S5/S6a copy/hash/count/whitelist）已完成；最终标签 `S6 TEST (full S0–S6)`。

## 4. 已知限制（不阻断 S6）

1. 异步只保证**新建线程创建时**通过 `InheritableThreadLocal` 继承；长生命周期线程池、`@Async`、`CompletableFuture` 不自动传播（UI/契约明示）。
2. L2 只对 `L2DemoService#reconcileAmount`/`reconcileLoop` 选中方法；行级字段写入、对象深采、多方法 L2 未支持（S6 范围外）。
3. no-debug 演示只覆盖 `NoDebugService#compute`（antrun `debug=false`）；其他无 LVT 类按同一规则跳过。
4. loop 折叠 cap 20（首 6 + 尾 6 + 8 样本），`20 + VALUES_CAPPED = VALUES_TOTAL`；不保留全部值。
5. perf 为本地短请求基线，不代替 JMH/长期压测。
6. 真实新手/视觉/用户测试未做；分支 `master`；本地回环；collector/H2 内存态。

## 5. 复现

```bash
node work/s6a-check.mjs
node work/s6b-check.mjs
node tools/perf/l2-overhead.mjs
(cd "tools/verify" && npm ci && node verify.mjs)
```