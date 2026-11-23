# B — Platform / Delivery 个人实施计划（历史）

> **已废弃：这是三人模式的历史计划，不要按它安排当前任务。** 当前单人计划见 [../SOLO-PLAN.md](../SOLO-PLAN.md)。  
> 版本：v1.1（历史）  
> 角色：B（Platform / Delivery Owner）  
> 状态：归档。  
> 主计划：[../00-master-plan.md](../00-master-plan.md)  
> 单人入口：[../README.md](../README.md)

## 0. 使命

把两端事件变成可查询、可回放、可隔离的会话：schema、ingest、关联、存储、API、本地启动器/代理/诊断、云端沙箱/数据库/预览/保留/安全、CI 和发布门禁。

要求：

- 同一套事件/图/回放在本地和云端一致；云端只是运行位置不同，不是第二套产品。
- 任何“未采集/截断/脱敏/丢弃”都有原因和计数。
- 云端安全门槛不能为了演示降级；未达到强隔离就不开放任意上传。
- 你是 schema 最终 owner 和发布安全门禁，但不是所有代码都你写：A/C 分担 agent/UI，你用契约和测试收口。

## 1. 边界

**你负责：**

- `schema/`：事件 schema、API 类型、版本/兼容。
- `server/collector`：ingest、归一化、关联、存储、查询/WS、回放 API。
- `server/launcher`：本地进程、IDEA/JAR 接入、预览代理/SDK 注入、诊断、导出。
- `server/cloud`：上传、沙箱、镜像、数据库、预览 token、保留/清理、跨租户隔离。
- CI/发布门禁、安全审查、支持矩阵报告。

**你不碰：**

- `agent/` 探针/字节码细节（A）。
- `workbench/`/`frontend/` 组件/SDK/插件实现（C）。
- 未经会签改状态语义/隐私默认值/支持矩阵声明。
- 不为了通过演示绕过隔离/保留/脱敏。

## 2. 必读主计划章节

- 0 结论、3 用户流程、7 采集、8 关联、10 云端、11 本地、12 共用、13 架构、14 矩阵、15 阶段、16 验收、20/21.2 本计划。
- 关键约束：云端首发只收 Boot JAR；WAR 本地完整、云端 P4；回放只读；强隔离是公开上传门槛；当前本机 Tomcat `CATALINA_HOME` 无效，启动器必须能诊断。
- 记住：B 是 schema 最终 owner，但任何字段变更必须 A/C review；生成类型不手改。

## 3. 开工检查点（独立开工，不等任何人）

1. `git init` + `.gitignore` + 根 Maven/Node 骨架 + 本地 verify 脚本；建 `main` 基线。
2. 写 `schema/traceboard.event.v1.json` 草案和 Java/TS 生成脚本。
3. 起 collector mock：收到一条事件、存内存、返回会话；写本地启动器最小进程包装（先能启动假进程）。
4. 建 0 行 fixture；不依赖 A/C 的真实实现。
5. 把 schema/API 草案发给 A/C 评审；标出 provisional 字段。

**开工检查点产物：** 能收一条假事件 + 能启动一个假进程 + schema/API 草案。完成即按第 4 节 `B0` 同步，不按天数判断。

## 4. 检查点与同步

**每个检查点完成时，先停止、跑验证、写进度包，按 `SYNC` 列等待；不要自动进入下一行。**

