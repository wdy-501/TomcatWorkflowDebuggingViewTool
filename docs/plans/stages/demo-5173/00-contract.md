# 5173 内置交互示例契约（2026-11-25）

## 入口与路径

- 产品入口：`http://localhost:5173/`（Vite 绑 `[::1]`，用 `localhost`；不要用 `127.0.0.1`）。
- Demo 路径：`/demo/index.html`；静态公网为 `/app/demo/index.html`。
- 本地代理：`/demo/api/*` → `http://127.0.0.1:8080/api/*`；`/demo/ingest` → `http://127.0.0.1:8601/ingest`。
- Demo 内部请求使用文档相对路径 `api/...` 与 `ingest`，同一构建可在 `/demo/`、`/app/demo/` 和根路径运行。
- 5174 不再是产品运行必需端口；仅保留为旧测试/可选维护 dev server。

## iframe → 工作台消息

```json
{
  "source": "traceboard-demo",
  "type": "traceboard:demo-action",
  "caseKey": "#btn-cancel",
  "action": "cancel-order",
  "ok": true,
  "httpStatus": 200,
  "static": false,
  "atMs": 1795606500000
}
```

- 接收方校验 `event.origin === location.origin` 且 `event.source === iframe.contentWindow`。
- `caseKey` 是 10 个按钮选择器之一；`atMs` 用于实时模式排除旧同键 trace。
- 静态模式不初始化真实 SDK；不生成动态 trace。

## 10 个 case key

```text
#btn-cancel
#btn-save-b
#btn-discount
#btn-remark
#btn-no-debug
#btn-unknown-cancel
#btn-unjoined
#btn-reconcile
#btn-reconcile-async
#btn-reconcile-loop
```

## demo-data.js 追加结构

```js
window.__TRACEBOARD_STATIC_DEMO__ = {
  sessions, requests, graphs, replays,
  cases: {
    "#btn-cancel": { traceId: "...", label: "案例 A", action: "取消订单" }
    // 共 10 个 key；traceId 必须同时存在于 requests 与 graphs
  },
  sessionId: "s_s3demo",
  generatedAt: "..."
};
```

工作台静态模式从 `cases[caseKey].traceId` 选中预置链路；缺失时显示错误，不伪造。