# TraceBoard workbench

Vue 3 + TypeScript + Vite + Pinia, local styling only (no CDN, no external fonts or assets).

## S1 walking skeleton panel

The "S1 Walking skeleton" panel posts a **fake** click/fetch batch and displays
what the collector actually stored:

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
   when earlier pages were not read. This is a query, not replay, and not
   continuous polling.
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
(the collector). Start the collector first; if it is not running the panel
shows "collector 不可达：http://127.0.0.1:8601" with a start hint and does not crash.

**Preview limitation:** the proxy is configured for the dev server only.
`npm run preview` / serving `dist/` statically has no proxy, so the S1 panel
reports the collector as unreachable there. Use `npm run dev` for the S1 demo.

## Build

```bash
npm ci && npm run build   # vue-tsc --noEmit (strict) + vite build
```

The S0 fixture facts panel (`Fixtures / case-a-zero-rows`) is unchanged; its
copy under `public/fixtures/` is produced by `scripts/sync-fixtures.mjs`
(predev/prebuild).
