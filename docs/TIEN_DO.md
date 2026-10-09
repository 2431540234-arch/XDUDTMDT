# Tiến độ triển khai

Cập nhật: 2026-10-09 (sau cấu hình môi trường và đồng bộ tài liệu). Nguồn số liệu: `docs/MODULE_ENV_REPORT.md` (14 module backend/web) cộng M15 Mobile theo quyết định D-P06: 15 module, 80 UC, 144 API, 44 bảng, `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`.

Quy ước trạng thái: **Chưa làm** · **Đang làm** · **Xong BE** · **Xong FE** · **Đã test** (đã có test tự động cho luồng chính). Khung rỗng (module/controller/service chỉ có comment) tính là **Chưa làm**.

## 1. Tổng quan

- UC: 80, **Xong BE: 0**, **Đang làm: 2**, **Chưa làm: 78**.
- Nền tảng dùng chung đã xong và có test: response/lỗi chuẩn, guard JWT + roles, Prisma, `StorageService` (local, MinIO, S3), `MailService` (qua queue `mail`), `ActivityLogService`, `CacheService`, BullMQ + Redis (4 queue), giới hạn tốc độ (nhóm `default`, `auth`), Swagger, Bull Board, `/health` mở rộng. Số endpoint: **144 theo thiết kế, 6 đã cài** (`GET /health`, 3 route media, 2 route mô hình 3D).
- Frontend: toàn bộ trang và component còn là khung rỗng (trừ trang chủ); Tailwind, Provider TanStack Query, model-viewer, Vitest, Playwright đã cấu hình, `next build` qua. Mobile: `assembleDebug` thành công, khung rỗng.

## 2. Bảng module

| STT | Module | UC | API | Bảng | BE | FE | Test | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M01 | Hệ thống và cấu hình | 2 | 4 | 2 | Đang làm | Chưa làm | e2e health + guard (`health.e2e-spec.ts`, `infra.e2e-spec.ts`); unit `CacheService` | Nền tảng xong: `GET /health` (database, redis, storage, smtp, queues), `ActivityLogService`, `CacheService` (chưa module nào gọi). Chưa có endpoint settings và nhật ký. |
| M02 | Xác thực và phiên | 7 | 8 | 3 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M03 | Tài khoản cá nhân | 7 | 17 | 2 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M04 | Người dùng và phân quyền (admin) | 2 | 7 | 4 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M05 | Media và lưu trữ tệp | 1 | 6 | 1 | Đang làm | Chưa làm | e2e (`storage-jobs.e2e-spec.ts`); unit `MinioStorageService` | Xong: tải ảnh multipart, presign/confirm panorama, job `image-processing` (webp + thumbnail). Chưa: danh sách, sửa, xóa media; ghi nhật ký. |
| M06 | Danh mục, thương hiệu, thuộc tính, trang tĩnh | 5 | 18 | 5 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M07 | Sản phẩm, biến thể, tồn kho | 9 | 19 | 5 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M08 | Giỏ hàng và mã giảm giá | 5 | 10 | 4 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M09 | Đơn hàng | 6 | 10 | 3 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M10 | Thanh toán và vận chuyển | 6 | 7 | 2 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M11 | Đánh giá sản phẩm | 4 | 4 | 1 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M12 | Mô hình 3D và AR | 10 | 14 | 5 | Đang làm | Chưa làm | e2e (`storage-jobs.e2e-spec.ts`): GLB hợp lệ, GLB hỏng, USDZ | Xong: presign/confirm tệp mô hình, job `model-processing` (kiểm tra GLB, LOD, checksum, USDZ). Chưa: CRUD mô hình, mô hình chính, biến thể chất liệu, xem 3D/AR, ảnh AR, thống kê phiên. |
| M13 | Không gian mẫu 360° | 9 | 16 | 6 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M14 | Thông báo và thống kê quản trị | 3 | 4 | 1 | Chưa làm | Chưa làm | Chưa có | Khung module/controller/service rỗng (có comment mã UC). |
| M15 | Ứng dụng Android (Mobile) | 4 | 0 | 0 | Chưa làm | Chưa làm | Chưa có | Môi trường xong: `./gradlew assembleDebug` thành công (Hilt 2.59.2, CameraX 1.5.3, navigation, DataStore, `BuildConfig.API_BASE_URL`, HTTP chỉ ở bản debug); `MainActivity` chỉ hiện tên ứng dụng, 39 file Kotlin còn lại là khung rỗng; chưa xác nhận chạy trên máy ảo. Làm SAU M07 (và M12 nếu kịp). Không thêm API: dùng API công khai của M06/M07. Chờ chọn nơi lưu ảnh overlay (O-06). |
| | **Tổng** | **80** | **144** | **44** | | | | |

