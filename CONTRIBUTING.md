# Đóng góp mã nguồn

## Chuẩn bị môi trường

Xem [README.md](README.md) (mục "Chạy từ đầu trên máy mới"). Sau `npm install`, husky tự cài hook git.

## Nhánh

Không commit thẳng vào `main`. Tạo nhánh từ `main` theo mẫu `<loại>/<mô-tả-ngắn-kebab-case>`:

| Tiền tố     | Dùng cho                        | Ví dụ                    |
| ----------- | ------------------------------- | ------------------------ |
| `feat/`     | tính năng mới                   | `feat/auth-login`        |
| `fix/`      | sửa lỗi                         | `fix/cart-stock-check`   |
| `docs/`     | tài liệu                        | `docs/api-conventions`   |
| `refactor/` | tái cấu trúc, không đổi hành vi | `refactor/order-service` |
| `chore/`    | cấu hình, công cụ, phụ thuộc    | `chore/upgrade-prisma`   |
| `test/`     | chỉ thêm/sửa test               | `test/health-e2e`        |

## Commit (Conventional Commits)

Định dạng: `<loại>(<phạm vi tùy chọn>): <mô tả ngắn, thể hiện việc đã làm>`

```
feat(auth): đăng nhập bằng email và mật khẩu
fix(cart): chặn thêm quá số lượng tồn kho
docs: bổ sung quy ước API
```

Loại hợp lệ: `feat fix docs style refactor perf test build ci chore revert`. Tiêu đề tối đa 100 ký tự.
Hook `commit-msg` (commitlint) từ chối commit sai định dạng; hook `pre-commit` (lint-staged) chạy ESLint + Prettier trên file đã stage.

## Pull request

1. Nhánh cập nhật theo `main`, một PR làm một việc.
2. Trước khi mở PR chạy local và phải xanh: `npm run lint && npm run typecheck && npm test && npm run test:e2e` (e2e cần `npm run infra:up` và `docker compose --profile test up -d postgres-test`; xem README mục 6).
3. Mô tả PR gồm: mục đích, thay đổi chính, cách kiểm tra, ảnh hưởng DB (có migration không).
4. Đổi `schema.prisma` => tạo migration và chạy `npm run types:generate` (CI chạy `types:check` để bắt quên).
5. CI (GitHub Actions) phải xanh; cần ít nhất một người review trước khi merge. Ưu tiên squash merge, tiêu đề theo Conventional Commits.

## Quy ước code

- Quy ước response, lỗi, phân trang: [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md).
- Quy ước làm việc với DB (soft delete, transaction, trigger, Decimal): [docs/QUY_UOC_CODE_DB.md](docs/QUY_UOC_CODE_DB.md).
- Kiểu dùng chung FE/BE nằm ở `packages/shared-types`; `*.generated.ts` sinh từ Prisma, **không sửa tay**.
- Không commit bí mật: chỉ `.env.example` được theo dõi bởi git.
- Một module nghiệp vụ mới: `apps/api/src/modules/<tên>/` gồm controller, service, dto; controller admin đặt ở `admin-<tên>.controller.ts`.
