# S0 验收报告（acceptance / G2 门）

> 验收人：acceptance（唯一 git 写入者）｜日期：2026-11-23｜阶段：S0
> 绑定简报：`docs/plans/stages/S0/dispatch.md` §1/§2.2/§5.6/§6/§7/§9/§10；`s0-plan.md` Step 4、D15、§11 风险表；`plan-review.md`（G1: PASS + 冻结基线）；`test-report.md`
> 边界：本文件作者只写 `README.md`、`.gitattributes`、本文件、`progress.md`、`docs/plans/archive/stage-S0-2026-11-23/**`；未改任何代码/schema/fixture/契约/工具/测试。

---

## 1. 结论

**G2: PASS**

S0 四条验收信号全部由 G2 亲自复跑证实（不采信报告）：仓库可构建、契约可评审、fixture 可读、demo 骨架可启动且与 collector 不通信。S0 基线已提交并打 tag，工作区干净。S0 到此为止；S1 需新的分发书授权。

| 项 | 值 |
|---|---|
| 独立校验 | `node tools/verify/verify.mjs` → `checks: 26 PASS / 0 FAIL (total 26)`、`S0 TEST: PASS`、退出码 0（第 3 次静默复跑；三次运行均记录于 §2） |
| 契约冻结 | 7 个基线 SHA256 与 `plan-review.md` 逐一相同 |
| 越界 | §2.2 清单零实现（命中项均为“不做/S1 预留”注释或契约布尔字段） |
| 安全 | 无 secret、无真实数据、无遥测、无外部 CDN/字体、无第三方镜像、schema 无网络 `$ref` |
| 基线提交 / tag | `chore(S0): baseline — contracts, skeleton, fixture, tests` / `s0-baseline`（哈希见 §8） |
| 归档 | `docs/plans/archive/stage-S0-2026-11-23/`（MANIFEST + SUMMARY） |

## 2. 独立复跑证据（不信报告）

环境实测（Git Bash，仓库根；路径含中文与空格，命令均双引号）：

| 项 | 实测 |
|---|---|
| Node / npm | `v22.22.2` / `10.9.7`（与 `dispatch.md` §8 一致） |
| Maven | `3.9.5`，默认 `JAVA_HOME` = `C:\Program Files\Java\jdk1.8.0_221` |
| JDK21 | `C:/Program Files/Java/jdk-21`（`java version "21" 2023-09-19 LTS`） |

`verify.mjs` 一次执行覆盖（26 项）。G2 共执行三次，全部如实记录：

| 轮次 | 情境 | 结果 |
|---|---|---|
| 第 1 次 | STEP 1 复跑（`.gitattributes` 尚未创建） | 26 PASS / 0 FAIL，`S0 TEST: PASS`，exit 0；V8c 提示“absent（acceptance 在 G2 补）” |
| 第 2 次 | 创建 `.gitattributes` 后按 test-report F-2 复跑 | **25 PASS / 1 FAIL**：仅 V8d 报“运行期间新增 2 个文件”（`acceptance.md`、`progress.md`）。根因：G2 在 verify 运行期间并行写入本报告与 progress，脚本按“运行前后文件集不变”判定；非产品缺陷、非断言放宽。该轮 V8c 已证实 `.gitattributes` present 且 `text: set`/`eol: lf` |
| 第 3 次 | 工作区静默（无任何并行写入）后复跑，作为门禁依据 | **26 PASS / 0 FAIL，`S0 TEST: PASS`，exit 0**；V8d：57 文件稳定、运行期间新增 0、git 索引未动 |

第 3 次（最终）尾部：

