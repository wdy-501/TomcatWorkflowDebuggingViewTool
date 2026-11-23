# S2 分发改订 01 · demo 前端页头文案授权（dispatch amendment）

> 阶段：S2｜编号：**S2-AMD-01**｜日期：2026-11-23｜发布者：**task-dispatch（dispatcher）**｜状态：生效
> 依据：`docs/plans/stages/S2/acceptance.md` §1/§3/§11（G2 FAIL 唯一阻断 B1）；`dispatch.md` §2.2/§4.1/§6。
> 形式：以新增文件生效，`dispatch.md` 本体**不改**（G1 哈希 `bf602001…c51adc` 保持 9/9）；未在本文件授权的冻结条款一律不变。

## 1. 效力与取代范围

- 仅取代两处：①§4.1 末条“demo 前端 S0 页头‘无缺陷’文案为历史口径，S3 接 SDK 时统一修正，S2 登记为文案瑕疵”；②§6 路径矩阵“demo 前端…冻结，一律只读”中**仅针对单一文件**的只读约束。
- 明确保留：§2.2“demo 前端**行为**不改（200 即显示‘操作成功’，无 SDK）”——本例外**不涉及行为**；§2.2 其余 S3 边界、§3 决策、契约/schema/fixture/s2-plan 冻结全部不变。

## 2. 授权变更（唯一文件，已完成）

- 文件：`demo/buggy-shop-boot-vue/frontend/src/App.vue`（**仅此一个**；`git diff` 5+/2-，全部在 `<template>` 页头）。
- 现文案：`<h1>BuggyShop · 取消订单（案例 A）</h1>`；副标题改为“S2 demo · 案例 A 故意缺陷：取消返回成功，但数据库 UPDATE 0 行；订单仍为 CREATED。后端由 Java agent 采集；前端无 SDK。接口经 Vite proxy `/api` 转发到 8080”。
- 不变：`<script setup>` 全量逻辑、`fetch("/api/orders")`、`fetch("/api/orders/1/cancel",{method:"POST"})`、`showSuccess`/`rawJson`/`loadOrders` 刷新、样式类；无按钮/toast/确认框增删；无 SDK/traceparent/clickId/前端事件；`index.html`、`src/main.ts`、`src/style.css`、`package.json`、`vite.config.ts`、`tsconfig.json`、`env.d.ts` 均未改。

## 3. 理由

- 旧页头“S0 demo 骨架：无采集、无缺陷、无 SDK”对 S2 运行时**事实为假**（存在案例 A 故意缺陷、后端 4-span 采集，见 test-report / acceptance §8）。
- `dispatch.md` §0.5 与完成判据要求“已做/未做如实标注，禁止把未采集写成已支持”，同理也不得把已存在缺陷写成无缺陷；UI 文案必须与运行时事实一致，否则页面本身即为误导。
- 该变更纯文案，零行为、零 SDK、零范围影响，风险低于沿用错误文案。

## 4. 门禁调整（仅 tester，最小面）

- `tools/verify/verify.mjs` 的 `S2-9`：`forbidden` 仍保留前缀 `demo/buggy-shop-boot-vue/frontend/`，但对**精确路径** `demo/buggy-shop-boot-vue/frontend/src/App.vue` 豁免；同一精确路径加入 `allowed`，使“git status 仅含预期 S2 路径”子项通过。**禁止**把豁免扩大为任何目录前缀。
- 新增断言（允许）：App.vue 含 `案例 A`、`故意缺陷`、`UPDATE 0 行`、`后端由 Java agent 采集`、`前端无 SDK`；**不含**旧串 `S0 demo 骨架：无采集、无缺陷、无 SDK`；并断言该前缀下仅此一文件被改。
- 其余断言不放宽：schema/S0/S1/s2 fixture、契约、G1 哈希、§2.2 越界与 S3 扫描照旧。acceptance 在 `acceptance.md` 记录“冻结路径例外 = S2-AMD-01（单文件文案）”，不得作为后续先例。

## 5. 再冻结与复跑

- tester：改后重跑 `(cd "tools/verify" && npm ci && node verify.mjs)` 至 **42/42、exit 0**；更新 `test-report.md`（新时间戳、S2-9 例外说明与文案断言证据、记录本文件 SHA256）；不改产品代码。
- acceptance：重跑同一门禁复核后重走 G2；通过即按原计划只 add 文件名、`commit`、`tag s2-baseline`、归档、README/progress，并在 G2 记录该例外。`evidence/demo-s2.png` 已呈现授权文案，无需重采。
- 范围：无其它改动、无新增任务、无 S3；S2 出口口径同 `dispatch.md` §10.6。若需再改 `App.vue` 文案以外内容或其它 demo 前端文件，**须另发修订**，本文件不得类推。

## 6. 变更记录

| 版本 | 日期 | 内容 |
|---|---|---|
| S2-AMD-01 | 2026-11-23 | 首次发布：授权 demo 前端 `App.vue` 页头/横幅文案修正；`S2-9` 单文件例外与文案断言；tester 重跑 42/42 后重走 G2；S3 边界与其余冻结面不变 |
