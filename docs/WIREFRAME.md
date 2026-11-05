# AURELIA LIVING — Đặc tả Wireframe (Low-fidelity)

> Tài liệu này mô tả lại toàn bộ wireframe của đồ án **Xây dựng ứng dụng thương mại điện tử** dưới dạng văn bản để AI agent (VS Code / Copilot / Claude Code / Cursor) đọc và dựng giao diện.
> Ảnh nằm trong thư mục `wireframes/` (cùng cấp với file này): ảnh **01–26** là wireframe gốc, ảnh **27–54** là các trang thiết kế bổ sung (mục 7). Mã HTML tham chiếu của các trang bổ sung nằm trong `mockups-html/`.

---

## 0. Tổng quan dự án

- **Tên thương hiệu:** AURELIA LIVING
- **Slogan:** "Nội thất cho không gian sống hiện đại" (trang danh sách SP dùng: "Nơi nội thất 3D sống gần hơn với bạn")
- **Lĩnh vực:** Website bán nội thất có **xem sản phẩm 3D / xoay 360°** và **bộ sưu tập Không gian mẫu** (phòng mẫu phối sẵn sản phẩm).
- **Ngôn ngữ giao diện:** Tiếng Việt. Tiền tệ: VNĐ, định dạng `8.500.000đ` (dấu chấm phân cách nghìn).
- **Vai trò người dùng: chỉ có 2** — **Doanh nghiệp** (tài khoản quản trị cửa hàng, dùng Admin Panel) và **Khách hàng**. Không có nhân viên, không có phân quyền nhiều cấp.
- **2 phân hệ:**
  1. **Storefront (khách hàng)** — 14 màn hình gốc + 16 màn hình bổ sung
  2. **Admin Panel (Doanh nghiệp)** — 10 màn hình gốc (12 ảnh) + 12 màn hình bổ sung

### 0.1 Design tokens (ước lượng từ ảnh)

| Token | Giá trị gợi ý | Dùng cho |
|---|---|---|
| `--primary` | `#8B4A2B` (nâu gỗ) | Nút chính, tab active, link nhấn mạnh, badge giỏ |
| `--primary-hover` | `#6F3A21` | Hover nút chính |
| `--bg` | `#FAF6F2` (kem rất nhạt) | Nền trang |
| `--surface` | `#FFFFFF` | Card, bảng, form |
| `--surface-muted` | `#F3EBE3` (be) | Banner, sidebar item active, ô coupon |
| `--text` | `#2B1E16` | Tiêu đề |
| `--text-muted` | `#7A6E66` | Mô tả phụ |
| `--border` | `#E8DFD7` | Viền card, input |
| `--star` | `#F5A623` | Sao đánh giá |
| `--danger` | `#E53935` | Giá sale, badge giảm %, tim đã thích, "Đã hủy" |
| Font | Sans-serif (Inter / Be Vietnam Pro) | Toàn site; tiêu đề in hoa đậm |
| Bo góc | 6–8px (nút, input), 10–12px (card) | |

### 0.2 Badge trạng thái (dùng chung toàn hệ thống)

| Trạng thái | Màu nền |
|---|---|
| Chờ xác nhận | Cam nhạt |
| Đang xử lý | Xanh dương nhạt |
| Đang giao | Tím nhạt |
| Đã giao / Đang bán / Hiển thị / Hoạt động / Đã thanh toán / Đang diễn ra / Chưa sử dụng | Xanh lá nhạt |
| Đã hủy / Ẩn / Không hoạt động / Hoàn tiền / Hết hạn / Đã kết thúc | Đỏ/hồng nhạt |
| Tạm hết hàng / Chưa thanh toán / Sắp diễn ra | Cam/vàng nhạt |
| Đã sử dụng | Xám |

---

## 1. Thành phần dùng chung (Storefront)

### 1.1 Header
- Trái: logo vuông + "AURELIA LIVING" + slogan nhỏ.
- Menu chính: **Trang chủ · Sản phẩm · Không gian mẫu · (Danh mục) · Về chúng tôi** — mục active có gạch chân màu primary.
- Ô tìm kiếm: placeholder "Tìm kiếm sản phẩm, không gian mẫu…", icon kính lúp, có nút ✕ xóa khi đang nhập.
- Phải: icon **Yêu thích** (♡ + badge số), icon **Giỏ hàng** (badge số đỏ), cụm tài khoản:
  - Chưa đăng nhập: icon user + "Đăng nhập".
  - Đã đăng nhập: avatar + "Nguyễn Văn A" + mũi tên dropdown.

### 1.2 Footer (4–5 cột, nền be)
- Cột 1: logo + slogan + icon mạng xã hội (Facebook, Instagram, YouTube, TikTok).
- **LIÊN KẾT NHANH:** Trang chủ, Sản phẩm, Không gian mẫu, Danh mục, Về chúng tôi.
- **CHÍNH SÁCH:** Mua hàng, Đổi trả, Bảo hành / Bảo mật, Điều khoản.
- **HỖ TRỢ:** Hướng dẫn, Câu hỏi thường gặp, Liên hệ.
- **LIÊN HỆ:** aurelia@gmail.com · 0123 456 789 · 123 Nguyễn Văn A, TP.HCM.

### 1.3 Breadcrumb
`Trang chủ > Sản phẩm > Sofa > Sofa Nordic` — mục cuối đậm/màu primary.

### 1.4 Product Card (`<ProductCard>`)
- Ảnh sản phẩm (tỉ lệ ~4:3), nút ♡ góc trên phải (đỏ đặc khi đã thích).
- Tên SP (đậm) · 5 sao + `(số đánh giá)` · Giá (đậm) · dãy chấm tròn màu sắc (swatch).
- Nút viền full-width: 🛒 "Thêm vào giỏ hàng".

### 1.5 Bộ lọc sidebar (`<FilterSidebar>`) — dùng ở Danh sách SP & Tìm kiếm
- **Danh mục** (checkbox + số lượng): Sofa, Bàn, Ghế, Giường, Tủ, Đèn… + "Xem thêm ⌄".
- **Khoảng giá:** Dưới 5 triệu · 5–10 triệu · 10–20 triệu · Trên 20 triệu.
- **Màu sắc** (checkbox + chấm màu): Kem, Be, Trắng, Nâu, Đen, Xám, Xanh… + "Xem thêm".
- **Chất liệu:** Vải, Da, Nỉ, Gỗ, Kim loại.
- **Phong cách:** Hiện đại, Tối giản, Bắc Âu, Cổ điển, Luxury.
- Mỗi nhóm thu gọn/mở rộng được (icon ⌃).

### 1.6 Toolbar danh sách
- Trái: "**24 sản phẩm**".
- Phải: dropdown "Sắp xếp: Mới nhất / Liên quan nhất / …" + toggle **Grid / List**.
- Dưới cùng: phân trang `‹ 1 2 3 4 5 … ›` (trang active nền primary).

### 1.7 Sidebar tài khoản (`<AccountSidebar>`) — dùng ở các trang cá nhân
- Avatar + tên + email + link "Chỉnh sửa hồ sơ".
- Menu (bản đầy đủ): Thông tin cá nhân · Địa chỉ của tôi · Đơn hàng của tôi · **Đổi trả & hoàn tiền** · Sản phẩm yêu thích · Mã giảm giá của tôi · Đánh giá của tôi · **Thông báo** · Đổi mật khẩu · Đăng xuất. Item active nền be + chữ primary.

---

## 2. STOREFRONT — Màn hình khách hàng

