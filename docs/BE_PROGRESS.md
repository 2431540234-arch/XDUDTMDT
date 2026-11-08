# BE_PROGRESS – Tiến độ xây dựng Backend (Aurelia Living)

> Theo dõi `docs/PROMPT_AGENT_BE.md`. Nhánh: `feature/backend` (tách từ `main` @ `2505d25`). Cập nhật: 2026-11-06.

## Tổng quan

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Đọc tài liệu | ✅ |
| 2 | Quét database | ✅ |
| 3 | Quét backend hiện có | ✅ |
| 4 | Trích xuất API contract → `docs/API_CONTRACT.md` | ✅ |
| 5 | Thiết kế → `docs/BACKEND_DESIGN.md` | ✅ |
| 6 | ⛔ Điểm dừng – người dùng đã "Đồng ý" (2026-11-06) | ✅ |
| 7–9 | Nền tảng, migration/seed, module theo 4 mốc | 🟡 Mốc 1 ✅ · Mốc 2 ✅ · Mốc 3 ✅ · Mốc 4 chưa làm |
| 10–12 | Test, nối FE, bàn giao | 🟡 đang làm dần theo từng mốc |

## Giai đoạn 1 – Tài liệu đã đọc & quy tắc nghiệp vụ tìm được

Đã đọc: `PROMPT_AGENT_BE.md`, `API_CONVENTIONS.md`, `DECISIONS.md` (D-N01…N23, D-D01…06, D-T…), `FE_PROGRESS.md`, `PROJECT_ANALYSIS.md`, `database/README.md`, `apps/web/src/mock-data/README.md`, và (từ các phiên trước, tôi là tác giả) `WIREFRAME.md`, `PROMPT_AGENT_FE.md`, `PROMPT_360_SAN_PHAM.md`.
Quy tắc đã chốt trong tài liệu dự án (đối chiếu chi tiết ở `BACKEND_DESIGN.md` mục 9):
- 2 vai trò `admin`/`user`; slug cho API công khai, id cho API đã đăng nhập/admin (D-N12).
- Tiền số nguyên VNĐ, ngày UTC ISO, camelCase; response envelope `{success,data,meta}`; lỗi `{success:false,error:{code,message,details}}`.
- Hủy đơn hoàn tồn + lượt dùng coupon (D-N01); COD `pending` đến khi giao (D-N02); thanh toán online thành công ⇒ `pending→confirmed` (D-N13); vận đơn `delivered` ⇒ `completed` (D-N14); hoàn tiền thủ công (D-N03, D-N15).
- Đánh giá chỉ từ đơn `completed` của chính user, mới ở `pending` (D-N06). Áp mã chỉ xem trước, kiểm tra lại khi đặt hàng (D-N16). Tìm kiếm không dấu (D-N18). Thông báo do Service tạo (D-N19). Mã đơn `ALV-YYYYMMDD-NNNN` (D-N19).
- Thanh toán: COD, chuyển khoản (thủ công), VNPay sandbox (D-N17, D-N20, D-N23).
- Xử lý nền BullMQ (D-N08), mô hình 3D `uploading→processing→ready|failed` (D-N07).

## Giai đoạn 2 – Database (đọc, không ghi)

Lệnh đã chạy (chỉ đọc): `prisma migrate status` ⇒ *"Database schema is up to date!"* (2 migration); `docker exec xdudtmdt-postgres-1 psql … pg_stat_user_tables` (đếm dòng).
- PostgreSQL 16 (container `xdudtmdt-postgres-1`, host `localhost:55432`), DB `aurelia_dev`, schema `public`. Extension đã có: `citext`, `pg_trgm`, `unaccent`, `pgcrypto`.
- **41 bảng, 19 enum.** ⚠ Đính chính: kiểm tra ban đầu dựa vào `pg_stat_user_tables` (thống kê cũ) nên báo nhầm 0 dòng; thực tế `aurelia_dev` có sẵn bộ dữ liệu mẫu cũ (4 người dùng, 4 danh mục, 2 sản phẩm, 1 đơn… ghi ngày 2026-10-06). Xem mục *Mốc 1 – sự cố dữ liệu* bên dưới.
- Bảng đã có (theo nhóm): người dùng (`users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_sessions`, `password_resets`, `addresses`), danh mục/sản phẩm (`categories`, `brands`, `attributes`, `attribute_values`, `products`, `product_variants`, `variant_attribute_values`, `product_images`, `media`), 3D/AR (`product_3d_models`, `model_files`, `model_material_variants`, `ar_sessions`, `ar_snapshots`), không gian (`spaces`, `space_panoramas`, `space_hotspots`, `space_product_placements`, `space_bookmarks`, `space_views`), mua hàng (`carts`, `cart_items`, `wishlists`, `coupons`, `coupon_usages`, `orders`, `order_items`, `order_status_history`, `payments`, `shipments`, `inventory_movements`), khác (`reviews`, `notifications`, `activity_logs`, `pages`, `settings`).
- Enum: `OrderStatus(pending,confirmed,processing,shipping,completed,cancelled,refunded)`, `PaymentMethod(cod,bank_transfer,momo,vnpay,zalopay,card)`, `OrderPaymentStatus`, `PaymentTxnStatus`, `CouponType(percent,fixed)`, `ReviewStatus(pending,approved,rejected)`, `ContentStatus`, `RoomType`, `HotspotType`, `UserStatus(active,suspended,banned)`, `ModelFileFormat/Lod/Placement/Status`, `InventoryMovementType(import,sale,return,adjustment)`, `ShipmentCarrier/Status`, `ArMode`.
- ERD chi tiết theo cột nằm ở `docs/DATABASE_SCHEMA.md` / `CAU_TRUC_DB.md`; ERD các bảng bổ sung ở `BACKEND_DESIGN.md` mục 3.2.

## Giai đoạn 3 – Backend hiện có (`apps/api`)

- NestJS 10.3, Prisma 5.14, Jest 29 (+ supertest), TypeScript 5.7. Cổng 4000, prefix `/api`, Swagger `/docs`, `GET /health` (ngoài prefix).
- **Đã hoạt động**: cấu hình env có validate, helmet/CORS, `ValidationPipe`, `TransformResponseInterceptor`, `AllExceptionsFilter` (+ spec), `JwtAuthGuard`/`RolesGuard`/`ThrottlerGuard` toàn cục, `@AuthThrottle()`, `serialize()`, `AppException`, `PrismaService`, `StorageService` (local/MinIO/S3 + spec), mail (SMTP + BullMQ), cache Redis (+ spec), `ActivityLogService`, `media` (presign/confirm), `health`.
- **Khung rỗng** (controller/service chỉ có tiêu đề): `auth`, `users`, `addresses`, `products`, `categories`, `brands`, `attributes`, `variants`, `cart`, `wishlist`, `orders`, `payments`, `shipments`, `coupons`, `reviews`, `notifications`, `spaces`, `panoramas`, `hotspots`, `product-models`, `product-images`, `inventory`, `pages`, `settings`, `admin-*`, `activity-logs`, `ai`, `ar-*`, `jobs`. ⇒ **139/139 endpoint của contract chưa có logic** (chỉ `/health`, `/admin/media*`, `/admin/models/:id/files/*` có route).
- `packages/shared-types`: `ApiResult`, `PaginatedMeta`, `ErrorCode` + `ERROR_HTTP_STATUS`, `AuthTokens/AuthUser/RoleCode`, entity/enum sinh từ Prisma (`npm run … generate`). Các `*View` đang ở `apps/web/src/types/api.ts` (đề xuất chuyển sang gói chung).
- Test hiện có: unit (filter, cache, env, storage), e2e (`health`, `infra`, `storage-jobs`) trên `TEST_DATABASE_URL` (Postgres test cổng 5433, profile `test`).
- CI `.github/workflows/ci.yml`: `npm ci` → `prisma generate` → `types:check` → `build:types` → `format:check` → `lint` → `typecheck` → test web → test api → Playwright → `build`. Husky: `pre-commit` = `lint-staged`, `commit-msg` = commitlint (header ≤ 100 ký tự).
- Infra: `docker-compose.yml` (postgres:16, redis, minio, mailpit, api; profile `test`: postgres-test).

## Giai đoạn 4 – API contract
`docs/API_CONTRACT.md`: 139 endpoint (68 công khai/khách + 71 admin), quy ước envelope/xác thực/lỗi, hình dạng response không phải entity, quy tắc nghiệp vụ FE dựa vào, kiểu response (Phụ lục A, trích từ `types/api.ts`). Sinh bằng script từ `mockApi/index.ts` + `services/*.api.ts`.

## Giai đoạn 5 – Thiết kế
`docs/BACKEND_DESIGN.md`: kiến trúc, gap analysis, 9 migration bổ sung (additive), quy tắc nghiệp vụ, bảo mật, upload, seed, kế hoạch (≈ 17 ngày công) và 11 mâu thuẫn cần xác nhận.

