# case-a-zero-rows — 0 行链（事实样例）

> S0 契约样例：一条“点击取消订单 → SQL 影响 0 行 → HTTP 200 → 页面提示操作成功”的完整链路。
> 数据只来自 `events.jsonl`；本文件解释**事实**，不下 bug 结论。

## 1. 场景（虚构）

示例订单系统 BuggyShop 中，用户在订单详情页点击「取消订单」：

1. 浏览器点击 `#btn-cancel` 按钮（根事件 `rootEventId=click_a1b2c3d4`）；
2. Vue 方法 `OrderDetail.vue#onCancel` 先调用 `OrderDetail.vue#validateForm`（返回 true），再发起
   `POST /api/orders/1/cancel`；
3. 后端 `OrderController#cancelOrder → OrderServiceImpl#cancelOrder → OrderMapper#cancelById`；
4. 实际执行的 SQL `OrderMapper.cancelById`（`UPDATE orders ...`）影响 **0 行**，事务 `COMMITTED`；
5. HTTP 响应 200；响应回调 `OrderDetail.vue#onCancelled` 出现提示「操作成功」。

## 2. 事件链（9 行，文件行序）

| # | kind | nodeKey | 线程 | status | 关键事实 |
|---|---|---|---|---|---|
| 1 | ui_event | `#btn-cancel` | browser-main | OK | 点击根，`parentSpanId=null` |
| 2 | js_method | `OrderDetail.vue#onCancel` | browser-main | OK | 点击处理器 |
| 3 | js_method | `OrderDetail.vue#validateForm` | browser-main | OK | 返回 `true` |
| 4 | fetch | `POST /api/orders/1/cancel` | browser-main | OK | `return.type=http, return.value=200` |
| 5 | controller | `com.example.shop.controller.OrderController#cancelOrder` | http-nio-8080-exec-1 | OK | 返回 `{data:true}` |
| 6 | service | `com.example.shop.service.OrderServiceImpl#cancelOrder` | http-nio-8080-exec-1 | OK | 返回 `true` |
| 7 | mapper | `com.example.shop.mapper.OrderMapper#cancelById` | http-nio-8080-exec-1 | OK | 返回 int `0` |
| 8 | sql | `OrderMapper.cancelById` | http-nio-8080-exec-1 | OK | `sideEffects[0].rowsAffected=0`，`COMMITTED` |
| 9 | callback | `OrderDetail.vue#onCancelled` | browser-main | OK | `return.type=ui_effect, return.value=操作成功` |

因果链：1 → 2 → 3；2 → 4 → 5 → 6 → 7 → 8；4 → 9。全部事件共享
`traceId=4bf92f3577b34da6a3ce929d0e0e4736`、`rootEventId=click_a1b2c3d4`；
`startNs` 单调递增，子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。**唯一例外**：
`kind=callback`（响应回调）允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span
（`parentSpanId=null` 的祖先）区间内。

按此口径，第 9 行 callback 在其父 fetch（第 4 行，区间 `[6ms, 38ms]`）结束后启动，起点 `39ms`
（**晚 1ms，属设计如此**），区间 `[39ms, 48ms]` 完整落在根 span（第 1 行，`[0ms, 52ms]`）内；
其余 7 个非根 span 均满足严格父子包含，无违规。

## 3. 五条期望事实（与 `expected-facts.json` 一一对应）

| 事实 | 断言 | 含义 |
|---|---|---|
| F1 SQL | `sideEffects.0.rowsAffected = 0`，status OK | 数据库写操作执行了，但一行都没改到 |
| F2 Mapper | `return.value = 0`，status OK | Mapper 把 0 行作为正常返回值交给上层 |
| F3 Service | `return.value = true`，status OK | Service 正常返回 true（本样例不含异常分支） |
| F4 HTTP | `return.value = 200`，status OK | 浏览器侧收到 HTTP 200 |
| F5 UI | `return.value = "操作成功"`，status OK | 回调后出现成功提示（UI 效果摘要，非像素回放） |

全局断言：`eventCount=9`、`traceId`/`rootEventId` 与事件一致、`noExceptions=true`、
`confidenceAllExact=true`、`statusAllOk=true`、每行 `flags` 含 `DROP_COUNT=0`。

## 4. 事实与结论的边界

- 五条事实组合起来是：**SQL 改 0 行、Mapper 返回 0、Service 仍返回 true、HTTP 200、页面提示成功**。
- 这是“事实摘要”，不是“bug 判定”：业务可能允许 0 行（幂等取消、重复提交等），
  是否需要告警由用户判断。S0 只把事实摆出来，不显示绿色成功/红色失败裁判。
- 0 行不是错误状态：`status=OK` 表示方法正常返回；`rowsAffected=0` 是正常返回值的事实。
- 本样例没有异常事件、没有截断/脱敏、没有未采集节点；`confidence` 全为 `EXACT`。

## 5. 使用方式

- 逐行校验：`(cd "tools/verify" && node verify.mjs)`（Ajv 2020-12 + 期望事实断言）。
- 工作台展示：`workbench` 构建前由 `scripts/sync-fixtures.mjs` 复制本目录到 `public/fixtures/`。
- 只读约束：本目录文件在 G1 后冻结；任何修改需契约变更并由 reviewer 复核，不得静默追加语义。