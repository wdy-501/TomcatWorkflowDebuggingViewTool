# 前端浅层构建插件（Vite/Vue）：函数/文件/行号 manifest 与 `source`

> 阶段：S5（L1 + 前端浅层）｜作者：plan-writer｜日期：2026-11-27｜版本：v1
> 权威输入：`docs/plans/stages/S5/dispatch.md` §3/§4.4（binding）、主计划 §7.3（前端接入分级 F0/F1/F2）、§9.1–§9.4、§16 T3/T7/T10、§19 S5；
> 契约落点：`api.v1.md` 附录 E、`event-model.v1.md` §12.11（`source`/`SOURCE_MAPPED`）、§4.4（`values`）、`api.v1.md` §10.9（graph 第 15 字段）。
> 本文只描述**设计、用法、限制与验证**，不含实现代码；实现由 coder-frontend 按 §3 归属完成（`frontend/build-plugin/**`、`frontend/sdk/**`、demo 前端）。

## 1. 这是什么、不是什么

| 是 | 不是 |
|---|---|
| **F1/F2 浅层**：构建期扫描源码，产出“函数名 → 文件 + 原始 1-based 行号”的 manifest | **不是 `.map` 解码**：不解析 sourcemap、不做堆栈反混淆、不上传 `.map` |
| 让前端事件（`js_method`、带 `data-tb-fn` 的 click 根）带上 `source={file,line}` + flag `SOURCE_MAPPED` | **不是 L2**：不采集局部变量、行号级变量表、对象深字段（S6） |
| 一个**零第三方依赖**的 Vite 插件（dev 中间件 + build 产物 + `transformIndexHtml` 内联） | 不是 Webpack/React 适配（S7+），不是浏览器扩展/CDP（S7+） |
| 让“有插件”的前端比“压缩包”多出**方法名/文件/行号**这一层证据 | 不承诺把压缩后的函数名“猜”回源码位置 |

诚实口径（必须同时写在 README/报告/UI）：**S5 只到函数/文件/行号；局部变量与行级变量属 L2/S6，本阶段未采集。**
`build.sourcemap=true` 只让 demo 构建产出 `.map` 给浏览器 devtools，与工作台/collector 无关。

## 2. 目录、包名与依赖

```text
frontend/build-plugin/
├── package.json          # {"name":"@traceboard/vite-plugin","private":true,"type":"module","exports":{".":"./index.mjs"}}
├── index.mjs             # export default traceboardShallow / export { traceboardShallow, scanFunctions }
├── index.d.mts           # TypeScript 声明（Vite Plugin 类型用 JSDoc/内联最小形状，不依赖 vite 包）
└── test/plugin.test.mjs  # node:test + node:assert；fixture 文本用临时目录（os.tmpdir）
```

- **无第三方依赖**（不新增 `fast-glob`/`@babel/*`/`magic-string` 等）：只用 `node:fs`、`node:path`、`node:os`、`node:url`。
- 不新增 npm 依赖、不改 demo `package.json`/`package-lock.json`、不引入 CDN/在线字体/遥测。
- demo 通过**相对路径**导入：`import traceboardShallow from "../../../frontend/build-plugin/index.mjs";`（从 `demo/buggy-shop-boot-vue/frontend` 回溯三级到仓库根；不写进 dependencies）。
- `index.mjs` 必须 `export default traceboardShallow`（可另导出命名 `traceboardShallow`/`scanFunctions`，但**冻结接入写法是默认导入**）；`index.d.mts` 必须提供默认导出声明，demo `tsconfig.json` 的 `moduleResolution: "bundler"` 下 `vue-tsc --noEmit` 必须可解析。
- 插件默认导出工厂函数，返回一个标准 Vite 插件对象（`name: "traceboard-shallow"`）。

## 3. demo 接入（`demo/buggy-shop-boot-vue/frontend/vite.config.ts`）

