# AUDIT_REPORT — Aurelia Living (nhánh `feature/backend`, commit `1d6962e`)

Ngày audit: 2026-11-10 · Chỉ đọc (không sửa mã nguồn); tệp duy nhất được tạo trong repo là báo cáo này. Phần "đọc tự động" dùng script tạm đặt NGOÀI repo (`%TEMP%\aud\audit*.mjs`) để trích endpoint/route/bảng/TODO, sau đó đối chiếu tay các trường hợp nghi ngờ. Mọi `file:dòng` đều là đường dẫn từ gốc repo (hoặc từ `apps/api/src/`, `apps/web/src/` ở các bảng đã ghi chú).

## 1. Tổng quan

**Tech stack** (đọc từ `package.json`, `docs/CONG_NGHE.md`, `apps/api/src/app.module.ts`, `apps/web/src/services/api-client.ts`):
- Monorepo npm workspaces + Turborepo: `apps/api` (NestJS 10, Prisma 5.22, PostgreSQL 16, Redis, BullMQ, MinIO/S3, Nodemailer→Mailpit), `apps/web` (Next.js 14 App Router, TanStack Query, Zustand, React Three Fiber + `@google/model-viewer`), `apps/mobile` (Android, khung rỗng), `packages/shared-types`.
- Auth: JWT access (15 phút) + refresh có xoay vòng, `JwtAuthGuard` toàn cục (`app.module.ts:81`), `@Public()` mở route, `@Roles('admin')` + `@RequirePermission(...)` (`PermissionsGuard`, `app.module.ts:85`); `ThrottlerGuard` lưu bộ đếm ở Redis (`app.module.ts:33-44,80`).
- FE gọi API qua MỘT điểm vào `request()` (`web/services/api-client.ts:149`); khi `NEXT_PUBLIC_USE_MOCK=true` chuyển sang `mock-data/mockApi` chạy trong trình duyệt (`api-client.ts:87-88`). **`apps/web/.env.example` đặt mặc định `NEXT_PUBLIC_USE_MOCK=true`** ⇒ chạy FE "mặc định" là chạy dữ liệu giả; chạy thật cần tắt biến này và đặt `NEXT_PUBLIC_API_URL`.
- Cách chạy: `npm run infra:up` (postgres, redis, minio, mailpit), `npm run db:deploy && npm run db:seed`, `npm run dev`; `npm run demo` dựng cả hệ thống (`package.json` scripts, `scripts/demo.mjs`). Cấu hình: `.env.example` (gốc), `docs/ENVIRONMENT.md`.

**Quy mô đo được:** 210 endpoint BE (khớp đúng 210 dòng `Mapped {…}` khi khởi động API thật, xem mục Xác minh) · 66 trang FE · 59 model Prisma / 16 migration · 7 tệp seed · 16 tệp `*.spec.ts` (API) · 38 tệp test trong `apps/api/test` · 16 tệp e2e Playwright · 9 tệp test web.

**Tỷ lệ hoàn thành (ước tính có căn cứ):**

| Phạm vi | ✅ | 🟡 | 🔴 | ⚪ | Ghi chú |
|---|---|---|---|---|---|
| 70 UC trong phạm vi (DAC_TA) | 68 | 2 | 0 | 0 | 97 % chạy end-to-end; 2 UC thiếu một phần FE (ADM-07, ADM-12) |
| Chức năng ngoài DAC_TA / chưa có (17 dòng ở §2.2) | 6 | 8 | 1 | 2 | phần lớn 🟡 là "BE có, FE chưa dùng" |
| Trang FE (66) | 60 | 6 | 0 | 0 | 6 trang có nội dung viết cứng hoặc thiếu thao tác (xem §4) |
| Endpoint BE (210) | 210 − 1 | 1 (`POST /auth/google` luôn 503) | 0 | 0 | không có endpoint trả dữ liệu cứng, mock hay 501 |
| Loại khỏi phạm vi có chủ đích | | | | 10 UC | 6 UC AR đã xóa (D-P16) + 4 UC Android hoãn (D-P09) |

Kết luận ngắn: BE thật và đầy đủ; FE nối API thật ở mọi trang; các phần dang dở tập trung ở (a) vài thao tác quản trị mà BE có nhưng FE chưa có giao diện, (b) nội dung viết cứng ở trang `/about` và `/contact`, (c) đăng nhập Google chưa làm, (d) một lỗi xem trước mô hình 3D ở admin, (e) tài liệu/comment lỗi thời.

## 2. Ma trận chức năng

### 2.1. 70 UC trong phạm vi (đối chiếu DAC_TA ↔ DB ↔ BE ↔ FE)

Cột DB lấy từ dòng "Model + C/R/U/D" của từng UC trong `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`; BE = số endpoint tìm thấy trong mã so với số endpoint ghi ở `docs/DOI_CHIEU_UC.md`; FE = route khớp trong `apps/web/src/app`. "Bằng chứng" = controller `file:dòng` của endpoint đầu tiên + tệp trang FE. Hầu hết UC còn có test (cột "Test hiện có" ở `DOI_CHIEU_UC.md`, và ma trận 70 UC ở `FINAL_READY_TO_MERGE_REPORT.md`).

