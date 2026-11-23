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

onMounted(loadOrders);
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>BuggyShop · S3 案例 A / 案例 B</h1>
      <p class="subtitle">
        S3 runtime SDK · 无构建插件/sourcemap（行号/局部变量属 S5，本次未采集）·
        案例 A 故意缺陷：取消返回 200，但数据库 UPDATE 0 行，订单仍为 CREATED ·
        案例 B 纯前端校验：无论通过与否都不发请求
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
  </div>
</template>
