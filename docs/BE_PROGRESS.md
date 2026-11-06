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
| 6 | ⛔ **Điểm dừng – chờ người dùng "Đồng ý"** | ⏸ đang chờ |
| 7–12 | Nền tảng, migration/seed, module, test, nối FE, bàn giao | chưa bắt đầu |

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
- **41 bảng, 19 enum; toàn bộ bảng 0 dòng** (DB sạch, chưa seed).
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
