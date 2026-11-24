package com.example.shop.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.shop.model.Order;
import com.example.shop.service.L2DemoService;
import com.example.shop.service.NoDebugService;
import com.example.shop.service.OrderService;

/**
 * Demo order API, shape frozen by docs/contracts/api.v1.md Appendix A.
 *
 * <p>GET  /api/orders                 -> 200 {"data":[ ... ]}
 * POST /api/orders/{id}/cancel       -> 200 {"data":true} (exists) / 404 {"data":false} (unknown id)
 * POST /api/orders/{id}/reconcile-async (S6b) -> 200 {"data":[100.0,0.0,100.0]}
 * POST /api/orders/{id}/no-debug        (S6b) -> 200 {"data":200.0}
 * POST /api/orders/{id}/reconcile-loop  (S6b) -> 200 {"data":50.0} (times=100 default)</p>
 */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final L2DemoService l2DemoService;
    private final NoDebugService noDebugService;

    public OrderController(OrderService orderService, L2DemoService l2DemoService,
                           NoDebugService noDebugService) {
        this.orderService = orderService;
        this.l2DemoService = l2DemoService;
        this.noDebugService = noDebugService;
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
        HttpStatus status = cancelled ? HttpStatus.OK : HttpStatus.NOT_FOUND;
        return ResponseEntity.status(status).body(body);
    }

    /**
     * Request-body demo: accepts a JSON object and confirms it. The frontend SDK records the
     * request body fields on the fetch span; this endpoint never writes the database and does
     * not echo the sensitive {@code token} field.
     */
    @PostMapping("/{id}/remark")
    public ResponseEntity<Map<String, Object>> remark(@PathVariable long id,
                                                      @RequestBody Map<String, Object> request) {
        Map<String, Object> data = new LinkedHashMap<String, Object>();
        data.put("id", Long.valueOf(id));
        data.put("reason", request.get("reason"));
        data.put("operator", request.get("operator"));
        data.put("priority", request.get("priority"));
        data.put("accepted", Boolean.TRUE);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", data);
        return ResponseEntity.ok(body);
    }

    /**
     * S5 L1 demo (api.v1.md Appendix D): always {@code 200 {"data":0}} - for known ids the service
     * mutates the in-memory amount (100 -> 0, DB untouched), for unknown ids {@code findById=null}
     * writes nothing and still returns 0 (no 404 / {"data":-1} / null).
     *
     * <p>Query values ({@code demoSecret} is a fake demo value) are never logged or echoed; the
     * agent records them as redacted/truncated L1 {@code values}.</p>
     */
    @PostMapping("/{id}/preview-discount")
    public ResponseEntity<Map<String, Object>> previewDiscount(
            @PathVariable long id,
            @RequestParam(value = "requestedAmount", defaultValue = "100") double requestedAmount,
            @RequestParam(value = "demoSecret", defaultValue = "s3cr3t") String demoSecret,
            @RequestParam(value = "note", defaultValue = "") String note) {
        orderService.previewDiscount(id, requestedAmount, demoSecret, note);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", Integer.valueOf(0));
        return ResponseEntity.ok(body);
    }

    /**
     * S6a L2 demo (api.v1.md Appendix F): pure computation, any id returns
     * {@code 200 {"data":[100.0,0.0,100.0]}} - no DB read/write, no 404, no null. The third call
     * ({@code invocation == 2}) writes the "bad" local 0, which the agent collects as the L2
     * {@code 100 -> 0} fact.
     */
    @PostMapping("/{id}/reconcile")
    public ResponseEntity<Map<String, Object>> reconcile(@PathVariable long id) {
        List<Double> amounts = l2DemoService.reconcileBatch(id);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", amounts);
        return ResponseEntity.ok(body);
    }

    /**
     * S6b async demo (api.v1.md Appendix G): per-request single-thread pool inside the service;
     * any id returns {@code 200 {"data":[100.0,0.0,100.0]}} - no DB, no 404, no null.
     */
    @PostMapping("/{id}/reconcile-async")
    public ResponseEntity<Map<String, Object>> reconcileAsync(@PathVariable long id) {
        List<Double> amounts = l2DemoService.reconcileAsync(id);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", amounts);
        return ResponseEntity.ok(body);
    }

    /**
     * S6b no-debug demo (api.v1.md Appendix G): {@code NoDebugService#compute(100.0)} has no
     * {@code LocalVariableTable}; any id returns {@code 200 {"data":200.0}} - no DB, no 404.
     */
    @PostMapping("/{id}/no-debug")
    public ResponseEntity<Map<String, Object>> noDebug(@PathVariable long id) {
        double value = noDebugService.compute(100.0d);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", Double.valueOf(value));
        return ResponseEntity.ok(body);
    }

    /**
     * S6b loop demo (api.v1.md Appendix G): {@code times} defaults to 100 (clamped 1..200); any id
     * returns {@code 200 {"data":50.0}} for times=100 - no DB, no 404.
     */
    @PostMapping("/{id}/reconcile-loop")
    public ResponseEntity<Map<String, Object>> reconcileLoop(
            @PathVariable long id,
            @RequestParam(value = "times", defaultValue = "100") int times) {
        double value = l2DemoService.reconcileLoop(id, times);
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("data", Double.valueOf(value));
        return ResponseEntity.ok(body);
    }
}