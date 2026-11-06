// M08 – Yêu thích: danh sách sản phẩm đã thích, thêm/bỏ theo slug. Bảng: wishlists
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { CatalogViews, PRODUCT_INCLUDE } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
  ) {}

  async list(userId: number) {
    const rows = await this.prisma.wishlist.findMany({
      where: { userId, product: { deletedAt: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { product: { include: PRODUCT_INCLUDE } },
    });
    return rows.map((w) => ({ ...this.views.listItem(w.product), isWishlisted: true }));
  }

  async add(userId: number, slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, status: 'published', deletedAt: null },
      select: { id: true },
    });
    if (!p) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Sản phẩm không tồn tại.');
    await this.prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId: p.id } },
      update: {},
      create: { userId, productId: p.id },
    });
    return null;
  }

  async remove(userId: number, slug: string) {
    const p = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (p) await this.prisma.wishlist.deleteMany({ where: { userId, productId: p.id } });
    return null;
  }
}
