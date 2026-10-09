# Quy ước bắt buộc khi code với CSDL

Áp dụng cho mọi code truy cập CSDL (`apps/api`, Prisma Client 5). Mô tả schema đầy đủ: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). Mỗi mục dưới đây có ví dụ **ĐÚNG** (✅) và **SAI** (❌).

Ví dụ giả định `prisma` là `PrismaClient` (hoặc `tx` trong `prisma.$transaction`).

## Mục lục

1. [Tìm user theo email](#1-tìm-user-theo-email)
2. [Không gán `OrderItem.lineTotal`](#2-không-gán-orderitemlinetotal)
3. [Tiền và số thập phân (Decimal)](#3-tiền-và-số-thập-phân-decimal)
4. [Xóa mềm](#4-xóa-mềm)
5. [Nghiệp vụ KHÔNG có trigger: Service tự làm trong transaction](#5-nghiệp-vụ-không-có-trigger-service-tự-làm-trong-transaction)
6. [Việc trigger đã làm: KHÔNG code lặp lại](#6-việc-trigger-đã-làm-không-code-lặp-lại)
7. [Thêm migration có CHECK / partial index / trigger](#7-thêm-migration-có-check--partial-index--trigger)
8. [Phân quyền: 2 vai trò và khách vãng lai](#8-phân-quyền-2-vai-trò-và-khách-vãng-lai)

---

## 1. Tìm user theo email

`User.email` **không có `@unique`** trong Prisma: DB chỉ ràng buộc duy nhất trên tài khoản chưa xóa mềm (partial unique index `uq_users_email_active`), mà Prisma không biểu diễn được. Email là `citext` nên so sánh đã không phân biệt hoa thường.

```ts
// ✅ ĐÚNG
const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

// ❌ SAI: findUnique không có khóa duy nhất 'email' (lỗi kiểu), và sẽ khớp cả tài khoản đã xóa mềm
const user = await prisma.user.findUnique({ where: { email } });

// ❌ SAI: quên lọc deletedAt, tài khoản đã xóa vẫn đăng nhập được
const user = await prisma.user.findFirst({ where: { email } });

// ❌ SAI: tự lower-case/so sánh phân biệt hoa thường; cột citext đã xử lý
const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } }); // thừa, dễ lệch với dữ liệu cũ
```

Đăng ký: kiểm tra trùng bằng đúng truy vấn ✅ ở trên rồi mới tạo; vẫn bắt lỗi `P2002` (vi phạm unique) phòng hai request đồng thời. Chỉ user `status = 'active'` và `deletedAt = null` mới được đăng nhập.

## 2. Không gán `OrderItem.lineTotal`

`order_items.line_total` là **generated column** (`unit_price * quantity`, STORED). Prisma Client thấy nó như cột thường (`Decimal?`) nhưng PostgreSQL từ chối mọi lệnh ghi.

```ts
// ✅ ĐÚNG: chỉ gán đơn giá và số lượng, đọc lineTotal sau khi tạo
await prisma.orderItem.create({
  data: { orderId, variantId, productName, sku, unitPrice, quantity },
});

// ❌ SAI: lỗi "cannot insert a non-DEFAULT value into column line_total"
await prisma.orderItem.create({
  data: { orderId, variantId, productName, sku, unitPrice, quantity, lineTotal: unitPrice * quantity },
});

// ❌ SAI: cũng không update
await prisma.orderItem.update({ where: { id }, data: { lineTotal: 0 } });
```

Cần tổng tiền dòng để tính `Order.subtotal` thì tự tính ở Service (`unitPrice × quantity`) hoặc đọc `lineTotal` sau khi insert. Nhớ `orders.total = subtotal - discount_amount + shipping_fee` được CSDL kiểm tra (CHECK), sai là bị từ chối.

## 3. Tiền và số thập phân (Decimal)

Mọi cột `NUMERIC` (tiền, `ratingAvg`, `yaw`, `pitch`, `scale`...) là `Prisma.Decimal`. `JSON.stringify` mặc định biến Decimal thành **chuỗi**, nên API **luôn trả `number`** bằng `.toNumber()`. Dùng sẵn tiện ích chung [`src/common/utils/serialize.ts`](../apps/api/src/common/utils/serialize.ts):

| Hàm | Dùng khi |
| --- | --- |
| `toNumber(d)` | một giá trị, giữ `null` |
| `toMoney(d)` | một giá trị tiền, `null` thành `0` |
| `serialize(obj)` | cả object/mảng kết quả Prisma (đệ quy; giữ nguyên `Date`) |

```ts
import { serialize, toMoney } from '../../common/utils/serialize';

// ✅ ĐÚNG: serialize ở ranh giới trả về của controller/service công khai
async getOrder(id: number) {
  const order = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  return serialize(order); // total: 14050000, items[0].unitPrice: 10900000 ...
}

// ✅ ĐÚNG: tính toán tiền bằng Decimal rồi mới đổi sang number để trả
const subtotal = items.reduce((s, i) => s.add(i.unitPrice.mul(i.quantity)), new Prisma.Decimal(0));

// ❌ SAI: trả thẳng Decimal => client nhận chuỗi "14050000.00"
return order;

// ❌ SAI: tính tiền bằng number của JS (sai số dấu phẩy động) rồi ghi lại DB
const subtotal = items.reduce((s, i) => s + i.unitPrice.toNumber() * i.quantity, 0);
```

Quy tắc: **tính bằng `Prisma.Decimal`, trả ra bằng `number`**. Không dùng `parseFloat`/`Number()` rải rác; không format tiền ở backend (để client định dạng VND).

## 4. Xóa mềm

- **User**: chỉ xóa mềm bằng `deletedAt = now()` **và** `status = 'banned'`. Xóa cứng bị DB chặn khi user còn đơn hàng hoặc lượt dùng mã (`RESTRICT`), và nếu xóa được thì kéo theo giỏ, địa chỉ, đánh giá, ảnh AR...
- **Product** (bảng có `deletedAt` còn lại): cũng xóa mềm bằng `deletedAt = now()`. Nên đặt thêm `status = 'archived'` để ẩn ở mọi nơi lọc theo trạng thái.
- **Mọi truy vấn danh sách / tìm kiếm / đếm** trên bảng có `deletedAt` phải lọc `deletedAt: null`, kể cả `include`/`_count`/quan hệ lồng nhau.

```ts
// ✅ ĐÚNG
await prisma.user.update({
  where: { id },
  data: { deletedAt: new Date(), status: 'banned' },
});
// đồng thời thu hồi phiên đăng nhập
await prisma.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

const products = await prisma.product.findMany({
  where: { deletedAt: null, status: 'published', categoryId },
});

// ❌ SAI: xóa cứng
await prisma.user.delete({ where: { id } });
await prisma.product.delete({ where: { id } });

// ❌ SAI: danh sách không lọc deletedAt, sản phẩm đã xóa vẫn hiện
const products = await prisma.product.findMany({ where: { status: 'published' } });

// ❌ SAI: đếm người dùng gồm cả tài khoản đã xóa
const total = await prisma.user.count();
```

Gợi ý: định nghĩa hằng `const NOT_DELETED = { deletedAt: null } as const;` và trải vào `where`, để không ai quên. Khi xóa mềm email, tài khoản mới được phép đăng ký lại cùng email (do partial unique index chỉ tính bản ghi chưa xóa).

## 5. Nghiệp vụ KHÔNG có trigger: Service tự làm trong transaction

CSDL **không** có trigger cho các việc sau; Service phải làm trong **một** `prisma.$transaction` (hoặc không có gì được ghi). CSDL chỉ chặn trạng thái sai cuối cùng (tồn kho âm, trùng `(coupon, order)`, `total` sai).

### 5.1. Trừ / hoàn tồn kho kèm `inventory_movements`

Trừ bằng `updateMany` có điều kiện `gte` (nguyên tử, không bị bán vượt khi hai đơn đồng thời), kiểm tra `count`, rồi ghi movement.

```ts
// ✅ ĐÚNG
await prisma.$transaction(async (tx) => {
  for (const it of items) {
    const r = await tx.productVariant.updateMany({
      where: { id: it.variantId, isActive: true, stockQuantity: { gte: it.quantity } },
      data: { stockQuantity: { decrement: it.quantity } },
    });
    if (r.count !== 1) throw new ConflictException(`Không đủ tồn kho cho ${it.sku}`);
    await tx.inventoryMovement.create({
      data: { variantId: it.variantId, type: 'sale', quantityChange: -it.quantity, referenceCode: order.orderCode },
    });
  }
});
// Hủy/hoàn đơn: cộng lại + movement type 'return' (quantityChange dương)

// ❌ SAI: đọc rồi ghi (race condition), không ghi movement, ngoài transaction
const v = await prisma.productVariant.findUnique({ where: { id } });
await prisma.productVariant.update({ where: { id }, data: { stockQuantity: v.stockQuantity - qty } });
```

### 5.2. Tăng `sold_count`

Khi đơn **hoàn tất** (`completed`), cùng transaction với việc đổi trạng thái; giảm khi hoàn tiền nếu nghiệp vụ yêu cầu.

```ts
// ✅ ĐÚNG
await tx.order.update({ where: { id }, data: { status: 'completed' } });
for (const it of items) {
  await tx.product.update({ where: { id: it.productId }, data: { soldCount: { increment: it.quantity } } });
}

// ❌ SAI: tính lại bằng cách đọc-cộng-ghi, hoặc tăng ngay khi đặt hàng rồi quên trừ khi hủy
```

### 5.3. Kiểm tra và ghi lượt dùng coupon

Kiểm tra: `isActive`, thời gian hiệu lực, `minOrderValue`, `usageLimit`, `perUserLimit`; ghi `couponUsage` và tăng `usedCount` cùng transaction với tạo đơn. Giữ chỗ lượt dùng bằng `updateMany` có điều kiện.

```ts
// ✅ ĐÚNG
await prisma.$transaction(async (tx) => {
  const coupon = await tx.coupon.findFirst({ where: { code, isActive: true } }); // citext: không phân biệt hoa thường
  const now = new Date();
  if (!coupon || coupon.startsAt > now || (coupon.endsAt && coupon.endsAt < now)) throw new BadRequestException('Mã không hợp lệ');
  if (subtotal.lt(coupon.minOrderValue)) throw new BadRequestException('Chưa đạt giá trị tối thiểu');
  if (coupon.perUserLimit !== null) {
    const used = await tx.couponUsage.count({ where: { couponId: coupon.id, userId } });
    if (used >= coupon.perUserLimit) throw new BadRequestException('Bạn đã dùng hết lượt');
  }
  const reserved = await tx.coupon.updateMany({
    where: { id: coupon.id, ...(coupon.usageLimit !== null && { usedCount: { lt: coupon.usageLimit } }) },
    data: { usedCount: { increment: 1 } },
  });
  if (reserved.count !== 1) throw new BadRequestException('Mã đã hết lượt');
  // ... tạo order (discountAmount tính theo type/value/maxDiscount) ...
  await tx.couponUsage.create({ data: { couponId: coupon.id, userId, orderId: order.id } });
});

// ❌ SAI: chỉ tăng usedCount, không ghi couponUsage (mất kiểm soát perUserLimit)
// ❌ SAI: kiểm tra ở ngoài transaction rồi mới ghi (hai request cùng lúc vượt giới hạn)
// ❌ SAI: cho khách vãng lai áp mã (phải đăng nhập, userId bắt buộc)
```

### 5.4. "Đã mua mới được đánh giá"

`reviews.order_id` chỉ là khóa ngoại tùy chọn; CSDL không kiểm tra user có mua hay không.

```ts
// ✅ ĐÚNG: đơn của chính user, đã hoàn tất, có chứa sản phẩm
const purchased = await prisma.order.findFirst({
  where: { id: orderId, userId, status: 'completed', items: { some: { variant: { productId } } } },
  select: { id: true },
});
if (!purchased) throw new ForbiddenException('Chỉ người đã mua mới được đánh giá');
await prisma.review.create({ data: { userId, productId, orderId, rating, content } }); // status mặc định 'pending'

// ❌ SAI: nhận orderId từ client và ghi thẳng
await prisma.review.create({ data: { userId, productId, orderId: dto.orderId, rating: dto.rating } });
```

Duyệt review (admin) chỉ cần đổi `status = 'approved'`; điểm trung bình do trigger tính (mục 6). Trùng `(userId, productId, orderId)` sẽ bị `P2002`.

## 6. Việc trigger đã làm: KHÔNG code lặp lại

Code lặp lại sẽ ghi đè hoặc gây sai lệch/đua dữ liệu.

| Việc | Trigger | KHÔNG làm trong code |
| --- | --- | --- |
| `updated_at` | `trg_<bảng>_set_updated_at` (mọi bảng có `updated_at`) | tự gán `updatedAt: new Date()` |
| `Product.ratingAvg`, `ratingCount` | `trg_reviews_refresh_rating` (chỉ review `approved`) | tính/ghi lại trung bình khi duyệt review |
| `Product.has3dModel`, `hasAr` | `trg_product_3d_models_refresh_flags`, `trg_model_files_refresh_flags` | bật/tắt cờ khi thêm model/file |
| `Space.viewCount` | `trg_space_views_increase_count` | `viewCount: { increment: 1 }` |
| `OrderStatusHistory` | `trg_orders_log_status_insert/update` (kể cả lúc tạo đơn) | `orderStatusHistory.create(...)` khi đổi trạng thái |
| Vai trò `user` khi đăng ký | `trg_users_assign_default_role` (deferred, chạy lúc commit) | `userRole.create` cho user thường |

```ts
// ✅ ĐÚNG: duyệt review, trigger lo điểm trung bình
await prisma.review.update({ where: { id }, data: { status: 'approved' } });

// ❌ SAI: tự cập nhật điểm (đua với trigger, lệch số liệu)
await prisma.product.update({ where: { id: productId }, data: { ratingAvg: newAvg, ratingCount: n } });

// ✅ ĐÚNG: ghi lượt xem; viewCount tự tăng
await prisma.spaceView.create({ data: { spaceId, userId, visitorId, sourceProductId } });
// ❌ SAI
await prisma.space.update({ where: { id: spaceId }, data: { viewCount: { increment: 1 } } });

// ✅ ĐÚNG: đổi trạng thái đơn; lịch sử tự ghi. Muốn lưu NGƯỜI thực hiện, đặt biến phiên trong CÙNG transaction
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${String(adminId)}, true)`;
  await tx.$executeRaw`SELECT set_config('app.status_note', ${note}, true)`; // tùy chọn
  await tx.order.update({ where: { id }, data: { status: 'confirmed' } });
});
// ❌ SAI: tự ghi lịch sử (trùng dòng)
await prisma.orderStatusHistory.create({ data: { orderId: id, fromStatus, toStatus, changedBy: adminId } });

// ✅ ĐÚNG: đăng ký, không gán vai trò (trigger gán 'user' lúc commit)
await prisma.user.create({ data: { fullName, email, passwordHash } });
// ❌ SAI: gán vai trò 'user' thủ công (thừa); và đừng giả định userRole đã có ngay trong cùng transaction
```

Ngoại lệ có chủ ý: tạo **admin** thì tạo user và `userRole` (`admin`) trong **cùng** `$transaction`; trigger deferred thấy đã có vai trò nên không gán thêm `user` (xem `prisma/seed.ts`).

`Product.has3dModel`/`hasAr`/`ratingAvg`/`ratingCount` và `Space.viewCount` do DB quản lý: coi như **chỉ đọc** trong code.

## 7. Thêm migration có CHECK / partial index / trigger

Prisma không biểu diễn CHECK, partial unique index, index biểu thức/GIN, generated column, `NULLS NOT DISTINCT`, trigger/hàm. Cách làm:

```bash
# ✅ ĐÚNG
cd apps/api
npx prisma migrate dev --create-only --name <mo_ta_ngan>
#   mở prisma/migrations/<timestamp>_<ten>/migration.sql, ĐỌC LẠI, thêm/sửa SQL bằng tay, rồi:
npx prisma migrate dev
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script   # phải rỗng

# ❌ SAI: bỏ cờ --create-only rồi nhận SQL tự sinh khi thay đổi có CHECK/trigger
# ❌ SAI: prisma db push (xóa phần chỉ có trong migration SQL: trigger, CHECK, partial index)
# ❌ SAI: sửa migration đã áp dụng (0_init, media_file_size_int...): luôn tạo migration mới
```

Quy tắc kèm theo:

- Luôn đọc SQL Prisma sinh ra; nếu thấy `DROP INDEX`/`DROP CONSTRAINT` cho thứ bạn không định xóa thì dừng lại sửa.
- Đặt tên theo quy ước: `pk_`, `fk_<bảng>_<cột>`, `uq_`, `ck_`, `idx_`; `ON DELETE` ghi lý do trong comment SQL.
- Kèm `COMMENT ON` tiếng Việt cho bảng/cột mới; cập nhật [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) (và `database/` nếu còn dùng làm tham chiếu).
- Mỗi trigger/CHECK/partial index mới thêm một dòng `///` ghi chú trên model trong `schema.prisma`.
- Trigger mới: dùng `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` trước `CREATE TRIGGER`; không viết trigger cho các việc ở mục 5.

## 8. Phân quyền: 2 vai trò và khách vãng lai

Hệ thống chỉ có **2 vai trò trong CSDL**: `admin` và `user` (bảng `roles`). **Khách vãng lai không có tài khoản**, không được lưu và không có vai trò. Không thêm vai trò khác (staff, editor, customer, guest).

| Đối tượng | Được gọi |
| --- | --- |
| Khách vãng lai (không token) | Chỉ API **đọc công khai** (sản phẩm `published` chưa xóa mềm, 3D/AR, không gian mẫu, trang tĩnh, review `approved`, ảnh AR `isPublic`, danh mục, thương hiệu, cấu hình công khai) và API **xác thực**: đăng ký, đăng nhập, quên/đặt lại mật khẩu, làm mới token. Được ghi thống kê ẩn danh `ArSession`/`SpaceView` kèm `visitorId` (UUID do client tạo, `userId = null`) |
| `user` | Dữ liệu **của chính mình**: giỏ hàng, đặt hàng, áp coupon, đánh giá, yêu thích, sổ địa chỉ, ảnh AR, bookmark không gian mẫu, thông báo, hồ sơ |
| `admin` | Toàn bộ quản trị, kiểm tra thêm quyền chi tiết (`manage_users`, `manage_products`, `view_orders`, `process_orders`, `manage_content`, `manage_settings`) |

```ts
// ✅ ĐÚNG: lọc theo user của token, KHÔNG nhận userId từ body/query
@UseGuards(JwtAuthGuard)
@Get('orders')
list(@CurrentUser() user: AuthUser) {
  return this.orders.listByUser(user.id); // where: { userId: user.id }
}

// ✅ ĐÚNG: tài nguyên theo id phải kiểm tra chủ sở hữu (chống đọc đơn người khác)
const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
if (!order) throw new NotFoundException();

// ✅ ĐÚNG: route quản trị dùng RolesGuard (+ kiểm tra quyền chi tiết)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Patch('orders/:id/status') ...

// ❌ SAI: tin userId do client gửi
const cart = await prisma.cart.findUnique({ where: { userId: dto.userId } });

// ❌ SAI: lấy theo id không kiểm tra chủ sở hữu
const order = await prisma.order.findUnique({ where: { id } });

// ❌ SAI: route giỏ hàng/đặt hàng/coupon/review không có JwtAuthGuard (khách vãng lai không được dùng)
// ❌ SAI: tạo "giỏ tạm", "user khách" hay vai trò 'guest' để khách mua hàng
```

Ghi chú:

- Giỏ hàng: `carts.user_id` UNIQUE, tạo bằng `upsert` theo `userId` khi cần; không có giỏ cho khách.
- Ghi `activity_logs` cho mọi thao tác admin; `actorId` phải là admin (CSDL không kiểm tra, Service bảo đảm).
- Kiểm tra `status = 'active'` và `deletedAt = null` của user ở guard mỗi lần xác thực token (tài khoản bị cấm không dùng được token còn hạn).
