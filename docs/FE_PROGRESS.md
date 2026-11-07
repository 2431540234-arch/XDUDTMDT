# Tiến độ dựng Frontend theo wireframe (nhánh `feature/fe-wireframe-mock`)

> Mở phiên mới: "Đọc docs/FE_PROGRESS.md và tiếp tục từ bước đang dở theo docs/PROMPT_AGENT_FE.md".

## Trạng thái giai đoạn
| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1–5 | Đọc tài liệu, quét DB/BE/FE, báo cáo `docs/PROJECT_ANALYSIS.md` | ✅ |
| 6 | Design system (tokens, UI nền tảng, layout, component storefront + admin) | ✅ |
| 7 | `apps/web/src/mock-data/` + mock API (~140 endpoint) | ✅ |
| 8 | 54 màn hình | ✅ (xem bảng) |
| 9 | lint ✅, typecheck ✅, 15 unit test ✅, `next build` ✅, 7 e2e Playwright ✅ | ✅ |

## Bảng 54 màn hình
✅ = dựng đủ, e2e duyệt không lỗi console/HTTP/ảnh vỡ · 🟡 = lệch nhỏ so với wireframe.

| # | Màn hình | Route | TT | Ghi chú |
|---|---|---|---|---|
| 1 | Trang chủ | `/` | ✅ | |
| 2 | Danh sách SP | `/products` | ✅ | |
| 3 | Chi tiết SP | `/products/[slug]` | ✅ | |
| 4 | Giỏ hàng | `/cart` | ✅ | |
| 5 | Thanh toán | `/checkout` | ✅ | |
| 6, 7 | Đăng nhập / Đăng ký | `/login`, `/register` | ✅ | Google giả lập |
| 8 | Tài khoản cá nhân | `/account/profile` | ✅ | |
| 9 | Mã giảm giá | `/account/coupons` | ✅ | |
| 10 | Đơn hàng của tôi | `/account/orders` | ✅ | |
| 11 | Đánh giá của tôi | `/account/reviews` | ✅ | |
| 12 | Yêu thích | `/wishlist` | ✅ | |
| 13 | Tìm kiếm | `/search` | ✅ | |
| 14 | Không gian mẫu | `/spaces` | ✅ | |
| 15 | Admin tổng quan | `/admin` | ✅ | |
| 16, 17 | Admin SP (DS + form 6 tab) | `/admin/products[/new,/id]` | ✅ | |
| 18, 19 | Admin không gian (DS + form 5 tab) | `/admin/spaces[/new,/id]` | ✅ | hotspot đặt bằng click trên ảnh 2D |
| 20, 47 | Admin danh mục + modal | `/admin/categories` | ✅ | |
| 21, 44 | Admin đơn hàng + chi tiết | `/admin/orders[/code]` | ✅ | |
| 22, 46 | Admin khách hàng + chi tiết | `/admin/customers[/id]` | 🟡 | thiếu tab "Mã giảm giá" ở chi tiết KH |
| 23 | Admin đánh giá | `/admin/reviews` | 🟡 | không có "+ Thêm đánh giá" (D-N06) |
| 24, 49 | Admin mô hình 3D + modal | `/admin/models` | ✅ | tiến trình tải giả lập |
| 25, 48 | Admin khuyến mãi + tạo/sửa | `/admin/promotions[/new,/id]` | ✅ | phạm vi theo SP/không gian chỉ ghi nhận |
| 26 → 54 | Admin báo cáo thu chi | `/admin/reports` | ✅ | thay cho 3.10 |
| 27 | Chi tiết đơn (khách) | `/account/orders/[code]` | ✅ | |
| 28 | Đặt hàng thành công/thất bại | `/checkout/success`, `/failed` | ✅ | |
| 29, 30 | Quên / đặt lại mật khẩu | `/forgot-password`, `/reset-password` | ✅ | OTP `123456` |
| 31 | Đổi mật khẩu | `/account/password` | ✅ | |
| 32 | Chi tiết không gian mẫu | `/spaces/[slug]` | ✅ | viewer 360° bằng R3F; chưa vẽ mô hình đặt trong ảnh |
| 33 | Trình xem 3D/AR | `/products/[slug]/3d` | 🟡 | mã QR AR là minh họa |
| 34 | Modal viết/sửa đánh giá | — | ✅ | |
| 35 | Yêu cầu đổi trả + DS | `/account/returns[/new]` | ✅ | |
| 36 | Thông báo | `/account/notifications` | ✅ | |
| 37–40 | Về chúng tôi, Liên hệ, FAQ, Chính sách | `/about`, `/contact`, `/faq`, `/policies/[slug]` | 🟡 | bản đồ là khung minh họa |
| 41 | Giỏ hàng trống | `/cart` | ✅ | |
| 42 | 404 | `*` | ✅ | |
| 43 | Admin đăng nhập | `/admin/login` | ✅ | |
| 45 | Admin đổi trả | `/admin/returns` | ✅ | |
| 50 | Admin hỏi đáp | `/admin/questions` | ✅ | |
| 51 | Admin nội dung | `/admin/content` | 🟡 | tab "Menu & footer" chỉ hiển thị thông tin |
| 52 | Admin cài đặt | `/admin/settings` | 🟡 | Email/Giao diện/SEO/Bảo mật chỉ hiển thị thông tin |
| 53 | Admin kho hàng | `/admin/inventory` | ✅ | |

