# PROMPT CHO AGENT — Tính năng "Xem 360°" cho từng sản phẩm

> Cách dùng: đặt file này vào `docs/`, rồi gõ cho agent:
> **"Đọc kỹ docs/PROMPT_360_SAN_PHAM.md và thực hiện đúng toàn bộ yêu cầu bên dưới dòng =====."**

=====

## BỐI CẢNH
- Dự án Aurelia Living là monorepo Turborepo dùng **npm**. Frontend: **`apps/web` (Next.js 14)**. Backend: `apps/api` (NestJS). Database: `database/`.
- Frontend đang chạy bằng **mock data** (bật bằng `NEXT_PUBLIC_USE_MOCK=true` trong `apps/web/.env.development.local`).
- Hệ thống có 2 vai trò: **Doanh nghiệp (admin)** và **Khách hàng**.

**Trước khi viết code, đọc lại:**
1. `docs/PROJECT_ANALYSIS.md`: cấu trúc DB, API, FE.
2. `docs/FE_PROGRESS.md`: những gì đã làm, đặc biệt trang Chi tiết sản phẩm, lớp mock API, thư mục `mock-data/`.
3. `docs/WIREFRAME.md`: mục **0** (design tokens), **2.3** (Chi tiết sản phẩm), **7.7** (Trình xem 3D/AR) để giữ cùng phong cách. Nếu có, mở thêm `docs/wireframes/03-chi-tiet-san-pham.png` và `docs/wireframes/33-trinh-xem-3d.png`.
4. Code hiện có của trang chi tiết sản phẩm, component chọn màu/kích thước, giỏ hàng, và cấu trúc dữ liệu sản phẩm/biến thể (variant) trong DB, API và mock-data.

## MỤC TIÊU
1. Trên **trang Chi tiết sản phẩm** có nút **"Xem 360°"** kèm icon xoay 360°. Bấm vào thì chuyển tới **trang 360° riêng của sản phẩm đó**.
2. Trang 360° cho khách **xoay sản phẩm 360°** bằng chuỗi ảnh chụp quanh sản phẩm. Trang hiển thị **đầy đủ thông tin**: giá, đánh giá, mô tả, thông số, tồn kho, chính sách giao hàng / đổi trả / bảo hành / thanh toán.
3. Khách **đổi màu sắc và kích thước ngay trên trang 360°**. Ảnh xoay, giá, tồn kho, kích thước, SKU cập nhật tức thì, **không tải lại trang**, **không quay về bước trước**, không mất góc xoay đang xem.
4. Từ trang 360° khách có thể **Thêm vào giỏ** / **Mua ngay** đúng biến thể đã chọn.

## QUY TẮC
- Không sửa, không xoá file Database và Backend, không chạy migration. Chỗ nào DB/API chưa có dữ liệu 360° thì **bổ sung trong mock-data và lớp mock API trước**, đánh dấu `// TODO: cần thêm vào DB/API`, rồi ghi đề xuất thay đổi DB/API vào `docs/FE_PROGRESS.md`.
- Dùng đúng stack, quy ước thư mục, thư viện UI, cách gọi API (qua service layer, không import thẳng JSON trong component) như các trang hiện có.
- Ưu tiên tự viết component xoay 360° (không cần thư viện). Nếu cài thư viện thì phải nhẹ, ghi tên, lý do và phiên bản.
- Chữ trên giao diện viết tiếng Việt có dấu. Giá định dạng `8.500.000đ`.
- Commit riêng cho tính năng này trên nhánh `feature/product-360`.

---

## PHẦN 1 — DỮ LIỆU 360°
### 1.1 Cấu trúc
Đọc cấu trúc sản phẩm/biến thể thực tế rồi bổ sung theo đúng kiểu đặt tên (camelCase/snake_case) của dự án. Gợi ý thực thể:
- **Product360** (hoặc thêm trường vào product): `productId`, `enabled`, `frameCount` (24 hoặc 36), `defaultColorId`, `autoRotate`, `rotationSpeed`.
- **Product360Frames** theo **màu**: `productId`, `colorId`/`variantColor`, `frames[]` (URL ảnh theo thứ tự góc 0° → 360°), `thumbnail`. Ảnh xoay đổi theo **màu**. Kích thước thường không đổi ảnh, nhưng nếu dữ liệu có ảnh riêng cho từng kích thước thì hỗ trợ cả `sizeId`.
- **Variant** (có sẵn hoặc bổ sung): `id`, `productId`, `colorId`, `colorName`, `colorHex`, `sizeId`, `sizeLabel` (2 chỗ / 3 chỗ / 4 chỗ…), `sku`, `price`, `originalPrice`, `stock`, `dimensions` (D×R×C cm), `weight`.
- **Chính sách**: lấy từ nguồn sẵn có (trang tĩnh / cài đặt cửa hàng trong mock). Nếu chưa có thì tạo `policies` gồm giao hàng, đổi trả 7 ngày, bảo hành 12 tháng, thanh toán (COD, thẻ, VNPAY, MoMo, ZaloPay), lắp đặt.

