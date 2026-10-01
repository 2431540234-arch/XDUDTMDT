-- =====================================================================
--  SCHEMA POSTGRESQL HOÀN CHỈNH: WEBSITE BÁN HÀNG + XEM 3D/AR + KHÔNG GIAN MẪU
--  Yêu cầu: PostgreSQL 13+ (gen_random_uuid() có sẵn trong core từ PG13)
--  Chạy: psql -U postgres -d ten_db -f schema.sql
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;     -- email không phân biệt hoa thường
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- tìm kiếm gần đúng theo tên
CREATE EXTENSION IF NOT EXISTS unaccent;   -- bỏ dấu tiếng Việt khi tìm kiếm

-- unaccent() gốc là STABLE nên không dùng được trong index -> bọc lại IMMUTABLE
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- ---------------------------------------------------------------------
--  KIỂU ENUM
-- ---------------------------------------------------------------------
CREATE TYPE user_status     AS ENUM ('active', 'inactive', 'banned');
CREATE TYPE publish_status  AS ENUM ('draft', 'published', 'archived');
CREATE TYPE comment_status  AS ENUM ('pending', 'approved', 'spam');
CREATE TYPE order_status    AS ENUM ('pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded');
CREATE TYPE payment_status  AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method  AS ENUM ('cod', 'bank_transfer', 'momo', 'vnpay', 'zalopay', 'card');
CREATE TYPE shipment_status AS ENUM ('pending', 'picked_up', 'in_transit', 'delivered', 'returned');
CREATE TYPE discount_type   AS ENUM ('percent', 'fixed');
-- 3D / AR
CREATE TYPE model_format    AS ENUM ('glb', 'gltf', 'usdz', 'reality', 'fbx', 'obj');
CREATE TYPE model_lod       AS ENUM ('high', 'medium', 'low');          -- mức chi tiết
CREATE TYPE model_status    AS ENUM ('uploading', 'processing', 'ready', 'failed');
CREATE TYPE ar_placement    AS ENUM ('floor', 'wall', 'table', 'any');  -- đặt lên sàn, tường, mặt bàn
CREATE TYPE ar_platform     AS ENUM ('webxr', 'scene_viewer', 'quick_look', 'arcore', 'arkit');
-- Không gian mẫu / panorama 360°
CREATE TYPE space_room_type     AS ENUM ('living_room', 'bedroom', 'kitchen', 'dining_room', 'office', 'kids_room', 'outdoor', 'other');
CREATE TYPE space_hotspot_type  AS ENUM ('product', 'navigation', 'info');

