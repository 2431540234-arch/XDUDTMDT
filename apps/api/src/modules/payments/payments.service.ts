// M12 – Thanh toán. COD/chuyển khoản: thanh toán xác nhận sau (khi giao / admin xác nhận).
// VNPAY/thẻ (D-N17): có VNPAY_TMN_CODE + VNPAY_HASH_SECRET ⇒ mỗi URL thanh toán là một dòng payments (TxnRef riêng). Kết quả chỉ
// được ghi qua MỘT hàm applyGatewayResult, nhận từ IPN hoặc từ truy vấn querydr (D-N39..D-N45, D-T63). Trang Return URL chỉ đọc.
// Chưa có khóa ⇒ chế độ giả lập (PAYMENT_SANDBOX_FAKE=true, không production) quyết định thành công/thất bại ngay như mock.
import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { ErrorCode } from '@aurelia-living/shared-types';
import { AppException } from '../../common/exceptions/app.exception';
import { assertPaymentMethodEnabled, assertPaymentMethodSupported } from '../../common/utils/payment-methods';
import { asBody, str } from '../../common/utils/validate';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { VnpayGuard } from './vnpay-guard';
import {
  buildPaymentUrl,
  buildQueryRequest,
  IPN,
  makeTxnRef,
  orderInfoOf,
  parseTxnRef,
  rawFields,
  verify,
  verifyQueryResponse,
  VNPAY_SANDBOX_QUERY_URL,
  type VnpayConfig,
} from './vnpay';

/** Giả lập thanh toán chỉ khi bật cờ VÀ không phải production */
export function sandboxAllowed(flag: boolean, nodeEnv: string): boolean {
  return flag === true && nodeEnv !== 'production';
}

const ONLINE: PaymentMethod[] = ['vnpay', 'momo', 'zalopay', 'card'];
/** Phương thức đi qua cổng VNPAY (thẻ ngân hàng cũng qua VNPAY – D-N17); MoMo/ZaloPay chỉ còn ở đơn cũ */
export const VNPAY_METHODS: PaymentMethod[] = ['vnpay', 'card'];

export type SettleResult = 'applied' | 'already' | 'missing';
type IpnReply = (typeof IPN)[keyof typeof IPN];

/** Kết quả giao dịch do cổng báo về, đã xác thực chữ ký */
export interface GatewayResult {
  source: 'ipn' | 'querydr';
  txnRef: string;
  /** vnp_Amount (VND × 100) */
  amount100: number;
  success: boolean;
  responseCode: string;
  transactionStatus: string;
  transactionNo?: string;
  raw: Record<string, string>;
}

/** Nội dung cột payments.gateway_response của một lần thử VNPAY */
interface GatewayRecord {
  request?: { txnRef: string; createDate: string; expireDate: string };
  result?: Record<string, unknown>;
}
const recordOf = (v: unknown): GatewayRecord =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as GatewayRecord) : {};

