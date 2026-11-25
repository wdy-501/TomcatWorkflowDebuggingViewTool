# 阶段总结：把 5174 示例并入 5173（2026-11-25）

## 结果

- 5173 成为唯一产品入口，默认「交互示例」，可切「追踪台」。
- 本地：示例按钮经 `/demo/api` → 8080、`/demo/ingest` → 8601；10 个按钮均生成真实 trace，工作台自动定位。
- 公网 GitHub Pages：`/app/demo/index.html?static=1` 使用浏览器预置响应；10 个按钮均跳到 `demo-data.js` 的对应预置链路；无 `/api`、`/ingest` 外发。
- Windows 打包：使用 `dist-packaged` + `.env.packaged`，最终包不含 `workbench/demo`，也没有「交互示例」页签。
- 5174 不再需要启动；`netstat` 实测无 5174 监听。

## 关键实现

- Demo：`api-base.ts` 相对请求、`traceboard.ts` 静态 no-op、`static-sim.ts` 预置响应、`bridge.ts` 同源 postMessage。
- 工作台：`DemoPanel.vue` iframe、`demo-bridge.ts` 校验、`S3Panel.vue` 静态/实时定位，示例页签激活时暂停 5 秒轮询。
- 数据：`export-demo-data.mjs` 输出 10 个 cases；`build-site.mjs` 校验 10 条、版本化 demo-data/iframe。
- 构建：Pages workflow 构建 demo+workbench+site；Release 使用 `build:packaged`；package-windows/package-exe 删除并断言无 demo。

## 验收证据

| 检查 | 结果 |
|---|---|
| `node scripts/build-site.mjs` | PASS；10/10 cases、10 graphs、demo 5 文件 |
| 本地 10 个按钮 | 10/10 产生 trace 并显示“已定位本次链路”；示例页签激活时无后台轮询 |
| 公网静态 10 个按钮 | 10/10 显示对应预置 trace；`/api`、`/ingest` 外发 0；静态横幅存在 |
| 公网「查看本次链路」 | 切到追踪台，显示“全部 10”，选中对应节点 |
| 打包 | `dist-packaged` 无 demo tab；`release-test2` 无 `workbench/demo`、无 `site` 镜像 |
| 构建/类型 | demo `vue-tsc`、workbench `build:site`、`build:packaged` 均 exit 0 |
| 脚本语法 | 新增 `.mjs` `node --check` OK；`package-exe.ps1` PowerShell parser OK |

## 独立审阅

独立 Explore agent 复核后，P0 无；P1 已修：干净检出构建顺序、dist 新资源可加入、打包不再带 site 镜像、实时定位用 `atMs` 下界排除旧同键 trace；另加打包 bundle `app-tab-demo` 断言和 build-site 10 cases 断言。

## 已知边界

- 公网只模拟 HTTP 响应与预置链路，不伪造动态采集；真实请求需本地 8080+8601。
- 完整 `tools/verify/verify.mjs` 未在本轮全量执行；已更新受影响的静态断言，采用构建+浏览器+打包定向验收。
- 当前改动未提交/未推送；GitHub Pages 需要提交后由 workflow 重建。

## 备份

`backups/demo-5173/2026-11-25-demo-5173.tar.gz`（源码、站点 dist、计划/总结；排除 node_modules/.git/缓存）。