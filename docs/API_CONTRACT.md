> Cập nhật lần cuối: 2026-11-25 – theo commit `a13386e`.

# API CONTRACT – Aurelia Living (Frontend ⇄ Backend)

> **Nguồn sự thật:** lớp mock API của Frontend (`apps/web/src/mock-data/mockApi/*`) và lớp service (`apps/web/src/services/*.api.ts`). Tài liệu này được **trích xuất tự động** từ hai nơi đó (bảng endpoint ở mục 4) và từ `apps/web/src/types/api.ts` (kiểu response, Phụ lục A). Backend phải khớp: path, method, query, body, hình dạng response, mã lỗi. Lệch ⇒ sửa Backend, không sửa giao diện.
> Cập nhật: 2026-11-06 (Giai đoạn 4). **Bảng endpoint ở mục 4 đã được đối chiếu lại với code ngày 2026-11-25** (152 route khớp 152 dòng `Mapped {…}` khi API khởi động; spec sinh từ code ở [api/openapi.json](api/openapi.json), cách xuất lại ở [api/README.md](api/README.md)). Phần Phụ lục A (kiểu response) vẫn trích từ FE và có thể lệch: khi lệch, **code và spec OpenAPI là nguồn đúng**.

## 1. Quy ước chung

| Hạng mục | Giá trị |
|---|---|
| Base URL | `${NEXT_PUBLIC_API_URL}/api` (mặc định `http://localhost:4000/api`); `GET /health` nằm ngoài `/api` |
| Định dạng | JSON `camelCase`; ngày ISO 8601 UTC (`2026-10-08T06:00:00.000Z`); tiền là **số nguyên VNĐ** (Prisma `Decimal` → `number`) |
| Header | `Content-Type: application/json`; `Authorization: Bearer <accessToken>` khi đã đăng nhập |
| Định danh | API công khai dùng **slug** (`/products/:slug`, `/spaces/:slug`); đơn hàng của khách tra theo **mã đơn** (`/orders/:code`) nhưng hủy/thanh toán theo **id**; API đã đăng nhập/admin dùng `id` số nguyên |
| Query mảng | FE gửi `a,b,c` (nối dấu phẩy), BE phải tách. Giá trị rỗng/`undefined` không được gửi |
| Phân trang | `page` (≥1), `pageSize` (mặc định 20, tối đa 100). Nếu `page` vượt `totalPages` thì FE mock **kẹp về trang cuối** – BE nên giống |
| Sắp xếp | `sort=truong:asc` hoặc `truong:desc` (whitelist trường) |
| Tìm kiếm | `q`, **không phân biệt dấu/hoa thường** (`sofa` khớp `Sofa`, `ban tra` khớp `Bàn trà`) |

### 1.1 Envelope

```jsonc
// thành công
{ "success": true, "data": <T> }
// danh sách phân trang
{ "success": true, "data": [<T>], "meta": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 } }
// xóa / không có dữ liệu: "data": null  (HTTP 200, không dùng 204)
// lỗi
{ "success": false, "error": { "code": "VALIDATION_FAILED", "message": "Dữ liệu không hợp lệ.", "details": { "email": ["Email không hợp lệ."] } } }
```

- `details` của `VALIDATION_FAILED`: `{ "<trường>": ["thông báo", …] }` – FE đọc phần tử đầu (`ApiClientError.fieldErrors()`), tên trường **phải trùng tên trường body FE gửi** (`email`, `password`, `fullName`, `phone`…).
- HTTP status theo `ERROR_HTTP_STATUS` trong `packages/shared-types/src/error-codes.ts`: `VALIDATION_FAILED/BAD_REQUEST/COUPON_INVALID` 400 · `AUTH_UNAUTHENTICATED/AUTH_INVALID_CREDENTIALS/AUTH_TOKEN_*` 401 · `AUTH_ACCOUNT_LOCKED/FORBIDDEN/PURCHASE_REQUIRED` 403 · `RESOURCE_NOT_FOUND` 404 · `CONFLICT/EMAIL_ALREADY_EXISTS/OUT_OF_STOCK/INVALID_STATE/RESOURCE_IN_USE` 409 · `PAYLOAD_TOO_LARGE` 413 · `UNSUPPORTED_MEDIA_TYPE` 415 · `RATE_LIMITED` 429 · `INTERNAL_ERROR` 500.
- Thông báo lỗi bằng tiếng Việt (FE hiển thị trực tiếp `error.message`). Lỗi 5xx không lộ nội dung nội bộ.

### 1.2 Xác thực (cách FE đang làm)