So sánh ảnh chụp 1440px trang chủ và chi tiết sản phẩm với `wireframes/01`, `03`: khớp bố cục, thứ tự section, màu. Các trang khác kiểm bằng e2e, chưa so từng ảnh.

## Thư viện thêm
Không thêm thư viện mới.

## File cũ đã sửa (kèm lý do)
- `styles/{theme.ts,globals.css}`, `tailwind.config.ts`: design tokens theo WIREFRAME 0.1 (primary `#8B5E3C` → `#8B4A2B`).
- Các file khung 5 dòng (components, hooks, services, store, lib, types) được điền nội dung, không đổi tên.
- `app/providers.tsx`: thêm `<Toaster />`, nạp phiên đăng nhập sau khi mount.
- `app/page.tsx`, `(shop)/*`, `(auth)/*`, `admin/products/*`: thay trang khung; `admin/dashboard` → chuyển hướng `/admin`.
- `next.config.js`: bỏ yêu cầu `NEXT_PUBLIC_API_URL` khi `NEXT_PUBLIC_USE_MOCK=true`.
- `vitest.config.mts` (alias `@`), `playwright.config.ts` (bật mock, 1 worker), `tests/e2e/home.spec.ts` (theo trang chủ mới), `types/model-viewer.d.ts` (`camera-orbit`).

## Việc còn tồn đọng / cần quyết định
- Backend thật mới là khung rỗng: mọi endpoint ngoài `media`/`models presign` chỉ có ở mock (đánh dấu `TODO: chưa có trong BE`).
- Thực thể chưa có trong DB (đổi trả, hỏi đáp, banner, bài viết, kho, phiếu chi…): cần quyết định có thêm bảng/migration không.
- Tài liệu UML lớn (`BAO_CAO_…`, `docs/diagrams`) chỉ đọc mục lục.

---

## Tính năng "Xem 360°" (nhánh `feature/product-360`, theo `docs/PROMPT_360_SAN_PHAM.md`)

**Route mới:** `/products/[slug]/360` (kèm `?color=<slug>&size=<slug>`, ví dụ `?color=kem&size=3-cho`).

**Thử ngay (sau `npm run dev -w @aurelia-living/web`):**
- http://localhost:3000/products/sofa-nordic/360?color=kem&size=3-cho
- http://localhost:3000/products/sofa-luxury · /products/giuong-boc-ni · /products/ban-an-go-tu-nhien · /products/den-trang-tri (nút "Xem 360°")
- Hết hàng: Sofa Nordic màu Xám + 4 chỗ; Bàn ăn gỗ tự nhiên màu Trắng. Sản phẩm không có 360° (không hiện nút): `/products/ke-tivi-hien-dai`.
- Admin: `/admin/products/1` → tab "Ảnh 360°".

