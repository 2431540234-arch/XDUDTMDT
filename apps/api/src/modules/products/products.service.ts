// M07 – Sản phẩm (công khai): danh sách, tìm kiếm, bộ lọc, chi tiết, 3D, 360°, liên quan.
// Chỉ mục danh sách được dựng từ toàn bộ sản phẩm đang bán và lưu bộ nhớ ngắn hạn (catalog quy mô đồ án, hàng trăm sản
// phẩm) để lọc/sắp xếp/facet theo màu, kích thước, chất liệu, giá của biến thể mặc định đúng như contract.
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { qBool, qList, qNum, qStr, resolvePage, type RawQuery } from '../../common/utils/list-query';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews, PRODUCT_INCLUDE, type ProductRow } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

type ListItem = ReturnType<CatalogViews['listItem']>;
interface IndexEntry {
  row: ProductRow;
  item: ListItem;
  hay: string;
  nameFold: string;
}
interface CatRow {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
}

const INDEX_TTL_MS = 15_000;

@Injectable()
export class ProductsService {
  private index: { at: number; entries: IndexEntry[]; categories: CatRow[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
  ) {}

  /** Xóa chỉ mục sau khi dữ liệu catalog thay đổi (gọi từ module admin) */
  invalidate() {
    this.index = null;
  }

  private async load() {
    if (this.index && Date.now() - this.index.at < INDEX_TTL_MS) return this.index;
    const [rows, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'published', deletedAt: null },
        include: PRODUCT_INCLUDE,
        orderBy: { id: 'asc' },
      }),
      this.prisma.category.findMany({ select: { id: true, parentId: true, slug: true, name: true } }),
    ]);
    const entries = rows.map((row) => {
      const item = this.views.listItem(row);
      return {
        row,
        item,
        hay: foldVi(
          `${row.name} ${item.category?.name ?? ''} ${item.style ?? ''} ${row.shortDescription ?? ''}`,
        ),
        nameFold: foldVi(row.name),
      };
    });
    this.index = { at: Date.now(), entries, categories };
    return this.index;
  }

  private categoryIdsWithChildren(cats: CatRow[], slug: string) {
    const root = cats.find((c) => c.slug === slug);
    if (!root) return [];
    return [root.id, ...cats.filter((c) => c.parentId === root.id).map((c) => c.id)];
  }

  private score(e: IndexEntry, terms: string[]): number {
    if (!terms.length) return 1;
    let score = 0;
    for (const t of terms) {
      if (!e.hay.includes(t)) return 0;
      score += e.nameFold.includes(t) ? 3 : 1;
      if (e.nameFold.startsWith(t)) score += 2;
    }
    return score;
  }

  private async filter(q: RawQuery, ignoreCategory = false) {
    const { entries, categories } = await this.load();
    const terms = foldVi(qStr(q, 'q')).split(/\s+/).filter(Boolean);
    const catIds = new Set(qList(q, 'category').flatMap((s) => this.categoryIdsWithChildren(categories, s)));
    const colors = qList(q, 'color').map(foldVi);
    const materials = qList(q, 'material').map(foldVi);
    const styles = qList(q, 'style').map(foldVi);
    const min = qNum(q, 'minPrice', -1);
    const max = qNum(q, 'maxPrice', -1);
    const has3d = qBool(q, 'has3d');
    const hasAr = qBool(q, 'hasAr');
    const featured = qBool(q, 'featured');
    const brand = qStr(q, 'brand');
    const out: Array<{ e: IndexEntry; score: number }> = [];
    for (const e of entries) {
      const score = this.score(e, terms);
      if (!score) continue;
      const it = e.item;
      if (!ignoreCategory && catIds.size && !(it.categoryId && catIds.has(it.categoryId))) continue;
      if (brand && String(it.brandId) !== brand) continue;
      if (has3d !== undefined && it.has3dModel !== has3d) continue;
      if (hasAr !== undefined && it.hasAr !== hasAr) continue;
      if (featured !== undefined && it.isFeatured !== featured) continue;
      const price = it.salePrice ?? it.price;
      if (min >= 0 && price < min) continue;
      if (max > 0 && price >= max) continue;
      if (colors.length && !it.colors.some((c) => colors.includes(foldVi(c.name)))) continue;
      if (materials.length && !(it.material && materials.includes(foldVi(it.material)))) continue;
      if (styles.length && !(it.style && styles.includes(foldVi(it.style)))) continue;
      out.push({ e, score });
    }
    return out;
  }

  async list(q: RawQuery, userId: number | null, defaultSort: string) {
    const scored = await this.filter(q);
    const sort = qStr(q, 'sort') || defaultSort;
    const items = scored.map((s) => ({ item: s.e.item, score: s.score }));
    if (sort === 'relevance') {
      items.sort((a, b) => b.score - a.score || b.item.soldCount - a.item.soldCount);
    } else {
      const [field, dir] = sort.split(':');
      const get: Record<string, (x: ListItem) => string | number> = {
        createdAt: (x) => String(x.createdAt),
        price: (x) => x.salePrice ?? x.price,
        soldCount: (x) => x.soldCount,
        ratingAvg: (x) => Number(x.ratingAvg),
        name: (x) => x.name,
      };
      const g = get[field] ?? get.createdAt;
      const mul = (get[field] ? dir : 'desc') === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        const x = g(a.item);
        const y = g(b.item);
        return x === y ? 0 : (x < y ? -1 : 1) * mul;
      });
    }
    const page = resolvePage(q, items.length, 12);
    const slice = items.slice(page.skip, page.skip + page.pageSize).map((i) => i.item);
    const data = await this.views.withWishlist(slice, userId);
    return { data, page: page.page, pageSize: page.pageSize, total: items.length };
  }

  async facets(q: RawQuery) {
    const scored = await this.filter({ q: q.q, category: q.category }, !qStr(q, 'category'));
    const { categories } = await this.load();
    const cat = new Map<string, number>();
    const color = new Map<string, { hex: string; count: number }>();
    const mat = new Map<string, number>();
    const style = new Map<string, number>();
    for (const { e } of scored) {
      const it = e.item;
      if (it.category) cat.set(it.category.slug, (cat.get(it.category.slug) ?? 0) + 1);
      for (const c of it.colors)
        color.set(c.name, { hex: c.hex, count: (color.get(c.name)?.count ?? 0) + 1 });
      if (it.material) mat.set(it.material, (mat.get(it.material) ?? 0) + 1);
      if (it.style) style.set(it.style, (style.get(it.style) ?? 0) + 1);
    }
    const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
    return {
      categories: [...cat.entries()]
        .map(([slug, count]) => ({ slug, name: categories.find((c) => c.slug === slug)!.name, count }))
        .sort(byCount),
      colors: [...color.entries()].map(([name, v]) => ({ name, hex: v.hex, count: v.count })).sort(byCount),
      materials: [...mat.entries()].map(([value, count]) => ({ value, count })).sort(byCount),
      styles: [...style.entries()].map(([value, count]) => ({ value, count })).sort(byCount),
    };
  }

  /** Sản phẩm đang bán theo slug (404 nếu không có/ẩn) */
  async bySlug(slug: string): Promise<ProductRow> {
    const row = await this.prisma.product.findFirst({
      where: { slug, status: 'published', deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!row) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Sản phẩm không tồn tại.');
    return row;
  }

  async detail(slug: string, userId: number | null) {
    const p = await this.bySlug(slug);
    const d = await this.views.detail(p);
    const [withWish] = await this.views.withWishlist([d], userId);
    return withWish;
  }

  async model(slug: string) {
    const p = await this.bySlug(slug);
    return this.views.primaryModel(p.id);
  }

  async related(slug: string, userId: number | null) {
    const p = await this.bySlug(slug);
    const { entries, categories } = await this.load();
    const parentOf = (id: number | null) => categories.find((c) => c.id === id)?.parentId ?? null;
    const same = entries.filter((e) => e.row.id !== p.id && e.row.categoryId === p.categoryId);
    const rest = entries.filter(
      (e) =>
        e.row.id !== p.id &&
        e.row.categoryId !== p.categoryId &&
        parentOf(e.row.categoryId) === parentOf(p.categoryId),
    );
    return this.views.withWishlist(
      [...same, ...rest].slice(0, 4).map((e) => e.item),
      userId,
    );
  }
}
