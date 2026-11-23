import { initTraceBoard } from "@traceboard/sdk";
import type { TraceBoardHandle } from "@traceboard/sdk";

// S3 runtime SDK for the demo.
// - sessionId must match the collector/SDK session used by the E2E run (`s_s3demo`);
// - appName is the fixture-aligned prefix for `js_method` node keys
//   (case B expects `OrderEdit.vue#validateForm`);
// - init is idempotent and fail-open: a broken collector never breaks the page.
export const traceboard: TraceBoardHandle = initTraceBoard({
  ingestUrl: "/ingest",
  sessionId: "s_s3demo",
  appName: "OrderEdit.vue"
});
