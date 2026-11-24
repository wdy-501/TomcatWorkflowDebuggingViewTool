# S8 本地三栈支持矩阵（证据口径）

> 日期：2026-11-24｜基线：`s7-baseline`｜状态：S8 本地基础已跑通；云端未做。
> 原则：只写实测；模板、fixture、静态文案不算运行时证据。

## 1. 矩阵

| 环境 | 后端/前端 | 本地状态 | 可见事实 | 不可见/限制 | 证据 |
|---|---|---|---|---|---|
| A（V1 主路径） | Spring Boot 2.7 JAR（JDK8）+ Vue3/Vite | ✅ 已验收（S0–S6） | click/fetch/4 后端 span、L1/L2、SQL 0 行、回放 | 无云端；无持久化 | 75 PASS；S2–S6 报告 |
| B（第二栈） | 同一 Boot JAR + React18.3.1/Webpack5 | ✅ 基础（S7） | 案例 A 7 span EXACT、B 3 span 零 fetch | 无构建插件/sourcemap/组件映射/JS 局部 | 35 PASS；S7 证据 |
| C（第三栈） | **Tomcat 8.5.60 WAR + Spring MVC/MyBatis（SSM）** | ✅ 基础（S8） | 案例 A 4 后端 span EXACT、SQL 0 行、页面/API；preview 注入 SDK 后 A 7 事件/B 3 事件 | 仅 JDK8/Tomcat 8.5；无 L1/L2/异步；需 JUL manager 开关；静态页无源码映射 | S8 门禁 + 本目录 evidence |
| D 云端 | 上传/沙箱/DB/预览/保留 | ⬜ 未做（S9/S10） | — | 不作承诺 | — |

## 2. 兼容性事实

- **Tomcat 8.5.60**：Servlet 3.1 + JDK8；WAR 以 ROOT 上下文部署，页面 `/`，API `/api/orders`；agent 的 `RequestContextHolder` 关联在 DispatcherServlet 内有效。
- **Agent**：未改源码；仍只插桩 `com.example.shop` 四个 FQCN 与 MyBatis 两类；S8 WAR 复用同包名/签名。
- **JUL 启动竞态**：agent hello 线程与 Tomcat JULI 初始化会死锁；S8 启动加 `-Djava.util.logging.manager=java.util.logging.LogManager` 后启动正常、hello connected。该开关是 Tomcat 本地方案的必要条件，不是通用修复；S0–S7 JAR 路径不需要。
- **Preview**：launcher 注入外部 config/sdk；页面经 8602 访问，`/api` 反代到 Tomcat 8081；`js_method` appName 为 `traceboard-preview`，不宣称源码行列。
- **性能**：S8 未新增 perf 基线；引用 S5 L1 ratio 1.29 WARN、S6 L2 ratio 1.037（本地短请求、report-only）。Tomcat 冷启动/部署耗时未作为门槛。

## 3. 证据索引

- 构建：`evidence/s8-ssm-build.log`（`BUILD SUCCESS`，WAR 13MB）。
- Tomcat 启动/agent：`evidence/s8-tomcat-6.log`（premain targets、JUL 开关、部署 200）。
- 事件：`evidence/s8-events-partial.json`（手工 header 4 span + preview A 7 事件；B 3 事件在测试报告中记录）。
- 浏览器结构：S8 页面 snapshot + 工作台（如截图不可用则明确标注“截图未采集”，不伪造）。

## 4. 未承诺

- 未做 Tomcat 9/10.1、JDK11/17/21 的 SSM 兼容；未做云端 WAR；未做 SSM L1/L2/异步/字段写入。
- 没有 CI 矩阵，只有本机一次可复跑门禁；不把“三栈最小案例”写成完整 P2。