| Module | Chức năng | Docs | DB | BE API (khớp/tổng) | FE | Trạng thái | Bằng chứng (file:dòng) | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| 3D | UC-3D-01 Xem mô hình 3D của sản phẩm | ✔ | product_3d_models, model_files, media, model_material_variants | 1/1 (GET /products/:x/model) | /products/[slug]/3d | ✅ | apps/api/src/modules/products/products.controller.ts:50 · apps/web/src/app/(viewer)/products/[slug]/3d/page.tsx:1 | — |
| 3D | UC-3D-03 Đổi màu/chất liệu trên mô hình 3D | ✔ | model_material_variants | 1/1 (GET /products/:x/model) | /products/[slug]/3d | ✅ | apps/api/src/modules/products/products.controller.ts:50 · apps/web/src/app/(viewer)/products/[slug]/3d/page.tsx:1 | — |
| ACC | UC-ACC-01 Xem và cập nhật hồ sơ cá nhân | ✔ | users, media | 2/2 (GET /users/me +1) | /account/profile | ✅ | apps/api/src/modules/users/users.controller.ts:13 · apps/web/src/app/(account)/account/profile/page.tsx:1 | — |
| ACC | UC-ACC-02 Đổi mật khẩu | ✔ | users, user_sessions | 1/1 (POST /users/me/change-password) | /account/password | ✅ | apps/api/src/modules/users/users.controller.ts:49 · apps/web/src/app/(account)/account/password/page.tsx:1 | — |
| ACC | UC-ACC-03 Quản lý phiên đăng nhập (đăng xuất từ xa) | ✔ | user_sessions | 2/2 (GET /users/me/sessions +1) | /account/sessions | ✅ | apps/api/src/modules/users/users.controller.ts:25 · apps/web/src/app/(account)/account/sessions/page.tsx:1 | — |
| ACC | UC-ACC-04 Quản lý sổ địa chỉ giao hàng | ✔ | addresses | 5/5 (GET /addresses +4) | /account/profile | ✅ | apps/api/src/modules/addresses/addresses.controller.ts:13 · apps/web/src/app/(account)/account/profile/page.tsx:1 | — |
| ACC | UC-ACC-05 Xem và đánh dấu đã đọc thông báo | ✔ | notifications | 4/4 (GET /notifications +3) | /account/notifications | ✅ | apps/api/src/modules/notifications/notifications.controller.ts:15 · apps/web/src/app/(account)/account/notifications/page.tsx:1 | — |
| ACC | UC-ACC-06 Quản lý danh sách yêu thích | ✔ | wishlists, products | 3/3 (GET /wishlist +2) | /wishlist | ✅ | apps/api/src/modules/wishlist/wishlist.controller.ts:13 · apps/web/src/app/(shop)/wishlist/page.tsx:1 | — |
| ACC | UC-ACC-07 Yêu cầu xóa tài khoản (xóa mềm) | ✔ | users, user_sessions | 1/1 (DELETE /users/me) | /account/profile | ✅ | apps/api/src/modules/users/users.controller.ts:40 · apps/web/src/app/(account)/account/profile/page.tsx:1 | — |
| ADM | UC-ADM-01 Quản lý người dùng | ✔ | users, user_sessions, orders | 4/4 (GET /admin/users +3) | /admin/customers | ✅ | apps/api/src/modules/admin-users/admin-users.controller.ts:22 · apps/web/src/app/admin/customers/page.tsx:1 | — |
| ADM | UC-ADM-02 Quản lý vai trò và phân quyền | ✔ | roles, permissions, role_permissions, user_roles | 3/3 (GET /admin/roles +2) | /admin/roles | ✅ | apps/api/src/modules/admin-roles/admin-roles.controller.ts:17 · apps/web/src/app/admin/roles/page.tsx:1 | — |
| ADM | UC-ADM-03 Quản lý cài đặt hệ thống | ✔ | settings | 2/2 (GET /admin/settings +1) | /admin/settings | ✅ | apps/api/src/modules/settings/admin-settings.controller.ts:16 · apps/web/src/app/admin/settings/page.tsx:1 | — |
| ADM | UC-ADM-04 Quản lý media (ảnh, tệp) | ✔ | media, activity_logs | 5/5 (POST /admin/media +4) | /admin/media | ✅ | apps/api/src/modules/media/admin-media.controller.ts:38 · apps/web/src/app/admin/media/page.tsx:1 | lưu ý: handler không gọi service; ủy quyền (không thấy Prisma trực tiếp) |
| ADM | UC-ADM-05 Quản lý danh mục sản phẩm | ✔ | categories, media | 4/4 (GET /admin/categories +3) | /admin/categories | ✅ | apps/api/src/modules/categories/admin-categories.controller.ts:16 · apps/web/src/app/admin/categories/page.tsx:1 | lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| ADM | UC-ADM-06 Quản lý thương hiệu | ✔ | brands, media | 5/5 (GET /admin/brands +4) | /admin/brands | ✅ | apps/api/src/modules/brands/admin-brands.controller.ts:17 · apps/web/src/app/admin/brands/page.tsx:1 | — |
| ADM | UC-ADM-07 Quản lý trang tĩnh | ✔ | pages, activity_logs | 4/4 (/admin/pages: GET, POST, PATCH, DELETE) | /admin/content | 🟡 | api/…/pages/admin-pages.controller.ts:16 | BE đủ (GET/POST/PATCH/DELETE /admin/pages, admin-pages.controller.ts:16-31). FE `/admin/content` chỉ SỬA trang có sẵn (`savePage`, admin/content/page.tsx:471); KHÔNG có nút tạo/xóa trang, trong khi DAC_TA UC-ADM-07 luồng chính yêu cầu tạo/sửa. |
| ADM | UC-ADM-08 Quản lý thuộc tính và giá trị thuộc tính | ✔ | attributes, attribute_values, variant_attribute_values, activity_logs | 4/4 (GET /admin/attributes +3) | /admin/attributes | ✅ | apps/api/src/modules/attributes/admin-attributes.controller.ts:16 · apps/web/src/app/admin/attributes/page.tsx:1 | — |
| ADM | UC-ADM-09 Quản lý sản phẩm | ✔ | products, categories, brands, product_variants, product_images, activity_logs | 5/5 (GET /admin/products +4) | /admin/products | ✅ | apps/api/src/modules/products/admin-products.controller.ts:18 · apps/web/src/app/admin/products/page.tsx:1 | — |
| ADM | UC-ADM-10 Quản lý biến thể sản phẩm | ✔ | product_variants, variant_attribute_values, attribute_values, attributes | 2/2 (POST, PATCH /admin/products; API gộp) | /admin/products/[id] | ✅ | api/…/products/admin-products.controller.ts:28,52 | API gộp (D-N32): variants nằm trong PATCH /admin/products/:id (admin-products.controller.ts:52); FE ProductForm. Không có module riêng: `modules/variants/*` là khung rỗng. |
| ADM | UC-ADM-11 Quản lý ảnh sản phẩm | ✔ | product_images, media, product_variants | 2/2 (POST, PATCH /admin/products; API gộp) | /admin/products/[id] | ✅ | api/…/products/admin-products.controller.ts:28,52 | API gộp (D-N32): images trong POST/PATCH /admin/products (admin-products.controller.ts:28,52); `modules/product-images/*` là khung rỗng. |
| ADM | UC-ADM-12 Nhập kho và điều chỉnh tồn kho | ✔ | inventory_movements, product_variants | 9/9 (/admin/inventory*) | /admin/inventory | 🟡 | api/…/inventory/admin-inventory.controller.ts:18-77 | FE chỉ có phiếu nhập/xuất (`createReceipt`, inventory/page.tsx:54) + xem biến động; `POST /admin/inventory/movements` (nhập/điều chỉnh/hàng trả trực tiếp, admin-inventory.controller.ts:40) KHÔNG có lời gọi FE. |
| ADM | UC-ADM-13 Tải và quản lý mô hình 3D sản phẩm | ✔ | product_3d_models, model_files, media, products, activity_logs, notifications | 6/6 (/admin/models*) | /admin/models | ✅ | api/…/product-models/admin-models.controller.ts:52-134 | admin-models.controller.ts:52-134 (upload JSON/multipart, presign, confirm, reprocess, primary); FE /admin/models. Lưu ý: ô "Xem trước 360°" luôn dùng `/mock/models/sofa.glb` (xem §4). |
| ADM | UC-ADM-14 Cấu hình biến thể chất liệu cho mô hình 3D | ✔ | model_material_variants, product_variants | 4/4 (/admin/models/:id/material*) | /admin/models | ✅ | api/…/product-models/admin-models.controller.ts:145-170 | admin-models.controller.ts:145-170; FE MaterialVariantsModal. |
| ADM | UC-ADM-15 Quản lý không gian mẫu và ảnh 360° | ✔ | spaces, space_panoramas, media, categories | 5/5 (GET /admin/spaces +4) | /admin/spaces | ✅ | apps/api/src/modules/spaces/admin-spaces.controller.ts:18 · apps/web/src/app/admin/spaces/page.tsx:1 | lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| ADM | UC-ADM-16 Quản lý điểm tương tác (hotspot) trên ảnh 360° | ✔ | space_hotspots, space_panoramas, products | gộp trong PATCH /admin/spaces/:id | /admin/spaces/[id] | ✅ | api/…/spaces/admin-spaces.service.ts:304,331 | Hotspot lưu qua PATCH /admin/spaces/:id (admin-spaces.service.ts:304,331); FE SpaceForm. `modules/hotspots/*` là khung rỗng (controller không route). |
| ADM | UC-ADM-17 Đặt mô hình 3D sản phẩm vào ảnh 360° (placement) | ✔ | space_product_placements, products, product_3d_models, product_variants | 4/4 (GET /admin/panoramas/:x/placements +3) | /admin/spaces/[id] | ✅ | apps/api/src/modules/panoramas/admin-panoramas.controller.ts:16 · apps/web/src/app/admin/spaces/[id]/page.tsx:1 | — |
| ADM | UC-ADM-18 Duyệt hoặc từ chối đánh giá | ✔ | reviews, products, users, notifications | 2/2 (GET /admin/reviews +1) | /admin/reviews | ✅ | apps/api/src/modules/reviews/admin-reviews.controller.ts:18 · apps/web/src/app/admin/reviews/page.tsx:1 | — |
| ADM | UC-ADM-19 Quản lý mã giảm giá | ✔ | coupons, coupon_usages | 5/5 (GET /admin/coupons +4) | /admin/promotions | ✅ | apps/api/src/modules/coupons/admin-coupons.controller.ts:18 · apps/web/src/app/admin/promotions/page.tsx:1 | — |
| ADM | UC-ADM-20 Xem danh sách và chi tiết đơn hàng | ✔ | orders, order_items, order_status_history, payments, shipments, users | 4/4 (GET /admin/orders +3) | /admin/orders | ✅ | apps/api/src/modules/orders/admin-orders.controller.ts:19 · apps/web/src/app/admin/orders/page.tsx:1 | lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| ADM | UC-ADM-21 Cập nhật trạng thái đơn hàng | ✔ | orders, order_items, shipments, notifications, order_status_history, trigger | 1/1 (PATCH /admin/orders/:x/status) | /admin/orders/[code] | ✅ | apps/api/src/modules/orders/admin-orders.controller.ts:53 · apps/web/src/app/admin/orders/[code]/page.tsx:1 | — |
| ADM | UC-ADM-22 Hủy đơn hàng (quản trị) | ✔ | orders, order_items, product_variants, inventory_movements, coupons, coupon_usages, payments, notifications, order_status_history, trigger | 1/1 (POST /admin/orders/:x/cancel) | /admin/orders/[code] | ✅ | apps/api/src/modules/orders/admin-orders.controller.ts:59 · apps/web/src/app/admin/orders/[code]/page.tsx:1 | — |
| ADM | UC-ADM-23 Hoàn tiền thủ công | ✔ | orders, payments, order_items, product_variants, inventory_movements, notifications, order_status_history, trigger | 1/1 (POST /admin/orders/:id/refund) | /admin/orders/[code] | ✅ | api/…/orders/admin-orders.controller.ts:65 | POST /admin/orders/:id/refund (admin-orders.controller.ts:65); FE orders/[code]. |
| ADM | UC-ADM-24 Quản lý thanh toán (xác nhận chuyển khoản) | ✔ | payments, orders, notifications | 3/3 (GET /admin/payments +2) | /admin/payments | ✅ | apps/api/src/modules/payments/admin-payments.controller.ts:18 · apps/web/src/app/admin/payments/page.tsx:1 | — |
| ADM | UC-ADM-25 Quản lý vận chuyển | ✔ | shipments, orders, order_items, products, payments, notifications, order_status_history, trigger | 2/2 (POST /admin/orders/:x/shipments +1) | /admin/orders/[code] | ✅ | apps/api/src/modules/shipments/admin-shipments.controller.ts:16 · apps/web/src/app/admin/orders/[code]/page.tsx:1 | — |
| ADM | UC-ADM-26 Gửi thông báo cho người dùng | ✔ | notifications, users | 1/1 (POST /admin/notifications) | /admin/notifications | ✅ | apps/api/src/modules/admin-notifications/admin-notifications.controller.ts:16 · apps/web/src/app/admin/notifications/page.tsx:1 | — |
| ADM | UC-ADM-27 Xem nhật ký hoạt động của quản trị viên | ✔ | activity_logs, users | 1/1 (GET /admin/activity-logs) | /admin/activity-logs | ✅ | apps/api/src/modules/activity-logs/admin-activity-logs.controller.ts:18 · apps/web/src/app/admin/activity-logs/page.tsx:1 | — |
| ADM | UC-ADM-28 Xem thống kê tổng quan | ✔ | orders, order_items, products, users | 5/5 (stats/overview, finance, expenses) | /admin, /admin/reports | ✅ | api/…/admin-stats/admin-stats.controller.ts:21 | GET /admin/stats/overview (admin-stats.controller.ts:21) + finance/expenses; FE /admin, /admin/reports. `DELETE /admin/expenses/:id` không được FE gọi. |
| ADM | UC-ADM-29 Thống kê AR và phễu không gian mẫu | ✔ | space_views, spaces, products | 1/1 (GET /admin/stats/spaces) | /admin/reports/spaces | ✅ | apps/api/src/modules/admin-stats/admin-stats.controller.ts:31 · apps/web/src/app/admin/reports/spaces/page.tsx:1 | — |
| AUTH | UC-AUTH-01 Đăng ký tài khoản | ✔ | users, user_sessions, user_roles, trigger | 1/1 (POST /auth/register) | /register | ✅ | apps/api/src/modules/auth/auth.controller.ts:51 · apps/web/src/app/(auth)/register/page.tsx:1 | — |
| AUTH | UC-AUTH-02 Đăng nhập | ✔ | users, user_sessions, user_roles, roles | 1/1 (POST /auth/login) | /login | ✅ | apps/api/src/modules/auth/auth.controller.ts:37 · apps/web/src/app/(auth)/login/page.tsx:1 | — |
| AUTH | UC-AUTH-03 Làm mới access token | ✔ | user_sessions, users | 1/1 (POST /auth/refresh) | (client tự gọi khi 401) | ✅ | apps/api/src/modules/auth/auth.controller.ts:70 | trang FE: không khớp route tự động ((client tự gọi khi 401)) |
| AUTH | UC-AUTH-04 Đăng xuất | ✔ | user_sessions | 1/1 (POST /auth/logout) | Menu người dùng | ✅ | apps/api/src/modules/auth/auth.controller.ts:79 | trang FE: không khớp route tự động (Menu người dùng) |
| AUTH | UC-AUTH-05 Quên mật khẩu (yêu cầu đặt lại) | ✔ | users, password_resets | 1/1 (POST /auth/forgot-password) | /forgot-password | ✅ | apps/api/src/modules/auth/auth.controller.ts:89 · apps/web/src/app/(auth)/forgot-password/page.tsx:1 | — |
| AUTH | UC-AUTH-06 Đặt lại mật khẩu | ✔ | password_resets, users, user_sessions | 1/1 (POST /auth/reset-password) | /reset-password | ✅ | apps/api/src/modules/auth/auth.controller.ts:99 · apps/web/src/app/(auth)/reset-password/page.tsx:1 | — |
| AUTH | UC-AUTH-07 Xác thực email | ✔ | users | 1/1 (POST /auth/verify-email) | /verify-email | ✅ | apps/api/src/modules/auth/auth.controller.ts:19 · apps/web/src/app/(auth)/verify-email/page.tsx:1 | — |
| CART | UC-CART-01 Thêm sản phẩm vào giỏ hàng | ✔ | carts, cart_items, product_variants | 1/1 (POST /cart/items) | /products/[slug] | ✅ | apps/api/src/modules/cart/cart.controller.ts:38 · apps/web/src/app/(shop)/products/[slug]/page.tsx:1 | — |
| CART | UC-CART-02 Xem giỏ hàng | ✔ | carts, cart_items, product_variants, products, product_images | 1/1 (GET /cart) | /cart | ✅ | apps/api/src/modules/cart/cart.controller.ts:25 · apps/web/src/app/(shop)/cart/page.tsx:1 | — |
| CART | UC-CART-03 Cập nhật số lượng / xóa dòng trong giỏ | ✔ | cart_items, carts | 3/3 (PATCH /cart/items/:x +2) | /cart | ✅ | apps/api/src/modules/cart/cart.controller.ts:44 · apps/web/src/app/(shop)/cart/page.tsx:1 | — |
| CART | UC-CART-04 Áp mã giảm giá | ✔ | coupons, coupon_usages, carts | 2/2 (POST /cart/coupon +1) | /cart | ✅ | apps/api/src/modules/cart/cart.controller.ts:54 · apps/web/src/app/(shop)/cart/page.tsx:1 | lệch có chủ đích đã ghi ở CHUAN_MO_RONG |
| CAT | UC-CAT-01 Xem trang chủ | ✔ | products, categories, spaces, settings | 4/4 (GET /categories +3) | / | ✅ | apps/api/src/modules/categories/categories.controller.ts:13 | trang FE: không khớp route tự động (/); lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| CAT | UC-CAT-02 Duyệt sản phẩm theo danh mục | ✔ | categories, products, product_variants, product_images, brands | 3/3 (GET /categories +2) | /products | ✅ | apps/api/src/modules/categories/categories.controller.ts:13 · apps/web/src/app/(shop)/products/page.tsx:1 | lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| CAT | UC-CAT-03 Tìm kiếm sản phẩm | ✔ | products, product_images | 2/2 (GET /products/search +1) | /search | ✅ | apps/api/src/modules/products/products.controller.ts:28 · apps/web/src/app/(shop)/search/page.tsx:1 | lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| CAT | UC-CAT-04 Xem chi tiết sản phẩm | ✔ | products, product_variants, variant_attribute_values, attribute_values, attributes, product_images, media, brands, categories, product_3d_models, reviews | 2/2 (GET /products/:x +1) | /products/[slug] | ✅ | apps/api/src/modules/products/products.controller.ts:43 · apps/web/src/app/(shop)/products/[slug]/page.tsx:1 | — |
| CAT | UC-CAT-05 Xem trang tĩnh | ✔ | pages | 1/1 (GET /pages/:x) | /about | ✅ | apps/api/src/modules/pages/pages.controller.ts:21 · apps/web/src/app/(shop)/about/page.tsx:1 | lệch có chủ đích đã ghi ở CHUAN_MO_RONG |
| CAT | UC-CAT-06 Tìm kiếm sản phẩm không dấu | ✔ | products, product_images | 1/1 (GET /products/search) | /search | ✅ | apps/api/src/modules/products/products.controller.ts:28 · apps/web/src/app/(shop)/search/page.tsx:1 | lưu ý: ủy quyền (không thấy Prisma trực tiếp) |
| ORD | UC-ORD-01 Đặt hàng | ✔ | carts, cart_items, product_variants, products, addresses, coupons, coupon_usages, orders, order_items, payments, inventory_movements, order_status_history, trigger, notifications, settings | 1/1 (POST /orders) | /checkout | ✅ | apps/api/src/modules/orders/orders.controller.ts:15 · apps/web/src/app/(shop)/checkout/page.tsx:1 | — |
| ORD | UC-ORD-02 Xem và theo dõi đơn hàng của tôi | ✔ | orders, order_items, order_status_history, payments, shipments | 3/3 (GET /orders +2) | /account/orders | ✅ | apps/api/src/modules/orders/orders.controller.ts:24 · apps/web/src/app/(account)/account/orders/page.tsx:1 | — |
| ORD | UC-ORD-03 Hủy đơn hàng | ✔ | orders, order_items, product_variants, inventory_movements, coupons, coupon_usages, payments, notifications, order_status_history, trigger | 1/1 (POST /orders/:x/cancel) | /account/orders/[code] | ✅ | apps/api/src/modules/orders/orders.controller.ts:41 · apps/web/src/app/(account)/account/orders/[code]/page.tsx:1 | — |
| PAY | UC-PAY-01 Thanh toán đơn hàng online | ✔ | orders, payments | 2/2 (POST /orders +1) | /checkout | ✅ | apps/api/src/modules/orders/orders.controller.ts:15 · apps/web/src/app/(shop)/checkout/page.tsx:1 | — |
| PAY | UC-PAY-02 Nhận callback/IPN từ cổng thanh toán | ✔ | payments, orders, notifications, order_status_history, trigger | 2/2 (GET /payments/vnpay/return +1) | /checkout/success | ✅ | apps/api/src/modules/payments/payments.controller.ts:17 · apps/web/src/app/(shop)/checkout/success/page.tsx:1 | lệch có chủ đích đã ghi ở CHUAN_MO_RONG |
| PAY | UC-PAY-03 Thanh toán lại đơn chưa thanh toán | ✔ | orders, payments | 1/1 (POST /payments/:x/retry) | /account/orders/[code] | ✅ | apps/api/src/modules/payments/payments.controller.ts:50 · apps/web/src/app/(account)/account/orders/[code]/page.tsx:1 | — |
| REV | UC-REV-01 Xem đánh giá sản phẩm | ✔ | reviews, users | 1/1 (GET /products/:x/reviews) | /products/[slug] | ✅ | apps/api/src/modules/reviews/reviews.controller.ts:19 · apps/web/src/app/(shop)/products/[slug]/page.tsx:1 | — |
| REV | UC-REV-02 Đánh giá sản phẩm đã mua | ✔ | reviews, orders, order_items, users | 1/1 (POST /products/:x/reviews) | /account/orders/[code] | ✅ | apps/api/src/modules/reviews/reviews.controller.ts:27 · apps/web/src/app/(account)/account/orders/[code]/page.tsx:1 | — |
| REV | UC-REV-03 Sửa/xóa đánh giá của mình | ✔ | reviews | 3/3 (PATCH /reviews/:x +2) | /account/reviews | ✅ | apps/api/src/modules/reviews/reviews.controller.ts:54 · apps/web/src/app/(account)/account/reviews/page.tsx:1 | — |
| SPACE | UC-SPACE-01 Duyệt và tìm kiếm không gian mẫu | ✔ | spaces, media, categories | 2/2 (GET /spaces +1) | /spaces | ✅ | apps/api/src/modules/spaces/spaces.controller.ts:26 · apps/web/src/app/(shop)/spaces/page.tsx:1 | — |
| SPACE | UC-SPACE-02 Xem không gian mẫu 360° | ✔ | spaces, space_panoramas, space_hotspots, space_product_placements, products, product_3d_models, model_files, media, space_views | 1/1 (GET /spaces/:x) | /spaces/[slug] | ✅ | apps/api/src/modules/spaces/spaces.controller.ts:43 · apps/web/src/app/(shop)/spaces/[slug]/page.tsx:1 | — |
| SPACE | UC-SPACE-03 Bấm điểm sản phẩm trong phòng mẫu (mua theo phong cách phòng) | ✔ | space_hotspots, products, product_variants | 1/1 (GET /spaces/:x) | /spaces/[slug] | ✅ | apps/api/src/modules/spaces/spaces.controller.ts:43 · apps/web/src/app/(shop)/spaces/[slug]/page.tsx:1 | — |
| SPACE | UC-SPACE-04 Lưu / bỏ lưu không gian mẫu yêu thích | ✔ | space_bookmarks, spaces | 3/3 (PUT /spaces/:x/bookmark +2) | /account/saved-spaces | ✅ | apps/api/src/modules/spaces/spaces.controller.ts:79 · apps/web/src/app/(account)/account/saved-spaces/page.tsx:1 | — |
| SPACE | UC-SPACE-05 Thử đổi món đồ trong phòng mẫu | ✔ | space_product_placements, products, product_3d_models | 1/1 (GET /spaces/:x/placements/:x/alternatives) | /spaces/[slug] | ✅ | apps/api/src/modules/spaces/spaces.controller.ts:50 · apps/web/src/app/(shop)/spaces/[slug]/page.tsx:1 | — |
| SPACE | UC-SPACE-06 Ghi nhận lượt xem không gian mẫu (một lần khi rời trang) | ✔ | space_views | 1/1 (POST /spaces/:x/views) | /products/[slug] | ✅ | apps/api/src/modules/spaces/spaces.controller.ts:60 · apps/web/src/app/(shop)/products/[slug]/page.tsx:1 | — |

### 2.2. Chức năng có trong code nhưng không (hoặc chưa đầy đủ) trong DAC_TA, và phần chưa có

| Chức năng | Loại | Bảng DB | BE | FE | TT | Ghi chú |
|---|---|---|---|---|---|---|
| Xem sản phẩm 360° (xoay ảnh) | ➕ | product_360_configs, product_360_frames | GET /products/:slug/360, GET/PUT /admin/products/:id/360 (admin-products.controller.ts:39,44) | /products/[slug]/360, ProductForm | ✅ | Có trong CHUAN_MO_RONG mục 15; e2e `xem-360` 25/25 |
| Ví mã giảm giá | ➕ | coupons, user_coupons | GET /coupons/me, /coupons/suggested, POST /coupons/save (coupons.controller.ts:14-24) | /account/coupons | ✅ | curl 2026-11-10: 200/200/400 (mã sai); KHÔNG test tự động tham chiếu đường dẫn |
| Hỏi đáp sản phẩm | ➕ | product_questions | GET/POST /products/:slug/questions, /admin/questions | /products/[slug]/360, /admin/questions | ✅ |  |
| Sổ thu/chi, báo cáo tài chính | ➕ | expenses | GET/POST/DELETE /admin/expenses, GET /admin/stats/finance (admin-finance.controller.ts:27-42) | /admin/reports | ✅ | FE không gọi GET/DELETE expenses trực tiếp |
| Phiếu nhập/xuất kho | ➕ | stock_receipts, stock_receipt_items | /admin/inventory/receipts* | /admin/inventory | ✅ |  |
| Đăng nhập Google | ➕ | — | POST /auth/google (auth.service.ts:196) | /login, /register (GoogleButton) | 🟡 | BE LUÔN trả 503 SERVICE_UNAVAILABLE (curl xác nhận); nút FE ghi chú "giả lập" (GoogleButton.tsx:5) |
| Quản trị FAQ | ➕ | faq (settings/pages) | GET/PUT /admin/faq (admin-content.controller.ts:88-93) | — | 🟡 | BE có, KHÔNG có màn hình quản trị; FAQ công khai đọc được |
| Tin nhắn liên hệ (admin) | ➕ | contact_messages | GET /admin/contact-messages, PATCH …/:id/handled (admin-content.controller.ts:100-107) | — | 🟡 | Form liên hệ công khai ✅ (POST /contact); phía admin không có màn hình |
| Bài viết / blog | ➕ | posts | CRUD /admin/posts; GET /posts, GET /posts/:slug | /admin/content (admin) | 🟡 | Admin ✅; công khai: `contentApi.posts` định nghĩa nhưng KHÔNG trang nào dùng, không có route blog/bài viết |
| Sắp xếp banner | ➕ | banners | PATCH /admin/banners/reorder (admin-content.controller.ts:42) | — | 🟡 | BE có, FE không gọi |
| In hóa đơn | ➕ | orders | GET /admin/orders/:code/invoice (admin-orders.controller.ts:41) | — | 🟡 | BE có, FE không gọi |
| Thêm cả bộ không gian vào giỏ | ➕ | carts, cart_items, space_views | POST /spaces/:slug/add-to-cart (spaces.controller.ts:71) | /spaces/[slug] | 🟡 | FE tự lặp `cartApi.addItem` từng món đã chọn (spaces/[slug]/page.tsx:100-101), không gọi endpoint này; món hết hàng giữa chừng sẽ để giỏ thêm dở |
| Cài đặt theo khóa | ➕ | settings | PUT /admin/settings/:key (admin-settings.controller.ts:29) | — | 🟡 | FE chỉ dùng PUT /admin/settings/store |
| Bull Board (hàng đợi) | ➕ | — | /admin/queues (bull-board.middleware.ts) | — | ✅ | Chỉ admin; nhận token qua `?token=` (xem rủi ro) |
| Chế độ dữ liệu giả của FE | ➕ | — | mock-data/mockApi (NEXT_PUBLIC_USE_MOCK) | toàn bộ | 🔴 | Có chủ đích cho dev; `.env.example` của web đặt mặc định `true` |
| Module AI | ⚪ | — | modules/ai (3 tệp 2 dòng) | — | ⚪ | Ngoài phạm vi, chỉ là khung |
| Ứng dụng Android | ⚪ | — | apps/mobile | — | ⚪ | 35 tệp .kt tổng 104 dòng (DTO/service 2 dòng/tệp): khung rỗng, hoãn theo D-P09 |

