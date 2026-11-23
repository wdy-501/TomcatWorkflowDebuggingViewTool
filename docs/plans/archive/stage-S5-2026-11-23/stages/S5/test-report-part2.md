# S5 测试报告（Part 2：S5-D/E/F/G/H + 旧门禁迁移 + 性能基线）

> 范围：tester part 2。修改 `tools/verify/verify.mjs`、新增 `tools/perf/l1-overhead.mjs`；新增本报告。
> 未改动 product / contracts / schema / fixtures / 其他文档 / git。
> 运行日期：2026-11-23（Windows 10 x64；verifier 内 Node v22.22.2、npm 10.9.7、Maven 3.9.5，
> JDK21 21 / JDK8 1.8.0_221）。A/B/C（build/demo/agent）沿用 part 1，未重做。

## 1. 命令与结果

```bash
cd "tools/verify"
node verify.mjs --s5=D,E,F              # PASS：V0 + S5-BUILD + D/E/F（5 checks）
node verify.mjs --s5=A,B,C,D,E,F        # PASS：V0 + S5-BUILD + A..F（8 checks）
node verify.mjs --s5=A,B,C,D,E,F,G,H    # PASS：V0 + S5-BUILD + A..H（10 checks）
node verify.mjs --s4=I                  # PASS：S4-BUILD + 迁移后的 S4-I（3 checks）
```

| 门 | 覆盖 | 结果 |
|---|---|---|
| S5-D | `fixtures/s5-l1-values` → graph 4 节点/3 边/每节点 15 有序字段；service 5 项 values（100 / `[REDACTED len=6]` / 2048 x truncated / 100→0 / return 0），其余 3 节点 `values:null`（绝不 `[]`）；F1–F10 + 4 replay 窗口；requests `{sessionId,sdkActive,requests}` + 1 行 deep-equal；meta 5 能力键；S4 fixture 9 节点 `values:null`；workbench build 后 15/15 S5 UI tokens + 26 selectors + 4 panels + src/dist B3 反向断言 0 stale | PASS |
| S5-E | build-plugin 6/6 零依赖；SDK ci/build/test 17/17、dist 3 文件无 map；demo build manifest 6 函数与从源文件重算的 R1/R2 结果逐项一致（`validateForm`/`previewDiscount` 含 file:line）、inline 与 asset 同内容、1 个 `.js.map`、`#btn-discount`、S5 文案、无 CDN；workbench/SDK dist 无 map/manifest | PASS |
| S5-F | `tools/perf/l1-overhead.mjs` exit 0；PERF_RESULT 含 3 轮 p50/p95、ratio、agent events>0；>1.25 仅 WARN；无硬阈值；端口清理 | PASS |
| S5-G | S5 plan-review `G1: PASS`；S5 G1 freeze 18/18 哈希；schema `927937…a489a`；S5 fixture 恰 3 文件；S0–S5 fixture 21/21 字节不变。S5-only 模式显式记录「S0–S4 anchors deferred（full run asserts）」，不伪 PASS | PASS |
| S5-H | 88 个产品文件无 L2/local、async 续体、运行时 ×3、SSE/WS、持久化、像素回放、`.map` 解码、Tomcat/WAR、云、React；collector 仍恰 9 条业务路由（无 preview-discount）；仅 demo dist 有 1 个 map；preview 注入仅外部 `<script src>`；无 secret/PII/CDN/mirror；8 端口空闲、无 java/node 残留、git index/HEAD/status 未动、38 条变更全在 S5 白名单 | PASS |

## 2. 性能基线（report-only）

脚本：`node "tools/perf/l1-overhead.mjs" --n 100 --warmup 20 --rounds 3 --port 8080`（exit 0）。
原始输出（2026-11-23T13:08:39Z，单独默认参数运行）：

