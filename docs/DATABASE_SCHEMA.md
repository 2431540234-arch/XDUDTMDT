> Cập nhật lần cuối: 2026-11-25 – theo commit `a13386e` (nhánh `db/remove-21-tables`, schema 32 bảng).

# Cơ sở dữ liệu Aurelia Living – Tài liệu schema

Website thương mại điện tử nội thất, tích hợp xem 3D, xoay 360° và không gian mẫu 360°. **AR đã bị loại bỏ khỏi hệ thống (2026-11-09, D-P16, D-T59)**: không còn bảng `ar_sessions`, kiểu `ar_mode`, cột `products.has_ar`; số thứ tự bảng đã đánh lại liên tục từ 1 đến 32 (khớp [CAU_TRUC_DB.md](CAU_TRUC_DB.md)).

**Rút gọn còn 32 bảng (2026-11-19 → 2026-11-20):** xóa 21 bảng ít dùng, rồi gộp thêm 6 bảng (`roles`, `permissions`, `role_permissions`, `user_roles` → cột `users.role` + hằng số `ROLE_PERMISSIONS`; `attributes` → enum `attribute_code`; `brands` → cột chữ `products.brand`). Chi tiết ở mục 8.4 và các quyết định mới trong [DECISIONS.md](DECISIONS.md).
Hệ quản trị: **PostgreSQL 15+** (dùng `UNIQUE NULLS NOT DISTINCT` và `ON DELETE SET NULL (cột)`, đã chạy thử trên 16).
Nguồn mô tả nghiệp vụ: [CAU_TRUC_DB.md](CAU_TRUC_DB.md). Quy ước khi code: [QUY_UOC_CODE_DB.md](QUY_UOC_CODE_DB.md).

> **Nguồn chuẩn cấu trúc CSDL là `apps/api/prisma`** (`schema.prisma` + `migrations/`: 21 migration, từ `0_init` đến `20261120030100_products_brand_text`). Thư mục [`database/`](../database/) chỉ còn là tài liệu tham khảo (SQL thuần, xem [database/README.md](../database/README.md)). Mọi thay đổi về sau làm qua `prisma migrate dev`.

## 1. Tổng quan và cách dựng

| Hạng mục | Số lượng |
| --- | --- |
| Bảng | **32** (nhóm 1–7, STT 1–32; không còn nhóm mở rộng) |
| ENUM | **18** (thêm `user_role`, `attribute_code`; bỏ `ar_mode` và các enum của bảng đã xóa) |
| Sequence | 1 (`order_code_seq`, sinh mã đơn `ALV-YYYYMMDD-NNNNNN`) |
| Hàm PL/pgSQL / SQL | 8 hàm tự viết (không tính hàm của extension) |
| Trigger | 28 (23 trigger `updated_at` + 5 trigger nghiệp vụ) |
| Index | 128 |
| Khóa ngoại / CHECK | 54 / 43 |

> Số liệu Hàm, Trigger, Index, Khóa ngoại/CHECK ở trên được đếm bằng truy vấn `pg_catalog` trên `aurelia_test` (32 bảng, đã áp đủ migration) ngày 2026-11-25. Cấu trúc cột/quan hệ lấy từ `apps/api/prisma/schema.prisma`.

> **Các tệp SQL dưới đây đã được gỡ khỏi `database/` ngày 2026-11-11** (lỗi thời: 44 bảng, còn AR; không script nào dùng). Bảng chỉ còn giá trị lịch sử; xem lại bằng `git log --diff-filter=D -- database/` rồi `git show <commit-trước-khi-gỡ>:database/<tệp>`. Nguồn chuẩn: `schema.prisma` và migration.

| File | Nội dung (lịch sử) |
| --- | --- |
| `00_reset.sql` | Xóa toàn bộ bảng, hàm, ENUM. **Chỉ dùng khi dev** |
| `01_extensions.sql` | `citext`, `pg_trgm`, `unaccent`, `pgcrypto` + hàm `immutable_unaccent()` |
| `02_types.sql` | 17 ENUM |
| `03_tables.sql` | 42 bảng, `COMMENT ON` tiếng Việt, khóa ngoại và CHECK |
| `04_constraints_indexes.sql` | Khóa ngoại vòng, partial unique index, index cho khóa ngoại và cột hay lọc |
| `05_functions_triggers.sql` | Hàm và trigger |
| `06_seed.sql` | 2 vai trò, 6 quyền, cấu hình mặc định, tài khoản admin |
| `07_sample_data.sql` | Dữ liệu mẫu cho dev/test |
| `run_all.sql` | Chạy 01 → 07 (dùng `\ir`, chạy được từ thư mục bất kỳ) |

Dựng CSDL thật (khuyến nghị) qua Prisma:

```bash
cd apps/api
npx prisma migrate deploy      # áp toàn bộ migration (hoặc từ gốc dự án: npm run db:deploy)
npx prisma db seed             # settings, admin (users.role = 'admin') + dữ liệu mẫu (SEED_SAMPLE=false để bỏ dữ liệu mẫu)
npx prisma migrate reset       # dev: xóa và dựng lại toàn bộ
```

(Đã gỡ) Trước đây dựng bản SQL thuần để đối chiếu bằng `psql -f database/run_all.sql`; nay dùng `npm run db:deploy` (xem [database/README.md](../database/README.md)).

Tài khoản mẫu (mật khẩu băm bcrypt bằng `crypt()`): `admin@aurelia.vn` / `Admin@123456`; `nguyenvana@example.com` và `tranthib@example.com` / `User@123456`. **Đổi mật khẩu admin trước khi triển khai thật.**

### Quy ước thiết kế

- Khóa chính và khóa ngoại dùng `INTEGER` (`id INTEGER GENERATED ALWAYS AS IDENTITY`) để Prisma sinh kiểu `Int`/`number`. `media.file_size` cũng là `INTEGER` (byte, tối đa ~2 GB, CHECK ≥ 0). Thêm cột `uuid` (UNIQUE, `gen_random_uuid()`) cho `users`, `orders`, `spaces` (và `product_3d_models`) để dùng làm mã công khai ngoài API.
- Tiền `NUMERIC(15,2)` có CHECK ≥ 0; kích thước 3D `INTEGER` (mm); góc, tỉ lệ, tọa độ `NUMERIC(9,4)`; email và mã giảm giá `CITEXT`; IP `INET`; dữ liệu linh hoạt `JSONB`.
- Tên ràng buộc: `pk_`, `fk_<bảng>_<cột>`, `uq_`, `ck_`; tên index: `idx_`.
- Bảng nhật ký (`activity_logs`, `order_status_history`, `coupon_usages`) chỉ có `created_at`. Bảng có dữ liệu sửa được (vì các cờ `placed/captured/added_to_cart` được cập nhật khi phiên diễn ra) có thêm `updated_at` (trigger tự cập nhật). Các bảng liên kết/nhật ký khác (`wishlists`, `order_items`, `notifications`, `password_resets`, `user_sessions`, `variant_attribute_values`) cũng chỉ có `created_at`.
- `ON DELETE`: `CASCADE` cho dữ liệu con thuần túy, `RESTRICT` cho dữ liệu cần giữ lịch sử, `SET NULL` cho tham chiếu tùy chọn. Lý do ghi ngay cạnh từng khóa ngoại trong `03_tables.sql`. Trường hợp đặc biệt: `space_hotspots.product_id` dùng `CASCADE` (không `SET NULL`) vì `SET NULL` sẽ vi phạm CHECK của chính bảng đó.
- Biến thể phải thuộc đúng sản phẩm được bảo đảm bằng **khóa ngoại kép** `(variant_id, product_id)` ở `product_images`, `product_3d_models`, `space_product_placements`; giá trị thuộc tính phải thuộc đúng loại thuộc tính bằng khóa kép `(attribute_value_id, attribute_code)` ở `variant_attribute_values`.
- Các ràng buộc "tối đa một" (ảnh đại diện, mô hình chính, ảnh mở đầu, địa chỉ mặc định) là partial unique index: chặn trường hợp có **hai**, còn việc phải có **đúng một** do tầng Service bảo đảm.

## 2. Vai trò và quyền truy cập dữ liệu

Hệ thống chỉ có **3 loại người dùng**. Không có vai trò `staff`, `editor`, `customer`, `guest`.

| Vai trò | Lưu trong CSDL | Được làm gì |
| --- | --- | --- |
| Quản trị viên (admin) | `users.role = 'admin'`, có đủ 6 quyền (hằng số `ROLE_PERMISSIONS`) | Toàn bộ quyền quản trị |
| Người dùng (user) | `users.role = 'user'` (mặc định), không có quyền quản trị | Mua hàng, giỏ hàng, áp mã giảm giá, đánh giá, yêu thích, sổ địa chỉ, lưu không gian mẫu; chỉ thao tác trên dữ liệu của chính mình |
| Khách vãng lai | **Không lưu** (không có tài khoản) | Chỉ xem sản phẩm, 3D/360°, không gian mẫu, trang tĩnh. Thêm giỏ, mua hàng, áp mã phải đăng ký/đăng nhập |

Cách CSDL thể hiện quy định này: `carts.user_id` NOT NULL + UNIQUE (không có `session_token`); `orders`, `addresses`, `wishlists`, `reviews`, `coupon_usages`, `notifications`, `user_sessions`, `password_resets` có `user_id` NOT NULL; `activity_logs` chỉ ghi thao tác admin qua `actor_id`.

### Ma trận C/R/U/D theo bảng

Ký hiệu: **C** tạo, **R** xem, **U** sửa, **D** xóa, **—** không có quyền.
`*` chỉ dữ liệu của chính mình · `†` chỉ dữ liệu công khai/đang hiển thị (ví dụ sản phẩm `published`, chưa xóa mềm; review `approved`) · `‡` luồng xác thực do API xử lý cho người chưa đăng nhập (đăng ký, đăng nhập, quên mật khẩu).
Đây là quy tắc để tầng API/Service thực thi; CSDL không dùng Row-Level Security.

| # | Bảng | Admin | User | Khách vãng lai |
| --- | --- | --- | --- | --- |
| 1 | users | CRUD | R\* U\* | C‡ (đăng ký) |
| 2 | password_resets | — | C\* U\* | C‡ U‡ |
| 3 | user_sessions | R D (thu hồi) | C\* R\* D\* | C‡ |
| 4 | addresses | R | CRUD\* | — |
| 5 | settings | CRUD | R† | R† |
| 6 | media | CRUD | C R† | R† |
| 7 | notifications | C R | R\* U\* D\* | — |
| 8 | activity_logs | R (ghi C tự động) | — | — |
| 9 | categories | CRUD | R† | R† |
| 10 | products | CRUD | R† | R† |
| 11 | attribute_values | CRUD | R | R |
| 12 | product_variants | CRUD | R† | R† |
| 13 | variant_attribute_values | CRUD | R† | R† |
| 14 | product_images | CRUD | R† | R† |
| 15 | reviews | R U (duyệt) D | C\* R† U\* D\* | R† |
| 16 | wishlists | R | CRD\* | — |
| 17 | product_3d_models | CRUD | R† | R† |
| 18 | model_files | CRUD | R† | R† |
| 19 | model_material_variants | CRUD | R† | R† |
| 20 | carts | R | CRU\* | — |
| 21 | cart_items | R | CRUD\* | — |
| 22 | coupons | CRUD | R† (áp mã) | — |
| 23 | coupon_usages | R | C\* R\* | — |
| 24 | orders | R U | C\* R\* U\* (hủy khi còn `pending`) | — |
| 25 | order_items | R | C\* R\* | — |
| 26 | order_status_history | R (ghi C tự động) | R\* | — |
| 27 | payments | R U | C\* R\* | — |
| 28 | shipments | CRU | R\* | — |
| 29 | spaces | CRUD | R† | R† |
| 30 | space_panoramas | CRUD | R† | R† |
| 31 | space_hotspots | CRUD | R† | R† |
| 32 | space_product_placements | CRUD | R† | R† |

