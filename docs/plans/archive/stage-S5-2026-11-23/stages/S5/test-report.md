# S5 测试报告（Final：全量 S0–S5）

- 阶段：S5 L1 值与字段 diff + 前端浅层 manifest
- 结论：**S5 TEST: PASS**（全量 `checks: 70 PASS / 0 FAIL (total 70)`，连续两次全量 run 均为 PASS / exit 0）
- 依据：`docs/plans/stages/S5/s5-plan.md`、`plan-review.md`（G1: PASS）、`test-report-part1.md`（S5-BUILD/A/B/C）、`test-report-part2.md`（S5-D/E/F/G/H + 迁移 + 性能脚本）
- 本报告只做汇总与最终全量验证；A–H 的逐条证据详见 part1 / part2。

## 1. 环境

| 项 | 值 |
| --- | --- |
| OS | Windows_NT 10.0.29708 x64（win32，Git Bash） |
| Node / npm | v22.22.2 / 10.9.7 |
| JDK21 | `java version "21" 2023-09-19 LTS`（root reactor 用） |
| JDK8 | `java version "1.8.0_221"`（demo backend 用） |
| Maven | Apache Maven 3.9.5（默认 JAVA_HOME=JDK8，JDK21 单独指定） |
| 仓库 | `D:\Qoder 高校创造力大赛\TomcatWorkflowDebuggingViewTool`（路径含中文+空格，全程引号） |

## 2. 命令

```bash
# 全量（S0–S5，权威口径；本次最终验收跑了两遍）
cd tools/verify && node verify.mjs

# 证据落盘（stdout 末尾一行 VERIFY_JSON，含 results/verdict/perf 证据）
cd tools/verify && node verify.mjs --json

# 单段复跑（S5-only：只跑 V0 + S5-BUILD + 选中 A..H；G 的 S0–S4 锚点会被显式 deferred）
cd tools/verify && node verify.mjs --s5=A,B,C,D,E,F,G,H

# 旧门禁迁移/排障
cd tools/verify && node --check verify.mjs
```

全量 run 日志保存在 `tools/verify/full-run-{1..4}.log`（run 3 / run 4 为最终两次连续 PASS）。

## 3. S5-A..H 结果

全量 run 中 9 个 S5 检查项（S5-BUILD + A..H）全部 PASS：

| 门禁 | 结果 | 关键证据（全量 run 4） |
| --- | --- | --- |
| S5-BUILD | PASS | root reactor(JDK21) + demo backend(JDK8) 构建 OK，agent class major 52 |
| S5-A | PASS | SDK 17/17 tests + 3 个 dist 文件；build-plugin 6/6（零依赖）；demo manifest/.map/inline；workbench build OK |
| S5-B | PASS | demo `POST /api/orders/{id}/preview-discount` → 200 `{"data":0}`，DB amount 仍 100（无写入）；未知 id 也 200/0；case A 不变 |
| S5-C | PASS | 2 spans（controller+service，mapper 不插桩）；5 个精确值（100 / `[REDACTED len=6]` / 2048 截断 / 100→0 / return 0）；flags 含 `L1` 无 `L2`/`kind=local`；traceparent/click 精确 join |
| S5-D | PASS | fixture 4 events 过冻结 AJV schema（strict）；graph 4 节点/3 边，每节点恰好 15 个有序字段（`values` 第 15，其余 null 从不 `[]`）；service 5 值 verbatim；S4 fixture `values:null`；requests/replay/meta 不变；workbench S5 详情 UI + S0–S4 选择器无回归、无陈旧文案 |
| S5-E | PASS | demo manifest 6/6 函数与源码重扫逐字相等（file/line 重算、排序、去重）；dist `index.html` 内联 manifest 与资产内容完全一致；仅 demo 产出 1 个 `.js.map`（665.48 kB），workbench/SDK dist 无 map |
| S5-F | PASS | perf 脚本 exit 0，base/agent 各 100×3（warm-up 20），agent events>0，ratio>1.25 仅 WARN、无硬阈值（report-only） |
| S5-G | PASS | 全量回归：61 个前置检查全 PASS（`priorFailed=none`），S4-H 锚点齐全；S0–S5 fixture 21/21 字节不变；S5 G1 冻结 18/18 哈希一致；G1: PASS |
| S5-H | PASS | 无 S6+ 能力（L2/local、async、×3、SSE/WS、持久化、像素回放、.map 解码上传、Tomcat/WAR、云、React）；仅 demo 有 map（1：0）；preview 仍只注入 4 个外部 `<script src>`，CSP 未改；collector 仍 9 条业务路由；无 secret/CDN/mirror；端口全空、无残留、git 未触碰 |

