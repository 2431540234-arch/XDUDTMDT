# Đối chiếu công nghệ

Ngày kiểm tra: 2026-10-08, commit `57deef2`. Kiểm tra chỉ đọc: không cài, không sửa code. Phiên bản "thực cài" lấy từ `node_modules` (`package.json` của từng gói) và `npm ls`; hạ tầng lấy từ `docker compose ps` và `GET /health`.

Ký hiệu: ✅ có, đã cấu hình, đang dùng đúng vai trò · 🟡 đã cài/khai báo nhưng chưa cấu hình hoặc chưa dùng · ❌ thiếu · ⚠️ dùng khác vai trò mục tiêu hoặc mâu thuẫn tài liệu · ➖ không áp dụng ở môi trường hiện tại.

> **Cập nhật 2026-10-08:** chủ dự án đã trả lời 8 câu ở mục 8 (xem bảng "Đã trả lời" ở đó). Mục 6 là bảng nộp chính thức. Các mục 2-5 phản ánh hiện trạng lúc kiểm tra.

## 1. Tóm tắt

| Trạng thái | Số công nghệ | Công nghệ |
| --- | --- | --- |
| ✅ | 7 | Next.js, TypeScript, Tailwind CSS, PostgreSQL, Prisma, BullMQ, MinIO |
| 🟡 | 9 | Zustand, TanStack Query, Three.js, React Three Fiber (Web); Android, Kotlin, Jetpack Compose, CameraX, Overlay (Mobile) |
| ⚠️ | 1 | Redis (đang dùng cho queue và giới hạn tốc độ; chưa dùng cho cache, OTP, session) |
| ➖ | 1 | S3 (production) |
| ❌ | 0 | (nhưng thiếu nhiều thư viện phụ trợ, xem mục 4) |

Năm vấn đề lớn nhất:

1. **Mobile mâu thuẫn tài liệu.** Danh sách mục tiêu có Android/Kotlin/Compose/CameraX/Overlay, nhưng `docs/DECISIONS.md` D-P03, `DAC_TA…` mục 12.1 #19 và mục 13 xếp `apps/mobile` NGOÀI phạm vi, không có UC nào. Trong repo có khung Android 90 dòng code thật (xem mục 2.2). Phải quyết định đưa vào hay bỏ ra khỏi bảng công nghệ nộp.
2. **Phần web "xịn" gần như chưa dùng.** Zustand, TanStack Query, Three.js, R3F, drei đã khai báo và đã cài nhưng 0 import thật; `QueryClientProvider` chưa gắn vào layout; 4 store là `create(() => ({}))` rỗng; chưa có `<Canvas>`.
3. **Thiếu thư viện cho UC 3D/AR/360° trên web.** Chưa có `@google/model-viewer` (hoặc WebXR) cho AR trên điện thoại, chưa có thư viện ảnh 360°. Tài liệu UC-3D-02 nhắc "WebXR/Scene Viewer/Quick Look" nhưng gói không có trong `package.json`.
4. **Redis "cache, OTP, session" chưa khớp thiết kế.** Hiện Redis chỉ làm BullMQ và bộ đếm throttler. Phiên đăng nhập nằm ở PostgreSQL (`user_sessions`), đặt lại mật khẩu ở `password_resets`, xác thực email bằng JWT. Không có chỗ nào cache.
5. **BullMQ chưa phục vụ "email, notification".** Chỉ có 2 queue xử lý media (`model-processing`, `image-processing`). `MailService` gửi trực tiếp và hiện chưa được module nào gọi.

## 2. Bảng đối chiếu

### 2.1. Web

