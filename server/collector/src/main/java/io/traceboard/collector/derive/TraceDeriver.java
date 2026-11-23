package io.traceboard.collector.derive;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

import io.traceboard.collector.store.StoredEvent;

/**
 * Read-time derivation of the two S2 read-only views (api.v1.md §8.1/§8.2,
 * transport.v1.md §6.3).
 *
 * <p>Input is an immutable {@code SessionLog} snapshot; each call re-parses the stored
 * JSON lines and computes the answer. Nothing is cached, persisted, rewritten or appended:
 * {@code seq}, store content and event order stay untouched, so two identical GETs return
 * identical bodies. Instances are stateless apart from the thread-safe {@link ObjectMapper},
 * so concurrent requests are independent.</p>
 *
 * <p>Stored events already passed the frozen schema at ingest; a line that nevertheless
 * cannot be parsed is skipped (counted in the log, never echoed) instead of failing the query.
 * The arrival order ({@code seq}) is deliberately ignored: everything is ordered by
 * {@code startNs} and parent/child relations.</p>
 */
@Component
public class TraceDeriver {

    /** {@code traceId} query contract (api.v1.md §8.2): lowercase hex, 32 chars. */
    public static final String TRACE_ID_PATTERN = "^[0-9a-f]{32}$";

    private static final Logger log = LoggerFactory.getLogger(TraceDeriver.class);
    private static final JsonNode EMPTY_ARRAY = JsonNodeFactory.instance.arrayNode();

    /**
     * Aggregate severity, least severe first: the trace status is the most severe span status
     * ({@code THREW > UNKNOWN > NOT_COLLECTED_POLICY > NOT_COLLECTED_LOST >
     * NOT_COLLECTED_NO_DEBUG_INFO > TRUNCATED > RETURNED_FALSE > OK}).
     */
    private static final List<String> SEVERITY = List.of(
            "OK",
            "RETURNED_FALSE",
            "TRUNCATED",
            "NOT_COLLECTED_NO_DEBUG_INFO",
            "NOT_COLLECTED_LOST",
            "NOT_COLLECTED_POLICY",
            "UNKNOWN",
            "THREW");

    /** S3 frontend kinds (api.v1.md §9.2): any makes {@code hasFrontend} true. */
    private static final Set<String> FRONTEND_KINDS =
            Set.of("ui_event", "js_method", "fetch", "callback", "render");

    /** S3 backend kinds (api.v1.md §9.2): any makes {@code hasBackend} true. */
    private static final Set<String> BACKEND_KINDS =
            Set.of("controller", "service", "mapper", "sql", "jdbc", "async");

    /** Click-root marker emitted by the runtime SDK (event-model.v1.md §12). */
    private static final String SDK_ACTIVE_FLAG = "SDK_ACTIVE";

    private final ObjectMapper objectMapper;

