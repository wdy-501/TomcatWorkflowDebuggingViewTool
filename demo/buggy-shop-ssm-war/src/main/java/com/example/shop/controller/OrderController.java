package com.example.shop.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.shop.model.Order;
import com.example.shop.service.OrderService;

/** S8 Tomcat/SSM order API; same controller FQCN/method signature as the S2 agent target. */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<Order> orders = orderService.list();
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", orders);
        return body;
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancel(@PathVariable long id) {
        boolean cancelled = orderService.cancel(id);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", Boolean.valueOf(cancelled));
        return ResponseEntity.status(cancelled ? HttpStatus.OK : HttpStatus.NOT_FOUND).body(body);
    }
}