Phân quyền chi tiết trong khu vực quản trị dùng 6 quyền (hằng số `ROLE_PERMISSIONS` trong `apps/api/src/common/auth/role-permissions.ts`, không còn bảng `permissions`): `manage_users`, `manage_products`, `view_orders`, `process_orders`, `manage_content`, `manage_settings`. Admin có cả 6; user không có quyền nào.

## 4. Từ điển dữ liệu

Phần này được sinh trực tiếp từ CSDL đã dựng bằng `run_all.sql` (kiểu, ràng buộc, mô tả lấy từ `COMMENT ON`). Mọi bảng đều có khóa chính `id INTEGER GENERATED ALWAYS AS IDENTITY` (trừ các bảng liên kết dùng khóa kép).

### Nhóm 1 – Người dùng và phân quyền (4 bảng)

#### 1. `users`

Tài khoản người dùng (admin và user; vai trò là cột `role`). Khách vãng lai không có tài khoản. Hỗ trợ xóa mềm.

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `uuid` | uuid | UNIQUE<br>NOT NULL<br>DEFAULT gen_random_uuid() | Mã công khai dùng ngoài API, không lộ id tuần tự |
| `full_name` | varchar(150) | NOT NULL | Họ và tên |
| `email` | citext | NOT NULL | Email đăng nhập, không phân biệt hoa thường; duy nhất trên tài khoản chưa xóa mềm |
| `phone` | varchar(20) | — | Số điện thoại |
| `password_hash` | varchar(255) | NOT NULL | Mật khẩu đã băm (bcrypt/argon2), không lưu mật khẩu gốc |
| `avatar_media_id` | integer | FK → media.id (set null) | Ảnh đại diện (media) |
| `status` | user_status | NOT NULL<br>DEFAULT 'active' | Trạng thái tài khoản: active, suspended (tạm khóa), banned (bị cấm) |
| `role` | user_role | NOT NULL<br>DEFAULT 'user' | Vai trò: admin hoặc user (một người một vai trò; quyền của từng vai trò là hằng số `ROLE_PERMISSIONS` trong mã nguồn) |
| `email_verified_at` | timestamptz | — | Thời điểm xác thực email |
| `last_login_at` | timestamptz | — | Lần đăng nhập gần nhất |
| `deleted_at` | timestamptz | — | Thời điểm xóa mềm; NULL = còn hoạt động |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối (trigger tự cập nhật) |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_users_email_format`: `((email ~ '^[^@[:space:]]+@[^@[:space:]]+$'::citext))`
- **Partial unique index** `uq_users_email_active` trên (email): `WHERE (deleted_at IS NULL)`

#### 2. `password_resets`

Mã đặt lại mật khẩu (đã băm), dùng một lần

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>NOT NULL | Người dùng yêu cầu đặt lại |
| `token_hash` | varchar(255) | UNIQUE<br>NOT NULL | Mã đặt lại đã băm |
| `expires_at` | timestamptz | NOT NULL | Thời hạn hiệu lực |
| `used_at` | timestamptz | — | Thời điểm đã sử dụng; NULL = chưa dùng |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_password_resets_expiry`: `((expires_at > created_at))`

#### 3. `user_sessions`

Phiên đăng nhập (refresh token), cho phép đăng xuất từ xa

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>NOT NULL | Chủ phiên |
| `refresh_token_hash` | varchar(255) | UNIQUE<br>NOT NULL | Refresh token đã băm |
| `ip_address` | inet | — | Địa chỉ IP khi đăng nhập |
| `user_agent` | text | — | User-Agent của trình duyệt/ứng dụng |
| `device_name` | varchar(150) | — | Tên thiết bị |
| `expires_at` | timestamptz | NOT NULL | Thời hạn phiên |
| `revoked_at` | timestamptz | — | Thời điểm thu hồi (đăng xuất); NULL = còn hiệu lực |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |

#### 4. `addresses`

Sổ địa chỉ giao hàng của user; mỗi user chỉ có một địa chỉ mặc định

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>NOT NULL | Chủ sổ địa chỉ |
| `recipient_name` | varchar(150) | NOT NULL | Tên người nhận |
| `phone` | varchar(20) | NOT NULL | Số điện thoại người nhận |
| `province` | varchar(100) | NOT NULL | Tỉnh/thành phố |
| `district` | varchar(100) | NOT NULL | Quận/huyện |
| `ward` | varchar(100) | NOT NULL | Phường/xã |
| `address_line` | varchar(255) | NOT NULL | Số nhà, tên đường |
| `is_default` | boolean | NOT NULL<br>DEFAULT false | Địa chỉ mặc định (tối đa một mỗi user) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **Partial unique index** `uq_addresses_user_default` trên (user_id): `WHERE is_default`

### Nhóm 2 – Hệ thống chung (4 bảng)

#### 5. `settings`

Cấu hình website dạng khóa - giá trị JSON

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `key` | varchar(100) | UNIQUE<br>NOT NULL | Khóa cấu hình, duy nhất |
| `value` | jsonb | NOT NULL | Giá trị (JSONB) |
| `description` | text | — | Mô tả cấu hình |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

#### 6. `media`

Kho tệp dùng chung: ảnh sản phẩm, ảnh danh mục, tệp mô hình 3D, ảnh 360°

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `file_name` | varchar(255) | NOT NULL | Tên tệp gốc |
| `file_path` | varchar(500) | UNIQUE<br>NOT NULL | Khóa lưu trữ (object key) của tệp trong MinIO/S3 hoặc thư mục local, duy nhất; KHÔNG lưu URL tuyệt đối (URL công khai = `STORAGE_PUBLIC_URL` + key) |
| `mime_type` | varchar(100) | NOT NULL | Loại tệp (MIME) |
| `file_size` | integer | NOT NULL | Dung lượng (byte) |
| `alt_text` | varchar(255) | — | Mô tả ảnh (SEO/trợ năng) |
| `uploaded_by` | integer | FK → users.id (set null) | Người tải lên |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_media_file_size`: `((file_size >= 0))`

#### 7. `notifications`

Thông báo gửi đến user

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>NOT NULL | Người nhận |
| `title` | varchar(255) | NOT NULL | Tiêu đề |
| `data` | jsonb | NOT NULL<br>DEFAULT '{}' | Dữ liệu kèm theo (JSONB), ví dụ mã đơn hàng |
| `read_at` | timestamptz | — | Thời điểm đã đọc; NULL = chưa đọc |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |

#### 8. `activity_logs`

Nhật ký thao tác của quản trị viên (chỉ admin)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `actor_id` | integer | FK → users.id (set null) | Admin thực hiện |
| `action` | varchar(100) | NOT NULL | Thao tác, ví dụ product.update |
| `target_type` | varchar(100) | — | Loại đối tượng bị tác động (tên bảng) |
| `target_id` | integer | — | Id đối tượng bị tác động |
| `changes` | jsonb | — | Nội dung thay đổi (JSONB: trước/sau) |
| `ip_address` | inet | — | Địa chỉ IP |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm thực hiện |

### Nhóm 3 – Nội dung (1 bảng)

#### 9. `categories`

Danh mục sản phẩm nhiều cấp (tự tham chiếu parent_id)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `parent_id` | integer | FK → categories.id (restrict) | Danh mục cha; NULL = danh mục gốc |
| `name` | varchar(150) | NOT NULL | Tên danh mục |
| `slug` | varchar(180) | UNIQUE<br>NOT NULL | Đường dẫn thân thiện, duy nhất |
| `image_media_id` | integer | FK → media.id (set null) | Ảnh danh mục |
| `sort_order` | integer | NOT NULL<br>DEFAULT 0 | Thứ tự hiển thị |
| `is_active` | boolean | NOT NULL<br>DEFAULT true | Bật/tắt hiển thị |
| `meta_title` | varchar(255) | — | SEO: tiêu đề |
| `meta_description` | varchar(500) | — | SEO: mô tả |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_categories_parent_not_self`: `((parent_id <> id))`

### Nhóm 4 – Sản phẩm (7 bảng)

#### 10. `products`

Thông tin chung của sản phẩm; hỗ trợ xóa mềm và tìm kiếm gần đúng theo tên

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `name` | varchar(255) | NOT NULL | Tên sản phẩm |
| `slug` | varchar(280) | UNIQUE<br>NOT NULL | Đường dẫn thân thiện, duy nhất |
| `short_description` | varchar(500) | — | Mô tả ngắn |
| `description` | text | — | Mô tả chi tiết |
| `category_id` | integer | FK → categories.id (set null) | Danh mục |
| `brand` | varchar(150) | — | Thương hiệu (tên dạng chữ; không còn bảng `brands`) |
| `status` | content_status | NOT NULL<br>DEFAULT 'draft' | Trạng thái: draft, published, archived |
| `is_featured` | boolean | NOT NULL<br>DEFAULT false | Sản phẩm nổi bật |
| `rating_avg` | numeric(3,2) | NOT NULL<br>DEFAULT 0 | Điểm đánh giá trung bình (trigger tự tính từ review đã duyệt) |
| `rating_count` | integer | NOT NULL<br>DEFAULT 0 | Số lượt đánh giá đã duyệt (trigger tự tính) |
| `sold_count` | integer | NOT NULL<br>DEFAULT 0 | Số lượng đã bán (Service cập nhật trong transaction) |
| `has_3d_model` | boolean | NOT NULL<br>DEFAULT false | Có mô hình 3D ở trạng thái ready (trigger tự cập nhật) |
| `meta_title` | varchar(255) | — | SEO: tiêu đề |
| `meta_description` | varchar(500) | — | SEO: mô tả |
| `deleted_at` | timestamptz | — | Thời điểm xóa mềm |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_products_rating_avg`: `(((rating_avg >= (0)::numeric) AND (rating_avg <= (5)::numeric)))`
- **CHECK** `ck_products_rating_count`: `((rating_count >= 0))`
- **CHECK** `ck_products_sold_count`: `((sold_count >= 0))`

#### 11. `attribute_values`

Giá trị cụ thể của thuộc tính (Đỏ, XL, Gỗ sồi...). Loại thuộc tính là enum `attribute_code` (color, size, material), không còn bảng `attributes`

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `attribute_code` | attribute_code | NOT NULL | Loại thuộc tính: color, size hoặc material |
| `value` | varchar(150) | NOT NULL | Giá trị; duy nhất trong cùng loại thuộc tính |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **UNIQUE** `uq_attribute_values_code_value`: (attribute_code, value)
- **UNIQUE** `uq_attribute_values_id_code`: (id, attribute_code)

#### 12. `product_variants`

Biến thể bán hàng: SKU, giá, giá khuyến mãi, tồn kho, cân nặng

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `product_id` | integer | FK → products.id (cascade)<br>NOT NULL | Sản phẩm |
| `sku` | varchar(100) | UNIQUE<br>NOT NULL | Mã SKU, duy nhất |
| `price` | numeric(15,2) | NOT NULL | Giá gốc (VND) |
| `sale_price` | numeric(15,2) | — | Giá khuyến mãi; NULL = không khuyến mãi; không được lớn hơn giá gốc |
| `stock_quantity` | integer | NOT NULL<br>DEFAULT 0 | Số lượng tồn kho (không âm) |
| `weight_gram` | integer | — | Cân nặng (gram) |
| `is_active` | boolean | NOT NULL<br>DEFAULT true | Còn bán hay không |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_product_variants_price`: `((price >= (0)::numeric))`
- **CHECK** `ck_product_variants_sale_price`: `(((sale_price IS NULL) OR ((sale_price >= (0)::numeric) AND (sale_price <= price))))`
- **CHECK** `ck_product_variants_stock`: `((stock_quantity >= 0))`
- **CHECK** `ck_product_variants_weight`: `(((weight_gram IS NULL) OR (weight_gram >= 0)))`
- **UNIQUE** `uq_product_variants_id_product`: (id, product_id)