## Thư viện mới
Chưa thêm (Giai đoạn 1–5 chỉ đọc/viết tài liệu). Dự kiến: không cần thêm gói; xuất Excel dùng CSV thuần (nếu cần `.xlsx` sẽ xin phép thêm `exceljs`).

## Việc còn tồn đọng / lỗi
- Chưa có. Đang chờ "Đồng ý" ở Giai đoạn 6.


---

## Mốc 1 – Khách hàng mua được hàng (2026-11-06) ✅

### Đã làm
| Hạng mục | Chi tiết |
|---|---|
| Nền tảng | `OTP_FIXED_CODE` (production + biến này ⇒ app **không khởi động**), request-id, giới hạn body 25MB (FE gửi ảnh data-URL), Swagger `/api/docs`, `JwtAuthGuard` nhận token tùy chọn ở route công khai, bộ sinh mã (`code_counters`, `ALV-YYYYMMDD-NNNN`, `RT`, `PN/PX`, `CH`), tìm kiếm không dấu, `validate.ts` (thông báo lỗi tiếng Việt đúng từng trường như FE), `MediaIngestService` (data-URL → kiểm tra chữ ký tệp/dung lượng → kho) |
| Migration (4, chỉ thêm) | `add_backend_extras`, `coupon_freeship_value` (nới CHECK cho freeship), `add_360_default_color`, `add_coupon_applies_label`; thêm `CHECK`, index tìm không dấu `immutable_unaccent(lower(name))` |
| Seed từ mock | `npm run db:seed -w @aurelia-living/api` đọc `apps/web/src/mock-data` (giữ id), copy 1.575 tệp (ảnh SVG sinh động, GLB, 1.080 frame 360°) vào kho, bcrypt mật khẩu, idempotent; **từ chối chạy** nếu DB có dữ liệu ngoài mock (xem sự cố dưới) |
| Module | Auth (login/register/refresh/logout/forgot/reset/google-stub), Users (`/users/me`, đổi mật khẩu, avatar), Addresses, Categories/Brands, Products (list/search/facets/detail/model/**360**/related), Wishlist, Reviews (+Q&A), Cart (+coupon), Coupons của tôi, Orders (đặt hàng COD, danh sách/chi tiết/counts/hủy), Payments (COD + giả lập online), Returns (khách), Notifications, Spaces (công khai + lưu), Content (banners, posts, pages, faq, contact, settings công khai) |
| Quy tắc | Tính tiền ở server (giá hiện tại, ship theo vùng, coupon percent/fixed/freeship + phạm vi); **giữ chỗ tồn kho** `reserved_quantity` khi tạo đơn (khóa dòng `FOR UPDATE` theo thứ tự id), hủy ⇒ trả giữ chỗ + lượt coupon; khách hủy ở `pending|confirmed`; đơn của người khác ⇒ 404; OTP 6 số, 5 phút, 5 lần, gửi lại 60s |

### Kết quả kiểm thử với API thật (Playwright, `E2E_USE_MOCK=false E2E_API_URL=http://localhost:4001`)
| Bộ test | Kết quả |
|---|---|
| `home.spec.ts` (2) | ✅ 2/2 |
| `screens.spec.ts` – storefront công khai (17 trang), 404 | ✅ |
| `screens.spec.ts` – khách: đăng nhập → giỏ → mã giảm giá → đặt hàng → chi tiết đơn → đánh giá → đổi trả…; phân quyền | ✅ 2/2 |
| `product360.spec.ts` (8, gồm tổ hợp hết hàng, thêm giỏ/mua ngay) | ✅ 8/8 |
| `screens.spec.ts` – admin (duyệt mọi màn hình quản trị) | ⏳ chờ Mốc 2–4 |
Unit test sẵn có: 29/29 ✅. `tsc`, `eslint` sạch.

### Quyết định / giả định
- **Đánh giá**: theo yêu cầu, đánh giá mới ở `approved` (hiển thị ngay), sửa đánh giá **không** chuyển về chờ duyệt, admin chỉ ẩn/hiện. ⚠ **Mock/FE đang có trạng thái "Chờ duyệt"** (mock tạo/sửa đánh giá ⇒ `pending` và danh sách công khai chỉ hiện `approved`; trang admin có nhãn/tab "Chờ duyệt"; dữ liệu seed có đánh giá `pending`). Tôi giữ nguyên dữ liệu seed và UI, chỉ đổi hành vi BE – cần bạn xác nhận có muốn bỏ hẳn nhãn "Chờ duyệt" ở admin không (sửa FE).
- Phân trang vượt trang cuối ⇒ kẹp về trang cuối (giống mock).
- `stockQuantity` trong API = tồn **có thể bán** (tồn vật lý − đang giữ), khớp ngữ nghĩa mock.
- Danh sách sản phẩm lọc/sắp xếp trong bộ nhớ trên chỉ mục cache 15 giây (quy mô đồ án); ghi vào `ProductsService.invalidate()` khi admin sửa.
- Chạy e2e với API thật cần **DB sạch** (đơn đặt trong test làm thay đổi tồn/giỏ): `bash scripts` tương đương — tạo lại `aurelia_demo` rồi seed (xem dưới).

### ⚠ Sự cố dữ liệu cần bạn biết
1. Kiểm tra ban đầu (`pg_stat_user_tables`) báo nhầm 0 dòng. Thực tế **`aurelia_dev` có sẵn bộ dữ liệu mẫu cũ** (ngày 2026-10-06: 4 người dùng, 4 danh mục, 1 thương hiệu, 2 sản phẩm, 1 đơn, 10 media, 1 không gian, 1 mã giảm giá…). Seed mock giữ id của mock nên **va chạm id** với dữ liệu cũ.
2. Trước khi phát hiện, tôi đã chạy seed vào `aurelia_dev` (dùng `ON CONFLICT DO NOTHING`) ⇒ `aurelia_dev` hiện là **bản trộn** dữ liệu cũ + dòng mock (tài khoản `khachhang@aurelia.vn`/`admin@aurelia.vn` mock **không** đăng nhập được ở DB này vì id 1–2 thuộc dữ liệu cũ). Tôi cũng đã `DELETE` một số dòng do chính tôi chèn sai (`variant_attribute_values`, `product_360_frames`, và các `attribute_values` mock bị lệch id) để sửa ánh xạ thuộc tính. **Không xóa dòng dữ liệu cũ nào.**
3. Cách xử lý: seed mock nay **dừng và báo lỗi** nếu DB có dữ liệu ngoài mock; tôi dùng DB riêng **`aurelia_demo`** (cùng container, migration `deploy` + seed mock sạch) cho demo/e2e. Bạn chọn: (a) dùng `aurelia_demo` cho phát triển tiếp (khuyến nghị), (b) khôi phục `aurelia_dev` từ bản sao lưu của bạn, hoặc (c) bảo tôi dọn các dòng mock trong `aurelia_dev`.
4. `aurelia_dev` còn thiếu 1 migration mới (`add_coupon_applies_label`) – chưa áp dụng vì tôi chưa muốn chạm thêm vào DB đó.

### Cách chạy (dev)
```bash
# DB demo sạch + seed mock
docker exec xdudtmdt-postgres-1 psql -U aurelia -d postgres -c "CREATE DATABASE aurelia_demo"
DATABASE_URL="postgresql://aurelia:aurelia@localhost:55432/aurelia_demo?schema=public" npm run db:deploy -w @aurelia-living/api
DATABASE_URL=... STORAGE_DRIVER=local STORAGE_PUBLIC_URL=http://localhost:4001/uploads npm run db:seed -w @aurelia-living/api
# API (cổng 4000 sau khi dừng container api cũ – xem Mốc 2)
DATABASE_URL=... PORT=4001 STORAGE_DRIVER=local STORAGE_PUBLIC_URL=http://localhost:4001/uploads OTP_FIXED_CODE=123456 JWT_ACCESS_EXPIRES_IN=12h CORS_ORIGINS=http://localhost:3000,http://localhost:3100 npm run start:dev -w @aurelia-living/api
# FE với API thật
NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=http://localhost:4001 npm run dev -w @aurelia-living/web
```
Tài khoản: `admin@aurelia.vn / admin123`, `khachhang@aurelia.vn / 123456`.


---

## Mốc 2 – Admin vận hành (2026-11-06) ✅