```ts
import traceboardShallow from "../../../frontend/build-plugin/index.mjs";

export default defineConfig({
  plugins: [vue(), traceboardShallow()],
  build: { sourcemap: true }
  // server/preview 代理与端口保持 S3/S4 现状（5174/4174，/api→8080，/ingest→8601）
});
```

- 端口/代理/别名（`@traceboard/sdk` → SDK 源码）**不变**；`build.sourcemap=true` 只加在 demo（workbench/SDK 不得产出 `.map`）。
- 只扫描 demo 前端 `src/**/*.{vue,ts}`；不含 `node_modules/`、`dist/`、`public/`。
- 插件参数（可选，均有默认）：`{ root?: string, include?: string[] }`；默认 `root = config.root`、`include = ["src/**/*.vue","src/**/*.ts"]`。

## 4. 扫描规则（浅层正则；无 AST）

对每个文件按物理行（`\n` 或 `\r\n` 都按一行计，行号仍是 1-based）逐行匹配两条规则：

```text
R1  ^[ \t]*(?:export[ \t]+)?(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(
R2  ^[ \t]*(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[^;\n]*wrapFn\([ \t]*["']\1["']
```

- `R1` 命中 `function`/`async function` 声明（demo 的 `cancelOrder`、`loadOrders`、`previewDiscount` 等）；
- `R2` 命中 `const x = traceboard.wrapFn("x", ...)` 形式（demo 的 `validateForm`，`\1` 反向引用保证名字一致）；
- **`.vue` 用全文行号**（不剥离 `<template>`/`<style>`；`<script setup>` 里的行号 = 文件行号）。
- 只识别**行首声明**；缩进只允许空格/Tab；不识别 `export default function`、类方法、箭头函数赋值（浅层边界，见 §8）。
- 行号 = 该声明所在行（`function`/`const` 关键字所在行），不做“函数体第一行”换算。

**归一与排序（确定性）**

| 步骤 | 规则 |
|---|---|
| 文件枚举 | 按文件名升序（POSIX 相对路径字典序）；命中后转 POSIX 分隔符 |
| 同名去重 | 同名函数**首个胜出**（按上面的文件顺序 + 行号顺序），并 `console.warn` 一次（不静默） |
| 排序 | `functions` 按 `file, line, name` 升序 |
| 上限 | ≤**500** 项；超出截断并在 warn 中给出总数（不静默） |

**manifest 形状（唯一形状）**

```json
{"functions":[{"name":"cancelOrder","file":"src/App.vue","line":44},
              {"name":"validateForm","file":"src/App.vue","line":86},
              {"name":"previewDiscount","file":"src/App.vue","line":120}]}
```

- 字段只有 `name`/`file`/`line`；`file` 是相对 `root` 的 POSIX 路径（非绝对路径），`line` 是 ≥1 整数。
- 上面数字**只是示意**：行号随源码变化，测试必须从源文件重新计算，禁止硬编码。

## 5. 三个出口

| 出口 | 时机 | 形状 |
|---|---|---|
| dev 中间件 `GET /traceboard-manifest.json` | 每次请求**重新扫描**（无缓存，避免行号漂移） | `200`、`application/json; charset=utf-8`、`Cache-Control: no-store`；body = manifest |
| build 产物 `dist/traceboard-manifest.json` | `generateBundle`/`emitFile`（`type:"asset"`） | 同上；文件名固定 |
| build 内联 | `transformIndexHtml`，`injectTo:"head-prepend"` | `<script>window.__TRACEBOARD_MANIFEST__ = <JSON>;</script>`，`<` 转义为 `\u003c`，`</script>` 不出现 |

- dev 其他方法（`POST/PUT/...`）→ `405`；扫描异常 → `500 {"error":"manifest_scan_failed","message":"<≤200 字符>"}`（**不**回显文件内容）。
- 中间件只在 Vite dev server 上（5174），**不是** collector 路由、不参与 `api.v1.md` 的 collector 契约面。
- **preview（8602）不注入 manifest**：预览注入仍只加 `config.js`/`sdk.js` 两个外部脚本（S4 规则不变，无内联、无 CSP 改写）。
- 内联被 CSP 拦截是**允许的降级**：SDK 走 JSON 兜底（§6）；文档/日志必须写“内联被拦时用 JSON 兜底”，不得假装注入成功。

