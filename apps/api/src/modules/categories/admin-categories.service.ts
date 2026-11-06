// UC-ADM-05 – Quản trị danh mục: cây 2 cấp, slug unique tự sinh, thứ tự, bật/tắt, cờ nổi bật.
// Không xóa danh mục còn sản phẩm hoặc còn danh mục con (RESOURCE_IN_USE, thông báo tiếng Việt).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str, toId } from '../../common/utils/validate';
import { toSlug } from '../../common/utils/slug';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CategoriesService } from './categories.service';

@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly ingest: MediaIngestService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
  ) {}

  tree() {
    return this.categories.tree(true);
  }

  private async node(id: number) {
    const roots = await this.categories.tree(true);
    return roots.flatMap((r) => [r, ...r.children]).find((c) => c.id === id);
  }

  /** Kiểm tra dữ liệu, trả về slug đã chuẩn hóa */
  private async validate(b: Record<string, unknown>, selfId?: number) {
    const errs = new FieldErrors();
    if (str(b.name).trim().length < 2) errs.add('name', 'Vui lòng nhập tên danh mục.');
    const slug = toSlug(str(b.slug) || str(b.name));
    if (!slug) errs.add('slug', 'Slug không hợp lệ.');
    else if (
      await this.prisma.category.findFirst({ where: { slug, ...(selfId ? { id: { not: selfId } } : {}) } })
    ) {
      errs.add('slug', 'Slug đã tồn tại.');
    }
    const parentId = toId(b.parentId);
    if (b.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) errs.add('parentId', 'Danh mục cha không tồn tại.');
      else if (parent.parentId) errs.add('parentId', 'Chỉ hỗ trợ danh mục 2 cấp.');
      else if (selfId && parentId === selfId) errs.add('parentId', 'Danh mục cha không hợp lệ.');
    }
    errs.throwIfAny();
    return slug;
  }

  async create(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const slug = await this.validate(b);
    const imageMediaId = b.imageUrl
      ? await this.ingest.ingestImage(str(b.imageUrl), { userId: adminId, folder: 'categories' })
      : null;
    const max = await this.prisma.category.aggregate({ _max: { sortOrder: true } });
    const c = await this.prisma.category.create({
      data: {
        parentId: b.parentId ? toId(b.parentId) : null,
        name: str(b.name).trim(),
        slug,
        imageMediaId,
        sortOrder: Number(b.sortOrder) || (max._max.sortOrder ?? 0) + 1,
        isActive: b.isActive !== false,
        description: str(b.description) || null,
        isFeatured: Boolean(b.isFeatured),
      },
    });
    await this.activity.log({
      actorId: adminId,
      action: 'category.create',
      targetType: 'category',
      targetId: c.id,
    });
    this.products.invalidate();
    return this.node(c.id);
  }

  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.prisma.category.findUnique({ where: { id } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Danh mục không tồn tại.');
    const body = asBody(raw);
    const b = { ...cur, ...body } as Record<string, unknown>;
    const slug = await this.validate(b, id);
    await this.prisma.category.update({
      where: { id },
      data: {
        name: str(b.name).trim(),
        slug,
        parentId: b.parentId ? toId(b.parentId) : null,
        sortOrder: Number(b.sortOrder) || cur.sortOrder,
        isActive: b.isActive !== false,
        ...(body.imageUrl
          ? {
              imageMediaId: await this.ingest.ingestImage(str(body.imageUrl), {
                userId: adminId,
                folder: 'categories',
              }),
            }
          : {}),
        ...(body.description !== undefined ? { description: str(body.description) || null } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: Boolean(body.isFeatured) } : {}),
      },
    });
    await this.activity.log({
      actorId: adminId,
      action: 'category.update',
      targetType: 'category',
      targetId: id,
    });
    this.products.invalidate();
    return this.node(id);
  }

  async remove(adminId: number, id: number) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Danh mục không tồn tại.');
    const [children, prods] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
    ]);
    if (children || prods) {
      throw new AppException(
        ErrorCode.RESOURCE_IN_USE,
        children
          ? 'Danh mục còn danh mục con, hãy xóa hoặc chuyển danh mục con trước.'
          : `Danh mục còn ${prods} sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước khi xóa.`,
        { children, products: prods },
      );
    }
    await this.prisma.category.delete({ where: { id } });
    await this.activity.log({
      actorId: adminId,
      action: 'category.delete',
      targetType: 'category',
      targetId: id,
    });
    this.products.invalidate();
    return null;
  }
}
