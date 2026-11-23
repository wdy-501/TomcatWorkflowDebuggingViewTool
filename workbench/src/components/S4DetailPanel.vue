<script setup lang="ts">
/**
 * S4 node detail drawer (read-only derivation over GET .../graph).
 *
 * Shows the selected span's 15 documented graph fields (S4 14 + S5 `values`),
 * the SQL sideEffects ticket (missing = 未采集, never 0), the UI effect ticket
 * (ui_effect/render/callback listed per trace, causality not inferred), the
 * per-invocation ×N list/selector, the S5 L1 Values section (param/field/
 * return, redaction/truncation badges, 行号未采集/第 i/N 次) and the gap list
 * (F > N > R, one gap per span).
 *
 * S5 reads `values` straight from the graph node; it never decodes `.map`,
 * never recomputes redaction/truncation and never claims local variables or
 * line-level values (L2/S6).
 */
import { computed, ref } from "vue";
import type { GraphNode } from "../api";
import {
  FETCH_WITHOUT_BACKEND_TEXT,
  GAP_EMPTY_TEXT,
  MISSING,
  RUNTIME_X3_NOTE,
  XN_DEMO_LABEL,
  confidenceText,
  deriveGaps,
  formatNs,
  groupNodesByNodeKey,
  reasonText,
  returnText,
  rowsForInvocation,
  rowsText,
  sortNodes,
  statusMeta,
  threadText,
  uiEffectText,
  type InvocationRows,
  type NodeGroup,
} from "../s4/derive";
import {
  L1_STATIC_NOTE,
  VALUES_EMPTY_TEXT,
  hasL1Flag,
  invocationText,
  isFieldDiff,
  lineFooterText,
  s5SourceText,
  valueLineText,
  valueRows,
} from "../s5/values";

const props = defineProps<{
  nodes: GraphNode[];
  selectedSpanId: string | null;
  minStartNs: number;
}>();

const emit = defineEmits<{
  select: [spanId: string];
  close: [];
}>();

type DetailTab = "sql" | "ui";

const tab = ref<DetailTab>("sql");

const groups = computed<NodeGroup[]>(() => groupNodesByNodeKey(props.nodes));

/** #s4-group-badge shows only real ×N groups (N>=2); ×1 is not a ×N fact. */
const multiGroups = computed<NodeGroup[]>(() =>
  groups.value.filter((group) => group.count >= 2)
);

const selectedNode = computed<GraphNode | null>(() => {
  if (props.selectedSpanId === null) {
    return null;
  }
  return props.nodes.find((node) => node.spanId === props.selectedSpanId) ?? null;
});

const selectedGroup = computed<GraphNode[]>(() => {
  const node = selectedNode.value;
  if (node === null) {
    return [];
  }
  const group = groups.value.find((item) => item.nodeKey === node.nodeKey);
  return group !== undefined ? group.nodes : [node];
});

const invocationIndex = computed<number>(() => {
  const node = selectedNode.value;
  if (node === null) {
    return 0;
  }
  return selectedGroup.value.findIndex((item) => item.spanId === node.spanId);
});

const selectionTitle = computed<string>(() => {
  const node = selectedNode.value;
  if (node === null) {
    return "未选择节点";
  }
  const total = selectedGroup.value.length;
  const index = invocationIndex.value >= 0 ? invocationIndex.value + 1 : 1;
  return `${node.kind} · ${node.nodeKey} · 第 ${index}/${total} 次`;
});

interface InvocationView {
  node: GraphNode;
  index: number;
  rows: InvocationRows;
}

const invocations = computed<InvocationView[]>(() => {
  return selectedGroup.value.map((node, index) => ({
    node,
    index,
    rows: rowsForInvocation(node, props.nodes),
  }));
});

const renderNodes = computed<GraphNode[]>(() => {
  return props.nodes.filter((node) => node.kind === "render").sort(sortNodes);
});

