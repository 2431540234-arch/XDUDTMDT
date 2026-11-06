-- Đưa khóa chính của các bảng thêm ở add_backend_extras về đúng quy ước
-- (DATABASE_SCHEMA.md "Quy ước thiết kế"): INTEGER GENERATED ALWAYS AS IDENTITY thay cho SERIAL.
-- Giữ nguyên giá trị id đang có: bộ đếm identity bắt đầu từ max(id)+1. Không xóa/sửa dòng nào.
DO $$
DECLARE
  t text;
  next_id bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'product_specs', 'product_360_configs', 'product_360_frames', 'review_images', 'product_questions',
    'coupon_scopes', 'user_coupons', 'return_requests', 'return_request_items', 'return_request_images',
    'suppliers', 'stock_receipts', 'stock_receipt_items', 'expenses', 'banners', 'posts',
    'faq_topics', 'faq_items', 'contact_messages'
  ] LOOP
    EXECUTE format('SELECT coalesce(max(id), 0) + 1 FROM %I', t) INTO next_id;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id DROP DEFAULT', t);
    EXECUTE format('DROP SEQUENCE IF EXISTS %I', t || '_id_seq');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (START WITH %s)', t, next_id);
  END LOOP;
END
$$;
