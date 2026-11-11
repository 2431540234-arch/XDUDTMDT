> **Đã lưu trữ ngày 2026-11-11 – lý do: ghi chú tiếp nhận dự án ngày 2026-11-06 dựa trên 44 bảng và Mốc 3; hiện trạng ở ARCHITECTURE.md, DATABASE_SCHEMA.md, DECISIONS.md.** Nội dung bên dưới được giữ nguyên, không còn phản ánh hiện trạng.

# ONBOARDING_NOTES – Ghi chú tiếp nhận dự án Aurelia Living

> Do agent tiếp nhận viết ngày 2026-11-06, sau Mốc 3 (commit `c6fcdf7`, `081fbcd` trên `feature/backend`). **Chưa commit.**
> Nguyên tắc: **code và migration là nguồn đúng nhất**; chỗ nào tài liệu khác code thì ghi ở mục 8, không sửa tài liệu gốc. Chỗ chưa chắc ghi "chưa rõ" kèm đường dẫn file.
> Không chép lại nội dung các file docs; chỉ dẫn link.

## 1. Tổng quan dự án và công nghệ

Aurelia Living: website thương mại điện tử nội thất, có xem 3D/AR, ảnh 360° sản phẩm và không gian mẫu 360°. Chỉ **2 vai trò**: `admin` (Doanh nghiệp) và `user` (Khách hàng); khách vãng lai không có giỏ (giỏ gắn user).

| Phần | Công nghệ (theo `package.json`) | Ghi chú |
|---|---|---|
| Monorepo | npm workspaces + Turborepo | `apps/web`, `apps/api`, `apps/mobile` (Android, **chưa có code nghiệp vụ**), `packages/shared-types` |
| Web | Next.js 14.2 **App Router**, React 18, Tailwind, TanStack Query 5, Zustand 4, react-hook-form + zod, React Three Fiber/drei, `@google/model-viewer`, recharts | Vitest + Playwright |
| API | NestJS 10, Prisma 5, PostgreSQL 16, Redis (throttler lưu Redis, BullMQ cho mail), MinIO/S3 hoặc `local` storage, Mailpit (dev) | JWT access + refresh; Swagger `/api/docs` |
| Kiểu dùng chung | `packages/shared-types`: enum + entity **sinh từ `schema.prisma`** (`npm run types:generate`), `ApiResult`, `ErrorCode` | xem [SHARED_TYPES_SYNC.md](../SHARED_TYPES_SYNC.md) |
| Test | Jest (unit + supertest), Playwright (e2e), Vitest (web unit) | |

Đọc thêm: [CONG_NGHE.md](../CONG_NGHE.md) (đối chiếu công nghệ), [BACKEND_DESIGN.md](../BACKEND_DESIGN.md) (thiết kế BE + mục 9–11 là các quyết định/cập nhật sau mỗi mốc), [DECISIONS.md](../DECISIONS.md) (D-N*, D-T*, D-D*), [BE_PROGRESS.md](../BE_PROGRESS.md) (tiến độ Mốc 1–3), [FE_PROGRESS.md](FE_PROGRESS.md) (54 màn hình + 360°), [API_CONTRACT.md](../API_CONTRACT.md) (hợp đồng FE–BE, sinh từ mock API).

**Cách dự án vận hành:** FE được dựng trước trên một **mock API chạy trong trình duyệt** (`apps/web/src/mock-data/mockApi`); mock API *chính là* hợp đồng. BE được viết sau để `NEXT_PUBLIC_USE_MOCK=false` chạy được không đổi giao diện. Seed của BE đọc thẳng `mock-data` của FE (giữ nguyên id).

**Tình trạng:** Mốc 1 (khách mua được hàng), Mốc 2 (admin vận hành), Mốc 3 (đánh giá, hỏi đáp, đổi trả, nội dung, không gian, mô hình 3D) đã xong. **Mốc 4** (kho, thu chi + báo cáo, cài đặt, VNPAY sandbox) **chưa làm**.

Cấu trúc nhánh: `feature/backend` (đang đứng), `feature/product-360`, `feature/fe-wireframe-mock`, `main`; remote có thêm `Huyen-Trang`, `feature/yen/user-page-ui` (chưa xem nội dung; chưa rõ có liên quan không).

Lịch sử Mốc (từ `git log`): `37d9704` migration `add_backend_extras` → `02c559a` seed từ mock → `67b56d5` Mốc 1 → `5012daf` Mốc 2 → `c6fcdf7` Mốc 3 → `081fbcd` đồng bộ shared-types. Trước đó: `af90edd` tài liệu phân tích/thiết kế BE; `2505d25` mock data; `1b67ea1`/`30bf93b` xem 360°; các commit `feat(web)` dựng 54 màn hình; `db5285f`… khung 14 module; `a9fee5f` nền tảng BE.

## 2. Cách chạy dev và chạy test (đã thử thật)

Hạ tầng trên máy này (đã chạy sẵn): PostgreSQL container `xdudtmdt-postgres-1` **host port 55432**, Redis **6380**, Mailpit SMTP 1025 / UI 8025. (Các container khác như `dcp_*`, `security-*` là của dự án khác, không đụng.) Giá trị mặc định trong `.env.example` là 5432/6379 — máy này đã đổi cổng.

| Việc | Lệnh | Ghi chú |
|---|---|---|
| Bật hạ tầng | `npm run infra:up` | postgres, redis, minio, minio-init, mailpit. **Service `api` cũ nằm trong profile `legacy`** (không tự chạy); container `xdudtmdt-api-1` đang dừng có chủ ý |
| Tạo/seed DB demo hoặc test | `node scripts/db-reset.mjs aurelia_demo` hoặc `aurelia_test` | chỉ nhận 2 tên này; DROP + CREATE + `migrate deploy` + seed mock. **KHÔNG** dùng cho `aurelia_dev` |
| Chạy API (hot reload) | `DATABASE_URL=postgresql://aurelia:aurelia@localhost:55432/aurelia_demo?schema=public STORAGE_DRIVER=local STORAGE_PUBLIC_URL=http://localhost:4000/uploads OTP_FIXED_CODE=123456 JWT_ACCESS_EXPIRES_IN=12h npm run start:dev -w @aurelia-living/api` | cổng 4000; hiện **đang có một API chạy ở 4000** (PID 44656, DB `aurelia_demo`) |
| Chạy FE với mock | `npm run dev -w @aurelia-living/web` (cần `NEXT_PUBLIC_USE_MOCK=true`) | không cần BE |
| Chạy FE với API thật | `NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev -w @aurelia-living/web` | |
| Unit API | `npm test -w @aurelia-living/api` | |
| Typecheck | web: `npm run typecheck -w @aurelia-living/web` ✅. API: `npm run typecheck -w @aurelia-living/api` ❌ **đang lỗi** (xem mục 7, 9). Thay thế đang chạy được: `node node_modules/typescript/bin/tsc -p apps/api/tsconfig.build.json --noEmit` ✅ |
| Lint | `npx eslint .` (script gốc `npm run lint` dùng `--max-warnings=0` nên **sẽ fail** vì còn 1 cảnh báo `no-console` ở `apps/api/prisma/seed-mock.ts:28`) | |
| E2E supertest (DB thật) | `node scripts/db-reset.mjs aurelia_test && npm run test:e2e:db -w @aurelia-living/api` | tự dừng nếu DB không phải `aurelia_test` |
| Playwright với API thật | `npm run test:e2e:real` (`scripts/e2e-real.mjs`) | 1 lệnh: build API → reset `aurelia_test` → API ở 4002 → 4 nhóm Playwright, mỗi nhóm reset lại DB → dọn tiến trình. `E2E_ONLY=admin-m3` chạy 1 nhóm |

Tài khoản dùng được sau seed mock (cả `aurelia_demo` và `aurelia_test`): **admin** `admin@aurelia.vn` / `admin123` (đăng nhập `/admin/login`); **khách** `khachhang@aurelia.vn` / `123456`; các khách mock khác cùng mật khẩu `123456`; OTP quên mật khẩu `123456` khi đặt `OTP_FIXED_CODE`. (Nguồn: `apps/web/src/mock-data/tables/users.ts:25,62`.) Email gửi ra xem ở Mailpit http://localhost:8025.

**Bốn cơ sở dữ liệu trong container Postgres** (số dòng đo bằng `SELECT count(*)` ngày 2026-11-06):

| DB | Vai trò | users / products / orders | Được phép làm gì |
|---|---|---|---|
| `aurelia_dev` | **Dữ liệu thật của người dùng — giữ nguyên.** Chỉ đã `migrate deploy` (7 migration), không seed mock | 3 / 2 / 1 | Chỉ `migrate deploy` khi được cho phép. Không seed, không reset, không restore. `seed-mock.ts` tự từ chối nếu thấy dữ liệu ngoài mock (trừ `SEED_FORCE=1`) |
| `aurelia_demo` | Dev/demo, API cổng 4000 trỏ vào đây, seed từ mock | 35 / 53 / 84 | được reset bằng `db-reset.mjs` |
| `aurelia_test` | **Bị reset nhiều lần mỗi lần chạy test** (supertest + Playwright) | 34 / 52 / 83 (số liệu chụp lúc test đang chạy, khác với demo do test thêm/xoá dữ liệu) | chỉ cho test |
| `aurelia_living` | DB mặc định của compose (`POSTGRES_DB`) | chưa xem | **chưa rõ** có dùng không; không đụng |

Sao lưu có sẵn ở gốc repo: `aurelia_dev_before_be.dump` (bản gốc của người dùng), `aurelia_dev_mixed_20261106.dump` (bản trộn lỗi do seed nhầm), `docs/aurelia_dev_backup.sql` (459 KB, SQL dump cũ ngày 2026-11-05). `*.dump` được `.gitignore`; `docs/aurelia_dev_backup.sql` **không** nằm trong `.gitignore` (đang được git theo dõi từ trước).

## 3. Sơ đồ DB theo code hiện tại

**64 model / 26 enum** trong `apps/api/prisma/schema.prisma` (44 bảng gốc từ `0_init` + 20 bảng thêm ở migration `add_backend_extras`). Extension: `citext`, `pg_trgm`, `unaccent`, `pgcrypto`. Trigger: 29 trigger `updated_at` + 7 trigger nghiệp vụ (nguồn: `0_init/migration.sql`; **bảng mới không có trigger `updated_at`**, xem mục 8–9).

### 3.1 Bảy migration (theo thứ tự)

