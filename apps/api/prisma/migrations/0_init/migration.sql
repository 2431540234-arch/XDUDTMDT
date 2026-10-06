-- Baseline 0_init: sinh từ database/01..05 (extensions, types, tables, constraints/indexes, functions/triggers). KHÔNG gồm seed.

-- ===== 01_extensions.sql =====
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

-- ===== 02_types.sql =====
-- =====================================================================
-- 02_types.sql : toàn bộ kiểu ENUM
-- Bọc DO ... EXCEPTION duplicate_object để chạy lại không lỗi
-- (CREATE TYPE không có IF NOT EXISTS).
-- =====================================================================

-- Nhóm 1
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dùng chung cho pages, products, spaces (cùng vòng đời nháp -> đăng -> lưu trữ)
DO $$ BEGIN CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 4
DO $$ BEGIN CREATE TYPE inventory_movement_type AS ENUM ('import', 'sale', 'return', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 5
DO $$ BEGIN CREATE TYPE model_placement AS ENUM ('floor', 'wall', 'table');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE model_status AS ENUM ('uploading', 'processing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE model_file_format AS ENUM ('glb', 'usdz');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE model_lod AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ar_mode AS ENUM ('view_3d', 'ar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 6
DO $$ BEGIN CREATE TYPE coupon_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE order_status AS ENUM
  ('pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trạng thái thanh toán ở mức đơn hàng (orders.payment_status)
DO $$ BEGIN CREATE TYPE order_payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_method AS ENUM
  ('cod', 'bank_transfer', 'momo', 'vnpay', 'zalopay', 'card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trạng thái của từng giao dịch (payments.status)
DO $$ BEGIN CREATE TYPE payment_txn_status AS ENUM ('pending', 'success', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shipment_carrier AS ENUM ('ghn', 'ghtk', 'viettel_post', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shipment_status AS ENUM
  ('pending', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nhóm 7
DO $$ BEGIN CREATE TYPE room_type AS ENUM
  ('living_room', 'bedroom', 'kitchen', 'dining_room', 'bathroom', 'office', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE hotspot_type AS ENUM ('product', 'navigation', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== 03_tables.sql =====
-- =====================================================================
-- 03_tables.sql : 44 bảng, chia 7 nhóm, sắp theo thứ tự phụ thuộc
--
-- Chỉ có 3 loại người dùng: admin, user (lưu trong users + roles) và
-- khách vãng lai (KHÔNG lưu tài khoản). Vì vậy mọi dữ liệu "của riêng user"
-- (giỏ hàng, đơn hàng, địa chỉ, yêu thích, đánh giá...) có user_id NOT NULL.
--
-- Quy ước ON DELETE (lý do ghi ngay tại khóa ngoại):
--   CASCADE  : dữ liệu con thuần túy, không còn ý nghĩa khi cha mất
--   RESTRICT : dữ liệu cần giữ lịch sử / tham chiếu bắt buộc
--   SET NULL : tham chiếu tùy chọn (media, người thực hiện, ...)
--
-- Khóa ngoại phát sinh vòng hoặc trỏ tới bảng tạo sau (users.avatar_media_id,
-- reviews.order_id) được thêm bằng ALTER TABLE trong 04_constraints_indexes.sql.
-- Index (kể cả partial unique) nằm ở 04.
-- =====================================================================


-- #####################################################################
-- NHÓM 1 – NGƯỜI DÙNG VÀ PHÂN QUYỀN (8 bảng)
-- #####################################################################

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER GENERATED ALWAYS AS IDENTITY,
  uuid              UUID         NOT NULL DEFAULT gen_random_uuid(),
  full_name         VARCHAR(150) NOT NULL,
  email             CITEXT       NOT NULL,
  phone             VARCHAR(20),
  password_hash     VARCHAR(255) NOT NULL,
  avatar_media_id   INTEGER,                                  -- FK thêm ở file 04 (vòng với media)
  status            user_status  NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,                             -- xóa mềm
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_uuid UNIQUE (uuid),
  CONSTRAINT ck_users_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
  -- email duy nhất trên bản ghi chưa xóa mềm: partial unique index ở file 04
);

-- 2. roles
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  code        VARCHAR(50)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_roles PRIMARY KEY (id),
  CONSTRAINT uq_roles_code UNIQUE (code)
);

-- 3. permissions
CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  code        VARCHAR(100) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_permissions PRIMARY KEY (id),
  CONSTRAINT uq_permissions_code UNIQUE (code)
);

-- 4. role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER      NOT NULL,
  permission_id INTEGER      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
  -- CASCADE: xóa vai trò/quyền thì bỏ luôn liên kết
  CONSTRAINT fk_role_permissions_role_id FOREIGN KEY (role_id)
    REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission_id FOREIGN KEY (permission_id)
    REFERENCES permissions (id) ON DELETE CASCADE
);

-- 5. user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    INTEGER      NOT NULL,
  role_id    INTEGER      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
  -- CASCADE: bảng liên kết thuần túy
  CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  -- RESTRICT: không cho xóa vai trò đang được gán cho người dùng
  CONSTRAINT fk_user_roles_role_id FOREIGN KEY (role_id)
    REFERENCES roles (id) ON DELETE RESTRICT
);

-- 6. password_resets
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id    INTEGER       NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_password_resets PRIMARY KEY (id),
  CONSTRAINT uq_password_resets_token_hash UNIQUE (token_hash),
  CONSTRAINT ck_password_resets_expiry CHECK (expires_at > created_at),
  CONSTRAINT fk_password_resets_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE          -- dữ liệu con của user
);

-- 7. user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id            INTEGER       NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  ip_address         INET,
  user_agent         TEXT,
  device_name        VARCHAR(150),
  expires_at         TIMESTAMPTZ  NOT NULL,
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_user_sessions PRIMARY KEY (id),
  CONSTRAINT uq_user_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
  CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE          -- dữ liệu con của user
);

-- 8. addresses
CREATE TABLE IF NOT EXISTS addresses (
  id             INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id        INTEGER       NOT NULL,
  recipient_name VARCHAR(150) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  province       VARCHAR(100) NOT NULL,
  district       VARCHAR(100) NOT NULL,
  ward           VARCHAR(100) NOT NULL,
  address_line   VARCHAR(255) NOT NULL,
  is_default     BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_addresses PRIMARY KEY (id),
  CONSTRAINT fk_addresses_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE          -- sổ địa chỉ là dữ liệu con của user
  -- mỗi user chỉ một địa chỉ mặc định: partial unique index ở file 04
);


-- #####################################################################
-- NHÓM 2 – HỆ THỐNG CHUNG (4 bảng)
-- #####################################################################

-- 9. settings
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  key         VARCHAR(100) NOT NULL,
  value       JSONB        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_settings PRIMARY KEY (id),
  CONSTRAINT uq_settings_key UNIQUE (key)
);

-- 10. media
CREATE TABLE IF NOT EXISTS media (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  mime_type   VARCHAR(100) NOT NULL,
  file_size   BIGINT       NOT NULL,
  alt_text    VARCHAR(255),
  uploaded_by INTEGER,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_media PRIMARY KEY (id),
  CONSTRAINT uq_media_file_path UNIQUE (file_path),
  CONSTRAINT ck_media_file_size CHECK (file_size >= 0),
  -- SET NULL: xóa tài khoản không được làm mất tệp đã tải lên
  CONSTRAINT fk_media_uploaded_by FOREIGN KEY (uploaded_by)
    REFERENCES users (id) ON DELETE SET NULL
);

-- 11. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id    INTEGER       NOT NULL,
  title      VARCHAR(255) NOT NULL,
  data       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_notifications PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE          -- thông báo là dữ liệu con của user
);

-- 12. activity_logs  (chỉ ghi thao tác của admin; bảng nhật ký nên chỉ có created_at)
CREATE TABLE IF NOT EXISTS activity_logs (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  actor_id    INTEGER,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(100),
  target_id   INTEGER,
  changes     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_activity_logs PRIMARY KEY (id),
  -- SET NULL: nhật ký phải còn dù tài khoản admin bị xóa cứng
  CONSTRAINT fk_activity_logs_actor_id FOREIGN KEY (actor_id)
    REFERENCES users (id) ON DELETE SET NULL
);


-- #####################################################################
-- NHÓM 3 – NỘI DUNG (2 bảng)
-- #####################################################################

-- 13. categories
CREATE TABLE IF NOT EXISTS categories (
  id               INTEGER GENERATED ALWAYS AS IDENTITY,
  parent_id        INTEGER,
  name             VARCHAR(150) NOT NULL,
  slug             VARCHAR(180) NOT NULL,
  image_media_id   INTEGER,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_categories PRIMARY KEY (id),
  CONSTRAINT uq_categories_slug UNIQUE (slug),
  CONSTRAINT ck_categories_parent_not_self CHECK (parent_id <> id),
  -- RESTRICT: không cho xóa danh mục còn danh mục con (tránh mồ côi cả nhánh)
  CONSTRAINT fk_categories_parent_id FOREIGN KEY (parent_id)
    REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_categories_image_media_id FOREIGN KEY (image_media_id)
    REFERENCES media (id) ON DELETE SET NULL         -- ảnh tùy chọn
);

-- 14. pages
CREATE TABLE IF NOT EXISTS pages (
  id               INTEGER GENERATED ALWAYS AS IDENTITY,
  title            VARCHAR(255)   NOT NULL,
  slug             VARCHAR(180)   NOT NULL,
  content          TEXT,
  status           content_status NOT NULL DEFAULT 'draft',
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT pk_pages PRIMARY KEY (id),
  CONSTRAINT uq_pages_slug UNIQUE (slug)
);


-- #####################################################################
-- NHÓM 4 – SẢN PHẨM (10 bảng)
-- #####################################################################

-- 15. brands
CREATE TABLE IF NOT EXISTS brands (
  id            INTEGER GENERATED ALWAYS AS IDENTITY,
  name          VARCHAR(150) NOT NULL,
  slug          VARCHAR(180) NOT NULL,
  logo_media_id INTEGER,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_brands PRIMARY KEY (id),
  CONSTRAINT uq_brands_slug UNIQUE (slug),
  CONSTRAINT fk_brands_logo_media_id FOREIGN KEY (logo_media_id)
    REFERENCES media (id) ON DELETE SET NULL         -- logo tùy chọn
);

