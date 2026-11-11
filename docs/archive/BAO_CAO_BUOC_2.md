> **Đã lưu trữ ngày 2026-11-11 – lý do: báo cáo đối chiếu "chờ duyệt, CHƯA sửa" ngày 2026-11-06; các điểm lệch đã được xử lý (xem DECISIONS.md, CHUAN_MO_RONG.md).** Nội dung bên dưới được giữ nguyên, không còn phản ánh hiện trạng.

# Báo cáo bước 2 – Lệch công nghệ và bảng chức năng (chờ duyệt, CHƯA sửa)

> Đối chiếu theo quy tắc mới: chuẩn = `CAU_TRUC_DB.md`, `DATABASE_SCHEMA.md`, `QUY_UOC_CODE_DB.md`, `CONG_NGHE.md`; phạm vi chức năng chỉ theo `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`. Các con số thống kê trong CONG_NGHE (số route, số test, số migration) đã bỏ qua. Chưa bật container nào, chưa sửa code.

## 1. Kết quả kiểm tra hạ tầng (mục 3 yêu cầu)

| Hạng mục | Kết quả kiểm tra |
|---|---|
| **MinIO** | CONG_NGHE §2.3/§6: MinIO lưu file ở dev, S3 ở production (ảnh sản phẩm, banner, GLB/USDZ, 360°, panorama). Code: `STORAGE_DRIVER` mặc định `minio` (`env.validation.ts:26`), `.env` đặt `minio`, **nhưng** mọi lần chạy demo/test (db-reset, e2e:real, API cổng 4000) đang ghi đè `STORAGE_DRIVER=local`: 1.575 tệp seed nằm ở `apps/api/uploads/public` (8,4 MB, đã `.gitignore`), URL `http://localhost:<cổng>/uploads/...`. `xdudtmdt-minio-1` dừng từ 3 tuần trước (Exited 255). `media.file_path` lưu **khoá tương đối** (`models/…`, `spaces/…`) nên dùng chung được giữa local và MinIO. 10 dòng `media` của `aurelia_dev` trỏ tới khoá cũ từ lần seed trước (tệp thật nếu còn nằm trong volume MinIO; **chưa xác minh** vì chưa bật container). |
| **postgres-test-1 (5433)** | Vẫn còn tham chiếu: `.env.example:26-28` (`TEST_DATABASE_URL`), `.github/workflows/ci.yml:23,39` (service CI cổng 5433), `apps/api/test/setup-env.ts:1,10` (bộ e2e hạ tầng cũ: `health.e2e-spec`, `storage-jobs.e2e-spec`, chạy bằng `npm run test:e2e -w @aurelia-living/api` / `npm run test:e2e:api`). **Bộ test hiện dùng không dùng nó** (supertest DB và Playwright chạy trên `aurelia_test` ở cổng 55432). Kết luận: **chỉ còn dùng cho `test:e2e:api` (bộ cũ, chưa chạy lại trong phiên này) và CI**; không xoá. Chưa bật container (cần bật cùng minio nếu muốn chạy lại bộ cũ — sẽ báo trước). |
| **Redis (redis-1, 6380)** | Code dùng vào: (1) **giới hạn tốc độ** — `ThrottlerStorageRedisService`, tiền tố `throttle:` / `throttle-test:` (`app.module.ts:52`); (2) **hàng đợi BullMQ** — 8 khoá `bull:*` (và 33 `bull-test:*` từ test cũ) (`modules/jobs`). `CacheService` (`cache/`) **có nhưng không module nghiệp vụ nào gọi**. Không lưu OTP/phiên (đúng D-T29). So CONG_NGHE: đúng phần rate limit + queue; **lệch**: cache chưa được áp dụng (chuẩn nói áp dụng ở danh mục, trang tĩnh, settings, chi tiết sản phẩm). |
| **aurelia_living** | Không còn `.env`/script trỏ tới. Chỉ còn mặc định `POSTGRES_DB` trong `docker-compose.yml:14,21,110` (tên DB khởi tạo của container) và nhắc trong DECISIONS D-D06/D-T28, ENVIRONMENT.md:24. Ghi nhận: **không dùng**, không đụng, không xoá. |
| **Mailpit (mailpit-1)** | Đang chạy (SMTP 1025, web 8025). Biến có sẵn: `MAIL_TRANSPORT` (`direct`/`queue`, mặc định `queue`), `MAIL_HOST`, `MAIL_PORT` (mặc định 1025), `MAIL_FROM`. Không cần SMTP user/pass. `.env` hiện `MAIL_TRANSPORT=queue` ⇒ thư đi qua BullMQ (worker chạy cùng tiến trình API). |

