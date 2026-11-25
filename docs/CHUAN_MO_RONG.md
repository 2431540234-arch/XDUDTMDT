# CHUAN_MO_RONG – Những gì dự án GIỮ hoặc LÀM THÊM ngoài bộ tài liệu chuẩn

> Bộ chuẩn (không sửa): `CAU_TRUC_DB.md`, `DATABASE_SCHEMA.md`, `QUY_UOC_CODE_DB.md`, `CONG_NGHE.md`; phạm vi chức năng: `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`.
> Khi mâu thuẫn: **4 file chuẩn + đặc tả > quyết định của chủ dự án > code hiện có.** Code lệch chuẩn thì sửa theo chuẩn; thứ gì chuẩn chưa có mà dự án vẫn cần thì ghi **ở đây** (thay cho việc cập nhật `DATABASE_SCHEMA.md` sau mỗi migration).
> Cập nhật lần cuối: 2026-11-25 – theo commit `a13386e`. Trạng thái DB: **32 bảng**, **18 ENUM**, **21 migration** (đến `20261120030100_products_brand_text`); cột mở rộng trên bảng chuẩn xem [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). **Từ 2026-11-19 nhóm 17 bảng mở rộng đã bị gỡ (D-D10), cùng `roles`/`permissions`/`role_permissions`/`user_roles`, `attributes`, `brands` (D-D13 … D-D15); các mục dưới đây nhắc tới phần đã gỡ đều được đánh dấu "đã gỡ".**

Mọi bảng/cột mở rộng bên dưới tuân theo `QUY_UOC_CODE_DB.md`: tên `snake_case` số nhiều, khóa chính `id INTEGER GENERATED ALWAYS AS IDENTITY`, ràng buộc đặt tên `pk_/fk_/uq_/ck_/idx_`, trigger `trg_<bảng>_updated_at` với bảng có `updated_at`, `COMMENT ON` tiếng Việt.

---

## Phần 1. Cơ sở dữ liệu

### 1.1–1.3 Bảng, ENUM và cột mở rộng (đã chuyển)

**Đã gỡ (D-D10):** 17 bảng mở rộng (`product_specs`, `product_360_configs`, `product_360_frames`, `review_images`, `product_questions`, `coupon_scopes`, `user_coupons`, `code_counters`, `return_requests`, `return_request_items`, `return_request_images`, `stock_receipts`, `stock_receipt_items`, `expenses`, `banners`, `posts`, `contact_messages`) và 8 ENUM mở rộng. Các cột thêm trên bảng chuẩn còn lại được mô tả ở [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), mục "Cột thêm trên bảng chuẩn"; tóm tắt nghiệp vụ từng bảng ở [CAU_TRUC_DB.md](CAU_TRUC_DB.md).

### 1.4 Quy tắc nghiệp vụ trong DB/code đã chốt theo chuẩn

