// Unit test: quy tắc đổi trả (7 ngày, số lượng tối đa, máy trạng thái) – logic thuần, không cần DB.
import { canReturnTransition } from './admin-returns.service';
import { isWithinReturnWindow, returnableQuantity, goodsDiscountOf, refundShare } from './returns.service';

type S = 'pending' | 'picking' | 'inspecting' | 'refunded' | 'exchanged' | 'rejected';
const ALL: S[] = ['pending', 'picking', 'inspecting', 'refunded', 'exchanged', 'rejected'];

describe('hạn đổi trả 7 ngày', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it('trong 7 ngày kể từ lúc giao', () => {
    expect(isWithinReturnWindow(new Date('2026-11-10T00:00:00Z'), now)).toBe(true);
    expect(isWithinReturnWindow(new Date('2026-11-03T12:00:00Z'), now)).toBe(true); // đúng 7 ngày
  });
  it('quá 7 ngày hoặc chưa giao ⇒ không được đổi trả', () => {
    expect(isWithinReturnWindow(new Date('2026-11-03T11:59:59Z'), now)).toBe(false);
    expect(isWithinReturnWindow(new Date('2026-10-01T00:00:00Z'), now)).toBe(false);
    expect(isWithinReturnWindow(null, now)).toBe(false);
  });
});

describe('số lượng đổi trả tối đa', () => {
  it('= số đã mua − số đã yêu cầu trước đó', () => {
    expect(returnableQuantity(3, 0)).toBe(3);
    expect(returnableQuantity(3, 2)).toBe(1);
    expect(returnableQuantity(3, 3)).toBe(0);
    expect(returnableQuantity(3, 5)).toBe(0);
  });
});

describe('máy trạng thái đổi trả', () => {
  it('luồng đúng: pending → picking → inspecting → refunded | exchanged', () => {
    expect(canReturnTransition('pending', 'picking')).toBe(true);
    expect(canReturnTransition('picking', 'inspecting')).toBe(true);
    expect(canReturnTransition('inspecting', 'refunded')).toBe(true);
    expect(canReturnTransition('inspecting', 'exchanged')).toBe(true);
  });
  it('từ chối được ở pending, picking, inspecting', () => {
    for (const s of ['pending', 'picking', 'inspecting'] as S[])
      expect(canReturnTransition(s, 'rejected')).toBe(true);
  });
  it('chặn nhảy bước, đi lùi và chuyển từ trạng thái cuối', () => {
    expect(canReturnTransition('pending', 'inspecting')).toBe(false);
    expect(canReturnTransition('pending', 'refunded')).toBe(false);
    expect(canReturnTransition('picking', 'refunded')).toBe(false);
    expect(canReturnTransition('inspecting', 'picking')).toBe(false);
    for (const final of ['refunded', 'exchanged', 'rejected'] as S[]) {
      for (const to of ALL) expect(canReturnTransition(final, to)).toBe(false);
    }
  });
});

describe('refundShare – tiền hoàn = tiền khách thực trả cho món (chia coupon theo tỉ lệ, không hoàn phí ship)', () => {
  const sofa = { unitPrice: 6_000_000, quantity: 1 };
  const lamp = { unitPrice: 4_000_000, quantity: 1 };

  it('đơn không coupon: hoàn đúng giá dòng', () => {
    expect(refundShare([sofa], 10_000_000, 0)).toBe(6_000_000);
  });
  it('đơn có coupon 10% (giảm 1.000.000 trên 10.000.000): mỗi món bị trừ theo tỉ lệ', () => {
    expect(refundShare([sofa], 10_000_000, 1_000_000)).toBe(5_400_000);
    expect(refundShare([lamp], 10_000_000, 1_000_000)).toBe(3_600_000);
  });
  it('trả hết mọi dòng thì tổng hoàn = tiền hàng khách đã trả (tạm tính − giảm giá), không gồm phí ship', () => {
    const paidGoods = 10_000_000 - 1_000_000;
    expect(refundShare([sofa, lamp], 10_000_000, 1_000_000)).toBe(paidGoods);
    // tổng đơn = 9.000.000 + phí ship 500.000; hoàn không vượt 9.000.000
    expect(refundShare([sofa, lamp], 10_000_000, 1_000_000)).toBeLessThan(9_000_000 + 500_000);
  });
  it('số lượng nhiều, làm tròn đến đồng, mã giảm cố định', () => {
    expect(refundShare([{ unitPrice: 333_333, quantity: 3 }], 1_000_000, 100_000)).toBe(899_999);
    expect(refundShare([{ unitPrice: 1_000_000, quantity: 1 }], 3_000_000, 1)).toBe(1_000_000 - 0);
  });
  it('mã freeship giảm vào phí ship nên không làm giảm tiền hoàn của hàng', () => {
    expect(goodsDiscountOf({ discountAmount: 500_000, coupon: { type: 'freeship' } })).toBe(0);
    expect(goodsDiscountOf({ discountAmount: 500_000, coupon: { type: 'percent' } })).toBe(500_000);
    expect(goodsDiscountOf({ discountAmount: 0, coupon: null })).toBe(0);
    expect(
      refundShare(
        [sofa],
        10_000_000,
        goodsDiscountOf({ discountAmount: 30_000, coupon: { type: 'freeship' } }),
      ),
    ).toBe(6_000_000);
  });
  it('dữ liệu rỗng/không hợp lệ ⇒ 0', () => {
    expect(refundShare([], 10_000_000, 0)).toBe(0);
    expect(refundShare([sofa], 0, 0)).toBe(0);
  });
});