### 1. Xử lý dữ liệu theo quyết định của bạn
| Việc | Kết quả |
|---|---|
| Dump `aurelia_dev` (trạng thái trộn) | `aurelia_dev_mixed_20261106.dump` (464.639 byte) ở thư mục gốc repo – **không commit** (`*.dump` đã nằm trong `.gitignore`) |
| Khôi phục `aurelia_dev` từ `aurelia_dev_before_be.dump` | `pg_restore` thành công. **Lệch so với yêu cầu:** thay vì `pg_restore --clean --if-exists` vào chính DB, tôi `DROP DATABASE … WITH (FORCE)` + `CREATE DATABASE` rồi `pg_restore` (không `--clean`), vì các bảng/khóa ngoại do migration mới thêm sẽ chặn lệnh `DROP TABLE` của `--clean`. Kết quả tương đương: DB về đúng trạng thái trong bản sao lưu. Lần đầu lệnh restore lỗi vì Git Bash đổi đường dẫn `/tmp/…` (DB tạm trống vài giây), tôi đã restore lại bằng `sh -c`. |
| Số dòng thật (SELECT count(*)) sau restore | users **3**, categories **4**, products **2**, product_variants 4, orders **1**, brands 1, media 10, coupons 1, spaces 1, attributes 2, attribute_values 4, reviews 1, notifications 1, addresses 2. ⚠ Con số "4 users" tôi báo trước đó **sai**: thực tế bản gốc có **3 users** (số 4 gồm một dòng mock tôi chèn nhầm cùng ngày). Danh mục/sản phẩm/đơn khớp (4/2/1). |
| Áp migration lên `aurelia_dev` | `prisma migrate deploy`: 4 migration mới (`add_backend_extras`, `coupon_freeship_value`, `add_360_default_color`, `add_coupon_applies_label`), **không seed mock**. Số dòng sau migrate không đổi (3 users, 4 categories, 2 products, 1 order). |
| `aurelia_demo` | DB chính để phát triển/demo (API chạy trên đây). |
| `aurelia_test` | Chỉ cho e2e/Playwright. |
| Script reset | `node scripts/db-reset.mjs aurelia_demo\|aurelia_test` – **chỉ chấp nhận hai tên này** (thử `aurelia_dev` ⇒ "Từ chối"); in tên DB + `SELECT count(*)` trước/sau. Script npm `db:reset` (cũ: `prisma migrate reset --force`) đã bị vô hiệu hóa. |

### 2. Cổng API = **4000**
Container `xdudtmdt-api-1` (image `xdudtmdt-api`, build từ `infra/docker/Dockerfile.api`, `docker-compose.yml` service `api`, bản khung cũ chạy trên `aurelia_dev`) đang chiếm 4000 ⇒ đã `docker stop` (không xóa). API mới chạy ở **4000** trên `aurelia_demo`; API phục vụ Playwright/e2e chạy riêng ở 4002 trên `aurelia_test`. `.env.example`/FE đã dùng 4000 sẵn nên **không phải đổi**; muốn bật lại container cũ: `docker start xdudtmdt-api-1` (sẽ tranh cổng 4000).

### 3. Bài học (ghi nhớ bắt buộc)
> **Không bao giờ dựa vào `pg_stat_user_tables` (`n_live_tup`) để kết luận bảng trống** – thống kê có thể cũ/sai (đã báo nhầm "0 dòng" ở Giai đoạn 2 trong khi DB có dữ liệu mẫu cũ).
> Trước **mọi** thao tác ghi/seed/reset: in tên DB đang kết nối (`select current_database()`) và đếm dòng bằng `SELECT count(*)`. `scripts/db-reset.mjs` và seed mock đã làm sẵn việc này; e2e DB (`test/mock-m2.db-spec.ts`) tự dừng nếu không phải `aurelia_test`.

### 4. Quyết định thay đổi: đánh giá **có kiểm duyệt** (theo FE/mock)
- Đánh giá mới và đánh giá vừa sửa ⇒ `pending`. Danh sách công khai, điểm trung bình và số lượt chỉ tính `approved` (trigger `refresh_product_rating`).
- Khách luôn thấy đánh giá của mình ở `GET /reviews/me` kèm trạng thái.
- Duyệt/ẩn/hiện + thông báo cho khách khi duyệt: **Mốc 3** (`/admin/reviews`). Enum DB `review_status` = `pending|approved|rejected`; FE gọi `rejected` là "Ẩn" (không đổi enum để khỏi sửa schema). `BACKEND_DESIGN.md` mục 4.6 + 9 và `API_CONTRACT.md` đã cập nhật.

### 5. Endpoint Mốc 2 và trạng thái kiểm thử
Ký hiệu: **U** = unit (`npm test`), **E** = e2e supertest trên `aurelia_test` (`npm run test:e2e:db`, 47 test), **P** = Playwright với API thật (`tests/e2e/admin-m2.spec.ts`).
| Module | Endpoint | Test |
|---|---|---|
| Dashboard | `GET /admin/stats/overview` (KPI, % kỳ trước, doanh thu theo ngày/tháng, tỉ lệ trạng thái, đơn gần đây, bán chạy, hoạt động) · `GET /admin/notifications` · `GET /admin/search` | E · P |
| Sản phẩm | `GET /admin/products` (q không dấu, category, status, sort, trang) · `GET\|PATCH\|DELETE /admin/products/:id` · `POST /admin/products` (6 tab: cơ bản, ảnh nhiều + ảnh đại diện, biến thể màu×size có SKU unique/giá/giá gốc/giá vốn/tồn/tồn tối thiểu/kích thước, thông số, SEO) · `GET\|PUT /admin/products/:id/360` (frame ≤ 2MB, giữ thứ tự, bật cần ≥ 2 ảnh) | E · P (tab 360°) |
| Danh mục | `GET\|POST /admin/categories` · `PATCH\|DELETE /admin/categories/:id` (cây 2 cấp, slug unique tự sinh, chặn xóa còn sản phẩm/danh mục con ⇒ 409 `RESOURCE_IN_USE`) | E · P |
| Đơn hàng | `GET /admin/orders` (tab trạng thái, lọc ngày/thanh toán, tìm không dấu) · `GET /admin/orders/counts` · `GET /admin/orders/:code` · `GET /admin/orders/:code/invoice` · `POST /admin/orders` · `PATCH /admin/orders/:id/status` · `POST /admin/orders/:id/cancel` · `POST /admin/orders/:id/refund` · `PATCH /admin/orders/:id/shipment` · `PATCH /admin/orders/:id/note` · `PATCH /admin/payments/:id/confirm` | U (máy trạng thái, phí ship) · E (giữ/trừ/trả tồn, 409, đồng thời) · P |
| Khách hàng | `GET\|POST /admin/users` · `GET\|PATCH /admin/users/:id` · `PATCH /admin/users/:id/status` · `GET /admin/users/:id/orders\|reviews\|wishlist` | E · P |
| Khuyến mãi | `GET\|POST /admin/coupons` (tab, kind, q; `meta` có số lượng từng tab) · `GET\|PATCH\|DELETE /admin/coupons/:id` | U (đủ điều kiện coupon, trạng thái theo thời gian) · E · P (trang) |
Mọi route `/admin/*` có `@Roles('admin')` (khách ⇒ 403, không token ⇒ 401), mọi thao tác ghi đều ghi `activity_logs`.

### 6. Quy tắc đã cài (kiểm chứng bằng test)
- **Máy trạng thái**: `pending→confirmed→processing→shipping→completed`; hủy ở `pending|confirmed|processing` (khách chỉ `pending|confirmed`); sai thứ tự ⇒ 409 `INVALID_STATE`. *(FE/DB dùng `completed` cho "Đã giao" – bạn viết `delivered`.)*
- **Tồn kho**: tạo đơn ⇒ `reserved += qty` (khóa dòng `FOR UPDATE` theo id); sang `shipping` ⇒ `stock −= qty`, `reserved −= qty`, movement `sale`; hủy ⇒ trả giữ chỗ. Hai khách giành sản phẩm cuối ⇒ đúng 1 đơn thành công; 6 đơn đồng thời ⇒ mã đơn không trùng.
- COD sang `completed` ⇒ tự `paid`; xác nhận thanh toán (chuyển khoản) ⇒ `paid` và `pending→confirmed`; mỗi lần đổi trạng thái có lịch sử (trigger DB, kèm người thực hiện + ghi chú) và **thông báo cho khách**.
- Hoàn tiền: đơn đã giao/đã hủy đã thanh toán ⇒ `refunded` + phiếu chi `refund`.
- Khóa tài khoản: thu hồi mọi refresh token; `JwtAuthGuard` kiểm tra trạng thái mỗi request nên **token còn hạn cũng bị chặn ngay** (403 `AUTH_ACCOUNT_LOCKED`, "Tài khoản của bạn đang bị khóa."); đăng nhập bị chặn với thông báo tiếng Việt.
- Xóa sản phẩm: đã có trong đơn ⇒ chuyển `archived` (ngừng bán); chưa có ⇒ xóa mềm.
- Tồn kho admin nhập/đọc là **"có thể bán"** (tồn vật lý = nhập + đang giữ chỗ).
- Khuyến mãi: mã unique không phân biệt hoa thường, phạm vi tất cả/danh mục/sản phẩm/không gian, trạng thái tính theo thời gian, không giảm `usageLimit` dưới số lượt đã dùng, mã đã dùng chỉ bị ngừng kích hoạt khi xóa.

