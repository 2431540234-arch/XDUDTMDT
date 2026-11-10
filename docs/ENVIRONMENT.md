> Cập nhật lần cuối: 2026-11-11 – theo commit `c579fa8`.

> Đã đối chiếu với `apps/api/src/config/env.validation.ts` (49 biến) và `.env.example` ngày 2026-11-11: mọi biến API có trong bảng dưới. Biến mới/đổi của đợt 2026-11-10/11: `SWAGGER_ENABLED` (mặc định tắt ở production), `SEED_ADMIN_PASSWORD` và `SEED_SAMPLE` (ràng buộc production), `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED`, `NEXT_PUBLIC_USE_MOCK` (cấm khi build production). Triển khai thật: xem [DEPLOYMENT.md](DEPLOYMENT.md).

# Biến môi trường

Chỉ có **một** file `.env` ở thư mục gốc (sao chép từ [.env.example](../.env.example); `.env` không bao giờ được commit). API, Prisma CLI, seed, test và web đều đọc file này. Backend kiểm tra biến khi khởi động bằng Zod (`apps/api/src/config/env.validation.ts`) và dừng với thông báo rõ nếu thiếu hoặc sai.

Cột "Bắt buộc": **Có** = thiếu thì không khởi động; **Tùy chọn** = có mặc định hoặc có thể để trống; **Theo driver** = bắt buộc ở một số giá trị của biến khác.

## 1. Chung và API

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Tùy chọn | `development` | tất cả | `development`, `test`, `production` |
| `PORT` | Tùy chọn | `4000` | API | Cổng API (trong container luôn 4000) |
| `API_PORT` | Tùy chọn | `4000` | docker-compose | Cổng API trên máy host |
| `CORS_ORIGINS` | Tùy chọn | `http://localhost:3000` | API, MinIO | Các origin được gọi API, cách nhau bằng dấu phẩy; cũng là CORS của MinIO |
| `APP_URL` | Tùy chọn | `http://localhost:3000` | M02, M09 (link trong email) | URL công khai của website |
| `SWAGGER_ENABLED` | Tùy chọn | không đặt ⇒ bật ở dev/test, **tắt ở production** | M01 | Swagger tại `/docs`. Ở production chỉ bật khi đặt `SWAGGER_ENABLED=true` rõ ràng |

## 2. Cơ sở dữ liệu

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | **Có** | không | tất cả, Prisma, seed | `postgresql://aurelia:aurelia@localhost:5432/aurelia_dev?schema=public` |
| `POSTGRES_PORT` | Tùy chọn | `5432` | docker-compose | Cổng PostgreSQL trên máy host; đổi cả trong `DATABASE_URL` |
| `POSTGRES_DB` | Tùy chọn | `aurelia_living` (compose) | docker-compose | Tên DB tạo ở lần chạy đầu; `.env.example` đặt `aurelia_dev` |
| `DOCKER_DATABASE_URL` | Tùy chọn | `postgres:5432/$POSTGRES_DB` | docker-compose | Ghi đè chuỗi kết nối của container `api` |
| `POSTGRES_TEST_PORT` | Tùy chọn | `5433` | docker-compose (profile `test`) | DB riêng cho e2e |
| `TEST_DATABASE_URL` | Tùy chọn | `.../aurelia_test` cổng 5433 | test e2e API | CI đặt biến này |

## 3. Xác thực

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `JWT_ACCESS_SECRET` | **Có** (≥ 16 ký tự) | không | guard JWT, M02 | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **Có** (≥ 16 ký tự) | không | M02 | như trên |
| `JWT_ACCESS_EXPIRES_IN` | Tùy chọn | `15m` | Auth | Thời hạn access token. FE tự refresh khi 401. Với `NODE_ENV=production` tối đa `15m` (vượt thì API không khởi động) |
| `JWT_REFRESH_EXPIRES_IN` | Tùy chọn | `7d` | Auth | Refresh token xoay vòng (dùng một lần) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Tùy chọn | trống | `AuthService.google()` | **Đăng nhập Google chưa triển khai (đã hoãn):** `POST /auth/google` luôn trả `503` kể cả khi hai biến này có giá trị (`apps/api/src/modules/auth/auth.service.ts`). Chỉ giữ chỗ cho giai đoạn sau |