### 2.1 Trang chủ — `wireframes/01-trang-chu.png`
Thứ tự section từ trên xuống:
1. **Header** (chưa đăng nhập).
2. **Hero slider** full-width: eyebrow "AURELIA LIVING", tiêu đề "KHÔNG GIAN SỐNG, THEO CÁCH CỦA BẠN", mô tả "Khám phá bộ sưu tập nội thất hiện đại với trải nghiệm sản phẩm 3D chân thực.", nút "KHÁM PHÁ SẢN PHẨM →". Mũi tên trái/phải + chấm chỉ báo slide.
3. **DANH MỤC NỔI BẬT** + "Xem tất cả →": 6 ô ảnh + tên: Sofa, Bàn, Ghế, Giường, Tủ, Đèn trang trí.
4. **SẢN PHẨM NỔI BẬT** + "Xem tất cả →": 4 ProductCard (Sofa Nordic 8.500.000đ, Bàn ăn gỗ tự nhiên 6.200.000đ, Ghế thư giãn 4.900.000đ, Giường hiện đại 12.000.000đ).
5. **Banner "TRẢI NGHIỆM SẢN PHẨM 3D"**: mô tả xoay/phóng to/quan sát 360°, nút "TRẢI NGHIỆM NGAY →", ảnh sofa có ký hiệu 360°.
6. **SẢN PHẨM MỚI** + "Xem tất cả →": 4 ProductCard (Tủ quần áo hiện đại, Đèn trang trí, Bàn làm việc, Kệ tivi).
7. **2 banner song song:** "BỘ SƯU TẬP MỚI — Phong cách hiện đại cho mọi không gian" [KHÁM PHÁ NGAY] · "ƯU ĐÃI ĐẶC BIỆT — Giảm đến 20% cho nhiều sản phẩm" [XEM CHI TIẾT].
8. **Footer**.

### 2.2 Danh sách sản phẩm — `wireframes/02-danh-sach-san-pham.png`
- Header (đã đăng nhập) → Breadcrumb `Trang chủ > Sản phẩm > Sofa`.
- Layout 2 cột: **FilterSidebar** (trái, ~22%) | nội dung (phải).
- Banner danh mục: tiêu đề "Sofa", phụ đề "Khám phá các mẫu sofa tại Aurelia Living", mô tả, ảnh bên phải.
- Toolbar (24 sản phẩm, Sắp xếp, Grid/List).
- Lưới 4 cột × 2 hàng ProductCard (Sofa Nordic, Sofa Luxury, Sofa góc hiện đại, Sofa văng tối giản, Sofa da cao cấp, Sofa module, Sofa giường thông minh, Sofa đơn).
- Phân trang.

### 2.3 Chi tiết sản phẩm — `wireframes/03-chi-tiet-san-pham.png`
- Header + Breadcrumb `Trang chủ > Sản phẩm > Sofa > Sofa Nordic`.
- **Cột trái – Gallery:** ảnh lớn (nút phóng to ⤢, mũi tên trái/phải) + hàng thumbnail; thumbnail cuối là ô **"3D"** (mở viewer 3D).
- **Cột phải – Thông tin:**
  - Tên "Sofa Nordic", ★ 4.8 (24 đánh giá).
  - Giá sale đỏ **8.500.000đ**, giá gốc gạch ngang 10.500.000đ, badge **-19%**.
  - Mô tả ngắn.
  - **Màu sắc:** chọn swatch tròn (selected có viền).
  - **Kích thước:** nút chọn `2 chỗ | 3 chỗ | 4 chỗ`.
  - **Số lượng:** stepper `− 1 +`.
  - Nút **"🛒 Thêm vào giỏ hàng"** (primary, đặc) + **"Mua ngay"** (viền).
  - 3 cam kết: Giao hàng toàn quốc (2–5 ngày) · Đổi trả dễ dàng (trong 7 ngày) · Bảo hành chính hãng (12 tháng).
  - "♡ Thêm vào yêu thích" · "Chia sẻ".
- **Banner "Trải nghiệm sản phẩm 3D"** + nút "Trải nghiệm 3D ngay →".
- **Tabs:** Mô tả sản phẩm · Thông số kỹ thuật · Đánh giá (24) · Hỏi đáp (5). Tab Mô tả có đoạn văn + danh sách bullet đặc điểm.
- **Sản phẩm liên quan** + "Xem tất cả →": 4 ProductCard.
- Footer.

### 2.4 Giỏ hàng — `wireframes/04-gio-hang.png`
- Breadcrumb `Trang chủ > Giỏ hàng`. Tiêu đề "Giỏ hàng của bạn (3 sản phẩm)".
- **Bảng trái:** cột Sản phẩm (ảnh + tên + "Màu: Be" + x1) · Đơn giá · Số lượng (stepper) · Thành tiền · Thao tác (🗑 xóa).
- Link "← Tiếp tục mua sắm".
- **Card phải "Tổng tiền giỏ hàng":** Tạm tính (3 sản phẩm) 14.000.000đ · Giảm giá −700.000đ (đỏ) · Phí vận chuyển 30.000đ · **Tổng cộng 13.330.000đ** · ô "Nhập mã giảm giá" + nút [Áp dụng] · nút lớn **"Thanh toán →"**.

### 2.5 Thanh toán — `wireframes/05-thanh-toan.png`
- Breadcrumb `Trang chủ > Giỏ hàng > Thanh toán`. Tiêu đề "Thanh toán".
- **Cột trái – 3 bước đánh số tròn:**
  1. **Thông tin nhận hàng** [Sửa]: Người nhận, Số điện thoại, Địa chỉ.
  2. **Phương thức thanh toán** (radio): Thanh toán khi nhận hàng (COD) · Thẻ ngân hàng / Thẻ tín dụng (logo VISA, Mastercard, JCB) · Ví điện tử (MoMo, ZaloPay, VNPAY).
  3. **Đơn hàng của bạn** [Sửa]: danh sách SP (ảnh, tên, số lượng, giá).
- **Cột phải – "Tóm tắt đơn hàng":** Tạm tính, Giảm giá, Phí vận chuyển, **Tổng cộng 11.030.000đ**, textarea "Ghi chú đơn hàng (nếu có)", nút **"Đặt hàng"**, dòng chú thích đồng ý Điều khoản dịch vụ & Chính sách bảo mật.

### 2.6 Đăng nhập — `wireframes/06-dang-nhap.png`
- Header tối giản (logo + "Đăng nhập").
- Layout 2 cột trong card lớn:
  - **Trái (ảnh nền phòng khách):** "AURELIA LIVING", "Nội thất hiện đại kết hợp trải nghiệm sản phẩm 3D cho không gian sống của bạn." + 3 điểm nổi bật có icon: Trải nghiệm 3D chân thực · Đa dạng phong cách · Giao hàng toàn quốc.
  - **Phải (form):** "ĐĂNG NHẬP", "Chào mừng bạn trở lại với Aurelia Living". Email* · Mật khẩu* (icon con mắt hiện/ẩn) · ☐ Ghi nhớ đăng nhập · link "Quên mật khẩu?" · nút **Đăng nhập** · "hoặc đăng nhập với" · nút **Đăng nhập với Google** · "Chưa có tài khoản? **Đăng ký ngay**".
- Footer.

### 2.7 Đăng ký — `wireframes/07-dang-ky.png`
- Cùng layout với Đăng nhập.
- Form "ĐĂNG KÝ" – "Tạo tài khoản mới để khám phá thế giới nội thất 3D": Họ và tên* · Email* · Số điện thoại* · Mật khẩu* · Xác nhận mật khẩu* (đều có icon đầu ô; 2 ô mật khẩu có icon mắt) · ☐ Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật · nút **Đăng ký** · **Đăng ký với Google** · "Đã có tài khoản? **Đăng nhập ngay**".

