# S7 测试报告（React18 + Webpack5 本地基础第二栈）

> 日期：2026-11-24｜基线：`s6-baseline`｜被测提交：S7 React 实现（`e882507` + gate 修正 `0b91c2d`/`74e7e70`）
> 角色说明：tester 子代理超时未产出，测试脚本/复跑由主协调器按独立测试口径接管；不伪造 agent 结果。

## 1. 结论

- **S0–S6 全量回归：75 PASS / 0 FAIL**，末行 `S6 TEST (full S0–S6): PASS`，exit 0。
- **S7 门禁：35 PASS / 0 FAIL**，末行 `S7 TEST (React18/Webpack5): PASS`，exit 0。
- 浏览器 E2E：案例 A 7 span/EXACT/SQL 0 行；案例 B 3 span/零 fetch；工作台两 trace 判定正确。
- 无 S8+、无 Tomcat/WAR、无云端；React 仅基础级。

## 2. 命令与结果

```bash
# S0–S6（verifier 保持 75 项）
(cd "tools/verify" && node verify.mjs)
# SUMMARY: 75 PASS / 0 FAIL
# S6 TEST (full S0–S6): PASS

# S7（独立门禁，避免改写冻结的 75 项）
(cd "tools/verify" && node s7-react.mjs)
# S7 SUMMARY: 35 PASS / 0 FAIL
# S7 TEST (React18/Webpack5): PASS

# 仅静态（无服务）
(cd "tools/verify" && node s7-react.mjs --no-e2e)
# S7 SUMMARY: 21 PASS / 0 FAIL
```

偏差说明：S7-A..E 放在 `tools/verify/s7-react.mjs` 独立脚本，而非并入 `verify.mjs`；冻结的 75 项门禁字节/计数保持不变。README 同时给出两条命令，未用 80 项虚假计数。

## 3. S7 门禁覆盖（35 项）

| 组 | 结果 | 关键断言 |
|---|---|---|
| S7-A build/artifact | 7/7 | React 18.3.1、Webpack 5、SDK `file:` 依赖、5175/host/双代理/changeOrigin=false、devtool=false、dist 无 `.map`/manifest/外链、lockfile 仅 npmjs+本地 SDK、bundle 含 s_s7react/OrderEdit.jsx/选择器/SDK 标记 |
| S7-B demo 静态契约 | 8/8 | 单次 init、`validateForm` 模块级仅 wrap 一次、A/B 选择器与文案逐字、B 校验无 fetch/XHR、初始 GET 为真实运行时读取、无直连 8601、后端/Vue demo/SDK/agent/collector/workbench 零改动、无 Tomcat/S8 |
| S7-C 代理/EXACT E2E | 11/11 | collector 8601、WDS 5175、`/api` 订单 CREATED、`POST /api/orders/1/cancel` 经 5175=200、4 个后端 span（controller/service/mapper/sql）全 EXACT、controller.parent=traceparent span、SQL `rowsAffected=0` 且订单仍 CREATED、manifest 404、`/ingest` NDJSON 经 5175=202、停 collector 后 cancel 仍 200（fail-open） |
| S7-D serving/workbench | 2/2 | dev `/` 有 `#root` + 本地 app.js；workbench dist 存在，S3 选择器/SDK 判定未回归 |
| S7-E scope/freeze/cleanup | 7/7 | 改动仅在 S7 白名单、S0–S6 冻结面零 diff、无 s6a/s6b 临时 tag、无 S8+、8080/8601/5175 清理后释放 |

## 4. 浏览器 E2E（真实运行）

环境：collector 8601 + 复用 Boot/H2 后端 8080（JDK8 + agent `-Dtraceboard.sessionId=s_s7react`）+ React dev 5175 + workbench 5173。

### 案例 A（`#btn-cancel`）

- 页面 `http://localhost:5175`：初始 `#order-status=CREATED`（来自真实 `GET /api/orders`），点击后 `#success-hint=操作成功`，不刷新订单。
- trace `f7a57eaa…`：**7 span 全 EXACT**：`ui_event #btn-cancel` → `fetch POST /api/orders/1/cancel` → `controller#cancel` → `service#cancel` → `mapper#cancelById` → `sql OrderMapper.cancelById` → `render ui_effect:操作成功`。
- controller.parentSpanId = fetch.spanId；SQL `rowsAffected=0`；`GET /api/orders` 仍 `CREATED`。
- 工作台：spanCount 7、fetchCount 1、backendSpanCount 4、confidence EXACT、SQL 0 行。

### 案例 B（`#amount-b=0` + `#btn-save-b`）

- 页面显示 `#b-error=金额必须大于 0`；无 fetch/XHR。
- trace `eaaa8db8…`：**3 span 全 EXACT**：`ui_event #btn-save-b` → `js_method OrderEdit.jsx#validateForm RETURNED_FALSE` → `render ui_effect:金额必须大于 0`。
- 工作台：spanCount 3、fetchCount 0、backendSpanCount 0、sdkActive true、`OBSERVE_MS=1500`；判定文案「已确认：本次点击因果链内没有网络请求」。

初始 `GET /api/orders` 在点击窗外，未进入点击 trace；SDK 的 `/traceboard-manifest.json` 探测为 404 且不发事件。collector 总计 10 个事件 / 2 条 trace。

## 5. 证据

- `docs/plans/stages/S7/evidence/s7-react-case-a-b.png`（A 成功 + B 错误同页）
- `docs/plans/stages/S7/evidence/s7-workbench-case-a.png`（7 节点/EXACT/SQL 0 行）
- `docs/plans/stages/S7/evidence/s7-workbench-case-b.png`（3 节点/fetchCount 0/已确认无请求）

## 6. 限制

- React18/Webpack5 仅本地基础；复用现有 Boot 后端，无 CORS/鉴权/云端。
- 无 React 构建插件/sourcemap/组件映射/JS 源码行列/JS 局部变量/回调内部。
- 仅 devServer 代理路径；静态 `dist` 无代理（只验证本地产物）。
- 未做 React 生产发布、Tomcat/WAR/SSM、S8+。