| # | Migration | Thêm / đổi gì |
|---|---|---|
| 1 | `0_init` | Baseline từ `database/01..05`: extension, 19 enum, 44 bảng, CHECK/partial index, hàm `immutable_unaccent`, `set_updated_at`, `refresh_product_rating`, 7 trigger nghiệp vụ (đánh giá→điểm, cờ 3D, đếm lượt xem không gian, log lịch sử đơn). Khóa chính `INTEGER GENERATED ALWAYS AS IDENTITY` |
| 2 | `20261006134647_media_file_size_int` | `media.file_size` → `INTEGER` |
| 3 | `20261106055235_add_backend_extras` | 7 enum mới (`question_status`, `return_*`, `stock_receipt_*`, `expense_category`, `banner_position`); cột mới trên `addresses.label`, `attribute_values.color_hex`, `carts.coupon_id`, `categories.*`, `coupons.applies_to`, `order_items.cost_price`, `orders.internal_note`, `pages.type`, `password_resets.attempts…`, `product_variants.cost_price/min_stock/reserved_quantity…`, `products.features…`, `reviews.is_anonymous`, `spaces.combo_discount_percent`, `users` (hồ sơ, `admin_note`, `loyalty_points`…); **20 bảng mới**: `product_specs`, `product_360_configs`, `product_360_frames`, `review_images`, `product_questions`, `coupon_scopes`, `user_coupons`, `code_counters`, `return_requests`(+`_items`,`_images`), `suppliers`, `stock_receipts`(+`_items`), `expenses`, `banners`, `posts`, `faq_topics`, `faq_items`, `contact_messages`; CHECK + index tìm kiếm không dấu viết tay ở cuối file. Khóa chính mới dùng `SERIAL` |
| 4 | `20261106055816_coupon_freeship_value` | Nới `ck_coupons_value` cho loại `freeship` (value có thể 0) |
| 5 | `20261106060228_add_360_default_color` | `product_360_configs.default_color_id` |
| 6 | `20261106061927_add_coupon_applies_label` | `coupons.applies_to_label` |
| 7 | `20261106070742_add_contact_handled` | `contact_messages.handled_at`, `handled_by` |

### 3.2 So với DATABASE_SCHEMA.md / CAU_TRUC_DB.md
- Hai tài liệu mô tả **44 bảng** (đúng cho `0_init`). **Thiếu 20 bảng** liệt kê ở dòng migration #3, 7 enum mới, và toàn bộ cột thêm vào bảng cũ (kể cả `product_variants.reserved_quantity` – cột quan trọng cho giữ chỗ tồn kho). Chưa có migration nào đổi tên/xoá bảng cũ nên phần 44 bảng gốc vẫn đúng.
- Thông tin "coupon_type = percent|fixed" trong `BE_PROGRESS.md` mục Giai đoạn 2 cũ hơn code: enum thực tế có thêm `freeship` (`schema.prisma:1037`).
- Đối chiếu `QUY_UOC_CODE_DB.md` (kết quả đọc code): đúng quy ước — `findFirst({email, deletedAt:null})`; không ghi `order_items.line_total`; Decimal→number qua `serialize()`; trigger log trạng thái đơn dùng `set_config('app.current_user_id'…)` (`OrdersService.setActor`); nghiệp vụ nhiều bảng nằm trong `$transaction` (đặt hàng, đổi trạng thái đơn, đổi trả). **Lệch quy ước:** (a) 20 bảng mới dùng `SERIAL` thay vì `IDENTITY ALWAYS`; (b) bảng mới có cột `updated_at` (`return_requests`, `product_360_configs`) **không có** trigger `trg_*_set_updated_at` (vòng lặp tạo trigger chạy một lần trong `0_init`) – `updated_at` chỉ đúng nếu code tự gán; (c) quy ước xoá mềm chỉ áp cho `users`/`products`; bảng nội dung mới (`banners`, `posts`…) xoá cứng; (d) hotspot không có `variant_id`; (e) `coupon_scopes.target_id` là khoá đa hình (product/category/space) nên **không có FK**.

### 3.3 Sơ đồ quan hệ (rút từ `@relation` trong schema)

**Người dùng / vai trò / phiên**
```mermaid
erDiagram
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : has
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : has
  users ||--o{ user_sessions : "refresh token (hash)"
  users ||--o{ password_resets : "OTP"
  users ||--o{ addresses : owns
  users }o--o| media : avatar
  users ||--o{ activity_logs : "actor (nullable)"
  users ||--o{ notifications : receives
  users ||--o{ wishlists : saves
  products ||--o{ wishlists : in
```

**Sản phẩm / biến thể / tồn kho / 360°**
```mermaid
erDiagram
  categories ||--o{ categories : "parent (RESTRICT)"
  categories ||--o{ products : has
  brands ||--o{ products : has
  products ||--o{ product_variants : has
  products ||--o{ product_images : has
  products ||--o{ product_specs : has
  media ||--o{ product_images : file
  attributes ||--o{ attribute_values : has
  product_variants ||--o{ variant_attribute_values : has
  attribute_values ||--o{ variant_attribute_values : has
  product_variants ||--o{ inventory_movements : "import|sale|return|adjustment"
  products ||--o| product_360_configs : "1-1"
  product_360_configs ||--o{ product_360_frames : has
  attribute_values ||--o{ product_360_frames : "theo màu"
  media ||--o{ product_360_frames : frame
  product_variants ||--o{ stock_receipt_items : "(M4)"
```
Tồn kho: `stock_quantity` = vật lý, `reserved_quantity` = đang giữ; API trả `stockQuantity` = `stock − reserved` (`CatalogViews.variantViews`).

**Giỏ hàng / đơn hàng / thanh toán / mã giảm giá**
```mermaid
erDiagram
  users ||--|| carts : "1 giỏ"
  carts ||--o{ cart_items : has
  product_variants ||--o{ cart_items : in
  coupons ||--o{ carts : "mã đang áp (SET NULL)"
  coupons ||--o{ coupon_scopes : "product|category|space (không FK target)"
  coupons ||--o{ user_coupons : saved
  users ||--o{ orders : places
  orders ||--o{ order_items : has
  product_variants ||--o{ order_items : "nullable"
  orders ||--o{ order_status_history : "trigger ghi"
  orders ||--o{ payments : has
  orders ||--o{ shipments : has
  coupons ||--o{ orders : used
  coupons ||--o{ coupon_usages : counts
  orders ||--o{ coupon_usages : "CASCADE"
```
Mã đơn `ALV-YYYYMMDD-NNNN` (và `RT…`, phiếu kho, phiếu chi) cấp bởi bảng `code_counters` (`common/utils/code-generator.ts`).

**Đánh giá / hỏi đáp**
```mermaid
erDiagram
  products ||--o{ reviews : has
  users ||--o{ reviews : writes
  orders |o--o{ reviews : "1 đánh giá/sản phẩm/đơn"
  reviews ||--o{ review_images : has
  media ||--o{ review_images : file
  products ||--o{ product_questions : has
  users ||--o{ product_questions : asks
```
`reviews.status` pending|approved|rejected; trigger `refresh_product_rating` cập nhật `products.rating_avg/rating_count` chỉ từ `approved`. `product_questions.status` unanswered|answered|hidden + `is_public`.

**Đổi trả / hoàn tiền / phiếu chi**
```mermaid
erDiagram
  orders ||--o{ return_requests : has
  users ||--o{ return_requests : creates
  return_requests ||--o{ return_request_items : has
  order_items ||--o{ return_request_items : refers
  return_requests ||--o{ return_request_images : evidence
  media ||--o{ return_request_images : file
  orders |o--o{ expenses : "refund (SET NULL)"
  suppliers |o--o{ stock_receipts : supplies
  stock_receipts ||--o{ stock_receipt_items : has
  stock_receipts |o--o{ expenses : "(M4)"
```
Không có FK từ `expenses` tới `return_requests`; liên kết chỉ qua `order_id` + ghi chú "Hoàn tiền đổi trả RTxxxx".

**Không gian / hotspot / mô hình 3D / AR**
```mermaid
erDiagram
  spaces ||--o{ space_panoramas : has
  media ||--o{ space_panoramas : image
  space_panoramas ||--o{ space_hotspots : "product|navigation|info"
  space_hotspots }o--o| products : product
  space_hotspots }o--o| space_panoramas : "target (điều hướng)"
  space_panoramas ||--o{ space_product_placements : places
  products ||--o{ space_product_placements : model
  spaces ||--o{ space_bookmarks : saved
  spaces ||--o{ space_views : tracked
  products ||--o{ product_3d_models : has
  product_3d_models ||--o{ model_files : "glb|usdz, LOD"
  media ||--o{ model_files : file
  product_3d_models ||--o{ model_material_variants : has
  product_3d_models ||--o{ ar_sessions : tracked
  ar_sessions ||--o{ ar_snapshots : captures
```
`ar_*`, `space_views`, `model_material_variants`, `space_product_placements` **có bảng nhưng gần như chưa có API** (mục 9).

**Nội dung / thông báo / nhật ký**
```mermaid
erDiagram
  media ||--o{ banners : image
  media ||--o{ posts : cover
  faq_topics ||--o{ faq_items : has
  pages
  contact_messages
  settings
  notifications }o--|| users : to
  activity_logs }o--o| users : actor
```
`pages` (về chúng tôi, 6 chính sách), `contact_messages`, `settings` là bảng đứng riêng (không FK).

### 3.4 Seed và `scripts/db-reset.mjs`
- `db-reset.mjs <aurelia_demo|aurelia_test>`: in tên DB + `count(*)` trước, `DROP DATABASE … WITH (FORCE)` + `CREATE`, `npm run db:deploy`, `npm run db:seed`, in `count(*)` sau. Từ chối mọi tên khác (`scripts/db-reset.mjs:11-15`). Script npm `db:reset` (cũ) bị vô hiệu hoá (`apps/api/package.json`).
- `prisma/seed.ts` = phần bắt buộc (2 role, 6 quyền, `role_permissions`, settings, admin) rồi gọi `seed-mock.ts` (mặc định `SEED_SOURCE=mock`) hoặc seed "legacy" (`SEED_SOURCE=legacy`, tài khoản `Admin@123456`/`User@123456`). `seed-mock.ts` đọc `apps/web/src/mock-data` (giữ id bằng `INSERT … OVERRIDING SYSTEM VALUE`), sinh ảnh SVG, copy GLB + 1.080 frame 360° vào kho local (`seed-storage.ts`), bcrypt mật khẩu, idempotent, và **từ chối chạy** nếu DB có user/sản phẩm ngoài mock (`seed-mock.ts:183`).
- ⚠ `npm run db:seed` đọc `DATABASE_URL` trong `.env` (mặc định `aurelia_dev`): hiện được chặn bởi guard nói trên, nhưng chỉ nhờ dữ liệu của người dùng không trùng email mock — **chưa rõ** guard có bắt được trường hợp `aurelia_dev` rỗng (khi đó seed sẽ chạy).

## 4. Backend