const selectedEffect = computed<string | null>(() => {
  const node = selectedNode.value;
  return node === null ? null : uiEffectText(node);
});

const gaps = computed(() => deriveGaps(props.nodes));

/** S5: node flags carry L1 → show the L1 badge (never a L2/local claim). */
const l1Badge = computed<boolean>(() =>
  selectedNode.value !== null && hasL1Flag(selectedNode.value)
);

/** S5 rows verbatim in collected order (param → field → return); null/[] = empty. */
const values = computed(() => (selectedNode.value === null ? [] : valueRows(selectedNode.value)));

/** Value-row invocation denominator: collected spans sharing the nodeKey. */
const valuesTotal = computed<number>(() => Math.max(1, selectedGroup.value.length));

/** S5 source display from the graph node; manifest hits get the suffix. */
const sourceLabel = computed<string>(() =>
  selectedNode.value === null ? MISSING : s5SourceText(selectedNode.value)
);

const emptyText = computed<string>(() => {
  if (props.nodes.length === 0) {
    return "空态：暂无事实链节点（未采集）；选择请求后显示节点详情。";
  }
  if (props.selectedSpanId === null) {
    return "尚未选择节点：点击左侧事实树节点或上方 ×N 分组查看节点详情。";
  }
  return "所选节点不在当前事实链/回放窗口中（可能已切换 trace 或事件未发生）。";
});

function selectGroup(group: NodeGroup): void {
  const first = group.nodes[0];
  if (first !== undefined) {
    emit("select", first.spanId);
  }
}

function onInvocationChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }
  if (target.value.length > 0) {
    emit("select", target.value);
  }
}

function onClose(): void {
  emit("close");
}
</script>

