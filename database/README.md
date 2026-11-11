# database/

> Cập nhật lần cuối: 2026-11-11 – theo nhánh `fix/remaining-issues`.

Thư mục này **không còn chứa SQL**. Các tệp SQL tham khảo cũ (`00_reset.sql` … `07_sample_data.sql`, `run_all.sql`) đã được gỡ ngày 2026-11-11 vì lỗi thời (44 bảng thay vì 59, còn bảng AR đã bị loại bỏ) và không script/compose/CI nào dùng. Nội dung cũ vẫn nằm trong lịch sử git, ví dụ: `git log --diff-filter=D --name-only -- database/` rồi `git show <commit-trước-khi-gỡ>:database/03_tables.sql`.

## Cấu trúc CSDL ở đâu

| Cần gì | Xem ở |
| --- | --- |
| Cấu trúc thật (bảng, cột, quan hệ, enum) | [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) |
| Lịch sử thay đổi (kể cả trigger, CHECK, partial index) | [`apps/api/prisma/migrations/`](../apps/api/prisma/migrations) (`0_init` đến `20261109010100_remove_ar`) |
| Mô tả, từ điển dữ liệu, ERD | [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md), [`docs/CAU_TRUC_DB.md`](../docs/CAU_TRUC_DB.md) |
| Quy ước khi code với CSDL | [`docs/QUY_UOC_CODE_DB.md`](../docs/QUY_UOC_CODE_DB.md) |

## Dựng và seed

```bash
npm run infra:up          # postgres, redis, minio, mailpit
npm run db:deploy         # prisma migrate deploy: áp các migration chưa áp
npm run db:seed           # seed idempotent (vai trò, quyền, cấu hình, admin, dữ liệu mẫu)
```

- Seed production: bắt buộc `SEED_ADMIN_PASSWORD` và `SEED_SAMPLE=false` (xem [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) mục 5, biến ở [`docs/ENVIRONMENT.md`](../docs/ENVIRONMENT.md)).
- DB demo/test dựng lại từ đầu: `node scripts/db-reset.mjs aurelia_demo` (hoặc `aurelia_test`); script **chỉ** chấp nhận hai tên này. Không chạy lên `aurelia_dev` hay DB thật.

## Quy trình thay đổi CSDL

Mọi thay đổi làm qua Prisma Migrate trong `apps/api`:

```bash
# 1. Sửa prisma/schema.prisma (bảng, cột, quan hệ, index thường)
npx prisma migrate dev --name <mo_ta_ngan>

# 2. Với thứ Prisma KHÔNG biểu diễn được (CHECK, trigger, hàm, partial unique index,
#    index biểu thức/GIN, generated column, NULLS NOT DISTINCT, SET NULL (cột)):
npx prisma migrate dev --create-only --name <mo_ta_ngan>
#    -> mở prisma/migrations/<timestamp>_<ten>/migration.sql, thêm/sửa SQL bằng tay, rồi:
npx prisma migrate dev
```

- **Không dùng `prisma db push`** (sẽ xóa phần chỉ có trong migration SQL như trigger, CHECK, partial index).
- Luôn đọc lại SQL mà `migrate dev` sinh ra; không sửa migration đã áp dụng (kể cả `0_init`).
- Môi trường thật: `npx prisma migrate deploy`; sao lưu trước khi áp lên DB có dữ liệu.
- Kiểm tra không lệch: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (đầu ra rỗng = khớp).
- Sau khi đổi cấu trúc, cập nhật `docs/DATABASE_SCHEMA.md` và chạy `npm run types:generate`.
