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
| 24, 49 | Admin mô hình 3D + modal | `/admin/models` | ✅ | tải tệp thật (multipart), trạng thái xử lý nền tự cập nhật, Xử lý lại, Đặt làm mô hình chính |
| 25, 48 | Admin khuyến mãi + tạo/sửa | `/admin/promotions[/new,/id]` | ✅ | phạm vi theo SP/không gian chỉ ghi nhận |
| 26 → 54 | Admin báo cáo thu chi | `/admin/reports` | ✅ | thay cho 3.10 |
| 27 | Chi tiết đơn (khách) | `/account/orders/[code]` | ✅ | |
| 28 | Đặt hàng thành công/thất bại | `/checkout/success`, `/failed` | ✅ | |
| 29, 30 | Quên / đặt lại mật khẩu | `/forgot-password`, `/reset-password` | ✅ | OTP `123456` |
| 31 | Đổi mật khẩu | `/account/password` | ✅ | |
| 32 | Chi tiết không gian mẫu | `/spaces/[slug]` | ✅ | viewer 360° bằng R3F; chưa vẽ mô hình đặt trong ảnh |
| 33 | Trình xem 3D | `/products/[slug]/3d` | ✅ | AR ngoài phạm vi (D-P11): không còn nút/QR AR |
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

---

## Xử lý nền mô hình 3D (2026-11-07) ✅

- **Admin `/admin/models`:** tải lên tệp THẬT (`adminApi.models.upload(file, meta)`: multipart với API thật, JSON metadata với mock), bỏ tiến trình giả; cột trạng thái hiện *Đang xử lý nền…* / *Sẵn sàng* / *Lỗi* kèm lý do; trang tự gọi lại danh sách mỗi 2 giây khi còn mô hình `processing`; nút **Xử lý lại** ở mô hình lỗi, nút **Đặt làm mô hình chính** ở mô hình `ready` chưa phải chính (huy hiệu "Mô hình chính"); ô "Tạo mô hình mới (không thay thế mô hình chính hiện có)"; xóa mô hình chưa có tệp qua `DELETE /admin/models/model/:modelId`. Mỗi tệp là một dòng, ghi rõ LOD.
- **Khách `/products/[slug]/3d`:** `ProductViewer3D` chọn LOD theo thiết bị (UC-3D-01 bước 4): mặc định `medium`; điện thoại (màn hình hẹp / UA di động) hoặc mạng chậm (`saveData`, 2g/3g, downlink < 1,5) ⇒ `low`; thiếu LOD thì lùi dần. Tải mô hình lỗi ⇒ ảnh poster/ảnh sản phẩm + thông báo "Không tải được mô hình 3D".
- **Bộ giải nén Meshopt phục vụ tại chỗ** (`public/vendor/meshopt_decoder.js`, MIT): LOD do máy chủ sinh được nén Meshopt mà `<model-viewer>` mặc định tải bộ giải nén từ CDN (không xem được khi mất mạng); xem `public/vendor/README.md`.
- **Test:** Playwright nhóm `admin-3d` (`tests/e2e/admin-models.spec.ts`, API thật + Redis): tải GLB → xử lý nền → 3 LOD `ready`, khách xem 3D bằng LOD medium; điện thoại dùng LOD low; tệp lỗi hiện ảnh thay thế; GLB hỏng → Lỗi + lý do + Xử lý lại; đặt làm mô hình chính. Mock vẫn chạy (mô hình luôn `ready`).

---

## Bỏ AR (2026-11-08, D-P11) ✅

- **Khách:** bỏ khối "Xem AR tại nhà" và mã QR, mọi lời nhắc AR (trang chủ, giới thiệu, danh sách, chi tiết, 360°, metadata); bỏ tham số `hasAr` ở `product.api`; `ProductViewer3D` và `ModelViewerElement` không còn thuộc tính `ar`, `ar-modes`, `ios-src` (vẫn dùng `@google/model-viewer` để xem 3D); trình xem 3D giữ nguyên.
- **Admin `/admin/models`:** bỏ ô "Cho phép xem AR", ô chọn tệp chỉ nhận `.glb` (báo "Hệ thống chỉ hỗ trợ tệp GLB"), bộ lọc định dạng chỉ còn GLB. Trang Cài đặt không có `ar_enabled`.
- **Mock:** dữ liệu giả không còn USDZ, `hasAr` luôn `false`, bỏ `usdzUrl`.

---

## Sửa lỗi "lưu xong vẫn hiện dữ liệu cũ" trên toàn bộ trang (2026-11-08) ✅

**Nguyên nhân** (đã chứng minh ở trang media, xem BE_PROGRESS "Lỗi chập chờn admin-m5"): React Query v5 `invalidateQueries` không hủy lần tải đang bay của query chưa có dữ liệu (vd. danh sách vừa đổi bộ lọc tìm kiếm); kết quả đọc TRƯỚC khi ghi ở lại giao diện. `setQueryData` (ghi kết quả máy chủ vào cache) có cùng điểm yếu: lần tải cũ trả về sau sẽ đè lên.