```text
PASS  [V8c] .gitattributes / CRLF risk recorded
        note repo .gitattributes state :: present
        note git check-attr events.jsonl :: fixtures/case-a-zero-rows/events.jsonl: text: set
fixtures/case-a-zero-rows/events.jsonl: eol: lf
PASS  [V8d] verifier wrote no product files; git index untouched
        ok  no product file modified during verify :: 57 files stable
        ok  no product files added during verify :: none
        ok  git index untouched (no add/modify/delete entries) :: 12 untracked paths, all "??"

--- SUMMARY ---
checks: 26 PASS / 0 FAIL (total 26)
S0 TEST: PASS
EXIT_CODE=0
```

第 3 次运行中各检查组证据：

| 组 | 证据 |
|---|---|
| V1/V1b/V1c | 9/9 行过 Ajv 2020-12 `strict:true`；5 条事实深比较全等；`status:"SUCCESS"`、缺 `reason`、多顶层键三反例均被拒 |
| V4b | 9 span 区间 0 违规（strict=7 + callback=1 仅根包含 + root=1） |
| V2a–V2d | 根 reactor（JDK21）、demo 后端（JDK8）、workbench、demo 前端四条构建命令 exit 0 |
| V3 | agent `major version: 52` + MANIFEST `Premain-Class: io.traceboard.agent.TraceAgent` |
| V5a | collector 8601：health `UP`、meta `schema.id=urn:traceboard:schema:event:v1`、`capabilities` 三项 false、ingest **501** |
| V5b | demo 8080：orders 200（1 条 `CREATED`）、`POST /api/orders/1/cancel` → `{"data":true}`、未知 id → 404 `{"data":false}` |
| V5c | 冒烟后 8601/8080 无 LISTENING |
| V6a–V6e | workbench/demo dist 标记与 fixture 副本 SHA256 一致；构建产物无外部资源请求 |
| V7 | 7 个冻结文件与基线逐字节一致（见 §5） |
| V8a–V8d | 0 secret、0 遥测、0 CDN；`.gitattributes` present 且 `text: set`/`eol: lf`；verify 未写产品文件（57 文件稳定、0 新增）、git 索引未动 |

## 3. 检查清单（dispatch §5.6 六项）

| # | 要求 | 结果 | 证据 |
|---|---|---|---|
| 1 | 亲自重跑 `verify` 与 §3 四条构建；不信报告 | PASS | §2；四条构建由 V2a–V2d 在同一次运行中执行；G2 另用 `sha256sum` 手工复核冻结哈希 |
| 2 | 漂移检查：coder 未改 `schema/**`、`docs/contracts/**`、`fixtures/**` | PASS | V7 逐项哈希 = `plan-review.md` 冻结基线；V8d 证明 verify 运行前后 57 个产品文件 SHA256 全等、无新增；仓库此前 0 commit，基线提交后漂移可用 `git diff` 追溯 |
| 3 | 越界检查：§2.2 清单零出现 | PASS | §4.2 逐词 grep：全部命中均为“无/不做/S1”注释、AppShell 占位标题或契约能力布尔 |
| 4 | 安全：无 secret/真实数据/遥测/外部 CDN；无第三方镜像 | PASS | V8a/V8b + G2 独立 grep（§4.3）；无 `.npmrc`/`settings.xml`；`pom.xml` 无 mirror |
| 5 | `progress.md` 按 SOLO-PLAN §4 模板 | PASS | `docs/plans/stages/S0/progress.md`（CHECKPOINT/STATUS/EVIDENCE/CHANGED/RISK/NEXT） |
| 6 | 按文件名 `git add` + commit + tag；分支 `master` ≠ 计划 `main` 记录 | PASS | §8；未用 `-A`；未 push/force/rebase；分支差异记录于 §6 |

## 4. 漂移 / 范围 / 安全逐项结果

### 4.1 契约漂移：无

`schema/traceboard.event.v1.json`、`fixtures/case-a-zero-rows/{events.jsonl,expected-facts.json}`、`docs/contracts/{event-model.v1.md,status-semantics.md,transport.v1.md,api.v1.md}` 7 个文件与 G1 冻结基线**逐字节一致**（§5 表）。`fixtures/README.md`、`case-a-zero-rows/README.md` 为基线未收录但同属只读产物，哈希与 test-report §6.3 一致。

