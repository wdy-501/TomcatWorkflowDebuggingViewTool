# S2 实施计划（s2-plan）

> 阶段：S2（MVP，0-row fact chain）｜版本：v1（2026-11-24）｜作者：plan-writer
> 上游：`docs/plans/stages/S2/dispatch.md`（绑定简报）、`docs/plans/SOLO-PLAN.md` S2 行 + §4、主计划 §2.3/§5（案例 A）/§8.1–8.5/§9.1–9.2/§13.4/§16 T1/T2/T5/T7
> 下游：coder-backend、coder-frontend、tester、acceptance（**G1 PASS 后生效**；本文件、S2 契约、S2 fixture 冻结后只读）
> 契约：`docs/contracts/api.v1.md` §2.2/§8/附录 B、`event-model.v1.md` §3.3/§4.3/§4.5/§5/§7/§11（S2 短注）、`transport.v1.md` §6.3；fixture：`fixtures/s2-zero-row-chain/**`

## 1. 目标与验收映射

S2 只证明：**一次真实 cancel 请求的 SQL 影响 0 行、Mapper 返回 0、Service 仍返回 true、HTTP 200、无异常**，并且这条 4 段后端事实链可被 collector 只读派生、被工作台按请求看到。

| 分发书 §1 信号 | 本计划落点 | 证据（owner） |
|---|---|---|
| 1 真实 0 行（H2+MyBatis） | §6（`status='PAID'` 条件、Service 忽略返回值、200/404） | tester S2-B/S2-D/S2-E；`GET /api/orders` 仍 CREATED |
| 2 agent 4-span 链 | §7（四点插桩、ThreadLocal 栈、LOST 游离根、HTTP 状态反射） | tester S2-D；transform 日志 + 读回 |
| 3 collector 只读派生 | §8（requests/graph 读时派生、排序、聚合、400/404/405） | tester S2-F/S2-G |
| 4 工作台请求切换 + 事实板 | §9（`#s2-*` 选择器、中性事实摘要、5s 轮询非实时） | tester S2-H；orchestrator 浏览器证据 |
| 5 测试一次命令全绿 | §11 T1–T12（映射 S2-A..S2-L） | `tools/verify` exit 0 + test-report |
| 6 契约/fixture/证据 | §10、`fixtures/s2-zero-row-chain/**`、api §8/附录 B | G1 哈希；S2-L 漂移检查 |

## 2. 范围

### 2.1 范围内

plan-writer（本文件 + 契约 S2 章节 + `fixtures/s2-zero-row-chain/**`）→ coder-backend（demo H2+MyBatis 0 行 + agent 4 span + collector requests/graph）→
coder-frontend（workbench S2 面板）→ tester（S2-A..S2-L + test-report）→ acceptance（README/进度/归档/tag `s2-baseline`）。

### 2.2 S3 边界（越界即失败）

1. 无浏览器 SDK/UI 采集/`traceparent`/clickId 传播/关联引擎/前端事件；S2 链是 `confidence=LOST` 的游离后端请求，**不画成点击链**。
2. 无时间轴/回放/`replay` API/回放按钮/像素回放/虚拟时钟；无 `links` 手工关联。
3. 无 SSE/WebSocket/实时订阅；工作台只有手动刷新 + 5s 低频轮询（**非实时**）。
4. 无 `values[]`/字段 diff/参数值/L1-L2/行级变量/异常 payload/栈；`THREW` 只记状态与 `return=null`。
5. collector 不落 DB/文件、无淘汰/采样/缓存、无 CORS/鉴权/429；graph 只在读时派生。
6. 无 launcher/cloud/Tomcat/React/MySQL 服务/上传/沙箱；不改 demo 前端行为（2xx 即“操作成功”）。
7. 不改 `schema/traceboard.event.v1.json` 字段/枚举/约束；不新增事件类型；不写第二份 schema；不改 S0/S1 fixture。

## 3. 前置与冻结输入

1. G1 PASS（`docs/plans/stages/S2/plan-review.md`）；S2 契约、fixture、本文件冻结。
2. 环境（分发书 §8）：Windows 10 + Git Bash；仓库路径含中文与空格，所有路径/命令**双引号**；Maven 3.9.5；
   默认 `JAVA_HOME`=`C:/Program Files/Java/jdk1.8.0_221`；JDK21=`C:/Program Files/Java/jdk-21`；Node 22/npm 10；端口 8601/8080/5173/5174。
3. 开工记录冻结哈希：

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
sha256sum "schema/traceboard.event.v1.json" "docs/contracts/api.v1.md" "docs/contracts/transport.v1.md" \
  "docs/contracts/event-model.v1.md" "fixtures/s2-zero-row-chain/events.ndjson" \
  "fixtures/s2-zero-row-chain/expected-facts.json" "fixtures/s2-zero-row-chain/README.md" \
  "docs/plans/stages/S2/s2-plan.md" > /tmp/s2-freeze.sha256
