#!/usr/bin/env node
/**
 * TraceBoard S0 + S1 + S2 + S3 + S4 independent verifier (tester deliverable).
 *
 * One-shot, re-runnable gate. All S0 checks are kept; the S1/S2 gates that the S3 contract
 * supersedes are migrated (dispatch S3 §4.8) without relaxing the remaining S0–S2 coverage:
 *
 *   S0 (kept)   V1/V1b/V1c/V4b case-A schema/facts/negatives/intervals; V2 real builds
 *               (root JDK21, demo JDK8, workbench, demo frontend); V3 agent bytecode 52;
 *               V6 workbench/demo artifacts + no external URLs + agent manifest;
 *               V8 secrets/telemetry/CDN hygiene (extended to the S3 SDK).
 *   S1-A/B      S1 fixtures + expected-facts consumer; agent jar shading/schema parity; Vite proxy.
 *   S1-C/D/F    ingest/query/workbench-path regression. S3 migration: capabilities.replay=true
 *               (still 5 keys) and /replay answers 200 (default window) instead of 404;
 *               stream/ws/links stay 404.
 *   S2-7/1/2/3/3b/5  S2 fixture + expected-facts; artifacts; demo 0-row defect; agent 4-span
 *               LOST chain (no headers, s_s2agent); unknown-id coverage limit; fail-open.
 *   S2-4/4F     requests/graph at runtime and over the ingested S2 fixture. S3 migration:
 *               /replay is now 200 (read-only window) and is asserted instead of 404.
 *   S2-6        workbench retains the S2 fact-chain panel + S0/S1 panels (S3 addition allowed);
 *               still no graph library / SSE / WS / canvas.
 *   S2-8        scope/security, re-migrated to the S3 surface: 7 collector routes (+replay),
 *               4 agent points exactly, agent header reading allowed (reflection only),
 *               workbench timeline/replay allowed; still no S4/S5, persistence, stream, CORS,
 *               secrets/telemetry/CDN/mirrors, embedded H2 only, one schema copy.
 *
 *   S3-1   builds: frontend/sdk npm ci + build + `node --test` (13 tests: 8 ESM + 5 IIFE),
 *          demo frontend (SDK file: dep, /ingest proxy, case B strings, traceparent in dist),
 *          workbench, root JDK21 (incl. server/launcher in the reactor), demo JDK8, agent 52.
 *   S3-2   fixtures: case A 7 / case B 3 schema-valid, parent chains, EXACT, SQL 0, zero
 *          fetch in B, expected-facts + replayWindows deep comparison; S0–S2 fixtures and
 *          schema bytes unchanged vs the G1 freeze.
 *   S3-3   real header-join E2E: collector 8601 + demo JDK8 + agent session s_s3demo;
 *          ingest case-A click+fetch, POST cancel with traceparent/X-TraceBoard-Click ->
 *          4 backend spans on the same trace/root, controller.parentSpanId=fetch spanId,
 *          all EXACT, no LOST_BACKEND, 0 rows, no THREW; requests EXACT/fetchCount>=1/
 *          hasBackend/backendSpanCount>=4/spanCount>=6; graph joins click->fetch->controller;
 *          no-header and invalid-header requests -> S2 LOST 4-span + stderr header counter.
 *   S3-4   collector replay/requests over the S3 fixtures (separate sessions): requests A/B
 *          fields, graph A 7/6 + B 3/2 nodes/edges, replay default/toNs/fromNs windows from
 *          expected-facts, repeated GET byte-identical, events/seq untouched, 400/404/405,
 *          meta replay=true, stream/ws/links 404.
 *   S3-5   replay 0-write with collector+demo running: event count/seq and demo order
 *          unchanged, no THREW, readOnly=true, workbench replay path is GET-only (static).
 *   S3-6   workbench dist: S3 strings/selectors, S0/S1/S2 panels retained, state semantics,
 *          no graph library/SSE/WS/sourcemap.
 *   S3-7   case B evidence: fixture + collector requests prove sdkActive/fetchCount 0/
 *          hasBackend false/root EXACT; workbench verdict strings; SDK tests prove the
 *          RETURNED_FALSE wrapFn shape and the zero-fetch path.
 *   S3-8   scope/security: S5 values/manifest allowed, still no L2/.map-decoding/pixel replay/SSE/WS,
 *          persistence, no secrets/telemetry/CDN/mirrors/PII in the SDK, loopback only,
 *          no external $ref. S4 launcher/IDEA/JAR is allowed (removed from the markers).
 *   S3-9   regression: S2 no-header 4-span LOST, DB 0 rows, demo unknown 404, S1 ingest/query,
 *          S0 fixture, S2 workbench panel.
 *   S3-10  cleanup: ports free (S4 adds 8602/18080), no java leftovers, git index untouched,
 *          git status within the S5 whitelist, no product file modified by the verify run.
 *
 *   S4-A   launcher `idea` (JDK21 jar built by the reactor): exact absolute -javaagent, derived
 *          <collector>/ingest/v1/events, session, 5-step checklist, exit 0, no child process;
 *          missing arg/failed jar/agent tokens; legacy --ingest/--ingest-url -> exit 2.
 *   S4-B   launcher `jar --detach` (JDK8 absolute --java) + `stop`: collector on 8601, session
 *          s_s4launcher, health, agent hello connected, POST cancel -> events, PID/log files,
 *          stop releases 8080, repeat stop NOT_RUNNING, foreign pid file PID_MISMATCH, no orphan.
 *   S4-C   handshake: exact 200 body, order 405->415->413->400, GET agent 200 shape/404/405,
 *          last-wins, 4096B cap, no events/seq/session/meta change, business routes still 9.
 *   S4-D   preview (127.0.0.1:18080 stub -> launcher preview 8602): injection before the last
 *          </body> with two external scripts, recomputed Content-Length, stripped
 *          Content-Encoding/Transfer-Encoding/ETag/Last-Modified, config.js/sdk.js, byte-exact
 *          gzip, not-injected codes (head/no_body/status/encoding/not_html/too_large/read_error),
 *          /ingest/v1/events proxy 202 + other /ingest/* 404 + target down 502, TLS/non-loopback/
 *          SDK_IIFE_MISSING tokens, port cleanup.
 *   S4-E   SDK IIFE: dist 3 files, no sourcemap/CDN, global version, vm auto-init exactly once,
 *          double-load guard, no-config and bad-config fail-open, ESM tests still green (17/17).
 *   S4-F   fixtures/s4-details: 9 schema-valid events -> requests (LOST/9 spans), graph 9/8 with
 *          exactly the 15 ordered node fields (reason/source/confidence + S5 values:null), replay;
 *          static ×N grouping/gaps (exactly 3, F>N>R, no browser) + workbench dist selectors and
 *          strings; fixture F rule asserted with an inline ui_event+fetch batch (not the fixture).
 *   S4-G   diagnose: 7 checks/SUMMARY both branches (no --preview-url -> skip=2 exit 0; full
 *          preview -> fail=0 exit 0); missing session/app down/preview not injected -> FAIL exit 3;
 *          counts sum 7, no fake PASS.
 *   S4-H   regression: S0–S3 gates still PASS, agent hello is not an event (span counts unchanged),
 *          schema/S0–S3 fixture bytes unchanged, S4/S5 G1 freeze zero drift.
 *   S4-I   scope/security/cleanup: S5 allowed, no S6+, no secrets/CDN/mirrors, launcher/preview
 *          loopback + no TLS/CSP rewrite/inline script, ports 8601/8080/5173/5174/4173/4174/8602/
 *          18080 free, no java/node leftovers, git index untouched, product files stable.
 *
 * Exit code 0 only when every gate passes. Product files are never modified; the only
 * writes are build outputs (target/, dist/, workbench/public/fixtures/) produced by the
 * product's own build commands, plus OS temp files that are deleted afterwards.
 *
 * Tester part 3 implements S4-F/S4-G (tester parts 1-2 built S4-BUILD + S4-A..E); tester part 4
 * closes S4 with S4-H (S0–S3 regression + freeze) and S4-I (scope/security/cleanup). S4-H reads
 * the earlier RESULTS, so it only passes in a full run. A normal run executes S0–S3 plus A..I.
 *
 * Usage (from tools/verify):  npm ci && node verify.mjs [--json]                  (full S0–S6a; S6 partial)
 *                             node verify.mjs --s4[=A,B,C,D,E,F,G,H,I] [--json]   (S4-only)
 *                             node verify.mjs --s5[=A,B,C,D,E,F,G,H] [--json]    (S5-only; G anchors need a full run)
 *                             node verify.mjs --s6a[=A,B,C,D,E] [--json]         (S6a-only; E anchors need a full run)
 */

import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "..", "..");

const JDK21_HOME = process.env.TB_JDK21_HOME || "C:/Program Files/Java/jdk-21";
const JDK8_HOME = process.env.TB_JDK8_HOME || "C:/Program Files/Java/jdk1.8.0_221";
const JDK21_JAVA = `${JDK21_HOME}/bin/java.exe`;
const JDK8_JAVA = `${JDK8_HOME}/bin/java.exe`;
const JDK21_JAVAP = `${JDK21_HOME}/bin/javap.exe`;

const SCHEMA_REL = "schema/traceboard.event.v1.json";
const EVENTS_REL = "fixtures/case-a-zero-rows/events.jsonl";
const FACTS_REL = "fixtures/case-a-zero-rows/expected-facts.json";
const PLAN_REVIEW_REL = "docs/plans/stages/S0/plan-review.md";

const S1_BATCH_REL = "fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson";
const S1_AGENT_SPAN_REL = "fixtures/s1-walking-skeleton/agent-controller-span.json";
const S1_FACTS_REL = "fixtures/s1-walking-skeleton/expected-facts.json";
const S1_AGENT_NODE_KEY = "com.example.shop.controller.OrderController#cancel";
const S1_WORKBENCH_SESSION = "s_wb_demo";
const S1_PORTS = [8601, 8080, 5173, 5174, 4173, 4174, 8602, 18080];

/* ---------------------------- S2 (0-row fact chain) ---------------------------- */

const S2_PLAN_REVIEW_REL = "docs/plans/stages/S2/plan-review.md";
const S2_EVENTS_REL = "fixtures/s2-zero-row-chain/events.ndjson";
const S2_FACTS_REL = "fixtures/s2-zero-row-chain/expected-facts.json";
const S2_SESSION = "s_s2agent"; // dispatch §4.2 default session of the S2 agent
const S2_TRACE_ID = "9f8e7d6c5b4a39281706f5e4d3c2b1a0"; // fixture traceId (not used at runtime)
const S2_ROOT_SPAN_ID = "1a2b3c4d5e6f7a80";
const S2_ROOT_EVENT_ID = `click_lost_${S2_ROOT_SPAN_ID}`;
const S2_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#cancel";
const S2_SERVICE_NODE_KEY = "com.example.shop.service.OrderService#cancel";
const S2_MAPPER_NODE_KEY = "com.example.shop.mapper.OrderMapper#cancelById";
const S2_SQL_NODE_KEY = "OrderMapper.cancelById";
const S2_FLAG_CHAIN = "S2_ZERO_ROW_CHAIN";
const S2_FLAG_LOST_BACKEND = "LOST_BACKEND";
const S2_RESPONSE_ENTITY_TYPE = "org.springframework.http.ResponseEntity";

/* ---------------------------- S3 (frontend facts + read-only replay) ---------------------------- */

const S3_PLAN_REVIEW_REL = "docs/plans/stages/S3/plan-review.md";
const S3_CASE_A_DIR = "fixtures/s3-frontend-facts/case-a-joined-chain";
const S3_CASE_A_EVENTS = `${S3_CASE_A_DIR}/events.ndjson`;
const S3_CASE_A_FACTS = `${S3_CASE_A_DIR}/expected-facts.json`;
const S3_CASE_B_DIR = "fixtures/s3-frontend-facts/case-b-frontend-only";
const S3_CASE_B_EVENTS = `${S3_CASE_B_DIR}/events.ndjson`;
const S3_CASE_B_FACTS = `${S3_CASE_B_DIR}/expected-facts.json`;
const S3_README_REL = "fixtures/s3-frontend-facts/README.md";
const S3_SESSION = "s_s3demo";
const S3_VERIFY_A_SESSION = "s_s3verify_a";
const S3_VERIFY_B_SESSION = "s_s3verify_b";
const S3_FRONTEND_KINDS = ["ui_event", "js_method", "fetch", "callback", "render"];
const S3_BACKEND_KINDS = ["controller", "service", "mapper", "sql", "jdbc", "async"];
const S3_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#cancel";
const S3_SERVICE_NODE_KEY = "com.example.shop.service.OrderService#cancel";
const S3_MAPPER_NODE_KEY = "com.example.shop.mapper.OrderMapper#cancelById";
const S3_SQL_NODE_KEY = "OrderMapper.cancelById";
const S3_FLAG_SDK_ACTIVE = "SDK_ACTIVE";
const S3_FLAG_EXACT_LINK = "S3_EXACT_LINK";
const S3_CASE_B_VERDICT_TEXT = "已确认：本次点击因果链内没有网络请求";
const S3_CASE_B_UNKNOWN_TEXT = "无法确认：前端采集未接入";
const S3_CASE_B_FETCH_LOST_TEXT = "前端已发请求但后端未采集（LOST）";

const SDK_DIR = "frontend/sdk";
const SDK_DIST_REL = "frontend/sdk/dist";
const SDK_REQUIRED_SCRIPTS = ["build", "test"];
const S3_DEMO_FRONTEND_REL = "demo/buggy-shop-boot-vue/frontend";
const S3_DEMO_EXPECTED_FILES = [
  `${S3_DEMO_FRONTEND_REL}/index.html`,
  `${S3_DEMO_FRONTEND_REL}/package-lock.json`,
  `${S3_DEMO_FRONTEND_REL}/package.json`,
  `${S3_DEMO_FRONTEND_REL}/src/App.vue`,
  `${S3_DEMO_FRONTEND_REL}/src/main.ts`,
  `${S3_DEMO_FRONTEND_REL}/src/style.css`,
  `${S3_DEMO_FRONTEND_REL}/src/traceboard.ts`,
  `${S3_DEMO_FRONTEND_REL}/tsconfig.json`,
  `${S3_DEMO_FRONTEND_REL}/vite.config.ts`,
];
const S3_SELECTORS = [
  "s3-panel", "s3-session", "s3-refresh", "s3-tabs", "s3-ops",
  "s3-tree", "s3-timeline", "s3-replay-toggle", "s3-readonly", "s3-caseb",
];
/* ------------------------------------------------------------------ */
/* S6b canonical copy (dispatch §4.5 / api.v1.md §10.11, verbatim)      */
/* ------------------------------------------------------------------ */

/**
 * S6 banner (api.v1.md §10.11). It SUPERSEDES the S6a banner; the old S6a copy survives only
 * as a reverse (stale) literal in S5_STALE_TEXTS below and must not be asserted positively.
 */
const S6_BANNER = "S6：L2 行级（reconcileAmount）、异步继承（reconcileAsync）、无调试信息（NoDebugService#compute，NOT_COLLECTED_NO_DEBUG_INFO）、循环折叠（reconcileLoop）；长生命周期线程池不自动传播；行级字段写入/对象深采/多方法 L2 未支持";
/** S6 L2 explanation (replaces the S6a L2 note). */
const S6_L2_NOTE = "S6 L2：行级局部变量来自 LVT 探针（reconcileAmount 第 2 次 100 → 0；reconcileLoop 折叠保留首/尾/样本）；异步子线程创建时继承上下文（ASYNC_INHERITED）；长生命周期线程池不自动传播";
/** S6 ×N note (replaces the S6a ×N note). */
const S6_XN_NOTE = "×N 为已采集 span 的前端聚合；运行时 ×3 仅 L2DemoService#reconcileAmount 与 reconcileAsync（单异步线程内）演示；其他方法无运行时 ×3";
/** No-debug explanation (grey, never a success claim). */
const S6_NO_DEBUG_NOTE = "S6 无调试信息：NoDebugService#compute 无 LocalVariableTable，状态 NOT_COLLECTED_NO_DEBUG_INFO；不猜变量名/行号";
/** Fold-note template; N = VALUES_CAPPED (dropped), M = VALUES_TOTAL. */
const S6_FOLD_NOTE_TEMPLATE = "已折叠 N 次（VALUES_CAPPED=N；共 M 次）";
/** S6a copies superseded by S6b (reverse literals only; never positive tokens). */
const S6A_STALE_BANNER = "S6a：仅 L2DemoService#reconcileAmount 采集行级局部变量（L2）与逐次 ×3；其他方法无 L2；异步/无调试信息/循环折叠/开销属 S6b";
const S6A_STALE_L2_NOTE = "S6a L2：行级局部变量来自 LVT 探针（样例第 2 次调用 local 100 → 0）；异步/无调试信息/循环折叠/开销属 S6b";
const S6A_STALE_XN_NOTE = "×N 为已采集 span 的前端聚合；运行时 ×3 已在 L2DemoService#reconcileAmount 演示；其他方法无运行时 ×3";
const S6A_STALE_SEGMENT = "异步/无调试信息/循环折叠/开销属 S6b";

const S3_WORKBENCH_TOKENS = [
  "已确认：本次点击因果链内没有网络请求",
  "无法确认",
  "观察中",
  "只读",
  "RETURNED_FALSE",
  "时间轴",
  "replay",
  "sdkActive",
  "fetchCount",
  "回放不会重发请求、不写数据库、不调用 demo、不执行程序；",
  // S5 migration (B3): the old "JS 内部变量本次未采集（无构建插件/sourcemap）" copy is gone.
  "JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）",
  // S6b migration (§10): the canonical S6 banner replaces the old S6a banner.
  S6_BANNER,
];
const S3_STATE_SEMANTICS = [
  "OK", "RETURNED_FALSE", "THREW", "NOT_COLLECTED_", "TRUNCATED", "REDACTED", "UNKNOWN", "LOST",
];
const S3_SEMANTIC_HINTS = [
  "正常返回 false", "已截断/已折叠", "为什么没采到/怎么开启", "琥珀", "问号", "条纹",
];

/* Shared evidence captured by earlier S3 gates and re-used by later ones (report-only). */
const S3_EVIDENCE = { sdkTestStdout: "", sdkTestStderr: "", caseB: null, caseA: null };

/* ---------------------------- S4 (local launcher + details) ---------------------------- */

const S4_PLAN_REVIEW_REL = "docs/plans/stages/S4/plan-review.md";
const S4_FIXTURE_DIR = "fixtures/s4-details";
const S4_EVENTS_REL = "fixtures/s4-details/events.ndjson";
const S4_FACTS_REL = "fixtures/s4-details/expected-facts.json";
const S4_README_REL = "fixtures/s4-details/README.md";
const S4_LAUNCHER_DIR = "server/launcher/src/main/java/io/traceboard/launcher";
const S4_LAUNCHER_JAR_REL = "server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar";
const S4_SDK_IIFE_REL = "frontend/sdk/dist/traceboard-sdk.iife.js";
const S4_PREVIEW_BASE = "http://127.0.0.1:8602";
const S4_STUB_PORT = 18080;
const S4_SESSION = "s_s4launcher";
const S4_PREVIEW_SESSION = "s_s4preview";
const S4_HELLO_SESSION = "s_s4hello";
const S4_PROBE_SESSION = "s_s4probe";
const S4_DETAIL_SESSION = "s_s4detail";
const S4_GUIDE_REL = "docs/guides/local-launcher.md";
const S4_META_KEYS = ["health", "meta", "ingestEvents", "realtime", "replay"];
const S4_HELLO_ACCEPTED = '{"schema":"traceboard.agent.v1","sessionId":"s_s4hello","accepted":true}';
const S4_GRAPH_NODE_KEYS_ORDERED = [
  "spanId", "parentSpanId", "kind", "nodeKey", "status", "return", "sideEffects",
  "startNs", "durNs", "thread", "flags", "reason", "source", "confidence",
  // S5 additive 15th field (api.v1.md §10.9): raw values[] or null; S2–S4 fixtures expect null.
  "values",
];
const S4_SELECTORS = [
  "s4-detail", "s4-detail-title", "s4-detail-status", "s4-detail-tabs", "s4-sideeffects",
  "s4-ui-effects", "s4-invocations", "s4-invocation-select", "s4-gaps", "s4-group-badge",
  "s4-detail-close",
];
const S4_GAP_EMPTY_TEXT = "未发现缺口（仅基于已采集数据；未采集项不会显示为成功）";
const S4_FETCH_WITHOUT_BACKEND_TEXT = "后端未采集/未关联";
const S4_RUNTIME_X3_NOTE = S6_XN_NOTE;
/** S4-G sessions/URLs (diagnose cases). */
const S4_DIAG_SESSION = "s_s4diag";
const S4_DIAG_MISSING_SESSION = "s_s4missing";
const S4_DIAG_APP_URL = "http://localhost:8080/api/orders";
const S4_DIAG_APP_DOWN_URL = "http://127.0.0.1:9/api/orders";
/** Fixed diagnose order (S4-AMD-01 §3); each run prints exactly these seven rows. */
const S4_DIAG_CHECKS = [
  "collector_health", "collector_meta", "app_health", "agent_handshake",
  "recent_events", "preview_injection", "sdk_script",
];
/** Static workbench tokens/panels asserted on workbench/dist after `npm run build`. */
const S4_DIST_TOKENS = [
  "节点详情", "×N", "未采集", "缺口", "rowsAffected", "reason", "逐次调用",
  "SQL/数据影响", "UI 效果", S4_RUNTIME_X3_NOTE, S4_FETCH_WITHOUT_BACKEND_TEXT,
  "未采集（无 reason）", S4_GAP_EMPTY_TEXT,
];
const S4_RETAINED_PANELS = ["s3-panel", "s2-panel", "s1-panel", "fixture-panel"];
/** Final S4 G1 freeze (plan-review §8.1 + §9 transport re-hash); zero drift is asserted. */
const S4_G1_FREEZE = {
  "schema/traceboard.event.v1.json": "927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a",
  "docs/contracts/api.v1.md": "f701f424016156993e1c537aa12d370955cc023530ecfe9e72f580d83bcee4e5",
  "docs/contracts/transport.v1.md": "44418a3a6985538e3af9d19e0303a57070b8fafa135f2e92b8a75b4309576dfe",
  "docs/contracts/event-model.v1.md": "06ee878e9d3acc3d6a6ff66ee1e1d95c92ac5813913cc1ad84ae3977216025c0",
  "docs/contracts/status-semantics.md": "9a8735a0fcf67c471c9f831651996c5f5027f53dd4762147bdedc1b143f4fb56",
  "docs/guides/local-launcher.md": "34efa2f67dadb9ce0725b7c38f9434fc10653cd27a7128c62319b01aa253ade1",
  "fixtures/s4-details/events.ndjson": "75274346ed7593f2aef304d2d7a0989d969e1fdcea4330169422a4cff89d853b",
  "fixtures/s4-details/expected-facts.json": "61c2bfcc79a7a568b03cc759445495a0671ad517be2d2ea1db3a410649117980",
  "fixtures/s4-details/README.md": "b4f838500bac3970581b133e47c3bf08b57e6f49220147f4418f70c2a51a8f8a",
  "docs/plans/stages/S4/s4-plan.md": "9147ce254bd8bc6e861433e02226aac87e65a6fcd7a8df3e1ec7477ff11b2300",
  "docs/plans/stages/S4/dispatch.md": "9dd9809f4c02bc10739e2eb9c6359fa95aef54872de3ddd87d7bb194312951eb",
  "docs/plans/stages/S4/dispatch-amendment-01.md": "e6097f63c1c3b6e5160b077c570292bef243dd2283267a2ff7e883a65a6d59dc",
};
const S4_EVIDENCE = { launch: null, hello: null, preview: null, details: null, diagnose: [] };

/**
 * S4 checks implemented now (BUILD + A..I). The default selection only runs gates that actually
 * exist (never fake PASS); S4-H reads the earlier RESULTS and therefore needs a full run.
 */
const S4_IMPLEMENTED = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

/** S4-H anchors: the S0–S3 gates that must all PASS before S4 can be closed. */
const S4_H_ANCHORS = [
  "V0", "V1", "V1b", "V1c", "V4b", "V2a", "V2b", "V2c-1", "V2c-2", "V3",
  "V6a", "V6b", "V6c", "V6d", "V8a", "V8b", "V8d",
  "S1-A", "S1-B", "S1-C0", "S1-C1", "S1-C2", "S1-C3", "S1-D", "S1-F",
  "S2-1", "S2-2", "S2-3", "S2-3b", "S2-4", "S2-4F", "S2-5", "S2-6", "S2-7", "S2-8", "S2-L",
  "S3-1", "S3-2", "S3-3", "S3-4", "S3-5", "S3-6", "S3-7", "S3-8", "S3-9", "S3-10",
];
const S4_H_SCHEMA_HASH = "927937dfaa2d1f47883d3e412185c19be1770a85c9b19b6858b1e097b96a489a";

/** S4-I: source trees scanned for S6+ capabilities (S5 values/manifest are allowed). */
const S4_SCOPE_TREES = [
  "server/launcher/src", "server/collector/src", "agent/src",
  "frontend/sdk/src", "workbench/src", "demo/buggy-shop-boot-vue/frontend/src",
];
const S4_LOCKFILES = [
  "frontend/sdk/package-lock.json", "workbench/package-lock.json",
  "demo/buggy-shop-boot-vue/frontend/package-lock.json",
];

/**
 * Parse the S4-only CLI selector. `--s4` (no value) or a missing flag at the top level runs all
 * implemented S4 gates; `--s4=A,B,C` restricts the selection. Returns null when `--s4` is absent
 * (normal full S0–S4 run).
 */
function parseS4Request(argv) {
  const arg = argv.find((item) => item === "--s4" || item.startsWith("--s4="));
  if (arg === undefined) return null;
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1).trim() : "";
  if (!raw) return new Set(S4_IMPLEMENTED);
  return new Set(raw.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean));
}

const S4_ONLY = process.argv.some((item) => item.startsWith("--s4"));
const S4_SELECTED = S4_ONLY ? (parseS4Request(process.argv) ?? new Set(S4_IMPLEMENTED)) : null;

/* ------------------------------------------------------------------ */
/* S5 L1 + front-end shallow constants (tester part 1: builds/demo/agent)*/
/* ------------------------------------------------------------------ */

const S5_PLAN_REVIEW_REL = "docs/plans/stages/S5/plan-review.md";
const S5_FIXTURE_DIR = "fixtures/s5-l1-values";
const S5_EVENTS_REL = `${S5_FIXTURE_DIR}/events.ndjson`;
const S5_FACTS_REL = `${S5_FIXTURE_DIR}/expected-facts.json`;
const S5_README_REL = `${S5_FIXTURE_DIR}/README.md`;
/** Runtime agent session for the S5 L1 E2E (never the demo frontend session s_s3demo). */
const S5_SESSION = "s_s5agent";
const S5_FIXTURE_SESSION = "s_s5values";
const S5_DEMO_BACKEND_REL = "demo/buggy-shop-boot-vue/backend";
const S5_DEMO_FRONTEND_REL = "demo/buggy-shop-boot-vue/frontend";
const S5_BUILD_PLUGIN_REL = "frontend/build-plugin";
const S5_L1_FLAG = "L1";
const S5_FLAG_EXACT_LINK = "S3_EXACT_LINK";
const S5_PREVIEW_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#previewDiscount";
const S5_PREVIEW_SERVICE_NODE_KEY = "com.example.shop.service.OrderService#previewDiscount";
const S5_PREVIEW_PATH = "/api/orders/1/preview-discount";
const S5_PREVIEW_UNKNOWN_PATH = "/api/orders/999/preview-discount";
const S5_DEMO_SECRET = "s3cr3t";
const S5_NOTE_3000 = "x".repeat(3000);
const S5_NOTE_2048 = "x".repeat(2048);
/** api.v1.md §10.9 / dispatch §4.3: fixed 15 ordered graph node fields (15th = values). */
const S5_GRAPH_NODE_KEYS_ORDERED = [
  "spanId", "parentSpanId", "kind", "nodeKey", "status", "return", "sideEffects",
  "startNs", "durNs", "thread", "flags", "reason", "source", "confidence", "values",
];
/** Exact value-item order (api.v1.md Appendix D / s5-plan §5.3): params -> field -> return. */
const S5_VALUE_NAMES = ["requestedAmount", "demoSecret", "note", "amount", "return"];
const S5_VALUE_KINDS = ["param", "param", "param", "field", "return"];
/** S5 perf script (report-only; S5-F runs it and parses PERF_RESULT). */
const S5_PERF_REL = "tools/perf/l1-overhead.mjs";
const S5_VALUES_SELECTOR = "#s5-values";
/** Text that must be absent from workbench/demo src+dist after S5 (B3 honesty migration). */
const S5_STALE_TEXTS = [
  "无构建插件/sourcemap", "S5 待做", "无 S5", "S5/S6", "无 sourcemap/行号映射",
  // S6a migration (B2): the four superseded S5 absolute statements must not survive in src+dist.
  "S5：已有函数级 sourcemap/manifest 源信息；无构建期局部变量/L2（S6）",
  "运行时 ×3 属 S6",
  "无异步/×3",
  "无构建期局部变量/L2",
  // S6b migration (§10): the three superseded S6a copies + the "属 S6b" segment are now stale.
  S6A_STALE_BANNER,
  S6A_STALE_L2_NOTE,
  S6A_STALE_XN_NOTE,
  S6A_STALE_SEGMENT,
];
/**
 * Claim text that must always stay absent (S5 is not L2; S6b proves inheritance/degradation/
 * folding only, never full async propagation or overhead compliance). Keep-only-grows (B2):
 * the original two entries stay and the S6b entries are appended.
 */
const S5_FORBIDDEN_CLAIMS = [
  "kind=local", "L2 已采集",
  "异步全量传播", "线程池自动传播", "无调试可采变量", "循环全量", "开销达标", "L2 开销 ≤40%",
];
/** S6a/S6b overclaim texts kept for the S6A-E/S6B-F reverse assertions (never grow-shrink). */
const S6_OVERCLAIM_TEXTS = [
  "异步上下文已采集", "无调试信息已处理", "循环折叠已实现", "L2 开销 ≤40%", "全部方法 L2", "L2 已采集",
];
/** S5 demo backend files allowed to change (tests/include the S6a/S6b demo additions). */
const S5_DEMO_BACKEND_ALLOWED = [
  "demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/controller/OrderController.java",
  "demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/OrderService.java",
  "demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/L2DemoService.java",
  "demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/NoDebugService.java",
  "demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/mapper/OrderMapper.java",
  "demo/buggy-shop-boot-vue/backend/src/main/resources/mapper/OrderMapper.xml",
  "demo/buggy-shop-boot-vue/backend/pom.xml",
];
/**
 * S5 G1 freeze (plan-review §7.1): supersedes the S4 hashes for api.v1.md / event-model.v1.md
 * and adds the frontend guide + S5 fixture + S5 plan/dispatch. S0–S4 transport/status/S4 files
 * stay at their frozen bytes.
 */
const S5_G1_FREEZE = {
  ...S4_G1_FREEZE,
  "docs/contracts/api.v1.md": "c95022d1d3e7c732d4ace6f519d245ffacb5179568a3ed3a60c39d73b78d5aa5",
  "docs/contracts/event-model.v1.md": "2a7fa58a1ab56cb10eeab98e8e084da401aa1b09cc4e32d19e40578d4c290706",
  "docs/guides/frontend-shallow-plugin.md": "5be0e29312b827c9bc60c71d1674b977af54f9b9b6886684bce0875d10136b9b",
  "fixtures/s5-l1-values/events.ndjson": "9fc9a62e11e39c933a6695282f52ac79331a094070aa2a85f5ea25b878c6126b",
  "fixtures/s5-l1-values/expected-facts.json": "705f5d12addf3756796cf13934f2d9cb49214ceeb8711a290e58534863c597f9",
  "fixtures/s5-l1-values/README.md": "94ddce605a5fb3fd9feaee6a5fe8d23e28c6987e49f912153a7be39ff1b80b20",
  "docs/plans/stages/S5/s5-plan.md": "11e7fa585504e9db74f4183c323c55409b1e1702c8f4308452e23371746dc5b1",
  "docs/plans/stages/S5/dispatch.md": "dd105631426c6c755b44f5c8952431829c0358e542e7320e57f9cd0813ec5fe9",
};

/**
 * S5 gates implemented by tester part 2: A/B/C (part 1) + D values/workbench,
 * E manifest/sourcemap, F perf, G regression/freeze, H scope/cleanup.
 */
const S5_IMPLEMENTED = ["A", "B", "C", "D", "E", "F", "G", "H"];
const S5_EVIDENCE = {
  javaBuild: null,
  demo: null,
  agent: null,
  fixture: null,
  sdk: null,
  plugin: null,
  demoFrontend: null,
  workbenchDist: null,
  perf: null,
};
/** One-run memoization for the S5 front-end builds/tests shared by S5-A/D/E. */
const S5_BUILD_CACHE = { sdk: null, plugin: null, demo: null, workbench: null };

/* ------------------------------------------------------------------ */
/* S6a L2 line-level locals + per-invocation ×3 (S6 stays partial)     */
/* ------------------------------------------------------------------ */

const S6_PLAN_REVIEW_REL = "docs/plans/stages/S6/plan-review-s6a.md";
const S6A_PLAN_REL = "docs/plans/stages/S6/s6a-plan.md";
const S6A_DISPATCH_REL = "docs/plans/stages/S6/dispatch-s6a.md";
const S6A_FIXTURE_DIR = "fixtures/s6-l2-lines";
const S6A_EVENTS_REL = `${S6A_FIXTURE_DIR}/events.ndjson`;
const S6A_FACTS_REL = `${S6A_FIXTURE_DIR}/expected-facts.json`;
const S6A_README_REL = `${S6A_FIXTURE_DIR}/README.md`;
/** Runtime agent session for the S6a L2 E2E (dispatch §8; never s_s3demo/s_s5agent). */
const S6A_SESSION = "s_s6a";
const S6A_FIXTURE_SESSION = "s_s6l2a";
const S6A_DEMO_BACKEND_REL = "demo/buggy-shop-boot-vue/backend";
const S6A_L2_SERVICE_REL = `${S6A_DEMO_BACKEND_REL}/src/main/java/com/example/shop/service/L2DemoService.java`;
const S6A_L2_FLAG = "L2";
const S6A_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#reconcile";
const S6A_SERVICE_NODE_KEY = "com.example.shop.service.L2DemoService#reconcileAmount";
const S6A_BANNER = S6_BANNER; // S6b migration: canonical banner (the S6a copy is only in S5_STALE_TEXTS)
const S6A_L2_NOTE = S6_L2_NOTE;
const S6A_XN_NOTE = S6_XN_NOTE;
/** S6A-D static dist tokens (dist literals only; dynamic Vue attrs are proven elsewhere). */
const S6A_WORKBENCH_TOKENS = [
  "s6-l2-badge", "s6-l2-note", "data-value-kind", "data-invocation-diff",
  "行号 ", "100 → 0", "值变化", S6A_BANNER, S6A_L2_NOTE, S6A_XN_NOTE,
];
/** Agent files allowed to carry L2/LVT terminology (S2-8/S3-8/S4-I/S5-H). */
const S6A_AGENT_L2_FILES = [
  "agent/src/main/java/io/traceboard/agent/L2ClassFileTransformer.java",
  "agent/src/main/java/io/traceboard/agent/L2Values.java",
  "agent/src/main/java/io/traceboard/agent/SpanContext.java",
  "agent/src/main/java/io/traceboard/agent/NoDebugClassFileTransformer.java",
];
const s6aL2Allowed = (rel) => S6A_AGENT_L2_FILES.includes(rel) || rel.startsWith("workbench/src/s6/");
/**
 * S6a G1 freeze (plan-review s6a §10.3 / s6a-plan §8.1.1): 8 newly frozen files. It SUPERSEDES the
 * S5 values for api.v1.md / event-model.v1.md (additive S6a notes only); the other 16 S5 entries
 * keep their S5 bytes (LATEST_G1_FREEZE below is the single comparison map).
 */
const S6A_G1_FREEZE = {
  "docs/contracts/api.v1.md": "4c895fd776c51f45eafcb4d31589d076270d11c0278afc16af16fb14c540d8f3",
  "docs/contracts/event-model.v1.md": "fc6ad919a65ae63367a251b4015596c81bb30d21116d48472ffc4d601f2d65c9",
  "fixtures/s6-l2-lines/events.ndjson": "ebf681135400c1dc6729c7f24135cf18e0243e660b24833689fda0832ab8bebc",
  "fixtures/s6-l2-lines/expected-facts.json": "5a9f1ea795a95fa8f76350be6fdf86a88a37eb6ad3139db9aadc17aab664969d",
  "fixtures/s6-l2-lines/README.md": "827247e3a7ed61da55e5c34c81e9e928d0fc11a449496713dfab869f62680b5a",
  "docs/plans/stages/S6/s6a-plan.md": "957f2409b6b6ec6b7626d54cbbfc45f7517f0e4e73376c927d6f494985248f8c",
  "docs/plans/stages/S6/dispatch-s6a.md": "c6dbda4d9a3d738d4168f875710fdd81ed10104b52273af1b2fb8156e4a52160",
  "docs/plans/stages/S6/plan-review-s6a.md": "cb41a56a607a469e0c5337837259050035bc9cf2b40c9f8008e80ffe960711e0",
};
/**
 * S6b G1 freeze (plan-review-s6b §5, 14 entries): the two contracts (additive S6b revisions) +
 * the three S6b fixtures (3 files each) + s6b-plan + dispatch-s6b + plan-review-s6b. It SUPERSEDES
 * the S5/S6a api/event-model hashes; the other S5/S6a entries keep their frozen bytes.
 */
const S6B_G1_FREEZE = {
  "docs/contracts/api.v1.md": "e1d7202ade2fad5f8665079e9f1b914a99ed29346a9000c9393cca6f689c6010",
  "docs/contracts/event-model.v1.md": "06aecbfe82672edb4df277ee96325faf190b2be46b458f205aa04a7ab0fc2f38",
  "fixtures/s6b-async/events.ndjson": "d03c2f8d804262569e0b2e3f33b9ecc0b74aee9bba340c60975ac6bab10275df",
  "fixtures/s6b-async/expected-facts.json": "7f0d484f33be5f38b113507c0bb889f2e227c9cdb3f42a158d5c3c0202b92468",
  "fixtures/s6b-async/README.md": "3d47e54ab389657464c7231eaef7e252072281a420fce8b9f32918e558b86a36",
  "fixtures/s6b-no-debug/events.ndjson": "caa25a1a6ca6ff3600705bada2ada909302ab8801c5b43cd8981734b4d8bd4c2",
  "fixtures/s6b-no-debug/expected-facts.json": "1e0badaa8773bbe083f0eb7bac8c04e2667ffaff617ca979072692dc7c5d50c1",
  "fixtures/s6b-no-debug/README.md": "58339d834972954e8b04036f0e3d91d29741efcc73ce756254f81a9bbb5ba772",
  "fixtures/s6b-loop/events.ndjson": "e21c3202cbf1a21a7537133d3291b872f2842e0c01c157bdd90f80e47e399c94",
  "fixtures/s6b-loop/expected-facts.json": "228b55c8c2f8f164b44209bb2ef9584c8129fdae2522afafc95f9e516f1a0ac6",
  "fixtures/s6b-loop/README.md": "15a551dd40b3334b314b003e7d3ac651a9f2dcdc7ff657e9195c299d1a030cab",
  "docs/plans/stages/S6/s6b-plan.md": "f237685d3101f0b21d1b416a8c0162869080d6c7d88fd8bb1c59459cbbaa546b",
  "docs/plans/stages/S6/dispatch-s6b.md": "690b16e63efc391f8d66765da96de4985c6f2c733532e78ab2203d2f405043c7",
  "docs/plans/stages/S6/plan-review-s6b.md": "d9b75a09f0077652aba731cc29c0aadb574aca01e38363110cac243700645126",
};
/** S6b supersedes api/event-model; every other S5/S6a entry stays at its own hash. */
const LATEST_G1_FREEZE = { ...S5_G1_FREEZE, ...S6A_G1_FREEZE, ...S6B_G1_FREEZE };

/* ------------------------------------------------------------------ */
/* S6b async / no-debug / loop-fold / workbench / perf                  */
/* ------------------------------------------------------------------ */

const S6B_PLAN_REVIEW_REL = "docs/plans/stages/S6/plan-review-s6b.md";
const S6B_PLAN_REL = "docs/plans/stages/S6/s6b-plan.md";
const S6B_DISPATCH_REL = "docs/plans/stages/S6/dispatch-s6b.md";
const S6B_FIXTURE_DIRS = ["fixtures/s6b-async", "fixtures/s6b-no-debug", "fixtures/s6b-loop"];
const S6B_FIXTURE_FILES = S6B_FIXTURE_DIRS.flatMap((dir) => ["events.ndjson", "expected-facts.json", "README.md"].map((name) => `${dir}/${name}`));
/** Runtime agent session for the S6b E2E gates (dispatch §12; never s_s3demo/s_s5agent). */
const S6B_SESSION = "s_s6b";
const S6B_NO_DEBUG_SERVICE_REL = "demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/service/NoDebugService.java";
const S6B_DEMO_POM_REL = "demo/buggy-shop-boot-vue/backend/pom.xml";
const S6B_ASYNC_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#reconcileAsync";
const S6B_NO_DEBUG_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#noDebug";
const S6B_LOOP_CONTROLLER_NODE_KEY = "com.example.shop.controller.OrderController#reconcileLoop";
const S6B_NO_DEBUG_NODE_KEY = "com.example.shop.service.NoDebugService#compute";
const S6B_LOOP_NODE_KEY = "com.example.shop.service.L2DemoService#reconcileLoop";
const S6B_ASYNC_FLAG = "ASYNC_INHERITED";
const S6B_NO_DEBUG_FLAG = "NO_DEBUG_INFO";
const S6B_NO_DEBUG_STATUS = "NOT_COLLECTED_NO_DEBUG_INFO";
const S6B_NO_DEBUG_REASON = "LocalVariableTable missing";
const S6B_VALUES_CAPPED = "VALUES_CAPPED";
const S6B_VALUES_TOTAL = "VALUES_TOTAL";
const S6B_FOLD_LIMIT = 20;
/** Perf script (report-only; 1.40 is only a WARN label). */
const S6B_PERF_REL = "tools/perf/l2-overhead.mjs";
/** S6B-E static workbench tokens (static dist only; dynamic DOM literals are NOT asserted). */
const S6B_WORKBENCH_TOKENS = [
  "s6-async-badge", "s6-no-debug-badge", "s6-no-debug-reason", "s6-fold-note",
  "已折叠", "VALUES_CAPPED", "VALUES_TOTAL", "共", "ASYNC_INHERITED", "长生命周期线程池不自动传播",
  S6_BANNER, S6_L2_NOTE, S6_XN_NOTE, S6_NO_DEBUG_NOTE, S6_FOLD_NOTE_TEMPLATE,
];
/** Markers that may appear only in the S6b files (S6B-F scope; no field-line/deep-object/multi). */
const S6B_AGENT_FILES = [
  "agent/src/main/java/io/traceboard/agent/SpanContext.java",
  "agent/src/main/java/io/traceboard/agent/L2Values.java",
  "agent/src/main/java/io/traceboard/agent/SpanEmitter.java",
  "agent/src/main/java/io/traceboard/agent/TraceAgent.java",
  "agent/src/main/java/io/traceboard/agent/L2ClassFileTransformer.java",
  "agent/src/main/java/io/traceboard/agent/NoDebugClassFileTransformer.java",
];
const s6bMarkerAllowed = (rel) =>
  S6B_AGENT_FILES.includes(rel) ||
  rel.startsWith("workbench/src/s6/") ||
  rel === "workbench/src/components/S4DetailPanel.vue" ||
  rel === "workbench/src/components/S3Panel.vue" ||
  rel === "workbench/src/style.css" ||
  rel === "demo/buggy-shop-boot-vue/frontend/src/App.vue" ||
  rel === S6B_NO_DEBUG_SERVICE_REL;

const S6A_IMPLEMENTED = ["A", "B", "C", "D", "E"];
const S6B_IMPLEMENTED = ["A", "B", "C", "D", "E", "F"];
const S6A_EVIDENCE = { javaBuild: null, demo: null, agent: null, fixture: null, workbench: null };
const S6B_EVIDENCE = { builds: null, async: null, noDebug: null, loop: null, workbench: null, perf: null };
/** One-run memoization for the S6a Java/build assets (reused from S5 when the full suite ran). */
const S6A_BUILD_CACHE = { java: null, workbench: null, demoFrontend: null, sdk: null };

/** Parse the S6a-only CLI selector; null when `--s6a` is absent (normal full S0–S6a run). */
function parseS6Request(argv) {
  const arg = argv.find((item) => item === "--s6a" || item.startsWith("--s6a="));
  if (arg === undefined) return null;
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1).trim() : "";
  if (!raw) return new Set(S6A_IMPLEMENTED);
  return new Set(raw.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean));
}

const S6_ONLY = process.argv.some((item) => item.startsWith("--s6a"));
const S6_SELECTED = S6_ONLY ? (parseS6Request(process.argv) ?? new Set(S6A_IMPLEMENTED)) : null;
const REPRO_S6 = `(cd "tools/verify" && node verify.mjs --s6a=${S6A_IMPLEMENTED.join(",")})`;

/** Parse the S6b-only CLI selector; null when `--s6b` is absent (full S0–S6 run). */
function parseS6BRequest(argv) {
  const arg = argv.find((item) => item === "--s6b" || item.startsWith("--s6b="));
  if (arg === undefined) return null;
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1).trim() : "";
  if (!raw) return new Set(S6B_IMPLEMENTED);
  return new Set(raw.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean));
}

const S6B_ONLY = process.argv.some((item) => item.startsWith("--s6b"));
const S6B_SELECTED = S6B_ONLY ? (parseS6BRequest(process.argv) ?? new Set(S6B_IMPLEMENTED)) : null;
const REPRO_S6B = `(cd "tools/verify" && node verify.mjs --s6b=${S6B_IMPLEMENTED.join(",")})`;

/**
 * `npm ci` can transiently fail on Windows with EPERM/EBUSY (errno -4048) while a previous
 * build's esbuild.exe is still held by the OS scanner. Retry a few times with a short backoff;
 * the gate still requires a real exit 0 (no assertion is relaxed).
 */
function s5NpmCi(cwd, { attempts = 8, backoffMs = 5000, timeout = 600000 } = {}) {
  let result = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // Release a lingering esbuild service from the previous Vite build before deleting node_modules.
    spawnSync("taskkill", ["/F", "/T", "/IM", "esbuild.exe"], { windowsHide: true });
    result = runShell("npm ci", { cwd, timeout });
    const out = `${result.stdout}\n${result.stderr}`;
    if (result.code === 0 && !result.error) return result;
    const transient = /EPERM|EBUSY|resource busy|errno -4048|operation not permitted/i.test(out);
    if (attempt === attempts || !transient) return result;
    // The binary can still be held (Windows scanner): back off and retry the clean install.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoffMs);
  }
  return result;
}

/**
 * Parse the S5-only CLI selector. `--s5` (no value) runs every implemented S5 gate;
 * `--s5=A,B,C` restricts the selection. Returns null when `--s5` is absent.
 */
function parseS5Request(argv) {
  const arg = argv.find((item) => item === "--s5" || item.startsWith("--s5="));
  if (arg === undefined) return null;
  const raw = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1).trim() : "";
  if (!raw) return new Set(S5_IMPLEMENTED);
  return new Set(raw.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean));
}

const S5_ONLY = process.argv.some((item) => item.startsWith("--s5"));
const S5_SELECTED = S5_ONLY ? (parseS5Request(process.argv) ?? new Set(S5_IMPLEMENTED)) : null;
const REPRO_S5 = `(cd "tools/verify" && node verify.mjs --s5=${S5_IMPLEMENTED.join(",")})`;

const COLLECTOR_BASE = "http://127.0.0.1:8601";
const DEMO_BASE = "http://localhost:8080";
const NDJSON = "application/x-ndjson";

const AGENT_JAR_REL = "agent/target/traceboard-agent-0.1.0-SNAPSHOT.jar";
const AGENT_CLASS_REL = "agent/target/classes/io/traceboard/agent/TraceAgent.class";
const COLLECTOR_JAR_REL = "server/collector/target/traceboard-collector-0.1.0-SNAPSHOT.jar";
const DEMO_JAR_REL = "demo/buggy-shop-boot-vue/backend/target/demo-shop-backend-0.1.0-SNAPSHOT.jar";
const WORKBENCH_DIST_REL = "workbench/dist";
const DEMO_DIST_REL = "demo/buggy-shop-boot-vue/frontend/dist";

const HTTP_TIMEOUT_MS = 15000;
const START_TIMEOUT_MS = 90000;
const BUILD_TIMEOUT_MS = 900000;

const EXPECTED_SCHEMA_ID = "urn:traceboard:schema:event:v1";
const EXPECTED_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const EXPECTED_EVENT_COUNT = 9;

/* ------------------------------------------------------------------ */
/* result plumbing                                                     */
/* ------------------------------------------------------------------ */

const RESULTS = [];
const activeServers = new Set();
const tmpDirs = [];

function record(id, title, ok, evidence = [], repro = null) {
  RESULTS.push({ id, title, ok: Boolean(ok), evidence, repro: ok ? null : repro });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${tag}  [${id}] ${title}`);
  for (const line of evidence) console.log(`        ${line}`);
  if (!ok && repro) console.log(`        repro: ${repro}`);
  return Boolean(ok);
}

/** gate(): record several labelled sub-assertions as one check. */
function gate(id, title, checks, repro) {
  const bad = checks.filter((c) => !c.ok);
  const evidence = checks.map(
    (c) => `${c.ok ? "ok " : "BAD"} ${c.label}${c.detail !== undefined ? ` :: ${c.detail}` : ""}`,
  );
  return record(id, title, bad.length === 0, evidence, bad.length ? repro : null);
}

function section(title) {
  console.log("");
  console.log(`--- ${title} ---`);
}

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

function abs(rel) {
  return path.join(REPO, rel);
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function relOf(absPath) {
  return path.relative(REPO, absPath).split(path.sep).join("/");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== "object") return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function show(value) {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 160)}...` : text;
  } catch {
    return String(value);
  }
}

/** Dot path lookup per expected-facts.json "pathSyntax". */
function getByPath(root, dotted) {
  const segments = String(dotted).split(".");
  let current = root;
  for (const segment of segments) {
    if (current === null || current === undefined) return { found: false };
    if (/^\d+$/.test(segment)) {
      if (!Array.isArray(current)) return { found: false };
      const index = Number(segment);
      if (index < 0 || index >= current.length) return { found: false };
      current = current[index];
    } else {
      if (typeof current !== "object" || Array.isArray(current)) return { found: false };
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return { found: false };
      current = current[segment];
    }
  }
  return { found: true, value: current };
}

const SKIP_WALK_DIRS = new Set(["node_modules", ".git"]);

function walk(absDir, { skip = SKIP_WALK_DIRS, acc = null } = {}) {
  const out = acc ?? [];
  if (!existsSync(absDir)) return out;
  const st = statSync(absDir);
  if (st.isFile()) {
    out.push(absDir);
    return out;
  }
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const child = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      walk(child, { skip, acc: out });
    } else if (entry.isFile()) {
      out.push(child);
    }
  }
  return out;
}

function runShell(command, { cwd = REPO, env = process.env, timeout = BUILD_TIMEOUT_MS } = {}) {
  const started = Date.now();
  const result = spawnSync(command, {
    cwd,
    env,
    shell: true,
    encoding: "utf8",
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return {
    command,
    cwd,
    code: result.status,
    signal: result.signal,
    error: result.error,
    stdout,
    stderr,
    ms: Date.now() - started,
  };
}

function runExe(exe, args, { cwd = REPO, timeout = 120000, env = process.env } = {}) {
  const result = spawnSync(exe, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    code: result.status,
    signal: result.signal,
    error: result.error,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function lastLines(text, count) {
  return text
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-count);
}

function listeningOn(port) {
  const result = runExe("netstat", ["-ano"], { timeout: 30000 });
  if (result.code !== 0) {
    return { supported: false, lines: [], error: result.stderr || "netstat failed" };
  }
  const pattern = new RegExp(`:${port}(?!\\d)`);
  const lines = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.includes("LISTENING") && pattern.test(line))
    .map((line) => line.trim());
  return { supported: true, lines };
}

async function pollUntil(fn, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
      lastValue = value;
    } catch (error) {
      lastValue = error;
    }
    await sleep(intervalMs);
  }
  return null;
}

const REPRO_VERIFY = `(cd "tools/verify" && npm ci && node verify.mjs)`;

/* ------------------------------------------------------------------ */
/* S1 HTTP / process / file helpers                                    */
/* ------------------------------------------------------------------ */

async function requestBase(base, pathname, init = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  try {
    const response = await fetch(base + pathname, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    return { ok: true, url: base + pathname, status: response.status, text };
  } catch (error) {
    return { ok: false, error, url: base + pathname };
  }
}

function postNdjson(pathname, body, contentType = NDJSON) {
  return requestBase(COLLECTOR_BASE, pathname, {
    method: "POST",
    headers: contentType === null ? {} : { "Content-Type": contentType },
    body,
  }, 30000);
}

/* ------------------------------------------------------------------ */
/* S4 raw HTTP / launcher / stub helpers                               */
/* ------------------------------------------------------------------ */

/**
 * Raw HTTP request (no undici content-decoding), so gzip pass-through and header rules can be
 * asserted byte-for-byte. Returns lower-cased headers and the untouched response buffer.
 */
function httpRaw(url, { method = "GET", headers = {}, body = null, timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      resolve({ ok: false, error });
      return;
    }
    const request = http.request({
      hostname: target.hostname,
      port: target.port || 80,
      path: `${target.pathname}${target.search}`,
      method,
      headers,
      timeout: timeoutMs,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const buf = Buffer.concat(chunks);
        const lowered = {};
        for (const [name, value] of Object.entries(response.headers)) {
          lowered[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
        }
        resolve({ ok: true, status: response.statusCode ?? 0, headers: lowered, buf, text: buf.toString("utf8") });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", (error) => resolve({ ok: false, error }));
    if (body !== null && body !== undefined) request.write(body);
    request.end();
  });
}

function runLauncher(args, { cwd = REPO, timeout = 90000, env = process.env } = {}) {
  return runExe(JDK21_JAVA, ["-jar", abs(S4_LAUNCHER_JAR_REL), ...args], { cwd, timeout, env });
}

/**
 * Async launcher runner: keeps the verifier's event loop free while the child runs, so the
 * in-process S4-G stubs (127.0.0.1:18080) can still answer the preview's proxied requests.
 */
function runExeAsync(exe, args, { cwd = REPO, timeout = 120000, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let error = null;
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, timeout);
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (spawnError) => { error = spawnError; });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, error, stdout, stderr });
    });
  });
}

function runLauncherAsync(args, options = {}) {
  return runExeAsync(JDK21_JAVA, ["-jar", abs(S4_LAUNCHER_JAR_REL), ...args], options);
}

function postJson(body, contentType = "application/json", pathname = "/ingest/v1/agent-hello") {
  return requestBase(COLLECTOR_BASE, pathname, {
    method: "POST",
    headers: contentType === null ? {} : { "Content-Type": contentType },
    body,
  }, 20000);
}

function pidAlive(pid) {
  const result = runExe("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { timeout: 30000 });
  return new RegExp(`"${pid}"`).test(result.stdout || "");
}

/** Static HTML stub on 127.0.0.1:18080 used by S4-D/S4-G (closed before S4-I). */
function startS4Stub() {
  const html = "<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>stub</title></head>"
    + "<body><h1>stub</h1><p>traceboard preview target</p></body></html>\n";
  const big = `${"a".repeat(2 * 1024 * 1024 + 16)}</body>`;
  const gzipHtml = gzipSync(Buffer.from("<!doctype html><html><body><p>gzip</p></body></html>", "utf8"));
  const requests = [];
  const server = http.createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    const head = req.method === "HEAD";
    requests.push({ method: req.method || "", pathname, headers: { ...req.headers } });
    const send = (status, headers, bodyText, raw = null) => {
      const payload = raw ?? Buffer.from(bodyText ?? "", "utf8");
      res.writeHead(status, { ...headers, "Content-Length": String(payload.length) });
      if (head) {
        res.end();
      } else {
        res.end(payload);
      }
    };
    switch (pathname) {
      case "/":
        send(200, {
          "Content-Type": "text/html; charset=utf-8",
          "ETag": "\"stub-etag-1\"",
          "Last-Modified": "Wed, 01 Jan 2025 00:00:00 GMT",
        }, html);
        return;
      case "/plain":
        send(200, { "Content-Type": "text/plain; charset=utf-8" }, "plain-body");
        return;
      case "/latin":
        send(200, { "Content-Type": "text/html; charset=iso-8859-1" }, "<html><body>latin</body></html>");
        return;
      case "/fragment":
        send(200, { "Content-Type": "text/html; charset=utf-8" }, "<div>fragment</div>");
        return;
      case "/gzip":
        send(200, { "Content-Type": "text/html; charset=utf-8", "Content-Encoding": "gzip" }, null, gzipHtml);
        return;
      case "/big":
        send(200, { "Content-Type": "text/html; charset=utf-8" }, big);
        return;
      case "/nobody":
        res.writeHead(204, { "Content-Type": "text/html; charset=utf-8" });
        res.end();
        return;
      default:
        send(404, { "Content-Type": "text/html; charset=utf-8" }, "<html><body>missing</body></html>");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(S4_STUB_PORT, "127.0.0.1", () => resolve({
      server,
      html,
      big,
      gzipHtml,
      requests,
      close: () => new Promise((done) => server.close(() => done())),
    }));
  });
}

/**
 * Non-injectable stub on 127.0.0.1:18080 (text/plain for every path), used by S4-G to prove
 * `diagnose` reports `preview_injection` FAIL (`not-injected:not_html`) instead of a fake PASS.
 */
function startS4PlainStub() {
  const server = http.createServer((req, res) => {
    const body = "plain-body";
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(body, "utf8")),
    });
    res.end(body);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(S4_STUB_PORT, "127.0.0.1", () => resolve({
      server,
      close: () => new Promise((done) => server.close(() => done())),
    }));
  });
}

/** Parse S4 diagnose output: seven `LEVEL check: evidence` rows + one exact SUMMARY line. */
function parseS4DiagnoseOutput(run) {
  const text = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.replace(/\r/g, "");
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const summaryIndex = lines.findIndex((line) => line.startsWith("SUMMARY: "));
  const summary = summaryIndex >= 0 ? lines[summaryIndex] : "";
  const match = summary.match(/^SUMMARY: (PASS|FAIL) pass=(\d+) warn=(\d+) fail=(\d+) skip=(\d+)$/);
  const rows = summaryIndex >= 0 ? lines.slice(0, summaryIndex) : [];
  const parsedRows = rows.map((line) => {
    const row = line.match(/^(PASS|FAIL|WARN|SKIP) ([a-z_]+): (.+)$/);
    return row ? { level: row[1], check: row[2], evidence: row[3], line } : { level: null, check: null, evidence: "", line };
  });
  return {
    text,
    lines,
    rows: parsedRows,
    summary,
    summaryMatched: Boolean(match),
    verdict: match ? match[1] : null,
    counts: match ? { pass: Number(match[2]), warn: Number(match[3]), fail: Number(match[4]), skip: Number(match[5]) } : null,
  };
}

/**
 * Build one S4-G assertion for a diagnose invocation: exit code, exact SUMMARY counts (sum=7),
 * fixed row order, evidence on every row, and the expected per-check levels.
 */
function s4DiagnoseCase(label, run, expected) {
  const parsed = parseS4DiagnoseOutput(run);
  const problems = [];
  if (run.error) problems.push(`spawn error=${run.error.message}`);
  if (run.code !== expected.exit) problems.push(`exit=${run.code} expected=${expected.exit}`);
  if (!parsed.summaryMatched) problems.push(`no exact SUMMARY line: "${show(parsed.summary)}"`);
  if (parsed.verdict !== expected.verdict) problems.push(`verdict=${parsed.verdict} expected=${expected.verdict}`);
  if (parsed.counts === null || !deepEqual(parsed.counts, expected.counts)) {
    problems.push(`counts=${show(parsed.counts)} expected=${show(expected.counts)}`);
  }
  if (parsed.counts !== null && parsed.counts.pass + parsed.counts.warn + parsed.counts.fail + parsed.counts.skip !== 7) {
    problems.push(`counts do not sum to 7: ${show(parsed.counts)}`);
  }
  if (parsed.rows.length !== 7) problems.push(`rows=${parsed.rows.length} expected=7`);
  const observedOrder = parsed.rows.map((row) => row.check).join(",");
  if (observedOrder !== S4_DIAG_CHECKS.join(",")) {
    problems.push(`row order=${observedOrder || "none"}`);
  }
  for (const row of parsed.rows) {
    if (!row.level) problems.push(`malformed row: "${show(row.line)}"`);
    else if (row.evidence.trim().length === 0) problems.push(`${row.check} has empty evidence`);
    else if (row.level !== "SKIP" && !row.evidence.includes("GET http")) problems.push(`${row.check} evidence lacks GET URL`);
  }
  for (const [check, level] of Object.entries(expected.levels ?? {})) {
    const row = parsed.rows.find((item) => item.check === check);
    if (!row || row.level !== level) problems.push(`${check}=${row ? row.level : "missing"} expected=${level}`);
  }
  for (const text of expected.contains ?? []) {
    if (!parsed.text.includes(text)) problems.push(`output lacks "${text}"`);
  }
  return {
    ok: problems.length === 0,
    label,
    detail: problems.length
      ? `${problems.slice(0, 6).join(" || ")} :: ${parsed.rows.map((row) => row.line).join(" | ").slice(0, 900)}`
      : `exit=${run.code} ${parsed.summary} rows=${parsed.rows.map((row) => `${row.level}:${row.check}`).join(",")}`,
  };
}

/** Bundle the workbench `s4/derive.ts` (pure read-only helpers) and import it as ESM. */
async function loadS4DeriveModule() {
  const workbenchRequire = createRequire(path.join(REPO, "workbench", "package.json"));
  const esbuild = workbenchRequire("esbuild");
  const dir = mkdtempSync(path.join(os.tmpdir(), "tb-s4-derive-"));
  tmpDirs.push(dir);
  const outfile = path.join(dir, "derive.mjs");
  esbuild.buildSync({
    entryPoints: [abs("workbench/src/s4/derive.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    sourcemap: false,
  });
  return import(pathToFileURL(outfile).href);
}

/** Parse an error envelope and return label/check tuples. */
function envelopeChecks(res, expectedStatus, expectedError, label, forbiddenText = []) {
  const bodyText = res.text ?? "";
  const parsed = res.ok ? parseJson(bodyText) : { ok: false };
  const value = parsed.ok && parsed.value && typeof parsed.value === "object" ? parsed.value : {};
  const echoed = forbiddenText.filter((needle) => needle && bodyText.includes(needle));
  return [
    {
      ok: res.ok && res.status === expectedStatus,
      label: `${label}: HTTP ${expectedStatus}`,
      detail: res.ok ? `status=${res.status} body=${show(bodyText)}` : String(res.error),
    },
    {
      ok: parsed.ok && value.error === expectedError && value.apiVersion === "v1" && typeof value.message === "string",
      label: `${label}: envelope {error:${expectedError}, apiVersion:v1, message}`,
      detail: show(bodyText),
    },
    {
      ok: parsed.ok && typeof value.message === "string" && value.message.length > 0 && value.message.length <= 200,
      label: `${label}: message length 1..200`,
      detail: parsed.ok ? `${String(value.message).length} chars` : "unparsable",
    },
    {
      ok: echoed.length === 0,
      label: `${label}: no request-body echo`,
      detail: echoed.length ? `echoed=${echoed.join(",")}` : "no echo",
    },
  ];
}

/** Byte-level metadata for a UTF-8 fixture file (BOM/CR/trailing LF/lines). */
function readTextFileMeta(rel) {
  const buffer = readFileSync(abs(rel));
  const text = buffer.toString("utf8");
  const endsWithNewline = buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
  const rawSegments = text.split("\n");
  const bodySegments = endsWithNewline ? rawSegments.slice(0, -1) : rawSegments.slice();
  return {
    rel,
    buffer,
    text,
    hasBom: buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf,
    crCount: (text.match(/\r/g) ?? []).length,
    endsWithNewline,
    emptyLineCount: bodySegments.filter((line) => line.trim() === "").length,
    lines: bodySegments.filter((line) => line.trim() !== ""),
  };
}

/** Parse a plan-review "```text" block of "<sha256>  <path>" lines (optionally scoped to a heading). */
function parseFreezeBaseline(rel, headingRe = null) {
  const text = readFileSync(abs(rel), "utf8");
  let scope = text;
  if (headingRe) {
    const start = text.search(headingRe);
    if (start < 0) return [];
    const rest = text.slice(start);
    const nextHeading = rest.slice(1).search(/\n#{2,3} /);
    scope = nextHeading < 0 ? rest : rest.slice(0, nextHeading + 1);
  }
  const entries = [];
  for (const line of scope.split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s{2}(.+)$/);
    if (match) {
      // Drop trailing prose annotations ("   （S3 未改，保留参考）"); relative paths have no spaces.
      const rel = match[2].trim().split(/\s{2,}/)[0].trim();
      entries.push({ hash: match[1], rel });
    }
  }
  return entries;
}

function javaPids() {
  const result = runExe("tasklist", ["/FI", "IMAGENAME eq java.exe", "/FO", "CSV", "/NH"], { timeout: 30000 });
  const pids = [];
  for (const line of (result.stdout || "").split(/\r?\n/)) {
    const match = line.match(/^"java\.exe","(\d+)"/i);
    if (match) pids.push(Number(match[1]));
  }
  return pids;
}

/** Live node.exe pids (S4-I: no node leftovers from builds/preview after the run). */
function nodePids() {
  const result = runExe("tasklist", ["/FI", "IMAGENAME eq node.exe", "/FO", "CSV", "/NH"], { timeout: 30000 });
  const pids = [];
  for (const line of (result.stdout || "").split(/\r?\n/)) {
    const match = line.match(/^"node\.exe","(\d+)"/i);
    if (match) pids.push(Number(match[1]));
  }
  return pids;
}

/** Current HEAD commit (S4-I: no commit/reset happened during the verify run). */
function gitHeadHash() {
  const result = runExe("git", ["rev-parse", "HEAD"], { timeout: 60000 });
  return result.code === 0 ? (result.stdout || "").trim() : "unknown";
}

/**
 * Live java.exe/node.exe processes that descend from `rootPid` (true leftovers of the launcher,
 * builds or preview). A plain pid diff is not usable: unrelated app processes spawn java/node
 * while the verifier runs, so only our own process tree is asserted.
 */
function descendantSpawnedProcesses(rootPid) {
  const script = "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'java.exe' -or $_.Name -eq 'node.exe' } | ForEach-Object { \"$($_.Name) $($_.ProcessId) $($_.ParentProcessId)\" }";
  const result = runExe("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 60000 });
  if (result.code !== 0) {
    return { supported: false, items: [], error: lastLines(result.stderr || "", 2).join(" ") };
  }
  const children = new Map();
  for (const line of (result.stdout || "").split(/\r?\n/)) {
    const match = line.trim().match(/^(java|node)\.exe\s+(\d+)\s+(\d+)$/i);
    if (!match) continue;
    const parent = Number(match[3]);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push({ name: match[1].toLowerCase(), pid: Number(match[2]) });
  }
  const items = [];
  const seen = new Set();
  const queue = [...(children.get(rootPid) ?? [])];
  while (queue.length) {
    const item = queue.shift();
    if (seen.has(item.pid)) continue;
    seen.add(item.pid);
    items.push(item);
    queue.push(...(children.get(item.pid) ?? []));
  }
  return { supported: true, items, error: null };
}

function gitStatusLines() {
  const result = runExe("git", ["status", "--porcelain"], { timeout: 60000 });
  if (result.code !== 0) return { ok: false, lines: [], error: result.stderr || "git status failed" };
  return { ok: true, lines: (result.stdout || "").split(/\r?\n/).filter((line) => line.trim() !== "") };
}

/** Read a committed (HEAD) version of a repo-relative file; used for the S2-AMD-01 diff scope. */
function gitShowFile(rel) {
  const result = runExe("git", ["show", `HEAD:${rel}`], { timeout: 60000 });
  return {
    ok: result.code === 0 && !result.error,
    text: result.stdout ?? "",
    stderr: result.stderr || result.error?.message || "",
  };
}

/** Split a single-file Vue SFC into the pre-template, template body and post-template sections. */
function vueSections(text) {
  const open = text.indexOf("<template>");
  const close = text.lastIndexOf("</template>");
  if (open < 0 || close < 0 || close < open) return null;
  return {
    prefix: text.slice(0, open),
    body: text.slice(open + "<template>".length, close),
    suffix: text.slice(close + "</template>".length),
  };
}

/** Ordered element/attribute inventory of a template body (text nodes excluded). */
function templateTagInventory(body) {
  return [...body.matchAll(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g)].map((m) => m[0].replace(/\s+/g, " ").trim());
}

function zipEntries(jarAbs) {
  const result = runExe("unzip", ["-Z1", jarAbs], { timeout: 60000 });
  return {
    ok: result.code === 0,
    entries: (result.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    stderr: result.stderr || "",
  };
}

function dirTextFiles(rel) {
  const dirAbs = abs(rel);
  if (!existsSync(dirAbs)) return [];
  return walk(dirAbs, { skip: new Set(["node_modules", "target", "dist", ".git"]) })
    .filter((file) => /\.(java|ts|vue|js|mjs|yml|yaml|json|xml|html|css|md)$/i.test(file))
    .map((file) => ({ rel: relOf(file), text: readFileSync(file, "utf8") }));
}

/** Remove comments so "no retry"/"no correlation" disclaimers are not scanned as code. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"])\/\/[^\n]*/g, "$1");
}

function hexRandom(byteCount) {
  const bytes = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes.toString("hex");
}

/* ------------------------------------------------------------------ */
/* S2 shared helpers: chain invariants + G1 freeze parsing             */
/* ------------------------------------------------------------------ */

const S2_CHAIN_SLOTS = [
  { kind: "controller", nodeKey: S2_CONTROLLER_NODE_KEY },
  { kind: "service", nodeKey: S2_SERVICE_NODE_KEY },
  { kind: "mapper", nodeKey: S2_MAPPER_NODE_KEY },
  { kind: "sql", nodeKey: S2_SQL_NODE_KEY },
];

function sortedByStart(events) {
  return events
    .slice()
    .sort((a, b) => (a.startNs - b.startNs) || String(a.spanId).localeCompare(String(b.spanId)));
}

/**
 * Validate the S2 controller -> service -> mapper -> sql fact chain (dispatch §4.2).
 * Runtime spans may carry extra flags (DROP_COUNT=<n>), so exact flags are only compared
 * for the frozen fixture. Returns a list of human-readable problems (empty == conformant).
 */
function chainProblems(spans, { fixture = false, sessionId = S2_SESSION } = {}) {
  const problems = [];
  if (!Array.isArray(spans) || spans.length !== 4) {
    problems.push(`spanCount=${Array.isArray(spans) ? spans.length : "?"}`);
    return problems;
  }
  const s = sortedByStart(spans);
  const [controller, service, mapper, sql] = s;

  S2_CHAIN_SLOTS.forEach((slot, index) => {
    if (s[index].kind !== slot.kind) problems.push(`slot${index} kind=${s[index].kind}`);
    if (s[index].nodeKey !== slot.nodeKey) problems.push(`slot${index} nodeKey=${s[index].nodeKey}`);
  });

  if (sessionId) {
    const sessions = [...new Set(s.map((e) => e.sessionId))];
    if (sessions.length !== 1 || sessions[0] !== sessionId) problems.push(`sessionIds=${sessions.join(",")}`);
  }
  const traceIds = [...new Set(s.map((e) => e.traceId))];
  if (traceIds.length !== 1 || !/^[0-9a-f]{32}$/.test(String(traceIds[0]))) {
    problems.push(`traceIds=${traceIds.join(",")}`);
  }
  const roots = s.filter((e) => e.parentSpanId === null);
  if (roots.length !== 1) problems.push(`roots=${roots.length}`);
  if (controller.parentSpanId !== null) problems.push("controller parentSpanId!=null");
  if (service.parentSpanId !== controller.spanId) problems.push("service parent mismatch");
  if (mapper.parentSpanId !== service.spanId) problems.push("mapper parent mismatch");
  if (sql.parentSpanId !== mapper.spanId) problems.push("sql parent mismatch");
  const rootEventIds = [...new Set(s.map((e) => e.rootEventId))];
  if (rootEventIds.length !== 1) problems.push(`rootEventIds=${rootEventIds.join(",")}`);
  if (controller.rootEventId !== `click_lost_${controller.spanId}`) {
    problems.push(`rootEventId=${controller.rootEventId}`);
  }

  for (let i = 0; i < s.length; i += 1) {
    const span = s[i];
    if (!/^[0-9a-f]{16}$/.test(String(span.spanId))) problems.push(`slot${i} spanId=${span.spanId}`);
    if (!(span.durNs > 0)) problems.push(`slot${i} durNs=${span.durNs}`);
    if (!(span.startNs >= 0)) problems.push(`slot${i} startNs=${span.startNs}`);
    if (span.confidence !== "LOST") problems.push(`slot${i} confidence=${span.confidence}`);
    if (span.status !== "OK") problems.push(`slot${i} status=${span.status}`);
    const flags = Array.isArray(span.flags) ? span.flags : [];
    if (!flags.includes(S2_FLAG_CHAIN)) problems.push(`slot${i} missing ${S2_FLAG_CHAIN}`);
    if (i === 0 && !flags.includes(S2_FLAG_LOST_BACKEND)) problems.push(`root missing ${S2_FLAG_LOST_BACKEND}`);
    if (i > 0 && flags.includes(S2_FLAG_LOST_BACKEND)) problems.push(`slot${i} child has ${S2_FLAG_LOST_BACKEND}`);
    if (fixture) {
      const expectedFlags = i === 0 ? [S2_FLAG_CHAIN, S2_FLAG_LOST_BACKEND] : [S2_FLAG_CHAIN];
      if (!deepEqual(flags, expectedFlags)) problems.push(`slot${i} flags=${show(flags)}`);
    }
    if (!span.thread || typeof span.thread.name !== "string" || span.thread.name.length === 0) {
      problems.push(`slot${i} thread missing`);
    }
    if (i > 0 && !(span.startNs >= s[i - 1].startNs)) problems.push("startNs not non-decreasing");
  }
  const threadNames = [...new Set(s.map((e) => e.thread?.name ?? ""))];
  if (threadNames.length !== 1) problems.push(`threadNames=${threadNames.join(",")}`);

  for (let i = 1; i < s.length; i += 1) {
    const parent = s[i - 1];
    const child = s[i];
    if (child.startNs < parent.startNs || child.startNs + child.durNs > parent.startNs + parent.durNs) {
      problems.push(`slot${i} not nested inside slot${i - 1}`);
    }
  }

  const checkReturn = (span, type, value, label) => {
    if (!span.return || span.return.type !== type || !deepEqual(span.return.value, value)) {
      problems.push(`${label} return=${show(span.return)}`);
    }
  };
  checkReturn(controller, S2_RESPONSE_ENTITY_TYPE, 200, "controller");
  checkReturn(service, "boolean", true, "service");
  checkReturn(mapper, "int", 0, "mapper");
  if (sql.return !== null) problems.push(`sql return=${show(sql.return)}`);
  const effects = Array.isArray(sql.sideEffects) ? sql.sideEffects : [];
  if (effects.length !== 1) {
    problems.push(`sql sideEffects count=${effects.length}`);
  } else {
    const effect = effects[0];
    if (effect.type !== "sql" || effect.sqlId !== S2_SQL_NODE_KEY ||
        effect.rowsAffected !== 0 || effect.transaction !== "UNKNOWN") {
      problems.push(`sql sideEffect=${show(effect)}`);
    }
  }
  return problems;
}

/** Parse the two hash blocks of S2 plan-review §2 (S2 freeze + S0/S1 freeze). */
function s2FreezeSections() {
  const entries = parseFreezeBaseline(S2_PLAN_REVIEW_REL, /^#{2,3} 2\. 冻结基线/m);
  const isS2 = (rel) =>
    rel === SCHEMA_REL ||
    rel.startsWith("docs/contracts/") ||
    rel.startsWith("fixtures/s2-zero-row-chain/") ||
    rel.startsWith("docs/plans/stages/S2/");
  const isS0S1 = (rel) =>
    rel.startsWith("fixtures/case-a-zero-rows/") || rel.startsWith("fixtures/s1-walking-skeleton/");
  return {
    all: entries,
    s2: entries.filter((entry) => isS2(entry.rel)),
    s0s1: entries.filter((entry) => isS0S1(entry.rel)),
  };
}

/** Derived "#trace.<name>" values allowed by the S2 expected-facts consumer. */
function derivedTraceValue(events, name) {
  switch (name) {
    case "threwCount":
      return events.filter((event) => event.status === "THREW").length;
    case "spanCount":
      return events.length;
    case "rootCount":
      return events.filter((event) => event.parentSpanId === null).length;
    case "kindCount": {
      const counts = {};
      for (const event of events) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
      return counts;
    }
    default:
      return undefined;
  }
}

/** Fact lookup: "#trace.*" is derived over the whole source, otherwise a dot path on the event. */
function factPathValue(event, events, dottedPath) {
  const path = String(dottedPath ?? "");
  if (path.startsWith("#trace.")) {
    const name = path.slice("#trace.".length);
    const value = derivedTraceValue(events, name);
    return { found: value !== undefined, value };
  }
  return getByPath(event, path);
}

/* ------------------------------------------------------------------ */
/* S3 shared helpers: fixtures, expected facts, replay simulation      */
/* ------------------------------------------------------------------ */

/** Load one fixtures/s3-frontend-facts case (events + expected-facts + byte metadata). */
function loadS3Case(eventsRel, factsRel, expectedCount) {
  const meta = readTextFileMeta(eventsRel);
  let events = [];
  let parseError = null;
  try {
    events = meta.lines.map((line) => JSON.parse(line));
  } catch (error) {
    parseError = error;
  }
  let facts = null;
  let factsError = null;
  try {
    facts = JSON.parse(readFileSync(abs(factsRel), "utf8"));
  } catch (error) {
    factsError = error;
  }
  return { meta, events, expectedCount, parseError, facts, factsError };
}

/** Local pure replay window (api.v1.md §9.1) used to deep-compare the frozen fixtures. */
function s3ReplayWindow(events, fromNs, toNsOrNull) {
  let maxEnd = 0;
  for (const event of events) {
    maxEnd = Math.max(maxEnd, event.startNs + event.durNs);
  }
  const toNs = toNsOrNull === null || toNsOrNull === undefined ? maxEnd : toNsOrNull;
  const window = events.filter((event) => fromNs <= event.startNs && event.startNs <= toNs);
  window.sort((a, b) => (a.startNs - b.startNs) || String(a.spanId).localeCompare(String(b.spanId)));
  return { fromNs, toNs, events: window };
}

/** S3 "#trace.*" derived values (fixture expected-facts derivedPathSyntax). */
function s3DerivedTraceValue(events, name) {
  const backendCount = events.filter((event) => S3_BACKEND_KINDS.includes(event.kind)).length;
  const fetchCount = events.filter((event) => event.kind === "fetch").length;
  const root = events.find((event) => event.parentSpanId === null);
  switch (name) {
    case "spanCount":
      return events.length;
    case "threwCount":
      return events.filter((event) => event.status === "THREW").length;
    case "kindCount": {
      const counts = {};
      for (const event of events) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
      return counts;
    }
    case "fetchCount":
      return fetchCount;
    case "backendSpanCount":
      return backendCount;
    case "hasFrontend":
      return events.some((event) => S3_FRONTEND_KINDS.includes(event.kind));
    case "hasBackend":
      return backendCount > 0;
    case "rootConfidence":
      return root ? root.confidence : undefined;
    case "clickId":
      return root ? root.rootEventId : undefined;
    default:
      return undefined;
  }
}

function s3FactPathValue(event, events, dottedPath) {
  const path = String(dottedPath ?? "");
  if (path.startsWith("#trace.")) {
    const value = s3DerivedTraceValue(events, path.slice("#trace.".length));
    return { found: value !== undefined, value };
  }
  return getByPath(event, path);
}

/**
 * Evaluate a fixtures/s3-frontend-facts `globalAssertions.chain` block against the events.
 * Every key present in the frozen files is implemented; an unknown key fails the gate (so a
 * future assertion cannot silently pass). Returns { problems, evaluated }.
 */
function s3EvaluateAssertions(events, assertions) {
  const problems = [];
  const sorted = sortedByStart(events);
  const roots = events.filter((event) => event.parentSpanId === null);
  const root = roots[0] ?? {};
  const byId = new Map(events.map((event) => [event.spanId, event]));
  const click = events.find((event) => event.kind === "ui_event" && event.parentSpanId === null) ?? {};
  const fetchEvent = events.find((event) => event.kind === "fetch") ?? {};
  const controller = events.find((event) => event.kind === "controller") ?? {};
  const service = events.find((event) => event.kind === "service") ?? {};
  const mapper = events.find((event) => event.kind === "mapper") ?? {};
  const sql = events.find((event) => event.kind === "sql") ?? {};
  const jsMethod = events.find((event) => event.kind === "js_method") ?? {};
  const render = events.find((event) => event.kind === "render") ?? {};
  const sqlEffect = Array.isArray(sql.sideEffects) ? sql.sideEffects[0] ?? {} : {};
  const backendEvents = events.filter((event) => S3_BACKEND_KINDS.includes(event.kind));
  const frontendEvents = events.filter((event) => S3_FRONTEND_KINDS.includes(event.kind));
  const allFlags = events.flatMap((event) => (Array.isArray(event.flags) ? event.flags : []));
  let evaluated = 0;

  for (const [key, expected] of Object.entries(assertions)) {
    evaluated += 1;
    let ok = false;
    let actual = "";
    switch (key) {
      case "sessionId":
        ok = events.length > 0 && events.every((event) => event.sessionId === expected);
        actual = [...new Set(events.map((event) => event.sessionId))].join(",");
        break;
      case "eventCount":
        ok = events.length === expected;
        actual = String(events.length);
        break;
      case "traceId":
        ok = events.length > 0 && events.every((event) => event.traceId === expected);
        actual = [...new Set(events.map((event) => event.traceId))].join(",");
        break;
      case "rootSpanId":
        ok = roots.length === 1 && roots[0].spanId === expected;
        actual = roots.map((event) => event.spanId).join(",");
        break;
      case "rootEventId":
        ok = events.length > 0 && events.every((event) => event.rootEventId === expected);
        actual = [...new Set(events.map((event) => event.rootEventId))].join(",");
        break;
      case "rootEventIdIsClickId":
        ok = expected === true && /^click_[0-9a-f]{16}$/.test(String(root.rootEventId));
        actual = String(root.rootEventId);
        break;
      case "rootEventIdNotClickLost":
        ok = expected === true && events.every((event) => !String(event.rootEventId).startsWith("click_lost_"));
        actual = String(root.rootEventId);
        break;
      case "singleRoot":
        ok = expected === true && roots.length === 1;
        actual = `roots=${roots.length}`;
        break;
      case "rootKind":
        ok = roots.length === 1 && root.kind === expected;
        actual = String(root.kind);
        break;
      case "rootParentSpanId":
        ok = roots.length === 1 && root.parentSpanId === expected;
        actual = String(root.parentSpanId);
        break;
      case "rootConfidence":
        ok = roots.length === 1 && root.confidence === expected;
        actual = String(root.confidence);
        break;
      case "confidenceAllExact":
        ok = expected === true && events.length > 0 && events.every((event) => event.confidence === "EXACT");
        actual = [...new Set(events.map((event) => event.confidence))].join(",");
        break;
      case "statusAllOk":
        ok = events.length > 0 && events.every((event) => event.status === "OK") === expected;
        actual = sorted.map((event) => event.status).join(",");
        break;
      case "returnedFalseCount":
        ok = events.filter((event) => event.status === "RETURNED_FALSE").length === expected;
        actual = String(events.filter((event) => event.status === "RETURNED_FALSE").length);
        break;
      case "noExceptions":
      case "noThrewStatus":
        ok = expected === true && events.every((event) => event.status !== "THREW");
        actual = `threw=${events.filter((event) => event.status === "THREW").length}`;
        break;
      case "noReason":
        ok = expected === true && events.every((event) => !Object.prototype.hasOwnProperty.call(event, "reason"));
        actual = "reason absent";
        break;
      case "noValues":
        ok = expected === true && events.every((event) => !Object.prototype.hasOwnProperty.call(event, "values"));
        actual = "values absent";
        break;
      case "noLostBackendFlag":
        ok = expected === true && !allFlags.includes("LOST_BACKEND");
        actual = allFlags.filter((flag) => flag === "LOST_BACKEND").length ? "LOST_BACKEND present" : "absent";
        break;
      case "fetchCountZero":
        ok = expected === true && events.every((event) => event.kind !== "fetch");
        actual = `fetch=${events.filter((event) => event.kind === "fetch").length}`;
        break;
      case "noFetchKind":
        ok = expected === true && events.every((event) => event.kind !== "fetch");
        actual = `fetch=${events.filter((event) => event.kind === "fetch").length}`;
        break;
      case "noBackendKind":
        ok = expected === true && backendEvents.length === 0;
        actual = `backend=${backendEvents.length}`;
        break;
      case "backendSpanCount":
        ok = backendEvents.length === expected;
        actual = String(backendEvents.length);
        break;
      case "hasFrontend":
        ok = (frontendEvents.length > 0) === expected;
        actual = String(frontendEvents.length > 0);
        break;
      case "hasBackend":
        ok = (backendEvents.length > 0) === expected;
        actual = String(backendEvents.length > 0);
        break;
      case "parentChain":
        ok = Array.isArray(expected) && expected.length === sorted.length &&
          expected.every((spanId, index) => sorted[index].spanId === spanId);
        actual = sorted.map((event) => event.spanId).join(",");
        break;
      case "kindChain":
        ok = Array.isArray(expected) && expected.join(",") === sorted.map((event) => event.kind).join(",");
        actual = sorted.map((event) => event.kind).join(",");
        break;
      case "parentBySpanId": {
        const mismatches = [];
        for (const [spanId, parentSpanId] of Object.entries(expected ?? {})) {
          const event = byId.get(spanId);
          if (!event) mismatches.push(`${spanId}:missing`);
          else if (event.parentSpanId !== parentSpanId) mismatches.push(`${spanId}:${event.parentSpanId}`);
        }
        ok = mismatches.length === 0;
        actual = mismatches.join(",") || "all parents match";
        break;
      }
      case "startNsNonDecreasing":
        ok = expected === true && sorted.every((event, index) => index === 0 || event.startNs >= sorted[index - 1].startNs);
        actual = sorted.map((event) => event.startNs).join(",");
        break;
      case "intervalContainment":
        ok = expected === true && events.filter((event) => event.parentSpanId !== null).every((event) => {
          const parent = byId.get(event.parentSpanId);
          return parent && event.startNs >= parent.startNs &&
            event.startNs + event.durNs <= parent.startNs + parent.durNs;
        });
        actual = `${events.filter((event) => event.parentSpanId !== null).length} child spans`;
        break;
      case "intervalNested": {
        // Containment against the real parent, plus strict nesting for every consecutive pair
        // that is actually a parent/child pair (render hangs off the click root by design).
        const containment = events.filter((event) => event.parentSpanId !== null).every((event) => {
          const parent = byId.get(event.parentSpanId);
          return parent && event.startNs >= parent.startNs &&
            event.startNs + event.durNs <= parent.startNs + parent.durNs;
        });
        let pairs = 0;
        const consecutive = sorted.slice(1).every((event, index) => {
          if (event.parentSpanId !== sorted[index].spanId) return true;
          pairs += 1;
          return event.startNs >= sorted[index].startNs &&
            event.startNs + event.durNs <= sorted[index].startNs + sorted[index].durNs;
        });
        ok = expected === true && containment && consecutive && pairs >= 2;
        actual = `${pairs} consecutive parent/child pairs`;
        break;
      }
      case "clickWindowContainsAll":
        ok = expected === true && events.length > 0 && events.every((event) =>
          event.startNs >= click.startNs &&
          event.startNs + event.durNs <= click.startNs + click.durNs);
        actual = `click=[${click.startNs},${click.startNs + click.durNs}]`;
        break;
      case "renderStartsAfterFetchEnd":
        ok = expected === true && Boolean(render.spanId) && Boolean(fetchEvent.spanId) &&
          render.startNs > fetchEvent.startNs + fetchEvent.durNs;
        actual = `render=${render.startNs} fetchEnd=${fetchEvent.startNs + fetchEvent.durNs}`;
        break;
      case "controllerParentIsFetchSpan":
        ok = expected === true && Boolean(controller.spanId) && controller.parentSpanId === fetchEvent.spanId;
        actual = String(controller.parentSpanId);
        break;
      case "fetchSpanIdIsTraceparentParentId":
        ok = fetchEvent.spanId === expected;
        actual = String(fetchEvent.spanId);
        break;
      case "clickIdIsTraceBoardClickHeader":
        ok = click.rootEventId === expected;
        actual = String(click.rootEventId);
        break;
      case "threadFrontendAllEqual":
        ok = frontendEvents.length > 0 && frontendEvents.every((event) => event.thread?.name === expected);
        actual = [...new Set(frontendEvents.map((event) => event.thread?.name))].join(",");
        break;
      case "threadBackendAllEqual":
        ok = backendEvents.length > 0 && backendEvents.every((event) => event.thread?.name === expected);
        actual = [...new Set(backendEvents.map((event) => event.thread?.name))].join(",");
        break;
      case "threadAllEqual":
        ok = events.length > 0 && events.every((event) => event.thread?.name === expected);
        actual = [...new Set(events.map((event) => event.thread?.name))].join(",");
        break;
      case "flagsClickExact":
        ok = deepEqual(click.flags, expected);
        actual = show(click.flags);
        break;
      case "flagsSdkChildExact":
        ok = frontendEvents.filter((event) => event.parentSpanId !== null)
          .every((event) => deepEqual(event.flags, expected));
        actual = show(frontendEvents.find((event) => event.parentSpanId !== null)?.flags);
        break;
      case "flagsBackendExact":
        ok = backendEvents.length > 0 && backendEvents.every((event) => deepEqual(event.flags, expected));
        actual = show(backendEvents[0]?.flags);
        break;
      case "httpStatusFetch":
        ok = fetchEvent.return?.type === "http" && fetchEvent.return?.value === expected;
        actual = show(fetchEvent.return);
        break;
      case "httpStatusController":
        ok = controller.return?.value === expected;
        actual = show(controller.return);
        break;
      case "serviceReturnValue":
        ok = service.spanId !== undefined && deepEqual(service.return?.value, expected);
        actual = show(service.return);
        break;
      case "mapperReturnValue":
        ok = deepEqual(mapper.return?.value, expected);
        actual = show(mapper.return);
        break;
      case "sqlRowsAffectedZero":
        ok = expected === true && sqlEffect.rowsAffected === 0;
        actual = String(sqlEffect.rowsAffected);
        break;
      case "sqlTransaction":
        ok = sqlEffect.transaction === expected;
        actual = String(sqlEffect.transaction);
        break;
      case "uiEffectText":
      case "domEffectText":
        ok = render.return?.type === "ui_effect" && render.return?.value === expected;
        actual = show(render.return);
        break;
      case "jsMethodReturnedFalse":
        ok = expected === true && jsMethod.status === "RETURNED_FALSE" &&
          deepEqual(jsMethod.return?.value, false);
        actual = `${jsMethod.status} return=${show(jsMethod.return)}`;
        break;
      case "sdkActive":
        ok = (Array.isArray(click.flags) && click.flags.includes(S3_FLAG_SDK_ACTIVE)) === expected;
        actual = show(click.flags);
        break;
      case "caseBVerdictText":
        ok = expected === S3_CASE_B_VERDICT_TEXT;
        actual = String(expected);
        break;
      default:
        ok = false;
        actual = "unknown assertion key";
    }
    if (!ok) problems.push(`chain.${key} expected=${show(expected)} actual=${actual}`);
  }
  return { problems, evaluated };
}

/** Expected-facts "facts" consumer for the S3 cases (#trace.* derived supported). */
function s3FactProblems(events, factsDoc) {
  const problems = [];
  const factList = Array.isArray(factsDoc.facts) ? factsDoc.facts : [];
  for (const fact of factList) {
    if (fact.source !== "chain") {
      problems.push(`${fact.id}: unknown source ${fact.source}`);
      continue;
    }
    const matches = events.filter((event) => event.kind === fact.kind && event.nodeKey === fact.nodeKey);
    if (matches.length !== 1) {
      problems.push(`${fact.id}: matches=${matches.length}`);
      continue;
    }
    if (matches[0].status !== fact.status) {
      problems.push(`${fact.id}: status=${matches[0].status} expected=${fact.status}`);
    }
    const lookup = s3FactPathValue(matches[0], events, fact.assert?.path);
    if (!lookup.found || !deepEqual(lookup.value, fact.assert?.value)) {
      problems.push(`${fact.id}: ${fact.assert?.path}=${lookup.found ? show(lookup.value) : "not found"} expected=${show(fact.assert?.value)}`);
    }
    if (typeof fact.summary !== "string" || fact.summary.trim().length === 0) {
      problems.push(`${fact.id}: empty summary`);
    }
  }
  return { problems, count: factList.length };
}

/**
 * Epoch-ns values (~1.8e18) exceed Number.MAX_SAFE_INTEGER, so a JS-recomputed max end and the
 * collector's exact long may differ by a few hundred ns after JSON rounding. Comparisons of
 * runtime max(startNs+durNs) use this tolerance; fixture-scale values are compared exactly.
 */
function closeNs(a, b) {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 4096;
}

/** Parse the two hash blocks of the S3 plan-review §2 (S3 G1 freeze + S0–S2 frozen face). */
function s3FreezeSections() {
  const entries = parseFreezeBaseline(S3_PLAN_REVIEW_REL, /^#{2,3} 2\. 冻结基线/m);
  const isS3 = (rel) =>
    rel === SCHEMA_REL ||
    rel.startsWith("docs/contracts/") ||
    rel.startsWith("fixtures/s3-frontend-facts/") ||
    rel === "docs/plans/stages/S3/s3-plan.md" ||
    rel === "docs/plans/stages/S3/dispatch.md";
  const isLegacy = (rel) =>
    rel.startsWith("fixtures/case-a-zero-rows/") ||
    rel.startsWith("fixtures/s1-walking-skeleton/") ||
    rel.startsWith("fixtures/s2-zero-row-chain/");
  return {
    all: entries,
    s3: entries.filter((entry) => isS3(entry.rel)),
    legacy: entries.filter((entry) => isLegacy(entry.rel)),
  };
}


/* ------------------------------------------------------------------ */
/* V0 environment                                                      */
/* ------------------------------------------------------------------ */

function captureEnv() {
  const java21 = runExe(JDK21_JAVA, ["-version"]);
  const java8 = existsSync(JDK8_JAVA) ? runExe(JDK8_JAVA, ["-version"]) : { stderr: "missing" };
  const mvn8 = runShell("mvn -v", { timeout: 60000 });
  const mvn21 = runShell("mvn -v", {
    timeout: 60000,
    env: { ...process.env, JAVA_HOME: JDK21_HOME },
  });
  const node = runExe(process.execPath, ["-v"], { timeout: 30000 });
  const npm = runShell("npm -v", { timeout: 60000 });
  const env = {
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    node: node.stdout.trim(),
    npm: npm.stdout.trim(),
    java21: `${java21.stdout} ${java21.stderr}`.trim().split(/\r?\n/)[0],
    java8: `${java8.stdout ?? ""} ${java8.stderr ?? ""}`.trim().split(/\r?\n/)[0],
    mvnDefault: lastLines(`${mvn8.stdout}\n${mvn8.stderr}`, 6).join(" | "),
    mvnJdk21: lastLines(`${mvn21.stdout}\n${mvn21.stderr}`, 6).join(" | "),
    jdk21Home: JDK21_HOME,
    jdk8Home: JDK8_HOME,
    cwd: REPO,
  };
  return env;
}

/* ------------------------------------------------------------------ */
/* V1 schema + fixture                                                 */
/* ------------------------------------------------------------------ */

function parseFixture() {
  const buffer = readFileSync(abs(EVENTS_REL));
  const text = buffer.toString("utf8");
  const rawSegments = text.split("\n");
  const endsWithNewline = buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
  const bodySegments = endsWithNewline ? rawSegments.slice(0, -1) : rawSegments.slice();
  const emptyLineCount = bodySegments.filter((line) => line.trim() === "").length;
  const commentLineCount = bodySegments.filter((line) => /^\s*(\/\/|#)/.test(line)).length;
  const lines = bodySegments.filter((line) => line.trim() !== "");
  return {
    buffer,
    text,
    hasBom: buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf,
    crCount: (text.match(/\r/g) ?? []).length,
    endsWithNewline,
    emptyLineCount,
    commentLineCount,
    lines,
  };
}

function checkV1() {
  section("V1 schema + fixture");
  const checks = [];
  const fixtureHashBefore = sha256File(abs(EVENTS_REL));

  let schema = null;
  let schemaParseError = null;
  const schemaText = readFileSync(abs(SCHEMA_REL), "utf8");
  try {
    schema = JSON.parse(schemaText);
  } catch (error) {
    schemaParseError = error;
  }
  checks.push({
    ok: schema !== null,
    label: "schema JSON parses",
    detail: schemaParseError ? schemaParseError.message : SCHEMA_REL,
  });

  let validate = null;
  let compileError = null;
  if (schema) {
    const refCount = (schemaText.match(/"\$ref"/g) ?? []).length;
    const urlMatches = [...schemaText.matchAll(/https?:\/\/[^\s"']+/g)].map((m) => m[0]);
    const foreignUrls = [...new Set(urlMatches)].filter((url) => url !== EXPECTED_SCHEMA_DIALECT);
    checks.push({
      ok: schema.$schema === EXPECTED_SCHEMA_DIALECT,
      label: "$schema is 2020-12",
      detail: schema.$schema,
    });
    checks.push({
      ok: schema.$id === EXPECTED_SCHEMA_ID,
      label: "$id is the frozen URN",
      detail: schema.$id,
    });
    checks.push({ ok: refCount === 0, label: "no $ref (offline validation)", detail: `$ref count=${refCount}` });
    checks.push({
      ok: foreignUrls.length === 0,
      label: "no external schema URLs besides the 2020-12 meta-schema",
      detail: foreignUrls.length ? foreignUrls.join(", ") : "none",
    });

    try {
      const ajv = new Ajv2020({ allErrors: true, strict: true });
      validate = ajv.compile(schema);
    } catch (error) {
      compileError = error;
    }
    checks.push({
      ok: validate !== null,
      label: "Ajv 2020-12 compile with strict:true",
      detail: compileError ? String(compileError.message).slice(0, 300) : "compiled",
    });
  }

  const fixture = parseFixture();
  checks.push({
    ok: fixture.lines.length === EXPECTED_EVENT_COUNT,
    label: `exactly ${EXPECTED_EVENT_COUNT} non-empty JSONL lines`,
    detail: `lines=${fixture.lines.length}`,
  });
  checks.push({ ok: !fixture.hasBom, label: "UTF-8 without BOM", detail: `hasBom=${fixture.hasBom}` });
  checks.push({ ok: fixture.crCount === 0, label: "no CR bytes", detail: `\\r count=${fixture.crCount}` });
  checks.push({
    ok: fixture.endsWithNewline,
    label: "trailing newline at EOF",
    detail: `lastByte=0x${fixture.buffer.length ? fixture.buffer[fixture.buffer.length - 1].toString(16) : "??"}`,
  });
  checks.push({
    ok: fixture.emptyLineCount === 0,
    label: "no empty lines",
    detail: `emptyLines=${fixture.emptyLineCount}`,
  });
  checks.push({
    ok: fixture.commentLineCount === 0,
    label: "no comment lines",
    detail: `comments=${fixture.commentLineCount}`,
  });

  const parsed = [];
  const parseFailures = [];
  fixture.lines.forEach((line, index) => {
    try {
      parsed.push(JSON.parse(line));
    } catch (error) {
      parseFailures.push(`line ${index + 1}: ${error.message}`);
    }
  });
  checks.push({
    ok: parseFailures.length === 0,
    label: "every line is valid JSON",
    detail: parseFailures.length ? parseFailures.join("; ") : `${parsed.length} objects`,
  });

  const invalidLines = [];
  if (validate && parsed.length === fixture.lines.length) {
    parsed.forEach((event, index) => {
      if (!validate(event)) {
        const errors = (validate.errors ?? [])
          .slice(0, 3)
          .map((e) => `${e.instancePath || "/"} ${e.message}`)
          .join("; ");
        invalidLines.push(`line ${index + 1} spanId=${event.spanId}: ${errors}`);
      }
    });
  }
  checks.push({
    ok: validate !== null && parsed.length > 0 && invalidLines.length === 0,
    label: "every line validates against schema",
    detail: invalidLines.length ? invalidLines.slice(0, 3).join(" || ") : `${parsed.length}/${parsed.length} valid`,
  });

  const spanIds = parsed.map((e) => e.spanId);
  const badSpanIdFormat = spanIds.filter((id) => !/^[0-9a-f]{16}$/.test(String(id)));
  const uniqueSpanIds = new Set(spanIds);
  checks.push({
    ok: badSpanIdFormat.length === 0,
    label: "spanId is 16 lowercase hex",
    detail: badSpanIdFormat.length ? badSpanIdFormat.join(",") : `${spanIds.length} ids`,
  });
  checks.push({
    ok: uniqueSpanIds.size === spanIds.length,
    label: "spanIds unique",
    detail: `unique=${uniqueSpanIds.size}/${spanIds.length}`,
  });

  const roots = parsed.filter((e) => e.parentSpanId === null);
  checks.push({
    ok: roots.length === 1,
    label: "single root (parentSpanId null)",
    detail: roots.length === 1 ? `root=${roots[0].spanId} kind=${roots[0].kind}` : `roots=${roots.length}`,
  });

  const traceIds = [...new Set(parsed.map((e) => e.traceId))];
  checks.push({
    ok: traceIds.length === 1,
    label: "traceId consistent",
    detail: `distinct=${traceIds.length}${traceIds.length === 1 ? ` (${traceIds[0]})` : `: ${traceIds.join(",")}`}`,
  });

  let monotonic = true;
  const startSequence = [];
  parsed.forEach((event, index) => {
    startSequence.push(event.startNs);
    if (index > 0 && !(event.startNs >= parsed[index - 1].startNs)) monotonic = false;
  });
  checks.push({
    ok: monotonic,
    label: "startNs non-decreasing (file order)",
    detail: startSequence.join(","),
  });

  checks.push({
    ok: sha256File(abs(EVENTS_REL)) === fixtureHashBefore,
    label: "fixture bytes unchanged by validation",
    detail: `sha256=${fixtureHashBefore}`,
  });

  gate("V1", "schema (Ajv 2020-12 strict) + JSONL fixture invariants", checks, REPRO_VERIFY);
  return { parsed, validate, fixture };
}

/* ------------------------------------------------------------------ */
/* V1b expected facts                                                  */
/* ------------------------------------------------------------------ */

function checkV1b(parsed) {
  section("V1b expected facts");
  const checks = [];
  let facts = null;
  try {
    facts = JSON.parse(readFileSync(abs(FACTS_REL), "utf8"));
  } catch (error) {
    checks.push({ ok: false, label: "expected-facts.json parses", detail: error.message });
    gate("V1b", "expected facts vs events.jsonl", checks, REPRO_VERIFY);
    return;
  }

  checks.push({
    ok: facts.eventCount === EXPECTED_EVENT_COUNT && parsed.length === facts.eventCount,
    label: "eventCount matches",
    detail: `expected=${facts.eventCount} actual=${parsed.length}`,
  });
  checks.push({
    ok: facts.noExceptions === true && parsed.every((e) => e.status !== "THREW"),
    label: "noExceptions (no THREW status)",
    detail: `expected=${facts.noExceptions} threw=${parsed.filter((e) => e.status === "THREW").length}`,
  });
  checks.push({
    ok: facts.confidenceAllExact === true && parsed.every((e) => e.confidence === "EXACT"),
    label: "confidenceAllExact",
    detail: `values=${[...new Set(parsed.map((e) => e.confidence))].join(",")}`,
  });
  checks.push({
    ok: facts.statusAllOk === true && parsed.every((e) => e.status === "OK"),
    label: "statusAllOk",
    detail: `values=${[...new Set(parsed.map((e) => e.status))].join(",")}`,
  });
  checks.push({
    ok:
      typeof facts.flagRequired === "string" &&
      parsed.every((e) => Array.isArray(e.flags) && e.flags.includes(facts.flagRequired)),
    label: `every row flags contain ${facts.flagRequired}`,
    detail: `rowsWithFlag=${parsed.filter((e) => Array.isArray(e.flags) && e.flags.includes(facts.flagRequired)).length}/${parsed.length}`,
  });
  checks.push({
    ok: parsed.every((e) => e.traceId === facts.traceId),
    label: "traceId consistent with expected-facts",
    detail: facts.traceId,
  });
  checks.push({
    ok: parsed.every((e) => e.rootEventId === facts.rootEventId),
    label: "rootEventId consistent with expected-facts",
    detail: facts.rootEventId,
  });

  const factList = Array.isArray(facts.facts) ? facts.facts : [];
  checks.push({ ok: factList.length === 5, label: "5 facts present", detail: `count=${factList.length}` });

  for (const fact of factList) {
    const matches = parsed.filter((e) => e.kind === fact.kind && e.nodeKey === fact.nodeKey);
    if (matches.length !== 1) {
      checks.push({
        ok: false,
        label: `${fact.id} locate by kind+nodeKey`,
        detail: `kind=${fact.kind} nodeKey=${fact.nodeKey} matches=${matches.length}`,
      });
      continue;
    }
    const event = matches[0];
    checks.push({
      ok: event.status === fact.status,
      label: `${fact.id} status`,
      detail: `expected=${fact.status} actual=${event.status}`,
    });
    const lookup = getByPath(event, fact.assert?.path);
    const valueOk = lookup.found && deepEqual(lookup.value, fact.assert?.value);
    checks.push({
      ok: valueOk,
      label: `${fact.id} ${fact.assert?.path} deep-equals ${show(fact.assert?.value)}`,
      detail: lookup.found ? `actual=${show(lookup.value)}` : "path not found",
    });
  }

  gate("V1b", "expected-facts.json deep comparison (5 facts + global assertions)", checks, REPRO_VERIFY);
}

/* ------------------------------------------------------------------ */
/* V1c negative tests                                                  */
/* ------------------------------------------------------------------ */

function checkV1c(parsed, validate) {
  section("V1c negative tests");
  const checks = [];
  const fixtureHashBefore = sha256File(abs(EVENTS_REL));

  if (!validate || parsed.length === 0) {
    checks.push({ ok: false, label: "validator available", detail: "schema did not compile" });
    gate("V1c", "schema negative/positive tests", checks, REPRO_VERIFY);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `traceboard-s0-verify-${process.pid}-neg`);
  mkdirSync(tmpDir, { recursive: true });
  tmpDirs.push(tmpDir);

  const base = JSON.parse(JSON.stringify(parsed[0]));

  function validateCase(name, mutate) {
    const event = JSON.parse(JSON.stringify(base));
    mutate(event);
    const file = path.join(tmpDir, `${name}.jsonl`);
    writeFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
    const reread = JSON.parse(readFileSync(file, "utf8").trim());
    const ok = validate(reread);
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
    return { ok, errors, file };
  }

  const invalidStatus = validateCase("invalid-status", (e) => {
    e.status = "SUCCESS";
  });
  checks.push({
    ok: invalidStatus.ok === false,
    label: 'status "SUCCESS" rejected',
    detail: invalidStatus.ok ? "accepted (BAD)" : lastLines(invalidStatus.errors, 1)[0] ?? "rejected",
  });

  const missingReason = validateCase("missing-reason", (e) => {
    e.status = "NOT_COLLECTED_POLICY";
  });
  checks.push({
    ok: missingReason.ok === false,
    label: "NOT_COLLECTED_POLICY without reason rejected",
    detail: missingReason.ok ? "accepted (BAD)" : lastLines(missingReason.errors, 1)[0] ?? "rejected",
  });

  const extraProperty = validateCase("extra-property", (e) => {
    e.unexpectedField = "drift";
  });
  checks.push({
    ok: extraProperty.ok === false,
    label: "extra top-level property rejected (additionalProperties:false)",
    detail: extraProperty.ok ? "accepted (BAD)" : lastLines(extraProperty.errors, 1)[0] ?? "rejected",
  });

  const validPolicy = validateCase("valid-policy", (e) => {
    e.status = "NOT_COLLECTED_POLICY";
    e.reason = "policy:third_party_package";
  });
  checks.push({
    ok: validPolicy.ok === true,
    label: "valid NOT_COLLECTED_POLICY + reason accepted",
    detail: validPolicy.ok ? "accepted" : `rejected (BAD): ${validPolicy.errors}`,
  });

  checks.push({
    ok: sha256File(abs(EVENTS_REL)) === fixtureHashBefore,
    label: "source fixture untouched (hash stable)",
    detail: `sha256=${fixtureHashBefore}`,
  });

  rmSync(tmpDir, { recursive: true, force: true });
  gate("V1c", "schema self-test: negative copies rejected, positive copy accepted", checks, REPRO_VERIFY);
}

/* ------------------------------------------------------------------ */
/* V4b causal interval containment                                     */
/* ------------------------------------------------------------------ */

function checkV4b(parsed) {
  section("V4b causal interval containment");
  const checks = [];
  const byId = new Map(parsed.map((e) => [e.spanId, e]));
  const violations = [];
  const interval = (e) => `[${e.startNs},${e.startNs + e.durNs}]`;
  const strictChecked = [];
  const callbackChecked = [];

  function ascendToRoot(event) {
    const seen = new Set([event.spanId]);
    let current = event;
    while (current.parentSpanId !== null) {
      if (seen.has(current.parentSpanId)) return { ok: false, reason: "cycle" };
      const parent = byId.get(current.parentSpanId);
      if (!parent) return { ok: false, reason: `missing parent ${current.parentSpanId}` };
      seen.add(parent.spanId);
      current = parent;
    }
    return { ok: true, root: current };
  }

  for (const event of parsed) {
    if (event.parentSpanId === null) continue;
    const parent = byId.get(event.parentSpanId);
    if (!parent) {
      violations.push(
        `${event.spanId} parent=${event.parentSpanId} kind=${event.kind} -> parent span missing in file`,
      );
      continue;
    }
    if (event.kind !== "callback") {
      const childStart = event.startNs;
      const childEnd = event.startNs + event.durNs;
      const parentStart = parent.startNs;
      const parentEnd = parent.startNs + parent.durNs;
      if (childStart < parentStart || childEnd > parentEnd) {
        violations.push(
          `${event.spanId} parent=${parent.spanId} kind=${event.kind} child=${interval(event)} parent=${interval(parent)} (strict violation)`,
        );
      }
      strictChecked.push(event.spanId);
    } else {
      const ascent = ascendToRoot(event);
      if (!ascent.ok) {
        violations.push(`${event.spanId} kind=callback cannot resolve unique root: ${ascent.reason}`);
        continue;
      }
      const root = ascent.root;
      const childStart = event.startNs;
      const childEnd = event.startNs + event.durNs;
      const rootStart = root.startNs;
      const rootEnd = root.startNs + root.durNs;
      if (childStart < rootStart || childEnd > rootEnd) {
        violations.push(
          `${event.spanId} kind=callback child=${interval(event)} root=${root.spanId}${interval(root)} (root containment violation)`,
        );
      }
      callbackChecked.push({ event, parent, root, insideParent: childStart >= parent.startNs && childEnd <= parent.startNs + parent.durNs });
    }
  }

  checks.push({
    ok: violations.length === 0,
    label: "0 containment violations across 9 events",
    detail: violations.length ? violations.slice(0, 4).join(" || ") : "0 violations",
  });
  checks.push({
    ok: strictChecked.length === 7,
    label: "7 non-root non-callback spans checked strictly",
    detail: strictChecked.join(","),
  });
  checks.push({
    ok: callbackChecked.length === 1,
    label: "exactly one callback span, checked against root",
    detail: callbackChecked.map((c) => `${c.event.spanId} parent=${c.parent.spanId}(${c.parent.kind}) root=${c.root.spanId}`).join(","),
  });

  const cb = callbackChecked[0];
  if (cb) {
    checks.push({
      ok:
        cb.event.spanId === "1000000000000009" &&
        cb.parent.spanId === "1000000000000004" &&
        cb.parent.kind === "fetch" &&
        cb.root.spanId === "1000000000000001",
      label: "case-A callback is the sole exception (parent fetch, root ui_event)",
      detail: `callback=${cb.event.spanId} parent=${cb.parent.spanId}/${cb.parent.kind} root=${cb.root.spanId}`,
    });
    checks.push({
      ok: !cb.insideParent && cb.event.startNs >= cb.root.startNs && cb.event.startNs + cb.event.durNs <= cb.root.startNs + cb.root.durNs,
      label: "callback starts after its fetch parent ends but stays inside the root span",
      detail: `callback=${interval(cb.event)} parent=${interval(cb.parent)} root=${interval(cb.root)} insideParent=${cb.insideParent}`,
    });
  } else {
    checks.push({ ok: false, label: "case-A callback present", detail: "no callback span found" });
  }

  // Exemption must not leak to other kinds: assert no non-callback span violates strict containment
  // (already covered) and that no non-callback span was routed through the root-only path.
  checks.push({
    ok: callbackChecked.length === 1 && strictChecked.length === parsed.length - 2,
    label: "exception applies only to kind=callback",
    detail: `strict=${strictChecked.length} callback=${callbackChecked.length} total=${parsed.length}`,
  });

  gate("V4b", "causal intervals: parent exists, strict child containment, callback root-only", checks, REPRO_VERIFY);
}

/* ------------------------------------------------------------------ */
/* V2 builds                                                           */
/* ------------------------------------------------------------------ */

function buildAndRecord(id, title, command, { cwd, env, repro }) {
  section(`${id} build: ${command}`);
  const result = runShell(command, { cwd, env });
  const ok =
    result.code === 0 &&
    !result.error &&
    !result.signal &&
    !/BUILD FAILURE|ERR!|npm error/i.test(result.stdout + result.stderr);
  const evidence = [
    `cwd: ${cwd}`,
    `exit: ${result.code}${result.signal ? ` signal=${result.signal}` : ""}${result.error ? ` error=${result.error.message}` : ""}`,
    `duration: ${(result.ms / 1000).toFixed(1)}s`,
  ];
  if (ok) {
    const tail = lastLines(result.stdout, 3);
    if (tail.length) evidence.push(`last output: ${tail.join(" | ").slice(0, 400)}`);
  } else {
    evidence.push(...lastLines(`${result.stdout}\n${result.stderr}`, 25));
  }
  return record(id, title, ok, evidence, repro);
}

function checkV2() {
  section("V2 builds (sequential, real)");
  const results = {};

  results.root = buildAndRecord(
    "V2a",
    "root reactor (JDK21) mvn package",
    "mvn -B -q -DskipTests package",
    {
      cwd: REPO,
      env: { ...process.env, JAVA_HOME: JDK21_HOME },
      repro: `JAVA_HOME="${JDK21_HOME}" mvn -B -q -DskipTests package`,
    },
  );

  const defaultHome = process.env.JAVA_HOME || "";
  const demoHome = /1\.8|jdk8|jdk-8/i.test(defaultHome) ? defaultHome : JDK8_HOME;
  const demoEnv = { ...process.env, JAVA_HOME: demoHome };
  results.demoBackend = buildAndRecord(
    "V2b",
    `demo backend (JDK8: ${demoHome}) mvn package`,
    "mvn -B -q -DskipTests package",
    {
      cwd: abs("demo/buggy-shop-boot-vue/backend"),
      env: demoEnv,
      repro: `(cd "demo/buggy-shop-boot-vue/backend" && mvn -B -q -DskipTests package)`,
    },
  );

  results.workbenchCi = buildAndRecord("V2c-1", "workbench npm ci", "npm ci", {
    cwd: abs("workbench"),
    repro: `(cd "workbench" && npm ci)`,
  });
  results.workbenchBuild = buildAndRecord(
    "V2c-2",
    "workbench npm run build (prebuild syncs fixtures)",
    "npm run build",
    { cwd: abs("workbench"), repro: `(cd "workbench" && npm run build)` },
  );

  results.demoFrontendCi = buildAndRecord("V2d-1", "demo frontend npm ci", "npm ci", {
    cwd: abs("demo/buggy-shop-boot-vue/frontend"),
    repro: `(cd "demo/buggy-shop-boot-vue/frontend" && npm ci)`,
  });
  results.demoFrontendBuild = buildAndRecord(
    "V2d-2",
    "demo frontend npm run build",
    "npm run build",
    { cwd: abs("demo/buggy-shop-boot-vue/frontend"), repro: `(cd "demo/buggy-shop-boot-vue/frontend" && npm run build)` },
  );

  // prebuild must sync fixtures: copy present + identical to the frozen source
  const copyEvents = abs("workbench/public/fixtures/case-a-zero-rows/events.jsonl");
  const copyFacts = abs("workbench/public/fixtures/case-a-zero-rows/expected-facts.json");
  const syncChecks = [
    { ok: existsSync(copyEvents), label: "prebuild copy exists (events.jsonl)", detail: relOf(copyEvents) },
    {
      ok: existsSync(copyEvents) && sha256File(copyEvents) === sha256File(abs(EVENTS_REL)),
      label: "prebuild copy SHA256 equals fixtures source (events)",
      detail: existsSync(copyEvents) ? sha256File(copyEvents) : "missing",
    },
    {
      ok: existsSync(copyFacts) && sha256File(copyFacts) === sha256File(abs(FACTS_REL)),
      label: "prebuild copy SHA256 equals fixtures source (expected-facts)",
      detail: existsSync(copyFacts) ? sha256File(copyFacts) : "missing",
    },
  ];
  record("V2c-3", "workbench prebuild synced fixtures byte-identically", syncChecks.every((c) => c.ok),
    syncChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `(cd "workbench" && npm run sync:fixtures)`);

  return results;
}

/* ------------------------------------------------------------------ */
/* V3 agent bytecode                                                   */
/* ------------------------------------------------------------------ */

function checkV3() {
  section("V3 agent bytecode");
  const checks = [];
  const jarAbs = abs(AGENT_JAR_REL);
  checks.push({ ok: existsSync(jarAbs), label: "agent jar exists", detail: AGENT_JAR_REL });

  let major = null;
  let javapEvidence = "";
  if (existsSync(jarAbs) && existsSync(JDK21_JAVAP)) {
    const result = runExe(JDK21_JAVAP, [
      "-verbose",
      "-classpath",
      jarAbs,
      "io.traceboard.agent.TraceAgent",
    ]);
    javapEvidence = result.stdout;
    const match = result.stdout.match(/major version:\s*(\d+)/);
    if (match) major = Number(match[1]);
    checks.push({
      ok: major === 52,
      label: "javap major version",
      detail: major === null ? `not found; exit=${result.code} ${lastLines(result.stderr, 2).join(" ")}` : String(major),
    });
  } else {
    checks.push({ ok: false, label: "javap available", detail: JDK21_JAVAP });
  }

  const classAbs = abs(AGENT_CLASS_REL);
  if (existsSync(classAbs)) {
    const bytes = readFileSync(classAbs);
    const fallbackMajor = (bytes[6] << 8) | bytes[7];
    checks.push({
      ok: fallbackMajor === 52,
      label: "class file header major (bytes 6-7) is 52",
      detail: `major=${fallbackMajor} file=${AGENT_CLASS_REL}`,
    });
  } else if (major !== 52) {
    checks.push({ ok: false, label: "fallback class file", detail: `${AGENT_CLASS_REL} missing` });
  }

  const versionLine = javapEvidence.match(/minor version:\s*\d+,\s*major version:\s*(\d+)/);
  if (versionLine) checks.push({ ok: true, label: "javap raw line", detail: versionLine[0] });

  gate(
    "V3",
    "agent compiled for Java 8 (major version 52)",
    checks,
    `javap -verbose -classpath "${AGENT_JAR_REL}" io.traceboard.agent.TraceAgent | grep "major version"`,
  );
}

/* ------------------------------------------------------------------ */
/* HTTP helpers for V5                                                 */
/* ------------------------------------------------------------------ */

async function tryRequest(port, pathname, init = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const bases = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  let lastError = null;
  for (const base of bases) {
    try {
      const response = await fetch(base + pathname, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      return { ok: true, url: base + pathname, status: response.status, text };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, error: lastError, url: bases[0] + pathname };
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function startJavaServer(label, exe, args, cwd) {
  const child = spawn(exe, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const log = { text: "" };
  const append = (chunk) => {
    log.text += chunk.toString("utf8");
    if (log.text.length > 400000) log.text = log.text.slice(-200000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("error", (error) => {
    log.text += `\n[spawn error] ${error.message}`;
  });
  const server = { label, child, log, port: null };
  activeServers.add(server);
  console.log(`        started ${label}: pid=${child.pid} exe=${exe}`);
  return server;
}

async function stopServer(server) {
  if (!server) return;
  activeServers.delete(server);
  if (!server.child || server.child.exitCode !== null || server.child.pid === undefined) {
    return;
  }
  spawnSync("taskkill", ["/PID", String(server.child.pid), "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
  });
  await sleep(1000);
}

/* ------------------------------------------------------------------ */
/* S1-C/D/F collector: ingest + query + workbench path                 */
/* ------------------------------------------------------------------ */

function findSession(sessions, sessionId) {
  if (!Array.isArray(sessions)) return null;
  return sessions.find((item) => item && item.sessionId === sessionId) ?? null;
}

function wrapperProblems(validate, events, label) {
  const problems = [];
  if (!Array.isArray(events)) return [`${label}: events is not an array`];
  for (const item of events) {
    if (!item || typeof item !== "object" || !item.event || typeof item.event !== "object") {
      problems.push(`${label}: entry without nested event object`);
      continue;
    }
    if (!Number.isInteger(item.seq)) problems.push(`${label}: seq is not an integer`);
    if (Object.prototype.hasOwnProperty.call(item.event, "seq")) problems.push(`${label}: seq leaked inside event`);
    if (validate && !validate(item.event)) {
      const errors = (validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
      problems.push(`${label}: ${item.event.spanId} schema invalid (${errors})`);
    }
  }
  return problems;
}

async function getEventsPage(sessionId, query = "") {
  const res = await requestBase(
    COLLECTOR_BASE,
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/events${query}`,
  );
  const parsed = res.ok ? parseJson(res.text) : { ok: false };
  return { res, parsed, value: parsed.ok && parsed.value && typeof parsed.value === "object" ? parsed.value : {} };
}

async function checkS1CDF(validate) {
  section("S1-C/D/F collector ingest + query + workbench path");
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const pre = listeningOn(8601);
  const preconditions = [
    { ok: pre.supported && pre.lines.length === 0, label: "port 8601 free before start", detail: pre.lines.join(" | ") || "no listener" },
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(JDK21_JAVA), label: "JDK21 java.exe exists", detail: JDK21_JAVA },
  ];
  if (!preconditions.every((c) => c.ok)) {
    record(
      "S1-C0",
      "collector health + meta capabilities",
      false,
      preconditions.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `"${JDK21_JAVA}" -jar "${COLLECTOR_JAR_REL}"`,
    );
    for (const [id, title] of [
      ["S1-C1", "ingest happy path, 202 counts, idempotent dropped"],
      ["S1-C2", "per-line rejects: invalid status + mixed batch"],
      ["S1-C3", "envelope negatives 415/400/413 + no body echo"],
      ["S1-D", "read-only query shapes, paging, 400/404/405, reserved routes"],
      ["S1-F", "workbench fake-batch path"],
    ]) {
      record(id, title, false, [{ ok: false, label: "collector not started", detail: "precondition failed" }], null);
    }
    return;
  }

  let collector = null;
  try {
    collector = startJavaServer("collector(8601)", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);

    const metaRes = health ? await requestBase(COLLECTOR_BASE, "/api/v1/meta", { method: "GET" }) : null;
    const metaParsed = metaRes && metaRes.ok ? parseJson(metaRes.text) : { ok: false };
    const meta = metaParsed.ok && metaParsed.value ? metaParsed.value : {};
    const caps = meta.capabilities ?? {};

    const c0 = [
      {
        ok: Boolean(health) && parseJson(health.text).value?.status === "UP",
        label: "health 200 {status:UP}",
        detail: health ? show(health.text) : "timeout / connection refused",
      },      {
        ok: metaRes?.ok && metaRes.status === 200 && meta.service === "traceboard-collector" &&
          meta.apiVersion === "v1" && meta.version === "0.1.0-SNAPSHOT",
        label: "meta service/version/apiVersion",
        detail: show(metaRes?.text),
      },
      {
        ok: meta.schema?.id === EXPECTED_SCHEMA_ID && meta.schema?.version === "traceboard.event.v1" &&
          meta.schema?.dialect === "2020-12",
        label: "meta schema id/version/dialect",
        detail: show(meta.schema),
      },
      {
        ok: caps.health === true && caps.meta === true && caps.ingestEvents === true &&
          caps.realtime === false && caps.replay === true,
        label: "S3 migration: capabilities ingestEvents=true / realtime=false / replay=true",
        detail: show(caps),
      },
      {
        ok: Object.keys(caps).length === 5,
        label: "capabilities has exactly 5 keys",
        detail: Object.keys(caps).join(","),
      },
    ];
    record(
      "S1-C0",
      "collector health + meta capabilities",
      c0.every((c) => c.ok),
      c0.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `"${JDK21_JAVA}" -jar "${COLLECTOR_JAR_REL}"`,
    );
    if (!health) {
      for (const [id, title] of [
        ["S1-C1", "ingest happy path, 202 counts, idempotent dropped"],
        ["S1-C2", "per-line rejects: invalid status + mixed batch"],
        ["S1-C3", "envelope negatives 415/400/413 + no body echo"],
        ["S1-D", "read-only query shapes, paging, 400/404/405, reserved routes"],
        ["S1-F", "workbench fake-batch path"],
      ]) {
        record(id, title, false, [{ ok: false, label: "collector health timeout", detail: "GET /actuator/health failed" }], null);
      }
      return;
    }

    const batch = readTextFileMeta(S1_BATCH_REL);
    const fixtureEvents = batch.lines.map((line) => JSON.parse(line));

    /* ---------------- S1-C1 happy path + idempotency ---------------- */
    const valid = await postNdjson("/ingest/v1/events", batch.text, `${NDJSON}; charset=utf-8`);
    const validParsed = valid.ok ? parseJson(valid.text) : { ok: false };
    const validBody = validParsed.ok ? validParsed.value ?? {} : {};
    const dup = await postNdjson("/ingest/v1/events", batch.text, `${NDJSON}; charset=utf-8`);
    const dupParsed = dup.ok ? parseJson(dup.text) : { ok: false };
    const dupBody = dupParsed.ok ? dupParsed.value ?? {} : {};

    const sessionsRes = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const sessionsParsed = sessionsRes.ok ? parseJson(sessionsRes.text) : { ok: false };
    const sessions = sessionsParsed.ok ? sessionsParsed.value?.sessions : null;
    const wbSession = findSession(sessions, S1_WORKBENCH_SESSION);
    const firstPage = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200");
    const firstEvents = Array.isArray(firstPage.value.events) ? firstPage.value.events : [];
    const firstProblems = wrapperProblems(validate, firstEvents, "s_wb_demo page");

    const c1 = [
      {
        ok: valid.ok && valid.status === 202,
        label: "valid 2-line batch -> 202",
        detail: valid.ok ? `status=${valid.status} body=${show(valid.text)}` : String(valid.error),
      },
      {
        ok: validBody.accepted === 2 && validBody.rejected === 0 && validBody.dropped === 0 &&
          Array.isArray(validBody.errors) && validBody.errors.length === 0,
        label: "202 {accepted:2,rejected:0,dropped:0,errors:[]}",
        detail: show(valid.text),
      },
      {
        ok: dup.ok && dup.status === 202 && dupBody.accepted === 0 && dupBody.rejected === 0 &&
          dupBody.dropped === 2 && Array.isArray(dupBody.errors) && dupBody.errors.length === 0,
        label: "duplicate batch -> 202 {accepted:0,rejected:0,dropped:2}",
        detail: show(dup.text),
      },
      {
        ok: Boolean(wbSession) && wbSession.eventCount === 2 &&
          Number.isInteger(wbSession.startedAtMs) && wbSession.startedAtMs > 0 &&
          Number.isInteger(wbSession.lastEventAtMs) && wbSession.lastEventAtMs >= wbSession.startedAtMs,
        label: "sessions: s_wb_demo eventCount=2, startedAtMs>0, lastEventAtMs>=startedAtMs",
        detail: show(wbSession),
      },
      {
        ok: firstPage.res.ok && firstPage.res.status === 200 && firstEvents.length === 2 &&
          firstPage.value.nextSeq === 2 &&
          firstEvents.map((entry) => entry.seq).join(",") === "1,2",
        label: "events page: 2 wrappers seq=1,2 nextSeq=2",
        detail: show(firstPage.value),
      },
      {
        ok: firstProblems.length === 0,
        label: "every returned event is schema-valid and seq stays outside the event",
        detail: firstProblems.length ? firstProblems.slice(0, 3).join(" || ") : "2/2 valid",
      },
    ];
    record(
      "S1-C1",
      "ingest happy path, 202 counts, idempotent dropped",
      c1.every((c) => c.ok),
      c1.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @"${S1_BATCH_REL}"`,
    );

    /* ---------------- S1-C2 per-line rejects ---------------- */
    const badStatus = { ...fixtureEvents[0], status: "SUCCESS" };
    const badStatusRes = await postNdjson("/ingest/v1/events", `${JSON.stringify(badStatus)}\n`);
    const badStatusParsed = badStatusRes.ok ? parseJson(badStatusRes.text) : { ok: false };
    const badStatusBody = badStatusParsed.ok ? badStatusParsed.value ?? {} : {};
    const badErrors = Array.isArray(badStatusBody.errors) ? badStatusBody.errors : [];

    const mixedSession = "s_s1_mixed";
    const mixedEvent = {
      ...fixtureEvents[0],
      sessionId: mixedSession,
      traceId: hexRandom(16),
      spanId: hexRandom(8),
      rootEventId: `click_${hexRandom(8)}`,
    };
    const mixedInvalidSchema = { ...mixedEvent, spanId: hexRandom(8), status: "NOT_A_STATUS" };
    const mixedBody = `${JSON.stringify(mixedEvent)}\n{"broken":\n${JSON.stringify(mixedInvalidSchema)}\n`;
    const mixedRes = await postNdjson("/ingest/v1/events", mixedBody);
    const mixedParsed = mixedRes.ok ? parseJson(mixedRes.text) : { ok: false };
    const mixedResult = mixedParsed.ok ? mixedParsed.value ?? {} : {};
    const mixedErrors = Array.isArray(mixedResult.errors) ? mixedResult.errors : [];
    const mixedSessionRes = await getEventsPage(mixedSession, "?afterSeq=0&limit=200");
    const mixedStored = Array.isArray(mixedSessionRes.value.events) ? mixedSessionRes.value.events : [];

    const c2 = [
      {
        ok: badStatusRes.ok && badStatusRes.status === 202 && badStatusBody.accepted === 0 &&
          badStatusBody.rejected === 1 && badStatusBody.dropped === 0 && badErrors.length === 1,
        label: "invalid status line -> 202 {accepted:0,rejected:1,dropped:0}",
        detail: show(badStatusRes.text),
      },
      {
        ok: badErrors.length === 1 && badErrors[0].line === 1 && badErrors[0].code === "schema_violation" &&
          typeof badErrors[0].message === "string" && badErrors[0].message.length <= 200 &&
          !badErrors[0].message.includes(fixtureEvents[0].traceId) && !badErrors[0].message.includes("SUCCESS"),
        label: "errors[] line=1 code=schema_violation, message<=200, no payload echo",
        detail: show(badErrors[0]),
      },
      {
        ok: mixedRes.ok && mixedRes.status === 202 && mixedResult.accepted === 1 &&
          mixedResult.rejected === 2 && mixedResult.dropped === 0,
        label: "mixed batch -> 202 {accepted:1,rejected:2,dropped:0}",
        detail: show(mixedRes.text),
      },
      {
        ok: mixedErrors.length === 2 &&
          mixedErrors.map((e) => e.line).join(",") === "2,3" &&
          mixedErrors[0]?.code === "invalid_json" && mixedErrors[1]?.code === "schema_violation" &&
          mixedErrors.every((e) => typeof e.message === "string" && e.message.length <= 200) &&
          !mixedRes.text.includes(mixedEvent.traceId) && !mixedRes.text.includes("broken"),
        label: "mixed errors line=2 invalid_json, line=3 schema_violation; no echo",
        detail: show(mixedErrors),
      },
      {
        ok: mixedSessionRes.res.ok && mixedSessionRes.res.status === 200 && mixedStored.length === 1 &&
          mixedStored[0].seq === 1 && wrapperProblems(validate, mixedStored, "s_s1_mixed").length === 0,
        label: "the one valid mixed line is stored (seq=1, schema-valid)",
        detail: show(mixedSessionRes.value),
      },
    ];
    record(
      "S1-C2",
      "per-line rejects: invalid status + mixed batch",
      c2.every((c) => c.ok),
      c2.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson" --data-binary @mixed.ndjson`,
    );

    /* ---------------- S1-C3 envelope negatives ---------------- */
    const bigLine = `ECHOMARKER_S1 ${"a".repeat(65 * 1024)}\n`;
    const hugeBody = `ECHOMARKER_S1${"a".repeat(4 * 1024 * 1024 + 1024)}`;
    const bulkLines = Array.from({ length: 1001 }, (_, index) =>
      JSON.stringify({
        ...fixtureEvents[0],
        sessionId: "s_s1_bulk",
        traceId: hexRandom(16),
        spanId: index.toString(16).padStart(16, "0"),
        rootEventId: `click_${hexRandom(8)}`,
        nodeKey: "#ECHOMARKER_S1",
      }),
    ).join("\n") + "\n";

    const r415 = await postNdjson("/ingest/v1/events", batch.text, "text/plain");
    const r415Huge = await postNdjson("/ingest/v1/events", hugeBody, "text/plain");
    const rEmpty = await postNdjson("/ingest/v1/events", "");
    const rBlank = await postNdjson("/ingest/v1/events", "\n");
    const rBulk = await postNdjson("/ingest/v1/events", bulkLines);
    const rBigLine = await postNdjson("/ingest/v1/events", bigLine);
    const rHuge = await postNdjson("/ingest/v1/events", hugeBody);
    const rNonUtf8 = await postNdjson("/ingest/v1/events", Buffer.from([0xff, 0xfe, 0x0a]));
    const bulkSession = await getEventsPage("s_s1_bulk", "?afterSeq=0&limit=200");

    const c3 = [
      ...envelopeChecks(r415, 415, "unsupported_media_type", "text/plain", ["ECHOMARKER_S1"]),
      ...envelopeChecks(r415Huge, 415, "unsupported_media_type", "wrong type + >4MB body (415 wins)", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rEmpty, 400, "bad_request", "empty body", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rBlank, 400, "bad_request", "blank line", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rBulk, 400, "bad_request", "1001 lines", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rBigLine, 413, "payload_too_large", "65KB line", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rHuge, 413, "payload_too_large", ">4MB body", ["ECHOMARKER_S1"]),
      ...envelopeChecks(rNonUtf8, 400, "bad_request", "non-UTF-8 body", []),
      {
        ok: bulkSession.res.ok && bulkSession.res.status === 404,
        label: "rejected 1001-line batch wrote nothing (s_s1_bulk 404)",
        detail: bulkSession.res.ok ? `status=${bulkSession.res.status}` : String(bulkSession.res.error),
      },
    ];
    record(
      "S1-C3",
      "envelope negatives 415/400/413 + no body echo",
      c3.every((c) => c.ok),
      c3.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: text/plain" --data-binary '{}'`,
    );

    /* ---------------- S1-D read-only query ---------------- */
    const sessionsList = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const sessionsListParsed = sessionsList.ok ? parseJson(sessionsList.text) : { ok: false };
    const listed = sessionsListParsed.ok ? sessionsListParsed.value?.sessions : null;
    const listedWb = findSession(listed, S1_WORKBENCH_SESSION);
    const listedMixed = findSession(listed, "s_s1_mixed");

    const pageAll = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200");
    const pageOne = await getEventsPage(S1_WORKBENCH_SESSION, "?limit=1");
    const pageAfter1 = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=1");
    const pageAfter2 = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=2");
    const pageExtra = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200&foo=bar");
    const badLimit0 = await getEventsPage(S1_WORKBENCH_SESSION, "?limit=0");
    const badLimit501 = await getEventsPage(S1_WORKBENCH_SESSION, "?limit=501");
    const badAfterNegative = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=-1");
    const badAfterText = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=abc");
    const unknown = await getEventsPage("s_missing", "");
    const postSessions = await requestBase(COLLECTOR_BASE, "/api/v1/sessions", { method: "POST" });
    const putEvents = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/events`, { method: "PUT" });
    const deleteEvents = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/events`, { method: "DELETE" });
    const graph = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/graph`);
    const replay = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/replay`);
    const replayParsed = replay.ok ? parseJson(replay.text) : { ok: false };
    const replayBody = replayParsed.ok && replayParsed.value ? replayParsed.value : {};
    const stream = await requestBase(COLLECTOR_BASE, "/api/v1/stream");
    const ws = await requestBase(COLLECTOR_BASE, "/ws/v1/events");
    const links = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S1_WORKBENCH_SESSION}/links`, { method: "POST" });

    const allEvents = Array.isArray(pageAll.value.events) ? pageAll.value.events : [];
    const d = [
      {
        ok: sessionsList.ok && sessionsList.status === 200 && Boolean(listedWb) && listedWb.eventCount === 2 &&
          Boolean(listedMixed) && listedMixed.eventCount === 1,
        label: "GET /api/v1/sessions: s_wb_demo=2, s_s1_mixed=1",
        detail: show(listed),
      },
      {
        ok: pageAll.res.status === 200 && allEvents.length === 2 && pageAll.value.nextSeq === 2 &&
          allEvents.map((e) => e.seq).join(",") === "1,2" &&
          wrapperProblems(validate, allEvents, "pageAll").length === 0,
        label: "wrapper {seq,event}: 2 schema-valid events, nextSeq=2",
        detail: show(pageAll.value),
      },
      {
        ok: pageOne.res.status === 200 && pageOne.value.events?.length === 1 &&
          pageOne.value.events[0].seq === 1 && pageOne.value.nextSeq === 1,
        label: "limit=1 -> 1 event seq=1 nextSeq=1",
        detail: show(pageOne.value),
      },
      {
        ok: pageAfter1.res.status === 200 && pageAfter1.value.events?.length === 1 &&
          pageAfter1.value.events[0].seq === 2 && pageAfter1.value.nextSeq === 2,
        label: "afterSeq=1 -> seq=2 nextSeq=2",
        detail: show(pageAfter1.value),
      },
      {
        ok: pageAfter2.res.status === 200 && pageAfter2.value.events?.length === 0 && pageAfter2.value.nextSeq === 2,
        label: "afterSeq=2 -> empty page nextSeq=2",
        detail: show(pageAfter2.value),
      },
      {
        ok: pageExtra.res.status === 200 && pageExtra.value.events?.length === 2,
        label: "unknown query param ignored",
        detail: `status=${pageExtra.res.status}`,
      },
      ...envelopeChecks(badLimit0.res, 400, "bad_request", "limit=0", []),
      ...envelopeChecks(badLimit501.res, 400, "bad_request", "limit=501", []),
      ...envelopeChecks(badAfterNegative.res, 400, "bad_request", "afterSeq=-1", []),
      ...envelopeChecks(badAfterText.res, 400, "bad_request", "afterSeq=abc", []),
      ...envelopeChecks(unknown.res, 404, "not_found", "unknown session", []),
      {
        ok: postSessions.ok && postSessions.status === 405,
        label: "POST /api/v1/sessions -> 405",
        detail: `status=${postSessions.status}`,
      },
      {
        ok: putEvents.ok && putEvents.status === 405 && deleteEvents.ok && deleteEvents.status === 405,
        label: "PUT/DELETE .../events -> 405",
        detail: `PUT=${putEvents.status} DELETE=${deleteEvents.status}`,
      },
      ...envelopeChecks(graph, 400, "bad_request", "graph without traceId (S2: implemented, param required)", []),
      {
        ok: replay.ok && replay.status === 200 && replayParsed.ok &&
          replayBody.mode === "replay" && replayBody.readOnly === true &&
          replayBody.sessionId === S1_WORKBENCH_SESSION && replayBody.fromNs === 0 &&
          Number.isInteger(replayBody.toNs) && replayBody.toNs > 0 &&
          Array.isArray(replayBody.events) && replayBody.events.length === 2 &&
          deepEqual(replayBody.events.map((entry) => entry.event.spanId), sortedByStart(fixtureEvents).map((event) => event.spanId)) &&
          replayBody.events.map((entry) => entry.seq).join(",") === "1,2",
        label: "S3 migration: replay is implemented -> 200 {mode:replay, readOnly:true, fromNs:0, default window=2 events}",
        detail: show(replay.text),
      },
      {
        ok: stream.ok && stream.status === 404 && ws.ok && ws.status === 404 &&
          links.ok && links.status === 404,
        label: "stream/ws/links stay unregistered -> 404",
        detail: `stream=${stream.status} ws=${ws.status} links=${links.status}`,
      },
    ];
    record(
      "S1-D",
      "read-only query shapes, paging, 400/404/405, S2 graph param contract, reserved routes",
      d.every((c) => c.ok),
      d.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s "http://127.0.0.1:8601/api/v1/sessions/s_wb_demo/events?afterSeq=0&limit=200"`,
    );

    /* ---------------- S1-F workbench fake-batch path ---------------- */
    const wbTraceId = hexRandom(16);
    const wbClickId = hexRandom(8);
    const wbFetchId = hexRandom(8);
    const wbRoot = `click_${hexRandom(8)}`;
    const wbClick = {
      ...fixtureEvents[0],
      traceId: wbTraceId,
      spanId: wbClickId,
      rootEventId: wbRoot,
    };
    const wbFetch = {
      ...fixtureEvents[1],
      traceId: wbTraceId,
      spanId: wbFetchId,
      parentSpanId: wbClickId,
      rootEventId: wbRoot,
    };
    const wbProblems = wrapperProblems(validate, [{ seq: 0, event: wbClick }, { seq: 1, event: wbFetch }], "generated workbench batch");
    const wbPost = await postNdjson("/ingest/v1/events", `${JSON.stringify(wbClick)}\n${JSON.stringify(wbFetch)}\n`);
    const wbPostParsed = wbPost.ok ? parseJson(wbPost.text) : { ok: false };
    const wbResult = wbPostParsed.ok ? wbPostParsed.value ?? {} : {};
    const wbSessionsRes = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const wbSessionsParsed = wbSessionsRes.ok ? parseJson(wbSessionsRes.text) : { ok: false };
    const wbSessions = wbSessionsParsed.ok ? wbSessionsParsed.value?.sessions : null;
    const wbCount = findSession(wbSessions, S1_WORKBENCH_SESSION)?.eventCount ?? -1;
    const wbPage = await getEventsPage(S1_WORKBENCH_SESSION, "?afterSeq=0&limit=200");
    const wbEvents = Array.isArray(wbPage.value.events) ? wbPage.value.events : [];
    const wbNew = wbEvents.slice(2);

    const f = [
      {
        ok: wbProblems.length === 0,
        label: "generated batch is schema-valid (same shape as fixtures/frontend-fake-batch.ndjson)",
        detail: wbProblems.length ? wbProblems.join(" || ") : "2/2 valid",
      },
      {
        ok: wbPost.ok && wbPost.status === 202 && wbResult.accepted === 2 && wbResult.rejected === 0 && wbResult.dropped === 0,
        label: "POST fake batch -> 202 accepted=2",
        detail: show(wbPost.text),
      },
      {
        ok: wbCount === 4,
        label: "sessions: s_wb_demo eventCount=4 after the second (workbench) click",
        detail: `eventCount=${wbCount}`,
      },
      {
        ok: wbPage.res.status === 200 && wbEvents.length === 4 &&
          wbEvents.map((e) => e.seq).join(",") === "1,2,3,4" && wbPage.value.nextSeq === 4,
        label: "read-back page keeps seq order 1,2,3,4 nextSeq=4",
        detail: show(wbPage.value),
      },
      {
        ok: wbNew.length === 2 && wbNew[0].seq === 3 && wbNew[1].seq === 4 &&
          wbNew[0].event.kind === "ui_event" && wbNew[0].event.parentSpanId === null &&
          wbNew[0].event.traceId === wbTraceId && wbNew[0].event.rootEventId === wbRoot &&
          wbNew[1].event.kind === "fetch" && wbNew[1].event.parentSpanId === wbClickId &&
          wbNew[1].event.traceId === wbTraceId && wbNew[1].event.rootEventId === wbRoot &&
          wbNew.every((entry) => entry.event.confidence === "EXACT" && entry.event.status === "OK"),
        label: "new page entries are the fresh ui_event root + fetch child (new trace/root, no merge)",
        detail: show(wbNew),
      },
      {
        ok: wbTraceId !== fixtureEvents[0].traceId,
        label: "fresh click uses a new traceId (repeated clicks never collide)",
        detail: `${wbTraceId}`,
      },
    ];
    record(
      "S1-F",
      "workbench fake-batch path",
      f.every((c) => c.ok),
      f.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson" --data-binary @fresh-batch.ndjson`,
    );

    /* ---------------- S2-4F requests/graph over the ingested S2 fixture ---------------- */
    const s2Meta = readTextFileMeta(S2_EVENTS_REL);
    const s2FixtureEvents = s2Meta.lines.map((line) => JSON.parse(line));
    const s2Ingest = await postNdjson("/ingest/v1/events", s2Meta.text, `${NDJSON}; charset=utf-8`);
    const s2IngestParsed = s2Ingest.ok ? parseJson(s2Ingest.text) : { ok: false };
    const s2IngestBody = s2IngestParsed.ok ? s2IngestParsed.value ?? {} : {};

    const pageBeforeGraph = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const s2ReqRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/requests`);
    const s2ReqParsed = s2ReqRes.ok ? parseJson(s2ReqRes.text) : { ok: false };
    const s2ReqBody = s2ReqParsed.ok ? s2ReqParsed.value ?? {} : {};
    const s2Requests = Array.isArray(s2ReqBody.requests) ? s2ReqBody.requests : [];
    const s2Req0 = s2Requests[0] ?? {};

    const s2GraphUrl = `/api/v1/sessions/${S2_SESSION}/graph?traceId=${S2_TRACE_ID}`;
    const s2GraphRes1 = await requestBase(COLLECTOR_BASE, s2GraphUrl);
    const s2GraphParsed1 = s2GraphRes1.ok ? parseJson(s2GraphRes1.text) : { ok: false };
    const s2Graph1 = s2GraphParsed1.ok ? s2GraphParsed1.value ?? {} : {};
    const s2GraphRes2 = await requestBase(COLLECTOR_BASE, s2GraphUrl);
    const pageAfterGraph = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");

    const s2Nodes = Array.isArray(s2Graph1.nodes) ? s2Graph1.nodes : [];
    const s2Edges = Array.isArray(s2Graph1.edges) ? s2Graph1.edges : [];
    const nodeMismatches = [];
    const orderedFixture = sortedByStart(s2FixtureEvents);
    if (s2Nodes.length === orderedFixture.length) {
      orderedFixture.forEach((event, index) => {
        const node = s2Nodes[index];
        const expectedReturn = Object.prototype.hasOwnProperty.call(event, "return") ? event.return : null;
        const expectedEffects = Array.isArray(event.sideEffects) ? event.sideEffects : [];
        if (node.spanId !== event.spanId || node.parentSpanId !== event.parentSpanId ||
            node.kind !== event.kind || node.nodeKey !== event.nodeKey ||
            node.status !== event.status || node.startNs !== event.startNs || node.durNs !== event.durNs) {
          nodeMismatches.push(`node${index} scalars`);
        }
        if (!deepEqual(node.return, expectedReturn)) nodeMismatches.push(`node${index} return=${show(node.return)}`);
        if (!deepEqual(node.sideEffects, expectedEffects)) nodeMismatches.push(`node${index} sideEffects=${show(node.sideEffects)}`);
        if (!deepEqual(node.thread, event.thread)) nodeMismatches.push(`node${index} thread`);
        if (!deepEqual(node.flags, event.flags)) nodeMismatches.push(`node${index} flags=${show(node.flags)}`);
        if (!deepEqual(node.reason, event.reason ?? null)) nodeMismatches.push(`node${index} reason=${show(node.reason)}`);
        if (!deepEqual(node.source, event.source ?? null)) nodeMismatches.push(`node${index} source=${show(node.source)}`);
        if (!deepEqual(node.confidence, event.confidence)) nodeMismatches.push(`node${index} confidence=${show(node.confidence)}`);
      });
    }
    const expectedEdges = orderedFixture.slice(1).map((event, index) => ({
      from: orderedFixture[index].spanId,
      to: event.spanId,
      count: 1,
    }));

    const badGraphNoParam = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph`);
    const badGraphUpper = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph?traceId=${S2_TRACE_ID.toUpperCase()}`);
    const badGraphMarker = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph?traceId=ECHOMARKER_S2_NOT_HEX_0123456789`);
    const unknownTrace = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph?traceId=${"0".repeat(32)}`);
    const unknownSessionReq = await requestBase(COLLECTOR_BASE, "/api/v1/sessions/s_s2_missing/requests");
    const unknownSessionGraph = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/s_s2_missing/graph?traceId=${S2_TRACE_ID}`);
    const postRequests = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/requests`, { method: "POST" });
    const postGraph = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph?traceId=${S2_TRACE_ID}`, { method: "POST" });
    const s2Replay = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/replay`);
    const s2ReplayParsed = s2Replay.ok ? parseJson(s2Replay.text) : { ok: false };
    const s2ReplayBody = s2ReplayParsed.ok ? s2ReplayParsed.value ?? {} : {};
    const s2ExpectedToNs = Math.max(...s2FixtureEvents.map((event) => event.startNs + event.durNs), 0);
    const s2Stream = await requestBase(COLLECTOR_BASE, "/api/v1/stream");
    const s2Ws = await requestBase(COLLECTOR_BASE, "/ws/v1/events");
    const s2Links = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/links`, { method: "POST" });

    const pageBeforeCount = Array.isArray(pageBeforeGraph.value.events) ? pageBeforeGraph.value.events.length : -1;
    const pageAfterCount = Array.isArray(pageAfterGraph.value.events) ? pageAfterGraph.value.events.length : -1;
    const s2f = [
      {
        ok: s2Ingest.ok && s2Ingest.status === 202 && s2IngestBody.accepted === 4 &&
          s2IngestBody.rejected === 0 && s2IngestBody.dropped === 0,
        label: "POST fixtures/s2-zero-row-chain/events.ndjson -> 202 accepted=4",
        detail: show(s2Ingest.text),
      },
      {
        ok: s2ReqRes.ok && s2ReqRes.status === 200 && s2ReqBody.sessionId === S2_SESSION &&
          s2Requests.length === 1,
        label: "requests: 200, sessionId echo, exactly 1 trace",
        detail: show(s2ReqRes.text),
      },
      {
        ok: s2Req0.traceId === S2_TRACE_ID && s2Req0.rootSpanId === S2_ROOT_SPAN_ID &&
          s2Req0.rootKind === "controller" && s2Req0.nodeKey === S2_CONTROLLER_NODE_KEY &&
          s2Req0.status === "OK" && s2Req0.confidence === "LOST" && s2Req0.spanCount === 4 &&
          s2Req0.startedAtNs === 1000000000 && s2Req0.durNs === 8000000 && s2Req0.hasError === false,
        label: "requests[0]: fixture trace/root/controller/OK/LOST/spanCount=4/dur=8ms/no error",
        detail: show(s2Req0),
      },
      {
        ok: s2GraphRes1.ok && s2GraphRes1.status === 200 && s2Graph1.sessionId === S2_SESSION &&
          s2Graph1.traceId === S2_TRACE_ID && s2Graph1.rootEventId === S2_ROOT_EVENT_ID &&
          s2Graph1.confidence === "LOST",
        label: "graph: 200, session/trace/rootEventId/confidence echo",
        detail: show({ sessionId: s2Graph1.sessionId, traceId: s2Graph1.traceId, rootEventId: s2Graph1.rootEventId, confidence: s2Graph1.confidence }),
      },
      {
        ok: s2Nodes.length === 4 && s2Nodes.map((node) => node.kind).join(",") === "controller,service,mapper,sql" &&
          nodeMismatches.length === 0,
        label: "graph nodes: 4, startNs order controller/service/mapper/sql, return/sideEffects/thread/flags verbatim",
        detail: nodeMismatches.length ? nodeMismatches.slice(0, 4).join(" || ") : "4/4 nodes match the fixture",
      },
      {
        ok: s2Edges.length === 3 && deepEqual(s2Edges, expectedEdges),
        label: "graph edges: 3 exact parent->child pairs, count=1",
        detail: show(s2Edges),
      },
      {
        ok: s2GraphRes2.ok && s2GraphRes2.status === 200 && s2GraphRes2.text === s2GraphRes1.text,
        label: "two identical graph GETs return byte-identical bodies (read-time derivation)",
        detail: s2GraphRes2.text === s2GraphRes1.text ? "identical" : show(s2GraphRes2.text),
      },
      {
        ok: pageBeforeGraph.res.status === 200 && pageBeforeCount === 4 && pageAfterCount === 4 &&
          pageBeforeGraph.value.nextSeq === 4 && pageAfterGraph.value.nextSeq === 4 &&
          pageAfterGraph.text === pageBeforeGraph.text,
        label: "graph/requests reads do not change events/seq (4 events before and after)",
        detail: `before=${pageBeforeCount} after=${pageAfterCount} nextSeq=${pageAfterGraph.value.nextSeq}`,
      },
      ...envelopeChecks(badGraphNoParam, 400, "bad_request", "graph missing traceId", []),
      ...envelopeChecks(badGraphUpper, 400, "bad_request", "graph uppercase traceId", []),
      {
        ok: badGraphMarker.ok && badGraphMarker.status === 400 && !badGraphMarker.text.includes("ECHOMARKER_S2"),
        label: "graph invalid traceId -> 400 without echoing the parameter",
        detail: show(badGraphMarker.text),
      },
      ...envelopeChecks(unknownTrace, 404, "not_found", "graph unknown traceId in session", []),
      ...envelopeChecks(unknownSessionReq, 404, "not_found", "requests unknown session", []),
      ...envelopeChecks(unknownSessionGraph, 404, "not_found", "graph unknown session", []),
      {
        ok: postRequests.status === 405 && postGraph.status === 405,
        label: "POST requests/graph -> 405 (read-only)",
        detail: `requests=${postRequests.status} graph=${postGraph.status}`,
      },
      {
        ok: s2Replay.status === 200 && s2ReplayParsed.ok && s2ReplayBody.mode === "replay" &&
          s2ReplayBody.readOnly === true && s2ReplayBody.sessionId === S2_SESSION &&
          s2ReplayBody.fromNs === 0 && s2ReplayBody.toNs === s2ExpectedToNs &&
          Array.isArray(s2ReplayBody.events) && s2ReplayBody.events.length === 4 &&
          deepEqual(s2ReplayBody.events.map((entry) => entry.event.spanId), sortedByStart(s2FixtureEvents).map((event) => event.spanId)),
        label: "S3 migration: replay over the S2 fixture -> 200 {mode:replay, readOnly:true, default window=4 events}",
        detail: show(s2Replay.text?.slice(0, 240)),
      },
      {
        ok: s2Stream.status === 404 && s2Ws.status === 404 && s2Links.status === 404,
        label: "stream/ws/links stay unregistered -> 404",
        detail: `stream=${s2Stream.status} ws=${s2Ws.status} links=${s2Links.status}`,
      },
    ];
    record(
      "S2-4F",
      "requests/graph over the deterministic S2 fixture (shape, edges, determinism, replay 200, 400/404/405)",
      s2f.every((c) => c.ok),
      s2f.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s "http://127.0.0.1:8601/api/v1/sessions/${S2_SESSION}/graph?traceId=${S2_TRACE_ID}"`,
    );

    /* ---------------- S3-4 requests/graph/replay over the S3 fixtures ---------------- */
    await checkS3CollectorReplay(validate);
  } finally {
    await stopServer(collector);
    const freed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    console.log(`        collector stopped; 8601 ${freed ? "free" : "STILL LISTENING"}`);
  }
}

/* ------------------------------------------------------------------ */
/* S3-4 collector requests/graph/replay over the S3 fixtures           */
/* ------------------------------------------------------------------ */

const GRAPH_NODE_KEYS = [
  "spanId", "parentSpanId", "kind", "nodeKey", "status", "return", "sideEffects",
  "startNs", "durNs", "thread", "flags", "reason", "source", "confidence",
  // S5 additive 15th field (api.v1.md §10.9): raw values[] or null (never []).
  "values",
].sort();

/** A graph node's values must equal the event's raw values array, or null when absent (never []). */
function graphValuesProblems(node, event, label) {
  const problems = [];
  if (!Object.prototype.hasOwnProperty.call(node ?? {}, "values")) {
    problems.push(`${label} values key missing`);
    return problems;
  }
  const expected = event && Object.prototype.hasOwnProperty.call(event, "values") ? event.values : null;
  if (!deepEqual(node.values, expected ?? null)) {
    problems.push(`${label} values=${show(node.values)}`);
  }
  return problems;
}

/**
 * S3-4 (uses the already running S1 collector): ingest the frozen case A/B events into two
 * fresh, session-renamed sessions (deterministic seq 1..n), then deep-compare requests,
 * graph, and every expected replay window; exercise 400/404/405, meta, reserved routes.
 */
async function checkS3CollectorReplay(validate) {
  section("S3-4 collector requests/graph/replay over fixtures/s3-frontend-facts");
  const checks = [];
  const caseA = loadS3Case(S3_CASE_A_EVENTS, S3_CASE_A_FACTS, 7);
  const caseB = loadS3Case(S3_CASE_B_EVENTS, S3_CASE_B_FACTS, 3);
  const aEvents = caseA.events.map((event) => ({ ...event, sessionId: S3_VERIFY_A_SESSION }));
  const bEvents = caseB.events.map((event) => ({ ...event, sessionId: S3_VERIFY_B_SESSION }));

  const postA = await postNdjson("/ingest/v1/events", `${aEvents.map((event) => JSON.stringify(event)).join("\n")}\n`, `${NDJSON}; charset=utf-8`);
  const postB = await postNdjson("/ingest/v1/events", `${bEvents.map((event) => JSON.stringify(event)).join("\n")}\n`, `${NDJSON}; charset=utf-8`);
  const postAParsed = postA.ok ? parseJson(postA.text) : { ok: false };
  const postBParsed = postB.ok ? parseJson(postB.text) : { ok: false };
  const postABody = postAParsed.ok ? postAParsed.value ?? {} : {};
  const postBBody = postBParsed.ok ? postBParsed.value ?? {} : {};
  checks.push({
    ok: postA.ok && postA.status === 202 && postABody.accepted === 7 && postABody.rejected === 0 &&
      postB.ok && postB.status === 202 && postBBody.accepted === 3 && postBBody.rejected === 0,
    label: "ingest case A (7) + case B (3) into fresh sessions s_s3verify_a/s_s3verify_b -> 202",
    detail: `A=${show(postA.text)} B=${show(postB.text)}`,
  });

  /* ---------------- requests A/B (exact fields) ---------------- */
  const reqARes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_A_SESSION}/requests`);
  const reqAParsed = reqARes.ok ? parseJson(reqARes.text) : { ok: false };
  const reqABody = reqAParsed.ok ? reqAParsed.value ?? {} : {};
  const reqARows = Array.isArray(reqABody.requests) ? reqABody.requests : [];
  const expectedReqA = caseA.facts?.apiExpectations?.requests ?? {};

  const reqBRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_B_SESSION}/requests`);
  const reqBParsed = reqBRes.ok ? parseJson(reqBRes.text) : { ok: false };
  const reqBBody = reqBParsed.ok ? reqBParsed.value ?? {} : {};
  const reqBRows = Array.isArray(reqBBody.requests) ? reqBBody.requests : [];
  const expectedReqB = caseB.facts?.apiExpectations?.requests ?? {};

  checks.push({
    ok: reqARes.ok && reqARes.status === 200 && reqABody.sessionId === S3_VERIFY_A_SESSION &&
      reqABody.sdkActive === expectedReqA.sdkActive && reqARows.length === 1 &&
      deepEqual(reqARows[0], expectedReqA.row),
    label: "requests A: one row deep-equals expected (EXACT/fetchCount 1/backendSpanCount 4/spanCount 7)",
    detail: show(reqARows[0]),
  });
  checks.push({
    ok: reqBRes.ok && reqBRes.status === 200 && reqBBody.sessionId === S3_VERIFY_B_SESSION &&
      reqBBody.sdkActive === true && reqBRows.length === 1 &&
      deepEqual(reqBRows[0], expectedReqB.row),
    label: "requests B: one row deep-equals expected (RETURNED_FALSE/fetchCount 0/hasBackend false/EXACT)",
    detail: show(reqBRows[0]),
  });
  S3_EVIDENCE.caseA = { requestsRow: reqARows[0] ?? null, graph: null, windows: [] };
  S3_EVIDENCE.caseB = { requestsRow: reqBRows[0] ?? null, sdkActive: reqBBody.sdkActive === true, windows: [] };

  /* ---------------- graph A/B (nodes/edges exact) ---------------- */
  async function graphOf(sessionId, traceId) {
    const res = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${sessionId}/graph?traceId=${traceId}`);
    const parsed = res.ok ? parseJson(res.text) : { ok: false };
    const body = parsed.ok && parsed.value ? parsed.value : {};
    return { res, parsed, body, nodes: Array.isArray(body.nodes) ? body.nodes : [], edges: Array.isArray(body.edges) ? body.edges : [] };
  }

  const graphExpectedA = caseA.facts?.apiExpectations?.graph ?? {};
  const graphA = await graphOf(S3_VERIFY_A_SESSION, graphExpectedA.traceId);
  const graphNodeProblemsA = [];
  if (graphA.nodes.length === caseA.events.length) {
    const ordered = sortedByStart(caseA.events);
    ordered.forEach((event, index) => {
      const node = graphA.nodes[index];
      const keys = Object.keys(node ?? {}).sort();
      if (!deepEqual(keys, GRAPH_NODE_KEYS)) graphNodeProblemsA.push(`node${index} keys=${keys.join(",")}`);
      if (node.spanId !== event.spanId || node.parentSpanId !== event.parentSpanId ||
          node.kind !== event.kind || node.nodeKey !== event.nodeKey ||
          node.status !== event.status || node.startNs !== event.startNs || node.durNs !== event.durNs) {
        graphNodeProblemsA.push(`node${index} scalars`);
      }
      if (!deepEqual(node.return, event.return ?? null)) graphNodeProblemsA.push(`node${index} return=${show(node.return)}`);
      if (!deepEqual(node.sideEffects, event.sideEffects ?? [])) graphNodeProblemsA.push(`node${index} sideEffects=${show(node.sideEffects)}`);
      if (!deepEqual(node.thread, event.thread)) graphNodeProblemsA.push(`node${index} thread`);
      if (!deepEqual(node.flags, event.flags)) graphNodeProblemsA.push(`node${index} flags=${show(node.flags)}`);
      if (!deepEqual(node.reason, event.reason ?? null)) graphNodeProblemsA.push(`node${index} reason=${show(node.reason)}`);
      if (!deepEqual(node.source, event.source ?? null)) graphNodeProblemsA.push(`node${index} source=${show(node.source)}`);
      if (!deepEqual(node.confidence, event.confidence)) graphNodeProblemsA.push(`node${index} confidence=${show(node.confidence)}`);
      graphNodeProblemsA.push(...graphValuesProblems(node, event, `node${index}`));
    });
  }
  const graphEdgesExpectedA = graphExpectedA.edges ?? [];
  checks.push({
    ok: graphA.res.ok && graphA.res.status === 200 && graphA.body.sessionId === S3_VERIFY_A_SESSION &&
      graphA.body.traceId === graphExpectedA.traceId && graphA.body.rootEventId === graphExpectedA.rootEventId &&
      graphA.body.confidence === graphExpectedA.confidence &&
      graphA.nodes.length === 7 && graphA.nodes.map((node) => node.spanId).join(",") === graphExpectedA.nodeOrder.join(",") &&
      graphA.nodes.map((node) => node.kind).join(",") === graphExpectedA.kindOrder.join(",") &&
      graphA.edges.length === 6 && deepEqual(graphA.edges, graphEdgesExpectedA) &&
      graphA.edges.every((edge) => edge.count === 1) && graphNodeProblemsA.length === 0,
    label: "graph A: 7 nodes / 6 edges match expected order+edges; 15 node fields verbatim (S4 reason/source/confidence + S5 values:null); click->fetch->controller->service->mapper->sql",
    detail: graphNodeProblemsA.length ? graphNodeProblemsA.slice(0, 5).join(" || ") : `${graphA.nodes.length} nodes, ${graphA.edges.length} edges`,
  });
  S3_EVIDENCE.caseA.graph = { nodes: graphA.nodes.length, edges: graphA.edges.length, confidence: graphA.body.confidence };

  const graphExpectedB = caseB.facts?.apiExpectations?.graph ?? {};
  const graphB = await graphOf(S3_VERIFY_B_SESSION, graphExpectedB.traceId);
  const graphNodeProblemsB = graphB.nodes.flatMap((node, index) => {
    const keys = Object.keys(node ?? {}).sort();
    const problems = deepEqual(keys, GRAPH_NODE_KEYS) ? [] : [`node${index} keys=${keys.join(",")}`];
    const event = caseB.events.find((item) => item.spanId === node.spanId) ?? null;
    return problems.concat(graphValuesProblems(node, event, `node${index}`));
  });
  checks.push({
    ok: graphB.res.ok && graphB.res.status === 200 && graphB.body.sessionId === S3_VERIFY_B_SESSION &&
      graphB.body.traceId === graphExpectedB.traceId && graphB.body.rootEventId === graphExpectedB.rootEventId &&
      graphB.body.confidence === graphExpectedB.confidence &&
      graphB.nodes.length === 3 && graphB.nodes.map((node) => node.spanId).join(",") === graphExpectedB.nodeOrder.join(",") &&
      graphB.nodes.map((node) => node.kind).join(",") === graphExpectedB.kindOrder.join(",") &&
      graphB.edges.length === 2 && deepEqual(graphB.edges, graphExpectedB.edges ?? []) &&
      graphNodeProblemsB.length === 0,
    label: "graph B: 3 nodes / 2 edges (ui_event -> js_method -> render), 15 fields with values:null, no backend node",
    detail: graphNodeProblemsB.length
      ? graphNodeProblemsB.slice(0, 5).join(" || ")
      : `${graphB.nodes.length} nodes, ${graphB.edges.length} edges`,
  });

  /* ---------------- replay windows (deep comparison) ---------------- */
  const pageBefore = await getEventsPage(S3_VERIFY_A_SESSION, "?afterSeq=0&limit=200");

  async function replayWindowChecks(sessionId, events, factsDoc, label) {
    const windows = Array.isArray(factsDoc?.replayWindows) ? factsDoc.replayWindows : [];
    const bySpanId = new Map(events.map((event) => [event.spanId, event]));
    const responses = [];
    for (const win of windows) {
      const query = `?fromNs=${win.fromNs}${win.toNsIsDefault ? "" : `&toNs=${win.toNs}`}`;
      const res = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${sessionId}/replay${query}`);
      const parsed = res.ok ? parseJson(res.text) : { ok: false };
      const body = parsed.ok && parsed.value ? parsed.value : {};
      const entries = Array.isArray(body.events) ? body.events : [];
      const spanIds = entries.map((entry) => entry.event?.spanId);
      const seqs = entries.map((entry) => entry.seq);
      const expected = s3ReplayWindow(events, win.fromNs, win.toNsIsDefault ? null : win.toNs);
      const eventProblems = [];
      for (const entry of entries) {
        const fixture = bySpanId.get(entry.event?.spanId);
        if (!fixture) eventProblems.push(`${entry.event?.spanId}:unknown`);
        else if (entry.event.sessionId !== sessionId) eventProblems.push(`${entry.event.spanId}:session`);
        else if (!deepEqual(entry.event, fixture)) eventProblems.push(`${entry.event.spanId}:body`);
        else if (validate && !validate(entry.event)) eventProblems.push(`${entry.event.spanId}:schema`);
      }
      const sortedOk = entries.every((entry, index) => index === 0 ||
        entry.event.startNs > entries[index - 1].event.startNs ||
        (entry.event.startNs === entries[index - 1].event.startNs &&
          String(entry.event.spanId).localeCompare(String(entries[index - 1].event.spanId)) > 0));
      checks.push({
        ok: res.ok && res.status === 200 &&
          body.mode === "replay" && body.readOnly === true && body.sessionId === sessionId &&
          body.fromNs === win.fromNs &&
          body.toNs === win.toNs && body.toNs === expected.toNs &&
          entries.length === win.count &&
          deepEqual(spanIds, win.spanIds) && deepEqual(seqs, win.seqs) &&
          eventProblems.length === 0 && sortedOk,
        label: `${label} ${win.id}: 200 readOnly, fromNs/toNs echo, ${win.count} events in startNs/spanId order, exact bodies+seqs`,
        detail: `toNs=${body.toNs} spanIds=${spanIds.join(",")} seqs=${seqs.join(",")}${eventProblems.length ? ` problems=${eventProblems.slice(0, 3).join(",")}` : ""}`,
      });
      responses.push({ win, res, body });
    }
    return responses;
  }

  const responsesA = await replayWindowChecks(S3_VERIFY_A_SESSION, aEvents, caseA.facts, "WA");
  const responsesB = await replayWindowChecks(S3_VERIFY_B_SESSION, bEvents, caseB.facts, "WB");
  S3_EVIDENCE.caseA.windows = responsesA.map((item) => ({
    id: item.win.id, fromNs: item.body.fromNs, toNs: item.body.toNs,
    count: Array.isArray(item.body.events) ? item.body.events.length : -1,
  }));
  S3_EVIDENCE.caseB.windows = responsesB.map((item) => ({
    id: item.win.id, fromNs: item.body.fromNs, toNs: item.body.toNs,
    count: Array.isArray(item.body.events) ? item.body.events.length : -1,
  }));

  const defaultA = responsesA.find((item) => item.win.toNsIsDefault);
  const repeatedA = defaultA
    ? await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_A_SESSION}/replay`)
    : null;
  checks.push({
    ok: Boolean(defaultA) && Boolean(repeatedA) && repeatedA.ok && repeatedA.status === 200 &&
      repeatedA.text === defaultA.res.text,
    label: "two identical default replay GETs are byte-identical (WA3)",
    detail: defaultA && repeatedA ? (repeatedA.text === defaultA.res.text ? "identical" : "DIFFERS") : "missing",
  });

  const pageAfter = await getEventsPage(S3_VERIFY_A_SESSION, "?afterSeq=0&limit=200");
  checks.push({
    ok: pageBefore.res.ok && pageBefore.res.status === 200 && pageBefore.value.nextSeq === 7 &&
      pageAfter.res.status === 200 && pageAfter.text === pageBefore.text && pageAfter.value.nextSeq === 7,
    label: "replay reads consume no seq and leave A's events unchanged (7 events, nextSeq=7 before/after)",
    detail: `before=${pageBefore.value.nextSeq} after=${pageAfter.value.nextSeq} identical=${pageAfter.text === pageBefore.text}`,
  });

  const windowsA = Array.isArray(caseA.facts?.replayWindows) ? caseA.facts.replayWindows.length : 0;
  const windowsB = Array.isArray(caseB.facts?.replayWindows) ? caseB.facts.replayWindows.length : 0;
  checks.push({
    ok: windowsA === 5 && windowsB === 4 && responsesA.length === 5 && responsesB.length === 4,
    label: "expected replayWindows fully evaluated (A=5, B=4)",
    detail: `A=${responsesA.length}/${windowsA} B=${responsesB.length}/${windowsB}`,
  });

  /* ---------------- replay negatives + meta + reserved ---------------- */
  const badParamCases = [
    ["fromNs=abc", "fromNs non-integer"],
    ["fromNs=-1", "fromNs negative"],
    ["toNs=999999999999999999999999", "toNs 64-bit overflow"],
    ["fromNs=5&toNs=2", "fromNs > toNs"],
    ["fromNs=", "fromNs blank"],
  ];
  for (const [query, label] of badParamCases) {
    const res = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_A_SESSION}/replay?${query}`);
    checks.push(...envelopeChecks(res, 400, "bad_request", `replay ${label}`, []));
  }
  const badBeforeUnknown = await requestBase(COLLECTOR_BASE, "/api/v1/sessions/s_s3_missing/replay?fromNs=abc");
  checks.push(...envelopeChecks(badBeforeUnknown, 400, "bad_request", "replay bad param on unknown session (400 before 404)", []));
  const unknownReplay = await requestBase(COLLECTOR_BASE, "/api/v1/sessions/s_s3_missing/replay");
  checks.push(...envelopeChecks(unknownReplay, 404, "not_found", "replay unknown session", []));
  const postReplay = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_A_SESSION}/replay`, { method: "POST" });
  const putReplay = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_A_SESSION}/replay`, { method: "PUT" });
  checks.push({
    ok: postReplay.status === 405 && putReplay.status === 405,
    label: "POST/PUT replay -> 405 (GET-only)",
    detail: `POST=${postReplay.status} PUT=${putReplay.status}`,
  });

  const metaRes = await requestBase(COLLECTOR_BASE, "/api/v1/meta");
  const metaParsed = metaRes.ok ? parseJson(metaRes.text) : { ok: false };
  const caps = metaParsed.ok ? metaParsed.value?.capabilities ?? {} : {};
  checks.push({
    ok: metaRes.ok && metaRes.status === 200 && Object.keys(caps).length === 5 &&
      caps.health === true && caps.meta === true && caps.ingestEvents === true &&
      caps.realtime === false && caps.replay === true,
    label: "meta capabilities: 5 keys exactly, replay=true, realtime=false",
    detail: show(caps),
  });

  const stream = await requestBase(COLLECTOR_BASE, "/api/v1/stream");
  const ws = await requestBase(COLLECTOR_BASE, "/ws/v1/events");
  const links = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_VERIFY_A_SESSION}/links`, { method: "POST" });
  checks.push({
    ok: stream.status === 404 && ws.status === 404 && links.status === 404,
    label: "stream/ws/links stay unregistered -> 404",
    detail: `stream=${stream.status} ws=${ws.status} links=${links.status}`,
  });

  record(
    "S3-4",
    "collector replay/requests over the S3 fixtures: requests/graph deep-compare, replay windows/400/404/405/meta",
    checks.every((c) => c.ok),
    checks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3verify_a/replay" ; curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3verify_a/requests"`,
  );
}

/* ------------------------------------------------------------------ */
/* S2-2/3/4/5 demo defect + 4-span E2E + requests/graph + fail-open     */
/* ------------------------------------------------------------------ */

function groupByTrace(spans) {
  const map = new Map();
  for (const span of spans) {
    if (!map.has(span.traceId)) map.set(span.traceId, []);
    map.get(span.traceId).push(span);
  }
  return [...map.entries()].map(([traceId, group]) => ({ traceId, spans: group }));
}

/** Problems of the runtime graph view (4 nodes / 3 edges, same facts as the spans). */
function graphProblems(graph, traceId) {
  const problems = [];
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (nodes.length !== 4) {
    problems.push(`nodes=${nodes.length}`);
    return problems;
  }
  if (nodes.map((node) => node.kind).join(",") !== "controller,service,mapper,sql") {
    problems.push(`kindOrder=${nodes.map((node) => node.kind).join(",")}`);
  }
  nodes.forEach((node, index) => {
    const keys = Object.keys(node ?? {}).sort();
    if (!deepEqual(keys, GRAPH_NODE_KEYS)) problems.push(`node${index} fields=${keys.join(",")}`);
    // S5: the S2 runtime events carry no values -> graph must echo null (never []).
    if (node.values !== null) problems.push(`node${index} values=${show(node.values)}`);
    if (node.reason !== null && typeof node.reason !== "string") problems.push(`node${index} reason=${show(node.reason)}`);
    if (node.source !== null && (typeof node.source !== "object" || Array.isArray(node.source))) {
      problems.push(`node${index} source=${show(node.source)}`);
    }
    if (typeof node.confidence !== "string" || node.confidence.length === 0) {
      problems.push(`node${index} confidence=${show(node.confidence)}`);
    }
  });
  S2_CHAIN_SLOTS.forEach((slot, index) => {
    if (nodes[index].kind !== slot.kind) problems.push(`node${index} kind`);
    if (nodes[index].nodeKey !== slot.nodeKey) problems.push(`node${index} nodeKey`);
  });
  if (nodes[0].parentSpanId !== null) problems.push("root parentSpanId!=null");
  for (let i = 1; i < nodes.length; i += 1) {
    if (nodes[i].parentSpanId !== nodes[i - 1].spanId) problems.push(`node${i} parent mismatch`);
    if (!(nodes[i].startNs >= nodes[i - 1].startNs)) problems.push("nodes not sorted by startNs");
    if (nodes[i].startNs < nodes[i - 1].startNs ||
        nodes[i].startNs + nodes[i].durNs > nodes[i - 1].startNs + nodes[i - 1].durNs) {
      problems.push(`node${i} not nested`);
    }
    if (!(nodes[i].durNs > 0)) problems.push(`node${i} durNs=${nodes[i].durNs}`);
  }
  const expectedEdges = nodes.slice(1).map((node, index) => ({
    from: nodes[index].spanId,
    to: node.spanId,
    count: 1,
  }));
  if (!deepEqual(edges, expectedEdges)) problems.push(`edges=${show(edges)}`);
  const checkNodeReturn = (node, type, value, label) => {
    if (!node.return || node.return.type !== type || !deepEqual(node.return.value, value)) {
      problems.push(`${label} return=${show(node.return)}`);
    }
  };
  checkNodeReturn(nodes[0], S2_RESPONSE_ENTITY_TYPE, 200, "controller");
  checkNodeReturn(nodes[1], "boolean", true, "service");
  checkNodeReturn(nodes[2], "int", 0, "mapper");
  if (nodes[3].return !== null) problems.push(`sql return=${show(nodes[3].return)}`);
  const effects = Array.isArray(nodes[3].sideEffects) ? nodes[3].sideEffects : [];
  if (effects.length !== 1 || effects[0].type !== "sql" ||
      effects[0].sqlId !== S2_SQL_NODE_KEY || effects[0].rowsAffected !== 0 ||
      effects[0].transaction !== "UNKNOWN") {
    problems.push(`sql sideEffects=${show(effects)}`);
  }
  const rootFlags = Array.isArray(nodes[0].flags) ? nodes[0].flags : [];
  const childFlags = nodes.slice(1).flatMap((node) => (Array.isArray(node.flags) ? node.flags : []));
  if (!rootFlags.includes(S2_FLAG_CHAIN) || !rootFlags.includes(S2_FLAG_LOST_BACKEND)) {
    problems.push(`root flags=${show(rootFlags)}`);
  }
  if (!childFlags.includes(S2_FLAG_CHAIN) || childFlags.includes(S2_FLAG_LOST_BACKEND)) {
    problems.push(`child flags=${show(childFlags)}`);
  }
  if (graph.traceId !== traceId) problems.push(`traceId=${graph.traceId}`);
  if (graph.confidence !== "LOST") problems.push(`confidence=${graph.confidence}`);
  if (graph.rootEventId !== `click_lost_${nodes[0].spanId}`) problems.push(`rootEventId=${graph.rootEventId}`);
  return problems;
}

async function checkS2E2E(validate) {
  section("S2-2/3/4/5 demo 0-row defect + agent 4-span E2E + requests/graph + fail-open");
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const demoJar = abs(DEMO_JAR_REL);
  const agentJar = abs(AGENT_JAR_REL);
  const pre8601 = listeningOn(8601);
  const pre8080 = listeningOn(8080);
  const preconditions = [
    { ok: pre8601.supported && pre8601.lines.length === 0, label: "port 8601 free", detail: pre8601.lines.join(" | ") || "no listener" },
    { ok: pre8080.supported && pre8080.lines.length === 0, label: "port 8080 free", detail: pre8080.lines.join(" | ") || "no listener" },
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(demoJar), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(agentJar), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists (absolute path)", detail: JDK8_JAVA },
  ];
  const preconditionEvidence = preconditions.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`);
  const reproE2E = `"${JDK8_JAVA}" -javaagent:"${AGENT_JAR_REL}" -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events -Dtraceboard.sessionId=${S2_SESSION} -jar "${DEMO_JAR_REL}"`;
  if (!preconditions.every((c) => c.ok)) {
    for (const id of ["S2-2", "S2-3", "S2-4", "S2-5"]) {
      record(id, "S2 runtime gate (preconditions)", false, preconditionEvidence, reproE2E);
    }
    return;
  }

  let collector = null;
  let demo = null;
  try {
    collector = startJavaServer("collector(8601)", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!health) {
      for (const id of ["S2-2", "S2-3", "S2-4", "S2-5"]) {
        record(id, "S2 runtime gate (collector health)", false,
          [{ ok: false, label: "collector health", detail: "timeout" }], reproE2E);
      }
      return;
    }

    const startupSession = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    demo = startJavaServer("demo-backend(8080)+agent", JDK8_JAVA, [
      `-javaagent:${agentJar}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      `-Dtraceboard.sessionId=${S2_SESSION}`,
      "-jar",
      demoJar,
    ], abs("demo/buggy-shop-boot-vue/backend"));

    const ordersBefore = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    const ordersBeforeBody = ordersBefore ? parseJson(ordersBefore.text) : { ok: false };
    const seedRows = ordersBeforeBody.ok && Array.isArray(ordersBeforeBody.value?.data)
      ? ordersBeforeBody.value.data
      : [];
    const seed = seedRows[0] ?? {};

    /* ---------------- cancel #1 -> exactly 4 spans within 15s ---------------- */
    const cancel1 = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const cancel1Body = cancel1.ok ? parseJson(cancel1.text) : { ok: false };
    const pollA = await pollUntil(async () => {
      const page = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && page.res.status === 200 && spans.length >= 4 ? { page, spans } : null;
    }, 15000, 400);
    await sleep(600);
    const pageA = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const spansA = Array.isArray(pageA.value.events) ? pageA.value.events.map((entry) => entry.event) : [];
    const traceAId = spansA[0]?.traceId;
    const chainAProblems = chainProblems(spansA, { sessionId: S2_SESSION });
    const schemaProblemsA = validate ? spansA.filter((span) => !validate(span)).map((span) => span.spanId) : [];
    const sortA = sortedByStart(spansA);
    const rootA = sortA[0] ?? {};
    const sqlA = sortA.find((span) => span.kind === "sql") ?? {};

    /* ---------------- log evidence (classes load lazily) ---------------- */
    const premainLine = demo.log.text.split(/\r?\n/).find((line) => line.includes("premain installed")) ?? "";
    const transformTargets = [
      "com.example.shop.controller.OrderController",
      "com.example.shop.service.OrderService",
      "org.apache.ibatis.binding.MapperProxy",
      "org.apache.ibatis.executor.statement.PreparedStatementHandler",
    ];
    const missingTransforms = transformTargets.filter(
      (target) => !demo.log.text.includes(`transformed ${target}`),
    );
    const demoJarEntries = zipEntries(abs(DEMO_JAR_REL));
    const h2Lib = demoJarEntries.entries.find((entry) => /^BOOT-INF\/lib\/h2-[\d.]+\.jar$/.test(entry)) ?? "";
    const mysqlLibs = demoJarEntries.entries.filter((entry) => /^BOOT-INF\/lib\/.*(?:mysql|mariadb).*\.jar$/i.test(entry));
    const h2Line = h2Lib ? `${h2Lib} bundled (runtime), mysql jars=${mysqlLibs.length}` : "";
    const h2Embedded = h2Lib.length > 0 && mysqlLibs.length === 0;

    /* ---------------- cancel #2 -> second independent 4-span trace ---------------- */
    const cancel2 = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const cancel2Body = cancel2.ok ? parseJson(cancel2.text) : { ok: false };
    const pollB = await pollUntil(async () => {
      const page = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && page.res.status === 200 && spans.length >= 8 ? { page, spans } : null;
    }, 15000, 400);
    await sleep(600);
    const pageB = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const spansB = Array.isArray(pageB.value.events) ? pageB.value.events.map((entry) => entry.event) : [];
    const groups = groupByTrace(spansB);
    const groupA = groups.find((group) => group.traceId === traceAId) ?? null;
    const groupB = groups.find((group) => group.traceId !== traceAId) ?? null;
    const chainBProblems = groupB ? chainProblems(groupB.spans, { sessionId: S2_SESSION }) : ["missing second trace"];
    const schemaProblemsB = validate ? spansB.filter((span) => !validate(span)).map((span) => span.spanId) : [];

    const s2Checks = [
      {
        ok: Boolean(ordersBefore) && ordersBeforeBody.ok && seedRows.length === 1 &&
          seed.id === 1 && seed.orderNo === "SO-0001" && seed.status === "CREATED" &&
          typeof seed.amount === "number" && seed.amount === 100,
        label: "demo + agent started; GET /api/orders seed id=1 SO-0001 CREATED amount 100 from H2",
        detail: ordersBefore ? show(ordersBefore.text) : "timeout",
      },
      {
        ok: startupSession.res.ok && startupSession.res.status === 404,
        label: `session ${S2_SESSION} unknown before any cancel (404)`,
        detail: `status=${startupSession.res.status}`,
      },
      {
        ok: premainLine.includes(`sessionId=${S2_SESSION}`) &&
          transformTargets.every((target) => premainLine.includes(target)),
        label: "agent premain installed with the 4 documented targets and sessionId=s_s2agent",
        detail: premainLine.slice(0, 400),
      },
      {
        ok: missingTransforms.length === 0,
        label: "Byte Buddy transformed all 4 points (controller/service/MapperProxy/PreparedStatementHandler)",
        detail: missingTransforms.length ? `missing: ${missingTransforms.join(",")}` : "4/4 transformed",
      },
      {
        ok: h2Embedded,
        label: "demo jar bundles embedded H2 (BOOT-INF/lib/h2-*.jar) and no MySQL driver",
        detail: h2Line || "missing h2 lib in the demo fat jar",
      },
      {
        ok: cancel1.ok && cancel1.status === 200 && deepEqual(cancel1Body.value, { data: true }),
        label: "cancel #1 -> 200 {data:true}",
        detail: cancel1.ok ? show(cancel1.text) : String(cancel1.error),
      },
      {
        ok: Boolean(pollA),
        label: "read back >=4 spans within 15s",
        detail: pollA ? `events=${pollA.spans.length}` : "timeout",
      },
      {
        ok: spansA.length === 4 && pageA.value.nextSeq === 4,
        label: "exactly 4 spans for request #1 (no synthetic/startup spans), nextSeq=4",
        detail: `spans=${spansA.length} nextSeq=${pageA.value.nextSeq}`,
      },
      {
        ok: schemaProblemsA.length === 0,
        label: "all 4 runtime spans validate against the frozen schema",
        detail: schemaProblemsA.length ? schemaProblemsA.join(",") : "4/4 valid",
      },
      {
        ok: chainAProblems.length === 0,
        label: "chain #1: controller(LOST root,200) -> service(true) -> mapper(0) -> sql(rows 0/UNKNOWN), OK, nested, S2_ZERO_ROW_CHAIN",
        detail: chainAProblems.slice(0, 6).join(" || ") || `trace=${traceAId} root=${rootA.spanId} durNs=${rootA.durNs}`,
      },
      {
        ok: cancel2.ok && cancel2.status === 200 && deepEqual(cancel2Body.value, { data: true }),
        label: "cancel #2 -> 200 {data:true}",
        detail: cancel2.ok ? show(cancel2.text) : String(cancel2.error),
      },
      {
        ok: Boolean(pollB) && spansB.length === 8 && pageB.value.nextSeq === 8,
        label: "read back exactly 8 spans (2 x 4) within 15s, nextSeq=8",
        detail: pollB ? `events=${spansB.length} nextSeq=${pageB.value.nextSeq}` : "timeout",
      },
      {
        ok: groups.length === 2 && Boolean(groupA) && Boolean(groupB) &&
          groupA.spans.length === 4 && groupB.spans.length === 4 &&
          groupA.traceId !== groupB.traceId && rootA.spanId !== sortedByStart(groupB?.spans ?? [])[0]?.spanId,
        label: "two independent 4-span traces with distinct traceIds/root spans",
        detail: groups.map((group) => `${group.traceId.slice(0, 8)}(${group.spans.length})`).join(","),
      },
      {
        ok: chainBProblems.length === 0 && schemaProblemsB.length === 0,
        label: "chain #2 has the same 4-span shape and schema-valid events",
        detail: chainBProblems.slice(0, 6).join(" || ") || "conformant",
      },
    ];

    record(
      "S2-3",
      "agent E2E: each cancel -> exactly 4 spans (controller->service->mapper->sql), LOST/OK/0 rows, second call independent",
      s2Checks.every((c) => c.ok),
      s2Checks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      reproE2E,
    );

    /* ---------------- S2-4 runtime requests + graph + errors + S1 regression ---------------- */
    const requestsRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/requests`);
    const requestsParsed = requestsRes.ok ? parseJson(requestsRes.text) : { ok: false };
    const requestsBody = requestsParsed.ok ? requestsParsed.value ?? {} : {};
    const requests = Array.isArray(requestsBody.requests) ? requestsBody.requests : [];
    const requestA = requests.find((item) => item.traceId === traceAId) ?? {};
    const requestB = requests.find((item) => item.traceId !== traceAId) ?? {};
    const rootB = groupB ? sortedByStart(groupB.spans)[0] ?? {} : {};

    const graphUrlA = `/api/v1/sessions/${S2_SESSION}/graph?traceId=${traceAId}`;
    const graphPageBefore = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const graphRes1 = await requestBase(COLLECTOR_BASE, graphUrlA);
    const graphParsed1 = graphRes1.ok ? parseJson(graphRes1.text) : { ok: false };
    const graph1 = graphParsed1.ok ? graphParsed1.value ?? {} : {};
    const graphRes2 = await requestBase(COLLECTOR_BASE, graphUrlA);
    const graphPageAfter = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const graphIssues = graphProblems(graph1, traceAId);

    const badGraphNoParam = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph`);
    const unknownTrace = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/graph?traceId=${"0".repeat(32)}`);
    const unknownSessionReq = await requestBase(COLLECTOR_BASE, "/api/v1/sessions/s_s2_missing/requests");
    const unknownSessionGraph = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/s_s2_missing/graph?traceId=${traceAId}`);
    const postRequests = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/requests`, { method: "POST" });
    const postGraph = await requestBase(COLLECTOR_BASE, graphUrlA, { method: "POST" });
    const replay = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/replay`);
    const replayParsed = replay.ok ? parseJson(replay.text) : { ok: false };
    const replayBody = replayParsed.ok ? replayParsed.value ?? {} : {};
    const replayEvents = Array.isArray(replayBody.events) ? replayBody.events : [];
    const expectedReplayToNs = Math.max(...spansB.map((span) => span.startNs + span.durNs), 0);
    const stream = await requestBase(COLLECTOR_BASE, "/api/v1/stream");
    const ws = await requestBase(COLLECTOR_BASE, "/ws/v1/events");
    const links = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S2_SESSION}/links`, { method: "POST" });

    const sessionsRes = await requestBase(COLLECTOR_BASE, "/api/v1/sessions");
    const sessionsParsed = sessionsRes.ok ? parseJson(sessionsRes.text) : { ok: false };
    const agentSession = findSession(sessionsParsed.ok ? sessionsParsed.value?.sessions : null, S2_SESSION);
    const regressionPage = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const regressionEvents = Array.isArray(regressionPage.value.events) ? regressionPage.value.events : [];
    const regressionProblems = wrapperProblems(validate, regressionEvents, "s_s2agent page");

    const sortedByStartA = requests.map((item) => item.startedAtNs);
    const requestsSorted = sortedByStartA.every((value, index) => index === 0 || value >= sortedByStartA[index - 1]);

    const s2ReadChecks = [
      {
        ok: requestsRes.ok && requestsRes.status === 200 && requestsBody.sessionId === S2_SESSION &&
          requests.length === 2,
        label: "requests: 200, sessionId echo, 2 request groups",
        detail: show(requestsRes.text),
      },
      {
        ok: requestA.spanCount === 4 && requestA.rootSpanId === rootA.spanId &&
          requestA.rootKind === "controller" && requestA.nodeKey === S2_CONTROLLER_NODE_KEY &&
          requestA.status === "OK" && requestA.confidence === "LOST" && requestA.hasError === false &&
          requestA.startedAtNs === rootA.startNs && requestA.durNs === rootA.durNs,
        label: "requests[case A]: spanCount 4, controller root, OK/LOST, no error, startedAtNs/durNs match the root",
        detail: show(requestA),
      },
      {
        ok: requestB.spanCount === 4 && requestB.rootSpanId === rootB.spanId &&
          requestB.startedAtNs === rootB.startNs && requestB.durNs === rootB.durNs,
        label: "requests[case B]: second independent 4-span trace with its own root",
        detail: show(requestB),
      },
      {
        ok: requestsSorted && requests[0]?.traceId === traceAId,
        label: "requests sorted by startedAtNs ascending (older cancel first)",
        detail: requests.map((item) => item.startedAtNs).join(","),
      },
      {
        ok: graphRes1.ok && graphRes1.status === 200 && graphIssues.length === 0,
        label: "graph[case A]: 4 nodes / 3 edges, exact chain, SQL rowsAffected 0 / transaction UNKNOWN",
        detail: graphIssues.slice(0, 6).join(" || ") || `${graph1.nodes?.length} nodes, ${graph1.edges?.length} edges`,
      },
      {
        ok: graphRes2.ok && graphRes2.status === 200 && graphRes2.text === graphRes1.text,
        label: "two identical graph GETs return byte-identical bodies",
        detail: graphRes2.text === graphRes1.text ? "identical" : show(graphRes2.text),
      },
      {
        ok: graphPageBefore.text === graphPageAfter.text && regressionPage.value.nextSeq === 8,
        label: "graph reads leave events/seq unchanged (8 events before and after)",
        detail: `same=${graphPageBefore.text === graphPageAfter.text} nextSeq=${regressionPage.value.nextSeq}`,
      },
      ...envelopeChecks(badGraphNoParam, 400, "bad_request", "graph missing traceId", []),
      ...envelopeChecks(unknownTrace, 404, "not_found", "graph unknown traceId", []),
      ...envelopeChecks(unknownSessionReq, 404, "not_found", "requests unknown session", []),
      ...envelopeChecks(unknownSessionGraph, 404, "not_found", "graph unknown session", []),
      {
        ok: postRequests.status === 405 && postGraph.status === 405,
        label: "POST requests/graph -> 405",
        detail: `requests=${postRequests.status} graph=${postGraph.status}`,
      },
      {
        ok: replay.ok && replay.status === 200 && replayBody.mode === "replay" && replayBody.readOnly === true &&
          replayBody.sessionId === S2_SESSION && replayBody.fromNs === 0 &&
          closeNs(replayBody.toNs, expectedReplayToNs) && replayEvents.length === 8 &&
          deepEqual(
            replayEvents.map((entry) => entry.event.spanId),
            replayEvents.map((entry) => entry.event).sort((a, b) => (a.startNs - b.startNs) || String(a.spanId).localeCompare(String(b.spanId))).map((event) => event.spanId),
          ) &&
          deepEqual(
            [...new Set(replayEvents.map((entry) => entry.event.spanId))].sort(),
            [...new Set(regressionEvents.map((entry) => entry.event.spanId))].sort(),
          ),
        label: "S3 migration: runtime replay 200 {mode:replay, readOnly:true, default window=8 events, startNs order}",
        detail: `toNs=${replayBody.toNs} events=${replayEvents.length} seqs=${replayEvents.map((entry) => entry.seq).join(",")}`,
      },
      {
        ok: stream.status === 404 && ws.status === 404 && links.status === 404,
        label: "stream/ws/links stay unregistered -> 404",
        detail: `stream=${stream.status} ws=${ws.status} links=${links.status}`,
      },
      {
        ok: sessionsRes.ok && sessionsRes.status === 200 && Boolean(agentSession) &&
          agentSession.eventCount === 8,
        label: "S1 regression: sessions lists s_s2agent with eventCount=8",
        detail: show(agentSession),
      },
      {
        ok: regressionPage.res.status === 200 && regressionEvents.length === 8 &&
          regressionEvents.map((entry) => entry.seq).join(",") === "1,2,3,4,5,6,7,8" &&
          regressionProblems.length === 0,
        label: "S1 regression: events wrapper keeps seq 1..8, schema-valid events, nextSeq=8",
        detail: regressionProblems.length ? regressionProblems.slice(0, 3).join(" || ") : show(regressionPage.value.nextSeq),
      },
    ];
    record(
      "S2-4",
      "requests/graph over the runtime 4-span chain + 400/404/405 + S1 sessions/events regression",
      s2ReadChecks.every((c) => c.ok),
      s2ReadChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s "http://127.0.0.1:8601/api/v1/sessions/${S2_SESSION}/requests" ; curl -s "http://127.0.0.1:8601/api/v1/sessions/${S2_SESSION}/graph?traceId=<traceId>"`,
    );

    /* ---------------- S2-2 demo defect (DB after cancel + unknown id) ---------------- */
    const ordersAfter = await tryRequest(8080, "/api/orders", { method: "GET" });
    const ordersAfterBody = ordersAfter.ok ? parseJson(ordersAfter.text) : { ok: false };
    const afterRows = ordersAfterBody.ok && Array.isArray(ordersAfterBody.value?.data)
      ? ordersAfterBody.value.data
      : [];
    const afterSeed = afterRows[0] ?? {};
    const unknownCancel = await tryRequest(8080, "/api/orders/999/cancel", { method: "POST" });
    const unknownBody = unknownCancel.ok ? parseJson(unknownCancel.text) : { ok: false };
    const defectChecks = [
      {
        ok: cancel1.ok && cancel1.status === 200 && deepEqual(cancel1Body.value, { data: true }),
        label: "POST /api/orders/1/cancel -> 200 {data:true}",
        detail: cancel1.ok ? show(cancel1.text) : String(cancel1.error),
      },
      {
        ok: ordersAfter.ok && ordersAfter.status === 200 && afterRows.length === 1 &&
          afterSeed.id === 1 && afterSeed.status === "CREATED" &&
          typeof afterSeed.amount === "number" && afterSeed.amount === 100,
        label: "GET /api/orders after cancel -> row 1 STILL CREATED (real 0-row UPDATE in H2)",
        detail: ordersAfter ? show(ordersAfter.text) : "timeout",
      },
      {
        ok: unknownCancel.ok && unknownCancel.status === 404 && deepEqual(unknownBody.value, { data: false }),
        label: "POST /api/orders/999/cancel -> 404 {data:false} (existence check 0 rows)",
        detail: unknownCancel.ok ? show(unknownCancel.text) : String(unknownCancel.error),
      },
      {
        ok: h2Embedded && ordersBeforeBody.ok,
        label: "0 rows is a runtime H2/MyBatis fact (embedded H2 in the fat jar, no MySQL), not a fixture",
        detail: h2Line || "missing h2 lib in the demo fat jar",
      },
      {
        ok: true,
        label: "coverage limit: existence check countById is deliberately not instrumented (4-span chain stays exact)",
        detail: "documented in test-report as an S2 collection-scope limit, not a synthesized span",
      },
    ];
    record(
      "S2-2",
      "demo H2/MyBatis 0-row defect: 200 true + STILL CREATED + unknown 404",
      defectChecks.every((c) => c.ok),
      defectChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s "http://localhost:8080/api/orders" ; curl -s -X POST "http://localhost:8080/api/orders/1/cancel" ; curl -s "http://localhost:8080/api/orders"`,
    );

    /* ---------------- unknown id with agent (documented coverage limit) ---------------- */
    const unknownPoll = await pollUntil(async () => {
      const page = await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && spans.length > spansB.length ? page : null;
    }, 4000, 300);
    const afterUnknownPage = unknownPoll ?? await getEventsPage(S2_SESSION, "?afterSeq=0&limit=200");
    const afterUnknownSpans = Array.isArray(afterUnknownPage.value.events)
      ? afterUnknownPage.value.events.map((entry) => entry.event)
      : [];
    const extraSpans = afterUnknownSpans.filter((span) => !spansB.some((known) => known.spanId === span.spanId));
    const extraKinds = extraSpans.map((span) => `${span.kind}:${span.status}`).join(",");
    const unknownChainOk = extraSpans.length === 0 ||
      (extraSpans.length === 2 &&
        extraSpans.some((span) => span.kind === "controller" && span.status === "OK" &&
          deepEqual(span.return, { type: S2_RESPONSE_ENTITY_TYPE, value: 404 })) &&
        extraSpans.some((span) => span.kind === "service" && span.status === "RETURNED_FALSE") &&
        !extraSpans.some((span) => span.kind === "mapper" || span.kind === "sql"));
    record(
      "S2-3b",
      "unknown id 999 chain (coverage limit: 0 or 2 spans, never a faked mapper/sql)",
      unknownChainOk,
      [
        `unknown cancel -> ${unknownCancel.status} ${show(unknownCancel.text)}`,
        `extra spans after the unknown id: ${extraSpans.length}${extraSpans.length ? ` (${extraKinds})` : " (not collected / delayed)"}`,
        "case A above is unaffected: its trace still has exactly 4 spans and 0 rows",
      ],
      `curl -s -X POST "http://localhost:8080/api/orders/999/cancel"`,
    );

    /* ---------------- S2-5 fail-open ---------------- */
    await stopServer(collector);
    const collectorFreed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    await sleep(500);

    const startedAt = Date.now();
    const failOpenCancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const failOpenMs = Date.now() - startedAt;
    const failOpenBody = failOpenCancel.ok ? parseJson(failOpenCancel.text) : { ok: false };
    const aliveOrders = await tryRequest(8080, "/api/orders", { method: "GET" });
    const stderrSeen = await pollUntil(async () => {
      return /\[traceboard-agent\]\s+ingest_rejected=\d+\s+status=(io_error|\d+)/.test(demo.log.text) ? true : null;
    }, 10000, 300);
    const rejectedLine = (demo.log.text.match(/\[traceboard-agent\]\s+ingest_rejected=[^\r\n]*/) ?? ["not found"])[0];
    const appException = /APPLICATION FAILED TO START|Exception in thread|premain failed/.test(demo.log.text);
    const failChecks = [
      { ok: Boolean(collectorFreed), label: "collector stopped, 8601 free", detail: collectorFreed ? "no LISTENING socket" : listeningOn(8601).lines.join(" | ") },
      { ok: failOpenCancel.ok && failOpenCancel.status === 200 && deepEqual(failOpenBody.value, { data: true }), label: "POST cancel with collector down -> 200 {data:true}", detail: failOpenCancel.ok ? show(failOpenCancel.text) : String(failOpenCancel.error) },
      { ok: failOpenMs < 3000, label: "fail-open latency < 3000ms", detail: `${failOpenMs}ms` },
      { ok: aliveOrders.ok && aliveOrders.status === 200, label: "demo process alive after collector stop (no restart needed)", detail: `GET /api/orders -> ${aliveOrders.status}` },
      { ok: Boolean(stderrSeen), label: "agent stderr counts the rejected send (ingest_rejected, not silent)", detail: rejectedLine },
      { ok: !appException, label: "no application exception / no premain failure in the demo log", detail: appException ? "exception marker found" : "clean log" },
    ];
    record(
      "S2-5",
      "fail-open: collector stopped, cancel still 200 fast, demo alive, stderr ingest_rejected",
      failChecks.every((c) => c.ok),
      failChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `stop collector, then: curl -s -X POST "http://localhost:8080/api/orders/1/cancel"`,
    );
  } finally {
    await stopServer(demo);
    await stopServer(collector);
    const freed8080 = await pollUntil(() => listeningOn(8080).lines.length === 0, 30000, 400);
    const freed8601 = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    console.log(`        demo/collector stopped; 8080 ${freed8080 ? "free" : "STILL LISTENING"}, 8601 ${freed8601 ? "free" : "STILL LISTENING"}`);
  }
}

/* ------------------------------------------------------------------ */
/* S2-7 S2 fixture + expected facts                                    */
/* ------------------------------------------------------------------ */

function checkS2Fixture(validate) {
  section("S2-7 S2 fixture + expected facts");
  const checks = [];
  const meta = readTextFileMeta(S2_EVENTS_REL);
  checks.push({ ok: meta.lines.length === 4, label: "events.ndjson: exactly 4 non-empty lines", detail: `lines=${meta.lines.length}` });
  checks.push({ ok: !meta.hasBom, label: "events.ndjson: UTF-8 without BOM", detail: `hasBom=${meta.hasBom}` });
  checks.push({ ok: meta.crCount === 0, label: "events.ndjson: no CR bytes", detail: `\\r count=${meta.crCount}` });
  checks.push({
    ok: meta.endsWithNewline,
    label: "events.ndjson: trailing LF at EOF",
    detail: `lastByte=0x${meta.buffer.length ? meta.buffer[meta.buffer.length - 1].toString(16) : "??"}`,
  });
  checks.push({ ok: meta.emptyLineCount === 0, label: "events.ndjson: no empty lines", detail: `empty=${meta.emptyLineCount}` });

  let events = [];
  try {
    events = meta.lines.map((line) => JSON.parse(line));
  } catch (error) {
    checks.push({ ok: false, label: "events.ndjson: every line parses", detail: error.message });
  }
  const invalid = [];
  if (validate && events.length === 4) {
    events.forEach((event, index) => {
      if (!validate(event)) {
        invalid.push(`line ${index + 1}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
      }
    });
  }
  checks.push({
    ok: Boolean(validate) && events.length === 4 && invalid.length === 0,
    label: "4/4 events validate against the frozen schema (Ajv 2020-12 strict)",
    detail: invalid.length ? invalid.join(" || ") : "4/4 valid",
  });
  checks.push({
    ok: events.length === 4 && events.every((event) =>
      !Object.prototype.hasOwnProperty.call(event, "seq") &&
      !Object.prototype.hasOwnProperty.call(event, "values") &&
      !Object.prototype.hasOwnProperty.call(event, "reason")),
    label: "no seq/values/reason fields inside the events",
    detail: "absent on 4/4",
  });

  const chainIssues = events.length === 4 ? chainProblems(events, { fixture: true }) : ["events did not parse"];
  checks.push({
    ok: chainIssues.length === 0,
    label: "chain: single LOST root, controller->service->mapper->sql, OK, nested, 0 rows/UNKNOWN, exact flags",
    detail: chainIssues.slice(0, 6).join(" || ") || "conformant",
  });

  /* -------- expected-facts consumer (globalAssertions.chain + 6 facts) -------- */
  let factsDoc = null;
  try {
    factsDoc = JSON.parse(readFileSync(abs(S2_FACTS_REL), "utf8"));
  } catch (error) {
    checks.push({ ok: false, label: "expected-facts.json parses", detail: error.message });
  }
  if (factsDoc && events.length === 4) {
    const sorted = sortedByStart(events);
    const roots = events.filter((event) => event.parentSpanId === null);
    const root = roots[0] ?? {};
    const byId = new Map(events.map((event) => [event.spanId, event]));
    const sqlEvent = events.find((event) => event.kind === "sql") ?? {};
    const sqlEffect = Array.isArray(sqlEvent.sideEffects) ? sqlEvent.sideEffects[0] ?? {} : {};

    checks.push({
      ok: factsDoc.caseId === "s2-zero-row-chain" && factsDoc.stage === "S2" &&
        factsDoc.sources?.chain?.file === S2_EVENTS_REL &&
        factsDoc.sources.chain.lineCount === 4 && factsDoc.sources.chain.eventCount === 4,
      label: "expected-facts: caseId/stage/source file+counts match the fixture",
      detail: `${factsDoc.caseId} / ${factsDoc.stage} / ${factsDoc.sources?.chain?.file}`,
    });

    const globalFails = [];
    const assertions = factsDoc.globalAssertions?.chain ?? {};
    for (const [key, expected] of Object.entries(assertions)) {
      let ok = false;
      let actual = "";
      switch (key) {
        case "sessionId":
          ok = events.every((event) => event.sessionId === expected);
          actual = [...new Set(events.map((event) => event.sessionId))].join(",");
          break;
        case "eventCount":
          ok = events.length === expected;
          actual = String(events.length);
          break;
        case "traceId":
          ok = events.every((event) => event.traceId === expected);
          actual = [...new Set(events.map((event) => event.traceId))].join(",");
          break;
        case "rootSpanId":
          ok = roots.length === 1 && roots[0].spanId === expected;
          actual = roots.map((event) => event.spanId).join(",");
          break;
        case "rootEventId":
          ok = events.every((event) => event.rootEventId === expected);
          actual = [...new Set(events.map((event) => event.rootEventId))].join(",");
          break;
        case "rootEventIdPrefix":
          ok = events.every((event) => String(event.rootEventId).startsWith(expected));
          actual = String(root.rootEventId);
          break;
        case "rootEventIdSuffixIsRootSpanId":
          ok = expected === true && roots.length === 1 && String(root.rootEventId).endsWith(root.spanId);
          actual = `${root.rootEventId} / ${root.spanId}`;
          break;
        case "singleRoot":
          ok = expected === true && roots.length === 1;
          actual = `roots=${roots.length}`;
          break;
        case "rootKind":
          ok = roots.length === 1 && root.kind === expected;
          actual = String(root.kind);
          break;
        case "rootParentSpanId":
          ok = roots.length === 1 && root.parentSpanId === expected;
          actual = String(root.parentSpanId);
          break;
        case "confidenceAllLost":
          ok = expected === true && events.every((event) => event.confidence === "LOST");
          actual = [...new Set(events.map((event) => event.confidence))].join(",");
          break;
        case "statusAllOk":
          ok = expected === true && events.every((event) => event.status === "OK");
          actual = [...new Set(events.map((event) => event.status))].join(",");
          break;
        case "noExceptions":
        case "noThrewStatus":
          ok = expected === true && events.every((event) => event.status !== "THREW");
          actual = `threw=${events.filter((event) => event.status === "THREW").length}`;
          break;
        case "noReason":
          ok = expected === true && events.every((event) => !Object.prototype.hasOwnProperty.call(event, "reason"));
          actual = "reason absent";
          break;
        case "noValues":
          ok = expected === true && events.every((event) => !Object.prototype.hasOwnProperty.call(event, "values"));
          actual = "values absent";
          break;
        case "parentChain":
          ok = Array.isArray(expected) && expected.length === sorted.length &&
            expected.every((spanId, index) => sorted[index].spanId === spanId) &&
            expected.slice(1).every((spanId, index) => sorted[index + 1].parentSpanId === sorted[index].spanId);
          actual = sorted.map((event) => `${event.spanId}<-${event.parentSpanId}`).join(",");
          break;
        case "kindChain":
          ok = Array.isArray(expected) && expected.join(",") === sorted.map((event) => event.kind).join(",");
          actual = sorted.map((event) => event.kind).join(",");
          break;
        case "startNsNonDecreasing":
          ok = expected === true && sorted.every((event, index) => index === 0 || event.startNs >= sorted[index - 1].startNs);
          actual = sorted.map((event) => event.startNs).join(",");
          break;
        case "intervalContainment":
        case "intervalNested":
          ok = expected === true && events.filter((event) => event.parentSpanId !== null).every((event) => {
            const parent = byId.get(event.parentSpanId);
            return parent && event.startNs >= parent.startNs &&
              event.startNs + event.durNs <= parent.startNs + parent.durNs;
          });
          if (key === "intervalNested") {
            ok = ok && sorted.slice(1).every((event, index) =>
              event.startNs >= sorted[index].startNs &&
              event.startNs + event.durNs <= sorted[index].startNs + sorted[index].durNs);
          }
          actual = `${events.filter((event) => event.parentSpanId !== null).length} child spans`;
          break;
        case "durNsPositive":
          ok = expected === true && events.every((event) => event.durNs > 0);
          actual = sorted.map((event) => event.durNs).join(",");
          break;
        case "threadAllEqual":
          ok = events.every((event) => event.thread?.name === expected);
          actual = [...new Set(events.map((event) => event.thread?.name))].join(",");
          break;
        case "flagsRootExact":
          ok = roots.length === 1 && deepEqual(root.flags, expected);
          actual = show(root.flags);
          break;
        case "flagsChildrenExact":
          ok = events.filter((event) => event.parentSpanId !== null).every((event) => deepEqual(event.flags, expected));
          actual = show(events.find((event) => event.parentSpanId !== null)?.flags);
          break;
        case "flagsLostBackendOnlyOnRoot":
          ok = expected === true &&
            Array.isArray(root.flags) && root.flags.includes(S2_FLAG_LOST_BACKEND) &&
            events.filter((event) => event.parentSpanId !== null)
              .every((event) => !Array.isArray(event.flags) || !event.flags.includes(S2_FLAG_LOST_BACKEND));
          actual = show(root.flags);
          break;
        case "sqlRowsAffectedZero":
          ok = expected === true && sqlEffect.rowsAffected === 0;
          actual = String(sqlEffect.rowsAffected);
          break;
        case "sqlTransaction":
          ok = sqlEffect.transaction === expected;
          actual = String(sqlEffect.transaction);
          break;
        default:
          ok = false;
          actual = "unknown assertion key";
      }
      if (!ok) globalFails.push(`chain.${key} expected=${show(expected)} actual=${actual}`);
    }
    checks.push({
      ok: Object.keys(assertions).length === 28 && globalFails.length === 0,
      label: "globalAssertions.chain fully evaluated (28 keys, no unknown keys)",
      detail: globalFails.length ? globalFails.slice(0, 5).join(" || ") : `${Object.keys(assertions).length} keys, 0 failures`,
    });

    const factList = Array.isArray(factsDoc.facts) ? factsDoc.facts : [];
    const factFails = [];
    for (const fact of factList) {
      if (fact.source !== "chain") {
        factFails.push(`${fact.id}: unknown source ${fact.source}`);
        continue;
      }
      const matches = events.filter((event) => event.kind === fact.kind && event.nodeKey === fact.nodeKey);
      if (matches.length !== 1) {
        factFails.push(`${fact.id}: matches=${matches.length}`);
        continue;
      }
      if (matches[0].status !== fact.status) factFails.push(`${fact.id}: status=${matches[0].status} expected=${fact.status}`);
      const lookup = factPathValue(matches[0], events, fact.assert?.path);
      if (!lookup.found || !deepEqual(lookup.value, fact.assert?.value)) {
        factFails.push(`${fact.id}: ${fact.assert?.path}=${lookup.found ? show(lookup.value) : "not found"} expected=${show(fact.assert?.value)}`);
      }
      if (typeof fact.summary !== "string" || fact.summary.trim().length === 0) factFails.push(`${fact.id}: empty summary`);
    }
    checks.push({
      ok: factList.length === 6 && factFails.length === 0,
      label: "6 facts locate a unique event and deep-equal their assertion (incl. #trace.* derived)",
      detail: factFails.length ? factFails.slice(0, 5).join(" || ") : `facts=${factList.length}, 0 failures`,
    });

    /* -------- negative mutations (schema + chain invariants) -------- */
    const seqRejected = validate ? validate({ ...events[0], seq: 1 }) === false : false;
    checks.push({ ok: seqRejected, label: "negative: event carrying seq is rejected by the schema", detail: seqRejected ? "rejected" : "accepted (BAD)" });

    const doubleRoot = events.map((event, index) => index === 1 ? { ...event, parentSpanId: null } : event);
    const doubleRootProblems = chainProblems(doubleRoot, { fixture: true });
    checks.push({ ok: doubleRootProblems.length > 0, label: "negative: a second root is rejected by the chain invariants", detail: doubleRootProblems.slice(0, 2).join(" || ") || "accepted (BAD)" });

    const broken = events.map((event, index) => index === 2 ? { ...event, parentSpanId: "ffffffffffffffff" } : event);
    const brokenProblems = chainProblems(broken, { fixture: true });
    checks.push({ ok: brokenProblems.length > 0, label: "negative: a broken parent chain is rejected", detail: brokenProblems.slice(0, 2).join(" || ") || "accepted (BAD)" });

    const exact = events.map((event, index) => index === 2 ? { ...event, confidence: "EXACT" } : event);
    const exactProblems = chainProblems(exact, { fixture: true });
    checks.push({ ok: exactProblems.length > 0, label: "negative: confidence=EXACT in the LOST chain is rejected", detail: exactProblems.slice(0, 2).join(" || ") || "accepted (BAD)" });
  }

  /* -------- S0/S1 frozen fixtures (S2 plan-review §2 second block) -------- */
  const freeze = s2FreezeSections();
  checks.push({ ok: freeze.s2.length === 9, label: "S2 plan-review records 9 S2 freeze hashes", detail: `found=${freeze.s2.length}` });
  checks.push({ ok: freeze.s0s1.length === 7, label: "S2 plan-review records 7 S0/S1 frozen fixture hashes", detail: `found=${freeze.s0s1.length}` });
  for (const entry of freeze.s0s1) {
    const actual = existsSync(abs(entry.rel)) ? sha256File(abs(entry.rel)) : "missing";
    checks.push({ ok: actual === entry.hash, label: `S0/S1 fixture unchanged (${entry.rel})`, detail: `actual=${actual}` });
  }
  const s1Batch = readTextFileMeta(S1_BATCH_REL);
  const s1BatchValid = Boolean(validate) && s1Batch.lines.length === 2 &&
    s1Batch.lines.every((line) => validate(JSON.parse(line)));
  checks.push({ ok: s1BatchValid, label: "S1 fake batch is still schema-valid (2/2) after the S2 changes", detail: `lines=${s1Batch.lines.length}` });

  gate(
    "S2-7",
    "S2 fixture: 4 schema-valid events, chain facts, expected-facts, negatives, S0/S1 fixtures unchanged",
    checks,
    `sha256sum "${S2_EVENTS_REL}" "${S2_FACTS_REL}" ; node tools/verify/verify.mjs`,
  );
}

/* ------------------------------------------------------------------ */
/* S1-A fixtures + expected facts                                      */
/* ------------------------------------------------------------------ */

function checkS1A(validate) {
  section("S1-A fixtures + expected facts");
  const checks = [];
  const batch = readTextFileMeta(S1_BATCH_REL);
  const agent = readTextFileMeta(S1_AGENT_SPAN_REL);
  let batchEvents = [];
  let agentSpan = null;
  try {
    batchEvents = batch.lines.map((line) => JSON.parse(line));
  } catch (error) {
    checks.push({ ok: false, label: "frontend-fake-batch.ndjson parses", detail: error.message });
  }
  try {
    agentSpan = JSON.parse(agent.lines[0]);
  } catch (error) {
    checks.push({ ok: false, label: "agent-controller-span.json parses", detail: error.message });
  }

  checks.push({ ok: batch.lines.length === 2, label: "fake batch has exactly 2 non-empty lines", detail: `lines=${batch.lines.length}` });
  checks.push({ ok: agent.lines.length === 1, label: "agent span is exactly 1 JSON object line", detail: `lines=${agent.lines.length}` });
  for (const [name, file] of [["fake batch", batch], ["agent span", agent]]) {
    checks.push({ ok: !file.hasBom, label: `${name}: UTF-8 without BOM`, detail: `hasBom=${file.hasBom}` });
    checks.push({ ok: file.crCount === 0, label: `${name}: no CR bytes`, detail: `\\r count=${file.crCount}` });
    checks.push({ ok: file.endsWithNewline, label: `${name}: trailing LF`, detail: `lastByte=0x${file.buffer.length ? file.buffer[file.buffer.length - 1].toString(16) : "??"}` });
    checks.push({ ok: file.emptyLineCount === 0, label: `${name}: no empty lines`, detail: `emptyLines=${file.emptyLineCount}` });
  }

  const invalid = [];
  if (validate) {
    batchEvents.forEach((event, index) => {
      if (!validate(event)) invalid.push(`batch line ${index + 1}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
    });
    if (agentSpan && !validate(agentSpan)) invalid.push(`agent span: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  }
  checks.push({
    ok: validate !== null && batchEvents.length === 2 && Boolean(agentSpan) && invalid.length === 0,
    label: "3/3 fixture events validate against the frozen schema (Ajv 2020-12 strict)",
    detail: invalid.length ? invalid.join(" || ") : "3/3 valid",
  });

  if (batchEvents.length === 2) {
    const [click, fetch] = batchEvents;
    checks.push({
      ok: click.kind === "ui_event" && click.nodeKey === "#btn-s1-fake" && click.parentSpanId === null &&
        click.startNs === 0 && click.durNs === 12000000 && click.status === "OK" && click.return === null,
      label: "fake click: ui_event #btn-s1-fake root [0,12ms], return null",
      detail: `${click.kind} ${click.nodeKey} startNs=${click.startNs} durNs=${click.durNs}`,
    });
    checks.push({
      ok: fetch.kind === "fetch" && fetch.nodeKey === "POST /api/orders/1/cancel" &&
        fetch.parentSpanId === click.spanId && fetch.startNs >= click.startNs &&
        fetch.startNs + fetch.durNs <= click.startNs + click.durNs &&
        deepEqual(fetch.return, { type: "http", value: 200 }),
      label: "fake fetch: child of click, interval nested, return {type:http,value:200}",
      detail: `[${fetch.startNs},${fetch.startNs + fetch.durNs}] inside [${click.startNs},${click.startNs + click.durNs}]`,
    });
    checks.push({
      ok: click.sessionId === S1_WORKBENCH_SESSION && fetch.sessionId === S1_WORKBENCH_SESSION &&
        click.traceId === fetch.traceId && click.rootEventId === fetch.rootEventId &&
        click.confidence === "EXACT" && fetch.confidence === "EXACT" &&
        [click, fetch].every((event) => Array.isArray(event.flags) &&
          event.flags.includes("SKELETON") && event.flags.includes("S1_WALKING_SKELETON")),
      label: "fake batch: same session/trace/root, EXACT + SKELETON flags",
      detail: `${click.traceId} ${click.rootEventId}`,
    });
  }

  if (agentSpan) {
    checks.push({
      ok: agentSpan.kind === "controller" && agentSpan.nodeKey === S1_AGENT_NODE_KEY && agentSpan.nodeKey.endsWith("#cancel"),
      label: "agent span: kind=controller nodeKey ...OrderController#cancel",
      detail: `${agentSpan.kind} ${agentSpan.nodeKey}`,
    });
    checks.push({
      ok: agentSpan.confidence === "LOST" && agentSpan.parentSpanId === null && agentSpan.status === "OK",
      label: "agent span: LOST, isolated root (parentSpanId null), OK",
      detail: `${agentSpan.confidence} parent=${agentSpan.parentSpanId} status=${agentSpan.status}`,
    });
    checks.push({
      ok: Array.isArray(agentSpan.flags) && agentSpan.flags.length === 3 &&
        agentSpan.flags.includes("SKELETON") && agentSpan.flags.includes("S1_ONE_METHOD") &&
        agentSpan.flags.includes("LOST_BACKEND"),
      label: "agent span flags exactly [SKELETON,S1_ONE_METHOD,LOST_BACKEND]",
      detail: show(agentSpan.flags),
    });
    checks.push({
      ok: agentSpan.rootEventId === `click_lost_${agentSpan.spanId}` &&
        /^click_[A-Za-z0-9_-]{8,}$/.test(agentSpan.rootEventId) &&
        agentSpan.rootEventId !== `click_${agentSpan.spanId}`,
      label: "agent span rootEventId is the synthetic click_lost_<spanId> placeholder",
      detail: `${agentSpan.rootEventId} (spanId=${agentSpan.spanId})`,
    });
    checks.push({
      ok: /^[0-9a-f]{32}$/.test(agentSpan.traceId) && /^[0-9a-f]{16}$/.test(agentSpan.spanId) &&
        agentSpan.durNs > 0 && agentSpan.startNs >= 0,
      label: "agent span ids/regEx/durations valid (durNs>0)",
      detail: `traceId=${agentSpan.traceId} spanId=${agentSpan.spanId} durNs=${agentSpan.durNs}`,
    });
    checks.push({
      ok: typeof agentSpan.return?.type === "string" && agentSpan.return.type.length > 0 &&
        !Object.prototype.hasOwnProperty.call(agentSpan, "values") &&
        !Object.prototype.hasOwnProperty.call(agentSpan, "sideEffects") &&
        !Object.prototype.hasOwnProperty.call(agentSpan, "reason"),
      label: "agent span has return.type and no values/sideEffects/reason",
      detail: show(agentSpan.return),
    });
    if (agentSpan.source) {
      checks.push({
        ok: agentSpan.source.file === "OrderController.java",
        label: "agent span source.file is OrderController.java (line not compared)",
        detail: `${agentSpan.source.file}:${agentSpan.source.line}`,
      });
    }
    if (batchEvents.length === 2) {
      const sessions = new Set([...batchEvents.map((e) => e.sessionId), agentSpan.sessionId]);
      const traces = new Set([...batchEvents.map((e) => e.traceId), agentSpan.traceId]);
      checks.push({
        ok: sessions.size === 2 && traces.size === 2,
        label: "fake batch and agent span share neither sessionId nor traceId (no correlation)",
        detail: `sessions=${[...sessions].join(",")} traces=${traces.size}`,
      });
    }
  }

  const seqNegative = validate && batchEvents[0] ? (() => {
    const copy = { ...batchEvents[0], seq: 1 };
    return { ok: validate(copy) === false, label: "negative: event carrying seq is rejected" };
  })() : { ok: false, label: "negative: seq rejection (validator unavailable)" };
  checks.push(seqNegative);

  /* ---- expected-facts.json NEW shape (globalAssertions.<source> + facts) ---- */
  let factsDoc = null;
  try {
    factsDoc = JSON.parse(readFileSync(abs(S1_FACTS_REL), "utf8"));
  } catch (error) {
    checks.push({ ok: false, label: "expected-facts.json parses", detail: error.message });
  }
  if (factsDoc) {
    const sourceData = {
      frontendBatch: { rel: S1_BATCH_REL, lines: batch.lines.length, events: batchEvents },
      agentSpan: { rel: S1_AGENT_SPAN_REL, lines: agent.lines.length, events: agentSpan ? [agentSpan] : [] },
    };
    checks.push({
      ok: factsDoc.caseId === "s1-walking-skeleton" && factsDoc.stage === "S1",
      label: "expected-facts identifies caseId/stage",
      detail: `${factsDoc.caseId} / ${factsDoc.stage}`,
    });

    const declaredSources = Object.entries(factsDoc.sources ?? {});
    checks.push({ ok: declaredSources.length === 2, label: "expected-facts declares 2 sources", detail: declaredSources.map(([k]) => k).join(",") });
    for (const [name, declared] of declaredSources) {
      const data = sourceData[name];
      if (!data) {
        checks.push({ ok: false, label: `source ${name} known to the S1 consumer`, detail: "unknown source" });
        continue;
      }
      checks.push({
        ok: declared.file === data.rel && declared.lineCount === data.lines && declared.eventCount === data.events.length,
        label: `source ${name}: file/lineCount/eventCount match the actual fixture`,
        detail: `file=${declared.file} lines=${data.lines}/${declared.lineCount} events=${data.events.length}/${declared.eventCount}`,
      });
    }

    const globalFails = [];
    for (const [name, assertions] of Object.entries(factsDoc.globalAssertions ?? {})) {
      const data = sourceData[name];
      if (!data) {
        globalFails.push(`${name}: unknown source`);
        continue;
      }
      const events = data.events;
      for (const [key, expected] of Object.entries(assertions)) {
        let ok = false;
        let actual = "";
        if (key === "sessionId") { ok = events.length > 0 && events.every((e) => e.sessionId === expected); actual = [...new Set(events.map((e) => e.sessionId))].join(","); }
        else if (key === "eventCount") { ok = events.length === expected; actual = String(events.length); }
        else if (key === "traceId") { ok = events.length > 0 && events.every((e) => e.traceId === expected); actual = [...new Set(events.map((e) => e.traceId))].join(","); }
        else if (key === "rootEventId") { ok = events.length > 0 && events.every((e) => e.rootEventId === expected); actual = [...new Set(events.map((e) => e.rootEventId))].join(","); }
        else if (key === "confidenceAllExact") { ok = events.length > 0 && events.every((e) => e.confidence === "EXACT"); actual = [...new Set(events.map((e) => e.confidence))].join(","); }
        else if (key === "statusAllOk") { ok = events.length > 0 && events.every((e) => e.status === "OK"); actual = [...new Set(events.map((e) => e.status))].join(","); }
        else if (key === "parentChain") {
          ok = Array.isArray(expected) && expected.length === events.length &&
            expected.every((spanId, index) => events[index].spanId === spanId) &&
            expected.slice(1).every((spanId, index) => events[index + 1].parentSpanId === events[index].spanId);
          actual = events.map((e) => `${e.spanId}<-${e.parentSpanId}`).join(",");
        } else if (key === "rootSpanId") {
          const roots = events.filter((e) => e.parentSpanId === null);
          ok = roots.length === 1 && roots[0].spanId === expected;
          actual = roots.map((e) => e.spanId).join(",");
        } else if (key === "intervalContainment") {
          const byId = new Map(events.map((e) => [e.spanId, e]));
          ok = expected === true && events.filter((e) => e.parentSpanId !== null).every((e) => {
            const parent = byId.get(e.parentSpanId);
            return parent && e.startNs >= parent.startNs && e.startNs + e.durNs <= parent.startNs + parent.durNs;
          });
          actual = `${events.filter((e) => e.parentSpanId !== null).length} child spans`;
        } else if (key === "flagsInclude") {
          ok = Array.isArray(expected) && events.length > 0 &&
            events.every((e) => expected.every((flag) => Array.isArray(e.flags) && e.flags.includes(flag)));
          actual = [...new Set(events.flatMap((e) => e.flags ?? []))].join(",");
        } else if (key === "kind") { ok = events.length === 1 && events[0].kind === expected; actual = events.map((e) => e.kind).join(","); }
        else if (key === "nodeKey") { ok = events.length === 1 && events[0].nodeKey === expected; actual = events.map((e) => e.nodeKey).join(","); }
        else if (key === "confidence") { ok = events.length === 1 && events[0].confidence === expected; actual = events.map((e) => e.confidence).join(","); }
        else if (key === "status") { ok = events.length === 1 && events[0].status === expected; actual = events.map((e) => e.status).join(","); }
        else if (key === "parentSpanId") { ok = events.length === 1 && events[0].parentSpanId === expected; actual = String(events[0]?.parentSpanId); }
        else if (key === "rootEventIdEquals") { ok = events.length === 1 && events[0].rootEventId === expected; actual = String(events[0]?.rootEventId); }
        else if (key === "rootEventIdPrefix") { ok = events.length === 1 && typeof events[0].rootEventId === "string" && events[0].rootEventId.startsWith(expected); actual = String(events[0]?.rootEventId); }
        else if (key === "rootEventIdSuffixIsSpanId") { ok = expected === true && events.length === 1 && events[0].rootEventId.endsWith(events[0].spanId); actual = String(events[0]?.rootEventId); }
        else if (key === "durNsPositive") { ok = expected === true && events.length === 1 && events[0].durNs > 0; actual = String(events[0]?.durNs); }
        else if (key === "noExceptionPayload") { ok = expected === true && !events.some((e) => /exception|stack|error/i.test(Object.keys(e).join(","))); actual = Object.keys(events[0] ?? {}).join(","); }
        else if (key === "noValues") { ok = expected === true && !events.some((e) => Object.prototype.hasOwnProperty.call(e, "values")); actual = "values absent"; }
        else if (key === "noSideEffects") { ok = expected === true && !events.some((e) => Object.prototype.hasOwnProperty.call(e, "sideEffects")); actual = "sideEffects absent"; }
        else { ok = false; actual = "unknown assertion key"; }
        if (!ok) globalFails.push(`${name}.${key} expected=${show(expected)} actual=${actual}`);
      }
    }
    checks.push({
      ok: globalFails.length === 0,
      label: "globalAssertions.<source> fully evaluated (no unknown keys)",
      detail: globalFails.length ? globalFails.slice(0, 4).join(" || ") : "0 failures",
    });

    const factList = Array.isArray(factsDoc.facts) ? factsDoc.facts : [];
    const factFails = [];
    for (const fact of factList) {
      const data = sourceData[fact.source];
      if (!data) { factFails.push(`${fact.id}: unknown source ${fact.source}`); continue; }
      const matches = data.events.filter((event) => event.kind === fact.kind && event.nodeKey === fact.nodeKey);
      if (matches.length !== 1) { factFails.push(`${fact.id}: matches=${matches.length}`); continue; }
      if (matches[0].status !== fact.status) factFails.push(`${fact.id}: status=${matches[0].status} expected=${fact.status}`);
      const lookup = getByPath(matches[0], fact.assert?.path);
      if (!lookup.found || !deepEqual(lookup.value, fact.assert?.value)) {
        factFails.push(`${fact.id}: ${fact.assert?.path}=${lookup.found ? show(lookup.value) : "not found"} expected=${show(fact.assert?.value)}`);
      }
      if (typeof fact.summary !== "string" || fact.summary.trim().length === 0) factFails.push(`${fact.id}: empty summary`);
    }
    checks.push({
      ok: factList.length === 8 && factFails.length === 0,
      label: "all 8 facts locate a unique event and deep-equal their assertion",
      detail: factFails.length ? factFails.slice(0, 4).join(" || ") : `facts=${factList.length}, 0 failures`,
    });
  }

  gate(
    "S1-A",
    "S1 fixtures + expected-facts consumer (NEW globalAssertions shape)",
    checks,
    `sha256sum "${S1_BATCH_REL}" "${S1_AGENT_SPAN_REL}" "${S1_FACTS_REL}"`,
  );
}

/* ------------------------------------------------------------------ */
/* S1-B build artifacts                                                */
/* ------------------------------------------------------------------ */

function checkS1B(builds, validate) {
  section("S1-B build artifacts");
  const checks = [];
  const agentJar = abs(AGENT_JAR_REL);
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const workbenchDist = distTextFiles(WORKBENCH_DIST_REL).map((f) => f.text).join("\n");

  checks.push({ ok: builds.root === true, label: "root reactor mvn package (JDK21) exit 0", detail: "see V2a" });
  checks.push({ ok: builds.workbenchCi === true && builds.workbenchBuild === true, label: "workbench npm ci && npm run build exit 0", detail: "see V2c-1/V2c-2" });
  checks.push({ ok: builds.demoBackend === true, label: "demo backend (JDK8) build exit 0", detail: "see V2b" });
  checks.push({ ok: builds.demoFrontendCi === true && builds.demoFrontendBuild === true, label: "demo frontend build exit 0", detail: "see V2d-1/V2d-2" });

  const agentEntries = existsSync(agentJar) ? zipEntries(agentJar) : { ok: false, entries: [], stderr: "missing" };
  const shaded = agentEntries.entries.filter((entry) => entry.startsWith("io/traceboard/agent/shaded/net/bytebuddy/") && entry.endsWith(".class"));
  const unrelocated = agentEntries.entries.filter((entry) => entry.startsWith("net/bytebuddy/") || entry === "net/bytebuddy");
  checks.push({ ok: agentEntries.ok, label: "agent jar readable (unzip -Z1)", detail: agentEntries.ok ? `${agentEntries.entries.length} entries` : agentEntries.stderr });
  checks.push({
    ok: shaded.length > 0,
    label: "shaded Byte Buddy present (io/traceboard/agent/shaded/net/bytebuddy/**)",
    detail: shaded.length ? `${shaded.length} classes, e.g. ${shaded[0]}` : "missing",
  });
  checks.push({
    ok: unrelocated.length === 0,
    label: "no unrelocated net/bytebuddy entries",
    detail: unrelocated.length ? unrelocated.slice(0, 4).join(",") : "0",
  });

  if (existsSync(agentJar)) {
    const manifest = runExe("unzip", ["-p", agentJar, "META-INF/MANIFEST.MF"]);
    const premain = (manifest.stdout || "").split(/\r?\n/).find((line) => /^Premain-Class:/i.test(line.trim())) ?? "";
    checks.push({
      ok: manifest.code === 0 && /io\.traceboard\.agent\.TraceAgent/.test(premain),
      label: "MANIFEST Premain-Class: io.traceboard.agent.TraceAgent",
      detail: premain.trim() || `unzip exit=${manifest.code}`,
    });
    checks.push({
      ok: !/^Agent-Class:/im.test(manifest.stdout || ""),
      label: "MANIFEST has no Agent-Class (no attach API)",
      detail: /^Agent-Class:/im.test(manifest.stdout || "") ? "present (BAD)" : "absent",
    });
  }
  checks.push({
    ok: !existsSync(abs("agent/dependency-reduced-pom.xml")),
    label: "agent/dependency-reduced-pom.xml absent",
    detail: existsSync(abs("agent/dependency-reduced-pom.xml")) ? "present (BAD)" : "absent",
  });

  const javap = existsSync(JDK21_JAVAP)
    ? runExe(JDK21_JAVAP, ["-verbose", "-classpath", agentJar, "io.traceboard.agent.TraceAgent"])
    : { stdout: "", stderr: "javap missing" };
  const major = Number((javap.stdout.match(/major version:\s*(\d+)/) ?? [])[1]);
  checks.push({ ok: major === 52, label: "agent jar class major version 52", detail: `major=${Number.isNaN(major) ? "?" : major}` });

  const schemaInJar = existsSync(collectorJar)
    ? runExe("unzip", ["-p", collectorJar, "BOOT-INF/classes/schema/traceboard.event.v1.json"])
    : { code: 1, stdout: "", stderr: "collector jar missing" };
  const jarSchemaHash = schemaInJar.code === 0 ? sha256Text(schemaInJar.stdout) : "unreadable";
  const repoSchemaHash = sha256File(abs(SCHEMA_REL));
  const collectorEntries = existsSync(collectorJar) ? zipEntries(collectorJar) : { ok: false, entries: [] };
  const schemaCopies = collectorEntries.entries.filter((entry) => entry.endsWith("schema/traceboard.event.v1.json"));
  checks.push({
    ok: schemaInJar.code === 0 && jarSchemaHash === repoSchemaHash,
    label: "collector jar schema byte-identical to repo schema (unzip -p sha256)",
    detail: `jar=${jarSchemaHash} repo=${repoSchemaHash}`,
  });
  checks.push({
    ok: schemaCopies.length === 1,
    label: "collector jar contains exactly one schema copy",
    detail: schemaCopies.join(",") || "none",
  });
  checks.push({
    ok: !existsSync(abs("server/collector/src/main/resources/schema")),
    label: "no schema copy under server/collector/src/main/resources",
    detail: "absent",
  });

  const distTokens = ["发送假点击/请求", "Walking skeleton", "nodeKey", "seq", "btn-s1-fake", "no correlation yet"];
  for (const token of distTokens) {
    checks.push({
      ok: workbenchDist.includes(token),
      label: `workbench dist contains "${token}"`,
      detail: "found",
    });
  }

  const viteConfig = readFileSync(abs("workbench/vite.config.ts"), "utf8");
  const proxy = (name) => new RegExp(`["']${name}["']\\s*:\\s*\\{[\\s\\S]*?target:\\s*["']http://127\\.0\\.0\\.1:8601["']`).test(viteConfig);
  checks.push({ ok: proxy("/ingest"), label: "vite proxy /ingest -> http://127.0.0.1:8601", detail: proxy("/ingest") ? "configured" : "missing" });
  checks.push({ ok: proxy("/api"), label: "vite proxy /api -> http://127.0.0.1:8601", detail: proxy("/api") ? "configured" : "missing" });
  checks.push({ ok: /strictPort:\s*true/.test(viteConfig) && /port:\s*5173/.test(viteConfig), label: "vite dev server port 5173 strictPort:true", detail: "configured" });
  checks.push({ ok: !/0\.0\.0\.0/.test(viteConfig), label: "vite config binds no 0.0.0.0 address", detail: "none" });

  if (validate) checks.push({ ok: true, label: "schema validator available for runtime gates", detail: "compiled in V1" });

  gate(
    "S1-B",
    "S1 build artifacts: jar shading/schema parity, workbench dist markers, Vite proxy",
    checks,
    `(cd "workbench" && npm ci && npm run build) && unzip -p "${COLLECTOR_JAR_REL}" "BOOT-INF/classes/schema/traceboard.event.v1.json" | sha256sum`,
  );
}

/* ------------------------------------------------------------------ */
/* S2-1 build artifacts                                                */
/* ------------------------------------------------------------------ */

function checkS2Artifacts() {
  section("S2-1 build artifacts");
  const checks = [];
  const agentJar = abs(AGENT_JAR_REL);
  const collectorJar = abs(COLLECTOR_JAR_REL);

  checks.push({ ok: resultById("V2a")?.ok === true, label: "root reactor mvn package with JDK21 (agent + collector)", detail: "see V2a" });
  checks.push({ ok: resultById("V2b")?.ok === true, label: "demo backend mvn package with JDK8 (H2 + MyBatis)", detail: "see V2b" });
  checks.push({ ok: resultById("V2c-1")?.ok === true && resultById("V2c-2")?.ok === true, label: "workbench npm ci + npm run build", detail: "see V2c-1/V2c-2" });
  checks.push({ ok: existsSync(abs(DEMO_JAR_REL)), label: "demo-shop-backend-0.1.0-SNAPSHOT.jar exists", detail: DEMO_JAR_REL });

  let major = null;
  if (existsSync(agentJar) && existsSync(JDK21_JAVAP)) {
    const result = runExe(JDK21_JAVAP, ["-verbose", "-classpath", agentJar, "io.traceboard.agent.TraceAgent"]);
    const match = result.stdout.match(/major version:\s*(\d+)/);
    major = match ? Number(match[1]) : null;
  }
  checks.push({ ok: major === 52, label: "agent jar class major version 52 (Java 8)", detail: `major=${major ?? "?"}` });

  if (existsSync(agentJar)) {
    const manifest = runExe("unzip", ["-p", agentJar, "META-INF/MANIFEST.MF"]);
    const premain = (manifest.stdout || "").split(/\r?\n/).find((line) => /^Premain-Class:/i.test(line.trim())) ?? "";
    checks.push({
      ok: manifest.code === 0 && /io\.traceboard\.agent\.TraceAgent/.test(premain),
      label: "agent manifest Premain-Class: io.traceboard.agent.TraceAgent",
      detail: premain.trim() || `unzip exit=${manifest.code}`,
    });
  } else {
    checks.push({ ok: false, label: "agent jar readable", detail: "missing" });
  }

  const agentEntries = existsSync(agentJar) ? zipEntries(agentJar) : { ok: false, entries: [] };
  const shaded = agentEntries.entries.filter((entry) => entry.startsWith("io/traceboard/agent/shaded/net/bytebuddy/") && entry.endsWith(".class"));
  const unrelocated = agentEntries.entries.filter((entry) => entry.startsWith("net/bytebuddy/"));
  checks.push({
    ok: agentEntries.ok && shaded.length > 0 && unrelocated.length === 0,
    label: "agent jar shades Byte Buddy (no unrelocated net/bytebuddy)",
    detail: `shaded=${shaded.length} unrelocated=${unrelocated.length}`,
  });

  const schemaInJar = existsSync(collectorJar)
    ? runExe("unzip", ["-p", collectorJar, "BOOT-INF/classes/schema/traceboard.event.v1.json"])
    : { code: 1, stdout: "" };
  const jarSchemaHash = schemaInJar.code === 0 ? sha256Text(schemaInJar.stdout) : "unreadable";
  const repoSchemaHash = sha256File(abs(SCHEMA_REL));
  checks.push({
    ok: schemaInJar.code === 0 && jarSchemaHash === repoSchemaHash,
    label: "collector jar schema byte-identical to the repo schema",
    detail: `jar=${jarSchemaHash.slice(0, 12)} repo=${repoSchemaHash.slice(0, 12)}`,
  });
  const collectorEntries = existsSync(collectorJar) ? zipEntries(collectorJar) : { ok: false, entries: [] };
  const schemaCopies = collectorEntries.entries.filter((entry) => entry.endsWith("schema/traceboard.event.v1.json"));
  checks.push({
    ok: schemaCopies.length === 1,
    label: "collector jar contains exactly one schema copy",
    detail: schemaCopies.join(",") || "none",
  });

  const distIndex = abs(`${WORKBENCH_DIST_REL}/index.html`);
  checks.push({ ok: existsSync(distIndex), label: "workbench dist/index.html exists after the build", detail: WORKBENCH_DIST_REL });

  gate(
    "S2-1",
    "build: root JDK21, demo JDK8 H2/MyBatis, agent 52/shaded/premain, collector schema parity, workbench build",
    checks,
    `JAVA_HOME="${JDK21_HOME}" mvn -B -q -DskipTests package && (cd "demo/buggy-shop-boot-vue/backend" && JAVA_HOME="${JDK8_HOME}" mvn -B -q -DskipTests package) && (cd "workbench" && npm ci && npm run build)`,
  );
}

/* ------------------------------------------------------------------ */
/* S2-6 workbench dist facts                                           */
/* ------------------------------------------------------------------ */

function checkS2Workbench() {
  section("S2-6 workbench dist");
  const checks = [];
  const files = distTextFiles(WORKBENCH_DIST_REL);
  const all = files.map((file) => file.text).join("\n");
  const findIn = (token) => files.filter((file) => file.text.includes(token)).map((file) => file.rel).join(",") || "not found";

  const tokens = [
    "0 行事实链",
    "requests",
    "graph",
    "rowsAffected",
    "未采集",
    "事实摘要",
    "traceId",
    "事实摘要，不是缺陷结论",
    "游离后端请求（无前端根）",
    "每 5 秒刷新（非实时）",
    "s2-panel",
    "s2-session",
    "s2-refresh",
    "s2-requests",
    "s2-chain",
  ];
  for (const token of tokens) {
    checks.push({ ok: all.includes(token), label: `dist contains "${token}"`, detail: findIn(token) });
  }
  checks.push({
    ok: (all.includes("S1 walking skeleton（假数据，非 S3 事实链）") || all.includes("S1 walking skeleton（假数据，非 S2 事实链）")) &&
      all.includes("发送假点击/请求"),
    label: "S1 fake panel retained and folded as secondary (S1 walking skeleton label present)",
    detail: findIn("S1 walking skeleton"),
  });
  checks.push({
    ok: all.includes("Fixture 事实摘要") && all.includes("case-a-zero-rows · 只读"),
    label: "S0 FixturePanel retained",
    detail: findIn("Fixture 事实摘要"),
  });
  checks.push({
    ok: !/new EventSource|new WebSocket|sendBeacon/.test(all) &&
      !/["'`]\/api\/v1\/stream|["'`]\/ws\/v1\/events/.test(all),
    label: "no SSE/WebSocket/stream artifact in the built workbench (S3: timeline/replay allowed)",
    detail: "none",
  });
  const pkg = readFileSync(abs("workbench/package.json"), "utf8");
  checks.push({
    ok: !/"(d3|echarts|cytoscape|vis-network|chart\.js|three|sigma)"/.test(pkg) &&
      !/\bd3\.|cytoscape\(|echarts\.init|vis\.Network/.test(all),
    label: "no graph library in package.json or dist (indented list, no canvas graph)",
    detail: "none",
  });
  checks.push({
    ok: !/<canvas/i.test(all),
    label: "no canvas graph element in dist",
    detail: "none",
  });
  checks.push({
    ok: all.includes("s2-panel") && all.includes("s2-timeline") === false,
    label: "S2 panel retained (S3 additions do not replace the S2 selectors)",
    detail: findIn("s2-panel"),
  });

  gate(
    "S2-6",
    "S2 migration: workbench retains the S2 fact-chain markers/selectors and S0/S1 panels, S3 additions allowed, still no graph lib/SSE/WS",
    checks,
    `(cd "workbench" && npm ci && npm run build) && grep -Rho "0 行事实链\\|事实摘要，不是缺陷结论\\|s2-chain" "workbench/dist" | sort -u`,
  );
}

/* ------------------------------------------------------------------ */
/* S2-L drift: S2 G1 baseline + S0 freeze + S1 fixture bytes           */
/* ------------------------------------------------------------------ */

function resultById(id) {
  return RESULTS.find((item) => item.id === id) ?? null;
}

function checkS2Drift() {
  section("S2-L drift: S2 G1 baseline + S0 freeze + S1 fixture bytes");
  const checks = [];
  const reviewText = readFileSync(abs(S2_PLAN_REVIEW_REL), "utf8");
  checks.push({
    ok: /结论：\s*\*\*G1: PASS\*\*/.test(reviewText) || reviewText.includes("G1: PASS"),
    label: "S2 plan-review records G1: PASS (freeze is the authority)",
    detail: "G1: PASS",
  });

  const freeze = s2FreezeSections();
  checks.push({ ok: freeze.s2.length === 9, label: "9 S2 G1 freeze hashes recorded", detail: `found=${freeze.s2.length}` });
  const s2Map = new Map(freeze.s2.map((entry) => [entry.rel, entry.hash]));
  const s3Freeze = s3FreezeSections();
  const s3Map = new Map(s3Freeze.s3.map((entry) => [entry.rel, entry.hash]));
  // S4/S5/S6a re-hashed api/event-model (and re-used unchanged files); the latest freeze wins
  // (S6a supersedes the S5 api/event-model hashes; schema/transport/status/S0–S5 stay at S5).
  const latestMap = new Map([...s3Map, ...Object.entries(LATEST_G1_FREEZE)]);
  const contractRels = new Set([
    "docs/contracts/api.v1.md",
    "docs/contracts/transport.v1.md",
    "docs/contracts/event-model.v1.md",
    "docs/contracts/status-semantics.md",
  ]);
  for (const entry of freeze.s2) {
    const actual = existsSync(abs(entry.rel)) ? sha256File(abs(entry.rel)) : "missing";
    if (contractRels.has(entry.rel) && entry.rel !== "docs/contracts/status-semantics.md") {
      const expected = latestMap.get(entry.rel);
      const ok = Boolean(expected) && actual === expected;
      checks.push({
        ok,
        label: `S3/S4/S5/S6a/S6b migration: contract updated only through the latest G1 freeze (${entry.rel})`,
        detail: ok ? "hash matches the latest (S6b) G1 freeze" : `actual=${actual} latest=${expected ?? "missing"}`,
      });
    } else {
      checks.push({
        ok: actual === entry.hash,
        label: `S2 freeze intact ${entry.rel}`,
        detail: actual === entry.hash ? "hash matches" : `actual=${actual} baseline=${entry.hash}`,
      });
    }
  }

  checks.push({ ok: freeze.s0s1.length === 7, label: "7 S0/S1 frozen fixture hashes recorded", detail: `found=${freeze.s0s1.length}` });
  for (const entry of freeze.s0s1) {
    const actual = existsSync(abs(entry.rel)) ? sha256File(abs(entry.rel)) : "missing";
    checks.push({
      ok: actual === entry.hash,
      label: `S1/S0 fixture bytes unchanged ${entry.rel}`,
      detail: actual === entry.hash ? "hash matches" : `actual=${actual} baseline=${entry.hash}`,
    });
  }

  const contractSet = new Set([
    "docs/contracts/api.v1.md",
    "docs/contracts/transport.v1.md",
    "docs/contracts/event-model.v1.md",
  ]);
  const s0Baseline = parseFreezeBaseline(PLAN_REVIEW_REL);
  checks.push({ ok: s0Baseline.length === 7, label: "7 S0 G1 baseline hashes recorded in S0 plan-review.md", detail: `found=${s0Baseline.length}` });
  const drifted = [];
  for (const entry of s0Baseline) {
    const actual = existsSync(abs(entry.rel)) ? sha256File(abs(entry.rel)) : "missing";
    if (contractSet.has(entry.rel)) {
      const expected = latestMap.get(entry.rel);
      const ok = Boolean(expected) && actual === expected;
      checks.push({
        ok,
        label: `S0 contract updated only through the latest G1 freeze (${entry.rel})`,
        detail: `s0=${entry.hash.slice(0, 12)} latest=${String(actual).slice(0, 12)}`,
      });
      if (!ok) drifted.push(entry.rel);
    } else {
      const ok = actual === entry.hash;
      checks.push({ ok, label: `S0 frozen unchanged ${entry.rel}`, detail: actual === entry.hash ? "hash matches" : `actual=${actual} s0=${entry.hash}` });
      if (!ok) drifted.push(entry.rel);
    }
  }
  checks.push({
    ok: drifted.length === 0,
    label: "no unexplained drift outside the S2 G1 freeze",
    detail: drifted.length ? drifted.join(",") : "clean",
  });

  const priorIds = ["V1", "V1b", "V1c", "V4b"];
  checks.push({
    ok: priorIds.every((id) => resultById(id)?.ok === true),
    label: "S0 case-A fixture still validates (V1/V1b/V1c/V4b)",
    detail: priorIds.map((id) => `${id}=${resultById(id)?.ok ? "PASS" : "FAIL"}`).join(","),
  });
  const buildIds = ["V2a", "V2b", "V2c-1", "V2c-2", "V2d-1", "V2d-2"];
  checks.push({
    ok: buildIds.every((id) => resultById(id)?.ok === true),
    label: "S0 builds still green (root/demo/workbench/demo frontend)",
    detail: buildIds.map((id) => `${id}=${resultById(id)?.ok ? "PASS" : "FAIL"}`).join(","),
  });

  gate(
    "S2-L",
    "drift (S3 migration): S2 G1 fixture hashes intact, contracts match the S3 G1 freeze, S0 freeze intact, case-A valid, S0 builds green",
    checks,
    `sha256sum "schema/traceboard.event.v1.json" "docs/contracts/api.v1.md" "docs/contracts/event-model.v1.md" "docs/contracts/transport.v1.md" "fixtures/s2-zero-row-chain/events.ndjson" "fixtures/s1-walking-skeleton/frontend-fake-batch.ndjson"`,
  );
}

/* ------------------------------------------------------------------ */
/* S2-8 scope / security                                               */
/* ------------------------------------------------------------------ */

function checkS2Scope() {
  section("S2-8 scope / security");
  const checks = [];

  /* -------- collector: exactly 6 routes, read-only derivations, no S3/DB/stream -------- */
  const collectorFiles = dirTextFiles("server/collector/src");
  const collectorCode = collectorFiles.map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const routes = [];
  for (const file of collectorCode) {
    if (!/\.java$/.test(file.rel)) continue;
    for (const match of file.text.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:path\s*=\s*)?["']([^"']+)["']/g)) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  const expectedRoutes = [
    "GET /api/v1/meta",
    "GET /api/v1/sessions",
    "GET /api/v1/sessions/{sessionId}/events",
    "GET /api/v1/sessions/{sessionId}/requests",
    "GET /api/v1/sessions/{sessionId}/graph",
    "GET /api/v1/sessions/{sessionId}/replay",
    "GET /api/v1/sessions/{sessionId}/agent",
    "POST /ingest/v1/events",
    "POST /ingest/v1/agent-hello",
  ];
  checks.push({
    ok: routes.slice().sort().join("|") === expectedRoutes.slice().sort().join("|"),
    label: "S4 migration: collector registers exactly the 9 business routes (S1/S2/S3 seven + agent-hello + agent; no stream/ws/links)",
    detail: routes.sort().join(", "),
  });
  const reservedRouteLeak = collectorCode.filter((file) => /["']\/[^"']*(links|\/stream|\/ws\/)[^"']*["']/.test(file.text));
  checks.push({
    ok: reservedRouteLeak.length === 0,
    label: "no reserved stream/ws/links path string in collector code",
    detail: reservedRouteLeak.map((f) => f.rel).join(",") || "none",
  });
  const collectorForbidden = [
    { name: "db", re: /JdbcTemplate|java\.sql|javax\.sql|@Repository|spring-data-jpa|mybatis|hibernate/i },
    { name: "persistence", re: /FileOutputStream|Files\.write|java\.nio\.file|RandomAccessFile/ },
    { name: "correlation", re: /traceparent|clickId|mergeRootEvent/i },
    { name: "stream", re: /SseEmitter|new EventSource|WebSocket|@ServerEndpoint/i },
    { name: "cors", re: /@CrossOrigin|Access-Control-Allow/ },
  ];
  const collectorHits = [];
  for (const file of collectorCode) {
    for (const { name, re } of collectorForbidden) {
      if (re.test(file.text)) collectorHits.push(`${file.rel} [${name}]`);
    }
  }
  checks.push({ ok: collectorHits.length === 0, label: "collector has no DB/persistence/correlation/SSE-WS/CORS code", detail: collectorHits.join(",") || "none" });
  const collectorSources = collectorCode.map((file) => file.text).join("\n");
  checks.push({
    ok: /snapshot\(\)/.test(collectorSources) && !/@Cacheable|Caffeine|caffeine|ConcurrentHashMap<[^>]*Span/.test(collectorSources),
    label: "requests/graph derive at read time from the snapshot (no derive cache)",
    detail: "TraceDeriver reads snapshot().events() on every GET",
  });

  /* -------- agent: exactly 4 points, no extra targets, no S3 probes -------- */
  const agentFiles = dirTextFiles("agent/src");
  const agentCode = agentFiles.map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const agentSources = agentCode.map((file) => file.text).join("\n");
  const traceAgent = agentCode.find((f) => f.rel.endsWith("TraceAgent.java"))?.text ?? "";
  const typeMatchers = (traceAgent.match(/\.type\(/g) ?? []).length;
  const transformSites = (traceAgent.match(/\.transform\(/g) ?? []).length;
  const agentTargets = [
    "com.example.shop.controller.OrderController",
    "com.example.shop.service.OrderService",
    "com.example.shop.model.Order",
    "org.apache.ibatis.binding.MapperProxy",
    "org.apache.ibatis.executor.statement.PreparedStatementHandler",
  ];
  const adviceClasses = [
    "ControllerAdvice.class", "PreviewControllerAdvice.class", "ReconcileControllerAdvice.class",
    "AsyncControllerAdvice.class", "NoDebugControllerAdvice.class", "LoopControllerAdvice.class",
    "ServiceAdvice.class", "PreviewServiceAdvice.class", "FieldWriteAdvice.class",
    "MapperAdvice.class", "SqlAdvice.class",
  ];
  checks.push({
    ok: typeMatchers === 5 && transformSites === 11 &&
      agentTargets.every((target) => traceAgent.includes(target)) &&
      adviceClasses.every((name) => traceAgent.includes(name)),
    label: "agent instruments exactly 5 Byte Buddy types / 11 advices (cancel+preview+reconcile+async+noDebug+loop controllers, cancel/preview services, Order field write, MapperProxy, PreparedStatementHandler; L2DemoService/NoDebugService are ASM-only)",
    detail: `.type=${typeMatchers} .transform=${transformSites} advices=${adviceClasses.length}`,
  });
  const shopClasses = [...new Set(agentSources.match(/com\.example\.shop\.[A-Za-z0-9_.]+/g) ?? [])].sort();
  const expectedShopClasses = [
    "com.example.shop.controller.OrderController",
    "com.example.shop.mapper.OrderMapper",
    "com.example.shop.model.Order",
    "com.example.shop.service.L2DemoService",
    "com.example.shop.service.NoDebugService",
    "com.example.shop.service.OrderService",
  ];
  checks.push({
    ok: deepEqual(shopClasses, expectedShopClasses),
    label: "no other com.example.shop target is referenced/instrumented: 4 S2/S5 classes + the two ASM-only demo services (L2DemoService/NoDebugService are not Byte Buddy targets)",
    detail: shopClasses.join(","),
  });
  checks.push({
    ok: /isTargetMapperMethod/.test(agentSources) && /MAPPER_METHOD\s*=\s*"cancelById"/.test(agentSources) &&
      !/countById/.test(agentSources) && /mappedStatement/.test(agentSources) &&
      /@Advice\.Return\(readOnly = true\)\s+int\s+rowsAffected/.test(agentSources),
    label: "mapper filter is cancelById only; SQL filter reads mappedStatement and the real @Return rows",
    detail: "countById never instrumented",
  });
  const agentForbidden = [];
  for (const file of agentCode) {
    const l2Allowed = S6A_AGENT_L2_FILES.includes(file.rel);
    for (const { name, re } of [
      { name: "browser/sdk", re: /EventSource|WebSocket|sendBeacon|addEventListener\("click"/ },
      { name: "L2/local", re: /kind\s*=\s*["']local|LocalVariableTable|visitLocalVariable|localVariables/ },
      { name: "exception-payload", re: /getMessage\(\)/ },
    ]) {
      if (name === "L2/local" && l2Allowed) continue;
      if (re.test(file.text)) agentForbidden.push(`${file.rel} [${name}]`);
    }
  }
  checks.push({
    ok: agentForbidden.length === 0,
    label: "agent has no browser SDK / exception-payload code; L2/LVT terminology is allowed only in the S6a/S6b L2 files (L1Values stays param+field+return only)",
    detail: agentForbidden.join(",") || "none",
  });
  const l1Values = agentCode.find((f) => f.rel.endsWith("L1Values.java"))?.text ?? "";
  checks.push({
    ok: /"param"/.test(l1Values) && /"field"/.test(l1Values) && /"return"/.test(l1Values) &&
      !/["']local["']/.test(l1Values),
    label: "S5 values kinds are limited to param/field/return (kind=local belongs to S6 and is never emitted)",
    detail: "L1Values.java",
  });

  const requestHeaders = agentCode.find((f) => f.rel.endsWith("RequestHeaders.java"))?.text ?? "";
  const spanContext = agentCode.find((f) => f.rel.endsWith("SpanContext.java"))?.text ?? "";
  const agentImports = agentCode.map((f) => f.text).join("\n");
  checks.push({
    ok: /TRACEPARENT\s*=\s*"traceparent"/.test(requestHeaders) && /CLICK_HEADER\s*=\s*"X-TraceBoard-Click"/.test(requestHeaders) &&
      /RequestContextHolder/.test(requestHeaders) && /ServletRequestAttributes/.test(requestHeaders) &&
      /getHeader/.test(requestHeaders) && /header_unreadable=/.test(requestHeaders) &&
      requestHeaders.includes("^00-") && requestHeaders.includes("[0-9a-f]{32}") &&
      requestHeaders.includes("[0-9a-f]{16}") && requestHeaders.includes("^click_[A-Za-z0-9_-]{8,}$") &&
      !/logger\.|System\.out|System\.err/.test(requestHeaders.replace(/TraceAgent\.log/g, "")),
    label: "agent S3: reflection-only header read (strict traceparent/click regex, header_unreadable counter, no header value logging)",
    detail: "RequestHeaders.java",
  });
  checks.push({
    ok: !/import\s+org\.springframework/.test(agentImports) && !/import\s+javax\.servlet/.test(agentImports) &&
      /Class\.forName\(/.test(requestHeaders),
    label: "agent has no compile-time Spring/Servlet dependency (reflection Class.forName only)",
    detail: "agent pom/source have no spring/servlet imports",
  });
  checks.push({
    ok: /RequestHeaders\.current\(\)/.test(spanContext) && /click_lost_/.test(spanContext) &&
      /CONFIDENCE_EXACT/.test(spanContext) && /CONFIDENCE_LOST/.test(spanContext) &&
      /link\.clickId/.test(spanContext) && /link\.parentSpanId/.test(spanContext) && /link\.traceId/.test(spanContext),
    label: "agent S3: valid header link -> EXACT fields; missing/invalid -> verbatim S2 click_lost_/LOST root",
    detail: "SpanContext.enterController",
  });
  const agentPom = readFileSync(abs("agent/pom.xml"), "utf8");
  checks.push({
    ok: !/<dependency>[\s\S]*?(spring|servlet|mybatis)/i.test(agentPom),
    label: "agent pom adds no Spring/Servlet/MyBatis dependency",
    detail: "reflection only",
  });

  const failOpen = (agentSources.match(/catch\s*\(\s*Throwable/g) ?? []).length;
  // S4: AgentHello retries the handshake (<=3 attempts); the event sender itself stays one-shot.
  const eventSender = agentCode.find((f) => f.rel.endsWith("EventSender.java"))?.text ?? "";
  const agentHello = agentCode.find((f) => f.rel.endsWith("AgentHello.java"))?.text ?? "";
  checks.push({
    ok: failOpen >= 4 && !/\bretry\b|for\s*\(\s*int\s+attempt/i.test(eventSender) &&
      !/\bretry\b/i.test(eventSender) &&
      /MAX_ATTEMPTS\s*=\s*3/.test(agentHello) && /for\s*\(\s*int\s+attempt/i.test(agentHello) &&
      /daemon/i.test(agentHello) && /setDaemon\(true\)/.test(agentHello) &&
      /ArrayBlockingQueue/.test(agentSources) && /CAPACITY\s*=\s*16/.test(agentSources) &&
      /CONNECT_TIMEOUT_MS\s*=\s*300/.test(agentSources) && /READ_TIMEOUT_MS\s*=\s*700/.test(agentSources),
    label: "agent fail-open: Throwable guards, bounded queue 16, 300/700ms, EventSender one-shot; handshake is a <=3-attempt daemon (S4)",
    detail: `catch(Throwable)=${failOpen}`,
  });
  checks.push({
    ok: /FLAG_CHAIN\s*=\s*"S2_ZERO_ROW_CHAIN"/.test(agentSources) && /FLAG_LOST_BACKEND\s*=\s*"LOST_BACKEND"/.test(agentSources) &&
      /if\s*\(frame\.root\)/.test(agentSources),
    label: "agent flags S2_ZERO_ROW_CHAIN everywhere and LOST_BACKEND only on the root",
    detail: "SpanEmitter root gate",
  });

  /* -------- workbench: S2 panel only, no S3/graph library/stream -------- */
  const workbenchFiles = dirTextFiles("workbench/src");
  const wbCode = workbenchFiles.map((f) => stripComments(f.text)).join("\n");
  const apiText = workbenchFiles.find((f) => f.rel.endsWith("src/api.ts"))?.text ?? "";
  const apiCode = stripComments(apiText);
  const s2PanelText = workbenchFiles.find((f) => f.rel.endsWith("components/S2Panel.vue"))?.text ?? "";
  const s2StoreText = workbenchFiles.find((f) => f.rel.endsWith("stores/s2.ts"))?.text ?? "";
  const s1PanelText = workbenchFiles.find((f) => f.rel.endsWith("components/S1Panel.vue"))?.text ?? "";
  const fakeBatchText = workbenchFiles.find((f) => f.rel.endsWith("src/s1/fakeBatch.ts"))?.text ?? "";
  const s3PanelText = workbenchFiles.find((f) => f.rel.endsWith("components/S3Panel.vue"))?.text ?? "";
  const s3StoreText = workbenchFiles.find((f) => f.rel.endsWith("stores/s3.ts"))?.text ?? "";
  const s3ReplayCode = stripComments(`${s3PanelText}\n${s3StoreText}`);
  checks.push({
    ok: !/new EventSource|new WebSocket|sendBeacon/.test(wbCode),
    label: "workbench has no SSE/WebSocket/beacon channel",
    detail: "none",
  });
  checks.push({
    ok: /POLL_INTERVAL_MS\s*=\s*5000/.test(s2PanelText) &&
      /document\.visibilityState\s*===\s*"visible"/.test(s2PanelText) &&
      s2PanelText.includes("每 5 秒刷新（非实时）"),
    label: "workbench polls every 5s only while visible (manual refresh + non-realtime label)",
    detail: "POLL_INTERVAL_MS=5000 + visibility gate",
  });
  checks.push({
    ok: !/<canvas/i.test(wbCode) && !/from\s+["'](d3|echarts|cytoscape|vis-network|chart\.js|three|sigma)/.test(wbCode),
    label: "workbench has no graph/canvas library or canvas element",
    detail: "none",
  });
  checks.push({
    ok: /S3_DEFAULT_SESSION_ID\s*=\s*"s_s3demo"/.test(s3StoreText) &&
      S3_SELECTORS.every((id) => s3PanelText.includes(`id="${id}"`)),
    label: "S3 migration: S3 board is primary (s_s3demo) with the 10 stable #s3-* selectors",
    detail: `selectors=${S3_SELECTORS.filter((id) => s3PanelText.includes(`id="${id}"`)).length}/10`,
  });
  checks.push({
    ok: !/\bfetch\s*\(|XMLHttpRequest|method:\s*["']POST["']/.test(s3ReplayCode),
    label: "S3 migration: workbench replay/timeline component issues no direct fetch/POST (read-only view)",
    detail: "GET via src/api.ts fetchReplay only",
  });
  checks.push({
    ok: /S2_DEFAULT_SESSION_ID\s*=\s*"s_s2agent"/.test(s2StoreText) &&
      s2PanelText.includes('id="s2-panel"') && s2PanelText.includes('id="s2-session"') &&
      s2PanelText.includes('id="s2-refresh"') && s2PanelText.includes('id="s2-requests"') &&
      s2PanelText.includes('id="s2-chain"'),
    label: "S2 panel keeps the stable #s2-* selectors and defaults to s_s2agent",
    detail: "5 selectors present",
  });
  checks.push({
    ok: /S1_SESSION_ID\s*=\s*"s_wb_demo"/.test(fakeBatchText) && /readBack\(S1_SESSION_ID\)/.test(s1PanelText),
    label: "S1 fake panel is retained (s_wb_demo read-back path kept)",
    detail: "S1Panel readBack intact",
  });
  checks.push({
    ok: apiCode.includes('"/ingest/v1/events"') && apiCode.includes('"/api/v1/sessions"') &&
      !/["'`]https?:\/\//.test(apiCode),
    label: "workbench API client uses relative paths only (proxy, no CORS/absolute URL)",
    detail: apiCode.includes('"/ingest/v1/events"') ? "relative" : "missing",
  });
  const workbenchPkg = readFileSync(abs("workbench/package.json"), "utf8");
  checks.push({
    ok: !/"(d3|echarts|cytoscape|vis-network|chart\.js|three|sigma)"/.test(workbenchPkg),
    label: "workbench package.json has no graph/timeline dependency",
    detail: "dependencies: vue, pinia only",
  });
  const viteConfig = readFileSync(abs("workbench/vite.config.ts"), "utf8");
  const proxy = (name) => new RegExp(`["']${name}["']\\s*:\\s*\\{[\\s\\S]*?target:\\s*["']http://127\\.0\\.0\\.1:8601["']`).test(viteConfig);
  checks.push({
    ok: proxy("/api") && proxy("/ingest") && !/0\.0\.0\.0/.test(viteConfig),
    label: "Vite dev proxy /api + /ingest -> http://127.0.0.1:8601 (loopback only)",
    detail: "proxy unchanged",
  });

  /* -------- demo: H2 embedded only, real defect, no MySQL -------- */
  const demoPom = readFileSync(abs("demo/buggy-shop-boot-vue/backend/pom.xml"), "utf8");
  checks.push({
    ok: /mybatis-spring-boot-starter/.test(demoPom) && /<mybatis-spring-boot\.version>2\.3\.1</.test(demoPom) &&
      /<artifactId>h2<\/artifactId>/.test(demoPom) && /<scope>runtime<\/scope>/.test(demoPom) &&
      !/mysql-connector|jdbc:mysql|com\.mysql|mariadb/i.test(demoPom) && !/<h2\.version>/.test(demoPom),
    label: "demo pom: MyBatis starter 2.3.1 + H2 runtime (Boot-managed version), no MySQL driver",
    detail: "pom.xml",
  });
  const demoSrc = dirTextFiles("demo/buggy-shop-boot-vue/backend/src");
  const demoText = demoSrc.map((file) => file.text).join("\n");
  const demoAppYml = demoSrc.find((file) => file.rel.endsWith("application.yml"))?.text ?? "";
  checks.push({
    ok: /jdbc:h2:mem:shop;DB_CLOSE_DELAY=-1/.test(demoAppYml) && /org\.h2\.Driver/.test(demoAppYml) &&
      /mode:\s*always/.test(demoAppYml) && !/jdbc:mysql|mysql-connector|com\.mysql/i.test(demoText),
    label: "demo config: embedded H2 only (jdbc:h2:mem:shop, DB_CLOSE_DELAY=-1), no MySQL URL/driver",
    detail: "application.yml",
  });
  const mapperText = demoSrc.find((file) => file.rel.endsWith("mapper/OrderMapper.java"))?.text ?? "";
  const serviceText = demoSrc.find((file) => file.rel.endsWith("service/OrderService.java"))?.text ?? "";
  checks.push({
    ok: /status='PAID'/.test(mapperText) && /countById/.test(mapperText) &&
      /orderMapper\.cancelById\([^)]*\)\s*;/.test(serviceText) &&
      !/(?:int|long|Integer)\s+\w+\s*=\s*orderMapper\.cancelById/.test(serviceText) &&
      !/if\s*\(\s*orderMapper\.cancelById/.test(serviceText),
    label: "demo defect is real: UPDATE ... AND status='PAID', service existence check then ignores the row count",
    detail: "OrderMapper#cancelById / OrderService#cancel",
  });
  checks.push({
    ok: !existsSync(abs("demo/buggy-shop-boot-vue/backend/src/main/java/com/example/shop/store/InMemoryOrderStore.java")),
    label: "InMemoryOrderStore removed (single DB fact source)",
    detail: "absent",
  });
  checks.push({
    ok: existsSync(abs("demo/buggy-shop-boot-vue/backend/src/main/resources/schema.sql")) &&
      existsSync(abs("demo/buggy-shop-boot-vue/backend/src/main/resources/data.sql")) &&
      /CREATE TABLE IF NOT EXISTS orders/.test(readFileSync(abs("demo/buggy-shop-boot-vue/backend/src/main/resources/schema.sql"), "utf8")) &&
      /'CREATED'/.test(readFileSync(abs("demo/buggy-shop-boot-vue/backend/src/main/resources/data.sql"), "utf8")),
    label: "schema.sql/data.sql present with the CREATED seed",
    detail: "resources/schema.sql + data.sql",
  });

  /* -------- one schema copy, loopback collector, mirrors, data hygiene -------- */
  const schemaCopies = walk(abs("."), { skip: new Set(["node_modules", ".git", "target", "dist", "work"]) })
    .filter((file) => path.basename(file) === "traceboard.event.v1.json");
  checks.push({
    ok: schemaCopies.length === 1 && relOf(schemaCopies[0]) === SCHEMA_REL,
    label: "exactly one schema copy in the repository (no second schema)",
    detail: schemaCopies.map(relOf).join(","),
  });
  const appYml = readFileSync(abs("server/collector/src/main/resources/application.yml"), "utf8");
  checks.push({
    ok: /address:\s*127\.0\.0\.1/.test(appYml) && /port:\s*8601/.test(appYml) && !/0\.0\.0\.0/.test(appYml),
    label: "collector binds 127.0.0.1:8601 only",
    detail: "application.yml loopback",
  });
  const mirrorHits = [];
  for (const file of ["workbench/package-lock.json", "demo/buggy-shop-boot-vue/frontend/package-lock.json", "tools/verify/package-lock.json", "frontend/sdk/package-lock.json"]) {
    const text = readFileSync(abs(file), "utf8");
    for (const match of text.matchAll(/"resolved":\s*"([^"]+)"/g)) {
      const host = (match[1].match(/^https?:\/\/([^/]+)/) ?? [])[1] ?? "";
      if (host && host !== "registry.npmjs.org") mirrorHits.push(`${file} -> ${host}`);
    }
  }
  const npmrcFiles = [...walk(abs("."), { skip: new Set(["node_modules", ".git", "target", "dist", "work"]) })]
    .filter((file) => path.basename(file) === ".npmrc");
  checks.push({
    ok: mirrorHits.length === 0 && npmrcFiles.length === 0,
    label: "no third-party npm mirrors (.npmrc absent, all resolved hosts = registry.npmjs.org)",
    detail: mirrorHits.length ? mirrorHits.slice(0, 4).join(" | ") : "official registry only",
  });
  const pomTexts = ["pom.xml", "agent/pom.xml", "server/collector/pom.xml", "demo/buggy-shop-boot-vue/backend/pom.xml"]
    .filter((rel) => existsSync(abs(rel)))
    .map((rel) => readFileSync(abs(rel), "utf8"));
  checks.push({
    ok: pomTexts.every((text) => !/<repository>|<mirror>|<pluginRepository>/.test(text)),
    label: "no custom Maven repository/mirror in poms (Maven Central default)",
    detail: "none",
  });
  const fixtureText = readFileSync(abs(S2_EVENTS_REL), "utf8") + readFileSync(abs(S1_BATCH_REL), "utf8") +
    readFileSync(abs(S1_AGENT_SPAN_REL), "utf8") + readFileSync(abs(S3_CASE_A_EVENTS), "utf8") +
    readFileSync(abs(S3_CASE_B_EVENTS), "utf8");
  checks.push({
    ok: !/[\w.+-]+@[\w-]+\.[\w.]+/.test(fixtureText) && !/\b1[3-9]\d{9}\b/.test(fixtureText),
    label: "fixtures (incl. S3) contain no email/phone-like real data",
    detail: "none",
  });

  gate(
    "S2-8",
    "S4/S5/S6a/S6b migration: 9 business routes + 5 Byte Buddy types / 11 advices exactly (handshake is handwritten HttpURLConnection), L2 only in the S6a/S6b L2 files, no persistence/stream, H2 embedded only, no secrets/mirrors",
    checks,
    `grep -rnE "EventSource|WebSocket|JdbcTemplate|SseEmitter" agent/src server/collector/src workbench/src demo/buggy-shop-boot-vue/backend/src`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-10 cleanup (S2-9 re-migrated to the S3 whitelist)                */
/* ------------------------------------------------------------------ */

function checkS3Cleanup() {
  section("S3-10 cleanup");
  const checks = [];
  for (const port of S1_PORTS) {
    const state = listeningOn(port);
    checks.push({
      ok: state.supported && state.lines.length === 0,
      label: `port ${port} not LISTENING`,
      detail: state.lines.join(" | ") || "free",
    });
  }

  const nowPids = javaPids();
  const leftover = nowPids.filter((pid) => !BASELINE.javaPids.includes(pid));
  checks.push({
    ok: leftover.length === 0,
    label: "no java.exe process left behind by this run (collector/demo/Vite stopped)",
    detail: leftover.length ? `pids=${leftover.join(",")}` : `none (baseline=${BASELINE.javaPids.join(",") || "0"})`,
  });

  const status = gitStatusLines();
  // S4 whitelist (dispatch-amendment §8 / s4-plan §12.1): product dirs changed in S3/S4, the 9
  // expected demo-frontend files, contracts/S3/S4 fixtures+guides+docs, and the tester paths.
  // schema/S0–S2 fixtures/demo backend/status-semantics/S0 docs stay forbidden.
  const allowedExact = new Set([
    ...S3_DEMO_EXPECTED_FILES,
    ...S5_DEMO_BACKEND_ALLOWED,
    "pom.xml",
    "README.md",
    ".gitattributes",
    "docs/contracts/api.v1.md",
    "docs/contracts/transport.v1.md",
    "docs/contracts/event-model.v1.md",
  ]);
  const allowedPrefixes = [
    "agent/",
    "server/",
    "workbench/",
    "frontend/",
    "docs/guides/",
    "docs/plans/stages/S1/",
    "docs/plans/stages/S2/",
    "docs/plans/stages/S3/",
    "docs/plans/stages/S4/",
    "docs/plans/stages/S5/",
    "docs/plans/stages/S6/",
    "fixtures/s1-walking-skeleton/",
    "fixtures/s2-zero-row-chain/",
    "fixtures/s3-frontend-facts/",
    "fixtures/s4-details/",
    "fixtures/s5-l1-values/",
    "fixtures/s6-l2-lines/",
    "tools/verify/",
    "tools/perf/",
  ];
  const forbiddenPrefixes = [
    "schema/",
    "fixtures/case-a-zero-rows/",
    "demo/buggy-shop-boot-vue/backend/",
    "docs/plans/stages/S0/",
  ];
  const forbiddenExact = [
    "docs/contracts/status-semantics.md",
    "docs/plans/00-master-plan.md",
    "docs/plans/SOLO-PLAN.md",
  ];
  const pathMatches = (rel, entry) => (entry.endsWith("/") ? rel.startsWith(entry) : rel === entry);
  const backendAllowed = new Set(S5_DEMO_BACKEND_ALLOWED);
  const forbiddenCheck = (rel) =>
    (forbiddenPrefixes.some((entry) => pathMatches(rel, entry)) &&
      !(rel.startsWith("demo/buggy-shop-boot-vue/backend/") && backendAllowed.has(rel))) ||
    forbiddenExact.includes(rel);
  const unexpected = [];
  const forbiddenHits = [];
  const staged = [];
  const statusRels = [];
  for (const line of status.lines) {
    const index = `${line[0] ?? " "}${line[1] ?? " "}`;
    const rel = line.slice(3).trim().replace(/^"|"$/g, "").split("\\").join("/");
    statusRels.push(rel);
    if (index[0] !== " " && index[0] !== "?") staged.push(line);
    const allowed = allowedExact.has(rel) || allowedPrefixes.some((entry) => pathMatches(rel, entry));
    if (!allowed) unexpected.push(line);
    if (forbiddenCheck(rel)) {
      forbiddenHits.push(line);
    }
  }
  checks.push({
    ok: status.ok && forbiddenHits.length === 0,
    label: "no git change under frozen paths (schema, case-A/S1/S2/S3/S4 fixtures, demo backend outside the 4 S5 files, S0 docs, status-semantics)",
    detail: forbiddenHits.slice(0, 4).join(" | ") || "none",
  });
  checks.push({
    ok: status.ok && unexpected.length === 0,
    label: "git status only shows the S6a whitelist (product dirs incl. server/launcher + 9 demo-frontend files + 5 demo-backend L1/L2 files, S3/S4/S5/S6a fixtures/guides/contracts/docs, frontend/build-plugin, tools/verify+perf)",
    detail: unexpected.slice(0, 4).join(" | ") || `${status.lines.length} expected entries`,
  });
  checks.push({
    ok: status.ok && staged.length === 0,
    label: "git index untouched (no staged entries)",
    detail: staged.slice(0, 4).join(" | ") || "all changes untracked/unstaged",
  });
  const changedDemoFrontend = statusRels.filter((rel) => rel.startsWith(`${S3_DEMO_FRONTEND_REL}/`));
  const unexpectedDemoFrontend = changedDemoFrontend.filter((rel) => !S3_DEMO_EXPECTED_FILES.includes(rel));
  checks.push({
    ok: status.ok && unexpectedDemoFrontend.length === 0,
    label: "demo frontend: only the 9 S3-expected files changed (src/App.vue, src/main.ts, src/traceboard.ts, style, configs, lockfile)",
    detail: unexpectedDemoFrontend.length
      ? `unexpected=${unexpectedDemoFrontend.slice(0, 4).join(" | ")}`
      : `changed=${changedDemoFrontend.length}: ${changedDemoFrontend.join(",")}`,
  });

  /* ---------------- demo frontend: the S3 SDK integration is the expected change ---------------- */
  const demoFrontendSources = existsSync(abs(`${S3_DEMO_FRONTEND_REL}/src`))
    ? walk(abs(`${S3_DEMO_FRONTEND_REL}/src`)).map((file) => ({ rel: relOf(file), text: readFileSync(file, "utf8") }))
    : [];
  const demoCodeFiles = demoFrontendSources.filter((file) => /\.(ts|vue|js)$/i.test(file.rel));
  const demoCode = demoCodeFiles.map((file) => stripComments(file.text)).join("\n");
  const fetchTargets = [];
  for (const file of demoCodeFiles) {
    for (const match of stripComments(file.text).matchAll(/fetch\(\s*["'`]([^"'`]+)/g)) {
      fetchTargets.push({ rel: file.rel, target: match[1] });
    }
  }
  const nonApiFetches = fetchTargets.filter((item) => !item.target.startsWith("/api/"));
  const directCollector = /:8601\b|127\.0\.0\.1/.test(demoCode);
  const absoluteUrls = [...demoCode.matchAll(/["'`]https?:\/\//g)].length;
  checks.push({
    ok: fetchTargets.length > 0 && nonApiFetches.length === 0 && !directCollector && absoluteUrls === 0 &&
      demoCode.includes("initTraceBoard(") && demoCode.includes('"s_s3demo"') &&
      demoCode.includes('ingestUrl: "/ingest"') && demoCode.includes('wrapFn("validateForm"'),
    label: "demo frontend S3: SDK init (s_s3demo,/ingest), only /api business fetches, no direct :8601/absolute URL",
    detail: `fetches=${[...new Set(fetchTargets.map((item) => item.target))].join(",")} directCollector=${directCollector} absoluteUrls=${absoluteUrls}`,
  });
  const demoPush = /new\s+EventSource|new\s+WebSocket|sendBeacon/.test(demoCode);
  checks.push({
    ok: !demoPush,
    label: "demo frontend has no SSE/WebSocket/beacon channel",
    detail: demoPush ? "push channel found" : "none",
  });

  // Verifier outputs only (V8d already proves the product snapshot is unchanged).
  const snapshotNow = sourceSnapshot();
  const touched = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) touched.push(rel);
  }
  checks.push({
    ok: touched.length === 0,
    label: "no product file modified by this verify run (only build outputs / verify outputs changed)",
    detail: touched.length ? touched.slice(0, 5).join(",") : `${Object.keys(SNAPSHOT).length} product files stable`,
  });

  gate(
    "S3-10",
    "cleanup: ports free (incl. 8602/18080), no java leftovers, git index untouched, git status within the S5 whitelist, product files stable",
    checks,
    `netstat -ano | grep -E ":(${S1_PORTS.join("|")})\\s" ; tasklist | grep -i java ; git status --porcelain`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-1 builds                                                         */
/* ------------------------------------------------------------------ */

function checkS3Builds(validate) {
  section("S3-1 builds: SDK (ci/build/test), demo frontend, workbench, JDK21/JDK8, agent 52");
  const checks = [];
  const sdkCi = runShell("npm ci", { cwd: abs(SDK_DIR), timeout: 600000 });
  const sdkBuild = runShell("npm run build", { cwd: abs(SDK_DIR), timeout: 600000 });
  const sdkTest = runShell("npm test", { cwd: abs(SDK_DIR), timeout: 600000 });
  S3_EVIDENCE.sdkTestStdout = sdkTest.stdout ?? "";
  S3_EVIDENCE.sdkTestStderr = sdkTest.stderr ?? "";
  const testOut = `${sdkTest.stdout}\n${sdkTest.stderr}`;
  const testsMatch = testOut.match(/# tests (\d+)/);
  const passMatch = testOut.match(/# pass (\d+)/);
  const failMatch = testOut.match(/# fail (\d+)/);

  checks.push({
    ok: sdkCi.code === 0 && !sdkCi.error,
    label: "frontend/sdk npm ci",
    detail: `exit=${sdkCi.code} ${lastLines(`${sdkCi.stdout}\n${sdkCi.stderr}`, 1).join(" ")}`,
  });
  checks.push({
    ok: sdkBuild.code === 0 && !sdkBuild.error,
    label: "frontend/sdk npm run build (tsc -> ESM + .d.ts)",
    detail: `exit=${sdkBuild.code} ${lastLines(`${sdkBuild.stdout}\n${sdkBuild.stderr}`, 1).join(" ")}`,
  });
  checks.push({
    ok: sdkTest.code === 0 && testsMatch?.[1] === "17" && passMatch?.[1] === "17" && failMatch?.[1] === "0",
    label: "frontend/sdk npm test -> node --test: 17 tests / 17 pass / 0 fail (S5 manifest/source cases included)",
    detail: `tests=${testsMatch?.[1] ?? "?"} pass=${passMatch?.[1] ?? "?"} fail=${failMatch?.[1] ?? "?"}`,
  });

  const sdkDist = walk(abs(SDK_DIST_REL));
  checks.push({
    ok: deepEqual(sdkDist.map(relOf).sort(), [
      `${SDK_DIST_REL}/index.d.ts`,
      `${SDK_DIST_REL}/index.js`,
      `${SDK_DIST_REL}/traceboard-sdk.iife.js`,
    ]),
    label: "SDK dist contains exactly index.js + index.d.ts + traceboard-sdk.iife.js (no sourcemap, no build plugin output)",
    detail: sdkDist.map(relOf).join(","),
  });
  checks.push({
    ok: sdkDist.every((file) => !file.endsWith(".map")),
    label: "SDK dist has no *.map sourcemap",
    detail: "0 maps",
  });
  const sdkPkg = JSON.parse(readFileSync(abs(`${SDK_DIR}/package.json`), "utf8"));
  checks.push({
    ok: SDK_REQUIRED_SCRIPTS.every((name) => typeof sdkPkg.scripts?.[name] === "string") &&
      deepEqual(Object.keys(sdkPkg.devDependencies ?? {}).sort(), ["esbuild", "typescript"]) &&
      Object.keys(sdkPkg.dependencies ?? {}).length === 0 &&
      /build:iife/.test(String(sdkPkg.scripts?.build)) && /--global-name=TraceBoardSDK/.test(String(sdkPkg.scripts?.["build:iife"])) &&
      /iife\.test\.js/.test(String(sdkPkg.scripts?.test)) && /sdk\.test\.js/.test(String(sdkPkg.scripts?.test)),
    label: "SDK package.json: build (tsc + esbuild IIFE) + test scripts, devDependencies esbuild+typescript only, no runtime deps/CDN",
    detail: `dev=${Object.keys(sdkPkg.devDependencies ?? {}).join(",")} scripts=${Object.keys(sdkPkg.scripts ?? {}).join(",")}`,
  });
  const sdkIife = readFileSync(abs(S4_SDK_IIFE_REL), "utf8");
  checks.push({
    ok: sdkIife.includes("var TraceBoardSDK") && sdkIife.includes("version = \"0.1.0\"") &&
      sdkIife.includes("__TRACEBOARD_CONFIG__") && sdkIife.includes("__TRACEBOARD_AUTO_INIT__") &&
      sdkIife.includes("__TRACEBOARD_SDK_ACTIVE__") && !sdkIife.includes("sourceMappingURL") &&
      !/https:\/\//.test(sdkIife) && !/jsdelivr|unpkg|cdnjs/.test(sdkIife),
    label: "SDK IIFE bundle: TraceBoardSDK global + version, config/guard hooks, no sourceMappingURL/CDN/https",
    detail: `${Buffer.byteLength(sdkIife, "utf8")} bytes`,
  });
  const sdkTsconfig = JSON.parse(readFileSync(abs(`${SDK_DIR}/tsconfig.json`), "utf8"));
  checks.push({
    ok: sdkTsconfig.compilerOptions?.sourceMap === false && sdkTsconfig.compilerOptions?.declaration === true,
    label: "SDK tsconfig: declaration=true, sourceMap=false (no L2/sourcemap)",
    detail: `sourceMap=${sdkTsconfig.compilerOptions?.sourceMap}`,
  });

  checks.push({
    ok: resultById("V2d-1")?.ok === true && resultById("V2d-2")?.ok === true,
    label: "demo frontend npm ci + npm run build exit 0 (see V2d-1/V2d-2)",
    detail: "ok",
  });
  const demoPkg = JSON.parse(readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/package.json`), "utf8"));
  checks.push({
    ok: demoPkg.dependencies?.["@traceboard/sdk"] === "file:../../../frontend/sdk",
    label: "demo frontend depends on the SDK via a local file: dependency (no registry/CDN package)",
    detail: String(demoPkg.dependencies?.["@traceboard/sdk"]),
  });
  const demoVite = readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/vite.config.ts`), "utf8");
  const proxyCount = (name, target) =>
    (demoVite.match(new RegExp(`["']${name}["']\\s*:\\s*\\{[\\s\\S]*?target:\\s*${target}`, "g")) ?? []).length;
  checks.push({
    ok: /collectorTarget\s*=\s*"http:\/\/127\.0\.0\.1:8601"/.test(demoVite) &&
      /backendTarget\s*=\s*"http:\/\/127\.0\.0\.1:8080"/.test(demoVite) &&
      proxyCount("/ingest", "collectorTarget") === 2 && proxyCount("/api", "backendTarget") === 2 &&
      !/0\.0\.0\.0/.test(demoVite) && /alias:\s*\{[\s\S]*@traceboard\/sdk/.test(demoVite) &&
      /import traceboardShallow from "\.\.\/\.\.\/\.\.\/frontend\/build-plugin\/index\.mjs"/.test(demoVite) &&
      /plugins:\s*\[vue\(\),\s*traceboardShallow\(\)\]/.test(demoVite) && /sourcemap:\s*true/.test(demoVite) &&
      !/0\.0\.0\.0/.test(demoVite),
    label: "demo vite: /ingest->8601 + /api->8080 in dev+preview, SDK alias, vue()+traceboardShallow(), build.sourcemap=true",
    detail: `ingestProxies=${proxyCount("/ingest", "collectorTarget")} apiProxies=${proxyCount("/api", "backendTarget")}`,
  });
  const demoTsconfig = readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/tsconfig.json`), "utf8");
  checks.push({
    ok: demoTsconfig.includes('"@traceboard/sdk"') && demoTsconfig.includes("frontend/sdk/src/index.ts"),
    label: "demo tsconfig maps @traceboard/sdk to frontend/sdk/src/index.ts (vue-tsc build passes)",
    detail: "paths configured",
  });

  const demoDist = distTextFiles(DEMO_DIST_REL);
  const demoDistText = demoDist.map((file) => file.text).join("\n");
  const demoTokens = [
    "amount-b", "btn-save-b", "金额必须大于 0", "校验通过（本案例不提交）",
    "traceparent", "X-TraceBoard-Click", "s_s3demo",
    // S6b migration (§10): the canonical S6 banner replaces the old S6a banner; async/loop
    // buttons are now part of the demo surface (no stale "S6a" literal is required any more).
    S6_BANNER,
    "__TRACEBOARD_MANIFEST__", "previewDiscount",
    "#btn-reconcile", "reconcileBatch", "reconcileAmount", "S6", "L2",
    "btn-reconcile-async", "btn-reconcile-loop",
  ];
  for (const token of demoTokens) {
    checks.push({
      ok: demoDistText.includes(token),
      label: `demo dist contains "${token}"`,
      detail: demoDist.filter((file) => file.text.includes(token)).map((file) => file.rel).join(",") || "not found",
    });
  }
  // S5 migration: demo build.sourcemap=true is allowed (dist only, gitignored) and the shallow
  // plugin must emit traceboard-manifest.json; the SDK still goes through the /ingest proxy.
  const demoDistAll = walk(abs(DEMO_DIST_REL));
  const demoMaps = demoDistAll.filter((file) => file.endsWith(".map"));
  const demoManifestAbs = abs(`${DEMO_DIST_REL}/traceboard-manifest.json`);
  const demoManifest = existsSync(demoManifestAbs) ? JSON.parse(readFileSync(demoManifestAbs, "utf8")) : null;
  checks.push({
    ok: demoDist.length > 0 && demoMaps.length >= 1 && !/:8601\b/.test(demoDistText),
    label: "demo dist has S5 .map artifacts (build.sourcemap=true, dist-only) and no direct collector port (SDK goes through the /ingest proxy)",
    detail: `${demoDistAll.length} dist files, ${demoMaps.length} map(s)`,
  });
  checks.push({
    ok: demoManifest !== null && Array.isArray(demoManifest.functions) &&
      demoManifest.functions.some((fn) => fn?.name === "previewDiscount" && fn.file === "src/App.vue" &&
        Number.isInteger(fn.line) && fn.line >= 1),
    label: "demo dist traceboard-manifest.json lists previewDiscount with file/line",
    detail: demoManifest ? `${demoManifest.functions.length} functions` : "manifest missing",
  });
  const demoAppText = readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/src/App.vue`), "utf8");
  const demoTraceboardText = readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/src/traceboard.ts`), "utf8");
  checks.push({
    ok: demoTraceboardText.includes("initTraceBoard(") && demoTraceboardText.includes('ingestUrl: "/ingest"') &&
      demoTraceboardText.includes('sessionId: "s_s3demo"') && demoTraceboardText.includes('appName: "OrderEdit.vue"') &&
      demoAppText.includes('fetch("/api/orders/1/cancel", { method: "POST" })') &&
      demoAppText.includes('traceboard.uiEffect("操作成功")') && demoAppText.includes("showSuccess.value = true") &&
      demoAppText.includes("await loadOrders()") && demoAppText.includes('traceboard.wrapFn("validateForm"') &&
      demoAppText.includes("金额必须大于 0") && demoAppText.includes("校验通过（本案例不提交）") &&
      demoAppText.includes("故意缺陷") && demoAppText.includes("UPDATE 0 行"),
    label: "demo source: SDK init s_s3demo, case A unchanged (2xx toast + refresh + uiEffect), case B wrapFn + zero-request copy, honest banner",
    detail: "App.vue/traceboard.ts",
  });

  checks.push({
    ok: resultById("V2c-1")?.ok === true && resultById("V2c-2")?.ok === true,
    label: "workbench npm ci + npm run build exit 0 (see V2c-1/V2c-2)",
    detail: "ok",
  });
  checks.push({
    ok: resultById("V2a")?.ok === true,
    label: "root reactor mvn package with JDK21 exit 0 (see V2a)",
    detail: "ok",
  });
  checks.push({
    ok: resultById("V2b")?.ok === true,
    label: "demo backend mvn package with JDK8 exit 0 (see V2b)",
    detail: "ok",
  });
  const javap = existsSync(JDK21_JAVAP)
    ? runExe(JDK21_JAVAP, ["-verbose", "-classpath", abs(AGENT_JAR_REL), "io.traceboard.agent.TraceAgent"])
    : { stdout: "" };
  const major = Number((javap.stdout.match(/major version:\s*(\d+)/) ?? [])[1]);
  checks.push({
    ok: major === 52,
    label: "agent jar compiled for Java 8 (major 52)",
    detail: `major=${Number.isNaN(major) ? "?" : major}`,
  });
  checks.push({
    ok: existsSync(JDK21_JAVA) && existsSync(JDK8_JAVA) && Boolean(validate),
    label: "JDK21 + JDK8 present; frozen schema validator available",
    detail: `${JDK21_HOME} / ${JDK8_HOME}`,
  });

  gate(
    "S3-1",
    "builds: SDK 17/17 tests + 3 dist files, demo frontend (file dep,/ingest proxy,case B,traceparent), workbench, root JDK21 (launcher), demo JDK8, agent 52",
    checks,
    `(cd "frontend/sdk" && npm ci && npm run build && npm test) && (cd "${S3_DEMO_FRONTEND_REL}" && npm ci && npm run build) && (cd "workbench" && npm ci && npm run build)`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-2 fixtures                                                       */
/* ------------------------------------------------------------------ */

function checkS3Fixtures(validate) {
  section("S3-2 fixtures + expected facts + replay windows + G1 freeze");
  const checks = [];
  const a = loadS3Case(S3_CASE_A_EVENTS, S3_CASE_A_FACTS, 7);
  const b = loadS3Case(S3_CASE_B_EVENTS, S3_CASE_B_FACTS, 3);

  for (const [label, data, count] of [["case A", a, 7], ["case B", b, 3]]) {
    checks.push({
      ok: data.meta.lines.length === count && !data.meta.hasBom && data.meta.crCount === 0 &&
        data.meta.endsWithNewline && data.meta.emptyLineCount === 0,
      label: `${label}: ${count} non-empty lines, no BOM/CR, trailing LF`,
      detail: `lines=${data.meta.lines.length} bom=${data.meta.hasBom} cr=${data.meta.crCount} lf=${data.meta.endsWithNewline}`,
    });
    checks.push({
      ok: data.parseError === null && data.events.length === count && data.factsError === null && Boolean(data.facts),
      label: `${label}: every line parses and expected-facts.json parses`,
      detail: data.parseError?.message ?? data.factsError?.message ?? `${data.events.length} events`,
    });
    const invalid = [];
    if (validate && data.events.length === count) {
      data.events.forEach((event, index) => {
        if (!validate(event)) {
          invalid.push(`line ${index + 1}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
        }
      });
    }
    checks.push({
      ok: Boolean(validate) && data.events.length === count && invalid.length === 0,
      label: `${label}: ${count}/${count} events validate against the frozen schema (Ajv 2020-12 strict)`,
      detail: invalid.length ? invalid.join(" || ") : `${data.events.length}/${count} valid`,
    });
    const factsSources = data.facts?.sources?.chain ?? {};
    checks.push({
      ok: data.facts?.caseId?.includes(label === "case A" ? "case-a-joined-chain" : "case-b-frontend-only") &&
        data.facts?.stage === "S3" && factsSources.file === (label === "case A" ? S3_CASE_A_EVENTS : S3_CASE_B_EVENTS) &&
        factsSources.lineCount === count && factsSources.eventCount === count,
      label: `${label}: expected-facts caseId/stage/source lineCount+eventCount match`,
      detail: `${data.facts?.caseId} / ${data.facts?.stage} / ${factsSources.file}`,
    });
    const assertions = data.facts?.globalAssertions?.chain ?? {};
    const evaluated = s3EvaluateAssertions(data.events, assertions);
    checks.push({
      ok: Object.keys(assertions).length > 25 && evaluated.evaluated === Object.keys(assertions).length &&
        evaluated.problems.length === 0,
      label: `${label}: globalAssertions.chain fully evaluated (${Object.keys(assertions).length} keys, no unknown keys)`,
      detail: evaluated.problems.length ? evaluated.problems.slice(0, 5).join(" || ") : `${evaluated.evaluated} keys, 0 failures`,
    });
    const factResult = s3FactProblems(data.events, data.facts ?? {});
    checks.push({
      ok: factResult.count === (label === "case A" ? 8 : 6) && factResult.problems.length === 0,
      label: `${label}: expected facts (${label === "case A" ? 8 : 6}) locate unique events and deep-equal (incl. #trace.* derived)`,
      detail: factResult.problems.length ? factResult.problems.slice(0, 5).join(" || ") : `${factResult.count} facts, 0 failures`,
    });

    const windows = Array.isArray(data.facts?.replayWindows) ? data.facts.replayWindows : [];
    // A fresh ingest into one session assigns seq 1..n in file order.
    const seqBySpanId = new Map(data.events.map((event, index) => [event.spanId, index + 1]));
    const windowProblems = [];
    for (const win of windows) {
      const window = s3ReplayWindow(data.events, win.fromNs, win.toNsIsDefault ? null : win.toNs);
      if (window.toNs !== win.toNs) windowProblems.push(`${win.id} toNs ${window.toNs}!=${win.toNs}`);
      if (window.events.length !== win.count) windowProblems.push(`${win.id} count ${window.events.length}!=${win.count}`);
      if (!deepEqual(window.events.map((event) => event.spanId), win.spanIds)) windowProblems.push(`${win.id} spanIds`);
      if (!deepEqual(window.events.map((event) => seqBySpanId.get(event.spanId)), win.seqs)) windowProblems.push(`${win.id} seqs`);
    }
    checks.push({
      ok: windows.length === (label === "case A" ? 5 : 4) && windowProblems.length === 0,
      label: `${label}: replayWindows deep-compare (default/toNs/fromNs windows, order, seqs)`,
      detail: windowProblems.length ? windowProblems.slice(0, 4).join(" || ") : `${windows.length} windows match`,
    });
  }

  /* ---------------- explicit structural facts required by S3-2 ---------------- */
  const aRoot = a.events.find((event) => event.parentSpanId === null) ?? {};
  const aFetch = a.events.find((event) => event.kind === "fetch") ?? {};
  const aController = a.events.find((event) => event.kind === "controller") ?? {};
  const aSql = a.events.find((event) => event.kind === "sql") ?? {};
  const aSqlEffect = Array.isArray(aSql.sideEffects) ? aSql.sideEffects[0] ?? {} : {};
  checks.push({
    ok: a.events.length === 7 && aRoot.kind === "ui_event" && aRoot.parentSpanId === null &&
      aController.parentSpanId === aFetch.spanId && aController.rootEventId === aRoot.rootEventId &&
      a.events.every((event) => event.confidence === "EXACT") &&
      !a.events.some((event) => (event.flags ?? []).includes("LOST_BACKEND")) &&
      aSqlEffect.rowsAffected === 0 && aSqlEffect.transaction === "UNKNOWN" &&
      a.events.every((event) => event.status === "OK"),
    label: "case A: single ui_event root, controller.parentSpanId=fetch.spanId, all EXACT/OK, SQL rows 0/UNKNOWN, no LOST_BACKEND",
    detail: `root=${aRoot.spanId} fetch=${aFetch.spanId} controller.parent=${aController.parentSpanId}`,
  });
  const bEvents = b.events;
  const bClick = bEvents.find((event) => event.kind === "ui_event" && event.parentSpanId === null) ?? {};
  const bValidate = bEvents.find((event) => event.kind === "js_method") ?? {};
  checks.push({
    ok: bEvents.length === 3 && bClick.parentSpanId === null && bValidate.status === "RETURNED_FALSE" &&
      deepEqual(bValidate.return?.value, false) && bValidate.parentSpanId === bClick.spanId &&
      !bEvents.some((event) => event.kind === "fetch") && !bEvents.some((event) => S3_BACKEND_KINDS.includes(event.kind)) &&
      bEvents.every((event) => event.confidence === "EXACT"),
    label: "case B: 3 events click->validateForm(RETURNED_FALSE)->render, zero fetch, zero backend, all EXACT",
    detail: `click=${bClick.spanId} js=${bValidate.spanId} kinds=${bEvents.map((event) => event.kind).join(",")}`,
  });

  /* ---------------- G1 freeze: S3 + S0–S2 hashes unchanged ---------------- */
  const reviewText = readFileSync(abs(S3_PLAN_REVIEW_REL), "utf8");
  checks.push({
    ok: reviewText.includes("G1: PASS"),
    label: "S3 plan-review records G1: PASS (freeze is the authority)",
    detail: "G1: PASS",
  });
  const freeze = s3FreezeSections();
  checks.push({
    ok: freeze.s3.length === 12 && freeze.legacy.length === 10,
    label: "S3 plan-review §2 records 12 S3-freeze hashes + 10 S0–S2 frozen hashes",
    detail: `s3=${freeze.s3.length} legacy=${freeze.legacy.length}`,
  });
  const hashProblems = [];
  for (const entry of [...freeze.s3, ...freeze.legacy]) {
    // S6a supersedes the S5 api/event-model hashes; everything else keeps its frozen bytes.
    const expected = LATEST_G1_FREEZE[entry.rel] ?? entry.hash;
    const actual = existsSync(abs(entry.rel)) ? sha256File(abs(entry.rel)) : "missing";
    if (actual !== expected) hashProblems.push(`${entry.rel} actual=${actual} expected=${expected}`);
  }
  checks.push({
    ok: hashProblems.length === 0,
    label: "schema, contracts (latest = S6b G1 freeze: api/event-model superseded), S3 fixtures/plan/dispatch, S0–S2 fixtures: every hash matches (bytes unchanged)",
    detail: hashProblems.length ? hashProblems.slice(0, 4).join(" || ") : `${freeze.s3.length + freeze.legacy.length} hashes match`,
  });
  const s2Freeze = s2FreezeSections();
  const s2SchemaHash = s2Freeze.s2.find((entry) => entry.rel === SCHEMA_REL)?.hash;
  checks.push({
    ok: Boolean(s2SchemaHash) && sha256File(abs(SCHEMA_REL)) === s2SchemaHash &&
      freeze.s3.find((entry) => entry.rel === SCHEMA_REL)?.hash === s2SchemaHash,
    label: "schema/traceboard.event.v1.json byte-identical to the S2 and S3 G1 baselines",
    detail: `sha256=${sha256File(abs(SCHEMA_REL))}`,
  });
  const s3DirFiles = walk(abs("fixtures/s3-frontend-facts")).map(relOf).sort();
  checks.push({
    ok: deepEqual(s3DirFiles, [
      S3_CASE_A_EVENTS, S3_CASE_A_FACTS, S3_CASE_B_EVENTS, S3_CASE_B_FACTS, S3_README_REL,
    ].sort()),
    label: "fixtures/s3-frontend-facts contains exactly README + 2 cases (no stray/leftover files)",
    detail: s3DirFiles.join(","),
  });

  gate(
    "S3-2",
    "fixtures: case A 7 / case B 3 schema-valid, chains+EXACT+SQL0+zero-fetch, expected-facts/replayWindows deep-equal, S0–S2+schema bytes unchanged",
    checks,
    `sha256sum "schema/traceboard.event.v1.json" "fixtures/s3-frontend-facts/case-a-joined-chain/events.ndjson" "fixtures/s3-frontend-facts/case-b-frontend-only/events.ndjson" ; node tools/verify/verify.mjs`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-3/S3-5 header join E2E + replay 0-write                          */
/* ------------------------------------------------------------------ */

async function checkS3E2E(validate) {
  section("S3-3 header join E2E + S3-5 replay 0-write");
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const demoJar = abs(DEMO_JAR_REL);
  const agentJar = abs(AGENT_JAR_REL);
  const caseA = loadS3Case(S3_CASE_A_EVENTS, S3_CASE_A_FACTS, 7);
  const click = caseA.events.find((event) => event.kind === "ui_event" && event.parentSpanId === null) ?? {};
  const fetchEvent = caseA.events.find((event) => event.kind === "fetch") ?? {};
  const pre8601 = listeningOn(8601);
  const pre8080 = listeningOn(8080);
  const preconditions = [
    { ok: pre8601.supported && pre8601.lines.length === 0, label: "port 8601 free", detail: pre8601.lines.join(" | ") || "no listener" },
    { ok: pre8080.supported && pre8080.lines.length === 0, label: "port 8080 free", detail: pre8080.lines.join(" | ") || "no listener" },
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(demoJar), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(agentJar), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists", detail: JDK8_JAVA },
  ];
  const reproE2E = `"${JDK8_JAVA}" -javaagent:"${AGENT_JAR_REL}" -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events -Dtraceboard.sessionId=${S3_SESSION} -jar "${DEMO_JAR_REL}"`;
  if (!preconditions.every((c) => c.ok)) {
    const evidence = preconditions.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`);
    record("S3-3", "header join E2E (preconditions)", false, evidence, reproE2E);
    record("S3-5", "replay 0-write (preconditions)", false, evidence, reproE2E);
    return;
  }

  let collector = null;
  let demo = null;
  try {
    collector = startJavaServer("collector(8601)", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!health) {
      const evidence = [{ ok: false, label: "collector health", detail: "timeout" }];
      record("S3-3", "header join E2E (collector health)", false, evidence, reproE2E);
      record("S3-5", "replay 0-write (collector health)", false, evidence, reproE2E);
      return;
    }

    const prefixLines = caseA.meta.lines.slice(0, 2);
    const prefixPost = await postNdjson("/ingest/v1/events", `${prefixLines.join("\n")}\n`, `${NDJSON}; charset=utf-8`);

    demo = startJavaServer("demo-backend(8080)+agent s_s3demo", JDK8_JAVA, [
      `-javaagent:${agentJar}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      `-Dtraceboard.sessionId=${S3_SESSION}`,
      "-jar",
      demoJar,
    ], abs("demo/buggy-shop-boot-vue/backend"));
    const ordersBefore = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    const ordersBeforeBody = ordersBefore ? parseJson(ordersBefore.text) : { ok: false };
    const seedRows = ordersBeforeBody.ok && Array.isArray(ordersBeforeBody.value?.data) ? ordersBeforeBody.value.data : [];
    const seed = seedRows[0] ?? {};

    /* -------- S3-3 valid headers -> EXACT join -------- */
    const traceparent = `00-${click.traceId}-${fetchEvent.spanId}-01`;
    const cancelWithHeaders = await tryRequest(8080, "/api/orders/1/cancel", {
      method: "POST",
      headers: { traceparent, "X-TraceBoard-Click": click.rootEventId },
    });
    const cancelWithHeadersBody = cancelWithHeaders.ok ? parseJson(cancelWithHeaders.text) : { ok: false };
    const pollJoin = await pollUntil(async () => {
      const page = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && spans.length >= 6 ? { page, spans } : null;
    }, 15000, 400);
    await sleep(800);
    const pageJoin = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
    const spansJoin = Array.isArray(pageJoin.value.events) ? pageJoin.value.events.map((entry) => entry.event) : [];
    const traceSpans = sortedByStart(spansJoin.filter((span) => span.traceId === click.traceId));
    const backendSpans = traceSpans.filter((span) => S3_BACKEND_KINDS.includes(span.kind));
    const [s3controller, s3service, s3mapper, s3sql] = backendSpans;
    const joinSchemaBad = validate ? spansJoin.filter((span) => !validate(span)).map((span) => span.spanId) : ["validator missing"];
    const joinLostBackend = spansJoin.filter((span) => (span.flags ?? []).includes("LOST_BACKEND"));

    const reqJoinRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/requests`);
    const reqJoinParsed = reqJoinRes.ok ? parseJson(reqJoinRes.text) : { ok: false };
    const reqJoinBody = reqJoinParsed.ok ? reqJoinParsed.value ?? {} : {};
    const reqJoinRows = Array.isArray(reqJoinBody.requests) ? reqJoinBody.requests : [];
    const reqJoin = reqJoinRows.find((row) => row.traceId === click.traceId) ?? {};

    const graphJoinRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/graph?traceId=${click.traceId}`);
    const graphJoinParsed = graphJoinRes.ok ? parseJson(graphJoinRes.text) : { ok: false };
    const graphJoin = graphJoinParsed.ok ? graphJoinParsed.value ?? {} : {};
    const graphJoinEdges = Array.isArray(graphJoin.edges) ? graphJoin.edges : [];
    const edgePairs = graphJoinEdges.map((edge) => `${edge.from}>${edge.to}`);
    const expectedPairs = traceSpans.length === 6
      ? [
        `${traceSpans[0].spanId}>${traceSpans[1].spanId}`,
        `${traceSpans[1].spanId}>${traceSpans[2].spanId}`,
        `${traceSpans[2].spanId}>${traceSpans[3].spanId}`,
        `${traceSpans[3].spanId}>${traceSpans[4].spanId}`,
        `${traceSpans[4].spanId}>${traceSpans[5].spanId}`,
      ]
      : ["chain incomplete"];

    const s3Checks = [
      {
        ok: prefixPost.ok && prefixPost.status === 202 && parseJson(prefixPost.text).value?.accepted === 2,
        label: "ingest case-A click+fetch (first 2 lines) -> 202 accepted=2",
        detail: show(prefixPost.text),
      },
      {
        ok: Boolean(ordersBefore) && ordersBeforeBody.ok && seed.id === 1 && seed.status === "CREATED" && seed.amount === 100,
        label: "demo + agent s_s3demo started; GET /api/orders seed id=1 CREATED 100",
        detail: ordersBefore ? show(ordersBefore.text) : "timeout",
      },
      {
        ok: /sessionId=s_s3demo/.test(demo.log.text) && /transformed com\.example\.shop\.controller\.OrderController/.test(demo.log.text),
        label: "agent premain installed with -Dtraceboard.sessionId=s_s3demo and controller instrumented",
        detail: (demo.log.text.split(/\r?\n/).find((line) => line.includes("premain installed")) ?? "premain line missing").slice(0, 240),
      },
      {
        ok: cancelWithHeaders.ok && cancelWithHeaders.status === 200 && deepEqual(cancelWithHeadersBody.value, { data: true }),
        label: `POST cancel with traceparent 00-<traceId>-<fetchSpanId>-01 + X-TraceBoard-Click -> 200 {data:true}`,
        detail: show(cancelWithHeaders.text),
      },
      {
        ok: Boolean(pollJoin) && traceSpans.length === 6 && backendSpans.length === 4 && spansJoin.length === 6,
        label: "exactly 6 spans on the SDK trace (click+fetch + 4 backend), no extra events",
        detail: pollJoin ? `trace=${traceSpans.length} backend=${backendSpans.length} session=${spansJoin.length}` : "timeout",
      },
      {
        ok: backendSpans.map((span) => span.kind).join(",") === "controller,service,mapper,sql",
        label: "4 new backend spans: controller -> service -> mapper -> sql (startNs order)",
        detail: backendSpans.map((span) => `${span.kind}:${span.spanId}`).join(" "),
      },
      {
        ok: s3controller?.parentSpanId === fetchEvent.spanId && s3controller?.nodeKey === S3_CONTROLLER_NODE_KEY &&
          s3service?.parentSpanId === s3controller?.spanId && s3mapper?.parentSpanId === s3service?.spanId &&
          s3sql?.parentSpanId === s3mapper?.spanId,
        label: "controller.parentSpanId = fetch spanId (header parent-id); service/mapper/sql inherit the exact chain",
        detail: `controller.parent=${s3controller?.parentSpanId} fetch=${fetchEvent.spanId}`,
      },
      {
        ok: traceSpans.length > 0 && traceSpans.every((span) => span.traceId === click.traceId) &&
          traceSpans.every((span) => span.rootEventId === click.rootEventId) && s3controller?.rootEventId === click.rootEventId,
        label: "same traceId + rootEventId (real clickId) across click/fetch/backend; controller.rootEventId=clickId",
        detail: `trace=${click.traceId} root=${click.rootEventId}`,
      },
      {
        ok: backendSpans.length === 4 && backendSpans.every((span) => span.confidence === "EXACT") &&
          (s3controller?.flags ?? []).includes(S3_FLAG_EXACT_LINK) && joinLostBackend.length === 0,
        label: "controller/service/mapper/sql confidence=EXACT, controller flag S3_EXACT_LINK, no LOST_BACKEND anywhere",
        detail: `flags=${show(s3controller?.flags)} lostBackend=${joinLostBackend.length}`,
      },
      {
        ok: backendSpans.length === 4 && backendSpans.every((span) => span.status === "OK") &&
          spansJoin.every((span) => span.status !== "THREW"),
        label: "all backend spans status OK; no THREW in the session",
        detail: backendSpans.map((span) => span.status).join(","),
      },
      {
        ok: s3controller?.return?.type === S2_RESPONSE_ENTITY_TYPE && s3controller?.return?.value === 200 &&
          deepEqual(s3service?.return, { type: "boolean", value: true }) &&
          deepEqual(s3mapper?.return, { type: "int", value: 0 }) && s3sql?.return === null &&
          deepEqual(s3sql?.sideEffects?.[0], { type: "sql", sqlId: S3_SQL_NODE_KEY, rowsAffected: 0, transaction: "UNKNOWN" }),
        label: "0-row facts unchanged: controller 200, service true, mapper 0, sql rowsAffected 0/transaction UNKNOWN",
        detail: `controller=${show(s3controller?.return)} service=${show(s3service?.return)} mapper=${show(s3mapper?.return)} sql=${show(s3sql?.sideEffects)}`,
      },
      {
        // event-model.v1.md §12.7/§405: interval containment is asserted with the contract's
        // testing tolerance (<=1s) on runtime chains, because the agent anchors startNs at
        // context entry while durNs starts at advice entry (a cold-path gap of a few us).
        ok: backendSpans.length === 4 && backendSpans.every((span, index) =>
          index === 0 || (span.startNs >= backendSpans[index - 1].startNs - 1_000_000_000 &&
            span.startNs + span.durNs <= backendSpans[index - 1].startNs + backendSpans[index - 1].durNs + 1_000_000_000)),
        label: "backend spans ordered+contained controller <= service <= mapper <= sql (contract <=1s test tolerance)",
        detail: backendSpans.map((span) => `[${span.startNs},${span.durNs}]`).join(" "),
      },
      {
        ok: backendSpans.length === 4 && backendSpans.every((span) => span.startNs > 1.6e18) &&
          s3controller?.startNs > fetchEvent.startNs,
        label: "S3 clock: agent startNs are epoch nanoseconds; controller starts after the SDK fetch",
        detail: `controller.startNs=${s3controller?.startNs} fetch.startNs=${fetchEvent.startNs}`,
      },
      {
        ok: joinSchemaBad.length === 0,
        label: "all runtime spans (SDK-injected + agent) validate against the frozen schema",
        detail: joinSchemaBad.length ? joinSchemaBad.join(",") : "6/6 valid",
      },
      {
        ok: reqJoinRes.ok && reqJoinRes.status === 200 && reqJoinBody.sdkActive === true &&
          reqJoin.confidence === "EXACT" && reqJoin.rootKind === "ui_event" && reqJoin.nodeKey === "#btn-cancel" &&
          reqJoin.status === "OK" && reqJoin.hasError === false && (reqJoin.fetchCount ?? 0) >= 1 &&
          reqJoin.hasBackend === true && (reqJoin.backendSpanCount ?? 0) >= 4 && (reqJoin.spanCount ?? 0) >= 6 &&
          reqJoin.hasFrontend === true,
        label: "requests: EXACT, fetchCount>=1, hasBackend, backendSpanCount>=4, spanCount>=6, sdkActive=true",
        detail: show(reqJoin),
      },
      {
        ok: graphJoinRes.ok && graphJoinRes.status === 200 && graphJoin.confidence === "EXACT" &&
          graphJoin.rootEventId === click.rootEventId && Array.isArray(graphJoin.nodes) && graphJoin.nodes.length >= 6 &&
          edgePairs.length === 5 && deepEqual([...edgePairs].sort(), [...expectedPairs].sort()),
        label: "graph joins click -> fetch -> controller -> service -> mapper -> sql on the same trace",
        detail: edgePairs.join(" "),
      },
    ];
    S3_EVIDENCE.caseA = { ...(S3_EVIDENCE.caseA ?? {}), joinRequestsRow: reqJoin, joinGraphEdges: edgePairs };

    /* -------- S3-3 no headers -> S2 LOST 4-span -------- */
    async function pollSpanCount(target) {
      return pollUntil(async () => {
        const page = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
        const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
        return page.res.ok && spans.length >= target ? spans : null;
      }, 15000, 400);
    }
    const cancelNoHeader = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" });
    const noHeaderSpans = await pollSpanCount(10);
    await sleep(600);
    const pageNoHeader = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
    const allNoHeader = Array.isArray(pageNoHeader.value.events) ? pageNoHeader.value.events.map((entry) => entry.event) : [];
    const groupsNoHeader = groupByTrace(allNoHeader).filter((group) => group.traceId !== click.traceId);
    const noHeaderChain = chainProblems(groupsNoHeader[0]?.spans ?? [], { sessionId: S3_SESSION });

    const badClickHeaders = { traceparent, "X-TraceBoard-Click": "click_bad" };
    const cancelBadClick = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST", headers: badClickHeaders });
    await pollSpanCount(14);
    await sleep(600);
    const pageBadClick = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
    const allBadClick = Array.isArray(pageBadClick.value.events) ? pageBadClick.value.events.map((entry) => entry.event) : [];
    const groupsBadClick = groupByTrace(allBadClick).filter((group) => group.traceId !== click.traceId &&
      !groupsNoHeader.some((known) => known.traceId === group.traceId));
    const badClickChain = chainProblems(groupsBadClick[0]?.spans ?? [], { sessionId: S3_SESSION });

    const zeroTraceHeaders = { traceparent: `00-${"0".repeat(32)}-${fetchEvent.spanId}-01`, "X-TraceBoard-Click": click.rootEventId };
    const cancelZeroTrace = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST", headers: zeroTraceHeaders });
    const finalSpansPoll = await pollSpanCount(18);
    await sleep(800);
    const pageFinal = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
    const allFinal = Array.isArray(pageFinal.value.events) ? pageFinal.value.events.map((entry) => entry.event) : [];
    const knownLost = [...groupsNoHeader, ...groupsBadClick].map((group) => group.traceId);
    const groupsZero = groupByTrace(allFinal).filter((group) => group.traceId !== click.traceId && !knownLost.includes(group.traceId));
    const zeroTraceChain = chainProblems(groupsZero[0]?.spans ?? [], { sessionId: S3_SESSION });

    const headerCounter = /header_unreadable=\d+ reason=missing/.test(demo.log.text) &&
      /header_unreadable=\d+ reason=invalid/.test(demo.log.text);

    const reqFinalRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/requests`);
    const reqFinalParsed = reqFinalRes.ok ? parseJson(reqFinalRes.text) : { ok: false };
    const reqFinalBody = reqFinalParsed.ok ? reqFinalParsed.value ?? {} : {};
    const reqFinalRows = Array.isArray(reqFinalBody.requests) ? reqFinalBody.requests : [];
    const reqFinalLost = reqFinalRows.filter((row) => row.confidence === "LOST");
    const reqFinalExact = reqFinalRows.filter((row) => row.confidence === "EXACT");

    s3Checks.push(
      {
        ok: cancelNoHeader.ok && cancelNoHeader.status === 200 && deepEqual(parseJson(cancelNoHeader.text).value, { data: true }) &&
          Boolean(noHeaderSpans) && groupsNoHeader.length === 1 && groupsNoHeader[0].spans.length === 4 && noHeaderChain.length === 0,
        label: "no headers -> S2 verbatim: 4-span controller LOST root (click_lost_), OK/0 rows/LOST_BACKEND on root only",
        detail: noHeaderChain.slice(0, 4).join(" || ") || `trace=${groupsNoHeader[0]?.traceId}`,
      },
      {
        ok: cancelBadClick.ok && cancelBadClick.status === 200 && groupsBadClick.length === 1 &&
          groupsBadClick[0].spans.length === 4 && badClickChain.length === 0,
        label: "invalid X-TraceBoard-Click -> LOST fallback (independent 4-span LOST trace, no synthesized EXACT)",
        detail: badClickChain.slice(0, 4).join(" || ") || `trace=${groupsBadClick[0]?.traceId}`,
      },
      {
        ok: cancelZeroTrace.ok && cancelZeroTrace.status === 200 && groupsZero.length === 1 &&
          groupsZero[0].spans.length === 4 && zeroTraceChain.length === 0,
        label: "all-zero traceparent -> LOST fallback (independent 4-span LOST trace)",
        detail: zeroTraceChain.slice(0, 4).join(" || ") || `trace=${groupsZero[0]?.traceId}`,
      },
      {
        ok: headerCounter && !/X-TraceBoard-Click:/.test(demo.log.text),
        label: "agent stderr counts header_unreadable for reason=missing and reason=invalid, never logs header values",
        detail: (demo.log.text.match(/\[traceboard-agent\] header_unreadable=[^\r\n]*/g) ?? []).slice(0, 3).join(" | "),
      },
      {
        ok: allFinal.length === 18 && finalSpansPoll !== null && allFinal.every((span) => span.status !== "THREW") &&
          (validate ? allFinal.every((span) => validate(span)) : false),
        label: "session s_s3demo ends with 18 schema-valid spans (6 EXACT join + 3 x 4 LOST), no THREW",
        detail: `events=${allFinal.length}`,
      },
      {
        ok: reqFinalRes.ok && reqFinalBody.sdkActive === true && reqFinalRows.length === 4 &&
          reqFinalExact.length === 1 && reqFinalLost.length === 3 &&
          reqFinalLost.every((row) => row.rootKind === "controller" && row.fetchCount === 0 &&
            row.hasBackend === true && row.backendSpanCount === 4 && row.spanCount === 4),
        label: "requests: 1 EXACT + 3 LOST rows; LOST rows are backend-only controller roots (no synthesized EXACT)",
        detail: reqFinalRows.map((row) => `${row.confidence}/${row.rootKind}/${row.fetchCount}/${row.backendSpanCount}`).join(" "),
      },
    );

    /* -------- S3-5 replay 0-write with collector+demo running -------- */
    const eventsBefore = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
    const ordersBeforeReplay = await tryRequest(8080, "/api/orders", { method: "GET" });
    const ordersBeforeReplayBody = ordersBeforeReplay.ok ? parseJson(ordersBeforeReplay.text) : { ok: false };
    const rowsBeforeReplay = ordersBeforeReplayBody.ok && Array.isArray(ordersBeforeReplayBody.value?.data)
      ? ordersBeforeReplayBody.value.data : [];
    const maxEndNs = Math.max(...allFinal.map((span) => span.startNs + span.durNs), 0);

    const replayDefault1 = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/replay`);
    const replayDefault2 = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/replay`);
    const replayDefaultParsed = replayDefault1.ok ? parseJson(replayDefault1.text) : { ok: false };
    const replayDefaultBody = replayDefaultParsed.ok ? replayDefaultParsed.value ?? {} : {};
    const replayDefaultEvents = Array.isArray(replayDefaultBody.events) ? replayDefaultBody.events : [];
    const windowMid = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/replay?fromNs=0&toNs=${Math.floor(Number(click.startNs))}`);
    const windowTail = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S3_SESSION}/replay?fromNs=${Math.floor(Number(s3controller.startNs))}&toNs=${maxEndNs}`);
    const windowMidParsed = windowMid.ok ? parseJson(windowMid.text) : { ok: false };
    const windowTailParsed = windowTail.ok ? parseJson(windowTail.text) : { ok: false };
    const windowMidBody = windowMidParsed.ok ? windowMidParsed.value ?? {} : {};
    const windowTailBody = windowTailParsed.ok ? windowTailParsed.value ?? {} : {};
    const readOnlyOk = [replayDefaultBody, windowMidBody, windowTailBody].every((body) =>
      body.mode === "replay" && body.readOnly === true && body.sessionId === S3_SESSION);
    const sortedWindow = replayDefaultEvents.every((entry, index) => index === 0 ||
      entry.event.startNs > replayDefaultEvents[index - 1].event.startNs ||
      (entry.event.startNs === replayDefaultEvents[index - 1].event.startNs &&
        String(entry.event.spanId).localeCompare(String(replayDefaultEvents[index - 1].event.spanId)) > 0));

    const eventsAfter = await getEventsPage(S3_SESSION, "?afterSeq=0&limit=200");
    const ordersAfterReplay = await tryRequest(8080, "/api/orders", { method: "GET" });
    const ordersAfterReplayBody = ordersAfterReplay.ok ? parseJson(ordersAfterReplay.text) : { ok: false };
    const rowsAfterReplay = ordersAfterReplayBody.ok && Array.isArray(ordersAfterReplayBody.value?.data)
      ? ordersAfterReplayBody.value.data : [];

    const workbenchApi = readFileSync(abs("workbench/src/api.ts"), "utf8");
    const fetchReplayBody = workbenchApi.slice(workbenchApi.indexOf("export async function fetchReplay"), workbenchApi.indexOf("export async function fetchReplay") + 1200);
    const s3BoardCode = [
      readFileSync(abs("workbench/src/components/S3Panel.vue"), "utf8"),
      readFileSync(abs("workbench/src/stores/s3.ts"), "utf8"),
    ].map(stripComments).join("\n");
    const noFakeReplayCalls = !/\/api\/orders|:8080\b/.test(s3BoardCode) &&
      !/method:\s*["']POST["']/.test(fetchReplayBody) && !/\bfetch\s*\(/.test(fetchReplayBody) &&
      !/\bfetch\s*\(|XMLHttpRequest/.test(s3BoardCode);

    const s35Checks = [
      {
        ok: eventsBefore.res.ok && eventsBefore.value.nextSeq === 18 && eventsBefore.text === eventsAfter.text,
        label: "replay leaves the stored events/seq untouched (18 events, nextSeq=18, byte-identical page)",
        detail: `before=${eventsBefore.value.nextSeq} after=${eventsAfter.value.nextSeq} identical=${eventsBefore.text === eventsAfter.text}`,
      },
    ];
    s35Checks.push({
      ok: replayDefault1.ok && replayDefault1.status === 200 && replayDefault2.ok &&
        replayDefault1.text === replayDefault2.text && replayDefaultEvents.length === 18 &&
        replayDefaultBody.fromNs === 0 && closeNs(replayDefaultBody.toNs, maxEndNs) && sortedWindow,
      label: "default replay window: 18 events in startNs order, echoed 0..max(startNs+durNs); repeated GET byte-identical",
      detail: `fromNs=${replayDefaultBody.fromNs} toNs=${replayDefaultBody.toNs} events=${replayDefaultEvents.length} identical=${replayDefault1.text === replayDefault2.text}`,
    });
    s35Checks.push(
      {
        ok: windowMid.ok && windowMid.status === 200 && windowTail.ok && windowTail.status === 200 && readOnlyOk,
        label: "several replay windows (default/toNs/fromNs) all return readOnly=true, mode=replay, session echo",
        detail: `mid=${(windowMidBody.events ?? []).length} tail=${(windowTailBody.events ?? []).length}`,
      },
      {
        ok: ordersAfterReplay.ok && ordersAfterReplay.status === 200 && rowsAfterReplay.length === 1 &&
          rowsAfterReplay[0].id === 1 && rowsAfterReplay[0].status === "CREATED" &&
          ordersBeforeReplayBody.ok && ordersBeforeReplayBody.value?.data?.[0]?.status === "CREATED",
        label: "demo order still CREATED before/after replay (DB untouched; primary evidence is the unchanged event set)",
        detail: `before=${rowsBeforeReplay[0]?.status} after=${rowsAfterReplay[0]?.status}`,
      },
      {
        ok: allFinal.every((span) => span.status !== "THREW"),
        label: "no THREW span appears during the replay window (no re-execution)",
        detail: `events=${allFinal.length}`,
      },
      {
        ok: noFakeReplayCalls && workbenchApi.includes("export async function fetchReplay"),
        label: "workbench replay code is GET-only and never calls the demo (/api/orders) or POSTs",
        detail: noFakeReplayCalls ? "GET-only fetchReplay" : "forbidden call found",
      },
    );

    record(
      "S3-3",
      "header EXACT join E2E: case-A click+fetch + agent 4 spans (controller.parent=fetch, EXACT/0 rows) + LOST fallbacks",
      s3Checks.every((c) => c.ok),
      s3Checks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `${reproE2E} ; curl -X POST http://localhost:8080/api/orders/1/cancel -H "traceparent: ${traceparent}" -H "X-TraceBoard-Click: ${click.rootEventId}"`,
    );
    record(
      "S3-5",
      "replay 0-write with collector+demo running: events/seq unchanged, DB CREATED, readOnly, GET-only workbench",
      s35Checks.every((c) => c.ok),
      s35Checks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
      `curl -s "http://127.0.0.1:8601/api/v1/sessions/${S3_SESSION}/replay" ; curl -s "http://localhost:8080/api/orders"`,
    );
  } finally {
    await stopServer(demo);
    await stopServer(collector);
    const freed8080 = await pollUntil(() => listeningOn(8080).lines.length === 0, 30000, 400);
    const freed8601 = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    console.log(`        demo/collector stopped; 8080 ${freed8080 ? "free" : "STILL LISTENING"}, 8601 ${freed8601 ? "free" : "STILL LISTENING"}`);
  }
}

/* ------------------------------------------------------------------ */
/* S3-6 workbench                                                      */
/* ------------------------------------------------------------------ */

function checkS3Workbench() {
  section("S3-6 workbench dist");
  const checks = [];
  const files = distTextFiles(WORKBENCH_DIST_REL);
  const all = files.map((file) => file.text).join("\n");
  const findIn = (token) => files.filter((file) => file.text.includes(token)).map((file) => file.rel).join(",") || "not found";

  for (const token of S3_WORKBENCH_TOKENS) {
    checks.push({ ok: all.includes(token), label: `dist contains "${token}"`, detail: findIn(token) });
  }
  const missingSelectors = S3_SELECTORS.filter((id) => !all.includes(id));
  checks.push({
    ok: missingSelectors.length === 0,
    label: "dist contains the 10 stable #s3-* selectors",
    detail: missingSelectors.length ? `missing=${missingSelectors.join(",")}` : "10/10 selectors",
  });
  checks.push({
    ok: all.includes("app-shell") && all.includes("Fixture 事实摘要") && all.includes("case-a-zero-rows · 只读") &&
      all.includes("发送假点击/请求") && all.includes("0 行事实链") && all.includes("s2-panel") && all.includes("s2-chain"),
    label: "S0 FixturePanel + S1 fake panel + S2 fact-chain panel retained as secondary panels",
    detail: "app-shell/fixture/s1/s2 tokens present",
  });
  const missingSemantics = S3_STATE_SEMANTICS.filter((token) => !all.includes(token));
  const missingHints = S3_SEMANTIC_HINTS.filter((token) => !all.includes(token));
  checks.push({
    ok: missingSemantics.length === 0 && missingHints.length === 0,
    label: "state semantics legend present (OK/RETURNED_FALSE/THREW/NOT_COLLECTED_*/TRUNCATED/REDACTED/UNKNOWN/LOST + hints)",
    detail: missingSemantics.concat(missingHints).join(",") || "all semantics strings present",
  });
  const s3Store = readFileSync(abs("workbench/src/stores/s3.ts"), "utf8");
  const s3Panel = readFileSync(abs("workbench/src/components/S3Panel.vue"), "utf8");
  checks.push({
    ok: /S3_DEFAULT_SESSION_ID\s*=\s*"s_s3demo"/.test(s3Store) &&
      s3Panel.includes("已确认：本次点击因果链内没有网络请求") &&
      s3Panel.includes("无法确认：前端采集未接入") &&
      s3Panel.includes("前端已发请求但后端未采集（LOST）") &&
      s3Panel.includes("OBSERVE_MS"),
    label: "S3 board defaults to s_s3demo and implements the three case-B verdict texts incl. the OBSERVE_MS gate",
    detail: "stores/s3.ts + S3Panel.vue",
  });
  const pkg = readFileSync(abs("workbench/package.json"), "utf8");
  const noMaps = files.every((file) => !file.rel.endsWith(".map"));
  checks.push({
    ok: !/new EventSource|new WebSocket|sendBeacon/.test(all) && !/<canvas/i.test(all) &&
      !/"(d3|echarts|cytoscape|vis-network|chart\.js|three|sigma)"/.test(pkg) &&
      noMaps,
    label: "no graph library/canvas/SSE/WS and no sourcemap in the workbench build",
    detail: "list renderer only",
  });
  const api = readFileSync(abs("workbench/src/api.ts"), "utf8");
  checks.push({
    ok: /export async function fetchReplay/.test(api) && /\/replay\?/.test(api) &&
      /readOnly/.test(api) && !/https?:\/\//.test(stripComments(api).replace(/"http:\/\/localhost\/"/g, "")),
    label: "api client: replay is a relative GET query, readOnly surfaced, no absolute URL",
    detail: "src/api.ts",
  });

  gate(
    "S3-6",
    "workbench dist: S3 strings/selectors, S0/S1/S2 panels retained, state semantics, no graph lib/SSE/WS/sourcemap",
    checks,
    `(cd "workbench" && npm ci && npm run build) && grep -Rho "已确认：本次点击因果链内没有网络请求\\|s3-readonly\\|RETURNED_FALSE" "workbench/dist" | sort -u`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-7 case B evidence                                                */
/* ------------------------------------------------------------------ */

function checkS3CaseB() {
  section("S3-7 case B evidence");
  const checks = [];
  const b = loadS3Case(S3_CASE_B_EVENTS, S3_CASE_B_FACTS, 3);
  const click = b.events.find((event) => event.kind === "ui_event" && event.parentSpanId === null) ?? {};
  const validate = b.events.find((event) => event.kind === "js_method") ?? {};
  checks.push({
    ok: b.events.length === 3 && click.flags?.includes(S3_FLAG_SDK_ACTIVE) &&
      click.flags?.some((flag) => /^OBSERVE_MS=\d+$/.test(flag)) && click.confidence === "EXACT" &&
      validate.nodeKey === "OrderEdit.vue#validateForm" && validate.status === "RETURNED_FALSE" &&
      deepEqual(validate.return, { type: "boolean", value: false }) &&
      !b.events.some((event) => event.kind === "fetch") && !b.events.some((event) => S3_BACKEND_KINDS.includes(event.kind)),
    label: "fixture B: click root SDK_ACTIVE/OBSERVE_MS/EXACT, validateForm RETURNED_FALSE, zero fetch, zero backend",
    detail: `click=${click.spanId} js=${validate.spanId}`,
  });

  const row = S3_EVIDENCE.caseB?.requestsRow ?? {};
  checks.push({
    ok: S3_EVIDENCE.caseB?.sdkActive === true && row.status === "RETURNED_FALSE" && row.confidence === "EXACT" &&
      row.rootKind === "ui_event" && row.nodeKey === "#btn-save-b" && row.fetchCount === 0 &&
      row.hasBackend === false && row.backendSpanCount === 0 && row.spanCount === 3 && row.hasFrontend === true,
    label: "collector requests B: sdkActive=true, RETURNED_FALSE, fetchCount=0, hasBackend=false, root ui_event EXACT",
    detail: show(row),
  });
  checks.push({
    ok: [S3_CASE_B_VERDICT_TEXT, S3_CASE_B_UNKNOWN_TEXT, S3_CASE_B_FETCH_LOST_TEXT].every((text) =>
      readFileSync(abs("workbench/src/components/S3Panel.vue"), "utf8").includes(text)),
    label: "workbench renders the three case-B verdict strings (confirm / not collected / fetch lost)",
    detail: "S3Panel.vue",
  });
  const s3PanelCode = stripComments(readFileSync(abs("workbench/src/components/S3Panel.vue"), "utf8"));
  const s3StoreCode = stripComments(readFileSync(abs("workbench/src/stores/s3.ts"), "utf8"));
  checks.push({
    ok: !/kind:\s*["'](fetch|ui_event|js_method|render)["']/.test(`${s3PanelCode}\n${s3StoreCode}`) &&
      !/\bfetch\s*\(|XMLHttpRequest/.test(`${s3PanelCode}\n${s3StoreCode}`),
    label: "workbench fabricates no events and no fetch for case B (it only reads the collector)",
    detail: "no event construction / no network call in the S3 board",
  });

  const testSource = readFileSync(abs(`${SDK_DIR}/test/sdk.test.js`), "utf8");
  const testOut = S3_EVIDENCE.sdkTestStdout ?? "";
  checks.push({
    ok: S3_EVIDENCE.sdkTestStderr !== undefined && /# pass 17/.test(testOut) && /# fail 0/.test(testOut) && /1\.\.17/.test(testOut),
    label: "SDK `npm test` run recorded in S3-1: 17/17 tests pass (S5 manifest/source cases included)",
    detail: (testOut.match(/# pass \d+/) ?? ["missing"])[0],
  });
  checks.push({
    ok: testSource.includes('test("case B shape: click -> validateForm(RETURNED_FALSE) -> render, zero fetch"') &&
      testSource.includes('trace.filter((e) => e.kind === "fetch").length, 0') &&
      testSource.includes('assert.equal(js.status, "RETURNED_FALSE")') &&
      testSource.includes('test("wrapFn: false/throw/promise/nesting, this and args preserved"'),
    label: "SDK tests prove the wrapFn RETURNED_FALSE shape and the zero-fetch case-B path",
    detail: "test/sdk.test.js",
  });
  const sdkSource = readFileSync(abs(`${SDK_DIR}/src/index.ts`), "utf8");
  checks.push({
    ok: sdkSource.includes('status = "RETURNED_FALSE"') && sdkSource.includes('"SDK_ACTIVE", "S3_RUNTIME_SDK"') &&
      sdkSource.includes("headers.set(\"traceparent\"") && sdkSource.includes('headers.set("X-TraceBoard-Click"'),
    label: "SDK source: RETURNED_FALSE status, SDK_ACTIVE flags, traceparent + X-TraceBoard-Click headers",
    detail: "src/index.ts",
  });

  gate(
    "S3-7",
    "case B evidence: fixture + collector requests (sdkActive/fetchCount 0/hasBackend false/EXACT) + workbench strings + SDK tests",
    checks,
    `curl -s "http://127.0.0.1:8601/api/v1/sessions/s_s3verify_b/requests" ; (cd "${SDK_DIR}" && npm test)`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-8 scope / security                                               */
/* ------------------------------------------------------------------ */

function checkS3Scope() {
  section("S3-8 scope / security");
  const checks = [];
  const productTrees = [
    "frontend/sdk/src", "frontend/sdk/test", "workbench/src",
    "demo/buggy-shop-boot-vue/frontend/src", "server/collector/src", "agent/src",
  ];
  const productCode = productTrees.flatMap((rel) => dirTextFiles(rel))
    .map((file) => ({ rel: file.rel, text: stripComments(file.text) }));

  const forbiddenMarkers = [
    { name: "pixel replay", re: /rrweb|html2canvas|MediaRecorder|toDataURL|screenshot/i },
    { name: "realtime", re: /new\s+EventSource|new\s+WebSocket|SseEmitter|@ServerEndpoint/ },
    { name: "persistence", re: /localStorage|sessionStorage|indexedDB/ },
    // S5 allows the shallow manifest + demo build.sourcemap; .map decoding/upload stays banned.
    { name: "sourcemap-decoding", re: /SourceMapConsumer|sourcesContent|sourceMappingURL|source-map/i },
    { name: "cdn/telemetry", re: /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare|google-analytics|segment\.io/i },
  ];
  const markerHits = [];
  for (const file of productCode.filter((entry) => !entry.rel.includes("/test/"))) {
    for (const marker of forbiddenMarkers) {
      if (marker.re.test(file.text)) markerHits.push(`${file.rel} [${marker.name}]`);
    }
  }
  checks.push({
    ok: markerHits.length === 0,
    label: "no S6+ capability: no pixel replay, SSE/WS, client persistence, .map decoding/upload, CDN/telemetry (S5 manifest/sourcemap allowed)",
    detail: markerHits.slice(0, 5).join(",") || "none",
  });

  const collectorCode = productCode.filter((file) => file.rel.startsWith("server/collector/"));
  const collectorHits = [];
  for (const file of collectorCode) {
    for (const { name, re } of [
      { name: "db", re: /JdbcTemplate|java\.sql|javax\.sql|@Repository|spring-data-jpa|mybatis|hibernate/i },
      { name: "persistence", re: /FileOutputStream|Files\.write|java\.nio\.file|RandomAccessFile/ },
      { name: "cors", re: /@CrossOrigin|Access-Control-Allow/ },
    ]) {
      if (re.test(file.text)) collectorHits.push(`${file.rel} [${name}]`);
    }
  }
  checks.push({
    ok: collectorHits.length === 0,
    label: "collector stays in-memory: no DB/file persistence, no CORS headers",
    detail: collectorHits.join(",") || "none",
  });

  const l2Hits = productCode.filter((file) =>
    // S5 values are param/field/return summaries; L2 line-level locals exist only in the S6a/S6b
    // agent L2/no-debug files + workbench/src/s6/** (never SDK/collector/demo frontend/other files).
    !s6aL2Allowed(file.rel) &&
    /kind\s*=\s*["']local|LocalVariableTable|visitLocalVariable|localVariables/.test(file.text)).map((file) => file.rel);
  checks.push({
    ok: l2Hits.length === 0,
    label: "L2 allowed only in the S6a/S6b L2 files (L2ClassFileTransformer/L2Values/SpanContext/NoDebugClassFileTransformer + workbench/src/s6/**); all other SDK/agent/collector/workbench files stay L2/local-free",
    detail: l2Hits.join(",") || "none outside the S6a/S6b L2 files",
  });

  const workbenchSdkMaps = [WORKBENCH_DIST_REL, SDK_DIST_REL]
    .flatMap((rel) => (existsSync(abs(rel)) ? walk(abs(rel)) : []))
    .filter((file) => file.endsWith(".map"));
  checks.push({
    ok: workbenchSdkMaps.length === 0,
    label: "workbench/SDK dist have no *.map (S5 maps exist only in the demo build, which is gitignored)",
    detail: workbenchSdkMaps.length ? workbenchSdkMaps.map(relOf).join(",") : "0 maps",
  });
  const wbVite = readFileSync(abs("workbench/vite.config.ts"), "utf8");
  const demoVite = readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/vite.config.ts`), "utf8");
  checks.push({
    ok: /plugins:\s*\[vue\(\)\]/.test(wbVite) && !/traceboardShallow|@traceboard\/vite-plugin|sourcemap:\s*true/.test(wbVite) &&
      /plugins:\s*\[vue\(\),\s*traceboardShallow\(\)\]/.test(demoVite) && /sourcemap:\s*true/.test(demoVite) &&
      !/SourceMapConsumer|sourcesContent|sourceMappingURL/.test(wbVite + demoVite),
    label: "Vite configs: workbench vue() only; demo vue()+traceboardShallow()+build.sourcemap (S5 shallow, no .map decoding)",
    detail: `workbenchPlugin=${/traceboardShallow/.test(wbVite)} demoPlugin=${/traceboardShallow/.test(demoVite)}`,
  });

  /* -------- SDK privacy / secrets / telemetry / CDN -------- */
  const sdkCode = productCode.filter((file) => file.rel.startsWith("frontend/sdk/"));
  const sdkRuntime = sdkCode.filter((file) => file.rel.startsWith("frontend/sdk/src/")).map((file) => file.text).join("\n");
  const sdkAll = sdkCode.map((file) => file.text).join("\n");
  const piiHits = [];
  for (const { name, re } of [
    { name: "cookie", re: /document\.cookie/ },
    { name: "body", re: /\.body\b/ },
    { name: "response-body", re: /response\.text\s*\(/ },
    { name: "query-params", re: /URLSearchParams|\.search\b/ },
    { name: "form-value", re: /\.value\b/ },
  ]) {
    if (re.test(sdkRuntime)) piiHits.push(name);
  }
  checks.push({
    ok: piiHits.length === 0 && /parsed\.pathname/.test(sdkRuntime),
    label: "SDK runtime collects no body/form value/cookie/query string (nodeKey uses pathname only)",
    detail: piiHits.join(",") || "pathname only",
  });
  const sdkUrls = new Set();
  // Runtime source + built dist only: the test file deliberately uses a cross-origin URL to prove
  // that no correlation headers are added outside the same origin.
  for (const text of [sdkRuntime, ...distTextFiles(SDK_DIST_REL).map((file) => file.text)]) {
    for (const match of text.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+/g)) sdkUrls.add(match[0]);
  }
  const badSdkUrls = [...sdkUrls].filter((url) =>
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url) &&
    !/^https?:\/\/(www\.)?w3\.org\//.test(url) &&
    !/^https?:\/\/vuejs\.org\/error-reference\//.test(url));
  checks.push({
    ok: badSdkUrls.length === 0,
    label: "SDK has no external URL/CDN/telemetry endpoint (only the localhost URL-parsing base)",
    detail: badSdkUrls.length ? badSdkUrls.join(",") : [...sdkUrls].join(",") || "none",
  });
  checks.push({
    ok: resultById("V8a")?.ok === true && resultById("V8b")?.ok === true && resultById("V6d")?.ok === true,
    label: "shared hygiene gates extended to the SDK: no secrets (V8a), no telemetry/CDN (V8b), no external assets (V6d)",
    detail: `V8a=${resultById("V8a")?.ok ? "PASS" : "FAIL"} V8b=${resultById("V8b")?.ok ? "PASS" : "FAIL"} V6d=${resultById("V6d")?.ok ? "PASS" : "FAIL"}`,
  });

  /* -------- loopback + schema refs + repo surface -------- */
  const collectorYml = readFileSync(abs("server/collector/src/main/resources/application.yml"), "utf8");
  checks.push({
    ok: /address:\s*127\.0\.0\.1/.test(collectorYml) && /port:\s*8601/.test(collectorYml) &&
      !/0\.0\.0\.0/.test(collectorYml) &&
      !/0\.0\.0\.0/.test(readFileSync(abs("workbench/vite.config.ts"), "utf8")) &&
      !/0\.0\.0\.0/.test(readFileSync(abs(`${S3_DEMO_FRONTEND_REL}/vite.config.ts`), "utf8")),
    label: "collector binds 127.0.0.1:8601 only; both Vite configs stay loopback (no 0.0.0.0)",
    detail: "loopback only",
  });
  const schemaText = readFileSync(abs(SCHEMA_REL), "utf8");
  checks.push({
    ok: (schemaText.match(/"\$ref"/g) ?? []).length === 0 && !/"\$ref"\s*:\s*"https?:/.test(schemaText),
    label: "frozen schema has no $ref / external $ref (offline validation)",
    detail: "$ref=0",
  });
  const topLevel = readdirSync(abs(".")).filter((entry) => !entry.startsWith(".")).sort();
  checks.push({
    ok: deepEqual(topLevel, ["README.md", "agent", "demo", "docs", "fixtures", "frontend", "pom.xml", "schema", "server", "tools", "work", "workbench"]),
    label: "no stray top-level directories (no launcher/ideas/evidence leftovers)",
    detail: topLevel.join(","),
  });
  const iml = walk(abs("."), { skip: new Set(["node_modules", ".git", "target", "dist", "work"]) })
    .filter((file) => file.endsWith(".iml") || file.includes(`${path.sep}.idea${path.sep}`));
  checks.push({
    ok: iml.length === 0,
    label: "no IDEA project files (.iml/.idea) in the repository",
    detail: iml.map(relOf).join(",") || "none",
  });

  gate(
    "S3-8",
    "scope/security: S5 values/manifest/sourcemap allowed; L2 only in the S6a/S6b L2 files; no .map decoding/pixel replay/SSE/WS/persistence, SDK no secrets/CDN/PII, loopback, no external $ref; S4 launcher is allowed",
    checks,
    `grep -rnE "rrweb|EventSource|WebSocket|localStorage|sourceMappingURL" frontend/sdk/src workbench/src demo/buggy-shop-boot-vue/frontend/src server/collector/src agent/src`,
  );
}

/* ------------------------------------------------------------------ */
/* S3-9 regression                                                     */
/* ------------------------------------------------------------------ */

function checkS3Regression() {
  section("S3-9 regression");
  const checks = [];
  const required = [
    ["V1", "S0 case-A fixture schema/facts"],
    ["V1b", "S0 expected facts"],
    ["V1c", "S0 negatives"],
    ["V4b", "S0 intervals"],
    ["S1-C0", "S1 collector health/meta (replay=true)"],
    ["S1-C1", "S1 ingest happy path"],
    ["S1-D", "S1 query/paging/errors (replay 200)"],
    ["S1-F", "S1 workbench fake-batch path"],
    ["S2-2", "S2 H2 0-row defect + unknown 404"],
    ["S2-3", "S2 agent 4-span LOST (no headers, s_s2agent)"],
    ["S2-4", "S2 runtime requests/graph"],
    ["S2-4F", "S2 fixture requests/graph (replay 200)"],
    ["S2-6", "S2 workbench panel retained"],
    ["S3-1", "S3 builds"],
    ["S3-2", "S3 fixtures"],
    ["S3-3", "S3 header join E2E"],
    ["S3-4", "S3 collector replay/requests"],
    ["S3-5", "S3 replay 0-write"],
  ];
  const missing = required.filter(([id]) => resultById(id)?.ok !== true);
  checks.push({
    ok: missing.length === 0,
    label: "S0 + S1 + S2 + S3 predecessor gates all PASS (no regression hidden by a later failure)",
    detail: missing.length ? missing.map(([id]) => id).join(",") : `${required.length}/${required.length} PASS`,
  });
  checks.push({
    ok: resultById("S2-2")?.ok === true && resultById("S2-3")?.ok === true,
    label: "S2 backend LOST case (no headers) still works: DB 0 rows (order CREATED), unknown id 404, 4-span LOST",
    detail: "see S2-2/S2-3",
  });
  checks.push({
    ok: resultById("S1-C1")?.ok === true && resultById("S1-D")?.ok === true,
    label: "S1 ingest/query regression green (202 counts, paging, 400/404/405)",
    detail: "see S1-C1/S1-D",
  });
  checks.push({
    ok: resultById("V1")?.ok === true && resultById("V1b")?.ok === true && resultById("V4b")?.ok === true,
    label: "S0 case-A fixture (9 events, intervals, expected facts) still green",
    detail: "see V1/V1b/V4b",
  });
  checks.push({
    ok: resultById("S2-6")?.ok === true && resultById("S3-6")?.ok === true,
    label: "S2 workbench panel retained alongside the S3 board",
    detail: "see S2-6/S3-6",
  });

  gate(
    "S3-9",
    "regression: S2 no-header 4-span LOST + 0-row DB + unknown 404, S1 ingest/query, S0 fixture, S2 panel",
    checks,
    `node tools/verify/verify.mjs  (gates S2-2, S2-3, S1-C1, S1-D, V1)`,
  );
}

/* ------------------------------------------------------------------ */
/* V6 artifacts and parity                                             */
/* ------------------------------------------------------------------ */

function distTextFiles(relDir) {
  const dirAbs = abs(relDir);
  if (!existsSync(dirAbs)) return [];
  return walk(dirAbs).filter((file) => /\.(html|js|mjs|css|json|svg|map)$/i.test(file)).map((file) => ({
    file,
    rel: relOf(file),
    text: readFileSync(file, "utf8"),
  }));
}

function checkV6() {
  section("V6 artifacts and parity");

  const workbenchFiles = distTextFiles(WORKBENCH_DIST_REL);
  const workbenchAll = workbenchFiles.map((f) => f.text).join("\n");
  // S0 markers kept: AppShell + the read-only FixturePanel. The S0 placeholder panels
  // ("前端图（占位）"/"请求分图（占位）", both labelled "未实现（S1 不做）") are deliberately
  // superseded by the S2 request/fact-chain panel (dispatch S2 §4.6), so they are not asserted.
  const wbTokens = ["app-shell", "Fixture 事实摘要", "case-a-zero-rows · 只读"].map((token) => ({
    ok: workbenchAll.includes(token),
    label: `workbench dist contains "${token}"`,
    detail: workbenchFiles.filter((f) => f.text.includes(token)).map((f) => f.rel).join(",") || "not found",
  }));
  wbTokens.push({
    ok: !workbenchAll.includes("图渲染尚未实现"),
    label: "stale S0/S1 placeholder copy removed (no \"图渲染尚未实现\")",
    detail: workbenchAll.includes("图渲染尚未实现") ? "stale placeholder still present" : "absent",
  });
  record(
    "V6a",
    "workbench dist contains the retained S0 AppShell + FixturePanel markers (placeholders superseded by S2)",
    wbTokens.every((t) => t.ok),
    wbTokens.map((t) => `${t.ok ? "ok " : "BAD"} ${t.label} :: ${t.detail}`),
    `(cd "workbench" && npm run build)`,
  );

  const distEvents = abs(`${WORKBENCH_DIST_REL}/fixtures/case-a-zero-rows/events.jsonl`);
  const distFacts = abs(`${WORKBENCH_DIST_REL}/fixtures/case-a-zero-rows/expected-facts.json`);
  const parityChecks = [
    { ok: existsSync(distEvents), label: "dist fixture copy exists (events.jsonl)", detail: relOf(distEvents) },
    {
      ok: existsSync(distEvents) && sha256File(distEvents) === sha256File(abs(EVENTS_REL)),
      label: "events.jsonl SHA256 source == dist copy",
      detail: `source=${sha256File(abs(EVENTS_REL))} dist=${existsSync(distEvents) ? sha256File(distEvents) : "missing"}`,
    },
    {
      ok: existsSync(distFacts) && sha256File(distFacts) === sha256File(abs(FACTS_REL)),
      label: "expected-facts.json SHA256 source == dist copy",
      detail: `source=${sha256File(abs(FACTS_REL))} dist=${existsSync(distFacts) ? sha256File(distFacts) : "missing"}`,
    },
  ];
  record(
    "V6b",
    "workbench dist fixture copy byte-identical to frozen fixtures",
    parityChecks.every((c) => c.ok),
    parityChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `sha256sum "fixtures/case-a-zero-rows/events.jsonl" "workbench/dist/fixtures/case-a-zero-rows/events.jsonl"`,
  );

  const demoFiles = distTextFiles(DEMO_DIST_REL);
  const demoAll = demoFiles.map((f) => f.text).join("\n");
  const demoChecks = ["btn-cancel", "操作成功", "raw-json"].map((token) => ({
    ok: demoAll.includes(token),
    label: `demo dist contains "${token}"`,
    detail: demoFiles.filter((f) => f.text.includes(token)).map((f) => f.rel).join(",") || "not found",
  }));
  record(
    "V6c",
    "demo dist contains cancel button, success hint, raw JSON",
    demoChecks.every((c) => c.ok),
    demoChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `(cd "demo/buggy-shop-boot-vue/frontend" && npm run build)`,
  );

  // External asset URL scan over both dists plus index.html sources.
  const INERT_URL_ALLOWLIST = [
    /^https?:\/\/(www\.)?w3\.org\//, // XML/SVG/MathML namespaces (never fetched)
    /^https?:\/\/vuejs\.org\/error-reference\//, // Vue runtime error-message link (never fetched)
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/, // local dev/proxy targets
  ];
  // S5 migration: the demo build now emits `.js.map` (build.sourcemap=true). A sourcemap is a
  // local devtools artifact that embeds vendored library source text (Vue/Vite doc links) and is
  // never fetched by the page, so it is excluded from the *runtime* URL/asset scan. Maps are still
  // asserted below to carry no CDN host, and index.html/js/css stay fully scanned.
  const runtimeScanFiles = [...workbenchFiles, ...demoFiles, ...distTextFiles(SDK_DIST_REL)]
    .filter((target) => !target.rel.endsWith(".map"));
  const scannedMaps = [...workbenchFiles, ...demoFiles]
    .filter((target) => target.rel.endsWith(".map"));
  const scanTargets = [
    ...runtimeScanFiles,
    { rel: "workbench/index.html", text: readFileSync(abs("workbench/index.html"), "utf8") },
    { rel: "demo/buggy-shop-boot-vue/frontend/index.html", text: readFileSync(abs("demo/buggy-shop-boot-vue/frontend/index.html"), "utf8") },
  ];
  const allUrls = new Map();
  for (const target of scanTargets) {
    for (const match of target.text.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+/g)) {
      const url = match[0].replace(/[.,;]+$/, "");
      if (!allUrls.has(url)) allUrls.set(url, new Set());
      allUrls.get(url).add(target.rel);
    }
  }
  const offendingUrls = [...allUrls.keys()].filter((url) => !INERT_URL_ALLOWLIST.some((re) => re.test(url)));

  const externalAssetRefs = [];
  for (const target of scanTargets.filter((t) => t.rel.endsWith(".html") || t.rel.endsWith(".css"))) {
    for (const match of target.text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      if (/^https?:\/\//i.test(match[1])) externalAssetRefs.push(`${target.rel}: ${match[1]}`);
    }
    for (const match of target.text.matchAll(/url\(\s*['"]?(https?:\/\/[^)'"]+)/g)) {
      externalAssetRefs.push(`${target.rel}: css url(${match[1]})`);
    }
  }

  const mapCdnHits = [];
  for (const target of scannedMaps) {
    const lower = target.text.toLowerCase();
    for (const host of ["unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "npmmirror.com", "mirrors.aliyun.com"]) {
      if (lower.includes(host)) mapCdnHits.push(`${target.rel} -> ${host}`);
    }
  }
  const urlChecks = [
    {
      ok: offendingUrls.length === 0,
      label: "no non-inert external http(s) URLs in built assets (runtime js/css/html; S5 demo *.map excluded as a devtools artifact)",
      detail: offendingUrls.length ? offendingUrls.join(", ") : `${allUrls.size} distinct URLs, all inert/loopback`,
    },
    {
      ok: externalAssetRefs.length === 0,
      label: "no external src/href/url() asset references",
      detail: externalAssetRefs.length ? externalAssetRefs.join(" | ") : "none",
    },
    {
      ok: mapCdnHits.length === 0,
      label: `S5 demo sourcemaps (${scannedMaps.length} *.map) reference no CDN/mirror host`,
      detail: mapCdnHits.slice(0, 3).join(" | ") || "0 CDN hosts in maps",
    },
    {
      ok: true,
      label: "observed URL inventory",
      detail: [...allUrls.keys()].sort().join(" , "),
    },
  ];
  record(
    "V6d",
    "no external CDN/asset URLs in workbench and demo builds",
    urlChecks.every((c) => c.ok),
    urlChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `grep -RhoE "https?://[^\\"' ]+" "workbench/dist" "demo/buggy-shop-boot-vue/frontend/dist" | sort -u`,
  );

  const manifestChecks = [];
  const jarAbs = abs(AGENT_JAR_REL);
  manifestChecks.push({ ok: existsSync(jarAbs), label: "agent jar exists", detail: AGENT_JAR_REL });
  if (existsSync(jarAbs)) {
    const result = runExe("unzip", ["-p", jarAbs, "META-INF/MANIFEST.MF"]);
    const manifest = result.stdout ?? "";
    const premain = manifest.split(/\r?\n/).find((line) => /^Premain-Class:/i.test(line.trim()));
    manifestChecks.push({
      ok: result.code === 0 && Boolean(premain) && /io\.traceboard\.agent\.TraceAgent/.test(premain ?? ""),
      label: "MANIFEST Premain-Class: io.traceboard.agent.TraceAgent",
      detail: premain ? premain.trim() : `unzip exit=${result.code} ${lastLines(result.stderr, 2).join(" ")}`,
    });
    manifestChecks.push({
      ok: /Implementation-Title:\s*TraceBoard Agent/i.test(manifest),
      label: "MANIFEST Implementation-Title present",
      detail: (manifest.split(/\r?\n/).find((line) => /^Implementation-Title:/i.test(line.trim())) ?? "missing").trim(),
    });
  }
  record(
    "V6e",
    "agent jar manifest declares the S1 premain entry point",
    manifestChecks.every((c) => c.ok),
    manifestChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `unzip -p "${AGENT_JAR_REL}" META-INF/MANIFEST.MF | grep -i "Premain-Class"`,
  );
}

/* ------------------------------------------------------------------ */
/* V7 frozen drift                                                     */
/* ------------------------------------------------------------------ */

// The S0-only drift gate is superseded by S2-L: it checks the S2 G1 baseline
// (9 files: schema + 3 contracts + 3 S2 fixtures + s2-plan + dispatch), the S0 freeze
// (contracts updated only through the S1/S2 G1 chain, everything else byte-identical)
// and the S0/S1 fixture bytes. Nothing to run here.

/* ------------------------------------------------------------------ */
/* V8 hygiene                                                          */
/* ------------------------------------------------------------------ */

function sourceFilesForScan() {
  const files = [];
  const addTree = (rel) => {
    walk(abs(rel), { skip: new Set(["node_modules", "target", "dist", ".git"]) }).forEach((file) => files.push(file));
  };
  ["schema", "fixtures", "docs/contracts"].forEach(addTree);
  files.push(abs("pom.xml"));
  files.push(abs(".gitignore"));
  addTree("agent/src");
  addTree("server/collector/src");
  addTree("demo/buggy-shop-boot-vue/backend/src");
  addTree("demo/buggy-shop-boot-vue/frontend/src");
  addTree("workbench/src");
  addTree("workbench/scripts");
  ["workbench/package.json", "workbench/index.html", "workbench/vite.config.ts", "workbench/tsconfig.json", "workbench/env.d.ts"].forEach((rel) => files.push(abs(rel)));
  ["demo/buggy-shop-boot-vue/frontend/package.json", "demo/buggy-shop-boot-vue/frontend/index.html", "demo/buggy-shop-boot-vue/frontend/vite.config.ts", "demo/buggy-shop-boot-vue/frontend/tsconfig.json", "demo/buggy-shop-boot-vue/frontend/env.d.ts"].forEach((rel) => files.push(abs(rel)));
  addTree("frontend/sdk/src");
  addTree("frontend/sdk/test");
  ["frontend/sdk/package.json", "frontend/sdk/tsconfig.json", "frontend/sdk/package-lock.json"].forEach((rel) => files.push(abs(rel)));
  files.push(abs("demo/buggy-shop-boot-vue/backend/pom.xml"));
  files.push(abs("server/collector/pom.xml"));
  files.push(abs("agent/pom.xml"));
  return [...new Set(files)].filter((file) => existsSync(file));
}

function checkV8() {
  section("V8 hygiene");

  // V8a secrets
  const secretPatterns = [
    { name: "password-assignment", re: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\n]{3,}["']/gi },
    { name: "api-key/secret/token assignment", re: /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi },
    { name: "private-key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { name: "bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g },
    { name: "aws access key id", re: /\bAKIA[0-9A-Z]{16}\b/g },
    { name: "github token", re: /\bghp_[A-Za-z0-9]{20,}/g },
  ];
  const placeholderAllow = /placeholder|changeme|change_me|example|sample|dummy|redacted|xxx|<[^>]+>|\$\{|your_|demo|test/i;
  const secretHits = [];
  const allowedHits = [];
  for (const file of sourceFilesForScan()) {
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, index) => {
      if (/package-lock\.json/.test(file)) return;
      for (const pattern of secretPatterns) {
        pattern.re.lastIndex = 0;
        for (const match of line.matchAll(pattern.re)) {
          const hit = `${relOf(file)}:${index + 1} [${pattern.name}] ${match[0].slice(0, 80)}`;
          if (placeholderAllow.test(match[0])) allowedHits.push(hit);
          else secretHits.push(hit);
        }
      }
    });
  }
  const secretChecks = [
    { ok: secretHits.length === 0, label: "no secret material in project sources", detail: secretHits.length ? secretHits.slice(0, 6).join(" || ") : "0 hits" },
    { ok: true, label: "placeholder-only hits (allowed)", detail: allowedHits.length ? `${allowedHits.length} (e.g. ${allowedHits[0]})` : "none" },
  ];
  record(
    "V8a",
    "secret scan over project sources",
    secretChecks.every((c) => c.ok),
    secretChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `grep -rniE "(password|secret|api[_-]?key|bearer)" "agent/src" "server/collector/src" "demo/buggy-shop-boot-vue" "workbench/src" --include="*.java" --include="*.ts" --include="*.vue"`,
  );

  // V8b telemetry / CDN
  const trackingDomains = [
    "google-analytics.com", "googletagmanager.com", "doubleclick.net", "hotjar.com",
    "mixpanel.com", "segment.io", "segment.com", "sentry.io", "datadoghq", "newrelic.com",
    "hm.baidu.com", "cnzz.com", "umeng.com", "amplitude.com", "fullstory.com",
  ];
  const cdnHosts = [
    "unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com",
    "fonts.gstatic.com", "bootcdn.net", "staticfile.org", "cdn.bootcss.com", "cdn.tailwindcss.com",
  ];
  const haystackFiles = [
    ...sourceFilesForScan(),
    ...distTextFiles(WORKBENCH_DIST_REL).map((f) => f.file),
    ...distTextFiles(DEMO_DIST_REL).map((f) => f.file),
    ...distTextFiles(SDK_DIST_REL).map((f) => f.file),
  ];
  const telemetryHits = [];
  const cdnHits = [];
  for (const file of [...new Set(haystackFiles)]) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const domain of trackingDomains) if (text.includes(domain)) telemetryHits.push(`${relOf(file)} -> ${domain}`);
    for (const host of cdnHosts) if (text.includes(host)) cdnHits.push(`${relOf(file)} -> ${host}`);
  }
  record(
    "V8b",
    "no telemetry endpoints and no external CDN hosts",
    telemetryHits.length === 0 && cdnHits.length === 0,
    [
      { ok: true, label: "telemetry hits", detail: telemetryHits.length ? telemetryHits.slice(0, 5).join(" | ") : "0" },
      { ok: true, label: "cdn hits", detail: cdnHits.length ? cdnHits.slice(0, 5).join(" | ") : "0" },
    ].map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `grep -rniE "(google-analytics|googletagmanager|unpkg|jsdelivr|cdnjs|fonts\\.googleapis|sentry)" workbench demo agent server --include="*.html" --include="*.ts" --include="*.vue" --include="*.java"`,
  );

  // V8c .gitattributes / CRLF policy
  const attrsAbs = abs(".gitattributes");
  const attrsExists = existsSync(attrsAbs);
  const autocrlf = runExe("git", ["config", "--show-origin", "--get", "core.autocrlf"]);
  const crlfEvidence = `${(autocrlf.stdout || "").trim() || "(unset)"}`;
  const attrChecks = [
    { ok: true, label: "repo .gitattributes state", detail: attrsExists ? "present" : "absent (expected: acceptance adds it at G2 per s0-plan D15)" },
    { ok: true, label: "core.autocrlf", detail: crlfEvidence },
    { ok: true, label: "CRLF risk note for acceptance", detail: "without .gitattributes a checkout with core.autocrlf=true would rewrite *.jsonl to CRLF and break V1; acceptance must add it at G2 and re-run verify" },
    { ok: true, label: "fixtures CR count now", detail: `${(readFileSync(abs(EVENTS_REL), "utf8").match(/\r/g) ?? []).length} (events.jsonl)` },
  ];
  if (attrsExists) {
    const check = runExe("git", ["check-attr", "-a", "--", EVENTS_REL]);
    attrChecks.push({ ok: true, label: "git check-attr events.jsonl", detail: (check.stdout || "").trim() });
  }
  record("V8c", ".gitattributes / CRLF risk recorded", true, attrChecks.map((c) => `note ${c.label} :: ${c.detail}`), null);

  // V8d verifier made no product writes; git status/index unchanged by this run
  const snapshotNow = sourceSnapshot();
  const changed = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) changed.push(`${rel} (${hash} -> ${snapshotNow[rel] ?? "missing"})`);
  }
  const added = Object.keys(snapshotNow).filter((rel) => !(rel in SNAPSHOT));

  const status = gitStatusLines();
  const statusNow = status.lines.slice().sort().join("\n");
  const ignoredNodeModules = runExe("git", ["check-ignore", "-q", "--", "tools/verify/node_modules/ajv/package.json"]);

  const hygieneChecks = [
    { ok: changed.length === 0, label: "no product file modified during verify", detail: changed.length ? changed.slice(0, 5).join(" | ") : `${Object.keys(SNAPSHOT).length} files stable` },
    { ok: added.length === 0, label: "no product files added during verify", detail: added.length ? added.slice(0, 5).join(" | ") : "none" },
    {
      ok: status.ok && statusNow === BASELINE.gitStatus,
      label: "git status identical before/after verify (verifier wrote no tracked product path)",
      detail: status.ok ? `${status.lines.length} entries, unchanged=${statusNow === BASELINE.gitStatus}` : status.error,
    },
    { ok: ignoredNodeModules.code === 0, label: "tools/verify/node_modules is gitignored", detail: ignoredNodeModules.code === 0 ? "ignored" : "NOT ignored" },
  ];
  record(
    "V8d",
    "verifier wrote no product files; git status unchanged by the run",
    hygieneChecks.every((c) => c.ok),
    hygieneChecks.map((c) => `${c.ok ? "ok " : "BAD"} ${c.label} :: ${c.detail}`),
    `git status --porcelain`,
  );
}

/* ------------------------------------------------------------------ */
/* S4 tester part 1: BUILD + A (idea) + B (jar/stop) + C (handshake)   */
/* ------------------------------------------------------------------ */

/** Unique per-run suffix for test pid/log files (never reuse another tester's names). */
function s4Unique(label) {
  return `s4-${label}-${process.pid}-${Date.now().toString(36)}`;
}

/** Read META-INF/MANIFEST.MF from a jar via the JDK21 `jar` tool (tar fallback). */
function s4Manifest(jarAbs) {
  const dir = path.join(os.tmpdir(), `traceboard-s4-manifest-${process.pid}-${Date.now().toString(36)}`);
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  const jarExe = `${JDK21_HOME}/bin/jar.exe`;
  const result = existsSync(jarExe)
    ? runExe(jarExe, ["xf", jarAbs, "META-INF/MANIFEST.MF"], { cwd: dir, timeout: 60000 })
    : runExe("tar", ["-xf", jarAbs, "META-INF/MANIFEST.MF"], { cwd: dir, timeout: 60000 });
  const file = path.join(dir, "META-INF", "MANIFEST.MF");
  return {
    ok: existsSync(file),
    text: existsSync(file) ? readFileSync(file, "utf8") : "",
    detail: result.code === 0 ? "extracted" : `exit=${result.code} ${(result.stderr || "").slice(0, 160)}`,
  };
}

/**
 * S4-BUILD: the root JDK21 reactor (agent + collector + launcher) builds, the launcher jar
 * carries Main-Class/Implementation-Version and runs with JDK21, and the demo/agent/collector
 * jars used by S4-A/B/C exist (the demo is built with JDK8 on demand).
 */
function checkS4Builds() {
  section("S4-BUILD: root reactor (JDK21) incl. launcher + demo/agent jars");
  const checks = [];
  const started = Date.now();
  const build = runShell("mvn -q -DskipTests package", {
    cwd: REPO,
    env: { ...process.env, JAVA_HOME: JDK21_HOME },
  });
  const buildOut = `${build.stdout}\n${build.stderr}`;
  checks.push({
    ok: build.code === 0 && !build.error && !build.signal && !/BUILD FAILURE/.test(buildOut),
    label: "root reactor `mvn -q -DskipTests package` with JAVA_HOME=JDK21 exit 0",
    detail: `exit=${build.code} ${((Date.now() - started) / 1000).toFixed(1)}s ${lastLines(buildOut, 2).join(" | ").slice(0, 300)}`,
  });

  const rootPom = readFileSync(abs("pom.xml"), "utf8");
  checks.push({
    ok: /<module>server\/launcher<\/module>/.test(rootPom),
    label: "root pom reactor modules include server/launcher (launcher built by the reactor)",
    detail: "pom.xml",
  });

  const launcherJar = abs(S4_LAUNCHER_JAR_REL);
  const launcherExists = existsSync(launcherJar) && statSync(launcherJar).size > 0;
  checks.push({
    ok: launcherExists,
    label: "launcher jar exists (server/launcher/target/traceboard-launcher-0.1.0-SNAPSHOT.jar)",
    detail: launcherExists ? `${statSync(launcherJar).size} bytes` : "missing",
  });
  const manifest = launcherExists ? s4Manifest(launcherJar) : { ok: false, text: "", detail: "jar missing" };
  checks.push({
    ok: manifest.ok && /Main-Class:\s*io\.traceboard\.launcher\.Launcher\b/.test(manifest.text),
    label: "launcher MANIFEST has Main-Class: io.traceboard.launcher.Launcher",
    detail: manifest.detail,
  });
  checks.push({
    ok: manifest.ok && /Implementation-Version:\s*0\.1\.0-SNAPSHOT/.test(manifest.text),
    label: "launcher MANIFEST has Implementation-Version: 0.1.0-SNAPSHOT",
    detail: manifest.ok ? "ok" : "manifest unreadable",
  });
  const help = launcherExists ? runLauncher(["--help"], { timeout: 60000 }) : { code: null, stdout: "", stderr: "jar missing" };
  checks.push({
    ok: help.code === 0 && /用法|usage/i.test(help.stdout),
    label: "launcher runs with JDK21 and `--help` exits 0",
    detail: `exit=${help.code}`,
  });

  const demoJar = abs(DEMO_JAR_REL);
  if (!existsSync(demoJar)) {
    const demoBuild = runShell("mvn -q -DskipTests package", {
      cwd: abs("demo/buggy-shop-boot-vue/backend"),
      env: { ...process.env, JAVA_HOME: JDK8_HOME },
    });
    checks.push({
      ok: demoBuild.code === 0 && !demoBuild.error && existsSync(demoJar),
      label: "demo jar missing -> rebuilt with JDK8 `mvn -q -DskipTests package`",
      detail: `exit=${demoBuild.code} ${lastLines(`${demoBuild.stdout}\n${demoBuild.stderr}`, 2).join(" | ").slice(0, 240)}`,
    });
  } else {
    checks.push({ ok: true, label: "demo jar exists (JDK8 build output)", detail: DEMO_JAR_REL });
  }
  checks.push({ ok: existsSync(abs(AGENT_JAR_REL)), label: "agent jar exists", detail: AGENT_JAR_REL });
  checks.push({ ok: existsSync(abs(COLLECTOR_JAR_REL)), label: "collector jar exists", detail: COLLECTOR_JAR_REL });

  return gate(
    "S4-BUILD",
    "S4 builds: reactor incl. launcher, launcher Main-Class/version/runnable, demo+agent+collector jars",
    checks,
    `JAVA_HOME="${JDK21_HOME}" mvn -q -DskipTests package`,
  );
}

/**
 * S4-A: `idea` is print-only. Exact VM options (absolute -javaagent, derived
 * <collector>/ingest/v1/events, session), 5-step checklist, exit 0, no spawned java, and the
 * usage contract (legacy --ingest -> exit 2; missing/failed jar/agent -> tokens).
 */
async function checkS4A() {
  section("S4-A: launcher `idea` (print-only, exact VM options, no child process)");
  const checks = [];
  const demoJar = abs(DEMO_JAR_REL);
  const agentJar = abs(AGENT_JAR_REL);
  const agentFwd = agentJar.split(path.sep).join("/");
  const expectedVm = `-javaagent:"${agentFwd}" -Dtraceboard.ingestUrl="http://127.0.0.1:8601/ingest/v1/events" -Dtraceboard.sessionId=s_s4idea`;
  const portBefore = listeningOn(8080).lines.length;
  const pidsBefore = javaPids();

  const idea = runLauncher([
    "idea", "--jar", demoJar, "--agent", agentJar,
    "--collector", "http://127.0.0.1:8601", "--session", "s_s4idea",
  ], { timeout: 60000 });
  const pidsAfter = javaPids();
  const newPids = pidsAfter.filter((pid) => !pidsBefore.includes(pid));
  const portAfter = listeningOn(8080).lines.length;
  const out = `${idea.stdout}\n${idea.stderr}`;
  const vmLine = idea.stdout.split(/\r?\n/).find((line) => line.includes("-javaagent:")) ?? "";

  checks.push({
    ok: idea.code === 0 && !idea.error,
    label: "idea exits 0",
    detail: `exit=${idea.code}${idea.error ? ` error=${idea.error.message}` : ""}`,
  });
  checks.push({
    ok: idea.stdout.includes(expectedVm),
    label: "exact VM options: absolute quoted -javaagent + derived /ingest/v1/events + session",
    detail: show(vmLine),
  });
  checks.push({
    ok: /^1\) /m.test(out) && /^2\) /m.test(out) && /^3\) /m.test(out) && /^4\) /m.test(out) && /^5\) /m.test(out) && /步骤:/.test(out),
    label: "5-step checklist (1..5) printed",
    detail: lastLines(out, 12).join(" | ").slice(0, 300),
  });
  checks.push({
    ok: newPids.length === 0,
    label: "idea spawned no java child (java pid delta empty)",
    detail: newPids.length ? `new=${newPids.join(",")}` : `pids=${pidsAfter.join(",") || "none"}`,
  });
  checks.push({
    ok: portAfter === portBefore,
    label: "idea did not start/stop anything on port 8080",
    detail: `listeners before=${portBefore} after=${portAfter}`,
  });

  const legacy = runLauncher([
    "idea", "--jar", demoJar, "--agent", agentJar,
    "--ingest", "http://127.0.0.1:8601/ingest/v1/events", "--session", "s_s4idea",
  ], { timeout: 60000 });
  checks.push({
    ok: legacy.code === 2 && /--collector/.test(legacy.stderr) && /--ingest/.test(legacy.stderr),
    label: "legacy --ingest -> exit 2 + advice to use --collector",
    detail: `exit=${legacy.code} ${lastLines(legacy.stderr, 2).join(" | ").slice(0, 240)}`,
  });

  const noSession = runLauncher(["idea", "--jar", demoJar, "--agent", agentJar], { timeout: 60000 });
  checks.push({
    ok: noSession.code === 2,
    label: "missing --session -> exit 2 (usage)",
    detail: `exit=${noSession.code} ${lastLines(noSession.stderr, 1).join("")}`,
  });

  const missingJar = abs(`work/${s4Unique("missing-jar")}.jar`);
  const badJar = runLauncher(["idea", "--jar", missingJar, "--agent", agentJar, "--session", "s_s4idea"], { timeout: 60000 });
  checks.push({
    ok: badJar.code === 3 && /JAR_NOT_FOUND/.test(badJar.stderr),
    label: "missing --jar -> exit 3 + JAR_NOT_FOUND",
    detail: `exit=${badJar.code} ${lastLines(badJar.stderr, 1).join("").slice(0, 240)}`,
  });

  const missingAgent = abs(`work/${s4Unique("missing-agent")}.jar`);
  const badAgent = runLauncher(["idea", "--jar", demoJar, "--agent", missingAgent, "--session", "s_s4idea"], { timeout: 60000 });
  checks.push({
    ok: badAgent.code === 3 && /AGENT_NOT_FOUND/.test(badAgent.stderr),
    label: "missing --agent -> exit 3 + AGENT_NOT_FOUND",
    detail: `exit=${badAgent.code} ${lastLines(badAgent.stderr, 1).join("").slice(0, 240)}`,
  });

  S4_EVIDENCE.launch = {
    exit: idea.code,
    vmLine,
    steps: [1, 2, 3, 4, 5].filter((n) => new RegExp(`^${n}\\) `, "m").test(out)).length,
    newPids,
  };
  return gate(
    "S4-A",
    "launcher `idea`: exact VM options/session, 5 steps, exit 0, no child java; legacy/usage exits",
    checks,
    `"${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" idea --jar "${DEMO_JAR_REL}" --agent "${AGENT_JAR_REL}" --collector "http://127.0.0.1:8601" --session "s_s4idea"`,
  );
}

/**
 * S4-B: `jar --detach` with the JDK8 demo + agent against a live collector, then `stop`.
 * Asserts PID/log files, health, handshake, a real cancel request producing agent events,
 * port release, idempotent NOT_RUNNING, PID_MISMATCH refusal for a foreign pid file, and no
 * orphan java processes. All pid/log files are unique and removed in `finally`.
 */
async function checkS4B() {
  section("S4-B: launcher `jar --detach` + `stop` (collector 8601, JDK8 demo, handshake)");
  const checks = [];
  const demoJar = abs(DEMO_JAR_REL);
  const agentJar = abs(AGENT_JAR_REL);
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const suffix = `${process.pid}-${Date.now().toString(36)}`;
  const pidFileRel = `work/s4-test-${suffix}.pid`;
  const pidFileAbs = abs(pidFileRel);
  const foreignRel = `work/s4-test-foreign-${suffix}.pid`;
  const foreignAbs = abs(foreignRel);
  const logsDirAbs = abs("work/logs");
  const logsBefore = new Set(existsSync(logsDirAbs) ? readdirSync(logsDirAbs) : []);
  const port8601 = listeningOn(8601);
  const port8080 = listeningOn(8080);
  const pre = [
    { ok: existsSync(demoJar), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(agentJar), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: port8601.supported && port8601.lines.length === 0, label: "port 8601 free before start", detail: port8601.lines.join(" | ") || "no listener" },
    { ok: port8080.supported && port8080.lines.length === 0, label: "port 8080 free before start", detail: port8080.lines.join(" | ") || "no listener" },
  ];
  const repro = `"${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" jar --jar "${DEMO_JAR_REL}" --agent "${AGENT_JAR_REL}" --collector "http://127.0.0.1:8601" --session "${S4_SESSION}" --java "${JDK8_JAVA}" --port 8080 --detach --pid-file "${pidFileRel}" --log-dir "work/logs" && "${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" stop --pid-file "${pidFileRel}"`;
  if (!pre.every((item) => item.ok)) {
    return record(
      "S4-B",
      "launcher `jar --detach` + `stop` (preconditions)",
      false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro,
    );
  }

  const baselinePids = javaPids();
  let collector = null;
  let demoPid = null;
  try {
    collector = startJavaServer("collector(8601) S4-B", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({
      ok: Boolean(health),
      label: "collector 8601 /actuator/health 200 before launching the demo",
      detail: health ? `status=${health.status}` : "timeout",
    });

    if (health) {
      const launch = runLauncher([
        "jar", "--jar", demoJar, "--agent", agentJar,
        "--collector", "http://127.0.0.1:8601", "--session", S4_SESSION,
        "--java", JDK8_JAVA, "--port", "8080", "--detach",
        "--pid-file", pidFileRel, "--log-dir", "work/logs",
      ], { timeout: 150000 });
      const launchOut = `${launch.stdout}\n${launch.stderr}`;
      const pidMatch = launchOut.match(/^PID=(\d+)$/m);
      demoPid = pidMatch ? Number(pidMatch[1]) : null;
      if (demoPid === null) {
        // APP_EXITED / HEALTH_TIMEOUT print pid=...; still clean it up in finally.
        const anyPid = launchOut.match(/pid=(\d+)/i);
        if (anyPid) demoPid = Number(anyPid[1]);
      }
      const pidFileLine = launchOut.match(/^PID_FILE=(.+)$/m);
      const logDirLine = launchOut.match(/^LOG_DIR=(.+)$/m);
      const logDir = logDirLine ? logDirLine[1].trim() : logsDirAbs;

      checks.push({
        ok: launch.code === 0 && !launch.error,
        label: "jar --detach exits 0 after READY",
        detail: `exit=${launch.code}${launch.error ? ` error=${launch.error.message}` : ""} ${lastLines(launchOut, 6).join(" | ").slice(0, 300)}`,
      });
      checks.push({
        ok: /^READY pid=\d+/m.test(launchOut),
        label: "stdout has READY pid=<n>",
        detail: show(launchOut.split(/\r?\n/).find((line) => line.startsWith("READY ")) ?? ""),
      });
      checks.push({
        ok: demoPid !== null && pidAlive(demoPid),
        label: "detached demo java process is alive",
        detail: demoPid === null ? "PID= not parsed" : `pid=${demoPid}`,
      });
      checks.push({
        ok: pidFileLine !== null && path.resolve(REPO, pidFileLine[1].trim()) === pidFileAbs,
        label: "PID_FILE printed and pid file path matches the requested unique file",
        detail: pidFileLine ? pidFileLine[1] : "missing",
      });
      checks.push({
        ok: logDirLine !== null && path.resolve(REPO, logDirLine[1].trim()) === logsDirAbs,
        label: "LOG_DIR printed (work/logs)",
        detail: logDirLine ? logDirLine[1] : "missing",
      });

      let pidJson = null;
      if (existsSync(pidFileAbs)) {
        const parsedPid = parseJson(readFileSync(pidFileAbs, "utf8"));
        pidJson = parsedPid.ok ? parsedPid.value : null;
      }
      checks.push({
        ok: pidJson !== null && pidJson.pid === demoPid && Number(pidJson.startedAtMs) > 0 &&
          String(pidJson.jar).replace(/\\/g, "/").endsWith(DEMO_JAR_REL) &&
          /jdk1\.8\.0_221\/bin\/java\.exe$/.test(String(pidJson.java).replace(/\\/g, "/")),
        label: "PID JSON {pid,startedAtMs,java(JDK8),jar(demo)} matches the detached process",
        detail: pidJson ? show(pidJson) : "missing/unparsable",
      });

      const logNames = existsSync(logDir) ? readdirSync(logDir) : [];
      const newLogs = logNames.filter((name) => !logsBefore.has(name) && name.startsWith(`${S4_SESSION}-`));
      checks.push({
        ok: newLogs.some((name) => name.endsWith(".out.log")) && newLogs.some((name) => name.endsWith(".err.log")),
        label: "per-run out.log + err.log created in work/logs",
        detail: newLogs.join(",") || "none",
      });

      const orders = await tryRequest(8080, "/api/orders", { method: "GET" }, 10000);
      checks.push({
        ok: orders.ok && orders.status === 200,
        label: "health endpoint GET http://127.0.0.1:8080/api/orders -> 200",
        detail: orders.ok ? `status=${orders.status}` : String(orders.error),
      });

      const handshake = await pollUntil(async () => {
        const res = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_SESSION}/agent`, { method: "GET" }, 5000);
        if (!res.ok || res.status !== 200) return null;
        const parsed = parseJson(res.text);
        return parsed.ok && parsed.value?.connected === true ? { res, value: parsed.value } : null;
      }, 30000, 500);
      const hs = handshake?.value ?? {};
      checks.push({
        ok: Boolean(handshake) && hs.sessionId === S4_SESSION && typeof hs.version === "string" &&
          hs.version.length > 0 && hs.version.length <= 64 && hs.pid === demoPid &&
          Number.isInteger(hs.startedAtMs) && hs.startedAtMs >= 0 && Number.isInteger(hs.lastSeenMs) && hs.lastSeenMs > 0,
        label: "handshake GET /api/v1/sessions/s_s4launcher/agent -> 200 connected:true (agent pid matches)",
        detail: handshake ? show(handshake.value) : "404/timeout (agent hello not recorded)",
      });

      const cancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" }, 15000);
      checks.push({
        ok: cancel.ok && cancel.status >= 200 && cancel.status < 300,
        label: "POST /api/orders/1/cancel -> 2xx",
        detail: cancel.ok ? `status=${cancel.status} body=${show(cancel.text)}` : String(cancel.error),
      });

      const events = await pollUntil(async () => {
        const page = await getEventsPage(S4_SESSION, "?afterSeq=0&limit=200");
        const list = Array.isArray(page.value.events) ? page.value.events : [];
        return page.res.ok && page.res.status === 200 && list.length >= 4 ? list : null;
      }, 25000, 500);
      checks.push({
        ok: Boolean(events) && events.every((entry) => entry?.event?.sessionId === S4_SESSION),
        label: "collector recorded >=4 agent events for s_s4launcher",
        detail: events ? `events=${events.length} kinds=${events.map((entry) => entry.event.kind).join(",")}` : "timeout",
      });

      const stop = runLauncher(["stop", "--pid-file", pidFileAbs], { timeout: 60000 });
      checks.push({
        ok: stop.code === 0 && demoPid !== null && new RegExp(`STOPPED pid=${demoPid}\\b`).test(stop.stdout),
        label: "stop --pid-file -> exit 0 + STOPPED pid=<demo pid>",
        detail: `exit=${stop.code} stdout=${show(stop.stdout)} stderr=${show(stop.stderr)}`,
      });
      const portReleased = demoPid !== null
        ? await pollUntil(async () => listeningOn(8080).lines.length === 0 && !pidAlive(demoPid), 20000, 500)
        : false;
      checks.push({
        ok: Boolean(portReleased),
        label: "stop releases port 8080 and the demo pid is gone",
        detail: `listeners=${listeningOn(8080).lines.join(" | ") || "none"} alive=${demoPid !== null && pidAlive(demoPid)}`,
      });
      checks.push({
        ok: !existsSync(pidFileAbs),
        label: "stop deletes the PID file",
        detail: existsSync(pidFileAbs) ? "still present" : "deleted",
      });

      const stopAgain = runLauncher(["stop", "--pid-file", pidFileAbs], { timeout: 60000 });
      checks.push({
        ok: stopAgain.code === 0 && /NOT_RUNNING/.test(stopAgain.stdout),
        label: "repeat stop -> exit 0 + NOT_RUNNING (idempotent)",
        detail: `exit=${stopAgain.code} stdout=${show(stopAgain.stdout)}`,
      });

      writeFileSync(foreignAbs, `${JSON.stringify({
        pid: process.pid,
        startedAtMs: 0,
        java: `${JDK8_HOME}/bin/java.exe`.replace(/\\/g, "/"),
        jar: "C:/traceboard/fake-demo.jar",
      })}\n`, "utf8");
      const foreign = runLauncher(["stop", "--pid-file", foreignAbs], { timeout: 60000 });
      checks.push({
        ok: foreign.code === 3 && /PID_MISMATCH/.test(foreign.stderr) && !/STOPPED/.test(foreign.stdout) && pidAlive(process.pid),
        label: "foreign pid file (current node pid) -> exit 3 PID_MISMATCH, process not killed",
        detail: `exit=${foreign.code} stderr=${show(foreign.stderr)}`,
      });

      await stopServer(collector);
      collector = null;
      await sleep(1200);
      const nowPids = javaPids();
      const leaks = nowPids.filter((pid) => !baselinePids.includes(pid));
      checks.push({
        ok: leaks.length === 0 && (demoPid === null || !nowPids.includes(demoPid)),
        label: "no orphan java processes after stop + collector shutdown",
        detail: leaks.length ? `leaked=${leaks.join(",")}` : `java pids=${nowPids.join(",") || "none"}`,
      });
    }
  } finally {
    if (demoPid !== null && pidAlive(demoPid)) {
      spawnSync("taskkill", ["/PID", String(demoPid), "/T", "/F"], { windowsHide: true });
    }
    if (collector) await stopServer(collector);
    for (const file of [pidFileAbs, foreignAbs]) {
      try {
        rmSync(file, { force: true });
      } catch {
        /* best effort */
      }
    }
    try {
      for (const name of readdirSync(logsDirAbs)) {
        if (!logsBefore.has(name) && name.startsWith(`${S4_SESSION}-`)) {
          rmSync(path.join(logsDirAbs, name), { force: true });
        }
      }
    } catch {
      /* best effort */
    }
  }

  S4_EVIDENCE.launch = { ...(S4_EVIDENCE.launch ?? {}), detachedPid: demoPid };
  return gate(
    "S4-B",
    "launcher `jar --detach`/`stop`: PID+logs, health, handshake, cancel events, port release, NOT_RUNNING, PID_MISMATCH, no orphans",
    checks,
    repro,
  );
}

/**
 * S4-C: the agent handshake is a control path, not an event. Exact 200 body, GET agent shape,
 * fixed failure order (405 -> 415 -> 413 -> 400), last-wins, 404/405, and the invariants
 * (no session, no event, no seq, meta stays 5 keys).
 */
async function checkS4C() {
  section("S4-C: agent handshake (/ingest/v1/agent-hello + GET .../agent)");
  const checks = [];
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const port = listeningOn(8601);
  const pre = [
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: port.supported && port.lines.length === 0, label: "port 8601 free before start", detail: port.lines.join(" | ") || "no listener" },
  ];
  const repro = `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/agent-hello" -H "Content-Type: application/json; charset=utf-8" --data-binary '{"schema":"traceboard.agent.v1","sessionId":"s_s4hello","version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000}'`;
  if (!pre.every((item) => item.ok)) {
    return record(
      "S4-C",
      "agent handshake contract (preconditions)",
      false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro,
    );
  }

  const helloBody = `{"schema":"traceboard.agent.v1","sessionId":"${S4_HELLO_SESSION}","version":"0.1.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000}`;
  const agentShape = /^\{"sessionId":"s_s4hello","connected":true,"version":"0\.1\.0-SNAPSHOT","pid":12345,"startedAtMs":1763900000000,"lastSeenMs":\d+\}$/;
  let collector = null;
  try {
    collector = startJavaServer("collector(8601) S4-C", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector health 200", detail: health ? "UP" : "timeout" });

    if (health) {
      const valid = await postJson(helloBody);
      checks.push({
        ok: valid.ok && valid.status === 200 && valid.text.trim() === S4_HELLO_ACCEPTED,
        label: "valid hello -> 200 exact {schema,sessionId,accepted:true}",
        detail: valid.ok ? `status=${valid.status} body=${show(valid.text)}` : String(valid.error),
      });

      const agent1 = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_HELLO_SESSION}/agent`, { method: "GET" }, 10000);
      const agent1Parsed = agent1.ok ? parseJson(agent1.text.trim()) : { ok: false };
      checks.push({
        ok: agent1.ok && agent1.status === 200 && agentShape.test(agent1.text.trim()) &&
          agent1Parsed.ok && Object.keys(agent1Parsed.value ?? {}).length === 6 &&
          Number(agent1Parsed.value.lastSeenMs) > 0,
        label: "GET agent -> 200 exact 6-field shape (connected:true, collector lastSeenMs)",
        detail: agent1.ok ? `status=${agent1.status} body=${show(agent1.text)}` : String(agent1.error),
      });
      const agent2 = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_HELLO_SESSION}/agent`, { method: "GET" }, 10000);
      checks.push({
        ok: agent2.ok && agent2.status === 200 && agent2.text === agent1.text,
        label: "repeated GET agent (no new hello) is byte-identical (read-only)",
        detail: agent2.ok && agent2.text === agent1.text ? "identical" : `a=${show(agent1.text)} b=${show(agent2.text)}`,
      });

      const badJson = await postJson("{S4C-INVALID");
      checks.push(...envelopeChecks(badJson, 400, "bad_request", "invalid JSON hello", ["S4C-INVALID"]));

      const oversize = await postJson(JSON.stringify({
        schema: "traceboard.agent.v1",
        sessionId: S4_HELLO_SESSION,
        version: "0.1.0-SNAPSHOT",
        pid: 1,
        startedAtMs: 0,
        pad: `S4C-OVERSIZE-${"a".repeat(4200)}`,
      }));
      checks.push(...envelopeChecks(oversize, 413, "payload_too_large", ">4096B hello body", ["S4C-OVERSIZE"]));

      const wrongType = await postJson(helloBody, "text/plain");
      checks.push(...envelopeChecks(wrongType, 415, "unsupported_media_type", "text/plain hello", []));

      const bigPlain = await postJson(JSON.stringify({ pad: "a".repeat(5000) }), "text/plain");
      checks.push({
        ok: bigPlain.ok && bigPlain.status === 415,
        label: "oversized body + text/plain -> 415 (media type is decided before size)",
        detail: bigPlain.ok ? `status=${bigPlain.status}` : String(bigPlain.error),
      });

      const getHello = await requestBase(COLLECTOR_BASE, "/ingest/v1/agent-hello", { method: "GET" }, 10000);
      checks.push({
        ok: getHello.ok && getHello.status === 405,
        label: "GET /ingest/v1/agent-hello -> 405 (non-POST)",
        detail: getHello.ok ? `status=${getHello.status}` : String(getHello.error),
      });

      const agentAfterFailures = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_HELLO_SESSION}/agent`, { method: "GET" }, 10000);
      const afterParsed = agentAfterFailures.ok ? parseJson(agentAfterFailures.text.trim()) : { ok: false };
      checks.push({
        ok: agentAfterFailures.ok && agentAfterFailures.status === 200 && afterParsed.ok &&
          afterParsed.value.pid === 12345 && afterParsed.value.version === "0.1.0-SNAPSHOT",
        label: "failed hellos (400/413/415) do not overwrite the recorded handshake",
        detail: agentAfterFailures.ok ? show(agentAfterFailures.text) : String(agentAfterFailures.error),
      });

      const postAgent = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_HELLO_SESSION}/agent`, { method: "POST" }, 10000);
      checks.push({
        ok: postAgent.ok && postAgent.status === 405,
        label: "POST .../agent -> 405 (GET only)",
        detail: postAgent.ok ? `status=${postAgent.status}` : String(postAgent.error),
      });

      const unknown = await requestBase(COLLECTOR_BASE, "/api/v1/sessions/s_none_s4/agent", { method: "GET" }, 10000);
      checks.push(...envelopeChecks(unknown, 404, "not_found", "unknown session agent", []));

      const invalidShape = await requestBase(COLLECTOR_BASE, "/api/v1/sessions/not_a_session/agent", { method: "GET" }, 10000);
      checks.push({
        ok: invalidShape.ok && invalidShape.status === 404,
        label: "invalid sessionId shape on GET agent -> 404 (not 400)",
        detail: invalidShape.ok ? `status=${invalidShape.status}` : String(invalidShape.error),
      });

      const winBody = `{"schema":"traceboard.agent.v1","sessionId":"${S4_HELLO_SESSION}","version":"9.9.9-wins","pid":222,"startedAtMs":42,"extra":"ignored"}`;
      const win = await postJson(winBody);
      const winAgent = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_HELLO_SESSION}/agent`, { method: "GET" }, 10000);
      const winParsed = winAgent.ok ? parseJson(winAgent.text.trim()) : { ok: false };
      checks.push({
        ok: win.ok && win.status === 200 && win.text.trim() === S4_HELLO_ACCEPTED &&
          winParsed.ok && winParsed.value.version === "9.9.9-wins" && winParsed.value.pid === 222 &&
          winParsed.value.startedAtMs === 42 && Object.keys(winParsed.value).length === 6,
        label: "last-wins: second hello replaces version/pid/startedAtMs, unknown field ignored",
        detail: winAgent.ok ? show(winAgent.text) : String(winAgent.error),
      });

      const sessionsRes = await requestBase(COLLECTOR_BASE, "/api/v1/sessions", { method: "GET" }, 10000);
      const sessionsParsed = sessionsRes.ok ? parseJson(sessionsRes.text) : { ok: false };
      const sessions = Array.isArray(sessionsParsed.value?.sessions) ? sessionsParsed.value.sessions : [];
      checks.push({
        ok: sessionsRes.ok && sessionsRes.status === 200 && !sessions.some((item) => item?.sessionId === S4_HELLO_SESSION),
        label: "hello-only session does not appear in GET /api/v1/sessions",
        detail: `sessions=${sessions.map((item) => item?.sessionId).join(",") || "none"}`,
      });
      const helloEvents = await getEventsPage(S4_HELLO_SESSION);
      checks.push(...envelopeChecks(helloEvents.res, 404, "not_found", "hello-only session events", []));

      const firstEvent = readFileSync(abs(EVENTS_REL), "utf8").split(/\r?\n/).find((line) => line.trim() !== "");
      const ingest = await postNdjson("/ingest/v1/events", `${firstEvent}\n`, `${NDJSON}; charset=utf-8`);
      const ingestBody = ingest.ok ? parseJson(ingest.text) : { ok: false };
      const fixtureSession = "s_demo_s0_case_a";
      const page = await getEventsPage(fixtureSession, "?afterSeq=0&limit=10");
      const pageEvents = Array.isArray(page.value.events) ? page.value.events : [];
      checks.push({
        ok: ingest.ok && ingest.status === 202 && ingestBody.ok && ingestBody.value?.accepted === 1 &&
          page.res.ok && page.res.status === 200 && pageEvents.length === 1 &&
          pageEvents[0].seq === 1 && page.value.nextSeq === 1,
        label: "hellos consumed no seq: first real event after 4 hellos has seq=1/nextSeq=1",
        detail: `ingest=${ingest.status} ${show(ingest.text)} page=${show(page.value)}`,
      });

      const meta = await requestBase(COLLECTOR_BASE, "/api/v1/meta", { method: "GET" }, 10000);
      const metaBody = meta.ok ? parseJson(meta.text) : { ok: false };
      const caps = metaBody.ok && metaBody.value && typeof metaBody.value.capabilities === "object" ? metaBody.value.capabilities : {};
      checks.push({
        ok: meta.ok && meta.status === 200 && deepEqual(Object.keys(caps), S4_META_KEYS) &&
          caps.health === true && caps.meta === true && caps.ingestEvents === true &&
          caps.realtime === false && caps.replay === true,
        label: "meta capabilities still exactly 5 keys (realtime=false, replay=true; hello is not a capability)",
        detail: `keys=${Object.keys(caps).join(",")}`,
      });

      S4_EVIDENCE.hello = {
        accepted: valid.ok ? valid.text.trim() : null,
        agent: agent1.ok ? agent1.text.trim() : null,
        lastWins: winAgent.ok ? winAgent.text.trim() : null,
      };
    }
  } finally {
    await stopServer(collector);
  }

  return gate(
    "S4-C",
    "agent handshake: exact 200 body, GET agent shape/404/405, 415->413->400, last-wins, no session/event/seq, meta 5 keys",
    checks,
    repro,
  );
}

/**
 * S4-D: preview reverse proxy (static stub 18080 -> launcher preview 8602 -> collector 8601).
 * Asserts injection right before the last </body> with two external scripts, recomputed UTF-8
 * Content-Length, stripped Content-Encoding/Transfer-Encoding/ETag/Last-Modified, local
 * config.js/sdk.js, byte-exact pass-through for head/no_body/status/encoding/not_html/too_large,
 * the /ingest/v1/events proxy (202) vs other /ingest/* (404), collector-down 502, target-down
 * 502 not-injected:read_error and SDK_IIFE_MISSING. Preview/stub/collector are always stopped.
 */
async function checkS4D() {
  section("S4-D: preview injection + reverse proxy (stub 18080, collector 8601, preview 8602)");
  const checks = [];
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const launcherJar = abs(S4_LAUNCHER_JAR_REL);
  const sdkIife = abs(S4_SDK_IIFE_REL);
  const portStates = [8601, 8602, S4_STUB_PORT].map((port) => ({ port, state: listeningOn(port) }));
  const pre = [
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(launcherJar), label: "launcher jar exists", detail: S4_LAUNCHER_JAR_REL },
    { ok: existsSync(sdkIife), label: "SDK IIFE exists (repo-root default for preview)", detail: S4_SDK_IIFE_REL },
    ...portStates.map(({ port, state }) => ({
      ok: state.supported && state.lines.length === 0,
      label: `port ${port} free before start`,
      detail: state.lines.join(" | ") || "no listener",
    })),
  ];
  const repro = `"${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" preview --target "http://127.0.0.1:${S4_STUB_PORT}" --port 8602 --collector "${COLLECTOR_BASE}" --session "${S4_PREVIEW_SESSION}"`;
  if (!pre.every((item) => item.ok)) {
    return record(
      "S4-D",
      "preview injection + reverse proxy (preconditions)",
      false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro,
    );
  }

  const tags = '<script src="/traceboard/config.js"></script><script src="/traceboard/sdk.js"></script>';
  const expectedConfig = `window.__TRACEBOARD_CONFIG__ = {"sessionId":"${S4_PREVIEW_SESSION}","ingestUrl":"/ingest","appName":"traceboard-preview","observeMs":1500};`;
  const previewBase = S4_PREVIEW_BASE;
  const header = (res, name) => (res.ok ? res.headers[name.toLowerCase()] ?? null : null);
  const isAbsent = (res, names) => names.every((name) => header(res, name) === null);

  let collector = null;
  let preview = null;
  let stub = null;
  try {
    collector = startJavaServer("collector(8601) S4-D", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector 8601 /actuator/health 200", detail: health ? "UP" : "timeout" });

    stub = await startS4Stub();
    checks.push({
      ok: stub.server.listening === true,
      label: `static HTML stub listening on 127.0.0.1:${S4_STUB_PORT}`,
      detail: `${Buffer.byteLength(stub.html, "utf8")} byte page + /plain /latin /fragment /gzip /big /nobody /missing`,
    });

    preview = startJavaServer("preview(8602) S4-D", JDK21_JAVA, [
      "-jar", launcherJar, "preview",
      "--target", `http://127.0.0.1:${S4_STUB_PORT}`, "--port", "8602",
      "--collector", COLLECTOR_BASE, "--session", S4_PREVIEW_SESSION,
    ], REPO);
    const ready = await pollUntil(async () => {
      const res = await httpRaw(`${previewBase}/`, { headers: { "Accept-Encoding": "gzip" } });
      return res.ok && res.status === 200 ? res : null;
    }, 45000, 250);
    checks.push({
      ok: Boolean(ready) && /PREVIEW_READY url=http:\/\/127\.0\.0\.1:8602/.test(preview.log.text),
      label: "preview 8602 answers and prints PREVIEW_READY (repo-root SDK default, no --sdk)",
      detail: ready ? lastLines(preview.log.text, 3).join(" | ").slice(0, 300) : `log=${lastLines(preview.log.text, 4).join(" | ").slice(0, 300)}`,
    });

    if (health && ready) {
      // ---------------------------------------------------------------- injected HTML
      const bodyClose = stub.html.toLowerCase().lastIndexOf("</body>");
      const expectedHtml = bodyClose < 0 ? null : stub.html.slice(0, bodyClose) + tags + stub.html.slice(bodyClose);
      const html = await httpRaw(`${previewBase}/`, { headers: { "Accept-Encoding": "gzip" } });
      const htmlText = html.ok ? html.text : "";
      const tagCount = (htmlText.match(/<script src="\/traceboard\/(config|sdk)\.js"><\/script>/g) ?? []).length;
      checks.push({
        ok: html.ok && html.status === 200 && expectedHtml !== null && htmlText === expectedHtml && tagCount === 2,
        label: "GET / -> 200, both external /traceboard scripts inserted exactly once right before the last </body>",
        detail: `status=${html.status} bytes=${html.buf?.length ?? 0} tags=${tagCount}`,
      });
      checks.push({
        ok: header(html, "x-traceboard-preview") === "injected",
        label: "injected response carries X-TraceBoard-Preview: injected",
        detail: `x-traceboard-preview=${header(html, "x-traceboard-preview")}`,
      });
      checks.push({
        ok: Number(header(html, "content-length")) === Buffer.byteLength(expectedHtml ?? "", "utf8") &&
          Number(header(html, "content-length")) === (html.buf?.length ?? -1),
        label: "Content-Length equals the rewritten UTF-8 byte length (and the bytes actually sent)",
        detail: `content-length=${header(html, "content-length")} body=${html.buf?.length ?? "?"} expected=${Buffer.byteLength(expectedHtml ?? "", "utf8")}`,
      });
      checks.push({
        ok: isAbsent(html, ["content-encoding", "transfer-encoding", "etag", "last-modified", "content-md5"]),
        label: "injected response has no Content-Encoding/Transfer-Encoding/ETag/Last-Modified/Content-MD5",
        detail: ["content-encoding", "transfer-encoding", "etag", "last-modified", "content-md5"]
          .map((name) => `${name}=${header(html, name)}`).join(" "),
      });
      const forwardedHtml = stub.requests.filter((req) => req.method === "GET" && req.pathname === "/").pop();
      checks.push({
        ok: Boolean(forwardedHtml) && forwardedHtml.headers["accept-encoding"] === undefined,
        label: "forwarded target request drops the client Accept-Encoding (no content negotiation)",
        detail: forwardedHtml ? `accept-encoding=${forwardedHtml.headers["accept-encoding"] ?? "absent"}` : "no stub record",
      });

      // ---------------------------------------------------------------- local scripts
      const config = await httpRaw(`${previewBase}/traceboard/config.js`);
      checks.push({
        ok: config.ok && config.status === 200 && config.text === expectedConfig &&
          config.text.includes(S4_PREVIEW_SESSION) && config.text.includes('"ingestUrl":"/ingest"') &&
          header(config, "x-traceboard-preview") === null,
        label: 'config.js: exact window.__TRACEBOARD_CONFIG__ with session s_s4preview + ingestUrl "/ingest" (SDK derives /v1/events)',
        detail: config.ok ? `status=${config.status} body=${show(config.text)}` : String(config.error),
      });
      const sdkRes = await httpRaw(`${previewBase}/traceboard/sdk.js`);
      const sdkBytes = readFileSync(sdkIife);
      checks.push({
        ok: sdkRes.ok && sdkRes.status === 200 && sdkRes.buf.equals(sdkBytes) &&
          sdkRes.text.includes("TraceBoardSDK") && header(sdkRes, "x-traceboard-preview") === null,
        label: "sdk.js: byte-identical IIFE containing TraceBoardSDK, no preview header",
        detail: sdkRes.ok ? `status=${sdkRes.status} bytes=${sdkRes.buf.length}` : String(sdkRes.error),
      });

      // ---------------------------------------------------------------- not-injected codes
      const plain = await httpRaw(`${previewBase}/plain`);
      checks.push({
        ok: plain.ok && plain.status === 200 && header(plain, "x-traceboard-preview") === "not-injected:not_html" &&
          plain.text === "plain-body",
        label: "/plain (text/plain) -> not-injected:not_html, body byte-identical (no script tags)",
        detail: `status=${plain.status} type=${header(plain, "content-type")} body=${show(plain.text)}`,
      });
      const fragment = await httpRaw(`${previewBase}/fragment`);
      checks.push({
        ok: fragment.ok && fragment.status === 200 && header(fragment, "x-traceboard-preview") === "not-injected:no_body" &&
          fragment.text === "<div>fragment</div>",
        label: "HTML without </body> -> not-injected:no_body, body unchanged",
        detail: `status=${fragment.status} body=${show(fragment.text)}`,
      });
      const missing = await httpRaw(`${previewBase}/missing`);
      checks.push({
        ok: missing.ok && missing.status === 404 && header(missing, "x-traceboard-preview") === "not-injected:status" &&
          missing.text === "<html><body>missing</body></html>" && !missing.text.includes("/traceboard/"),
        label: "upstream 404 HTML page -> not-injected:status, never injected (a 404 cannot look PASS)",
        detail: `status=${missing.status} body=${show(missing.text)}`,
      });
      const unknown = await httpRaw(`${previewBase}/traceboard/unknown.js`);
      checks.push({
        ok: unknown.ok && unknown.status === 404 && header(unknown, "x-traceboard-preview") === "not-injected:status",
        label: "unknown /traceboard/* path falls through to the target 404 (not-injected:status)",
        detail: `status=${unknown.status}`,
      });
      const nobody = await httpRaw(`${previewBase}/nobody`);
      checks.push({
        ok: nobody.ok && nobody.status === 204 && header(nobody, "x-traceboard-preview") === "not-injected:no_body" &&
          nobody.buf.length === 0,
        label: "204 -> not-injected:no_body, empty body",
        detail: `status=${nobody.status} bytes=${nobody.buf?.length ?? "?"}`,
      });
      const head = await httpRaw(`${previewBase}/`, { method: "HEAD" });
      checks.push({
        ok: head.ok && head.status === 200 && header(head, "x-traceboard-preview") === "not-injected:head" &&
          head.buf.length === 0,
        label: "HEAD / -> not-injected:head, no body (headers only)",
        detail: `status=${head.status} bytes=${head.buf?.length ?? "?"}`,
      });
      const gzip = await httpRaw(`${previewBase}/gzip`, { headers: { "Accept-Encoding": "gzip" } });
      checks.push({
        ok: gzip.ok && gzip.status === 200 && header(gzip, "x-traceboard-preview") === "not-injected:encoding" &&
          gzip.buf.equals(stub.gzipHtml) && header(gzip, "content-encoding") === "gzip",
        label: "gzip upstream -> not-injected:encoding, compressed body byte-identical (no decompress/inject)",
        detail: `status=${gzip.status} content-encoding=${header(gzip, "content-encoding")} bytes=${gzip.buf?.length ?? "?"}`,
      });
      const latin = await httpRaw(`${previewBase}/latin`);
      checks.push({
        ok: latin.ok && latin.status === 200 && header(latin, "x-traceboard-preview") === "not-injected:encoding" &&
          latin.text === "<html><body>latin</body></html>",
        label: "text/html with charset=iso-8859-1 -> not-injected:encoding, body unchanged",
        detail: `status=${latin.status} type=${header(latin, "content-type")}`,
      });
      const big = await httpRaw(`${previewBase}/big`);
      checks.push({
        ok: big.ok && big.status === 200 && header(big, "x-traceboard-preview") === "not-injected:too_large" &&
          big.buf.length === Buffer.byteLength(stub.big, "utf8") &&
          Number(header(big, "content-length")) === big.buf.length,
        label: ">2MB HTML -> not-injected:too_large, body byte-identical",
        detail: `status=${big.status} bytes=${big.buf?.length ?? "?"} content-length=${header(big, "content-length")}`,
      });

      // ---------------------------------------------------------------- ingest proxy
      const caseA = readFileSync(abs(S3_CASE_A_EVENTS), "utf8")
        .split(/\r?\n/).filter((line) => line.trim() !== "").slice(0, 2);
      const batch = `${caseA.join("\n")}\n`;
      const post = await httpRaw(`${previewBase}/ingest/v1/events`, {
        method: "POST",
        headers: { "Content-Type": NDJSON },
        body: batch,
        timeoutMs: 30000,
      });
      const postParsed = post.ok ? parseJson(post.text) : { ok: false };
      checks.push({
        ok: post.ok && post.status === 202 && postParsed.ok && postParsed.value?.accepted === 2 &&
          postParsed.value?.rejected === 0 && header(post, "x-traceboard-preview") === null,
        label: "POST /ingest/v1/events (S3 case A first 2 lines) -> 202 accepted=2/rejected=0 via collector, no preview header",
        detail: post.ok ? `status=${post.status} body=${show(post.text)}` : String(post.error),
      });
      const stored = await requestBase(
        COLLECTOR_BASE,
        "/api/v1/sessions/s_s3demo/events?afterSeq=0&limit=10",
        { method: "GET" },
        10000,
      );
      const storedParsed = stored.ok ? parseJson(stored.text) : { ok: false };
      checks.push({
        ok: stored.ok && stored.status === 200 && Array.isArray(storedParsed.value?.events) &&
          storedParsed.value.events.length === 2 && storedParsed.value.nextSeq === 2,
        label: "proxied events really landed in collector 8601 (s_s3demo seq=1..2)",
        detail: stored.ok ? `status=${stored.status} events=${storedParsed.value?.events?.length ?? "?"} nextSeq=${storedParsed.value?.nextSeq}` : String(stored.error),
      });
      const otherIngest = await httpRaw(`${previewBase}/ingest/v1/agent-hello`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      checks.push({
        ok: otherIngest.ok && otherIngest.status === 404 && header(otherIngest, "x-traceboard-preview") === null &&
          otherIngest.text.includes("只代理"),
        label: "other /ingest/* (agent-hello) -> 404, no open write proxy",
        detail: `status=${otherIngest.status} body=${show(otherIngest.text)}`,
      });
      const otherPath = await httpRaw(`${previewBase}/ingest/events`, {
        method: "POST",
        headers: { "Content-Type": NDJSON },
        body: batch,
      });
      checks.push({
        ok: otherPath.ok && otherPath.status === 404,
        label: "non-/ingest/v1/events path under /ingest/ -> 404",
        detail: `status=${otherPath.status}`,
      });

      // ---------------------------------------------------------------- collector down -> 502
      await stopServer(collector);
      collector = null;
      const collectorDown = await pollUntil(async () => {
        const res = await httpRaw(`${previewBase}/ingest/v1/events`, {
          method: "POST",
          headers: { "Content-Type": NDJSON },
          body: batch,
          timeoutMs: 20000,
        });
        return res.ok && res.status === 502 ? res : null;
      }, 20000, 300);
      checks.push({
        ok: Boolean(collectorDown) && collectorDown.text.includes("collector unreachable") &&
          header(collectorDown, "x-traceboard-preview") === null,
        label: "collector down -> 502 + explanation (never a fake 202)",
        detail: collectorDown ? `status=${collectorDown.status} body=${show(collectorDown.text)}` : "no 502 within 20s",
      });

      // ---------------------------------------------------------------- target down -> 502 read_error
      await stub.close();
      stub = null;
      const targetDown = await pollUntil(async () => {
        const res = await httpRaw(`${previewBase}/`, { timeoutMs: 20000 });
        return res.ok && res.status === 502 ? res : null;
      }, 15000, 300);
      checks.push({
        ok: Boolean(targetDown) && header(targetDown, "x-traceboard-preview") === "not-injected:read_error" &&
          targetDown.text.includes("target unreachable") && !targetDown.text.includes("/traceboard/"),
        label: "target down -> 502 with X-TraceBoard-Preview: not-injected:read_error (no injection)",
        detail: targetDown ? `status=${targetDown.status} body=${show(targetDown.text)}` : "no 502 within 15s",
      });

      // ---------------------------------------------------------------- CLI boundary tokens
      await stopServer(preview);
      preview = null;
      const tlsTarget = runLauncher([
        "preview", "--target", "https://127.0.0.1:18080", "--port", "8602",
        "--collector", COLLECTOR_BASE, "--session", S4_PREVIEW_SESSION,
      ], { timeout: 60000 });
      checks.push({
        ok: tlsTarget.code === 3 && /TARGET_TLS_UNSUPPORTED/.test(tlsTarget.stderr),
        label: "https --target -> exit 3 + TARGET_TLS_UNSUPPORTED (no TLS)",
        detail: `exit=${tlsTarget.code} ${lastLines(tlsTarget.stderr, 1).join("").slice(0, 240)}`,
      });
      const nonLoopback = runLauncher([
        "preview", "--target", "http://example.com:18080", "--port", "8602",
        "--collector", COLLECTOR_BASE, "--session", S4_PREVIEW_SESSION,
      ], { timeout: 60000 });
      checks.push({
        ok: nonLoopback.code === 2 && /NON_LOOPBACK_TARGET/.test(nonLoopback.stderr),
        label: "non-loopback --target without --allow-non-loopback -> exit 2 + NON_LOOPBACK_TARGET",
        detail: `exit=${nonLoopback.code} ${lastLines(nonLoopback.stderr, 1).join("").slice(0, 240)}`,
      });

      // ---------------------------------------------------------------- SDK missing
      const emptyCwd = mkdtempSync(path.join(os.tmpdir(), "traceboard-s4preview-"));
      tmpDirs.push(emptyCwd);
      const cleanEnv = { ...process.env };
      for (const name of ["TRACEBOARD_SDK_IIFE", "JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS"]) {
        delete cleanEnv[name];
      }
      const missingSdk = runLauncher([
        "preview", "--target", `http://127.0.0.1:${S4_STUB_PORT}`, "--port", "8602",
        "--collector", COLLECTOR_BASE, "--session", S4_PREVIEW_SESSION,
        "--sdk", path.join(emptyCwd, "missing-sdk.js"),
      ], { cwd: emptyCwd, env: cleanEnv, timeout: 60000 });
      checks.push({
        ok: missingSdk.code === 3 && /SDK_IIFE_MISSING/.test(missingSdk.stderr) &&
          /npm ci && npm run build/.test(missingSdk.stderr),
        label: "missing --sdk with no repo-root default (cwd outside repo) -> exit 3 + SDK_IIFE_MISSING + build advice",
        detail: `exit=${missingSdk.code} ${lastLines(missingSdk.stderr, 2).join(" | ").slice(0, 300)}`,
      });

      S4_EVIDENCE.preview = {
        injectedStatus: html.status,
        contentLength: header(html, "content-length"),
        config: expectedConfig,
        ingestStatus: post.status,
        notInjected: {
          plain: header(plain, "x-traceboard-preview"),
          fragment: header(fragment, "x-traceboard-preview"),
          missing: header(missing, "x-traceboard-preview"),
          nobody: header(nobody, "x-traceboard-preview"),
          head: header(head, "x-traceboard-preview"),
          gzip: header(gzip, "x-traceboard-preview"),
          latin: header(latin, "x-traceboard-preview"),
          big: header(big, "x-traceboard-preview"),
        },
        targetDown: targetDown ? header(targetDown, "x-traceboard-preview") : null,
        tlsExit: tlsTarget.code,
        nonLoopbackExit: nonLoopback.code,
        missingSdkExit: missingSdk.code,
      };
    }
  } finally {
    await stopServer(preview);
    await stopServer(collector);
    if (stub) {
      await stub.close();
      stub = null;
    }
  }

  for (const port of [8602, 8601, S4_STUB_PORT]) {
    const released = await pollUntil(async () => listeningOn(port).lines.length === 0, 15000, 300);
    checks.push({
      ok: Boolean(released),
      label: `port ${port} released after preview/stub/collector cleanup`,
      detail: released ? "no listener" : listeningOn(port).lines.join(" | ") || "still listening",
    });
  }

  return gate(
    "S4-D",
    "preview: injection before the last </body> + recomputed Content-Length + stripped headers; config/sdk; not-injected head/no_body/status/encoding/not_html/too_large/read_error; /ingest/v1/events 202 vs 404; target/collector down 502; SDK_IIFE_MISSING; ports released",
    checks,
    repro,
  );
}

/**
 * S4-E: SDK IIFE gate. Builds and tests frontend/sdk (17 node --test cases, S5 manifest/source included),
 * asserts the 3-file dist with no sourcemap/external URL/CDN, then evaluates the real bundle in
 * a vm sandbox: auto-init exactly once from __TRACEBOARD_CONFIG__ (derived /ingest/v1/events),
 * double-load guard, no-config no-init, bad-config fail-open.
 */
async function checkS4E() {
  section("S4-E: SDK IIFE (17 tests, 3 dist files, global/version, vm auto-init/guard/fail-open)");
  const checks = [];
  const sdkDir = abs(SDK_DIR);
  const iifeRel = S4_SDK_IIFE_REL;
  const repro = `(cd "${SDK_DIR}" && npm ci && npm run build && npm test)`;
  const pre = [
    { ok: existsSync(abs(`${SDK_DIR}/package.json`)), label: "frontend/sdk/package.json exists", detail: `${SDK_DIR}/package.json` },
    { ok: existsSync(abs(`${SDK_DIR}/test/iife.test.js`)) && existsSync(abs(`${SDK_DIR}/test/sdk.test.js`)), label: "SDK ESM + IIFE test files exist", detail: "test/sdk.test.js test/iife.test.js" },
  ];
  if (!pre.every((item) => item.ok)) {
    return record(
      "S4-E",
      "SDK IIFE (preconditions)",
      false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro,
    );
  }

  const build = runShell("npm run build", { cwd: sdkDir, timeout: 600000 });
  checks.push({
    ok: build.code === 0 && !build.error,
    label: "npm run build (tsc ESM + .d.ts, esbuild IIFE) exit 0",
    detail: `exit=${build.code} ${lastLines(`${build.stdout}\n${build.stderr}`, 1).join(" ").slice(0, 240)}`,
  });
  const test = runShell("npm test", { cwd: sdkDir, timeout: 600000 });
  const testOut = `${test.stdout}\n${test.stderr}`;
  const testsMatch = testOut.match(/# tests (\d+)/);
  const passMatch = testOut.match(/# pass (\d+)/);
  const failMatch = testOut.match(/# fail (\d+)/);
  checks.push({
    ok: test.code === 0 && testsMatch?.[1] === "17" && passMatch?.[1] === "17" && failMatch?.[1] === "0",
    label: "npm test (pretest build) -> node --test: 17 tests / 17 pass / 0 fail (S5 manifest/source included)",
    detail: `tests=${testsMatch?.[1] ?? "?"} pass=${passMatch?.[1] ?? "?"} fail=${failMatch?.[1] ?? "?"}`,
  });

  const dist = walk(abs(SDK_DIST_REL));
  checks.push({
    ok: deepEqual(dist.map(relOf).sort(), [
      `${SDK_DIST_REL}/index.d.ts`,
      `${SDK_DIST_REL}/index.js`,
      `${SDK_DIST_REL}/traceboard-sdk.iife.js`,
    ]),
    label: "dist has exactly index.js + index.d.ts + traceboard-sdk.iife.js",
    detail: dist.map(relOf).join(","),
  });
  checks.push({
    ok: dist.every((file) => !file.endsWith(".map")),
    label: "dist has no *.map sourcemap",
    detail: "0 maps",
  });

  const bundle = readFileSync(abs(iifeRel), "utf8");
  const sdkPkg = JSON.parse(readFileSync(abs(`${SDK_DIR}/package.json`), "utf8"));
  checks.push({
    ok: /var TraceBoardSDK = /.test(bundle) && bundle.includes('version = "0.1.0"') &&
      sdkPkg.version === "0.1.0" &&
      deepEqual(Object.keys(sdkPkg.devDependencies ?? {}).sort(), ["esbuild", "typescript"]) &&
      Object.keys(sdkPkg.dependencies ?? {}).length === 0,
    label: "bundle defines global TraceBoardSDK + version 0.1.0; devDeps esbuild+typescript only, no runtime deps",
    detail: `bytes=${Buffer.byteLength(bundle, "utf8")} pkgVersion=${sdkPkg.version}`,
  });
  checks.push({
    ok: !bundle.includes("sourceMappingURL") && !bundle.includes("https://") &&
      !/jsdelivr|unpkg|cdnjs/.test(bundle) && !/\brequire\s*\(/.test(bundle),
    label: "bundle: no sourceMappingURL, no external https/CDN, self-contained (no require)",
    detail: "clean",
  });
  checks.push({
    ok: bundle.includes("__TRACEBOARD_CONFIG__") && bundle.includes("__TRACEBOARD_AUTO_INIT__") &&
      bundle.includes("__TRACEBOARD_SDK_ACTIVE__"),
    label: "bundle reads window.__TRACEBOARD_CONFIG__ and carries both auto-init guards",
    detail: "config + guards present",
  });

  const makeSandbox = (config) => {
    const clicks = [];
    const posts = [];
    const warnings = [];
    const sandbox = {
      console: { warn: (message) => warnings.push(String(message)), log() {}, error() {} },
      setTimeout,
      clearTimeout,
      queueMicrotask,
      TextEncoder,
      Headers,
      URL,
      Math,
      Date,
      JSON,
      Promise,
      Uint8Array,
      document: {
        addEventListener(type, handler, capture) {
          if (type === "click" && capture === true) {
            clicks.push(handler);
          }
        },
      },
      location: { href: "http://127.0.0.1:8602/" },
      addEventListener() {},
      fetch(input, init) {
        const url = typeof input === "string" ? input : String(input && input.url ? input.url : input);
        posts.push({ url, init });
        return Promise.resolve({ status: 202 });
      },
    };
    sandbox.window = sandbox;
    if (config !== undefined) {
      sandbox.__TRACEBOARD_CONFIG__ = config;
    }
    return { sandbox, context: vm.createContext(sandbox), clicks, posts, warnings };
  };
  const runIife = (context) => vm.runInContext(bundle, context, { filename: "traceboard-sdk.iife.js" });
  const clickTarget = (id) => ({
    tagName: "BUTTON",
    id,
    textContent: id,
    parentElement: null,
    children: [],
    getAttribute() {
      return null;
    },
  });
  const ingestEvents = (posts) => {
    const events = [];
    for (const post of posts) {
      const body = post.init && typeof post.init.body === "string" ? post.init.body : "";
      for (const line of body.split("\n")) {
        if (line.trim() !== "") {
          events.push(JSON.parse(line));
        }
      }
    }
    return events;
  };

  const auto = makeSandbox({ sessionId: "s_s4verify", ingestUrl: "/ingest", appName: "traceboard-preview", observeMs: 25 });
  let autoThrew = null;
  try {
    runIife(auto.context);
  } catch (error) {
    autoThrew = error;
  }
  checks.push({
    ok: autoThrew === null && auto.clicks.length === 1 &&
      auto.sandbox.__TRACEBOARD_SDK_ACTIVE__ === true && auto.sandbox.__TRACEBOARD_AUTO_INIT__ === true &&
      auto.sandbox.TraceBoardSDK?.version === "0.1.0" &&
      typeof auto.sandbox.TraceBoardSDK?.initTraceBoard === "function",
    label: "vm: __TRACEBOARD_CONFIG__ auto-inits exactly once (one click listener, both guards, global version 0.1.0)",
    detail: `clicks=${auto.clicks.length} active=${auto.sandbox.__TRACEBOARD_SDK_ACTIVE__} auto=${auto.sandbox.__TRACEBOARD_AUTO_INIT__} version=${auto.sandbox.TraceBoardSDK?.version}`,
  });
  if (auto.clicks[0]) {
    auto.clicks[0]({ type: "click", target: clickTarget("btn-auto") });
  }
  await sleep(150);
  const autoEvents = ingestEvents(auto.posts);
  const autoRoot = autoEvents.find((event) => event.kind === "ui_event" && event.nodeKey === "#btn-auto");
  checks.push({
    ok: auto.posts.length > 0 && String(auto.posts[0].url) === "/ingest/v1/events" &&
      autoRoot?.sessionId === "s_s4verify" && Array.isArray(autoRoot?.flags) && autoRoot.flags.includes("OBSERVE_MS=25"),
    label: "vm: auto-init posts NDJSON to the SDK-derived /ingest/v1/events with the page session/observeMs",
    detail: autoRoot ? `url=${auto.posts[0].url} session=${autoRoot.sessionId} flags=${autoRoot.flags.join(",")}` : `posts=${auto.posts.length} events=${autoEvents.length}`,
  });

  let secondThrew = null;
  try {
    runIife(auto.context);
  } catch (error) {
    secondThrew = error;
  }
  checks.push({
    ok: secondThrew === null && auto.clicks.length === 1 &&
      auto.warnings.some((message) => message.includes("already active")),
    label: "vm: double load is guarded (still one listener, warning only)",
    detail: `clicks=${auto.clicks.length} warnings=${auto.warnings.length}`,
  });

  const none = makeSandbox(undefined);
  let noneThrew = null;
  try {
    runIife(none.context);
  } catch (error) {
    noneThrew = error;
  }
  checks.push({
    ok: noneThrew === null && none.clicks.length === 0 && none.sandbox.__TRACEBOARD_SDK_ACTIVE__ !== true &&
      typeof none.sandbox.TraceBoardSDK?.initTraceBoard === "function",
    label: "vm: no window.__TRACEBOARD_CONFIG__ -> no auto-init (ESM-style API still exposed)",
    detail: `clicks=${none.clicks.length} active=${none.sandbox.__TRACEBOARD_SDK_ACTIVE__}`,
  });

  const bad = makeSandbox({ sessionId: "s3demo", ingestUrl: "/ingest", appName: "x", observeMs: -5 });
  let badThrew = null;
  try {
    runIife(bad.context);
  } catch (error) {
    badThrew = error;
  }
  checks.push({
    ok: badThrew === null && bad.clicks.length === 0 && bad.sandbox.__TRACEBOARD_SDK_ACTIVE__ !== true &&
      bad.warnings.some((message) => message.includes("invalid sessionId")) &&
      typeof bad.sandbox.TraceBoardSDK === "object",
    label: "vm: bad config fails open (no throw, no init, invalid-sessionId warning, global intact)",
    detail: `clicks=${bad.clicks.length} active=${bad.sandbox.__TRACEBOARD_SDK_ACTIVE__} warnings=${bad.warnings.length}`,
  });

  return gate(
    "S4-E",
    "SDK IIFE: 17/17 tests, dist 3 files, global TraceBoardSDK/version, vm auto-init once + double-load guard + no-config no-init + bad-config fail-open, no sourcemap/external URLs",
    checks,
    repro,
  );
}

/**
 * S4-F: fixtures/s4-details -> collector requests/graph/replay + static workbench dist + the
 * exported workbench derive helpers (×N grouping, per-invocation rows, gaps F>N>R). Everything
 * here is derived from ALREADY-COLLECTED spans (9 events, LOST backend root); the F gap rule is
 * asserted with an inline ui_event+fetch batch, never with the fixture itself.
 */
async function checkS4F() {
  section("S4-F: details/×N/gaps (fixtures/s4-details -> collector 8601 -> workbench derive/dist)");
  const checks = [];
  const eventsText = readFileSync(abs(S4_EVENTS_REL), "utf8");
  const eventLines = eventsText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events = [];
  const parseProblems = [];
  for (const [index, line] of eventLines.entries()) {
    const parsed = parseJson(line);
    if (!parsed.ok) parseProblems.push(`line ${index + 1}: invalid JSON`);
    else events.push(parsed.value);
  }
  const factsParsed = parseJson(readFileSync(abs(S4_FACTS_REL), "utf8"));
  const facts = factsParsed.ok ? factsParsed.value : {};
  const workbenchPkg = abs("workbench/package.json");
  const pre = [
    { ok: existsSync(abs(S4_EVENTS_REL)), label: "fixtures/s4-details/events.ndjson exists", detail: S4_EVENTS_REL },
    { ok: existsSync(abs(S4_FACTS_REL)), label: "fixtures/s4-details/expected-facts.json exists", detail: S4_FACTS_REL },
    { ok: eventLines.length === 9 && events.length === 9 && parseProblems.length === 0, label: "fixture has 9 parseable NDJSON events", detail: `lines=${eventLines.length} parsed=${events.length} ${parseProblems.join(",")}` },
    { ok: factsParsed.ok && facts.eventCount === 9 && Array.isArray(facts.groups) && facts.groups.length === 3 && facts.gaps?.count === 3, label: "expected-facts: 9 events, 3 groups, 3 gaps", detail: `eventCount=${facts.eventCount} groups=${facts.groups?.length} gaps=${facts.gaps?.count}` },
    { ok: existsSync(JDK21_JAVA), label: "JDK21 java.exe exists", detail: JDK21_JAVA },
    { ok: existsSync(abs(COLLECTOR_JAR_REL)), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(workbenchPkg) && existsSync(abs("workbench/src/s4/derive.ts")) && existsSync(abs("workbench/src/components/S4DetailPanel.vue")), label: "workbench s4/derive.ts + S4DetailPanel.vue sources exist", detail: "workbench/src/s4/derive.ts" },
    { ok: listeningOn(8601).lines.length === 0, label: "port 8601 free before start", detail: listeningOn(8601).lines.join(" | ") || "no listener" },
  ];
  const repro = `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @"${S4_EVENTS_REL}" && curl -s "http://127.0.0.1:8601/api/v1/sessions/${S4_DETAIL_SESSION}/graph?traceId=4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90" && (cd "workbench" && npm run build)`;
  if (!pre.every((item) => item.ok)) {
    return record(
      "S4-F",
      "node details/×N/gaps (preconditions)",
      false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro,
    );
  }

  let collector = null;
  try {
    /* ---------------- fixture schema + deterministic ingest ---------------- */
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(JSON.parse(readFileSync(abs(SCHEMA_REL), "utf8")));
    const schemaProblems = events
      .filter((event) => !validate(event))
      .map((event, index) => `${event.spanId ?? `#${index}`}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
    checks.push({
      ok: schemaProblems.length === 0,
      label: "9/9 fixture events pass the frozen Ajv 2020-12 schema (strict)",
      detail: schemaProblems.slice(0, 3).join(" || ") || "9/9 valid",
    });

    collector = startJavaServer("collector(8601) S4-F", JDK21_JAVA, ["-jar", abs(COLLECTOR_JAR_REL)], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector 8601 /actuator/health 200", detail: health ? "UP" : "timeout" });
    if (!health) {
      return gate("S4-F", "node details/×N/gaps (collector unavailable)", checks, repro);
    }

    const ingest = await postNdjson("/ingest/v1/events", eventsText, `${NDJSON}; charset=utf-8`);
    const ingestParsed = ingest.ok ? parseJson(ingest.text) : { ok: false };
    const ingestBody = ingestParsed.ok && ingestParsed.value ? ingestParsed.value : {};
    checks.push({
      ok: ingest.ok && ingest.status === 202 && ingestBody.accepted === 9 && ingestBody.rejected === 0,
      label: "ingest fixtures/s4-details/events.ndjson -> 202 accepted=9 rejected=0",
      detail: `status=${ingest.status} body=${show(ingest.text)}`,
    });

    const traceId = facts.apiExpectations?.graph?.traceId ?? "4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90";
    const requestsRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_DETAIL_SESSION}/requests`);
    const requestsParsed = requestsRes.ok ? parseJson(requestsRes.text) : { ok: false };
    const requestsBody = requestsParsed.ok && requestsParsed.value ? requestsParsed.value : {};
    const requestRows = Array.isArray(requestsBody.requests) ? requestsBody.requests : [];
    const expectedRow = facts.apiExpectations?.requests?.row ?? {};
    checks.push({
      ok: requestsRes.ok && requestsRes.status === 200 && requestsBody.sessionId === S4_DETAIL_SESSION &&
        requestsBody.sdkActive === false && requestsBody.sdkActive === facts.apiExpectations?.requests?.sdkActive &&
        requestRows.length === 1 && deepEqual(requestRows[0], expectedRow) &&
        requestRows[0]?.confidence === "LOST" && requestRows[0]?.spanCount === 9,
      label: "requests: 1 row deep-equals expected (LOST / NOT_COLLECTED_POLICY / spanCount=9 / sdkActive=false)",
      detail: show(requestRows[0]),
    });

    /* ---------------- graph: 9 nodes / 8 edges, 15 ordered fields (values:null) ---------------- */
    const graphUrl = `/api/v1/sessions/${S4_DETAIL_SESSION}/graph?traceId=${traceId}`;
    const graphRes = await requestBase(COLLECTOR_BASE, graphUrl);
    const graphParsed = graphRes.ok ? parseJson(graphRes.text) : { ok: false };
    const graph = graphParsed.ok && graphParsed.value ? graphParsed.value : {};
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];
    const graphExpected = facts.apiExpectations?.graph ?? {};
    const fixtureBySpanId = new Map(events.map((event) => [event.spanId, event]));
    const nodeProblems = [];
    nodes.forEach((node, index) => {
      const keys = Object.keys(node ?? {});
      if (keys.join(",") !== S4_GRAPH_NODE_KEYS_ORDERED.join(",")) {
        nodeProblems.push(`node${index} keys=${keys.join(",")}`);
      }
      const event = fixtureBySpanId.get(node.spanId);
      if (!event) {
        nodeProblems.push(`node${index} unknown spanId=${node.spanId}`);
        return;
      }
      if (node.parentSpanId !== event.parentSpanId || node.kind !== event.kind ||
          node.nodeKey !== event.nodeKey || node.status !== event.status ||
          node.startNs !== event.startNs || node.durNs !== event.durNs) {
        nodeProblems.push(`node${index} scalars`);
      }
      if (!deepEqual(node.return, event.return ?? null)) nodeProblems.push(`node${index} return`);
      if (!deepEqual(node.sideEffects, event.sideEffects ?? [])) nodeProblems.push(`node${index} sideEffects`);
      if (!deepEqual(node.thread, event.thread ?? null)) nodeProblems.push(`node${index} thread`);
      if (!deepEqual(node.flags, event.flags ?? [])) nodeProblems.push(`node${index} flags`);
      if (!deepEqual(node.reason, event.reason ?? null)) nodeProblems.push(`node${index} reason=${show(node.reason)}`);
      if (!deepEqual(node.source, event.source ?? null)) nodeProblems.push(`node${index} source=${show(node.source)}`);
      if (!deepEqual(node.confidence, event.confidence)) nodeProblems.push(`node${index} confidence=${show(node.confidence)}`);
      nodeProblems.push(...graphValuesProblems(node, event, `node${index}`));
    });
    checks.push({
      ok: graphRes.ok && graphRes.status === 200 && graph.sessionId === S4_DETAIL_SESSION &&
        graph.traceId === traceId && graph.rootEventId === graphExpected.rootEventId &&
        graph.confidence === "LOST" && nodes.length === 9 && edges.length === 8 &&
        nodes.map((node) => node.spanId).join(",") === (graphExpected.nodeOrder ?? []).join(",") &&
        deepEqual(edges, graphExpected.edges ?? []) && edges.every((edge) => edge.count === 1) &&
        nodeProblems.length === 0,
      label: "graph: 9 nodes / 8 edges, every node has exactly the 15 ordered fields (reason/source/confidence + S5 values:null)",
      detail: nodeProblems.length ? nodeProblems.slice(0, 6).join(" || ") : `${nodes.length} nodes, ${edges.length} edges`,
    });
    const mapper3 = nodes.find((node) => node.spanId === graphExpected.notCollectedNode?.spanId) ?? {};
    checks.push({
      ok: mapper3.reason === "policy:third_party_package" &&
        deepEqual(mapper3.source, { file: "OrderMapper.java", line: 15 }) &&
        mapper3.confidence === "LOST" && mapper3.status === "NOT_COLLECTED_POLICY" &&
        deepEqual(mapper3.sideEffects, []),
      label: 'mapper3 detail: reason="policy:third_party_package", source={"file":"OrderMapper.java","line":15}, confidence=LOST',
      detail: `reason=${show(mapper3.reason)} source=${show(mapper3.source)} confidence=${mapper3.confidence}`,
    });

    /* ---------------- replay default window + events/seq untouched ---------------- */
    const replayRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_DETAIL_SESSION}/replay`);
    const replayParsed = replayRes.ok ? parseJson(replayRes.text) : { ok: false };
    const replayBody = replayParsed.ok && replayParsed.value ? replayParsed.value : {};
    const replayEntries = Array.isArray(replayBody.events) ? replayBody.events : [];
    const replayExpected = facts.apiExpectations?.replay ?? {};
    checks.push({
      ok: replayRes.ok && replayRes.status === 200 && replayBody.mode === "replay" &&
        replayBody.readOnly === true && replayBody.fromNs === replayExpected.defaultFromNs &&
        replayBody.toNs === replayExpected.defaultToNs && replayBody.toNs === 5120000000 &&
        replayEntries.length === replayExpected.count && replayEntries.length === 9 &&
        replayEntries.every((entry, index) => entry.seq === index + 1 &&
          deepEqual(entry.event, fixtureBySpanId.get(entry.event?.spanId))),
      label: "replay default: fromNs=0 toNs=5120000000, 9 events in span order with seq 1..9 and exact bodies",
      detail: `fromNs=${replayBody.fromNs} toNs=${replayBody.toNs} count=${replayEntries.length}`,
    });

    const page = await getEventsPage(S4_DETAIL_SESSION, "?afterSeq=0&limit=200");
    checks.push({
      ok: page.res.ok && page.res.status === 200 && page.value.nextSeq === 9 &&
        (page.value.events ?? []).length === 9 &&
        (page.value.events ?? []).map((entry) => entry.seq).join(",") === "1,2,3,4,5,6,7,8,9" &&
        wrapperProblems(validate, page.value.events ?? [], "s4detail").length === 0,
      label: "events/seq untouched by requests/graph/replay: 9 wrapper events, seq 1..9, nextSeq=9",
      detail: `nextSeq=${page.value.nextSeq}`,
    });
    const graphRepeat = await requestBase(COLLECTOR_BASE, graphUrl);
    checks.push({
      ok: graphRepeat.ok && graphRepeat.status === 200 && graphRepeat.text === graphRes.text,
      label: "repeated GET graph is byte-identical (read-only derivation)",
      detail: graphRepeat.text === graphRes.text ? "identical" : "DIFFERS",
    });

    /* ---------------- workbench dist (static) ---------------- */
    const build = runShell("npm run build", { cwd: abs("workbench"), timeout: 600000 });
    checks.push({
      ok: build.code === 0 && !build.error,
      label: "workbench npm run build (prebuild syncs fixtures + vue-tsc + vite) exit 0",
      detail: `exit=${build.code} ${lastLines(`${build.stdout}\n${build.stderr}`, 2).join(" | ").slice(0, 240)}`,
    });
    const distFiles = distTextFiles(WORKBENCH_DIST_REL);
    const distAll = distFiles.map((file) => file.text).join("\n");
    const missingTokens = S4_DIST_TOKENS.filter((token) => !distAll.includes(token));
    checks.push({
      ok: distFiles.length > 0 && missingTokens.length === 0,
      label: "workbench dist contains node-details/×N/gaps tokens + all 未采集 texts (incl. the canonical S6 ×N note)",
      detail: missingTokens.length ? `missing=${missingTokens.join(",")}` : `${S4_DIST_TOKENS.length}/${S4_DIST_TOKENS.length} tokens`,
    });
    const missingSelectors = S4_SELECTORS.filter((id) => !distAll.includes(id));
    checks.push({
      ok: missingSelectors.length === 0,
      label: "workbench dist contains the 11 stable #s4-* selectors (incl. #s4-detail/#s4-invocations/#s4-gaps/#s4-group-badge)",
      detail: missingSelectors.length ? `missing=${missingSelectors.join(",")}` : `${S4_SELECTORS.length}/${S4_SELECTORS.length} selectors`,
    });
    const missingPanels = S4_RETAINED_PANELS.filter((id) => !distAll.includes(id));
    checks.push({
      ok: missingPanels.length === 0,
      label: "workbench dist retains the S3/S2/S1/S0 panels (s3-panel/s2-panel/s1-panel/fixture-panel)",
      detail: missingPanels.length ? `missing=${missingPanels.join(",")}` : "4/4 panels",
    });
    const panelSource = readFileSync(abs("workbench/src/components/S4DetailPanel.vue"), "utf8");
    checks.push({
      ok: (panelSource.match(/id="s4-group-badge"/g) ?? []).length === 1 &&
        panelSource.includes(":data-node-key") && /count\s*>=\s*2/.test(panelSource) &&
        distAll.includes("data-node-key"),
      label: "#s4-group-badge is one container; each N>=2 group is a child with data-node-key (no duplicate ids)",
      detail: `container=${(panelSource.match(/id="s4-group-badge"/g) ?? []).length} data-node-key=${distAll.includes("data-node-key")}`,
    });

    /* ---------------- workbench derive helpers over the collected graph ---------------- */
    const derive = await loadS4DeriveModule();
    checks.push({
      ok: typeof derive.groupNodesByNodeKey === "function" && typeof derive.deriveGaps === "function" &&
        typeof derive.rowsForInvocation === "function" && derive.MISSING === "未采集",
      label: "workbench/src/s4/derive.ts bundles under esbuild and exports the read-only helpers",
      detail: `${Object.keys(derive).length} exports`,
    });

    const expectedGroups = Array.isArray(facts.groups) ? facts.groups : [];
    const groups = derive.groupNodesByNodeKey(nodes);
    const groupByKey = new Map(groups.map((group) => [group.nodeKey, group]));
    const groupProblems = [];
    if (groups.length !== expectedGroups.length + 1) groupProblems.push(`groups=${groups.length} expected=${expectedGroups.length + 1}`);
    expectedGroups.forEach((expected) => {
      const group = groupByKey.get(expected.nodeKey);
      if (!group) {
        groupProblems.push(`${expected.nodeKey}:missing`);
        return;
      }
      if (group.kind !== expected.kind) groupProblems.push(`${expected.nodeKey}:kind=${group.kind}`);
      if (group.count !== expected.count) groupProblems.push(`${expected.nodeKey}:count=${group.count}`);
      if (group.badge !== expected.groupBadge) groupProblems.push(`${expected.nodeKey}:badge=${group.badge}`);
      if (group.nodes.map((node) => node.spanId).join(",") !== (expected.spanIds ?? []).join(",")) {
        groupProblems.push(`${expected.nodeKey}:spanIds`);
      }
    });
    if (groups.map((group) => group.nodeKey).sort().join("|") !==
        [...expectedGroups.map((group) => group.nodeKey), nodes.find((node) => node.kind === "controller")?.nodeKey].sort().join("|")) {
      groupProblems.push(`groupKeys=${groups.map((group) => group.nodeKey).join(",")}`);
    }
    const controllerGroup = groups.find((group) => group.kind === "controller");
    if (!controllerGroup || controllerGroup.count !== 1) groupProblems.push(`controller group=${show(controllerGroup)}`);
    checks.push({
      ok: groupProblems.length === 0 && groups.length === 4 &&
        groups.filter((group) => group.count >= 2).length === 3 &&
        groups.filter((group) => group.count >= 2).map((group) => group.nodeKey).join("|") ===
          expectedGroups.map((group) => group.nodeKey).join("|"),
      label: "×N grouping by nodeKey: service ×3, mapper ×3, sql ×2 (+ controller ×1), startNs order, one group per nodeKey",
      detail: groupProblems.length ? groupProblems.slice(0, 6).join(" || ") : groups.map((group) => `${group.kind}${group.badge}`).join(","),
    });

    const rowsProblems = [];
    const rowsDetail = [];
    for (const expected of expectedGroups) {
      const group = groupByKey.get(expected.nodeKey);
      if (!group) continue;
      (expected.invocations ?? []).forEach((invocation, index) => {
        const node = group.nodes[index];
        if (!node || node.spanId !== invocation.spanId) {
          rowsProblems.push(`${expected.kind}#${index + 1}:spanId`);
          return;
        }
        const rows = derive.rowsForInvocation(node, nodes);
        const text = derive.rowsText(rows);
        rowsDetail.push(`${expected.kind}#${index + 1}=${text}`);
        if (typeof invocation.rowsUiText === "string") {
          if (text !== invocation.rowsUiText) rowsProblems.push(`${expected.kind}#${index + 1}:rows=${text} expected=${invocation.rowsUiText}`);
        } else if (Array.isArray(invocation.rows)) {
          if (text !== invocation.rows.map(String).join(", ")) rowsProblems.push(`${expected.kind}#${index + 1}:rows=${text}`);
        } else if (typeof invocation.rows === "number") {
          if (text !== String(invocation.rows)) rowsProblems.push(`${expected.kind}#${index + 1}:rows=${text}`);
        }
        if (Array.isArray(invocation.sqlSpanIds) &&
            rows.sqlSpanIds.join(",") !== invocation.sqlSpanIds.join(",")) {
          rowsProblems.push(`${expected.kind}#${index + 1}:sqlSpanIds=${rows.sqlSpanIds.join(",")}`);
        }
      });
    }
    const serviceGroup = groupByKey.get(expectedGroups[0]?.nodeKey);
    const thirdService = serviceGroup?.nodes[2];
    const thirdRows = thirdService ? derive.rowsText(derive.rowsForInvocation(thirdService, nodes)) : "?";
    const sqlGroup = expectedGroups.find((group) => group.kind === "sql");
    const sqlNode = sqlGroup ? groupByKey.get(sqlGroup.nodeKey)?.nodes[0] : null;
    const sqlRows = sqlNode ? derive.rowsText(derive.rowsForInvocation(sqlNode, nodes)) : "?";
    if (thirdRows !== "未采集") rowsProblems.push(`service#3 rows=${thirdRows} (must be 未采集, never 0)`);
    if (sqlRows !== "0") rowsProblems.push(`sql rows=${sqlRows} (collected rowsAffected=0 shows 0)`);
    const mapperGroup = expectedGroups.find((group) => group.kind === "mapper");
    const mapperNodes = mapperGroup ? groupByKey.get(mapperGroup.nodeKey)?.nodes ?? [] : [];
    const mapperRows = mapperNodes.map((node) => {
      const rows = derive.rowsForInvocation(node, nodes);
      return `${derive.rowsText(rows)}${rows.source === "child_sql" ? "(子 sql)" : ""}`;
    });
    if (mapperRows.join(",") !== "0(子 sql),0(子 sql),未采集") {
      rowsProblems.push(`mapper rows=${mapperRows.join(",")} (mapper1/2 show the child sql 0; mapper3 is 未采集)`);
    }
    checks.push({
      ok: rowsProblems.length === 0,
      label: "per-invocation rows from that call's sql child only: service 0/0/未采集, sql 0/0, mapper 0(子 sql)/0(子 sql)/未采集 (never 0 when missing)",
      detail: rowsProblems.length ? rowsProblems.slice(0, 6).join(" || ") : rowsDetail.join(","),
    });

    const gaps = derive.deriveGaps(nodes);
    const expectedGaps = Array.isArray(facts.gaps?.items) ? facts.gaps.items : [];
    const gapShape = gaps.map((gap) => ({ rule: gap.rule, spanId: gap.spanId, kind: gap.kind, nodeKey: gap.nodeKey, text: gap.text }));
    const expectedGapShape = expectedGaps.map((gap) => ({ rule: gap.rule, spanId: gap.spanId, kind: gap.kind, nodeKey: gap.nodeKey, text: gap.uiText }));
    const gapProblems = [];
    if (!deepEqual(gapShape, expectedGapShape)) {
      gapProblems.push(`gaps=${show(gapShape)} expected=${show(expectedGapShape)}`);
    }
    gaps.forEach((gap, index) => {
      if (gaps.filter((item) => item.spanId === gap.spanId).length !== 1) gapProblems.push(`${gap.spanId}:duplicate gap`);
      if (index > 0 && nodes.findIndex((node) => node.spanId === gap.spanId) < nodes.findIndex((node) => node.spanId === gaps[index - 1].spanId)) {
        gapProblems.push(`${gap.spanId}:out of span order`);
      }
    });
    const nonRowNodes = nodes.filter((node) => ["controller", "service", "sql"].includes(node.kind));
    checks.push({
      ok: gapProblems.length === 0 && gaps.length === 3 &&
        expectedGapShape.every((gap) => gap.rule === "ROWS_NOT_COLLECTED" || gap.rule === "NOT_COLLECTED_REASON") &&
        derive.deriveGaps(nonRowNodes).length === 0 && derive.GAP_EMPTY_TEXT === S4_GAP_EMPTY_TEXT &&
        facts.gaps?.emptyListText === S4_GAP_EMPTY_TEXT,
      label: "gaps: exactly 3 in span order (mapper1/mapper2 ROWS_NOT_COLLECTED 未采集; mapper3 NOT_COLLECTED_REASON with verbatim reason)",
      detail: gapProblems.length ? gapProblems.slice(0, 5).join(" || ") : gapShape.map((gap) => `${gap.rule}:${gap.text}`).join(" | "),
    });

    const mapper3Node = nodes.find((node) => node.spanId === graphExpected.notCollectedNode?.spanId) ?? mapper3;
    checks.push({
      ok: derive.reasonText(mapper3Node) === "policy:third_party_package" &&
        derive.sourceText(mapper3Node) === graphExpected.notCollectedNode?.sourceUiText &&
        derive.confidenceText(mapper3Node.confidence).includes("LOST") &&
        derive.reasonText({ ...mapper3Node, reason: null }) === "未采集（无 reason）" &&
        derive.sourceText({ ...mapper3Node, source: null }) === "未采集" &&
        derive.sourceText({ ...mapper3Node, source: { file: "OrderMapper.java", line: null } }) === "未采集",
      label: 'detail texts: verbatim reason/source "OrderMapper.java:15"/LOST; missing reason -> 未采集（无 reason）, incomplete source -> 未采集',
      detail: `reason=${derive.reasonText(mapper3Node)} source=${derive.sourceText(mapper3Node)} confidence=${derive.confidenceText(mapper3Node.confidence)}`,
    });

    /* ---------------- inline frontend batch: F rule (not the fixture) ---------------- */
    const inlineNode = (spanId, startNs, kind, parentSpanId, extras = {}) => ({
      spanId,
      parentSpanId,
      kind,
      nodeKey: extras.nodeKey ?? `inline.${kind}#${spanId}`,
      status: extras.status ?? "OK",
      return: null,
      sideEffects: extras.sideEffects ?? [],
      startNs,
      durNs: 10,
      thread: null,
      flags: [],
      reason: extras.reason ?? null,
      source: null,
      confidence: extras.confidence ?? "EXACT",
    });
    const inline = [
      inlineNode("aaaaaaaaaaaaaa01", 100, "ui_event", null, { nodeKey: "#btn-s4f" }),
      inlineNode("aaaaaaaaaaaaaa02", 110, "fetch", "aaaaaaaaaaaaaa01", { nodeKey: "fetch:/api/orders" }),
      inlineNode("aaaaaaaaaaaaaa03", 120, "controller", "aaaaaaaaaaaaaa02", { nodeKey: "com.example.OrderController#list" }),
      inlineNode("aaaaaaaaaaaaaa04", 200, "fetch", "aaaaaaaaaaaaaa01", { nodeKey: "fetch:/api/orphan", status: "NOT_COLLECTED_POLICY", reason: "policy:blocked" }),
      inlineNode("aaaaaaaaaaaaaa05", 300, "mapper", null, { nodeKey: "com.example.OrderMapper#n", status: "NOT_COLLECTED_POLICY" }),
      inlineNode("aaaaaaaaaaaaaa06", 400, "mapper", null, { nodeKey: "com.example.OrderMapper#r" }),
      inlineNode("aaaaaaaaaaaaaa07", 500, "sql", null, { nodeKey: "OrderMapper.r", sideEffects: [{ type: "sql", sqlId: "OrderMapper.r", rowsAffected: 0, transaction: "UNKNOWN" }] }),
    ];
    const inlineGaps = derive.deriveGaps(inline);
    const gapOf = (spanId) => inlineGaps.filter((gap) => gap.spanId === spanId);
    const inlineProblems = [];
    if (gapOf("aaaaaaaaaaaaaa02").length !== 0) inlineProblems.push("referenced fetch must not be a gap");
    if (gapOf("aaaaaaaaaaaaaa01").length !== 0) inlineProblems.push("ui_event must not be a gap");
    const fetcher = gapOf("aaaaaaaaaaaaaa04")[0];
    if (!fetcher || fetcher.rule !== "FETCH_WITHOUT_BACKEND" || fetcher.text !== S4_FETCH_WITHOUT_BACKEND_TEXT) {
      inlineProblems.push(`unreferenced fetch=${show(fetcher)} (F beats N)`);
    }
    const collectorGap = gapOf("aaaaaaaaaaaaaa05")[0];
    if (!collectorGap || collectorGap.rule !== "NOT_COLLECTED_REASON" || collectorGap.text !== "未采集（无 reason）") {
      inlineProblems.push(`NOT_COLLECTED mapper=${show(collectorGap)}`);
    }
    const mapperGap = gapOf("aaaaaaaaaaaaaa06")[0];
    if (!mapperGap || mapperGap.rule !== "ROWS_NOT_COLLECTED" || mapperGap.text !== "未采集") {
      inlineProblems.push(`rows mapper=${show(mapperGap)}`);
    }
    if (gapOf("aaaaaaaaaaaaaa07").length !== 0) inlineProblems.push("collected rows=0 sql must not be a gap");
    if (inlineGaps.length !== 3) inlineProblems.push(`inline gaps=${inlineGaps.length} expected=3`);
    checks.push({
      ok: inlineProblems.length === 0,
      label: "inline ui_event+fetch batch: F FETCH_WITHOUT_BACKEND (backend-unreferenced fetch, F>N), N beats R, collected rows=0 is not a gap",
      detail: inlineProblems.length ? inlineProblems.join(" || ") : inlineGaps.map((gap) => `${gap.rule}:${gap.text}`).join(" | "),
    });

    S4_EVIDENCE.details = {
      requestsRow: requestRows[0] ?? null,
      nodes: nodes.length,
      edges: edges.length,
      groups: groups.map((group) => `${group.kind}${group.badge}`),
      gaps: gapShape,
      replay: { fromNs: replayBody.fromNs, toNs: replayBody.toNs, count: replayEntries.length },
    };
  } catch (error) {
    checks.push({ ok: false, label: "S4-F unexpected error", detail: String(error && error.message ? error.message : error) });
  } finally {
    await stopServer(collector);
    const freed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    checks.push({
      ok: Boolean(freed),
      label: "S4-F cleanup: collector stopped, port 8601 released",
      detail: listeningOn(8601).lines.join(" | ") || "free",
    });
  }

  return gate(
    "S4-F",
    "details/×N/gaps: 9 schema-valid fixture events -> requests/graph(9/8, 15 ordered fields incl. values:null)/replay; workbench dist+derive ×3/×3/×2, rows 未采集≠0, exactly 3 gaps, inline F rule",
    checks,
    repro,
  );
}

/**
 * S4-G: `diagnose` on the real local chain. Full preview -> 7 PASS/exit 0; no --preview-url ->
 * skip=2/exit 0; missing session -> FAIL/exit 3; app URL down -> FAIL/exit 3; preview target
 * non-injectable -> preview_injection FAIL/exit 3. Counts always sum to 7.
 */
async function checkS4G() {
  section("S4-G: diagnose seven checks (collector + demo/agent + preview) — PASS and FAIL branches");
  const checks = [];
  const collectorJar = abs(COLLECTOR_JAR_REL);
  const launcherJar = abs(S4_LAUNCHER_JAR_REL);
  const demoJar = abs(DEMO_JAR_REL);
  const agentJar = abs(AGENT_JAR_REL);
  const suffix = `${process.pid}-${Date.now().toString(36)}`;
  const pidFileRel = `work/s4-diag-${suffix}.pid`;
  const pidFileAbs = abs(pidFileRel);
  const portStates = [8080, 8601, 8602, S4_STUB_PORT].map((port) => ({ port, state: listeningOn(port) }));
  const pre = [
    { ok: existsSync(collectorJar), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(launcherJar), label: "launcher jar exists", detail: S4_LAUNCHER_JAR_REL },
    { ok: existsSync(demoJar), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(agentJar), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists (demo/agent --java)", detail: JDK8_JAVA },
    ...portStates.map(({ port, state }) => ({
      ok: state.supported && state.lines.length === 0,
      label: `port ${port} free before start`,
      detail: state.lines.join(" | ") || "no listener",
    })),
  ];
  const repro = `"${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" jar --jar "${DEMO_JAR_REL}" --agent "${AGENT_JAR_REL}" --collector "http://127.0.0.1:8601" --session "${S4_DIAG_SESSION}" --java "${JDK8_JAVA}" --port 8080 --detach --pid-file "${pidFileRel}" --log-dir "work/logs" && "${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" diagnose --collector "http://127.0.0.1:8601" --app-url "${S4_DIAG_APP_URL}" --session "${S4_DIAG_SESSION}" --preview-url "http://127.0.0.1:8602/" && "${JDK21_JAVA}" -jar "${S4_LAUNCHER_JAR_REL}" stop --pid-file "${pidFileAbs}"`;
  if (!pre.every((item) => item.ok)) {
    return record(
      "S4-G",
      "diagnose seven checks (preconditions)",
      false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro,
    );
  }

  let collector = null;
  let preview = null;
  let htmlStub = null;
  let plainStub = null;
  let demoPid = null;
  const diagnose = (args) => runLauncherAsync(["diagnose", ...args], { timeout: 90000 });
  try {
    collector = startJavaServer("collector(8601) S4-G", JDK21_JAVA, ["-jar", collectorJar], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector 8601 /actuator/health 200", detail: health ? "UP" : "timeout" });
    if (!health) {
      return gate("S4-G", "diagnose seven checks (collector unavailable)", checks, repro);
    }

    const launch = runLauncher([
      "jar", "--jar", demoJar, "--agent", agentJar,
      "--collector", COLLECTOR_BASE, "--session", S4_DIAG_SESSION,
      "--java", JDK8_JAVA, "--port", "8080", "--detach",
      "--pid-file", pidFileRel, "--log-dir", "work/logs",
    ], { timeout: 150000 });
    const launchOut = `${launch.stdout}\n${launch.stderr}`;
    const pidMatch = launchOut.match(/^PID=(\d+)$/m) ?? launchOut.match(/pid=(\d+)/i);
    demoPid = pidMatch ? Number(pidMatch[1]) : null;
    checks.push({
      ok: launch.code === 0 && /^READY pid=\d+/m.test(launchOut) && demoPid !== null && pidAlive(demoPid),
      label: "launcher `jar --detach` starts the JDK8 demo+agent (READY, pid alive) for s_s4diag",
      detail: `exit=${launch.code} pid=${demoPid} ${lastLines(launchOut, 4).join(" | ").slice(0, 240)}`,
    });

    const ready = await pollUntil(async () => {
      const orders = await tryRequest(8080, "/api/orders", { method: "GET" }, 4000);
      const agent = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_DIAG_SESSION}/agent`, { method: "GET" }, 4000);
      const agentParsed = agent.ok ? parseJson(agent.text) : { ok: false };
      return orders.ok && orders.status === 200 && agent.ok && agent.status === 200 &&
        agentParsed.ok && agentParsed.value?.connected === true ? { orders, agent: agentParsed.value } : null;
    }, 45000, 500);
    checks.push({
      ok: Boolean(ready),
      label: "demo GET /api/orders -> 200 and agent handshake GET .../agent -> connected:true",
      detail: ready ? `agent pid=${ready.agent.pid} version=${ready.agent.version}` : "timeout (health/handshake)",
    });

    const cancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" }, 15000);
    const recorded = await pollUntil(async () => {
      const page = await getEventsPage(S4_DIAG_SESSION, "?afterSeq=0&limit=200");
      const list = Array.isArray(page.value.events) ? page.value.events : [];
      return page.res.ok && page.res.status === 200 && list.length >= 1 ? list : null;
    }, 25000, 500);
    checks.push({
      ok: cancel.ok && cancel.status >= 200 && cancel.status < 300 && Boolean(recorded) &&
        recorded.every((entry) => entry?.event?.sessionId === S4_DIAG_SESSION),
      label: "POST /api/orders/1/cancel -> 2xx and the agent records >=1 event (recent_events can PASS)",
      detail: `cancel=${cancel.ok ? cancel.status : String(cancel.error)} events=${recorded ? recorded.length : 0}`,
    });
    if (!ready || !recorded) {
      return gate("S4-G", "diagnose seven checks (demo/agent not ready)", checks, repro);
    }

    /* ---------------- branch 1: full preview, 7 PASS ---------------- */
    htmlStub = await startS4Stub();
    preview = startJavaServer("preview(8602) S4-G", JDK21_JAVA, [
      "-jar", launcherJar, "preview", "--target", `http://127.0.0.1:${S4_STUB_PORT}`,
      "--port", "8602", "--collector", COLLECTOR_BASE, "--session", S4_DIAG_SESSION,
    ], REPO);
    const previewReady = await pollUntil(async () => {
      const res = await httpRaw(`${S4_PREVIEW_BASE}/`);
      return res.ok && res.status === 200 ? res : null;
    }, 45000, 250);
    checks.push({
      ok: Boolean(previewReady),
      label: "preview 8602 serves the 18080 static HTML stub (injectable target)",
      detail: previewReady ? "200" : `log=${lastLines(preview.log.text, 3).join(" | ").slice(0, 240)}`,
    });

    const fullPreview = await diagnose([
      "--collector", COLLECTOR_BASE, "--app-url", S4_DIAG_APP_URL,
      "--session", S4_DIAG_SESSION, "--preview-url", `${S4_PREVIEW_BASE}/`,
    ]);
    checks.push(s4DiagnoseCase(
      "full preview: seven checks run -> pass=7 warn=0 fail=0 skip=0, SUMMARY: PASS, exit 0",
      fullPreview,
      {
        exit: 0,
        verdict: "PASS",
        counts: { pass: 7, warn: 0, fail: 0, skip: 0 },
        levels: {
          collector_health: "PASS", collector_meta: "PASS", app_health: "PASS",
          agent_handshake: "PASS", recent_events: "PASS", preview_injection: "PASS", sdk_script: "PASS",
        },
        contains: ["X-TraceBoard-Preview=injected", "TraceBoardSDK", "connected=true", "capabilities={"],
      },
    ));

    /* ---------------- branch 2: no --preview-url, skip=2, exit 0 ---------------- */
    const noPreview = await diagnose(["--collector", COLLECTOR_BASE, "--app-url", S4_DIAG_APP_URL, "--session", S4_DIAG_SESSION]);
    checks.push(s4DiagnoseCase(
      "no --preview-url: preview_injection+sdk_script SKIP reason=no_preview_url -> pass=5 skip=2 fail=0, exit 0",
      noPreview,
      {
        exit: 0,
        verdict: "PASS",
        counts: { pass: 5, warn: 0, fail: 0, skip: 2 },
        levels: {
          collector_health: "PASS", collector_meta: "PASS", app_health: "PASS",
          agent_handshake: "PASS", recent_events: "PASS", preview_injection: "SKIP", sdk_script: "SKIP",
        },
        contains: ["SKIP preview_injection: reason=no_preview_url", "SKIP sdk_script: reason=no_preview_url"],
      },
    ));
    const noPreviewRows = parseS4DiagnoseOutput(noPreview).rows;
    checks.push({
      ok: ["preview_injection", "sdk_script"].every((check) => {
        const row = noPreviewRows.find((item) => item.check === check);
        return row?.evidence === "reason=no_preview_url";
      }),
      label: "no-preview rows are honest SKIPs (never PASS, never FAIL)",
      detail: noPreviewRows.filter((row) => row.level === "SKIP").map((row) => row.line).join(" | "),
    });

    /* ---------------- branch 3: missing session -> FAIL, exit 3 ---------------- */
    const missing = await diagnose([
      "--collector", COLLECTOR_BASE, "--app-url", S4_DIAG_APP_URL, "--session", S4_DIAG_MISSING_SESSION,
    ]);
    checks.push(s4DiagnoseCase(
      "missing session: agent_handshake FAIL + recent_events WARN -> pass=3 warn=1 fail=1 skip=2, SUMMARY: FAIL, exit 3",
      missing,
      {
        exit: 3,
        verdict: "FAIL",
        counts: { pass: 3, warn: 1, fail: 1, skip: 2 },
        levels: {
          collector_health: "PASS", collector_meta: "PASS", app_health: "PASS",
          agent_handshake: "FAIL", recent_events: "WARN", preview_injection: "SKIP", sdk_script: "SKIP",
        },
        contains: ["agent_handshake: GET "],
      },
    ));

    /* ---------------- branch 4: app URL down -> FAIL, exit 3 ---------------- */
    const appDown = await diagnose([
      "--collector", COLLECTOR_BASE, "--app-url", S4_DIAG_APP_DOWN_URL, "--session", S4_DIAG_SESSION,
    ]);
    checks.push(s4DiagnoseCase(
      "app URL down: app_health FAIL (connect failed) while other checks stay honest -> pass=4 fail=1 skip=2, exit 3",
      appDown,
      {
        exit: 3,
        verdict: "FAIL",
        counts: { pass: 4, warn: 0, fail: 1, skip: 2 },
        levels: {
          collector_health: "PASS", collector_meta: "PASS", app_health: "FAIL",
          agent_handshake: "PASS", recent_events: "PASS", preview_injection: "SKIP", sdk_script: "SKIP",
        },
        contains: ["connect failed"],
      },
    ));

    /* ---------------- branch 5: preview target non-injectable -> FAIL, exit 3 ---------------- */
    await stopServer(preview);
    preview = null;
    await htmlStub.close();
    htmlStub = null;
    plainStub = await startS4PlainStub();
    preview = startJavaServer("preview(8602) S4-G plain", JDK21_JAVA, [
      "-jar", launcherJar, "preview", "--target", `http://127.0.0.1:${S4_STUB_PORT}`,
      "--port", "8602", "--collector", COLLECTOR_BASE, "--session", S4_DIAG_SESSION,
    ], REPO);
    const plainReady = await pollUntil(async () => {
      const res = await httpRaw(`${S4_PREVIEW_BASE}/`);
      return res.ok && res.status === 200 ? res : null;
    }, 45000, 250);
    checks.push({
      ok: Boolean(plainReady),
      label: "preview 8602 serves the text/plain stub as root (non-injectable target)",
      detail: plainReady ? "200 text/plain" : `log=${lastLines(preview.log.text, 3).join(" | ").slice(0, 240)}`,
    });
    const plainPreview = await diagnose([
      "--collector", COLLECTOR_BASE, "--app-url", S4_DIAG_APP_URL,
      "--session", S4_DIAG_SESSION, "--preview-url", `${S4_PREVIEW_BASE}/`,
    ]);
    checks.push(s4DiagnoseCase(
      "preview target non-injectable: preview_injection FAIL (not-injected:not_html) + sdk_script PASS -> pass=6 fail=1 skip=0, exit 3",
      plainPreview,
      {
        exit: 3,
        verdict: "FAIL",
        counts: { pass: 6, warn: 0, fail: 1, skip: 0 },
        levels: {
          collector_health: "PASS", collector_meta: "PASS", app_health: "PASS",
          agent_handshake: "PASS", recent_events: "PASS", preview_injection: "FAIL", sdk_script: "PASS",
        },
        contains: ["X-TraceBoard-Preview=not-injected:not_html"],
      },
    ));
    const plainRows = parseS4DiagnoseOutput(plainPreview).rows;
    checks.push({
      ok: plainRows.filter((row) => row.level === "PASS").every((row) => row.check !== "preview_injection") &&
        plainRows.some((row) => row.check === "preview_injection" && row.level === "FAIL"),
      label: "non-injectable preview is never reported as PASS (no fake success)",
      detail: plainRows.map((row) => `${row.level}:${row.check}`).join(","),
    });

    S4_EVIDENCE.diagnose = [fullPreview, noPreview, missing, appDown, plainPreview].map((run) => {
      const parsed = parseS4DiagnoseOutput(run);
      return { exit: run.code, summary: parsed.summary, counts: parsed.counts };
    });
  } catch (error) {
    checks.push({ ok: false, label: "S4-G unexpected error", detail: String(error && error.message ? error.message : error) });
  } finally {
    await stopServer(preview);
    if (htmlStub) await htmlStub.close().catch(() => {});
    if (plainStub) await plainStub.close().catch(() => {});
    if (demoPid !== null) {
      runLauncher(["stop", "--pid-file", pidFileAbs], { timeout: 60000 });
      if (pidAlive(demoPid)) {
        spawnSync("taskkill", ["/PID", String(demoPid), "/T", "/F"], { encoding: "utf8", windowsHide: true });
      }
    }
    await stopServer(collector);
    const freed = await pollUntil(
      () => [8080, 8601, 8602, S4_STUB_PORT].every((port) => listeningOn(port).lines.length === 0) &&
        (demoPid === null || !pidAlive(demoPid)),
      30000,
      500,
    );
    checks.push({
      ok: Boolean(freed) && !existsSync(pidFileAbs),
      label: "S4-G cleanup: demo stopped via launcher stop, ports 8080/8601/8602/18080 released, no PID file left",
      detail: `ports=${[8080, 8601, 8602, S4_STUB_PORT].map((port) => `${port}:${listeningOn(port).lines.length}`).join(",")} pidFile=${existsSync(pidFileAbs)}`,
    });
  }

  return gate(
    "S4-G",
    "diagnose: full preview 7 PASS/exit 0, no preview skip=2/exit 0, missing session/app down/non-injectable preview FAIL exit 3, counts sum 7, no fake PASS",
    checks,
    repro,
  );
}

/**
 * S4-H: regression closure. Reads the RESULTS of the S0–S3 suite (so it needs a full run),
 * re-hashes the frozen face (schema + S0–S3 fixtures via the S2/S3 plan-review baselines and the
 * S5 G1 freeze) and proves the agent hello stayed a control-plane message: no session, no event,
 * no seq, and the runtime backend span count/kinds are unchanged.
 */
function checkS4H() {
  section("S4-H: S0–S3 regression + schema/fixture/freeze hashes + hello is not an event");
  const checks = [];
  const repro = `(cd "tools/verify" && node verify.mjs)`;

  /* -------- every S0–S3 gate still passes (no regression hidden by a later failure) -------- */
  const prior = RESULTS.filter((item) => !item.id.startsWith("S4"));
  const priorFailed = prior.filter((item) => !item.ok);
  checks.push({
    ok: !S4_ONLY && prior.length >= 50 && priorFailed.length === 0,
    label: "every S0–S3 gate still PASS in this run (RESULTS, >=50 prior gates)",
    detail: S4_ONLY
      ? "S4-only mode: S0–S3 gates were skipped by design (run the full suite)"
      : `${prior.length} prior gates, failed=${priorFailed.map((item) => item.id).join(",") || "none"}`,
  });
  const missingAnchors = S4_H_ANCHORS.filter((id) => resultById(id)?.ok !== true);
  checks.push({
    ok: !S4_ONLY && missingAnchors.length === 0,
    label: `${S4_H_ANCHORS.length} anchor gates present and PASS (S0 V1/V1b/V1c/V4b, S1 A/B/C0-C3/D/F, S2 1-8/L, S3 1-10)`,
    detail: S4_ONLY ? "S4-only mode: anchors unavailable" : missingAnchors.length ? `missing/failed=${missingAnchors.join(",")}` : "all anchors PASS",
  });

  /* -------- schema hash is the G1 value -------- */
  const schemaHash = existsSync(abs(SCHEMA_REL)) ? sha256File(abs(SCHEMA_REL)) : "missing";
  checks.push({
    ok: schemaHash === S4_H_SCHEMA_HASH && S5_G1_FREEZE[SCHEMA_REL] === S4_H_SCHEMA_HASH,
    label: "frozen schema hash is 927937df…a489a (same value in the S5 G1 freeze)",
    detail: schemaHash,
  });

  /* -------- S5 G1 freeze (S6b supersedes api/event-model): zero drift -------- */
  // Keep the 18-entry S5 set (count assertion); only api/event-model take the S6b hash.
  const frozenEntries = Object.entries(S5_G1_FREEZE);
  const freezeDrift = [];
  for (const [rel, s5Hash] of frozenEntries) {
    const expected = LATEST_G1_FREEZE[rel] ?? s5Hash;
    const now = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (now !== expected) freezeDrift.push(`${rel} (${expected.slice(0, 12)}… -> ${now.slice(0, 12)}…)`);
  }
  checks.push({
    ok: frozenEntries.length === 18 && freezeDrift.length === 0,
    label: "S5 G1 freeze 18/18 at the latest (S6b) hashes: schema, 4 contracts (api/event-model superseded), 2 guides, S4/S5 fixtures, S4/S5 plan+dispatch/amendment",
    detail: freezeDrift.length ? freezeDrift.slice(0, 4).join(" || ") : `${frozenEntries.length}/${frozenEntries.length} hashes match`,
  });

  /* -------- S0–S3 fixture bytes unchanged vs the recorded baselines -------- */
  const fixtureBaseline = new Map();
  const fixtureConflicts = [];
  const collectFixtures = (entries) => {
    for (const entry of entries) {
      if (!entry.rel.startsWith("fixtures/")) continue;
      const expected = S5_G1_FREEZE[entry.rel] ?? entry.hash;
      if (fixtureBaseline.has(entry.rel) && fixtureBaseline.get(entry.rel) !== expected) fixtureConflicts.push(entry.rel);
      fixtureBaseline.set(entry.rel, expected);
    }
  };
  collectFixtures(s3FreezeSections().all);
  collectFixtures(s2FreezeSections().all);
  const fixtureDrift = [];
  for (const [rel, expected] of fixtureBaseline) {
    const now = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (now !== expected) fixtureDrift.push(rel);
  }
  checks.push({
    ok: fixtureBaseline.size >= 10 && fixtureConflicts.length === 0 && fixtureDrift.length === 0,
    label: `S0–S3 fixture bytes unchanged (${fixtureBaseline.size} frozen fixture hashes from the S2/S3 plan-review baselines)`,
    detail: fixtureDrift.length || fixtureConflicts.length
      ? `drift=${fixtureDrift.join(",")} conflicts=${fixtureConflicts.join(",")}`
      : `${fixtureBaseline.size}/${fixtureBaseline.size} match`,
  });

  /* -------- the agent hello is a control message, not an event -------- */
  const helloEvidence = resultById("S4-C")?.evidence ?? [];
  const evidenceLine = (needle) => helloEvidence.find((text) => text.includes(needle)) ?? "";
  const seqLine = evidenceLine("hellos consumed no seq");
  const sessionLine = evidenceLine("hello-only session does not appear");
  const metaLine = evidenceLine("meta capabilities still exactly 5 keys");
  checks.push({
    ok: resultById("S4-C")?.ok === true && seqLine.startsWith("ok ") &&
      sessionLine.startsWith("ok ") && metaLine.startsWith("ok "),
    label: "hello stays in-memory control plane: no session, no event, no seq consumed, meta stays 5 keys (S4-C evidence)",
    detail: [seqLine, sessionLine, metaLine].join(" || ").slice(0, 400) || "S4-C evidence unavailable",
  });

  const launchEvidence = resultById("S4-B")?.evidence ?? [];
  const spanLine = launchEvidence.find((text) => /events=\d+ kinds=/.test(text)) ?? "";
  const spanMatch = spanLine.match(/events=(\d+) kinds=([a-z_,]+)/);
  const kinds = spanMatch ? [...new Set(spanMatch[2].split(","))].sort() : [];
  checks.push({
    ok: resultById("S4-B")?.ok === true && Boolean(spanMatch) && Number(spanMatch[1]) >= 4 &&
      deepEqual(kinds, ["controller", "mapper", "service", "sql"]),
    label: "runtime span counts unchanged: the demo request yields exactly the 4 backend kinds (no hello/agent span)",
    detail: spanLine || "S4-B span evidence unavailable",
  });

  /* -------- no S3 regression on the anchor chains -------- */
  const regressionIds = ["S2-3", "S3-3", "S3-4", "S3-5", "S3-6", "S3-7", "S3-9"];
  const regressionBad = regressionIds.filter((id) => resultById(id)?.ok !== true);
  checks.push({
    ok: regressionBad.length === 0,
    label: "no S3 regression: S2 4-span LOST + S3 EXACT E2E, replay 0-write, board, case B, S3-9 all PASS",
    detail: regressionBad.length ? `failed=${regressionBad.join(",")}` : `${regressionIds.length}/${regressionIds.length} PASS`,
  });

  return gate(
    "S4-H",
    "regression: S0–S3 all PASS, schema 927937df…, S0–S3 fixtures + S4/S5 G1 freeze zero drift, hello is not an event (span counts unchanged)",
    checks,
    repro,
  );
}

/**
 * S4-I: scope, security and cleanup closure. S5 values/manifest are allowed; no S6+ capability
 * in the S4-owned sources, no secrets/CDN/mirrors, injection is external-script-only with CSP
 * untouched, loopback + no TLS, fixed ports free, no java/node leftovers, git index/HEAD/status
 * untouched, product files stable, and the git change set stays inside the S5 whitelist.
 */
function checkS4I() {
  section("S4-I: scope/security/cleanup (S5 allowed, no S6+, no secrets/CDN/mirrors, loopback, ports, leftovers, whitelist)");
  const checks = [];
  const repro = `netstat -ano | grep -E ":(${S1_PORTS.join("|")})\\s" ; tasklist | grep -iE "java|node" ; git status --porcelain ; git diff --cached --name-only`;

  /* -------- no S6+ capability in the S4/S5 sources (S5 values/manifest allowed) -------- */
  const scopeFiles = S4_SCOPE_TREES.flatMap((rel) => dirTextFiles(rel))
    .map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const forbiddenMarkers = [
    { name: "map-decoding", re: /SourceMapConsumer|sourcesContent|sourceMappingURL|source-map/i },
    { name: "L2/local", re: /kind\s*=\s*["']local|LocalVariableTable|visitLocalVariable|localVariables/ },
    { name: "WAR/Tomcat", re: /<packaging>\s*war|org\.apache\.catalina|\bwar\s*部署|Tomcat\s*(?:部署|容器)/i },
    { name: "cloud", re: /\b(kubernetes|k8s|terraform|cloudformation|lambda@edge)\b/i },
    { name: "SSE/WS", re: /new\s+EventSource|SseEmitter|@ServerEndpoint|new\s+WebSocket/ },
    { name: "pixel-replay", re: /rrweb|html2canvas|MediaRecorder|toDataURL/ },
    { name: "persistence", re: /localStorage|sessionStorage|indexedDB/ },
  ];
  const markerHits = [];
  for (const file of scopeFiles) {
    if (file.rel.includes("/test/")) continue;
    const l2Allowed = s6aL2Allowed(file.rel);
    for (const marker of forbiddenMarkers) {
      if (marker.name === "L2/local" && l2Allowed) continue;
      if (marker.re.test(file.text)) markerHits.push(`${file.rel} [${marker.name}]`);
    }
  }
  checks.push({
    ok: markerHits.length === 0 && scopeFiles.length > 0,
    label: "S4 sources contain no S6+ capability (.map decoding, L2/local outside the S6a/S6b L2 files, WAR/Tomcat, cloud, SSE/WS, pixel replay, persistence); S5 values/manifest allowed",
    detail: markerHits.slice(0, 5).join(",") || `${scopeFiles.length} files clean`,
  });

  const sdkPkg = parseJson(readFileSync(abs("frontend/sdk/package.json"), "utf8"));
  const iifeScript = String(sdkPkg.value?.scripts?.["build:iife"] ?? "");
  checks.push({
    ok: sdkPkg.ok && /esbuild/.test(iifeScript) && !/--sourcemap/.test(iifeScript) && !/sourcemap"\s*:\s*true/.test(iifeScript),
    label: "SDK IIFE build uses esbuild without --sourcemap (no map/plugin step)",
    detail: iifeScript.slice(0, 220) || "build:iife missing",
  });

  /* -------- no secrets / CDN / mirrors -------- */
  const secretPatterns = [
    /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\n]{3,}["']/gi,
    /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bghp_[A-Za-z0-9]{20,}/g,
  ];
  const placeholderAllow = /placeholder|changeme|change_me|example|sample|dummy|redacted|xxx|<[^>]+>|\$\{|your_|demo|test/i;
  const secretHits = [];
  for (const file of scopeFiles) {
    if (/package-lock\.json/.test(file.rel)) continue;
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      for (const match of file.text.matchAll(pattern)) {
        if (!placeholderAllow.test(match[0])) secretHits.push(`${file.rel} ${match[0].slice(0, 48)}`);
      }
    }
  }
  const cdnHosts = [
    "unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com",
    "npmmirror.com", "cnpmjs.org", "registry.npm.taobao.org", "mirrors.aliyun.com", "cdn.bootcss.com", "staticfile.org",
  ];
  const cdnHits = [];
  const cdnTargets = [...scopeFiles];
  if (existsSync(abs(S4_SDK_IIFE_REL))) {
    cdnTargets.push({ rel: S4_SDK_IIFE_REL, text: readFileSync(abs(S4_SDK_IIFE_REL), "utf8") });
  }
  for (const file of cdnTargets) {
    const lower = file.text.toLowerCase();
    for (const host of cdnHosts) if (lower.includes(host)) cdnHits.push(`${file.rel} -> ${host}`);
  }
  const sharedHygiene = ["V8a", "V8b", "V6d"];
  const hygieneOk = S4_ONLY ? true : sharedHygiene.every((id) => resultById(id)?.ok === true);
  checks.push({
    ok: secretHits.length === 0 && cdnHits.length === 0 && hygieneOk,
    label: "no secrets, no CDN/mirror host in S4 sources/SDK bundle (V8a/V8b/V6d also PASS in a full run)",
    detail: `secrets=${secretHits.slice(0, 3).join(",") || "none"} cdn=${cdnHits.slice(0, 3).join(",") || "none"} hygiene=${sharedHygiene.map((id) => `${id}=${resultById(id)?.ok ? "PASS" : S4_ONLY ? "n/a" : "FAIL"}`).join(",")}`,
  });

  const mirrorUrls = [];
  let resolvedCount = 0;
  for (const rel of S4_LOCKFILES) {
    if (!existsSync(abs(rel))) continue;
    for (const match of readFileSync(abs(rel), "utf8").matchAll(/"resolved":\s*"([^"]+)"/g)) {
      const url = match[1];
      if (!/^https?:/i.test(url)) continue; // local file: dependency of the demo frontend (SDK)
      resolvedCount += 1;
      if (!url.startsWith("https://registry.npmjs.org/")) mirrorUrls.push(`${rel} -> ${url}`);
    }
  }
  checks.push({
    ok: mirrorUrls.length === 0 && resolvedCount > 0,
    label: `lockfiles resolve only from registry.npmjs.org (${resolvedCount} http(s) tarballs, no third-party mirror)`,
    detail: mirrorUrls.slice(0, 3).join(",") || "all npmjs.org",
  });

  /* -------- injection is external-script-only; CSP untouched; loopback; no TLS -------- */
  const launcherCode = dirTextFiles("server/launcher/src").map((file) => file.text).join("\n");
  const scriptTags = [...launcherCode.matchAll(/<script[^>]*>/gi)].map((match) => match[0]);
  checks.push({
    ok: scriptTags.length > 0 && scriptTags.every((tag) => /\ssrc=\\?"/.test(tag) && !/<script>\s*\S/i.test(tag)),
    label: `preview/diagnose inject only external <script src=...> tags (${scriptTags.length} tags, no inline script)`,
    detail: [...new Set(scriptTags)].join(" | ") || "no script tags",
  });
  checks.push({
    ok: !/Content-Security-Policy/i.test(launcherCode) && !/nonce/i.test(launcherCode),
    label: "preview never rewrites/relaxes CSP and adds no nonce (external same-origin scripts only)",
    detail: /Content-Security-Policy/i.test(launcherCode) ? "CSP handling found" : "CSP untouched",
  });
  const loopbackBind = /HttpServer\.create\(\s*new\s+InetSocketAddress\(\s*"127\.0\.0\.1"/.test(launcherCode);
  const loopbackSet = /LOOPBACK\s*=\s*Set\.of\(\s*"127\.0\.0\.1"\s*,\s*"localhost"\s*,\s*"::1"\s*\)/.test(launcherCode);
  const noTls = !/HttpsServer|SSLContext|KeyStore|\.jks\b|\.pfx\b/i.test(launcherCode);
  const collectorYml = readFileSync(abs("server/collector/src/main/resources/application.yml"), "utf8");
  const noBindAll = !/0\.0\.0\.0/.test(launcherCode) && !/0\.0\.0\.0/.test(collectorYml);
  checks.push({
    ok: loopbackBind && loopbackSet && noTls && noBindAll && /address:\s*127\.0\.0\.1/.test(collectorYml),
    label: "launcher preview binds 127.0.0.1 only, loopback target set {127.0.0.1,localhost,::1}, http only (no TLS), collector loopback",
    detail: `bind=${loopbackBind} loopbackSet=${loopbackSet} noTls=${noTls} noBindAll=${noBindAll}`,
  });

  /* -------- cleanup: fixed ports free, no java/node leftovers -------- */
  const portProblems = [];
  for (const port of S1_PORTS) {
    const state = listeningOn(port);
    if (!state.supported || state.lines.length > 0) portProblems.push(`${port}:${state.lines.join("|") || state.error}`);
  }
  checks.push({
    ok: portProblems.length === 0,
    label: `ports ${S1_PORTS.join("/")} not LISTENING after the S4 gates (collector/demo/workbench/demo-frontend/preview/stub stopped)`,
    detail: portProblems.join(" ; ") || "all free",
  });
  const nowJava = javaPids();
  const javaLeft = nowJava.filter((pid) => !BASELINE.javaPids.includes(pid));
  const nowNode = nodePids();
  const nodeLeft = nowNode.filter((pid) => !BASELINE.nodePids.includes(pid) && pid !== process.pid);
  const descendants = descendantSpawnedProcesses(process.pid);
  const descendantHits = descendants.items.map((item) => `${item.name}:${item.pid}`);
  checks.push({
    ok: descendants.supported
      ? descendantHits.length === 0
      : javaLeft.length === 0 && nodeLeft.length === 0,
    label: "no java/node process spawned by this run is still alive (verifier process tree empty; no orphan launcher/demo/preview/build)",
    detail: descendants.supported
      ? `descendants=${descendantHits.join(",") || "none"} (pid diff java=${javaLeft.join(",") || "none"} node=${nodeLeft.join(",") || "none"})`
      : `powershell unavailable (${descendants.error}); pid diff java=${javaLeft.join(",") || "none"} node=${nodeLeft.join(",") || "none"}`,
  });

  /* -------- cleanup: git index/HEAD/status untouched, product files stable -------- */
  const status = gitStatusLines();
  const staged = status.lines.filter((line) => {
    const index = line[0] ?? " ";
    return index !== " " && index !== "?";
  });
  const statusNow = status.lines.slice().sort().join("\n");
  const headNow = gitHeadHash();
  checks.push({
    ok: status.ok && staged.length === 0 && statusNow === BASELINE.gitStatus && headNow === BASELINE.gitHead,
    label: "git index untouched (no staged entries), HEAD/status identical to the run baseline (verifier ran no git write)",
    detail: `staged=${staged.length} statusUnchanged=${statusNow === BASELINE.gitStatus} head=${headNow === BASELINE.gitHead ? "unchanged" : `${BASELINE.gitHead} -> ${headNow}`}`,
  });
  const snapshotNow = sourceSnapshot();
  const touched = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) touched.push(rel);
  }
  const added = Object.keys(snapshotNow).filter((rel) => !(rel in SNAPSHOT));
  checks.push({
    ok: touched.length === 0 && added.length === 0,
    label: "no product file modified or added by the verify run (build outputs only)",
    detail: touched.length || added.length
      ? `modified=${touched.slice(0, 5).join(",")} added=${added.slice(0, 5).join(",")}`
      : `${Object.keys(SNAPSHOT).length} product files stable`,
  });

  /* -------- cleanup: git changes stay inside the S4 whitelist -------- */
  const allowedExact = new Set(["pom.xml", "README.md", ".gitattributes", ...S5_DEMO_BACKEND_ALLOWED]);
  const allowedPrefixes = [
    "agent/",
    "server/collector/",
    "server/launcher/",
    "frontend/sdk/",
    "frontend/build-plugin/",
    "demo/buggy-shop-boot-vue/frontend/",
    "workbench/",
    "docs/contracts/",
    "docs/guides/",
    "docs/plans/stages/S4/",
    "docs/plans/stages/S5/",
    "docs/plans/stages/S6/",
    "fixtures/s4-details/",
    "fixtures/s5-l1-values/",
    "fixtures/s6-l2-lines/",
    "fixtures/s6b-async/",
    "fixtures/s6b-no-debug/",
    "fixtures/s6b-loop/",
    "tools/verify/",
    "tools/perf/",
  ];
  const forbiddenPrefixes = [
    "schema/",
    "fixtures/case-a-zero-rows/",
    "fixtures/s1-walking-skeleton/",
    "fixtures/s2-zero-row-chain/",
    "fixtures/s3-frontend-facts/",
    "demo/buggy-shop-boot-vue/backend/",
    "docs/plans/stages/S0/",
  ];
  const backendAllowed = new Set(S5_DEMO_BACKEND_ALLOWED);
  const unexpected = [];
  const forbidden = [];
  for (const line of status.lines) {
    const rel = line.slice(3).trim().replace(/^"|"$/g, "").split("\\").join("/");
    const allowed = allowedExact.has(rel) || allowedPrefixes.some((entry) => rel.startsWith(entry));
    if (!allowed) unexpected.push(line);
    if (forbiddenPrefixes.some((entry) => rel.startsWith(entry)) && !backendAllowed.has(rel)) forbidden.push(line);
  }
  checks.push({
    ok: status.ok && unexpected.length === 0 && forbidden.length === 0,
    label: "git change set is inside the S6b whitelist only (agent/collector/launcher/sdk+build-plugin/demo frontend+demo backend incl. NoDebugService+pom/workbench/docs contracts+guides+S4+S5+S6a+S6b/fixtures s4+s5+s6-l2-lines+s6b/tools/verify+perf/pom)",
    detail: unexpected.length || forbidden.length
      ? `unexpected=${unexpected.slice(0, 4).join(" | ")} forbidden=${forbidden.slice(0, 4).join(" | ")}`
      : `${status.lines.length} entries within scope`,
  });

  /* -------- gate cleanup evidence from the S4 service gates (full run only) -------- */
  if (!S4_ONLY) {
    const cleanupGates = ["S4-B", "S4-D", "S4-F", "S4-G"];
    const missingCleanup = cleanupGates.filter((id) => resultById(id)?.ok !== true);
    const cleanupLines = cleanupGates.flatMap((id) => (resultById(id)?.evidence ?? [])
      .filter((text) => /cleanup|orphan|released|stopped/i.test(text))
      .map((text) => `${id}: ${text}`));
    const badCleanup = cleanupLines.filter((text) => !text.includes(": ok "));
    checks.push({
      ok: missingCleanup.length === 0 && badCleanup.length === 0 && cleanupLines.length > 0,
      label: "S4-B/D/F/G report their own cleanup (services stopped, ports released, no orphans)",
      detail: `${cleanupLines.length} cleanup lines, bad=${badCleanup.slice(0, 3).join(" || ") || "none"}`,
    });
  }

  return gate(
    "S4-I",
    "scope/security/cleanup: S5 values/manifest allowed but no S6+, no secrets/CDN/mirrors, external-script-only injection + CSP untouched, loopback/no TLS, ports free, no java/node leftovers, git untouched, S5 whitelist only",
    checks,
    repro,
  );
}

/** Run the S4 gates requested by --s4 (or every implemented gate in a normal full run). */
async function checkS4() {
  const selected = S4_SELECTED ?? new Set(S4_IMPLEMENTED);
  const unimplemented = [...selected].filter((letter) => !S4_IMPLEMENTED.includes(letter));
  for (const letter of unimplemented) {
    record(
      `S4-${letter}`,
      `S4-${letter} is not implemented by this verifier`,
      false,
      [`requested --s4=${[...selected].join(",")}; implemented=${S4_IMPLEMENTED.join(",")}`],
      `node verify.mjs --s4=${S4_IMPLEMENTED.join(",")}`,
    );
  }

  checkS4Builds();
  if (selected.has("A")) await checkS4A();
  if (selected.has("B")) await checkS4B();
  if (selected.has("C")) await checkS4C();
  if (selected.has("D")) await checkS4D();
  if (selected.has("E")) await checkS4E();
  if (selected.has("F")) await checkS4F();
  if (selected.has("G")) await checkS4G();
  if (selected.has("H")) checkS4H();
  if (selected.has("I")) checkS4I();
}

/* ------------------------------------------------------------------ */
/* S5: builds, demo L1, agent L1, values UI, manifest, perf, freeze (parts 1-2) */
/* ------------------------------------------------------------------ */

function s5PreviewQuery(id = 1) {
  return `/api/orders/${id}/preview-discount?requestedAmount=100&demoSecret=${S5_DEMO_SECRET}` +
    `&note=${encodeURIComponent(S5_NOTE_3000)}`;
}

/** First orders row (id=1) of a demo `GET /api/orders` body. */
function s5OrderRow(text) {
  const parsed = parseJson(text);
  const rows = parsed.ok && Array.isArray(parsed.value?.data) ? parsed.value.data : [];
  return rows.find((row) => row && row.id === 1) ?? null;
}

function s5PortFree(port) {
  const probe = listeningOn(port);
  return { ok: probe.supported && probe.lines.length === 0, detail: probe.lines.join(" | ") || "no listener" };
}

/**
 * S5-D: graph values fixture + workbench Values/Source UI. Ingests fixtures/s5-l1-values into a
 * fresh collector and asserts the 15-field graph, 5 verbatim value items, null elsewhere, and
 * unchanged requests/replay/meta; also ingests fixtures/s4-details to prove values:null there.
 * Rebuilds the workbench and asserts the S5 selectors/texts plus the B3 reverse assertions.
 */
async function checkS5D() {
  section("S5-D: values graph fixture (4 nodes/15 fields/5 values) + workbench dist");
  const checks = [];
  const eventsText = readFileSync(abs(S5_EVENTS_REL), "utf8");
  const eventLines = eventsText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events = [];
  const parseProblems = [];
  for (const [index, line] of eventLines.entries()) {
    const parsed = parseJson(line);
    if (!parsed.ok) parseProblems.push(`line ${index + 1}: invalid JSON`);
    else events.push(parsed.value);
  }
  const factsParsed = parseJson(readFileSync(abs(S5_FACTS_REL), "utf8"));
  const facts = factsParsed.ok ? factsParsed.value : {};
  const s5Pre = [
    { ok: existsSync(abs(S5_EVENTS_REL)) && existsSync(abs(S5_FACTS_REL)) && existsSync(abs(S5_README_REL)), label: "fixtures/s5-l1-values/{events.ndjson,expected-facts.json,README.md} exist", detail: S5_FIXTURE_DIR },
    { ok: eventLines.length === 4 && events.length === 4 && parseProblems.length === 0, label: "S5 fixture has 4 parseable NDJSON events", detail: `lines=${eventLines.length} parsed=${events.length} ${parseProblems.join(",")}` },
    { ok: factsParsed.ok && facts.eventCount === 4 && facts.workbenchExpectations?.panelSelector === S5_VALUES_SELECTOR, label: "expected-facts: 4 events + S5 workbench expectations", detail: `eventCount=${facts.eventCount}` },
    { ok: existsSync(JDK21_JAVA), label: "JDK21 java.exe exists", detail: JDK21_JAVA },
    { ok: existsSync(abs(COLLECTOR_JAR_REL)), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: listeningOn(8601).lines.length === 0, label: "port 8601 free before start", detail: listeningOn(8601).lines.join(" | ") || "no listener" },
  ];
  const repro = `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson; charset=utf-8" --data-binary @"${S5_EVENTS_REL}" && curl -s "http://127.0.0.1:8601/api/v1/sessions/${S5_FIXTURE_SESSION}/graph?traceId=${facts.globalAssertions?.chain?.traceId ?? ""}" && (cd "workbench" && npm run build)`;
  if (!s5Pre.every((item) => item.ok)) {
    return record("S5-D", "S5-D values/workbench (preconditions)", false,
      s5Pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`), repro);
  }

  let collector = null;
  try {
    /* ---------------- fixture schema + deterministic ingest ---------------- */
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(JSON.parse(readFileSync(abs(SCHEMA_REL), "utf8")));
    const schemaProblems = events
      .filter((event) => !validate(event))
      .map((event, index) => `${event.spanId ?? `#${index}`}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
    checks.push({
      ok: schemaProblems.length === 0,
      label: "4/4 S5 fixture events validate against the frozen Ajv 2020-12 schema (strict)",
      detail: schemaProblems.slice(0, 3).join(" || ") || "4/4 valid",
    });
    const chain = facts.globalAssertions?.chain ?? {};
    const serviceEvent = events.find((event) => event.kind === "service") ?? null;
    const fixtureValueProblems = [];
    if (!serviceEvent || !Array.isArray(serviceEvent.values) || serviceEvent.values.length !== 5) {
      fixtureValueProblems.push(`service values=${show(serviceEvent?.values)}`);
    } else {
      const names = serviceEvent.values.map((item) => item?.name);
      const kinds = serviceEvent.values.map((item) => item?.kind);
      if (!deepEqual(names, S5_VALUE_NAMES)) fixtureValueProblems.push(`names=${names.join(",")}`);
      if (!deepEqual(kinds, S5_VALUE_KINDS)) fixtureValueProblems.push(`kinds=${kinds.join(",")}`);
      if (names.includes("id")) fixtureValueProblems.push("path id leaked");
      if (serviceEvent.values.some((item) => item?.line !== null)) fixtureValueProblems.push("line != null");
      const note = serviceEvent.values[2];
      if (note?.to !== S5_NOTE_2048 || note?.truncated !== true) fixtureValueProblems.push(`note truncated=${note?.truncated} len=${note?.to?.length}`);
      const secret = serviceEvent.values[1];
      if (secret?.to !== "[REDACTED len=6]" || secret?.redacted !== true) fixtureValueProblems.push(`demoSecret=${show(secret)}`);
      const field = serviceEvent.values.filter((item) => item?.kind === "field");
      if (field.length !== 1 || field[0]?.name !== "amount" || field[0]?.from !== 100 || field[0]?.to !== 0) fixtureValueProblems.push("amount 100->0 not exactly once");
      if (serviceEvent.values[4]?.kind !== "return" || serviceEvent.values[4]?.to !== 0) fixtureValueProblems.push("return item");
      if (!(serviceEvent.flags ?? []).includes(S5_L1_FLAG)) fixtureValueProblems.push("L1 flag missing");
      if (events.filter((event) => Object.prototype.hasOwnProperty.call(event, "values")).length !== 1) fixtureValueProblems.push("values on more than one span");
    }
    if (eventsText.includes(S5_DEMO_SECRET)) fixtureValueProblems.push("raw demoSecret in fixture");
    checks.push({
      ok: fixtureValueProblems.length === 0,
      label: "fixture shape: exactly one service values[] (100 / [REDACTED len=6] / 2048 x truncated / 100->0 / return 0), no id, no raw secret, others omit values",
      detail: fixtureValueProblems.slice(0, 6).join(" || ") || "fixture values match the contract",
    });
    const factProblems = s5FixtureFactProblems(events, facts);
    checks.push({
      ok: factProblems.length === 0,
      label: "expected-facts F1–F10 locate the service values and #trace.* derived counts exactly",
      detail: factProblems.slice(0, 6).join(" || ") || "10/10 facts match",
    });

    collector = startJavaServer("collector(8601) S5-D", JDK21_JAVA, ["-jar", abs(COLLECTOR_JAR_REL)], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector 8601 /actuator/health 200", detail: health ? "UP" : "timeout" });
    if (!health) return gate("S5-D", "S5-D values/workbench (collector unavailable)", checks, repro);

    const ingest = await postNdjson("/ingest/v1/events", eventsText, `${NDJSON}; charset=utf-8`);
    const ingestParsed = ingest.ok ? parseJson(ingest.text) : { ok: false };
    const ingestBody = ingestParsed.ok && ingestParsed.value ? ingestParsed.value : {};
    checks.push({
      ok: ingest.ok && ingest.status === 202 && ingestBody.accepted === 4 && ingestBody.rejected === 0,
      label: "ingest fixtures/s5-l1-values/events.ndjson -> 202 accepted=4 rejected=0",
      detail: `status=${ingest.status} body=${show(ingest.text)}`,
    });

    /* ---------------- requests unchanged ---------------- */
    const requestsRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S5_FIXTURE_SESSION}/requests`);
    const requestsParsed = requestsRes.ok ? parseJson(requestsRes.text) : { ok: false };
    const requestsBody = requestsParsed.ok && requestsParsed.value ? requestsParsed.value : {};
    const requestRows = Array.isArray(requestsBody.requests) ? requestsBody.requests : [];
    const expectedRow = facts.apiExpectations?.requests?.row ?? {};
    checks.push({
      ok: requestsRes.ok && requestsRes.status === 200 &&
        deepEqual(Object.keys(requestsBody).sort(), ["requests", "sdkActive", "sessionId"]) &&
        requestsBody.sessionId === S5_FIXTURE_SESSION && requestsBody.sdkActive === true &&
        requestRows.length === 1 && deepEqual(requestRows[0], expectedRow) &&
        !Object.prototype.hasOwnProperty.call(requestRows[0] ?? {}, "values"),
      label: "requests unchanged: exactly {sessionId,sdkActive,requests}, 1 row deep-equals expected (EXACT/4 spans/1 fetch/2 backend), no values key",
      detail: show(requestRows[0]),
    });

    /* ---------------- graph: 4 nodes / 3 edges / 15 ordered fields / service values ---------------- */
    const graphExpected = facts.apiExpectations?.graph ?? {};
    const graphUrl = `/api/v1/sessions/${S5_FIXTURE_SESSION}/graph?traceId=${graphExpected.traceId}`;
    const graphRes = await requestBase(COLLECTOR_BASE, graphUrl);
    const graphParsed = graphRes.ok ? parseJson(graphRes.text) : { ok: false };
    const graph = graphParsed.ok && graphParsed.value ? graphParsed.value : {};
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];
    const fixtureBySpanId = new Map(events.map((event) => [event.spanId, event]));
    const nodeProblems = [];
    nodes.forEach((node, index) => {
      const keys = Object.keys(node ?? {});
      if (keys.join(",") !== S5_GRAPH_NODE_KEYS_ORDERED.join(",")) nodeProblems.push(`node${index} keys=${keys.join(",")}`);
      const event = fixtureBySpanId.get(node.spanId);
      if (!event) {
        nodeProblems.push(`node${index} unknown spanId=${node.spanId}`);
        return;
      }
      if (node.parentSpanId !== event.parentSpanId || node.kind !== event.kind || node.nodeKey !== event.nodeKey ||
          node.status !== event.status || node.startNs !== event.startNs || node.durNs !== event.durNs) {
        nodeProblems.push(`node${index} scalars`);
      }
      if (!deepEqual(node.return, event.return ?? null)) nodeProblems.push(`node${index} return`);
      if (!deepEqual(node.sideEffects, event.sideEffects ?? [])) nodeProblems.push(`node${index} sideEffects`);
      if (!deepEqual(node.thread, event.thread ?? null)) nodeProblems.push(`node${index} thread`);
      if (!deepEqual(node.flags, event.flags ?? [])) nodeProblems.push(`node${index} flags`);
      if (!deepEqual(node.reason, event.reason ?? null)) nodeProblems.push(`node${index} reason`);
      if (!deepEqual(node.source, event.source ?? null)) nodeProblems.push(`node${index} source`);
      if (!deepEqual(node.confidence, event.confidence)) nodeProblems.push(`node${index} confidence`);
      nodeProblems.push(...graphValuesProblems(node, event, `node${index}`));
    });
    const valueNode = nodes.find((node) => node.spanId === graphExpected.valuesSpanId) ?? null;
    const nullNodes = nodes.filter((node) => graphExpected.valuesNullSpanIds?.includes(node.spanId));
    checks.push({
      ok: graphRes.ok && graphRes.status === 200 && graph.sessionId === S5_FIXTURE_SESSION &&
        graph.traceId === graphExpected.traceId && graph.rootEventId === graphExpected.rootEventId &&
        graph.confidence === graphExpected.confidence &&
        nodes.length === 4 && deepEqual(nodes.map((node) => node.spanId), graphExpected.nodeOrder ?? []) &&
        deepEqual(nodes.map((node) => node.kind), graphExpected.kindOrder ?? []) &&
        edges.length === 3 && deepEqual(edges, graphExpected.edges ?? []) && edges.every((edge) => edge.count === 1) &&
        nodeProblems.length === 0,
      label: "graph: 4 nodes / 3 edges, every node exactly 15 ordered fields (values 15th), event facts echoed verbatim",
      detail: nodeProblems.length ? nodeProblems.slice(0, 6).join(" || ") : `${nodes.length} nodes, ${edges.length} edges`,
    });
    checks.push({
      ok: valueNode !== null && Array.isArray(valueNode.values) && valueNode.values.length === 5 &&
        deepEqual(valueNode.values, serviceEvent.values) &&
        nullNodes.length === 3 && nullNodes.every((node) => node.values === null) &&
        nodes.filter((node) => Array.isArray(node.values)).length === 1,
      label: "service node values = 5 items verbatim (100 / [REDACTED len=6] / 2048 truncated / 100 → 0 / return 0); the other 3 nodes are null (never [])",
      detail: `values=${show(valueNode?.values?.map((item) => `${item.name}:${item.kind}`))} nulls=${nullNodes.length}`,
    });
    const graphRepeat = await requestBase(COLLECTOR_BASE, graphUrl);
    checks.push({
      ok: graphRepeat.ok && graphRepeat.status === 200 && graphRepeat.text === graphRes.text,
      label: "repeated GET graph is byte-identical (values are read-only, no cache/no rewrite)",
      detail: graphRepeat.text === graphRes.text ? "identical" : "DIFFERS",
    });

    /* ---------------- replay/meta unchanged ---------------- */
    const replayRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S5_FIXTURE_SESSION}/replay`);
    const replayParsed = replayRes.ok ? parseJson(replayRes.text) : { ok: false };
    const replayBody = replayParsed.ok && replayParsed.value ? replayParsed.value : {};
    const replayEntries = Array.isArray(replayBody.events) ? replayBody.events : [];
    const seqBySpanId = new Map(events.map((event, index) => [event.spanId, index + 1]));
    const windowProblems = [];
    for (const win of Array.isArray(facts.replayWindows) ? facts.replayWindows : []) {
      const window = s3ReplayWindow(events, win.fromNs, win.toNsIsDefault ? null : win.toNs);
      if (window.toNs !== win.toNs) windowProblems.push(`${win.id} toNs`);
      if (window.events.length !== win.count) windowProblems.push(`${win.id} count=${window.events.length}`);
      if (!deepEqual(window.events.map((event) => event.spanId), win.spanIds)) windowProblems.push(`${win.id} spanIds`);
      if (!deepEqual(window.events.map((event) => seqBySpanId.get(event.spanId)), win.seqs)) windowProblems.push(`${win.id} seqs`);
    }
    checks.push({
      ok: replayRes.ok && replayRes.status === 200 && replayBody.mode === "replay" && replayBody.readOnly === true &&
        replayEntries.length === 4 && replayEntries.every((entry, index) => entry.seq === index + 1 &&
          deepEqual(entry.event, fixtureBySpanId.get(entry.event?.spanId))) &&
        windowProblems.length === 0,
      label: "replay unchanged: 4-window deep-compare green, default 4 events with seq 1..4, values echoed verbatim",
      detail: windowProblems.length ? windowProblems.slice(0, 4).join(" || ") : `${replayEntries.length} events, 4 windows`,
    });
    const page = await getEventsPage(S5_FIXTURE_SESSION, "?afterSeq=0&limit=200");
    checks.push({
      ok: page.res.ok && page.res.status === 200 && page.value.nextSeq === 4 &&
        (page.value.events ?? []).length === 4 &&
        (page.value.events ?? []).map((entry) => entry.seq).join(",") === "1,2,3,4" &&
        wrapperProblems(validate, page.value.events ?? [], "s5values").length === 0,
      label: "events/seq untouched by requests/graph/replay: 4 wrapper events, seq 1..4, nextSeq=4",
      detail: `nextSeq=${page.value.nextSeq}`,
    });
    const metaRes = await requestBase(COLLECTOR_BASE, "/api/v1/meta");
    const metaParsed = metaRes.ok ? parseJson(metaRes.text) : { ok: false };
    const metaBody = metaParsed.ok && metaParsed.value ? metaParsed.value : {};
    const caps = metaBody.capabilities && typeof metaBody.capabilities === "object" ? metaBody.capabilities : {};
    checks.push({
      ok: metaRes.ok && metaRes.status === 200 && deepEqual(Object.keys(caps), S4_META_KEYS) &&
        caps.health === true && caps.meta === true && caps.ingestEvents === true &&
        caps.realtime === false && caps.replay === true &&
        !Object.prototype.hasOwnProperty.call(metaBody, "values"),
      label: "meta unchanged: capabilities still exactly 5 keys (realtime=false, replay=true), no values/L1 capability key",
      detail: `keys=${Object.keys(caps).join(",")}`,
    });

    /* ---------------- S4 fixture still renders values:null ---------------- */
    const s4Text = readFileSync(abs(S4_EVENTS_REL), "utf8");
    const s4Lines = s4Text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const s4Events = s4Lines.map((line) => JSON.parse(line));
    const s4Ingest = await postNdjson("/ingest/v1/events", s4Text, `${NDJSON}; charset=utf-8`);
    const s4IngestBody = s4Ingest.ok ? parseJson(s4Ingest.text) : { ok: false };
    const s4Facts = parseJson(readFileSync(abs(S4_FACTS_REL), "utf8"));
    const s4TraceId = s4Facts.ok ? s4Facts.value?.apiExpectations?.graph?.traceId : null;
    const s4GraphRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S4_DETAIL_SESSION}/graph?traceId=${s4TraceId}`);
    const s4GraphParsed = s4GraphRes.ok ? parseJson(s4GraphRes.text) : { ok: false };
    const s4Nodes = s4GraphParsed.ok ? s4GraphParsed.value?.nodes ?? [] : [];
    const s4ValueProblems = s4Nodes.filter((node) => node?.values !== null).map((node) => node?.spanId);
    checks.push({
      ok: s4Lines.length === 9 && s4Events.every((event) => !Object.prototype.hasOwnProperty.call(event, "values")) &&
        s4Ingest.ok && s4Ingest.status === 202 && s4IngestBody.value?.accepted === 9 &&
        s4Nodes.length === 9 && s4Nodes.every((node) => Object.keys(node).length === 15) &&
        s4ValueProblems.length === 0,
      label: "S4 fixture (9 events, no values field) -> graph 9 nodes with values:null (15 keys), no [] and no regression",
      detail: s4ValueProblems.length ? `non-null=${s4ValueProblems.join(",")}` : "9/9 null",
    });

    /* ---------------- workbench build + S5 UI / B3 reverse assertions ---------------- */
    const wb = s5EnsureWorkbench();
    checks.push({
      ok: wb.build.code === 0 && !wb.build.error && distTextFiles(WORKBENCH_DIST_REL).length > 0,
      label: "workbench npm run build exit 0 and dist is non-empty",
      detail: `exit=${wb.build.code} ${distTextFiles(WORKBENCH_DIST_REL).length} dist files`,
    });
    const wbDist = distTextFiles(WORKBENCH_DIST_REL);
    const wbText = wbDist.map((file) => file.text).join("\n");
    const wbExpectations = facts.workbenchExpectations ?? {};
    const s5WorkbenchTokens = [
      "s5-values", "s5-l1-badge", "s5-values-note", "s5-values-empty", "s5-source",
      "100 → 0", "已脱敏", "已截断", "（manifest 映射）", "行号未采集", "第 1/1 次",
      "S5 L1：参数/字段写入/返回摘要；局部变量（L2）与行级属 S6，本阶段未采集",
      "未采集（该节点无 values；S5 只采参数/字段写入/返回摘要）",
      // S6b migration (§10): the canonical S6 banner replaces the old S6a banner.
      S6_BANNER,
      "JS 内部变量本次未采集（局部变量属 L2/S6；S5 manifest 只提供函数/文件/行号）",
    ];
    const missingS5 = s5WorkbenchTokens.filter((token) => !wbText.includes(token));
    checks.push({
      ok: wbDist.length > 0 && missingS5.length === 0,
      label: "workbench dist has the S5 Values UI: #s5-values/#s5-l1-badge/#s5-values-note/#s5-values-empty/#s5-source, 100 → 0, 已脱敏/已截断, 行号未采集, 第 1/1 次, manifest suffix + static notes",
      detail: missingS5.length ? `missing=${missingS5.join(",")}` : `${s5WorkbenchTokens.length}/${s5WorkbenchTokens.length} tokens`,
    });
    const wordBenchSelectors = [...S4_SELECTORS, ...S3_SELECTORS, "s5-values", "s5-l1-badge", "s5-source", "s5-values-empty", "s5-values-note"];
    const missingSelectors = wordBenchSelectors.filter((id) => !wbText.includes(id));
    const missingPanels = S4_RETAINED_PANELS.filter((id) => !wbText.includes(id));
    checks.push({
      ok: missingSelectors.length === 0 && missingPanels.length === 0 && wbText.includes("s2-panel") && wbText.includes("s2-chain"),
      label: "workbench dist retains S0–S4 selectors/panels (11 S4 + 10 S3 selectors, s0..s3 panels) and adds the 5 S5 selectors",
      detail: missingSelectors.length || missingPanels.length ? `selectors=${missingSelectors.join(",")} panels=${missingPanels.join(",")}` : `selectors=${wordBenchSelectors.length} panels=4`,
    });
    const staleHits = [];
    for (const tree of [WORKBENCH_DIST_REL, "workbench/src", S5_DEMO_FRONTEND_REL ? `${S5_DEMO_FRONTEND_REL}/src` : "", DEMO_DIST_REL]) {
      if (!tree || !existsSync(abs(tree))) continue;
      const files = tree.endsWith("/src") || tree === "workbench/src" || tree.endsWith("frontend/src")
        ? walk(abs(tree)).map((file) => ({ rel: relOf(file), text: readFileSync(file, "utf8") }))
        : distTextFiles(tree);
      for (const file of files) {
        for (const token of S5_STALE_TEXTS) {
          if (file.text.includes(token)) staleHits.push(`${file.rel} -> ${token}`);
        }
        // Claim text is about the rendered UI: comments are not claims, so the (unchanged) token
        // list is applied to comment-stripped text. Visible strings/templates stay scanned and
        // the built dist is minified (comments stripped) - no assertion is relaxed.
        const visible = stripComments(file.text);
        for (const token of S5_FORBIDDEN_CLAIMS) {
          if (visible.includes(token)) staleHits.push(`${file.rel} -> ${token}`);
        }
      }
    }
    checks.push({
      ok: staleHits.length === 0,
      label: "B3 reverse: workbench/demo src+dist contain no 无构建插件/sourcemap, S5 待做/无 S5/S5-S6, 4 superseded S6a texts, kind=local or L2 已采集 (claims scanned on comment-stripped UI text)",
      detail: staleHits.slice(0, 6).join(" || ") || "0 stale claims",
    });
    S5_EVIDENCE.fixture = { graph: { nodes: nodes.length, edges: edges.length, values: valueNode?.values?.length ?? 0 }, workbenchTokens: s5WorkbenchTokens.length };
    S5_EVIDENCE.workbenchDist = { files: wbDist.length, tokens: s5WorkbenchTokens.length };
  } catch (error) {
    checks.push({ ok: false, label: "S5-D unexpected error", detail: String(error && error.message ? error.message : error) });
  } finally {
    await stopServer(collector);
    const freed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    checks.push({
      ok: Boolean(freed),
      label: "S5-D cleanup: collector stopped, port 8601 released",
      detail: `8601=${listeningOn(8601).lines.length}`,
    });
  }

  return gate(
    "S5-D",
    "values/workbench: fixture graph 4/3/15 fields + 5 verbatim values (null elsewhere), S4 fixture values:null, requests/replay/meta unchanged, workbench S5 UI + S0–S4 selectors, no stale copy",
    checks,
    repro,
  );
}

/**
 * S5-E: shallow manifest/sourcemap. Plugin 6/6 zero-dependency tests, SDK 17/17 + 3 dist,
 * demo build manifest/.js.map/inline/#btn-discount/S5 copy/no CDN, manifest file/line recomputed
 * from source, and no maps/plugin output in the workbench/SDK dist.
 */
function checkS5E() {
  section("S5-E: build-plugin 6/6 + SDK 17/17, demo manifest/.js.map/inline, manifest lines recomputed, no maps in workbench/SDK");
  const checks = [];
  const repro = `(cd "frontend/build-plugin" && npm test) && (cd "frontend/sdk" && npm ci && npm test) && (cd "${S5_DEMO_FRONTEND_REL}" && npm ci && npm run build) && (cd "workbench" && npm run build)`;

  const pluginPkgAbs = abs(`${S5_BUILD_PLUGIN_REL}/package.json`);
  const pluginPkg = existsSync(pluginPkgAbs) ? JSON.parse(readFileSync(pluginPkgAbs, "utf8")) : null;
  checks.push({
    ok: pluginPkg !== null && pluginPkg.name === "@traceboard/vite-plugin" && pluginPkg.type === "module" &&
      typeof pluginPkg.scripts?.test === "string" && /node --test/.test(pluginPkg.scripts.test) &&
      Object.keys(pluginPkg.dependencies ?? {}).length === 0 &&
      Object.keys(pluginPkg.devDependencies ?? {}).length === 0,
    label: "build-plugin package.json: @traceboard/vite-plugin, ESM, node --test, zero dependencies/devDependencies",
    detail: pluginPkg ? `deps=${Object.keys(pluginPkg.dependencies ?? {}).length} devDeps=${Object.keys(pluginPkg.devDependencies ?? {}).length}` : "missing",
  });
  const plugin = s5EnsurePlugin();
  checks.push({
    ok: plugin.test.code === 0 && plugin.tests === "6" && plugin.pass === "6" && plugin.fail === "0",
    label: "frontend/build-plugin npm test -> 6 tests / 6 pass / 0 fail (R1/R2, lines, sort, dedupe, empty dir, dev 200/405/500, build hooks)",
    detail: `tests=${plugin.tests ?? "?"} pass=${plugin.pass ?? "?"} fail=${plugin.fail ?? "?"}`,
  });

  const sdk = s5EnsureSdk();
  const sdkOut = `${sdk.test.stdout}\n${sdk.test.stderr}`;
  checks.push({
    ok: sdk.ci.code === 0 && sdk.build.code === 0 && sdk.test.code === 0 &&
      sdk.tests === "17" && sdk.pass === "17" && sdk.fail === "0",
    label: "frontend/sdk npm ci + build + test -> 17 tests / 17 pass / 0 fail (manifest inline/fallback/bad manifest included)",
    detail: `tests=${sdk.tests ?? "?"} pass=${sdk.pass ?? "?"} fail=${sdk.fail ?? "?"}`,
  });
  const sdkDist = walk(abs(SDK_DIST_REL));
  checks.push({
    ok: deepEqual(sdkDist.map(relOf).sort(), [
      `${SDK_DIST_REL}/index.d.ts`, `${SDK_DIST_REL}/index.js`, `${SDK_DIST_REL}/traceboard-sdk.iife.js`,
    ]) && sdkDist.every((file) => !file.endsWith(".map")),
    label: "SDK dist = exactly 3 files and no *.map / no manifest asset (only the demo build emits maps)",
    detail: sdkDist.map(relOf).join(","),
  });

  const demo = s5EnsureDemoFrontend();
  checks.push({
    ok: demo.build.code === 0 && !demo.build.error,
    label: "demo frontend npm run build (vue-tsc + vite + traceboardShallow + sourcemap) exit 0",
    detail: `exit=${demo.build.code} ${lastLines(`${demo.build.stdout}\n${demo.build.stderr}`, 2).join(" | ").slice(0, 200)}`,
  });
  const demoDist = walk(abs(DEMO_DIST_REL));
  const demoTextFiles = distTextFiles(DEMO_DIST_REL);
  const demoText = demoTextFiles.map((file) => file.text).join("\n");
  const manifestAbs = abs(`${DEMO_DIST_REL}/traceboard-manifest.json`);
  const manifestParsed = existsSync(manifestAbs) ? parseJson(readFileSync(manifestAbs, "utf8")) : { ok: false };
  const manifest = manifestParsed.ok ? manifestParsed.value : null;
  const expectedManifest = s5RecomputeManifest(S5_DEMO_FRONTEND_REL);
  const manifestByName = new Map((Array.isArray(manifest?.functions) ? manifest.functions : []).map((fn) => [fn?.name, fn]));
  const expectedByName = new Map(expectedManifest.map((fn) => [fn.name, fn]));
  const manifestProblems = [];
  if (!manifest || !Array.isArray(manifest.functions)) manifestProblems.push("manifest missing/unparseable");
  else {
    if (!deepEqual(manifest.functions, expectedManifest)) {
      manifestProblems.push(`functions differ (actual=${manifest.functions.length} expected=${expectedManifest.length})`);
      for (const expected of expectedManifest) {
        const actual = manifestByName.get(expected.name);
        if (!actual || actual.file !== expected.file || actual.line !== expected.line) {
          manifestProblems.push(`${expected.name}@${expected.file}:${expected.line} actual=${show(actual)}`);
        }
      }
    }
    for (const name of ["validateForm", "previewDiscount"]) {
      const actual = manifestByName.get(name);
      const expected = expectedByName.get(name);
      if (!actual || !expected || actual.file !== expected.file || actual.line !== expected.line) {
        manifestProblems.push(`${name} file/line not recomputed from source`);
      }
    }
  }
  checks.push({
    ok: manifestProblems.length === 0,
    label: "dist traceboard-manifest.json functions (incl. validateForm/previewDiscount) deep-equal a fresh R1/R2 scan of src (file/line recomputed, sorted, deduped)",
    detail: manifestProblems.slice(0, 5).join(" || ") || `${expectedManifest.length}/${expectedManifest.length} functions`,
  });
  const inlineMatch = demoTextFiles
    .map((file) => ({ rel: file.rel, match: file.text.match(/window\.__TRACEBOARD_MANIFEST__ = (\{[\s\S]*?\});<\/script>/) }))
    .find((entry) => entry.match);
  let inlineManifest = null;
  try {
    inlineManifest = inlineMatch ? JSON.parse(inlineMatch.match[1]) : null;
  } catch {
    inlineManifest = null;
  }
  checks.push({
    ok: demoText.includes("__TRACEBOARD_MANIFEST__") && inlineManifest !== null && deepEqual(inlineManifest, manifest),
    label: "dist index.html inlines window.__TRACEBOARD_MANIFEST__ with exactly the manifest asset content (build-only, JSON fallback documented)",
    detail: inlineMatch ? `${inlineMatch.rel}` : "inline not found",
  });
  const jsMaps = demoDist.filter((file) => file.endsWith(".js.map"));
  const otherMaps = demoDist.filter((file) => file.endsWith(".map"));
  checks.push({
    ok: jsMaps.length >= 1 && otherMaps.length >= jsMaps.length,
    label: "demo build emits .js.map (build.sourcemap=true, dist only/gitignored; SDK never reads it)",
    detail: `${otherMaps.length} maps (${jsMaps.length} .js.map)`,
  });
  const demoApp = readFileSync(abs(`${S5_DEMO_FRONTEND_REL}/src/App.vue`), "utf8");
  checks.push({
    ok: demoText.includes("#btn-discount") && demoText.includes("previewDiscount") &&
      demoText.includes(S6_BANNER) &&
      demoApp.includes('id="btn-discount"') && demoApp.includes('data-tb-fn="previewDiscount"') &&
      demoApp.includes("requestedAmount=100") && demoApp.includes("demoSecret=s3cr3t") &&
      demoApp.includes('"x".repeat(3000)'),
    label: "demo dist/source: #btn-discount + previewDiscount + canonical S6b banner + fixed 100/s3cr3t/3000-x URL, no loadOrders refresh",
    detail: `btn=${demoText.includes("#btn-discount")} copy=${demoText.includes(S6_BANNER.slice(0, 20))}`,
  });
  const cdnHosts = ["unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com", "npmmirror.com", "mirrors.aliyun.com"];
  const cdnHits = [];
  for (const file of demoTextFiles.filter((file) => !file.rel.endsWith(".map"))) {
    const lower = file.text.toLowerCase();
    for (const host of cdnHosts) if (lower.includes(host)) cdnHits.push(`${file.rel} -> ${host}`);
  }
  const indexHtml = readFileSync(abs(`${DEMO_DIST_REL}/index.html`), "utf8");
  const scriptSrcs = [...indexHtml.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  checks.push({
    ok: cdnHits.length === 0 && scriptSrcs.every((src) => !/^https?:/i.test(src)),
    label: "demo dist has no external CDN host and all <script src> are local (no online fonts/mirrors)",
    detail: `cdn=${cdnHits.slice(0, 3).join(",") || "none"} srcs=${scriptSrcs.join(",") || "none"}`,
  });

  /* ---------------- SDK manifest source shape (static tests + source) ---------------- */
  const manifestTest = readFileSync(abs(`${SDK_DIR}/test/manifest.test.js`), "utf8");
  const iifeTest = readFileSync(abs(`${SDK_DIR}/test/iife.test.js`), "utf8");
  const sdkSource = readFileSync(abs(`${SDK_DIR}/src/index.ts`), "utf8");
  checks.push({
    ok: manifestTest.includes("__TRACEBOARD_MANIFEST__") && manifestTest.includes("SOURCE_MAPPED") &&
      manifestTest.includes("data-tb-fn") && manifestTest.includes("exactly once") &&
      manifestTest.includes("bad manifest") && manifestTest.includes('"source" in incomplete') &&
      iifeTest.includes("IIFE inline manifest") && iifeTest.includes("must never fetch the manifest fallback"),
    label: "SDK tests freeze the manifest contract: inline read, ESM fallback exactly once, bad manifest fail-open, IIFE never fetches",
    detail: "test/manifest.test.js + test/iife.test.js",
  });
  checks.push({
    ok: sdkSource.includes("SOURCE_MAPPED") && sdkSource.includes("data-tb-fn") &&
      sdkSource.includes("/traceboard-manifest.json") && sdkSource.includes("event.source = ") &&
      sdkSource.includes("lookupSource(") &&
      !/SourceMapConsumer|sourceMappingURL|sourcesContent/.test(sdkSource),
    label: "SDK source attaches source+SOURCE_MAPPED only from the manifest (never .map decoding, never fetch/render guessing)",
    detail: "src/index.ts",
  });

  /* ---------------- no sourcemap/plugin in workbench/SDK dist ---------------- */
  const workbenchDist = walk(abs(WORKBENCH_DIST_REL));
  const workbenchMaps = workbenchDist.filter((file) => file.endsWith(".map"));
  const workbenchManifest = workbenchDist.filter((file) => path.basename(file) === "traceboard-manifest.json");
  const workbenchVite = readFileSync(abs("workbench/vite.config.ts"), "utf8");
  checks.push({
    ok: workbenchMaps.length === 0 && workbenchManifest.length === 0 &&
      !/traceboardShallow|@traceboard\/vite-plugin|sourcemap:\s*true/.test(workbenchVite),
    label: "workbench dist has no *.map and no manifest asset; workbench vite never imports the build plugin",
    detail: `maps=${workbenchMaps.length} manifest=${workbenchManifest.length}`,
  });
  const sdkMaps = sdkDist.filter((file) => file.endsWith(".map"));
  const sdkManifest = sdkDist.filter((file) => path.basename(file) === "traceboard-manifest.json");
  const iifeText = existsSync(abs(S4_SDK_IIFE_REL)) ? readFileSync(abs(S4_SDK_IIFE_REL), "utf8") : "";
  checks.push({
    ok: sdkMaps.length === 0 && sdkManifest.length === 0 && !iifeText.includes("sourceMappingURL"),
    label: "SDK dist (incl. IIFE) has no *.map / manifest asset / sourceMappingURL; the IIFE fallback is proven off by the SDK test",
    detail: `maps=${sdkMaps.length} manifest=${sdkManifest.length}`,
  });

  S5_EVIDENCE.plugin = { tests: plugin.tests, pass: plugin.pass, fail: plugin.fail };
  S5_EVIDENCE.sdk = { tests: sdk.tests, pass: sdk.pass, fail: sdk.fail, dist: sdkDist.length };
  S5_EVIDENCE.demoFrontend = { functions: manifest?.functions?.length ?? 0, maps: otherMaps.length };
  return gate(
    "S5-E",
    "manifest/sourcemap: plugin 6/6 zero-dep + SDK 17/17, demo manifest/.js.map/inline/#btn-discount/S5 copy/no CDN, manifest file/line recomputed from source, no maps in workbench/SDK",
    checks,
    repro,
  );
}

/**
 * S5-F: run the report-only overhead script and assert its JSON contract. The ratio is recorded
 * as evidence only — no hard perf threshold is applied (a >1.25 ratio is a WARN label).
 */
async function checkS5F() {
  section("S5-F: perf baseline tools/perf/l1-overhead.mjs (report-only, no hard threshold)");
  const checks = [];
  const repro = `node "${S5_PERF_REL}" --n 100 --warmup 20 --rounds 3 --port 8080`;
  const pre = [
    { ok: existsSync(abs(S5_PERF_REL)), label: "tools/perf/l1-overhead.mjs exists", detail: S5_PERF_REL },
    { ok: existsSync(JDK21_JAVA) && existsSync(JDK8_JAVA), label: "JDK21 + JDK8 present", detail: `${JDK21_HOME} / ${JDK8_HOME}` },
    { ok: existsSync(abs(COLLECTOR_JAR_REL)) && existsSync(abs(DEMO_JAR_REL)) && existsSync(abs(AGENT_JAR_REL)), label: "collector/demo/agent jars present", detail: "built by S5-BUILD" },
    { ok: listeningOn(8601).lines.length === 0 && listeningOn(8080).lines.length === 0, label: "ports 8601/8080 free before the perf run", detail: `${listeningOn(8601).lines.length}/${listeningOn(8080).lines.length}` },
  ];
  if (!pre.every((item) => item.ok)) {
    return record("S5-F", "S5-F perf (preconditions)", false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`), repro);
  }

  const started = Date.now();
  const run = runShell(`node "${S5_PERF_REL}" --n 100 --warmup 20 --rounds 3 --port 8080`, {
    cwd: REPO,
    timeout: 600000,
  });
  const out = `${run.stdout}\n${run.stderr}`;
  const perfLine = out.split(/\r?\n/).find((line) => line.startsWith("PERF_RESULT:")) ?? "";
  let perf = null;
  try {
    perf = perfLine ? JSON.parse(perfLine.slice("PERF_RESULT:".length)) : null;
  } catch {
    perf = null;
  }
  const fieldsOk = perf !== null &&
    perf.reportOnly === true && perf.n === 100 && perf.warmup === 20 && perf.rounds === 3 &&
    Number.isFinite(perf.base?.p50Ms) && Number.isFinite(perf.base?.p95Ms) &&
    Number.isFinite(perf.agent?.p50Ms) && Number.isFinite(perf.agent?.p95Ms) &&
    Number.isFinite(perf.ratio) && perf.agent?.events > 0 &&
    Array.isArray(perf.base?.rounds) && perf.base.rounds.length === 3 &&
    Array.isArray(perf.agent?.rounds) && perf.agent.rounds.length === 3 &&
    perf.threshold === "none; 1.25 is a WARN label only (report-only)";
  checks.push({
    ok: run.code === 0 && !run.error && fieldsOk,
    label: "perf script exit 0 and PERF_RESULT JSON has n/warmup/rounds, base+agent p50/p95 (3 rounds), ratio, agent events>0, reportOnly",
    detail: perfLine ? perfLine.slice(0, 480) : lastLines(out, 3).join(" | ").slice(0, 240),
  });
  checks.push({
    ok: perf === null || (perf.warn === null || perf.warn === "l1_overhead_ratio>1.25"),
    label: "ratio >1.25 only produces the WARN label; no FAIL threshold is asserted (report-only)",
    detail: perf ? `ratio=${perf.ratio} warn=${perf.warn ?? "null"}` : "no result",
  });
  const freed = await pollUntil(() => listeningOn(8601).lines.length === 0 && listeningOn(8080).lines.length === 0, 30000, 400);
  checks.push({
    ok: Boolean(freed),
    label: "perf script cleaned up: ports 8601/8080 free after the run (no leftover demo/collector)",
    detail: `8601=${listeningOn(8601).lines.length} 8080=${listeningOn(8080).lines.length} ${((Date.now() - started) / 1000).toFixed(1)}s`,
  });
  S5_EVIDENCE.perf = perf;
  return gate(
    "S5-F",
    "perf baseline: no-agent vs agent (100 x 3 after warm-up 20), p50/p95/ratio reported, agent events>0, >1.25 only WARN, no hard threshold",
    checks,
    repro,
  );
}

/**
 * S5-G: regression + S5 G1 freeze. In a full run this asserts every S0–S4 anchor and the S4
 * gates PASS; in S5-only mode those gates are skipped by design and the detail says so (never
 * a fake PASS). The freeze/fixture/schema bytes are always checked.
 */
function checkS5G() {
  section("S5-G: regression anchors + S5 G1 freeze zero drift");
  const checks = [];
  const repro = `(cd "tools/verify" && node verify.mjs)`;
  const reviewText = readFileSync(abs(S5_PLAN_REVIEW_REL), "utf8");
  checks.push({
    ok: reviewText.includes("G1: PASS"),
    label: "S5 plan-review records G1: PASS (freeze is the authority)",
    detail: "G1: PASS",
  });
  const freezeDrift = [];
  for (const [rel, s5Hash] of Object.entries(S5_G1_FREEZE)) {
    // S6a supersedes the S5 api/event-model hashes; the other 16 files keep their S5 bytes.
    const expected = LATEST_G1_FREEZE[rel] ?? s5Hash;
    const actual = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (actual !== expected) freezeDrift.push(`${rel} ${actual.slice(0, 12)}…!=${expected.slice(0, 12)}…`);
  }
  checks.push({
    ok: Object.keys(S5_G1_FREEZE).length === 18 && freezeDrift.length === 0,
    label: "S5 G1 freeze zero drift: schema/contracts/guides/S4+S5 fixtures/S4+S5 plan+dispatch (18 files; api+event-model at the S6b hashes, S6a/S6b files at their frozen bytes)",
    detail: freezeDrift.length ? freezeDrift.slice(0, 4).join(" || ") : "18/18 hashes match",
  });
  const schemaHash = existsSync(abs(SCHEMA_REL)) ? sha256File(abs(SCHEMA_REL)) : "missing";
  checks.push({
    ok: schemaHash === S4_H_SCHEMA_HASH,
    label: "schema/traceboard.event.v1.json byte-identical to the S0–S5 baseline (927937df…a489a)",
    detail: schemaHash,
  });
  const s5Files = walk(abs(S5_FIXTURE_DIR)).map(relOf).sort();
  checks.push({
    ok: deepEqual(s5Files, [S5_EVENTS_REL, S5_FACTS_REL, S5_README_REL].sort()),
    label: "fixtures/s5-l1-values contains exactly events.ndjson + expected-facts.json + README.md (no stray files)",
    detail: s5Files.join(","),
  });
  const fixtureBaseline = new Map();
  const fixtureConflicts = [];
  const collectFixtures = (entries) => {
    for (const entry of entries) {
      if (!entry.rel.startsWith("fixtures/")) continue;
      const expected = S5_G1_FREEZE[entry.rel] ?? entry.hash;
      if (fixtureBaseline.has(entry.rel) && fixtureBaseline.get(entry.rel) !== expected) fixtureConflicts.push(entry.rel);
      fixtureBaseline.set(entry.rel, expected);
    }
  };
  collectFixtures(s3FreezeSections().all);
  collectFixtures(s2FreezeSections().all);
  collectFixtures(Object.entries(S5_G1_FREEZE).map(([rel, hash]) => ({ rel, hash })));
  const fixtureDrift = [];
  for (const [rel, expected] of fixtureBaseline) {
    const now = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (now !== expected) fixtureDrift.push(rel);
  }
  checks.push({
    ok: fixtureBaseline.size >= 13 && fixtureConflicts.length === 0 && fixtureDrift.length === 0,
    label: "S0–S5 fixture bytes unchanged (case-A/S1/S2/S3/S4/S5 baselines; no rewrite hidden by a re-ingest)",
    detail: fixtureDrift.length || fixtureConflicts.length
      ? `drift=${fixtureDrift.join(",")} conflicts=${fixtureConflicts.join(",")}`
      : `${fixtureBaseline.size}/${fixtureBaseline.size} match`,
  });

  if (S5_ONLY) {
    checks.push({
      ok: true,
      label: "S0–S4 regression anchors are deferred: --s5 mode skips S0–S4 by design (full run asserts them; not a fake PASS)",
      detail: "S5-only mode: run `node verify.mjs` for the full S0–S5 anchor set",
    });
  } else {
    const missingAnchors = S4_H_ANCHORS.filter((id) => resultById(id)?.ok !== true);
    const s4Gates = ["S4-BUILD", ...S4_IMPLEMENTED.map((letter) => `S4-${letter}`)];
    const missingS4 = s4Gates.filter((id) => resultById(id)?.ok !== true);
    const prior = RESULTS.filter((item) => !String(item.id).startsWith("S5-") && item.id !== "S5-BUILD");
    const priorFailed = prior.filter((item) => !item.ok);
    checks.push({
      ok: prior.length >= 50 && priorFailed.length === 0 && missingAnchors.length === 0 && missingS4.length === 0,
      label: "full-run regression: every S0–S4 gate PASS (≥50 prior RESULTS), 39 S4-H anchors + S4-BUILD/A–I present",
      detail: `prior=${prior.length} priorFailed=${priorFailed.map((item) => item.id).join(",") || "none"} anchors=${missingAnchors.join(",") || "all"} s4=${missingS4.join(",") || "all"}`,
    });
    const s5Bad = RESULTS.filter((item) => String(item.id).startsWith("S5-") && item.id !== "S5-G" && !item.ok);
    checks.push({
      ok: s5Bad.length === 0,
      label: "S5-A..F (and any earlier S5 gates) already PASS before S5-G closure",
      detail: s5Bad.map((item) => item.id).join(",") || "no earlier S5 failure",
    });
  }
  return gate(
    "S5-G",
    "regression/freeze: S0–S4 anchors PASS in a full run, schema/S0–S5 fixture bytes unchanged, S5 G1 freeze 18/18 at the latest hashes (api/event-model superseded by S6b; anchors explicitly deferred in S5-only mode)",
    checks,
    repro,
  );
}

/**
 * S5-H: scope/security/cleanup closure. No S6+ capability (L2/local, async continuation, runtime
 * x3, SSE/WS, persistence, Tomcat/cloud), no .map decoding/upload, preview injection stays
 * external-script only, no secrets/PII/CDN/mirrors, ports free, no java/node leftovers, git index
 * untouched and the change set inside the S5 whitelist.
 */
function checkS5H() {
  section("S5-H: scope/security/cleanup (S5 allowed, no S6+, no maps decoding, no secrets/CDN, ports, git)");
  const checks = [];
  const repro = `netstat -ano | grep -E ":(${S1_PORTS.join("|")})\\s" ; tasklist | grep -iE "java|node" ; git status --porcelain ; git diff --cached --name-only`;
  const productTrees = ["agent/src", "server/collector/src", "server/launcher/src", "frontend/sdk/src", "frontend/build-plugin", "workbench/src", "demo/buggy-shop-boot-vue/frontend/src", "demo/buggy-shop-boot-vue/backend/src"];
  const scopeFiles = productTrees.flatMap((rel) => dirTextFiles(rel)).map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const forbiddenMarkers = [
    { name: "L2/local", re: /kind\s*=\s*["']local|LocalVariableTable|visitLocalVariable|localVariables/ },
    { name: "async-continuation", re: /AsyncContext|CompletableFuture|setTimeout\(\s*span|continuationSpan|async_hooks/ },
    { name: "runtime-x3", re: /RUNTIME_REPLAY|runtimeReplay|replayTimes\s*=\s*3|三倍重放/ },
    { name: "SSE/WS", re: /new\s+EventSource|SseEmitter|@ServerEndpoint|new\s+WebSocket/ },
    { name: "persistence", re: /localStorage|sessionStorage|indexedDB/ },
    { name: "pixel-replay", re: /rrweb|html2canvas|MediaRecorder|toDataURL/ },
    { name: "map-decoding", re: /SourceMapConsumer|sourcesContent|sourceMappingURL|source-map/i },
    { name: "WAR/Tomcat", re: /<packaging>\s*war|org\.apache\.catalina|\bwar\s*部署|Tomcat\s*(?:部署|容器)/i },
    { name: "cloud", re: /\b(kubernetes|k8s|terraform|cloudformation|lambda@edge)\b/i },
    { name: "react", re: /from\s+["']react["']|ReactDOM/ },
  ];
  const markerHits = [];
  for (const file of scopeFiles) {
    if (file.rel.includes("/test/")) continue;
    const l2Allowed = s6aL2Allowed(file.rel);
    for (const marker of forbiddenMarkers) {
      if (marker.name === "L2/local" && l2Allowed) continue;
      if (marker.re.test(file.text)) markerHits.push(`${file.rel} [${marker.name}]`);
    }
  }
  checks.push({
    ok: markerHits.length === 0 && scopeFiles.length > 0,
    label: "no S6+ capability in S5 product sources: no L2/local outside the S6a/S6b L2 files, async continuation, runtime ×3, SSE/WS, persistence, pixel replay, .map decoding, Tomcat/WAR, cloud, React; no async/NO_DEBUG/loop-fold/perf claims",
    detail: markerHits.slice(0, 6).join(",") || `${scopeFiles.length} files clean`,
  });
  const agentL1 = readFileSync(abs("agent/src/main/java/io/traceboard/agent/L1Values.java"), "utf8");
  checks.push({
    ok: /"param"/.test(agentL1) && /"field"/.test(agentL1) && /"return"/.test(agentL1) &&
      !/["']local["']/.test(agentL1) && /\[REDACTED len=/.test(agentL1) &&
      !/toLowerCase\(\).*password.*token|password.*toLowerCase/.test(agentL1),
    label: "L1 values are param/field/return only, redaction placeholder has no raw value, no local kind (S6 boundary)",
    detail: "agent/src/.../L1Values.java",
  });

  /* -------- only the demo build may emit maps; preview injection stays external-only -------- */
  const distMaps = [WORKBENCH_DIST_REL, SDK_DIST_REL, DEMO_DIST_REL]
    .flatMap((rel) => (existsSync(abs(rel)) ? walk(abs(rel)) : []))
    .filter((file) => file.endsWith(".map"));
  const nonDemoMaps = distMaps.filter((file) => !relOf(file).startsWith(`${DEMO_DIST_REL}/`));
  checks.push({
    ok: nonDemoMaps.length === 0,
    label: "only the demo build may contain .map files; workbench/SDK dist remain map-free (no decoding/upload anywhere)",
    detail: nonDemoMaps.map(relOf).join(",") || `${distMaps.length} demo map(s), 0 outside`,
  });
  const launcherCode = dirTextFiles("server/launcher/src").map((file) => file.text).join("\n");
  const scriptTags = [...launcherCode.matchAll(/<script[^>]*>/gi)].map((match) => match[0]);
  checks.push({
    ok: scriptTags.length > 0 && scriptTags.every((tag) => /\ssrc=\\?"/.test(tag) && !/<script>\s*\S/i.test(tag)) &&
      !/Content-Security-Policy/i.test(launcherCode),
    label: "preview/diagnose inject only external <script src=...> tags (no inline manifest, CSP untouched)",
    detail: `${scriptTags.length} tags`,
  });

  /* -------- collector routes unchanged (S5 only adds values to existing graph) -------- */
  const routeFiles = dirTextFiles("server/collector/src").map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const routes = [];
  for (const file of routeFiles) {
    if (!/\.java$/.test(file.rel)) continue;
    for (const match of file.text.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:path\s*=\s*)?["']([^"']+)["']/g)) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }
  const expectedRoutes = [
    "GET /api/v1/meta", "GET /api/v1/sessions", "GET /api/v1/sessions/{sessionId}/events",
    "GET /api/v1/sessions/{sessionId}/requests", "GET /api/v1/sessions/{sessionId}/graph",
    "GET /api/v1/sessions/{sessionId}/replay", "GET /api/v1/sessions/{sessionId}/agent",
    "POST /ingest/v1/events", "POST /ingest/v1/agent-hello",
  ];
  checks.push({
    ok: routes.slice().sort().join("|") === expectedRoutes.slice().sort().join("|") &&
      !routes.some((route) => route.includes("preview-discount")),
    label: "S5 adds no collector route: still exactly 9 business routes; preview-discount exists only in the demo backend",
    detail: routes.sort().join(", "),
  });

  /* -------- no secrets / CDN / mirrors / real PII -------- */
  const s5FixtureText = readFileSync(abs(S5_EVENTS_REL), "utf8");
  const secretPatterns = [
    /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\n]{3,}["']/gi,
    /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bghp_[A-Za-z0-9]{20,}/g,
  ];
  const placeholderAllow = /placeholder|changeme|change_me|example|sample|dummy|redacted|xxx|<[^>]+>|\$\{|your_|demo|test|s3cr3t/i;
  const secretHits = [];
  for (const file of scopeFiles) {
    if (/package-lock\.json/.test(file.rel)) continue;
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      for (const match of file.text.matchAll(pattern)) {
        if (!placeholderAllow.test(match[0])) secretHits.push(`${file.rel} ${match[0].slice(0, 48)}`);
      }
    }
  }
  const cdnHosts = ["unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "npmmirror.com", "mirrors.aliyun.com", "registry.npm.taobao.org"];
  const cdnHits = [];
  for (const file of [...scopeFiles, ...distTextFiles(WORKBENCH_DIST_REL), ...distTextFiles(DEMO_DIST_REL).filter((f) => !f.rel.endsWith(".map"))]) {
    const lower = file.text.toLowerCase();
    for (const host of cdnHosts) if (lower.includes(host)) cdnHits.push(`${file.rel} -> ${host}`);
  }
  const lockedFiles = ["frontend/sdk/package-lock.json", "workbench/package-lock.json", "demo/buggy-shop-boot-vue/frontend/package-lock.json"];
  const mirrorUrls = [];
  for (const rel of lockedFiles) {
    if (!existsSync(abs(rel))) continue;
    for (const match of readFileSync(abs(rel), "utf8").matchAll(/"resolved":\s*"([^"]+)"/g)) {
      if (/^https?:/i.test(match[1]) && !match[1].startsWith("https://registry.npmjs.org/")) mirrorUrls.push(`${rel} -> ${match[1]}`);
    }
  }
  checks.push({
    ok: secretHits.length === 0 && cdnHits.length === 0 && mirrorUrls.length === 0 &&
      !s5FixtureText.includes(S5_DEMO_SECRET) &&
      !/[\w.+-]+@[\w-]+\.[\w.]+/.test(s5FixtureText) && !/\b1[3-9]\d{9}\b/.test(s5FixtureText),
    label: "no real secrets/PII/CDN/mirrors: S5 fixture has no s3cr3t/email/phone, product sources avoid secret patterns, lockfiles resolve only from registry.npmjs.org",
    detail: `secrets=${secretHits.slice(0, 2).join(",") || "none"} cdn=${cdnHits.slice(0, 2).join(",") || "none"} mirrors=${mirrorUrls.slice(0, 2).join(",") || "none"}`,
  });

  /* -------- cleanup: ports/processes/git/snapshot -------- */
  const portProblems = [];
  for (const port of S1_PORTS) {
    const state = listeningOn(port);
    if (!state.supported || state.lines.length > 0) portProblems.push(`${port}:${state.lines.join("|") || state.error}`);
  }
  checks.push({
    ok: portProblems.length === 0,
    label: `ports ${S1_PORTS.join("/")} not LISTENING after all S5 gates (demo/collector/Vite/preview/stub stopped)`,
    detail: portProblems.join(" ; ") || "all free",
  });
  const nowJava = javaPids();
  const javaLeft = nowJava.filter((pid) => !BASELINE.javaPids.includes(pid));
  const nowNode = nodePids();
  const nodeLeft = nowNode.filter((pid) => !BASELINE.nodePids.includes(pid) && pid !== process.pid);
  const descendants = descendantSpawnedProcesses(process.pid);
  const descendantHits = descendants.items.map((item) => `${item.name}:${item.pid}`);
  checks.push({
    ok: descendants.supported ? descendantHits.length === 0 : javaLeft.length === 0 && nodeLeft.length === 0,
    label: "no java/node process spawned by this run is still alive (no orphan demo/collector/perf/build)",
    detail: descendants.supported
      ? `descendants=${descendantHits.join(",") || "none"} (pid diff java=${javaLeft.join(",") || "none"} node=${nodeLeft.join(",") || "none"})`
      : `powershell unavailable (${descendants.error}); java=${javaLeft.join(",") || "none"} node=${nodeLeft.join(",") || "none"}`,
  });
  const status = gitStatusLines();
  const staged = status.lines.filter((line) => (line[0] ?? " ") !== " " && (line[0] ?? " ") !== "?");
  const statusNow = status.lines.slice().sort().join("\n");
  const headNow = gitHeadHash();
  checks.push({
    ok: status.ok && staged.length === 0 && statusNow === BASELINE.gitStatus && headNow === BASELINE.gitHead,
    label: "git index untouched (no staged entries), HEAD/status identical to the run baseline (tester ran no git write)",
    detail: `staged=${staged.length} statusUnchanged=${statusNow === BASELINE.gitStatus} head=${headNow === BASELINE.gitHead ? "unchanged" : `${BASELINE.gitHead} -> ${headNow}`}`,
  });
  const snapshotNow = sourceSnapshot();
  const touched = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) touched.push(rel);
  }
  const added = Object.keys(snapshotNow).filter((rel) => !(rel in SNAPSHOT));
  checks.push({
    ok: touched.length === 0 && added.length === 0,
    label: "no product file modified or added by this verify run (only build outputs/temp logs changed)",
    detail: touched.length || added.length ? `modified=${touched.slice(0, 5).join(",")} added=${added.slice(0, 5).join(",")}` : `${Object.keys(SNAPSHOT).length} product files stable`,
  });

  const allowedExact = new Set(["pom.xml", "README.md", ".gitattributes", ...S5_DEMO_BACKEND_ALLOWED]);
  const allowedPrefixes = [
    "agent/", "server/collector/", "server/launcher/", "frontend/sdk/", "frontend/build-plugin/",
    "demo/buggy-shop-boot-vue/frontend/", "workbench/", "docs/contracts/", "docs/guides/",
    "docs/plans/stages/S5/", "fixtures/s5-l1-values/", "tools/verify/", "tools/perf/",
    "docs/plans/stages/S6/", "fixtures/s6-l2-lines/",
    "fixtures/s6b-async/", "fixtures/s6b-no-debug/", "fixtures/s6b-loop/",
  ];
  const forbiddenPrefixes = ["schema/", "fixtures/case-a-zero-rows/", "fixtures/s1-walking-skeleton/", "fixtures/s2-zero-row-chain/", "fixtures/s3-frontend-facts/", "fixtures/s4-details/", "docs/plans/stages/S0/"];
  const forbiddenExact = ["docs/contracts/transport.v1.md", "docs/contracts/status-semantics.md", "docs/plans/00-master-plan.md", "docs/plans/SOLO-PLAN.md"];
  const backendAllowed = new Set(S5_DEMO_BACKEND_ALLOWED);
  const unexpected = [];
  const forbidden = [];
  for (const line of status.lines) {
    const rel = line.slice(3).trim().replace(/^"|"$/g, "").split("\\").join("/");
    const allowed = allowedExact.has(rel) || allowedPrefixes.some((entry) => rel.startsWith(entry));
    if (!allowed) unexpected.push(line);
    if ((forbiddenPrefixes.some((entry) => rel.startsWith(entry)) && !backendAllowed.has(rel)) || forbiddenExact.includes(rel)) forbidden.push(line);
  }
  checks.push({
    ok: status.ok && unexpected.length === 0 && forbidden.length === 0,
    label: "S6b change set within the whitelist (agent/collector/launcher/sdk+build-plugin/demo frontend+demo backend incl. NoDebugService+pom/workbench/docs contracts+guides+S5+S6a+S6b/fixtures s5+s6+s6b/tools/verify+perf/pom); schema/S0–S4 fixtures/transport/status untouched",
    detail: unexpected.length || forbidden.length
      ? `unexpected=${unexpected.slice(0, 4).join(" | ")} forbidden=${forbidden.slice(0, 4).join(" | ")}`
      : `${status.lines.length} entries within scope`,
  });
  return gate(
    "S5-H",
    "scope/security/cleanup: S5 allowed but no S6+ (L2/async/×3/SSE-WS/persistence/Tomcat/cloud/React), no .map decoding/upload, external-script-only preview, no secrets/CDN/mirrors, ports free, no leftovers, git untouched, S5 whitelist",
    checks,
    repro,
  );
}

/** S5-D helper: evaluate expected-facts F* (values paths + #trace.* derived counts). */
function s5FixtureFactProblems(events, facts) {
  const problems = [];
  const service = events.find((event) => event.kind === "service") ?? null;
  const traceCounts = {
    valuesSpanCount: events.filter((event) => Array.isArray(event.values)).length,
    sourceMappedSpanCount: events.filter((event) => (event.flags ?? []).includes("SOURCE_MAPPED")).length,
    l1FlagSpanCount: events.filter((event) => (event.flags ?? []).includes(S5_L1_FLAG)).length,
    localValueCount: events.flatMap((event) => Array.isArray(event.values) ? event.values : []).filter((item) => item?.kind === "local").length,
    valueCount: events.flatMap((event) => Array.isArray(event.values) ? event.values : []).length,
    fetchCount: events.filter((event) => event.kind === "fetch").length,
    backendSpanCount: events.filter((event) => S3_BACKEND_KINDS.includes(event.kind)).length,
    spanCount: events.length,
  };
  for (const fact of Array.isArray(facts.facts) ? facts.facts : []) {
    const path = fact?.assert?.path ?? "";
    const expected = fact?.assert?.value;
    let actual;
    if (path.startsWith("#trace.")) {
      actual = traceCounts[path.slice("#trace.".length)];
    } else {
      const segments = path.split(".");
      let cursor = service;
      for (const segment of segments) {
        if (cursor === null || cursor === undefined) break;
        cursor = Array.isArray(cursor) ? cursor[Number(segment)] : cursor[segment];
      }
      actual = cursor;
    }
    if (!deepEqual(actual, expected)) problems.push(`${fact.id} ${path}=${show(actual)} expected=${show(expected)}`);
  }
  return problems;
}

/** S5-E helper: fresh shallow R1/R2 scan of the demo frontend (same rules as the build plugin). */
function s5RecomputeManifest(frontendRel) {
  const root = abs(frontendRel);
  const files = walk(abs(`${frontendRel}/src`))
    .filter((file) => /\.(vue|ts)$/i.test(file))
    .map(relOf)
    .map((rel) => rel.slice(frontendRel.length + 1))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const seen = new Set();
  const entries = [];
  for (const rel of files) {
    const lines = readFileSync(abs(`${frontendRel}/${rel}`), "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = /^[ \t]*(?:export[ \t]+)?(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/.exec(line) ||
        /^[ \t]*(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[^;\n]*wrapFn\([ \t]*["']\1["']/.exec(line);
      if (!match) continue;
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);
      entries.push({ name, file: rel, line: index + 1 });
    }
  }
  entries.sort((a, b) => (a.file !== b.file ? (a.file < b.file ? -1 : 1) : a.line !== b.line ? a.line - b.line : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries;
}

/** S5 build/test memoization (S5-A/D/E share one run each). */
function s5EnsureSdk() {
  if (!S5_BUILD_CACHE.sdk) {
    const ci = s5NpmCi(abs(SDK_DIR));
    const build = runShell("npm run build", { cwd: abs(SDK_DIR), timeout: 600000 });
    const test = runShell("npm test", { cwd: abs(SDK_DIR), timeout: 600000 });
    const out = `${test.stdout}\n${test.stderr}`;
    S5_BUILD_CACHE.sdk = {
      ci, build, test,
      tests: out.match(/# tests (\d+)/)?.[1],
      pass: out.match(/# pass (\d+)/)?.[1],
      fail: out.match(/# fail (\d+)/)?.[1],
    };
  }
  return S5_BUILD_CACHE.sdk;
}

function s5EnsurePlugin() {
  if (!S5_BUILD_CACHE.plugin) {
    const test = runShell("npm test", { cwd: abs(S5_BUILD_PLUGIN_REL), timeout: 300000 });
    const out = `${test.stdout}\n${test.stderr}`;
    S5_BUILD_CACHE.plugin = {
      test,
      tests: out.match(/# tests (\d+)/)?.[1],
      pass: out.match(/# pass (\d+)/)?.[1],
      fail: out.match(/# fail (\d+)/)?.[1],
    };
  }
  return S5_BUILD_CACHE.plugin;
}

function s5EnsureDemoFrontend() {
  if (!S5_BUILD_CACHE.demo) {
    const ci = s5NpmCi(abs(S5_DEMO_FRONTEND_REL));
    const build = runShell("npm run build", { cwd: abs(S5_DEMO_FRONTEND_REL), timeout: 600000 });
    S5_BUILD_CACHE.demo = { ci, build };
  }
  return S5_BUILD_CACHE.demo;
}

function s5EnsureWorkbench() {
  if (!S5_BUILD_CACHE.workbench) {
    const ci = s5NpmCi(abs("workbench"));
    const build = runShell("npm run build", { cwd: abs("workbench"), timeout: 600000 });
    S5_BUILD_CACHE.workbench = { ci, build };
  }
  return S5_BUILD_CACHE.workbench;
}

/**
 * S5-BUILD: the Java side of S5-A. Root reactor with JDK21 (collector/launcher/agent), demo
 * backend with JDK8, agent jar still Java 8 bytecode (major 52).
 */
function checkS5Builds() {
  section("S5-BUILD: root reactor (JDK21) + demo backend (JDK8) + agent jar major 52");
  const checks = [];
  const rootStarted = Date.now();
  const root = runShell("mvn -B -q -DskipTests package", {
    cwd: REPO,
    env: { ...process.env, JAVA_HOME: JDK21_HOME },
  });
  const rootOut = `${root.stdout}\n${root.stderr}`;
  checks.push({
    ok: root.code === 0 && !root.error && !root.signal && !/BUILD FAILURE/.test(rootOut),
    label: "root reactor `mvn -B -q -DskipTests package` with JAVA_HOME=JDK21 exit 0",
    detail: `exit=${root.code} ${((Date.now() - rootStarted) / 1000).toFixed(1)}s ${lastLines(rootOut, 2).join(" | ").slice(0, 240)}`,
  });

  const demoStarted = Date.now();
  const demo = runShell("mvn -B -q -DskipTests package", {
    cwd: abs(S5_DEMO_BACKEND_REL),
    env: { ...process.env, JAVA_HOME: JDK8_HOME },
  });
  const demoOut = `${demo.stdout}\n${demo.stderr}`;
  checks.push({
    ok: demo.code === 0 && !demo.error && !demo.signal && !/BUILD FAILURE/.test(demoOut),
    label: "demo backend `mvn -B -q -DskipTests package` with JAVA_HOME=JDK8 exit 0",
    detail: `exit=${demo.code} ${((Date.now() - demoStarted) / 1000).toFixed(1)}s ${lastLines(demoOut, 2).join(" | ").slice(0, 240)}`,
  });

  for (const rel of [AGENT_JAR_REL, COLLECTOR_JAR_REL, DEMO_JAR_REL]) {
    const jarAbs = abs(rel);
    checks.push({
      ok: existsSync(jarAbs) && statSync(jarAbs).size > 0,
      label: `${path.basename(rel)} exists after the build`,
      detail: existsSync(jarAbs) ? `${statSync(jarAbs).size} bytes` : "missing",
    });
  }
  const javap = existsSync(JDK21_JAVAP)
    ? runExe(JDK21_JAVAP, ["-verbose", "-classpath", abs(AGENT_JAR_REL), "io.traceboard.agent.TraceAgent"])
    : { stdout: "" };
  const major = Number((javap.stdout.match(/major version:\s*(\d+)/) ?? [])[1]);
  checks.push({
    ok: major === 52,
    label: "agent jar compiled for Java 8 (major 52)",
    detail: `major=${Number.isNaN(major) ? "?" : major}`,
  });

  const ok = gate(
    "S5-BUILD",
    "S5 builds: root reactor JDK21 (collector/launcher/agent) + demo backend JDK8 + agent major 52",
    checks,
    `JAVA_HOME="${JDK21_HOME}" mvn -B -q -DskipTests package && (cd "${S5_DEMO_BACKEND_REL}" && JAVA_HOME="${JDK8_HOME}" mvn -B -q -DskipTests package)`,
  );
  S5_EVIDENCE.javaBuild = { ok, checks };
  return ok;
}

/**
 * S5-A: front-end shallow builds. SDK (npm ci + build + 17 tests, 3 dist files), the new
 * `frontend/build-plugin` (6 tests, zero dependencies), demo frontend build (manifest + .map +
 * inline manifest) and the workbench build; the Java half is S5-BUILD.
 */
function checkS5A() {
  section("S5-A: SDK (17 tests/3 dist), build-plugin (6 tests), demo manifest/.map, workbench build");
  const checks = [];

  const sdk = s5EnsureSdk();
  const sdkCi = sdk.ci;
  checks.push({
    ok: sdkCi.code === 0 && !sdkCi.error,
    label: "frontend/sdk npm ci exit 0",
    detail: `exit=${sdkCi.code} ${lastLines(`${sdkCi.stdout}\n${sdkCi.stderr}`, 1).join(" ").slice(0, 200)}`,
  });
  const sdkBuild = sdk.build;
  checks.push({
    ok: sdkBuild.code === 0 && !sdkBuild.error,
    label: "frontend/sdk npm run build (tsc ESM + .d.ts + esbuild IIFE) exit 0",
    detail: `exit=${sdkBuild.code} ${lastLines(`${sdkBuild.stdout}\n${sdkBuild.stderr}`, 1).join(" ").slice(0, 200)}`,
  });
  const sdkTest = sdk.test;
  checks.push({
    ok: sdkTest.code === 0 && sdk.tests === "17" && sdk.pass === "17" && sdk.fail === "0",
    label: "frontend/sdk npm test -> node --test: 17 tests / 17 pass / 0 fail",
    detail: `tests=${sdk.tests ?? "?"} pass=${sdk.pass ?? "?"} fail=${sdk.fail ?? "?"}`,
  });
  const sdkDist = walk(abs(SDK_DIST_REL));
  checks.push({
    ok: deepEqual(sdkDist.map(relOf).sort(), [
      `${SDK_DIST_REL}/index.d.ts`,
      `${SDK_DIST_REL}/index.js`,
      `${SDK_DIST_REL}/traceboard-sdk.iife.js`,
    ]) && sdkDist.every((file) => !file.endsWith(".map")),
    label: "SDK dist = exactly 3 files (index.js/index.d.ts/IIFE) and no *.map",
    detail: sdkDist.map(relOf).join(","),
  });

  const pluginPkgAbs = abs(`${S5_BUILD_PLUGIN_REL}/package.json`);
  const pluginPkg = existsSync(pluginPkgAbs) ? JSON.parse(readFileSync(pluginPkgAbs, "utf8")) : null;
  checks.push({
    ok: pluginPkg !== null && pluginPkg.name === "@traceboard/vite-plugin" && pluginPkg.type === "module" &&
      typeof pluginPkg.scripts?.test === "string" && /node --test/.test(pluginPkg.scripts.test) &&
      Object.keys(pluginPkg.dependencies ?? {}).length === 0 &&
      Object.keys(pluginPkg.devDependencies ?? {}).length === 0 &&
      existsSync(abs(`${S5_BUILD_PLUGIN_REL}/index.mjs`)) && existsSync(abs(`${S5_BUILD_PLUGIN_REL}/index.d.mts`)),
    label: "build-plugin package.json: @traceboard/vite-plugin, ESM, node --test, zero dependencies",
    detail: pluginPkg ? `deps=${Object.keys(pluginPkg.dependencies ?? {}).length} devDeps=${Object.keys(pluginPkg.devDependencies ?? {}).length}` : "missing",
  });
  const plugin = s5EnsurePlugin();
  const pluginTest = plugin.test;
  checks.push({
    ok: pluginTest.code === 0 && plugin.tests === "6" && plugin.pass === "6" && plugin.fail === "0",
    label: "frontend/build-plugin npm test -> node --test: 6 tests / 6 pass / 0 fail",
    detail: `tests=${plugin.tests ?? "?"} pass=${plugin.pass ?? "?"} fail=${plugin.fail ?? "?"}`,
  });

  const demoFrontend = s5EnsureDemoFrontend();
  const demoCi = demoFrontend.ci;
  checks.push({
    ok: demoCi.code === 0 && !demoCi.error,
    label: "demo frontend npm ci exit 0",
    detail: `exit=${demoCi.code} ${lastLines(`${demoCi.stdout}\n${demoCi.stderr}`, 1).join(" ").slice(0, 200)}`,
  });
  const demoBuild = demoFrontend.build;
  checks.push({
    ok: demoBuild.code === 0 && !demoBuild.error,
    label: "demo frontend npm run build (vue-tsc + vite, plugin + sourcemap) exit 0",
    detail: `exit=${demoBuild.code} ${lastLines(`${demoBuild.stdout}\n${demoBuild.stderr}`, 2).join(" | ").slice(0, 240)}`,
  });
  const demoDistAll = walk(abs(DEMO_DIST_REL));
  const demoTokens = distTextFiles(DEMO_DIST_REL);
  const demoDistText = demoTokens.map((file) => file.text).join("\n");
  const demoManifestAbs = abs(`${DEMO_DIST_REL}/traceboard-manifest.json`);
  let demoManifest = null;
  try {
    demoManifest = existsSync(demoManifestAbs) ? JSON.parse(readFileSync(demoManifestAbs, "utf8")) : null;
  } catch {
    demoManifest = null;
  }
  const manifestByName = new Map(
    (Array.isArray(demoManifest?.functions) ? demoManifest.functions : []).map((fn) => [fn?.name, fn]),
  );
  const manifestMissing = ["previewDiscount", "validateForm", "cancelOrder"].filter((name) => {
    const fn = manifestByName.get(name);
    return !fn || fn.file !== "src/App.vue" || !Number.isInteger(fn.line) || fn.line < 1;
  });
  checks.push({
    ok: demoManifest !== null && Array.isArray(demoManifest.functions) && manifestMissing.length === 0,
    label: "demo build emits traceboard-manifest.json (previewDiscount/validateForm/cancelOrder @ src/App.vue:line)",
    detail: demoManifest ? `${demoManifest.functions.length} functions; missing=${manifestMissing.join(",") || "none"}` : "manifest missing",
  });
  const demoMaps = demoDistAll.filter((file) => file.endsWith(".map"));
  checks.push({
    ok: demoMaps.length >= 1,
    label: "demo build emits .map artifacts (build.sourcemap=true; dist is gitignored)",
    detail: demoMaps.map(relOf).join(",") || "0 maps",
  });
  checks.push({
    ok: demoDistText.includes("__TRACEBOARD_MANIFEST__") && demoDistText.includes("previewDiscount"),
    label: "demo dist index.html inlines window.__TRACEBOARD_MANIFEST__ (build-only, not the preview injection)",
    detail: demoTokens.filter((file) => file.text.includes("__TRACEBOARD_MANIFEST__")).map((file) => file.rel).join(",") || "not found",
  });

  const workbench = s5EnsureWorkbench();
  const wbCi = workbench.ci;
  checks.push({
    ok: wbCi.code === 0 && !wbCi.error,
    label: "workbench npm ci exit 0",
    detail: `exit=${wbCi.code} ${lastLines(`${wbCi.stdout}\n${wbCi.stderr}`, 1).join(" ").slice(0, 200)}`,
  });
  const wbBuild = workbench.build;
  const wbDist = distTextFiles(WORKBENCH_DIST_REL);
  checks.push({
    ok: wbBuild.code === 0 && !wbBuild.error && wbDist.length > 0,
    label: "workbench npm run build exit 0 and dist is non-empty",
    detail: `exit=${wbBuild.code} ${wbDist.length} dist files`,
  });

  checks.push({
    ok: S5_EVIDENCE.javaBuild?.ok === true,
    label: "Java half green (see S5-BUILD: root JDK21 + demo JDK8 + agent major 52)",
    detail: S5_EVIDENCE.javaBuild?.ok === true ? "ok" : "S5-BUILD failed",
  });

  return gate(
    "S5-A",
    "S5 builds: SDK 17/17 + 3 dist, build-plugin 6/6 (zero deps), demo manifest/.map/inline, workbench, root JDK21 + demo JDK8 + agent 52 (S5-BUILD)",
    checks,
    `(cd "frontend/sdk" && npm ci && npm run build && npm test) && (cd "frontend/build-plugin" && npm test) && (cd "${S5_DEMO_FRONTEND_REL}" && npm ci && npm run build) && (cd "workbench" && npm ci && npm run build) && ${REPRO_S5}`,
  );
}

/**
 * S5-B: the demo L1 endpoint without an agent. `POST preview-discount` is 200 {"data":0} for a
 * known id, the DB amount stays 100.00 (in-memory only), an unknown id is also 200 {"data":0}
 * (no 404/NPE), and case A cancel keeps its 200 true / 0-row behaviour.
 */
async function checkS5B() {
  section("S5-B: demo preview-discount (no agent) — 200/data 0, DB 100, unknown id, case A");
  const checks = [];
  const pre8080 = s5PortFree(8080);
  const pre = [
    { ok: pre8080.ok, label: "port 8080 free before start", detail: pre8080.detail },
    { ok: existsSync(abs(DEMO_JAR_REL)), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists", detail: JDK8_JAVA },
  ];
  if (!pre.every((item) => item.ok)) {
    return record("S5-B", "S5-B demo L1 endpoint (preconditions)", false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      `"${JDK8_JAVA}" -jar "${DEMO_JAR_REL}"`);
  }

  let demo = null;
  try {
    demo = startJavaServer("demo(8080,no-agent)", JDK8_JAVA, ["-jar", abs(DEMO_JAR_REL)], abs(S5_DEMO_BACKEND_REL));
    const ready = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!ready) {
      return record("S5-B", "S5-B demo L1 endpoint (startup)", false,
        [`demo /api/orders did not answer within ${START_TIMEOUT_MS}ms`, ...lastLines(demo.log.text, 5)],
        `"${JDK8_JAVA}" -jar "${DEMO_JAR_REL}"`);
    }
    const seed = s5OrderRow(ready.text);
    checks.push({
      ok: seed !== null && seed.status === "CREATED" && Number(seed.amount) === 100,
      label: "GET /api/orders seed: id=1 status=CREATED amount=100 before the L1 call",
      detail: show(seed),
    });

    const previewStarted = Date.now();
    const preview = await tryRequest(8080, s5PreviewQuery(1), { method: "POST" }, 30000);
    const previewBody = preview.ok ? parseJson(preview.text) : { ok: false };
    checks.push({
      ok: preview.ok && preview.status === 200 && previewBody.ok && deepEqual(previewBody.value, { data: 0 }),
      label: "POST /api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=<3000 x> -> 200 {\"data\":0}",
      detail: `status=${preview.status} body=${show(preview.text)} ${Date.now() - previewStarted}ms`,
    });
    const afterPreview = await tryRequest(8080, "/api/orders", { method: "GET" });
    const afterRow = s5OrderRow(afterPreview.text);
    checks.push({
      ok: afterPreview.status === 200 && afterRow !== null && Number(afterRow.amount) === 100 && afterRow.status === "CREATED",
      label: "GET /api/orders after preview: amount still 100 (in-memory only, no UPDATE / no DB write)",
      detail: show(afterRow),
    });

    const unknown = await tryRequest(8080, s5PreviewQuery(999), { method: "POST" }, 30000);
    const unknownBody = unknown.ok ? parseJson(unknown.text) : { ok: false };
    checks.push({
      ok: unknown.status === 200 && unknownBody.ok && deepEqual(unknownBody.value, { data: 0 }),
      label: "unknown id 999 -> 200 {\"data\":0} (findById=null writes nothing, no 404 / -1 / null)",
      detail: `status=${unknown.status} body=${show(unknown.text)}`,
    });

    const cancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" }, 30000);
    const cancelBody = cancel.ok ? parseJson(cancel.text) : { ok: false };
    const afterCancel = await tryRequest(8080, "/api/orders", { method: "GET" });
    const afterCancelRow = s5OrderRow(afterCancel.text);
    checks.push({
      ok: cancel.status === 200 && cancelBody.ok && deepEqual(cancelBody.value, { data: true }) &&
        afterCancelRow !== null && Number(afterCancelRow.amount) === 100 && afterCancelRow.status === "CREATED",
      label: "case A POST /api/orders/1/cancel -> 200 {\"data\":true}; orders stay CREATED / amount 100 (0-row UPDATE)",
      detail: `status=${cancel.status} body=${show(cancel.text)} row=${show(afterCancelRow)}`,
    });
  } finally {
    await stopServer(demo);
    const freed = await pollUntil(() => s5PortFree(8080).ok, 30000, 400);
    console.log(`        demo stopped; 8080 ${freed ? "free" : "STILL LISTENING"}`);
  }

  S5_EVIDENCE.demo = { checks };
  return gate(
    "S5-B",
    "S5 demo L1 endpoint: 200 {\"data\":0}, DB amount 100 (no write), unknown id 200/0, case A unchanged",
    checks,
    `"${JDK8_JAVA}" -jar "${DEMO_JAR_REL}" & curl -s -X POST "http://127.0.0.1:8080/api/orders/1/preview-discount?requestedAmount=100&demoSecret=s3cr3t&note=<3000 x>"`,
  );
}

/** Agent L1 values problems for one service span (exact order/names/redaction/truncation). */
function s5ServiceValueProblems(service, view) {
  const problems = [];
  const values = service?.values;
  if (!Array.isArray(values)) {
    problems.push(`values=${show(values)}`);
    return problems;
  }
  if (values.length !== 5) problems.push(`count=${values.length}`);
  const names = values.map((item) => item?.name);
  const kinds = values.map((item) => item?.kind);
  if (!deepEqual(names, S5_VALUE_NAMES)) problems.push(`names=${names.join(",")}`);
  if (!deepEqual(kinds, S5_VALUE_KINDS)) problems.push(`kinds=${kinds.join(",")}`);
  if (names.includes("id")) problems.push("path id leaked into values");
  if (values.some((item) => item?.line !== null)) problems.push("line must stay null (no L2/line-level in S5)");
  const [amountItem, secretItem, noteItem, fieldItem, returnItem] = values;
  if (amountItem?.kind !== "param" || amountItem.from !== null || amountItem.to !== 100 ||
      amountItem.truncated !== false || amountItem.redacted !== false) {
    problems.push(`requestedAmount=${show(amountItem)}`);
  }
  if (secretItem?.kind !== "param" || secretItem.from !== null || secretItem.to !== "[REDACTED len=6]" ||
      secretItem.redacted !== true || secretItem.truncated !== false) {
    problems.push(`demoSecret=${show(secretItem)}`);
  }
  if (noteItem?.kind !== "param" || noteItem.from !== null || noteItem.to !== S5_NOTE_2048 ||
      noteItem.truncated !== true || noteItem.redacted !== false) {
    problems.push(`note(truncated=${noteItem?.truncated}, len=${typeof noteItem?.to === "string" ? noteItem.to.length : "?"})`);
  }
  const fields = values.filter((item) => item?.kind === "field");
  if (fields.length !== 1 || fields[0]?.name !== "amount" || fields[0]?.from !== 100 || fields[0]?.to !== 0 ||
      fields[0]?.truncated !== false || fields[0]?.redacted !== false) {
    problems.push(`field items=${show(fields)}`);
  }
  if (fieldItem?.kind !== "field") problems.push(`values[3].kind=${fieldItem?.kind}`);
  if (returnItem?.kind !== "return" || returnItem.name !== "return" || returnItem.to !== 0 || returnItem.from !== null) {
    problems.push(`return=${show(returnItem)}`);
  }
  const localKinds = values.filter((item) => item?.kind === "local");
  if (localKinds.length > 0) problems.push(`kind=local items=${localKinds.length}`);
  const raw = JSON.stringify(view ?? values);
  if (raw.includes(S5_DEMO_SECRET)) problems.push("raw demoSecret leaked into the event");
  return problems;
}

/**
 * S5-C: runtime L1 with collector(8601) + demo(8080) + agent (session s_s5agent). One joined
 * preview-discount request must produce exactly controller+service (no mapper/sql), the service
 * carries the exact five value items, case A cancel still yields the 4-span 0-row chain without
 * values/L1, and the agent stays fail-open when the collector is down.
 */
async function checkS5C(validate) {
  section("S5-C: agent L1 values (collector 8601 + demo 8080 + agent, session s_s5agent)");
  const checks = [];
  const repro = `"${JDK8_JAVA}" -javaagent:"${AGENT_JAR_REL}" -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events -Dtraceboard.sessionId=${S5_SESSION} -jar "${DEMO_JAR_REL}"`;
  const pre = [
    { ok: s5PortFree(8601).ok, label: "port 8601 free before start", detail: s5PortFree(8601).detail },
    { ok: s5PortFree(8080).ok, label: "port 8080 free before start", detail: s5PortFree(8080).detail },
    { ok: existsSync(abs(COLLECTOR_JAR_REL)), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(abs(DEMO_JAR_REL)), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(abs(AGENT_JAR_REL)), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(JDK21_JAVA) && existsSync(JDK8_JAVA), label: "JDK21 + JDK8 present", detail: `${JDK21_HOME} / ${JDK8_HOME}` },
    { ok: typeof validate === "function", label: "frozen schema validator available", detail: SCHEMA_REL },
  ];
  if (!pre.every((item) => item.ok)) {
    return record("S5-C", "S5-C agent L1 (preconditions)", false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`),
      repro);
  }

  let collector = null;
  let demo = null;
  try {
    collector = startJavaServer("collector(8601)", JDK21_JAVA, ["-jar", abs(COLLECTOR_JAR_REL)], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!health) {
      return record("S5-C", "S5-C agent L1 (collector health)", false,
        [{ ok: false, label: "collector health", detail: "timeout" }], repro);
    }

    demo = startJavaServer("demo(8080)+agent", JDK8_JAVA, [
      `-javaagent:${abs(AGENT_JAR_REL)}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      `-Dtraceboard.sessionId=${S5_SESSION}`,
      "-jar",
      abs(DEMO_JAR_REL),
    ], abs(S5_DEMO_BACKEND_REL));
    const ready = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!ready) {
      return record("S5-C", "S5-C agent L1 (demo startup)", false,
        [`demo /api/orders did not answer within ${START_TIMEOUT_MS}ms`, ...lastLines(demo.log.text, 5)], repro);
    }

    /* ---------------- preview-discount joined (EXACT) ---------------- */
    const traceId = hexRandom(16);
    const clientSpanId = hexRandom(8);
    const clickId = `click_${hexRandom(8)}`;
    const preview = await tryRequest(8080, s5PreviewQuery(1), {
      method: "POST",
      headers: { traceparent: `00-${traceId}-${clientSpanId}-01`, "X-TraceBoard-Click": clickId },
    }, 30000);
    const previewBody = preview.ok ? parseJson(preview.text) : { ok: false };
    checks.push({
      ok: preview.status === 200 && previewBody.ok && deepEqual(previewBody.value, { data: 0 }),
      label: "L1 POST preview-discount (joined traceparent/click) -> 200 {\"data\":0}",
      detail: `status=${preview.status} body=${show(preview.text)}`,
    });

    const polled = await pollUntil(async () => {
      const page = await getEventsPage(S5_SESSION, "?afterSeq=0&limit=200");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && page.res.status === 200 && spans.length >= 2 ? { page, spans } : null;
    }, 20000, 400);
    await sleep(600);
    const page1 = await getEventsPage(S5_SESSION, "?afterSeq=0&limit=200");
    const spans1 = Array.isArray(page1.value.events) ? page1.value.events.map((entry) => entry.event) : [];
    const schemaProblems1 = (typeof validate === "function" ? spans1 : []).filter((span) => !validate(span)).map((span) => span.spanId);
    checks.push({
      ok: Boolean(polled) && schemaProblems1.length === 0,
      label: "collector received the 2 preview spans within 20s and both validate against schema v1",
      detail: `spans=${spans1.length} schemaProblems=${schemaProblems1.join(",") || "none"}`,
    });

    const controller = spans1.find((span) => span.nodeKey === S5_PREVIEW_CONTROLLER_NODE_KEY) ?? null;
    const service = spans1.find((span) => span.nodeKey === S5_PREVIEW_SERVICE_NODE_KEY) ?? null;
    const kinds1 = sortedByStart(spans1).map((span) => span.kind);
    checks.push({
      ok: spans1.length === 2 && controller !== null && service !== null &&
        deepEqual(kinds1, ["controller", "service"]) &&
        !spans1.some((span) => span.kind === "mapper" || span.kind === "sql"),
      label: "exactly 2 spans: controller + service (findById is NOT instrumented -> no mapper/sql)",
      detail: `kinds=${kinds1.join(",")}`,
    });
    checks.push({
      ok: controller !== null && service !== null &&
        controller.traceId === traceId && service.traceId === traceId &&
        controller.parentSpanId === clientSpanId && service.parentSpanId === controller.spanId &&
        service.rootEventId === clickId &&
        controller.confidence === "EXACT" && service.confidence === "EXACT",
      label: "EXACT join: traceId/parent/rootEventId from traceparent+click; server span is the only child",
      detail: `controller.parent=${controller?.parentSpanId} service.parent=${service?.parentSpanId} root=${service?.rootEventId}`,
    });
    checks.push({
      ok: controller !== null && !Object.prototype.hasOwnProperty.call(controller, "values"),
      label: "controller span carries NO values (L1 facts live on the service span only)",
      detail: controller && Object.prototype.hasOwnProperty.call(controller, "values") ? "values present" : "values omitted",
    });

    const valueProblems = service !== null ? s5ServiceValueProblems(service, service) : ["service span missing"];
    checks.push({
      ok: valueProblems.length === 0,
      label: "service values exactly 5 (requestedAmount 100 / demoSecret [REDACTED len=6] / note 2048+truncated / amount 100->0 once / return 0)",
      detail: valueProblems.slice(0, 8).join(" || ") || "5 items in order",
    });
    const flagsService = Array.isArray(service?.flags) ? service.flags : [];
    const flagsController = Array.isArray(controller?.flags) ? controller.flags : [];
    checks.push({
      ok: flagsService.includes(S5_L1_FLAG) && flagsService.includes(S2_FLAG_CHAIN) &&
        !flagsService.some((flag) => /^(VALUES_CAPPED|L1_SKIPPED)=/.test(flag) || flag === "L2") &&
        !flagsController.includes(S5_L1_FLAG) && !spans1.some((span) => span.kind === "local"),
      label: "service flags include L1 (+S2_ZERO_ROW_CHAIN), no VALUES_CAPPED/L1_SKIPPED/L2, no kind=local",
      detail: `service=${show(flagsService)} controller=${show(flagsController)}`,
    });
    checks.push({
      ok: service !== null && service.status === "OK" && deepEqual(service.return, { type: "double", value: 0 }) &&
        controller !== null && deepEqual(controller.return, { type: S2_RESPONSE_ENTITY_TYPE, value: 200 }) &&
        service.source?.file === "OrderService.java",
      label: "service return {type:double,value:0} + status OK (0 is a value, not RETURNED_FALSE); controller ResponseEntity/200",
      detail: `service=${show(service?.return)} controller=${show(controller?.return)} source=${show(service?.source)}`,
    });
    const rawLeak = JSON.stringify(spans1).includes(S5_DEMO_SECRET);
    checks.push({
      ok: !rawLeak,
      label: "raw demoSecret s3cr3t appears nowhere in the collected events (placeholder only)",
      detail: rawLeak ? "LEAK" : "absent",
    });
    const logHasOrder = /transformed com\.example\.shop\.model\.Order/.test(demo.log.text);
    checks.push({
      ok: logHasOrder,
      label: "agent transformed com.example.shop.model.Order (field advice installed; no span of its own)",
      detail: logHasOrder ? "transformed" : lastLines(demo.log.text, 2).join(" | ").slice(0, 200),
    });

    const afterPreview = await tryRequest(8080, "/api/orders", { method: "GET" });
    const afterPreviewRow = s5OrderRow(afterPreview.text);
    checks.push({
      ok: afterPreviewRow !== null && Number(afterPreviewRow.amount) === 100 && afterPreviewRow.status === "CREATED",
      label: "DB untouched by L1: GET /api/orders amount still 100 / status CREATED",
      detail: show(afterPreviewRow),
    });

    /* ---------------- case A in the same demo (no values, no L1) ---------------- */
    const cancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" }, 30000);
    const cancelBody = cancel.ok ? parseJson(cancel.text) : { ok: false };
    const polled2 = await pollUntil(async () => {
      const page = await getEventsPage(S5_SESSION, "?afterSeq=0&limit=400");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && page.res.status === 200 && spans.length >= 6 ? { spans } : null;
    }, 20000, 400);
    await sleep(600);
    const page2 = await getEventsPage(S5_SESSION, "?afterSeq=0&limit=400");
    const spans2 = Array.isArray(page2.value.events) ? page2.value.events.map((entry) => entry.event) : [];
    const byTrace = new Map();
    for (const span of spans2) {
      if (!byTrace.has(span.traceId)) byTrace.set(span.traceId, []);
      byTrace.get(span.traceId).push(span);
    }
    const cancelSpans = [...byTrace.entries()].filter(([id]) => id !== traceId).map(([, group]) => group)[0] ?? [];
    const cancelSorted = sortedByStart(cancelSpans);
    const cancelKinds = cancelSorted.map((span) => span.kind);
    const cancelHasValues = cancelSpans.filter((span) => Object.prototype.hasOwnProperty.call(span, "values")).map((span) => span.spanId);
    const cancelHasL1 = cancelSpans.filter((span) => (Array.isArray(span.flags) ? span.flags : []).includes(S5_L1_FLAG));
    const cancelSql = cancelSorted.find((span) => span.kind === "sql") ?? null;
    const afterCancel = await tryRequest(8080, "/api/orders", { method: "GET" });
    const afterCancelRow = s5OrderRow(afterCancel.text);
    checks.push({
      ok: cancel.status === 200 && cancelBody.ok && deepEqual(cancelBody.value, { data: true }),
      label: "case A POST /api/orders/1/cancel (same demo) -> 200 {\"data\":true}",
      detail: `status=${cancel.status} body=${show(cancel.text)}`,
    });
    checks.push({
      ok: Boolean(polled2) && cancelSpans.length === 4 && deepEqual(cancelKinds, ["controller", "service", "mapper", "sql"]) &&
        cancelSorted.every((span) => span.confidence === "LOST") &&
        cancelSql !== null && Array.isArray(cancelSql.sideEffects) && cancelSql.sideEffects[0]?.rowsAffected === 0,
      label: "case A trace: 4 spans controller->service->mapper->sql (LOST), SQL rowsAffected=0; preview trace stays 2",
      detail: `cancelKinds=${cancelKinds.join(",")} rows=${show(cancelSql?.sideEffects)}`,
    });
    checks.push({
      ok: cancelHasValues.length === 0 && cancelHasL1.length === 0 && spans1.length === 2,
      label: "case A chain carries no values and no L1 flag (field advice never fires outside previewDiscount)",
      detail: `valuesOnCancel=${cancelHasValues.join(",") || "none"} l1OnCancel=${cancelHasL1.length}`,
    });
    checks.push({
      ok: afterCancelRow !== null && Number(afterCancelRow.amount) === 100 && afterCancelRow.status === "CREATED",
      label: "after case A: orders still CREATED / amount 100 (0-row UPDATE unchanged)",
      detail: show(afterCancelRow),
    });

    /* ---------------- collector down -> fail-open 200 ---------------- */
    await stopServer(collector);
    collector = null;
    const collectorFreed = await pollUntil(() => s5PortFree(8601).ok, 30000, 400);
    const failStarted = Date.now();
    const failOpen = await tryRequest(8080, s5PreviewQuery(1), { method: "POST" }, 30000);
    const failOpenBody = failOpen.ok ? parseJson(failOpen.text) : { ok: false };
    checks.push({
      ok: Boolean(collectorFreed) && failOpen.status === 200 && failOpenBody.ok && deepEqual(failOpenBody.value, { data: 0 }),
      label: "collector stopped (:8601 free) -> preview-discount still 200 {\"data\":0} (agent fail-open)",
      detail: `status=${failOpen.status} body=${show(failOpen.text)} ${Date.now() - failStarted}ms`,
    });
  } finally {
    await stopServer(demo);
    await stopServer(collector);
    const freed8080 = await pollUntil(() => s5PortFree(8080).ok, 30000, 400);
    console.log(`        demo stopped; 8080 ${freed8080 ? "free" : "STILL LISTENING"}; 8601 ${s5PortFree(8601).ok ? "free" : "STILL LISTENING"}`);
  }

  S5_EVIDENCE.agent = { checks };
  return gate(
    "S5-C",
    "S5 agent L1: controller+service only, 5 exact values (100 / [REDACTED len=6] / 2048 trunc / 100->0 / 0), L1 flag, no local, DB 100, case A unchanged, fail-open",
    checks,
    repro,
  );
}

async function checkS5() {
  const selected = S5_SELECTED ?? new Set(S5_IMPLEMENTED);
  const unimplemented = [...selected].filter((letter) => !S5_IMPLEMENTED.includes(letter));
  for (const letter of unimplemented) {
    record(
      `S5-${letter}`,
      `S5-${letter} is not implemented (implemented: ${S5_IMPLEMENTED.join(",")})`,
      false,
      [`requested --s5=${[...selected].join(",")}; implemented=${S5_IMPLEMENTED.join(",")}`],
      REPRO_S5,
    );
  }

  checkS5Builds();
  if (selected.has("A")) checkS5A();
  if (selected.has("B")) await checkS5B();
  if (selected.has("C")) await checkS5C(s5CompileValidator());
  if (selected.has("D")) await checkS5D();
  if (selected.has("E")) checkS5E();
  if (selected.has("F")) await checkS5F();
  if (selected.has("G")) checkS5G();
  if (selected.has("H")) checkS5H();
}

/** Compile the frozen schema independently so an S5-only run validates without the S0 gates. */
function s5CompileValidator() {
  try {
    const schema = JSON.parse(readFileSync(abs(SCHEMA_REL), "utf8"));
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    return ajv.compile(schema);
  } catch (error) {
    console.log(`        schema validator unavailable: ${error.message}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* S6a: L2 line-level locals + per-invocation ×3 (S6 stays partial)    */
/* ------------------------------------------------------------------ */

/** Source lines of the two assignment statements (recomputed, never hard-coded). */
function s6aL2SourceLines() {
  const lines = readFileSync(abs(S6A_L2_SERVICE_REL), "utf8").split(/\r?\n/);
  const initIndex = lines.findIndex((line) => /\bdouble\s+local\s*=\s*amount\s*;/.test(line));
  const assignIndex = lines.findIndex((line) => /\blocal\s*=\s*0\.0d\s*;/.test(line));
  return { initLine: initIndex >= 0 ? initIndex + 1 : null, assignLine: assignIndex >= 0 ? assignIndex + 1 : null };
}

/** Parse `javap -l -p` for the reconcileAmount LVT entry `local D` (+ Start/Length/Slot). */
function s6aParseLvt(text) {
  const evidence = { method: false, lvt: false, start: null, length: null, slot: null };
  let inTarget = false;
  for (const line of text.split(/\r?\n/)) {
    if (/public\s+double\s+reconcileAmount\s*\(\s*long\s*,\s*double\s*,\s*int\s*\)/.test(line)) {
      inTarget = true;
      evidence.method = true;
      continue;
    }
    if (!inTarget) continue;
    if (/^\s+(?:public|private|protected)\b.*;\s*$/.test(line)) {
      inTarget = false;
      continue;
    }
    const match = line.match(/^\s+(\d+)\s+(\d+)\s+(\d+)\s+local\s+D\s*$/);
    if (match) {
      evidence.lvt = true;
      evidence.start = Number(match[1]);
      evidence.length = Number(match[2]);
      evidence.slot = Number(match[3]);
    }
  }
  return evidence;
}

/** Reuse the S5-BUILD evidence in a full run; in S6a-only mode build root JDK21 + demo JDK8. */
function s6aEnsureJavaBuilds() {
  if (S6A_BUILD_CACHE.java) return S6A_BUILD_CACHE.java;
  if (S5_EVIDENCE.javaBuild) {
    S6A_BUILD_CACHE.java = { reused: true, ok: S5_EVIDENCE.javaBuild.ok === true, root: null, demo: null };
    return S6A_BUILD_CACHE.java;
  }
  const root = runShell("mvn -B -q -DskipTests package", {
    cwd: REPO,
    env: { ...process.env, JAVA_HOME: JDK21_HOME },
  });
  const demo = runShell("mvn -B -q -DskipTests package", {
    cwd: abs(S6A_DEMO_BACKEND_REL),
    env: { ...process.env, JAVA_HOME: JDK8_HOME },
  });
  S6A_BUILD_CACHE.java = {
    reused: false,
    ok: root.code === 0 && !root.error && !root.signal && !/BUILD FAILURE/.test(`${root.stdout}\n${root.stderr}`) &&
      demo.code === 0 && !demo.error && !demo.signal && !/BUILD FAILURE/.test(`${demo.stdout}\n${demo.stderr}`),
    root,
    demo,
  };
  return S6A_BUILD_CACHE.java;
}

/** S6a assets: SDK (S5 build), workbench dist and the demo frontend dist (S5 build cache). */
function s6aEnsureAssets() {
  if (!S6A_BUILD_CACHE.sdk) S6A_BUILD_CACHE.sdk = s5EnsureSdk();
  if (!S6A_BUILD_CACHE.workbench) S6A_BUILD_CACHE.workbench = s5EnsureWorkbench();
  if (!S6A_BUILD_CACHE.demoFrontend) S6A_BUILD_CACHE.demoFrontend = s5EnsureDemoFrontend();
  return S6A_BUILD_CACHE;
}

/** Bundle the workbench `s6/l2.ts` pure helpers and import them as ESM (no browser needed). */
async function loadS6L2Module() {
  const workbenchRequire = createRequire(path.join(REPO, "workbench", "package.json"));
  const esbuild = workbenchRequire("esbuild");
  const dir = mkdtempSync(path.join(os.tmpdir(), "tb-s6-l2-"));
  tmpDirs.push(dir);
  const outfile = path.join(dir, "l2.mjs");
  esbuild.buildSync({
    entryPoints: [abs("workbench/src/s6/l2.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    sourcemap: false,
  });
  return import(pathToFileURL(outfile).href);
}

/**
 * S6A-A: builds/artifact. Root reactor JDK21 (collector first, N1) + demo JDK8, agent jar major 52,
 * shaded/relocated ASM 9.7 (no un-relocated org/objectweb/asm), Premain-Class, `javap -l` proves
 * the `local:D` LVT entry, and one agent run proves exactly 2 probes (init offset == LVT Start,
 * lines recomputed from source) with no l2_probe_missing/l2_no_lvt/l2_transform_error.
 */
async function checkS6A() {
  section("S6A-A: build/artifact (root JDK21 + demo JDK8 + agent 52 + shaded ASM 9.7 + Premain + LVT local:D + 2-probe self-check)");
  const checks = [];
  const repro = `JAVA_HOME="${JDK21_HOME}" mvn -B -q -DskipTests package && (cd "${S6A_DEMO_BACKEND_REL}" && JAVA_HOME="${JDK8_HOME}" mvn -B -q -DskipTests package) && (cd "workbench" && npm ci && npm run build)`;
  const java = s6aEnsureJavaBuilds();
  checks.push({
    ok: java.ok === true,
    label: "collector/agent root reactor `mvn -B -q -DskipTests package` (JAVA_HOME=JDK21) + demo backend (JAVA_HOME=JDK8) exit 0 (collector built before any startup, N1)",
    detail: java.reused
      ? "reused the S5-BUILD evidence from this run (same working tree)"
      : `root exit=${java.root?.code} demo exit=${java.demo?.code} ${lastLines(`${java.root?.stdout ?? ""}\n${java.root?.stderr ?? ""}`, 1).join(" ").slice(0, 160)}`,
  });
  for (const rel of [COLLECTOR_JAR_REL, AGENT_JAR_REL, DEMO_JAR_REL]) {
    checks.push({
      ok: existsSync(abs(rel)) && statSync(abs(rel)).size > 0,
      label: `${path.basename(rel)} exists after the build`,
      detail: existsSync(abs(rel)) ? `${statSync(abs(rel)).size} bytes` : "missing",
    });
  }
  const javapAgent = existsSync(JDK21_JAVAP)
    ? runExe(JDK21_JAVAP, ["-verbose", "-classpath", abs(AGENT_JAR_REL), "io.traceboard.agent.TraceAgent"])
    : { stdout: "" };
  const agentMajor = Number((javapAgent.stdout.match(/major version:\s*(\d+)/) ?? [])[1]);
  checks.push({
    ok: agentMajor === 52,
    label: "agent jar compiled for Java 8 (major 52)",
    detail: `major=${Number.isNaN(agentMajor) ? "?" : agentMajor}`,
  });

  const jar = zipEntries(abs(AGENT_JAR_REL));
  const relocatedAsm = jar.entries.filter((entry) => entry.startsWith("io/traceboard/agent/shaded/org/objectweb/asm/"));
  const unrelocatedAsm = jar.entries.filter((entry) => entry.startsWith("org/objectweb/asm/"));
  const relocatedBb = jar.entries.filter((entry) => entry.startsWith("io/traceboard/agent/shaded/net/bytebuddy/"));
  checks.push({
    ok: jar.ok && relocatedAsm.length > 0 && unrelocatedAsm.length === 0 && relocatedBb.length > 0,
    label: "shaded ASM lives under io/traceboard/agent/shaded/org/objectweb/asm/** and no un-relocated org/objectweb/asm remains (byte-buddy shaded too)",
    detail: `asm=${relocatedAsm.length} unrelocated=${unrelocatedAsm.length} bytebuddy=${relocatedBb.length}`,
  });
  const manifest = runExe("unzip", ["-p", abs(AGENT_JAR_REL), "META-INF/MANIFEST.MF"]);
  const agentSource = readFileSync(abs("agent/src/main/java/io/traceboard/agent/TraceAgent.java"), "utf8");
  checks.push({
    ok: manifest.code === 0 && /Premain-Class:\s*io\.traceboard\.agent\.TraceAgent/.test(manifest.stdout) &&
      !/Agent-Class:/.test(manifest.stdout) && /public\s+static\s+void\s+premain\s*\(\s*String/.test(agentSource),
    label: "jar manifest declares Premain-Class io.traceboard.agent.TraceAgent (no Agent-Class; premain is public static)",
    detail: (manifest.stdout.match(/Premain-Class:[^\r\n]+/) ?? ["missing"])[0],
  });
  const agentPom = readFileSync(abs("agent/pom.xml"), "utf8");
  const depBlock = agentPom.match(/<dependencies>([\s\S]*?)<\/dependencies>/)?.[1] ?? "";
  const depArtifacts = [...depBlock.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)].map((match) => match[1]).sort();
  checks.push({
    ok: deepEqual(depArtifacts, ["asm", "asm-commons", "asm-tree", "byte-buddy"].sort()) &&
      /<asm\.version>9\.7<\/asm\.version>/.test(agentPom) &&
      /<shadedPattern>io\.traceboard\.agent\.shaded\.org\.objectweb\.asm<\/shadedPattern>/.test(agentPom) &&
      ["asm", "asm-tree", "asm-commons"].every((name) => depBlock.includes(`<artifactId>${name}</artifactId>`)) &&
      !/<dependency>[\s\S]*?(spring|servlet|mybatis)/i.test(agentPom),
    label: "agent pom dependencies are exactly byte-buddy + asm/asm-tree/asm-commons 9.7 (relocated; no Spring/Servlet/MyBatis)",
    detail: depArtifacts.join(","),
  });

  const sourceLines = s6aL2SourceLines();
  const javapLvt = existsSync(`${JDK8_HOME}/bin/javap.exe`)
    ? runExe(`${JDK8_HOME}/bin/javap.exe`, ["-l", "-p", "-classpath", abs(`${S6A_DEMO_BACKEND_REL}/target/classes`), "com.example.shop.service.L2DemoService"])
    : { stdout: "", code: -1, error: new Error("javap missing") };
  const lvt = s6aParseLvt(javapLvt.stdout ?? "");
  checks.push({
    ok: lvt.method && lvt.lvt && Number.isInteger(lvt.start) && Number.isInteger(lvt.length) &&
      sourceLines.initLine !== null && sourceLines.assignLine !== null && sourceLines.assignLine !== sourceLines.initLine,
    label: "`javap -l` proves reconcileAmount carries a LocalVariableTable entry local:D (Start/Length/Slot) and the source has distinct init/assign lines",
    detail: `local start=${lvt.start} length=${lvt.length} slot=${lvt.slot}; source init=${sourceLines.initLine} assign=${sourceLines.assignLine}`,
  });

  let demo = null;
  try {
    const port = s5PortFree(8080);
    checks.push({ ok: port.ok, label: "port 8080 free before the artifact run", detail: port.detail });
    if (port.ok) {
      demo = startJavaServer("demo(8080,agent-artifact)", JDK8_JAVA, [
        `-javaagent:${abs(AGENT_JAR_REL)}`,
        "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
        `-Dtraceboard.sessionId=${S6A_SESSION}_artifact`,
        "-jar",
        abs(DEMO_JAR_REL),
      ], abs(S6A_DEMO_BACKEND_REL));
      const ready = await pollUntil(async () => {
        const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
        return res.ok && res.status === 200 ? res : null;
      }, START_TIMEOUT_MS);
      await sleep(1000);
      const log = demo.log.text;
      checks.push({ ok: Boolean(ready), label: "demo answers /api/orders with the agent attached (classes load -> transformer runs)", detail: ready ? "200" : lastLines(log, 3).join(" | ") });
      const probe = log.match(/l2_probes_installed method=reconcileAmount offsets=(\d+),(\d+) lines=(\d+),(\d+)/);
      checks.push({
        ok: probe !== null && probe[1] !== probe[2] && Number(probe[1]) === lvt.start &&
          Number(probe[3]) === sourceLines.initLine && Number(probe[4]) === sourceLines.assignLine,
        label: "runtime self-check: exactly 2 probes, init offset == LVT Start (inclusive), lines == source init/assign (recomputed)",
        detail: probe ? `offsets=${probe[1]},${probe[2]} lines=${probe[3]},${probe[4]} lvtStart=${lvt.start}` : lastLines(log, 4).join(" | ").slice(0, 240),
      });
      const l2Failures = ["l2_probe_missing", "l2_no_lvt", "l2_no_method", "l2_transform_error"].filter((token) => log.includes(token));
      checks.push({
        ok: l2Failures.length === 0 && /premain installed/.test(log),
        label: "no l2_probe_missing/l2_no_lvt/l2_no_method/l2_transform_error; premain installed log present",
        detail: l2Failures.join(",") || "clean",
      });
    }
  } finally {
    await stopServer(demo);
    const freed = await pollUntil(() => s5PortFree(8080).ok, 30000, 400);
    checks.push({ ok: Boolean(freed), label: "artifact demo stopped, port 8080 released", detail: `8080=${s5PortFree(8080).detail}` });
  }

  const assets = s6aEnsureAssets();
  checks.push({
    ok: assets.sdk.ci.code === 0 && assets.sdk.build.code === 0 && assets.sdk.tests === "17" && assets.sdk.pass === "17",
    label: "SDK (S5 asset) npm ci + build + 17/17 tests still green",
    detail: `tests=${assets.sdk.tests} pass=${assets.sdk.pass}`,
  });
  const wbDist = distTextFiles(WORKBENCH_DIST_REL);
  checks.push({
    ok: assets.workbench.ci.code === 0 && assets.workbench.build.code === 0 && wbDist.length > 0,
    label: "workbench npm ci + npm run build exit 0 (S5/S6a UI assets rebuilt)",
    detail: `exit=${assets.workbench.build.code} dist=${wbDist.length} files`,
  });
  const demoDist = distTextFiles(DEMO_DIST_REL);
  checks.push({
    ok: assets.demoFrontend.ci.code === 0 && assets.demoFrontend.build.code === 0 && demoDist.length > 0,
    label: "demo frontend npm ci + npm run build exit 0 (S5 asset; #btn-reconcile ships in dist)",
    detail: `exit=${assets.demoFrontend.build.code} dist=${demoDist.length} files`,
  });

  S6A_EVIDENCE.javaBuild = { ok: checks.every((check) => check.ok), java, lvt, sourceLines };
  return gate(
    "S6A-A",
    "build/artifact: root JDK21 + demo JDK8; agent major 52; shaded/relocated ASM 9.7 (no un-relocated); Premain-Class; javap LVT local:D; 2-probe self-check init offset == LVT Start; SDK/workbench/demo assets built",
    checks,
    repro,
  );
}

/**
 * S6A-B: the demo reconcile endpoint without an agent. Any id -> 200 {"data":[100.0,0.0,100.0]};
 * pure computation (no DB read/write); case A cancel and the S5 L1 preview keep their behaviour.
 */
async function checkS6B() {
  section("S6A-B: demo reconcile (no agent) — exact 200 body, no DB, case A + L1 unchanged");
  const checks = [];
  const repro = `"${JDK8_JAVA}" -jar "${DEMO_JAR_REL}" & curl -s -X POST "http://127.0.0.1:8080/api/orders/1/reconcile"`;
  const pre = [
    { ok: s5PortFree(8080).ok, label: "port 8080 free before start", detail: s5PortFree(8080).detail },
    { ok: existsSync(abs(DEMO_JAR_REL)), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(JDK8_JAVA), label: "JDK8 java.exe exists", detail: JDK8_JAVA },
  ];
  const l2Source = readFileSync(abs(S6A_L2_SERVICE_REL), "utf8");
  checks.push({
    ok: !/\b(UPDATE|SELECT|INSERT|DELETE)\b|findById|JdbcTemplate|@Transactional|Mapper/.test(l2Source),
    label: "L2DemoService.java is pure computation: no UPDATE/SELECT/INSERT/DELETE/findById/JdbcTemplate/@Transactional/Mapper",
    detail: `${l2Source.split(/\r?\n/).length} lines scanned`,
  });
  const controllerDir = `${S6A_DEMO_BACKEND_REL}/src/main/java/com/example/shop/controller`;
  const mappingPaths = [];
  let ordersMapping = 0;
  for (const file of dirTextFiles(controllerDir)) {
    for (const match of file.text.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping\b(?:\s*\(\s*(?:path\s*=\s*)?["']([^"']*)["']\s*\))?/g)) {
      mappingPaths.push(match[2] ?? "");
    }
    if (/@RequestMapping\("\/api\/orders"\)/.test(file.text)) ordersMapping += 1;
  }
  checks.push({
    ok: ordersMapping === 1 && deepEqual(mappingPaths.slice().sort(), ["", "/{id}/cancel", "/{id}/preview-discount", "/{id}/reconcile", "/{id}/reconcile-async", "/{id}/no-debug", "/{id}/reconcile-loop"].sort()),
    label: "demo controller surface is exactly 7 mapped endpoints (GET list + cancel + preview-discount + reconcile + reconcile-async + no-debug + reconcile-loop)",
    detail: `orders=${ordersMapping} paths=${mappingPaths.join(",")}`,
  });
  const appSource = readFileSync(abs(`${S5_DEMO_FRONTEND_REL}/src/App.vue`), "utf8");
  const reconcileStart = appSource.indexOf("async function reconcile(");
  const reconcileEnd = appSource.indexOf("onMounted(", reconcileStart);
  const reconcileBody = reconcileStart >= 0 && reconcileEnd > reconcileStart ? appSource.slice(reconcileStart, reconcileEnd) : "";
  checks.push({
    ok: appSource.includes('id="btn-reconcile"') &&
      appSource.includes('fetch("/api/orders/1/reconcile", { method: "POST" })') &&
      appSource.includes('id="btn-reconcile-async"') &&
      appSource.includes('fetch("/api/orders/1/reconcile-async", { method: "POST" })') &&
      appSource.includes('id="btn-reconcile-loop"') &&
      appSource.includes('fetch("/api/orders/1/reconcile-loop?times=100", { method: "POST" })') &&
      reconcileBody.length > 0 && !reconcileBody.includes("loadOrders") &&
      !/wrapFn\("reconcile/.test(appSource) && appSource.includes(S6_BANNER),
    label: "demo frontend static: #btn-reconcile/#btn-reconcile-async/#btn-reconcile-loop -> plain POST handlers (no wrapFn), never loadOrders, canonical S6b banner present",
    detail: `handler=${reconcileBody.length} chars loadOrders=${reconcileBody.includes("loadOrders")} banner=${appSource.includes(S6_BANNER)}`,
  });
  if (!pre.every((item) => item.ok)) {
    return record("S6A-B", "S6A-B demo reconcile (preconditions)", false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`), repro);
  }

  let demo = null;
  try {
    demo = startJavaServer("demo(8080,no-agent) S6A-B", JDK8_JAVA, ["-jar", abs(DEMO_JAR_REL)], abs(S6A_DEMO_BACKEND_REL));
    const ready = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    if (!ready) {
      checks.push({ ok: false, label: "demo started", detail: lastLines(demo.log.text, 4).join(" | ") });
      return gate("S6A-B", "S6A-B demo reconcile (startup)", checks, repro);
    }
    const seed = s5OrderRow(ready.text);
    checks.push({
      ok: seed !== null && seed.status === "CREATED" && Number(seed.amount) === 100,
      label: "GET /api/orders seed: id=1 CREATED amount=100 before reconcile",
      detail: show(seed),
    });

    const reconcile1 = await tryRequest(8080, "/api/orders/1/reconcile", { method: "POST" }, 30000);
    const body1 = reconcile1.ok ? parseJson(reconcile1.text) : { ok: false };
    const raw1 = String(reconcile1.text ?? "").trim();
    checks.push({
      ok: reconcile1.status === 200 && body1.ok && deepEqual(body1.value, { data: [100, 0, 100] }) &&
        raw1 === '{"data":[100.0,0.0,100.0]}',
      label: 'POST /api/orders/1/reconcile -> 200 exact {"data":[100.0,0.0,100.0]} (3 floats, 2nd call bad)',
      detail: `status=${reconcile1.status} body=${show(reconcile1.text)}`,
    });
    const reconcile999 = await tryRequest(8080, "/api/orders/999/reconcile", { method: "POST" }, 30000);
    const body999 = reconcile999.ok ? parseJson(reconcile999.text) : { ok: false };
    checks.push({
      ok: reconcile999.status === 200 && body999.ok && deepEqual(body999.value, { data: [100, 0, 100] }) &&
        String(reconcile999.text ?? "").trim() === '{"data":[100.0,0.0,100.0]}',
      label: "unknown id 999 -> 200 same exact shape (pure computation, id not looked up; no 404/-1/null)",
      detail: `status=${reconcile999.status} body=${show(reconcile999.text)}`,
    });
    const afterReconcile = await tryRequest(8080, "/api/orders", { method: "GET" });
    const afterRow = s5OrderRow(afterReconcile.text);
    checks.push({
      ok: afterRow !== null && Number(afterRow.amount) === 100 && afterRow.status === "CREATED",
      label: "GET /api/orders after both reconciles: DB amount 100.00 / status CREATED (no DB read/write)",
      detail: show(afterRow),
    });

    const preview = await tryRequest(8080, s5PreviewQuery(1), { method: "POST" }, 30000);
    const previewBody = preview.ok ? parseJson(preview.text) : { ok: false };
    checks.push({
      ok: preview.status === 200 && previewBody.ok && deepEqual(previewBody.value, { data: 0 }),
      label: 'S5 L1 preview-discount still 200 {"data":0} (unchanged endpoint)',
      detail: `status=${preview.status} body=${show(preview.text)}`,
    });
    const cancel = await tryRequest(8080, "/api/orders/1/cancel", { method: "POST" }, 30000);
    const cancelBody = cancel.ok ? parseJson(cancel.text) : { ok: false };
    const afterCancel = await tryRequest(8080, "/api/orders", { method: "GET" });
    const afterCancelRow = s5OrderRow(afterCancel.text);
    checks.push({
      ok: cancel.status === 200 && cancelBody.ok && deepEqual(cancelBody.value, { data: true }) &&
        afterCancelRow !== null && Number(afterCancelRow.amount) === 100 && afterCancelRow.status === "CREATED",
      label: "case A POST /api/orders/1/cancel -> 200 {\"data\":true}; orders stay CREATED/100 (0-row UPDATE unchanged)",
      detail: `status=${cancel.status} body=${show(cancel.text)} row=${show(afterCancelRow)}`,
    });
  } finally {
    await stopServer(demo);
    const freed = await pollUntil(() => s5PortFree(8080).ok, 30000, 400);
    checks.push({ ok: Boolean(freed), label: "S6A-B cleanup: demo stopped, port 8080 released", detail: `8080=${s5PortFree(8080).detail}` });
  }

  S6A_EVIDENCE.demo = { checks };
  return gate(
    "S6A-B",
    "demo: reconcile 200 exact [100.0,0.0,100.0] (id 1 and 999), DB amount 100/CREATED, no DB source access, case A + L1 preview unchanged, #btn-reconcile static",
    checks,
    repro,
  );
}

/** Exact expected L2 values item (contract order irrelevant for JSON equality). */
function s6aL2Item(line, from, to, invocation) {
  return { name: "local", kind: "local", line, from, to, truncated: false, redacted: false, invocation };
}

/**
 * S6A-C: agent L2 E2E. collector(8601) + demo(8080) + agent, session s_s6a: controller + exactly
 * 3 same-nodeKey reconcileAmount spans (return 100/0/100), exact 1/2/1 values with the 2nd call's
 * 100 -> 0 at the recomputed `local = 0` line, L2 flag, no L1, no VerifyError, fail-open.
 */
async function checkS6C(validate) {
  section("S6A-C: agent L2 E2E (collector 8601 + demo 8080 + agent, session s_s6a)");
  const checks = [];
  const repro = `"${JDK8_JAVA}" -javaagent:"${AGENT_JAR_REL}" -Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events -Dtraceboard.sessionId=${S6A_SESSION} -jar "${DEMO_JAR_REL}"`;
  const pre = [
    { ok: s5PortFree(8601).ok, label: "port 8601 free before start", detail: s5PortFree(8601).detail },
    { ok: s5PortFree(8080).ok, label: "port 8080 free before start", detail: s5PortFree(8080).detail },
    { ok: existsSync(abs(COLLECTOR_JAR_REL)), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: existsSync(abs(DEMO_JAR_REL)), label: "demo jar exists", detail: DEMO_JAR_REL },
    { ok: existsSync(abs(AGENT_JAR_REL)), label: "agent jar exists", detail: AGENT_JAR_REL },
    { ok: existsSync(JDK21_JAVA) && existsSync(JDK8_JAVA), label: "JDK21 + JDK8 present", detail: `${JDK21_HOME} / ${JDK8_HOME}` },
    { ok: typeof validate === "function", label: "frozen schema validator available", detail: SCHEMA_REL },
  ];
  if (!pre.every((item) => item.ok)) {
    return record("S6A-C", "S6A-C agent L2 (preconditions)", false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`), repro);
  }
  const sourceLines = s6aL2SourceLines();
  const initLine = sourceLines.initLine;
  const assignLine = sourceLines.assignLine;
  const expectedValues = [
    [s6aL2Item(initLine, null, 100, 1)],
    [s6aL2Item(initLine, null, 100, 2), s6aL2Item(assignLine, 100, 0, 2)],
    [s6aL2Item(initLine, null, 100, 3)],
  ];

  let collector = null;
  let demo = null;
  try {
    collector = startJavaServer("collector(8601) S6A-C", JDK21_JAVA, ["-jar", abs(COLLECTOR_JAR_REL)], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector 8601 /actuator/health 200", detail: health ? "UP" : "timeout" });
    if (!health) return gate("S6A-C", "S6A-C agent L2 (collector unavailable)", checks, repro);

    demo = startJavaServer("demo(8080)+agent S6A-C", JDK8_JAVA, [
      `-javaagent:${abs(AGENT_JAR_REL)}`,
      "-Dtraceboard.ingestUrl=http://127.0.0.1:8601/ingest/v1/events",
      `-Dtraceboard.sessionId=${S6A_SESSION}`,
      "-jar",
      abs(DEMO_JAR_REL),
    ], abs(S6A_DEMO_BACKEND_REL));
    const ready = await pollUntil(async () => {
      const res = await tryRequest(8080, "/api/orders", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(ready), label: "demo+agent answers /api/orders (no VerifyError at startup)", detail: ready ? "200" : lastLines(demo.log.text, 5).join(" | ") });
    if (!ready) return gate("S6A-C", "S6A-C agent L2 (demo startup)", checks, repro);

    /* ---------------- joined reconcile: controller + 3 service spans ---------------- */
    const traceId = hexRandom(16);
    const clientSpanId = hexRandom(8);
    const clickId = `click_${hexRandom(8)}`;
    const reconcile = await tryRequest(8080, "/api/orders/1/reconcile", {
      method: "POST",
      headers: { traceparent: `00-${traceId}-${clientSpanId}-01`, "X-TraceBoard-Click": clickId },
    }, 30000);
    const reconcileBody = reconcile.ok ? parseJson(reconcile.text) : { ok: false };
    checks.push({
      ok: reconcile.status === 200 && reconcileBody.ok && deepEqual(reconcileBody.value, { data: [100, 0, 100] }),
      label: "joined reconcile -> 200 {\"data\":[100.0,0.0,100.0]}",
      detail: `status=${reconcile.status} body=${show(reconcile.text)}`,
    });
    const polled = await pollUntil(async () => {
      const page = await getEventsPage(S6A_SESSION, "?afterSeq=0&limit=400");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && spans.filter((span) => span.traceId === traceId).length >= 4 ? { page, spans } : null;
    }, 20000, 400);
    await sleep(600);
    const page1 = await getEventsPage(S6A_SESSION, "?afterSeq=0&limit=400");
    const spans1 = Array.isArray(page1.value.events) ? page1.value.events.map((entry) => entry.event) : [];
    const traceSpans = sortedByStart(spans1.filter((span) => span.traceId === traceId));
    const schemaProblems = traceSpans.filter((span) => (typeof validate === "function" ? !validate(span) : true))
      .map((span) => `${span.spanId}: ${(validate?.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
    checks.push({
      ok: Boolean(polled) && traceSpans.length === 4 && schemaProblems.length === 0,
      label: "collector received exactly 4 spans for the joined trace and every line validates against schema v1",
      detail: `spans=${traceSpans.length} schemaProblems=${schemaProblems.slice(0, 3).join(",") || "none"}`,
    });

    const controller = traceSpans.find((span) => span.kind === "controller") ?? null;
    const services = traceSpans.filter((span) => span.kind === "service");
    const kinds = traceSpans.map((span) => span.kind);
    checks.push({
      ok: deepEqual(kinds, ["controller", "service", "service", "service"]) &&
        controller !== null && controller.nodeKey === S6A_CONTROLLER_NODE_KEY &&
        services.length === 3 && !traceSpans.some((span) => span.kind === "mapper" || span.kind === "sql") &&
        !spans1.some((span) => String(span.nodeKey).includes("reconcileBatch")),
      label: "exactly 4 spans: 1 controller OrderController#reconcile + 3 service spans (no mapper/sql, no reconcileBatch span)",
      detail: `kinds=${kinds.join(",")} batchSpan=${spans1.some((span) => String(span.nodeKey).includes("reconcileBatch"))}`,
    });
    checks.push({
      ok: controller !== null && controller.parentSpanId === clientSpanId && controller.confidence === "EXACT" &&
        controller.rootEventId === clickId && deepEqual(controller.return, { type: "org.springframework.http.ResponseEntity", value: 200 }) &&
        !Object.prototype.hasOwnProperty.call(controller, "values") &&
        (controller.flags ?? []).includes(S2_FLAG_CHAIN) && !(controller.flags ?? []).includes(S6A_L2_FLAG) &&
        !(controller.flags ?? []).includes(S5_L1_FLAG),
      label: "controller: exact header join (parent=fetch spanId, EXACT, click id, ResponseEntity/200), NO values, no L2/L1 flag",
      detail: `parent=${controller?.parentSpanId} return=${show(controller?.return)} flags=${show(controller?.flags)}`,
    });

    const serviceNodeKeys = [...new Set(services.map((span) => span.nodeKey))];
    const starts = services.map((span) => span.startNs);
    const returns = services.map((span) => (span.return && typeof span.return.value === "number" ? span.return.value : null));
    checks.push({
      ok: services.length === 3 && deepEqual(serviceNodeKeys, [S6A_SERVICE_NODE_KEY]) &&
        controller !== null && services.every((span) => span.parentSpanId === controller.spanId) &&
        starts.every((value, index) => index === 0 || value > starts[index - 1]) &&
        deepEqual(returns, [100, 0, 100]) &&
        services.every((span) => span.status === "OK" && span.kind === "service" && span.confidence === "EXACT"),
      label: "3 same-nodeKey service spans under the controller, startNs strictly increasing, return 100/0/100, status OK, EXACT inherited",
      detail: `nodeKeys=${serviceNodeKeys.join(",")} returns=${returns.join(",")} starts=${starts.join(",")}`,
    });
    const flagProblems = [];
    services.forEach((span, index) => {
      const flags = Array.isArray(span.flags) ? span.flags : [];
      if (!flags.includes(S6A_L2_FLAG)) flagProblems.push(`inv${index + 1} missing L2`);
      if (!flags.includes(S2_FLAG_CHAIN)) flagProblems.push(`inv${index + 1} missing ${S2_FLAG_CHAIN}`);
      for (const forbidden of [S5_L1_FLAG, "LOST_BACKEND", "VALUES_CAPPED", "L1_SKIPPED", "S3_EXACT_LINK"]) {
        if (flags.some((flag) => flag === forbidden || flag.startsWith(`${forbidden}=`))) {
          flagProblems.push(`inv${index + 1} has ${forbidden}`);
        }
      }
      if (span.source?.file !== "L2DemoService.java" || !(span.source?.line >= 1)) flagProblems.push(`inv${index + 1} source=${show(span.source)}`);
    });
    checks.push({
      ok: flagProblems.length === 0,
      label: "service flags include L2 + S2_ZERO_ROW_CHAIN and exclude L1/LOST_BACKEND/VALUES_CAPPED/L1_SKIPPED/S3_EXACT_LINK; source L2DemoService.java:line",
      detail: flagProblems.slice(0, 6).join(" || ") || services.map((span) => (span.flags ?? []).join("+")).join(" | ").slice(0, 240),
    });

    const valueProblems = [];
    services.forEach((span, index) => {
      if (!deepEqual(span.values, expectedValues[index])) {
        valueProblems.push(`inv${index + 1} values=${show(span.values)} expected=${show(expectedValues[index])}`);
      }
    });
    const valueKinds = services.flatMap((span) => (span.values ?? []).map((item) => item.kind));
    checks.push({
      ok: valueProblems.length === 0 && valueKinds.every((kind) => kind === "local") &&
        services[1]?.values?.[1]?.line === assignLine && services[1]?.values?.[1]?.from === 100 && services[1]?.values?.[1]?.to === 0,
      label: `values exactly 1/2/1 items; 2nd invocation has local 100 -> 0 at the recomputed "local = 0" line (${assignLine}); first item from=null is a baseline, never a change`,
      detail: valueProblems.slice(0, 4).join(" || ") || `lines=${initLine}/${assignLine} kinds=${[...new Set(valueKinds)].join(",")}`,
    });

    const log1 = demo.log.text;
    const probe = log1.match(/l2_probes_installed method=reconcileAmount offsets=(\d+),(\d+) lines=(\d+),(\d+)/);
    const l2Failures = ["l2_probe_missing", "l2_no_lvt", "l2_no_method", "l2_transform_error"].filter((token) => log1.includes(token));
    const classErrors = /VerifyError|ClassFormatError|NoClassDefFoundError|UnsupportedClassVersionError/.test(log1);
    checks.push({
      ok: probe !== null && Number(probe[3]) === initLine && Number(probe[4]) === assignLine &&
        l2Failures.length === 0 && !classErrors && /transformed com\.example\.shop\.controller\.OrderController/.test(log1),
      label: "agent log: 2 probes at the recomputed lines, no l2_* failure, no VerifyError/ClassFormatError, reconcile controller advice installed",
      detail: probe ? `offsets=${probe[1]},${probe[2]} lines=${probe[3]},${probe[4]}` : `failures=${l2Failures.join(",")} classErrors=${classErrors}`,
    });

    /* ---------------- headerless reconcile: legal S2 LOST child chain, never fake EXACT ---------------- */
    const noHeader = await tryRequest(8080, "/api/orders/1/reconcile", { method: "POST" }, 30000);
    const noHeaderBody = noHeader.ok ? parseJson(noHeader.text) : { ok: false };
    const polled2 = await pollUntil(async () => {
      const page = await getEventsPage(S6A_SESSION, "?afterSeq=0&limit=400");
      const spans = Array.isArray(page.value.events) ? page.value.events.map((entry) => entry.event) : [];
      return page.res.ok && spans.length >= 8 ? spans : null;
    }, 20000, 400);
    await sleep(600);
    const page2 = await getEventsPage(S6A_SESSION, "?afterSeq=0&limit=400");
    const spans2 = Array.isArray(page2.value.events) ? page2.value.events.map((entry) => entry.event) : [];
    const lostSpans = sortedByStart(spans2.filter((span) => span.traceId !== traceId));
    const lostController = lostSpans.find((span) => span.kind === "controller") ?? null;
    const lostServices = lostSpans.filter((span) => span.kind === "service");
    checks.push({
      ok: noHeader.status === 200 && noHeaderBody.ok && deepEqual(noHeaderBody.value, { data: [100, 0, 100] }) &&
        Boolean(polled2) && lostSpans.length === 4 && lostController !== null && lostServices.length === 3 &&
        lostController.confidence === "LOST" && (lostController.flags ?? []).includes("LOST_BACKEND") &&
        lostSpans.every((span) => span.confidence === "LOST") &&
        lostServices.every((span) => span.parentSpanId === lostController.spanId && (span.flags ?? []).includes(S6A_L2_FLAG) &&
          !(span.flags ?? []).includes("LOST_BACKEND")),
      label: "headerless reconcile: 200 + legal S2 LOST chain (LOST_BACKEND only on the root, 3 L2 children), no fabricated EXACT (headerless L2 values not required)",
      detail: `status=${noHeader.status} spans=${lostSpans.length} controller=${lostController?.confidence}/${show(lostController?.flags)} services=${lostServices.length}`,
    });

    /* ---------------- collector down -> fail-open ---------------- */
    await stopServer(collector);
    collector = null;
    const freed = await pollUntil(() => s5PortFree(8601).ok, 30000, 400);
    const failOpen = await tryRequest(8080, "/api/orders/1/reconcile", { method: "POST" }, 30000);
    const failBody = failOpen.ok ? parseJson(failOpen.text) : { ok: false };
    checks.push({
      ok: Boolean(freed) && failOpen.status === 200 && failBody.ok && deepEqual(failBody.value, { data: [100, 0, 100] }),
      label: "collector stopped (:8601 free) -> reconcile still 200 exact body (agent fail-open)",
      detail: `status=${failOpen.status} body=${show(failOpen.text)}`,
    });
    checks.push({
      ok: !/VerifyError|ClassFormatError|NoClassDefFoundError/.test(demo.log.text),
      label: "no VerifyError/ClassFormatError after the full L2 run (fail-open injection)",
      detail: "clean",
    });
  } finally {
    await stopServer(demo);
    await stopServer(collector);
    const freed8080 = await pollUntil(() => s5PortFree(8080).ok, 30000, 400);
    checks.push({
      ok: Boolean(freed8080) && s5PortFree(8601).ok,
      label: "S6A-C cleanup: demo + collector stopped, ports 8080/8601 released",
      detail: `8080=${s5PortFree(8080).detail} 8601=${s5PortFree(8601).detail}`,
    });
  }

  S6A_EVIDENCE.agent = { checks };
  return gate(
    "S6A-C",
    "agent L2: controller + 3 same-nodeKey reconcileAmount spans, return 100/0/100, values 1/2/1 (2nd call 100->0 at the source line), L2 flag/no L1, controller no values, no VerifyError, headerless LOST chain legal, collector-down fail-open",
    checks,
    repro,
  );
}

/**
 * S6A-D: workbench. Ingest the S6a fixture -> graph 6 nodes/5 edges/15 ordered fields; pure
 * helpers (workbench/src/s6/**) prove per-fixture conditionality (only L2 nodes, only the 2nd
 * invocation changes, rows 2/1/1); dist assertions stay at the STATIC token layer (dynamic Vue
 * attrs/interpolations are NOT dist literals - conditionality is S6A-C runtime + these helpers).
 */
async function checkS6D() {
  section("S6A-D: workbench (fixture graph 6/5/15, static dist tokens, pure s6 helpers)");
  const checks = [];
  const repro = `curl -s -X POST "http://127.0.0.1:8601/ingest/v1/events" -H "Content-Type: application/x-ndjson" --data-binary @"${S6A_EVENTS_REL}" && (cd "workbench" && npm run build) && curl -s "http://127.0.0.1:8601/api/v1/sessions/${S6A_FIXTURE_SESSION}/graph?traceId=6b7c8d9e0f1a2b3c4d5e6f708192a3b4"`;
  const eventsText = readFileSync(abs(S6A_EVENTS_REL), "utf8");
  const eventLines = eventsText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events = [];
  const parseProblems = [];
  for (const [index, line] of eventLines.entries()) {
    const parsed = parseJson(line);
    if (!parsed.ok) parseProblems.push(`line ${index + 1}`);
    else events.push(parsed.value);
  }
  const factsParsed = parseJson(readFileSync(abs(S6A_FACTS_REL), "utf8"));
  const facts = factsParsed.ok ? factsParsed.value : {};
  const workbench = facts.workbenchExpectations ?? {};
  const graphExpected = facts.apiExpectations?.graph ?? {};
  const pre = [
    { ok: existsSync(abs(S6A_EVENTS_REL)) && existsSync(abs(S6A_FACTS_REL)) && existsSync(abs(S6A_README_REL)), label: "fixtures/s6-l2-lines/{events.ndjson,expected-facts.json,README.md} exist", detail: S6A_FIXTURE_DIR },
    { ok: eventLines.length === 6 && events.length === 6 && parseProblems.length === 0, label: "S6a fixture has 6 parseable NDJSON events", detail: `lines=${eventLines.length} parsed=${events.length}` },
    { ok: factsParsed.ok && facts.stage === "S6a" && facts.eventCount === 6 && facts.workbenchExpectations?.l2BadgeText === "L2", label: "expected-facts: stage S6a, 6 events + workbench expectations", detail: `stage=${facts.stage}` },
    { ok: existsSync(JDK21_JAVA), label: "JDK21 java.exe exists", detail: JDK21_JAVA },
    { ok: existsSync(abs(COLLECTOR_JAR_REL)), label: "collector jar exists", detail: COLLECTOR_JAR_REL },
    { ok: listeningOn(8601).lines.length === 0, label: "port 8601 free before start", detail: listeningOn(8601).lines.join(" | ") || "no listener" },
  ];
  if (!pre.every((item) => item.ok)) {
    return record("S6A-D", "S6A-D workbench (preconditions)", false,
      pre.map((item) => `${item.ok ? "ok " : "BAD"} ${item.label} :: ${item.detail}`), repro);
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync(abs(SCHEMA_REL), "utf8")));
  const schemaProblems = events.filter((event) => !validate(event))
    .map((event, index) => `${event.spanId ?? `#${index}`}: ${(validate.errors ?? []).slice(0, 2).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  checks.push({
    ok: schemaProblems.length === 0,
    label: "6/6 S6a fixture events validate against the frozen Ajv 2020-12 schema (strict)",
    detail: schemaProblems.slice(0, 3).join(" || ") || "6/6 valid",
  });

  let collector = null;
  let modules = null;
  try {
    collector = startJavaServer("collector(8601) S6A-D", JDK21_JAVA, ["-jar", abs(COLLECTOR_JAR_REL)], REPO);
    const health = await pollUntil(async () => {
      const res = await requestBase(COLLECTOR_BASE, "/actuator/health", { method: "GET" }, 5000);
      return res.ok && res.status === 200 ? res : null;
    }, START_TIMEOUT_MS);
    checks.push({ ok: Boolean(health), label: "collector 8601 /actuator/health 200", detail: health ? "UP" : "timeout" });
    if (!health) return gate("S6A-D", "S6A-D workbench (collector unavailable)", checks, repro);

    const ingest = await postNdjson("/ingest/v1/events", eventsText, `${NDJSON}; charset=utf-8`);
    const ingestParsed = ingest.ok ? parseJson(ingest.text) : { ok: false };
    const ingestBody = ingestParsed.ok && ingestParsed.value ? ingestParsed.value : {};
    checks.push({
      ok: ingest.ok && ingest.status === 202 && ingestBody.accepted === 6 && ingestBody.rejected === 0,
      label: "ingest fixtures/s6-l2-lines/events.ndjson (session s_s6l2a) -> 202 accepted=6 rejected=0",
      detail: `status=${ingest.status} body=${show(ingest.text)}`,
    });

    const graphRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S6A_FIXTURE_SESSION}/graph?traceId=${graphExpected.traceId}`);
    const graphParsed = graphRes.ok ? parseJson(graphRes.text) : { ok: false };
    const graph = graphParsed.ok && graphParsed.value ? graphParsed.value : {};
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];
    const fixtureBySpanId = new Map(events.map((event) => [event.spanId, event]));
    const nodeProblems = [];
    nodes.forEach((node, index) => {
      const keys = Object.keys(node ?? {});
      if (keys.join(",") !== S5_GRAPH_NODE_KEYS_ORDERED.join(",")) nodeProblems.push(`node${index} keys=${keys.join(",")}`);
      const event = fixtureBySpanId.get(node.spanId);
      if (!event) {
        nodeProblems.push(`node${index} unknown spanId=${node.spanId}`);
        return;
      }
      if (node.parentSpanId !== event.parentSpanId || node.kind !== event.kind || node.nodeKey !== event.nodeKey ||
          node.status !== event.status || node.startNs !== event.startNs || node.durNs !== event.durNs) {
        nodeProblems.push(`node${index} scalars`);
      }
      nodeProblems.push(...graphValuesProblems(node, event, `node${index}`));
    });
    const serviceNodes = nodes.filter((node) => node.kind === "service");
    checks.push({
      ok: graphRes.ok && graphRes.status === 200 && graph.sessionId === S6A_FIXTURE_SESSION &&
        graph.traceId === graphExpected.traceId && graph.rootEventId === graphExpected.rootEventId &&
        graph.confidence === graphExpected.confidence &&
        nodes.length === 6 && edges.length === 5 && nodeProblems.length === 0 &&
        deepEqual(nodes.map((node) => node.spanId), graphExpected.nodeOrder ?? []) &&
        deepEqual(nodes.map((node) => node.kind), graphExpected.kindOrder ?? []) &&
        deepEqual(edges, graphExpected.edges ?? []) &&
        serviceNodes.length === 3,
      label: "graph: 6 nodes / 5 edges, exact node+kind order and edges, every node has the 15 ordered fields with values verbatim (null on click/fetch/controller)",
      detail: nodeProblems.slice(0, 5).join(" || ") || `${nodes.length} nodes / ${edges.length} edges / ${serviceNodes.length} service`,
    });
    const valueShapes = serviceNodes.map((node) => (Array.isArray(node.values) ? node.values.length : -1));
    const nullSpans = nodes.filter((node) => graphExpected.valuesNullSpanIds?.includes(node.spanId));
    checks.push({
      ok: deepEqual(valueShapes, graphExpected.valuesValueCounts ?? [1, 2, 1]) &&
        nullSpans.length === 3 && nullSpans.every((node) => node.values === null) &&
        deepEqual(serviceNodes.map((node) => node.spanId), graphExpected.valuesSpanIds ?? []),
      label: "values verbatim: 1/2/1 items on the 3 service nodes; click/fetch/controller carry null (never [])",
      detail: `counts=${valueShapes.join("/")} nulls=${nullSpans.length}`,
    });
    const requestsRes = await requestBase(COLLECTOR_BASE, `/api/v1/sessions/${S6A_FIXTURE_SESSION}/requests`);
    const requestsParsed = requestsRes.ok ? parseJson(requestsRes.text) : { ok: false };
    const requestsBody = requestsParsed.ok && requestsParsed.value ? requestsParsed.value : {};
    const rows = Array.isArray(requestsBody.requests) ? requestsBody.requests : [];
    const expectedRow = facts.apiExpectations?.requests?.row ?? {};
    checks.push({
      ok: requestsRes.ok && requestsRes.status === 200 && requestsBody.sdkActive === true && rows.length === 1 &&
        deepEqual(rows[0], expectedRow) && !Object.prototype.hasOwnProperty.call(rows[0] ?? {}, "values"),
      label: "requests: 1 EXACT row (6 spans, fetchCount=1, backendSpanCount=4, #btn-reconcile), no values key",
      detail: show(rows[0]),
    });

    /* ---------------- dist: STATIC tokens only ---------------- */
    const wb = s5EnsureWorkbench();
    const wbDist = distTextFiles(WORKBENCH_DIST_REL);
    const wbText = wbDist.map((file) => file.text).join("\n");
    const missingS6 = S6A_WORKBENCH_TOKENS.filter((token) => !wbText.includes(token));
    checks.push({
      ok: wb.build.code === 0 && wbDist.length > 0 && missingS6.length === 0,
      label: "workbench dist STATIC tokens: s6-l2-badge/s6-l2-note/data-value-kind/data-invocation-diff/行号 /100 → 0/值变化 + canonical S6b banner/L2 note/×N note (dynamic Vue attrs are NOT asserted as dist literals)",
      detail: missingS6.length ? `missing=${missingS6.join(",")}` : `${S6A_WORKBENCH_TOKENS.length}/${S6A_WORKBENCH_TOKENS.length} tokens`,
    });
    const retained = [
      ...((workbench.s5SelectorsRetained ?? []).map((token) => token.replace(/^#/, ""))),
      ...(workbench.staticDistTokens ?? []).filter((token) => ["s3-panel", "s4-detail", "s4-group-badge"].includes(token)),
    ];
    const missingRetained = [...new Set(retained)].filter((token) => !wbText.includes(token));
    checks.push({
      ok: missingRetained.length === 0 && wbText.includes("已确认：本次点击因果链内没有网络请求") && wbText.includes("逐次调用"),
      label: "S5 selectors (#s5-values/#s5-l1-badge/#s5-source/#s5-values-empty) and S3/S4 panels/×N detail stay in dist",
      detail: missingRetained.join(",") || "retained",
    });
    const claimTargets = [];
    const addClaimFiles = (rel, strip) => {
      if (!existsSync(abs(rel))) return;
      const entries = rel === WORKBENCH_DIST_REL || rel === DEMO_DIST_REL
        ? distTextFiles(rel).map((file) => ({ rel: file.rel, text: file.text }))
        : walk(abs(rel)).map((file) => ({ rel: relOf(file), text: readFileSync(file, "utf8") }));
      for (const entry of entries) claimTargets.push({ rel: entry.rel, text: strip ? stripComments(entry.text) : entry.text });
    };
    addClaimFiles(WORKBENCH_DIST_REL, false);
    addClaimFiles("workbench/src", true);
    addClaimFiles(`${S5_DEMO_FRONTEND_REL}/src`, true);
    addClaimFiles(DEMO_DIST_REL, false);
    const claimHits = [];
    const forbiddenClaims = [
      ...(workbench.staleTextsMustBeAbsentFromSrcAndDist ?? []),
      ...(workbench.forbiddenTexts ?? []),
      "异步上下文已采集", "无调试信息已处理", "循环折叠已实现", "L2 开销 ≤40%", "全部方法 L2",
    ];
    for (const file of claimTargets) {
      for (const token of [...new Set(forbiddenClaims)]) {
        if (file.text.includes(token)) claimHits.push(`${file.rel} -> ${token}`);
      }
    }
    checks.push({
      ok: claimHits.length === 0,
      label: "no stale S5 absolute copy and no S6b claim (async/no-debug/loop-fold/overhead/all-methods-L2) in workbench/demo src+dist",
      detail: claimHits.slice(0, 6).join(" || ") || "0 stale/overclaim hits",
    });

    /* ---------------- pure helpers: conditionality on the fixture ---------------- */
    modules = await loadS6L2Module();
    const exportNames = ["isL2Node", "localValueRows", "isValueChange", "invocationDiffNodes"];
    checks.push({
      ok: exportNames.every((name) => typeof modules[name] === "function") && modules.L2_BADGE_TEXT === "L2" && modules.VALUE_CHANGE_TEXT === "值变化",
      label: "workbench/src/s6/l2.ts bundles under esbuild and exports isL2Node/localValueRows/isValueChange/invocationDiffNodes",
      detail: exportNames.map((name) => `${name}=${typeof modules[name]}`).join(","),
    });
    const nonService = nodes.filter((node) => node.kind !== "service");
    const l2Flags = serviceNodes.map((node) => modules.isL2Node(node));
    const nonL2 = nonService.map((node) => modules.isL2Node(node));
    checks.push({
      ok: l2Flags.every(Boolean) && nonL2.every((value) => value === false) && nonService.length === 3,
      label: "isL2Node is true for the 3 L2 service nodes and false for click/fetch/controller (flag-only, no nodeKey hard-coding)",
      detail: `service=${l2Flags.join(",")} others=${nonL2.join(",")}`,
    });
    const rowCounts = serviceNodes.map((node) => modules.localValueRows(node).length);
    const diffMatrix = serviceNodes.map((node) => modules.localValueRows(node).map((value) => modules.isValueChange(value)));
    const diffNodeIds = modules.invocationDiffNodes(serviceNodes).map((node) => node.spanId);
    const secondRow = modules.localValueRows(serviceNodes[1] ?? { values: [] })[1] ?? null;
    const expectedSecondRow = workbench.pureFunctionExpectations?.secondLocalRow ?? {};
    checks.push({
      ok: deepEqual(rowCounts, [1, 2, 1]) &&
        deepEqual(diffMatrix, [[false], [false, true], [false]]) &&
        deepEqual(diffNodeIds, [graphExpected.valuesSpanIds?.[1]]) &&
        secondRow?.line === expectedSecondRow.line && secondRow?.from === expectedSecondRow.from && secondRow?.to === expectedSecondRow.to,
      label: `fixture conditionality: rows 2/1/1; only the 2nd invocation's 2nd row is a value change (from=100 -> 0 at fixture line ${expectedSecondRow.line}); first observation from=null is not; invocationDiffNodes = 2nd span only`,
      detail: `rows=${rowCounts.join("/")} diff=${JSON.stringify(diffMatrix)} diffNodes=${diffNodeIds.join(",")} second=${show(secondRow)}`,
    });
    const strippedS6 = stripComments(readFileSync(abs("workbench/src/s6/l2.ts"), "utf8"));
    const isL2Fn = strippedS6.match(/export function isL2Node[\s\S]*?\n}/)?.[0] ?? "";
    checks.push({
      ok: /flags\.includes\(L2_FLAG\)/.test(isL2Fn) && !/nodeKey|reconcileAmount|L2DemoService/.test(isL2Fn),
      label: "s6 helper source proves the L2 badge rule is flag-based (isL2Node = flags.includes(L2_FLAG)) and never hard-codes the method/nodeKey",
      detail: isL2Fn.replace(/\s+/g, " ").slice(0, 160) || "isL2Node not found",
    });

    S6A_EVIDENCE.fixture = { events: events.length, nodes: nodes.length, edges: edges.length, values: valueShapes };
    S6A_EVIDENCE.workbench = { tokens: S6A_WORKBENCH_TOKENS.length, rowCounts, diffNodeIds };
  } catch (error) {
    checks.push({ ok: false, label: "S6A-D unexpected error", detail: String(error && error.message ? error.message : error) });
  } finally {
    await stopServer(collector);
    const freed = await pollUntil(() => listeningOn(8601).lines.length === 0, 30000, 400);
    checks.push({ ok: Boolean(freed), label: "S6A-D cleanup: collector stopped, port 8601 released", detail: `8601=${listeningOn(8601).lines.length}` });
  }

  return gate(
    "S6A-D",
    "workbench: fixture graph 6/5/15 + values verbatim, static dist tokens + canonical copy + retained S3/S4/S5 selectors, pure s6 helpers prove only-L2/only-2nd-diff/rows 2-1-1; dist is static-token-only by design",
    checks,
    repro,
  );
}

/**
 * S6A-E: regression/scope/cleanup. S0–S5 anchors (full run), S6A_G1_FREEZE + S5 18-entry freeze
 * at S6a hashes, S0–S5 fixture/schema/transport/status bytes, case A/B/L1/replay unchanged, no
 * S6b capability/claims, no secrets/CDN/mirrors, ports/processes/git whitelist, cleanup.
 */
function checkS6E() {
  section("S6A-E: regression/scope/cleanup (S6a; S0–S5 anchors, S6A/S6B freeze with api/event-model superseded by S6b, S6b only in whitelisted files)");
  const checks = [];
  const repro = REPRO_S6;

  const reviewText = readFileSync(abs(S6_PLAN_REVIEW_REL), "utf8");
  checks.push({
    ok: /最终结论：G1: PASS/.test(reviewText) && /G1: PASS/.test(reviewText),
    label: "S6a plan-review records G1: PASS (freeze is the authority)",
    detail: "plan-review-s6a.md",
  });
  const s6Drift = [];
  const s6aKept = [];
  for (const [rel, s6aHash] of Object.entries(S6A_G1_FREEZE)) {
    const expected = LATEST_G1_FREEZE[rel] ?? s6aHash;
    const actual = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (actual !== expected) s6Drift.push(`${rel} ${actual.slice(0, 12)}…!=${expected.slice(0, 12)}…`);
    if (!["docs/contracts/api.v1.md", "docs/contracts/event-model.v1.md"].includes(rel) && actual !== s6aHash) s6aKept.push(rel);
  }
  checks.push({
    ok: Object.keys(S6A_G1_FREEZE).length === 8 && s6Drift.length === 0 && s6aKept.length === 0,
    label: "S6A_G1_FREEZE zero drift: S6a fixture 3 files + s6a-plan/dispatch/plan-review keep their S6a hashes; api/event-model are superseded by S6b",
    detail: s6Drift.length || s6aKept.length ? s6Drift.slice(0, 4).concat(s6aKept).join(" || ") : "8/8 match (2 superseded)",
  });
  const supersededRels = ["docs/contracts/api.v1.md", "docs/contracts/event-model.v1.md"];
  const s5Drift = [];
  for (const [rel, s5Hash] of Object.entries(S5_G1_FREEZE)) {
    const expected = LATEST_G1_FREEZE[rel] ?? s5Hash;
    const actual = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (actual !== expected) s5Drift.push(rel);
  }
  const keptAtS5 = Object.entries(S5_G1_FREEZE)
    .filter(([rel]) => !supersededRels.includes(rel))
    .every(([rel, hash]) => existsSync(abs(rel)) && sha256File(abs(rel)) === hash);
  checks.push({
    ok: Object.keys(S5_G1_FREEZE).length === 18 && s5Drift.length === 0 && keptAtS5 &&
      Object.keys(S6B_G1_FREEZE).length === 14 &&
      supersededRels.every((rel) => LATEST_G1_FREEZE[rel] === S6B_G1_FREEZE[rel]),
    label: "S5 G1 freeze 18/18 (16 files at their S5 bytes; api/event-model superseded by the S6b hashes) + S6B_G1_FREEZE 14 entries + schema/transport/status unchanged",
    detail: s5Drift.length ? `drift=${s5Drift.join(",")}` : "18/18 match (2 superseded), S6b=14",
  });

  const fixtureBaseline = new Map();
  const fixtureConflicts = [];
  const collectFixtures = (entries) => {
    for (const entry of entries) {
      if (!entry.rel.startsWith("fixtures/")) continue;
      const expected = LATEST_G1_FREEZE[entry.rel] ?? entry.hash;
      if (fixtureBaseline.has(entry.rel) && fixtureBaseline.get(entry.rel) !== expected) fixtureConflicts.push(entry.rel);
      fixtureBaseline.set(entry.rel, expected);
    }
  };
  collectFixtures(s3FreezeSections().all);
  collectFixtures(s2FreezeSections().all);
  collectFixtures(Object.entries(S5_G1_FREEZE).map(([rel, hash]) => ({ rel, hash })));
  collectFixtures(Object.entries(S6A_G1_FREEZE).map(([rel, hash]) => ({ rel, hash })));
  collectFixtures(Object.entries(S6B_G1_FREEZE).map(([rel, hash]) => ({ rel, hash })));
  const fixtureDrift = [];
  for (const [rel, expected] of fixtureBaseline) {
    const now = existsSync(abs(rel)) ? sha256File(abs(rel)) : "missing";
    if (now !== expected) fixtureDrift.push(rel);
  }
  const s6FixtureFiles = walk(abs(S6A_FIXTURE_DIR)).map(relOf).sort();
  const s6bFixtureFiles = S6B_FIXTURE_DIRS.map((dir) => walk(abs(dir)).map(relOf).sort()).flat();
  const s6bFixtureProblems = S6B_FIXTURE_DIRS.filter((dir, index) =>
    !deepEqual(s6bFixtureFiles.slice(index * 3, index * 3 + 3), [`${dir}/README.md`, `${dir}/events.ndjson`, `${dir}/expected-facts.json`].sort()));
  checks.push({
    ok: fixtureBaseline.size >= 22 && fixtureConflicts.length === 0 && fixtureDrift.length === 0 &&
      deepEqual(s6FixtureFiles, [S6A_EVENTS_REL, S6A_FACTS_REL, S6A_README_REL].sort()) &&
      s6bFixtureProblems.length === 0,
    label: "S0–S5/S6a/S6b fixture bytes unchanged; fixtures/s6-l2-lines = 3 files; fixtures/s6b-{async,no-debug,loop} = exactly 3 files each",
    detail: fixtureDrift.length || fixtureConflicts.length || s6bFixtureProblems.length
      ? `drift=${fixtureDrift.join(",")} conflicts=${fixtureConflicts.join(",")} s6b=${s6bFixtureProblems.join(",")}`
      : `${fixtureBaseline.size} fixtures match; S6a=3, S6b=9 files`,
  });

  if (S6_ONLY) {
    const selected = S6_SELECTED ?? new Set(S6A_IMPLEMENTED);
    const s6aBad = ["A", "B", "C", "D"].filter((letter) => selected.has(letter) && resultById(`S6A-${letter}`)?.ok !== true);
    checks.push({
      ok: s6aBad.length === 0,
      label: "requested S6a gates (A–D) already PASS before S6A-E closure (S0–S5 anchors are deferred in --s6a mode by design, never a fake PASS)",
      detail: s6aBad.length ? `failed=${s6aBad.join(",")}` : `selected=${[...selected].join(",")}; run the full suite for the S0–S5 anchor set`,
    });
  } else {
    const prior = RESULTS.filter((item) => !String(item.id).startsWith("S6A-"));
    const priorFailed = prior.filter((item) => !item.ok);
    const anchors = [...S4_H_ANCHORS, "S5-BUILD", ...S5_IMPLEMENTED.map((letter) => `S5-${letter}`)];
    const missingAnchors = anchors.filter((id) => resultById(id)?.ok !== true);
    const s6aBad = ["A", "B", "C", "D"].filter((letter) => resultById(`S6A-${letter}`)?.ok !== true);
    const regressionIds = ["S2-3", "S3-3", "S3-4", "S3-5", "S3-7", "S3-9", "S5-B", "S5-C"];
    const regressionBad = regressionIds.filter((id) => resultById(id)?.ok !== true);
    checks.push({
      ok: prior.length >= 50 && priorFailed.length === 0 && missingAnchors.length === 0 &&
        s6aBad.length === 0 && regressionBad.length === 0,
      label: "full run: every S0–S5 gate PASS, 39 S4-H anchors + S5-BUILD/A–H present, S6A-A..D PASS; case A/B, L1 5 values, EXACT join, replay 0-write, S2 LOST 4-span unchanged",
      detail: `prior=${prior.length} priorFailed=${priorFailed.map((item) => item.id).join(",") || "none"} anchors=${missingAnchors.join(",") || "all"} s6a=${s6aBad.join(",") || "all"} regression=${regressionBad.join(",") || "all"}`,
    });
  }

  /* -------- S6b boundary: capability only in the whitelisted S6b files -------- */
  const scopeTrees = [
    "agent/src", "server/collector/src", "server/launcher/src", "frontend/sdk/src",
    "frontend/build-plugin", "workbench/src", `${S5_DEMO_FRONTEND_REL}/src`, `${S6A_DEMO_BACKEND_REL}/src`,
  ];
  const scopeFiles = scopeTrees.flatMap((rel) => dirTextFiles(rel))
    .map((file) => ({ rel: file.rel, text: stripComments(file.text) }));
  const s6bHits = [];
  for (const file of scopeFiles) {
    // Async frameworks / continuations stay banned EVERYWHERE (S6b only supports creation-time
    // inheritance of newly created threads; no whitelist for this marker).
    if (/CompletableFuture|@Async\b|AsyncContext|async_hooks|continuationSpan|三倍重放|replayTimes\s*=\s*3/.test(file.text)) {
      s6bHits.push(`${file.rel} [async-continuation]`);
    }
    if (s6bMarkerAllowed(file.rel)) continue;
    if (/\bNO_DEBUG_INFO\b|nodebug_lvt_present/.test(file.text)) s6bHits.push(`${file.rel} [no-debug-event]`);
    if (/ASYNC_INHERITED|InheritableThreadLocal|originThreadId/.test(file.text)) s6bHits.push(`${file.rel} [async-inherit]`);
    if (/VALUES_CAPPED|VALUES_TOTAL/.test(file.text)) s6bHits.push(`${file.rel} [loop-fold]`);
  }
  const claimTexts = S6_OVERCLAIM_TEXTS;
  for (const tree of [WORKBENCH_DIST_REL, `${S5_DEMO_FRONTEND_REL}/src`, DEMO_DIST_REL]) {
    const files = tree === WORKBENCH_DIST_REL || tree === DEMO_DIST_REL
      ? distTextFiles(tree)
      : walk(abs(tree)).map((file) => ({ rel: relOf(file), text: stripComments(readFileSync(file, "utf8")) }));
    for (const file of files) {
      for (const text of claimTexts) {
        if (file.text.includes(text)) s6bHits.push(`${file.rel} [claim:${text}]`);
      }
    }
  }
  checks.push({
    ok: s6bHits.length === 0,
    label: "S6b capability only in the whitelisted files: no async continuation anywhere, no NO_DEBUG_INFO/ASYNC_INHERITED/VALUES_CAPPED marker outside the S6b agent/workbench/demo files, no S6b overclaim",
    detail: s6bHits.slice(0, 6).join(" || ") || `${scopeFiles.length} product files clean`,
  });

  /* -------- no secrets/CDN/mirrors; fixture hygiene -------- */
  const secretPatterns = [
    /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\n]{3,}["']/gi,
    /(?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/gi,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bghp_[A-Za-z0-9]{20,}/g,
  ];
  const placeholderAllow = /placeholder|changeme|change_me|example|sample|dummy|redacted|xxx|<[^>]+>|\$\{|your_|demo|test|s3cr3t/i;
  const secretHits = [];
  for (const file of scopeFiles) {
    if (/package-lock\.json/.test(file.rel)) continue;
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      for (const match of file.text.matchAll(pattern)) {
        if (!placeholderAllow.test(match[0])) secretHits.push(`${file.rel} ${match[0].slice(0, 48)}`);
      }
    }
  }
  const cdnHosts = ["unpkg.com", "jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com", "npmmirror.com", "mirrors.aliyun.com", "registry.npm.taobao.org"];
  const cdnHits = [];
  for (const file of [...scopeFiles, ...distTextFiles(WORKBENCH_DIST_REL), ...distTextFiles(DEMO_DIST_REL).filter((entry) => !entry.rel.endsWith(".map"))]) {
    const lower = file.text.toLowerCase();
    for (const host of cdnHosts) if (lower.includes(host)) cdnHits.push(`${file.rel} -> ${host}`);
  }
  const mirrorUrls = [];
  for (const rel of ["frontend/sdk/package-lock.json", "workbench/package-lock.json", `${S5_DEMO_FRONTEND_REL}/package-lock.json`]) {
    if (!existsSync(abs(rel))) continue;
    for (const match of readFileSync(abs(rel), "utf8").matchAll(/"resolved":\s*"([^"]+)"/g)) {
      if (/^https?:/i.test(match[1]) && !match[1].startsWith("https://registry.npmjs.org/")) mirrorUrls.push(`${rel} -> ${match[1]}`);
    }
  }
  const fixtureText = readFileSync(abs(S6A_EVENTS_REL), "utf8");
  checks.push({
    ok: secretHits.length === 0 && cdnHits.length === 0 && mirrorUrls.length === 0 &&
      !fixtureText.includes(S5_DEMO_SECRET) && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(fixtureText) && !/\b1[3-9]\d{9}\b/.test(fixtureText),
    label: "no real secrets/PII/CDN/mirrors: S6a fixture has no s3cr3t/email/phone, product sources avoid secret patterns, lockfiles resolve only from registry.npmjs.org",
    detail: `secrets=${secretHits.slice(0, 2).join(",") || "none"} cdn=${cdnHits.slice(0, 2).join(",") || "none"} mirrors=${mirrorUrls.slice(0, 2).join(",") || "none"}`,
  });

  /* -------- cleanup: ports/processes/git/product stability -------- */
  const portProblems = [];
  for (const port of S1_PORTS) {
    const state = listeningOn(port);
    if (!state.supported || state.lines.length > 0) portProblems.push(`${port}:${state.lines.join("|") || state.error}`);
  }
  checks.push({
    ok: portProblems.length === 0,
    label: `ports ${S1_PORTS.join("/")} not LISTENING after all S6a gates (demo/collector/Vite/preview/stub stopped)`,
    detail: portProblems.join(" ; ") || "all free",
  });
  const nowJava = javaPids();
  const javaLeft = nowJava.filter((pid) => !BASELINE.javaPids.includes(pid));
  const nowNode = nodePids();
  const nodeLeft = nowNode.filter((pid) => !BASELINE.nodePids.includes(pid) && pid !== process.pid);
  const descendants = descendantSpawnedProcesses(process.pid);
  const descendantHits = descendants.items.map((item) => `${item.name}:${item.pid}`);
  checks.push({
    ok: descendants.supported ? descendantHits.length === 0 : javaLeft.length === 0 && nodeLeft.length === 0,
    label: "no java/node process spawned by this run is still alive (no orphan demo/collector/build)",
    detail: descendants.supported
      ? `descendants=${descendantHits.join(",") || "none"} (pid diff java=${javaLeft.join(",") || "none"} node=${nodeLeft.join(",") || "none"})`
      : `powershell unavailable (${descendants.error}); java=${javaLeft.join(",") || "none"} node=${nodeLeft.join(",") || "none"}`,
  });
  const status = gitStatusLines();
  const staged = status.lines.filter((line) => (line[0] ?? " ") !== " " && (line[0] ?? " ") !== "?");
  const statusNow = status.lines.slice().sort().join("\n");
  const headNow = gitHeadHash();
  checks.push({
    ok: status.ok && staged.length === 0 && statusNow === BASELINE.gitStatus && headNow === BASELINE.gitHead,
    label: "git index untouched (no staged entries), HEAD/status identical to the run baseline (tester ran no git write)",
    detail: `staged=${staged.length} statusUnchanged=${statusNow === BASELINE.gitStatus} head=${headNow === BASELINE.gitHead ? "unchanged" : `${BASELINE.gitHead} -> ${headNow}`}`,
  });
  const snapshotNow = sourceSnapshot();
  const touched = [];
  for (const [rel, hash] of Object.entries(SNAPSHOT)) {
    if (snapshotNow[rel] !== hash) touched.push(rel);
  }
  const added = Object.keys(snapshotNow).filter((rel) => !(rel in SNAPSHOT));
  checks.push({
    ok: touched.length === 0 && added.length === 0,
    label: "no product file modified or added by this verify run (only build outputs/temp logs changed)",
    detail: touched.length || added.length ? `modified=${touched.slice(0, 5).join(",")} added=${added.slice(0, 5).join(",")}` : `${Object.keys(SNAPSHOT).length} product files stable`,
  });

  const allowedExact = new Set(["pom.xml", "README.md", ".gitattributes", ...S5_DEMO_BACKEND_ALLOWED]);
  const allowedPrefixes = [
    "agent/", "server/collector/", "server/launcher/", "frontend/sdk/", "frontend/build-plugin/",
    "demo/buggy-shop-boot-vue/frontend/", "workbench/", "docs/contracts/", "docs/guides/",
    "docs/plans/stages/S5/", "docs/plans/stages/S6/", "fixtures/s5-l1-values/", "fixtures/s6-l2-lines/",
    "fixtures/s6b-async/", "fixtures/s6b-no-debug/", "fixtures/s6b-loop/",
    "tools/verify/", "tools/perf/",
  ];
  const forbiddenPrefixes = ["schema/", "fixtures/case-a-zero-rows/", "fixtures/s1-walking-skeleton/", "fixtures/s2-zero-row-chain/", "fixtures/s3-frontend-facts/", "fixtures/s4-details/", "docs/plans/stages/S0/"];
  const forbiddenExact = ["docs/contracts/transport.v1.md", "docs/contracts/status-semantics.md", "docs/plans/00-master-plan.md", "docs/plans/SOLO-PLAN.md"];
  const backendAllowed = new Set(S5_DEMO_BACKEND_ALLOWED);
  const unexpected = [];
  const forbidden = [];
  for (const line of status.lines) {
    const rel = line.slice(3).trim().replace(/^"|"$/g, "").split("\\").join("/");
    const allowed = allowedExact.has(rel) || allowedPrefixes.some((entry) => rel.startsWith(entry));
    if (!allowed) unexpected.push(line);
    if ((forbiddenPrefixes.some((entry) => rel.startsWith(entry)) && !backendAllowed.has(rel)) || forbiddenExact.includes(rel)) forbidden.push(line);
  }
  checks.push({
    ok: status.ok && unexpected.length === 0 && forbidden.length === 0,
    label: "S6b change set within the whitelist (agent/collector/launcher/sdk+build-plugin/demo frontend+demo backend incl. NoDebugService+pom/workbench/S6 docs+fixtures incl. s6b/tools/verify+perf); schema/S0–S4 fixtures/transport/status untouched",
    detail: unexpected.length || forbidden.length
      ? `unexpected=${unexpected.slice(0, 4).join(" | ")} forbidden=${forbidden.slice(0, 4).join(" | ")}`
      : `${status.lines.length} entries within scope`,
  });
  const tagList = runExe("git", ["tag", "--list"], { timeout: 60000 });
  checks.push({
    ok: tagList.code === 0 && !/(^|\n)\s*s6(-?b)?\s*(\n|$)/i.test(tagList.stdout ?? ""),
    label: "no s6/s6b tag exists yet (S6 stays partial until the acceptance checkpoint; tester runs no git write)",
    detail: (tagList.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).slice(0, 5).join(",") || "no tags",
  });

  return gate(
    "S6A-E",
    "regression/scope/cleanup: S0–S5 anchors PASS (full run), S6A_G1_FREEZE 8/8 + S5 freeze 18/18 + S6B_G1_FREEZE 14 (api/event-model superseded by S6b), S0–S6a fixture/schema/transport/status bytes, S6b only in whitelisted files, case A/B/L1/replay unchanged, no secrets/CDN/mirrors, ports/processes/git clean",
    checks,
    repro,
  );
}

/** Run the S6a gates requested by --s6a (or every implemented gate in a normal full run). */
async function checkS6() {
  const selected = S6_SELECTED ?? new Set(S6A_IMPLEMENTED);
  const unimplemented = [...selected].filter((letter) => !S6A_IMPLEMENTED.includes(letter));
  for (const letter of unimplemented) {
    record(
      `S6A-${letter}`,
      `S6A-${letter} is not implemented (implemented: ${S6A_IMPLEMENTED.join(",")})`,
      false,
      [`requested --s6a=${[...selected].join(",")}; implemented=${S6A_IMPLEMENTED.join(",")}`],
      REPRO_S6,
    );
  }
  if (["A", "B", "C", "D"].some((letter) => selected.has(letter))) {
    s6aEnsureJavaBuilds();
  }
  if (selected.has("A")) await checkS6A();
  if (selected.has("B")) await checkS6B();
  if (selected.has("C")) await checkS6C(s5CompileValidator());
  if (selected.has("D")) await checkS6D();
  if (selected.has("E")) checkS6E();
}

/* ------------------------------------------------------------------ */
/* source snapshot (product files only)                                */
/* ------------------------------------------------------------------ */

let SNAPSHOT = {};
let BASELINE = { javaPids: [], nodePids: [], gitStatus: "", gitHead: "" };

function sourceSnapshot() {
  const files = [];
  const add = (rel) => {
    const fileAbs = abs(rel);
    if (existsSync(fileAbs) && statSync(fileAbs).isFile()) files.push(fileAbs);
  };
  const addTree = (rel) => {
    walk(abs(rel), { skip: new Set(["node_modules", "target", "dist", ".git", "coverage"]) }).forEach((f) => files.push(f));
  };
  ["pom.xml", ".gitignore", ".gitattributes", "agent/pom.xml", "server/collector/pom.xml", "server/launcher/pom.xml", "demo/buggy-shop-boot-vue/backend/pom.xml",
    "workbench/package.json", "workbench/package-lock.json", "workbench/index.html", "workbench/vite.config.ts", "workbench/tsconfig.json", "workbench/env.d.ts", "workbench/.gitignore", "workbench/README.md",
    "demo/buggy-shop-boot-vue/frontend/package.json", "demo/buggy-shop-boot-vue/frontend/package-lock.json", "demo/buggy-shop-boot-vue/frontend/index.html",
    "demo/buggy-shop-boot-vue/frontend/vite.config.ts", "demo/buggy-shop-boot-vue/frontend/tsconfig.json", "demo/buggy-shop-boot-vue/frontend/env.d.ts",
    "frontend/sdk/package.json", "frontend/sdk/package-lock.json", "frontend/sdk/tsconfig.json", "frontend/sdk/README.md",
  ].forEach(add);
  ["schema", "fixtures", "docs/contracts", "docs/guides", "agent/src", "server/collector/src", "server/launcher/src", "demo/buggy-shop-boot-vue/backend/src",
    "demo/buggy-shop-boot-vue/frontend/src", "workbench/src", "workbench/scripts", "frontend/sdk/src", "frontend/sdk/test", "frontend/build-plugin",
  ].forEach(addTree);
  // S0–S5 stage docs are owned by other agents; test-report.md files are tester outputs.
  for (const stage of ["S0", "S1", "S2", "S3", "S4", "S5"]) {
    for (const file of walk(abs(`docs/plans/stages/${stage}`))) {
      if (path.basename(file) === "test-report.md") continue;
      files.push(file);
    }
  }
  const map = {};
  for (const file of [...new Set(files)]) {
    if (!existsSync(file)) continue;
    map[relOf(file)] = sha256File(file);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const startedAt = new Date();
  console.log("==============================================");
  if (S6_ONLY) {
    console.log(`TraceBoard S6a verifier (S6a-only: ${[...S6_SELECTED].join(",") || "none"}; S6 stays partial)`);
  } else if (S5_ONLY) {
    console.log(`TraceBoard S5 verifier (S5-only: ${[...S5_SELECTED].join(",") || "none"})`);
  } else if (S4_ONLY) {
    console.log(`TraceBoard S4 verifier (S4-only: ${[...S4_SELECTED].join(",") || "none"})`);
  } else {
    console.log("TraceBoard S0 + S1 + S2 (re-migrated) + S3 + S4 + S5 + S6a (partial) verifier");
  }
  console.log(`repo: ${REPO}`);
  console.log(`started: ${startedAt.toISOString()}`);
  console.log("==============================================");

  SNAPSHOT = sourceSnapshot();
  const statusBefore = gitStatusLines();
  BASELINE = {
    javaPids: javaPids(),
    nodePids: nodePids(),
    gitStatus: statusBefore.lines.slice().sort().join("\n"),
    gitHead: gitHeadHash(),
  };

  const env = captureEnv();
  section("V0 environment");
  record(
    "V0",
    "environment recorded",
    Boolean(env.node && env.java21 && existsSync(JDK21_JAVA)),
    [
      `node=${env.node} npm=${env.npm}`,
      `java21=${env.java21}`,
      `java8=${env.java8}`,
      `mvn(default JAVA_HOME)=${env.mvnDefault}`,
      `mvn(JDK21)=${env.mvnJdk21}`,
      `platform=${env.platform}`,
      `baseline java pids=${BASELINE.javaPids.join(",") || "none"}; git status entries=${statusBefore.lines.length}`,
    ],
    null,
  );

  if (S6_ONLY) {
    console.log("");
    console.log(`mode: S6a-only (--s6a=${[...S6_SELECTED].join(",") || "none"}); S0–S5 gates are skipped by design.`);
    await checkS6();
  } else if (S5_ONLY) {
    console.log("");
    console.log(`mode: S5-only (--s5=${[...S5_SELECTED].join(",") || "none"}); S0–S4 gates are skipped by design.`);
    await checkS5();
  } else if (S4_ONLY) {
    console.log("");
    console.log(`mode: S4-only (--s4=${[...S4_SELECTED].join(",") || "none"}); S0–S3 gates are skipped by design.`);
    await checkS4();
  } else {
    const v1 = checkV1();
    checkV1b(v1.parsed);
    checkV1c(v1.parsed, v1.validate);
    checkV4b(v1.parsed);

    checkS2Fixture(v1.validate);

    const builds = checkV2();
    checkS3Builds(v1.validate);
    checkV3();

    checkS1A(v1.validate);
    checkS1B(builds, v1.validate);
    checkS2Artifacts();

    await checkS1CDF(v1.validate);
    await checkS2E2E(v1.validate);
    checkS3Fixtures(v1.validate);
    await checkS3E2E(v1.validate);

    checkV6();
    checkS2Workbench();
    checkS3Workbench();
    checkV8();

    checkS2Drift();
    checkS2Scope();
    checkS3CaseB();
    checkS3Scope();
    checkS3Regression();
    checkS3Cleanup();

    // S4-BUILD + S4-A..I run here; S4-H reads the S0–S3 RESULTS, S4-I asserts the final cleanup.
    await checkS4();

    // S5-BUILD + S5-A..H (tester part 2) run after S4 so S5-G/H can read the earlier RESULTS.
    await checkS5();

    // S6a (L2 line-level locals + per-invocation ×3) runs last; S6A-E reads the whole run.
    // S6 remains PARTIAL: no s6/s6a tag and no S6b here.
    await checkS6();
  }

  section("SUMMARY");
  const failed = RESULTS.filter((r) => !r.ok);
  const passed = RESULTS.length - failed.length;
  console.log(`checks: ${passed} PASS / ${failed.length} FAIL (total ${RESULTS.length})`);
  if (failed.length) {
    console.log("failed checks:");
    for (const item of failed) console.log(`  - ${item.id}: ${item.title}`);
  }
  const verdict = failed.length === 0 ? "PASS" : "FAIL";
  console.log(`${S6_ONLY ? "S6a TEST (partial)" : S5_ONLY ? "S5 TEST" : S4_ONLY ? "S4 TEST" : "S6a TEST (full S0–S6a; S6 partial)"}: ${verdict}`);

  if (process.argv.includes("--json")) {
    console.log(
      `VERIFY_JSON:${JSON.stringify({
        repo: REPO,
        mode: S6_ONLY ? "s6a-only" : S5_ONLY ? "s5-only" : S4_ONLY ? "s4-only" : "full",
        s4Selected: S4_ONLY ? [...S4_SELECTED] : S4_IMPLEMENTED.slice(),
        s5Selected: S5_ONLY ? [...S5_SELECTED] : S5_IMPLEMENTED.slice(),
        s6Selected: S6_ONLY ? [...S6_SELECTED] : S6A_IMPLEMENTED.slice(),
        stage: "S6a",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        env,
        verdict,
        results: RESULTS,
      })}`,
    );
  }

  return failed.length === 0 ? 0 : 1;
}

process.on("exit", () => {
  for (const server of activeServers) {
    if (server?.child?.pid) {
      spawnSync("taskkill", ["/PID", String(server.child.pid), "/T", "/F"], { windowsHide: true });
    }
  }
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("VERIFIER CRASHED:", error);
    process.exit(2);
  });