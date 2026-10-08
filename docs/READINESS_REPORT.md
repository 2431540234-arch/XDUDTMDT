# Báo cáo đánh giá mức sẵn sàng viết code

> **ĐÃ LỖI THỜI (ghi chú 2026-10-08).** Báo cáo này lập trước khi có nền tảng backend, quy ước API (`API_CONVENTIONS.md`), đồng bộ shared-types, lint/test/CI, Redis + MinIO + hàng đợi và khung 14 module. Các mâu thuẫn M1-M4, M7-M8, M10 đã được xử lý. Xem hiện trạng: [MODULE_ENV_REPORT.md](MODULE_ENV_REPORT.md), [TIEN_DO.md](TIEN_DO.md), [DECISIONS.md](DECISIONS.md).

Dự án: **Aurelia Living** (website thương mại điện tử nội thất B2C, tích hợp xem 3D, AR và không gian mẫu 360°).
Phạm vi rà soát: toàn bộ workspace `C:\Users\Dell\XDUDTMDT` (chỉ đọc; file này là file duy nhất được tạo).

## 1. Tóm tắt điều hành

- **Dự án là gì:** monorepo `apps/api` (NestJS 10 + Prisma 5 + PostgreSQL 16), `apps/web` (Next.js 14 + React Three Fiber), `apps/mobile` (Android, ngoài phạm vi tài liệu), `packages/shared-types`. Nguồn: `package.json:4-8`, `docs/BAO_CAO_PHAN_TICH_THIET_KE.md:9-86`.
- **Kết luận: ⚠️ SẴN SÀNG CÓ ĐIỀU KIỆN.** Phần dữ liệu và nghiệp vụ đã rất đầy đủ; phần giao diện, hợp đồng API chi tiết, test/quy ước và hạ tầng container còn thiếu hoặc lệch. Không có mâu thuẫn mức "Chặn".
- **Tổng điểm: 28 / 36** (các tiêu chí 2, 3, 6, 9 đều đạt 3 điểm).
- **Hiện trạng code:** gần như chưa có code nghiệp vụ. `apps/api/src`: 56 file, chỉ 2 file có mã (`main.ts`, `common/utils/serialize.ts`); `apps/web/src`: 54 file, hầu hết là khung chỉ có dòng chú thích; `apps/api/test`: 1 file khung.
- **3 việc quan trọng nhất trước/song song khi code:**
  1. Chốt quy ước API chung (định dạng response, lỗi, phân trang) và viết schema request/response cho các endpoint của sprint đầu.
  2. Đồng bộ `packages/shared-types` với CSDL và sửa Dockerfile/compose cho khớp monorepo.
  3. Làm wireframe các màn hình chính trước khi code web; thiết lập lint, format, test, CI.

## 2. Bảng kiểm kê tài liệu và cấu hình

