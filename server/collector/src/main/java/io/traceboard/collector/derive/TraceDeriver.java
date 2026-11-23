package io.traceboard.collector.derive;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    private final ObjectMapper objectMapper;

    public TraceDeriver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Group stored events by {@code traceId} (api.v1.md §8.1).
     *
     * <p>Sorted by {@code startedAtNs} ascending, ties by {@code traceId}. Empty sessions and
     * rootless traces are represented honestly (empty list / {@code null} root fields +
     * {@code confidence="LOST"}), never dropped.</p>
     */
    public RequestsResponse requests(String sessionId, List<StoredEvent> events) {
        Map<String, List<SpanFacts>> byTrace = new LinkedHashMap<>();
        for (StoredEvent event : events) {
            SpanFacts span = parse(event);
            if (span != null) {
                byTrace.computeIfAbsent(span.traceId(), key -> new ArrayList<>()).add(span);
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
            for (SpanFacts span : spans) {
                startedAtNs = Math.min(startedAtNs, span.startNs());
                endedAtNs = Math.max(endedAtNs, span.startNs() + span.durNs());
                status = moreSevere(status, span.status());
                hasError = hasError || "THREW".equals(span.status());
            }
            summaries.add(new RequestSummary(
                    entry.getKey(),
                    root == null ? null : root.spanId(),
                    root == null ? null : root.kind(),
                    root == null ? null : root.nodeKey(),
                    status,
                    root == null || root.confidence() == null ? "LOST" : root.confidence(),
                    spans.size(),
                    startedAtNs,
                    Math.max(0L, endedAtNs - startedAtNs),
                    hasError));
        }
        summaries.sort(Comparator.comparingLong(RequestSummary::startedAtNs)
                .thenComparing(RequestSummary::traceId));
        return new RequestsResponse(sessionId, summaries);
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
                    span.thread(), span.flags()));
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
                arrayOrEmpty(event.get("flags")));
    }

    private static String text(JsonNode event, String field) {
        JsonNode value = event.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static JsonNode arrayOrEmpty(JsonNode value) {
        return value != null && value.isArray() ? value : EMPTY_ARRAY;
    }
}
