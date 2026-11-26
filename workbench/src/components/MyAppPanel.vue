<script setup lang="ts">
defineProps<{
  appUrl: string;
}>();

const emit = defineEmits<{
  (event: "open-board"): void;
}>();
</script>

<template>
  <section id="my-app-panel" class="demo-panel" aria-labelledby="my-app-panel-title">
    <header class="demo-panel__header">
      <div>
        <h2 id="my-app-panel-title" class="demo-panel__title">我的应用</h2>
        <p class="demo-panel__note">
          这是本次 <code>TraceBoard run --jar</code> 启动的 JAR 服务。你在应用里的操作由 agent 采集；
          切到「追踪台」查看最新会话的请求、方法、SQL 和参数/返回值。
        </p>
      </div>
      <a
        class="demo-panel__link"
        :href="appUrl"
        target="_blank"
        rel="noopener noreferrer"
      >在新窗口打开应用</a>
    </header>

    <p class="demo-panel__notice">
      内嵌服务：<code>{{ appUrl }}</code>。应用需要提供 HTML 页面；若应用设置了
      <code>X-Frame-Options</code>，请使用“在新窗口打开应用”。
    </p>

    <p class="demo-panel__status demo-panel__status--ok" role="status">
      <span>应用由你启动，TraceBoard 会自动选择最新会话。</span>
      <button
        type="button"
        class="s3-controls__button demo-panel__open-board"
        @click="emit('open-board')"
      >
        查看追踪台
      </button>
    </p>

    <iframe
      class="demo-panel__frame"
      :src="appUrl"
      title="我的应用"
      loading="eager"
    ></iframe>
  </section>
</template>