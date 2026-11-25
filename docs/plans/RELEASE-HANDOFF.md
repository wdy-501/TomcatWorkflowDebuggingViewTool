# TraceBoard Release Handoff

> 日期：2026-11-24｜目标：本地 + GitHub 先行，Qoder Site 最后
> 状态：**GitHub 已 public + MIT；Release v0.1.0 资产已核验；Qoder Site 已发布为 public 工作台静态示例。**

## 1. 已验证

| 项 | 结果 | 证据 |
|---|---|---|
| S0–S6 | 75/75 PASS | `node tools/verify/verify.mjs` |
| S7 | 35/35 PASS | `node tools/verify/s7-react.mjs` |
| S8 | 18/18 PASS | `node tools/verify/s8-tomcat.mjs` |
| 本地站点 | PASS | `http://127.0.0.1:5180/`；`site/traceboard/ACCEPTANCE.md` |
| portable zip | PASS | 三服务启动、UI/API 200、stop 释放端口 |
| app-image EXE | PASS（本地） | `TraceBoard.exe` 启动三服务；本地测试含 Oracle runtime，未上传 |
| GitHub 仓库 | public + MIT | `https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool` |
| Release v0.1.0 | 已核验 | GitHub API 返回非 draft、4 资产：portable zip/exe zip + 双 SHA256 |
| 站点外链 | 已加 | 站点介绍含 GitHub 源码与 Windows 包链接；本地 200，静态检查通过 |
| Qoder Site | PASS | public；https://traceboard-32843bp8pzz.qoder.zone；原版介绍 + 内嵌 5173 工作台，7 案例 |

Release：`https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool/releases/tag/v0.1.0`
发布版 EXE/portable 由 Actions 使用 Temurin 构建；本机 Oracle app-image 仅测试，未上传。

## 2. 公网状态

**GitHub Pages（公开主入口，无每日额度）**
- 地址：https://wdy-501.github.io/TomcatWorkflowDebuggingViewTool/
- 构建：`.github/workflows/pages.yml` → `node scripts/build-site.mjs`。
- 内容：原版介绍风格首页 + 内嵌工作台 `/app/`（与 5173 相同），默认交互示例；10 个案例、请求体/缺口、树形链路、关键帧/慢放；公网按钮返回预置响应并跳到对应预置链路。

**Qoder Site（备用）**
- 地址：https://traceboard-32843bp8pzz.qoder.zone
- 当前 `access_mode=private`，公网 401；每日额度很小，不作为公开主入口。

## 3. 边界

- S9/S10 云端执行按用户确认**不做**；不需要用户上传/沙箱/队列。
- 私有/公开仓库链接现为 public，可放站点介绍。
- 本机验证与发布验证分开记录；未上传 Oracle runtime，未伪造 published。
- 仓库 `v0.1.0` tag 早于 LICENSE 提交；源码 HEAD 有 MIT。若要求 release tag 自带 LICENSE，可在新 tag 重新跑 workflow。
- 最终 UI/请求体/缺口代码和站点改动仍在工作树，未自动提交/推送；发布前需按需提交。

## 4. 复跑命令

```bash
cd "D:/Qoder 高校创造力大赛/TomcatWorkflowDebuggingViewTool"
(cd tools/verify && node verify.mjs && node s7-react.mjs && node s8-tomcat.mjs)
(cd "site/traceboard" && python -m http.server 5180 --bind 127.0.0.1)
```