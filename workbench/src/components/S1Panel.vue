<script setup lang="ts">
import { computed } from "vue";
import {
  CollectorHttpError,
  CollectorUnreachableError,
  fetchEventsPage,
  fetchSessions,
  postFakeBatch,
  type EventsPage,
  type SessionSummary,
} from "../api";
import { createFakeClickBatch, S1_SESSION_ID } from "../s1/fakeBatch";
import { useS1Store, type S1Error } from "../stores/s1";

const s1 = useS1Store();

/** Page size allowed by the query contract (limit 1..500, default 200). */
const PAGE_LIMIT = 200;
/** One bounded retry only: collector may still be appending right after 202. */
const RETRY_DELAY_MS = 300;

interface Readback {
  session: SessionSummary | null;
  page: EventsPage;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * One bounded read: session list -> tail page derived from eventCount.
 * Reading the tail (not afterSeq=0) keeps the newest events visible even when
 * the demo session has accumulated more than PAGE_LIMIT events.
 */
async function readOnce(sessionId: string): Promise<Readback | null> {
  const sessions = await fetchSessions();
  const session = sessions.find((item) => item.sessionId === sessionId) ?? null;
  if (session === null) {
    return null;
  }
  const afterSeq = Math.max(0, session.eventCount - PAGE_LIMIT);
  try {
    const page = await fetchEventsPage(sessionId, afterSeq, PAGE_LIMIT);
    return { session, page };
  } catch (cause) {
    if (cause instanceof CollectorHttpError && cause.status === 404) {
      return null;
    }
    throw cause;
  }
}

async function readBack(sessionId: string): Promise<Readback> {
  const first = await readOnce(sessionId);
  if (first !== null && first.page.events.length > 0) {
    return first;
  }
  await delay(RETRY_DELAY_MS);
  const retry = await readOnce(sessionId);
  if (retry !== null && (first === null || retry.page.events.length > 0)) {
    return retry;
  }
  return first ?? retry ?? { session: null, page: { events: [], nextSeq: 0 } };
}

function describeError(cause: unknown): S1Error {
  if (cause instanceof CollectorUnreachableError) {
    return {
      message: "collector 不可达：http://127.0.0.1:8601",
      hint: "请先启动 collector（默认监听 127.0.0.1:8601），再点击“发送假点击/请求”。",
    };
  }
  if (cause instanceof CollectorHttpError) {
    return {
      message: `collector 返回 HTTP ${cause.status}：${cause.message}`,
      hint:
        cause.status === 400 || cause.status === 415
          ? "请求未被接受：检查 NDJSON 信封（Content-Type 与末行换行）。"
          : null,
    };
  }
  return {
    message: cause instanceof Error ? cause.message : String(cause),
    hint: null,
  };
}

async function sendFakeClick(): Promise<void> {
  if (s1.status === "sending") {
    return;
  }
  s1.begin();
  try {
    const ingest = await postFakeBatch(createFakeClickBatch());
    const result = await readBack(S1_SESSION_ID);
    s1.succeed({ ingest, session: result.session, page: result.page });
  } catch (cause) {
    s1.fail(describeError(cause));
  }
}

const isSending = computed(() => s1.status === "sending");
const events = computed(() => s1.page?.events ?? []);
const eventCount = computed(() => s1.session?.eventCount ?? 0);
const firstSeq = computed(() => events.value[0]?.seq ?? 0);
const lastSeq = computed(() => events.value[events.value.length - 1]?.seq ?? 0);
/** Earlier pages exist: say so instead of pretending the list is complete. */
const earlierPagesHidden = computed(() => firstSeq.value > 1);
const nextSeqBehind = computed(() => (s1.page?.nextSeq ?? 0) < eventCount.value);

function formatWallClock(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleString() : "—";
}
</script>

<template>
  <section id="s1-panel" class="s1-panel" aria-labelledby="s1-panel-title">
    <header class="s1-panel__header">
      <h2 id="s1-panel-title" class="s1-panel__title">S1 Walking skeleton（假点击/请求 → collector → 读回）</h2>
      <span class="s1-panel__badge">S1 · 2 条前端假事件 + 1 条真实 controller span</span>
    </header>

    <p class="s1-panel__disclaimer">
      S1 walking skeleton：假数据，非 S2 事实链。前端假事件；仅一条真实后端 controller span 由 agent 直连 collector，
      工作台不展示/不关联；无图、不做关联判断
    </p>
    <p class="s1-panel__banner">
      <code>walking skeleton: fake frontend events; one real backend controller span; no correlation yet</code>
    </p>