### 2.8 Quản lý tài khoản cá nhân — `wireframes/08-tai-khoan-ca-nhan.png`
- Header có icon ☰, chuông thông báo, giỏ; AccountSidebar bên trái (active: Thông tin cá nhân).
- **Thông tin cá nhân** + nút [Chỉnh sửa]: avatar lớn + "Thay đổi ảnh đại diện" (JPG/PNG, ≤ 2MB); các trường Họ và tên, Giới tính (select), Email (disabled), Ngày sinh (date), Số điện thoại, Vai trò (disabled: "Khách hàng").
- **Địa chỉ của tôi** + nút [+ Thêm địa chỉ mới]: các card địa chỉ chọn bằng radio — "Nhà riêng" (badge **Mặc định**, viền primary), "Văn phòng" (Sửa / Xóa). Mỗi card: tên, SĐT, địa chỉ đầy đủ.
- **Đơn hàng gần đây** + "Xem tất cả →": bảng Mã đơn · Ngày đặt · Tổng tiền · Trạng thái (badge) · Thao tác [Xem chi tiết].

### 2.9 Mã giảm giá của tôi (Coupon) — `wireframes/09-ma-giam-gia.png`
- AccountSidebar (active: Mã giảm giá của tôi).
- Tiêu đề "Mã giảm giá của tôi" + ô "Nhập mã giảm giá…" + nút [Áp dụng].
- Tabs: **Tất cả (8)** · Chưa sử dụng (5) · Đã sử dụng (3) · Hết hạn (0).
- **Coupon card dạng vé** (cạnh trái răng cưa nền be): bên trái "GIẢM 10%" / "GIẢM 200.000đ" + "Đơn tối thiểu …"; giữa: tên ưu đãi, HSD, "Áp dụng cho: …"; phải: badge trạng thái + nút **Sử dụng ngay** (disabled xám nếu đã dùng / hết hạn).
- **Mã giảm giá gợi ý cho bạn** + "Xem tất cả →": 4 ô nhỏ (GIẢM 12%, GIẢM 150.000đ, GIẢM 20%, FREESHIP) mỗi ô nút **Lưu mã**.

### 2.10 Đơn hàng của tôi — `wireframes/10-don-hang-cua-toi.png`
- AccountSidebar (active: Đơn hàng của tôi).
- Tabs lọc: Tất cả (5) · Chờ xác nhận (1) · Đang xử lý (1) · Đang giao (2) · Đã giao (0) · Đã hủy (1).
- **Order card:** `#ORD00125`, "Đặt ngày 12/10/2026 | 2 sản phẩm", badge trạng thái góc phải; danh sách SP (ảnh, tên, phân loại, xN, giá); cột phải: "Tổng tiền" đậm + nút [Xem chi tiết]; đơn **Đã giao** có thêm [Đánh giá sản phẩm].
- Phân trang.

### 2.11 Đánh giá của tôi — `wireframes/11-danh-gia-cua-toi.png`
- AccountSidebar (active: Đánh giá của tôi). Tiêu đề "Đánh giá của tôi" – "Xem lại các đánh giá bạn đã gửi cho sản phẩm."
- **Review card:** ảnh SP · tên SP · "Đã mua ngày …" · sao · nội dung · hàng ảnh đính kèm (ô "+1" nếu còn) · link ✏️ "Sửa đánh giá" bên phải.

### 2.12 Sản phẩm yêu thích — `wireframes/12-san-pham-yeu-thich.png`
- Breadcrumb `Trang chủ > Sản phẩm yêu thích`. Banner "Sản phẩm yêu thích – Danh sách những sản phẩm bạn đã lưu".
- Toolbar "4 sản phẩm" + Sắp xếp + Grid/List. Lưới 4 ProductCard (tim đỏ đặc). Phân trang.

### 2.13 Kết quả tìm kiếm — `wireframes/13-ket-qua-tim-kiem.png`
- Ô search trên header hiển thị từ khóa "sofa" + nút ✕.
- Breadcrumb `Trang chủ > Kết quả tìm kiếm`.
- FilterSidebar (giống 2.2, có thêm "Xem thêm", màu Xanh, phong cách Luxury, chất liệu Nỉ).
- Banner: **Kết quả tìm kiếm cho "sofa"** – "Tìm thấy 36 sản phẩm phù hợp".
- Sắp xếp mặc định **"Liên quan nhất"**. Lưới 4×2 ProductCard + phân trang.

### 2.14 Không gian mẫu (bộ sưu tập) — `wireframes/14-khong-gian-mau.png`
- Header có hàng menu riêng (active: Không gian mẫu).
- **Hero:** "Không gian mẫu – Khám phá các bộ sưu tập nội thất được thiết kế sẵn giúp bạn dễ dàng hình dung và lựa chọn phong cách phù hợp." [Khám phá ngay →].
- **Bộ sưu tập nổi bật** + "Xem tất cả →": 6 card ảnh có overlay tên + "N sản phẩm" + nút → tròn (Phòng khách hiện đại, Phòng ngủ ấm cúng, Phòng ăn tinh tế, Không gian làm việc, Phong cách Bắc Âu, Phong cách Japandi).
- **Tất cả không gian mẫu**: Sắp xếp + Grid/List.
  - Sidebar trái: ô "Tìm kiếm không gian mẫu…", nhóm **Phong cách** (Hiện đại, Bắc Âu, Tối giản, Japandi, Cổ điển, Luxury — kèm số lượng), nhóm **Loại không gian** (Phòng khách, Phòng ngủ, Phòng ăn, Phòng làm việc).
  - Lưới 4 cột card không gian: ảnh + ♡ + tên + "N sản phẩm".

---

## 3. ADMIN PANEL

### 3.0 Layout chung Admin
- **Sidebar trái cố định (bản chuẩn hóa – dùng thống nhất cho mọi trang admin):** logo "AURELIA LIVING – Admin Panel"; menu có icon: Tổng quan · Sản phẩm (⌄) · Không gian mẫu · Danh mục · Đơn hàng · **Đổi trả** · Khách hàng · Đánh giá · **Hỏi đáp** · Nội dung · Mô hình 3D · Khuyến mãi · **Kho hàng** · Báo cáo · Cài đặt. (Các ảnh gốc có menu chưa đồng nhất, ví dụ "Khuyến mãi" bị lặp – hãy dùng danh sách này.) Item active nền be + chữ primary.
- **Topbar:** ☰ · ô "Tìm kiếm sản phẩm, đơn hàng, khách hàng…" · chuông (badge) · avatar "Nguyễn Văn A – Admin" ⌄.
- **Pattern trang danh sách (CRUD):** Tiêu đề + mô tả · thanh công cụ [ô tìm kiếm] [dropdown lọc 1] [dropdown lọc 2] [**+ Thêm …** (primary)] · bảng có checkbox đầu dòng · cột Thao tác `⋯` (menu Sửa/Xóa/Xem) · footer "Hiển thị 1 – 5 trong tổng N …" + phân trang.
- **Pattern trang thêm/sửa:** breadcrumb `‹ Sản phẩm > Thêm sản phẩm` · tiêu đề · nút [Hủy] + [**Lưu …**] góc phải · menu tab dọc bên trái chia nhóm trường · form 2 cột bên phải.

### 3.1 Tổng quan (Dashboard) — `wireframes/15-admin-tong-quan.png`
- Tiêu đề "Tổng quan" – "Chào mừng bạn trở lại, hôm nay hệ thống hoạt động ổn định." · date range picker `01/10/2026 – 10/10/2026`.
- **4 KPI card** (icon + số + % tăng/giảm + sparkline): Tổng đơn hàng 256 (↑12%) · Doanh thu 235.400.000đ (↑18%) · Khách hàng mới 89 (↑7%) · Sản phẩm 124 (↓3%).
- **Biểu đồ đường "Doanh thu"** (dropdown "7 ngày qua"), trục Y 0–60M, trục X theo ngày.
- **Donut "Tỷ lệ đơn hàng theo trạng thái"** (256 tổng đơn): Chờ xác nhận 24% · Đang xử lý 32% · Đang giao 28% · Đã giao 14% · Đã hủy 2%.
- **Hoạt động gần đây** + "Xem tất cả →": avatar + "Tên – hành động" + thời gian (5 phút trước…).
- **Đơn hàng gần đây:** Mã đơn · Khách hàng (avatar) · Tổng tiền · Trạng thái · Ngày đặt · Thao tác.
- **Sản phẩm bán chạy:** Sản phẩm (ảnh + tên) · Đã bán · Doanh thu · Thao tác.

