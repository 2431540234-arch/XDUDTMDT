# Sơ đồ UML đã xuất ảnh

Bảng này giúp chèn ảnh vào báo cáo Word theo đúng thứ tự. Có **144 sơ đồ**, xuất ảnh thành công **144/144** (PNG, độ phân giải ×2). Sơ đồ lớn khó đọc khi in có thêm bản **SVG** (vector, phóng to không vỡ).

```text
docs/diagrams/
├── src/   file nguồn Mermaid (.mmd), mỗi file một sơ đồ
├── png/   ảnh PNG nền trắng, scale ×2
├── svg/   bản SVG của sơ đồ lớn (class, use case, kiến trúc, sequence/activity dài)
└── manifest.json   danh sách và siêu dữ liệu
```

## Cách đưa vào báo cáo Word

1. Chèn PNG theo thứ tự các bảng dưới đây (cột "Thứ tự"). Sơ đồ Sequence và ERD tổng quan rộng: chèn ở trang xoay ngang (landscape) hoặc dùng bản SVG.
2. Chú thích hình: dùng cột "Mục trong báo cáo" làm tiêu đề hình.
3. Cập nhật sơ đồ: sửa file `.mmd` trong `src/` (hoặc sửa tài liệu gốc rồi xuất lại), rồi chạy lại:

```bash
npx -y @mermaid-js/mermaid-cli -i docs/diagrams/src/<ten>.mmd -o docs/diagrams/png/<ten>.png -b white -s 2
```

Lưu ý: các sơ đồ lấy nội dung từ hai tài liệu `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` và `docs/BAO_CAO_PHAN_TICH_THIET_KE.md`; khi đổi thiết kế, cập nhật tài liệu gốc và file `.mmd` cùng lúc.

# Phần A – Báo cáo phân tích thiết kế (`docs/BAO_CAO_PHAN_TICH_THIET_KE.md`)

## A.1. Kiến trúc hệ thống (mục 1.2)

| Thứ tự | Tên ảnh | Loại sơ đồ | Mã UC | Mục trong báo cáo | SVG |
| --- | --- | --- | --- | --- | --- |
| 1 | `png/architecture_kien-truc-he-thong.png` | Kiến trúc | — | 1.2. Kiến trúc | có |

## A.2. Mô hình hoạt động – Activity Diagram (mục 3)

