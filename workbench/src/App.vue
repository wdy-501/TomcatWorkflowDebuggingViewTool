<script setup lang="ts">
import { useAppStore } from "./stores/app";
import FixturePanel from "./components/FixturePanel.vue";
import S1Panel from "./components/S1Panel.vue";
import S2Panel from "./components/S2Panel.vue";

const app = useAppStore();
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__identity">
        <h1 class="app-header__title">TraceBoard</h1>
        <span class="app-header__version">v{{ app.appVersion }}</span>
        <span class="app-header__mode">{{ app.mode }}</span>
      </div>
      <p class="app-header__note">
        S2 · 后端 0 行事实链（controller → service → mapper → SQL）· 只读派生 · 中性事实摘要（不是缺陷结论）
      </p>
    </header>

    <S2Panel />

    <details class="secondary-panel">
      <summary class="secondary-panel__summary">S1 walking skeleton（假数据，非 S2 事实链）</summary>
      <p class="secondary-panel__note">
        以下是 S1 的假前端事件 → ingest → 读回演示，与 S2 的 agent 4-span 链无关联，不可当作同一请求。
      </p>
      <S1Panel />
    </details>

    <FixturePanel />
  </div>
</template>
