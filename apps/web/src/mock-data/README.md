# mock-data – dữ liệu giả & mock API cho giao diện Aurelia Living

Thư mục này cho phép chạy và kiểm tra **toàn bộ giao diện mà không cần backend**. Nằm ở `apps/web/src/mock-data/` (import bằng alias `@/mock-data/...`).

## Chạy giao diện với dữ liệu giả

```bash
npm install                                     # ở thư mục gốc monorepo (một lần)
cp apps/web/.env.example apps/web/.env.development.local   # đã bật NEXT_PUBLIC_USE_MOCK=true
npm run dev -w @aurelia-living/web              # http://localhost:3000
```

| Việc | Cách làm |
|---|---|
| Bật mock | `NEXT_PUBLIC_USE_MOCK=true` (trong `apps/web/.env.development.local`) rồi chạy lại `next dev` |
| Tắt mock (gọi backend thật) | Đặt `NEXT_PUBLIC_USE_MOCK=false` (hoặc xóa biến) và đặt `NEXT_PUBLIC_API_URL`; **không sửa code giao diện** |
| Khôi phục dữ liệu mẫu | Mở URL bất kỳ kèm `?resetMock=1` (vd. `http://localhost:3000/?resetMock=1`) hoặc Admin → Cài đặt → "Khôi phục dữ liệu mẫu" |
| Giả lập lỗi / độ trễ | Admin → Cài đặt → "Dữ liệu giả lập" (bật lỗi GET, tỉ lệ lỗi ngẫu nhiên, tắt độ trễ 200–500ms) |
| Giả lập thanh toán online thất bại | Khi đặt hàng, ghi chú đơn hàng có chứa `[fail]` → chuyển tới `/checkout/failed` |

Mọi thay đổi (giỏ hàng, đơn hàng, CRUD admin…) được **lưu vào `localStorage`** (`aurelia-mock-db-v5`).

## Tài khoản test

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Khách hàng | `khachhang@aurelia.vn` | `123456` | Có sẵn giỏ hàng (3 SP), 9 đơn đủ trạng thái, 9 mã giảm giá, 16+ thông báo, yêu thích |
| Doanh nghiệp (admin) | `admin@aurelia.vn` | `admin123` | Vào `/admin` (đăng nhập tại `/admin/login`) |
| Quên mật khẩu | – | OTP luôn là `123456` | Mọi email đều nhận OTP giả lập |

Ngoài ra có 32 khách hàng khác (mật khẩu `123456`), trong đó 3 tài khoản tạm khóa và 1 tài khoản bị cấm (đăng nhập sẽ báo lỗi). Hệ thống **chỉ có 2 vai trò** `admin` (Doanh nghiệp) và `user` (Khách hàng) – không có nhân viên.

## Cấu trúc

```
mock-data/
  tables/            mỗi bảng DB một file, tên file trùng tên bảng (xem bảng dưới)
  mockApi/           lớp giả lập API (cùng URL/method/response như Backend thật)
    index.ts           bộ định tuyến + xác thực token + độ trễ + giả lập lỗi
    auth.ts catalog.ts shop.ts admin.ts   handler theo nhóm; views.ts = ghép entity + quan hệ
  utils/             rng (PRNG có hạt giống), svg (ảnh minh họa), vi (dữ liệu tiếng Việt), media-registry
  db.ts              nạp bảng, lưu localStorage, resetDb(), tính lại số tổng hợp
  index.ts           gom tất cả bảng
```

Ảnh minh họa SVG (tông kem–nâu) sinh bởi route `apps/web/src/app/mock-img/[kind]/route.ts` (sản phẩm, phòng, ảnh 360°, banner, avatar). Mô hình 3D mẫu `apps/web/public/mock/models/*.glb` do `apps/web/scripts/gen-mock-glb.mjs` tự sinh (CC0, không vướng bản quyền) – chạy lại bằng `node apps/web/scripts/gen-mock-glb.mjs`.

## Các bảng (khớp tên bảng và tên trường `packages/shared-types`)

