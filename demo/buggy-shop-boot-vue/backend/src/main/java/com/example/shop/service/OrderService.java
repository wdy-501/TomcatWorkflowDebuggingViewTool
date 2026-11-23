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
}
