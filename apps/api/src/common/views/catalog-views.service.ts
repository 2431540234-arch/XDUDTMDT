// Dựng các "view" mà API trả về cho FE (entity + trường mở rộng) – khớp apps/web/src/types/api.ts (docs/API_CONTRACT.md).
// Dùng chung cho products, cart, orders, wishlist, spaces, admin… Tên trường theo contract, không theo tên cột DB.
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../../storage/storage.service';
import { serialize } from '../utils/serialize';

export const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  productVariants: {
    orderBy: { id: 'asc' },
    include: { variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } } },
  },
  productImages: { orderBy: { sortOrder: 'asc' }, include: { media: true } },
  product360: { select: { enabled: true } },
} satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;
export type VariantRow = ProductRow['productVariants'][number];

export interface ColorOption {
  name: string;
  hex: string;
}

export const DEFAULT_COLOR_HEX = '#cccccc';

@Injectable()
export class CatalogViews {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /** filePath trong bảng media → URL công khai (đường dẫn tuyệt đối/tương đối bắt đầu bằng http hoặc / giữ nguyên) */
  url(filePath: string | null | undefined): string | null {
    if (!filePath) return null;
    return /^(https?:)?\/\//.test(filePath) || filePath.startsWith('/')
      ? filePath
      : this.storage.getUrl(filePath);
  }

  // ---------------- biến thể ----------------
  attr(v: VariantRow, code: 'color' | 'size' | 'material') {
    return (
      v.variantAttributeValues.find((x) => x.attributeValue.attribute.code === code)?.attributeValue ?? null
    );
  }

  color(v: VariantRow): ColorOption | null {
    const a = this.attr(v, 'color');
    return a ? { name: a.value, hex: a.colorHex ?? DEFAULT_COLOR_HEX } : null;
  }

  variantLabel(v: Pick<VariantRow, 'variantAttributeValues'> | null | undefined): string {
    if (!v) return '—';
    const get = (code: string) =>
      v.variantAttributeValues.find((x) => x.attributeValue.attribute.code === code)?.attributeValue.value;
    const parts = [get('color'), get('size')].filter((x): x is string => Boolean(x) && x !== 'Tiêu chuẩn');
    return parts.length ? parts.join(' / ') : 'Tiêu chuẩn';
  }

  /** Tồn có thể bán = stock_quantity (đã trừ ngay khi đặt hàng) */
  available(v: { stockQuantity: number }): number {
    return Math.max(0, v.stockQuantity);
  }

  effectivePrice(v: { price: Prisma.Decimal | number; salePrice: Prisma.Decimal | number | null }): number {
    return Number(v.salePrice ?? v.price);
  }

  /** Biến thể mặc định: nhóm theo màu của biến thể đầu tiên, lấy phần tử thứ 2 của nhóm (giống mock) */
  defaultVariant(p: ProductRow): VariantRow | null {
    const vs = p.productVariants.filter((v) => v.isActive);
    if (!vs.length) return null;
    const firstColor = this.color(vs[0])?.name;
    const group = vs.filter((v) => this.color(v)?.name === firstColor);
    return group[Math.min(1, group.length - 1)] ?? vs[0];
  }

  // ---------------- sản phẩm ----------------
  /** ProductListItem (chưa có isWishlisted – gán sau) */
  listItem(p: ProductRow) {
    const variants = p.productVariants.filter((v) => v.isActive);
    const dv = this.defaultVariant(p) ?? variants[0];
    const colors: ColorOption[] = [];
    const sizes: string[] = [];
    for (const v of variants) {
      const c = this.color(v);
      if (c && !colors.some((x) => x.name === c.name)) colors.push(c);
      const s = this.attr(v, 'size')?.value;
      if (s && !sizes.includes(s)) sizes.push(s);
    }
    const primary = p.productImages.find((i) => i.isPrimary) ?? p.productImages[0];
    const {
      category,
      brand,
      productVariants: _v,
      productImages: _i,
      product360,
      ...base
    } = p as ProductRow & Record<string, unknown>;
    void _v;
    void _i;
    return {
      ...serialize(base),
      price: dv ? Number(dv.price) : 0,
      salePrice: dv?.salePrice != null ? Number(dv.salePrice) : null,
      stockQuantity: variants.reduce((s, v) => s + this.available(v), 0),
      defaultVariantId: dv?.id ?? 0,
      thumbnailUrl: this.url(primary?.media.filePath),
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      brand: brand ? { id: brand.id, name: brand.name } : null,
      colors,
      sizes,
      material: dv ? (this.attr(dv, 'material')?.value ?? null) : null,
      style: p.style ?? null,
      sku: dv?.sku ?? '',
      isWishlisted: false,
      has360: Boolean(product360?.enabled),
    };
  }