## 6. SDK 侧：读 manifest、附加 `source` 与 `SOURCE_MAPPED`

| 场景 | 行为 |
|---|---|
| 启动 | 同步读 `window.__TRACEBOARD_MANIFEST__`（对象形状校验；坏数据当作无 manifest） |
| 内联缺失 + ESM demo | **一次** `fetch("/traceboard-manifest.json")` 兜底（相对路径、fail-open、无重试、无缓存、**不产生事件**） |
| 内联缺失 + IIFE/preview | **不**发起兜底（避免预览页额外请求与 S4-E 计数回归） |
| `wrapFn(name)` 命中 | 该 `js_method` 事件写 `source={file,line}` + flag `SOURCE_MAPPED` |
| click 根 + `data-tb-fn="<name>"` 命中 | 该 `ui_event` 事件写 `source={file,line}` + flag `SOURCE_MAPPED` |
| `fetch`/`render`/未命中/坏条目 | 不写 `source`、不加 flag（**字节与 S3 完全一致**） |

- 条目有效性：`file` 非空字符串且 `line` 为 ≥1 整数才采用；否则忽略该条。
- `nodeKey` 不因 manifest 改变（仍是 `<appName>#<name>` / 控件身份）；`source` 只是**附加字段**。
- SDK 不读 `.map`、不解析 sourcemap、不上传任何文件；不采集 `values[]`、不读输入框/表单值。
- 工作台文案：完整 `source` → `file:line`；flag 含 `SOURCE_MAPPED` → 追加 `（manifest 映射）`；缺失 → `未采集`。

## 7. demo 前端契约（S5 新增，不改案例 A/B）

| 元素 | 选择器 | 行为 |
|---|---|---|
| 折扣预览按钮 | `#btn-discount`，`data-tb-fn="previewDiscount"` | 固定 URL：`/api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=` + 3000 个 `x`（`encodeURIComponent`）；显示 `{"data":0}` 与“仅内存返回 0、数据库金额未改”提示；**不调用** `loadOrders` |
| `previewDiscount` | `async function previewDiscount()` | 普通声明（R1 命中）；由 `data-tb-fn` 声明式附加 `source` |
| `validateForm` | `const validateForm = traceboard.wrapFn("validateForm", rawValidateForm)` | R2 命中；案例 B 的 3 事件形状与零请求不变 |
| 页头文案 | — | 改为 S5 真实能力，逐字：`S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）`；删除“无构建插件/sourcemap”旧口径 |

## 8. 限制（必须如实写进 README/报告/UI）

1. **manifest 驱动**：只有被扫到的**命名函数声明**与 `wrapFn("同名")` 常量才有 `source`；匿名函数、箭头函数赋值、类方法、闭包内局部函数**没有**。
2. **只有函数/文件/行号**：没有局部变量、没有行级变量、没有对象深字段（L2/S6）。
3. **没有 `.map` 解码**：`build.sourcemap=true` 只产出 `dist/*.map`（gitignore，不提交/不上传/不解析）；压缩产物里的函数名**不得**用来猜行号。
4. **preview 页没有 manifest**：预览注入只加 `config.js`/`sdk.js`，因此预览页的前端事件没有 `source`——工作台显示 `未采集`。
5. **行号会漂移**：源码增删行后 manifest 行号随之变化；任何测试都从源文件重新计算。
6. **同名去重**：同名函数只有首个（按文件/行序）进入 manifest，其余 warn 丢弃；跨组件同名会漏映射（浅层已知代价）。
7. **内联可能被 CSP 拦截**：拦截时 ESM demo 走 JSON 兜底、IIFE/preview 无兜底（如实降级）。
8. **无第三方依赖/无 CDN**：插件只用 Node 内置模块；不引入 AST 库，因此不做语义分析。

