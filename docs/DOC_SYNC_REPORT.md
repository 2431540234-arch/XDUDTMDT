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
2. **Khung Passport còn trong cây thư mục:** D-T35 đã gỡ Passport, nhưng hai file khung strategy trong `apps/api/src/modules/auth/strategies/` (rỗng) vẫn còn, `JwtAuthGuard` dùng `JwtService`. **Đã xử lý ở Lượt 2 (D-T48): xóa hai file.**
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
| UC-MOB-01, UC-MOB-02 | Từng chưa có activity và sequence riêng (chỉ ghi chú dùng chung API với UC-CAT-02, UC-CAT-04). **Đã vẽ ở Lượt 2 (D-P08)** |
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
| Sơ đồ so với tài liệu | `scripts/extract-diagrams.py`: 148/148 khớp (Lượt 1); sau Lượt 2: 152/152 |

## 6. Lượt 2 (2026-10-09): thực hiện 7 quyết định của chủ dự án

### 6.1. Quyết định đã ghi vào DECISIONS.md

| Quyết định | Mã mới | Tham chiếu mã cũ |
| --- | --- | --- |
| 1. Thông báo: Service tạo `notifications` trong cùng transaction; queue `notification` chỉ cho việc nền chậm | D-T47 | D-N19; sửa D-T31, D-T42 |
| 2. Xóa hai file khung Passport strategy của `auth` | D-T48 | D-T35 |
| 3. `mobile:build` chạy bằng script Node | D-T49 | D-T37 |
| 4. TypeScript `~5.7.2` | D-T50 | D-T37 |
| 5. Thanh toán chỉ COD + VNPay sandbox; MoMo, ZaloPay, thẻ quốc tế là hạn chế | D-N20 | FR11 |
| 6. NFR02: LOD web ≤ 5 MB, ngưỡng `MODEL_SERVE_MAX_MB` | D-N21 | D-T21, NFR02 |
| 7. NFR11: sao lưu `pg_dump` hằng ngày + sao lưu bucket (giai đoạn triển khai) | D-T51 | D-T29, NFR11 |
| (bổ sung) UC-MOB-01, UC-MOB-02 có sơ đồ riêng | D-P08 | D-P07 |

### 6.2. File đã sửa

- Mã và cấu hình: xóa hai file khung strategy của `auth`; `scripts/mobile-build.mjs` (mới) và script `mobile:build` ở `package.json` gốc; `typescript` `~5.7.2` ở `package.json` gốc, `apps/api`, `apps/web` và `package-lock.json`; `MODEL_SERVE_MAX_MB` trong `env.validation.ts` (+ test), `.env.example`; chỉ sửa comment ở `notification.processor.ts`.
- Tài liệu: `DECISIONS.md`, `README.md`, `ENVIRONMENT.md`, `CONG_NGHE.md`, `API_CONVENTIONS.md`, `QUY_UOC_CODE_DB.md`, `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` (tiêu chí nghiệm thu NFR02 ở UC-ADM-13, mục 11.1 giới hạn thanh toán, UC-MOB-01/02), `BAO_CAO_PHAN_TICH_THIET_KE.md` (mục 10 Hạn chế và hướng phát triển, giai đoạn Triển khai cho sao lưu, A.64/A.65/S.64/S.65), `TIEN_DO.md` (qua script sinh), `TONG_HOP_USE_CASE_KHACH_HANG.md`, `diagrams/README.md`, `diagrams/manifest.json`.

### 6.3. Sơ đồ

- Vẽ lại (32 sơ đồ Mermaid, PNG ×2, SVG cho sơ đồ lớn): kiến trúc hệ thống; S.1, S.5, A.1, A.5 (email qua hàng đợi `mail`); UC-ORD-01 và UC-ADM-21 (thông báo trong transaction, email qua hàng đợi `mail`, activity và sequence); thông báo trong transaction ở UC-ORD-03, UC-PAY-02, UC-ADM-18, UC-ADM-22..25; UC-ADM-04, UC-3D-04 (hàng đợi `image-processing`, worker); UC-ADM-13 (bước kiểm tra LOD ≤ 5 MB, NFR02); UC-3D-04 (ghi chú/bước LOD ≤ 5 MB).
- Mới: activity và sequence UC-MOB-01, UC-MOB-02 (4 sơ đồ); `khach-hang/hinh4_ung-dung-android` (png, svg); sửa ghi chú thanh toán ở `khach-hang/hinh2`.
- Số sơ đồ: 148 → 152. `extract-diagrams.py`: 152/152 khớp.

