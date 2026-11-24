# S7 验收（G2 · React18 + Webpack5 本地基础第二栈）

> 日期：2026-11-24｜阶段：S7｜基线输入：`s6-baseline`｜验收 tag：`s7-baseline`
> 依据：`SOLO-PLAN.md` S7、`S7/dispatch.md`、`S7/s7-plan.md`、`S7/plan-review.md`（G1 PASS）、`S7/test-report.md`

## 1. 验收结论：PASS

S7 以 **React18 + Webpack5 前端第二栈**（Tomcat/WAR 未做）完成本地基础案例 A/B；S0–S6 无回归。

| 门 | 结果 | 证据 |
|---|---|---|
| 分发/计划/G1 | ✅ | `dispatch.md` 171 行；`s7-plan.md` 276 行；`plan-review.md` G1 PASS（0 blocker，R1–R8）；`api.v1.md` §2.8+附录 H |
| 编码 | ✅ | `demo/buggy-shop-boot-react/frontend/`：React18.3.1/Webpack5/Babel；`npm ci && npm run build` 绿；dist 无 `.map`/manifest；锁文件 npmjs+本地 SDK |
| S0–S6 回归 | ✅ 75/75 | `(cd "tools/verify" && node verify.mjs)` → `S6 TEST (full S0–S6): PASS` |
| S7 门禁 | ✅ 35/35 | `(cd "tools/verify" && node s7-react.mjs)` → `S7 TEST (React18/Webpack5): PASS` |
| 浏览器案例 A | ✅ | 7 span 全 EXACT、controller.parent=fetch、SQL 0 行、订单仍 CREATED、toast 操作成功 |
| 浏览器案例 B | ✅ | 3 span、`validateForm RETURNED_FALSE`、fetchCount=0、`已确认：本次点击因果链内没有网络请求` |
| 工作台 | ✅ | session `s_s7react`；S3/S5/S6 面板保留；见 `evidence/` 三张截图 |
| 范围/安全 | ✅ | 回环 only；无 secret/CDN/镜像/CORS/新增端点；后端/agent/collector/SDK/workbench 零改动；无 S8+ |
| 备份/tag | ✅ | `docs/plans/archive/stage-S7-2026-11-24/`；tag `s7-baseline` |

## 2. 交付物

```text
demo/buggy-shop-boot-react/frontend/
  package.json/package-lock.json  webpack.config.js  babel.config.js
  public/index.html  src/{index.jsx,OrderEdit.jsx,traceboard.js,styles.css}  README.md
docs/plans/stages/S7/
  dispatch.md  s7-plan.md  plan-review.md  progress.md  test-report.md  acceptance.md  evidence/*.png
tools/verify/s7-react.mjs（S7-A..E，独立 35 项）
docs/contracts/api.v1.md §2.8 + 附录 H
README.md / STAGE-PROGRESS.md 更新为 S7
docs/plans/archive/stage-S7-2026-11-24/{MANIFEST.md,SUMMARY.md,...}
```

## 3. 支持矩阵（如实）

| 项 | 状态 |
|---|---|
| React18 + Webpack5 + runtime SDK（本地） | **基础** |
| 可见：click/fetch/响应/UI 效果 + 后端方法/SQL | ✅ |
| JS 源码位置/组件映射/JS 局部变量/回调内部 | ❌ 未交付 |
| 构建插件/manifest/sourcemap | ❌ 未交付 |
| 静态 dist 无代理 | ⚠️ 仅 devServer 代理路径通过 |
| 云端 | ❌ 暂不支持 |
| Tomcat/WAR/SSM | ❌ 未做（S8 候选） |
| 主计划 P2「完整 React」 | ❌ 未交付；本阶段只做基础 |

## 4. 明确偏差

1. S7 门禁以独立 `s7-react.mjs` 实现，未把 75 项 `verify.mjs` 改成 80 项；冻结回归保持字节/计数不变，README 给出两条命令。
2. tester 子代理超时未产出，测试与复跑由主协调器接管；不冒充独立 agent 证据。
3. 浏览器测试使用运行中的真实 collector/后端/React/workbench；自动化 S7-C 用真实代理头验证后端 EXACT，SDK 点击/fetch 形状由浏览器证据覆盖（未引入 Playwright/浏览器下载）。
4. 初始 `GET /api/orders` 与 SDK manifest 404 探测在点击窗外，不参与案例 A/B 的因果链；已写入测试报告。

## 5. 限制与后续

- 无 React 生产构建发布；无 sourcemap/组件映射；无 JS 局部变量；无跨域/鉴权/持久化。
- 下一阶段 **S8：Tomcat WAR/SSM 或第三栈/矩阵**；本阶段不开始 S8，不宣称 React 完整或 Tomcat/云端已做。
- 恢复以 `STAGE-PROGRESS.md` + tag `s7-baseline` + 本目录为准。