```text
PERF_RESULT:{"script":"tools/perf/l1-overhead.mjs","createdAt":"2026-11-23T13:08:39.418Z","n":100,"warmup":20,"rounds":3,"port":8080,"collectorPort":8601,"base":{"rounds":[{"n":100,"p50Ms":1.356,"p95Ms":2.423},{"n":100,"p50Ms":1.024,"p95Ms":1.777},{"n":100,"p50Ms":0.944,"p95Ms":1.324}],"samples":300,"p50Ms":1.024,"p95Ms":1.777,"events":0},"agent":{"rounds":[{"n":100,"p50Ms":1.635,"p95Ms":2.714},{"n":100,"p50Ms":1.377,"p95Ms":2.148},{"n":100,"p50Ms":1.288,"p95Ms":2.072}],"samples":300,"p50Ms":1.377,"p95Ms":2.148,"events":49,"sessionId":"s_s5perf"},"ratio":1.345,"ratioDefinition":"median(agent p50Ms) / median(base p50Ms)","warn":"l1_overhead_ratio>1.25","threshold":"none; 1.25 is a WARN label only (report-only)","reportOnly":true}
```

- base：p50 1.024 ms / p95 1.777 ms；agent：p50 1.377 ms / p95 2.148 ms；ratio 1.345（>1.25 仅 WARN）。
- agent collector 计数 49（`nextSeq-1`）；本地 1 ms 级顺序压测下 agent 事件队列/发送端会 fail-open 丢弃，计数 >0 满足报告口径，不作为吞吐承诺。
- 同脚本在 A–F/A–H 验证运行中 ratio 分别为 1.507 / 1.197（噪声可见），再次说明不可做硬阈值；三次均 exit 0。

## 3. 旧门禁迁移（已改，full run 由 Part 3 执行）

- `S2-8`：agent 由 4 type/4 transform/4 advice 迁移为 **5 type/7 transform/7 advice**（新增 PreviewController/PreviewService/FieldWrite、`model.Order`）；`values` 不再禁用，改为仅允许 `param|field|return` 且无 `kind=local`。
- `S3-6`：旧文案 token `JS 内部变量本次未采集（无构建插件/sourcemap）` 迁移为 S5 文案，并新增 canonical 横幅 token。
- `S3-8`：移除 sourcemap/build-plugin/values 禁项，改为允许 S5 manifest/sourcemap 但仍禁 `.map` 解码/上传与 L2/local；workbench/SDK dist 仍禁 map，demo dist 允许。
- `S3-10`：白名单加入 `frontend/build-plugin/`、`tools/perf/`、`docs/plans/stages/S5/`、`fixtures/s5-l1-values/` 与 demo backend 4 个 L1 文件（其余 demo backend 仍冻结）。
- `S4-I`：由「no S5/S6/S7」改为「S5 values/manifest 允许、S6+ 仍禁」，白名单同步 S5；单独 `--s4=I` 已 PASS。
- `S4-H` / `S3-2` / `S2-L`：冻结哈希 source 改用 `S5_G1_FREEZE`（api/event-model 取 S5 哈希，其余继承 S4/S0–S3）；S5-G 另行断言 18 文件零漂移。
- `S3-7` 无需改文案（SDK 17 测试与案例 B 断言在 S5 仍保留）；full run 仍需验证。

## 4. 清理与边界

- 所有验证运行 `finally` 停 demo/collector/preview；结束后 8601/8080/5173/5174/4173/4174/8602/18080 均无监听，无 java/node 残留；perf 临时目录自删。
- git index 未动、HEAD/status 与运行基线一致；变更 38 条全部在 S5 白名单内（`docs/plans/stages/S5/` 为目录级未跟踪条目，本报告包含其中）；仅测试脚本、报告与构建产物（dist/target 均 gitignored）变化。
- 本 part 未运行完整 `node verify.mjs`（按分工留 Part 3/final），因此 S5-G 的 S0–S4 anchor 分支与 S2-8/S3-6/S3-7/S3-8/S3-10/S4-H 的 full-run 执行仍待 Part 3 证实；S3-6/S3-8/S3-10 已用等价静态脚本预检 0 差异。

## 5. 产品侧观察（非门禁失败）

- `frontend/sdk/package.json` 的 `description` 仍写 `no build plugin, no sourcemap`，与 S5 能力口径不一致；不在 `src/dist` 反断言范围内，未计 FAIL，建议 coder-frontend 顺手修正。