| Thứ tự | Tên ảnh | Loại sơ đồ | Mã UC | Mục trong báo cáo | SVG |
| --- | --- | --- | --- | --- | --- |
| 1 | `png/activity_UC-AUTH-01_dang-ky-tai-khoan.png` | Activity | UC-AUTH-01 | A.1 UC-AUTH-01 – Đăng ký tài khoản | — |
| 2 | `png/activity_UC-AUTH-02_dang-nhap.png` | Activity | UC-AUTH-02 | A.2 UC-AUTH-02 – Đăng nhập | — |
| 3 | `png/activity_UC-AUTH-03_lam-moi-access-token.png` | Activity | UC-AUTH-03 | A.3 UC-AUTH-03 – Làm mới access token | — |
| 4 | `png/activity_UC-AUTH-04_dang-xuat.png` | Activity | UC-AUTH-04 | A.4 UC-AUTH-04 – Đăng xuất | — |
| 5 | `png/activity_UC-AUTH-05_quen-mat-khau-yeu-cau-dat-lai.png` | Activity | UC-AUTH-05 | A.5 UC-AUTH-05 – Quên mật khẩu (yêu cầu đặt lại) | — |
| 6 | `png/activity_UC-AUTH-06_dat-lai-mat-khau.png` | Activity | UC-AUTH-06 | A.6 UC-AUTH-06 – Đặt lại mật khẩu | — |
| 7 | `png/activity_UC-AUTH-07_xac-thuc-email.png` | Activity | UC-AUTH-07 | A.7 UC-AUTH-07 – Xác thực email | — |
| 8 | `png/activity_UC-ACC-01_xem-va-cap-nhat-ho-so-ca-nhan.png` | Activity | UC-ACC-01 | A.8 UC-ACC-01 – Xem và cập nhật hồ sơ cá nhân | — |
| 9 | `png/activity_UC-ACC-02_doi-mat-khau.png` | Activity | UC-ACC-02 | A.9 UC-ACC-02 – Đổi mật khẩu | — |
| 10 | `png/activity_UC-ACC-04_quan-ly-so-dia-chi-giao-hang.png` | Activity | UC-ACC-04 | A.10 UC-ACC-04 – Quản lý sổ địa chỉ giao hàng | — |
| 11 | `png/activity_UC-ACC-05_xem-va-danh-dau-da-doc-thong-bao.png` | Activity | UC-ACC-05 | A.11 UC-ACC-05 – Xem và đánh dấu đã đọc thông báo | — |
| 12 | `png/activity_UC-ACC-06_quan-ly-danh-sach-yeu-thich.png` | Activity | UC-ACC-06 | A.12 UC-ACC-06 – Quản lý danh sách yêu thích | — |
| 13 | `png/activity_UC-CAT-01_xem-trang-chu.png` | Activity | UC-CAT-01 | A.13 UC-CAT-01 – Xem trang chủ | — |
| 14 | `png/activity_UC-CAT-02_duyet-san-pham-theo-danh-muc.png` | Activity | UC-CAT-02 | A.14 UC-CAT-02 – Duyệt sản phẩm theo danh mục | — |
| 15 | `png/activity_UC-CAT-03_tim-kiem-san-pham.png` | Activity | UC-CAT-03 | A.15 UC-CAT-03 – Tìm kiếm sản phẩm | — |
| 16 | `png/activity_UC-CAT-04_xem-chi-tiet-san-pham.png` | Activity | UC-CAT-04 | A.16 UC-CAT-04 – Xem chi tiết sản phẩm | — |
| 17 | `png/activity_UC-CAT-05_xem-trang-tinh.png` | Activity | UC-CAT-05 | A.17 UC-CAT-05 – Xem trang tĩnh | — |
| 18 | `png/activity_UC-CAT-06_tim-kiem-san-pham-khong-dau.png` | Activity | UC-CAT-06 | A.18 UC-CAT-06 – Tìm kiếm sản phẩm không dấu | — |
| 19 | `png/activity_UC-CART-01_them-san-pham-vao-gio-hang.png` | Activity | UC-CART-01 | A.19 UC-CART-01 – Thêm sản phẩm vào giỏ hàng | — |
| 20 | `png/activity_UC-CART-02_xem-gio-hang.png` | Activity | UC-CART-02 | A.20 UC-CART-02 – Xem giỏ hàng | — |
| 21 | `png/activity_UC-CART-03_cap-nhat-so-luong-xoa-dong-trong-gio.png` | Activity | UC-CART-03 | A.21 UC-CART-03 – Cập nhật số lượng / xóa dòng trong giỏ | — |
| 22 | `png/activity_UC-CART-04_ap-ma-giam-gia.png` | Activity | UC-CART-04 | A.22 UC-CART-04 – Áp mã giảm giá | có |
| 23 | `png/activity_UC-ORD-01_dat-hang.png` | Activity | UC-ORD-01 | A.23 UC-ORD-01 – Đặt hàng | có |
| 24 | `png/activity_UC-ORD-02_xem-va-theo-doi-don-hang-cua-toi.png` | Activity | UC-ORD-02 | A.24 UC-ORD-02 – Xem và theo dõi đơn hàng của tôi | — |
| 25 | `png/activity_UC-ORD-03_huy-don-hang.png` | Activity | UC-ORD-03 | A.25 UC-ORD-03 – Hủy đơn hàng | có |
| 26 | `png/activity_UC-PAY-01_thanh-toan-don-hang-online.png` | Activity | UC-PAY-01 | A.26 UC-PAY-01 – Thanh toán đơn hàng online | — |
| 27 | `png/activity_UC-PAY-02_nhan-callback-ipn-tu-cong-thanh-toan.png` | Activity | UC-PAY-02 | A.27 UC-PAY-02 – Nhận callback/IPN từ cổng thanh toán | — |
| 28 | `png/activity_UC-PAY-03_thanh-toan-lai-don-chua-thanh-toan.png` | Activity | UC-PAY-03 | A.28 UC-PAY-03 – Thanh toán lại đơn chưa thanh toán | — |
| 29 | `png/activity_UC-REV-01_xem-danh-gia-san-pham.png` | Activity | UC-REV-01 | A.29 UC-REV-01 – Xem đánh giá sản phẩm | — |
| 30 | `png/activity_UC-REV-02_danh-gia-san-pham-da-mua.png` | Activity | UC-REV-02 | A.30 UC-REV-02 – Đánh giá sản phẩm đã mua | — |
| 31 | `png/activity_UC-3D-01_xem-mo-hinh-3d-cua-san-pham.png` | Activity | UC-3D-01 | A.31 UC-3D-01 – Xem mô hình 3D của sản phẩm | — |
| 32 | `png/activity_UC-3D-02_xem-san-pham-bang-ar-dat-vao-khong-gian-that.png` | Activity | UC-3D-02 | A.32 UC-3D-02 – Xem sản phẩm bằng AR (đặt vào không gian thật) | — |
| 33 | `png/activity_UC-3D-04_chup-va-luu-anh-ar.png` | Activity | UC-3D-04 | A.33 UC-3D-04 – Chụp và lưu ảnh AR | — |
| 34 | `png/activity_UC-3D-05_quan-ly-anh-ar-cua-toi-cong-khai-an-xoa.png` | Activity | UC-3D-05 | A.34 UC-3D-05 – Quản lý ảnh AR của tôi (công khai/ẩn/xóa) | — |
| 35 | `png/activity_UC-3D-06_xem-anh-ar-cong-khai-khach-hang-da-trai-nghiem.png` | Activity | UC-3D-06 | A.35 UC-3D-06 – Xem ảnh AR công khai "Khách hàng đã trải nghiệm" | — |
| 36 | `png/activity_UC-SPACE-01_duyet-va-tim-kiem-khong-gian-mau.png` | Activity | UC-SPACE-01 | A.36 UC-SPACE-01 – Duyệt và tìm kiếm không gian mẫu | — |
| 37 | `png/activity_UC-SPACE-02_xem-khong-gian-mau-360.png` | Activity | UC-SPACE-02 | A.37 UC-SPACE-02 – Xem không gian mẫu 360° | — |
| 38 | `png/activity_UC-SPACE-03_bam-diem-san-pham-trong-phong-mau-mua-theo-phong.png` | Activity | UC-SPACE-03 | A.38 UC-SPACE-03 – Bấm điểm sản phẩm trong phòng mẫu (mua theo phong cách phòng) | — |
| 39 | `png/activity_UC-SPACE-04_luu-bo-luu-khong-gian-mau-yeu-thich.png` | Activity | UC-SPACE-04 | A.39 UC-SPACE-04 – Lưu / bỏ lưu không gian mẫu yêu thích | — |
| 40 | `png/activity_UC-ADM-01_quan-ly-nguoi-dung.png` | Activity | UC-ADM-01 | A.40 UC-ADM-01 – Quản lý người dùng | — |
| 41 | `png/activity_UC-ADM-03_quan-ly-cai-dat-he-thong.png` | Activity | UC-ADM-03 | A.41 UC-ADM-03 – Quản lý cài đặt hệ thống | — |
| 42 | `png/activity_UC-ADM-04_quan-ly-media-anh-tep.png` | Activity | UC-ADM-04 | A.42 UC-ADM-04 – Quản lý media (ảnh, tệp) | — |
| 43 | `png/activity_UC-ADM-05_quan-ly-danh-muc-san-pham.png` | Activity | UC-ADM-05 | A.43 UC-ADM-05 – Quản lý danh mục sản phẩm | — |
| 44 | `png/activity_UC-ADM-06_quan-ly-thuong-hieu.png` | Activity | UC-ADM-06 | A.44 UC-ADM-06 – Quản lý thương hiệu | — |
| 45 | `png/activity_UC-ADM-07_quan-ly-trang-tinh.png` | Activity | UC-ADM-07 | A.45 UC-ADM-07 – Quản lý trang tĩnh | — |
| 46 | `png/activity_UC-ADM-08_quan-ly-thuoc-tinh-va-gia-tri-thuoc-tinh.png` | Activity | UC-ADM-08 | A.46 UC-ADM-08 – Quản lý thuộc tính và giá trị thuộc tính | — |
| 47 | `png/activity_UC-ADM-09_quan-ly-san-pham.png` | Activity | UC-ADM-09 | A.47 UC-ADM-09 – Quản lý sản phẩm | — |
| 48 | `png/activity_UC-ADM-10_quan-ly-bien-the-san-pham.png` | Activity | UC-ADM-10 | A.48 UC-ADM-10 – Quản lý biến thể sản phẩm | — |
| 49 | `png/activity_UC-ADM-11_quan-ly-anh-san-pham.png` | Activity | UC-ADM-11 | A.49 UC-ADM-11 – Quản lý ảnh sản phẩm | — |
| 50 | `png/activity_UC-ADM-12_nhap-kho-va-dieu-chinh-ton-kho.png` | Activity | UC-ADM-12 | A.50 UC-ADM-12 – Nhập kho và điều chỉnh tồn kho | — |
| 51 | `png/activity_UC-ADM-13_tai-va-quan-ly-mo-hinh-3d-san-pham.png` | Activity | UC-ADM-13 | A.51 UC-ADM-13 – Tải và quản lý mô hình 3D sản phẩm | — |
| 52 | `png/activity_UC-ADM-15_quan-ly-khong-gian-mau-va-anh-360.png` | Activity | UC-ADM-15 | A.52 UC-ADM-15 – Quản lý không gian mẫu và ảnh 360° | — |
| 53 | `png/activity_UC-ADM-16_quan-ly-diem-tuong-tac-hotspot-tren-anh-360.png` | Activity | UC-ADM-16 | A.53 UC-ADM-16 – Quản lý điểm tương tác (hotspot) trên ảnh 360° | — |
| 54 | `png/activity_UC-ADM-18_duyet-hoac-tu-choi-danh-gia.png` | Activity | UC-ADM-18 | A.54 UC-ADM-18 – Duyệt hoặc từ chối đánh giá | — |
| 55 | `png/activity_UC-ADM-19_quan-ly-ma-giam-gia.png` | Activity | UC-ADM-19 | A.55 UC-ADM-19 – Quản lý mã giảm giá | — |
| 56 | `png/activity_UC-ADM-20_xem-danh-sach-va-chi-tiet-don-hang.png` | Activity | UC-ADM-20 | A.56 UC-ADM-20 – Xem danh sách và chi tiết đơn hàng | — |
| 57 | `png/activity_UC-ADM-21_cap-nhat-trang-thai-don-hang.png` | Activity | UC-ADM-21 | A.57 UC-ADM-21 – Cập nhật trạng thái đơn hàng | có |
| 58 | `png/activity_UC-ADM-22_huy-don-hang-quan-tri.png` | Activity | UC-ADM-22 | A.58 UC-ADM-22 – Hủy đơn hàng (quản trị) | có |
| 59 | `png/activity_UC-ADM-23_hoan-tien-thu-cong.png` | Activity | UC-ADM-23 | A.59 UC-ADM-23 – Hoàn tiền thủ công | — |
| 60 | `png/activity_UC-ADM-24_quan-ly-thanh-toan-xac-nhan-chuyen-khoan.png` | Activity | UC-ADM-24 | A.60 UC-ADM-24 – Quản lý thanh toán (xác nhận chuyển khoản) | — |
| 61 | `png/activity_UC-ADM-25_quan-ly-van-chuyen.png` | Activity | UC-ADM-25 | A.61 UC-ADM-25 – Quản lý vận chuyển | có |