-- 16. products
CREATE TABLE IF NOT EXISTS products (
  id                INTEGER GENERATED ALWAYS AS IDENTITY,
  name              VARCHAR(255)   NOT NULL,
  slug              VARCHAR(280)   NOT NULL,
  short_description VARCHAR(500),
  description       TEXT,
  category_id       INTEGER,
  brand_id          INTEGER,
  status            content_status NOT NULL DEFAULT 'draft',
  is_featured       BOOLEAN        NOT NULL DEFAULT false,
  rating_avg        NUMERIC(3,2)   NOT NULL DEFAULT 0,   -- trigger cập nhật
  rating_count      INTEGER        NOT NULL DEFAULT 0,   -- trigger cập nhật
  sold_count        INTEGER        NOT NULL DEFAULT 0,   -- tầng Service cập nhật
  has_3d_model      BOOLEAN        NOT NULL DEFAULT false, -- trigger cập nhật
  has_ar            BOOLEAN        NOT NULL DEFAULT false, -- trigger cập nhật
  meta_title        VARCHAR(255),
  meta_description  VARCHAR(500),
  deleted_at        TIMESTAMPTZ,                         -- xóa mềm
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT pk_products PRIMARY KEY (id),
  CONSTRAINT uq_products_slug UNIQUE (slug),
  CONSTRAINT ck_products_rating_avg CHECK (rating_avg >= 0 AND rating_avg <= 5),
  CONSTRAINT ck_products_rating_count CHECK (rating_count >= 0),
  CONSTRAINT ck_products_sold_count CHECK (sold_count >= 0),
  -- SET NULL: xóa danh mục/thương hiệu không được làm mất sản phẩm
  CONSTRAINT fk_products_category_id FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_brand_id FOREIGN KEY (brand_id)
    REFERENCES brands (id) ON DELETE SET NULL
);

-- 17. attributes
CREATE TABLE IF NOT EXISTS attributes (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  code       VARCHAR(50)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_attributes PRIMARY KEY (id),
  CONSTRAINT uq_attributes_code UNIQUE (code),
  CONSTRAINT uq_attributes_name UNIQUE (name)
);

-- 18. attribute_values
CREATE TABLE IF NOT EXISTS attribute_values (
  id           INTEGER GENERATED ALWAYS AS IDENTITY,
  attribute_id INTEGER       NOT NULL,
  value        VARCHAR(150) NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_attribute_values PRIMARY KEY (id),
  CONSTRAINT uq_attribute_values_attribute_value UNIQUE (attribute_id, value),
  -- Cần cho khóa ngoại kép của variant_attribute_values (đảm bảo giá trị thuộc đúng thuộc tính)
  CONSTRAINT uq_attribute_values_id_attribute UNIQUE (id, attribute_id),
  CONSTRAINT fk_attribute_values_attribute_id FOREIGN KEY (attribute_id)
    REFERENCES attributes (id) ON DELETE CASCADE     -- giá trị là con của thuộc tính
);

-- 19. product_variants
CREATE TABLE IF NOT EXISTS product_variants (
  id             INTEGER GENERATED ALWAYS AS IDENTITY,
  product_id     INTEGER        NOT NULL,
  sku            VARCHAR(100)  NOT NULL,
  price          NUMERIC(15,2) NOT NULL,
  sale_price     NUMERIC(15,2),
  stock_quantity INTEGER       NOT NULL DEFAULT 0,
  weight_gram    INTEGER,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_product_variants PRIMARY KEY (id),
  CONSTRAINT uq_product_variants_sku UNIQUE (sku),
  -- Cần cho khóa ngoại kép (variant_id, product_id) ở product_images, product_3d_models
  CONSTRAINT uq_product_variants_id_product UNIQUE (id, product_id),
  CONSTRAINT ck_product_variants_price CHECK (price >= 0),
  CONSTRAINT ck_product_variants_sale_price CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price <= price)),
  CONSTRAINT ck_product_variants_stock CHECK (stock_quantity >= 0),
  CONSTRAINT ck_product_variants_weight CHECK (weight_gram IS NULL OR weight_gram >= 0),
  CONSTRAINT fk_product_variants_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE       -- biến thể là con của sản phẩm
);

-- 20. variant_attribute_values
-- Mỗi biến thể chỉ có 1 giá trị cho mỗi thuộc tính: UNIQUE (variant_id, attribute_id).
-- Khóa ngoại kép (attribute_value_id, attribute_id) đảm bảo attribute_id khớp với giá trị.
CREATE TABLE IF NOT EXISTS variant_attribute_values (
  variant_id         INTEGER      NOT NULL,
  attribute_value_id INTEGER      NOT NULL,
  attribute_id       INTEGER      NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_variant_attribute_values PRIMARY KEY (variant_id, attribute_value_id),
  CONSTRAINT uq_variant_attribute_values_variant_attribute UNIQUE (variant_id, attribute_id),
  CONSTRAINT fk_variant_attribute_values_variant_id FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE CASCADE,
  CONSTRAINT fk_variant_attribute_values_attribute_value_id FOREIGN KEY (attribute_value_id, attribute_id)
    REFERENCES attribute_values (id, attribute_id) ON DELETE CASCADE
);

-- 21. product_images
CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  product_id INTEGER      NOT NULL,
  variant_id INTEGER,
  media_id   INTEGER      NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_primary BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_product_images PRIMARY KEY (id),
  CONSTRAINT fk_product_images_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  -- Khóa kép: biến thể gắn ảnh phải thuộc đúng sản phẩm (bỏ qua khi variant_id NULL)
  CONSTRAINT fk_product_images_variant_id FOREIGN KEY (variant_id, product_id)
    REFERENCES product_variants (id, product_id) ON DELETE CASCADE,
  -- RESTRICT: media bắt buộc (NOT NULL) nên không thể SET NULL; phải gỡ ảnh trước khi xóa tệp
  CONSTRAINT fk_product_images_media_id FOREIGN KEY (media_id)
    REFERENCES media (id) ON DELETE RESTRICT
  -- mỗi sản phẩm một ảnh đại diện: partial unique index ở file 04
);

-- 22. inventory_movements  (nhật ký: chỉ created_at)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              INTEGER GENERATED ALWAYS AS IDENTITY,
  variant_id      INTEGER                  NOT NULL,
  type            inventory_movement_type NOT NULL,
  quantity_change INTEGER                 NOT NULL,
  reason          VARCHAR(255),
  reference_code  VARCHAR(100),
  performed_by    INTEGER,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),
  CONSTRAINT pk_inventory_movements PRIMARY KEY (id),
  CONSTRAINT ck_inventory_movements_quantity CHECK (quantity_change <> 0),
  -- RESTRICT: giữ lịch sử tồn kho; muốn ngừng bán thì tắt is_active
  CONSTRAINT fk_inventory_movements_variant_id FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movements_performed_by FOREIGN KEY (performed_by)
    REFERENCES users (id) ON DELETE SET NULL
);

-- 23. reviews
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id    INTEGER        NOT NULL,
  product_id INTEGER        NOT NULL,
  order_id   INTEGER,                                   -- FK thêm ở file 04 (orders tạo sau)
  rating     SMALLINT      NOT NULL,
  content    TEXT,
  status     review_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_reviews PRIMARY KEY (id),
  CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  -- NULLS NOT DISTINCT (PG15+): order_id NULL vẫn bị coi là trùng, tránh 1 user đánh giá 1 sản phẩm nhiều lần
  CONSTRAINT uq_reviews_user_product_order UNIQUE NULLS NOT DISTINCT (user_id, product_id, order_id),
  CONSTRAINT fk_reviews_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
);

-- 24. wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id    INTEGER      NOT NULL,
  product_id INTEGER      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_wishlists PRIMARY KEY (id),
  CONSTRAINT uq_wishlists_user_product UNIQUE (user_id, product_id),
  CONSTRAINT fk_wishlists_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlists_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
);


-- #####################################################################
-- NHÓM 5 – MÔ HÌNH 3D VÀ AR (5 bảng)
-- #####################################################################

-- 25. product_3d_models
CREATE TABLE IF NOT EXISTS product_3d_models (
  id              INTEGER GENERATED ALWAYS AS IDENTITY,
  uuid            UUID             NOT NULL DEFAULT gen_random_uuid(),
  product_id      INTEGER           NOT NULL,
  variant_id      INTEGER,
  length_mm       INTEGER          NOT NULL,
  width_mm        INTEGER          NOT NULL,
  height_mm       INTEGER          NOT NULL,
  placement       model_placement  NOT NULL DEFAULT 'floor',
  allow_scaling   BOOLEAN          NOT NULL DEFAULT false,
  viewer_config   JSONB            NOT NULL DEFAULT '{}'::jsonb,
  poster_media_id INTEGER,
  status          model_status     NOT NULL DEFAULT 'uploading',
  version         INTEGER          NOT NULL DEFAULT 1,
  is_primary      BOOLEAN          NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT pk_product_3d_models PRIMARY KEY (id),
  CONSTRAINT uq_product_3d_models_uuid UNIQUE (uuid),
  CONSTRAINT ck_product_3d_models_size CHECK (length_mm > 0 AND width_mm > 0 AND height_mm > 0),
  CONSTRAINT ck_product_3d_models_version CHECK (version >= 1),
  CONSTRAINT fk_product_3d_models_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  -- Khóa kép: biến thể phải thuộc đúng sản phẩm (bỏ qua khi variant_id NULL)
  CONSTRAINT fk_product_3d_models_variant_id FOREIGN KEY (variant_id, product_id)
    REFERENCES product_variants (id, product_id) ON DELETE CASCADE,
  CONSTRAINT fk_product_3d_models_poster_media_id FOREIGN KEY (poster_media_id)
    REFERENCES media (id) ON DELETE SET NULL         -- ảnh chờ tùy chọn
  -- mỗi sản phẩm một mô hình chính: partial unique index ở file 04
);

