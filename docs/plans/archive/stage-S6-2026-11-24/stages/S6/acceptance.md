# S6 验收（G2）— L2 与异步

> 日期：2026-11-24｜门禁：**G2: PASS**｜基线：tag `s6-baseline`（哈希见 progress/git log）
> G1：`plan-review-s6a.md` PASS、`plan-review-s6b.md` PASS｜测试：`test-report.md`（75/75）

## 1. 结论

S6 在 S0–S5 之上交付了 **L2 行级局部变量、×3 逐次、异步继承、无调试信息、循环折叠与 L2 性能**，并保持 S0–S5 无回归：

- S6a：`order.reconcile` 3 次调用同 nodeKey；第 2 次 `local 100→0`（行 23/25）；工作台 ×3 可指第 2 次；DB 不变。
- S6b：`reconcile-async` 3 个 L2 span 同 trace/parent，`ASYNC_INHERITED`，worker 线程≠controller；`no-debug` 状态 `NOT_COLLECTED_NO_DEBUG_INFO` + reason + 无 values；`reconcile-loop` `TRUNCATED`、20 values、`VALUES_CAPPED=82`/`VALUES_TOTAL=102`、坏 `50→0` 保留。
- 性能：L2 ratio **1.037**（<1.40 目标）。
- 全量 `node verify.mjs` = **75 PASS / 0 FAIL**，`S6 TEST (full S0–S6): PASS`。

**S6 到此停止；S7（第二栈：Tomcat WAR/SSM 或 React/Webpack）需要新的分发书。**

## 2. G2 复核清单

| 项 | 结果 | 证据 |
|---|---|---|
| 全量门禁 | **75/75 PASS**，exit 0 | `node verify.mjs`（2026-11-24） |
| S6a 行级/×3 | PASS | `work/s6a-check.mjs`；values 1/2/1；第 2 次 100→0 行 23/25 |
| S6b async | PASS | `work/s6b-check.mjs`；3 spans/ASYNC_INHERITED/worker 49≠controller |
| no-debug | PASS | status/reason/NO_DEBUG_INFO/no values；antrun 无 LVT |
| loop fold | PASS | 20 values；VALUES_CAPPED=82/TOTAL=102；bad 50→0 |
| L2 perf | PASS | ratio 1.037（report-only，1.40 WARN 未触发） |
| 工作台 | PASS | `workbench-s6b-{async,no-debug,loop}.png`；S6a/S5/S4/S3 选择器保留 |
| 回归/冻结 | PASS | S0–S5 61 项 priorFailed=none；S6A/G1 8/8、S6B 14/14；schema/S0–S5 fixture 不变 |
| scope/security | PASS | 无 S7+；无 secret/CDN/镜像；回环；端口/进程清理；git index 未动 |

## 3. 范围与安全

- 未做：Tomcat/WAR/SSM、React/Webpack、云端、SSE/WS、像素回放、持久化、外部 DB；L2 不覆盖行级字段写入/对象深采/多方法。
- 异步仅新建线程创建时继承；长生命周期池/`@Async`/`CompletableFuture` 明示不支持。
- 无真实 secret/PII；SDK 不采表单值/cookie/body；collector/launcher 回环。

## 4. 已知限制（不阻断 S6）

1. 异步/NoDebug/Loop 均为 selected-method demo；不代表任意方法自动 L2。
2. no-debug 依赖 antrun/javac `debug=false`；Ant 依赖需 Maven Central。
3. loop 折叠保留首/尾/样本，不保留全部值；`status=TRUNCATED` 表示折叠非失败。
4. perf 为本地短请求基线，不代替 JMH。
5. 真实新手/视觉/用户测试未做；分支 `master`；内存态；本地回环。

## 5. 基线记录

- 提交：`be2f7d5` `feat(S6): L2 locals, async inheritance, no-debug info and loop folding`。
- tag：`s6-baseline`｜备份：`docs/plans/archive/stage-S6-2026-11-24/`（MANIFEST + SUMMARY）。
- 下一步：S7（Tomcat WAR/SSM 或 React/Webpack 二选一；需新分发书）。