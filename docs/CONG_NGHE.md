# Đối chiếu công nghệ

Cập nhật 2026-10-09, sau lượt cấu hình môi trường (D-T37) và đợt đồng bộ tài liệu. Phiên bản ghi ở đây là phiên bản **thực cài** (đọc từ `node_modules` và `apps/mobile/gradle/libs.versions.toml`), không phải phiên bản khai báo. Bản kiểm tra gốc ngày 2026-10-08 (trước khi cài môi trường) còn trong lịch sử git (commit `25fc057`).

Ký hiệu: **Đã dùng** = đang chạy trong code thật · **Đã cấu hình** = đã cài, cấu hình, kiểm tra chạy được, chờ code nghiệp vụ dùng · **Theo kế hoạch** = chưa có trong code, đã chốt sẽ làm · **Không áp dụng** = không cần ở môi trường hiện tại.

## 1. Tóm tắt

| Trạng thái | Số công nghệ | Công nghệ |
| --- | --- | --- |
| Đã dùng | 16 | Web: Next.js, TypeScript, Tailwind, Vitest + Playwright. Backend: NestJS, PostgreSQL, Prisma, Redis (hàng đợi, giới hạn tốc độ), BullMQ, MinIO, Swagger, Jest + Supertest, sharp, glTF-Transform, Nodemailer + Mailpit, Docker Compose |
| Đã cấu hình | 14 | Web: Zustand, TanStack Query, Three.js, React Three Fiber, model-viewer, React Hook Form + Zod, Recharts. Mobile: Android, Kotlin, Jetpack Compose, CameraX, Retrofit + Hilt. Backend: S3 (driver, chưa triển khai thật), GitHub Actions (chưa chạy trên GitHub) |
| Theo kế hoạch | 1 | Overlay ảnh trên camera (mobile) |
| Không áp dụng | 0 | |

Tổng 31 hạng mục của bảng nộp (mục 6). Các điểm chính:

1. **Mobile nằm trong phạm vi** (D-P06, D-P07): phương án tối thiểu, làm sau M07. Trước đây tài liệu xếp ngoài phạm vi; mâu thuẫn đó đã được giải quyết.
2. **Redis = cache, trạng thái hàng đợi, giới hạn tốc độ.** KHÔNG lưu OTP hay phiên (phiên đăng nhập, đặt lại mật khẩu nằm ở PostgreSQL: `user_sessions`, `password_resets`; xác thực email bằng JWT) (D-T29). Cache (`CacheService`) đã có, chưa module nghiệp vụ nào gọi (D-T30).
3. **BullMQ có 4 queue** (`model-processing`, `image-processing`, `mail`, `notification`), thử lại 3 lần, backoff mũ. Email đi qua queue `mail` khi `MAIL_TRANSPORT=queue` (mặc định); `MailService` chưa module nào gọi.
4. **Số endpoint:** theo thiết kế **144** (`BAO_CAO_PHAN_TICH_THIET_KE.md` mục 6); đã cài **6 route** (`GET /health`, `POST /api/admin/media`, `.../media/presign`, `.../media/confirm`, `POST /api/admin/models/:id/files/presign`, `.../confirm`), cộng giao diện Bull Board `/admin/queues`. Phần còn lại là khung controller rỗng.
5. **Toàn bộ môi trường đã cài và cấu hình ngay** (D-T37), thay nguyên tắc "cài đúng đợt" của D-T35.

## 2. Bảng đối chiếu

### 2.1. Web (`apps/web`)