| Công nghệ | Vai trò mục tiêu | Trạng thái | Gói & phiên bản (khai báo → thực cài) | Nơi cấu hình | Nơi sử dụng (file:dòng) | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| Next.js | Framework xây website | ✅ | `next` ^14.2.0 → 14.2.35; `react` ^18.3.0 → 18.3.1 | `apps/web/next.config.js:1-20` (nạp `.env` gốc, kiểm tra `NEXT_PUBLIC_API_URL`), `apps/web/src/app/layout.tsx:1-14` | `apps/web/src/app/**` (13 route); `npm run build` qua | Dùng App Router. Hầu hết trang chỉ `return null`; chỉ `page.tsx:5-7` có nội dung |
| TypeScript | Ngôn ngữ lập trình | ✅ | `typescript` ^5.4.0 → 5.9.3 (gốc, `apps/api`, `apps/web`) | `apps/web/tsconfig.json`, `apps/api/tsconfig.json`, `packages/shared-types/tsconfig.json` | Toàn bộ web/api/shared-types; `npm run typecheck` qua 4/4 | Mobile dùng Kotlin, không tính vào đây |
| Tailwind CSS | Thiết kế giao diện | ✅ | `tailwindcss` ^3.4.0 → 3.4.19; `postcss` 8.5.28; `autoprefixer` 10.6.1 | `apps/web/tailwind.config.ts`, `apps/web/postcss.config.js`, `apps/web/src/styles/globals.css:1-3` | Mới 1 chỗ: `apps/web/src/app/page.tsx:5-7` | Đã kiểm tra class `text-amber-700` sinh ra CSS. `src/styles/theme.ts` (màu `#8B5E3C`) chưa nối vào `tailwind.config.ts` |
| Zustand | Quản lý client state | 🟡 | `zustand` ^4.5.0 → 4.5.7 (web); cây phụ thuộc còn 3.7.2 và 5.0.15 do thư viện khác kéo vào | `apps/web/src/store/{auth,cart,ui,viewer}Store.ts` | `store/cartStore.ts:3-5` và 3 file còn lại: `create(() => ({}))` rỗng | Chưa có state thật, chưa component nào dùng |
| TanStack Query | Gọi/cache API | 🟡 | `@tanstack/react-query` ^5.40.0 → 5.103.1 | `apps/web/src/lib/query-client.ts:3-5` (`new QueryClient()`) | Không có `QueryClientProvider` trong `layout.tsx`; `hooks/*.ts` chỉ `export {}` | Chưa gọi API nào; `services/api-client.ts` mới chứa `baseURL` |
| Three.js | Xử lý 3D | 🟡 | `three` ^0.165.0 → 0.165.0; `@types/three` ^0.165.0 | `apps/web/src/lib/three-helpers.ts` (khung rỗng) | 0 import `three` trong `apps/web/src` | Có thêm `three@0.170.0` trong cây phụ thuộc (do thư viện khác) |
| React Three Fiber | Kết nối React với Three.js | 🟡 | `@react-three/fiber` ^8.16.0 → 8.18.0; `@react-three/drei` ^9.105.0 → 9.122.0 | `apps/web/src/components/viewer/*.tsx` (khung rỗng) | 0 `<Canvas>`, 0 import | R3F 8 đúng cặp với React 18. Cần nâng cả bộ khi lên React 19 |

### 2.2. Mobile (`apps/mobile`)

Hiện trạng: dự án Android Gradle có `settings.gradle.kts`, `build.gradle.kts`, `app/build.gradle.kts`, `gradle/libs.versions.toml`, wrapper Gradle 9.4.1, `AndroidManifest.xml`; **41 file Kotlin, tổng 90 dòng, chỉ `MainActivity.kt` (13 dòng, `setContent {}` rỗng) và `AureliaApplication.kt` (5 dòng, `@HiltAndroidApp`) có mã; 39 file còn lại chỉ có dòng chú thích hoặc khai báo `package`**. Chỉ có 1 commit ("Initial commit: scaffold"). Máy có Android SDK (`ANDROID_HOME` có `platforms/android-37.0`, JDK 17) nhưng **chưa build** vì build sẽ tải Gradle 9.4.1 và toàn bộ phụ thuộc (tương đương cài mới); cấu trúc Gradle được kiểm tra bằng đọc file.

| Công nghệ | Vai trò mục tiêu | Trạng thái | Gói & phiên bản | Nơi cấu hình | Nơi sử dụng (file:dòng) | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| Android | Nền tảng app | 🟡 ⚠️ | AGP 9.2.1; `compileSdk` 37, `targetSdk` 36, `minSdk` 26 | `apps/mobile/app/build.gradle.kts:10-20`, `AndroidManifest.xml` (quyền `CAMERA`, `INTERNET`, `uses-feature camera`) | `MainActivity.kt:8-13` (rỗng) | Cấu trúc hợp lệ, chưa build. **Ngoài phạm vi theo tài liệu** |
| Kotlin | Ngôn ngữ lập trình | 🟡 ⚠️ | Kotlin 2.2.10 (`libs.versions.toml`), KSP 2.2.10-2.0.2; Java 11 | `gradle/libs.versions.toml:9`, `app/build.gradle.kts:28-30` | 41 file `.kt`, 90 dòng | `android.builtInKotlin=false`, `android.newDsl=false` trong `gradle.properties` |
| Jetpack Compose | Xây giao diện | 🟡 ⚠️ | Compose BOM 2026.02.01, Material3, activity-compose 1.13.0 | `app/build.gradle.kts` (`buildFeatures.compose`), plugin `kotlin.compose` | `MainActivity.kt:11` (`setContent {}` rỗng); `ui/theme/*.kt` rỗng | Thiếu `navigation-compose` dù có `AureliaNavGraph.kt` |
| CameraX | Xử lý camera | 🟡 ⚠️ | camera-core/camera2/lifecycle/view 1.3.4 | `app/build.gradle.kts` (4 gói CameraX), quyền `CAMERA` trong manifest | `ui/camera/CameraScreen.kt` (chỉ comment) | CameraX 1.3.4 khá cũ (có bản 1.5.x), chưa nâng |
| Overlay | Đặt ảnh sản phẩm lên camera | 🟡 ⚠️ | Không có gói riêng (dự kiến Compose `Canvas` + Coil 2.6.0) | `ui/camera/OverlayCanvas.kt`, `OverlayGestureHandler.kt` (khung rỗng) | Không có | Cần ảnh PNG nền trong suốt của sản phẩm; hiện không có bước tách nền (xem mục 3.1) |

