# 用 TraceBoard 调试自己的项目

> 适用版本：v0.1 本地演示版｜更新：2026-11-25
>
> **重要边界**：TraceBoard 不是“任意 Java 方法自动插桩”的通用调试器。collector、workbench、前端 SDK 和采集协议可以直接复用；当前 agent 只插桩 demo 的固定 FQCN（`com.example.shop...`）。要把自己的 Controller/Service/SQL 接进来，需要修改 agent 目标类并重新构建。

## 1. 先确认你要看什么

| 目标 | 现在能否直接用 | 说明 |
|---|---|---|
| 自己前端的点击、fetch/XHR、请求体字段 | 可以 | 引入 SDK + `/ingest` 代理 |
| 自己后端的 Controller/Service/Mapper/SQL | 需要改 agent | 修改 `TraceAgent`/`SpanContext`/Advice |
| 自己方法的行级局部变量 | 不可以 | 当前只有 demo 的 L2 探针 |
| 只读回放、树形链路、详情、缺口 | 可以 | 使用 workbench |

如果只想先看懂产品，请直接按 README 的「A. 先看内置示例」运行，不要先改代码。

## 2. 端口与 JVM

| 进程 | 端口 | JDK | 作用 |
|---|---|---|---|
| collector | 8601 | 21 | 接收事件、查询与回放 |
| 你的后端 + agent | 你的端口（demo 是 8080） | 8（当前验证） | 产生 controller/service/mapper/sql span |
| 你的前端 + SDK | 你的端口 | — | 产生 click/fetch/XHR 事件 |
| workbench | 5173 | 21 | 查看事实、回放、详情 |

启动顺序：**collector → 应用（agent）→ 前端 → workbench**。所有进程默认只在本机回环使用。

## 3. 从 Release 运行（不构建源码）

1. 下载 `TraceBoard-0.1.0-win-x64-portable.zip` 并解压。
2. 启动 collector（JDK 21）：
   ```bash
   java -jar app/collector.jar
   ```
3. 启动 workbench（JDK 21；不要用 `Run-TraceBoard.cmd`，它会同时启动 demo 后端）：
   ```bash
   java -jar app/launcher.jar ui \
     --dir workbench --port 5173 \
     --collector http://127.0.0.1:8601
   ```
4. 打开 `http://localhost:5173`。打包版 workbench 不含 demo，直接显示追踪台。
5. 把你的后端按第 5 节挂上 agent，把你的前端按第 6 节接 SDK。

> Release 便携包不包含前端 SDK 源码。需要 SDK 时，从 GitHub 源码包获取 `frontend/sdk` 并构建（见第 6 节）。

## 4. 从源码运行

```bash
# 1) collector / agent / launcher（JDK21）
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package -pl agent,server/collector,server/launcher -am

# 2) workbench（Node 22）
(cd "workbench" && npm ci && npm run dev)

# 3) SDK IIFE（给前端用）
(cd "frontend/sdk" && npm ci && npm run build)
```

产物：

```text
agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar
server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar
server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar
frontend/sdk/dist/traceboard-sdk.iife.js
```

## 5. 后端挂 agent

当前验证环境是 **JDK 8 + Spring Boot 2.x / Tomcat 8.5**。agent 的 class major 是 52，其他 JVM 版本未验证。

```bash
java -javaagent:"/absolute/path/agent.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" \
  -Dtraceboard.sessionId=s_myapp \
  -jar "/absolute/path/your-app.jar"
```

规则：

- `-javaagent` 和 `-D` 必须在 `-jar` 前；
- `traceboard.ingestUrl` 是**完整 ingest URL**，必须以 `/ingest/v1/events` 结尾；
- `traceboard.sessionId` 必须匹配 `s_[A-Za-z0-9_-]+`；
- 先启动 collector，再启动应用；
- 应用启动后可查握手：
  ```bash
  curl http://127.0.0.1:8601/api/v1/sessions/s_myapp/agent
  ```
  返回 `connected:true` 且 pid/session 匹配才算接通。

如果 Tomcat 启动出现 JUL/agent 死锁，加：

```bash
-Djava.util.logging.manager=java.util.logging.LogManager
```

## 6. 前端接 SDK

### 6.1 纯 HTML / 任意框架

把构建好的 `traceboard-sdk.iife.js` 放到前端静态目录，并在页面加载前设置配置：

```html
<script>
  window.__TRACEBOARD_CONFIG__ = {
    sessionId: "s_myapp",
    ingestUrl: "/ingest",
    appName: "my-app",
    observeMs: 1500
  };
</script>
<script src="/traceboard-sdk.iife.js"></script>
```

