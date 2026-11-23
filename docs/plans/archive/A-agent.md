# A — Runtime / Agent 个人实施计划（历史）

> **已废弃：这是三人模式的历史计划，不要按它安排当前任务。** 当前单人计划见 [../SOLO-PLAN.md](../SOLO-PLAN.md)。  
> 版本：v1.1（历史）  
> 角色：A（Runtime / Agent Owner）  
> 状态：归档。  
> 主计划：[../00-master-plan.md](../00-master-plan.md)  
> 单人入口：[../README.md](../README.md)

## 0. 使命

让 JVM 里的事实可靠地变成事件：方法调用、参数/返回、异常、SQL 影响行数、实体字段变化、选中方法的行级变量、耗时、线程和异步上下文。

要求：

- 不要求源码；不预扫描全项目；图来自真实执行。
- 探针失败不能拖垮应用（fail-open），但要留下“采集中断/内部错误”的事实。
- 缺调试信息、被策略排除、被截断时明确标记，不猜。
- L0/L1 的固定开销可控；L2 只对选中方法开启。

## 1. 边界

**你负责：**

- `agent/` 模块：premain/agentmain、transformer、host adapter、探针、上下文、预算、脱敏、传输。
- demo 后端（与 B/C 共用的示例应用后端部分）。
- agent 单元/集成测试、字节码安全检查、性能基线。
- 给 B 提供 agent ↔ collector 协议需求；给 C 提供事件样例/fixture 事实。

**你不碰：**

- `workbench/`、`frontend/` 的 UI 和构建插件（C）。
- collector/cloud/launcher 内部实现（B）。
- schema 最终字段（B 是 owner；你提变更并 review）。
- 未经会签的“支持矩阵”声明。

## 2. 必读主计划章节

- 0 结论、2 图语义、7 采集原理、8 关联、9 变量预算、13 架构、14 支持矩阵、20 协作、21.1 本计划。
- 关键约束：JDK 8/11/17/21；Boot 2.7/3.x；Tomcat 8.5/9/10；javax/jakarta；单 JVM；无 GraalVM native。
- 记住：回放只读，agent 不负责回放；回放由 B/C 的事件流和 UI 完成。

## 3. 开工检查点（独立开工，不等任何人）

1. 建 `agent/` Maven 模块骨架；先能在本机 Maven 直接编译（B 的根 CI 可能还没好）。
2. 写 `premain` + 最小 transformer：对 demo 的一个方法打印 enter/exit；异常不能影响应用。
3. 写一个假 transport（stdout/文件）发出一条事件；不依赖 collector。
4. 建测试 harness：一个 demo 方法、一个断言；记录无 agent 的启动时间基线。
5. 读 B 的 schema 草案，返回“agent 需要哪些字段/哪些字段不够”；不自行加字段。

**开工检查点产物：** 一条 enter/exit 事件 + 一份基线记录 + schema 反馈。完成即按第 4 节 `A0` 同步，不按天数判断。

## 4. 检查点与同步

**每个检查点完成时，先停止、跑验证、写进度包，按 `SYNC` 列等待；不要自动进入下一行。**

| 检查点 | 重点 | 交付/验收 | SYNC | 依赖 |
|---|---|---|---|---|
| A0 开工切片 | agent 骨架、最小插桩、测试 harness、schema review | 一条 enter/exit 事件；demo 方法可采；基线 | ALL | B schema 草案 |
| A1 方法图 | Boot 2.7/JDK8 启动 attach、traceparent、Controller/Service 方法进出、参数/返回/异常/耗时 | 首次点击出方法图；无预扫描；只出现执行路径 | ALL | B 传输/collector mock、C fixture |
| A2 0 行事实 | MyBatis/JDBC SQL/影响行数、实体字段 diff、×N、状态枚举 | 0 行事实链；100→0 字段证据 | ALL | B SQL 事件契约 |
| A3 异步+本地 | 线程池/异步上下文、轮询字段、L1 对象/字段、脱敏、agent 握手/诊断、IDEA/JAR 支持 | P1 门：本地案例 A/B 的后端事实；缺口可见 | ALL | B launcher、C 详情 |
| A4 Tomcat+L2 | Tomcat 8.5/9/10、javax/jakarta、L2 局部变量、ClassLoader/redeploy | P2 门：三类本地环境；L2 行级 100→0；20 次重部署无泄漏 | ALL | B Tomcat runner、C 界面 |
| A5 云端兼容 | 云端 JDK 8/11/17/21 镜像兼容、握手/传输、诊断字段、性能/安全 | P3 门：云端 Boot JAR 的事实链；错误可操作 | ALL | B 沙箱/镜像 |
| A6 发布矩阵 | 兼容矩阵、虚拟线程实验标记、性能报告、文档/故障演练 | P4 门：矩阵 CI；L0/L1/L2 预算达标 | ALL | 全员 |

