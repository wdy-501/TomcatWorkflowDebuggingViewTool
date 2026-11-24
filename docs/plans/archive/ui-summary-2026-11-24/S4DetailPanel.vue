<script setup lang="ts">
/**
 * S4 node detail drawer (read-only derivation over GET .../graph).
 *
 * Shows the selected span's 15 documented graph fields (S4 14 + S5 `values`),
 * the SQL sideEffects ticket (missing = 未采集, never 0), the UI effect ticket
 * (ui_effect/render/callback listed per trace, causality not inferred), the
 * per-invocation ×N list/selector, the S5 L1 Values section (param/field/
 * return, redaction/truncation badges, 行号未采集/第 i/N 次), the S6 L2 rows
 * (L2 badge/note, `行号 N` + `100 → 0` for `local` kinds, 值变化 on the
 * invocation whose local value changed), the S6b badges
 * (`ASYNC_INHERITED` → 异步继承, no-debug status → 无调试信息 + event reason,
 * fold counts → 已折叠 N 次) and the gap list (F > N > R).
 *
 * S5 reads `values` straight from the graph node; it never decodes `.map`,
 * never recomputes redaction/truncation. S6 L2 claims follow the `L2` flag
 * only (never the nodeKey); the async badge follows `ASYNC_INHERITED` only;
 * the no-debug badge follows the exact `NOT_COLLECTED_NO_DEBUG_INFO` status
 * only; the fold note follows VALUES_CAPPED/VALUES_TOTAL only. Non-L2 nodes
 * keep the S5 wording verbatim.
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
  compactNodeKey,
  controlNameFor,
  flagDescription,
  kindLabel,
  nodeSqlSummary,
  repoSourcePath,
  statusChinese,
} from "../s4/labels";
import {
  L1_STATIC_NOTE,
  VALUES_EMPTY_TEXT,
  hasL1Flag,
  invocationText,
  lineFooterText,
  s5SourceText,
  valueLineText,
  valueRows,
} from "../s5/values";
import {
  L2_BADGE_TEXT,
  VALUE_CHANGE_TEXT,
  invocationDiffNodes,
  isL2Node,
  isValueChange,
} from "../s6/l2";
import {
  ASYNC_BADGE_TEXT,
  ASYNC_LIMIT_NOTE,
  hasAsyncInherited,
} from "../s6/async";
import {
  NO_DEBUG_BADGE_TEXT,
  isNoDebugNode,
  noDebugReason,
} from "../s6/no-debug";
import { FOLD_NOTE_TITLE, foldNote } from "../s6/fold";
import {
  S6_L2_NOTE,
  S6_NO_DEBUG_NOTE,
  hasNoDebugFlag,
} from "../s6/canonical";

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
  const times = total > 1 ? ` · 第 ${index}/${total} 次` : "";
  return `${kindLabel(node.kind)} · ${compactNodeKey(node.kind, node.nodeKey)}${times}`;
});

interface InvocationView {
  node: GraphNode;
  index: number;
  rows: InvocationRows;
  /** True when THIS invocation's own values contain a value change. */
  diff: boolean;
}