## 4. 全量结果与稳定性

| run | 时间窗（UTC） | 结果 | 判定 |
| --- | --- | --- | --- |
| 3（最终第 1 次） | 13:20:22 → 13:23:40 | `checks: 70 PASS / 0 FAIL (total 70)` | `S5 TEST (full S0–S5): PASS`，exit 0 |
| 4（稳定性第 2 次） | 13:24:01 → 13:27:21 | `checks: 70 PASS / 0 FAIL (total 70)` | `S5 TEST (full S0–S5): PASS`，exit 0 |

全量 70 项构成：V0–V8 基础门禁 22、S1 8、S2 11、S3 10、S4 10（含 S4-BUILD/A–I）、S5 9（S5-BUILD/A–H）。run 4 的 `VERIFY_JSON.verdict = PASS`，`results` 数组 70 条全部 `ok:true`。

### 4.1 本次为跑通全量所做的测试侧修改（未放宽任何产品断言）

| 位置 | 问题 | 修复（仅测试侧） |
| --- | --- | --- |
| `V6d`（外部 CDN/资产扫描） | demo 构建新增 `.js.map`，其 `sourcesContent` 含 Vue/Vite 上游文档 URL（link.vuejs.org、cli.vuejs.org、github.com/vitejs/…），被运行时 URL 扫描误判 | `*.map` 从运行时 URL/资产扫描中排除；另加“map 内不得出现 CDN 主机”的独立断言（仍然禁止 unpkg/jsdelivr/cdnjs/gfonts/npmmirror/aliyun） |
| `S2-8`（agent shop 类常量） | 产品重构为 `MAPPER_CLASS + "#" + MAPPER_METHOD` 后，期望列表里的 `com.example.shop.mapper.OrderMapper.cancelById` 已不存在 | 期望列表改为实际的 4 个类常量（controller/mapper/model/service）；“mapper 过滤仅 cancelById”单独断言保留 |
| S5-A/D 的 `npm ci` | Windows 偶发 `EPERM errno -4048`（无法 unlink `node_modules/@esbuild/win32-x64/esbuild.exe`），残留半装目录导致后续 build exit=1 | 新增 `s5NpmCi()`：8 次尝试、5s 退避、每次前 `taskkill /F /T /IM esbuild.exe`；仅针对瞬时 EPERM/EBUSY 重试，门禁仍是 `exit 0` 严格判定 |
| `verify.mjs` 用法注释 | S5-only 说明仍写 “D..G pending” | 改为 `A,B,C,D,E,F,G,H`，并注明 G 的 S0–S4 锚点需全量 run |

S3-6/S3-7/S3-8/S3-10、S4-H、S4-I 的迁移已由 part 2 完成并通过；S5-G 早期失败（run 1/2）纯属上述门禁的级联（`priorFailed=V6d,S2-8,S3-8` / `S5-A,S5-D`），修复后即 PASS，冻结与 fixture 本身在失败时也已是 18/18、21/21。

## 5. 性能基线（report-only，只打 WARN 不判失败）

设计见 s5-plan §8：agent 侧 L1 开销为“报告项”，ratio>1.25 只加 `warn` 标签，无 FAIL 阈值。

全量 run 3（`PERF_RESULT` @ 2026-11-23T13:23:38.666Z）：

