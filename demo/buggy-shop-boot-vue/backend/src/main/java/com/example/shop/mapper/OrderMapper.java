package com.example.shop.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import com.example.shop.model.Order;

/**
 * MyBatis mapper for the demo {@code orders} table (H2, in-memory).
 *
 * <p>Case-A defect (S2, intentional): {@code cancelById} only matches rows that are still
 * {@code PAID}, so cancelling a {@code CREATED} order updates 0 rows. The service ignores the
 * affected-row count and still reports success.</p>
 */
@Mapper
public interface OrderMapper {

    List<Order> findAll();

    /**
     * S5 L1 demo (api.v1.md Appendix D): read-only lookup used by
     * {@code OrderService#previewDiscount}. This mapper method is intentionally NOT instrumented.
     *
     * @return the order, or {@code null} for an unknown id (callers must not write fields then)
     */
    Order findById(@Param("id") long id);

    int countById(@Param("id") long id);

    /**
     * @return affected rows; 0 is a normal fact, not an error
     */
    @Update("UPDATE orders SET status=#{newStatus} WHERE id=#{id} AND status='PAID'")
    int cancelById(@Param("id") long id, @Param("newStatus") String newStatus);
}