### 4.1 Cấu hình chung (đọc từ code)
- `apps/api/src/main.ts` + `app.setup.ts`: prefix `/api` (ngoại trừ `/health`, Bull Board `/admin/queues`), `requestId` (header `x-request-id`), `helmet`, body JSON/urlencoded **25 MB** (FE gửi ảnh data-URL), CORS theo `CORS_ORIGINS`, `ValidationPipe`, Swagger `/api/docs` (nếu `SWAGGER_ENABLED`), static `/uploads` khi `STORAGE_DRIVER=local`.
- `app.module.ts`: guard toàn cục theo thứ tự `ThrottlerGuard` (Redis; nhóm `auth` chỉ cho route `@AuthThrottle()`) → `JwtAuthGuard` → `RolesGuard`; `TransformResponseInterceptor` (envelope `{success,data,meta}`); `AllExceptionsFilter` (`{success:false,error:{code,message,details}}`, thông báo tiếng Việt, mã trong `packages/shared-types/src/error-codes.ts`). Đúng theo [API_CONVENTIONS.md](../API_CONVENTIONS.md).
- **Xác thực:** JWT access (12h dev) + refresh opaque lưu hash trong `user_sessions` (xoay vòng). `JwtAuthGuard` nhận token **tùy chọn** ở route `@Public()` và kiểm tra `users.status` mỗi request (khoá tài khoản có hiệu lực ngay). `@Roles('admin')` + `RolesGuard` → 401 nếu chưa đăng nhập, 403 nếu không phải admin. Đơn của người khác ⇒ 404 (không lộ tồn tại).
- **Activity log:** ⚠ **không có interceptor toàn cục**. Mỗi service admin tự gọi `ActivityLogService.log(…, tx)` (hoặc `tx.activityLog.create`) trong cùng transaction — 15 file service có gọi (`grep ActivityLog`). Nghĩa là "mọi route /admin/* ghi log" chỉ đúng nếu từng service nhớ gọi; không có cơ chế chặn quên. Route đọc (GET) không ghi log (hợp lý).
- **Rate limit:** Throttler Redis mặc định 120 req/60s (`THROTTLE_DEFAULT_*`), nhóm auth 10/60s; riêng `POST /contact` 5 lần/phút/IP, hỏi đáp ≤5 câu/giờ/người dùng (trùng nội dung 24h ⇒ 409).
- **Upload:** (a) ảnh nhỏ gửi dạng data-URL/URL trong JSON → `MediaIngestService.ingestImage` (kiểm tra chữ ký tệp, dung lượng: ảnh ≤5MB, frame 360° ≤2MB, panorama ≤20MB); (b) mô hình 3D: multipart `POST /admin/models/upload` hoặc `fileData` data-URL, kiểm tra tại `product-models/model-file-validator.ts` (≤50MB, đuôi + MIME + magic bytes, tên lưu do server sinh `models/<productId>/<uuid>.<ext>` nên không path traversal); (c) khung cũ presign/confirm (`modules/media`, `product-models.service.ts`) **FE không dùng**.
- **Lọc HTML chống XSS:** `sanitizeRichText` (`modules/pages/admin-content.service.ts`, thư viện `sanitize-html@2.13.0` ghim bản) cho nội dung bài viết/trang; cấm script/on*/iframe, `javascript:`, `data:` ảnh.
- **Cache:** `CacheService` (Redis) **không module nghiệp vụ nào dùng**; danh sách sản phẩm dùng chỉ mục trong bộ nhớ TTL 15s (`ProductsService.invalidate()`). Hàng đợi BullMQ chỉ có `jobs`/mail.
- **Module khung rỗng** (có file nhưng không có route): `admin-notifications`, `admin-roles`, `ai`, `ar-overlay`, `ar-sessions`, `ar-snapshots`, `attributes`, `hotspots`, `inventory`, `jobs`(nền), `panoramas`, `product-images`, `settings`, `shipments`, `variants`, `activity-logs`. (`modules/index.ts` vẫn đăng ký chúng.)

### 4.2 Bảng endpoint BE (152 route, quét từ `*.controller.ts`)
Quyền: *công khai* = `@Public()`; *khách* = cần đăng nhập; *admin* = `@Roles('admin')`. Cột cuối: có nằm trong bảng của [API_CONTRACT.md](../API_CONTRACT.md) không (*chỉ trong ghi chú* = có mô tả ở mục ghi chú Mốc 2/3 nhưng không có dòng trong bảng). Bảng được sinh tự động từ code nên cột "bảng DB" ở mức module, không chi tiết từng route.