| 检查点 | 重点 | 交付/验收 | SYNC | 依赖 |
|---|---|---|---|---|
| B0 开工切片 | 仓库/CI、schema 草案、collector mock、launcher 骨架、0 行 fixture | 假事件可收；假进程可启；schema/API 草案 | ALL | A/C 评审 |
| B1 契约定版 | schema v1、传输/API、fixture server、生成类型 | 三端契约；walking skeleton；main 可运行 | ALL | A/C 评审 |
| B2 0 行事实 | ingest/关联/存储、REST+WS、本地进程/代理、0 行 fixture、基础诊断 | 0 行案例端到端；轮询不误并；回放只读 API | ALL | A 事件、C 图 |
| B3 本地接入 | SQLite/事件存储、IDEA/JAR 启动器、预览代理/SDK 注入、诊断、回放/导出、安全基线 | 本地接入 ≤10/5 分钟；案例 A/B；缺口可见 | ALL | A agent、C UI |
| B4 Tomcat/CI | Tomcat runner（WAR-only）、CI 矩阵、关联/隐私加固、跨线程/网关降级 | 三种本地环境；CATALINA_HOME 诊断；重部署稳定 | ALL | A Tomcat 适配、C 界面 |
| B5 云端首发 | 上传/配额、强隔离、JDK 镜像、隔离 DB/schema、预览 token、启动诊断、保留/清理、跨租户测试 | 云端 Boot JAR 案例 A/B；隔离/保留通过 | ALL | A 镜像兼容、C 上传 UI |
| B6 发布硬化 | 云端 WAR、安全审查、配额/清理、发布门禁、支持矩阵报告 | 发布检查表；回滚方案；无残留 | ALL | 全员 |

**B 的局部检查点：** 单个 API 实现、测试、迁移、诊断规则、文档可以标 `SYNC: LOCAL`；完成后自检并更新计划，不触发三人同步。

**Stop-and-Sync：** 到达 B0–B6 任一检查点，按 README 第 5 节输出进度包，然后输出 `SYNC REQUIRED: B2 | scope: ALL | reason: ...`，停止当前回合；收到明确“继续”后才开始下一检查点。

## 5. 技术要点与契约

- **schema：** append-only 事件；session/span/value/sideEffect/correlation/status/flags；所有 `NOT_COLLECTED*` 带 reason；版本化；生成 Java/TS 类型。
- **关联：** 规则状态机；traceparent/clickId；EXACT/INFERRED/LOST/MANUAL；后台轮询单独车道；不因时间接近合并；网关丢 header 时降级并显示。
- **存储：** 本地 SQLite + 事件文件；云端 PostgreSQL + 对象存储；内容寻址值去重；TTL/删除/导出；回放查询只读。
- **本地 launcher：** IDEA Boot/Tomcat、JAR、WAR 四种接入；独立 `CATALINA_BASE`；token/端口/健康检查；预览代理同源注入；诊断卡。
- **云端：** 不可信代码强隔离（Firecracker 等 VM 级或经评估的 gVisor 级）；无外网；非 root；只读 rootfs；每会话 DB schema/受限账号；预览与工作台不同源；短时 token；保留/清理。
- **对齐：** 云本地同一示例的节点/边/状态/关键值/回放快照一致；差异只允许环境元数据。
- **降级：** 搜索/关联丢失→LOST/游离；CSP 注入失败→明确提示；无调试信息→不猜；云端外部 DB/内网→本地模式。

## 6. 个人任务板（初始）

| Epic | 内容 | 验收 |
|---|---|---|
| B01 | 仓库/CI/schema v1/生成类型 | 三端契约；类型可生成 |
| B02 | collector mock/ingest/WS | 收事件、会话可查 |
| B03 | correlation/多请求/轮询 | 20 次点击 0 误并 |
| B04 | 存储/回放 API/导出 | 回放 0 写；快照一致 |
| B05 | 本地启动器 IDEA/JAR | ≤10/5 分钟接入 |
| B06 | 预览代理/SDK 注入/诊断 | agent/应用/预览/SDK 四项检查 |
| B07 | Tomcat runner/WAR-only | 不污染原 Tomcat；20 次重部署稳定 |
| B08 | 云端上传/沙箱/DB/镜像 | Boot JAR 案例 A/B；隔离 |
| B09 | 预览 token/保留/清理 | TTL/删除/无残留 |
| B10 | 安全/跨租户/发布门禁 | 越权/出网/路径穿越/token 重放阻断 |

## 7. 依赖与交付

| 依赖 | 对方 | 我需要什么 | 我回给对方什么 |
|---|---|---|---|
| agent 事件/握手 | A | 事件样例、错误码、性能 | schema/传输、collector/launcher、诊断字段 |
| UI/API 需求 | C | 需要的查询/WS/patch 格式 | API/WS、fixture server、预览注入 |
| demo | A/C | 业务场景与 fixture | CI/启动器/存储 |
| 安全/合规 | 全员 | 隐私/保留规则、审查 | 隔离/清理/门禁 |

