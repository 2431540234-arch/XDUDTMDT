// M11 – Đơn hàng của khách: đặt hàng (transaction + trừ tồn kho), danh sách, chi tiết, hủy đơn.
// Tồn kho (QUY_UOC_CODE_DB 5.1): tạo đơn ⇒ stock_quantity −= qty + movement "sale" (khóa dòng variant, chống bán vượt);
// hủy đơn ⇒ cộng lại + movement "return"; đổi trả được duyệt nhận hàng về ⇒ cộng lại tồn.
// sold_count chỉ tăng khi đơn completed (AdminOrdersService.setStatus), không tăng lúc đặt (QUY_UOC_CODE_DB 5.2).
import { assertPaymentMethodEnabled } from '../../common/utils/payment-methods';
import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { nextOrderCode } from '../../common/utils/code-generator';
import { qList, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, cancelReasonError, str, toId } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { CatalogCache } from '../../cache/catalog-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { ORDER_INCLUDE, OrderViewsService, type OrderRow } from './order-views.service';

const METHODS: PaymentMethod[] = ['cod', 'bank_transfer', 'momo', 'vnpay', 'zalopay', 'card'];
const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'completed',
  'cancelled',
  'refunded',
];

interface LockedVariant {
  id: number;
  product_id: number;
  sku: string;
  price: Prisma.Decimal;
  sale_price: Prisma.Decimal | null;
  stock_quantity: number;
  cost_price: Prisma.Decimal;
  is_active: boolean;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly orderViews: OrderViewsService,
    private readonly cart: CartService,
    private readonly coupons: CouponsService,
    private readonly notifications: NotificationsService,
    private readonly cache: CatalogCache,
  ) {}

  /**
   * Hoàn tất đơn (UC-ADM-25): shipping → completed, tăng sold_count theo từng dòng, COD ⇒ Payment success + paymentStatus paid,
   * thông báo khách. CHẠY TRONG transaction của người gọi (cùng lúc đánh dấu vận đơn delivered). Trigger DB ghi
   * order_status_history (changed_by = admin, note "Giao hàng thành công"). Đơn không ở shipping ⇒ 409.
   */
  async completeOrder(tx: Prisma.TransactionClient, adminId: number, orderId: number, at: Date = new Date()) {
    const [locked] = await tx.$queryRaw<
      Array<{ status: OrderStatus }>
    >`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`;
    if (!locked) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    if (locked.status !== 'shipping') {
      throw new AppException(
        ErrorCode.INVALID_STATE,
        'Chỉ đánh dấu đã giao khi đơn đang ở trạng thái "Đang giao". Hãy chuyển đơn sang "Đang giao" trước.',
      );
    }
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const sold = await tx.orderItem.findMany({
      where: { orderId, variantId: { not: null } },
      include: { variant: { select: { productId: true } } },
    });
    for (const it of sold) {
      if (!it.variant) continue;
      await tx.product.update({
        where: { id: it.variant.productId },
        data: { soldCount: { increment: it.quantity } },
      });
    }
    // COD: thu tiền khi giao ⇒ ghi nhận đã thanh toán; đơn đã thanh toán trước (không COD) giữ nguyên Payment
    let paymentStatus = o.paymentStatus;
    if (o.paymentMethod === 'cod' && o.paymentStatus !== 'paid') {
      await tx.payment.updateMany({
        where: { orderId, status: { not: 'success' } },
        data: { status: 'success', paidAt: at },
      });
      paymentStatus = 'paid';
    }
    await this.setActor(tx, adminId, 'Giao hàng thành công');
    await tx.order.update({ where: { id: orderId }, data: { status: 'completed', paymentStatus } });
    await this.notifications.notify(
      tx,
      o.userId,
      `Đơn ${o.orderCode} đã giao thành công`,
      'order',
      `Đơn hàng ${o.orderCode} đã được giao thành công. Cảm ơn bạn đã mua sắm!`,
      `/account/orders/${o.orderCode}`,
    );
    return o;
  }

  /** Ghi người thực hiện + ghi chú cho trigger trg_orders_log_status (order_status_history) trong transaction hiện tại */
  async setActor(tx: Prisma.TransactionClient, actorId: number | null, note: string | null) {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${actorId === null ? '' : String(actorId)}, true),
                                set_config('app.status_note', ${note ?? ''}, true)`;
  }

  // ------------------------------------------------------------ đặt hàng
  async create(userId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const addressId = toId(b.addressId);
    const addr = addressId ? await this.prisma.address.findFirst({ where: { id: addressId, userId } }) : null;
    // DAC_TA UC-ORD-01: địa chỉ không thuộc user / không tồn tại ⇒ 404 (không lộ sự tồn tại); chưa chọn địa chỉ ⇒ 400 theo trường (D-N30)
    if (addressId && !addr) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Địa chỉ không tồn tại.');
    if (!addr) errs.add('addressId', 'Vui lòng chọn địa chỉ nhận hàng.');
    if (!METHODS.includes(b.paymentMethod as PaymentMethod)) {
      errs.add('paymentMethod', 'Vui lòng chọn phương thức thanh toán.');
    }
    if (str(b.note).length > 500) errs.add('note', 'Ghi chú tối đa 500 ký tự.');
    errs.throwIfAny();
    await assertPaymentMethodEnabled(this.prisma, b.paymentMethod as string);

    const itemIds = Array.isArray(b.itemIds) ? (b.itemIds as unknown[]).map(Number) : [];
    const order = await this.placeOrder({
      userId,
      actorId: userId,
      address: addr!,
      paymentMethod: b.paymentMethod as PaymentMethod,
      note: b.note ? str(b.note) : null,
      itemIds,
      useCartCoupon: true,
      couponCode: b.couponCode ? str(b.couponCode).trim() : null,
      historyNote: 'Khách hàng đặt hàng',
    });
    return this.orderViews.toView(order);
  }

  /**
   * Lõi tạo đơn dùng chung cho khách (từ giỏ) và admin (tạo hộ). Mọi thứ trong MỘT transaction:
   * khóa variant theo thứ tự id → kiểm tra tồn khả dụng → tính tiền từ giá hiện tại → mã đơn → giữ chỗ.
   */
  async placeOrder(p: {
    userId: number;
    actorId: number | null;
    address: {
      id: number;
      recipientName: string;
      phone: string;
      province: string;
      district: string;
      ward: string;
      addressLine: string;
    };
    paymentMethod: PaymentMethod;
    note: string | null;
    /** dòng giỏ được chọn (rỗng = cả giỏ); bỏ qua nếu truyền `lines` */
    itemIds?: number[];
    lines?: Array<{ variantId: number; quantity: number }>;
    useCartCoupon?: boolean;
    /** Mã gửi kèm khi đặt (DAC_TA UC-ORD-01): hợp lệ thì áp, sai ⇒ 400; không gửi thì dùng mã đang áp ở giỏ */
    couponCode?: string | null;
    historyNote: string;
  }): Promise<OrderRow> {
    // xác định các dòng cần đặt
    let wanted: Array<{ variantId: number; quantity: number; cartItemId?: number }>;
    let wholeCart = false;
    if (p.lines) {
      wanted = p.lines;
    } else {
      const cart = await this.prisma.cart.findUnique({
        where: { userId: p.userId },
        include: { cartItems: true },
      });
      const items = cart?.cartItems ?? [];
      const chosen = p.itemIds?.length ? items.filter((i) => p.itemIds!.includes(i.id)) : items;
      if (!cart || !chosen.length) throw new AppException(ErrorCode.BAD_REQUEST, 'Giỏ hàng đang trống.');
      wholeCart = chosen.length === items.length;
      wanted = chosen.map((i) => ({ variantId: i.variantId, quantity: i.quantity, cartItemId: i.id }));
    }
    if (!wanted.length) throw new AppException(ErrorCode.BAD_REQUEST, 'Đơn hàng không có sản phẩm.');

    const orderId = await this.prisma.$transaction(
      async (tx) => {
        const ids = [...new Set(wanted.map((w) => w.variantId))].sort((a, b) => a - b);
        // khóa theo thứ tự id để hai đơn đồng thời không deadlock và không bán vượt tồn
        const locked = await tx.$queryRaw<LockedVariant[]>`
          SELECT id, product_id, sku, price, sale_price, stock_quantity, cost_price, is_active
          FROM product_variants WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
        const byId = new Map(locked.map((v) => [v.id, v]));
        const products = await tx.product.findMany({
          where: { id: { in: [...new Set(locked.map((v) => v.product_id))] } },
          select: { id: true, name: true, categoryId: true, status: true, deletedAt: true },
        });
        const prod = new Map(products.map((x) => [x.id, x]));

        // DAC_TA UC-ORD-01 4a: có dòng không còn bán ⇒ 409 kèm DANH SÁCH các dòng đó; không tạo đơn, giỏ không đổi (transaction hoàn tác)
        const unavailable = wanted
          .filter((w) => {
            const v = byId.get(w.variantId);
            const pr = v ? prod.get(v.product_id) : undefined;
            return !v || !v.is_active || !pr || pr.status !== 'published' || pr.deletedAt;
          })
          .map((w) => ({ variantId: w.variantId }));
        if (unavailable.length)
          throw new AppException(ErrorCode.CONFLICT, 'Có sản phẩm trong giỏ không còn được bán.', {
            unavailable,
          });

        const lines = wanted.map((w) => {
          const v = byId.get(w.variantId)!;
          const pr = prod.get(v.product_id)!;
          const available = v.stock_quantity;
          if (available < w.quantity) {
            throw new AppException(
              ErrorCode.OUT_OF_STOCK,
              `"${pr.name}" chỉ còn ${Math.max(0, available)} sản phẩm trong kho.`,
              { variantId: v.id, available: Math.max(0, available) },
            );
          }
          const unit = Number(v.sale_price ?? v.price);
          return { w, v, pr, unit };
        });

        const subtotal = lines.reduce((s, l) => s + l.unit * l.w.quantity, 0);
        const shippingFee = await this.cart.shippingFee(p.userId, subtotal, p.address.id, tx);

        // mã giảm giá trong giỏ (chỉ khi đặt cả giỏ) – kiểm tra lại trong transaction, khóa dòng coupon chống vượt lượt
        let couponId: number | null = null;
        let discount = 0;
        const cartForCoupon =
          p.useCartCoupon && wholeCart
            ? await tx.cart.findUnique({ where: { userId: p.userId }, include: { coupon: true } })
            : null;
        const codeToUse = p.couponCode || cartForCoupon?.coupon?.code || null;
        if (p.useCartCoupon && codeToUse) {
          const found = await tx.coupon.findFirst({ where: { code: codeToUse }, select: { id: true } });
          if (found) {
            await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${found.id} FOR UPDATE`;
          }
          const r = await this.coupons.evaluate(
            codeToUse,
            p.userId,
            lines.map((l) => ({
              productId: l.pr.id,
              categoryId: l.pr.categoryId,
              lineTotal: l.unit * l.w.quantity,
            })),
            subtotal,
            shippingFee,
            tx,
          );
          couponId = r.coupon.id;
          discount = r.discount;
        }
        const total = subtotal - discount + shippingFee;
        const now = new Date();
        const orderCode = await nextOrderCode(tx, now);

        await this.setActor(tx, p.actorId, p.historyNote); // trigger ghi dòng lịch sử đầu tiên
        const order = await tx.order.create({
          data: {
            orderCode,
            userId: p.userId,
            status: 'pending',
            recipientName: p.address.recipientName,
            recipientPhone: p.address.phone,
            shippingProvince: p.address.province,
            shippingDistrict: p.address.district,
            shippingWard: p.address.ward,
            shippingAddress: p.address.addressLine,
            subtotal,
            discountAmount: discount,
            shippingFee,
            total,
            couponId,
            paymentMethod: p.paymentMethod,
            paymentStatus: 'unpaid',
            note: p.note,
          },
        });

        const labels = await tx.productVariant.findMany({
          where: { id: { in: ids } },
          include: {
            variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
          },
        });
        const labelOf = new Map(labels.map((v) => [v.id, this.views.variantLabel(v)]));
        for (const l of lines) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              variantId: l.v.id,
              productName: l.pr.name,
              sku: l.v.sku,
              unitPrice: l.unit,
              quantity: l.w.quantity,
              variantLabel: labelOf.get(l.v.id) ?? null,
              costPrice: l.v.cost_price,
            },
          });
          // trừ tồn ngay khi đặt (hàng đã khóa dòng FOR UPDATE ở trên; CHECK stock_quantity >= 0 là chốt chặn cuối)
          await tx.productVariant.update({
            where: { id: l.v.id },
            data: { stockQuantity: { decrement: l.w.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: l.v.id,
              type: 'sale',
              quantityChange: -l.w.quantity,
              reason: 'Bán hàng',
              referenceCode: orderCode,
              performedBy: p.actorId,
            },
          });
        }
        await tx.payment.create({
          data: { orderId: order.id, method: p.paymentMethod, amount: total, status: 'pending' },
        });
        if (couponId) {
          await tx.couponUsage.create({ data: { couponId, userId: p.userId, orderId: order.id } });
          await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
        }
        if (!p.lines) {
          const cartItemIds = wanted.map((w) => w.cartItemId).filter((x): x is number => x !== undefined);
          if (cartItemIds.length) await tx.cartItem.deleteMany({ where: { id: { in: cartItemIds } } });
          if (wholeCart) await tx.cart.updateMany({ where: { userId: p.userId }, data: { couponId: null } });
        }
        await this.notifications.notify(
          tx,
          p.userId,
          `Đặt hàng thành công ${orderCode}`,
          'order',
          `Đơn hàng ${orderCode} đã được ghi nhận. Chúng tôi sẽ liên hệ xác nhận sớm nhất.`,
          `/account/orders/${orderCode}`,
        );
        await tx.activityLog.create({
          data: {
            actorId: p.actorId,
            action: 'order.create',
            targetType: 'order',
            targetId: order.id,
            changes: { orderCode, total },
          },
        });
        return order.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
    );
    await this.cache.invalidateProducts(); // tồn kho đổi ⇒ chi tiết sản phẩm cache không được cũ
    return this.byId(orderId);
  }

  async byId(id: number): Promise<OrderRow> {
    return this.prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
  }

  // ------------------------------------------------------------ đọc
  async list(userId: number, q: RawQuery) {
    const statuses = qList(q, 'status').filter((s): s is OrderStatus =>
      ORDER_STATUSES.includes(s as OrderStatus),
    );
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(statuses.length ? { status: { in: statuses } } : {}),
    };
    const total = await this.prisma.order.count({ where });
    const page = resolvePage(q, total, 5);
    const rows = await this.prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: await this.orderViews.toViews(rows), page: page.page, pageSize: page.pageSize, total };
  }

  async counts(userId?: number) {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: userId ? { userId } : {},
      _count: true,
    });
    const out: Record<string, number> = { all: 0 };
    for (const s of ORDER_STATUSES) out[s] = 0;
    for (const r of rows) {
      out[r.status] = r._count;
      out.all += r._count;
    }
    return out;
  }

  async detail(userId: number, code: string) {
    const o = await this.prisma.order.findFirst({
      where: { orderCode: code, userId },
      include: ORDER_INCLUDE,
    });
    // đơn của người khác ⇒ 404 (API_CONVENTIONS §7)
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return this.orderViews.toView(o);
  }

  // ------------------------------------------------------------ hủy đơn
  async cancel(userId: number, id: number, raw: unknown) {
    const o = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    const reason = str(asBody(raw).reason).trim();
    const reasonErr = cancelReasonError(reason);
    if (reasonErr) new FieldErrors().add('reason', reasonErr).throwIfAny();
    await this.cancelCore(o.id, userId, reason, false);
    return this.orderViews.toView(await this.byId(o.id));
  }

  /**
   * Hủy đơn: khách hủy được ở pending|confirmed; admin thêm processing, và shipping khi vận đơn đã returned (D-N34). Cộng lại tồn kho
   * (movement "return") và lượt dùng coupon.
   */
  async cancelCore(orderId: number, actorId: number | null, reason: string, byAdmin: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const [o] = await tx.$queryRaw<
        Array<{ id: number; status: OrderStatus; user_id: number; order_code: string }>
      >`
        SELECT id, status, user_id, order_code FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const allowed: OrderStatus[] = byAdmin
        ? ['pending', 'confirmed', 'processing']
        : ['pending', 'confirmed'];
      if (byAdmin && o.status === 'shipping') {
        // Ngoại lệ D-N34: đơn đang giao CHỈ hủy được khi mọi vận đơn của đơn đã hoàn về (returned) – hàng đã về kho nên hoàn tồn kho
        // và (nếu đã thanh toán) hoàn tiền thủ công sau đó. Vận đơn đang chạy/giao lại (failed) thì chưa hủy được.
        const ships = await tx.shipment.findMany({ where: { orderId }, select: { status: true } });
        if (!ships.length || !ships.every((s) => s.status === 'returned')) {
          throw new AppException(
            ErrorCode.INVALID_STATE,
            'Đơn đang giao chỉ hủy được khi vận đơn đã hoàn về (returned).',
          );
        }
      } else if (!allowed.includes(o.status)) {
        throw new AppException(ErrorCode.INVALID_STATE, 'Không thể hủy đơn hàng ở trạng thái hiện tại.');
      }
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const it of items.sort((a, b) => (a.variantId ?? 0) - (b.variantId ?? 0))) {
        if (it.variantId) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stockQuantity: { increment: it.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: it.variantId,
              type: 'return',
              quantityChange: it.quantity,
              reason: 'Hủy đơn hàng',
              referenceCode: o.order_code,
              performedBy: actorId,
            },
          });
        }
      }
      const usage = await tx.couponUsage.findFirst({ where: { orderId } });
      if (usage) {
        await tx.couponUsage.delete({ where: { id: usage.id } });
        await tx.coupon.update({ where: { id: usage.couponId }, data: { usedCount: { decrement: 1 } } });
      }
      await tx.payment.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'failed' } });
      await this.setActor(tx, actorId, reason);
      await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled', cancelReason: reason } });
      await this.notifications.notify(
        tx,
        o.user_id,
        `Đơn ${o.order_code} đã được hủy`,
        'order',
        reason,
        `/account/orders/${o.order_code}`,
      );
    });
    await this.cache.invalidateProducts(); // hoàn lại tồn kho
  }
}
