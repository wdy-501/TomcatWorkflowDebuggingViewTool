# TraceBoard Release Handoff

> 日期：2026-11-24｜目标：本地 + GitHub 先行，Qoder Site 最后
> 状态：**源码已发布到私有 GitHub；Release/EXE 构建已验证，但 Release 上传与公网站点未完成。**

## 1. 最终验证

| 项 | 结果 | 证据 |
|---|---|---|
| S0–S6 | 75/75 PASS | `node tools/verify/verify.mjs` |
| S7 | 35/35 PASS | `node tools/verify/s7-react.mjs` |
| S8 | 18/18 PASS | `node tools/verify/s8-tomcat.mjs` |
| 本地站点 | PASS | `http://127.0.0.1:5180/`；`site/traceboard/ACCEPTANCE.md` |
| portable zip | PASS | 三服务启动、UI/API 200、stop 释放端口 |
| app-image EXE | PASS（仅本地） | `TraceBoard.exe` 启动三服务，子进程使用捆绑 `runtime/jre8/jre21`；UI/API 200 |
| GitHub 源码 | 已推送 | `wdy-501/TomcatWorkflowDebuggingViewTool` master `70ec47d`；`s0–s8` tags |

本机 app-image 包含 Oracle runtime，**仅测试、未提交、未上传**；发布版必须用 Temurin。

## 2. 当前 GitHub 状态

- 仓库：私有。
- 已推送：源码、`s0–s8` tags、`.github/workflows/release.yml`（手动）。
- 未创建 Release。
- Pages workflow 因 private 失败已删除；不要重加。
- 内置浏览器打开仓库仍是 Sign in；本机无 `gh`/Release API 凭据。
- 私有仓库链接不能放到公开站点（评委打不开）。

## 3. 未完成（按顺序）

1. **GitHub Release**（阻塞：登录/凭据）
   - 在 GitHub 登录 `wdy-501`，或运行 Actions → `release`（版本 `v0.1.0`）。
   - 工作流会用 Temurin 构建：
     - `TraceBoard-0.1.0-win-x64-portable.zip`（需 JDK8/21）
     - `TraceBoard-0.1.0-win-x64-exe.zip`（自包含 EXE）
     - 两个 `.sha256`
   - 必须看到 Release 页面和资产实际存在，才算完成。
2. **License**：用户未选择；私有仓库暂不阻塞 Release，但正式开源/公开前必须补。
3. **Qoder Site**：最后一步；用户明确“已切换账号”后再部署。
   - 私有仓库链接不放到公开站点；
   - 站点只展示内置 A/B/L2 预置快照；
   - 新 action/新 slug/干净目录；
   - `published:true` 后才交付 URL。
4. **S9/S10**：仍阻塞/未开始，保持后置。

## 4. 可复跑命令

```bash
# 构建/本地包
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
(cd frontend/sdk && npm ci && npm run build)
(cd workbench && npm ci && npm run build)
JAVA_HOME="C:/Program Files/Java/jdk-21" mvn -B -q -DskipTests package
(cd demo/buggy-shop-boot-vue/backend && JAVA_HOME="C:/Program Files/Java/jdk1.8.0_221" mvn -B -q -DskipTests package)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-windows.ps1 -OutDir dist/release
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-exe.ps1 -OutDir dist/exe

# 门禁
(cd tools/verify && node verify.mjs && node s7-react.mjs && node s8-tomcat.mjs)
```

## 5. 禁止事项

- 不把本机 Oracle runtime 打进公开/私有 Release 上传包；用 Temurin。
- 不伪造 Release、`published:true` 或公网 URL。
- 不把私有仓库链接放到公开站点。
- 不在当前账号重试 Qoder Sites；先登录/开通，再用新 action。
- 不提交 EXE/zip 到大仓库；只上传 Release 资产。