| Công nghệ | Vai trò | Trạng thái | Phiên bản thực cài | Nơi cấu hình | Nơi dùng |
| --- | --- | --- | --- | --- | --- |
| Next.js | Framework (App Router) | Đã dùng | 14.2.35 (React 18.3.1) | `next.config.js`, `src/app/layout.tsx` | 13 route; `npm run build` qua |
| TypeScript | Ngôn ngữ | Đã dùng | 5.7.2 (gốc, cả workspace) | `tsconfig.json` các workspace | Toàn bộ |
| Tailwind CSS | Giao diện | Đã dùng | 3.4.19 (PostCSS 8.5, Autoprefixer 10.6) | `tailwind.config.ts`, `postcss.config.js`, `src/styles/theme.ts` | `src/app/page.tsx` (màu `text-primary` từ theme) |
| Zustand | Client state | Đã cấu hình | 4.5.7 | `src/store/*.ts` | 4 store rỗng, chờ code |
| TanStack Query | Gọi/cache API | Đã cấu hình | 5.104.1 (+ devtools 5.104.1) | `src/app/providers.tsx`, `src/lib/query-client.ts` | Provider đã gắn trong `layout.tsx`; chưa có truy vấn |
| Three.js | 3D | Đã cấu hình | 0.163.0 (+ `@types/three` 0.163.0) | `package.json` (`overrides` ở gốc) | `tests/unit/r3f-canvas.test.tsx` |
| React Three Fiber, drei | Kết nối React, tiện ích 3D | Đã cấu hình | 8.18.0, 9.122.0 | `src/components/viewer/*` (khung) | Test dựng `<Canvas>` qua; chưa có trang |
| `@google/model-viewer` | AR trên điện thoại | Đã cấu hình | 3.5.0 | `ModelViewer.tsx` (client-only), `ModelViewerElement.tsx`, `types/model-viewer.d.ts` | Chưa có trang |
| React Hook Form, `@hookform/resolvers`, Zod | Biểu mẫu, kiểm tra dữ liệu | Đã cấu hình | 7.89.0, 5.9.1, 3.25.76 | `package.json` | Chưa có form |
| Recharts | Biểu đồ | Đã cấu hình | 2.15.4 | `package.json` | Chưa có biểu đồ |
| Vitest, Testing Library, jsdom, Playwright | Kiểm thử | Đã dùng | 5.0.3, react 16.3.3, 30.1.2, 1.64.0 (Chromium) | `vitest.config.mts`, `playwright.config.ts` | 3 test đơn vị, 2 test e2e qua |

### 2.2. Mobile (`apps/mobile`)

Máy dev có Android SDK, JDK 21 (JBR của Android Studio); `./gradlew assembleDebug` thành công. Chưa xác nhận hiển thị trên máy ảo (AVD thiếu RAM). Code: `MainActivity` hiện một dòng chữ; 39 file Kotlin còn lại là khung rỗng.

| Công nghệ | Vai trò | Trạng thái | Phiên bản thực cài | Nơi cấu hình |
| --- | --- | --- | --- | --- |
| Android | Nền tảng | Đã cấu hình | AGP 9.2.1; compileSdk 37, targetSdk 36, minSdk 26 | `app/build.gradle.kts`, `AndroidManifest.xml` (CAMERA, INTERNET) |
| Kotlin | Ngôn ngữ | Đã cấu hình | 2.2.10, KSP 2.2.10-2.0.2 | `gradle/libs.versions.toml` |
| Jetpack Compose | Giao diện | Đã cấu hình | BOM 2026.02.01, Material3 | như trên |
| CameraX | Camera | Đã cấu hình | 1.5.3 | như trên (chưa có màn hình) |
| Overlay | Ảnh sản phẩm trên camera | Theo kế hoạch | (Compose Canvas + Coil 2.6.0) | `ui/camera/OverlayCanvas.kt` (khung rỗng) |
| Retrofit + Hilt | API, DI | Đã cấu hình | Retrofit 2.11.0, Hilt 2.59.2, hilt-navigation-compose 1.3.0 | như trên |

Thư viện đã thêm: `navigation-compose` 2.9.7, `lifecycle-viewmodel-compose` 2.11.0, `kotlinx-coroutines-android` 1.10.2, `datastore-preferences` 1.2.1, OkHttp `logging-interceptor` 4.12.0 (D-T44). `BuildConfig.API_BASE_URL` theo build type; HTTP chỉ ở bản debug.

### 2.3. Backend và hạ tầng

