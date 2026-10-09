# Báo cáo cấu hình môi trường phát triển

> **Cập nhật 2026-10-09, commit `b30fc75`. Báo cáo này ghi kết quả lượt cấu hình môi trường; nội dung cũ được giữ nguyên.** Các điểm đã thay đổi sau đó: `docs/CONG_NGHE.md` đã được viết lại mục 1-5 (mục tham chiếu "3, 4, 6, 7, 8" nay là: 2 bảng đối chiếu, 3 mâu thuẫn đã giải quyết, 4 thư viện, 5 công nghệ ngoài danh sách, 6 bảng nộp, 7 kế hoạch, 8 quyết định); phiên bản TypeScript thực cài là **5.7.2** (các tài liệu cũ ghi 5.9.3). Mọi con số kiểm thử trong báo cáo này (29 unit, 23 e2e API, 3 unit web, 2 e2e web) còn đúng tại commit trên. Việc còn tồn đọng và mâu thuẫn tài liệu: xem [DOC_SYNC_REPORT.md](DOC_SYNC_REPORT.md). Trạng thái từng module: [TIEN_DO.md](TIEN_DO.md).

Ngày: 2026-10-09. Quyết định gốc: `docs/DECISIONS.md` D-T37 (cấu hình toàn bộ môi trường một lượt, thay nguyên tắc "cài đúng đợt" của D-T35). Phạm vi: chỉ hạ tầng và cấu hình; không logic nghiệp vụ, không trang giao diện, không endpoint mới (ngoài mở rộng `/health`), không sửa schema Prisma, không migration.

Báo cáo đối chiếu công nghệ đã đọc: `docs/CONG_NGHE.md` (mục 3, 4, 6, 7, 8). Đã đọc thêm `docs/DECISIONS.md` (D-P06, D-P07, D-T29 đến D-T36), `docs/MODULE_ENV_REPORT.md`, `docs/TIEN_DO.md`, `README.md`, `docker-compose.yml`, `.env.example`, `env.validation.ts`, các `package.json`, `turbo.json`, `.github/workflows/`, và cấu hình Gradle, `AndroidManifest.xml` của `apps/mobile`.

## 1. Hiện trạng trước lượt này và việc đã làm

| Gói / cấu hình | Đã có (phiên bản) | Việc trong lượt này |
| --- | --- | --- |
| Next.js, React, TypeScript, Tailwind | 14.2.35, 18.3.1, 5.9.3, 3.4.19 | Xác nhận; ghim chính xác; nối `theme.ts` vào Tailwind |
| Zustand, TanStack Query | 4.5.7, 5.103.1 | Xác nhận; nâng query lên 5.104.1 để khớp devtools |
| Three.js, R3F, drei | 0.165.0, 8.18.0, 9.122.0 | Xác nhận R3F, drei; hạ three về 0.163.0 (xem D-T38) |
| `ioredis`, `bullmq`, `@nestjs/bullmq`, `@nestjs/throttler`, `sharp`, glTF-Transform | 5.11.1, 5.81.5, 10.2.3, 6.7.1, 0.35.5, 4.5.1 | Xác nhận, không cài lại |
| react-hook-form, @hookform/resolvers, zod, recharts, @google/model-viewer, react-query-devtools | chưa có | **Cài** (xem mục 3) |
| Vitest, Testing Library, jsdom, Playwright | chưa có | **Cài và cấu hình** |
| `@nestjs/schedule`, `slugify` | chưa có | **Cài**; đăng ký `ScheduleModule.forRoot()` |
| CacheService, queue `mail` và `notification`, driver `s3`, throttler nhóm auth | chưa có | **Viết, cấu hình, kiểm thử** |
| Mobile: Gradle, CameraX 1.3.4, Hilt 2.51.1, thiếu navigation, ViewModel, DataStore, OkHttp | có khung, baseline `assembleDebug` đã chạy được | **Nâng và thêm thư viện, `BuildConfig`, cấu hình mạng debug** |
| CI | chỉ workflow API + web build | Thêm Mailpit, Vitest; workflow Android riêng |

