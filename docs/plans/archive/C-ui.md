# C — Product UI / Frontend 个人实施计划（历史）

> **已废弃：这是三人模式的历史计划，不要按它安排当前任务。** 当前单人计划见 [../SOLO-PLAN.md](../SOLO-PLAN.md)。  
> 版本：v1.1（历史）  
> 角色：C（Product UI / Frontend Owner）  
> 状态：归档。  
> 主计划：[../00-master-plan.md](../00-master-plan.md)  
> 单人入口：[../README.md](../README.md)

## 0. 使命

把事件流变成可读的电路板：工作台、节点详情、时间轴/回放、接入向导、采集范围；以及前端 runtime SDK 和 Vite/Webpack 构建插件。

要求：

- 主图一眼能看出异常事实；请求切换/后台轮询/未采集不混淆。
- 回放只读：不重新发请求、不触发后端；滑块停在哪，图和数据回到那一刻。
- 不做独立原型设计图/HTML/PNG；直接实现 Vue3 工作台，用 fixture 驱动。
- 默认突出项目方法；第三方折叠；缺数据有原因；颜色之外还有文字/图标。

## 1. 边界

**你负责：**

- `workbench/`：Vue3 + TypeScript 工作台、图、详情、时间轴/回放、向导、空状态、可访问性。
- `frontend/sdk/`：runtime SDK（点击/控件身份/fetch/XHR/DOM 效果/traceparent）。
- `frontend/build-plugin/`：共享 Babel 插桩核心 + Vite/Webpack 适配 + Vue/React 适配 + manifest。
- demo 前端、fixtures、UI 验收。
- 设计 token/界面规范；不做独立设计图。

**你不碰：**

- `agent/` 字节码/探针（A）。
- collector/cloud/launcher 内部实现（B）。
- schema 最终字段（B；你提需求并 review）。
- 不经会签改“未采集”/状态/隐私语义。

## 2. 必读主计划章节

- 0 结论、2 图语义、3 用户流程、4 工作台、5/6 案例、19 界面规范、20/21.3 本计划。
- 关键约束：桌面优先 1440×900/最低 1280×720；无外部 CDN；深色电路板；回放只读；云端首发只 JAR；不做独立原型图。
- 事件字段见主计划 13.4；API/WS 由 B 提供；fixture 先用主计划 5/6 的 0 行与纯前端案例。

## 3. 开工检查点（独立开工，不等任何人）

1. 建 `workbench/` Vue3 + TS + Vite 骨架；定义 CSS 变量/设计 token（主计划 19.5）。
2. 搭 AppShell：Header、Legend、左前端/右后端 Split、Timeline 占位。
3. 用 0 行 fixture 画静态前端图/后端图；请求 Tab 可切换；节点可点开静态详情。
4. 建 `frontend/sdk` 骨架：捕获 click、包装 fetch/XHR、生成 traceparent；先 console/fixture 输出。
5. 给 A/B 反馈：控件身份缺什么字段、请求/回调缺什么上下文；不自行加 schema 字段。

**开工检查点产物：** 可切换请求的 fixture 工作台 + 点击/请求事件输出。完成即按第 4 节 `C0` 同步，不按天数判断。

## 4. 检查点与同步

**每个检查点完成时，先停止、跑验证、写进度包，按 `SYNC` 列等待；不要自动进入下一行。**

| 检查点 | 重点 | 交付/验收 | SYNC | 依赖 |
|---|---|---|---|---|
| C0 开工切片 | 设计 token、AppShell、组件树、fixture、SDK 骨架 | fixture 图可点；点击/请求可输出 | ALL | B schema、A 事件样例 |
| C1 前端事实 | 点击/控件身份/请求/DOM 效果/traceparent；请求 Tab | 点击→请求→DOM 可关联 | ALL | B schema、A 事件 |
| C2 0 行界面 | S4/S5/S6/S7 最小界面、请求切换、时间轴/回放、状态语义、纯前端空状态 | 0 行案例 3 次点击；纯前端“确认没发” | ALL | A 事实、B API |
| C3 完整工作台 | 详情 Tabs、×N、sourcemap、接入向导 S2/S3、采集范围 S9、回放 | P1 门：新手 ≤10 分钟；案例 A/B；缺口可读 | ALL | A/B 后端 |
| C4 React/Webpack | React18/Webpack5 插件、事件/组件映射、UI 效果、可访问性、响应式折叠 | P2 门：三类项目控件→处理器；toast/表格/按钮摘要 | ALL | A Tomcat/L2、B runner |
| C5 云端界面 | 云端上传/启动诊断 S8、会话/项目 S10、云本地一致性、错误状态 | P3 门：云端 Boot JAR 案例 A/B；同一套图 | ALL | B 云端 |
| C6 发布打磨 | UI 打磨、安装包前端、用户测试、可访问性/国际化、文档/演示 | P4 门：3–5 名新手测试；无阻断式 UI 缺陷 | ALL | 全员 |

