// M15 – Không gian mẫu (công khai): bộ sưu tập, chi tiết (ảnh 360°, hotspot, sản phẩm gợi ý, giá combo), lưu yêu thích.
// Bảng: spaces, space_panoramas, space_hotspots, space_product_placements, space_bookmarks
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qBool, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { serialize } from '../../common/utils/serialize';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews, PRODUCT_INCLUDE } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';

export const COMBO_DISCOUNT_PERCENT = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Giá combo: tổng giá hiện tại của các sản phẩm × (100 − %giảm)/100, làm tròn đến nghìn đồng */
export function calcComboTotal(originalTotal: number, discountPercent: number): number {
  return Math.round((originalTotal * (100 - discountPercent)) / 100 / 1000) * 1000;
}

export const SPACE_INCLUDE = {
  coverMedia: true,
  spacePanoramas: {
    orderBy: { sortOrder: 'asc' },
    include: {
      media: true,
      spaceHotspotsAsPanorama: { orderBy: { id: 'asc' } },
      spaceProductPlacements: { orderBy: { id: 'asc' } },
    },
  },
} satisfies Prisma.SpaceInclude;

export type SpaceRow = Prisma.SpaceGetPayload<{ include: typeof SPACE_INCLUDE }>;

@Injectable()
export class SpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly cart: CartService,
  ) {}

  private productIds(s: SpaceRow): number[] {
    const ids = new Set<number>();
    for (const p of s.spacePanoramas) {
      for (const h of p.spaceHotspotsAsPanorama)
        if (h.type === 'product' && h.productId) ids.add(h.productId);
    }
    return [...ids];
  }

  /** SpaceListItem; bookmarked: tập id không gian khách đã lưu */
  listItem(s: SpaceRow, bookmarked: Set<number>) {
    const { coverMedia, spacePanoramas, ...base } = s;
    return {
      ...serialize(base),
      coverUrl: this.views.url(coverMedia?.filePath),
      productCount: this.productIds(s).length,
      panoramaCount: spacePanoramas.length,
      isBookmarked: bookmarked.has(s.id),
    };
  }

  private async bookmarks(userId: number | null) {
    if (!userId) return new Set<number>();
    const rows = await this.prisma.spaceBookmark.findMany({ where: { userId }, select: { spaceId: true } });
    return new Set(rows.map((r) => r.spaceId));
  }

  async list(q: RawQuery, userId: number | null) {
    const room = qStr(q, 'roomType');
    const style = qStr(q, 'style');
    const search = foldVi(qStr(q, 'q'));
    const only = qBool(q, 'bookmarked');
    const rows = await this.prisma.space.findMany({
      where: {
        status: 'published',
        ...(room ? { roomType: room as never } : {}),
        ...(style ? { style } : {}),
      },
      include: SPACE_INCLUDE,
    });
    const bm = await this.bookmarks(userId);
    let items = rows
      .filter((s) => !search || foldVi(`${s.title} ${s.style ?? ''} ${s.description ?? ''}`).includes(search))
      .map((s) => this.listItem(s, bm));
    if (only) items = items.filter((s) => s.isBookmarked);
    const sort = qStr(q, 'sort') || 'newest';
    if (sort === 'popular') items.sort((a, b) => b.viewCount - a.viewCount);
    else if (sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    else items.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
    const page = resolvePage(q, items.length, 12);
    return {
      items: items.slice(page.skip, page.skip + page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
      total: items.length,
    };
  }

  async facets() {
    const rows = await this.prisma.space.findMany({
      where: { status: 'published' },
      select: { style: true, roomType: true },
    });
    const count = <T extends string>(vals: Array<T | null>) => {
      const m = new Map<T, number>();
      for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
      return [...m.entries()];
    };
    return {
      styles: count(rows.map((r) => r.style)).map(([value, c]) => ({ value, count: c })),
      roomTypes: count(rows.map((r) => r.roomType)).map(([value, c]) => ({ value, count: c })),
    };
  }

  async detail(slug: string, userId: number | null) {
    const s = await this.prisma.space.findFirst({
      where: { slug, status: 'published' },
      include: SPACE_INCLUDE,
    });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    // view_count do trigger trg_space_views_increase_count tăng khi ghi space_views (recordView), không tăng tay ở đây
    return this.buildDetail(s, userId);
  }

  /**
   * Ghi MỘT lượt xem không gian (UC-SPACE-06): chèn space_views; trigger DB tăng spaces.view_count.
   * Khách đăng nhập ghi theo user_id; khách vãng lai gửi visitorId (UUID do client tạo). Có thể kèm sản phẩm dẫn tới,
   * số lần bấm hotspot và cờ đã thêm vào giỏ.
   */
  async recordView(slug: string, userId: number | null, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const visitorId = str(b.visitorId).trim().toLowerCase();
    if (visitorId && !UUID_RE.test(visitorId)) errs.add('visitorId', 'Mã khách vãng lai không hợp lệ.');
    if (!userId && !visitorId) errs.add('visitorId', 'Thiếu mã khách vãng lai.');
    const clicks = b.hotspotClickCount === undefined ? 0 : Number(b.hotspotClickCount);
    if (!Number.isInteger(clicks) || clicks < 0 || clicks > 1000)
      errs.add('hotspotClickCount', 'Số lần bấm không hợp lệ.');
    errs.throwIfAny();
    const s = await this.prisma.space.findFirst({
      where: { slug, status: 'published' },
      select: { id: true },
    });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    const productId = toId(b.sourceProductId);
    const source = productId
      ? await this.prisma.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { id: true },
        })
      : null;
    await this.prisma.spaceView.create({
      data: {
        spaceId: s.id,
        userId,
        visitorId: userId ? null : visitorId,
        sourceProductId: source?.id ?? null,
        hotspotClickCount: clicks,
        addedToCart: Boolean(b.addedToCart),
      },
    });
    return null;
  }

  /** Chi tiết cho admin: mọi trạng thái, không tính lượt xem */
  async adminDetail(id: number) {
    const s = await this.prisma.space.findUnique({ where: { id }, include: SPACE_INCLUDE });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    return this.buildDetail(s, null);
  }

  adminListItems(rows: SpaceRow[]) {
    const none = new Set<number>();
    return rows.map((s) => this.listItem(s, none));
  }

  private async buildDetail(s: SpaceRow, userId: number | null) {
    const bm = await this.bookmarks(userId);
    const ids = this.productIds(s);
    const productRows = ids.length
      ? await this.prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE })
      : [];
    const items = await this.views.withWishlist(
      ids
        .map((id) => productRows.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => this.views.listItem(p)),
      userId,
    );
    const byId = new Map(items.map((i) => [i.id, i]));

    const panoramas = s.spacePanoramas.map((p) => {
      const { media, spaceHotspotsAsPanorama, spaceProductPlacements, ...pb } = p;
      return {
        ...serialize(pb),
        url: this.views.url(media.filePath) ?? '',
        hotspots: spaceHotspotsAsPanorama.map((h) => {
          const li = h.productId ? byId.get(h.productId) : null;
          return {
            ...serialize(h),
            product: li
              ? {
                  id: li.id,
                  name: li.name,
                  slug: li.slug,
                  price: li.price,
                  salePrice: li.salePrice,
                  thumbnailUrl: li.thumbnailUrl,
                  defaultVariantId: li.defaultVariantId,
                }
              : null,
          };
        }),
        placements: serialize(spaceProductPlacements),
      };
    });
    const originalTotal = items.reduce((sum, p) => sum + (p.salePrice ?? p.price), 0);
    const similarRows = await this.prisma.space.findMany({
      where: { id: { not: s.id }, status: 'published', OR: [{ roomType: s.roomType }, { style: s.style }] },
      include: SPACE_INCLUDE,
      take: 4,
      orderBy: { id: 'asc' },
    });
    const discount = Number(s.comboDiscountPercent ?? 0) || COMBO_DISCOUNT_PERCENT;
    return {
      ...this.listItem(s, bm),
      panoramas,
      products: items,
      originalTotal,
      comboTotal: calcComboTotal(originalTotal, discount),
      comboDiscountPercent: discount,
      similar: similarRows.map((x) => this.listItem(x, bm)),
    };
  }

  /**
   * "Thêm cả bộ vào giỏ": thêm biến thể mặc định của từng sản phẩm trong không gian (nếu còn hàng).
   * Món hết hàng/ngừng bán không làm hỏng cả thao tác: trả danh sách `unavailable` kèm lý do.
   */
  async addAllToCart(userId: number, slug: string) {
    const s = await this.prisma.space.findFirst({
      where: { slug, status: 'published' },
      include: SPACE_INCLUDE,
    });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    const ids = this.productIds(s);
    const rows = ids.length
      ? await this.prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE })
      : [];
    const added: Array<{ productId: number; name: string; variantId: number }> = [];
    const unavailable: Array<{ productId: number; name: string; reason: string }> = [];
    for (const id of ids) {
      const p = rows.find((r) => r.id === id);
      if (!p) continue;
      const dv = this.views.defaultVariant(p);
      if (p.status !== 'published' || p.deletedAt || !dv) {
        unavailable.push({ productId: id, name: p.name, reason: 'Sản phẩm tạm ngừng bán' });
        continue;
      }
      try {
        await this.cart.addItem(userId, { variantId: dv.id, quantity: 1 });
        added.push({ productId: id, name: p.name, variantId: dv.id });
      } catch (e) {
        if (
          e instanceof AppException &&
          (e.code === ErrorCode.OUT_OF_STOCK || e.code === ErrorCode.RESOURCE_NOT_FOUND)
        ) {
          unavailable.push({ productId: id, name: p.name, reason: e.message });
        } else throw e;
      }
    }
    return { added, unavailable, cart: await this.cart.view(userId) };
  }

  private async bySlug(slug: string) {
    const s = await this.prisma.space.findUnique({ where: { slug }, select: { id: true } });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    return s;
  }

  async bookmark(userId: number, slug: string) {
    const s = await this.bySlug(slug);
    await this.prisma.spaceBookmark.upsert({
      where: { userId_spaceId: { userId, spaceId: s.id } },
      update: {},
      create: { userId, spaceId: s.id },
    });
    return null;
  }

  async unbookmark(userId: number, slug: string) {
    const s = await this.prisma.space.findUnique({ where: { slug }, select: { id: true } });
    if (s) await this.prisma.spaceBookmark.deleteMany({ where: { userId, spaceId: s.id } });
    return null;
  }
}