    public TraceDeriver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Group stored events by {@code traceId} (api.v1.md §8.1 + §9.2).
     *
     * <p>Sorted by {@code startedAtNs} ascending, ties by {@code traceId}. Empty sessions and
     * rootless traces are represented honestly (empty list / {@code null} root fields +
     * {@code confidence="LOST"}), never dropped. {@code sdkActive} and the per-request S3
     * counts are derived from the same read-time snapshot; confidence follows the S3 rules
     * below and never downgrades a linked EXACT chain because of unrelated fetch events.</p>
     */
    public RequestsResponse requests(String sessionId, List<StoredEvent> events) {
        Map<String, List<SpanFacts>> byTrace = new LinkedHashMap<>();
        boolean sdkActive = false;
        for (StoredEvent event : events) {
            SpanFacts span = parse(event);
            if (span != null) {
                byTrace.computeIfAbsent(span.traceId(), key -> new ArrayList<>()).add(span);
                sdkActive = sdkActive
                        || ("ui_event".equals(span.kind()) && hasFlag(span.flags(), SDK_ACTIVE_FLAG));
            }
        }

        List<RequestSummary> summaries = new ArrayList<>(byTrace.size());
        for (Map.Entry<String, List<SpanFacts>> entry : byTrace.entrySet()) {
            List<SpanFacts> spans = entry.getValue();
            SpanFacts root = rootOf(spans);
            long startedAtNs = Long.MAX_VALUE;
            long endedAtNs = Long.MIN_VALUE;
            String status = "OK";
            boolean hasError = false;
            int fetchCount = 0;
            int backendSpanCount = 0;
            boolean hasFrontend = false;
            boolean hasBackend = false;
            Set<String> fetchSpanIds = new HashSet<>();
            for (SpanFacts span : spans) {
                startedAtNs = Math.min(startedAtNs, span.startNs());
                endedAtNs = Math.max(endedAtNs, span.startNs() + span.durNs());
                status = moreSevere(status, span.status());
                hasError = hasError || "THREW".equals(span.status());
                if ("fetch".equals(span.kind())) {
                    fetchCount++;
                    fetchSpanIds.add(span.spanId());
                }
                if (FRONTEND_KINDS.contains(span.kind())) {
                    hasFrontend = true;
                }
                if (BACKEND_KINDS.contains(span.kind())) {
                    hasBackend = true;
                    backendSpanCount++;
                }
            }
            boolean controllerLinkedToFetch = false;
            for (SpanFacts span : spans) {
                if ("controller".equals(span.kind()) && span.parentSpanId() != null
                        && fetchSpanIds.contains(span.parentSpanId())) {
                    controllerLinkedToFetch = true;
                    break;
                }
            }
            summaries.add(new RequestSummary(
                    entry.getKey(),
                    root == null ? null : root.spanId(),
                    root == null ? null : root.kind(),
                    root == null ? null : root.nodeKey(),
                    status,
                    derivedConfidence(root, fetchCount, hasBackend, controllerLinkedToFetch),
                    spans.size(),
                    startedAtNs,
                    Math.max(0L, endedAtNs - startedAtNs),
                    hasError,
                    fetchCount,
                    hasFrontend,
                    hasBackend,
                    backendSpanCount));
        }
        summaries.sort(Comparator.comparingLong(RequestSummary::startedAtNs)
                .thenComparing(RequestSummary::traceId));
        return new RequestsResponse(sessionId, sdkActive, summaries);
    }

    /**
     * Derive the node/edge view of one trace (api.v1.md §8.2).
     *
     * @return {@code null} when the session holds no event for {@code traceId} (caller answers 404)
     */
    public GraphResponse graph(String sessionId, String traceId, List<StoredEvent> events) {
        List<SpanFacts> spans = new ArrayList<>();
        for (StoredEvent event : events) {
            SpanFacts span = parse(event);
            if (span != null && traceId.equals(span.traceId())) {
                spans.add(span);
            }
        }
        if (spans.isEmpty()) {
            return null;
        }
        spans.sort(Comparator.comparingLong(SpanFacts::startNs).thenComparing(SpanFacts::spanId));

        SpanFacts root = rootOf(spans);
        List<GraphNode> nodes = new ArrayList<>(spans.size());
        Map<String, Integer> positionBySpanId = new HashMap<>();
        for (int i = 0; i < spans.size(); i++) {
            SpanFacts span = spans.get(i);
            positionBySpanId.put(span.spanId(), i);
            nodes.add(new GraphNode(span.spanId(), span.parentSpanId(), span.kind(), span.nodeKey(),
                    span.status(), span.returnValue(), span.sideEffects(), span.startNs(), span.durNs(),
                    span.thread(), span.flags(), span.reason(), span.source(), span.confidence(),
                    span.values()));
        }

        // One edge per parent/child pair (count is always 1: spanId is unique per session).
        // A parent that is not part of this trace keeps its node but yields no edge.
        List<GraphEdge> edges = new ArrayList<>(spans.size());
        for (int i = 0; i < spans.size(); i++) {
            Integer parentIndex = positionBySpanId.get(spans.get(i).parentSpanId());
            if (parentIndex != null) {
                edges.add(new GraphEdge(spans.get(parentIndex).spanId(), spans.get(i).spanId(), 1));
            }
        }
        edges.sort(Comparator.comparingInt((GraphEdge edge) -> positionBySpanId.get(edge.from()))
                .thenComparingInt(edge -> positionBySpanId.get(edge.to())));

        return new GraphResponse(sessionId, traceId,
                root == null ? null : root.rootEventId(),
                root == null || root.confidence() == null ? "LOST" : root.confidence(),
                nodes, edges);
    }

    /** Earliest root ({@code parentSpanId=null}); ties by {@code spanId}, no merging. */
    private static SpanFacts rootOf(List<SpanFacts> spans) {
        SpanFacts best = null;
        for (SpanFacts span : spans) {
            if (!span.isRoot()) {
                continue;
            }
            if (best == null || span.startNs() < best.startNs()
                    || (span.startNs() == best.startNs() && span.spanId().compareTo(best.spanId()) < 0)) {
                best = span;
            }
        }
        return best;
    }

