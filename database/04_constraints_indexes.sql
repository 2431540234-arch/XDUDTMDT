-- =====================================================================
-- 04_constraints_indexes.sql : khóa ngoại vòng + toàn bộ index
-- PK/UNIQUE khai báo trong bảng đã tự có index; ở đây chỉ thêm:
--   (1) khóa ngoại không thể khai báo lúc tạo bảng
--   (2) partial unique index
--   (3) index cho mọi cột khóa ngoại còn thiếu
--   (4) index cho cột hay lọc / tìm kiếm
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) KHÓA NGOẠI VÒNG / TRỎ TỚI BẢNG TẠO SAU
-- ---------------------------------------------------------------------
-- users <-> media: users.avatar_media_id ↔ media.uploaded_by (vòng).
-- SET NULL: ảnh đại diện là tùy chọn, xóa media thì user chỉ mất avatar.
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_avatar_media_id;
ALTER TABLE users ADD CONSTRAINT fk_users_avatar_media_id
  FOREIGN KEY (avatar_media_id) REFERENCES media (id) ON DELETE SET NULL;

-- reviews.order_id: orders được tạo sau reviews (nhóm 6 sau nhóm 4).
-- SET NULL: xóa đơn không được làm mất đánh giá.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS fk_reviews_order_id;
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_order_id
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- (2) PARTIAL UNIQUE INDEX (ràng buộc "tối đa một")
-- Lưu ý: chỉ đảm bảo TỐI ĐA một; việc "phải có đúng một" do tầng Service
-- đảm bảo (không thể ép bằng index mà không chặn việc tạo bản ghi đầu tiên).
-- ---------------------------------------------------------------------
-- Email duy nhất trên tài khoản chưa xóa mềm (cho phép đăng ký lại email của tài khoản đã xóa)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active
  ON users (email) WHERE deleted_at IS NULL;

-- Mỗi user chỉ MỘT địa chỉ mặc định
CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_user_default
  ON addresses (user_id) WHERE is_default;

-- Mỗi sản phẩm chỉ MỘT ảnh đại diện
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_primary
  ON product_images (product_id) WHERE is_primary;

-- Mỗi sản phẩm chỉ MỘT mô hình 3D chính
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_3d_models_primary
  ON product_3d_models (product_id) WHERE is_primary;

-- Mỗi không gian chỉ MỘT ảnh 360° mở đầu
CREATE UNIQUE INDEX IF NOT EXISTS uq_space_panoramas_start
  ON space_panoramas (space_id) WHERE is_start;

