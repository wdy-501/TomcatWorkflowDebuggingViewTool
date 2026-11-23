package com.example.shop.model;

/**
 * Minimal order view model for the S0 demo.
 */
public class Order {

    private long id;
    private String orderNo;
    private String status;
    private double amount;

    public Order() {
    }

    public Order(long id, String orderNo, String status, double amount) {
        this.id = id;
        this.orderNo = orderNo;
        this.status = status;
        this.amount = amount;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }
}