**C 的局部检查点：** 单个组件、样式、测试、fixture、可访问性修复可以标 `SYNC: LOCAL`；完成后自检并更新计划，不触发三人同步。

**Stop-and-Sync：** 到达 C0–C6 任一检查点，按 README 第 5 节输出进度包，然后输出 `SYNC REQUIRED: C2 | scope: ALL | reason: ...`，停止当前回合；收到明确“继续”后才开始下一检查点。

## 5. 界面与组件

屏幕清单（详细线框见主计划 19.2/19.3）：

- S1 官网/坏示例；S2 模式选择/接入向导；S3 本地连接检测；S4 工作台实时图；S5 节点详情；S6 纯前端空状态；S7 回放；S8 云端上传/启动；S9 采集范围；S10 会话/项目列表。
- P0 只做 S4/S5/S6/S7 的最小可用界面；其余按阶段接入。

组件树（主计划 19.4）：

```text
AppShell
├── SessionHeader
├── LegendBar
├── SplitPane
│   ├── FrontGraph
│   └── BackendPanel
│       ├── RequestTabs
│       ├── BackendGraph
│       └── FactSummaryStrip
├── TimelineBar
└── NodeDetailDrawer
```

关键交互：

- 点击请求入口切右图；后台请求不进请求 Tab。
- 同一方法 ×N 只画一个节点；详情按 invocation 分开展示。
- 未采集=灰虚线+原因；false/0=琥珀+文字；异常=红+断线；截断/脱敏有标记。
- 回放只读；不提供“重新执行”按钮；滑块时间决定显示的节点/值/UI 效果。

## 6. 前端采集与构建插件

- runtime SDK（F0/F1）：捕获阶段点击/提交、控件身份（ID/名称/文本/DOM 路径/位置）、fetch/XHR 请求体/响应、DOM 变化摘要（toast/表格/按钮/路由）、console 错误；生成 traceparent。
- 构建插件（F2）：共享 Babel AST 核心；Vite/Webpack 薄适配；Vue3 模板/`<script setup>` 与 React JSX 事件包装；函数入口/关键赋值/异步回调；产出 manifest（id→组件/文件/行）。
- 异步上下文：只在操作存在时包装 Promise.then/setTimeout/rAF 等；丢失标 `LOST`；不硬连。
- sourcemap：可选上传/映射；没有插件时明确“JS 内部未采集”；不猜变量。
- 隐私：默认脱敏；请求体大小/字段限制；不捕获密码；不把真实数据放进 fixture；云端强制。
- 没有 sourcemap/插件时仍能证明“请求有没有发”和 DOM 效果；这是 P0 的底线。

## 7. 个人任务板（初始）

| Epic | 内容 | 验收 |
|---|---|---|
| C01 | AppShell/设计 token/fixture 板 | 可切换请求的静态图 |
| C02 | front SDK 点击/请求/DOM/traceparent | 点击→请求→DOM 可关联 |
| C03 | S4 图/请求切换/时间轴 | 0 行案例可走 |
| C04 | S5 详情/变量/×N/SQL/UI | 3 次点击到结论 |
| C05 | S6 纯前端空状态 | 确认没发 vs 未采集 |
| C06 | S7 回放只读 | 回放 0 请求 |
| C07 | sourcemap/构建插件 Vue | 控件→处理器→行号/变量 |
| C08 | React18/Webpack5 插件 | 三类前端控件映射 |
| C09 | S2/S3/S9/S10 向导/诊断/隐私 | 新手接入可用 |
| C10 | S8 云端上传/诊断/一致性 | 云端 Boot JAR 案例 A/B |
| C11 | 可访问性/性能/用户测试 | 键盘/缩放/新手测试 |

## 8. 依赖与交付

