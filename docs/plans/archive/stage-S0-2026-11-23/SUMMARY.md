# SUMMARY — S0 阶段总结（2026-11-23）

## 目标（SOLO-PLAN S0 / dispatch §1）

`git init` 之后的目录与构建骨架、schema v1 草案、demo 应用骨架、0 行 fixture；不写复杂功能。
验收信号：**仓库可构建；schema/传输/API 草案可评审；fixture 可读**（并证明 demo 与 collector 不通信）。

## 交付物

| # | 交付 | 位置 |
|---|---|---|
| 1 | 根 Maven reactor（JDK21）+ agent noop premain + collector 骨架 | `pom.xml`、`agent/`、`server/collector/` |
| 2 | 事件模型 v1 JSON Schema（2020-12）+ 四份契约草案 | `schema/traceboard.event.v1.json`、`docs/contracts/` |
| 3 | case A（0 行）fixture：9 行 JSONL + 5 条期望事实 | `fixtures/case-a-zero-rows/` |
| 4 | demo `buggy-shop-boot-vue` 骨架（Boot 2.7.18/JDK8 + Vue3，无缺陷、无采集） | `demo/buggy-shop-boot-vue/` |
| 5 | workbench AppShell（Vue3+TS+Vite+Pinia，三区占位 + fixture 事实摘要） | `workbench/` |
| 6 | 独立校验工具（26 项）与测试报告 | `tools/verify/`、`docs/plans/stages/S0/test-report.md` |
| 7 | 计划/评审/验收/进度/归档与基线提交 | `docs/plans/**`、`.gitattributes`、`README.md`、tag `s0-baseline` |

## 证据

- `node tools/verify/verify.mjs` → 26 PASS / 0 FAIL、`S0 TEST: PASS`、exit 0（工作区静默第 3 次复跑；前两次经过见 acceptance.md §2，含一次 G2 并行写文件造成的 V8d 误报）。
- 四条构建命令（根 reactor JDK21、demo 后端 JDK8、workbench、demo 前端）exit 0；agent `major version: 52`。
- 冒烟：collector 8601 health=UP / meta id 正确 / ingest=501；demo 8080 orders=200（1 条 CREATED）/ cancel=`{"data":true}` / 未知 id=404；停后端口释放。
- 契约冻结：7 个 SHA256 与 G1 基线逐字节一致。
- 浏览器证据：`stages/S0/evidence/workbench-s0.png`（9 事件、5 条事实卡、S1 占位）、`stages/S0/evidence/demo-s0.png`（原始 JSON + “操作成功”），2026-11-23 10:40/10:41 由 orchestrator 采集，G2 已查验。
- 模块归属零交集（coder-backend / coder-frontend / tester / acceptance 各写各的路径）。

## 测试结果

| 组 | 结果 |
|---|---|
| 26 项校验（V0–V8，含 V4b） | PASS（0 FAIL） |
| schema/反例 | 9/9 合法；3 反例被拒、1 正例通过 |
| 构建/冒烟 | 全绿；端口无残留 |
| 安全/卫生 | 0 secret、0 遥测、0 CDN、无第三方镜像、schema 无网络 `$ref` |

## 风险与未支持（如实）

- **S0 无任何采集能力**：agent 仅 noop premain；ingest 固定 501；无关联/图/时间轴/回放/请求切换。
- workbench 只有占位与 fixture 摘要；demo 无缺陷、无 SDK，不能据此演示 0 行缺陷。
- ingest 501 的 `message` 比 `api.v1.md` §3.3 示例多一个后缀（F-1），S1 契约变更时对齐。
- collector 仅绑 `127.0.0.1`，Node/Vite 可能只绑 `[::1]`：统一用 `localhost` 访问。
- 实际分支 `master` ≠ 计划 `main`（未改写历史）；demo 前端固定 5174（D1）。
- 系统 `core.autocrlf=true` 的 CRLF 风险已由根 `.gitattributes`（`text: set`/`eol: lf`）覆盖。
- `work/logs/*.log` 为开发期手起记录，被 `.gitignore` 忽略，未入库。

## 下一步

**S1（walking skeleton）需新的分发书**：agent 最小插桩一条事件 → collector ingest/关联 mock → 工作台 fixture 板/点击事件。
本总结与 `s0-baseline` tag 不构成 S1 开工授权；S0 到此为止。
