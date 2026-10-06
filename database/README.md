# database/ – TÀI LIỆU THAM KHẢO

**Nguồn chuẩn của cấu trúc CSDL là [`apps/api/prisma`](../apps/api/prisma)** (`schema.prisma` + `migrations/`).
Thư mục này chỉ giữ bản SQL thuần để đọc, đối chiếu và dựng nhanh một DB thử bằng `psql`. **Đừng sửa cấu trúc ở đây rồi mong DB tự đổi theo.**

## Quan hệ giữa hai bên

| `database/` | `apps/api/prisma` |
| --- | --- |
| `01_extensions.sql` … `05_functions_triggers.sql` | `migrations/0_init/migration.sql` (nối nguyên văn 01 → 05 lúc baseline, không gồm seed) cộng các migration sau đó; `database/` được cập nhật tay cho khớp (ví dụ `media_file_size_int`) nên có thể chậm hơn migration |
| `06_seed.sql`, `07_sample_data.sql` | `seed.ts` (chạy bằng `npx prisma db seed`, idempotent) |
| `run_all.sql`, `00_reset.sql` | không dùng; dev dựng lại bằng `npx prisma migrate reset` |

Ở thời điểm baseline, `migrate deploy` trên DB trống cho kết quả giống hệt `run_all.sql` (`prisma migrate diff` rỗng và `pg_dump --schema-only` khác nhau chỉ ở bảng `_prisma_migrations`).

## Quy trình thay đổi CSDL từ nay

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

Quy tắc:

- **Không dùng `prisma db push`** (sẽ xóa phần chỉ có trong migration SQL như trigger, CHECK, partial index).
- Luôn đọc lại SQL mà `migrate dev` sinh ra trước khi chấp nhận; đừng để Prisma tự bỏ CHECK/trigger/index mà nó không nhìn thấy.
- Không sửa migration đã áp dụng (kể cả `0_init`); thay đổi mới = migration mới.
- Môi trường thật: `npx prisma migrate deploy`.
- Sau khi đổi cấu trúc, cập nhật `docs/DATABASE_SCHEMA.md`; có thể giữ `database/` đồng bộ nếu cần làm tài liệu, nhưng không bắt buộc.

## Dùng nhanh bản SQL thuần (chỉ để thử/đối chiếu)

```bash
createdb -U postgres aurelia_ref
psql -U postgres -d aurelia_ref -v ON_ERROR_STOP=1 -f database/run_all.sql
```

Quy ước bắt buộc khi code với CSDL (đúng/sai kèm ví dụ Prisma): [`docs/QUY_UOC_CODE_DB.md`](../docs/QUY_UOC_CODE_DB.md).

Xem mô tả đầy đủ (từ điển dữ liệu, ERD, trigger, nghiệp vụ Service, ánh xạ bảng ↔ model Prisma) tại [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md).