- **Tồn kho:** `product_variants.stock_quantity` bị trừ **ngay khi đặt hàng**, cộng lại khi **hủy đơn**. Không còn `reserved_quantity` và không còn sổ cái tồn (`inventory_movements` đã bỏ, D-D10); sửa tồn qua form biến thể của sản phẩm. API `stockQuantity` = `stock_quantity`.
- **`sold_count`** tăng khi đơn sang `completed` (đã tính lại số liệu cũ bằng migration `recompute_sold_count`).
- **Công thức báo cáo doanh thu (D-D10):** chỉ tính đơn giao thành công (`completed`) theo ngày giao (lần đầu sang `completed`); **net = gross − discount**. Không còn chi phí, phiếu chi, giá vốn nhập kho và lợi nhuận.
- **Phí vận chuyển (UC-ORD-01):** tìm vùng trong `settings.shippingZones` có `name` trùng `province` của địa chỉ giao. Có vùng ⇒ phí = `fee` của vùng, miễn phí khi tạm tính ≥ `freeFrom` của vùng (vùng thiếu `freeFrom` dùng ngưỡng mặc định). **Tỉnh không thuộc vùng nào ⇒ phí = `settings.default_shipping_fee`, miễn phí khi tạm tính ≥ `settings.free_shipping_threshold`.** Tạm tính = tổng tiền hàng trước giảm giá. Thiếu khóa cài đặt ⇒ dùng hằng số dự phòng trong code (30.000đ / 10.000.000đ).
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
| 10 | **Lưu tệp driver `local`** cho demo/test (`apps/api/uploads`, URL `/uploads`). Ảnh nhỏ (đại diện, đánh giá…) gửi data-URL trong JSON (body ≤ 25 MB); **frame 360° (≤ 2 MB) và panorama (≤ 20 MB) tải từng tệp bằng multipart `POST /admin/media` (`kind=frame|panorama`)** rồi gửi URL, nên không bị giới hạn body; mô hình 3D ≤ 100 MB (multipart `POST /admin/models/upload`) | Chưa làm MinIO/presign ở lượt này (xem Phần 3) |
| 11 | Thêm gói: `react-markdown@9.1.0` (web), `dotenv-cli` (chạy với `.env` gốc) | Xem 2 và scripts |
| 12 | **Test:** Jest (unit, supertest DB thật `aurelia_test`) + Vitest (web) + Playwright chạy với API thật (`npm run test:e2e:real`, 5 nhóm). **Không chạy hai bộ test cùng lúc trên `aurelia_test`** (dùng chung một DB nên kết quả sai); script có khóa chặn việc này | Chuẩn chỉ nói Jest/Vitest/Playwright, chưa nêu cách chạy API thật |
| 13 | **VNPAY**: tự viết chữ ký HMAC-SHA512 bằng `node:crypto` (`modules/payments/vnpay.ts`), không thêm thư viện; thử bằng khóa giả, giữ chế độ giả lập cho demo | Ít phụ thuộc, hàm thuần dễ test; chưa có khóa sandbox thật |

Số liệu thống kê trong `CONG_NGHE.md` (số route, test, migration…) chỉ là ảnh chụp lúc viết, **không phải quy tắc**.

---

## Phần 3. Lệch tạm thời, sẽ sửa sau

Những chỗ code **chưa theo chuẩn/đặc tả** hoặc còn thiếu, đã được chủ dự án cho hoãn:

