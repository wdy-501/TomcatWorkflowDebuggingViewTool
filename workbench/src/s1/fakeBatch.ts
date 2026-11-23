/**
 * S1 fake click/fetch batch builder.
 *
 * One button click produces exactly 2 fresh, schema-valid events that share a
 * new session, traceId and rootEventId (click id):
 *   1. ui_event  #btn-s1-fake             parentSpanId=null, [0ns, 12ms]
 *   2. fetch     POST /api/orders/1/cancel  parentSpanId=<click spanId>, [2ms, 12ms]
 *
 * These events are synthesized in the browser — no real DOM instrumentation,
 * no fetch/XHR interception, no traceparent propagation. The 200 is a fixed
 * value; no request to the demo backend is made. Same shape as
 * fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson.
 *
 * `source` is omitted rather than set to null: schema v1 types `source` as an
 * object, so its schema-valid "unknown" form is absence.
 */

import type { SkeletonEvent } from "../api";

/** Fixed demo session so the read-back path is stable (s1-plan §14-D8). */
export const S1_SESSION_ID = "s_wb_demo";

const DEMO_THREAD = { id: 0, name: "browser-main" } as const;

const CLICK_NODE_KEY = "#btn-s1-fake";
const FETCH_NODE_KEY = "POST /api/orders/1/cancel";

const FLAGS = ["SKELETON", "S1_WALKING_SKELETON"] as const;

/** Lowercase hex string of `byteLength * 2` characters. */
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Build the 2-event batch. Every call returns new identifiers, so repeated
 * clicks never collide with the collector's idempotency key
 * (sessionId, traceId, spanId).
 */
export function createFakeClickBatch(): [SkeletonEvent, SkeletonEvent] {
  const traceId = randomHex(16); // 32 lowercase hex chars
  const clickSpanId = randomHex(8); // 16 lowercase hex chars
  const fetchSpanId = randomHex(8); // 16 lowercase hex chars
  const rootEventId = `click_${randomHex(8)}`; // click_ + 16 hex

  const click: SkeletonEvent = {
    schema: "traceboard.event.v1",
    type: "span",
    sessionId: S1_SESSION_ID,
    traceId,
    spanId: clickSpanId,
    parentSpanId: null,
    rootEventId,
    kind: "ui_event",
    nodeKey: CLICK_NODE_KEY,
    thread: { ...DEMO_THREAD },
    startNs: 0,
    durNs: 12000000,
    status: "OK",
    return: null,
    confidence: "EXACT",
    flags: [...FLAGS],
  };

  const fetchEvent: SkeletonEvent = {
    schema: "traceboard.event.v1",
    type: "span",
    sessionId: S1_SESSION_ID,
    traceId,
    spanId: fetchSpanId,
    parentSpanId: clickSpanId,
    rootEventId,
    kind: "fetch",
    nodeKey: FETCH_NODE_KEY,
    thread: { ...DEMO_THREAD },
    startNs: 2000000,
    durNs: 10000000,
    status: "OK",
    return: { type: "http", value: 200 },
    confidence: "EXACT",
    flags: [...FLAGS],
  };

  return [click, fetchEvent];
}
