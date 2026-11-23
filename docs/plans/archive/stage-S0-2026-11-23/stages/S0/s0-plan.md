# S0 实施计划（s0-plan）

> 阶段：S0（MVP）｜版本：v1｜日期：2026-11-23｜作者：plan-writer
> 上游：`docs/plans/stages/S0/dispatch.md`（绑定简报）、`docs/plans/SOLO-PLAN.md` S0 行、主计划 §2.3/§8/§9/§13/§16/§19
> 下游：coder-backend、coder-frontend、tester、acceptance（G1 PASS 后生效；本文件冻结后只读）

## 1. 目标与验收口径

S0 只交付**可构建、可评审、可读取的骨架与契约**，不交付任何采集/关联/图能力。

| # | 目标 | 完成信号（本阶段口径） |
|---|---|---|
| G-A | 仓库可构建 | 根 reactor（JDK21）`package` 绿；demo 后端（JDK8）`package` 绿；workbench `npm run build` 绿 |
| G-B | 契约可评审 | schema v1（2020-12）+ 事件/状态/传输/API 四份草案齐全；plan-reviewer 判 `G1: PASS` |
| G-C | fixture 可读 | case A 的 9 行 JSONL 逐行过 schema；工作台骨架展示 5 条事实卡 |
| G-D | 骨架可启动 | collector（8601）与 demo 前后端（8080/5174）能起能停；与 collector **不通信**；无采集、无关联、无图 |

以上对应分发书 §1 的 4 条证明；证据格式见 §10。

## 2. 前置条件与冻结输入

1. G1 评审 PASS（`docs/plans/stages/S0/plan-review.md`），`schema/**`、`docs/contracts/**`、`fixtures/**` 冻结。
2. 环境（分发书 §8，不得改写）：
   - Windows 10 + Git Bash；仓库路径含中文与空格，所有命令/路径双引号。
   - Maven 3.9.5；默认 `JAVA_HOME` = JDK `1.8.0_221`；JDK21 在 `C:/Program Files/Java/jdk-21`。
   - Node 22.22.2 / npm 10.9.7；Maven Central 与 npm registry 可达。
   - git 已初始化（`master`、0 commit、无 remote）；**S0 不重复 `git init`**。
   - 端口：collector 8601、demo 后端 8080、workbench 5173；demo 前端固定 5174（见 §13-D1）。
3. 开工前记录冻结哈希（acceptance 复核用）：

```bash
sha256sum "schema/traceboard.event.v1.json" \
  "fixtures/case-a-zero-rows/events.jsonl" \
  "fixtures/case-a-zero-rows/expected-facts.json" \
  "docs/contracts/event-model.v1.md" "docs/contracts/status-semantics.md" \
  "docs/contracts/transport.v1.md" "docs/contracts/api.v1.md" > /tmp/s0-freeze.sha256
```

4. 端口预检（冲突先诊断记录，不静默改）：

```bash
netstat -ano | grep -E ":(8601|8080|5173|5174)" || true
```

## 3. 目标文件树（S0 全部新增文件）

```text
TomcatWorkflowDebuggingViewTool/
├── pom.xml                                  # coder-backend：根 reactor（packaging pom）
├── .gitattributes                           # acceptance（G2 新增授权，仅换行策略；见 §13-D15）
├── agent/
│   ├── pom.xml                              # release 8 + Premain-Class MANIFEST
│   └── src/main/java/io/traceboard/agent/TraceAgent.java
├── server/collector/
│   ├── pom.xml                              # Boot 3.2.12 / Java 21
│   └── src/main/
│       ├── java/io/traceboard/collector/
│       │   ├── CollectorApplication.java
│       │   └── web/
│       │       ├── MetaController.java
│       │       └── IngestController.java
│       └── resources/application.yml
├── demo/buggy-shop-boot-vue/
│   ├── backend/                             # 独立 Maven（非 reactor 子模块），Boot 2.7.18 / Java 8
│   │   ├── pom.xml
│   │   └── src/main/
│   │       ├── java/com/example/shop/
│   │       │   ├── ShopApplication.java
│   │       │   ├── model/Order.java
│   │       │   ├── store/InMemoryOrderStore.java
│   │       │   ├── service/OrderService.java
│   │       │   └── controller/OrderController.java
│   │       └── resources/application.yml
│   └── frontend/                            # Vue3+TS+Vite 单页（dev 5174）
│       ├── package.json  package-lock.json  index.html
│       ├── vite.config.ts  tsconfig.json  env.d.ts
│       └── src/{main.ts,App.vue,style.css}
├── workbench/                               # Vue3+TS+Vite+Pinia（dev 5173）
│   ├── package.json  package-lock.json  index.html
│   ├── vite.config.ts  tsconfig.json  env.d.ts
│   ├── .gitignore                           # 含 public/fixtures/
│   ├── scripts/sync-fixtures.mjs
│   └── src/
│       ├── main.ts  App.vue  style.css  fixtures.ts
│       ├── components/{FixturePanel.vue,FactCard.vue}
│       └── stores/app.ts                    # 空壳 store
├── tools/verify/
│   ├── package.json  package-lock.json
│   └── verify.mjs                           # tester 唯一代码产物
├── schema/traceboard.event.v1.json          # plan-writer（冻结）
├── fixtures/{README.md,case-a-zero-rows/**} # plan-writer（冻结）
└── docs/
    ├── contracts/{event-model.v1.md,status-semantics.md,transport.v1.md,api.v1.md}
    └── plans/stages/S0/{s0-plan.md,plan-review.md,test-report.md,acceptance.md,progress.md}
```

约束：`target/`、`node_modules/`、`dist/`、`public/fixtures/` 已被 `.gitignore` 或子 `.gitignore` 覆盖；
`workbench/public/fixtures/` 是构建期副本，**不得提交**。根 `README.md`、根 `.gitignore` 由 acceptance 负责，coder 不碰。

