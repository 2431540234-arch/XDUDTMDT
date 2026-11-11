# docs/api – đặc tả OpenAPI sinh từ code

Cập nhật lần cuối: 2026-11-11 – theo commit `c579fa8`.

[openapi.json](openapi.json) là spec OpenAPI 3.0 **xuất trực tiếp từ API đang chạy** (Swagger của NestJS, `apps/api/src/app.setup.ts`), không viết tay: 210 operation / 157 path, khớp đúng 210 dòng `Mapped {…}` khi API khởi động. Mô tả từng route nằm ở trường `summary` (tiếng Việt), quyền ở `security`.

**Giới hạn cần biết:** phần lớn `@Body()` khai báo kiểu `unknown` (kiểm tra thủ công bằng `FieldErrors`), nên spec **không có schema request/response chi tiết**; kiểu dữ liệu và quy tắc kiểm tra ở [API_CONTRACT.md](../API_CONTRACT.md) và [API_CONVENTIONS.md](../API_CONVENTIONS.md). Khi spec và tài liệu viết tay lệch nhau, code là nguồn đúng.

## Xuất lại spec

Swagger **tắt mặc định ở production** (`NODE_ENV=production`), bật mặc định ở development/test. Làm trên máy dev, với hạ tầng đang chạy (`npm run infra:up`):

```bash
# 1. dựng API (cần build một lần)
npm run build -w @aurelia-living/api

# 2. chạy API (cổng 4000 mặc định; đặt PORT nếu cổng bận), giữ NODE_ENV=development
cd apps/api && npx dotenv -e ../../.env -- node dist/main.js

# 3. ở cửa sổ khác: tải spec rồi dừng API
curl -s http://localhost:4000/docs-json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\n'))" > docs/api/openapi.json
```

Giao diện xem trực tiếp: `http://localhost:4000/docs`. Sau khi xuất lại, cập nhật số liệu ở đầu tệp này và đối chiếu bảng endpoint của [API_CONTRACT.md](../API_CONTRACT.md) (mục 4).

Ghi chú: lần xuất ngày 2026-11-11 chạy API một lần trên DB test (`aurelia_test`) rồi tắt ngay; spec không chứa dữ liệu, chỉ chứa cấu trúc route.
