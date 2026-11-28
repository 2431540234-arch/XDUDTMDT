// Chữ hiển thị cho mã giảm giá, dùng chung giữa popup ở giỏ hàng và trang Mã giảm giá
import type { AvailableCoupon } from '@/types/api';
import { formatCurrency, formatDate } from './format';

const DAY = 86_400_000;
/** Từ mức này trở xuống thì hiện "Còn N ngày" thay cho ngày hết hạn */
export const EXPIRING_SOON_DAYS = 7;

/** "Giảm 10%, tối đa 500.000đ" · "Giảm 200.000đ" · "Miễn phí vận chuyển" */
export function couponDiscountLabel(c: Pick<AvailableCoupon, 'type' | 'value' | 'maxDiscount'>): string {
  if (c.type === 'fixed') return `Giảm ${formatCurrency(c.value)}`;
  const cap = c.maxDiscount === null ? '' : `, tối đa ${formatCurrency(c.maxDiscount)}`;
  return c.type === 'percent' ? `Giảm ${c.value}%${cap}` : `Miễn phí vận chuyển${cap}`;
}

export function couponMinOrderLabel(minOrderValue: number): string {
  return minOrderValue > 0 ? `Đơn tối thiểu ${formatCurrency(minOrderValue)}` : 'Mọi đơn hàng';
}

/** Sắp hết hạn: "Còn 3 ngày"; còn xa: "HSD: dd/MM/yyyy" */
export function couponExpiryLabel(endsAt: string | null, now: Date = new Date()): string {
  if (!endsAt) return 'HSD: Không giới hạn';
  const left = new Date(endsAt).getTime() - now.getTime();
  if (left < DAY) return 'Còn dưới 1 ngày';
  if (left <= EXPIRING_SOON_DAYS * DAY) return `Còn ${Math.ceil(left / DAY)} ngày`;
  return `HSD: ${formatDate(endsAt)}`;
}
