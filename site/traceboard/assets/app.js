(() => {
  "use strict";

  const cases = [
    {
      id: "a",
      name: "取消订单",
      meta: "7 事件 · 4 后端 span",
      tag: "OK",
      tagClass: "tag-ok",
      source: "CASE A · SPRING BOOT 2.7 + VUE 3",
      title: "取消订单",
      sub: "HTTP 200，但数据库 UPDATE 0 行。",
      metrics: [["span", 7], ["fetch", 1], ["backend", 4], ["sql", "0 行"]],
      callout: ["0 行事实", "service 返回 true，SQL rowsAffected=0；订单仍是 CREATED。"],
      why: "HTTP 200 和 service=true 都不等于数据库成功。rowsAffected=0 是把“看起来取消成功”拆开后的第一个分歧点。",
      defaultNode: 5,
      nodes: [
        { kind: "ui_event", name: "#btn-cancel", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "browser-main #0", source: "点击根 · capture 阶段", ret: "未采集（无返回摘要）", flags: ["SDK_ACTIVE", "S3_RUNTIME_SDK", "OBSERVE_MS=1500"], meta: "relNs 0 · dur 20.60 ms" },
        { kind: "fetch", name: "POST /api/orders/1/cancel", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "browser-main #0", source: "同源请求 · 带 traceparent", ret: "http = 200", flags: ["SDK_ACTIVE"], meta: "relNs 700 µs · dur 18.90 ms" },
        { kind: "controller", name: "OrderController#cancel", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "http-nio-8080-exec-4 #38", source: { file: "OrderController.java", line: 54 }, ret: "ResponseEntity = 200", flags: ["S3_EXACT_LINK", "S2_ZERO_ROW_CHAIN", "DROP_COUNT=0"], meta: "relNs 7.34 ms · dur 7.82 ms" },
        { kind: "service", name: "OrderService#cancel", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "http-nio-8080-exec-4 #38", source: { file: "OrderService.java", line: 35 }, ret: "boolean = true", flags: ["S2_ZERO_ROW_CHAIN", "DROP_COUNT=0"], meta: "relNs 8.17 ms · dur 6.24 ms" },
        { kind: "mapper", name: "OrderMapper#cancelById", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "http-nio-8080-exec-4 #38", source: { file: "MapperProxy.java", line: 88 }, ret: "int = 0", flags: ["S2_ZERO_ROW_CHAIN", "DROP_COUNT=0"], meta: "relNs 12.36 ms · dur 1.96 ms" },
        { kind: "sql", name: "OrderMapper.cancelById", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "http-nio-8080-exec-4 #38", source: { file: "PreparedStatementHandler.java", line: 53 }, ret: "未采集（无返回摘要）", flags: ["S2_ZERO_ROW_CHAIN", "DROP_COUNT=0"], sideEffects: "sql · cancelById · rowsAffected 0 · transaction UNKNOWN", meta: "relNs 13.66 ms · dur 423.70 µs" },
        { kind: "render", name: "ui_effect:操作成功", status: "OK", statusClass: "st-render", confidence: "EXACT", thread: "browser-main #0", source: "声明的 UI 效果", ret: "ui_effect = 操作成功", flags: ["SDK_ACTIVE"], meta: "relNs 20.60 ms" }
      ]
    },
    {
      id: "b",
      name: "金额校验",
      meta: "3 事件 · 零请求",
      tag: "RETURNED_FALSE",
      tagClass: "tag-false",
      source: "CASE B · REACT 18 + WEBPACK 5",
      title: "纯前端校验",
      sub: "观察窗关闭后，本次点击因果链内没有网络请求。",
      metrics: [["span", 3], ["fetch", 0], ["backend", 0], ["判断", "没发"]],
      callout: ["确认没发请求", "SDK 在线；OBSERVE_MS=1500 已关闭；fetch/XHR=0；backend span=0。"],
      why: "“页面上看起来没发”不是证据。需要 JS 方法事实、点击根、观察窗关闭且 fetchCount=0，才能说这次点击没有发请求。",
      defaultNode: 1,
      nodes: [
        { kind: "ui_event", name: "#btn-save-b", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "browser-main #0", source: "点击根 · capture 阶段", ret: "未采集（无返回摘要）", flags: ["SDK_ACTIVE", "S3_RUNTIME_SDK", "OBSERVE_MS=1500"], meta: "relNs 0 · dur 300 µs" },
        { kind: "js_method", name: "OrderEdit.jsx#validateForm", status: "RETURNED_FALSE", statusClass: "st-false", confidence: "EXACT", thread: "browser-main #0", source: "appName#function（无源码行映射）", ret: "boolean = false", flags: ["SDK_ACTIVE"], values: [{ name: "return", old: "—", now: "false", line: "—", note: "正常返回 false" }], meta: "relNs 199.94 µs · dur 100 µs" },
        { kind: "render", name: "ui_effect:金额必须大于 0", status: "OK", statusClass: "st-render", confidence: "EXACT", thread: "browser-main #0", source: "声明的 UI 效果", ret: "ui_effect = 金额必须大于 0", flags: ["SDK_ACTIVE"], meta: "relNs 199.94 µs" }
      ]
    },
    {
      id: "c",
      name: "L2 行级",
      meta: "5 事件 · local 100→0",
      tag: "L2",
      tagClass: "tag-l2",
      source: "CASE L2 · SPRING BOOT 2.7 + VUE 3",
      title: "第二次调用写入坏值",
      sub: "最终返回值看起来正常，中间局部变量已经变成 0。",
      metrics: [["span", 5], ["local", "100→0"], ["loop", "折叠"], ["line", 23]],
      callout: ["行级分歧点", "第 2 次调用在行 23 把 local 从 100 改为 0；第 3 次又回到 100。"],
      why: "只看最终返回会漏掉中间污染。L2 行级值把“第几次调用、哪一行、旧值→新值”保留为主事实；循环只保留样本并标 TRUNCATED。",
      defaultNode: 3,
      nodes: [
        { kind: "ui_event", name: "#btn-reconcile", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "browser-main #0", source: "点击根 · capture 阶段", ret: "未采集（无返回摘要）", flags: ["SDK_ACTIVE", "OBSERVE_MS=1500"], meta: "relNs 0" },
        { kind: "fetch", name: "POST /api/orders/1/reconcile", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "browser-main #0", source: "同源请求", ret: "http = 200", flags: ["SDK_ACTIVE"], meta: "relNs 0.4 ms" },
        { kind: "controller", name: "OrderController#reconcile", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "http-nio-8080-exec-4 #42", source: { file: "OrderController.java", line: 83 }, ret: "ResponseEntity = 200", flags: ["S3_EXACT_LINK"], meta: "relNs 4.8 ms" },
        { kind: "service", name: "L2DemoService#reconcileAmount", status: "OK", statusClass: "st-ok", confidence: "EXACT", thread: "http-nio-8080-exec-4 #42", source: { file: "L2DemoService.java", line: 23 }, ret: "double = 0.0", flags: ["L2", "ASYNC_INHERITED"], values: [{ name: "local", old: "100", now: "0", line: "23", note: "第 2 次调用 · invocation=2" }, { name: "local", old: "0", now: "100", line: "25", note: "第 3 次调用恢复" }], meta: "relNs 5.6 ms" },
        { kind: "render", name: "ui_effect:第2次调用 local=0", status: "OK", statusClass: "st-render", confidence: "EXACT", thread: "browser-main #0", source: "声明的 UI 效果", ret: "ui_effect = 第2次调用 local=0", flags: ["SDK_ACTIVE"], meta: "relNs 8.2 ms" }
      ]
    }
  ];

  const state = { caseId: "a", selected: 0, visible: 0, playTimer: null };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const current = () => cases.find((item) => item.id === state.caseId);
  const sourceText = (source) => (typeof source === "string" ? source : source ? `${source.file}:${source.line}` : "未采集");
  const statusText = (node) => node.status;

  function renderRequestList() {
    $("request-list").innerHTML = cases.map((item) => `
      <button class="request" type="button" data-case="${item.id}" aria-pressed="${item.id === state.caseId}">
        <span class="request-top"><span class="request-name">${esc(item.name)}</span><span class="tag ${item.tagClass}">${esc(item.tag)}</span></span>
        <span class="request-meta">${esc(item.meta)}</span>
      </button>`).join("");
    $("request-list").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectCase(button.dataset.case));
    });
  }

  function renderHeader() {
    const item = current();
    $("trace-source").textContent = item.source;
    $("trace-title").textContent = item.title;
    $("trace-sub").textContent = item.sub;
    $("trace-badges").innerHTML = item.metrics.map(([label, value]) => `<span class="metric">${esc(label)} <b>${esc(value)}</b></span>`).join("");
    $("callout-title").textContent = item.callout[0];
    $("callout-copy").textContent = item.callout[1];
    $("why-copy").textContent = item.why;
    $("replay").max = String(item.nodes.length);
    $("replay").min = "1";
  }

  function renderNodes() {
    const item = current();
    $("nodes").innerHTML = item.nodes.map((node, index) => {
      const visible = index < state.visible ? " visible" : "";
      const pressed = index === state.selected ? "true" : "false";
      return `<li class="node${visible}" data-index="${index}">
        <button class="node-btn" type="button" data-node="${index}" aria-pressed="${pressed}">
          <span class="node-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="node-main">
            <span class="node-top"><span class="node-kind">${esc(node.kind)}</span><span class="node-name">${esc(node.name)}</span></span>
            <span class="node-meta">${esc(node.thread)} · ${esc(node.meta)}</span>
          </span>
          <span class="node-side"><span class="node-status ${node.statusClass}">${esc(statusText(node))}</span><span class="conf">${esc(node.confidence)}</span></span>
        </button>
      </li>`;
    }).join("");
    $("nodes").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectNode(Number(button.dataset.node)));
    });
  }

  function fact(label, value, className = "") {
    return `<div class="fact"><dt>${esc(label)}</dt><dd class="${className}">${esc(value)}</dd></div>`;
  }

  function renderDetail() {
    const item = current();
    const node = item.nodes[state.selected] || item.nodes[0];
    $("detail-kind").textContent = node.kind;
    $("detail-key").textContent = node.name;
    $("detail-confidence").textContent = node.confidence;
    const rows = [];
    rows.push(fact("status", node.status, node.status === "RETURNED_FALSE" ? "zero" : ""));
    rows.push(fact("thread", node.thread));
    rows.push(fact("source", sourceText(node.source)));
    rows.push(fact("return", node.ret));
    rows.push(fact("flags", (node.flags || []).join(" · ") || "无"));
    if (node.sideEffects) rows.push(fact("sideEffects", node.sideEffects, "zero"));
    $("facts").innerHTML = rows.join("");
    const valuesWrap = $("values-wrap");
    if (node.values && node.values.length) {
      valuesWrap.hidden = false;
      $("values").innerHTML = node.values.map((value) => `<div class="value-row"><span>${esc(value.name)} <small>${esc(value.note || "")}</small></span><span>${esc(value.old)}</span><span>${esc(value.now)}</span></div>`).join("");
    } else {
      valuesWrap.hidden = true;
      $("values").innerHTML = "";
    }
    $("announcer").textContent = `已选择 ${node.kind} ${node.name}，状态 ${node.status}，置信度 ${node.confidence}`;
  }

  function renderReplay() {
    const total = current().nodes.length;
    const percent = Math.round((state.visible / total) * 100);
    $("replay").value = String(state.visible);
    $("replay-label").textContent = `${percent}% · ${state.visible} / ${total}`;
    document.querySelectorAll("#nodes .node").forEach((node, index) => {
      node.classList.toggle("visible", index < state.visible);
    });
  }

  function selectNode(index) {
    const item = current();
    if (index < 0 || index >= item.nodes.length) return;
    if (index >= state.visible) {
      state.visible = index + 1;
      renderReplay();
    }
    state.selected = index;
    $("nodes").querySelectorAll(".node-btn").forEach((button, i) => {
      button.setAttribute("aria-pressed", i === state.selected ? "true" : "false");
    });
    renderDetail();
  }

  function setVisible(count) {
    const total = current().nodes.length;
    state.visible = Math.max(1, Math.min(total, count));
    renderReplay();
    if (state.selected >= state.visible) state.selected = state.visible - 1;
    renderNodes();
    renderDetail();
  }

  function stopPlay() {
    if (state.playTimer) { clearInterval(state.playTimer); state.playTimer = null; }
    $("play").setAttribute("aria-pressed", "false");
    $("play").textContent = "播放";
  }

  function togglePlay() {
    if (state.playTimer) { stopPlay(); return; }
    if (state.visible >= current().nodes.length) setVisible(1);
    $("play").setAttribute("aria-pressed", "true");
    $("play").textContent = "暂停";
    state.playTimer = setInterval(() => {
      if (state.visible >= current().nodes.length) { stopPlay(); return; }
      setVisible(state.visible + 1);
      state.selected = state.visible - 1;
      renderNodes();
      renderDetail();
    }, 900);
  }

  function selectCase(id) {
    stopPlay();
    const item = cases.find((candidate) => candidate.id === id);
    if (!item) return;
    state.caseId = id;
    state.visible = item.nodes.length;
    state.selected = item.defaultNode;
    renderRequestList();
    renderHeader();
    renderNodes();
    renderReplay();
    renderDetail();
    $("replay").focus({ preventScroll: true });
  }

  $("prev").addEventListener("click", () => { stopPlay(); setVisible(state.visible - 1); });
  $("next").addEventListener("click", () => { stopPlay(); setVisible(state.visible + 1); });
  $("play").addEventListener("click", togglePlay);
  $("replay").addEventListener("input", (event) => { stopPlay(); setVisible(Number(event.target.value)); });

  renderRequestList();
  state.visible = current().nodes.length;
  state.selected = current().defaultNode;
  renderHeader();
  renderNodes();
  renderReplay();
  renderDetail();
})();