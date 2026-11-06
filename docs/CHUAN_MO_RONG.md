# CHUAN_MO_RONG – Những gì dự án GIỮ hoặc LÀM THÊM ngoài bộ tài liệu chuẩn

> Bộ chuẩn (không sửa): `CAU_TRUC_DB.md`, `DATABASE_SCHEMA.md`, `QUY_UOC_CODE_DB.md`, `CONG_NGHE.md`; phạm vi chức năng: `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`.
> Khi mâu thuẫn: **4 file chuẩn + đặc tả > quyết định của chủ dự án > code hiện có.** Code lệch chuẩn thì sửa theo chuẩn; thứ gì chuẩn chưa có mà dự án vẫn cần thì ghi **ở đây** (thay cho việc cập nhật `DATABASE_SCHEMA.md` sau mỗi migration).
> Cập nhật lần cuối: 2026-11-07 (sau bước 8, nhánh `feature/backend`). Trạng thái DB: **61 bảng** (44 bảng chuẩn + 17 bảng mở rộng bên dưới), **26 ENUM**, **15 migration** (gồm `0_init`; xem `apps/api/prisma/migrations`).

Mọi bảng/cột mở rộng bên dưới tuân theo `QUY_UOC_CODE_DB.md`: tên `snake_case` số nhiều, khóa chính `id INTEGER GENERATED ALWAYS AS IDENTITY` (trừ `code_counters`), ràng buộc đặt tên `pk_/fk_/uq_/ck_/idx_`, trigger `trg_<bảng>_updated_at` với bảng có `updated_at`, `COMMENT ON` tiếng Việt.

---

## Phần 1. Cơ sở dữ liệu

### 1.1 Bảng mở rộng (17) – chuẩn không có, FE/nghiệp vụ cần

| Bảng | Cột chính | Để làm gì | Vì sao giữ |
|---|---|---|---|
| `product_specs` | `product_id`, `label`, `value`, `sort_order` | Bảng thông số kỹ thuật của sản phẩm (tab "Thông số", FE màn 17/3) | Gộp vào `products` dạng JSON làm mất khả năng sửa từng dòng |
| `product_360_configs` | `product_id` (UNIQUE), `enabled`, `auto_rotate`, `rotation_speed`, `default_color_id`, `frame_count`, `created_at`, `updated_at` | Cấu hình xem 360° (xoay ảnh) của sản phẩm | Tính năng "Xem 360°" (`PROMPT_360_SAN_PHAM.md`); chuẩn chỉ nhắc, chưa có bảng |
| `product_360_frames` | `config_id`, `attribute_value_id` (màu), `frame_index`, `media_id` | Từng ảnh frame theo màu | như trên |
| `review_images` | `review_id`, `media_id`, `sort_order` | Ảnh đính kèm đánh giá (≤ 5) | Khách đính ảnh khi đánh giá |
| `product_questions` | `product_id`, `user_id`, `content`, `answer`, `answered_by`, `answered_at`, `is_public`, `status`, `created_at` | Hỏi đáp sản phẩm (FE màn 50) | FE có màn hình, đặc tả chưa có UC |
| `coupon_scopes` | `coupon_id`, `target_type`, `target_id` | Mã giảm giá theo sản phẩm/danh mục/không gian | `target_id` là khóa đa hình **không có FK** (tránh 3 bảng nối) |
| `user_coupons` | `user_id`, `coupon_id`, `saved_at` | "Mã đã lưu" của khách (màn 9) | FE có chức năng lưu mã |
| `code_counters` | `key` (PK), `value` BIGINT | Cấp mã `ALV-YYYYMMDD-NNNN`, `RT…`, phiếu kho, phiếu chi không trùng khi đặt đồng thời | Test 6 đơn đồng thời; thay cho UNIQUE + retry |
| `return_requests` | `code`, `order_id`, `user_id`, `type` (refund/exchange), `reason`, `description`, `status`, `refund_amount`, `admin_note`, `created_at`, `updated_at` | Yêu cầu đổi/trả hàng (FE màn 35, 45) | Đặc tả chỉ có "hoàn tiền thủ công" (UC-ADM-23) |
| `return_request_items` | `request_id`, `order_item_id`, `quantity`, `exchange_variant_id` (NULL = đổi cùng biến thể) | Dòng hàng trả/đổi | như trên |
| `return_request_images` | `request_id`, `media_id` | Ảnh minh chứng | như trên |
| `stock_receipts` | `code`, `type` (in/out), `supplier_name` (chữ, không FK), `order_code`, `status` (draft/confirmed/cancelled), `created_by`, `created_at` | **Phiếu** nhập/xuất kho (trang Kho, màn 53). Xác nhận phiếu ⇒ ghi `inventory_movements` (xem 1.3) | Quyết định chủ dự án (phương án b′): giữ phiếu như chứng từ, sổ cái vẫn là `inventory_movements`. Bảng `suppliers` đã **bỏ** |
| `stock_receipt_items` | `receipt_id`, `variant_id`, `quantity`, `cost_price` | Dòng phiếu kho | như trên |
| `expenses` | `code`, `category`, `amount`, `note`, `date`, `order_id`, `receipt_id`, `created_at` | Phiếu chi (màn 54); hoàn tiền đổi trả tự sinh phiếu chi `refund` | Không có chỗ gộp tự nhiên |
| `banners` | `title`, `subtitle`, `image_media_id`, `link`, `position`, `start_at`, `end_at`, `sort_order`, `is_active`, `created_at` | Banner trang chủ (màn 51) | FE quản lý nội dung |
| `posts` | `title`, `slug`, `category`, `cover_media_id`, `content` (Markdown), `author_name`, `status`, `views`, `published_at`, `created_at` | Bài viết/blog (màn 51) | `pages` thiếu ảnh bìa, chuyên mục, lượt xem |
| `contact_messages` | `full_name`, `phone`, `email`, `subject`, `content`, `handled_at`, `handled_by`, `created_at` | Tin nhắn từ form Liên hệ (màn 38) | FE có form, admin có xử lý |