| # | Mục | Hiện trạng | Hướng sửa |
|---|---|---|---|
| 1 | MinIO / presigned upload | **Đã làm (D-P13)**: dev và demo dùng MinIO; panorama và mô hình GLB tải bằng presigned PUT; ảnh ≤ 5 MB multipart qua API. **Lệch còn lại:** supertest và `test:e2e:real` giữ driver `local` (không phụ thuộc container; mục 31); driver `local` vẫn giữ làm dự phòng cho demo (`npm run demo:local`) | — |
| 2 | Redis cache (`CacheService`) | Chưa module nào dùng; sản phẩm dùng chỉ mục RAM 15 giây | Áp dụng theo D-T30 |
| 3 | Xử lý nền mô hình 3D (`model-processing`) | **Đã làm (D-P10)** và nay tải lên theo đúng UC-ADM-13: presigned PUT vào bucket private (khi driver minio/s3) rồi confirm; driver local vẫn multipart làm dự phòng | — |
| 4 | `PermissionsGuard` / vai trò-quyền chi tiết (UC-ADM-02) | Chỉ phân biệt khách/admin | Mốc 5 |
| 5 | `ActivityLogInterceptor` | Nhật ký ghi trực tiếp trong service (`activity_logs`) | Chuyển sang interceptor |
| 6 | UC "Mốc 5" còn lại: đổi chất liệu 3D, đặt đồ trong không gian (placement), thống kê (AR đã LOẠI BỎ hoàn toàn, xem mục 27; quản lý phiên, xóa tài khoản, gửi thông báo thủ công, màn nhật ký, vai trò/phân quyền **đã làm**, D-P15, mục 35) | Chưa làm (thương hiệu, thuộc tính, media, vận chuyển và 5 UC Mở rộng nhẹ đã làm) | Mốc 5 |
| 7 | VNPAY khóa thật | Đã làm URL/chữ ký/Return URL/IPN/thanh toán lại và kiểm bằng khóa giả; chưa có khóa sandbox thật nên chưa thử qua cổng thật | Điền `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` khi có tài khoản |
| 8 | Android (`apps/mobile`) | Không đụng tới | Mốc 6 |
| 9 | `users.loyalty_points` | Giữ nguyên cột, chưa có logic cộng/dùng điểm (ngoài đặc tả) | Quyết định khi có yêu cầu |
| 10 | `carts.coupon_id` | Giữ nguyên (FE lưu mã trong giỏ; chuẩn D-N16 nói chỉ xem trước) | Quyết định khi có yêu cầu |
| 11 | Chiều trạng thái vận đơn ↔ đơn hàng | Đã làm theo D-N14/UC-ADM-25: vận đơn `delivered` ⇒ đơn `completed` cùng transaction; admin không đặt `completed` trực tiếp; sang `shipping` cần có vận đơn | **O-03 (điểm mở):** vận đơn `failed`/`returned` chỉ ghi trạng thái vận đơn, đơn giữ `shipping` (đặc tả chưa chốt cách xử lý đơn giao thất bại/hoàn hàng) |
| 12 | Cột "Đang giữ" (`reservedQty`) | Đã bỏ khỏi FE/API (tồn đã trừ ngay khi đặt hàng) | — |
| 13 | Giá combo của không gian | Đặc tả không có combo ⇒ **không áp vào giỏ**, FE chỉ hiển thị tổng giá thật; giữ cột `spaces.combo_discount_percent` và trường API `comboTotal` | Để sau: nếu đặc tả bổ sung combo thì áp ở giỏ |
| 14 | Slug không gian | Đã sửa: đổi tên KHÔNG đổi slug; admin muốn đổi thì sửa ô slug (kiểm tra duy nhất) | — |
| 15 | ~~Lối vào `/products/[slug]/360`~~ | **Đã gỡ** cùng tính năng Xem 360° xoay ảnh (D-D10) | — |
| 16 | Tải ảnh lớn | Đã sửa: frame 360° và panorama tải từng tệp bằng multipart | Presigned/MinIO là mục 1 |
| 20 | Media: panorama và tệp lớn | **Đã làm (D-P13)**: panorama dùng presigned PUT vào bucket public + confirm khi driver minio/s3; driver local vẫn multipart. Job `image-processing` vẫn tạo bản webp và thumbnail | — |
| 21 | Media: xóa tệp | Theo DAC_TA UC-ADM-04: tệp đang dùng ở tham chiếu BẮT BUỘC (ảnh sản phẩm, panorama, mô hình…) ⇒ 409; tham chiếu TÙY CHỌN (ảnh danh mục, avatar, ảnh bìa; logo thương hiệu đã gỡ cùng bảng `brands`) bị gỡ liên kết (SET NULL) chứ không chặn. (Yêu cầu ban đầu ghi "đang dùng thì 409"; đã theo đặc tả và FE cảnh báo trước khi xóa) | — |
| 22 | Thuộc tính hệ thống | Loại thuộc tính là enum `attribute_code` (`color`, `size`, `material`), mã nguồn dùng để dựng nhãn biến thể/màu; không tạo/sửa/xóa loại (D-D14) | — |
| 23 | Mô hình 3D: nơi lưu lý do lỗi và tệp gốc | Không thêm cột/bảng (không migration): lý do lỗi (`failureReason`) và `sourceKey` của tệp gốc (cho "Xử lý lại") đọc từ `activity_logs` (`model.processing_failed`, `model.upload`); tệp gốc giữ ở bucket private `models/incoming/…` | Thêm cột nếu cần truy vấn nặng |
| 24 | Mô hình 3D: tham số `createNew`, dòng "mô hình chưa có tệp" (`fileId = null`, `id = -modelId`), `DELETE /admin/models/model/:modelId` | Ngoài đặc tả, thêm để có thể tạo mô hình thứ hai cho một sản phẩm (để "Đặt làm mô hình chính" có ý nghĩa) và để hiện/xóa được mô hình đang xử lý hoặc lỗi | — |
| 25 | Bộ giải nén Meshopt của `<model-viewer>` | Phục vụ tại chỗ `apps/web/public/vendor/meshopt_decoder.js` (bản sao `meshoptimizer` 0.18, MIT) thay vì CDN; loại khỏi eslint/prettier | Bỏ khi có bộ giải nén tự host trong bản build |
| 26 | (bỏ) USDZ mẫu của seed | Đã bỏ cùng AR (D-P11): seed không tạo USDZ nữa | — |
| 27 | ~~Bảng/cột AR giữ theo chuẩn nhưng KHÔNG dùng (D-P11)~~ **Đã loại bỏ hoàn toàn (D-P16, D-T59, 2026-11-09)** | Migration `remove_ar` xóa `ar_sessions`, `ar_snapshots`, `ar_mode`, `products.has_ar`; module `ar-*` bị xóa. Còn giữ: giá trị `usdz` của enum `model_file_format` (không xóa dữ liệu dùng chung; hệ thống chỉ nhận GLB), cột `placement`/`allow_scaling` (quản trị mô hình 3D) | — |
| 28 | **Bảng route → quyền (PermissionsGuard, D-P12)** | Route theo đặc tả lấy đúng quyền ở "Tác nhân chính" của UC. Route NGOÀI đặc tả dùng quyền gần nhất (cột "Ghi chú"). Route nhiều quyền là "một trong". Test quét metadata: route admin nào chưa gắn quyền sẽ làm test fail. Xem bảng "Route → quyền" ngay sau bảng này | — |
| 29 | ~~Cache quyền trong bộ nhớ~~ | **Đã bỏ (D-D13):** quyền là hằng số `ROLE_PERMISSIONS`, `PermissionsService` không còn cache hay `clearCache()`; vai trò đọc từ `users.role` mỗi request | — |
| 30 | Nhật ký tự động của interceptor | Dòng do `ActivityLogInterceptor` ghi có `changes = { auto: true, method, route }`, `action = <tài nguyên>.<hành động theo route>` (vd. `orders.cancel`), `target_type` = tài nguyên, `target_id` = tham số `:id` nếu có. Không thay các log trong service | — |
| 31 | MinIO: test và dữ liệu | Supertest (`test:e2e:db`) và `test:e2e:real` giữ `STORAGE_DRIVER=local` **vì** chúng reset/seed `aurelia_test` nhiều lần và không được phụ thuộc container MinIO (chạy được trên máy không bật Docker, nhanh, không để rác trong bucket). MinIO thật được kiểm riêng: `test:e2e:minio` (API) và `test:e2e:real:minio` (trình duyệt, kiểm CORS), dùng bucket `aurelia-test-*`, tự bỏ qua nếu MinIO không chạy | — |
| 32 | MinIO: cổng console 9011 | Console đổi từ 9001 sang **9011** (`MINIO_CONSOLE_PORT`) vì 9001 do Mosquitto của dự án khác giữ; container `minio-1` được tạo lại với ánh xạ cổng mới, volume `xdudtmdt_minio-data` và dữ liệu giữ nguyên (chủ dự án đã đồng ý) | — |
| 33 | MinIO: chép `apps/api/uploads` | Script `scripts/minio-sync-uploads.mjs` (`npm run minio:sync`) chép `uploads/public` ⇒ `aurelia-public` và `uploads/private` ⇒ `aurelia-private`, giữ nguyên khóa (`media.file_path` không đổi), idempotent, không xóa thư mục nguồn | — |
| 34 | **Cache Redis (D-P14): thao tác ghi → khóa bị xóa** | Xem bảng ngay sau bảng này (mục "Cache Redis"). `ProductsService.invalidate()` (gọi sau mọi thao tác admin đổi catalog) là điểm xóa chung cho nhóm catalog | — |
| 35 | **5 UC Mở rộng nhẹ (D-P15): chi tiết ngoài đặc tả** | (a) `GET /admin/activity-logs/options` (quản trị viên/hành động/loại đối tượng đang có, để dựng bộ lọc) và trường `auto` của mỗi dòng (= `changes.auto`). (b) Access token có claim `sid` (id `user_sessions`) và `user_sessions.device_name` được điền từ User-Agent ("Chrome trên Windows"). (c) **Vai trò và phiên có hiệu lực ngay (D-T55)**: `JwtAuthGuard` đọc vai trò từ `users.role` và kiểm phiên của `sid` ở mỗi request trong cùng truy vấn kiểm khóa tài khoản; phiên bị thu hồi ⇒ 401 `AUTH_TOKEN_INVALID`. (d) `DELETE /users/me` có thân `{ password }`; admin không tự xóa được (403), còn đơn `pending…shipping` ⇒ 409. (e) `POST /admin/notifications` nhận `userIds` (≤ 1000) hoặc `all: true` (mọi tài khoản chưa xóa/chưa bị cấm), `type` = `system` (mặc định) hoặc `promo`, `link` tùy chọn. Không đổi schema, không migration | — |
| 36 | **Vật liệu theo biến thể (D-T56): chi tiết ngoài đặc tả** | Bảng `model_material_variants` đã có trong chuẩn (không migration). Thêm: `GET /admin/models/:id/materials` (tên vật liệu có trong tệp GLB LOD medium để admin chọn `materialName`) và `GET /admin/models/:id/material-variants` (danh sách). `config` giới hạn ở `baseColor`/`roughness`/`metalness`. Dữ liệu demo: `prisma/seed-models.ts` gắn cho mô hình chính của mọi sản phẩm có ≥ 2 màu một cấu hình/biến thể (vật liệu đầu tiên của GLB ⇒ màu của biến thể, `attribute_values.color_hex`), chạy cùng `npm run db:process-models` | — |
| 37 | **Mô hình 3D trong ảnh 360° (D-T57): chi tiết ngoài đặc tả** | Bảng `space_product_placements` đã có trong chuẩn (không migration). Thêm: `GET /admin/panoramas/:id/placements` (danh sách), giới hạn `distance` ≤ 49 và `scale` ≤ 20, `pitch` ∈ [-90, 90], `yaw` ∈ [-180, 180], xoay ∈ [-360, 360]; `GET /spaces/:slug/placements/:placementId/alternatives` (tối đa 12). Khi sửa không gian có gửi `panoramas`, placement được chép sang ảnh mới cùng `media_id` (form không gian không chứa placement). Dữ liệu demo: `seed-mock.ts` chỉ giữ placement của 3 không gian đầu (các không gian còn lại trước đây cũng có, nay bỏ để nhẹ cho điện thoại) | — |
| 38 | ~~Phễu không gian mẫu (D-T58)~~ | **Đã gỡ (D-D10)** cùng bảng `space_views`, `GET /admin/stats/spaces` và trang `/admin/reports/spaces` | — |
| 39 | **Chi tiết đợt hoàn tất (D-N35, D-N36): ngoài đặc tả** | (a) `POST /orders` nhận thêm `couponCode` (ưu tiên hơn mã đang gắn ở giỏ, kiểm trong cùng khóa dòng; sai ⇒ 400); (b) dòng không còn bán ⇒ 409 kèm `details.unavailable` (danh sách dòng); (c) `conflictError` (409 `CONFLICT` kèm `details` theo trường) cho slug/mã/tên trùng; (d) trang `/admin/payments` có lọc theo trạng thái/phương thức và nút xác nhận/đánh dấu thất bại; (e) admin cấp mật khẩu tạm luôn có chữ hoa, thường, số; tài khoản quản trị không đổi trạng thái được (409) |
| 17a | Cảnh báo tồn thấp | UC-ADM-12 và 4 file chuẩn không yêu cầu cảnh báo tồn thấp ⇒ không làm thêm; chỉ giữ cột mở rộng `min_stock`, nhãn "Sắp hết" và bộ lọc/KPI ở trang Kho | — |
| 17 | **93** chú thích `TODO: chưa có trong BE/DB` ở `apps/web/src/services/*.api.ts` và `apps/web/src/types/api.ts` | Đã cũ (BE/DB đã có các route/cột này; liệt kê ở `AUDIT_REPORT.md` mục 6–7) | **Chưa dọn** (backlog P2, xem [KNOWN_ISSUES.md](KNOWN_ISSUES.md)) |
| 18 | ~~`docs/aurelia_dev_backup.sql` đang được git theo dõi~~ **Đã gỡ khỏi repo ngày 2026-11-11** (chuyển ra `../aurelia-backups/`, `.gitignore` chặn `docs/**/*.sql` và `*.dump`; lịch sử git không xử lý). Nhiều tài liệu cũ (README, `BACKEND_DESIGN.md`…) còn nhắc OTP | Cũ | Dọn tài liệu |
| 19 | Test chập chờn | Đã chạy supertest 10 lần liên tiếp (114/114 mỗi lần) và nhóm `khach-hang` 10 lần liên tiếp: xanh cả 20 lần (kết quả chi tiết trong `BE_PROGRESS.md`). Chạy HAI bộ test cùng lúc trên một `aurelia_test` tái hiện đúng kiểu lỗi cũ (404 ở "Hỏi đáp", sai tồn kho…) ⇒ nguyên nhân khả dĩ nhất là chồng chéo hai lần chạy; đã thêm khóa chặn chạy song song | Theo dõi |

