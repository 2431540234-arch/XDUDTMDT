-- M5: theo QUY_UOC_CODE_DB.md 5.1 / DATABASE_SCHEMA.md mục 7 #1: trừ stock_quantity ngay khi đặt hàng, bỏ reserved_quantity.
-- Trước đây stock_quantity = tồn vật lý (gồm phần đang giữ chỗ), reserved_quantity = phần giữ cho đơn chưa giao.
-- Quy đổi: stock_quantity mới = stock_quantity - reserved_quantity (= tồn có thể bán trước đó).
UPDATE product_variants SET stock_quantity = stock_quantity - reserved_quantity WHERE reserved_quantity > 0;

-- Đơn chưa giao (pending/confirmed/processing) chưa có movement "sale" (trước đây ghi lúc sang shipping): bù để sổ kho khớp.
INSERT INTO inventory_movements (variant_id, type, quantity_change, reason, reference_code)
SELECT oi.variant_id, 'sale', -oi.quantity, 'Chuyển sang trừ tồn khi đặt hàng', o.order_code
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.variant_id IS NOT NULL
  AND o.status IN ('pending', 'confirmed', 'processing');

ALTER TABLE product_variants DROP CONSTRAINT ck_product_variants_reserved;
ALTER TABLE product_variants DROP COLUMN reserved_quantity;