### 6.4. Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run lint`, `format:check`, `typecheck`, `build` | Đạt (đã chạy `prettier --write README.md` cho README) |
| `npm test` | API 29/29, web 3/3 |
| `npm run test:e2e:api` | 23/23 (hạ tầng Docker đang chạy) |
| `npm run mobile:build` trên Windows PowerShell | BUILD SUCCESSFUL (không cần `JAVA_HOME`) |
| Tìm toàn văn tên hai file strategy và cụm "dùng lại luồng" cho UC-CAT | Không còn kết quả nào (đã diễn đạt lại ở D-T48, D-P08, BAO_CAO mục 7 và báo cáo này) |
| Phông tiếng Việt trong ảnh | Đã xem kiến trúc, UC-ORD-01, UC-MOB-01, Hình 2, Hình 4: dấu đầy đủ |

### 6.5. Điểm chưa rõ và việc còn lại

> Bốn điểm đầu đã được chủ dự án trả lời ở Lượt 3 (mục 7); điểm 6 đã chạy ở Lượt 3.

1. **UC-3D-04 và NFR02:** NFR02 (≤ 5 MB) áp dụng cho LOD mô hình, còn UC-3D-04 là chụp ảnh AR (giới hạn ảnh 10 MB). Đã đặt bước kiểm tra thật sự ở UC-ADM-13 (job `model-processing`) và chỉ thêm ghi chú tiền điều kiện ở UC-3D-04; cần xác nhận cách hiểu.
2. **UC-ADM-18 không có transaction** trong sơ đồ gốc: thông báo được vẽ là Service tạo trực tiếp, chưa gộp transaction; xem có cần bọc `$transaction` khi cài M09/M10.
3. Thông báo "admin biết LOD vượt ngưỡng" (UC-ADM-13) vẽ là worker tạo `notifications`; chưa rõ gửi cho một admin hay mọi admin.
4. D-T47 chưa có mã M09; TIEN_DO vẫn ghi `notification` đợt M09. Sơ đồ kiến trúc layout dagre có nhiều đường chéo, nếu cần bản đẹp hơn cho báo cáo Word nên vẽ lại tay.
5. Chuyển khoản vẫn là phương thức trong UC-ORD-01 (quyết định chỉ nêu COD + VNPay); cần xác nhận có giữ chuyển khoản (UC-ADM-24) hay không.
6. Chưa chạy lại `test:e2e:web` (Playwright) trong lượt này.

## 7. Lượt 3 (2026-10-09): trả lời bốn điểm chưa rõ của Lượt 2

### 7.1. Quyết định ghi vào DECISIONS.md

| Điểm | Mã | Nội dung | Tham chiếu |
| --- | --- | --- | --- |
| 1 | D-N21 (bổ sung) | Xác nhận: kiểm tra LOD web ≤ 5 MB nằm ở UC-ADM-13 (job `model-processing`); UC-3D-04 chỉ ghi chú tiền điều kiện | NFR02 |
| 2 | D-T52 | Mọi nghiệp vụ ghi từ 2 bảng trở lên chạy trong một `prisma.$transaction` (kể cả `activity_logs`, `notifications`) | D-T47, QUY_UOC §5 |
| 3 | D-N22 | "LOD vượt ngưỡng" thông báo cho admin đã tải mô hình, ghi `activity_logs`, cùng `failed` trong một transaction | D-N21, D-T47 |
| 4 | D-N23 | **Giữ chuyển khoản** (admin xác nhận thủ công ở UC-ADM-24) | D-N20 |

### 7.2. Điểm 4: chuyển khoản ngân hàng, nhánh đã chọn

Chọn nhánh **GIỮ**. Căn cứ trong `docs/KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md`: câu khảo sát 4 (dòng 57, "COD / Chuyển khoản / ..."), FR11 (dòng 121, "COD, chuyển khoản, ví điện tử, VNPay, thẻ") và FR37 (dòng 157, "Xác nhận chuyển khoản", UC-ADM-23, 24). Đã ghi vào D-N20/D-N23 và DAC_TA 11.1. Enum CSDL `payment_method` có `bank_transfer` (dùng) và `momo`, `zalopay`, `card` (chưa dùng); không sửa schema, chỉ ghi chú. Báo lại: enum còn ba giá trị chưa dùng; nếu muốn gọn thì cần migration, chờ chủ dự án.

