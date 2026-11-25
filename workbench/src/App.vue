<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useAppStore } from "./stores/app";
import FixturePanel from "./components/FixturePanel.vue";
import S1Panel from "./components/S1Panel.vue";
import S2Panel from "./components/S2Panel.vue";
import S3Panel from "./components/S3Panel.vue";
import DemoPanel from "./components/DemoPanel.vue";

type TabId = "demo" | "board";

const app = useAppStore();
const showLegacyPanels =
  new URLSearchParams(window.location.search).get("legacy") === "1";
const staticDemo = window.__TRACEBOARD_STATIC_DEMO__ !== undefined;

/** Packaged builds set VITE_ENABLE_DEMO=0 and ship without public/demo. */
const demoEnabled = import.meta.env.VITE_ENABLE_DEMO !== "0";

const TAB_HASH: Record<TabId, string> = { demo: "#demo", board: "#board" };

function tabFromHash(): TabId {
  return window.location.hash === TAB_HASH.board ? "board" : "demo";
}

/** 5173 is a single entry: the interactive demo tab is the default. */
const activeTab = ref<TabId>(demoEnabled ? tabFromHash() : "board");
const demoActive = computed<boolean>(() => demoEnabled && activeTab.value === "demo");
const boardVisible = computed<boolean>(() => !demoEnabled || activeTab.value === "board");

function writeHash(hash: string): void {
  // Keep ?v= / ?legacy=1 and only replace the fragment.
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(null, "", url);
}

function setTab(tab: TabId): void {
  if (!demoEnabled) {
    return;
  }
  activeTab.value = tab;
  const hash = TAB_HASH[tab];
  if (window.location.hash !== hash) {
    // replaceState keeps tab switches out of the back-button history.
    writeHash(hash);
  }
}

function showBoard(): void {
  setTab("board");
}

function onHashChange(): void {
  if (demoEnabled) {
    activeTab.value = tabFromHash();
  }
}

onMounted(() => {
  // Normalise the URL so a reload/bookmark keeps the selected tab.
  if (demoEnabled && window.location.hash !== TAB_HASH[activeTab.value]) {
    writeHash(TAB_HASH[activeTab.value]);
  }
  window.addEventListener("hashchange", onHashChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("hashchange", onHashChange);
});
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
        <template v-if="demoActive">
          交互示例：在示例页面点击按钮，请求发往本地后端（8080）与采集器（8601）；
          动作完成后自动定位本次链路。公网静态版使用预置响应与预置链路，不伪造采集。
        </template>
        <template v-else>
          从页面点击到 SQL 的只读追踪：点击起点、请求、控制器、服务、数据访问和结果。
          支持回放，不重发请求、不写数据库；界面为非实时刷新。
        </template>
      </p>
    </header>

    <nav v-if="demoEnabled" class="app-tabs" role="tablist" aria-label="视图切换">
      <button
        id="app-tab-demo"
        type="button"
        role="tab"
        class="app-tab"
        :class="{ 'app-tab--active': activeTab === 'demo' }"
        :aria-selected="activeTab === 'demo'"
        @click="setTab('demo')"
      >
        交互示例
      </button>
      <button
        id="app-tab-board"
        type="button"
        role="tab"
        class="app-tab"
        :class="{ 'app-tab--active': activeTab === 'board' }"
        :aria-selected="activeTab === 'board'"
        @click="setTab('board')"
      >
        追踪台
      </button>
    </nav>

    <!-- Both views stay mounted (v-show) so the iframe and board state survive. -->
    <DemoPanel
      v-if="demoEnabled"
      v-show="demoActive"
      :static-mode="staticDemo"
      @open-board="showBoard"
    />

    <S3Panel v-show="boardVisible" :active="boardVisible" />

    <template v-if="showLegacyPanels">
      <details v-show="boardVisible" class="secondary-panel">
        <summary class="secondary-panel__summary">
          S2 · 0 行事实链（历史演示，与当前请求无关）
        </summary>
        <p class="secondary-panel__note">
          读取独立会话的后端 0 行事实链，仅用于阶段回归，不属于最终产品界面。
        </p>
        <S2Panel />
      </details>

      <details v-show="boardVisible" class="secondary-panel">
        <summary class="secondary-panel__summary">S1 · 采集闭环演示（历史，假数据）</summary>
        <p class="secondary-panel__note">
          早期用假点击验证采集闭环，数据不是真实请求，仅用于阶段回归。
        </p>
        <S1Panel />
      </details>

      <details v-show="boardVisible" class="secondary-panel">
        <summary class="secondary-panel__summary">S0 · 数据契约样例（历史，静态）</summary>
        <p class="secondary-panel__note">
          静态 fixture 摘要，只展示数据形状，不是运行时事实。
        </p>
        <FixturePanel />
      </details>
    </template>
  </div>
</template>
