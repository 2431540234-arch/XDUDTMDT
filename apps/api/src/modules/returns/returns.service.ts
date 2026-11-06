// M16 – Đổi trả & hoàn tiền. Khách gửi yêu cầu trong 7 ngày kể từ lúc giao; admin duyệt theo luồng
// pending → picking → inspecting → refunded | exchanged (hoặc rejected). Bảng: return_requests, return_request_items,
// return_request_images. Phần xử lý của admin (duyệt/từ chối/hoàn tiền) nằm ở admin-returns.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { nextReturnCode } from '../../common/utils/code-generator';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RETURN_WINDOW_DAYS } from '../orders/order-views.service';

export const RETURN_INCLUDE = {
  user: { select: { fullName: true } },
  order: { include: { shipments: true } },
  images: { include: { media: true }, orderBy: { id: 'asc' } },
  items: {
    orderBy: { id: 'asc' },
    include: {
      exchangeVariant: {
        include: {
          variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
        },
      },
      orderItem: {
        include: {
          variant: {
            include: {
              product: {
                include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } },
              },
              variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReturnRequestInclude;

export type ReturnRow = Prisma.ReturnRequestGetPayload<{ include: typeof RETURN_INCLUDE }>;

/** Đổi trả chỉ trong N ngày kể từ khi giao thành công (đơn completed) */
export function isWithinReturnWindow(
  deliveredAt: Date | null,
  now: Date = new Date(),
  days = RETURN_WINDOW_DAYS,
): boolean {
  return Boolean(deliveredAt) && deliveredAt!.getTime() + days * 86_400_000 >= now.getTime();
}

/**
 * Số tiền hoàn cho các dòng trả = số tiền khách THỰC TRẢ cho các dòng đó: giá dòng × (tạm tính − giảm giá hàng) / tạm tính,
 * tức chia giảm giá (coupon) theo tỉ lệ giá trị; KHÔNG hoàn phí vận chuyển. Làm tròn đến đồng.
 * goodsDiscount = giảm giá áp lên tiền hàng (mã freeship giảm vào phí ship nên truyền 0).
 */
export function refundShare(
  lines: Array<{ unitPrice: number; quantity: number }>,
  subtotal: number,
  goodsDiscount: number,
): number {
  const gross = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (subtotal <= 0 || gross <= 0) return 0;
  const paidRatio = Math.max(0, subtotal - goodsDiscount) / subtotal;
  return Math.round(gross * paidRatio);
}

/** Giảm giá áp lên tiền hàng của đơn: mã freeship giảm phí ship nên không làm giảm số tiền hoàn của hàng */
export function goodsDiscountOf(order: {
  discountAmount: unknown;
  coupon?: { type: string } | null;
}): number {
  return order.coupon?.type === 'freeship' ? 0 : Number(order.discountAmount);
}

/** Số lượng còn được yêu cầu = số đã mua − số đã nằm trong các yêu cầu khác (không bị từ chối) */
export function returnableQuantity(purchased: number, alreadyRequested: number): number {
  return Math.max(0, purchased - alreadyRequested);
}

const REASONS = ['defect', 'wrong_item', 'not_as_described', 'missing_accessory', 'change_mind'];

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly ingest: MediaIngestService,
    private readonly notifications: NotificationsService,
  ) {}

  /** ReturnRequest theo contract */
  toView(r: ReturnRow) {
    return {
      id: r.id,
      code: r.code,
      orderId: r.orderId,
      orderCode: r.order.orderCode,
      userId: r.userId,
      customerName: r.user.fullName,
      items: r.items.map((it) => {
        const v = it.orderItem.variant;
        const p = v?.product;
        return {
          productId: p?.id ?? 0,
          productName: it.orderItem.productName,
          imageUrl: this.views.url(p?.productImages[0]?.media.filePath),
          variantLabel: it.orderItem.variantLabel ?? (v ? this.views.variantLabel(v) : '—'),
          quantity: it.quantity,
          unitPrice: Number(it.orderItem.unitPrice),
          // đổi hàng: biến thể giao đổi (null = cùng biến thể với dòng gốc)
          exchangeVariantId: it.exchangeVariantId,
          exchangeVariantLabel: it.exchangeVariant ? this.views.variantLabel(it.exchangeVariant) : null,
        };
      }),
      type: r.type,
      reason: r.reason,
      description: r.description,
      images: r.images.map((i) => this.views.url(i.media.filePath) ?? ''),
      refundAmount: Number(r.refundAmount),
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async list(userId: number, q: RawQuery) {
    const status = qStr(q, 'status');
    const where: Prisma.ReturnRequestWhereInput = { userId, ...(status ? { status: status as never } : {}) };
    const total = await this.prisma.returnRequest.count({ where });
    const page = resolvePage(q, total, 5);
    const rows = await this.prisma.returnRequest.findMany({
      where,
      include: RETURN_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toView(r)), page: page.page, pageSize: page.pageSize, total };
  }

  async create(userId: number, raw: unknown) {
    const b = asBody(raw);
    const o = await this.prisma.order.findFirst({
      where: { id: toId(b.orderId), userId },
      include: { orderItems: true, shipments: true, coupon: { select: { type: true } } },
    });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');

    const errs = new FieldErrors();
    const rawItems = Array.isArray(b.items) ? (b.items as Array<Record<string, unknown>>) : [];
    if (!rawItems.length) errs.add('items', 'Vui lòng chọn ít nhất một sản phẩm.');
    if (!['refund', 'exchange'].includes(str(b.type))) errs.add('type', 'Vui lòng chọn hình thức.');
    if (!REASONS.includes(str(b.reason))) errs.add('reason', 'Vui lòng chọn lý do.');
    if (str(b.description).trim().length < 10) errs.add('description', 'Mô tả chi tiết tối thiểu 10 ký tự.');
    const images = Array.isArray(b.images) ? (b.images as unknown[]).map(str).filter(Boolean) : [];
    if (!images.length) errs.add('images', 'Vui lòng tải lên ảnh/video minh chứng.');
    errs.throwIfAny();

    // hạn đổi trả: đơn đã giao và trong 7 ngày kể từ lúc giao
    const delivered = o.shipments.find((s) => s.deliveredAt)?.deliveredAt ?? null;
    if (o.status !== 'completed' || !isWithinReturnWindow(delivered)) {
      throw new AppException(
        ErrorCode.INVALID_STATE,
        `Đơn hàng đã quá hạn ${RETURN_WINDOW_DAYS} ngày đổi trả.`,
      );
    }

    // số lượng yêu cầu ≤ số đã mua − số đã yêu cầu đổi trả (chưa bị từ chối)
    const already = await this.prisma.returnRequestItem.groupBy({
      by: ['orderItemId'],
      where: { request: { orderId: o.id, status: { not: 'rejected' } } },
      _sum: { quantity: true },
    });
    const taken = new Map(already.map((a) => [a.orderItemId, a._sum.quantity ?? 0]));
    const lines = rawItems.map((x) => {
      const it = o.orderItems.find((y) => y.id === toId(x.orderItemId));
      if (!it) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Sản phẩm trong đơn không tồn tại.');
      const left = returnableQuantity(it.quantity, taken.get(it.id) ?? 0);
      if (left <= 0)
        throw new AppException(ErrorCode.INVALID_STATE, `"${it.productName}" đã được yêu cầu đổi trả.`);
      const qty = Math.floor(Number(x.quantity) || 1);
      if (qty < 1 || qty > left) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          items: [`"${it.productName}": số lượng đổi trả tối đa là ${left}.`],
        });
      }
      // đổi hàng: biến thể giao đổi phải cùng sản phẩm và còn bán; không gửi = cùng biến thể với dòng gốc
      let exchangeVariantId: number | null = null;
      const wantVariant = toId(x.exchangeVariantId);
      if (str(b.type) === 'exchange' && wantVariant && wantVariant !== it.variantId) {
        exchangeVariantId = wantVariant;
      }
      return { it, qty, exchangeVariantId };
    });
    for (const l of lines) {
      if (!l.exchangeVariantId) continue;
      const orig = await this.prisma.productVariant.findUnique({
        where: { id: l.it.variantId ?? 0 },
        select: { productId: true },
      });
      const target = await this.prisma.productVariant.findFirst({
        where: { id: l.exchangeVariantId, isActive: true, productId: orig?.productId ?? -1 },
        select: { id: true },
      });
      if (!target) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, 'Dữ liệu không hợp lệ.', {
          items: [`"${l.it.productName}": biến thể muốn đổi không thuộc sản phẩm hoặc đã ngừng bán.`],
        });
      }
    }
    // số tiền hoàn = tiền khách thực trả cho các dòng (chia coupon theo tỉ lệ), không gồm phí vận chuyển
    const refundAmount = refundShare(
      lines.map((l) => ({ unitPrice: Number(l.it.unitPrice), quantity: l.qty })),
      Number(o.subtotal),
      goodsDiscountOf(o),
    );

    const mediaIds: number[] = [];
    for (const u of images.slice(0, 6))
      mediaIds.push(await this.ingest.ingestImage(u, { userId, folder: `returns/${o.id}` }));

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextReturnCode(tx);
      const r = await tx.returnRequest.create({
        data: {
          code,
          orderId: o.id,
          userId,
          type: str(b.type) as 'refund' | 'exchange',
          reason: str(b.reason) as never,
          description: str(b.description).trim(),
          refundAmount,
          items: {
            create: lines.map((l) => ({
              orderItemId: l.it.id,
              quantity: l.qty,
              exchangeVariantId: l.exchangeVariantId,
            })),
          },
          images: { create: mediaIds.map((mediaId) => ({ mediaId })) },
        },
        include: RETURN_INCLUDE,
      });
      await this.notifications.notify(
        tx,
        userId,
        `Đã nhận yêu cầu đổi trả ${code}`,
        'order',
        `Yêu cầu đổi trả cho đơn ${o.orderCode} đang chờ duyệt.`,
        '/account/returns',
      );
      return r;
    });
    return this.toView(created);
  }
}