## 3. Danh sách API Backend

Cách đọc: "Bảng DB" là các model Prisma/bảng SQL tìm thấy trong thân service được gọi (một cấp helper); "—" nghĩa là service không chạm DB trực tiếp (ủy quyền sang service khác, hoặc xử lý tệp/Redis/thanh toán). "FE có gọi" quét văn bản toàn bộ `apps/web/src` (trừ `mock-data`); có thể trùng với liên kết điều hướng (ví dụ AdminSidebar), nên dùng cùng cột "Test" để đánh giá. "Test" = số tệp trong `apps/api/test` (`api`) và `apps/web/tests` (`e2e`) có chuỗi đường dẫn khớp. Cả 210 route đều có thân hàm thật (0 route trả cứng/`501`/`NotImplemented`).

| Method | Path | Auth/Role | Bảng DB (trong service) | FE có gọi không | Trạng thái | Test · File |
|---|---|---|---|---|---|---|
| GET | /health | public | — | ✘ | ✅ | api:3 e2e:0 · health/health.controller.ts:22 |
| GET | /admin/activity-logs | role:admin [manage_settings] | activityLog | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:3 e2e:1 · modules/activity-logs/admin-activity-logs.controller.ts:18 |
| GET | /admin/activity-logs/options | role:admin [manage_settings] | activityLog, sql:users, sql:activity_logs | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/activity-logs/admin-activity-logs.controller.ts:27 |
| GET | /addresses | jwt | address | ✔ web/services/auth.api.ts | ✅ | api:5 e2e:1 · modules/addresses/addresses.controller.ts:13 |
| POST | /addresses | jwt | address, sql:users | ✔ web/services/auth.api.ts | ✅ | api:5 e2e:1 · modules/addresses/addresses.controller.ts:18 |
| PATCH | /addresses/:id/default | jwt | address, sql:users | ✔ web/services/auth.api.ts | ✅ | api:1 e2e:0 · modules/addresses/addresses.controller.ts:24 |
| PATCH | /addresses/:id | jwt | address, sql:users | ✔ web/services/auth.api.ts | ✅ | api:1 e2e:0 · modules/addresses/addresses.controller.ts:29 |
| DELETE | /addresses/:id | jwt | address, sql:users | ✔ web/services/auth.api.ts | ✅ | api:1 e2e:0 · modules/addresses/addresses.controller.ts:34 |
| POST | /admin/notifications | role:admin [manage_content] | user, notification | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:4 e2e:1 · modules/admin-notifications/admin-notifications.controller.ts:16 |
| GET | /admin/roles | role:admin [manage_users] | role | ✔ web/app/admin/customers/[id]/page.tsx (+2) | ✅ | api:2 e2e:1 · modules/admin-roles/admin-roles.controller.ts:17 |
| GET | /admin/stats/finance | role:admin [view_orders] | expense, product, sql:order_items, sql:product_variants, sql:products, sql:categories, sql:orders, sql:order_status_history | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/admin-stats/admin-finance.controller.ts:18 |
| GET | /admin/expenses | role:admin [view_orders] | expense | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/admin-stats/admin-finance.controller.ts:27 |
| POST | /admin/expenses | role:admin [process_orders] | expense | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/admin-stats/admin-finance.controller.ts:35 |
| DELETE | /admin/expenses/:id | role:admin [process_orders] | expense | ✘ | ✅ | api:1 e2e:0 · modules/admin-stats/admin-finance.controller.ts:42 |
| GET | /admin/notifications | role:admin [view_orders] | order, returnRequest, productQuestion, review | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:4 e2e:1 · modules/admin-stats/admin-misc.controller.ts:17 |
| GET | /admin/search | role:admin [manage_products,view_orders,manage_users] | sql:products, sql:orders, sql:users, sql:user_roles, sql:roles | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/admin-stats/admin-misc.controller.ts:23 |
| GET | /admin/stats/overview | role:admin [view_orders] | order, user, product, activityLog, sql:orders, sql:order_items, sql:product_variants | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/admin-stats/admin-stats.controller.ts:21 |
| GET | /admin/stats/spaces | role:admin [manage_content] | space, product, sql:space_views, sql:v, sql:per | ✔ web/services/admin.api.ts | ✅ | api:4 e2e:0 · modules/admin-stats/admin-stats.controller.ts:31 |
| GET | /admin/users | role:admin [manage_users] | user | ✔ web/services/admin.api.ts | ✅ | api:4 e2e:0 · modules/admin-users/admin-users.controller.ts:22 |
| POST | /admin/users | role:admin [manage_users] | user, role | ✔ web/services/admin.api.ts | ✅ | api:4 e2e:0 · modules/admin-users/admin-users.controller.ts:29 |
| GET | /admin/users/:id | role:admin [manage_users] | address, activityLog, user | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/admin-users/admin-users.controller.ts:34 |
| PUT | /admin/users/:id/roles/admin | role:admin [manage_users] | role, userRole, user | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/admin-users/admin-users.controller.ts:39 |
| DELETE | /admin/users/:id/roles/admin | role:admin [manage_users] | role, userRole, user, sql:user_roles, sql:users | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/admin-users/admin-users.controller.ts:45 |
| PATCH | /admin/users/:id/status | role:admin [manage_users] | user, userSession | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/admin-users/admin-users.controller.ts:51 |
| PATCH | /admin/users/:id | role:admin [manage_users] | user | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/admin-users/admin-users.controller.ts:59 |
| GET | /admin/users/:id/orders | role:admin [manage_users] | order, user | ✔ web/services/admin.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/admin-users/admin-users.controller.ts:64 |
| GET | /admin/users/:id/reviews | role:admin [manage_users] | review, user | ✔ web/services/admin.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/admin-users/admin-users.controller.ts:70 |
| GET | /admin/users/:id/wishlist | role:admin [manage_users] | user | ✔ web/services/admin.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/admin-users/admin-users.controller.ts:75 |
| GET | /admin/attributes | role:admin [manage_products] | attribute | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:2 e2e:1 · modules/attributes/admin-attributes.controller.ts:16 |
| POST | /admin/attributes | role:admin [manage_products] | attribute | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:2 e2e:1 · modules/attributes/admin-attributes.controller.ts:22 |
| PATCH | /admin/attributes/:id | role:admin [manage_products] | attribute | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/attributes/admin-attributes.controller.ts:28 |
| DELETE | /admin/attributes/:id | role:admin [manage_products] | attribute | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/attributes/admin-attributes.controller.ts:33 |
| POST | /admin/attributes/:id/values | role:admin [manage_products] | attributeValue, attribute | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/attributes/admin-attributes.controller.ts:39 |
| PATCH | /admin/attributes/:id/values/:valueId | role:admin [manage_products] | attributeValue, attribute | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/attributes/admin-attributes.controller.ts:45 |
| DELETE | /admin/attributes/:id/values/:valueId | role:admin [manage_products] | attributeValue, attribute | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/attributes/admin-attributes.controller.ts:55 |
| POST | /auth/verify-email | public | user | ✔ web/services/auth.api.ts | ✅ | api:2 e2e:0 · modules/auth/auth.controller.ts:19 |
| POST | /auth/resend-verification | jwt | user | ✔ web/services/auth.api.ts | ✅ | api:1 e2e:0 · modules/auth/auth.controller.ts:28 |
| POST | /auth/login | public | user, userSession | ✔ web/services/auth.api.ts | ✅ | api:22 e2e:2 · modules/auth/auth.controller.ts:37 |
| POST | /auth/register | public | role, user, activityLog, userSession | ✔ web/services/auth.api.ts | ✅ | api:8 e2e:0 · modules/auth/auth.controller.ts:51 |
| POST | /auth/refresh | public | userSession, user | ✔ web/services/api-client.ts | ✅ | api:4 e2e:1 · modules/auth/auth.controller.ts:70 |
| POST | /auth/logout | public | userSession | ✔ web/services/auth.api.ts | ✅ | api:2 e2e:0 · modules/auth/auth.controller.ts:79 |
| POST | /auth/forgot-password | public | passwordReset, user | ✔ web/services/auth.api.ts | ✅ | api:3 e2e:0 · modules/auth/auth.controller.ts:89 |
| POST | /auth/reset-password | public | passwordReset, user, userSession | ✔ web/services/auth.api.ts | ✅ | api:2 e2e:0 · modules/auth/auth.controller.ts:99 |
| POST | /auth/google | public | — | ✔ web/services/auth.api.ts | 🟡 luôn 503 | api:0 e2e:0 · modules/auth/auth.controller.ts:109 |
| GET | /admin/brands | role:admin [manage_products] | brand | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:5 e2e:1 · modules/brands/admin-brands.controller.ts:17 |
| GET | /admin/brands/:id | role:admin [manage_products] | brand | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/brands/admin-brands.controller.ts:23 |
| POST | /admin/brands | role:admin [manage_products] | brand | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:5 e2e:1 · modules/brands/admin-brands.controller.ts:28 |
| PATCH | /admin/brands/:id | role:admin [manage_products] | brand | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/brands/admin-brands.controller.ts:34 |
| DELETE | /admin/brands/:id | role:admin [manage_products] | brand, product | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/brands/admin-brands.controller.ts:39 |
| GET | /brands | public | — | ✔ web/services/product.api.ts | ✅ | api:1 e2e:0 · modules/brands/brands.controller.ts:13 |
| GET | /cart | jwt | cart | ✔ web/app/(account)/account/coupons/page.tsx (+7) | ✅ | api:12 e2e:2 · modules/cart/cart.controller.ts:25 |
| DELETE | /cart | jwt | cartItem, cart | ✔ web/app/(account)/account/coupons/page.tsx (+7) | ✅ | api:12 e2e:2 · modules/cart/cart.controller.ts:33 |
| POST | /cart/items | jwt | productVariant, cartItem, cart | ✔ web/services/cart.api.ts | ✅ | api:10 e2e:0 · modules/cart/cart.controller.ts:38 |
| PATCH | /cart/items/:id | jwt | cartItem, cart | ✔ web/services/cart.api.ts | ✅ | api:1 e2e:0 · modules/cart/cart.controller.ts:44 |
| DELETE | /cart/items/:id | jwt | cartItem, cart | ✔ web/services/cart.api.ts | ✅ | api:1 e2e:0 · modules/cart/cart.controller.ts:49 |
| POST | /cart/coupon | jwt | product, cart | ✔ web/services/cart.api.ts | ✅ | api:3 e2e:1 · modules/cart/cart.controller.ts:54 |
| DELETE | /cart/coupon | jwt | cart | ✔ web/services/cart.api.ts | ✅ | api:3 e2e:1 · modules/cart/cart.controller.ts:61 |
| GET | /admin/categories | role:admin [manage_products] | — | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:3 e2e:2 · modules/categories/admin-categories.controller.ts:16 |
| POST | /admin/categories | role:admin [manage_products] | category | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:3 e2e:2 · modules/categories/admin-categories.controller.ts:21 |
| PATCH | /admin/categories/:id | role:admin [manage_products] | category | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/categories/admin-categories.controller.ts:26 |
| DELETE | /admin/categories/:id | role:admin [manage_products] | category, product | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/categories/admin-categories.controller.ts:31 |
| GET | /categories | public | category, product | ✔ web/services/product.api.ts | ✅ | api:2 e2e:0 · modules/categories/categories.controller.ts:13 |
| GET | /admin/coupons | role:admin [manage_content] | coupon | ✔ web/services/admin.api.ts | ✅ | api:5 e2e:0 · modules/coupons/admin-coupons.controller.ts:18 |
| POST | /admin/coupons | role:admin [manage_content] | coupon, couponScope | ✔ web/services/admin.api.ts | ✅ | api:5 e2e:0 · modules/coupons/admin-coupons.controller.ts:27 |
| GET | /admin/coupons/:id | role:admin [manage_content] | coupon | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/coupons/admin-coupons.controller.ts:32 |
| PATCH | /admin/coupons/:id | role:admin [manage_content] | coupon, couponScope | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/coupons/admin-coupons.controller.ts:37 |
| DELETE | /admin/coupons/:id | role:admin [manage_content] | coupon, couponUsage, cart | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/coupons/admin-coupons.controller.ts:42 |
| GET | /coupons/me | jwt | userCoupon, couponUsage | ✔ web/services/cart.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/coupons/coupons.controller.ts:14 |
| GET | /coupons/suggested | jwt | userCoupon, coupon | ✔ web/services/cart.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/coupons/coupons.controller.ts:19 |
| POST | /coupons/save | jwt | coupon, userCoupon | ✔ web/services/cart.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/coupons/coupons.controller.ts:24 |
| GET | /admin/inventory | role:admin [manage_products] | category, productVariant | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:2 e2e:2 · modules/inventory/admin-inventory.controller.ts:18 |
| GET | /admin/inventory/summary | role:admin [manage_products] | productVariant | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/inventory/admin-inventory.controller.ts:27 |
| GET | /admin/inventory/movements | role:admin [manage_products] | inventoryMovement | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/inventory/admin-inventory.controller.ts:33 |
| POST | /admin/inventory/movements | role:admin [manage_products] | inventoryMovement | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/inventory/admin-inventory.controller.ts:40 |
| GET | /admin/inventory/receipts | role:admin [manage_products] | stockReceipt | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/inventory/admin-inventory.controller.ts:49 |
| GET | /admin/inventory/receipts/:id | role:admin [manage_products] | stockReceipt | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/inventory/admin-inventory.controller.ts:55 |
| POST | /admin/inventory/receipts | role:admin [manage_products] | productVariant, stockReceipt, expense, sql:stock_receipts | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/inventory/admin-inventory.controller.ts:61 |
| POST | /admin/inventory/receipts/:id/confirm | role:admin [manage_products] | stockReceipt, expense, sql:stock_receipts | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/inventory/admin-inventory.controller.ts:70 |
| POST | /admin/inventory/receipts/:id/cancel | role:admin [manage_products] | stockReceipt, sql:stock_receipts | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/inventory/admin-inventory.controller.ts:77 |
| POST | /admin/media | role:admin [manage_products,manage_content] | — | ✔ web/components/admin/AdminSidebar.tsx (+3) | ✅ | api:6 e2e:1 · modules/media/admin-media.controller.ts:38 |
| POST | /admin/media/presign | role:admin [manage_products,manage_content] | — | ✔ web/services/media.api.ts | ✅ | api:2 e2e:0 · modules/media/admin-media.controller.ts:55 |
| POST | /admin/media/confirm | role:admin [manage_products,manage_content] | media | ✔ web/services/media.api.ts | ✅ | api:2 e2e:0 · modules/media/admin-media.controller.ts:62 |
| GET | /admin/media/upload-config | role:admin [manage_products,manage_content] | — | ✔ web/services/direct-upload.ts | ✅ | api:1 e2e:0 · modules/media/admin-media.controller.ts:69 |
| GET | /admin/media | role:admin [manage_products,manage_content] | media | ✔ web/components/admin/AdminSidebar.tsx (+3) | ✅ | api:6 e2e:1 · modules/media/admin-media.controller.ts:75 |
| PATCH | /admin/media/:id | role:admin [manage_products,manage_content] | media | ✔ web/services/admin.api.ts (+2) | ✅ | api:4 e2e:0 · modules/media/admin-media.controller.ts:82 |
| DELETE | /admin/media/:id | role:admin [manage_products,manage_content] | media | ✔ web/services/admin.api.ts (+2) | ✅ | api:4 e2e:0 · modules/media/admin-media.controller.ts:88 |
| GET | /notifications | jwt | notification | ✔ web/services/content.api.ts | ✅ | api:3 e2e:1 · modules/notifications/notifications.controller.ts:15 |
| GET | /notifications/unread-count | jwt | notification | ✔ web/services/content.api.ts | ✅ | api:1 e2e:0 · modules/notifications/notifications.controller.ts:21 |
| PATCH | /notifications/read-all | jwt | notification | ✔ web/services/content.api.ts | ✅ | api:1 e2e:0 · modules/notifications/notifications.controller.ts:27 |
| PATCH | /notifications/:id/read | jwt | notification | ✔ web/services/content.api.ts | ✅ | api:2 e2e:0 · modules/notifications/notifications.controller.ts:32 |
| GET | /admin/orders | role:admin [view_orders] | order, sql:orders, sql:users | ✔ web/app/admin/customers/[id]/page.tsx (+7) | ✅ | api:10 e2e:4 · modules/orders/admin-orders.controller.ts:19 |
| POST | /admin/orders | role:admin [process_orders] | user, address | ✔ web/app/admin/customers/[id]/page.tsx (+7) | ✅ | api:10 e2e:4 · modules/orders/admin-orders.controller.ts:26 |
| GET | /admin/orders/counts | role:admin [view_orders] | — | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/orders/admin-orders.controller.ts:35 |
| GET | /admin/orders/:code/invoice | role:admin [view_orders] | setting | ✘ | ✅ | api:1 e2e:0 · modules/orders/admin-orders.controller.ts:41 |
| GET | /admin/orders/:code | role:admin [view_orders] | order | ✔ web/app/admin/customers/[id]/page.tsx (+5) | ✅ | api:9 e2e:1 · modules/orders/admin-orders.controller.ts:48 |
| PATCH | /admin/orders/:id/status | role:admin [process_orders] | shipment, order, sql:orders | ✔ web/services/admin.api.ts | ✅ | api:8 e2e:0 · modules/orders/admin-orders.controller.ts:53 |
| POST | /admin/orders/:id/cancel | role:admin [process_orders] | order | ✔ web/services/admin.api.ts | ✅ | api:6 e2e:0 · modules/orders/admin-orders.controller.ts:59 |
| POST | /admin/orders/:id/refund | role:admin [process_orders] | order, payment, expense, sql:orders | ✔ web/services/admin.api.ts | ✅ | api:4 e2e:0 · modules/orders/admin-orders.controller.ts:65 |
| PATCH | /admin/orders/:id/note | role:admin [process_orders] | order | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/orders/admin-orders.controller.ts:71 |
| POST | /orders | jwt | address, cart, product, coupon, order, productVariant, orderItem, inventoryMovement, payment, couponUsage, cartItem, activityLog, sql:product_variants, sql:coupons | ✔ web/services/cart.api.ts | ✅ | api:10 e2e:2 · modules/orders/orders.controller.ts:15 |
| GET | /orders | jwt | order | ✔ web/services/cart.api.ts | ✅ | api:10 e2e:2 · modules/orders/orders.controller.ts:24 |
| GET | /orders/counts | jwt | order | ✔ web/services/cart.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/orders/orders.controller.ts:31 |
| GET | /orders/:code | jwt | order | ✔ web/services/cart.api.ts | ✅ | api:7 e2e:1 · modules/orders/orders.controller.ts:36 |
| POST | /orders/:id/cancel | jwt | order, shipment, orderItem, productVariant, inventoryMovement, couponUsage, coupon, payment, sql:orders | ✔ web/services/cart.api.ts | ✅ | api:6 e2e:0 · modules/orders/orders.controller.ts:41 |
| GET | /admin/banners | role:admin [manage_content] | banner | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/pages/admin-content.controller.ts:31 |
| POST | /admin/banners | role:admin [manage_content] | banner | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/pages/admin-content.controller.ts:36 |
| PATCH | /admin/banners/reorder | role:admin [manage_content] | banner | ✘ | ✅ | api:2 e2e:0 · modules/pages/admin-content.controller.ts:42 |
| PATCH | /admin/banners/:id | role:admin [manage_content] | banner | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/pages/admin-content.controller.ts:48 |
| DELETE | /admin/banners/:id | role:admin [manage_content] | banner | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/pages/admin-content.controller.ts:57 |
| GET | /admin/posts | role:admin [manage_content] | post | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/pages/admin-content.controller.ts:63 |
| POST | /admin/posts | role:admin [manage_content] | post, user | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/pages/admin-content.controller.ts:68 |
| PATCH | /admin/posts/:id | role:admin [manage_content] | post, user | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/pages/admin-content.controller.ts:73 |
| DELETE | /admin/posts/:id | role:admin [manage_content] | post | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/pages/admin-content.controller.ts:82 |
| GET | /admin/faq | role:admin [manage_content] | — | ✘ | ✅ | api:2 e2e:0 · modules/pages/admin-content.controller.ts:88 |
| PUT | /admin/faq | role:admin [manage_content] | setting | ✘ | ✅ | api:2 e2e:0 · modules/pages/admin-content.controller.ts:93 |
| GET | /admin/contact-messages | role:admin [manage_content] | contactMessage | ✘ | ✅ | api:1 e2e:0 · modules/pages/admin-content.controller.ts:100 |
| PATCH | /admin/contact-messages/:id/handled | role:admin [manage_content] | contactMessage | ✘ | ✅ | api:1 e2e:0 · modules/pages/admin-content.controller.ts:107 |
| GET | /admin/pages | role:admin [manage_content] | page | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/pages/admin-pages.controller.ts:16 |
| POST | /admin/pages | role:admin [manage_content] | page | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/pages/admin-pages.controller.ts:21 |
| PATCH | /admin/pages/:id | role:admin [manage_content] | page | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/pages/admin-pages.controller.ts:26 |
| DELETE | /admin/pages/:id | role:admin [manage_content] | page | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/pages/admin-pages.controller.ts:31 |
| GET | /banners | public | banner | ✔ web/services/content.api.ts | ✅ | api:2 e2e:0 · modules/pages/content.controller.ts:14 |
| GET | /posts | public | post | ✔ web/services/content.api.ts | ✅ | api:1 e2e:0 · modules/pages/content.controller.ts:21 |
| GET | /posts/:slug | public | post | ✘ | ✅ | api:1 e2e:0 · modules/pages/content.controller.ts:27 |
| GET | /faq | public | — | ✔ web/app/not-found.tsx (+2) | ✅ | api:1 e2e:1 · modules/pages/content.controller.ts:33 |
| POST | /contact | public | contactMessage | ✔ web/app/(account)/account/orders/[code]/page.tsx (+5) | ✅ | api:1 e2e:1 · modules/pages/content.controller.ts:42 |
| GET | /settings/public | public | setting | ✔ web/services/content.api.ts | ✅ | api:2 e2e:0 · modules/pages/content.controller.ts:49 |
| GET | /pages | public | page | ✔ web/services/content.api.ts | ✅ | api:3 e2e:0 · modules/pages/pages.controller.ts:13 |
| GET | /pages/:slug | public | page | ✔ web/services/content.api.ts | ✅ | api:3 e2e:0 · modules/pages/pages.controller.ts:21 |
| GET | /admin/panoramas/:id/placements | role:admin [manage_content] | spaceProductPlacement, spacePanorama | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/panoramas/admin-panoramas.controller.ts:16 |
| POST | /admin/panoramas/:id/placements | role:admin [manage_content] | spaceProductPlacement, spacePanorama, product, productVariant, product3DModel | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/panoramas/admin-panoramas.controller.ts:22 |
| PATCH | /admin/panoramas/:id/placements/:placementId | role:admin [manage_content] | spaceProductPlacement, spacePanorama, product, productVariant, product3DModel | ✔ web/services/admin.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/panoramas/admin-panoramas.controller.ts:31 |
| DELETE | /admin/panoramas/:id/placements/:placementId | role:admin [manage_content] | spaceProductPlacement, spacePanorama | ✔ web/services/admin.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/panoramas/admin-panoramas.controller.ts:42 |
| GET | /admin/payments | role:admin [process_orders] | payment, user | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:5 e2e:1 · modules/payments/admin-payments.controller.ts:18 |
| PATCH | /admin/payments/:id/confirm | role:admin [process_orders] | payment, order | ✔ web/services/admin.api.ts | ✅ | api:5 e2e:0 · modules/payments/admin-payments.controller.ts:25 |
| PATCH | /admin/payments/:id/fail | role:admin [process_orders] | payment, order | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/payments/admin-payments.controller.ts:35 |
| GET | /payments/vnpay/return | public | order | ✘ | ✅ | api:1 e2e:0 · modules/payments/payments.controller.ts:17 |
| GET | /payments/vnpay/ipn | public | order | ✘ | ✅ | api:1 e2e:0 · modules/payments/payments.controller.ts:27 |
| POST | /payments/:orderId/checkout | jwt | order | ✔ web/services/cart.api.ts | ✅ | api:3 e2e:1 · modules/payments/payments.controller.ts:36 |
| POST | /payments/:orderId/retry | jwt | payment, order | ✔ web/services/cart.api.ts | ✅ | api:2 e2e:0 · modules/payments/payments.controller.ts:50 |
| GET | /admin/models | role:admin [manage_products] | product3DModel, activityLog | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:8 e2e:5 · modules/product-models/admin-models.controller.ts:45 |
| POST | /admin/models | role:admin [manage_products] | — | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:8 e2e:5 · modules/product-models/admin-models.controller.ts:52 |
| POST | /admin/models/upload | role:admin [manage_products] | — | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/product-models/admin-models.controller.ts:62 |
| DELETE | /admin/models/model/:modelId | role:admin [manage_products] | product3DModel, modelFile, modelMaterialVariant, media | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/product-models/admin-models.controller.ts:90 |
| DELETE | /admin/models/:id | role:admin [manage_products] | modelFile, product3DModel, modelMaterialVariant, media | ✔ web/services/admin.api.ts | ✅ | api:6 e2e:1 · modules/product-models/admin-models.controller.ts:96 |
| POST | /admin/models/presign | role:admin [manage_products] | — | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:1 · modules/product-models/admin-models.controller.ts:105 |
| POST | /admin/models/:id/reprocess | role:admin [manage_products] | product3DModel, activityLog | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:111 |
| PATCH | /admin/models/:id/primary | role:admin [manage_products] | product3DModel | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:120 |
| POST | /admin/models/:id/files/presign | role:admin [manage_products] | product3DModel | ✘ | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:127 |
| POST | /admin/models/:id/files/confirm | role:admin [manage_products] | product3DModel | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:134 |
| GET | /admin/models/:id/materials | role:admin [manage_products] | modelFile, product3DModel | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/product-models/admin-models.controller.ts:145 |
| GET | /admin/models/:id/material-variants | role:admin [manage_products] | modelMaterialVariant, product3DModel | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:151 |
| PUT | /admin/models/:id/material-variants/:variantId | role:admin [manage_products] | productVariant, modelMaterialVariant, product3DModel | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:157 |
| DELETE | /admin/models/:id/material-variants/:variantId | role:admin [manage_products] | modelMaterialVariant, product3DModel | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/product-models/admin-models.controller.ts:170 |
| GET | /admin/products | role:admin [manage_products] | product, category | ✔ web/app/admin/page.tsx (+5) | ✅ | api:7 e2e:5 · modules/products/admin-products.controller.ts:18 |
| POST | /admin/products | role:admin [manage_products] | product, category, brand, productVariant, productImage, productSpec, sql:products | ✔ web/app/admin/page.tsx (+5) | ✅ | api:7 e2e:5 · modules/products/admin-products.controller.ts:28 |
| GET | /admin/products/:id | role:admin [manage_products] | product | ✔ web/app/admin/page.tsx (+5) | ✅ | api:4 e2e:4 · modules/products/admin-products.controller.ts:34 |
| GET | /admin/products/:id/360 | role:admin [manage_products] | product360Config, product | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/products/admin-products.controller.ts:39 |
| PUT | /admin/products/:id/360 | role:admin [manage_products] | product360Config, product360Frame, product, attribute, attributeValue | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/products/admin-products.controller.ts:44 |
| PATCH | /admin/products/:id | role:admin [manage_products] | product, category, brand, productVariant, productImage, productSpec, sql:products | ✔ web/app/admin/page.tsx (+5) | ✅ | api:4 e2e:4 · modules/products/admin-products.controller.ts:52 |
| DELETE | /admin/products/:id | role:admin [manage_products] | orderItem, product, wishlist, cartItem | ✔ web/app/admin/page.tsx (+5) | ✅ | api:4 e2e:4 · modules/products/admin-products.controller.ts:57 |
| GET | /products | public | — | ✔ web/app/(account)/account/orders/page.tsx (+21) | ✅ | api:12 e2e:9 · modules/products/products.controller.ts:20 |
| GET | /products/search | public | — | ✔ web/services/product.api.ts | ✅ | api:1 e2e:1 · modules/products/products.controller.ts:28 |
| GET | /products/facets | public | — | ✔ web/services/product.api.ts | ✅ | api:1 e2e:0 · modules/products/products.controller.ts:36 |
| GET | /products/:slug | public | product | ✔ web/app/(account)/account/orders/[code]/page.tsx (+12) | ✅ | api:11 e2e:9 · modules/products/products.controller.ts:43 |
| GET | /products/:slug/model | public | product | ✔ web/services/product.api.ts | ✅ | api:5 e2e:0 · modules/products/products.controller.ts:50 |
| GET | /products/:slug/360 | public | product360Config, productVariant | ✔ web/services/product.api.ts | ✅ | api:4 e2e:3 · modules/products/products.controller.ts:56 |
| GET | /products/:slug/related | public | product | ✔ web/services/product.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/products/products.controller.ts:63 |
| GET | /admin/returns | role:admin [process_orders] | returnRequest | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:3 e2e:2 · modules/returns/admin-returns.controller.ts:18 |
| PATCH | /admin/returns/:id | role:admin [process_orders] | returnRequest, productVariant, inventoryMovement, expense, orderItem, returnRequestItem, order, payment, sql:return_requests, sql:product_variants | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/returns/admin-returns.controller.ts:25 |
| GET | /returns | jwt | returnRequest | ✔ web/services/cart.api.ts | ✅ | api:2 e2e:0 · modules/returns/returns.controller.ts:15 |
| POST | /returns | jwt | order, returnRequestItem, productVariant, returnRequest | ✔ web/services/cart.api.ts | ✅ | api:2 e2e:0 · modules/returns/returns.controller.ts:22 |
| GET | /admin/questions | role:admin [manage_content] | productQuestion | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:1 e2e:2 · modules/reviews/admin-questions.controller.ts:18 |
| PATCH | /admin/questions/:id | role:admin [manage_content] | productQuestion | ✔ web/services/admin.api.ts | ✅ | api:1 e2e:0 · modules/reviews/admin-questions.controller.ts:25 |
| GET | /admin/reviews | role:admin [manage_content] | review | ✔ web/components/admin/AdminSidebar.tsx (+1) | ✅ | api:3 e2e:2 · modules/reviews/admin-reviews.controller.ts:18 |
| PATCH | /admin/reviews/:id/status | role:admin [manage_content] | review | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/reviews/admin-reviews.controller.ts:27 |
| GET | /products/:slug/reviews | public | review | ✔ web/services/product.api.ts | ✅ | api:3 e2e:0 · modules/reviews/reviews.controller.ts:19 |
| POST | /products/:slug/reviews | jwt | user, order, review, activityLog | ✔ web/services/product.api.ts | ✅ | api:3 e2e:0 · modules/reviews/reviews.controller.ts:27 |
| GET | /products/:slug/questions | public | productQuestion | ✔ web/services/product.api.ts | ✅ | api:1 e2e:0 · modules/reviews/reviews.controller.ts:34 |
| POST | /products/:slug/questions | jwt | productQuestion | ✔ web/services/product.api.ts | ✅ | api:1 e2e:0 · modules/reviews/reviews.controller.ts:41 |
| GET | /reviews/me | jwt | review | ✔ web/services/cart.api.ts | ✅ | api:2 e2e:0 · modules/reviews/reviews.controller.ts:48 |
| PATCH | /reviews/:id | jwt | review | ✔ web/services/cart.api.ts | ✅ | api:3 e2e:0 · modules/reviews/reviews.controller.ts:54 |
| DELETE | /reviews/:id | jwt | review | ✔ web/services/cart.api.ts | ✅ | api:3 e2e:0 · modules/reviews/reviews.controller.ts:60 |
| GET | /admin/settings | role:admin [manage_settings] | setting | ✔ web/app/admin/settings/page.tsx (+2) | ✅ | api:4 e2e:2 · modules/settings/admin-settings.controller.ts:16 |
| PUT | /admin/settings/store | role:admin [manage_settings] | setting | ✔ web/services/admin.api.ts | ✅ | api:2 e2e:0 · modules/settings/admin-settings.controller.ts:23 |
| PUT | /admin/settings/:key | role:admin [manage_settings] | setting | ✔ web/services/admin.api.ts | ✅ | api:3 e2e:0 · modules/settings/admin-settings.controller.ts:29 |
| POST | /admin/orders/:id/shipments | role:admin [process_orders] | shipment, order, sql:orders | ✔ web/services/admin.api.ts | ✅ | api:7 e2e:0 · modules/shipments/admin-shipments.controller.ts:16 |
| PATCH | /admin/shipments/:id | role:admin [process_orders] | shipment, order, sql:shipments | ✔ web/services/admin.api.ts | ✅ | api:5 e2e:0 · modules/shipments/admin-shipments.controller.ts:26 |
| GET | /admin/spaces | role:admin [manage_content] | space | ✔ web/app/admin/spaces/page.tsx (+3) | ✅ | api:5 e2e:4 · modules/spaces/admin-spaces.controller.ts:18 |
| POST | /admin/spaces | role:admin [manage_content] | space, spaceHotspot, spaceProductPlacement, spacePanorama, product | ✔ web/app/admin/spaces/page.tsx (+3) | ✅ | api:5 e2e:4 · modules/spaces/admin-spaces.controller.ts:25 |
| GET | /admin/spaces/:id | role:admin [manage_content] | — | ✔ web/app/admin/spaces/page.tsx (+1) | ✅ | api:3 e2e:4 · modules/spaces/admin-spaces.controller.ts:34 |
| PATCH | /admin/spaces/:id | role:admin [manage_content] | space, spaceHotspot, spaceProductPlacement, spacePanorama, product | ✔ web/app/admin/spaces/page.tsx (+1) | ✅ | api:3 e2e:4 · modules/spaces/admin-spaces.controller.ts:39 |
| DELETE | /admin/spaces/:id | role:admin [manage_content] | space, couponScope, spaceHotspot, spaceProductPlacement, spacePanorama, spaceBookmark, spaceView | ✔ web/app/admin/spaces/page.tsx (+1) | ✅ | api:3 e2e:4 · modules/spaces/admin-spaces.controller.ts:44 |
| GET | /spaces | public | product, space, spaceBookmark | ✔ web/app/(account)/account/saved-spaces/page.tsx (+11) | ✅ | api:7 e2e:6 · modules/spaces/spaces.controller.ts:26 |
| GET | /spaces/facets | public | space | ✔ web/services/space.api.ts | ✅ (chưa có test tham chiếu; đã curl 200) | api:0 e2e:0 · modules/spaces/spaces.controller.ts:37 |
| GET | /spaces/:slug | public | space, product | ✔ web/app/(shop)/products/[slug]/page.tsx (+3) | ✅ | api:5 e2e:4 · modules/spaces/spaces.controller.ts:43 |
| GET | /spaces/:slug/placements/:placementId/alternatives | public | spaceProductPlacement, product | ✔ web/services/space.api.ts | ✅ | api:2 e2e:0 · modules/spaces/spaces.controller.ts:50 |
| POST | /spaces/:slug/views | public | space, user, product, spaceView | ✔ web/services/space.api.ts | ✅ | api:3 e2e:0 · modules/spaces/spaces.controller.ts:60 |
| POST | /spaces/:slug/add-to-cart | jwt | space, product | ✘ | ✅ | api:2 e2e:0 · modules/spaces/spaces.controller.ts:71 |
| PUT | /spaces/:slug/bookmark | jwt | spaceBookmark, space | ✔ web/services/space.api.ts | ✅ | api:2 e2e:0 · modules/spaces/spaces.controller.ts:79 |
| DELETE | /spaces/:slug/bookmark | jwt | space, spaceBookmark | ✔ web/services/space.api.ts | ✅ | api:2 e2e:0 · modules/spaces/spaces.controller.ts:85 |
| GET | /users/me | jwt | user, sql:orders | ✔ web/services/auth.api.ts | ✅ | api:6 e2e:0 · modules/users/users.controller.ts:13 |
| PATCH | /users/me | jwt | user | ✔ web/services/auth.api.ts | ✅ | api:6 e2e:0 · modules/users/users.controller.ts:19 |
| GET | /users/me/sessions | jwt | userSession | ✔ web/services/auth.api.ts | ✅ | api:2 e2e:0 · modules/users/users.controller.ts:25 |
| DELETE | /users/me/sessions/:id | jwt | userSession | ✔ web/services/auth.api.ts | ✅ | api:2 e2e:0 · modules/users/users.controller.ts:33 |
| DELETE | /users/me | jwt | user, order, userSession | ✔ web/services/auth.api.ts | ✅ | api:6 e2e:0 · modules/users/users.controller.ts:40 |
| POST | /users/me/change-password | jwt | user, userSession | ✔ web/services/auth.api.ts | ✅ | api:3 e2e:0 · modules/users/users.controller.ts:49 |
| GET | /wishlist | jwt | wishlist | ✔ web/components/layout/AccountSidebar.tsx (+2) | ✅ | api:3 e2e:2 · modules/wishlist/wishlist.controller.ts:13 |
| PUT | /wishlist/:slug | jwt | product, wishlist | ✔ web/services/product.api.ts | ✅ | api:2 e2e:0 · modules/wishlist/wishlist.controller.ts:18 |
| DELETE | /wishlist/:slug | jwt | product, wishlist | ✔ web/services/product.api.ts | ✅ | api:2 e2e:0 · modules/wishlist/wishlist.controller.ts:23 |

