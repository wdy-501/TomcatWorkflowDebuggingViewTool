# 前端 SDK 与 Vite 插件

> TraceBoard 1.0.0｜可选前端关联｜2026-11-26

TraceBoard 的后端 agent 不需要前端配合也能工作；接入前端 SDK 后，工作台可以把“浏览器点击/请求”和“后端 Controller”标成 `EXACT`，否则后端链路仍完整但显示 `LOST_BACKEND`。

## 1. 能力与边界

| 能力 | 说明 |
|---|---|
| 点击事实 | 记录元素身份、点击根和观察窗 |
| fetch / XHR | 记录请求方法、路径、状态、耗时和可用的请求信息 |
| `wrapFn` | 记录函数执行事实，节点形如 `<appName>#<function>` |
| `uiEffect` | 记录页面效果事实 |
| manifest source | 构建插件把函数/文件/行号注入前端事件，flag 为 `SOURCE_MAPPED` |
| 关联后端 | `traceparent` + `X-TraceBoard-Click` |

**不采集**：局部变量、响应体、Cookie、完整请求头、sourcemap 解码、浏览器像素回放。SDK 只做前端事实，不修改业务返回值。

## 2. 同源代理

浏览器 SDK 和 collector 必须同源，避免 CORS 和 header 丢失。以 Vite 为例：

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/ingest": {
        target: "http://127.0.0.1:8601",
        changeOrigin: false
      },
      "/api": {
        target: "http://127.0.0.1:8601",
        changeOrigin: false
      }
    }
  }
});
```

`ingestUrl` 默认 `/ingest`；如果应用部署在子路径，改成对应的同源前缀。

## 3. 接入 SDK

### 3.1 ESM

```ts
import { initTraceBoard, wrapFn, uiEffect } from "@traceboard/sdk";

initTraceBoard({
  sessionId: "s_run_...", // 与启动 TraceBoard 的会话一致
  ingestUrl: "/ingest",
  appName: "my-app",
  observeMs: 1500
});

// 需要记录函数时
const submit = wrapFn("submitOrder")((payload) => {
  // 业务代码
});

// 需要记录页面效果时
uiEffect("show-success", { orderId: 1 });
```

### 3.2 IIFE / 静态页

```html
<script>window.__TRACEBOARD_CONFIG__ = {
  sessionId: "s_run_...",
  ingestUrl: "/ingest",
  appName: "my-app",
  observeMs: 1500
};</script>
<script src="/traceboard-sdk.iife.js"></script>
```

IIFE 在配置合法时自动初始化；`sessionId` 必须匹配 `s_[A-Za-z0-9_-]+`。

## 4. Vite 构建插件（可选）

`frontend/build-plugin` 在构建时生成 `traceboard-manifest.json`，并通过 `transformIndexHtml` 注入 `window.__TRACEBOARD_MANIFEST__`：

```ts
// vite.config.ts
import traceboardSource from "../../frontend/build-plugin/index.mjs";

export default defineConfig({
  plugins: [traceboardSource()]
});
```

- `wrapFn(name)` 生成的 `js_method` 事件命中 manifest 时，写 `source={file,line}` 并附加 `SOURCE_MAPPED`。
- 带 `data-tb-fn="<name>"` 的元素点击根命中 manifest 时，同样带 source。
- 只到函数/文件/1-based 行号；不是 sourcemap 解码，也没有局部变量。

## 5. 字段与关联

| 字段/标记 | 含义 |
|---|---|
| `SDK_ACTIVE` | 会话由 SDK 采集 |
| `S3_RUNTIME_SDK` | SDK 兼容标记 |
| `OBSERVE_MS=n` | 点击后的实际观察窗 |
| `SOURCE_MAPPED` | source 来自构建 manifest |
| `traceparent` | W3C 链路头 |
| `X-TraceBoard-Click` | 点击根 id；与 traceparent 一起形成 EXACT |
| `LOST_BACKEND` | 后端没有前端根 |
| `TRACEPARENT_ONLY` | 只有 traceparent，没有点击标记 |

合法关联顺序：

1. `traceparent` + `X-TraceBoard-Click` → `EXACT`
2. 只有 `traceparent` → `LOST + TRACEPARENT_ONLY`
3. 两者都没有 → `LOST_BACKEND`

## 6. CSP 限制

SDK 只使用同源外部脚本和同源 `/ingest` 请求。如果页面 CSP 限制 `script-src`/`connect-src`，需要显式允许；TraceBoard 不改写 CSP、不加 nonce、不做内联注入。

## 7. 验证

```bash
cd frontend/sdk
npm ci
npm run build
npm test
```

构建与测试说明见 `frontend/sdk/README.md`。