### 3.2 Quản lý sản phẩm
**a) Danh sách** — `wireframes/16-admin-san-pham-danh-sach.png`
- "Sản phẩm – Quản lý danh sách sản phẩm, biến thể, hình ảnh và mô hình 3D."
- Lọc: Danh mục · Trạng thái. Nút [+ Thêm sản phẩm].
- Bảng: ☐ · Ảnh · Tên sản phẩm · Danh mục · Giá · Tồn kho · Trạng thái (Đang bán / Tạm hết hàng) · Thao tác. Tổng 124 sản phẩm.

**b) Thêm sản phẩm** — `wireframes/17-admin-san-pham-them.png`
- Tab dọc: **Thông tin cơ bản** · Hình ảnh · Biến thể · Mô hình 3D · Thuộc tính · SEO.
- Tab Thông tin cơ bản: Tên sản phẩm* · SKU* · Danh mục* (select) · Trạng thái* (select, mặc định "Đang bán") · Thương hiệu (select) · Giá bán* (đ) · Giá gốc (đ) · Giảm giá (%) · Tồn kho* · Mô tả ngắn* (textarea) · Mô tả chi tiết (rich-text editor: B, I, U, list, link, ảnh).

### 3.3 Quản lý không gian mẫu
**a) Danh sách** — `wireframes/18-admin-khong-gian-danh-sach.png`
- "Quản lý các không gian trải nghiệm 3D và ảnh 360°."
- Lọc: Loại không gian · Trạng thái. Nút [+ Thêm không gian mẫu].
- Bảng: ☐ · Ảnh đại diện · Tên không gian · Loại · Số ảnh 360° · Số sản phẩm · Trạng thái (Đang hiển thị / Ẩn hiển thị) · Thao tác.

**b) Thêm không gian mẫu** — `wireframes/19-admin-khong-gian-them.png`
- "Tạo không gian trải nghiệm 3D với ảnh 360° và sản phẩm gợi ý".
- Tab dọc: **Thông tin cơ bản** · Ảnh 360° · Điểm tương tác (hotspot) · Sản phẩm gợi ý · Cài đặt hiển thị.
- Trường: Tên không gian* · Loại không gian* (select) · Mô tả* · Ảnh đại diện (dropzone "Kéo thả ảnh hoặc click để tải lên – PNG, JPG (tối đa 5MB)" + ô preview).

### 3.4 Quản lý danh mục — `wireframes/20-admin-danh-muc.png`
- "Quản lý danh mục sản phẩm". Nút [+ Thêm danh mục].
- **Bảng dạng cây** (thu gọn/mở rộng ⌄, icon thư mục): Tên danh mục · Slug · Danh mục cha · Số sản phẩm · Trạng thái · Thao tác.
- Ví dụ: Nội thất phòng khách (42) → Sofa (18), Bàn trà (12), Kệ tivi (12); Nội thất phòng ngủ (36) → Giường (20), Tủ quần áo (16).

### 3.5 Quản lý đơn hàng — `wireframes/21-admin-don-hang.png`
- Tabs: Tất cả (256) · Chờ xác nhận (24) · Đang xử lý (32) · Đang giao (28) · Đã giao (164) · Đã hủy (8). Nút [+ Tạo đơn hàng].
- Tìm kiếm + date range. Bảng: ☐ · Mã đơn · Khách hàng (avatar) · Ngày đặt · Tổng tiền · Trạng thái · **Thanh toán** (Chưa thanh toán / Đã thanh toán / Hoàn tiền) · Thao tác.

### 3.6 Quản lý khách hàng — `wireframes/22-admin-khach-hang.png`
- Tìm "theo tên, email, số điện thoại…" · lọc Nhóm khách hàng · Trạng thái · [+ Thêm khách hàng].
- Bảng: ☐ · Tên khách hàng (avatar) · Email · Số điện thoại · Nhóm (Khách hàng thân thiết / Khách hàng mới) · Tổng đơn · Tổng chi tiêu · Trạng thái (Hoạt động / Không hoạt động) · Thao tác. Tổng 89 khách.

### 3.7 Quản lý đánh giá — `wireframes/23-admin-danh-gia.png`
- Tìm "theo tên sản phẩm, khách hàng…" · lọc Sản phẩm · Trạng thái · [+ Thêm đánh giá].
- Bảng: ☐ · Sản phẩm (ảnh) · Khách hàng (avatar) · Số sao · Nội dung (cắt bớt "…") · Ngày đánh giá · Trạng thái (Hiển thị / Ẩn) · Thao tác. Tổng 68.

### 3.8 Quản lý Mô hình 3D — `wireframes/24-admin-mo-hinh-3d.png`
- "Quản lý các mô hình 3D và tài nguyên liên quan." · lọc Sản phẩm · Loại tệp · [⬆ Tải lên mô hình].
- Bảng: ☐ · Ảnh xem trước · Tên mô hình (vd `sofa_nordic.glb`) · Sản phẩm · Định dạng (**GLB / USDZ**) · Kích thước (MB) · Ngày tải lên · Trạng thái · Thao tác. Tổng 24.

### 3.9 Quản lý coupon / Khuyến mãi — `wireframes/25-admin-khuyen-mai.png`
- Tabs: Tất cả (12) · Đang diễn ra (5) · Sắp diễn ra (3) · Đã kết thúc (4). Lọc Loại khuyến mãi · Trạng thái · [+ Tạo khuyến mãi].
- Bảng: Mã khuyến mãi (WELCOME10, FREESHIP, NOITHAT20, BLACKFRIDAY, SUMMER2026) · Tên khuyến mãi · Loại (Giảm theo % / Miễn phí ship) · Giá trị · Thời gian (từ – đến) · Số lượt dùng (đã dùng/tổng, vd 124/500) · Trạng thái · Thao tác.

### 3.10 Báo cáo thu chi — `wireframes/26-admin-bao-cao.png`
- "Báo cáo – Thống kê và phân tích hoạt động kinh doanh." · date range picker.
- 4 KPI card: Tổng doanh thu 235.400.000đ (↑10%) · Tổng đơn hàng 256 (↑12%) · Khách hàng mới 89 (↑7%) · Sản phẩm bán ra 124 (↑5%).
- **Doanh thu theo ngày** (line chart, dropdown "7 ngày qua").
- **Doanh thu theo danh mục** (donut, tâm "235.4M Tổng doanh thu"): Sofa 32% · Bàn 18% · Giường 22% · Tủ 12% · Đèn 10% · Khác 6%.
- **Top sản phẩm bán chạy** + "Xem tất cả →": hạng · ảnh · tên · số lượng · doanh thu.

---

## 4. Sitemap / Routes gợi ý