-- 26. model_files
CREATE TABLE IF NOT EXISTS model_files (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY,
  model_id           INTEGER            NOT NULL,
  format             model_file_format NOT NULL,
  lod                model_lod         NOT NULL DEFAULT 'high',
  media_id           INTEGER            NOT NULL,
  polygon_count      INTEGER,
  texture_resolution INTEGER,
  is_compressed      BOOLEAN           NOT NULL DEFAULT false,
  checksum           VARCHAR(128),
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  CONSTRAINT pk_model_files PRIMARY KEY (id),
  CONSTRAINT uq_model_files_model_format_lod UNIQUE (model_id, format, lod),
  CONSTRAINT ck_model_files_polygon CHECK (polygon_count IS NULL OR polygon_count >= 0),
  CONSTRAINT ck_model_files_texture CHECK (texture_resolution IS NULL OR texture_resolution > 0),
  CONSTRAINT fk_model_files_model_id FOREIGN KEY (model_id)
    REFERENCES product_3d_models (id) ON DELETE CASCADE,
  -- RESTRICT: media bắt buộc; không xóa tệp đang là file của mô hình
  CONSTRAINT fk_model_files_media_id FOREIGN KEY (media_id)
    REFERENCES media (id) ON DELETE RESTRICT
);

-- 27. model_material_variants
CREATE TABLE IF NOT EXISTS model_material_variants (
  id            INTEGER GENERATED ALWAYS AS IDENTITY,
  model_id      INTEGER       NOT NULL,
  variant_id    INTEGER       NOT NULL,
  material_name VARCHAR(150) NOT NULL,
  config        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_model_material_variants PRIMARY KEY (id),
  CONSTRAINT uq_model_material_variants_model_variant UNIQUE (model_id, variant_id),
  CONSTRAINT fk_model_material_variants_model_id FOREIGN KEY (model_id)
    REFERENCES product_3d_models (id) ON DELETE CASCADE,
  CONSTRAINT fk_model_material_variants_variant_id FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE CASCADE
);

-- 28. ar_sessions  (khách vãng lai có user_id NULL + visitor_id)
CREATE TABLE IF NOT EXISTS ar_sessions (
  id               INTEGER GENERATED ALWAYS AS IDENTITY,
  uuid             UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id          INTEGER,
  visitor_id       UUID,
  product_id       INTEGER      NOT NULL,
  model_id         INTEGER,
  device           VARCHAR(150),
  os               VARCHAR(50),
  ar_platform      VARCHAR(50),                        -- vd: webxr, scene_viewer, quick_look
  mode             ar_mode     NOT NULL,
  duration_seconds INTEGER     NOT NULL DEFAULT 0,
  placed           BOOLEAN     NOT NULL DEFAULT false,
  captured         BOOLEAN     NOT NULL DEFAULT false,
  added_to_cart    BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),   -- phiên được cập nhật các cờ khi đang diễn ra
  CONSTRAINT pk_ar_sessions PRIMARY KEY (id),
  CONSTRAINT uq_ar_sessions_uuid UNIQUE (uuid),
  CONSTRAINT ck_ar_sessions_actor CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL),
  CONSTRAINT ck_ar_sessions_duration CHECK (duration_seconds >= 0),
  -- CASCADE (không SET NULL): SET NULL có thể vi phạm ck_ar_sessions_actor khi visitor_id rỗng
  CONSTRAINT fk_ar_sessions_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_sessions_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_sessions_model_id FOREIGN KEY (model_id)
    REFERENCES product_3d_models (id) ON DELETE SET NULL
);

-- 29. ar_snapshots
CREATE TABLE IF NOT EXISTS ar_snapshots (
  id            INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id       INTEGER      NOT NULL,
  product_id    INTEGER      NOT NULL,
  ar_session_id INTEGER,
  media_id      INTEGER      NOT NULL,
  is_public     BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_ar_snapshots PRIMARY KEY (id),
  CONSTRAINT fk_ar_snapshots_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_snapshots_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_snapshots_ar_session_id FOREIGN KEY (ar_session_id)
    REFERENCES ar_sessions (id) ON DELETE SET NULL,  -- phiên chỉ là nguồn gốc, tùy chọn
  CONSTRAINT fk_ar_snapshots_media_id FOREIGN KEY (media_id)
    REFERENCES media (id) ON DELETE RESTRICT         -- media bắt buộc
);


-- #####################################################################
-- NHÓM 6 – GIỎ HÀNG VÀ ĐƠN HÀNG (9 bảng)
-- Thứ tự tạo: coupons trước orders; coupon_usages sau orders (phụ thuộc orders).
-- #####################################################################

-- 30. carts  (mỗi user một giỏ; không có giỏ cho khách)
CREATE TABLE IF NOT EXISTS carts (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id    INTEGER      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_carts PRIMARY KEY (id),
  CONSTRAINT uq_carts_user_id UNIQUE (user_id),
  CONSTRAINT fk_carts_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
);

-- 31. cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  cart_id    INTEGER      NOT NULL,
  variant_id INTEGER      NOT NULL,
  quantity   INTEGER     NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_cart_items PRIMARY KEY (id),
  CONSTRAINT uq_cart_items_cart_variant UNIQUE (cart_id, variant_id),
  CONSTRAINT ck_cart_items_quantity CHECK (quantity > 0),
  CONSTRAINT fk_cart_items_cart_id FOREIGN KEY (cart_id)
    REFERENCES carts (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_variant_id FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE CASCADE  -- biến thể bị xóa thì bỏ khỏi giỏ
);

-- 32. coupons
CREATE TABLE IF NOT EXISTS coupons (
  id              INTEGER GENERATED ALWAYS AS IDENTITY,
  code            CITEXT        NOT NULL,
  type            coupon_type   NOT NULL,
  value           NUMERIC(15,2) NOT NULL,
  max_discount    NUMERIC(15,2),
  min_order_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  usage_limit     INTEGER,                              -- NULL = không giới hạn
  per_user_limit  INTEGER,                              -- NULL = không giới hạn
  used_count      INTEGER       NOT NULL DEFAULT 0,
  starts_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,                          -- NULL = không hết hạn
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_coupons PRIMARY KEY (id),
  CONSTRAINT uq_coupons_code UNIQUE (code),
  CONSTRAINT ck_coupons_value CHECK (value > 0),
  CONSTRAINT ck_coupons_percent_max CHECK (type <> 'percent' OR value <= 100),
  CONSTRAINT ck_coupons_max_discount CHECK (max_discount IS NULL OR max_discount >= 0),
  CONSTRAINT ck_coupons_min_order CHECK (min_order_value >= 0),
  CONSTRAINT ck_coupons_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0),
  CONSTRAINT ck_coupons_per_user_limit CHECK (per_user_limit IS NULL OR per_user_limit > 0),
  CONSTRAINT ck_coupons_used_count CHECK (used_count >= 0),
  CONSTRAINT ck_coupons_period CHECK (starts_at < ends_at)   -- NULL ends_at => thỏa
);

-- 34. orders  (đánh số theo tài liệu; đặt trước coupon_usages vì phụ thuộc)
CREATE TABLE IF NOT EXISTS orders (
  id                   INTEGER GENERATED ALWAYS AS IDENTITY,
  uuid                 UUID                 NOT NULL DEFAULT gen_random_uuid(),
  order_code           VARCHAR(30)          NOT NULL,
  user_id              INTEGER               NOT NULL,
  status               order_status         NOT NULL DEFAULT 'pending',
  recipient_name       VARCHAR(150)         NOT NULL,   -- bản chụp tại thời điểm đặt,
  recipient_phone      VARCHAR(20)          NOT NULL,   -- không tham chiếu addresses
  shipping_province    VARCHAR(100)         NOT NULL,
  shipping_district    VARCHAR(100)         NOT NULL,
  shipping_ward        VARCHAR(100)         NOT NULL,
  shipping_address     VARCHAR(255)         NOT NULL,
  subtotal             NUMERIC(15,2)        NOT NULL,
  discount_amount      NUMERIC(15,2)        NOT NULL DEFAULT 0,
  shipping_fee         NUMERIC(15,2)        NOT NULL DEFAULT 0,
  total                NUMERIC(15,2)        NOT NULL,
  coupon_id            INTEGER,
  payment_method       payment_method       NOT NULL,
  payment_status       order_payment_status NOT NULL DEFAULT 'unpaid',
  note                 TEXT,
  cancel_reason        TEXT,
  created_at           TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ          NOT NULL DEFAULT now(),
  CONSTRAINT pk_orders PRIMARY KEY (id),
  CONSTRAINT uq_orders_uuid UNIQUE (uuid),
  CONSTRAINT uq_orders_order_code UNIQUE (order_code),
  CONSTRAINT ck_orders_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND shipping_fee >= 0 AND total >= 0),
  CONSTRAINT ck_orders_total CHECK (total = subtotal - discount_amount + shipping_fee),
  -- RESTRICT: không xóa user còn đơn hàng (giữ lịch sử mua bán; dùng xóa mềm)
  CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  -- SET NULL: xóa mã giảm giá không làm mất đơn; số tiền giảm vẫn nằm ở discount_amount
  CONSTRAINT fk_orders_coupon_id FOREIGN KEY (coupon_id)
    REFERENCES coupons (id) ON DELETE SET NULL
);

-- 33. coupon_usages  (nhật ký: chỉ created_at)
CREATE TABLE IF NOT EXISTS coupon_usages (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  coupon_id  INTEGER      NOT NULL,
  user_id    INTEGER      NOT NULL,
  order_id   INTEGER      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_coupon_usages PRIMARY KEY (id),
  CONSTRAINT uq_coupon_usages_coupon_order UNIQUE (coupon_id, order_id),
  -- RESTRICT coupon/user: giữ lịch sử dùng mã để kiểm soát giới hạn lượt
  CONSTRAINT fk_coupon_usages_coupon_id FOREIGN KEY (coupon_id)
    REFERENCES coupons (id) ON DELETE RESTRICT,
  CONSTRAINT fk_coupon_usages_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_coupon_usages_order_id FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE         -- bản ghi con của đơn
);

