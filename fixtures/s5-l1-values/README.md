# fixtures/s5-l1-values

> 本目录是 S5 测试数据，不是运行时证据；运行时 L1 由 demo+agent 产生。不含真实 secret；demoSecret 是假值。

S5（L1 + 前端浅层）的**契约夹具**：手工构造的 4 条事件，用来冻结
「graph 节点第 15 字段 `values` + 前端 manifest `source`」的**形状**。
真实证据来自 `docs/plans/stages/S5/s5-plan.md` 的 S5-B（demo + javaagent E2E）。

## 文件

| 文件 | 作用 |
| --- | --- |
| `events.ndjson` | 4 条 `traceboard.event.v1` 事件（compact JSON，1 行 1 条，无空行、无 BOM），Ajv 2020 strict 通过 |
| `expected-facts.json` | 期望事实：requests 1 行 / graph 4 节点 3 边（每节点 15 键）/ replay 4 窗口 / 工作台文案 |

`expected-facts.json` 里 `note` 字段已注明本目录**不是运行时证据**；
`source.lines`（`src/App.vue:120`）是示意值，测试须从源文件重算行号再比对。

## 事件链（1 root，4 span，EXACT）

```
ui_event  #btn-discount        a000000000000001  src/App.vue:120        flags: SDK_ACTIVE,SOURCE_MAPPED,OBSERVE_MS=1500
└─ fetch  POST /api/orders/1/preview-discount  a000000000000002          flags: SDK_ACTIVE
   └─ controller OrderController#previewDiscount  a000000000000003  OrderController.java:57  flags: S2_ZERO_ROW_CHAIN
      └─ service OrderService#previewDiscount     a000000000000004  OrderService.java:63    flags: S2_ZERO_ROW_CHAIN,L1
```

- 区间严格嵌套：`7000000000 ⊃ 7002000000 ⊃ 7005000000 ⊃ 7006000000`（`startNs` 单调不减、父区间包住子区间）。
- 前端线程 `{id:0,name:"browser-main"}`；后端线程 `{id:44,name:"http-nio-8080-exec-1"}`。
- `startNs` 取 7e9 量级（< 2^53），保证 JS 读回精确。
- controller `return={type:"org.springframework.http.ResponseEntity",value:200}`，service `return={type:"double",value:0}`。
- **只有 service span 带 `values`**；其余 3 个 span 省略该键（graph 渲染 `null`，不默认 `[]`）。

## values 五项（service span，顺序即产生顺序）

| # | name | kind | line | from | to | truncated | redacted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | requestedAmount | param | null | null | `100` | false | false |
| 1 | demoSecret | param | null | null | `[REDACTED len=6]` | false | **true** |
| 2 | note | param | null | null | 2048 个 `x` | **true** | false |
| 3 | amount | field | null | `100` | `0` | false | false |
| 4 | return | return | null | null | `0` | false | false |

- 脱敏**先于**截断：`demoSecret` 只留占位符，原值 `s3cr3t` 在 `events.ndjson` 的任何字段中都不出现（测试会 `grep` 复查；`expected-facts.json` 的说明文字提及该假值不构成泄漏）。
- 参数项只含 `requestedAmount`/`demoSecret`/`note`：服务签名第 0 参 `long id` 是路径参数，**不进入 `values`**（断言 `valueNames` 无 `id`）。
- `note` 截断恰为 2048 字节 / 2048 字符（全 ASCII `x`），**不追加省略号**；`expected-facts` 用 `noteToBytes` / `noteToLength` / `noteToMatches` 断言，不复制 2KB 全文。
- `line` 恒为 `null`（行级属 L2/S6），`invocation` 缺省（无 ×N）。
- 数组顺序（参数→字段→返回）是契约；**事件对象内键序与 `values` 项内键序不属契约**（本文件 `values` 恰在 `flags` 之后），测试按 JSON 语义比对。
- 字段值是**标量**：`100 → 0` 是 `Order#setAmount` 的旧值→新值，不是对象深拷贝。

## 明确排除（不要从这里读出能力）

- **MyBatis hydration 不算字段写入**：`findById` 把 DB 的 100 塞进 `Order.amount` 同样是 `setAmount`，但调用栈含 `org.apache.ibatis` 帧，且类不是目标 `OrderService#previewDiscount` 顶层帧，agent 不发射。所以链里只有**一条** `amount` 值项（100→0），没有 0→100。
- **没有 L2**：无 `kind=local`、无行级变量、无 ×3、无 async。`L2` 是 S6。
- **没有对象深采集**：`values` 里不出现对象/集合/嵌套结构，只有标量 + 2KB 字符串上限。
- **没有额外 flag**：不带 `DROP_COUNT` / `S3_RUNTIME_SDK` / `S3_EXACT_LINK` / `VALUES_CAPPED` / `L1_SKIPPED`。运行时可能追加建议性 flag，断言用「包含」而非整数组相等；`expected-facts.json` 的 `flagsAreContainsOnly: true` 即此口径。
- **不含 SQL span**：`OrderMapper.findById` 未插桩，链里没有 mapper/SQL 节点。

## 验证

离线、无网络、不安装依赖（复用 `tools/verify/node_modules`，不改任何 `package.json`）：

```bash
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const schema=JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8'));
const ajv=new Ajv({strict:true,allErrors:true});
const validate=ajv.compile(schema);
const lines=fs.readFileSync('fixtures/s5-l1-values/events.ndjson','utf8').trim().split('\n');
let ok=0;
for(const [i,l] of lines.entries()){const e=JSON.parse(l);if(validate(e))ok++;else{console.error(i+1,JSON.stringify(validate.errors));process.exitCode=1;}}
JSON.parse(fs.readFileSync('fixtures/s5-l1-values/expected-facts.json','utf8'));
console.log('lines',lines.length,'schema ok',ok);
EOF
```

核对点：`lines 4 schema ok 4`；`note` 为 2048 个 `x`；`events.ndjson` 全文无 `s3cr3t`（`expected-facts.json` 的说明文字提及假值不构成泄漏）；`expected-facts.json` 可 `JSON.parse`。

## 与派发单的偏差

1. **4 条 EXACT 链**（click→fetch→controller→service），不是「controller LOST root + service」：派发单 §4.6 与 S5-C 要求 `requests` 行 EXACT / `spanCount=4` / `fetchCount=1` / `backendSpanCount=2`。
2. **`note` 截断无省略号**：派发单 §4.2 明确「不追加省略号」，故 2048 个 `x`。
3. **`demoSecret` 是假值**：仅用于验证名称正则 `secret` 命中；不得替换为任何真实凭据。