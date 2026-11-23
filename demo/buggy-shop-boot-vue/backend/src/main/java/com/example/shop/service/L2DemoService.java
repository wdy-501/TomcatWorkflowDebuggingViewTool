package com.example.shop.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

/**
 * S6a L2 demo (docs/contracts/api.v1.md Appendix F, event-model.v1.md 4.4.7). Independent of
 * {@link OrderService} so the dedicated ASM transformer and the Byte Buddy advices instrument two
 * different classes. No DB, no logging, id intentionally unused.
 *
 * <p>The transformer reads this method's local variable table and inserts probes on the two
 * assignment lines only; no other class/method is instrumented.</p>
 */
@Service
public class L2DemoService {

    /**
     * invocation == 2 performs the "bad" {@code local = 0} write (the L2 100 -> 0 fact).
     */
    public double reconcileAmount(long id, double amount, int invocation) {
        double local = amount;
        if (invocation == 2) {
            local = 0.0d;
        }
        return local;
    }

    /** Not instrumented: emits no spans (S6a scope = reconcileAmount only). */
    public List<Double> reconcileBatch(long id) {
        List<Double> results = new ArrayList<Double>();
        for (int i = 1; i <= 3; i++) {
            results.add(Double.valueOf(reconcileAmount(id, 100.0d, i)));
        }
        return results;
    }
}