| Route | Màn hình |
|---|---|
| `/` | Trang chủ |
| `/products` , `/products?category=sofa` | Danh sách sản phẩm |
| `/products/:slug` | Chi tiết sản phẩm |
| `/search?q=` | Kết quả tìm kiếm |
| `/spaces` | Không gian mẫu |
| `/cart` | Giỏ hàng |
| `/checkout` | Thanh toán |
| `/login`, `/register` | Đăng nhập / Đăng ký |
| `/account/profile` | Thông tin cá nhân (+ địa chỉ, đơn gần đây) |
| `/account/orders` | Đơn hàng của tôi |
| `/account/coupons` | Mã giảm giá của tôi |
| `/account/reviews` | Đánh giá của tôi |
| `/account/wishlist` hoặc `/wishlist` | Sản phẩm yêu thích |
| `/admin` | Tổng quan |
| `/admin/products`, `/admin/products/new` | QL sản phẩm |
| `/admin/spaces`, `/admin/spaces/new` | QL không gian mẫu |
| `/admin/categories` | QL danh mục |
| `/admin/orders` | QL đơn hàng |
| `/admin/customers` | QL khách hàng |
| `/admin/reviews` | QL đánh giá |
| `/admin/models` | QL mô hình 3D |
| `/admin/promotions` | QL khuyến mãi / coupon |
| `/admin/reports` | Báo cáo thu chi |
| `/account/orders/:code` | Chi tiết đơn hàng (khách) |
| `/checkout/success`, `/checkout/failed` | Đặt hàng thành công / thất bại |
| `/forgot-password`, `/reset-password` | Quên / đặt lại mật khẩu |
| `/account/password` | Đổi mật khẩu |
| `/spaces/:slug` | Chi tiết không gian mẫu |
| `/products/:slug/3d` | Trình xem 3D / AR (có thể là modal toàn màn hình) |
| `/account/returns`, `/account/returns/new?order=` | Đổi trả & hoàn tiền |
| `/account/notifications` | Thông báo |
| `/about`, `/contact`, `/faq`, `/policies/:slug` | Trang tĩnh |
| `*` | 404 |
| `/admin/login` | Đăng nhập quản trị |
| `/admin/orders/:code` | Chi tiết đơn hàng (admin) |
| `/admin/returns` | Quản lí đổi trả |
| `/admin/customers/:id` | Chi tiết khách hàng |
| `/admin/promotions/new` | Tạo khuyến mãi |
| `/admin/questions` | Quản lí hỏi đáp |
| `/admin/content` | Banner, bài viết, trang tĩnh |
| `/admin/inventory` | Kho hàng |
| `/admin/settings` | Cài đặt |

## 5. Thực thể dữ liệu suy ra từ wireframe

- **User**: id, fullName, email, phone, gender, birthday, avatar, **role chỉ có 2 giá trị: doanh nghiệp (admin) / khách hàng (customer)**, group (mới/thân thiết – chỉ áp dụng khách hàng), status.
- **Address**: userId, label (Nhà riêng/Văn phòng), receiverName, phone, street, ward, district, city, isDefault.
- **Category**: name, slug, parentId (cây 2 cấp), status, productCount.
- **Product**: name, slug, sku, categoryId, brand, price, originalPrice, discountPercent, stock, shortDesc, description (rich text), status (Đang bán / Tạm hết hàng), material, style, rating, reviewCount, images[], seo.
- **ProductVariant**: productId, color (tên + mã hex), size (2 chỗ/3 chỗ/4 chỗ), stock, price.
- **Model3D**: productId, fileName, format (GLB/USDZ), sizeMB, previewImage, uploadedAt, status.
- **Space (Không gian mẫu)**: name, type (Phòng khách/ngủ/ăn/làm việc), style, description, coverImage, images360[], hotspots[] (toạ độ → productId), suggestedProducts[], status.
- **Cart / CartItem**: userId, productId, variantId, quantity.
- **Wishlist**: userId, productId (cũng có thể lưu spaceId).
- **Order**: code (`#ORD00125`), userId, items[], subtotal, discount, shippingFee, total, shippingAddress, paymentMethod (COD/Card/E-wallet: MoMo, ZaloPay, VNPAY), paymentStatus (Chưa TT/Đã TT/Hoàn tiền), status (Chờ xác nhận → Đang xử lý → Đang giao → Đã giao | Đã hủy), note, createdAt.
- **Review**: productId, userId, orderId, rating (1–5), content, images[], status (Hiển thị/Ẩn), createdAt.
- **Promotion / Coupon**: code, name, type (percent / fixed / freeship), value, minOrder, appliesTo (tất cả / theo danh mục), startAt, endAt, usageLimit, usedCount, status.
- **UserCoupon**: userId, couponId, status (Chưa sử dụng / Đã sử dụng / Hết hạn).
- **ActivityLog** (dashboard): actor, action, target, createdAt.
- **ReturnRequest**: code (`#RT0012`), orderId, userId, items[] (productId, qty), type (refund/exchange), reason, description, images[], refundAmount, status (Chờ duyệt → Đang lấy hàng → Đang kiểm tra → Đã hoàn tiền / Đã đổi | Từ chối), adminNote.
- **OrderStatusHistory**: orderId, status, note, actor (admin / hệ thống / khách hàng), createdAt (dùng cho timeline + lịch sử xử lý).
- **Question / Answer** (Hỏi đáp): productId, userId, content, answer, answeredBy, isPublic, status.
- **Notification**: userId, type (order/promo/system), title, content, link, isRead, createdAt.
- **PasswordReset**: email, otp (6 số), expiresAt, attempts.
- **Banner**: title, image, link, position (hero-1, hero-2, giữa trang…), startAt, endAt, sortOrder, isActive. **Post** (blog): title, slug, category, cover, content, authorId, status, views. **Page** (trang tĩnh): slug, title, content.
- **Supplier**, **StockReceipt** (phiếu nhập/xuất): code, type (in/out), supplierId/orderId, items[] (productId, qty, costPrice), total, status. Product thêm `costPrice`, `minStock`, `reservedQty`.
- **Expense** (phiếu chi): code, category (giá vốn, vận chuyển, marketing, phí thanh toán, hoàn tiền, khác), amount, note, date. **Báo cáo thu chi** = doanh thu (Order đã thanh toán) − chi phí (Expense + giá vốn).
- **Settings**: thông tin cửa hàng, cấu hình cổng thanh toán, bảng phí vận chuyển theo khu vực.

## 6. Ghi chú cho agent khi code giao diện

1. Tách component dùng chung trước: `Header`, `Footer`, `Breadcrumb`, `ProductCard`, `FilterSidebar`, `SortToolbar`, `Pagination`, `StatusBadge`, `AccountSidebar`, `AdminSidebar`, `AdminTopbar`, `DataTable`, `KpiCard`, `CouponCard`, `OrderCard`, `ReviewCard`.
2. Giữ đúng tông màu nâu–kem–be ấm, nhiều khoảng trắng, card bo góc nhẹ, shadow rất mờ.
3. Responsive: lưới sản phẩm 4 cột desktop → 2 cột tablet → 1–2 cột mobile; FilterSidebar thành drawer trên mobile; AdminSidebar thu gọn bằng nút ☰.
4. Tính năng 3D: nút "3D" ở gallery & các banner "Trải nghiệm 3D" mở viewer (gợi ý `<model-viewer>` hoặc three.js / react-three-fiber) đọc file GLB; USDZ cho AR trên iOS.
5. Dữ liệu mẫu (tên SP, giá, mã đơn, khách hàng) trong tài liệu này có thể dùng làm mock data.


---

## 7. MÀN HÌNH BỔ SUNG (thiết kế thêm, ảnh 27–54)

> Thiết kế dựa trên phong cách của wireframe gốc. Mỗi màn hình có ảnh `wireframes/NN-*.png` và mã HTML tĩnh `mockups-html/NN-*.html` (chỉ để tham khảo layout/khoảng cách/màu – khi code hãy tách thành component theo framework của dự án). Ảnh sản phẩm trong mockup là hình minh họa vẽ tay; khi code thay bằng ảnh thật.

### 7A. Storefront

