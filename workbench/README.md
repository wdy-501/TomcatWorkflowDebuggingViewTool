# TraceBoard workbench

Vue 3 + TypeScript + Vite + Pinia, local styling only (no CDN, no external fonts or assets).

## S2 0-row fact chain panel (primary)

`#s2-panel` reads the collector's read-only derivations and shows one real
cancel request end-to-end:

1. Session input `#s2-session` (default `s_s2agent`); type another session id
   and press Enter to switch. The datalist offers sessions from
   `GET /api/v1/sessions`.
2. `GET /api/v1/sessions/{sessionId}/requests` renders the request list
   `#s2-requests` (short traceId, root nodeKey, status, spanCount, confidence,
   hasError). Clicking a request switches the selection.
3. `GET /api/v1/sessions/{sessionId}/graph?traceId=...` renders the fact chain
   `#s2-chain` as an indented list with CSS connectors (no graph library),
   ordered by `startNs`. Each node shows kind / nodeKey / status /
   return / sideEffects, plus thread, startNs and duration.
4. Fact strip (neutral, no green/red verdict): `Controller HTTP`,
   `Service 返回`, `Mapper 返回`, `SQL 影响`, `异常（THREW）` — always labelled
   `事实摘要，不是缺陷结论`. A missing kind or a null return shows `未采集`
   (never `0`); `THREW` is the only red style, while `OK` with a `0`/`false`
   return stays neutral. A `LOST` request is labelled
   `游离后端请求（无前端根）`.
5. Refresh: button `#s2-refresh` plus a 5 s poll that only runs while the page
   is visible (`每 5 秒刷新（非实时）`). No push channel is used.
6. States: collector down → error banner plus a stale-data note; unknown
   session → 404 banner; empty session → empty state. The panel never falls
   back to fixture data, so a displayed `0 行` is the collector's fact.

The S2 panel and the S1 fake panel are **not** correlated: S1 events live in
`s_wb_demo`, the agent chain lives in `s_s2agent`.

## S1 walking skeleton panel (secondary, collapsed)

The "S1 Walking skeleton" panel is collapsed under
`S1 walking skeleton（假数据，非 S2 事实链）` and posts a **fake** click/fetch
batch, then displays what the collector actually stored:

1. Button `发送假点击/请求` (`#btn-s1-fake`) builds 2 fresh schema-valid events
   (`ui_event` → `fetch`) with a new traceId/spanIds/rootEventId per click,
   session `s_wb_demo`; events are synthesized in the browser (no DOM
   instrumentation, no fetch/XHR interception, no request to the demo backend).
2. The batch is posted as `application/x-ndjson` with a trailing newline to
   `POST /ingest/v1/events`.
3. After the 202, the panel performs one bounded read-back:
   `GET /api/v1/sessions` for `eventCount`, then
   `GET /api/v1/sessions/s_wb_demo/events?afterSeq=max(0, eventCount-200)&limit=200`,
   retried once (300 ms) only if the page came back empty. The tail page is
   read so the newest events stay visible past 200 stored events; the UI states
   when earlier pages were not read. This is a query, not a subscription.
4. The table shows `seq / type / kind / status / nodeKey` plus session id,
   accepted/rejected/dropped counts, event count and `nextSeq`. Read-only, no graph.

The agent's real `controller` span lives in session `s_s1_agent` and is **not**
shown or correlated here — S1 has no correlation.

## Dev server and the collector proxy

```bash
cd workbench
npm ci
npm run dev   # http://localhost:5173, strictPort
```

`vite.config.ts` proxies `/ingest` and `/api` to `http://127.0.0.1:8601`
(the collector). Start the collector first; if it is not running the S2 panel
shows "collector 不可达：http://127.0.0.1:8601" with a start hint, and the S1
panel shows its own unreachable message; neither crashes.

**Preview limitation:** the proxy is configured for the dev server only.
`npm run preview` / serving `dist/` statically has no proxy, so both panels
report the collector as unreachable there. Use `npm run dev` for the demo.

## Build

```bash
npm ci && npm run build   # vue-tsc --noEmit (strict) + vite build
```

The S0 fixture facts panel (`Fixtures / case-a-zero-rows`) is retained and
unchanged; its copy under `public/fixtures/` is produced by
`scripts/sync-fixtures.mjs` (predev/prebuild).