### File tạo/sửa
- Mới: `components/product/Rotator360.tsx` (khung xoay tự viết), `app/(shop)/products/[slug]/360/page.tsx`, `lib/variant.ts`, `components/admin/Product360Editor.tsx`, `mock-data/tables/{_360_gen,product_360,product_360_frames}.ts`, `scripts/{gen-mock-360.mjs,mock-360-products.json}`, `public/mock/360/**` (1.080 frame), `tests/e2e/product360.spec.ts`.
- Sửa: `ProductGallery` (badge "360°" + ô "360°" cạnh ô "3D"), trang chi tiết (đọc `?color=&size=`, prefetch khi hover), `ProductCard` (nhãn "Có xem 360°"), `hooks/useCart.ts` (thông báo giỏ tùy biến, giữ cả query khi chuyển tới đăng nhập), `ProductForm` (tab "Ảnh 360°"), mock API/views/db/types/services, `_products_spec.ts` (thêm màu/kích thước cho 5 sản phẩm), `styles/globals.css` (hiệu ứng mờ dần).
- Thư viện thêm: không (xoay 360° tự viết bằng pointer events).

### Cấu trúc dữ liệu 360° trong mock (`// TODO: cần thêm vào DB/API`)
- `product_360`: `productId, enabled, frameCount (24|36), defaultColorId, autoRotate, rotationSpeed`.
- `product_360_frames`: `productId, colorId (attribute_values.id màu), colorName, colorHex, frames[] (góc 0°→350°), thumbnail, sizeId?`.
- `Product360Data` (response `GET /products/:slug/360`): cấu hình + `colors[]` (frames) + `variants[]` (kèm `dimensionsCm`, `weightKg`) + `product` (ProductDetail) + `policies[4]`. `ProductListItem.has360` cho nút/nhãn.
- Chính sách lấy từ trang tĩnh sẵn có (`/policies/chinh-sach-van-chuyen|doi-tra|bao-hanh|mua-hang`).

### Đề xuất DB / API thật
- Bảng `product_360 (product_id PK/FK, enabled bool, frame_count smallint check in (24,36), default_color_value_id FK attribute_values, auto_rotate bool, rotation_speed numeric)`.
- Bảng `product_360_frames (id, product_id FK, color_value_id FK attribute_values, size_value_id NULL FK, frame_index smallint, media_id FK media, UNIQUE(product_id,color_value_id,size_value_id,frame_index))`.
- Cột `products.has_360 bool` (trigger hoặc tính từ bảng trên) để lọc/nhãn.
- API: `GET /api/products/:slug/360` (public, cache), `GET /api/admin/products/:id/360`, `PUT /api/admin/products/:id/360`, tải ảnh bằng `POST /api/admin/media/presign|confirm` (đã có, giới hạn 5MB/ảnh) rồi gửi danh sách `mediaId` theo thứ tự frame.
- Lưu ý mock: ảnh tải ở admin lưu dạng data URL trong localStorage (có thể vượt hạn mức ~5MB; bản thật dùng presigned URL).

### Kết quả kiểm tra (Playwright `tests/e2e/product360.spec.ts` + lint/build)
- ✅ Nút "Xem 360°" chỉ hiện ở sản phẩm có 360° (badge trên ảnh lớn + ô thumbnail cạnh "3D"), mang theo biến thể (`?color=kem&size=4-cho`).
- ✅ Kéo chuột, phím ←/→, Space, thanh trượt, tự xoay, zoom/đặt lại. (Vuốt cảm ứng/pinch dùng chung pointer events – chưa thử trên thiết bị thật; toàn màn hình dùng Fullscreen API, chưa tự động hóa.)
- ✅ Đổi màu: giữ nguyên góc, URL đổi bằng `replaceState`, không có request document, `history.length` không đổi.
- ✅ Đổi kích thước: giá, SKU, D×R×C cập nhật; tồn kho/thông số theo biến thể.
- ✅ Tổ hợp hết hàng bị làm mờ/disabled; chọn màu mà kích thước hiện tại hết thì tự chuyển + toast.
- ✅ Nút Back về trang chi tiết (không lùi qua từng lần đổi màu); mở link chia sẻ ở tab mới hiện đúng màu/kích thước.
- ✅ Thêm vào giỏ đúng biến thể, badge giỏ tăng, ở lại trang; Mua ngay → `/checkout?items=…`.
- ✅ Chính sách đủ 4 mục, link tới `/policies/…`.
- ✅ Mobile 390px (thanh dưới cố định, menu ⋯) và tablet 768px.
- ✅ Không lỗi console/HTTP/ảnh vỡ ở trang 360°.
- Phần 4 (admin tab "Ảnh 360°"): đã dựng (bật/tắt, chọn màu, tải nhiều ảnh tự sắp xếp theo tên tệp, kéo thả đổi thứ tự, xem trước xoay, cảnh báo lệch số frame); chưa có test tự động riêng.