| File | Số bản ghi (≈) | Ghi chú |
|---|---|---|
| `roles`, `user_roles`, `users` | 2 / 34 / 34 | 1 admin + 33 khách; trạng thái `active|suspended|banned` |
| `addresses` | 60+ | 1–3 địa chỉ/khách, đúng 1 mặc định |
| `categories` | 22 | cây 2 cấp: 5 nhóm phòng → 17 danh mục lá |
| `brands`, `attributes`, `attribute_values` | 6 / 3 / 30 | màu (kèm mã hex), kích thước, chất liệu |
| `products`, `product_variants`, `variant_attribute_values`, `product_images` | 52 / 200+ | giá gốc/sale, tồn kho (có hết hàng/sắp hết), 4–5 ảnh/SP |
| `product_3d_models`, `model_files` | 30+ | GLB thật dùng được; một số USDZ giữ chỗ |
| `spaces`, `space_panoramas`, `space_hotspots`, `space_product_placements`, `space_bookmarks`, `space_views` | 24 / 48 / … | 6 phong cách × 4 loại phòng, ảnh 360°, hotspot (yaw/pitch → productId) |
| `carts`, `cart_items`, `wishlists` | | giỏ hàng/yêu thích cho tài khoản test |
| `coupons`, `coupon_usages` | 14 / … | giảm %, giảm tiền, freeship; đang diễn ra / sắp diễn ra / đã kết thúc |
| `orders`, `order_items`, `order_status_history`, `payments`, `shipments` | 74 / … | tháng 01–11/2026, đủ mọi trạng thái + phương thức, tổng tiền tính đúng |
| `inventory_movements` | | nhập − bán + trả = tồn kho hiện tại |
| `reviews` | 80+ | chỉ gắn đơn đã giao; có chờ duyệt / bị ẩn |
| `notifications`, `activity_logs` | 16+ (khách test) / 25+ | |
| `pages`, `settings` | 7 / 3 | Về chúng tôi + 6 chính sách; cửa hàng, thanh toán, phí vận chuyển |
| **Chưa có trong DB (`// TODO: chưa có trong DB`)** | | |
| `return_requests` | 13 | đổi trả đủ trạng thái |
| `product_questions` | 34 | hỏi đáp: chưa trả lời / đã trả lời / ẩn |
| `user_coupons` | | mã giảm giá đã lưu của khách (chưa dùng / đã dùng / hết hạn) |
| `banners`, `posts`, `faq_topics` | 7 / 7 / 6 | nội dung |
| `suppliers`, `stock_receipts`, `expenses` | 5 / 16 / 60+ | kho & thu chi |
| `review_extras`, `product_extras` | | ảnh/chip đánh giá; phong cách, giá vốn, đặc điểm, thông số SP |

Các số tổng hợp (doanh thu, số đơn theo trạng thái, top bán chạy, KPI dashboard, báo cáo thu chi, rating, đã bán, lượt dùng coupon) **được tính ra từ dữ liệu** (xem `mockApi/admin.ts`, `db.ts → recomputeAggregates`), không gõ cứng.

## Quy ước

- JSON dùng **camelCase** đúng như `API_CONVENTIONS.md`/`entities.generated.ts`; tiền là số nguyên VNĐ; ngày là ISO UTC trong năm 2026; "hôm nay" của dữ liệu là `2026-11-05`.
- Envelope: `{ success, data, meta? }`, lỗi `{ success:false, error:{ code, message, details? } }` với mã lỗi trong `error-codes.ts`; phân trang `page/pageSize/total/totalPages`; sắp xếp `sort=truong:asc|desc`.
- Phân quyền: endpoint `/admin/*` chỉ cho role `admin`; khách hàng gọi sẽ nhận `403 FORBIDDEN`. User chỉ thấy dữ liệu của mình (truy cập đơn người khác → `404`).
- Component **không** import dữ liệu trực tiếp; luôn đi qua `src/services/*.api.ts`.
- Kiểm tra toàn vẹn: `npm run test -w @aurelia-living/web` (file `tests/unit/mock-data.test.ts`).

## Ảnh 360° sản phẩm (tính năng "Xem 360°")

- Danh sách sản phẩm/màu: `apps/web/scripts/mock-360-products.json` (dùng chung với `tables/_360_gen.ts`).
- Sinh lại 1.080 frame (10 sản phẩm × 3 màu × 36 frame, SVG dựng bằng khối hộp xoay thật, có ghi góc 0°…350°):

```bash
node apps/web/scripts/gen-mock-360.mjs   # → apps/web/public/mock/360/<product-slug>/<color-slug>/frame-01..36.svg
```

- Bảng mock: `product_360`, `product_360_frames`; endpoint mock: `GET /products/:slug/360`, `GET|PUT /admin/products/:id/360`.
- Sản phẩm có 360°: Sofa Nordic, Sofa Luxury, Sofa góc hiện đại, Ghế thư giãn, Giường hiện đại, Giường bọc nỉ, Bàn ăn gỗ tự nhiên, Bàn làm việc, Tủ quần áo hiện đại, Đèn trang trí.
- Tổ hợp hết hàng để thử: Sofa Nordic (Xám, 4 chỗ), Giường bọc nỉ (Xanh, 2m), Bàn ăn gỗ tự nhiên (màu Trắng – hết mọi kích thước).
