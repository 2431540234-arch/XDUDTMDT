// M12 – Thanh toán. COD/chuyển khoản: thanh toán xác nhận sau (khi giao / admin xác nhận). Online (VNPAY, MoMo, ZaloPay, thẻ):
// VNPAY/thẻ: có VNPAY_TMN_CODE + VNPAY_HASH_SECRET ⇒ tạo URL thanh toán có chữ ký, nhận kết quả qua Return URL + IPN (UC-PAY-01/02/03);
// chưa có khóa ⇒ chế độ giả lập (PAYMENT_SANDBOX_FAKE=true, không production) quyết định thành công/thất bại ngay như mock.
import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { assertPaymentMethodEnabled } from '../../common/utils/payment-methods';
import { asBody, str } from '../../common/utils/validate';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { buildPaymentUrl, IPN, parseTxnRef, verify, type VnpayConfig } from './vnpay';

/** Giả lập thanh toán chỉ khi bật cờ VÀ không phải production */
export function sandboxAllowed(flag: boolean, nodeEnv: string): boolean {
  return flag === true && nodeEnv !== 'production';
}

const ONLINE: PaymentMethod[] = ['vnpay', 'momo', 'zalopay', 'card'];
/** Phương thức đi qua cổng VNPAY (thẻ ngân hàng cũng qua VNPAY – D-N17); MoMo/ZaloPay chỉ giả lập */
const VNPAY_METHODS: PaymentMethod[] = ['vnpay', 'card'];