## 8. Qoder 用法

- 每个会话先读：`README.md` + 主计划 0/3/7/8/10/11/12/13/14/15/16/20 + 本文件 + schema。
- 只让 Qoder 改 `server/` 和 schema；不要让它改 agent/UI；生成类型不手改。
- 先写契约测试，再写实现；让 Qoder 生成诊断规则/迁移/测试，安全审查由人复核。
- 禁止在日志/fixture 中放真实 secret；云端强制脱敏；GitHub/无镜像依赖按项目偏好给用户链接，不自动下载。
- 变更 schema/API 时同时更新版本、类型、契约测试；至少 A/C 两人 review。
- **Stop-and-Sync 硬规则**：到达 B0–B6 的 `SYNC` 检查点，停止继续修改，输出进度包和 `SYNC REQUIRED`，等待明确“继续”；不得自动跨过。

## 9. 必须同场/会签（按检查点触发，不按时间）

- B0 完成：第一次 schema/事件/启动器同步（ALL）。
- B1 完成：契约冻结（ALL）；未确认不得跨接口继续。
- B2/B3/B4/B5/B6 完成：对应阶段门（ALL）。
- schema/状态枚举/隐私默认值/支持矩阵/云端安全门槛变更（ALL）。
- 跨边界故障/测试失败（owner + 受影响者；涉及契约则 ALL）。
- 发布/回滚（ALL）。
- 任何“为了演示”放松隔离、保留、脱敏的提议（ALL，拒绝）。
- **不要用“Day N/本周/下周”决定同步；只看上述检查点是否完成。**

## 10. 个人验收清单

- [ ] 同一会话本地/云端图语义一致。
- [ ] 0 行案例端到端；轮询不误并；回放 0 写。
- [ ] IDE/JAR 接入新手可用；Tomcat CATALINA_HOME 无效有诊断。
- [ ] 云沙箱越权/出网/zip slip/token 重放全阻断。
- [ ] 文件保留/删除/清理有自动测试；无残留容器/DB/对象。
- [ ] 云端启动失败有阶段诊断和可操作建议。
- [ ] schema 变更有兼容测试；旧 agent/前端不被破坏。
- [ ] 支持矩阵每个声明有 CI/示例证据。

## 11. 检查点序列（不按天）

| 顺序 | 检查点 | 目标 | 产物 |
|---|---|---|---|
| 1 | B0 | 仓库/CI/schema 草案/collector mock/launcher 骨架 | 假事件可收；假进程可启；SYNC ALL |
| 2 | B1 | schema v1/API/传输/fixture server | 三端契约；walking skeleton；SYNC ALL |
| 3 | B2 | collect/存储/会话 API/关联/0 行 | 0 行端到端；轮询不误并；SYNC ALL |
| 4 | B3 | SQLite/IDEA/JAR 启动器/诊断/回放 | 本地接入与案例 A/B；SYNC ALL |
| 5 | B4 | Tomcat runner/CI/隐私/降级 | 三类本地环境；SYNC ALL |
| 6 | B5 | 云端沙箱/DB/预览/保留 | 云端 Boot JAR 案例；SYNC ALL |
| 7 | B6 | 云端 WAR/安全/发布 | 发布检查表；SYNC ALL |

每完成一个检查点，立即停止并提示同步；不要因为“今天/这周还没到”而延迟，也不要因为“还差一点”而跳过。

## 12. 阻塞时怎么做

- agent 没好：用 JSON fixture 走 ingest/关联/UI；把 agent 事件当外部输入。
- UI 没好：用 curl/CLI 验证 API/回放；不要等界面。
- 云端安全门槛未定：先做本地，云端 skeleton 用 mock；公开上传不提前开放。
- 本机 Tomcat 路径无效：启动器自动发现/诊断，不硬编码 `CATALINA_HOME`。
- 任何跨边界变更：按 README 会签，不私自改。
