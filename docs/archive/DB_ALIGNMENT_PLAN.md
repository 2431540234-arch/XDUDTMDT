> **Đã lưu trữ ngày 2026-11-11 – lý do: kế hoạch căn chỉnh DB ngày 2026-11-06 (44 bảng, có AR) đã thực hiện xong; thay bằng DATABASE_SCHEMA.md và DECISIONS.md.** Nội dung bên dưới được giữ nguyên, không còn phản ánh hiện trạng.

# DB_ALIGNMENT_PLAN – Đối chiếu code với bộ tài liệu DB chuẩn và kế hoạch sửa

> Agent tiếp nhận viết ngày 2026-11-06. **Chưa commit. Chưa sửa code, chưa tạo migration, chưa chạm `aurelia_dev`.**
> Quy tắc áp dụng: [CAU_TRUC_DB.md](../CAU_TRUC_DB.md), [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md), [QUY_UOC_CODE_DB.md](../QUY_UOC_CODE_DB.md) là **chuẩn**; chỗ code khác chuẩn = *code lệch*. Ba file này không được sửa cho khớp code. Chỗ ba file mâu thuẫn nhau được ghi ở mục 1.D, **không tự chọn bên**.
> Đã đọc hết: 3 file DB (đọc từng dòng phần mô tả/quy ước/trigger/nghiệp vụ; phần từ điển dữ liệu 44 bảng đối chiếu **bằng script** với DB thật), `CONG_NGHE.md`, và `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` (bảng 80 UC, ma trận, vòng đời trạng thái, mục 11–12; phần đặc tả luồng từng UC chỉ đọc các UC liên quan tới lệch).
> Cách đối chiếu: script đọc từ điển dữ liệu của DATABASE_SCHEMA.md (44 bảng, toàn bộ cột) và so với `information_schema`/`pg_constraint`/`pg_indexes`/`pg_trigger`/`pg_enum` của DB `aurelia_demo` (cùng 7 migration với `aurelia_dev`); nhận diện tên ràng buộc/index với `database/03,04_*.sql`. Số liệu bên dưới là kết quả script, không đoán.

## Tóm tắt số mục lệch

| Nhóm | Số mục | Ghi chú |
|---|---|---|
| **A** – chuẩn có, code thiếu (cấu trúc DB) | **0** | 44/44 bảng, mọi cột, kiểu, nullable, FK + ON DELETE, 287/287 tên ràng buộc/index trong `database/03,04`, 36/36 trigger, 19/19 enum gốc đều có trong DB |
| **A′** – chuẩn có, code thiếu (thành phần/hành vi) | **10** | mục 1.A′ |
| **B** – cả hai có nhưng khác | **19** | mục 1.B (cấu trúc 4, hành vi nghiệp vụ 9, mâu thuẫn nội bộ giữa các file chuẩn 6) |
| **C** – code có, chuẩn không có | **57** | 20 bảng + 7 enum + 1 giá trị enum + 29 cột (36 ràng buộc/index tên kèm theo) |
| Lệch công nghệ (CONG_NGHE.md) | 14 | mục 2 |
| UC có bảng/cột trong DB chuẩn nhưng code chưa làm đủ | 25 / 80 UC | mục 3 |

## 1. Bảng lệch DB

### 1.A Chuẩn có – code thiếu (cấu trúc)
Không có. (Đã kiểm: A_missingTables=0, A_missingCols=0, A_missingNamed=0, FK ON DELETE lệch=0, thiếu trigger/enum=0. Hai bảng gốc quan trọng cho luồng "xem 3D/AR" vẫn nguyên: `ar_sessions`, `ar_snapshots`, `model_material_variants`, `space_product_placements`, `space_views` — **có bảng, code gần như chưa dùng**, xem A′.)

### 1.A′ Chuẩn có – code thiếu (thành phần/hành vi)
| # | Mục | Tài liệu nói gì | Code đang là gì | Ảnh hưởng nếu sửa | Đề xuất |
|---|---|---|---|---|---|
| A′1 | `PermissionsGuard` + 6 quyền chi tiết | QUY_UOC §8 ("kiểm tra thêm quyền chi tiết `manage_users`…"), DATABASE_SCHEMA §2 (dòng cuối), DAC_TA §12.3 | `apps/api/src/common/guards/roles.guard.ts` chỉ kiểm tra role `admin`; `role_permissions` không được đọc ở runtime | thêm decorator `@Permissions()` cho ~70 route admin; thêm test; không đổi DB | **Giữ chuẩn**: làm guard; vì admin có đủ 6 quyền nên hành vi hiện tại không đổi |
| A′2 | `ActivityLogInterceptor` | DAC_TA §12.3 [CẦN TẠO MỚI]; QUY_UOC §8 "Ghi `activity_logs` cho mọi thao tác admin" | không có; 15 service tự gọi `ActivityLogService.log` | thêm interceptor hoặc rà soát từng route; test | **Giữ chuẩn** (user đã cho phép để vào nợ kỹ thuật ở lượt trước; xếp sau) |
| A′3 | Xác thực email (UC-AUTH-07) + bắt buộc để đánh giá | DAC_TA §12.1 #4, #9 (JWT `verify_email`, không thêm bảng) | không có API; `users.email_verified_at` có; `ReviewsService.create` không kiểm | thêm 2 endpoint + email + FE (chưa có màn hình) | **Hỏi** (Q4): FE chưa có màn xác thực |
| A′4 | Quản lý phiên đăng nhập (UC-ACC-03) | DAC_TA UC-ACC-03; `user_sessions` | không có API liệt kê/thu hồi | thêm 2 endpoint + FE | **Hỏi** phạm vi |
| A′5 | Xoá tài khoản (UC-ACC-07) | DAC_TA UC-ACC-07 | không có | endpoint + FE | **Hỏi** phạm vi |
| A′6 | Ghi `ar_sessions`, `ar_snapshots` (UC-3D-04..07), `OptionalJwtAuthGuard` | DAC_TA UC-3D-*, §12.3 | không có module/route; chỉ có bảng | 6–8 endpoint + FE | **Hỏi** (Q10): AR ngoài phạm vi? |
| A′7 | Ghi `space_views` (UC-SPACE-06, `sendBeacon`) | DAC_TA §12.1 #11; QUY_UOC §6 | `spaces.service.ts:123` tăng `view_count` trực tiếp, không ghi `space_views` | xem B-hành vi 6 | **Giữ chuẩn** |
| A′8 | IPN/return VNPAY (UC-PAY-02) | DAC_TA §11.1 | không có | Mốc 4 | Mốc 4 |
| A′9 | Quản lý vai trò/quyền, thuộc tính, thương hiệu, media, biến thể chất liệu 3D, placement 3D, gửi thông báo thủ công, xem nhật ký, thống kê AR (ADM-02/04/06/08/14/17/26/27/29/30) | DAC_TA mục 3 | không có route admin (bảng có) | nhiều endpoint + FE | **Hỏi** phạm vi (Q10) |
| A′10 | Quản lý vận đơn tách riêng (UC-ADM-25) | DAC_TA UC-ADM-25, §12.1 #14: vận đơn `delivered` ⇒ đơn `completed` | `AdminOrdersService.updateShipment` chỉ sửa hãng/mã vận đơn; trạng thái vận đơn chỉ đổi theo trạng thái đơn (ngược chiều) | thêm `PATCH shipment {status}` + đồng bộ đơn | **Hỏi** (Q9) |