-- 35. order_items
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER GENERATED ALWAYS AS IDENTITY,
  order_id     INTEGER        NOT NULL,
  variant_id   INTEGER,
  product_name VARCHAR(255)  NOT NULL,                -- bản chụp tại thời điểm mua
  sku          VARCHAR(100)  NOT NULL,                 -- bản chụp tại thời điểm mua
  unit_price   NUMERIC(15,2) NOT NULL,
  quantity     INTEGER       NOT NULL,
  line_total   NUMERIC(15,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_order_items PRIMARY KEY (id),
  CONSTRAINT ck_order_items_unit_price CHECK (unit_price >= 0),
  CONSTRAINT ck_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  -- SET NULL: biến thể bị xóa thì đơn cũ vẫn còn tên/SKU/giá đã chụp
  CONSTRAINT fk_order_items_variant_id FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE SET NULL
);

-- 36. order_status_history  (nhật ký: chỉ created_at)
CREATE TABLE IF NOT EXISTS order_status_history (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  order_id    INTEGER       NOT NULL,
  from_status order_status,                            -- NULL ở dòng khởi tạo đơn
  to_status   order_status NOT NULL,
  changed_by  INTEGER,
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT pk_order_status_history PRIMARY KEY (id),
  CONSTRAINT fk_order_status_history_order_id FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_changed_by FOREIGN KEY (changed_by)
    REFERENCES users (id) ON DELETE SET NULL         -- NULL = hệ thống tự động
);

-- 37. payments
CREATE TABLE IF NOT EXISTS payments (
  id               INTEGER GENERATED ALWAYS AS IDENTITY,
  order_id         INTEGER             NOT NULL,
  method           payment_method     NOT NULL,
  amount           NUMERIC(15,2)      NOT NULL,
  status           payment_txn_status NOT NULL DEFAULT 'pending',
  transaction_code VARCHAR(100),
  gateway_response JSONB,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT now(),
  CONSTRAINT pk_payments PRIMARY KEY (id),
  CONSTRAINT uq_payments_transaction_code UNIQUE (transaction_code),  -- NULL được lặp
  CONSTRAINT ck_payments_amount CHECK (amount >= 0),
  -- RESTRICT: không xóa đơn khi còn giao dịch thanh toán (chứng từ tài chính)
  CONSTRAINT fk_payments_order_id FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE RESTRICT
);

-- 38. shipments
CREATE TABLE IF NOT EXISTS shipments (
  id            INTEGER GENERATED ALWAYS AS IDENTITY,
  order_id      INTEGER           NOT NULL,
  carrier       shipment_carrier NOT NULL,
  tracking_code VARCHAR(100),
  status        shipment_status  NOT NULL DEFAULT 'pending',
  fee           NUMERIC(15,2)    NOT NULL DEFAULT 0,
  shipped_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT pk_shipments PRIMARY KEY (id),
  CONSTRAINT ck_shipments_fee CHECK (fee >= 0),
  CONSTRAINT ck_shipments_dates CHECK (delivered_at IS NULL OR shipped_at IS NULL OR delivered_at >= shipped_at),
  CONSTRAINT fk_shipments_order_id FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE RESTRICT        -- giữ lịch sử vận chuyển
);


-- #####################################################################
-- NHÓM 7 – KHÔNG GIAN MẪU / PANORAMA (6 bảng)
-- #####################################################################

-- 39. spaces
CREATE TABLE IF NOT EXISTS spaces (
  id             INTEGER GENERATED ALWAYS AS IDENTITY,
  uuid           UUID           NOT NULL DEFAULT gen_random_uuid(),
  title          VARCHAR(255)   NOT NULL,
  slug           VARCHAR(280)   NOT NULL,
  description    TEXT,
  room_type      room_type      NOT NULL DEFAULT 'other',
  style          VARCHAR(100),
  category_id    INTEGER,
  cover_media_id INTEGER,
  status         content_status NOT NULL DEFAULT 'draft',
  view_count     INTEGER        NOT NULL DEFAULT 0,     -- trigger tăng khi có space_views
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT pk_spaces PRIMARY KEY (id),
  CONSTRAINT uq_spaces_uuid UNIQUE (uuid),
  CONSTRAINT uq_spaces_slug UNIQUE (slug),
  CONSTRAINT ck_spaces_view_count CHECK (view_count >= 0),
  CONSTRAINT fk_spaces_category_id FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_spaces_cover_media_id FOREIGN KEY (cover_media_id)
    REFERENCES media (id) ON DELETE SET NULL
);

-- 40. space_panoramas
CREATE TABLE IF NOT EXISTS space_panoramas (
  id            INTEGER GENERATED ALWAYS AS IDENTITY,
  space_id      INTEGER        NOT NULL,
  media_id      INTEGER        NOT NULL,
  title         VARCHAR(255),
  default_yaw   NUMERIC(9,4)  NOT NULL DEFAULT 0,
  default_pitch NUMERIC(9,4)  NOT NULL DEFAULT 0,
  default_fov   NUMERIC(9,4)  NOT NULL DEFAULT 90,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  is_start      BOOLEAN       NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_space_panoramas PRIMARY KEY (id),
  CONSTRAINT ck_space_panoramas_fov CHECK (default_fov > 0 AND default_fov < 180),
  CONSTRAINT fk_space_panoramas_space_id FOREIGN KEY (space_id)
    REFERENCES spaces (id) ON DELETE CASCADE,
  CONSTRAINT fk_space_panoramas_media_id FOREIGN KEY (media_id)
    REFERENCES media (id) ON DELETE RESTRICT         -- media bắt buộc
  -- mỗi space một ảnh mở đầu: partial unique index ở file 04
);

-- 41. space_hotspots
CREATE TABLE IF NOT EXISTS space_hotspots (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY,
  panorama_id        INTEGER        NOT NULL,
  type               hotspot_type  NOT NULL,
  yaw                NUMERIC(9,4)  NOT NULL,
  pitch              NUMERIC(9,4)  NOT NULL,
  product_id         INTEGER,
  target_panorama_id INTEGER,
  title              VARCHAR(255),
  content            TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_space_hotspots PRIMARY KEY (id),
  CONSTRAINT ck_space_hotspots_product CHECK (type <> 'product' OR product_id IS NOT NULL),
  CONSTRAINT ck_space_hotspots_navigation CHECK (type <> 'navigation' OR target_panorama_id IS NOT NULL),
  CONSTRAINT ck_space_hotspots_info CHECK (type <> 'info' OR content IS NOT NULL),
  CONSTRAINT ck_space_hotspots_not_self CHECK (target_panorama_id IS NULL OR target_panorama_id <> panorama_id),
  CONSTRAINT fk_space_hotspots_panorama_id FOREIGN KEY (panorama_id)
    REFERENCES space_panoramas (id) ON DELETE CASCADE,
  -- CASCADE (không SET NULL): SET NULL sẽ vi phạm CHECK theo loại điểm bấm
  CONSTRAINT fk_space_hotspots_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_space_hotspots_target_panorama_id FOREIGN KEY (target_panorama_id)
    REFERENCES space_panoramas (id) ON DELETE CASCADE
);

-- 42. space_product_placements
CREATE TABLE IF NOT EXISTS space_product_placements (
  id          INTEGER GENERATED ALWAYS AS IDENTITY,
  panorama_id INTEGER        NOT NULL,
  product_id  INTEGER        NOT NULL,
  variant_id  INTEGER,
  model_id    INTEGER,
  yaw         NUMERIC(9,4)  NOT NULL,
  pitch       NUMERIC(9,4)  NOT NULL,
  distance    NUMERIC(9,4)  NOT NULL,                  -- khoảng cách tới camera (mét)
  rotation_x  NUMERIC(9,4)  NOT NULL DEFAULT 0,
  rotation_y  NUMERIC(9,4)  NOT NULL DEFAULT 0,
  rotation_z  NUMERIC(9,4)  NOT NULL DEFAULT 0,
  scale       NUMERIC(9,4)  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_space_product_placements PRIMARY KEY (id),
  CONSTRAINT ck_space_product_placements_scale CHECK (scale > 0),
  CONSTRAINT ck_space_product_placements_distance CHECK (distance > 0),
  CONSTRAINT fk_space_product_placements_panorama_id FOREIGN KEY (panorama_id)
    REFERENCES space_panoramas (id) ON DELETE CASCADE,
  CONSTRAINT fk_space_product_placements_product_id FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  -- Khóa kép: biến thể phải thuộc đúng sản phẩm được đặt.
  -- SET NULL (variant_id): chỉ xóa biến thể, giữ product_id (cột NOT NULL) -- cú pháp PG15+
  CONSTRAINT fk_space_product_placements_variant_id FOREIGN KEY (variant_id, product_id)
    REFERENCES product_variants (id, product_id) ON DELETE SET NULL (variant_id),
  -- SET NULL: model_id tùy chọn (NULL = dùng mô hình chính của sản phẩm)
  CONSTRAINT fk_space_product_placements_model_id FOREIGN KEY (model_id)
    REFERENCES product_3d_models (id) ON DELETE SET NULL
);

-- 43. space_bookmarks
CREATE TABLE IF NOT EXISTS space_bookmarks (
  id         INTEGER GENERATED ALWAYS AS IDENTITY,
  user_id    INTEGER      NOT NULL,
  space_id   INTEGER      NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_space_bookmarks PRIMARY KEY (id),
  CONSTRAINT uq_space_bookmarks_user_space UNIQUE (user_id, space_id),
  CONSTRAINT fk_space_bookmarks_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_space_bookmarks_space_id FOREIGN KEY (space_id)
    REFERENCES spaces (id) ON DELETE CASCADE
);

-- 44. space_views  (nhật ký: chỉ created_at; khách vãng lai: user_id NULL + visitor_id)
CREATE TABLE IF NOT EXISTS space_views (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY,
  space_id           INTEGER      NOT NULL,
  user_id            INTEGER,
  visitor_id         UUID,
  source_product_id  INTEGER,
  hotspot_click_count INTEGER    NOT NULL DEFAULT 0,
  added_to_cart      BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_space_views PRIMARY KEY (id),
  CONSTRAINT ck_space_views_actor CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL),
  CONSTRAINT ck_space_views_clicks CHECK (hotspot_click_count >= 0),
  CONSTRAINT fk_space_views_space_id FOREIGN KEY (space_id)
    REFERENCES spaces (id) ON DELETE CASCADE,
  -- CASCADE (không SET NULL): SET NULL có thể vi phạm ck_space_views_actor khi visitor_id rỗng
  CONSTRAINT fk_space_views_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_space_views_source_product_id FOREIGN KEY (source_product_id)
    REFERENCES products (id) ON DELETE SET NULL      -- sản phẩm nguồn chỉ để thống kê
);