## 4. Danh sách màn hình Frontend

"Dùng mock?" = trang có nhập `mock-data` trực tiếp. Ngoài ra mọi lời gọi đi qua `request()` và chỉ rẽ sang mock khi `NEXT_PUBLIC_USE_MOCK=true`. Một số trang chỉ bọc component (`/products`, `/search`, `/admin/products/new`, `/admin/spaces/[id]`…): đã truy vào component (tối đa 2 cấp import) để lấy danh sách API.

| Route | Màn hình (tệp) | API đang gọi | Dùng mock? | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| /account/coupons | web/app/(account)/account/coupons/page.tsx (144 dòng) | couponApi.mine, couponApi.save | Không | ✅ | — |
| /account/notifications | web/app/(account)/account/notifications/page.tsx (149 dòng) | notificationApi.list, notificationApi.markRead, cartApi.get, cartApi.addItem (+3) | Không | ✅ | — |
| /account/orders | web/app/(account)/account/orders/page.tsx (100 dòng) | orderApi.list, myReviewApi.update, productApi.createReview | Không | ✅ | — |
| /account/orders/[code] | web/app/(account)/account/orders/[code]/page.tsx (296 dòng) | orderApi.detail, orderApi.cancel, cartApi.addItem, orderApi.retryPayment (+6) | Không | ✅ | — |
| /account/password | web/app/(account)/account/password/page.tsx (125 dòng) | userApi.changePassword | Không | ✅ | — |
| /account/profile | web/app/(account)/account/profile/page.tsx (379 dòng) | userApi.update, addressApi.setDefault, addressApi.remove, orderApi.list (+4) | Không | ✅ | — |
| /account/returns/new | web/app/(account)/account/returns/new/page.tsx (351 dòng) | orderApi.detail, returnApi.list, returnApi.create | Không | ✅ | — |
| /account/returns | web/app/(account)/account/returns/page.tsx (112 dòng) | returnApi.list | Không | ✅ | — |
| /account/reviews | web/app/(account)/account/reviews/page.tsx (40 dòng) | myReviewApi.update, productApi.createReview | Không | ✅ | — |
| /account/saved-spaces | web/app/(account)/account/saved-spaces/page.tsx (92 dòng) | spaceApi.list, spaceApi.unbookmark, spaceApi.bookmark, authApi.logout | Không | ✅ | — |
| /account/sessions | web/app/(account)/account/sessions/page.tsx (78 dòng) | userApi.sessions, userApi.revokeSession | Không | ✅ | — |
| /forgot-password | web/app/(auth)/forgot-password/page.tsx (82 dòng) | authApi.forgotPassword | Không | ✅ | — |
| /login | web/app/(auth)/login/page.tsx (126 dòng) | authApi.login | Không | ✅ | — |
| /register | web/app/(auth)/register/page.tsx (158 dòng) | authApi.register | Không | ✅ | — |
| /reset-password | web/app/(auth)/reset-password/page.tsx (140 dòng) | authApi.resetPassword | Không | ✅ | — |
| /verify-email | web/app/(auth)/verify-email/page.tsx (77 dòng) | — | Không | ✅ | — |
| /about | web/app/(shop)/about/page.tsx (128 dòng) | contentApi.page | Không | 🟡 | Số liệu & đội ngũ viết cứng (about/page.tsx:11-28: "50.000+ khách hàng"…, tên 4 người); ảnh `/mock-img/*` (dòng 36,65,100); chỉ phần nội dung trang lấy từ API |
| /cart | web/app/(shop)/cart/page.tsx (302 dòng) | productApi.list, cartApi.applyCoupon, authApi.logout, cartApi.get (+4) | Không | ✅ | — |
| /checkout/failed | web/app/(shop)/checkout/failed/page.tsx (143 dòng) | orderApi.detail, orderApi.retryPayment, authApi.logout | Không | ✅ | — |
| /checkout | web/app/(shop)/checkout/page.tsx (389 dòng) | cartApi.get, orderApi.create, orderApi.checkout, addressApi.update (+6) | Không | ✅ | — |
| /checkout/success | web/app/(shop)/checkout/success/page.tsx (156 dòng) | orderApi.detail, couponApi.save, authApi.logout | Không | ✅ | — |
| /contact | web/app/(shop)/contact/page.tsx (160 dòng) | contentApi.contact | Không | 🟡 | Danh sách showroom viết cứng (contact/page.tsx:31); gửi liên hệ dùng API thật |
| /faq | web/app/(shop)/faq/page.tsx (131 dòng) | — | Không | ✅ | — |
| /policies/[slug] | web/app/(shop)/policies/[slug]/page.tsx (97 dòng) | contentApi.page | Không | ✅ | — |
| /products | web/app/(shop)/products/page.tsx (14 dòng) | productApi.search, productApi.list, productApi.facets, productApi.detail | Không | ✅ | — |
| /products/[slug]/360 | web/app/(shop)/products/[slug]/360/page.tsx (635 dòng) | productApi.view360, productApi.reviews, productApi.questions, productApi.related (+9) | Không | ✅ | — |
| /products/[slug] | web/app/(shop)/products/[slug]/page.tsx (200 dòng) | productApi.related, spaceApi.list, productApi.view360, productApi.reviews (+12) | Không | ✅ | — |
| /search | web/app/(shop)/search/page.tsx (14 dòng) | productApi.search, productApi.list, productApi.facets, productApi.detail | Không | ✅ | — |
| /spaces | web/app/(shop)/spaces/page.tsx (202 dòng) | spaceApi.unbookmark, spaceApi.bookmark, spaceApi.list, spaceApi.detail (+1) | Không | ✅ | — |
| /spaces/[slug] | web/app/(shop)/spaces/[slug]/page.tsx (519 dòng) | spaceApi.alternatives, spaceApi.sendViewBeacon, cartApi.addItem, spaceApi.unbookmark (+8) | Không | 🟡 | Thêm bộ vào giỏ bằng nhiều lần `cartApi.addItem` thay vì POST /spaces/:slug/add-to-cart |
| /wishlist | web/app/(shop)/wishlist/page.tsx (92 dòng) | authApi.logout, cartApi.get, cartApi.addItem, cartApi.updateItem (+2) | Không | ✅ | — |
| /products/[slug]/3d | web/app/(viewer)/products/[slug]/3d/page.tsx (188 dòng) | cartApi.get, cartApi.addItem, cartApi.updateItem, wishlistApi.add (+5) | Không | ✅ | — |
| /admin/activity-logs | web/app/admin/activity-logs/page.tsx (148 dòng) | adminApi.activityLogs.options, adminApi.activityLogs.list | Không | ✅ | — |
| /admin/attributes | web/app/admin/attributes/page.tsx (409 dòng) | adminApi.attributes.update, adminApi.attributes.create, adminApi.attributes.updateValue, adminApi.attributes.addValue (+2) | Không | ✅ | — |
| /admin/brands | web/app/admin/brands/page.tsx (282 dòng) | adminApi.brands.update, adminApi.brands.create, adminApi.brands.list, adminApi.brands.remove | Không | ✅ | — |
| /admin/categories | web/app/admin/categories/page.tsx (345 dòng) | adminApi.categories.update, adminApi.categories.create, adminApi.categories.remove | Không | ✅ | — |
| /admin/content | web/app/admin/content/page.tsx (622 dòng) | adminApi.content.saveBanner, adminApi.content.removeBanner, adminApi.content.savePost, adminApi.content.removePost (+1) | Không | 🟡 | Không có UI tạo/xóa trang tĩnh, sắp xếp banner, quản trị FAQ, tin nhắn liên hệ (BE đã có) |
| /admin/customers | web/app/admin/customers/page.tsx (233 dòng) | adminApi.customers.create, adminApi.customers.list, adminApi.customers.setStatus | Không | ✅ | — |
| /admin/customers/[id] | web/app/admin/customers/[id]/page.tsx (406 dòng) | adminApi.customers.get, adminApi.customers.orders, adminApi.customers.reviews, adminApi.customers.wishlist (+9) | Không | ✅ | — |
| /admin/dashboard | web/app/admin/dashboard/page.tsx (7 dòng) | — | Không | ✅ | — |
| /admin/inventory | web/app/admin/inventory/page.tsx (488 dòng) | adminApi.inventory.rows, adminApi.inventory.createReceipt, adminApi.inventory.movements, adminApi.inventory.confirmReceipt (+5) | Không | 🟡 | Thiếu thao tác điều chỉnh tồn trực tiếp (POST /admin/inventory/movements) |
| /admin/login | web/app/admin/login/page.tsx (135 dòng) | authApi.login | Không | ✅ | Ảnh nền `/mock-img/banner…` (login/page.tsx:56) |
| /admin/media | web/app/admin/media/page.tsx (275 dòng) | adminApi.media.update, adminApi.media.list, adminApi.media.remove, adminApi.media.upload | Không | ✅ | — |
| /admin/models | web/app/admin/models/page.tsx (455 dòng) | adminApi.products.list, adminApi.models.upload, adminApi.models.list, adminApi.models.removeModel (+8) | Không | 🟡 | Ô "Xem trước 360°" cố định `/mock/models/sofa.glb` (admin/models/page.tsx:189), tệp không tồn tại trong public/mock/models (chỉ có armchair.glb) và không phụ thuộc tệp đã chọn |
| /admin/notifications | web/app/admin/notifications/page.tsx (183 dòng) | adminApi.customers.list, adminApi.notify.send | Không | ✅ | — |
| /admin/orders | web/app/admin/orders/page.tsx (315 dòng) | adminApi.customers.list, adminApi.inventory.rows, adminApi.orders.create, adminApi.orders.list | Không | ✅ | — |
| /admin/orders/[code] | web/app/admin/orders/[code]/page.tsx (625 dòng) | adminApi.orders.get, adminApi.orders.setStatus, adminApi.orders.cancel, adminApi.orders.refund (+5) | Không | ✅ | — |
| /admin | web/app/admin/page.tsx (326 dòng) | adminApi.stats | Không | ✅ | — |
| /admin/payments | web/app/admin/payments/page.tsx (214 dòng) | adminApi.payments.list, adminApi.orders.confirmPayment, adminApi.orders.failPayment | Không | ✅ | — |
| /admin/products/new | web/app/admin/products/new/page.tsx (9 dòng) | adminApi.brands.list, adminApi.products.get, adminApi.products.update, adminApi.products.create (+6) | Không | ✅ | — |
| /admin/products | web/app/admin/products/page.tsx (204 dòng) | adminApi.products.list, adminApi.products.remove, productApi.search, productApi.list (+2) | Không | ✅ | — |
| /admin/products/[id] | web/app/admin/products/[id]/page.tsx (11 dòng) | adminApi.brands.list, adminApi.products.get, adminApi.products.update, adminApi.products.create (+6) | Không | ✅ | — |
| /admin/promotions/new | web/app/admin/promotions/new/page.tsx (9 dòng) | adminApi.coupons.get, adminApi.coupons.update, adminApi.coupons.create, productApi.search (+3) | Không | ✅ | — |
| /admin/promotions | web/app/admin/promotions/page.tsx (162 dòng) | adminApi.coupons.list, adminApi.coupons.remove | Không | ✅ | — |
| /admin/promotions/[id] | web/app/admin/promotions/[id]/page.tsx (11 dòng) | adminApi.coupons.get, adminApi.coupons.update, adminApi.coupons.create, productApi.search (+3) | Không | ✅ | — |
| /admin/questions | web/app/admin/questions/page.tsx (177 dòng) | adminApi.questions.list, adminApi.questions.answer, adminApi.questions.hide | Không | ✅ | — |
| /admin/reports | web/app/admin/reports/page.tsx (670 dòng) | adminApi.expenses.create, adminApi.finance, adminApi.orders.list, adminApi.inventory.receipts | Không | ✅ | — |
| /admin/reports/spaces | web/app/admin/reports/spaces/page.tsx (210 dòng) | adminApi.spaceFunnel | Không | ✅ | — |
| /admin/returns | web/app/admin/returns/page.tsx (254 dòng) | adminApi.returns.list, adminApi.returns.update | Không | ✅ | — |
| /admin/reviews | web/app/admin/reviews/page.tsx (180 dòng) | adminApi.reviews.list, adminApi.reviews.setStatus | Không | ✅ | — |
| /admin/roles | web/app/admin/roles/page.tsx (59 dòng) | adminApi.roles.list | Không | ✅ | — |
| /admin/settings | web/app/admin/settings/page.tsx (456 dòng) | adminApi.settings.save | Có (chỉ tab dev) | ✅ | Tab "Dữ liệu giả lập" chỉ hiện khi USE_MOCK (settings/page.tsx:178); nhập mock-data và setTimeout (dòng 78) chỉ trong tab này |
| /admin/spaces/new | web/app/admin/spaces/new/page.tsx (9 dòng) | adminApi.spaces.get, adminApi.products.list, adminApi.spaces.update, adminApi.spaces.create (+5) | Không | ✅ | — |
| /admin/spaces | web/app/admin/spaces/page.tsx (158 dòng) | adminApi.spaces.list, adminApi.spaces.remove | Không | ✅ | — |
| /admin/spaces/[id] | web/app/admin/spaces/[id]/page.tsx (11 dòng) | adminApi.spaces.get, adminApi.products.list, adminApi.spaces.update, adminApi.spaces.create (+5) | Không | ✅ | — |
| / | web/app/page.tsx (260 dòng) | productApi.list, productApi.search, productApi.facets, productApi.detail (+5) | Không | ✅ | Ảnh dự phòng `/mock-img/product…` (page.tsx:190) |

