# API CONTRACT – Aurelia Living (Frontend ⇄ Backend)

> **Nguồn sự thật:** lớp mock API của Frontend (`apps/web/src/mock-data/mockApi/*`) và lớp service (`apps/web/src/services/*.api.ts`). Tài liệu này được **trích xuất tự động** từ hai nơi đó (bảng endpoint ở mục 4) và từ `apps/web/src/types/api.ts` (kiểu response, Phụ lục A). Backend phải khớp: path, method, query, body, hình dạng response, mã lỗi. Lệch ⇒ sửa Backend, không sửa giao diện.
> Cập nhật: 2026-11-06 (Giai đoạn 4). Bản cuối sẽ được đối chiếu với code ở Giai đoạn 12.

## 1. Quy ước chung

| Hạng mục | Giá trị |
|---|---|
| Base URL | `${NEXT_PUBLIC_API_URL}/api` (mặc định `http://localhost:4000/api`); `GET /health` nằm ngoài `/api` |
| Định dạng | JSON `camelCase`; ngày ISO 8601 UTC (`2026-10-08T06:00:00.000Z`); tiền là **số nguyên VNĐ** (Prisma `Decimal` → `number`) |
| Header | `Content-Type: application/json`; `Authorization: Bearer <accessToken>` khi đã đăng nhập |
| Định danh | API công khai dùng **slug** (`/products/:slug`, `/spaces/:slug`, `/pages/:slug`); đơn hàng của khách tra theo **mã đơn** (`/orders/:code`) nhưng hủy/thanh toán theo **id**; API đã đăng nhập/admin dùng `id` số nguyên |
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

- FE chỉ lưu `accessToken` (Zustand persist `localStorage`) và gửi `Authorization: Bearer`. **FE chưa dùng refresh token** và không đọc cookie ⇒ BE trả `{ user, tokens:{accessToken, refreshToken} }` trong body; `accessToken` nên sống đủ lâu cho phiên làm việc (đề xuất 12 giờ ở môi trường dev, cấu hình `JWT_ACCESS_EXPIRES_IN`). BE vẫn cung cấp `POST /auth/refresh` (xoay vòng) cho giai đoạn sau; **không cần sửa FE** để chạy.
- 401 khi **có gửi token** ⇒ FE đăng xuất cục bộ. Vì vậy chỉ trả 401 khi token thật sự sai/hết hạn; thiếu quyền trả 403.
- Khách gọi `/admin/*` ⇒ `403 FORBIDDEN` ("Bạn không có quyền truy cập khu vực quản trị."). Tài khoản `suspended/banned` ⇒ `403 AUTH_ACCOUNT_LOCKED` ở đăng nhập và ở mọi request.
- Đăng nhập admin dùng cùng endpoint `POST /auth/login` với `adminOnly: true`; tài khoản không phải admin ⇒ `403 FORBIDDEN` ("Tài khoản không có quyền quản trị.").
- Thông báo lỗi đăng nhập: sai email/mật khẩu ⇒ `401 AUTH_INVALID_CREDENTIALS` "Email hoặc mật khẩu không đúng." (không tiết lộ email có tồn tại hay không).
- OTP quên mật khẩu: mock luôn là `123456`; **BE thật sinh OTP 6 số ngẫu nhiên** (hết hạn 5 phút, tối đa 5 lần thử, gửi lại sau 60 giây), dev in ra log và gửi Mailpit. Seed/e2e có thể bật `OTP_FIXED_CODE=123456` ở môi trường dev/test để giữ test FE chạy được.

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
| `POST /auth/reset-password` | `null`; OTP sai/hết hạn ⇒ `400 BAD_REQUEST` ("Mã OTP không đúng hoặc đã hết hạn.") |
| `GET /orders/counts`, `GET /admin/orders/counts` | `{ all, pending, confirmed, processing, shipping, completed, cancelled, refunded }` (số đơn theo trạng thái; admin: toàn hệ thống, khách: của mình) |
| `POST /payments/:orderId/checkout`, `/retry` | `{ redirectUrl: string }` – URL tương đối của FE (`/checkout/success?order=<code>` hoặc `/checkout/failed?order=<code>`) hoặc URL cổng thanh toán (VNPAY) |
| `GET /notifications/unread-count` | `{ count: number }` |
| `GET /products/:slug/model` | `Model3DView \| null` |
| `GET /products/facets` | `ProductFacets` (theo bộ lọc hiện tại, trừ chính nó) |
| `GET /spaces/facets` | `{ styles:[{value,count}], roomTypes:[{value,count}] }` |
| `GET /faq` | `FaqTopic[]` = `[{ key, label, items:[{ id, question, answer }] }]` |
| `GET /pages` (`?type=policy`) | `[{ slug, title }]` |
| `GET /admin/inventory/summary` | `{ totalStock, stockValue, lowCount, outCount }` |
| `GET /admin/notifications` | `[{ id, text, createdAt, link }]` |
| `GET /admin/search?q=` | `[{ type:'product'\|'order'\|'customer', label, href }]` |
| `GET /admin/users/:id` | `UserView & { addresses: AddressView[], recentActivity: [{ text, createdAt }] }` |
| `POST /contact` | `null` |
| `PUT/DELETE /wishlist/:slug`, `PUT/DELETE /spaces/:slug/bookmark` | `null` |
| `DELETE /addresses/:id` | `null` (xóa địa chỉ mặc định duy nhất ⇒ `409 INVALID_STATE`) |
| `GET /cart?items=1,2&addressId=3` | `CartView` – `items` lọc các dòng được chọn (mua ngay), `addressId` để tính phí ship theo tỉnh của địa chỉ |