| Module | Endpoint | Quyền | Service chính | Bảng DB | Trong API_CONTRACT.md |
|---|---|---|---|---|---|
| addresses | `GET /api/addresses` | khách (đăng nhập) | AddressesService | addresses | có |
| addresses | `POST /api/addresses` | khách (đăng nhập) | AddressesService | addresses | có |
| addresses | `DELETE /api/addresses/:id` | khách (đăng nhập) | AddressesService | addresses | có |
| addresses | `PATCH /api/addresses/:id` | khách (đăng nhập) | AddressesService | addresses | có |
| addresses | `PATCH /api/addresses/:id/default` | khách (đăng nhập) | AddressesService | addresses | có |
| pages (admin nội dung) | `GET /api/admin/banners` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `POST /api/admin/banners` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `DELETE /api/admin/banners/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `PATCH /api/admin/banners/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `PATCH /api/admin/banners/reorder` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| catalog | `GET /api/admin/categories` | admin | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `POST /api/admin/categories` | admin | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| categories | `DELETE /api/admin/categories/:id` | admin | AdminCategoriesService | categories, media | có |
| categories | `PATCH /api/admin/categories/:id` | admin | AdminCategoriesService | categories, media | có |
| pages (admin nội dung) | `GET /api/admin/contact-messages` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `PATCH /api/admin/contact-messages/:id/handled` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| coupons (admin) | `GET /api/admin/coupons` | admin | AdminCouponsService | coupons, coupon_scopes, coupon_usages | có |
| coupons (admin) | `POST /api/admin/coupons` | admin | AdminCouponsService | coupons, coupon_scopes, coupon_usages | có |
| coupons (admin) | `DELETE /api/admin/coupons/:id` | admin | AdminCouponsService | coupons, coupon_scopes, coupon_usages | có |
| coupons (admin) | `GET /api/admin/coupons/:id` | admin | AdminCouponsService | coupons, coupon_scopes, coupon_usages | có |
| coupons (admin) | `PATCH /api/admin/coupons/:id` | admin | AdminCouponsService | coupons, coupon_scopes, coupon_usages | có |
| pages (admin nội dung) | `GET /api/admin/faq` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `POST /api/admin/faq/items` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `DELETE /api/admin/faq/items/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `PATCH /api/admin/faq/items/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `POST /api/admin/faq/topics` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `DELETE /api/admin/faq/topics/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `PATCH /api/admin/faq/topics/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| media | `POST /api/admin/media` | admin | MediaService (presign/confirm – khung cũ) | media | có |
| media | `POST /api/admin/media/confirm` | admin | MediaService (presign/confirm – khung cũ) | media | THIẾU |
| media | `POST /api/admin/media/presign` | admin | MediaService (presign/confirm – khung cũ) | media | THIẾU |
| product-models | `GET /api/admin/models` | admin | AdminModelCatalogService / ProductModelsService | product_3d_models, model_files, media, product_variants | có |
| product-models | `POST /api/admin/models` | admin | AdminModelCatalogService / ProductModelsService | product_3d_models, model_files, media, product_variants | có |
| product-models | `DELETE /api/admin/models/:id` | admin | AdminModelCatalogService / ProductModelsService | product_3d_models, model_files, media, product_variants | có |
| product-models | `POST /api/admin/models/:id/files/confirm` | admin | AdminModelCatalogService / ProductModelsService | product_3d_models, model_files, media, product_variants | THIẾU |
| product-models | `POST /api/admin/models/:id/files/presign` | admin | AdminModelCatalogService / ProductModelsService | product_3d_models, model_files, media, product_variants | THIẾU |
| product-models | `POST /api/admin/models/upload` | admin | AdminModelCatalogService / ProductModelsService | product_3d_models, model_files, media, product_variants | chỉ trong ghi chú |
| notifications | `GET /api/admin/notifications` | admin | NotificationsService | notifications | có |
| orders (admin) | `GET /api/admin/orders` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `POST /api/admin/orders` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `GET /api/admin/orders/:code` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `GET /api/admin/orders/:code/invoice` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | chỉ trong ghi chú |
| orders (admin) | `POST /api/admin/orders/:id/cancel` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `PATCH /api/admin/orders/:id/note` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `POST /api/admin/orders/:id/refund` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `PATCH /api/admin/orders/:id/shipment` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `PATCH /api/admin/orders/:id/status` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| orders (admin) | `GET /api/admin/orders/counts` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| pages (admin nội dung) | `GET /api/admin/pages` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `POST /api/admin/pages` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `DELETE /api/admin/pages/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | chỉ trong ghi chú |
| pages (admin nội dung) | `PATCH /api/admin/pages/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| orders (admin) | `PATCH /api/admin/payments/:id/confirm` | admin | AdminOrdersService | orders, order_items, order_status_history, payments, shipments, product_variants, inventory_movements, expenses, notifications | có |
| pages (admin nội dung) | `GET /api/admin/posts` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `POST /api/admin/posts` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `DELETE /api/admin/posts/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| pages (admin nội dung) | `PATCH /api/admin/posts/:id` | admin | AdminContentService | banners, posts, pages, faq_topics, faq_items, contact_messages, media | có |
| products (admin) | `GET /api/admin/products` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| products (admin) | `POST /api/admin/products` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| products (admin) | `DELETE /api/admin/products/:id` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| products (admin) | `GET /api/admin/products/:id` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| products (admin) | `PATCH /api/admin/products/:id` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| products (admin) | `GET /api/admin/products/:id/360` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| products (admin) | `PUT /api/admin/products/:id/360` | admin | AdminProductsService | products, product_variants, product_images, product_specs, variant_attribute_values, media, inventory_movements | có |
| reviews (admin hỏi đáp) | `GET /api/admin/questions` | admin | AdminQuestionsService | product_questions | có |
| reviews (admin hỏi đáp) | `PATCH /api/admin/questions/:id` | admin | AdminQuestionsService | product_questions | có |
| returns (admin) | `GET /api/admin/returns` | admin | AdminReturnsService | return_requests, return_request_items, product_variants, inventory_movements, expenses, orders, payments | có |
| returns (admin) | `PATCH /api/admin/returns/:id` | admin | AdminReturnsService | return_requests, return_request_items, product_variants, inventory_movements, expenses, orders, payments | có |
| reviews | `GET /api/admin/reviews` | admin | ReviewsService | reviews, review_images, orders, order_items, media | có |
| reviews | `PATCH /api/admin/reviews/:id/status` | admin | ReviewsService | reviews, review_images, orders, order_items, media | có |
| admin-stats | `GET /api/admin/search` | admin | AdminStatsService / AdminMiscService | orders, order_items, users, products, return_requests, product_questions, reviews, activity_logs | có |
| spaces (admin) | `GET /api/admin/spaces` | admin | AdminSpacesService | spaces, space_panoramas, space_hotspots, space_product_placements, media | có |
| spaces (admin) | `POST /api/admin/spaces` | admin | AdminSpacesService | spaces, space_panoramas, space_hotspots, space_product_placements, media | có |
| spaces (admin) | `DELETE /api/admin/spaces/:id` | admin | AdminSpacesService | spaces, space_panoramas, space_hotspots, space_product_placements, media | có |
| spaces (admin) | `GET /api/admin/spaces/:id` | admin | AdminSpacesService | spaces, space_panoramas, space_hotspots, space_product_placements, media | có |
| spaces (admin) | `PATCH /api/admin/spaces/:id` | admin | AdminSpacesService | spaces, space_panoramas, space_hotspots, space_product_placements, media | có |
| admin-stats | `GET /api/admin/stats/overview` | admin | AdminStatsService / AdminMiscService | orders, order_items, users, products, return_requests, product_questions, reviews, activity_logs | có |
| admin-users | `GET /api/admin/users` | admin | AdminUsersService | users, user_roles, user_sessions, orders, reviews, wishlists | có |
| admin-users | `POST /api/admin/users` | admin | AdminUsersService | users, user_roles, user_sessions, orders, reviews, wishlists | có |
| admin-users | `GET /api/admin/users/:id` | admin | AdminUsersService | users, user_roles, user_sessions, orders, reviews, wishlists | có |
| admin-users | `PATCH /api/admin/users/:id` | admin | AdminUsersService | users, user_roles, user_sessions, orders, reviews, wishlists | có |
| orders | `GET /api/admin/users/:id/orders` | admin | OrdersService (placeOrder, cancelCore) | orders, order_items, order_status_history, payments, product_variants, coupons, coupon_usages, code_counters | có |
| reviews | `GET /api/admin/users/:id/reviews` | admin | ReviewsService | reviews, review_images, orders, order_items, media | có |
| admin-users | `PATCH /api/admin/users/:id/status` | admin | AdminUsersService | users, user_roles, user_sessions, orders, reviews, wishlists | có |
| wishlist | `GET /api/admin/users/:id/wishlist` | admin | WishlistService | wishlists, products | có |
| auth | `POST /api/auth/forgot-password` | công khai | AuthService | users, user_roles, user_sessions, password_resets | có |
| auth | `POST /api/auth/google` | công khai | AuthService | users, user_roles, user_sessions, password_resets | có |
| auth | `POST /api/auth/login` | công khai | AuthService | users, user_roles, user_sessions, password_resets | có |
| auth | `POST /api/auth/logout` | công khai (token tùy chọn) | AuthService | users, user_roles, user_sessions, password_resets | có |
| auth | `POST /api/auth/refresh` | công khai | AuthService | users, user_roles, user_sessions, password_resets | có |
| auth | `POST /api/auth/register` | công khai | AuthService | users, user_roles, user_sessions, password_resets | có |
| auth | `POST /api/auth/reset-password` | công khai | AuthService | users, user_roles, user_sessions, password_resets | có |
| pages (nội dung công khai) | `GET /api/banners` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| catalog | `GET /api/brands` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| cart | `DELETE /api/cart` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| cart | `GET /api/cart` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| cart | `DELETE /api/cart/coupon` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| cart | `POST /api/cart/coupon` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| cart | `POST /api/cart/items` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| cart | `DELETE /api/cart/items/:id` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| cart | `PATCH /api/cart/items/:id` | khách (đăng nhập) | CartService | carts, cart_items, coupons, product_variants | có |
| catalog | `GET /api/categories` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| pages (nội dung công khai) | `POST /api/contact` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| coupons | `GET /api/coupons/me` | khách (đăng nhập) | CouponsService | coupons, user_coupons, coupon_usages | có |
| coupons | `POST /api/coupons/save` | khách (đăng nhập) | CouponsService | coupons, user_coupons, coupon_usages | có |
| coupons | `GET /api/coupons/suggested` | khách (đăng nhập) | CouponsService | coupons, user_coupons, coupon_usages | có |
| pages (nội dung công khai) | `GET /api/faq` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| health | `GET /health` | công khai | HealthService | (ping DB/Redis) | có |
| notifications | `GET /api/notifications` | khách (đăng nhập) | NotificationsService | notifications | có |
| notifications | `PATCH /api/notifications/:id/read` | khách (đăng nhập) | NotificationsService | notifications | có |
| notifications | `PATCH /api/notifications/read-all` | khách (đăng nhập) | NotificationsService | notifications | có |
| notifications | `GET /api/notifications/unread-count` | khách (đăng nhập) | NotificationsService | notifications | có |
| orders | `GET /api/orders` | khách (đăng nhập) | OrdersService (placeOrder, cancelCore) | orders, order_items, order_status_history, payments, product_variants, coupons, coupon_usages, code_counters | có |
| orders | `POST /api/orders` | khách (đăng nhập) | OrdersService (placeOrder, cancelCore) | orders, order_items, order_status_history, payments, product_variants, coupons, coupon_usages, code_counters | có |
| orders | `GET /api/orders/:code` | khách (đăng nhập) | OrdersService (placeOrder, cancelCore) | orders, order_items, order_status_history, payments, product_variants, coupons, coupon_usages, code_counters | có |
| orders | `POST /api/orders/:id/cancel` | khách (đăng nhập) | OrdersService (placeOrder, cancelCore) | orders, order_items, order_status_history, payments, product_variants, coupons, coupon_usages, code_counters | có |
| orders | `GET /api/orders/counts` | khách (đăng nhập) | OrdersService (placeOrder, cancelCore) | orders, order_items, order_status_history, payments, product_variants, coupons, coupon_usages, code_counters | có |
| pages (nội dung công khai) | `GET /api/pages` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| pages (nội dung công khai) | `GET /api/pages/:slug` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| payments | `POST /api/payments/:orderId/checkout` | khách (đăng nhập) | PaymentsService (settle) | payments, orders | có |
| payments | `POST /api/payments/:orderId/retry` | khách (đăng nhập) | PaymentsService (settle) | payments, orders | có |
| pages (nội dung công khai) | `GET /api/posts` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| pages (nội dung công khai) | `GET /api/posts/:slug` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | chỉ trong ghi chú |
| catalog | `GET /api/products` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `GET /api/products/:slug` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `GET /api/products/:slug/360` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `GET /api/products/:slug/model` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `GET /api/products/:slug/questions` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `POST /api/products/:slug/questions` | khách (đăng nhập) | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `GET /api/products/:slug/related` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| reviews | `GET /api/products/:slug/reviews` | công khai | ReviewsService | reviews, review_images, orders, order_items, media | có |
| reviews | `POST /api/products/:slug/reviews` | khách (đăng nhập) | ReviewsService | reviews, review_images, orders, order_items, media | có |
| catalog | `GET /api/products/facets` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| catalog | `GET /api/products/search` | công khai | ProductsService / CatalogViews | products, product_variants, product_images, categories, brands, attributes | có |
| returns | `GET /api/returns` | khách (đăng nhập) | ReturnsService | return_requests, return_request_items, return_request_images, order_items, media | có |
| returns | `POST /api/returns` | khách (đăng nhập) | ReturnsService | return_requests, return_request_items, return_request_images, order_items, media | có |
| reviews | `DELETE /api/reviews/:id` | khách (đăng nhập) | ReviewsService | reviews, review_images, orders, order_items, media | có |
| reviews | `PATCH /api/reviews/:id` | khách (đăng nhập) | ReviewsService | reviews, review_images, orders, order_items, media | có |
| reviews | `GET /api/reviews/me` | khách (đăng nhập) | ReviewsService | reviews, review_images, orders, order_items, media | có |
| pages (nội dung công khai) | `GET /api/settings/public` | công khai | ContentService | banners, posts, pages, faq_*, contact_messages, settings | có |
| spaces | `GET /api/spaces` | công khai | SpacesService | spaces, space_panoramas, space_hotspots, space_bookmarks, products, carts | có |
| spaces | `GET /api/spaces/:slug` | công khai | SpacesService | spaces, space_panoramas, space_hotspots, space_bookmarks, products, carts | có |
| spaces | `POST /api/spaces/:slug/add-to-cart` | khách (đăng nhập) | SpacesService | spaces, space_panoramas, space_hotspots, space_bookmarks, products, carts | chỉ trong ghi chú |
| spaces | `DELETE /api/spaces/:slug/bookmark` | khách (đăng nhập) | SpacesService | spaces, space_panoramas, space_hotspots, space_bookmarks, products, carts | có |
| spaces | `PUT /api/spaces/:slug/bookmark` | khách (đăng nhập) | SpacesService | spaces, space_panoramas, space_hotspots, space_bookmarks, products, carts | có |
| spaces | `GET /api/spaces/facets` | công khai | SpacesService | spaces, space_panoramas, space_hotspots, space_bookmarks, products, carts | có |
| users | `GET /api/users/me` | khách (đăng nhập) | UsersService | users, media | có |
| users | `PATCH /api/users/me` | khách (đăng nhập) | UsersService | users, media | có |
| users | `POST /api/users/me/change-password` | khách (đăng nhập) | UsersService | users, media | có |
| wishlist | `GET /api/wishlist` | khách (đăng nhập) | WishlistService | wishlists, products | có |
| wishlist | `DELETE /api/wishlist/:slug` | khách (đăng nhập) | WishlistService | wishlists, products | có |
| wishlist | `PUT /api/wishlist/:slug` | khách (đăng nhập) | WishlistService | wishlists, products | có |


**Route trong contract mà BE chưa có (10):** `GET /admin/stats/finance`, `GET /admin/settings`, `PUT /admin/settings/store`, `POST /admin/settings/reset-mock` (cố ý chỉ mock), `GET /admin/inventory`, `GET /admin/inventory/summary`, `GET /admin/inventory/receipts`, `GET /admin/inventory/suppliers`, `POST /admin/inventory/receipts`, `POST /admin/expenses`. Tất cả là phạm vi Mốc 4 (trừ `reset-mock`).

### 4.3 Các luồng nghiệp vụ chính (file:hàm)

**A. Đặt hàng → thanh toán (sandbox giả) → completed**
1. FE `POST /orders` → `OrdersController.create` → `OrdersService.create` (`modules/orders/orders.service.ts:59`): kiểm tra địa chỉ thuộc user + phương thức, rồi gọi `placeOrder` (`:87`).
2. `placeOrder` — **một transaction ReadCommitted**: khoá các `product_variants` bằng `SELECT … ORDER BY id FOR UPDATE` → kiểm tra `stock − reserved ≥ qty` (không đủ ⇒ `OUT_OF_STOCK`) → tính tiền từ **giá hiện tại** (`sale_price ?? price`) → `CartService.shippingFee` (theo vùng) → nếu đặt cả giỏ và có mã: khoá dòng coupon, `CouponsService.evaluate` (phạm vi tất cả/danh mục/sản phẩm/không gian, lượt dùng) → `nextOrderCode` → `setActor` (đặt `app.current_user_id`, `app.status_note` để trigger ghi lịch sử) → tạo `orders` (`pending`/`unpaid`), `order_items` (kèm `cost_price`), `reserved_quantity += qty`, `products.sold_count += qty`, `payments(pending)`, `coupon_usages` + `used_count`, xoá dòng giỏ, thông báo + activity log.
3. COD/chuyển khoản: dừng ở đây, `redirect` FE tới trang thành công. Online (`vnpay|momo|zalopay|card`): FE gọi `POST /payments/:orderId/checkout` (`payments.service.ts:98`) → `requireSandbox()` (cần `PAYMENT_SANDBOX_FAKE=true`) → `settle(orderId, success)` (`:31`, khoá đơn FOR UPDATE, idempotent khi đã `paid`): thành công ⇒ `payments.success` + `orders.payment_status=paid` + **`pending → confirmed`** (D-N13) + thông báo; thất bại ⇒ `failed`. `outcome` lấy **từ body do khách gửi** (hoặc `[fail]` trong ghi chú) — đây là giả lập, không có cổng thật.
4. Admin duyệt: `PATCH /admin/orders/:id/status` → `AdminOrdersService.setStatus` (`admin-orders.service.ts:180`) với `canTransition` (`pending→confirmed→processing→shipping→completed`, sai ⇒ 409 `INVALID_STATE`): sang `shipping` ⇒ **trừ tồn thật** (`stock −= qty`, `reserved −= qty`, movement `sale`) + tạo/ cập nhật `shipments(in_transit)`; sang `completed` ⇒ `shipments.delivered` + COD tự `paid`. Mỗi bước: lịch sử (trigger), thông báo, activity log. Hủy: khách `pending|confirmed` (`OrdersService.cancelCore`), admin tới `processing`; hủy trả `reserved` + lượt coupon.

**B. Đánh giá → admin duyệt → điểm trung bình**
`POST /products/:slug/reviews` → `ReviewsService.create` (`reviews.service.ts:117`): validate (1–5 sao, nội dung 20–1000 ký tự, ≤5 ảnh), chỉ đơn `completed` của chính user có sản phẩm đó (`PURCHASE_REQUIRED`), 1 đánh giá/(user, sản phẩm, đơn) (`CONFLICT`), ingest ảnh, tạo `reviews(status=pending)`. Admin: `PATCH /admin/reviews/:id/status` → `AdminReviewsService.setStatus` (`admin-reviews.service.ts:60`): `approved` / `rejected` (= "Ẩn") / hiện lại = `approved`; lần đầu duyệt ⇒ `NotificationsService.notify`; điểm trung bình **do trigger DB** `trg_reviews_refresh_rating` tính lại từ `approved` (hàm `averageRating` trong service chỉ là logic có unit test, trigger mới là thật). Sửa đánh giá (`PATCH /reviews/:id`) ⇒ về `pending`.

**C. Đổi trả → hoàn tiền → tồn kho và phiếu chi**
Khách `POST /returns` → `ReturnsService.create` (`returns.service.ts:115`): cần ≥1 dòng, `type` refund|exchange, `reason`, mô tả ≥10 ký tự, **ảnh minh chứng bắt buộc**; đơn phải `completed` và `isWithinReturnWindow(shipments.deliveredAt, 7 ngày)`; số lượng ≤ đã mua − đã yêu cầu (`returnableQuantity`); mã `RTnnnn` (`nextReturnCode`); `refundAmount = Σ unitPrice × qty`. Admin `PATCH /admin/returns/:id` → `AdminReturnsService.update` (`admin-returns.service.ts:~60`): máy trạng thái `RETURN_FLOW` = `pending→{picking,rejected}`, `picking→{inspecting,rejected}`, `inspecting→{refunded,exchanged,rejected}` (còn lại **409 `INVALID_STATE`**; `refunded` chỉ cho yêu cầu loại refund, `exchanged` chỉ cho loại exchange; `rejected` bắt buộc có `adminNote`). Khi `refunded|exchanged`: **cộng tồn đúng biến thể** + movement `return`. Khi `refunded`: tạo `expenses(category=refund, amount=refundAmount, order_id)`; nếu tổng đã hoàn ≥ (tiền hàng − giảm giá) và đơn đang `completed` ⇒ `orders.status/payment_status = refunded` + `payments.status=refunded`; hoàn một phần ⇒ đơn **giữ `completed`**. Mỗi bước: thông báo khách + `activity_logs('return.update_status')` (không có bảng lịch sử riêng).

**D. Không gian mẫu**
- Giá combo: `calcComboTotal(originalTotal, discountPercent)` (`spaces.service.ts:16`) = `round(tổng × (100−%)/100 / 1000) × 1000`; `originalTotal` = Σ giá hiện tại (`salePrice ?? price`) của **sản phẩm trong hotspot loại product** (`buildDetail`, `:140`); `%` = `spaces.combo_discount_percent` (0–50), mặc định 10.
- Thêm cả bộ: `POST /spaces/:slug/add-to-cart` → `SpacesService.addAllToCart` (`:203`): lấy biến thể mặc định mỗi sản phẩm, gọi `CartService.addItem` từng cái; hết hàng/ngừng bán ⇒ vào `unavailable[{productId,name,reason}]`, phần còn lại vẫn thêm. **FE không gọi endpoint này** (FE lặp `cartApi.addItem`).
- Kiểm tra hotspot: `AdminSpacesService.validatePanoramas` (`admin-spaces.service.ts:107`): yaw −180..360, pitch −90..90, loại ∈ product|navigation|info, product phải có `productId` tồn tại (`deletedAt null`), navigation `targetIndex` phải nằm trong danh sách ảnh; `variantId` (nếu gửi) phải thuộc sản phẩm — **chỉ kiểm tra, không lưu** (bảng không có cột).

**E. Upload mô hình 3D**
`AdminModelsController`: `GET /admin/models`; `POST /admin/models` (JSON → `uploadJson`, có thể kèm `fileData` data-URL base64); `POST /admin/models/upload` (multipart, `FileInterceptor`); `DELETE /admin/models/:id` (id = `model_files.id`). Lõi `AdminModelCatalogService.upload` (`admin-model-catalog.service.ts:139`): kiểm tra sản phẩm/biến thể, `scale` (0–100), `unit` mm|cm|m, `placement` floor|wall|table → `validateModelFile` → nếu **không có bytes** (đường FE hiện tại chỉ gửi metadata `{productId,fileName,sizeMB,format,allowAr,scale}`) ⇒ `stockBytes(format)` **nhân bản tệp mẫu cùng định dạng** đang có trong DB (không có ⇒ 400) → ghi kho với tên uuid → tạo `media`, tạo/cập nhật `product_3d_models` (primary), thay `model_files` cùng định dạng/LOD → activity log. `.gltf` được ánh xạ về định dạng `glb` (enum DB chỉ `glb|usdz`). Ánh xạ `allowScaling: !allowAr` ngược nghĩa trực giác — **chưa rõ** ý định (`admin-model-catalog.service.ts` trong nhánh tạo mới/cập nhật).

**F. Xem 360° sản phẩm** (đối chiếu [PROMPT_360_SAN_PHAM.md](PROMPT_360_SAN_PHAM.md))
Công khai `GET /products/:slug/360` → `Product360Service.view` (`product-360.service.ts:47`): 404 nếu không có cấu hình hoặc `enabled=false`; gom frame theo **màu** (`attribute_value_id`, thứ tự `frame_index`), trả `{productId, slug, enabled, frameCount, defaultColor, autoRotate, rotationSpeed, colors[{colorId,name,hex,frames[],thumbnail}], variants[…dimensionsCm, weightKg], product, policies[4]}` — khớp cấu trúc `Product360Data` mô tả trong `FE_PROGRESS.md`. Admin `GET|PUT /admin/products/:id/360` (`AdminProductsService.get360/save360`, `admin-products.service.ts:435,470`): bật cần ≥1 màu có ≥2 ảnh, frame ≤2MB, giữ thứ tự. **Lệch với PROMPT_360:** tên bảng thực tế `product_360_configs`/`product_360_frames` (tài liệu đề xuất `product_360`); frame **chỉ theo màu**, không theo kích thước (`size_value_id` trong đề xuất không có; ảnh 360° không đổi khi đổi size, kích thước/giá lấy từ biến thể); `products.has_360` không có cột (tính từ bảng cấu hình, `ProductListItem.has360`).

### 4.4 Chức năng theo vai trò – cái nào đã có BE
So [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](../DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) (80 UC, mục 3) với route thực tế:

| Trạng thái | UC |
|---|---|
| **Đã có BE** | AUTH-01..06, ACC-01/02/04/05/06, CAT-01..06, CART-01..04, ORD-01..03, PAY-01 (giả lập) / PAY-03, REV-01..03, 3D-01, SPACE-01..04, ADM-01 (người dùng), ADM-05 (danh mục), ADM-07 (trang tĩnh), ADM-09..11 (qua `/admin/products`), ADM-13 (mô hình 3D), ADM-15/16 (không gian + hotspot), ADM-18 (đánh giá), ADM-19 (mã giảm giá), ADM-20..25 (đơn, thanh toán, vận đơn qua `PATCH /admin/orders/:id/shipment`), ADM-28 (tổng quan) |
| **Thuộc Mốc 4, chưa làm** | ADM-03 (cài đặt hệ thống), ADM-12 (nhập kho/điều chỉnh tồn), **UC-PAY-02 (IPN/callback VNPAY)**, báo cáo thu chi (màn 7.28) |
| **Chưa có BE và chưa nằm trong mốc nào** | AUTH-07 (xác thực email), ACC-03 (quản lý phiên), ACC-07 (xoá tài khoản), ADM-02 (vai trò/quyền), ADM-04 (media riêng — chỉ có khung presign cũ), ADM-06 (thương hiệu: chỉ `GET /brands`), ADM-08 (thuộc tính), ADM-14 (biến thể chất liệu 3D), ADM-17 (placement 3D trong ảnh 360°), ADM-26 (gửi thông báo thủ công), ADM-27 (xem nhật ký hoạt động — chỉ ghi, không có API đọc riêng), ADM-29/30 (thống kê AR/phễu, gỡ ảnh AR), 3D-02..07 (AR, ảnh AR, phiên AR), SPACE-05/06 (thử đổi món, ghi `space_views` — hiện chỉ tăng `view_count` trực tiếp), UC-MOB-01..04 (Android) |
| **Có BE nhưng FE chưa dùng** | xem mục 5.3 |

Ghi chú: các UC "chưa có và chưa thuộc mốc nào" không có màn hình tương ứng trong FE 54 màn hình, nên không ảnh hưởng chạy FE; nhưng chúng nằm trong đặc tả. Cần hỏi người dùng có nằm trong phạm vi đồ án không (câu hỏi mục 11).

## 5. Frontend

### 5.1 Cấu trúc
- **Next.js 14 App Router** (`apps/web/src/app`), nhóm route `(shop)` (storefront), `(account)`, `(auth)`, `(viewer)` (trình xem 3D toàn màn hình), `admin/*` (có `admin/login` riêng). Layout/provider: `app/providers.tsx` (TanStack Query, `<Toaster/>`, nạp phiên đăng nhập sau khi mount).
- **State:** server state bằng TanStack Query (`hooks/*`, `lib/query-client.ts`); client state bằng Zustand (`store/authStore.ts` giữ access token + `hydrated`, `cartStore`, `uiStore`, `viewerStore`).
- **Lớp gọi API:** `services/api-client.ts` — một điểm vào `request()`; `USE_MOCK = NEXT_PUBLIC_USE_MOCK==='true'` quyết định chuyển request vào `mock-data/mockApi` hay `fetch(NEXT_PUBLIC_API_URL + '/api' + path)`; gắn `Authorization: Bearer`; chờ `hydrated` trước khi gửi (sửa 401 khi tải lại trang); lỗi → `ApiClientError(code,message,status,details)`; **401 với token đã gửi ⇒ đăng xuất cục bộ; FE không tự gọi `/auth/refresh`** (vì vậy access token dev đặt 12h). Service theo miền: `auth/cart/content/media/product/space/admin .api.ts`.
- **Kiểu dùng chung:** `@aurelia-living/shared-types` (enum, entity sinh từ Prisma, `ApiResult`, `ErrorCode`); các `*View` (hình dạng response không phải entity) nằm ở `apps/web/src/types/api.ts` (chưa chuyển sang gói chung — đã ghi ở BE_PROGRESS).
- Dùng **API thật hay mock** là cờ toàn cục `NEXT_PUBLIC_USE_MOCK`, không phải theo từng trang. Với `false`, trang nào gọi endpoint BE chưa có sẽ nhận 404 → mục 5.2 đánh dấu.

### 5.2 Trang FE → endpoint (quét từ `services/*.api.ts` + import của trang; đã lọc các lời gọi dùng chung ở header/giỏ/yêu thích)
Cột "Với API thật": ✅ BE đã có đủ · ❌ gọi endpoint BE chưa có (Mốc 4).

**Phía khách**

| Route | Endpoint chính | Với API thật |
|---|---|---|
| `/` | `GET /banners`, `/categories`, `/products` | ✅ |
| `/products`, `/search` | `GET /products`, `/products/search`, `/products/facets`, `/categories` | ✅ |
| `/products/[slug]` | `GET /products/:slug`, `/reviews`, `/questions`, `/related`; `POST /products/:slug/questions`; giỏ/yêu thích | ✅ |
| `/products/[slug]/360` | `GET /products/:slug/360` (+ giỏ, yêu thích) | ✅ |
| `/products/[slug]/3d` | `GET /products/:slug`, `/products/:slug/model` | ✅ |
| `/spaces`, `/spaces/[slug]` | `GET /spaces`, `/spaces/facets`, `/spaces/:slug`; `PUT\|DELETE /spaces/:slug/bookmark`; "Thêm cả bộ" = lặp `POST /cart/items` | ✅ |
| `/cart` | `GET\|DELETE /cart`, `POST\|PATCH\|DELETE /cart/items`, `POST\|DELETE /cart/coupon` | ✅ |
| `/checkout`, `/checkout/success`, `/checkout/failed` | `GET /addresses`, `POST /addresses`, `POST /orders`, `POST /payments/:id/checkout`, `/retry`, `GET /orders/:code`, `GET /settings/public`, `GET /coupons/suggested`, `POST /coupons/save` | ✅ (thanh toán online = giả lập) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | `POST /auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/google` | ✅ (Google = stub) |
| `/account/profile` | `GET\|PATCH /users/me`, `/addresses*`, `GET /orders` | ✅ |
| `/account/password` | `POST /users/me/change-password` | ✅ |
| `/account/orders`, `/account/orders/[code]` | `GET /orders`, `/orders/counts`, `/orders/:code`, `POST /orders/:id/cancel`, `/payments/:id/retry`, `POST /products/:slug/reviews` | ✅ |
| `/account/reviews` | `GET /reviews/me`, `PATCH /reviews/:id`, `POST /products/:slug/reviews` | ✅ |
| `/account/returns`, `/account/returns/new` | `GET\|POST /returns`, `GET /orders/:code` | ✅ |
| `/account/coupons` | `GET /coupons/me`, `/suggested`, `POST /coupons/save` | ✅ |
| `/account/notifications` | `GET /notifications`, `/unread-count`, `PATCH /:id/read`, `/read-all` | ✅ |
| `/wishlist` | `GET /wishlist`, `PUT\|DELETE /wishlist/:slug` | ✅ |
| `/about`, `/policies/[slug]` | `GET /pages/:slug` | ✅ |
| `/faq` | `GET /faq` | ✅ |
| `/contact` | `POST /contact`, `GET /settings/public` | ✅ |

**Phía admin** (`/admin/login` → `POST /auth/login`; chuông thông báo → `GET /admin/notifications`; tìm nhanh → `GET /admin/search`)

| Route | Endpoint chính | Với API thật |
|---|---|---|
| `/admin` (và `/admin/dashboard` chuyển hướng) | `GET /admin/stats/overview` | ✅ |
| `/admin/products`, `/new`, `/[id]` (6 tab + tab Ảnh 360°) | `GET\|POST /admin/products`, `GET\|PATCH\|DELETE /admin/products/:id`, `GET\|PUT /admin/products/:id/360`, `GET /brands`, `/categories` | ✅ |
| `/admin/categories` | `GET\|POST /admin/categories`, `PATCH\|DELETE /:id` | ✅ |
| `/admin/orders`, `/admin/orders/[code]` | `GET /admin/orders`, `/counts`, `/:code`, `POST /admin/orders`, `PATCH /:id/status\|shipment\|note`, `POST /:id/cancel\|refund`, `PATCH /admin/payments/:id/confirm` | ✅ (in hóa đơn dùng chi tiết đơn, không gọi `/invoice`) |
| `/admin/customers`, `/[id]` | `GET\|POST /admin/users`, `GET\|PATCH /admin/users/:id`, `PATCH /:id/status`, `GET /:id/orders\|reviews\|wishlist` | ✅ (thiếu tab "Mã giảm giá" ở chi tiết KH — theo FE_PROGRESS) |
| `/admin/promotions`, `/new`, `/[id]` | `GET\|POST /admin/coupons`, `GET\|PATCH\|DELETE /:id` | ✅ |
| `/admin/reviews` | `GET /admin/reviews`, `PATCH /admin/reviews/:id/status` | ✅ |
| `/admin/questions` | `GET /admin/questions`, `PATCH /admin/questions/:id` | ✅ |
| `/admin/returns` | `GET /admin/returns`, `PATCH /admin/returns/:id` | ✅ |
| `/admin/models` | `GET\|POST\|DELETE /admin/models`, `GET /admin/products` | ✅ (upload = metadata, xem mục 9) |
| `/admin/spaces`, `/new`, `/[id]` | `GET\|POST /admin/spaces`, `GET\|PATCH\|DELETE /:id`, `GET /admin/products` | ✅ |
| `/admin/content` (banner, bài viết, trang tĩnh) | `GET\|POST /admin/banners`, `PATCH\|DELETE /:id`, `GET\|POST /admin/posts`, `PATCH\|DELETE /:id`, `PATCH /admin/pages/:id` | ✅ (tab "Menu & footer" chỉ hiển thị thông tin) |
| **`/admin/inventory`** (Kho hàng) | `GET /admin/inventory`, `/summary`, `/receipts`, `/suppliers`, `POST /admin/inventory/receipts` | ❌ **404 — Mốc 4** |
| **`/admin/reports`** (Báo cáo thu chi) | `GET /admin/stats/finance`, `POST /admin/expenses` (+ đọc `/admin/orders`, `/admin/inventory/*`) | ❌ **404 — Mốc 4** |
| **`/admin/settings`** (Cài đặt) | `GET /admin/settings`, `PUT /admin/settings/store`; `POST /admin/settings/reset-mock` (chỉ mock; tab "Dữ liệu giả lập" chỉ hiện khi `USE_MOCK`) | ❌ **404 — Mốc 4** |

Trang FE tổng cộng 54 (bảng ở [FE_PROGRESS.md](FE_PROGRESS.md)); ba trang ❌ ở trên là những trang admin chưa chạy với API thật. `apps/web/tests/e2e/screens.spec.ts` test "admin: đăng nhập và duyệt mọi màn hình quản trị" **bị loại khỏi nhóm khách** của `test:e2e:real` và cũng không có trong nhóm nào khác — vì có 3 trang ❌ nên test này sẽ fail với API thật cho đến Mốc 4 (**chưa rõ**: file `screens.spec.ts:116`).

### 5.3 Đối chiếu FE ↔ BE (kết quả script `fe_scan` so 138 lời gọi FE với 152 route BE)
- **FE gọi mà BE không có (10):** đúng 10 route Mốc 4 ở mục 4.2. Không có lời gọi nào khác thiếu.
- **BE có mà FE không gọi (xác nhận danh sách agent trước và bổ sung):** FAQ admin (`/admin/faq*`, 6 route), liên hệ admin (`GET /admin/contact-messages`, `PATCH …/handled`), thêm/xoá trang tĩnh (`POST /admin/pages`, `DELETE /admin/pages/:id`), `GET /posts/:slug`, `PATCH /admin/banners/reorder`, `POST /spaces/:slug/add-to-cart`, `POST /admin/models/upload`. **Bổ sung thêm:** `POST /auth/refresh`, `GET /admin/orders/:code/invoice`, `GET /pages` (danh sách), `POST /admin/media`, `POST /admin/media/presign|confirm`, `POST /admin/models/:id/files/presign|confirm` (khung presign cũ).
- **Lệch hành vi thấy được (không phải thiếu route):**
  1. "Thêm cả bộ vào giỏ" (`app/(shop)/spaces/[slug]/page.tsx:58`) lặp `cartApi.addItem` tuần tự → món hết hàng giữa chừng làm thao tác dừng sau khi đã thêm một phần, rồi báo lỗi chung; BE đã có `add-to-cart` báo rõ món nào hết.
  2. Giá combo FE tự tính lại (`…/page.tsx:55`) bằng cùng công thức làm tròn 1.000đ cho các món được chọn, trong khi BE chỉ trả `comboTotal` cho cả bộ; hai công thức phải giữ đồng bộ bằng tay.
  3. Có **30 chú thích `// TODO: chưa có trong BE`** còn sót trong `services/*.api.ts`, phần lớn đã lỗi thời (BE đã có từ Mốc 1–3); chỉ nhóm inventory/finance/expenses/settings là thật.
  4. FE không dùng refresh token; token 12h chỉ là biện pháp tạm cho dev.
  5. Tên field/kiểu: không phát hiện lệch khi chạy 20 test Playwright với API thật, nhưng tôi **không** so từng field của `types/api.ts` với response (chưa rõ). `StoreSettings`, `FinanceReport`, `InventoryRow`, `StockReceipt`, `Supplier`, `Expense` đã có kiểu ở `types/api.ts` — là hợp đồng cho Mốc 4.

## 6. Các luồng nghiệp vụ chính
Xem mục 4.3 (A–F). Quy tắc nền đã chốt: mã đơn `ALV-YYYYMMDD-NNNN`; giữ chỗ tồn kho khi tạo đơn, trừ thật khi sang `shipping`, hủy trả giữ chỗ, đổi trả cộng tồn; khách hủy ở `pending|confirmed`, từ `processing` chỉ admin; giữ bước `confirmed`; `completed` = "Đã giao"; đánh giá có kiểm duyệt (`rejected` = "Ẩn"); không gộp giỏ vãng lai; `OTP_FIXED_CODE` bị cấm khi `NODE_ENV=production` (`config/env.validation.ts:95`). Các quyết định gốc nằm ở [DECISIONS.md](../DECISIONS.md) và [BACKEND_DESIGN.md](../BACKEND_DESIGN.md) mục 4, 9–11.

## 7. Kết quả chạy lại test (2026-11-06, chạy bởi agent tiếp nhận) so với báo cáo cũ

| Hạng mục | Báo cáo cũ | Chạy lại | Kết luận |
|---|---|---|---|
| `tsc` web (`npm run typecheck -w @aurelia-living/web`) | sạch | ✅ sạch | khớp |
| `tsc` API theo tsconfig build (`-p apps/api/tsconfig.build.json --noEmit`) | sạch | ✅ sạch | khớp |
| **`npm run typecheck -w @aurelia-living/api`** (`tsconfig.json`, gồm `prisma/**`, `test/**`) | "sạch" | ❌ **7 lỗi TS** | **báo cáo cũ không đúng với script `typecheck` của repo** — xem dưới |
| ESLint (`npx eslint .`) | 0 lỗi, 1 cảnh báo | ✅ 0 lỗi, 1 cảnh báo `no-console` (`apps/api/prisma/seed-mock.ts:28`) | khớp. Nhưng `npm run lint` = `eslint . --max-warnings=0` ⇒ **sẽ thất bại** vì cảnh báo này |
| Unit API (Jest) | 87 test / 10 suite | ✅ **87 / 10 suite** | khớp |
| Unit web (Vitest) | 15–17 (FE_PROGRESS ghi 15) | ✅ **17 test / 4 file** | FE_PROGRESS ghi 15, thực tế 17 (cũ) |
| E2E supertest trên `aurelia_test` | 94 (M2 47 + M3 47) | ✅ **94 / 2 suite** (`mock-m2` + `mock-m3`) | khớp |
| Playwright với API thật `npm run test:e2e:real` | 20 | ✅ **20**: khách+trang chủ 6 (7 trừ 1 test admin bị loại), xem-360 8, admin-m2 3, admin-m3 3; cả 4 nhóm ✅ | khớp |
| `next build`, `nest build` | sạch | `nest build` chạy trong `test:e2e:real` ✅; `next build` **chưa chạy lại** (tốn thời gian, tránh ghi đè `tsconfig.json`) | chưa kiểm lại |
| Cổng 4002 / 3100 sau khi chạy | – | ✅ không còn tiến trình nào nghe (kiểm bằng `netstat`); cổng 4000 vẫn có API demo (PID 44656) | OK |

**Chi tiết lỗi `typecheck` API (không sửa, chỉ ghi):** 7 lỗi `TS2307/TS2732` đều từ `apps/web/src/mock-data/tables/*` (`_360_gen.ts`, `_content_gen.ts`, `_products_gen.ts`, `_social_gen.ts`, `_spaces_gen.ts`, `users.ts`): `Cannot find module '@/lib/format'`, `'@/types/api'`, `'../../../scripts/mock-360-products.json'`. Nguyên nhân (suy ra): `apps/api/prisma/seed-mock.ts:25,169` import kiểu/mã từ `../../web/src/mock-data/db`, và `apps/api/tsconfig.json` có `include: ["prisma/**/*"]` nhưng không có alias `@/*` của web cũng như `resolveJsonModule`. Lỗi có từ Mốc 1 (commit `67b56d5` thêm `seed-mock.ts`). Hệ quả: bước `typecheck` của CI (`.github/workflows/ci.yml`) và `npm run typecheck` ở gốc sẽ **đỏ**. Agent trước báo "tsc sạch" vì dùng `tsconfig.build.json`.

