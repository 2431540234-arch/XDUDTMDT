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
| `SWAGGER_ENABLED` | Tùy chọn | `true` | M01 | Bật Swagger tại `/docs`; nên `false` ở production |

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
| `JWT_ACCESS_EXPIRES_IN` | Tùy chọn | `15m` | M02 | Chưa có chỗ đọc, M02 sẽ dùng |
| `JWT_REFRESH_EXPIRES_IN` | Tùy chọn | `7d` | M02 | như trên |

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
| `CACHE_KEY_PREFIX` | Tùy chọn | `aurelia:cache:` | CacheService | Tiền tố mọi khóa cache |
| `CACHE_DEFAULT_TTL_SECONDS` | Tùy chọn | `300` | CacheService | TTL khi gọi `set` không nêu TTL |

## 5. Lưu trữ tệp (MinIO / S3)

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
| `MINIO_PORT`, `MINIO_CONSOLE_PORT` | Tùy chọn | `9000`, `9001` | docker-compose | Cổng MinIO API và Console trên máy host |
| `UPLOAD_MAX_IMAGE_MB` | Tùy chọn | `5` | M05 | Ảnh thường |
| `UPLOAD_MAX_PANORAMA_MB` | Tùy chọn | `20` | M05, M13 | |
| `UPLOAD_MAX_MODEL_MB` | Tùy chọn | `100` | M12 | GLB/USDZ |

## 6. Email

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `MAIL_TRANSPORT` | Tùy chọn | `queue` | MailService (M02, M09) | `queue` = đẩy vào hàng đợi `mail`; `direct` = gửi SMTP ngay |
| `MAIL_HOST` | Tùy chọn | `localhost` | SmtpMailService | Mailpit khi dev; trong Docker tự đặt `mailpit` |
| `MAIL_PORT` | Tùy chọn | `1025` | SmtpMailService | |
| `MAIL_FROM` | Tùy chọn | `Aurelia Living <no-reply@aurelia.local>` | SmtpMailService | |
| `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT` | Tùy chọn | `1025`, `8025` | docker-compose | Cổng SMTP và giao diện Mailpit |
| `MAILPIT_API_URL` | Tùy chọn | `http://localhost:$MAILPIT_UI_PORT` | test e2e | Test kiểm tra thư đã tới |

## 7. Thanh toán (VNPay sandbox, chưa dùng cho đến M10)

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | Tùy chọn | trống | M10 | Lấy từ tài khoản sandbox VNPay |
| `VNPAY_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL` | Tùy chọn | trống | M10 | URL hợp lệ nếu đặt; IPN cần địa chỉ công khai (tunnel) |

## 8. Seed

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `SEED_SAMPLE` | Tùy chọn | `true` | `prisma/seed.ts` | `false` = chỉ dữ liệu bắt buộc |
| `SEED_ADMIN_EMAIL` | Tùy chọn | `admin@aurelia.vn` | seed | |
| `SEED_ADMIN_PASSWORD` | Production: **Có** | `Admin@123456` (dev) | seed | Production bắt buộc tự đặt |
| `SEED_SAMPLE_USER_PASSWORD` | Tùy chọn | `User@123456` | seed | |

## 9. Web

| Biến | Bắt buộc | Mặc định | Module dùng | Ví dụ / ghi chú |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Có** | không | toàn bộ web (`src/lib/env.ts`, `next.config.js`) | `http://localhost:4000`; thiếu thì web không khởi động |

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
