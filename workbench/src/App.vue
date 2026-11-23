<script setup lang="ts">
import { useAppStore } from "./stores/app";
import FixturePanel from "./components/FixturePanel.vue";
import S1Panel from "./components/S1Panel.vue";

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
        S1 walking skeleton · 假前端事件 + 一个真实 controller span · 未采集 service/mapper/SQL · 无关联 / 无图 / 无回放
      </p>
    </header>

    <S1Panel />

    <main class="app-main">
      <section class="panel" aria-labelledby="frontend-graph-title">
        <header class="panel__header">
          <h2 id="frontend-graph-title" class="panel__title">前端图（占位）</h2>
          <span class="panel__badge">未实现（S1 不做）</span>
        </header>
        <div class="panel__empty">
          <p>图渲染尚未实现。</p>
          <p>此处将放置前端调用链图；当前无节点、无连线、无时间轴。</p>
        </div>
      </section>

      <section class="panel" aria-labelledby="request-graph-title">
        <header class="panel__header">
          <h2 id="request-graph-title" class="panel__title">请求分图（占位）</h2>
          <span class="panel__badge">未实现（S1 不做）</span>
        </header>
        <nav class="request-tabs" aria-label="请求分图 Tab 占位（不可交互切换）">
          <span class="request-tabs__item request-tabs__item--active">请求 Tab（占位）</span>
          <span class="request-tabs__item">请求切换未实现</span>
        </nav>
        <div class="panel__empty">
          <p>请求分图与请求切换尚未实现。</p>
          <p>当前无节点详情、无回放控件。</p>
        </div>
      </section>
    </main>

    <FixturePanel />
  </div>
</template>
