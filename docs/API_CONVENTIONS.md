# Quy ước API

Áp dụng cho mọi endpoint của `apps/api`. Mã thực thi nằm ở `apps/api/src/common/` và kiểu dùng chung ở `packages/shared-types` (`api.ts`, `error-codes.ts`).

## 1. Quy ước chung

| Hạng mục           | Quy ước                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Tiền tố            | `/api` cho mọi endpoint, ngoại trừ `GET /health` (không có tiền tố). Swagger tại `/docs`.                                       |
| Đặt tên            | JSON và query dùng **camelCase** (`pageSize`, `createdAt`). Đường dẫn dùng danh từ số nhiều, kebab-case (`/api/product-models`). |
| Định danh công khai | API công khai dùng **slug** (`/api/products/:slug`); API đã đăng nhập/admin dùng `id` số nguyên.                                |
| Ngày giờ           | ISO 8601 **UTC**, ví dụ `2026-10-08T06:00:00.000Z`. Client tự đổi sang múi giờ hiển thị.                                        |
| Tiền               | **Số nguyên VND** (không thập phân), ví dụ `12500000`. Prisma `Decimal` được `serialize()` thành `number` ([QUY_UOC_CODE_DB](QUY_UOC_CODE_DB.md)). |
| Thông báo cho user | Tiếng Việt, đặt ở `error.message`, hiển thị trực tiếp được. Máy đọc `error.code`, không đọc `message`.                          |
| Xác thực           | Header `Authorization: Bearer <accessToken>`. Mọi endpoint cần token, trừ endpoint gắn `@Public()`.                             |
| Phân quyền         | Chỉ hai vai trò: `admin`, `user`. Khách vãng lai gọi endpoint `@Public()`. Dữ liệu cá nhân: user chỉ thấy của mình (xem mục 7). |
| Mã HTTP thành công | `200` đọc/sửa/xóa, `201` tạo mới. **Không dùng `204`** vì mọi response đều có thân; xóa trả `200` với `data: null`.              |

## 2. Response thành công

```json
{ "success": true, "data": { "id": 1, "name": "Sofa Oslo" } }
```

Danh sách có phân trang thêm `meta`:

```json
{
  "success": true,
  "data": [{ "id": 1 }, { "id": 2 }],
  "meta": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 }
}
```

- Không có dữ liệu trả về: `"data": null`.
- Trong controller chỉ **trả giá trị thô**; `TransformResponseInterceptor` tự bọc. Với danh sách phân trang trả `paginated(items, page, pageSize, total)`.
- Kiểu TypeScript: `ApiResponse<T>`, `PaginatedMeta` trong `@aurelia-living/shared-types`.