## 9. 验证命令（S5-D/S5-E 口径）

> 以下命令默认**从仓库根**执行（路径含中文/空格，全部双引号；标注的 `cd` 子命令除外）。

```bash
# 0) 插件单测（node:test，无依赖）
node --test "frontend/build-plugin/test/plugin.test.mjs"

# 1) demo 构建：产出 .map + manifest，dist 内含内联 manifest
(cd "demo/buggy-shop-boot-vue/frontend" && npm ci && npm run build)
ls "demo/buggy-shop-boot-vue/frontend/dist" | grep -E "traceboard-manifest.json|\.map$"
grep -c "__TRACEBOARD_MANIFEST__" "demo/buggy-shop-boot-vue/frontend/dist/index.html"
grep -o "validateForm\|previewDiscount" "demo/buggy-shop-boot-vue/frontend/dist/traceboard-manifest.json" | sort -u

# 2) 行号必须等于源文件里的真实行（测试从源码重算，不硬编码）
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('demo/buggy-shop-boot-vue/frontend/dist/traceboard-manifest.json','utf8'));const f=m.functions.find(x=>x.name==='previewDiscount');const line=fs.readFileSync('demo/buggy-shop-boot-vue/frontend/'+f.file,'utf8').split(/\r?\n/)[f.line-1];if(!/function\s+previewDiscount\s*\(/.test(line))throw new Error('line mismatch: '+JSON.stringify(line));console.log('ok',f);"

# 3) dev 中间件（另开 dev server：5174）
(cd "demo/buggy-shop-boot-vue/frontend" && npm run dev)
curl -s -D - "http://127.0.0.1:5174/traceboard-manifest.json" | head -20   # 200 + application/json + no-store

# 4) 反向断言：workbench/SDK 不产出 .map，插件/dist 未入库
find "workbench/dist" "frontend/sdk/dist" -name "*.map" 2>/dev/null | head   # 必须空
find "demo/buggy-shop-boot-vue/frontend/dist" -name "*.map" -o -name "traceboard-manifest.json" | head
git status --porcelain -- "workbench" "frontend/build-plugin" "frontend/sdk" "demo/buggy-shop-boot-vue/frontend/dist" | head
```

期望：`dist/` 同时有 `.map` 与 `traceboard-manifest.json`；`index.html` 含 `__TRACEBOARD_MANIFEST__`；
manifest 含 `validateForm`/`previewDiscount` 且行号与源文件一致；dev 中间件 200 JSON；workbench/SDK 无 `.map`。

## 10. 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| 事件没有 `source` | manifest 未命中 / 名字不同 / `data-tb-fn` 缺失 / preview 页 | 查 `dist/traceboard-manifest.json`、按钮属性、当前是否预览页（预览永远没有） |
| 行号差 1–N 行 | `.vue` 被“只算 `<script>`”处理或源码改动 | 插件必须用全文行号；重新构建即可，测试禁止硬编码 |
| 内联查不到 | CSP 拦截 / `transformIndexHtml` 未生效 | 用 `GET /traceboard-manifest.json` 兜底（仅 ESM）；日志写“内联被拦”，不伪造 |
| dev 中间件 404 | 插件未启用 / 方法不是 GET / 端口不对 | 确认 `plugins:[vue(),traceboardShallow()]` 与 5174 |
| 同名映射错 | 去重策略命中另一处 | 按 warn 改名或接受“首个胜出”；跨组件同名是已知限制 |

## 11. 安全与隐私

- 无真实 secret/客户数据；`demoSecret=s3cr3t` 是**演示假值**。
- manifest 只含**函数名/相对路径/行号**，不含源码片段、默认值、注释或输入值。
- SDK/manifest 不采集表单值、cookie、查询串、请求体；不写 localStorage；无遥测/CDN/外网请求（JSON 兜底也是同源相对路径）。
- `SOURCE_MAPPED` 只声明“来源是 manifest”，不得被读成 L2 或“源码已上传”。