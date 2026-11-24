# TraceBoard 0.1.0 — Windows portable (local)

这是本地演示包，不是云端服务，也不是 Qoder Site。

## 运行前提

- Windows 10/11
- Eclipse Temurin JDK 8 + JDK 21（本包不附带 JRE；不接受 Oracle JDK 再分发）
- 端口 8601/8080/5173 空闲

## 启动

1. 设置 `JAVA8`、`JAVA21` 指向 JDK home（或修改脚本默认值）。
2. 运行 `Run-TraceBoard.cmd`。
3. 打开 `http://127.0.0.1:5173`；工作台输入会话 `s_demo_package`。
4. 停止：`Stop-TraceBoard.cmd`。

启动 collector 8601、demo 8080、workbench 5173；日志在 `work/logs/`。

## 已验证

- 包内 UI `/` 200；UI 的 `/api` 反代到 collector；demo `/api/orders` 返回 CREATED。
- stop 脚本能停止三进程并释放端口。
- S0–S8 本地门禁：75/35/18 PASS（仓库源码）。

## 边界

- 本包需要已安装 JDK；不是自包含 EXE。
- 不包含用户 JAR/WAR 上传/运行；S9 云端沙箱未实现。
- 没有公网站点；Qoder Sites 发布是后续独立步骤。
- 私有仓库不把源码链接放到公开站点；如仓库转 public，需重新评估链接与许可证。

## 已知未完成

- 自包含 EXE（jpackage/Temurin 包装）尚未构建。
- GitHub Release 由 Actions 手动流程创建；需要仓库 Actions 可用与写入权限。