---

### Bảng route → quyền (PermissionsGuard, D-P12; mục 28 ở trên)

| Nhóm route (`/api/admin/…`) | Quyền | UC / Ghi chú |
|---|---|---|
| `users` | `manage_users` | UC-ADM-01 |
| `roles` | `manage_users` | UC-ADM-02 (khung rỗng) |
| `settings` | `manage_settings` | UC-ADM-03 |
| `activity-logs` | `manage_settings` | UC-ADM-27 |
| `media` | `manage_products` **hoặc** `manage_content` | UC-ADM-04 |
| `categories`, `attributes` | `manage_products` | UC-ADM-05, 08 (UC-ADM-06 thương hiệu đã gỡ, D-D15) |
| `products`, `variants`, `product-images`, `models` | `manage_products` | UC-ADM-09, 10, 11, 13, 14 |
| `inventory` | `manage_products` | UC-ADM-12 |
| `spaces`, `panoramas`, `hotspots` | `manage_content` | UC-ADM-15, 16 |
| `reviews` | `manage_content` | UC-ADM-18 |
| `coupons` | `manage_content` | UC-ADM-19 |
| `GET orders`, `orders/counts`, `orders/:code`, `orders/:code/invoice` | `view_orders` | UC-ADM-20 |
| `POST orders`, `PATCH orders/:id/status`, `orders/:id/cancel`, `orders/:id/refund`, `orders/:id/note` | `process_orders` | UC-ADM-21, 22, 23 (tạo đơn hộ khách và ghi chú nội bộ cùng nhóm xử lý đơn) |
| `payments` | `process_orders` | UC-ADM-24 |
| `orders/:id/shipments`, `shipments/:id` | `process_orders` | UC-ADM-25 |
| `stats/overview` | `view_orders` | UC-ADM-28 |
| `faq` | `manage_content` | **Ngoài đặc tả**: nội dung FAQ |
| `stats/finance` | `view_orders` | **Ngoài đặc tả**: báo cáo doanh thu gần UC-ADM-28 |
| `GET notifications` (chuông thông báo của admin) | `view_orders` | **Ngoài đặc tả**: thông báo đơn/kho cho admin |
| `POST notifications` (gửi thông báo cho người dùng) | `manage_content` | UC-ADM-26 |
| `search` (tìm nhanh) | `manage_products` **hoặc** `view_orders` **hoặc** `manage_users` | **Ngoài đặc tả**: tìm trên sản phẩm, đơn, khách |

