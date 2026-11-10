# Kiến trúc Aurelia Living

> Cập nhật lần cuối: 2026-11-11 – theo commit `c579fa8`.
> Mô tả **hiện trạng của code**. Chi tiết từng mảng: API ở [API_CONTRACT.md](API_CONTRACT.md) và [api/openapi.json](api/openapi.json); CSDL ở [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); biến môi trường ở [ENVIRONMENT.md](ENVIRONMENT.md); triển khai ở [DEPLOYMENT.md](DEPLOYMENT.md); lý do kỹ thuật ở [DECISIONS.md](DECISIONS.md).

## 1. Tổng quan

Monorepo npm workspaces + Turborepo (`package.json`, `turbo.json`):

| Thư mục | Vai trò | Công nghệ |
| --- | --- | --- |
| `apps/api` | API REST (`/api`), worker nền chạy cùng tiến trình | NestJS 10, Prisma 5.22, PostgreSQL 16, Redis (BullMQ, throttler, cache), MinIO/S3, Nodemailer |
| `apps/web` | Website khách hàng và trang quản trị | Next.js 14 (App Router), TanStack Query, Zustand, React Three Fiber, `@google/model-viewer` |
| `apps/mobile` | Ứng dụng Android | **Khung rỗng** (35 tệp `.kt`, 104 dòng; hoãn theo D-P09) |
| `packages/shared-types` | Kiểu dùng chung FE/BE (entity, enum, mã lỗi) | Sinh từ `schema.prisma` bằng `npm run types:generate` ([SHARED_TYPES_SYNC.md](SHARED_TYPES_SYNC.md)) |
| `infra/docker`, `docker-compose.yml` | Hạ tầng dev (postgres, redis, minio, mailpit) và Dockerfile | |
| `scripts/` | `db-reset.mjs`, `e2e-real.mjs`, `demo.mjs`, `generate-shared-types.mjs`, `minio-sync-uploads.mjs`, `mobile-build.mjs` | |
| `database/` | SQL thuần tham khảo (đã lỗi thời, **không** phải nguồn chuẩn; xem [KNOWN_ISSUES.md](KNOWN_ISSUES.md)) | |

Nguồn chuẩn CSDL: `apps/api/prisma/schema.prisma` + `migrations/` (59 model, 25 enum, 16 migration).

## 2. Backend (`apps/api/src`)

Điểm vào `main.ts` → `app.setup.ts` (tiền tố `/api`, `helmet`, CORS theo `CORS_ORIGINS`, `ValidationPipe`, Swagger tại `/docs` khi `SWAGGER_ENABLED`) → `app.module.ts`.

**Lớp dùng chung (`common/`):** `AppException` + `AllExceptionsFilter` (mọi lỗi về dạng `{ success:false, error:{ code, message, details? } }`, [API_CONVENTIONS.md](API_CONVENTIONS.md)); interceptor bọc response `{ success:true, data, meta? }`; `FieldErrors`/`conflictError` ở `utils/validate.ts` (kiểm tra thủ công, thông báo tiếng Việt theo ô); `views/` (dựng dữ liệu hiển thị dùng chung như `CatalogViews`, `MediaIngest`).

**Nền tảng:** `prisma/` (PrismaService), `cache/` (`CatalogCache`, khóa Redis có tiền tố, xóa khi ghi), `storage/` (driver `local`/`minio`/`s3`, presigned URL), `mail/` (SMTP + hàng đợi), `config/` (kiểm tra biến môi trường khi khởi động), `health/` (`GET /health`), `activity-log/` (nhật ký thao tác admin).

**Module nghiệp vụ (`modules/`, 34 thư mục):**

