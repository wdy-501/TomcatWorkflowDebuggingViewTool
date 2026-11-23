<script setup lang="ts">
import type { ExpectedFact } from "../fixtures";

defineProps<{
  fact: ExpectedFact;
}>();

function formatValue(value: string | number | boolean | null): string {
  return typeof value === "string" ? `"${value}"` : String(value);
}
</script>

<template>
  <article class="fact-card">
    <header class="fact-card__header">
      <span class="fact-card__id">{{ fact.id }}</span>
      <span class="fact-card__kind">{{ fact.kind }}</span>
      <span class="fact-card__status">status: {{ fact.status }}</span>
    </header>
    <p class="fact-card__node">{{ fact.nodeKey }}</p>
    <p class="fact-card__summary">{{ fact.summary }}</p>
    <p class="fact-card__assert">
      <span class="fact-card__assert-label">期望断言</span>
      <code>{{ fact.assert.path }} = {{ formatValue(fact.assert.value) }}</code>
    </p>
  </article>
</template>