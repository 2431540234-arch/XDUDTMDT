# Kết quả kiểm thử đợt hoàn thiện sau kiểm toán (2026-11-10)

Bổ sung cho `KET_QUA_KIEM_THU.md` (đợt trước, commit `26f86d7`). Chạy **một lượt** trên commit `7ee4dd4` (nhánh `feature/backend`), cây làm việc sạch (`DIRTY=0`) lúc bắt đầu và kết thúc; 2026-11-10 01:07:17 → 01:33:34 (+07:00), 26 phút 17 giây. Chạy trên `aurelia_test` và bucket MinIO test; không áp migration và không ghi vào `aurelia_dev`, `aurelia_demo`, `aurelia_living`.

| Nhóm kiểm thử | Pass | Fail | Todo | Skip | Kết quả |
|---|---:|---:|---:|---:|---|
| Typecheck + lint (turbo, 6 tác vụ, `--force`) | 6 | 0 | 0 | 0 | Đạt |
| Unit web (vitest, 9 tệp) | 36 | 0 | 0 | 0 | Đạt |
| Unit API (jest, 16 suite) | 142 | 0 | 0 | 0 | Đạt |
| Migration dựng từ đầu (`db-reset`: toàn bộ migration + seed) | — | 0 | — | — | Đạt (34 user, 52 sản phẩm, 83 đơn) |
| Drift schema (`migrate diff` schema.prisma ↔ aurelia_test) | — | 0 | — | — | Rỗng, không lệch |
| Kiểu dùng chung (`types:check`) | — | 0 | — | — | Đồng bộ (25 enum, 59 entity) |
| Supertest (20 suite, `aurelia_test`) | 355 | 0 | 0 | 0 | Đạt |
| API MinIO (1 suite) | 7 | 0 | 0 | 0 | Đạt |
| Playwright API thật, 11 nhóm | 68 | 0 | 0 | 0 | Đạt |
| Playwright MinIO (`admin-minio`) | 2 | 0 | 0 | 0 | Đạt |

Playwright 11 nhóm: khach-hang 9, xem-360 25, admin-m2 3, admin-m3 3, admin-m4 5, admin-m5 6, admin-3d 4, admin-race 2, vat-lieu 2, phong-3d 3, ext-uc 6.

## Trung thực về quá trình

- Một lượt, không phải hai lượt liên tiếp như đợt trước.
- Lần chạy đầu trên `57f066b` có lỗi, đã xử lý rồi chạy lại TOÀN BỘ trên `7ee4dd4`:
  - Test hoàn tiền 00:30 (mock-m4) đỏ khi chạy trong khoảng 00:00–00:30 giờ VN, đạt khi chạy lúc 00:33. Đã sửa theo giả thuyết (không giả lập thời điểm tương lai so với đồng hồ thật); chưa tái hiện được lỗi gốc ngoài khung giờ đó.
  - `spaces360` (2 test) dựa vào thứ tự danh sách do lỗi sắp xếp chuỗi `Date` cũ; đã sửa test (tìm theo tên) và sửa lỗi sắp xếp.
  - `admin360` (xóa không gian ⇒ 404) đỏ ở 3 trong 4 lần chạy lẻ trước khi sửa sắp xếp theo `publishedAt ?? createdAt`, rồi đạt ở các lần sau; nguyên nhân gốc chưa được xác định chắc chắn, có thể còn flake.
- Lỗi môi trường (không phải lỗi mã): trên máy này `localhost` phân giải sang IPv6 (`::1`, bị `wslrelay.exe` chiếm) nên Postgres (55432), MinIO (9000), Mailpit (8025) không tới được. Khi chạy dùng `PG_HOST`, `REDIS_HOST`, `E2E_DATABASE_URL`, `S3_ENDPOINT`, `E2E_MAILPIT_URL` trỏ `127.0.0.1` (xem ENVIRONMENT.md). Các lần chạy trước khi đặt biến này bị lỗi kết nối hàng loạt hoặc MinIO bị bỏ qua và KHÔNG được tính là đạt.
- `aurelia_dev` KHÔNG được áp migration `remove_ar`.