| Nhóm | Module |
| --- | --- |
| Tài khoản | `auth`, `users`, `addresses`, `admin-users`, `admin-roles` |
| Danh mục/sản phẩm | `categories`, `brands`, `attributes`, `products`, `admin-products` (gộp biến thể và ảnh), `inventory`, `product-models` (3D), `media`, `wishlist`, `reviews` (đánh giá + hỏi đáp) |
| Mua hàng | `cart`, `coupons`, `orders`, `payments` (VNPay + giả lập), `shipments`, `returns` |
| Nội dung | `pages` (trang, bài viết, banner, FAQ, liên hệ), `settings`, `spaces`, `panoramas` (đặt mô hình 3D vào ảnh 360°), `notifications`, `admin-notifications` |
| Thống kê/vận hành | `admin-stats` (tổng quan, thu chi, phễu không gian), `activity-logs`, `jobs` (BullMQ + Bull Board) |
| **Khung rỗng (không có route)** | `ai`, `hotspots`, `product-images`, `variants` (logic đã gộp vào `admin-products`/`admin-spaces`, D-N32) |

Tổng cộng **210 endpoint** (khớp 210 dòng `Mapped {…}` khi khởi động).

**Hàng đợi nền** (`modules/jobs`): `model-processing` (kiểm tra GLB, sinh 3 LOD, nén Meshopt, SHA-256), `image-processing` (webp + thumbnail), mail, thông báo. Worker chạy cùng tiến trình API.

**Giao dịch và khóa:** thao tác nhạy cảm dùng `$transaction` và khóa dòng (`SELECT … FOR UPDATE`) hoặc cập nhật có điều kiện (D-T60): đặt hàng, hoàn tiền, đổi trạng thái vận đơn, sổ địa chỉ, lưu sản phẩm; thêm bộ không gian vào giỏ là một transaction tất cả-hoặc-không.

## 3. Luồng xác thực và phân quyền

- **Đăng nhập** `POST /auth/login` → `{ user, tokens: { accessToken, refreshToken } }`. Access token JWT sống `JWT_ACCESS_EXPIRES_IN` (15 phút, tối đa 15 phút ở production); refresh token **xoay vòng** (dùng một lần, lưu băm ở `user_sessions`); dùng lại refresh token đã thu hồi ⇒ thu hồi mọi phiên của người dùng (`auth.service.ts`). Đặt lại mật khẩu/đổi mật khẩu có thể thu hồi các phiên khác.
- **Bảo vệ route (guard toàn cục, `app.module.ts`):** `ThrottlerGuard` (giới hạn tốc độ, bộ đếm Redis; nhóm xác thực chặt hơn) → `JwtAuthGuard` (mặc định **mọi route cần đăng nhập**, `@Public()` để mở) → `RolesGuard` (`@Roles('admin')`) → `PermissionsGuard` (`@RequirePermission('manage_products' | 'manage_content' | 'view_orders' | 'process_orders' | 'manage_users' | 'manage_settings')`).
- Tài khoản bị khóa/cấm ⇒ mọi request kể cả token còn hạn trả `403 AUTH_ACCOUNT_LOCKED`. Mật khẩu: ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số, và `confirmPassword` khớp (D-N35); đăng nhập không áp quy tắc này.
- **Đăng nhập Google: chưa triển khai (hoãn)** — `POST /auth/google` luôn `503`.

## 4. Frontend (`apps/web/src`)

**Nhóm trang (App Router, 66 trang):**

| Nhóm | Thư mục | Nội dung |
| --- | --- | --- |
| Cửa hàng | `app/(shop)` + `app/page.tsx` | Trang chủ, sản phẩm, tìm kiếm, giỏ, thanh toán, không gian mẫu, yêu thích, về chúng tôi, liên hệ, FAQ, chính sách |
| Xem 3D | `app/(viewer)/products/[slug]/3d`, `app/(shop)/products/[slug]/360` | Trình xem 3D (GLB) và xoay 360° |
| Xác thực | `app/(auth)` | Đăng nhập, đăng ký, quên/đặt lại mật khẩu, xác thực email |
| Tài khoản | `app/(account)/account/*` | Hồ sơ và địa chỉ, đơn hàng, đổi trả, đánh giá, mã giảm giá, thông báo, không gian đã lưu, phiên đăng nhập, đổi mật khẩu |
| Quản trị | `app/admin/*` | Tổng quan, sản phẩm, danh mục, thương hiệu, thuộc tính, kho, đơn hàng, thanh toán, đổi trả, khách hàng, khuyến mãi, nội dung, media, mô hình 3D, không gian, hỏi đáp, đánh giá, báo cáo, vai trò, nhật ký, cài đặt |