Bull Board `/admin/queues` (không phải controller Nest) vẫn do `bullBoardAdminOnly` chặn theo vai trò admin.

### Cache Redis: thao tác ghi → khóa bị xóa (D-P14, mục 34)

| Khóa (sau tiền tố môi trường) | TTL | Dữ liệu | Thao tác ghi xóa khóa này |
|---|---|---|---|
| `products:<slug>` | 1 phút | chi tiết sản phẩm công khai (biến thể, ảnh, thông số, mô hình 3D, đánh giá tổng hợp) | tạo/sửa/xóa sản phẩm, biến thể, ảnh (admin-products); danh mục, thuộc tính (đổi tên/xóa); mô hình 3D (tải lên, xử lý xong/lỗi của job, đặt mô hình chính, xử lý lại, xóa); duyệt/ẩn đánh giá, khách gửi/sửa/xóa đánh giá; không gian mẫu (sản phẩm trong bộ); **tồn kho / sold_count đổi**: đặt đơn, hủy đơn, vận đơn giao thành công (hoàn tất đơn), nhập kho/điều chỉnh/xác nhận phiếu nhập, đổi trả (nhập lại kho) |
| `products:featured:<băm truy vấn>` | 2 phút | danh sách sản phẩm nổi bật (trang chủ) | như `products:<slug>` (xóa theo tiền tố `products:`) |
| `catalog:index` | 2 phút | chỉ mục danh sách/tìm kiếm/facet/sản phẩm liên quan | như `products:<slug>` |
| `categories:tree` | 10 phút | cây danh mục công khai | tạo/sửa/xóa danh mục; đổi sản phẩm làm đổi số sản phẩm theo danh mục (qua `ProductsService.invalidate()` xóa cả `categories:`) |
| `settings:public` | 10 phút | cài đặt công khai (cửa hàng, thanh toán, vùng giao hàng) | `PUT /admin/settings/...` (mọi khóa) |

