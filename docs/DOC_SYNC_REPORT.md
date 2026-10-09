# Báo cáo đồng bộ tài liệu

Ngày: 2026-10-09. Nền: commit `b30fc75` (cấu hình môi trường). Phạm vi: chỉ sửa file `.md`; không sửa code, cấu hình, schema, migration. Quy tắc áp dụng ghi ở `DECISIONS.md` D-T46.

Nguồn sự thật đã đối chiếu: `package.json` các workspace và `node_modules` (phiên bản thực cài), `docker-compose.yml`, `.env.example`, `apps/api/src/config/env.validation.ts`, `modules/jobs`, `cache`, `storage`, `mail`, `health`, `turbo.json`, `.github/workflows/`, `apps/mobile` (Gradle, `libs.versions.toml`), cơ sở dữ liệu đang chạy (`pg_trigger`: 36 trigger; 44 bảng; 2 migration).

## 1. Bảng file đã xử lý

Loại: **A** tài liệu sống (sửa trực tiếp), **B** báo cáo chụp theo thời điểm (chỉ thêm khối cập nhật ở đầu), **C** yêu cầu khách hàng (không sửa), **D** thiết kế CSDL (chỉ sửa nếu sai so với `schema.prisma`). "Số chỗ" là số khối thay đổi (`git diff -U0`, mỗi `@@` là một khối).

| File | Loại | Đã sửa gì | Số chỗ |
| --- | --- | --- | --- |
| `README.md` | A | Giới thiệu monorepo và trạng thái hiện tại; `db:up` là bí danh `infra:up`; ghi chú `mobile:build` trên Windows; thêm link ENVIRONMENT, CONG_NGHE, DOC_SYNC (các mục máy trắng, URL dev, test web, mobile đã sửa ở lượt cấu hình trước) | 4 |
| `docs/CONG_NGHE.md` | A | Viết lại mục 1-5 theo hiện trạng: phiên bản thực cài, trạng thái từng công nghệ, mâu thuẫn đã giải quyết, thư viện, công nghệ ngoài danh sách; **tách "144 endpoint theo thiết kế" và "6 route đã cài"**; sửa TypeScript 5.7.2 (trước ghi 5.9.3). Mục 6-8 (bảng nộp, kế hoạch, quyết định) giữ nguyên | 19 |
| `docs/DECISIONS.md` | A | Thêm D-T46 (chính sách tài liệu); D-T21, D-T31, D-T33, D-T30, D-T17 ghi rõ phần đã làm sớm hoặc đã có code; D-T35 đã đánh dấu "bị thay thế bởi D-T37" ở lượt trước. Không xóa quyết định nào | 5 |
| `docs/TIEN_DO.md` | A | Tái sinh: đợt chuẩn bị môi trường HOÀN TẤT; lộ trình bắt đầu từ M02; Mobile (M15) sau M07; mục 5 môi trường; ghi `Đã cài 6 / 144 endpoint` | 9 |
| `docs/API_CONVENTIONS.md` | A | Mục 8: driver `s3`, 4 queue, nhóm giới hạn tốc độ `default`/`auth` và header `X-RateLimit-*`, `Retry-After`; email theo `MAIL_TRANSPORT`; định dạng `/health` mới (smtp, queues); mục 8.6 cache. Không có mã lỗi mới (đã có `RATE_LIMITED`) | 6 |
| `docs/BAO_CAO_PHAN_TICH_THIET_KE.md` | A | Mục 1.1 (công nghệ), 1.3 (cây thư mục thực), ghi chú dưới sơ đồ kiến trúc, mục 6 (đã cài 6 route), mục 7 (trạng thái thành phần dùng chung), mục 8 (giai đoạn 0 đánh dấu xong; M02, M09 thêm việc), mục 9 (giả định 13). Các khối Mermaid giữ nguyên (xem mục 4) | 18 |
| `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` | A | Mục 1.1 (Android trong phạm vi), UC-AUTH-01 (email qua queue), 11.3 (email qua queue `mail`), 11.4 (3 driver, 4 queue, cache, throttler), 12.1 #8 và #21 (Redis không lưu phiên/OTP), 12.2 #3 (throttler đã có), 12.3. Nhóm UC-MOB (4 UC, đủ đặc tả), tổng 80 UC, ma trận, sơ đồ, mục 13 đã có từ lượt trước và được kiểm tra | 8 |
| `docs/TONG_HOP_USE_CASE_KHACH_HANG.md` | A | 45 thành 49 use case (thêm 4 UC-MOB), thống kê (Nên có 25), ghi chú quy tắc ứng dụng Android | 4 |
| `docs/QUY_UOC_CODE_DB.md` | A | Không đổi (đã kiểm tra: không nhắc công nghệ đã thay đổi) | 0 |
| `docs/SHARED_TYPES_SYNC.md` | A | Thêm `upload.types.ts`; mục 6: `HealthStatus` có `smtp`, `queues`, `UploadKind` | 2 |
| `docs/ENVIRONMENT.md` | A | Không đổi: đã kiểm tra mọi biến trong `.env.example` và `env.validation.ts` đều có trong bảng (0 thiếu) | 0 |
| `docs/READINESS_REPORT.md` | B | Thay khối cũ bằng khối "Cập nhật 2026-10-09, commit `b30fc75`" nêu mục đã lỗi thời và trỏ tài liệu hiện hành | 1 |
| `docs/MODULE_ENV_REPORT.md` | B | Như trên (mục 1, 5, 6, 7, 8, 9 lỗi thời; mục 3, 4 vẫn đúng) | 1 |
| `docs/ENV_SETUP_REPORT.md` | B | Khối cập nhật: CONG_NGHE đã cấu trúc lại, TypeScript 5.7.2 | 1 |
| `docs/KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md` | C | Không sửa (độ lệch ghi ở mục 3) | 0 |
| `docs/CAU_TRUC_DB.md` | D | Không đổi (44 bảng, 7 nhóm khớp `schema.prisma`) | 0 |
| `docs/DATABASE_SCHEMA.md` | D | Số migration (2, kèm tên); `media.file_path` là object key; ghi chú "đang chờ duyệt O-06" ở `product_images`, không đổi thiết kế | 4 |
| `CONTRIBUTING.md` | (ngoài danh sách) | Ghi điều kiện chạy e2e | 1 |
| `docs/DOC_SYNC_REPORT.md` | (mới) | Báo cáo này | - |