    /**
     * S3 confidence derivation (api.v1.md §9.2), replacing the S2 "take the root span" rule.
     *
     * <ul>
     *   <li>rootless trace or backend-only root -> {@code LOST} (S2 behavior unchanged);</li>
     *   <li>root {@code ui_event} with {@code EXACT}: no fetch and no backend -> {@code EXACT}
     *       (case B: no request to correlate), no fetch but backend evidence -> {@code LOST}
     *       (N6), any {@code controller.parentSpanId} pointing at one of this trace's fetch
     *       spans -> {@code EXACT} (case A), otherwise -> {@code LOST};</li>
     *   <li>root {@code ui_event} with a non-EXACT confidence -> echo it ({@code null} ->
     *       {@code LOST}).</li>
     * </ul>
     *
     * <p>An unlinked extra fetch (e.g. the runtime list refresh {@code GET /api/orders}) never
     * downgrades a chain whose controller is linked to another fetch.</p>
     */
    private static String derivedConfidence(SpanFacts root, int fetchCount, boolean hasBackend,
                                            boolean controllerLinkedToFetch) {
        if (root == null) {
            return "LOST";
        }
        String rootConfidence = root.confidence() == null ? "LOST" : root.confidence();
        if (BACKEND_KINDS.contains(root.kind())) {
            return "LOST";
        }
        if (!"ui_event".equals(root.kind()) || !"EXACT".equals(rootConfidence)) {
            return rootConfidence;
        }
        if (fetchCount == 0) {
            return hasBackend ? "LOST" : "EXACT";
        }
        return controllerLinkedToFetch ? "EXACT" : "LOST";
    }

    private static boolean hasFlag(JsonNode flags, String flag) {
        if (flags == null || !flags.isArray()) {
            return false;
        }
        for (JsonNode entry : flags) {
            if (flag.equals(entry.asText())) {
                return true;
            }
        }
        return false;
    }

    private static String moreSevere(String current, String candidate) {
        return rank(candidate) > rank(current) ? candidate : current;
    }

    private static int rank(String status) {
        int index = status == null ? -1 : SEVERITY.indexOf(status);
        // A value outside the frozen enum cannot be produced by ingest; treat it as UNKNOWN.
        return index < 0 ? SEVERITY.indexOf("UNKNOWN") : index;
    }

    private SpanFacts parse(StoredEvent stored) {
        JsonNode event;
        try {
            event = objectMapper.readTree(stored.rawEventJson());
        } catch (JsonProcessingException | RuntimeException e) {
            log.warn("stored event seq={} is not parseable; excluded from derived views", stored.seq());
            return null;
        }
        if (event == null || !event.isObject()) {
            log.warn("stored event seq={} is not a JSON object; excluded from derived views", stored.seq());
            return null;
        }
        String traceId = text(event, "traceId");
        String spanId = text(event, "spanId");
        if (traceId == null || spanId == null) {
            log.warn("stored event seq={} lacks traceId/spanId; excluded from derived views", stored.seq());
            return null;
        }
        return new SpanFacts(traceId, spanId, text(event, "parentSpanId"),
                text(event, "rootEventId"), text(event, "kind"), text(event, "nodeKey"),
                text(event, "status") == null ? "UNKNOWN" : text(event, "status"),
                text(event, "confidence") == null ? "LOST" : text(event, "confidence"),
                event.path("startNs").asLong(0L), event.path("durNs").asLong(0L),
                event.get("return"),
                arrayOrEmpty(event.get("sideEffects")),
                event.get("thread"),
                arrayOrEmpty(event.get("flags")),
                text(event, "reason"),
                event.get("source"),
                // S5 (api.v1.md §10.9): the raw values[] array verbatim; events without the
                // field (all S0–S4 events) yield null — never an empty array, never re-derived.
                nullIfMissing(event.get("values")));
    }

    private static String text(JsonNode event, String field) {
        JsonNode value = event.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    /** S5: raw node {@code values} verbatim; missing/JSON-null stays {@code null} (never {@code []}). */
    private static JsonNode nullIfMissing(JsonNode value) {
        return value == null || value.isNull() ? null : value;
    }

    private static JsonNode arrayOrEmpty(JsonNode value) {
        return value != null && value.isArray() ? value : EMPTY_ARRAY;
    }
}