Khác: Hilt 2.51.1 (+ `hilt-navigation-compose` 1.2.0), Retrofit 2.11.0 + Gson, Coil 2.6.0 đã khai báo. Hilt 2.51.1 khá cũ so với AGP 9.2.1 và Kotlin 2.2.10, **có khả năng cần nâng hoặc chỉnh cấu hình khi build lần đầu (chưa xác minh)**.

### 2.3. Backend và hạ tầng

| Công nghệ | Vai trò mục tiêu | Trạng thái | Gói & phiên bản (khai báo → thực cài) | Nơi cấu hình | Nơi sử dụng (file:dòng) | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL | Database chính | ✅ | `postgres:16-alpine` (container healthy, DB dev `aurelia_dev`, DB test `aurelia_test`) | `docker-compose.yml` (`postgres`, `postgres-test`), `DATABASE_URL` trong `env.validation.ts:15`, `.env.example` | 44 bảng, 36 trigger; `prisma migrate status`: up to date | 2 migration (`0_init`, `20261006134647_media_file_size_int`) |
| Prisma | Làm việc với PostgreSQL | ✅ | `@prisma/client` ^5.14.0 → 5.22.0; `prisma` 5.22.0 | `apps/api/prisma/schema.prisma`, `apps/api/src/prisma/prisma.service.ts:1-12` | `media.service.ts:59,108`, `model-processing.service.ts:31,38,45`, `activity-log.service.ts`, `prisma/seed.ts` | Chưa có query nghiệp vụ Product/Order (module còn khung rỗng) |
| Redis | Cache, dữ liệu tạm, queue state | ⚠️ | `redis:7-alpine` (healthy, cổng host 6380); `ioredis` ^5.11.1 → 5.11.1 | `docker-compose.yml` (`redis`), `env.validation.ts:22-23`, `.env.example` | Queue: `jobs.module.ts:26-36`; throttler: `app.module.ts:27-39`; `/health` | Chỉ làm queue và giới hạn tốc độ. KHÔNG cache, KHÔNG OTP/session (mục 3.2, 3.3) |
| BullMQ | Hàng đợi nền | ✅ (một phần) | `bullmq` ^5.7.0 → 5.81.5; `@nestjs/bullmq` 10.2.3; `@bull-board/*` 9.10.4 | `jobs.module.ts:26,38-47` (Redis, 2 queue, Bull Board `/admin/queues`) | Processor: `model-processing.processor.ts:11`, `image-processing.processor.ts:6`; đẩy job: `media.service.ts:69,118`, `product-models.service.ts:75` | Đúng vai trò cho xử lý nền (LOD, webp). Chưa có queue email/notification (mục 3.4) |
| MinIO | Lưu file (dev) | ✅ | `bitnamilegacy/minio:2025.4.22-debian-12-r2` (healthy; Console 9001 trả 200); `@aws-sdk/client-s3` ^3.1147.0 + `@aws-sdk/s3-request-presigner` | `docker-compose.yml` (`minio`, `minio-init`), `env.validation.ts:25-40`, `.env.example` | `minio-storage.service.ts:49-56,107,128`; e2e `storage-jobs.e2e-spec.ts` | 2 bucket public/private, presigned PUT/GET. Ảnh chính thức `minio/minio` đã bị gỡ (DECISIONS D-T23) |
| S3 | Object storage production | ➖ | Cùng SDK `@aws-sdk/client-s3` | Chưa có cấu hình production | Không | Chuyển sang S3 cần sửa nhỏ, không chỉ đổi biến môi trường (mục 3.5) |

## 3. Mâu thuẫn với tài liệu và quyết định

### 3.1. Mobile

- **Mâu thuẫn:** mục tiêu có đủ 5 công nghệ Android; tài liệu xếp `apps/mobile` ngoài phạm vi: `docs/DECISIONS.md` D-P03, `DAC_TA_CHUC_NANG_THEO_VAI_TRO.md` mục 12.1 #19 và mục 13 ("Ứng dụng Android… Hướng phát triển"), `BAO_CAO_PHAN_TICH_THIET_KE.md` cây thư mục ("Android (Kotlin), ngoài phạm vi"). Không có UC mobile nào trong 76 UC; module `ar-overlay` ở backend cũng là khung rỗng ngoài phạm vi.
- **Hiện trạng:** khung Android có kiến trúc lớp (data/remote, domain, ui, di) nhưng gần như không có mã (xem 2.2).

Phương án:

| Phương án | Nội dung | Ưu | Nhược |
| --- | --- | --- | --- |
| A. Giữ ngoài phạm vi | Bỏ mobile khỏi bảng nộp, ghi vào "Hướng phát triển" | Không tốn công; khớp tài liệu | Mất điểm nhấn "camera overlay" nếu giảng viên yêu cầu |
| B. Đưa vào tối thiểu | Danh mục, chi tiết sản phẩm, màn hình camera + overlay ảnh sản phẩm (kéo, xoay, đổi kích thước), chụp ảnh lưu máy | Giữ được CameraX + Overlay; ít phụ thuộc backend | Cần chỉnh tài liệu (thêm 3-4 UC mobile) và ảnh PNG nền trong suốt |
| C. Đưa vào đầy đủ | B + đăng nhập, giỏ hàng, đặt hàng, thông báo | Đủ chức năng | Tốn nhiều, phụ thuộc M02, M08, M09 xong trước |