## 4. Redis, hàng đợi, giới hạn tốc độ, cache

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `REDIS_HOST` | Tùy chọn | `localhost` | BullMQ, throttler, cache, health | Trong Docker compose tự đặt `redis` |
| `REDIS_PORT` | Tùy chọn | `6379` | như trên, docker-compose | Máy này `6380` vì 6379 đã bị Redis khác dùng |
| `THROTTLE_DEFAULT_LIMIT` | Tùy chọn | `120` | mọi route | Số yêu cầu tối đa trong mỗi cửa sổ, theo IP |
| `THROTTLE_DEFAULT_TTL_SECONDS` | Tùy chọn | `60` | mọi route | Độ dài cửa sổ (giây) |
| `THROTTLE_AUTH_LIMIT` | Tùy chọn | `10` | M02 (route gắn `@AuthThrottle()`) | Đăng nhập, đăng ký, quên mật khẩu |
| `THROTTLE_AUTH_TTL_SECONDS` | Tùy chọn | `60` | như trên | |
| `CACHE_ENABLED` | Tùy chọn | `true` | CacheService (M01, M06, M07) | `false` = tắt hẳn cache |
| `CACHE_KEY_PREFIX` | Tùy chọn | `aurelia:cache:` | CacheService | Tiền tố khóa cache. **Mỗi môi trường một tiền tố riêng** (D-P14): `npm run demo` đặt `aurelia:cache-demo:`, `test:e2e:real` đặt `aurelia:cache-e2e:`, supertest `cache-e2e-db:`. API khởi động sẽ xóa mọi khóa mang tiền tố của mình |
| `CACHE_DEFAULT_TTL_SECONDS` | Tùy chọn | `300` | CacheService | TTL khi gọi `set` không nêu TTL |

## 5. Lưu trữ tệp (MinIO / S3)

**Driver theo môi trường (D-P13):** dev và demo dùng `STORAGE_DRIVER=minio` (mặc định của `.env`); `npm run demo:local` dùng `local` làm dự phòng; **supertest (`test:e2e:db`) và `test:e2e:real` giữ `local`** để không phụ thuộc container. Test với MinIO thật: `npm run test:e2e:minio` (API) và `npm run test:e2e:real:minio` (trình duyệt), dùng bucket riêng `aurelia-test-public` / `aurelia-test-private`. Chép tệp từ `apps/api/uploads` lên MinIO: `npm run minio:sync`.

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `STORAGE_DRIVER` | Tùy chọn | `minio` | M05, M12, M13 | `local`, `minio` (dev), `s3` (production) |
| `STORAGE_LOCAL_DIR` | Theo driver `local` | `./uploads` | StorageService | API phục vụ tại `/uploads` |
| `STORAGE_PUBLIC_URL` | Tùy chọn | `http://localhost:9000/aurelia-public` | StorageService | URL công khai của bucket public (gồm tên bucket) |
| `PRESIGN_EXPIRES_SECONDS` | Tùy chọn | `900` | M05, M12 | Hạn của presigned URL |
| `S3_ENDPOINT` | Theo driver `minio` | không | StorageService | `http://localhost:9000`; để trống với `s3` |
| `S3_PUBLIC_ENDPOINT` | Tùy chọn | = `S3_ENDPOINT` | StorageService | Endpoint trình duyệt gọi được (khi API chạy trong Docker) |
| `S3_REGION` | Tùy chọn | `us-east-1` | StorageService | `ap-southeast-1` với S3 thật |
| `S3_FORCE_PATH_STYLE` | Tùy chọn | `true` với minio, `false` với s3 | StorageService | `true`/`false` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Theo driver `minio` | không | StorageService, MinIO | Dev: `aurelia` / `aurelia123`; với `s3` có thể bỏ (IAM role) |
| `S3_BUCKET_PUBLIC` | Tùy chọn | `aurelia-public` | StorageService | |
| `S3_BUCKET_PRIVATE` | Tùy chọn | `aurelia-private` | StorageService | |
| `MINIO_PORT`, `MINIO_CONSOLE_PORT` | Tùy chọn | `9000`, `9011` | docker-compose | Cổng MinIO API và Console trên máy host (xem D-T54; console đổi từ 9001 sang **9011** vì 9001 thường bị Mosquitto của dự án khác chiếm) |
| `MINIO_CORS_ORIGINS` | Tùy chọn | `http://localhost:3000,http://localhost:3100` | docker-compose (MinIO) | Origin web được PUT/GET trực tiếp lên MinIO (CORS), cách nhau bằng dấu phẩy; 3000 = web demo/dev, 3100 = web của e2e |
| `BULL_PREFIX` | Tùy chọn | `bull` (`bull-test` khi `NODE_ENV=test`) | Jobs | Tiền tố khóa BullMQ trong Redis. Demo đặt `bull-demo`, e2e `bull-e2e` để worker của môi trường này không nhận job của môi trường kia |
| `THROTTLE_PREFIX` | Tùy chọn | `throttle:` (`throttle-test:` khi `NODE_ENV=test`) | Throttler | Tiền tố bộ đếm giới hạn tốc độ trong Redis. Demo `throttle-demo:`, e2e `throttle-e2e:` |
| `HTTP_ERROR_LOG_FILE` | Tùy chọn | không | app.setup | Nếu đặt, ghi mọi response ≥ 400 (method, đường dẫn, status, mã lỗi) ra tệp. `scripts/e2e-real.mjs` bật để điều tra test fail (`.e2e-logs/api-errors.log`) |
| `UPLOAD_MAX_IMAGE_MB` | Tùy chọn | `5` | M05 | Ảnh thường |
| `UPLOAD_MAX_PANORAMA_MB` | Tùy chọn | `20` | M05, M13 | |
| `UPLOAD_MAX_MODEL_MB` | Tùy chọn | `100` | M12 | GLB (USDZ bị từ chối 415, AR đã loại bỏ theo D-P16) |
| `PG_HOST` | Tùy chọn | `localhost` | Script | Chỉ cho `scripts/db-reset.mjs` và `scripts/e2e-real.mjs`. Đặt `PG_HOST=127.0.0.1` khi `localhost` phân giải sang IPv6 (`::1`) mà cổng Postgres của Docker chỉ nhận IPv4 (gặp trên Windows khi `wslrelay.exe` chiếm `::1:55432`: Prisma báo "Can't reach database server"). Với Jest dùng thêm `E2E_DATABASE_URL=…@127.0.0.1:55432/aurelia_test` và `REDIS_HOST=127.0.0.1` |
| `MODEL_SERVE_MAX_MB` | Tùy chọn | `5` | M12 (job `model-processing`) | Ngưỡng cho mỗi tệp LOD dùng cho web (NFR02, D-N21, D-P10); vượt thì mô hình `failed`, ghi `activity_logs` và gửi thông báo admin. Đã có logic kiểm tra |