| Đường dẫn | Loại | Tóm tắt | Trạng thái |
|---|---|---|---|
| `README.md` (99 dòng) | Hướng dẫn | Cài đặt môi trường dev, script npm, xử lý lỗi | Đầy đủ (cho setup) |
| `docs/CAU_TRUC_DB.md` (85) | Nghiệp vụ CSDL | Mô tả bằng lời 44 bảng, 7 nhóm | Đầy đủ về nghiệp vụ; chưa đủ để viết migration (đã bù bằng `schema.prisma`) |
| `docs/DATABASE_SCHEMA.md` (1870) | Từ điển dữ liệu | Cột, kiểu, ràng buộc, ERD, trigger, ánh xạ bảng ↔ model | Đầy đủ |
| `docs/QUY_UOC_CODE_DB.md` (324) | Quy ước code | 8 quy ước bắt buộc khi code với CSDL (có ví dụ đúng/sai) | Đầy đủ (chỉ phần CSDL) |
| `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` (2092) | Đặc tả chức năng | 76 UC, ma trận quyền, vòng đời trạng thái, tích hợp ngoài | Đầy đủ (thiếu tiêu chí chấp nhận) |
| `docs/BAO_CAO_PHAN_TICH_THIET_KE.md` (8855) | Thiết kế | 61 Activity, 61 Sequence, 8 Class, 141 API, ánh xạ code, lộ trình | Đầy đủ (API thiếu schema chi tiết) |
| `docs/TONG_HOP_USE_CASE_KHACH_HANG.md` (91) | Use case | 45 UC khách hàng, 3 sơ đồ | Đầy đủ |
| `docs/KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md` (184) | Yêu cầu | Khảo sát, FR01-FR42, NFR01-NFR13 | Đầy đủ |
| `docs/diagrams/` (README, manifest, `src` 144 .mmd, `png` 144, `svg` 27, `khach-hang`) | Sơ đồ | Sơ đồ UML đã xuất ảnh | Đầy đủ |
| `database/*.sql` (00-07, run_all) + `database/README.md` | SQL tham khảo | Bản SQL thuần của CSDL | Đầy đủ (tham khảo, nguồn chuẩn là Prisma) |
| `apps/api/prisma/schema.prisma` (1127), `migrations/` (2), `seed.ts` (311) | CSDL thực thi | 44 model, 18 enum, migration `0_init` và `media_file_size_int`, seed idempotent | Đầy đủ |
| `docker-compose.yml` (78) | Hạ tầng | postgres (có healthcheck), redis, minio, api, worker, web | Postgres đầy đủ; api/worker/web chưa chạy được (mục 4) |
| `.env.example` (36) | Cấu hình | 19 biến (DB, Redis, S3, JWT, AI, web, seed) | Sơ sài (thiếu SMTP, cổng thanh toán…) |
| `package.json`, `turbo.json` (15), `apps/*/package.json`, `tsconfig*.json` | Cấu hình dự án | npm workspaces + turbo, script db:* | Đủ dùng; thiếu cấu hình lint/test |
| `infra/docker/Dockerfile.api|web|worker` | Hạ tầng | Build image | Sơ sài, lệch với monorepo |
| `packages/shared-types/src/*.ts` (5 file) | Mã dùng chung | Kiểu `User`, `Product`, `Cart`, `Space` | Sơ sài, lệch với CSDL |
| `apps/api/src/**` (56 file) | Mã backend | Module, controller, service, dto, guard | Chỉ là khung (2 file có mã) |
| `apps/web/src/**` (54 file, 8 trang) | Mã frontend | Trang, component, hook, store, service | Chỉ là khung |
| `apps/api/test/products.e2e-spec.ts` | Test | 1 file khung | Chỉ là khung |
| `apps/mobile/**` (66 file, 35 `.kt`) | Ứng dụng Android | Camera/overlay AR, catalog, cart | Khung; không có yêu cầu trong tài liệu |
| `.vscode/settings.json`, `.gitattributes` | Cấu hình editor/git | TS SDK; giữ LF cho migration | Đủ |
| `.github/modernize/java-upgrade/**`, `.qodo/` | Công cụ ngoài | Hook/agent của công cụ, không liên quan dự án | Không phải tài liệu dự án |
| Không tồn tại | — | `.github/workflows` (CI), `.eslintrc*`, `.prettierrc`, `.editorconfig`, `apps/api/test/jest-e2e.json`, wireframe/mockup, tài liệu chiến lược test, quy trình Git | Thiếu |

## 3. Bảng điểm 12 tiêu chí

