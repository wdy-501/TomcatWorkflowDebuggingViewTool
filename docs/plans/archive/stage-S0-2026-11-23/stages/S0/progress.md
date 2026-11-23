# S0 进度包（progress）

> 模板：`docs/plans/SOLO-PLAN.md` §4（检查点停止与自检协议）｜日期：2026-11-23｜作者：acceptance（G2）

```text
CHECKPOINT: S0（基础与契约：构建骨架、schema v1 草案、demo 骨架、0 行 fixture）
STATUS: done

EVIDENCE:
- 独立校验：node tools/verify/verify.mjs → 26 PASS / 0 FAIL，末行 "S0 TEST: PASS"，退出码 0（以第 3 次“工作区静默”复跑为准；第 2 次因验收期间并行写 acceptance/progress 触发 V8d“运行期间新增文件”误报，三次运行详见 acceptance.md §2）
- 构建（verify V2a–V2d，G2 复跑）：根 reactor JDK21 package、demo 后端 JDK8 package、workbench npm ci+build、demo 前端 npm ci+build 全部 exit 0
- 契约：G1 PASS（plan-review.md）；7 个冻结文件 SHA256 与 G1 基线逐字节一致（schema/event-model/status-semantics/transport/api/fixture 2 件）
- fixture 可读：9 行 JSONL 全部过 Ajv 2020-12 strict；expected-facts 5 条深比较全等；V4b 区间 0 违规
- 冒烟：collector 8601 health=UP / meta schema id 正确 / ingest=501；demo 8080 orders=200（CREATED）/ cancel={"data":true} / 未知 id=404；停后端口无残留
- agent：major version 52，Premain-Class=io.traceboard.agent.TraceAgent（noop premain）
- 浏览器证据：evidence/workbench-s0.png（10:40）、evidence/demo-s0.png（10:41），orchestrator 浏览器会话 2026-11-23；G2 已查验：workbench 9 事件 + 5 条事实卡 + S1 占位；demo 原始 JSON + 操作成功
- 基线：commit "chore(S0): baseline — contracts, skeleton, fixture, tests" + tag s0-baseline（哈希见下方追加行）

CHANGED:
- 新增（本检查点全量）：根 pom.xml reactor（agent + server/collector）、agent noop 骨架、collector 骨架（health/meta/ingest 501）、demo buggy-shop-boot-vue（Boot 2.7.18/JDK8 + Vue3 前端）、workbench AppShell（Vue3+TS+Vite+Pinia）、schema v1、四份契约、case A fixture、tools/verify、S0 计划/评审/测试报告
- G2 本轮新增：.gitattributes（LF 策略，D15 授权）、README.md、acceptance.md、progress.md、archive/stage-S0-2026-11-23/**
- 契约字段/API：事件 v1（19+reason，8 状态，无网络 $ref）；API 仅 health/meta + ingest 占位 501；无契约漂移
- 未改任何产品代码/schema/fixture/契约/工具/测试

RISK:
- .gitattributes 之前缺失 + 系统 core.autocrlf=true：已补（text: set / eol: lf，\r=0），后续 checkout 不再把 *.jsonl 变 CRLF
- ingest 501 message 比 api.v1 §3.3 示例多一个后缀（F-1）：文案级，S1 契约变更时对齐；状态码/字段合规
- collector 仅绑定 127.0.0.1，Node/Vite 可能只绑 [::1]：文档统一用 localhost 访问
- 实际分支 master ≠ 计划 main：记录不改写历史；demo 前端固定 5174（D1）
- 本阶段无采集/关联/图/回放/时间轴能力；workbench 仅有占位与 fixture 摘要，勿对外宣称“已支持”
- 遗留 work/logs/*.log 已被 .gitignore 忽略，未入基线

NEXT: S1（walking skeleton）——需新的分发书授权；本进度包不构成 S1 开工许可
```

## 基线记录

- 基线 commit：见 `acceptance.md` §8 与下方追加行。
- tag：`s0-baseline`
- 归档：`docs/plans/archive/stage-S0-2026-11-23/`（MANIFEST.md + SUMMARY.md）