#### 13. `variant_attribute_values`

Liên kết biến thể với giá trị thuộc tính; mỗi biến thể chỉ một giá trị cho mỗi loại thuộc tính

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `variant_id` | integer | PK (khóa kép)<br>FK → product_variants.id (cascade) | Biến thể |
| `attribute_value_id` | integer | PK (khóa kép)<br>FK → attribute_values.id (cascade) | Giá trị thuộc tính |
| `attribute_code` | attribute_code | FK → attribute_values.attribute_code (cascade)<br>NOT NULL | Loại thuộc tính (khớp với giá trị nhờ khóa ngoại kép) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |

**Ràng buộc cấp bảng:**

- **FK kép** `fk_variant_attribute_values_attribute_value_id`: (attribute_value_id, attribute_code) → attribute_values(id, attribute_code), on delete cascade
- **PK** `pk_variant_attribute_values`: (variant_id, attribute_value_id)
- **UNIQUE** `uq_variant_attribute_values_variant_attribute`: (variant_id, attribute_code)

#### 14. `product_images`

Ảnh sản phẩm, có thể gắn riêng cho biến thể; mỗi sản phẩm một ảnh đại diện

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `product_id` | integer | FK → products.id (cascade)<br>NOT NULL | Sản phẩm |
| `variant_id` | integer | FK → product_variants.id (cascade) | Biến thể (nếu ảnh riêng cho biến thể) |
| `media_id` | integer | FK → media.id (restrict)<br>NOT NULL | Tệp ảnh |
| `sort_order` | integer | NOT NULL<br>DEFAULT 0 | Thứ tự hiển thị |
| `is_primary` | boolean | NOT NULL<br>DEFAULT false | Ảnh đại diện (tối đa một mỗi sản phẩm) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **FK kép** `fk_product_images_variant_id`: (variant_id, product_id) → product_variants(id, product_id), on delete cascade
- **Partial unique index** `uq_product_images_primary` trên (product_id): `WHERE is_primary`
- **[ĐANG CHỜ DUYỆT, O-06]** Bảng này chưa có chỗ phân biệt ảnh overlay (PNG nền trong suốt cho app Android, UC-MOB-02/03). Ba phương án đang chờ chủ dự án chọn (xem `docs/DECISIONS.md` O-06); thiết kế bảng giữ nguyên cho tới khi có quyết định.

#### 15. `reviews`

Đánh giá sản phẩm 1-5 sao; cần duyệt mới hiển thị và tính vào điểm trung bình

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>NOT NULL | Người đánh giá |
| `product_id` | integer | FK → products.id (cascade)<br>NOT NULL | Sản phẩm |
| `order_id` | integer | FK → orders.id (set null) | Đơn hàng đã mua (Service kiểm tra điều kiện đã mua) |
| `rating` | smallint | NOT NULL | Số sao 1-5 |
| `content` | text | — | Nội dung đánh giá |
| `status` | review_status | NOT NULL<br>DEFAULT 'pending' | Trạng thái: pending, approved, rejected |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_reviews_rating`: `(((rating >= 1) AND (rating <= 5)))`
- **UNIQUE** `uq_reviews_user_product_order`: (user_id, product_id, order_id) — `NULLS NOT DISTINCT`

#### 16. `wishlists`

Sản phẩm yêu thích của user

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>NOT NULL | Người dùng |
| `product_id` | integer | FK → products.id (cascade)<br>NOT NULL | Sản phẩm yêu thích |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm thêm |

**Ràng buộc cấp bảng:**

- **UNIQUE** `uq_wishlists_user_product`: (user_id, product_id)

### Nhóm 5 – Mô hình 3D (3 bảng; AR đã bỏ)

#### 17. `product_3d_models`

Mô hình 3D của sản phẩm hoặc biến thể: kích thước thật, vị trí đặt, cấu hình trình xem

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `uuid` | uuid | UNIQUE<br>NOT NULL<br>DEFAULT gen_random_uuid() | Mã công khai |
| `product_id` | integer | FK → products.id (cascade)<br>NOT NULL | Sản phẩm |
| `variant_id` | integer | FK → product_variants.id (cascade) | Biến thể cụ thể (NULL = áp dụng cho cả sản phẩm) |
| `length_mm` | integer | NOT NULL | Chiều dài thật (mm) |
| `width_mm` | integer | NOT NULL | Chiều rộng thật (mm) |
| `height_mm` | integer | NOT NULL | Chiều cao thật (mm) |
| `placement` | model_placement | NOT NULL<br>DEFAULT 'floor' | Vị trí đặt của mô hình: floor (sàn), wall (tường), table (mặt bàn) |
| `allow_scaling` | boolean | NOT NULL<br>DEFAULT false | Cho phép người xem đổi tỉ lệ trong trình xem |
| `viewer_config` | jsonb | NOT NULL<br>DEFAULT '{}' | Cấu hình trình xem 3D (JSONB): góc camera, tự xoay, ánh sáng, độ sáng |
| `poster_media_id` | integer | FK → media.id (set null) | Ảnh chờ hiển thị khi đang tải mô hình |
| `status` | model_status | NOT NULL<br>DEFAULT 'uploading' | Trạng thái xử lý: uploading, processing, ready, failed |
| `version` | integer | NOT NULL<br>DEFAULT 1 | Phiên bản mô hình |
| `is_primary` | boolean | NOT NULL<br>DEFAULT false | Mô hình chính của sản phẩm (tối đa một) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_product_3d_models_size`: `(((length_mm > 0) AND (width_mm > 0) AND (height_mm > 0)))`
- **CHECK** `ck_product_3d_models_version`: `((version >= 1))`
- **FK kép** `fk_product_3d_models_variant_id`: (variant_id, product_id) → product_variants(id, product_id), on delete cascade
- **Partial unique index** `uq_product_3d_models_primary` trên (product_id): `WHERE is_primary`

#### 18. `model_files`

Tệp thực tế của mô hình 3D: GLB (web/Android) theo 3 mức chi tiết; giá trị `usdz` của enum được giữ để không xóa dữ liệu sẵn có, hệ thống không nhận/xử lý USDZ (chỉ GLB)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `model_id` | integer | FK → product_3d_models.id (cascade)<br>NOT NULL | Mô hình 3D |
| `format` | model_file_format | NOT NULL | Định dạng: glb, usdz |
| `lod` | model_lod | NOT NULL<br>DEFAULT 'high' | Mức chi tiết: high, medium, low |
| `media_id` | integer | FK → media.id (restrict)<br>NOT NULL | Tệp trong kho media |
| `polygon_count` | integer | — | Số đa giác |
| `texture_resolution` | integer | — | Độ phân giải texture (px, cạnh dài) |
| `is_compressed` | boolean | NOT NULL<br>DEFAULT false | Đã nén (Draco/Meshopt...) |
| `checksum` | varchar(128) | — | Mã kiểm tra tệp (SHA-256) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_model_files_polygon`: `(((polygon_count IS NULL) OR (polygon_count >= 0)))`
- **CHECK** `ck_model_files_texture`: `(((texture_resolution IS NULL) OR (texture_resolution > 0)))`
- **UNIQUE** `uq_model_files_model_format_lod`: (model_id, format, lod)

#### 19. `model_material_variants`

Đổi màu/chất liệu trên cùng một mô hình 3D theo biến thể, không tải lại mô hình

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `model_id` | integer | FK → product_3d_models.id (cascade)<br>NOT NULL | Mô hình 3D |
| `variant_id` | integer | FK → product_variants.id (cascade)<br>NOT NULL | Biến thể tương ứng |
| `material_name` | varchar(150) | NOT NULL | Tên vật liệu trong mô hình cần đổi |
| `config` | jsonb | NOT NULL<br>DEFAULT '{}' | Cấu hình vật liệu (JSONB): màu, texture, độ nhám... |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **UNIQUE** `uq_model_material_variants_model_variant`: (model_id, variant_id)

### Nhóm 6 – Giỏ hàng và đơn hàng (9 bảng)

#### 20. `carts`

Giỏ hàng của user đã đăng nhập (mỗi user một giỏ; không có giỏ cho khách)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `user_id` | integer | FK → users.id (cascade)<br>UNIQUE<br>NOT NULL | Chủ giỏ hàng (duy nhất) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

#### 21. `cart_items`

Sản phẩm (theo biến thể) và số lượng trong giỏ

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `cart_id` | integer | FK → carts.id (cascade)<br>NOT NULL | Giỏ hàng |
| `variant_id` | integer | FK → product_variants.id (cascade)<br>NOT NULL | Biến thể |
| `quantity` | integer | NOT NULL<br>DEFAULT 1 | Số lượng (> 0) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm thêm |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_cart_items_quantity`: `((quantity > 0))`
- **UNIQUE** `uq_cart_items_cart_variant`: (cart_id, variant_id)

#### 22. `coupons`