### 7. Kết quả kiểm thử
| Loại | Kết quả |
|---|---|
| Unit (`npm test -w @aurelia-living/api`) | 29 cũ + 29 mới (coupon mọi điều kiện, `calcDiscount`, trạng thái khuyến mãi theo thời gian, máy trạng thái đơn, phí ship) |
| E2E supertest `aurelia_test` (`test/mock-m2.db-spec.ts`) | **47/47** ✅ (phân quyền 403/401/404, tồn kho giữ/trừ/trả, 409, đồng thời, dashboard, sản phẩm + 360°, danh mục, khuyến mãi, khách hàng + khóa, đơn admin, đánh giá có kiểm duyệt) |
| Playwright + API thật (`aurelia_test`) | admin Mốc 2: **3/3** ✅ · khách hàng + trang chủ + 360°: **14/14** ✅ (home 2, storefront, 404, luồng khách, phân quyền, 360° ×8) – *Ở báo cáo Mốc 1 tôi ghi "15 test", số đúng là 14.* |
| `tsc` API + web, `eslint` (0 lỗi), `nest build`, `next build` | ✅ |
Lưu ý khi chạy với API thật: dữ liệu thay đổi giữa các test nên **chạy từng file với DB vừa reset** (`node scripts/db-reset.mjs aurelia_test`), theo thứ tự `home+screens` rồi `product360` rồi `admin-m2`.

### 8. Thay đổi ở lớp cấu hình FE (có lý do)
- `apps/web/src/services/api-client.ts`: chờ nạp phiên đăng nhập (`hydrated`) trước khi gửi request. Khi tải lại trang admin, truy vấn chuông thông báo chạy trước bước nạp token ⇒ API thật trả 401 (mock không lộ). Không đổi giao diện.
- `playwright.config.ts` (`E2E_USE_MOCK`, `E2E_API_URL`, `E2E_DIST_DIR`, `E2E_PORT`), `next.config.js` (`NEXT_DIST_DIR`), `tests/e2e/admin-m2.spec.ts` mới.

### 9. Còn lệch với FE / việc tồn đọng
1. Nhãn "Chờ duyệt" của đánh giá giữ nguyên (đúng quyết định mới); admin duyệt/ẩn ở Mốc 3.
2. `POST /admin/settings/reset-mock` chỉ có ở mock; BE chưa cài (trả 404). FE trang Cài đặt có nút này – cần ẩn khi `USE_MOCK=false` (sửa FE, chờ bạn).
3. `GET /admin/orders/:code/invoice` là endpoint thêm (FE hiện in từ chi tiết đơn).
4. Tạo khách hàng từ admin: mock đặt mật khẩu `12345678`; BE sinh mật khẩu tạm ngẫu nhiên và gửi email (dev: in log + Mailpit).
5. Cổng thanh toán online vẫn là giả lập; VNPAY sandbox thật ở Mốc 4.
6. Chưa làm: Mốc 3 (đánh giá, hỏi đáp, đổi trả phía admin, thông báo admin, nội dung, không gian mẫu admin, mô hình 3D), Mốc 4 (kho, thu chi + báo cáo, cài đặt, VNPAY). Các trang admin tương ứng sẽ lỗi 404 với API thật cho đến khi làm xong.


---

## Mốc 3 – Tương tác khách hàng & nội dung (2026-11-06) ✅

### 0. Hạ tầng làm trước
| Việc | Cách xử lý |
|---|---|
| `docker-compose` service `api` cũ | **Cách (b)**: đưa vào `profiles: ['legacy']` ⇒ `docker compose up` không tự chạy và không tranh cổng 4000 nữa (`docker compose config --services` mặc định chỉ còn `mailpit minio minio-init postgres redis`). Muốn chạy bản cũ: `docker compose --profile legacy up api`. Không xóa container/volume. API mới chạy bằng `npm run start:dev -w @aurelia-living/api` (cổng 4000, `DATABASE_URL` trỏ `aurelia_demo`). |
| Tiến trình API test còn chạy | Đã kiểm tra cổng 4000/4001/4002/3100: chỉ có API demo ở 4000. Runner `test:e2e:real` tự dọn 4002/3100 trước và sau khi chạy. |
| Playwright với API thật – **một lệnh** | `npm run test:e2e:real` (script `scripts/e2e-real.mjs`): dừng tiến trình sót → build API → reset `aurelia_test` → khởi động API test (cổng 4002, DB `aurelia_test`) → với từng nhóm `khach-hang`, `xem-360`, `admin-m2`, `admin-m3` **reset lại aurelia_test rồi chạy Playwright** (web dev dùng `.next-e2e` riêng) → luôn dọn tiến trình. Chạy một nhóm: `E2E_ONLY=admin-m3 npm run test:e2e:real`. Chỉ đụng `aurelia_test`. |
| E2E DB (supertest) | `node scripts/db-reset.mjs aurelia_test && npm run test:e2e:db` (tự dừng nếu không phải `aurelia_test`). |
| Thông báo email dev | Email (OTP, mật khẩu tạm khi admin tạo khách) xem tại **Mailpit http://localhost:8025** (SMTP 1025); `MAIL_TRANSPORT=direct` gửi ngay, `queue` đi qua BullMQ. Mật khẩu tạm còn được in ra log API ở môi trường dev. |
| `aurelia_dev` | Chỉ `migrate deploy` migration `add_contact_handled`: số dòng không đổi (users 3, categories 4, products 2, orders 1), `_prisma_migrations` 6 → 7. |

### 1. Điểm lệch Mốc 2 đã chốt
`completed` = "Đã giao"; Ẩn đánh giá = `rejected`, hiện lại = `approved`; nút "Khôi phục dữ liệu mẫu": **FE đã tự ẩn khi `NEXT_PUBLIC_USE_MOCK=false`** (tab "Dữ liệu giả lập" chỉ nằm trong menu khi `USE_MOCK=true`, xem `app/admin/settings/page.tsx` dòng `menu`) nên không cần sửa FE; mật khẩu tạm ngẫu nhiên + email giữ nguyên; `GET /admin/orders/:code/invoice` giữ nguyên. *(Mục "cần ẩn nút" ở báo cáo Mốc 2 là mình ghi chưa kiểm tra kỹ.)*

### 2. Endpoint Mốc 3 và trạng thái kiểm thử
**U** = unit, **E** = e2e supertest (`mock-m3.db-spec.ts`), **P** = Playwright với API thật.
| Module | Endpoint | Test |
|---|---|---|
| Đánh giá (admin) | `GET /admin/reviews` (tab Tất cả/Chờ duyệt/Đã duyệt/Ẩn = `status`, `productId`, `q`, `sort`) · `PATCH /admin/reviews/:id/status` (duyệt/ẩn/hiện lại; duyệt ⇒ thông báo; điểm trung bình do trigger DB, chỉ `approved`) | U (điều kiện, trung bình) · E · P (trang) |
| Đánh giá (khách) | `POST /products/:slug/reviews` (chỉ đơn `completed` của mình, 1/sản phẩm/đơn, ≤ 5 ảnh ≤ 5MB, mới = `pending`) · `PATCH /reviews/:id` (sửa ⇒ `pending`) · `DELETE /reviews/:id` · `GET /reviews/me` | U · E |
| Hỏi đáp | `POST /products/:slug/questions` (đăng nhập; ≤ 5 câu/giờ, trùng nội dung 24h ⇒ 409) · `GET /products/:slug/questions` (chỉ đã trả lời + công khai) · `GET /admin/questions` (tab) · `PATCH /admin/questions/:id` (trả lời/sửa `{answer,isPublic}`, ẩn `{status:hidden}`, hiện `{status:visible}`; thông báo khi trả lời) | E · P (trang) |
| Đổi trả | Khách: `POST /returns` (≤ 7 ngày kể từ lúc giao, số lượng ≤ đã mua − đã yêu cầu, ảnh bắt buộc, mã `RTnnnn`), `GET /returns` · Admin: `GET /admin/returns`, `PATCH /admin/returns/:id` (pending→picking→inspecting→refunded\|exchanged \| rejected; nhận hàng về ⇒ cộng tồn đúng biến thể + movement `return`; hoàn tiền ⇒ phiếu chi `refund`, đủ tiền hàng ⇒ đơn/thanh toán `refunded`; mỗi bước: thông báo + activity log; sai thứ tự 409) | U (7 ngày, số lượng, máy trạng thái) · E · P |
| Thông báo | Khách: `GET /notifications` (tab `type=order\|promo\|system`), `/unread-count`, `PATCH /:id/read`, `/read-all` · Admin: `GET /admin/notifications` · **`NotificationsService` dùng chung** (Global) cho orders, payments, admin-orders, đổi trả, đánh giá, hỏi đáp | E |
| Banner | `GET\|POST /admin/banners`, `PATCH\|DELETE /admin/banners/:id`, **`PATCH /admin/banners/reorder`** `{ids}` (lưu thứ tự kéo thả) · công khai `GET /banners` chỉ trả banner bật + trong thời gian | E · P |
| Bài viết | `GET\|POST /admin/posts`, `PATCH\|DELETE /admin/posts/:id` (slug unique, HTML lọc XSS bằng `sanitize-html`, nháp/xuất bản) · công khai `GET /posts`, **`GET /posts/:slug`** (+ lượt xem) | U (XSS) · E |
| Trang tĩnh & FAQ | `GET\|POST /admin/pages`, `PATCH\|DELETE /admin/pages/:id` (không xóa 7 trang hệ thống) · `GET /admin/faq`, `POST\|PATCH\|DELETE /admin/faq/topics`, `/admin/faq/items` · công khai `GET /pages`, `/pages/:slug`, `/faq` | E |
| Liên hệ | `POST /contact` (giới hạn 5 lần/phút/IP) · `GET /admin/contact-messages` (`handled`) · `PATCH /admin/contact-messages/:id/handled` | E |
| Không gian mẫu | Admin 5 tab: `GET\|POST /admin/spaces`, `GET\|PATCH\|DELETE /admin/spaces/:id` (ảnh 360° upload + thứ tự, hotspot yaw/pitch → sản phẩm có kiểm tra tồn tại/biến thể, sản phẩm gợi ý, trạng thái, `comboDiscountPercent`) · công khai `GET /spaces` (lọc), `/spaces/:slug` (giá combo tính ở server) · **`POST /spaces/:slug/add-to-cart`** (thêm các biến thể còn hàng, trả `{added, unavailable[{productId,name,reason}], cart}`) | U (giá combo) · E · P (trang) |
| Mô hình 3D | `GET /admin/models` (lọc `productId`, `format`) · `POST /admin/models` (JSON, `fileData` data-URL tùy chọn) · **`POST /admin/models/upload` (multipart, tệp thật)** · `DELETE /admin/models/:id` · công khai `GET /products/:slug/model` (+ chi tiết sản phẩm, trang 360° dùng chung) | U (kiểm tra tệp) · E · P (trang) |
Mọi route `/admin/*` có `@Roles('admin')` (khách ⇒ 403, không token ⇒ 401) và ghi `activity_logs`.