### 1.5 Quy tắc nghiệp vụ FE đang dựa vào (BE phải giữ)

- **Đơn hàng**: mã `ALV-YYYYMMDD-NNNN` (NNNN tăng theo ngày). Luồng `pending → confirmed → processing → shipping → completed`; `cancelled` chỉ từ `pending|confirmed|processing`; **khách tự hủy khi `pending` hoặc `confirmed`** (FE hiện nút Hủy ở hai trạng thái này; admin hủy thêm được ở `processing`). Sai luồng ⇒ `409 INVALID_STATE` ("Không thể chuyển đơn từ "x" sang "y"."). Chuyển `shipping` tự tạo `shipment` (mã vận đơn); chuyển `completed` ⇒ shipment `delivered` + COD tự `paid`.
- **Phí ship**: theo `settings.shippingZones` khớp `province` của địa chỉ (`fee`, `freeFrom`); `subtotal >= freeFrom` ⇒ 0.
- **Coupon**: kiểm tra hạn, đơn tối thiểu, phạm vi, giảm tối đa, lượt dùng tổng/khách ⇒ lỗi `400 COUPON_INVALID` kèm lý do tiếng Việt. Loại `percent | fixed | freeship`.
- **Đánh giá**: chỉ sản phẩm thuộc đơn `completed` của chính khách (`403 PURCHASE_REQUIRED`), trùng (khách+sản phẩm+đơn) ⇒ `409 CONFLICT`; đánh giá mới ở trạng thái `pending`, admin duyệt `approved` mới hiện công khai và tính vào rating.
- **Đổi trả**: ≤ 7 ngày kể từ lúc giao (`canReturnUntil`), mã `RT0001`; luồng `pending → picking → inspecting → refunded|exchanged`, hoặc `rejected`; hoàn tiền tự tạo phiếu chi danh mục `refund`.
- **Tồn kho**: thêm giỏ/đặt vượt tồn ⇒ `409 OUT_OF_STOCK` kèm `details:{ variantId, available }`.

## 2. Mapping nhóm endpoint ⇄ màn hình FE

