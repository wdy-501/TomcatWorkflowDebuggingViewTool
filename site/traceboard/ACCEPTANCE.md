# TraceBoard 站点本地验收报告

> 日期：2026-11-24｜地址：`http://127.0.0.1:5180/`｜范围：仅本地静态演示，不部署、不运行 Java
> 结论：**PASS**。可以通知用户切换账号；当前账号不再尝试发布。

## 1. 检查结果

| 检查 | 结果 | 证据 |
|---|---|---|
| `/` | 200 text/html | Node fetch |
| `/assets/styles.css` | 200 text/css | Node fetch |
| `/assets/app.js` | 200 application/javascript | Node fetch |
| 静态包 | 200 application/gzip | `traceboard-site.tar.gz` |
| 案例 A | PASS | 标题“取消订单”、7 节点、SQL 详情 `rowsAffected 0`、订单说明可见 |
| 案例 B | PASS | 标题“纯前端校验”、3 节点、详情 `js_method`、callout“确认没发请求” |
| 案例 L2 | PASS | 标题“第二次调用写入坏值”、5 节点、详情 `service`、values 行可见 |
| 回放 | PASS | 滑到 2/5 显示 `40% · 2 / 5`，可见节点 2 个 |
| 节点切换 | PASS | A→SQL、B→js_method、L2→service 详情随案例更新 |
| 控制台错误 | PASS | 无 console 消息 |
| 外部依赖 | PASS | `index.html`/assets 无 `http(s)://`、CDN、`@import` |
| 源码/发布产物 | PASS | `index.html`、`app.js`、`styles.css` 与 `dist/` 逐字节一致 |
| 截图 | PASS | `site/traceboard/evidence/site-local-case-{a,b,l2}.png` |

真实浏览器点击过案例 B（不再依赖程序化事件）；截图已成功采集。

## 2. 边界（必须保留）

- 数据是 S6/S7/S8 验收快照，非实时 collector；无上传、无 Cookie、无外部资源。
- Qoder Sites 未发布；当前账号不执行 `prepare_site`/`publish_site`。
- GitHub/Release 按钮尚未添加（需要真实仓库 URL）。
- EXE 尚未构建；依赖 launcher `ui` + Temurin/jpackage。

## 3. 验收门

- **L1 本地验收：PASS**（本报告）。
- **L2 账号切换：WAITING**。用户切到有 Sites 能力的账号、重启 Qoder、确认 Sites 面板后，再用干净 action 发布；不复用旧账号的 project/site/action。
- **L3 公网发布：未开始**。

## 4. 复跑

```bash
(cd "site/traceboard" && python -m http.server 5180 --bind 127.0.0.1)
# 打开 http://127.0.0.1:5180/
# 依次点 取消订单 / 金额校验 / L2 行级，拖动回放，检查右侧详情
```

证据目录：`site/traceboard/evidence/`。