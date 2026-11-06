// M16 – Đổi trả & hoàn tiền. Khách gửi yêu cầu trong 7 ngày kể từ lúc giao; admin duyệt theo luồng
// pending → picking → inspecting → refunded | exchanged (hoặc rejected). Bảng: return_requests, return_request_items,
// return_request_images. Phần xử lý của admin (duyệt/từ chối/hoàn tiền) nằm ở admin-returns.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { nextReturnCode } from '../../common/utils/code-generator';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { notify } from '../../common/utils/notify';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RETURN_WINDOW_DAYS } from '../orders/order-views.service';

export const RETURN_INCLUDE = {
  user: { select: { fullName: true } },
  order: { include: { shipments: true } },
  images: { include: { media: true }, orderBy: { id: 'asc' } },
  items: {
    orderBy: { id: 'asc' },
    include: {
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

const REASONS = ['defect', 'wrong_item', 'not_as_described', 'missing_accessory', 'change_mind'];

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly ingest: MediaIngestService,
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
      include: { orderItems: true, shipments: true },
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
    const until = delivered ? delivered.getTime() + RETURN_WINDOW_DAYS * 86_400_000 : 0;
    if (o.status !== 'completed' || !delivered || until < Date.now()) {
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
      const left = it.quantity - (taken.get(it.id) ?? 0);
      if (left <= 0)
        throw new AppException(ErrorCode.INVALID_STATE, `"${it.productName}" đã được yêu cầu đổi trả.`);
      return { it, qty: Math.min(Math.max(1, Math.floor(Number(x.quantity) || 1)), left) };
    });
    const refundAmount = lines.reduce((s, l) => s + Number(l.it.unitPrice) * l.qty, 0);

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
          items: { create: lines.map((l) => ({ orderItemId: l.it.id, quantity: l.qty })) },
          images: { create: mediaIds.map((mediaId) => ({ mediaId })) },
        },
        include: RETURN_INCLUDE,
      });
      await notify(
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