### 3. Kiểm thử Mốc 3
| Loại | Số lượng / kết quả |
|---|---|
| Unit (`npm test -w @aurelia-living/api`) | **87** test, 10 suite ✅ (mới: đánh giá, đổi trả, combo, kiểm tra tệp upload, lọc XSS) |
| E2E supertest `aurelia_test` (`npm run test:e2e:db`) | **94** test ✅ (Mốc 2: 47 + Mốc 3: 47). Mốc 3 gồm: đặt hàng → completed → đánh giá → admin duyệt → điểm đổi; ẩn/hiện; đổi trả → hoàn tiền → tồn kho + phiếu chi đúng; đổi hàng không tạo phiếu chi; quá 7 ngày; không đụng dữ liệu người khác; 403 cho mọi `/admin/*`; banner/bài viết/XSS/trang/FAQ/liên hệ; không gian + thêm cả bộ vào giỏ (1 món hết hàng); upload mô hình (chữ ký, 50MB, MIME, path traversal) |
| Playwright + API thật (`npm run test:e2e:real`) | **20** test ✅: khách + trang chủ 6 · 360° 8 · admin Mốc 2 · 3 · admin Mốc 3 · 3 |
| `tsc` (API + web), `eslint` (0 lỗi), `nest build`, `next build` | ✅ |

### 4. Thay đổi kỹ thuật đáng chú ý
- **Migration mới** `add_contact_handled` (`contact_messages.handled_at`, `handled_by`).
- **Thư viện mới**: `sanitize-html@2.13.0` (lọc HTML rich text chống XSS; ghim bản dùng `htmlparser2` CommonJS để chạy được trên Node 20 của CI) + `@types/sanitize-html`.
- Đánh giá/đổi trả hiểu **"một đánh giá / sản phẩm / đơn"** và **"số lượng ≤ đã mua − đã yêu cầu"** ở cả service lẫn test; số lượng vượt ⇒ 400 với thông báo tiếng Việt (mock cũ chỉ kẹp số lượng).
- Hoàn tiền một phần (chưa hoàn đủ tiền hàng): đơn vẫn `completed`, chỉ tạo phiếu chi; hoàn đủ ⇒ đơn + thanh toán `refunded`.
- Lịch sử đổi trả = `activity_logs` (`return.update_status` kèm `from/to`), không thêm bảng.

### 5. Còn lệch với FE / việc tồn đọng
1. **Tải mô hình 3D**: FE hiện chỉ gửi metadata `{productId,fileName,sizeMB,format,allowAr,scale}` (không gửi nhị phân). BE xử lý bằng cách tạo bản sao tệp mẫu cùng định dạng (dữ liệu demo) khi không có `fileData`; đường tải tệp thật là `POST /admin/models/upload` (multipart) và `fileData` – **FE chưa gọi** (cần sửa FE nếu muốn tải thật).
2. `.gltf` được lưu chung nhóm định dạng `glb` (enum DB chỉ có `glb|usdz`).
3. **FAQ admin, liên hệ admin, đăng ký/sửa trang tĩnh (POST/DELETE), `GET /posts/:slug`, `PATCH /admin/banners/reorder`, `POST /spaces/:slug/add-to-cart`** là endpoint thêm theo yêu cầu – FE chưa có màn hình/gọi tương ứng (FE hiện "Thêm cả bộ" lặp từng `cartApi.addItem`; kéo thả banner chưa lưu thứ tự qua API).
4. Hotspot DB chỉ có `productId` (không có `variantId`): BE kiểm tra biến thể thuộc sản phẩm nhưng không lưu.
5. Chưa làm: **Mốc 4** (kho, thu chi + báo cáo, cài đặt, VNPAY sandbox). Các trang admin Kho/Thu chi/Cài đặt vẫn lỗi 404 với API thật.

---

## Đợt "Đưa code về chuẩn + hoàn thiện web" (2026-11-07) ✅

Chuẩn: `CAU_TRUC_DB.md`, `DATABASE_SCHEMA.md`, `QUY_UOC_CODE_DB.md`, `CONG_NGHE.md`, `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`. Phần giữ/làm thêm ngoài chuẩn: **`CHUAN_MO_RONG.md`** (thay cho việc cập nhật `DATABASE_SCHEMA.md` sau mỗi migration). Kế hoạch gốc: `DB_ALIGNMENT_PLAN.md`, `BAO_CAO_BUOC_2.md`, ghi chú nhận việc: `ONBOARDING_NOTES.md`.

| Bước | Commit | Nội dung |
|---|---|---|
| 1–3 | `28f73d5`, `4083b0b`, `66a1950` | 19 bảng mới dùng IDENTITY + trigger `updated_at` + `COMMENT ON`; FAQ gộp vào `settings`; bỏ `suppliers`; trừ `stock_quantity` ngay khi đặt, cộng lại khi hủy, bỏ `reserved_quantity` |
| 4 | `5d8b26f` | Bỏ OTP; đặt lại mật khẩu bằng liên kết token qua email (hết hạn 30 phút, một lần) |
| 5 | `1b79771` | Markdown nguyên văn + `react-markdown`, bỏ `sanitize-html`, FE tự refresh token, Swagger `/docs`, ghim phiên bản, TTL access production ≤ 15 phút |
| 6 | `a295c2a` | Xác thực email (đánh giá yêu cầu email đã xác thực), `sold_count` tăng khi đơn hoàn tất (migration tính lại), lượt xem không gian `POST /spaces/:slug/views` |
| 7 | `6dbcb97` | Thanh toán giả an toàn (khách không chọn kết quả; production cấm), hoàn tiền theo tiền thực trả (chia coupon, không hoàn phí ship), đổi hàng cộng/trừ tồn hai biến thể (+ migration `return_exchange_variant`) |
| 8 | `e954bc4` | Rà soát 360°: thêm test khách + admin với API thật; khung xem panorama báo lỗi thay vì sập trang; giới hạn frame 360° ở FE khớp 2 MB của máy chủ |

### Kết quả kiểm thử (sau bước 8)
Typecheck + lint sạch; Vitest web 23; Jest unit API 99; supertest DB thật 109; Playwright API thật: `khach-hang` 8, `xem-360` 23 (gồm `spaces360` 9 + `admin360` 6), `admin-m2` 3, `admin-m3` 3.
Migration: 15 (gồm `0_init`); mỗi migration đã `pg_dump` + diễn tập trên `aurelia_rehearsal` + đối chiếu `count(*)` (dữ liệu `aurelia_dev` không đổi, chỉ `_prisma_migrations` 7 → 15).