## 5. Database

**Nguồn chuẩn:** `apps/api/prisma/schema.prisma` (59 model) + 16 thư mục migration (`apps/api/prisma/migrations`, gồm `0_init` và `20261109010100_remove_ar`). Kiểm tra drift trong phiên làm việc này (chạy ngày 2026-11-10, hai lượt): `prisma migrate diff --from-url aurelia_test --to-schema-datamodel schema.prisma` ⇒ "This is an empty migration" (không lệch). Seed: `prisma/seed.ts` (+ `seed-mock.ts`, `seed-models.ts`, `seed-storage.ts`, `seed-space-views.ts`), đã dựng được 34 users / 52 sản phẩm / 83 đơn trên DB sạch.

**Mức độ sử dụng bảng:** quét `\.<model>\.(find|create|update|delete|…)` trong `apps/api/src`: 53/59 model được gọi trực tiếp. 6 model còn lại KHÔNG phải bảng thừa, được dùng gián tiếp: `ReviewImage`, `ReturnRequestImage` (ghi bằng `images: { create }` lồng nhau, `reviews.service.ts:182`, `returns.service.ts:246`), `StockReceiptItem` (`items: { create }` ở phiếu kho), `OrderStatusHistory` (trigger `trg_orders_log_status` + SQL ở `admin-finance.service.ts:70`), `Permission` (seed + `PermissionsGuard`), `CodeCounter` (hàm DB sinh mã). Không có bảng nào hoàn toàn không dùng.

