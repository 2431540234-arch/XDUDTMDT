// Phương thức thanh toán bị tắt trong Cài đặt (settings.payments[].enabled = false) thì không được dùng để đặt hàng/thanh toán lại.
// Phương thức không có trong danh sách cài đặt được coi là cho phép (cấu hình cũ/chưa đầy đủ).
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../exceptions/app.exception';
import type { PrismaService } from '../../prisma/prisma.service';

const LABEL: Record<string, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  card: 'Thẻ ngân hàng / thẻ tín dụng',
  vnpay: 'VNPAY',
  momo: 'Ví MoMo',
  zalopay: 'Ví ZaloPay',
};

export async function assertPaymentMethodEnabled(
  prisma: Pick<PrismaService, 'setting'>,
  method: string,
): Promise<void> {
  const row = await prisma.setting.findUnique({ where: { key: 'payments' } });
  const list = Array.isArray(row?.value) ? (row!.value as Array<{ method?: string; enabled?: boolean }>) : [];
  const entry = list.find((p) => p.method === method);
  if (entry && entry.enabled === false) {
    const msg = `Phương thức "${LABEL[method] ?? method}" hiện không khả dụng. Vui lòng chọn phương thức thanh toán khác.`;
    throw new AppException(ErrorCode.VALIDATION_FAILED, msg, { paymentMethod: [msg] });
  }
}