### Để sau (đã được chủ dự án hoãn)
- MinIO/presign upload; Redis cache (`CacheService`); xử lý nền mô hình 3D (LOD, đo đa giác) và giới hạn 100 MB.
- `PermissionsGuard`, `ActivityLogInterceptor` (nhật ký hiện ghi trực tiếp trong service).
- Mọi UC "Mốc 5": AR, đổi chất liệu 3D, placement, quản lý phiên, xóa tài khoản, thương hiệu, thuộc tính, media, vận đơn, gửi thông báo thủ công, màn nhật ký, thống kê AR.
- **Mốc 4** (chờ chủ dự án gọi): Kho (phiếu ⇒ `inventory_movements`, nhà cung cấp là cột chữ), Thu chi + báo cáo, Cài đặt, VNPAY (URL/chữ ký/IPN thử bằng khóa giả; giữ chế độ giả lập demo).
- Android (Mốc 6).

### Còn nợ
Xem `CHUAN_MO_RONG.md` Phần 3 (19 mục), nổi bật:
1. Lối vào trang `/products/[slug]/360` đã bị gỡ khỏi trang chi tiết (commit `2505d25`) — khách chỉ vào được bằng URL.
2. Giá combo của không gian chỉ hiển thị, giỏ hàng chưa áp.
3. Đổi tên không gian làm đổi slug (liên kết cũ 404).
4. Tải ảnh qua JSON base64 (body 25 MB): nhiều frame 360°/panorama lớn có thể vượt giới hạn.
5. `users.loyalty_points`, `carts.coupon_id`, chiều trạng thái vận đơn: chờ xác nhận giữ/bỏ.
6. Hai lần fail chập chờn chưa tái hiện (supertest "Hỏi đáp" 404; Playwright `khach-hang` lúc máy nặng).

---

## Phần A (hoàn thiện 360°) và Mốc 4 (Kho, Thu chi, Cài đặt, VNPAY) – 2026-11-07 ✅

### Phần A
| Mục | Kết quả |
|---|---|
| Lối vào 360° | Khôi phục nút "360°" ở thư viện ảnh (commit `821d9bc`), có test từ trang chi tiết bấm sang trang 360° |
| Giá combo | Không áp vào giỏ (đặc tả không có combo): FE chỉ hiển thị tổng giá thật; giữ cột DB, ghi "Để sau" |
| Slug không gian | Giữ slug khi đổi tên; đổi slug thủ công qua ô slug, kiểm tra trùng/hợp lệ (`4a4aa44`) |
| Ảnh lớn | Frame 360° và panorama tải từng tệp bằng multipart `POST /admin/media` (`kind`); test 36 frame × ~1,9 MB và 2 panorama × 20 MB |
| Mô hình 3D | Nâng giới hạn lên 100 MB (multipart `POST /admin/models/upload`), test đúng 100 MB và 100 MB + 1 byte |
| Giữ nguyên | `users.loyalty_points`, `carts.coupon_id`, chiều vận đơn (làm cùng UC-ADM-25 ở Mốc 5); đã ghi `CHUAN_MO_RONG.md` |
| Test chập chờn | Supertest 10 lần liên tiếp và nhóm `khach-hang` 10 lần liên tiếp đều xanh; chạy chồng hai bộ test trên một `aurelia_test` tái hiện đúng kiểu lỗi cũ ⇒ thêm khóa chặn chạy song song (`scripts/test-lock.cjs`); mỗi lần supertest tự dọn `.tmp-uploads-db` |

### Mốc 4
| Phần | Commit | Nội dung |
|---|---|---|
| Kho (UC-ADM-12, b′) | `6cc246d` | `GET /admin/inventory` (+summary, movements), `POST /admin/inventory/movements`, phiếu nhập/xuất `draft → completed/cancelled`; xác nhận phiếu ghi `inventory_movements` (mã phiếu là `reference_code`), phiếu nhập cập nhật giá vốn và sinh phiếu chi `cogs`; phiếu xuất thiếu hàng 409 và hoàn tác cả phiếu; đồng thời không làm tồn âm; nhà cung cấp là cột chữ; bỏ cột "Đang giữ" |
| Thu chi | `70ca063` | `GET /admin/stats/finance`, `/admin/expenses` (GET, POST, DELETE nhập tay). Doanh thu = đơn giao thành công theo ngày giao; hoàn tiền trừ qua phiếu chi `refund`; phí ship và phí cổng thanh toán KHÔNG tự sinh phiếu chi |
| Cài đặt (UC-ADM-03) | `4942841` | `GET /admin/settings`, `PUT /admin/settings/store`, `PUT /admin/settings/:key` (danh sách khóa cho phép, kiểm tra kiểu, nhật ký trước/sau); công khai vẫn `GET /settings/public` |
| VNPAY (UC-PAY-01/02/03) | `d741f9e` | URL thanh toán HMAC-SHA512, Return URL, IPN (`00/01/02/04/97/99`, không bọc), thanh toán lại (giao dịch cũ failed, tạo giao dịch mới). Kiểm bằng khóa giả; chưa có khóa thật thì giữ giả lập cho demo |
| Test + docs | `50dcffd` | Supertest `mock-m4` (31), Playwright nhóm `admin-m4` (4); nhóm `khach-hang` giờ duyệt cả mọi màn hình admin (không còn trang nào 404 với API thật) |

### Kết quả kiểm thử (sau Mốc 4)
Typecheck + lint sạch; Vitest web 25; Jest unit API 106; supertest 145 (3 file); Playwright API thật: `khach-hang` 9, `xem-360` 24, `admin-m2` 3, `admin-m3` 3, `admin-m4` 4. Không có migration ở Phần A và Mốc 4 (không đổi schema) nên không có đối chiếu `count(*)`; `aurelia_dev` giữ nguyên 3 users, 2 products, 1 order, 15 migration.

### Để sau (giữ nguyên danh sách đã hoãn)
MinIO/presign, cache Redis, xử lý nền 3D (LOD), `PermissionsGuard`, `ActivityLogInterceptor`, mọi UC "Mốc 5" (AR, đổi chất liệu, placement, phiên, xóa tài khoản, thương hiệu, thuộc tính, media, vận đơn, thông báo thủ công, nhật ký, thống kê AR), Android (Mốc 6). VNPAY với khóa sandbox thật chưa thử qua cổng thật.