根 `.gitattributes` 同属 **acceptance 独占写下**（G1 轮次新增授权，见 §13-D15 与 §11 风险表）：系统级
`core.autocrlf=true` 且仓库当前无该文件，LF 不变量在 git 层无任何保护。plan-writer 在 G1 修订轮**不创建**
该文件；coder/tester 也不得创建。`dispatch.md` §5.6 的输出清单未列入该项（plan-writer 无权改分发书），
acceptance 以本文件 §13-D15 与 Step 4 为授权依据。

## 4. 构建事实（固定，不得协商）

| 项 | 值 |
|---|---|
| 根坐标 | `io.traceboard:traceboard:0.1.0-SNAPSHOT`，packaging `pom`，modules：`agent`、`server/collector` |
| 根构建 JDK | JDK21（命令前覆盖 `JAVA_HOME`），`maven.compiler.release=21` |
| Spring Boot | 根 `dependencyManagement` 导入 `spring-boot-dependencies:3.2.12`（3.2.x 补丁可替换，实测版本写入 test-report） |
| agent | `io.traceboard:traceboard-agent:0.1.0-SNAPSHOT`，`--release 8`，无第三方依赖 |
| collector | `io.traceboard:traceboard-collector:0.1.0-SNAPSHOT`，Boot 3.2.12 + Java 21，端口 8601，绑定 `127.0.0.1` |
| demo 后端 | `com.example:demo-shop-backend:0.1.0-SNAPSHOT`，Boot 2.7.18 + Java 8，端口 8080（独立工程） |
| 产物 | `agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar`、`server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar`、`demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar` |
| 包名 | agent `io.traceboard.agent`；collector `io.traceboard.collector`；demo `com.example.shop` |

## 5. 后端设计（coder-backend）

### 5.1 根 reactor（`pom.xml`）

- `groupId=io.traceboard`、`artifactId=traceboard`、`version=0.1.0-SNAPSHOT`、`packaging=pom`。
- `<modules><module>agent</module><module>server/collector</module></modules>`，**不包含 demo**。
- properties：`maven.compiler.release=21`、`project.build.sourceEncoding=UTF-8`、`spring-boot.version=3.2.12`。
- `dependencyManagement`：`spring-boot-dependencies:${spring-boot.version}`（type=pom, scope=import）。
- `pluginManagement`：`maven-compiler-plugin:3.13.0`（release 继承属性）、`maven-jar-plugin:3.4.1`、`spring-boot-maven-plugin:${spring-boot.version}`。
- 根工程不写业务代码、不打可执行 jar。

### 5.2 agent（`agent/`）

- `pom.xml`：parent 为根 reactor；`<maven.compiler.release>8</maven.compiler.release>` 覆盖；**零依赖**（禁止 ASM/Byte Buddy/JDK attach）。
- `maven-jar-plugin` 配置 `archive/manifestEntries`：`Premain-Class: io.traceboard.agent.TraceAgent`、
  `Implementation-Title: TraceBoard Agent`、`Implementation-Version: ${project.version}`；不设 `Agent-Class`（S0 只支持 `-javaagent`）。
- `TraceAgent.java`（唯一 Java 文件，final 类 + 私有构造）：
  - 包 `io.traceboard.agent`；只暴露 `public static void premain(String agentArgs, Instrumentation inst)`；
  - 方法体只向 `System.err` 打印**一行**：`[traceboard-agent] noop premain; args=<agentArgs 或空串>`；
  - 不注册 Transformer、不调用 `inst`、不扫描类、不读配置、不开网络；日志失败也不得抛异常（S0 天然 fail-open）。

### 5.3 collector（`server/collector/`）

- `pom.xml`：parent 根 reactor；依赖 `spring-boot-starter-web`、`spring-boot-starter-actuator`；build 启用 `spring-boot-maven-plugin`（repackage）。禁止 DB/JPA/MyBatis/关联引擎/SDK。
- `CollectorApplication.java`：`@SpringBootApplication` + `main`。
- `application.yml`：
  ```yaml
  server:
    port: 8601
    address: 127.0.0.1
  spring:
    application:
      name: traceboard-collector
  management:
    endpoints:
      web:
        exposure:
          include: health
    endpoint:
      health:
        show-details: never
  ```
- `MetaController`：`GET /api/v1/meta` → 200，body 严格按 `docs/contracts/api.v1.md` §3.2：
  `service/version/apiVersion/schema{id,version,dialect}/capabilities{health,meta,ingestEvents,realtime,replay}`；
  S0 `ingestEvents/realtime/replay` **必须为 `false`**；`version` 用 `0.1.0-SNAPSHOT`。
- `IngestController`：`POST /ingest/v1/events` → 固定
  `501 {"error":"not_implemented","message":"ingest is reserved for S1; S0 collector skeleton stores nothing","apiVersion":"v1"}`；
  **不读取/不解析/不落盘** body，无内存缓存，不创建目录；不声明 `consumes` 限制（S0 任何 Content-Type 都命中 501）。
- 不添加 CORS 配置；不暴露 actuator 其他端点；不注册任何 RESERVED 路由（sessions/graph/stream/links）。
- 允许的类总数：`CollectorApplication` + `MetaController`（可含嵌套错误 DTO）+ `IngestController`；不建 `service/storage` 包。

### 5.4 demo 后端（`demo/buggy-shop-boot-vue/backend/`）

