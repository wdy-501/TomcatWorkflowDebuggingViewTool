# TraceBoard 站点（预置快照演示）

单页、无构建、无外部依赖的 TraceBoard 交互演示。

## 本地预览

```bash
(cd "site/traceboard" && python -m http.server 5180 --bind 127.0.0.1)
# http://127.0.0.1:5180/
```

交互：切换案例 A/B/L2、点击事实节点看详情、拖动/播放回放；案例 B 明确显示 fetchCount=0。
数据为 S6/S7/S8 验收快照，**不是实时 collector**；云端上传/沙箱未实现，不宣称线上服务。

## 发布状态

- 本地源码/预览/工作台：可用；`.TraceBoard.qoder.site` 已由设计工作台生成。
- Qoder Sites 云端 `prepare_site`：连续两次 `sites_unavailable`，未生成草稿/未发布；保留 actionId 供服务恢复后重试。
- 不伪造 `published: true`，不另建第二个站点。

## 文件

- `index.html`：页面与 Nudge 变量消费入口
- `assets/styles.css`：暗色仪表盘样式、响应式、reduced-motion
- `assets/app.js`：三案例数据、事实树、详情、回放
- `dist/`：准备发布的静态产物（`webDirectory=dist`）