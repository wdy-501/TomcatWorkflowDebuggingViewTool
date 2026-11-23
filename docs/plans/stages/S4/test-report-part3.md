# S4 测试报告（Part 3：S4-F / S4-G + S2/S3 门禁迁移）

> 范围：tester part 3。只改 `tools/verify/verify.mjs`（S4-F/S4-G、S2/S3 门禁迁移、测试侧 helper）并新增本文件；
> 未改产品 / 契约 / schema / fixture / 其他阶段文档，未执行任何 git 写操作。
> 运行日期：2026-11-23（Windows 10 x64；记录环境 Node v22.22.2、npm 10.9.7、Maven 3.9.5、JDK21 + JDK8 1.8.0_221）。

## 1. 命令与结果

```bash
cd "tools/verify"

node verify.mjs --s4=F,G --json        # 4 PASS / 0 FAIL（V0 + S4-BUILD + F + G），S4 TEST: PASS，exit 0
node verify.mjs --s4=A,B,C,D,E,F,G --json  # 9 PASS / 0 FAIL（V0 + BUILD + A..G），S4 TEST: PASS，exit 0
node verify.mjs --json                 # 全量 S0–S4：59 PASS / 0 FAIL，S4 TEST (full S0–S4): PASS，exit 0
```

- `S4_IMPLEMENTED = ["A".."G"]`；`--s4` 选择器与 `checkS4()` 已接入 F/G，未实现的 H/I 仍如实记 FAIL（不伪造 PASS）。
- 全量运行的 59 项包含 S0–S3 全部门与 S4-BUILD/A–G；S4-F/S4-G 在 S3 门之后串行执行，无端口/进程冲突。

## 2. S4-F（fixtures/s4-details → collector → 工作台 derive/dist）

实测证据（全部来自 `fixtures/s4-details` 的 9 条事件，非运行时 ×3）：

| 断言 | 结果 |
|---|---|
| fixture 9 行 NDJSON 全部通过冻结 Ajv 2020-12 strict | 9/9 valid |
| 原文件 POST `/ingest/v1/events` | 202 `accepted=9 rejected=0 dropped=0` |
| requests | 1 行 deep-equals expected：LOST / NOT_COLLECTED_POLICY / spanCount=9 / sdkActive=false |
| graph | 9 节点 / 8 边；每节点按固定顺序恰 14 键 `spanId,parentSpanId,kind,nodeKey,status,return,sideEffects,startNs,durNs,thread,flags,reason,source,confidence`，值与事件逐字段一致 |
| mapper3 (`2708070605040308`) | `reason="policy:third_party_package"`、`source={"file":"OrderMapper.java","line":15}`、`confidence=LOST`、`sideEffects=[]` |
| replay 默认窗口 | `fromNs=0`、`toNs=5120000000`、9 事件、seq 1..9、body 与 fixture 一致、readOnly=true |
| events/seq 未被读操作改变 | 9 条 wrapper、seq 1..9、`nextSeq=9`；重复 GET graph 逐字一致 |
| workbench `npm run build` | exit 0（prebuild 同步 fixture + vue-tsc + vite） |
| dist 静态串 | 13/13：节点详情、×N、未采集、缺口、rowsAffected、reason、逐次调用、SQL/数据影响、UI 效果、`×N 为已采集 span 的前端聚合；运行时 ×3 属 S6`、后端未采集/未关联、未采集（无 reason）、缺口空列表逐字 |
| dist 选择器/面板 | 11/11 `#s4-*`（含 `s4-detail`/`s4-invocations`/`s4-gaps`/`s4-group-badge`）；S3/S2/S1/S0 四面板保留 |
| 徽标容器 | `id="s4-group-badge"` 恰 1 个容器；每组一个带 `data-node-key` 的子元素（dist 含 `data-node-key`） |
| derive（esbuild 打包 `workbench/src/s4/derive.ts` 后实测） | 分组 controller×1、service×3、mapper×3、sql×2（startNs 升序、同 nodeKey 一组） |
| 逐次 rows（仅该次调用的 sql 子节点） | service 0/0/未采集；mapper 0(子 sql)/0(子 sql)/未采集；sql 0/0（自身 rowsAffected=0 显示 0） |
| 缺口 | 恰 3 条且按 span 顺序：mapper1/mapper2 `ROWS_NOT_COLLECTED`=`未采集`、mapper3 `NOT_COLLECTED_REASON`=`未采集 · policy:third_party_package`；service/sql/controller 无缺口 |
| 详情文案回退 | 缺失 reason → `未采集（无 reason）`；source 缺 file/line 或为 null → `未采集`；confidence 渲染含 LOST |
| 内联前端批次（F 规则，不用 fixture 冒充） | 未被后端引用的 fetch → `FETCH_WITHOUT_BACKEND`=`后端未采集/未关联`（F 优先于 N）；mapper NOT_COLLECTED 无 reason → N；mapper OK 无 sideEffects → R；rows=0 的 sql 不产生缺口；同 span 恰一条 |

## 3. S4-G（diagnose 七项，真实链路）

链路：collector 8601 + launcher `jar --detach`（JDK8 demo + agent，`s_s4diag`）+ 18080 静态 stub + preview 8602；
`POST /api/orders/1/cancel` 产生 4 条 agent 事件后运行 5 个分支：