<template>
  <aside id="s4-detail" class="s4-detail" aria-labelledby="s4-detail-heading">
    <header class="s4-detail__header">
      <h3 id="s4-detail-heading" class="s4-detail__heading">节点详情</h3>
      <button
        id="s4-detail-close"
        type="button"
        class="s4-detail__close"
        :disabled="selectedNode === null"
        @click="onClose"
      >
        关闭
      </button>
    </header>

    <p class="s4-detail__hint">
      {{ XN_DEMO_LABEL }} —— 同 nodeKey 的已采集 span 聚合（树行徽标 ×N；点击分组查看逐次调用）。
    </p>

    <div id="s4-group-badge" class="s4-group-badge" aria-label="×N 分组">
      <button
        v-for="group in multiGroups"
        :key="group.nodeKey"
        type="button"
        class="s4-group-badge__item"
        :class="{ 's4-group-badge__item--active': selectedNode !== null && selectedNode.nodeKey === group.nodeKey }"
        :data-node-key="group.nodeKey"
        :title="`${group.count} 次同 nodeKey 调用（前端聚合显示；运行时 ×3 属 S6）`"
        @click="selectGroup(group)"
      >
        <span class="s4-xn">{{ group.badge }}</span>
        <span class="s4-group-badge__kind">{{ group.kind }}</span>
        <code class="s4-group-badge__key">{{ group.nodeKey }}</code>
      </button>
      <p v-if="multiGroups.length === 0" class="s4-detail__muted">
        未发现 ×N 分组（所选 trace 内没有 N≥2 的同 nodeKey 调用）。
      </p>
    </div>

    <template v-if="selectedNode !== null">
      <p id="s4-detail-title" class="s4-detail__title" :title="selectedNode.spanId">
        {{ selectionTitle }}
      </p>

      <div id="s4-detail-status" class="s4-detail__status">
        <span class="s3-status" :class="`s3-status--${statusMeta(selectedNode.status).tone}`">
          {{ statusMeta(selectedNode.status).label }}
        </span>
        <span class="s4-detail__reason">reason：{{ reasonText(selectedNode) }}</span>
      </div>

      <dl class="s4-facts">
        <div class="s4-facts__row">
          <dt>confidence</dt>
          <dd>
            <span
              class="s3-conf"
              :class="`s3-conf--${selectedNode.confidence === 'LOST' ? 'lost' : selectedNode.confidence === 'EXACT' ? 'exact' : selectedNode.confidence === 'MANUAL' ? 'manual' : 'neutral'}`"
            >
              {{ confidenceText(selectedNode.confidence) }}
            </span>
            <span class="s4-detail__muted">（LOST 只在 confidence，不伪装 status）</span>
          </dd>
        </div>
        <div class="s4-facts__row">
          <dt>return</dt>
          <dd>{{ returnText(selectedNode) }}</dd>
        </div>
        <div class="s4-facts__row">
          <dt>flags</dt>
          <dd class="s4-facts__chips">
            <span v-for="flag in selectedNode.flags" :key="flag" class="s3-flag">{{ flag }}</span>
            <span v-if="selectedNode.flags.length === 0" class="s4-detail__muted">无记录（[]）</span>
          </dd>
        </div>
        <div class="s4-facts__row">
          <dt>thread</dt>
          <dd>{{ threadText(selectedNode) }}</dd>
        </div>
        <div class="s4-facts__row">
          <dt>source</dt>
          <dd>
            <code id="s5-source">{{ sourceLabel }}</code><span class="s4-detail__muted">（manifest 命中显示 file:line；缺失即未采集；无 .map 解码）</span>
          </dd>
        </div>
        <div class="s4-facts__row">
          <dt>时间</dt>
          <dd>
            relNs {{ formatNs(Math.max(0, selectedNode.startNs - minStartNs)) }} · dur {{ formatNs(selectedNode.durNs) }}
            <span class="s4-detail__raw">（原始 startNs {{ selectedNode.startNs }} · durNs {{ selectedNode.durNs }}）</span>
          </dd>
        </div>
        <div class="s4-facts__row">
          <dt>spanId</dt>
          <dd><code>{{ selectedNode.spanId }}</code></dd>
        </div>
      </dl>

      <section id="s5-values" class="s5-values" aria-label="L1 值">
        <header class="s5-values__head">
          <h4 class="s4-detail__section-title">Values · L1（参数 / 字段写入 / 返回）</h4>
          <span
            v-if="l1Badge"
            id="s5-l1-badge"
            class="s5-l1-badge"
            title="该节点 flags 含 L1：L1 参数/字段写入/返回摘要（不是 L2）"
          >
            L1
          </span>
        </header>
        <p id="s5-values-note" class="s5-values__note">{{ L1_STATIC_NOTE }}</p>
        <p class="s4-detail__hint">
          字段写入行显示 old → new（例如 100 → 0，高亮）；参数/返回行显示 to。
          值行序号来自 values.invocation；S4 ×N 组序号来自同 nodeKey 的已采集 span 分组，两者不混用。
        </p>
        <ul v-if="values.length > 0" class="s5-values__list">
          <li
            v-for="(value, index) in values"
            :key="`${value.kind}-${value.name}-${index}`"
            class="s5-value"
            :class="{
              's5-value--truncated': value.truncated,
              's5-value--redacted': value.redacted,
            }"
            :data-value-kind="value.kind"
          >
            <span class="s5-value__kind">{{ value.kind }}</span>
            <code class="s5-value__name">{{ value.name }}</code>
            <span
              class="s5-value__value"
              :class="{ 's5-value__value--diff': isFieldDiff(value) }"
              title="值原样来自采集端（不重算脱敏/截断）"
            >
              {{ valueLineText(value) }}
            </span>
            <span
              v-if="value.redacted"
              class="s5-value__lock"
              title="锁：值级已脱敏，原值不出现"
              aria-label="已脱敏（锁）"
            >
              锁
            </span>
            <span
              v-if="value.redacted"
              class="s5-value__badge s5-value__badge--redacted"
              title="值级已脱敏：只显示占位符，原值不出现"
            >
              已脱敏
            </span>
            <span
              v-if="value.truncated"
              class="s5-value__badge s5-value__badge--truncated"
              title="值级已截断：超过 2048 字节且未追加省略号"
            >
              已截断
            </span>
            <span class="s5-value__footer">
              {{ lineFooterText(value) }} · {{ invocationText(value, valuesTotal) }}
            </span>
          </li>
        </ul>
        <p v-else id="s5-values-empty" class="s4-detail__missing">{{ VALUES_EMPTY_TEXT }}</p>
      </section>

      <div id="s4-detail-tabs" class="s4-tabs" role="tablist" aria-label="节点详情票签">
        <button
          type="button"
          role="tab"
          class="s4-tab"
          :class="{ 's4-tab--active': tab === 'sql' }"
          :aria-selected="tab === 'sql'"
          @click="tab = 'sql'"
        >
          SQL/数据影响
        </button>
        <button
          type="button"
          role="tab"
          class="s4-tab"
          :class="{ 's4-tab--active': tab === 'ui' }"
          :aria-selected="tab === 'ui'"
          @click="tab = 'ui'"
        >
          UI 效果
        </button>
      </div>

      <section
        v-show="tab === 'sql'"
        id="s4-sideeffects"
        class="s4-ticket"
        role="tabpanel"
        aria-label="SQL/数据影响"
      >
        <p class="s4-detail__hint">
          SQL/数据影响票签 = 所选 span 自身 sideEffects；缺失/空一律“未采集”，绝不为 0。
        </p>
        <table class="s4-sql">
          <thead>
            <tr>
              <th scope="col">sqlId</th>
              <th scope="col">rowsAffected</th>
              <th scope="col">transaction</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(effect, index) in selectedNode.sideEffects" :key="`${effect.sqlId ?? 'sql'}-${index}`">
              <td>{{ effect.sqlId ?? MISSING }}</td>
              <td>{{ effect.rowsAffected === null ? MISSING : effect.rowsAffected }}</td>
              <td>{{ effect.transaction ?? MISSING }}</td>
            </tr>
            <tr v-if="selectedNode.sideEffects.length === 0">
              <td colspan="3" class="s4-detail__missing">
                未采集（所选节点没有 sideEffects；不推断为 0 行）
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-show="tab === 'ui'"
        id="s4-ui-effects"
        class="s4-ticket"
        role="tabpanel"
        aria-label="UI 效果"
      >
        <p class="s4-detail__hint">
          UI 效果（ui_effect / render / callback）：SDK 显式 uiEffect(text) 记录的用户可见文案摘要。
        </p>
        <p v-if="selectedEffect !== null" class="s4-detail__effect">
          所选节点 ui_effect：<strong>{{ selectedEffect }}</strong>
        </p>
        <p v-else class="s4-detail__muted">
          所选节点不是 render/ui_effect 事件（该节点的 UI 效果未采集，不推断）。
        </p>
        <p class="s4-detail__hint">
          本 trace 的 render 事件（按 trace 列出，未推断与所选节点的因果）：
        </p>
        <ul v-if="renderNodes.length > 0" class="s4-render-list">
          <li v-for="render in renderNodes" :key="render.spanId" class="s4-render-list__item">
            <code>{{ render.nodeKey }}</code>
            <span>· {{ uiEffectText(render) ?? MISSING }}</span>
            <span>· relNs {{ formatNs(Math.max(0, render.startNs - minStartNs)) }}</span>
            <code>spanId {{ render.spanId }}</code>
          </li>
        </ul>
        <p v-else class="s4-detail__missing">
          未采集（本 trace 无 render / ui_effect 事件；UI 效果不会被推断）
        </p>
      </section>

      <section id="s4-invocations" class="s4-detail__section" aria-label="逐次调用">
        <h4 class="s4-detail__section-title">逐次调用（per-invocation）· 同 nodeKey ×N</h4>
        <p class="s4-detail__hint">
          按 startNs 升序、同值 spanId 字典序；逐次状态独立展示，不合并、不伪造聚合 OK。
        </p>
        <template v-if="selectedGroup.length >= 2">
          <label class="s4-detail__select-label" for="s4-invocation-select">选择第几次调用</label>
          <select
            id="s4-invocation-select"
            class="s4-detail__select"
            :value="selectedNode.spanId"
            @change="onInvocationChange"
          >
            <option v-for="invocation in invocations" :key="invocation.node.spanId" :value="invocation.node.spanId">
              第 {{ invocation.index + 1 }}/{{ selectedGroup.length }} 次 · {{ invocation.node.spanId }} · {{ statusMeta(invocation.node.status).label }}
            </option>
          </select>
          <ol class="s4-invocation-list">
            <li v-for="invocation in invocations" :key="invocation.node.spanId">
              <button
                type="button"
                class="s4-invocation"
                :class="{ 's4-invocation--active': invocation.node.spanId === selectedNode.spanId }"
                @click="emit('select', invocation.node.spanId)"
              >
                <span class="s4-invocation__line">
                  <strong>第 {{ invocation.index + 1 }}/{{ selectedGroup.length }} 次</strong>
                  <span class="s3-status" :class="`s3-status--${statusMeta(invocation.node.status).tone}`">
                    {{ statusMeta(invocation.node.status).label }}
                  </span>
                  <code>{{ invocation.node.spanId }}</code>
                </span>
                <span class="s4-invocation__line">return：{{ returnText(invocation.node) }}</span>
                <span class="s4-invocation__line">
                  SQL rows：{{ rowsText(invocation.rows) }}
                  <template v-if="invocation.rows.source === 'child_sql'">
                    （子 sql：{{ invocation.rows.sqlSpanIds.join(', ') }}）
                  </template>
                  <template v-else-if="invocation.rows.source === 'self'">
                    （自身 sql sideEffects）
                  </template>
                  <template v-else>（无 sql 子节点，rows 未采集，绝不为 0）</template>
                </span>
                <span class="s4-invocation__line">
                  relNs {{ formatNs(Math.max(0, invocation.node.startNs - minStartNs)) }}
                </span>
              </button>
            </li>
          </ol>
        </template>
        <p v-else class="s4-detail__muted">
          该 nodeKey 在所选 trace 内仅 1 次调用（N=1，不显示 ×N）。
        </p>
        <p class="s4-detail__note">{{ RUNTIME_X3_NOTE }}</p>
      </section>
    </template>

    <p v-else class="s4-detail__empty">{{ emptyText }}</p>

    <section id="s4-gaps" class="s4-detail__section" aria-label="缺口清单">
      <h4 class="s4-detail__section-title">缺口清单（只读派生）</h4>
      <p class="s4-detail__hint">
        按 span 去重（优先级 F &gt; N &gt; R），每个 span 最多一条；不跨 span 合并。
      </p>
      <ul v-if="gaps.length > 0" class="s4-gap-list">
        <li v-for="gap in gaps" :key="gap.spanId" class="s4-gap">
          <span class="s4-gap__rule" :title="gap.rule">{{ gap.ruleLabel }} · {{ gap.rule }}</span>
          <span class="s4-gap__kind">{{ gap.kind }}</span>
          <code class="s4-gap__key">{{ gap.nodeKey }}</code>
          <span class="s4-gap__text">{{ gap.text }}</span>
          <span class="s4-detail__muted">spanId {{ gap.spanId }} · reason {{ gap.internalReason }}</span>
        </li>
      </ul>
      <p v-else class="s4-detail__muted">{{ GAP_EMPTY_TEXT }}</p>
      <p class="s4-detail__note">{{ RUNTIME_X3_NOTE }}；{{ FETCH_WITHOUT_BACKEND_TEXT }} 只有在 fetch 未被后端节点引用时出现。</p>
    </section>
  </aside>
</template>