## 2. Bảng hạng mục

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Web: cài thư viện (RHF, resolvers, zod, recharts, model-viewer, devtools) | Xong | `apps/web/package.json`, lockfile |
| Web: model-viewer chạy với Next.js 14 (client-only, kiểu JSX) | Xong | `ModelViewer.tsx` (dynamic, `ssr: false`), `types/model-viewer.d.ts`; build thử một trang tạm có `<ModelViewer>` qua, đã xóa trang tạm |
| Web: `providers.tsx` gắn QueryClientProvider + devtools (chỉ dev) | Xong | Console trình duyệt thật không lỗi; test Vitest |
| Web: nối `theme.ts` vào Tailwind | Xong | Playwright: `h1` có màu `rgb(139, 94, 60)` |
| Web: Three.js + R3F + drei hoạt động | Xong | Vitest dựng `<Canvas>` với `<Center>` (drei) và `mesh`; Playwright kiểm WebGL trong Chromium |
| Web: Vitest + Testing Library + jsdom | Xong | 3 test qua |
| Web: Playwright (chỉ Chromium) | Xong | 2 test qua, tự khởi động `next dev` ở cổng 3100 |
| Web: script `test`, `test:e2e` nối turbo | Xong | `npm test`, `npm run test:e2e` từ gốc |
| API: `@nestjs/schedule`, `slugify` | Xong | `app.module.ts` (`ScheduleModule.forRoot()`) |
| API: throttler nhóm `auth` (`@AuthThrottle()`) | Xong | e2e: lần thứ 4 trả 429 `RATE_LIMITED`, route khác không bị |
| API: driver `s3`, `S3_FORCE_PATH_STYLE`, `S3_ENDPOINT` tùy chọn | Xong | 5 unit test `env.validation`, 3 unit test cấu hình client S3 |
| API: CacheModule + CacheService (get, set TTL, del, delByPrefix, getOrSet, tắt bằng env) | Xong | 8 unit test + 1 e2e trên Redis thật |
| API: queue `mail` và `notification` (retry 3, backoff mũ), `MailQueueService`, `MAIL_TRANSPORT` | Xong | e2e: gửi email qua queue, Mailpit nhận được |
| API: `/health` mở rộng (database, redis, storage, smtp, queues) | Xong | e2e; `curl` trong container |
| Mobile: `./gradlew assembleDebug` | Xong | `BUILD SUCCESSFUL`, APK 15,5 MB |
| Mobile: chạy trên máy ảo | **Không xác nhận được** | Xem mục 4 (bước 8) |
| `.env.example`, `.env`, `docs/ENVIRONMENT.md` | Xong | Mọi biến code đọc đều có trong `.env.example` |
| docker-compose đủ dịch vụ, healthcheck, depends_on | Xong | `api` chờ postgres, redis, minio, minio-init, mailpit (healthy) |
| CI: Vitest, Mailpit; workflow Android | Xong (chưa chạy trên GitHub) | `ci.yml`, `mobile.yml` |
| Tài liệu: README, CONG_NGHE, TIEN_DO, DECISIONS | Xong | Các commit docs |

## 3. Gói đã cài kèm phiên bản

Web (`apps/web`), ghim chính xác: `react-hook-form` 7.89.0, `@hookform/resolvers` 5.9.1, `zod` 3.25.76, `recharts` 2.15.4, `@google/model-viewer` 3.5.0, `three` 0.163.0; dev: `@tanstack/react-query-devtools` 5.104.1, `vitest` 5.0.3, `@vitejs/plugin-react` 6.1.2, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1, `jsdom` 30.1.2, `@playwright/test` 1.64.0, `@types/three` 0.163.0. Ghim lại bản đang dùng: `next` 14.2.35, `react`, `react-dom` 18.3.1, `@react-three/fiber` 8.18.0, `@react-three/drei` 9.122.0, `@tanstack/react-query` 5.104.1, `zustand` 4.5.7. Gốc: `overrides` cho `@types/three` 0.163.0.

API (`apps/api`): `@nestjs/schedule` 4.1.2, `slugify` 1.6.9.