## 2. Mâu thuẫn còn lại giữa code và DECISIONS.md (không sửa code, chờ chủ dự án)

1. **Thông báo trong ứng dụng:** D-N19 ghi "Service tạo `Notification`, không dùng trigger"; D-T31 và D-T42 có queue `notification`. Hai điều không mâu thuẫn nếu Service đẩy job và processor ghi bản ghi, nhưng hiện processor chỉ ghi log. Cần chốt ở M09: bản ghi `notifications` do Service tạo trực tiếp hay do processor tạo.
2. **Khung Passport còn trong cây thư mục:** D-T35 đã gỡ Passport, nhưng `apps/api/src/modules/auth/strategies/jwt.strategy.ts` và `refresh.strategy.ts` (khung rỗng) vẫn còn, `JwtAuthGuard` dùng `JwtService`. Cần quyết định xóa hai file hay giữ; BAO_CAO mục 7 đã ghi "khung cũ, không dùng".
3. **Script `mobile:build` trong `package.json` gốc** dùng `./gradlew`; trên Windows `cmd` có thể không chạy được (cần `gradlew.bat`). README đã ghi cách chạy; có nên sửa script là quyết định về code.
4. **TypeScript:** `package.json` khai báo `^5.4.0`; thực cài 5.7.2 (lockfile). Các tài liệu cũ ghi 5.9.3 đã được sửa theo thực tế; không có quyết định nào ghi phiên bản này.
5. **Chưa có mâu thuẫn trực tiếp khác:** đã đối chiếu D-T14, D-T16, D-T17, D-T22 đến D-T24, D-T37 đến D-T45 với code; khớp.

## 3. Điểm lệch so với yêu cầu khách hàng (KHAO_SAT…, không sửa)

1. **Phương thức thanh toán:** FR11 liệt kê ví điện tử MoMo, ZaloPay, VNPay, thẻ; quyết định hiện hành chỉ tích hợp VNPay (sandbox) (D-N17, D-T03). MoMo, ZaloPay chưa nằm trong kế hoạch.
2. **NFR02 (tệp phục vụ người xem ≤ 5 MB):** hệ thống giới hạn tệp tải lên 100 MB (GLB/USDZ) và sinh 3 LOD; chưa có kiểm tra bắt buộc kích thước tệp đầu ra ≤ 5 MB.
3. **Ứng dụng Android (UC-MOB)** không có trong yêu cầu khách hàng (chỉ liệt kê Android, iOS ở NFR04 cho trình duyệt); đây là phần bổ sung theo quyết định của chủ dự án (D-P06).
4. **NFR11 (sao lưu dữ liệu hằng ngày, ≥ 99% hoạt động):** môi trường hiện tại chưa có cấu hình sao lưu (phạm vi triển khai production chưa làm).
5. **FR20/NFR05 (AR bằng Scene Viewer hoặc WebXR, Quick Look):** khớp, `model-viewer` hỗ trợ cả ba.

## 4. Việc tài liệu còn tồn đọng

**Sơ đồ UML cần vẽ lại (chưa làm trong lượt này; nguồn Mermaid trong tài liệu được giữ nguyên nên `scripts/extract-diagrams.py` báo 148/148 khớp):**