| Công nghệ | Vai trò | Trạng thái | Phiên bản thực cài | Nơi cấu hình | Nơi dùng |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL | Database chính | Đã dùng | 16 (`postgres:16-alpine`) | `docker-compose.yml`, `DATABASE_URL` | 44 bảng, 36 trigger, 2 migration |
| Prisma | ORM | Đã dùng | 5.22.0 | `prisma/schema.prisma`, `src/prisma/prisma.service.ts` | Media, ModelFile, Product3DModel, seed |
| Redis | Cache, trạng thái hàng đợi, giới hạn tốc độ | Đã dùng (queue, throttler); cache đã cấu hình | 7 (`redis:7-alpine`), ioredis 5.11.1 | `docker-compose.yml`, `env.validation.ts` | `jobs.module.ts`, `app.module.ts`, `cache/*`, `/health` |
| BullMQ | Hàng đợi nền | Đã dùng | 5.81.5, `@nestjs/bullmq` 10.2.3, Bull Board 9.10.4 | `modules/jobs/jobs.module.ts` | `model-processing`, `image-processing`, `mail`, `notification` |
| MinIO | Lưu file (dev) | Đã dùng | `bitnamilegacy/minio:2025.4.22-debian-12-r2` | `docker-compose.yml`, `env.validation.ts` | `storage/minio-storage.service.ts` |
| S3 | Lưu file (production) | Đã cấu hình | cùng `@aws-sdk/client-s3` 3.1147.0 | `STORAGE_DRIVER=s3`, `S3_FORCE_PATH_STYLE`, `S3_ENDPOINT` tùy chọn | Chưa triển khai thật; 8 unit test cấu hình |

## 3. Các mâu thuẫn trước đây và cách đã giải quyết

| Mâu thuẫn | Quyết định | Hiện trạng |
| --- | --- | --- |
| Mobile: mục tiêu có, tài liệu xếp ngoài phạm vi | D-P06, D-P07: phương án B (tối thiểu), làm sau M07 | Đã vào phạm vi; nhóm UC-MOB 4 UC trong đặc tả |
| Redis "OTP, session" vs PostgreSQL | D-T29: giữ PostgreSQL | Redis không lưu phiên/OTP; ghi rõ trong bảng nộp |
| Redis "cache": chưa có | D-T30 | `CacheService` có, TTL gợi ý: danh mục 10 phút, sản phẩm nổi bật 2 phút, settings 10 phút, trang tĩnh 10 phút, chi tiết sản phẩm 1 phút; áp dụng ở M06, M07, M01 |
| BullMQ "email, notification" | D-T31, D-T42 | Có queue `mail` (processor gửi SMTP thật) và `notification` (processor chỉ ghi log); `MailService` đẩy job khi `MAIL_TRANSPORT=queue` |
| MinIO sang S3 cần sửa mã | D-T33, D-T41 | Đã có driver `s3`; chuyển production chỉ đổi biến môi trường (xem `ENVIRONMENT.md` mục 5) |
| AR web, ảnh 360° chưa có thư viện | D-T32 | model-viewer (AR); ảnh 360° tự dựng bằng R3F |
| Zustand với TanStack Query chưa phân chia | Quy ước ở mục 3.1 | Server state dùng Query, UI/token dùng Zustand |
| Gói không dùng (`passport*`, `cookie-parser`) | D-T35 | Đã gỡ |

### 3.1. Phân chia Zustand và TanStack Query

| Loại state | Công cụ | Ví dụ |
| --- | --- | --- |
| Dữ liệu từ server (danh mục, sản phẩm, đơn, đánh giá, **giỏ hàng**) | TanStack Query | `useQuery(['cart'])`, `useMutation` thêm/sửa/xóa dòng, `invalidateQueries` |
| State phía client thuần giao diện | Zustand | modal/sidebar (`uiStore`), cấu hình trình xem 3D (`viewerStore`), token và người dùng hiện tại (`authStore`) |

`store/cartStore.ts` nên bỏ hoặc thu nhỏ: giỏ hàng là dữ liệu server (`carts`, `cart_items`); khách vãng lai không có giỏ (DECISIONS D-N19).

## 4. Thư viện

Mọi thư viện đã chốt đều đã cài (D-T37). Không còn thư viện "thiếu" cho các UC đã đặc tả. Quyết định không dùng: Tiptap (trang tĩnh soạn bằng textarea Markdown), `@react-three/xr` (đã chọn model-viewer), `@photo-sphere-viewer/*` (ảnh 360° tự dựng bằng R3F).

