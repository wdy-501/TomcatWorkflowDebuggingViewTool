<script setup lang="ts">
import { computed } from "vue";
import type { GraphNode } from "../api";
import {
  compactNodeKey,
  controlNameFor,
  kindLabel,
  repoSourcePath,
  statusChinese,
} from "../s4/labels";

defineOptions({ name: "FlowTreeNode" });

const props = defineProps<{
  node: GraphNode;
  childrenByParent: Map<string, GraphNode[]>;
  selectedSpanId: string | null;
  mainSteps: Map<string, number>;
}>();

const emit = defineEmits<{
  select: [spanId: string];
}>();

const children = computed<GraphNode[]>(
  () => props.childrenByParent.get(props.node.spanId) ?? []
);

const step = computed<number | null>(
  () => props.mainSteps.get(props.node.spanId) ?? null
);

const controlName = computed<string | null>(() =>
  props.node.kind === "ui_event" ? controlNameFor(props.node.nodeKey) : null
);

const tone = computed<string>(() => {
  const status = props.node.status;
  if (status === "OK") {
    return "ok";
  }
  if (status === "RETURNED_FALSE") {
    return "false";
  }
  if (status === "THREW") {
    return "threw";
  }
  if (status.startsWith("NOT_COLLECTED")) {
    return "notcollected";
  }
  if (status === "TRUNCATED") {
    return "truncated";
  }
  if (status === "REDACTED") {
    return "redacted";
  }
  if (status === "UNKNOWN") {
    return "unknown";
  }
  return "neutral";
});

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json.slice(0, 120);
}

function summary(node: GraphNode): string {
  if (node.kind === "sql") {
    if (node.sideEffects.length === 0) {
      return "影响行数未采集";
    }
    return node.sideEffects
      .map((effect) =>
        effect.rowsAffected === null ? "影响行数未采集" : `影响 ${effect.rowsAffected} 行`
      )
      .join("；");
  }
  if (node.return === null) {
    return node.kind === "ui_event" ? "页面点击" : "结果未采集";
  }
  if (node.return.value === undefined) {
    return `返回 ${node.return.type}（值未采集）`;
  }
  return `返回 ${formatValue(node.return.value)}`;
}

function duration(ns: number): string {
  if (!Number.isFinite(ns) || ns < 0) {
    return "耗时 —";
  }
  if (ns < 1_000) {
    return `耗时 ${ns} ns`;
  }
  if (ns < 1_000_000) {
    return `耗时 ${(ns / 1_000).toFixed(2)} µs`;
  }
  if (ns < 1_000_000_000) {
    return `耗时 ${(ns / 1_000_000).toFixed(2)} ms`;
  }
  return `耗时 ${(ns / 1_000_000_000).toFixed(3)} s`;
}

function activate(): void {
  emit("select", props.node.spanId);
}
</script>

<template>
  <div class="flow-tree__branch">
    <div
      class="flow-tree__node"
      :class="[
        `flow-tree__node--${tone}`,
        {
          'flow-tree__node--selected': selectedSpanId === node.spanId,
          'flow-tree__node--main': step !== null,
          'flow-tree__node--leaf': step === null,
        },
      ]"
      role="button"
      tabindex="0"
      :aria-pressed="selectedSpanId === node.spanId"
      :aria-label="`查看${kindLabel(node.kind)}节点详情`"
      @click="activate"
      @keydown.enter="activate"
      @keydown.space.prevent="activate"
    >
      <div class="flow-tree__head">
        <span v-if="step !== null" class="flow-tree__step" aria-hidden="true">{{ step }}</span>
        <span v-else class="flow-tree__leaf-tag">叶子</span>
        <span class="flow-tree__kind">{{ kindLabel(node.kind) }}</span>
        <span class="flow-tree__status">{{ statusChinese(node.status) }}</span>
      </div>
      <code class="flow-tree__key" :title="repoSourcePath(node) ?? undefined">
        {{ compactNodeKey(node.kind, node.nodeKey) }}
      </code>
      <p v-if="controlName !== null" class="flow-tree__control">控件：{{ controlName }}</p>
      <p class="flow-tree__meta">
        <span>{{ summary(node) }}</span>
        <span>{{ duration(node.durNs) }}</span>
      </p>
      <span v-if="selectedSpanId === node.spanId" class="flow-tree__selected">详情已打开</span>
    </div>

    <ul v-if="children.length > 0" class="flow-tree__children">
      <li v-for="child in children" :key="child.spanId">
        <FlowTreeNode
          :node="child"
          :children-by-parent="childrenByParent"
          :selected-span-id="selectedSpanId"
          :main-steps="mainSteps"
          @select="emit('select', $event)"
        />
      </li>
    </ul>
  </div>
</template>