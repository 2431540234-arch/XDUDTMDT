// M10 – Mã giảm giá: kiểm tra + tính số tiền giảm (D-N16: áp mã chỉ xem trước, kiểm tra lại khi đặt hàng trong transaction).
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { FieldErrors, asBody, str } from '../../common/utils/validate';
import { serialize } from '../../common/utils/serialize';
import { qStr, type RawQuery } from '../../common/utils/list-query';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaClient | Prisma.TransactionClient;

export interface CalcLine {
  productId: number;
  categoryId: number | null;
  lineTotal: number;
}

export type CouponKind = 'percent' | 'fixed' | 'freeship';

/** Số tiền giảm: percent = min(⌊base×%⌋, giảm tối đa); fixed = min(giá trị, base); freeship = đúng phí vận chuyển (≤ giảm tối đa) */
export function calcDiscount(
  kind: CouponKind,
  value: number,
  maxDiscount: number | null,
  base: number,
  shippingFee: number,
): number {
  const cap = maxDiscount === null ? Infinity : maxDiscount;
  if (kind === 'percent') return Math.min(Math.floor((base * value) / 100), cap);
  if (kind === 'fixed') return Math.min(value, base);
  return Math.min(shippingFee, cap);
}

const money = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const invalid = (msg: string) => new AppException(ErrorCode.COUPON_INVALID, msg);

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kiểm tra mã và tính giảm giá. Quy tắc: tồn tại, đang bật, trong thời hạn, còn lượt tổng và lượt theo khách,
   * đạt đơn tối thiểu, đúng phạm vi (danh mục). percent = min(⌊base×%⌋, maxDiscount); fixed = min(value, base);
   * freeship = đúng phí vận chuyển.
   */
  async evaluate(
    code: string,
    userId: number,
    lines: CalcLine[],
    subtotal: number,
    shippingFee: number,
    db: Db = this.prisma,
  ) {
    const c = await db.coupon.findFirst({
      where: { code: code.trim() },
      include: { scopes: true },
    });
    if (!c) throw invalid('Mã giảm giá không tồn tại.');
    const now = new Date();
    if (!c.isActive) throw invalid('Mã giảm giá đã bị vô hiệu hóa.');
    if (c.startsAt > now) throw invalid('Mã giảm giá chưa đến thời gian áp dụng.');
    if (c.endsAt && c.endsAt < now) throw invalid('Mã giảm giá đã hết hạn.');
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit)
      throw invalid('Mã giảm giá đã hết lượt sử dụng.');
    if (c.perUserLimit !== null) {
      const used = await db.couponUsage.count({ where: { couponId: c.id, userId } });
      if (used >= c.perUserLimit) throw invalid('Bạn đã dùng hết lượt cho mã giảm giá này.');
    }
    const minOrder = Number(c.minOrderValue);
    if (subtotal < minOrder) throw invalid(`Đơn hàng cần tối thiểu ${money(minOrder)}đ để dùng mã này.`);

    let base = subtotal;
    if (c.scopes.length) {
      const catIds = c.scopes.filter((x) => x.targetType === 'category').map((x) => x.targetId);
      const productIds = new Set(c.scopes.filter((x) => x.targetType === 'product').map((x) => x.targetId));
      const spaceIds = c.scopes.filter((x) => x.targetType === 'space').map((x) => x.targetId);
      if (spaceIds.length) {
        // sản phẩm xuất hiện trong không gian mẫu (qua hotspot loại sản phẩm)
        const hs = await db.spaceHotspot.findMany({
          where: { type: 'product', productId: { not: null }, panorama: { spaceId: { in: spaceIds } } },
          select: { productId: true },
        });
        for (const h of hs) if (h.productId) productIds.add(h.productId);
      }
      const cats = catIds.length ? await db.category.findMany({ select: { id: true, parentId: true } }) : [];
      const parentOf = new Map(cats.map((x) => [x.id, x.parentId]));
      const scoped = lines.filter(
        (l) =>
          productIds.has(l.productId) ||
          (l.categoryId !== null &&
            (catIds.includes(l.categoryId) || catIds.includes(parentOf.get(l.categoryId) ?? -1))),
      );
      if (!scoped.length) throw invalid('Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng.');
      base = scoped.reduce((sum, l) => sum + l.lineTotal, 0);
    }
    const kind = c.type as CouponKind;
    const value = Number(c.value);
    const discount = calcDiscount(
      kind,
      value,
      c.maxDiscount === null ? null : Number(c.maxDiscount),
      base,
      shippingFee,
    );
    return { coupon: c, kind, discount };
  }

  // ------------------------------------------------------------ view & mã của tôi
  /** CouponView theo contract (kind: percent | fixed | freeship) */
  view(c: Prisma.CouponGetPayload<object>) {
    return {
      ...serialize(c),
      name: c.name ?? c.code,
      description: c.description ?? null,
      appliesTo: (c.appliesTo ?? 'all') as 'all' | 'category' | 'product' | 'space',
      appliesToLabel: c.appliesToLabel ?? 'Tất cả sản phẩm',
      kind: c.type as CouponKind,
    };
  }

  private userCouponView(uc: Prisma.UserCouponGetPayload<{ include: { coupon: true } }>, used: boolean) {
    let status: 'unused' | 'used' | 'expired' = used ? 'used' : 'unused';
    if (status === 'unused' && uc.coupon.endsAt && uc.coupon.endsAt < new Date()) status = 'expired';
    return {
      id: uc.id,
      couponId: uc.couponId,
      userId: uc.userId,
      status,
      savedAt: uc.savedAt.toISOString(),
      coupon: this.view(uc.coupon),
    };
  }

  async mine(userId: number, q: RawQuery) {
    const [rows, usages] = await Promise.all([
      this.prisma.userCoupon.findMany({
        where: { userId },
        include: { coupon: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.couponUsage.findMany({ where: { userId }, select: { couponId: true } }),
    ]);
    const used = new Set(usages.map((u) => u.couponId));
    const status = qStr(q, 'status');
    return rows
      .map((r) => this.userCouponView(r, used.has(r.couponId)))
      .filter((r) => !status || r.status === status);
  }

  /** Gợi ý mã chưa lưu, đang trong thời hạn (tối đa 4) */
  async suggested(userId: number) {
    const now = new Date();
    const have = await this.prisma.userCoupon.findMany({ where: { userId }, select: { couponId: true } });
    const rows = await this.prisma.coupon.findMany({
      where: {
        isActive: true,
        id: { notIn: have.map((h) => h.couponId) },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { id: 'asc' },
      take: 4,
    });
    return rows.map((c) => this.view(c));
  }

  async save(userId: number, raw: unknown) {
    const code = str(asBody(raw).code).trim();
    if (!code) new FieldErrors().add('code', 'Vui lòng nhập mã giảm giá.').throwIfAny();
    const c = await this.prisma.coupon.findFirst({ where: { code } });
    if (!c) throw invalid('Mã giảm giá không tồn tại.');
    if (!c.isActive || (c.endsAt && c.endsAt < new Date())) throw invalid('Mã giảm giá đã hết hạn.');
    const dup = await this.prisma.userCoupon.findUnique({
      where: { userId_couponId: { userId, couponId: c.id } },
    });
    if (dup) throw new AppException(ErrorCode.CONFLICT, 'Bạn đã lưu mã giảm giá này rồi.');
    const row = await this.prisma.userCoupon.create({
      data: { userId, couponId: c.id },
      include: { coupon: true },
    });
    return this.userCouponView(row, false);
  }
}
