# Triển khai (build, cấu hình và vận hành production)

> Cập nhật lần cuối: 2026-11-11 – theo commit `c579fa8`.
> Phạm vi: hướng dẫn **đúng với code hiện tại**. Chỗ chưa kiểm chứng trên môi trường thật ghi "Cần xác minh". Biến môi trường chi tiết: [ENVIRONMENT.md](ENVIRONMENT.md). Kiến trúc: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Thành phần cần chạy

| Thành phần | Bắt buộc | Ghi chú |
| --- | --- | --- |
| PostgreSQL 15+ | Có | Dùng `UNIQUE NULLS NOT DISTINCT`; đã chạy thử trên 16 |
| Redis | Có | Hàng đợi BullMQ, giới hạn tốc độ (`ThrottlerGuard`), cache catalog |
| MinIO hoặc S3 | Có (hoặc `STORAGE_DRIVER=local` cho thử nghiệm) | Ảnh, GLB, ảnh 360°; bucket public và private |
| SMTP | Có để gửi email | Xác thực email, quên mật khẩu |
| API (NestJS, cổng 4000) | Có | `apps/api`; worker BullMQ chạy **cùng tiến trình** API |
| Web (Next.js, cổng 3000) | Có | `apps/web` |
| Cổng thanh toán VNPay | Tùy chọn | Chưa có khóa thật thì chỉ dùng COD hoặc giả lập (không được giả lập ở production) |

## 2. Build

```bash
npm ci
npm run build -w @aurelia-living/api      # build shared-types rồi nest build (đầu ra apps/api/dist)
# Web: bắt buộc NEXT_PUBLIC_USE_MOCK=false; NEXT_PUBLIC_API_URL được nhúng vào mã lúc build
NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=https://api.example.com npm run build -w @aurelia-living/web
```

- **`next build` thất bại nếu `NEXT_PUBLIC_USE_MOCK=true`** (`apps/web/next.config.js`, kiểm `PHASE_PRODUCTION_BUILD`). Biến `NEXT_PUBLIC_*` được cố định vào mã lúc build; đổi địa chỉ API phải build lại.
- Lỗi đã biết trên một số máy (npm workspaces): `Failed to patch lockfile … reading 'os'`. Cách tránh: đặt `NEXT_IGNORE_INCORRECT_LOCKFILE=1` khi build. Nguyên nhân gốc: **Cần xác minh**.
- Dockerfile có sẵn: `infra/docker/Dockerfile.api` (build nhiều giai đoạn, chạy `prisma migrate deploy` rồi `node dist/main.js`), `Dockerfile.web`, `Dockerfile.worker`. **Cần xác minh:** `Dockerfile.web` không truyền `NEXT_PUBLIC_API_URL` lúc build nên cần bổ sung (`ENV`/`--build-arg`) thì `npm run build` trong container mới qua; chưa kiểm chứng.

## 3. Biến môi trường bắt buộc ở production

API **không khởi động** nếu cấu hình sai (`apps/api/src/config/env.validation.ts`). Tối thiểu:

