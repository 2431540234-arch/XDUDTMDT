# Aurelia Living

Website thương mại điện tử nội thất, tích hợp xem 3D, AR và không gian mẫu 360°. Monorepo gồm `apps/web` (Next.js), `apps/api` (NestJS + Prisma + PostgreSQL) và `apps/mobile` (Android).

## Chạy từ đầu trên máy mới

> Mật khẩu và secret trong mục này **chỉ dùng cho máy local khi phát triển**. Không dùng cho môi trường thật.

### 1. Yêu cầu

- Node.js 22 trở lên (khai báo `engines` trong `package.json`, file `.nvmrc` = 22; máy dev đang dùng Node 24) và npm 11.19 (`packageManager`)
- Docker Desktop (PostgreSQL 16, Redis, MinIO và Mailpit chạy bằng Docker, không cần cài riêng)
- Git

### 2. Lấy mã và cài thư viện

```bash
git clone <repo> && cd XDUDTMDT
npm install          # cài workspace + husky (hook git)
```

### 3. Tạo file `.env` (chỉ MỘT file, ở thư mục gốc)

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Không cần `apps/api/.env`: API, Prisma CLI (qua `dotenv-cli` trong các script `db:*`), seed, test và web (qua `@next/env` trong `apps/web/next.config.js`) đều đọc `.env` ở gốc.

Sửa trong `.env`:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: chuỗi ngẫu nhiên tối thiểu 16 ký tự (`openssl rand -hex 32`). Backend **từ chối khởi động** nếu thiếu/ngắn và in rõ biến nào sai. Web từ chối khởi động nếu thiếu `NEXT_PUBLIC_API_URL`.
- Cổng mặc định: **API 4000, web 3000, Redis 6379, MinIO API 9000, MinIO Console 9001**. Máy đã có Redis khác chiếm 6379: đặt `REDIS_PORT=6380` (cả `.env` lẫn compose đọc biến này). Nếu bị chiếm, đổi đồng bộ `PORT`, `API_PORT`, `NEXT_PUBLIC_API_URL`, `STORAGE_PUBLIC_URL`, `CORS_ORIGINS`. PostgreSQL: `POSTGRES_PORT` và cổng trong `DATABASE_URL`; Mailpit: `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT`.
- Biến `VNPAY_*` để trống cho tới khi làm module thanh toán.

`.env` đã nằm trong `.gitignore`: **không commit**. Giải thích từng biến: [.env.example](.env.example).

### 4. Bật hạ tầng, dựng CSDL

```bash
npm run infra:up      # postgres + redis + minio + minio-init (chạy một lần, tạo 2 bucket) + mailpit
npm run db:deploy     # áp migration (44 bảng, trigger, CHECK, index)
npm run db:seed       # vai trò, quyền, cấu hình, admin (+ dữ liệu mẫu; tệp mẫu được tải lên MinIO)
```

`infra:up` dùng `--no-recreate` nên không đụng container cũ đang chạy. `db:seed` chạy lại nhiều lần không lỗi và không tải trùng tệp. Đặt `SEED_SAMPLE=false` để chỉ seed dữ liệu bắt buộc; email/mật khẩu admin lấy từ `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (production bắt buộc tự đặt mật khẩu).

**Dịch vụ dev và địa chỉ** (cổng theo giá trị mặc định):

| Dịch vụ                   | Địa chỉ                                                       | Tài khoản dev                                                      |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| API                       | http://localhost:4000 (Swagger: `/docs`, kiểm tra: `/health`) | admin: bảng mục 7                                                  |
| MinIO Console             | http://localhost:9001                                         | `aurelia` / `aurelia123` (= `S3_ACCESS_KEY` / `S3_SECRET_KEY`)     |
| MinIO S3 API              | http://localhost:9000                                         | như trên; bucket `aurelia-public` (đọc ẩn danh), `aurelia-private` |
| Redis                     | `localhost:6379` (máy này 6380)                               | không mật khẩu                                                     |
| Mailpit (xem email)       | http://localhost:8025 (SMTP 1025)                             | không                                                              |
| Bull Board (xem hàng đợi) | http://localhost:4000/admin/queues                            | cần token admin, xem bên dưới                                      |
| PostgreSQL                | `localhost:5432`                                              | `aurelia` / `aurelia`                                              |

Ảnh MinIO: Docker Hub `minio/minio` và `quay.io/minio/minio` đã bị upstream gỡ, compose dùng `bitnamilegacy/minio:2025.4.22-debian-12-r2` (bản cuối còn Console web). Chi tiết: [docs/DECISIONS.md](docs/DECISIONS.md) D-T23.

**Xem hàng đợi (Bull Board):** đăng nhập admin lấy access token, rồi mở `http://localhost:4000/admin/queues?token=<accessToken>` (lần đầu; server đặt cookie để các trang sau không cần token) hoặc gửi header `Authorization: Bearer <token>`. Job thất bại được giữ lại để xem lỗi và thử lại.

### 5. Chạy API

Cách A, trên máy host (dev, có hot reload):

```bash
npm run build:types                    # build gói shared-types lần đầu
npm run start:dev -w @aurelia-living/api
npm run dev -w @aurelia-living/web      # web tại http://localhost:3000 (trang quản trị: /admin/...)
```

Cách B, trong Docker (cả PostgreSQL, Mailpit, API; API tự chạy `migrate deploy` khi khởi động):

