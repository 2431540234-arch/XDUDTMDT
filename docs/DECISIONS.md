# Nhật ký quyết định

Gom tất cả quyết định đã chốt của dự án. Mỗi quyết định có ngày, lý do và tài liệu bị ảnh hưởng. Khi đổi quyết định: thêm dòng mới, ghi "thay thế D-xxx", không xóa dòng cũ.

Mã: **D-N** = nghiệp vụ, **D-T** = kỹ thuật/hạ tầng, **D-P** = phạm vi. Ngày 2026-10-06 là ngày chốt cùng đợt đặc tả (commit "docs: chốt quyết định nghiệp vụ").

## 1. Phạm vi và vai trò

| Mã | Quyết định | Ngày | Lý do | Tài liệu ảnh hưởng |
| --- | --- | --- | --- | --- |
| D-P01 | Mô hình kinh doanh B2C: bán nội thất cho người dùng cuối, có xem 3D, AR, không gian mẫu 360° | 2026-10-06 | Phù hợp đề tài đồ án | KHAO_SAT_VA_YEU_CAU_KHACH_HANG, DAC_TA_CHUC_NANG_THEO_VAI_TRO |
| D-P02 | Chỉ hai vai trò `admin` và `user`. Khách vãng lai không có tài khoản, không lưu CSDL. Trigger gán vai trò `user` mặc định khi tạo tài khoản | 2026-10-06 | Đơn giản hóa phân quyền; guest chỉ cần xem | CAU_TRUC_DB, DATABASE_SCHEMA, DAC_TA (mục 1) |
| D-P03 | Ngoài phạm vi: module `ai`, `ar-overlay`, ứng dụng `apps/mobile`; ghi vào "Hướng phát triển" | 2026-10-06 | Không có use case tương ứng | DAC_TA (mục 13), READINESS_REPORT |
| D-P04 | Hệ thống có 76 use case, 141 API, 44 bảng, chia 14 module M01–M14 | 2026-10-08 | Chia theo nghiệp vụ để phân công và theo dõi | MODULE_ENV_REPORT (mục 3), `apps/api/src/modules/index.ts` |
| D-P05 | Chưa làm module thanh toán (M10) ở Đợt 0; chờ tài khoản VNPay sandbox | 2026-10-08 | Tài khoản đang đăng ký | MODULE_ENV_REPORT |

## 2. Nghiệp vụ

Các quyết định D-N01..D-N19 trùng số thứ tự với bảng 12.1 của `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` (nguồn chi tiết, kèm mã UC).

