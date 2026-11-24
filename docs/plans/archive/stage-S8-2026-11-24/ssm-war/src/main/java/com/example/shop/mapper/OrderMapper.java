package com.example.shop.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.example.shop.model.Order;

/**
 * Same FQCN/methods as the S2 Boot demo so TraceAgent's mapper advice can match.
 * The intentional S8 defect is the same: cancelById only matches PAID rows.
 */
public interface OrderMapper {

    List<Order> findAll();

    int countById(@Param("id") long id);

    int cancelById(@Param("id") long id, @Param("newStatus") String newStatus);
}