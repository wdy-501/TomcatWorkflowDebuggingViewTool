<script setup lang="ts">
import { onMounted, ref } from "vue";
import { traceboard } from "./traceboard";

interface Order {
  id: number;
  orderNo: string;
  status: string;
  amount: number;
}

interface OrdersEnvelope {
  data?: Order[];
}

const orders = ref<Order[]>([]);
const ordersError = ref<string | null>(null);
const rawJson = ref("");
const cancelError = ref<string | null>(null);
const showSuccess = ref(false);
const pending = ref(false);

// Case B (pure front-end validation, zero requests). The amount value is never collected.
const amountB = ref("");
const caseBError = ref<string | null>(null);
const caseBPass = ref<string | null>(null);

// Case L1 (fixed-URL discount preview). demoSecret=s3cr3t is a fake demo value; the agent
// redacts it in the collected event. The note is a fixed 3000-char string (truncated server-side).
const discountRaw = ref("");
const discountStatus = ref<string | null>(null);
const discountError = ref<string | null>(null);
const discountPending = ref(false);

// S6a L2 demo: fixed URL, plain click handler (no wrapFn). The agent (not the SDK) collects the
// line-level local of L2DemoService#reconcileAmount; the button never refreshes the order list.
const reconcileRaw = ref("");
const reconcileStatus = ref<string | null>(null);
const reconcileError = ref<string | null>(null);
const reconcilePending = ref(false);

// S6b async demo: the per-request single-thread pool lives inside L2DemoService#reconcileAsync.
// The child thread inherits the controller context; the button is a plain click handler (no
// wrapFn) and never refreshes the order list.
const reconcileAsyncRaw = ref("");
const reconcileAsyncStatus = ref<string | null>(null);
const reconcileAsyncError = ref<string | null>(null);
const reconcileAsyncPending = ref(false);

// S6b loop demo: times=100 is folded in the agent (20 retained of ~102) but the real return is 50.
const reconcileLoopRaw = ref("");
const reconcileLoopStatus = ref<string | null>(null);
const reconcileLoopError = ref<string | null>(null);
const reconcileLoopPending = ref(false);

async function loadOrders(): Promise<void> {
  try {
    const response = await fetch("/api/orders");
    const text = await response.text();
    if (!response.ok) {
      ordersError.value = `HTTP ${response.status} ${response.statusText}`;
      return;
    }
    const payload = JSON.parse(text) as OrdersEnvelope;
    orders.value = payload.data ?? [];
    ordersError.value = null;
  } catch (cause) {
    ordersError.value = cause instanceof Error ? cause.message : String(cause);
  }
}

async function cancelOrder(): Promise<void> {
  pending.value = true;
  showSuccess.value = false;
  try {
    const response = await fetch("/api/orders/1/cancel", { method: "POST" });
    rawJson.value = await response.text();
    if (!response.ok) {
      cancelError.value = `HTTP ${response.status} ${response.statusText}`;
      return;
    }
    cancelError.value = null;
    // Case A behavior is unchanged: only a 2xx response shows the success hint.
    showSuccess.value = true;
    // S3: declare the user-visible DOM effect for the SDK (same position as the toast).
    traceboard.uiEffect("操作成功");
    // Its GET /api/orders refresh may be captured inside the same click window; that is an
    // honest extra fetch node and does not downgrade the POST fetch -> controller EXACT link.
    await loadOrders();
  } catch (cause) {
    cancelError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    pending.value = false;
  }
}

// Case B: validateForm is the only function wrapped by the SDK (the frozen 3-event shape:
// click root -> OrderEdit.vue#validateForm -> render). saveB itself is plain click handling.
function rawValidateForm(): boolean {
  const raw = String(amountB.value).trim();
  const amount = Number(raw);
  if (raw.length === 0 || !Number.isFinite(amount) || amount <= 0) {
    caseBPass.value = null;
    caseBError.value = "金额必须大于 0";
    traceboard.uiEffect("金额必须大于 0");
    return false;
  }
  caseBError.value = null;
  caseBPass.value = "校验通过（本案例不提交）";
  traceboard.uiEffect("校验通过（本案例不提交）");
  return true;
}