### 4.2 越界检查（S1 词表 grep，产品代码）

范围：`pom.xml`、`agent/`、`server/collector/`、`demo/`（backend src、frontend src/config）、`workbench/`（src、scripts、package.json、vite.config）、`tools/verify/`（排除 node_modules/target/dist/public/fixtures/lock）。
词表：ByteBuddy / Byte Buddy / ASM / Transformer / JDBC / probe / correlation / graph / timeline / replay / SSE / WebSocket / launcher / cloud / MySQL / EventSource / cytoscape。

| 命中 | 分类 | 判定 |
|---|---|---|
| `agent/pom.xml:25` “zero dependencies: no ASM, no Byte Buddy” | 注释（否定期望） | 非越界 |
| `TraceAgent.java:9-10` “must not register a ClassFileTransformer… Real instrumentation is S1” | 注释（S1 预留） | 非越界；实际仅打一行 `premain` 日志 |
| `CollectorApplication.java:10` “No persistence, no correlation, no launcher/cloud, no MySQL” | 注释 | 非越界 |
| `MetaController.java:36` `boolean replay` | 契约字段 `capabilities.replay=false`（api.v1） | 非越界 |
| `workbench/src/main.ts:6`、`stores/app.ts:5` “no WebSocket, no graph/timeline state” | 注释 | 非越界 |
| `workbench/src/App.vue` “前端图（占位）”“请求分图（占位）” | AppShell 三区占位（dispatch §5.4） | 非越界，明确标“S1 待做” |
| `tools/verify/verify.mjs` `capabilities.replay===false` 断言、CDN 黑名单 | 测试断言 | 非越界 |
| `demo frontend App.vue` 仅 `fetch("/api/...")`（Vite proxy → 8080） | 仅调用自有 demo 后端 | 非越界；无 collector/SDK |
| `8601` 仅出现于 `server/collector/src/main/resources/application.yml` | 配置 | 非越界；前端/agent/demo 零引用 |

补充：`workbench/package.json` 依赖仅 `vue`、`pinia`（未引入 Cytoscape，D9）；`workbench/src` 无 `cytoscape` import；无 `EventSource`/`WebSocket` 使用；无 ingest/关联/图/时间轴/回放实现。

### 4.3 安全与卫生