## 2. Bảng 14 chỗ lệch công nghệ (chờ bạn duyệt trước khi sửa)

| # | Mục | Chuẩn (CONG_NGHE.md) ghi gì | Code đang dùng gì | Đề xuất | Rủi ro |
|---|---|---|---|---|---|
| 1 | Lưu file | MinIO (dev) / S3 (prod) §2.3, §6 | `local` (đĩa `apps/api/uploads`) cho demo/test; `.env` mặc định `minio` nhưng container đang dừng | **Sửa theo chuẩn cho dev/demo:** bật `minio-1` + `minio-init-1` (báo bạn), copy `uploads/public` → bucket `aurelia-public` theo cùng khoá (script, không đổi `media.file_path`), đặt `STORAGE_DRIVER=minio`, `STORAGE_PUBLIC_URL=http://localhost:9000/aurelia-public`. **Test tự động (supertest, e2e:real) giữ `local`** để không phụ thuộc container → ghi vào CHUAN_MO_RONG phần Công nghệ | Trung bình: đổi URL ảnh; CORS MinIO cho cổng FE; 10 dòng media của `aurelia_dev` có thể trỏ tệp không còn; thời gian copy |
| 2 | Redis dùng cho | cache + trạng thái hàng đợi + rate limit; không OTP/phiên | rate limit + BullMQ; cache chưa dùng | Giữ phần đúng; **áp `CacheService` cho danh mục, trang tĩnh, settings công khai** (TTL theo D-T30) | Thấp–TB: phải xoá cache khi admin sửa (`delByPrefix`) |
| 3 | Cache sản phẩm | `products:<slug>` 1 phút, featured 2 phút bằng Redis (§3 D-T30) | chỉ mục RAM 15 s trong `ProductsService` | Đưa vào `CacheService` hoặc giữ RAM và ghi CHUAN_MO_RONG | Thấp; RAM không đồng bộ khi chạy nhiều instance |
| 4 | Hàng đợi/xử lý mô hình 3D | BullMQ 4 queue "Đã dùng"; sharp + glTF-Transform xử lý GLB (kiểm tra, LOD, nén), trạng thái `uploading→processing→ready` | upload mô hình chỉ kiểm tra chữ ký/đuôi/MIME rồi ghi kho, đặt `ready` ngay; processor `model-processing`/`image-processing` tồn tại nhưng chỉ gắn với luồng presign cũ mà FE không gọi | **Sửa theo chuẩn:** sau upload đẩy job `model-processing` (đo đa giác, sinh LOD, nén) và đổi trạng thái; FE hiện trạng thái | TB–Cao: job lỗi với GLB mẫu; test cần Redis; thay đổi hành vi upload (phải chờ `ready`) |
| 5 | Mail | Nodemailer + Mailpit, đi qua queue `mail` | đúng; `.env` `queue`, test/demo `direct`; `MailService` nay dùng cho OTP & tạo khách | Giữ; thêm gửi thư xác thực email + token-link (bước 6); ghi `MAIL_*` vào ENVIRONMENT.md | Thấp |
| 6 | Soạn trang tĩnh/bài viết | Markdown trong textarea (§4: "không dùng Tiptap") | **FE đã đúng chuẩn**: textarea Markdown đơn giản + `RichText.tsx` render thành phần React (tự escape, không `dangerouslySetInnerHTML`). **BE lệch**: `sanitizeRichText` coi nội dung là **HTML** và lọc bằng `sanitize-html` (`admin-content.service.ts`) | **Sửa BE theo chuẩn:** lưu Markdown nguyên văn (chỉ loại ký tự điều khiển/thẻ HTML thô), FE giữ renderer hiện có (an toàn XSS nhờ React). Nếu bạn muốn render đủ Markdown (bảng, in đậm, link) cần thêm thư viện (vd. `react-markdown`) — **cần bạn duyệt thư viện mới** | Thấp. Dữ liệu seed đã là Markdown nên không phải chuyển đổi. Test XSS (unit `reviews.rules.spec.ts`) sẽ đổi |
| 7 | `sanitize-html` (+`@types`) | không có trong chuẩn | `sanitize-html@2.13.0` (ghim để chạy CJS/Jest) | Nếu #6 làm như trên thì **gỡ** (không còn cần). Nếu giữ một lớp lọc HTML thô: giữ và ghi CHUAN_MO_RONG phần Công nghệ | Thấp |
| 8 | Kiểm tra dữ liệu vào | `class-validator` + `class-transformer`, Zod cho env (§5, ghi "Có thể") | route nghiệp vụ dùng hàm tay `common/utils/validate.ts` (thông báo lỗi tiếng Việt đúng từng trường như mock FE); `class-validator` chỉ còn ở DTO cũ (media, model presign, pagination) | **Giữ** và ghi CHUAN_MO_RONG (lý do: khớp từng thông báo/trường của mock FE). Không chuyển sang class-validator | Thấp |
| 9 | Đường dẫn Swagger | `/docs` (§6 "`/docs` cho … endpoint") | `/api/docs` (`app.setup.ts:40`) | Sửa thành `/docs` (không đổi prefix API) | Rất thấp |
| 10 | Docker Compose | "postgres, redis, minio, mailpit, api" | `api` nằm trong profile `legacy` (API mới chạy trên host); thêm profile `test`, `later` | **Giữ** (bạn đã chọn cách (b) ở Mốc 3) và ghi CHUAN_MO_RONG; hoặc đưa `Dockerfile.api` build API mới nếu bạn muốn | Thấp |
| 11 | Token | JWT access + refresh (`/auth/refresh`) | BE có; **FE không gọi refresh**, access đặt 12 h cho dev | **Sửa FE:** interceptor tự refresh khi 401 rồi thử lại; đưa access về giá trị ngắn hơn (vd. 15 phút) ở production | TB: phải test luồng hết hạn; ảnh hưởng `api-client.ts` |
| 12 | Zustand vs TanStack Query | §3.1: giỏ hàng là server state; "`cartStore.ts` nên bỏ hoặc thu nhỏ" | `cartStore.ts` còn 7 dòng; giỏ lấy từ Query (`useCart`) | Xác nhận chỉ còn dùng cho badge (chưa kiểm hết nơi dùng) → thu nhỏ/bỏ | Thấp |
| 13 | Khai báo phiên bản | ghi phiên bản **thực cài** cụ thể (Prisma 5.22.0, Nest 10.4.22, …) | `apps/api/package.json` khai báo `^5.14.0`, `^10.3.0` (cài thực 5.22.0 / 10.4.22) | Ghim khoảng phiên bản bằng đúng bản đã cài (không nâng bản lớn) | Thấp |
| 14 | DB test riêng (5433) | (không nằm trong chuẩn; D-T-… profile `test`) | còn dùng ở `test:e2e:api` (bộ cũ) và CI; bộ test hiện tại dùng `aurelia_test` cổng 55432 | Gộp: chạy bộ cũ trên `aurelia_test` hoặc giữ `postgres-test` cho CI; ghi CHUAN_MO_RONG. Không xoá container/volume | Thấp |