#### 7.1 Chi tiết đơn hàng (khách) — `wireframes/27-chi-tiet-don-hang.png`
- Layout tài khoản (AccountSidebar active "Đơn hàng của tôi"). Link "← Đơn hàng của tôi".
- Tiêu đề "Chi tiết đơn hàng #ORD00125", phụ "Đặt ngày … · 2 sản phẩm". Góc phải: badge trạng thái, [In hóa đơn], [Hủy đơn hàng] (chỉ hiện khi Chờ xác nhận/Đang xử lý).
- **Stepper 5 bước** có icon: Đặt hàng → Đã xác nhận → Đang xử lý → Đang giao → Đã giao (bước xong nền primary, bước hiện tại viền primary, kèm thời gian).
- Cột trái: card **Sản phẩm** (ảnh, tên, phân loại, SL, giá) + nút [Mua lại] [Liên hệ hỗ trợ]; card **Lịch sử vận chuyển** (timeline chấm tròn + mô tả + thời gian).
- Cột phải: **Thông tin nhận hàng**, **Thanh toán** (phương thức + badge Chưa/Đã thanh toán), **Tổng tiền** (Tạm tính, Giảm giá kèm mã, Phí vận chuyển, Tổng cộng).
- Đơn **Đã giao**: thay nút Hủy bằng [Đánh giá sản phẩm] và [Yêu cầu đổi trả] (trong 7 ngày).

#### 7.2 Đặt hàng thành công — `wireframes/28-dat-hang-thanh-cong.png`
- Breadcrumb `Trang chủ > Giỏ hàng > Thanh toán > Hoàn tất`.
- Card giữa: icon ✓ tròn xanh, "Đặt hàng thành công!", câu cảm ơn + email đã gửi xác nhận.
- Ô be 4 cột: Mã đơn hàng · Ngày đặt · Thanh toán · Dự kiến giao. Danh sách SP + Tổng cộng.
- Nút [Xem chi tiết đơn hàng] (primary) + [Tiếp tục mua sắm →]. Card quà tặng mã giảm giá cho đơn sau + [Lưu mã].
- **Biến thể thất bại** (`/checkout/failed`): icon ✕ đỏ, "Thanh toán không thành công", nút [Thử thanh toán lại] [Chọn phương thức khác]. Trang này cũng là URL trả về từ VNPAY/MoMo.

#### 7.3 Quên mật khẩu — `wireframes/29-quen-mat-khau.png`
- Dùng chung layout 2 cột với Đăng nhập/Đăng ký (ảnh + 3 điểm nổi bật bên trái, form bên phải).
- Icon chìa khóa, "QUÊN MẬT KHẨU", mô tả gửi OTP 6 số. Trường Email* · [Gửi mã xác thực] · "← Quay lại Đăng nhập".

#### 7.4 Đặt lại mật khẩu — `wireframes/30-dat-lai-mat-khau.png`
- "ĐẶT LẠI MẬT KHẨU", "Mã OTP đã được gửi tới ng***a@gmail.com".
- **6 ô OTP** (tự nhảy ô), "Không nhận được mã? Gửi lại (00:45)" (đếm ngược).
- Mật khẩu mới* (hiện/ẩn) + **thanh độ mạnh 4 vạch** (Yếu/Trung bình/Mạnh) · Xác nhận mật khẩu mới* · [Đặt lại mật khẩu].

#### 7.5 Đổi mật khẩu — `wireframes/31-doi-mat-khau.png`
- AccountSidebar active "Đổi mật khẩu". Card form: Mật khẩu hiện tại* · Mật khẩu mới* · Xác nhận* · ☑ Đăng xuất khỏi tất cả thiết bị khác · [Cập nhật mật khẩu] [Hủy].
- Card be bên phải "Yêu cầu mật khẩu": checklist realtime (✓ xanh / ✕ xám): ≥ 8 ký tự, 1 chữ hoa, 1 chữ số, 1 ký tự đặc biệt, khác mật khẩu cũ. Ghi chú cho tài khoản Google: tạo mật khẩu.

#### 7.6 Chi tiết không gian mẫu — `wireframes/32-chi-tiet-khong-gian-mau.png`
- Breadcrumb `Trang chủ > Không gian mẫu > Phòng khách hiện đại`.
- **Cột trái (≈64%) – Viewer ảnh 360°**: badge "360° · Kéo để xoay"; **hotspot** tròn trên từng món đồ, bấm → popover (ảnh nhỏ, tên, giá, [Thêm] [Xem]); nút góc dưới phải: phóng to, thu nhỏ, tự xoay, toàn màn hình. Hàng thumbnail các góc chụp + ô "Xem 3D".
- **Cột phải**: badge phong cách & loại phòng, tên không gian, sao + lượt xem, mô tả.
  Card **"Sản phẩm trong không gian (5)"**: checkbox chọn từng SP (ảnh, tên, phân loại, giá), "Chọn tất cả"; tổng giá gốc gạch ngang + giá combo (giảm thêm 10% khi mua trọn bộ); [**Thêm cả bộ vào giỏ hàng**]; [Lưu không gian] [Chia sẻ].
- Section **Không gian tương tự**: 4 card.
- Gợi ý kỹ thuật: ảnh equirectangular + Pannellum / Photo Sphere Viewer / three.js; hotspot lưu toạ độ (pitch, yaw) → productId.

#### 7.7 Trình xem 3D / AR — `wireframes/33-trinh-xem-3d.png`
- Màn hình toàn trang (hoặc modal fullscreen). Thanh trên: ←, tên SP "· Trình xem 3D", [Chia sẻ], [✕].
- **Vùng canvas** nền gradient sáng: mô hình 3D, vòng xoay 360° gợi ý; badge "Kéo để xoay · Cuộn để phóng to"; thanh công cụ dọc trái (phóng to, thu nhỏ, đặt lại góc, toàn màn hình, ánh sáng); card kích thước (D×R×C, định dạng, dung lượng); tab góc nhìn dưới cùng: Phối cảnh · Trước · Bên · Trên · Kích thước.
- **Panel phải**: tên, sao, giá; chọn Màu (đổi texture realtime), Chất liệu, Kích thước; khối **"Xem AR tại nhà"** có mã QR (iOS: USDZ, Android: GLB/Scene Viewer); [Thêm vào giỏ hàng] [Xem chi tiết sản phẩm].
- Gợi ý: `<model-viewer src=".glb" ios-src=".usdz" ar camera-controls>`.

#### 7.8 Viết đánh giá (modal) — `wireframes/34-viet-danh-gia.png`
- Mở từ nút "Đánh giá sản phẩm" (đơn đã giao). Overlay mờ trên trang Đơn hàng của tôi.
- Modal 620px: header "Đánh giá sản phẩm" + ✕; card SP (ảnh, tên, phân loại, mã đơn); **5 sao lớn** + nhãn (Rất tệ/Tệ/Bình thường/Hài lòng/Tuyệt vời); chip tiêu chí chọn nhiều (Chất lượng tốt, Đúng mô tả, Giao hàng nhanh, Đóng gói cẩn thận, Giá hợp lý); textarea nội dung* (đếm 0/1000, tối thiểu 20 ký tự); tải ảnh/video (tối đa 5); ☐ Đánh giá ẩn danh; footer [Hủy] [Gửi đánh giá].
- Dùng lại modal này cho "Sửa đánh giá" ở trang Đánh giá của tôi.