Gói ngoài danh sách ban đầu, đã thêm kèm lý do (xem DECISIONS D-T39, D-T42): `@vitejs/plugin-react`, `jsdom`, `@testing-library/dom` (Vitest và Testing Library cần); `@nestjs/schedule` 4.1.2, `slugify` 1.6.9 (đã duyệt ở báo cáo trước).

## 5. Công nghệ ngoài danh sách mục tiêu

| Công nghệ | Phiên bản | Vai trò | Nên đưa vào bảng nộp? |
| --- | --- | --- | --- |
| **NestJS** (core, common, platform-express) | 10.4.22 | Framework backend | **Bắt buộc** (đã có trong mục 6) |
| `@nestjs/swagger` | 7.4.2 | OpenAPI tại `/docs` | Có (mục 6) |
| `@nestjs/config` + Zod (API) | 3.3.0 / 3.25.76 | Kiểm tra biến môi trường khi khởi động | Có thể |
| `@nestjs/jwt`, `bcryptjs` | 10.2.0 / 3.0.3 | Access token JWT, băm mật khẩu (không dùng Passport) | Có thể |
| `class-validator`, `class-transformer` | 0.14.4 / 0.5.1 | Kiểm tra dữ liệu vào | Có thể |
| `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` | 6.7.1 / 1.2.0 | Giới hạn tốc độ (nhóm `default` và `auth`) lưu trong Redis | Có thể (gắn với Redis) |
| `@nestjs/schedule` | 4.1.2 | Công việc định kỳ (chưa có cron) | Không |
| `helmet`, `multer` | 7.2.0 / 2.0.2 | Header bảo mật; nhận ảnh multipart | Không |
| `nodemailer`, Mailpit | 6.10.1 / v1.31.4 | Gửi email SMTP; hộp thư giả khi dev | Có (mục 6) |
| `sharp` | 0.35.5 | Webp, thumbnail, thu nhỏ texture | Có (mục 6) |
| `@gltf-transform/*`, `meshoptimizer`, `draco3dgltf` | 4.5.1 / 0.18.1 / 1.5.7 | Kiểm tra GLB, sinh LOD, nén | Có (mục 6) |
| `@aws-sdk/client-s3`, `s3-request-presigner` | 3.1147.0 | MinIO/S3, presigned URL | Có (gắn MinIO/S3) |
| `slugify` | 1.6.9 | Sinh slug (chưa dùng) | Không |
| Jest, ts-jest, Supertest | 29.7.0 / 29.4.12 / 7.3.1 | Kiểm thử API | Có (mục 6) |
| Turborepo, npm workspaces | 2.10.13 / npm 11.19 (Node 24.20 trên máy dev, yêu cầu ≥ 22) | Quản lý monorepo | Có thể |
| ESLint 8.57.1, Prettier 3.9.9, Husky 9.1.7, lint-staged 15.5.2, commitlint 19.8.1 | | Chất lượng mã, Conventional Commits | Có thể |
| Docker, Docker Compose | 29.7.2 / 5.4.0 | Môi trường dev (postgres, redis, minio, mailpit, api) | Có (mục 6) |
| GitHub Actions | `ci.yml`, `mobile.yml` | CI | Có (mục 6) |
| `packages/shared-types` + `scripts/generate-shared-types.mjs` | 0.1.0 | Kiểu dùng chung sinh từ Prisma | Có thể |
| Mobile: Material3, Coil, Gson, DataStore, OkHttp, KSP | xem mục 2.2 | Giao diện, tải ảnh, JSON, lưu cấu hình, mạng | Gộp vào dòng Retrofit + Hilt |
| Mermaid CLI | chạy qua `npx` | Xuất sơ đồ UML | Không (công cụ tài liệu) |

**Số endpoint:** thiết kế 144, đã cài 6 route (mục 1, điểm 4).

## 6. Bảng công nghệ nộp giảng viên (CHÍNH THỨC)

Chốt ngày 2026-10-08 theo `docs/DECISIONS.md` D-P06, D-T29..D-T36; cập nhật cột "Trạng thái" ngày 2026-10-09 sau khi cấu hình toàn bộ môi trường (D-T37). Trạng thái: **Đã dùng** = đang chạy trong code thật; **Đã cấu hình** = đã cài, cấu hình và kiểm tra chạy được, chờ code nghiệp vụ dùng; **Theo kế hoạch** = chưa có trong code, đã chốt sẽ làm.