Không phải lệch (đã khớp): Next 14.2.35, React 18.3.1, TS 5.7.2, Tailwind 3.4.19, Zustand 4.5.7, TanStack Query 5.104.1, Three 0.163.0, R3F/drei, model-viewer 3.5.0, RHF 7.89.0, Recharts 2.15.4, Vitest 5.0.3, Playwright 1.64.0, NestJS 10.4.22, Prisma 5.22.0, PostgreSQL 16, Redis 7, BullMQ 5.81.5, sharp 0.35.5, Jest 29.7.0, supertest 7.3.1, JWT + bcryptjs (không Passport). Chưa có nâng bản lớn nào được đề xuất.

## 3. Bảng chức năng theo đặc tả (DAC_TA, 80 UC), chia theo vai trò

Cột *DB* = chuẩn đã có bảng/cột chưa · *BE/FE* = code hiện tại · **Đề xuất** theo thứ tự bạn đã nêu: "B6" = bước 6 (gói chỉ sửa code), "Mốc 4" (kho/thu chi/cài đặt/VNPAY), "Mốc 5" = **đề xuất mới** cho các UC còn lại của đặc tả sau Mốc 4, "Mốc 6" = Android. Chưa làm.

### 3.1 Dùng chung cho Khách vãng lai / User / Admin
| Mã | Tên | DB | BE | FE | Đề xuất |
|---|---|---|---|---|---|
| UC-AUTH-01 | Đăng ký | có | có | có | xong (B6: gửi thư xác thực) |
| UC-AUTH-02 | Đăng nhập | có | có | có | xong |
| UC-AUTH-03 | Làm mới access token | có | có | **chưa gọi** | Bước 5 (#11 bảng công nghệ) |
| UC-AUTH-04 | Đăng xuất | có | có | có | xong |
| UC-AUTH-05 | Quên mật khẩu | có (`token_hash`) | có nhưng bằng **OTP** (lệch D-T29) | có (OTP) | Bước 4 (M6) + sửa 2 màn FE |
| UC-AUTH-06 | Đặt lại mật khẩu | có | như trên | có (OTP) | Bước 4 (M6) |
| UC-CAT-01 | Xem trang chủ | có | có | có | xong |
| UC-CAT-02 | Duyệt theo danh mục | có | có | có | xong |
| UC-CAT-03 | Tìm kiếm | có | có | có | xong |
| UC-CAT-04 | Chi tiết sản phẩm | có | có | có | xong |
| UC-CAT-05 | Trang tĩnh | có | có | có | xong (Markdown: Bước 5) |
| UC-CAT-06 | Tìm không dấu | có | có | có | xong |
| UC-REV-01 | Xem đánh giá | có | có | có | xong |
| UC-3D-01 | Xem 3D | có | có | có | xong |
| UC-3D-02 | Xem AR | có | không ghi phiên AR | nút + QR minh hoạ | Mốc 5 |
| UC-3D-03 | Đổi màu/chất liệu 3D | có (`model_material_variants`) | không | không | Mốc 5 |
| UC-3D-06 | Xem ảnh AR công khai | có | không | không | Mốc 5 |
| UC-3D-07 | Thống kê phiên 3D/AR (ẩn danh) | có (`ar_sessions`) | không | không | Mốc 5 |
| UC-SPACE-01 | Duyệt không gian mẫu | có | có | có | xong |
| UC-SPACE-02 | Xem không gian 360° | có | có | có | xong |
| UC-SPACE-03 | Bấm hotspot sản phẩm | có | có | có | xong |
| UC-SPACE-05 | Thử đổi món trong phòng | có (`space_product_placements`) | chỉ đọc | không | Mốc 5 |
| UC-SPACE-06 | Ghi lượt xem không gian | có (`space_views`) | **lệch** (tăng `view_count` trực tiếp) | không | **B6** (BE) + FE `sendBeacon` ở Mốc 5 |
| UC-PAY-02 | Callback/IPN cổng thanh toán (hệ thống ngoài) | có | không | – | **Mốc 4** (kiểm bằng khoá giả) |

### 3.2 User (khách đã đăng nhập)
| Mã | Tên | DB | BE | FE | Đề xuất |
|---|---|---|---|---|---|
| UC-AUTH-07 | Xác thực email (bắt buộc để đánh giá) | có (`email_verified_at`) | **không** | không (cần màn/trang xác nhận) | **B6** + FE |
| UC-ACC-01 | Hồ sơ cá nhân | có | có | có | xong |
| UC-ACC-02 | Đổi mật khẩu | có | có | có | xong |
| UC-ACC-03 | Quản lý phiên (đăng xuất từ xa) | có (`user_sessions`) | không | không | Mốc 5 |
| UC-ACC-04 | Sổ địa chỉ | có | có | có | xong |
| UC-ACC-05 | Thông báo | có | có | có | xong |
| UC-ACC-06 | Yêu thích | có | có | có | xong |
| UC-ACC-07 | Yêu cầu xoá tài khoản (xoá mềm) | có (`deleted_at`) | không | không | Mốc 5 |
| UC-CART-01..04 | Giỏ hàng, số lượng, mã giảm giá | có | có | có | xong |
| UC-ORD-01 | Đặt hàng | có | có (**giữ chỗ**, lệch chuẩn trừ ngay) | có | Bước 4 (M5) |
| UC-ORD-02 | Theo dõi đơn | có | có | có | xong |
| UC-ORD-03 | Huỷ đơn | có | có | có | xong (cộng lại tồn: M5) |
| UC-PAY-01 | Thanh toán online | có | **giả lập** | có | Bước 7 (an toàn) + **Mốc 4** (VNPAY) |
| UC-PAY-03 | Thanh toán lại | có | giả lập | có | Mốc 4 |
| UC-REV-02 | Đánh giá sản phẩm đã mua | có | có (**thiếu** điều kiện đã xác thực email) | có | **B6** |
| UC-REV-03 | Sửa/xoá đánh giá của mình | có | có | có | xong |
| UC-3D-04 | Chụp và lưu ảnh AR | có (`ar_snapshots`) | không | không | Mốc 5 |
| UC-3D-05 | Quản lý ảnh AR của tôi | có | không | không | Mốc 5 |
| UC-SPACE-04 | Lưu/bỏ lưu không gian | có | có | có | xong |

### 3.3 Admin
| Mã | Tên | DB | BE | FE | Đề xuất |
|---|---|---|---|---|---|
| UC-ADM-01 | Quản lý người dùng | có | có | có | xong |
| UC-ADM-02 | Quản lý vai trò & phân quyền | có | **không** (chỉ kiểm role) | không | **B6** (`PermissionsGuard` đọc `role_permissions`); màn quản trị quyền: Mốc 5 |
| UC-ADM-03 | Cài đặt hệ thống | có (`settings`) | chỉ `GET /settings/public` | có (trang ❌ 404) | **Mốc 4** |
| UC-ADM-04 | Quản lý media | có | khung presign cũ | không | Mốc 5 |
| UC-ADM-05 | Danh mục sản phẩm | có | có | có | xong |
| UC-ADM-06 | Thương hiệu | có | chỉ `GET /brands` | không | Mốc 5 |
| UC-ADM-07 | Trang tĩnh | có | có | có | xong (Markdown: Bước 5) |
| UC-ADM-08 | Thuộc tính & giá trị | có | chỉ qua form sản phẩm | không | Mốc 5 |
| UC-ADM-09/10/11 | Sản phẩm, biến thể, ảnh | có | có | có | xong |
| UC-ADM-12 | Nhập kho/điều chỉnh tồn | có (`inventory_movements`) | **không** | có (trang ❌ 404) | **Mốc 4** (xem mục 4 báo cáo kho) |
| UC-ADM-13 | Mô hình 3D | có | có | có (metadata) | xong (giới hạn 100MB + xử lý nền: Bước 5) |
| UC-ADM-14 | Biến thể chất liệu 3D | có | không | không | Mốc 5 |
| UC-ADM-15/16 | Không gian mẫu + hotspot | có | có | có | xong |
| UC-ADM-17 | Đặt mô hình 3D vào ảnh 360° (placement) | có | không | không | Mốc 5 |
| UC-ADM-18 | Duyệt/từ chối đánh giá | có | có | có | xong |
| UC-ADM-19 | Mã giảm giá | có | có | có | xong |
| UC-ADM-20/21/22 | Đơn: xem, trạng thái, huỷ | có | có | có | xong (tồn: M5) |
| UC-ADM-23 | Hoàn tiền thủ công | có | có (+ luồng đổi trả) | có | Bước 7 (công thức tiền hoàn) |
| UC-ADM-24 | Xác nhận chuyển khoản | có | có | có | xong |
| UC-ADM-25 | Quản lý vận chuyển (vận đơn `delivered` ⇒ đơn `completed`) | có | một phần (chỉ hãng/mã; chiều ngược) | một phần | Mốc 5 |
| UC-ADM-26 | Gửi thông báo thủ công | có | không | không | Mốc 5 |
| UC-ADM-27 | Xem nhật ký hoạt động | có (`activity_logs`) | chỉ ghi | không | **B6** (interceptor) + màn xem: Mốc 5 |
| UC-ADM-28 | Thống kê tổng quan | có | có | có | xong |
| UC-ADM-29 | Thống kê AR & phễu không gian | có | không | không | Mốc 5 |
| UC-ADM-30 | Gỡ ảnh AR không phù hợp | có | không | không | Mốc 5 |

### 3.4 Ứng dụng Android (UC-MOB, mọi vai trò)
| Mã | Tên | DB | BE | FE/App | Đề xuất |
|---|---|---|---|---|---|
| UC-MOB-01 | Danh mục + danh sách sản phẩm | có | API công khai đã có | `apps/mobile` chưa có chức năng | Mốc 6 |
| UC-MOB-02 | Chi tiết sản phẩm | có | có | chưa | Mốc 6 |
| UC-MOB-03 | Camera + overlay ảnh | **chưa chốt** (DAC_TA §12.2 #11: nơi lưu ảnh overlay) | thiếu | chưa | Mốc 6 — cần bạn chốt phương án lưu trước |
| UC-MOB-04 | Chụp ảnh ghép, lưu máy | không cần bảng | không cần | chưa | Mốc 6 |

## 4. Kho (câu 5): gộp phiếu nhập vào `inventory_movements` có đủ không?
`inventory_movements` (chuẩn): `variant_id`, `type` (`import|sale|return|adjustment`), `quantity_change` (≠ 0), `reason`, `reference_code`, `performed_by`, `created_at`. UC-ADM-12 chỉ yêu cầu nhập/điều chỉnh/hàng trả + xem lịch sử.
- **Đủ chứa:** loại nhập (`import`), số lượng, lý do, mã chứng từ (`reference_code` có thể gom nhiều dòng thành "phiếu" `PNxxxx`), người thực hiện.
- **Mất so với FE hiện có (trang Kho, màn 53):** (1) **giá nhập từng dòng** (`stock_receipt_items.cost_price`) — có thể thay bằng cập nhật `product_variants.cost_price`, nhưng mất lịch sử giá theo phiếu; (2) **nhà cung cấp** (đặc tả không có chức năng quản lý nhà cung cấp ⇒ theo yêu cầu của bạn sẽ bỏ `suppliers`; FE đang có ô chọn nhà cung cấp và danh sách `GET /admin/inventory/suppliers`); (3) **phiếu xuất (`out`) và trạng thái nháp/huỷ** — chuẩn không có.
- ⇒ **Gộp làm mất chức năng FE đang có** nên theo yêu cầu của bạn tôi **báo trước** và chưa làm: chọn (a) gộp + sửa trang Kho (bỏ NCC/nháp, giá nhập ghi vào `cost_price` biến thể), hoặc (b) giữ `stock_receipts`/`items` (ghi vào CHUAN_MO_RONG), chỉ bỏ `suppliers`. Đề xuất của tôi: **(b′)** giữ `stock_receipts`+`items` làm chứng từ, ghi mỗi dòng nhập vào `inventory_movements` (`reference_code` = mã phiếu), bỏ `suppliers` (NCC thành ô chữ trong phiếu).

## 5. Việc cần bạn duyệt
1. Bảng 14 chỗ lệch công nghệ (mục 2): duyệt từng dòng — sửa theo chuẩn / giữ + CHUAN_MO_RONG. Riêng **#1 MinIO** (cần bật `minio-1`, `minio-init-1`), **#4 xử lý nền mô hình 3D**, **#6 Markdown (thêm thư viện hay giữ renderer hiện có)**, **#11 refresh token FE**.
2. Cột "Đề xuất" ở bảng chức năng (mục 3), đặc biệt đưa các UC còn lại (AR, quản lý phiên, thương hiệu/thuộc tính/media, placement…) vào **"Mốc 5"** và Android vào "Mốc 6" — hoặc bạn chỉ định bước khác.
3. Kho (mục 4): phương án a / b / b′.
4. UC-MOB-03: chốt nơi lưu ảnh overlay (DAC_TA §12.2 #11 còn "CHƯA CHỐT").
