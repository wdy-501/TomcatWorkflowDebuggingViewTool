# 用 TraceBoard 调试自己的 Spring Boot 项目

> TraceBoard 1.0.0 通用模式｜Spring Boot 2.x/3.x｜JDK 8/17/21｜Spring MVC + MyBatis｜2026-11-26

## 1. 一条命令

在便携包根目录：

```bat
TraceBoard.cmd run --jar "C:\path\to\your-app.jar" --java "C:\path\to\jdk\bin\java.exe"
```

从源码运行：

```bash
# 一次性构建 launcher/agent/collector（JDK21）
JAVA_HOME="C:/Program Files/Java/jdk-21" \
  mvn -B -q -DskipTests package -pl agent,server/collector,server/launcher -am

# 构建工作台（run 默认使用 workbench/dist）
(cd workbench && npm ci && npm run build)

# 启动你的 JAR
java -jar server/launcher/target/traceboard-launcher-1.0.0.jar \
  run --jar "C:/path/to/your-app.jar" \
  --java "C:/Program Files/Java/jdk-21/bin/java.exe"
```

`run` 会自动：

1. 启动/复用 collector（默认 `8601`，可 `--collector-port`）；
2. 启动 workbench（默认 `5173`，可 `--ui-port`；源码路径或 `--ui-dir`）；
3. 从 JAR 的 `Start-Class`/`Main-Class` 推导应用主包，打印 `INCLUDE=...`；
4. 生成 `s_run_<时间>` 会话，带上 generic agent 启动应用（默认 `8080`，可 `--port`）；
5. 打开 `http://127.0.0.1:<ui-port>/?session=<id>&app=<url>#app`：  
   - 第一个页签是 **「我的应用」**，iframe 直接加载你的 JAR 服务；
   - 第二个页签是 **「追踪台」**，自动选择最新会话。

三个端口都可独立设置：应用 `--port`、collector `--collector-port`、workbench `--ui-port`。应用 URL 默认 `http://127.0.0.1:8080/`；应用配置了非常规路径/地址时用 `--app-url <url>`。

停止：复制启动时打印的 `STOP=...` 命令执行，或使用 `stop --session <id>`。

## 2. 默认采集什么

| 代码 | 结果 |
|---|---|
| `@Controller` / `@RestController` 映射方法 | `controller` 根节点 |
| `@Service` / `@Component` / `@Repository` 方法 | `service` 子节点 |
| 应用主包内所有 public 方法 | `service` 子节点，带 `GENERIC_AUTO` |
| `QuoteCalculator#computeQuote` 这类普通业务类 | 自动扫包，`service` |
| MyBatis `MapperProxy#invoke` | `mapper`，nodeKey=`接口#方法` |
| `PreparedStatementHandler` 的 query/update/execute/batch | `sql`，语句 id 和 UPDATE 行数 |
| 方法参数/返回值/异常 | `values` + `EXCEPTION=<SimpleName>`；Map 显示键值，应用 POJO/DTO 显示最多 12 个字段（直接读字段，不调用 getter） |
| 行级局部变量 | **不采集** |
| SQL 文本/响应体/Cookie | **不采集** |

自动扫包会产生 getter/setter 噪声；工作台请求树里有“隐藏 generic 自动插桩叶子”过滤，也可用参数收窄：

```text
--exclude com.myapp.model
--include-method com.myapp.service.OrderService#submit
```

`includeMethod` 在没有 Controller 父帧时可以创建 `GENERIC_ROOT`；普通自动扫包方法没有父帧时不会伪造根。

## 3. 前端关联（可选）

不接前端 SDK 时，后端仍有完整 controller/service/mapper/SQL 链，但标记 `LOST_BACKEND`。需要“浏览器点击 → 后端”关联时：

```html
<script>
  window.__TRACEBOARD_CONFIG__ = {
    sessionId: "s_run_...",   // 必须与本次 run 的 session 一致
    ingestUrl: "/ingest",
    appName: "my-app",
    observeMs: 1500
  };
</script>
<script src="/traceboard-sdk.iife.js"></script>
```

并把前端 dev server 的 `/ingest` 代理到 `http://127.0.0.1:8601`（`changeOrigin:false`）。SDK IIFE 在源码 `frontend/sdk/dist/traceboard-sdk.iife.js`（`npm ci && npm run build`）。

