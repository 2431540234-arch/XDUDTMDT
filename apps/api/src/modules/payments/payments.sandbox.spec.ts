import { AppException } from '../../common/exceptions/app.exception';
import { PaymentsService, sandboxAllowed } from './payments.service';

describe('thanh toán giả lập chỉ chạy khi PAYMENT_SANDBOX_FAKE=true VÀ không phải production', () => {
  it('sandboxAllowed', () => {
    expect(sandboxAllowed(true, 'development')).toBe(true);
    expect(sandboxAllowed(true, 'test')).toBe(true);
    expect(sandboxAllowed(false, 'development')).toBe(false);
    expect(sandboxAllowed(true, 'production')).toBe(false);
    expect(sandboxAllowed(false, 'production')).toBe(false);
  });

  const make = (fake: boolean, env: string) => {
    const order = {
      id: 1,
      userId: 7,
      paymentStatus: 'unpaid',
      paymentMethod: 'vnpay',
      note: null,
      orderCode: 'ALV-1',
    };
    const prisma = { order: { findFirst: async () => order } };
    const config = { get: (k: string) => (k === 'PAYMENT_SANDBOX_FAKE' ? fake : env) };
    const svc = new PaymentsService(prisma as never, {} as never, config as never, {} as never);
    const settle = jest.spyOn(svc, 'settle').mockResolvedValue(undefined);
    return { svc, settle };
  };

  it('production hoặc tắt cờ ⇒ checkout online bị từ chối 503 và KHÔNG ghi nhận thanh toán', async () => {
    for (const [fake, env] of [
      [true, 'production'],
      [false, 'development'],
    ] as const) {
      const { svc, settle } = make(fake, env);
      await expect(svc.checkout(7, 1)).rejects.toBeInstanceOf(AppException);
      expect(settle).not.toHaveBeenCalled();
    }
  });

  it('dev + bật cờ ⇒ chạy giả lập; ghi chú chứa [fail] thì thất bại, khách không chọn được kết quả', async () => {
    const { svc, settle } = make(true, 'development');
    await expect(svc.checkout(7, 1)).resolves.toEqual({ redirectUrl: '/checkout/success?order=ALV-1' });
    expect(settle).toHaveBeenCalledWith(1, true);
    // chữ ký checkout(userId, orderId) không còn nhận body ⇒ không thể gửi outcome
    expect(svc.checkout.length).toBe(2);
  });
});