- 独立 Maven 工程（parent `spring-boot-starter-parent:2.7.18`，**不是**根 reactor 子模块），`java.version=1.8`；用默认 `JAVA_HOME`（JDK8）构建。
- `application.yml`：`server.port=8080`、`spring.application.name=demo-shop-backend`；无 DB 配置、无 profile。
- 代码（5 个类，全部 Java 8 语法，不写 record/lombok）：
  - `ShopApplication`：`@SpringBootApplication`。
  - `model/Order`：`long id`、`String orderNo`、`String status`、`double amount` + getter/setter。
  - `store/InMemoryOrderStore`（`@Component`）：`ConcurrentHashMap<Long, Order>`，构造时种子 `1/SO-0001/CREATED/100.00`；方法 `List<Order> findAll()`、`boolean cancel(long id)`（存在则置 `CANCELLED` 并返回 true；幂等）。
  - `service/OrderService`（`@Service`）：包装 store，`list()` / `boolean cancel(long id)`。
  - `controller/OrderController`（`@RestController`，`/api/orders`）：
    - `GET /api/orders` → `200 {"data":[{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100.0}]}`；
    - `POST /api/orders/{id}/cancel` → 存在：`200 {"data":true}`；不存在：`404 {"data":false}`（demo 前端只调 1）。
- 禁止：0 行缺陷植入（S2）、SQL/MyBatis/MySQL、TraceBoard 依赖、agent、CORS、跨域注解、日志打印订单数据。
- demo 应用与 collector **零通信**；不引入任何 HTTP client。

## 6. 前端设计（coder-frontend）

### 6.1 workbench（`workbench/`）

- 栈：Vue 3 + TypeScript（strict）+ Vite + Pinia。**不引入 Cytoscape**（S0 不渲染图；依赖 S1 再加，见 §13-D9）。
- `vite.config.ts`：`server.port=5173`、`strictPort=true`；不配 proxy（**不连 collector**）。
- `index.html`：本地资源、无 CDN、无在线字体；标题 `TraceBoard`。
- `src/App.vue`：根元素带 `class="app-shell"`（同时作为冒烟标记），AppShell **三区**：
  1. 顶部 header：`TraceBoard` + 版本（`0.1.0`）+ 模式标签 `S0 骨架` + 说明“未采集 / 未关联 / 无图”；
  2. 左侧面板：标题「前端图（占位）」，空状态文案（S1 待做）；
  3. 右侧面板：标题「请求分图（占位）」+ 请求 Tab 占位（不可交互切换）；
  - 下方（或右栏底部）挂 `FixturePanel`，不破坏三区语义。
- `src/stores/app.ts`：唯一 Pinia store（`defineStore('app', ...)`），state 仅 `appVersion`、`mode`、`selectedRequestId:null`、`selectedNodeKey:null`；**无 action、无 API、无 WebSocket、无图/时间轴状态**。
- `src/fixtures.ts`：加载 `${import.meta.env.BASE_URL}fixtures/case-a-zero-rows/events.jsonl` 与 `expected-facts.json`；
  - 逐行 `split("\n").filter(Boolean).map(JSON.parse)`；
  - 提供类型 `EventRow{kind,status,nodeKey,type}`、`ExpectedFact{id,kind,nodeKey,status,assert,summary}`；
  - 只读，不写回、不上报。
- `components/FixturePanel.vue`：显示「事件数 9」、每行 `type/kind/status/nodeKey`、`DROP_COUNT=0` 标记；渲染 5 条 `FactCard`（id、summary、`path=value` 期望）。
- `components/FactCard.vue`：纯展示卡片，标题 `F1..F5`，副标题 kind/nodeKey；**不做校验结论**、不显示成功/失败裁判。
- `scripts/sync-fixtures.mjs`：Node ESM，`fs.cpSync`/`copyFileSync` 将仓库根 `fixtures/case-a-zero-rows/{events.jsonl,expected-facts.json}` 复制到 `public/fixtures/case-a-zero-rows/`；创建目录、覆盖旧副本、源缺失时非零退出并打印明确错误；路径基于 `import.meta.url`（不依赖 cwd）。
- `package.json` scripts：`dev`、`build`（`vue-tsc --noEmit && vite build`）、`preview`、`sync:fixtures`；
  `predev`/`prebuild` 均执行 `node scripts/sync-fixtures.mjs`。提交 `package-lock.json`（`npm ci` 需要）。
- `workbench/.gitignore`：`node_modules/`、`dist/`、`public/fixtures/`。
- 禁止：真实图/回放/请求切换/节点详情/时间轴、collector 调用、重型 E2E、任何写 API。

### 6.2 demo 前端（`demo/buggy-shop-boot-vue/frontend/`）

- 栈：Vue 3 + TS + Vite（无 Pinia/路由/SDK）；`server.port=5174`、`strictPort=true`；
  scripts 至少 `dev/build/preview`，`build` 为 `vue-tsc --noEmit && vite build`；
  proxy：`'/api' → http://localhost:8080`（`changeOrigin:false`，不 rewrite），保证同源语义、无 CORS。
- 单页：标题「BuggyShop · 取消订单」；按钮 `#btn-cancel`「取消订单」；挂载时 `GET /api/orders`；
  点击后 `POST /api/orders/1/cancel`；将原始响应 JSON 字符串化展示在 `<pre id="raw-json">`；
  2xx 时显示静态提示 `<p id="success-hint">操作成功</p>`（固定文案，不实现 toast 系统/DOM 采集）。
- 请求只用相对路径 `/api/...`；失败时展示 `HTTP <status>` 与错误文本，不做重试/轮询。
- 提交 `package-lock.json`；无 CDN/在线字体。

## 7. 校验工具设计（tester，`tools/verify/`）

- 技术：Node 22 ESM + `ajv@^8.17`（Ajv **2020-12** 入口 `ajv/dist/2020.js`）；不引入浏览器/E2E 框架。
- `verify.mjs` 一次执行、任一项失败即非零退出，控制台输出逐项 `PASS/FAIL` 表；不得为通过放宽断言。
- 检查项（顺序执行，失败继续收集但最终非零）：