## 6. Email

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `MAIL_TRANSPORT` | Tùy chọn | `queue` | MailService (M02, M09) | `queue` = đẩy vào hàng đợi `mail`; `direct` = gửi SMTP ngay |
| `MAIL_HOST` | Tùy chọn | `localhost` | SmtpMailService | Mailpit khi dev; trong Docker tự đặt `mailpit` |
| `MAIL_PORT` | Tùy chọn | `1025` | SmtpMailService | |
| `MAIL_FROM` | Tùy chọn | `Aurelia Living <no-reply@aurelia.local>` | SmtpMailService | |
| `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT` | Tùy chọn | `1025`, `8025` | docker-compose | Cổng SMTP và giao diện Mailpit |
| `MAILPIT_API_URL` | Tùy chọn | `http://localhost:$MAILPIT_UI_PORT` | test e2e | Test kiểm tra thư đã tới |
| `E2E_MAILPIT_URL` | Tùy chọn | `http://localhost:8025` | test Playwright (`screens.spec.ts`) | Địa chỉ API Mailpit; đặt `http://127.0.0.1:8025` khi `localhost` phân giải sang IPv6 không tới được |

## 7. Thanh toán (giả lập + VNPay sandbox)

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `PAYMENT_SANDBOX_FAKE` | Tùy chọn | `false` | Payments | `true` = thanh toán online giả lập (chỉ dev/test; khách không chọn được kết quả, ghi chú đơn chứa `[fail]` ép thất bại). **`NODE_ENV=production` + `true` ⇒ API không khởi động.** Tắt ⇒ `POST /payments/:id/checkout` trả 503 cho tới khi có VNPAY |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | Tùy chọn | trống | Payments | Từ tài khoản sandbox VNPay. **Có cả hai** ⇒ `POST /payments/:id/checkout` (VNPAY/thẻ) tạo URL cổng có chữ ký HMAC-SHA512; thiếu ⇒ giả lập. Test dùng khóa giả |
| `VNPAY_URL` | Tùy chọn | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | Payments | Địa chỉ cổng thanh toán |
| `VNPAY_RETURN_URL` | Tùy chọn | `http://localhost:<PORT>/api/payments/vnpay/return` | Payments | Return URL (`GET /payments/vnpay/return`): khách từ cổng quay về, API ghi nhận kết quả rồi chuyển tới `APP_URL/checkout/success|failed`. Phải là địa chỉ công khai của API khi chạy thật |
| `VNPAY_IPN_URL` | Tùy chọn | trống | Payments | Chỉ để ghi nhớ: IPN (`GET /payments/vnpay/ipn`) được khai báo trên trang quản trị VNPAY, cần địa chỉ công khai (tunnel) |

