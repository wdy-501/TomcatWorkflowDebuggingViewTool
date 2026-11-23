/**
 * Read-only loader for the case-A fixture copy under public/fixtures/.
 * The copy is produced by scripts/sync-fixtures.mjs (predev/prebuild).
 * Nothing here writes back, reports, or mutates the fixture.
 */

export interface EventRow {
  schema: string;
  type: string;
  sessionId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  rootEventId: string;
  kind: string;
  nodeKey: string;
  status: string;
  flags: string[];
}

export interface FactAssertion {
  path: string;
  value: string | number | boolean | null;
}

export interface ExpectedFact {
  id: string;
  kind: string;
  nodeKey: string;
  status: string;
  assert: FactAssertion;
  summary: string;
}

export interface ExpectedFacts {
  schema: string;
  caseId: string;
  source: string;
  eventCount: number;
  traceId: string;
  rootEventId: string;
  noExceptions: boolean;
  confidenceAllExact: boolean;
  statusAllOk: boolean;
  flagRequired: string;
  facts: ExpectedFact[];
}

const CASE_DIR = "case-a-zero-rows";
const FIXTURE_BASE = `${import.meta.env.BASE_URL}fixtures/${CASE_DIR}/`;

async function fetchText(fileName: string): Promise<string> {
  const url = `${FIXTURE_BASE}${fileName}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`读取 ${url} 失败：HTTP ${response.status}`);
  }
  return response.text();
}

/** Parse a JSONL file: one compact JSON object per non-empty line. */
export function parseEventsJsonl(text: string): EventRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as EventRow;
      } catch (cause) {
        throw new Error(`第 ${index + 1} 行不是合法 JSON：${String(cause)}`);
      }
    });
}

export async function loadEvents(): Promise<EventRow[]> {
  return parseEventsJsonl(await fetchText("events.jsonl"));
}

export async function loadExpectedFacts(): Promise<ExpectedFacts> {
  return JSON.parse(await fetchText("expected-facts.json")) as ExpectedFacts;
}

export function hasFlag(row: EventRow, flag: string): boolean {
  return Array.isArray(row.flags) && row.flags.includes(flag);
}