| # | 检查 | 方法 |
|---|---|---|
| V1 | schema 可加载 | `new Ajv2020({allErrors:true, strict:true})` + `compile(schema)`（本项同时实证 `strict:true` 编译；G1 评审因本机无 ajv 仅做人工排查，见 `plan-review.md` C21） |
| V2 | JSONL 格式 | 无 BOM、无 `\r`、以 `\n` 结尾、无空行；每行 `JSON.parse` |
| V3 | 逐行 schema | 9 行全部 `validate` 为 true；收集 `status/kind/confidence/traceId/rootEventId` |
| V4 | 期望事实 | `eventCount=9`、`traceId/rootEventId` 全量一致、`noExceptions`、`confidenceAllExact`、`statusAllOk`、每行 `flags` 含 `DROP_COUNT=0`；5 条 fact 按 `kind+nodeKey` 定位并做 `assert.path` 深比较 |
| V4b | 因果区间包含性（含 callback 唯一例外） | 按 `docs/contracts/event-model.v1.md` §5 第 4 条（G1 修订版）机器核对：①每个 `parentSpanId != null` 的事件，其父 span 必须在同一文件出现；②`kind != "callback"` 的事件必须满足 `startNs >= parent.startNs` 且 `startNs+durNs <= parent.startNs+parent.durNs`（严格父子包含）；③`kind == "callback"` 的事件**只**做根包含断言：沿 `parentSpanId` 上溯到 `parentSpanId=null` 的根 span，要求 `startNs >= root.startNs` 且 `startNs+durNs <= root.startNs+root.durNs`（**不要求**落在 `fetch` 父区间内，这是契约唯一例外）；④callback 上溯不到唯一根 → FAIL；⑤该例外**只对 `kind=="callback"` 生效**，其它 kind 一律按②严格校验，不得扩大豁免；⑥case A 具体期望：`1000000000000009`（callback，`[39ms,48ms]`）的父为 `1000000000000004`（`kind=fetch`，`[6ms,38ms]`，即 callback 晚 1ms 启动），callback 只须落在根 `1000000000000001` 的 `[0ms,52ms]` 内；其余 7 个非根 span 必须严格包含 |
| V5 | 反例（必须拒绝） | 在系统临时目录构造副本：①`status` 改为 `SUCCESS`；②`NOT_COLLECTED_POLICY` 且无 `reason`；两者 `validate` 必须为 false（原文件哈希前后不变） |
| V6 | 构建 | 根 reactor（JAVA_HOME=JDK21）、demo 后端（JDK8）、workbench、demo 前端；记录 exit code 与版本 |
| V7 | agent 字节码 | 对 `agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar` 执行 `javap -verbose -classpath <jar> io.traceboard.agent.TraceAgent`，解析 `major version: 52`（失败时回退读 `agent/target/classes/...TraceAgent.class` 第 7–8 字节）；同时断言 jar 存在 |
| V8 | 冒烟 collector | 用 JDK21 java 启动 collector jar → 轮询 `/actuator/health`（≤30s）=`UP`；`/api/v1/meta` 字段与 `capabilities=false`；`POST /ingest/v1/events` =501；停止并确认 8601 释放 |
| V9 | 冒烟 demo 后端 | 用 JDK8 java 启动 demo jar → `GET /api/orders` 200 且 `data[0].id=1`；`POST /api/orders/1/cancel` 200 且 `data=true`；停止并确认 8080 释放 |
| V10 | 产物与副本 | workbench `dist` 的 JS 含 `app-shell`、`前端图`、`请求分图` 文本；`dist/fixtures/case-a-zero-rows/expected-facts.json` 含 `操作成功` 与 5 个 `id`；`sha256sum` 比较 `fixtures/` 与 `workbench/public/fixtures/` 两个文件一致 |
| V11 | 环境记录 | `node -v`、`npm -v`、`mvn -v`（JDK21/JDK8 两次）、`java -version` 写入标准输出，供 test-report 引用 |

- V4b 失败时必须输出可定位证据：`spanId`、`parentSpanId`（及上溯到的根 `spanId`）、`kind`、子区间 `[startNs, startNs+durNs]`、父区间与根区间；9 行必须 0 违规。不得简化为“只查 `startNs` 落在父区间内”，也不得把 callback 整体排除在检查外（callback 仍必须通过根包含）。
- 进程管理：所有子进程 `spawnSync`（`shell:true`）并在 `finally` 中 `taskkill /PID <pid> /T /F`（Windows）兜底；结束前端口复查。
- 临时文件只写系统临时目录（`os.tmpdir()`），不写仓库；不修改任何产品文件。
- 报告文件 `docs/plans/stages/S0/test-report.md` 由 tester 编写（含环境版本、PASS/FAIL 表、复现命令、进程已停止声明），`verify.mjs` 只打印。

## 8. 实施步骤与顺序

阶段门禁：`plan-writer → plan-reviewer(G1) → coder-backend ∥ coder-frontend → tester → acceptance(G2)`；G1 前 coder 不得动工。

**Step 0（已完成）** plan-writer 交付 10 文件 → plan-reviewer 评审。

**Step 1 coder-backend（约 3 个可独立验证的子步）**
1. 根 pom + `agent/**` → 根 reactor 构建；`javap` 验证 major=52；`unzip -p` 验证 MANIFEST `Premain-Class`。
2. `server/collector/**` → 构建；启动；curl health/meta/501；停止。
3. `demo/.../backend/**` → JDK8 构建；启动；curl orders/cancel；停止。
4. 交付：命令、输出摘要、stop 后端口无残留；不改契约。

**Step 2 coder-frontend（与 Step 1 并行；只看冻结的 `fixtures/`/`docs/contracts/`）**
1. workbench 脚手架 + `sync-fixtures.mjs` + AppShell 三区 + Pinia 空壳。
2. FixturePanel/FactCard 读副本 → `npm ci && npm run build`，检查 dist 含三区文案、`app-shell` 标记与 `dist/fixtures/` 副本。
3. demo 前端单页 + 5174 + proxy → 构建；需 demo 后端在线时可手测，不在线只验构建与代理配置。
4. 交付：构建输出、dist 抽查、无 CDN/无 collector 调用证据。