- FE lưu `accessToken` + `refreshToken` (Zustand persist `localStorage`) và gửi `Authorization: Bearer`. Khi gặp `401` FE gọi `POST /auth/refresh` **một lần** (dùng chung một promise cho các request song song) rồi thử lại; refresh thất bại ⇒ đăng xuất cục bộ. BE trả `{ user, tokens:{accessToken, refreshToken} }` trong body. Access token sống `JWT_ACCESS_EXPIRES_IN` (production ≤ 15 phút); refresh token xoay vòng, `POST /auth/logout` gửi `refreshToken` để thu hồi.
- 401 khi **có gửi token** ⇒ FE đăng xuất cục bộ. Vì vậy chỉ trả 401 khi token thật sự sai/hết hạn; thiếu quyền trả 403.
- Khách gọi `/admin/*` ⇒ `403 FORBIDDEN` ("Bạn không có quyền truy cập khu vực quản trị."). Tài khoản `suspended/banned` ⇒ `403 AUTH_ACCOUNT_LOCKED` ở đăng nhập và ở mọi request.
- Đăng nhập admin dùng cùng endpoint `POST /auth/login` với `adminOnly: true`; tài khoản không phải admin ⇒ `403 FORBIDDEN` ("Tài khoản không có quyền quản trị.").
- Thông báo lỗi đăng nhập: sai email/mật khẩu ⇒ `401 AUTH_INVALID_CREDENTIALS` "Email hoặc mật khẩu không đúng." (không tiết lộ email có tồn tại hay không).
- Quên mật khẩu **bằng liên kết token qua email** (không còn OTP): `POST /auth/forgot-password` gửi email chứa `/reset-password?token=<64 hex>`; token hash SHA-256 trong `password_resets`, hết hạn sau 30 phút, chỉ dùng một lần, gửi lại tối thiểu cách 60 giây. Email dev xem ở Mailpit (http://localhost:8025).
- Xác thực email: đăng ký gửi email chứa `/verify-email?token=<JWT purpose verify_email>`; `POST /auth/verify-email {token}`, `POST /auth/resend-verification` (cần đăng nhập). **Chưa xác thực email ⇒ không đánh giá được** (`403 EMAIL_NOT_VERIFIED`).

### 1.3 Nguyên tắc khớp dữ liệu

1. **Tên trường API = tên trường mock** (xem Phụ lục A); tên cột DB có thể khác, map ở serializer.
2. Mọi response entity = bản ghi bảng (camelCase, `Decimal`→`number`, ngày ISO) + trường mở rộng của `*View`.
3. Trường đánh dấu `TODO: chưa có trong DB` ở Phụ lục A nghĩa là DB hiện tại **chưa có cột/bảng**; thiết kế bổ sung ở `docs/BACKEND_DESIGN.md` mục 3.
4. Giỏ hàng, giá, giảm giá, phí ship, tổng tiền **luôn do server tính** (FE chỉ hiển thị).

### 1.4 Hình dạng response không phải entity

| Endpoint | `data` |
|---|---|
| `POST /auth/login`, `/auth/register`, `/auth/google` | `{ user: SessionUser, tokens: { accessToken, refreshToken } }` – `SessionUser = { id, uuid, email, fullName, status, roles: ('admin'\|'user')[], avatarUrl: string\|null, phone: string\|null }` (201 cho register) |
| `POST /auth/logout` | `null` |
| `POST /auth/forgot-password` | `{ sent: true }` (luôn thành công kể cả email không tồn tại – chống dò email) |
| `POST /auth/reset-password` | `null`; token sai/hết hạn/đã dùng ⇒ `400 BAD_REQUEST` |
| `POST /auth/verify-email` | `null`; token sai/hết hạn ⇒ `400 BAD_REQUEST` |
| `POST /auth/resend-verification` | `{ sent: true }` |
| `GET /orders/counts`, `GET /admin/orders/counts` | `{ all, pending, confirmed, processing, shipping, completed, cancelled, refunded }` (số đơn theo trạng thái; admin: toàn hệ thống, khách: của mình) |
| `POST /payments/:orderId/checkout`, `/retry` | `{ redirectUrl: string, paymentUrl?, expiresAt? }` – URL tương đối của FE (`/checkout/success?order=<code>` hoặc `/checkout/failed?order=<code>`) hoặc URL cổng thanh toán (VNPAY) |
| `GET /payments/vnpay/return-status` | `{ valid: false }` hoặc `{ valid: true, orderCode, responseCode, paymentStatus }` |
| `GET /notifications/unread-count` | `{ count: number }` |
| `GET /products/:slug/model` | `Model3DView \| null` (kèm `materialVariants[{ variantId, materialName, config }]`, D-T56) |
| `GET /products/facets` | `ProductFacets` (theo bộ lọc hiện tại, trừ chính nó) |
| `GET /spaces/facets` | `{ styles:[{value,count}], roomTypes:[{value,count}] }` |
| `GET /faq` | `FaqTopic[]` = `[{ key, label, items:[{ id, question, answer }] }]` |
| `GET /admin/inventory/summary` | `{ totalStock, stockValue, lowCount, outCount }` |
| `GET /admin/notifications` | `[{ id, text, createdAt, link }]` |
| `GET /admin/search?q=` | `[{ type:'product'\|'order'\|'customer', label, href }]` |
| `GET /admin/users/:id` | `UserView & { addresses: AddressView[], recentActivity: [{ text, createdAt }] }` |
| `PUT/DELETE /wishlist/:slug` | `null` |
| `DELETE /addresses/:id` | `null` (xóa địa chỉ mặc định duy nhất ⇒ `409 INVALID_STATE`) |
| `GET /cart?items=1,2&addressId=3` | `CartView` – `items` lọc các dòng được chọn (mua ngay), `addressId` để tính phí ship theo tỉnh của địa chỉ |

### 1.5 Quy tắc nghiệp vụ FE đang dựa vào (BE phải giữ)

- **Đơn hàng**: mã `ALV-YYYYMMDD-NNNNNN` (NNNNNN lấy từ sequence PostgreSQL `order_code_seq`). Luồng `pending → confirmed → processing → shipping → completed`; `cancelled` chỉ từ `pending|confirmed|processing`; **khách tự hủy khi `pending` hoặc `confirmed`** (FE hiện nút Hủy ở hai trạng thái này; admin hủy thêm được ở `processing`). Sai luồng ⇒ `409 INVALID_STATE` ("Không thể chuyển đơn từ "x" sang "y"."). Chuyển `shipping` tự tạo `shipment` (mã vận đơn); chuyển `completed` ⇒ shipment `delivered` + COD tự `paid`.
- **Phí ship**: theo `settings.shippingZones` khớp `province` của địa chỉ (`fee`, `freeFrom`); `subtotal >= freeFrom` ⇒ 0.
- **Coupon**: kiểm tra hạn, đơn tối thiểu, giảm tối đa (mã áp cho toàn giỏ), lượt dùng tổng/khách ⇒ lỗi `400 COUPON_INVALID` kèm lý do tiếng Việt. Loại `percent | fixed | freeship`.
- **Đánh giá**: chỉ sản phẩm thuộc đơn `completed` của chính khách (`403 PURCHASE_REQUIRED`), trùng (khách+sản phẩm+đơn) ⇒ `409 CONFLICT`; đánh giá mới ở trạng thái `pending`, admin duyệt `approved` mới hiện công khai và tính vào rating.
- **Tồn kho**: thêm giỏ/đặt vượt tồn ⇒ `409 OUT_OF_STOCK` kèm `details:{ variantId, available }`.

## 2. Mapping nhóm endpoint ⇄ màn hình FE

| Nhóm | Màn hình (WIREFRAME) |
|---|---|
| `auth`, `users`, `addresses` | Đăng nhập/đăng ký/quên mật khẩu (7.1–7.4), Hồ sơ, Sổ địa chỉ, Đổi mật khẩu, Admin login |
| `categories`, `products*`, `wishlist`, `reviews` | Trang chủ, Danh sách/Tìm kiếm/Chi tiết sản phẩm, 3D (7.7), Yêu thích, Đánh giá của tôi |
| `spaces*` | Không gian mẫu (2.14, 7.6) |
| `cart`, `orders`, `payments` | Giỏ hàng, Thanh toán, Thành công/Thất bại, Đơn hàng của tôi/Chi tiết, Mã giảm giá |
| `notifications`, `faq`, `settings/public` | Thông báo, FAQ, footer (trang tĩnh viết cứng ở `apps/web/src/content/static-pages.ts`) |
| `admin/*` | Admin Panel: Tổng quan, Sản phẩm, Danh mục, Đơn hàng, Khách hàng, Đánh giá, Mô hình 3D, Khuyến mãi, Không gian mẫu, Cài đặt, Kho (xem tồn), Doanh thu |


## 4. Danh sách endpoint (210)

Quy ước cột: **Quyền** = `public` (không cần token) · `user` (Bearer token khách hoặc admin) · `admin` (role admin). **Query** = tham số FE gửi. **Lỗi** = mã lỗi mock đang ném (ngoài `VALIDATION_FAILED`, `AUTH_*`, `FORBIDDEN`, `RESOURCE_NOT_FOUND` áp dụng chung). Phân trang: `page`, `pageSize`, `sort=truong:asc|desc` ở mọi danh sách.

### 4. `auth`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | public | `auth.` |  | { email, password, adminOnly? } | `AUTH_ACCOUNT_LOCKED`, `AUTH_INVALID_CREDENTIALS`, `FORBIDDEN` |
| POST | `/auth/register` | public | `auth.` |  | { fullName (2–150), email (≤255), phone? (10–11 số), password (≥8, hoa+thường+số), confirmPassword } | `EMAIL_ALREADY_EXISTS`, 400 `VALIDATION_FAILED` theo trường |
| POST | `/auth/logout` | public | `auth.logout` |  |  |  |
| POST | `/auth/forgot-password` | public | `auth.forgotPassword` |  | { email } |  |
| POST | `/auth/reset-password` | public | `auth.` |  | { token, newPassword (bí danh `password`), confirmPassword } | `BAD_REQUEST` (token), 400 theo trường (chính sách mật khẩu) |
| POST | `/auth/verify-email` | public | `auth.` |  | { token } | `BAD_REQUEST` |
| POST | `/auth/resend-verification` | user | `auth.` |  |  | `RATE_LIMITED` |
| POST | `/auth/google` | public | `auth.googleLogin` |  |  | **Chưa triển khai (đã hoãn):** luôn `503 SERVICE_UNAVAILABLE` ("chưa được cấu hình"/"đang được hoàn thiện"); xem `apps/api/src/modules/auth/auth.service.ts` (`google()`) |

### 4. `users`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/users/me` | user | `auth.me` |  |  |  |
| PATCH | `/users/me` | user | `auth.` |  | { fullName?, phone?, gender?, birthday?, avatarUrl? } |  |
| POST | `/users/me/change-password` | user | `auth.` |  | { currentPassword, newPassword (hoa+thường+số), confirmPassword, logoutOthers? } | 400 theo trường |

### 4. `addresses`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/addresses` | user | `auth.list` |  |  |  |
| POST | `/addresses` | user | `auth.create` |  | { recipientName, phone, province, district, ward, addressLine, label?, isDefault? } |  |
| PATCH | `/addresses/:id/default` | user | `auth.setDefault` |  |  |  |
| PATCH | `/addresses/:id` | user | `auth.update` |  | Partial của body tạo địa chỉ |  |
| DELETE | `/addresses/:id` | user | `auth.remove` |  |  | `RESOURCE_NOT_FOUND` |

### 4. `categories`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/categories` | public | `product.tree` |  |  |  |

### 4. `products`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/products` | public | `product.list` | `q` (1 ký tự ⇒ rỗng), `category` (không tồn tại/không hoạt động ⇒ 404), `brand`, `minPrice`, `maxPrice`, `color`, `material`, `style`, `has3d`, `featured`, `sort` (`trường:asc\|desc`), `page`, `pageSize` (≤ 100) |  | `RESOURCE_NOT_FOUND` (danh mục) |
| GET | `/products/search` | public | `product.search` | `q`, `category`, `brand`, `minPrice`, `maxPrice`, `color`, `material`, `style`, `has3d`, `featured`, `sort`, `page`, `pageSize` |  |  |
| GET | `/products/facets` | public | `product.facets` | `q`, `category`, `brand`, `minPrice`, `maxPrice`, `color`, `material`, `style`, `has3d`, `featured`, `sort`, `page`, `pageSize` |  |  |
| GET | `/products/:slug` | public | `product.detail` |  |  |  |
| GET | `/products/:slug/model` | public | `product.model` |  |  |  |
| GET | `/products/:slug/related` | public | `product.related` |  |  |  |
| GET | `/products/:slug/reviews` | public | `product.` | `rating` |  |  |
| POST | `/products/:slug/reviews` | user | `product.createReview` |  | { orderId, rating(1-5), content?, tags?, anonymous? } | `CONFLICT`, `PURCHASE_REQUIRED` |

### 4. `wishlist`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/wishlist` | user | `product.list` |  |  |  |
| PUT | `/wishlist/:slug` | user | `product.add` |  |  |  |
| DELETE | `/wishlist/:slug` | user | `product.remove` |  |  |  |

### 4. `reviews`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/reviews/me` | user | `cart.list` |  |  |  |
| PATCH | `/reviews/:id` | user | `cart.` |  | { rating, content?, tags? } |  |
| DELETE | `/reviews/:id` | user | `cart.remove` |  |  |  |

### 4. `spaces`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/spaces` | public | `space.` | `q`, `roomType`, `sort`, `style`, `page`, `pageSize` |  |  |
| GET | `/spaces/facets` | public | `space.facets` |  |  |  |
| GET | `/spaces/:slug` | public | `space.detail` |  |  |  |
| GET | `/spaces/:slug/placements/:placementId/alternatives` | public | `space.alternatives` |  |  | Đổi món (UC-SPACE-05): `[{ id, name, slug, price, salePrice, thumbnailUrl, variantId, model }]` sản phẩm cùng danh mục, đã đăng bán, có mô hình chính ready (≤ 12). Không ghi DB. Không gian/vị trí không có ⇒ `404`. `model` = `{ id, lengthMm, widthMm, heightMm, files:[{ lod, url, fileSize }], materialVariants[] }` |
| POST | `/spaces/:slug/add-to-cart` | user | — |  | { productIds?: number[] } (tùy chọn: chọn một phần các món của không gian; mặc định tất cả) | **Tất cả-hoặc-không** (một transaction): có món ngừng bán/hết hàng/quá tồn ⇒ `409 CONFLICT` kèm `details.unavailable: [{ productId, variantId, name, reason, available? }]`, giỏ KHÔNG đổi; `productIds` không thuộc không gian hoặc rỗng ⇒ `400 VALIDATION_FAILED` (`productIds`); không gian không có/nháp ⇒ `404`. Thành công `200 { added: [{ productId, name, variantId }], unavailable: [], cart }` |

### 4. `cart`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/cart` | user | `cart.get` |  |  |  |
| DELETE | `/cart` | user | `cart.clear` |  |  |  |
| POST | `/cart/items` | user | `cart.addItem` |  | { variantId, quantity } |  |
| PATCH | `/cart/items/:id` | user | `cart.updateItem` |  | { quantity } | `OUT_OF_STOCK` |
| DELETE | `/cart/items/:id` | user | `cart.removeItem` |  |  |  |
| POST | `/cart/coupon` | user | `cart.applyCoupon` |  | { code } | `COUPON_INVALID` |
| DELETE | `/cart/coupon` | user | `cart.removeCoupon` |  |  |  |

### 4. `orders`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/orders` | user | `cart.create` |  | { addressId, paymentMethod, note?, itemIds? } | `BAD_REQUEST`, `OUT_OF_STOCK` |
| GET | `/orders` | user | `cart.` | `status` |  |  |
| GET | `/orders/counts` | user | `cart.counts` |  |  |  |
| GET | `/orders/:code` | user | `cart.detail` |  |  |  |
| POST | `/orders/:id/cancel` | user | `cart.cancel` |  | { reason? } |  |

### 4. `payments`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/payments/:orderId/checkout` | user | `cart.` |  | (không có body; nếu có `outcome`/`amount` sẽ bị bỏ qua) | `INVALID_STATE` (đã trả/đã hủy/không còn pending\|confirmed), `RATE_LIMITED`, `503` khi tắt giả lập và chưa có VNPAY |
| POST | `/payments/:orderId/retry` | user | `cart.` |  | { method? } (`vnpay`, `card`, `bank_transfer`, `cod`) | `INVALID_STATE`, `RATE_LIMITED`, `VALIDATION_FAILED` (momo/zalopay) |
| GET | `/payments/vnpay/return-status` | public (chữ ký VNPay) | `payment.vnpayReturnStatus` | nguyên các tham số `vnp_*` của Return URL |  |  |
| GET | `/payments/vnpay/ipn` | public (chữ ký VNPay) | — | tham số `vnp_*` |  | trả `{ RspCode, Message }` |

### 4. `notifications`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/notifications` | user | `content.` | `type` |  |  |
| GET | `/notifications/unread-count` | user | `content.unreadCount` |  |  |  |
| PATCH | `/notifications/read-all` | user | `content.markAllRead` |  |  |  |
| PATCH | `/notifications/:id/read` | user | `content.markRead` |  |  |  |

### 4. `faq`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/faq` | public | `content.faq` |  |  |  |

### 4. `settings`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/settings/public` | public | `content.settings` |  |  |  |

### 4. `admin/stats`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/stats/overview` | admin | `admin.stats` |  |  |  |
| GET | `/admin/stats/finance` | admin | `admin.finance` |  |  |  |

### 4. `admin/notifications`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/notifications` | admin | `admin.` |  |  |  |

### 4. `admin/search`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/search` | admin | `admin.` | `q` |  |  |

### 4. `admin/products`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/products` | admin | `admin.list` | `category`, `q`, `sort`, `status` |  |  |
| POST | `/admin/products` | admin | `admin.create` |  | như PATCH, đầy đủ trường bắt buộc | `CONFLICT` |
| GET | `/admin/products/:id` | admin | `admin.get` |  |  |  |
| PATCH | `/admin/products/:id` | admin | `admin.` |  | Product form 6 tab (tên, mô tả, danh mục, thương hiệu, trạng thái, biến thể[], ảnh[], specs[], features[]) |  |
| DELETE | `/admin/products/:id` | admin | `admin.remove` |  |  |  |

### 4. `admin/categories`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/categories` | admin | `admin.tree` |  |  |  |
| POST | `/admin/categories` | admin | `admin.create` |  |  |  |
| PATCH | `/admin/categories/:id` | admin | `admin.` |  |  |  |
| DELETE | `/admin/categories/:id` | admin | `admin.remove` |  |  | `RESOURCE_IN_USE` |

### 4. `admin/orders`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/orders` | admin | `admin.list` | `from`, `paymentStatus`, `q`, `sort`, `status`, `to` |  |  |
| POST | `/admin/orders` | admin | `admin.create` |  | { userId, paymentMethod, note?, items:[{variantId, quantity}] } | `BAD_REQUEST`, `OUT_OF_STOCK` |
| GET | `/admin/orders/counts` | admin | `admin.counts` |  |  |  |
| GET | `/admin/orders/:code` | admin | `admin.get` |  |  |  |
| PATCH | `/admin/orders/:id/status` | admin | `admin.` |  | { status, note? } | `INVALID_STATE` |
| POST | `/admin/orders/:id/cancel` | admin | `admin.cancel` |  | { reason } |  |
| POST | `/admin/orders/:id/refund` | admin | `admin.refund` |  |  | `INVALID_STATE` |
| PATCH | `/admin/orders/:id/note` | admin | `admin.saveNote` |  | { note } |  |
| GET | `/admin/orders/:code/invoice` | admin (view_orders) | — |  | Dữ liệu in hóa đơn (cửa hàng + đơn) |  |
| POST | `/admin/orders/:id/shipments` | admin (process_orders) | — |  | Tạo vận đơn { carrier: ghn\|ghtk\|viettel_post\|other, trackingCode?, fee? } – chỉ khi đơn đang processing/shipping và chưa có vận đơn đang hoạt động |  |

### 4. `admin/payments`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/payments` | admin (`process_orders`) | — | `status` (pending\|success\|failed\|refunded), `method`, `q` (mã đơn/mã giao dịch/tên người nhận), `page`, `pageSize` |  | `VALIDATION_FAILED` (status/method sai) |
| PATCH | `/admin/payments/:id/confirm` | admin (`process_orders`) | `admin.confirmPayment` |  | { transactionCode? } (≤ 100, duy nhất) | `INVALID_STATE` (không phải chuyển khoản đang chờ / đã xử lý), `CONFLICT` (mã giao dịch trùng) |
| PATCH | `/admin/payments/:id/fail` | admin (`process_orders`) | `admin.failPayment` |  | { reason? } (≤ 255) | `INVALID_STATE` |

### 4. `admin/users`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/users` | admin | `admin.list` | `group`, `q`, `sort`, `status` |  |  |
| POST | `/admin/users` | admin | `admin.create` |  |  | `EMAIL_ALREADY_EXISTS` |
| GET | `/admin/users/:id` | admin |  |  |  |  |
| PATCH | `/admin/users/:id` | admin | `admin.update` |  |  |  |
| PATCH | `/admin/users/:id/status` | admin | `admin.` |  | { status: "active"\|"suspended" } |  |
| GET | `/admin/users/:id/orders` | admin | `admin.orders` |  |  |  |
| GET | `/admin/users/:id/reviews` | admin | `admin.reviews` |  |  |  |
| GET | `/admin/users/:id/wishlist` | admin | `admin.wishlist` |  |  |  |

### 4. `admin/reviews`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/reviews` | admin | `admin.list` | `productId`, `q`, `sort`, `status` |  |  |
| PATCH | `/admin/reviews/:id/status` | admin | `admin.` |  | { status: "pending"\|"approved"\|"rejected" } |  |

### 4. `admin/models`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/models` | admin | `admin.list` | `format`, `productId`, `q`, `sort` |  |  |
| POST | `/admin/models` | admin | `admin.upload` |  | { productId, fileName, format:"glb", fileData (data-URL base64, BẮT BUỘC), scale, unit?, createNew? } | `202 { modelId, jobId, status:"processing" }` |
| POST | `/admin/models/upload` | admin | `admin.upload` |  | multipart: `file` + `productId`, `variantId?`, `scale?`, `unit?`, `placement?`, `createNew?` | `202 { modelId, jobId, status:"processing" }` |
| POST | `/admin/models/presign` | admin | `admin.upload` |  | { productId, fileName, size, format:"glb", scale, unit?, createNew? } | Chỉ khi driver minio/s3. `200 { modelId, key, uploadUrl, method:"PUT", headers, expiresIn }`: chọn/tạo mô hình đích (mới ở trạng thái `uploading`) và cấp URL PUT vào bucket PRIVATE `models/incoming/<modelId>/<uuid>.glb`. Sau khi PUT xong gọi `POST /admin/models/:id/files/confirm { key, format, fileName }` ⇒ `202 { modelId, jobId, status:"processing" }`. USDZ ⇒ `415`, > 100 MB ⇒ `413`; driver local ⇒ `400` |
| POST | `/admin/models/:id/reprocess` | admin | `admin.reprocess` |  |  | `:id` = id MÔ HÌNH. `202 { modelId, jobId, status:"processing" }`; không phải `failed` ⇒ `409 INVALID_STATE`; mất tệp gốc ⇒ `409`; không có ⇒ `404` |
| PATCH | `/admin/models/:id/primary` | admin | `admin.setPrimary` |  |  | `:id` = id MÔ HÌNH. `{ modelId, productId, isPrimary:true }`; chỉ khi `ready` (khác ⇒ `409 INVALID_STATE`), không có ⇒ `404` |
| DELETE | `/admin/models/model/:modelId` | admin | `admin.removeModel` |  |  | Xóa cả mô hình (kể cả chưa có tệp: đang xử lý / lỗi) |
| DELETE | `/admin/models/:id` | admin | `admin.remove` |  |  |  |
| GET | `/admin/models/:id/materials` | admin | `admin.materialNames` |  |  | `:id` = id MÔ HÌNH. `{ names: string[] }`: tên các vật liệu có trong GLB (rỗng nếu chưa có tệp; không đọc được tệp ⇒ `404`) |
| GET | `/admin/models/:id/material-variants` | admin | `admin.listMaterialVariants` |  |  | `[{ id, modelId, variantId, materialName, config, updatedAt }]` |
| PUT | `/admin/models/:id/material-variants/:variantId` | admin | `admin.setMaterialVariant` |  | { materialName, config: { baseColor?: "#RRGGBB", roughness?: 0–1, metalness?: 0–1 } } | Tạo hoặc thay thế (UNIQUE model+variant) ⇒ `200`. Biến thể không thuộc sản phẩm của mô hình, config sai, khóa lạ ⇒ `400`; mô hình không có ⇒ `404`. Ghi `model.material_create` / `model.material_update` |
| DELETE | `/admin/models/:id/material-variants/:variantId` | admin | `admin.removeMaterialVariant` |  |  | `200`; chưa có cấu hình ⇒ `404`. Ghi `model.material_delete` |
| POST | `/admin/models/:id/files/presign` | admin (manage_products) | — |  |  |  |
| POST | `/admin/models/:id/files/confirm` | admin (manage_products) | — |  |  |  |

### 4. `admin/coupons`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/coupons` | admin | `admin.list` | `kind`, `q`, `sort`, `tab` |  |  |
| POST | `/admin/coupons` | admin | `admin.create` |  | CouponView (code, name, kind, value, maxDiscount?, minOrderValue, usageLimit?, perUserLimit?, startsAt, endsAt?, isActive; mã áp cho toàn giỏ) |  |
| GET | `/admin/coupons/:id` | admin | `admin.get` |  |  |  |
| PATCH | `/admin/coupons/:id` | admin | `admin.` |  |  |  |
| DELETE | `/admin/coupons/:id` | admin | `admin.remove` |  |  |  |

### 4. `admin/spaces`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/spaces` | admin | `admin.list` | `q`, `roomType`, `sort`, `status` |  |  |
| POST | `/admin/spaces` | admin | `admin.create` |  |  |  |
| GET | `/admin/spaces/:id` | admin | `admin.get` |  |  |  |
| PATCH | `/admin/spaces/:id` | admin | `admin.` |  |  |  |
| DELETE | `/admin/spaces/:id` | admin | `admin.remove` |  |  |  |

### 4. `admin/panoramas` (đặt mô hình 3D vào ảnh 360°, UC-ADM-17; `:id` = id ẢNH 360°)

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/panoramas/:id/placements` | admin (manage_content) | `admin.placements.list` |  |  | `PlacementView[]`; ảnh không có ⇒ `404` |
| POST | `/admin/panoramas/:id/placements` | admin (manage_content) | `admin.placements.create` |  | { productId, variantId?, modelId? (mặc định mô hình chính), yaw, pitch, distance, rotationX?, rotationY?, rotationZ?, scale? } | `201 PlacementView`. `400`: `scale` ≤ 0, `distance` ≤ 0, vị trí sai khoảng, biến thể không thuộc sản phẩm, mô hình không thuộc sản phẩm hoặc chưa `ready`, sản phẩm chưa có mô hình ready. Ghi `placement.create` |
| PATCH | `/admin/panoramas/:id/placements/:placementId` | admin (manage_content) | `admin.placements.update` |  | các trường như POST, chỉ gửi trường cần đổi | `200 PlacementView`; đổi `productId` mà không gửi biến thể/mô hình ⇒ bỏ biến thể cũ, dùng mô hình chính của sản phẩm mới. Ghi `placement.update` |
| DELETE | `/admin/panoramas/:id/placements/:placementId` | admin (manage_content) | `admin.placements.remove` |  |  | `200`; không có ⇒ `404`. Ghi `placement.delete` |

`PlacementView` = `{ id, panoramaId, productId, variantId, modelId, yaw, pitch, distance, rotationX, rotationY, rotationZ, scale, product:{id,name,slug}, model: {…}|null }`; `GET /spaces/:slug` trả cùng dạng trong `panoramas[].placements` (ảnh chưa đặt gì ⇒ `[]`).


### 4. `admin/settings`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/settings` | admin | `admin.get` |  |  |  |
| PUT | `/admin/settings/store` | admin | `admin.save` |  | Partial<StoreSettings> |  |
| PUT | `/admin/settings/:key` | admin |  |  | { value } | `VALIDATION_FAILED` |

### 4. `admin/inventory`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/inventory` | admin | `admin.rows` | `categoryId`, `q`, `sort`, `state` |  |  |
| GET | `/admin/inventory/summary` | admin | `admin.` |  |  |  |

### 4. `admin/attributes`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/attributes` | admin (manage_products) | — |  | Danh sách thuộc tính kèm giá trị và số biến thể đang dùng |  |
| POST | `/admin/attributes/:id/values` | admin (manage_products) | — |  | Thêm giá trị { value (≤ 150), colorHex? (#RRGGBB, chỉ màu sắc) } – trùng ⇒ 409 |  |
| PATCH | `/admin/attributes/:id/values/:valueId` | admin (manage_products) | — |  |  |  |
| DELETE | `/admin/attributes/:id/values/:valueId` | admin (manage_products) | — |  | Xóa giá trị; đang được biến thể dùng ⇒ 409 |  |

### 4. `admin/media`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/admin/media/presign` | admin (manage_products,manage_content) | — |  |  |  |
| POST | `/admin/media/confirm` | admin (manage_products,manage_content) | — |  |  |  |
| GET | `/admin/media` | admin (manage_products,manage_content) | — |  | Thư viện media (phân trang; q, type=image\|other, usage=unused) |  |
| PATCH | `/admin/media/:id` | admin (manage_products,manage_content) | — |  | Sửa mô tả ảnh { altText } (≤ 255 ký tự) |  |
| DELETE | `/admin/media/:id` | admin (manage_products,manage_content) | — |  | Xóa tệp; đang được sử dụng (khóa ngoại RESTRICT) ⇒ 409 |  |

### 4. `admin/faq`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/faq` | admin (manage_content) | — |  |  |  |
| PUT | `/admin/faq` | admin (manage_content) | — |  | Thay toàn bộ FAQ: { topics: [{ key?, label, items: [{ question, answer }] }] } |  |

### 4. `admin/shipments`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| PATCH | `/admin/shipments/:id` | admin (process_orders) | — |  | Cập nhật vận đơn { status?: picked_up\|in_transit\|delivered\|failed\|returned, carrier?, trackingCode?, fee? }. delivered ⇒ đơn tự hoàn tất |  |

## 5. Endpoint Backend cần có thêm (không nằm trong mock)

| Method | Path | Mục đích |
|---|---|---|
| POST | `/auth/refresh` | Đổi `refreshToken` lấy cặp token mới (xoay vòng, thu hồi token cũ) |
| GET | `/health` | Health check (đã có ở khung BE) |
| GET | `/payments/vnpay/return-status` | Trang Return URL (`/checkout/vnpay-return`): kiểm chữ ký, trả trạng thái trong CSDL; còn `pending` thì gọi `querydr` |
| GET | `/payments/vnpay/ipn` | IPN VNPAY (server-to-server), idempotent, trả `{RspCode, Message}` theo chuẩn VNPAY |
| POST | `/admin/media`, `/admin/media/presign`, `/admin/media/confirm` | Upload ảnh/GLB/frame 360 (đã có khung trong BE). FE hiện gửi ảnh dạng data-URL/đường dẫn trong body (`images[]`, `frames[]`, `imageUrl`) nên BE phải **chấp nhận cả URL lẫn data-URL base64** và tự lưu vào `StorageService` |
| GET | `/admin/media/upload-config` | `{ mode: "presigned" \| "multipart", driver, limitsMB: { image, panorama, model } }`: FE tự chọn cách tải theo driver kho (minio/s3 ⇒ presigned; local ⇒ multipart) |

## 5b. Ghi chú triển khai BE (bổ sung/khác mock) – cập nhật Mốc 2

- **Đánh giá có kiểm duyệt**: `POST /products/:slug/reviews` và `PATCH /reviews/:id` ⇒ `status = pending`; danh sách công khai và điểm trung bình chỉ tính `approved`; `GET /reviews/me` trả mọi trạng thái. `PATCH /admin/reviews/:id/status` nhận `pending|approved|rejected` ("Ẩn" = `rejected`); duyệt ⇒ thông báo cho khách (Mốc 3). `content` không bắt buộc: nếu nhập thì 20–1000 ký tự (sai ⇒ `400`, lỗi theo trường `content`); để trống ⇒ lưu `null`.
- `GET /admin/orders/:code/invoice` (thêm): `{ store, order, printedAt }` để in hóa đơn. Các route `/admin/orders/:id/*` nhận id số **hoặc** mã đơn.
- `GET /admin/coupons`: `meta` ngoài phân trang còn có `all, active, upcoming, ended` (số lượng từng tab). Mã áp cho toàn giỏ: body tạo/sửa không còn `appliesTo`, `categoryIds`, `productIds`, `spaceIds`.
- `POST|PATCH /admin/products`: mỗi biến thể có thể kèm `costPrice, minStock, lengthCm, widthCm, heightCm`; `stockQuantity` = tồn **có thể bán**. Ảnh là `{ url, isPrimary }` với `url` là data-URL hoặc URL đã nhận từ API (BE tái sử dụng bản ghi media).
- Khóa tài khoản: mọi request của người bị khóa (kể cả token còn hạn) ⇒ `403 AUTH_ACCOUNT_LOCKED`.
- `POST /admin/users`: mật khẩu tạm ngẫu nhiên gửi qua email (mock đặt `12345678`).
- `POST /admin/settings/reset-mock`: chỉ có ở mock, BE không cài.
- **Mốc 3 – endpoint thêm/khác mock**: `/admin/faq` (+ `/topics`, `/items`); `POST /spaces/:slug/add-to-cart` → `{ added, unavailable:[{productId,name,reason}], cart }`; `POST /admin/models/upload` (multipart `file` + `productId`, `variantId?`, `scale?`, `unit?`, `placement?`).
- **Mô hình 3D – xử lý nền (UC-ADM-13, D-P10)**: tải lên (JSON `fileData` hoặc multipart) chỉ kiểm tra (đuôi `.glb`, chữ ký `glTF`, MIME, ≤ 100MB) và lưu tệp GỐC ở bucket private, rồi đặt `status = processing`, đẩy job `model-processing` và trả **202** `{ modelId, jobId, status }`. **Không còn dùng tệp mẫu** khi thiếu tệp: thiếu `fileData`/`file` ⇒ `400` (`details.file`).
- **AR ngoài phạm vi (D-P11)**: hệ thống chỉ nhận và phục vụ **GLB**. Gửi USDZ, GLTF hay đuôi khác (JSON, multipart, hoặc `files/presign`) ⇒ `415 UNSUPPORTED_MEDIA_TYPE` "Hệ thống chỉ hỗ trợ tệp GLB". Đã bỏ: tham số `hasAr` của `/products*`, trường `usdzUrl` của `Model3DView`, trường `allowAr` khi tải mô hình, khóa cài đặt `ar_enabled` (PUT ⇒ 400 "khóa không được phép"). Không có route AR nào. Bảng `ar_sessions`, `ar_snapshots`, cột `products.has_ar` (luôn `false`) và enum định dạng `usdz` vẫn còn theo chuẩn DB nhưng không dùng.
  - Job: GLB được kiểm tra bằng `@gltf-transform/core`, đo `polygonCount`/`textureResolution`, sinh 3 LOD `high|medium|low` (dedup, prune, simplify, thu nhỏ texture, nén Meshopt), `checksum` SHA-256; ghi `media` + `model_files` của mọi LOD rồi đặt `ready` trong MỘT transaction. USDZ: chỉ kiểm tra chữ ký ZIP + checksum. Tải lại cùng định dạng/LOD ghi đè (upsert), không nhân đôi.
  - Lỗi: tệp hỏng ⇒ `failed`, KHÔNG retry. Lỗi tạm thời ⇒ retry 3 lần, backoff lũy thừa (2s, 4s, 8s). Mỗi LOD GLB phải ≤ `MODEL_SERVE_MAX_MB` (mặc định 5 MB, D-N21), vượt ⇒ `failed`. Mọi lần `failed` cuối cùng ghi `activity_logs` `model.processing_failed` (`changes.reason`) và tạo thông báo cho admin đã tải lên, cùng transaction với việc đặt `failed` (D-N22). Riêng USDZ lỗi mà mô hình vẫn còn GLB thì giữ `ready` (vẫn ghi log và báo admin).
  - `GET /admin/models` liệt kê mỗi TỆP một dòng; mô hình chưa có tệp (đang xử lý / lỗi) là một dòng riêng với `fileId = null`, `id = -modelId`. Mỗi dòng có `modelId`, `status`, `isPrimary`, `lod`, `failureReason` (chỉ khi `failed`; lấy từ `activity_logs`, không thêm cột). FE gọi lại danh sách định kỳ khi còn mô hình `processing`.
  - `createNew=true`: tạo mô hình MỚI cho sản phẩm (mặc định thay tệp của mô hình chính; sản phẩm chưa có mô hình chính thì mô hình mới thành chính). Chỉ một mô hình chính mỗi sản phẩm.
  - Công khai: `GET /products/:slug/model` chỉ trả mô hình chính ở trạng thái `ready`, kèm `files[]` (mỗi tệp có `format`, `lod`, `url`, `fileSize`, `polygonCount`, `isCompressed`, `checksum`); `glbUrl` mặc định là LOD `medium`. `has3dModel`/`hasAr` do trigger DB cập nhật, service không ghi.
  - **Cách tải theo driver kho (D-P13)**: `local` ⇒ multipart/JSON qua API (như trên, dự phòng); `minio`/`s3` ⇒ ảnh ≤ 5 MB multipart qua API vào bucket public, **panorama ≤ 20 MB** `POST /admin/media/presign` ⇒ PUT vào bucket public ⇒ `POST /admin/media/confirm` (201, tạo media + job ảnh), **mô hình GLB ≤ 100 MB** `POST /admin/models/presign` ⇒ PUT vào bucket PRIVATE ⇒ `POST /admin/models/:id/files/confirm` (202) ⇒ job đọc từ private, ghi LOD vào public. URL ký cả `Content-Type` và `Content-Length` (PUT sai ⇒ kho trả 403) và hết hạn sau `PRESIGN_EXPIRES_SECONDS` (mặc định 900). Hai route `presign`/`confirm` không ghi log trong service nên `ActivityLogInterceptor` ghi dòng tự động (`media.presign`, `media.confirm`, `models.presign`).
- Cổng API mặc định **4000** (`NEXT_PUBLIC_API_URL=http://localhost:4000`).

### 5c. Thay đổi hợp đồng đợt 2026-11-10/11 (kiểm toán và sửa P0/P1)

- **`POST /spaces/:slug/add-to-cart` giờ là tất cả-hoặc-không** (`apps/api/src/modules/spaces/spaces.service.ts` `addAllToCart`, `cart/cart.service.ts` `addItems`): một request, một transaction. Có món ngừng bán/hết hàng/quá tồn ⇒ `409 CONFLICT` kèm `details.unavailable[]` và **không món nào được thêm** (trước đây thêm các món còn hàng và trả danh sách món hết). Body tùy chọn `{ productIds }` (tập con các món của không gian; sai/rỗng ⇒ `400` ở trường `productIds`). FE (`/spaces/[slug]`) gọi endpoint này một lần.
- **`409 CONFLICT` kèm lỗi theo trường** (`details: { <trường>: ["thông báo"] }`) cho slug/mã/tên trùng (danh mục, mã giảm giá, sản phẩm, không gian): `conflictError()` ở `apps/api/src/common/utils/validate.ts`. Khác với `409 CONFLICT` do Prisma `P2002` (`details.fields`). `409` của đặt hàng có `details.unavailable[]` (dòng giỏ không còn bán).
- `POST /orders` nhận thêm `couponCode` (ưu tiên hơn mã đang gắn ở giỏ; sai ⇒ `400`); địa chỉ của người khác hoặc không tồn tại ⇒ `404`.
- `/admin/payments` (danh sách, xác nhận, đánh dấu thất bại) có FE gọi từ 2026-11-10/11.
- `POST /auth/google`: chưa triển khai, luôn `503` (đã hoãn sang giai đoạn sau).

## 6. Ghi chú đối chiếu FE ⇄ shared-types

- `packages/shared-types` đã có `ApiResult`, `PaginatedMeta`, `ErrorCode`, `AuthTokens`, `AuthUser`, các entity sinh từ Prisma. **Các `*View` (Phụ lục A) hiện nằm ở `apps/web/src/types/api.ts`** ⇒ đề xuất chuyển sang `packages/shared-types/src/views.ts` để BE và FE dùng chung; `types/api.ts` chỉ `export *` lại (thay đổi chỉ ở lớp kiểu, không đổi giao diện).
- `POST /admin/settings/reset-mock` chỉ tồn tại ở mock; BE không cần cài đặt (FE đã ẩn khi `USE_MOCK=false` – cần xác nhận ở Giai đoạn 11).
- FE ghi `TODO: chưa có trong BE` ở nhiều service: đó là các endpoint BE phải làm mới (xem gap analysis ở `BACKEND_DESIGN.md`).

---

## Phụ lục A – Kiểu response (trích nguyên văn từ `apps/web/src/types/api.ts`)

Các entity import từ `@aurelia-living/shared-types` (`User`, `Order`, `Product`…) là bản sao 1-1 bảng Prisma: camelCase, `Decimal → number`, `DateTime → string ISO`.

```ts
// Kiểu dữ liệu mà API trả về cho giao diện = entity khớp 100% schema.prisma (shared-types) + quan hệ mở rộng.
// Trường nào KHÔNG có trong DB được đánh dấu "TODO: chưa có trong DB" (xem docs/PROJECT_ANALYSIS.md mục 7).
import type {
  ActivityLog,
  Address,
  Category,
  Coupon,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  Product,
  Product3DModel,
  ModelFile,
  ProductVariant,
  Review,
  RoleCode,
  Shipment,
  Space,
  SpaceHotspot,
  SpacePanorama,
  SpaceProductPlacement,
  User,
  CartItem,
  Media,
  InventoryMovement,
} from '@aurelia-living/shared-types';

export type {
  ActivityLog,
  Address,
  Category,
  Coupon,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  Product,
  Product3DModel,
  ModelFile,
  ProductVariant,
  Review,
  Shipment,
  Space,
  SpaceHotspot,
  SpacePanorama,
  SpaceProductPlacement,
  User,
  Media,
  InventoryMovement,
};

export interface ColorOption {
  name: string;
  hex: string;
}

// ---------- Danh mục ----------
export interface CategoryNode extends Category {
  imageUrl: string | null;
  productCount: number;
  parentName: string | null;
  children: CategoryNode[];
  description?: string | null;
  isFeatured?: boolean;
}

// ---------- Sản phẩm ----------
export interface ProductListItem extends Product {
  /** Giá niêm yết của biến thể mặc định (ProductVariant.price) */
  price: number;
  /** Giá khuyến mãi (ProductVariant.salePrice) – null nếu không giảm */
  salePrice: number | null;
  /** Tổng tồn kho các biến thể (Σ stockQuantity) */
  stockQuantity: number;
  defaultVariantId: number;
  thumbnailUrl: string | null;
  category: { id: number; name: string; slug: string } | null;
  brand: string | null;
  colors: ColorOption[];
  sizes: string[];
  material: string | null; // thuộc tính "material" của biến thể
  style: string | null;
  sku: string;
  isWishlisted: boolean;
}

export interface VariantView extends ProductVariant {
  color: ColorOption | null;
  size: string | null;
  material: string | null;
  imageUrl: string | null;
}

export interface ProductImageView {
  id: number;
  /** id bản ghi media (ổn định); gửi lại khi lưu sản phẩm để giữ nguyên ảnh và liên kết biến thể */
  mediaId?: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  variantId: number | null;
}

export interface ModelFileView extends ModelFile {
  url: string;
  fileName: string;
  fileSize: number;
}

export interface Model3DView extends Product3DModel {
  files: ModelFileView[];
  materialVariants?: MaterialVariantView[];
  glbUrl: string | null;
  posterUrl: string | null;
}

export interface ProductDetail extends ProductListItem {
  images: ProductImageView[];
  variants: VariantView[];
  features: string[];
  model: Model3DView | null;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  breadcrumb: Array<{ label: string; href: string }>;
}

export interface ProductFacets {
  categories: Array<{ slug: string; name: string; count: number }>;
  colors: Array<ColorOption & { count: number }>;
  materials: Array<{ value: string; count: number }>;
  styles: Array<{ value: string; count: number }>;
}

// ---------- Đánh giá ----------
export interface ReviewView extends Review {
  userName: string;
  userAvatarUrl: string | null;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  variantLabel: string | null;
  orderCode: string | null;
  purchasedAt: string | null;
  tags: string[]; // chip tiêu chí
}

// ---------- Người dùng ----------
export interface UserView extends User {
  roles: RoleCode[];
  avatarUrl: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birthday: string | null;
  customerGroup: 'new' | 'loyal'; // suy ra từ số đơn/chi tiêu
  loyaltyPoints: number;
  adminNote: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AddressView extends Address {
  label: string; // "Nhà riêng", "Văn phòng"
}

// ---------- Giỏ hàng ----------
export interface CartItemView extends CartItem {
  productId: number;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  sku: string;
  variantLabel: string;
  unitPrice: number;
  originalPrice: number;
  lineTotal: number;
  stockQuantity: number;
}

export interface CartView {
  id: number;
  userId: number;
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  coupon: { id: number; code: string; type: Coupon['type'] | 'freeship'; value: number } | null;
}

// ---------- Đơn hàng ----------
export interface OrderItemView extends OrderItem {
  imageUrl: string | null;
  productSlug: string | null;
  productId: number | null;
  variantLabel: string;
  reviewed: boolean;
}

export interface OrderHistoryView extends OrderStatusHistory {
  actorName: string; // "Admin" | "Hệ thống" | tên khách
}

export interface OrderView extends Order {
  items: OrderItemView[];
  itemCount: number;
  history: OrderHistoryView[];
  payment: Payment | null;
  shipment: Shipment | null;
  /** mọi vận đơn của đơn (cũ → mới); `shipment` là vận đơn hiện tại (mới nhất) */
  shipments: Shipment[];
  couponCode: string | null;
  customer: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    totalOrders: number;
    customerGroup: 'new' | 'loyal';
  } | null;
  internalNote: string | null;
  deliveredAt: string | null;
}

// ---------- Coupon ----------
export interface CouponView extends Coupon {
  name: string;
  description: string | null;
  kind: 'percent' | 'fixed' | 'freeship'; // 'freeship' = coupon_type freeship (mã giảm phí vận chuyển)
}


// ---------- Thông báo ----------
export interface NotificationData {
  type: 'order' | 'promo' | 'system';
  content: string;
  link: string | null;
}
export interface NotificationView extends Omit<Notification, 'data'> {
  data: NotificationData;
}

// ---------- Không gian mẫu ----------
export interface SpaceListItem extends Space {
  coverUrl: string | null;
  productCount: number;
  panoramaCount: number;
}

export interface PanoramaView extends SpacePanorama {
  url: string;
  hotspots: Array<
    SpaceHotspot & {
      product: Pick<
        ProductListItem,
        'id' | 'name' | 'slug' | 'price' | 'salePrice' | 'thumbnailUrl' | 'defaultVariantId'
      > | null;
    }
  >;
  placements: PlacementView[];
}

export interface SpaceDetail extends SpaceListItem {
  panoramas: PanoramaView[];
  products: ProductListItem[];
  originalTotal: number;
  comboTotal: number;
  comboDiscountPercent: number;
  similar: SpaceListItem[];
}

// ---------- Quản trị ----------
export interface DashboardStats {
  totalOrders: number;
  revenue: number;
  newCustomers: number;
  totalProducts: number;
  deltas: { orders: number; revenue: number; customers: number; products: number };
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  statusBreakdown: Array<{ status: Order['status']; count: number; percent: number }>;
  recentOrders: OrderView[];
  topProducts: Array<{
    productId: number;
    name: string;
    slug: string;
    imageUrl: string | null;
    sold: number;
    revenue: number;
  }>;
  recentActivity: Array<ActivityLog & { actorName: string; actorAvatarUrl: string | null; text: string }>;
}

export interface Model3DAdminRow extends Model3DView {
  /** id MÔ HÌNH (id dòng `id` = id tệp, hoặc -modelId khi mô hình chưa có tệp) */
  modelId: number;
  /** null khi mô hình chưa có tệp (đang xử lý hoặc lỗi) */
  fileId: number | null;
  /** lý do lỗi khi status = failed (máy chủ thật) */
  failureReason: string | null;
  lod: 'high' | 'medium' | 'low' | null;
  productName: string;
  productThumbnailUrl: string | null;
  format: 'glb';
  fileName: string;
  sizeMB: number;
  uploadedAt: string;
}

// ---------- Thực thể CHƯA có trong DB (mock tự đặt tên theo WIREFRAME.md mục 5) ----------






export interface InventoryRow {
  variantId: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  sku: string;
  categoryName: string;
  costPrice: number;
  stockQuantity: number;
  available: number;
  minStock: number;
  state: 'in_stock' | 'low' | 'out';
}



export interface ShippingZone {
  id: number;
  name: string;
  fee: number;
  freeFrom: number;
  eta: string;
}

export interface StoreSettings {
  store: {
    name: string;
    slogan: string;
    email: string;
    hotline: string;
    address: string;
    taxCode: string;
    logoUrl: string | null;
  };
  payments: Array<{
    method: 'cod' | 'bank_transfer' | 'vnpay' | 'momo' | 'zalopay';
    enabled: boolean;
    description: string;
  }>;
  shippingZones: ShippingZone[];
}

export interface FinanceReport {
  totalIncome: number;
  deltas: { income: number };
  monthly: Array<{ month: string; income: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; percent: number }>;
  byCategory: Array<{ name: string; amount: number; percent: number }>;
  daily: Array<{ date: string; revenue: number }>;
  income: { gross: number; discount: number; net: number };
  ledger: Array<{
    date: string;
    code: string;
    content: string;
    type: 'income';
    category: string;
    amount: number;
  }>;
  topProducts: DashboardStats['topProducts'];
}

// ---------- Xem 360° (TODO: cần thêm vào DB/API) ----------




```


---

## Mốc 4 – Kho, Thu chi, Cài đặt, VNPAY (BE thật)

### Kho (UC-ADM-12; rút gọn theo D-D10)
- `GET /admin/inventory` → `InventoryRow[]` (phân trang): `stockQuantity` = `product_variants.stock_quantity` (đã trừ ngay khi đặt hàng nên **không còn** `reservedQty`), `available` = `stockQuantity`, `state` = `out` (≤ 0) | `low` (≤ `minStock`) | `in_stock`. Lọc `q` (tên/SKU không dấu), `state`, `categoryId` (gồm danh mục con); sắp xếp `productName|stockQuantity|available|costPrice`.
- Không còn phiếu nhập/xuất kho và sổ cái tồn (`stock_receipts`, `stock_receipt_items`, `inventory_movements`; D-D10): trang Kho chỉ xem tồn; sửa tồn qua form biến thể của sản phẩm (`stockQuantity`). Đặt hàng vẫn trừ tồn, hủy đơn vẫn hoàn tồn.

### Doanh thu và báo cáo
- `GET /admin/stats/finance?from&to` → `FinanceReport`. Quy ước: **doanh thu chỉ tính đơn `completed`, theo NGÀY GIAO** (lần đầu sang `completed`, giờ Việt Nam); đơn hủy/chưa giao không tính; **net = gross − discount** (`income: { gross, discount, net }`). Không còn chi phí, phiếu chi và lợi nhuận (D-D10).

### Cài đặt (UC-ADM-03)
- `GET /admin/settings` → `{ store, payments, shippingZones, general }`; `general` gồm `site_name, contact_email, contact_phone, currency, default_shipping_fee, free_shipping_threshold, maintenance_mode`.
- `PUT /admin/settings/store` (trang Cài đặt) chỉ ghi phần được gửi; lỗi theo tên ô (`name`, `email`, `hotline`, `payments.<i>.method`, `shippingZones.<i>.fee`…). `PUT /admin/settings/:key { value }`: khóa ngoài danh sách ⇒ 400, sai kiểu ⇒ 400. Mỗi lần sửa ghi `activity_logs` (`setting.update`, trước/sau). Cài đặt công khai vẫn là `GET /settings/public`.

### VNPAY sandbox (UC-PAY-01/02/03)
- Có `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET`: `POST /payments/:orderId/checkout` trả `{ redirectUrl, paymentUrl, expiresAt }` – URL cổng ký HMAC-SHA512. Mỗi URL là một dòng `payments`: `vnp_Amount = payments.amount × 100` (lấy từ CSDL), `vnp_TxnRef = P<paymentId>T<yyyyMMddHHmmss>`, hạn 15 phút, `vnp_OrderType=other`, `vnp_Locale=vn`. Tối đa 5 lượt tạo URL/phút cho một khách (chung `checkout` và `retry`, D-N43). Chưa có khóa: giả lập (`PAYMENT_SANDBOX_FAKE=true`, không production), nếu không ⇒ `503`.
- `GET /payments/vnpay/return-status` (công khai, thay route `vnpay/return` đã bỏ): trình duyệt quay về `VNPAY_RETURN_URL` (mặc định `<APP_URL>/checkout/vnpay-return`), trang gửi nguyên tham số. Sai chữ ký/TmnCode/TxnRef lạ ⇒ `{ valid: false }`. Không ghi gì theo tham số URL. Giao dịch còn `pending` sau ≥ 5 giây ⇒ API gọi `querydr` (tối đa 3 lần/phút mỗi TxnRef); chỉ phản hồi đúng chữ ký mới được ghi, qua cùng hàm xử lý với IPN (D-N42).
- `GET /payments/vnpay/ipn` (công khai, server-to-server, không áp rate limit chung): JSON **không bọc** `{ RspCode, Message }`: `00` đã ghi nhận, `01` không có giao dịch, `02` lần thử đã có kết quả, `04` sai số tiền, `97` sai chữ ký/TmnCode, `99` lỗi khác. Thành công khi `vnp_ResponseCode` và `vnp_TransactionStatus` đều `00`. Quy tắc: D-N28, D-N39, D-N40. `payments.gateway_response` lưu yêu cầu, dữ liệu cổng (bỏ chữ ký) và nguồn `ipn`/`querydr`; API đơn hàng chỉ trả `{ code, source }`; `OrderView.payment` là giao dịch đã thu tiền, nếu chưa có thì lần thử mới nhất.
- `POST /payments/:orderId/retry { method? }` (UC-PAY-03): chỉ đơn `pending`/`confirmed` chưa trả; giao dịch pending cũ ⇒ `failed`, tạo giao dịch pending mới; ngược lại ⇒ `409`; phương thức lạ hoặc `momo`/`zalopay` ⇒ `400`.
- **MoMo/ZaloPay đã ngừng (D-N44):** `POST /orders`, `POST /admin/orders`, `retry` từ chối (`400`); đơn cũ giữ nguyên.
- **Đơn `vnpay`/`card` chưa `paid`:** `PATCH /admin/orders/:id/status { status: "processing" }` ⇒ `409 INVALID_STATE` (D-N45).

---

## Use case web còn thiếu (BE thật)

### Thương hiệu (UC-ADM-06)
Đã bỏ API và trang quản trị thương hiệu (`/brands`, `/admin/brands`; D-D15). Thương hiệu là cột chữ `products.brand` (≤ 150 ký tự, rỗng ⇒ NULL): `POST|PATCH /admin/products` nhận `brand` (quá 150 ký tự ⇒ `400` ở trường `brand`); sản phẩm trả `brand: string | null`. Bộ lọc `?brand=` của `/products*` so khớp theo tên, không phân biệt hoa thường.

### Thuộc tính (UC-ADM-08) – `/admin/attributes`
Chỉ còn 3 loại cố định, là enum `attribute_code` (`color` id 1, `size` id 2, `material` id 3; D-D14); không tạo/sửa/xóa loại.
`GET` → `[{ id, code, name, isSystem: true, values:[{ id, attributeId, value, colorHex, usageCount }] }]`; `POST /:id/values { value ≤ 150, colorHex? (#RRGGBB, chỉ loại màu) }`; `PATCH|DELETE /:id/values/:valueId`. Trùng (loại, value) ⇒ `409`; id loại không phải 1/2/3 ⇒ `404`. Xóa giá trị đang được biến thể dùng ⇒ `409 RESOURCE_IN_USE`.

### Media (UC-ADM-04) – `/admin/media`
`POST` multipart (trường `file`, `kind` = image|frame|panorama, `altText?`): ảnh ≤ 5 MB (frame 2 MB, panorama 20 MB); quá cỡ `413`, sai loại hoặc chữ ký tệp không khớp `415`. `GET` (phân trang; q không dấu, type, usage=unused) → `{ id, fileName, url, mimeType, fileSize, altText, uploadedByName, usage:{ required, optional } }`; `PATCH /:id { altText ≤ 255 }`; `DELETE /:id` (tham chiếu bắt buộc ⇒ `409`; tham chiếu tùy chọn tự gỡ). Upload ghi nhật ký cùng transaction và đẩy job tạo webp + thumbnail.

### Vận chuyển (UC-ADM-25, D-N14)
- `POST /admin/orders/:id/shipments { carrier: ghn|ghtk|viettel_post|other, trackingCode?, fee? }` ⇒ `201 { shipment, order, warnings }`. Chỉ khi đơn `processing`/`shipping` và chưa có vận đơn đang hoạt động (≠ returned; `failed` vẫn là đang hoạt động vì còn giao lại được), sai ⇒ `409`. Mã trùng ở đơn vị khác chỉ cảnh báo (`warnings`).
- `PATCH /admin/shipments/:id { status?, carrier?, trackingCode?, fee?, reason? }` theo DAC_TA §10.4 (D-N34): `pending → picked_up → in_transit → delivered \| failed \| returned`; `failed → in_transit \| returned`; bước không hợp lệ ⇒ `409`; lặp lại cùng trạng thái ⇒ `200` thao tác rỗng; `delivered`/`returned` là trạng thái cuối; `picked_up` đặt `shippedAt`, `delivered` đặt `deliveredAt`. `delivered` ⇒ cùng transaction `OrdersService.completeOrder`: đơn `shipping → completed`, tăng `sold_count`, COD ⇒ Payment `success` + `paymentStatus = paid`, `status_note = "Giao hàng thành công"`, thông báo khách; đơn không ở `shipping` ⇒ `409` và hoàn tác. `failed`/`returned`: đơn giữ nguyên `shipping`, khách được thông báo một lần (gửi sau khi lưu). Khi mọi vận đơn của đơn `shipping` đã `returned`, `POST /admin/orders/:id/cancel` hủy được đơn (hoàn tồn kho), sau đó `POST /admin/orders/:id/refund` hoàn tiền một lần nếu đã thanh toán.
- `PATCH /admin/orders/:id/status`: `completed` ⇒ `409` "Hoàn tất khi vận đơn được đánh dấu đã giao."; `shipping` khi chưa có vận đơn hoạt động ⇒ `400`; không còn tự tạo vận đơn. Chi tiết đơn có thêm `shipments[]` (cũ → mới), `shipment` là vận đơn mới nhất. Route cũ `PATCH /admin/orders/:id/shipment` đã bỏ.

### Khác
- Phí ship: tỉnh ngoài mọi vùng dùng `default_shipping_fee` và `free_shipping_threshold` (xem `CHUAN_MO_RONG.md`).
- Phương thức thanh toán bị tắt trong Cài đặt ⇒ `400 VALIDATION_FAILED` (details `paymentMethod`) khi đặt hàng hoặc thanh toán lại.

### Mở rộng nhẹ (2026-11-08, D-P15)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/admin/activity-logs` | admin + `manage_settings` | UC-ADM-27, CHỈ ĐỌC. Query: `actorId`, `action` (chứa, không phân biệt hoa thường), `targetType`, `from`/`to` (yyyy-MM-dd, `to` gồm cả ngày), `page`, `pageSize` (mặc định 20). Mới nhất trước. Mỗi dòng: `id, actorId, actorName, actorEmail, action, targetType, targetId, changes, ipAddress, createdAt, auto` (`auto` = do ActivityLogInterceptor ghi). Sai tham số ⇒ 400. Không có POST/PATCH/DELETE |
| GET | `/admin/activity-logs/options` | như trên | `{ actors: [{id, fullName, email}], actions: string[], targetTypes: string[] }` cho bộ lọc |
| GET | `/admin/roles` | admin + `manage_users` | UC-ADM-02: đúng 2 vai trò (hằng số, không còn bảng; `userCount` đếm theo `users.role`) `[{ id, code, name, description, userCount, permissions: [{code, name, description}] }]` |
| PUT | `/admin/users/:id/roles/admin` | như trên | Đổi `users.role` thành `admin` (idempotent) ⇒ `200 { id, roles }`; ghi `activity_logs` `user.grant_admin`; 404 người dùng không tồn tại |
| DELETE | `/admin/users/:id/roles/admin` | như trên | Đổi `users.role` về `user` trong `$transaction` ⇒ `200 { id, roles }`; ghi `user.revoke_admin`. **409 `INVALID_STATE`** khi tự gỡ của chính mình, gỡ **admin cuối cùng**, hoặc người đó không phải admin; 404 không tồn tại. Không tạo vai trò mới. Sau khi gán, người đó không còn nằm trong `GET /admin/users` và chi tiết khách hàng (chỉ liệt kê `role = user`) |
| GET | `/users/me/sessions` | đăng nhập | UC-ACC-03: phiên chưa thu hồi và chưa hết hạn `[{ id, deviceName, ipAddress, createdAt, expiresAt, current }]` (`current` = thiết bị của access token đang dùng) |
| DELETE | `/users/me/sessions/:id` | đăng nhập | Thu hồi phiên của CHÍNH mình ⇒ `204`; phiên của người khác/đã thu hồi/không có ⇒ 404 |
| DELETE | `/users/me` | đăng nhập | UC-ACC-07: thân `{ password }` ⇒ `204`. Mật khẩu thiếu/sai ⇒ 400 (`details.password`); còn đơn `pending…shipping` ⇒ 409 `INVALID_STATE`; admin ⇒ 403. Trong `$transaction`: `deletedAt`, `status = banned`, thu hồi mọi phiên (xóa mềm, đơn giữ nguyên, email đăng ký lại được) |
| POST | `/admin/notifications` | admin + `manage_content` | UC-ADM-26: `{ title (2–150), content (1–2000), type?: "system"\|"promo", link?: "/…"\|"http(s)://…", userIds?: number[] (≤ 1000) \| all?: true }` ⇒ `201 { sent }`; tạo `Notification` + `activity_logs` `notification.send` cùng transaction. Sai dữ liệu, người nhận không tồn tại/đã xóa ⇒ 400 (không tạo gì) |

Access token có thêm claim `sid` (id phiên). `204` không có thân JSON (FE xử lý trong `api-client`).
