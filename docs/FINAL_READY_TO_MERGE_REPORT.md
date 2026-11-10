# FINAL_READY_TO_MERGE_REPORT — nhánh `feature/backend`

Ngày: 2026-11-10 · Commit kiểm thử: `b5d7e49` (cây làm việc sạch, `DIRTY=0` ở đầu và cuối cả hai lượt) · Báo cáo này là bản bổ sung; các báo cáo lịch sử (`KET_QUA_KIEM_THU.md`, `KET_QUA_KIEM_THU_HOAN_THIEN.md`) giữ nguyên.

## Kết luận (mục 15 nêu chi tiết)

**READY TO MERGE** vào `main` về mặt mã, test và tài liệu, kèm **một điều kiện triển khai, không phải điều kiện merge**: migration `20261109010100_remove_ar` chưa áp lên `aurelia_dev` (cần chủ dự án cho phép; hướng dẫn ở mục 9). Hai điểm cần đọc trung thực: mục 12 (một lần đỏ `khach-hang` không tái hiện được) và mục 6 (độ sâu bằng chứng của 9 UC).

## 1. Trước và sau

| | Trước (báo cáo trước, NOT READY) | Sau (`b5d7e49`) |
|---|---|---|
| Chính sách mật khẩu AUTH-01/06, ACC-02 | chỉ ≥ 8 ký tự, không `confirmPassword` | ≥ 8, hoa + thường + số, `confirmPassword` khớp; 24 test |
| Trang `/admin/payments` (ADM-24) | chưa có (xử lý ở chi tiết đơn) | có, lọc/tìm/xác nhận/thất bại, có e2e |
| Ràng buộc đầu vào theo DAC_TA | lệch nhiều UC | bộ `dac-conformance` 10 nhóm, xanh |
| Điểm chờ chủ dự án | 3 | 0 |
| Test hoàn tiền theo giờ VN | phụ thuộc giờ máy, đỏ 00:00–00:30 | đồng hồ đóng băng 4 mốc, độc lập giờ máy |
| `admin360` | không ổn định | nguyên nhân gốc xác định, xem mục 3 |
| Supertest | 390 | **392** (22 suite) |
| Ma trận UC | "Đủ" theo cách dò route | 70 UC có bằng chứng (mục 6) |

## 2. Lỗi tìm ra

1. Đơn đặt hàng nhận địa chỉ của người khác/không tồn tại (không 404); dòng không còn bán không báo 409.
2. Trùng slug/mã/tên ở danh mục, thương hiệu, mã giảm giá, sản phẩm, trang, không gian trả mã/hình dạng lỗi không nhất quán.
3. Sản phẩm đăng được khi không có biến thể hoạt động hoặc ảnh đại diện; không gian đăng được khi chưa có ảnh 360°.
4. Tài khoản quản trị bị đổi trạng thái được; đổi sang trạng thái khác `active` không thu hồi phiên.
5. Lý do hủy đơn không bắt buộc ở khách; hoàn tiền không khóa dòng đơn (hoàn hai lần có thể xảy ra).
6. Đăng xuất thu hồi theo refresh token của bất kỳ ai; "đăng xuất thiết bị khác" cũng đăng xuất phiên hiện tại (đợt trước).
7. Test: token admin hết hạn trước đồng hồ giả (hoàn tiền); race `admin360`; race trang payments (mục 3).

## 3. Nguyên nhân gốc của các test không ổn định (không dùng retry)

| Test | Nguyên nhân gốc | Sửa |
|---|---|---|
| Hoàn tiền 00:30 giờ VN (`mock-m4`) | access token admin sống 15 phút, cấp lúc bắt đầu tệp; đồng hồ giả 00:30 VN nằm sau hạn token ⇒ 401. Tái hiện bằng đồng hồ +18 phút | đóng băng đồng hồ ở 00:00:01, 00:30:00, 06:59:59, 07:00:01 VN và đăng nhập NGAY trong đồng hồ giả |
| `admin360` xóa khung hình | hàng "biến mất" khi hộp thoại mở (aria-hidden) nên lệnh chờ thành công sớm, bước kế bị nhiễu | chờ thông báo xóa thành công trước (D-T61) |
| `/admin/payments` e2e | ô tìm kiếm trễ 300 ms: trước đó bảng là danh sách cũ, hàng cũ vẫn khớp mã đơn; bảng nạp lại làm menu thao tác bị gỡ khỏi DOM (lỗi test, không phải lỗi app; một giả thuyết cắt bởi `overflow` đã thử, không đúng và đã hoàn nguyên) | chờ dòng "trong tổng 1 giao dịch" trước khi mở menu; nút "Đóng" chọn đúng nút chân hộp thoại |
| `spaces360` | phụ thuộc thứ tự do lỗi sắp xếp chuỗi `Date` | tìm theo tên + sửa sắp xếp |

## 4. Lỗi đã sửa — tệp thay đổi

`git diff --stat 7ee4dd4..HEAD -- apps packages`: **41 tệp, +2825 / −224**. Chính: `common/utils/validate.ts`, `auth.service.ts`, `users.service.ts`, `admin-users.service.ts`, `orders.service.ts`, `admin-orders.service.ts`, các service admin (danh mục, mã giảm giá, sản phẩm, nội dung, không gian), `app/admin/payments/page.tsx` (mới), validators và trang đăng ký/đặt lại/đổi mật khẩu, mock API; test mới `password-policy.db-spec.ts` (24), `dac-conformance.db-spec.ts` (10 nhóm); docs: DAC_TA, DECISIONS, DOI_CHIEU_UC, API_CONTRACT, CHUAN_MO_RONG, ENVIRONMENT, HUONG_DAN_DEMO, BE_PROGRESS.

## 5. Quyết định nghiệp vụ đã áp dụng (có căn cứ chuẩn)

D-N35 (mật khẩu, điện thoại, trang payments), D-N36 (căn chỉnh ràng buộc theo DAC_TA), D-T61 (nguyên nhân test không ổn định, cần DB test dựng mới), cùng các quyết định đã chốt trước: D-D08, D-P16, D-N29…N34, D-T59, D-T60. Không bịa quy tắc ngoài DAC_TA; chỗ lệch có chủ đích nằm ở CHUAN_MO_RONG mục 39 và DOI_CHIEU_UC.