### Web

| Công nghệ | Nền tảng | Vai trò | Trạng thái |
| --- | --- | --- | --- |
| Next.js 14 | Web | Framework xây website (App Router) | Đã dùng |
| TypeScript | Web, Backend | Ngôn ngữ lập trình, kiểu dùng chung giữa web và API | Đã dùng |
| Tailwind CSS | Web | Thiết kế giao diện (màu thương hiệu nối từ `theme.ts`) | Đã dùng |
| Zustand | Web | Quản lý client state (giao diện, token, cấu hình trình xem 3D) | Đã cấu hình (4 store rỗng) |
| TanStack Query | Web | Gọi và cache API (dữ liệu từ server, kể cả giỏ hàng) | Đã cấu hình (Provider + devtools đã gắn, chưa có truy vấn) |
| Three.js | Web | Xử lý 3D | Đã cấu hình (test dựng scene qua) |
| React Three Fiber (+ drei) | Web | Kết nối React với Three.js: xem mô hình GLB (`useGLTF`), ảnh 360° (mặt cầu + `TextureLoader`), hotspot (`Html`) | Đã cấu hình (`<Canvas>` render được trong test) |
| `@google/model-viewer` | Web | Xem sản phẩm bằng AR trên điện thoại (Scene Viewer, Quick Look) | Đã cấu hình (bọc client-only, build qua) |
| React Hook Form + Zod | Web | Biểu mẫu và kiểm tra dữ liệu | Đã cấu hình (đã cài, chưa có form) |
| Recharts | Web | Biểu đồ thống kê quản trị | Đã cấu hình (đã cài, chưa có biểu đồ) |
| Vitest + Testing Library, Playwright | Web | Kiểm thử đơn vị/component và e2e trình duyệt | Đã dùng (3 test đơn vị, 2 test e2e) |

### Mobile

| Công nghệ | Nền tảng | Vai trò | Trạng thái |
| --- | --- | --- | --- |
| Android | Mobile | Nền tảng ứng dụng (minSdk 26) | Đã cấu hình (`assembleDebug` thành công) |
| Kotlin | Mobile | Ngôn ngữ lập trình | Đã cấu hình |
| Jetpack Compose | Mobile | Xây giao diện | Đã cấu hình (màn hình hiện tên ứng dụng) |
| CameraX | Mobile | Xử lý camera (Preview, ImageCapture) | Đã cấu hình (khai báo, quyền CAMERA; chưa có màn hình) |
| Overlay (Compose Canvas + Coil) | Mobile | Đặt ảnh PNG sản phẩm lên camera, kéo/xoay/phóng to | Theo kế hoạch |
| Retrofit + Hilt | Mobile | Gọi API công khai, tiêm phụ thuộc | Đã cấu hình |

### Backend và hạ tầng

| Công nghệ | Dùng để | Ví dụ AURELIA | Trạng thái |
| --- | --- | --- | --- |
| NestJS | Framework backend | Controller, service, guard, pipe cho 144 endpoint | Đã dùng |
| PostgreSQL | Database chính | User, Product, Order (44 bảng, 36 trigger) | Đã dùng |
| Prisma | Backend làm việc với PostgreSQL | Query Product, tạo Order trong transaction | Đã dùng |
| Redis | Cache, trạng thái hàng đợi, giới hạn tốc độ | Cache danh mục và sản phẩm nổi bật, trạng thái BullMQ, giới hạn đăng nhập | Đã dùng (queue, throttler); cache Đã cấu hình |
| BullMQ | Hàng đợi xử lý nền | `model-processing`, `image-processing`, `mail`, `notification` | Đã dùng (4 queue chạy, hiện trên Bull Board) |
| MinIO | Lưu file (dev) | JPG, WebP, PNG, GLB, USDZ, panorama | Đã dùng |
| S3 | Object storage production | Ảnh và mô hình sản phẩm (chỉ đổi biến môi trường) | Đã cấu hình (driver `s3`, chưa triển khai thật) |
| Swagger (OpenAPI) | Tài liệu API | `/docs` cho 144 endpoint | Đã dùng |
| Jest + Supertest | Kiểm thử | Unit test (29), e2e với PostgreSQL, Redis, MinIO, Mailpit thật (23) | Đã dùng |
| sharp | Xử lý ảnh | Tạo webp và thumbnail, thu nhỏ texture | Đã dùng |
| glTF-Transform (+ Meshopt) | Xử lý mô hình 3D | Kiểm tra GLB, đo đa giác, sinh LOD, nén | Đã dùng |
| Nodemailer + Mailpit | Gửi email, hộp thư giả khi dev | Xác thực email, đặt lại mật khẩu, đơn hàng (qua queue `mail`) | Đã dùng (e2e: thư tới Mailpit) |
| Docker Compose | Môi trường dev | postgres, redis, minio, mailpit, api | Đã dùng |
| GitHub Actions | CI | Lint, typecheck, test (API, web), build; build Android riêng | Đã cấu hình (chưa chạy trên GitHub) |