#### 7.9 Yêu cầu đổi trả — `wireframes/35-yeu-cau-doi-tra.png`
- AccountSidebar active "Đổi trả & hoàn tiền". Phụ đề: mã đơn, ngày giao, "Còn 3 ngày để gửi yêu cầu (chính sách 7 ngày)".
- Cột trái 3 bước: **1. Chọn sản phẩm** (checkbox + stepper số lượng) · **2. Hình thức** (card radio: Trả hàng & hoàn tiền / Đổi sản phẩm khác) · **3. Lý do** (radio: lỗi/hư hỏng, giao sai mẫu-màu, không đúng mô tả, thiếu phụ kiện, đổi ý) + Mô tả chi tiết* + Ảnh/video minh chứng*.
- Cột phải: card **Tóm tắt** (số SP, giá trị, phí lấy hàng, hoàn về, Dự kiến hoàn) + [Gửi yêu cầu]; card be **Quy trình xử lý** 5 bước; card **Yêu cầu trước đây** (mã + badge).
- Trang danh sách `/account/returns` dùng lại layout Đơn hàng của tôi (tabs theo trạng thái ReturnRequest).

#### 7.10 Thông báo — `wireframes/36-thong-bao.png`
- AccountSidebar active "Thông báo". Tiêu đề + "Đánh dấu tất cả đã đọc" + [Cài đặt thông báo].
- Tabs: Tất cả · Đơn hàng · Khuyến mãi · Hệ thống. Danh sách item: icon tròn màu theo loại, tiêu đề đậm, mô tả, thời gian tương đối; **chưa đọc** nền kem + chấm đỏ. Bấm item → đi tới link liên quan.
- Icon chuông/badge trên header mở dropdown 5 thông báo mới nhất + "Xem tất cả".

#### 7.11 Về chúng tôi — `wireframes/37-ve-chung-toi.png`
- Hero ảnh full-width + overlay: eyebrow, tiêu đề "Mang không gian sống mơ ước đến gần bạn hơn", mô tả.
- Card số liệu nổi đè lên hero: 50.000+ khách hàng · 1.200+ sản phẩm · 300+ mô hình 3D · 12 showroom.
- Khối 2 cột ảnh + "Câu chuyện"; **Giá trị cốt lõi** 4 card icon; **Đội ngũ** 4 card avatar; banner be "Ghé thăm showroom" + [Liên hệ ngay] [Xem không gian mẫu].

#### 7.12 Liên hệ — `wireframes/38-lien-he.png`
- 4 card thông tin: Hotline · Email · Showroom · Giờ làm việc.
- Trái: form "Gửi tin nhắn": Họ tên* · SĐT* · Email* · Chủ đề* (select) · Nội dung* · [Gửi liên hệ].
- Phải: bản đồ (nhúng Google Maps) + card "Hệ thống showroom" (TP.HCM, Hà Nội, Đà Nẵng · "Chỉ đường →").

#### 7.13 Câu hỏi thường gặp — `wireframes/39-cau-hoi-thuong-gap.png`
- Banner be: tiêu đề + ô tìm câu hỏi lớn.
- Sidebar chủ đề (Giao hàng & lắp đặt, Thanh toán, Đổi trả & bảo hành, Sản phẩm 3D/AR, Tài khoản, Khuyến mãi) | danh sách **accordion** (mục mở có viền primary).
- Banner cuối "Không tìm thấy câu trả lời?" + [hotline] [Gửi câu hỏi].

#### 7.14 Chính sách — `wireframes/40-chinh-sach.png`
- Sidebar danh sách chính sách (mua hàng, đổi trả, bảo hành, bảo mật, điều khoản, vận chuyển) | nội dung: tiêu đề, "Cập nhật lần cuối", dải be 3 điểm nhấn (7 ngày · Miễn phí lấy hàng · Hoàn tiền 3–5 ngày), các mục đánh số. Một template dùng cho mọi trang `/policies/:slug` (nội dung lấy từ admin Nội dung → Trang tĩnh).

#### 7.15 Giỏ hàng trống — `wireframes/41-gio-hang-trong.png`
- Card giữa: icon giỏ lớn trong vòng tròn be, "Giỏ hàng của bạn đang trống", mô tả, [Khám phá sản phẩm →] [Xem không gian mẫu].
- "Có thể bạn sẽ thích" (4 ProductCard) + "Sản phẩm đã xem gần đây" (6 card nhỏ).

#### 7.16 Trang 404 — `wireframes/42-trang-404.png`
- 2 cột: trái "404" cỡ lớn màu primary, "Ôi! Không tìm thấy trang", mô tả, ô tìm kiếm, [Về trang chủ] [Xem sản phẩm], gợi ý link; phải ảnh minh họa + bong bóng chú thích.

### 7B. Admin (Doanh nghiệp)

#### 7.17 Đăng nhập quản trị — `wireframes/43-admin-dang-nhap.png`
- 2 nửa: trái ảnh nội thất phủ gradient tối + logo + "Hệ thống quản trị Aurelia Living"; phải card form: icon khiên, "Đăng nhập quản trị", Email/Tên đăng nhập* · Mật khẩu* · ☑ Ghi nhớ · Quên mật khẩu? · [Đăng nhập] · ghi chú xác thực 2 lớp (OTP). Chỉ tài khoản role doanh nghiệp đăng nhập được; khách hàng đăng nhập ở đây sẽ báo lỗi "Tài khoản không có quyền quản trị".

#### 7.18 Chi tiết đơn hàng (admin) — `wireframes/44-admin-chi-tiet-don-hang.png`
- Breadcrumb `‹ Đơn hàng > #ORD00125`; tiêu đề + badge trạng thái; nút: [In hóa đơn] [In phiếu giao] [Hủy đơn] [**Chuyển sang "Đang giao"**] (nút chính đổi theo trạng thái kế tiếp).
- Stepper 5 trạng thái. Cột trái: bảng sản phẩm (ảnh, SKU, đơn giá, SL, thành tiền) + tổng tiền; **Lịch sử xử lý** (Admin / Hệ thống / Khách hàng – làm gì, lúc nào) + ô ghi chú nội bộ [Lưu].
- Cột phải: **Khách hàng** (avatar, liên hệ, số đơn, nhóm); **Giao hàng** (địa chỉ [Sửa], select đơn vị vận chuyển GHN/GHTK…, Mã vận đơn); **Thanh toán** (phương thức + badge + [Xác nhận đã thanh toán]); **Ghi chú của khách**.

#### 7.19 Quản lí đổi trả — `wireframes/45-admin-doi-tra.png`
- Tabs: Tất cả · Chờ duyệt · Đang lấy hàng · Đang kiểm tra · Đã hoàn tiền · Từ chối. [Xuất Excel].
- Bảng: Mã YC · Khách hàng · Sản phẩm · Lý do · Số tiền · Trạng thái · ⋯ (tìm kiếm + lọc Hình thức).
- **Panel chi tiết bên phải** khi chọn 1 dòng: mã + badge, thời gian, card SP, lý do + mô tả, ảnh minh chứng, textarea phản hồi, [Từ chối] [Duyệt & tạo lệnh lấy hàng]. Sau khi kiểm tra: [Xác nhận hoàn tiền] → tự tạo phiếu chi (Expense, danh mục Hoàn tiền) và cộng lại tồn kho.

#### 7.20 Chi tiết khách hàng — `wireframes/46-admin-chi-tiet-khach-hang.png`
- Nút: [Gửi email] [Khóa tài khoản] [Chỉnh sửa].
- Cột trái: card hồ sơ (avatar, tên, ngày tham gia, badge nhóm + trạng thái, email, SĐT, sinh nhật, giới tính, địa chỉ); **Sổ địa chỉ**; **Ghi chú nội bộ**.
- Cột phải: 4 KPI (Tổng đơn, Tổng chi tiêu, Giá trị TB/đơn, Điểm thưởng); card tabs Đơn hàng · Đánh giá · Yêu thích · Mã giảm giá · Hoạt động (mặc định bảng đơn hàng + phân trang); **Hoạt động gần đây**.