### 1.2 Mock data
- Bật 360° cho **ít nhất 8 sản phẩm** thuộc nhiều danh mục (sofa, ghế, bàn, giường, tủ, đèn). Mỗi sản phẩm có **3–4 màu** và **2–3 kích thước**. Có **ít nhất 1 tổ hợp hết hàng** để thử trạng thái disabled, và giá khác nhau theo kích thước.
- **Ảnh frame**: mỗi màu **36 frame** (10°/frame). Nếu không có ảnh chụp thật, viết script tạo ảnh SVG/PNG minh hoạ vào `apps/web/public/mock/360/<product-slug>/<color>/frame-01..36`:
  - Hình đồ nội thất đơn giản, tô đúng màu biến thể.
  - Phối cảnh thay đổi theo góc (co giãn chiều rộng, dịch bóng, đổi mặt hiển thị) để khi xoay nhìn rõ chuyển động.
  - Góc ảnh có số góc (0°, 10°…) để dễ kiểm tra.
  
  Lưu script trong `scripts/` hoặc `apps/web/scripts/`, ghi lệnh chạy vào `mock-data/README.md`.
- Lớp mock API thêm endpoint theo quy ước REST hiện có, ví dụ:
  - `GET /products/:slug/360` trả thông tin 360 + danh sách màu kèm frames + variants + policies.
  - (Hoặc mở rộng endpoint chi tiết sản phẩm nếu hợp lý hơn với cấu trúc hiện tại.)
  
  Response cùng envelope và kiểu phân trang/lỗi như các endpoint khác.

## PHẦN 2 — NÚT "XEM 360°" Ở TRANG CHI TIẾT SẢN PHẨM
- Thêm nút **"Xem 360°"** với icon xoay 360° (mũi tên vòng quanh + chữ 360). Kiểu nút viền màu primary `#8B4A2B`, bo 7px, đặt ở 2 chỗ:
  1. Trên ảnh lớn của gallery: badge nổi góc trên trái, chữ "360°".
  2. Trong hàng thumbnail: ô **"360°"** cạnh ô "3D" hiện có.
- Chỉ hiện nút khi sản phẩm có `360 enabled`.
- Khi bấm, chuyển tới **`/products/[slug]/360`** (theo đúng cấu trúc route sản phẩm hiện có của dự án) và **mang theo biến thể đang chọn** qua query, ví dụ `?color=kem&size=3-cho`. Dùng `<Link>` / `router.push` của Next.js.
- Prefetch dữ liệu 360 khi người dùng hover nút để trang mở nhanh.

## PHẦN 3 — TRANG 360° CỦA SẢN PHẨM (`/products/[slug]/360`)
### 3.1 Bố cục (desktop 1440px, cùng phong cách mục 7.7 WIREFRAME.md)
- **Thanh trên**: nút ← quay lại trang chi tiết (giữ biến thể đang chọn), breadcrumb `Trang chủ > Sản phẩm > {Danh mục} > {Tên SP} > Xem 360°`, nút [Chia sẻ] (copy link có kèm query biến thể), nút [♡ Yêu thích].
- **Cột trái (~62%) – Khung xoay 360°** nền gradient kem sáng:
  - Ảnh frame hiện tại cỡ lớn ở giữa.
  - Badge hướng dẫn **"Kéo để xoay 360°"**, tự ẩn sau lần kéo đầu tiên.
  - Thanh điều khiển dưới cùng:
    - ⟲ xoay trái 1 bước, ▶/⏸ tự xoay, ⟳ xoay phải 1 bước.
    - **Thanh trượt góc** 0–360° hiển thị số độ.
    - Phóng to / thu nhỏ, toàn màn hình, đặt lại góc.
  - Chỉ báo tải: "Đang tải ảnh 360° … 18/36" với thanh tiến trình. Khi đang tải vẫn cho xem frame đã tải.
  - Hàng **thumbnail màu** dưới khung (ảnh frame 0° của từng màu) để đổi màu nhanh.
  - Card nhỏ góc trên phải: **Kích thước D×R×C** của biến thể đang chọn.