## 3. Bảng use case

| UC | Tên | Module | Trạng thái | Ghi chú |
| --- | --- | --- | --- | --- |
| UC-ADM-03 | Quản lý cài đặt hệ thống | M01 | Chưa làm |  |
| UC-ADM-27 | Xem nhật ký hoạt động của quản trị viên | M01 | Chưa làm |  |
| UC-AUTH-01 | Đăng ký tài khoản | M02 | Chưa làm |  |
| UC-AUTH-02 | Đăng nhập | M02 | Chưa làm |  |
| UC-AUTH-03 | Làm mới access token | M02 | Chưa làm |  |
| UC-AUTH-04 | Đăng xuất | M02 | Chưa làm |  |
| UC-AUTH-05 | Quên mật khẩu (yêu cầu đặt lại) | M02 | Chưa làm |  |
| UC-AUTH-06 | Đặt lại mật khẩu | M02 | Chưa làm |  |
| UC-AUTH-07 | Xác thực email | M02 | Chưa làm |  |
| UC-ACC-01 | Xem và cập nhật hồ sơ cá nhân | M03 | Chưa làm |  |
| UC-ACC-02 | Đổi mật khẩu | M03 | Chưa làm |  |
| UC-ACC-03 | Quản lý phiên đăng nhập (đăng xuất từ xa) | M03 | Chưa làm |  |
| UC-ACC-04 | Quản lý sổ địa chỉ giao hàng | M03 | Chưa làm |  |
| UC-ACC-05 | Xem và đánh dấu đã đọc thông báo | M03 | Chưa làm |  |
| UC-ACC-06 | Quản lý danh sách yêu thích | M03 | Chưa làm |  |
| UC-ACC-07 | Yêu cầu xóa tài khoản (xóa mềm) | M03 | Chưa làm |  |
| UC-ADM-01 | Quản lý người dùng | M04 | Chưa làm |  |
| UC-ADM-02 | Quản lý vai trò và phân quyền | M04 | Chưa làm |  |
| UC-ADM-04 | Quản lý media (ảnh, tệp) | M05 | Đang làm | BE: `POST /admin/media`, `presign`, `confirm`; còn list/sửa/xóa |
| UC-ADM-05 | Quản lý danh mục sản phẩm | M06 | Chưa làm |  |
| UC-ADM-06 | Quản lý thương hiệu | M06 | Chưa làm |  |
| UC-ADM-07 | Quản lý trang tĩnh | M06 | Chưa làm |  |
| UC-ADM-08 | Quản lý thuộc tính và giá trị thuộc tính | M06 | Chưa làm |  |
| UC-CAT-05 | Xem trang tĩnh | M06 | Chưa làm |  |
| UC-ADM-09 | Quản lý sản phẩm | M07 | Chưa làm |  |
| UC-ADM-10 | Quản lý biến thể sản phẩm | M07 | Chưa làm |  |
| UC-ADM-11 | Quản lý ảnh sản phẩm | M07 | Chưa làm |  |
| UC-ADM-12 | Nhập kho và điều chỉnh tồn kho | M07 | Chưa làm |  |
| UC-CAT-01 | Xem trang chủ | M07 | Chưa làm |  |
| UC-CAT-02 | Duyệt sản phẩm theo danh mục | M07 | Chưa làm |  |
| UC-CAT-03 | Tìm kiếm sản phẩm | M07 | Chưa làm |  |
| UC-CAT-04 | Xem chi tiết sản phẩm | M07 | Chưa làm |  |
| UC-CAT-06 | Tìm kiếm sản phẩm không dấu | M07 | Chưa làm |  |
| UC-ADM-19 | Quản lý mã giảm giá | M08 | Chưa làm |  |
| UC-CART-01 | Thêm sản phẩm vào giỏ hàng | M08 | Chưa làm |  |
| UC-CART-02 | Xem giỏ hàng | M08 | Chưa làm |  |
| UC-CART-03 | Cập nhật số lượng / xóa dòng trong giỏ | M08 | Chưa làm |  |
| UC-CART-04 | Áp mã giảm giá | M08 | Chưa làm |  |
| UC-ADM-20 | Xem danh sách và chi tiết đơn hàng | M09 | Chưa làm |  |
| UC-ADM-21 | Cập nhật trạng thái đơn hàng | M09 | Chưa làm |  |
| UC-ADM-22 | Hủy đơn hàng (quản trị) | M09 | Chưa làm |  |
| UC-ORD-01 | Đặt hàng | M09 | Chưa làm |  |
| UC-ORD-02 | Xem và theo dõi đơn hàng của tôi | M09 | Chưa làm |  |
| UC-ORD-03 | Hủy đơn hàng | M09 | Chưa làm |  |
| UC-ADM-23 | Hoàn tiền thủ công | M10 | Chưa làm |  |
| UC-ADM-24 | Quản lý thanh toán (xác nhận chuyển khoản) | M10 | Chưa làm |  |
| UC-ADM-25 | Quản lý vận chuyển | M10 | Chưa làm |  |
| UC-PAY-01 | Thanh toán đơn hàng online | M10 | Chưa làm |  |
| UC-PAY-02 | Nhận callback/IPN từ cổng thanh toán | M10 | Chưa làm |  |
| UC-PAY-03 | Thanh toán lại đơn chưa thanh toán | M10 | Chưa làm |  |
| UC-ADM-18 | Duyệt hoặc từ chối đánh giá | M11 | Chưa làm |  |
| UC-REV-01 | Xem đánh giá sản phẩm | M11 | Chưa làm |  |
| UC-REV-02 | Đánh giá sản phẩm đã mua | M11 | Chưa làm |  |
| UC-REV-03 | Sửa/xóa đánh giá của mình | M11 | Chưa làm |  |
| UC-3D-01 | Xem mô hình 3D của sản phẩm | M12 | Chưa làm |  |
| UC-3D-02 | Xem sản phẩm bằng AR (đặt vào không gian thật) | M12 | Chưa làm |  |
| UC-3D-03 | Đổi màu/chất liệu trên mô hình 3D | M12 | Chưa làm |  |
| UC-3D-04 | Chụp và lưu ảnh AR | M12 | Chưa làm |  |
| UC-3D-05 | Quản lý ảnh AR của tôi (công khai/ẩn/xóa) | M12 | Chưa làm |  |
| UC-3D-06 | Xem ảnh AR công khai "Khách hàng đã trải nghiệm" | M12 | Chưa làm |  |
| UC-3D-07 | Ghi nhận thống kê phiên 3D/AR (ẩn danh) | M12 | Chưa làm |  |
| UC-ADM-13 | Tải và quản lý mô hình 3D sản phẩm | M12 | Đang làm | BE: `presign`, `confirm`, job `model-processing`; còn tạo mô hình, mô hình chính, reprocess |
| UC-ADM-14 | Cấu hình biến thể chất liệu cho mô hình 3D | M12 | Chưa làm |  |
| UC-ADM-30 | Gỡ ảnh AR công khai không phù hợp | M12 | Chưa làm |  |
| UC-ADM-15 | Quản lý không gian mẫu và ảnh 360° | M13 | Chưa làm |  |
| UC-ADM-16 | Quản lý điểm tương tác (hotspot) trên ảnh 360° | M13 | Chưa làm |  |
| UC-ADM-17 | Đặt mô hình 3D sản phẩm vào ảnh 360° (placement) | M13 | Chưa làm |  |
| UC-SPACE-01 | Duyệt và tìm kiếm không gian mẫu | M13 | Chưa làm |  |
| UC-SPACE-02 | Xem không gian mẫu 360° | M13 | Chưa làm |  |
| UC-SPACE-03 | Bấm điểm sản phẩm trong phòng mẫu (mua theo phong cách phòng) | M13 | Chưa làm |  |
| UC-SPACE-04 | Lưu / bỏ lưu không gian mẫu yêu thích | M13 | Chưa làm |  |
| UC-SPACE-05 | Thử đổi món đồ trong phòng mẫu | M13 | Chưa làm |  |
| UC-SPACE-06 | Ghi nhận lượt xem không gian mẫu (một lần khi rời trang) | M13 | Chưa làm |  |
| UC-ADM-26 | Gửi thông báo cho người dùng | M14 | Chưa làm |  |
| UC-ADM-28 | Xem thống kê tổng quan | M14 | Chưa làm |  |
| UC-ADM-29 | Thống kê AR và phễu không gian mẫu | M14 | Chưa làm |  |
| UC-MOB-01 | Xem danh mục và danh sách sản phẩm trên app Android | M15 | Chưa làm |  |
| UC-MOB-02 | Xem chi tiết sản phẩm trên app Android | M15 | Chưa làm |  |
| UC-MOB-03 | Xem sản phẩm qua camera với overlay ảnh | M15 | Chưa làm |  |
| UC-MOB-04 | Chụp ảnh ghép và lưu vào máy | M15 | Chưa làm |  |

