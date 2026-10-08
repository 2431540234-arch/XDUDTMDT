# Đồng bộ `packages/shared-types` với Prisma

## 1. Cách làm

- `enums.generated.ts` và `entities.generated.ts` **sinh tự động** từ `apps/api/prisma/schema.prisma` bằng `scripts/generate-shared-types.mjs` (`npm run types:generate`). Không sửa tay.
- Frontend **không phụ thuộc Prisma**: file sinh ra chỉ là TypeScript thuần (const object + union type + interface).
- `npm run types:check` thất bại nếu file sinh ra lệch schema; CI chạy lệnh này nên đổi `schema.prisma` mà quên sinh lại sẽ bị chặn.
- Quy tắc ánh xạ kiểu (kiểu mô tả dữ liệu **sau khi qua JSON**, không phải kiểu Prisma Client):

| Prisma               | shared-types                                          |
| -------------------- | ----------------------------------------------------- |
| `Int`                | `number`                                              |
| `String`, `Citext`   | `string`                                              |
| `Boolean`            | `boolean`                                             |
| `DateTime`           | `string` (ISO 8601 UTC)                               |
| `Decimal`            | `number` (API `serialize()` đổi trước khi trả)        |
| `Json`               | `JsonValue`                                           |
| `enum`               | const object + union type (dùng được ở runtime)       |
| trường `?`           | `T \| null`                                           |
| quan hệ (`@relation`) | bỏ qua (response nào cần lồng thì khai báo DTO riêng) |

- Trường nhạy cảm bị loại khỏi entity: `User.passwordHash`, `UserSession.refreshTokenHash`, `PasswordReset.tokenHash`.

## 2. Tách entity và DTO

| Loại                      | Vị trí                                                | Nguồn                           |
| ------------------------- | ----------------------------------------------------- | ------------------------------- |
| Entity (hình dạng bản ghi) | `entities.generated.ts`, `enums.generated.ts`        | Sinh từ Prisma                  |
| Response/Request API dùng chung | `api.ts`, `auth.types.ts`, `health.types.ts`, `error-codes.ts` | Viết tay                  |
| DTO của từng module       | Bổ sung vào shared-types khi frontend bắt đầu dùng, đặt `<module>.dto.ts`, tham chiếu entity bằng `Pick`/`Omit` | Viết tay |

## 3. Bảng khác biệt trước khi sửa

Hiện trạng cũ (viết tay, 5 file) so với schema Prisma (44 bảng, 18 enum):

| # | Loại lệch  | Kiểu cũ | Thực tế trong Prisma | Xử lý |
| - | ---------- | ------- | -------------------- | ----- |
| 1 | Sai kiểu   | `User.id: string` | `Int` (autoincrement); có thêm `uuid` | Thay bằng entity sinh |
| 2 | Sai enum   | `User.role: "customer" \| "admin"` | Không có cột role; vai trò qua `UserRole` → `Role.code` ∈ `admin`, `user`; không có "customer" | Bỏ `role`; thêm `RoleCode = 'admin' \| 'user'` và `AuthUser.roles` |
| 3 | Sai tên    | `User.name` | `fullName` | Thay bằng entity sinh |
| 4 | Thiếu      | `User` thiếu `phone`, `avatarMediaId`, `status`, `emailVerifiedAt`, `lastLoginAt`, `deletedAt`, `createdAt`, `updatedAt` | Có đủ | Entity sinh |
| 5 | Thừa/nhạy cảm | - | `passwordHash` tồn tại trong bảng, không được lộ ra FE | Sinh có chủ đích loại bỏ |
| 6 | Sai kiểu   | `Cart.userId: string`, `Cart.id` | `Int`; `carts.user_id` unique; item nằm ở `CartItem` (`variantId`, không phải `productId`; giá lấy từ biến thể, không lưu `price` trong item) | Entity `Cart`, `CartItem` sinh |
| 7 | Sai/thiếu  | `Cart.items[{productId, quantity, price}]` | `CartItem{cartId, variantId, quantity, ...}` | Bỏ kiểu lồng; DTO giỏ hàng định nghĩa khi làm module cart |
| 8 | Sai kiểu   | `Product.id: string`, `price` trực tiếp | `Int`; giá nằm ở `ProductVariant`; có `slug`, `status`, `has3dModel`, `hasAr`... | Entity sinh |
| 9 | Sai/thiếu  | `Product.images: string[]`, `model3dUrl?` | Ảnh qua `ProductImage` → `Media`; mô hình 3D là bảng riêng `Product3DModel` + `ModelFile` | Entity sinh |
| 10 | Sai kiểu  | `Space.id: string`, `panoramaUrl`, `hotspots[{position{x,y,z}}]` | `Space`/`SpaceScene`/`SpaceHotspot` dùng `yaw`/`pitch` (Decimal) chứ không phải x,y,z; ảnh qua `Media` | Entity sinh |
| 11 | Thiếu     | `AuthTokens` chỉ có token | Đúng hình dạng nhưng thiếu người dùng đăng nhập | `AuthTokens` giữ, thêm `AuthUser` |
| 12 | Thiếu     | Không có | 18 enum (`UserStatus`, `OrderStatus`, `PaymentStatus`...) | `enums.generated.ts` |
| 13 | Thiếu     | Không có | 39 bảng còn lại (Order, Coupon, Review, ArSession...) | Entity sinh (44 bảng) |
| 14 | Thiếu     | Không có kiểu response/lỗi/phân trang | Quy ước ở API_CONVENTIONS.md | `api.ts`, `error-codes.ts` |
| 15 | Hạ tầng   | Thiếu `package.json`, `tsconfig.json`; `apps/*` không khai báo phụ thuộc | - | Thêm package `@aurelia-living/shared-types` (build ra `dist`), `apps/api` và `apps/web` khai báo `"@aurelia-living/shared-types": "*"` |

Kết quả sau xử lý: 0 khác biệt giữa `schema.prisma` và entity/enum (`npm run types:check` xanh); các file viết tay cũ `cart.types.ts`, `product.types.ts`, `space.types.ts` bị xóa vì không còn đúng; `auth.types.ts` viết lại.

## 4. Quy trình khi đổi schema

1. Sửa `schema.prisma`, tạo migration (`prisma migrate dev`).
2. `npm run types:generate`, commit cả file sinh.
3. `npm run build:types` (hoặc `npm run build`) để cập nhật `dist` cho backend khi build/chạy.

## 5. Cách `apps/*` tham chiếu

- Backend/Web import `from '@aurelia-living/shared-types'`.
- Typecheck và Jest của API ánh xạ trực tiếp tới `packages/shared-types/src` (không cần build trước); build/runtime dùng `dist` nên `npm run build` tự build shared-types trước.