```json
{"script":"tools/perf/l1-overhead.mjs","n":100,"warmup":20,"rounds":3,"port":8080,"collectorPort":8601,
 "base":{"rounds":[{"n":100,"p50Ms":1.291,"p95Ms":2.11},{"n":100,"p50Ms":1.013,"p95Ms":1.686},{"n":100,"p50Ms":0.946,"p95Ms":1.363}],"samples":300,"p50Ms":1.013,"p95Ms":1.686,"events":0},
 "agent":{"rounds":[{"n":100,"p50Ms":1.642,"p95Ms":2.457},{"n":100,"p50Ms":1.401,"p95Ms":2.203},{"n":100,"p50Ms":1.23,"p95Ms":1.95}],"samples":300,"p50Ms":1.401,"p95Ms":2.203,"events":49},
 "ratio":1.383,"warn":"l1_overhead_ratio>1.25","threshold":"none; 1.25 is a WARN label only (report-only)","reportOnly":true}
```

全量 run 4（`PERF_RESULT` @ 2026-11-23T13:27:19.488Z）：

```json
{"script":"tools/perf/l1-overhead.mjs","n":100,"warmup":20,"rounds":3,"port":8080,"collectorPort":8601,
 "base":{"rounds":[{"n":100,"p50Ms":1.39,"p95Ms":2.401},{"n":100,"p50Ms":1.05,"p95Ms":1.716},{"n":100,"p50Ms":0.967,"p95Ms":1.362}],"samples":300,"p50Ms":1.05,"p95Ms":1.716,"events":0},
 "agent":{"rounds":[{"n":100,"p50Ms":1.525,"p95Ms":2.548},{"n":100,"p50Ms":1.38,"p95Ms":2.029},{"n":100,"p50Ms":1.186,"p95Ms":2.039}],"samples":300,"p50Ms":1.38,"p95Ms":2.039,"events":49},
 "ratio":1.314,"warn":"l1_overhead_ratio>1.25","threshold":"none; 1.25 is a WARN label only (report-only)","reportOnly":true}
```

（aggregate p50/p95 取三轮中位数；ratio = agent p50 / base p50。run 3：1.401/1.013=1.383；run 4：1.38/1.05=1.314。）

| 口径 | base p50/p95 (ms) | agent p50/p95 (ms) | ratio | 标注 |
| --- | --- | --- | --- | --- |
| part 2 独立 run | 1.024 / 1.777 | 1.377 / 2.148 | **1.345** | `l1_overhead_ratio>1.25`（WARN） |
| 全量 run 3 | 1.013 / 1.686 | 1.401 / 2.203 | 1.383 | WARN |
| 全量 run 4 | 1.050 / 1.716 | 1.380 / 2.039 | 1.314 | WARN |

如实记录：**L1 开销约 1.31–1.51×（基准口径 1.345），超过规划中 25% 的目标**；按 s5-plan §8 该指标为 report-only，不构成门禁失败，作为已知限制列入 §9。历史三次独立测得的 ratio 区间 1.197 / 1.507 / 1.345 说明测量抖动较大，趋势需在 S6 前后复测。perf 结束后 8601/8080 均已释放（`8601=0 8080=0`，单次 14.2–14.3s）。

## 6. manifest / sourcemap 证据

- `frontend/sdk`：`npm ci + build + test` → **17 tests / 17 pass / 0 fail**（含 inline manifest / fallback / 坏 manifest 用例）；dist 恰好 3 个文件（`index.d.ts`、`index.js`、`traceboard-sdk.iife.js`），无 `.map`、无 manifest 资产。
- `frontend/build-plugin`（`@traceboard/vite-plugin`）：ESM、`node --test`、**零 dependencies/devDependencies**，`npm test` → **6 tests / 6 pass / 0 fail**（R1/R2 规则、行号、排序、去重、空目录、dev 200/405/500、build 钩子）。
- demo frontend：`npm run build`（vue-tsc + vite + traceboardShallow + sourcemap）exit 0，产出 `assets/index-cvY5X9af.js` 87.87 kB + `index-cvY5X9af.js.map` 665.48 kB。
- `dist/traceboard-manifest.json` 6/6 函数（全部 `src/App.vue`）：`loadOrders:35`、`cancelOrder:51`、`rawValidateForm:78`、`validateForm:93`、`saveB:95`、`previewDiscount:104` —— 与对 `src` 重新执行 R1/R2 扫描结果逐字相等（file/line 重算、排序、去重）。
- `dist/index.html` 内联 `window.__TRACEBOARD_MANIFEST__`，内容与 manifest 资产完全一致（构建期一次性内联）；运行时 preview/diagnose 注入仍是 4 个外部 `<script src>`（`/traceboard/config.js`、`/traceboard/sdk.js` 各 2 处），CSP 未放宽。
- 边界：workbench 与 SDK dist 无 map；全仓仅 demo 构建产出 1 个 map（S5-H 断言 `1 demo map(s), 0 outside`）。

