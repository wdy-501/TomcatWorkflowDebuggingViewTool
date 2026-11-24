package com.example.shop.service;

import org.springframework.stereotype.Service;

/**
 * S6b no-debug demo (docs/contracts/api.v1.md Appendix G, event-model.v1.md 4.4.9).
 *
 * <p>This source file is compiled normally first and then recompiled by the demo build
 * (Maven antrun {@code javac debug="false"} in {@code process-classes}) so the class file in
 * {@code target/classes} has NO {@code LocalVariableTable} / {@code LineNumberTable} /
 * {@code SourceFile}. The agent therefore proves only "method called + real return value" and
 * emits {@code status=NOT_COLLECTED_NO_DEBUG_INFO} with {@code reason="LocalVariableTable missing"}:
 * no variable name, no line number, no {@code values}. No DB, no logging.</p>
 */
@Service
public class NoDebugService {

    /** Demo fixed value: {@code compute(100.0)} returns 200.0. */
    public double compute(double amount) {
        return amount * 2.0d;
    }
}