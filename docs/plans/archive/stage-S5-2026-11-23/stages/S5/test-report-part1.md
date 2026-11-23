# S5 测试报告（Part 1：S5-BUILD / S5-A / S5-B / S5-C）

> 范围：tester part 1。只修改 `tools/verify/verify.mjs`，新增 S5 常量/selector、S5-BUILD 与 A/B/C 门禁、
> 以及 S2/S3/S4 既有 graph 检查的 14→15 字段迁移；未改动 product / contracts / schema / fixtures / 其他文档。
> 字母划分按本 part 任务书：A=构建，B=demo（无 agent），C=agent L1（不是 s5-plan §10 的 A/B/C 语义，
> 计划中的 S5-C collector fixture 与 D/E/F/G 留给后续 part）。
> 运行日期：2026-11-23（本机 Windows 10 x64，verifier 内 `node -v` = v22.22.2，npm 10.9.7，
> Maven 3.9.5，JDK21 21 / JDK8 1.8.0_221）。

## 1. 命令

```bash
cd "tools/verify"

# S5-only：只跑 V0 + S5-BUILD + 选中的 A/B/C，S0–S4 全部跳过
node verify.mjs --s5=A,B,C

# 证据落盘（stdout 末尾追加一行 VERIFY_JSON）
node verify.mjs --s5=A,B,C --json

# 全量（本 part 未执行，按分工由后续 part 运行）
node verify.mjs
```

CLI 行为（已实现）：
- `parseS5Request(argv)` 解析 `--s5=A,B,C`；`--s5` 无值时默认全部已实现字母（当前 `S5_IMPLEMENTED=["A","B","C"]`）。
- `S5_ONLY` 模式：仍采集 V0 环境/基线，跳过 S0–S4 调用，只跑 S5 门；summary 打印 `S5 TEST: PASS|FAIL`，
  `--json` 追加 `VERIFY_JSON:{...,"mode":"s5-only","s5Selected":[...]}`。
- 正常 `node verify.mjs`：S0–S4 之后追加 `checkS5()`，verdict 为 `S5 TEST (full S0–S5)`；最终 exit code 计入 S5。
- 显式请求未实现字母（如 `--s5=D`）→ 记录 `S5-D` FAIL（"not implemented by tester part 1"），绝不伪造 PASS。
- `S5-BUILD` 在任何 S5 选择下都先跑一次（与 S4-BUILD 同构），`S5-A` 汇总其 Java 结果。

## 2. 结果总览

| 门 | 标题 | 结果 |
|---|---|---|
| V0 | environment recorded（S5-only 仍采集 env/基线） | PASS |
| S5-BUILD | 根 reactor（JDK21）+ demo backend（JDK8）+ agent jar major 52 | PASS |
| S5-A | SDK 17/17 + 3 dist、build-plugin 6/6 零依赖、demo manifest/.map/inline、workbench 构建 | PASS |
| S5-B | demo preview-discount：200 `{"data":0}`、DB 仍 100、未知 id 200/0、案例 A 仍 CREATED/100 | PASS |
| S5-C | agent L1：controller+service 2 span、5 个 values 精确、L1 flag、无 local、DB 100、案例 A 不变、fail-open | PASS |

两次独立运行均 `checks: 5 PASS / 0 FAIL (total 5)`、`S5 TEST: PASS`、exit 0；第二次带 `--json`：
`mode="s5-only"`、`s5Selected=["A","B","C"]`、`verdict="PASS"`，S5 门共 4 条（V0 之外）逐条 `ok:true`。

## 3. 迁移（随本 part 一并完成）

- graph 节点固定 15 字段：`spanId,parentSpanId,kind,nodeKey,status,return,sideEffects,startNs,durNs,
  thread,flags,reason,source,confidence,values`（第 15 位 `values` = 事件原始数组或 `null`，禁止 `[]`）。
  - `S5_GRAPH_NODE_KEYS_ORDERED` / `GRAPH_NODE_KEYS` 增加 `values`；新 helper `graphValuesProblems(node,event,label)`
    断言「键必须存在」且 `deepEqual(node.values, event.values ?? null)`。
  - 已接入：S2 运行时图（`graphProblems`，S2 事件无 values → 必须 `null`）、S3-4 graph A、S3-5 graph B、
    S4-D graph；S4 标签改为 "15 ordered fields (... + S5 values:null)"。
  - 既有 fixture 期望 values 为 `null`；requests / replay / meta 的期望形状未改。