-- #####################################################################
-- COMMENT TIẾNG VIỆT CHO BẢNG VÀ CỘT
-- #####################################################################

-- ---- Nhóm 1 ----
COMMENT ON TABLE users IS 'Tài khoản người dùng (admin và user). Khách vãng lai không có tài khoản. Hỗ trợ xóa mềm.';
COMMENT ON COLUMN users.id IS 'Khóa chính';
COMMENT ON COLUMN users.uuid IS 'Mã công khai dùng ngoài API, không lộ id tuần tự';
COMMENT ON COLUMN users.full_name IS 'Họ và tên';
COMMENT ON COLUMN users.email IS 'Email đăng nhập, không phân biệt hoa thường; duy nhất trên tài khoản chưa xóa mềm';
COMMENT ON COLUMN users.phone IS 'Số điện thoại';
COMMENT ON COLUMN users.password_hash IS 'Mật khẩu đã băm (bcrypt/argon2), không lưu mật khẩu gốc';
COMMENT ON COLUMN users.avatar_media_id IS 'Ảnh đại diện (media)';
COMMENT ON COLUMN users.status IS 'Trạng thái tài khoản: active, suspended (tạm khóa), banned (bị cấm)';
COMMENT ON COLUMN users.email_verified_at IS 'Thời điểm xác thực email';
COMMENT ON COLUMN users.last_login_at IS 'Lần đăng nhập gần nhất';
COMMENT ON COLUMN users.deleted_at IS 'Thời điểm xóa mềm; NULL = còn hoạt động';
COMMENT ON COLUMN users.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN users.updated_at IS 'Thời điểm cập nhật cuối (trigger tự cập nhật)';

COMMENT ON TABLE roles IS 'Vai trò trong hệ thống: chỉ có admin và user. Khách vãng lai không lưu ở đây.';
COMMENT ON COLUMN roles.id IS 'Khóa chính';
COMMENT ON COLUMN roles.code IS 'Mã vai trò: admin | user';
COMMENT ON COLUMN roles.name IS 'Tên hiển thị';
COMMENT ON COLUMN roles.description IS 'Mô tả vai trò';
COMMENT ON COLUMN roles.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN roles.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE permissions IS 'Danh sách quyền cụ thể trong khu vực quản trị';
COMMENT ON COLUMN permissions.id IS 'Khóa chính';
COMMENT ON COLUMN permissions.code IS 'Mã quyền, ví dụ manage_users';
COMMENT ON COLUMN permissions.name IS 'Tên hiển thị';
COMMENT ON COLUMN permissions.description IS 'Mô tả quyền';
COMMENT ON COLUMN permissions.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE role_permissions IS 'Gán quyền cho vai trò. Admin có đủ quyền; user không có quyền quản trị.';
COMMENT ON COLUMN role_permissions.role_id IS 'Vai trò';
COMMENT ON COLUMN role_permissions.permission_id IS 'Quyền';
COMMENT ON COLUMN role_permissions.created_at IS 'Thời điểm gán';

COMMENT ON TABLE user_roles IS 'Gán vai trò cho người dùng (trigger tự gán vai trò user cho tài khoản mới)';
COMMENT ON COLUMN user_roles.user_id IS 'Người dùng';
COMMENT ON COLUMN user_roles.role_id IS 'Vai trò';
COMMENT ON COLUMN user_roles.created_at IS 'Thời điểm gán';

COMMENT ON TABLE password_resets IS 'Mã đặt lại mật khẩu (đã băm), dùng một lần';
COMMENT ON COLUMN password_resets.id IS 'Khóa chính';
COMMENT ON COLUMN password_resets.user_id IS 'Người dùng yêu cầu đặt lại';
COMMENT ON COLUMN password_resets.token_hash IS 'Mã đặt lại đã băm';
COMMENT ON COLUMN password_resets.expires_at IS 'Thời hạn hiệu lực';
COMMENT ON COLUMN password_resets.used_at IS 'Thời điểm đã sử dụng; NULL = chưa dùng';
COMMENT ON COLUMN password_resets.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE user_sessions IS 'Phiên đăng nhập (refresh token), cho phép đăng xuất từ xa';
COMMENT ON COLUMN user_sessions.id IS 'Khóa chính';
COMMENT ON COLUMN user_sessions.user_id IS 'Chủ phiên';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'Refresh token đã băm';
COMMENT ON COLUMN user_sessions.ip_address IS 'Địa chỉ IP khi đăng nhập';
COMMENT ON COLUMN user_sessions.user_agent IS 'User-Agent của trình duyệt/ứng dụng';
COMMENT ON COLUMN user_sessions.device_name IS 'Tên thiết bị';
COMMENT ON COLUMN user_sessions.expires_at IS 'Thời hạn phiên';
COMMENT ON COLUMN user_sessions.revoked_at IS 'Thời điểm thu hồi (đăng xuất); NULL = còn hiệu lực';
COMMENT ON COLUMN user_sessions.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE addresses IS 'Sổ địa chỉ giao hàng của user; mỗi user chỉ có một địa chỉ mặc định';
COMMENT ON COLUMN addresses.id IS 'Khóa chính';
COMMENT ON COLUMN addresses.user_id IS 'Chủ sổ địa chỉ';
COMMENT ON COLUMN addresses.recipient_name IS 'Tên người nhận';
COMMENT ON COLUMN addresses.phone IS 'Số điện thoại người nhận';
COMMENT ON COLUMN addresses.province IS 'Tỉnh/thành phố';
COMMENT ON COLUMN addresses.district IS 'Quận/huyện';
COMMENT ON COLUMN addresses.ward IS 'Phường/xã';
COMMENT ON COLUMN addresses.address_line IS 'Số nhà, tên đường';
COMMENT ON COLUMN addresses.is_default IS 'Địa chỉ mặc định (tối đa một mỗi user)';
COMMENT ON COLUMN addresses.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN addresses.updated_at IS 'Thời điểm cập nhật cuối';

-- ---- Nhóm 2 ----
COMMENT ON TABLE settings IS 'Cấu hình website dạng khóa - giá trị JSON';
COMMENT ON COLUMN settings.id IS 'Khóa chính';
COMMENT ON COLUMN settings.key IS 'Khóa cấu hình, duy nhất';
COMMENT ON COLUMN settings.value IS 'Giá trị (JSONB)';
COMMENT ON COLUMN settings.description IS 'Mô tả cấu hình';
COMMENT ON COLUMN settings.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN settings.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE media IS 'Kho tệp dùng chung: ảnh sản phẩm, ảnh danh mục, tệp mô hình 3D, ảnh AR, ảnh 360°';
COMMENT ON COLUMN media.id IS 'Khóa chính';
COMMENT ON COLUMN media.file_name IS 'Tên tệp gốc';
COMMENT ON COLUMN media.file_path IS 'Đường dẫn/khóa lưu trữ (duy nhất)';
COMMENT ON COLUMN media.mime_type IS 'Loại tệp (MIME)';
COMMENT ON COLUMN media.file_size IS 'Dung lượng (byte)';
COMMENT ON COLUMN media.alt_text IS 'Mô tả ảnh (SEO/trợ năng)';
COMMENT ON COLUMN media.uploaded_by IS 'Người tải lên';
COMMENT ON COLUMN media.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN media.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE notifications IS 'Thông báo gửi đến user';
COMMENT ON COLUMN notifications.id IS 'Khóa chính';
COMMENT ON COLUMN notifications.user_id IS 'Người nhận';
COMMENT ON COLUMN notifications.title IS 'Tiêu đề';
COMMENT ON COLUMN notifications.data IS 'Dữ liệu kèm theo (JSONB), ví dụ mã đơn hàng';
COMMENT ON COLUMN notifications.read_at IS 'Thời điểm đã đọc; NULL = chưa đọc';
COMMENT ON COLUMN notifications.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE activity_logs IS 'Nhật ký thao tác của quản trị viên (chỉ admin)';
COMMENT ON COLUMN activity_logs.id IS 'Khóa chính';
COMMENT ON COLUMN activity_logs.actor_id IS 'Admin thực hiện';
COMMENT ON COLUMN activity_logs.action IS 'Thao tác, ví dụ product.update';
COMMENT ON COLUMN activity_logs.target_type IS 'Loại đối tượng bị tác động (tên bảng)';
COMMENT ON COLUMN activity_logs.target_id IS 'Id đối tượng bị tác động';
COMMENT ON COLUMN activity_logs.changes IS 'Nội dung thay đổi (JSONB: trước/sau)';
COMMENT ON COLUMN activity_logs.ip_address IS 'Địa chỉ IP';
COMMENT ON COLUMN activity_logs.created_at IS 'Thời điểm thực hiện';

-- ---- Nhóm 3 ----
COMMENT ON TABLE categories IS 'Danh mục sản phẩm nhiều cấp (tự tham chiếu parent_id)';
COMMENT ON COLUMN categories.id IS 'Khóa chính';
COMMENT ON COLUMN categories.parent_id IS 'Danh mục cha; NULL = danh mục gốc';
COMMENT ON COLUMN categories.name IS 'Tên danh mục';
COMMENT ON COLUMN categories.slug IS 'Đường dẫn thân thiện, duy nhất';
COMMENT ON COLUMN categories.image_media_id IS 'Ảnh danh mục';
COMMENT ON COLUMN categories.sort_order IS 'Thứ tự hiển thị';
COMMENT ON COLUMN categories.is_active IS 'Bật/tắt hiển thị';
COMMENT ON COLUMN categories.meta_title IS 'SEO: tiêu đề';
COMMENT ON COLUMN categories.meta_description IS 'SEO: mô tả';
COMMENT ON COLUMN categories.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN categories.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE pages IS 'Trang tĩnh (Giới thiệu, Chính sách đổi trả, Hướng dẫn mua hàng...)';
COMMENT ON COLUMN pages.id IS 'Khóa chính';
COMMENT ON COLUMN pages.title IS 'Tiêu đề trang';
COMMENT ON COLUMN pages.slug IS 'Đường dẫn thân thiện, duy nhất';
COMMENT ON COLUMN pages.content IS 'Nội dung (HTML/Markdown)';
COMMENT ON COLUMN pages.status IS 'Trạng thái: draft, published, archived';
COMMENT ON COLUMN pages.meta_title IS 'SEO: tiêu đề';
COMMENT ON COLUMN pages.meta_description IS 'SEO: mô tả';
COMMENT ON COLUMN pages.published_at IS 'Thời điểm đăng';
COMMENT ON COLUMN pages.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN pages.updated_at IS 'Thời điểm cập nhật cuối';

