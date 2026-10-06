-- =====================================================================
-- 01_extensions.sql : extension và hàm nền tảng
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS citext;    -- email/mã giảm giá không phân biệt hoa thường
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- tìm kiếm gần đúng (trigram)
CREATE EXTENSION IF NOT EXISTS unaccent;  -- bỏ dấu tiếng Việt
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid(), crypt() cho seed

-- unaccent() chỉ STABLE nên không dùng trực tiếp trong index được.
-- Bọc lại thành hàm IMMUTABLE để tạo index GIN trigram tìm kiếm không dấu
-- (ví dụ gõ "phong khach" vẫn thấy "Phòng khách"). Phải tạo TRƯỚC file 04 (index).
-- Lưu ý: nếu sau này đổi từ điển unaccent thì phải REINDEX các index dùng hàm này.
CREATE OR REPLACE FUNCTION immutable_unaccent(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, p_text) $$;

COMMENT ON FUNCTION immutable_unaccent(text) IS
  'Bản IMMUTABLE của unaccent() để dùng trong index tìm kiếm không dấu';
