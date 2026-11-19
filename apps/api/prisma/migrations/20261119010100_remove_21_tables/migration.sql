-- Gỡ 21 bảng (59 → 38 bảng) cùng trigger, hàm, cột, kiểu liệt kê chỉ phục vụ các bảng này.
-- Bảng bỏ: product_specs, product_360_configs, product_360_frames, review_images, product_questions, coupon_scopes,
--   user_coupons, code_counters, return_requests, return_request_items, return_request_images, stock_receipts,
--   stock_receipt_items, expenses, banners, posts, contact_messages, pages, inventory_movements, space_bookmarks, space_views.
-- Không dùng CASCADE: nếu còn đối tượng khác phụ thuộc, migration báo lỗi thay vì xóa lan.

-- 1. Mã đơn hàng: code_counters → SEQUENCE order_code_seq (mã ALV-YYYYMMDD-NNNNNN, số tăng liên tục, không reset theo ngày).
--    Số kế tiếp = (số lớn nhất ở cuối các mã đơn hiện có) + 1 để không trùng mã cũ.
CREATE SEQUENCE IF NOT EXISTS order_code_seq;
DO $$
DECLARE
  v_max BIGINT;
BEGIN
  SELECT COALESCE(MAX(substring(order_code FROM '([0-9]+)$')::BIGINT), 0) INTO v_max FROM orders;
  PERFORM setval('order_code_seq', v_max + 1, false);
END;
$$;

-- 2. Trigger/hàm chỉ phục vụ space_views (tăng spaces.view_count); xóa hàm trước khi xóa bảng cần trigger đi cùng bảng
DROP TRIGGER IF EXISTS trg_space_views_increase_count ON space_views;
DROP FUNCTION IF EXISTS trg_space_views_increase_count();

-- 3. Cột chỉ phục vụ space_views (ràng buộc ck_spaces_view_count bị xóa cùng cột)
ALTER TABLE spaces DROP COLUMN IF EXISTS view_count;

-- 4. Bảng (con trước, cha sau)
DROP TABLE return_request_images;
DROP TABLE return_request_items;
DROP TABLE return_requests;
DROP TABLE expenses;
DROP TABLE stock_receipt_items;
DROP TABLE stock_receipts;
DROP TABLE review_images;
DROP TABLE product_questions;
DROP TABLE product_360_frames;
DROP TABLE product_360_configs;
DROP TABLE product_specs;
DROP TABLE coupon_scopes;
DROP TABLE user_coupons;
DROP TABLE code_counters;
DROP TABLE banners;
DROP TABLE posts;
DROP TABLE contact_messages;
DROP TABLE pages;
DROP TABLE inventory_movements;
DROP TABLE space_bookmarks;
DROP TABLE space_views;

-- 5. Kiểu liệt kê chỉ dùng bởi các bảng trên (content_status vẫn dùng cho products, spaces nên giữ)
DROP TYPE inventory_movement_type;
DROP TYPE question_status;
DROP TYPE return_type;
DROP TYPE return_reason;
DROP TYPE return_status;
DROP TYPE stock_receipt_type;
DROP TYPE stock_receipt_status;
DROP TYPE expense_category;
DROP TYPE banner_position;
