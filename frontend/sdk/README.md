# TraceBoard SDK 1.0.0

可选的浏览器运行时 SDK。它把页面点击、fetch、XHR、`wrapFn` 和 `uiEffect` 事实发送给本地 collector，用于把前端动作与后端 Controller 关联起来。

- 只采集前端行为事实；不采集局部变量、不解析 sourcemap、不采集响应体。
- 无 CDN、无遥测、无第三方 runtime 依赖；所有请求发送到同源 `/ingest` 或配置的本地地址。
- 不接 SDK 时 TraceBoard 仍可采集后端 Controller/Service/Mapper/SQL 链，只是前端关联为 `LOST`。

## 构建

```bash
npm ci
npm run build
```

产物：

| 文件 | 说明 |
|---|---|
| `dist/index.js` | ESM 构建 |
| `dist/index.d.ts` | 类型声明 |
| `dist/traceboard-sdk.iife.js` | IIFE 构建，全局名 `TraceBoardSDK` |

`version` 与 `package.json` 一致，为 `1.0.0`。

## ESM 用法

```ts
import { initTraceBoard, wrapFn, uiEffect } from "@traceboard/sdk";

const handle = initTraceBoard({
  sessionId: "s_run_...",       // 必须与 TraceBoard 启动会话一致
  ingestUrl: "/ingest",          // 同源代理到 http://127.0.0.1:8601
  appName: "my-app",
  observeMs: 1500
});
```

`initTraceBoard` 幂等；重复调用返回已有 handle。任何初始化失败都 fail-open，不影响宿主页面。

## IIFE / 预览注入

```html
<script>window.__TRACEBOARD_CONFIG__ = {
  sessionId: "s_run_...",
  ingestUrl: "/ingest",
  appName: "my-app",
  observeMs: 1500
};</script>
<script src="/traceboard-sdk.iife.js"></script>
```

只有存在合法 `window.__TRACEBOARD_CONFIG__` 时自动初始化；`sessionId` 必须匹配 `s_[A-Za-z0-9_-]+`。

## 配置字段

| 字段 | 默认 | 含义 |
|---|---|---|
| `sessionId` | `s_s3demo`（代码默认；实际使用必须匹配启动会话） | 会话分区 |
| `ingestUrl` | `/ingest` | 事件接收基础路径；SDK 发送到 `${ingestUrl}/v1/events` |
| `appName` | `app` | `js_method` 节点前缀 |
| `observeMs` | `1500` | 点击后的观察窗毫秒数，范围 1..60000 |

## manifest 与 source

配合 `frontend/build-plugin` 的 Vite 插件：

- 构建时生成 `traceboard-manifest.json` 并内联 `window.__TRACEBOARD_MANIFEST__`；
- `wrapFn(name)` 生成的 `js_method` 事件和带 `data-tb-fn` 的点击命中 manifest 时，写入 `source={file,line}` 并附加 `SOURCE_MAPPED`；
- 只到函数/文件/1-based 原始行号，不是 sourcemap 解码，不采集局部变量。

## CSP 与同源

SDK 只使用同源请求。若页面 CSP 限制 `connect-src` 或 `script-src`，需要允许 `/ingest` 和 SDK 脚本；TraceBoard 不改写页面 CSP，也不使用内联脚本。

## 测试

```bash
npm ci && npm run build && npm test
```

覆盖 ESM 行为、manifest source、IIFE 自动初始化与版本一致性。