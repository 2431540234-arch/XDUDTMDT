// M13 – Đánh giá sản phẩm. Quy tắc: chỉ đánh giá sản phẩm thuộc đơn "Đã giao" của chính khách; mỗi (khách, sản phẩm, đơn)
// một đánh giá. Có kiểm duyệt (theo FE/mock): đánh giá mới và đánh giá vừa sửa ở trạng thái pending; admin duyệt (approved),
// ẩn (rejected – nhãn "Ẩn") hoặc hiện lại. Danh sách công khai và điểm trung bình/số lượt chỉ tính approved
// (trigger refresh_product_rating của DB). Khách luôn thấy đánh giá của mình ở "Đánh giá của tôi" kèm trạng thái.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qNum, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

export const MAX_REVIEW_IMAGES = 5;

/**
 * Điều kiện được đánh giá: sản phẩm nằm trong đơn "completed" của chính khách (purchasedAndDelivered),
 * và chưa có đánh giá nào cho (khách, sản phẩm, đơn) đó.
 */
export function reviewEligibility(input: {
  purchasedAndDelivered: boolean;
  alreadyReviewed: boolean;
}): null | 'PURCHASE_REQUIRED' | 'CONFLICT' {
  if (!input.purchasedAndDelivered) return 'PURCHASE_REQUIRED';
  if (input.alreadyReviewed) return 'CONFLICT';
  return null;
}

/** Điểm trung bình hiển thị: chỉ tính đánh giá approved, làm tròn 2 chữ số (giống trigger refresh_product_rating) */
export function averageRating(reviews: Array<{ rating: number; status: string }>): {
  avg: number;
  count: number;
} {
  const ok = reviews.filter((r) => r.status === 'approved');
  if (!ok.length) return { avg: 0, count: 0 };
  return {
    avg: Math.round((ok.reduce((s, r) => s + r.rating, 0) / ok.length) * 100) / 100,
    count: ok.length,
  };
}