Mã giảm giá theo phần trăm hoặc số tiền cố định; chỉ user đã đăng nhập được áp

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `code` | citext | UNIQUE<br>NOT NULL | Mã giảm giá, không phân biệt hoa thường |
| `type` | coupon_type | NOT NULL | Loại: percent hoặc fixed |
| `value` | numeric(15,2) | NOT NULL | Giá trị giảm (percent: 0-100; fixed: số tiền) |
| `max_discount` | numeric(15,2) | — | Mức giảm tối đa (áp cho loại percent) |
| `min_order_value` | numeric(15,2) | NOT NULL<br>DEFAULT 0 | Giá trị đơn hàng tối thiểu để áp mã |
| `usage_limit` | integer | — | Tổng số lượt dùng tối đa; NULL = không giới hạn |
| `per_user_limit` | integer | — | Số lượt tối đa cho mỗi user; NULL = không giới hạn |
| `used_count` | integer | NOT NULL<br>DEFAULT 0 | Số lượt đã dùng (Service cập nhật) |
| `starts_at` | timestamptz | NOT NULL<br>DEFAULT now() | Bắt đầu hiệu lực |
| `ends_at` | timestamptz | — | Hết hiệu lực; NULL = không hết hạn |
| `is_active` | boolean | NOT NULL<br>DEFAULT true | Bật/tắt mã |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_coupons_max_discount`: `(((max_discount IS NULL) OR (max_discount >= (0)::numeric)))`
- **CHECK** `ck_coupons_min_order`: `((min_order_value >= (0)::numeric))`
- **CHECK** `ck_coupons_per_user_limit`: `(((per_user_limit IS NULL) OR (per_user_limit > 0)))`
- **CHECK** `ck_coupons_percent_max`: `(((type <> 'percent'::coupon_type) OR (value <= (100)::numeric)))`
- **CHECK** `ck_coupons_period`: `((starts_at < ends_at))`
- **CHECK** `ck_coupons_usage_limit`: `(((usage_limit IS NULL) OR (usage_limit > 0)))`
- **CHECK** `ck_coupons_used_count`: `((used_count >= 0))`
- **CHECK** `ck_coupons_value`: `((value > (0)::numeric))`

#### 23. `coupon_usages`

Mỗi lần dùng mã giảm giá (user nào, đơn nào) để kiểm soát giới hạn lượt dùng

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `coupon_id` | integer | FK → coupons.id (restrict)<br>NOT NULL | Mã giảm giá |
| `user_id` | integer | FK → users.id (restrict)<br>NOT NULL | Người dùng đã áp mã |
| `order_id` | integer | FK → orders.id (cascade)<br>NOT NULL | Đơn hàng áp mã |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm dùng |

**Ràng buộc cấp bảng:**

- **UNIQUE** `uq_coupon_usages_coupon_order`: (coupon_id, order_id)

#### 24. `orders`

Đơn hàng; thông tin người nhận lưu dạng bản chụp tại thời điểm đặt

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `uuid` | uuid | UNIQUE<br>NOT NULL<br>DEFAULT gen_random_uuid() | Mã công khai |
| `order_code` | varchar(30) | UNIQUE<br>NOT NULL | Mã đơn hàng hiển thị cho khách, duy nhất; sinh từ sequence `order_code_seq`, dạng `ALV-YYYYMMDD-NNNNNN` |
| `user_id` | integer | FK → users.id (restrict)<br>NOT NULL | Người đặt hàng |
| `status` | order_status | NOT NULL<br>DEFAULT 'pending' | Trạng thái: pending, confirmed, processing, shipping, completed, cancelled, refunded |
| `recipient_name` | varchar(150) | NOT NULL | Tên người nhận (bản chụp) |
| `recipient_phone` | varchar(20) | NOT NULL | Số điện thoại người nhận (bản chụp) |
| `shipping_province` | varchar(100) | NOT NULL | Tỉnh/thành giao hàng (bản chụp) |
| `shipping_district` | varchar(100) | NOT NULL | Quận/huyện giao hàng (bản chụp) |
| `shipping_ward` | varchar(100) | NOT NULL | Phường/xã giao hàng (bản chụp) |
| `shipping_address` | varchar(255) | NOT NULL | Số nhà, tên đường giao hàng (bản chụp) |
| `subtotal` | numeric(15,2) | NOT NULL | Tạm tính (tổng thành tiền các dòng hàng) |
| `discount_amount` | numeric(15,2) | NOT NULL<br>DEFAULT 0 | Số tiền giảm giá |
| `shipping_fee` | numeric(15,2) | NOT NULL<br>DEFAULT 0 | Phí vận chuyển |
| `total` | numeric(15,2) | NOT NULL | Tổng tiền = subtotal - discount_amount + shipping_fee (CSDL tự kiểm tra) |
| `coupon_id` | integer | FK → coupons.id (set null) | Mã giảm giá đã áp |
| `payment_method` | payment_method | NOT NULL | Phương thức thanh toán |
| `payment_status` | order_payment_status | NOT NULL<br>DEFAULT 'unpaid' | Trạng thái thanh toán: unpaid, paid, refunded, failed |
| `note` | text | — | Ghi chú của khách |
| `cancel_reason` | text | — | Lý do hủy |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm đặt hàng |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_orders_amounts`: `(((subtotal >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (shipping_fee >= (0)::numeric) AND (total >= (0)::numeric)))`
- **CHECK** `ck_orders_total`: `((total = ((subtotal - discount_amount) + shipping_fee)))`

#### 25. `order_items`

Chi tiết dòng hàng; lưu tên, SKU, đơn giá tại thời điểm mua

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `order_id` | integer | FK → orders.id (cascade)<br>NOT NULL | Đơn hàng |
| `variant_id` | integer | FK → product_variants.id (set null) | Biến thể (NULL nếu biến thể đã bị xóa) |
| `product_name` | varchar(255) | NOT NULL | Tên sản phẩm lúc mua |
| `sku` | varchar(100) | NOT NULL | SKU lúc mua |
| `unit_price` | numeric(15,2) | NOT NULL | Đơn giá lúc mua |
| `quantity` | integer | NOT NULL | Số lượng (> 0) |
| `line_total` | numeric(15,2) (tính tự động) | GENERATED STORED | Thành tiền = unit_price * quantity (CSDL tự tính) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_order_items_quantity`: `((quantity > 0))`
- **CHECK** `ck_order_items_unit_price`: `((unit_price >= (0)::numeric))`

#### 26. `order_status_history`

Lịch sử đổi trạng thái đơn hàng (trigger tự ghi)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `order_id` | integer | FK → orders.id (cascade)<br>NOT NULL | Đơn hàng |
| `from_status` | order_status | — | Trạng thái cũ; NULL ở dòng khởi tạo |
| `to_status` | order_status | NOT NULL | Trạng thái mới |
| `changed_by` | integer | FK → users.id (set null) | Người thay đổi (lấy từ biến phiên app.current_user_id); NULL = hệ thống |
| `note` | text | — | Ghi chú |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm thay đổi |

#### 27. `payments`

Giao dịch thanh toán của đơn hàng

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `order_id` | integer | FK → orders.id (restrict)<br>NOT NULL | Đơn hàng |
| `method` | payment_method | NOT NULL | Phương thức: cod, bank_transfer, momo, vnpay, zalopay, card |
| `amount` | numeric(15,2) | NOT NULL | Số tiền |
| `status` | payment_txn_status | NOT NULL<br>DEFAULT 'pending' | Trạng thái giao dịch: pending, success, failed, refunded |
| `transaction_code` | varchar(100) | UNIQUE | Mã giao dịch từ cổng thanh toán (duy nhất, có thể NULL) |
| `gateway_response` | jsonb | — | Dữ liệu phản hồi của cổng thanh toán (JSONB) |
| `paid_at` | timestamptz | — | Thời điểm thanh toán thành công |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_payments_amount`: `((amount >= (0)::numeric))`

#### 28. `shipments`

Thông tin vận chuyển của đơn hàng

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `order_id` | integer | FK → orders.id (restrict)<br>NOT NULL | Đơn hàng |
| `carrier` | shipment_carrier | NOT NULL | Đơn vị vận chuyển: ghn, ghtk, viettel_post, other |
| `tracking_code` | varchar(100) | — | Mã vận đơn |
| `status` | shipment_status | NOT NULL<br>DEFAULT 'pending' | Trạng thái: pending, picked_up, in_transit, delivered, failed, returned |
| `fee` | numeric(15,2) | NOT NULL<br>DEFAULT 0 | Phí vận chuyển |
| `shipped_at` | timestamptz | — | Thời điểm gửi hàng |
| `delivered_at` | timestamptz | — | Thời điểm giao thành công |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_shipments_dates`: `(((delivered_at IS NULL) OR (shipped_at IS NULL) OR (delivered_at >= shipped_at)))`
- **CHECK** `ck_shipments_fee`: `((fee >= (0)::numeric))`

### Nhóm 7 – Không gian mẫu (4 bảng)

#### 29. `spaces`

Không gian mẫu hoàn chỉnh (ví dụ "Phòng khách tối giản 20m²"); tìm kiếm không dấu theo title

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `uuid` | uuid | UNIQUE<br>NOT NULL<br>DEFAULT gen_random_uuid() | Mã công khai |
| `title` | varchar(255) | NOT NULL | Tên không gian |
| `slug` | varchar(280) | UNIQUE<br>NOT NULL | Đường dẫn thân thiện, duy nhất |
| `description` | text | — | Mô tả |
| `room_type` | room_type | NOT NULL<br>DEFAULT 'other' | Loại phòng: living_room, bedroom, kitchen, dining_room, bathroom, office, other |
| `style` | varchar(100) | — | Phong cách (ví dụ Scandinavian) |
| `category_id` | integer | FK → categories.id (set null) | Danh mục/bộ sưu tập |
| `cover_media_id` | integer | FK → media.id (set null) | Ảnh bìa |
| `status` | content_status | NOT NULL<br>DEFAULT 'draft' | Trạng thái: draft, published, archived |
| `published_at` | timestamptz | — | Thời điểm đăng |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**


#### 30. `space_panoramas`

Ảnh 360° của không gian mẫu; mỗi không gian có đúng một ảnh mở đầu

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `space_id` | integer | FK → spaces.id (cascade)<br>NOT NULL | Không gian mẫu |
| `media_id` | integer | FK → media.id (restrict)<br>NOT NULL | Tệp ảnh 360° |
| `title` | varchar(255) | — | Tiêu đề (tên phòng/góc nhìn) |
| `default_yaw` | numeric(9,4) | NOT NULL<br>DEFAULT 0 | Góc ngang mặc định khi mở (độ) |
| `default_pitch` | numeric(9,4) | NOT NULL<br>DEFAULT 0 | Góc dọc mặc định khi mở (độ) |
| `default_fov` | numeric(9,4) | NOT NULL<br>DEFAULT 90 | Độ rộng khung nhìn mặc định (độ) |
| `sort_order` | integer | NOT NULL<br>DEFAULT 0 | Thứ tự trong tour |
| `is_start` | boolean | NOT NULL<br>DEFAULT false | Ảnh mở đầu tour (tối đa một mỗi không gian) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_space_panoramas_fov`: `(((default_fov > (0)::numeric) AND (default_fov < (180)::numeric)))`
- **Partial unique index** `uq_space_panoramas_start` trên (space_id): `WHERE is_start`

