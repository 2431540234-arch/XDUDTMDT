-- =====================================================================
-- 00_reset.sql : XÓA TOÀN BỘ CSDL (bảng, kiểu ENUM, hàm)
-- !!! CHỈ DÙNG KHI DEV. KHÔNG BAO GIỜ CHẠY TRÊN PRODUCTION !!!
-- Thứ tự: bảng (con trước, cha sau) -> hàm -> ENUM.
-- DROP TABLE ... CASCADE tự gỡ trigger và khóa ngoại gắn với bảng.
-- =====================================================================

-- Nhóm 7 – Không gian mẫu
DROP TABLE IF EXISTS space_views              CASCADE;
DROP TABLE IF EXISTS space_bookmarks          CASCADE;
DROP TABLE IF EXISTS space_product_placements CASCADE;
DROP TABLE IF EXISTS space_hotspots           CASCADE;
DROP TABLE IF EXISTS space_panoramas          CASCADE;
DROP TABLE IF EXISTS spaces                   CASCADE;

-- Nhóm 6 – Giỏ hàng và đơn hàng
DROP TABLE IF EXISTS shipments                CASCADE;
DROP TABLE IF EXISTS payments                 CASCADE;
DROP TABLE IF EXISTS order_status_history     CASCADE;
DROP TABLE IF EXISTS order_items              CASCADE;
DROP TABLE IF EXISTS coupon_usages            CASCADE;
DROP TABLE IF EXISTS orders                   CASCADE;
DROP TABLE IF EXISTS coupons                  CASCADE;
DROP TABLE IF EXISTS cart_items               CASCADE;
DROP TABLE IF EXISTS carts                    CASCADE;

-- Nhóm 5 – 3D và AR
DROP TABLE IF EXISTS ar_snapshots             CASCADE;
DROP TABLE IF EXISTS ar_sessions              CASCADE;
DROP TABLE IF EXISTS model_material_variants  CASCADE;
DROP TABLE IF EXISTS model_files              CASCADE;
DROP TABLE IF EXISTS product_3d_models        CASCADE;

-- Nhóm 4 – Sản phẩm
DROP TABLE IF EXISTS wishlists                CASCADE;
DROP TABLE IF EXISTS reviews                  CASCADE;
DROP TABLE IF EXISTS inventory_movements      CASCADE;
DROP TABLE IF EXISTS product_images           CASCADE;
DROP TABLE IF EXISTS variant_attribute_values CASCADE;
DROP TABLE IF EXISTS product_variants         CASCADE;
DROP TABLE IF EXISTS attribute_values         CASCADE;
DROP TABLE IF EXISTS attributes               CASCADE;
DROP TABLE IF EXISTS products                 CASCADE;
DROP TABLE IF EXISTS brands                   CASCADE;

-- Nhóm 3 – Nội dung
DROP TABLE IF EXISTS pages                    CASCADE;
DROP TABLE IF EXISTS categories               CASCADE;

-- Nhóm 2 – Hệ thống chung
DROP TABLE IF EXISTS activity_logs            CASCADE;
DROP TABLE IF EXISTS notifications            CASCADE;
DROP TABLE IF EXISTS media                    CASCADE;
DROP TABLE IF EXISTS settings                 CASCADE;

-- Nhóm 1 – Người dùng và phân quyền
DROP TABLE IF EXISTS addresses                CASCADE;
DROP TABLE IF EXISTS user_sessions            CASCADE;
DROP TABLE IF EXISTS password_resets          CASCADE;
DROP TABLE IF EXISTS user_roles               CASCADE;
DROP TABLE IF EXISTS role_permissions         CASCADE;
DROP TABLE IF EXISTS permissions              CASCADE;
DROP TABLE IF EXISTS roles                    CASCADE;
DROP TABLE IF EXISTS users                    CASCADE;

-- Hàm (CASCADE phòng trường hợp còn index/trigger tham chiếu)
DROP FUNCTION IF EXISTS set_updated_at()                    CASCADE;
DROP FUNCTION IF EXISTS refresh_product_rating(integer)      CASCADE;
DROP FUNCTION IF EXISTS trg_reviews_refresh_rating()        CASCADE;
DROP FUNCTION IF EXISTS refresh_product_3d_flags(integer)    CASCADE;
DROP FUNCTION IF EXISTS trg_models_refresh_flags()          CASCADE;
DROP FUNCTION IF EXISTS trg_model_files_refresh_flags()     CASCADE;
DROP FUNCTION IF EXISTS trg_space_views_increase_count()    CASCADE;
DROP FUNCTION IF EXISTS trg_orders_log_status()             CASCADE;
DROP FUNCTION IF EXISTS trg_users_assign_default_role()     CASCADE;
DROP FUNCTION IF EXISTS immutable_unaccent(text)            CASCADE;

-- ENUM
DROP TYPE IF EXISTS hotspot_type             CASCADE;
DROP TYPE IF EXISTS room_type                CASCADE;
DROP TYPE IF EXISTS shipment_status          CASCADE;
DROP TYPE IF EXISTS shipment_carrier         CASCADE;
DROP TYPE IF EXISTS payment_txn_status       CASCADE;
DROP TYPE IF EXISTS payment_method           CASCADE;
DROP TYPE IF EXISTS order_status             CASCADE;
DROP TYPE IF EXISTS order_payment_status     CASCADE;
DROP TYPE IF EXISTS coupon_type              CASCADE;
DROP TYPE IF EXISTS ar_mode                  CASCADE;
DROP TYPE IF EXISTS model_lod                CASCADE;
DROP TYPE IF EXISTS model_file_format        CASCADE;
DROP TYPE IF EXISTS model_status             CASCADE;
DROP TYPE IF EXISTS model_placement          CASCADE;
DROP TYPE IF EXISTS review_status            CASCADE;
DROP TYPE IF EXISTS inventory_movement_type  CASCADE;
DROP TYPE IF EXISTS content_status           CASCADE;
DROP TYPE IF EXISTS user_status              CASCADE;

-- Extension giữ nguyên (CREATE EXTENSION IF NOT EXISTS ở file 01 nên không cần xóa)