**Step 3 tester（两个 coder 完成后）**
1. 先做 V1–V5（schema/fixture 可先行）；2. 再做 V6–V11；3. 写 `test-report.md`；4. 退出码 0。

**Step 4 acceptance（G2）**
- 亲自重跑 `tools/verify` 与 §9 命令；漂移/越界/安全检查；写 README、acceptance、progress；按文件名 `git add` + `chore(S0): baseline` + tag `s0-baseline`（唯一 git 写入者）。
- 创建仓库根 `.gitattributes`（G1 轮次授权，见 §13-D15）：至少 `*.jsonl text eol=lf`、`*.json text eol=lf`、`*.md text eol=lf`、`*.java text eol=lf`（或用 `* text=auto` 叠加这四条显式行）；随后 `git check-attr -a -- "fixtures/case-a-zero-rows/events.jsonl"` 必须出现 `text: set` 与 `eol: lf`，并确认工作区文件 `\r` 计数仍为 0。
- 在 `acceptance.md` 复述三件事：①demo 前端固定 5174（D1，`dispatch.md` §8 未列该端口）；②实际分支 `master` ≠ 计划中的 `main`（`dispatch.md` §5.6⑥）；③`.gitattributes` 为本轮新增授权（D15，`dispatch.md` 输出清单未列）。

## 9. 精确命令（仓库根，路径必须双引号）

### 9.1 环境自检

```bash
mvn -v                                  # 期望 Java 1.8.0_221
"C:/Program Files/Java/jdk-21/bin/java" -version
node -v && npm -v
```

### 9.2 构建（分发书 §3 原样 + demo 前端）

```bash
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)
(cd "workbench" && npm ci && npm run build)
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
```

若 demo 构建报 `invalid target release: 21`，说明环境混用：确认 `mvn -v` 为 JDK8；不要改 `java.version`。
若默认 `JAVA_HOME` 不是 JDK8，只在 demo 命令前覆盖一次（不全局切换）：

```bash
(cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)
```

### 9.3 agent 证据

```bash
unzip -p "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" META-INF/MANIFEST.MF | grep -i "Premain-Class"
javap -verbose -classpath "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar" io.traceboard.agent.TraceAgent | grep "major version"
# 期望：Premain-Class: io.traceboard.agent.TraceAgent；major version: 52
```

（无 `unzip` 时用 `jar tf`/解压工具替代，但必须留下 MANIFEST 输出证据。）

### 9.4 collector 起停与冒烟

```bash
"C:/Program Files/Java/jdk-21/bin/java" \
  -jar "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar" &
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:8601/actuator/health" >/dev/null && break; sleep 1; done
curl -s "http://127.0.0.1:8601/actuator/health"
curl -s "http://127.0.0.1:8601/api/v1/meta"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://127.0.0.1:8601/ingest/v1/events" \
  -H "Content-Type: application/x-ndjson" --data-binary @"fixtures/case-a-zero-rows/events.jsonl"
# 期望：{"status":"UP"} / meta（capabilities 全 false）/ 501
# 停止：kill %1（或 taskkill），再 `netstat -ano | grep ":8601"` 确认无监听
```

### 9.5 demo 后端起停与冒烟

```bash
(cd "demo/buggy-shop-boot-vue/backend" && java -jar "target/demo-shop-backend-0.1.0-SNAPSHOT.jar") &
for i in $(seq 1 30); do curl -sf "http://localhost:8080/api/orders" >/dev/null && break; sleep 1; done
curl -s "http://localhost:8080/api/orders"
curl -s -X POST "http://localhost:8080/api/orders/1/cancel"
# 期望：{"data":[{...CREATED...}]} / {"data":true}；停止后 8080 无监听
```

### 9.6 前端本地查看（可选，不常驻）

```bash
(cd "workbench" && npm run dev)                                  # 5173
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)          # 5174，需 demo 后端 8080 在线
```

### 9.7 校验

```bash
(cd "tools/verify" && npm ci && node verify.mjs)
```

### 9.8 副本哈希一致性

```bash
sha256sum "fixtures/case-a-zero-rows/events.jsonl" "workbench/public/fixtures/case-a-zero-rows/events.jsonl"
sha256sum "fixtures/case-a-zero-rows/expected-facts.json" "workbench/public/fixtures/case-a-zero-rows/expected-facts.json"
```

## 10. 验收证据（对应分发书 §1）

