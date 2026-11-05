# Báo cáo giữa kì 1: Aurelia Living

Website thương mại điện tử nội thất có xem sản phẩm 3D, thực tế tăng cường (AR), không gian mẫu 360° và ứng dụng Android.

Nội dung dưới đây chia thành 4 slide, mỗi slide một phần của yêu cầu.

---

## Slide 1. Chức năng chính

### **80 use case**, chia thành 7 nhóm chức năng

```mermaid
flowchart TB
    T(["80 USE CASE"])
    T --- G1
    T --- G2
    T --- G3
    T --- G4
    T --- G5
    T --- G6
    T --- G7
    G1["<b>1. Xác thực và tài khoản</b><br>14 use case<br>Đăng ký, đăng nhập, hồ sơ, địa chỉ, thông báo, yêu thích"]
    G2["<b>2. Danh mục, sản phẩm, đánh giá</b><br>9 use case<br>Duyệt, tìm kiếm, chi tiết, đánh giá"]
    G3["<b>3. Giỏ hàng, đơn hàng, thanh toán</b><br>10 use case<br>Giỏ, mã giảm giá, đặt hàng, thanh toán"]
    G4["<b>4. Xem 3D và AR</b><br>7 use case<br>Xem 3D, đổi chất liệu, AR, chụp ảnh AR"]
    G5["<b>5. Không gian mẫu 360°</b><br>6 use case<br>Tham quan 360°, điểm bấm, đặt sản phẩm 3D"]
    G6["<b>6. Ứng dụng Android</b><br>4 use case<br>Xem sản phẩm, camera với overlay, chụp ảnh ghép"]
    G7["<b>7. Quản trị</b><br>30 use case<br>Sản phẩm, kho, 3D, đơn hàng, vận chuyển, thống kê"]
```

| Nhóm | Số use case |
| --- | --- |
| 1. Xác thực và tài khoản | 14 |
| 2. Danh mục, sản phẩm, đánh giá | 9 |
| 3. Giỏ hàng, đơn hàng, thanh toán | 10 |
| 4. Xem 3D và AR | 7 |
| 5. Không gian mẫu 360° | 6 |
| 6. Ứng dụng Android | 4 |
| 7. Quản trị | 30 |
| **Tổng** | **80** |

**Ba tác nhân:** Khách vãng lai (chỉ xem), Người dùng (đăng nhập, mua hàng), Quản trị viên.

Sơ đồ use case tổng quát đầy đủ: `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`, mục 5.1.

---

## Slide 2. Kiến trúc hệ thống

![Kiến trúc hệ thống Aurelia Living](diagrams/png/architecture_kien-truc-he-thong.png)

Bản vector (phóng to không vỡ): `docs/diagrams/svg/architecture_kien-truc-he-thong.svg`.

**Cách đọc nhanh sơ đồ:**

- **Máy khách:** trình duyệt (web Next.js) và điện thoại Android (Kotlin).
- **API (NestJS):** nhận yêu cầu qua bộ bảo vệ (giới hạn tốc độ, xác thực JWT, phân quyền), xử lý nghiệp vụ trong Service rồi ghi dữ liệu.
- **Cơ sở dữ liệu:** PostgreSQL (44 bảng).
- **Lưu trữ tệp:** MinIO (S3) với hai bucket public và private; trình duyệt tải mô hình 3D và ảnh 360° lên trực tiếp bằng đường dẫn có chữ ký (presigned URL).
- **Hàng đợi và cache:** Redis. Bốn hàng đợi `model-processing`, `image-processing`, `mail`, `notification` và một worker chạy cùng tiến trình API; Redis còn lưu cache và bộ đếm giới hạn tốc độ.
- **Hệ thống ngoài:** cổng thanh toán (VNPay sandbox), đơn vị vận chuyển, máy chủ email (SMTP).

---

## Slide 3. Công nghệ sử dụng

| Web | Backend | Mobile (Android) |
| --- | --- | --- |
| **Next.js** (React) | **NestJS** (Node.js) | **Kotlin** |
| **TypeScript** | **PostgreSQL** + Prisma | **Jetpack Compose** |
| **Tailwind CSS** | **Redis** + BullMQ (hàng đợi) | **CameraX** (camera) |
| **Three.js** + React Three Fiber (xem 3D) | **MinIO / S3** (lưu tệp) | **Retrofit** (gọi API) |
| **model-viewer** (AR) | **JWT** (xác thực) | **Hilt** (khởi tạo phụ thuộc) |
| **TanStack Query** (gọi API) | **Docker** (môi trường chạy) | **Coil** (tải ảnh) |

---

## Slide 4. Luồng nghiệp vụ tiêu biểu: xem sản phẩm 3D/AR rồi đặt hàng

Luồng này thể hiện điểm đặc biệt của đề tài: khách xem sản phẩm 3D, đặt thử vào không gian thật bằng AR rồi mới quyết định mua.

```mermaid
flowchart TB
    subgraph P1["Giai đoạn 1: Trải nghiệm 3D và AR (khách vãng lai cũng dùng được)"]
        A1["Khách mở chi tiết sản phẩm"] --> A2["Xem mô hình 3D<br>xoay, phóng to, đổi màu hoặc chất liệu"]
        A2 --> A3["Bấm 'Xem trong không gian của bạn'<br>iPhone: Quick Look (USDZ)<br>Android: Scene Viewer (GLB)<br>Web: WebXR"]
        A3 --> A4["Đặt sản phẩm vào phòng thật<br>đúng kích thước thật"]
        A4 --> A5["Chụp ảnh AR<br>(cần đăng nhập)"]
    end
    subgraph P2["Giai đoạn 2: Mua hàng (cần đăng nhập)"]
        B1["Thêm biến thể vào giỏ hàng"] --> B2["Áp mã giảm giá<br>(tùy chọn)"]
        B2 --> B3["Đặt hàng<br>một transaction: trừ kho, tạo đơn,<br>ghi mã giảm giá, tạo thông báo"]
        B3 --> B4["Thanh toán<br>COD, chuyển khoản hoặc VNPay"]
        B4 --> B5["Admin xử lý và giao hàng<br>đơn hoàn tất"]
        B5 --> B6["Khách đánh giá sản phẩm đã mua"]
    end
    A4 --> B1
    A5 --> B1
```

**Điểm nhấn khi trình bày:**

- Tệp 3D được xử lý nền khi admin tải lên: kiểm tra, sinh nhiều mức chi tiết (LOD), nén; thiết bị yếu tải mức nhẹ.
- Hệ thống chọn tệp phù hợp theo thiết bị: USDZ cho iPhone, GLB cho Android và web, kèm kích thước thật để AR hiển thị đúng tỉ lệ.
- Đặt hàng là một giao dịch duy nhất, nên tồn kho, đơn hàng, mã giảm giá và thông báo luôn nhất quán.

Sơ đồ chi tiết từng bước: `docs/BAO_CAO_PHAN_TICH_THIET_KE.md` (UC-3D-01, UC-3D-02, UC-ORD-01, UC-PAY-01).