## 8. Seed

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `SEED_SAMPLE` | Tùy chọn (production: **phải** `false`) | `true` | `prisma/seed.ts` | `false` = chỉ dữ liệu bắt buộc. Ở `NODE_ENV=production` seed **dừng và báo lỗi** nếu không đặt `false` (dữ liệu mẫu có tài khoản mật khẩu công khai) |
| `SEED_ADMIN_EMAIL` | Tùy chọn | `admin@aurelia.vn` | seed | |
| `SEED_ADMIN_PASSWORD` | Production: **Có** | `Admin@123456` (**chỉ dev**) | seed | Ở `NODE_ENV=production` thiếu/rỗng ⇒ seed **dừng, không dùng mật khẩu mặc định** (`apps/api/prisma/seed.ts`, hàm `main`) |
| `SEED_SAMPLE_USER_PASSWORD` | Tùy chọn | `User@123456` | seed | Chỉ khi nạp dữ liệu mẫu (không dùng ở production) |
| `SEED_SOURCE` | Tùy chọn | `mock` | seed | `mock` = seed từ dữ liệu giả của FE (giao diện giống hệt chế độ mock, admin `admin@aurelia.vn` / `admin123`); `legacy` = bộ mẫu cũ |
| `SEED_SKIP_MODEL_PROCESSING` | Tùy chọn | không đặt | seed | `true` = bỏ bước xử lý nền mô hình 3D mẫu (đủ 3 LOD, checksum) |

## 9. Web

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK` | Tùy chọn | `true` trong `apps/web/.env.example`; `false` trong `Dockerfile.web` | web (`src/services/api-client.ts`) | **Biến lúc BUILD** (nhúng vào mã; với Docker truyền bằng `--build-arg`, xem [DEPLOYMENT.md](DEPLOYMENT.md) mục 2). `true` = giao diện dùng dữ liệu giả chạy trong trình duyệt, không cần API. **`next build` (production) THẤT BẠI nếu `true`** (`apps/web/next.config.js`); dùng cho `next dev` và test giao diện. Playwright qua `npm run test:e2e:real` chạy với `false` |
| `NEXT_IGNORE_INCORRECT_LOCKFILE` | Tùy chọn | không đặt | Next.js | Đặt `1` khi `next build`/`next dev` báo "Failed to patch lockfile … reading 'os'" (lỗi đã biết của Next trong npm workspaces, **cần xác minh** nguyên nhân gốc). `playwright.config.ts` tự đặt `1` cho server test |
| `NEXT_DIST_DIR` | Tùy chọn | `.next` | `next.config.js` | Thư mục build riêng (e2e dùng `.next-e2e`) để không đè lên server dev |
| `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED` | Tùy chọn | không đặt (ẩn) | web (`GoogleButton.tsx`) | Chỉ `true` mới hiện nút "Đăng nhập/Đăng ký với Google". Đăng nhập Google CHƯA làm ở BE (`POST /auth/google` luôn 503) nên mặc định ẩn |
| `NEXT_PUBLIC_API_URL` | **Có** | không | toàn bộ web (`src/lib/env.ts`, `next.config.js`) | `http://localhost:4000`; thiếu thì web không khởi động. **Biến lúc BUILD** (nhúng vào mã): với Docker truyền `--build-arg NEXT_PUBLIC_API_URL=…`, thiếu ⇒ `Dockerfile.web` dừng ngay với thông báo rõ ràng |

## 10. Mobile (thuộc tính Gradle, không phải biến môi trường)

| Thuộc tính | Bắt buộc | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `ANDROID_HOME` hoặc `apps/mobile/local.properties` (`sdk.dir`) | **Có** khi build | không | Đường dẫn Android SDK |
| `JAVA_HOME` | **Có** khi build | không | JDK 21 (Android Studio JBR) |
| `-Paurelia.apiBaseUrl` | Tùy chọn | `http://10.0.2.2:4000/api/` | `BuildConfig.API_BASE_URL` của bản debug |
| `-Paurelia.releaseApiBaseUrl` | Tùy chọn | `https://api.aurelia.example/api/` | `BuildConfig.API_BASE_URL` của bản release (địa chỉ giữ chỗ) |

## 11. Quy tắc

- Mọi biến mà code đọc đều phải có trong `.env.example` và (với API) trong `env.validation.ts`. Thêm biến mới: sửa cả hai nơi và bảng này.
- Không đặt secret thật vào `.env.example`. Giá trị dev (như `aurelia` / `aurelia123`) chỉ dùng trên máy phát triển.
- Biến chỉ dùng cho Docker Compose (`API_PORT`, `POSTGRES_*`, `MINIO_*`, `MAILPIT_*`) không được code Nest đọc.