### 1.B Có ở cả hai nhưng khác
Cấu trúc:
| # | Mục | Tài liệu nói gì | Code đang là gì | Ảnh hưởng nếu sửa | Đề xuất |
|---|---|---|---|---|---|
| B1 | Kiểu khoá chính | DATABASE_SCHEMA "Quy ước thiết kế" (dòng 47) + mục 4 đầu: `INTEGER GENERATED ALWAYS AS IDENTITY`; QUY_UOC §2/§7 (`pk_`…) | **20 bảng mới dùng `SERIAL`** (`migrations/20261106055235_add_backend_extras/migration.sql`, ví dụ `"id" SERIAL NOT NULL`); 44 bảng gốc là IDENTITY | `ALTER … DROP DEFAULT, ADD GENERATED ALWAYS AS IDENTITY (START WITH max+1)`. `INSERT` có id tường minh (seed-mock dùng `OVERRIDING SYSTEM VALUE` nên ổn; Prisma `createMany` có id sẽ lỗi — cần rà). Dữ liệu `aurelia_dev`: 20 bảng mới **đều rỗng** nên không mất gì | **Đổi cho đúng chuẩn** (migration M1) |
| B2 | Trigger `updated_at` | DATABASE_SCHEMA §6 #1 ("mọi bảng có `updated_at`… thêm bảng mới không cần sửa file"); QUY_UOC §6 | vòng lặp tạo trigger chỉ chạy trong `0_init`; **`product_360_configs` và `return_requests` có `updated_at` nhưng không có trigger** (kiểm bằng `pg_trigger`: 29 trigger, 2 bảng thiếu) | thêm 2 trigger; không đổi dữ liệu | **Sửa** (M2) |
| B3 | `COMMENT ON` tiếng Việt | QUY_UOC §7 ("Kèm `COMMENT ON` tiếng Việt cho bảng/cột mới"); DATABASE_SCHEMA mục 4 lấy mô tả từ `COMMENT ON` | 0 comment trên 20 bảng mới (bảng gốc có, ví dụ `users` 14) | chỉ thêm comment | **Sửa** (M3) |
| B4 | Enum `coupon_type` | DATABASE_SCHEMA `coupons.type`: "percent hoặc fixed" (+`database/02_types.sql`) | `percent, fixed, freeship` (migration `coupon_freeship_value` nới CHECK `ck_coupons_value`) | nếu bỏ: xoá mã `freeship` đang có (dev: kiểm); đổi FE khuyến mãi | **Hỏi** (Q5) — gộp: `fixed` với `value=phí ship`? |

