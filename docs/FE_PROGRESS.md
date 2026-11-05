# Tiến độ dựng Frontend theo wireframe (nhánh `feature/fe-wireframe-mock`)

> Mở phiên mới: "Đọc docs/FE_PROGRESS.md và tiếp tục từ bước đang dở theo docs/PROMPT_AGENT_FE.md".

## Trạng thái giai đoạn
| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1 | Đọc tài liệu docs/ | ✅ (đọc đầy đủ WIREFRAME/API/DECISIONS; các tài liệu UML lớn chỉ đọc mục lục) |
| 2 | Quét database | ✅ (44 bảng, enum, ERD) → `PROJECT_ANALYSIS.md` §3 |
| 3 | Quét backend | ✅ (BE chỉ là khung rỗng; API lấy từ thiết kế DAC_TA) → §4 |
| 4 | Quét frontend | ✅ (Next 14, toàn stub) → §5 |
| 5 | Báo cáo phân tích | ✅ `docs/PROJECT_ANALYSIS.md` |
| 6 | Design system | ✅ tokens, format/status utils, 16 UI primitives, Header/Footer, StoreLayout/AuthLayout/AccountLayout/AdminLayout, ProductCard/FilterSidebar/SortToolbar, CouponCard/OrderCard/ReviewCard/OrderStepper, DataTable/KpiCard/FilterBar/FormSection/UploadDropzone/ChartCard |
| 7 | mock-data + mock API | ⏳ |
| 8 | 54 màn hình | ⏳ |
| 9 | Kiểm tra & bàn giao | ⏳ |

## File cũ đã sửa (kèm lý do)
- `apps/web/src/styles/theme.ts`, `tailwind.config.ts`, `src/styles/globals.css`: thay 2 màu cũ bằng design tokens WIREFRAME 0.1 (đổi `primary` từ `#8B5E3C` sang `#8B4A2B`).
- `apps/web/src/lib/format.ts`, `src/store/{authStore,uiStore}.ts`, `src/services/*.ts`, `src/hooks/*.ts`, `src/components/{ui,layout,product}/*`, `src/types/*`: file khung 5 dòng được điền nội dung (không đổi tên).
- `apps/web/src/app/providers.tsx`: thêm `<Toaster />`.
- `apps/web/vitest.config.mts`: thêm alias `@` → `src` để test chạy được với import `@/…`.

## Thư viện thêm
_(chưa có)_

## Ghi chú / việc tồn đọng
- Không có dấu vết role "nhân viên" trong DB/BE/FE.
- Tài liệu UML lớn trong `docs/diagrams`, `BAO_CAO_…` chưa đọc từng dòng (không ảnh hưởng giao diện).