Ước lượng (giờ) nếu đưa vào phạm vi, dùng chung API với web (M02 đăng nhập, M06/M07 danh mục và sản phẩm, M08 giỏ, M09 đơn):

| Việc | B | C |
| --- | --- | --- |
| Dọn Gradle, nâng Hilt/AGP, build được lần đầu, thêm `navigation-compose`, coroutines, OkHttp | 10 | 10 |
| Lớp mạng (Retrofit, parse response `{success,data,meta}`, xử lý lỗi theo `ErrorCode`), DI | 8 | 8 |
| Danh mục + chi tiết sản phẩm (2-3 màn hình) | 16 | 16 |
| Màn hình camera: CameraX preview, xin quyền, overlay ảnh sản phẩm, cử chỉ kéo/xoay/phóng, chụp ảnh ghép | 24 | 24 |
| Đăng nhập + lưu token (DataStore), làm mới token | 0 | 12 |
| Giỏ hàng + đặt hàng + đơn của tôi | 0 | 28 |
| Test (unit ViewModel, UI cơ bản) và tài liệu/UC mobile | 12 | 20 |
| **Tổng ước lượng** | **~70** | **~118** |

Màn hình khoảng 5 (B) hoặc 10 (C). Điều kiện cần: API sản phẩm (M07) xong; ảnh PNG nền trong suốt cho sản phẩm (hiện đã bỏ bước tách nền `remove-background` khỏi queue, xem DECISIONS D-T21; tự chuẩn bị tay hoặc khôi phục bước này).

### 3.2. Redis "OTP, session"

- **Thiết kế hiện hành:** phiên đăng nhập lưu băm refresh token trong PostgreSQL `user_sessions` (D-T06); đặt lại mật khẩu dùng bảng `password_resets` (`tokenHash`, hạn, `usedAt`); xác thực email dùng JWT mục đích `verify_email`, không bảng (D-N09). Không có OTP.
- **Mâu thuẫn:** mục tiêu mô tả Redis cho OTP/session.

| Phương án | Nội dung | Ưu | Nhược | Ảnh hưởng CSDL / tài liệu |
| --- | --- | --- | --- | --- |
| A. Giữ PostgreSQL (khuyến nghị) | Như hiện tại; Redis chỉ queue + throttler (+ cache ở mục 3.3) | Bền vững, truy vấn "danh sách thiết bị", đăng xuất từ xa (UC-ACC-03) dễ, khớp 44 bảng và tài liệu, có audit | Mỗi lần refresh ghi DB | Không đổi. Chỉ ghi chú vai trò Redis trong bảng nộp |
| B. Chuyển sang Redis | Session và token đặt lại lưu Redis với TTL; có thể thêm OTP email 6 số | TTL tự hết hạn, nhanh, có sẵn OTP | Mất dữ liệu nếu Redis xóa (cần AOF, đã bật `appendonly`); phải bỏ/giữ lại `user_sessions`, `password_resets`; sửa UC-AUTH-03/04/05/06, UC-ACC-03, sơ đồ; tên bảng trong CSDL thành thừa | Cần migration bỏ 2 bảng (hoặc giữ nhưng không dùng) và cập nhật 8+ tài liệu, ~10 giờ |
| C. Kết hợp | PG lưu phiên; Redis lưu OTP/đếm số lần thử/khóa tạm | OTP và chống brute-force đúng chỗ | Thêm phức tạp | Không đổi bảng; thêm UC nhỏ (OTP) |

### 3.3. Redis "cache"

Hiện **không có đoạn cache nào** (grep `cache|setex|ttl` trong `apps/api/src` không có kết quả; Redis chỉ có ở `jobs.module.ts`, `app.module.ts`, `health.controller.ts`). Đề xuất cache (dùng chính `ioredis` đã có, một `CacheService` nhỏ, xóa khóa khi admin sửa dữ liệu):

| Dữ liệu | Endpoint | TTL gợi ý | Xóa khi |
| --- | --- | --- | --- |
| Cây danh mục | `GET /api/categories` (UC-CAT-02) | 10 phút | admin sửa danh mục (UC-ADM-05) |
| Sản phẩm nổi bật, trang chủ | `GET /api/products?featured=true` (UC-CAT-01) | 2 phút | admin sửa sản phẩm (UC-ADM-09) |
| Settings công khai | `GET /api/settings` (UC-ADM-03) | 10 phút | admin sửa settings |
| Trang tĩnh | `GET /api/pages/:slug` (UC-CAT-05) | 10 phút | admin sửa trang (UC-ADM-07) |
| Chi tiết sản phẩm công khai | `GET /api/products/:slug` | 1 phút | sửa sản phẩm, đánh giá mới |

Không cache dữ liệu theo người dùng (giỏ, đơn).

### 3.4. BullMQ "email, notification"

