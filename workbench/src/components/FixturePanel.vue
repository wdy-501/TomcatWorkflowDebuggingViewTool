<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  hasFlag,
  loadEvents,
  loadExpectedFacts,
  type EventRow,
  type ExpectedFacts,
} from "../fixtures";
import FactCard from "./FactCard.vue";

const events = ref<EventRow[]>([]);
const facts = ref<ExpectedFacts | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const flagLabel = computed(() => facts.value?.flagRequired ?? "DROP_COUNT=0");
const allRowsFlagged = computed(() =>
  events.value.length > 0 && events.value.every((row) => hasFlag(row, flagLabel.value))
);

onMounted(async () => {
  try {
    const [loadedEvents, loadedFacts] = await Promise.all([loadEvents(), loadExpectedFacts()]);
    events.value = loadedEvents;
    facts.value = loadedFacts;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section id="fixture-panel" class="fixture-panel" aria-labelledby="fixture-panel-title">
    <header class="fixture-panel__header">
      <h2 id="fixture-panel-title" class="fixture-panel__title">Fixture 事实摘要</h2>
      <span class="fixture-panel__badge">case-a-zero-rows · 只读</span>
    </header>

    <p class="fixture-panel__note">
      数据来自 fixture 副本（public/fixtures/case-a-zero-rows/），以下均为记录到的客观事实，不做缺陷判定。
    </p>

    <p v-if="loading" class="fixture-panel__state">正在读取 fixture…</p>
    <p v-else-if="error" class="fixture-panel__state fixture-panel__state--error">
      读取失败：{{ error }}
    </p>

    <template v-else-if="facts">
      <div class="fixture-summary">
        <span class="fixture-summary__item">事件数 <strong>{{ events.length }}</strong></span>
        <span class="fixture-summary__item">期望事实 <strong>{{ facts.facts.length }}</strong> 条</span>
        <span class="fixture-summary__item" :title="`每行 flags 是否都含 ${flagLabel}`">
          {{ flagLabel }}
          <strong>{{ allRowsFlagged ? "全部存在" : "存在缺失" }}</strong>
        </span>
        <span class="fixture-summary__item">traceId <code>{{ facts.traceId }}</code></span>
        <span class="fixture-summary__item">rootEventId <code>{{ facts.rootEventId }}</code></span>
      </div>

      <h3 class="fixture-panel__subtitle">事件列表（type / kind / status / nodeKey）</h3>
      <table class="event-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">type</th>
            <th scope="col">kind</th>
            <th scope="col">status</th>
            <th scope="col">nodeKey</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in events" :key="row.spanId">
            <td>{{ index + 1 }}</td>
            <td><code>{{ row.type }}</code></td>
            <td>{{ row.kind }}</td>
            <td><span class="status-tag">{{ row.status }}</span></td>
            <td><code>{{ row.nodeKey }}</code></td>
          </tr>
        </tbody>
      </table>

      <h3 class="fixture-panel__subtitle">期望事实摘要（{{ facts.facts.length }} 条）</h3>
      <div class="fact-grid">
        <FactCard v-for="fact in facts.facts" :key="fact.id" :fact="fact" />
      </div>
    </template>
  </section>
</template>