#### 31. `space_hotspots`

Điểm bấm tương tác trên ảnh 360°: product, navigation, info (CSDL kiểm tra dữ liệu khớp theo loại)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `panorama_id` | integer | FK → space_panoramas.id (cascade)<br>NOT NULL | Ảnh 360° chứa điểm bấm |
| `type` | hotspot_type | NOT NULL | Loại: product (mở sản phẩm), navigation (chuyển ảnh), info (ghi chú) |
| `yaw` | numeric(9,4) | NOT NULL | Vị trí góc ngang (độ) |
| `pitch` | numeric(9,4) | NOT NULL | Vị trí góc dọc (độ) |
| `product_id` | integer | FK → products.id (cascade) | Sản phẩm (bắt buộc với loại product) |
| `target_panorama_id` | integer | FK → space_panoramas.id (cascade) | Ảnh 360° đích (bắt buộc với loại navigation) |
| `title` | varchar(255) | — | Tiêu đề điểm bấm |
| `content` | text | — | Nội dung ghi chú (bắt buộc với loại info) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_space_hotspots_info`: `(((type <> 'info'::hotspot_type) OR (content IS NOT NULL)))`
- **CHECK** `ck_space_hotspots_navigation`: `(((type <> 'navigation'::hotspot_type) OR (target_panorama_id IS NOT NULL)))`
- **CHECK** `ck_space_hotspots_not_self`: `(((target_panorama_id IS NULL) OR (target_panorama_id <> panorama_id)))`
- **CHECK** `ck_space_hotspots_product`: `(((type <> 'product'::hotspot_type) OR (product_id IS NOT NULL)))`

#### 32. `space_product_placements`

Đặt mô hình 3D thật của sản phẩm vào ảnh 360° với đúng phối cảnh

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | integer | PK<br>IDENTITY | Khóa chính |
| `panorama_id` | integer | FK → space_panoramas.id (cascade)<br>NOT NULL | Ảnh 360° |
| `product_id` | integer | FK → products.id (cascade)<br>NOT NULL | Sản phẩm được đặt |
| `variant_id` | integer | FK → product_variants.id (set null (variant_id)) | Biến thể (tùy chọn) |
| `model_id` | integer | FK → product_3d_models.id (set null) | Mô hình cụ thể; NULL = dùng mô hình chính của sản phẩm |
| `yaw` | numeric(9,4) | NOT NULL | Vị trí góc ngang (độ) |
| `pitch` | numeric(9,4) | NOT NULL | Vị trí góc dọc (độ) |
| `distance` | numeric(9,4) | NOT NULL | Khoảng cách tới camera (mét), dùng tính kích thước hiển thị đúng tỉ lệ |
| `rotation_x` | numeric(9,4) | NOT NULL<br>DEFAULT 0 | Góc xoay quanh trục X (độ) |
| `rotation_y` | numeric(9,4) | NOT NULL<br>DEFAULT 0 | Góc xoay quanh trục Y (độ) |
| `rotation_z` | numeric(9,4) | NOT NULL<br>DEFAULT 0 | Góc xoay quanh trục Z (độ) |
| `scale` | numeric(9,4) | NOT NULL<br>DEFAULT 1 | Tỉ lệ (> 0) |
| `created_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL<br>DEFAULT now() | Thời điểm cập nhật cuối |

**Ràng buộc cấp bảng:**

- **CHECK** `ck_space_product_placements_distance`: `((distance > (0)::numeric))`
- **CHECK** `ck_space_product_placements_scale`: `((scale > (0)::numeric))`
- **FK kép** `fk_space_product_placements_variant_id`: (variant_id, product_id) → product_variants(id, product_id), on delete set null (variant_id)

### Cột thêm trên bảng chuẩn

Các cột dưới đây có trong `schema.prisma` nhưng không nằm trong bộ cột chuẩn ban đầu của từng bảng ở trên.

| Bảng | Cột thêm | Ghi chú |
|---|---|---|
| `users` | `birthday`, `gender`, `loyalty_points`, `admin_note` | `loyalty_points` **chưa có logic cộng điểm** (xem Phần 3) |
| `addresses` | `label` | Nhãn "Nhà riêng/Công ty" |
| `categories` | `description`, `is_featured` | |
| `products` | `features` (JSONB), `style` | |
| `attribute_values` | `color_hex` | Màu swatch (chỉ loại `color`) |
| `product_variants` | `cost_price`, `min_stock`, `length_cm`, `width_cm`, `height_cm` | Giá vốn, cảnh báo tồn thấp, kích thước |
| `reviews` | `is_anonymous`, `tags` | |
| `carts` | `coupon_id` | Mã đang áp (chuẩn nói "chỉ xem trước"; giữ cho FE – xem Phần 3) |
| `coupons` | `name`, `description` | Mã áp cho toàn giỏ (đã bỏ `applies_to`, `applies_to_label`) |
| `orders` | `internal_note` | Ghi chú nội bộ admin |
| `order_items` | `cost_price`, `image_media_id`, `variant_label` | Chụp lại giá vốn/ảnh/nhãn lúc bán |
| `spaces` | `combo_discount_percent` | % giảm khi mua cả bộ (**chỉ hiển thị**, giỏ hàng chưa áp) |
| `password_resets` | (chuẩn: `token_hash`, `expires_at`, `used_at`) | Đã bỏ cột OTP; dùng liên kết token |

Ràng buộc/index mở rộng đi theo các bảng trên (`ck_*`, `uq_*`, `idx_*` đặt tên theo quy ước).

## 5. Sơ đồ quan hệ (ERD)

Ký hiệu: `||` đúng một, `|o` không hoặc một (khóa ngoại cho phép NULL), `o{` không hoặc nhiều. Bảng nằm ngoài nhóm đang xem chỉ hiện tên (không liệt kê cột).

### 5.1. Nhóm 1 – Người dùng và phân quyền

```mermaid
erDiagram
    users {
        integer id PK
        uuid uuid UK
        varchar full_name
        citext email
        varchar phone
        varchar password_hash
        integer avatar_media_id FK
        user_status status
        user_role role
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }
    password_resets {
        integer id PK
        integer user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }
    user_sessions {
        integer id PK
        integer user_id FK
        varchar refresh_token_hash UK
        inet ip_address
        text user_agent
        varchar device_name
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }
    addresses {
        integer id PK
        integer user_id FK
        varchar recipient_name
        varchar phone
        varchar province
        varchar district
        varchar ward
        varchar address_line
        boolean is_default
        timestamptz created_at
        timestamptz updated_at
    }
    users |o--o{ activity_logs : "actor_id"
    users ||--o{ addresses : "user_id"
    users ||--o| carts : "user_id"
    users ||--o{ coupon_usages : "user_id"
    users |o--o{ media : "uploaded_by"
    users ||--o{ notifications : "user_id"
    users ||--o{ orders : "user_id"
    users |o--o{ order_status_history : "changed_by"
    users ||--o{ password_resets : "user_id"
    users ||--o{ reviews : "user_id"
    media |o--o{ users : "avatar_media_id"
    users ||--o{ user_sessions : "user_id"
    users ||--o{ wishlists : "user_id"
```

### 5.2. Nhóm 2 – Hệ thống chung

```mermaid
erDiagram
    settings {
        integer id PK
        varchar key UK
        jsonb value
        text description
        timestamptz created_at
        timestamptz updated_at
    }
    media {
        integer id PK
        varchar file_name
        varchar file_path UK
        varchar mime_type
        integer file_size
        varchar alt_text
        integer uploaded_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    notifications {
        integer id PK
        integer user_id FK
        varchar title
        jsonb data
        timestamptz read_at
        timestamptz created_at
    }
    activity_logs {
        integer id PK
        integer actor_id FK
        varchar action
        varchar target_type
        integer target_id
        jsonb changes
        inet ip_address
        timestamptz created_at
    }
    users |o--o{ activity_logs : "actor_id"
    media |o--o{ categories : "image_media_id"
    users |o--o{ media : "uploaded_by"
    media ||--o{ model_files : "media_id"
    users ||--o{ notifications : "user_id"
    media |o--o{ product_3d_models : "poster_media_id"
    media ||--o{ product_images : "media_id"
    media ||--o{ space_panoramas : "media_id"
    media |o--o{ spaces : "cover_media_id"
    media |o--o{ users : "avatar_media_id"
```

### 5.3. Nhóm 3 – Nội dung

```mermaid
erDiagram
    categories {
        integer id PK
        integer parent_id FK
        varchar name
        varchar slug UK
        integer image_media_id FK
        integer sort_order
        boolean is_active
        varchar meta_title
        varchar meta_description
        timestamptz created_at
        timestamptz updated_at
    }
    media |o--o{ categories : "image_media_id"
    categories |o--o{ categories : "parent_id"
    categories |o--o{ products : "category_id"
    categories |o--o{ spaces : "category_id"
```

### 5.4. Nhóm 4 – Sản phẩm

```mermaid
erDiagram
    products {
        integer id PK
        varchar name
        varchar slug UK
        varchar short_description
        text description
        integer category_id FK
        varchar brand
        content_status status
        boolean is_featured
        numeric rating_avg
        integer rating_count
        integer sold_count
        boolean has_3d_model
        varchar meta_title
        varchar meta_description
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }
    attribute_values {
        integer id PK
        attribute_code attribute_code
        varchar value
        timestamptz created_at
        timestamptz updated_at
    }
    product_variants {
        integer id PK
        integer product_id FK
        varchar sku UK
        numeric price
        numeric sale_price
        integer stock_quantity
        integer weight_gram
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    variant_attribute_values {
        integer variant_id PK,FK
        integer attribute_value_id PK,FK
        attribute_code attribute_code FK
        timestamptz created_at
    }
    product_images {
        integer id PK
        integer product_id FK
        integer variant_id FK
        integer media_id FK
        integer sort_order
        boolean is_primary
        timestamptz created_at
        timestamptz updated_at
    }
    reviews {
        integer id PK
        integer user_id FK
        integer product_id FK
        integer order_id FK
        smallint rating
        text content
        review_status status
        timestamptz created_at
        timestamptz updated_at
    }
    wishlists {
        integer id PK
        integer user_id FK
        integer product_id FK
        timestamptz created_at
    }
    product_variants ||--o{ cart_items : "variant_id"
    product_variants ||--o{ model_material_variants : "variant_id"
    product_variants |o--o{ order_items : "variant_id"
    products ||--o{ product_3d_models : "product_id"
    product_variants |o--o{ product_3d_models : "variant_id+product_id"
    media ||--o{ product_images : "media_id"
    products ||--o{ product_images : "product_id"
    product_variants |o--o{ product_images : "variant_id+product_id"
    categories |o--o{ products : "category_id"
    products ||--o{ product_variants : "product_id"
    orders |o--o{ reviews : "order_id"
    products ||--o{ reviews : "product_id"
    users ||--o{ reviews : "user_id"
    products |o--o{ space_hotspots : "product_id"
    products ||--o{ space_product_placements : "product_id"
    product_variants |o--o{ space_product_placements : "variant_id+product_id"
    attribute_values ||--o{ variant_attribute_values : "attribute_value_id+attribute_code"
    product_variants ||--o{ variant_attribute_values : "variant_id"
    products ||--o{ wishlists : "product_id"
    users ||--o{ wishlists : "user_id"
```