### Còn nợ / lưu ý
- VNPAY thật: cần `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và địa chỉ công khai cho Return URL/IPN (tunnel khi chạy local).
- `payments[].enabled` trong cài đặt chưa được dùng để chặn phương thức khi đặt hàng (chỉ lưu và công khai); chưa có yêu cầu trong đặc tả.
- Giá combo, `loyalty_points`, `carts.coupon_id`, vận đơn: xem `CHUAN_MO_RONG.md` Phần 3.

---

## Đợt kiểm tra trước demo (2026-11-07) ✅

**Phần A (sửa nhỏ):** thanh toán đến sau khi đơn hủy vẫn ghi `paid`/`success`, đơn giữ `cancelled`, admin được thông báo cần hoàn tiền (`7a9c268`); `npm run demo` (`9d33bf8`); lượt xem không gian ghi một lần khi rời trang bằng `sendBeacon` (`de0c96c`); phí ship dùng `default_shipping_fee`/`free_shipping_threshold` khi tỉnh ngoài vùng (`4096f68`); thêm trước đó: giá vốn một lần (`693afb3`), phương thức thanh toán bị tắt (`3e4efa1`).

**Phần B (use case còn thiếu):** thương hiệu (`029fd94`), thuộc tính (`6756995`), media + job image-processing đã kiểm (`38fe10d`), vận chuyển + đổi chiều trạng thái theo D-N14 (`ce95abe` + commit FE). Mọi thao tác ghi ghi `activity_logs` cùng transaction. Không có migration.

**Ghi chú:** (1) UC-ADM-04 theo đặc tả: tệp bị tham chiếu bắt buộc ⇒ 409, tham chiếu tùy chọn (logo, ảnh danh mục…) được gỡ liên kết thay vì chặn; (2) thuộc tính hệ thống không đổi mã/không xóa; (3) vận đơn failed/returned là điểm mở O-03; (4) lỗi chập chờn "Hỏi đáp 404" xuất hiện lại một lần khi chạy supertest ngay sau chỉnh sửa, không tái hiện sau đó (3 lần chạy liền đều xanh).

---

## Lỗi chập chờn "Hỏi đáp 404" – nguyên nhân gốc (2026-11-07) ✅

**Nguyên nhân:** phụ thuộc thứ tự chạy file test. Test m2 "xóa: đã có trong đơn ⇒ ngừng bán" chọn sản phẩm bằng `findFirstOrThrow` KHÔNG có `orderBy` (Postgres trả theo thứ tự vật lý nên có lúc là sản phẩm id 2 `sofa-luxury`) rồi chuyển nó sang `archived`. Test m3 "hỏi đáp" dùng đúng `sofa-luxury` ⇒ `GET/POST /products/sofa-luxury/questions` trả 404 nếu m2 chạy TRƯỚC m3. Jest mặc định chạy file **vừa fail ở lần trước lên đầu**, nên thứ tự đổi sau mỗi lần có lỗi (chạy chồng hai bộ test, sửa test dở dang…) ⇒ lỗi xuất hiện rồi biến mất khi chạy lại. Đây không phải lỗi sản phẩm, cũng không phải do build/cổng/health.

**Tái hiện chắc chắn:** reset `aurelia_test`, chạy m2 rồi m3 trên cùng DB ⇒ 3 test "hỏi đáp" fail với `Expected 201, Received 404`; sau m2 truy vấn thấy `2 | sofa-luxury | archived`.

**Giả thuyết đã loại trừ:** (1) dist cũ/chưa build xong và chờ `/health`: supertest khởi tạo app NestJS trong chính tiến trình Jest (ts-jest biên dịch từ `src`), không có dist, cổng hay `/health`; (2) cổng bị chiếm/hai API cùng chạy: không mở cổng; (3) chạy song song: đã có khóa theo PID, và lỗi tái hiện được khi chạy tuần tự; (4) route phụ thuộc thứ tự đăng ký/thời gian: `ProductsService.bySlug` truy vấn DB trực tiếp (không dùng chỉ mục RAM 15 giây), route đăng ký cố định.

**Cách sửa:** (a) `test/sequencer.cjs` + `testSequencer` trong `jest-db.config.js`: thứ tự file cố định theo tên; (b) test m2 chọn sản phẩm có `orderBy: { id: 'desc' }` (cố định, không đụng sản phẩm test khác dùng).

**Kết quả:** kịch bản cũ (m2 rồi m3 trên cùng DB) xanh (58 + 56); chạy supertest 10 lần liên tiếp đều 176/176, trong đó 3 lần chạy ngay sau khi sửa một file trong `apps/api/src` (thêm dòng vào `slug.ts` rồi hoàn lại). Cập nhật: các ghi chú trước đây ("không tái hiện") nay đã có nguyên nhân.

---

## Xử lý nền mô hình 3D (2026-11-07) ✅

Theo UC-ADM-13, D-N07, D-N21, D-N22, D-T21; ghi nhận ở **D-P10** (thay thế một phần D-P09).

- **Luồng:** `POST /admin/models` (JSON `fileData`) và `POST /admin/models/upload` (multipart) kiểm tra tệp, lưu tệp gốc ở bucket private (`models/incoming/p<productId>/<uuid>.<ext>`), đặt `processing`, ghi `activity_logs` `model.upload` (kèm `sourceKey`), đẩy job queue `model-processing` và trả **202** `{ modelId, jobId, status }`. Bỏ cách "tạo bản sao tệp mẫu" và `status = ready` ngay.
- **Job** (`ModelProcessingService`, nối vào luồng upload sẵn có): kiểm tra GLB, đo đa giác/texture, 3 LOD, SHA-256, `media` + `model_files` (upsert) + `ready` trong một `$transaction`; dọn tệp cũ khi tải lại; USDZ chỉ kiểm tra ZIP + checksum.
- **Lỗi:** tệp hỏng ⇒ `failed` không retry (`UnrecoverableError`); lỗi tạm thời ⇒ retry 3 lần backoff lũy thừa. LOD vượt `MODEL_SERVE_MAX_MB` (5 MB) ⇒ `failed` + `activity_logs` `model.processing_failed` + thông báo cho admin tải lên, một transaction. Lý do lỗi đọc lại từ `activity_logs` (không thêm cột, **không có migration**).
- **Endpoint mới:** `POST /admin/models/:id/reprocess` (failed → processing, dùng tệp gốc đã lưu), `PATCH /admin/models/:id/primary` (bỏ cờ cũ rồi đặt cờ mới, cùng transaction), `DELETE /admin/models/model/:modelId` (xóa mô hình chưa có tệp). `createNew` để tạo mô hình thứ hai cho sản phẩm.
- **Public:** `GET /products/:slug/model` chỉ trả mô hình chính `ready`, `files[]` đủ LOD; `glbUrl` = LOD medium. `has3dModel`/`hasAr` do trigger.
- **Dữ liệu mẫu:** `prisma/seed-models.ts` (chạy cuối `db:seed`, đồng bộ, không cần Redis) cho mọi mô hình mẫu đi qua đúng luồng trên; `npm run db:process-models -w @aurelia-living/api` chạy lại trên DB demo/test đã có dữ liệu mà không reset. Kết quả: aurelia_test và aurelia_demo đều **52/52 mô hình `ready`, 0 failed, 0 mô hình > 5 MB** (aurelia_demo: `model_files` 70 → 174; mô hình mẫu `failed`/`processing` cũ — mỗi loại 1 — nay `ready`). USDZ mẫu cũ (22 byte, không phải ZIP) được thay bằng ZIP tối thiểu.
- **Test:** Jest unit `model-processing.service.spec.ts` (GLB hợp lệ, GLB hỏng, USDZ, vượt 5 MB, lỗi tạm thời, `markFailed`, processor retry); supertest `test/models-processing.db-spec.ts` (14 test, **cần Redis**: upload → 202 → ready, job `attempts=3` + backoff lũy thừa, hỏng không retry, vượt ngưỡng ⇒ log + thông báo, reprocess, mô hình chính, ghi đè không nhân đôi, quyền). Fixture `sphere.glb`/`broken.glb` CC0 (D-T27). Test cũ về tải mô hình trong `mock-m3` đã chuyển sang file mới (luồng 202).

---

## Bỏ AR, chỉ hỗ trợ GLB (2026-11-08, D-P11) ✅

- **API:** tải mô hình (JSON `fileData`, multipart `/upload`, `files/presign`, `files/confirm`) chỉ nhận GLB; USDZ/GLTF/đuôi khác ⇒ **415** "Hệ thống chỉ hỗ trợ tệp GLB". Job `model-processing` bỏ nhánh USDZ (job USDZ cũ còn sót bị loại không retry). Bỏ tham số `hasAr` của `/products*`, `usdzUrl` của `Model3DView`, `allowAr`, khóa cài đặt `ar_enabled` (seed cũng bỏ). Không thêm route AR. `markFailed` luôn đặt `failed` (không còn ngoại lệ USDZ).
- **DB chuẩn giữ nguyên:** `ar_sessions`, `ar_snapshots`, `products.has_ar`, enum có `usdz`, trigger `refresh_product_3d_flags`; **không có migration**. Ghi ở CHUAN_MO_RONG Phần 3 mục 27.
- **Dữ liệu mẫu:** seed không tạo USDZ (kể cả ZIP tối thiểu). `aurelia_demo` nạp lại bằng `db-reset` rồi `db:process-models`: **0 sản phẩm `has_ar`**, 52/52 sản phẩm `has_3d_model`, 52/52 mô hình `ready` (156 tệp = 52 × 3 LOD), 0 dòng `usdz`. `aurelia_test` tương tự. `aurelia_dev` chỉ kiểm tra, KHÔNG sửa: có **1** dòng `model_files` định dạng `usdz` (trên tổng 2 dòng) và 1 sản phẩm `has_ar`.
- **Test:** unit validator + `ModelProcessingService` (USDZ ⇒ 415 / job bị loại), supertest `models-processing` (USDZ/GLTF ⇒ 415 ở JSON, multipart, presign; `has_ar` luôn false; không còn `usdzUrl`), `mock-m4` (không còn `ar_enabled`). Bỏ 3 test USDZ/`ar_enabled` cũ, thay bằng 3 test từ chối tương đương nên số test không giảm.

## Lỗi chập chờn admin-m5 (media) – kết luận điều tra (2026-11-08)

**Triệu chứng:** sau khi lưu mô tả ảnh (toast "Đã lưu mô tả ảnh." hiện), thẻ ảnh vẫn ghi "Chưa có mô tả", `expect(...).toHaveCount(1)` quá hạn 5 giây (`admin-m5.spec.ts` dòng 220).

**Giả thuyết cần kiểm:** trước `f207bf5` (tách `BULL_PREFIX`), worker của API demo cổng 4000 nhận nhầm job `image-processing` của e2e nên trang media chờ webp/thumbnail mãi.

**Cách kiểm:** chạy `admin-m5` lặp lại trên cùng máy, API demo (bản cũ, prefix `bull`) đang chạy; nhóm A dùng chung prefix `bull` (sửa tạm `scripts/e2e-real.mjs`, đã hoàn tác, không commit), nhóm B dùng `bull-e2e` (bản đã commit).

| Nhóm | Số lần chạy | Fail |
|---|---|---|
| A. dùng chung prefix với API demo | 6 (4 lần ghi nhận rõ) | 2 |
| B. prefix tách (`bull-e2e`) | 23 | 1 |

**Kết luận (một phần):**
- Đã **xác nhận** worker demo nhận nhầm job của e2e: 6 job `model-processing` thất bại với "Không tìm thấy mô hình 53/54" trong Redis (cùng cơ chế sẽ xảy ra với `image-processing`). Đó là lỗi thật đã được sửa ở `f207bf5`, và là nguyên nhân của các lần fail ở nhóm test mô hình 3D.
- Với admin-m5, tần suất fail giảm từ ~1/3 (nhóm A) xuống ~1/23 (nhóm B), nhưng **chưa chứng minh được cơ chế** và **chưa loại bỏ hoàn toàn**: vẫn còn 1 lần fail ở nhóm B. Giả thuyết "trang media chờ webp/thumbnail" **không đúng như đã nêu**: danh sách media không phụ thuộc kết quả job (job ảnh không ghi lại hàng `media`, `GET /admin/media` đọc thẳng từ CSDL; đo độ trễ 0,1 s), và khi fail thì thẻ hiển thị dữ liệu cũ chứ không phải đang chờ.
- Chưa tăng thời gian chờ, chưa sửa test. Việc tiếp theo nếu muốn dứt điểm: bắt thêm một trace lỗi (đã thiết lập vòng lặp bắt trace nhưng 15/15 lần chạy sau đó đều xanh).

## Lỗi chập chờn admin-m5 – nguyên nhân đã xác định bằng trace (2026-11-08)

**Bằng chứng:** bật `trace: 'retain-on-failure'` + `screenshot`, log mọi response ≥ 400 của API e2e (`.e2e-logs/api-errors.log`), giữ bằng chứng của nhóm fail trong `.e2e-logs/<nhóm>-<thời điểm>/` (in đường dẫn trace khi fail). Chạy `admin-m5` 20 lần liên tiếp: **1 lần fail (lần 10), 19 lần xanh, 0 response 429** trong cả 20 lần.

**Đọc trace của lần fail:**
- Log API của lần fail chỉ có các 409 dự kiến của test; **không có 429, 403 hay 5xx** ⇒ giả thuyết giới hạn tốc độ **bị loại**. (API e2e đặt `THROTTLE_DEFAULT_LIMIT=100000`; trước đây nó dùng chung tiền tố Redis \`throttle:\` với API demo/dev nên bộ đếm lẫn nhau, nay tách thành \`throttle-e2e:\`/\`throttle-demo:\`, không phải nguyên nhân của lỗi này.)
- Giả thuyết worker demo lấy nhầm job ảnh cũng **không phải nguyên nhân** của lỗi này (danh sách media không phụ thuộc job).
- Dòng thời gian các request `/api/admin/media`: `GET ?q=ban+an+e2e` (lần tải đầu của khóa tìm kiếm mới) bắt đầu 16 ms **trước** `PATCH /media/1714` (lưu mô tả). PATCH trả 200 nhưng **không có GET danh sách nào sau PATCH**. Server đọc danh sách trước khi PATCH ghi xong ⇒ giao diện giữ mô tả cũ ("Chưa có mô tả") và `toHaveCount(1)` quá hạn 5 giây.
- **Cơ chế:** React Query v5 `invalidateQueries` chỉ hủy lần tải đang chạy khi query ĐÃ có dữ liệu; với query đang ở lần tải đầu (khóa vừa đổi do tìm kiếm) nó gộp vào lần tải đang bay, nên kết quả đọc trước khi ghi ở lại. Đây là lỗi thật của giao diện (người dùng gõ tìm kiếm rồi lưu ngay cũng gặp), chỉ lộ ra khi hai thao tác sát nhau (máy chậm hơn ⇒ dễ gặp hơn, đó cũng là lý do tần suất thay đổi theo tải của máy).
- Tái hiện có kiểm soát bằng unit test `tests/unit/query-refresh.test.ts` (invalidate trơn ⇒ 1 lần tải, dữ liệu cũ ở lại; `refreshAfterWrite` ⇒ 2 lần tải, dữ liệu mới).

**Sửa:** `src/lib/query-refresh.ts` (`refreshAfterWrite`: `cancelQueries` rồi `invalidateQueries`) dùng ở 3 chỗ ghi của trang media. Không tăng thời gian chờ, không tắt giới hạn tốc độ. Các trang admin khác có cùng mẫu "ghi rồi invalidate" chưa đổi (chưa có bằng chứng lỗi); nếu gặp lỗi tương tự thì dùng helper này.

**Giới hạn tốc độ cho môi trường test:** không cần đổi. API e2e đã đặt 100000 yêu cầu/phút; log cho thấy 0 lần 429. Tiền tố bộ đếm đã tách riêng cho e2e/demo (`THROTTLE_PREFIX`).

## PermissionsGuard và ActivityLogInterceptor (2026-11-08, D-P12) ✅

**PermissionsGuard** (DAC_TA mục 2, 9; QUY_UOC §8; DATABASE_SCHEMA §2)
- `@RequirePermission(...codes)` (`common/decorators/permissions.decorator.ts`, đặt ở class hoặc method, method ghi đè class, nhiều mã = "một trong") và `PermissionsGuard` (`common/guards/permissions.guard.ts`) chạy **sau** `JwtAuthGuard` và `RolesGuard`. Guard đọc `role_permissions` theo vai trò của người dùng; thiếu quyền ⇒ **403 `FORBIDDEN`** "Bạn không có quyền "<tên quyền>" để thực hiện thao tác này." (mã lỗi không đổi nên API_CONTRACT không cần sửa).
- Gắn quyền cho **mọi** route `/api/admin/*` (30 controller). Quyền theo dòng "Tác nhân chính" của từng UC; route ngoài đặc tả (kho thu chi, đổi trả, hỏi đáp, banner, bài viết, FAQ, liên hệ, thông báo, tìm nhanh) dùng quyền gần nhất. **Bảng route → quyền: CHUAN_MO_RONG.md Phần 3 mục 28.** Đơn hàng tách `view_orders` (xem) và `process_orders` (ghi). Bull Board vẫn do `bullBoardAdminOnly`.
- Admin có đủ 6 quyền nên hành vi hiện tại không đổi (toàn bộ suite cũ xanh). Quyền được giữ trong **bộ nhớ tiến trình tối đa 10 giây** (`PermissionsService`, không Redis; mục 29), đổi `role_permissions` có hiệu lực sau tối đa 10 giây.
- Lưu ý: `admin/activity-logs` (UC-ADM-27), `admin/roles`, `admin/ar-snapshots` hiện là khung rỗng (chưa có route), đã gắn quyền ở cấp class để khi thêm route sẽ tự được bảo vệ.
- **Test:** unit `permissions.guard.spec.ts` (6); supertest `permissions.db-spec.ts` (7): quét metadata (route `/admin/*` nào thiếu quyền ⇒ fail), tạm gỡ từng dòng `role_permissions` của admin ⇒ route tương ứng 403 và route khác vẫn 200, quyền nhiều lựa chọn, khách vẫn 403 từ RolesGuard; mọi dòng gỡ đều được khôi phục.

**ActivityLogInterceptor** (DAC_TA mục 9, §12.3; D-T52; D-D04)
- Mọi `ActivityLogService.log` trong service **giữ nguyên** (cùng transaction, D-T52). Interceptor là lưới an toàn: với request ghi (POST/PUT/PATCH/DELETE) của admin thành công mà service không gọi `ActivityLogService.log` (đánh dấu bằng `AsyncLocalStorage` theo request), ghi một dòng chung `actorId`, `action` theo route (`<tài nguyên>.<hành động>`), `targetType`/`targetId` (tham số `:id`), IP, `changes = { auto: true, method, route }`. Không ghi trùng; request lỗi, request đọc và request của khách không ghi; lỗi khi ghi log tự động không làm hỏng thao tác đã thành công.
- **Route trước đây không ghi log và nay được interceptor ghi:**
  - `PATCH /admin/models/:id/primary` khi mô hình **đã là mô hình chính** (service bỏ qua ghi vì không có thay đổi) — bắt được trong suite supertest (`models.primary`).
  - `POST /admin/media/presign`, `POST /admin/media/confirm`, `POST /admin/models/:id/files/presign` — phân tích tĩnh (quét thân method service và các method nó gọi) cho thấy service không gọi `ActivityLogService.log`. Chưa chạy qua suite vì cần MinIO (driver local không hỗ trợ presign).
  - Ngoài các route trên, mọi route ghi admin còn lại đều đã ghi log trong service nên interceptor không ghi thêm.
- **Test:** supertest `activity-interceptor.db-spec.ts` (6, dùng controller thử để điều khiển việc service có ghi hay không): route có log trong service ⇒ đúng 1 dòng; route thật `POST /admin/brands` ⇒ đúng 1 dòng, không có dòng tự động; route không log ⇒ interceptor ghi đúng 1 dòng (actor, action, target, IP); route có động từ cuối đường dẫn; request lỗi ⇒ 0 dòng; GET và request của khách ⇒ 0 dòng.

**Kiểm thử cuối đợt:** typecheck + lint sạch; unit web 27, unit API 122, supertest 196, Playwright thật 7/7 nhóm.