**Tác dụng phụ của việc chạy test (tôi đã dọn):** `test:e2e:real` làm Next ghi đè `apps/web/tsconfig.json` (định dạng lại `lib`, thêm `plugins`…); tôi đã `git checkout apps/web/tsconfig.json` để file về đúng commit. Không file code nào khác bị đổi.

## 8. Tài liệu đã cũ hoặc lệch với code

| File | Mục | Lệch thế nào |
|---|---|---|
| [README.md](../../README.md) | "Trạng thái" (đầu file) | Ghi "144 endpoint… mới cài 6 route… bắt đầu từ M02"; thực tế 152 route, Mốc 1–3 xong |
| README.md | mục 4 `npm run db:seed` | Mô tả seed "admin + dữ liệu mẫu, tải MinIO"; thực tế mặc định seed từ mock FE vào kho local và từ chối DB có dữ liệu ngoài mock |
| README.md | mục 6 | "Jest 29 test"; thực tế 87 unit + 94 supertest DB + 20 Playwright thật. Không nhắc `test:e2e:real`, `test:e2e:db` ở phần này (có ở mục cuối "Backend thật + kiểm thử") |
| README.md | mục 7 "Tài khoản mẫu" | `admin@aurelia.vn/Admin@123456`, `nguyenvana@example.com`…: chỉ đúng với seed `legacy`; seed mặc định là `admin123` / `khachhang@aurelia.vn/123456` (đúng ở mục cuối README) |
| README.md | mục 8 `npm run db:reset` | Ghi "xoá sạch DB, dựng lại, seed"; thực tế script **bị vô hiệu hoá** (`apps/api/package.json`), thay bằng `node scripts/db-reset.mjs <aurelia_demo\|aurelia_test>` |
| README.md | mục 5 cách B, 9 | "`docker compose up` chạy cả API trong Docker, tự `migrate deploy`": service `api` nay nằm trong profile `legacy` (không chạy mặc định) |
| README.md | mục 1 | Yêu cầu Node 22; máy dev đang Node 24.20 (ghi trong README); `.nvmrc` chưa kiểm |
| [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md), [CAU_TRUC_DB.md](../CAU_TRUC_DB.md) | toàn bộ (mục 1, 4, 5, 8.3) | Chỉ 44 bảng/19 enum; thiếu 20 bảng + 7 enum + cột thêm của `add_backend_extras` và 4 migration sau; tài liệu nói trigger 36 (29 updated_at + 7) — 20 bảng mới không có trigger updated_at; `coupon_type` thiếu `freeship` nếu còn ghi 2 giá trị |
| [QUY_UOC_CODE_DB.md](../QUY_UOC_CODE_DB.md) | mục 5.x, mục 8 | Không nhắc `reserved_quantity` (giữ chỗ), `code_counters`, bảng mới; mục 5.1 ví dụ trừ tồn khi đặt hàng, còn code thực tế **giữ chỗ khi đặt, trừ khi `shipping`** |
| [API_CONVENTIONS.md](../API_CONVENTIONS.md) | mục cache (`CacheService … Hiện chưa module nghiệp vụ nào gọi`) | Vẫn đúng (không module dùng), nhưng quy ước khoá cache `products:<slug>`… **không được áp dụng**: sản phẩm dùng chỉ mục RAM 15s. Mục thông báo/OTP: không nhắc `OTP_FIXED_CODE` |
| [API_CONTRACT.md](../API_CONTRACT.md) | bảng route | Thiếu 4 route khung cũ (`/admin/media/presign\|confirm`, `/admin/models/:id/files/presign\|confirm`); 16 route Mốc 2–3 chỉ có trong phần ghi chú, không có dòng bảng. Phần ghi chú đầu file vẫn mô tả "139 endpoint" (nay 152) |
| [BACKEND_DESIGN.md](../BACKEND_DESIGN.md) | mục 3.3 (9 migration dự kiến), mục 8 | Dự kiến 9 migration additive, thực tế BE thêm 5 migration (`add_backend_extras` + 4 migration nhỏ); MoMo/ZaloPay "stub sandbox" (mục 4.5) mâu thuẫn DAC_TA D-N20 (ngoài phạm vi) |
| [BE_PROGRESS.md](../BE_PROGRESS.md) | Giai đoạn 2–3 | Phần "Giai đoạn 3 – Backend hiện có" mô tả khung rỗng/29 unit/139 endpoint chưa có logic — **chụp thời điểm trước Mốc 1**, đã thành quá khứ. Mục Mốc 1 ghi "tsc sạch" (chỉ đúng với tsconfig.build). Mục 5 Mốc 2 cũ ghi "7. Còn lệch… 2": nút `reset-mock` đã được chính mục Mốc 3 đính chính |
| [FE_PROGRESS.md](FE_PROGRESS.md) | "Việc còn tồn đọng", bảng test | "Backend thật mới là khung rỗng" — không còn đúng; "15 unit test" — thực tế 17; ghi chú `TODO: chưa có trong BE` ở code FE còn sót (30 chỗ) |
| [TIEN_DO.md](TIEN_DO.md), [READINESS_REPORT.md](READINESS_REPORT.md), [MODULE_ENV_REPORT.md](MODULE_ENV_REPORT.md), [ENV_SETUP_REPORT.md](ENV_SETUP_REPORT.md), [DOC_SYNC_REPORT.md](DOC_SYNC_REPORT.md) | toàn bộ | Báo cáo chụp 2026-10-08/09 (trước khi có BE nghiệp vụ). README tự ghi MODULE_ENV_REPORT "đã lỗi thời một phần". Tôi **chỉ lướt**, không đối chiếu từng dòng (chưa rõ) |
| [ENVIRONMENT.md](../ENVIRONMENT.md) | bảng biến | Thiếu `OTP_FIXED_CODE`, `GOOGLE_CLIENT_ID/SECRET`, `PAYMENT_SANDBOX_FAKE`, `THROTTLE_*` đã thêm sau; (`.env.example` có đủ) — chưa đối chiếu hết (chưa rõ) |
| [PROMPT_360_SAN_PHAM.md](PROMPT_360_SAN_PHAM.md) | 1.1 | Đề xuất bảng `product_360`, `size_value_id`, `products.has_360`; thực tế `product_360_configs`/`product_360_frames`, chỉ theo màu |
| [WIREFRAME.md](../WIREFRAME.md) | – | Không đối chiếu (không cần cho lượt này) |
| `docs/aurelia_dev_backup.sql` | – | Là dump UTF-16 của DB **trước** migration `add_backend_extras` (44 bảng + `_prisma_migrations`, không có `return_requests`…). Không dùng để dựng DB hiện tại |

