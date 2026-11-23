# S6a 测试报告（独立 E2E，S6 仍 partial）

> 日期：2026-11-23｜范围：S6a 行级局部变量 + ×3｜结论：**S6a E2E PASS**（S6 未验收、未打 tag）
> G1：`plan-review-s6a.md` PASS（B1–B9 门禁迁移已补齐）｜全量门禁迁移：待 S6b/最终测试统一执行

## 1. 环境与命令

- JDK8 demo / JDK21 agent+collector+workbench；Node 22；端口 8080/8601。
- 独立 E2E（主协调执行，非编码师自证）：`node work/s6a-check.mjs`。
- 工作台：`cd workbench && npm ci && npm run build`（exit 0）。

## 2. E2E 证据

```text
S6A_EVIDENCE:
{
  "reconcile":[100,0,100],
  "amount":100,
  "counts":{"total":4,"l2":3,"controller":true},
  "returns":[100,0,100],
  "valueCounts":[1,2,1],
  "second":[
    {"name":"local","kind":"local","line":23,"from":null,"to":100,"invocation":2},
    {"name":"local","kind":"local","line":25,"from":100,"to":0,"invocation":2}
  ],
  "cancelSpans":4,
  "l1Values":5
}
S6A PASS
```

- `POST /api/orders/1/reconcile` → `[100.0,0.0,100.0]`；DB amount 仍 100。
- 一次请求 4 spans：controller + 3× `L2DemoService#reconcileAmount`（同 nodeKey，parent=controller）。
- 3 次 returns = 100/0/100；每次 local values = 1/2/1；第 2 次 `line 23 null→100`、`line 25 100→0`；L2 flag。
- 回归：case A cancel 4 spans/SQL 0；L1 preview-discount 5 values 仍存在。
- 无 VerifyError；ASM shaded/relocated，agent major 52（编码师证据）。

## 3. 工作台静态证据

`workbench/dist/assets/index-*.js` 含：`s6-l2-badge`、`s6-l2-note`、`data-value-kind`、`data-invocation-diff`、`行号 `、`100 → 0`、`值变化`；S5/S4/S3 选择器保留（编码师报告）。dist 只证明静态 token；第 2 次高亮条件性由运行时 values + 浏览器/DOM 证明（S6 最终验收补浏览器截图）。

## 4. 未完成 / 风险（S6 partial）

1. **S6b 未做**：异步上下文、无调试信息、预算/循环折叠、L2 性能；S6 不能验收/tag。
2. 全量 `node verify.mjs` 的 S6a 门禁迁移（S5_G1_FREEZE supersede、S3-1 tokens、L2 allowlist、S4-I/S5-H 白名单）已写入计划，尚未落地到 verifier；最终 S6 测试统一执行。
3. 浏览器 L2/×3 高亮尚未实测；S6 最终验收补。
4. ASM 9.7 shaded；若后续 JDK/class 变化需回归；当前 demo 无 VerifyError。
5. LVT 行号依赖 demo 编译（`local` Start 3 Slot 6）；行 23/25 为当前源码行，重排源码会漂移，测试从 LVT/字节码重算。

## 5. 下一步

S6b：异步上下文（新线程继承，线程池/CompletableFuture 限制如实标注）、无调试信息（NoDebugService 无 LVT → `NOT_COLLECTED_NO_DEBUG_INFO` + reason，不猜）、预算/循环折叠（L2 values cap/first-last-sample + `VALUES_CAPPED`）、L2 性能基线；随后 S6 最终测试、浏览器、验收、备份、tag `s6-baseline`。