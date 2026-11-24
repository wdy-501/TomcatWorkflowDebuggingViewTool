<script setup lang="ts">
import { useAppStore } from "./stores/app";
import FixturePanel from "./components/FixturePanel.vue";
import S1Panel from "./components/S1Panel.vue";
import S2Panel from "./components/S2Panel.vue";
import S3Panel from "./components/S3Panel.vue";
import { S6_BANNER } from "./s6/canonical";

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
        S3 · runtime SDK 前端事实（点击/请求/DOM） + 案例 B 确认没发 + 只读回放 ·
        S4 节点详情/×N 聚合/缺口（只读前端派生）·
        S5 L1 值（参数/字段写入/返回；脱敏/截断可见；节点详情只读）·
        {{ S6_BANNER }} ·
        非实时（无 SSE/WS）· 回放不重发请求/不写数据库
      </p>
    </header>

    <S3Panel />

    <details class="secondary-panel">
      <summary class="secondary-panel__summary">
        S2 · 0 行事实链（次级面板 · 默认 s_s2agent · 只读）
      </summary>
      <p class="secondary-panel__note">
        S2 面板保留为次级：读取 requests / graph 的 0 行后端事实链，与上方 S3 板的
        s_s3demo 前端事实链相互独立，不可当作同一请求。
      </p>
      <S2Panel />
    </details>

    <details class="secondary-panel">
      <summary class="secondary-panel__summary">S1 walking skeleton（假数据，非 S3 事实链）</summary>
      <p class="secondary-panel__note">
        以下是 S1 的假前端事件 → ingest → 读回演示，与 S3 的 runtime SDK / S2 的 agent
        4-span 链无关联，不可当作同一请求（点击按钮才会 POST 假批次）。
      </p>
      <S1Panel />
    </details>

    <details class="secondary-panel">
      <summary class="secondary-panel__summary">S0 fixture 事实摘要（次级 · 只读）</summary>
      <p class="secondary-panel__note">
        S0 的 case-a-zero-rows fixture 摘要保留，只用于展示契约形状，不是运行时事实、
        也不冒充 S3 的“没发请求”证据。
      </p>
      <FixturePanel />
    </details>
  </div>
</template>