## 3. Response lỗi

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Dữ liệu không hợp lệ.",
    "details": { "email": ["Email không hợp lệ"], "quantity": ["quantity must not be less than 1"] }
  }
}
```

- `code`: giá trị của enum `ErrorCode` (mục 4), ổn định, dùng để client rẽ nhánh xử lý.
- `message`: tiếng Việt cho người dùng.
- `details` (tùy chọn):
  - `VALIDATION_FAILED`: `{ "<đường.dẫn.trường>": ["thông báo", ...] }`, trường lồng nhau dùng dấu chấm (`items.0.quantity`).
  - Lỗi khác: dữ liệu ngữ cảnh, ví dụ `CONFLICT` kèm `{ "fields": ["slug"] }`, `OUT_OF_STOCK` kèm `{ "variantId": 7, "available": 2 }`.
- Lỗi 5xx **không bao giờ** lộ nội dung lỗi nội bộ (stack, SQL); chi tiết chỉ ghi vào log máy chủ.
- Kiểu TypeScript: `ApiError`, `ApiErrorBody`, `ValidationDetails`.

### Cách ném lỗi trong code

```ts
throw new AppException(ErrorCode.OUT_OF_STOCK, 'Sản phẩm không đủ hàng.', { variantId, available });
```

HTTP status suy ra tự động từ `ERROR_HTTP_STATUS[code]`; **không** ném `HttpException` thủ công cho lỗi nghiệp vụ. Mọi lỗi khác (Prisma, validation, route không tồn tại, lỗi lạ) do `AllExceptionsFilter` quy đổi (mục 5).

## 4. Bảng mã lỗi

| Mã lỗi                     | HTTP | Khi nào dùng                                                                |
| -------------------------- | ---- | --------------------------------------------------------------------------- |
| `VALIDATION_FAILED`        | 400  | Body/query/param sai kiểu, thiếu trường, trường lạ. Kèm `details`.          |
| `BAD_REQUEST`              | 400  | Yêu cầu sai nhưng không phải lỗi từng trường (JSON hỏng, tham số mâu thuẫn). |
| `COUPON_INVALID`           | 400  | Mã giảm giá hết hạn, hết lượt, chưa đủ điều kiện áp dụng.                   |
| `AUTH_UNAUTHENTICATED`     | 401  | Thiếu token hoặc chưa đăng nhập.                                            |
| `AUTH_INVALID_CREDENTIALS` | 401  | Sai email hoặc mật khẩu (không tiết lộ sai cái nào).                        |
| `AUTH_TOKEN_EXPIRED`       | 401  | Access token hết hạn; client gọi refresh rồi thử lại.                       |
| `AUTH_TOKEN_INVALID`       | 401  | Token sai chữ ký/định dạng, refresh token bị thu hồi.                       |
| `AUTH_ACCOUNT_LOCKED`      | 403  | Tài khoản bị khóa/cấm (`users.status` khác `active`).                       |
| `AUTH_EMAIL_NOT_VERIFIED`  | 403  | Thao tác yêu cầu email đã xác minh (ví dụ viết đánh giá).                   |
| `FORBIDDEN`                | 403  | Đã đăng nhập nhưng không đủ vai trò/quyền.                                  |
| `PURCHASE_REQUIRED`        | 403  | Đánh giá khi chưa mua sản phẩm.                                             |
| `RESOURCE_NOT_FOUND`       | 404  | Không có bản ghi/route; cũng dùng khi user truy cập dữ liệu của người khác. |
| `CONFLICT`                 | 409  | Vi phạm ràng buộc duy nhất (Prisma `P2002`) hoặc xung đột chung.            |
| `EMAIL_ALREADY_EXISTS`     | 409  | Đăng ký với email đã có tài khoản.                                          |
| `OUT_OF_STOCK`             | 409  | Không đủ tồn kho khi thêm giỏ/đặt hàng.                                     |
| `INVALID_STATE`            | 409  | Sai trạng thái nghiệp vụ (hủy đơn đã giao, thanh toán đơn đã thanh toán).   |
| `RESOURCE_IN_USE`          | 409  | Xóa/đổi bản ghi đang được tham chiếu (Prisma `P2003`).                      |
| `PAYLOAD_TOO_LARGE`        | 413  | Body/tệp vượt giới hạn.                                                     |
| `UNSUPPORTED_MEDIA_TYPE`   | 415  | Loại tệp/Content-Type không được hỗ trợ.                                    |
| `RATE_LIMITED`             | 429  | Quá số lần cho phép (đăng nhập sai, gửi lại email...).                      |
| `INTERNAL_ERROR`           | 500  | Lỗi không lường trước.                                                      |
| `BAD_GATEWAY`              | 502  | Dịch vụ ngoài lỗi (SMTP, cổng thanh toán).                                  |
| `SERVICE_UNAVAILABLE`      | 503  | Mất kết nối DB hoặc phụ thuộc thiết yếu.                                    |

Thêm mã lỗi mới: sửa `packages/shared-types/src/error-codes.ts` (cả `ErrorCode` và `ERROR_HTTP_STATUS`), thêm vào bảng này; nếu cần thông báo mặc định thì thêm vào `MESSAGES` ở `all-exceptions.filter.ts`.

## 5. Quy đổi lỗi tự động (AllExceptionsFilter)

| Nguồn lỗi                                  | Kết quả                                                    |
| ------------------------------------------ | ---------------------------------------------------------- |
| `AppException`                             | Đúng mã/HTTP/`message`/`details` đã ném                    |
| Validation (`ValidationPipe` toàn cục)     | 400 `VALIDATION_FAILED`, `details` theo trường             |
| Prisma `P2002` (trùng unique)              | 409 `CONFLICT`, `details.fields`                           |
| Prisma `P2025` / `P2001` (không thấy)      | 404 `RESOURCE_NOT_FOUND`                                   |
| Prisma `P2003` (khóa ngoại)                | 409 `RESOURCE_IN_USE`                                      |
| Prisma khởi tạo/kết nối thất bại           | 503 `SERVICE_UNAVAILABLE`                                  |
| Route không tồn tại                        | 404 `RESOURCE_NOT_FOUND` ("Đường dẫn không tồn tại.")      |
| `HttpException` khác (401/403/429...)      | Mã tương ứng theo HTTP status                              |
| Lỗi lạ                                     | 500 `INTERNAL_ERROR`, thông báo chung, ghi log đầy đủ      |

Khi ném lỗi nghiệp vụ, ưu tiên ném `AppException` rõ ràng; chỉ dựa vào quy đổi Prisma cho các lỗi thật sự bất ngờ (ví dụ race condition ở unique).

## 6. Phân trang, sắp xếp, lọc (query string)

| Tham số    | Mặc định | Ghi chú                                                                       |
| ---------- | -------- | ----------------------------------------------------------------------------- |
| `page`     | 1        | Bắt đầu từ 1.                                                                 |
| `pageSize` | 20       | Tối đa 100.                                                                   |
| `sort`     | tùy API  | `truong:asc` hoặc `truong:desc`, ví dụ `sort=price:asc`. Mỗi API liệt kê trường được phép sắp xếp (whitelist, không truyền thẳng vào Prisma). |
| Bộ lọc     | -        | Mỗi bộ lọc một tham số riêng, camelCase: `?category=sofa&minPrice=1000000&has3d=true`. Boolean: `true`/`false`. |
| Tìm kiếm   | -        | `q=<từ khóa>`.                                                                |

Dùng `PaginationQueryDto` (`src/common/dto/pagination.dto.ts`) làm lớp cha cho query DTO, có sẵn `skip`/`take`. Ví dụ:

```ts
@Get()
async list(@Query() q: ProductQueryDto) {
  const [items, total] = await this.service.findAll(q);
  return paginated(items, q.page, q.pageSize, total);
}
```

> Sơ đồ/đặc tả cũ có chỗ ghi `limit=`; quy ước hiện hành là `pageSize`.

## 7. Xác thực, phân quyền, quyền sở hữu

- `JwtAuthGuard` và `RolesGuard` đăng ký **toàn cục** (thứ tự: xác thực rồi phân quyền).
- `@Public()` bỏ qua xác thực. `@Roles('admin')` giới hạn vai trò. `@CurrentUser()` / `@CurrentUser('id')` lấy `{ id, roles }` từ token.
- Access token JWT: payload `{ sub: <userId>, roles: ['user'|'admin'] }`, hạn 15 phút. Refresh token 7 ngày, xoay vòng, lưu băm trong `user_sessions`.
- Dữ liệu cá nhân (giỏ, đơn, địa chỉ...): trong service dùng `assertOwnerOrAdmin(user, record.userId)` cho một bản ghi và `ownerScope(user)` làm điều kiện `where` cho danh sách. Không sở hữu thì trả **404** (không phải 403) để không lộ sự tồn tại của bản ghi.
- Endpoint quản trị: controller `Admin<X>Controller` trong `admin-<module>.controller.ts`, đặt `@Roles('admin')` ở cấp class, URL bắt đầu `/api/admin/...`.
- Thao tác ghi của admin ghi nhật ký qua `ActivityLogService.log({ actorId, action: 'product.update', targetType, targetId, changes })`, nên truyền `tx` để cùng transaction.

## 8. Tệp, hàng đợi và email

### 8.1. StorageService

Module nghiệp vụ chỉ inject `STORAGE_SERVICE` (`upload`, `download`, `delete`, `head`, `getUrl`, `presignPut`, `presignGet`); driver chọn bằng `STORAGE_DRIVER`: `minio` (mặc định dev), `s3` (production, cùng lớp S3-compatible, chỉ khác biến môi trường: bỏ `S3_ENDPOINT`, đặt `S3_REGION`, `S3_FORCE_PATH_STYLE=false`, bỏ khóa nếu dùng IAM role), `local` (dự phòng).

- Hai bucket: **`aurelia-public`** (ảnh, panorama, mô hình đã xử lý; đọc ẩn danh) và **`aurelia-private`** (tệp gốc chờ xử lý, ảnh AR chưa công khai; chỉ truy cập qua presigned GET).
- `media.file_path` lưu **object key** (ví dụ `images/2026/10/<uuid>.png`), không lưu URL. URL công khai = `STORAGE_PUBLIC_URL` + `/` + key (`storage.getUrl(key)`).
- Driver `local` không hỗ trợ presigned URL (lưu trong `<STORAGE_LOCAL_DIR>/public` và `/private`).

### 8.2. Hai cách tải tệp lên

| Loại | Giới hạn | Cách | Luồng |
| --- | --- | --- | --- |
| Ảnh thường | `UPLOAD_MAX_IMAGE_MB` = 5 | Qua API (multipart, bộ nhớ) | `POST /api/admin/media` (trường `file`) → API ghi bucket public → tạo `media` → job `image-processing` |
| Panorama | `UPLOAD_MAX_PANORAMA_MB` = 20 | Presigned PUT vào bucket public | `POST /api/admin/media/presign` → trình duyệt `PUT` → `POST /api/admin/media/confirm` |
| Mô hình 3D (GLB/USDZ) | `UPLOAD_MAX_MODEL_MB` = 100 | Presigned PUT vào bucket **private** | `POST /api/admin/models/:id/files/presign` → trình duyệt `PUT` → `POST /api/admin/models/:id/files/confirm` (202) → job `model-processing` |

Quy tắc presigned PUT:

1. Bước **presign** kiểm tra quyền admin, loại tệp và dung lượng khai báo (vượt giới hạn: `413 PAYLOAD_TOO_LARGE`; sai loại: `415 UNSUPPORTED_MEDIA_TYPE`) rồi trả `{ key, uploadUrl, method: 'PUT', headers, expiresIn }`. URL hiệu lực `PRESIGN_EXPIRES_SECONDS` (900 giây) và **ký cả `Content-Type` lẫn `Content-Length`**, nên client phải gửi đúng header trong `headers` và đúng dung lượng.
2. Client `PUT` thẳng lên MinIO, không qua API (MinIO bật CORS cho `CORS_ORIGINS`).
3. Bước **confirm** `head` tệp trên kho (tồn tại, dung lượng thật) rồi tạo bản ghi/đẩy job. Chưa có tệp: `404`.

Kiểu dùng chung: `PresignUploadRequest`, `PresignedUpload`, `ConfirmUploadRequest`, `PresignModelFileRequest`, `ConfirmModelFileRequest`, `ModelProcessingAccepted` (`packages/shared-types/src/upload.types.ts`).

### 8.3. Hàng đợi (BullMQ + Redis)

- Có 4 queue: `model-processing`, `image-processing`, `mail`, `notification`. Đẩy job qua `JobsService` (`enqueueModel`, `enqueueImage`, `enqueueMail`, `enqueueNotification`); không dùng BullMQ trực tiếp ở module nghiệp vụ.
- Queue `model-processing`: kiểm tra GLB, đo số đa giác/kích thước texture, sinh LOD high/medium/low, nén Meshopt, SHA-256 → ghi `model_files`, đặt `Product3DModel.status` = `ready`/`failed`. USDZ: chỉ kiểm tra ZIP + checksum.
- Queue `image-processing`: tạo `<key>.webp` và `<key>_thumb.webp` bằng `sharp`.
- Queue `mail`: gửi email thật qua SMTP (`SmtpMailService`). Queue `notification`: khung, hiện chỉ ghi log; M09 sẽ tạo bản ghi `notifications`.
- Mỗi job thử lại 3 lần, backoff mũ; tệp hỏng không thử lại; job thất bại được giữ để xem tại **Bull Board** `/admin/queues` (chỉ admin: header `Authorization: Bearer`, cookie `bq_token`, hoặc `?token=` lần đầu).
- Worker chạy cùng tiến trình API; processor chỉ gọi `ModelProcessingService`/`ImageProcessingService` nên tách sang `apps/worker` không cần sửa logic.
- Redis dùng cho: hàng đợi BullMQ, bộ đếm giới hạn tốc độ và cache (mục 8.6). **Không** lưu phiên đăng nhập hay OTP: phiên (`user_sessions`) và đặt lại mật khẩu (`password_resets`) nằm ở PostgreSQL (DECISIONS D-T29).

### 8.3a. Giới hạn tốc độ (`@nestjs/throttler`, bộ đếm trong Redis, theo IP)

| Nhóm | Áp dụng | Mặc định | Biến |
| --- | --- | --- | --- |
| `default` | Mọi route | 120 yêu cầu / 60 giây | `THROTTLE_DEFAULT_LIMIT`, `THROTTLE_DEFAULT_TTL_SECONDS` |
| `auth` | Chỉ route gắn `@AuthThrottle()` (đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu) | 10 yêu cầu / 60 giây | `THROTTLE_AUTH_LIMIT`, `THROTTLE_AUTH_TTL_SECONDS` |

- Vượt giới hạn: `429 RATE_LIMITED` theo định dạng lỗi chuẩn.
- Header trong mọi response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (giây) cho nhóm `default`; nhóm `auth` thêm hậu tố `-auth` (`X-RateLimit-Limit-auth`...). Khi bị chặn có thêm `Retry-After` (và `Retry-After-auth`).
- M02 chỉ cần gắn `@AuthThrottle()` (`src/common/decorators/throttle.decorators.ts`), không cấu hình thêm.

### 8.4. Email

Module nghiệp vụ inject `MAIL_SERVICE` (`send`). Dev: thư vào Mailpit, xem tại http://localhost:8025. Cách gửi chọn bằng `MAIL_TRANSPORT`: `queue` (mặc định) đẩy job vào hàng đợi `mail`, request không chờ SMTP, lỗi SMTP được thử lại 3 lần với backoff mũ; `direct` gửi SMTP ngay trong request (dùng khi cần kết quả đồng bộ). Lỗi gửi không được làm hỏng luồng nghiệp vụ chính.

### 8.5. Kiểm tra sức khỏe

`GET /health` (không tiền tố `/api`, công khai) kiểm tra PostgreSQL, Redis, kho tệp (MinIO/S3), SMTP và hàng đợi:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 29,
    "timestamp": "2026-10-09T05:50:33.968Z",
    "checks": { "database": "up", "redis": "up", "storage": "up", "smtp": "up", "queues": "up" },
    "queues": { "model-processing": { "waiting": 0, "active": 0, "delayed": 0, "failed": 0 }, "image-processing": {}, "mail": {}, "notification": {} }
  }
}
```