Ngoài ra: **4 file docs đã bị xoá khỏi working tree** (hiện `git status` báo ` D`): `BAI_TAP_TU_HOC_2.md`, `KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md`, `TONG_HOP_USE_CASE_KHACH_HANG.md`, `báo cáo giữa kì 1.md`. Chúng còn tồn tại lúc tôi chạy `ls docs/` đầu phiên; **tôi không xoá** (và không thực hiện lệnh xoá nào); chưa rõ ai xoá. Chưa khôi phục — cần người dùng quyết định (câu hỏi mục 11). Các file còn nhắc tên chúng (có thể thành link hỏng): `DECISIONS.md`, `DOC_SYNC_REPORT.md`, `PROJECT_ANALYSIS.md`, `READINESS_REPORT.md` (kiểm bằng grep, chưa mở từng chỗ).

## 9. Nợ kỹ thuật và điểm lệch FE–BE

**Agent trước đã ghi:**
1. Hotspot không lưu `variantId` (bảng `space_hotspots` không có cột; BE chỉ kiểm tra). `types/api.ts` hotspot cũng không có biến thể ⇒ "mua đúng biến thể trong ảnh" chưa làm được.
2. Hoàn tiền một phần: đơn vẫn `completed`, chỉ tạo phiếu chi; hoàn đủ tiền hàng ⇒ đơn `refunded` (`admin-returns.service.ts`).
3. Thanh toán online vẫn là **sandbox giả**; cổng VNPAY/IPN/return chưa có (Mốc 4).
4. Upload mô hình 3D từ FE chỉ gửi metadata; BE nhân bản tệp mẫu; `.gltf` lưu thành `glb`.
5. Các endpoint BE có mà FE chưa gọi (mục 5.3).
6. Trang Kho, Thu chi, Cài đặt → 404 với API thật.