| Nhóm | Màn hình (WIREFRAME) |
|---|---|
| `auth`, `users`, `addresses` | Đăng nhập/đăng ký/quên mật khẩu (7.1–7.4), Hồ sơ, Sổ địa chỉ, Đổi mật khẩu, Admin login |
| `categories`, `brands`, `products*`, `wishlist`, `reviews` | Trang chủ, Danh sách/Tìm kiếm/Chi tiết sản phẩm, 3D/AR (7.7), **Xem 360°**, Yêu thích, Đánh giá của tôi |
| `spaces*` | Không gian mẫu (2.14, 7.6) |
| `cart`, `orders`, `payments`, `returns`, `coupons` | Giỏ hàng, Thanh toán, Thành công/Thất bại, Đơn hàng của tôi/Chi tiết, Đổi trả, Mã giảm giá |
| `notifications`, `banners`, `posts`, `pages`, `faq`, `contact`, `settings/public` | Thông báo, trang chủ, bài viết, chính sách, FAQ, liên hệ, footer |
| `admin/*` | Admin Panel: Tổng quan, Sản phẩm (6 tab + Ảnh 360°), Danh mục, Đơn hàng, Đổi trả, Khách hàng, Đánh giá, Hỏi đáp, Mô hình 3D, Khuyến mãi, Không gian mẫu, Nội dung, Cài đặt, Kho, Thu chi |


## 4. Danh sách endpoint (139)

Quy ước cột: **Quyền** = `public` (không cần token) · `user` (Bearer token khách hoặc admin) · `admin` (role admin). **Query** = tham số FE gửi. **Lỗi** = mã lỗi mock đang ném (ngoài `VALIDATION_FAILED`, `AUTH_*`, `FORBIDDEN`, `RESOURCE_NOT_FOUND` áp dụng chung). Phân trang: `page`, `pageSize`, `sort=truong:asc|desc` ở mọi danh sách.

### 4. `auth`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | public | `auth.` |  | { email, password, adminOnly? } | `AUTH_ACCOUNT_LOCKED`, `AUTH_INVALID_CREDENTIALS`, `FORBIDDEN` |
| POST | `/auth/register` | public | `auth.` |  | { fullName, email, phone, password } | `EMAIL_ALREADY_EXISTS` |
| POST | `/auth/logout` | public | `auth.logout` |  |  |  |
| POST | `/auth/forgot-password` | public | `auth.forgotPassword` |  | { email } |  |
| POST | `/auth/reset-password` | public | `auth.` |  | { email, otp, password } | `BAD_REQUEST` |
| POST | `/auth/google` | public | `auth.googleLogin` |  |  |  |

### 4. `users`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/users/me` | user | `auth.me` |  |  |  |
| PATCH | `/users/me` | user | `auth.` |  | { fullName?, phone?, gender?, birthday?, avatarUrl? } |  |
| POST | `/users/me/change-password` | user | `auth.` |  | { currentPassword, newPassword, logoutOthers? } |  |

### 4. `addresses`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/addresses` | user | `auth.list` |  |  |  |
| POST | `/addresses` | user | `auth.create` |  | { recipientName, phone, province, district, ward, addressLine, label?, isDefault? } |  |
| PATCH | `/addresses/:id/default` | user | `auth.setDefault` |  |  |  |
| PATCH | `/addresses/:id` | user | `auth.update` |  | Partial của body tạo địa chỉ |  |
| DELETE | `/addresses/:id` | user | `auth.remove` |  |  | `INVALID_STATE` |

### 4. `categories`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/categories` | public | `product.tree` |  |  |  |

### 4. `brands`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/brands` | public | `product.list` |  |  |  |

