// UC-ADM-12 – Kho: tồn kho theo biến thể (chỉ đọc). Đổi tồn do đặt/hủy đơn và admin sửa biến thể (admin-products).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { qNum, qStr, resolvePage, parseSort, type RawQuery } from '../../common/utils/list-query';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

const ROW_INCLUDE = {
  product: {
    include: {
      category: true,
      productImages: { where: { isPrimary: true }, include: { media: true }, take: 1 },
    },
  },
  variantAttributeValues: { include: { attributeValue: { include: { attribute: true } } } },
} satisfies Prisma.ProductVariantInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
  ) {}

  // ---------------------------------------------------------------- tồn kho theo biến thể
  private async allRows() {
    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true, product: { deletedAt: null } },
      include: ROW_INCLUDE,
      orderBy: { id: 'asc' },
    });
    return variants.map((v) => {
      const label = this.views.variantLabel(v);
      const stock = v.stockQuantity;
      const state: 'in_stock' | 'low' | 'out' = stock <= 0 ? 'out' : stock <= v.minStock ? 'low' : 'in_stock';
      return {
        variantId: v.id,
        productId: v.productId,
        productName: `${v.product.name}${label !== 'Tiêu chuẩn' ? ` – ${label}` : ''}`,
        imageUrl: this.views.url(v.product.productImages[0]?.media.filePath),
        sku: v.sku,
        categoryId: v.product.categoryId,
        categoryName: v.product.category?.name ?? '—',
        costPrice: Number(v.costPrice),
        stockQuantity: stock,
        available: this.views.available(v),
        minStock: v.minStock,
        state,
      };
    });
  }

  async rows(q: RawQuery) {
    const search = foldVi(qStr(q, 'q'));
    const state = qStr(q, 'state');
    const cat = qNum(q, 'categoryId', 0);
    let list = await this.allRows();
    if (search) list = list.filter((r) => foldVi(`${r.productName} ${r.sku}`).includes(search));
    if (['in_stock', 'low', 'out'].includes(state)) list = list.filter((r) => r.state === state);
    if (cat) {
      const cats = await this.prisma.category.findMany({
        where: { OR: [{ id: cat }, { parentId: cat }] },
        select: { id: true },
      });
      const ids = new Set(cats.map((c) => c.id));
      list = list.filter((r) => r.categoryId != null && ids.has(r.categoryId));
    }
    const sort = parseSort(qStr(q, 'sort') || 'available:asc', [
      'productName',
      'stockQuantity',
      'available',
      'costPrice',
    ]) ?? { field: 'available', dir: 'asc' as const };
    const dir = sort.dir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      const x = a[sort.field as 'productName'];
      const y = b[sort.field as 'productName'];
      const c = typeof x === 'string' ? x.localeCompare(String(y), 'vi') : Number(x) - Number(y);
      return c * dir || a.variantId - b.variantId;
    });
    const page = resolvePage(q, list.length, 10);
    return {
      items: list.slice(page.skip, page.skip + page.pageSize).map(({ categoryId: _c, ...r }) => r),
      page: page.page,
      pageSize: page.pageSize,
      total: list.length,
    };
  }

  async summary() {
    const rows = await this.allRows();
    return {
      totalStock: rows.reduce((s, r) => s + r.stockQuantity, 0),
      stockValue: rows.reduce((s, r) => s + r.stockQuantity * r.costPrice, 0),
      lowCount: rows.filter((r) => r.state === 'low').length,
      outCount: rows.filter((r) => r.state === 'out').length,
    };
  }
}