### 5.5. Nhóm 5 – Mô hình 3D (AR đã bỏ)

```mermaid
erDiagram
    product_3d_models {
        integer id PK
        uuid uuid UK
        integer product_id FK
        integer variant_id FK
        integer length_mm
        integer width_mm
        integer height_mm
        model_placement placement
        boolean allow_scaling
        jsonb viewer_config
        integer poster_media_id FK
        model_status status
        integer version
        boolean is_primary
        timestamptz created_at
        timestamptz updated_at
    }
    model_files {
        integer id PK
        integer model_id FK
        model_file_format format
        model_lod lod
        integer media_id FK
        integer polygon_count
        integer texture_resolution
        boolean is_compressed
        varchar checksum
        timestamptz created_at
        timestamptz updated_at
    }
    model_material_variants {
        integer id PK
        integer model_id FK
        integer variant_id FK
        varchar material_name
        jsonb config
        timestamptz created_at
        timestamptz updated_at
    }
    media ||--o{ model_files : "media_id"
    product_3d_models ||--o{ model_files : "model_id"
    product_3d_models ||--o{ model_material_variants : "model_id"
    product_variants ||--o{ model_material_variants : "variant_id"
    media |o--o{ product_3d_models : "poster_media_id"
    products ||--o{ product_3d_models : "product_id"
    product_variants |o--o{ product_3d_models : "variant_id+product_id"
    product_3d_models |o--o{ space_product_placements : "model_id"
```

### 5.6. Nhóm 6 – Giỏ hàng và đơn hàng

```mermaid
erDiagram
    carts {
        integer id PK
        integer user_id FK,UK
        timestamptz created_at
        timestamptz updated_at
    }
    cart_items {
        integer id PK
        integer cart_id FK
        integer variant_id FK
        integer quantity
        timestamptz created_at
        timestamptz updated_at
    }
    coupons {
        integer id PK
        citext code UK
        coupon_type type
        numeric value
        numeric max_discount
        numeric min_order_value
        integer usage_limit
        integer per_user_limit
        integer used_count
        timestamptz starts_at
        timestamptz ends_at
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    coupon_usages {
        integer id PK
        integer coupon_id FK
        integer user_id FK
        integer order_id FK
        timestamptz created_at
    }
    orders {
        integer id PK
        uuid uuid UK
        varchar order_code UK
        integer user_id FK
        order_status status
        varchar recipient_name
        varchar recipient_phone
        varchar shipping_province
        varchar shipping_district
        varchar shipping_ward
        varchar shipping_address
        numeric subtotal
        numeric discount_amount
        numeric shipping_fee
        numeric total
        integer coupon_id FK
        payment_method payment_method
        order_payment_status payment_status
        text note
        text cancel_reason
        timestamptz created_at
        timestamptz updated_at
    }
    order_items {
        integer id PK
        integer order_id FK
        integer variant_id FK
        varchar product_name
        varchar sku
        numeric unit_price
        integer quantity
        numeric line_total
        timestamptz created_at
    }
    order_status_history {
        integer id PK
        integer order_id FK
        order_status from_status
        order_status to_status
        integer changed_by FK
        text note
        timestamptz created_at
    }
    payments {
        integer id PK
        integer order_id FK
        payment_method method
        numeric amount
        payment_txn_status status
        varchar transaction_code UK
        jsonb gateway_response
        timestamptz paid_at
        timestamptz created_at
        timestamptz updated_at
    }
    shipments {
        integer id PK
        integer order_id FK
        shipment_carrier carrier
        varchar tracking_code
        shipment_status status
        numeric fee
        timestamptz shipped_at
        timestamptz delivered_at
        timestamptz created_at
        timestamptz updated_at
    }
    carts ||--o{ cart_items : "cart_id"
    product_variants ||--o{ cart_items : "variant_id"
    users ||--o| carts : "user_id"
    coupons ||--o{ coupon_usages : "coupon_id"
    orders ||--o{ coupon_usages : "order_id"
    users ||--o{ coupon_usages : "user_id"
    orders ||--o{ order_items : "order_id"
    product_variants |o--o{ order_items : "variant_id"
    coupons |o--o{ orders : "coupon_id"
    users ||--o{ orders : "user_id"
    users |o--o{ order_status_history : "changed_by"
    orders ||--o{ order_status_history : "order_id"
    orders ||--o{ payments : "order_id"
    orders |o--o{ reviews : "order_id"
    orders ||--o{ shipments : "order_id"
```

### 5.7. Nhóm 7 – Không gian mẫu

```mermaid
erDiagram
    spaces {
        integer id PK
        uuid uuid UK
        varchar title
        varchar slug UK
        text description
        room_type room_type
        varchar style
        integer category_id FK
        integer cover_media_id FK
        content_status status
        timestamptz published_at
        timestamptz created_at
        timestamptz updated_at
    }
    space_panoramas {
        integer id PK
        integer space_id FK
        integer media_id FK
        varchar title
        numeric default_yaw
        numeric default_pitch
        numeric default_fov
        integer sort_order
        boolean is_start
        timestamptz created_at
        timestamptz updated_at
    }
    space_hotspots {
        integer id PK
        integer panorama_id FK
        hotspot_type type
        numeric yaw
        numeric pitch
        integer product_id FK
        integer target_panorama_id FK
        varchar title
        text content
        timestamptz created_at
        timestamptz updated_at
    }
    space_product_placements {
        integer id PK
        integer panorama_id FK
        integer product_id FK
        integer variant_id FK
        integer model_id FK
        numeric yaw
        numeric pitch
        numeric distance
        numeric rotation_x
        numeric rotation_y
        numeric rotation_z
        numeric scale
        timestamptz created_at
        timestamptz updated_at
    }
    space_panoramas ||--o{ space_hotspots : "panorama_id"
    products |o--o{ space_hotspots : "product_id"
    space_panoramas |o--o{ space_hotspots : "target_panorama_id"
    media ||--o{ space_panoramas : "media_id"
    spaces ||--o{ space_panoramas : "space_id"
    product_3d_models |o--o{ space_product_placements : "model_id"
    space_panoramas ||--o{ space_product_placements : "panorama_id"
    products ||--o{ space_product_placements : "product_id"
    product_variants |o--o{ space_product_placements : "variant_id+product_id"
    categories |o--o{ spaces : "category_id"
    media |o--o{ spaces : "cover_media_id"
```

### 5.8. Sơ đồ tổng quan (chỉ tên bảng và quan hệ)

```mermaid
erDiagram
    users |o--o{ activity_logs : "actor_id"
    users ||--o{ addresses : "user_id"
    carts ||--o{ cart_items : "cart_id"
    product_variants ||--o{ cart_items : "variant_id"
    users ||--o| carts : "user_id"
    media |o--o{ categories : "image_media_id"
    categories |o--o{ categories : "parent_id"
    coupons ||--o{ coupon_usages : "coupon_id"
    orders ||--o{ coupon_usages : "order_id"
    users ||--o{ coupon_usages : "user_id"
    users |o--o{ media : "uploaded_by"
    media ||--o{ model_files : "media_id"
    product_3d_models ||--o{ model_files : "model_id"
    product_3d_models ||--o{ model_material_variants : "model_id"
    product_variants ||--o{ model_material_variants : "variant_id"
    users ||--o{ notifications : "user_id"
    orders ||--o{ order_items : "order_id"
    product_variants |o--o{ order_items : "variant_id"
    coupons |o--o{ orders : "coupon_id"
    users ||--o{ orders : "user_id"
    users |o--o{ order_status_history : "changed_by"
    orders ||--o{ order_status_history : "order_id"
    users ||--o{ password_resets : "user_id"
    orders ||--o{ payments : "order_id"
    media |o--o{ product_3d_models : "poster_media_id"
    products ||--o{ product_3d_models : "product_id"
    product_variants |o--o{ product_3d_models : "variant_id+product_id"
    media ||--o{ product_images : "media_id"
    products ||--o{ product_images : "product_id"
    product_variants |o--o{ product_images : "variant_id+product_id"
    categories |o--o{ products : "category_id"
    products ||--o{ product_variants : "product_id"
    orders |o--o{ reviews : "order_id"
    products ||--o{ reviews : "product_id"
    users ||--o{ reviews : "user_id"
    orders ||--o{ shipments : "order_id"
    space_panoramas ||--o{ space_hotspots : "panorama_id"
    products |o--o{ space_hotspots : "product_id"
    space_panoramas |o--o{ space_hotspots : "target_panorama_id"
    media ||--o{ space_panoramas : "media_id"
    spaces ||--o{ space_panoramas : "space_id"
    product_3d_models |o--o{ space_product_placements : "model_id"
    space_panoramas ||--o{ space_product_placements : "panorama_id"
    products ||--o{ space_product_placements : "product_id"
    product_variants |o--o{ space_product_placements : "variant_id+product_id"
    categories |o--o{ spaces : "category_id"
    media |o--o{ spaces : "cover_media_id"
    media |o--o{ users : "avatar_media_id"
    users ||--o{ user_sessions : "user_id"
    attribute_values ||--o{ variant_attribute_values : "attribute_value_id+attribute_code"
    product_variants ||--o{ variant_attribute_values : "variant_id"
    products ||--o{ wishlists : "product_id"
    users ||--o{ wishlists : "user_id"
```

### 5.9. Sơ đồ tổng quan toàn bộ 32 bảng (chỉ tên bảng và quan hệ)

Sinh từ `schema.prisma` (49 quan hệ khóa ngoại). Bảng không có quan hệ khóa ngoại nên không xuất hiện trong sơ đồ: `settings`.

