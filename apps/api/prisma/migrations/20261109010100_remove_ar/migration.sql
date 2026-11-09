-- D-P11 / D-T50: bỏ hoàn toàn AR (không còn bảng, cột, chỉ mục hay trigger chỉ phục vụ AR).
-- GIỮ NGUYÊN: mô hình 3D (product_3d_models, model_files), xem 360°, không gian mẫu, media.
-- GIỮ giá trị 'usdz' của enum model_file_format: đó là dữ liệu tệp 3D sẵn có, không xóa dữ liệu dùng chung;
-- hệ thống không nhận/xử lý USDZ (chỉ GLB, mã 415 ở tầng ứng dụng).

-- 1. Hàm cập nhật cờ 3D: chỉ còn has_3d_model (đặt trước khi bỏ cột has_ar)
CREATE OR REPLACE FUNCTION refresh_product_3d_flags(p_product_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products p
  SET has_3d_model = EXISTS (
        SELECT 1 FROM product_3d_models m
        WHERE m.product_id = p.id AND m.status = 'ready')
  WHERE p.id = p_product_id;
END;
$$;

-- 2. Chỉ mục lọc 3D/AR → chỉ 3D
DROP INDEX IF EXISTS idx_products_has_3d_ar;
CREATE INDEX IF NOT EXISTS idx_products_has_3d
  ON products (has_3d_model) WHERE status = 'published' AND deleted_at IS NULL;

-- 3. Cột has_ar
ALTER TABLE products DROP COLUMN IF EXISTS has_ar;

-- 4. Bảng AR (ar_snapshots tham chiếu ar_sessions nên xóa trước)
DROP TABLE IF EXISTS ar_snapshots;
DROP TABLE IF EXISTS ar_sessions;

-- 5. Kiểu liệt kê chỉ dùng cho AR
DROP TYPE IF EXISTS ar_mode;
