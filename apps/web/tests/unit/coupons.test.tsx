// Mã giảm giá phía khách: API giả của GET /coupons/available, popup chọn mã ở giỏ hàng và trang Mã giảm giá.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyCouponsPage from '@/app/(account)/account/coupons/page';
import CouponPickerModal from '@/components/cart/CouponPickerModal';
import { couponDiscountLabel, couponExpiryLabel } from '@/lib/coupon';
import { buildSeed } from '@/mock-data/db';
import { handleMockRequest } from '@/mock-data/mockApi';
import type { AvailableCoupon, CartView } from '@/types/api';

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  apply: vi.fn(),
  remove: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/services/cart.api', () => ({
  cartApi: { availableCoupons: mocks.available, applyCoupon: mocks.apply, removeCoupon: mocks.remove },
}));
vi.mock('@/store/uiStore', () => ({ toast: mocks.toast }));

describe('mock API: GET /coupons/available', () => {
  const call = (method: string, path: string, body?: unknown, token: string | null = null) =>
    handleMockRequest({ method, path, query: {}, body, token });
  const data = <T,>(r: { body: unknown }) => (r.body as { data: T }).data;

  it('cần đăng nhập; chỉ trả mã công khai; tình trạng theo giỏ khớp số tiền khi áp', async () => {
    localStorage.setItem('aurelia-mock-config', JSON.stringify({ latency: false }));
    expect((await call('GET', '/coupons/available')).status).toBe(401);
    const login = await call('POST', '/auth/login', { email: 'khachhang@aurelia.vn', password: '123456' });
    const token = data<{ tokens: { accessToken: string } }>(login).tokens.accessToken;

    const list = data<AvailableCoupon[]>(await call('GET', '/coupons/available', undefined, token));
    const publicCodes = buildSeed()
      .coupons.filter((c) => c.isPublic)
      .map((c) => c.code);
    expect(publicCodes.sort()).toEqual(['FREESHIP', 'GIAM200K', 'GIAM500K', 'WELCOME10']);
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) expect(publicCodes).toContain(c.code);

    const cart = data<CartView>(await call('GET', '/cart', undefined, token));
    for (const c of list) {
      expect(c.eligible).toBe(cart.subtotal >= c.minOrderValue);
      if (!c.eligible) expect(c.reason).toMatch(/^Mua thêm [\d.]+đ để dùng mã$/);
    }
    const best = list.find((c) => c.code === 'GIAM200K')!;
    expect(best).toMatchObject({ eligible: true, isApplied: false, estimatedDiscount: 200_000 });
    const applied = data<CartView>(await call('POST', '/cart/coupon', { code: best.code }, token));
    expect(applied.discountAmount).toBe(best.estimatedDiscount);
    const after = data<AvailableCoupon[]>(await call('GET', '/coupons/available', undefined, token));
    expect(after.filter((c) => c.isApplied).map((c) => c.code)).toEqual(['GIAM200K']);

    await call('DELETE', '/cart', undefined, token);
    const empty = data<AvailableCoupon[]>(await call('GET', '/coupons/available', undefined, token));
    for (const c of empty)
      expect(c).toMatchObject({ eligible: false, reason: 'Giỏ hàng đang trống', estimatedDiscount: 0 });
  });
});

describe('nhãn mã giảm giá', () => {
  it('mức giảm theo loại', () => {
    expect(couponDiscountLabel({ type: 'percent', value: 10, maxDiscount: 500_000 })).toBe(
      'Giảm 10%, tối đa 500.000đ',
    );
    expect(couponDiscountLabel({ type: 'percent', value: 10, maxDiscount: null })).toBe('Giảm 10%');
    expect(couponDiscountLabel({ type: 'fixed', value: 200_000, maxDiscount: null })).toBe('Giảm 200.000đ');
    expect(couponDiscountLabel({ type: 'freeship', value: 0, maxDiscount: null })).toBe(
      'Miễn phí vận chuyển',
    );
  });

  it('hạn dùng: sắp hết hạn thì đếm ngày, còn xa thì ghi ngày', () => {
    const now = new Date('2026-12-01T00:00:00Z');
    const after = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
    expect(couponExpiryLabel(after(0.5), now)).toBe('Còn dưới 1 ngày');
    expect(couponExpiryLabel(after(2.5), now)).toBe('Còn 3 ngày');
    expect(couponExpiryLabel(after(7), now)).toBe('Còn 7 ngày');
    expect(couponExpiryLabel(after(30), now)).toBe('HSD: 31/12/2026');
    expect(couponExpiryLabel(null, now)).toBe('HSD: Không giới hạn');
  });
});

const option = (over: Partial<AvailableCoupon> = {}): AvailableCoupon => ({
  id: 1,
  code: 'GIAM200K',
  name: 'Giảm 200.000đ',
  description: 'Mô tả mã',
  type: 'fixed',
  value: 200_000,
  maxDiscount: null,
  minOrderValue: 2_000_000,
  endsAt: '2099-12-31T00:00:00Z',
  remainingForUser: 2,
  eligible: true,
  reason: null,
  estimatedDiscount: 200_000,
  isApplied: false,
  ...over,
});
const blocked = option({
  id: 2,
  code: 'GIAM500K',
  name: 'Giảm 500.000đ',
  eligible: false,
  reason: 'Mua thêm 500.000đ để dùng mã',
  estimatedDiscount: 0,
});
const CART: CartView = {
  id: 1,
  userId: 1,
  items: [],
  itemCount: 1,
  subtotal: 3_000_000,
  discountAmount: 0,
  shippingFee: 30_000,
  total: 3_030_000,
  coupon: null,
};

