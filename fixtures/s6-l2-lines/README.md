# fixtures/s6-l2-lines

本目录是 S6a 测试数据，不是运行时证据；运行时 L2 由 demo+agent 产生；fixture 行号不承诺与实际编译行号一致。不含真实 secret。

S6a（选中方法行级局部变量 + 逐次 ×3）的**契约夹具**：手工构造的 6 条事件，用来冻结
「`values` 中 `kind=local` + 1-based `line` + 逐次 `invocation`」与「同 nodeKey ×3」的**形状**。
真实证据必须来自 `docs/plans/stages/S6/s6a-plan.md` 的 S6A-C（demo + javaagent ASM LVT 探针 E2E），
**不得**引用本目录冒充运行时能力（异步/无调试信息/循环折叠/开销属 S6b，本目录也不证明它们）。

## 文件

| 文件 | 作用 |
| --- | --- |
| `events.ndjson` | 6 条 `traceboard.event.v1` 事件（compact JSON，1 行 1 条，无空行、无 BOM），Ajv 2020 strict 通过 |
| `expected-facts.json` | 期望事实：requests 1 行（EXACT/6 span/`fetchCount=1`/`backendSpanCount=4`）/ graph 6 节点 5 边（每节点 15 键）/ 13 条 fact / 工作台选择器与文案 |

`expected-facts.json` 的 `note` 已注明本目录**不是运行时证据**；
`initLine=22` / `badLine=24` / `serviceSource.line=22` 都是示意值，测试须从 `L2DemoService.java` 重算行号再比对。

## 事件链（1 root，6 span，EXACT）

```
ui_event   #btn-reconcile                       b000000000000001  flags: SDK_ACTIVE,OBSERVE_MS=1500
└─ fetch   POST /api/orders/1/reconcile          b000000000000002  flags: SDK_ACTIVE
   └─ controller OrderController#reconcile       b000000000000003  OrderController.java:73  flags: S2_ZERO_ROW_CHAIN
      ├─ service L2DemoService#reconcileAmount   b000000000000004  L2DemoService.java:22    flags: S2_ZERO_ROW_CHAIN,L2   return 100
      ├─ service L2DemoService#reconcileAmount   b000000000000005  L2DemoService.java:22    flags: S2_ZERO_ROW_CHAIN,L2   return 0
      └─ service L2DemoService#reconcileAmount   b000000000000006  L2DemoService.java:22    flags: S2_ZERO_ROW_CHAIN,L2   return 100
```

- 区间严格嵌套且 3 个 service 的 `startNs` 严格递增：`8000000000 ⊃ 8002000000 ⊃ 8005000000`
  内依次 `8006000000 < 8019000000 < 8032000000`（父区间均包住子区间）。
- 前端线程 `{id:0,name:"browser-main"}`；后端线程 `{id:44,name:"http-nio-8080-exec-1"}`。
- `startNs` 取 8e9 量级（< 2^53），保证 JS 读回精确。
- 3 个 service span 的 `nodeKey` 相同、`parentSpanId` 均等于 controller spanId；`reconcileBatch` **不插桩**、无 span。
- **只有 3 个 service span 携带 `values`**；click/fetch/controller 省略该键（graph 渲染 `null`，不默认 `[]`）。

## values（仅 `kind=local`；顺序即探针执行顺序）

| 第 i 次（按 startNs） | spanId | 值项 | 断言 |
| --- | --- | --- | --- |
| 1 | `b000000000000004` | `local` line=22，from=`null`，to=`100`，invocation=1 | 恰 1 项 |
| 2 | `b000000000000005` | ① line=22，null→100，invocation=2；② line=24，100→0，invocation=2 | 恰 2 项；② 是关键事实（坏行） |
| 3 | `b000000000000006` | `local` line=22，from=`null`，to=`100`，invocation=3 | 恰 1 项 |

- 每项固定字段 `name,kind,line,from,to,truncated,redacted,invocation`；`truncated=false`、`redacted=false`。
- `previous` 只在帧内有效（按 `(frame,name)` 记上一值），首次或值变化才追加；因此每次调用首项 `from=null`，
  同值探针（`if`/`return` 行）**不追加**——第 2 次恰 2 项而不是“每个执行行一项”。
- UI “值变化”判定：`kind ∈ {local, field}` 且 `from` 非空且 `from !== to`；**首次观测 `from=null` 不是变化**，
  故第 1/3 次 `diff=false`、仅第 2 次 `diff=true`（见 `expected-facts.json` 的 `diffRule`/`perSpanDiff`）。