**Cách sửa dùng chung (không sửa từng chỗ theo kiểu riêng):** `src/lib/query-refresh.ts` có `makeWriteSafe(qc)`, được áp cho QueryClient duy nhất của ứng dụng (`makeQueryClient` trong `src/lib/query-client.ts`, dùng bởi `app/providers.tsx`):
- `invalidateQueries` hủy lần tải đang bay của các query khớp rồi mới làm mới (cùng ý với `refreshAfterWrite`, vẫn dùng tường minh ở trang media);
- `setQueryData` hủy lần tải đang bay của đúng khóa đó trước khi ghi.

Vì sửa ở QueryClient nên **mọi** chỗ ghi (admin, giỏ hàng, địa chỉ, hồ sơ, yêu thích, đánh giá, lưu không gian, thông báo…) và mọi chỗ thêm sau này đều được bao phủ. Các chỗ được bao phủ (đếm theo mã nguồn, không tính mock):

| Tệp | `invalidateQueries` | `setQueryData` |
|---|---|---|
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(account)\account\coupons\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(account)\account\notifications\page.tsx` | 3 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(account)\account\orders\[code]\page.tsx` | 2 | 1 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(account)\account\profile\page.tsx` | 2 | 2 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(account)\account\returns\new\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(auth)\verify-email\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(shop)\cart\page.tsx` | 0 | 2 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(shop)\checkout\failed\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(shop)\checkout\page.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(shop)\checkout\success\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\(shop)\spaces\[slug]\page.tsx` | 1 | 2 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\attributes\page.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\brands\page.tsx` | 5 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\categories\page.tsx` | 3 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\content\page.tsx` | 8 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\customers\[id]\page.tsx` | 3 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\customers\page.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\inventory\page.tsx` | 4 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\models\page.tsx` | 6 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\orders\[code]\page.tsx` | 1 | 1 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\orders\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\products\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\promotions\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\questions\page.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\reports\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\returns\page.tsx` | 3 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\reviews\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\settings\page.tsx` | 1 | 1 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\app\admin\spaces\page.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\account\AddressFormModal.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\account\ReviewModal.tsx` | 3 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\admin\Product360Editor.tsx` | 3 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\admin\ProductForm.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\admin\PromotionForm.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\admin\SpaceForm.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\layout\Header.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\product\ProductTabs.tsx` | 1 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\components\product\SpaceCard.tsx` | 2 | 0 |
| `C:\Users\Dell\XDUDTMDT\apps\web\src\hooks\useCart.ts` | 1 | 1 |

Tổng: 79 lời gọi `invalidateQueries` và 10 lời gọi `setQueryData`.

**Test:**
- Vitest `tests/unit/query-refresh.test.ts` (5): `refreshAfterWrite` và `makeWriteSafe` cho `invalidateQueries` lẫn `setQueryData`; mỗi trường hợp có đối chứng "client thường" tái hiện lỗi.
- Playwright (API thật) nhóm `admin-race`, `tests/e2e/admin-race.spec.ts` (2), kịch bản "tìm kiếm rồi lưu ngay" ở hai trang admin khác nhau: **khách hàng** (khóa tài khoản) và **sản phẩm** (xóa). Test dựng đúng thứ tự gây lỗi (giữ kết quả tìm kiếm đã đọc trước khi ghi, chỉ thả sau khi ghi xong) nên không phụ thuộc may rủi về thời gian. Đã kiểm đối chứng: tắt `makeWriteSafe` thì cả hai test fail (khách hàng vẫn hiện "Hoạt động", sản phẩm vẫn còn dòng cũ); bật lại thì xanh.

## MinIO: tải thẳng từ trình duyệt (2026-11-08, D-P13) ✅

- `services/direct-upload.ts`: `getUploadMode()` (đọc `GET /admin/media/upload-config`, nhớ kết quả; dữ liệu giả ⇒ multipart) và `putToStorage()` (PUT bằng XMLHttpRequest, có phần trăm tiến trình). FE **tự chọn** cách tải theo cấu hình máy chủ.
- **Panorama** (`services/media.api.ts`, dùng ở form không gian): driver minio/s3 ⇒ `/admin/media/presign` ⇒ PUT ⇒ `/admin/media/confirm`; ảnh thường và frame 360° vẫn multipart. **Mô hình 3D** (`/admin/models`): `/admin/models/presign` ⇒ PUT lên bucket private ⇒ `/admin/models/:id/files/confirm` (202); hộp thoại hiện phần trăm tải lên thật (thay cho tiến trình giả đã bỏ ở đợt trước). Driver local giữ multipart.
- **Test trình duyệt với MinIO thật:** `npm run test:e2e:real:minio` (`tests/e2e/admin-minio.spec.ts`, 2 test): admin tải GLB ⇒ PUT thẳng lên bucket private (kiểm header CORS) ⇒ xử lý nền ⇒ 3 LOD `ready` ⇒ khách tải LOD medium từ bucket public (khác nguồn gốc với web); panorama PUT từ trình duyệt vào bucket public rồi confirm, ảnh mở được.