| Mã | Quyết định | Ngày | Lý do | Tài liệu ảnh hưởng |
| --- | --- | --- | --- | --- |
| D-N01 | User hủy đơn khi `pending`/`confirmed`; admin hủy trước `shipping`. Hủy hoàn tồn kho và lượt dùng coupon | 2026-10-06 | Tránh hủy đơn đã xử lý/giao | DAC_TA UC-ORD-03, UC-ADM-22 |
| D-N02 | COD: payment `pending` đến khi vận đơn `delivered`. Online: `success` khi nhận callback hợp lệ; thất bại thì đơn vẫn `pending`, cho thanh toán lại | 2026-10-06 | Khớp quy trình thực tế | UC-PAY-02, 03, UC-ADM-25 |
| D-N03 | Hoàn tiền thủ công: admin đổi đơn và payment sang `refunded`, không gọi API hoàn tiền của cổng | 2026-10-06 | Cổng sandbox/đồ án không cần | UC-ADM-23 |
| D-N04 | Không bắt buộc xác thực email để đặt hàng; bắt buộc xác thực email mới được đánh giá | 2026-10-06 | Giảm rào cản mua, chống đánh giá ảo | UC-AUTH-07, UC-REV-02 |
| D-N05 | Trừ tồn kho khi tạo đơn trong `$transaction` | 2026-10-06 | Tránh bán vượt tồn | UC-ORD-01, QUY_UOC_CODE_DB |
| D-N06 | Chỉ đánh giá khi có `OrderItem` thuộc đơn `completed` của chính user; review mới ở trạng thái `pending`, admin duyệt | 2026-10-06 | Chống đánh giá giả | UC-REV-02, UC-ADM-18 |
| D-N07 | Mô hình 3D có trạng thái `uploading` → `ready`/`failed` (xem D-T01 thay thế phần `processing`) | 2026-10-06, sửa 2026-10-08 | Xem D-T01 | UC-ADM-13 |
| D-N08 | (Đã bị thay thế bởi D-T01) Xử lý nền bằng BullMQ + Redis | 2026-10-06 | — | — |
| D-N09 | Xác thực email bằng JWT ký riêng mục đích `verify_email`, không thêm bảng | 2026-10-06 | Không cần lưu trạng thái | UC-AUTH-07 |
| D-N10 | Setting: danh sách trắng khóa công khai trong Service, không thêm cột | 2026-10-06 | Tránh lộ cấu hình nội bộ | UC-ADM-03 |
| D-N11 | Ghi lượt xem không gian mẫu MỘT lần khi rời trang bằng `navigator.sendBeacon` (kèm `hotspotClickCount`, `addedToCart`); bỏ `viewToken` | 2026-10-06 | Giảm số request | UC-SPACE-06 |
| D-N12 | Slug trong URL cho API công khai và web (`/products/:slug`, `/spaces/:slug`); API quản trị dùng id | 2026-10-06; web đổi `[id]`→`[slug]` 2026-10-08 | SEO, URL dễ đọc | UC-CAT-04, UC-SPACE-02, `apps/web/src/app/(shop)` |
| D-N13 | Thanh toán online thành công tự chuyển đơn `pending → confirmed` (lịch sử `changedBy = NULL`) | 2026-10-06 | Giảm thao tác admin | UC-PAY-02 |
| D-N14 | Vận đơn `delivered` tự chuyển đơn `completed`; COD thì payment đồng thời `success` | 2026-10-06 | Đồng bộ trạng thái | UC-ADM-25 |
| D-N15 | Hủy đơn đã thanh toán: `cancelled`, payment giữ `success`, admin hoàn tiền thủ công, cho phép `cancelled → refunded` | 2026-10-06 | Khớp D-N03 | UC-ORD-03, UC-ADM-22, UC-ADM-23 |
| D-N16 | Áp mã giảm giá chỉ xem trước; mã được ghi và kiểm tra lại khi đặt hàng trong transaction | 2026-10-06 | Tránh dùng mã trùng/quá hạn | UC-CART-04, UC-ORD-01 |
| D-N17 | Phương thức `card` đi qua cổng VNPay | 2026-10-06 | Một cổng duy nhất cho đồ án | UC-PAY-01 |
| D-N18 | Tìm kiếm sản phẩm không dấu (unaccent + trigram); cần một migration index GIN khi code | 2026-10-06 | Trải nghiệm tìm kiếm tiếng Việt | UC-CAT-06 |
| D-N19 | Thông báo tự động do Service tạo `Notification`, không dùng trigger. Gộp giỏ khách vào giỏ user: không làm. Mã đơn dạng `ALV-YYYYMMDD-NNNN` | 2026-10-06 | Dễ kiểm soát; giỏ khách không lưu | DAC_TA 12.2 |

## 3. Cơ sở dữ liệu

| Mã | Quyết định | Ngày | Lý do | Tài liệu ảnh hưởng |
| --- | --- | --- | --- | --- |
| D-D01 | 44 bảng, khóa chính/ngoại kiểu `INTEGER` (không `BIGINT`) | 2026-10-06 | Quy mô đồ án; đơn giản cho JS (không BigInt) | DATABASE_SCHEMA, `schema.prisma` |
| D-D02 | Prisma Migrate là nguồn thật của CSDL (`0_init` làm baseline); thư mục `database/` chỉ để tham chiếu | 2026-10-06 | Một quy trình thay đổi duy nhất | `database/README.md` |
| D-D03 | `media.file_size` kiểu `INTEGER` (tối đa ~2 GB) | 2026-10-06 | Đủ cho giới hạn upload 100 MB | migration `20261006134647_media_file_size_int` |
| D-D04 | Không trigger ghi `activity_logs`; Service tự ghi. Giữ ghi lịch sử trạng thái khi tạo đơn. Thêm `ar_sessions.updated_at` | 2026-10-06 | Kiểm soát nội dung nhật ký | DATABASE_SCHEMA |
| D-D05 | Xóa mềm chỉ với `User`, `Product`; email tra cứu bằng `findFirst({ deletedAt: null })`; không gán `OrderItem.lineTotal`; nghiệp vụ nhiều bước trong `$transaction`; `Decimal` trả ra bằng `serialize()` | 2026-10-06 | Khớp trigger/ràng buộc CSDL | QUY_UOC_CODE_DB |
| D-D06 | Môi trường dev dùng DB mới `aurelia_dev` cạnh DB cũ `aurelia_living` trong container hiện có; không xóa container/volume cũ | 2026-10-06 | Không mất dữ liệu cũ | README |