**A 的局部检查点：** 例如单独修一个探针测试、补一个文档、优化一个不跨接口的方法，可标 `SYNC: LOCAL`；完成后自检并更新计划，不触发三人同步。

**Stop-and-Sync：** 到达 A0–A6 任一检查点，按 README 第 5 节输出：
```text
CHECKPOINT: A2
STATUS: done | partial | blocked
EVIDENCE: 测试/命令/demo
CHANGED: 文件/事件字段/契约
IMPACT: A+B+C
NEXT: A3
```
然后输出 `SYNC REQUIRED: A2 | scope: ALL | reason: ...`，停止当前回合；收到明确“继续”后才开始下一检查点。

## 5. 技术要点与降级

- **宿主适配：** 优先 Boot 可执行 JAR（LaunchedURLClassLoader）和 Tomcat webapp（ParallelWebappClassLoader）；javax/jakarta 用类名/反射适配，agent 不硬依赖 Spring/Servlet 类型。
- **方法探针：** enter/exit + ThreadLocal 栈，生成父子关系；接口作为标签/端口，实际执行类为节点；AOP 代理帧跳过，不制造噪音。
- **SQL：** MyBatis Executor + JDBC PreparedStatement/ResultSet 包装；记录 update count、查询行数上限、SQL 文本/参数（脱敏）；不承诺 JPA flush 级因果。
- **字段：** 项目实体 PUTFIELD/PUTSTATIC，记录对象身份、旧值/新值、行号；不调用 getter/toString；JPA 懒加载代理标 `LazyProxy`，不触发查询。
- **局部变量：** 仅 L2、选中方法；依赖 LocalVariableTable；缺少时 `NOT_COLLECTED_NO_DEBUG_INFO`，不猜；探针异常跳过方法，不破坏应用。
- **异步：** 常见线程池/CompletableFuture/@Async 传播上下文；丢失标 `LOST`；虚拟线程/协程不在 V1 完整承诺。
- **预算/脱敏：** L0/L1/L2 档位；单 span 64KB、单请求 4MB 等上限；截断/折叠/丢弃计数必须上报；默认脱敏，云端强制。
- **失败策略：** agent 内部 try/catch + fail-open；记录“采集器内部错误”；不因插桩失败阻止应用启动。
- **明确不支持：** GraalVM native、字节码加密、JNI、跨 webapp、MQ/定时任务作为点击根、JDK 22+、JDK 21 虚拟线程完整上下文。

## 6. 个人任务板（初始）

| Epic | 内容 | 验收 |
|---|---|---|
| A01 | agent 骨架/premain/测试 harness | 一条 enter/exit 事件 |
| A02 | Boot 2.7/JDK8 宿主 + traceparent | 首次点击出图 |
| A03 | Controller/Service/MyBatis/JDBC SQL 行数 | 0 行事实链 |
| A04 | 实体字段 diff/×N/状态枚举 | 100→0 字段证据 |
| A05 | 异步/线程池/轮询字段 | 子任务/丢失可区分 |
| A06 | L1 对象/敏感字段/预算/脱敏 | 有截断/脱敏/丢弃原因 |
| A07 | L2 局部变量/循环折叠 | 行级 100→0；缺调试信息不猜 |
| A08 | Tomcat 适配/ClassLoader/redeploy | 三类环境；20 次无泄漏 |
| A09 | agent 握手/诊断/IDEA/JAR 支持字段 | 启动器可显示四项检查 |
| A10 | 性能/兼容/文档 | L0/L1/L2 报告；矩阵 CI |

## 7. 依赖与交付