Mobile (`libs.versions.toml`): Hilt 2.59.2, `hilt-navigation-compose` 1.3.0, CameraX 1.5.3, `navigation-compose` 2.9.7, `lifecycle-viewmodel-compose` 2.11.0, `kotlinx-coroutines-android` 1.10.2, `datastore-preferences` 1.2.1, OkHttp `logging-interceptor` 4.12.0. Giữ AGP 9.2.1, Kotlin 2.2.10, KSP 2.2.10-2.0.2, compileSdk 37, Compose BOM 2026.02.01. Không phải hạ AGP hay compileSdk.

File cấu hình đã tạo hoặc sửa chính:
- Web: `src/app/providers.tsx`, `layout.tsx`, `src/lib/query-client.ts`, `src/styles/theme.ts`, `tailwind.config.ts`, `src/components/viewer/ModelViewer.tsx`, `ModelViewerElement.tsx`, `src/types/model-viewer.d.ts`, `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts`, `tests/unit/*`, `tests/e2e/*`.
- API: `app.module.ts`, `config/env.validation.ts`, `cache/*`, `common/decorators/throttle.decorators.ts`, `mail/*`, `modules/jobs/*` (mail, notification), `storage/*`, `health/health.controller.ts`, `prisma/seed-storage.ts`, `test/*`.
- Mobile: `gradle/libs.versions.toml`, `app/build.gradle.kts`, `AndroidManifest.xml`, `res/xml/network_security_config.xml` (release, chỉ HTTPS), `src/debug/res/xml/network_security_config.xml` (debug, cho HTTP), `MainActivity.kt`.
- Chung: `docker-compose.yml`, `.env.example`, `.env` (thêm biến dev, không in giá trị), `package.json`, `turbo.json`, `.github/workflows/ci.yml`, `mobile.yml`, `.gitignore`, `.gitattributes`, `docs/*`.

## 4. Kết quả 8 bước kiểm tra

| # | Kiểm tra | Lệnh | Kết quả |
| --- | --- | --- | --- |
| 1 | Mọi service healthy | `docker compose ps -a` | api, mailpit, minio, postgres, postgres-test, redis đều `healthy`; `minio-init` thoát mã 0 |
| 2 | Migration, seed | `npm run db:status`, `npm run db:seed` | "Database schema is up to date!" (2 migration); seed xong, tệp mẫu 10 bản ghi, tải mới 0 (idempotent) |
| 3 | `/health` | `curl localhost:4000/health` | `database`, `redis`, `storage`, `smtp`, `queues` đều `up`, kèm số job của 4 queue (0) |
| 4 | Email qua queue vào Mailpit | e2e `infra.e2e-spec.ts` | Qua: gửi qua `MAIL_SERVICE` (queue), worker gửi SMTP, Mailpit tìm thấy thư theo tiêu đề và địa chỉ nhận |
| 5 | Bull Board 4 queue | `GET /admin/queues/api/queues` với token admin | `model-processing, image-processing, mail, notification`; không token: 401 |
| 6 | lint, typecheck, test, build | `npm run lint`, `format:check`, `typecheck`, `types:check`, `npm test`, `npm run test:e2e`, `npm run build` | Tất cả qua. Unit: API 29 (13 cũ + 16 mới), web 3. E2E: API 23 (18 cũ + 5 mới), web 2. Build 3/3 |
| 7 | Web dev, Vitest, Playwright | Playwright mở `http://localhost:3100` bằng Chromium | Tiêu đề "Aurelia Living", màu chữ đúng, **không có lỗi hay cảnh báo console**; Vitest và Playwright qua |
| 8 | Mobile | `./gradlew assembleDebug` (JBR 21) | `BUILD SUCCESSFUL`; `BuildConfig.API_BASE_URL` debug là `http://10.0.2.2:4000/api/`, release là địa chỉ giữ chỗ HTTPS; cấu hình mạng debug cho HTTP, bản chính chỉ HTTPS |

**Mobile trên máy ảo (không xác nhận được):** máy có 3 AVD; Pixel_6a khởi động được (khoảng 64 giây) và cài APK thành công, nhưng AVD chỉ có 2 GB RAM và dùng GPU phần mềm nên hệ điều hành liên tục kill tiến trình (`lowmemorykiller`) rồi "System UI isn't responding". Ứng dụng không văng lỗi (không có `FATAL EXCEPTION`), nhưng không giữ được ở màn hình trước nên chưa thấy được chữ "Aurelia Living" trên máy ảo. Cách xử lý: tăng RAM AVD lên 4 GB và bật gia tốc phần cứng (WHPX/Hyper-V) trong Android Studio, hoặc thử trên máy thật.

