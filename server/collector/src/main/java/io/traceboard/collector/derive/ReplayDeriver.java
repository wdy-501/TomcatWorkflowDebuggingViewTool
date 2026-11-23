package io.traceboard.collector.derive;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.traceboard.collector.store.StoredEvent;

/**
 * Read-time computation of the S3 replay window (api.v1.md §9.1, transport.v1.md §6.4).
 *
 * <p>Pure function of an immutable {@code SessionLog} snapshot plus the two query parameters:
 * no event is written, appended, rewritten or renumbered, {@code seq} is not consumed, nothing
 * is cached and the demo app is never called. Two identical GETs therefore return byte-identical
 * bodies for an unchanged store.</p>
 *
 * <p>Filtering uses {@code fromNs <= startNs <= toNs} (both inclusive, startNs only); ordering is
 * {@code startNs} ascending with ties broken by {@code spanId} lexicographically. The default
 * {@code toNs} is {@code max(startNs+durNs)} of the session (0 when empty). Stored lines already
 * passed the frozen schema at ingest; a line that nevertheless cannot be parsed is skipped
 * (counted in the log, never echoed) like the other derived views.</p>
 */
@Component
public class ReplayDeriver {

    private static final Logger log = LoggerFactory.getLogger(ReplayDeriver.class);

    private final ObjectMapper objectMapper;

    public ReplayDeriver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * @param fromNs      effective lower bound (caller already defaulted it to 0)
     * @param toNsOrNull  requested upper bound, or {@code null} to use the session default
     * @param events      stored events in {@code seq} order
     */
    public ReplayWindow window(long fromNs, Long toNsOrNull, List<StoredEvent> events) {
        List<WindowEntry> entries = new ArrayList<>(events.size());
        long maxEndNs = 0L;
        for (StoredEvent event : events) {
            WindowEntry entry = parse(event);
            if (entry == null) {
                continue;
            }
            entries.add(entry);
            maxEndNs = Math.max(maxEndNs, endOf(entry.startNs(), entry.durNs()));
        }

        long toNs = toNsOrNull == null ? maxEndNs : toNsOrNull;
        List<WindowEntry> window = new ArrayList<>(entries.size());
        for (WindowEntry entry : entries) {
            if (fromNs <= entry.startNs() && entry.startNs() <= toNs) {
                window.add(entry);
            }
        }
        window.sort(Comparator.comparingLong(WindowEntry::startNs)
                .thenComparing(WindowEntry::spanId));

        List<StoredEvent> ordered = new ArrayList<>(window.size());
        for (WindowEntry entry : window) {
            ordered.add(entry.event());
        }
        return new ReplayWindow(fromNs, toNs, ordered);
    }

    private WindowEntry parse(StoredEvent stored) {
        JsonNode event;
        try {
            event = objectMapper.readTree(stored.rawEventJson());
        } catch (Exception e) {
            log.warn("stored event seq={} is not parseable; excluded from the replay window", stored.seq());
            return null;
        }
        if (event == null || !event.isObject()) {
            log.warn("stored event seq={} is not a JSON object; excluded from the replay window", stored.seq());
            return null;
        }
        String spanId = text(event, "spanId");
        JsonNode startNode = event.get("startNs");
        JsonNode durNode = event.get("durNs");
        if (spanId == null || startNode == null || !startNode.isIntegralNumber()
                || !startNode.canConvertToLong()) {
            log.warn("stored event seq={} lacks a usable spanId/startNs; excluded from the replay window",
                    stored.seq());
            return null;
        }
        long startNs = startNode.longValue();
        long durNs = durNode != null && durNode.isIntegralNumber() && durNode.canConvertToLong()
                ? Math.max(0L, durNode.longValue())
                : 0L;
        return new WindowEntry(startNs, durNs, spanId, stored);
    }

    /** {@code startNs + durNs} without overflow, used only for the default {@code toNs}. */
    private static long endOf(long startNs, long durNs) {
        if (durNs <= 0L) {
            return startNs;
        }
        return startNs > Long.MAX_VALUE - durNs ? Long.MAX_VALUE : startNs + durNs;
    }

    private static String text(JsonNode event, String field) {
        JsonNode value = event.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private record WindowEntry(long startNs, long durNs, String spanId, StoredEvent event) {
    }
}
