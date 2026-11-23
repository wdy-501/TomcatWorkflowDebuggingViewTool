package com.example.shop.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.shop.mapper.OrderMapper;
import com.example.shop.model.Order;

/**
 * Thin service layer over the H2-backed {@link OrderMapper}. No capture, no logging of order data.
 *
 * <p>Case-A defect (S2, intentional, api.v1.md Appendix B): {@link #cancel(long)} performs an
 * existence check and then <strong>ignores</strong> the affected-row count of
 * {@code cancelById}; a 0-row UPDATE still returns {@code true}.</p>
 */
@Service
public class OrderService {

    private static final String STATUS_CANCELLED = "CANCELLED";

    private final OrderMapper orderMapper;

    public OrderService(OrderMapper orderMapper) {
        this.orderMapper = orderMapper;
    }

    public List<Order> list() {
        return orderMapper.findAll();
    }

    /**
     * @return true when the order exists (even if the UPDATE affected 0 rows), false for unknown ids
     */
    public boolean cancel(long id) {
        if (orderMapper.countById(id) == 0) {
            return false;
        }
        // Defect: the affected-row count is deliberately ignored (case A).
        orderMapper.cancelById(id, STATUS_CANCELLED);
        return true;
    }

    /**
     * S5 L1 demo (api.v1.md Appendix D): mutates the amount on an <strong>in-memory</strong> order
     * only (100 -> 0) and returns 0. The database row is never updated, so {@code GET /api/orders}
     * keeps showing {@code 100.00}.
     *
     * <p>{@code requestedAmount}, {@code demoSecret} and {@code note} are intentionally unused by
     * the business logic: they are captured (and redacted/truncated) by the agent's L1 advice.
     * Nothing is logged and no value is persisted ({@code demoSecret} is a fake demo value).</p>
     *
     * @return always 0.0 (the demo L1 "return" fact)
     */
    public double previewDiscount(long id, double requestedAmount, String demoSecret, String note) {
        Order order = orderMapper.findById(id);
        if (order != null) {
            // In-memory only: never persisted (no UPDATE, DB amount stays 100.00).
            order.setAmount(0.0d);
        }
        return 0.0d;
    }
}
