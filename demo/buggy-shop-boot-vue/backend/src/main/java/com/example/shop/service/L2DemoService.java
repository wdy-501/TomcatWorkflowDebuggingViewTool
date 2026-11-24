package com.example.shop.service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.springframework.stereotype.Service;

/**
 * S6a/S6b L2 demo (docs/contracts/api.v1.md Appendix F/G, event-model.v1.md 4.4.7/4.4.8/4.4.10).
 * Independent of {@link OrderService} so the dedicated ASM transformer and the Byte Buddy advices
 * instrument two different classes. No DB, no logging, id intentionally unused.
 *
 * <p>The transformer reads this class's local variable table and inserts probes on the init and
 * assignment lines of {@code reconcileAmount} and on the init/increment/if/anchor lines of
 * {@code reconcileLoop}; no other class/method is instrumented.</p>
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

    /**
     * S6b async demo (api.v1.md Appendix G): a per-request SINGLE-thread pool is created inside the
     * request thread AFTER the controller frame is open, so the worker (created on the first
     * submit) inherits the controller context. The single worker executes the three calls in order,
     * which keeps {@code invocation} at 1/2/3 inside the inherited frame copy. A fixed 3-thread pool
     * would give each worker {@code invocation=1} and is forbidden.
     *
     * <p>Pure computation, no DB. Returns {@code [100.0, 0.0, 100.0]}; the pool is always shut down.
     */
    public List<Double> reconcileAsync(long id) {
        ExecutorService pool = Executors.newFixedThreadPool(1);
        try {
            List<Future<Double>> futures = new ArrayList<Future<Double>>();
            for (int i = 1; i <= 3; i++) {
                final int invocation = i;
                futures.add(pool.submit(new Callable<Double>() {
                    public Double call() {
                        return Double.valueOf(reconcileAmount(id, 100.0d, invocation));
                    }
                }));
            }
            List<Double> results = new ArrayList<Double>();
            for (Future<Double> future : futures) {
                results.add(future.get());
            }
            return results;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        } catch (ExecutionException e) {
            throw new IllegalStateException(e.getCause());
        } finally {
            pool.shutdown();
        }
    }

    /**
     * S6b loop demo (api.v1.md Appendix G): {@code times} is clamped to 1..200; {@code local} starts
     * at 0, is incremented once per iteration and is reset to 0 at {@code i == 50}. The anchor
     * statement after the {@code if} only READS {@code local} (it never changes it), so the
     * line probes can observe the post-reset 0 and the following recovery. Pure computation, no DB:
     * 100 iterations return 50.0.
     */
    public double reconcileLoop(long id, int times) {
        int n = Math.max(1, Math.min(200, times));
        double local = 0.0d;
        for (int i = 1; i <= n; i++) {
            local = local + 1.0d;
            if (i == 50) {
                local = 0.0d;
            }
            double anchor = local;
        }
        return local;
    }
}