export const REVIEW_INCLUDE = {
  user: { include: { avatarMedia: true } },
  product: { include: { productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 } } },
  order: {
    include: {
      shipments: true,
      orderItems: {
        include: {
          variant: {
            include: {
              variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
            },
          },
        },
      },
    },
  },
  images: { orderBy: { sortOrder: 'asc' }, include: { media: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly products: ProductsService,
    private readonly ingest: MediaIngestService,
  ) {}

  /** ReviewView theo contract; ẩn danh ⇒ tên rút gọn */
  toView(r: ReviewRow) {
    const item = r.order?.orderItems.find((it) => it.variant?.productId === r.productId) ?? null;
    const delivered = r.order?.shipments.find((s) => s.deliveredAt)?.deliveredAt ?? null;
    const { user, product, order, images, ...base } = r;
    return {
      ...base,
      userName: r.isAnonymous ? 'Khách hàng ẩn danh' : (user?.fullName ?? 'Khách hàng'),
      userAvatarUrl: r.isAnonymous ? null : this.views.url(user?.avatarMedia?.filePath),
      productName: product.name,
      productSlug: product.slug,
      productImageUrl: this.views.url(product.productImages[0]?.media.filePath),
      variantLabel: item
        ? (item.variantLabel ?? (item.variant ? this.views.variantLabel(item.variant) : null))
        : null,
      orderCode: order?.orderCode ?? null,
      purchasedAt: (delivered ?? order?.createdAt ?? null)?.toISOString() ?? null,
      images: images.map((i) => this.views.url(i.media.filePath) ?? ''),
      tags: r.tags ?? [],
    };
  }

  async listForProduct(slug: string, q: RawQuery) {
    const p = await this.products.bySlug(slug);
    const rating = qNum(q, 'rating', 0);
    const where: Prisma.ReviewWhereInput = {
      productId: p.id,
      status: 'approved',
      ...(rating ? { rating } : {}),
    };
    const total = await this.prisma.review.count({ where });
    const page = resolvePage(q, total, 5);
    const rows = await this.prisma.review.findMany({
      where,
      include: REVIEW_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.skip,
      take: page.pageSize,
    });
    return { items: rows.map((r) => this.toView(r)), page: page.page, pageSize: page.pageSize, total };
  }

  async create(userId: number, slug: string, raw: unknown) {
    const p = await this.products.bySlug(slug);
    const b = asBody(raw);
    const errs = new FieldErrors();
    const rating = Number(b.rating);
    const content = str(b.content).trim();
    if (!(rating >= 1 && rating <= 5)) errs.add('rating', 'Vui lòng chọn số sao.');
    if (content.length < 20) errs.add('content', 'Nội dung đánh giá tối thiểu 20 ký tự.');
    if (str(b.content).length > 1000) errs.add('content', 'Nội dung đánh giá tối đa 1000 ký tự.');
    errs.throwIfAny();

    // DAC_TA §12.1 #4: chỉ tài khoản đã xác thực email mới được đánh giá
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!me?.emailVerifiedAt) {
      throw new AppException(
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Bạn cần xác thực email trước khi đánh giá sản phẩm. Vui lòng kiểm tra hộp thư hoặc gửi lại email xác thực ở trang Tài khoản.',
      );
    }
    const bought = await this.prisma.order.findFirst({
      where: {
        id: toId(b.orderId),
        userId,
        status: 'completed',
        orderItems: { some: { variant: { productId: p.id } } },
      },
      select: { id: true },
    });
    const dup = bought
      ? await this.prisma.review.findFirst({ where: { userId, productId: p.id, orderId: bought.id } })
      : null;
    const verdict = reviewEligibility({
      purchasedAndDelivered: Boolean(bought),
      alreadyReviewed: Boolean(dup),
    });
    if (verdict === 'PURCHASE_REQUIRED') {
      throw new AppException(
        ErrorCode.PURCHASE_REQUIRED,
        'Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng.',
      );
    }
    if (verdict === 'CONFLICT')
      throw new AppException(ErrorCode.CONFLICT, 'Bạn đã đánh giá sản phẩm này rồi.');

    const imageUrls = Array.isArray(b.images) ? (b.images as unknown[]).map(str).filter(Boolean) : [];
    if (imageUrls.length > MAX_REVIEW_IMAGES) {
      new FieldErrors().add('images', `Tối đa ${MAX_REVIEW_IMAGES} ảnh cho mỗi đánh giá.`).throwIfAny();
    }
    const mediaIds: number[] = [];
    for (const u of imageUrls)
      mediaIds.push(await this.ingest.ingestImage(u, { userId, folder: `reviews/${p.id}` }));

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: p.id,
        orderId: bought!.id,
        rating,
        content,
        status: 'pending', // chờ admin duyệt
        tags: Array.isArray(b.tags) ? (b.tags as unknown[]).map(str) : [],
        isAnonymous: Boolean(b.anonymous),
        images: { create: mediaIds.map((mediaId, i) => ({ mediaId, sortOrder: i })) },
      },
      include: REVIEW_INCLUDE,
    });
    await this.prisma.activityLog.create({
      data: {
        actorId: userId,
        action: 'review.create',
        targetType: 'review',
        targetId: review.id,
        changes: { rating },
      },
    });
    await this.products.invalidate();
    return this.toView(review);
  }

  async mine(userId: number) {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      include: REVIEW_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  private async own(userId: number, id: number) {
    const r = await this.prisma.review.findFirst({ where: { id, userId } });
    if (!r) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đánh giá không tồn tại.');
    return r;
  }

  async update(userId: number, id: number, raw: unknown) {
    await this.own(userId, id);
    const b = asBody(raw);
    const errs = new FieldErrors();
    if (b.rating !== undefined && !(Number(b.rating) >= 1 && Number(b.rating) <= 5)) {
      errs.add('rating', 'Vui lòng chọn số sao.');
    }
    if (b.content !== undefined && str(b.content).trim().length < 20) {
      errs.add('content', 'Nội dung đánh giá tối thiểu 20 ký tự.');
    }
    errs.throwIfAny();
    const r = await this.prisma.review.update({
      where: { id },
      data: {
        ...(b.rating !== undefined ? { rating: Number(b.rating) } : {}),
        ...(b.content !== undefined ? { content: str(b.content).trim() } : {}),
        ...(Array.isArray(b.tags) ? { tags: (b.tags as unknown[]).map(str) } : {}),
        status: 'pending', // sửa xong phải được duyệt lại
      },
      include: REVIEW_INCLUDE,
    });
    await this.products.invalidate();
    return this.toView(r);
  }

  async remove(userId: number, id: number) {
    await this.own(userId, id);
    await this.prisma.review.delete({ where: { id } });
    await this.products.invalidate();
    return null;
  }
}
