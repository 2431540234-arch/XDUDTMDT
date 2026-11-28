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

type CouponRow = Prisma.CouponGetPayload<object>;

/**
 * Lý do mã KHÔNG dùng được, bất kể giỏ hàng (đang tắt, ngoài thời hạn, hết lượt tổng hoặc lượt của khách); null = dùng được.
 * Dùng chung cho áp mã, đặt hàng và danh sách mã công khai. Thứ tự kiểm tra quyết định thông báo trả về.
 */
export function couponBlocker(c: CouponRow, usedByUser: number, now = new Date()): string | null {
  if (!c.isActive) return 'Mã giảm giá đã bị vô hiệu hóa.';
  if (c.startsAt > now) return 'Mã giảm giá chưa đến thời gian áp dụng.';
  if (c.endsAt && c.endsAt < now) return 'Mã giảm giá đã hết hạn.';
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'Mã giảm giá đã hết lượt sử dụng.';
  if (c.perUserLimit !== null && usedByUser >= c.perUserLimit)
    return 'Bạn đã dùng hết lượt cho mã giảm giá này.';
  return null;
}

/** Số tiền tạm tính còn thiếu để đạt đơn tối thiểu của mã (0 = đã đạt) */
export function minOrderShortfall(c: Pick<CouponRow, 'minOrderValue'>, subtotal: number): number {
  return Math.max(0, Number(c.minOrderValue) - subtotal);
}

/** Số tiền được giảm của một mã đã đạt điều kiện */
function discountOf(c: CouponRow, subtotal: number, shippingFee: number): number {
  return calcDiscount(
    c.type as CouponKind,
    Number(c.value),
    c.maxDiscount === null ? null : Number(c.maxDiscount),
    subtotal,
    shippingFee,
  );
}

/** Phần của giỏ hàng cần để xét mã (lấy từ CartView do server tính) */
export interface CartSummary {
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  coupon: { id: number } | null;
}

/** Một mã công khai khách còn dùng được, kèm tình trạng theo giỏ hiện tại */
export interface AvailableCoupon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: CouponKind;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  endsAt: Date | null;
  /** null = mã không giới hạn lượt mỗi khách */
  remainingForUser: number | null;
  eligible: boolean;
  reason: string | null;
  estimatedDiscount: number;
  isApplied: boolean;
}

/** Mã dùng được đứng trước (giảm nhiều hơn trước), rồi mã chưa đủ điều kiện; bằng nhau thì hết hạn sớm đứng trước */
function byUsefulness(a: AvailableCoupon, b: AvailableCoupon): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.estimatedDiscount !== b.estimatedDiscount) return b.estimatedDiscount - a.estimatedDiscount;
  const end = (c: AvailableCoupon) => c.endsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return end(a) - end(b) || a.code.localeCompare(b.code);
}

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
    const used =
      c.perUserLimit === null ? 0 : await db.couponUsage.count({ where: { couponId: c.id, userId } });
    const blocker = couponBlocker(c, used);
    if (blocker) throw invalid(blocker);
    if (minOrderShortfall(c, subtotal) > 0)
      throw invalid(`Đơn hàng cần tối thiểu ${money(Number(c.minOrderValue))}đ để dùng mã này.`);

    return { coupon: c, kind: c.type as CouponKind, discount: discountOf(c, subtotal, shippingFee) };
  }

  /**
   * Mã CÔNG KHAI mà khách còn dùng được, kèm tình trạng theo giỏ hiện tại. Mã riêng tư không bao giờ được trả về.
   * Chỉ để hiển thị: áp mã vẫn qua giỏ hàng và đặt hàng vẫn kiểm tra lại (evaluate).
   */
  async listAvailable(userId: number, cart: CartSummary): Promise<AvailableCoupon[]> {
    const now = new Date();
    const rows = await this.prisma.coupon.findMany({
      where: {
        isPublic: true,
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });
    if (!rows.length) return [];
    const usages = await this.prisma.couponUsage.groupBy({
      by: ['couponId'],
      where: { userId, couponId: { in: rows.map((c) => c.id) } },
      _count: true,
    });
    const usedOf = new Map(usages.map((u) => [u.couponId, u._count]));

    return rows
      .filter((c) => couponBlocker(c, usedOf.get(c.id) ?? 0, now) === null)
      .map((c): AvailableCoupon => {
        const empty = cart.itemCount === 0;
        const shortfall = minOrderShortfall(c, cart.subtotal);
        const eligible = !empty && shortfall === 0;
        return {
          id: c.id,
          code: c.code,
          name: c.name ?? c.code,
          description: c.description,
          type: c.type as CouponKind,
          value: Number(c.value),
          maxDiscount: c.maxDiscount === null ? null : Number(c.maxDiscount),
          minOrderValue: Number(c.minOrderValue),
          endsAt: c.endsAt,
          remainingForUser: c.perUserLimit === null ? null : c.perUserLimit - (usedOf.get(c.id) ?? 0),
          eligible,
          reason: empty
            ? 'Giỏ hàng đang trống'
            : shortfall > 0
              ? `Mua thêm ${money(shortfall)}đ để dùng mã`
              : null,
          estimatedDiscount: eligible ? discountOf(c, cart.subtotal, cart.shippingFee) : 0,
          isApplied: cart.coupon?.id === c.id,
        };
      })
      .sort(byUsefulness);
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
