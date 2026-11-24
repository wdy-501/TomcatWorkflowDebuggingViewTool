# S6b 测试报告（独立 E2E + 性能；S6 仍 partial）

> 日期：2026-11-24｜范围：S6b 异步上下文 / 无调试信息 / 循环折叠 / L2 性能｜结论：**S6b E2E PASS**（S6 未验收、未打 tag）
> G1：`plan-review-s6b.md` PASS｜全量统一门禁迁移：仍需完成（当前 `verify.mjs` 的 18 个 S5/S6a copy/hash/count/whitelist 门禁未迁移到 S6b）

## 1. 独立 E2E（主协调执行）

命令：`node work/s6b-check.mjs`（collector+demo+agent，JDK8/JDK21，session `s_s6b_check`）

```text
S6B_EVIDENCE:
{
  "async":[100,0,100],
  "noDebug":200,
  "loop":50,
  "counts":{"total":8,"async":3,"noDebug":1,"loop":1},
  "asyncReturns":[100,0,100],
  "asyncValueCounts":[1,2,1],
  "asyncParent":true,
  "threads":[49,49,49],
  "noDebugSpan":{
    "status":"NOT_COLLECTED_NO_DEBUG_INFO",
    "reason":"LocalVariableTable missing",
    "flags":["S2_ZERO_ROW_CHAIN","NO_DEBUG_INFO","DROP_COUNT=0"],
    "hasValues":false
  },
  "loopSpan":{"status":"TRUNCATED","values":20,"cap":"VALUES_CAPPED=82","total":"VALUES_TOTAL=102","bad":true},
  "amount":100
}
S6B PASS
```

- async：`reconcile-async` 返回 `[100.0,0.0,100.0]`；3 个 L2 span 同 trace/parent=controller，worker 线程 49 ≠ controller，flags `ASYNC_INHERITED`，values 1/2/1。
- no-debug：`/no-debug` 返回 200.0；span `NOT_COLLECTED_NO_DEBUG_INFO`、reason `LocalVariableTable missing`、`NO_DEBUG_INFO`、无 `values`、无伪造行号。
- loop：`/reconcile-loop?times=100` 返回 50.0；status `TRUNCATED`、20 values、`VALUES_CAPPED=82`/`VALUES_TOTAL=102`、bad `50→0` 保留。
- DB amount 仍 100；case A/L1/S6a 未回归（编码师同轮验证）；collector 停后端点 fail-open 200。

## 2. L2 性能（report-only）

命令：`node tools/perf/l2-overhead.mjs`（reconcile，N=100，warmup 20，3 rounds）

```text
base : p50 0.926ms / p95 1.439ms
agent: p50 0.960ms / p95 1.586ms
ratio: 1.037（< 1.40 目标；WARN 未触发）
```

## 3. 构建/工件（编码师证据，待最终门禁复跑）

- agent major 52，ASM shaded/relocated；`L2DemoService` LVT 仍在；`NoDebugService` 无 LVT/LineNumberTable/SourceFile；antrun `debug=false` 生效。
- workbench build 通过；dist 含 async/no-debug/fold 静态 token，S6a/S5/S4/S3 选择器保留。
- 浏览器 async/no-debug/fold 条件性尚未实测；S6 最终验收补。

## 4. 未完成 / 风险（S6 partial）

1. 全量 `verify.mjs` 尚未迁移 S6b：当前 18 个失败为 S5/S6a copy/hash/count/whitelist 过期，不是产品失败；需按 `s6b-plan §10` 迁移并新增 S6B-A..F。
2. S6 未验收、无 `s6-baseline`、无阶段备份；S6a/S6b 只提交 partial commit。
3. InheritableThreadLocal 仅在**线程创建时**继承；长生命周期池/`@Async`/`CompletableFuture` 不自动传播（已明示，不宣称）。
4. NoDebugService 依赖 antrun/javac `debug=false`；环境无 Ant 时构建会失败（需 Maven Central 依赖）。
5. perf 为本地短请求基线，不代替 JMH/长期压测。

## 5. 下一步

迁移统一门禁 + S6B-A..F → 全量 S0–S6 PASS → 浏览器 async/no-debug/fold → S6 最终验收、阶段备份、tag `s6-baseline`。