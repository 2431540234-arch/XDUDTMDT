-- Đổi hàng: ghi biến thể được giao đổi trên từng dòng của yêu cầu (NULL = đổi cùng biến thể với dòng gốc).
-- ON DELETE SET NULL: xóa biến thể không làm mất lịch sử yêu cầu đổi trả.
ALTER TABLE return_request_items ADD COLUMN exchange_variant_id INTEGER;
ALTER TABLE return_request_items
  ADD CONSTRAINT fk_return_request_items_exchange_variant_id
  FOREIGN KEY (exchange_variant_id) REFERENCES product_variants (id) ON DELETE SET NULL;
CREATE INDEX idx_return_request_items_exchange_variant ON return_request_items (exchange_variant_id);
COMMENT ON COLUMN return_request_items.exchange_variant_id IS 'Biến thể giao đổi (yêu cầu loại exchange); NULL = cùng biến thể với dòng đơn gốc';