```mermaid
erDiagram
    users |o--o{ activity_logs : "actor_id"
    users ||--o{ addresses : "user_id"
    carts ||--o{ cart_items : "cart_id"
    product_variants ||--o{ cart_items : "variant_id"
    coupons |o--o{ carts : "coupon_id"
    users ||--o{ carts : "user_id"
    media |o--o{ categories : "image_media_id"
    coupons ||--o{ coupon_usages : "coupon_id"
    orders ||--o{ coupon_usages : "order_id"
    users ||--o{ coupon_usages : "user_id"
    media ||--o{ model_files : "media_id"
    product_3d_models ||--o{ model_files : "model_id"
    product_3d_models ||--o{ model_material_variants : "model_id"
    product_variants ||--o{ model_material_variants : "variant_id"
    users ||--o{ notifications : "user_id"
    orders ||--o{ order_items : "order_id"
    product_variants |o--o{ order_items : "variant_id"
    users |o--o{ order_status_history : "changed_by"
    orders ||--o{ order_status_history : "order_id"
    coupons |o--o{ orders : "coupon_id"
    users ||--o{ orders : "user_id"
    users ||--o{ password_resets : "user_id"
    orders ||--o{ payments : "order_id"
    media |o--o{ product_3d_models : "poster_media_id"
    products ||--o{ product_3d_models : "product_id"
    product_variants |o--o{ product_3d_models : "variant_id,product_id"
    media ||--o{ product_images : "media_id"
    products ||--o{ product_images : "product_id"
    product_variants |o--o{ product_images : "variant_id,product_id"
    products ||--o{ product_variants : "product_id"
    categories |o--o{ products : "category_id"
    orders |o--o{ reviews : "order_id"
    products ||--o{ reviews : "product_id"
    users ||--o{ reviews : "user_id"
    orders ||--o{ shipments : "order_id"
    products |o--o{ space_hotspots : "product_id"
    media ||--o{ space_panoramas : "media_id"
    spaces ||--o{ space_panoramas : "space_id"
    product_3d_models |o--o{ space_product_placements : "model_id"
    space_panoramas ||--o{ space_product_placements : "panorama_id"
    products ||--o{ space_product_placements : "product_id"
    product_variants |o--o{ space_product_placements : "variant_id,product_id"
    categories |o--o{ spaces : "category_id"
    media |o--o{ spaces : "cover_media_id"
    users ||--o{ user_sessions : "user_id"
    attribute_values ||--o{ variant_attribute_values : "attribute_value_id,attribute_code"
    product_variants ||--o{ variant_attribute_values : "variant_id"
    products ||--o{ wishlists : "product_id"
    users ||--o{ wishlists : "user_id"
```

## 6. Trigger và hàm tự động (`05_functions_triggers.sql`)

| # | Trigger | Bảng | Sự kiện | Việc làm |
| --- | --- | --- | --- | --- |
| 1 | `trg_<bảng>_set_updated_at` (23 trigger) | mọi bảng có cột `updated_at` | BEFORE UPDATE | `set_updated_at()` gán `updated_at = now()`. Gắn bằng vòng lặp theo danh mục hệ thống nên thêm bảng mới không cần sửa file |
| 2 | `trg_reviews_refresh_rating` | `reviews` | AFTER INSERT / UPDATE (rating, status, product_id) / DELETE | Tính lại `products.rating_avg`, `rating_count` chỉ từ review `approved` |
| 3a | `trg_product_3d_models_refresh_flags` | `product_3d_models` | AFTER INSERT / UPDATE (status, product_id) / DELETE | Cập nhật `products.has_3d_model` (có mô hình `ready`). Đã bỏ phần `has_ar` (migration `remove_ar`) |
| 3b | `trg_model_files_refresh_flags` | `model_files` | AFTER INSERT / UPDATE (format, model_id) / DELETE | Như trên |
| 4a | `trg_orders_log_status_insert` | `orders` | AFTER INSERT | Ghi dòng khởi tạo vào `order_status_history` (`from_status` NULL) |
| 4b | `trg_orders_log_status_update` | `orders` | AFTER UPDATE OF status (khi đổi) | Ghi `from_status → to_status`. `changed_by` lấy từ biến phiên `app.current_user_id`, ghi chú từ `app.status_note` (dùng `SET LOCAL` trong transaction); không đặt thì `changed_by` là NULL |

Hàm hỗ trợ: `immutable_unaccent(text)` (file 01), `refresh_product_rating(integer)`, `refresh_product_3d_flags(integer)`.

Đã bỏ: `trg_space_views_increase_count` (cùng bảng `space_views` và cột `spaces.view_count`) và `trg_users_assign_default_role` (cùng hàm của nó; vai trò mặc định nay là `users.role DEFAULT 'user'`).

**Sequence:** `order_code_seq` sinh số thứ tự cho mã đơn `ALV-YYYYMMDD-NNNNNN` (thay bảng `code_counters`); giá trị khởi đầu của sequence được đặt theo mã đơn lớn nhất hiện có khi chạy migration `20261119010100_remove_21_tables`.

Tìm kiếm không dấu: `WHERE immutable_unaccent(title) ILIKE '%' || immutable_unaccent('phong khach') || '%'` dùng được index `idx_spaces_title_unaccent_trgm`.

## 7. Nghiệp vụ để tầng Service xử lý (KHÔNG cài trigger)

Các việc này cần khóa dòng, trả lỗi nghiệp vụ rõ ràng và chạy **trong một transaction** ở tầng Service:

1. **Trừ/hoàn tồn kho**: khi đặt hàng trừ `product_variants.stock_quantity` (dùng `SELECT ... FOR UPDATE` hoặc `UPDATE ... WHERE stock_quantity >= n`), khi hủy thì cộng lại (CSDL chỉ chặn tồn âm). Không còn bảng lịch sử tồn kho (`inventory_movements`): trang Kho chỉ xem tồn, sửa tồn qua form biến thể của sản phẩm.
2. **Tăng `products.sold_count`** khi đơn hoàn tất (và giảm khi hoàn tiền nếu muốn).
3. **Mã giảm giá**: kiểm tra `is_active`, thời gian hiệu lực, `min_order_value`, `usage_limit` so với `used_count`, `per_user_limit` so với số dòng `coupon_usages` của user; tính `discount_amount` (có `max_discount`); ghi `coupon_usages` và tăng `coupons.used_count`. Mã áp cho toàn giỏ (không còn phạm vi theo sản phẩm/danh mục). CSDL chỉ bảo đảm `(coupon_id, order_id)` không trùng.
4. **Chỉ người đã mua mới được đánh giá**: kiểm tra `reviews.order_id` thuộc `user_id`, đơn `completed` và có chứa sản phẩm.
5. **Tính tiền đơn hàng**: `subtotal`, `discount_amount`, `shipping_fee`, `total` (CSDL chỉ kiểm tra `total = subtotal - discount_amount + shipping_fee`); chụp địa chỉ vào `orders`, chụp tên/SKU/giá vào `order_items`.
6. **Quy tắc "đúng một"**: bảo đảm mỗi sản phẩm luôn có một ảnh đại diện, một mô hình chính; mỗi space có một ảnh mở đầu; khi đổi địa chỉ mặc định phải bỏ cờ cũ trước khi đặt cờ mới (partial unique index chỉ chặn trường hợp có hai).
7. **Giỏ hàng**: tạo giỏ (`carts`) lúc đăng ký hoặc lúc thêm sản phẩm đầu tiên; chỉ cho phép khi đã đăng nhập; kiểm tra biến thể còn bán (`is_active`, còn hàng).
8. **Phân quyền truy cập**: lọc theo `user_id` của người đăng nhập (mục 2), kiểm tra quyền admin theo `users.role` và hằng số `ROLE_PERMISSIONS` (không còn bảng phân quyền), ghi `activity_logs` cho mọi thao tác admin và bảo đảm `actor_id` là admin.
9. **Vòng đời đơn/thanh toán/vận chuyển**: chuyển trạng thái hợp lệ (ví dụ không từ `completed` về `pending`), đồng bộ `orders.payment_status` với `payments.status`, `shipments`.
10. **Tính nhất quán 3D**: chuyển `product_3d_models.status` sang `ready` sau khi xử lý xong file; mô hình của biến thể cần cấu hình `model_material_variants` khớp sản phẩm (CSDL chưa kiểm tra `model_material_variants.variant_id` có cùng sản phẩm với mô hình).
11. **Dọn dữ liệu**: xóa `password_resets`, `user_sessions` hết hạn; xóa mềm `users`/`products` thay vì xóa cứng (nhiều khóa ngoại `RESTRICT`).
12. **Thống kê lượt xem không gian mẫu**: đã bỏ cùng bảng `space_views` và cột `spaces.view_count`. Bảng thống kê AR cũng đã bỏ (D-P16).

## 8. Thay đổi

### 8.0. Migration `media_file_size_int`

`media.file_size` đổi từ `BIGINT` sang `INTEGER` (CHECK `>= 0` giữ nguyên) để Prisma trả `number` thay vì `BigInt`. `database/03_tables.sql` đã cập nhật cho khớp; `0_init` giữ nguyên (lịch sử).

### 8.1. Lần đồng bộ Prisma

- Toàn bộ khóa chính và khóa ngoại đổi từ `BIGINT` sang `INTEGER` (giữ nguyên các cột `uuid`); Prisma sinh `Int`. `media.file_size` ban đầu giữ `BIGINT`, sau đó đổi sang `INTEGER` bằng migration `media_file_size_int`.
- Đã xóa schema cũ của Prisma (`apps/api/prisma/schema.sql`, `migrations/20261001000000_init`). `schema.prisma` được sinh lại bằng `prisma db pull` từ DB dựng bởi `database/01..05`, rồi đổi tên: model PascalCase số ít (`@@map`), field camelCase (`@map`), quan hệ đặt theo khóa ngoại (`user`, `product`, `variant`...), cặp model có nhiều quan hệ được đặt tên tường minh (`SpaceHotspotPanorama`/`SpaceHotspotTargetPanorama`, `MediaUploadedByUser`/`UserAvatarMedia`...), ENUM đổi sang PascalCase (`@@map`).
- Migration baseline `prisma/migrations/0_init/migration.sql` = nối nguyên văn `database/01..05` (không gồm seed), đã `migrate resolve --applied`.
- `prisma/seed.ts` viết lại (idempotent, `bcryptjs`); khai báo `"prisma": { "seed": "ts-node prisma/seed.ts" }` trong `apps/api/package.json`.
- `database/` chuyển sang vai trò tài liệu tham khảo ([database/README.md](../database/README.md)).
- Kiểm tra: `migrate deploy` trên DB trống so với DB dựng từ `run_all.sql` cho `prisma migrate diff` rỗng; `schema.prisma` so với DB cũng rỗng; `prisma generate` và `tsc --noEmit` không lỗi.

### 8.2. So với schema thiết kế trước đó (`apps/api/prisma/schema.sql`, đã xóa)

Thư mục `database/` chưa tồn tại trước lần build đầu tiên; so sánh với schema cũ của Prisma:

| Hạng mục | Schema cũ | Hiện tại |
| --- | --- | --- |
| Vai trò | `admin`, `editor`, `staff`, `customer` | Chỉ `admin`, `user`; khách vãng lai không lưu |
| Quyền | 7 quyền (`user.manage`, `post.manage`, `space.manage`...), phân cho editor/staff | 6 quyền (`manage_users`, `manage_products`, `view_orders`, `process_orders`, `manage_content`, `manage_settings`); chỉ admin có |
| Khóa chính | `UUID` | `INTEGER IDENTITY` + cột `uuid` ở `users`, `orders`, `spaces`, `product_3d_models` |
| `carts` | `user_id` nullable + `session_id` (giỏ của khách) | `user_id` NOT NULL UNIQUE, bỏ `session_id` |
| `activity_logs` | `user_id` UUID, `target_id` UUID | `actor_id` (admin), `target_id` INTEGER |
| ENUM | `user_status` có `inactive`; `publish_status`; `payment_status` dùng chung; `shipment_status` không có `failed`; `model_format` 6 giá trị; `ar_placement` có `any`; `space_room_type` có `kids_room`, `outdoor` | `user_status` có `suspended`; `content_status`; tách `order_payment_status` và `payment_txn_status`; `shipment_status` thêm `failed`; `model_file_format` chỉ `glb`, `usdz`; `model_placement` chỉ `floor/wall/table`; `room_type` có `bathroom`, bỏ `kids_room`, `outdoor` |
| Hàm bỏ dấu | `f_unaccent` | `immutable_unaccent` |
| Khóa ngoại kép | không có | `(variant_id, product_id)`, `(attribute_value_id, attribute_code)` |
| `reviews` | — | `UNIQUE NULLS NOT DISTINCT (user_id, product_id, order_id)` |
| `order_status_history` | — | Trigger ghi cả dòng khởi tạo đơn (`from_status` NULL) |

