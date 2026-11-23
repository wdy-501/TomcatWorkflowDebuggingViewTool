# 状态语义（status-semantics）

> 状态：DRAFT → G1 冻结｜版本：v1｜日期：2026-11-23
> 权威来源：主计划 §2.3（语义全集）、§8.3（置信度）、§8.5（聚合优先级）、§13.4（事件字段投影）
> 关系：本文解释语义；`schema/traceboard.event.v1.json` 的 `status`/`confidence` 枚举是机器投影，二者不可互相替代。

## 1. 原则：先摆事实，再谈结论

- 状态表达的是“方法/值发生了什么”，不是“业务对不对”。正常返回 `false`、抛异常、后续未采集是三种不同事实。
- 工具可以提示事实组合（如“SQL 影响 0 行，但 HTTP 200 且页面提示成功”），**不得**直接给出“这是 bug”的裁判。
- 0 行、`false`、空列表都是**正常返回值的事实**；是否异常由用户结合业务判断。
- 静默丢弃不可接受：任何未采集/截断/丢弃都必须以状态、`reason` 或 `DROP_COUNT` 可见（主计划 §9.2）。

## 2. 语义全集（主计划 §2.3，10 项）

| 状态 | 含义 | 界面表现（S1+ 实现，S0 只落契约） |
|---|---|---|
| `OK` | 方法正常返回（包括 true、数字、对象；返回 0 也是正常返回的事实） | 绿色/常规实线；返回值在节点详情展示 |
| `RETURNED_FALSE` | 方法正常返回了布尔 `false` | 琥珀色标签“正常返回 false”；不是异常 |
| `THREW` | 方法抛出异常 | 红色断线/闪电；“异常类型 + message + 顶部栈”可展开 |
| `NOT_COLLECTED_POLICY` | 被采集策略排除（第三方包、未开启深度档等） | 灰色虚线框；写明原因与如何开启 |
| `NOT_COLLECTED_LOST` | 事件丢失/关联丢失/采集中断 | 灰色虚线框；写明丢失环节与建议 |
| `NOT_COLLECTED_NO_DEBUG_INFO` | 字节码缺少调试信息，给不出局部变量名/行号 | 灰色虚线框；不猜变量名 |
| `TRUNCATED` | 值被截断/折叠/采样 | 条纹标记 + “已折叠 N 次 / 已截断至前 X 条” |
| `REDACTED` | 字段已脱敏 | 锁形标记；显示长度/哈希/占位符 |
| `UNKNOWN` | 进入方法但没有正常退出（进程结束、超时、崩溃） | 问号/断线；不伪装成成功 |
| `LOST`（关联） | 后端有请求但找不到前端根，或前端有请求但没有后端 span | 单独“游离片段”区；可手工关联并标 `MANUAL` |

## 3. 字段投影（关键规则）

`status` 在事件上只取 8 值，不含 `REDACTED`/`LOST`。全集的落点：

| §2.3 语义 | 事件上的落点 | 说明 |
|---|---|---|
| `OK` … `UNKNOWN`（8 值） | `status` 枚举 | 与 schema 完全一致 |
| `REDACTED` | **值级**：`values[].redacted=true`（`from/to` 只允许占位符/长度/哈希） | 事件级 `status` 仍是方法返回状态 |
| `LOST`（关联） | **置信度**：`confidence="LOST"` | 事件本身仍有自己的 `status`（如 `OK`） |
| 截断/折叠/采样 | 值级 `truncated=true`；事件级可在无值项时用 `status="TRUNCATED"` + `flags`/`reason` | 必须可见，不得静默 |
| 未采集 | `status="NOT_COLLECTED_*"` + 非空 `reason` | schema if/then 强制 |

推论：

1. 一个事件可以 `status=OK` 且 `confidence=LOST`（后端正常执行，但前端根丢失）。
2. 一个事件可以 `status=OK` 且 `values[0].redacted=true`（方法正常，值脱敏）。
3. 不得用 `status=REDACTED` 表示脱敏；不得用 `status=LOST` 表示关联丢失（schema 会拒绝）。