| 信号 | 证据 | 采集人 |
|---|---|---|
| 1 仓库可构建 | §9.2 四条命令 exit 0；记录 Maven/Node/JDK 版本；无 `-Dmaven.test.skip` 掩盖失败 | tester 报告 + acceptance 重跑 |
| 2 契约可评审 | 10 个 plan-writer 文件 + `plan-review.md` 的 `G1: PASS`；schema 无外部 `$ref` | plan-reviewer |
| 3 fixture 可读 | `node verify.mjs` 的 V2–V5 PASS；workbench 构建产物含 5 条事实摘要；副本哈希一致 | tester + coder-frontend |
| 4 demo 骨架可启动 | collector health/meta/501；demo GET/POST 响应；workbench/demo 页面可加载；停止后端口无残留；collector 日志无来自 demo/workbench 的请求 | tester |
| 安全/边界 | 无 secret/真实数据/外链 CDN；§2.2 清单零出现；`git diff` 证明 coder 未改 schema/contracts/fixtures | acceptance |

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| JDK 混用（根 21 / demo 8 / agent 8） | 构建失败或 agent 被编成 21 | 根命令覆盖 `JAVA_HOME`；agent 子 pom 覆盖 release 8；tester 断言 major=52；demo 用默认 JDK8 |
| Boot 3.2.12 依赖不可达/被代理替换 | 构建失败 | 只用 Maven Central；失败先报错，不换第三方镜像；版本可替换为同 3.2.x 补丁并记录 |
| 5173 被两个 Vite 工程争用 | 前端起不来/验收误判 | workbench 固定 5173，demo 前端固定 5174（`strictPort`）；冲突先 `netstat` 诊断记录 |
| JSONL 被编辑器写成 CRLF/BOM | schema/格式校验失败 | 写文件用 LF；verify 检查 `\r` 与 BOM；失败按报告复现命令修复 |
| CRLF 回归（系统 `core.autocrlf=true` 且仓库无 `.gitattributes`） | 基线提交后任何 `git checkout`/重克隆都会把 `*.jsonl` 还原成 CRLF，V2“无 `\r`”直接 FAIL，fixture 不可读 | acceptance 在 G2 创建根 `.gitattributes`（`*.jsonl text eol=lf`、`*.json text eol=lf`、`*.md text eol=lf`、`*.java text eol=lf`，或 `* text=auto` 叠加显式行）；tester 的 V2 保留 `\r` 检查；acceptance 在全新 clone/checkout 后抽查 `tr -cd '\r' < "fixtures/case-a-zero-rows/events.jsonl" \| wc -c` 为 0 |
| Windows 路径含中文/空格 | 命令解析失败 | 所有命令双引号；Node 脚本用 `fileURLToPath(import.meta.url)` 定位 |
| Ajv 2020-12 入口/严格模式配置错误 | 校验器误报/漏报 | 固定 `ajv/dist/2020.js`、`strict:true`；反例必须被拒作为自检 |
| fixture 与 workbench 副本漂移 | 展示与契约不一致 | `predev`/`prebuild` 强制 sync；verify 哈希比对；副本 gitignore |
| 范围蔓延（顺手做 ingest/图/回放） | 越界失败 | §12 硬清单；acceptance 越界检查；契约中 RESERVED 端点不得出现在代码 |
| schema 空转（全放行） | 契约无约束力 | `additionalProperties:false` + 必填 14 键 + V5 两个反例 |
| agent 日志污染被测应用 | 体验问题 | S0 仅一行 `System.err`，无插桩；后续 fail-open 另行设计 |

## 12. S0 边界（明确不做，越界即失败）

- 真实字节码插桩：Transformer/Byte Buddy/ASM/JDBC 探针；agent 仅 noop premain。
- ingest 落库/存储/关联/游离区；traceparent/clickId 传播；SSE/WebSocket 实现；回放 API 实现。
- 工作台图渲染（Cytoscape 使用）、时间轴、回放、请求切换、节点详情、×N、L2、sourcemap、构建插件、浏览器 SDK。
- 纯前端案例 B、本地启动器/代理/诊断、`server/launcher`、`server/cloud`、Tomcat/WAR、React、MySQL、云端。
- 任何 S1 walking skeleton 内容（一条假事件端到端打通）；demo 与 collector 零通信。
- 本文档不定义关联规则表、图 patch 结构、游离区数据模型；这些属 S1，只保留“RESERVED”字样。

## 13. 偏离与最小修正记录（不修改 dispatch.md）

偏离与最小修正共 **16 条（D1–D16）**，索引以本表为准；其中 D15、D16 与 D6 的理由更正为 2026-11-23
G1 第 1 轮修订新增（见 §16），不改变任何已定 S0 决策、不放松 schema、不扩 S0 范围。

| ID | 事项 | 处理 |
|---|---|---|
| D1 | 分发书只固定 workbench 5173，未给 demo 前端端口；两个 Vite 默认都抢 5173 | demo 前端固定 **5174**（`strictPort`），workbench 保持 5173；写入 transport/api 契约 |
| D2 | §4.2 状态表列 10 行，但要求事件 `status` 投影为 8 值 | 按分发书投影规则：`REDACTED` 落 `values[].redacted`，`LOST` 落 `confidence`；schema 枚举严格 8 值 |
| D3 | §4.1 写 `parentSpanId` 16 位 hex 或 null，未规定大小写 | 与 `spanId` 一致，统一**小写** hex；schema pattern 强制 |
| D4 | 主计划 13.4 要求 `NOT_COLLECTED*` 带 `reason`，但字段清单无 `reason` | schema 增加顶层可选 `reason`（仅 `NOT_COLLECTED*` 必填，if/then）；契约 §6 说明 |
| D5 | 主计划只写 `rootEventId=click_...` | 按分发书 fixture 要求收紧为 `^click_[A-Za-z0-9_-]{8,}$` |
| D6 | `dispatch.md` §4.1/§4.4 未给 `thread.name` 示例（主计划 13.4 的示例是 `http-nio-8080-exec-1`），原文“分发书示例含空格”的前提不成立 | 统一线程命名风格：浏览器侧用无空格的 `browser-main`，后端沿用 `http-nio-8080-exec-1`；契约 §4.2 已注明。结论不变，仅理由更正 |
| D7 | SOLO-PLAN S0 写 `git init`，但 `.git` 已存在 | 按分发书 §1 差异说明：不重复 init；acceptance 只核对 `.gitignore` 覆盖与基线提交 |
| D8 | 主计划 13.3 列出 agent 的 Transformer/probe/context/transport 包 | S0 禁止插桩，仅创建 `TraceAgent.java`；其余包在 S1 再建，不预留空目录 |
| D9 | 分发书允许 workbench “声明 Cytoscape” | S0 不引入该依赖（不渲染图，减少安装面）；S1 再加，需更新 package 与契约说明 |
| D10 | case A 事件数未指定 | 定义 9 行（`validateForm` 独立成 span），`eventCount=9`；5 条事实不变 |
| D11 | `expected-facts.json` 未规定断言语义 | 自定义简单形状：`facts[{id,kind,nodeKey,status,assert{path,value},summary}]`；path 点号分段、数字段为数组下标、深比较；`verify.mjs` 按此实现 |
| D12 | HTTP 200 在事件中的落点未指定 | 固定在 `fetch.return={type:"http",value:200}`；`callback.return={type:"ui_effect",value:"操作成功"}`；README/契约均已注明 |
| D13 | 分发书 demo 后端 `POST /api/orders/1/cancel` 只给 `data:true` | 增加未知 id → `404 {"data":false}` 的最小约定；不影响 1 号用例 |
| D14 | 根 `.gitignore` 已有 `dist/`，workbench 需忽略 `public/fixtures/` | 由 coder-frontend 写 `workbench/.gitignore`（分发书 §5.4 已授权） |
| D15 | `.gitattributes` 未列入任何任务卡输出清单，而环境 `core.autocrlf=true` 且仓库无该文件：LF 不变量在 git 层无保护 | **授权 acceptance** 在 G2 创建仓库根 `.gitattributes`，内容至少 `*.jsonl text eol=lf`、`*.json text eol=lf`、`*.md text eol=lf`、`*.java text eol=lf`（或 `* text=auto` 叠加这四条显式行）。该文件只声明换行策略，不含代码/契约语义，不扩 S0 范围；plan-writer/coder/tester 均不创建（§3 约束、§11 风险表、Step 4 同口径） |
| D16 | `dispatch.md` §3 与 §5.4 把同步脚本写作 `scripts/sync-fixtures.mjs`（未限定前缀），与路径归属矩阵未列的根 `scripts/` 冲突 | 解析为 `workbench/scripts/sync-fixtures.mjs`（workbench 行上下文一致，且避开未分配的根 `scripts/`）；coder-frontend 不得在仓库根新建 `scripts/` |

