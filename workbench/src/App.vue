<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useAppStore } from "./stores/app";
import { resolveS3Session } from "./stores/s3";
import S3Panel from "./components/S3Panel.vue";
import DemoPanel from "./components/DemoPanel.vue";
import MyAppPanel from "./components/MyAppPanel.vue";

type TabId = "demo" | "app" | "board";

const app = useAppStore();
const staticDemo = window.__TRACEBOARD_STATIC_DEMO__ !== undefined;

/** Only the static showcase build enables the demo; normal/package builds stay generic-only. */
const demoEnabled = import.meta.env.VITE_ENABLE_DEMO === "1";

function normalizeAppUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return null;
  }
  try {
    const url = new URL(raw);
    const host = url.hostname;
    const loopback =
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "[::1]" ||
      host.startsWith("127.");
    if ((url.protocol === "http:" || url.protocol === "https:") && loopback) {
      return url.toString();
    }
  } catch {
    // invalid app URL must not break the workbench
  }
  return null;
}

/** `TraceBoard run --jar` passes the user's service URL as ?app=... . */
function resolveEmbeddedAppUrl(): string | null {
  return normalizeAppUrl(new URLSearchParams(window.location.search).get("app"));
}

/**
 * The Java UI server used by `TraceBoard run` injects this before the app bundle.
 * It makes a plain http://127.0.0.1:5173/#board work without an ?app= suffix.
 */
function resolveRuntimeAppUrl(): string | null {
  const runtime = (window as unknown as { __TRACEBOARD_RUNTIME_APP__?: string })
    .__TRACEBOARD_RUNTIME_APP__;
  return normalizeAppUrl(runtime);
}

const appUrl = resolveEmbeddedAppUrl() ?? resolveRuntimeAppUrl();
const appMode = appUrl !== null;
const tabsEnabled = appMode || demoEnabled;
const urlSession = resolveS3Session().fromUrl;

const TAB_HASH: Record<TabId, string> = {
  demo: "#demo",
  app: "#app",
  board: "#board",
};

function tabFromHash(): TabId {
  if (window.location.hash === TAB_HASH.board) {
    return "board";
  }
  return appMode ? "app" : "demo";
}

function initialTab(): TabId {
  if (appMode) {
    return window.location.hash === TAB_HASH.board ? "board" : "app";
  }
  if (!demoEnabled) {
    return "board";
  }
  if (window.location.hash === TAB_HASH.demo) {
    return "demo";
  }
  if (window.location.hash === TAB_HASH.board || urlSession) {
    return "board";
  }
  return "demo";
}

const activeTab = ref<TabId>(initialTab());
const demoActive = computed<boolean>(
  () => demoEnabled && !appMode && activeTab.value === "demo"
);
const appActive = computed<boolean>(() => appMode && activeTab.value === "app");
const boardVisible = computed<boolean>(() =>
  appMode ? activeTab.value === "board" : !demoEnabled || activeTab.value === "board"
);

function writeHash(hash: string): void {
  // Keep ?v= / ?legacy=1 / ?session= / ?app= and only replace the fragment.
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(null, "", url);
}

function setTab(tab: TabId): void {
  if (!tabsEnabled) {
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
  if (!tabsEnabled) {
    return;
  }
  if (appMode) {
    activeTab.value = window.location.hash === TAB_HASH.board ? "board" : "app";
    return;
  }
  if (demoEnabled) {
    activeTab.value = tabFromHash();
  }
}

onMounted(() => {
  // Normalise the URL so a reload/bookmark keeps the selected tab.
  if (tabsEnabled && window.location.hash !== TAB_HASH[activeTab.value]) {
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
        <template v-if="appActive">
          我的应用：下方内嵌的是本次 JAR 启动的服务。应用内的请求由 agent 采集；
          切到「追踪台」查看最新会话的请求、方法、SQL 和参数/返回值。
        </template>
        <template v-else-if="demoActive">
          交互示例：在示例页面点击按钮，请求发往本地后端（8080）与采集器（8601）；
          动作完成后自动定位本次链路。公网静态版使用预置响应与预置链路，不伪造采集。
        </template>
        <template v-else>
          从页面点击到 SQL 的只读追踪：点击起点、请求、控制器、服务、数据访问和结果。
          支持回放，不重发请求、不写数据库；界面为非实时刷新。
        </template>
      </p>
    </header>

    <nav v-if="tabsEnabled" class="app-tabs" role="tablist" aria-label="视图切换">
      <button
        v-if="appMode"
        id="app-tab-app"
        type="button"
        role="tab"
        class="app-tab"
        :class="{ 'app-tab--active': activeTab === 'app' }"
        :aria-selected="activeTab === 'app'"
        @click="setTab('app')"
      >
        我的应用
      </button>
      <button
        v-else
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
      <span v-if="appMode" class="app-tabs__hint">应用服务地址：{{ appUrl }}</span>
    </nav>

    <!-- Both views stay mounted (v-show) so the iframe and board state survive. -->
    <MyAppPanel
      v-if="appMode"
      v-show="appActive"
      :app-url="appUrl ?? ''"
      @open-board="showBoard"
    />

    <DemoPanel
      v-if="demoEnabled && !appMode"
      v-show="demoActive"
      :static-mode="staticDemo"
      @open-board="showBoard"
    />

    <S3Panel v-show="boardVisible" :active="boardVisible" />
  </div>
</template>