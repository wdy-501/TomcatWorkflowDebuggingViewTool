# 站点发布记录（TraceBoard）

> 日期：2026-11-24｜目标：把 TraceBoard 部署成可访问站点
> 结论：**本地站点完成；云端发布受阻（sites_unavailable）**。

## 1. 已完成

- `site/traceboard/`：单页交互 trace 浏览器（A/B/L2、节点详情、回放、三栈矩阵、边界）。
- 本地预览：`python -m http.server 5180 --bind 127.0.0.1` → `http://127.0.0.1:5180/`。
- 设计工作台：`open_design_workbench` 已注册（name `TraceBoard`，page `/`，capabilities appearance/radius/spacing/typography/motion），status `completed`。
- 静态产物：`site/traceboard/dist/{index.html,assets/*}`；无外链/CDN/字体/图片。
- 交互检查：程序化切换 A/B/L2 与详情更新通过；结构快照通过。截图受 in-app browser visibility=hidden 限制未采集，未伪造。

## 2. 发布阻塞

- `prepare_site`（actionId `fcbab4bf-84d6-45b6-b460-a8ab786bbce3`，projectRoot `site/traceboard`，webDirectory `dist`，displayName `TraceBoard`，slug `traceboard-demo`，createNewSite=true）连续两次返回 `sites_unavailable`。
- 未返回草稿/Deployment/发布状态；未调用 publish_site，未声称 `published: true`。
- `list_sites` 可读且为空；`get_context` 正常。判断为 Sites 云端准备服务不可用/受限，不是站点构建失败。

## 3. 恢复步骤

1. Sites 服务恢复后，用**同一 actionId/相同输入**重试 `prepare_site`（不要新建第二个站点）。
2. 检查 descriptor/readiness；ready 后 `publish_site`，轮询到 `published: true`。
3. Desktop 调用 `show_publish_confirmation`，用返回的 deliveryMarkdown 交付；若服务仍失败，报告不可用。

## 4. 与 S9 的关系

S9 的容器是**运行用户上传 Boot JAR 的隔离沙箱**，不是本演示站的托管方式。本机无 Docker/WSL/云凭证，S9 仍阻塞；站点部署失败是 Sites 云服务不可用，两者独立记录，不互相冒充。