## 5 use case Mở rộng nhẹ (2026-11-08, D-P15) ✅

- **Trang mới:** `/admin/activity-logs` (bộ lọc quản trị viên, hành động, loại đối tượng, khoảng ngày; dòng do interceptor ghi hiện nhãn "Tự động", dòng do service ghi hiện "Dịch vụ ghi"), `/admin/roles` (xem 2 vai trò và quyền, chỉ đọc), `/admin/notifications` (gửi thông báo: chọn khách/tất cả, tiêu đề, nội dung, loại, liên kết), `/account/sessions` (thiết bị đang đăng nhập, đánh dấu "Thiết bị này", nút "Đăng xuất thiết bị"). Sidebar admin và sidebar tài khoản có mục mới.
- **Chỉnh trang cũ:** chi tiết khách hàng admin có mục **Vai trò** (gán/gỡ admin; lỗi 409 hiện toast); trang hồ sơ có mục **Xóa tài khoản** (hộp thoại nhập mật khẩu, xong thì đăng xuất về trang chủ).
- `api-client` xử lý `204 No Content`. Mock API chưa hỗ trợ 5 UC này (chỉ chạy với API thật).
- **Test:** Playwright nhóm `ext-uc` (`tests/e2e/ext-uc.spec.ts`, 5 test).

## Vật liệu theo biến thể (2026-11-08, D-T56) ✅

- **Admin:** hành động dòng **Vật liệu theo biến thể** ở `/admin/models` (mô hình ready) mở hộp thoại `MaterialVariantsModal`: mỗi biến thể một dòng, chọn vật liệu từ danh sách có trong GLB, chọn màu (xem trước hình cầu), độ nhám, kim loại; Lưu/Xóa.
- **Khách:** `ProductViewer3D` nhận `variantId`; có `materialVariants` cho biến thể thì áp màu/độ nhám/kim loại lên vật liệu cùng tên ngay trên `<model-viewer>` (không tải lại mô hình, không gọi API). Thuộc tính `data-material-applied` trên `viewer-3d` phục vụ test.
- **Test:** Playwright nhóm `vat-lieu` (`tests/e2e/materials.spec.ts`): đổi màu biến thể ⇒ đọc `baseColorFactor` từ scene, kiểm không có yêu cầu .glb/API mới; admin cấu hình qua hộp thoại. Mock API không hỗ trợ.

## Mô hình 3D trong ảnh 360° (2026-11-08, D-T57) ✅

- **Khách:** `SpacePanorama` nhận `placements`: React Three Fiber + `useGLTF` (Meshopt, không Draco/CDN), chọn LOD theo thiết bị (`preferredLod`), **chỉ tải sau khi ảnh 360° hiện**, `Suspense` + hộp lỗi riêng cho từng mô hình, trạng thái "Đang tải mô hình 3D…", ghim bấm được. Không có placement ⇒ không thêm gì (hiển thị như cũ). Bấm ghim ⇒ hộp **Đổi món** (danh sách từ `alternatives`) ⇒ thay mô hình tại chỗ, nhãn "Đang xem thử — không được lưu lại", "Về món gốc". Phần tử ẩn `placed-models` (`data-total/loaded/items`) phục vụ test.
- **Admin:** tab **Đặt sản phẩm 3D** trong form không gian (`PlacementEditor`): nút **Đặt sản phẩm 3D**, chọn sản phẩm có mô hình + biến thể, **kéo ghim** để đổi yaw/pitch, ô số + thanh trượt cho khoảng cách/xoay X-Y-Z/tỉ lệ, xem trước trực tiếp ngay trong khung, **Lưu vị trí** / Hoàn tác / Gỡ.
- Mock API trả `placements: []` (chỉ chạy với API thật).
- **Test:** Playwright nhóm `phong-3d` (`tests/e2e/placements360.spec.ts`): admin đặt, khách thấy và đổi món, không lưu DB; không gian trống như cũ; mô hình bị chặn tải thì ảnh vẫn dùng được.

## Phễu không gian mẫu (2026-11-09, D-T58) ✅

- Trang mới `/admin/reports/spaces` ("Hiệu quả không gian mẫu", mục menu cạnh Báo cáo): chọn khoảng ngày, 4 thẻ KPI (người xem, bấm hotspot, thêm giỏ, bấm → thêm giỏ), biểu đồ cột nhóm theo 10 không gian nhiều người xem nhất, bảng chi tiết kèm nguồn dẫn tới, danh sách sản phẩm dẫn khách tới không gian. Mock API chưa hỗ trợ.