| Sơ đồ | Lý do |
| --- | --- |
| `architecture_kien-truc-he-thong` | Thiếu Redis làm cache và giới hạn tốc độ; thiếu queue `mail`, `notification`; email vẫn vẽ `SVC → SMTP` trực tiếp |
| `sequence_UC-AUTH-01`, `sequence_UC-AUTH-05`, `sequence_UC-ORD-01`, `sequence_UC-ADM-21` | Participant "MailService / SMTP (Mailpit)": nên thêm bước đẩy job vào hàng đợi `mail` và worker gửi SMTP |
| `activity_UC-AUTH-01`, `activity_UC-AUTH-05` | Nút "Gửi email... qua MailService": nên nêu hàng đợi `mail` |
| `activity_UC-ADM-04`, `sequence_UC-ADM-04`, `activity_UC-3D-04`, `sequence_UC-3D-04` | Còn nhắc job nền; kiểm tra khớp queue `image-processing` |
| UC-MOB-01, UC-MOB-02 | Chưa có activity và sequence riêng (quyết định "dùng lại luồng UC-CAT-02, UC-CAT-04"); cần chủ dự án xác nhận có vẽ riêng không |
| `docs/diagrams/khach-hang/hinh1..3` | Mới có 45 UC; 4 UC-MOB chưa nằm trong 3 hình khách hàng (đã có trong `usecase_khach-vang-lai`) |

Không có sơ đồ nào vẽ Redis lưu OTP hoặc phiên đăng nhập (đã kiểm tra `docs/diagrams/src`: Redis chỉ xuất hiện ở sơ đồ kiến trúc và UC-ADM-13 với vai trò hàng đợi).

**Việc khác:**
- O-06: nơi lưu ảnh overlay trong CSDL, đang chờ chủ dự án chọn (A, B hoặc C); `DATABASE_SCHEMA.md` đã ghi chú "đang chờ", thiết kế chưa đổi.
- Wireframe các màn hình chính (web và app); ảnh PNG overlay nền trong suốt cho 5-10 sản phẩm; tài khoản VNPay sandbox.
- `docs/MODULE_ENV_REPORT.md`, `READINESS_REPORT.md` giữ làm lịch sử; không cần cập nhật tiếp.
- Khi code M02, cập nhật `TIEN_DO.md` (chạy lại script sinh) và bảng "đã cài / thiết kế" ở `CONG_NGHE.md`.

## 5. Kết quả kiểm tra nhất quán chéo

Các lần quét toàn văn trên `docs/` và `README.md` (bỏ qua ba báo cáo chụp thời điểm và thư mục `diagrams`):

| Từ khóa / chỉ số | Kết quả |
| --- | --- |
| "OTP" | Chỉ còn ở câu phủ định ("Redis KHÔNG lưu phiên/OTP") trong API_CONVENTIONS, BAO_CAO, CONG_NGHE |
| "ngoài phạm vi" | Còn đúng ở `ai`, `ar-overlay` (BAO_CAO cây thư mục, DAC_TA #19); câu về Android ở CONG_NGHE là lịch sử đã giải quyết |
| "cài đúng đợt" | Chỉ ở ngữ cảnh "thay bởi D-T37" (CONG_NGHE, DECISIONS) |
| "passport", "cookie-parser" | Chỉ ở ngữ cảnh "đã gỡ" |
| "chỉ đổi biến môi trường" | Chỉ nói về S3, đúng (đã có driver `s3`) |
| "gửi trực tiếp", "không hàng đợi", "trực tiếp qua SMTP" | Không còn câu nào mô tả email gửi trực tiếp là cách mặc định; chỉ còn `MAIL_TRANSPORT=direct` (tùy chọn, đúng) và D-T31 ("đẩy job thay vì gửi trực tiếp", đúng) |
| "76 UC", "76 use case", "141 endpoint" | 0 (đã là 80 UC, 144 endpoint thiết kế); các số 76, 141 còn lại là số thứ tự dòng trong bảng API |
| Số bảng, trigger, enum, migration | 44 bảng, 36 trigger, 18 enum, 2 migration: khớp `schema.prisma`, `pg_trigger` và `prisma/migrations` ở mọi tài liệu |
| Tổng UC | 80 (29 Bắt buộc, 36 Nên có, 15 Mở rộng) ở DAC_TA, BAO_CAO, TIEN_DO; TONG_HOP là phần khách hàng: 49 (17, 25, 7) |
| Số endpoint | 144 theo thiết kế; 6 route đã cài (đếm từ decorator `@Get/@Post` trong `apps/api/src`); khớp ở BAO_CAO, CONG_NGHE, TIEN_DO |
| Tên queue | `model-processing`, `image-processing`, `mail`, `notification`: khớp ở mọi tài liệu, kiểm chứng bằng Bull Board khi chạy |
| Vai trò Redis | "cache, trạng thái hàng đợi, giới hạn tốc độ; không phiên/OTP": khớp |
| Mobile | Trong phạm vi, phương án B, sau M07; không còn câu nào nói Android ngoài phạm vi ở tài liệu sống |
| Mã quyết định tham chiếu | 84 mã định nghĩa trong DECISIONS; 23 mã được tham chiếu từ các tài liệu khác; 0 mã thiếu định nghĩa |
| Biến môi trường | Mọi biến trong `.env.example` và `env.validation.ts` đều có trong `ENVIRONMENT.md` (0 thiếu) |
| Link nội bộ giữa file `.md` | 0 link gãy sau khi tạo file này (kiểm tra bằng script) |
| Sơ đồ so với tài liệu | `scripts/extract-diagrams.py`: 148/148 khớp |