## A.3. Mô hình tuần tự – Sequence Diagram (mục 4)

| Thứ tự | Tên ảnh | Loại sơ đồ | Mã UC | Mục trong báo cáo | SVG |
| --- | --- | --- | --- | --- | --- |
| 1 | `png/sequence_UC-AUTH-01_dang-ky-tai-khoan.png` | Sequence | UC-AUTH-01 | S.1 UC-AUTH-01 – Đăng ký tài khoản | — |
| 2 | `png/sequence_UC-AUTH-02_dang-nhap.png` | Sequence | UC-AUTH-02 | S.2 UC-AUTH-02 – Đăng nhập | — |
| 3 | `png/sequence_UC-AUTH-03_lam-moi-access-token.png` | Sequence | UC-AUTH-03 | S.3 UC-AUTH-03 – Làm mới access token | — |
| 4 | `png/sequence_UC-AUTH-04_dang-xuat.png` | Sequence | UC-AUTH-04 | S.4 UC-AUTH-04 – Đăng xuất | — |
| 5 | `png/sequence_UC-AUTH-05_quen-mat-khau-yeu-cau-dat-lai.png` | Sequence | UC-AUTH-05 | S.5 UC-AUTH-05 – Quên mật khẩu (yêu cầu đặt lại) | — |
| 6 | `png/sequence_UC-AUTH-06_dat-lai-mat-khau.png` | Sequence | UC-AUTH-06 | S.6 UC-AUTH-06 – Đặt lại mật khẩu | — |
| 7 | `png/sequence_UC-AUTH-07_xac-thuc-email.png` | Sequence | UC-AUTH-07 | S.7 UC-AUTH-07 – Xác thực email | — |
| 8 | `png/sequence_UC-ACC-01_xem-va-cap-nhat-ho-so-ca-nhan.png` | Sequence | UC-ACC-01 | S.8 UC-ACC-01 – Xem và cập nhật hồ sơ cá nhân | — |
| 9 | `png/sequence_UC-ACC-02_doi-mat-khau.png` | Sequence | UC-ACC-02 | S.9 UC-ACC-02 – Đổi mật khẩu | — |
| 10 | `png/sequence_UC-ACC-04_quan-ly-so-dia-chi-giao-hang.png` | Sequence | UC-ACC-04 | S.10 UC-ACC-04 – Quản lý sổ địa chỉ giao hàng | — |
| 11 | `png/sequence_UC-ACC-05_xem-va-danh-dau-da-doc-thong-bao.png` | Sequence | UC-ACC-05 | S.11 UC-ACC-05 – Xem và đánh dấu đã đọc thông báo | — |
| 12 | `png/sequence_UC-ACC-06_quan-ly-danh-sach-yeu-thich.png` | Sequence | UC-ACC-06 | S.12 UC-ACC-06 – Quản lý danh sách yêu thích | — |
| 13 | `png/sequence_UC-CAT-01_xem-trang-chu.png` | Sequence | UC-CAT-01 | S.13 UC-CAT-01 – Xem trang chủ | — |
| 14 | `png/sequence_UC-CAT-02_duyet-san-pham-theo-danh-muc.png` | Sequence | UC-CAT-02 | S.14 UC-CAT-02 – Duyệt sản phẩm theo danh mục | — |
| 15 | `png/sequence_UC-CAT-03_tim-kiem-san-pham.png` | Sequence | UC-CAT-03 | S.15 UC-CAT-03 – Tìm kiếm sản phẩm | — |
| 16 | `png/sequence_UC-CAT-04_xem-chi-tiet-san-pham.png` | Sequence | UC-CAT-04 | S.16 UC-CAT-04 – Xem chi tiết sản phẩm | — |
| 17 | `png/sequence_UC-CAT-05_xem-trang-tinh.png` | Sequence | UC-CAT-05 | S.17 UC-CAT-05 – Xem trang tĩnh | — |
| 18 | `png/sequence_UC-CAT-06_tim-kiem-san-pham-khong-dau.png` | Sequence | UC-CAT-06 | S.18 UC-CAT-06 – Tìm kiếm sản phẩm không dấu | — |
| 19 | `png/sequence_UC-CART-01_them-san-pham-vao-gio-hang.png` | Sequence | UC-CART-01 | S.19 UC-CART-01 – Thêm sản phẩm vào giỏ hàng | — |
| 20 | `png/sequence_UC-CART-02_xem-gio-hang.png` | Sequence | UC-CART-02 | S.20 UC-CART-02 – Xem giỏ hàng | — |
| 21 | `png/sequence_UC-CART-03_cap-nhat-so-luong-xoa-dong-trong-gio.png` | Sequence | UC-CART-03 | S.21 UC-CART-03 – Cập nhật số lượng / xóa dòng trong giỏ | — |
| 22 | `png/sequence_UC-CART-04_ap-ma-giam-gia.png` | Sequence | UC-CART-04 | S.22 UC-CART-04 – Áp mã giảm giá | có |
| 23 | `png/sequence_UC-ORD-01_dat-hang.png` | Sequence | UC-ORD-01 | S.23 UC-ORD-01 – Đặt hàng | có |
| 24 | `png/sequence_UC-ORD-02_xem-va-theo-doi-don-hang-cua-toi.png` | Sequence | UC-ORD-02 | S.24 UC-ORD-02 – Xem và theo dõi đơn hàng của tôi | — |
| 25 | `png/sequence_UC-ORD-03_huy-don-hang.png` | Sequence | UC-ORD-03 | S.25 UC-ORD-03 – Hủy đơn hàng | có |
| 26 | `png/sequence_UC-PAY-01_thanh-toan-don-hang-online.png` | Sequence | UC-PAY-01 | S.26 UC-PAY-01 – Thanh toán đơn hàng online | — |
| 27 | `png/sequence_UC-PAY-02_nhan-callback-ipn-tu-cong-thanh-toan.png` | Sequence | UC-PAY-02 | S.27 UC-PAY-02 – Nhận callback/IPN từ cổng thanh toán | — |
| 28 | `png/sequence_UC-PAY-03_thanh-toan-lai-don-chua-thanh-toan.png` | Sequence | UC-PAY-03 | S.28 UC-PAY-03 – Thanh toán lại đơn chưa thanh toán | — |
| 29 | `png/sequence_UC-REV-01_xem-danh-gia-san-pham.png` | Sequence | UC-REV-01 | S.29 UC-REV-01 – Xem đánh giá sản phẩm | — |
| 30 | `png/sequence_UC-REV-02_danh-gia-san-pham-da-mua.png` | Sequence | UC-REV-02 | S.30 UC-REV-02 – Đánh giá sản phẩm đã mua | — |
| 31 | `png/sequence_UC-3D-01_xem-mo-hinh-3d-cua-san-pham.png` | Sequence | UC-3D-01 | S.31 UC-3D-01 – Xem mô hình 3D của sản phẩm | — |
| 32 | `png/sequence_UC-3D-02_xem-san-pham-bang-ar-dat-vao-khong-gian-that.png` | Sequence | UC-3D-02 | S.32 UC-3D-02 – Xem sản phẩm bằng AR (đặt vào không gian thật) | — |
| 33 | `png/sequence_UC-3D-04_chup-va-luu-anh-ar.png` | Sequence | UC-3D-04 | S.33 UC-3D-04 – Chụp và lưu ảnh AR | — |
| 34 | `png/sequence_UC-3D-05_quan-ly-anh-ar-cua-toi-cong-khai-an-xoa.png` | Sequence | UC-3D-05 | S.34 UC-3D-05 – Quản lý ảnh AR của tôi (công khai/ẩn/xóa) | — |
| 35 | `png/sequence_UC-3D-06_xem-anh-ar-cong-khai-khach-hang-da-trai-nghiem.png` | Sequence | UC-3D-06 | S.35 UC-3D-06 – Xem ảnh AR công khai "Khách hàng đã trải nghiệm" | — |
| 36 | `png/sequence_UC-SPACE-01_duyet-va-tim-kiem-khong-gian-mau.png` | Sequence | UC-SPACE-01 | S.36 UC-SPACE-01 – Duyệt và tìm kiếm không gian mẫu | — |
| 37 | `png/sequence_UC-SPACE-02_xem-khong-gian-mau-360.png` | Sequence | UC-SPACE-02 | S.37 UC-SPACE-02 – Xem không gian mẫu 360° | — |
| 38 | `png/sequence_UC-SPACE-03_bam-diem-san-pham-trong-phong-mau-mua-theo-phong.png` | Sequence | UC-SPACE-03 | S.38 UC-SPACE-03 – Bấm điểm sản phẩm trong phòng mẫu (mua theo phong cách phòng) | — |
| 39 | `png/sequence_UC-SPACE-04_luu-bo-luu-khong-gian-mau-yeu-thich.png` | Sequence | UC-SPACE-04 | S.39 UC-SPACE-04 – Lưu / bỏ lưu không gian mẫu yêu thích | — |
| 40 | `png/sequence_UC-ADM-01_quan-ly-nguoi-dung.png` | Sequence | UC-ADM-01 | S.40 UC-ADM-01 – Quản lý người dùng | — |
| 41 | `png/sequence_UC-ADM-03_quan-ly-cai-dat-he-thong.png` | Sequence | UC-ADM-03 | S.41 UC-ADM-03 – Quản lý cài đặt hệ thống | — |
| 42 | `png/sequence_UC-ADM-04_quan-ly-media-anh-tep.png` | Sequence | UC-ADM-04 | S.42 UC-ADM-04 – Quản lý media (ảnh, tệp) | — |
| 43 | `png/sequence_UC-ADM-05_quan-ly-danh-muc-san-pham.png` | Sequence | UC-ADM-05 | S.43 UC-ADM-05 – Quản lý danh mục sản phẩm | — |
| 44 | `png/sequence_UC-ADM-06_quan-ly-thuong-hieu.png` | Sequence | UC-ADM-06 | S.44 UC-ADM-06 – Quản lý thương hiệu | — |
| 45 | `png/sequence_UC-ADM-07_quan-ly-trang-tinh.png` | Sequence | UC-ADM-07 | S.45 UC-ADM-07 – Quản lý trang tĩnh | — |
| 46 | `png/sequence_UC-ADM-08_quan-ly-thuoc-tinh-va-gia-tri-thuoc-tinh.png` | Sequence | UC-ADM-08 | S.46 UC-ADM-08 – Quản lý thuộc tính và giá trị thuộc tính | — |
| 47 | `png/sequence_UC-ADM-09_quan-ly-san-pham.png` | Sequence | UC-ADM-09 | S.47 UC-ADM-09 – Quản lý sản phẩm | — |
| 48 | `png/sequence_UC-ADM-10_quan-ly-bien-the-san-pham.png` | Sequence | UC-ADM-10 | S.48 UC-ADM-10 – Quản lý biến thể sản phẩm | — |
| 49 | `png/sequence_UC-ADM-11_quan-ly-anh-san-pham.png` | Sequence | UC-ADM-11 | S.49 UC-ADM-11 – Quản lý ảnh sản phẩm | — |
| 50 | `png/sequence_UC-ADM-12_nhap-kho-va-dieu-chinh-ton-kho.png` | Sequence | UC-ADM-12 | S.50 UC-ADM-12 – Nhập kho và điều chỉnh tồn kho | — |
| 51 | `png/sequence_UC-ADM-13_tai-va-quan-ly-mo-hinh-3d-san-pham.png` | Sequence | UC-ADM-13 | S.51 UC-ADM-13 – Tải và quản lý mô hình 3D sản phẩm | có |
| 52 | `png/sequence_UC-ADM-15_quan-ly-khong-gian-mau-va-anh-360.png` | Sequence | UC-ADM-15 | S.52 UC-ADM-15 – Quản lý không gian mẫu và ảnh 360° | — |
| 53 | `png/sequence_UC-ADM-16_quan-ly-diem-tuong-tac-hotspot-tren-anh-360.png` | Sequence | UC-ADM-16 | S.53 UC-ADM-16 – Quản lý điểm tương tác (hotspot) trên ảnh 360° | — |
| 54 | `png/sequence_UC-ADM-18_duyet-hoac-tu-choi-danh-gia.png` | Sequence | UC-ADM-18 | S.54 UC-ADM-18 – Duyệt hoặc từ chối đánh giá | — |
| 55 | `png/sequence_UC-ADM-19_quan-ly-ma-giam-gia.png` | Sequence | UC-ADM-19 | S.55 UC-ADM-19 – Quản lý mã giảm giá | — |
| 56 | `png/sequence_UC-ADM-20_xem-danh-sach-va-chi-tiet-don-hang.png` | Sequence | UC-ADM-20 | S.56 UC-ADM-20 – Xem danh sách và chi tiết đơn hàng | — |
| 57 | `png/sequence_UC-ADM-21_cap-nhat-trang-thai-don-hang.png` | Sequence | UC-ADM-21 | S.57 UC-ADM-21 – Cập nhật trạng thái đơn hàng | có |
| 58 | `png/sequence_UC-ADM-22_huy-don-hang-quan-tri.png` | Sequence | UC-ADM-22 | S.58 UC-ADM-22 – Hủy đơn hàng (quản trị) | có |
| 59 | `png/sequence_UC-ADM-23_hoan-tien-thu-cong.png` | Sequence | UC-ADM-23 | S.59 UC-ADM-23 – Hoàn tiền thủ công | — |
| 60 | `png/sequence_UC-ADM-24_quan-ly-thanh-toan-xac-nhan-chuyen-khoan.png` | Sequence | UC-ADM-24 | S.60 UC-ADM-24 – Quản lý thanh toán (xác nhận chuyển khoản) | — |
| 61 | `png/sequence_UC-ADM-25_quan-ly-van-chuyen.png` | Sequence | UC-ADM-25 | S.61 UC-ADM-25 – Quản lý vận chuyển | có |

