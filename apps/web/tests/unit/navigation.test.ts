import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/lib/navigation';

describe('navigateTo – URL tương đối đi bằng router, URL cổng thanh toán rời ứng dụng', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('đường dẫn trong FE ⇒ router.push', () => {
    const router = { push: vi.fn() };
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    navigateTo(router, '/checkout/success?order=ALV-1');
    expect(router.push).toHaveBeenCalledWith('/checkout/success?order=ALV-1');
    expect(assign).not.toHaveBeenCalled();
  });

  it('URL cổng VNPAY (https://…) ⇒ window.location.assign, không dùng router', () => {
    const router = { push: vi.fn() };
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    navigateTo(router, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=100');
    expect(assign).toHaveBeenCalledWith('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=100');
    expect(router.push).not.toHaveBeenCalled();
  });
});
