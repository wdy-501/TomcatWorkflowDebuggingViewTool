# SUMMARY — S2 阶段总结（0 行事实链 MVP）

> 阶段：S2｜日期：2026-11-23｜作者：acceptance（G2）｜结论：**G2 PASS，tag `s2-baseline`**
> 说明：本文件是阶段总结（非权威验收记录）；权威证据见 `docs/plans/stages/S2/acceptance.md`、
> `test-report.md`、`plan-review.md`、`progress.md` 与 git tag `s2-baseline`。

## 1. 目标

按 `docs/plans/SOLO-PLAN.md` S2 行与主计划 §5.8，打通**首次失败点击可看到的真实 0 行事实链**：

- demo 改为 H2 + MyBatis，`POST /api/orders/1/cancel` 对 `CREATED` 行执行
  `UPDATE ... AND status='PAID'` 得 `rowsAffected=0`，Service 忽略返回值仍 `true`，Controller `200 {"data":true}`；
- agent 采集 Controller/Service/Mapper/SQL 四个真实 span（同一 traceId/rootEventId，LOST 游离根）；
- collector 只读派生 `requests`/`graph`；
- 工作台请求列表/切换 + 选中请求事实链，显示 SQL 0 行、Mapper 0、Service true、Controller 200、异常 0；
- 一次命令 42 项门禁覆盖 S0/S1 回归与 S2-A..S2-L。

## 2. 交付物

| # | 交付 | 位置 |
|---|---|---|
| 1 | S2 契约（requests/graph IMPLEMENTED、Appendix A）+ s2 fixture + 计划 | `docs/contracts/api.v1.md`、`fixtures/s2-zero-row-chain/**`、`docs/plans/stages/S2/s2-plan.md` |
| 2 | demo H2/MyBatis 0 行缺陷（删 InMemoryOrderStore） | `demo/buggy-shop-boot-vue/backend/**` |
| 3 | agent 4 点插桩 + 4-span 链 + fail-open | `agent/**` |
| 4 | collector requests/graph 只读派生 | `server/collector/**` |
| 5 | workbench S2 面板（会话/请求切换/事实链/事实条/5s 非实时） | `workbench/**` |
| 6 | 42 项门禁 + 测试报告（含 §11 修订复跑） | `tools/verify/**`、`docs/plans/stages/S2/test-report.md` |
| 7 | G1 评审、验收、进度、README、归档 | `plan-review.md`、`acceptance.md`、`progress.md`、`README.md`、本目录 |
| 8 | S2-AMD-01（demo 前端 App.vue 页头文案单文件例外） | `dispatch-amendment-01.md` |

## 3. 证据

- **门禁**：G2 独立复跑 `(cd "tools/verify" && npm ci && node verify.mjs)` → 42/42 PASS、`S2 TEST: PASS`、exit 0
  （2026-11-23 12:39:52–12:40:36）。同轮含 4 次构建、4-span E2E、requests/graph、fail-open、S0/S1 回归、范围/安全/漂移、清理。
- **运行时 0 行**：`GET /api/orders` seed `id=1 SO-0001 CREATED 100.0`（H2）；cancel `200 {"data":true}` 后列表仍 `CREATED`；
  未知 id `404 {"data":false}`；fat jar 内嵌 `h2-2.1.214.jar`、0 MySQL 驱动。
- **4-span**：`controller(LOST root,200) → service(true) → mapper(0) → sql(rows 0/UNKNOWN)`，全 `OK`、同 trace/root、
  `durNs>0`、`THREW=0`；第二次 cancel 独立 traceId。
- **requests/graph**：2 组按 `startedAtNs` 升序；graph 4 节点/3 边、两次 GET 一致且事件/`seq` 不变；400/404/405 全中且 0 回显。
- **冻结面**：S2 G1 9/9、S0/S1 fixture 7/7 哈希逐字一致；schema 字节不变且仅 1 份。
- **安全**：0 secret/真实数据/遥测/CDN/镜像；collector 仅 `127.0.0.1:8601`；H2 仅嵌入式。
- **浏览器**：`stages/S2/evidence/workbench-s2.png`（会话 s_s2agent、2 请求切换、事实条、4 节点/3 边、LOST 游离根）与
  `stages/S2/evidence/demo-s2.png`（案例 A 页头、CREATED 100、`{"data":true}`、操作成功）；G2 已目视。

## 4. 结果

- **G2: PASS**。首轮 FAIL（demo 前端 App.vue 页头文案在 tester 冻结后修改，41/42）经 **S2-AMD-01** 正式授权为
  **单文件文案例外**（精确文件白名单、目录仍冻结、5 条文案/模板断言），tester 复跑 42/42 后 G2 复核通过。
- 基线 commit 与 tag：见 `docs/plans/stages/S2/acceptance.md` §13 / `progress.md`「基线记录」/ 根 README；
  commit `feat(S2): zero-row fact chain — H2 defect, 4-span agent, requests/graph, request switching`，tag `s2-baseline`。
- 工作区在提交前仅含 S2 产品/测试/契约/fixture/文档 + 验收/进度/归档；未 push、未 force/rebase、未改 git config。

## 5. 风险与限制

1. `countById` 不插桩：未知 id 链 0 或 2 span（Controller 404 + Service `RETURNED_FALSE`），无 mapper/sql，不伪造。
2. `EventSender` 容量 16、单守护线程、1 次尝试：突发丢弃/非 202 仅 stderr 计数；运行时 flags 含 `DROP_COUNT=<n>`，
   不与 fixture 逐字比较。
3. 工作台 5 秒轮询（非实时）、无 SSE/WS/时间轴/回放；preview/静态 dist 无代理。
4. **无前端 SDK/关联**：4-span 是 `confidence=LOST` 的游离后端请求，不画点击链（S3）。
5. H2 内存库与 collector 内存存储均无持久化，重启回到 seed/清空。
6. 回环口径 IPv4 `127.0.0.1` vs 浏览器 `localhost`（可能 `[::1]`）；git 分支 `master`、无 remote。
7. demo 前端 source-only S0 文案（main.ts/style.css/package.json description）未改；App.vue 页头文案例外不得类推。
8. S2 G1 文档瑕疵 N1/N2/N5/N9/N10/N11 延后；S2 通过不宣称产品完成。

## 6. 下一步

**S3（前端 SDK / 关联 / 回放 / 时间轴）需要新的分发书授权。** S2 到此停止；本归档、`s2-baseline` 与 PASS 报告
均不构成 S3 开工许可，也不得据此宣称已支持前端关联、回放或实时能力。
