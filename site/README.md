# 静态演示站点

正式发布时生成 `site/traceboard/dist/`，作为 GitHub Pages 使用的**预构建静态快照**，包含：

- 正式落地页；
- TraceBoard 工作台的静态演示版；
- 内置示例的预置响应与预置链路快照。

静态站点不连接本地 collector、不接收上传，也不代表实时采集能力。真实调试请按 [重要说明](../docs/important-notes.md) 在本地启动目标 JAR、collector 和 workbench。

## 发布

`site/traceboard/dist/` 已按正式 1.0.0 工作台重建并提交。Pages 工作流为手动触发（`workflow_dispatch`），只上传该目录，不会在普通代码提交时自动发布。

## 重新构建

正式仓库不包含旧 demo 应用和 fixture 源文件，静态站点由开发归档中的旧构建输入生成。维护者如需重建：

1. 从 [back 仓库](https://github.com/wdy-501/TomcatWorkflowDebuggingViewTool_back) 临时取回 demo、fixtures、站点源和构建脚本；
2. 构建工作台 `npm run build:site`；
3. 更新 `site/traceboard/dist/`；
4. 删除临时输入，保持主仓库正式结构。

**不要把旧测试应用重新提交到主仓库。**