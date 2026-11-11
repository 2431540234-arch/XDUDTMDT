// Unit test: tính giảm giá và kiểm tra mã – mọi điều kiện (hạn, đơn tối thiểu, phạm vi, giảm tối đa, lượt dùng) – không cần DB.
import { calcDiscount, CouponsService } from './coupons.service';
import { couponState } from './admin-coupons.service';

type FakeCoupon = Record<string, unknown>;

/** DB giả tối thiểu cho CouponsService.evaluate */
function fakeDb(
  coupon: FakeCoupon | null,
  opts: {
    usedByUser?: number;
    categories?: Array<{ id: number; parentId: number | null }>;
    spaceProducts?: number[];
  } = {},
) {
  return {
    coupon: { findFirst: async () => coupon },
    couponUsage: { count: async () => opts.usedByUser ?? 0 },
    category: { findMany: async () => opts.categories ?? [] },
    spaceHotspot: { findMany: async () => (opts.spaceProducts ?? []).map((productId) => ({ productId })) },
  } as never;
}

const baseCoupon = (over: FakeCoupon = {}): FakeCoupon => ({
  id: 1,
  code: 'TEST',
  type: 'percent',
  value: 10,
  maxDiscount: null,
  minOrderValue: 0,
  usageLimit: null,
  perUserLimit: null,
  usedCount: 0,
  startsAt: new Date(Date.now() - 86_400_000),
  endsAt: new Date(Date.now() + 86_400_000),
  isActive: true,
  scopes: [],
  ...over,
});

const lines = [
  { productId: 10, categoryId: 5, lineTotal: 6_000_000 },
  { productId: 11, categoryId: 6, lineTotal: 4_000_000 },
];
const svc = new CouponsService({} as never);
const run = (c: FakeCoupon | null, opts = {}, sub = 10_000_000, ship = 30_000) =>
  svc.evaluate('TEST', 1, lines, sub, ship, fakeDb(c, opts));

describe('calcDiscount', () => {
  it('percent: làm tròn xuống và bị chặn bởi giảm tối đa', () => {
    expect(calcDiscount('percent', 10, null, 1_999_999, 0)).toBe(199_999);
    expect(calcDiscount('percent', 10, 150_000, 10_000_000, 0)).toBe(150_000);
  });
  it('fixed: không giảm quá giá trị đơn', () => {
    expect(calcDiscount('fixed', 500_000, null, 10_000_000, 0)).toBe(500_000);
    expect(calcDiscount('fixed', 500_000, null, 300_000, 0)).toBe(300_000);
  });
  it('freeship: giảm đúng phí vận chuyển (không vượt giảm tối đa)', () => {
    expect(calcDiscount('freeship', 0, null, 5_000_000, 30_000)).toBe(30_000);
    expect(calcDiscount('freeship', 0, 20_000, 5_000_000, 30_000)).toBe(20_000);
    expect(calcDiscount('freeship', 0, null, 5_000_000, 0)).toBe(0);
  });
});

