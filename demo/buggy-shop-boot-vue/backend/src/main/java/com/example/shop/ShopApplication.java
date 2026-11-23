package com.example.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * S0 demo shop backend: plain Spring Boot 2.7 application, in-memory data only.
 *
 * <p>No database, no MyBatis, no TraceBoard dependency, no capture. The 0-row defect
 * is introduced in S2 and must not exist yet.</p>
 */
@SpringBootApplication
public class ShopApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}