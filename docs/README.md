# Mục lục tài liệu (docs/)

> Cập nhật lần cuối: 2026-11-11 – theo commit `c579fa8`.
> Nguyên tắc: **code là nguồn sự thật**; tài liệu "sống" mô tả hiện trạng, "báo cáo lịch sử" là ảnh chụp tại thời điểm (không sửa). Lỗi đã biết và việc tồn đọng: [KNOWN_ISSUES.md](KNOWN_ISSUES.md). README gốc: [../README.md](../README.md).

## 1. Tài liệu sống (khớp code hiện tại)

| Tài liệu | Mô tả | Cập nhật |
| --- | --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Kiến trúc: thư mục, module BE, nhóm trang FE, luồng xác thực, cách FE gọi API, chế độ mock | 2026-11-11 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build, biến bắt buộc ở production, seed production, Swagger, danh sách kiểm tra trước khi mở ra Internet | 2026-11-11 |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Bảng biến môi trường (đối chiếu `env.validation.ts` và `.env.example`) | 2026-11-11 |
| [API_CONTRACT.md](API_CONTRACT.md) | Hợp đồng API FE ⇄ BE: bảng 210 endpoint, kiểu response, ghi chú triển khai | 2026-11-11 |
| [API_CONVENTIONS.md](API_CONVENTIONS.md) | Quy ước response/lỗi, mã lỗi, phân trang, phân quyền | 2026-11-11 |
| [api/openapi.json](api/openapi.json), [api/README.md](api/README.md) | Spec OpenAPI xuất từ code và cách xuất lại | 2026-11-11 |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Từ điển dữ liệu 59 bảng, ERD Mermaid, trigger, ánh xạ Prisma | 2026-11-11 |
| [CAU_TRUC_DB.md](CAU_TRUC_DB.md) | Mô tả nghiệp vụ từng bảng (8 nhóm) | 2026-11-11 |
| [QUY_UOC_CODE_DB.md](QUY_UOC_CODE_DB.md) | Quy ước bắt buộc khi code với CSDL | rà 2026-11-11 (không sửa) |
| [SHARED_TYPES_SYNC.md](SHARED_TYPES_SYNC.md) | Đồng bộ `packages/shared-types` với Prisma | 2026-11-11 |
| [DAC_TA_CHUC_NANG_THEO_VAI_TRO.md](DAC_TA_CHUC_NANG_THEO_VAI_TRO.md) | Đặc tả 80 UC theo vai trò; mục 15 "Đã loại bỏ" (AR), mục 16 "Bổ sung theo code" | 2026-11-11 |
| [DOI_CHIEU_UC.md](DOI_CHIEU_UC.md) | Trạng thái triển khai 70 UC trong phạm vi (bản sống) | 2026-11-11 |
| [CHUAN_MO_RONG.md](CHUAN_MO_RONG.md) | Những gì làm thêm hoặc giữ ngoài bộ tài liệu chuẩn | 2026-11-11 |
| [CONG_NGHE.md](CONG_NGHE.md) | Đối chiếu công nghệ và bảng công nghệ nộp giảng viên | 2026-11-11 |
| [BACKEND_DESIGN.md](BACKEND_DESIGN.md) | Thiết kế backend | 2026-11-11 |
| [DECISIONS.md](DECISIONS.md) | Nhật ký quyết định nghiệp vụ và kỹ thuật | 2026-11-11 |
| [BE_PROGRESS.md](BE_PROGRESS.md) | Nhật ký tiến độ backend và các đợt sửa | 2026-11-11 |
| [HUONG_DAN_DEMO.md](HUONG_DAN_DEMO.md) | Kịch bản demo web (khách và quản trị) | 2026-11-11 |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Lỗi đã biết, Google login (hoãn), backlog P2 | 2026-11-11 |

## 2. Báo cáo lịch sử (ảnh chụp tại thời điểm, không sửa)

| Tài liệu | Mô tả | Thời điểm |
| --- | --- | --- |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Kiểm toán toàn dự án (210 endpoint, 66 trang, 59 bảng, rủi ro, đề xuất P0/P1/P2) | 2026-11-10/11 |
| [FINAL_READY_TO_MERGE_REPORT.md](FINAL_READY_TO_MERGE_REPORT.md) | Kết luận READY TO MERGE, ma trận 70 UC, kết quả hai lượt kiểm thử | 2026-11-10 |
| [KET_QUA_KIEM_THU.md](KET_QUA_KIEM_THU.md) | Kết quả kiểm thử đợt kiểm tra cuối (commit `26f86d7`) | 2026-11-09 |
| [KET_QUA_KIEM_THU_HOAN_THIEN.md](KET_QUA_KIEM_THU_HOAN_THIEN.md) | Kết quả kiểm thử đợt hoàn thiện (commit `7ee4dd4`) | 2026-11-10 |

## 3. Thiết kế gốc và nộp giảng viên

| Tài liệu | Mô tả |
| --- | --- |
| [BAO_CAO_PHAN_TICH_THIET_KE.md](BAO_CAO_PHAN_TICH_THIET_KE.md) | Báo cáo phân tích và thiết kế nộp giảng viên (ảnh chụp tại thời điểm nộp; AR đã loại bỏ khỏi hệ thống) |
| [WIREFRAME.md](WIREFRAME.md) | Đặc tả wireframe (yêu cầu thiết kế gốc) |
| [wireframes/](wireframes/) | 54 ảnh wireframe (PNG) |
| [mockups-html/](mockups-html/) | 28 trang mockup HTML tham chiếu |
| [diagrams/](diagrams/README.md) | 152 sơ đồ UML (Mermaid, PNG, SVG) |

## 4. Lưu trữ

[archive/README.md](archive/README.md): 12 tài liệu không còn đúng hiện trạng (tiến độ cũ, prompt giao việc cho agent, báo cáo chụp tháng 10–11/2026, kế hoạch căn chỉnh DB), mỗi tệp có ghi chú lý do ở đầu.

## 5. Ngoài thư mục docs/

| Tệp | Ghi chú |
| --- | --- |
| [../README.md](../README.md) | Cài đặt, chạy dev, build, test, script npm |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Quy trình làm việc nhóm, quy ước commit |
| [../database/README.md](../database/README.md) | Hướng dẫn dựng DB, seed và quy trình migration (SQL tham khảo cũ đã gỡ 2026-11-11) |
| `apps/web/src/mock-data/README.md` | Dữ liệu giả của giao diện (chưa rà) |