- Email: `SmtpMailService` gửi **đồng bộ, trực tiếp** (`apps/api/src/mail/smtp-mail.service.ts`), lỗi chỉ ghi log. `MAIL_SERVICE` được đăng ký nhưng **chưa có module nào gọi** (grep không thấy lời gọi ngoài chính module `mail`).
- Thông báo: bảng `notifications` có; theo D-N19 do Service tạo, không dùng queue.
- Queue đã đăng ký: chỉ `model-processing` và `image-processing` (`jobs.module.ts:38-41`). D-T25 ghi rõ email gửi trực tiếp, hàng đợi `mail` là "hướng phát triển".
- Đề xuất nếu muốn khớp mục tiêu: thêm queue `mail` (retry 3 lần, backoff mũ) và `notification`; `MailService.send` đẩy job thay vì gửi trực tiếp; giữ interface không đổi. Khoảng 6 giờ, nên làm cùng M02 (UC-AUTH-01/05).

### 3.5. MinIO và S3

- Code dùng **`@aws-sdk/client-s3`** và **`@aws-sdk/s3-request-presigner`** (không dùng gói `minio`): `apps/api/src/storage/minio-storage.service.ts:1-9,49-56`. SDK này nói chuyện được với S3 thật.
- Chuyển sang S3 production **không chỉ đổi biến môi trường**, cần:
  1. Đổi biến: `S3_ENDPOINT` (bỏ hoặc dùng endpoint vùng), `S3_REGION`, khóa truy cập, tên bucket, `STORAGE_PUBLIC_URL` (URL bucket hoặc CloudFront), `S3_PUBLIC_ENDPOINT` bỏ.
  2. Sửa code nhỏ (~2 giờ): `forcePathStyle: true` đang viết cứng (`minio-storage.service.ts:52`), nên đọc từ biến `S3_FORCE_PATH_STYLE`; `S3_ENDPOINT` đang bắt buộc khi `STORAGE_DRIVER=minio` (`env.validation.ts:60-68`), cần cho phép bỏ; thêm giá trị `s3` cho `STORAGE_DRIVER` (hoặc đổi tên sang `s3` chung).
  3. Cấu hình hạ tầng (không phải code): chính sách đọc công khai cho bucket public, CORS bucket (MinIO dùng biến `MINIO_API_CORS_ALLOW_ORIGIN`, S3 dùng cấu hình CORS của bucket), IAM tối thiểu.

### 3.6. 3D, AR, 360° trên web

Hiện dự án có: `three`, `@react-three/fiber`, `@react-three/drei` (chỉ khai báo). Tài liệu UC-3D-01 nhắc "React Three Fiber / model-viewer"; UC-3D-02 nhắc "WebXR / Scene Viewer / Quick Look". Chưa gói nào cho AR hay 360° trong `package.json`. Thư viện còn thiếu xem mục 4.

### 3.7. Zustand và TanStack Query

Chưa có phân chia thực tế (cả hai rỗng). Đề xuất quy ước:

| Loại state | Công cụ | Ví dụ |
| --- | --- | --- |
| Dữ liệu từ server (danh mục, sản phẩm, đơn, đánh giá, **giỏ hàng**) | TanStack Query | `useQuery(['cart'])`, `useMutation` thêm/sửa/xóa dòng, `invalidateQueries` |
| State phía client thuần giao diện | Zustand | trạng thái modal/sidebar (`uiStore`), cấu hình trình xem 3D (`viewerStore`), token và người dùng hiện tại (`authStore`) |

`store/cartStore.ts` **nên bỏ hoặc thu nhỏ**: giỏ hàng là dữ liệu server (bảng `carts`, `cart_items`, khách vãng lai không có giỏ theo D-N19). Dùng Query làm nguồn thật và optimistic update khi cập nhật số lượng; Zustand chỉ giữ "ý định thêm vào giỏ" khi khách chưa đăng nhập (đã chốt ở DECISIONS) và số lượng hiển thị tạm trên huy hiệu giỏ nếu cần.

## 4. Thư viện còn thiếu