-- ---------------------------------------------------------------------
-- (3) INDEX CHO KHÓA NGOẠI
-- Bỏ qua cột đã đứng đầu của một PK/UNIQUE (đã có index sẵn), ví dụ:
-- user_roles.user_id, role_permissions.role_id, cart_items.cart_id,
-- variant_attribute_values.variant_id, model_files.model_id, ...
-- Index trên khóa ngoại giúp JOIN nhanh và tránh quét bảng khi xóa bản ghi cha.
-- ---------------------------------------------------------------------
-- Nhóm 1
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id          ON user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions (permission_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id     ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id       ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id           ON addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_users_avatar_media_id       ON users (avatar_media_id);
-- Nhóm 2
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by           ON media (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id      ON activity_logs (actor_id);
-- Nhóm 3
CREATE INDEX IF NOT EXISTS idx_categories_parent_id        ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_image_media_id   ON categories (image_media_id);
-- Nhóm 4
CREATE INDEX IF NOT EXISTS idx_brands_logo_media_id        ON brands (logo_media_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id           ON products (brand_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_variant_attribute_values_attribute_value
  ON variant_attribute_values (attribute_value_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id   ON product_images (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_images_variant_id   ON product_images (variant_id);
CREATE INDEX IF NOT EXISTS idx_product_images_media_id     ON product_images (media_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_id ON inventory_movements (variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_performed_by ON inventory_movements (performed_by);
CREATE INDEX IF NOT EXISTS idx_reviews_product_status      ON reviews (product_id, status);  -- ds review đã duyệt của sản phẩm
CREATE INDEX IF NOT EXISTS idx_reviews_order_id            ON reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id        ON wishlists (product_id);
-- Nhóm 5
CREATE INDEX IF NOT EXISTS idx_product_3d_models_product_id ON product_3d_models (product_id);
CREATE INDEX IF NOT EXISTS idx_product_3d_models_variant_id ON product_3d_models (variant_id);
CREATE INDEX IF NOT EXISTS idx_product_3d_models_poster_media_id ON product_3d_models (poster_media_id);
CREATE INDEX IF NOT EXISTS idx_model_files_media_id        ON model_files (media_id);
CREATE INDEX IF NOT EXISTS idx_model_material_variants_variant_id ON model_material_variants (variant_id);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_user_id         ON ar_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_visitor_id      ON ar_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_product_id      ON ar_sessions (product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_model_id        ON ar_sessions (model_id);
CREATE INDEX IF NOT EXISTS idx_ar_snapshots_user_id        ON ar_snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_ar_snapshots_product_id     ON ar_snapshots (product_id);
CREATE INDEX IF NOT EXISTS idx_ar_snapshots_ar_session_id  ON ar_snapshots (ar_session_id);
CREATE INDEX IF NOT EXISTS idx_ar_snapshots_media_id       ON ar_snapshots (media_id);
-- Mục "Khách hàng đã trải nghiệm": chỉ ảnh công khai nên dùng partial index nhỏ gọn
CREATE INDEX IF NOT EXISTS idx_ar_snapshots_public         ON ar_snapshots (product_id, created_at DESC) WHERE is_public;
-- Nhóm 6
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id       ON cart_items (variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_created         ON orders (user_id, created_at DESC);  -- "đơn của tôi" mới nhất trước
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id            ON orders (coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created       ON orders (status, created_at DESC);   -- màn hình xử lý đơn của admin
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_coupon   ON coupon_usages (user_id, coupon_id); -- đếm lượt dùng của 1 user với 1 mã
CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id      ON coupon_usages (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id        ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id      ON order_items (variant_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order  ON order_status_history (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by ON order_status_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_payments_order_id           ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id          ON shipments (order_id);
-- Nhóm 7
CREATE INDEX IF NOT EXISTS idx_spaces_category_id          ON spaces (category_id);
CREATE INDEX IF NOT EXISTS idx_spaces_cover_media_id       ON spaces (cover_media_id);
CREATE INDEX IF NOT EXISTS idx_space_panoramas_space_id    ON space_panoramas (space_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_space_panoramas_media_id    ON space_panoramas (media_id);
CREATE INDEX IF NOT EXISTS idx_space_hotspots_panorama_id  ON space_hotspots (panorama_id);
CREATE INDEX IF NOT EXISTS idx_space_hotspots_product_id   ON space_hotspots (product_id);
CREATE INDEX IF NOT EXISTS idx_space_hotspots_target_panorama_id ON space_hotspots (target_panorama_id);
CREATE INDEX IF NOT EXISTS idx_space_product_placements_panorama_id ON space_product_placements (panorama_id);
CREATE INDEX IF NOT EXISTS idx_space_product_placements_product_id  ON space_product_placements (product_id);
CREATE INDEX IF NOT EXISTS idx_space_product_placements_variant_id  ON space_product_placements (variant_id);
CREATE INDEX IF NOT EXISTS idx_space_product_placements_model_id    ON space_product_placements (model_id);
CREATE INDEX IF NOT EXISTS idx_space_bookmarks_space_id    ON space_bookmarks (space_id);
CREATE INDEX IF NOT EXISTS idx_space_views_space_created   ON space_views (space_id, created_at);  -- thống kê lượt xem theo thời gian
CREATE INDEX IF NOT EXISTS idx_space_views_user_id         ON space_views (user_id);
CREATE INDEX IF NOT EXISTS idx_space_views_visitor_id      ON space_views (visitor_id);
CREATE INDEX IF NOT EXISTS idx_space_views_source_product_id ON space_views (source_product_id);

-- ---------------------------------------------------------------------
-- (4) INDEX CHO CỘT HAY LỌC / TÌM KIẾM
-- (slug đã có UNIQUE nên không cần thêm index)
-- ---------------------------------------------------------------------
-- Danh sách sản phẩm theo danh mục + trạng thái. Không dùng partial (deleted_at) vì index này
-- đồng thời phục vụ khóa ngoại category_id (kiểm tra khi xóa danh mục phải thấy cả dòng xóa mềm).
CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON products (category_id, status);
-- Khối "Sản phẩm nổi bật" trang chủ: tập rất nhỏ nên dùng partial index
CREATE INDEX IF NOT EXISTS idx_products_featured
  ON products (created_at DESC) WHERE is_featured AND status = 'published' AND deleted_at IS NULL;
-- Lọc sản phẩm có 3D/AR (nút lọc "Xem 3D", "Xem AR")
CREATE INDEX IF NOT EXISTS idx_products_has_3d_ar
  ON products (has_3d_model, has_ar) WHERE status = 'published' AND deleted_at IS NULL;
-- Tìm kiếm gần đúng theo tên (ILIKE '%xyz%', similarity)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_status                ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_active_sort      ON categories (parent_id, sort_order) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_pages_status                ON pages (status);
CREATE INDEX IF NOT EXISTS idx_brands_active               ON brands (is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_status              ON reviews (status);           -- hàng đợi duyệt review của admin
CREATE INDEX IF NOT EXISTS idx_product_variants_active     ON product_variants (product_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_product_3d_models_status    ON product_3d_models (status);  -- theo dõi mô hình đang xử lý/lỗi
CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications (user_id, created_at DESC);  -- khóa ngoại + danh sách thông báo
-- Đếm/hiện thông báo chưa đọc (badge): tập nhỏ nên dùng partial index
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_active        ON user_sessions (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_active              ON coupons (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_payments_status             ON payments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_status            ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target        ON activity_logs (target_type, target_id);  -- truy vết lịch sử của một đối tượng
CREATE INDEX IF NOT EXISTS idx_activity_logs_created       ON activity_logs (created_at DESC);

-- Lọc không gian mẫu theo loại phòng, chỉ bản đã đăng
CREATE INDEX IF NOT EXISTS idx_spaces_room_type_status     ON spaces (room_type, status);
-- Tìm kiếm không dấu: gõ "phong khach" vẫn ra "Phòng khách" (dùng hàm immutable_unaccent ở file 01)
-- Truy vấn mẫu: WHERE immutable_unaccent(title) ILIKE '%' || immutable_unaccent('phong khach') || '%'
CREATE INDEX IF NOT EXISTS idx_spaces_title_unaccent_trgm
  ON spaces USING gin (immutable_unaccent(title) gin_trgm_ops);
