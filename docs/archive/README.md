# docs/archive – tài liệu đã lưu trữ

Ngày lưu trữ: 2026-11-11 · Nhánh `docs/sync-with-code`.

Các tài liệu dưới đây **không còn phản ánh hiện trạng** của hệ thống nhưng được giữ lại làm lịch sử (không xóa). Mỗi file có một dòng ghi chú ở đầu nêu lý do lưu trữ; nội dung bên dưới giữ nguyên, không sửa. Muốn biết hiện trạng, xem [docs/README.md](../README.md).

| File | Lý do lưu trữ | Xem hiện trạng ở |
|---|---|---|
| [TIEN_DO.md](TIEN_DO.md) | Số liệu "Xong BE: 0 / 80 UC" (2026-10-09) không còn đúng | [DOI_CHIEU_UC.md](../DOI_CHIEU_UC.md) |
| [FE_PROGRESS.md](FE_PROGRESS.md) | Nhật ký giai đoạn dựng giao diện với dữ liệu giả; FE đã nối API thật | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| [PROMPT_AGENT_FE.md](PROMPT_AGENT_FE.md) | Lệnh giao việc cho agent dựng frontend | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| [PROMPT_360_SAN_PHAM.md](PROMPT_360_SAN_PHAM.md) | Lệnh giao việc cho agent làm "Xem 360°" (đã hoàn thành) | [CHUAN_MO_RONG.md](../CHUAN_MO_RONG.md) |
| [BAO_CAO_BUOC_2.md](BAO_CAO_BUOC_2.md) | Báo cáo đối chiếu "chờ duyệt, CHƯA sửa" ngày 2026-11-06; các điểm lệch đã xử lý | [DECISIONS.md](../DECISIONS.md) |
| [DOC_SYNC_REPORT.md](DOC_SYNC_REPORT.md) | Ảnh chụp đồng bộ tài liệu ngày 2026-10-09 | [README.md](../README.md) (mục lục) |
| [ENV_SETUP_REPORT.md](ENV_SETUP_REPORT.md) | Ảnh chụp cấu hình môi trường ngày 2026-10-09 | [ENVIRONMENT.md](../ENVIRONMENT.md) |
| [MODULE_ENV_REPORT.md](MODULE_ENV_REPORT.md) | Ảnh chụp module/môi trường ngày 2026-10-08 (44 bảng, 76 UC) | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| [READINESS_REPORT.md](READINESS_REPORT.md) | Đánh giá sẵn sàng viết code ngày 2026-10-09 (trước khi có backend) | [DOI_CHIEU_UC.md](../DOI_CHIEU_UC.md) |
| [ONBOARDING_NOTES.md](ONBOARDING_NOTES.md) | Ghi chú tiếp nhận ngày 2026-11-06 (44 bảng, Mốc 3) | [ARCHITECTURE.md](../ARCHITECTURE.md), [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) |
| [DB_ALIGNMENT_PLAN.md](DB_ALIGNMENT_PLAN.md) | Kế hoạch căn chỉnh DB ngày 2026-11-06 (44 bảng, có AR) đã thực hiện xong | [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) |
| [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Phân tích phục vụ dựng FE ngày 2026-11-05 (giai đoạn dữ liệu giả) | [ARCHITECTURE.md](../ARCHITECTURE.md), [API_CONTRACT.md](../API_CONTRACT.md) |

## Không nằm trong thư mục này

- `docs/PROMPT_AGENT_BE.md`: tệp làm việc cá nhân của máy phát triển, bị `.gitignore` chặn (không thuộc repo), nên không lưu trữ ở đây.
- `docs/aurelia_dev_backup.sql`: bản dump CSDL dev (UTF-16, 448 KB), đã gỡ khỏi repo ngày 2026-11-11 và chuyển ra `../aurelia-backups/` (ngoài repo). Nó chứa 3 hash mật khẩu bcrypt của tài khoản seed. `.gitignore` chặn `docs/**/*.sql` và `docs/**/*.dump`. Lịch sử git chưa được xử lý.