-- ---------------------------------------------------------------------
--  HÀM TỰ CẬP NHẬT updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
--  1. NGƯỜI DÙNG & PHÂN QUYỀN
-- =====================================================================
CREATE TABLE users (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         VARCHAR(150) NOT NULL,
  email             CITEXT       NOT NULL UNIQUE,
  phone             VARCHAR(20)  UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  avatar_url        TEXT,
  status            user_status  NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  NOT NULL UNIQUE,   -- admin, editor, customer
  name        VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE permissions (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,          -- product.create, order.view...
  name VARCHAR(150) NOT NULL
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ  NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name VARCHAR(150) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  province       VARCHAR(100) NOT NULL,
  district       VARCHAR(100),
  ward           VARCHAR(100),
  street         VARCHAR(255) NOT NULL,
  is_default     BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Mỗi người chỉ có 1 địa chỉ mặc định
CREATE UNIQUE INDEX uq_addresses_default ON addresses(user_id) WHERE is_default;

-- =====================================================================
--  2. HỆ THỐNG CHUNG
-- =====================================================================
CREATE TABLE settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   VARCHAR(255) NOT NULL,
  path        TEXT         NOT NULL,
  mime_type   VARCHAR(100) NOT NULL,
  size_bytes  BIGINT       NOT NULL CHECK (size_bytes >= 0),
  alt_text    VARCHAR(255),
  uploaded_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  data       JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,          -- order.update_status...
  target_type VARCHAR(50),
  target_id   UUID,
  changes     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_target ON activity_logs(target_type, target_id);

-- =====================================================================
--  3. NỘI DUNG: DANH MỤC, TRANG TĨNH
-- =====================================================================
-- Danh mục dùng chung cho sản phẩm và không gian mẫu (type phân biệt)
CREATE TABLE categories (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        UUID         REFERENCES categories(id) ON DELETE SET NULL,
  type             VARCHAR(20)  NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'space')),
  name             VARCHAR(150) NOT NULL,
  slug             VARCHAR(180) NOT NULL,
  description      TEXT,
  image_id         UUID         REFERENCES media(id) ON DELETE SET NULL,
  sort_order       INT          NOT NULL DEFAULT 0,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE pages (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255)   NOT NULL,
  slug             VARCHAR(280)   NOT NULL UNIQUE,   -- gioi-thieu, chinh-sach-doi-tra
  content          TEXT           NOT NULL,
  status           publish_status NOT NULL DEFAULT 'draft',
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- =====================================================================
--  4. SẢN PHẨM
-- =====================================================================
CREATE TABLE brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL,
  slug       VARCHAR(180) NOT NULL UNIQUE,
  logo_id    UUID         REFERENCES media(id) ON DELETE SET NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID           REFERENCES categories(id) ON DELETE SET NULL,
  brand_id          UUID           REFERENCES brands(id) ON DELETE SET NULL,
  name              VARCHAR(255)   NOT NULL,
  slug              VARCHAR(280)   NOT NULL UNIQUE,
  short_description TEXT,
  description       TEXT,
  status            publish_status NOT NULL DEFAULT 'draft',
  is_featured       BOOLEAN        NOT NULL DEFAULT false,
  has_3d            BOOLEAN        NOT NULL DEFAULT false,   -- tự cập nhật bằng trigger
  ar_enabled        BOOLEAN        NOT NULL DEFAULT false,   -- tự cập nhật bằng trigger
  rating_avg        NUMERIC(3,2)   NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  rating_count      INT            NOT NULL DEFAULT 0,
  sold_count        INT            NOT NULL DEFAULT 0,
  meta_title        VARCHAR(255),
  meta_description  VARCHAR(500),
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_brand    ON products(brand_id);
-- Tìm kiếm gần đúng + không dấu (vd: "ghe sofa" khớp "ghế sofa")
CREATE INDEX idx_products_name_trgm ON products USING gin (f_unaccent(lower(name)) gin_trgm_ops);

-- Thuộc tính (Màu, Size...) và giá trị (Đỏ, XL...)
CREATE TABLE attributes (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE attribute_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID         NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value        VARCHAR(100) NOT NULL,
  UNIQUE (attribute_id, value)
);

-- Mọi sản phẩm có ít nhất 1 biến thể; giá và tồn kho nằm ở đây
CREATE TABLE product_variants (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku            VARCHAR(100)  NOT NULL UNIQUE,
  price          NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  sale_price     NUMERIC(14,2) CHECK (sale_price >= 0),
  stock_quantity INT           NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  weight_grams   INT           CHECK (weight_grams >= 0),
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (sale_price IS NULL OR sale_price <= price)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

CREATE TABLE variant_attribute_values (
  variant_id         UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,
  PRIMARY KEY (variant_id, attribute_value_id)
);

CREATE TABLE product_images (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID    REFERENCES product_variants(id) ON DELETE CASCADE,
  media_id   UUID    NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INT     NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX uq_product_primary_image ON product_images(product_id) WHERE is_primary;

-- =====================================================================
--  4b. MÔ HÌNH 3D & AR
-- =====================================================================
-- Một "mô hình" logic của sản phẩm (hoặc của 1 biến thể cụ thể, vd: ghế màu đỏ)
CREATE TABLE product_3d_models (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id        UUID         REFERENCES product_variants(id) ON DELETE CASCADE, -- NULL = dùng chung mọi biến thể
  name              VARCHAR(255) NOT NULL,
  status            model_status NOT NULL DEFAULT 'uploading',
  version           INT          NOT NULL DEFAULT 1,
  is_primary        BOOLEAN      NOT NULL DEFAULT false,
  -- Kích thước thật (mm) để AR hiển thị đúng tỉ lệ 1:1 ngoài đời
  real_width_mm     NUMERIC(10,2) NOT NULL CHECK (real_width_mm  > 0),
  real_height_mm    NUMERIC(10,2) NOT NULL CHECK (real_height_mm > 0),
  real_depth_mm     NUMERIC(10,2) NOT NULL CHECK (real_depth_mm  > 0),
  -- Cấu hình AR
  ar_enabled        BOOLEAN      NOT NULL DEFAULT true,
  ar_placement      ar_placement NOT NULL DEFAULT 'floor',
  ar_allow_scaling  BOOLEAN      NOT NULL DEFAULT false,  -- false = khóa tỉ lệ thật
  -- Cấu hình trình xem 3D trên web
  poster_media_id   UUID         REFERENCES media(id) ON DELETE SET NULL,  -- ảnh chờ khi đang tải model
  camera_orbit      VARCHAR(100),                       -- vd: '45deg 75deg 2.5m'
  auto_rotate       BOOLEAN      NOT NULL DEFAULT true,
  environment_image_id UUID      REFERENCES media(id) ON DELETE SET NULL,  -- ảnh HDR chiếu sáng
  exposure          NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  processing_error  TEXT,
  created_by        UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_3d_models_product ON product_3d_models(product_id);
-- Mỗi sản phẩm chỉ có 1 model chính
CREATE UNIQUE INDEX uq_3d_models_primary ON product_3d_models(product_id) WHERE is_primary;

-- Các file thật của 1 model: GLB cho web/Android, USDZ cho iPhone (AR Quick Look), nhiều mức chi tiết
CREATE TABLE model_files (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id           UUID         NOT NULL REFERENCES product_3d_models(id) ON DELETE CASCADE,
  media_id           UUID         NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  format             model_format NOT NULL,
  lod                model_lod    NOT NULL DEFAULT 'high',
  polygon_count      INT          CHECK (polygon_count >= 0),
  texture_resolution INT          CHECK (texture_resolution > 0),  -- vd: 2048
  is_draco_compressed BOOLEAN     NOT NULL DEFAULT false,
  checksum_sha256    CHAR(64),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (model_id, format, lod)
);

-- Đổi màu/chất liệu ngay trên 1 model (glTF KHR_materials_variants)
-- thay vì tải model khác cho mỗi biến thể
CREATE TABLE model_material_variants (
  model_id      UUID         NOT NULL REFERENCES product_3d_models(id) ON DELETE CASCADE,
  variant_id    UUID         NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  material_name VARCHAR(100) NOT NULL,   -- tên material variant trong file glTF
  PRIMARY KEY (model_id, variant_id)
);

-- Thống kê lượt xem 3D / AR (để đo hiệu quả, vd: tỉ lệ thêm vào giỏ sau khi thử AR)
CREATE TABLE ar_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id         UUID        NOT NULL REFERENCES product_3d_models(id) ON DELETE CASCADE,
  product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_key      VARCHAR(100),           -- khách chưa đăng nhập
  mode             VARCHAR(10) NOT NULL CHECK (mode IN ('3d', 'ar')),
  platform         ar_platform,            -- chỉ có khi mode = 'ar'
  device_os        VARCHAR(30),            -- ios, android
  device_model     VARCHAR(100),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INT         CHECK (duration_seconds >= 0),
  object_placed    BOOLEAN     NOT NULL DEFAULT false,   -- đã đặt được vật lên mặt phẳng
  snapshot_taken   BOOLEAN     NOT NULL DEFAULT false,
  added_to_cart    BOOLEAN     NOT NULL DEFAULT false,
  CHECK (mode = '3d' OR platform IS NOT NULL)
);
CREATE INDEX idx_ar_sessions_product ON ar_sessions(product_id, started_at DESC);

-- Ảnh người dùng chụp khi đặt sản phẩm vào phòng bằng AR
CREATE TABLE ar_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_session_id UUID        REFERENCES ar_sessions(id) ON DELETE SET NULL,
  user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
  product_id    UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id      UUID        NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  is_public     BOOLEAN     NOT NULL DEFAULT false,   -- cho phép hiện trong mục "Khách hàng đã thử"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lịch sử nhập/xuất kho
CREATE TABLE inventory_movements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  change_qty  INT         NOT NULL,             -- dương: nhập, âm: xuất
  reason      VARCHAR(50) NOT NULL,             -- import, order, return, adjust
  reference_id UUID,                            -- vd: order_id
  note        TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_variant ON inventory_movements(variant_id, created_at DESC);

CREATE TABLE reviews (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id              UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_item_id        UUID,        -- FK thêm phía dưới (chỉ người đã mua mới đánh giá)
  rating               SMALLINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content              TEXT,
  status               comment_status NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id, order_item_id)
);

CREATE TABLE wishlists (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- =====================================================================
--  5. GIỎ HÀNG, KHUYẾN MÃI, ĐƠN HÀNG
-- =====================================================================
CREATE TABLE carts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(100) UNIQUE,              -- giỏ của khách chưa đăng nhập
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TABLE cart_items (
  cart_id    UUID        NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INT         NOT NULL CHECK (quantity > 0),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, variant_id)
);

CREATE TABLE coupons (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50)   NOT NULL UNIQUE,
  description      TEXT,
  discount_type    discount_type NOT NULL,
  discount_value   NUMERIC(14,2) NOT NULL CHECK (discount_value > 0),
  max_discount     NUMERIC(14,2),               -- trần giảm cho loại percent
  min_order_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  usage_limit      INT,                         -- tổng số lượt
  per_user_limit   INT           NOT NULL DEFAULT 1,
  used_count       INT           NOT NULL DEFAULT 0,
  starts_at        TIMESTAMPTZ   NOT NULL,
  ends_at          TIMESTAMPTZ   NOT NULL,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

CREATE TABLE orders (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code       VARCHAR(30)   NOT NULL UNIQUE,  -- mã hiển thị: DH20261001-0001
  user_id          UUID          REFERENCES users(id) ON DELETE SET NULL,
  coupon_id        UUID          REFERENCES coupons(id) ON DELETE SET NULL,
  status           order_status  NOT NULL DEFAULT 'pending',
  -- Snapshot thông tin giao hàng tại thời điểm đặt
  recipient_name   VARCHAR(150)  NOT NULL,
  recipient_phone  VARCHAR(20)   NOT NULL,
  recipient_email  CITEXT,
  shipping_address TEXT          NOT NULL,
  -- Tiền
  subtotal         NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  shipping_fee     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total_amount     NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  payment_method   payment_method NOT NULL,
  payment_status   payment_status NOT NULL DEFAULT 'pending',
  note             TEXT,
  cancelled_reason TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (total_amount = subtotal - discount_amount + shipping_fee)
);
CREATE INDEX idx_orders_user    ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status  ON orders(status, created_at DESC);

CREATE TABLE order_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id   UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
  -- Snapshot: giữ nguyên dù sản phẩm sau này bị sửa/xóa
  product_name VARCHAR(255)  NOT NULL,
  variant_name VARCHAR(255),
  sku          VARCHAR(100)  NOT NULL,
  unit_price   NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  quantity     INT           NOT NULL CHECK (quantity > 0),
  line_total   NUMERIC(14,2) GENERATED ALWAYS AS (unit_price * quantity) STORED
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_order_item
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;

CREATE TABLE coupon_usages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id  UUID        NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  order_id   UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_status_history (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status   order_status NOT NULL,
  note        TEXT,
  changed_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method         payment_method NOT NULL,
  amount         NUMERIC(14,2)  NOT NULL CHECK (amount >= 0),
  status         payment_status NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(150)   UNIQUE,         -- mã từ cổng thanh toán
  gateway_response JSONB,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE shipments (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier         VARCHAR(50)     NOT NULL,     -- GHN, GHTK, ViettelPost...
  tracking_number VARCHAR(100)    UNIQUE,
  status          shipment_status NOT NULL DEFAULT 'pending',
  fee             NUMERIC(14,2)   NOT NULL DEFAULT 0,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- =====================================================================
--  6. KHÔNG GIAN MẪU (SPACES) & PANORAMA 360°
--  "Shop the look": phòng mẫu dạng ảnh 360°, gắn hotspot sản phẩm,
--  cho phép đặt model 3D thật vào đúng vị trí trong ảnh panorama.
-- =====================================================================

-- Một không gian mẫu (vd: "Phòng khách tối giản 20m2")
CREATE TABLE spaces (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID            REFERENCES categories(id) ON DELETE SET NULL,
  name             VARCHAR(255)    NOT NULL,
  slug             VARCHAR(280)    NOT NULL UNIQUE,
  description      TEXT,
  room_type        space_room_type NOT NULL DEFAULT 'other',
  style            VARCHAR(100),                 -- vd: Scandinavian, Minimalist
  cover_media_id   UUID            REFERENCES media(id) ON DELETE SET NULL,
  status           publish_status  NOT NULL DEFAULT 'draft',
  is_featured      BOOLEAN         NOT NULL DEFAULT false,
  view_count       INT             NOT NULL DEFAULT 0,   -- tự cập nhật bằng trigger
  meta_title       VARCHAR(255),
  meta_description VARCHAR(500),
  created_by       UUID            REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX idx_spaces_room_type ON spaces(room_type);
CREATE INDEX idx_spaces_status    ON spaces(status);
CREATE INDEX idx_spaces_name_trgm ON spaces USING gin (f_unaccent(lower(name)) gin_trgm_ops);

-- Ảnh 360° (equirectangular) của không gian mẫu; 1 space có thể có nhiều ảnh (tour nhiều góc/phòng)
CREATE TABLE space_panoramas (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      UUID         NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  media_id      UUID         NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  title         VARCHAR(150),
  initial_yaw   NUMERIC(6,2) NOT NULL DEFAULT 0  CHECK (initial_yaw BETWEEN -180 AND 180),
  initial_pitch NUMERIC(6,2) NOT NULL DEFAULT 0  CHECK (initial_pitch BETWEEN -90 AND 90),
  initial_fov   NUMERIC(5,2) NOT NULL DEFAULT 75 CHECK (initial_fov BETWEEN 30 AND 120),
  sort_order    INT          NOT NULL DEFAULT 0,
  is_default    BOOLEAN      NOT NULL DEFAULT false,  -- ảnh mở đầu tiên khi vào space
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_space_panoramas_space ON space_panoramas(space_id);
CREATE UNIQUE INDEX uq_space_panoramas_default ON space_panoramas(space_id) WHERE is_default;

-- Điểm bấm trên ảnh 360°: xem sản phẩm, chuyển sang ảnh/phòng khác, hoặc ghi chú thông tin
CREATE TABLE space_hotspots (
  id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  panorama_id        UUID               NOT NULL REFERENCES space_panoramas(id) ON DELETE CASCADE,
  type               space_hotspot_type NOT NULL,
  yaw                NUMERIC(6,2)       NOT NULL CHECK (yaw BETWEEN -180 AND 180),
  pitch              NUMERIC(6,2)       NOT NULL CHECK (pitch BETWEEN -90 AND 90),
  product_id         UUID               REFERENCES products(id) ON DELETE CASCADE,
  target_panorama_id UUID               REFERENCES space_panoramas(id) ON DELETE SET NULL,
  label              VARCHAR(255),
  icon               VARCHAR(50),
  sort_order         INT                NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ        NOT NULL DEFAULT now(),
  CHECK (
    (type = 'product'    AND product_id IS NOT NULL AND target_panorama_id IS NULL) OR
    (type = 'navigation' AND target_panorama_id IS NOT NULL AND product_id IS NULL) OR
    (type = 'info'       AND product_id IS NULL AND target_panorama_id IS NULL)
  )
);
CREATE INDEX idx_space_hotspots_panorama ON space_hotspots(panorama_id);
CREATE INDEX idx_space_hotspots_product  ON space_hotspots(product_id) WHERE product_id IS NOT NULL;

-- Đặt model 3D thật của sản phẩm vào đúng vị trí trong ảnh panorama
-- (nâng cao hơn hotspot tĩnh: model hiển thị đúng góc xoay/scale theo vị trí đặt)
CREATE TABLE space_product_placements (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  panorama_id    UUID         NOT NULL REFERENCES space_panoramas(id) ON DELETE CASCADE,
  product_id     UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id     UUID         REFERENCES product_variants(id) ON DELETE SET NULL,
  model_id       UUID         REFERENCES product_3d_models(id) ON DELETE SET NULL, -- NULL = dùng model is_primary
  position_yaw   NUMERIC(6,2) NOT NULL CHECK (position_yaw BETWEEN -180 AND 180),
  position_pitch NUMERIC(6,2) NOT NULL CHECK (position_pitch BETWEEN -90 AND 90),
  distance_m     NUMERIC(6,2) NOT NULL DEFAULT 2.0 CHECK (distance_m > 0),  -- khoảng cách ước lượng để tính scale
  rotation_y     NUMERIC(6,2) NOT NULL DEFAULT 0,                          -- xoay vật thể quanh trục đứng
  scale          NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (scale > 0),
  sort_order     INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_space_placements_panorama ON space_product_placements(panorama_id);
CREATE INDEX idx_space_placements_product  ON space_product_placements(product_id);

-- Người dùng lưu không gian mẫu yêu thích
CREATE TABLE space_bookmarks (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id   UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, space_id)
);

-- Thống kê lượt xem không gian mẫu (cập nhật spaces.view_count + đo hiệu quả "shop the look")
CREATE TABLE space_views (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  panorama_id         UUID        REFERENCES space_panoramas(id) ON DELETE SET NULL,
  user_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_key         VARCHAR(100),                -- khách chưa đăng nhập
  referrer_product_id UUID        REFERENCES products(id) ON DELETE SET NULL,  -- vào từ trang sản phẩm nào
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds    INT         CHECK (duration_seconds >= 0),
  hotspot_clicks      INT         NOT NULL DEFAULT 0,
  added_to_cart       BOOLEAN     NOT NULL DEFAULT false
);
CREATE INDEX idx_space_views_space ON space_views(space_id, started_at DESC);

-- =====================================================================
--  TRIGGER updated_at CHO CÁC BẢNG CÓ CỘT updated_at
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- =====================================================================
--  TRIGGER: TỰ CẬP NHẬT ĐIỂM ĐÁNH GIÁ SẢN PHẨM
-- =====================================================================
CREATE OR REPLACE FUNCTION refresh_product_rating() RETURNS trigger AS $$
DECLARE pid UUID := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products p SET
    rating_avg   = COALESCE(r.avg, 0),
    rating_count = COALESCE(r.cnt, 0)
  FROM (
    SELECT ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS cnt
    FROM reviews WHERE product_id = pid AND status = 'approved'
  ) r
  WHERE p.id = pid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

-- =====================================================================
--  TRIGGER: TỰ BẬT/TẮT CỜ has_3d, ar_enabled CỦA SẢN PHẨM
--  has_3d     = có ít nhất 1 model ở trạng thái 'ready'
--  ar_enabled = có model 'ready' bật AR và có file GLB (Android/web)
--               hoặc USDZ (iPhone)
-- =====================================================================
CREATE OR REPLACE FUNCTION refresh_product_3d_flags_for(pid UUID) RETURNS void AS $$
BEGIN
  UPDATE products p SET
    has_3d = EXISTS (
      SELECT 1 FROM product_3d_models m
      WHERE m.product_id = pid AND m.status = 'ready'),
    ar_enabled = EXISTS (
      SELECT 1 FROM product_3d_models m
      JOIN model_files f ON f.model_id = m.id
      WHERE m.product_id = pid AND m.status = 'ready' AND m.ar_enabled
        AND f.format IN ('glb', 'usdz'))
  WHERE p.id = pid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_models_refresh_flags() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_product_3d_flags_for(COALESCE(NEW.product_id, OLD.product_id));
  IF TG_OP = 'UPDATE' AND NEW.product_id <> OLD.product_id THEN
    PERFORM refresh_product_3d_flags_for(OLD.product_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_3d_models_flags
AFTER INSERT OR UPDATE OR DELETE ON product_3d_models
FOR EACH ROW EXECUTE FUNCTION trg_models_refresh_flags();

CREATE OR REPLACE FUNCTION trg_model_files_refresh_flags() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_product_3d_flags_for(m.product_id)
  FROM product_3d_models m WHERE m.id = COALESCE(NEW.model_id, OLD.model_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_model_files_flags
AFTER INSERT OR UPDATE OR DELETE ON model_files
FOR EACH ROW EXECUTE FUNCTION trg_model_files_refresh_flags();

CREATE INDEX idx_products_ar ON products(id) WHERE ar_enabled AND deleted_at IS NULL;

-- =====================================================================
--  TRIGGER: TỰ CẬP NHẬT view_count CHO SPACES
-- =====================================================================
CREATE OR REPLACE FUNCTION refresh_space_view_count() RETURNS trigger AS $$
BEGIN
  UPDATE spaces SET view_count = view_count + 1 WHERE id = NEW.space_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_space_views_count
AFTER INSERT ON space_views
FOR EACH ROW EXECUTE FUNCTION refresh_space_view_count();

-- =====================================================================
--  DỮ LIỆU KHỞI TẠO
-- =====================================================================
INSERT INTO roles (code, name) VALUES
  ('admin',    'Quản trị viên'),
  ('editor',   'Biên tập viên'),
  ('staff',    'Nhân viên bán hàng'),
  ('customer', 'Khách hàng');

INSERT INTO permissions (code, name) VALUES
  ('user.manage',    'Quản lý người dùng'),
  ('product.manage', 'Quản lý sản phẩm'),
  ('order.view',     'Xem đơn hàng'),
  ('order.manage',   'Xử lý đơn hàng'),
  ('post.manage',    'Quản lý bài viết'),
  ('space.manage',   'Quản lý không gian mẫu'),
  ('setting.manage', 'Cấu hình hệ thống');

-- Admin có mọi quyền
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('post.manage', 'space.manage')
WHERE r.code = 'editor';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('order.view', 'order.manage', 'product.manage')
WHERE r.code = 'staff';

INSERT INTO settings (key, value) VALUES
  ('site_name',     '"Tên website"'),
  ('contact_email', '"lienhe@example.com"'),
  ('currency',      '"VND"'),
  ('shipping_fee_default', '30000');

COMMIT;