| Gói đề xuất | Lý do | Module / UC | Ưu tiên |
| --- | --- | --- | --- |
| `@google/model-viewer` | Xem AR trên điện thoại: Scene Viewer (Android, GLB), Quick Look (iOS, USDZ), có kèm xem 3D đơn giản | M12: UC-3D-02; có thể dùng cho UC-3D-01 | Cao |
| (hoặc) `@react-three/xr` | WebXR thuần Three.js (thay model-viewer); khó hơn, hỗ trợ iOS hạn chế | M12: UC-3D-02 | Thấp (nếu chọn model-viewer) |
| Bộ xem ảnh 360° | Hiện không có. Hai hướng: (a) tự dựng trong R3F bằng mặt cầu + `TextureLoader` + `drei` `Html` cho hotspot (không thêm gói); (b) `@photo-sphere-viewer/core` + `@photo-sphere-viewer/markers-plugin` | M13: UC-SPACE-02/03, UC-ADM-16 (soạn hotspot) | Cao (chọn hướng) |
| `@react-three/drei` (đã có) | `useGLTF` (đọc GLB, **tự giải nén Meshopt** nên khớp đầu ra của job), `OrbitControls`, `Environment`, `Html` | M12, M13 | Đã có |
| `react-hook-form` + `@hookform/resolvers` + `zod` | Form đăng ký/đăng nhập/thanh toán/admin; `lib/validators.ts` đang rỗng | M02, M09, mọi trang admin | Cao |
| `recharts` (hoặc `chart.js`) | Biểu đồ dashboard, phễu AR và không gian mẫu | M14: UC-ADM-28/29 | Trung bình |
| ~~Trình soạn nội dung (`@tiptap/react`)~~ **Không dùng**: trang tĩnh soạn bằng textarea Markdown | Soạn trang tĩnh | M06: UC-ADM-07 | Bỏ |
| `@tanstack/react-query-devtools` | Gỡ lỗi truy vấn khi dev | Web | Thấp |
| Vitest + Testing Library, Playwright | Test giao diện và e2e web (hiện web chưa có test runner) | Web | Trung bình |
| `@nestjs/schedule` | Dọn tệp dở dang trong `models/incoming/`, hết hạn phiên | M05, M12, M02 | Trung bình |
| `slugify` (backend) | Sinh slug sản phẩm/danh mục/không gian | M06, M07, M13 | Thấp |
| Mobile: `androidx.navigation:navigation-compose`, `lifecycle-viewmodel-compose`, `kotlinx-coroutines-android`, `okhttp` logging, DataStore | Điều hướng, ViewModel, bất đồng bộ, lưu token | Mobile (nếu đưa vào) | Cao (nếu đưa vào) |
| Mobile: nâng Hilt (và kiểm tra tương thích AGP 9 / Kotlin 2.2), CameraX 1.5.x | Tránh lỗi build lần đầu | Mobile (nếu đưa vào) | Cao (nếu đưa vào) |

Khai báo nhưng chưa dùng, cân nhắc gỡ: `passport`, `passport-jwt`, `@nestjs/passport`, `cookie-parser`, `@types/passport-jwt` ở `apps/api` (`JwtAuthGuard` dùng `JwtService` trực tiếp, `cookie-parser` chưa gắn). Không cần thiết cho cổng VNPay: ký HMAC dùng `node:crypto`.

## 5. Công nghệ ngoài danh sách

| Công nghệ | Phiên bản (cài) | Vai trò | Nên đưa vào bảng nộp? |
| --- | --- | --- | --- |
| **NestJS** (`@nestjs/core` + common, platform-express) | 10.4.22 | Framework backend, DI, guard, pipe, interceptor | **Bắt buộc** (nền của toàn bộ API) |
| `@nestjs/swagger` | 7.4.2 | Tài liệu OpenAPI tại `/docs` | Nên |
| `@nestjs/config` + `zod` | 3.x / 3.25.76 | Kiểm tra biến môi trường khi khởi động | Nên (ghi chung "cấu hình") |
| `@nestjs/jwt`, `bcryptjs` | 10.2.0 / 3.0.3 | Access token JWT, băm mật khẩu | Nên (xác thực) |
| `class-validator`, `class-transformer` | 0.14.4 / 0.5.1 | Kiểm tra dữ liệu vào (DTO) | Có thể |
| `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` | 6.7.1 / 1.2.0 | Giới hạn tốc độ lưu bộ đếm trong Redis | Có thể (gắn với Redis) |
| `helmet`, `multer` | 7.2.0 / 2.0.2 | Header bảo mật; nhận tệp multipart | Có thể |
| `nodemailer` + Mailpit | 6.10.1 / `axllent/mailpit` | Gửi email SMTP; hộp thư giả khi dev | Nên (email) |
| `sharp` | 0.35.5 | Tạo webp/thumbnail, thu nhỏ texture | Nên (xử lý ảnh) |
| `@gltf-transform/core,functions,extensions` + `meshoptimizer` + `draco3dgltf` | 4.5.1 / 0.18.1 / 1.5.7 | Kiểm tra GLB, đo đa giác, sinh LOD, nén Meshopt | Nên (xử lý 3D) |
| `@aws-sdk/client-s3` + `s3-request-presigner` | 3.1147.0 | Truy cập MinIO/S3, presigned URL | Nên (gắn MinIO/S3) |
| `@bull-board/*` | 9.10.4 | Giao diện xem hàng đợi | Có thể |
| Jest, ts-jest, Supertest | 29.7.0 / 29.4.12 / 7.3.1 | Test đơn vị và e2e | Nên |
| Turborepo, npm workspaces | 2.10.13 / npm 11.19 | Quản lý monorepo, chạy tác vụ | Nên |
| ESLint, typescript-eslint, Prettier | 8.57.1 / 7.x / 3.9.9 | Chất lượng và định dạng mã | Có thể |
| Husky, lint-staged, commitlint | 9.1.7 / 15.5.2 / 19.8.1 | Hook git, Conventional Commits | Có thể |
| Docker, Docker Compose | 29.7.2 / 5.4.0 | Môi trường dev (postgres, redis, minio, mailpit, api) | **Nên** |
| GitHub Actions | workflow `ci.yml` | CI: lint, typecheck, test, build | Nên |
| `packages/shared-types` + script sinh từ Prisma | `scripts/generate-shared-types.mjs` | Kiểu dùng chung web/api, sinh từ `schema.prisma` | Có thể |
| Mermaid CLI | `@mermaid-js/mermaid-cli` (npx) | Xuất sơ đồ UML | Không (công cụ tài liệu) |
| Mobile (nếu đưa vào): Hilt 2.51.1, Retrofit 2.11.0 + Gson, Coil 2.6.0, Material3, KSP | | DI, gọi API, tải ảnh, giao diện | Nếu có mobile |

