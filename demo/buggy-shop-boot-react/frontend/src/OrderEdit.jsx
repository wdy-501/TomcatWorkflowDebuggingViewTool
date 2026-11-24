import { useEffect, useState } from "react";
import { uiEffect, wrapFn } from "./traceboard";

const CASE_B_ERROR_TEXT = "金额必须大于 0";
const CASE_B_PASS_TEXT = "校验通过（本案例不提交）";

/**
 * Case B validation body: pure front-end, never sends fetch/XHR.
 * Exported shape of the frozen front-end chain: click -> OrderEdit.jsx#validateForm -> render.
 */
function rawValidateForm(amountValue, onResult) {
  const raw = String(amountValue === undefined || amountValue === null ? "" : amountValue).trim();
  const numeric = Number(raw);
  if (raw.length === 0 || !Number.isFinite(numeric) || numeric <= 0) {
    if (typeof onResult === "function") {
      onResult(false, CASE_B_ERROR_TEXT);
    }
    uiEffect(CASE_B_ERROR_TEXT);
    return false;
  }
  if (typeof onResult === "function") {
    onResult(true, CASE_B_PASS_TEXT);
  }
  uiEffect(CASE_B_PASS_TEXT);
  return true;
}

// Module scope, wrapped exactly once. This module only imports from ./traceboard (never the SDK
// package directly), because ./traceboard initializes the SDK before this module evaluates.
const validateForm = wrapFn("validateForm", rawValidateForm);

export default function OrderEdit() {
  const [orderStatus, setOrderStatus] = useState("加载中…");
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [amount, setAmount] = useState("");
  const [bError, setBError] = useState(null);
  const [bPass, setBPass] = useState(null);

  // Initial list read: runs once on mount, outside any click and not wrapped by the SDK.
  // #order-status shows the real order 1 status from GET /api/orders (never hardcoded).
  useEffect(() => {
    let cancelled = false;

    async function loadInitialOrderStatus() {
      try {
        const response = await fetch("/api/orders");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const orders = payload && Array.isArray(payload.data) ? payload.data : [];
        const orderOne = orders.find((order) => order && order.id === 1);
        if (!cancelled) {
          setOrderStatus(orderOne && orderOne.status ? String(orderOne.status) : "加载失败");
        }
      } catch {
        if (!cancelled) {
          setOrderStatus("加载失败");
        }
      }
    }

    loadInitialOrderStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  // Case A: the only request is POST /api/orders/1/cancel (issued synchronously from this click
  // handler). A 2xx response shows #success-hint and declares the same UI effect. The order list
  // is deliberately NOT refreshed, so #order-status keeps the value read at mount.
  async function cancelOrder() {
    setCancelPending(true);
    setCancelError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/orders/1/cancel", { method: "POST" });
      if (!response.ok) {
        setCancelError(`HTTP ${response.status} ${response.statusText}`);
        return;
      }
      setSuccess(true);
      uiEffect("操作成功");
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCancelPending(false);
    }
  }

  function applyCaseBResult(ok, message) {
    if (ok) {
      setBError(null);
      setBPass(message);
    } else {
      setBPass(null);
      setBError(message);
    }
  }

  // Case B: click handler only calls the wrapped validateForm; no fetch/XHR, no submit.
  function saveB() {
    validateForm(amount, applyCaseBResult);
  }

  return (
    <div className="page">
      <header className="header">
        <h1>BuggyShop · S7 React 18 案例 A / 案例 B</h1>
        <p className="subtitle">
          TraceBoard 第二栈本地基础 demo：SDK 事件经 <code>/ingest</code> 代理发往 collector；
          业务请求经 <code>/api</code> 代理到复用的 Boot/H2 demo 后端（同源，无 CORS）。
        </p>
      </header>

      <section className="card">
        <h2>案例 A · 取消订单（有请求，0 行）</h2>
        <p className="hint">
          故意缺陷：<code>POST /api/orders/1/cancel</code> 返回 200，但数据库 UPDATE 影响 0 行，订单 1
          状态不变；取消成功后不刷新列表。
        </p>
        <p className="status-line">
          订单 1 状态：<strong id="order-status">{orderStatus}</strong>
        </p>
        <div className="actions">
          <button id="btn-cancel" type="button" disabled={cancelPending} onClick={cancelOrder}>
            取消订单
          </button>
        </div>
        {success && (
          <p id="success-hint">
            操作成功
          </p>
        )}
        {cancelError && <p id="cancel-error">取消失败：{cancelError}</p>}
      </section>

      <section id="case-b" className="card">
        <h2>案例 B · 纯前端校验（零请求）</h2>
        <p className="hint">
          金额校验全部在前端完成：空/非数字/≤0 显示错误，有效显示“校验通过”；两个分支都不提交，
          也不发 fetch/XHR。SDK 只记录控件身份、validateForm 返回值与声明的 UI 效果，不采集输入值。
        </p>
        <div className="form-row">
          <label htmlFor="amount-b">金额</label>
          <input
            id="amount-b"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="例如 100"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button id="btn-save-b" type="button" data-tb-fn="validateForm" onClick={saveB}>
            保存
          </button>
        </div>
        {bError && (
          <p id="b-error">
            {bError}
          </p>
        )}
        {bPass && (
          <p id="b-pass">
            {bPass}
          </p>
        )}
      </section>
    </div>
  );
}