- `ingestUrl` 是**相对基路径**，SDK 会向 `/ingest/v1/events` 发送 NDJSON；
- `sessionId` 必须与后端 agent 完全一致；
- `observeMs` 是纯前端点击的观察窗口，默认 1500ms。

### 6.2 开发服务器代理

Collector 没有 CORS，必须由前端 dev server 同源转发，并保留 `traceparent`/`X-TraceBoard-Click` 等头：

Vite：

```ts
server: {
  proxy: {
    "/ingest": {
      target: "http://127.0.0.1:8601",
      changeOrigin: false
    }
  }
}
```

Webpack devServer：

```js
proxy: {
  "/ingest": {
    target: "http://127.0.0.1:8601",
    changeOrigin: false
  }
}
```

不要直接在浏览器里跨域 POST 到 8601；关联头丢失后后端只能显示 `LOST` 链。

### 6.3 ESM 方式

```ts
import { initTraceBoard } from "./traceboard-sdk/index.js";

initTraceBoard({
  ingestUrl: "/ingest",
  sessionId: "s_myapp",
  appName: "my-app"
});
```

SDK 只采集点击、fetch/XHR、`wrapFn` 与声明的 UI 效果；不采集响应体、Cookie 或任意 JS 局部变量。

## 7. 在工作台看结果

1. 打开 `http://localhost:5173`；
2. 进入「追踪台」；
3. 在会话输入框输入 `s_myapp` 并回车/刷新；
4. 点击你前端页面上的控件，工作台应出现点击根、fetch 和后端 span；
5. 如果只有前端、没有后端，见第 8 节。

## 8. 为什么我看不到自己的后端 Span

这是当前版本的已知边界：agent 的插桩目标是 demo 固定类，而不是“任意 Controller”。

需要修改这些文件（源码路径）：

| 文件 | 改什么 |
|---|---|
| `agent/src/main/java/io/traceboard/agent/TraceAgent.java` | `CONTROLLER_TYPE`/`SERVICE_TYPE`，以及 `.type(...).transform(advice(...))` 的方法匹配 |
| `agent/src/main/java/io/traceboard/agent/SpanContext.java` | `CONTROLLER_NODE_KEY`、`SERVICE_NODE_KEY`、Mapper/SQL 的目标类与语句后缀 |
| `MapperAdvice.java` / `SqlAdvice.java` | 你的 mapper 方法过滤、MyBatis 语句匹配 |
| `ControllerAdvice.java` / `ServiceAdvice.java` | 简单 entry/exit 可复用；返回类型不是 Object/boolean 时新增/调整 advice |

示例：把自己的 Controller 加为 root

```java
static final String CONTROLLER_TYPE = "com.acme.order.OrderController";
static final String CONTROLLER_NODE_KEY = CONTROLLER_TYPE + "#submit";
```

并在 `TraceAgent.install` 中把 `.type(...)` 和 `.transform(advice(...))` 指向你的类/方法。改完重新构建：

```bash
JAVA_HOME="C:/Program Files/Java/jdk-21" \
  mvn -B -q -DskipTests package -pl agent -am
```

然后重启应用。不要期望仅换 sessionId 就能自动追踪任意方法。

## 9. 常见问题

| 现象 | 检查 |
|---|---|
| `localhost:5173` 拒绝连接 | workbench 未启动；打包版用 `launcher.jar ui`，源码用 `npm run dev` |
| `GET .../agent` 404 | collector 是否先启动；应用是否带 `-javaagent`；session 是否一致；ingest URL 是否以 `/ingest/v1/events` 结尾 |
| 工作台没有前端点击 | SDK 是否加载；`__TRACEBOARD_CONFIG__` 是否在 SDK 前设置；`/ingest` 代理是否指向 8601 |
| 有 fetch、没有后端 span | agent 目标类不是你的类（当前版本最常见）；按第 8 节改 agent |
| 有 controller、没有 SQL | 当前 SQL 只匹配 demo 的 MyBatis `PreparedStatementHandler#update` 和固定 mapper 语句 |
| 关联不是 EXACT | 前端请求未经过同源代理，`traceparent` 丢失；用 `changeOrigin:false` |
| 数据重启后消失 | collector/H2 都是内存存储，重启即清空 |
| Tomcat 启动异常 | 加 `-Djava.util.logging.manager=java.util.logging.LogManager` |

## 10. 安全与边界

- 仅本机回环使用；无鉴权、无 TLS、无云端上传、无遥测。
- SDK 会采集 query/body 字段和值，当前没有通用脱敏；**不要直接用于真实敏感数据或公网环境**。
- 回放只隐藏未来事件，不重跑程序、不重发请求、不写数据库。
- 没有 SSE/WebSocket；workbench 是低频轮询。
- 没有任意方法 L2/局部变量、截图回放或云端沙箱。