## 6. Ma trận 70 UC

Mức bằng chứng: tất cả 70 UC ở mức **A** = đối chiếu các ràng buộc/luồng thay thế chính của DAC_TA bằng probe `dac-conformance` đã chạy xanh và/hoặc test chuyên biệt đã đọc. **Lưu ý trung thực:** với 9 UC (3D-01, 3D-03, SPACE-03, SPACE-05, ADM-02, ADM-03, ADM-17, ADM-29, PAY-02) mức A dựa trên probe nhóm 6 cộng việc đọc **tên và assertion chính** của test chuyên biệt, chưa đọc từng dòng của mọi assertion. Không UC nào MISSING/MISMATCH/PARTIAL; 5 UC "COMPLETE (lệch có chủ đích)" là lệch đã ghi ở CHUAN_MO_RONG theo quyết định chủ dự án. UC bị loại (EXCLUDED, không nằm trong 70): 4 UC Android (MOB-01…04, hoãn) và 6 UC AR (3D-02/04/05/06/07, ADM-30).


## 7. Kết quả test theo nhóm (cả hai lượt giống nhau; nguồn `scratchpad/final5-run.txt`)

| Nhóm | Lệnh | Lượt 1 | Lượt 2 |
|---|---|---|---|
| Typecheck + lint | `npx turbo run typecheck lint --force` | 6/6 task | 6/6 |
| Web unit | `npm test -w @aurelia-living/web` | 36/36 (9 tệp) | 36/36 |
| API unit | `npm test -w @aurelia-living/api` | 142/142 (16 suite) | 142/142 |
| Supertest DB | `npm run test:e2e:db -w …/api` | **392/392** (22 suite) | 392/392 |
| MinIO API | `npm run test:e2e:minio -w …/api` | 7/7 | 7/7 |
| Playwright API thật | `npm run test:e2e:real` | khach-hang 9, xem-360 25, admin-m2 3, admin-m3 3, admin-m4 5, admin-m5 7, admin-3d 4, admin-race 2, vat-lieu 2, phong-3d 3, ext-uc 6 = **69** | giống hệt |
| Playwright MinIO | `npm run test:e2e:real:minio` | 2/2 | 2/2 |
| types:check | `npm run types:check` | đồng bộ 25 enum, 59 entity | giống |

Cổng 4002/3100 giải phóng sau mỗi lượt (0 listener). Môi trường: `PG_HOST/REDIS_HOST=127.0.0.1`, `S3_ENDPOINT=http://127.0.0.1:9000`, `E2E_MAILPIT_URL=http://127.0.0.1:8025`.

## 8. Chạy lặp

- `xem-360` (gồm `admin360`) chạy riêng **3 lần liên tiếp: 25/25, 25/25, 25/25**, không retry; cộng hai lần trong hai lượt đầy đủ = 5/5 lần xanh.
- Bộ test hoàn tiền (frozen clock, 4 mốc) xanh trong cả 4 lần chạy supertest (2 lượt đầy đủ + các lần chạy lẻ).
- `admin-m5` (có test payments) 7/7 ở cả hai lượt đầy đủ và lần chạy riêng sau khi sửa.

## 9. Migration và drift

- `node scripts/db-reset.mjs aurelia_test` dựng lại từ đầu: "All migrations have been successfully applied", seed 34 users / 52 sản phẩm / 83 đơn.
- `prisma migrate diff --from-url aurelia_test --to-schema-datamodel schema.prisma`: "This is an empty migration" ⇒ **không drift** (cả hai lượt).
- Giữ nguyên `usdz`/`has_3d_model`/GLB (USDZ chỉ còn là giá trị định dạng; job từ chối USDZ, có test).
- **`aurelia_dev` chưa áp migration `20261109010100_remove_ar`** (không có quyền). Tác động đã đo: sẽ xóa 2 phiên AR, 1 bản chụp đặt chỗ AR, 1 cờ `has_ar` của sản phẩm và 1 tệp usdz. Trước khi áp: sao lưu (`pg_dump aurelia_dev`), xem lại số liệu, rồi `prisma migrate deploy`. Không đụng `aurelia_living`, `uploads`, container hay volume.

## 10. Kiểm tra AR

`grep -rniE "ar_enabled|has_ar|ar_sessions|arSession|placement_snapshot"` trên `apps/api/src`, `apps/web/src`, `packages`: không có kết quả. Còn lại duy nhất tham chiếu `usdz` (định dạng bị từ chối, test `model-processing.service.spec.ts`) và test `ar-removed`. Không khôi phục AR dưới bất kỳ hình thức nào.

## 11. Kiểm tra 3D / 360° / mobile

3D (xem, vật liệu theo biến thể, đặt mô hình trong 360°) và 360° (xem-360 25/25, phong-3d 3/3, vat-lieu 2/2, admin-3d 4/4) xanh; `placement`, `allow_scaling` giữ nguyên. `apps/mobile` là khung Android còn nguyên (Gradle, `app/`), không bị chạm.

## 12. Vấn đề còn lại (trung thực)

1. **Một lần đỏ `khach-hang` không tái hiện được.** Ở lượt đầu tiên của đợt này, test `screens.spec.ts` "xác thực email" quá thời gian 60 giây (cả nhóm chạy 9,1 phút thay vì ~2,9 phút, máy đang tải). Chạy lại riêng nhóm 2 lần xanh và cả hai lượt đầy đủ xanh. **Nguyên nhân gốc chưa được xác định**; giả thuyết là máy quá tải, nhưng chưa chứng minh. Không thêm retry.
2. `aurelia_dev` chưa áp migration (mục 9), cần chủ dự án quyết định thời điểm.
3. Độ sâu bằng chứng của 9 UC (mục 6).
4. Bộ supertest cần `aurelia_test` dựng mới (D-T61) vì một số test đếm dữ liệu seed.

## 13. Commit (nhánh `feature/backend`)