### 7.3. Điểm 2: rà transaction trong sơ đồ sequence và đặc tả

Quét tất cả sequence: dòng `INSERT/UPDATE/DELETE` theo bảng, đối chiếu khối `critical`. UC đã sửa (sequence, activity, đặc tả DAC_TA):

| UC | Bảng ghi | Sửa |
| --- | --- | --- |
| UC-ADM-04 | media, activity_logs | Bọc transaction; đưa job `image-processing` sau commit |
| UC-ADM-05 | categories, activity_logs | Bọc transaction |
| UC-ADM-06 | brands, activity_logs | Bọc transaction |
| UC-ADM-07 | pages, activity_logs | Bọc transaction |
| UC-ADM-08 | attributes, activity_logs | Bọc transaction |
| UC-ADM-09 | products, activity_logs | Bọc transaction |
| UC-ADM-13 | media, model_files, product_3d_models, activity_logs, notifications | Trạng thái `ready` vào cùng transaction với `media`/`model_files`; nhánh LOD vượt ngưỡng có transaction riêng |
| UC-ADM-15 | spaces, activity_logs | Bọc transaction |
| UC-ADM-16 | space_hotspots, activity_logs | Bọc transaction |
| UC-ADM-18 | reviews, activity_logs, notifications | Bọc transaction (bắt đầu từ UC này) |
| UC-ADM-19 | coupons, activity_logs | Bọc transaction |

Các UC khác đã có transaction đúng (UC-AUTH-01, UC-ORD-01, UC-ORD-03, UC-PAY-02, UC-PAY-03, UC-ADM-21..25...). Không sửa UC-ACC-01: tải ảnh đại diện (`media`) và cập nhật hồ sơ (`users`) là hai request riêng, mỗi request một bảng (ghi thành ngoại lệ trong D-T52). Chỉ sửa tài liệu và sơ đồ, chưa có code nghiệp vụ nào.

### 7.4. Điểm 3: người nhận thông báo

Bảng `product_3d_models` và `model_files` không có `created_by`, nên không thể dùng cột đó. Dùng `uploadedBy` trong dữ liệu job `model-processing` (đã có ở `ModelJobData`, bằng `media.uploaded_by`). Không đổi schema.

### 7.5. Điểm 5: bố trí ELK cho sơ đồ kiến trúc

`mermaid-cli` 12.0.0 hỗ trợ `layout: elk`; bản xuất ảnh hiện có thực ra đã dùng ELK (ảnh trùng từng byte với bản ép `elk`). So sánh ba bản: (a) ELK như cũ, nhiều đường song song và chéo; (b) dagre, đường cong ngắn hơn nhưng khi nối vào subgraph thì có cạnh sai chỗ; (c) ELK sau khi gộp 8 cạnh hàng đợi thành 3 cạnh vào subgraph "Trạng thái hàng đợi". **Giữ (c)**, ghi rõ `layout: elk` trong khối Mermaid. Vẫn còn một số đường dài tới MinIO và PostgreSQL, nhưng ít hơn rõ rệt.

### 7.6. Điểm 6: `npm run test:e2e:web`

Playwright 2/2 đạt (WebGL R3F và trang chủ Tailwind). Có cảnh báo của Next ("lockfile missing swc dependencies, patching" rồi `ENOWORKSPACES`); không ảnh hưởng kết quả, không đổi lockfile.

### 7.7. Kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `extract-diagrams.py` | 152/152 khớp |
| lint, format:check, typecheck, test, build | Đạt (xem lần chạy cuối) |
| Ảnh | Đã xem UC-ADM-18 sequence và kiến trúc; tiếng Việt đủ dấu |

### 7.8. Việc còn lại

1. Khi cài M09/M10..., code phải theo D-T52 (transaction gồm `activity_logs`, `notifications`).
2. Enum `payment_method` còn `momo`, `zalopay`, `card` chưa dùng (chờ chủ dự án nếu muốn gọn bằng migration).
3. UC-ADM-13: sơ đồ chỉ vẽ nhánh `failed` do LOD vượt ngưỡng gửi thông báo; nhánh tệp hỏng vẫn chỉ đặt `failed` (một bảng).