| # | Tiêu chí | Điểm | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| 1 | Phạm vi và mục tiêu | **3** | `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md:5-31` (giới thiệu, phạm vi), `:2059` (hướng phát triển, ngoài phạm vi); `docs/KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md:1-12` | Chưa có chỉ tiêu thành công/mốc thời gian; phạm vi của `apps/mobile`, `ai`, `ar-overlay` chỉ nêu "ngoài phạm vi" |
| 2 | Tác nhân và phân quyền | **3** | `DAC_TA…:33-45` (3 vai trò + ngoại), `:130` (ma trận UC × vai trò, CRUD 44 model × 3 vai trò), `docs/QUY_UOC_CODE_DB.md:283` (quy tắc truy cập dữ liệu), `docs/DATABASE_SCHEMA.md:55` | Chưa quyết định có cho phép một tài khoản vừa `admin` vừa `user` (xem M5) |
| 3 | Danh sách chức năng | **3** | `DAC_TA…:47-129` (76 UC có mã, nhóm, vai trò, ưu tiên, model, nguồn); `KHAO_SAT…:92-160` (FR01-FR42 ↔ mã UC) | Hai hệ mã (UC và FR) cùng tồn tại, đã có cột ánh xạ |
| 4 | Đặc tả chức năng chi tiết | **2** | `DAC_TA…:555-2011` (61 UC chi tiết: tiền/hậu điều kiện, luồng chính, thay thế, ngoại lệ, quy tắc, dữ liệu vào/ra, trigger/Service) | **Không có tiêu chí chấp nhận** (không tìm thấy "tiêu chí chấp nhận/acceptance" trong `docs/`); 15 UC mở rộng chỉ mô tả ngắn |
| 5 | Mô hình UML | **3** | `BAO_CAO…:175` (61 Activity), `:3606` (61 Sequence), `:7233` (8 Class); `docs/diagrams/README.md:3` (144/144 sơ đồ xuất ảnh thành công) | Không có |
| 6 | Thiết kế cơ sở dữ liệu | **3** | `apps/api/prisma/schema.prisma` (1127 dòng), `migrations/0_init`, `docs/DATABASE_SCHEMA.md:122-1003` (cột, kiểu, PK/FK, unique, CHECK, partial index, enum, xóa mềm, `created_at/updated_at`), trigger `:1722` | Không có (CHECK/trigger nằm trong migration SQL, không hiện trong `schema.prisma`; đã có ghi chú ở `schema.prisma` đầu file) |
| 7 | Hợp đồng API | **2** | `BAO_CAO…:8303-8450` (141 endpoint: method, URL, controller.hàm, guard, tên DTO, tóm tắt response, mã UC); các UC có bảng "Dữ liệu vào/ra" kèm validate (`DAC_TA…:555-2011`) | **Chưa có** schema request/response cấp trường, định dạng lỗi chung, định dạng phân trang, định dạng bọc response (`BAO_CAO…:8846` ghi "chưa chọn"); chưa có file OpenAPI |
| 8 | Thiết kế giao diện | **1** | Chỉ có khung route/component: `apps/web/src/app/**` (8 trang), `components/**`; sơ đồ use case/Activity | **Không có wireframe/mockup, danh sách màn hình chính thức, luồng điều hướng** |
| 9 | Kiến trúc và công nghệ | **3** | `BAO_CAO…:9-86` (công nghệ, sơ đồ kiến trúc, cây thư mục), `package.json:4-8`, `turbo.json`, `DAC_TA…:1952` (tích hợp ngoài: VNPay/MoMo/ZaloPay, GHN/GHTK/Viettel Post, SMTP, MinIO) | Entry worker riêng chưa làm (đã quyết định giữ trong API: `DAC_TA…:2012`) |
| 10 | Môi trường và hạ tầng | **2** | `README.md:9-99` (cách chạy local), `docker-compose.yml:1-78`, `.env.example`, `package.json:15-21` (script db:*) | **Không có CI** (`.github/workflows` không tồn tại); Dockerfile lệch monorepo; biến môi trường cho SMTP/cổng thanh toán chưa có; chưa nêu nơi deploy |
| 11 | Yêu cầu phi chức năng | **2** | `KHAO_SAT…:164-182` (NFR01-NFR13: hiệu năng, tương thích, bảo mật, toàn vẹn, sao lưu, SEO); `DAC_TA…:1406` (giới hạn tệp 10 MB / 100 MB) | Chưa có chiến lược logging, rate limit cụ thể, CORS, chính sách sao lưu chi tiết, đa ngôn ngữ và khả năng truy cập chưa nêu |
| 12 | Kế hoạch kiểm thử và quy ước | **1** | `docs/QUY_UOC_CODE_DB.md` (quy ước code CSDL), `apps/api/prisma/seed.ts` (dữ liệu mẫu), `BAO_CAO…:8763` (nhắc "có test") | Không có chiến lược test, không có cấu hình lint/format (`eslint` được gọi ở `apps/api/package.json:10` nhưng không có trong dependency), thiếu `apps/api/test/jest-e2e.json` (`apps/api/package.json:12`), không có coding convention chung, không có quy trình Git |
| | **Tổng** | **28 / 36** | | |