#### 7.21 Thêm danh mục (modal) — `wireframes/47-admin-them-danh-muc.png`
- Mở từ [+ Thêm danh mục] trên trang Danh mục. Trường: Tên danh mục* · Slug (tự sinh, sửa được) · Danh mục cha (select, để trống = cấp 1) · Mô tả · Ảnh đại diện (dropzone) · Icon SVG · Thứ tự hiển thị · Trạng thái (toggle) · ☑ Hiện ở "Danh mục nổi bật" trang chủ. Footer [Hủy] [Lưu danh mục]. Dùng chung cho Sửa.

#### 7.22 Tạo khuyến mãi — `wireframes/48-admin-tao-khuyen-mai.png`
- Trái: **Thông tin chung** (Tên chương trình*, Mã khuyến mãi* + [Tạo ngẫu nhiên], Mô tả); **Loại & giá trị giảm** (card radio: Giảm %, Giảm số tiền cố định, Miễn phí vận chuyển; Giá trị*, Giảm tối đa, Đơn tối thiểu); **Phạm vi áp dụng** (radio: tất cả / theo danh mục / theo sản phẩm / theo không gian mẫu; ô chọn nhiều dạng chip; Nhóm khách hàng; Kênh).
- Phải: **Thời gian & giới hạn** (Bắt đầu*, Kết thúc*, Tổng lượt dùng, Lượt dùng/khách, toggle Kích hoạt); **Xem trước** coupon dạng vé giống trang "Mã giảm giá của tôi".

#### 7.23 Tải lên mô hình 3D (modal) — `wireframes/49-admin-tai-len-mo-hinh-3d.png`
- Modal 820px 2 cột. Trái: dropzone (GLB, GLTF, USDZ ≤ 50MB) + danh sách file đang tải (thanh tiến trình %, dung lượng, thời gian còn lại, ✕) và file đã xong (✓ Hoàn tất, 🗑).
- Phải: Sản phẩm liên kết* (select tìm kiếm) · Biến thể áp dụng · **Xem trước 360°** · Tỉ lệ (scale) · Đơn vị · toggle Cho phép xem AR. Footer [Hủy] [Tải lên & lưu].

#### 7.24 Quản lí hỏi đáp — `wireframes/50-admin-hoi-dap.png`
- Tabs: Tất cả · Chưa trả lời · Đã trả lời · Ẩn. Bảng: Sản phẩm · Khách hàng · Câu hỏi · Trạng thái · ⋯.
- Panel phải "Trả lời câu hỏi": card SP, câu hỏi của khách, textarea câu trả lời*, ☑ Hiển thị công khai, ☑ Gửi thông báo cho khách, [Ẩn câu hỏi] [Gửi trả lời]. Câu trả lời hiển thị ở tab "Hỏi đáp" trang chi tiết sản phẩm.

#### 7.25 Quản lí nội dung — `wireframes/51-admin-noi-dung.png`
- Tabs gạch chân: Banner & slider · Bài viết / Blog · Trang tĩnh (Về chúng tôi, Chính sách, FAQ) · Menu & footer. Nút [Xem website] [+ Thêm banner].
- Card **Banner trang chủ**: danh sách kéo-thả (☰) — ảnh, tiêu đề, vị trí, thời gian hiển thị, badge (Đang hiển thị / Đã lên lịch / Ẩn), toggle, ⋯.
- Card **Bài viết gần đây**: bảng Tiêu đề (ảnh) · Chuyên mục · Tác giả · Ngày · Lượt xem · Trạng thái (Đã xuất bản / Bản nháp) + [Viết bài mới].

#### 7.26 Cài đặt — `wireframes/52-admin-cai-dat.png`
- Menu dọc: Thông tin cửa hàng · Thanh toán · Vận chuyển · Email & thông báo · Giao diện · SEO · Bảo mật. Nút [Lưu thay đổi].
- **Thông tin cửa hàng**: logo (dropzone), Tên cửa hàng*, Slogan, Email*, Hotline*, Địa chỉ, Mã số thuế.
- **Phương thức thanh toán**: COD, VNPAY, MoMo, ZaloPay — mỗi dòng có mô tả, link [Cấu hình] (mở form key/secret), toggle bật/tắt.
- **Phí vận chuyển**: bảng Khu vực · Phí · Miễn phí từ · Thời gian + [Thêm khu vực].

#### 7.27 Kho hàng — `wireframes/53-admin-kho-hang.png`
- Nút: [Xuất Excel] [Tạo phiếu xuất] [Tạo phiếu nhập].
- 4 KPI: Tổng tồn kho · Giá trị tồn kho (theo giá vốn) · Sắp hết hàng · Hết hàng.
- Bảng tồn kho: Sản phẩm · SKU · Giá vốn · Tồn kho · Đang giữ (đơn chưa giao) · Có thể bán · Mức tối thiểu · Trạng thái (Còn hàng / Sắp hết / Hết hàng). Lọc danh mục, tình trạng, kho.
- Card **Phiếu nhập / xuất gần đây**: Mã phiếu · Loại · Nhà cung cấp / Đơn hàng · Số SP · Tổng giá trị · Ngày · Trạng thái. Phiếu nhập hoàn tất → tăng tồn kho + tạo phiếu chi giá vốn.

#### 7.28 Báo cáo thu chi (đầy đủ) — `wireframes/54-admin-bao-cao-thu-chi.png`
> Thay thế/mở rộng màn hình 3.10 (bản gốc mới có phần thu).
- Header: date range, [Xuất báo cáo], [+ Thêm phiếu chi]. Tabs: Tổng quan thu chi · Doanh thu · Chi phí · Sổ thu chi · Công nợ.
- 4 KPI: **Tổng thu** · **Tổng chi** · **Lợi nhuận** · **Biên lợi nhuận %** (kèm % so với kỳ trước).
- **Biểu đồ cột nhóm Thu/Chi theo 12 tháng + đường Lợi nhuận**; **Donut cơ cấu chi phí** (Giá vốn, Vận chuyển & lắp đặt, Khuyến mãi, Marketing, Phí cổng thanh toán, Hoàn tiền) với số tiền + %.
- **Doanh thu theo kênh thanh toán** (thanh ngang COD/VNPAY/MoMo/ZaloPay); **Báo cáo kết quả kinh doanh**: Doanh thu bán hàng − Giảm giá/hoàn tiền = Doanh thu thuần − Giá vốn = Lợi nhuận gộp − Chi phí vận hành = Lợi nhuận trước thuế.
- **Sổ thu chi**: Ngày · Mã giao dịch (TH-/CH-) · Nội dung · Loại (badge Thu/Chi) · Danh mục · Số tiền (+ xanh / − đỏ).

### 7C. Luồng liên kết giữa các màn hình (cho agent nối route)
- Thanh toán → [Đặt hàng] → 7.2 Thành công / Thất bại → [Xem chi tiết] → 7.1.
- Đơn hàng của tôi → [Xem chi tiết] → 7.1; [Đánh giá sản phẩm] → modal 7.8; [Yêu cầu đổi trả] → 7.9.
- Đăng nhập → "Quên mật khẩu?" → 7.3 → 7.4 → Đăng nhập.
- Chi tiết SP: ô "3D" / "Trải nghiệm 3D ngay" → 7.7. Không gian mẫu: card → 7.6 → hotspot → Chi tiết SP.
- Header: icon giỏ khi rỗng → 7.15; chuông → 7.10. Footer: Về chúng tôi 7.11, Liên hệ 7.12, FAQ 7.13, Chính sách 7.14. Route không tồn tại → 7.16.
- Admin: chưa đăng nhập hoặc không phải tài khoản doanh nghiệp → 7.17. Đơn hàng → 7.18. Khách hàng → 7.20. Danh mục → modal 7.21. Khuyến mãi → 7.22. Mô hình 3D → modal 7.23.
