// M06 – Danh mục sản phẩm: cây 2 cấp (GET /categories). Quản trị danh mục (CRUD) ở admin-categories.
import { Injectable } from '@nestjs/common';
import { CatalogCache } from '../../cache/catalog-cache';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface CategoryNodeView {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  imageMediaId: number | null;
  sortOrder: number;
  isActive: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  productCount: number;
  parentName: string | null;
  children: CategoryNodeView[];
  description: string | null;
  isFeatured: boolean;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly cache: CatalogCache,
  ) {}

  /** Cây danh mục công khai: cache 10 phút (admin sửa danh mục thì ProductsService.invalidate xóa). includeInactive=true cho quản trị: không cache */
  tree(includeInactive = false): Promise<CategoryNodeView[]> {
    return includeInactive ? this.buildTree(true) : this.cache.categoriesTree(() => this.buildTree(false));
  }

  private async buildTree(includeInactive: boolean): Promise<CategoryNodeView[]> {
    const [cats, counts] = await Promise.all([
      this.prisma.category.findMany({ include: { imageMedia: true } }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: includeInactive ? { deletedAt: null } : { status: 'published', deletedAt: null },
        _count: true,
      }),
    ]);
    const count = new Map(counts.map((c) => [c.categoryId, c._count]));
    const node = (c: (typeof cats)[number]): CategoryNodeView => {
      const children = cats
        .filter((x) => x.parentId === c.id && (includeInactive || x.isActive))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(node);
      const own = count.get(c.id) ?? 0;
      const { imageMedia, ...base } = c;
      return {
        ...base,
        imageUrl: this.views.url(imageMedia?.filePath),
        productCount: children.length ? children.reduce((s, x) => s + x.productCount, 0) + own : own,
        parentName: c.parentId ? (cats.find((x) => x.id === c.parentId)?.name ?? null) : null,
        children,
        description: c.description ?? null,
        isFeatured: c.isFeatured ?? false,
      };
    };
    return cats
      .filter((c) => c.parentId === null && (includeInactive || c.isActive))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(node);
  }
}