describe('CouponsService.evaluate', () => {
  it('mã hợp lệ: tính theo tạm tính', async () => {
    const r = await run(baseCoupon());
    expect(r.discount).toBe(1_000_000);
    expect(r.kind).toBe('percent');
  });
  it('không tồn tại', async () => {
    await expect(run(null)).rejects.toMatchObject({
      code: 'COUPON_INVALID',
      message: 'Mã giảm giá không tồn tại.',
    });
  });
  it('bị vô hiệu hóa', async () => {
    await expect(run(baseCoupon({ isActive: false }))).rejects.toMatchObject({
      message: 'Mã giảm giá đã bị vô hiệu hóa.',
    });
  });
  it('chưa đến hạn', async () => {
    await expect(run(baseCoupon({ startsAt: new Date(Date.now() + 86_400_000) }))).rejects.toMatchObject({
      message: 'Mã giảm giá chưa đến thời gian áp dụng.',
    });
  });
  it('đã hết hạn', async () => {
    await expect(run(baseCoupon({ endsAt: new Date(Date.now() - 1000) }))).rejects.toMatchObject({
      message: 'Mã giảm giá đã hết hạn.',
    });
  });
  it('hết lượt tổng', async () => {
    await expect(run(baseCoupon({ usageLimit: 5, usedCount: 5 }))).rejects.toMatchObject({
      message: 'Mã giảm giá đã hết lượt sử dụng.',
    });
    await expect(run(baseCoupon({ usageLimit: 5, usedCount: 4 }))).resolves.toBeTruthy();
  });
  it('hết lượt theo khách', async () => {
    await expect(run(baseCoupon({ perUserLimit: 2 }), { usedByUser: 2 })).rejects.toMatchObject({
      message: 'Bạn đã dùng hết lượt cho mã giảm giá này.',
    });
    await expect(run(baseCoupon({ perUserLimit: 2 }), { usedByUser: 1 })).resolves.toBeTruthy();
  });
  it('chưa đạt đơn tối thiểu', async () => {
    await expect(run(baseCoupon({ minOrderValue: 12_000_000 }))).rejects.toMatchObject({
      message: 'Đơn hàng cần tối thiểu 12.000.000đ để dùng mã này.',
    });
  });
  it('phạm vi danh mục: chỉ tính dòng thuộc danh mục (kể cả danh mục con của danh mục áp dụng)', async () => {
    const scoped = baseCoupon({ scopes: [{ targetType: 'category', targetId: 5 }] });
    expect((await run(scoped)).discount).toBe(600_000); // 10% của 6.000.000
    const parentScoped = baseCoupon({ scopes: [{ targetType: 'category', targetId: 2 }] });
    const r = await run(parentScoped, {
      categories: [
        { id: 5, parentId: 2 },
        { id: 6, parentId: 3 },
      ],
    });
    expect(r.discount).toBe(600_000);
  });
  it('phạm vi danh mục nhưng giỏ không có sản phẩm phù hợp', async () => {
    await expect(
      run(baseCoupon({ scopes: [{ targetType: 'category', targetId: 99 }] })),
    ).rejects.toMatchObject({ message: 'Mã giảm giá không áp dụng cho sản phẩm trong giỏ hàng.' });
  });
  it('phạm vi sản phẩm', async () => {
    const r = await run(baseCoupon({ scopes: [{ targetType: 'product', targetId: 11 }] }));
    expect(r.discount).toBe(400_000);
  });
  it('phạm vi không gian mẫu: tính theo sản phẩm có trong không gian', async () => {
    const r = await run(baseCoupon({ scopes: [{ targetType: 'space', targetId: 7 }] }), {
      spaceProducts: [10],
    });
    expect(r.discount).toBe(600_000);
  });
  it('giảm tối đa áp dụng sau khi tính theo phạm vi', async () => {
    const r = await run(baseCoupon({ maxDiscount: 100_000 }));
    expect(r.discount).toBe(100_000);
  });
  it('freeship: giảm bằng phí ship hiện tại', async () => {
    const r = await run(baseCoupon({ type: 'freeship', value: 0 }), {}, 10_000_000, 45_000);
    expect(r.discount).toBe(45_000);
  });
});

describe('couponState (trạng thái theo thời gian)', () => {
  const now = new Date('2026-11-06T00:00:00Z');
  const day = 86_400_000;
  it('đang diễn ra', () => {
    expect(
      couponState({ isActive: true, startsAt: new Date(+now - day), endsAt: new Date(+now + day) }, now),
    ).toBe('active');
    expect(couponState({ isActive: true, startsAt: new Date(+now - day), endsAt: null }, now)).toBe('active');
  });
  it('sắp diễn ra', () => {
    expect(
      couponState({ isActive: true, startsAt: new Date(+now + day), endsAt: new Date(+now + 2 * day) }, now),
    ).toBe('upcoming');
  });
  it('đã kết thúc (hết hạn hoặc bị tắt)', () => {
    expect(
      couponState({ isActive: true, startsAt: new Date(+now - 2 * day), endsAt: new Date(+now - day) }, now),
    ).toBe('ended');
    expect(
      couponState({ isActive: false, startsAt: new Date(+now - day), endsAt: new Date(+now + day) }, now),
    ).toBe('ended');
  });
});
