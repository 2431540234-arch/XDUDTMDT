// UC-ADM – Xử lý đổi trả: pending → picking → inspecting → refunded | exchanged (hoặc rejected từ pending|picking|inspecting).
// Nhận hàng về (inspecting → refunded|exchanged): cộng lại tồn kho đúng biến thể + movement "return".
// Hoàn tiền: tạo phiếu chi (danh mục "refund") và, khi đã hoàn đủ tiền hàng của đơn, chuyển đơn/thanh toán sang "refunded".
// Mỗi lần đổi trạng thái: activity log (lịch sử), thông báo cho khách. Sai thứ tự ⇒ 409 INVALID_STATE.
import { Injectable } from '@nestjs/common';
import { Prisma, ReturnStatus } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { nextExpenseCode } from '../../common/utils/code-generator';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { asBody, FieldErrors, str } from '../../common/utils/validate';
import { vnDbDate } from '../../common/utils/vn-date';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogCache } from '../../cache/catalog-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { RETURN_INCLUDE, ReturnsService, goodsDiscountOf } from './returns.service';

/** Các bước chuyển hợp lệ của yêu cầu đổi trả */
export const RETURN_FLOW: Partial<Record<ReturnStatus, ReturnStatus[]>> = {
  pending: ['picking', 'rejected'],
  picking: ['inspecting', 'rejected'],
  inspecting: ['refunded', 'exchanged', 'rejected'],
};

export function canReturnTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_FLOW[from]?.includes(to) ?? false;
}

const LABEL: Record<string, string> = {
  picking: 'được duyệt, chúng tôi sẽ sắp xếp lấy hàng',
  inspecting: 'đã nhận hàng và đang kiểm tra',
  refunded: 'đã được hoàn tiền',
  exchanged: 'đã được đổi sản phẩm',
  rejected: 'bị từ chối',
};

