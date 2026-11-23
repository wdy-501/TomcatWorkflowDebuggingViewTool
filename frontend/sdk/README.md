# @traceboard/sdk

TraceBoard 运行时 SDK（S3 facts + S4 预览注入 IIFE）。只采集 click / fetch / XHR / `wrapFn` / `uiEffect` 事实；
无构建插件、无 sourcemap、无 CDN、无遥测、无第三方 runtime 依赖。

## 产物（`npm ci && npm run build`）

| 文件 | 说明 |
|---|---|
| `dist/index.js` | ESM（`tsc`，target ES2020）；demo 的显式 `initTraceBoard` 用法不变 |
| `dist/index.d.ts` | 类型声明 |
| `dist/traceboard-sdk.iife.js` | esbuild IIFE（`--target=es2018`、`--minify=false`、无 sourcemap），全局名 `TraceBoardSDK` |

```js
TraceBoardSDK = { initTraceBoard, wrapFn, uiEffect, elementIdentity, version: "0.1.0" }
```

`version` 与 `package.json` 的 `version` 保持一致（IIFE 测试会校验）。

## 本地预览注入如何使用 IIFE

`server/launcher` 的 `preview` 把两个**外部**脚本注入静态 HTML 页面的最后一个 `</body>` 之前（无内联脚本）：

```html
<script src="/traceboard/config.js"></script><script src="/traceboard/sdk.js"></script>
```

- `/traceboard/config.js` 由 launcher 生成，内容是
  `window.__TRACEBOARD_CONFIG__ = {"sessionId":"s_...","ingestUrl":"/ingest","appName":"traceboard-preview","observeMs":1500};`
- `/traceboard/sdk.js` 即本目录的 `dist/traceboard-sdk.iife.js` 字节（构建：`(cd "frontend/sdk" && npm ci && npm run build)`）。
- IIFE 加载后，仅当 `window.__TRACEBOARD_CONFIG__` 是对象时自动调用一次 `initTraceBoard(config)`：
  - `sessionId` 必须匹配 `^s_[A-Za-z0-9_-]+$`，否则不初始化（`console.warn`，不抛错）；
  - `ingestUrl` 默认 `/ingest`，`appName` 默认 `traceboard-preview`，`observeMs` 默认 1500（有效范围 1..60000）；
  - 幂等 guard：`window.__TRACEBOARD_SDK_ACTIVE__`（显式 ESM `initTraceBoard` 也会置位；兼容契约别名
    `window.__TRACEBOARD_AUTO_INIT__`），二次加载不会重复安装监听；
  - 任何异常都被吞掉（fail-open），不会影响宿主页面。
- 无 `window.__TRACEBOARD_CONFIG__` 时不自动初始化（ESM/Node 场景行为与 S3 完全一致）；
  ESM 构建不包含自动初始化，只有 IIFE 构建在打包时打开该分支（`--define:__TRACEBOARD_IIFE__=true`）。

## CSP 限制（预览注入）

launcher 只注入**同源外部脚本**，不改写页面 CSP、不加 nonce、不做内联脚本。
如果页面 `script-src` 只允许 nonce/hash，浏览器可能拦截这两个脚本：标签已注入但执行未验证
（S4 没有 CDP/浏览器扩展）。此时 `diagnose` 的 `preview_injection` 只能说明“标签已注入”，
不能证明 SDK 在浏览器中真正执行；请结合工作台/采集结果人工确认。

## 测试

```bash
npm ci && npm run build && npm test
```

- `test/sdk.test.js`：既有 8 项 ESM/行为测试（S3 语义不变）。
- `test/iife.test.js`：IIFE 产物存在/全局名/无 sourcemap/无外部 URL、vm 中自动 init 恰一次、
  二次加载被 guard 阻止、无 config 不 init、坏 config fail-open、`version` 与 package.json 一致。