Đã **gộp/bỏ** theo quyết định: FAQ (`faq_topics`, `faq_items`) → lưu JSON trong `settings` khóa `faq`; `suppliers` → cột chữ `stock_receipts.supplier_name`.

### 1.2 ENUM mở rộng (9) và giá trị thêm

`question_status`, `return_type`, `return_reason`, `return_status`, `stock_receipt_type`, `stock_receipt_status`, `expense_category`, `banner_position`, và giá trị `coupon_type = 'freeship'` (mã giảm phí vận chuyển).

### 1.3 Cột thêm trên bảng chuẩn

| Bảng | Cột thêm | Ghi chú |
|---|---|---|
| `users` | `birthday`, `gender`, `loyalty_points`, `admin_note` | `loyalty_points` **chưa có logic cộng điểm** (xem Phần 3) |
| `addresses` | `label` | Nhãn "Nhà riêng/Công ty" |
| `categories` | `description`, `is_featured` | |
| `pages` | `type` | Phân loại trang tĩnh / chính sách |
| `products` | `features` (JSONB), `style` | |
| `attribute_values` | `color_hex` | Màu swatch + 360° |
| `product_variants` | `cost_price`, `min_stock`, `length_cm`, `width_cm`, `height_cm` | Giá vốn, cảnh báo tồn thấp, kích thước |
| `reviews` | `is_anonymous`, `tags` | |
| `carts` | `coupon_id` | Mã đang áp (chuẩn nói "chỉ xem trước"; giữ cho FE – xem Phần 3) |
| `coupons` | `name`, `description`, `applies_to`, `applies_to_label` | |
| `orders` | `internal_note` | Ghi chú nội bộ admin |
| `order_items` | `cost_price`, `image_media_id`, `variant_label` | Chụp lại giá vốn/ảnh/nhãn lúc bán |
| `spaces` | `combo_discount_percent` | % giảm khi mua cả bộ (**chỉ hiển thị**, giỏ hàng chưa áp – Phần 3) |
| `password_resets` | (chuẩn: `token_hash`, `expires_at`, `used_at`) | Đã bỏ cột OTP; dùng liên kết token |

Ràng buộc/index mở rộng đi theo các bảng trên (`ck_*`, `uq_*`, `idx_*` đặt tên theo quy ước).

### 1.4 Quy tắc nghiệp vụ trong DB/code đã chốt theo chuẩn

- **Tồn kho:** `product_variants.stock_quantity` bị trừ **ngay khi đặt hàng** (movement `sale`), cộng lại khi **hủy đơn** hoặc **trả hàng được duyệt** (movement `return`). Không còn `reserved_quantity`. API `stockQuantity` = `stock_quantity`.
- **`sold_count`** tăng khi đơn sang `completed` (đã tính lại số liệu cũ bằng migration `recompute_sold_count`).
- **Đổi hàng:** cộng tồn biến thể cũ (`return`), trừ tồn biến thể mới (`sale`, mặc định cùng biến thể); thiếu hàng ⇒ `409 OUT_OF_STOCK`, giao dịch hoàn tác.
- **Hoàn tiền:** `refund_amount` = Σ(đơn giá × số lượng) × (tạm tính − giảm giá hàng hóa) ÷ tạm tính, làm tròn đồng; mã `freeship` không trừ vào tiền hàng; **không hoàn phí vận chuyển**; đơn chuyển `refunded` khi đã trả hết mọi dòng hoặc đã hoàn đủ tiền hàng.
- **Phiếu kho (sẽ làm ở Mốc 4):** xác nhận phiếu `in` ⇒ movement `import` và cập nhật `cost_price` biến thể; phiếu `out` ⇒ movement `adjustment` âm; `draft`/`cancelled` không đổi tồn; mã phiếu = `reference_code` của movement.
- **Số lượng ENUM theo từng tài liệu chuẩn khác nhau** (xem Phần 4) – tin vào DB thực.