没有合法 `traceparent` + `X-TraceBoard-Click` 时，后端不会伪造 EXACT；只有 traceparent 时标 `LOST + TRACEPARENT_ONLY`。

## 4. 手动启动（IDEA / 已有启动脚本）

不使用 `run` 时，可以自己启动 collector + workbench，并给应用加：

```bash
java -javaagent:"/abs/agent.jar" \
  -Dtraceboard.mode=generic \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_myapp \
  -Dtraceboard.include=com.myapp \
  -jar your-app.jar
```

collector 先启动；JDK8/17/21 应用都能挂载 agent。工作台输入 `s_myapp`，或直接用 `?session=s_myapp`。

常用 agent 参数：

```text
-Dtraceboard.include=com.myapp
-Dtraceboard.exclude=com.myapp.model,com.myapp.dto
-Dtraceboard.includeMethod=com.myapp.service.OrderService#submit
-Dtraceboard.captureArgs=true
-Dtraceboard.captureReturn=true
-Dtraceboard.captureMyBatis=true
-Dtraceboard.maxSpansPerTrace=256
-Dtraceboard.maxValues=64
-Dtraceboard.maxString=512
```

## 5. 验证建议

用任意满足条件的 Spring Boot JAR 做一次最小验证：

1. 应用启动后打开 `/api/health` 或首页；
2. 在「追踪台」确认出现 controller 节点；
3. 调一个会访问 MyBatis 的接口，确认 service/mapper/sql 节点与 SQL 行数；
4. 发一个带 JSON 请求体的接口，确认 DTO/Map 字段出现在参数值里；
5. 再打开一个页面动作，确认前端 SDK 接入时是 EXACT，未接入时是 `LOST_BACKEND`。

旧版开发样例已迁移到 [备份仓库](https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool_back)，正式仓库不再包含测试样例。完整字段字典见 [重要说明](../important-notes.md)。

## 6. 常见问题

| 现象 | 检查 |
|---|---|
| `run` 启动失败/找不到 launcher | 先构建 `server/launcher`；或使用便携包内的 `TraceBoard.cmd` |
| 应用没启动 | 检查 `--java` 是否匹配 Spring Boot 版本（Boot2/JDK8、Boot3/JDK17+）；看 `work/logs/<session>-app.log` |
| 有 controller，没有 service/mapper | `INCLUDE=` 是否是应用主包；Mapper 是否在自动推断的业务包内；看 `generic_targets`/`generic_transformed` 日志 |
| 自动扫包太吵 | `--exclude` 排除 DTO/model；或用 `--include-method` 精确采集 |
| 没有 EXACT | 前端是否发 `traceparent` + `X-TraceBoard-Click`；`/ingest` 是否同源代理 |
| 看不到局部变量 | v1 明确不支持行级局部变量/L2 |
| 应用启动后没有新事件 | 先看 collector 8601 health；agent handshake `/api/v1/sessions/<id>/agent` 是否 connected |
| Boot 3 启动异常 | 使用 JDK17/21；agent 仍为 release 8，但 Byte Buddy 1.14.19 支持 JDK21 |

## 7. 边界与安全

- 仅本机回环；无鉴权/TLS/云端上传/遥测。
- 仅 load-time 插桩：应用必须通过 agent 启动；不支持动态 attach。
- 仅可执行 Spring Boot JAR；外部 Tomcat WAR、WebFlux、JPA/Hibernate SQL 不在 v1。
- 不采集行级局部变量、SQL 文本、响应体、Cookie；参数/返回值有长度和数量预算。
- POJO/DTO 只做浅层字段摘要（最多 12 个字段，不调用 getter/toString）；嵌套对象、集合元素、Jackson `JsonNode`、平台对象、代理和命名模块中的类可能只显示类型或摘要。字段级采集仍受值数量、单值长度和 48 KiB 预算限制。
- `@Async`/线程池不自动传播（只继承新建线程）；超限有 `DROP_COUNT`/`VALUES_CAPPED`，不伪造。
- 自动扫包会采集 public 方法参数/返回值；不要在生产或真实敏感数据上直接使用。