**Tôi tự phát hiện:**
7. **`npm run typecheck` của API đỏ** (7 lỗi, mục 7) ⇒ CI đỏ; `npm run lint` (max-warnings=0) cũng đỏ vì 1 cảnh báo.
8. **`POST /payments/:orderId/checkout` cho khách tự chọn `outcome: 'success'`** và đơn được đánh dấu `paid` + `confirmed` mà không có cổng thật (`payments.service.ts:98-106`). Chỉ chặn bằng `PAYMENT_SANDBOX_FAKE`, mặc định `true` và **không bị cấm ở `NODE_ENV=production`** (khác `OTP_FIXED_CODE`, `config/env.validation.ts:84`). Rủi ro nếu triển khai thật mà quên tắt.
9. Không có interceptor activity-log chung; log do từng service tự gọi (mục 4.1). Quên gọi ⇒ mất log, không test nào bắt được.
10. `updated_at` của bảng mới không có trigger (mục 3.2) — `return_requests.updated_at`, `product_360_configs.updated_at` có thể đứng yên khi sửa.
11. 20 bảng mới dùng `SERIAL`, không `IDENTITY ALWAYS` như quy ước DB.
12. `refundAmount` của yêu cầu trả hàng = Σ `unitPrice × qty` (`returns.service.ts`), **không trừ phần giảm giá/mã của đơn và không tính phí ship**; có thể hoàn nhiều hơn khách thực trả khi đơn có coupon. Chính sách chưa được chốt (**chưa rõ**).
13. Đổi hàng (`exchanged`) cộng lại tồn hàng trả về nhưng **không trừ tồn/không tạo đơn mới** cho sản phẩm đổi — việc giao hàng mới chưa được mô hình hoá.
14. `CouponScope.target_id` đa hình, không FK ⇒ xoá sản phẩm/danh mục/không gian có thể để lại scope mồ côi (chưa kiểm).
15. `CacheService` (Redis) và hàng đợi BullMQ có hạ tầng nhưng nghiệp vụ không dùng; chỉ mục sản phẩm là bộ nhớ trong tiến trình (nhiều instance API sẽ lệch cache 15s).
16. Danh sách (đánh giá, hỏi đáp, đổi trả, không gian…) nhiều chỗ **lọc và phân trang trong bộ nhớ** (`findMany` rồi `slice`) — ổn cho đồ án, không mở rộng được.
17. `allowScaling: !allowAr` trong upload mô hình (mục 4.3E) – ánh xạ ngược, chưa rõ có chủ ý.
18. Nhiều module khung rỗng vẫn được đăng ký trong `modules/index.ts` và còn comment "TRẠNG THÁI: khung rỗng" (`settings.service.ts`, …) — dễ gây hiểu nhầm.
19. Seed `db:seed` trên `aurelia_dev` chỉ an toàn nhờ guard "có dữ liệu ngoài mock" (mục 3.4); script `.env` mặc định trỏ `aurelia_dev`.
20. `docs/aurelia_dev_backup.sql` (dump dữ liệu) đang được git theo dõi, trong khi `*.dump` được ignore — kiểm tra xem có chứa dữ liệu cá nhân/ băm mật khẩu không trước khi đẩy lên remote (chưa rõ nội dung dữ liệu; tôi không đọc).
21. Hai nhánh remote `Huyen-Trang`, `feature/yen/user-page-ui` chưa rõ nội dung/quan hệ với `feature/backend`.