```bash
docker compose up -d --build           # thêm --no-recreate nếu đã có container cũ cần giữ
```

Kiểm tra: `curl http://localhost:4000/health` (cổng `API_PORT`, mặc định 4000). Swagger: http://localhost:4000/docs. Xem email dev: http://localhost:8025.

### 6. Kiểm tra chất lượng và test

```bash
docker compose --profile test up -d postgres-test     # DB riêng cho e2e (cổng 5433, dữ liệu trong RAM)
# e2e còn cần redis + minio đang chạy (npm run infra:up); test dùng bucket aurelia-test-* và tiền tố Redis riêng
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

### 7. Tài khoản mẫu (chỉ dev)

| Vai trò | Email                    | Mật khẩu       |
| ------- | ------------------------ | -------------- |
| admin   | `admin@aurelia.vn`       | `Admin@123456` |
| user    | `nguyenvana@example.com` | `User@123456`  |
| user    | `tranthib@example.com`   | `User@123456`  |

### 8. Script npm (thư mục gốc)

| Lệnh                                     | Tác dụng                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run lint` / `lint:fix`              | ESLint toàn monorepo                                                                             |
| `npm run format` / `format:check`        | Prettier                                                                                         |
| `npm run typecheck`                      | Kiểm tra kiểu mọi package (turbo)                                                                |
| `npm test` / `npm run test:e2e`          | Unit test / e2e (cần `postgres-test`)                                                            |
| `npm run build`                          | Build tất cả (shared-types trước)                                                                |
| `npm run types:generate` / `types:check` | Sinh / kiểm tra kiểu từ `schema.prisma` ([docs/SHARED_TYPES_SYNC.md](docs/SHARED_TYPES_SYNC.md)) |
| `npm run infra:up` / `infra:down`        | Bật postgres, redis, minio, minio-init, mailpit (không tạo lại container cũ) / dừng              |
| `npm run docker:up` / `docker:down`      | Bật tất cả (kể cả API trong Docker) / tắt compose                                                |
| `npm run db:up`                          | Bật riêng service `postgres`                                                                     |
| `npm run db:status` / `db:deploy`        | Trạng thái / áp migration                                                                        |
| `npm run db:seed`                        | Seed dữ liệu (idempotent)                                                                        |
| `npm run db:studio`                      | Prisma Studio                                                                                    |
| `npm run db:reset`                       | **Xóa sạch** DB, dựng lại và seed lại (chỉ dev)                                                  |

Quy trình làm việc nhóm: [CONTRIBUTING.md](CONTRIBUTING.md).

### 9. Xử lý lỗi thường gặp

| Lỗi                                   | Nguyên nhân / cách xử lý                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P1012` thiếu `DATABASE_URL`          | Chưa có `.env` ở thư mục gốc hoặc thiếu `DATABASE_URL`. Làm lại bước 3                                                                                                                                                      |
| `P1001` không kết nối được            | Docker Desktop chưa chạy, container chưa lên (`npm run db:up`, `docker compose ps`), hoặc sai cổng giữa `POSTGRES_PORT` và `DATABASE_URL`                                                                                   |
| Cổng 5432 (hoặc 4000) bị chiếm        | Máy đang có Postgres/ứng dụng khác. Xem `Get-NetTCPConnection -LocalPort 5432`; đặt `POSTGRES_PORT` khác như bước 4. API: đặt `PORT` khác                                                                                   |
| `EPERM` khi `npm install`             | Tắt mọi dev server (`npm run start:dev`, `next dev`), đóng VS Code/terminal đang mở trong project, không để project trong thư mục OneDrive, tạm tắt Windows Defender real-time protection cho thư mục project, rồi chạy lại |
| Container trùng tên khi `db:up`       | Đã có container cùng tên tạo bằng `docker run` hoặc từ project compose khác: `docker ps -a`. Dùng lại nó, hoặc xóa nó nếu chắc chắn không cần dữ liệu (`docker rm -f <ten>`). Không xóa volume khi chưa chắc                |
| `migrate deploy` báo xung đột / drift | DB đã có bảng từ schema cũ. Dùng DB mới (tên khác trong `DATABASE_URL`) hoặc `npm run db:reset` nếu dữ liệu cũ không cần                                                                                                    |

## Tài liệu

- [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md): định dạng response/lỗi, mã lỗi, phân trang, phân quyền
- [docs/TIEN_DO.md](docs/TIEN_DO.md): tiến độ theo module và theo từng use case
- [docs/DECISIONS.md](docs/DECISIONS.md): nhật ký quyết định nghiệp vụ và kỹ thuật (Redis + MinIO + BullMQ, VNPay sandbox, ...)
- [docs/MODULE_ENV_REPORT.md](docs/MODULE_ENV_REPORT.md): 14 module và tình trạng môi trường
- [docs/SHARED_TYPES_SYNC.md](docs/SHARED_TYPES_SYNC.md): kiểu dùng chung FE/BE sinh từ Prisma

## Tài liệu CSDL

- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md): từ điển dữ liệu, ERD, trigger, ánh xạ bảng ↔ model Prisma
- [docs/QUY_UOC_CODE_DB.md](docs/QUY_UOC_CODE_DB.md): quy ước bắt buộc khi code với CSDL (ví dụ đúng/sai)
- [database/README.md](database/README.md): vai trò của thư mục `database/` và quy trình thay đổi CSDL qua Prisma Migrate
