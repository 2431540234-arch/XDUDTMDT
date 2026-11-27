# mock-data – dữ liệu giả & mock API cho giao diện Aurelia Living

Thư mục này cho phép chạy và kiểm tra **toàn bộ giao diện mà không cần backend**. Nằm ở `apps/web/src/mock-data/` (import bằng alias `@/mock-data/...`).

> Cập nhật lần cuối: 2026-11-25 (schema 32 bảng; đã bỏ các bảng `roles`/`user_roles`/`brands`/`attributes` và nhóm bảng mở rộng).
>
> **Chỉ dùng khi `NEXT_PUBLIC_USE_MOCK=true`.** Mọi lời gọi API đi qua `request()` ở `src/services/api-client.ts`; khi biến này `true` nó chuyển vào mock trong trình duyệt, ngược lại gọi `fetch` tới API thật. Biến `NEXT_PUBLIC_*` được **nhúng vào mã lúc build**, vì vậy **`next build` (production) THẤT BẠI nếu `NEXT_PUBLIC_USE_MOCK=true`** (`apps/web/next.config.js`); mock chỉ dành cho `next dev` và test giao diện. `apps/web/.env.example` đặt mặc định `true` (chạy giao diện không cần backend); `infra/docker/Dockerfile.web` mặc định `false`. Dữ liệu mock cũng là nguồn seed cho DB demo/test (`SEED_SOURCE=mock`, `node scripts/db-reset.mjs aurelia_demo`). Xem [docs/ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md) mục 4 và [docs/ENVIRONMENT.md](../../../../docs/ENVIRONMENT.md).

## Chạy giao diện với dữ liệu giả

```bash
npm install                                     # ở thư mục gốc monorepo (một lần)
cp apps/web/.env.example apps/web/.env.development.local   # đã bật NEXT_PUBLIC_USE_MOCK=true
npm run dev -w @aurelia-living/web              # http://localhost:3000
```

| Việc                               | Cách làm                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Bật mock                           | `NEXT_PUBLIC_USE_MOCK=true` (trong `apps/web/.env.development.local`) rồi chạy lại `next dev`                              |
| Tắt mock (gọi backend thật)        | Đặt `NEXT_PUBLIC_USE_MOCK=false` (hoặc xóa biến) và đặt `NEXT_PUBLIC_API_URL`; **không sửa code giao diện**                |
| Khôi phục dữ liệu mẫu              | Mở URL bất kỳ kèm `?resetMock=1` (vd. `http://localhost:3000/?resetMock=1`) hoặc Admin → Cài đặt → "Khôi phục dữ liệu mẫu" |
| Giả lập lỗi / độ trễ               | Admin → Cài đặt → "Dữ liệu giả lập" (bật lỗi GET, tỉ lệ lỗi ngẫu nhiên, tắt độ trễ 200–500ms)                              |
| Giả lập thanh toán online thất bại | Khi đặt hàng, ghi chú đơn hàng có chứa `[fail]` → chuyển tới `/checkout/failed`                                            |

Mọi thay đổi (giỏ hàng, đơn hàng, CRUD admin…) được **lưu vào `localStorage`** (`aurelia-mock-db-v8-<mã của bảng ghép + ảnh đang có>`).

## Tài khoản test

| Vai trò              | Email                  | Mật khẩu         | Ghi chú                                                                                                                                                                                    |
| -------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Khách hàng           | `khachhang@aurelia.vn` | `123456`         | Có sẵn giỏ hàng (3 SP), 9 đơn đủ trạng thái, 9 mã giảm giá, 16+ thông báo, yêu thích                                                                                                       |
| Doanh nghiệp (admin) | `admin@aurelia.vn`     | `admin123`       | Vào `/admin` (đăng nhập tại `/admin/login`)                                                                                                                                                |
| Quên mật khẩu        | –                      | liên kết đặt lại | Mock trả thêm `devResetLink` để thử không cần email; API thật gửi liên kết `/reset-password?token=…` qua email (không còn OTP). Mật khẩu mới phải ≥ 8 ký tự có chữ hoa, chữ thường, chữ số |

Ngoài ra có 32 khách hàng khác (mật khẩu `123456`), trong đó 3 tài khoản tạm khóa và 1 tài khoản bị cấm (đăng nhập sẽ báo lỗi). Hệ thống **chỉ có 2 vai trò** `admin` (Doanh nghiệp) và `user` (Khách hàng) – không có nhân viên.