| Biến | Yêu cầu ở production |
| --- | --- |
| `NODE_ENV=production` | Bật các ràng buộc bên dưới |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥ 16 ký tự, ngẫu nhiên (`openssl rand -hex 32`), khác nhau |
| `JWT_ACCESS_EXPIRES_IN` | Tối đa `15m` (vượt thì API không khởi động) |
| `PAYMENT_SANDBOX_FAKE=false` | **Bắt buộc** (`true` ở production thì API không khởi động: khách có thể tự đánh dấu đã thanh toán) |
| `CORS_ORIGINS`, `APP_URL` | Địa chỉ web thật |
| `REDIS_HOST`, `REDIS_PORT` | Redis thật |
| `STORAGE_DRIVER` + `S3_*`, `STORAGE_PUBLIC_URL` | `minio`/`s3` cần `S3_ENDPOINT`, khóa truy cập (kiểm tra ở `superRefine`) |
| `MAIL_TRANSPORT`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM` | SMTP thật |
| `VNPAY_*` | Chỉ khi bật thanh toán online |
| `SEED_ADMIN_PASSWORD` | Chỉ cho lần seed đầu (mục 5) |

**Swagger:** `SWAGGER_ENABLED` không đặt ⇒ **tắt ở production** (bật ở dev/test). Chỉ bật ở production khi đặt `SWAGGER_ENABLED=true` rõ ràng (không khuyến nghị).

**Bull Board** (`/admin/queues`) chỉ cho admin và nhận token qua `Authorization: Bearer`, cookie `bq_token` hoặc `?token=` (**token trên URL** có thể lọt vào nhật ký proxy/lịch sử trình duyệt: nên chặn đường dẫn này ở proxy hoặc không dùng `?token=`).

## 4. Cơ sở dữ liệu

```bash
npm run db:deploy        # prisma migrate deploy (áp các migration chưa áp)
```

- Trên DB đã có dữ liệu (ví dụ `aurelia_dev`): **sao lưu trước** (`pg_dump`). Migration `20261109010100_remove_ar` **xóa** dữ liệu AR (phiên AR, ảnh chụp AR, cờ `has_ar`, tệp usdz): đọc [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) mục 8.x và xin phép trước khi áp lên DB có dữ liệu thật.
- Kiểm tra lệch schema: `cd apps/api && npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (đầu ra rỗng = khớp).
- Không chạy `npm run db:reset` hoặc `scripts/db-reset.mjs` trên DB thật (script chỉ chấp nhận `aurelia_demo`/`aurelia_test`).

## 5. Seed production

Chỉ phần dữ liệu **bắt buộc** (vai trò, quyền, cấu hình, tài khoản admin), **không nạp dữ liệu mẫu**:

```bash
NODE_ENV=production SEED_SAMPLE=false \
SEED_ADMIN_EMAIL=admin@congty.vn SEED_ADMIN_PASSWORD='<mật khẩu mạnh>' \
npm run db:seed
```

- **Không còn mật khẩu mặc định ở production:** thiếu `SEED_ADMIN_PASSWORD` (hoặc rỗng) ⇒ seed dừng và báo lỗi; không đặt `SEED_SAMPLE=false` ⇒ seed dừng (dữ liệu mẫu có tài khoản với mật khẩu công khai như `admin123`, `User@123456`). Xem `apps/api/prisma/seed.ts` (hàm `main`).
- Seed idempotent (chạy lại không nhân đôi dữ liệu). Đổi mật khẩu admin sau lần đăng nhập đầu.

## 6. Khởi động và kiểm tra

```bash
cd apps/api && node dist/main.js        # hoặc: npm run start:prod -w @aurelia-living/api (cần dotenv nếu dùng .env gốc)
curl https://api.example.com/health      # { database, redis, storage, smtp, queues: up }
```

- `GET /health` trả trạng thái từng phụ thuộc và số job của hàng đợi.
- Hàng đợi `model-processing`, `image-processing`, mail, thông báo chạy trong cùng tiến trình API (worker tách riêng là hướng phát triển, xem [DAC_TA](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) mục 13).
- Ảnh/GLB: bucket public cho tệp công khai, bucket private cho mô hình gốc; trình duyệt tải thẳng lên MinIO/S3 bằng presigned URL nên **cần cấu hình CORS của bucket** cho địa chỉ web (đã kiểm bằng test `admin-minio`).

## 7. Danh sách kiểm tra trước khi mở ra Internet

- [ ] `NODE_ENV=production`, `PAYMENT_SANDBOX_FAKE=false`, secret JWT mạnh và khác nhau.
- [ ] `SWAGGER_ENABLED` không đặt (tắt) hoặc `false`.
- [ ] Seed production đã chạy với `SEED_ADMIN_PASSWORD` riêng và `SEED_SAMPLE=false`; mật khẩu admin đã đổi.
- [ ] Web build với `NEXT_PUBLIC_USE_MOCK=false` và `NEXT_PUBLIC_API_URL` đúng.
- [ ] CORS (`CORS_ORIGINS`) và CORS của bucket khớp địa chỉ web thật.
- [ ] Chặn hoặc bảo vệ `/admin/queues`; bật HTTPS ở proxy.
- [ ] Đăng nhập Google **chưa dùng được** (hoãn): nút ẩn mặc định, không bật `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED`.
- [ ] Sao lưu DB định kỳ; kiểm tra khôi phục.
