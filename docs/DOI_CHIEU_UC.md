# Đối chiếu Hiện trạng Chức năng với Đặc tả Use Case (DOI_CHIEU_UC)

Tài liệu đối chiếu toàn bộ các use case được định nghĩa trong `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` với mã nguồn hiện tại của dự án Aurelia Living (nhánh `feature/backend`).

> **Phạm vi loại trừ đã chốt theo quyết định chủ dự án:**
> - **7 Use case AR (ngoài phạm vi đồ án theo D-P11):** `UC-3D-02`, `UC-3D-04`, `UC-3D-05`, `UC-3D-06`, `UC-3D-07`, `UC-ADM-30`, và phần AR của `UC-ADM-29` (chuyển sang hướng phát triển; schema DB giữ nguyên theo chuẩn nhưng không dùng).
> - **4 Use case Ứng dụng Android (tạm hoãn theo D-P09):** `UC-MOB-01`, `UC-MOB-02`, `UC-MOB-03`, `UC-MOB-04`.
>
> Tổng số use case trong bảng đối chiếu: **70** use case.

---

## 1. Bảng đối chiếu chi tiết

| Mã UC | Tên Use Case | Mức ưu tiên | Endpoint API chính | Trang Web / Giao diện FE | File test kiểm thử (Supertest / Playwright / Unit) | Trạng thái | Ghi chú & Đối chiếu CHUAN_MO_RONG |
|---|---|---|---|---|---|---|---|
| **UC-AUTH-01** | Đăng ký tài khoản | Bắt buộc | `POST /api/auth/register` | `/register` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/admin-m2.spec.ts` | ✅ Đủ | — |
| **UC-AUTH-02** | Đăng nhập | Bắt buộc | `POST /api/auth/login` | `/login` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | JWT mang sid (D-P15); vai trò đọc từ DB mỗi request (D-T55) |
| **UC-AUTH-03** | Làm mới access token | Bắt buộc | `POST /api/auth/refresh` | `(Client tự động khi 401)` | `apps/web/tests/unit/api-refresh.test.ts, apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | Xoay vòng refresh token, thu hồi phiên cũ |
| **UC-AUTH-04** | Đăng xuất | Bắt buộc | `POST /api/auth/logout` | `Menu người dùng` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | Thu hồi phiên trong user_sessions |
| **UC-AUTH-05** | Quên mật khẩu (yêu cầu đặt lại) | Bắt buộc | `POST /api/auth/forgot-password` | `/forgot-password` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | Gửi email chứa liên kết token một lần (D-N09) |
| **UC-AUTH-06** | Đặt lại mật khẩu | Bắt buộc | `POST /api/auth/reset-password` | `/reset-password` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | — |
| **UC-AUTH-07** | Xác thực email | Nên có | `POST /api/auth/verify-email` | `/verify-email` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | JWT ký riêng mục đích verify_email (D-N09) |
| **UC-ACC-01** | Xem hồ sơ cá nhân | Bắt buộc | `GET /api/users/me` | `/account` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | — |
| **UC-ACC-02** | Cập nhật hồ sơ cá nhân | Bắt buộc | `PATCH /api/users/me` | `/account` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | — |
| **UC-ACC-03** | Quản lý phiên đăng nhập | Mở rộng | `GET /api/users/me/sessions, DELETE /api/users/me/sessions/:id` | `/account/sessions` | `apps/api/test/extension.db-spec.ts, apps/web/tests/e2e/ext-uc.spec.ts` | ✅ Đủ | Thu hồi phiên có hiệu lực ngay (D-P15, D-T55; CHUAN_MO_RONG mục 35) |
| **UC-ACC-04** | Đổi mật khẩu | Bắt buộc | `PATCH /api/users/me/password` | `/account` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | Có tùy chọn đăng xuất mọi thiết bị khác |
| **UC-ACC-05** | Quản lý sổ địa chỉ | Bắt buộc | `GET/POST/PATCH/DELETE /api/addresses` | `/account/addresses` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | — |
| **UC-ACC-06** | Quản lý danh sách yêu thích | Bắt buộc | `GET/POST/DELETE /api/wishlist` | `/wishlist, /products/:slug` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | — |
| **UC-ACC-07** | Yêu cầu xóa tài khoản (xóa mềm) | Mở rộng | `DELETE /api/users/me` | `/account` | `apps/api/test/extension.db-spec.ts, apps/web/tests/e2e/ext-uc.spec.ts` | ✅ Đủ | Kiểm mật khẩu, chặn xóa khi còn đơn pending...shipping (D-P15; CHUAN_MO_RONG mục 35) |
| **UC-CAT-01** | Xem trang chủ | Bắt buộc | `GET /api/categories, /api/products/featured, /api/banners` | `/` | `apps/web/tests/unit/mock-data.test.ts, apps/web/tests/e2e/home.spec.ts` | ✅ Đủ | — |
| **UC-CAT-02** | Duyệt sản phẩm theo danh mục & bộ lọc | Bắt buộc | `GET /api/products?category=&brand=&minPrice=&maxPrice=&sort=` | `/products?category=` | `apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | — |
| **UC-CAT-03** | Tìm kiếm sản phẩm | Bắt buộc | `GET /api/products?q=` | `/products?q=` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | Tìm kiếm không dấu tiếng Việt (D-N18) |
| **UC-CAT-04** | Xem chi tiết sản phẩm | Bắt buộc | `GET /api/products/:slug` | `/products/:slug` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/product360.spec.ts` | ✅ Đủ | Bao gồm biến thể, thông số, ảnh, cấu hình 360/3D |
| **UC-CAT-05** | Xem trang tĩnh / bài viết / chính sách | Bắt buộc | `GET /api/pages/:slug` | `/about, /policy/:slug` | `apps/api/test/mock-m4.db-spec.ts` | 🟡 Lệch: CHUAN_MO_RONG Phần 2 mục 2 | Lưu Markdown nguyên văn, FE hiển thị bằng react-markdown (D-T53) |
| **UC-CAT-06** | Xem sản phẩm dạng 360° | Bắt buộc | `GET /api/products/:slug/360` | `/products/:slug/360` | `apps/web/tests/unit/mock-data.test.ts, apps/web/tests/e2e/product360.spec.ts` | 🟡 Lệch: CHUAN_MO_RONG mục 15 | Bảng mở rộng product_360_configs, product_360_frames |
| **UC-REV-01** | Xem đánh giá sản phẩm | Bắt buộc | `GET /api/products/:slug/reviews` | `/products/:slug` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | Chỉ hiện đánh giá approved |
| **UC-REV-02** | Viết đánh giá sản phẩm | Bắt buộc | `POST /api/reviews` | `/account/orders/:code` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | Ràng buộc đơn completed của chính user, email đã xác thực (D-N04, D-N06) |
| **UC-REV-03** | Sửa / Xóa đánh giá | Nên có | `PATCH/DELETE /api/reviews/:id` | `/account/reviews` | `apps/api/test/mock-m3.db-spec.ts` | ✅ Đủ | Chỉ sửa/xóa đánh giá của chính mình |
| **UC-3D-01** | Xem mô hình 3D sản phẩm | Bắt buộc | `GET /api/products/:slug/model` | `/products/:slug/3d` | `apps/web/tests/e2e/admin-models.spec.ts` | ✅ Đủ | Hệ thống chỉ nhận và phục vụ GLB (D-P11; AR chuyển sang ngoài phạm vi) |
| **UC-3D-03** | Đổi màu / vật liệu mô hình 3D | Nên có | `GET /api/products/:slug/model (materialVariants)` | `/products/:slug/3d` | `apps/api/test/model-materials.db-spec.ts, apps/web/tests/e2e/materials.spec.ts` | ✅ Đủ | Áp config ngay ở client theo D-T56 (CHUAN_MO_RONG mục 36) |
| **UC-SPACE-01** | Danh sách không gian mẫu | Bắt buộc | `GET /api/spaces` | `/spaces` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/spaces360.spec.ts` | ✅ Đủ | Hỗ trợ lọc roomType, style, q, product |
| **UC-SPACE-02** | Khám phá không gian mẫu 360° | Bắt buộc | `GET /api/spaces/:slug` | `/spaces/:slug` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/spaces360.spec.ts` | ✅ Đủ | R3F + sphere panorama + hotspots + placements 3D |
| **UC-SPACE-03** | Tương tác điểm nóng (Hotspot) | Bắt buộc | `(Dữ liệu lồng trong GET /api/spaces/:slug)` | `/spaces/:slug` | `apps/web/tests/e2e/spaces360.spec.ts` | ✅ Đủ | Loại product, info, nav |
| **UC-SPACE-04** | Lưu và xem lại không gian mẫu | Nên có | `POST/DELETE /api/spaces/:slug/bookmark, GET /api/spaces?bookmarked=true` | `/account/spaces` | `apps/api/test/mock-m3.db-spec.ts` | ✅ Đủ | — |
| **UC-SPACE-05** | Đổi sản phẩm trong không gian (Đổi món) | Nên có | `GET /api/spaces/:slug/placements/:id/alternatives` | `/spaces/:slug` | `apps/api/test/placements.db-spec.ts, apps/web/tests/e2e/placements360.spec.ts` | ✅ Đủ | Đổi mô hình tại client, không ghi DB (D-T57; CHUAN_MO_RONG mục 37) |
| **UC-SPACE-06** | Thống kê tương tác không gian & liên kết từ sản phẩm | Nên có | `POST /api/spaces/:slug/views` | `/products/:slug, /spaces/:slug` | `apps/api/test/space-source.db-spec.ts, apps/web/tests/e2e/space-source.spec.ts` | ✅ Đủ | sendBeacon khi rời trang kèm sourceProductId; trang sản phẩm có khối liên kết gắn ?from=<slug> |
| **UC-CART-01** | Thêm sản phẩm vào giỏ hàng | Bắt buộc | `POST /api/cart/items` | `/products/:slug` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | Bắt variantId, kiểm tồn kho, upsert tự tạo giỏ |
| **UC-CART-02** | Xem giỏ hàng | Bắt buộc | `GET /api/cart` | `/cart` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | Tính giá hiện hành, kiểm tồn kho |
| **UC-CART-03** | Cập nhật số lượng / xóa dòng trong giỏ | Bắt buộc | `PATCH /api/cart/items/:id, DELETE /api/cart/items/:id, DELETE /api/cart` | `/cart` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | — |
| **UC-CART-04** | Áp mã giảm giá | Nên có | `POST /api/cart/coupon` | `/cart` | `apps/api/test/mock-m3.db-spec.ts` | 🟡 Lệch: CHUAN_MO_RONG mục 10 | Lưu coupon_id vào giỏ để hỗ trợ FE, kiểm tra lại khi tạo đơn (D-N16) |
| **UC-ORD-01** | Đặt hàng (Checkout) | Bắt buộc | `POST /api/orders` | `/checkout` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/screens.spec.ts` | ✅ Đủ | Trừ tồn kho ngay (D-N05), tính phí ship theo vùng (D-N26), mã ALV-YYYYMMDD-NNNN |
| **UC-ORD-02** | Xem danh sách và chi tiết đơn hàng | Bắt buộc | `GET /api/orders, GET /api/orders/:code` | `/account/orders, /account/orders/:code` | `apps/api/test/mock-m3.db-spec.ts` | ✅ Đủ | — |
| **UC-ORD-03** | Khách hủy đơn hàng | Bắt buộc | `POST /api/orders/:code/cancel` | `/account/orders/:code` | `apps/api/test/mock-m3.db-spec.ts` | ✅ Đủ | Chỉ hủy khi pending/confirmed; hoàn tồn kho và lượt dùng coupon (D-N01) |
| **UC-PAY-01** | Chọn phương thức thanh toán | Bắt buộc | `(Tích hợp trong POST /api/orders)` | `/checkout` | `apps/api/test/mock-m3.db-spec.ts` | ✅ Đủ | Hỗ trợ COD, chuyển khoản ngân hàng, VNPAY sandbox (D-N20, D-N23) |
| **UC-PAY-02** | Xử lý kết quả thanh toán online | Bắt buộc | `GET /api/payments/vnpay/return, POST /api/payments/vnpay/ipn` | `/checkout/result` | `apps/api/test/mock-m4.db-spec.ts` | 🟡 Lệch: CHUAN_MO_RONG Phần 2 mục 13 | VNPAY giả lập sandbox khi chưa có khóa thật; thanh toán sau hủy đơn theo D-N28 |
| **UC-PAY-03** | Thanh toán lại đơn hàng | Nên có | `POST /api/orders/:code/repay` | `/account/orders/:code` | `apps/api/test/mock-m4.db-spec.ts` | ✅ Đủ | Khi đơn online thất bại nhưng đơn vẫn pending |
| **UC-ADM-01** | Quản lý người dùng | Bắt buộc | `GET/PATCH /api/admin/users` | `/admin/customers` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/admin-m2.spec.ts` | ✅ Đủ | Khóa / mở khóa tài khoản |
| **UC-ADM-02** | Phân quyền quản trị & vai trò | Mở rộng | `GET /api/admin/roles, PUT/DELETE /api/admin/users/:id/roles/admin` | `/admin/roles, /admin/customers/:id` | `apps/api/test/extension.db-spec.ts, apps/api/test/permissions.db-spec.ts, apps/web/tests/e2e/ext-uc.spec.ts` | ✅ Đủ | Quyền PermissionsGuard (D-P12); gán/gỡ admin có hiệu lực ngay (D-P15, D-T55) |
| **UC-ADM-03** | Cài đặt hệ thống | Bắt buộc | `GET/PUT /api/admin/settings/:key` | `/admin/settings` | `apps/api/test/mock-m4.db-spec.ts, apps/web/tests/e2e/admin-m4.spec.ts` | ✅ Đủ | Cửa hàng, thanh toán, vùng vận chuyển |
| **UC-ADM-04** | Thư viện media & lưu trữ | Bắt buộc | `POST /api/admin/media, DELETE /api/admin/media/:id, presign` | `/admin/media` | `apps/api/test/minio-flow.minio-spec.ts, apps/web/tests/e2e/admin-minio.spec.ts` | ✅ Đủ | Hỗ trợ MinIO/S3 (D-P13) và local; presign cho tệp lớn |
| **UC-ADM-05** | Quản lý danh mục | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/categories` | `/admin/categories` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/admin-m2.spec.ts` | ✅ Đủ | — |
| **UC-ADM-06** | Quản lý thương hiệu | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/brands` | `/admin/brands` | `apps/api/test/mock-m5.db-spec.ts, apps/web/tests/e2e/admin-m5.spec.ts` | ✅ Đủ | — |
| **UC-ADM-07** | Quản lý bài viết & nội dung | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/pages, /admin/banners, /admin/posts` | `/admin/content` | `apps/api/test/mock-m4.db-spec.ts, apps/web/tests/e2e/admin-m4.spec.ts` | 🟡 Lệch: CHUAN_MO_RONG Phần 2 mục 2 | Soạn thảo bằng Markdown |
| **UC-ADM-08** | Quản lý thuộc tính sản phẩm | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/attributes` | `/admin/attributes` | `apps/api/test/mock-m5.db-spec.ts, apps/web/tests/e2e/admin-m5.spec.ts` | ✅ Đủ | — |
| **UC-ADM-09** | Quản lý sản phẩm | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/products` | `/admin/products` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/admin-m2.spec.ts` | ✅ Đủ | Xóa mềm sản phẩm |
| **UC-ADM-10** | Quản lý biến thể sản phẩm | Bắt buộc | `POST/PUT/DELETE /api/admin/products/:id/variants` | `/admin/products/:id` | `apps/api/test/mock-m2.db-spec.ts, apps/web/tests/e2e/admin-m2.spec.ts` | ✅ Đủ | — |
| **UC-ADM-11** | Quản lý ảnh sản phẩm | Bắt buộc | `POST/PATCH/DELETE /api/admin/products/:id/images` | `/admin/products/:id` | `apps/api/test/mock-m2.db-spec.ts` | ✅ Đủ | — |
| **UC-ADM-12** | Quản lý tồn kho & phiếu kho | Bắt buộc | `GET /api/admin/inventory, POST /api/admin/inventory/receipts` | `/admin/inventory` | `apps/api/test/mock-m4.db-spec.ts, apps/web/tests/e2e/admin-m4.spec.ts` | 🟡 Lệch: CHUAN_MO_RONG Phần 1 mục 1.1 (#28), D-N24 | Phiếu nhập/xuất kho làm chứng từ, xác nhận mới ghi inventory_movements |
| **UC-ADM-13** | Quản lý & xử lý nền mô hình 3D | Bắt buộc | `POST /api/admin/models/presign, /confirm, PATCH /primary` | `/admin/models` | `apps/api/test/models-processing.db-spec.ts, apps/web/tests/e2e/admin-models.spec.ts` | ✅ Đủ | BullMQ job model-processing sinh LOD high/medium/low, kiểm tra ngưỡng MODEL_SERVE_MAX_MB (D-P10, D-N21, D-N22) |
| **UC-ADM-14** | Quản lý vật liệu theo biến thể mô hình | Nên có | `PUT/DELETE /api/admin/models/:id/material-variants/:variantId` | `/admin/models` | `apps/api/test/model-materials.db-spec.ts, apps/web/tests/e2e/materials.spec.ts` | ✅ Đủ | D-T56, CHUAN_MO_RONG mục 36 |
| **UC-ADM-15** | Quản lý không gian mẫu | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/spaces` | `/admin/spaces` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | — |
| **UC-ADM-16** | Quản lý panorama & hotspot | Bắt buộc | `POST/PUT/DELETE /api/admin/spaces/:id/panoramas, /hotspots` | `/admin/spaces/:id` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | — |
| **UC-ADM-17** | Đặt mô hình 3D vào ảnh 360° | Nên có | `POST/PATCH/DELETE /api/admin/panoramas/:id/placements` | `/admin/spaces/:id` | `apps/api/test/placements.db-spec.ts, apps/web/tests/e2e/placements360.spec.ts` | ✅ Đủ | Tọa độ placement yaw, pitch, distance, scale, rotation (D-T57; CHUAN_MO_RONG mục 37) |
| **UC-ADM-18** | Duyệt đánh giá sản phẩm | Bắt buộc | `GET /api/admin/reviews, PATCH /api/admin/reviews/:id` | `/admin/reviews` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Duyệt / ẩn đánh giá |
| **UC-ADM-19** | Quản lý mã giảm giá | Bắt buộc | `GET/POST/PUT/DELETE /api/admin/coupons` | `/admin/promotions` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Mã percent, fixed, freeship (CHUAN_MO_RONG mục 1.2) |
| **UC-ADM-20** | Xem danh sách và chi tiết đơn hàng | Bắt buộc | `GET /api/admin/orders, GET /api/admin/orders/:code` | `/admin/orders, /admin/orders/:code` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Xuất hóa đơn in HTML |
| **UC-ADM-21** | Cập nhật trạng thái đơn hàng | Bắt buộc | `PATCH /api/admin/orders/:id/status` | `/admin/orders/:code` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Admin chỉ chuyển trạng thái hợp lệ; sang shipping cần có vận đơn; sang completed tự động khi vận đơn delivered (D-N27) |
| **UC-ADM-22** | Quản trị viên hủy đơn hàng | Bắt buộc | `POST /api/admin/orders/:id/cancel` | `/admin/orders/:code` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Hủy trước shipping, hoàn tồn kho và coupon (D-N01) |
| **UC-ADM-23** | Hoàn tiền đơn hàng | Bắt buộc | `POST /api/admin/orders/:id/refund` | `/admin/orders/:code` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Hoàn tiền thủ công (D-N03, D-N15); sinh phiếu chi refund (D-N25) |
| **UC-ADM-24** | Xác nhận thanh toán chuyển khoản | Nên có | `POST /api/admin/payments/:id/confirm` | `/admin/orders/:code` | `apps/api/test/mock-m4.db-spec.ts, apps/web/tests/e2e/admin-m4.spec.ts` | ✅ Đủ | Đối chiếu thủ công và tự chuyển đơn pending -> confirmed (D-N23, O-04) |
| **UC-ADM-25** | Quản lý vận đơn | Bắt buộc | `POST /api/admin/orders/:id/shipments, PATCH /api/admin/shipments/:id` | `/admin/orders/:code` | `apps/api/test/mock-m3.db-spec.ts, apps/web/tests/e2e/admin-m3.spec.ts` | ✅ Đủ | Vận đơn delivered tự chuyển đơn completed (D-N14, D-N27) |
| **UC-ADM-26** | Gửi thông báo người dùng | Mở rộng | `POST /api/admin/notifications` | `/admin/notifications` | `apps/api/test/extension.db-spec.ts, apps/web/tests/e2e/ext-uc.spec.ts` | ✅ Đủ | Gửi cho một hoặc tất cả người dùng (D-P15; CHUAN_MO_RONG mục 35) |
| **UC-ADM-27** | Xem nhật ký hoạt động | Mở rộng | `GET /api/admin/activity-logs` | `/admin/activity-logs` | `apps/api/test/extension.db-spec.ts, apps/api/test/activity-interceptor.db-spec.ts, apps/web/tests/e2e/ext-uc.spec.ts` | ✅ Đủ | Lọc quản trị viên, hành động, ngày; gắn nhãn Tự động nếu do interceptor ghi bù (D-P12, D-P15) |
| **UC-ADM-28** | Báo cáo thống kê tổng quan & thu chi | Bắt buộc | `GET /api/admin/stats/overview, /stats/finance, /expenses` | `/admin, /admin/reports` | `apps/api/test/mock-m4.db-spec.ts, apps/web/tests/e2e/admin-m4.spec.ts` | 🟡 Lệch: CHUAN_MO_RONG Phần 1 mục 1.4, D-N25 | Công thức thu chi theo phiếu nhập hoàn tất (cogs) và hoàn tiền (refund) |
| **UC-ADM-29** | Thống kê hiệu quả không gian mẫu | Nên có | `GET /api/admin/stats/spaces` | `/admin/reports/spaces` | `apps/api/test/space-funnel.db-spec.ts, apps/web/tests/e2e/admin-m4.spec.ts` | ⚠️ Một phần (Phần phễu không gian Đủ; phần AR bỏ theo D-P11; CHUAN_MO_RONG mục 38) | Phễu người xem -> bấm hotspot -> thêm vào giỏ; kèm top sản phẩm nguồn dẫn tới (D-T58) |

