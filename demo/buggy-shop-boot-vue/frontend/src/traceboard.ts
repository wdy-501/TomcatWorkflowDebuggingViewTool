import { initTraceBoard } from "@traceboard/sdk";
import type { TraceBoardHandle } from "@traceboard/sdk";
import { demoIngestUrl } from "./api-base";
import { isStaticSim } from "./static-sim";

// S3 runtime SDK for the demo.
// - sessionId must match the collector/SDK session used by the E2E run (`s_s3demo`);
// - appName is the fixture-aligned prefix for `js_method` node keys
//   (case B expects `OrderEdit.vue#validateForm`);
// - ingest goes to the sibling `ingest` route of the demo document (works at `/demo/`,
//   `/app/demo/` and the document root without rebuilding);
// - init is idempotent and fail-open: a broken collector never breaks the page.
//
// Static simulation (`?static=1`, GitHub Pages) has no collector: the real SDK is NOT
// initialized and a no-op handle keeps the component code unchanged. It emits no events,
// so the workbench only ever shows pre-collected traces, never fabricated ones.
function createStaticNoopHandle(): TraceBoardHandle {
  return {
    wrapFn: <T extends (...args: any[]) => any>(_name: string, fn: T): T => {
      const wrapper = function (this: unknown, ...args: any[]): any {
        return fn.apply(this, args);
      };
      return wrapper as T;
    },
    uiEffect: (_text: string, _targetSelector?: string): void => {
      // no-op: static simulation never records traces
    },
    diagnostics: () => ({ pending: 0, queue: 0, drops: 0, sent: 0 })
  };
}

export const traceboard: TraceBoardHandle = isStaticSim()
  ? createStaticNoopHandle()
  : initTraceBoard({
      ingestUrl: demoIngestUrl(),
      sessionId: "s_s3demo",
      appName: "OrderEdit.vue"
    });