### 13.1 本轮未采纳、延后到 S1 契约变更的评审建议

| 评审项 | 内容 | 不采纳理由与处置 |
|---|---|---|
| N3 | `return` 对象只 required `["type"]`，`value` 可缺省，与 `dispatch.md` §4.1 的 `{type, value}` 表述不完全一致 | **延后到 S1 契约变更**：把 `value` 加入 required 属 schema 收紧，会改变已冻结的 v1 校验面，而 S0 无采集端需要该区分；G1 轮次明确不改 schema。S1 若引入真实 emitter，再连同“`value` 缺省=未采集到值”一并决策 |

## 14. 逐文件验收清单

### 14.1 coder-backend

| 文件 | 必须满足 |
|---|---|
| `pom.xml` | `io.traceboard:traceboard:0.1.0-SNAPSHOT`、packaging pom、modules 仅 `agent`+`server/collector`、release 21、Boot BOM 3.2.12 import、pluginManagement 完备；无业务依赖 |
| `agent/pom.xml` | parent=根；release **8**；零依赖；maven-jar-plugin 写入 `Premain-Class: io.traceboard.agent.TraceAgent`；jar 名 `traceboard-agent-0.1.0-SNAPSHOT.jar` |
| `TraceAgent.java` | 包名/类名正确；仅 `premain(String,Instrumentation)`；唯一一行 stderr 日志；无插桩/网络/配置读取；major=52 |
| `server/collector/pom.xml` | parent=根；web+actuator；boot repackage；无 DB/关联依赖 |
| `CollectorApplication.java` | `@SpringBootApplication` + main；无额外 `@Bean` |
| `MetaController.java` | `GET /api/v1/meta` 200；字段与 `api.v1.md` §3.2 完全一致；`capabilities.ingestEvents/realtime/replay=false`；`schema.id=urn:traceboard:schema:event:v1` |
| `IngestController.java` | `POST /ingest/v1/events` 固定 501 + 统一错误信封；不读/不存 body；无其它路由 |
| `application.yml` | 8601、`127.0.0.1`、仅暴露 health、show-details never、应用名 `traceboard-collector` |
| `demo/.../backend/pom.xml` | parent Boot 2.7.18；`java.version=1.8`；仅 web 依赖；无 traceboard/DB 依赖 |
| `ShopApplication.java` | Boot 2 启动类；端口来自 yml 8080 |
| `Order.java` | 4 字段 + getter/setter；无敏感字段 |
| `InMemoryOrderStore.java` | 种子订单 1（SO-0001/CREATED/100.00）；`cancel` 幂等；无 DB/SQL |
| `OrderService.java` | 纯内存委托；无采集/日志 |
| `OrderController.java` | `GET /api/orders` 与 `POST /api/orders/{id}/cancel` 形状符合 `api.v1.md` 附录 A；`data:true`；无 CORS 注解 |
| `demo/.../backend/application.yml` | 8080；无 DB 配置 |
| 通用 | 未改他人路径；无 secret/真实数据；构建/启动证据齐；停止后端口无残留；无 git 操作 |

### 14.2 coder-frontend