netstat -ano | grep -E ":(8601|8080|5173|5174)" || true
```

## 4. 文件地图与所有权（零交集）

| 路径前缀 | owner | S2 新增/修改 |
|---|---|---|
| `docs/contracts/**`、`fixtures/s2-zero-row-chain/**`、`docs/plans/stages/S2/s2-plan.md` | plan-writer | api §2.2/§8/附录 B；event-model 短注；transport §6.3；3 个 fixture 文件；本文件 |
| `demo/buggy-shop-boot-vue/backend/**`、`agent/**`、`server/collector/**` | coder-backend | demo：H2/MyBatis/mapper XML/schema/data/Service 缺陷；agent：4 点插桩 + 栈；collector：requests/graph |
| `workbench/**` | coder-frontend | `src/api.ts` 类型、`components/S2Panel.vue`、`stores/s2.ts`、`App.vue`、样式 |
| `tools/verify/**`、`docs/plans/stages/S2/test-report.md` | tester | S2-A..S2-L 门禁 + 报告 |
| `README.md`、`.gitattributes`（仅必要时）、`S2/{acceptance,progress}.md`、archive、git | acceptance | 启动顺序/curl/verify、commit + tag `s2-baseline` |
| `schema/**`、`fixtures/case-a-zero-rows/**`、`fixtures/s1-walking-skeleton/**`、demo 前端、S0/S1 文档 | 冻结 | 一律只读 |

## 5. 共享契约摘要（实现不得漂移）

| 项 | S2 取值 |
|---|---|
| requests | `GET /api/v1/sessions/{sessionId}/requests` → `{"sessionId","requests":[{"traceId","rootSpanId","rootKind","nodeKey","status","confidence","spanCount","startedAtNs","durNs","hasError"}]}` |
| graph | `GET /api/v1/sessions/{sessionId}/graph?traceId=<32hex>` → `{"sessionId","traceId","rootEventId","confidence","nodes":[11 字段],"edges":[{"from","to","count":1}]}` |
| 排序 | requests：`startedAtNs` 升序、同值 `traceId` 字典序；graph：`nodes` 按 `startNs`、同值 `spanId`；`edges` 按父节点位置再按子节点位置 |
| 聚合 | requests `status` = 最严重级 `THREW > UNKNOWN > NOT_COLLECTED_POLICY > NOT_COLLECTED_LOST > NOT_COLLECTED_NO_DEBUG_INFO > TRUNCATED > RETURNED_FALSE > OK`；**S2 不做 ×N/节点合并**，`edges.count` 恒 1 |
| 错误 | 未知 session → 404 信封；graph `traceId` 缺失/非法 → 400；session 内无该 trace → 404；写动词 → 405；`/replay`、`/stream`、`/ws/v1/events`、`/links` 不注册（404） |
| 只读 | 两次相同 GET 结果一致，事件/`seq`/存储不变；无缓存、无持久化、无副作用；**查询 ≠ 回放** |
| meta | `capabilities` 5 键不变：`health=true, meta=true, ingestEvents=true, realtime=false, replay=false` |
| 事件链 | 4 行同 `sessionId=s_s2agent`/`traceId`/`rootEventId=click_lost_<根spanId>`；根 `parentSpanId=null` + `LOST_BACKEND`，子 span 指向父、继承 `LOST` |
| 状态事实 | 0 行 = `OK`（不是错误）；布尔 false = `RETURNED_FALSE`；异常 = `THREW` 且 `return=null`；`transaction="UNKNOWN"`（未采集事务边界，不猜） |

## 6. Demo 设计（coder-backend）

### 6.1 依赖与配置

- `demo/buggy-shop-boot-vue/backend/pom.xml`：父 `spring-boot-starter-parent:2.7.18` 不变；新增
  `org.mybatis.spring.boot:mybatis-spring-boot-starter:2.3.1`（版本需显式写，Boot 2.7.18 不管理它）与 `com.h2database:h2`（`runtime`，**版本不写**，由 Boot 2.7.18 管理 = **2.1.214**）。
  `java.version` 保持 `1.8`；产物 `demo-shop-backend-0.1.0-SNAPSHOT.jar`；端口 8080；**无 MySQL 服务依赖**。
- `application.yml`：`spring.datasource.url=jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1`（`MODE=MySQL` 可选，不强制）、`driver-class-name=org.h2.Driver`、
  `username=sa`、`password=`（空）；`spring.sql.init.mode=always`；`mybatis.mapper-locations=classpath:mapper/*.xml`、
  `mybatis.configuration.map-underscore-to-camel-case=true`。
- 若 H2 2.1.214 对 `orders`/`status` 之类保留字报错，只允许加引号或改名 `order_no` → `order_no` 保持；**不得**手改 H2 版本。

### 6.2 schema/data/mapper

- `src/main/resources/schema.sql`：`CREATE TABLE orders (id BIGINT PRIMARY KEY, order_no VARCHAR(32) NOT NULL, status VARCHAR(16) NOT NULL, amount DECIMAL(10,2) NOT NULL);`
- `src/main/resources/data.sql`：`INSERT INTO orders (id, order_no, status, amount) VALUES (1, 'SO-0001', 'CREATED', 100.00);`
- `src/main/resources/mapper/OrderMapper.xml`（`namespace=com.example.shop.mapper.OrderMapper`）：
  - `<select id="countById" resultType="int">SELECT COUNT(*) FROM orders WHERE id = #{id}</select>`
  - `<update id="cancelById">UPDATE orders SET status='CANCELLED' WHERE id = #{id} AND status='PAID'</update>`
  - `resultMap`/`findAll`：`SELECT id, order_no, status, amount FROM orders ORDER BY id`（映射到既有 `Order` 模型，`amount` 为 `double`）。
- `com.example.shop.mapper.OrderMapper`（接口）：`int countById(@Param("id") long id)`、`int cancelById(@Param("id") long id)`、`List<Order> findAll()`。

### 6.3 缺陷与分支（案例 A）

| 分支 | 行为 |
|---|---|
| `POST /api/orders/1/cancel`（存在） | Service：`countById(1)==1` → 调用 `cancelById(1)`；**忽略**返回的 0 → `return true`；Controller `200 {"data":true}`；行仍 `CREATED` |
| `POST /api/orders/{id}/cancel`（未知 id） | Service：`countById(id)==0` → `return false`，**不调用** `cancelById`；Controller `404 {"data":false}` |
| `GET /api/orders` | `orderMapper.findAll()` → `200 {"data":[...]}`，来自 H2（seed id=1 CREATED 100.00） |
| demo 前端 | **不改**：2xx → “操作成功” + 刷新列表（仍 CREATED） |

- **存在性检查选型**：用 mapper `countById`（真实 SQL 查 DB），不用内存 Map——避免第二事实源；该 select **S2 不插桩**（分发书 §4.2 允许“额外 select 默认不插桩”），
  因此 cancel 链仍是 4 span；这是**采集范围限定**，不是伪造，test-report 与 UI 不得暗示“已采集全部 SQL”。
- Controller 方法签名与 200/404 形状不变（`ResponseEntity<Map<String,Object>>`），便于 agent 反射取状态码。

### 6.4 删除与保留

- 删除 `com/example/shop/store/InMemoryOrderStore.java`（及引用）；保留 `model/Order.java`（字段不变）。
- `OrderService.cancel(long)` 仍在 `com.example.shop.service.OrderService` 类中（agent `nodeKey` 依赖它）；构造器改为注入 `OrderMapper`。

### 6.5 构建与启动

- 构建：`(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)`
  （demo **不是**根 reactor 模块；不要用 JDK21 构建它）。
- 启动见 §12.3；启动后 `GET /api/orders` 必须先返回 seed，再点 cancel（证明 `schema.sql`/`data.sql` 已执行）。

## 7. Agent 设计（coder-backend）

### 7.1 打包与配置

- 沿用 S1：Byte Buddy `1.14.19`、shade relocate、`--release 8`（jar major=52）、`Premain-Class`、jar 名/路径不变；零新增依赖；不引 MyBatis/Spring（只用 JDK 类型 + 反射）。
- `AgentConfig`：默认 `sessionId` 由 `s_s1agent` 改为 **`s_s2agent`**；`-Dtraceboard.ingestUrl`、`-Dtraceboard.sessionId`、`-Dtraceboard.traceId` 语义不变；`traceboard.enabled=false` 仍 noop。

### 7.2 四个插桩点（仅此四处）

| # | 目标 | Advice 匹配 | 产出的 kind |
|---|---|---|---|
| 1 | `com.example.shop.controller.OrderController` | `named("cancel").and(takesArguments(long.class))` | `controller`（根） |
| 2 | `com.example.shop.service.OrderService` | `named("cancel").and(takesArguments(long.class))` | `service` |
| 3 | `org.apache.ibatis.binding.MapperProxy` | `named("invoke")`；**Advice 内**按 `@Advice.Argument(1) Method` 过滤：`declaringClass.getName().equals("com.example.shop.mapper.OrderMapper") && name.equals("cancelById")`，不命中则直接返回 | `mapper` |
| 4 | `org.apache.ibatis.executor.statement.PreparedStatementHandler` | `named("update")`；**Advice 内**反射读 `mappedStatement`（沿父类字段查找，只读），`MappedStatement#getId()` 必须等于 `com.example.shop.mapper.OrderMapper.cancelById` | `sql` |

- 不插桩 `countById`（§6.3）、不插桩其它 Controller/Service/Mapper/JDBC；`ignore` 规则在 S1 基础上**不要**排除 `org.apache.ibatis.*`（否则点 3/4 永不命中），
  只排除 `org.springframework.`/`io.traceboard.agent.`/JDK/Byte Buddy/合成类。
- 失败（`mappedStatement` 读不到、`getId` 不匹配、类加载异常）→ 不产生 sql span 并 `BLOCKED`（附日志），**不得伪造 rowsAffected**。

### 7.3 上下文与父子关系（ThreadLocal 栈）

- `SpanContext`（agent 侧）：`ThreadLocal<ArrayDeque<Frame>>`；Frame = `{spanId, parentSpanId, kind, nodeKey, startNs, traceId, rootEventId, flags}`。
- 进入：controller 入栈时**创建**根（`traceId` = `-Dtraceboard.traceId` 或随机 32 hex；`spanId` 随机 16 hex；`rootEventId=click_lost_<spanId>`；
  `parentSpanId=null`；flags `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]`）。service/mapper/sql 入栈时取栈顶 spanId 作 `parentSpanId`，flags `["S2_ZERO_ROW_CHAIN"]`。
- 退出：`onThrowable=Throwable.class` 时也弹栈；记录 `durNs = exit-enter ≥0`；组装事件并 `EventSender.offer`。
- 栈为空时的非 controller 退出（异常路径/采集起点不在 controller）：**不发事件**，stderr 计数 `orphan_span=<n>`（不伪造根）；
  栈深度 >64 视为失衡 → 清空栈并计数 `stack_reset=<n>`（fail-open）。
- 同一线程同步链；跨线程不传播（S6）；并发请求每线程独立栈、独立 `traceId`，不合并。**不引入异步/线程池传播**。

### 7.4 事件字段

| 字段 | controller | service | mapper | sql |
|---|---|---|---|---|
| `kind` / `nodeKey` | `controller` / `com.example.shop.controller.OrderController#cancel` | `service` / `com.example.shop.service.OrderService#cancel` | `mapper` / `com.example.shop.mapper.OrderMapper#cancelById` | `sql` / `OrderMapper.cancelById` |
| `status` | `THREW` 或 `OK` | `THREW` / `RETURNED_FALSE`（返回 false）/ `OK` | `THREW` / `OK`（0 是正常返回） | `THREW` / `OK` |
| `return` | `{"type":"org.springframework.http.ResponseEntity","value":200\|404}`；异常 `null` | `{"type":"boolean","value":true\|false}` | `{"type":"int","value":N}` | `null` |
| `sideEffects` | 无 | 无 | 无 | `[{"type":"sql","sqlId":"OrderMapper.cancelById","rowsAffected":N,"transaction":"UNKNOWN"}]` |
| `confidence` | `LOST` | `LOST`（继承根） | `LOST` | `LOST` |
| `flags` | `["S2_ZERO_ROW_CHAIN","LOST_BACKEND"]` | `["S2_ZERO_ROW_CHAIN"]` | 同左 | 同左 |

- 共享：同 `sessionId`/`traceId`/`rootEventId`；`spanId` 各 16 hex 唯一；`thread` 取当前线程；`startNs` 相对 premain 单调纳秒；
  `source` 只写真实栈帧的 `file`（可用则写，取不到整体省略），**不猜行号**；不写 `values`/`reason`/异常 payload。
- 事件到达顺序 = 方法退出顺序（sql→mapper→service→controller），与 `startNs` 顺序不同；消费方按 `startNs`/父子关系排序。
- controller 状态码：反射 `getStatusCode()` → `value()`；读不到 → `value=null` + stderr `http_status_unreadable=<n>`（不猜 200/404）。

### 7.5 SQL 行数采集

- `PreparedStatementHandler#update` 的 `@Advice.Return int` 即 `rowsAffected`；装进 sql span 的 `sideEffects[0]`。
- 过滤必须精确到 `mappedStatement.id`，其它 update 不产生 span（测试断言无额外 update span）。

### 7.6 传输与 fail-open（沿用 S1）

- `EventSender`：容量 16、单守护线程、每次 1 行 NDJSON（末字节必须 `0x0a`）、connect 300ms/read 700ms、1 次尝试、失败仅 stderr 节流计数、shutdown 最多排空 1s。
- 三层 try-catch（premain/Advice/发送）；agent 任何 bug 都不得让 demo 请求失败或变慢（<3000ms，collector 停机时仍 200）。
- 队列丢弃/非 202 只计数（`dropped=`/`ingest_rejected=`），不写 `DROP_COUNT`（S1 D16 遗留，S2 不扩）。

### 7.7 Spike 与 BLOCKED

- Spike A（先于完整实现）：4 个目标类各打印一次 `transformed <class>`；一次 cancel 读回 4 条同 trace 事件。
- Spike B：`mappedStatement` 反射（含父类字段）能取到 id 且等于 cancel；取不到 → `BLOCKED` + 反射异常日志。
- Spike C：demo fat jar 的 `LaunchedURLClassLoader` 能解析 agent helper（S1 已证同类场景；MyBatis 类启动后加载）。
  命中 `NoClassDefFoundError` → `BLOCKED`。
- **不得**用 fixture/合成事件冒充 4 span 或 0 行；spike 失败即停，不降级。

## 8. Collector 设计（coder-backend）

### 8.1 派生模型

- 新增 `web/RequestsController`（或 `SessionsController` 新方法）：只读内存快照（`SessionLog.snapshot()`），用 Jackson `readTree` 逐条解析已存原始 JSON 为轻量记录
  （traceId/spanId/parentSpanId/kind/nodeKey/status/confidence/startNs/durNs/return/sideEffects/thread/flags/rootEventId）。
- **读时派生**：不新增存储结构、不缓存、不改写、不占用 `seq`；同一快照两次请求输出一致；重启即清空（与 §7.2 查询一致）。
- 未知 session（`store.find==null`）→ 404 信封；不自动创建会话。

### 8.2 requests

- 按 `traceId` 分组（顺序不重要，输出前排序）；根 = `parentSpanId=null`（多个取 `startNs` 最小、同值 `spanId` 字典序最小）；无根仍输出（`root*`/`nodeKey=null`，`confidence="LOST"`）。
- `spanCount`=组内事件数；`startedAtNs`=min `startNs`；`durNs`=max(`startNs+durNs`) − min(`startNs`)；`hasError`=存在 `THREW`；`status` 按 §5 优先级聚合。
- 排序 `startedAtNs` 升序、同值 `traceId` 字典序；空会话 `{"sessionId":"...","requests":[]}`；无分页。

### 8.3 graph

- 参数：`traceId` 以字符串接收并严格匹配 `^[0-9a-f]{32}$`（缺失/空/大写/长度错 → 400）；session 未知 → 404；session 内无 trace → 404。
- 顶层 `sessionId/traceId/rootEventId/confidence`；`nodes` 每条 11 字段（`return` 原样可为 `null`、`sideEffects` 缺省 `[]`、`thread` 缺省 `null`、`flags` 缺省 `[]`）。
- `edges`：对每个 `parentSpanId` 在本 trace 内的节点产出 `{from:parentSpanId,to:spanId,count:1}`；父不在 trace 内 → 节点保留、无边。
- 排序：`nodes` 按 `startNs`、同值 `spanId`；`edges` 按父节点在 `nodes` 的位置，再按子节点位置。
- **不聚合**：同 `nodeKey` 多次调用 → 多个节点（×N 属 S3+）；`edges.count` 恒 1。

### 8.4 只读与禁止项

- 只 `GET`（写动词 405，Boot 默认体可接受）；无 CORS/鉴权/429/分页；未识别查询参数忽略；错误用统一信封（含 `apiVersion:"v1"`）。
- 不注册 `/replay`、`/stream`、`/ws/v1/events`、`/links`；不改 ingest；不改 meta 5 键；不引 DB/文件依赖。

## 9. Workbench 设计（coder-frontend）

- `src/api.ts` 新增类型与函数：`RequestSummary`、`RequestsResponse{sessionId,requests}`、`GraphNode`、`GraphEdge{from,to,count}`、`GraphResponse{sessionId,traceId,rootEventId,confidence,nodes,edges}`、
  `fetchRequests(sessionId)`、`fetchGraph(sessionId, traceId)`；错误沿用 `CollectorUnreachableError`/`CollectorHttpError`（404/400 分别提示）。
- `components/S2Panel.vue` + `stores/s2.ts`；稳定选择器：`#s2-panel`、`#s2-session`（下拉，来自 `/sessions`，默认 `s_s2agent`）、`#s2-refresh`、`#s2-requests`（请求 tabs/列表，点选切换）、`#s2-chain`（选中 trace 的事实链）。
- 事实链渲染：按 `nodes`（已按 `startNs` 排序）画**缩进树/清单**（用 `edges` 的父子关系），每节点显示 `kind`/`nodeKey`/`status` 徽标/`return` 摘要/`sideEffects` 摘要；
  **不引入图库**、不做拖拽/缩略图/时间轴。同 `nodeKey` 重复出现就显示多条（S2 不聚合 ×N）。
- 事实摘要条（中性样式，无绿/红裁决）：`SQL 影响 0 行`、`Mapper 返回 0`、`Service 返回 true`、`Controller HTTP 200`、`异常 0`；常驻文案 **`事实摘要，不是缺陷结论`**。
  取值规则：sql 行数 = 所有 `kind=sql` 节点 `sideEffects[].rowsAffected` 之和；mapper/service/controller 取对应 kind 节点的 `return.value`；
  异常数 = `status="THREW"` 节点数；**某 kind 缺失时显示“未采集”，不得显示 0/false/200**（缺失≠0 行）。
- LOST 标注：请求 `confidence="LOST"` 时显示 `游离后端请求（无前端根）`；不画点击/前端节点；`THREW` 才用异常样式，`OK` 中的 0/false 不标红。
- 刷新：`#s2-refresh` 手动 + 5s 轮询（`document.visibilityState==="visible"` 时）；文案 `每 5 秒刷新（非实时）`；无 SSE/WebSocket/EventSource。
- S1 面板折叠为次级并标注 `S1 walking skeleton（假数据，非 S2 事实链）`；S0 `FixturePanel` 保留；错误/空态不崩（不可达 / 404 / 空会话）。
- 代理不变（`/api`、`/ingest` → `http://127.0.0.1:8601`）；不调 demo 后端、无绝对 URL、无 CORS、无自动上报。

## 10. 契约与 fixture 变更（本计划同步交付）

1. `api.v1.md`：§2.2 S2 矩阵（requests/graph IMPLEMENTED，其余 RESERVED 不变）；§8.1/§8.2 形状/参数/排序/聚合/错误/只读；§8.3 meta 不变；§8.5 未实现清单；§8.6 冒烟；附录 B demo 0 行行为（附录 A 保留 S0 历史）。
2. `event-model.v1.md`：仅 4 处短注（`transaction="UNKNOWN"`、controller return 可带 HTTP 状态、游离根可带同 trace 子链且 `LOST_BACKEND` 只在根、`S2_ZERO_ROW_CHAIN` 阶段 flag）+ §11 样例索引 + S2 边界句；**schema 字节不变**。
3. `transport.v1.md`：变更记录 + §1 S2 一句 + §2 通路 C 行 + §6.3 只读请求/图查询 + §8 状态指向；ingest/通路 B 零改动。
4. `fixtures/s2-zero-row-chain/`：`events.ndjson`（4 行）、`expected-facts.json`（6 fact + globalAssertions）、`README.md`；新增目录，不改 S0/S1 fixture。

## 11. 测试计划（tester；映射分发书 S2-A..S2-L）

一次命令 `(cd "tools/verify" && node verify.mjs)`，非 0 即 FAIL；串行起停、`finally` 清理进程与临时文件。

| ID | 分发书 | 断言（精确） |
|---|---|---|
| T1 | S2-A | s2 fixture 4 行过 schema（Ajv 2020-12 strict）；单根/共享 trace+root/全 LOST/全 OK/父子链/区间严格嵌套；`expected-facts.json` 6 fact + globalAssertions 全过；负例（加 `seq`、双根、断父链、`confidence=EXACT`）被拒 |
| T2 | S2-B | demo 构建 exit 0；静态断言 H2 依赖（runtime、版本由 Boot 管理）、`mybatis-spring-boot-starter:2.3.1`、`schema.sql`/`data.sql`、`status='PAID'`、无 `InMemoryOrderStore`、无 MySQL 驱动/URL |
| T3 | S2-C | agent jar `major=52`/`Premain-Class`/shaded 包存在且无未 relocate 的 `net/bytebuddy`；collector jar 内 schema 与仓库根 sha256 逐字相等；workbench `npm ci && npm run build` 绿 |
| T4 | S2-D | 真 E2E（collector + demo `-javaagent`）：`POST /api/orders/1/cancel` → `200 {"data":true}`；≤10s 读回 4 span：kinds `controller/service/mapper/sql`、父子正确、同 trace/root、全 LOST、全 OK、`durNs>0`；`mapper return.value=0`、`service=true`、`controller return.value=200`、`sql rowsAffected=0/transaction=UNKNOWN`；无 `THREW`；无额外 update span；`GET /api/orders` 仍 CREATED |
| T5 | S2-E | 未知 id → `404 {"data":false}`；若被采集则 service 为 `RETURNED_FALSE`（2 span），无 mapper/sql；不得伪造 |
| T6 | S2-F | requests：分组、`spanCount=4`、`rootKind/nodeKey/status=OK/confidence=LOST`、`startedAtNs`/`durNs`/`hasError=false`；排序（造 2 trace）；空会话 `[]`；未知 session 404；`POST` 405 |
| T7 | S2-G | graph：4 节点 3 边、按 `startNs` 排序、`return`/`sideEffects` 原样、无 ×N 合并；未知 trace 404；缺失/非法 `traceId` 400；两次 GET 逐字一致且 eventCount 不变 |
| T8 | S2-H | dist 含 `#s2-panel/#s2-session/#s2-refresh/#s2-requests/#s2-chain`、5 条事实文案、`事实摘要，不是缺陷结论`、`每 5 秒刷新（非实时）`、`游离后端请求（无前端根）`；无 SSE/WS/EventSource/时间轴/回放/图库/SDK；代理仍 `/api`→`127.0.0.1:8601` |
| T9 | S2-I | S0/S1 回归按分发书 §4.8：S0 全保留；S1-A fixture、S1-B 产物、S1-C/D ingest/查询、S1-F 假批次；**S1-E 改写**为 4-span 断言、**S1-H 改写**为 S2 范围扫描、**S1-G** 基线改为 S0 冻结面 + S2 G1 哈希（S1 fixture 不纳入新哈希）；S1 fixture 字节未变；旧断言不得放宽 |
| T10 | S2-J | fail-open：停 collector → cancel 仍 `200` 且 <3000ms、demo 存活；恢复后新请求可采集 |
| T11 | S2-K | 范围/安全：无 S3 能力（SDK/traceparent/replay/timeline/SSE/WS/values），无 service/mapper 之外的探针；0 secret/真实数据/遥测/CDN/镜像；仅回环；无第二份 schema |
| T12 | S2-L | 漂移（G1 哈希）与清理：6 端口无监听、无遗留 java、git 索引未动（验收后干净树复跑）；浏览器证据由 orchestrator 提供，tester 不断言截图 |

- 证据：`docs/plans/stages/S2/test-report.md` 写环境版本、逐项 PASS/FAIL、复现命令、E2E 输出摘要、进程已停声明。
- 禁止：改产品/契约/fixture、放宽断言、常驻服务、git。

## 12. 精确命令（仓库根，路径双引号）

### 12.1 构建

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)
(cd "workbench" && npm ci && npm run build)
```

若 demo 报 `invalid target release: 21` → 说明用了 JDK21 构建 demo，按上面覆盖 `JAVA_HOME` 重跑（不改 `java.version`）。

### 12.2 collector 起停 + 派生接口

```bash
"C:/Program Files/Java/jdk-21/bin/java" -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:8601/actuator/health" >/dev/null && break; sleep 1; done
curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" \
  --data-binary @"fixtures/s2-zero-row-chain/events.ndjson"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/graph?traceId=9f8e7d6c5b4a39281706f5e4d3c2b1a0"
# 负例：404 / 400 / 404 / 405（见 api.v1.md §8.6）
# 停止：kill %1；netstat -ano | grep ":8601" 确认无监听
```

### 12.3 demo + agent 端到端

```bash
JAVA8="C:/Program Files/Java/jdk1.8.0_221/bin/java"   # 固定绝对路径，不依赖 PATH
"$JAVA8" -javaagent:"agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" \
  -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s2agent \
  -jar "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://localhost:8080/api/orders" >/dev/null && break; sleep 1; done
curl -s "http://localhost:8080/api/orders"                       # seed：id=1 CREATED 100.0
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"     # 期望 {"data":true}
curl -s -X POST "http://localhost:8080/api/orders/999/cancel" -w "\n%{http_code}\n"   # 期望 {"data":false} / 404
curl -s "http://localhost:8080/api/orders"                      # 仍 CREATED（0 行事实）
curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests"
# 取 traceId 后读图（node 可用，避免依赖 jq）：
node -e "fetch('http://127.0.0.1:8601/api/v1/sessions/s_s2agent/requests').then(r=>r.json()).then(j=>console.log(j.requests[0].traceId))"
# 停止：kill %2 %1；taskkill /PID <pid> /T /F（Windows 兜底）
```

### 12.4 门禁与产物证据

```bash
(cd "tools/verify" && npm ci && node verify.mjs)
unzip -p "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" META-INF/MANIFEST.MF | grep -i "Premain-Class"
javap -verbose -classpath "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" io.traceboard.agent.TraceAgent | grep "major version"
```

## 13. Spike 顺序（coder-backend 必须按此顺序，先证据后完整）

1. **Demo DB 先行**：改 H2+MyBatis → 构建/启动 → `GET /api/orders` 读到 seed → `POST /1/cancel` 200 true 且列表仍 CREATED。
   0 行证据：临时把 `logging.level.com.example.shop.mapper=DEBUG` 打开看 `Updates: 0`（**spike 后移除**，不作为产品特性），或读回 Mapper 返回值（spike 2）。
2. **Agent 4 span**：实现四点插桩 + ThreadLocal 栈 → 一次 cancel 读回 4 条同 trace 事件；transform 日志 4 个类各 1 行；无 `NoClassDefFoundError`。
3. **Collector API**：requests/graph 对 spike 2 的 4 条事件派生 → 形状/排序/边正确；两次 GET 一致。
4. **UI**：workbench 接 requests/graph → 请求切换 + 事实链 + 中性事实条。
- 任一步失败且无法在不伪造的前提下修复 → 首行 `BLOCKED: 原因` + 日志；最多返工一轮，不降级。

## 14. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| MyBatis 插桩不命中（`MapperProxy`/`PreparedStatementHandler` 类加载、`ignore` 规则误伤 `org.apache.ibatis`） | 无 mapper/sql span | §13 spike 2；`ignore` 不含 `org.apache.ibatis`；失败 `BLOCKED`，禁止合成 |
| `mappedStatement` 私有字段（在 `BaseStatementHandler`）读不到 | 无 sql span 或行数错 | 反射遍历父类字段、只读；失败不产生 sql span + `BLOCKED` |
| Boot fat jar/`LaunchedURLClassLoader` 解析 helper 失败 | 应用起不来 | 沿用 S1 内联静态调用；`NoClassDefFoundError` → `BLOCKED` |
| H2 2.1.214 初始化顺序/保留字/内存库早关 | 启动即 500 或空表 | `spring.sql.init.mode=always` + `DB_CLOSE_DELAY=-1`；启动后先 GET 列表验证 seed；版本由 Boot 管理，不手改 |
| 反射读 HTTP 状态失败 | controller `return.value=null` | fail-open + stderr 计数，不猜 200/404；tester 在 E2E 断言 200/404 时必须先看到真实值 |
| 事件到达顺序 ≠ `startNs` 顺序 | 排序/断言错 | 一律按 `startNs`/父子关系；E2E 轮询按集合 |
| S1 旧门禁冲突 | 回归红 | 分发书 §4.8 显式迁移 S1-E/S1-G/S1-H；其余保留、不放宽 |
| 工作台把 LOST 画成点击链 / 把缺失当 0 | 误导 | LOST 标注 + 无前端节点 + “未采集”文案 + 中性事实条 |
| 轮询/端口/时序不稳 | E2E 偶发失败 | 5s UI 轮询、E2E ≤10s、串行起停、先诊断端口、`finally` 清理 |
| 0 行被标为错误状态 | 语义错 | `OK` 含 0；`RETURNED_FALSE` 只用于布尔 false；UI 中性样式 |

## 15. 偏离记录（相对 `dispatch.md`；均由本计划收敛，不扩范围）

| ID | 事项 | 处理与理由 |
|---|---|---|
| D1 | dispatch §4.3 的 requests 示例只列 7 个字段 | 增加顶层 `sessionId` 与每条 `durNs`/`hasError`（只读派生，便于客户端断言与 UI；不改变 dispatch 语义）；见 api §8.1 |
| D2 | dispatch §4.4 的 edges 用 `{parentSpanId,childSpanId,count}` | 改为 `{from,to,count}`（`from`=父、`to`=子），语义等价；dispatch §4 已把“细节”委托 plan-writer；api §8.2 记录命名对照 |
| D3 | dispatch §4.2 的 controller `return` 为 `{"type":"http","value":200}` | 改为真实返回类型 FQCN + 状态码值（`{"type":"org.springframework.http.ResponseEntity","value":200}`），与 `event-model` §4.3 S2 短注一致；不虚构类型，仍不记 body |
| D4 | dispatch §4.5 写“子 span flags 含 LOST_BACKEND”（与 §4.2“子 flags 只有 S2_ZERO_ROW_CHAIN”矛盾） | 以 §4.2 与 `event-model` §7 为准：`LOST_BACKEND` **只在根**；子 span `confidence` 仍为 `LOST` |
| D5 | dispatch §4.2/§4.5 的 `source` 无行号口径 | fixture 行号是示例值；agent 只写真实栈帧，tester 只断言文件名（同 S1） |
| D6 | dispatch §4.2 允许“额外 select span 默认不插桩”但未定存在性检查实现 | 选 mapper `countById`（真实 SQL）且不插桩 → 链固定 4 span；属采集范围限定，不伪造；test-report 记录该缺口 |
| D7 | dispatch §4.3 未定义“一个 trace 多个根”的取舍 | 取 `startNs` 最小、同值 `spanId` 字典序最小；无根仍列出（`null` + `LOST`）；api §8.1 固化 |
| D8 | dispatch §3 未点名 agent 默认 session 迁移 | `AgentConfig` 默认 `s_s1agent` → `s_s2agent`；S1 回归显式传 `-Dtraceboard.sessionId=s_s1agent`，不受影响 |
| D9 | dispatch §4.5 的 fixture `durNs` 是“可微调” | 采用 dispatch 给定值 8000000/6500000/5000000/3000000（严格嵌套），不另调 |

## 16. 回滚

1. 只有 acceptance 写 git；S2 绿后打 `s2-baseline`，失败不 tag；不 push/force/rebase。
2. 代码回滚：`git revert <s2-commit>`；单文件还原用 `git checkout s1-baseline -- "<path>"`（仅 acceptance，禁止 `reset --hard`/`clean -f`）。
3. 运行期回滚（不改代码）：去掉 `-javaagent` 与 `-D` 参数重启 demo；collector 停服不影响 demo（fail-open）。
4. demo 回滚：恢复 `InMemoryOrderStore` 版本（`git checkout s1-baseline -- "demo/buggy-shop-boot-vue/backend/**"`），H2/MyBatis 依赖一并回退。
5. 契约回滚：S2 章节是**追加型**（§2.2/§8/附录 B、transport §6.3、event-model 短注），`git checkout s1-baseline -- "docs/contracts/*.md"` 即可；无数据迁移（collector 不持久化）。
6. fixture 回滚：`fixtures/s2-zero-row-chain/**` 为新增目录；删除前必须回 G1 流程（不得静默删改冻结文件）。
7. 越界/失败：命中 §2.2 或 `BLOCKED` 条件立即停止上报，不降级放行、不“先提交再说”。

## 17. 步骤与门禁

`plan-writer（本交付）→ plan-reviewer（G1）→ coder-backend ∥ coder-frontend → tester → acceptance（G2，commit+tag s2-baseline）`

- **Step 0**：契约 S2 章节 + 3 个 fixture + 本计划 → G1；FAIL 最多返工一轮，仍 FAIL 上报。
- **Step 1 coder-backend**：①§13 spike 1（demo DB）→ ②spike 2（agent 4 span）→ ③§13 spike 3（collector API）→ ④补测试口径冒烟；spike 失败 `BLOCKED`。
- **Step 2 coder-frontend（可并行）**：`api.ts` 类型 → S2 面板/事实条/轮询 → S1 折叠 → `npm ci && npm run build` 绿。
- **Step 3 tester**：S2-A..S2-L 一次命令；写 test-report；exit 0。
- **Step 4 acceptance（G2）**：重跑 tester/构建/演示路径；G1 哈希不变；越界/安全检查；README/acceptance/progress；按文件名 add + commit + tag。
- S2 检查点到达即停；**不得开始 S3**。

## 18. 完成定义（S2 出口）

- 本文件 + api §2.2/§8/附录 B + event-model/transport 短注 + `fixtures/s2-zero-row-chain/**` 经 G1 PASS；fixture 4 行过冻结 schema（离线已验证）；schema 字节不变。
- 真实 0 行来自 H2+MyBatis 运行时（非 fixture）；4-span 链字段/父子/LOST/状态/行数与 `api §8` 一致。
- requests/graph 全形状/排序/聚合/400/404/405 通过；两次 GET 一致、事件不变；meta 5 键不变。
- 工作台请求切换 + 事实链 + 中性事实条 + 5s 非实时轮询；S1 面板折叠、S0 面板保留。
- `tools/verify` 一次命令 exit 0（S2-A..S2-L），S0/S1 按 §14-T9 迁移后全绿；test-report/README/progress/acceptance 齐备。
- 统一标注：service/mapper/SQL 已采集但**无前端 SDK/关联/回放/实时**；S2 通过不等于产品完成。

## 19. 变更记录

| 日期 | 版本 | 变更 | 触及文件 |
|---|---|---|---|
| 2026-11-24 | v1 | 首版：S2 demo 0 行设计、agent 4 span、collector requests/graph、workbench 事实板、T1–T12、D1–D9 偏离 | api.v1.md、event-model.v1.md、transport.v1.md、fixtures/s2-zero-row-chain/**、本文件 |