| 依赖 | 对方 | 我需要什么 | 我回给对方什么 |
|---|---|---|---|
| schema/传输 | B | 事件字段、seq/重连、token | 字段需求、样例事件、性能数据 |
| collector/launcher | B | ingest 地址、token、诊断字段 | agent 握手日志、错误码 |
| fixtures/UI | C | 0 行/纯前端/×3/未采集样例 | 真实事件样例、字段说明 |
| demo 后端 | B/C | 业务场景代码 | 可被 agent 采的示例方法 |

## 8. Qoder 用法

- 每个会话先读：`README.md` + `00-master-plan.md` 的 0/2/7/8/9/13/14/20 + 本文件 + schema。
- 只让 Qoder 改 `agent/` 和 demo 后端；明确禁止改 `workbench/`、`server/`、schema 生成文件。
- 给它看字节码约束：不调用业务 getter/toString；不改变方法语义；fail-open；LocalVariableTable 检查；ClassLoader 用 WeakHashMap。
- 每次改动：单测 + demo 回归 + 性能基线；让 review agent 查 VerifyError、内存泄漏、日志 secret、异常吞噬。
- **Stop-and-Sync 硬规则**：到达 A0–A6 的 `SYNC` 检查点，停止继续修改，输出进度包和 `SYNC REQUIRED`，等待明确“继续”；不得自动跨过。
- 需要 JDK 11/17、Tomcat 9/10 等 GitHub/无国内镜像资源时，按项目偏好把官方链接、版本、放置位置给用户，不自动下载或换第三方镜像。

## 9. 必须同场/会签（按检查点触发，不按时间）

- A0 完成：第一次事件/字段同步（ALL）。
- A1/A2/A3/A4/A5/A6 完成：对应阶段同步/阶段门（ALL）。
- 任何 schema/状态枚举/隐私语义/支持矩阵变更（ALL）。
- 与 B 的 agent↔collector 协议、与 C 的事件样例/UI 字段变更（INTERFACE 或 ALL）。
- 跨边界故障/测试失败（owner + 受影响者；涉及契约则 ALL）。
- 发布/回滚（ALL）。
- **不要用“Day N/本周/下周”决定同步；只看上述检查点是否完成。**

## 10. 个人验收清单

- [ ] 同一 demo 在无 agent/有 agent 下业务结果一致。
- [ ] 探针异常不影响应用启动/请求。
- [ ] 首次失败运行能出方法图，只显示执行过的项目方法。
- [ ] 0 行案例能读到 SQL 0 行、Mapper 0、Service true、无异常。
- [ ] 缺调试信息时不猜变量名，状态/原因可见。
- [ ] L0/L1/L2 有预算/截断/脱敏/丢弃计数。
- [ ] Tomcat 重部署 20 次无 ClassLoader 泄漏/OOM。
- [ ] agent 支持矩阵有 CI/示例证据，不靠口头声明。

## 11. 检查点序列（不按天）

| 顺序 | 检查点 | 目标 | 产物 |
|---|---|---|---|
| 1 | A0 | agent 骨架 + 最小插桩 + 假 transport | enter/exit 事件；基线；SYNC ALL |
| 2 | A1 | Boot 2.7 demo attach；traceparent；方法图 | 点击→Controller/Service 初步图；SYNC ALL |
| 3 | A2 | SQL 行数/字段/×N/状态 | 0 行 + 100→0 证据；SYNC ALL |
| 4 | A3 | L1/异步/脱敏/IDEA/JAR 支持 | 本地案例后端事实；SYNC ALL |
| 5 | A4 | Tomcat/L2/redeploy | 三类环境；行级证据；SYNC ALL |
| 6 | A5 | 云端镜像/握手/性能 | 云端事实链；SYNC ALL |
| 7 | A6 | 矩阵/文档/发布 | 报告；SYNC ALL |

每完成一个检查点，立即停止并提示同步；不要因为“今天/这周还没到”而延迟，也不要因为“还差一点”而跳过。

## 12. 阻塞时怎么做

- collector 没好：用 stdout/文件 transport + fixture，先验证插桩。
- schema 没冻结：按 `provisional` 字段实现，标清楚，契约冻结后迁移并加兼容测试。
- demo 没好：用最小 `DemoService` 自己起一个 Boot 2.7 应用验证，不等 B/C。
- 性能不达标：先缩 L1 字段/采样，保证 L0；把开销数据给全员决定是否降级。
- 任何跨边界变更：提给 B/C，按 README 第 4 节会签，不私自改。
