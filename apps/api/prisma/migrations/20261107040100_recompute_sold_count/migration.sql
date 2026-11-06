-- sold_count chỉ tính các đơn đã hoàn tất (completed) theo QUY_UOC_CODE_DB.md 5.2 / DATABASE_SCHEMA.md mục 7 #2.
-- Trước đây tăng ngay khi đặt hàng nên tính lại từ dữ liệu đơn hàng hiện có (chỉ đổi cột products.sold_count).
UPDATE products p
SET sold_count = COALESCE((
  SELECT SUM(oi.quantity)
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN product_variants v ON v.id = oi.variant_id
  WHERE v.product_id = p.id AND o.status = 'completed'
), 0);
