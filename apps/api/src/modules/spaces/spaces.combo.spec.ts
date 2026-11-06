// Unit test: giá combo không gian mẫu (tính ở server từ giá hiện tại và % giảm).
import { calcComboTotal, COMBO_DISCOUNT_PERCENT } from './spaces.service';

describe('calcComboTotal', () => {
  it('giảm theo % và làm tròn đến nghìn đồng', () => {
    expect(calcComboTotal(10_000_000, 10)).toBe(9_000_000);
    expect(calcComboTotal(10_557_000, 10)).toBe(9_501_000);
    expect(calcComboTotal(1_234_567, 15)).toBe(1_049_000);
  });
  it('0% giảm: giữ nguyên (làm tròn nghìn); không có sản phẩm: 0', () => {
    expect(calcComboTotal(5_000_000, 0)).toBe(5_000_000);
    expect(calcComboTotal(0, 10)).toBe(0);
  });
  it('% mặc định là 10', () => {
    expect(COMBO_DISCOUNT_PERCENT).toBe(10);
  });
});
