package com.example.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * S2 demo shop backend: Boot 2.7 application over an embedded H2 database (MyBatis).
 *
 * <p>The case-A 0-row defect is intentionally present (api.v1.md Appendix B): the cancel UPDATE
 * matches only {@code status='PAID'} rows while the seeded order is {@code CREATED}. There is no
 * TraceBoard dependency and no capture inside the demo itself; spans come from the java agent.</p>
 */
@SpringBootApplication
public class ShopApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}