| 文件 | 必须满足 |
|---|---|
| `workbench/package.json` + lock | Vue3/TS/Vite/Pinia；scripts 含 `dev/build/preview/sync:fixtures` 且 `predev`/`prebuild` 调 sync；无 Cytoscape；lock 已提交 |
| `workbench/vite.config.ts` | port 5173、strictPort；无 proxy（不连 collector） |
| `workbench/tsconfig.json` + `env.d.ts` | TS strict；`vue-tsc --noEmit` 无错 |
| `workbench/index.html` | 本地资源、无 CDN/在线字体；标题 TraceBoard |
| `workbench/src/App.vue` | 根元素 `class="app-shell"`；三区：顶部标题+版本+模式；左「前端图（占位）」；右「请求分图（占位）」+ Tab 占位；挂 FixturePanel；无图/时间轴 |
| `workbench/src/stores/app.ts` | 唯一空壳 store；只有静态 state；无 action/API/WebSocket |
| `workbench/src/fixtures.ts` | 读取副本 JSONL + expected-facts；类型明确；只读；无上报 |
| `workbench/src/components/FixturePanel.vue` | 显示事件数 9、每行 type/kind/status/nodeKey、DROP_COUNT=0、5 张 FactCard |
| `workbench/src/components/FactCard.vue` | 展示 id/summary/期望 path=value；无“通过/失败”裁判 |
| `workbench/scripts/sync-fixtures.mjs` | 复制两文件到 `public/fixtures/case-a-zero-rows/`；幂等；源缺失非零退出；基于脚本目录定位 |
| `workbench/.gitignore` | 含 `public/fixtures/`（另含 node_modules/dist） |
| `demo/.../frontend/package.json` + lock | Vue3/TS/Vite；dev 5174 strictPort；`build` 含 `vue-tsc --noEmit`；proxy `/api`→8080；lock 已提交 |
| `demo/.../frontend/src/App.vue` | 按钮 `#btn-cancel`；GET orders；POST cancel；`<pre>` 原始 JSON；2xx 静态「操作成功」；无 SDK/轮询 |
| `demo/.../frontend` 其他 | index.html/vite.config.ts/tsconfig/env.d.ts/main.ts/style.css 齐全；无 CDN |
| 通用 | 未改 Java/pom/server/agent/fixtures/schema/docs/tools；无 git；无 collector 调用 |

### 14.3 tester

| 文件 | 必须满足 |
|---|---|
| `tools/verify/package.json` + lock | 仅 `ajv@^8.17`；`type=module`；lock 已提交；node_modules 不提交 |
| `tools/verify/verify.mjs` | V1–V11 与 V4b 全部实现；Ajv 2020-12 + strict；失败非零退出；不修改产品文件；反例在临时目录；进程/端口清理；不依赖网络额外资源 |
| `docs/plans/stages/S0/test-report.md` | 环境版本、逐项 PASS/FAIL、失败复现命令、构建/冒烟输出摘要、agent major=52、哈希一致、进程已停止声明 |
| 通用 | 未改产品代码/契约；未放宽断言；无常驻服务；无 git |

## 15. 完成定义（S0 出口）

- 10 个 plan-writer 文件经 G1 PASS；两个 coder 与 tester 的全部清单勾选。
- `node verify.mjs` 退出码 0；四条构建命令可复跑；§10 证据齐全。
- acceptance 完成漂移/越界/安全检查，提交 `chore(S0): baseline` 并打 tag `s0-baseline`。
- 所有“未实现”能力在 README/进度包中如实标注「骨架 / 未采集 / S1 待做」，**禁止写成已支持**。

## 16. 变更记录（修订日志）

| 日期 | 轮次 | 触发 | 变更内容 | 触及文件 |
|---|---|---|---|---|
| 2026-11-23 | v1（Step 0 交付） | 分发书 §5.1 | 10 个 plan-writer 文件首次产出 | schema/fixtures/contracts/本文件 |
| 2026-11-23 | **G1 第 1 轮修订** | `plan-review.md`：B1（唯一阻断）+ N1–N8 | 见下 | 见下 |

**G1 第 1 轮（2026-11-23）明细**

- **B1 已修（方案 A，仅改文档，不动 schema/fixture 的 `parentSpanId`）**：父子区间不变量统一为
  “子 span 的 `[startNs, startNs+durNs]` 落在父 span 区间内。**唯一例外**：`kind=callback`（响应回调）
  允许在其 `fetch` 父 span 结束后启动，但其区间必须落在其所在根 span（`parentSpanId=null` 的祖先）区间内。”
  三处同口径：`docs/contracts/event-model.v1.md` §5 第 4 条、`fixtures/README.md` §3、`fixtures/case-a-zero-rows/README.md` §2
  （后者补明“callback 在 fetch 结束后 1ms 启动，属设计如此，仍落在根 span `[0ms, 52ms]` 内”）。
  同时 §7 新增 **V4b** 机器核对项（同步 span 严格包含；callback 只做根包含；例外仅限 `kind=callback`），
  §14.3 同步为“V1–V11 与 V4b”。
- **N1 已修**：新增 **D15** 授权 acceptance 在 G2 创建根 `.gitattributes`（至少
  `*.jsonl/*.json/*.md/*.java text eol=lf`，或 `* text=auto` 叠加显式行）；§3 文件树与约束、§11 风险表
  （新增“CRLF 回归”行）与 Step 4（含 `git check-attr` 复核）同步成文。plan-writer 未创建该文件。
- **N2 已就地修**：`docs/contracts/api.v1.md` 附录 A 增补 `POST /api/orders/{id}/cancel`（`id` ≠ 1）→
  `404 {"data":false}` 行，并把“失败分支不承诺”改写为“仅未知路径/方法/内部错误不承诺”，与 §13-D13 对齐。
- **N4 已就地修**：`fixtures/case-a-zero-rows/expected-facts.json` 的 F1 `summary` 去掉事件中不存在的表名，
  改为“SQL OrderMapper.cancelById 影响 0 行，事务 COMMITTED”（`eventCount` 仍为 9，断言未变）。
- **N5 已就地修**：§13-D6 理由更正（分发书并未给 `thread.name` 示例）。
- **N6 已就地修**：§13 标题下明确“共 16 条（D1–D16）”；Step 4 要求 acceptance 在 `acceptance.md` 复述 5174。
- **N7 已就地修**：新增 **D16** 记录 `workbench/scripts/sync-fixtures.mjs` 的路径消歧。
- **N8 已就地修**：Step 4 增补“记录 `master` ≠ `main`”；V1 注明由 tester 首次运行实证 Ajv `strict:true` 编译。
- **N3 延后**：`return.value` 是否 required 属 schema 收紧，写入 §13.1“延后到 S1 契约变更”，本轮不改 schema。
- 未触碰：`schema/traceboard.event.v1.json`、`fixtures/case-a-zero-rows/events.jsonl`、`dispatch.md`、
  `plan-review.md`，以及任何 coder/tester/acceptance 路径；无 git 操作。