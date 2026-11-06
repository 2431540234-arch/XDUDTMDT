// M12 – Thanh toán. COD/chuyển khoản: thanh toán xác nhận sau (khi giao / admin xác nhận). Online (VNPAY, MoMo, ZaloPay, thẻ):
// chế độ giả lập (PAYMENT_SANDBOX_FAKE=true) quyết định thành công/thất bại ngay như mock; cổng VNPAY sandbox thật ở mốc 4.
import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { notify } from '../../common/utils/notify';
import { asBody, str } from '../../common/utils/validate';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

const ONLINE: PaymentMethod[] = ['vnpay', 'momo', 'zalopay', 'card'];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: AppConfig,
  ) {}

  private async own(userId: number, orderId: number) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return o;
  }

  /** Ghi nhận kết quả thanh toán online (idempotent: đơn đã paid thì không xử lý lại) */
  async settle(orderId: number, success: boolean, gateway?: { code: string; message: string; txn?: string }) {
    await this.prisma.$transaction(async (tx) => {
      const [o] = await tx.$queryRaw<
        Array<{
          id: number;
          status: string;
          payment_status: string;
          order_code: string;
          user_id: number;
          payment_method: string;
        }>
      >`SELECT id, status, payment_status, order_code, user_id, payment_method FROM orders WHERE id = ${orderId} FOR UPDATE`;
      if (!o || o.payment_status === 'paid') return;
      const pay = await tx.payment.findFirst({ where: { orderId }, orderBy: { id: 'desc' } });
      if (!pay) return;
      if (success) {
        const txn =
          gateway?.txn ??
          `${o.payment_method.toUpperCase()}${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
        await tx.payment.update({
          where: { id: pay.id },
          data: {
            status: 'success',
            paidAt: new Date(),
            transactionCode: txn,
            gatewayResponse: {
              code: gateway?.code ?? '00',
              message: gateway?.message ?? 'Giao dịch thành công',
            },
          },
        });
        await this.orders.setActor(tx, null, 'Thanh toán online thành công, hệ thống tự xác nhận');
        // D-N13: thanh toán online thành công ⇒ pending → confirmed (changed_by NULL)
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'paid', ...(o.status === 'pending' ? { status: 'confirmed' } : {}) },
        });
        await notify(
          tx,
          o.user_id,
          `Thanh toán đơn ${o.order_code} thành công`,
          'order',
          'Chúng tôi đã nhận được thanh toán của bạn.',
          `/account/orders/${o.order_code}`,
        );
      } else {
        await tx.payment.update({
          where: { id: pay.id },
          data: {
            status: 'failed',
            gatewayResponse: {
              code: gateway?.code ?? '24',
              message: gateway?.message ?? 'Khách hàng hủy giao dịch',
            },
          },
        });
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'failed' } });
      }
    });
  }

  private requireSandbox() {
    if (!this.config.get('PAYMENT_SANDBOX_FAKE')) {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, 'Cổng thanh toán chưa được cấu hình.');
    }
  }

  async checkout(userId: number, orderId: number, raw: unknown) {
    const o = await this.own(userId, orderId);
    if (o.paymentStatus === 'paid')
      throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã được thanh toán.');
    if (!ONLINE.includes(o.paymentMethod)) return { redirectUrl: `/checkout/success?order=${o.orderCode}` };
    this.requireSandbox();
    const outcome = str(asBody(raw).outcome) || (/\[fail\]/i.test(o.note ?? '') ? 'failed' : 'success');
    await this.settle(o.id, outcome === 'success');
    return { redirectUrl: `/checkout/${outcome === 'success' ? 'success' : 'failed'}?order=${o.orderCode}` };
  }

  async retry(userId: number, orderId: number, raw: unknown) {
    const o = await this.own(userId, orderId);
    if (o.paymentStatus === 'paid')
      throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã được thanh toán.');
    if (o.status === 'cancelled') throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã bị hủy.');
    const method = str(asBody(raw).method) as PaymentMethod;
    let current = o.paymentMethod;
    if (method) {
      current = method;
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: o.id },
          data: { paymentMethod: method, paymentStatus: 'unpaid' },
        }),
        this.prisma.payment.updateMany({ where: { orderId: o.id }, data: { method, status: 'pending' } }),
      ]);
    }
    if (ONLINE.includes(current)) {
      this.requireSandbox();
      await this.settle(o.id, true);
    }
    return { redirectUrl: `/checkout/success?order=${o.orderCode}` };
  }
}