Nếu một thành phần `down`: `503 SERVICE_UNAVAILABLE` kèm `details.checks` cho biết thành phần nào hỏng. Kiểu: `HealthStatus` (`packages/shared-types/src/health.types.ts`).

### 8.6. Cache (Redis)

`CacheService` (`src/cache/`): `get`, `set` (có TTL), `del`, `delByPrefix` (SCAN, không dùng KEYS), `getOrSet`. Khóa có tiền tố `CACHE_KEY_PREFIX`; TTL mặc định `CACHE_DEFAULT_TTL_SECONDS`; tắt hẳn bằng `CACHE_ENABLED=false`. Lỗi Redis không làm hỏng request (coi như cache miss, ghi log). Quy ước khóa: `<nhóm>:<định danh>`, ví dụ `categories:tree`, `products:featured`, `settings:public`, `pages:<slug>`, `products:<slug>`. Admin sửa dữ liệu thì xóa theo tiền tố (`delByPrefix('products:')`). TTL gợi ý: danh mục 10 phút, sản phẩm nổi bật 2 phút, settings công khai 10 phút, trang tĩnh 10 phút, chi tiết sản phẩm 1 phút (DECISIONS D-T30). Không cache dữ liệu theo người dùng (giỏ, đơn). Hiện chưa module nghiệp vụ nào gọi.

## 9. Kiểm thử một endpoint mới

- Unit test `*.spec.ts` cạnh code (không cần DB). E2E trong `apps/api/test/*.e2e-spec.ts` dùng DB test riêng (`docker compose --profile test up -d postgres-test`).
- E2E luôn kiểm tra: định dạng thành công, một lỗi validation, 401 khi thiếu token, 403/404 theo phân quyền/sở hữu.