@Injectable()
export class AdminReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly returns: ReturnsService,
    private readonly orders: OrdersService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly cache: CatalogCache,
  ) {}

  async list(q: RawQuery) {
    const status = qStr(q, 'status');
    const type = qStr(q, 'type');
    const search = foldVi(qStr(q, 'q'));
    const where: Prisma.ReturnRequestWhereInput = {
      ...(status ? { status: status as ReturnStatus } : {}),
      ...(type ? { type: type as never } : {}),
    };
    const rows = await this.prisma.returnRequest.findMany({
      where,
      include: RETURN_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    let list = rows.map((r) => this.returns.toView(r));
    if (search)
      list = list.filter((r) => foldVi(`${r.code} ${r.customerName} ${r.orderCode}`).includes(search));
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  async update(adminId: number, id: number, raw: unknown) {
    const b = asBody(raw);
    const to = str(b.status) as ReturnStatus;
    const note = b.adminNote !== undefined ? str(b.adminNote).trim() : undefined;
    const done = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{ status: ReturnStatus }>
      >`SELECT status FROM return_requests WHERE id = ${id} FOR UPDATE`;
      if (!locked) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Yêu cầu đổi trả không tồn tại.');
      const r = await tx.returnRequest.findUniqueOrThrow({
        where: { id },
        include: {
          items: { include: { orderItem: true } },
          order: { include: { coupon: { select: { type: true } } } },
        },
      });
      if (!canReturnTransition(locked.status, to)) {
        throw new AppException(ErrorCode.INVALID_STATE, 'Không thể chuyển yêu cầu sang trạng thái này.');
      }
      if (to === 'refunded' && r.type !== 'refund')
        throw new AppException(ErrorCode.INVALID_STATE, 'Yêu cầu này là đổi sản phẩm, không hoàn tiền.');
      if (to === 'exchanged' && r.type !== 'exchange')
        throw new AppException(
          ErrorCode.INVALID_STATE,
          'Yêu cầu này là trả hàng hoàn tiền, không đổi sản phẩm.',
        );
      if (to === 'rejected' && !(note ?? r.adminNote ?? '').trim())
        new FieldErrors().add('adminNote', 'Vui lòng nhập lý do từ chối.').throwIfAny();

      await tx.returnRequest.update({
        where: { id },
        data: { status: to, ...(note !== undefined ? { adminNote: note || null } : {}) },
      });

      if (to === 'refunded' || to === 'exchanged') {
        // Khóa các biến thể liên quan theo thứ tự id (cả biến thể cũ và biến thể giao đổi) rồi cập nhật tồn
        const ids = new Set<number>();
        for (const it of r.items) {
          if (it.orderItem.variantId) ids.add(it.orderItem.variantId);
          if (it.exchangeVariantId) ids.add(it.exchangeVariantId);
        }
        if (ids.size) {
          await tx.$queryRaw`SELECT id FROM product_variants WHERE id IN (${Prisma.join([...ids].sort((x, y) => x - y))}) ORDER BY id FOR UPDATE`;
        }
        const items = [...r.items].sort(
          (x, y) => (x.orderItem.variantId ?? 0) - (y.orderItem.variantId ?? 0),
        );
        // 1) hàng về kho: cộng lại đúng biến thể đã bán (movement "return")
        for (const it of items) {
          const vid = it.orderItem.variantId;
          if (!vid) continue;
          await tx.productVariant.update({
            where: { id: vid },
            data: { stockQuantity: { increment: it.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: vid,
              type: 'return',
              quantityChange: it.quantity,
              reason: `Nhập lại hàng đổi trả ${r.code}`,
              referenceCode: r.code,
              performedBy: adminId,
            },
          });
        }
        // 2) đổi hàng: trừ tồn món mới (mặc định cùng biến thể với dòng gốc), ghi movement "sale"; thiếu hàng ⇒ 409
        if (to === 'exchanged') {
          for (const it of items) {
            const newVid = it.exchangeVariantId ?? it.orderItem.variantId;
            if (!newVid) continue;
            const cur = await tx.productVariant.findUniqueOrThrow({
              where: { id: newVid },
              select: { stockQuantity: true, sku: true },
            });
            if (cur.stockQuantity < it.quantity) {
              throw new AppException(
                ErrorCode.OUT_OF_STOCK,
                `Không đủ hàng để giao đổi "${it.orderItem.productName}" (còn ${cur.stockQuantity}, cần ${it.quantity}).`,
                { variantId: newVid, available: cur.stockQuantity },
              );
            }
            await tx.productVariant.update({
              where: { id: newVid },
              data: { stockQuantity: { decrement: it.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                variantId: newVid,
                type: 'sale',
                quantityChange: -it.quantity,
                reason: `Giao hàng đổi ${r.code}`,
                referenceCode: r.code,
                performedBy: adminId,
              },
            });
          }
        }
      }
      if (to === 'refunded') {
        await tx.expense.create({
          data: {
            code: await nextExpenseCode(tx),
            category: 'refund',
            amount: r.refundAmount,
            note: `Hoàn tiền đổi trả ${r.code} (đơn ${r.order.orderCode})`,
            date: vnDbDate(), // cột DATE: ngày theo giờ Việt Nam
            orderId: r.orderId,
          },
        });
        // đã hoàn đủ phần tiền hàng khách trả (hoặc đã trả hết mọi dòng) ⇒ đơn + thanh toán sang "refunded"; hoàn một phần ⇒ giữ trạng thái đơn
        const agg = await tx.returnRequest.aggregate({
          _sum: { refundAmount: true },
          where: { orderId: r.orderId, status: 'refunded' },
        });
        const refunded = Number(agg._sum.refundAmount ?? 0);
        const goodsPaid = Number(r.order.subtotal) - goodsDiscountOf(r.order);
        const orderItems = await tx.orderItem.findMany({ where: { orderId: r.orderId } });
        const returnedQty = await tx.returnRequestItem.groupBy({
          by: ['orderItemId'],
          where: { request: { orderId: r.orderId, status: 'refunded' } },
          _sum: { quantity: true },
        });
        const qtyOf = new Map(returnedQty.map((x) => [x.orderItemId, x._sum.quantity ?? 0]));
        const allReturned = orderItems.every((x) => (qtyOf.get(x.id) ?? 0) >= x.quantity);
        if ((allReturned || refunded >= goodsPaid) && r.order.status === 'completed') {
          await this.orders.setActor(tx, adminId, `Hoàn tiền đổi trả ${r.code}`);
          await tx.order.update({
            where: { id: r.orderId },
            data: { status: 'refunded', paymentStatus: 'refunded' },
          });
          await tx.payment.updateMany({
            where: { orderId: r.orderId, status: 'success' },
            data: { status: 'refunded' },
          });
        }
      }
      await this.notifications.notify(
        tx,
        r.userId,
        `Yêu cầu ${r.code} ${LABEL[to] ?? to}`,
        'order',
        (note ?? r.adminNote) || 'Cập nhật yêu cầu đổi trả của bạn.',
        '/account/returns',
      );
      await this.activity.log(
        {
          actorId: adminId,
          action: 'return.update_status',
          targetType: 'return',
          targetId: id,
          changes: { code: r.code, from: locked.status, to },
        },
        tx,
      );
      return id;
    });
    await this.cache.invalidateProducts(); // nhập lại kho / đổi hàng làm đổi tồn
    return this.returns.toView(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: done }, include: RETURN_INCLUDE }),
    );
  }
}