- SDK 测试数 13→17、dist 仍 3 文件：S3-1、S3-7、S4-E 的断言/标签/§ 标题/summary 文案同步（S4-E 两条断言）。
- S3-1 demo 迁移：vite 断言 `import traceboardShallow from "../../../frontend/build-plugin/index.mjs"`、
  `plugins: [vue(), traceboardShallow()]`、`sourcemap: true`、不再断言 `0.0.0.0`；demo dist 允许 `.map`
  （`demoMaps.length >= 1`）并新增 `traceboard-manifest.json` 列出 `previewDiscount @ src/App.vue:<line>`；
  旧 UI 文案 token 替换为 S5 横幅/manifest 文案。build-plugin 测试 6；demo/workbench/root 构建保留。

## 4. 关键证据

### S5-BUILD（Java 三件套）

- `JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package` → exit 0（5.5s / 5.7s 两次）。
- demo backend 用 JDK8 `mvn -B -q -DskipTests package` → exit 0（1.9s / 2.0s）。
- jar 存在：agent 4,518,484 B、collector 22,937,797 B、demo 23,181,353 B；`javap -verbose` 得 agent `major=52`
  （Java 8 字节码）。

### S5-A（前端四包 + Java 汇总）

- `frontend/sdk`：`npm ci`（0 vulnerabilities）→ `npm run build`（tsc ESM + .d.ts + esbuild IIFE）→ `npm test`
  `tests=17 pass=17 fail=0`；dist 恰 3 文件 `index.js` / `index.d.ts` / `traceboard-sdk.iife.js`，无 `*.map`。
- `frontend/build-plugin`：package.json 为 `@traceboard/vite-plugin`、ESM、`node --test`、`deps=0 devDeps=0`；
  `npm test` 6/6。
- demo frontend：`npm ci` + `npm run build`（vue-tsc + vite，插件 + sourcemap）→ `index-cvY5X9af.js` 87.87 kB，
  `.map` 665.48 kB；`traceboard-manifest.json` 6 个函数，缺失 0（`previewDiscount`/`validateForm`/`cancelOrder`
  均含 `src/App.vue:<line>`）；`dist/index.html` 内联 `window.__TRACEBOARD_MANIFEST__`（构建期内联，不是 S4 preview 注入）。
- workbench：`npm ci` + `npm run build` exit 0，dist 4 文件非空。

### S5-B（demo，无 agent）

- seed：`GET /api/orders` → `{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100}`。
- `POST /api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=<3000 x>` →
  200 `{"data":0}`（14ms / 16ms）；随后 `GET /api/orders` 仍 `CREATED/100`（内存计算，无 UPDATE）。
- 未知 id `999` → 200 `{"data":0}`（findById=null 不写值，非 404/-1/null）。
- 案例 A `POST /api/orders/1/cancel` → 200 `{"data":true}`，订单仍 `CREATED/100`（0 行 UPDATE）。

### S5-C（collector 8601 + demo 8080 + agent，session `s_s5agent`）

- POST 带 `traceparent` + `X-TraceBoard-Click` → 200 `{"data":0}`；20s 内收到 2 条预览 span，schema v1 校验零问题。
- 恰 2 span：`controller,service`（`findById` 未插桩 → 无 mapper/sql）；EXACT join：server span 是 controller 的唯一子节点，
  `rootEventId=click_*`。
- controller span 无 `values`（L1 只在 service）；service `values.length===5` 有序：`requestedAmount`(param,100)、
  `demoSecret`(param,`[REDACTED len=6]`,redacted)、`note`(param,2048 字符,truncated)、`amount`(field,100→0，恰一条)、
  `return` 0；无 `id`/`local`，原始 `s3cr3t` 在整个收集结果中不出现。