| 项 | 结果 |
|---|---|
| secret（password/secret/token/bearer/cookie/私钥） | 产品源码 0 命中；唯一命中在 `verify.mjs` 的扫描器正则定义（非凭据） |
| 遥测 / CDN / 在线字体 | 0 命中；构建产物仅 4 个惰性 URL（`www.w3.org` 3 个命名空间 + `vuejs.org` 错误文案） |
| 第三方镜像 | 无 `.npmrc`/`settings.xml`，pom 无 mirror 配置；仅 Maven Central |
| 网络 `$ref` | schema `$ref` 计数 0；仅标准 `$schema` URI `https://json-schema.org/draft/2020-12/schema` |
| 真实数据 | fixture 全部虚构（`s_demo_s0_case_a`、`SO-0001`、金额 100、相对源码路径） |
| 外链/绝对路径 | 产品代码无 `C:\`/`D:\` 绝对路径；URL 仅 XML 命名空间、`json-schema.org`、`127.0.0.1`/`localhost` |

## 5. 冻结哈希（G2 独立 `sha256sum`，与 G1 基线逐字相同）

```text
927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a  schema/traceboard.event.v1.json
2eb0b3d96c016d29ac9c5b35bfad12d37e178c19ff0160379613309480782ec9  fixtures/case-a-zero-rows/events.jsonl
8c5bbdbd3522a2e3626c84563f8dfe4a9cd10daed4827d2d61877a63f18b20ea  fixtures/case-a-zero-rows/expected-facts.json
0820d57f3c2f51b193a0f809cb17b0c9805ff1c06ef3fa6f8e8496b582d9614a  docs/contracts/event-model.v1.md
9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56  docs/contracts/status-semantics.md
2ca028e6225129fc913a922c20be17e161395f8584c17ab7d9a702afef2071e0  docs/contracts/transport.v1.md
88bd185fa1682599282543ff5ca42f85d29752b988e794279ca28a9622baf95c  docs/contracts/api.v1.md
```

附加只读产物（基线未收录，仅报告）：`fixtures/README.md` = `e92ded55…abd6e`、`fixtures/case-a-zero-rows/README.md` = `46a69503…dab9d`（与 test-report §6.3 一致）。

## 6. 偏离与登记事项（D1–D16 及 G2 补充记录）

D1–D16 与 `s0-plan.md` §13 同集，G2 判定均不削弱 S0 验收：

| ID | 事项 | G2 处置 |
|---|---|---|
| D1 | demo 前端固定 **5174**（`strictPort`），workbench 5173 | 接受；README/契约/计划三处一致 |
| D2 | 状态投影：`status` 枚举 8 值，`REDACTED` 落值级、`LOST` 落 `confidence` | 接受；schema 严格 8 值 |
| D3 | `parentSpanId` 统一小写 hex | 接受 |
| D4 | schema 增补可选 `reason`（`NOT_COLLECTED*` 必填，if/then） | 接受；有反例覆盖 |
| D5 | `rootEventId` 收紧为 `^click_[A-Za-z0-9_-]{8,}$` | 接受 |
| D6 | 线程命名：浏览器侧 `browser-main`、后端 `http-nio-8080-exec-1` | 接受（理由更正，不涉契约） |
| D7 | 仓库已存在 `.git`，S0 不重复 `git init` | 接受；G2 只核对 `.gitignore` 覆盖与基线提交 |
| D8 | agent 仅 `TraceAgent.java`，其余包 S1 再建 | 接受；无空目录 |
| D9 | workbench 未引入 Cytoscape（仅允许“声明”） | 接受；依赖仅 vue/pinia，S1 再加 |
| D10 | case A 定义为 9 行（`validateForm` 独立 span） | 接受；`eventCount=9` |
| D11 | `expected-facts.json` 断言语义（path 点号 + 数组下标深比较） | 接受；V1b 实现一致 |
| D12 | HTTP 200 落点 `fetch.return={type:"http",value:200}`；UI 落 `callback.return={type:"ui_effect",value:"操作成功"}` | 接受 |
| D13 | 未知 id → `404 {"data":false}` | 接受；V5b 覆盖 |
| D14 | `workbench/.gitignore` 忽略 `public/fixtures/` | 接受；副本未入 git |
| D15 | **`.gitattributes` 为 G1 轮次新增授权**（D15 + Step 4）；`dispatch.md` §5.6 输出清单与 §6 归属矩阵未列该文件 | 接受；G2 已创建（`* text=auto` + `*.jsonl/*.json/*.md/*.java/*.ts/*.vue text eol=lf`），授权转述于此（N11 闭环） |
| D16 | 同步脚本解析为 `workbench/scripts/sync-fixtures.mjs`，不建根 `scripts/` | 接受；根无 `scripts/` |

G2 补充登记（不改变 S0 范围）：

| 项 | 记录 |
|---|---|
| seed 状态 | demo 内存种子订单为 `status=CREATED`（`{"id":1,"orderNo":"SO-0001","status":"CREATED","amount":100}`），与冻结 `api.v1.md` 附录 A 一致；取消后页面显示 `CANCELLED`；属 demo 运行时状态，与 case A fixture 无关 |
| F-1（test-report）ingest 501 文案 | 实际 `message` 为 `"ingest is reserved for S1; S0 collector skeleton stores nothing (S0 placeholder, not implemented)"`，比 `api.v1.md` §3.3 示例多出后缀；状态码/字段结构合规，**不判 FAIL**，S1 契约变更时二选一对齐；G2 未代改契约/代码 |
| 回环地址 / IPv6 | collector 绑定 `127.0.0.1`（IPv4 单栈）；Node/Vite 可能只绑定 IPv6 回环 `[::1]`。统一以 `localhost` 访问（Node/curl 可回退 IPv4）；README 已写明“不要用 127.0.0.1”；属运行说明，无代码/契约变更 |
| 分支 | 实际 `master`（0 commit 起），计划写 `main`（dispatch §5.6⑥）；**不改写历史、不重命名**，此处记录 |
| 浏览器证据 | `evidence/workbench-s0.png`（2026-11-23 10:40）、`demo-s0.png`（10:41）由 orchestrator 浏览器会话采集；G2 已逐图查验：workbench 展示 9 事件、5 条事实卡（F1 `rowsAffected=0`、F2 `0`、F3 `true`、F4 `200`、F5 `操作成功`）与“S1 待做”占位；demo 展示订单 `SO-0001 / CANCELLED / 100`、原始响应 `{"data":true}` 与“操作成功”提示；与冻结 fixture/冒烟响应一致。G2 未重新截图（HMR/浏览器非必需门禁） |
| CRLF 保护 | 根 `.gitattributes` 已建并生效：`git check-attr text eol -- fixtures/case-a-zero-rows/events.jsonl` → `text: set` / `eol: lf`；工作区 `\r` 计数 0；创建后已复跑 `verify.mjs` 全绿 |
| 遗留日志 | `work/logs/*.log`（开发期手起记录，含一次 jar 名笔误的失败尝试）由 `.gitignore` 的 `work/` 忽略，未入 commit |
| 环境差异 | 本机 `node -v` = `v22.22.2`（IDE 自述 v24 不影响）；Git Bash PATH 无 `java`，冒烟用绝对路径（test-report F-4/F-5） |

## 7. 清理证明

```text
$ netstat -ano | grep -E ":(8080|8601|5173|5174)\s" | grep -i listening
（无输出 → 四个端口均无监听）
$ tasklist | grep -i java
（无 java 进程）
$ tasklist | grep -i node
node.exe 35884 / 46892 / 36384（创建于 10:00:43–46，早于本阶段开工；36384 仅监听 127.0.0.1:3080 并连 IDE 服务）
node.exe 32832（父 36384）/ 50100（父 32832）——均为 IDE node 的子进程，无项目端口监听
```

结论：无残留 collector/demo/Vite 进程，无 java 进程；4 个项目端口空闲。demo 后端与 collector 从未互相通信（两者独立起停，前端仅访问自身 `/api`）。

## 8. 基线提交与 tag

| 项 | 值 |
|---|---|
| 基线 commit | `chore(S0): baseline — contracts, skeleton, fixture, tests`（哈希见下方追加行） |
| tag | `s0-baseline`（annotated 关闭，lightweight） |
| 后续 commit | `docs(S0): record baseline commit`（仅 `acceptance.md`、`progress.md`，不改历史、不 amend） |
| push | 未执行（无 remote，禁止 push/force/rebase） |
| git 身份 | 仅本次提交用 `-c user.name="TraceBoard" -c user.email="traceboard@localhost"`，未改任何 git config |

暂存清单：`.gitignore .gitattributes README.md pom.xml agent server demo workbench tools schema fixtures docs`（按路径名显式 add）；`git diff --cached --name-only | grep -E 'node_modules|/target/|/dist/|public/fixtures|work/logs'` 为空。

## 9. S0 出口

- S0 交付到此为止：**S0 stops here; S1 requires new dispatch**。本报告不对 S1+ 能力作任何承诺。
- 未验证/未实现的能力一律标注“骨架 / 未采集 / S1 待做”（README、workbench 界面同口径）。
- 下一检查点只能由新的分发书（S1）启动；本文件与 tag 不构成 S1 授权。