## 7. Kế hoạch cài đặt và cấu hình (cập nhật 2026-10-09: ĐÃ HOÀN TẤT theo D-T37)

| Việc | Gói | File | Trạng thái |
| --- | --- | --- | --- |
| Gắn `QueryClientProvider` (+ devtools khi dev) | `@tanstack/react-query-devtools` 5.104.1 | `apps/web/src/app/providers.tsx`, `src/lib/query-client.ts` | **Xong** |
| `api-client`, `useAuth`, `authStore`, `useCart` | (đã có) | `apps/web/src/services`, `store`, `hooks` | Chờ code M02, M08 (store/hook rỗng) |
| Nối `theme.ts` vào Tailwind | (đã có) | `apps/web/tailwind.config.ts` | **Xong** |
| Form + validate | `react-hook-form` 7.89.0, `@hookform/resolvers` 5.9.1, `zod` 3.25.76 | `apps/web/package.json` | **Xong (cài)**; form viết ở M02 |
| Trình xem 3D (`<Canvas>`, `useGLTF`) | (đã có) | `apps/web/src/components/viewer/*` | **Đã kiểm tra render**; component thật viết ở M12 |
| AR trên điện thoại | `@google/model-viewer` 3.5.0 | `components/viewer/ModelViewer*.tsx`, `types/model-viewer.d.ts` | **Xong** |
| Ảnh 360° + hotspot | (R3F tự dựng) | `components/viewer/SpacePanorama.tsx` | Chờ code M13 |
| Biểu đồ dashboard | `recharts` 2.15.4 | `apps/web/package.json` | **Xong (cài)**; biểu đồ viết ở M14 |
| Test web | Vitest 5.0.3, Testing Library, Playwright 1.64.0 | `apps/web/vitest.config.mts`, `playwright.config.ts`, `tests/` | **Xong** |
| `CacheService` Redis | (dùng `ioredis` sẵn có) | `apps/api/src/cache/*` | **Xong** (8 unit test, 1 e2e); áp dụng ở M06, M07, M01 |
| Queue `mail`, `notification` | (đã có `bullmq`) | `apps/api/src/modules/jobs/*`, `mail/*` | **Xong** (e2e: thư tới Mailpit) |
| Throttler nhóm auth | (đã có) | `app.module.ts`, `common/decorators/throttle.decorators.ts` | **Xong** (e2e: 429); M02 gắn `@AuthThrottle()` |
| Driver `s3`, `S3_FORCE_PATH_STYLE` | (đã có SDK) | `storage/*`, `env.validation.ts` | **Xong** (unit test) |
| `@nestjs/schedule`, `slugify` | `@nestjs/schedule` 4.1.2, `slugify` 1.6.9 | `apps/api/src/app.module.ts` | **Xong** (đăng ký, chưa có cron) |
| Dọn gói không dùng | gỡ `passport*`, `cookie-parser` | `apps/api/package.json` | **Xong** |
| Mobile: Gradle, thư viện, `BuildConfig`, mạng debug | xem D-T44 | `apps/mobile/**` | **Xong** (`assembleDebug` thành công) |

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