## 10. Chuẩn bị cho Mốc 4 (kho, thu chi + báo cáo, cài đặt, VNPAY sandbox)

**Đã có sẵn trong DB (migration #3):** `suppliers`, `stock_receipts` (`code`, `type in|out`, `supplier_id`, `order_code`, `status draft|completed|cancelled`, `created_by`), `stock_receipt_items` (`variant_id`, `quantity`, `cost_price`), `expenses` (`code`, `category cogs|shipping|marketing|payment_fee|refund|other`, `amount`, `date`, `order_id`, `receipt_id`), `inventory_movements` (đã được đơn hàng/đổi trả ghi), `product_variants.min_stock/cost_price/reserved_quantity`, `order_items.cost_price` (để tính giá vốn), `settings` (key/value JSON; đã có `GET /settings/public` đọc từ đây — `ContentService`), bộ sinh mã `nextReceiptCode`, `nextExpenseCode` (`code-generator.ts`). Phiếu chi `refund` đã được Mốc 3 tạo tự động khi hoàn tiền.
**Module sẵn khung rỗng:** `modules/inventory` (`admin-inventory.controller.ts`, `inventory.service.ts`), `modules/settings` (`admin-settings.controller.ts`, `settings.service.ts`), `modules/payments` (có `settle`, cần thêm gateway), `modules/admin-stats` (có `overview`, cần thêm `finance`).
**Trang FE chờ:** `/admin/inventory`, `/admin/reports`, `/admin/settings`. Kiểu response có sẵn trong `apps/web/src/types/api.ts`: `InventoryRow`, `StockReceipt`, `Supplier`, `Expense`, `FinanceReport`, `StoreSettings`; hợp đồng gốc ở mock `apps/web/src/mock-data/mockApi/admin.ts`.

**Yêu cầu thuộc Mốc 4 trong tài liệu:**
- [PROMPT_AGENT_BE.md](../PROMPT_AGENT_BE.md) (Giai đoạn 9, dòng ~95-97, 155, 173, 191): kho (tồn, phiếu nhập/xuất, nhà cung cấp, tóm tắt), thu chi + báo cáo `/admin/stats/finance` + xuất CSV, cài đặt (cửa hàng, thanh toán, vận chuyển), **VNPAY sandbox** (tạo URL, return, IPN, kiểm tra chữ ký, idempotent), unit test chữ ký VNPAY, `.env.example` đủ biến.
- [BACKEND_DESIGN.md](../BACKEND_DESIGN.md) 4.5 (VNPAY HMAC-SHA512; MoMo/ZaloPay stub `PaymentGateway`), 4.8 (công thức báo cáo: tổng thu, tổng chi, lợi nhuận, biên; bảng kết quả kinh doanh `gross/discountAndRefund/net/cogs/grossProfit/opex/profitBeforeTax`, `ledger`).
- [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](../DAC_TA_CHUC_NANG_THEO_VAI_TRO.md): UC-PAY-01/02/03, UC-ADM-03, UC-ADM-12, mục 11.1 (endpoint `GET /api/payments/:gateway/return`, `POST|GET /api/payments/:gateway/ipn`; biến `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `PAYMENT_RETURN_URL`, `PAYMENT_IPN_BASE_URL`…).
- Hiện `.env.example` / `env.validation.ts` đã có `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL` (tuỳ chọn); chưa có `PAYMENT_*URL` như đặc tả.

**Cần hỏi người dùng trước khi làm:** xem mục 11 (các câu về VNPAY key, MoMo/ZaloPay, hoàn tiền, phạm vi cài đặt, thanh toán giả lập).

## 11. Câu hỏi cho người dùng

1. **4 file docs đã bị xoá** (`BAI_TAP_TU_HOC_2.md`, `KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md`, `TONG_HOP_USE_CASE_KHACH_HANG.md`, `báo cáo giữa kì 1.md`): bạn chủ động xoá, và có muốn tôi khôi phục từ git (`git checkout -- docs/…`) không?
2. **VNPAY sandbox:** bạn đã có `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` sandbox chưa? Nếu chưa, Mốc 4 làm chữ ký + IPN kiểm thử bằng test (không gọi cổng thật) và giữ chế độ giả lập cho demo?
3. **MoMo/ZaloPay/thẻ:** `DAC_TA` (D-N20) nói ngoài phạm vi, `BACKEND_DESIGN` nói làm stub. Chọn bên nào? Hiện FE vẫn cho chọn các phương thức này.
4. **Chế độ giả lập thanh toán:** có muốn cấm `PAYMENT_SANDBOX_FAKE=true` khi `NODE_ENV=production` (giống `OTP_FIXED_CODE`) và bỏ việc để khách tự chọn `outcome` không?
5. **Typecheck/CI:** cho phép sửa `apps/api/tsconfig.json` (loại `prisma/seed-mock.ts` khỏi `typecheck`, hoặc thêm alias) và/hoặc cảnh báo `no-console` để `npm run typecheck`/`npm run lint` xanh trước khi sang Mốc 4?
6. **Kho (`/admin/inventory`):** "Điều chỉnh tồn" (ADM-12) có là phiếu `in`/`out` hay movement `adjustment` riêng? Tồn admin nhập là "có thể bán" hay tồn vật lý (hiện admin sản phẩm dùng "có thể bán" – `BE_PROGRESS` Mốc 2)?
7. **Báo cáo thu chi:** doanh thu tính theo đơn `paid`, theo `completed`, hay theo ngày giao? Phí vận chuyển/ phí cổng thanh toán có tự sinh phiếu chi không? Giá vốn lấy từ `order_items.cost_price` (đã có) đúng không?
8. **Cài đặt:** phạm vi lưu những gì (cửa hàng, vùng giao hàng + phí ship, phương thức thanh toán bật/tắt)? Phí ship hiện tính cứng theo vùng trong `CartService.shippingFee` — chuyển sang đọc từ settings?
9. **Hoàn tiền:** `refundAmount` có nên trừ phần giảm giá của đơn và phí ship (mục 9 #12)? Đổi hàng (`exchanged`) có cần tạo đơn/ trừ tồn sản phẩm mới không (mục 9 #13)?
10. **Phạm vi UC chưa có BE** (mục 4.4: AUTH-07, ACC-03/07, ADM-02/04/06/08/14/17/26/27/29/30, AR, mobile): các UC nào còn nằm trong phạm vi nộp đồ án? Có làm sau Mốc 4 không?
11. **Trang admin "duyệt mọi màn hình" trong `screens.spec.ts:116`:** sau Mốc 4 gom vào nhóm nào trong `test:e2e:real`?
12. **Upload mô hình 3D từ FE** (chỉ metadata): cho phép sửa FE để gửi tệp thật qua `/admin/models/upload` không?
13. **Hai nhánh remote** `Huyen-Trang`, `feature/yen/user-page-ui`: có cần gộp/đối chiếu với `feature/backend` không?
14. **Dump trong git:** `docs/aurelia_dev_backup.sql` được theo dõi trong git — có chủ đích đẩy lên remote không?