**Không cache:** giỏ hàng, đơn hàng, yêu thích, hồ sơ, địa chỉ, thông báo, mọi dữ liệu theo người dùng; danh sách/ chi tiết trong `/admin/*`. **Khởi động API và `db-reset` xóa toàn bộ khóa cache của môi trường.** Lỗi Redis được ghi log và coi như cache miss.

## Phần 4. Mâu thuẫn trong chính tài liệu chuẩn (liệt kê, chưa tự quyết)

1. Số ENUM: `DATABASE_SCHEMA.md` ghi 18 ENUM; một số nơi khác ghi 19 → **tin DB thực**.
2. `CONG_NGHE.md` mô tả trạng thái chụp ngày 2026-10-09 (13 route, 2 migration, "chưa có truy vấn"…) – chỉ là số liệu thống kê, không phải quy tắc.
3. Tồn kho: lần chốt đầu của chủ dự án là "giữ chỗ khi đặt, trừ khi giao", còn chuẩn là "trừ ngay khi đặt" → đã theo **chuẩn** (trừ ngay).

---

## Phần 4b. Những câu trong tài liệu chuẩn đã bị thay thế bởi quyết định mới

Theo **D-D07** (`DECISIONS.md`, 2026-11-07) tài liệu chuẩn thắng code. Các câu sau (trong tài liệu chuẩn, KHÔNG sửa trực tiếp) nói Prisma/code là nguồn chuẩn nên **không còn hiệu lực**:
- `DATABASE_SCHEMA.md` dòng 7 (Prisma là nguồn chuẩn của CSDL);
- `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` mục 1.2 (nguồn chuẩn là code/Prisma, mâu thuẫn thì tin code);
- phần tương ứng của D-D02 và D-T46 trong `DECISIONS.md` (nay được thay thế một phần bởi D-D07).
Khi code lệch chuẩn thì sửa code; phần code được giữ ngoài chuẩn thì ghi trong chính tài liệu này.

## Phần 5. Quy trình giữ tài liệu này đúng

- Sau mỗi migration thêm bảng/cột ngoài chuẩn: cập nhật Phần 1 (bảng/cột, vì sao giữ).
- Thêm thư viện/công cụ ngoài `CONG_NGHE.md`: ghi vào Phần 2 kèm lý do.
- Việc làm tạm hoặc lệch chuẩn: ghi vào Phần 3; xong thì xóa dòng.