function wrap(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}
const row = async (code: string) =>
  (await screen.findAllByTestId('coupon-option')).find((x) => x.dataset.code === code)!;

describe('CouponPickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.available.mockResolvedValue([option(), blocked]);
  });

  it('mã đủ điều kiện áp được: cập nhật giỏ từ server rồi đóng; mã chưa đủ bị khóa và nêu lý do', async () => {
    const next = { ...CART, discountAmount: 200_000, total: 2_830_000 };
    mocks.apply.mockResolvedValue(next);
    const onClose = vi.fn();
    const client = wrap(<CouponPickerModal cart={CART} onClose={onClose} />);

    const locked = await row('GIAM500K');
    expect(within(locked).getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
    expect(within(locked).getByText('Mua thêm 500.000đ để dùng mã')).toBeInTheDocument();

    const ok = await row('GIAM200K');
    expect(within(ok).getByText('Giảm dự kiến 200.000đ')).toBeInTheDocument();
    fireEvent.click(within(ok).getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.apply).toHaveBeenCalledWith('GIAM200K');
    expect(client.getQueryData(['cart'])).toEqual(next);
  });

  it('mã đang áp: có nhãn và nút Bỏ mã (gọi API gỡ mã)', async () => {
    mocks.available.mockResolvedValue([option({ isApplied: true })]);
    mocks.remove.mockResolvedValue(CART);
    const onClose = vi.fn();
    wrap(<CouponPickerModal cart={CART} onClose={onClose} />);
    const applied = await row('GIAM200K');
    expect(within(applied).getByText('Đang áp dụng')).toBeInTheDocument();
    expect(within(applied).queryByRole('button', { name: 'Áp dụng' })).not.toBeInTheDocument();
    fireEvent.click(within(applied).getByRole('button', { name: 'Bỏ mã' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('server từ chối khi áp ⇒ báo lý do, tải lại danh sách, không đóng', async () => {
    mocks.apply.mockRejectedValue(new Error('Mã giảm giá đã hết lượt sử dụng.'));
    const onClose = vi.fn();
    wrap(<CouponPickerModal cart={CART} onClose={onClose} />);
    fireEvent.click(within(await row('GIAM200K')).getByRole('button', { name: 'Áp dụng' }));
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
    await waitFor(() => expect(mocks.available).toHaveBeenCalledTimes(2));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('đóng bằng nút X, phím Esc và bấm ra ngoài', async () => {
    const onClose = vi.fn();
    wrap(<CouponPickerModal cart={CART} onClose={onClose} />);
    await row('GIAM200K');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('đang tải ⇒ có khung chờ', async () => {
    mocks.available.mockReturnValue(new Promise(() => {}));
    wrap(<CouponPickerModal cart={CART} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Đang tải mã giảm giá')).toBeInTheDocument();
  });

  it('không có mã nào ⇒ thông báo trống', async () => {
    mocks.available.mockResolvedValue([]);
    wrap(<CouponPickerModal cart={CART} onClose={vi.fn()} />);
    expect(await screen.findByText('Hiện chưa có mã giảm giá nào')).toBeInTheDocument();
  });

  it('tải lỗi ⇒ báo lỗi và thử lại được', async () => {
    mocks.available.mockRejectedValueOnce(new Error('mạng'));
    wrap(<CouponPickerModal cart={CART} onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await row('GIAM200K')).toBeInTheDocument();
  });
});

describe('trang /account/coupons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.available.mockResolvedValue([option(), blocked]);
  });
  const clipboard = (value: unknown) =>
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value });

  it('hiện điều kiện của mã, không hiện tình trạng theo giỏ; sao chép mã', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard({ writeText });
    wrap(<MyCouponsPage />);
    const cards = await screen.findAllByTestId('account-coupon');
    expect(cards).toHaveLength(2);
    expect(screen.getAllByText('Bạn còn 2 lượt dùng')).toHaveLength(2);
    expect(screen.queryByText(/Mua thêm/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Giảm dự kiến/)).not.toBeInTheDocument();
    for (const card of cards)
      expect(within(card).getByRole('link', { name: 'Dùng ngay' })).toHaveAttribute('href', '/cart');
    const card = cards.find((x) => x.dataset.code === 'GIAM200K')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Sao chép mã' }));
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Đã sao chép mã GIAM200K'));
    expect(writeText).toHaveBeenCalledWith('GIAM200K');
  });

  it.each([
    ['không có clipboard API', undefined],
    ['clipboard bị từ chối', { writeText: () => Promise.reject(new Error('denied')) }],
  ])('%s ⇒ hiện mã để khách tự chép', async (_name, value) => {
    clipboard(value);
    wrap(<MyCouponsPage />);
    const card = (await screen.findAllByTestId('account-coupon')).find((x) => x.dataset.code === 'GIAM200K')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Sao chép mã' }));
    expect(await within(card).findByDisplayValue('GIAM200K')).toBeInTheDocument();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it('không có mã ⇒ thông báo trống', async () => {
    mocks.available.mockResolvedValue([]);
    wrap(<MyCouponsPage />);
    expect(await screen.findByText('Hiện chưa có mã giảm giá nào dành cho bạn')).toBeInTheDocument();
  });
});
