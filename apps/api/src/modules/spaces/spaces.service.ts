// M15 – Không gian mẫu (công khai): bộ sưu tập, chi tiết (ảnh 360°, hotspot, sản phẩm gợi ý, giá combo).
// Bảng: spaces, space_panoramas, space_hotspots, space_product_placements
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { serialize } from '../../common/utils/serialize';
import { FieldErrors, asBody } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews, PRODUCT_INCLUDE } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { PanoramasService } from '../panoramas/panoramas.service';

export const COMBO_DISCOUNT_PERCENT = 10;

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

  /** SpaceListItem */
  listItem(s: SpaceRow) {
    const { coverMedia, spacePanoramas, ...base } = s;
    return {
      ...serialize(base),
      coverUrl: this.views.url(coverMedia?.filePath),
      productCount: this.productIds(s).length,
      panoramaCount: spacePanoramas.length,
    };
  }

  async list(q: RawQuery) {
    const room = qStr(q, 'roomType');
    const style = qStr(q, 'style');
    const search = foldVi(qStr(q, 'q'));
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
    const items = rows
      .filter((s) => productId === null || this.productIds(s).includes(productId))
      .filter((s) => !search || foldVi(`${s.title} ${s.style ?? ''} ${s.description ?? ''}`).includes(search))
      .map((s) => this.listItem(s));
    const sort = qStr(q, 'sort') || 'newest';
    if (sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    else {
      // mới nhất trước theo THỜI ĐIỂM đăng (không so sánh chuỗi của Date: "Sat Sep…" sắp theo chữ cái, sai thứ tự)
      // không gian chưa có ngày đăng (admin tạo ở trạng thái đăng ngay) tính theo ngày tạo, không bị đẩy xuống cuối
      const at = (x: { publishedAt: unknown; createdAt: unknown }) =>
        new Date((x.publishedAt ?? x.createdAt) as string | Date).getTime();
      items.sort((a, b) => at(b) - at(a));
    }
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
    return this.buildDetail(s, userId);
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
    return rows.map((s) => this.listItem(s));
  }

  private async buildDetail(s: SpaceRow, userId: number | null) {
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
      ...this.listItem(s),
      panoramas,
      products: items,
      originalTotal,
      comboTotal: calcComboTotal(originalTotal, discount),
      comboDiscountPercent: discount,
      similar: similarRows.map((x) => this.listItem(x)),
    };
  }

  /**
   * "Thêm cả bộ vào giỏ": thêm biến thể mặc định của từng sản phẩm trong không gian (nếu còn hàng).
   * Món hết hàng/ngừng bán không làm hỏng cả thao tác: trả danh sách `unavailable` kèm lý do.
   */
  /**
   * Thêm bộ sản phẩm của không gian vào giỏ trong MỘT request và MỘT transaction (tất cả hoặc không món nào).
   * Body tùy chọn { productIds: number[] } chọn một phần các món của không gian (mặc định: tất cả).
   * Có món không thêm được (ngừng bán, hết hàng, quá tồn) ⇒ 409 CONFLICT kèm details.unavailable, giỏ KHÔNG đổi.
   */
  async addAllToCart(userId: number, slug: string, raw: unknown = {}) {
    const s = await this.prisma.space.findFirst({
      where: { slug, status: 'published' },
      include: SPACE_INCLUDE,
    });
    if (!s) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Không gian mẫu không tồn tại.');
    const all = this.productIds(s);
    const body = asBody(raw);
    let ids = all;
    if (body.productIds !== undefined) {
      const want = Array.isArray(body.productIds) ? body.productIds.map(Number) : [];
      if (!want.length || want.some((x) => !all.includes(x)))
        new FieldErrors()
          .add('productIds', 'Danh sách sản phẩm phải là các sản phẩm của không gian này.')
          .throwIfAny();
      ids = all.filter((x) => want.includes(x));
    }
    const rows = ids.length
      ? await this.prisma.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_INCLUDE })
      : [];
    const lines: Array<{ variantId: number; quantity: number; productId: number; name: string }> = [];
    const unavailable: Array<{ productId: number; name: string; reason: string }> = [];
    for (const id of ids) {
      const p = rows.find((r) => r.id === id);
      if (!p) continue;
      const dv = this.views.defaultVariant(p);
      if (p.status !== 'published' || p.deletedAt || !dv) {
        unavailable.push({ productId: id, name: p.name, reason: 'Sản phẩm tạm ngừng bán' });
        continue;
      }
      lines.push({ variantId: dv.id, quantity: 1, productId: id, name: p.name });
    }
    if (unavailable.length)
      throw new AppException(
        ErrorCode.CONFLICT,
        'Có sản phẩm không thể thêm vào giỏ; chưa thêm sản phẩm nào.',
        { unavailable },
      );
    const cart = await this.cart.addItems(userId, lines);
    return {
      added: lines.map((l) => ({ productId: l.productId, name: l.name, variantId: l.variantId })),
      unavailable: [],
      cart,
    };
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
}