## 4. 置信度（主计划 §8.3）

| 置信度 | 条件 | 界面 |
|---|---|---|
| `EXACT` | traceparent + clickId 链路完整 | 实线，默认展示 |
| `INFERRED` | header 丢失，但时间窗 + method/path + bodyHash 等指纹吻合 | 点线/问号，明确“推断，可手工确认” |
| `LOST` | 只有一端（前端有请求后端无 span，或后端有请求无前端根） | 游离区；不强行并入 |
| `MANUAL` | 用户手工建立关联 | 虚线 + 手工标记；回放保持，但不伪装自动 |

未关联呈现：前端无对应请求 → 左图请求节点灰/问号；后端有请求无前端根 → 「游离后端请求」入口；
网关/CORS 丢 header → 优先同源代理，仍丢失则 `INFERRED/LOST`，**不静默合并**。

## 5. 聚合优先级（主计划 §8.5）

同一 `nodeKey` 合并为一个节点（×N），节点展示状态取最严重优先级：

```text
THREW > UNKNOWN > NOT_COLLECTED_* > TRUNCATED > RETURNED_FALSE > OK
```

- 聚合只影响主图显示；**每个 invocation 保留自己的真实状态与值**，详情里逐次查看。
- 被折叠/采样的调用必须在详情中列出缺口，不得只显示一个“看起来正常”的聚合值。
- `NOT_COLLECTED_*` 在聚合中同等处理，但 `reason` 必须能区分是策略、丢失还是缺调试信息。

## 6. `NOT_COLLECTED*` 的原因要求

| 状态 | `reason` 应包含 | 示例 |
|---|---|---|
| `NOT_COLLECTED_POLICY` | 策略名 + 开启方式 | `policy:third_party_package`、`policy:level_l0_skips_objects` |
| `NOT_COLLECTED_LOST` | 丢失环节 + 建议 | `lost:ingest_disconnected`、`lost:correlation_expired` |
| `NOT_COLLECTED_NO_DEBUG_INFO` | 缺失的调试信息 | `nodebug:no_local_variable_table`、`nodebug:no_line_table` |

- `reason` 非空、≤512 字符、建议 `category:detail` 小写形式；空字符串会被 schema 拒绝。
- 用户界面上必须能回答两问：“为什么没采到？”“怎么才能采到？”。

## 7. 事实摘要 vs 结论（case A 口径）

case A（`fixtures/case-a-zero-rows`）的摘要应写成：

> 写 SQL 0 行 · Mapper 返回 0 · Service 返回 true · HTTP 200 · 页面提示“操作成功” · 0 异常

- 这是事实组合；可以提示“影响 0 行但返回成功，值得核对业务是否允许 0 行”。
- 不得显示“保存失败”“bug 已定位”等结论性文案；也不得用绿色/红色做成功失败裁判。
- S0 fixture 全部 `status=OK`、`confidence=EXACT`、`flags` 含 `DROP_COUNT=0`，**没有**任何降级状态；
  不要为了让样例“丰富”而伪造异常/未采集状态。

## 8. 回放与状态

- 回放状态 = 所有 `timestamp ≤ 滑块时间` 的事件；未来事件不显示或显示为“未发生”（主计划 §2.4）。
- 状态标签随虚拟时钟推进；回放**只读**，不调用后端、不发 HTTP、不触发 SQL，不提供“再次执行”。
- 回放保留 `confidence` 与 `reason`，不改写成 `EXACT`；`MANUAL` 关联在回放中保持手工标记。

## 9. 验收口径（对应主计划 T7）

S0 只判定契约层：

1. schema `status` 枚举恰为 8 值，且与 §2.3 前 8 行一致；
2. `REDACTED` 仅出现在值级字段，`LOST` 仅出现在 `confidence`；
3. `NOT_COLLECTED*` 缺 `reason` 或 `reason=""` 必须被 schema 拒绝；
4. case A 的 5 条事实可读出，且全部 `OK`（见 `expected-facts.json`）。

S1+ 才验收界面表现（颜色/线型/图标/游离区）；S0 不实现、不声称已支持。