-- ---- Nhóm 4 ----
COMMENT ON TABLE brands IS 'Thương hiệu sản phẩm';
COMMENT ON COLUMN brands.id IS 'Khóa chính';
COMMENT ON COLUMN brands.name IS 'Tên thương hiệu';
COMMENT ON COLUMN brands.slug IS 'Đường dẫn thân thiện, duy nhất';
COMMENT ON COLUMN brands.logo_media_id IS 'Logo';
COMMENT ON COLUMN brands.is_active IS 'Bật/tắt hiển thị';
COMMENT ON COLUMN brands.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN brands.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE products IS 'Thông tin chung của sản phẩm; hỗ trợ xóa mềm và tìm kiếm gần đúng theo tên';
COMMENT ON COLUMN products.id IS 'Khóa chính';
COMMENT ON COLUMN products.name IS 'Tên sản phẩm';
COMMENT ON COLUMN products.slug IS 'Đường dẫn thân thiện, duy nhất';
COMMENT ON COLUMN products.short_description IS 'Mô tả ngắn';
COMMENT ON COLUMN products.description IS 'Mô tả chi tiết';
COMMENT ON COLUMN products.category_id IS 'Danh mục';
COMMENT ON COLUMN products.brand_id IS 'Thương hiệu';
COMMENT ON COLUMN products.status IS 'Trạng thái: draft, published, archived';
COMMENT ON COLUMN products.is_featured IS 'Sản phẩm nổi bật';
COMMENT ON COLUMN products.rating_avg IS 'Điểm đánh giá trung bình (trigger tự tính từ review đã duyệt)';
COMMENT ON COLUMN products.rating_count IS 'Số lượt đánh giá đã duyệt (trigger tự tính)';
COMMENT ON COLUMN products.sold_count IS 'Số lượng đã bán (Service cập nhật trong transaction)';
COMMENT ON COLUMN products.has_3d_model IS 'Có mô hình 3D ở trạng thái ready (trigger tự cập nhật)';
COMMENT ON COLUMN products.has_ar IS 'Hỗ trợ AR: có mô hình ready với đủ file GLB và USDZ (trigger tự cập nhật)';
COMMENT ON COLUMN products.meta_title IS 'SEO: tiêu đề';
COMMENT ON COLUMN products.meta_description IS 'SEO: mô tả';
COMMENT ON COLUMN products.deleted_at IS 'Thời điểm xóa mềm';
COMMENT ON COLUMN products.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN products.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE attributes IS 'Loại thuộc tính sản phẩm (Màu sắc, Kích thước, Chất liệu)';
COMMENT ON COLUMN attributes.id IS 'Khóa chính';
COMMENT ON COLUMN attributes.code IS 'Mã thuộc tính, duy nhất';
COMMENT ON COLUMN attributes.name IS 'Tên thuộc tính, duy nhất';
COMMENT ON COLUMN attributes.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN attributes.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE attribute_values IS 'Giá trị cụ thể của thuộc tính (Đỏ, XL, Gỗ sồi...)';
COMMENT ON COLUMN attribute_values.id IS 'Khóa chính';
COMMENT ON COLUMN attribute_values.attribute_id IS 'Thuộc tính cha';
COMMENT ON COLUMN attribute_values.value IS 'Giá trị; duy nhất trong cùng thuộc tính';
COMMENT ON COLUMN attribute_values.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN attribute_values.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE product_variants IS 'Biến thể bán hàng: SKU, giá, giá khuyến mãi, tồn kho, cân nặng';
COMMENT ON COLUMN product_variants.id IS 'Khóa chính';
COMMENT ON COLUMN product_variants.product_id IS 'Sản phẩm';
COMMENT ON COLUMN product_variants.sku IS 'Mã SKU, duy nhất';
COMMENT ON COLUMN product_variants.price IS 'Giá gốc (VND)';
COMMENT ON COLUMN product_variants.sale_price IS 'Giá khuyến mãi; NULL = không khuyến mãi; không được lớn hơn giá gốc';
COMMENT ON COLUMN product_variants.stock_quantity IS 'Số lượng tồn kho (không âm)';
COMMENT ON COLUMN product_variants.weight_gram IS 'Cân nặng (gram)';
COMMENT ON COLUMN product_variants.is_active IS 'Còn bán hay không';
COMMENT ON COLUMN product_variants.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN product_variants.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE variant_attribute_values IS 'Liên kết biến thể với giá trị thuộc tính; mỗi biến thể chỉ một giá trị cho mỗi thuộc tính';
COMMENT ON COLUMN variant_attribute_values.variant_id IS 'Biến thể';
COMMENT ON COLUMN variant_attribute_values.attribute_value_id IS 'Giá trị thuộc tính';
COMMENT ON COLUMN variant_attribute_values.attribute_id IS 'Thuộc tính (khớp với giá trị nhờ khóa ngoại kép)';
COMMENT ON COLUMN variant_attribute_values.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE product_images IS 'Ảnh sản phẩm, có thể gắn riêng cho biến thể; mỗi sản phẩm một ảnh đại diện';
COMMENT ON COLUMN product_images.id IS 'Khóa chính';
COMMENT ON COLUMN product_images.product_id IS 'Sản phẩm';
COMMENT ON COLUMN product_images.variant_id IS 'Biến thể (nếu ảnh riêng cho biến thể)';
COMMENT ON COLUMN product_images.media_id IS 'Tệp ảnh';
COMMENT ON COLUMN product_images.sort_order IS 'Thứ tự hiển thị';
COMMENT ON COLUMN product_images.is_primary IS 'Ảnh đại diện (tối đa một mỗi sản phẩm)';
COMMENT ON COLUMN product_images.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN product_images.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE inventory_movements IS 'Lịch sử biến động tồn kho (nhập, bán, trả, điều chỉnh)';
COMMENT ON COLUMN inventory_movements.id IS 'Khóa chính';
COMMENT ON COLUMN inventory_movements.variant_id IS 'Biến thể';
COMMENT ON COLUMN inventory_movements.type IS 'Loại: import, sale, return, adjustment';
COMMENT ON COLUMN inventory_movements.quantity_change IS 'Số lượng thay đổi (+ nhập/trả, - xuất), khác 0';
COMMENT ON COLUMN inventory_movements.reason IS 'Lý do';
COMMENT ON COLUMN inventory_movements.reference_code IS 'Mã chứng từ liên quan (mã đơn, phiếu nhập)';
COMMENT ON COLUMN inventory_movements.performed_by IS 'Người thực hiện; NULL = hệ thống';
COMMENT ON COLUMN inventory_movements.created_at IS 'Thời điểm phát sinh';

COMMENT ON TABLE reviews IS 'Đánh giá sản phẩm 1-5 sao; cần duyệt mới hiển thị và tính vào điểm trung bình';
COMMENT ON COLUMN reviews.id IS 'Khóa chính';
COMMENT ON COLUMN reviews.user_id IS 'Người đánh giá';
COMMENT ON COLUMN reviews.product_id IS 'Sản phẩm';
COMMENT ON COLUMN reviews.order_id IS 'Đơn hàng đã mua (Service kiểm tra điều kiện đã mua)';
COMMENT ON COLUMN reviews.rating IS 'Số sao 1-5';
COMMENT ON COLUMN reviews.content IS 'Nội dung đánh giá';
COMMENT ON COLUMN reviews.status IS 'Trạng thái: pending, approved, rejected';
COMMENT ON COLUMN reviews.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN reviews.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE wishlists IS 'Sản phẩm yêu thích của user';
COMMENT ON COLUMN wishlists.id IS 'Khóa chính';
COMMENT ON COLUMN wishlists.user_id IS 'Người dùng';
COMMENT ON COLUMN wishlists.product_id IS 'Sản phẩm yêu thích';
COMMENT ON COLUMN wishlists.created_at IS 'Thời điểm thêm';

