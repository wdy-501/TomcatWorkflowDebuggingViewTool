# fixtures/s6b-async

本目录是 S6b 异步继承测试数据，不是运行时证据；真实线程 id、继承后的 `invocation` 1/2/3、`ASYNC_INHERITED` 与第 2 次 `100 → 0` 必须来自 demo `L2DemoService#reconcileAsync` + javaagent 的 InheritableThreadLocal/ASM E2E（S6B-A）；fixture 行号不承诺与实际编译行号一致。不含真实 secret、不含 S3 demo 会话 ID。

S6b（异步**创建时**继承）的**契约夹具**：手工构造的 6 条事件，用来冻结
「同一 trace/父、同一异步 worker 线程、flag `ASYNC_INHERITED`、`values` 1/2/1」的**形状**。
`expected-facts.json` 另含工作台 `#s6-async-badge`、canonical 文案与反向断言；**不得**引用本目录冒充运行时能力
（无调试信息/循环折叠/开销属 S6B-B/C/D，本目录也不证明它们）。

## 文件

| 文件 | 作用 |
| --- | --- |
| `events.ndjson` | 6 条 `traceboard.event.v1` 事件（compact JSON，1 行 1 条，无空行、无 BOM），Ajv 2020 strict 通过 |
| `expected-facts.json` | 期望事实：requests 1 行（EXACT / 6 span / `backendSpanCount=4`）/ graph 6 节点 5 边（每节点 15 键）/ 12 条 fact / 工作台选择器与文案 / 反向断言 |

## 事件链（1 root，6 span，EXACT）

```
ui_event   #btn-reconcile-async                       c000000000000001  thread 0 browser-main   flags: SDK_ACTIVE,OBSERVE_MS=1500
└─ fetch   POST /api/orders/1/reconcile-async         c000000000000002  thread 0 browser-main   flags: SDK_ACTIVE
   └─ controller OrderController#reconcileAsync        c000000000000003  thread 44 http-nio-8080-exec-1
      ├─ service L2DemoService#reconcileAmount         c000000000000004  thread 57 pool-1-thread-1  return 100  flags: S2_ZERO_ROW_CHAIN,L2,ASYNC_INHERITED
      ├─ service L2DemoService#reconcileAmount         c000000000000005  thread 57 pool-1-thread-1  return 0    （values 1/2/1 中的 2）
      └─ service L2DemoService#reconcileAmount         c000000000000006  thread 57 pool-1-thread-1  return 100
```

- 区间严格嵌套：click `9.000s–9.062s` ⊃ fetch `9.002–9.058` ⊃ controller `9.005–9.053`；
  3 个 service 的 `startNs` 严格递增 `9.006 < 9.019 < 9.032`，结束均 ≤ controller 结束。
- **3 个 service 同 `nodeKey`、`parentSpanId` 均等于 controller spanId、`thread.id` 均为 57 且 ≠ controller 的 44**；
  `traceId`/`rootEventId`/`confidence=EXACT` 由继承副本保留。
- `ASYNC_INHERITED` **只在 3 个 service span 上**；click/fetch/controller 不带；**同线程**的 S6a `reconcile` 也不带（跨 fixture 反向断言）。

## values（与 S6a 同形状；只 `kind=local`）

| 第 i 次（按 startNs） | spanId | 值项 | 断言 |
| --- | --- | --- | --- |
| 1 | `c000000000000004` | `local` line=22，from=`null`，to=`100`，invocation=1 | 恰 1 项 |
| 2 | `c000000000000005` | ① line=22，null→100，invocation=2；② line=24，100→0，invocation=2 | 恰 2 项；② 是坏行 |
| 3 | `c000000000000006` | `local` line=22，null→100，invocation=3 | 恰 1 项 |

- `previous` 在**继承副本帧**内独立；每次调用首项 `from=null`，同值探针不追加（与 S6a 相同）。
- 3 个 service 的 `thread.id` 相同（同一 per-request 单 worker）；若实现改成固定 3 线程，每个 worker 各得 `invocation=1`，本 fixture 的 1/2/3 与 `childCallCounts` 语义都会失败。
- 行号/`source.line` 都是**示意**；测试从 `L2DemoService.java` 重算初始化行与坏行。
- 数组顺序是契约；事件对象内键序与 `values` 项内键序不属契约（按 JSON 语义比对）。

## 明确排除（不要从这里读出能力）

- **没有** `@Async`/`CompletableFuture`/ForkJoinPool/框架续体传播；**没有**启动期长生命周期池/已存在线程的继承
  （那些场景无父帧 → `l2_no_parent`，不发假 span；复用旧 worker 可能带过期 trace）。`ASYNC_INHERITED` 只证明“上下文来自继承的父帧”。
- **没有** `kind=async` 事件、跨服务/跨 JVM、SSE/WS、持久化；**没有**行级字段写入、对象深采、多方法 L2。
- 脚本无头（无 `traceparent`/`X-TraceBoard-Click`）运行是合法的 4-span LOST 子链（controller 游离根 + 3 个继承 LOST 的 service），
  `backendSpanCount` 同为 4；见 `expected-facts.json` 的 `scriptedVariantNote`。
- **flag 断言用“包含”**：运行时可追加 `DROP_COUNT=<n>` 等建议性 flag；断言 `includes("L2")`/`includes("ASYNC_INHERITED")`，
  且不存在 `L1`/`LOST_BACKEND`/`VALUES_CAPPED`/`VALUES_TOTAL`/`NO_DEBUG_INFO`，**不得**整数组深比较。

## 验证

离线、无网络、不安装依赖（复用 `tools/verify/node_modules`，不改任何 `package.json`）：

```bash
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const schema=JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8'));
const ajv=new Ajv({strict:true,allErrors:true});
const validate=ajv.compile(schema);
const lines=fs.readFileSync('fixtures/s6b-async/events.ndjson','utf8').trim().split('\n');
let ok=0;
for(const [i,l] of lines.entries()){const e=JSON.parse(l);if(validate(e))ok++;else{console.error(i+1,JSON.stringify(validate.errors));process.exitCode=1;}}
JSON.parse(fs.readFileSync('fixtures/s6b-async/expected-facts.json','utf8'));
console.log('lines',lines.length,'schema ok',ok);
EOF
```

核对点：`lines 6 schema ok 6`；3 个 service 的 values 项数为 1/2/1；第 2 次第二项 `100→0`；3 个 service `thread.id` 相同且 ≠ controller；
`ASYNC_INHERITED` 只在 service；`expected-facts.json` 可 `JSON.parse`。

## 与派发单的偏差

1. **fixture 是浏览器链（6 事件）**：dispatch §4.1 的“async 恰 4 span”指后端 span（controller + 3 service），本目录的 `backendSpanCount` 同为 4；
   加 click/fetch 是为了让 `confidence=EXACT` 与单一根不变量成立（否则 controller 只能是 LOST 游离根）。脚本无头变体已在 `expected-facts.json` 注明。
2. **fixture 不写 `DROP_COUNT`**：与 S0–S6a 约定一致（fixture 不是运行时字节快照），断言按“包含/禁项”。
3. **行号 22/24 为示意**：测试与 CI 从 `L2DemoService.java` 重算，不硬编码。
4. **`ASYNC_INHERITED` 不承载“框架异步”语义**：只表示跨线程继承来源。