- 工作台分两层断言：dist 只做**静态 token**（选择器名、`行号 `、`100 → 0`、`值变化`、canonical 文案）；
  `[data-value-kind="local"]`/`data-invocation-diff="true"`/`第 2/3 次` 是 Vue 动态属性/插值，改由纯函数
  （`workbench/src/s6/**`）与 S6A-C 运行时 values + 浏览器 DOM 断言证明，**不得**当作 dist 字面量。
- 行号是 **1-based 源行**，来自 LVT/行表；不是 `source.line`（`source` 来自 JVM 栈，两者不混用）。
- 数组顺序是契约；**事件对象内键序与 `values` 项内键序不属契约**（`values` 恰好写在 `flags` 之后，仅演示；测试按 JSON 语义比对）。
- `values` 项数远低于 ≤30 预算，不触发 `VALUES_CAPPED`/`L1_SKIPPED`；S6a 不做循环折叠/采样。

## 明确排除（不要从这里读出能力）

- **没有 L1**：3 个 service span 不带 `L1`；L2 span **不出现** `param`/`field`/`return` 值项（返回值在事件 `return` 字段）。
- **没有其他方法的 L2**：`reconcileBatch`、`OrderService`、`OrderController#cancel/previewDiscount` 等不在插桩范围；
  类/方法/LVT 缺失时 agent fail-open、不发事件（完整无调试信息语义属 S6b）。
- **没有异步**：无 `async`/`callback`/线程池/`CompletableFuture`/`@Async`；无 `NOT_COLLECTED_NO_DEBUG_INFO` 事件/reason。
- **没有字段写入/对象深采/循环折叠/采样/预算/开销门槛**：这些属 S6b。
- **flag 断言用“包含”**：运行时可追加建议性 flag（如 `DROP_COUNT=<n>`、`S3_RUNTIME_SDK`），fixture 不写；断言 `includes("L2")`
  且断言不存在 `L1`/`LOST_BACKEND`/`VALUES_CAPPED`/`L1_SKIPPED`，**不得**与运行时整数组深比较。

## 验证

离线、无网络、不安装依赖（复用 `tools/verify/node_modules`，不改任何 `package.json`）：

```bash
node - <<'EOF'
const fs=require('fs');
const Ajv=require('./tools/verify/node_modules/ajv/dist/2020.js').default;
const schema=JSON.parse(fs.readFileSync('schema/traceboard.event.v1.json','utf8'));
const ajv=new Ajv({strict:true,allErrors:true});
const validate=ajv.compile(schema);
const lines=fs.readFileSync('fixtures/s6-l2-lines/events.ndjson','utf8').trim().split('\n');
let ok=0;
for(const [i,l] of lines.entries()){const e=JSON.parse(l);if(validate(e))ok++;else{console.error(i+1,JSON.stringify(validate.errors));process.exitCode=1;}}
JSON.parse(fs.readFileSync('fixtures/s6-l2-lines/expected-facts.json','utf8'));
console.log('lines',lines.length,'schema ok',ok);
EOF
```

核对点：`lines 6 schema ok 6`；3 个 service 的 values 项数为 1/2/1；第 2 次第二项 `100→0` 且行号与首项不同；
`events.ndjson` 无 secret/真实数据；`expected-facts.json` 可 `JSON.parse`。

## 与派发单的偏差

1. **附录编号**：dispatch §5.1 写“附录 E reconcile”，但 `api.v1.md` 附录 E 已被 S5 前端浅层占用（历史不改写），
   S6a 使用 **附录 F**；内容与 dispatch §3 一致（见 `s6a-plan.md` 偏离 D1）。
2. **fixture 不写 `DROP_COUNT`**：与 S0–S5 fixture 约定一致（fixture 不是运行时字节快照）；运行时 emitter 总会写
   `DROP_COUNT=<n>`，断言按“包含/禁项”而非深比较（`flagsAreContainsOnly:true`）。
3. **行号 22/24 为示意**：`s6a-plan.md` §4 的 demo 源码把初始化行/坏行放在可重算位置；实际编译/格式化可能漂移，
   测试与 CI 一律从 `L2DemoService.java` 重算，**不硬编码** fixture 行号。
4. **`invocation` 恒出现**：S6a 的每个 local 项都带 `invocation`（schema 可选，S6a 必写）；S5 的单次调用仍省略。
5. **LVT 探针边界**：活性范围 **含 Start**（初始化探针偏移=LVT Start，javac8 实测 Start 3）；只在行边界插探针，
   以 jump/return/switch 结束的行不插；demo 恰 2 个探针，日志 `l2_probes_installed offsets/lines` 自检，缺失即 fail-open（不造假值）。