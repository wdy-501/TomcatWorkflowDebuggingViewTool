# fixtures/ — 事件流样例与期望事实

> 版本：v1（S0）｜权威契约：`schema/traceboard.event.v1.json`、`docs/contracts/event-model.v1.md`
> 本目录是**契约样例**，不是采集产物；S0 不采集、不关联，所有事件均为手写或派生的事实样例。

## 1. 目录约定

```text
fixtures/
├── README.md                      # 本文件：格式与规则
└── <case-id>/                     # 一个案例一个目录，kebab-case，如 case-a-zero-rows
    ├── README.md                  # 案例叙事：链路与事实含义（不写“这是 bug”）
    ├── events.jsonl               # append-only 事件流（唯一事实源）
    └── expected-facts.json        # 机器可读的期望事实（校验工具消费）
```

- 新案例必须新建目录，不得复用/改写既有案例文件；案例之间不共享行。
- `expected-facts.json` 只描述「从 events.jsonl 能读出的事实」，不引入事件里没有的数据。
- S0 已有的案例：`case-a-zero-rows`（0 行链）。更多案例属于 S2/S3，不在本阶段创建。

## 2. JSONL 规则（append-only）

1. UTF-8 **无 BOM**；一行一个**紧凑** JSON 对象（无换行、无缩进）；**末行必须带换行符**。
2. 空行、注释行、Markdown、逗号结尾、JSON 数组包裹一律非法。
3. **只追加**：不修改、不删除、不重排既有行；读取方按文件行序消费。
4. 事件按 `startNs` 非降序追加（同一时刻允许并列，保持追加顺序稳定）。
5. 每行必须通过 `schema/traceboard.event.v1.json`（JSON Schema 2020-12）。校验入口：`(cd "tools/verify" && node verify.mjs)`。
6. 文件行数必须等于 `expected-facts.json.eventCount`；修改事件必须走契约变更 + reviewer，不允许静默漂移。
7. 提交前确认换行为 LF；Windows 编辑器若写入 CRLF 视为格式错误（校验工具会拒绝 `\r`）。

## 3. 标识与时间规则

| 项 | 规则 |
|---|---|
| `sessionId` | `s_` + `[A-Za-z0-9_-]+`；一个案例一个会话 |
| `traceId` | 32 位小写 hex；W3C `traceparent` 语义；同一操作链共用 |
| `spanId` | 16 位小写 hex；会话内唯一 |
| `parentSpanId` | 16 位小写 hex 或 `null`；根事件（本次点击）为 `null` |
| `rootEventId` | `click_` + ≥8 位 `[A-Za-z0-9_-]`；前端点击生成，后端 span 继承 |
| `startNs`/`durNs` | 相对会话起点的单调纳秒，int ≥ 0；只增不减 |

因果一致性（校验时会人工/脚本抽查）：

- 子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。**唯一例外**：`kind=callback`（响应回调）允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span（`parentSpanId=null` 的祖先）区间内。
- 同一 `traceId` 的 `rootEventId` 完全一致；跨端（fetch → controller）通过 `parentSpanId` 显式连接。
- 允许“父 span 尚未结束、子 span 已结束”的正常嵌套；不允许子 span 早于父 span 开始。

## 4. 状态与置信度

- `status` 只能是 schema 的 8 值集合；语义全集见 `docs/contracts/status-semantics.md`。
- 值级 `REDACTED`/`TRUNCATED` 落在 `values[].redacted` / `values[].truncated`，不写进 `status`。
- 关联置信度 `LOST` 落在 `confidence`，不写进 `status`。
- `NOT_COLLECTED*` 必须带非空 `reason`（`category:detail` 形式，如 `policy:third_party_package`）。
- flag 约定：`DROP_COUNT=<n>` 表示会话内已知丢弃数；`SAMPLED`、`L2` 为预留标记。flag 不改变 status。
- 案例 A 全部为 `OK`、`EXACT`、`DROP_COUNT=0`：SQL 影响 0 行是“正常返回的事实”，不是错误。

## 5. `expected-facts.json` 形状（供 Node 校验器消费）

```json
{
  "schema": "traceboard.expected-facts.v1",
  "eventCount": 9,
  "traceId": "…", "rootEventId": "…",
  "noExceptions": true, "confidenceAllExact": true, "statusAllOk": true,
  "flagRequired": "DROP_COUNT=0",
  "facts": [
    { "id": "F1", "kind": "sql", "nodeKey": "OrderMapper.cancelById",
      "status": "OK", "assert": { "path": "sideEffects.0.rowsAffected", "value": 0 } }
  ]
}
```

- 目标事件选取：按文件行序取**第一条** `kind` 与 `nodeKey` 同时匹配的事件；找不到即 FAIL。
- `status`：目标事件的 `status` 必须等于该值。
- `assert.path`：点号分段；数字段表示数组下标（`sideEffects.0.rowsAffected`）；叶子值按 JSON 深比较。
- `noExceptions`：不存在 `status=THREW` 的事件，且事件里不出现 `exception` 字段。
- `confidenceAllExact` / `statusAllOk` / `flagRequired`：对所有行做全量断言。
- `eventCount`：非空行数必须一致。

## 6. 隐私与安全（硬规则）

- 禁止真实客户数据、真实姓名/手机号/邮箱/身份证/银行卡、真实 token/cookie/session。
- 只允许虚构的示例标识（如订单 `1`、金额 `0`）与公开规范示例值；不写入任何 secret。
- 示例 URL 只用 `localhost`/相对路径；不写入可访问的第三方地址。
- 事件中的 `source.file` 使用虚构的示例工程相对路径，不指向本机绝对路径。

## 7. 与工作台的关系

- 工作台不直接 import `fixtures/`；由 `workbench/scripts/sync-fixtures.mjs` 复制到
  `workbench/public/fixtures/`（该副本已 gitignore），构建/开发前由 npm `predev`/`prebuild` 触发。
- S0 工作台只读展示：事件数、每行 `type/kind/status`、以及 `expected-facts.json` 的 5 条事实卡。
- fixture 是 S0 唯一的数据来源；工作台不得连接 collector、不得发起 API/WebSocket 调用。