### 4. `products`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/products` | public | `product.list` | `q`, `category`, `brand`, `minPrice`, `maxPrice`, `color`, `material`, `style`, `has3d`, `hasAr`, `featured`, `sort`, `page`, `pageSize` |  |  |
| GET | `/products/search` | public | `product.search` | `q`, `category`, `brand`, `minPrice`, `maxPrice`, `color`, `material`, `style`, `has3d`, `hasAr`, `featured`, `sort`, `page`, `pageSize` |  |  |
| GET | `/products/facets` | public | `product.facets` | `q`, `category`, `brand`, `minPrice`, `maxPrice`, `color`, `material`, `style`, `has3d`, `hasAr`, `featured`, `sort`, `page`, `pageSize` |  |  |
| GET | `/products/:slug` | public | `product.detail` |  |  |  |
| GET | `/products/:slug/model` | public | `product.model` |  |  |  |
| GET | `/products/:slug/360` | public | `product.view360` |  |  |  |
| GET | `/products/:slug/related` | public | `product.related` |  |  |  |
| GET | `/products/:slug/reviews` | public | `product.` | `rating` |  |  |
| POST | `/products/:slug/reviews` | user | `product.createReview` |  | { orderId, rating(1-5), content, tags?, images?, anonymous? } | `CONFLICT`, `PURCHASE_REQUIRED` |
| GET | `/products/:slug/questions` | public | `product.questions` |  |  |  |
| POST | `/products/:slug/questions` | user | `product.` |  | { content } |  |

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
| PATCH | `/reviews/:id` | user | `cart.` |  | { rating, content, tags? } |  |
| DELETE | `/reviews/:id` | user | `cart.remove` |  |  |  |

### 4. `spaces`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/spaces` | public | `space.` | `bookmarked`, `q`, `roomType`, `sort`, `style` |  |  |
| GET | `/spaces/facets` | public | `space.facets` |  |  |  |
| GET | `/spaces/:slug` | public | `space.detail` |  |  |  |
| PUT | `/spaces/:slug/bookmark` | user | `space.bookmark` |  |  |  |
| DELETE | `/spaces/:slug/bookmark` | user | `space.unbookmark` |  |  |  |

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
| POST | `/payments/:orderId/checkout` | user | `cart.` |  | { outcome?: "success"\|"failed" } | `INVALID_STATE` |
| POST | `/payments/:orderId/retry` | user | `cart.` |  | { method? } | `INVALID_STATE` |

### 4. `returns`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/returns` | user | `cart.list` | `status` |  |  |
| POST | `/returns` | user | `cart.create` |  | { orderId, items:[{orderItemId, quantity}], type:"refund"\|"exchange", reason, description, images[] } | `INVALID_STATE` |

### 4. `coupons`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/coupons/me` | user | `cart.mine` | `status` |  |  |
| GET | `/coupons/suggested` | user | `cart.suggested` |  |  |  |
| POST | `/coupons/save` | user | `cart.save` |  | { code } | `CONFLICT`, `COUPON_INVALID` |

### 4. `notifications`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/notifications` | user | `content.` | `type` |  |  |
| GET | `/notifications/unread-count` | user | `content.unreadCount` |  |  |  |
| PATCH | `/notifications/read-all` | user | `content.markAllRead` |  |  |  |
| PATCH | `/notifications/:id/read` | user | `content.markRead` |  |  |  |

### 4. `banners`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/banners` | public | `content.banners` |  |  |  |

### 4. `posts`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/posts` | public | `content.posts` |  |  |  |

### 4. `pages`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/pages` | public | `content.policies` |  |  |  |
| GET | `/pages/:slug` | public | `content.page` |  |  |  |

### 4. `faq`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/faq` | public | `content.faq` |  |  |  |

### 4. `contact`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/contact` | public | `content.` |  | { fullName, phone, email, subject, content } |  |

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
| GET | `/admin/products/:id/360` | admin | `admin.get360` |  |  |  |
| PUT | `/admin/products/:id/360` | admin | `admin.save360` |  | { enabled, autoRotate, colors:[{name,hex,frames[]}] } |  |
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
| PATCH | `/admin/orders/:id/shipment` | admin | `admin.` |  | { carrier, trackingCode } |  |
| PATCH | `/admin/orders/:id/note` | admin | `admin.saveNote` |  | { note } |  |

### 4. `admin/payments`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| PATCH | `/admin/payments/:id/confirm` | admin | `admin.confirmPayment` |  |  | `INVALID_STATE` |