## 7. 冻结哈希（S5 G1，18/18 一致）

| 文件 | SHA-256 |
| --- | --- |
| `schema/traceboard.event.v1.json` | `927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a` |
| `docs/contracts/api.v1.md` | `c95022d1d3e7c732d4ace6f519d245ffacb5179568a3ed3a60c39d73b78d5aa5` |
| `docs/contracts/transport.v1.md` | `44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe` |
| `docs/contracts/event-model.v1.md` | `2a7fa58a1ab56cb10eeab98e8e084da401aa1b09cc4e32d19e40578d4c290706` |
| `docs/contracts/status-semantics.md` | `9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56` |
| `docs/guides/local-launcher.md` | `34efa2f67dadb9ce0725b7c38f9434fc10653cd27a7128c62319b01aa253ade1` |
| `fixtures/s4-details/events.ndjson` | `75274346ed7593f2aef304d2d7a0989d969e1fdcea4330169422a4cff89d853b` |
| `fixtures/s4-details/expected-facts.json` | `61c2bfcc79a7a568b03cc759445495a0671ad517be2d2ea1db3a410649117980` |
| `fixtures/s4-details/README.md` | `b4f838500bac3970581b133e47c3bf08b57e6f49220147f4418f70c2a51a8f8a` |
| `docs/plans/stages/S4/s4-plan.md` | `9147ce254bd8bc6e861433e02226aac87e65a6fcd7a8df3e1ec7477ff11b2300` |
| `docs/plans/stages/S4/dispatch.md` | `9dd9809f4c02bc10739e2eb9c6359fa95aef54872de3ddd87d7bb194312951eb` |
| `docs/plans/stages/S4/dispatch-amendment-01.md` | `e6097f63c1c3b6e5160b077c570292bef243dd2283267a2ff7e883a65a6d59dc` |
| `docs/guides/frontend-shallow-plugin.md` | `5be0e29312b827c9bc60c71d1674b977af54f9b9b6886684bce0875d10136b9b` |
| `fixtures/s5-l1-values/events.ndjson` | `9fc9a62e11e39c933a6695282f52ac79331a094070aa2a85f5ea25b878c6126b` |
| `fixtures/s5-l1-values/expected-facts.json` | `705f5d12addf3756796cf13934f2d9cb49214ceeb8711a290e58534863c597f9` |
| `fixtures/s5-l1-values/README.md` | `94ddce605a5fb3fd9feaee6a5fe8d23e28c6987e49f912153a7be39ff1b80b20` |
| `docs/plans/stages/S5/s5-plan.md` | `11e7fa585504e9db74f4183c323c55409b1e1702c8f4308452e23371746dc5b1` |
| `docs/plans/stages/S5/dispatch.md` | `dd105631426c6c755b44f5c8952431829c0358e542e7320e57f9cd0813ec5fe9` |

（S4 的 `api.v1.md` / `event-model.v1.md` 在 S5 冻结表中被 S5 版本覆盖，故总数为 18；schema 自 S0 起未变。）

## 8. 清理与边界

