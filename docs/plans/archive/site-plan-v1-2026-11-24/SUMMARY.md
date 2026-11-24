# 旧站点方案 v1 备份

> 归档：2026-11-24｜原文件：`docs/plans/SITE-DEPLOY.md`（v1）
> 来源：Qoder Sites `open_design_workbench` + 本地静态站；发布尝试 5 次均 `sites_unavailable`。

## 为什么归档

v1 把“Qoder Sites 发布静态站”作为主交付路径，但没有把官方边界写进方案：
Qoder Sites 只能承载静态文件、控制面/前端和轻量 Functions，不能运行用户的 Spring Boot JAR/Tomcat WAR，
也没有可依赖的 Firecracker/gVisor 沙箱。比赛演示必须把“公网展示”和“真实 Java 运行”拆开，因此 v1 被 v2 取代。

## 保留内容

- `SITE-DEPLOY.v1.md`：原发布记录/失败证据。
- `site-source/`：v1 站点源码快照（index.html、assets）。
- `S9-BLOCKED.md`：云端运行时阻塞记录（与站点问题独立）。

## 不在本备份中的内容

- `.TraceBoard.qoder.site` 设计工作台生成的本地描述符（未提交）。
- 公网发布结果：不存在；v1 从未返回 `published: true`。

## 恢复

v2 见 `docs/plans/SITE-DEPLOY.md`。不要用本备份覆盖 v2，也不要把 S9 沙箱和 Qoder Sites 混为一谈。