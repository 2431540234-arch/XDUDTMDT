// Unit test: quy tắc đổi trả (7 ngày, số lượng tối đa, máy trạng thái) – logic thuần, không cần DB.
import { canReturnTransition } from './admin-returns.service';
import { isWithinReturnWindow, returnableQuantity } from './returns.service';

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
