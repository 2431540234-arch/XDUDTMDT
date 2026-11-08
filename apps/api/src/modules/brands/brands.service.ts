// UC-ADM-06 – Quản lý thương hiệu: thêm/sửa/bật tắt/xóa + logo. Slug UNIQUE (trùng ⇒ 409). Xóa thương hiệu đang có sản phẩm ⇒
// các sản phẩm đó chuyển brandId = NULL (FK SET NULL, Service đặt tường minh). Mọi thao tác ghi kèm activity_logs trong CÙNG transaction.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { qStr, type RawQuery } from '../../common/utils/list-query';
import { toSlug } from '../../common/utils/slug';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { foldVi } from '../../common/utils/vi-fold';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { MediaIngestService } from '../../common/views/media-ingest.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

const INCLUDE = {
  logoMedia: true,
  _count: { select: { products: { where: { deletedAt: null } } } },
} satisfies Prisma.BrandInclude;
type Row = Prisma.BrandGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly ingest: MediaIngestService,
    private readonly activity: ActivityLogService,
    private readonly products: ProductsService,
  ) {}

  private view(b: Row) {
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: this.views.url(b.logoMedia?.filePath),
      isActive: b.isActive,
      productCount: b._count.products,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  async list(q: RawQuery) {
    const rows = await this.prisma.brand.findMany({ include: INCLUDE, orderBy: { id: 'asc' } });
    const search = foldVi(qStr(q, 'q'));
    return rows
      .filter((b) => !search || foldVi(`${b.name} ${b.slug}`).includes(search))
      .map((b) => this.view(b));
  }

  async get(id: number) {
    const b = await this.prisma.brand.findUnique({ where: { id }, include: INCLUDE });
    if (!b) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Thương hiệu không tồn tại.');
    return this.view(b);
  }

  /** Kiểm tra dữ liệu; slug đã được dùng ⇒ 409 (không phải 400) */
  private async check(b: Record<string, unknown>, selfId?: number) {
    const errs = new FieldErrors();
    const name = str(b.name).trim();
    if (!name) errs.add('name', 'Vui lòng nhập tên thương hiệu.');
    else if (name.length > 150) errs.add('name', 'Tên thương hiệu tối đa 150 ký tự.');
    const slug = toSlug(str(b.slug) || name);
    if (name && !slug) errs.add('slug', 'Slug không hợp lệ.');
    if (b.isActive !== undefined && typeof b.isActive !== 'boolean')
      errs.add('isActive', 'Trạng thái không hợp lệ.');
    errs.throwIfAny();
    const dup = await this.prisma.brand.findFirst({
      where: { slug, ...(selfId ? { id: { not: selfId } } : {}) },
      select: { id: true },
    });
    if (dup) {
      throw new AppException(ErrorCode.CONFLICT, 'Slug đã được dùng cho thương hiệu khác.', {
        slug: ['Slug đã được dùng cho thương hiệu khác.'],
      });
    }
    return { name, slug };
  }

  async create(adminId: number, raw: unknown) {
    const b = asBody(raw);
    const { name, slug } = await this.check(b);
    const logoMediaId = b.logoUrl
      ? await this.ingest.ingestImage(str(b.logoUrl), { userId: adminId, folder: 'brands' })
      : null;
    const id = await this.prisma.$transaction(async (tx) => {
      const row = await tx.brand.create({
        data: { name, slug, logoMediaId, isActive: b.isActive !== false },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'brand.create',
          targetType: 'brand',
          targetId: row.id,
          changes: { name, slug },
        },
        tx,
      );
      return row.id;
    });
    await this.products.invalidate();
    return this.get(id);
  }

  async update(adminId: number, id: number, raw: unknown) {
    const cur = await this.prisma.brand.findUnique({ where: { id } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Thương hiệu không tồn tại.');
    const body = asBody(raw);
    // đổi tên không tự đổi slug (giữ liên kết); chỉ đổi khi gửi slug mới
    const { name, slug } = await this.check(
      { ...body, name: body.name ?? cur.name, slug: body.slug ?? cur.slug },
      id,
    );
    const logoMediaId =
      body.logoUrl === null || body.logoUrl === ''
        ? null
        : body.logoUrl
          ? await this.ingest.ingestImage(str(body.logoUrl), { userId: adminId, folder: 'brands' })
          : cur.logoMediaId;
    await this.prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: { id },
        data: {
          name,
          slug,
          logoMediaId,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : cur.isActive,
        },
      });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'brand.update',
          targetType: 'brand',
          targetId: id,
          changes: {
            before: { name: cur.name, slug: cur.slug, isActive: cur.isActive },
            after: { name, slug },
          },
        },
        tx,
      );
    });
    await this.products.invalidate();
    return this.get(id);
  }

  async remove(adminId: number, id: number) {
    const cur = await this.prisma.brand.findUnique({ where: { id } });
    if (!cur) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Thương hiệu không tồn tại.');
    const affected = await this.prisma.$transaction(async (tx) => {
      const r = await tx.product.updateMany({ where: { brandId: id }, data: { brandId: null } });
      await tx.brand.delete({ where: { id } });
      await this.activity.log(
        {
          actorId: adminId,
          action: 'brand.delete',
          targetType: 'brand',
          targetId: id,
          changes: { name: cur.name, productsDetached: r.count },
        },
        tx,
      );
      return r.count;
    });
    await this.products.invalidate();
    return { id, productsDetached: affected };
  }
}
