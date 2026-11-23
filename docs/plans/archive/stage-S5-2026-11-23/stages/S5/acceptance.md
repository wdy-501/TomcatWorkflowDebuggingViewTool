# S5 验收（G2）— L1 与前端浅层

> 日期：2026-11-23｜门禁：**G2: PASS**｜基线：tag `s5-baseline`（提交见文末）
> G1：`plan-review.md` PASS（1 轮返工）｜测试：`test-report.md`（S0–S5 70/70）

## 1. 结论

S5 在 S0–S4 之上交付了 **L1 参数/字段/返回**与**前端浅层 source 信息**，未越过 S6+ 边界：

- demo `preview-discount`：`amount 100→0` 仅在内存，DB 仍 100；agent 采 5 项 L1 values（requestedAmount 100、demoSecret 脱敏、note 2KB 截断、amount 字段 100→0、return 0），不采局部变量。
- collector graph 增加 `values`（15 字段）；workbench 详情显示 L1/脱敏/截断/old→new/source。
- 前端浅层插件生成函数 manifest；SDK `wrapFn` 写入 `source {file,line}` + `SOURCE_MAPPED`；demo 开启 sourcemap。浏览器实测 `OrderEdit.vue#previewDiscount` 详情显示 `src/App.vue:104（manifest 映射）`。
- 真实缺陷/风险：L1 perf ratio **1.29** > 1.25 目标，如实记为 **WARN**（source 方法级缓存已加，仍超标）；未伪造达标。

**S5 到此停止；S6（L2/异步/×3）需要新的分发书。**

## 2. G2 复核清单

| 项 | 结果 | 证据 |
|---|---|---|
| 全量门禁 | **70 PASS / 0 FAIL**，`S5 TEST (full S0–S5): PASS`，exit 0 | `cd tools/verify && node verify.mjs`（source-cache + 标题修正后） |
| S5-A build | PASS | SDK 17 tests/3 dist；build-plugin 6 tests；demo manifest/sourcemap；workbench；root；demo；agent 52 |
| S5-B demo | PASS | preview-discount 200 `{"data":0}`；DB amount 100；未知 999→200/0；案例 A 200/CREATED |
| S5-C L1 | PASS | service values 恰 5：100 / `[REDACTED len=6]` / 2048 截断 / 100→0（一次）/ return 0；L1；无 local；无 raw secret；case A 4 span 无 values |
| S5-D values/workbench | PASS | graph 15 字段/values；requests/replay 不变；workbench Values/100→0/已脱敏/已截断/L1/source；无旧 S5 文案 |
| S5-E manifest/source | PASS | manifest 与源码行一致；inline manifest + `.js.map`；SDK SOURCE_MAPPED；无 CDN/外部脚本 |
| S5-F perf | WARN | base p50 ~0.985ms/p95 ~1.818ms；agent p50 ~1.271ms/p95 ~2.143ms；ratio **1.29**（>1.25；report-only） |
| S5-G regression | PASS | S0–S4 61 项回归全 PASS；hello 非事件；schema/S0–S4 fixture 不变；S5 G1 冻结 18/18 |
| S5-H scope/cleanup | PASS | 无 S6+；无 secret/CDN/mirror；端口/进程清理；git index 未动；39 项白名单 |
| 浏览器 values | PASS | `evidence/workbench-s5-values.png`：service L1 5 行、100→0 高亮、已脱敏、已截断、return 0、L1 |
| 浏览器 source | PASS | `evidence/workbench-s5-source.png`：js_method source `src/App.vue:104（manifest 映射）`、SOURCE_MAPPED；service `OrderService.java:61` |

## 3. 范围、安全与漂移

- **未做**：L2/局部变量、异步上下文、运行时 ×3（S6）；Tomcat/WAR、React、云端、SSE/WS、像素回放、持久化。
- 无真实 secret/PII；demoSecret/note 为演示假值；SDK 不采表单值/cookie/query；collector/launcher 回环。
- schema 字节不变；S0–S4 fixture 未变；S5 G1 冻结 18/18；S5 fixture 4/4 schema-valid。

## 4. 已知限制（不阻断 S5）

1. L1 perf ratio 1.29，超 1.25 目标（WARN；source 方法级缓存已加，仍超标）。
2. manifest 仅函数级 file/line；局部变量/L2/异步/×3 属 S6；sourcemap 为构建产物，不承诺跨构建稳定。
3. demo 前后端需同会话（前端 `s_s3demo`，后端 agent 也需 `s_s3demo`）；否则显示 LOST。
4. `preview-discount` 是演示接口，未知 id 也 200 `data:0`；不入 collector 路由。
5. collector/H2 内存态，重启清空；无鉴权/保留/淘汰。
6. 真实新手/视觉/用户测试未做；分支 `master`；本地回环。

## 5. 基线记录

- 提交：`feat(S5): L1 values and frontend shallow source — 100→0, redaction/truncation, manifest, perf baseline`（哈希见 `progress.md`/git log）。
- tag：`s5-baseline`｜阶段备份：`docs/plans/archive/stage-S5-2026-11-23/`（MANIFEST + SUMMARY）。
- 下一步：S6（L2/异步/×3、预算；需新分发书）。