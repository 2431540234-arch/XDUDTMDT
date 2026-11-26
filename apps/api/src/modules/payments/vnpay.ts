// VNPAY (sandbox) – hàm thuần, dễ test với khóa giả: tạo URL thanh toán có chữ ký, kiểm chữ ký IPN/Return, gọi truy vấn querydr.
// Tài liệu: https://sandbox.vnpayment.vn/apis/docs/ (thanh-toan-pay/pay.html, truy-van-hoan-tien/querydr&refund.html).
// URL thanh toán/IPN: chữ ký = HMAC-SHA512(hashSecret, chuỗi tham số SẮP XẾP theo tên và URL-encode, bỏ vnp_SecureHash/Type).
// querydr: chữ ký = HMAC-SHA512 của chuỗi các GIÁ TRỊ nối bằng "|" theo thứ tự cố định của tài liệu.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const VNPAY_SANDBOX_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
export const VNPAY_SANDBOX_QUERY_URL = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
/** Thời hạn một URL thanh toán (phút) */
export const VNPAY_EXPIRE_MINUTES = 15;

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  /** địa chỉ cổng (mặc định sandbox) */
  url?: string;
  /** địa chỉ API truy vấn giao dịch (mặc định sandbox) */
  queryUrl?: string;
  version?: string;
  /** Return URL: trang web nơi trình duyệt khách được chuyển về */
  returnUrl: string;
}

export interface VnpayPayInput {
  /** mã tham chiếu giao dịch, duy nhất mỗi lần tạo URL (xem makeTxnRef) */
  txnRef: string;
  /** số tiền VND lấy từ payments.amount trong CSDL */
  amount: number;
  orderInfo: string;
  ipAddr: string;
  now?: Date;
}

/** yyyyMMddHHmmss theo giờ Việt Nam (GMT+7) */
export function vnpDate(d: Date): string {
  const p = new Date(d.getTime() + 7 * 3_600_000).toISOString(); // dịch sang UTC+7 rồi đọc như UTC
  return p.slice(0, 19).replace(/[-:T]/g, '');
}

/** `P<paymentId>T<yyyyMMddHHmmss>`: chỉ chữ và số, không trùng kể cả khi reset CSDL làm id lặp lại */
export function makeTxnRef(paymentId: number, now: Date): string {
  return `P${paymentId}T${vnpDate(now)}`;
}

export function parseTxnRef(ref: string): { paymentId: number } | null {
  const m = /^P([1-9]\d{0,9})T\d{14}$/.exec(ref);
  if (!m) return null;
  const paymentId = Number(m[1]);
  return paymentId <= 2_147_483_647 ? { paymentId } : null;
}

/** vnp_IpAddr phải dài 7–45 ký tự: "::1" (3 ký tự) và IPv4 bọc trong IPv6 được đổi về IPv4 */
export function clientIp(ip: string | undefined | null): string {
  const v = String(ip ?? '')
    .trim()
    .replace(/^::ffff:/i, '');
  return v.length >= 7 && v.length <= 45 ? v : '127.0.0.1';
}

/** vnp_OrderInfo: không dấu, không ký tự đặc biệt (mã đơn bỏ dấu "-") */
export function orderInfoOf(orderCode: string): string {
  return `Thanh toan don hang ${orderCode.replace(/[^A-Za-z0-9]/g, '')}`;
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

const hmac = (data: string, secret: string) =>
  createHmac('sha512', secret).update(Buffer.from(data, 'utf-8')).digest('hex');

/** So sánh chữ ký hex 128 ký tự theo thời gian hằng */
function sameHash(got: unknown, want: string): boolean {
  const g = String(got ?? '').toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(g)) return false;
  return timingSafeEqual(Buffer.from(g, 'hex'), Buffer.from(want, 'hex'));
}

export function sign(params: Record<string, string>, hashSecret: string): string {
  return hmac(signData(params), hashSecret);
}