export type SettleResult = 'applied' | 'already' | 'missing';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
  ) {}

  private async own(userId: number, orderId: number) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return o;
  }

  /** Ghi nhận kết quả thanh toán online (idempotent: đơn đã paid thì không xử lý lại) */
  async settle(
    orderId: number,
    success: boolean,
    gateway?: { code: string; message: string; txn?: string },
    paymentId?: number,
  ): Promise<SettleResult> {
    return this.prisma.$transaction(async (tx): Promise<SettleResult> => {
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
      if (!o) return 'missing';
      if (o.payment_status === 'paid') return 'already';
      const pay = paymentId
        ? await tx.payment.findFirst({ where: { id: paymentId, orderId } })
        : await tx.payment.findFirst({ where: { orderId }, orderBy: { id: 'desc' } });
      if (!pay) return 'missing';
      // Đơn đã hủy: giao dịch pending đã bị đóng (failed) lúc hủy, nhưng tiền khách vẫn có thể về muộn ⇒ vẫn ghi nhận success
      // (UC-PAY-02) để admin hoàn tiền được (UC-ADM-23).
      const lateAfterCancel = success && o.status === 'cancelled' && pay.status === 'failed';
      if (paymentId && pay.status !== 'pending' && !lateAfterCancel) return 'already'; // IPN gọi lại / giao dịch cũ đã đóng
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
        if (o.status === 'cancelled') {
          // trạng thái đơn giữ nguyên cancelled; chỉ báo admin cần hoàn tiền
          const admins = await tx.user.findMany({
            where: { deletedAt: null, userRoles: { some: { role: { code: 'admin' } } } },
            select: { id: true },
          });
          for (const a of admins) {
            await this.notifications.notify(
              tx,
              a.id,
              `Đơn ${o.order_code} đã hủy nhưng khách đã thanh toán, cần hoàn tiền`,
              'order',
              `Đơn ${o.order_code} đã bị hủy trước khi cổng thanh toán báo thành công. Cần hoàn tiền cho khách.`,
              `/admin/orders/${o.order_code}`,
            );
          }
        }
        await this.notifications.notify(
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
      return 'applied';
    });
  }

  /** Thanh toán giả lập chỉ chạy khi PAYMENT_SANDBOX_FAKE=true VÀ NODE_ENV khác production (khóa chặn cả ở env.validation) */
  private requireSandbox() {
    if (!sandboxAllowed(this.config.get('PAYMENT_SANDBOX_FAKE'), this.config.get('NODE_ENV'))) {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, 'Cổng thanh toán chưa được cấu hình.');
    }
  }

  private vnpayConfig(): VnpayConfig | null {
    const tmnCode = this.config.get('VNPAY_TMN_CODE');
    const hashSecret = this.config.get('VNPAY_HASH_SECRET');
    if (!tmnCode || !hashSecret) return null;
    return {
      tmnCode,
      hashSecret,
      url: this.config.get('VNPAY_URL'),
      returnUrl:
        this.config.get('VNPAY_RETURN_URL') ??
        `http://localhost:${this.config.get('PORT')}/api/payments/vnpay/return`,
    };
  }

  /**
   * Bắt đầu thanh toán một đơn đã kiểm tra điều kiện. VNPAY/thẻ có khóa ⇒ URL cổng (số tiền lấy từ Order.total trong CSDL);
   * ngược lại giả lập (chỉ dev/test). Giả lập: kết quả hệ thống quyết định, ghi chú đơn chứa "[fail]" ⇒ thất bại.
   */
  private async start(
    o: { id: number; orderCode: string; total: unknown; note: string | null; paymentMethod: PaymentMethod },
    ip: string,
    fakeOutcome: (note: string | null) => boolean,
  ) {
    const cfg = VNPAY_METHODS.includes(o.paymentMethod) ? this.vnpayConfig() : null;
    if (cfg) {
      // giao dịch pending mới nhất của đơn (tạo lúc đặt hàng); chưa có thì tạo
      let pay = await this.prisma.payment.findFirst({
        where: { orderId: o.id, status: 'pending' },
        orderBy: { id: 'desc' },
      });
      pay ??= await this.prisma.payment.create({
        data: { orderId: o.id, method: o.paymentMethod, amount: Number(o.total), status: 'pending' },
      });
      const { url, expiresAt } = buildPaymentUrl(cfg, {
        txnRef: `${o.orderCode}-P${pay.id}`,
        amount: Number(o.total),
        orderInfo: `Thanh toan don hang ${o.orderCode}`,
        ipAddr: ip,
      });
      return { redirectUrl: url, paymentUrl: url, expiresAt: expiresAt.toISOString() };
    }
    this.requireSandbox();
    const ok = fakeOutcome(o.note);
    await this.settle(o.id, ok);
    return { redirectUrl: `/checkout/${ok ? 'success' : 'failed'}?order=${o.orderCode}` };
  }

  async checkout(userId: number, orderId: number, ip = '127.0.0.1') {
    const o = await this.own(userId, orderId);
    if (o.paymentStatus === 'paid')
      throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã được thanh toán.');
    if (o.status === 'cancelled') throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã bị hủy.');
    if (!ONLINE.includes(o.paymentMethod)) return { redirectUrl: `/checkout/success?order=${o.orderCode}` };
    // Kết quả giả lập do hệ thống quyết định, KHÔNG nhận từ body của khách. Dùng thử luồng thất bại: ghi chú đơn chứa "[fail]".
    return this.start(o, ip, (note) => !/\[fail\]/i.test(note ?? ''));
  }

  /** UC-PAY-03: đơn chưa thanh toán (unpaid/failed), chưa hủy: giao dịch pending cũ ⇒ failed, tạo giao dịch mới, có thể đổi phương thức */
  async retry(userId: number, orderId: number, raw: unknown, ip = '127.0.0.1') {
    const o = await this.own(userId, orderId);
    if (o.paymentStatus === 'paid')
      throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã được thanh toán.');
    if (o.status === 'cancelled') throw new AppException(ErrorCode.INVALID_STATE, 'Đơn hàng đã bị hủy.');
    const wanted = str(asBody(raw).method) as PaymentMethod;
    if (wanted && !Object.values(PaymentMethod).includes(wanted))
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Phương thức thanh toán không hợp lệ.', {
        method: ['Phương thức thanh toán không hợp lệ.'],
      });
    const method = wanted || o.paymentMethod;
    await assertPaymentMethodEnabled(this.prisma, method); // phương thức đã bị tắt trong Cài đặt ⇒ từ chối
    const fresh = await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId: o.id, status: 'pending' },
        data: { status: 'failed' },
      });
      await tx.payment.create({
        data: { orderId: o.id, method, amount: Number(o.total), status: 'pending' },
      });
      return tx.order.update({
        where: { id: o.id },
        data: { paymentMethod: method, paymentStatus: 'unpaid' },
      });
    });
    if (!ONLINE.includes(method)) return { redirectUrl: `/checkout/success?order=${o.orderCode}` };
    // giả lập: thanh toán lại luôn thành công (để thử lại sau một lần thất bại)
    return this.start(fresh, ip, () => true);
  }

  // ---------------------------------------------------------------- VNPAY: Return URL + IPN (UC-PAY-02)
  private flat(q: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(q)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, v as string]),
    );
  }

  /** Xử lý kết quả cổng: chữ ký, đơn/giao dịch, số tiền; thành công/thất bại ⇒ settle (idempotent) */
  private async applyVnpay(q: Record<string, string>) {
    const cfg = this.vnpayConfig();
    if (!cfg || !verify(q, cfg.hashSecret)) return { rsp: IPN.INVALID_SIGNATURE, order: null };
    const ref = parseTxnRef(q.vnp_TxnRef ?? '');
    const order = ref ? await this.prisma.order.findUnique({ where: { orderCode: ref.orderCode } }) : null;
    if (!ref || !order) return { rsp: IPN.ORDER_NOT_FOUND, order: null };
    if (Math.round(Number(order.total)) * 100 !== Number(q.vnp_Amount))
      return { rsp: IPN.INVALID_AMOUNT, order };
    const ok = q.vnp_ResponseCode === '00' && (q.vnp_TransactionStatus ?? '00') === '00';
    const r = await this.settle(
      order.id,
      ok,
      {
        code: q.vnp_ResponseCode ?? '99',
        message: ok ? 'Giao dịch thành công' : 'Giao dịch không thành công',
        txn: ok ? q.vnp_TransactionNo : undefined,
      },
      ref.paymentId,
    );
    return {
      rsp: r === 'applied' ? IPN.OK : r === 'already' ? IPN.ALREADY_CONFIRMED : IPN.ORDER_NOT_FOUND,
      order,
    };
  }

  /** IPN (server-to-server): luôn trả JSON { RspCode, Message } theo chuẩn VNPAY */
  async ipn(query: Record<string, unknown>) {
    try {
      return (await this.applyVnpay(this.flat(query))).rsp;
    } catch {
      return IPN.UNKNOWN;
    }
  }

  /**
   * Return URL: khách từ cổng quay về ⇒ xử lý như IPN (dev không nhận được IPN) rồi chuyển tới trang kết quả của FE.
   * Trang thành công CHỈ khi đơn thật sự đã thanh toán trong CSDL (không tin tham số trên URL).
   */
  async returnUrl(query: Record<string, unknown>) {
    const web = this.config.get('APP_URL').replace(/\/+$/, '');
    const failed = (code?: string) => `${web}/checkout/failed${code ? `?order=${code}` : ''}`;
    try {
      const r = await this.applyVnpay(this.flat(query));
      if (!r.order) return failed();
      if (r.rsp === IPN.INVALID_AMOUNT || r.rsp === IPN.ORDER_NOT_FOUND) return failed(r.order.orderCode);
      const row = await this.prisma.order.findUniqueOrThrow({ where: { id: r.order.id } });
      return row.paymentStatus === 'paid'
        ? `${web}/checkout/success?order=${row.orderCode}`
        : failed(row.orderCode);
    } catch {
      return failed();
    }
  }
}
