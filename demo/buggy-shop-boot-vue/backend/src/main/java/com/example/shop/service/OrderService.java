package com.example.shop.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.shop.model.Order;
import com.example.shop.store.InMemoryOrderStore;

/**
 * Thin service layer over the in-memory store. No capture, no logging of order data.
 */
@Service
public class OrderService {

    private final InMemoryOrderStore orderStore;

    public OrderService(InMemoryOrderStore orderStore) {
        this.orderStore = orderStore;
    }

    public List<Order> list() {
        return orderStore.findAll();
    }

    public boolean cancel(long id) {
        return orderStore.cancel(id);
    }
}