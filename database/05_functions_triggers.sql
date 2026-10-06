-- =====================================================================
-- 05_functions_triggers.sql : hàm và trigger tự động (PL/pgSQL)
--
-- KHÔNG cài trigger cho các việc sau (để tầng Service xử lý trong transaction,
-- vì cần khóa dòng, trả lỗi nghiệp vụ rõ ràng và dễ kiểm thử):
--   * trừ/hoàn tồn kho (product_variants.stock_quantity, inventory_movements)
--   * tăng products.sold_count
--   * kiểm tra/tăng lượt dùng coupon (coupons.used_count, coupon_usages)
--   * kiểm tra "đã mua mới được đánh giá"
-- (Danh sách đầy đủ xem docs/DATABASE_SCHEMA.md)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. set_updated_at(): tự cập nhật cột updated_at khi sửa dòng
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Gắn trigger cho MỌI bảng trong schema public có cột updated_at
-- (tự động theo danh mục hệ thống nên thêm bảng mới không cần sửa file này)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_set_updated_at ON %1$I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_set_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', r.table_name);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Cập nhật products.rating_avg / rating_count từ reviews (chỉ tính 'approved')
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_product_rating(p_product_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products p
  SET rating_avg   = COALESCE(s.avg_rating, 0),
      rating_count = s.cnt
  FROM (
    SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS cnt
    FROM reviews
    WHERE product_id = p_product_id AND status = 'approved'
  ) s
  WHERE p.id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION trg_reviews_refresh_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Dòng cũ (UPDATE/DELETE): tính lại cho sản phẩm cũ
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM refresh_product_rating(OLD.product_id);
  END IF;
  -- Dòng mới (INSERT/UPDATE): tính lại cho sản phẩm mới (bỏ qua nếu trùng sản phẩm cũ đã tính)
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id <> OLD.product_id) THEN
    PERFORM refresh_product_rating(NEW.product_id);
  END IF;
  RETURN NULL;  -- AFTER trigger: giá trị trả về bị bỏ qua
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_rating ON reviews;
CREATE TRIGGER trg_reviews_refresh_rating
  AFTER INSERT OR UPDATE OF rating, status, product_id OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_reviews_refresh_rating();

-- ---------------------------------------------------------------------
-- 3. Cập nhật products.has_3d_model / has_ar
--    has_3d_model: có ít nhất một mô hình status = 'ready'
--    has_ar      : có mô hình 'ready' mà có đủ cả file GLB và USDZ (mọi LOD)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_product_3d_flags(p_product_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products p
  SET has_3d_model = EXISTS (
        SELECT 1 FROM product_3d_models m
        WHERE m.product_id = p.id AND m.status = 'ready'),
      has_ar = EXISTS (
        SELECT 1 FROM product_3d_models m
        WHERE m.product_id = p.id AND m.status = 'ready'
          AND EXISTS (SELECT 1 FROM model_files f WHERE f.model_id = m.id AND f.format = 'glb')
          AND EXISTS (SELECT 1 FROM model_files f WHERE f.model_id = m.id AND f.format = 'usdz'))
  WHERE p.id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION trg_models_refresh_flags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM refresh_product_3d_flags(OLD.product_id);
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id <> OLD.product_id) THEN
    PERFORM refresh_product_3d_flags(NEW.product_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_3d_models_refresh_flags ON product_3d_models;
CREATE TRIGGER trg_product_3d_models_refresh_flags
  AFTER INSERT OR UPDATE OF status, product_id OR DELETE ON product_3d_models
  FOR EACH ROW EXECUTE FUNCTION trg_models_refresh_flags();

CREATE OR REPLACE FUNCTION trg_model_files_refresh_flags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id INTEGER;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT product_id INTO v_product_id FROM product_3d_models WHERE id = OLD.model_id;
    -- NULL khi mô hình cha đang bị xóa (cascade): trigger của bảng product_3d_models đã tính
    IF v_product_id IS NOT NULL THEN PERFORM refresh_product_3d_flags(v_product_id); END IF;
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.model_id <> OLD.model_id) THEN
    SELECT product_id INTO v_product_id FROM product_3d_models WHERE id = NEW.model_id;
    IF v_product_id IS NOT NULL THEN PERFORM refresh_product_3d_flags(v_product_id); END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_model_files_refresh_flags ON model_files;
CREATE TRIGGER trg_model_files_refresh_flags
  AFTER INSERT OR UPDATE OF format, model_id OR DELETE ON model_files
  FOR EACH ROW EXECUTE FUNCTION trg_model_files_refresh_flags();

-- ---------------------------------------------------------------------
-- 4. Tăng spaces.view_count khi có lượt xem mới
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_space_views_increase_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE spaces SET view_count = view_count + 1 WHERE id = NEW.space_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_space_views_increase_count ON space_views;
CREATE TRIGGER trg_space_views_increase_count
  AFTER INSERT ON space_views
  FOR EACH ROW EXECUTE FUNCTION trg_space_views_increase_count();

-- ---------------------------------------------------------------------
-- 5. Tự ghi order_status_history khi tạo đơn và khi orders.status thay đổi
--    Người thay đổi lấy từ biến phiên: SET LOCAL app.current_user_id = '<id>'
--    Ghi chú lấy từ biến phiên:        SET LOCAL app.status_note = '<text>'
--    Không đặt biến => changed_by NULL (hệ thống tự động).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_orders_log_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_changed_by INTEGER := NULLIF(current_setting('app.current_user_id', true), '')::integer;
  v_note       TEXT   := NULLIF(current_setting('app.status_note', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, v_changed_by, COALESCE(v_note, 'Tạo đơn hàng'));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, v_changed_by, v_note);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_log_status_insert ON orders;
CREATE TRIGGER trg_orders_log_status_insert
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_orders_log_status();

DROP TRIGGER IF EXISTS trg_orders_log_status_update ON orders;
CREATE TRIGGER trg_orders_log_status_update
  AFTER UPDATE OF status ON orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_orders_log_status();

-- ---------------------------------------------------------------------
-- 6. Tự gán vai trò 'user' cho tài khoản mới nếu chưa được gán vai trò nào.
--    Dùng CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED: kiểm tra vào cuối transaction,
--    nên nếu code tạo admin trong cùng transaction (INSERT users + INSERT user_roles 'admin')
--    thì tài khoản đó sẽ KHÔNG bị gán thêm vai trò user.
--    Ở chế độ autocommit (mỗi câu lệnh một transaction) trigger chạy ngay sau INSERT.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_users_assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT NEW.id, r.id FROM roles r WHERE r.code = 'user'
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_assign_default_role ON users;
CREATE CONSTRAINT TRIGGER trg_users_assign_default_role
  AFTER INSERT ON users
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_users_assign_default_role();
