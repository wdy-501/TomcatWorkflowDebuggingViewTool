# 工作台摘要化 UI 更新（2026-11-24）

> 状态：**待用户审查**。包含最终工作台 UI、请求体采集与内置 Demo 新接口；schema 未改。

## 1. 用户反馈

1. 界面信息过多，重点不突出。
2. 无法直观看出一次请求从哪里开始触发。

## 2. 本次改动

- 新增“起点”横幅：显示页面点击动作、控件名称、页面源码或后端入口、后端方法、主要调用链、关联方式、节点数、SQL 影响。
- 控件名称：内置 Demo 映射（如 `#btn-cancel` → 取消订单），未知控件不伪造名称。
- 后端方法：显示控制器/服务/数据访问方法链；鼠标悬停显示从仓库根目录开始的源码路径。
- 最近请求：显示本地时间（月-日 时:分:秒）和请求耗时，悬停显示完整开始时间。
- 请求卡片精简：触发动作、节点数、后端节点数、请求次数、状态；traceId 等技术字段缩为次要行。
- 事实树改为“自上而下矩形树”：根节点在上，子节点和叶子在下，用树形连线连接；主链节点带步骤编号，叶子节点带“叶子”标识并默认显示；可切换“只看主链”；起点自动高亮并选中。
- 右侧节点详情按需显示：
  - 有值才显示 Values；
  - SQL 节点才显示 SQL/数据影响；
  - 同一方法多次调用才显示 ×N；
  - 缺口、技术字段、判定口径默认折叠；
  - 异步/无调试/折叠等专家信息保留。
- 长值默认 120 字符预览，“查看完整值”展开原始内容。
- 请求体采集：内置 Demo 新增 `POST /api/orders/{id}/remark`（接收 JSON `@RequestBody`）和“提交请求体”表单；SDK 在 fetch 节点采集 `query.*` / `body.*` 字段与值。本地演示**不做敏感字段脱敏**，`token` 原样显示；超过 2048 字符的值截断并标记。agent 为 `OrderController#remark` 增加 controller span，保持前后端 EXACT 关联。
- 标记说明：技术字段中的 flags 增加中文 tooltip，并增加默认折叠的“标记说明”列表，覆盖 `S2_ZERO_ROW_CHAIN`、`S3_EXACT_LINK`、`DROP_COUNT`、`L1/L2`、`ASYNC_INHERITED`、`NO_DEBUG_INFO`、`VALUES_CAPPED/TOTAL` 等。
- 每个节点详情都有“变量与参数”入口：有 values 时显示字段和值；没有采集时明确显示未采集原因。
- 内置“采集缺口”演示（案例 D）：
  - 无调试信息：service 状态 `NOT_COLLECTED_NO_DEBUG_INFO`，变量/行号未采集。
  - 未知订单取消：链路只有 controller/service，缺 mapper/SQL，service 正常返回 false。
  - 未接入后端请求：只有 click/fetch，confidence=LOST，出现“请求未关联”缺口。
- SQL 事务状态改为中文：`UNKNOWN` 显示为“未采集”，并说明只确认影响行数、不推断提交/回滚；缺口规则改为中文（请求未关联/影响行数未采集），并说明“未采集 ≠ 0、≠ 失败”。
- 界面主文案中文优先；`fetchCount`、`spanCount`、`sdkActive`、EXACT 等作为辅助技术字段保留。
- 最终上线版默认只保留“请求追踪台”：S0/S1/S2 历史面板从正式界面移除；代码和回归选择器仍保留，仅通过 `?legacy=1` 调试入口可见。
- 独立审阅后修复：来源标签区分页面/后端、错误态不再显示为“未采集”、轮询/切换链路的过期响应保护、回放中 SQL 未发生提示、详情标签状态夹紧、空原因隐藏、异步节点值区可见。

## 3. 验证

- `frontend/sdk`：18/18 单测通过；新增请求体字段、query、超长截断、无脱敏断言。
- 根 reactor（agent/collector/launcher）构建通过；Demo 后端构建通过；工作台构建通过（`vue-tsc --noEmit` + Vite）。
- 请求体 E2E：Demo 发送 JSON 后，工作台 fetch 节点显示 `body.reason/operator/priority/note/token` 原值；后端 `OrderController#remark` 以 EXACT 关联进入主链。
- 缺口 E2E：无调试服务显示 `未采集` + `LocalVariableTable missing`；未知订单链路停在 service；未接入后端请求显示 `LOST` 和缺口。
- 静态选择器与文案：S3 10 个、S4 11 个、S5 关键选择器，以及 S3/S4/S5/S6 共 50 个门禁 token 全部保留。
- 真实浏览器：
  - 案例 A：起点 `#btn-cancel`、主链 6 步、SQL 影响 0 行；点击 SQL 节点显示 `rowsAffected=0`。
  - 案例 B：起点 `#btn-save-b`、零请求判定“已确认”；节点 3 个、后端 0 个。
  - L1：`requestedAmount=100`、`demoSecret` 已脱敏、`note` 已截断、`amount 100 → 0`、`return 0`；长值默认折叠。
  - 回放：只读提示、未来事件隐藏、SQL 提示“尚未发生”。
- 时间轴：每个节点一个关键帧（点击/请求/控制器/服务/数据访问/SQL/前端方法/页面渲染）；点击轨道标记或下方关键帧文字，自动进入回放、跳到该节点开始时刻并选中节点；旁支关键帧会自动展开旁支。
- 超慢回放：速度档为 0.0001×、0.001×、0.005×、0.01×（默认）、0.05×、0.1×、0.5×、1×、2×、4×；按真实帧间隔推进，毫秒/微秒级链路可逐段观察。
- 浏览器控制台无错误。

## 4. 证据

- `docs/plans/stages/S3/evidence/workbench-summary-case-a.png`
- `docs/plans/stages/S3/evidence/workbench-summary-case-b.png`
- `docs/plans/stages/S3/evidence/workbench-summary-l1.png`
- `docs/plans/stages/S3/evidence/workbench-request-body.png`
- 归档：`docs/plans/archive/ui-summary-2026-11-24/`

## 5. 边界与未做

- 请求体字段仅在内置 Demo 的前端 fetch/XHR 上采集；后端 controller/mapper 方法参数不在本轮采集范围内，界面会明确显示未采集。
- 按用户要求，本地演示不做敏感字段脱敏；只对超过 2048 字符的值做截断并标记。
- 不实现 S9/S10 云端上传或执行。
- 工作台仍为非实时轮询（5 秒）。
- 用户审查前不提交、不发布。