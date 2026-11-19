// M10 – Mã giảm giá: kiểm tra + tính số tiền giảm (D-N16: áp mã chỉ xem trước, kiểm tra lại khi đặt hàng trong transaction).
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { serialize } from '../../common/utils/serialize';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaClient | Prisma.TransactionClient;

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
   * đạt đơn tối thiểu. Mã áp cho toàn giỏ. percent = min(⌊base×%⌋, maxDiscount); fixed = min(value, base);
   * freeship = đúng phí vận chuyển.
   */
  async evaluate(code: string, userId: number, subtotal: number, shippingFee: number, db: Db = this.prisma) {
    const c = await db.coupon.findFirst({ where: { code: code.trim() } });
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

    const base = subtotal;
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

  // ------------------------------------------------------------ view
  /** CouponView theo contract (kind: percent | fixed | freeship) */
  view(c: Prisma.CouponGetPayload<object>) {
    return {
      ...serialize(c),
      name: c.name ?? c.code,
      description: c.description ?? null,
      kind: c.type as CouponKind,
    };
  }
}