interface LockedOrder {
  id: number;
  status: string;
  payment_status: string;
  order_code: string;
  user_id: number;
  payment_method: PaymentMethod;
  total: unknown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
    private readonly guard: VnpayGuard,
  ) {}

  private async own(userId: number, orderId: number) {
    const o = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return o;
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: number): Promise<LockedOrder> {
    const [o] = await tx.$queryRaw<LockedOrder[]>`
      SELECT id, status, payment_status, order_code, user_id, payment_method, total FROM orders WHERE id = ${orderId} FOR UPDATE`;
    if (!o) throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, 'Đơn hàng không tồn tại.');
    return o;
  }

  /** Chỉ thanh toán (lại) khi đơn pending|confirmed và chưa thanh toán */
  private assertPayable(status: string, paymentStatus: string) {
    const fail = (message: string) => {
      throw new AppException(ErrorCode.INVALID_STATE, message);
    };
    if (paymentStatus === 'paid') fail('Đơn hàng đã được thanh toán.');
    if (status === 'cancelled') fail('Đơn hàng đã bị hủy.');
    if (status !== 'pending' && status !== 'confirmed')
      fail('Chỉ thanh toán được khi đơn đang chờ xác nhận hoặc đã xác nhận.');
  }

  private async notifyAdmins(tx: Prisma.TransactionClient, title: string, content: string, link: string) {
    const admins = await tx.user.findMany({
      where: { deletedAt: null, role: 'admin' },
      select: { id: true },
    });
    for (const a of admins) await this.notifications.notify(tx, a.id, title, 'order', content, link);
  }

  private notifyPaid(tx: Prisma.TransactionClient, o: LockedOrder) {
    return this.notifications.notify(
      tx,
      o.user_id,
      `Thanh toán đơn ${o.order_code} thành công`,
      'order',
      'Chúng tôi đã nhận được thanh toán của bạn.',
      `/account/orders/${o.order_code}`,
    );
  }

  // ---------------------------------------------------------------- thanh toán giả lập (chỉ khi chưa có khóa VNPAY)
  /** Ghi kết quả GIẢ LẬP (idempotent: đơn đã paid thì không xử lý lại). Không dùng cho kết quả từ cổng thật. */
  async settle(orderId: number, success: boolean): Promise<SettleResult> {
    return this.prisma.$transaction(async (tx): Promise<SettleResult> => {
      const o = await this.lockOrder(tx, orderId);
      if (o.payment_status === 'paid') return 'already';
      const pay = await tx.payment.findFirst({ where: { orderId }, orderBy: { id: 'desc' } });
      if (!pay) return 'missing';
      if (success) {
        await tx.payment.update({
          where: { id: pay.id },
          data: {
            status: 'success',
            paidAt: new Date(),
            transactionCode: `${o.payment_method.toUpperCase()}${randomBytes(6).toString('hex').toUpperCase()}`,
            gatewayResponse: { code: '00', message: 'Giao dịch thành công (giả lập)' },
          },
        });
        await this.orders.setActor(tx, null, 'Thanh toán online thành công, hệ thống tự xác nhận');
        // D-N13: thanh toán online thành công ⇒ pending → confirmed (changed_by NULL)
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'paid', ...(o.status === 'pending' ? { status: 'confirmed' } : {}) },
        });
        await this.notifyPaid(tx, o);
      } else {
        await tx.payment.update({
          where: { id: pay.id },
          data: {
            status: 'failed',
            gatewayResponse: { code: '24', message: 'Khách hàng hủy giao dịch (giả lập)' },
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
    if (!tmnCode || !hashSecret) return null; // env.validation bảo đảm hai khóa cùng có hoặc cùng trống
    return {
      tmnCode,
      hashSecret,
      url: this.config.get('VNPAY_PAYMENT_URL'),
      queryUrl: this.config.get('VNPAY_QUERY_URL'),
      version: this.config.get('VNPAY_VERSION'),
      returnUrl:
        this.config.get('VNPAY_RETURN_URL') ||
        `${this.config.get('APP_URL').replace(/\/+$/, '')}/checkout/vnpay-return`,
    };
  }

  // ---------------------------------------------------------------- tạo URL thanh toán
  /** D-N43: tối đa N lượt tạo URL mỗi phút cho một khách, tính chung checkout và retry. Gọi TRƯỚC khi ghi bất kỳ gì. */
  private async assertUrlQuota(userId: number, method: PaymentMethod) {
    if (!VNPAY_METHODS.includes(method) || !this.vnpayConfig()) return;
    if (!(await this.guard.allowUrl(userId)))
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        'Bạn tạo liên kết thanh toán quá nhiều lần. Vui lòng thử lại sau một phút.',
      );
  }

  /**
   * Mỗi URL là MỘT dòng payments: dùng dòng pending chưa từng gửi cổng (tạo lúc đặt hàng/thanh toán lại), nếu không thì đóng các dòng
   * pending cũ và tạo dòng mới. Số tiền lấy từ CSDL.
   */
  private async createVnpayUrl(cfg: VnpayConfig, orderId: number, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.lockOrder(tx, orderId);
      this.assertPayable(o.status, o.payment_status);
      const pendings = await tx.payment.findMany({
        where: { orderId, status: 'pending' },
        orderBy: { id: 'desc' },
      });
      let pay = pendings.find((p) => p.method === o.payment_method && !recordOf(p.gatewayResponse).request);
      await tx.payment.updateMany({
        where: { orderId, status: 'pending', ...(pay ? { id: { not: pay.id } } : {}) },
        data: { status: 'failed' },
      });
      pay ??= await tx.payment.create({
        data: { orderId, method: o.payment_method, amount: Number(o.total), status: 'pending' },
      });
      const now = new Date();
      const txnRef = makeTxnRef(pay.id, now);
      const built = buildPaymentUrl(cfg, {
        txnRef,
        amount: Number(pay.amount),
        orderInfo: orderInfoOf(o.order_code),
        ipAddr: ip,
        now,
      });
      await tx.payment.update({
        where: { id: pay.id },
        data: {
          gatewayResponse: {
            request: { txnRef, createDate: built.createDate, expireDate: built.expireDate },
          },
        },
      });
      if (o.payment_status === 'failed')
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'unpaid' } });
      return { redirectUrl: built.url, paymentUrl: built.url, expiresAt: built.expiresAt.toISOString() };
    });
  }

  /**
   * Bắt đầu thanh toán một đơn đã kiểm tra điều kiện. VNPAY/thẻ có khóa ⇒ URL cổng; ngược lại giả lập (chỉ dev/test).
   * Giả lập: kết quả hệ thống quyết định, ghi chú đơn chứa "[fail]" ⇒ thất bại.
   */
  private async start(
    o: { id: number; orderCode: string; note: string | null; paymentMethod: PaymentMethod },
    ip: string,
    fakeOutcome: (note: string | null) => boolean,
  ) {
    const cfg = VNPAY_METHODS.includes(o.paymentMethod) ? this.vnpayConfig() : null;
    if (cfg) return this.createVnpayUrl(cfg, o.id, ip);
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
    this.assertPayable(o.status, o.paymentStatus);
    await this.assertUrlQuota(userId, o.paymentMethod);
    // Kết quả giả lập do hệ thống quyết định, KHÔNG nhận từ body của khách. Dùng thử luồng thất bại: ghi chú đơn chứa "[fail]".
    return this.start(o, ip, (note) => !/\[fail\]/i.test(note ?? ''));
  }

  /** UC-PAY-03: đơn chưa thanh toán, pending|confirmed: giao dịch pending cũ ⇒ failed, tạo giao dịch mới, có thể đổi phương thức */
  async retry(userId: number, orderId: number, raw: unknown, ip = '127.0.0.1') {
    const o = await this.own(userId, orderId);
    this.assertPayable(o.status, o.paymentStatus);
    const wanted = str(asBody(raw).method) as PaymentMethod;
    if (wanted && !Object.values(PaymentMethod).includes(wanted))
      throw new AppException(ErrorCode.VALIDATION_FAILED, 'Phương thức thanh toán không hợp lệ.', {
        method: ['Phương thức thanh toán không hợp lệ.'],
      });
    const method = wanted || o.paymentMethod;
    assertPaymentMethodSupported(method); // D-N44: không tạo giao dịch mới bằng MoMo/ZaloPay
    await assertPaymentMethodEnabled(this.prisma, method); // phương thức đã bị tắt trong Cài đặt ⇒ từ chối
    await this.assertUrlQuota(userId, method);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockOrder(tx, o.id);
      this.assertPayable(locked.status, locked.payment_status);
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

  // ---------------------------------------------------------------- kết quả từ cổng (UC-PAY-02)
  private flat(q: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(q)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, v as string]),
    );
  }

  /** Giao dịch có đúng TxnRef này (đã được chính hệ thống gửi cho cổng) */
  private async findAttempt(txnRef: string) {
    const ref = parseTxnRef(txnRef);
    if (!ref) return null;
    const pay = await this.prisma.payment.findUnique({ where: { id: ref.paymentId } });
    return pay && recordOf(pay.gatewayResponse).request?.txnRef === txnRef ? pay : null;
  }

  /**
   * ĐƯỜNG GHI DUY NHẤT cho kết quả cổng (IPN và querydr): kiểm giao dịch và số tiền, khóa dòng đơn, chống lặp theo TỪNG lần thử.
   * Thành công: đơn chưa trả ⇒ paid (D-N39, kể cả lần thử đã bị thay thế); đơn đã trả ⇒ ghi giao dịch dư, báo admin (D-N40);
   * đơn đã hủy ⇒ giữ cancelled, ghi paid, báo admin (D-N28).
   */
  async applyGatewayResult(r: GatewayResult): Promise<IpnReply> {
    const found = await this.findAttempt(r.txnRef);
    if (!found) return IPN.ORDER_NOT_FOUND;
    if (Math.round(Number(found.amount) * 100) !== r.amount100) return IPN.INVALID_AMOUNT;

    return this.prisma.$transaction(async (tx): Promise<IpnReply> => {
      const o = await this.lockOrder(tx, found.orderId);
      const pay = await tx.payment.findUniqueOrThrow({ where: { id: found.id } });
      const record = recordOf(pay.gatewayResponse);
      if (record.result || pay.status === 'success' || pay.status === 'refunded')
        return IPN.ALREADY_CONFIRMED;

      const gatewayResponse = {
        ...record,
        result: {
          source: r.source,
          receivedAt: new Date().toISOString(),
          success: r.success,
          responseCode: r.responseCode,
          transactionStatus: r.transactionStatus,
          raw: r.raw,
        },
      } as Prisma.InputJsonValue;

      if (!r.success) {
        const wasCurrent = pay.status === 'pending';
        await tx.payment.update({ where: { id: pay.id }, data: { status: 'failed', gatewayResponse } });
        // lần thử đã bị thay thế/đơn đã hủy hoặc đã trả ⇒ chỉ ghi vào giao dịch, không đổi đơn
        if (wasCurrent && o.status !== 'cancelled' && ['unpaid', 'failed'].includes(o.payment_status))
          await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'failed' } });
        return IPN.OK;
      }

      const txnNo = r.transactionNo && r.transactionNo !== '0' ? r.transactionNo : null;
      await tx.payment.update({
        where: { id: pay.id },
        data: { status: 'success', paidAt: new Date(), transactionCode: txnNo, gatewayResponse },
      });
      const link = `/admin/orders/${o.order_code}`;

      if (o.payment_status === 'paid' || o.payment_status === 'refunded') {
        await this.notifyAdmins(
          tx,
          `Đơn ${o.order_code} bị thanh toán hai lần, cần hoàn khoản dư`,
          `VNPay báo thêm một giao dịch thành công ${Number(pay.amount).toLocaleString('vi-VN')}đ (mã ${txnNo ?? r.txnRef}) ` +
            'cho đơn đã được thanh toán. Hoàn khoản dư trên cổng VNPay.',
          link,
        );
        return IPN.OK;
      }

      if (o.status === 'cancelled') {
        // trạng thái đơn giữ nguyên cancelled; ghi paid để admin hoàn tiền được (UC-ADM-23)
        await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'paid' } });
        await this.notifyAdmins(
          tx,
          `Đơn ${o.order_code} đã hủy nhưng khách đã thanh toán, cần hoàn tiền`,
          `Đơn ${o.order_code} đã bị hủy trước khi cổng thanh toán báo thành công. Cần hoàn tiền cho khách.`,
          link,
        );
      } else {
        await tx.payment.updateMany({
          where: { orderId: o.id, status: 'pending' },
          data: { status: 'failed' },
        });
        await this.orders.setActor(tx, null, 'Thanh toán online thành công, hệ thống tự xác nhận');
        await tx.order.update({
          where: { id: o.id },
          data: {
            paymentStatus: 'paid',
            paymentMethod: pay.method, // đơn theo đúng phương thức khách đã thực trả
            ...(o.status === 'pending' ? { status: 'confirmed' } : {}),
          },
        });
      }
      await this.notifyPaid(tx, o);
      return IPN.OK;
    });
  }

  /** IPN (server-to-server): luôn trả JSON { RspCode, Message } theo chuẩn VNPAY */
  async ipn(query: Record<string, unknown>): Promise<IpnReply> {
    try {
      const q = this.flat(query);
      const cfg = this.vnpayConfig();
      if (!cfg || !verify(q, cfg.hashSecret) || q.vnp_TmnCode !== cfg.tmnCode) return IPN.INVALID_SIGNATURE;
      return await this.applyGatewayResult({
        source: 'ipn',
        txnRef: q.vnp_TxnRef ?? '',
        amount100: Number(q.vnp_Amount),
        success: q.vnp_ResponseCode === '00' && q.vnp_TransactionStatus === '00',
        responseCode: q.vnp_ResponseCode ?? '',
        transactionStatus: q.vnp_TransactionStatus ?? '',
        transactionNo: q.vnp_TransactionNo,
        raw: rawFields(q),
      });
    } catch (e) {
      this.logger.error(`IPN lỗi: ${(e as Error).message}`);
      return IPN.UNKNOWN;
    }
  }

  /**
   * Trang Return URL: chỉ tin tham số khi đúng chữ ký, trạng thái lấy từ CSDL. Không ghi gì từ tham số trên URL.
   * Nếu giao dịch của TxnRef còn pending (chưa có IPN) sau vài giây ⇒ hỏi cổng bằng querydr (D-N42).
   */
  async returnStatus(query: Record<string, unknown>) {
    const q = this.flat(query);
    const cfg = this.vnpayConfig();
    if (!cfg || !verify(q, cfg.hashSecret) || q.vnp_TmnCode !== cfg.tmnCode) return { valid: false as const };
    const attempt = await this.findAttempt(q.vnp_TxnRef ?? '');
    if (!attempt) return { valid: false as const };
    if (attempt.status === 'pending' && (await this.guard.allowQuery(q.vnp_TxnRef))) {
      await this.queryGateway(cfg, attempt);
    }
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
    return {
      valid: true as const,
      orderCode: order.orderCode,
      responseCode: q.vnp_ResponseCode ?? '',
      paymentStatus: order.paymentStatus,
    };
  }

  /**
   * querydr (server-to-server). Chỉ nhận phản hồi ĐÚNG chữ ký; kết quả đi qua applyGatewayResult như IPN. Chỉ ghi khi cổng nói rõ
   * thành công (TransactionStatus 00) hoặc lỗi (02); các mã khác (đang xử lý, đảo giao dịch, nghi gian lận, hoàn tiền) để nguyên.
   */
  private async queryGateway(cfg: VnpayConfig, attempt: { orderId: number; gatewayResponse: unknown }) {
    const request = recordOf(attempt.gatewayResponse).request;
    if (!request) return;
    const warn = (reason: string) => this.logger.warn(`querydr ${request.txnRef}: ${reason}`);
    try {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
      const res = await fetch(cfg.queryUrl || VNPAY_SANDBOX_QUERY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildQueryRequest(cfg, {
            requestId: randomBytes(16).toString('hex'),
            txnRef: request.txnRef,
            transactionDate: request.createDate,
            orderInfo: `Truy van don hang ${order.orderCode.replace(/[^A-Za-z0-9]/g, '')}`,
          }),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return warn(`HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      if (!verifyQueryResponse(body, cfg.hashSecret)) {
        // KHÔNG nới lỏng: phản hồi không đúng chữ ký thì bỏ. vnp_ResponseCode chỉ để chẩn đoán, không được tin.
        return this.logger.error(
          `querydr ${request.txnRef}: chữ ký phản hồi KHÔNG khớp (mã chưa xác thực: ${String(body.vnp_ResponseCode ?? '?').slice(0, 4)}). Không ghi gì.`,
        );
      }
      const f = rawFields(body);
      if (f.vnp_ResponseCode !== '00') return warn(`cổng trả mã ${f.vnp_ResponseCode}`);
      if (f.vnp_TmnCode !== cfg.tmnCode || f.vnp_TxnRef !== request.txnRef)
        return warn('phản hồi không đúng giao dịch đã hỏi');
      if (f.vnp_TransactionType && f.vnp_TransactionType !== '01')
        return warn('không phải giao dịch thanh toán');
      const status = f.vnp_TransactionStatus;
      if (status !== '00' && status !== '02') return warn(`trạng thái ${status}: chưa ghi nhận`);
      const reply = await this.applyGatewayResult({
        source: 'querydr',
        txnRef: request.txnRef,
        amount100: Number(f.vnp_Amount),
        success: status === '00',
        responseCode: f.vnp_ResponseCode,
        transactionStatus: status,
        transactionNo: f.vnp_TransactionNo,
        raw: f,
      });
      if (reply !== IPN.OK && reply !== IPN.ALREADY_CONFIRMED) warn(`không ghi nhận được (${reply.RspCode})`);
    } catch (e) {
      warn((e as Error).message);
    }
  }
}