### 4. `admin/returns`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/returns` | admin | `admin.list` | `q`, `status`, `type` |  |  |
| PATCH | `/admin/returns/:id` | admin | `admin.` |  | { status, adminNote? } | `INVALID_STATE` |

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

### 4. `admin/questions`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/questions` | admin | `admin.list` | `q`, `status` |  |  |
| PATCH | `/admin/questions/:id` | admin | `admin.` |  | { answer, isPublic } \| { status:"hidden" } |  |

### 4. `admin/models`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/models` | admin | `admin.list` | `format`, `productId`, `q`, `sort` |  |  |
| POST | `/admin/models` | admin | `admin.upload` |  | { productId, fileName, sizeMB, format:"glb"\|"usdz", allowAr, scale } |  |
| DELETE | `/admin/models/:id` | admin | `admin.remove` |  |  |  |

### 4. `admin/coupons`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/coupons` | admin | `admin.list` | `kind`, `q`, `sort`, `tab` |  |  |
| POST | `/admin/coupons` | admin | `admin.create` |  | CouponView (code, name, kind, value, maxDiscount?, minOrderValue, usageLimit?, perUserLimit?, startsAt, endsAt?, appliesTo, scope ids, isActive) |  |
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

### 4. `admin/banners`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/banners` | admin | `admin.banners` |  |  |  |
| POST | `/admin/banners` | admin | `admin.` |  |  |  |
| PATCH | `/admin/banners/:id` | admin | `admin.` |  |  |  |
| DELETE | `/admin/banners/:id` | admin | `admin.removeBanner` |  |  |  |

### 4. `admin/posts`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/posts` | admin | `admin.posts` |  |  |  |
| POST | `/admin/posts` | admin | `admin.` |  |  |  |
| PATCH | `/admin/posts/:id` | admin | `admin.` |  |  |  |
| DELETE | `/admin/posts/:id` | admin | `admin.removePost` |  |  |  |

### 4. `admin/pages`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/pages` | admin |  |  |  |  |
| PATCH | `/admin/pages/:id` | admin | `admin.` |  |  |  |

### 4. `admin/settings`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/settings` | admin | `admin.get` |  |  |  |
| PUT | `/admin/settings/store` | admin | `admin.save` |  | Partial<StoreSettings> |  |
| POST | `/admin/settings/reset-mock` | admin | `admin.resetMock` |  |  |  |

### 4. `admin/inventory`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| GET | `/admin/inventory` | admin | `admin.rows` | `categoryId`, `q`, `sort`, `state` |  |  |
| GET | `/admin/inventory/summary` | admin | `admin.` |  |  |  |
| GET | `/admin/inventory/receipts` | admin | `admin.receipts` |  |  |  |
| GET | `/admin/inventory/suppliers` | admin | `admin.suppliers` |  |  |  |
| POST | `/admin/inventory/receipts` | admin | `admin.createReceipt` |  | { type:"in"\|"out", supplierId?, items:[{variantId, quantity, costPrice}] } | `OUT_OF_STOCK` |

### 4. `admin/expenses`

| Method | Path | Quyền | Service FE | Query | Body | Lỗi |
|---|---|---|---|---|---|---|
| POST | `/admin/expenses` | admin | `admin.create` |  | { category, amount, note, date } |  |

## 5. Endpoint Backend cần có thêm (không nằm trong mock)

| Method | Path | Mục đích |
|---|---|---|
| POST | `/auth/refresh` | Đổi `refreshToken` lấy cặp token mới (xoay vòng, thu hồi token cũ) |
| GET | `/health` | Health check (đã có ở khung BE) |
| GET | `/payments/vnpay/return` | Return URL VNPAY: kiểm tra chữ ký, cập nhật payment, chuyển hướng tới `/checkout/success|failed?order=<code>` |
| GET | `/payments/vnpay/ipn` | IPN VNPAY (server-to-server), idempotent, trả `{RspCode, Message}` theo chuẩn VNPAY |
| POST | `/admin/media`, `/admin/media/presign`, `/admin/media/confirm` | Upload ảnh/GLB/USDZ/frame 360 (đã có khung trong BE). FE hiện gửi ảnh dạng data-URL/đường dẫn trong body (`images[]`, `frames[]`, `imageUrl`) nên BE phải **chấp nhận cả URL lẫn data-URL base64** và tự lưu vào `StorageService` |
| GET | `/admin/brands` | Danh sách thương hiệu cho form sản phẩm (FE ghi chú `có /admin/brands`) |