## 5. Quyết định mới (đã ghi vào `docs/DECISIONS.md`)

D-T37 (cấu hình toàn bộ, thay D-T35), D-T38 (phiên bản web, hạ three, overrides), D-T39 (test web, WebGL stub), D-T40 (throttler `auth`), D-T41 (driver S3), D-T42 (cache, queue mail/notification, schedule, slugify), D-T43 (`/health` mở rộng), D-T44 (phiên bản mobile, `BuildConfig`, mạng debug), D-T45 (CI). Gói ngoài danh sách, kèm lý do: `@vitejs/plugin-react`, `jsdom`, `@testing-library/dom` (Vitest và Testing Library cần).

## 6. Điểm lệch và lưu ý

- **model-viewer 3.5.0, không phải 4.3.1:** bản 4.x yêu cầu `three ^0.183`, trong khi R3F 8 và drei 9 chưa tương thích tốt với three mới; vì vậy dùng 3.5.0 (yêu cầu `three ^0.163`) và hạ three về 0.163.0.
- **Web dev server khi test e2e dùng cổng 3100**, không phải 3000, để không đụng web đang chạy.
- **Cảnh báo `Failed to patch lockfile` của Next 14** (npm workspace) vẫn hiện khi build và dev; không ảnh hưởng kết quả.
- **JDK:** `gradle-daemon-jvm.properties` yêu cầu JDK 21 cho Gradle daemon, trong khi yêu cầu ban đầu nói JDK 17. Máy dùng JBR 21 của Android Studio; workflow Android cài cả 21 và 17.
- **Chưa chạy workflow GitHub Actions** (chưa đẩy lên GitHub), nên CI chưa được xác nhận trên runner thật.
- **Tệp `Untitled.java` ở gốc repo** đang hiện là đã xóa (không phải do lượt này làm); không đưa vào commit.

## 7. Chưa thuộc môi trường và vẫn chờ

- O-06: nơi lưu ảnh overlay trong CSDL (chờ chủ dự án chọn phương án A/B/C).
- Wireframe các màn hình chính; ảnh PNG overlay nền trong suốt cho 5-10 sản phẩm demo.
- Tài khoản và URL công khai (tunnel) cho VNPay sandbox (M10).
- Quyết định cuối cùng về máy thật/máy ảo để xem app Android.

## 8. Mục "đã cài nhưng chưa dùng" còn lại

- Driver `s3`: đã cấu hình và kiểm thử nhưng chưa triển khai S3 thật (đúng kế hoạch D-T33).
- Store Zustand (4 file) và hook TanStack Query (`useAuth`, `useCart`, `useProducts`, `useSpaces`) còn rỗng, chờ code nghiệp vụ.
- `react-hook-form` + zod, `recharts`, `@google/model-viewer` (đã bọc nhưng chưa trang nào dùng), `slugify`, `CacheService` (chưa module nào gọi), `@nestjs/schedule` (chưa có cron), processor `notification` (chỉ ghi log), `MailService` (chưa module nào gọi), CameraX/Overlay trong app (chưa có màn hình), `Retrofit`, `DataStore` trong app.
- `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`: đã validate, M02 sẽ đọc.

## 9. Kết luận

**Môi trường đã sẵn sàng để bắt đầu code M02 (xác thực).** Đã có sẵn: `@AuthThrottle()` cho đăng nhập/đăng ký/quên mật khẩu; `MailService` qua queue (email xác thực, đặt lại mật khẩu); guard JWT toàn cục; Prisma với `user_sessions`, `password_resets`; web có `QueryClientProvider`, react-hook-form + zod; quy ước API và mã lỗi. Chỉ còn hai điều cần lưu ý: M02 cần tự đọc `JWT_*_EXPIRES_IN`, và chưa xác nhận được app Android trên máy ảo (không chặn M02).