## A.4. Mô hình quan hệ dữ liệu hướng đối tượng – Class Diagram (mục 5)

| Thứ tự | Tên ảnh | Loại sơ đồ | Mã UC | Mục trong báo cáo | SVG |
| --- | --- | --- | --- | --- | --- |
| 1 | `png/class_tong-quan.png` | Class | — | 5.1. Sơ đồ tổng quan (chỉ tên class và quan hệ) | có |
| 2 | `png/class_nhom-1-nguoi-dung-va-phan-quyen.png` | Class | — | 5.2. Nhóm 1 – Người dùng và phân quyền | có |
| 3 | `png/class_nhom-2-he-thong-chung.png` | Class | — | 5.3. Nhóm 2 – Hệ thống chung | có |
| 4 | `png/class_nhom-3-noi-dung.png` | Class | — | 5.4. Nhóm 3 – Nội dung | có |
| 5 | `png/class_nhom-4-san-pham.png` | Class | — | 5.5. Nhóm 4 – Sản phẩm | có |
| 6 | `png/class_nhom-5-mo-hinh-3d-va-ar.png` | Class | — | 5.6. Nhóm 5 – Mô hình 3D và AR | có |
| 7 | `png/class_nhom-6-gio-hang-va-don-hang.png` | Class | — | 5.7. Nhóm 6 – Giỏ hàng và đơn hàng | có |
| 8 | `png/class_nhom-7-khong-gian-mau.png` | Class | — | 5.8. Nhóm 7 – Không gian mẫu | có |