-- ---- Nhóm 5 ----
COMMENT ON TABLE product_3d_models IS 'Mô hình 3D của sản phẩm hoặc biến thể: kích thước thật, vị trí đặt AR, cấu hình trình xem';
COMMENT ON COLUMN product_3d_models.id IS 'Khóa chính';
COMMENT ON COLUMN product_3d_models.uuid IS 'Mã công khai';
COMMENT ON COLUMN product_3d_models.product_id IS 'Sản phẩm';
COMMENT ON COLUMN product_3d_models.variant_id IS 'Biến thể cụ thể (NULL = áp dụng cho cả sản phẩm)';
COMMENT ON COLUMN product_3d_models.length_mm IS 'Chiều dài thật (mm)';
COMMENT ON COLUMN product_3d_models.width_mm IS 'Chiều rộng thật (mm)';
COMMENT ON COLUMN product_3d_models.height_mm IS 'Chiều cao thật (mm)';
COMMENT ON COLUMN product_3d_models.placement IS 'Vị trí đặt trong AR: floor (sàn), wall (tường), table (mặt bàn)';
COMMENT ON COLUMN product_3d_models.allow_scaling IS 'Cho phép người xem đổi tỉ lệ trong AR';
COMMENT ON COLUMN product_3d_models.viewer_config IS 'Cấu hình trình xem 3D (JSONB): góc camera, tự xoay, ánh sáng, độ sáng';
COMMENT ON COLUMN product_3d_models.poster_media_id IS 'Ảnh chờ hiển thị khi đang tải mô hình';
COMMENT ON COLUMN product_3d_models.status IS 'Trạng thái xử lý: uploading, processing, ready, failed';
COMMENT ON COLUMN product_3d_models.version IS 'Phiên bản mô hình';
COMMENT ON COLUMN product_3d_models.is_primary IS 'Mô hình chính của sản phẩm (tối đa một)';
COMMENT ON COLUMN product_3d_models.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN product_3d_models.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE model_files IS 'Tệp thực tế của mô hình 3D: GLB (web/Android), USDZ (iPhone) theo 3 mức chi tiết';
COMMENT ON COLUMN model_files.id IS 'Khóa chính';
COMMENT ON COLUMN model_files.model_id IS 'Mô hình 3D';
COMMENT ON COLUMN model_files.format IS 'Định dạng: glb, usdz';
COMMENT ON COLUMN model_files.lod IS 'Mức chi tiết: high, medium, low';
COMMENT ON COLUMN model_files.media_id IS 'Tệp trong kho media';
COMMENT ON COLUMN model_files.polygon_count IS 'Số đa giác';
COMMENT ON COLUMN model_files.texture_resolution IS 'Độ phân giải texture (px, cạnh dài)';
COMMENT ON COLUMN model_files.is_compressed IS 'Đã nén (Draco/Meshopt...)';
COMMENT ON COLUMN model_files.checksum IS 'Mã kiểm tra tệp (SHA-256)';
COMMENT ON COLUMN model_files.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN model_files.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE model_material_variants IS 'Đổi màu/chất liệu trên cùng một mô hình 3D theo biến thể, không tải lại mô hình';
COMMENT ON COLUMN model_material_variants.id IS 'Khóa chính';
COMMENT ON COLUMN model_material_variants.model_id IS 'Mô hình 3D';
COMMENT ON COLUMN model_material_variants.variant_id IS 'Biến thể tương ứng';
COMMENT ON COLUMN model_material_variants.material_name IS 'Tên vật liệu trong mô hình cần đổi';
COMMENT ON COLUMN model_material_variants.config IS 'Cấu hình vật liệu (JSONB): màu, texture, độ nhám...';
COMMENT ON COLUMN model_material_variants.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN model_material_variants.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE ar_sessions IS 'Thống kê mỗi lượt xem 3D/AR của user và khách vãng lai';
COMMENT ON COLUMN ar_sessions.id IS 'Khóa chính';
COMMENT ON COLUMN ar_sessions.uuid IS 'Mã công khai của phiên';
COMMENT ON COLUMN ar_sessions.user_id IS 'User đã đăng nhập; NULL nếu là khách';
COMMENT ON COLUMN ar_sessions.visitor_id IS 'UUID ẩn danh do client tạo, dùng thống kê khách vãng lai';
COMMENT ON COLUMN ar_sessions.product_id IS 'Sản phẩm được xem';
COMMENT ON COLUMN ar_sessions.model_id IS 'Mô hình 3D được dùng';
COMMENT ON COLUMN ar_sessions.device IS 'Thiết bị';
COMMENT ON COLUMN ar_sessions.os IS 'Hệ điều hành';
COMMENT ON COLUMN ar_sessions.ar_platform IS 'Nền tảng AR (webxr, scene_viewer, quick_look...)';
COMMENT ON COLUMN ar_sessions.mode IS 'Chế độ: view_3d hoặc ar';
COMMENT ON COLUMN ar_sessions.duration_seconds IS 'Thời gian xem (giây)';
COMMENT ON COLUMN ar_sessions.placed IS 'Có đặt được sản phẩm vào không gian';
COMMENT ON COLUMN ar_sessions.captured IS 'Có chụp ảnh';
COMMENT ON COLUMN ar_sessions.added_to_cart IS 'Có thêm vào giỏ sau đó';
COMMENT ON COLUMN ar_sessions.created_at IS 'Thời điểm bắt đầu phiên';
COMMENT ON COLUMN ar_sessions.updated_at IS 'Thời điểm cập nhật cuối (trigger tự cập nhật)';

COMMENT ON TABLE ar_snapshots IS 'Ảnh user (đã đăng nhập) chụp khi đặt sản phẩm vào không gian thật bằng AR';
COMMENT ON COLUMN ar_snapshots.id IS 'Khóa chính';
COMMENT ON COLUMN ar_snapshots.user_id IS 'Người chụp';
COMMENT ON COLUMN ar_snapshots.product_id IS 'Sản phẩm';
COMMENT ON COLUMN ar_snapshots.ar_session_id IS 'Phiên AR phát sinh ảnh';
COMMENT ON COLUMN ar_snapshots.media_id IS 'Tệp ảnh';
COMMENT ON COLUMN ar_snapshots.is_public IS 'Công khai trong mục "Khách hàng đã trải nghiệm"';
COMMENT ON COLUMN ar_snapshots.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN ar_snapshots.updated_at IS 'Thời điểm cập nhật cuối';

-- ---- Nhóm 6 ----
COMMENT ON TABLE carts IS 'Giỏ hàng của user đã đăng nhập (mỗi user một giỏ; không có giỏ cho khách)';
COMMENT ON COLUMN carts.id IS 'Khóa chính';
COMMENT ON COLUMN carts.user_id IS 'Chủ giỏ hàng (duy nhất)';
COMMENT ON COLUMN carts.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN carts.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE cart_items IS 'Sản phẩm (theo biến thể) và số lượng trong giỏ';
COMMENT ON COLUMN cart_items.id IS 'Khóa chính';
COMMENT ON COLUMN cart_items.cart_id IS 'Giỏ hàng';
COMMENT ON COLUMN cart_items.variant_id IS 'Biến thể';
COMMENT ON COLUMN cart_items.quantity IS 'Số lượng (> 0)';
COMMENT ON COLUMN cart_items.created_at IS 'Thời điểm thêm';
COMMENT ON COLUMN cart_items.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE coupons IS 'Mã giảm giá theo phần trăm hoặc số tiền cố định; chỉ user đã đăng nhập được áp';
COMMENT ON COLUMN coupons.id IS 'Khóa chính';
COMMENT ON COLUMN coupons.code IS 'Mã giảm giá, không phân biệt hoa thường';
COMMENT ON COLUMN coupons.type IS 'Loại: percent hoặc fixed';
COMMENT ON COLUMN coupons.value IS 'Giá trị giảm (percent: 0-100; fixed: số tiền)';
COMMENT ON COLUMN coupons.max_discount IS 'Mức giảm tối đa (áp cho loại percent)';
COMMENT ON COLUMN coupons.min_order_value IS 'Giá trị đơn hàng tối thiểu để áp mã';
COMMENT ON COLUMN coupons.usage_limit IS 'Tổng số lượt dùng tối đa; NULL = không giới hạn';
COMMENT ON COLUMN coupons.per_user_limit IS 'Số lượt tối đa cho mỗi user; NULL = không giới hạn';
COMMENT ON COLUMN coupons.used_count IS 'Số lượt đã dùng (Service cập nhật)';
COMMENT ON COLUMN coupons.starts_at IS 'Bắt đầu hiệu lực';
COMMENT ON COLUMN coupons.ends_at IS 'Hết hiệu lực; NULL = không hết hạn';
COMMENT ON COLUMN coupons.is_active IS 'Bật/tắt mã';
COMMENT ON COLUMN coupons.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN coupons.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE orders IS 'Đơn hàng; thông tin người nhận lưu dạng bản chụp tại thời điểm đặt';
COMMENT ON COLUMN orders.id IS 'Khóa chính';
COMMENT ON COLUMN orders.uuid IS 'Mã công khai';
COMMENT ON COLUMN orders.order_code IS 'Mã đơn hàng hiển thị cho khách, duy nhất';
COMMENT ON COLUMN orders.user_id IS 'Người đặt hàng';
COMMENT ON COLUMN orders.status IS 'Trạng thái: pending, confirmed, processing, shipping, completed, cancelled, refunded';
COMMENT ON COLUMN orders.recipient_name IS 'Tên người nhận (bản chụp)';
COMMENT ON COLUMN orders.recipient_phone IS 'Số điện thoại người nhận (bản chụp)';
COMMENT ON COLUMN orders.shipping_province IS 'Tỉnh/thành giao hàng (bản chụp)';
COMMENT ON COLUMN orders.shipping_district IS 'Quận/huyện giao hàng (bản chụp)';
COMMENT ON COLUMN orders.shipping_ward IS 'Phường/xã giao hàng (bản chụp)';
COMMENT ON COLUMN orders.shipping_address IS 'Số nhà, tên đường giao hàng (bản chụp)';
COMMENT ON COLUMN orders.subtotal IS 'Tạm tính (tổng thành tiền các dòng hàng)';
COMMENT ON COLUMN orders.discount_amount IS 'Số tiền giảm giá';
COMMENT ON COLUMN orders.shipping_fee IS 'Phí vận chuyển';
COMMENT ON COLUMN orders.total IS 'Tổng tiền = subtotal - discount_amount + shipping_fee (CSDL tự kiểm tra)';
COMMENT ON COLUMN orders.coupon_id IS 'Mã giảm giá đã áp';
COMMENT ON COLUMN orders.payment_method IS 'Phương thức thanh toán';
COMMENT ON COLUMN orders.payment_status IS 'Trạng thái thanh toán: unpaid, paid, refunded, failed';
COMMENT ON COLUMN orders.note IS 'Ghi chú của khách';
COMMENT ON COLUMN orders.cancel_reason IS 'Lý do hủy';
COMMENT ON COLUMN orders.created_at IS 'Thời điểm đặt hàng';
COMMENT ON COLUMN orders.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE coupon_usages IS 'Mỗi lần dùng mã giảm giá (user nào, đơn nào) để kiểm soát giới hạn lượt dùng';
COMMENT ON COLUMN coupon_usages.id IS 'Khóa chính';
COMMENT ON COLUMN coupon_usages.coupon_id IS 'Mã giảm giá';
COMMENT ON COLUMN coupon_usages.user_id IS 'Người dùng đã áp mã';
COMMENT ON COLUMN coupon_usages.order_id IS 'Đơn hàng áp mã';
COMMENT ON COLUMN coupon_usages.created_at IS 'Thời điểm dùng';

COMMENT ON TABLE order_items IS 'Chi tiết dòng hàng; lưu tên, SKU, đơn giá tại thời điểm mua';
COMMENT ON COLUMN order_items.id IS 'Khóa chính';
COMMENT ON COLUMN order_items.order_id IS 'Đơn hàng';
COMMENT ON COLUMN order_items.variant_id IS 'Biến thể (NULL nếu biến thể đã bị xóa)';
COMMENT ON COLUMN order_items.product_name IS 'Tên sản phẩm lúc mua';
COMMENT ON COLUMN order_items.sku IS 'SKU lúc mua';
COMMENT ON COLUMN order_items.unit_price IS 'Đơn giá lúc mua';
COMMENT ON COLUMN order_items.quantity IS 'Số lượng (> 0)';
COMMENT ON COLUMN order_items.line_total IS 'Thành tiền = unit_price * quantity (CSDL tự tính)';
COMMENT ON COLUMN order_items.created_at IS 'Thời điểm tạo';

