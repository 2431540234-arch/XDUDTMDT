// UC-ADM-25 – Quản lý vận chuyển (admin nhập tay): tạo vận đơn, cập nhật trạng thái pending → picked_up → in_transit →
// delivered (hoặc failed/returned). Đánh dấu delivered ⇒ trong CÙNG transaction gọi OrdersService.completeOrder (đơn shipping →
// completed, sold_count, COD đã thanh toán, ghi chú "Giao hàng thành công"). failed/returned: đơn giữ nguyên shipping, chỉ ghi
// trạng thái vận đơn (điểm mở O-03). Mọi thao tác ghi kèm activity_logs trong cùng transaction (D-T52).
import { Injectable } from '@nestjs/common';
import { Prisma, ShipmentCarrier, ShipmentStatus } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { serialize } from '../../common/utils/serialize';
import { CatalogCache } from '../../cache/catalog-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ORDER_INCLUDE, OrderViewsService } from '../orders/order-views.service';
import { OrdersService } from '../orders/orders.service';

const CARRIERS: ShipmentCarrier[] = ['ghn', 'ghtk', 'viettel_post', 'other'];

/** Bước chuyển hợp lệ của vận đơn; delivered/failed/returned là trạng thái cuối */
export const SHIPMENT_NEXT: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ['picked_up'],
  picked_up: ['in_transit', 'delivered', 'failed', 'returned'],
  in_transit: ['delivered', 'failed', 'returned'],
  delivered: [],
  failed: [],
  returned: [],
};
export const canShipmentTransition = (from: ShipmentStatus, to: ShipmentStatus) =>
  SHIPMENT_NEXT[from].includes(to);