| 依赖 | 对方 | 我需要什么 | 我回给对方什么 |
|---|---|---|---|
| 事件/样例 | A | 0 行/纯前端/×3/未采集事件 | UI 需要字段、交互反馈、fixture 修正 |
| API/WS/存储 | B | 会话/事件分页/增量 patch/回放 | 组件需求、空/错状态、云本地一致性 |
| 设计/验收 | 全员 | 可用性/视觉反馈 | 设计 token、界面规范、用户测试结果 |

## 9. Qoder 用法

- 每个会话先读：`README.md` + 主计划 0/2/3/4/5/6/19/20 + 本文件 + schema/API。
- 只让 Qoder 改 `workbench/`/`frontend/`/demo 前端；禁止改 agent/server/schema。
- 给 Qoder 看组件树、fixture、状态语义；要求先写组件测试/可访问性检查，再写实现。
- 前端构建插件共享一个 Babel 核心；Vue/React 只做薄适配；不复制两套插桩逻辑。
- 不加载外部 CDN/字体；断网可用；不在前端重发请求/重跑回放。
- 需要 GitHub/无镜像资源时，按项目偏好给用户官方链接，不自动下载。
- **Stop-and-Sync 硬规则**：到达 C0–C6 的 `SYNC` 检查点，停止继续修改，输出进度包和 `SYNC REQUIRED`，等待明确“继续”；不得自动跨过。

## 10. 必须同场/会签（按检查点触发，不按时间）

- C0 完成：第一次 fixture/SDK/事件字段同步（ALL）。
- C1 完成：点击/请求/DOM 字段与 B/A 对齐（ALL）。
- C2/C3/C4/C5/C6 完成：对应阶段门（ALL）。
- 任何事件字段/状态语义/隐私语义/“未采集”展示规则变更（ALL）。
- 请求 Tab/时间轴/回放交互的跨端契约（INTERFACE 或 ALL）。
- 跨边界故障/测试失败（owner + 受影响者；涉及契约则 ALL）。
- 发布/回滚与用户测试（ALL）。
- **不要用“Day N/本周/下周”决定同步；只看上述检查点是否完成。**

## 11. 个人验收清单

- [ ] 不看文档 5 秒内看到 0 行事实；3 次点击到 Service 结论。
- [ ] 请求 1/2/背景切换不混淆；后台不并入。
- [ ] 未采集/false/异常视觉可区分，且不靠颜色单独表达。
- [ ] 回放不发请求、不重新执行；滑块状态正确。
- [ ] 纯前端空状态区分“确认没发/无法确认/失败请求”。
- [ ] 有构建插件时控件→处理器→行号/变量；没有时明确未采集。
- [ ] 1440×900 无横向滚动；1280×720 关键操作可达。
- [ ] 键盘可完成主流程；减少动画可用；无外部 CDN。

## 12. 检查点序列（不按天）

| 顺序 | 检查点 | 目标 | 产物 |
|---|---|---|---|
| 1 | C0 | Vue/Token/AppShell/fixture 板/SDK 骨架 | 可切换请求的静态图；SYNC ALL |
| 2 | C1 | 前端图/后端图/请求 Tab/点击/请求 | 0 行 fixture 可点；事件可输出；SYNC ALL |
| 3 | C2 | 节点详情/时间轴/纯前端空状态/状态语义 | S4/S5/S6/S7 最小界面；SYNC ALL |
| 4 | C3 | sourcemap/向导/采集范围/完整详情/回放 | 本地案例 A/B；SYNC ALL |
| 5 | C4 | React/Webpack/UI 效果/可访问性 | 三类前端映射；SYNC ALL |
| 6 | C5 | 云端上传/诊断/一致性 | 云端案例；SYNC ALL |
| 7 | C6 | 打磨/安装包/用户测试 | 发布可用；SYNC ALL |

每完成一个检查点，立即停止并提示同步；不要因为“今天/这周还没到”而延迟，也不要因为“还差一点”而跳过。

## 13. 阻塞时怎么做

- 后端 API 没好：用 fixture 走完整 UI；把 API 需求写给 B，不自己造接口。
- agent 事件没好：用主计划 5/6 的 fixture；保持字段名与 schema 一致。
- 构建插件太慢：先做 runtime SDK F0/F1，保证纯前端案例；插件按 P1/P2 推进。
- 图太大：先做折叠/搜索/虚拟化，不同时上所有动画。
- 任何跨边界变更：按 README 会签，不私自改。