Hành vi nghiệp vụ (code khác chuẩn):
| # | Mục | Tài liệu nói gì | Code đang là gì | Ảnh hưởng nếu sửa | Đề xuất |
|---|---|---|---|---|---|
| B5 | Trừ tồn kho | QUY_UOC §5.1; DATABASE_SCHEMA §7 #1; DAC_TA §12.1 #5: **trừ `stock_quantity` khi tạo đơn**, movement `sale` tại thời điểm đặt | `orders.service.ts:230-233` chỉ tăng `reserved_quantity`; trừ thật + movement `sale` khi đơn sang `shipping` (`admin-orders.service.ts:~195`). Cột `product_variants.reserved_quantity` là cột ngoài chuẩn | đổi nghiệp vụ đã được **chính bạn xác nhận ở lượt đầu** ("giữ chỗ khi tạo đơn, trừ khi sang Đang giao"); ảnh hưởng đặt/hủy/giao/đổi trả, `stockQuantity` API (đang = tồn − giữ), 47+ test, FE "tồn" admin; dữ liệu dev: `reserved_quantity` mọi dòng = 0 cần xác minh | **Hỏi** (Q1). Nếu theo chuẩn: bỏ `reserved_quantity`, trừ ngay, trả khi hủy |
| B6 | `sold_count` | QUY_UOC §5.2; DATABASE_SCHEMA §7 #2: tăng **khi đơn `completed`** (QUY_UOC ghi rõ ❌ "tăng ngay khi đặt hàng") | `orders.service.ts:236` tăng khi đặt, `:359` giảm khi hủy | chuyển sang `setStatus('completed')`; backfill không an toàn (dữ liệu dev là số tay); test | **Sửa theo chuẩn**, không backfill dữ liệu cũ |
| B7 | `spaces.view_count` | QUY_UOC §6: "KHÔNG làm `viewCount: { increment: 1 }`", chỉ `spaceView.create` (trigger tăng) | `spaces.service.ts:123` tăng trực tiếp, không ghi `space_views` | ghi `space_views` (visitorId/userId); FE chưa gửi `visitorId`/`sendBeacon` | **Sửa theo chuẩn** (BE; FE phụ thuộc Q10) |
| B8 | Luồng reset mật khẩu | DAC_TA §12.1 #21 / D-T29: "không có OTP"; `password_resets` lưu `token_hash` | code dùng **OTP 6 số** (cột ngoài chuẩn `otp_hash`, `attempts`, `last_sent_at`), vì FE/mock gọi `forgot-password` rồi `reset-password` với mã OTP 6 số (`OTP_FIXED_CODE`) | đổi sang token-link cần sửa FE 2 màn hình (30/31) | **Hỏi** (Q3) |
| B9 | Quyền đổi trạng thái đơn & hủy | DATABASE_SCHEMA §2 ma trận: user "hủy khi còn `pending`" | code (và DAC_TA §12.1 #1): user hủy ở `pending|confirmed` | chuẩn tự mâu thuẫn (xem D3) | theo DAC_TA/bạn đã chốt; ghi lại |
| B10 | Hoàn tất đơn ↔ vận đơn | DAC_TA §12.1 #14: vận đơn `delivered` ⇒ đơn `completed` | ngược lại: đơn `completed` ⇒ `shipments.delivered` | xem A′10 | **Hỏi** (Q9) |
| B11 | Giới hạn tệp 3D | DAC_TA §12.2 #2: GLB/USDZ ≤ 100 MB (`UPLOAD_MAX_MODEL_MB`) | code ≤ **50 MB** cứng (`model-file-validator.ts: MODEL_MAX_BYTES`), không đọc biến môi trường | đổi hằng số/biến env | **Hỏi** (Q10b) — 50MB là yêu cầu Mốc 3 của bạn |
| B12 | Mã đơn | DAC_TA §12.2 #1: `ALV-YYYYMMDD-NNNN`, "thử lại khi trùng" | bảng đếm `code_counters` (UPSERT nguyên tử) | xem C: nếu bỏ bảng, quay về UNIQUE + retry | **Hỏi** (Q5) |
| B13 | Hoàn tiền | DAC_TA UC-ADM-23: admin đổi đơn sang `refunded` thủ công | thêm luồng `return_requests` tự hoàn tiền, tạo `expenses` (ngoài chuẩn) | xem C | giữ, thuộc nhóm C |

Tài liệu chuẩn mâu thuẫn nhau (**không tự chọn**):
| # | Mâu thuẫn | Vị trí | Ghi chú |
|---|---|---|---|
| D1 | "3 loại người dùng" (admin, user, khách vãng lai) vs "2 vai trò trong CSDL + khách không lưu" | DATABASE_SCHEMA §2 đầu vs QUY_UOC §8, CAU_TRUC_DB mục 2 | thực chất cùng ý; nên thống nhất cách đếm |
| D2 | "18 ENUM" vs `database/02_types.sql` có 19 `CREATE TYPE` và DB gốc có 19 enum | DATABASE_SCHEMA §1 bảng tổng quan | một trong hai số sai |
| D3 | Khách hủy đơn khi `pending` (ma trận §2) vs `pending|confirmed` (DAC_TA §12.1 #1) | DATABASE_SCHEMA §2 vs DAC_TA | code theo DAC_TA |
| D4 | QUY_UOC §5.4 ví dụ dùng quan hệ `items: { some: … }` nhưng model Prisma là `orderItems` (`schema.prisma:452`) | QUY_UOC §5.4 | lỗi ví dụ trong chuẩn |
| D5 | QUY_UOC §7 bắt "cập nhật DATABASE_SCHEMA.md" sau mỗi migration, nhưng quy tắc mới của bạn cấm sửa file chuẩn cho khớp code | QUY_UOC §7 vs yêu cầu của bạn | cần xác định: các bảng/cột *được giữ* ở mục C sẽ được bổ sung vào chuẩn bởi ai/khi nào |
| D6 | DATABASE_SCHEMA đầu file: "nguồn chuẩn cấu trúc là `apps/api/prisma`", `database/` chỉ tham khảo | DATABASE_SCHEMA đầu | trái với quy tắc mới (3 file .md là chuẩn). Hiện Prisma = 64 model |

### 1.C Code có – chuẩn không có
Cột "Dùng bởi" lấy từ grep trong `apps/api/src`, `prisma/seed*.ts` và test. Test: **E2** = `test/mock-m2.db-spec.ts`, **E3** = `test/mock-m3.db-spec.ts`, **PW** = Playwright `test:e2e:real`, **U** = unit test. (Phần lớn kiểm qua HTTP, không có test trực tiếp theo bảng.)

**Bảng mới (20)** — DAC_TA không có UC nào cho những mục này; chúng sinh ra từ 54 màn hình FE (mock là hợp đồng, xem PROJECT_ANALYSIS.md dòng 211).
| # | Bảng | Chức năng cần | Dùng bởi (code / test) | Ảnh hưởng nếu bỏ | Đề xuất |
|---|---|---|---|---|---|
| C1 | `product_specs` | tab "Thông số" form sản phẩm, bảng thông số ở trang chi tiết (FE màn 17/3) | `admin-products.service.ts`, `catalog-views.service.ts` / E2, PW | mất thông số hiển thị | **Giữ + đổi chuẩn** (IDENTITY, trigger, comment). Phương án khác: gộp vào `products` dạng JSONB (mất bảng, mất sắp xếp ràng buộc) |
| C2 | `product_360_configs`, `product_360_frames` | Xem 360° sản phẩm (PROMPT_360, DAC_TA chỉ nhắc 3 lần) | `product-360.service.ts`, `admin-products.service.ts` / E2, PW (8 test 360°) | mất tính năng 360° | **Giữ + đổi chuẩn**. Ghi nhận: PROMPT_360 đề xuất tên `product_360`/`size_value_id`, code khác (xem ONBOARDING_NOTES §4.3F) |
| C3 | `review_images` | ảnh đính kèm đánh giá (≤5) | `reviews.service.ts` / E3 | mất ảnh đánh giá | **Giữ + đổi chuẩn** (có thể gộp vào `media` + bảng nối đã đủ) |
| C4 | `product_questions` | Hỏi đáp sản phẩm (FE màn 50) | `questions.service.ts`, `admin-questions.service.ts` / E3, PW | mất hỏi đáp (FE 404) | **Giữ + đổi chuẩn** hoặc **xoá** nếu hỏi đáp ngoài phạm vi (cần quyết định) |
| C5 | `coupon_scopes` | mã giảm giá theo sản phẩm/danh mục/không gian (khuyến mãi FE) | `admin-coupons.service.ts`, `coupons.service.ts` / E2 | chỉ còn mã áp mọi đơn | **Giữ** (khoá đa hình `target_id` không có FK – nên ghi rõ) hoặc gộp `coupons.applies_to` + JSONB |
| C6 | `user_coupons` | "mã đã lưu" của khách (màn 9) | `coupons.service.ts` / E2 | mất "lưu mã" | **Giữ + đổi chuẩn** |
| C7 | `code_counters` | cấp mã `ALV-…`, `RT…`, phiếu kho, phiếu chi không trùng khi đồng thời | `common/utils/code-generator.ts` (SQL thô) / E2 (6 đơn đồng thời) | quay về UNIQUE + retry (DAC_TA §12.2 #1) | **Hỏi** (Q5) |
| C8 | `return_requests`, `return_request_items`, `return_request_images` | đổi trả (màn 35, 45) — DAC_TA chỉ có "hoàn tiền thủ công" UC-ADM-23 | `returns.service.ts`, `admin-returns.service.ts` / U (7 ngày, số lượng), E3, PW | mất đổi trả khách + admin | **Giữ + đổi chuẩn** (chức năng đã được bạn giao ở Mốc 3) |
| C9 | `suppliers`, `stock_receipts`, `stock_receipt_items` | trang Kho hàng: phiếu nhập/xuất, nhà cung cấp (màn 53) — DAC_TA UC-ADM-12 chỉ dùng `inventory_movements` | **chưa module nào dùng** (Mốc 4) / không có test | không mất gì (rỗng, chưa dùng) | **Quyết định trước Mốc 4** (Q6): (a) giữ; (b) gộp phiếu vào `inventory_movements` (+ `reference_code`) và lưu nhà cung cấp là chữ; (c) xoá |
| C10 | `expenses` | Thu chi / báo cáo (màn 54) — đã được hoàn tiền đổi trả ghi vào | `admin-returns.service.ts`, `admin-orders.service.ts` / E2, E3 | mất phiếu chi hoàn tiền | **Giữ + đổi chuẩn** (không có chỗ gộp tự nhiên) |
| C11 | `banners`, `posts` | Admin nội dung: banner, bài viết (màn 51) | `admin-content.service.ts`, `content.service.ts` / E3, PW | mất nội dung trang chủ/blog | **Giữ + đổi chuẩn**. Phương án gộp `posts`→`pages` (đã có `pages.type`) cần thêm cột ảnh bìa/chuyên mục/lượt xem nên không đỡ hơn |
| C12 | `faq_topics`, `faq_items` | trang FAQ (màn 39); admin FAQ (6 route) **FE chưa gọi** | `content.service.ts`, `admin-content.service.ts` / E3 | mất FAQ | **Gộp** vào `settings` (key JSON `faq`) hoặc `pages` — đỡ 2 bảng; hoặc giữ |
| C13 | `contact_messages` | form Liên hệ (màn 38). CAU_TRUC/DAC_TA có nhắc "liên hệ" (3 lần, chưa kiểm ngữ cảnh) | `content.service.ts`, `admin-content.service.ts` / E3 | mất lưu tin nhắn | **Giữ + đổi chuẩn** (chưa rõ ngữ cảnh DAC_TA) |

**Enum mới (7) và giá trị mới (1):** `question_status` (C4), `return_type`/`return_reason`/`return_status` (C8), `stock_receipt_type`/`stock_receipt_status` (C9), `expense_category` (C10), `banner_position` (C11) — đi theo bảng tương ứng. `coupon_type.freeship` (B4): dùng bởi `coupons.service.ts` `calcDiscount` + mã miễn ship trong dữ liệu mock/seed/FE.

**Cột mới trên bảng chuẩn (29)** — đề xuất theo cụm:
| Cột | Chức năng cần | Dùng bởi | Đề xuất |
|---|---|---|---|
| `users.birthday, gender, loyalty_points, admin_note` | hồ sơ khách (màn 8), "điểm tích luỹ", ghi chú admin (màn 46) | `users.service.ts`, `admin-users.service.ts`, seed | Giữ + đổi chuẩn; `loyalty_points` chưa rõ có logic cộng điểm (chưa rõ) |
| `password_resets.otp_hash, attempts, last_sent_at` | OTP (B8) | `auth.service.ts` | theo Q3 |
| `addresses.label` | nhãn "Nhà riêng/Công ty" | `addresses.service.ts` | Giữ |
| `categories.description, is_featured` | mô tả, nổi bật trang chủ | `categories.service.ts` | Giữ |
| `pages.type` | phân loại trang tĩnh / chính sách | `content.service.ts` | Giữ |
| `products.features (jsonb), style` | đặc điểm nổi bật, phong cách | `catalog-views.service.ts`, `admin-products.service.ts` | Giữ (có thể gộp `features` vào `product_specs`) |
| `attribute_values.color_hex` | màu swatch + 360° | `catalog-views.service.ts`, `product-360.service.ts` | Giữ |
| `product_variants.cost_price, min_stock, length_cm, width_cm, height_cm, reserved_quantity` | giá vốn (báo cáo), cảnh báo tồn thấp, kích thước, giữ chỗ | nhiều service | Giữ, **trừ `reserved_quantity` (B5)** |
| `reviews.is_anonymous, tags` | đánh giá ẩn danh, thẻ | `reviews.service.ts` | Giữ |
| `carts.coupon_id` | mã đã áp trong giỏ (mock lưu trong giỏ; chuẩn D-N16 "chỉ xem trước") | `cart.service.ts` | **Hỏi**: chuẩn nói áp mã chỉ xem trước, không lưu |
| `coupons.name, description, applies_to, applies_to_label` | tên/mô tả/phạm vi hiển thị | `admin-coupons.service.ts` | Giữ |
| `orders.internal_note` | ghi chú nội bộ admin | `admin-orders.service.ts` | Giữ |
| `order_items.cost_price, image_media_id, variant_label` | giá vốn tại thời điểm bán, ảnh/nhãn chụp lại | `orders.service.ts`, `order-views.service.ts` | Giữ |
| `spaces.combo_discount_percent` | % giảm combo | `spaces.service.ts` | Giữ |
> Ghi chú: lần chạy đầu script báo nhầm `space_product_placements.scale/created_at/updated_at`, `model_files.*`, `products.deleted_at…` là cột thừa; đã mở DATABASE_SCHEMA mục 42/26/16 xác nhận các cột này **có** trong chuẩn nên đã loại. 29 cột còn lại đều không có trong từ điển.

**Ràng buộc/index mới (36 tên):** `ck_*` (8), `uq_*`/`idx_*` (28) trên các bảng ở trên, thêm `idx_products_name_unaccent_trgm` (UC-CAT-06, DAC_TA §12.3 **đã yêu cầu** làm migration này). Đi theo bảng.

## 2. Lệch công nghệ (CONG_NGHE.md ↔ code/cấu hình thật)
Phiên bản thực cài (đọc `node_modules`/`package.json`): Next 14.2.35, React 18.3.1, TS 5.7.2, Tailwind 3.4.19, Zustand 4.5.7, TanStack Query 5.104.1, Three 0.163.0, R3F 8.18.0, drei 9.122.0, model-viewer 3.5.0, RHF 7.89.0, Recharts 2.15.4, Vitest 5.0.3, Playwright 1.64.0, NestJS 10.4.22, Swagger 7.4.2, Prisma 5.22.0, BullMQ 5.81.5, ioredis 5.11.1, throttler 6.7.1, sharp 0.35.5, glTF-Transform 4.5.1, Jest 29.7.0, supertest 7.3.1 (CONG_NGHE ghi 7.3.1). **Phiên bản trùng với tài liệu** (trừ các dòng dưới). PostgreSQL 16-alpine, Redis 7-alpine, Mailpit, MinIO bitnamilegacy 2025.4.22 trùng compose.
| # | Mục | CONG_NGHE.md nói | Thực tế | Ghi chú |
|---|---|---|---|---|
| T1 | Trạng thái toàn bộ | mục 1, 2.1, 6: "chưa có truy vấn / store rỗng / 3 unit test / 2 e2e / 13 route / 144 endpoint / 6 route cài / 44 bảng / 2 migration" | 152 route, 64 model, 7 migration; unit API 87 + web 17, supertest 94, Playwright 20; 54 màn hình | tài liệu chụp 2026-10-09 |
| T2 | Prisma, Nest khai báo | "5.22.0", "10.4.22" | `apps/api/package.json` khai báo `^5.14.0`, `^10.3.0` (cài thực 5.22.0 / 10.4.22) | khai báo lỏng hơn bản cài |
| T3 | Thư viện ngoài danh sách | không có | `sanitize-html@2.13.0` + `@types/sanitize-html` (lọc HTML, ghim bản); `dotenv-cli`; `htmlparser2` gián tiếp | cần thêm vào CONG_NGHE mục 5 |
| T4 | Soạn bài viết | mục 4: "Tiptap không dùng; trang tĩnh soạn bằng textarea Markdown" | BE lọc **HTML** bằng `sanitize-html` (`sanitizeRichText`) cho nội dung bài viết/trang | định dạng nội dung không còn là Markdown (chưa rõ FE render bằng gì) |
| T5 | Lưu tệp | dev dùng MinIO ("Đã dùng") | demo/test chạy `STORAGE_DRIVER=local` (thư mục `apps/api/uploads`, URL `/uploads`) | MinIO vẫn trong compose nhưng API đang chạy không dùng |
| T6 | Hàng đợi BullMQ | "Đã dùng, 4 queue" | các processor tồn tại nhưng chỉ `MailService` (quên mật khẩu, tạo khách từ admin) và route presign cũ dùng; upload mô hình **không** qua `model-processing` (không sinh LOD/đo đa giác) | glTF-Transform/sharp "Đã dùng" chỉ trong luồng presign mà FE không gọi |
| T7 | Cache Redis | "Đã cấu hình; áp dụng ở M06, M07, M01" | không module nào dùng `CacheService`; sản phẩm dùng chỉ mục RAM 15s | khác chuẩn D-T30 |
| T8 | Xác thực | `class-validator` kiểm tra dữ liệu vào | route nghiệp vụ dùng hàm tay `FieldErrors/validate.ts`; `class-validator` chỉ còn ở DTO của media/model presign và pagination | thông báo lỗi tiếng Việt theo từng trường như mock |
| T9 | Swagger | `/docs` | `/api/docs` (`app.setup.ts`) | |
| T10 | Compose | dịch vụ `api` chạy mặc định | `api` nằm trong profile `legacy`; có `postgres-test` (profile `test`), `worker`/`web` (profile `later`) | |
| T11 | Node | ≥ 22 (`.nvmrc` 22, CI 22) | máy dev Node 24.20, npm 11.19 | khớp "yêu cầu ≥ 22" |
| T12 | Mobile | Android "Đã cấu hình", 39 file Kotlin khung | `apps/mobile` chưa có chức năng (không kiểm tra lại) | ngoài phạm vi lượt này |
| T13 | Express/Next build | `next build` "13 route" | 54 trang (`app/**/page.tsx`) | |
| T14 | JWT/refresh | JWT access + refresh | access 12h cho dev vì **FE không gọi `/auth/refresh`** | |

## 3. Bảng chức năng theo đặc tả (80 UC)
Cột: **DB** = chuẩn có bảng/cột chưa · **BE** = route trong code · **FE** = có màn hình/lời gọi · **Mốc** (M1–M4 theo kế hoạch BE; "—" = chưa thuộc mốc nào). ⚠ = **DB chuẩn có bảng/cột nhưng code chưa làm** (danh sách ở cuối).

| Mã | Vai trò | DB | BE | FE | Mốc |
|---|---|---|---|---|---|
| UC-AUTH-01 Đăng ký | Khách | có | có | có | M1 |
| UC-AUTH-02 Đăng nhập | Khách/User/Admin | có | có | có | M1 |
| UC-AUTH-03 Làm mới token | User/Admin | có | có (`/auth/refresh`) | **không gọi** | M1 |
| UC-AUTH-04 Đăng xuất | User/Admin | có | có | có | M1 |
| UC-AUTH-05 Quên mật khẩu | tất cả | có (+cột OTP ngoài chuẩn) | có (OTP) | có | M1 |
| UC-AUTH-06 Đặt lại mật khẩu | tất cả | có | có | có | M1 |
| UC-AUTH-07 Xác thực email ⚠ | User | có (`email_verified_at`) | **không** | không | — |
| UC-ACC-01 Hồ sơ | User/Admin | có | có | có | M1 |
| UC-ACC-02 Đổi mật khẩu | User/Admin | có | có | có | M1 |
| UC-ACC-03 Quản lý phiên ⚠ | User/Admin | có (`user_sessions`) | **không** | không | — |
| UC-ACC-04 Sổ địa chỉ | User | có | có | có | M1 |
| UC-ACC-05 Thông báo | User | có | có | có | M1/M3 |
| UC-ACC-06 Yêu thích | User | có | có | có | M1 |
| UC-ACC-07 Xoá tài khoản ⚠ | User | có (`deleted_at`) | **không** | không | — |
| UC-CAT-01..06 Trang chủ, danh mục, tìm kiếm, chi tiết, trang tĩnh, tìm không dấu | tất cả | có | có | có | M1 |
| UC-CART-01..04 Giỏ, số lượng, mã giảm giá | User | có | có | có | M1 |
| UC-ORD-01 Đặt hàng | User | có | có | có | M1 |
| UC-ORD-02 Theo dõi đơn | User | có | có | có | M1 |
| UC-ORD-03 Hủy đơn | User | có | có | có | M1 |
| UC-PAY-01 Thanh toán online | User | có | **giả lập** (không cổng thật) | có | M1 → thật: M4 |
| UC-PAY-02 IPN VNPAY ⚠ | Hệ thống ngoài | có (`payments.gateway_response`) | **không** | – | M4 |
| UC-PAY-03 Thanh toán lại | User | có | có (giả lập) | có | M1 |
| UC-REV-01 Xem đánh giá | tất cả | có | có | có | M1 |
| UC-REV-02 Đánh giá sản phẩm đã mua | User | có | có (thiếu bắt buộc xác thực email) | có | M1/M3 |
| UC-REV-03 Sửa/xoá đánh giá | User | có | có | có | M1/M3 |
| UC-3D-01 Xem 3D | tất cả | có | có | có | M1/M3 |
| UC-3D-02 Xem AR ⚠ | tất cả | có (`product_3d_models`, `ar_sessions`) | không ghi phiên | có (nút + QR minh hoạ) | — |
| UC-3D-03 Đổi màu/chất liệu 3D ⚠ | tất cả | có (`model_material_variants`) | **không** | không | — |
| UC-3D-04 Chụp & lưu ảnh AR ⚠ | User | có (`ar_snapshots`) | **không** | không | — |
| UC-3D-05 Quản lý ảnh AR của tôi ⚠ | User | có | **không** | không | — |
| UC-3D-06 Ảnh AR công khai ⚠ | tất cả | có | **không** | không | — |
| UC-3D-07 Thống kê phiên 3D/AR ⚠ | tất cả | có (`ar_sessions`) | **không** | không | — |
| UC-SPACE-01..04 Duyệt, xem 360°, bấm hotspot, lưu | tất cả/User | có | có | có | M1/M3 |
| UC-SPACE-05 Thử đổi món ⚠ | tất cả | có (`space_product_placements`) | đọc `placements`, không ghi | không | — |
| UC-SPACE-06 Ghi lượt xem ⚠ | tất cả | có (`space_views`) | **lệch**: tăng `view_count` trực tiếp | không (`sendBeacon` chưa có) | — |
| UC-ADM-01 Người dùng | Admin | có | có | có | M2 |
| UC-ADM-02 Vai trò/quyền ⚠ | Admin | có | **không** | không | — |
| UC-ADM-03 Cài đặt ⚠ | Admin | có (`settings`) | chỉ `GET /settings/public` | có (trang, gọi route chưa có) | M4 |
| UC-ADM-04 Media ⚠ | Admin | có | khung presign cũ, FE không dùng | không (FE gửi data-URL) | — |
| UC-ADM-05 Danh mục | Admin | có | có | có | M2 |
| UC-ADM-06 Thương hiệu ⚠ | Admin | có | chỉ `GET /brands` | không | — |
| UC-ADM-07 Trang tĩnh | Admin | có | có | có | M3 |
| UC-ADM-08 Thuộc tính ⚠ | Admin | có | chỉ qua form sản phẩm | không | — |
| UC-ADM-09, 10, 11 Sản phẩm, biến thể, ảnh | Admin | có | có (`/admin/products`) | có | M2 |
| UC-ADM-12 Nhập kho/điều chỉnh ⚠ | Admin | có (`inventory_movements`) | **không** | có (trang, gọi route chưa có) | M4 |
| UC-ADM-13 Mô hình 3D | Admin | có | có | có (metadata) | M3 |
| UC-ADM-14 Biến thể chất liệu 3D ⚠ | Admin | có | **không** | không | — |
| UC-ADM-15, 16 Không gian + hotspot | Admin | có | có (hotspot không lưu variantId) | có | M3 |
| UC-ADM-17 Placement 3D trong ảnh 360° ⚠ | Admin | có | **không** | không | — |
| UC-ADM-18 Duyệt đánh giá | Admin | có | có | có | M3 |
| UC-ADM-19 Mã giảm giá | Admin | có | có | có | M2 |
| UC-ADM-20..22 Đơn: xem, trạng thái, hủy | Admin | có | có | có | M2 |
| UC-ADM-23 Hoàn tiền | Admin | có | có (+ luồng đổi trả) | có | M2/M3 |
| UC-ADM-24 Xác nhận chuyển khoản | Admin | có | có | có | M2 |
| UC-ADM-25 Vận chuyển ⚠ | Admin | có (`shipments`) | một phần (hãng/mã; trạng thái chỉ đổi theo đơn) | một phần | M2 |
| UC-ADM-26 Gửi thông báo thủ công ⚠ | Admin | có | **không** | không | — |
| UC-ADM-27 Xem nhật ký hoạt động ⚠ | Admin | có (`activity_logs`) | chỉ ghi, **không có API đọc** | không | — |
| UC-ADM-28 Thống kê tổng quan | Admin | có | có | có | M2 |
| UC-ADM-29 Thống kê AR & phễu ⚠ | Admin | có | **không** | không | — |
| UC-ADM-30 Gỡ ảnh AR ⚠ | Admin | có | **không** | không | — |
| UC-MOB-01..04 Android | Khách/User/Admin | có (dùng API công khai) | API công khai đã có (MOB-03/04 không cần BE) | `apps/mobile` chưa có chức năng | — |

**⚠ cần bảng/cột chuẩn đã có nhưng code chưa làm (25 UC):** AUTH-07, ACC-03, ACC-07, 3D-02..07 (6), SPACE-05, SPACE-06, ADM-02, ADM-03, ADM-04, ADM-06, ADM-08, ADM-12, ADM-14, ADM-17, ADM-25 (một phần), ADM-26, ADM-27, ADM-29, ADM-30, PAY-02 (không tính MOB).
Ngoài ra UC có trong kế hoạch Mốc 4 theo PROMPT_AGENT_BE: ADM-03, ADM-12, PAY-01 thật, PAY-02, báo cáo thu chi (màn 54, **không có UC** trong DAC_TA).

## 4. Kế hoạch sửa để code khớp DB chuẩn
**Nguyên tắc bảo vệ dữ liệu `aurelia_dev` (3 users, 4 categories, 2 products, 4 variants, 1 order, 10 media, 1 coupon, 1 space…):**
1. Trước mọi migration trên `aurelia_dev`: `pg_dump -Fc` mới (`aurelia_dev_before_align_<ngày>.dump`) + `SELECT count(*)` mọi bảng gốc ghi vào BE_PROGRESS; chỉ chạy khi bạn duyệt từng bước.
2. **Diễn tập trước** trên DB tạm dựng từ `aurelia_dev_before_be.dump` + toàn bộ migration (tên đề xuất `aurelia_rehearsal`, xoá sau; chỉ tạo khi bạn đồng ý) — so `count(*)` trước/sau.
3. Mọi migration chỉ đụng bảng **rỗng** hoặc **thêm/đổi không mất dữ liệu**; không `DROP` bảng có dữ liệu của `aurelia_dev`. Sau áp dụng so lại số dòng.
4. Mỗi migration tạo bằng `prisma migrate dev --create-only`, đọc SQL, `migrate diff` rỗng (QUY_UOC §7); không sửa migration đã áp dụng.
5. `aurelia_demo`/`aurelia_test` được dựng lại từ đầu bằng `db-reset.mjs` sau mỗi migration (không giữ dữ liệu).

| # | Migration (nhỏ) | Nội dung | Ảnh hưởng `aurelia_dev` | Ảnh hưởng BE/FE/test | Giữ dữ liệu bằng cách |
|---|---|---|---|---|---|
| M1 | `align_identity_pk` | 20 bảng mới: `DROP DEFAULT` + `ADD GENERATED ALWAYS AS IDENTITY (START WITH max+1)`, bỏ sequence cũ | **không mất gì**: 20 bảng mới đều rỗng trên dev | BE: rà mọi `createMany` có `id` tường minh (seed-mock đã dùng `OVERRIDING SYSTEM VALUE`); FE không đổi; test chạy lại | `setval`/START WITH theo `max(id)+1` |
| M2 | `align_updated_at_triggers` | tạo `trg_*_set_updated_at` cho `product_360_configs`, `return_requests` (+ gọi lại vòng lặp idempotent) | không ảnh hưởng | BE bỏ chỗ tự gán `updatedAt` nếu có (đã kiểm: không có) | thuần thêm trigger |
| M3 | `align_comments` | `COMMENT ON` tiếng Việt cho 20 bảng + 29 cột + giá trị enum mới | không ảnh hưởng | không | thuần metadata |
| M4 | `align_decide_tables` (tuỳ câu trả lời Q5–Q6) | theo quyết định C: gộp FAQ→`settings`/`pages`; gộp phiếu kho→`inventory_movements`; hoặc giữ nguyên | các bảng liên quan **rỗng** trên dev ⇒ an toàn; nếu gộp thì chuyển dữ liệu trong cùng migration | BE: sửa `ContentService`, `AdminContentService` (FAQ) / Mốc 4 kho; FE: FAQ đọc không đổi; test E3 FAQ | `INSERT … SELECT` trước `DROP` trong cùng transaction |
| M5 | `align_stock_model` (chỉ nếu Q1 = theo chuẩn) | bỏ `product_variants.reserved_quantity` + `ck_product_variants_reserved`; trừ `stock_quantity` ngay khi đặt | dev: kiểm `reserved_quantity` toàn 0; nếu >0 trừ vào `stock_quantity` trong migration | BE: `placeOrder`, `cancelCore`, `setStatus('shipping')`, đổi trả; `stockQuantity` API = `stock_quantity`; ~20 test M2/M3; FE không đổi | cập nhật trong transaction, kiểm `stock_quantity ≥ 0` |
| M6 | `align_password_reset` (chỉ nếu Q3 = bỏ OTP) | bỏ `otp_hash, attempts, last_sent_at`; dùng `token_hash` | dev: bảng `password_resets` hết hạn/ít dữ liệu — đếm trước | BE `auth.service.ts`; **FE màn 29/30 đổi sang link/token**; test auth | không có dữ liệu cần giữ (token tạm) |
| M7 | `align_coupon_type` (chỉ nếu Q5 = bỏ `freeship`) | quy `freeship`→`fixed` (value = phí ship?) hoặc giữ | dev có 1 coupon: kiểm loại | FE khuyến mãi, `calcDiscount` | `UPDATE` trước khi đổi enum |

**Thay đổi chỉ ở code (không migration):**
| # | Việc | File chính | Ghi chú |
|---|---|---|---|
| K1 | `sold_count` chỉ tăng khi `completed` (B6) | `orders.service.ts:236,359`, `admin-orders.service.ts setStatus` | bổ sung unit/E2; không backfill |
| K2 | Ghi `space_views` thay vì tăng `view_count` (B7) | `spaces.service.ts:123`, thêm route `POST /spaces/:slug/views` | FE cần gửi `visitorId` (Q10) |
| K3 | `PermissionsGuard` + `@Permissions()` (A′1) | `common/guards`, mọi `admin-*.controller.ts` | không đổi hành vi với admin hiện tại |
| K4 | `ActivityLogInterceptor` (A′2) | `common/interceptors` | gỡ các lời gọi lặp |
| K5 | Xác thực email (A′3), phiên (A′4), xoá tài khoản (A′5) | `auth`, `users` | phụ thuộc phạm vi |
| K6 | Vận đơn (A′10), giới hạn tệp 3D (B11) | `admin-orders.service.ts`, `model-file-validator.ts` | phụ thuộc Q9, Q10b |
| K7 | Sửa `npm run typecheck`/`lint` (đã thử ở lượt trước rồi hoàn tác): thêm `paths: {"@/*": ["../web/src/*"]}` + `resolveJsonModule` vào `apps/api/tsconfig.json`, và thêm `apps/api/prisma/seed-mock.ts` vào override `no-console` trong `.eslintrc.cjs` (như đã làm với `seed.ts`) | hai file cấu hình | đã chứng minh: `tsc` sạch, `eslint --max-warnings=0` sạch. Chưa áp dụng |

**Tổng ước lượng:** DB: **3 migration chắc chắn** (M1–M3, không rủi ro dữ liệu) + **1–4 migration tuỳ quyết định** (M4–M7) ⇒ **4 đến 7 migration**. Code: K1–K7 (7 gói việc). Thứ tự gợi ý: K7 → M2 → M3 → M1 → K1/K2 → (quyết định Q1) M5 → (Q5/Q6) M4/M7 → K3/K4 → Mốc 4. Kế hoạch Mốc 3.5 cũ (a) chính là K7; (b) sửa thanh toán giả và (c) tính tiền hoàn/đổi hàng vẫn còn nguyên giá trị và **không xung đột** với kế hoạch này, nhưng (c) đổi hàng "trừ tồn món mới" phụ thuộc Q1; mục (d) "cập nhật DATABASE_SCHEMA/CAU_TRUC_DB/QUY_UOC" đã huỷ.

## 5. Câu hỏi cần bạn quyết định
1. **Tồn kho (B5):** chuẩn (3 file + DAC_TA) = trừ `stock_quantity` ngay khi đặt; bạn đã chọn ở lượt đầu = giữ chỗ khi đặt, trừ khi sang `shipping`. **Bên nào thắng?** (Nếu theo chuẩn: M5, bỏ `reserved_quantity`, đổi cách hủy/đổi trả.)
2. `sold_count` chuyển sang tăng khi `completed` (K1) — đồng ý, và không backfill số liệu cũ?
3. **OTP quên mật khẩu (B8):** giữ OTP 6 số (FE đang dùng; cột `otp_hash/attempts/last_sent_at` ngoài chuẩn) hay chuyển token-link đúng DAC_TA (sửa 2 màn FE)?
4. **Xác thực email** bắt buộc mới được đánh giá (DAC_TA §12.1 #4): làm không? FE chưa có màn.
5. **Bảng/cột nhóm C:** với từng bảng (C1–C13) chọn *giữ+đổi chuẩn* / *gộp* / *xoá*. Đề xuất mặc định: giữ C1–C6, C8, C10, C11, C13; gộp C12 (FAQ) vào `settings`; C7 `code_counters` giữ (an toàn đồng thời); `coupon_type.freeship` giữ. Đồng ý? Và vì tôi không được sửa 3 file chuẩn, **ai bổ sung các bảng được giữ vào 3 file chuẩn** (D5)?
6. **Kho (C9):** phiếu nhập/xuất + nhà cung cấp: giữ 3 bảng, gộp vào `inventory_movements`, hay bỏ phiếu và chỉ dùng điều chỉnh tồn (UC-ADM-12)? (Quyết định trước Mốc 4.)
7. `carts.coupon_id`: chuẩn D-N16 "áp mã chỉ xem trước" nhưng FE/mock lưu mã vào giỏ — giữ cột?
8. `users.loyalty_points`: có logic cộng điểm không (hiện chưa rõ), hay bỏ?
9. **Vận đơn (A′10/B10):** làm `PATCH shipment {status}` và chiều "vận đơn delivered ⇒ đơn completed" theo DAC_TA, hay giữ chiều hiện tại?
10. **Phạm vi UC chưa làm:** AR (3D-02..07, ADM-29/30), ghi lượt xem không gian (SPACE-06), vai trò/quyền (ADM-02), thuộc tính/thương hiệu/media (ADM-04/06/08), biến thể chất liệu 3D & placement (ADM-14/17), gửi thông báo & xem nhật ký (ADM-26/27), phiên & xoá tài khoản (ACC-03/07), xác thực email (AUTH-07): UC nào **giữ**, UC nào **bỏ**? (10b) Giới hạn tệp mô hình: 50MB (yêu cầu Mốc 3) hay 100MB (DAC_TA)?
11. **Diễn tập:** cho phép tôi tạo DB tạm `aurelia_rehearsal` từ `aurelia_dev_before_be.dump` để thử các migration (xoá sau)? Và cho phép `pg_dump` mới của `aurelia_dev` trước khi áp migration thật?
12. **Từ lượt trước còn bỏ trống** (câu trả lời của bạn còn ngoặc `[ ]`): (Q2) bạn có `VNPAY_TMN_CODE/HASH_SECRET` sandbox chưa; (Q8) các UC giữ/bỏ (gộp với Q10 ở trên); (Q9) `aurelia_living` dùng hay không dùng (hiện tôi **không đụng**, chưa rõ).
13. Mốc 3.5 (b) bỏ `outcome`, cấm giả lập ở production, (c) hoàn tiền theo tỉ lệ coupon, không hoàn ship; đổi hàng cộng/trừ tồn hai món — tiếp tục làm **sau** khi chốt kế hoạch này chứ không song song?