- flags：service `["S2_ZERO_ROW_CHAIN","L1","DROP_COUNT=0"]`，controller `["S3_EXACT_LINK","S2_ZERO_ROW_CHAIN","DROP_COUNT=0"]`；
  无 `VALUES_CAPPED`/`L1_SKIPPED`/`L2`，无 `kind=local`。
- service `return={"type":"double","value":0}` + `status=OK`（0 是值不是 RETURNED_FALSE）；controller `ResponseEntity/200`；
  `source=OrderService.java:61`；日志含 `transformed com.example.shop.model.Order`（字段 advice 已装，自身不发 span）。
- DB 未被 L1 触碰：`amount` 仍 100 / `CREATED`。
- 同一 demo 内案例 A：200 `{"data":true}`，4 span `controller->service->mapper->sql`（LOST），SQL
  `OrderMapper.cancelById rowsAffected=0`；该链 `values` 全无、无 `L1` flag（字段 advice 只在 previewDiscount 生效）。
- 停 collector（8601 释放）后再次 preview → 仍 200 `{"data":0}`（4ms，agent fail-open）。

## 5. 清理

- S5-B/S5-C 的 demo/collector 均由 `finally` 停（demo 用 `taskkill /PID /T /F` 兜底）；两次运行后
  8080/8601/5173/5174/4173/4174/8602/18080 全部无监听，无残留 java。
- 本 part 未创建 pid/日志/临时 fixture 文件；未删除运行前已有文件。构建产物仅 `target/`、`dist/`、
  `frontend/sdk/dist`（均 gitignored，由产品自身构建命令产生）。
- 工作区唯一修改文件为 `tools/verify/verify.mjs`，本报告为唯一新增文档；未做任何 git 操作。

## 6. 已知缺口（parts 2/3）

1. **S5-D..S5-G 未实现**（按 s5-plan §10 语义）：D 插件单测细节（两类声明/排序/去重/坏 JSON/空目录/dev 中间件 200）、
   E SDK manifest 同步与坏 manifest fail-open、`SOURCE_MAPPED` file/line、F UI 静态选择器/文案/反向 B3 断言、
   G perf 3 轮 p50/p95/ratio。`--s5=D` 等会显式 FAIL（未实现），默认只跑 A/B/C。
2. **S5-C（计划语义，collector fixture）未实现**：`fixtures/s5-l1-values` 的 graph 4/3、15 键有序、service values
   数组/其余 null、events/seq 不改写、replay 回显 values 等；本 part 的 S5-C 是运行时 agent 侧断言。
3. **S5-H（回归 + G1 冻结）未实现**：S0–S4 锚点全 PASS、schema/S0–S4 fixture 字节不变、S5 G1 哈希零漂移需后续 part。
4. **全量 S0–S4 本轮未执行**（按分工）。已识别但**尚未迁移**的旧门禁（全量运行会 FAIL，属测试侧待办）：
   - S2-8：`.type/.transform` 期望 4 → 产品现为 7（S2 四点 + PreviewController/PreviewService/FieldWrite）；
     forbidden 列表中的 `"values"` 关键字现为合法实现；`com.example.shop` 白名单可能需纳入 `model.Order`。
   - S3-8 / S3-10：仍禁止 `sourceMappingURL|sourcesContent|vite-plugin-*` 与 `sourcemap: true`、要求
     `plugins: [vue()]`，与 S5 允许的 `.map`/构建插件冲突。
   - S3-6/S3-7：`S3_SELECTORS` 附近旧文案 token `JS 内部变量本次未采集（无构建插件/sourcemap）` 等仍待替换为
     S5 canonical 文案。
   - S4-I：仍要求「no S5/S6 capability」，与 S5 的 values/manifest 冲突，需由 S5-H 重写。
5. S5-B 未断言计划 S5-A 的「除 preview-discount 外无新端点 / 无新 collector 路由」；建议并入后续 collector/scope 门。