### 8.3. Ánh xạ Tên bảng ↔ Model Prisma

Tên field là camelCase của tên cột (`full_name` → `fullName`, `created_at` → `createdAt`); quan hệ lấy tên theo khóa ngoại bỏ hậu tố `_id` (`user_id` → `user`).

| # | Bảng | Model Prisma | Truy cập trong code |
| --- | --- | --- | --- |
| 1 | `users` | `User` | `prisma.user` |
| 2 | `password_resets` | `PasswordReset` | `prisma.passwordReset` |
| 3 | `user_sessions` | `UserSession` | `prisma.userSession` |
| 4 | `addresses` | `Address` | `prisma.address` |
| 5 | `settings` | `Setting` | `prisma.setting` |
| 6 | `media` | `Media` | `prisma.media` |
| 7 | `notifications` | `Notification` | `prisma.notification` |
| 8 | `activity_logs` | `ActivityLog` | `prisma.activityLog` |
| 9 | `categories` | `Category` | `prisma.category` |
| 10 | `products` | `Product` | `prisma.product` |
| 11 | `attribute_values` | `AttributeValue` | `prisma.attributeValue` |
| 12 | `product_variants` | `ProductVariant` | `prisma.productVariant` |
| 13 | `variant_attribute_values` | `VariantAttributeValue` | `prisma.variantAttributeValue` |
| 14 | `product_images` | `ProductImage` | `prisma.productImage` |
| 15 | `reviews` | `Review` | `prisma.review` |
| 16 | `wishlists` | `Wishlist` | `prisma.wishlist` |
| 17 | `product_3d_models` | `Product3DModel` | `prisma.product3DModel` |
| 18 | `model_files` | `ModelFile` | `prisma.modelFile` |
| 19 | `model_material_variants` | `ModelMaterialVariant` | `prisma.modelMaterialVariant` |
| 20 | `carts` | `Cart` | `prisma.cart` |
| 21 | `cart_items` | `CartItem` | `prisma.cartItem` |
| 22 | `coupons` | `Coupon` | `prisma.coupon` |
| 23 | `coupon_usages` | `CouponUsage` | `prisma.couponUsage` |
| 24 | `orders` | `Order` | `prisma.order` |
| 25 | `order_items` | `OrderItem` | `prisma.orderItem` |
| 26 | `order_status_history` | `OrderStatusHistory` | `prisma.orderStatusHistory` |
| 27 | `payments` | `Payment` | `prisma.payment` |
| 28 | `shipments` | `Shipment` | `prisma.shipment` |
| 29 | `spaces` | `Space` | `prisma.space` |
| 30 | `space_panoramas` | `SpacePanorama` | `prisma.spacePanorama` |
| 31 | `space_hotspots` | `SpaceHotspot` | `prisma.spaceHotspot` |
| 32 | `space_product_placements` | `SpaceProductPlacement` | `prisma.spaceProductPlacement` |

Lưu ý khi dùng Prisma Client:

- `User.email` **không có `@unique`** (DB dùng partial unique index trên bản ghi chưa xóa mềm): tra cứu bằng `findFirst({ where: { email, deletedAt: null } })`, không dùng `findUnique`.
- `Product.ratingAvg`, `ratingCount`, `has3dModel`, `OrderItem.lineTotal` do DB tự tính: không ghi từ app.
- `User.role` là enum Prisma `UserRole` (`admin` | `user`); vai trò kiểm tra bằng `user.role`, không còn quan hệ nhiều-nhiều. `AttributeValue.attributeCode` là enum `AttributeCode`; `Product.brand` là `String?`.
- Mã đơn lấy từ sequence: `SELECT nextval('order_code_seq')` qua `$queryRaw`.
- Đổi trạng thái đơn hàng trong transaction nên đặt người thực hiện: `SELECT set_config('app.current_user_id', '<id>', true)` (tương đương `SET LOCAL`) để `order_status_history.changed_by` có giá trị.
- Tìm kiếm không dấu / gần đúng (`Space.title`, `Product.name`) dùng `$queryRaw` với `immutable_unaccent()` và `ILIKE`, vì Prisma không biểu diễn index biểu thức.
- Số tiền là `Decimal` (`Prisma.Decimal`), không phải `number`.

### 8.x. Đồng bộ với code ngày 2026-11-11

- Đối chiếu với `apps/api/prisma/schema.prisma` (59 model, 25 enum, 86 quan hệ khóa ngoại): thêm nhóm 8 (17 bảng mở rộng, từ điển cột), mục 5.9–5.10 (ERD Mermaid sinh từ schema), STT 45–61 ở bảng ánh xạ Prisma. `prisma migrate diff` giữa migration và schema rỗng (không lệch) trên `aurelia_test`.
- AR đã loại bỏ hoàn toàn khỏi schema (migration `20261109010100_remove_ar`); giá trị `usdz` của enum `model_file_format` được giữ để không xóa dữ liệu cũ, code chỉ nhận GLB.
- `aurelia_dev` đã áp migration `remove_ar` ngày 2026-11-11 (đã sao lưu trước; `migrate status` sạch, `migrate diff` rỗng).

### 8.4. Rút gọn còn 32 bảng (2026-11-19 → 2026-11-20, nhánh `db/remove-21-tables`)

Migration theo thứ tự: `20261119010100_remove_21_tables`, `20261119020100_drop_coupon_applies_columns`, `20261120010100_users_role_enum`, `20261120020100_attribute_code_enum`, `20261120030100_products_brand_text`. Mỗi bước: thêm cột/chuyển dữ liệu → kiểm tra số dòng → mới xóa.

| Thay đổi | Cách thay thế |
| --- | --- |
| Xóa 21 bảng: `product_specs`, `product_360_configs`, `product_360_frames`, `review_images`, `product_questions`, `coupon_scopes`, `user_coupons`, `code_counters`, `return_requests`, `return_request_items`, `return_request_images`, `stock_receipts`, `stock_receipt_items`, `expenses`, `banners`, `posts`, `contact_messages`, `pages`, `inventory_movements`, `space_bookmarks`, `space_views` | Tính năng tương ứng bị gỡ; mã đơn dùng sequence `order_code_seq`; trang tĩnh viết cứng ở `apps/web/src/content/static-pages.ts` |
| Xóa `spaces.view_count`, trigger `trg_space_views_increase_count`, `coupons.applies_to`, `coupons.applies_to_label` và các enum liên quan | Mã giảm giá áp cho toàn giỏ |
| `roles`, `permissions`, `role_permissions`, `user_roles`, trigger `trg_users_assign_default_role` | Cột `users.role` (enum `user_role`: admin/user, mặc định user) và hằng số `ROLE_PERMISSIONS` |
| `attributes` | Enum `attribute_code` (color/size/material) trên `attribute_values` và `variant_attribute_values`; chỉ còn 3 loại cố định |
| `brands`, `products.brand_id` | Cột chữ `products.brand` VARCHAR(150) NULL |

Hành vi thay đổi: doanh thu chỉ tính đơn `completed` (net = gross − discount), không còn chi phí/lợi nhuận; kho chỉ xem tồn, sửa tồn qua form biến thể sản phẩm; một người một vai trò; admin không nằm trong danh sách khách hàng.

## 9. Quyết định đã chốt và điểm còn vướng

### 9.1. Đã xác nhận

1. Đồng bộ Prisma: đã làm (mục 8.1).
2. ~~Giữ trigger tự gán vai trò `user` (CONSTRAINT TRIGGER deferred).~~ Đã bỏ: vai trò mặc định là `users.role DEFAULT 'user'` (mục 8.4).
3. Đăng ký / đăng nhập / quên mật khẩu là luồng xác thực do API xử lý cho người chưa đăng nhập (ký hiệu ‡ ở mục 2).
4. `activity_logs`: không cài trigger; tầng Service bảo đảm `actor_id` là admin.
5. Giữ trigger ghi `order_status_history` cả lúc tạo đơn.

### 9.2. Còn vướng / lưu ý

1. **Prisma không thấy** CHECK, partial unique index, trigger, index biểu thức/GIN, generated column, `NULLS NOT DISTINCT`. Chúng nằm trong `0_init`. `migrate dev` về sau không tự bỏ chúng (đã kiểm tra `migrate diff` từ DB sang `schema.prisma` rỗng), nhưng luôn cần đọc lại SQL sinh ra; với CHECK/trigger dùng `--create-only`.
2. **`order_items.line_total`** là generated column nhưng Prisma Client thấy như cột có default (kiểu `Decimal?`); gán giá trị từ app sẽ bị PostgreSQL từ chối.
3. **`media.file_size` là `INTEGER`** (migration `media_file_size_int`): tối đa khoảng 2 GB mỗi tệp; tệp lớn hơn cần đổi kiểu bằng migration mới.
4. **`model_material_variants`** chưa ép biến thể cùng sản phẩm với mô hình (cần trigger hoặc cột `product_id` thừa); hiện Service kiểm tra.
5. **`ON DELETE`**: `categories.parent_id` là `RESTRICT`; media bắt buộc (`product_images`, `model_files`, `space_panoramas`) là `RESTRICT`; `space_hotspots.product_id` là `CASCADE` để không vi phạm CHECK của chính bảng. Xóa cứng user bị chặn khi còn đơn hoặc lượt dùng mã; dùng xóa mềm.
6. **Dữ liệu mẫu** (`seed.ts`, `07_sample_data.sql`) ghi tay các thay đổi mà Service sẽ làm (trừ kho, `sold_count`, `used_count`); chỉ dùng cho dev (`SEED_SAMPLE=false` để bỏ).
7. **Seed** dùng `bcryptjs` (băm bcrypt, tương thích `crypt()` của pgcrypto trong phần seed SQL). Mật khẩu admin mặc định phải đổi trước khi triển khai thật.
8. **`npm install` ở thư mục gốc** (workspaces) bị lỗi `EPERM` trên máy này khi xóa thư mục trong `node_modules`; phụ thuộc của `apps/api` được cài bằng `npm install --workspaces=false` trong `apps/api`. `package-lock.json` gốc chưa được cập nhật cho `bcryptjs`, nên cần chạy `npm install` ở gốc trên môi trường không bị lỗi này.