| 分支 | 命令要点 | pass/warn/fail/skip | SUMMARY | exit |
|---|---|---|---|---|
| full preview（7 PASS） | `--app-url http://localhost:8080/api/orders --session s_s4diag --preview-url http://127.0.0.1:8602/` | 7/0/0/0 | PASS | 0 |
| 无 preview | 同上省略 `--preview-url` | 5/0/0/2（两项 `SKIP ... reason=no_preview_url`） | PASS | 0 |
| 缺失 session | `--session s_s4missing`（无 hello/事件） | 3/1/1/2（agent_handshake FAIL、recent_events WARN） | FAIL | 3 |
| app URL down | `--app-url http://127.0.0.1:9/api/orders` | 4/0/1/2（app_health FAIL: connect failed） | FAIL | 3 |
| preview 目标不可注入 | 18080 改 text/plain，preview 8602，`--preview-url http://127.0.0.1:8602/` | 6/0/1/0（preview_injection FAIL `not-injected:not_html`；sdk_script PASS） | FAIL | 3 |

- 每个分支均断言：七行固定顺序 `collector_health,collector_meta,app_health,agent_handshake,recent_events,preview_injection,sdk_script`、
  行格式 `PASS|FAIL|WARN|SKIP <check>: <evidence>`（非 SKIP 的证据含 `GET http...`）、末行精确
  `SUMMARY: <PASS|FAIL> pass=<n> warn=<n> fail=<n> skip=<n>` 且四数之和恒为 7。
- full preview 证据含 `X-TraceBoard-Preview=injected`、`TraceBoardSDK`、`connected=true`、`capabilities={...}`；不可注入时绝不出现 `PASS preview_injection`（无伪造 PASS）。
- 全部服务由 gate 自身清理：demo 经 `stop --pid-file` 停止，preview/stub 关闭，collector 停止；运行后 8080/8601/8602/18080 均释放、PID 文件删除。

## 4. S2/S3 门禁迁移（仅加性）

- **graph 14 字段**：`S3-4` 的 `GRAPH_NODE_KEYS` 为 14 键（排序比较，节点值/边/顺序断言不变）；`S2-3` 的 `graphProblems()`
  新增每节点 14 键断言与 `reason`(string|null)/`source`(object|null)/`confidence`(string) 类型断言（加性、不聚合）。
- **路由/能力**：`S2-8` 断言 collector 业务路由恰 9 条（含 `POST /ingest/v1/agent-hello`、`GET .../agent`），
  agent `.type=/.transform=` 仍 4/4；meta capabilities 仍恰 5 键、`realtime=false`（S3-4/S4-C/S4-G 同时断言）。
- **events/seq 不弱化**：S4-F 读派生后仍断言 9 条 wrapper、seq 1..9、`nextSeq=9`；S3-4/S3-5 的 ingest/seq/回放断言未改。
- **S3-8 values[] 扫描收窄（测试侧误报）**：S4 工作台的逐次 rows 使用局部 `values: number[]`，不是 S5 `values[]` 字段；
  判据收窄为 JSON/事件键 `"values":`，其余 S5/S6 禁项（sourcemap/构建插件/L1-L2/SSE/WS/localStorage/图库）不变。

## 5. 测试侧修正记录（无产品缺陷）

- S4-G 首版用 `spawnSync` 跑 diagnose，会阻塞 verify 进程的事件循环，使同进程 18080 stub 无法应答 preview 反代（preview_injection 超时）；
  改为 `runLauncherAsync`（异步 spawn）后通过。属于测试 harness 问题，非产品缺陷。
- 对齐实际契约：`events.nextSeq` 是“最后已分配 seq”（9 条 → 9）；×N 分组包含 controller ×1（fixture expected-facts 只列 3 个 ×N 组）；
  mapper1/2 的逐次 rows 显示子 sql 的 `0`（标注“子 sql”），mapper3 为 `未采集`。
- 一次中间全量运行出现 S3-3 运行时间隔嵌套瞬时失败（时钟读数竞态，非本次改动）；随后全量运行 S3-3/S3-9 均 PASS。

## 6. 清理与边界

- 最终状态：8601/8080/8602/18080/5173/5174/4173/4174 无监听；无 java 残留；`work/*.pid` 无残留（`work/` 本身被 .gitignore 忽略）。
- 临时 esbuild 产物写在 OS 临时目录并由 `tmpDirs` 清理；仓库内仅 `tools/verify/verify.mjs` 与本报告为 tester 写入，
  `workbench/dist`、`target/`、`work/logs` 是产品自身构建/运行产物。
- 运行时 ×3 仍是 S6；fixtures/s4-details 未被当作运行时证据，缺口 F 仅由内联批次断言。

## 7. 剩余工作

- **S4-H**（S0–S3 回归 + G1 哈希零漂移）与 **S4-I**（范围/安全/端口/清理）尚未实现为独立门；`--s4=H/I` 会如实 FAIL。
  全量运行已顺带覆盖 S0–S3 全部 50 项（含 S3-10 的 S4 白名单/端口/无残留、G1 冻结哈希），可作为 H 的主体证据。
- **产品缺陷：无**。F/G 在首次真实构建上通过；所有失败均已定位并修正于测试侧。