## 5b. Ghi chú triển khai BE (bổ sung/khác mock) – cập nhật Mốc 2

- **Đánh giá có kiểm duyệt**: `POST /products/:slug/reviews` và `PATCH /reviews/:id` ⇒ `status = pending`; danh sách công khai và điểm trung bình chỉ tính `approved`; `GET /reviews/me` trả mọi trạng thái. `PATCH /admin/reviews/:id/status` nhận `pending|approved|rejected` ("Ẩn" = `rejected`); duyệt ⇒ thông báo cho khách (Mốc 3).
- `GET /admin/orders/:code/invoice` (thêm): `{ store, order, printedAt }` để in hóa đơn. Các route `/admin/orders/:id/*` nhận id số **hoặc** mã đơn.
- `GET /admin/coupons`: `meta` ngoài phân trang còn có `all, active, upcoming, ended` (số lượng từng tab). Body tạo/sửa nhận thêm `productIds`, `spaceIds` (ngoài `categoryIds`) theo `appliesTo`; response có `categoryIds/productIds/spaceIds`.
- `POST|PATCH /admin/products`: mỗi biến thể có thể kèm `costPrice, minStock, lengthCm, widthCm, heightCm`; `stockQuantity` = tồn **có thể bán**. Ảnh là `{ url, isPrimary }` với `url` là data-URL hoặc URL đã nhận từ API (BE tái sử dụng bản ghi media).
- Khóa tài khoản: mọi request của người bị khóa (kể cả token còn hạn) ⇒ `403 AUTH_ACCOUNT_LOCKED`.
- `POST /admin/users`: mật khẩu tạm ngẫu nhiên gửi qua email (mock đặt `12345678`).
- `POST /admin/settings/reset-mock`: chỉ có ở mock, BE không cài.
- **Mốc 3 – endpoint thêm/khác mock**: `PATCH /admin/banners/reorder` `{ids}`; `GET /posts/:slug`; `POST|PATCH|DELETE /admin/pages`; `/admin/faq` (+ `/topics`, `/items`); `GET /admin/contact-messages` + `PATCH /admin/contact-messages/:id/handled`; `POST /spaces/:slug/add-to-cart` → `{ added, unavailable:[{productId,name,reason}], cart }`; `POST /admin/models/upload` (multipart `file` + `productId`, `variantId?`, `allowAr?`, `scale?`, `unit?`, `placement?`).
- **Đổi trả**: `POST /returns` số lượng vượt `đã mua − đã yêu cầu` ⇒ `400 VALIDATION_FAILED` (`details.items`); quá 7 ngày ⇒ `409 INVALID_STATE`; `PATCH /admin/returns/:id` loại `refund` chỉ sang `refunded`, loại `exchange` chỉ sang `exchanged`; từ chối bắt buộc `adminNote`.
- **Hỏi đáp**: `PATCH /admin/questions/:id` nhận thêm `{ status: "visible" }` (hiện lại). `POST /products/:slug/questions` giới hạn 5 câu/giờ (`429 RATE_LIMITED`), trùng nội dung 24h ⇒ `409 CONFLICT`.
- **Đánh giá**: `images` tối đa 5 (`400`), mỗi ảnh ≤ 5MB (`413`), sai chữ ký tệp (`415`).
- **Mô hình 3D**: `POST /admin/models` nhận thêm `fileData` (data-URL) / `unit`; tệp ≤ 50MB, `.glb|.gltf|.usdz`, kiểm tra chữ ký; không có `fileData` ⇒ BE dùng tệp mẫu cùng định dạng (FE chưa gửi nhị phân).
- **Liên hệ**: `POST /contact` giới hạn 5 lần/phút/IP (`429`).
- Cổng API mặc định **4000** (`NEXT_PUBLIC_API_URL=http://localhost:4000`).

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
  description?: string | null; // TODO: chưa có trong DB
  isFeatured?: boolean; // TODO: chưa có trong DB
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
  brand: { id: number; name: string } | null;
  colors: ColorOption[];
  sizes: string[];
  material: string | null; // thuộc tính "material" của biến thể
  style: string | null; // TODO: chưa có trong DB
  sku: string;
  isWishlisted: boolean;
  /** Sản phẩm có ảnh xoay 360° – TODO: cần thêm vào DB/API */
  has360: boolean;
}