const MILESTONE: Partial<Record<ShipmentStatus, string>> = {
  picked_up: 'đã được bàn giao cho đơn vị vận chuyển',
};

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly orderViews: OrderViewsService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly cache: CatalogCache,
  ) {}

  private async order(key: string) {
    const id = toId(key);
    const o = await this.prisma.order.findFirst({
      where: { OR: [{ orderCode: key }, ...(id ? [{ id }] : [])] },
    });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return o;
  }

  private async viewOrder(id: number) {
    const row = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    return this.orderViews.toView(row, { customer: true });
  }

  private check(b: Record<string, unknown>, create: boolean) {
    const errs = new FieldErrors();
    const out: { carrier?: ShipmentCarrier; trackingCode?: string | null; fee?: number } = {};
    if (create || b.carrier !== undefined) {
      if (!CARRIERS.includes(str(b.carrier) as ShipmentCarrier))
        errs.add('carrier', 'Đơn vị vận chuyển không hợp lệ.');
      else out.carrier = str(b.carrier) as ShipmentCarrier;
    }
    if (b.trackingCode !== undefined) {
      const t = str(b.trackingCode).trim();
      if (t.length > 100) errs.add('trackingCode', 'Mã vận đơn tối đa 100 ký tự.');
      out.trackingCode = t || null;
    }
    if (b.fee !== undefined && b.fee !== null && b.fee !== '') {
      const fee = Number(b.fee);
      if (!Number.isFinite(fee) || fee < 0) errs.add('fee', 'Phí vận chuyển phải là số không âm.');
      else out.fee = Math.round(fee);
    }
    errs.throwIfAny();
    return out;
  }

  /** Cảnh báo (không chặn): mã vận đơn đã dùng ở vận đơn của đơn vị vận chuyển KHÁC */
  private async trackingWarning(
    tracking: string | null | undefined,
    carrier: ShipmentCarrier,
    selfId?: number,
  ) {
    if (!tracking) return [] as string[];
    const dup = await this.prisma.shipment.findFirst({
      where: {
        trackingCode: tracking,
        carrier: { not: carrier },
        ...(selfId ? { id: { not: selfId } } : {}),
      },
      select: { id: true },
    });
    return dup ? ['Mã vận đơn này đã được dùng cho vận đơn của đơn vị vận chuyển khác.'] : [];
  }

  /** POST /admin/orders/:id/shipments – chỉ khi đơn đang processing hoặc shipping và chưa có vận đơn đang hoạt động */
  async create(adminId: number, key: string, raw: unknown) {
    const o = await this.order(key);
    const d = this.check(asBody(raw), true);
    const warnings = await this.trackingWarning(d.trackingCode, d.carrier!);
    const shipmentId = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{ status: string }>
      >`SELECT status FROM orders WHERE id = ${o.id} FOR UPDATE`;
      if (!['processing', 'shipping'].includes(locked.status)) {
        throw new AppException(
          ErrorCode.INVALID_STATE,
          'Chỉ tạo vận đơn cho đơn đang "Đang xử lý" hoặc "Đang giao".',
        );
      }
      const active = await tx.shipment.count({
        where: { orderId: o.id, status: { notIn: ['failed', 'returned'] } },
      });
      if (active) throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã có vận đơn đang hoạt động.');
      const s = await tx.shipment.create({
        data: {
          orderId: o.id,
          carrier: d.carrier!,
          trackingCode: d.trackingCode ?? null,
          fee: d.fee ?? o.shippingFee,
          status: 'pending',
        },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'shipment.create',
          targetType: 'shipment',
          targetId: s.id,
          changes: { orderCode: o.orderCode, carrier: d.carrier, trackingCode: d.trackingCode ?? null },
        },
        tx,
      );
      return s.id;
    });
    return {
      shipment: serialize(await this.prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } })),
      order: await this.viewOrder(o.id),
      warnings,
    };
  }

  /** PATCH /admin/shipments/:id – { status?, carrier?, trackingCode?, fee? } */
  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.prisma.shipment.findUnique({ where: { id }, include: { order: true } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Vận đơn không tồn tại.');
    const b = asBody(raw);
    const d = this.check(b, false);
    const to = b.status === undefined ? null : (str(b.status) as ShipmentStatus);
    if (to !== null && !Object.keys(SHIPMENT_NEXT).includes(to)) {
      new FieldErrors().add('status', 'Trạng thái vận đơn không hợp lệ.').throwIfAny();
    }
    const final = SHIPMENT_NEXT[cur.status].length === 0;
    if (final && (to !== null || Object.keys(d).length))
      throw new AppException(ErrorCode.INVALID_STATE, 'Vận đơn đã kết thúc, không thể cập nhật.');
    if (to !== null && to !== cur.status && !canShipmentTransition(cur.status, to)) {
      throw new AppException(
        ErrorCode.INVALID_STATE,
        `Không thể chuyển vận đơn từ "${cur.status}" sang "${to}".`,
      );
    }
    const warnings = await this.trackingWarning(
      d.trackingCode ?? cur.trackingCode,
      d.carrier ?? cur.carrier,
      id,
    );

    const orderId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const data: Prisma.ShipmentUpdateInput = { ...d };
      if (to && to !== cur.status) {
        data.status = to;
        if (to === 'picked_up') data.shippedAt = now;
        if (to === 'delivered') {
          data.deliveredAt = now;
          if (!cur.shippedAt) data.shippedAt = now; // thỏa ck_shipments_dates
        }
      }
      if (to === 'delivered' && cur.status !== 'delivered') {
        // hoàn tất đơn trong CÙNG transaction; đơn không ở "Đang giao" ⇒ 409 và hoàn tác cả việc đổi vận đơn
        await this.orders.completeOrder(tx, adminId, cur.orderId, now);
      }
      await tx.shipment.update({ where: { id }, data });
      if (to && MILESTONE[to]) {
        await this.notifications.notify(
          tx,
          cur.order.userId,
          `Đơn ${cur.order.orderCode} ${MILESTONE[to]}`,
          'order',
          `Vận đơn của đơn ${cur.order.orderCode} ${MILESTONE[to]}.`,
          `/account/orders/${cur.order.orderCode}`,
        );
      }
      await this.activity.log(
        {
          actorId: adminId,
          action: to && to !== cur.status ? 'shipment.update_status' : 'shipment.update',
          targetType: 'shipment',
          targetId: id,
          changes: { orderCode: cur.order.orderCode, from: cur.status, to: to ?? cur.status, ...d },
        },
        tx,
      );
      return cur.orderId;
    });
    if (to === 'delivered') await this.cache.invalidateProducts(); // đơn hoàn tất ⇒ sold_count đổi
    return {
      shipment: serialize(await this.prisma.shipment.findUniqueOrThrow({ where: { id } })),
      order: await this.viewOrder(orderId),
      warnings,
    };
  }
}