Thành phần dùng chung ở `components/` (`ui`, `layout`, `product`, `cart`, `account`, `admin`, `viewer`); hook ở `hooks/` (`useProducts`, `useCart`, `useAuth`, `useListState`…); lớp gọi API ở `services/*.api.ts`.

**Cách FE gọi API:** mọi lời gọi đi qua MỘT hàm `request()` (`services/api-client.ts`):
1. Đợi nạp xong phiên từ `localStorage` (`sessionReady`), gắn `Authorization: Bearer <accessToken>`.
2. Gọi `fetch` tới `${NEXT_PUBLIC_API_URL}/api`; gói lỗi thành `ApiClientError(code, message, status, details)`; `fieldErrors()` rút lỗi theo ô từ `VALIDATION_FAILED` và `CONFLICT`.
3. Gặp `401` (trừ đường dẫn `/auth/*`): tự gọi `refreshSession()` **một lần** (dùng chung một lời gọi cho nhiều request song song) rồi gửi lại; refresh thất bại ⇒ đăng xuất cục bộ.
4. Trạng thái phiên: Zustand `store/authStore.ts`, lưu `user`, `accessToken`, `refreshToken` vào `localStorage` (rủi ro XSS đã ghi ở [KNOWN_ISSUES.md](KNOWN_ISSUES.md)). Dữ liệu máy chủ: TanStack Query (`lib/query-client.ts`, `staleTime` 60 giây, `retry` 1), ghi xong không bị lần tải cũ ghi đè (`lib/query-refresh.ts`).

**Chế độ dữ liệu giả (mock):** khi `NEXT_PUBLIC_USE_MOCK=true`, `request()` chuyển vào `mock-data/mockApi` chạy trong trình duyệt (bảng dữ liệu ở `mock-data/tables`, route ở `mockApi/index.ts`) nên giao diện chạy không cần API. `apps/web/.env.example` đặt mặc định `true`. **`next build` production thất bại nếu bật** (`next.config.js`). Mock cũng là nguồn seed cho DB demo (`SEED_SOURCE=mock`). Hiện trạng thật hay giả của từng trang: [AUDIT_REPORT.md](AUDIT_REPORT.md) mục 4.

## 5. Dữ liệu và tệp

- **PostgreSQL:** 59 bảng; trigger DB tính `rating_avg`, `has_3d_model`, `view_count`, `line_total`, ghi `order_status_history`; chi tiết [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), quy ước [QUY_UOC_CODE_DB.md](QUY_UOC_CODE_DB.md).
- **Tệp:** metadata ở bảng `media`, tệp ở bucket public/private (MinIO/S3) hoặc thư mục `uploads/` (driver `local`). Ảnh/GLB lớn đi bằng presigned URL từ trình duyệt rồi `confirm`; GLB chỉ nhận định dạng GLB (USDZ ⇒ 415, AR đã loại bỏ).
- **Cache:** catalog (sản phẩm, danh mục, trang) trong Redis, bị xóa khi ghi (`CatalogCache.invalidate*`).

## 6. Kiểm thử

Jest unit (API, `src/**/*.spec.ts`), Vitest (web, `apps/web/tests/unit`), supertest trên DB `aurelia_test` (`apps/api/test/*.db-spec.ts`, cần DB dựng mới), MinIO thật (`*.minio-spec.ts`), Playwright với API thật (`npm run test:e2e:real`, 11 nhóm, chạy `next dev` + API cổng 4002). Lệnh và điều kiện: [../README.md](../README.md) mục 6; kết quả gần nhất: [FINAL_READY_TO_MERGE_REPORT.md](FINAL_READY_TO_MERGE_REPORT.md).
