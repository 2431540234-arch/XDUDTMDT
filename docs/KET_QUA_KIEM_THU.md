# Kết quả kiểm thử toàn bộ (đợt kiểm tra cuối)

Hai lượt chạy LIÊN TIẾP trên cùng một commit, không sửa gì giữa hai lượt (cây làm việc sạch lúc bắt đầu và kết thúc mỗi lượt, `DIRTY=0`).
Máy được chặn chế độ ngủ trong suốt thời gian chạy. Kiểm thử chạy trên `aurelia_test` (supertest, Playwright) và bucket MinIO test; không đụng
`aurelia_dev`, `aurelia_demo`, `aurelia_living`.

- **Commit được kiểm:** `26f86d7` (nhánh `feature/backend`).
- **Lượt 1:** 2026-11-09 17:44:20 → 18:08:12 (+07:00), 23 phút 52 giây.
- **Lượt 2:** 2026-11-09 18:08:13 → 18:32:39 (+07:00), 24 phút 26 giây.
- Các lượt chạy trước đó trên `4c07328` (17:00–17:39 cùng ngày) **đỏ ở cả hai lượt** do test `space-source.spec.ts` (Playwright không bắt được
  `sendBeacon` gửi lúc trang bị hủy). Đã sửa ở `26f86d7` (kiểm kết quả phía máy chủ) rồi chạy lại cả hai lượt từ đầu; bảng dưới là hai lượt SAU sửa.

| Nhóm | Lệnh | Lượt 1 | Lượt 2 |
|---|---|---|---|
| Typecheck + lint (turbo, `--force`) | `npx turbo run typecheck lint --force` | 6/6 task đạt | 6/6 task đạt |
| Unit web | `npm test -w @aurelia-living/web` | 30 test / 8 tệp, đạt | 30 test / 8 tệp, đạt |
| Unit API | `npm test -w @aurelia-living/api` | 142 test / 16 bộ, đạt | 142 test / 16 bộ, đạt |
| Supertest (aurelia_test, reset trước) | `npm run test:e2e:db -w @aurelia-living/api` | 239 test / 14 bộ, đạt | 239 test / 14 bộ, đạt |
| API MinIO | `npm run test:e2e:minio -w @aurelia-living/api` | 7 test / 1 bộ, đạt | 7 test / 1 bộ, đạt |
| Playwright API thật (11 nhóm) | `npm run test:e2e:real` | 11/11 nhóm đạt | 11/11 nhóm đạt |
| Playwright MinIO (trình duyệt) | `npm run test:e2e:real:minio` | 2 test, đạt | 2 test, đạt |
| Cổng 4002/3100 còn bị chiếm sau chạy | `netstat` | 0 | 0 |

## Chi tiết 11 nhóm Playwright (`test:e2e:real`), số test mỗi nhóm

| Nhóm | Số test | Lượt 1 | Lượt 2 |
|---|---|---|---|
| khach-hang | 9 | đạt | đạt |
| xem-360 | 25 | đạt | đạt |
| admin-m2 | 3 | đạt | đạt |
| admin-m3 | 3 | đạt | đạt |
| admin-m4 | 5 | đạt | đạt |
| admin-m5 | 4 | đạt | đạt |
| admin-3d | 4 | đạt | đạt |
| admin-race | 2 | đạt | đạt |
| vat-lieu | 2 | đạt | đạt |
| phong-3d (đặt mô hình 3D, đổi món, UC-SPACE-06) | 3 | đạt | đạt |
| ext-uc | 5 | đạt | đạt |

Tổng: **0 lỗi** ở cả hai lượt (Playwright 65 test API thật + 2 MinIO; supertest 239; API MinIO 7; unit 172).