- 端口 8601/8080/5173/5174/4173/4174/8602/18080 全部 `not LISTENING`；perf 结束即释放（`8601=0 8080=0`）。
- 无 java.exe / node 残留（按 run 前基线 pid 差集比对，`descendants=none`）；demo/collector/Vite/preview/stub 均被停止。
- git：index 未触碰（无 staged），工作区仅 S5 白名单 38 项（产品目录含 server/launcher + demo 前端 9 文件 + demo 后端 4 个 L1 文件 + S3/S4/S5 fixtures/guides/contracts/docs + frontend/build-plugin + tools/verify+perf），冻结路径零改动，193 个产品文件内容稳定。
- 安全/范围：S5 源码 88 文件无 S6+ 能力；preview 仅外部脚本、CSP 未动；loopback-only、无 TLS；无 secret/CDN/mirror（233 个 npm tarball 全走 registry.npmjs.org）；collector 仍恰好 9 条业务路由。

## 9. 已知限制

1. manifest 是“浅层”的：仅 Vue/Vite 单文件组件 → `{function,file,line}`（6 个函数），无组件树/导出分析，不含 L2（局部变量/表达式）信息。
2. `.js.map` 只是 demo 构建产物：仓库内不解码、不上传、不对外提供；为免误判已在 V6d 将其从运行时 URL 扫描中排除，并单独断言 map 内无 CDN 主机。
3. manifest 以构建期内联方式写入 demo `dist/index.html`（`window.__TRACEBOARD_MANIFEST__`）；运行时投递/预览仍是外部 `<script src>`，CSP 未放宽——但若未来接入严格 CSP 的宿主，内联段需改为外部资产。
4. demo 契约决定：未知订单 id 同样返回 200 `{"data":0}`，与合法“0 行”不可区分（s5-plan §4 明确接受，用于稳定复现 0 行链路）。
5. 性能未达目标：L1 开销 ratio 1.314–1.507（基准 1.345），超出 25% 目标；按 §8 仅 WARN、report-only，不阻断门禁，需在 S6 前后复测/优化。
6. 真实新人可用性与视觉回归未做：S5-D 只做静态 UI 文案/选择器 + fixture 图数据校验，没有真人上手测试、截图 diff 或跨浏览器验证。
7. Windows `npm ci` 的 `EPERM -4048` 是环境抖动而非产品缺陷，已用重试缓解；极端情况下仍可能重试耗尽（会如实 FAIL，而非跳过）。
8. S5-C 只有 controller/service 两个 span（mapper/SQL 不插桩）是 L1 边界设计，不是遗漏。

## 10. 结论

**S5 TEST: PASS** —— 全量 S0–S5 `70 PASS / 0 FAIL`，连续两次（run 3 / run 4）exit 0；S5-A..H 全部 PASS；S5-G 冻结 18/18、fixture 21/21、S0–S4 回归全绿；S5-H 无 S6+ 越界、无残留；性能为 report-only 且如实记录 WARN。未发现产品缺陷，无需 BLOCKED。

## 11. 复现

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool/tools/verify"
npm ci
node verify.mjs                                  # 全量 S0–S5（预期 70/70 PASS）
node verify.mjs --json                           # 同上 + VERIFY_JSON 证据
node verify.mjs --s5=A,B,C,D,E,F,G,H             # 只跑 S5（G 的 S0–S4 锚点 deferred）
node ../perf/l1-overhead.mjs                     # 独立 perf（report-only，输出 PERF_RESULT）
```

## 12. 参考

- `docs/plans/stages/S5/test-report-part1.md`：S5-BUILD / A / B / C 逐条证据、15 字段图迁移、SDK 13→17 测试、demo dist .map+manifest。
- `docs/plans/stages/S5/test-report-part2.md`：S5-D/E/F/G/H 逐条证据、独立 perf（ratio 1.345）、旧门禁迁移清单。
- `docs/plans/stages/S5/plan-review.md`：G1 复核 PASS、§7.1 冻结哈希来源。
- 全量日志：`tools/verify/full-run-1.log`（62/70）、`full-run-2.log`（67/70）、`full-run-3.log`（70/70）、`full-run-4.log`（70/70）。