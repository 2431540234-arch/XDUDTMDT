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
| 7–9 | Nền tảng, migration/seed, module theo 4 mốc | 🟡 Mốc 1 ✅ · Mốc 2–4 chưa làm |
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
# API (cổng 4001 vì 4000 đang bị container api cũ chiếm)
DATABASE_URL=... PORT=4001 STORAGE_DRIVER=local STORAGE_PUBLIC_URL=http://localhost:4001/uploads OTP_FIXED_CODE=123456 JWT_ACCESS_EXPIRES_IN=12h CORS_ORIGINS=http://localhost:3000,http://localhost:3100 npm run start:dev -w @aurelia-living/api
# FE với API thật
NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=http://localhost:4001 npm run dev -w @aurelia-living/web
```
Tài khoản: `admin@aurelia.vn / admin123`, `khachhang@aurelia.vn / 123456`.
