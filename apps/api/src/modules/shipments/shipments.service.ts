// UC-ADM-25 – Quản lý vận chuyển (admin nhập tay): tạo vận đơn, cập nhật trạng thái theo DAC_TA §10.4:
//   pending → picked_up → in_transit → delivered | failed | returned;  failed → in_transit (giao lại) | returned.
// delivered và returned là trạng thái cuối; failed KHÔNG phải trạng thái cuối. Đánh dấu delivered ⇒ trong CÙNG transaction gọi
// OrdersService.completeOrder (đơn shipping → completed, sold_count, COD đã thanh toán, ghi chú "Giao hàng thành công").
// failed/returned: đơn giữ nguyên shipping; khách được thông báo (đúng một lần, gửi SAU khi giao dịch cơ sở dữ liệu hoàn tất nên
// lỗi gửi thông báo không làm hỏng việc đổi trạng thái); với returned admin được hủy đơn (D-N34, OrdersService.cancelCore) rồi hoàn
// tiền nếu đã thanh toán. Cập nhật lặp lại cùng một trạng thái là thao tác rỗng (không ghi gì, không gửi lại thông báo).
// Mọi thao tác ghi kèm activity_logs trong cùng transaction (D-T52).
import { Injectable, Logger } from '@nestjs/common';
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

/** Bước chuyển hợp lệ của vận đơn (DAC_TA §10.4); chỉ delivered và returned là trạng thái cuối */
export const SHIPMENT_NEXT: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed', 'returned'],
  failed: ['in_transit', 'returned'],
  delivered: [],
  returned: [],
};
export const canShipmentTransition = (from: ShipmentStatus, to: ShipmentStatus) =>
  SHIPMENT_NEXT[from].includes(to);

/** Thông báo cho khách khi vận đơn đổi sang trạng thái này (title theo mã đơn, nội dung) */
const NOTICE: Partial<Record<ShipmentStatus, { title: (code: string) => string; content: string }>> = {
  picked_up: {
    title: (c) => `Đơn ${c} đã được bàn giao cho đơn vị vận chuyển`,
    content: 'Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển.',
  },
  failed: {
    title: (c) => `Đơn ${c} giao hàng không thành công`,
    content: 'Đơn vị vận chuyển chưa giao được đơn hàng của bạn. Chúng tôi sẽ liên hệ để sắp xếp giao lại.',
  },
  returned: {
    title: (c) => `Đơn ${c} đã được hoàn về cửa hàng`,
    content:
      'Đơn hàng không giao được và đã hoàn về cửa hàng. Chúng tôi sẽ liên hệ với bạn để xử lý đơn hàng.',
  },
};

@Injectable()
export class ShipmentsService {
  private readonly log = new Logger(ShipmentsService.name);

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
    if (str(b.reason).trim().length > 255) errs.add('reason', 'Lý do tối đa 255 ký tự.');
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
      // failed chưa kết thúc (còn giao lại được) nên vẫn là vận đơn đang hoạt động; chỉ returned mới cho tạo vận đơn mới
      const active = await tx.shipment.count({
        where: { orderId: o.id, status: { not: 'returned' } },
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

  /** PATCH /admin/shipments/:id – { status?, carrier?, trackingCode?, fee?, reason? } */
  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.prisma.shipment.findUnique({ where: { id }, include: { order: true } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Vận đơn không tồn tại.');
    const b = asBody(raw);
    const d = this.check(b, false);
    const reason = str(b.reason).trim() || null;
    const to = b.status === undefined ? null : (str(b.status) as ShipmentStatus);
    if (to !== null && !Object.keys(SHIPMENT_NEXT).includes(to)) {
      new FieldErrors().add('status', 'Trạng thái vận đơn không hợp lệ.').throwIfAny();
    }
    const warnings = await this.trackingWarning(
      d.trackingCode ?? cur.trackingCode,
      d.carrier ?? cur.carrier,
      id,
    );

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Khóa dòng vận đơn: hai yêu cầu đồng thời cho cùng vận đơn chạy tuần tự và luôn kiểm trên trạng thái MỚI NHẤT
      const [locked] = await tx.$queryRaw<
        Array<{ status: ShipmentStatus }>
      >`SELECT status FROM shipments WHERE id = ${id} FOR UPDATE`;
      const from = locked.status;
      const changed = to !== null && to !== from;
      const edits = Object.keys(d).length > 0;
      if (SHIPMENT_NEXT[from].length === 0 && (changed || edits))
        throw new AppException(ErrorCode.INVALID_STATE, 'Vận đơn đã kết thúc, không thể cập nhật.');
      if (changed && !canShipmentTransition(from, to)) {
        throw new AppException(
          ErrorCode.INVALID_STATE,
          `Không thể chuyển vận đơn từ "${from}" sang "${to}".`,
        );
      }
      if (!changed && !edits) return { changed: false as const, from }; // lặp lại cùng trạng thái: không ghi gì

      const now = new Date();
      const data: Prisma.ShipmentUpdateInput = { ...d };
      if (changed) {
        data.status = to;
        if (to === 'picked_up') data.shippedAt = now;
        if (to === 'delivered') {
          data.deliveredAt = now;
          if (!cur.shippedAt) data.shippedAt = now; // thỏa ck_shipments_dates
        }
      }
      if (changed && to === 'delivered') {
        // hoàn tất đơn trong CÙNG transaction; đơn không ở "Đang giao" ⇒ 409 và hoàn tác cả việc đổi vận đơn
        await this.orders.completeOrder(tx, adminId, cur.orderId, now);
      }
      await tx.shipment.update({ where: { id }, data });
      await this.activity.log(
        {
          actorId: adminId,
          action: changed ? 'shipment.update_status' : 'shipment.update',
          targetType: 'shipment',
          targetId: id,
          changes: {
            orderCode: cur.order.orderCode,
            from,
            to: changed ? to : from,
            ...(reason ? { reason } : {}),
            ...d,
          },
        },
        tx,
      );
      return { changed, from };
    });

    // Thông báo SAU khi đã lưu: chỉ yêu cầu thực sự đổi trạng thái (đã khóa dòng) mới gửi nên không bao giờ trùng; lỗi gửi
    // thông báo chỉ được ghi nhận, không làm hỏng việc cập nhật vận đơn đã hoàn tất.
    const notice = outcome.changed && to ? NOTICE[to] : undefined;
    if (notice) {
      try {
        await this.notifications.notify(
          this.prisma,
          cur.order.userId,
          notice.title(cur.order.orderCode),
          'order',
          notice.content,
          `/account/orders/${cur.order.orderCode}`,
        );
      } catch (e) {
        this.log.error(`Không gửi được thông báo vận đơn #${id}: ${(e as Error).message}`);
      }
    }
    if (outcome.changed && to === 'delivered') await this.cache.invalidateProducts(); // đơn hoàn tất ⇒ sold_count đổi
    return {
      shipment: serialize(await this.prisma.shipment.findUniqueOrThrow({ where: { id } })),
      order: await this.viewOrder(cur.orderId),
      warnings,
    };
  }
}