/** URL thanh toán đầy đủ (đã ký) + thời điểm tạo/hết hạn theo định dạng cổng */
export function buildPaymentUrl(cfg: VnpayConfig, input: VnpayPayInput) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + VNPAY_EXPIRE_MINUTES * 60_000);
  const params: Record<string, string> = {
    vnp_Version: cfg.version || '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: String(Math.round(input.amount * 100)),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: cfg.returnUrl,
    vnp_IpAddr: clientIp(input.ipAddr),
    vnp_CreateDate: vnpDate(now),
    vnp_ExpireDate: vnpDate(expiresAt),
  };
  const url = `${cfg.url || VNPAY_SANDBOX_URL}?${signData(params)}&vnp_SecureHash=${sign(params, cfg.hashSecret)}`;
  return { url, expiresAt, createDate: params.vnp_CreateDate, expireDate: params.vnp_ExpireDate };
}

/** Chữ ký của Return URL / IPN có đúng không */
export function verify(params: Record<string, string>, hashSecret: string): boolean {
  return sameHash(params.vnp_SecureHash, sign(params, hashSecret));
}

/** Dữ liệu cổng gửi về để lưu đối soát: chỉ các trường vnp_*, bỏ chữ ký */
export function rawFields(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([k]) => k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([k, v]) => [k, String(v).slice(0, 500)]),
  );
}

// ---------------------------------------------------------------- querydr
const QUERY_REQUEST_FIELDS = [
  'vnp_RequestId',
  'vnp_Version',
  'vnp_Command',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_TransactionDate',
  'vnp_CreateDate',
  'vnp_IpAddr',
  'vnp_OrderInfo',
] as const;

// LƯU Ý: trong tài liệu, chuỗi checksum của PHẢN HỒI bị thiếu một dấu nối trước vnp_BankCode (lỗi gõ). Thứ tự dưới đây coi đó là
// lỗi gõ và nối mọi trường bằng "|", trường không có thì để rỗng. CẦN XÁC NHẬN bằng giao dịch sandbox thật; nếu không khớp thì
// KHÔNG được nới lỏng kiểm tra.
export const QUERY_RESPONSE_FIELDS = [
  'vnp_ResponseId',
  'vnp_Command',
  'vnp_ResponseCode',
  'vnp_Message',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_Amount',
  'vnp_BankCode',
  'vnp_PayDate',
  'vnp_TransactionNo',
  'vnp_TransactionType',
  'vnp_TransactionStatus',
  'vnp_OrderInfo',
  'vnp_PromotionCode',
  'vnp_PromotionAmount',
] as const;

const pipeData = (fields: readonly string[], body: Record<string, unknown>) =>
  fields.map((f) => String(body[f] ?? '')).join('|');

export function buildQueryRequest(
  cfg: VnpayConfig,
  input: { requestId: string; txnRef: string; transactionDate: string; orderInfo: string; now?: Date },
): Record<string, string> {
  const body: Record<string, string> = {
    vnp_RequestId: input.requestId,
    vnp_Version: cfg.version || '2.1.0',
    vnp_Command: 'querydr',
    vnp_TmnCode: cfg.tmnCode,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_TransactionDate: input.transactionDate,
    vnp_CreateDate: vnpDate(input.now ?? new Date()),
    // địa chỉ của máy chủ gọi API (tài liệu: IP của server gửi yêu cầu)
    vnp_IpAddr: '127.0.0.1',
  };
  body.vnp_SecureHash = hmac(pipeData(QUERY_REQUEST_FIELDS, body), cfg.hashSecret);
  return body;
}

export function signQueryResponse(body: Record<string, unknown>, hashSecret: string): string {
  return hmac(pipeData(QUERY_RESPONSE_FIELDS, body), hashSecret);
}

export function verifyQueryResponse(body: Record<string, unknown>, hashSecret: string): boolean {
  return sameHash(body.vnp_SecureHash, signQueryResponse(body, hashSecret));
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
