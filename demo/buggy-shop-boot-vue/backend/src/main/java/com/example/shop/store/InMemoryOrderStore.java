package com.example.shop.store;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.example.shop.model.Order;

/**
 * In-memory order store, seeded with order 1. No database, no SQL.
 */
@Component
public class InMemoryOrderStore {

    static final String STATUS_CREATED = "CREATED";
    static final String STATUS_CANCELLED = "CANCELLED";

    private final Map<Long, Order> orders = new ConcurrentHashMap<Long, Order>();

    public InMemoryOrderStore() {
        orders.put(1L, new Order(1L, "SO-0001", STATUS_CREATED, 100.00d));
    }

    public List<Order> findAll() {
        List<Order> all = new ArrayList<Order>(orders.values());
        all.sort(Comparator.comparingLong(Order::getId));
        return all;
    }

    /**
     * Cancels an existing order. Idempotent: cancelling twice still reports success.
     *
     * @return true when the order exists, false for unknown ids
     */
    public boolean cancel(long id) {
        Order order = orders.get(id);
        if (order == null) {
            return false;
        }
        order.setStatus(STATUS_CANCELLED);
        return true;
    }
}