## 6. Bảng công nghệ nộp giảng viên (CHÍNH THỨC)

Chốt ngày 2026-10-08 theo `docs/DECISIONS.md` D-P06, D-T29..D-T36. Chỉ gồm công nghệ dự án đã dùng hoặc sẽ dùng theo kế hoạch đã chốt; mục chưa cài (model-viewer, react-hook-form, recharts...) được cài đúng đợt cần dùng.

### Web

| Công nghệ | Nền tảng | Vai trò |
| --- | --- | --- |
| Next.js 14 | Web | Framework xây website (App Router) |
| TypeScript | Web, Backend | Ngôn ngữ lập trình, kiểu dùng chung giữa web và API |
| Tailwind CSS | Web | Thiết kế giao diện |
| Zustand | Web | Quản lý client state (giao diện, token, cấu hình trình xem 3D) |
| TanStack Query | Web | Gọi và cache API (dữ liệu từ server, kể cả giỏ hàng) |
| Three.js | Web | Xử lý 3D |
| React Three Fiber (+ drei) | Web | Kết nối React với Three.js: xem mô hình GLB (`useGLTF`), ảnh 360° (mặt cầu + `TextureLoader`), hotspot (`Html`) |
| `@google/model-viewer` | Web | Xem sản phẩm bằng AR trên điện thoại (Scene Viewer, Quick Look) |
| React Hook Form + Zod | Web | Biểu mẫu và kiểm tra dữ liệu |
| Recharts | Web | Biểu đồ thống kê quản trị |

### Mobile

| Công nghệ | Nền tảng | Vai trò |
| --- | --- | --- |
| Android | Mobile | Nền tảng ứng dụng (minSdk 26) |
| Kotlin | Mobile | Ngôn ngữ lập trình |
| Jetpack Compose | Mobile | Xây giao diện |
| CameraX | Mobile | Xử lý camera (Preview, ImageCapture) |
| Overlay (Compose Canvas + Coil) | Mobile | Đặt ảnh PNG sản phẩm lên camera, kéo/xoay/phóng to |
| Retrofit + Hilt | Mobile | Gọi API công khai, tiêm phụ thuộc |

### Backend và hạ tầng

| Công nghệ | Dùng để | Ví dụ AURELIA |
| --- | --- | --- |
| NestJS | Framework backend | Controller, service, guard, pipe cho 144 endpoint |
| PostgreSQL | Database chính | User, Product, Order (44 bảng, 36 trigger) |
| Prisma | Backend làm việc với PostgreSQL | Query Product, tạo Order trong transaction |
| Redis | Cache, trạng thái hàng đợi, giới hạn tốc độ | Cache danh mục và sản phẩm nổi bật, trạng thái BullMQ, giới hạn đăng nhập |
| BullMQ | Hàng đợi xử lý nền | `model-processing` (LOD mô hình 3D), `image-processing` (webp, thumbnail), `mail`, `notification` |
| MinIO | Lưu file (dev) | JPG, WebP, PNG, GLB, USDZ, panorama |
| S3 | Object storage production | Ảnh và mô hình sản phẩm (chỉ đổi biến môi trường) |
| Swagger (OpenAPI) | Tài liệu API | `/docs` cho 144 endpoint |
| Jest + Supertest | Kiểm thử | Unit test, e2e với PostgreSQL, Redis, MinIO thật |
| sharp | Xử lý ảnh | Tạo webp và thumbnail, thu nhỏ texture |
| glTF-Transform (+ Meshopt) | Xử lý mô hình 3D | Kiểm tra GLB, đo đa giác, sinh LOD, nén |
| Nodemailer + Mailpit | Gửi email, hộp thư giả khi dev | Xác thực email, đặt lại mật khẩu, đơn hàng |
| Docker Compose | Môi trường dev | postgres, redis, minio, mailpit, api |
| GitHub Actions | CI | Lint, typecheck, test, build |

## 7. Kế hoạch cài đặt và cấu hình cho mục 🟡 và ❌

Đợt theo lộ trình module (xem `docs/TIEN_DO.md`, `docs/MODULE_ENV_REPORT.md` mục 4).

