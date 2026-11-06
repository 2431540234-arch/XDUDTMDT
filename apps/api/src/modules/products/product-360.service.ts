// Xem 360° của sản phẩm: ảnh theo màu (frame 0°→350°), biến thể kèm kích thước thật, chính sách – GET /products/:slug/360
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { CatalogViews } from '../../common/views/catalog-views.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

export const POLICIES = [
  {
    key: 'shipping',
    title: 'Giao hàng & lắp đặt',
    summary:
      'Giao toàn quốc trong 2–5 ngày. Miễn phí lắp đặt tại nội thành TP.HCM và Hà Nội; miễn phí vận chuyển cho đơn từ 10 triệu đồng.',
    href: '/policies/chinh-sach-van-chuyen',
  },
  {
    key: 'returns',
    title: 'Đổi trả 7 ngày',
    summary:
      'Đổi trả trong 7 ngày kể từ ngày nhận hàng nếu sản phẩm lỗi, giao sai hoặc không đúng mô tả. Lấy hàng miễn phí.',
    href: '/policies/chinh-sach-doi-tra',
  },
  {
    key: 'warranty',
    title: 'Bảo hành 12 tháng',
    summary:
      'Bảo hành chính hãng từ 12 tháng cho kết cấu, vải, mút và da; một số sản phẩm gỗ được bảo hành đến 36 tháng.',
    href: '/policies/chinh-sach-bao-hanh',
  },
  {
    key: 'payment',
    title: 'Phương thức thanh toán',
    summary: 'Thanh toán khi nhận hàng (COD), chuyển khoản, thẻ ngân hàng, VNPAY, MoMo và ZaloPay.',
    href: '/policies/chinh-sach-mua-hang',
  },
] as const;

@Injectable()
export class Product360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: CatalogViews,
    private readonly products: ProductsService,
  ) {}

  async view(slug: string, userId: number | null) {
    const p = await this.products.bySlug(slug);
    const cfg = await this.prisma.product360Config.findUnique({
      where: { productId: p.id },
      include: {
        frames: {
          orderBy: [{ attributeValueId: 'asc' }, { frameIndex: 'asc' }],
          include: { media: true, color: true },
        },
      },
    });
    if (!cfg?.enabled)
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Ảnh 360° của sản phẩm không tồn tại.');

    // gom frame theo màu (mỗi màu: danh sách URL theo thứ tự góc, ảnh đại diện = frame đầu)
    const byColor = new Map<number, { colorId: number; name: string; hex: string; frames: string[] }>();
    for (const f of cfg.frames) {
      const c = byColor.get(f.attributeValueId) ?? {
        colorId: f.attributeValueId,
        name: f.color.value,
        hex: f.color.colorHex ?? '#cccccc',
        frames: [],
      };
      c.frames.push(this.views.url(f.media.filePath) ?? '');
      byColor.set(f.attributeValueId, c);
    }
    const colors = [...byColor.values()].map((c) => ({ ...c, thumbnail: c.frames[0] ?? '' }));

    const dims = await this.dimensions(p.id);
    const variants = this.views
      .variantViews(p)
      .filter((v) => v.isActive)
      .map((v) => ({
        ...v,
        dimensionsCm: dims.get(v.id) ?? { length: 0, width: 0, height: 0 },
        weightKg: v.weightGram ? Math.round(v.weightGram / 100) / 10 : null,
      }));
    const defaultColor = colors.find((c) => c.colorId === cfg.defaultColorId)?.name ?? colors[0]?.name ?? '';
    const detail = await this.views.detail(p);
    const [product] = await this.views.withWishlist([detail], userId);
    return {
      productId: p.id,
      slug: p.slug,
      enabled: true,
      frameCount: cfg.frameCount,
      defaultColor,
      autoRotate: cfg.autoRotate,
      rotationSpeed: cfg.rotationSpeed,
      colors,
      variants,
      product,
      policies: POLICIES,
    };
  }

  /** Kích thước (cm) từng biến thể lấy từ cột length/width/height của biến thể */
  private async dimensions(productId: number) {
    const rows = await this.prisma.productVariant.findMany({
      where: { productId },
      select: { id: true, lengthCm: true, widthCm: true, heightCm: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { length: Number(r.lengthCm ?? 0), width: Number(r.widthCm ?? 0), height: Number(r.heightCm ?? 0) },
      ]),
    );
  }
}