- **Cột phải (~38%) – Thông tin, sticky khi cuộn**:
  - Tên sản phẩm, sao + số đánh giá (bấm vào cuộn tới phần đánh giá), SKU của biến thể.
  - **Giá** theo biến thể: giá sale (đỏ), giá gốc gạch ngang, badge `-%`.
  - **Màu sắc**: swatch tròn kèm tên màu ("Màu sắc: Kem"), swatch đang chọn có viền primary.
  - **Kích thước**: nút chọn (2 chỗ / 3 chỗ / 4 chỗ) kèm chênh lệch giá nếu có.
  - Tình trạng: "Còn 12 sản phẩm" / "Sắp hết hàng" / "Hết hàng".
  - **Số lượng** (stepper, không vượt tồn kho).
  - Nút **[Thêm vào giỏ hàng]** (primary) + **[Mua ngay]** (viền).
  - 3 cam kết có icon: Giao hàng toàn quốc 2–5 ngày · Đổi trả 7 ngày · Bảo hành 12 tháng.
- **Phần dưới (full width)**, dạng tab hoặc accordion:
  1. **Mô tả sản phẩm**.
  2. **Thông số kỹ thuật** theo biến thể (kích thước, chất liệu, màu, trọng lượng, xuất xứ, tải trọng…).
  3. **Chính sách**: Giao hàng & lắp đặt · Đổi trả 7 ngày · Bảo hành 12 tháng · Phương thức thanh toán. Mỗi mục có tóm tắt và link "Xem chi tiết" tới trang chính sách tương ứng (`/policies/...`).
  4. **Đánh giá** (tóm tắt sao + 3 đánh giá mới nhất + "Xem tất cả").
  5. **Hỏi đáp** (nếu dự án đã có).
- **Sản phẩm liên quan** (4 ProductCard), nhãn "Có xem 360°" cho sản phẩm hỗ trợ.

### 3.2 Tương tác xoay
- **Kéo chuột** trái/phải để xoay. **Vuốt** trên điện thoại/tablet (pointer events). Độ nhạy khoảng 1 frame mỗi 8–10px và có quán tính nhẹ khi thả tay.
- **Bàn phím**: ← → đổi frame, Space bật/tắt tự xoay, `+`/`-` phóng to/thu nhỏ, Esc thoát toàn màn hình. Khung xoay focus được (`tabIndex=0`, `aria-label="Xem sản phẩm 360 độ"`).
- **Lăn chuột** hoặc **pinch** để phóng to (1x–3x). Khi đã phóng to, kéo để di chuyển ảnh.
- **Tự xoay** chậm khi mới vào trang. Dừng ngay khi người dùng tương tác.
- Vòng lặp liền mạch: frame 36 nối tiếp frame 1.

### 3.3 Đổi màu / kích thước KHÔNG tải lại trang
- Toàn bộ trạng thái (màu, kích thước, số lượng, frame hiện tại, mức zoom) quản lý ở **client component** (`"use client"`).
- Khi đổi lựa chọn:
  - **Cập nhật URL** bằng `router.replace(..., { scroll: false })` hoặc `window.history.replaceState`. Đây là thay thế, **không thêm lịch sử mới**, nên nút Back của trình duyệt vẫn đưa về trang chi tiết thay vì lùi qua từng lần đổi màu.
  - **Không** remount trang, **không** fetch lại toàn bộ trang (dữ liệu tất cả biến thể đã có từ lần tải đầu).
- **Đổi màu**:
  - Thay bộ frame và **giữ nguyên góc đang xem** (cùng chỉ số frame).
  - Chuyển ảnh mờ dần khoảng 150ms.
  - Nếu bộ frame màu mới chưa tải xong thì hiện frame 0° của màu đó trước, tải ngầm phần còn lại.
- **Đổi kích thước**: cập nhật giá, SKU, tồn kho, kích thước D×R×C, thông số ngay lập tức. Không đổi ảnh, trừ khi dữ liệu có ảnh riêng theo kích thước.
- **Tổ hợp không hợp lệ hoặc hết hàng**: làm mờ lựa chọn đó, tooltip "Hết hàng". Nếu khách chọn màu mà kích thước hiện tại hết hàng thì tự chuyển sang kích thước còn hàng gần nhất và báo toast nhỏ.
- Lựa chọn đồng bộ 2 chiều với trang chi tiết qua query `?color=&size=`. Mở link chia sẻ thì hiện đúng biến thể.