const validateForm = traceboard.wrapFn("validateForm", rawValidateForm);

function saveB(): void {
  // No fetch/XHR here: this case never submits to the backend.
  validateForm();
}

// Case L1: fixed-URL discount preview. `previewDiscount` is a plain declaration (manifest R1 hit);
// the wrapped alias emits the js_method span whose `source` comes from the build manifest
// (`SOURCE_MAPPED`). The button also carries `data-tb-fn` so the click root gets the same source.
// No loadOrders(): the service mutates the in-memory object only, so the DB amount stays 100.00.
async function previewDiscount(): Promise<void> {
  discountPending.value = true;
  discountError.value = null;
  try {
    const note = "x".repeat(3000);
    const url =
      `/api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t` +
      `&note=${encodeURIComponent(note)}`;
    const response = await fetch(url, { method: "POST" });
    const text = await response.text();
    discountRaw.value = text;
    discountStatus.value = `HTTP ${response.status}`;
    if (!response.ok) {
      discountError.value = `HTTP ${response.status} ${response.statusText}`;
      return;
    }
    discountError.value = null;
  } catch (cause) {
    discountError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    discountPending.value = false;
  }
}

const previewDiscountWrapped = traceboard.wrapFn("previewDiscount", previewDiscount);

// Case S6a: fixed-URL reconcile. Plain click handling (NOT wrapped by the SDK): the line-level L2
// facts come from the agent's probes inside L2DemoService#reconcileAmount. No loadOrders(), no DB.
// Stable DOM selectors for the e2e suites: #btn-reconcile, #btn-reconcile-async, #btn-reconcile-loop.
async function reconcile(): Promise<void> {
  reconcilePending.value = true;
  reconcileError.value = null;
  try {
    const response = await fetch("/api/orders/1/reconcile", { method: "POST" });
    const text = await response.text();
    reconcileRaw.value = text;
    reconcileStatus.value = `HTTP ${response.status}`;
    if (!response.ok) {
      reconcileError.value = `HTTP ${response.status} ${response.statusText}`;
      return;
    }
    reconcileError.value = null;
  } catch (cause) {
    reconcileError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    reconcilePending.value = false;
  }
}

// Case S6b async: plain click handling (NOT wrapped by the SDK). The agent inherits the request
// context into the per-request single worker thread (flag ASYNC_INHERITED); no loadOrders(), no DB.
async function reconcileAsync(): Promise<void> {
  reconcileAsyncPending.value = true;
  reconcileAsyncError.value = null;
  try {
    const response = await fetch("/api/orders/1/reconcile-async", { method: "POST" });
    const text = await response.text();
    reconcileAsyncRaw.value = text;
    reconcileAsyncStatus.value = `HTTP ${response.status}`;
    if (!response.ok) {
      reconcileAsyncError.value = `HTTP ${response.status} ${response.statusText}`;
      return;
    }
    reconcileAsyncError.value = null;
  } catch (cause) {
    reconcileAsyncError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    reconcileAsyncPending.value = false;
  }
}

// Case S6b loop: 100 iterations -> ~102 observed values folded to 20 in the agent span; the real
// response stays {"data":50.0}. Plain click handling, no loadOrders(), no DB.
async function reconcileLoop(): Promise<void> {
  reconcileLoopPending.value = true;
  reconcileLoopError.value = null;
  try {
    const response = await fetch("/api/orders/1/reconcile-loop?times=100", { method: "POST" });
    const text = await response.text();
    reconcileLoopRaw.value = text;
    reconcileLoopStatus.value = `HTTP ${response.status}`;
    if (!response.ok) {
      reconcileLoopError.value = `HTTP ${response.status} ${response.statusText}`;
      return;
    }
    reconcileLoopError.value = null;
  } catch (cause) {
    reconcileLoopError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    reconcileLoopPending.value = false;
  }
}