| Việc | Gói | File | Giờ | Phụ thuộc đợt |
| --- | --- | --- | --- | --- |
| Gắn `QueryClientProvider`, dựng `api-client` (fetch + bóc `{success,data,meta}` + lỗi theo `ErrorCode`) | (đã có) | `apps/web/src/app/layout.tsx`, `src/services/api-client.ts`, `src/lib/query-client.ts` | 4 | Đợt M02 |
| Hook `useAuth`, `authStore` (Zustand), tự làm mới token | (đã có) | `src/store/authStore.ts`, `src/hooks/useAuth.ts` | 6 | Đợt M02 |
| Bỏ/thu nhỏ `cartStore`, viết `useCart` bằng Query + optimistic update | (đã có) | `src/store/cartStore.ts`, `src/hooks/useCart.ts` | 4 | Đợt M08 |
| Nối `theme.ts` vào `tailwind.config.ts` (màu thương hiệu) | (đã có) | `apps/web/tailwind.config.ts`, `src/styles/theme.ts` | 1 | Khung giao diện |
| Form + validate | `react-hook-form`, `@hookform/resolvers`, `zod` | `src/lib/validators.ts` | 3 | Đợt M02 |
| Trình xem 3D: `<Canvas>`, `useGLTF`, `OrbitControls`, chọn LOD theo thiết bị | (đã có) | `src/components/viewer/ProductViewer3D.tsx`, `ModelLoader.tsx` | 10 | Đợt M12 |
| AR trên điện thoại | `@google/model-viewer` | `src/components/viewer/` (thêm `ArButton.tsx`), `next.config.js` (transpile) | 8 | Đợt M12 |
| Ảnh 360° + hotspot | tự dựng bằng R3F, hoặc `@photo-sphere-viewer/*` | `src/components/viewer/SpacePanorama.tsx`, `Hotspot.tsx` | 14 | Đợt M13 |
| Biểu đồ dashboard | `recharts` | `src/app/admin/dashboard/page.tsx` | 6 | Đợt M14 |
| Test web | `vitest`, `@testing-library/react`, `playwright` | `apps/web/package.json`, `vitest.config.ts` | 8 | Song song |
| `CacheService` Redis + áp dụng cho 4-5 endpoint công khai, xóa khóa khi admin sửa | (dùng `ioredis` sẵn có) | `apps/api/src/cache/*`, service M06, M07, M01 | 8 | Đợt M06, M07 |
| Queue `mail` (đợt M02) và `notification` (đợt M09), retry 3 lần, backoff mũ | (đã có `bullmq`) | `apps/api/src/modules/jobs/*`, `mail/smtp-mail.service.ts` | 6 | Đợt M02, M09 |
| Throttler siết cho đăng nhập, quên mật khẩu, đăng ký | (đã có) | `modules/auth/auth.controller.ts` | 2 | Đợt M02 |
| Driver `s3` và biến `S3_FORCE_PATH_STYLE` | (đã có SDK) | `storage.module.ts`, `minio-storage.service.ts`, `env.validation.ts` | 3 | Trước khi triển khai production |
| ~~Dọn gói không dùng (`passport*`, `cookie-parser`)~~ **Đã gỡ 2026-10-08** | gỡ | `apps/api/package.json` | 0,5 | Xong |
| `@nestjs/schedule` dọn tệp dở dang | `@nestjs/schedule` | `apps/api/src/modules/media` | 3 | Đợt M05, M12 |
| Mobile (phương án B, đã chọn) | xem mục 3.1 | `apps/mobile/**` | ~70 | Sau M07 (và M12 nếu kịp) |

## 8. Quyết định đã nhận

| # | Câu hỏi | Quyết định | Ghi vào |
| --- | --- | --- | --- |
| 1 | Mobile | **Phương án B** (tối thiểu: danh mục, chi tiết, camera + overlay, chụp và lưu); làm SAU M07 (và M12 nếu kịp); không đăng nhập, giỏ hàng, đặt hàng | D-P06, D-P07; DAC_TA nhóm UC-MOB |
| 2 | Redis OTP/session | **Phương án A**: giữ PostgreSQL. Redis = "cache, trạng thái hàng đợi, giới hạn tốc độ" | D-T29 |
| 3 | Redis cache | **Có** `CacheService` (ioredis), TTL như mục 3.3, xóa khóa khi admin sửa; đợt M06/M07 (M01 cho settings) | D-T30 |
| 4 | BullMQ | **Có** queue `mail` (đợt M02) và `notification` (đợt M09), thử lại 3 lần, backoff mũ | D-T31 |
| 5 | AR web, 360° | `@google/model-viewer`; ảnh 360° tự dựng bằng R3F (mặt cầu + `TextureLoader` + drei `Html`, `useGLTF`) | D-T32 |
| 6 | S3 | Không triển khai thật; cuối dự án sửa nhỏ (driver `s3`, `S3_FORCE_PATH_STYLE`, `S3_ENDPOINT` tùy chọn) | D-T33 |
| 7 | Bảng nộp | Đồng ý thêm NestJS, Docker Compose, GitHub Actions, Swagger, Jest + Supertest, sharp, gltf-transform, model-viewer, Nodemailer + Mailpit; CÓ nhóm Mobile | D-T34; mục 6 |
| 8 | Ảnh overlay | Chủ dự án tự chuẩn bị PNG nền trong suốt cho 5-10 sản phẩm; nơi lưu trong CSDL **đang chờ chọn** | D-T36, O-06 |
| + | Gỡ gói; thư viện web | Gỡ `passport*`, `cookie-parser`; web: `react-hook-form` + `@hookform/resolvers` + `zod` (M02), `recharts` (M14); không Tiptap (trang tĩnh: textarea Markdown); cài đúng đợt | D-T35 |
