# S8 计划（Tomcat 8.5 + SSM WAR + 本地三栈矩阵）

> 基线 `s7-baseline`｜日期 2026-11-24｜G1 前冻结源：本文件、dispatch、matrix。

## 1. 架构

```
launcher preview 8602 ── inject config.js+sdk.js ──> SSM page (Tomcat ROOT)
        │ /api/*                                  │
        └──────────────> Tomcat 8.5 :8081 ────────┘
                              │ agent (same FQCN targets)
                              ▼
             collector 8601  <── NDJSON 4 spans
```

- WAR：Spring MVC 5.3.39 + MyBatis 3.5.19/mybatis-spring 2.1.2 + H2 2.1.214，JDK8，Servlet 3.1，Jackson 2.13。
- 包名/签名与 S2 demo 完全一致，agent **零改动**即可插桩 controller/service/mapper/sql。
- H2 seed `SO-SSM-0001/CREATED/100.0`；mapper `cancelById` 只更新 `status='PAID'`，所以 0 行；service 忽略行数返回 true。
- 静态 `index.html` 案例 A/B；preview 注入 SDK 提供 click/fetch/EXACT 与案例 B 判定；页面直接访问时仅验证后端。
- Tomcat 启动使用默认 JUL manager，规避 agent 握手线程与 JULI 的启动死锁（实测）。

## 2. 文件

| 路径 | 作用 |
|---|---|
| `demo/buggy-shop-ssm-war/pom.xml` | WAR 构建（JDK8） |
| `src/main/java/com/example/shop/{controller,service,mapper,model,config}` | SSM 后端，同 FQCN |
| `src/main/resources/{schema.sql,data.sql,mapper/OrderMapper.xml}` | H2 + 0 行缺陷 |
| `src/main/webapp/index.html` | 案例 A/B，稳定选择器/文案 |
| `tools/verify/s8-tomcat.mjs` | S8-A..E 独立门禁 |
| `docs/plans/stages/S8/matrix.md` | 三栈本地矩阵/兼容与性能口径 |

## 3. 运行

```bash
# 构建
(cd "demo/buggy-shop-ssm-war" && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)

# collector 8601 + Tomcat 8081（独立 CATALINA_BASE，ROOT.war）
# C:/apache-tomcat-8.5.60/apache-tomcat-8.5.60
java -javaagent:agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar \
  -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events \
  -Dtraceboard.sessionId=s_s8tomcat -Djava.util.logging.manager=java.util.logging.LogManager \
  -Dcatalina.home=... -Dcatalina.base=work/s8-tomcat \
  -classpath "bootstrap.jar;tomcat-juli.jar" org.apache.catalina.startup.Bootstrap start

# preview 注入（案例 A/B browser 通过路径）
java -jar server/launcher/target/traceboard-launcher-...jar preview \
  --target http://127.0.0.1:8081 --port 8602 --collector http://127.0.0.1:8601 --session s_s8tomcat
```

## 4. 断言

| 组 | 断言 |
|---|---|
| S8-A 构建/静态 | WAR、JDK8 类、SSM 依赖、H2/0 行 SQL、页面选择器/无 fetch 校验、agent 同 FQCN |
| S8-B 部署 | Tomcat 8081 ROOT、collector 8601、agent hello connected、页面/`/api/orders` 200 |
| S8-C 后端 EXACT | 带 header 的 cancel → 4 span 全 EXACT、controller.parent=span、SQL rows=0、订单 CREATED |
| S8-D 前端基础 | preview 注入 200、`/api` 代理 200、SDK 服务 A/B（浏览器证据；门禁验证注入与 HTML 契约） |
| S8-E 矩阵/回归/清理 | matrix 三栈+云端不支持、S0–S7 75+35、无 S9+、端口/进程清理、冻结面零 diff |

## 5. 限制

- 仅 Tomcat 8.5.60/JDK8 本机；未测 9/10.1、未做云端 WAR。
- SSM 仅 cancel 案例 A/B；无 L1/L2/异步新采集；静态页无构建插件/sourcemap。
- preview 注入的 `js_method` appName 为 `traceboard-preview`，不是源码行列。
- agent 握手在 Tomcat 需要 JUL manager 开关；未改 agent 源码。
- 三栈矩阵是“本地、各自最小案例”证据，不是全版本 CI 矩阵。