**Chênh lệch model / migration / docs:**
1. `database/03_tables.sql` (bản SQL tham chiếu) có **44** bảng, gồm 2 bảng AR (`ar_sessions`, `ar_snapshots`) và thiếu **17** bảng đã thêm bằng migration (`product_specs`, `product_360_configs/frames`, `review_images`, `product_questions`, `coupon_scopes`, `user_coupons`, `code_counters`, `return_requests/items/images`, `stock_receipts/items`, `expenses`, `banners`, `posts`, `contact_messages`). Cả thư mục `database/*.sql` còn **66 chỗ nhắc AR** (46 ở `03_tables.sql`, 10 ở `04_…`, 3 ở `05_…`); tệp sửa lần cuối 2026-10-06. README của thư mục nói rõ chỉ là tài liệu tham chiếu và không có script/compose nào dùng nó (đã grep `docker-compose.yml`, `scripts/`, `package.json`) ⇒ rủi ro thấp nhưng **mâu thuẫn với kết luận "AR đã loại bỏ hoàn toàn"** ở docs.
2. `docs/CAU_TRUC_DB.md`/`DATABASE_SCHEMA.md` mô tả "42 bảng" trong khi schema thật có 59; 17 bảng mở rộng được ghi ở `CHUAN_MO_RONG.md` (Phần 1) nhưng số "42" ở phần mở đầu chưa cập nhật (Cần xác minh từng dòng; không sửa trong audit này).
3. Model ↔ migration: `migrate diff` rỗng ⇒ khớp. Chưa có migration nào "thừa/thiếu" so với model trên `aurelia_test` (DB dựng từ migration). **`aurelia_dev` chưa áp `20261109010100_remove_ar`** (còn 2 phiên AR, 1 snapshot, 1 `has_ar`, 1 tệp usdz sẽ bị xóa) — xem `FINAL_READY_TO_MERGE_REPORT.md` §9.

| Model | Bảng | Định nghĩa | Số cột | Dùng trong src/ | Tệp test chạm |
|---|---|---|---|---|---|
| ActivityLog | activity_logs | schema.prisma:34 | 9 | 8 tệp | 12 |
| Address | addresses | schema.prisma:53 | 13 | 5 tệp | 6 |
| AttributeValue | attribute_values | schema.prisma:73 | 9 | 2 tệp | 2 |
| Attribute | attributes | schema.prisma:90 | 6 | 2 tệp | 2 |
| Brand | brands | schema.prisma:102 | 9 | 3 tệp | 1 |
| CartItem | cart_items | schema.prisma:120 | 8 | 3 tệp | 2 |
| Cart | carts | schema.prisma:136 | 8 | 4 tệp | 2 |
| Category | categories | schema.prisma:151 | 18 | 7 tệp | 4 |
| CouponUsage | coupon_usages | schema.prisma:177 | 8 | 3 tệp | 1 |
| Coupon | coupons | schema.prisma:195 | 23 | 3 tệp | 3 |
| InventoryMovement | inventory_movements | schema.prisma:226 | 10 | 4 tệp | 5 |
| Media | media | schema.prisma:245 | 23 | 7 tệp | 7 |
| ModelFile | model_files | schema.prisma:277 | 13 | 3 tệp | 4 |
| ModelMaterialVariant | model_material_variants | schema.prisma:298 | 9 | 3 tệp | 1 |
| Notification | notifications | schema.prisma:315 | 7 | 2 tệp | 9 |
| OrderItem | order_items | schema.prisma:331 | 15 | 3 tệp | 3 |
| OrderStatusHistory | order_status_history | schema.prisma:354 | 9 | nested/trigger/SQL | 3 |
| Order | orders | schema.prisma:373 | 33 | 11 tệp | 9 |
| Page | pages | schema.prisma:415 | 11 | 2 tệp | 3 |
| PasswordReset | password_resets | schema.prisma:434 | 7 | 1 tệp | 1 |
| Payment | payments | schema.prisma:449 | 11 | 4 tệp | 7 |
| Permission | permissions | schema.prisma:468 | 6 | nested/trigger/SQL | 1 |
| Product3DModel | product_3d_models | schema.prisma:483 | 22 | 6 tệp | 6 |
| ProductImage | product_images | schema.prisma:516 | 11 | 1 tệp | 2 |
| ProductVariant | product_variants | schema.prisma:537 | 26 | 11 tệp | 13 |
| Product | products | schema.prisma:574 | 33 | 16 tệp | 16 |
| Review | reviews | schema.prisma:619 | 15 | 6 tệp | 1 |
| RolePermission | role_permissions | schema.prisma:644 | 5 | 1 tệp | 2 |
| Role | roles | schema.prisma:657 | 8 | 3 tệp | 2 |
| Setting | settings | schema.prisma:671 | 6 | 6 tệp | 2 |
| Shipment | shipments | schema.prisma:684 | 11 | 3 tệp | 5 |
| SpaceBookmark | space_bookmarks | schema.prisma:703 | 6 | 2 tệp | 1 |
| SpaceHotspot | space_hotspots | schema.prisma:719 | 14 | 2 tệp | 1 |
| SpacePanorama | space_panoramas | schema.prisma:744 | 16 | 2 tệp | 0 |
| SpaceProductPlacement | space_product_placements | schema.prisma:769 | 18 | 3 tệp | 1 |
| SpaceView | space_views | schema.prisma:799 | 11 | 2 tệp | 4 |
| Space | spaces | schema.prisma:823 | 20 | 4 tệp | 8 |
| UserRole | user_roles | schema.prisma:852 | 5 | 1 tệp | 1 |
| UserSession | user_sessions | schema.prisma:865 | 10 | 3 tệp | 4 |
| User | users | schema.prisma:886 | 37 | 12 tệp | 14 |
| VariantAttributeValue | variant_attribute_values | schema.prisma:931 | 6 | 1 tệp | 2 |
| Wishlist | wishlists | schema.prisma:946 | 6 | 3 tệp | 1 |
| ProductSpec | product_specs | schema.prisma:1115 | 6 | 2 tệp | 0 |
| Product360Config | product_360_configs | schema.prisma:1127 | 11 | 2 tệp | 0 |
| Product360Frame | product_360_frames | schema.prisma:1143 | 8 | 1 tệp | 0 |
| ReviewImage | review_images | schema.prisma:1158 | 6 | nested/trigger/SQL | 0 |
| ProductQuestion | product_questions | schema.prisma:1178 | 12 | 4 tệp | 0 |
| CouponScope | coupon_scopes | schema.prisma:1199 | 5 | 2 tệp | 0 |
| UserCoupon | user_coupons | schema.prisma:1210 | 6 | 1 tệp | 0 |
| CodeCounter | code_counters | schema.prisma:1222 | 2 | nested/trigger/SQL | 0 |
| ReturnRequest | return_requests | schema.prisma:1257 | 16 | 3 tệp | 1 |
| ReturnRequestItem | return_request_items | schema.prisma:1281 | 8 | 2 tệp | 0 |
| ReturnRequestImage | return_request_images | schema.prisma:1296 | 5 | nested/trigger/SQL | 0 |
| StockReceipt | stock_receipts | schema.prisma:1322 | 10 | 1 tệp | 1 |
| StockReceiptItem | stock_receipt_items | schema.prisma:1338 | 7 | nested/trigger/SQL | 0 |
| Expense | expenses | schema.prisma:1362 | 11 | 4 tệp | 4 |
| Banner | banners | schema.prisma:1390 | 12 | 2 tệp | 1 |
| Post | posts | schema.prisma:1408 | 12 | 2 tệp | 0 |
| ContactMessage | contact_messages | schema.prisma:1426 | 9 | 2 tệp | 0 |

## 6. Lệch giữa Docs và Code

1. **API_CONTRACT.md ↔ code:** bảng endpoint của `docs/API_CONTRACT.md` (181 dòng parse được) so với 210 route thật:
   - Docs có, code không: `PATCH /admin/orders/:id/shipment` (đã thay bằng `POST /admin/orders/:id/shipments` + `PATCH /admin/shipments/:id`, mô tả ở prose dòng ~1122) và `POST /admin/settings/reset-mock` (chỉ có ở mock FE, `admin.api.ts:279`).
   - Code có, bảng docs không có (đa số có ở phần mô tả prose, chỉ thiếu trong BẢNG): attributes (7 route), brands (4), media (presign/confirm/list/patch/delete), `GET /admin/orders/:code/invoice`, `PATCH /admin/banners/reorder`, `GET/PUT /admin/faq`, `GET /admin/contact-messages`, `PATCH …/handled`, `POST/DELETE /admin/pages`, `GET /posts/:slug`, `POST /admin/models/:id/files/presign|confirm`, `POST /admin/orders/:id/shipments`, `PATCH /admin/shipments/:id`, `POST /spaces/:slug/views`, `POST /spaces/:slug/add-to-cart`.