## Cấu trúc

```
mock-data/
  tables/            mỗi bảng DB một file, tên file trùng tên bảng (xem bảng dưới)
  mockApi/           lớp giả lập API (cùng URL/method/response như Backend thật)
    index.ts           bộ định tuyến + xác thực token + độ trễ + giả lập lỗi
    auth.ts catalog.ts shop.ts admin.ts   handler theo nhóm; views.ts = ghép entity + quan hệ
  utils/             rng (PRNG có hạt giống), svg (ảnh minh họa), photos (ảnh thật), vi, media-registry
  photos/            manifest.json – bảng ghép ảnh thật ↔ sản phẩm/không gian (chỉ có đường dẫn, không có ảnh)
  db.ts              nạp bảng, lưu localStorage, resetDb(), tính lại số tổng hợp
  index.ts           gom tất cả bảng
```

Ảnh minh họa SVG (tông kem–nâu) sinh bởi route `apps/web/src/app/mock-img/[kind]/route.ts` (sản phẩm, phòng, ảnh 360°, avatar). Dữ liệu mẫu không có mô hình 3D: nút 3D chỉ hiện khi admin tạo/tải lên và duyệt. Ở chế độ mock, tải GLB chỉ được mô phỏng (tệp giữ bằng URL tạm của trình duyệt) và không có tạo bằng AI.

## Ảnh thật (không nằm trong git)

Ảnh thật **không được commit** (chưa xác minh quyền phát tán), kể cả bản WebP đã chuyển. Máy không có ảnh (máy mới, CI, test) thì mock và seed **tự dùng ảnh minh họa**, không báo lỗi.

1. Chép (xin từ người giữ bộ ảnh) hai thư mục `sản phẩm/` và `không gia mẫu/` vào **thư mục gốc repo**, giữ nguyên tên thư mục và tên file.
2. Ở thư mục gốc: `npm install` rồi `npm run images:convert` (chuyển sang WebP, cạnh dài tối đa 1600 px, chất lượng 80, vào `apps/web/public/mock/photos/`; chỉ đọc ảnh gốc; thêm `-- --force` để chuyển lại). Script báo số file thiếu.
3. Chế độ mock: **khởi động lại** `next dev` (danh sách ảnh được đọc lúc khởi động).
4. API thật: ảnh vào kho lưu trữ khi seed (`node scripts/db-reset.mjs aurelia_demo`; với MinIO đặt `STORAGE_DRIVER=minio` hoặc chạy `npm run minio:sync` sau khi seed ra đĩa). DB đã có dữ liệu muốn thay ảnh mà **không** nạp lại: xem đầu file `apps/api/prisma/update-real-images.ts` (sao lưu DB trước).

- Mỗi sản phẩm chỉ dùng ảnh thật khi có **đủ** mọi file trong manifest; thiếu một file thì cả sản phẩm dùng ảnh minh họa. Sản phẩm/không gian không có trong manifest luôn dùng ảnh minh họa; ảnh 360° của không gian, danh mục, avatar, banner vẫn là ảnh minh họa.
- Ép dùng ảnh minh họa dù máy có ảnh: đặt biến môi trường `REAL_PHOTOS=off`.
- Biến thể mặc định lấy theo **màu của ảnh chính** nếu ảnh chính có gắn màu (cả mock và API); không thì là màu đầu tiên. Ảnh chỉ được ghép khi màu trong ảnh khớp một màu sản phẩm đang bán.
- Cắt mép ảnh khi chuyển (ví dụ bỏ logo, chấm màu ở mép): thêm `"crop": { "right": 0.12 }` (tỉ lệ cạnh bị cắt: `left`, `top`, `right`, `bottom`); ảnh gốc giữ nguyên.
- Bỏ một sản phẩm khỏi manifest: chạy lại `npm run images:convert` (xóa file thừa), và với DB đã cập nhật thì chạy lại `update-real-images` để đưa về ảnh minh họa.
- Đổi bảng ghép: sửa `photos/manifest.json` (`confidence`: `sure` chắc chắn, `guess` ghép theo phỏng đoán, cần người xem lại; `color` phải là màu sản phẩm có). Đổi ảnh thì đặt **tên file ra mới**, vì seed không ghi đè khóa đã có trong kho.
- Không dùng `git add -f` cho các thư mục ảnh. `.gitignore` và `.dockerignore` đã loại chúng.