### 3.4 Hiệu năng
- **Tải trước** toàn bộ frame của màu đang chọn, ưu tiên các frame gần góc hiện tại. Tải ngầm frame các màu khác khi rảnh (`requestIdleCallback`) hoặc khi hover swatch.
- Cache ảnh đã tải (Map hoặc `Image()` objects) để đổi màu qua lại không tải lại.
- Vẽ frame bằng `<img>` đổi `src` hoặc `<canvas>`. Dùng `next/image` cho ảnh tĩnh nhưng **không** cho frame xoay (tránh tối ưu hoá làm giật).
- Dùng skeleton khi đang lấy dữ liệu. Có trạng thái lỗi kèm nút [Thử lại]. Nếu sản phẩm không có 360° thì hiện thông báo và nút quay lại chi tiết (hoặc chuyển sang trình xem 3D nếu có GLB).

### 3.5 Giỏ hàng
- **Thêm vào giỏ** gửi đúng `variantId` (màu + kích thước) và số lượng. Badge giỏ trên header cập nhật ngay, toast "Đã thêm Sofa Nordic – Kem, 3 chỗ vào giỏ". **Ở lại trang 360°**.
- **Mua ngay**: thêm vào giỏ rồi chuyển sang trang Thanh toán với biến thể đã chọn.

### 3.6 Responsive
- **Tablet**: khung xoay trên, thông tin dưới.
- **Mobile**:
  - Khung xoay full width, cao khoảng 60vh.
  - Swatch màu và kích thước nằm ngay dưới khung.
  - **Thanh dưới cố định** hiển thị giá + [Thêm vào giỏ].
  - Thanh điều khiển gọn, ẩn bớt nút ít dùng vào menu ⋯.

## PHẦN 4 — (TUỲ CHỌN, LÀM SAU KHI PHẦN 1–3 XONG) QUẢN LÝ ẢNH 360° Ở ADMIN
- Trong form Thêm/Sửa sản phẩm (WIREFRAME.md mục 3.2b), thêm tab **"Ảnh 360°"**:
  - Bật/tắt 360°.
  - Chọn màu.
  - Dropzone tải nhiều ảnh, tự sắp xếp theo tên file `frame-01…36`, kéo thả để đổi thứ tự.
  - Xem trước xoay ngay trong form.
  - Cảnh báo nếu số frame giữa các màu không bằng nhau.
- Lưu qua mock API (localStorage). Ghi đề xuất endpoint upload thật vào `docs/FE_PROGRESS.md`.

## PHẦN 5 — KIỂM TRA & BÀN GIAO
1. Chạy `npm run lint` và `npm run build` trong `apps/web` (hoặc qua turbo ở thư mục gốc) và sửa hết lỗi. Dev server không có lỗi console.
2. Kiểm tra thủ công và ghi kết quả ✅/❌ vào `docs/FE_PROGRESS.md`:
   - [ ] Nút "Xem 360°" chỉ hiện ở sản phẩm có 360°, và mang theo biến thể đang chọn.
   - [ ] Kéo chuột, vuốt, phím ←/→, thanh trượt, tự xoay, zoom, toàn màn hình đều hoạt động.
   - [ ] Đổi màu: ảnh đổi đúng màu, **giữ góc xoay**, URL đổi, **trang không reload** (kiểm tra tab Network không có request tải lại document).
   - [ ] Đổi kích thước: giá, SKU, tồn kho, D×R×C cập nhật đúng.
   - [ ] Tổ hợp hết hàng bị làm mờ, tự chuyển kích thước hợp lệ.
   - [ ] Nút Back của trình duyệt về trang chi tiết với đúng biến thể (không lùi qua từng lần đổi màu).
   - [ ] Mở link chia sẻ trong tab mới thì hiện đúng màu và kích thước.
   - [ ] Thêm vào giỏ đúng biến thể, badge giỏ tăng, ở lại trang. Mua ngay đi tới Thanh toán.
   - [ ] Chính sách hiển thị đủ 4 mục và link đúng trang.
   - [ ] Mobile (DevTools 390px) và tablet (768px) hiển thị đúng.
3. Cập nhật `docs/FE_PROGRESS.md`: file đã tạo/sửa, cấu trúc dữ liệu 360 đã thêm vào mock, đề xuất bảng/cột/endpoint cho DB và API thật, cách chạy script tạo ảnh frame.
4. Kết thúc bằng tóm tắt ngắn: route mới, sản phẩm nào có 360° để thử (kèm link `http://localhost:3000/...`), việc còn lại.

=====
