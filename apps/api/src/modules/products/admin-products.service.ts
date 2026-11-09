// UC-ADM-09 – Quản trị sản phẩm: danh sách, chi tiết, thêm/sửa đủ 6 tab (cơ bản, hình ảnh, biến thể màu × kích thước, mô hình 3D,
// thuộc tính/thông số, SEO), xóa (đã có trong đơn ⇒ chuyển sang "ngừng bán"), ảnh 360° theo màu.
// Tồn kho: stock_quantity (đã trừ khi khách đặt hàng); admin sửa tồn ⇒ ghi inventory_movements (adjustment).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { toSlug } from '../../common/utils/slug';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews, PRODUCT_INCLUDE, type ProductRow } from '../../common/views/catalog-views.service';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

type Tx = Prisma.TransactionClient;

interface VariantInput {
  id?: number;
  color?: { name: string; hex?: string } | null;
  size?: string | null;
  sku: string;
  price: number;
  salePrice?: number | null;
  stockQuantity: number;
  costPrice?: number;
  minStock?: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}

const PRODUCT_STATUSES = ['draft', 'published', 'archived'];
const SORTS = ['name', 'price', 'stockQuantity', 'createdAt'];

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly ingest: MediaIngestService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
  ) {}

  // ------------------------------------------------------------ đọc
  async list(q: RawQuery) {
    const rows = await this.prisma.product.findMany({ where: { deletedAt: null }, include: PRODUCT_INCLUDE });
    const search = foldVi(qStr(q, 'q'));
    const cat = toId(qStr(q, 'category'));
    const status = qStr(q, 'status');
    let list = rows.map((r) => ({ row: r, item: this.views.listItem(r) }));
    if (search) {
      list = list.filter(({ row, item }) =>
        foldVi(`${item.name} ${item.sku} ${row.productVariants.map((v) => v.sku).join(' ')}`).includes(
          search,
        ),
      );
    }
    if (cat) {
      const cats = await this.prisma.category.findMany({
        where: { OR: [{ id: cat }, { parentId: cat }] },
        select: { id: true },
      });
      const ids = new Set(cats.map((c) => c.id));
      list = list.filter(({ item }) => item.categoryId !== null && ids.has(item.categoryId));
    }
    if (status === 'selling')
      list = list.filter(({ item }) => item.status === 'published' && item.stockQuantity > 0);
    else if (status === 'out')
      list = list.filter(({ item }) => item.status === 'published' && item.stockQuantity <= 0);
    else if (status) list = list.filter(({ item }) => item.status === status);

    const [field, dir] = (qStr(q, 'sort') || 'createdAt:desc').split(':');
    const f = SORTS.includes(field) ? field : 'createdAt';
    const get = (x: (typeof list)[number]): string | number =>
      f === 'name'
        ? x.item.name
        : f === 'price'
          ? (x.item.salePrice ?? x.item.price)
          : f === 'stockQuantity'
            ? x.item.stockQuantity
            : new Date(x.item.createdAt as unknown as string | Date).getTime();
    const mul = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => (get(a) === get(b) ? 0 : get(a) < get(b) ? -1 : 1) * mul);
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize).map((x) => x.item),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  private async row(id: number): Promise<ProductRow> {
    const p = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!p) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Sản phẩm không tồn tại.');
    return p;
  }

  private async detailOf(p: ProductRow) {
    return this.views.detail(p);
  }

  async get(id: number) {
    const d = await this.detailOf(await this.row(id));
    return { ...d, allVariants: d.variants };
  }

  // ------------------------------------------------------------ ghi
  private validate(b: Record<string, unknown>, creating: boolean) {
    const errs = new FieldErrors();
    if (str(b.name).trim().length < 2) errs.add('name', 'Vui lòng nhập tên sản phẩm.');
    if (creating && !str(b.sku).trim() && !(Array.isArray(b.variants) && b.variants.length))
      errs.add('sku', 'Vui lòng nhập SKU.');
    if (!b.categoryId) errs.add('categoryId', 'Vui lòng chọn danh mục.');
    if (!Array.isArray(b.variants) || !b.variants.length) {
      if (!(Number(b.price) > 0)) errs.add('price', 'Giá bán phải lớn hơn 0.');
      if (b.stock === '' || b.stock === undefined || b.stock === null || Number(b.stock) < 0)
        errs.add('stock', 'Vui lòng nhập tồn kho.');
    }
    if (!str(b.shortDescription).trim()) errs.add('shortDescription', 'Vui lòng nhập mô tả ngắn.');
    if (b.status !== undefined && !PRODUCT_STATUSES.includes(str(b.status)))
      errs.add('status', 'Trạng thái không hợp lệ.');
    errs.throwIfAny();
  }

  /** Tìm hoặc tạo giá trị thuộc tính theo mã thuộc tính (color|size|material) */
  private async attrValue(
    tx: Tx,
    code: 'color' | 'size' | 'material',
    value: string,
    hex?: string,
  ): Promise<{ attributeId: number; id: number }> {
    const attr = await tx.attribute.findUniqueOrThrow({ where: { code } });
    let v = await tx.attributeValue.findFirst({ where: { attributeId: attr.id, value } });
    if (!v)
      v = await tx.attributeValue.create({ data: { attributeId: attr.id, value, colorHex: hex ?? null } });
    else if (hex && v.colorHex !== hex && code === 'color')
      v = await tx.attributeValue.update({ where: { id: v.id }, data: { colorHex: hex } });
    return { attributeId: attr.id, id: v.id };
  }

  private async saveVariants(tx: Tx, adminId: number, productId: number, b: Record<string, unknown>) {
    const material = b.material ? str(b.material) : null;
    let inputs: VariantInput[];
    if (Array.isArray(b.variants) && b.variants.length) {
      inputs = (b.variants as Array<Record<string, unknown>>).map((x) => ({
        id: x.id ? toId(x.id) : undefined,
        color: x.color && typeof x.color === 'object' ? (x.color as { name: string; hex?: string }) : null,
        size: x.size ? str(x.size) : null,
        sku: str(x.sku).trim(),
        price: Number(x.price),
        salePrice:
          x.salePrice === null || x.salePrice === undefined || x.salePrice === ''
            ? null
            : Number(x.salePrice),
        stockQuantity: Number(x.stockQuantity),
        costPrice: x.costPrice !== undefined ? Number(x.costPrice) : undefined,
        minStock: x.minStock !== undefined ? Number(x.minStock) : undefined,
        lengthCm: x.lengthCm !== undefined ? (x.lengthCm === null ? null : Number(x.lengthCm)) : undefined,
        widthCm: x.widthCm !== undefined ? (x.widthCm === null ? null : Number(x.widthCm)) : undefined,
        heightCm: x.heightCm !== undefined ? (x.heightCm === null ? null : Number(x.heightCm)) : undefined,
      }));
    } else {
      const original = Number(b.originalPrice);
      const price = Number(b.price);
      const first = await tx.productVariant.findFirst({
        where: { productId, isActive: true },
        orderBy: { id: 'asc' },
      });
      inputs = [
        {
          id: first?.id,
          sku: str(b.sku).trim(),
          price: original > price ? original : price,
          salePrice: original > price ? price : null,
          stockQuantity: Number(b.stock),
          color: null,
          size: null,
        },
      ];
    }
    const errs = new FieldErrors();
    inputs.forEach((v, i) => {
      if (!v.sku) errs.add(`variants.${i}.sku`, 'Vui lòng nhập SKU.');
      if (!(v.price > 0)) errs.add(`variants.${i}.price`, 'Giá bán phải lớn hơn 0.');
      if (v.salePrice !== null && v.salePrice !== undefined && !(v.salePrice > 0 && v.salePrice <= v.price))
        errs.add(`variants.${i}.salePrice`, 'Giá khuyến mãi phải nhỏ hơn giá gốc.');
      if (!(v.stockQuantity >= 0)) errs.add(`variants.${i}.stockQuantity`, 'Tồn kho không hợp lệ.');
    });
    errs.throwIfAny();
    const skus = inputs.map((v) => v.sku.toLowerCase());
    if (new Set(skus).size !== skus.length)
      throw new AppException(ErrorCode.CONFLICT, 'SKU đã tồn tại.', { fields: ['sku'] });

    const keep: number[] = [];
    for (const vi of inputs) {
      const own = vi.id ? await tx.productVariant.findFirst({ where: { id: vi.id, productId } }) : null;
      const dup = await tx.productVariant.findFirst({
        where: { sku: vi.sku, ...(own ? { id: { not: own.id } } : {}) },
      });
      if (dup) throw new AppException(ErrorCode.CONFLICT, 'SKU đã tồn tại.', { fields: ['sku'] });
      const dims = {
        ...(vi.lengthCm !== undefined ? { lengthCm: vi.lengthCm } : {}),
        ...(vi.widthCm !== undefined ? { widthCm: vi.widthCm } : {}),
        ...(vi.heightCm !== undefined ? { heightCm: vi.heightCm } : {}),
        ...(vi.costPrice !== undefined ? { costPrice: vi.costPrice } : {}),
        ...(vi.minStock !== undefined ? { minStock: vi.minStock } : {}),
      };
      let v;
      if (own) {
        v = await tx.productVariant.update({
          where: { id: own.id },
          // stock_quantity nhập trực tiếp; chênh lệch ghi inventory_movements (adjustment) bên dưới
          data: {
            sku: vi.sku,
            price: vi.price,
            salePrice: vi.salePrice ?? null,
            stockQuantity: vi.stockQuantity,
            isActive: true,
            ...dims,
          },
        });
        if (vi.stockQuantity !== own.stockQuantity) {
          await tx.inventoryMovement.create({
            data: {
              variantId: own.id,
              type: 'adjustment',
              quantityChange: vi.stockQuantity - own.stockQuantity,
              reason: 'Điều chỉnh tồn khi sửa sản phẩm',
              referenceCode: vi.sku,
              performedBy: adminId,
            },
          });
        }
      } else {
        v = await tx.productVariant.create({
          data: {
            productId,
            sku: vi.sku,
            price: vi.price,
            salePrice: vi.salePrice ?? null,
            stockQuantity: vi.stockQuantity,
            ...dims,
          },
        });
        if (vi.stockQuantity > 0) {
          await tx.inventoryMovement.create({
            data: {
              variantId: v.id,
              type: 'import',
              quantityChange: vi.stockQuantity,
              reason: 'Nhập kho ban đầu',
              referenceCode: vi.sku,
            },
          });
        }
      }
      keep.push(v.id);
      await tx.variantAttributeValue.deleteMany({ where: { variantId: v.id } });
      const links: Array<{ attributeId: number; id: number }> = [];
      if (vi.color?.name) links.push(await this.attrValue(tx, 'color', vi.color.name, vi.color.hex));
      links.push(await this.attrValue(tx, 'size', vi.size || 'Tiêu chuẩn'));
      if (material) links.push(await this.attrValue(tx, 'material', material));
      await tx.variantAttributeValue.createMany({
        data: links.map((l) => ({ variantId: v.id, attributeId: l.attributeId, attributeValueId: l.id })),
      });
    }
    // biến thể không còn trong danh sách ⇒ ngừng bán (không xóa để giữ lịch sử đơn/giỏ)
    await tx.productVariant.updateMany({
      where: { productId, id: { notIn: keep } },
      data: { isActive: false },
    });
    await tx.cartItem.deleteMany({ where: { variant: { productId, isActive: false } } });
  }

  /**
   * Đồng bộ ảnh sản phẩm theo mediaId (UC-ADM-11), KHÔNG xóa rồi tạo lại toàn bộ:
   * - mỗi ảnh gửi lên là { mediaId } (ảnh đã có trong kho) hoặc { url } (URL kho / data-URL / đường dẫn); thứ tự mảng = thứ tự hiển thị
   * - ảnh đã có (cùng mediaId) giữ nguyên dòng và id, chỉ cập nhật thứ tự; variantId giữ nguyên nếu không gửi, null để gỡ liên kết,
   *   số để gắn với biến thể (phải thuộc sản phẩm này, nếu không 400)
   * - ảnh không còn trong danh sách: xóa DÒNG liên kết product_images; tệp media và tệp vật lý KHÔNG bị xóa (có thể đang được
   *   sản phẩm/mô hình khác dùng; việc dọn tệp thuộc UC-ADM-04)
   * - luôn đúng một ảnh đại diện (ảnh được đánh dấu đầu tiên, nếu không thì ảnh đại diện cũ còn lại, nếu không thì ảnh đầu)
   */
  private async saveImages(
    tx: Tx,
    productId: number,
    adminId: number,
    slug: string,
    images: Array<{ url?: string; mediaId?: unknown; variantId?: unknown; isPrimary?: boolean }>,
  ) {
    const existing = await tx.productImage.findMany({ where: { productId }, orderBy: { id: 'asc' } });
    const prevByMedia = new Map<number, (typeof existing)[number]>();
    for (const e of existing) if (!prevByMedia.has(e.mediaId)) prevByMedia.set(e.mediaId, e);
    const variantIds = new Set(
      (await tx.productVariant.findMany({ where: { productId }, select: { id: true } })).map((v) => v.id),
    );
    const errs = new FieldErrors();
    const desired: Array<{
      mediaId: number;
      variantId: number | null;
      wantPrimary: boolean;
      prev?: (typeof existing)[number];
    }> = [];
    const seen = new Set<number>();
    for (let i = 0; i < images.length; i++) {
      const x = images[i] ?? {};
      let mediaId = 0;
      if (x.mediaId !== undefined && x.mediaId !== null && x.mediaId !== '') {
        const id = toId(x.mediaId);
        const m = id ? await tx.media.findUnique({ where: { id }, select: { id: true } }) : null;
        if (!m) {
          errs.add(`images.${i}.mediaId`, 'Ảnh không tồn tại.');
          continue;
        }
        mediaId = m.id;
      } else if (str(x.url).trim()) {
        mediaId = await this.ingest.ingestImage(str(x.url), { userId: adminId, folder: `products/${slug}` });
      } else {
        errs.add(`images.${i}.url`, 'Vui lòng chọn ảnh.');
        continue;
      }
      if (seen.has(mediaId)) continue; // cùng một ảnh gửi hai lần ⇒ giữ lần đầu
      seen.add(mediaId);
      const prev = prevByMedia.get(mediaId);
      let variantId: number | null;
      if (x.variantId === undefined) variantId = prev?.variantId ?? null;
      else if (x.variantId === null || x.variantId === '') variantId = null;
      else {
        const vid = toId(x.variantId);
        if (!vid || !variantIds.has(vid)) {
          errs.add(`images.${i}.variantId`, 'Biến thể không thuộc sản phẩm này.');
          continue;
        }
        variantId = vid;
      }
      desired.push({ mediaId, variantId, wantPrimary: Boolean(x.isPrimary), prev });
    }
    errs.throwIfAny();

    const usedRowIds = new Set(desired.flatMap((d) => (d.prev ? [d.prev.id] : [])));
    const stale = existing.filter((e) => !usedRowIds.has(e.id)).map((e) => e.id); // đã gỡ khỏi danh sách (và dòng trùng mediaId cũ)
    if (stale.length) await tx.productImage.deleteMany({ where: { id: { in: stale } } });
    // bỏ cờ đại diện trước khi đặt lại (partial unique uq_product_images_primary: tối đa một ảnh đại diện)
    await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
    const primaryIdx = (() => {
      const flagged = desired.findIndex((d) => d.wantPrimary);
      if (flagged >= 0) return flagged;
      const kept = desired.findIndex((d) => d.prev?.isPrimary);
      return kept >= 0 ? kept : desired.length ? 0 : -1;
    })();
    for (let i = 0; i < desired.length; i++) {
      const d = desired[i];
      const data = { sortOrder: i + 1, variantId: d.variantId, isPrimary: i === primaryIdx };
      if (d.prev) await tx.productImage.update({ where: { id: d.prev.id }, data });
      else await tx.productImage.create({ data: { productId, mediaId: d.mediaId, ...data } });
    }
  }

  private async apply(tx: Tx, adminId: number, id: number, b: Record<string, unknown>, slug: string) {
    // các lần lưu đồng thời CÙNG một sản phẩm chạy tuần tự (biến thể, ảnh, thông số luôn nhất quán với nhau)
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
    const category = await tx.category.findUnique({ where: { id: toId(b.categoryId) } });
    if (!category) new FieldErrors().add('categoryId', 'Danh mục không tồn tại.').throwIfAny();
    await tx.product.update({
      where: { id },
      data: {
        name: str(b.name).trim(),
        slug,
        categoryId: toId(b.categoryId),
        brandId: b.brandId ? toId(b.brandId) : null,
        status: (str(b.status) || 'published') as never,
        isFeatured: Boolean(b.isFeatured),
        shortDescription: str(b.shortDescription),
        description: str(b.description),
        metaTitle: str(b.metaTitle) || null,
        metaDescription: str(b.metaDescription) || null,
        ...(b.style !== undefined ? { style: str(b.style) || null } : {}),
        ...(Array.isArray(b.features) ? { features: (b.features as unknown[]).map(str) } : {}),
      },
    });
    await this.saveVariants(tx, adminId, id, b);
    if (Array.isArray(b.images))
      await this.saveImages(tx, id, adminId, slug, b.images as Array<Record<string, unknown>>);
    if (Array.isArray(b.specs)) {
      await tx.productSpec.deleteMany({ where: { productId: id } });
      const specs = (b.specs as Array<{ label: string; value: string }>).filter(
        (s) => str(s.label).trim() && str(s.value).trim(),
      );
      if (specs.length)
        await tx.productSpec.createMany({
          data: specs.map((s, i) => ({
            productId: id,
            label: str(s.label).trim(),
            value: str(s.value).trim(),
            sortOrder: i,
          })),
        });
    }
  }

  async create(adminId: number, raw: unknown) {
    const b = asBody(raw);
    this.validate(b, true);
    const name = str(b.name).trim();
    let slug = toSlug(str(b.slug) || name);
    if (!slug) new FieldErrors().add('slug', 'Slug không hợp lệ.').throwIfAny();
    for (let n = 2; await this.prisma.product.findUnique({ where: { slug } }); n++)
      slug = `${toSlug(str(b.slug) || name)}-${n}`;
    const id = await this.prisma.$transaction(
      async (tx) => {
        const p = await tx.product.create({ data: { name, slug, status: 'draft' } });
        await this.apply(tx, adminId, p.id, b, slug);
        await this.activity.log(
          {
            actorId: adminId,
            action: 'product.create',
            targetType: 'product',
            targetId: p.id,
            changes: { name },
          },
          tx,
        );
        return p.id;
      },
      { timeout: 60_000 },
    );
    await this.products.invalidate();
    return this.detailOf(await this.row(id));
  }

  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.row(id);
    const b = asBody(raw);
    this.validate(b, false);
    let slug = cur.slug;
    if (b.slug && toSlug(str(b.slug)) !== cur.slug) {
      slug = toSlug(str(b.slug));
      if (!slug || (await this.prisma.product.findFirst({ where: { slug, id: { not: id } } }))) {
        new FieldErrors().add('slug', 'Slug đã tồn tại.').throwIfAny();
      }
    }
    await this.prisma.$transaction(
      async (tx) => {
        await this.apply(tx, adminId, id, b, slug);
        await this.activity.log(
          {
            actorId: adminId,
            action: 'product.update',
            targetType: 'product',
            targetId: id,
            changes: { name: str(b.name).trim() },
          },
          tx,
        );
      },
      { timeout: 60_000 },
    );
    await this.products.invalidate();
    return this.detailOf(await this.row(id));
  }

  /** Đã có trong đơn hàng ⇒ chuyển sang "ngừng bán" (archived) để giữ lịch sử; chưa có ⇒ xóa mềm */
  async remove(adminId: number, id: number) {
    const p = await this.row(id);
    const inOrders = await this.prisma.orderItem.count({ where: { variant: { productId: id } } });
    if (inOrders > 0) {
      await this.prisma.product.update({ where: { id }, data: { status: 'archived' } });
      await this.activity.log({
        actorId: adminId,
        action: 'product.archive',
        targetType: 'product',
        targetId: id,
        changes: { name: p.name, reason: 'đã có trong đơn hàng' },
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }),
        this.prisma.wishlist.deleteMany({ where: { productId: id } }),
        this.prisma.cartItem.deleteMany({ where: { variant: { productId: id } } }),
      ]);
      await this.activity.log({
        actorId: adminId,
        action: 'product.delete',
        targetType: 'product',
        targetId: id,
        changes: { name: p.name },
      });
    }
    await this.products.invalidate();
    return null;
  }

  // ------------------------------------------------------------ ảnh 360° (tab "Ảnh 360°")
  async get360(id: number) {
    const p = await this.row(id);
    const cfg = await this.prisma.product360Config.findUnique({
      where: { productId: id },
      include: {
        frames: {
          orderBy: [{ attributeValueId: 'asc' }, { frameIndex: 'asc' }],
          include: { media: true, color: true },
        },
      },
    });
    const byColor = new Map<number, { name: string; hex: string; frames: string[] }>();
    for (const f of cfg?.frames ?? []) {
      const c = byColor.get(f.attributeValueId) ?? {
        name: f.color.value,
        hex: f.color.colorHex ?? '#cccccc',
        frames: [],
      };
      c.frames.push(this.views.url(f.media.filePath) ?? '');
      byColor.set(f.attributeValueId, c);
    }
    const variantColors: Array<{ name: string; hex: string }> = [];
    for (const v of p.productVariants) {
      const c = this.views.color(v);
      if (c && !variantColors.some((x) => x.name === c.name)) variantColors.push(c);
    }
    return {
      enabled: Boolean(cfg?.enabled),
      frameCount: cfg?.frameCount ?? 36,
      autoRotate: cfg?.autoRotate ?? true,
      colors: [...byColor.values()],
      variantColors,
    };
  }

  async save360(adminId: number, id: number, raw: unknown) {
    await this.row(id);
    const b = asBody(raw);
    const colors = (Array.isArray(b.colors) ? b.colors : []) as Array<{
      name: string;
      hex: string;
      frames: string[];
    }>;
    const filled = colors.filter((c) => Array.isArray(c.frames) && c.frames.length);
    if (b.enabled && !filled.some((c) => c.frames.length >= 2)) {
      new FieldErrors()
        .add('colors', 'Cần ít nhất một màu có từ 2 ảnh trở lên để bật xem 360°.')
        .throwIfAny();
    }
    // ảnh frame ≤ 2MB/ảnh; ingest ngoài transaction (có thể lâu), rồi ghi cấu hình nguyên tử
    const resolved: Array<{ name: string; hex: string; mediaIds: number[] }> = [];
    for (const c of filled) {
      const mediaIds: number[] = [];
      for (const u of c.frames)
        mediaIds.push(
          await this.ingest.ingestImage(str(u), {
            userId: adminId,
            folder: `product-360/${id}`,
            maxMB: this.ingest.limits.frame,
          }),
        );
      resolved.push({ name: str(c.name), hex: str(c.hex), mediaIds });
    }
    await this.prisma.$transaction(
      async (tx) => {
        const frameCount = resolved[0]?.mediaIds.length ?? 36;
        const defColor = resolved[0]
          ? await this.attrValue(tx, 'color', resolved[0].name, resolved[0].hex)
          : null;
        const cfg = await tx.product360Config.upsert({
          where: { productId: id },
          update: {
            enabled: Boolean(b.enabled),
            autoRotate: b.autoRotate !== false,
            frameCount,
            ...(defColor ? { defaultColorId: defColor.id } : {}),
          },
          create: {
            productId: id,
            enabled: Boolean(b.enabled),
            autoRotate: b.autoRotate !== false,
            frameCount,
            defaultColorId: defColor?.id ?? null,
          },
        });
        await tx.product360Frame.deleteMany({ where: { configId: cfg.id } });
        for (const c of resolved) {
          const color = await this.attrValue(tx, 'color', c.name, c.hex);
          await tx.product360Frame.createMany({
            data: c.mediaIds.map((mediaId, i) => ({
              configId: cfg.id,
              attributeValueId: color.id,
              frameIndex: i,
              mediaId,
            })),
          });
        }
        await this.activity.log(
          {
            actorId: adminId,
            action: 'product.update_360',
            targetType: 'product',
            targetId: id,
            changes: { enabled: Boolean(b.enabled) },
          },
          tx,
        );
      },
      { timeout: 60_000 },
    );
    await this.products.invalidate();
    return this.get360(id);
  }
}