---

## Cập nhật 2026-11-07 (đợt đưa về chuẩn + hoàn thiện web)

- **API thật:** chạy với `NEXT_PUBLIC_USE_MOCK=false`; FE tự refresh access token khi 401 (`services/api-client.ts`), có test `tests/unit/api-refresh.test.ts`.
- **Màn mới/đổi:** `/verify-email` (xác thực email), `/reset-password?token=` (đặt lại bằng liên kết), banner xác thực email ở hồ sơ; `RichText` dùng `react-markdown` (không HTML thô); trang không gian ghi 1 lượt xem (`POST /spaces/:slug/views`); thanh toán online không gửi `outcome`.
- **360°:** `components/viewer/SpacePanorama.tsx` có error boundary (ảnh lỗi ⇒ thông báo + "Thử lại", không sập trang); editor 360° sản phẩm giới hạn 2 MB/frame cho khớp máy chủ.
- **Test mới:** `tests/e2e/spaces360.spec.ts` (khách: xem/xoay, hotspot, thêm cả bộ, lưu, mobile 390px, ảnh lỗi), `tests/e2e/admin360.spec.ts` (admin: tải/sửa/xóa 360° sản phẩm; tạo/sửa/xóa không gian với hotspot).
- **Còn lại cho FE:** nút vào trang `/products/[slug]/360` đã bị gỡ ở commit `2505d25` (cần quyết định khôi phục); cột "Đang giữ" ở Kho; ~30 chú thích `TODO: chưa có trong BE` cũ; bỏ gọi `GET /admin/inventory/suppliers` và đổi ô chọn nhà cung cấp thành ô nhập chữ khi làm Mốc 4.

---

## Cập nhật Phần A + Mốc 4 (2026-11-07)

- **360°:** nút "360°" trở lại ở thư viện ảnh sản phẩm (badge trên ảnh lớn + ô cạnh ô 3D) khi `has360`, mang theo biến thể (`?color=&size=`); trang không gian chỉ hiển thị tổng giá thật (bỏ giá combo); form không gian có ô slug; frame 360° và panorama tải từng tệp (`services/media.api.ts`), tối đa 2 MB/frame và 20 MB/panorama.
- **Kho (`/admin/inventory`):** ô nhập nhà cung cấp (chữ) thay cho danh sách, nút "Lưu nháp" và "Hoàn tất phiếu", xác nhận/hủy phiếu nháp ngay trong bảng phiếu, bảng "Lịch sử biến động tồn kho", bỏ cột "Đang giữ", không còn gọi `GET /admin/inventory/suppliers`.
- **Thu chi (`/admin/reports`):** dùng `GET /admin/stats/finance` và `POST /admin/expenses` thật; danh mục nhập tay không có "Hoàn tiền".
- **Cài đặt (`/admin/settings`):** dùng API thật; lỗi hiển thị dưới đúng ô (tên, email, hotline).
- **Thanh toán:** `lib/navigation.ts` (`navigateTo`) dùng `window.location` khi `redirectUrl` là URL cổng (https://…), `router.push` với đường dẫn FE.
- **Test:** `tests/e2e/admin-m4.spec.ts` (kho, thu chi, cài đặt), `tests/unit/navigation.test.ts`; nhóm `khach-hang` chạy cả test duyệt mọi màn hình admin với API thật.
- **Còn lại:** ~30 chú thích `TODO: chưa có trong BE` cũ trong services; Mốc 5 (AR, vận đơn…).

---

## Đợt kiểm tra trước demo (2026-11-07)

- Trang mới: `/admin/brands`, `/admin/attributes`, `/admin/media` (có trong sidebar); form sản phẩm lấy thương hiệu từ API quản trị và biến thể chọn màu/kích thước từ danh sách thuộc tính.
- Chi tiết đơn admin: khối **Vận đơn** (tạo, đổi trạng thái, giao thất bại ⇒ tạo vận đơn mới), bỏ nút hoàn tất thủ công, nút "Chuyển sang Đang giao" khóa khi chưa có vận đơn; mock API theo đúng luồng mới.
- Trang không gian: lượt xem gửi bằng `sendBeacon` khi rời trang; trang thanh toán ẩn phương thức bị tắt; `npm run demo`.
- Test Playwright: nhóm `admin-m5` (thương hiệu, thuộc tính, media, vận chuyển).