Kiểm tra quy tắc kết luận: tiêu chí 2, 3, 6, 9 đều ≥ 2; không có mâu thuẫn mức "Chặn" → được phép kết luận "sẵn sàng có điều kiện".

## 4. Danh sách mâu thuẫn

| # | Mô tả | File A (vị trí) | File B (vị trí) | Mức | Đề xuất thống nhất |
|---|---|---|---|---|---|
| M1 | Kiểu dữ liệu dùng chung lệch CSDL: vai trò `"customer" \| "admin"` (CSDL: `admin`, `user`); `id` kiểu `string` (CSDL: số nguyên); `CartItem` dùng `productId` (CSDL: `variantId`); `Space` chỉ có một `panoramaUrl` và hotspot `{x,y,z}` (CSDL: nhiều `SpacePanorama`, hotspot `yaw/pitch`); `Product` có `price`, `model3dUrl` (CSDL: giá ở `ProductVariant`, mô hình ở `Product3DModel`) | `packages/shared-types/src/auth.types.ts:3-8`, `cart.types.ts`, `space.types.ts`, `product.types.ts` | `apps/api/prisma/schema.prisma`; `docs/DATABASE_SCHEMA.md:1791` (ánh xạ) | Cao | Viết lại `shared-types` từ `schema.prisma` (hoặc sinh từ DTO) trước khi web/api dùng chung |
| M2 | Container `api`/`worker`/`web` dùng `env_file: .env` nhưng `DATABASE_URL`, `REDIS_HOST`, `S3_ENDPOINT` trỏ `localhost` (trong container sẽ không tới được postgres/redis/minio) | `docker-compose.yml:41-47, 54-63, 65-73` | `.env.example:4, 7, 11` | Cao | Tách biến cho chế độ container (host `postgres`, `redis`, `minio`) hoặc dùng `environment:` ghi đè trong compose |
| M3 | Dockerfile chỉ COPY `apps/api/package.json` và `package.json` gốc (khai báo workspace `apps/web`, `packages/*`), không COPY `package-lock.json`, không chạy `prisma migrate deploy`; dùng `node:20` trong khi README ghi Node 24 | `infra/docker/Dockerfile.api:2, 5-8`; `Dockerfile.web:5-8`; `Dockerfile.worker:2` | `package.json:4-8`; `README.md:11` | Trung | Build theo workspace (copy lock + các `package.json` cần thiết), thống nhất phiên bản Node, thêm bước migrate khi khởi động |
| M4 | Script tham chiếu thứ không tồn tại: `eslint` không có trong dependency và không có cấu hình; `jest --config ./test/jest-e2e.json` nhưng file không có; `test` chạy `jest` không có cấu hình ts-jest | `apps/api/package.json:10-12` | thư mục `apps/api/` (không có `.eslintrc*`, `test/jest-e2e.json`, `jest.config.*`) | Trung | Bổ sung cấu hình lint/jest hoặc gỡ script |
| M5 | Tài liệu nghiệp vụ cũ nói "một người dùng có thể có nhiều vai trò"; quy tắc hiện hành chỉ có hai vai trò (`admin`, `user`), admin chỉ cần vai trò `admin`; cơ sở dữ liệu cho phép một user có cả hai, trigger chỉ gán `user` khi chưa có vai trò | `docs/CAU_TRUC_DB.md:15` | `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md:33-45`; `docs/DATABASE_SCHEMA.md:55`; `apps/api/prisma/seed.ts` (admin chỉ có `admin`) | Thấp | Quyết định rõ: (a) cho phép nhiều vai trò, quyền admin là hợp của các vai trò, hoặc (b) Service không bao giờ gán `user` cho admin; ghi vào QUY_UOC |
| M6 | `apps/mobile`, module `ai`, `ar-overlay` tồn tại trong repo nhưng tài liệu xếp ngoài phạm vi; không có yêu cầu/UC cho mobile | `apps/mobile/**`, `apps/api/src/modules/ai`, `ar-overlay` | `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md:2059-2072` | Trung | Quyết định giữ hay tách khỏi phạm vi giai đoạn này; ghi vào README |
| M7 | Cấu hình web: dùng `tailwindcss`/`postcss` nhưng không có `postcss.config.*`; `tailwind.config.ts` đặt trong `src/styles/` (vị trí không chuẩn) | `apps/web/package.json` (dependencies), `apps/web/src/styles/tailwind.config.ts` | thư mục `apps/web/` (không có `postcss.config.*`) | Trung | Thêm `postcss.config.js` và chuyển/ chỉ đường dẫn `tailwind.config` đúng |
| M8 | Route web `[id]` trong khi API/tài liệu dùng slug (đã ghi là cần sửa) | `apps/web/src/app/(shop)/products/[id]`, `spaces/[id]` | `docs/DAC_TA…:2012-2058` (quyết định #12), `docs/BAO_CAO…:8451+` | Thấp | Đổi tên thư mục thành `[slug]` khi làm web |
| M9 | Giới hạn kích thước: yêu cầu tệp phục vụ người xem ≤ 5 MB và tải lên GLB/USDZ ≤ 100 MB (đề xuất) | `docs/KHAO_SAT…:169` (NFR02) | `docs/DAC_TA…:1406, 2043` | Thấp | Ghi rõ trong một chỗ: tệp gốc tải lên (≤ 100 MB) khác tệp đã tối ưu phục vụ (≤ 5 MB) |
| M10 | Thư mục công cụ không liên quan dự án (`java-upgrade`) lẫn trong `.github`, chưa có workflow CI thật | `.github/modernize/java-upgrade/**` | — | Thấp | Dọn hoặc ghi chú; thêm `.github/workflows/ci.yml` |

Đối chiếu số lượng đã kiểm tra khớp nhau: "44 bảng" (`docs/CAU_TRUC_DB.md:3`, `schema.prisma`, `README.md:51`, `BAO_CAO…:17`), "36 trigger" (`DATABASE_SCHEMA.md:16`, `BAO_CAO…:17`), "76 UC" và "141 endpoint" giữa các tài liệu thiết kế. Không phát hiện bảng/model xuất hiện trong UML/API mà thiếu trong CSDL.

## 5. Việc cần làm trước khi code

| STT | Việc cần làm | Lý do | File cần tạo/sửa | Mức | Công sức (giờ) |
|---|---|---|---|---|---|
| 1 | Chốt quy ước API chung: định dạng response bọc, định dạng lỗi, phân trang, mã lỗi nghiệp vụ | Mọi controller phụ thuộc (`BAO_CAO…:8846`) | `docs/QUY_UOC_API.md`; `common/interceptors`, `common/filters` | Cao | 3 |
| 2 | Viết schema request/response cho endpoint sprint đầu (auth, users, addresses, catalog công khai, cart), lấy từ bảng "Dữ liệu vào/ra" của UC | Hợp đồng API mới ở mức tên DTO | `docs/API_CONTRACT.md` (hoặc OpenAPI) | Cao | 10 |
| 3 | Đồng bộ `packages/shared-types` với `schema.prisma` | Mâu thuẫn M1 | `packages/shared-types/src/*.ts` | Cao | 3 |
| 4 | Sửa Dockerfile và biến môi trường cho container; quyết định nơi deploy | M2, M3 | `infra/docker/*`, `docker-compose.yml`, `.env.example` | Cao | 4 |
| 5 | Làm wireframe các màn hình chính (≈ 20 màn: đăng nhập/đăng ký, trang chủ, danh sách và chi tiết sản phẩm kèm 3D/AR, giỏ hàng, thanh toán, đơn hàng, không gian mẫu, hồ sơ, admin: sản phẩm, đơn hàng, mô hình 3D, không gian mẫu) | Tiêu chí 8 chỉ 1 điểm; chặn việc code web | `docs/GIAO_DIEN.md` + hình | Cao (trước khi code web) | 16-24 |
| 6 | Thiết lập lint, format, `editorconfig`, jest (unit và e2e), sửa script | M4; tiêu chí 12 | `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `apps/api/test/jest-e2e.json`, `apps/api/package.json` | Cao | 4 |
| 7 | Viết quy ước code chung và quy trình Git (nhánh, commit, review, PR) | Tiêu chí 12 | `docs/QUY_UOC_CODE.md`, `CONTRIBUTING.md` | Trung | 3 |
| 8 | Viết chiến lược test (phạm vi unit/e2e, dữ liệu mẫu, các ca bắt buộc theo `QUY_UOC_CODE_DB.md` §5-6) | Tiêu chí 12 | `docs/KE_HOACH_KIEM_THU.md` | Trung | 4 |
| 9 | Thêm CI (lint, build, test, `prisma validate`, kiểm tra migration) | Tiêu chí 10 | `.github/workflows/ci.yml` | Trung | 4 |
| 10 | Bổ sung biến môi trường: SMTP, `MAIL_FROM`, `FRONTEND_URL`, CORS, khóa VNPay/MoMo/ZaloPay, URL công khai của S3 | Cần từ sprint xác thực (email) và sprint thanh toán | `.env.example`, `README.md` | Trung | 2 |
| 11 | Viết tiêu chí chấp nhận cho 29 UC Bắt buộc (dạng Given/When/Then) | Tiêu chí 4 | `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` hoặc `docs/TIEU_CHI_CHAP_NHAN.md` | Trung | 12 |
| 12 | Quyết định phạm vi `apps/mobile`, `ai`, `ar-overlay` (M6) và quy tắc đa vai trò (M5) | Tránh làm thừa/lệch | `README.md`, `docs/QUY_UOC_CODE_DB.md` | Trung | 2 |
| 13 | Bổ sung NFR còn thiếu: logging, rate limit, CORS, sao lưu, đa ngôn ngữ, khả năng truy cập | Tiêu chí 11 | `docs/KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md` | Trung | 3 |
| 14 | Sửa cấu hình web (postcss, tailwind), đổi route `[slug]` | M7, M8 | `apps/web/*` | Thấp | 2 |
| 15 | Dọn `.github/modernize/java-upgrade`, ghi chú `.qodo` | M10 | `.github/*` | Thấp | 0,5 |

## 6. Câu hỏi cần chủ dự án hoặc giảng viên trả lời

1. **Định dạng response chung:** `{ data }`, `{ success, data }` hay trả thẳng dữ liệu? (`BAO_CAO…:8846`)
2. **Đa vai trò (M5):** admin có được đồng thời mang vai trò `user` không?
3. **Phạm vi:** `apps/mobile`, module `ai` và `ar-overlay` có thuộc đồ án không? Nếu có cần bổ sung yêu cầu và UC.
4. **Nơi triển khai và thời hạn:** chạy demo cục bộ bằng Docker, hay deploy lên máy chủ/dịch vụ nào? Có yêu cầu CI/CD không?
5. **Cổng thanh toán:** có tài khoản sandbox VNPay, MoMo, ZaloPay không? Thanh toán thẻ đi qua VNPay (đã chốt) cần thông tin merchant nào?
6. **Email:** dùng nhà cung cấp SMTP nào (Gmail, SendGrid, Mailtrap…)?
7. **Vận chuyển:** giai đoạn này nhập tay (đã đề xuất) hay cần gọi API GHN/GHTK?
8. **Giao diện:** có mẫu thiết kế/Figma hoặc thương hiệu (màu, font, logo) có sẵn không?
9. **Nội dung 3D:** đã có tệp GLB/USDZ và ảnh 360° thật chưa, hay dùng dữ liệu giả để phát triển?
10. **Giới hạn kỹ thuật:** kích thước tải lên tối đa, giới hạn tốc độ gọi API, CORS, đa ngôn ngữ (chỉ tiếng Việt?).
11. **Yêu cầu nộp:** giảng viên có yêu cầu bắt buộc về tiêu chí chấp nhận, kế hoạch kiểm thử, hay quy trình Git không?

## 7. Đề xuất thứ tự triển khai

**Có thể bắt đầu ngay (không phụ thuộc điểm còn thiếu):**
- Nền tảng backend: `PrismaModule/PrismaService`, `ConfigModule` đọc `.env`, `main.ts` (prefix `api`, `ValidationPipe`, filter lỗi), guard (`JwtAuthGuard`, `RolesGuard`, `OptionalJwtAuthGuard`, `PermissionsGuard`), `ActivityLogInterceptor` (`BAO_CAO…:8451+`).
- Xác thực và tài khoản: UC-AUTH-01 đến 06, UC-ACC-01, 02, 04 (đủ đặc tả và model; email có thể dùng bộ gửi giả ở môi trường dev).
- Danh mục và sản phẩm (đọc công khai và quản trị): UC-CAT-01 đến 05, UC-ADM-04 đến 12.
- Giỏ hàng: UC-CART-01 đến 03.

**Phải chờ trước khi làm:**
- Toàn bộ giao diện web (chờ wireframe, việc 5).
- Quy ước response (việc 1) trước khi viết controller hàng loạt, nên chốt ngay đầu sprint.
- Đặt hàng và thanh toán (UC-ORD, UC-PAY): nên làm sau khi chốt cổng thanh toán và biến môi trường (việc 10).
- Mô hình 3D, AR, không gian mẫu (UC-3D, UC-SPACE): cần MinIO, hàng đợi và dữ liệu mẫu 3D/360°.

**Sprint 1 (tuần 1):** việc 1, 3, 6 (nền tảng, quy ước, lint/test) song song với khung backend: Prisma, config, guard, auth đầy đủ (UC-AUTH-01 đến 06) kèm test; CI cơ bản (việc 9).
**Sprint 2 (tuần 2):** users/addresses, categories/brands/attributes/products (công khai và quản trị), media upload, inventory, cart; viết schema API cho các endpoint này (việc 2) ngay trước khi code; web khung layout, đăng nhập/đăng ký và danh sách/chi tiết sản phẩm sau khi có wireframe mức thô.

## 8. Phụ lục

**File đã đọc đầy đủ:** `package.json`, `turbo.json`, `apps/api/package.json`, `apps/web/package.json`, `apps/api/tsconfig.json`, `docker-compose.yml`, `.env.example` (tên biến), `infra/docker/Dockerfile.api|web|worker` (phần đầu), `apps/api/src/main.ts`, `app.module.ts`, `packages/shared-types/src/*.ts`, `.vscode/settings.json`.

**File đọc theo cấu trúc (tiêu đề, grep, đếm dòng) vì do chính phiên làm việc này tạo và đã đối chiếu với `schema.prisma` khi tạo, không đọc lại từng dòng:** `docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md`, `docs/BAO_CAO_PHAN_TICH_THIET_KE.md`, `docs/DATABASE_SCHEMA.md`, `docs/QUY_UOC_CODE_DB.md`, `docs/TONG_HOP_USE_CASE_KHACH_HANG.md`, `docs/KHAO_SAT_VA_YEU_CAU_KHACH_HANG.md`, `docs/diagrams/README.md`, `README.md`, `database/*`, `apps/api/prisma/seed.ts`, `apps/api/prisma/schema.prisma`. `docs/CAU_TRUC_DB.md` đã đọc đầy đủ.

**File chỉ đọc dòng mô tả đầu file (khung):** các file trong `apps/api/src/**` (trừ `main.ts`, `app.module.ts`, `serialize.ts`) và `apps/web/src/**`.

**File không đọc / không đọc được:** `apps/mobile/**` (chỉ đếm file; 35 file Kotlin chưa đọc nội dung), `docs/diagrams/png|svg` (ảnh nhị phân; việc xuất ảnh đã được xác nhận thành công ở bước tạo), `package-lock.json`, `node_modules/`, `.env` (chứa khóa, cố ý không đọc), `.github/modernize/java-upgrade/**` và `.qodo/**` (công cụ ngoài, không liên quan). Không có file `.docx`/`.pdf` trong workspace.

**Điểm "Chưa xác định":** nội dung và API mà `apps/mobile` dự kiến gọi (không có tài liệu); nơi deploy và yêu cầu CI/CD (chưa có tài liệu); tiêu chuẩn hình ảnh/thương hiệu cho giao diện (chưa có tài liệu).
