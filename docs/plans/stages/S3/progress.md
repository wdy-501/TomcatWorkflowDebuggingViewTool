# S3 进度包（progress）

> 模板：`docs/plans/SOLO-PLAN.md` §4（检查点停止与自检协议）｜日期：2026-11-23｜作者：acceptance（G2）
> 依据：`docs/plans/stages/S3/dispatch.md`、`s3-plan.md`、`plan-review.md`（G1 PASS）、`test-report.md`（51/51）、
> `acceptance.md`（G2 PASS）、契约 `api.v1.md` §2.3/§9、`event-model.v1.md` §12。

```text
CHECKPOINT: S3（前端事实 + 只读回放 MVP：runtime SDK 点击/控件/请求/DOM + 案例 A traceparent 关联 + 案例 B 确认没发 + 状态语义 + 只读回放）
STATUS: done

EVIDENCE:
- 独立校验（G2 亲自复跑，不信报告）：(cd "tools/verify" && npm ci && node verify.mjs)
  → "checks: 51 PASS / 0 FAIL (total 51)"、"S3 TEST: PASS"、NODE_EXIT=0（2026-11-23 本轮）
  （同轮含 SDK npm ci/build/test 8/8、demo 前端构建、workbench 构建、根 JDK21、demo JDK8、agent major 52、
    头关联 E2E、requests/graph/replay 深比较、回放 0 写、S0–S2 回归含显式迁移、漂移/范围/安全/清理）
- 首轮复跑失败（环境性，已解除）：上一轮浏览器证据采集遗留的 npm run dev（5173/5174）+ 2 个 esbuild.exe 占用
  node_modules 内 esbuild.exe → npm ci EPERM unlink → V2c/V2d/S3-1/S1-B/S2-1 连带失败；
  终止残留 dev server 与自身首轮进程、确认 6 端口空闲且无 java 后，同一命令原样重跑 51/51；产品代码两次运行之间零改动
- 冻结面：S3 G1 12/12 + S0–S2 10/10，共 22 项 SHA256 逐字一致（schema、api/transport/event-model/status-semantics、
  S3 fixture 四件+s3-plan+dispatch、S0/S1/S2 fixture 十件）；schema 字节不变且仓库仅 1 份
- 案例 A（运行时 E2E，非 fixture）：注入 click+fetch 前缀(202 accepted=2) → 带
  traceparent 00-1f2e…6071-2000000000000002-01 + X-TraceBoard-Click click_a1b2c3d4e5f60718 的 POST cancel → 200 {"data":true}；
  同 trace 6 span（click+fetch+4 backend），controller.parentSpanId=2000000000000002=fetch.spanId，
  rootEventId=真实 clickId，4 后端 span 全 EXACT、controller flag S3_EXACT_LINK、LOST_BACKEND=0；
  0 行不变（200/true/0/rowsAffected 0/UNKNOWN）、THREW=0；requests EXACT/fetchCount≥1/hasBackend/backendSpanCount=4/sdkActive=true；
  graph click>fetch>controller>service>mapper>sql
- 无头/非法头回退：3 次均独立 4-span LOST 根（无头=click_lost_、click 非法、全 0 traceparent），
  stderr header_unreadable=1/2 reason=missing/invalid（不打印头值）；s_s3demo 结束 18 条 schema 合法事件，requests 1 EXACT + 3 LOST
- 案例 B（纯前端零请求）：fixture 3 行 click(SDK_ACTIVE/OBSERVE_MS=1500/EXACT) → validateForm RETURNED_FALSE → render 金额必须大于 0；
  collector requests B 与 expected 整行 deep-equal：status=RETURNED_FALSE、confidence=EXACT、fetchCount=0、hasBackend=false、
  backendSpanCount=0、spanCount=3；graph 3 节点/2 边；工作台三文案齐全，判定含 sdkActive+根 ui_event+EXACT+fetchCount=0+hasBackend=false+OBSERVE_MS；
  截图 workbench-s3-case-b.png 逐字显示“已确认：本次点击因果链内没有网络请求（SDK 在线；观察窗 1500ms 已关闭；fetch/XHR=0；后端 span=0）”
- 案例 A 截图：workbench-s3-case-a.png 显示 6 节点 EXACT 链（click→fetch→controller→service→mapper→sql(0)→render 操作成功），
  额外 GET /api/orders 标“后端未采集（未关联 controller）”，未并入/未降级
- 回放：WA1–WA5(1/6/7/5/1)+WB1–WB4(1/2/3/1) 全部 200/readOnly/mode=replay/fromNs-toNs 回显/startNs+spanId 排序/seq 原值/逐字 event；
  两次默认 GET byte-identical；回放前后 18 事件、nextSeq=18、事件页 identical、0 新事件、0 THREW；demo 订单 CREATED 前后一致（辅助证据）；
  400（abc/-1/溢出/from>to/空白，message≤200 且 0 回显）、404 未知会话、400 先于 404、POST/PUT 405、meta 5 键 replay=true/realtime=false、
  stream/ws/links 404
- 回放截图：workbench-s3-replay.png 显示 REPLAY t=10.00ms 隐藏 6 个未来事件、GET /replay readOnly=true、节点“进行中（未结束）”、只读横幅
- 范围/安全：无 S4（launcher/IDEA/JAR/详情/×N）、无 S5（构建插件/sourcemap/行号/局部变量/L2）、无 SSE/WS/像素回放/持久化/外部 DB；
  workbench 依赖仅 vue+pinia（无图库）；npm 仅 registry.npmjs.org、4 lockfile 无镜像、无 .npmrc、pom 无自定义 repository；
  collector application.yml 实测 127.0.0.1:8601；SDK 无 cookie/表单值/body/URLSearchParams；错误信封 0 回显；agent 不打印头值
- 清理：8080/8601/5173/5174/4173/4174 无 LISTENING；无 java/esbuild 残留；git index 未动；S3-10 断言 137 个产品文件稳定
- 浏览器证据：evidence/workbench-s3-{case-a,case-b,replay}.png 共 3 张（G2 逐张查看，内容见上）
- 基线：commit "feat(S3): frontend facts and read-only replay — SDK, case B, traceparent join, timeline" + tag s3-baseline
  （完整哈希见下方“基线记录”）
- 归档：docs/plans/archive/stage-S3-2026-11-23/（MANIFEST.md + SUMMARY.md；复制不移动）

CHANGED:
- 产品（S3 六卡）：frontend/sdk 独立 TS 包（点击/fetch/XHR/wrapFn/uiEffect、原生 fetch NDJSON 上报、fail-open、8 单测）；
  demo 前端 SDK 接入 + 案例 B（#amount-b/#btn-save-b/validateForm/错误与成功文案，dev+preview /ingest 代理）；
  agent controller advice 反射读 traceparent/X-TraceBoard-Click（无编译期 Spring 依赖，EXACT 继承 / 无头 LOST 保留）；
  collector requests 追加 sdkActive/fetchCount/hasFrontend/hasBackend/backendSpanCount + 派生 confidence + GET replay（只读窗口）；
  workbench S3 板（混合树/状态图例/案例 B 三文案/时间轴回放/只读横幅，S0–S2 折叠）；tools/verify S3 门禁 51 项 + S2 迁移；
  S3 契约章节（api §2.3/§9、transport、event-model §12）、fixtures/s3-frontend-facts/**、s3-plan/G1 评审/test-report；
  README 重写为 S3 口径；本进度包与 acceptance、归档
- 契约/API：POST /ingest/v1/events、GET sessions/events、requests、graph 形状不变（requests 仅追加字段）；
  新增 GET /api/v1/sessions/{id}/replay?fromNs&toNs（IMPLEMENTED，只读）；meta capabilities 5 键仅 replay=false→true；
  stream/ws/links 仍 RESERVED(404)；schema v1 字段/枚举/约束未变（字节相同）
- G2 本轮只写：README.md、docs/plans/stages/S3/{acceptance.md,progress.md}、docs/plans/archive/stage-S3-2026-11-23/**、git；
  未改代码/schema/fixture/契约/工具/测试

RISK:
- 未实现（S4/S5 边界）：构建插件/sourcemap/源码片段/行号/局部变量/values[]/字段 diff；launcher/IDEA/JAR 接入/预览注入/CDP/扩展；
  详情抽屉/×N/手工 /links/INFERRED 时间窗；SSE/WS/实时；collector 持久化/淘汰/缓存/CORS/鉴权/429；像素回放；Tomcat/React/cloud/MySQL
- 观察窗仅运行时在线：OBSERVE_MS=1500（pagehide 提前关闭记录实际毫秒），窗口外后台请求不采集；
  “已确认没发”只覆盖本次点击因果链，不宣称全局无请求
- 运行时案例 A 多一条刷新 GET /api/orders：树上标“后端未采集（未关联 controller）”，fetchCount/spanCount 可能大于 fixture 最小链，
  POST↔controller 关联与整链 EXACT 不受影响（契约已写明）
- agent 时钟锚点微偏差（startNs 锚在上下文进入、durNs 从 advice 进入计时）：冷启动首次可能 µs 级“sql 结束晚于 mapper 结束”，
  契约 ≤1s 同机容差；建议 S4 前对齐锚点
- 运行时 flags 含 S3_EXACT_LINK（advisory）与 S1 遗留 DROP_COUNT=<n>，不与 fixture flags 逐字比较；fixture 仍精确断言
- 同进程 S2 面板（默认 s_s2agent）可能无数据 → 404/无数据提示（已处理，不崩）；回放前后比对必须在同一 demo 进程内
- H2 内存库 + collector 内存 append-only：无持久化，重启回 seed/清空；工作台 5s 轮询非实时；preview/静态 dist 无代理
- 回环口径：collector/agent 仅 IPv4 127.0.0.1，浏览器入口 localhost（Vite 可能绑 [::1]）；git 分支 master、无 remote
- 环境纪律：证据采集后未停 dev server 会占用 node_modules 内 esbuild.exe，导致下次 npm ci EPERM（本轮已发生一次并解除）；
  README 已加提示
- pre-existing 文档瑕疵（EOF 无换行/历史指针过期等）为 G1 前既有，为保护冻结面未修改
- S3 通过不宣称产品完成；S4 需新的分发书

NEXT: S4（本地启动器 / IDEA / JAR 接入 / 节点详情 / ×N 等）— 需 dispatcher 新分发书；本进度包与 s3-baseline 不构成 S4 开工许可
```

## 基线记录

- 基线 commit：`（提交后由 G2 追加）`（`feat(S3): frontend facts and read-only replay — SDK, case B, traceparent join, timeline`；tag `s3-baseline` 指向同一 commit）
- tag：`s3-baseline`（指向同一 commit）
- 后续 commit：`docs(S3): record baseline commit`（仅 `acceptance.md`、`progress.md`）
- 归档：`docs/plans/archive/stage-S3-2026-11-23/`（提交前快照；SHA256 与恢复方法见其 `MANIFEST.md`）