## 4. Việc tiếp theo (theo thứ tự đề xuất)

**Đợt chuẩn bị môi trường: HOÀN TẤT (2026-10-09).** Mọi module có thể code ngay, không phải cài hay cấu hình thêm (xem mục 5).

1. **Bắt đầu từ M02** (xác thực: gắn `@AuthThrottle()`, gửi email qua `MailService`), cùng M04 (vai trò) và M01 (settings, nhật ký) để có đăng nhập thật.
2. Hoàn thiện M05 (list/sửa/xóa media), rồi M03, M06, M07 (áp dụng `CacheService` cho danh mục, sản phẩm nổi bật, settings).
3. M08, M12 (phần còn lại), M09, M13, M10, M11, M14.
3b. **M15 Mobile (phương án B) sau M07** (và M12 nếu kịp); chọn nơi lưu ảnh overlay (O-06) trước khi làm UC-MOB-02/03.
4. Wireframe và dựng khung giao diện web song song với bước 1-2.

## 5. Môi trường phát triển (cấu hình xong ngày 2026-10-09)

Toàn bộ môi trường đã cấu hình theo DECISIONS D-T37 (báo cáo: [ENV_SETUP_REPORT.md](ENV_SETUP_REPORT.md), biến: [ENVIRONMENT.md](ENVIRONMENT.md)).

| Hạng mục | Trạng thái |
| --- | --- |
| Hạ tầng Docker: postgres, postgres-test, redis, minio (+init), mailpit, api | Xong, healthy |
| Web: Tailwind (theme), Provider TanStack Query, model-viewer, React Hook Form + Zod, Recharts, Vitest, Playwright | Xong (cài và cấu hình; chưa có trang dùng) |
| API: throttler nhóm auth, CacheService, queue mail + notification, driver s3, `@nestjs/schedule`, `/health` mở rộng | Xong (có test) |
| Mobile: Gradle, thư viện, `BuildConfig.API_BASE_URL`, cấu hình mạng debug; `assembleDebug` | Xong; chưa xác nhận trên máy ảo |
| CI: API + web test, Mailpit/Redis/MinIO, build Android riêng | Đã cấu hình, chưa chạy trên GitHub |
| Còn chờ ngoài môi trường | O-06 (nơi lưu ảnh overlay), wireframe, ảnh PNG overlay, tài khoản VNPay sandbox |

Cập nhật file này khi một UC đổi trạng thái (cùng commit với code).