onMounted(loadOrders);
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>BuggyShop · S5 案例 A / 案例 B / L1 · S6 L2</h1>
      <p class="subtitle">
        S6：L2 行级（reconcileAmount）、异步继承（reconcileAsync）、无调试信息（NoDebugService#compute，NOT_COLLECTED_NO_DEBUG_INFO）、循环折叠（reconcileLoop）；长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持 ·
        案例 A 故意缺陷：取消返回 200，但数据库 UPDATE 0 行，订单仍为 CREATED ·
        案例 B 纯前端校验：无论通过与否都不发请求 ·
        案例 L1：折扣预览按钮由 agent 采集参数/字段写入/返回（仅内存，DB 金额不变）
      </p>
      <p class="subtitle">
        SDK 事件经 <code>/ingest</code> 代理发往 TraceBoard collector；
        业务接口经 <code>/api</code> 代理到 demo 后端（dev 与 preview 均同源转发，无 CORS）
      </p>
    </header>

    <section class="card">
      <h2>订单列表</h2>
      <p v-if="ordersError" class="error">加载订单失败：{{ ordersError }}</p>
      <p v-else-if="orders.length === 0" class="empty">暂无订单（或后端未启动）</p>
      <table v-else class="order-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">订单号</th>
            <th scope="col">状态</th>
            <th scope="col">金额</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>{{ order.id }}</td>
            <td><code>{{ order.orderNo }}</code></td>
            <td>{{ order.status }}</td>
            <td>{{ order.amount }}</td>
          </tr>
        </tbody>
      </table>

      <div class="actions">
        <button id="btn-cancel" type="button" :disabled="pending" @click="cancelOrder">
          {{ pending ? "提交中…" : "取消订单" }}
        </button>
      </div>
    </section>

    <section class="card">
      <h2>原始响应</h2>
      <pre id="raw-json">{{ rawJson || "（尚未发送取消请求）" }}</pre>
      <p v-if="cancelError" id="error-text" class="error">{{ cancelError }}</p>
      <p v-if="showSuccess" id="success-hint" class="toast">操作成功</p>
    </section>

    <section id="case-b" class="card">
      <h2>案例 B · 纯前端校验（零请求）</h2>
      <p class="hint">
        金额校验全部在前端完成：空/非数字/&lt;=0 显示错误，有效显示“校验通过”；两个分支都不提交，也不发 fetch/XHR。
        SDK 不采集输入值（隐私），只记录控件身份、校验函数返回值与声明的 DOM 效果。
      </p>
      <div class="form-row">
        <label for="amount-b">金额</label>
        <input id="amount-b" v-model="amountB" type="number" step="0.01" placeholder="例如 100" />
        <button id="btn-save-b" type="button" @click="saveB">保存</button>
      </div>
      <p v-if="caseBError" id="b-error" class="error">{{ caseBError }}</p>
      <p v-else-if="caseBPass" id="b-pass" class="toast">{{ caseBPass }}</p>
    </section>

    <section id="case-l1" class="card">
      <h2>案例 L1 · 折扣预览（参数/字段写入/返回）</h2>
      <p class="hint">
        固定请求 <code>POST /api/orders/1/preview-discount</code>：requestedAmount=100、demoSecret=s3cr3t（演示假值，事件中脱敏为占位符）、
        note=3000 个 x（事件中截断到 2KB）。按钮只调用 previewDiscount，不刷新订单列表：仅内存返回 0、数据库金额未改。
        SDK 的 click/js_method 事件带 manifest 映射的函数/文件/行号（SDK 不采集局部变量；L2 由 agent 在 L2DemoService#reconcileAmount/reconcileLoop 采集）。
      </p>
      <div class="actions">
        <button
          id="btn-discount"
          type="button"
          data-tb-fn="previewDiscount"
          :disabled="discountPending"
          @click="previewDiscountWrapped"
        >
          {{ discountPending ? "请求中…" : "折扣预览" }}
        </button>
      </div>
      <p v-if="discountStatus" id="discount-status" class="hint">状态：{{ discountStatus }}</p>
      <pre id="discount-json">{{ discountRaw || "（尚未发送折扣预览请求）" }}</pre>
      <p v-if="discountError" id="discount-error" class="error">{{ discountError }}</p>
    </section>

    <section id="case-s6a" class="card">
      <h2>案例 S6a · 逐次对账（行级局部变量 L2）</h2>
      <p class="hint">
        固定请求 <code>POST /api/orders/1/reconcile</code>：L2DemoService#reconcileBatch 循环 3 次调用 reconcileAmount，
        逐次调用 100/0/100（第 2 次为坏值）。agent 仅对 L2DemoService#reconcileAmount 做行级局部变量探针，
        第 2 次调用可看到 local 100 → 0；reconcileBatch 不插桩。纯计算、无 DB 写入，按钮不刷新订单列表。
      </p>
      <div class="actions">
        <button id="btn-reconcile" type="button" :disabled="reconcilePending" @click="reconcile">
          {{ reconcilePending ? "请求中…" : "逐次对账" }}
        </button>
      </div>
      <p v-if="reconcileStatus" id="reconcile-status" class="hint">状态：{{ reconcileStatus }}</p>
      <pre id="reconcile-json">{{ reconcileRaw || "（尚未发送对账请求）" }}</pre>
      <p v-if="reconcileError" id="reconcile-error" class="error">{{ reconcileError }}</p>
    </section>

    <section id="case-s6b-async" class="card">
      <h2>案例 S6b · 异步对账（创建时继承上下文）</h2>
      <p class="hint">
        固定请求 <code>POST /api/orders/1/reconcile-async</code>：L2DemoService#reconcileAsync 在请求线程内创建
        per-request 单线程池，顺序调用 reconcileAmount 三次（100/0/100）。子线程只在创建时继承 controller 上下文
        （flag ASYNC_INHERITED，三个 service span 同一子线程、父 span 为 controller）；长生命周期/已存在线程池不自动传播。
        纯计算、无 DB 写入，按钮不刷新订单列表。
      </p>
      <div class="actions">
        <button id="btn-reconcile-async" type="button" :disabled="reconcileAsyncPending" @click="reconcileAsync">
          {{ reconcileAsyncPending ? "请求中…" : "异步对账" }}
        </button>
      </div>
      <p v-if="reconcileAsyncStatus" id="reconcile-async-status" class="hint">状态：{{ reconcileAsyncStatus }}</p>
      <pre id="reconcile-async-json">{{ reconcileAsyncRaw || "（尚未发送异步对账请求）" }}</pre>
      <p v-if="reconcileAsyncError" id="reconcile-async-error" class="error">{{ reconcileAsyncError }}</p>
    </section>

    <section id="case-s6b-loop" class="card">
      <h2>案例 S6b · 循环折叠（values 20 项 + 计数可见）</h2>
      <p class="hint">
        固定请求 <code>POST /api/orders/1/reconcile-loop?times=100</code>：reconcileLoop 每轮 local+1，i==50 时置 0，
        返回 50.0。agent 观测约 102 次值变化，按前 6 + 后 6 + 中段样本折叠为 20 项（坏值 50 → 0 保留），
        事件 status=TRUNCATED 且 VALUES_CAPPED/VALUES_TOTAL 可见；无静默丢弃。纯计算、无 DB 写入。
        无调试端点 <code>POST /api/orders/1/no-debug</code> 仅端点演示（NoDebugService#compute 无 LocalVariableTable，
        状态 NOT_COLLECTED_NO_DEBUG_INFO，不猜变量名/行号）。
      </p>
      <div class="actions">
        <button id="btn-reconcile-loop" type="button" :disabled="reconcileLoopPending" @click="reconcileLoop">
          {{ reconcileLoopPending ? "请求中…" : "循环对账" }}
        </button>
      </div>
      <p v-if="reconcileLoopStatus" id="reconcile-loop-status" class="hint">状态：{{ reconcileLoopStatus }}</p>
      <pre id="reconcile-loop-json">{{ reconcileLoopRaw || "（尚未发送循环对账请求）" }}</pre>
      <p v-if="reconcileLoopError" id="reconcile-loop-error" class="error">{{ reconcileLoopError }}</p>
    </section>
  </div>
</template>