---

## Phần 2. Công nghệ (ngoài hoặc khác `CONG_NGHE.md`)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **Email dev qua Mailpit** (`MAIL_TRANSPORT`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`) | Thử quên mật khẩu/xác thực email mà không gửi thư thật; đã ghi ở `ENVIRONMENT.md` |
| 2 | **Nội dung bài viết/trang lưu Markdown nguyên văn**; FE hiển thị bằng `react-markdown@9.1.0` (bỏ HTML thô: `skipHtml`) hỗ trợ tiêu đề, đoạn, danh sách, in đậm, liên kết | Đúng `CONG_NGHE.md` ("textarea Markdown"); chống XSS bằng cách không cho HTML. Đã bỏ `sanitize-html` |
| 3 | **Kiểm tra dữ liệu vào bằng hàm tay** (`FieldErrors`/`validate.ts`), `class-validator` chỉ còn ở DTO media/phân trang | Trả lỗi tiếng Việt theo từng trường đúng như mock FE; không có sai khác hành vi so với chuẩn |
| 4 | **Swagger tại `/docs`** (đúng chuẩn) | Trước đây `/api/docs` |
| 5 | **Docker Compose phương án (b)**: dịch vụ `api` nằm trong profile `legacy`, chạy API bằng `npm run start:dev`; giữ dịch vụ `postgres-test` | Hot reload nhanh hơn; DB test tách khỏi DB dev |
| 6 | **FE tự refresh access token** khi gặp 401 (một lần, dùng chung một promise); access token production tối đa **15 phút** (env validation từ chối cấu hình dài hơn khi `NODE_ENV=production`) | An toàn hơn token sống lâu; có test `api-refresh.test.ts` |
| 7 | **Giỏ hàng dùng `cartStore` (Zustand)** | Khớp danh sách store của chuẩn |
| 8 | **Ghim phiên bản** thư viện (không dùng `^`) | Build lặp lại được |
| 9 | **Thanh toán giả lập chỉ khi `PAYMENT_SANDBOX_FAKE=true` và `NODE_ENV≠production`**; khách **không** chọn được kết quả (chỉ ghi chú đơn chứa `[fail]` mới ép thất bại, để test); `NODE_ENV=production` mà bật cờ ⇒ app không khởi động | Chống gian lận thanh toán |
| 10 | **Lưu tệp driver `local`** cho demo/test (`apps/api/uploads`, URL `/uploads`); ảnh gửi dạng data-URL base64 trong JSON (giới hạn body 25 MB, ảnh ≤ 5 MB, frame 360° ≤ 2 MB, panorama ≤ 20 MB) | Chưa làm MinIO/presign ở lượt này (xem Phần 3) |
| 11 | Thêm gói: `react-markdown@9.1.0` (web), `dotenv-cli` (chạy với `.env` gốc) | Xem 2 và scripts |
| 12 | **Test:** Jest (unit, supertest DB thật `aurelia_test`) + Vitest (web) + Playwright chạy với API thật (`npm run test:e2e:real`, 4 nhóm) | Chuẩn chỉ nói Jest/Vitest/Playwright, chưa nêu cách chạy API thật |

Số liệu thống kê trong `CONG_NGHE.md` (số route, test, migration…) chỉ là ảnh chụp lúc viết, **không phải quy tắc**.

---

## Phần 3. Lệch tạm thời, sẽ sửa sau

Những chỗ code **chưa theo chuẩn/đặc tả** hoặc còn thiếu, đã được chủ dự án cho hoãn:

