# fixtures/s6b-no-debug

本目录是 S6b 无调试信息测试数据，不是运行时证据；`NoDebugService` 是否真的没有 `LocalVariableTable` 只能由 `javap -l`（源码类与 Boot jar 内类）证明，运行时事件必须来自 antrun `debug="false"` 构建 + ASM `NoDebugClassFileTransformer` 的 E2E（S6B-B）。fixture 行号（如有）不承诺与编译产物一致。不含真实 secret、不含 S3 demo 会话 ID。

S6b（缺调试信息降级）的**契约夹具**：2 条事件，用来冻结
「`status=NOT_COLLECTED_NO_DEBUG_INFO` + `reason` + flag `NO_DEBUG_INFO` + **无 values** + 无行号」的**形状**。
`expected-facts.json` 另含工作台灰色状态与 `#s6-no-debug-reason` 文案、canonical 说明与反向断言。

## 文件

| 文件 | 作用 |
| --- | --- |
| `events.ndjson` | 2 条 `traceboard.event.v1` 事件（compact JSON，1 行 1 条，无空行、无 BOM），Ajv 2020 strict 通过 |
| `expected-facts.json` | 期望事实：requests 1 行（`NOT_COLLECTED_NO_DEBUG_INFO` / LOST / 2 span）/ graph 2 节点 1 边 / 10 条 fact / 工作台选择器与文案 / 反向断言 |

## 事件链（endpoint-only；controller 是合法游离后端根）

```
controller OrderController#noDebug        d000000000000001  parent null  confidence LOST  rootEventId click_lost_...  flags: S2_ZERO_ROW_CHAIN,LOST_BACKEND
└─ service NoDebugService#compute         d000000000000002  parent controller  confidence LOST  return 200
                                              status: NOT_COLLECTED_NO_DEBUG_INFO
                                              reason: LocalVariableTable missing
                                              flags: S2_ZERO_ROW_CHAIN,NO_DEBUG_INFO
                                              values: （键缺失）  source: （缺失/line=null）
```

- 同线程（`http-nio-8080-exec-1`，id 44）同步调用，**不带** `ASYNC_INHERITED`。
- `rootEventId=click_lost_d000000000000001` 是 `event-model.v1.md` §5 第 2 条例外的**合成占位**：本链没有前端根，
  不允许伪造 `EXACT`；若 curl/浏览器带合法 `traceparent` + `X-TraceBoard-Click`，运行时是同样的 2 个后端 span 但 `confidence=EXACT`
  （controller parent = fetch spanId，无 `LOST_BACKEND`）——这是运行时事实，不是本 fixture 的字节。
- 无调试信息方法**只证明调用与返回值**：`return={"type":"double","value":200}` 是真实的 `amount*2`；
  没有变量名、没有行号、没有 `kind=local`/`param`/`field`/`return` 值项。

## 断言要点

| 断言 | 值 |
| --- | --- |
| service `status` | `NOT_COLLECTED_NO_DEBUG_INFO`（**不是** `OK`，工作台灰色 `notcollected`） |
| service `reason` | 逐字 `LocalVariableTable missing`（schema 对 `NOT_COLLECTED_*` 强制非空 reason） |
| service flag | 含 `NO_DEBUG_INFO`；无 `L1`/`L2`/`ASYNC_INHERITED`/`VALUES_CAPPED`/`VALUES_TOTAL` |
| `values` | 键**缺失**（不是 `[]`、不是占位值、不猜名） |
| `source` | 缺失或 `line=null`（`-g:none` 也移除了 `SourceFile`；不伪造行号） |
| 构建门槛 | `javap -l` 必须无 `LocalVariableTable`/`LineNumberTable`；若仍有 LVT，transformer 记 `nodebug_lvt_present` 且 S6B-B **FAIL** |

## 明确排除（不要从这里读出能力）

- **不是**“无调试信息可采变量/可推断变量名/行号”；**不是**普通 L2（没有行级探针，没有 `L2` flag）。
- **没有**异步/线程池/框架续体；**没有**字段写入/对象深采/多方法 L2/循环折叠。
- **flag 断言用“包含”**：运行时按需追加 `DROP_COUNT=<n>`；断言 `includes("NO_DEBUG_INFO")` 与禁项，不做整数组深比较。
- fixture 不是运行时证据；`expected-facts.json` 的 `note`/`runtimeProbeExpectations` 已声明这一边界。

## 验证

离线、无网络、不安装依赖（复用 `tools/verify/node_modules`，不改任何 `package.json`）：

```bash
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const schema=JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8'));
const ajv=new Ajv({strict:true,allErrors:true});
const validate=ajv.compile(schema);
const lines=fs.readFileSync('fixtures/s6b-no-debug/events.ndjson','utf8').trim().split('\n');
let ok=0;
for(const [i,l] of lines.entries()){const e=JSON.parse(l);if(validate(e))ok++;else{console.error(i+1,JSON.stringify(validate.errors));process.exitCode=1;}}
JSON.parse(fs.readFileSync('fixtures/s6b-no-debug/expected-facts.json','utf8'));
console.log('lines',lines.length,'schema ok',ok);
EOF
```

核对点：`lines 2 schema ok 2`；service 的 `status/reason/flags` 精确；没有 `values` 键；`expected-facts.json` 可 `JSON.parse`。

## 与派发单的偏差

1. **fixture 是 2 事件 endpoint-only 链**：dispatch §4.1 的“no-debug 恰 2 span”就是 controller + service；no-debug 可为纯端点（无强制按钮），
   因此不虚构 click/fetch；代价是 `confidence=LOST`（合法游离后端根）。带头的 EXACT 变体在 `expected-facts.json` 注明。
2. **fixture 不写 `DROP_COUNT`**：与 S0–S6a 约定一致。
3. **`reason` 逐字英文**：由 dispatch §3/§4.3 固定为 `LocalVariableTable missing`（不是 `status-semantics.md` 的示例形态 `nodebug:no_local_variable_table`；
   两者都合法，S6b 选 dispatch 的逐字值）。