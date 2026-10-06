# Aurelia Living

Website thương mại điện tử nội thất, tích hợp xem 3D, AR và không gian mẫu 360°. Monorepo gồm `apps/web` (Next.js), `apps/api` (NestJS + Prisma + PostgreSQL) và `apps/mobile` (Android).

## Cài đặt môi trường

> Mật khẩu và secret trong mục này **chỉ dùng cho máy local khi phát triển**. Không dùng cho môi trường thật.

### 1. Yêu cầu

- Node.js 24 (đang dùng v24.20.0) và npm 11
- Docker Desktop (đã chạy PostgreSQL 16 qua Docker, không cần cài PostgreSQL trên máy)

### 2. Cài thư viện

```powershell
npm install
```

### 3. Khởi động PostgreSQL

Mở Docker Desktop, chờ biểu tượng báo "running", rồi:

```powershell
npm run db:up
```

Lệnh này chỉ bật service `postgres` trong [docker-compose.yml](docker-compose.yml) (user/mật khẩu `aurelia`/`aurelia`, volume `postgres-data` giữ dữ liệu giữa các lần chạy). Bốn extension cần thiết (`citext`, `pg_trgm`, `unaccent`, `pgcrypto`) đã có sẵn trong image và được migration tự bật.

### 4. Tạo file `.env`

Copy `.env.example` thành `.env` ở **thư mục gốc** và thêm một bản **cùng nội dung** vào `apps/api/.env` (Prisma CLI đọc `apps/api/.env`, còn docker compose đọc `.env` ở gốc):

```powershell
Copy-Item .env.example .env
Copy-Item .env apps\api\.env
```

Sau đó sửa trong `.env` (rồi chép sang `apps/api/.env`):

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: thay bằng chuỗi ngẫu nhiên, ví dụ `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- Nếu cổng `5432` trên máy đã bị chiếm: đặt `POSTGRES_PORT=<cổng khác>` **và** đổi cổng trong `DATABASE_URL` cho khớp.
- Nếu muốn dùng tên CSDL khác (mặc định container tạo `aurelia_living`), sửa phần tên DB trong `DATABASE_URL`; DB phải tồn tại (`docker compose exec postgres psql -U aurelia -d postgres -c "CREATE DATABASE <ten>"`).
- Các biến dịch vụ ngoài (thanh toán MoMo/VNPay/ZaloPay, vận chuyển GHN/GHTK, SMTP, `OPENAI_API_KEY`...) chưa dùng ở giai đoạn này, để trống.

File `.env` đã nằm trong `.gitignore`: **không commit**.

### 5. Dựng CSDL

```powershell
npm run db:deploy   # áp migration (44 bảng, trigger, CHECK, index)
npm run db:seed     # vai trò, quyền, cấu hình, tài khoản admin + dữ liệu mẫu
```

`db:seed` chạy lại nhiều lần không lỗi và không nhân đôi dữ liệu. Đặt `SEED_SAMPLE=false` trong `.env` để chỉ seed dữ liệu bắt buộc.

### 6. Chạy API

```powershell
cd apps\api
npm run start:dev      # mặc định cổng 4000 (biến PORT)
```

### 7. Tài khoản mẫu (chỉ dev)

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| admin | `admin@aurelia.vn` | `Admin@123456` |
| user | `nguyenvana@example.com` | `User@123456` |
| user | `tranthib@example.com` | `User@123456` |

### 8. Script npm (thư mục gốc)

| Lệnh | Tác dụng |
| --- | --- |
| `npm run db:up` | Bật PostgreSQL (docker compose, chỉ service `postgres`) |
| `npm run db:down` | Tắt các container của compose (không xóa dữ liệu, không dùng `-v`) |
| `npm run db:status` | Xem trạng thái migration |
| `npm run db:deploy` | Áp các migration chưa chạy |
| `npm run db:seed` | Seed dữ liệu (idempotent) |
| `npm run db:studio` | Mở Prisma Studio để xem dữ liệu |
| `npm run db:reset` | **Xóa sạch** DB, dựng lại từ migration và seed lại (chỉ dev) |

### 9. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân / cách xử lý |
| --- | --- |
| `P1012` thiếu `DATABASE_URL` | Chưa có `apps/api/.env` hoặc thiếu biến. Làm lại bước 4 |
| `P1001` không kết nối được | Docker Desktop chưa chạy, container chưa lên (`npm run db:up`, `docker compose ps`), hoặc sai cổng giữa `POSTGRES_PORT` và `DATABASE_URL` |
| Cổng 5432 (hoặc 4000) bị chiếm | Máy đang có Postgres/ứng dụng khác. Xem `Get-NetTCPConnection -LocalPort 5432`; đặt `POSTGRES_PORT` khác như bước 4. API: đặt `PORT` khác |
| `EPERM` khi `npm install` | Tắt mọi dev server (`npm run start:dev`, `next dev`), đóng VS Code/terminal đang mở trong project, không để project trong thư mục OneDrive, tạm tắt Windows Defender real-time protection cho thư mục project, rồi chạy lại |
| Container trùng tên khi `db:up` | Đã có container cùng tên tạo bằng `docker run` hoặc từ project compose khác: `docker ps -a`. Dùng lại nó, hoặc xóa nó nếu chắc chắn không cần dữ liệu (`docker rm -f <ten>`). Không xóa volume khi chưa chắc |
| `migrate deploy` báo xung đột / drift | DB đã có bảng từ schema cũ. Dùng DB mới (tên khác trong `DATABASE_URL`) hoặc `npm run db:reset` nếu dữ liệu cũ không cần |

## Tài liệu CSDL

- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md): từ điển dữ liệu, ERD, trigger, ánh xạ bảng ↔ model Prisma
- [docs/QUY_UOC_CODE_DB.md](docs/QUY_UOC_CODE_DB.md): quy ước bắt buộc khi code với CSDL (ví dụ đúng/sai)
- [database/README.md](database/README.md): vai trò của thư mục `database/` và quy trình thay đổi CSDL qua Prisma Migrate
