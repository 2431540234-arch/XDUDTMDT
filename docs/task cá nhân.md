# Phân công nhiệm vụ cá nhân (5 thành viên)

> Ngày lập: 2026-11-11 · Nhánh `main` tại commit `b55c7f9` · Cập nhật lần cuối: 2026-11-11 – theo commit `b55c7f9`.

## Phần 1. Tổng quan

**Mục đích:** chia toàn bộ dự án (70 use case, 210 endpoint, 59 bảng, 66 trang giao diện) thành các **module theo nghiệp vụ (lát dọc: UC → bảng DB → API → trang giao diện → test)** và giao cho 5 thành viên sao cho khối lượng gần bằng nhau, mỗi người có phần demo được và hiểu trọn luồng end-to-end của phần mình để bảo vệ trước giảng viên. Ai cũng phải đọc [docs/README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md) và [KNOWN_ISSUES.md](KNOWN_ISSUES.md) trước.

**Cách đo:** số UC lấy từ [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md) (70 UC trong phạm vi); endpoint lấy từ [api/openapi.json](api/openapi.json) (sinh từ code, 210 thao tác); bảng từ `apps/api/prisma/schema.prisma` (59 model); trang từ `apps/web/src/app/**/page.tsx` (66 trang); dòng code đếm dòng khác rỗng của mã nguồn `apps/api/src`, `apps/api/prisma/seed*.ts`, `apps/web/src`, `packages`, `scripts`, `infra`, `.github` và `docker-compose.yml`, **không tính** test, `mock-data`, tệp sinh tự động (`*.generated.ts`), migration và `schema.prisma`. Mỗi tệp được gán cho một module theo quy tắc ở `task-metrics` (thư mục module BE, tên trang/thành phần FE); phần dùng chung thuộc module M18.

**Công thức điểm khối lượng:** `điểm = UC × 3 + endpoint × 1 + trang FE × 2 + bảng DB × 1 + (số dòng code ÷ 250)`. Trọng số UC cao nhất vì mỗi UC kéo theo đặc tả, test và demo; dòng code ÷ 250 giúp module hạ tầng (không có UC) vẫn được tính.

### Bảng tổng phân công

| Thành viên | Module phụ trách | Số UC | Số endpoint | Số trang FE | Số bảng | Số dòng code | Điểm khối lượng | % tổng | Lệch so với trung bình |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Thành viên 1** | M09, M10, M11, M17 – Trải nghiệm 3D, không gian mẫu 360° và thống kê | 15 | 42 | 13 | 12 | 9.953 | **164.8** | 21.0% | 4.8% |
| **Thành viên 2** | M08, M12, M13, M15 – Luồng mua hàng: giỏ, mã giảm giá, đặt hàng, thanh toán, đánh giá | 16 | 40 | 16 | 13 | 6.716 | **159.9** | 20.3% | 1.7% |
| **Thành viên 3** | M05, M06, M07, M14 – Back-office: catalog quản trị, kho hàng, xử lý đơn, vận chuyển, đổi trả | 13 | 50 | 11 | 17 | 7.615 | **158.5** | 20.2% | 0.8% |
| **Thành viên 4** | M01, M16, M18 – Nền tảng: xác thực, nội dung & cài đặt, hạ tầng dùng chung | 10 | 38 | 12 | 9 | 13.714 | **155.8** | 19.8% | -0.9% |
| **Thành viên 5** | M02, M03, M04 – Khách hàng: tài khoản, quản trị người dùng, thông báo, duyệt/tìm sản phẩm | 16 | 40 | 14 | 8 | 5.740 | **147** | 18.7% | -6.5% |
| **Tổng** | 18 module | 70 | 210 | 66 | 59 | 43.738 | 786 | 100% | |

**Độ chênh:** điểm cao nhất 164.8 (Thành viên 1), thấp nhất 147 (Thành viên 5); chênh 17.8 điểm = **11.3% so với trung bình** 157.2 (mục tiêu ≤ 15%).

**Nguyên tắc chia:** mỗi người nhận các module liên quan nhau về nghiệp vụ (xem tên nhóm ở cột "Module"); ai cũng có một phần giao diện khách hoặc quản trị để demo. Module hạ tầng M18 có một người chịu trách nhiệm chính (Thành viên 4) nhưng cả nhóm cùng dùng; các việc tồn đọng của `KNOWN_ISSUES.md` được giao cho người giữ module liên quan nhất (mục "Việc còn lại" của từng người). Tên thành viên để dạng "Thành viên 1…5", điền tên thật vào bảng sau:

| Thành viên | Họ tên | Ghi chú |
|---|---|---|
| Thành viên 1 | _(điền tên)_ | |
| Thành viên 2 | _(điền tên)_ | |
| Thành viên 3 | _(điền tên)_ | |
| Thành viên 4 | _(điền tên)_ | |
| Thành viên 5 | _(điền tên)_ | |

## Phần 2. Chi tiết từng thành viên

### Thành viên 1 – Trải nghiệm 3D, không gian mẫu 360° và thống kê

**Khối lượng:** 164.8 điểm (21.0%) · 15 UC · 42 endpoint · 13 trang FE · 12 bảng · 61 tệp / 9.953 dòng code.

#### 1. Module phụ trách

| Module | Tên | UC | Endpoint | Trang FE | Bảng | Dòng code | Điểm |
|---|---|---:|---:|---:|---:|---:|---:|
| M09 | Mô hình 3D & xem 360° sản phẩm | 4 | 18 | 3 | 5 | 4.054 | 57.2 |
| M10 | Không gian mẫu 360° phía khách (duyệt, xem, hotspot, lưu, đổi món) | 6 | 8 | 3 | 2 | 1.990 | 42 |
| M11 | Quản trị không gian mẫu, ảnh 360°, hotspot, đặt mô hình 3D, phễu | 4 | 10 | 4 | 4 | 2.183 | 42.7 |
| M17 | Thống kê & thu chi | 1 | 6 | 3 | 1 | 1.726 | 22.9 |

- **M09 – Mô hình 3D & xem 360° sản phẩm:** Xem 3D (GLB, 3 mức LOD, chỉ mô hình `ready`), đổi màu/chất liệu theo biến thể mà không tải lại mô hình, xem 360° xoay ảnh theo màu; admin tải GLB (JSON, multipart, presigned), job nền kiểm tra/sinh LOD/nén Meshopt, đặt mô hình chính, cấu hình vật liệu, ảnh 360° của sản phẩm.
- **M10 – Không gian mẫu 360° phía khách (duyệt, xem, hotspot, lưu, đổi món):** Duyệt/tìm không gian mẫu (facets), xem ảnh 360° (R3F), bấm hotspot (thông tin, sản phẩm, chuyển góc), thêm cả bộ vào giỏ (tất cả-hoặc-không), lưu/bỏ lưu, thử "Đổi món" không ghi DB, ghi lượt xem một lần khi rời trang.
- **M11 – Quản trị không gian mẫu, ảnh 360°, hotspot, đặt mô hình 3D, phễu:** Admin tạo/sửa/xóa không gian (tối thiểu 1 ảnh 360° mới được đăng), hotspot trong body PATCH, đặt mô hình 3D thật vào ảnh 360° (placement: yaw/pitch/scale), phễu lượt xem → bấm hotspot → thêm giỏ (gộp user và khách theo `visitorId`, theo giờ VN).
- **M17 – Thống kê & thu chi:** Thống kê tổng quan (doanh thu theo ngày giao, top bán chạy), báo cáo tài chính (thu, giá vốn, chi phí, lợi nhuận), sổ phiếu chi nhập tay, tìm kiếm nhanh của admin.

#### 2. Phạm vi