## 4. Kỹ thuật và hạ tầng

| Mã | Quyết định | Ngày | Lý do | Tài liệu ảnh hưởng |
| --- | --- | --- | --- | --- |
| D-T01 | **KHÔNG dùng Redis/BullMQ/worker/MinIO.** Mô hình 3D xử lý ĐỒNG BỘ trong API: tải lên, kiểm tra định dạng/dung lượng, lưu, `status = ready` (hoặc `failed`). Không còn trạng thái `processing` (giữ trong enum CSDL). Email gửi trực tiếp qua SMTP, lỗi chỉ ghi log. `modules/jobs` giữ làm khung, ghi rõ "không dùng trong phạm vi đồ án". Thay thế D-N08 | 2026-10-08 | Đồ án không cần độ phức tạp hàng đợi; giảm hạ tầng | DAC_TA UC-ADM-13, UC-ADM-04, 11.3, 11.4, 12.1 #7-8, mục 13; BAO_CAO mục 1, activity/sequence UC-ADM-04/13, mục 7-8; docker-compose (profile `later`); `.env.example` |
| D-T02 | Storage chỉ driver `local` qua `StorageService` (upload/delete/getUrl); MinIO là hướng phát triển (thêm lớp mới cùng giao diện) | 2026-10-08 | Đủ cho đồ án | `src/storage/*`, `.env.example` |
| D-T03 | Thanh toán: VNPay sandbox. Biến `VNPAY_*` để trống, optional trong schema env cho tới khi làm M10 | 2026-10-08 | Tài khoản đang đăng ký | `env.validation.ts`, `.env.example` |
| D-T04 | Không sửa Dockerfile web/worker (chưa triển khai Docker cho web) | 2026-10-08 | Chưa cần | MODULE_ENV_REPORT mục 6 |
| D-T05 | Response chuẩn `{ success, data, meta? }` và lỗi `{ success:false, error:{ code, message, details } }`; mã lỗi `ErrorCode` kèm HTTP; thông báo tiếng Việt; camelCase; ngày ISO 8601 UTC; tiền là số nguyên VND; phân trang `page`/`pageSize`, sắp xếp `sort=truong:asc\|desc`; DELETE trả 200 `data: null` (không dùng 204); user truy cập dữ liệu người khác nhận 404 | 2026-10-08 | Thống nhất FE/BE | API_CONVENTIONS, BAO_CAO mục 6 (đã sửa `limit`→`pageSize`) |
| D-T06 | Xác thực: JWT access 15 phút, refresh 7 ngày xoay vòng lưu băm trong `user_sessions`; guard JWT và roles đăng ký toàn cục, `@Public()` cho route công khai | 2026-10-06 (guard 2026-10-08) | Bảo mật và cho phép đăng xuất từ xa | API_CONVENTIONS mục 7, UC-AUTH, UC-ACC-03 |
| D-T07 | Kiểu dùng chung FE/BE: enum và entity SINH từ `schema.prisma` (`npm run types:generate`), loại bỏ trường nhạy cảm; CI kiểm tra đồng bộ | 2026-10-08 | Tránh lệch kiểu, FE không phụ thuộc Prisma | SHARED_TYPES_SYNC |
| D-T08 | Tiền tố `/api` cho mọi endpoint trừ `GET /health`; Swagger tại `/docs` | 2026-10-08 | Healthcheck gọn | API_CONVENTIONS |
| D-T09 | Controller quản trị tách file `admin-<module>.controller.ts`, lớp `Admin<X>Controller`, đặt `@Roles('admin')` ở cấp lớp, URL `/api/admin/...` | 2026-10-06; áp dụng 2026-10-08 | Tách rõ quyền | BAO_CAO mục 9, `apps/api/src/modules` |
| D-T10 | Cấu trúc code theo 14 module, mỗi controller riêng cho từng nhóm API (addresses, wishlist, notifications, variants, product-images, inventory…); khung rỗng có comment mã UC | 2026-10-08 | Khớp bảng ánh xạ MODULE_ENV_REPORT | `apps/api/src/modules/*` |
| D-T11 | Trang quản trị web ở `/admin/...` (thư mục `apps/web/src/app/admin`), thay route group `(admin)` vốn trùng `/products` với trang shop | 2026-10-08 | `next build` lỗi do trùng đường dẫn | `apps/web` |
| D-T12 | Web dùng Tailwind CSS 3 (cấu hình ở `apps/web/tailwind.config.ts`, `postcss.config.js`) | 2026-10-08 | Đã khai báo phụ thuộc, thiếu cấu hình | `apps/web` |
| D-T13 | Web dừng khởi động nếu thiếu `NEXT_PUBLIC_API_URL` (kiểm tra trong `next.config.js` và `src/lib/env.ts`) | 2026-10-08 | Lỗi rõ ràng sớm | README |
| D-T14 | Node ≥ 22 (`engines`, `.nvmrc` = 22), `packageManager` npm@11.19.0 (khớp bản đang dùng) | 2026-10-08 | Đồng nhất môi trường dev/CI/Docker | package.json, README |
| D-T15 | MỘT file `.env` ở thư mục gốc cho API, Prisma CLI, seed, test và web; Prisma CLI đọc qua `dotenv-cli` trong script `apps/api` (`dotenv -e ../../.env -- prisma ...`); Next đọc qua `@next/env` trong `next.config.js`; bỏ `apps/api/.env` | 2026-10-08 | Tránh hai bản `.env` lệch nhau | README, `package.json`, `.env.example` |
| D-T16 | Cổng: API 4000, web 3000 (cổng 4000 đã kiểm tra trống ngày 2026-10-08) | 2026-10-08 | Thống nhất `PORT`, `API_PORT`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS`, README | `.env.example`, README |
| D-T17 | Giới hạn tải lên mặc định: ảnh 5 MB, mô hình 100 MB, panorama 20 MB (`UPLOAD_MAX_IMAGE_MB`, `UPLOAD_MAX_MODEL_MB`, `UPLOAD_MAX_PANORAMA_MB`), chưa có code dùng | 2026-10-08 | Khớp NFR; thay giới hạn ảnh 10 MB nêu ở DAC_TA 12.2 | `env.validation.ts`, `.env.example`, DAC_TA 12.2 |
| D-T18 | Chất lượng: ESLint 8 + Prettier dùng chung toàn monorepo; husky + lint-staged + commitlint (Conventional Commits); GitHub Actions CI (lint, typecheck, test với PostgreSQL service); test e2e dùng DB riêng `aurelia_test` | 2026-10-08 | Giữ chất lượng khi nhiều người code | CONTRIBUTING |
| D-T19 | Commit theo Conventional Commits, kết thúc bằng dòng `Co-Authored-By`; không bao giờ commit `.env` | 2026-10-06 | Lịch sử rõ ràng, an toàn bí mật | CONTRIBUTING |
| D-T20 | Seed lấy email/mật khẩu admin từ `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (mặc định chỉ cho dev); production bắt buộc đặt mật khẩu | 2026-10-08 | Không để mật khẩu cố định trong mã | `prisma/seed.ts`, README |

## 5. Điểm còn mở

| Mã | Điểm | Mặc định đang áp dụng |
| --- | --- | --- |
| O-01 | Giới hạn tốc độ (đăng nhập, quên mật khẩu, thống kê ẩn danh): chưa cài `@nestjs/throttler` | Trả 429 khi làm M02 |
| O-02 | Callback thanh toán thành công đến sau khi đơn `cancelled` | Chỉ ghi payment `success`, cảnh báo admin hoàn tiền thủ công |
| O-03 | Vận đơn `failed`/`returned` khi đơn đang `shipping` | Chưa chốt; đề xuất admin hủy/hoàn tiền |
| O-04 | Xác nhận chuyển khoản (UC-ADM-24) tự chuyển đơn `pending → confirmed` | Có áp dụng (đề xuất) |
| O-05 | Sơ đồ ảnh trong `docs/diagrams` chưa xuất lại sau khi bỏ hàng đợi/MinIO và đổi `limit`→`pageSize`; file nguồn Mermaid trong BAO_CAO đã cập nhật | Xuất lại khi cần nộp báo cáo |
