// UC-ADM-18 – Kiểm duyệt đánh giá: danh sách theo tab (Tất cả / Chờ duyệt / Đã duyệt / Ẩn), duyệt, ẩn, hiện lại.
// pending = Chờ duyệt, approved = Hiển thị, rejected = Ẩn. Điểm trung bình/số lượt của sản phẩm do trigger DB
// (refresh_product_rating) tính lại mỗi khi đổi status/rating – chỉ tính approved. Duyệt ⇒ thông báo cho khách.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { asBody, FieldErrors, str } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductsService } from '../products/products.service';
import { REVIEW_INCLUDE, ReviewsService } from './reviews.service';

const STATUSES = ['pending', 'approved', 'rejected'] as const;
type ReviewStatus = (typeof STATUSES)[number];

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly products: ProductsService,
  ) {}

  async list(q: RawQuery) {
    const status = qStr(q, 'status');
    const productId = qNum(q, 'productId', 0);
    const search = foldVi(qStr(q, 'q'));
    const where: Prisma.ReviewWhereInput = {
      ...(status && (STATUSES as readonly string[]).includes(status)
        ? { status: status as ReviewStatus }
        : {}),
      ...(productId ? { productId } : {}),
    };
    const rows = await this.prisma.review.findMany({ where, include: REVIEW_INCLUDE });
    let list = rows.map((r) => this.reviews.toView(r));
    if (search)
      list = list.filter((r) => foldVi(`${r.productName} ${r.userName} ${r.content ?? ''}`).includes(search));
    const [field, dir] = (qStr(q, 'sort') || 'createdAt:desc').split(':');
    const mul = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const x = field === 'rating' ? a.rating : a.createdAt.toISOString();
      const y = field === 'rating' ? b.rating : b.createdAt.toISOString();
      return (x === y ? 0 : x < y ? -1 : 1) * mul;
    });
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  async setStatus(adminId: number, id: number, raw: unknown) {
    const status = str(asBody(raw).status) as ReviewStatus;
    if (!STATUSES.includes(status)) new FieldErrors().add('status', 'Trạng thái không hợp lệ.').throwIfAny();
    const cur = await this.prisma.review.findUnique({ where: { id }, include: { product: true } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đánh giá không tồn tại.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.update({ where: { id }, data: { status }, include: REVIEW_INCLUDE });
      if (status === 'approved' && cur.status !== 'approved') {
        await this.notifications.notify(
          tx,
          cur.userId,
          'Đánh giá của bạn đã được duyệt',
          'system',
          `Đánh giá của bạn về "${cur.product.name}" đã được hiển thị trên trang sản phẩm. Cảm ơn bạn!`,
          `/products/${cur.product.slug}`,
        );
      }
      await this.activity.log(
        {
          actorId: adminId,
          action:
            status === 'approved'
              ? 'review.approve'
              : status === 'rejected'
                ? 'review.reject'
                : 'review.pending',
          targetType: 'review',
          targetId: id,
          changes: { from: cur.status, to: status },
        },
        tx,
      );
      return r;
    });
    await this.products.invalidate();
    return this.reviews.toView(updated);
  }
}