---

## 2. Thống kê tổng hợp

- **Tổng số use case theo đặc tả DAC_TA:** 80 UC
- **Số use case ngoài phạm vi / tạm hoãn:** 10 UC (6 UC AR + 4 UC Android; riêng UC-ADM-29 giữ lại phần phễu không gian)
- **Số use case được đánh giá trong phạm vi hiện tại:** **70 UC**
  - **Đạt đầy đủ (Đủ):** **62** UC (89%)
  - **Lệch có ghi nhận tại CHUAN_MO_RONG (Lệch):** **7** UC (10%)
    - `UC-CAT-05`: Soạn thảo trang tĩnh bằng Markdown nguyên văn (CONG_NGHE, D-T53, CHUAN_MO_RONG Phần 2 mục 2).
    - `UC-CAT-06`: Xem sản phẩm dạng 360° xoay ảnh bằng bảng mở rộng `product_360_configs/frames` (CHUAN_MO_RONG mục 15).
    - `UC-CART-04`: Giỏ hàng lưu `coupon_id` để FE hiển thị mã đang áp (CHUAN_MO_RONG mục 10).
    - `UC-PAY-02`: VNPAY giả lập cho đồ án sandbox khi chưa có tài khoản thật (CHUAN_MO_RONG Phần 2 mục 13).
    - `UC-ADM-07`: Quản lý nội dung bài viết và trang bằng Markdown (CHUAN_MO_RONG Phần 2 mục 2).
    - `UC-ADM-12`: Quản lý kho bằng phiếu nhập/xuất kho chứng từ theo phương án b' (D-N24, CHUAN_MO_RONG Phần 1 mục 1.1 #28).
    - `UC-ADM-28`: Công thức báo cáo thu chi tính giá vốn theo phiếu nhập kho hoàn tất và hoàn tiền (D-N25, CHUAN_MO_RONG Phần 1 mục 1.4).
  - **Một phần (Một phần):** **1** UC
    - `UC-ADM-29`: Phần phễu tương tác không gian mẫu theo lượt xem, hotspot, giỏ hàng đã làm hoàn chỉnh (D-T58, CHUAN_MO_RONG mục 38); phần thống kê AR nằm ngoài phạm vi theo D-P11.
- **Tỷ lệ có test bao phủ:** **100%** (70/70 UC đều có file test tự động supertest/Playwright/unit tương ứng, không có UC nào bỏ trống).
