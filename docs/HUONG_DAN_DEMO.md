# Hướng dẫn demo Aurelia Living (web)

Dành cho người trình bày. Chạy bằng **API thật + DB `aurelia_demo`** (đã nạp dữ liệu mẫu). Không dùng `aurelia_dev` (dữ liệu của bạn) và không chạy seed/reset trên đó.

## 1. Khởi động

Yêu cầu: Node ≥ 22, Docker Desktop, đã chạy `npm install` ở thư mục gốc.

| Bước | Lệnh (thư mục gốc dự án) | Kết quả |
|---|---|---|
| 1. Hạ tầng | `npm run docker:up` | Postgres (cổng host **55432**), Redis (**6380**), Mailpit (UI **http://localhost:8025**). Không tạo lại container đang chạy |
| 2. (Chỉ khi cần dữ liệu sạch) | `node scripts/db-reset.mjs aurelia_demo` | Xóa và nạp lại **chỉ** `aurelia_demo` từ dữ liệu mẫu. Lệnh từ chối mọi DB khác |
| 3. API + Web | `npm run demo` | API cổng **4000** (Swagger http://localhost:4000/docs) và web cổng **3000** (admin: http://localhost:3000/admin/login). Chỉ API: `npm run demo:api`. Dừng: Ctrl+C |

`npm run demo` tự đặt `DATABASE_URL` = `aurelia_demo`, `STORAGE_DRIVER=local`, `STORAGE_PUBLIC_URL`, `PAYMENT_SANDBOX_FAKE=true` và `NEXT_PUBLIC_USE_MOCK=false` chỉ cho hai tiến trình này; **không sửa `.env`** (khóa JWT… vẫn lấy từ `.env`) và không bao giờ dùng `aurelia_dev`.

Kiểm tra nhanh: mở http://localhost:3000 thấy trang chủ có banner và sản phẩm; http://localhost:4000/docs mở được Swagger.

Lưu ý:
- Ảnh demo nằm trong thư mục `apps/api/uploads`; **đừng xóa** thư mục này, nếu không ảnh sẽ vỡ (khi đó chạy lại bước 2).
- Email (xác thực, đặt lại mật khẩu) xem ở Mailpit http://localhost:8025.
- Mỗi lần thao tác thử làm thay đổi dữ liệu demo (đơn, giỏ…). Muốn trở về trạng thái ban đầu: dừng API rồi chạy bước 2.

## 2. Tài khoản

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Khách | `khachhang@aurelia.vn` | `123456` | Đã xác thực email; có sẵn giỏ, đơn ở nhiều trạng thái, mã đã lưu, thông báo |
| Quản trị | `admin@aurelia.vn` | `admin123` | Đăng nhập tại `/admin/login` |

Mã giảm giá để thử: `WELCOME10` (10%, đơn từ 500.000đ), `GIAM200K` (giảm 200.000đ, đơn từ 2.000.000đ), `FREESHIP` (miễn phí ship, đơn từ 1.000.000đ), `NOITHAT20` (20%, đơn từ 5.000.000đ).

Dữ liệu mẫu: 21 danh mục, 53 sản phẩm có ảnh (10 sản phẩm có xem 360°, ví dụ `sofa-nordic`, `sofa-luxury`, `sofa-goc-hien-dai`, `ghe-thu-gian`), 21 không gian mẫu 360° có điểm tương tác (ví dụ `phong-lam-viec-toi-gian`, `phong-khach-hien-dai`), 15 mã giảm giá, 83 đơn ở đủ trạng thái (chờ xác nhận, đang xử lý, đang giao, hoàn tất, hủy, hoàn tiền), yêu cầu đổi trả ở nhiều trạng thái, 16 phiếu kho, 59 phiếu chi, 7 banner.

## 3. Kịch bản: phía khách (đăng nhập khách, khoảng 8–10 phút)

1. **Duyệt**: trang chủ (banner, danh mục, sản phẩm nổi bật) → *Sản phẩm*: lọc theo danh mục, khoảng giá, sắp xếp, tìm kiếm có dấu/không dấu.
2. **Xem 360° sản phẩm**: mở `/products/sofa-nordic` → bấm nút **"360°"** (trên ảnh lớn hoặc ô "360°" ở hàng ảnh nhỏ). Ở trang 360°: kéo chuột / phím ← → để xoay, cuộn để phóng to, bấm "Tự xoay"; đổi **màu** và **kích thước** (xoay giữ nguyên góc, URL đổi theo biến thể); thử biến thể hết hàng (Sofa Nordic màu Xám + 4 chỗ); tab "Chính sách" và "Thông số". Nút Back quay về trang chi tiết đúng biến thể.
3. **Xem không gian 360°**: *Không gian mẫu* → mở `phong-lam-viec-toi-gian`. Kéo để xoay ảnh 360°; bấm **hotspot sản phẩm** (thẻ giá, nút "Thêm" vào giỏ / "Xem" chi tiết); bấm hotspot **thông tin**; xoay tới hotspot **điều hướng** để đổi sang góc khác (hoặc bấm ảnh thu nhỏ). Cột bên phải liệt kê sản phẩm trong không gian: tick chọn từng món, hiển thị **tổng giá thật**, bấm **"Thêm cả bộ vào giỏ hàng"**. Bấm **"Lưu không gian"** (bookmark) và "Chia sẻ".
4. **Giỏ hàng**: đổi số lượng, xóa món, nhập **mã giảm giá** (`GIAM200K`) → xem giảm giá và phí vận chuyển theo địa chỉ.
5. **Đặt hàng COD**: *Thanh toán* → chọn địa chỉ → "Thanh toán khi nhận hàng" → đặt → trang thành công → *Tài khoản → Đơn hàng* thấy đơn "Chờ xác nhận".
6. **Thanh toán giả lập**: đặt thêm một đơn, chọn **VNPAY / thẻ / ví**. Hệ thống giả lập luôn **thành công** (đơn chuyển "Đã xác nhận", đã thanh toán). Muốn trình bày thất bại: ghi chú đơn có chữ `[fail]` → trang "Thanh toán thất bại" → bấm **Thanh toán lại** (thành công). Khách không tự chọn được kết quả.
7. **Đánh giá**: *Đơn hàng* → mở một đơn **đã hoàn tất** (ví dụ `ALV-20261028-0001`) → *Đánh giá* sản phẩm (sao, nội dung, ảnh). Đánh giá chờ admin duyệt (xem mục 4.5). Với đơn vừa tạo: nhờ admin chuyển đơn tới "Hoàn tất" rồi đánh giá.
8. (Tùy chọn) **Hỏi đáp sản phẩm**, **yêu thích**, **yêu cầu đổi trả** ở đơn đã hoàn tất, **quên mật khẩu** (email ở Mailpit).

## 4. Kịch bản: phía quản trị (đăng nhập admin)

1. **Tổng quan** (`/admin`): doanh thu, đơn, biểu đồ theo ngày, sản phẩm bán chạy, hoạt động gần đây.
2. **Duyệt đơn và vận chuyển** (`/admin/orders`): tab "Chờ xác nhận" → mở đơn → *Xác nhận đơn hàng → Chuyển sang "Đang xử lý"*. Nút "Chuyển sang Đang giao" bị khóa cho tới khi **tạo vận đơn** (khối "Vận đơn" bên phải: chọn đơn vị, mã vận đơn, phí → *Tạo vận đơn*). Rồi: *Chuyển sang "Đang giao"* → ở vận đơn bấm *Đã lấy hàng → Đang vận chuyển → Đánh dấu đã giao*: đơn **tự hoàn tất** (COD tự đã thanh toán, tăng số đã bán, khách nhận thông báo). Không còn nút "Hoàn tất" thủ công. *Giao thất bại / Hoàn hàng*: đơn giữ "Đang giao", tạo vận đơn mới để giao lại. Có thể hủy đơn khi chưa giao.
3. **Kho** (`/admin/inventory`): KPI tồn, lọc "Sắp hết/Hết hàng"; **Tạo phiếu nhập** (nhà cung cấp, sản phẩm, số lượng, giá vốn) → *Lưu nháp* (chưa đổi tồn) rồi **Xác nhận** trong bảng phiếu ⇒ tồn tăng, ghi dòng trong "Lịch sử biến động tồn kho" và sinh phiếu chi giá vốn; **Tạo phiếu xuất** (xuất quá tồn bị từ chối); hủy phiếu nháp.
4. **Thu chi** (`/admin/reports`): chọn khoảng ngày; xem doanh thu, chi phí, lợi nhuận, biểu đồ, cơ cấu chi, sổ thu chi, công nợ phải trả (phiếu nhập nháp). **Thêm phiếu chi** (marketing, vận chuyển…) → số liệu và sổ cập nhật. Quy ước: doanh thu = đơn đã giao thành công theo ngày giao; giá vốn = phiếu nhập; hoàn tiền tự sinh phiếu chi (chi tiết trong `docs/CHUAN_MO_RONG.md`).
5. **Đánh giá** (`/admin/reviews`): duyệt/ẩn đánh giá vừa tạo ở bước 3.7. **Hỏi đáp** (`/admin/questions`): trả lời câu hỏi.
6. **Đổi trả** (`/admin/returns`): mở yêu cầu "Chờ duyệt" → duyệt → lấy hàng → kiểm tra → hoàn tiền/đổi hàng (tồn kho và phiếu chi tự cập nhật; đổi hàng thiếu hàng sẽ báo lỗi).
7. **Banner & nội dung** (`/admin/content`): thêm/sửa banner trang chủ, bài viết, trang tĩnh (soạn bằng Markdown).
8. **Không gian mẫu** (`/admin/spaces`): *Thêm không gian mẫu* — 5 tab: thông tin, **ảnh 360°** (tải ảnh tỉ lệ 2:1), **điểm tương tác** (bấm lên ảnh để đặt hotspot: sản phẩm / điều hướng / thông tin), sản phẩm gợi ý, hiển thị → lưu → mở trang khách để xem. Ô **slug** chỉ đổi khi bạn sửa trực tiếp.
9. **Sản phẩm** (`/admin/products`): sửa sản phẩm → tab **Ảnh 360°** (bật 360°, tải nhiều frame theo màu, đổi thứ tự, xem trước xoay, tối đa 2 MB/ảnh); tab **Biến thể** chọn màu/kích thước từ danh sách thuộc tính; ô **Thương hiệu** lấy từ trang Thương hiệu.
10. **Danh mục, Thương hiệu, Thuộc tính, Thư viện media**: `/admin/categories`; `/admin/brands` (thêm/sửa/tắt, slug trùng báo lỗi, xóa có cảnh báo số sản phẩm bị gỡ thương hiệu); `/admin/attributes` (Màu sắc/Kích thước/Chất liệu và giá trị; giá trị đang được biến thể dùng không xóa được); `/admin/media` (tải ảnh ≤ 5 MB, sửa mô tả, xóa tệp chưa dùng).
10b. **Khuyến mãi** (`/admin/promotions`), **Khách hàng** (`/admin/customers`).
10c. **Mô hình 3D – xử lý nền** (`/admin/models`): bấm *Tải lên mô hình*, chọn sản phẩm và một tệp GLB (có thể dùng `apps/api/test/fixtures/sphere.glb`) → *Tải lên*. Tệp được nhận ngay (thông báo "đang được xử lý nền") và dòng mô hình hiện **Đang xử lý nền…**; trang tự cập nhật (không cần tải lại) sang **Sẵn sàng** với 3 dòng LOD *high / medium / low*. Mở `/products/<slug>/3d` để xem: máy tính dùng LOD medium, điện thoại (thu hẹp cửa sổ < 768 px rồi tải lại) dùng LOD low. Thử thêm: tải `apps/api/test/fixtures/broken.glb` → trạng thái **Lỗi** kèm lý do và nút **Xử lý lại**; tải lên mô hình thứ hai cho cùng sản phẩm (tick *Tạo mô hình mới*) rồi bấm **Đặt làm mô hình chính**. Cần Redis (`npm run docker:up`). Giới hạn 100 MB; mỗi LOD phải ≤ 5 MB, vượt thì báo lỗi và gửi thông báo cho admin.
11. **Cài đặt** (`/admin/settings`): thông tin cửa hàng (tên, email, hotline… kiểm tra dữ liệu), **thanh toán** (bật/tắt phương thức — phương thức tắt bị ẩn ở trang thanh toán và bị từ chối khi đặt), **vận chuyển** (phí theo vùng). Thay đổi có hiệu lực ngay ở phía khách.

## 5. Chưa làm (nói rõ khi trình bày)

- **Mốc 5 còn lại** (ngoài phạm vi): AR (xem sản phẩm trong phòng thật), đổi chất liệu 3D, đặt đồ trong không gian (placement), quản lý phiên đăng nhập, xóa tài khoản, gửi thông báo thủ công, màn nhật ký hoạt động, thống kê AR, phân quyền chi tiết theo vai trò. (Thương hiệu, thuộc tính, media, vận chuyển đã làm.)
- **Android** (`apps/mobile`): không nằm trong đợt này.
- **VNPAY thật**: đã làm URL có chữ ký, Return URL, IPN, thanh toán lại và đã kiểm bằng khóa giả; chưa có khóa sandbox nên demo dùng chế độ **giả lập**. MoMo/ZaloPay chỉ giả lập.
- **MinIO, bộ nhớ đệm Redis**: hoãn; demo lưu ảnh trên đĩa (`STORAGE_DRIVER=local`). (Xử lý nền mô hình 3D — tạo LOD — **đã làm**, xem bước 10c; tải lên vẫn qua API, chưa dùng presigned URL.)
- Giá combo của không gian không áp dụng (đặc tả không có); `loyalty_points`, `carts.coupon_id` giữ nguyên cột nhưng chưa có chức năng điểm tích lũy.

## 6. Xử lý sự cố nhanh

| Hiện tượng | Cách xử lý |
|---|---|
| Thanh toán online báo "Cổng thanh toán chưa được cấu hình" | API không chạy bằng `npm run demo` (thiếu `PAYMENT_SANDBOX_FAKE=true`) |
| Ảnh sản phẩm/không gian bị vỡ | Thiếu `apps/api/uploads` hoặc API không chạy bằng `npm run demo` (`STORAGE_DRIVER=local`); chạy lại bước 2 |
| Web báo lỗi mạng | API chưa chạy ở cổng 4000 hoặc `NEXT_PUBLIC_API_URL` sai |
| Đăng nhập báo hết phiên | Phiên tự làm mới; nếu vẫn lỗi, đăng nhập lại |
| Dữ liệu demo đã bị sửa nhiều | Dừng API, chạy `node scripts/db-reset.mjs aurelia_demo`, chạy lại API |