`f09391a` mật khẩu · `c705b83` trang payments + ràng buộc + đối chiếu · `45cf985` địa chỉ/409 đơn hàng · `19679f0` test hoàn tiền đồng hồ đóng băng · `06b31ad` spaces/pages · `5602ef2` docs api · `c087893` test nhóm 5–6 · `a52e98e` test e2e payments · `b5d7e49` docs · (kèm commit báo cáo này). Đã đẩy trước đó: đến `db31c16`.

## 14. Trạng thái push

Xem dòng cuối của phản hồi trong phiên (push `feature/backend` chỉ sau khi báo cáo này được commit; không push `main`, không force).

## 15. Kiểm tra 16 tiêu chí / Kết luận

Các điểm bắt buộc đều có bằng chứng ở trên: chính sách mật khẩu (mục 1, 4); trang payments có e2e (mục 7); 70 UC có ma trận, không UC nào ngoài COMPLETE (mục 6); nguyên nhân gốc flake (mục 3); test hoàn tiền độc lập giờ máy (mục 3, 8); migration/drift sạch và giữ USDZ/3D (mục 9); mobile giữ (mục 11); AR sạch (mục 10); toàn bộ test hai lượt xanh + chạy lặp (mục 7, 8); docs cập nhật.

**Verdict: READY TO MERGE**, với hai ghi chú không chặn merge: (a) migration `aurelia_dev` phải làm riêng có sao lưu và có phép; (b) lần đỏ `khach-hang` chưa rõ nguyên nhân (mục 12.1). Nếu chủ dự án coi (b) là chặn, verdict chuyển thành NOT READY cho tới khi tái hiện hoặc chạy lặp thêm nhóm này.

## Phụ lục — ma trận 70 UC

