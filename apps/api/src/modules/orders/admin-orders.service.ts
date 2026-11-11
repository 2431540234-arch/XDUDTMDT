// UC-ADM – Quản trị đơn hàng: danh sách theo tab trạng thái, chi tiết, tạo hộ khách, chuyển trạng thái đúng máy trạng thái,
// hủy, hoàn tiền, vận đơn, xác nhận thanh toán, ghi chú nội bộ, dữ liệu in hóa đơn.
//
// Máy trạng thái: pending → confirmed → processing → shipping → completed; hủy ở pending|confirmed|processing; hoàn tiền từ
// completed (hoặc cancelled đã thanh toán). Sai thứ tự ⇒ 409 INVALID_STATE.
// Tồn kho: đã trừ lúc khách đặt hàng (movement "sale"); sang shipping không đổi tồn; hủy ⇒ cộng lại (movement "return").
// completed KHÔNG đặt tay: do vận đơn delivered (ShipmentsService → OrdersService.completeOrder); sang shipping cần có vận đơn.
import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { nextExpenseCode } from '../../common/utils/code-generator';
import { qList, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, cancelReasonError, str, toId } from '../../common/utils/validate';
import { vnDbDate } from '../../common/utils/vn-date';
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
const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'refunded'];
const PAYMENT_METHODS = ['cod', 'bank_transfer', 'momo', 'vnpay', 'zalopay', 'card'];
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
    if (str(b.note).length > 500) new FieldErrors().add('note', 'Ghi chú tối đa 500 ký tự.').throwIfAny();
    if (to === 'cancelled') return this.cancel(adminId, key, { reason: b.note });
    // UC-ADM-21 (D-N14): admin KHÔNG đặt đơn completed trực tiếp; đơn tự hoàn tất khi vận đơn được đánh dấu đã giao
    if (to === 'completed') {
      throw new AppException(ErrorCode.INVALID_STATE, 'Hoàn tất khi vận đơn được đánh dấu đã giao.');
    }
    await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{ status: OrderStatus }>
      >`SELECT status FROM orders WHERE id = ${cur.id} FOR UPDATE`;
      const from = locked.status;
      if (!canTransition(from, to)) {
        throw new AppException(ErrorCode.INVALID_STATE, `Không thể chuyển đơn từ "${from}" sang "${to}".`);
      }
      if (to === 'shipping') {
        // UC-ADM-25: phải có vận đơn đang hoạt động trước khi giao (không tự tạo vận đơn nữa)
        const active = await tx.shipment.count({
          where: { orderId: cur.id, status: { notIn: ['failed', 'returned'] } },
        });
        if (!active) {
          throw new AppException(
            ErrorCode.BAD_REQUEST,
            'Cần tạo vận đơn trước khi chuyển đơn sang "Đang giao".',
            { shipment: ['Chưa có vận đơn.'] },
          );
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
    const reason = str(b.reason ?? b.note).trim();
    const reasonErr = cancelReasonError(reason);
    if (reasonErr) new FieldErrors().add('reason', reasonErr).throwIfAny();
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
    const refundable = (st: string, pay: string) =>
      st === 'completed' || (st === 'cancelled' && pay === 'paid');
    const notRefundable = () =>
      new AppException(
        ErrorCode.INVALID_STATE,
        'Chỉ hoàn tiền cho đơn đã giao hoặc đơn đã hủy đã thanh toán.',
      );
    if (!refundable(o.status, o.paymentStatus)) throw notRefundable();
    await this.prisma.$transaction(async (tx) => {
      // Khóa dòng đơn và kiểm lại trạng thái: các yêu cầu hoàn tiền đồng thời chỉ một cái thành công (không ghi trùng phiếu chi)
      const [locked] = await tx.$queryRaw<
        Array<{ status: string; payment_status: string }>
      >`SELECT status, payment_status FROM orders WHERE id = ${o.id} FOR UPDATE`;
      if (!refundable(locked.status, locked.payment_status)) throw notRefundable();
      await this.orders.setActor(tx, adminId, 'Hoàn tiền thủ công');
      await tx.order.update({ where: { id: o.id }, data: { status: 'refunded', paymentStatus: 'refunded' } });
      await tx.payment.updateMany({ where: { orderId: o.id }, data: { status: 'refunded' } });
      await tx.expense.create({
        data: {
          code: await nextExpenseCode(tx),
          category: 'refund',
          amount: o.total,
          note: `Hoàn tiền đơn ${o.orderCode}`,
          date: vnDbDate(), // cột DATE: ngày theo giờ Việt Nam
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

  // ------------------------------------------------------------ UC-ADM-24 thanh toán

  /** Danh sách giao dịch (GET /admin/payments?status=&method=&q=&page=&pageSize=): mới nhất trước */
  async listPayments(q: RawQuery) {
    const status = qStr(q, 'status');
    const method = qStr(q, 'method');
    const search = qStr(q, 'q').trim();
    const errs = new FieldErrors();
    if (status && !PAYMENT_STATUSES.includes(status))
      errs.add('status', 'Trạng thái giao dịch không hợp lệ.');
    if (method && !PAYMENT_METHODS.includes(method))
      errs.add('method', 'Phương thức thanh toán không hợp lệ.');
    errs.throwIfAny();
    const where: Prisma.PaymentWhereInput = {
      ...(status ? { status: status as never } : {}),
      ...(method ? { method: method as never } : {}),
      ...(search
        ? {
            OR: [
              { transactionCode: { contains: search, mode: 'insensitive' } },
              { order: { orderCode: { contains: search, mode: 'insensitive' } } },
              { order: { recipientName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const total = await this.prisma.payment.count({ where });
    const page = resolvePage(q, total, 10);
    const rows = await this.prisma.payment.findMany({
      where,
      include: {
        order: {
          select: { orderCode: true, status: true, paymentStatus: true, recipientName: true, userId: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.order.userId))] } },
      select: { id: true, fullName: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: rows.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        orderCode: p.order.orderCode,
        orderStatus: p.order.status,
        orderPaymentStatus: p.order.paymentStatus,
        customerName: byId.get(p.order.userId)?.fullName ?? p.order.recipientName,
        customerEmail: byId.get(p.order.userId)?.email ?? null,
        method: p.method,
        amount: Number(p.amount),
        status: p.status,
        transactionCode: p.transactionCode,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      page: page.page,
      pageSize: page.pageSize,
      total,
    };
  }

  /**
   * Điều kiện chung của xác nhận/đánh dấu thất bại thủ công (UC-ADM-24): chỉ giao dịch CHUYỂN KHOẢN đang chờ đối soát.
   * Giao dịch online do cổng thanh toán quản lý và COD (tự ghi nhận khi giao hàng) không xử lý tay; giao dịch đã thành công,
   * thất bại hoặc hoàn tiền không bị ghi đè.
   */
  private assertManualPending(
    pay: { method: string; status: string },
    order: { paymentStatus: string; status: string },
    lateAfterCancel = false,
  ) {
    if (pay.method !== 'bank_transfer') {
      throw new AppException(
        ErrorCode.INVALID_STATE,
        pay.method === 'cod'
          ? 'Thanh toán khi nhận hàng (COD) được ghi nhận tự động khi giao hàng thành công, không xác nhận thủ công.'
          : 'Giao dịch online do cổng thanh toán quản lý, không xác nhận thủ công.',
      );
    }
    // Ngoại lệ D-N33 (chỉ khi xác nhận): đơn ĐÃ HỦY thì giao dịch chờ đã bị chuyển failed lúc hủy; tiền về muộn vẫn ghi nhận được
    const statusOk =
      pay.status === 'pending' ||
      (lateAfterCancel && order.status === 'cancelled' && pay.status === 'failed');
    if (!statusOk || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
      throw new AppException(
        ErrorCode.INVALID_STATE,
        pay.status === 'success' || order.paymentStatus === 'paid'
          ? 'Đơn hàng đã được thanh toán.'
          : `Giao dịch ở trạng thái "${pay.status}", chỉ giao dịch đang chờ mới xử lý được.`,
      );
    }
  }

  /**
   * Xác nhận đã nhận tiền chuyển khoản. Giao dịch ghi success + paidAt (+ transactionCode duy nhất), đơn paid; đơn pending tự sang
   * confirmed (D-N13/O-04); đơn ĐÃ HỦY vẫn được ghi paid để có thể hoàn tiền thủ công (D-N28, D-N33), giữ nguyên trạng thái hủy
   * (giao dịch chờ bị chuyển failed lúc hủy đơn nên với đơn hủy cho phép failed → success). Chạy trong một transaction với cập nhật
   * có điều kiện theo trạng thái đã đọc nên hai yêu cầu đồng thời chỉ một cái thành công.
   */
  async confirmPayment(adminId: number, paymentId: number, raw?: unknown) {
    const body = asBody(raw);
    const code = str(body.transactionCode).trim();
    if (code.length > 100)
      new FieldErrors().add('transactionCode', 'Mã giao dịch tối đa 100 ký tự.').throwIfAny();
    const pay = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!pay) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Giao dịch không tồn tại.');
    const o = pay.order;
    this.assertManualPending(pay, o, true);
    if (code) {
      const used = await this.prisma.payment.findFirst({
        where: { transactionCode: code, id: { not: pay.id } },
        select: { id: true },
      });
      if (used)
        throw new AppException(ErrorCode.CONFLICT, 'Mã giao dịch đã được dùng cho giao dịch khác.', {
          fields: ['transactionCode'],
        });
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const won = await tx.payment.updateMany({
          where: { id: pay.id, status: pay.status },
          data: {
            status: 'success',
            paidAt: new Date(),
            ...(code ? { transactionCode: code } : {}),
            gatewayResponse: {
              manual: true,
              action: 'confirm',
              confirmedBy: adminId,
              confirmedAt: new Date().toISOString(),
            },
          },
        });
        if (won.count !== 1)
          throw new AppException(ErrorCode.INVALID_STATE, 'Giao dịch đã được xử lý bởi thao tác khác.');
        await this.orders.setActor(tx, adminId, 'Xác nhận đã nhận thanh toán');
        const fresh = await tx.order.findUniqueOrThrow({ where: { id: o.id } });
        await tx.order.update({
          where: { id: o.id },
          data: { paymentStatus: 'paid', ...(fresh.status === 'pending' ? { status: 'confirmed' } : {}) },
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
            changes: {
              orderCode: o.orderCode,
              paymentId: pay.id,
              transactionCode: code || null,
              orderStatus: fresh.status,
            },
          },
          tx,
        );
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new AppException(ErrorCode.CONFLICT, 'Mã giao dịch đã được dùng cho giao dịch khác.', {
          fields: ['transactionCode'],
        });
      throw e;
    }
    return this.viewById(o.id);
  }

  /**
   * Đánh dấu giao dịch chuyển khoản THẤT BẠI (không nhận được tiền/sai số tiền): Payment.failed, Order.paymentStatus = failed.
   * Chỉ áp dụng khi giao dịch đang chờ; không ghi đè giao dịch đã thanh toán hoặc đã hoàn tiền. Đơn giữ nguyên trạng thái.
   */
  async failPayment(adminId: number, paymentId: number, raw?: unknown) {
    const reason = str(asBody(raw).reason).trim();
    if (reason.length > 255) new FieldErrors().add('reason', 'Lý do tối đa 255 ký tự.').throwIfAny();
    const pay = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!pay) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Giao dịch không tồn tại.');
    const o = pay.order;
    this.assertManualPending(pay, o);
    await this.prisma.$transaction(async (tx) => {
      const won = await tx.payment.updateMany({
        where: { id: pay.id, status: 'pending' },
        data: {
          status: 'failed',
          gatewayResponse: {
            manual: true,
            action: 'fail',
            failedBy: adminId,
            failedAt: new Date().toISOString(),
            reason: reason || null,
          },
        },
      });
      if (won.count !== 1)
        throw new AppException(ErrorCode.INVALID_STATE, 'Giao dịch đã được xử lý bởi thao tác khác.');
      await this.orders.setActor(tx, adminId, 'Đánh dấu thanh toán thất bại');
      await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'failed' } });
      await this.notifications.notify(
        tx,
        o.userId,
        `Thanh toán đơn ${o.orderCode} chưa được xác nhận`,
        'order',
        reason ||
          'Chúng tôi chưa nhận được khoản thanh toán cho đơn hàng. Vui lòng kiểm tra lại hoặc thanh toán lại.',
        `/account/orders/${o.orderCode}`,
      );
      await this.activity.log(
        {
          actorId: adminId,
          action: 'order.fail_payment',
          targetType: 'order',
          targetId: o.id,
          changes: { orderCode: o.orderCode, paymentId: pay.id, reason: reason || null },
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