  variantViews(p: ProductRow) {
    const vs = p.productVariants;
    return vs.map((v) => {
      const color = this.color(v);
      const sameColor = vs.filter((x) => this.color(x)?.name === color?.name).map((x) => x.id);
      const img = p.productImages.find((i) => i.variantId !== null && sameColor.includes(i.variantId));
      const primary = p.productImages.find((i) => i.isPrimary) ?? p.productImages[0];
      const { variantAttributeValues: _a, ...base } = v;
      void _a;
      return {
        ...serialize(base),
        // FE hiểu stockQuantity là số có thể bán (đã trừ ngay khi khách đặt hàng)
        stockQuantity: this.available(v),
        color,
        size: this.attr(v, 'size')?.value ?? null,
        material: this.attr(v, 'material')?.value ?? null,
        imageUrl: this.url((img ?? primary)?.media.filePath),
      };
    });
  }

  /** Mô hình 3D chính đã sẵn sàng của sản phẩm (kèm tệp) – Model3DView */
  async primaryModel(productId: number) {
    const m = await this.prisma.product3DModel.findFirst({
      where: { productId, isPrimary: true, status: 'ready' },
      include: { modelFiles: { include: { media: true } }, posterMedia: true },
    });
    return m ? this.model3d(m) : null;
  }

  model3d(
    m: Prisma.Product3DModelGetPayload<{
      include: { modelFiles: { include: { media: true } }; posterMedia: true };
    }>,
  ) {
    const { modelFiles, posterMedia, ...base } = m;
    const files = modelFiles.map(({ media, ...f }) => ({
      ...serialize(f),
      url: this.url(media.filePath) ?? '',
      fileName: media.fileName,
      fileSize: media.fileSize,
    }));
    return {
      ...serialize(base),
      files,
      glbUrl: files.find((f) => f.format === 'glb')?.url ?? null,
      usdzUrl: files.find((f) => f.format === 'usdz')?.url ?? null,
      posterUrl: this.url(posterMedia?.filePath),
    };
  }

  /** ProductDetail (chưa gán isWishlisted) */
  async detail(p: ProductRow) {
    const base = this.listItem(p);
    const [specs, ratings, questionCount, model] = await Promise.all([
      this.prisma.productSpec.findMany({ where: { productId: p.id }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId: p.id, status: 'approved' },
        _count: true,
      }),
      this.prisma.productQuestion.count({ where: { productId: p.id, status: 'answered', isPublic: true } }),
      this.primaryModel(p.id),
    ]);
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
    for (const r of ratings) ratingBreakdown[r.rating as 1 | 2 | 3 | 4 | 5] = r._count;
    const features = Array.isArray(p.features) ? (p.features as string[]) : [];
    return {
      ...base,
      images: p.productImages.map((i) => ({
        id: i.id,
        url: this.url(i.media.filePath) ?? '',
        isPrimary: i.isPrimary,
        sortOrder: i.sortOrder,
        variantId: i.variantId,
      })),
      variants: this.variantViews(p),
      specs: specs.map((s) => ({ label: s.label, value: s.value })),
      features,
      model,
      ratingBreakdown,
      questionCount,
      breadcrumb: [
        { label: 'Sản phẩm', href: '/products' },
        ...(p.category ? [{ label: p.category.name, href: `/products?category=${p.category.slug}` }] : []),
      ],
    };
  }

  /** Gắn isWishlisted cho danh sách theo người dùng (một truy vấn) */
  async withWishlist<T extends { id: number; isWishlisted: boolean }>(items: T[], userId?: number | null) {
    if (!userId || !items.length) return items;
    const rows = await this.prisma.wishlist.findMany({
      where: { userId, productId: { in: items.map((i) => i.id) } },
      select: { productId: true },
    });
    const set = new Set(rows.map((r) => r.productId));
    return items.map((i) => ({ ...i, isWishlisted: set.has(i.id) }));
  }
}
