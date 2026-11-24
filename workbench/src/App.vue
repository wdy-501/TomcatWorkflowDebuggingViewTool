<script setup lang="ts">
import { useAppStore } from "./stores/app";
import FixturePanel from "./components/FixturePanel.vue";
import S1Panel from "./components/S1Panel.vue";
import S2Panel from "./components/S2Panel.vue";
import S3Panel from "./components/S3Panel.vue";

const app = useAppStore();
const showLegacyPanels =
  new URLSearchParams(window.location.search).get("legacy") === "1";
const staticDemo = window.__TRACEBOARD_STATIC_DEMO__ !== undefined;
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__identity">
        <h1 class="app-header__title">TraceBoard</h1>
        <span class="app-header__version">v{{ app.appVersion }}</span>
        <span class="app-header__mode">
          {{ app.mode }}<template v-if="staticDemo"> · 静态示例</template>
        </span>
      </div>
      <p class="app-header__note">
        从页面点击到 SQL 的只读追踪：点击起点、请求、控制器、服务、数据访问和结果。
        支持回放，不重发请求、不写数据库；界面为非实时刷新。
      </p>
    </header>

    <S3Panel />

    <template v-if="showLegacyPanels">
      <details class="secondary-panel">
        <summary class="secondary-panel__summary">
          S2 · 0 行事实链（历史演示，与当前请求无关）
        </summary>
        <p class="secondary-panel__note">
          读取独立会话的后端 0 行事实链，仅用于阶段回归，不属于最终产品界面。
        </p>
        <S2Panel />
      </details>

      <details class="secondary-panel">
        <summary class="secondary-panel__summary">S1 · 采集闭环演示（历史，假数据）</summary>
        <p class="secondary-panel__note">
          早期用假点击验证采集闭环，数据不是真实请求，仅用于阶段回归。
        </p>
        <S1Panel />
      </details>

      <details class="secondary-panel">
        <summary class="secondary-panel__summary">S0 · 数据契约样例（历史，静态）</summary>
        <p class="secondary-panel__note">
          静态 fixture 摘要，只展示数据形状，不是运行时事实。
        </p>
        <FixturePanel />
      </details>
    </template>
  </div>
</template>
