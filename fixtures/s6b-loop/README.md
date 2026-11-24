# fixtures/s6b-loop

本目录是 S6b 循环折叠测试数据，不是运行时证据；真实的约 102 次观测、20 项保留列表、`VALUES_CAPPED`/`VALUES_TOTAL` 计数与 `50 → 0` 坏值必须来自 demo `L2DemoService#reconcileLoop` + javaagent `L2Values` 折叠 E2E（S6B-C）。fixture 行号不承诺与编译产物一致；`82/102` 只是形状示例（运行时不硬编码 total，断言 `t>20`、`d=t-20`）。不含真实 secret、不含 S3 demo 会话 ID。

S6b（循环值折叠）的**契约夹具**：4 条事件，用来冻结
「`status=TRUNCATED` + `L2` + `VALUES_CAPPED=<d>` + `VALUES_TOTAL=<t>`、`values` 恰 20 项（首/尾/中段样本 + 坏 0）、保留项 `truncated=false`」的**形状**。
`expected-facts.json` 另含 `#s6-fold-note` 文案、canonical 文案与反向断言。

## 文件

| 文件 | 作用 |
| --- | --- |
| `events.ndjson` | 4 条 `traceboard.event.v1` 事件（compact JSON，1 行 1 条，无空行、无 BOM），Ajv 2020 strict 通过 |
| `expected-facts.json` | 期望事实：requests 1 行（`TRUNCATED` / EXACT / 4 span / `backendSpanCount=2`）/ graph 4 节点 3 边 / 13 条 fact / 工作台 `#s6-fold-note` 与反向断言 |

## 事件链（1 root，4 span，EXACT）

```
ui_event   #btn-reconcile-loop                        e000000000000001  thread 0 browser-main  flags: SDK_ACTIVE,OBSERVE_MS=1500
└─ fetch   POST /api/orders/1/reconcile-loop?times=100 e000000000000002  thread 0 browser-main  flags: SDK_ACTIVE
   └─ controller OrderController#reconcileLoop         e000000000000003  thread 44 http-nio-8080-exec-1
      └─ service L2DemoService#reconcileLoop           e000000000000004  return 50
             status: TRUNCATED
             flags: S2_ZERO_ROW_CHAIN,L2,VALUES_CAPPED=82,VALUES_TOTAL=102
             values: 20 项（首个 null→0，末尾 49→50，含 50→0 坏值）
```

- 区间严格嵌套（click `11.000s–11.122s` ⊃ fetch `11.002–11.120` ⊃ controller `11.005–11.115` ⊃ service `11.006–11.111`）。
- `reconcileLoop` 只被调用一次，`invocation` 恒 1；`values` 只在该 service span 上，controller/fetch/click 省略该键（graph 呈现 `null`）。
- **无静默丢弃**：`values.length(20) + VALUES_CAPPED(82) === VALUES_TOTAL(102)`；折叠只改列表，不改真实值（`return` 仍 50，保留项 `from/to` 原样）。

## values 规则（保留 20 项）

| 位置 | 观测（示意） | 说明 |
| --- | --- | --- |
| 1 | `null → 0` | 初始化基线（`from=null` 是基线，不是值变化）；属“前 6” |
| 2–6 | `0 → 1` … `4 → 5` | 前段增量；属“前 6” |
| 7–9 | `16 → 17`、`28 → 29`、`40 → 41` | 中段均匀样本（被丢弃项两侧不拼接） |
| 10 | `50 → 0` | **坏值**（from 非空且 to=0），优先保留；行号 = reset 行 |
| 11–14 | `1 → 2`、`13 → 14`、`25 → 26`、`37 → 38` | 中段样本；注意 `1 → 2` 的 from 来自被丢弃的 `0 → 1`，未平滑 |
| 15–20 | `44 → 45` … `49 → 50` | “后 6”，尾部可见 |

- 顺序即**原观测顺序**（升序），不重排；`truncated=false`/`redacted=false`；`invocation=1`。
- 生产探针**实测 4 个**（init 基线行、增量行、if/reset 行、锚点行；`for` 行边界因前一条是 `if_icmpgt` 被跳过；JDK8 `javap -l` 实测，实际以 `l2_probes_installed` 日志为准）；自检 ≥2 才安装，<2 → `l2_probe_missing` fail-open；**不硬断言 3**。
  锚点语句“只读 `local` 不改它”，保证 reset 后的 0 与恢复可被观察到（reset 写在同一 `if` 行时，reset 后的变化在下一边界/锚点行被观测）。
- `times=5` → 约 6 项观测，`status=OK`、无 `VALUES_CAPPED`/`VALUES_TOTAL`（S6B-C 对照）；`reconcileAmount` 仍 1/2/1、无 cap。

## 明确排除（不要从这里读出能力）

- **不是“循环全量记录”**：只保留 20 项，其余 82 项被折叠但计数可见。
- **不是“值被截断”**：保留项 `truncated=false`（真值未截断，列表被折叠）；UI 不得写成“已截断值”。
- **没有**采样率/随机采样/跨请求聚合；**没有**字段写入/对象深采/多方法 L2/异步。
- **flag 断言用“包含”**：运行时可追加 `DROP_COUNT=<n>`；断言 `includes("VALUES_CAPPED")`/`includes("VALUES_TOTAL")` 且**不硬编码 total**。

## 验证

离线、无网络、不安装依赖（复用 `tools/verify/node_modules`，不改任何 `package.json`）：

```bash
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const schema=JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8'));
const ajv=new Ajv({strict:true,allErrors:true});
const validate=ajv.compile(schema);
const lines=fs.readFileSync('fixtures/s6b-loop/events.ndjson','utf8').trim().split('\n');
let ok=0;
for(const [i,l] of lines.entries()){const e=JSON.parse(l);if(validate(e))ok++;else{console.error(i+1,JSON.stringify(validate.errors));process.exitCode=1;}}
JSON.parse(fs.readFileSync('fixtures/s6b-loop/expected-facts.json','utf8'));
console.log('lines',lines.length,'schema ok',ok);
EOF
```

核对点：`lines 4 schema ok 4`；`values` 恰 20 项；首项 `from=null`、末项 `to=50`、存在 `50→0`；`20+82=102`；`expected-facts.json` 可 `JSON.parse`。

## 与派发单的偏差

1. **fixture 是浏览器链（4 事件）**：dispatch §4.1 的“loop 恰 2 span”指后端 span（controller + service），本目录 `backendSpanCount=2`；
   加 click/fetch 是为了 `confidence=EXACT` 与单一根不变量。
2. **`t=102`/`d=82` 是示意值**：运行时不硬编码（dispatch §10 风险表要求），只断言关系。
3. **保留项的 `truncated=false`**：dispatch §3 明确“真值未截断，列表被折叠”；若任务卡把“truncated true”简写为折叠语义，
   以事件级 `status=TRUNCATED` 表达，不把保留项写成截断值（见 `s6b-plan.md` 偏离 D2）。
4. **fixture 不写 `DROP_COUNT`**：与 S0–S6a 约定一致。