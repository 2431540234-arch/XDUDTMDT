// VNPAY (sandbox) – tạo URL thanh toán có chữ ký HMAC-SHA512, kiểm tra chữ ký của Return URL / IPN. Hàm thuần, dễ test với khóa giả.
// Tài liệu cổng: vnp_Version 2.1.0, số tiền gửi = VND × 100, vnp_CreateDate/vnp_ExpireDate dạng yyyyMMddHHmmss (GMT+7),
// chữ ký = HMAC-SHA512(hashSecret, chuỗi tham số đã SẮP XẾP theo tên và URL-encode, bỏ vnp_SecureHash/vnp_SecureHashType).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const VNPAY_SANDBOX_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  /** địa chỉ cổng (mặc định sandbox) */
  url?: string;
  /** Return URL (trình duyệt khách được chuyển về) – địa chỉ công khai của API */
  returnUrl: string;
}

export interface VnpayPayInput {
  /** mã tham chiếu giao dịch, duy nhất mỗi lần thanh toán (ví dụ `${orderCode}-P${paymentId}`) */
  txnRef: string;
  /** số tiền VND (số nguyên) lấy từ Order.total trong CSDL */
  amount: number;
  orderInfo: string;
  ipAddr: string;
  now?: Date;
  /** thời hạn thanh toán (phút), mặc định 15 */
  expireMinutes?: number;
}

/** yyyyMMddHHmmss theo giờ Việt Nam (GMT+7) */
export function vnpDate(d: Date): string {
  const p = new Date(d.getTime() + 7 * 3_600_000).toISOString(); // dịch sang UTC+7 rồi đọc như UTC
  return p.slice(0, 19).replace(/[-:T]/g, '');
}

/** encodeURIComponent nhưng khoảng trắng thành "+" (đúng cách cổng VNPAY ký) */
const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');

/** Chuỗi dữ liệu để ký: tham số sắp theo tên, bỏ giá trị rỗng, bỏ các trường chữ ký */
export function signData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${enc(k)}=${enc(String(params[k]))}`)
    .join('&');
}

export function sign(params: Record<string, string>, hashSecret: string): string {
  return createHmac('sha512', hashSecret)
    .update(Buffer.from(signData(params), 'utf-8'))
    .digest('hex');
}

/** URL thanh toán đầy đủ (đã ký) + thời điểm hết hạn */
export function buildPaymentUrl(cfg: VnpayConfig, input: VnpayPayInput): { url: string; expiresAt: Date } {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.expireMinutes ?? 15) * 60_000);
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: String(Math.round(input.amount) * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: cfg.returnUrl,
    vnp_IpAddr: input.ipAddr || '127.0.0.1',
    vnp_CreateDate: vnpDate(now),
    vnp_ExpireDate: vnpDate(expiresAt),
  };
  const query = signData(params);
  const hash = sign(params, cfg.hashSecret);
  return { url: `${cfg.url || VNPAY_SANDBOX_URL}?${query}&vnp_SecureHash=${hash}`, expiresAt };
}

/** Chữ ký của Return URL / IPN có đúng không (so sánh thời gian hằng) */
export function verify(params: Record<string, string>, hashSecret: string): boolean {
  const got = String(params.vnp_SecureHash ?? '').toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(got)) return false;
  const want = sign(params, hashSecret);
  return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(want, 'hex'));
}

/** vnp_TxnRef = `${orderCode}-P${paymentId}` ⇒ { orderCode, paymentId } */
export function parseTxnRef(ref: string): { orderCode: string; paymentId: number } | null {
  const m = /^(.+)-P(\d+)$/.exec(ref);
  return m ? { orderCode: m[1], paymentId: Number(m[2]) } : null;
}

/** Mã phản hồi IPN theo tài liệu VNPAY */
export const IPN = {
  OK: { RspCode: '00', Message: 'Confirm Success' },
  ORDER_NOT_FOUND: { RspCode: '01', Message: 'Order not found' },
  ALREADY_CONFIRMED: { RspCode: '02', Message: 'Order already confirmed' },
  INVALID_AMOUNT: { RspCode: '04', Message: 'Invalid amount' },
  INVALID_SIGNATURE: { RspCode: '97', Message: 'Invalid signature' },
  UNKNOWN: { RspCode: '99', Message: 'Unknown error' },
} as const;
