# launcher `ui` 冒烟记录（Release 前置）

> 日期：2026-11-24｜目的：为 Windows 便携包/EXE 提供本地静态托管；不发布站点。
> 状态：PASS（仅本地）；EXE 仍未构建。

## 实现

- 新增 `server/launcher/src/main/java/io/traceboard/launcher/UiCommand.java`
- `Args` 支持 `--dir`；`Launcher` 增加 `ui` 子命令
- 用法：`java -jar traceboard-launcher-...jar ui --dir workbench/dist [--port 5173]`
- 仅绑 `127.0.0.1`；GET/HEAD；无目录列表；缺失的静态资源 404；无扩展名路由回退 index.html；路径越界 404；其他方法 405。

## 验证

| 项 | 结果 |
|---|---|
| `mvn -DskipTests package`（server/launcher, JDK21） | exit 0 |
| `UI_READY` | `http://127.0.0.1:5181` |
| `GET /` | 200 text/html |
| 真实构建资源 `assets/index-Ca9DkLHh.js` | 200 application/javascript |
| 真实构建资源 `assets/index-COw78Mjg.css` | 200 text/css |
| `HEAD /` | 200 |
| `POST /` | 405 |
| `/%2e%2e/%2e%2e/README.md` | 404 |
| 绑定 | 仅 `127.0.0.1:5181`；停止后端口释放 |
| `ui --collector http://127.0.0.1:8601` | 启动成功；`GET /api/v1/sessions/s_nope/events` 经 UI 返回 collector 的 `404 application/json`，证明 `/api/*` 反代生效 |

## Windows 便携包（本地构建）

- 脚本：`scripts/package-windows.ps1`、`run-traceboard.ps1`、`stop-traceboard.ps1`、`Run-TraceBoard.cmd`、`Stop-TraceBoard.cmd`
- 产物：`dist/release/TraceBoard-0.1.0-win-x64-portable.zip`（本地产物，不提交 git）
- SHA256：`c1e618cc53b71a8b2b99cc54b47e607c0014f583f22c366478630b6111096b47`
- 要求：本机 JDK8 + JDK21（README 写明 Temurin；不可再分发 Oracle JDK）
- 实测：启动后 UI `5173/` 200、UI 代理 `/api/v1/sessions/s_demo_package/agent` 200 connected、demo `/api/orders` 200 CREATED；`stop-traceboard.ps1` 释放 8080/8601/5173。
- 未完成：GitHub Release 上传、自包含 EXE（jpackage + Temurin 包装）；当前 zip 不是 EXE，也不是免 JDK。

## 仍未完成

- Windows EXE 未构建：还要 Temurin JRE 8/21 + jpackage（或安装器 WiX），并在干净 Windows 验收。
- 未提交/未打 tag；等 GitHub 用户/仓库/License 输入后再做源码/Release 收尾。
- 未调用 Qoder Sites；站点发布仍最后一步。