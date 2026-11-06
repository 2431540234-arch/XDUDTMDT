// UC-ADM – Quản trị đơn hàng: danh sách theo tab trạng thái, chi tiết, tạo hộ khách, chuyển trạng thái đúng máy trạng thái,
// hủy, hoàn tiền, vận đơn, xác nhận thanh toán, ghi chú nội bộ, dữ liệu in hóa đơn.
//
// Máy trạng thái: pending → confirmed → processing → shipping → completed; hủy ở pending|confirmed|processing; hoàn tiền từ
// completed (hoặc cancelled đã thanh toán). Sai thứ tự ⇒ 409 INVALID_STATE.
// Tồn kho: đã trừ lúc khách đặt hàng (movement "sale"); sang shipping không đổi tồn; hủy ⇒ cộng lại (movement "return").
// COD sang completed ⇒ tự đánh dấu đã thanh toán.
import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, ShipmentCarrier } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { nextExpenseCode } from '../../common/utils/code-generator';
import { qList, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ORDER_INCLUDE, OrderViewsService } from './order-views.service';
import { OrdersService } from './orders.service';

/** Các bước chuyển hợp lệ (hủy xử lý riêng) */
export const ORDER_NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['completed'],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_NEXT[from]?.includes(to) ?? false;
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'đã được xác nhận',
  processing: 'đang được xử lý',
  shipping: 'đang được giao',
  completed: 'đã giao thành công',
};
const CARRIERS: ShipmentCarrier[] = ['ghn', 'ghtk', 'viettel_post', 'other'];
const SORTS: Record<string, keyof Prisma.OrderOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  total: 'total',
  orderCode: 'orderCode',
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly orderViews: OrderViewsService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  private async find(key: string) {
    const id = toId(key);
    const o = await this.prisma.order.findFirst({
      where: { OR: [{ orderCode: key }, ...(id ? [{ id }] : [])] },
      include: ORDER_INCLUDE,
    });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return o;
  }

  private async viewById(id: number) {
    return this.orderViews.toView(await this.orders.byId(id), { customer: true });
  }

  // ------------------------------------------------------------ đọc
  async list(q: RawQuery) {
    const statuses = qList(q, 'status');
    const pay = qStr(q, 'paymentStatus');
    const search = qStr(q, 'q');
    const from = qStr(q, 'from');
    const to = qStr(q, 'to');
    const where: Prisma.OrderWhereInput = {
      ...(statuses.length ? { status: { in: statuses as OrderStatus[] } } : {}),
      ...(pay ? { paymentStatus: pay as never } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00+07:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999+07:00`) } : {}),
            },
          }
        : {}),
    };
    let ids: number[] | null = null;
    if (search) {
      // tìm không dấu theo mã đơn, tên/email/SĐT khách, tên người nhận
      const like = `%${foldVi(search)}%`;
      const rows = await this.prisma.$queryRaw<Array<{ id: number }>>`
        SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id
        WHERE immutable_unaccent(lower(o.order_code || ' ' || u.full_name || ' ' || u.email || ' ' || COALESCE(u.phone,'') || ' ' || o.recipient_name)) LIKE ${like}`;
      ids = rows.map((r) => r.id);
      where.id = { in: ids };
    }
    const [sortField, sortDir] = (qStr(q, 'sort') || 'createdAt:desc').split(':');
    const orderBy = {
      [SORTS[sortField] ?? 'createdAt']: sortDir === 'asc' ? 'asc' : 'desc',
    } as Prisma.OrderOrderByWithRelationInput;
    const total = await this.prisma.order.count({ where });
    const page = resolvePage(q, total, 10);
    const rows = await this.prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: [orderBy, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return {
      items: await this.orderViews.toViews(rows, { customer: true }),
      page: page.page,
      pageSize: page.pageSize,
      total,
    };
  }

  counts() {
    return this.orders.counts();
  }

  async detail(key: string) {
    return this.orderViews.toView(await this.find(key), { customer: true });
  }

  /** Dữ liệu in hóa đơn: thông tin cửa hàng + đơn hàng đầy đủ (FE tự dựng bản in) */
  async invoice(key: string) {
    const [order, store] = await Promise.all([
      this.detail(key),
      this.prisma.setting.findUnique({ where: { key: 'store' } }),
    ]);
    return { store: store?.value ?? null, order, printedAt: new Date().toISOString() };
  }

  // ------------------------------------------------------------ tạo hộ khách
  async create(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const user = await this.prisma.user.findFirst({
      where: { id: toId(b.userId), deletedAt: null, userRoles: { some: { role: { code: 'user' } } } },
    });
    if (!user) errs.add('userId', 'Vui lòng chọn khách hàng.');
    const items = Array.isArray(b.items) ? (b.items as Array<Record<string, unknown>>) : [];
    if (!items.length) errs.add('items', 'Vui lòng thêm ít nhất một sản phẩm.');
    if (!b.paymentMethod) errs.add('paymentMethod', 'Vui lòng chọn phương thức thanh toán.');
    errs.throwIfAny();
    const address =
      (await this.prisma.address.findFirst({ where: { userId: user!.id, isDefault: true } })) ??
      (await this.prisma.address.findFirst({ where: { userId: user!.id }, orderBy: { id: 'asc' } }));
    if (!address) throw new AppException(ErrorCode.BAD_REQUEST, 'Khách hàng chưa có địa chỉ giao hàng.');
    const merged = new Map<number, number>();
    for (const it of items) {
      const vid = toId(it.variantId);
      merged.set(vid, (merged.get(vid) ?? 0) + Math.max(1, Math.floor(Number(it.quantity) || 1)));
    }
    const order = await this.orders.placeOrder({
      userId: user!.id,
      actorId: adminId,
      address,
      paymentMethod: str(b.paymentMethod) as never,
      note: b.note ? str(b.note) : null,
      lines: [...merged].map(([variantId, quantity]) => ({ variantId, quantity })),
      useCartCoupon: false,
      historyNote: 'Doanh nghiệp tạo đơn hàng',
    });
    await this.activity.log({
      actorId: adminId,
      action: 'order.create',
      targetType: 'order',
      targetId: order.id,
      changes: { orderCode: order.orderCode, total: Number(order.total) },
    });
    return this.viewById(order.id);
  }

  // ------------------------------------------------------------ chuyển trạng thái
  async setStatus(adminId: number, key: string, raw: unknown) {
    const b = asBody(raw);
    const to = str(b.status) as OrderStatus;
    const cur = await this.find(key);
    if (to === 'cancelled') return this.cancel(adminId, key, { reason: b.note });
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{ status: OrderStatus }>
      >`SELECT status FROM orders WHERE id = ${cur.id} FOR UPDATE`;
      const from = locked.status;
      if (!canTransition(from, to)) {
        throw new AppException(ErrorCode.INVALID_STATE, `Không thể chuyển đơn từ "${from}" sang "${to}".`);
      }
      const now = new Date();

      if (to === 'shipping') {
        // tồn kho đã trừ từ lúc đặt hàng nên sang "Đang giao" chỉ tạo/cập nhật vận đơn
        const sh = await tx.shipment.findFirst({ where: { orderId: cur.id } });
        const tracking = `GHN${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
        if (sh) {
          await tx.shipment.update({
            where: { id: sh.id },
            data: { status: 'in_transit', shippedAt: now, trackingCode: sh.trackingCode ?? tracking },
          });
        } else {
          await tx.shipment.create({
            data: {
              orderId: cur.id,
              carrier: 'ghn',
              trackingCode: tracking,
              status: 'in_transit',
              fee: cur.shippingFee,
              shippedAt: now,
            },
          });
        }
      }

      if (to === 'completed') {
        await tx.shipment.updateMany({
          where: { orderId: cur.id },
          data: { status: 'delivered', deliveredAt: now },
        });
        // COD: thu tiền khi giao ⇒ tự đánh dấu đã thanh toán
        if (cur.paymentMethod === 'cod' && cur.paymentStatus !== 'paid') {
          await tx.payment.updateMany({
            where: { orderId: cur.id, status: { not: 'success' } },
            data: { status: 'success', paidAt: now },
          });
          await tx.order.update({ where: { id: cur.id }, data: { paymentStatus: 'paid' } });
        }
      }

      await this.orders.setActor(tx, adminId, str(b.note) || null);
      await tx.order.update({ where: { id: cur.id }, data: { status: to } });
      await this.notifications.notify(
        tx,
        cur.userId,
        `Đơn ${cur.orderCode} ${STATUS_LABEL[to] ?? to}`,
        'order',
        `Trạng thái đơn hàng ${cur.orderCode} đã cập nhật.`,
        `/account/orders/${cur.orderCode}`,
      );
      await this.activity.log(
        {
          actorId: adminId,
          action: 'order.update_status',
          targetType: 'order',
          targetId: cur.id,
          changes: { orderCode: cur.orderCode, from, to },
        },
        tx,
      );
    });
    return this.viewById(cur.id);
  }

  async cancel(adminId: number, key: string, raw: unknown) {
    const o = await this.find(key);
    const b = asBody(raw);
    const reason = str(b.reason ?? b.note).trim() || 'Doanh nghiệp hủy đơn hàng';
    await this.orders.cancelCore(o.id, adminId, reason, true);
    await this.activity.log({
      actorId: adminId,
      action: 'order.cancel',
      targetType: 'order',
      targetId: o.id,
      changes: { orderCode: o.orderCode },
    });
    return this.viewById(o.id);
  }

  /** Hoàn tiền thủ công (D-N03): đơn đã giao, hoặc đơn đã hủy nhưng đã thanh toán */
  async refund(adminId: number, key: string) {
    const o = await this.find(key);
    if (!(o.status === 'completed' || (o.status === 'cancelled' && o.paymentStatus === 'paid'))) {
      throw new AppException(
        ErrorCode.INVALID_STATE,
        'Chỉ hoàn tiền cho đơn đã giao hoặc đơn đã hủy đã thanh toán.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.orders.setActor(tx, adminId, 'Hoàn tiền thủ công');
      await tx.order.update({ where: { id: o.id }, data: { status: 'refunded', paymentStatus: 'refunded' } });
      await tx.payment.updateMany({ where: { orderId: o.id }, data: { status: 'refunded' } });
      await tx.expense.create({
        data: {
          code: await nextExpenseCode(tx),
          category: 'refund',
          amount: o.total,
          note: `Hoàn tiền đơn ${o.orderCode}`,
          date: new Date(),
          orderId: o.id,
        },
      });
      await this.notifications.notify(
        tx,
        o.userId,
        `Đơn ${o.orderCode} đã được hoàn tiền`,
        'order',
        'Chúng tôi đã hoàn tiền cho đơn hàng của bạn.',
        `/account/orders/${o.orderCode}`,
      );
      await this.activity.log(
        {
          actorId: adminId,
          action: 'order.refund',
          targetType: 'order',
          targetId: o.id,
          changes: { orderCode: o.orderCode },
        },
        tx,
      );
    });
    return this.viewById(o.id);
  }

  async updateShipment(adminId: number, key: string, raw: unknown) {
    const o = await this.find(key);
    const b = asBody(raw);
    if (b.carrier && !CARRIERS.includes(str(b.carrier) as ShipmentCarrier)) {
      new FieldErrors().add('carrier', 'Đơn vị vận chuyển không hợp lệ.').throwIfAny();
    }
    const data = {
      ...(b.carrier ? { carrier: str(b.carrier) as ShipmentCarrier } : {}),
      ...(b.trackingCode !== undefined ? { trackingCode: str(b.trackingCode).trim() || null } : {}),
    };
    const sh = o.shipments[0];
    if (sh) await this.prisma.shipment.update({ where: { id: sh.id }, data });
    else
      await this.prisma.shipment.create({
        data: { orderId: o.id, fee: o.shippingFee, carrier: 'ghn', status: 'pending', ...data },
      });
    await this.activity.log({
      actorId: adminId,
      action: 'order.update_shipment',
      targetType: 'order',
      targetId: o.id,
      changes: { orderCode: o.orderCode },
    });
    return this.viewById(o.id);
  }

  async confirmPayment(adminId: number, paymentId: number) {
    const pay = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!pay) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Giao dịch không tồn tại.');
    const o = pay.order;
    if (o.paymentStatus === 'paid')
      throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã được thanh toán.');
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: pay.id }, data: { status: 'success', paidAt: new Date() } });
      await this.orders.setActor(tx, adminId, 'Xác nhận đã nhận thanh toán');
      await tx.order.update({
        where: { id: o.id },
        data: { paymentStatus: 'paid', ...(o.status === 'pending' ? { status: 'confirmed' } : {}) },
      });
      await this.notifications.notify(
        tx,
        o.userId,
        `Thanh toán đơn ${o.orderCode} đã được xác nhận`,
        'order',
        'Chúng tôi đã nhận được thanh toán của bạn.',
        `/account/orders/${o.orderCode}`,
      );
      await this.activity.log(
        {
          actorId: adminId,
          action: 'order.confirm_payment',
          targetType: 'order',
          targetId: o.id,
          changes: { orderCode: o.orderCode },
        },
        tx,
      );
    });
    return this.viewById(o.id);
  }

  async saveNote(adminId: number, key: string, raw: unknown) {
    const o = await this.find(key);
    await this.prisma.order.update({
      where: { id: o.id },
      data: { internalNote: str(asBody(raw).note) || null },
    });
    await this.activity.log({ actorId: adminId, action: 'order.note', targetType: 'order', targetId: o.id });
    return this.viewById(o.id);
  }
}
