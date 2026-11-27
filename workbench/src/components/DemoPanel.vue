<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  bindDemoFrame,
  demoBridge,
  unbindDemoFrame,
  type DemoResult,
} from "../demo/demo-bridge";
import { isStaticDemoMode } from "../demo/static-demo";
import { controlNameFor } from "../s4/labels";

const props = defineProps<{
  /** True when the page injected window.__TRACEBOARD_STATIC_DEMO__. */
  staticMode?: boolean;
}>();

const emit = defineEmits<{
  (event: "open-board"): void;
}>();

const frame = ref<HTMLIFrameElement | null>(null);

const staticMode = computed<boolean>(() => props.staticMode ?? isStaticDemoMode());

/**
 * Relative to the hosting page so both http://host:5173/ and the public
 * .../app/ mount serve the same build. Static mode gets the ?static=1 flag
 * that switches the demo to browser-side preset responses.
 */
const frameSrc = computed<string>(() => {
  const params = new URLSearchParams();
  if (staticMode.value) {
    params.set("static", "1");
  }
  const version = import.meta.env.VITE_DEMO_VERSION;
  if (typeof version === "string" && version !== "") {
    params.set("v", version);
  }
  const query = params.toString();
  return `./demo/index.html${query === "" ? "" : `?${query}`}`;
});

const result = computed<DemoResult | null>(() => demoBridge.lastResult);

const resolvedTraceId = computed<string | null>(() => {
  const current = result.value;
  return current !== null && current.status === "resolved" && current.traceId
    ? current.traceId
    : null;
});

/** Friendly button name for the pending case ("#btn-cancel" -> "取消订单"). */
const pendingControlName = computed<string | null>(() =>
  demoBridge.pendingCaseKey === null
    ? null
    : controlNameFor(demoBridge.pendingCaseKey)
);

const statusTone = computed<string>(() => {
  const current = result.value;
  if (demoBridge.pendingCaseKey !== null) {
    return "pending";
  }
  if (current === null) {
    return "idle";
  }
  if (current.status === "resolved") {
    return "ok";
  }
  return "error";
});

const statusText = computed<string>(() => {
  const pendingKey = demoBridge.pendingCaseKey;
  if (pendingKey !== null) {
    const name = pendingControlName.value;
    return (
      `已收到示例动作（${pendingKey}${name !== null ? ` · ${name}` : ""}），` +
      "正在等待采集入库并定位本次链路…"
    );
  }
  const current = result.value;
  if (current === null) {
    return "尚未收到示例动作：在下方示例页面点击任意示范按钮。";
  }
  if (current.status === "resolved") {
    return `已定位本次链路：${current.traceId ?? ""}`;
  }
  if (current.status === "timeout") {
    return (
      "等待超时：后端（8080）或采集器（8601）未启动，或请求尚未入库；" +
      "不会伪造链路，可在追踪台手动刷新。"
    );
  }
  return `定位失败：${current.message ?? "未知原因"}`;
});

function bindFrameWindow(): void {
  bindDemoFrame(frame.value?.contentWindow ?? null);
}

watch(
  () => demoBridge.lastResult,
  (result) => {
    if (result !== null && result.status === "resolved") {
      emit("open-board");
    }
  }
);

onMounted(bindFrameWindow);
onBeforeUnmount(unbindDemoFrame);
</script>

<template>
  <section id="demo-panel" class="demo-panel" aria-labelledby="demo-panel-title">
    <header class="demo-panel__header">
      <div>
        <h2 id="demo-panel-title" class="demo-panel__title">交互示例（BuggyShop）</h2>
        <p class="demo-panel__note">
          在下方示例页面点击按钮：请求经 <code>/demo/api</code> 或
          <code>/demo/ingest</code> 到达本地后端与采集器；动作完成后自动定位本次链路，
          可切到追踪台查看请求、控制器、服务、数据访问和结果。
        </p>
      </div>
      <a
        class="demo-panel__link"
        :href="frameSrc"
        target="_blank"
        rel="noopener noreferrer"
      >在新窗口打开</a>
    </header>

    <p v-if="staticMode" class="demo-panel__notice">
      公网静态演示：按钮返回预置响应，并在浏览器内追加一条“模拟请求”来克隆对应预置链路；
      不是真实采集，不会连接后端。清空只删除这些本地模拟记录，刷新页面恢复快照。
    </p>

    <p
      class="demo-panel__status"
      :class="`demo-panel__status--${statusTone}`"
      role="status"
      aria-live="polite"
    >
      <span>{{ statusText }}</span>
      <button
        v-if="resolvedTraceId !== null"
        type="button"
        class="s3-controls__button demo-panel__open-board"
        @click="emit('open-board')"
      >
        查看本次链路
      </button>
    </p>

    <iframe
      ref="frame"
      class="demo-panel__frame"
      :src="frameSrc"
      title="交互示例：BuggyShop"
      loading="eager"
      @load="bindFrameWindow"
    ></iframe>
  </section>
</template>