const invocations = computed<InvocationView[]>(() => {
  return selectedGroup.value.map((node, index) => ({
    node,
    index,
    rows: rowsForInvocation(node, props.nodes),
    diff: invocationDiffNodes([node]).length > 0,
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

/**
 * S6a: the L2 badge/note follow the `L2` span flag only (isL2Node). Non-L2
 * nodes keep the S5 wording; the nodeKey is never used as a L2 signal.
 */
const l2Node = computed<boolean>(() =>
  selectedNode.value !== null && isL2Node(selectedNode.value)
);

/** S6b: async badge follows `ASYNC_INHERITED` only (never nodeKey/thread). */
const asyncNode = computed<boolean>(() =>
  selectedNode.value !== null && hasAsyncInherited(selectedNode.value)
);

/** S6b: no-debug block follows the exact NOT_COLLECTED_NO_DEBUG_INFO status. */
const noDebugNode = computed<boolean>(() =>
  selectedNode.value !== null && isNoDebugNode(selectedNode.value)
);

/** Verbatim event reason; a missing reason renders 未采集（无 reason）. */
const noDebugReasonText = computed<string>(() =>
  selectedNode.value === null ? "" : noDebugReason(selectedNode.value)
);

/** Advisory `NO_DEBUG_INFO` flag chip; not a success marker. */
const noDebugFlag = computed<boolean>(() =>
  selectedNode.value !== null && hasNoDebugFlag(selectedNode.value)
);

/** S6b fold note: `已折叠 N 次（VALUES_CAPPED=N；共 M 次）`, null without flags. */
const foldNoteText = computed<string | null>(() =>
  selectedNode.value === null ? null : foldNote(selectedNode.value)
);

/** S5 rows verbatim in collected order (param → field → return); null/[] = empty. */
const values = computed(() => (selectedNode.value === null ? [] : valueRows(selectedNode.value)));

const requestValues = computed(() =>
  values.value.filter(
    (value) => value.name.startsWith("query.") || value.name.startsWith("body.")
  )
);

const valueHeading = computed<string>(() => {
  if (l2Node.value) {
    return "采集到的值 · 行级局部变量";
  }
  if (requestValues.value.length > 0) {
    return "请求参数与请求体";
  }
  return "采集到的值 · 参数 / 字段变化 / 返回值";
});

/** Value-row invocation denominator: collected spans sharing the nodeKey. */
const valuesTotal = computed<number>(() => Math.max(1, selectedGroup.value.length));

/** S5 source display from the graph node; manifest hits get the suffix. */
const sourceLabel = computed<string>(() => {
  const node = selectedNode.value;
  if (node === null) {
    return MISSING;
  }
  const own = s5SourceText(node);
  if (own !== MISSING || node.kind !== "ui_event") {
    return own;
  }
  const controller = props.nodes.find(
    (item) => item.kind === "controller" && item.source?.file
  );
  if (controller?.source?.file) {
    const line = controller.source.line === null ? "" : `:${controller.source.line}`;
    return `页面源码未采集；后端入口 ${controller.source.file}${line}`;
  }
  return own;
});

const selectedControlName = computed<string | null>(() => {
  const node = selectedNode.value;
  return node !== null && node.kind === "ui_event" ? controlNameFor(node.nodeKey) : null;
});

const selectedRepoPath = computed<string | null>(() =>
  selectedNode.value === null ? null : repoSourcePath(selectedNode.value)
);

const hasValues = computed<boolean>(() => values.value.length > 0);

/** Only show the value card when the node actually carries values or a value-mode flag. */
const showValues = computed<boolean>(
  () => hasValues.value || l1Badge.value || l2Node.value || noDebugNode.value || asyncNode.value
);

const hasSql = computed<boolean>(() => {
  const node = selectedNode.value;
  return node !== null && (node.kind === "sql" || node.sideEffects.length > 0);
});

const hasUi = computed<boolean>(() => {
  const node = selectedNode.value;
  return node !== null && (node.kind === "render" || selectedEffect.value !== null);
});

const effectiveTab = computed<DetailTab>(() => {
  if (!hasSql.value) {
    return "ui";
  }
  if (!hasUi.value) {
    return "sql";
  }
  return tab.value;
});

const sqlText = computed<string>(() => {
  const node = selectedNode.value;
  return node === null ? "未采集" : nodeSqlSummary(node);
});

const reasonLabel = computed<string>(() =>
  selectedNode.value === null ? "—" : reasonText(selectedNode.value)
);

const hasReason = computed<boolean>(
  () => reasonLabel.value !== "—" && reasonLabel.value.length > 0
);

const hasUnknownTransaction = computed<boolean>(
  () =>
    selectedNode.value?.sideEffects.some(
      (effect) => effect.transaction === "UNKNOWN" || effect.transaction === null
    ) ?? false
);

function transactionLabel(value: string | null): string {
  if (value === "COMMITTED") {
    return "已提交";
  }
  if (value === "ROLLED_BACK") {
    return "已回滚";
  }
  if (value === "UNKNOWN" || value === null) {
    return "未采集";
  }
  return value;
}

function gapRuleText(rule: string): string {
  if (rule === "FETCH_WITHOUT_BACKEND") {
    return "请求未关联";
  }
  if (rule === "NOT_COLLECTED_REASON") {
    return "状态未采集";
  }
  if (rule === "ROWS_NOT_COLLECTED") {
    return "影响行数未采集";
  }
  return rule;
}

function transactionTitle(value: string | null): string {
  return value === "UNKNOWN"
    ? "UNKNOWN：没有采集事务提交/回滚边界"
    : value === null
      ? "未采集"
      : value;
}

const gapCount = computed<number>(() => gaps.value.length);

const emptyText = computed<string>(() => {
  if (props.nodes.length === 0) {
    return "暂无链路节点；选择一条请求后再点节点查看详情。";
  }
  if (props.selectedSpanId === null) {
    return "点击左侧链路中的节点，查看这里的中文摘要与技术细节。";
  }
  return "所选节点不在当前链路或回放窗口中。";
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

function valuePreview(text: string): string {
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
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

    <template v-if="selectedNode !== null">
      <div class="s4-hero">
        <p id="s4-detail-title" class="s4-detail__title" :title="selectedNode.spanId">
          {{ selectionTitle }}
        </p>
        <p class="s4-hero__facts">
          <span class="s3-status" :class="`s3-status--${statusMeta(selectedNode.status).tone}`">
            {{ statusChinese(selectedNode.status) }}
          </span>
          <span>返回：{{ returnText(selectedNode) }}</span>
          <span v-if="selectedControlName" class="s4-hero__control">
            控件：{{ selectedControlName }}
          </span>
        </p>
        <p class="s4-hero__source">
          来源：<code id="s5-source" :title="selectedRepoPath ?? undefined">{{ sourceLabel }}</code>
        </p>
        <div v-if="hasReason" id="s4-detail-status" class="s4-detail__status">
          <span class="s4-detail__reason">原因：{{ reasonLabel }}</span>
        </div>
      </div>

      <details v-if="multiGroups.length > 0" id="s4-group-badge" class="s4-group-badge">
        <summary class="s4-group-badge__summary">同一方法的多次调用（×N）</summary>
        <p class="s4-detail__hint">{{ XN_DEMO_LABEL }}</p>
        <div class="s4-group-badge__row">
          <button
            v-for="group in multiGroups"
            :key="group.nodeKey"
            type="button"
            class="s4-group-badge__item"
            :class="{ 's4-group-badge__item--active': selectedNode !== null && selectedNode.nodeKey === group.nodeKey }"
            :data-node-key="group.nodeKey"
            :title="`${group.count} 次同方法调用（前端聚合显示）`"
            @click="selectGroup(group)"
          >
            <span class="s4-xn">{{ group.badge }}</span>
            <span class="s4-group-badge__kind">{{ kindLabel(group.kind) }}</span>
            <code class="s4-group-badge__key">{{ compactNodeKey(group.kind, group.nodeKey) }}</code>
          </button>
        </div>
      </details>

      <div
        v-if="noDebugNode"
        id="s6-no-debug"
        class="s6-no-debug"
        role="note"
        aria-label="无调试信息（未采集，不是成功）"
      >
        <span
          id="s6-no-debug-badge"
          class="s6-no-debug-badge"
          title="状态 NOT_COLLECTED_NO_DEBUG_INFO：灰色未采集状态，不是 OK/成功"
        >
          {{ NO_DEBUG_BADGE_TEXT }}
        </span>
        <span id="s6-no-debug-reason" class="s6-no-debug-reason">
          reason：{{ noDebugReasonText }}
        </span>
        <span v-if="noDebugFlag" class="s6-no-debug-flag">NO_DEBUG_INFO</span>
        <p class="s6-no-debug-note">{{ S6_NO_DEBUG_NOTE }}</p>
        <p class="s6-no-debug-note">
          该节点的 values 与行号均为未采集（不是 0）：无 LocalVariableTable 时不猜变量名/行号。
        </p>
      </div>

      <details class="s4-fold">
        <summary class="s4-fold__summary">技术字段（关联方式、线程、原始时间、标识）</summary>
        <dl class="s4-facts">
          <div class="s4-facts__row">
            <dt>关联方式</dt>
            <dd>
              <span
                class="s3-conf"
                :class="`s3-conf--${selectedNode.confidence === 'LOST' ? 'lost' : selectedNode.confidence === 'EXACT' ? 'exact' : selectedNode.confidence === 'MANUAL' ? 'manual' : 'neutral'}`"
              >
                {{ confidenceText(selectedNode.confidence) }}
              </span>
              <span class="s4-detail__muted">（未关联只在关联方式中显示，不伪装成执行状态）</span>
            </dd>
          </div>
          <div class="s4-facts__row">
            <dt>状态码</dt>
            <dd><code>{{ selectedNode.status }}</code></dd>
          </div>
          <div class="s4-facts__row">
            <dt>标记</dt>
            <dd class="s4-facts__chips">
              <span
                v-for="flag in selectedNode.flags"
                :key="flag"
                class="s3-flag"
                :title="flagDescription(flag)"
              >{{ flag }}</span>
              <span v-if="selectedNode.flags.length === 0" class="s4-detail__muted">无记录（[]）</span>
            </dd>
          </div>
          <div class="s4-facts__row">
            <dt>线程</dt>
            <dd>{{ threadText(selectedNode) }}</dd>
          </div>
          <div class="s4-facts__row">
            <dt>时间</dt>
            <dd>
              相对 {{ formatNs(Math.max(0, selectedNode.startNs - minStartNs)) }} · 耗时 {{ formatNs(selectedNode.durNs) }}
              <span class="s4-detail__raw">（原始时间 {{ selectedNode.startNs }} · 原始耗时 {{ selectedNode.durNs }}）</span>
            </dd>
          </div>
          <div class="s4-facts__row">
            <dt>节点标识</dt>
            <dd><code>{{ selectedNode.spanId }}</code></dd>
          </div>
        </dl>
      </details>

      <details v-if="selectedNode.flags.length > 0" class="s4-fold">
        <summary class="s4-fold__summary">标记说明（{{ selectedNode.flags.length }}）</summary>
        <ul class="s4-flag-list">
          <li v-for="flag in selectedNode.flags" :key="`help-${flag}`">
            <code class="s3-flag">{{ flag }}</code>
            <span>{{ flagDescription(flag) }}</span>
          </li>
        </ul>
      </details>

      <details v-if="!showValues" class="s4-fold">
        <summary class="s4-fold__summary">变量与参数（未采集）</summary>
        <p class="s4-detail__muted">
          该节点没有采集到请求体、方法参数或局部变量。当前只在前端请求节点采集 query/body，
          以及 L1/L2 插桩节点采集参数和局部变量。
        </p>
      </details>

      <section v-if="showValues" id="s5-values" class="s5-values" aria-label="采集到的值">
        <header class="s5-values__head">
          <h4 class="s4-detail__section-title">{{ valueHeading }}</h4>
          <span
            v-if="l1Badge"
            id="s5-l1-badge"
            class="s5-l1-badge"
            title="该节点含参数/字段写入/返回摘要（一级采集）"
          >
            L1
          </span>
          <span
            v-if="l2Node"
            id="s6-l2-badge"
            class="s6-l2-badge"
            title="该节点含行级局部变量（二级采集）"
          >
            {{ L2_BADGE_TEXT }}
          </span>
          <span
            v-if="asyncNode"
            id="s6-async-badge"
            class="s6-async-badge"
            title="该节点在异步线程中继承了调用上下文"
          >
            {{ ASYNC_BADGE_TEXT }}
          </span>
        </header>
        <details class="s4-fold">
          <summary class="s4-fold__summary">值采集说明</summary>
          <p v-if="l2Node" id="s6-l2-note" class="s6-l2-note">{{ S6_L2_NOTE }}</p>
          <p v-else-if="requestValues.length > 0" id="s5-values-note" class="s5-values__note">
            这些值来自前端请求的查询参数与请求体；本地演示不做敏感字段脱敏，超长值仍会截断。
          </p>
          <p v-else id="s5-values-note" class="s5-values__note">{{ L1_STATIC_NOTE }}</p>
          <p v-if="asyncNode" id="s6-async-note" class="s6-async-note">{{ ASYNC_LIMIT_NOTE }}</p>
          <p class="s4-detail__hint">
            字段变化显示为“旧值 → 新值”（例如 100 → 0）；参数和返回值显示采集到的结果。
            值行的调用序号与技术字段仍按原始采集记录展示，不做推断。
          </p>
        </details>
        <p v-if="foldNoteText !== null" id="s6-fold-note" class="s6-fold-note" :title="FOLD_NOTE_TITLE">
          {{ foldNoteText }}
        </p>
        <p v-if="foldNoteText !== null" class="s6-fold-hint">
          已折叠不是失败；保留首、尾和中段样本，单值未被截断。
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
              :class="{ 's5-value__value--diff': isValueChange(value) }"
              title="值原样来自采集端（不重算脱敏/截断）"
            >
              {{ valuePreview(valueLineText(value)) }}
            </span>
            <details
              v-if="valueLineText(value).length > 120"
              class="s5-value__full"
            >
              <summary>查看完整值</summary>
              <pre>{{ valueLineText(value) }}</pre>
            </details>
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
            <span
              v-if="!value.name.startsWith('query.') && !value.name.startsWith('body.')"
              class="s5-value__footer"
            >
              {{ lineFooterText(value) }} · {{ invocationText(value, valuesTotal) }}
            </span>
          </li>
        </ul>
        <p v-else id="s5-values-empty" class="s4-detail__missing">{{ VALUES_EMPTY_TEXT }}</p>
      </section>

      <template v-if="hasSql || hasUi">
        <div v-if="hasSql && hasUi" id="s4-detail-tabs" class="s4-tabs" role="tablist" aria-label="节点详情票签">
          <button
            type="button"
            role="tab"
            class="s4-tab"
            aria-controls="s4-sideeffects"
            :class="{ 's4-tab--active': effectiveTab === 'sql' }"
            :aria-selected="effectiveTab === 'sql'"
            @click="tab = 'sql'"
          >
            SQL/数据影响
          </button>
          <button
            type="button"
            role="tab"
            class="s4-tab"
            aria-controls="s4-ui-effects"
            :class="{ 's4-tab--active': effectiveTab === 'ui' }"
            :aria-selected="effectiveTab === 'ui'"
            @click="tab = 'ui'"
          >
            UI 效果
          </button>
        </div>

        <section
          v-show="effectiveTab === 'sql'"
          id="s4-sideeffects"
          class="s4-ticket"
          role="tabpanel"
          aria-label="SQL/数据影响"
        >
          <h4 class="s4-detail__section-title">SQL/数据影响</h4>
          <p class="s4-detail__hint">当前节点：{{ sqlText }}。缺失时如实显示“未采集”，不推断为 0。</p>
          <table v-if="selectedNode.sideEffects.length > 0" class="s4-sql">
            <thead>
              <tr>
                <th scope="col" title="sqlId">SQL 标识</th>
                <th scope="col" title="rowsAffected">影响行数</th>
                <th scope="col" title="transaction">事务状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(effect, index) in selectedNode.sideEffects" :key="`${effect.sqlId ?? 'sql'}-${index}`">
                <td>{{ effect.sqlId ?? MISSING }}</td>
                <td>{{ effect.rowsAffected === null ? MISSING : effect.rowsAffected }}</td>
                <td :title="transactionTitle(effect.transaction)">
                  {{ transactionLabel(effect.transaction) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="hasUnknownTransaction" class="s4-detail__muted">
            “事务状态未采集”表示这次只确认了影响行数，没有采集提交/回滚边界；不推断成功或失败。
          </p>
          <p v-else-if="selectedNode.sideEffects.length === 0" class="s4-detail__missing">
            未采集（所选节点没有 sideEffects；不推断为 0 行）
          </p>
        </section>

        <section
          v-show="effectiveTab === 'ui'"
          id="s4-ui-effects"
          class="s4-ticket"
          role="tabpanel"
          aria-label="UI 效果"
        >
          <h4 class="s4-detail__section-title">UI 效果</h4>
          <p v-if="selectedEffect !== null" class="s4-detail__effect">
            当前节点：<strong>{{ selectedEffect }}</strong>
          </p>
          <p v-else class="s4-detail__muted">
            当前节点没有直接的页面效果记录。
          </p>
          <details v-if="renderNodes.length > 0" class="s4-fold">
            <summary class="s4-fold__summary">本链路中的页面效果（{{ renderNodes.length }} 条）</summary>
            <ul class="s4-render-list">
              <li v-for="render in renderNodes" :key="render.spanId" class="s4-render-list__item">
                <code>{{ compactNodeKey(render.kind, render.nodeKey) }}</code>
                <span>· {{ uiEffectText(render) ?? MISSING }}</span>
                <span>· 相对时间 {{ formatNs(Math.max(0, render.startNs - minStartNs)) }}</span>
              </li>
            </ul>
          </details>
        </section>
      </template>

      <details
        v-if="selectedGroup.length >= 2"
        id="s4-invocations"
        class="s4-detail__section s4-fold"
        aria-label="逐次调用"
      >
        <summary class="s4-fold__summary">逐次调用（同一方法共 {{ selectedGroup.length }} 次，点击展开）</summary>
        <label class="s4-detail__select-label" for="s4-invocation-select">选择第几次调用</label>
        <select
          id="s4-invocation-select"
          class="s4-detail__select"
          :value="selectedNode.spanId"
          @change="onInvocationChange"
        >
          <option v-for="invocation in invocations" :key="invocation.node.spanId" :value="invocation.node.spanId">
            第 {{ invocation.index + 1 }}/{{ selectedGroup.length }} 次 · {{ statusChinese(invocation.node.status) }}<template v-if="invocation.diff"> · {{ VALUE_CHANGE_TEXT }}</template>
          </option>
        </select>
        <ol class="s4-invocation-list">
          <li
            v-for="invocation in invocations"
            :key="invocation.node.spanId"
            :data-invocation-diff="invocation.diff ? 'true' : undefined"
          >
            <button
              type="button"
              class="s4-invocation"
              :class="{
                's4-invocation--active': invocation.node.spanId === selectedNode.spanId,
                's4-invocation--diff': invocation.diff,
              }"
              @click="emit('select', invocation.node.spanId)"
            >
              <span class="s4-invocation__line">
                <strong>第 {{ invocation.index + 1 }}/{{ selectedGroup.length }} 次</strong>
                <span class="s3-status" :class="`s3-status--${statusMeta(invocation.node.status).tone}`">
                  {{ statusChinese(invocation.node.status) }}
                </span>
                <span v-if="invocation.diff" class="s4-invocation__diff">{{ VALUE_CHANGE_TEXT }}</span>
              </span>
              <span class="s4-invocation__line">返回：{{ returnText(invocation.node) }}</span>
              <span class="s4-invocation__line">
                SQL 影响行数：{{ rowsText(invocation.rows) }}
                <template v-if="invocation.rows.source === 'child_sql'">（来自子 SQL 节点）</template>
                <template v-else-if="invocation.rows.source === 'self'">（来自当前节点）</template>
                <template v-else>（未采集，不推断为 0）</template>
              </span>
            </button>
          </li>
        </ol>
      </details>
    </template>

    <p v-else class="s4-detail__empty">{{ emptyText }}</p>

    <details
      v-if="gapCount > 0"
      id="s4-gaps"
      class="s4-detail__section s4-fold"
      aria-label="缺口清单"
    >
      <summary class="s4-fold__summary">采集缺口（{{ gapCount }} 条，点击展开）</summary>
      <ul class="s4-gap-list">
        <li v-for="gap in gaps" :key="gap.spanId" class="s4-gap">
          <span class="s4-gap__rule" :title="`${gap.ruleLabel} · ${gap.rule}`">{{ gapRuleText(gap.rule) }}</span>
          <span class="s4-gap__kind">{{ kindLabel(gap.kind) }}</span>
          <code class="s4-gap__key">{{ compactNodeKey(gap.kind, gap.nodeKey) }}</code>
          <span class="s4-gap__text" :title="gap.internalReason">{{ gap.text }}</span>
        </li>
      </ul>
      <p class="s4-detail__note">
        未采集表示没有收到这部分事实，不等于 0，也不代表失败。{{ FETCH_WITHOUT_BACKEND_TEXT }}
        只表示前端请求没有找到对应后端节点。
      </p>
    </details>
    <p v-else class="s4-detail__muted">{{ GAP_EMPTY_TEXT }}</p>

    <details class="s4-help">
      <summary class="s4-help__summary">阅读说明</summary>
      <p class="s4-detail__note" :title="RUNTIME_X3_NOTE">
        ×N 表示同一方法在本次链路中被采集到多次；数量来自已采集节点，不做推算。
      </p>
      <p class="s4-detail__note">
        缺口按节点去重，优先级从高到低为前端请求、普通节点、页面渲染；每条缺口只报告一次。
      </p>
    </details>
  </aside>
</template>
