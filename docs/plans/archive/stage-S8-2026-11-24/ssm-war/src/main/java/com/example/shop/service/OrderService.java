package com.example.shop.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.shop.mapper.OrderMapper;
import com.example.shop.model.Order;

/**
 * Same FQCN/signature as the S2 demo so ServiceAdvice matches.
 * Case-A defect: the UPDATE row count is intentionally ignored, so a CREATED order still
 * returns success while the DB row remains CREATED.
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

    public boolean cancel(long id) {
        if (orderMapper.countById(id) == 0) {
            return false;
        }
        orderMapper.cancelById(id, STATUS_CANCELLED);
        return true;
    }
}