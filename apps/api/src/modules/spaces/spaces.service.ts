// M15 – Không gian mẫu (công khai): bộ sưu tập, chi tiết (ảnh 360°, hotspot, sản phẩm gợi ý, giá combo), lưu yêu thích.
// Bảng: spaces, space_panoramas, space_hotspots, space_product_placements, space_bookmarks
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qBool, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { serialize } from '../../common/utils/serialize';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews, PRODUCT_INCLUDE } from '../../common/views/catalog-views.service';
import { AppConfig } from '../../config/app-config.service';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { PanoramasService } from '../panoramas/panoramas.service';

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
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly placements: PanoramasService,
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
    // UC-SPACE-06: không gian CÓ chứa sản phẩm (qua điểm tương tác loại sản phẩm); `product` = slug. Không có sản phẩm ⇒ rỗng
    const productSlug = qStr(q, 'product');
    const productId = productSlug
      ? ((
          await this.prisma.product.findFirst({
            where: { slug: productSlug, deletedAt: null },
            select: { id: true },
          })
        )?.id ?? 0)
      : null;
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
      .filter((s) => productId === null || this.productIds(s).includes(productId))
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
   * Client gửi bằng navigator.sendBeacon khi rời trang nên không đặt được header Authorization: userId lấy từ
   * header (nếu có) hoặc từ `accessToken` trong body (tùy chọn, sai/hết hạn ⇒ ghi ẩn danh). `visitorId` luôn bắt buộc (UUID).
   * `sourceProductId` nhận id sản phẩm hoặc slug (client chỉ biết `?from=<slug>`).
   */
  async recordView(slug: string, headerUserId: number | null, raw: unknown) {
    const b = asBody(raw);
    const errs = new FieldErrors();
    const visitorId = str(b.visitorId).trim().toLowerCase();
    if (!visitorId) errs.add('visitorId', 'Thiếu mã khách vãng lai.');
    else if (!UUID_RE.test(visitorId)) errs.add('visitorId', 'Mã khách vãng lai không hợp lệ.');
    const clicks = b.hotspotClickCount === undefined ? 0 : Number(b.hotspotClickCount);
    if (!Number.isInteger(clicks) || clicks < 0 || clicks > 1000)
      errs.add('hotspotClickCount', 'Số lần bấm không hợp lệ.');
    errs.throwIfAny();
    const s = await this.prisma.space.findFirst({
      where: { slug, status: 'published' },
      select: { id: true },
    });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');

    let userId = headerUserId;
    if (!userId && typeof b.accessToken === 'string' && b.accessToken) {
      try {
        const p = await this.jwt.verifyAsync<AccessTokenPayload>(b.accessToken, {
          secret: this.config.get('JWT_ACCESS_SECRET'),
        });
        const u = await this.prisma.user.findFirst({
          where: { id: p.sub, deletedAt: null, status: 'active' },
          select: { id: true },
        });
        userId = u?.id ?? null;
      } catch {
        userId = null; // token sai/hết hạn ⇒ ghi ẩn danh
      }
    }

    const src =
      typeof b.sourceProductId === 'string' && !/^\d+$/.test(b.sourceProductId.trim())
        ? b.sourceProductId.trim()
        : null;
    const productId = src ? 0 : toId(b.sourceProductId);
    const source =
      src || productId
        ? await this.prisma.product.findFirst({
            where: { deletedAt: null, ...(src ? { slug: src } : { id: productId }) },
            select: { id: true },
          })
        : null;
    await this.prisma.spaceView.create({
      data: {
        spaceId: s.id,
        userId,
        visitorId,
        sourceProductId: source?.id ?? null,
        hotspotClickCount: clicks,
        addedToCart: b.addedToCart === true,
      },
    });
    return null;
  }

  /**
   * UC-SPACE-05 "Đổi món": sản phẩm CÙNG DANH MỤC với món đang đặt, đã đăng bán và có mô hình chính ready, để client thay mô hình
   * tại đúng vị trí đó. Chỉ là gợi ý xem thử, KHÔNG lưu gì vào DB.
   */
  async alternatives(slug: string, placementId: number) {
    const pl = await this.prisma.spaceProductPlacement.findFirst({
      where: { id: placementId, panorama: { space: { slug, status: 'published' } } },
      include: { product: { select: { categoryId: true } } },
    });
    if (!pl) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Vị trí đặt sản phẩm không tồn tại.');
    const rows = await this.prisma.product.findMany({
      where: {
        id: { not: pl.productId },
        categoryId: pl.product.categoryId,
        status: 'published',
        deletedAt: null,
        product3dModels: { some: { isPrimary: true, status: 'ready' } },
      },
      include: PRODUCT_INCLUDE,
      orderBy: { id: 'asc' },
      take: 12,
    });
    const models = await this.placements.primaryModels(rows.map((p) => p.id));
    return rows
      .filter((p) => models.has(p.id))
      .map((p) => {
        const li = this.views.listItem(p);
        return {
          id: li.id,
          name: li.name,
          slug: li.slug,
          price: li.price,
          salePrice: li.salePrice,
          thumbnailUrl: li.thumbnailUrl,
          variantId: li.defaultVariantId,
          model: models.get(p.id)!,
        };
      });
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

    // UC-SPACE-04/05: mô hình 3D đã đặt trong từng ảnh (kèm tệp GLB các LOD); ảnh chưa đặt gì ⇒ placements: [] như trước
    const placed = await this.placements.placementViews(
      s.spacePanoramas.flatMap((p) => p.spaceProductPlacements),
    );
    const panoramas = s.spacePanoramas.map((p) => {
      const { media, spaceHotspotsAsPanorama, spaceProductPlacements: _placed, ...pb } = p;
      void _placed;
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
        placements: placed.filter((x) => x.panoramaId === p.id),
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

  /** Không gian ĐANG ĐĂNG (published); không tồn tại, nháp hoặc đã ẩn ⇒ 404 (UC-SPACE-04 3a) */
  private async bySlug(slug: string) {
    const s = await this.prisma.space.findFirst({
      where: { slug, status: 'published' },
      select: { id: true },
    });
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
