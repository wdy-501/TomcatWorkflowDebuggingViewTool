<script setup lang="ts">
import { onMounted, ref } from "vue";

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
    // Static success hint only after a successful (2xx) response.
    showSuccess.value = true;
    await loadOrders();
  } catch (cause) {
    cancelError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    pending.value = false;
  }
}

onMounted(loadOrders);
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>BuggyShop · 取消订单</h1>
      <p class="subtitle">S0 demo 骨架：无采集、无缺陷、无 SDK；接口经 Vite proxy <code>/api</code> 转发到 8080</p>
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
  </div>
</template>