COMMENT ON TABLE order_status_history IS 'Lịch sử đổi trạng thái đơn hàng (trigger tự ghi)';
COMMENT ON COLUMN order_status_history.id IS 'Khóa chính';
COMMENT ON COLUMN order_status_history.order_id IS 'Đơn hàng';
COMMENT ON COLUMN order_status_history.from_status IS 'Trạng thái cũ; NULL ở dòng khởi tạo';
COMMENT ON COLUMN order_status_history.to_status IS 'Trạng thái mới';
COMMENT ON COLUMN order_status_history.changed_by IS 'Người thay đổi (lấy từ biến phiên app.current_user_id); NULL = hệ thống';
COMMENT ON COLUMN order_status_history.note IS 'Ghi chú';
COMMENT ON COLUMN order_status_history.created_at IS 'Thời điểm thay đổi';

COMMENT ON TABLE payments IS 'Giao dịch thanh toán của đơn hàng';
COMMENT ON COLUMN payments.id IS 'Khóa chính';
COMMENT ON COLUMN payments.order_id IS 'Đơn hàng';
COMMENT ON COLUMN payments.method IS 'Phương thức: cod, bank_transfer, momo, vnpay, zalopay, card';
COMMENT ON COLUMN payments.amount IS 'Số tiền';
COMMENT ON COLUMN payments.status IS 'Trạng thái giao dịch: pending, success, failed, refunded';
COMMENT ON COLUMN payments.transaction_code IS 'Mã giao dịch từ cổng thanh toán (duy nhất, có thể NULL)';
COMMENT ON COLUMN payments.gateway_response IS 'Dữ liệu phản hồi của cổng thanh toán (JSONB)';
COMMENT ON COLUMN payments.paid_at IS 'Thời điểm thanh toán thành công';
COMMENT ON COLUMN payments.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN payments.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE shipments IS 'Thông tin vận chuyển của đơn hàng';
COMMENT ON COLUMN shipments.id IS 'Khóa chính';
COMMENT ON COLUMN shipments.order_id IS 'Đơn hàng';
COMMENT ON COLUMN shipments.carrier IS 'Đơn vị vận chuyển: ghn, ghtk, viettel_post, other';
COMMENT ON COLUMN shipments.tracking_code IS 'Mã vận đơn';
COMMENT ON COLUMN shipments.status IS 'Trạng thái: pending, picked_up, in_transit, delivered, failed, returned';
COMMENT ON COLUMN shipments.fee IS 'Phí vận chuyển';
COMMENT ON COLUMN shipments.shipped_at IS 'Thời điểm gửi hàng';
COMMENT ON COLUMN shipments.delivered_at IS 'Thời điểm giao thành công';
COMMENT ON COLUMN shipments.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN shipments.updated_at IS 'Thời điểm cập nhật cuối';

-- ---- Nhóm 7 ----
COMMENT ON TABLE spaces IS 'Không gian mẫu hoàn chỉnh (ví dụ "Phòng khách tối giản 20m²"); tìm kiếm không dấu theo title';
COMMENT ON COLUMN spaces.id IS 'Khóa chính';
COMMENT ON COLUMN spaces.uuid IS 'Mã công khai';
COMMENT ON COLUMN spaces.title IS 'Tên không gian';
COMMENT ON COLUMN spaces.slug IS 'Đường dẫn thân thiện, duy nhất';
COMMENT ON COLUMN spaces.description IS 'Mô tả';
COMMENT ON COLUMN spaces.room_type IS 'Loại phòng: living_room, bedroom, kitchen, dining_room, bathroom, office, other';
COMMENT ON COLUMN spaces.style IS 'Phong cách (ví dụ Scandinavian)';
COMMENT ON COLUMN spaces.category_id IS 'Danh mục/bộ sưu tập';
COMMENT ON COLUMN spaces.cover_media_id IS 'Ảnh bìa';
COMMENT ON COLUMN spaces.status IS 'Trạng thái: draft, published, archived';
COMMENT ON COLUMN spaces.view_count IS 'Số lượt xem (trigger tự tăng khi có space_views)';
COMMENT ON COLUMN spaces.published_at IS 'Thời điểm đăng';
COMMENT ON COLUMN spaces.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN spaces.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE space_panoramas IS 'Ảnh 360° của không gian mẫu; mỗi không gian có đúng một ảnh mở đầu';
COMMENT ON COLUMN space_panoramas.id IS 'Khóa chính';
COMMENT ON COLUMN space_panoramas.space_id IS 'Không gian mẫu';
COMMENT ON COLUMN space_panoramas.media_id IS 'Tệp ảnh 360°';
COMMENT ON COLUMN space_panoramas.title IS 'Tiêu đề (tên phòng/góc nhìn)';
COMMENT ON COLUMN space_panoramas.default_yaw IS 'Góc ngang mặc định khi mở (độ)';
COMMENT ON COLUMN space_panoramas.default_pitch IS 'Góc dọc mặc định khi mở (độ)';
COMMENT ON COLUMN space_panoramas.default_fov IS 'Độ rộng khung nhìn mặc định (độ)';
COMMENT ON COLUMN space_panoramas.sort_order IS 'Thứ tự trong tour';
COMMENT ON COLUMN space_panoramas.is_start IS 'Ảnh mở đầu tour (tối đa một mỗi không gian)';
COMMENT ON COLUMN space_panoramas.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN space_panoramas.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE space_hotspots IS 'Điểm bấm tương tác trên ảnh 360°: product, navigation, info (CSDL kiểm tra dữ liệu khớp theo loại)';
COMMENT ON COLUMN space_hotspots.id IS 'Khóa chính';
COMMENT ON COLUMN space_hotspots.panorama_id IS 'Ảnh 360° chứa điểm bấm';
COMMENT ON COLUMN space_hotspots.type IS 'Loại: product (mở sản phẩm), navigation (chuyển ảnh), info (ghi chú)';
COMMENT ON COLUMN space_hotspots.yaw IS 'Vị trí góc ngang (độ)';
COMMENT ON COLUMN space_hotspots.pitch IS 'Vị trí góc dọc (độ)';
COMMENT ON COLUMN space_hotspots.product_id IS 'Sản phẩm (bắt buộc với loại product)';
COMMENT ON COLUMN space_hotspots.target_panorama_id IS 'Ảnh 360° đích (bắt buộc với loại navigation)';
COMMENT ON COLUMN space_hotspots.title IS 'Tiêu đề điểm bấm';
COMMENT ON COLUMN space_hotspots.content IS 'Nội dung ghi chú (bắt buộc với loại info)';
COMMENT ON COLUMN space_hotspots.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN space_hotspots.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE space_product_placements IS 'Đặt mô hình 3D thật của sản phẩm vào ảnh 360° với đúng phối cảnh';
COMMENT ON COLUMN space_product_placements.id IS 'Khóa chính';
COMMENT ON COLUMN space_product_placements.panorama_id IS 'Ảnh 360°';
COMMENT ON COLUMN space_product_placements.product_id IS 'Sản phẩm được đặt';
COMMENT ON COLUMN space_product_placements.variant_id IS 'Biến thể (tùy chọn)';
COMMENT ON COLUMN space_product_placements.model_id IS 'Mô hình cụ thể; NULL = dùng mô hình chính của sản phẩm';
COMMENT ON COLUMN space_product_placements.yaw IS 'Vị trí góc ngang (độ)';
COMMENT ON COLUMN space_product_placements.pitch IS 'Vị trí góc dọc (độ)';
COMMENT ON COLUMN space_product_placements.distance IS 'Khoảng cách tới camera (mét), dùng tính kích thước hiển thị đúng tỉ lệ';
COMMENT ON COLUMN space_product_placements.rotation_x IS 'Góc xoay quanh trục X (độ)';
COMMENT ON COLUMN space_product_placements.rotation_y IS 'Góc xoay quanh trục Y (độ)';
COMMENT ON COLUMN space_product_placements.rotation_z IS 'Góc xoay quanh trục Z (độ)';
COMMENT ON COLUMN space_product_placements.scale IS 'Tỉ lệ (> 0)';
COMMENT ON COLUMN space_product_placements.created_at IS 'Thời điểm tạo';
COMMENT ON COLUMN space_product_placements.updated_at IS 'Thời điểm cập nhật cuối';

COMMENT ON TABLE space_bookmarks IS 'Không gian mẫu yêu thích của user';
COMMENT ON COLUMN space_bookmarks.id IS 'Khóa chính';
COMMENT ON COLUMN space_bookmarks.user_id IS 'Người dùng';
COMMENT ON COLUMN space_bookmarks.space_id IS 'Không gian mẫu';
COMMENT ON COLUMN space_bookmarks.created_at IS 'Thời điểm lưu';

COMMENT ON TABLE space_views IS 'Mỗi lượt xem không gian mẫu (user hoặc khách vãng lai) để đo hiệu quả bán hàng';
COMMENT ON COLUMN space_views.id IS 'Khóa chính';
COMMENT ON COLUMN space_views.space_id IS 'Không gian mẫu được xem';
COMMENT ON COLUMN space_views.user_id IS 'User đã đăng nhập; NULL nếu là khách';
COMMENT ON COLUMN space_views.visitor_id IS 'UUID ẩn danh do client tạo, dùng thống kê khách vãng lai';
COMMENT ON COLUMN space_views.source_product_id IS 'Sản phẩm mà người xem đi từ đó vào không gian mẫu';
COMMENT ON COLUMN space_views.hotspot_click_count IS 'Số lần bấm điểm tương tác';
COMMENT ON COLUMN space_views.added_to_cart IS 'Có thêm sản phẩm vào giỏ trong lượt xem';
COMMENT ON COLUMN space_views.created_at IS 'Thời điểm xem';

-- ===== 04_constraints_indexes.sql =====
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

-- ===== 05_functions_triggers.sql =====
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