    <div class="s1-panel__actions">
      <button
        id="btn-s1-fake"
        type="button"
        class="s1-panel__button"
        :disabled="isSending"
        @click="sendFakeClick"
      >
        {{ isSending ? "发送中…" : "发送假点击/请求" }}
      </button>
      <span class="s1-panel__hint">
        每次点击生成 2 条新事件（ui_event #btn-s1-fake → fetch POST /api/orders/1/cancel），
        以 application/x-ndjson 整批 POST 到 /ingest/v1/events。
      </span>
    </div>

    <p v-if="s1.error" class="s1-panel__error" role="alert">
      {{ s1.error.message }}
      <span v-if="s1.error.hint"> — {{ s1.error.hint }}</span>
    </p>

    <template v-if="s1.lastIngest">
      <h3 class="s1-panel__subtitle">ingest 结果（POST /ingest/v1/events）</h3>
      <div class="s1-summary">
        <span class="s1-summary__item">sessionId <code>{{ S1_SESSION_ID }}</code></span>
        <span class="s1-summary__item">accepted <strong>{{ s1.lastIngest.accepted }}</strong></span>
        <span class="s1-summary__item">rejected <strong>{{ s1.lastIngest.rejected }}</strong></span>
        <span class="s1-summary__item">dropped <strong>{{ s1.lastIngest.dropped }}</strong></span>
        <span class="s1-summary__item">保存的 event count <strong>{{ eventCount }}</strong></span>
        <span class="s1-summary__item">nextSeq <strong>{{ s1.page?.nextSeq ?? "—" }}</strong></span>
        <span v-if="s1.completedAt" class="s1-summary__item">读取时间 <strong>{{ s1.completedAt }}</strong></span>
      </div>

      <ul v-if="s1.lastIngest.errors.length > 0" class="s1-panel__errors">
        <li v-for="problem in s1.lastIngest.errors" :key="problem.line">
          第 {{ problem.line }} 行 · {{ problem.code }} · {{ problem.message }}
        </li>
      </ul>

      <h3 class="s1-panel__subtitle">会话信息（GET /api/v1/sessions，只读）</h3>
      <p v-if="s1.session" class="s1-panel__meta">
        eventCount = {{ s1.session.eventCount }} · startedAtMs = {{ formatWallClock(s1.session.startedAtMs) }}
        · lastEventAtMs = {{ formatWallClock(s1.session.lastEventAtMs) }}
      </p>
      <p v-else class="s1-panel__meta">会话列表中尚未出现 {{ S1_SESSION_ID }}（读回可能仍在进行）。</p>

      <h3 class="s1-panel__subtitle">
        读回事件（原始列表 seq / type / kind / status / nodeKey，只读，无图）
      </h3>
      <p v-if="earlierPagesHidden" class="s1-panel__meta">
        仅显示最近一页：seq {{ firstSeq }}–{{ lastSeq }}，共 {{ eventCount }} 条；更早事件未读取，未做持续轮询。
      </p>
      <p v-if="nextSeqBehind" class="s1-panel__meta">
        nextSeq ({{ s1.page?.nextSeq }}) &lt; eventCount ({{ eventCount }})：读回期间可能有新事件写入，本页仅覆盖到 seq {{ lastSeq }}。
      </p>

      <div class="table-scroll">
        <table class="event-table">
          <thead>
            <tr>
              <th scope="col">seq</th>
              <th scope="col">type</th>
              <th scope="col">kind</th>
              <th scope="col">status</th>
              <th scope="col">nodeKey</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in events" :key="row.seq">
              <td>{{ row.seq }}</td>
              <td><code>{{ row.event.type }}</code></td>
              <td>{{ row.event.kind }}</td>
              <td><span class="status-tag">{{ row.event.status }}</span></td>
              <td><code>{{ row.event.nodeKey }}</code></td>
            </tr>
            <tr v-if="events.length === 0">
              <td colspan="5" class="s1-panel__empty">
                该会话暂无读回事件；collector 内存存储在重启后清空。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="s1-panel__footnote">
        说明：agent 的真实 controller span 属于会话 <code>s_s1agent</code>，本面板按 S1 边界不展示，
        且与 S2 事实链无关联；service / mapper / SQL 未采集，查询只读取已存事件，不重跑程序。
      </p>
    </template>
  </section>
</template>
