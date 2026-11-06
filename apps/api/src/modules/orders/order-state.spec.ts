// Unit test: máy trạng thái đơn hàng và phí vận chuyển (logic thuần, không cần DB).
import type { OrderStatus } from '@prisma/client';
import { DEFAULT_SHIP_FEE, FREE_SHIP_FROM, shippingFeeFor } from '../cart/cart.service';
import { canTransition } from './admin-orders.service';

const ALL: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'completed',
  'cancelled',
  'refunded',
];

describe('máy trạng thái đơn hàng', () => {
  it('luồng đúng: pending → confirmed → processing → shipping → completed', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'processing')).toBe(true);
    expect(canTransition('processing', 'shipping')).toBe(true);
    expect(canTransition('shipping', 'completed')).toBe(true);
  });
  it('hủy được ở pending, confirmed, processing; không hủy được khi đang giao/đã giao', () => {
    for (const s of ['pending', 'confirmed', 'processing'] as OrderStatus[])
      expect(canTransition(s, 'cancelled')).toBe(true);
    for (const s of ['shipping', 'completed', 'cancelled', 'refunded'] as OrderStatus[])
      expect(canTransition(s, 'cancelled')).toBe(false);
  });
  it('chặn nhảy bước và đi lùi', () => {
    expect(canTransition('pending', 'processing')).toBe(false);
    expect(canTransition('pending', 'shipping')).toBe(false);
    expect(canTransition('confirmed', 'shipping')).toBe(false);
    expect(canTransition('shipping', 'processing')).toBe(false);
    expect(canTransition('completed', 'shipping')).toBe(false);
    expect(canTransition('completed', 'pending')).toBe(false);
  });
  it('trạng thái cuối không chuyển tiếp', () => {
    for (const to of ALL) {
      expect(canTransition('cancelled', to)).toBe(false);
      expect(canTransition('completed', to)).toBe(false);
      expect(canTransition('refunded', to)).toBe(false);
    }
  });
  it('không tự chuyển sang chính nó', () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false);
  });
});

describe('phí vận chuyển', () => {
  const zones = [
    { name: 'TP. Hồ Chí Minh', fee: 30_000, freeFrom: 5_000_000 },
    { name: 'Hà Nội', fee: 40_000, freeFrom: 8_000_000 },
  ];
  it('theo vùng khớp tỉnh của địa chỉ', () => {
    expect(shippingFeeFor(zones, 'TP. Hồ Chí Minh', 1_000_000)).toBe(30_000);
    expect(shippingFeeFor(zones, 'Hà Nội', 1_000_000)).toBe(40_000);
  });
  it('miễn phí khi tạm tính đạt ngưỡng của vùng (≥)', () => {
    expect(shippingFeeFor(zones, 'TP. Hồ Chí Minh', 5_000_000)).toBe(0);
    expect(shippingFeeFor(zones, 'TP. Hồ Chí Minh', 4_999_999)).toBe(30_000);
    expect(shippingFeeFor(zones, 'Hà Nội', 7_999_999)).toBe(40_000);
  });
  it('tỉnh không có trong cấu hình ⇒ phí và ngưỡng mặc định', () => {
    expect(shippingFeeFor(zones, 'Cà Mau', 1_000_000)).toBe(DEFAULT_SHIP_FEE);
    expect(shippingFeeFor(zones, 'Cà Mau', FREE_SHIP_FROM)).toBe(0);
    expect(shippingFeeFor([], undefined, 100)).toBe(DEFAULT_SHIP_FEE);
  });
  it('tổng = tạm tính − giảm giá + phí ship', () => {
    const subtotal = 3_000_000;
    const discount = 300_000;
    const ship = shippingFeeFor(zones, 'Hà Nội', subtotal);
    expect(subtotal - discount + ship).toBe(2_740_000);
  });
});