| # | Mục | Hiện trạng | Hướng sửa |
|---|---|---|---|
| 1 | MinIO / presigned upload | Dùng driver `local`; tải ảnh qua JSON base64 | Làm theo UC-ADM-04 khi có MinIO |
| 2 | Redis cache (`CacheService`) | Chưa module nào dùng; sản phẩm dùng chỉ mục RAM 15 giây | Áp dụng theo D-T30 |
| 3 | Xử lý nền mô hình 3D (`model-processing`: kiểm tra GLB, LOD) | Upload mô hình giữ luồng cũ; giới hạn 50 MB (đặc tả 100 MB) | Làm cùng MinIO |
| 4 | `PermissionsGuard` / vai trò-quyền chi tiết (UC-ADM-02) | Chỉ phân biệt khách/admin | Mốc 5 |
| 5 | `ActivityLogInterceptor` | Nhật ký ghi trực tiếp trong service (`activity_logs`) | Chuyển sang interceptor |
| 6 | UC "Mốc 5": AR, đổi chất liệu 3D, đặt đồ trong không gian (placement), quản lý phiên, xóa tài khoản, thương hiệu, thuộc tính, media, vận đơn, gửi thông báo thủ công, màn nhật ký, thống kê AR | Chưa làm | Mốc 5 |
| 7 | Kho, Thu chi + báo cáo, Cài đặt, VNPAY | Mốc 4 chưa bắt đầu; các trang admin tương ứng báo 404 với API thật; VNPAY sẽ làm URL/chữ ký/IPN và thử bằng khóa giả (chưa có khóa sandbox) | Mốc 4 (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` đã khai báo trong `.env.example`) |
| 8 | Android (`apps/mobile`) | Không đụng tới | Mốc 6 |
| 9 | `users.loyalty_points` | Có cột, chưa có logic cộng/dùng điểm | Quyết định giữ hay bỏ |
| 10 | `carts.coupon_id` | Giữ vì FE lưu mã trong giỏ; chuẩn D-N16 nói chỉ xem trước | Chờ xác nhận |
| 11 | Chiều trạng thái vận đơn ↔ đơn hàng | Giữ chiều hiện tại, chưa có `PATCH shipment` theo đặc tả | Chờ xác nhận |
| 12 | Cột "Đang giữ" (`reservedQty`) ở trang Kho FE | Không còn giữ chỗ; sẽ suy ra ở Mốc 4 hoặc bỏ cột | Mốc 4 |
| 13 | Giá combo của không gian | Chỉ hiển thị ở trang không gian; "Thêm cả bộ" vẫn tính giá thường trong giỏ | Quyết định có áp combo ở giỏ không |
| 14 | Đổi tên không gian ⇒ đổi `slug` | Liên kết/dấu trang cũ bị 404 | Giữ slug khi sửa (chưa làm vì chưa có chỉ đạo) |
| 15 | Lối vào `/products/[slug]/360` | Bị gỡ khỏi trang chi tiết ở commit `2505d25`; trang 360° chỉ vào được bằng URL | Khôi phục nút "360°" ở thư viện ảnh (cần chủ dự án quyết) |
| 16 | Tải ảnh qua JSON 25 MB | Lưu 360° nhiều frame lớn hoặc panorama lớn có thể vượt giới hạn body | Chuyển sang multipart/presign (liên quan mục 1) |
| 17 | ~30 chú thích `TODO: chưa có trong BE` trong FE services | Đã cũ | Dọn khi hoàn tất Mốc 4–5 |
| 18 | `docs/aurelia_dev_backup.sql` đang được git theo dõi; nhiều tài liệu cũ (README, `BACKEND_DESIGN.md`…) còn nhắc OTP | Cũ | Dọn tài liệu |
| 19 | Một lần supertest "Hỏi đáp" trả 404 chập chờn, chưa tái hiện sau 3 lần chạy lại; một lần Playwright nhóm `khach-hang` fail khi máy tải nặng, chạy lại 3 lần đều xanh | Chưa rõ nguyên nhân | Theo dõi |

---

## Phần 4. Mâu thuẫn trong chính tài liệu chuẩn (liệt kê, chưa tự quyết)

1. Số ENUM: `DATABASE_SCHEMA.md` ghi 18 ENUM; một số nơi khác ghi 19 → **tin DB thực**.
2. `CONG_NGHE.md` mô tả trạng thái chụp ngày 2026-10-09 (13 route, 2 migration, "chưa có truy vấn"…) – chỉ là số liệu thống kê, không phải quy tắc.
3. Tồn kho: lần chốt đầu của chủ dự án là "giữ chỗ khi đặt, trừ khi giao", còn chuẩn là "trừ ngay khi đặt" → đã theo **chuẩn** (trừ ngay).

---

## Phần 5. Quy trình giữ tài liệu này đúng

- Sau mỗi migration thêm bảng/cột ngoài chuẩn: cập nhật Phần 1 (bảng/cột, vì sao giữ).
- Thêm thư viện/công cụ ngoài `CONG_NGHE.md`: ghi vào Phần 2 kèm lý do.
- Việc làm tạm hoặc lệch chuẩn: ghi vào Phần 3; xong thì xóa dòng.