2. **FE ghi "chưa có trong BE" sai:** 91 chú thích `TODO: chưa có trong BE/DB` ở `web/services/*.ts` và `web/types/api.ts` đã lỗi thời: ví dụ `couponApi.mine/suggested/save` (`cart.api.ts:52-54`) trong khi BE có `coupons.controller.ts:14-24`; `/contact`, `/faq`, `/brands`, `/products/facets` đều có ở BE; trường `gender`, `birthday`, `loyaltyPoints`, `adminNote`, `internalNote`, `costPrice`, `minStock` đều có trong `schema.prisma`. Docs đã tự ghi mục này ở `CHUAN_MO_RONG.md` (#17 "Đã cũ") nhưng chưa dọn.
3. **Comment đầu tệp "TRẠNG THÁI: khung rỗng, chưa cài đặt logic"** còn ở 11 tệp BE: `modules/hotspots/{admin-hotspots.controller,hotspots.service,hotspots.module}.ts`, `modules/product-images/*` (3 tệp), `modules/variants/*` (3 tệp), `modules/pages/pages.service.ts`, `modules/settings/settings.controller.ts`. Các module này đúng là rỗng (không route) vì logic đã gộp vào `admin-products`/`admin-spaces` (D-N32) ⇒ đúng thực tế nhưng là **mã chết** gây hiểu nhầm (UC-ADM-10/11/16 đọc theo tên module sẽ tưởng chưa làm).
4. **DECISIONS.md D-T32** vẫn mô tả "AR web dùng `@google/model-viewer`" (dòng 110); AR đã bị loại (D-P16) nhưng `model-viewer` vẫn dùng cho xem 3D ⇒ câu chữ cũ, cần ghi chú "đã thay thế".
5. **`database/` ↔ schema** (mục 5): 44 vs 59 bảng, còn AR.
6. **Đăng nhập Google**: `API_CONTRACT.md:115` liệt kê `POST /auth/google` như một endpoint bình thường, thực tế luôn trả 503 (`auth.service.ts:196-206`).
7. **UC-ADM-07 / UC-ADM-12** (xem §2.1): đặc tả có luồng tạo trang tĩnh và điều chỉnh tồn trực tiếp mà FE chưa có.

## 7. TODO / FIXME / Mock (liệt kê toàn bộ, theo từ khóa yêu cầu)

Quét `apps/api/src`, `apps/api/prisma`, `apps/web/src`, `packages/`, `scripts/` (bỏ node_modules/build). Tổng hợp: `TODO` 93 (đều ở `apps/web/src`, trong đó 91 là chú thích "chưa có trong BE/DB" đã lỗi thời), `console.log` 31 (21 trong `scripts/*.mjs`, 10 trong `apps/api/prisma/seed*` — đều là in tiến trình của script CLI; **không có `console.log` trong mã chạy của API hay FE**), `fake`/`faker` 8 (đều trong tệp `*.spec.ts`: `FakeRedis`, `PAYMENT_SANDBOX_FAKE`), `FIXME`/`HACK`/`XXX`/`WIP`/`NotImplemented`/`not implemented`/`coming soon`/`lorem`/`stub`/`dummy`/`return []`/`501`: **0 kết quả** trong mã chạy (có 1 `throw SERVICE_UNAVAILABLE` ở `auth.service.ts:196-206` và 1 ở `payments.service.ts:137` khi chưa cấu hình khóa), `placeholder` 104 (thuộc tính `placeholder` của ô nhập, `placeholderData` của React Query và hàm tạo ảnh seed; không phải dữ liệu giả), `mock` ở lớp giả lập FE (`apps/web/src/mock-data`, `seed-mock`, spec): `apps/api/src/common/filters/all-exceptions.filter.spec.ts` (1), `apps/api/src/common/utils/vn-date.spec.ts` (1), `apps/api/src/storage/minio-storage.service.spec.ts` (7), `apps/api/prisma/seed-mock.ts` (27), `apps/web/src/mock-data/db.ts` (5), `apps/web/src/mock-data/index.ts` (1), `apps/web/src/mock-data/mockApi/admin.ts` (5), `apps/web/src/mock-data/mockApi/auth.ts` (8), `apps/web/src/mock-data/mockApi/catalog.ts` (1), `apps/web/src/mock-data/mockApi/http.ts` (1), `apps/web/src/mock-data/mockApi/index.ts` (5), `apps/web/src/mock-data/mockApi/shop.ts` (1), `apps/web/src/mock-data/tables/users.ts` (2), `apps/web/src/mock-data/tables/_360_gen.ts` (3), `apps/web/src/mock-data/tables/_products_gen.ts` (1), `apps/web/src/mock-data/tables/_products_spec.ts` (1), `apps/web/src/mock-data/utils/img.ts` (6), `apps/web/src/mock-data/utils/media-registry.ts` (1), `apps/web/src/mock-data/utils/rng.ts` (2), `apps/web/src/mock-data/utils/svg.ts` (1). Các dòng còn lại bên dưới là toàn bộ `TODO`, `console.log`, `fake`, và `mock` nằm NGOÀI lớp mock/spec:

| Từ khóa | file:dòng | Nội dung |
|---|---|---|
| faker | apps/api/src/cache/cache.service.spec.ts:6 | class FakeRedis { |
| faker | apps/api/src/cache/cache.service.spec.ts:49 | const redis = new FakeRedis(); |
| fake | apps/api/src/modules/payments/payments.sandbox.spec.ts:13 | const make = (fake: boolean, env: string) => { |
| fake | apps/api/src/modules/payments/payments.sandbox.spec.ts:25 | get: (k: string) => (k === 'PAYMENT_SANDBOX_FAKE' ? fake : k === 'NODE_ENV' ? env : undefined), |
| fake | apps/api/src/modules/payments/payments.sandbox.spec.ts:33 | for (const [fake, env] of [ |
| fake | apps/api/src/modules/payments/payments.sandbox.spec.ts:37 | const { svc, settle } = make(fake, env); |
| fake | apps/api/src/modules/payments/vnpay.spec.ts:7 | hashSecret: 'fake-hash-secret-for-tests', |
| fake | apps/api/src/modules/product-models/model-file-validator.spec.ts:85 | validateModelFile({ fileName: 'fake.glb', sizeBytes: 20, bytes: Buffer.from('<html>fake</html>') }), |
| console.log | apps/api/prisma/seed-mock.ts:29 | const log = (m: string) => console.log(`[seed-mock] ${m}`); |
| console.log | apps/api/prisma/seed-models-cli.ts:11 | console.log(`Xử lý mô hình 3D mẫu trên ${db} (storage ${process.env.STORAGE_DRIVER ?? 'minio'})`); |
| console.log | apps/api/prisma/seed-models.ts:188 | console.log(`Cấu hình vật liệu theo biến thể (model_material_variants): ${mats} dòng.`); |
| console.log | apps/api/prisma/seed-models.ts:194 | console.log(`Xử lý nền mô hình 3D mẫu: ${ok} tệp xử lý xong; mô hình ready=${ready}, failed=${failed}.`); |
| console.log | apps/api/prisma/seed-models.ts:196 | console.log('Mô hình mẫu có vấn đề (KHÔNG bị xóa):'); |
| console.log | apps/api/prisma/seed-models.ts:197 | for (const p of problems) console.log(`  - #${p.modelId} ${p.slug} ${p.fileName}: ${p.reason}`); |
| console.log | apps/api/prisma/seed-space-views-cli.ts:15 | if (have >= 100) return console.log(`Đã có ${have} lượt xem trong 30 ngày, bỏ qua.`); |
| console.log | apps/api/prisma/seed-space-views-cli.ts:40 | console.log(`Đã thêm ${rows.length} lượt xem không gian (30 ngày gần nhất) vào ${db}.`); |
| console.log | apps/api/prisma/seed.ts:688 | console.log(`Tệp mẫu trên kho (${storageDriver}): ${rows.length} bản ghi, tải lên mới ${uploaded}.`); |
| console.log | apps/api/prisma/seed.ts:711 | console.log('Seed hoàn tất.'); |
| todo | apps/web/src/mock-data/mockApi/admin.ts:1282 | // ===================== Ảnh 360° của sản phẩm (TODO: cần thêm vào DB/API) ===================== |
| todo | apps/web/src/mock-data/tables/addresses.ts:10 | export const addressLabels: Record<number, string> = {}; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/attributes.ts:49 | /** attributeValueId của màu → mã hex  // TODO: chưa có trong DB */ |
| todo | apps/web/src/mock-data/tables/banners.ts:1 | // Banner – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/contact_messages.ts:1 | // Tin nhắn liên hệ – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/coupons.ts:6 | // TODO: chưa có trong DB (name, mô tả, phạm vi, loại freeship) |
| todo | apps/web/src/mock-data/tables/expenses.ts:1 | // Phiếu chi – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/faq_topics.ts:1 | // FAQ theo chủ đề – TODO: chưa có trong DB (dự kiến lưu ở pages) |
| todo | apps/web/src/mock-data/tables/posts.ts:1 | // Bài viết/blog – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/product_360.ts:1 | // Cấu hình xem 360° theo sản phẩm – TODO: cần thêm vào DB/API |
| todo | apps/web/src/mock-data/tables/product_360_frames.ts:1 | // Chuỗi ảnh 360° theo màu – TODO: cần thêm vào DB/API |
| todo | apps/web/src/mock-data/tables/product_extras.ts:1 | // Trường sản phẩm CHƯA có trong DB (phong cách, giá vốn, tồn tối thiểu, đặc điểm, thông số) – TODO: chưa có t |
| todo | apps/web/src/mock-data/tables/product_questions.ts:1 | // Hỏi đáp sản phẩm – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/return_requests.ts:1 | // Yêu cầu đổi trả – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/review_extras.ts:1 | // Ảnh + chip tiêu chí của đánh giá – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/stock_receipts.ts:1 | // Phiếu nhập/xuất kho – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/suppliers.ts:1 | // Nhà cung cấp – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/users.ts:14 | gender: 'male' \| 'female' \| 'other' \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/users.ts:15 | birthday: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/users.ts:16 | loyaltyPoints: number; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/users.ts:17 | adminNote: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/user_coupons.ts:1 | // Mã giảm giá đã lưu của từng khách – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_360_gen.ts:2 | // TODO: cần thêm vào DB/API (chưa có bảng tương ứng) – xem docs/FE_PROGRESS.md (đề xuất DB/API). |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:23 | style: string; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:24 | costPrice: number; // TODO: chưa có trong DB (giá vốn của biến thể chuẩn) |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:25 | dims: [number, number, number]; // D×R×C (mm) của kích thước chuẩn – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:26 | sizeDimMult: Record<string, number>; // nhãn kích thước → hệ số kích thước – TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:27 | costRatio: number; // TODO: chưa có trong DB (giá vốn / giá bán, dùng cho mọi biến thể) |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:28 | minStock: number; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:29 | features: string[]; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_products_gen.ts:30 | specs: Array<{ label: string; value: string }>; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_social_gen.ts:33 | images: string[]; // TODO: chưa có trong DB |
| todo | apps/web/src/mock-data/tables/_social_gen.ts:34 | tags: string[]; // TODO: chưa có trong DB |
| todo | apps/web/src/services/admin.api.ts:79 | /** Ảnh 360° – TODO: chưa có trong BE */ |
| todo | apps/web/src/services/admin.api.ts:95 | counts: () => http.get<Record<string, number>>('/admin/orders/counts'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/admin.api.ts:119 | saveNote: (id: number, note: string) => http.patch<OrderView>(`/admin/orders/${id}/note`, { note }), // TODO:  |
| todo | apps/web/src/services/admin.api.ts:122 | list: (q: Query) => http.list<ReturnRequest>('/admin/returns', q), // TODO: chưa có trong BE |
| todo | apps/web/src/services/admin.api.ts:150 | list: (q: Query) => http.list<ProductQuestion>('/admin/questions', q), // TODO: chưa có trong BE |
| todo | apps/web/src/services/admin.api.ts:252 | banners: () => http.get<Banner[]>('/admin/banners'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/admin.api.ts:258 | posts: () => http.get<Post[]>('/admin/posts'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/admin.api.ts:365 | ), // TODO: chưa có trong BE |
| todo | apps/web/src/services/auth.api.ts:33 | googleLogin: () => http.post<AuthResult>('/auth/google'), // TODO: chưa có trong BE – giả lập |
| todo | apps/web/src/services/cart.api.ts:31 | counts: () => http.get<Record<string, number>>('/orders/counts'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/cart.api.ts:39 | // TODO: chưa có trong BE |
| todo | apps/web/src/services/cart.api.ts:52 | mine: (q: { status?: string } = {}) => http.get<UserCouponView[]>('/coupons/me', q), // TODO: chưa có trong BE |
| todo | apps/web/src/services/cart.api.ts:53 | suggested: () => http.get<CouponView[]>('/coupons/suggested'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/cart.api.ts:54 | save: (code: string) => http.post<UserCouponView>('/coupons/save', { code }), // TODO: chưa có trong BE |
| todo | apps/web/src/services/cart.api.ts:58 | list: () => http.get<ReviewView[]>('/reviews/me'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/content.api.ts:13 | banners: () => http.get<Banner[]>('/banners'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/content.api.ts:14 | posts: () => http.get<Post[]>('/posts'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/content.api.ts:16 | policies: () => http.get<Array<Pick<Page, 'slug' \| 'title'>>>('/pages', { type: 'policy' }), // TODO: chưa có  |
| todo | apps/web/src/services/content.api.ts:17 | faq: () => http.get<FaqTopic[]>('/faq'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/content.api.ts:19 | http.post<null>('/contact', body), // TODO: chưa có trong BE |
| todo | apps/web/src/services/content.api.ts:26 | unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'), // TODO: chưa có trong BE |
| todo | apps/web/src/services/product.api.ts:34 | facets: (q: ProductQuery) => http.get<ProductFacets>('/products/facets', q), // TODO: chưa có trong BE |
| todo | apps/web/src/services/product.api.ts:37 | /** Dữ liệu xem 360° (ảnh theo màu, biến thể, chính sách) – TODO: chưa có trong BE */ |
| todo | apps/web/src/services/product.api.ts:39 | related: (slug: string) => http.get<ProductListItem[]>(`/products/${slug}/related`), // TODO: chưa có trong BE |
| todo | apps/web/src/services/product.api.ts:53 | questions: (slug: string) => http.get<ProductQuestion[]>(`/products/${slug}/questions`), // TODO: chưa có tron |
| todo | apps/web/src/services/product.api.ts:63 | list: () => http.get<Array<{ id: number; name: string; slug: string }>>('/brands'), // TODO: chưa có trong BE  |
| todo | apps/web/src/services/space.api.ts:35 | facets: () => http.get<SpaceFacets>('/spaces/facets'), // TODO: chưa có trong BE |
| todo | apps/web/src/types/api.ts:2 | // Trường nào KHÔNG có trong DB được đánh dấu "TODO: chưa có trong DB" (xem docs/PROJECT_ANALYSIS.md mục 7). |
| todo | apps/web/src/types/api.ts:66 | description?: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:67 | isFeatured?: boolean; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:85 | style: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:88 | /** Sản phẩm có ảnh xoay 360° – TODO: cần thêm vào DB/API */ |
| todo | apps/web/src/types/api.ts:150 | specs: Array<{ label: string; value: string }>; // TODO: chưa có trong DB (dựng từ thuộc tính + kích thước mô  |
| todo | apps/web/src/types/api.ts:151 | features: string[]; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:175 | images: string[]; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:176 | tags: string[]; // TODO: chưa có trong DB (chip tiêu chí) |
| todo | apps/web/src/types/api.ts:183 | gender: 'male' \| 'female' \| 'other' \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:184 | birthday: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:185 | customerGroup: 'new' \| 'loyal'; // TODO: chưa có trong DB (suy ra từ số đơn/chi tiêu) |
| todo | apps/web/src/types/api.ts:186 | loyaltyPoints: number; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:187 | adminNote: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:194 | label: string; // TODO: chưa có trong DB ("Nhà riêng", "Văn phòng") |
| todo | apps/web/src/types/api.ts:254 | internalNote: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:261 | name: string; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:262 | description: string \| null; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:263 | appliesTo: 'all' \| 'category' \| 'product' \| 'space'; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:264 | appliesToLabel: string; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:265 | kind: 'percent' \| 'fixed' \| 'freeship'; // 'freeship' TODO: CouponType DB chỉ có percent\|fixed |
| todo | apps/web/src/types/api.ts:272 | status: 'unused' \| 'used' \| 'expired'; // TODO: chưa có bảng user_coupons |
| todo | apps/web/src/types/api.ts:398 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:425 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:443 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:457 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:472 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:481 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:502 | costPrice: number; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:505 | minStock: number; // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:573 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:583 | // TODO: chưa có trong DB |
| todo | apps/web/src/types/api.ts:650 | // ---------- Xem 360° (TODO: cần thêm vào DB/API) ---------- |
| console.log | scripts/db-reset.mjs:37 | if (exists) console.log(`Trước khi reset – ${count(name)}  (users\|products\|orders)`); |
| console.log | scripts/db-reset.mjs:38 | console.log(`→ DROP/CREATE ${name}`); |
| console.log | scripts/db-reset.mjs:51 | console.log(`Sau khi seed – ${count(name)}  (users\|products\|orders)`); |
| console.log | scripts/db-reset.mjs:60 | console.log('Đã xóa cache Redis (khóa *cache*)'); |
| console.log | scripts/db-reset.mjs:62 | console.log('(bỏ qua xóa cache Redis: không truy cập được container Redis)'); |
| console.log | scripts/demo.mjs:71 | console.log(`[demo] ${name} thoát (mã ${code ?? 'tín hiệu'})`); |
| console.log | scripts/demo.mjs:88 | console.log( |
| console.log | scripts/demo.mjs:107 | console.log(`[demo] Web http://localhost:${WEB_PORT} (admin: /admin/login)`); |
| console.log | scripts/e2e-real.mjs:57 | const log = (m) => console.log(`\n[e2e-real] ${m}`); |
| console.log | scripts/e2e-real.mjs:80 | console.log(`\n[e2e-real] ❌ nhóm ${group} fail. Bằng chứng: ${dst}`); |
| console.log | scripts/e2e-real.mjs:81 | for (const t of traces) console.log(`[e2e-real]   trace: npx playwright show-trace ${t}`); |
| console.log | scripts/e2e-real.mjs:82 | console.log(`[e2e-real]   log response >= 400 của API: ${apiErrorLog}`); |
| console.log | scripts/e2e-real.mjs:274 | console.log('\n[e2e-real] Kết quả:'); |
| console.log | scripts/e2e-real.mjs:275 | for (const [n, ok] of results) console.log(`  ${ok ? '✅' : '❌'} ${n}`); |
| console.log | scripts/generate-shared-types.mjs:163 | console.log( |
| console.log | scripts/minio-sync-uploads.mjs:75 | console.log(`(không có thư mục ${dir})`); |
| console.log | scripts/minio-sync-uploads.mjs:81 | console.log( |
| console.log | scripts/minio-sync-uploads.mjs:108 | console.log( |
| console.log | scripts/minio-sync-uploads.mjs:121 | console.log(`  ${ok ? 'OK ' : 'LỖI'} ${r.status} ${pub}/${key}`); |
| console.log | scripts/minio-sync-uploads.mjs:123 | console.log(`\nURL công khai mở được: ${okUrls}/${sample.length}`); |
| console.log | scripts/minio-sync-uploads.mjs:125 | console.log( |
| mock | apps/api/src/common/utils/list-query.ts:29 | /** pageSize mặc định theo từng danh sách, tối đa 100 (giống mock) */ |
| mock | apps/api/src/common/utils/list-query.ts:35 | /** Kẹp page vào [1, totalPages] như mock rồi tính skip */ |
| mock | apps/api/src/common/utils/validate.ts:1 | // Kiểm tra dữ liệu đầu vào theo contract: thông báo tiếng Việt đúng từng trường như FE (mock) đang hiển thị. |
| mock | apps/api/src/common/views/catalog-views.service.ts:74 | /** Biến thể mặc định: nhóm theo màu của biến thể đầu tiên, lấy phần tử thứ 2 của nhóm (giống mock) */ |
| mock | apps/api/src/common/views/media-ingest.service.ts:2 | // (StorageService) và tạo bản ghi media. FE (mock) gửi ảnh đại diện, ảnh đánh giá/đổi trả, frame 360 theo các |
| mock | apps/api/src/modules/coupons/admin-coupons.service.ts:126 | /** Nhãn phạm vi hiển thị (giống mock) */ |
| mock | apps/api/src/modules/payments/payments.service.ts:3 | // chưa có khóa ⇒ chế độ giả lập (PAYMENT_SANDBOX_FAKE=true, không production) quyết định thành công/thất bại  |
| mock | apps/api/src/modules/reviews/reviews.service.ts:2 | // một đánh giá. Có kiểm duyệt (theo FE/mock): đánh giá mới và đánh giá vừa sửa ở trạng thái pending; admin du |
| mock | apps/api/prisma/seed-storage.ts:78 | /** Ghi một tệp (nội dung đã có) lên kho nếu chưa tồn tại. Trả về dung lượng. Dùng bởi seed từ mock-data. */ |
| mock | apps/api/prisma/seed.ts:695 | // Mặc định seed từ mock-data của FE (SEED_SOURCE=mock) để giao diện giống hệt khi chạy mock; |
| mock | apps/api/prisma/seed.ts:697 | const useMock = process.env.SEED_SAMPLE !== 'false' && (process.env.SEED_SOURCE ?? 'mock') === 'mock'; |
| mock | apps/api/prisma/seed.ts:698 | await seedCore(!useMock); // seed mock có tài khoản admin riêng (admin@aurelia.vn / admin123) |
| mock | apps/api/prisma/seed.ts:700 | const { seedFromMock } = await import('./seed-mock'); |
| mock | apps/web/src/app/(account)/account/profile/page.tsx:124 | {u.avatarUrl && !u.avatarUrl.includes('/mock-img/avatar') ? ( |
| mock | apps/web/src/app/(shop)/about/page.tsx:36 | src="/mock-img/banner?s=Japandi&n=9" |
| mock | apps/web/src/app/(shop)/about/page.tsx:65 | src="/mock-img/room?s=Bắc%20Âu&r=living_room&n=7" |
| mock | apps/web/src/app/(shop)/about/page.tsx:100 | src={`/mock-img/avatar?n=${encodeURIComponent(n)}`} |
| mock | apps/web/src/app/admin/login/page.tsx:56 | 'linear-gradient(135deg, rgba(43,30,22,0.92), rgba(43,30,22,0.55)), url(/mock-img/banner?n=5&s=Luxury)', |
| mock | apps/web/src/app/admin/models/page.tsx:189 | <ModelPreview src="/mock/models/sofa.glb" alt="Xem trước mô hình" /> |
| mock | apps/web/src/app/admin/settings/page.tsx:22 | type Tab = 'store' \| 'payments' \| 'shipping' \| 'email' \| 'theme' \| 'seo' \| 'security' \| 'mock'; |
| mock | apps/web/src/app/admin/settings/page.tsx:63 | import('@/mock-data/db').then((m) => setCfg(m.getConfig())); |
| mock | apps/web/src/app/admin/settings/page.tsx:66 | const m = await import('@/mock-data/db'); |
| mock | apps/web/src/app/admin/settings/page.tsx:72 | const m = await import('@/mock-data/db'); |
| mock | apps/web/src/app/admin/settings/page.tsx:178 | const menu: Array<[Tab, string]> = USE_MOCK ? [...MENU, ['mock', 'Dữ liệu giả lập']] : MENU; |
| mock | apps/web/src/app/admin/settings/page.tsx:186 | tab !== 'mock' && ['store', 'payments', 'shipping'].includes(tab) ? ( |
| mock | apps/web/src/app/admin/settings/page.tsx:445 | {tab === 'mock' && ( |
| mock | apps/web/src/app/mock-img/[kind]/route.ts:1 | // Ảnh SVG minh họa cho dữ liệu giả: /mock-img/product?t=sofa&c=C9B6A0&v=1 … (chỉ dùng khi chạy với mock-data) |
| mock | apps/web/src/app/mock-img/[kind]/route.ts:9 | } from '@/mock-data/utils/svg'; |
| mock | apps/web/src/app/not-found.tsx:65 | src="/mock-img/product?t=armchair&c=D8C3A5&v=4" |
| mock | apps/web/src/app/page.tsx:190 | src="/mock-img/product?t=sofa&c=C9B8A0&v=4" |
| mock | apps/web/src/components/admin/UploadDropzone.tsx:13 | /** Trả về danh sách file hợp lệ (mock không upload thật) */ |
| mock | apps/web/src/components/admin/UploadDropzone.tsx:105 | /** Đọc file ảnh thành data URL để xem trước/lưu vào mock */ |
| mock | apps/web/src/components/layout/AuthLayout.tsx:28 | 'linear-gradient(180deg, rgba(43,30,22,0.15), rgba(43,30,22,0.85)), url(/mock-img/banner?n=3&s=Luxury)', |
| mock | apps/web/src/components/product/ProductListing.tsx:101 | src={currentCat?.imageUrl ?? '/mock-img/product?t=sofa&c=C9B8A0&v=4'} |
| mock | apps/web/src/services/admin.api.ts:279 | resetMock: () => http.post<null>('/admin/settings/reset-mock'), // chỉ có ở mock |
| mock | apps/web/src/services/api-client.ts:2 | // Một điểm vào duy nhất: request(). Khi NEXT_PUBLIC_USE_MOCK=true, request được chuyển vào mock API chạy tron |
| mock | apps/web/src/services/api-client.ts:3 | // trình duyệt (apps/web/src/mock-data/mockApi); ngược lại gọi fetch tới `${NEXT_PUBLIC_API_URL}/api`. |
| mock | apps/web/src/services/api-client.ts:4 | // Giao diện không phải đổi gì khi bật/tắt mock. |
| mock | apps/web/src/services/api-client.ts:64 | * chạy ngay lúc mount có thể đến trước bước nạp ⇒ gửi không token ⇒ API thật trả 401 (mock không lộ vì nạp độn |
| mock | apps/web/src/services/api-client.ts:88 | const { handleMockRequest } = await import('@/mock-data/mockApi'); |
| mock | apps/web/src/services/auth.api.ts:23 | /** BE gửi email chứa liên kết /reset-password?token=…; mock trả thêm devResetLink để thử không cần email */ |
| mock | apps/web/src/services/cart.api.ts:12 | /** BE thật: POST /coupons/validate (chỉ xem trước, D-N16). Mock lưu mã vào giỏ để tính lại tổng. */ |
| mock | apps/web/src/services/media.api.ts:11 | * Trả về URL ảnh đã lưu (máy chủ thật) hoặc data-URL (mock) để gửi lại cho API lưu cấu hình. |
| mock | apps/web/src/services/space.api.ts:44 | * trong body. Dữ liệu giả (mock) không có mạng ⇒ gọi qua mock API. |
| mock | apps/web/src/types/api.ts:395 | // ---------- Thực thể CHƯA có trong DB (mock tự đặt tên theo WIREFRAME.md mục 5) ---------- |
| mock | apps/web/src/types/api.ts:485 | /** chỉ còn trong dữ liệu mock gốc; API thật không trả (nhà cung cấp là chữ trong phiếu) */ |
| mock | scripts/db-reset.mjs:1 | // Tạo lại (DROP + CREATE) một DB DEMO/TEST rồi áp migration và seed từ mock-data. |
| mock | scripts/generate-shared-types.mjs:131 | // Cột bổ sung của backend (migration add_backend_extras): khai báo tùy chọn để mock-data của FE (chưa có các  |

Khối mã comment-out lớn: không tìm thấy qua quét `^\s*//.*\b(function|const|return)\b` ở mức thủ công (không phát hiện khối ≥ 10 dòng); mức này Cần xác minh sâu hơn nếu cần.

## 8. Rủi ro và lỗi tiềm ẩn

| # | Mức | Rủi ro | Bằng chứng |
|---|---|---|---|
| 1 | Cao (với sản xuất) | **Swagger bật mặc định** kể cả production; không có ràng buộc ở `superRefine` ép tắt (chỉ docs khuyên) | `env.validation.ts:87` (`bool.default('true')`), `app.setup.ts:33`, `.env.example:33`, `ENVIRONMENT.md:16` |
| 2 | Cao | **Mật khẩu admin mặc định** `Admin@123456` (seed thường) và `admin@aurelia.vn / admin123` (seed mock/demo) | `prisma/seed.ts:13,698`, `.env.example:130`; ENVIRONMENT.md ghi "Production: bắt buộc tự đặt" nhưng không có kiểm tra tự động |
| 3 | Trung bình | Bull Board nhận token qua `?token=` trên URL (lộ ở lịch sử/nhật ký proxy) | `jobs/bull-board.middleware.ts:1-2` |
| 4 | Trung bình | Access/refresh token lưu `localStorage` (rủi ro XSS lấy token). Giảm nhẹ: `RichText` dùng `react-markdown`, không `dangerouslySetInnerHTML` (code không dùng `dangerouslySetInnerHTML`, chỉ có 1 chú thích nhắc tên) | `web/store/authStore.ts:1` |
| 5 | Trung bình | Đăng nhập Google: nút hiện cho người dùng nhưng luôn lỗi 503 | `auth.service.ts:196-206`, `web/components/account/GoogleButton.tsx:5` |
| 6 | Trung bình | Xem trước mô hình 3D ở `/admin/models` luôn nạp `/mock/models/sofa.glb` — tệp không có trong `public/mock/models` (chỉ `armchair.glb`) ⇒ 404 và không phản ánh tệp được chọn | `web/app/admin/models/page.tsx:189`, `apps/web/public/mock/models/` |
| 7 | Trung bình | Trang `/about` và `/contact` có số liệu/đội ngũ/showroom viết cứng và ảnh `/mock-img/*` hiển thị ở chế độ thật | `web/app/(shop)/about/page.tsx:11-28,36,65,100`, `contact/page.tsx:31` |
| 8 | Trung bình | Thêm "cả bộ" không gian vào giỏ làm nhiều lệnh tuần tự từ FE: món hết hàng giữa chừng ⇒ giỏ thêm dở; endpoint chuyên dụng trả `unavailable[]` không được dùng | `web/app/(shop)/spaces/[slug]/page.tsx:100-101`, `spaces.controller.ts:71` |
| 9 | Thấp | Mặc định FE chạy dữ liệu giả: dễ nhầm là "đã nối API" khi demo | `apps/web/.env.example` (`NEXT_PUBLIC_USE_MOCK=true`) |
| 10 | Thấp | 12 endpoint không có test tự động tham chiếu đường dẫn (coupons ví, `orders/counts`, `products/:slug/related`, `spaces/facets`, 3 route khách hàng của admin, sửa/xóa vị trí panorama, `auth/google`); đã curl 200 ở phiên này nhưng không có kiểm hồi quy | `be2` quét test; curl 2026-11-10 |
| 11 | Thấp | Supertest cần `aurelia_test` dựng lại từ đầu, nếu không test đếm seed sai; lỗi `localhost`→IPv6 trên Windows | `DECISIONS.md` D-T61, `ENVIRONMENT.md` (`PG_HOST`) |
| 12 | Thấp | Rác trong repo: `docs/aurelia_dev_backup.sql` (459 KB, UTF-16, chỉ dữ liệu mẫu: 4 email mẫu, không có hash mật khẩu) được git theo dõi; 8 tệp `*.dump` ở gốc (đã `.gitignore`) | `CHUAN_MO_RONG.md` #18; `git ls-files` |
| 13 | Thấp | `ai` module và `apps/mobile` là khung rỗng nhưng vẫn được nạp/đóng gói | `modules/ai/*` (2 dòng/tệp), `apps/mobile/app/src/**` (104 dòng/35 tệp) |

Không phát hiện: secret thật trong repo (chỉ `.env.example`), endpoint FE gọi mà BE không có (0 ngoài `reset-mock` chỉ-mock), route BE trả dữ liệu cứng.

## 9. Đề xuất ưu tiên

| Ưu tiên | Việc | Cỡ |
|---|---|---|
| **P0** (trước khi đưa lên môi trường thật) | Ép `SWAGGER_ENABLED=false` khi `NODE_ENV=production` (thêm vào `superRefine`) và ép đổi `SEED_ADMIN_PASSWORD` ≠ mặc định ở production | S |
| P0 | Quyết định áp migration `remove_ar` cho `aurelia_dev` (sao lưu trước; xem `FINAL_READY_TO_MERGE_REPORT.md` §9) | S |
| **P1** | Sửa xem trước mô hình 3D ở `/admin/models` (dùng URL/blob của tệp đã chọn, bỏ `sofa.glb`) | S |
| P1 | UC-ADM-07: thêm nút "Tạo trang"/"Xóa trang" ở `/admin/content` (BE đã có) | M |
| P1 | UC-ADM-12: thêm màn "Điều chỉnh tồn" gọi `POST /admin/inventory/movements` | M |
| P1 | Thay nội dung viết cứng ở `/about` và `/contact` bằng dữ liệu từ `/settings/public` hoặc trang `about`; bỏ ảnh `/mock-img/*` khỏi chế độ thật | M |
| P1 | Đăng nhập Google: hoặc hoàn thiện (OAuth) hoặc ẩn nút ở FE + bỏ khỏi API_CONTRACT | M |
| P1 | Dùng `POST /spaces/:slug/add-to-cart` (hoặc thêm tham số danh sách món) thay cho lặp từng món | S |
| **P2** | Dọn 91 chú thích `TODO: chưa có trong BE/DB` và 11 comment "khung rỗng"; xóa hoặc đánh dấu module rỗng (`hotspots`, `product-images`, `variants`, `ai`) | S |
| P2 | Cập nhật `database/*.sql` (bỏ AR, thêm 17 bảng) hoặc xóa thư mục, và sửa số "42 bảng" ở docs | M |
| P2 | Bổ sung test hồi quy cho 12 endpoint chưa có test (§8 #10) | M |
| P2 | Màn hình quản trị cho FAQ, tin nhắn liên hệ, sắp xếp banner; trang blog công khai; nút in hóa đơn | L |
| P2 | Cập nhật bảng endpoint của `API_CONTRACT.md` (thêm ~31 dòng, bỏ 2 dòng cũ) và D-T32; chuyển Bull Board sang header/cookie, bỏ `?token=` | S |
| P2 | Cân nhắc lưu refresh token bằng cookie httpOnly | L |

## Xác minh (Bước 6) — những gì đã chạy, kết quả thật

- **Build/type/lint/test (chạy hôm nay, 2026-11-10, trên cùng mã nguồn; `1d6962e` chỉ thêm tài liệu so với `b5d7e49`):** `npx turbo run typecheck lint --force` 6/6 task thành công; web unit 36/36; API unit 142/142 (16 suite); supertest 392/392 (22 suite, DB `aurelia_test` dựng mới); MinIO API 7/7; Playwright API thật 69/69 (11 nhóm) và MinIO 2/2; hai lượt liên tiếp giống nhau (chi tiết ở `docs/FINAL_READY_TO_MERGE_REPORT.md` §7-8). `npm run build` cho `apps/api` không chạy riêng trong audit này (chỉ build gián tiếp qua e2e) để không sinh thêm tệp.
- **Chạy thật + curl (phiên audit):** khởi động `apps/api/dist/main.js` trên cổng 4012 với DB `aurelia_test`; `/health` trả `database/redis/storage/smtp/queues: up`; log khởi động có **210 dòng `Mapped {…}`** = đúng 210 endpoint trích bằng phân tích tĩnh. Đã curl: `GET /coupons/me` 200, `/coupons/suggested` 200, `POST /coupons/save` 400 `COUPON_INVALID`, `GET /orders/counts` 200, `GET /products/:slug/related` 200, `GET /spaces/facets` 200, `GET /admin/users/:id/{orders,reviews,wishlist}` 200, `GET /admin/panoramas/1/placements` 200, `POST /auth/google` **503**, `POST /admin/orders {}` 400 `VALIDATION_FAILED`. Sau đó tắt tiến trình (cổng 4012 giải phóng). Không chạy mutation lên `aurelia_dev`/`aurelia_demo`/`aurelia_living`.
- **Giới hạn:** không đọc từng dòng của toàn bộ 634 tệp mã nguồn (ts/tsx/mjs/prisma); phân loại endpoint "✅" dựa trên (1) route có thân gọi service, (2) service chạm DB hoặc ủy quyền sang service có DB, (3) có test hoặc đã curl. Phần "FE nối API thật" dựa trên quét lời gọi `http.*`/`xxxApi.*` (một số lời gọi động có thể bị bỏ sót, đã đối chiếu tay với các trường hợp nghi ngờ). Hành vi trình duyệt (UI) chỉ được xác nhận bởi e2e Playwright đã chạy, không bằng việc tự mở từng trang.