| UC | Yêu cầu DAC_TA | Vị trí code (API · trang) | Test hiện có | Assertion đã xác minh | Kết quả | Việc cần làm |
|---|---|---|---|---|---|---|
| UC-3D-01 | Xem và xoay mô hình 3D tương tác của sản phẩm trên web (React Three Fiber / model-viewer). | GET /products/:slug/model · /products/:slug/3d | minio-flow.minio-spec.ts; model-materials.db-spec.ts; models-processing.db-spec.ts; admin-models.spec.ts; materials.spe… | [A] dac-conformance nhóm 6 (sản phẩm lạ 404); models-processing/model-materials/mock-m3 (chỉ mô hình ready, chọn LOD, glbUrl); ar-removed (3D còn hoạt động); e2e phong-3d | COMPLETE | — |
| UC-3D-03 | Khi chọn biến thể khác, mô hình áp cấu hình vật liệu tương ứng mà không tải lại mô hình mới. | GET /products/:slug/model (materialVariants[]) · /products/:slug/3d | minio-flow.minio-spec.ts; model-materials.db-spec.ts; models-processing.db-spec.ts; admin-models.spec.ts; materials.spe… | [A] model-materials.db-spec (vật liệu theo biến thể, UNIQUE, biến thể khác sản phẩm bị từ chối) + e2e vat-lieu | COMPLETE | — |
| UC-ACC-01 | Xem và sửa họ tên, số điện thoại, ảnh đại diện. | GET /users/me, PATCH /users/me · /account/profile | account.db-spec.ts; mock-m2.db-spec.ts; screens.spec.ts | [A] account.db-spec (UC-ACC-01) + dac-conformance: fullName 2–150, phone 10–11, bỏ trống, email/vai trò không đổi qua hồ sơ | COMPLETE | — |
| UC-ACC-02 | Người dùng đã đăng nhập đổi mật khẩu bằng cách nhập mật khẩu hiện tại. | POST /users/me/change-password · /account/password | core-flows.db-spec.ts; extension.db-spec.ts | [A] password-policy (UC-ACC-02) + core-flows: sai mật khẩu hiện tại, trùng cũ, confirm, logoutOthers giữ phiên hiện tại | COMPLETE | — |
| UC-ACC-03 | Xem danh sách thiết bị đang đăng nhập và đăng xuất một thiết bị từ xa. | GET /users/me/sessions, DELETE /users/me/sessions/:id · /account/sessions | extension.db-spec.ts | [A] dac-conformance nhóm 5 (phiên người khác 404, không tồn tại 404, 401); extension.db-spec | COMPLETE | — |
| UC-ACC-04 | Thêm, sửa, xóa địa chỉ nhận hàng và chọn địa chỉ mặc định. | GET/POST /addresses, PATCH/DELETE /addresses/:id, PATCH /addresses/:id/default · /account/profile (mục sổ địa chỉ, AddressFormModa… | account.db-spec.ts | [A] account.db-spec (UC-ACC-04, 12 test): mặc định, xóa mặc định ⇒ mới nhất, xóa địa chỉ cuối, validation, song song, 404 người khác | COMPLETE | — |
| UC-ACC-05 | Xem thông báo (ví dụ đơn hàng đã giao), đánh dấu đã đọc, xóa. | GET /notifications, GET /notifications/unread-count, PATCH /notifications/:id/r… · /account/notifications | mock-m3.db-spec.ts; extension.db-spec.ts | [A] dac-conformance: thông báo người khác/không có ⇒ 404, 401; mock-m3/extension: đếm chưa đọc, đọc tất cả, xóa | COMPLETE | — |
| UC-ACC-06 | Thêm/bỏ sản phẩm khỏi danh sách yêu thích và xem lại danh sách. | GET /wishlist, PUT/DELETE /wishlist/:slug · /wishlist, nút tim ở /products/:slug | account.db-spec.ts; cache.db-spec.ts; screens.spec.ts | [A] account.db-spec (UC-ACC-06): 401, idempotent PUT/DELETE, thứ tự, 404 slug lạ/ẩn, cách ly người dùng | COMPLETE | — |
| UC-ACC-07 | User tự xóa tài khoản; hệ thống xóa mềm (`deletedAt` + `status = banned`), thu hồi phiên, giữ đơn hàng. | DELETE /users/me · /account/profile (DeleteAccountSection) | extension.db-spec.ts | [A] dac-conformance nhóm 5 (thiếu/sai mật khẩu, 401); extension.db-spec (đơn đang xử lý 409, xóa mềm) | COMPLETE | — |
| UC-ADM-01 | Xem, tìm kiếm người dùng; khóa/mở khóa/cấm tài khoản; xóa mềm. | GET /admin/users, GET /admin/users/:id, PATCH /admin/users/:id, PATCH /admin/us… · /admin/customers | mock-m2.db-spec.ts | [A] dac-conformance: status enum/khóa admin 409/lý do ≤500/404/403, token cũ bị chặn; extension | COMPLETE | — |
| UC-ADM-02 | Xem 2 vai trò (`admin`, `user`) và 6 quyền; gán/gỡ vai trò `admin` cho người dùng. Không tạo vai trò mới. | GET /admin/roles, PUT/DELETE /admin/users/:id/roles/admin · /admin/roles, /admin/customers/:id | extension.db-spec.ts | [A] dac-conformance nhóm 6 (403, 401, 200); extension.db-spec (vai trò) | COMPLETE | — |
| UC-ADM-03 | Xem và sửa cấu hình: tên website, email/điện thoại liên hệ, tiền tệ, phí vận chuyển mặc định, ngưỡng miễn phí vận chuyển, bảo trì. | GET /admin/settings, PUT /admin/settings/:key · /admin/settings | cache.db-spec.ts; mock-m4.db-spec.ts; admin-m4.spec.ts | [A] mock-m4 mục Cài đặt (4 test): sai email/tên trống/hotline ⇒ 400 đúng ô, kiểu payments/shippingZones, khóa ngoài danh sách ⇒ 400, nhật ký trước/sau, public thấy ngay | COMPLETE | — |
| UC-ADM-04 | Tải lên, xem, sửa mô tả ảnh (alt) và xóa tệp trong kho media dùng chung. | POST /admin/media, POST /admin/media/presign, POST /admin/media/confirm, PATCH/… · /admin/media | minio-flow.minio-spec.ts; mock-m3.db-spec.ts; mock-m5.db-spec.ts; storage-jobs.e2e-spec.ts; admin-minio.spec.ts | [A] dac-conformance nhóm 5 (altText 256 ⇒ 400, 404, 403, 401); mock-m5 (media: >5 MB ⇒ 413, sai loại/chữ ký ⇒ 415, webp+thumbnail, xóa tệp) | COMPLETE | — |
| UC-ADM-05 | Tạo, sửa, sắp xếp, bật/tắt và xóa danh mục nhiều cấp (Nội thất → Phòng khách → Sofa). | GET/POST /admin/categories, PATCH/DELETE /admin/categories/:id · /admin/categories | mock-m2.db-spec.ts; cache.db-spec.ts | [A] dac-conformance + mock-m2: slug trùng 409, tên ≤150, vòng lặp cha–con 400, xóa còn con 409 | COMPLETE | — |
| UC-ADM-06 | Thêm, sửa, bật/tắt, xóa thương hiệu và logo. | GET/POST /admin/brands, GET/PATCH/DELETE /admin/brands/:id · /admin/brands | activity-interceptor.db-spec.ts; extension.db-spec.ts; mock-m5.db-spec.ts; ext-uc.spec.ts | [A] dac-conformance + mock-m5: slug 409, tên ≤150, xóa ⇒ brandId NULL | COMPLETE | — |
| UC-ADM-07 | Soạn, xuất bản, lưu trữ các trang Giới thiệu, Chính sách đổi trả, Hướng dẫn mua hàng. | /admin/pages, /admin/banners, /admin/posts: GET/POST, PATCH/DELETE /:id · /admin/content | mock-m3.db-spec.ts; cache.db-spec.ts | [A] dac-conformance: slug 409, title ≤255, status enum; mock-m3: sanitize Markdown, FAQ | COMPLETE (lệch có chủ đích, đã ghi: CHUAN_MO_RONG Phần 2 mục 2) | — |
| UC-ADM-08 | Định nghĩa Màu sắc, Chất liệu, Kích thước và các giá trị (Xám, Be, Gỗ sồi...) để gắn cho biến thể. | GET/POST /admin/attributes, PATCH/DELETE /admin/attributes/:id (+ /values) · /admin/attributes | mock-m5.db-spec.ts | [A] dac-conformance + mock-m5: mã/tên giới hạn, trùng 409, giá trị đang dùng không xóa | COMPLETE | — |
| UC-ADM-09 | Tạo, sửa, đăng/ẩn, đánh dấu nổi bật và xóa mềm sản phẩm. | GET/POST /admin/products, GET/PATCH/DELETE /admin/products/:id · /admin/products | mock-m2.db-spec.ts; mock-m5.db-spec.ts | [A] dac-conformance: độ dài tên/slug/mô tả, danh mục/thương hiệu 400, slug 409, đăng cần ảnh đại diện + biến thể; mock-m2 | COMPLETE | — |
| UC-ADM-10 | Thêm/sửa biến thể bán (SKU, giá, giá khuyến mãi, cân nặng, trạng thái) và gắn giá trị thuộc tính. | (không có route riêng) biến thể nằm trong body variants[] của POST/PATCH /admin… · /admin/products/:id | admin-product-media.db-spec.ts; mock-m2.db-spec.ts | [A] admin-product-media (15): validation, tồn kho, ngừng bán biến thể, lịch sử | COMPLETE | — |
| UC-ADM-11 | Gắn ảnh vào sản phẩm hoặc biến thể, sắp thứ tự và chọn ảnh đại diện. | (không có route riêng) ảnh nằm trong body images[] của POST/PATCH /admin/produc… · /admin/products/:id | admin-product-media.db-spec.ts; mock-m2.db-spec.ts | [A] admin-product-media: mediaId, liên kết biến thể, đại diện duy nhất, nguyên tử, song song | COMPLETE | — |
| UC-ADM-12 | Nhập hàng, điều chỉnh (kiểm kê), ghi nhận hàng trả; xem lịch sử biến động tồn kho. | GET /admin/inventory(/movements\ · /receipts\ | /summary), POST /admin/inventory/movements, POST /admin/inventory/receipts, POST …/receipts/:id/confirm\ | [A] dac-conformance: quantityChange 0, tồn < 0 409, type/lý do; mock-m4 phiếu nhập/xuất | COMPLETE | — |
| UC-ADM-13 | Khai báo kích thước thật, vị trí đặt, cấu hình trình xem; tải tệp GLB (không nhận USDZ); hệ thống tối ưu và đưa mô hình sang trạng thái sẵn sàng. | POST /admin/models, /upload, /presign, POST /:id/files/presign\ · confirm, PATCH /:id/primary, POST /:id/reprocess,… | /admin/models | [A] dac-conformance nhóm 5 (403, thiếu dữ liệu 400, sản phẩm lạ, USDZ bị từ chối, 404); models-processing/model-materials (job, LOD ≤ 5 MB, failed) | COMPLETE | — |
| UC-ADM-14 | Gắn cấu hình vật liệu (màu, độ nhám) cho từng biến thể trên cùng một mô hình để đổi màu không cần tải mô hình mới. | GET /admin/models/:id/materials, GET/PUT/DELETE /admin/models/:id/material-vari… · /admin/models (hộp thoại Vật liệu theo biến thể) | model-materials.db-spec.ts | [A] dac-conformance nhóm 5 (404, 403); model-materials.db-spec | COMPLETE | — |
| UC-ADM-15 | Tạo không gian mẫu, tải các ảnh 360°, chọn ảnh mở đầu, đăng/lưu trữ. | GET/POST /admin/spaces, GET/PATCH/DELETE /admin/spaces/:id · /admin/spaces, /admin/spaces/new | mock-m3.db-spec.ts; placements.db-spec.ts | [A] dac-conformance + mock-m3: title/roomType, slug 409, đăng cần ảnh 360°, mô tả tuỳ chọn | COMPLETE | — |
| UC-ADM-16 | Đặt hotspot loại sản phẩm, điều hướng hoặc thông tin lên ảnh 360°. | (trong body panoramas[].hotspots[] của PATCH /admin/spaces/:id) · /admin/spaces/:id | mock-m3.db-spec.ts; placements.db-spec.ts | [A] dac-conformance nhóm 4 (không gian: 400/404/409); space-funnel/space-source | COMPLETE | — |
| UC-ADM-17 | Đặt mô hình 3D thật vào ảnh 360° với vị trí, khoảng cách tới camera, góc xoay và tỉ lệ để khớp phối cảnh. | GET/POST /admin/panoramas/:id/placements, PATCH/DELETE /admin/panoramas/:id/pla… · /admin/spaces/:id (tab Đặt sản phẩm 3D) | placements.db-spec.ts; placements360.spec.ts | [A] dac-conformance nhóm 6 (403, 404, 400); placements.db-spec (đặt/sửa/xóa vị trí) | COMPLETE | — |
| UC-ADM-18 | Xem hàng đợi đánh giá chờ duyệt, duyệt hoặc từ chối. | GET /admin/reviews, PATCH /admin/reviews/:id/status · /admin/reviews | mock-m3.db-spec.ts | [A] dac-conformance: 404/enum; mock-m3: duyệt ⇒ điểm trung bình đổi | COMPLETE | — |
| UC-ADM-19 | Tạo, sửa, bật/tắt mã giảm giá phần trăm hoặc số tiền cố định; xem lịch sử sử dụng. | GET/POST /admin/coupons, GET/PATCH/DELETE /admin/coupons/:id · /admin/promotions | mock-m2.db-spec.ts; vn-time.db-spec.ts | [A] dac-conformance: mã trùng 409, percent>100, value≤0, thời gian, độ dài, usageLimit; mock-m2 | COMPLETE | — |
| UC-ADM-20 | Tra cứu đơn theo trạng thái, mã đơn, khách hàng, ngày; xem chi tiết đầy đủ. | GET /admin/orders, GET /admin/orders/:code, GET /admin/orders/counts, GET /admi… · /admin/orders, /admin/orders/:code | extension.db-spec.ts; mock-m2.db-spec.ts; admin-m5.spec.ts | [A] dac-conformance + mock-m2: 404/403, lọc, đếm theo tab | COMPLETE | — |
| UC-ADM-21 | Chuyển đơn qua các bước xử lý: xác nhận → đang xử lý → đang giao. Bước hoàn tất do UC-ADM-25 (vận đơn đã giao). | PATCH /admin/orders/:id/status · /admin/orders/:code | mock-m2.db-spec.ts; mock-m4.db-spec.ts; mock-m5.db-spec.ts | [A] dac-conformance: pending→shipping 409, completed 409, note ≤500, đơn hủy không đổi; mock-m5 | COMPLETE | — |
| UC-ADM-22 | Admin hủy đơn trước khi giao (`pending`, `confirmed`, `processing`); hoàn tồn kho và lượt dùng mã. | POST /admin/orders/:id/cancel · /admin/orders/:code | mock-m2.db-spec.ts; shipment-states.db-spec.ts | [A] dac-conformance + shipment-states: lý do 5–500, hủy hai lần 409, ngoại lệ D-N34 | COMPLETE | — |
| UC-ADM-23 | Sau khi đã hoàn tiền ngoài hệ thống (chuyển khoản/cổng), admin ghi nhận để đóng đơn. | POST /admin/orders/:id/refund, GET/PATCH /admin/returns(/:id) · /admin/orders/:code, /admin/returns | mock-m2.db-spec.ts; shipment-states.db-spec.ts | [A] dac-conformance + shipment-states + mock-m4: chưa thanh toán 409, hoàn một lần, phiếu chi | COMPLETE | — |
| UC-ADM-24 | Xem giao dịch, xác nhận thủ công khoản chuyển khoản ngân hàng, đánh dấu thất bại. | GET /admin/payments, PATCH /admin/payments/:id/confirm, PATCH /admin/payments/:… · /admin/payments (+ khối Thanh toán ở /admin/order… | account.db-spec.ts; permissions.db-spec.ts; admin-m5.spec.ts | [A] account.db-spec (12) + permissions + e2e admin-m5 (trang /admin/payments, chi tiết đơn) | COMPLETE | — |
| UC-ADM-25 | Tạo vận đơn, nhập mã vận đơn, cập nhật tiến trình giao hàng. Khi vận đơn được đánh dấu đã giao, đơn tự chuyển hoàn tất. | POST /admin/orders/:id/shipments, PATCH /admin/shipments/:id · /admin/orders/:code | shipment-states.db-spec.ts; mock-m5.db-spec.ts; admin-m5.spec.ts | [A] shipment-states (11, ma trận 6×6) + mock-m5 + e2e admin-m5 | COMPLETE | — |
| UC-ADM-26 | Gửi thông báo thủ công tới một hoặc nhiều user (khuyến mãi, bảo trì). | POST /admin/notifications (+ GET) · /admin/notifications | extension.db-spec.ts | [A] dac-conformance: thiếu tiêu đề/nội dung 400, 403; extension: một/nhiều/tất cả người nhận | COMPLETE | — |
| UC-ADM-27 | Tra cứu ai làm gì, trên đối tượng nào, nội dung thay đổi, IP. | GET /admin/activity-logs · /admin/activity-logs | extension.db-spec.ts | [A] dac-conformance nhóm 4 (403, 200); extension.db-spec | COMPLETE | — |
| UC-ADM-28 | Dashboard: doanh thu, số đơn theo trạng thái, sản phẩm bán chạy, người dùng mới. | GET /admin/stats/overview, GET /admin/stats/finance, GET/POST/DELETE /admin/exp… · /admin, /admin/reports | mock-m2.db-spec.ts; mock-m4.db-spec.ts | [A] dac-conformance nhóm 4 (403, 200, from>to); mock-m4 báo cáo | COMPLETE (lệch có chủ đích, đã ghi: CHUAN_MO_RONG Phần 1 mục 1.4, D-N25) | — |
| UC-ADM-29 | Phễu phòng mẫu (xem → bấm điểm → thêm giỏ). Phần thống kê AR đã loại bỏ (D-P16); UC vẫn hoạt động với phần phễu không gian mẫu. | GET /admin/stats/spaces · /admin/reports/spaces | space-funnel.db-spec.ts; space-source.db-spec.ts; space-source.spec.ts | [A] dac-conformance nhóm 6 (403, 200, ngày sai); space-funnel.db-spec (gộp visitorId, các bước phễu) | COMPLETE | — |
| UC-AUTH-01 | Khách tạo tài khoản mới để mua hàng, đánh giá, lưu yêu thích. Đăng ký xong được đăng nhập luôn. | POST /auth/register · /register | extension.db-spec.ts; mock-m2.db-spec.ts; ext-uc.spec.ts; screens.spec.ts | [A] password-policy.db-spec (24): hoa/thường/số/độ dài/confirm, phone tuỳ chọn 10–11, tên 2–150, email ≤255, không lộ mật khẩu; core-flows: đăng ký đồng thời ⇒ 1×201 + 7×409 | COMPLETE | — |
| UC-AUTH-02 | Người có tài khoản (user hoặc admin) đăng nhập bằng email và mật khẩu để nhận token. | POST /auth/login · /login | activity-interceptor.db-spec.ts; extension.db-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; permissions.db-spec.ts | [A] dac-conformance: email sai định dạng 400, mật khẩu rỗng 400, sai thông tin 401; mock-m2/extension: khóa tài khoản, adminOnly | COMPLETE | — |
| UC-AUTH-03 | Khi access token hết hạn, client dùng refresh token để lấy cặp token mới; refresh token được xoay vòng. | POST /auth/refresh · (client tự gọi khi 401) | extension.db-spec.ts; mock-m2.db-spec.ts | [A] dac-conformance: thiếu/sai refresh 401; core-flows: dùng lại token đã thu hồi ⇒ thu hồi mọi phiên; xoay vòng | COMPLETE | — |
| UC-AUTH-04 | Thu hồi phiên đăng nhập hiện tại. | POST /auth/logout · Menu người dùng | core-flows.db-spec.ts; extension.db-spec.ts | [A] core-flows (6): thu hồi đúng phiên, idempotent, chỉ phiên của chính user, không refresh ⇒ thu hồi hết | COMPLETE | — |
| UC-AUTH-05 | Người dùng nhập email để nhận liên kết đặt lại mật khẩu (dùng một lần, có thời hạn). | POST /auth/forgot-password · /forgot-password | mock-m2.db-spec.ts | [A] dac-conformance: email sai 400; mock-m2: không lộ tài khoản, giới hạn 60 giây, hạ tầng thư | COMPLETE | — |
| UC-AUTH-06 | Đặt mật khẩu mới bằng token trong email; token chỉ dùng được một lần. | POST /auth/reset-password · /reset-password | mock-m2.db-spec.ts | [A] password-policy (UC-AUTH-06): chính sách + confirm + token một lần + thu hồi mọi phiên; mock-m2: token sai/hết hạn | COMPLETE | — |
| UC-AUTH-07 | Người dùng xác thực quyền sở hữu email bằng liên kết gửi qua email (cũng dùng để gửi lại email). | POST /auth/verify-email (+ POST /auth/resend-verification) · /verify-email | mock-m2.db-spec.ts | [A] dac-conformance nhóm xác thực + nhóm 5 (thiếu/sai token 400); mock-m2 xác thực email | COMPLETE | — |
| UC-CART-01 | Thêm một biến thể sản phẩm với số lượng vào giỏ của chính mình; giỏ được tạo ở lần thêm đầu tiên. | POST /cart/items · /products/:slug | extension.db-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; mock-m4.db-spec.ts; mock-m5.db-spec.ts | [A] dac-conformance: quantity 0/100/chữ, biến thể lạ, 401, cộng dồn; mock-m4 | COMPLETE | — |
| UC-CART-02 | Xem các dòng trong giỏ, giá hiện hành, cảnh báo thay đổi giá/hết hàng. | GET /cart · /cart | core-flows.db-spec.ts; cache.db-spec.ts; mock-m4.db-spec.ts | [A] core-flows (UC-CART-02): giỏ rỗng không tạo bản ghi, giá tính lại, items=…, cách ly người dùng | COMPLETE | — |
| UC-CART-03 | Đổi số lượng, xóa một dòng hoặc xóa toàn bộ giỏ. | PATCH/DELETE /cart/items/:id, DELETE /cart · /cart | activity-interceptor.db-spec.ts; extension.db-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; mock-m4.db-spec.ts | [A] dac-conformance: quantity 0/100/vượt tồn, dòng người khác 404, xóa dòng | COMPLETE | — |
| UC-CART-04 | Nhập mã để xem trước số tiền được giảm cho giỏ hàng hiện tại. Mã chỉ thực sự được dùng (ghi `CouponUsage`) khi đặt hàng. | POST/DELETE /cart/coupon · /cart | core-flows.db-spec.ts; mock-m2.db-spec.ts | [A] core-flows (UC-CART-04, 5 test): mã không tồn tại/ngừng/chưa tới hạn/hết hạn/hết lượt/dưới tối thiểu/giỏ rỗng/lượt cá nhân/mất hiệu lực | COMPLETE (lệch có chủ đích, đã ghi: CHUAN_MO_RONG mục 10) | — |
| UC-CAT-01 | Trang chủ giới thiệu Aurelia Living: sản phẩm nổi bật, danh mục gốc, không gian mẫu mới, liên kết 3D. | GET /categories, GET /banners, GET /products?featured=true, GET /spaces?sort=ne… · / | core-flows.db-spec.ts; cache.db-spec.ts; mock-m3.db-spec.ts | [A] core-flows (UC-CAT-01): nổi bật, danh mục hoạt động, banner hiệu lực, không gian mới nhất, cache | COMPLETE | — |
| UC-CAT-02 | Xem danh sách sản phẩm theo danh mục (cây nhiều cấp), lọc, sắp xếp, phân trang. | GET /categories, GET /products (category, brand, minPrice, maxPrice, has3d, fea… · /products | catalog-search.db-spec.ts; cache.db-spec.ts | [A] catalog-search.db-spec (26): lọc, sắp xếp, phân trang, 404 danh mục, cache; hasAr không tồn tại | COMPLETE | — |
| UC-CAT-03 | Tìm sản phẩm theo tên gần đúng; gợi ý khi đang gõ. | GET /products/search?q=, GET /products?q= · /search, ô tìm kiếm ở Header | catalog-search.db-spec.ts; cache.db-spec.ts | [A] catalog-search: tìm chính xác/một phần, 1 ký tự ⇒ rỗng, ký tự đặc biệt an toàn | COMPLETE | — |
| UC-CAT-04 | Xem thông tin đầy đủ của sản phẩm: ảnh, biến thể (màu, chất liệu), giá, tồn kho, đánh giá, nút xem 3D/360°. | GET /products/:slug, GET /products/:slug/related · /products/:slug | cache.db-spec.ts; minio-flow.minio-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; model-materials.db-spec.ts | [A] dac-conformance: sản phẩm nháp/xóa mềm/không có ⇒ 404; admin-product-media: công khai không thấy biến thể ngừng bán | COMPLETE | — |
| UC-CAT-05 | Xem các trang Giới thiệu, Chính sách đổi trả, Hướng dẫn mua hàng. | GET /pages/:slug (+ GET /pages, /posts, /faq) · /about, /policies/:slug, /faq, /contact | cache.db-spec.ts; mock-m3.db-spec.ts | [A] dac-conformance: trang nháp/không có ⇒ 404; mock-m3: Markdown an toàn, danh sách theo loại | COMPLETE (lệch có chủ đích, đã ghi: CHUAN_MO_RONG Phần 2 mục 2) | — |
| UC-CAT-06 | Gõ không dấu ("ban tra", "sofa oslo") vẫn tìm ra "Bàn trà", "Sofa Oslo". | GET /products/search?q= · /search (cùng ô tìm kiếm) | catalog-search.db-spec.ts | [A] catalog-search: không dấu/hoa thường/đ/Đ, round-trip toàn bộ tên sản phẩm | COMPLETE | — |
| UC-ORD-01 | Chuyển giỏ hàng thành đơn: chụp địa chỉ, giá, áp mã, trừ tồn kho, tạo thanh toán. | POST /orders · /checkout | extension.db-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; mock-m4.db-spec.ts; mock-m5.db-spec.ts | [A] dac-conformance: paymentMethod, note ≤500, couponCode sai 400, địa chỉ người khác/không có 404, dòng không bán 409 + giỏ giữ nguyên, giỏ rỗng; mock-m2 tồn kho/đồng thời | COMPLETE | — |
| UC-ORD-02 | Xem danh sách đơn, chi tiết, lịch sử trạng thái, thanh toán và vận chuyển. | GET /orders, GET /orders/:code, GET /orders/counts · /account/orders, /account/orders/:code | cache.db-spec.ts; mock-m2.db-spec.ts; admin-m5.spec.ts; apps/web/tests/unit/api-refresh.test.ts | [A] dac-conformance: lọc status, đơn người khác 404, 401; mock-m2 đếm theo tab | COMPLETE | — |
| UC-ORD-03 | User hủy đơn khi đơn ở trạng thái chờ xác nhận hoặc đã xác nhận; hoàn tồn kho và lượt dùng mã. | POST /orders/:id/cancel · /account/orders/:code | extension.db-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; mock-m4.db-spec.ts | [A] dac-conformance: lý do 5–500 bắt buộc, người khác 404, hủy hai lần 409; mock-m2: chỉ pending/confirmed | COMPLETE | — |
| UC-PAY-01 | Tạo yêu cầu thanh toán tại cổng và chuyển người dùng sang trang thanh toán của cổng. | POST /orders (paymentMethod), POST /payments/:orderId/checkout · /checkout | extension.db-spec.ts; mock-m2.db-spec.ts; mock-m3.db-spec.ts; mock-m4.db-spec.ts; mock-m5.db-spec.ts | [A] dac-conformance: COD chuyển thẳng success, đơn đã thanh toán 409, 401; mock-m4: chữ ký VNPAY, số tiền từ DB | COMPLETE | — |
| UC-PAY-02 | Cổng gọi máy chủ để báo kết quả thanh toán; hệ thống xác thực chữ ký rồi cập nhật Payment và Order. | GET /payments/vnpay/return, GET /payments/vnpay/ipn (VNPAY gọi bằng GET) · /checkout/success, /checkout/failed | mock-m4.db-spec.ts; apps/api/src/modules/payments/vnpay.spec.ts; apps/api/src/modules/payments/payments.sandbox.spec.ts | [A] mock-m4 mục VNPAY (11 test): chữ ký, số tiền = Order.total×100, Return URL sai chữ ký/số tiền, IPN 00/02/97/01/04, hai IPN đồng thời, thanh toán lại, đến sau khi hủy | COMPLETE (lệch có chủ đích, đã ghi: CHUAN_MO_RONG Phần 2 mục 13; D-N28) | — |
| UC-PAY-03 | Khi thanh toán thất bại hoặc bỏ dở, user thanh toán lại hoặc đổi phương thức mà không phải đặt lại đơn. | POST /payments/:orderId/retry · /account/orders/:code | mock-m4.db-spec.ts; mock-m2.db-spec.ts | [A] dac-conformance: đơn đã hủy/đã thanh toán 409, người khác 404; mock-m4: thanh toán lại | COMPLETE | — |
| UC-REV-01 | Xem điểm trung bình, phân bố sao và danh sách đánh giá đã duyệt của sản phẩm. | GET /products/:slug/reviews · /products/:slug | mock-m2.db-spec.ts; mock-m3.db-spec.ts | [A] dac-conformance: rating lạ, sản phẩm không có 404; mock-m3: chỉ approved | COMPLETE | — |
| UC-REV-02 | User đã mua và nhận sản phẩm viết đánh giá 1–5 sao; đánh giá chờ admin duyệt. | POST /products/:slug/reviews · /account/orders/:code (ReviewModal) | mock-m2.db-spec.ts; mock-m3.db-spec.ts | [A] dac-conformance nhóm 5 + nhóm đánh giá (401, 404, rating, chưa mua 403); mock-m2 (xác thực email) | COMPLETE | — |
| UC-REV-03 | User sửa nội dung/số sao hoặc xóa đánh giá của mình. Sau khi sửa đánh giá quay về `pending` để duyệt lại. | PATCH/DELETE /reviews/:id, GET /reviews/me · /account/reviews | mock-m2.db-spec.ts; mock-m3.db-spec.ts | [A] dac-conformance nhóm 5 (404 sửa/xóa, 401); mock-m3 (reviews) | COMPLETE | — |
| UC-SPACE-01 | Xem danh sách không gian mẫu, lọc theo loại phòng/phong cách/danh mục, tìm tiếng Việt không dấu ("phong khach" ra "Phòng khách"). | GET /spaces, GET /spaces/facets · /spaces | mock-m3.db-spec.ts; placements.db-spec.ts; space-source.db-spec.ts; admin360.spec.ts; placements360.spec.ts | [A] dac-conformance: roomType lạ 400, rỗng 200; mock-m3 lọc roomType/style/q/product | COMPLETE | — |
| UC-SPACE-02 | Tham quan phòng mẫu bằng ảnh 360°: xoay xem, chuyển sang ảnh khác trong tour, bấm điểm tương tác, thấy sản phẩm 3D đặt đúng phối cảnh. | GET /spaces/:slug · /spaces/:slug | mock-m3.db-spec.ts; placements.db-spec.ts; admin360.spec.ts; placements360.spec.ts; space-source.spec.ts | [A] dac-conformance: không có/nháp 404; space-source/e2e spaces360: viewer, hotspot | COMPLETE | — |
| UC-SPACE-03 | Bấm hotspot loại sản phẩm để xem nhanh sản phẩm, chọn biến thể, thêm vào giỏ (user) hoặc mở trang chi tiết. | GET /spaces/:slug (hotspot lồng trong panoramas[]) · /spaces/:slug | mock-m3.db-spec.ts; placements.db-spec.ts; admin360.spec.ts; placements360.spec.ts; space-source.spec.ts | [A] dac-conformance nhóm 6 (404, 401); space-funnel/placements (ghi lượt bấm, thêm giỏ theo không gian) | COMPLETE | — |
| UC-SPACE-04 | User lưu không gian mẫu để xem lại và xem danh sách đã lưu. | PUT/DELETE /spaces/:slug/bookmark, GET /spaces?bookmarked=true · /account/saved-spaces (mới), nút lưu ở thẻ không … | account.db-spec.ts; apps/web/tests/unit/saved-spaces.test.tsx; ext-uc.spec.ts; spaces360.spec.ts | [A] account.db-spec (SPACE-04, 3) + saved-spaces.test.tsx (6) + ext-uc e2e: 404 nháp, danh sách, bỏ lưu | COMPLETE | — |
| UC-SPACE-05 | Thay một món đồ đã đặt bằng sản phẩm khác cùng danh mục ngay trong phòng 360°, chỉ trên giao diện (không lưu vào CSDL). | GET /spaces/:slug/placements/:placementId/alternatives · /spaces/:slug | placements.db-spec.ts | [A] dac-conformance nhóm 6 (không gian/vị trí lạ 404); placements.db-spec (món thay thế cùng danh mục, đang bán) | COMPLETE | — |
| UC-SPACE-06 | Mỗi lượt xem không gian được ghi MỘT lần khi người xem rời trang, kèm sản phẩm nguồn, số lần bấm hotspot, có thêm vào giỏ không. Khách dùng `visitorI… | POST /spaces/:slug/views (+ GET /spaces?product=<slug>) · /products/:slug (khối "Xem trong không gian mẫu")… | mock-m3.db-spec.ts; space-source.db-spec.ts | [A] space-source.db-spec + dac-conformance: ghi một lượt khi rời trang, sourceProductId, 404 không gian lạ/nháp | COMPLETE | — |