## Các bảng (khớp tên bảng và tên trường `packages/shared-types`)

| File                                                                         | Số bản ghi (≈)         | Ghi chú                                                                                                    |
| ---------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `users`                                                                      | 34                     | 1 admin (`role = admin`) + 33 khách; trạng thái `active`/`suspended`/`banned`                              |
| `addresses`                                                                  | 60+                    | 1–3 địa chỉ/khách, đúng 1 mặc định                                                                         |
| `categories`                                                                 | 22                     | cây 2 cấp: 5 nhóm phòng → 17 danh mục lá                                                                   |
| `attribute_values`                                                           | 30                     | màu (kèm mã hex), kích thước, chất liệu (loại thuộc tính là enum `attribute_code`)                         |
| `products`, `product_variants`, `variant_attribute_values`, `product_images` | 52 / 200+              | giá gốc/sale, tồn kho (có hết hàng/sắp hết), ảnh thật (tối đa 6/SP) nếu máy có, không thì 4–5 ảnh minh họa |
| `product_3d_models`, `model_files`                                           | 0                      | không có mô hình mẫu                                                                                       |
| `spaces`, `space_panoramas`, `space_hotspots`, `space_product_placements`    | 24 / 48 / …            | 6 phong cách × 4 loại phòng, ảnh 360°, hotspot (yaw/pitch → productId)                                     |
| `carts`, `cart_items`, `wishlists`                                           |                        | giỏ hàng/yêu thích cho tài khoản test                                                                      |
| `coupons`, `coupon_usages`                                                   | 14 / …                 | giảm %, giảm tiền, freeship; đang diễn ra / sắp diễn ra / đã kết thúc                                      |
| `orders`, `order_items`, `order_status_history`, `payments`, `shipments`     | 74 / …                 | tháng 01–11/2026, đủ mọi trạng thái + phương thức, tổng tiền tính đúng                                     |
| `reviews`                                                                    | 80+                    | chỉ gắn đơn đã giao; có chờ duyệt / bị ẩn                                                                  |
| `notifications`, `activity_logs`                                             | 16+ (khách test) / 25+ |                                                                                                            |
| `settings`                                                                   | 3                      | cửa hàng, thanh toán, phí vận chuyển (trang tĩnh viết cứng ở `src/content/static-pages.ts`)                |
| `faq_topics`                                                                 | 6                      | FAQ                                                                                                        |
| `review_extras`, `product_extras`                                            |                        | chip đánh giá; phong cách, giá vốn, đặc điểm SP                                                            |

Các số tổng hợp (doanh thu, số đơn theo trạng thái, top bán chạy, KPI dashboard, báo cáo thu chi, rating, đã bán, lượt dùng coupon) **được tính ra từ dữ liệu** (xem `mockApi/admin.ts`, `db.ts → recomputeAggregates`), không gõ cứng.

## Quy ước

- JSON dùng **camelCase** đúng như `API_CONVENTIONS.md`/`entities.generated.ts`; tiền là số nguyên VNĐ; ngày là ISO UTC trong năm 2026; "hôm nay" của dữ liệu là `2026-11-05`.
- Envelope: `{ success, data, meta? }`, lỗi `{ success:false, error:{ code, message, details? } }` với mã lỗi trong `error-codes.ts`; phân trang `page/pageSize/total/totalPages`; sắp xếp `sort=truong:asc|desc`.
- Phân quyền: endpoint `/admin/*` chỉ cho role `admin`; khách hàng gọi sẽ nhận `403 FORBIDDEN`. User chỉ thấy dữ liệu của mình (truy cập đơn người khác → `404`).
- Component **không** import dữ liệu trực tiếp; luôn đi qua `src/services/*.api.ts`.
- Kiểm tra toàn vẹn: `npm run test -w @aurelia-living/web` (file `tests/unit/mock-data.test.ts`).

## Dữ liệu thử

- Tổ hợp hết hàng để thử: Sofa Nordic (Xám, 4 chỗ), Giường bọc nỉ (Xanh, 2m), Bàn ăn gỗ tự nhiên (màu Trắng – hết mọi kích thước).