export interface VariantView extends ProductVariant {
  color: ColorOption | null;
  size: string | null;
  material: string | null;
  imageUrl: string | null;
}

export interface ProductImageView {
  id: number;
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
  glbUrl: string | null;
  usdzUrl: string | null;
  posterUrl: string | null;
}

export interface ProductDetail extends ProductListItem {
  images: ProductImageView[];
  variants: VariantView[];
  specs: Array<{ label: string; value: string }>; // TODO: chưa có trong DB (dựng từ thuộc tính + kích thước mô hình)
  features: string[]; // TODO: chưa có trong DB
  model: Model3DView | null;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  questionCount: number;
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
  images: string[]; // TODO: chưa có trong DB
  tags: string[]; // TODO: chưa có trong DB (chip tiêu chí)
}

// ---------- Người dùng ----------
export interface UserView extends User {
  roles: RoleCode[];
  avatarUrl: string | null;
  gender: 'male' | 'female' | 'other' | null; // TODO: chưa có trong DB
  birthday: string | null; // TODO: chưa có trong DB
  customerGroup: 'new' | 'loyal'; // TODO: chưa có trong DB (suy ra từ số đơn/chi tiêu)
  loyaltyPoints: number; // TODO: chưa có trong DB
  adminNote: string | null; // TODO: chưa có trong DB
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AddressView extends Address {
  label: string; // TODO: chưa có trong DB ("Nhà riêng", "Văn phòng")
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
  internalNote: string | null; // TODO: chưa có trong DB
  deliveredAt: string | null;
  canReturnUntil: string | null;
}

// ---------- Coupon ----------
export interface CouponView extends Coupon {
  name: string; // TODO: chưa có trong DB
  description: string | null; // TODO: chưa có trong DB
  appliesTo: 'all' | 'category' | 'product' | 'space'; // TODO: chưa có trong DB
  appliesToLabel: string; // TODO: chưa có trong DB
  kind: 'percent' | 'fixed' | 'freeship'; // 'freeship' TODO: CouponType DB chỉ có percent|fixed
}

export interface UserCouponView {
  id: number;
  couponId: number;
  userId: number;
  status: 'unused' | 'used' | 'expired'; // TODO: chưa có bảng user_coupons
  savedAt: string;
  coupon: CouponView;
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
  isBookmarked: boolean;
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
  placements: SpaceProductPlacement[];
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
  productName: string;
  productThumbnailUrl: string | null;
  format: 'glb' | 'usdz';
  fileName: string;
  sizeMB: number;
  uploadedAt: string;
}

// ---------- Thực thể CHƯA có trong DB (mock tự đặt tên theo WIREFRAME.md mục 5) ----------
export type ReturnStatus = 'pending' | 'picking' | 'inspecting' | 'refunded' | 'exchanged' | 'rejected';
export interface ReturnRequest {
  // TODO: chưa có trong DB
  id: number;
  code: string; // "RT0012"
  orderId: number;
  orderCode: string;
  userId: number;
  customerName: string;
  items: Array<{
    productId: number;
    productName: string;
    imageUrl: string | null;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
  }>;
  type: 'refund' | 'exchange';
  reason: 'defect' | 'wrong_item' | 'not_as_described' | 'missing_accessory' | 'change_mind';
  description: string;
  images: string[];
  refundAmount: number;
  status: ReturnStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductQuestion {
  // TODO: chưa có trong DB
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  productImageUrl: string | null;
  userId: number;
  userName: string;
  content: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  isPublic: boolean;
  status: 'unanswered' | 'answered' | 'hidden';
  createdAt: string;
}

export interface Banner {
  // TODO: chưa có trong DB
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string;
  position: 'hero-1' | 'hero-2' | 'hero-3' | 'home-left' | 'home-right' | 'home-3d';
  startAt: string;
  endAt: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Post {
  // TODO: chưa có trong DB
  id: number;
  title: string;
  slug: string;
  category: string;
  coverUrl: string;
  content: string;
  authorName: string;
  status: 'published' | 'draft';
  views: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface Supplier {
  // TODO: chưa có trong DB
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface StockReceipt {
  // TODO: chưa có trong DB
  id: number;
  code: string; // "PN0012" | "PX0012"
  type: 'in' | 'out';
  supplierId: number | null;
  supplierName: string | null;
  orderCode: string | null;
  itemCount: number;
  total: number;
  status: 'draft' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface InventoryRow {
  variantId: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  sku: string;
  categoryName: string;
  costPrice: number; // TODO: chưa có trong DB
  stockQuantity: number;
  reservedQty: number; // TODO: chưa có trong DB (suy từ đơn chưa giao)
  available: number;
  minStock: number; // TODO: chưa có trong DB
  state: 'in_stock' | 'low' | 'out';
}

export interface Expense {
  // TODO: chưa có trong DB
  id: number;
  code: string; // "CH-0001"
  category: 'cogs' | 'shipping' | 'marketing' | 'payment_fee' | 'refund' | 'other';
  amount: number;
  note: string;
  date: string;
}

export interface ContactMessage {
  // TODO: chưa có trong DB
  id: number;
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  content: string;
  createdAt: string;
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
  totalExpense: number;
  profit: number;
  margin: number;
  deltas: { income: number; expense: number; profit: number; margin: number };
  monthly: Array<{ month: string; income: number; expense: number; profit: number }>;
  expenseBreakdown: Array<{ category: Expense['category']; label: string; amount: number; percent: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; percent: number }>;
  byCategory: Array<{ name: string; amount: number; percent: number }>;
  daily: Array<{ date: string; revenue: number }>;
  income: {
    gross: number;
    discountAndRefund: number;
    net: number;
    cogs: number;
    grossProfit: number;
    opex: number;
    profitBeforeTax: number;
  };
  ledger: Array<{
    date: string;
    code: string;
    content: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
  }>;
  topProducts: DashboardStats['topProducts'];
}

// ---------- Xem 360° (TODO: cần thêm vào DB/API) ----------
export interface Product360Color {
  colorId: number;
  name: string;
  hex: string;
  thumbnail: string;
  /** URL ảnh theo thứ tự góc 0° → 350° */
  frames: string[];
}

export interface Product360Variant extends VariantView {
  dimensionsCm: { length: number; width: number; height: number };
  weightKg: number | null;
}

export interface PolicyItem {
  key: 'shipping' | 'returns' | 'warranty' | 'payment';
  title: string;
  summary: string;
  href: string;
}

export interface Product360Data {
  productId: number;
  slug: string;
  enabled: boolean;
  frameCount: number;
  defaultColor: string;
  autoRotate: boolean;
  rotationSpeed: number;
  colors: Product360Color[];
  variants: Product360Variant[];
  product: ProductDetail;
  policies: PolicyItem[];
}

export interface Product360AdminData {
  enabled: boolean;
  frameCount: number;
  autoRotate: boolean;
  colors: Array<{ name: string; hex: string; frames: string[] }>;
  variantColors: ColorOption[];
}
```