# Phần B – Đặc tả chức năng theo vai trò (`docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`)

## B.1. Sơ đồ use case (mục 5)

| Thứ tự | Tên ảnh | Loại sơ đồ | Mã UC | Mục trong báo cáo | SVG |
| --- | --- | --- | --- | --- | --- |
| 1 | `png/usecase_tong-quat.png` | Use case | — | 5.1. Sơ đồ tổng quát (theo nhóm chức năng) | có |
| 2 | `png/usecase_khach-vang-lai.png` | Use case | — | 5.2. Khách vãng lai | có |
| 3 | `png/usecase_nguoi-dung.png` | Use case | — | 5.3. Người dùng (chức năng riêng, ngoài các chức năng kế thừa từ Khách) | có |
| 4 | `png/usecase_quan-tri-1-he-thong-catalog.png` | Use case | — | 5.4. Quản trị viên: hệ thống, catalog, kho, 3D | có |
| 5 | `png/usecase_quan-tri-2-noi-dung-don-hang.png` | Use case | — | 5.5. Quản trị viên: nội dung, đơn hàng, thống kê | có |

## B.2. Sơ đồ vòng đời trạng thái (mục 10)

| Thứ tự | Tên ảnh | Loại sơ đồ | Mã UC | Mục trong báo cáo | SVG |
| --- | --- | --- | --- | --- | --- |
| 1 | `png/state_user.png` | Trạng thái | — | 10.1. User (`UserStatus`) | — |
| 2 | `png/state_order.png` | Trạng thái | — | 10.2. Order (`OrderStatus`) | — |
| 3 | `png/state_payment-va-order-paymentstatus.png` | Trạng thái | — | 10.3. Payment (`PaymentTxnStatus`) và Order.paymentStatus (`OrderPaymentStatus`) | — |
| 4 | `png/state_order-payment-status.png` | Trạng thái | — | 10.3. Payment (`PaymentTxnStatus`) và Order.paymentStatus (`OrderPaymentStatus`) | — |
| 5 | `png/state_shipment.png` | Trạng thái | — | 10.4. Shipment (`ShipmentStatus`) | — |
| 6 | `png/state_review.png` | Trạng thái | — | 10.5. Review (`ReviewStatus`) | — |
| 7 | `png/state_page-va-space.png` | Trạng thái | — | 10.6. Page và Space (`ContentStatus`) | — |
| 8 | `png/state_product3dmodel.png` | Trạng thái | — | 10.7. Product3DModel (`ModelStatus`) | — |