##### M09 – Mô hình 3D & xem 360° sản phẩm

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-3D-01 | Xem mô hình 3D của sản phẩm | Nên có | ✅ Đủ |
| UC-3D-03 | Đổi màu/chất liệu trên mô hình 3D | Mở rộng | ✅ Đủ |
| UC-ADM-13 | Tải và quản lý mô hình 3D sản phẩm | Nên có | `apps/api/test/models-processi |
| UC-ADM-14 | Cấu hình biến thể chất liệu cho mô hình 3D | Mở rộng | ✅ Đủ |

**Bảng DB (5):** `product_3d_models`, `model_files`, `model_material_variants`, `product_360_configs`, `product_360_frames`

**Endpoint (18):**

```
GET /products/{slug}/model
GET /products/{slug}/360
GET /admin/products/{id}/360
PUT /admin/products/{id}/360
GET /admin/models
POST /admin/models
POST /admin/models/upload
DELETE /admin/models/model/{modelId}
DELETE /admin/models/{id}
POST /admin/models/presign
POST /admin/models/{id}/reprocess
PATCH /admin/models/{id}/primary
POST /admin/models/{id}/files/presign
POST /admin/models/{id}/files/confirm
GET /admin/models/{id}/materials
GET /admin/models/{id}/material-variants
PUT /admin/models/{id}/material-variants/{variantId}
DELETE /admin/models/{id}/material-variants/{variantId}
```

**Trang FE (3):** `/products/[slug]/360`, `/products/[slug]/3d`, `/admin/models`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/product-models/; apps/api/src/modules/products/product-360.service.ts; apps/api/src/modules/jobs/model-processing/
- FE: apps/web/src/app/(viewer)/products/[slug]/3d/; apps/web/src/app/(shop)/products/[slug]/360/; apps/web/src/app/admin/models/; apps/web/src/components/viewer/{Model*,ProductViewer3D}.tsx; apps/web/src/components/product/Rotator360.tsx; apps/web/src/components/admin/{MaterialVariantsModal,Product360Editor}.tsx; apps/web/src/lib/three-helpers.ts, store/viewerStore.ts
- Test: supertest: `models-processing.db-spec.ts`, `model-materials.db-spec.ts`, `ar-removed.db-spec.ts` · unit: `model-file-validator.spec.ts`, `model-processing.service.spec.ts` · Playwright: `admin-models.spec.ts` (nhóm `admin-3d`), `materials.spec.ts` (`vat-lieu`), `product360.spec.ts`, `admin360.spec.ts` (`xem-360`), `admin-minio.spec.ts` (MinIO), `home.spec.ts` (WebGL) · MinIO: `minio-flow.minio-spec.ts`

##### M10 – Không gian mẫu 360° phía khách (duyệt, xem, hotspot, lưu, đổi món)

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-SPACE-01 | Duyệt và tìm kiếm không gian mẫu | Nên có | ✅ Đủ |
| UC-SPACE-02 | Xem không gian mẫu 360° | Nên có | ✅ Đủ |
| UC-SPACE-03 | Bấm điểm sản phẩm trong phòng mẫu (mua theo phong cách phòng) | Nên có | ✅ Đủ |
| UC-SPACE-04 | Lưu / bỏ lưu không gian mẫu yêu thích | Nên có | ✅ Đủ |
| UC-SPACE-05 | Thử đổi món đồ trong phòng mẫu | Mở rộng | ✅ Đủ |
| UC-SPACE-06 | Ghi nhận lượt xem không gian mẫu (một lần khi rời trang) | Mở rộng | ✅ Đủ |

**Bảng DB (2):** `space_bookmarks`, `space_views`

**Endpoint (8):**

```
GET /spaces
GET /spaces/facets
GET /spaces/{slug}
GET /spaces/{slug}/placements/{placementId}/alternatives
POST /spaces/{slug}/views
POST /spaces/{slug}/add-to-cart
PUT /spaces/{slug}/bookmark
DELETE /spaces/{slug}/bookmark
```

**Trang FE (3):** `/account/saved-spaces`, `/spaces/[slug]`, `/spaces`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/spaces/ (spaces.controller, spaces.service)
- FE: apps/web/src/app/(shop)/spaces/; apps/web/src/app/(account)/account/saved-spaces/; apps/web/src/components/viewer/{SpacePanorama,Hotspot}.tsx; apps/web/src/components/product/SpaceCard.tsx; apps/web/src/hooks/useSpaces.ts, services/space.api.ts
- Test: supertest: `account.db-spec.ts` (UC-SPACE-04), `mock-m3.db-spec.ts` (mục không gian mẫu, add-to-cart), `space-source.db-spec.ts`, `placements.db-spec.ts` (đổi món) · unit: `spaces.combo.spec.ts`; web: `saved-spaces.test.tsx` · Playwright: `spaces360.spec.ts` (`xem-360`), `space-source.spec.ts`, `placements360.spec.ts` (`phong-3d`)

##### M11 – Quản trị không gian mẫu, ảnh 360°, hotspot, đặt mô hình 3D, phễu

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-15 | Quản lý không gian mẫu và ảnh 360° | Nên có | ✅ Đủ |
| UC-ADM-16 | Quản lý điểm tương tác (hotspot) trên ảnh 360° | Nên có | ✅ Đủ |
| UC-ADM-17 | Đặt mô hình 3D sản phẩm vào ảnh 360° (placement) | Mở rộng | ✅ Đủ |
| UC-ADM-29 | Thống kê AR và phễu không gian mẫu | Mở rộng | ✅ Đủ |

**Bảng DB (4):** `spaces`, `space_panoramas`, `space_hotspots`, `space_product_placements`

**Endpoint (10):**

```
GET /admin/spaces
POST /admin/spaces
GET /admin/spaces/{id}
PATCH /admin/spaces/{id}
DELETE /admin/spaces/{id}
GET /admin/panoramas/{id}/placements
POST /admin/panoramas/{id}/placements
PATCH /admin/panoramas/{id}/placements/{placementId}
DELETE /admin/panoramas/{id}/placements/{placementId}
GET /admin/stats/spaces
```

**Trang FE (4):** `/admin/reports/spaces`, `/admin/spaces/[id]`, `/admin/spaces/new`, `/admin/spaces`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/spaces/admin-*; apps/api/src/modules/panoramas/; apps/api/src/modules/admin-stats/admin-space-stats.service.ts; apps/api/src/modules/hotspots/ (khung rỗng)
- FE: apps/web/src/app/admin/{spaces,reports/spaces}/; apps/web/src/components/admin/{SpaceForm,PlacementEditor}.tsx
- Test: supertest: `placements.db-spec.ts`, `space-funnel.db-spec.ts`, `vn-time.db-spec.ts`, `mock-m3.db-spec.ts` (tải ảnh lớn), `dac-conformance.db-spec.ts` (nhóm 4) · Playwright: `admin360.spec.ts` (không gian), `placements360.spec.ts` (`phong-3d`), `admin-m3.spec.ts`

##### M17 – Thống kê & thu chi

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-28 | Xem thống kê tổng quan | Mở rộng | 🟡 Lệch có chủ đích (đã ghi CHUAN_MO_RONG) |

**Bảng DB (1):** `expenses`

**Endpoint (6):**

```
GET /admin/stats/overview
GET /admin/search
GET /admin/stats/finance
GET /admin/expenses
POST /admin/expenses
DELETE /admin/expenses/{id}
```

**Trang FE (3):** `/admin/dashboard`, `/admin`, `/admin/reports`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/admin-stats/ (trừ admin-space-stats)
- FE: apps/web/src/app/admin/page.tsx; apps/web/src/app/admin/{reports,dashboard}/
- Test: supertest: `mock-m4.db-spec.ts` (thu chi và báo cáo), `mock-m2.db-spec.ts` (dashboard), `vn-time.db-spec.ts` · Playwright: `admin-m4.spec.ts` (thu chi → báo cáo), `admin-m2.spec.ts`

#### 3. Nhiệm vụ

- [ ] Đọc hiểu luồng end-to-end của từng UC ở trên (giao diện → `services/*.api.ts` → controller → service → Prisma → bảng DB), vẽ nhanh sơ đồ tuần tự cho 2–3 UC quan trọng nhất.
- [ ] Chạy thử trên máy (`npm run infra:up`, `npm run db:deploy`, `npm run db:seed`, `npm run dev`; hoặc `npm run demo`) và thực hiện đủ các luồng chính của phần mình ở cả vai trò khách và admin (hướng dẫn: [HUONG_DAN_DEMO.md](HUONG_DAN_DEMO.md)).
- [ ] Review code phần mình: ghi lại lỗi, điểm khó hiểu, đề xuất cải thiện (tạo issue hoặc ghi vào PR, không sửa lan sang module người khác).
- [ ] Chạy các test liên quan và xác nhận xanh (cần `aurelia_test` dựng mới: `node scripts/db-reset.mjs aurelia_test`):
  - `cd apps/api && npx jest --config test/jest-db.config.js --runInBand test/placements.db-spec.ts test/space-funnel.db-spec.ts test/space-source.db-spec.ts test/models-processing.db-spec.ts test/model-materials.db-spec.ts test/vn-time.db-spec.ts`
  - `cd apps/api && npx jest src/modules/product-models src/modules/jobs src/modules/spaces`
  - `E2E_ONLY=xem-360 npm run test:e2e:real` # rồi lần lượt `admin-3d`, `vat-lieu`, `phong-3d`
- [ ] Kiểm tra tài liệu phần mình khớp code: dòng của module trong [API_CONTRACT.md](API_CONTRACT.md) (và `api/openapi.json`), UC trong [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) và [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md), bảng trong [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); ghi chỗ lệch.
- [ ] Việc còn lại được giao từ `KNOWN_ISSUES.md` (bảng bên dưới).
- [ ] Chuẩn bị kịch bản demo 3–5 phút cho phần mình (gợi ý bên dưới), tập chạy trước một lần trên dữ liệu demo.

**Việc còn lại được giao từ [KNOWN_ISSUES.md](KNOWN_ISSUES.md)** (mức độ: S ≤ nửa ngày, M ≈ 1–2 ngày, L > 2 ngày):

| Việc | Mức | Cách làm / ghi chú |
|---|---|---|
| Module rỗng `apps/api/src/modules/hotspots/*` (3 tệp không route; logic hotspot đã gộp vào `admin-spaces`, D-N32) | S | Đề xuất: xóa tệp/module hoặc ghi rõ lý do giữ; cần nhóm đồng ý (chỉ báo cáo trước khi xóa) |
| Endpoint chưa có test tham chiếu: `GET /spaces/facets`, `PATCH|DELETE /admin/panoramas/:id/placements/:placementId` | M | Viết supertest (`placements.db-spec.ts` mở rộng) rồi chạy xanh |
| Thêm bộ không gian vào giỏ (`POST /spaces/:slug/add-to-cart`, D-N37) đã có test ở `mock-m3`; kiểm lại e2e `spaces360.spec.ts` sau khi đổi hợp đồng | S | Chạy `E2E_ONLY=xem-360 npm run test:e2e:real`, ghi kết quả |

**Gợi ý kịch bản demo (3–5 phút):**

1. Admin: tải GLB ở `/admin/models` ⇒ xem trạng thái "Đang xử lý" chuyển "Sẵn sàng" (3 LOD).
2. Khách: mở `/products/sofa-nordic/3d`, đổi màu (vật liệu đổi ngay, không tải lại); mở `/products/sofa-nordic/360` xoay bằng chuột/phím.
3. Khách: `/spaces` ⇒ mở một không gian, xoay ảnh 360°, bấm hotspot, thêm cả bộ vào giỏ; thử "Đổi món".
4. Admin: `/admin/spaces/:id` đặt mô hình 3D vào ảnh 360°; `/admin/reports/spaces` xem phễu; `/admin` và `/admin/reports` xem doanh thu, thu chi.

#### 4. Câu hỏi giảng viên có thể hỏi

1. Vì sao tải GLB phải đi qua job nền BullMQ và sinh 3 mức LOD? Ngưỡng 5 MB (`MODEL_SERVE_MAX_MB`) và nén Meshopt để làm gì? Chuyện gì xảy ra khi tệp hỏng (`failed`, xử lý lại)?
2. Hotspot và placement lưu vị trí thế nào (yaw/pitch/scale)? Ràng buộc DB nào bảo đảm chỉ một mô hình chính cho mỗi sản phẩm (partial unique `uq_product_3d_models_primary`) và cờ `has_3d_model` do ai cập nhật (trigger)?
3. Phễu không gian mẫu tính thế nào khi gộp người dùng đăng nhập và khách theo `visitorId`? Vì sao phải tính theo giờ Việt Nam (`vn-time.db-spec.ts`)?
4. Vì sao ảnh 360° lớn tải thẳng lên MinIO bằng presigned URL thay vì qua API? CORS và bước `confirm` để làm gì? Tệp gốc nằm ở bucket nào?
5. Thêm cả bộ không gian vào giỏ vì sao phải "tất cả-hoặc-không"? Cài đặt trong transaction ra sao và trả lỗi gì?

#### 5. Phụ thuộc với thành viên khác (cần phối hợp)

- Thành viên 5: trang chi tiết sản phẩm (`/products/[slug]`) nhúng nút 3D/360° và khối "Xem trong không gian mẫu".
- Thành viên 2: thêm bộ không gian vào giỏ dùng `CartService.addItems` (giỏ hàng).
- Thành viên 3: ảnh 360° của sản phẩm nằm trong `admin-products.controller.ts` (endpoint thuộc module 3D của bạn, tệp thuộc thành viên 3).
- Thành viên 4: `StorageService`, `jobs` (BullMQ), presigned URL, `shared-types`.

---

### Thành viên 2 – Luồng mua hàng: giỏ, mã giảm giá, đặt hàng, thanh toán, đánh giá

**Khối lượng:** 159.9 điểm (20.3%) · 16 UC · 40 endpoint · 16 trang FE · 13 bảng · 53 tệp / 6.716 dòng code.

#### 1. Module phụ trách

| Module | Tên | UC | Endpoint | Trang FE | Bảng | Dòng code | Điểm |
|---|---|---:|---:|---:|---:|---:|---:|
| M08 | Đánh giá & hỏi đáp | 4 | 11 | 3 | 3 | 1.378 | 37.5 |
| M12 | Giỏ hàng & mã giảm giá | 5 | 15 | 5 | 6 | 2.074 | 54.3 |
| M13 | Đặt hàng và theo dõi đơn của khách (gồm yêu cầu đổi trả) | 3 | 7 | 5 | 3 | 2.292 | 38.2 |
| M15 | Thanh toán (online, IPN, thanh toán lại, đối soát chuyển khoản) | 4 | 7 | 3 | 1 | 972 | 29.9 |

- **M08 – Đánh giá & hỏi đáp:** Xem đánh giá, viết đánh giá sản phẩm đã mua (cần email đã xác thực, kiểm duyệt pending → approved), sửa/xóa đánh giá của mình, admin duyệt/từ chối; hỏi đáp sản phẩm (khách hỏi, admin trả lời/ẩn).
- **M12 – Giỏ hàng & mã giảm giá:** Giỏ hàng (thêm, sửa, xóa, kiểm tồn), áp/gỡ mã giảm giá (kiểm hạn, lượt dùng, đơn tối thiểu, freeship), ví mã (lưu, gợi ý); admin quản lý mã (phạm vi theo sản phẩm/danh mục/không gian).
- **M13 – Đặt hàng và theo dõi đơn của khách (gồm yêu cầu đổi trả):** Đặt hàng (một transaction: khóa dòng, trừ tồn, mã đơn `ALV-YYYYMMDD-NNNN`, phí vận chuyển theo vùng, mã giảm giá trong `couponCode`), xem/theo dõi đơn, hủy đơn, yêu cầu đổi/trả (ảnh minh chứng).
- **M15 – Thanh toán (online, IPN, thanh toán lại, đối soát chuyển khoản):** Thanh toán COD/chuyển khoản/VNPAY (URL có chữ ký, số tiền lấy từ `Order.total`), Return URL và IPN (idempotent, 00/02/97/01/04), thanh toán lại, đối soát chuyển khoản (xác nhận kèm `transactionCode` duy nhất, đánh dấu thất bại), chế độ giả lập (cấm ở production).

#### 2. Phạm vi

##### M08 – Đánh giá & hỏi đáp

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-REV-01 | Xem đánh giá sản phẩm | Nên có | ✅ Đủ |
| UC-REV-02 | Đánh giá sản phẩm đã mua | Nên có | ✅ Đủ |
| UC-REV-03 | Sửa/xóa đánh giá của mình | Mở rộng | ✅ Đủ |
| UC-ADM-18 | Duyệt hoặc từ chối đánh giá | Nên có | ✅ Đủ |

**Bảng DB (3):** `reviews`, `review_images`, `product_questions`

**Endpoint (11):**

```
GET /products/{slug}/reviews
POST /products/{slug}/reviews
GET /products/{slug}/questions
POST /products/{slug}/questions
GET /reviews/me
PATCH /reviews/{id}
DELETE /reviews/{id}
GET /admin/reviews
PATCH /admin/reviews/{id}/status
GET /admin/questions
PATCH /admin/questions/{id}
```

**Trang FE (3):** `/account/reviews`, `/admin/questions`, `/admin/reviews`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/reviews/
- FE: apps/web/src/app/(account)/account/reviews/; apps/web/src/app/admin/{reviews,questions}/; apps/web/src/components/account/{ReviewCard,ReviewModal}.tsx; tab Đánh giá/Hỏi đáp trong components/product/ProductTabs.tsx (do thành viên 5 giữ file)
- Test: supertest: `mock-m3.db-spec.ts` (đánh giá, hỏi đáp), `mock-m2.db-spec.ts` (đánh giá có kiểm duyệt), `dac-conformance.db-spec.ts` (nhóm đánh giá) · unit: `reviews.rules.spec.ts` · Playwright: `screens.spec.ts` (đặt hàng → đánh giá), `admin-m3.spec.ts`

##### M12 – Giỏ hàng & mã giảm giá

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-CART-01 | Thêm sản phẩm vào giỏ hàng | Bắt buộc | ✅ Đủ |
| UC-CART-02 | Xem giỏ hàng | Bắt buộc | ✅ Đủ |
| UC-CART-03 | Cập nhật số lượng / xóa dòng trong giỏ | Bắt buộc | ✅ Đủ |
| UC-CART-04 | Áp mã giảm giá | Nên có | 🟡 Lệch có chủ đích (đã ghi CHUAN_MO_RONG) |
| UC-ADM-19 | Quản lý mã giảm giá | Nên có | ✅ Đủ |

**Bảng DB (6):** `carts`, `cart_items`, `coupons`, `coupon_usages`, `coupon_scopes`, `user_coupons`

**Endpoint (15):**

```
GET /cart
DELETE /cart
POST /cart/items
PATCH /cart/items/{id}
DELETE /cart/items/{id}
POST /cart/coupon
DELETE /cart/coupon
GET /coupons/me
GET /coupons/suggested
POST /coupons/save
GET /admin/coupons
POST /admin/coupons
GET /admin/coupons/{id}
PATCH /admin/coupons/{id}
DELETE /admin/coupons/{id}
```

**Trang FE (5):** `/account/coupons`, `/cart`, `/admin/promotions/[id]`, `/admin/promotions/new`, `/admin/promotions`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/cart/; apps/api/src/modules/coupons/
- FE: apps/web/src/app/(shop)/cart/; apps/web/src/app/(account)/account/coupons/; apps/web/src/app/admin/promotions/; apps/web/src/components/cart/, components/account/CouponCard.tsx, components/admin/PromotionForm.tsx; apps/web/src/hooks/useCart.ts
- Test: supertest: `core-flows.db-spec.ts` (UC-CART-02, CART-04), `mock-m2.db-spec.ts` (mục khuyến mãi), `dac-conformance.db-spec.ts` (nhóm giỏ hàng) · unit: `coupons.service.spec.ts` · Playwright: `admin-m2.spec.ts` (khuyến mãi), `screens.spec.ts` (giỏ → mã → đặt hàng)

##### M13 – Đặt hàng và theo dõi đơn của khách (gồm yêu cầu đổi trả)

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ORD-01 | Đặt hàng | Bắt buộc | ✅ Đủ |
| UC-ORD-02 | Xem và theo dõi đơn hàng của tôi | Bắt buộc | ✅ Đủ |
| UC-ORD-03 | Hủy đơn hàng | Bắt buộc | ✅ Đủ |

**Bảng DB (3):** `orders`, `order_items`, `order_status_history`

**Endpoint (7):**

```
GET /returns
POST /returns
POST /orders
GET /orders
GET /orders/counts
GET /orders/{code}
POST /orders/{id}/cancel
```

**Trang FE (5):** `/account/orders/[code]`, `/account/orders`, `/account/returns/new`, `/account/returns`, `/checkout`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/orders/ (orders.controller, orders.service, order-views, order-state); apps/api/src/modules/returns/ (returns.controller, returns.service, returns.rules)
- FE: apps/web/src/app/(shop)/checkout/page.tsx; apps/web/src/app/(account)/account/{orders,returns}/; apps/web/src/components/account/{OrderCard,OrderStepper}.tsx
- Test: supertest: `mock-m2.db-spec.ts` (đặt hàng → tồn kho, đồng thời), `mock-m4.db-spec.ts` (phí vận chuyển), `mock-m3.db-spec.ts` (đổi trả), `dac-conformance.db-spec.ts` (nhóm đơn hàng) · unit: `order-state.spec.ts`, `returns.rules.spec.ts` · Playwright: `screens.spec.ts` (khách hàng đặt hàng), `admin-race.spec.ts`

##### M15 – Thanh toán (online, IPN, thanh toán lại, đối soát chuyển khoản)

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-PAY-01 | Thanh toán đơn hàng online | Bắt buộc | ✅ Đủ |
| UC-PAY-02 | Nhận callback/IPN từ cổng thanh toán | Bắt buộc | 🟡 Lệch có chủ đích (đã ghi CHUAN_MO_RONG) |
| UC-PAY-03 | Thanh toán lại đơn chưa thanh toán | Nên có | ✅ Đủ |
| UC-ADM-24 | Quản lý thanh toán (xác nhận chuyển khoản) | Nên có | ✅ Đủ |

**Bảng DB (1):** `payments`

**Endpoint (7):**

```
GET /payments/vnpay/return
GET /payments/vnpay/ipn
POST /payments/{orderId}/checkout
POST /payments/{orderId}/retry
GET /admin/payments
PATCH /admin/payments/{id}/confirm
PATCH /admin/payments/{id}/fail
```

**Trang FE (3):** `/checkout/failed`, `/checkout/success`, `/admin/payments`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/payments/
- FE: apps/web/src/app/(shop)/checkout/{success,failed}/; apps/web/src/app/admin/payments/
- Test: supertest: `mock-m4.db-spec.ts` (mục VNPAY, payments[].enabled), `account.db-spec.ts` (UC-ADM-24), `dac-conformance.db-spec.ts` · unit: `vnpay.spec.ts`, `payments.sandbox.spec.ts` · Playwright: `admin-m5.spec.ts` (trang /admin/payments)

#### 3. Nhiệm vụ

- [ ] Đọc hiểu luồng end-to-end của từng UC ở trên (giao diện → `services/*.api.ts` → controller → service → Prisma → bảng DB), vẽ nhanh sơ đồ tuần tự cho 2–3 UC quan trọng nhất.
- [ ] Chạy thử trên máy (`npm run infra:up`, `npm run db:deploy`, `npm run db:seed`, `npm run dev`; hoặc `npm run demo`) và thực hiện đủ các luồng chính của phần mình ở cả vai trò khách và admin (hướng dẫn: [HUONG_DAN_DEMO.md](HUONG_DAN_DEMO.md)).
- [ ] Review code phần mình: ghi lại lỗi, điểm khó hiểu, đề xuất cải thiện (tạo issue hoặc ghi vào PR, không sửa lan sang module người khác).
- [ ] Chạy các test liên quan và xác nhận xanh (cần `aurelia_test` dựng mới: `node scripts/db-reset.mjs aurelia_test`):
  - `cd apps/api && npx jest --config test/jest-db.config.js --runInBand test/core-flows.db-spec.ts test/mock-m2.db-spec.ts test/mock-m3.db-spec.ts test/mock-m4.db-spec.ts`
  - `cd apps/api && npx jest src/modules/coupons src/modules/payments src/modules/reviews src/modules/orders src/modules/returns`
  - `E2E_ONLY=khach-hang npm run test:e2e:real` # rồi `admin-m5` (trang payments)
- [ ] Kiểm tra tài liệu phần mình khớp code: dòng của module trong [API_CONTRACT.md](API_CONTRACT.md) (và `api/openapi.json`), UC trong [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) và [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md), bảng trong [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); ghi chỗ lệch.
- [ ] Việc còn lại được giao từ `KNOWN_ISSUES.md` (bảng bên dưới).
- [ ] Chuẩn bị kịch bản demo 3–5 phút cho phần mình (gợi ý bên dưới), tập chạy trước một lần trên dữ liệu demo.

**Việc còn lại được giao từ [KNOWN_ISSUES.md](KNOWN_ISSUES.md)** (mức độ: S ≤ nửa ngày, M ≈ 1–2 ngày, L > 2 ngày):

| Việc | Mức | Cách làm / ghi chú |
|---|---|---|
| Endpoint chưa có test tham chiếu: `GET /coupons/me`, `GET /coupons/suggested`, `POST /coupons/save`, `GET /orders/counts` | M | Viết supertest (có thể trong `core-flows.db-spec.ts` hoặc tệp mới `coupons-wallet.db-spec.ts`) |
| Ví mã `/account/coupons` và trang thanh toán dùng nhiều trạng thái: rà `TODO`/hành vi khi hết hạn, đã dùng | S | Đọc code và ghi lại điểm lệch (không sửa nếu ngoài phạm vi) |

**Gợi ý kịch bản demo (3–5 phút):**

1. Khách đăng nhập ⇒ thêm sản phẩm vào giỏ ⇒ áp mã giảm giá ở `/cart`.
2. Đặt hàng ở `/checkout` bằng COD rồi bằng VNPAY giả lập (trang thành công/thất bại, thanh toán lại).
3. Admin: `/admin/payments` xác nhận chuyển khoản (mã giao dịch trùng báo lỗi).
4. Khách: theo dõi đơn `/account/orders/:code`, hủy đơn, sau khi hoàn tất viết đánh giá; admin duyệt đánh giá.

#### 4. Câu hỏi giảng viên có thể hỏi

1. Đặt hàng đồng thời nhiều người cho cùng sản phẩm còn ít tồn: hệ thống tránh bán quá tồn thế nào (transaction, khóa dòng `FOR UPDATE`, test 6 đơn đồng thời)?
2. IPN của VNPAY bị gọi hai lần hoặc gọi sai chữ ký/số tiền thì xử lý ra sao (idempotent, mã 00/02/97/01/04)? Vì sao số tiền lấy từ `Order.total` chứ không tin client?
3. Mã giảm giá được kiểm tra và ghi lượt dùng thế nào để không vượt giới hạn khi hai người dùng cùng lúc (cập nhật có điều kiện `updateMany`)?
4. Vì sao chỉ người đã mua và đã xác thực email mới được đánh giá, và đánh giá mới ở trạng thái `pending`? Điểm trung bình do trigger hay service tính?
5. Máy trạng thái đơn hàng (`order-state.ts`) cho phép những chuyển trạng thái nào? Hủy đơn khi nào được, hoàn tồn kho ra sao?

#### 5. Phụ thuộc với thành viên khác (cần phối hợp)

- Thành viên 3: kho hàng (trừ/hoàn tồn khi đặt, hủy, hoàn tiền) và xử lý đơn phía admin.
- Thành viên 4: xác thực, `settings` (phương thức thanh toán, vùng vận chuyển), mail xác nhận.
- Thành viên 1: thêm bộ không gian vào giỏ; Thành viên 5: trang sản phẩm có nút thêm vào giỏ và đánh giá.

---

### Thành viên 3 – Back-office: catalog quản trị, kho hàng, xử lý đơn, vận chuyển, đổi trả

**Khối lượng:** 158.5 điểm (20.2%) · 13 UC · 50 endpoint · 11 trang FE · 17 bảng · 44 tệp / 7.615 dòng code.

#### 1. Module phụ trách

| Module | Tên | UC | Endpoint | Trang FE | Bảng | Dòng code | Điểm |
|---|---|---:|---:|---:|---:|---:|---:|
| M05 | Quản trị danh mục, thương hiệu, thuộc tính | 3 | 16 | 3 | 4 | 1.571 | 41.3 |
| M06 | Quản trị sản phẩm, biến thể, ảnh sản phẩm, thư viện media | 4 | 12 | 4 | 6 | 2.645 | 48.6 |
| M07 | Kho hàng | 1 | 9 | 1 | 3 | 1.090 | 21.4 |
| M14 | Xử lý đơn quản trị: trạng thái, hủy, hoàn tiền, vận chuyển, duyệt đổi trả | 5 | 13 | 3 | 4 | 2.309 | 47.2 |

- **M05 – Quản trị danh mục, thương hiệu, thuộc tính:** CRUD danh mục (cây 2 cấp), thương hiệu (logo, trùng slug 409), thuộc tính và giá trị (giá trị đang dùng không xóa được).
- **M06 – Quản trị sản phẩm, biến thể, ảnh sản phẩm, thư viện media:** Tạo/sửa/xóa mềm sản phẩm; biến thể và ảnh nằm trong body `variants[]`/`images[]` của POST/PATCH (D-N32, đồng bộ theo `mediaId`, một ảnh đại diện); đăng cần biến thể hoạt động và ảnh đại diện; thư viện media (≤ 5 MB, 413/415, webp + thumbnail qua job nền, presigned URL).
- **M07 – Kho hàng:** Tồn kho theo biến thể, nhập/điều chỉnh/hàng trả (movement), phiếu nhập/xuất (nháp → xác nhận/hủy, xuất quá tồn ⇒ 409 hoàn tác), cập nhật giá vốn, điều chỉnh tồn trực tiếp ở giao diện.
- **M14 – Xử lý đơn quản trị: trạng thái, hủy, hoàn tiền, vận chuyển, duyệt đổi trả:** Admin xem đơn, đổi trạng thái (máy trạng thái), hủy đơn (hoàn tồn; ngoại lệ khi mọi vận đơn `returned`), hoàn tiền thủ công (khóa dòng đơn, phiếu chi `refund`), tạo vận đơn và đổi trạng thái vận đơn (§10.4, thông báo một lần), duyệt đổi trả.

#### 2. Phạm vi

##### M05 – Quản trị danh mục, thương hiệu, thuộc tính

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-05 | Quản lý danh mục sản phẩm | Bắt buộc | ✅ Đủ |
| UC-ADM-06 | Quản lý thương hiệu | Nên có | ✅ Đủ |
| UC-ADM-08 | Quản lý thuộc tính và giá trị thuộc tính | Bắt buộc | ✅ Đủ |

**Bảng DB (4):** `categories`, `brands`, `attributes`, `attribute_values`

**Endpoint (16):**

```
GET /admin/categories
POST /admin/categories
PATCH /admin/categories/{id}
DELETE /admin/categories/{id}
GET /admin/brands
POST /admin/brands
GET /admin/brands/{id}
PATCH /admin/brands/{id}
DELETE /admin/brands/{id}
GET /admin/attributes
POST /admin/attributes
PATCH /admin/attributes/{id}
DELETE /admin/attributes/{id}
POST /admin/attributes/{id}/values
PATCH /admin/attributes/{id}/values/{valueId}
DELETE /admin/attributes/{id}/values/{valueId}
```

**Trang FE (3):** `/admin/attributes`, `/admin/brands`, `/admin/categories`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/{categories,brands}/admin-*; apps/api/src/modules/attributes/
- FE: apps/web/src/app/admin/{categories,brands,attributes}/
- Test: supertest: `mock-m5.db-spec.ts` (thương hiệu, thuộc tính), `mock-m2.db-spec.ts` (mục danh mục), `dac-conformance.db-spec.ts` · Playwright: `admin-m5.spec.ts` (thương hiệu, thuộc tính), `admin-m2.spec.ts`

##### M06 – Quản trị sản phẩm, biến thể, ảnh sản phẩm, thư viện media

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-04 | Quản lý media (ảnh, tệp) | Bắt buộc | ✅ Đủ |
| UC-ADM-09 | Quản lý sản phẩm | Bắt buộc | ✅ Đủ |
| UC-ADM-10 | Quản lý biến thể sản phẩm | Bắt buộc | ✅ Đủ |
| UC-ADM-11 | Quản lý ảnh sản phẩm | Bắt buộc | ✅ Đủ |

**Bảng DB (6):** `products`, `product_variants`, `variant_attribute_values`, `product_images`, `product_specs`, `media`

**Endpoint (12):**

```
GET /admin/products
POST /admin/products
GET /admin/products/{id}
PATCH /admin/products/{id}
DELETE /admin/products/{id}
POST /admin/media
GET /admin/media
POST /admin/media/presign
POST /admin/media/confirm
GET /admin/media/upload-config
PATCH /admin/media/{id}
DELETE /admin/media/{id}
```

**Trang FE (4):** `/admin/media`, `/admin/products/[id]`, `/admin/products/new`, `/admin/products`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/products/admin-products.*; apps/api/src/modules/media/; apps/api/src/modules/jobs/image-processing/; apps/api/src/modules/{product-images,variants}/ (khung rỗng)
- FE: apps/web/src/app/admin/{products,media}/; apps/web/src/components/admin/ProductForm.tsx; apps/web/src/services/{media.api,direct-upload}.ts
- Test: supertest: `admin-product-media.db-spec.ts` (UC-ADM-10/11), `mock-m2.db-spec.ts` (mục sản phẩm), `mock-m5.db-spec.ts` (media), `dac-conformance.db-spec.ts` · Playwright: `admin-m2.spec.ts`, `admin-m5.spec.ts` (media), nhóm `admin-m2`/`admin-m5`

##### M07 – Kho hàng

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-12 | Nhập kho và điều chỉnh tồn kho | Bắt buộc | cancel` |

**Bảng DB (3):** `inventory_movements`, `stock_receipts`, `stock_receipt_items`

**Endpoint (9):**

```
GET /admin/inventory
GET /admin/inventory/summary
GET /admin/inventory/movements
POST /admin/inventory/movements
GET /admin/inventory/receipts
POST /admin/inventory/receipts
GET /admin/inventory/receipts/{id}
POST /admin/inventory/receipts/{id}/confirm
POST /admin/inventory/receipts/{id}/cancel
```

**Trang FE (1):** `/admin/inventory`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/inventory/
- FE: apps/web/src/app/admin/inventory/
- Test: supertest: `mock-m4.db-spec.ts` (mục kho hàng) · Playwright: `admin-m4.spec.ts` (phiếu nhập/xuất, điều chỉnh tồn), nhóm `admin-m4`

##### M14 – Xử lý đơn quản trị: trạng thái, hủy, hoàn tiền, vận chuyển, duyệt đổi trả

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-20 | Xem danh sách và chi tiết đơn hàng | Bắt buộc | ✅ Đủ |
| UC-ADM-21 | Cập nhật trạng thái đơn hàng | Bắt buộc | ✅ Đủ |
| UC-ADM-22 | Hủy đơn hàng (quản trị) | Bắt buộc | ✅ Đủ |
| UC-ADM-23 | Hoàn tiền thủ công | Nên có | ✅ Đủ |
| UC-ADM-25 | Quản lý vận chuyển | Bắt buộc | ✅ Đủ |

**Bảng DB (4):** `shipments`, `return_requests`, `return_request_items`, `return_request_images`

**Endpoint (13):**

```
GET /admin/returns
PATCH /admin/returns/{id}
GET /admin/orders
POST /admin/orders
GET /admin/orders/counts
GET /admin/orders/{code}/invoice
GET /admin/orders/{code}
PATCH /admin/orders/{id}/status
POST /admin/orders/{id}/cancel
POST /admin/orders/{id}/refund
PATCH /admin/orders/{id}/note
POST /admin/orders/{id}/shipments
PATCH /admin/shipments/{id}
```

**Trang FE (3):** `/admin/orders/[code]`, `/admin/orders`, `/admin/returns`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/orders/admin-orders.*; apps/api/src/modules/shipments/; apps/api/src/modules/returns/admin-returns.*
- FE: apps/web/src/app/admin/{orders,returns}/
- Test: supertest: `mock-m2.db-spec.ts` (đơn hàng admin), `mock-m3.db-spec.ts` (đổi trả → hoàn tiền, hoàn theo tiền thực trả), `mock-m5.db-spec.ts` (vận chuyển), `shipment-states.db-spec.ts`, `mock-m4.db-spec.ts` (frozen clock: phiếu chi hoàn tiền theo ngày VN) · unit: `order-state.spec.ts` · Playwright: `admin-m3.spec.ts` (đổi trả), `admin-m5.spec.ts` (vận chuyển)

#### 3. Nhiệm vụ

- [ ] Đọc hiểu luồng end-to-end của từng UC ở trên (giao diện → `services/*.api.ts` → controller → service → Prisma → bảng DB), vẽ nhanh sơ đồ tuần tự cho 2–3 UC quan trọng nhất.
- [ ] Chạy thử trên máy (`npm run infra:up`, `npm run db:deploy`, `npm run db:seed`, `npm run dev`; hoặc `npm run demo`) và thực hiện đủ các luồng chính của phần mình ở cả vai trò khách và admin (hướng dẫn: [HUONG_DAN_DEMO.md](HUONG_DAN_DEMO.md)).
- [ ] Review code phần mình: ghi lại lỗi, điểm khó hiểu, đề xuất cải thiện (tạo issue hoặc ghi vào PR, không sửa lan sang module người khác).
- [ ] Chạy các test liên quan và xác nhận xanh (cần `aurelia_test` dựng mới: `node scripts/db-reset.mjs aurelia_test`):
  - `cd apps/api && npx jest --config test/jest-db.config.js --runInBand test/mock-m5.db-spec.ts test/admin-product-media.db-spec.ts test/shipment-states.db-spec.ts test/mock-m4.db-spec.ts`
  - `cd apps/api && npx jest src/modules/orders src/modules/returns`
  - `E2E_ONLY=admin-m2 npm run test:e2e:real` # rồi `admin-m3`, `admin-m4`, `admin-m5`, `admin-race`
- [ ] Kiểm tra tài liệu phần mình khớp code: dòng của module trong [API_CONTRACT.md](API_CONTRACT.md) (và `api/openapi.json`), UC trong [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) và [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md), bảng trong [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); ghi chỗ lệch.
- [ ] Việc còn lại được giao từ `KNOWN_ISSUES.md` (bảng bên dưới).
- [ ] Chuẩn bị kịch bản demo 3–5 phút cho phần mình (gợi ý bên dưới), tập chạy trước một lần trên dữ liệu demo.

**Việc còn lại được giao từ [KNOWN_ISSUES.md](KNOWN_ISSUES.md)** (mức độ: S ≤ nửa ngày, M ≈ 1–2 ngày, L > 2 ngày):

| Việc | Mức | Cách làm / ghi chú |
|---|---|---|
| Module rỗng `apps/api/src/modules/product-images/*` và `variants/*` (không route; logic gộp vào `admin-products`, D-N32) | S | Đề xuất xóa hoặc giữ kèm giải thích; chỉ báo cáo trước khi xóa |
| `GET /admin/orders/:code/invoice` có ở BE nhưng chưa có giao diện in hóa đơn | M | Đề xuất giao diện hoặc ghi vào đặc tả là hướng phát triển |
| Nếu còn thời gian: rà `docs/DOI_CHIEU_UC.md` cho UC-ADM-12/ADM-20..25 khớp hành vi thật | S | Cập nhật tài liệu qua PR |

**Gợi ý kịch bản demo (3–5 phút):**

1. Admin: tạo thương hiệu, danh mục, thuộc tính; tạo sản phẩm có biến thể và ảnh (`/admin/products/new`).
2. Kho: tạo phiếu nhập nháp ⇒ xác nhận (tồn tăng, phiếu chi giá vốn); điều chỉnh tồn trực tiếp; thử xuất quá tồn (bị từ chối).
3. Đơn: xác nhận ⇒ xử lý ⇒ tạo vận đơn ⇒ đang giao ⇒ vận đơn giao thành công ⇒ hoàn tất.
4. Đổi trả: khách tạo yêu cầu ⇒ admin duyệt ⇒ hoàn tiền (phiếu chi `refund`, tồn kho cộng lại).

#### 4. Câu hỏi giảng viên có thể hỏi

1. Vì sao biến thể và ảnh sản phẩm không có route riêng mà nằm trong body `POST/PATCH /admin/products` (D-N32)? Đồng bộ theo `mediaId` giải quyết vấn đề gì?
2. Tồn kho được cập nhật qua `inventory_movements` thế nào để mọi thay đổi đều có dấu vết? Xuất kho quá tồn xử lý ra sao và vì sao hai phiếu xuất đồng thời không làm tồn âm?
3. Máy trạng thái vận đơn (§10.4) khác gì máy trạng thái đơn hàng? Tại sao đơn `shipping` mà mọi vận đơn `returned` lại được hủy (D-N34)?
4. Hoàn tiền tính theo tiền thực trả (có coupon, không hoàn phí ship) thế nào? Vì sao phải khóa dòng đơn khi hoàn tiền (tránh hoàn hai lần)?
5. Vì sao sản phẩm dùng xóa mềm còn thương hiệu/thuộc tính thì chặn xóa khi đang dùng (`RESOURCE_IN_USE`)?

#### 5. Phụ thuộc với thành viên khác (cần phối hợp)

- Thành viên 2: đơn khách đặt làm đầu vào cho xử lý đơn, trừ tồn.
- Thành viên 5: storefront đọc dữ liệu sản phẩm/danh mục/thương hiệu/thuộc tính bạn quản trị (cache `invalidate`).
- Thành viên 1: ảnh 360° và mô hình 3D gắn với sản phẩm.
- Thành viên 4: `StorageService` (media), `jobs/image-processing`.

---

### Thành viên 4 – Nền tảng: xác thực, nội dung & cài đặt, hạ tầng dùng chung

**Khối lượng:** 155.8 điểm (19.8%) · 10 UC · 38 endpoint · 12 trang FE · 9 bảng · 189 tệp / 13.714 dòng code.

#### 1. Module phụ trách

| Module | Tên | UC | Endpoint | Trang FE | Bảng | Dòng code | Điểm |
|---|---|---:|---:|---:|---:|---:|---:|
| M01 | Xác thực (đăng ký, đăng nhập, làm mới token, đặt lại mật khẩu, xác thực email) | 7 | 9 | 6 | 3 | 1.381 | 50.5 |
| M16 | Nội dung tĩnh & cài đặt hệ thống | 3 | 28 | 6 | 5 | 2.624 | 64.5 |
| M18 | Hạ tầng & dùng chung | 0 | 1 | 0 | 1 | 9.709 | 40.8 |

- **M01 – Xác thực (đăng ký, đăng nhập, làm mới token, đặt lại mật khẩu, xác thực email):** Đăng ký (chính sách mật khẩu hoa/thường/số, `confirmPassword`), đăng nhập (khóa/cấm tài khoản, `adminOnly`), JWT access 15 phút + refresh xoay vòng, đăng xuất, quên/đặt lại mật khẩu bằng liên kết token, xác thực email.
- **M16 – Nội dung tĩnh & cài đặt hệ thống:** Trang tĩnh/chính sách (Markdown; tạo, sửa, xóa có xác nhận; trang hệ thống không xóa được), banner, bài viết, FAQ, tin nhắn liên hệ; cài đặt cửa hàng, phương thức thanh toán, vùng vận chuyển.
- **M18 – Hạ tầng & dùng chung:** Nền tảng dùng chung: guard JWT/vai trò/quyền, giới hạn tốc độ, bộ lọc lỗi và response chuẩn, validate cấu hình môi trường, cache Redis, kho tệp (MinIO/S3/local), mail, hàng đợi BullMQ + Bull Board, nhật ký thao tác, `/health`, Prisma (schema, 16 migration, seed), `packages/shared-types`, vỏ giao diện (layout, DataTable, `request()`, mock API), Docker, CI.

#### 2. Phạm vi

##### M01 – Xác thực (đăng ký, đăng nhập, làm mới token, đặt lại mật khẩu, xác thực email)

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-AUTH-01 | Đăng ký tài khoản | Bắt buộc | ✅ Đủ |
| UC-AUTH-02 | Đăng nhập | Bắt buộc | ✅ Đủ |
| UC-AUTH-03 | Làm mới access token | Bắt buộc | ✅ Đủ |
| UC-AUTH-04 | Đăng xuất | Bắt buộc | ✅ Đủ |
| UC-AUTH-05 | Quên mật khẩu (yêu cầu đặt lại) | Bắt buộc | ✅ Đủ |
| UC-AUTH-06 | Đặt lại mật khẩu | Bắt buộc | ✅ Đủ |
| UC-AUTH-07 | Xác thực email | Nên có | ✅ Đủ |

**Bảng DB (3):** `users`, `user_sessions`, `password_resets`

**Endpoint (9):**

```
POST /auth/verify-email
POST /auth/resend-verification
POST /auth/login
POST /auth/register
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/google
```

**Trang FE (6):** `/forgot-password`, `/login`, `/register`, `/reset-password`, `/verify-email`, `/admin/login`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/auth/
- FE: apps/web/src/app/(auth)/*; apps/web/src/app/admin/login/; apps/web/src/components/account/GoogleButton.tsx; apps/web/src/hooks/useAuth.ts; apps/web/src/services/auth.api.ts; apps/web/src/store/authStore.ts
- Test: supertest: `password-policy.db-spec.ts`, `core-flows.db-spec.ts` (UC-AUTH-04, đăng ký đồng thời), `mock-m2.db-spec.ts` (quên mật khẩu, xác thực email), `permissions.db-spec.ts`, `dac-conformance.db-spec.ts` (nhóm xác thực) · Playwright: `screens.spec.ts` (quên mật khẩu, xác thực email, đăng nhập), nhóm `khach-hang` · unit web: `google-button.test.tsx`, `api-refresh.test.ts`

##### M16 – Nội dung tĩnh & cài đặt hệ thống

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-CAT-05 | Xem trang tĩnh | Nên có | 🟡 Lệch có chủ đích (đã ghi CHUAN_MO_RONG) |
| UC-ADM-03 | Quản lý cài đặt hệ thống | Nên có | ✅ Đủ |
| UC-ADM-07 | Quản lý trang tĩnh | Nên có | 🟡 Lệch có chủ đích (đã ghi CHUAN_MO_RONG) |

**Bảng DB (5):** `pages`, `settings`, `banners`, `posts`, `contact_messages`

**Endpoint (28):**

```
GET /admin/settings
PUT /admin/settings/store
PUT /admin/settings/{key}
GET /pages
GET /pages/{slug}
GET /banners
GET /posts
GET /posts/{slug}
GET /faq
POST /contact
GET /settings/public
GET /admin/pages
POST /admin/pages
PATCH /admin/pages/{id}
DELETE /admin/pages/{id}
GET /admin/banners
POST /admin/banners
PATCH /admin/banners/reorder
PATCH /admin/banners/{id}
DELETE /admin/banners/{id}
GET /admin/posts
POST /admin/posts
PATCH /admin/posts/{id}
DELETE /admin/posts/{id}
GET /admin/faq
PUT /admin/faq
GET /admin/contact-messages
PATCH /admin/contact-messages/{id}/handled
```

**Trang FE (6):** `/about`, `/contact`, `/faq`, `/policies/[slug]`, `/admin/content`, `/admin/settings`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/pages/; apps/api/src/modules/settings/
- FE: apps/web/src/app/(shop)/{about,contact,faq,policies}/; apps/web/src/app/admin/{content,settings}/; apps/web/src/services/content.api.ts; apps/web/src/config/site.ts
- Test: supertest: `mock-m3.db-spec.ts` (mục nội dung), `mock-m4.db-spec.ts` (cài đặt), `cache.db-spec.ts` (trang), `dac-conformance.db-spec.ts` (nhóm 4) · Playwright: `admin-m3.spec.ts` (nội dung), `admin-m5.spec.ts` (tạo/xóa trang tĩnh), `screens.spec.ts` (about, contact, faq, policies)

##### M18 – Hạ tầng & dùng chung

**Use case:** không có UC riêng (nền tảng dùng chung; **ghi "dùng chung"**, Thành viên 4 chịu trách nhiệm chính).

**Bảng DB (1):** `code_counters`

**Endpoint (1):**

```
GET /health
```

**Trang FE (0):** — (phần dùng chung: layout, thành phần)

**Thư mục/tệp chính:**

- BE: apps/api/src/{common,config,cache,storage,mail,health,prisma,activity-log}/; apps/api/src/{app.module,app.setup,main}.ts; apps/api/src/modules/jobs/ (lõi + Bull Board), apps/api/src/modules/ai/ (khung rỗng); apps/api/prisma/{schema.prisma,migrations/,seed*.ts}; packages/shared-types/; scripts/, infra/docker/, docker-compose.yml, .github/workflows/
- FE: apps/web/src/components/{ui,layout}/; apps/web/src/components/admin/{AdminLayout,AdminSidebar,AdminTopbar,DataTable,FilterBar,KpiCard,ChartCard,FormSection,UploadDropzone}.tsx; apps/web/src/services/{api-client,admin.api}.ts; apps/web/src/{lib,store,hooks}/ (phần dùng chung); apps/web/src/app/{layout,providers,not-found}.tsx; apps/web/src/mock-data/ (không tính điểm)
- Test: supertest/e2e hạ tầng: `infra.e2e-spec.ts`, `health.e2e-spec.ts`, `storage-jobs.e2e-spec.ts`, `activity-interceptor.db-spec.ts` · unit: `env.validation.spec.ts`, `all-exceptions.filter.spec.ts`, `permissions.guard.spec.ts`, `cache.service.spec.ts`, `minio-storage.service.spec.ts`, `vn-date.spec.ts` · Playwright: `home.spec.ts`, `hydration.spec.ts`, `admin-minio.spec.ts`; web unit: `providers.test.tsx`, `theme.test.ts`, `navigation.test.ts`, `query-refresh.test.ts`, `richtext.test.tsx`, `use-hydrated.test.tsx`, `mock-data.test.ts`

#### 3. Nhiệm vụ

- [ ] Đọc hiểu luồng end-to-end của từng UC ở trên (giao diện → `services/*.api.ts` → controller → service → Prisma → bảng DB), vẽ nhanh sơ đồ tuần tự cho 2–3 UC quan trọng nhất.
- [ ] Chạy thử trên máy (`npm run infra:up`, `npm run db:deploy`, `npm run db:seed`, `npm run dev`; hoặc `npm run demo`) và thực hiện đủ các luồng chính của phần mình ở cả vai trò khách và admin (hướng dẫn: [HUONG_DAN_DEMO.md](HUONG_DAN_DEMO.md)).
- [ ] Review code phần mình: ghi lại lỗi, điểm khó hiểu, đề xuất cải thiện (tạo issue hoặc ghi vào PR, không sửa lan sang module người khác).
- [ ] Chạy các test liên quan và xác nhận xanh (cần `aurelia_test` dựng mới: `node scripts/db-reset.mjs aurelia_test`):
  - `cd apps/api && npx jest --config test/jest-db.config.js --runInBand test/password-policy.db-spec.ts test/permissions.db-spec.ts test/cache.db-spec.ts`
  - `cd apps/api && npx jest src/config src/common src/cache src/storage  &&  npm run test:e2e:minio -w @aurelia-living/api`
  - `npm test -w @aurelia-living/web` # unit web
  - `E2E_ONLY=khach-hang npm run test:e2e:real` # và `npm run test:e2e:real:minio`
- [ ] Kiểm tra tài liệu phần mình khớp code: dòng của module trong [API_CONTRACT.md](API_CONTRACT.md) (và `api/openapi.json`), UC trong [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) và [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md), bảng trong [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); ghi chỗ lệch.
- [ ] Việc còn lại được giao từ `KNOWN_ISSUES.md` (bảng bên dưới).
- [ ] Chuẩn bị kịch bản demo 3–5 phút cho phần mình (gợi ý bên dưới), tập chạy trước một lần trên dữ liệu demo.

**Việc còn lại được giao từ [KNOWN_ISSUES.md](KNOWN_ISSUES.md)** (mức độ: S ≤ nửa ngày, M ≈ 1–2 ngày, L > 2 ngày):

| Việc | Mức | Cách làm / ghi chú |
|---|---|---|
| **Google login — ĐÃ HOÃN**: `POST /auth/google` luôn `503`; nút ẩn (D-P17). Chỉ chuẩn bị: viết test cho `POST /auth/google` (503), giữ danh sách việc ở `KNOWN_ISSUES.md` mục 3 | S | Không triển khai OAuth ở đợt này |
| **`/contact` cần BE hỗ trợ**: giờ làm việc, danh sách showroom, bản đồ chưa có chỗ lưu; hiện gom ở `apps/web/src/config/site.ts` (trống ⇒ ẩn) | M | Đề xuất mở rộng `settings.store` (hoặc trang tĩnh) rồi đọc từ `GET /settings/public`; cần nhóm quyết định trước khi đổi BE/DB |
| **docker-compose**: service `web` (profile `later`) có `depends_on: api` nhưng `api` nằm ở profile `legacy` ⇒ `docker compose --profile later config` lỗi nếu không bật cả hai | S | Sửa `docker-compose.yml` (bỏ `depends_on` hoặc đưa `api` vào profile hợp lý) rồi kiểm `docker compose config` |
| Module rỗng cần xử lý: `modules/pages/pages.service.ts`, `modules/settings/settings.controller.ts`, `modules/ai/*` (3 tệp, không ai import) | S | Đề xuất xóa hoặc giữ kèm giải thích; chỉ báo cáo trước khi xóa |
| Bull Board nhận token qua `?token=` (lọt vào nhật ký proxy) — `modules/jobs/bull-board.middleware.ts` | S | Đề xuất chỉ nhận header/cookie |
| Token đăng nhập lưu `localStorage` (rủi ro XSS) — `apps/web/src/store/authStore.ts` | L | Chỉ nghiên cứu/đề xuất cookie httpOnly; chưa làm |
| Backend có nhưng chưa có giao diện: quản trị FAQ, tin nhắn liên hệ, sắp xếp banner, trang blog công khai (`GET /posts/:slug`); ảnh `/mock-img/*` ở `admin/login/page.tsx` và `AuthLayout.tsx` | L | Ưu tiên thấp; chọn 1–2 mục nếu còn thời gian |
| Lỗi lockfile của Next (`NEXT_IGNORE_INCORRECT_LOCKFILE=1`) — xác định nguyên nhân gốc | S | Điều tra, ghi vào `KNOWN_ISSUES.md` |

**Gợi ý kịch bản demo (3–5 phút):**

1. Đăng ký (thấy chính sách mật khẩu), đăng nhập, quên mật khẩu (xem email ở Mailpit `http://localhost:8025`), xác thực email.
2. Mở `/health` (trạng thái postgres/redis/storage/smtp/queues), Swagger `/docs`, `docs/api/openapi.json`.
3. Admin sửa trang "Về chúng tôi" ở `/admin/content` ⇒ `/about` đổi theo; tạo trang tĩnh mới và xóa (hộp thoại xác nhận); đổi thông tin cửa hàng ở `/admin/settings`.
4. Trình bày `.env`/`env.validation.ts`, Docker (`infra:up`), CI, cách build production (`NEXT_PUBLIC_USE_MOCK` bị cấm).

#### 4. Câu hỏi giảng viên có thể hỏi

1. Luồng JWT: access token 15 phút, refresh token xoay vòng và lưu băm; dùng lại refresh token đã thu hồi thì điều gì xảy ra và vì sao?
2. Chuỗi guard toàn cục (`ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard`) hoạt động ra sao? Vì sao mặc định mọi route cần đăng nhập và dùng `@Public()` để mở?
3. Vì sao API kiểm tra biến môi trường lúc khởi động và từ chối cấu hình nguy hiểm ở production (`PAYMENT_SANDBOX_FAKE`, thời hạn token, Swagger, seed)?
4. Quên mật khẩu bằng liên kết token: token lưu thế nào (băm SHA-256), dùng một lần, hết hạn, và vì sao API không lộ email có tồn tại hay không?
5. Kiến trúc cache Redis: khóa nào được cache, khi nào bị xóa (`invalidate*`), Redis lỗi thì hệ thống xử lý thế nào?

#### 5. Phụ thuộc với thành viên khác (cần phối hợp)

- Mọi thành viên dùng guard, `AppException`/`FieldErrors`, `request()` của FE, `shared-types` và Prisma schema do bạn giữ.
- Thành viên 5: tài khoản cá nhân và quản trị người dùng dựa trên auth.
- Thành viên 3: nhập tệp qua `StorageService`/`jobs`; Thành viên 1: `model-processing` chạy trên hàng đợi của bạn.

---

### Thành viên 5 – Khách hàng: tài khoản, quản trị người dùng, thông báo, duyệt/tìm sản phẩm

**Khối lượng:** 147 điểm (18.7%) · 16 UC · 40 endpoint · 14 trang FE · 8 bảng · 64 tệp / 5.740 dòng code.

#### 1. Module phụ trách

| Module | Tên | UC | Endpoint | Trang FE | Bảng | Dòng code | Điểm |
|---|---|---:|---:|---:|---:|---:|---:|
| M02 | Tài khoản cá nhân (hồ sơ, đổi mật khẩu, phiên đăng nhập, sổ địa chỉ, xóa tài khoản) | 5 | 11 | 3 | 1 | 1.217 | 37.9 |
| M03 | Quản trị người dùng, phân quyền, thông báo & nhật ký | 5 | 19 | 6 | 6 | 1.976 | 59.9 |
| M04 | Storefront: trang chủ, danh mục, tìm kiếm, chi tiết sản phẩm, yêu thích | 6 | 10 | 5 | 1 | 2.547 | 49.2 |

- **M02 – Tài khoản cá nhân (hồ sơ, đổi mật khẩu, phiên đăng nhập, sổ địa chỉ, xóa tài khoản):** Hồ sơ cá nhân (họ tên 2–150, SĐT 10–11 số), đổi mật khẩu (kèm "đăng xuất thiết bị khác"), danh sách và thu hồi phiên đăng nhập, sổ địa chỉ (mặc định, khóa dòng), xóa tài khoản mềm.
- **M03 – Quản trị người dùng, phân quyền, thông báo & nhật ký:** Quản trị viên xem/khóa/mở khóa khách hàng, gán/gỡ vai trò admin (2 vai trò, 6 quyền), gửi thông báo, xem nhật ký thao tác; khách xem và đánh dấu đã đọc thông báo.
- **M04 – Storefront: trang chủ, danh mục, tìm kiếm, chi tiết sản phẩm, yêu thích:** Trang chủ (banner, danh mục, nổi bật, không gian mới), duyệt/lọc/sắp xếp/phân trang, tìm kiếm có dấu và không dấu (`foldVi`, chỉ mục trong bộ nhớ), chi tiết sản phẩm, sản phẩm liên quan, danh sách yêu thích; cache Redis cho dữ liệu công khai.

#### 2. Phạm vi

##### M02 – Tài khoản cá nhân (hồ sơ, đổi mật khẩu, phiên đăng nhập, sổ địa chỉ, xóa tài khoản)

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ACC-01 | Xem và cập nhật hồ sơ cá nhân | Nên có | ✅ Đủ |
| UC-ACC-02 | Đổi mật khẩu | Nên có | ✅ Đủ |
| UC-ACC-03 | Quản lý phiên đăng nhập (đăng xuất từ xa) | Mở rộng | ✅ Đủ |
| UC-ACC-04 | Quản lý sổ địa chỉ giao hàng | Nên có | ✅ Đủ |
| UC-ACC-07 | Yêu cầu xóa tài khoản (xóa mềm) | Mở rộng | ✅ Đủ |

**Bảng DB (1):** `addresses`

**Endpoint (11):**

```
GET /users/me
PATCH /users/me
DELETE /users/me
GET /users/me/sessions
DELETE /users/me/sessions/{id}
POST /users/me/change-password
GET /addresses
POST /addresses
PATCH /addresses/{id}/default
PATCH /addresses/{id}
DELETE /addresses/{id}
```

**Trang FE (3):** `/account/password`, `/account/profile`, `/account/sessions`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/users/; apps/api/src/modules/addresses/
- FE: apps/web/src/app/(account)/account/{profile,password,sessions}/; apps/web/src/components/account/{AddressFormModal,DeleteAccountSection}.tsx
- Test: supertest: `account.db-spec.ts` (UC-ACC-04, ACC-01), `core-flows.db-spec.ts` (UC-ACC-02), `extension.db-spec.ts` (UC-ACC-03, ACC-07), `password-policy.db-spec.ts` · Playwright: `ext-uc.spec.ts` (phiên, xóa tài khoản), nhóm `ext-uc`

##### M03 – Quản trị người dùng, phân quyền, thông báo & nhật ký

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-ADM-01 | Quản lý người dùng | Nên có | ✅ Đủ |
| UC-ADM-02 | Quản lý vai trò và phân quyền | Mở rộng | ✅ Đủ |
| UC-ADM-26 | Gửi thông báo cho người dùng | Mở rộng | ✅ Đủ |
| UC-ADM-27 | Xem nhật ký hoạt động của quản trị viên | Mở rộng | ✅ Đủ |
| UC-ACC-05 | Xem và đánh dấu đã đọc thông báo | Nên có | ✅ Đủ |

**Bảng DB (6):** `roles`, `permissions`, `role_permissions`, `user_roles`, `notifications`, `activity_logs`

**Endpoint (19):**

```
GET /admin/activity-logs
GET /admin/activity-logs/options
GET /notifications
GET /notifications/unread-count
PATCH /notifications/read-all
PATCH /notifications/{id}/read
GET /admin/users
POST /admin/users
GET /admin/users/{id}
PATCH /admin/users/{id}
PUT /admin/users/{id}/roles/admin
DELETE /admin/users/{id}/roles/admin
PATCH /admin/users/{id}/status
GET /admin/users/{id}/orders
GET /admin/users/{id}/reviews
GET /admin/users/{id}/wishlist
GET /admin/roles
POST /admin/notifications
GET /admin/notifications
```

**Trang FE (6):** `/account/notifications`, `/admin/activity-logs`, `/admin/customers/[id]`, `/admin/customers`, `/admin/notifications`, `/admin/roles`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/{admin-users,admin-roles,notifications,admin-notifications,activity-logs}/; apps/api/src/activity-log/ (dùng chung, thuộc hạ tầng)
- FE: apps/web/src/app/admin/{customers,roles,notifications,activity-logs}/; apps/web/src/app/(account)/account/notifications/
- Test: supertest: `extension.db-spec.ts` (ADM-27, ADM-02, ADM-26), `mock-m2.db-spec.ts` (mục khách hàng, phân quyền), `mock-m3.db-spec.ts` (thông báo), `activity-interceptor.db-spec.ts`, `permissions.db-spec.ts` · Playwright: `ext-uc.spec.ts` (nhật ký, vai trò, gửi thông báo), `admin-m2.spec.ts`

##### M04 – Storefront: trang chủ, danh mục, tìm kiếm, chi tiết sản phẩm, yêu thích

**Use case** (trạng thái theo [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md)):

| UC | Tên | Ưu tiên | Trạng thái |
|---|---|---|---|
| UC-CAT-01 | Xem trang chủ | Bắt buộc | ✅ Đủ |
| UC-CAT-02 | Duyệt sản phẩm theo danh mục | Bắt buộc | ✅ Đủ |
| UC-CAT-03 | Tìm kiếm sản phẩm | Bắt buộc | ✅ Đủ |
| UC-CAT-04 | Xem chi tiết sản phẩm | Bắt buộc | ✅ Đủ |
| UC-CAT-06 | Tìm kiếm sản phẩm không dấu | Nên có | ✅ Đủ |
| UC-ACC-06 | Quản lý danh sách yêu thích | Nên có | ✅ Đủ |

**Bảng DB (1):** `wishlists`

**Endpoint (10):**

```
GET /wishlist
PUT /wishlist/{slug}
DELETE /wishlist/{slug}
GET /products
GET /products/search
GET /products/facets
GET /products/{slug}
GET /products/{slug}/related
GET /categories
GET /brands
```

**Trang FE (5):** `/products/[slug]`, `/products`, `/search`, `/wishlist`, `/`

**Thư mục/tệp chính:**

- BE: apps/api/src/modules/products/{products.controller,products.service}.ts; apps/api/src/modules/{categories,brands}/ (phần công khai); apps/api/src/modules/wishlist/
- FE: apps/web/src/app/page.tsx; apps/web/src/app/(shop)/{products,search,wishlist}/; apps/web/src/components/product/ (trừ SpaceCard); apps/web/src/hooks/useProducts.ts; apps/web/src/services/product.api.ts; apps/web/src/lib/{variant,recent}.ts
- Test: supertest: `catalog-search.db-spec.ts` (UC-CAT-02/03/06), `core-flows.db-spec.ts` (UC-CAT-01), `account.db-spec.ts` (UC-ACC-06), `cache.db-spec.ts` · Playwright: `screens.spec.ts` (storefront công khai), `hydration.spec.ts`, nhóm `khach-hang` · unit: `catalog-cache.spec.ts`

#### 3. Nhiệm vụ

- [ ] Đọc hiểu luồng end-to-end của từng UC ở trên (giao diện → `services/*.api.ts` → controller → service → Prisma → bảng DB), vẽ nhanh sơ đồ tuần tự cho 2–3 UC quan trọng nhất.
- [ ] Chạy thử trên máy (`npm run infra:up`, `npm run db:deploy`, `npm run db:seed`, `npm run dev`; hoặc `npm run demo`) và thực hiện đủ các luồng chính của phần mình ở cả vai trò khách và admin (hướng dẫn: [HUONG_DAN_DEMO.md](HUONG_DAN_DEMO.md)).
- [ ] Review code phần mình: ghi lại lỗi, điểm khó hiểu, đề xuất cải thiện (tạo issue hoặc ghi vào PR, không sửa lan sang module người khác).
- [ ] Chạy các test liên quan và xác nhận xanh (cần `aurelia_test` dựng mới: `node scripts/db-reset.mjs aurelia_test`):
  - `cd apps/api && npx jest --config test/jest-db.config.js --runInBand test/account.db-spec.ts test/extension.db-spec.ts test/catalog-search.db-spec.ts test/activity-interceptor.db-spec.ts`
  - `cd apps/api && npx jest src/cache`
  - `cd apps/web && npx vitest run tests/unit/saved-spaces.test.tsx`
  - `E2E_ONLY=ext-uc npm run test:e2e:real` # rồi `khach-hang`
- [ ] Kiểm tra tài liệu phần mình khớp code: dòng của module trong [API_CONTRACT.md](API_CONTRACT.md) (và `api/openapi.json`), UC trong [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) và [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md), bảng trong [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md); ghi chỗ lệch.
- [ ] Việc còn lại được giao từ `KNOWN_ISSUES.md` (bảng bên dưới).
- [ ] Chuẩn bị kịch bản demo 3–5 phút cho phần mình (gợi ý bên dưới), tập chạy trước một lần trên dữ liệu demo.

**Việc còn lại được giao từ [KNOWN_ISSUES.md](KNOWN_ISSUES.md)** (mức độ: S ≤ nửa ngày, M ≈ 1–2 ngày, L > 2 ngày):

| Việc | Mức | Cách làm / ghi chú |
|---|---|---|
| Endpoint chưa có test tham chiếu: `GET /products/:slug/related`, `GET /admin/users/:id/orders`, `/reviews`, `/wishlist` | M | Viết supertest (`catalog-search.db-spec.ts` và `extension.db-spec.ts` mở rộng) |
| Nội dung viết cứng/giả ở chế độ thật: `apps/web/src/app/(shop)/policies/[slug]/page.tsx:20-31` (khối "7 ngày / Miễn phí / 3–5 ngày", "Hotline 0123 456 789"); ảnh `/mock-img/*` ở `not-found.tsx:65`, `app/page.tsx:190`, `ProductListing.tsx:106`, `account/profile/page.tsx:124` | M | Thay bằng dữ liệu thật/trung tính; báo cáo trước nếu cần đổi BE |
| `apps/web/src/mock-data` còn khoảng 14 chỗ nhắc "AR" (ví dụ `metaDescription` "xem 3D/AR trước khi mua") | S | Sửa chữ cho khớp (AR đã loại bỏ) |
| Rà `useCategories()` ngoài `Suspense` ở `/` (đã nêu ở `KNOWN_ISSUES.md` mục 1: hydrate cùng lượt với Header, chưa đo) | S | Đo hydration ở CPU 4× bằng `visit` và ghi kết quả |

**Gợi ý kịch bản demo (3–5 phút):**

1. Khách: trang chủ ⇒ duyệt danh mục, lọc, sắp xếp, tìm kiếm không dấu ("sofa", "sô pha").
2. Chi tiết sản phẩm, thêm yêu thích (`/wishlist`), hồ sơ và sổ địa chỉ (`/account/profile`), phiên đăng nhập, đổi mật khẩu, thông báo.
3. Admin: `/admin/customers` khóa/mở khóa khách, gán/gỡ admin, gửi thông báo, xem nhật ký hoạt động.
4. Xóa tài khoản (mật khẩu, chặn khi còn đơn đang xử lý).

#### 4. Câu hỏi giảng viên có thể hỏi

1. Vì sao `users.email` không có `@unique` mà dùng partial unique index trên bản ghi chưa xóa mềm? Xóa tài khoản mềm xử lý đơn đang giao ra sao?
2. Phân quyền gồm những lớp nào (vai trò `admin`/`user`, 6 quyền, kiểm tra sở hữu)? Khách xem đơn của người khác nhận mã gì và vì sao (404)?
3. Tìm kiếm không dấu hiện thực thế nào (`foldVi`, chỉ mục trong bộ nhớ) so với `pg_trgm`/`unaccent` ở DB? Ưu và nhược điểm khi dữ liệu lớn?
4. Sổ địa chỉ đảm bảo "đúng một địa chỉ mặc định" thế nào khi hai yêu cầu đồng thời (khóa dòng user)?
5. Hệ thống ghi nhật ký thao tác admin bằng interceptor và bằng service khác nhau ra sao (dòng "Tự động")?

#### 5. Phụ thuộc với thành viên khác (cần phối hợp)

- Thành viên 4: xác thực (token, phiên), guard, cache, `request()` của FE.
- Thành viên 3: dữ liệu sản phẩm/danh mục do admin quản trị.
- Thành viên 2: đơn hàng/giỏ/đánh giá hiển thị trong tài khoản và chi tiết sản phẩm.
- Thành viên 1: không gian mẫu/3D xuất hiện trong chi tiết sản phẩm và trang chủ.

---

## Phần 3. Việc chung của cả nhóm

### Quy trình làm việc

- Nhánh `main` đã được bảo vệ: **không push thẳng**. Tạo nhánh theo mẫu `<loại>/<mô-tả-ngắn-kebab-case>` (`feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`), mọi thay đổi đi qua Pull Request.
- Mỗi PR cần **ít nhất 1 người approve** trước khi merge; PR nhỏ, một mục đích; mô tả nêu thay đổi API/DB/biến môi trường và cách kiểm thử. Quy ước commit: Conventional Commits (hook `commitlint`: tiêu đề ≤ 100 ký tự, mỗi dòng thân ≤ 100 ký tự; loại hợp lệ `feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert`). Chi tiết: [../CONTRIBUTING.md](../CONTRIBUTING.md).
- Trước khi mở PR: `npm run lint && npm run typecheck && npm test` và các test liên quan phần mình; đổi schema thì có migration và chạy `npm run types:generate`; đổi hành vi thì cập nhật tài liệu.
- Không bao giờ chạy `prisma migrate dev/reset` hay `db push` lên DB có dữ liệu thật (`aurelia_dev`); DB test là `aurelia_test`, DB demo là `aurelia_demo` (`node scripts/db-reset.mjs <tên>`).

### Review chéo (vòng tròn)

| Người viết | Người review |
|---|---|
| Thành viên 1 | Thành viên 2 |
| Thành viên 2 | Thành viên 3 |
| Thành viên 3 | Thành viên 4 |
| Thành viên 4 | Thành viên 5 |
| Thành viên 5 | Thành viên 1 |

Người review ưu tiên xem: tính đúng của nghiệp vụ so với DAC_TA, xử lý lỗi và mã trạng thái, transaction/khóa khi ghi, phân quyền, test kèm theo, tài liệu cập nhật.

### Thứ tự demo đề xuất khi bảo vệ (theo hành trình người dùng)

| Bước | Nội dung | Người trình bày |
|---|---|---|
| 1 | Giới thiệu kiến trúc, hạ tầng (`/health`, Swagger, Docker), đăng ký/đăng nhập/quên mật khẩu | Thành viên 4 |
| 2 | Trang chủ, duyệt/tìm kiếm không dấu, chi tiết sản phẩm, yêu thích, hồ sơ và địa chỉ | Thành viên 5 |
| 3 | Xem 3D, đổi màu vật liệu, xoay 360°, không gian mẫu 360° (hotspot, đổi món) | Thành viên 1 |
| 4 | Giỏ hàng, mã giảm giá, đặt hàng, thanh toán (COD/VNPAY giả lập), đánh giá | Thành viên 2 |
| 5 | Admin: sản phẩm, kho, xử lý đơn, vận chuyển, đổi trả, hoàn tiền | Thành viên 3 |
| 6 | Admin: quản trị người dùng, nội dung/cài đặt, thống kê, thu chi, phễu không gian | Thành viên 5, 4, 1 |

### Việc chung còn lại

- Mỗi người đọc phần Phụ thuộc của mình và hẹn 15 phút với người liên quan để thống nhất dữ liệu demo (cùng dùng DB `aurelia_demo`).
- Cả nhóm thống nhất bộ tài khoản demo và thứ tự trình bày; quay lại `docs/HUONG_DAN_DEMO.md` để chỉnh nếu lệch.
- Quyết định chung cần chốt: xóa hay giữ module rỗng (`hotspots`, `product-images`, `variants`, `pages.service`, `settings.controller`, `ai/*`), và có mở rộng BE cho `/contact` hay không.

## Phần 4. Phụ lục

### 4.1. Danh sách đầy đủ 18 module và điểm khối lượng

| Module | Tên | Phụ trách | UC | Endpoint | Trang FE | Bảng | Tệp | Dòng code | Điểm |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| M01 | Xác thực (đăng ký, đăng nhập, làm mới token, đặt lại mật khẩu, xác thực email) | Thành viên 4 | 7 | 9 | 6 | 3 | 14 | 1.381 | 50.5 |
| M02 | Tài khoản cá nhân (hồ sơ, đổi mật khẩu, phiên đăng nhập, sổ địa chỉ, xóa tài khoản) | Thành viên 5 | 5 | 11 | 3 | 1 | 12 | 1.217 | 37.9 |
| M03 | Quản trị người dùng, phân quyền, thông báo & nhật ký | Thành viên 5 | 5 | 19 | 6 | 6 | 21 | 1.976 | 59.9 |
| M04 | Storefront: trang chủ, danh mục, tìm kiếm, chi tiết sản phẩm, yêu thích | Thành viên 5 | 6 | 10 | 5 | 1 | 31 | 2.547 | 49.2 |
| M05 | Quản trị danh mục, thương hiệu, thuộc tính | Thành viên 3 | 3 | 16 | 3 | 4 | 9 | 1.571 | 41.3 |
| M06 | Quản trị sản phẩm, biến thể, ảnh sản phẩm, thư viện media | Thành viên 3 | 4 | 12 | 4 | 6 | 21 | 2.645 | 48.6 |
| M07 | Kho hàng | Thành viên 3 | 1 | 9 | 1 | 3 | 4 | 1.090 | 21.4 |
| M08 | Đánh giá & hỏi đáp | Thành viên 2 | 4 | 11 | 3 | 3 | 13 | 1.378 | 37.5 |
| M09 | Mô hình 3D & xem 360° sản phẩm | Thành viên 1 | 4 | 18 | 3 | 5 | 24 | 4.054 | 57.2 |
| M10 | Không gian mẫu 360° phía khách (duyệt, xem, hotspot, lưu, đổi món) | Thành viên 1 | 6 | 8 | 3 | 2 | 12 | 1.990 | 42 |
| M11 | Quản trị không gian mẫu, ảnh 360°, hotspot, đặt mô hình 3D, phễu | Thành viên 1 | 4 | 10 | 4 | 4 | 15 | 2.183 | 42.7 |
| M12 | Giỏ hàng & mã giảm giá | Thành viên 2 | 5 | 15 | 5 | 6 | 18 | 2.074 | 54.3 |
| M13 | Đặt hàng và theo dõi đơn của khách (gồm yêu cầu đổi trả) | Thành viên 2 | 3 | 7 | 5 | 3 | 14 | 2.292 | 38.2 |
| M14 | Xử lý đơn quản trị: trạng thái, hủy, hoàn tiền, vận chuyển, duyệt đổi trả | Thành viên 3 | 5 | 13 | 3 | 4 | 10 | 2.309 | 47.2 |
| M15 | Thanh toán (online, IPN, thanh toán lại, đối soát chuyển khoản) | Thành viên 2 | 4 | 7 | 3 | 1 | 8 | 972 | 29.9 |
| M16 | Nội dung tĩnh & cài đặt hệ thống | Thành viên 4 | 3 | 28 | 6 | 5 | 19 | 2.624 | 64.5 |
| M17 | Thống kê & thu chi | Thành viên 1 | 1 | 6 | 3 | 1 | 10 | 1.726 | 22.9 |
| M18 | Hạ tầng & dùng chung | Thành viên 4 | 0 | 1 | 0 | 1 | 156 | 9.709 | 40.8 |
| | **Tổng** | | 70 | 210 | 66 | 59 | 411 | 43.738 | 786 |

### 4.2. Bảng các phần chưa gán được hoặc còn mơ hồ

| Phần | Lý do | Đề xuất |
|---|---|---|
| `mock-data` (dữ liệu giả của FE) | Không tính điểm; là mã dev, cũng là nguồn seed (`SEED_SOURCE=mock`). Người sửa nội dung cho module nào thì tự cập nhật phần của module đó | Thành viên 4 giữ (hạ tầng); mỗi người chỉnh dữ liệu mẫu thuộc module mình |
| `apps/api/src/modules/products/admin-products.controller.ts` chứa cả endpoint ảnh 360° (`GET/PUT /admin/products/:id/360`) | Một tệp nhưng hai module (M06 sản phẩm, M09 3D/360°) | Endpoint tính cho M09 (Thành viên 1), tệp/dòng code thuộc M06 (Thành viên 3); hai người phối hợp khi sửa |
| `admin.api.ts`, `api-client.ts`, `ui/*`, `layout/*`, DataTable, hooks/lib chung | Dùng chung mọi module | Thuộc M18 (Thành viên 4); các tệp này đã tính vào dòng code của M18 |
| Tệp test dùng chung (`mock-m2..m5.db-spec.ts`, `dac-conformance.db-spec.ts`, `screens.spec.ts`) | Một tệp phủ nhiều module | Mỗi module liệt kê mục `describe` liên quan trong "Test"; ai sửa phần nào thì sửa mục đó |
| `GET /health` | Không thuộc UC | M18 (Thành viên 4) |
| Số dòng code chỉ là thước đo gần đúng | Đếm dòng khác rỗng, gồm cả chú thích | **Cần xác minh** nếu cần số chính xác (chưa loại chú thích) |
| Ứng dụng Android `apps/mobile` | Khung rỗng, ngoài phạm vi (D-P09), 4 UC MOB không tính | Không giao |

### 4.3. Xác nhận phân công

**Đã gán 70/70 UC, 210/210 endpoint, 59/59 bảng, 66/66 trang FE** (mỗi mục thuộc đúng một thành viên; kiểm tra tự động: không trùng, không sót).
