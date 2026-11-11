import { createHmac } from 'node:crypto';
import { buildPaymentUrl, parseTxnRef, sign, signData, verify, vnpDate, VNPAY_SANDBOX_URL } from './vnpay';

// Khóa GIẢ chỉ dùng cho test (chưa có tài khoản sandbox VNPAY thật)
const CFG = {
  tmnCode: 'FAKETMN1',
  hashSecret: 'fake-hash-secret-for-tests',
  returnUrl: 'http://localhost:4000/api/payments/vnpay/return',
};

const queryOf = (url: string): Record<string, string> =>
  Object.fromEntries(new URL(url).searchParams.entries());

describe('VNPAY – ký và kiểm tra chữ ký (khóa giả)', () => {
  it('vnpDate: yyyyMMddHHmmss theo giờ Việt Nam (UTC+7)', () => {
    expect(vnpDate(new Date('2026-11-07T00:00:00Z'))).toBe('20261107070000');
    expect(vnpDate(new Date('2026-12-31T20:30:05Z'))).toBe('20270101033005'); // qua nửa đêm giờ VN
  });

  it('signData: sắp theo tên tham số, URL-encode (khoảng trắng → +), bỏ tham số rỗng và trường chữ ký', () => {
    const data = signData({
      vnp_TmnCode: 'TMN',
      vnp_Amount: '1000000',
      vnp_OrderInfo: 'Thanh toan don hang ABC-1',
      vnp_Empty: '',
      vnp_SecureHash: 'abc',
      vnp_SecureHashType: 'HmacSHA512',
      khac: 'khong-phai-vnp',
    });
    expect(data).toBe('vnp_Amount=1000000&vnp_OrderInfo=Thanh+toan+don+hang+ABC-1&vnp_TmnCode=TMN');
  });

  it('sign = HMAC-SHA512 (hex) của chuỗi đã sắp xếp', () => {
    const p = { vnp_Amount: '100', vnp_TxnRef: 'ALV-1-P1' };
    const expected = createHmac('sha512', 'k').update('vnp_Amount=100&vnp_TxnRef=ALV-1-P1').digest('hex');
    expect(sign(p, 'k')).toBe(expected);
    expect(sign(p, 'k')).toHaveLength(128);
  });

  it('buildPaymentUrl: tham số bắt buộc, số tiền ×100 từ số tiền đưa vào, hạn 15 phút, chữ ký hợp lệ', () => {
    const now = new Date('2026-11-07T03:00:00Z');
    const { url, expiresAt } = buildPaymentUrl(CFG, {
      txnRef: 'ALV-20261107-0001-P12',
      amount: 12_345_000,
      orderInfo: 'Thanh toan don hang ALV-20261107-0001',
      ipAddr: '::1',
      now,
    });
    expect(url.startsWith(`${VNPAY_SANDBOX_URL}?`)).toBe(true);
    const q = queryOf(url);
    expect(q).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'FAKETMN1',
      vnp_Amount: '1234500000',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: 'ALV-20261107-0001-P12',
      vnp_ReturnUrl: CFG.returnUrl,
      vnp_CreateDate: '20261107100000',
      vnp_ExpireDate: '20261107101500',
    });
    expect(expiresAt.toISOString()).toBe('2026-11-07T03:15:00.000Z');
    expect(verify(q, CFG.hashSecret)).toBe(true);
  });

  it('verify: sửa số tiền/mã đơn, đổi khóa, thiếu hoặc sai định dạng chữ ký ⇒ false', () => {
    const { url } = buildPaymentUrl(CFG, {
      txnRef: 'ALV-1-P1',
      amount: 500_000,
      orderInfo: 'x',
      ipAddr: '1.1.1.1',
    });
    const q = queryOf(url);
    expect(verify({ ...q, vnp_Amount: '1' }, CFG.hashSecret)).toBe(false);
    expect(verify({ ...q, vnp_TxnRef: 'ALV-2-P1' }, CFG.hashSecret)).toBe(false);
    expect(verify(q, 'khoa-khac')).toBe(false);
    const { vnp_SecureHash: _h, ...noHash } = q;
    expect(verify(noHash, CFG.hashSecret)).toBe(false);
    expect(verify({ ...q, vnp_SecureHash: 'zz' }, CFG.hashSecret)).toBe(false);
    expect(verify({ ...q, vnp_SecureHash: q.vnp_SecureHash.toUpperCase() }, CFG.hashSecret)).toBe(true); // hex không phân biệt hoa/thường
  });

  it('verify bỏ qua vnp_SecureHashType (cổng có thể gửi kèm)', () => {
    const p = { vnp_Amount: '100', vnp_TxnRef: 'A-P1', vnp_ResponseCode: '00' };
    const hash = sign(p, 'k');
    expect(verify({ ...p, vnp_SecureHash: hash, vnp_SecureHashType: 'HmacSHA512' }, 'k')).toBe(true);
  });

  it('parseTxnRef: tách mã đơn (có dấu gạch) và id giao dịch', () => {
    expect(parseTxnRef('ALV-20261107-0001-P12')).toEqual({ orderCode: 'ALV-20261107-0001', paymentId: 12 });
    expect(parseTxnRef('ALV-1')).toBeNull();
    expect(parseTxnRef('')).toBeNull();
  });
});
