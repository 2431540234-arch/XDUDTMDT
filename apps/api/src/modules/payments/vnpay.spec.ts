import {
  buildPaymentUrl,
  buildQueryRequest,
  clientIp,
  makeTxnRef,
  orderInfoOf,
  parseTxnRef,
  rawFields,
  sign,
  signData,
  signQueryResponse,
  verify,
  verifyQueryResponse,
  vnpDate,
  VNPAY_SANDBOX_URL,
} from './vnpay';

// Khóa GIẢ chỉ dùng cho test. Các chữ ký mong đợi ghi cứng được tính độc lập bằng HMAC-SHA512 trên chuỗi viết tay.
const SECRET = 'SECRETKHONGTHAT';
const CFG = {
  tmnCode: 'TESTTMN1',
  hashSecret: SECRET,
  returnUrl: 'http://localhost:3000/checkout/vnpay-return',
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
      vnp_OrderInfo: 'Thanh toan don hang ABC1',
      vnp_Empty: '',
      vnp_SecureHash: 'abc',
      vnp_SecureHashType: 'HmacSHA512',
      khac: 'khong-phai-vnp',
    });
    expect(data).toBe('vnp_Amount=1000000&vnp_OrderInfo=Thanh+toan+don+hang+ABC1&vnp_TmnCode=TMN');
  });

  it('sign: dữ liệu mẫu cố định ⇒ đúng chữ ký ghi cứng; verify bỏ qua vnp_SecureHashType, không phân biệt hoa thường', () => {
    const p = {
      vnp_TxnRef: 'P42T20261106100000',
      vnp_OrderInfo: 'Thanh toan don hang ALV20261106000001',
      vnp_Command: 'pay',
      vnp_Amount: '1250000000',
    };
    const expected =
      'd53894c3aff13d222550d658cfc109d5d400b13508e5c813796d3059c3b85147be3b69c3545bbaa4373a8dd662371c9e302724d5418591cea2c33a61470c9bea';
    expect(sign(p, SECRET)).toBe(expected);
    expect(verify({ ...p, vnp_SecureHash: expected.toUpperCase(), vnp_SecureHashType: 'x' }, SECRET)).toBe(
      true,
    );
  });

  it('buildPaymentUrl: đủ tham số, số tiền ×100, hạn 15 phút, IP "::1" được đổi, không gửi vnp_BankCode', () => {
    const now = new Date('2026-11-07T03:00:00Z');
    const built = buildPaymentUrl(CFG, {
      txnRef: makeTxnRef(12, now),
      amount: 12_345_000,
      orderInfo: orderInfoOf('ALV-20261107-000001'),
      ipAddr: '::1',
      now,
    });
    expect(built.url.startsWith(`${VNPAY_SANDBOX_URL}?`)).toBe(true);
    const q = queryOf(built.url);
    expect(q).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'TESTTMN1',
      vnp_Amount: '1234500000',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: 'P12T20261107100000',
      vnp_OrderInfo: 'Thanh toan don hang ALV20261107000001',
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_IpAddr: '127.0.0.1',
      vnp_ReturnUrl: CFG.returnUrl,
      vnp_CreateDate: '20261107100000',
      vnp_ExpireDate: '20261107101500',
    });
    expect(q).not.toHaveProperty('vnp_BankCode');
    expect(built).toMatchObject({ createDate: '20261107100000', expireDate: '20261107101500' });
    expect(built.expiresAt.toISOString()).toBe('2026-11-07T03:15:00.000Z');
    expect(verify(q, SECRET)).toBe(true);
  });

  it('verify: sửa số tiền/mã giao dịch, đổi khóa, thiếu hoặc sai định dạng chữ ký ⇒ false', () => {
    const { url } = buildPaymentUrl(CFG, { txnRef: 'P1T1', amount: 500_000, orderInfo: 'x', ipAddr: '' });
    const q = queryOf(url);
    expect(verify({ ...q, vnp_Amount: '1' }, SECRET)).toBe(false);
    expect(verify({ ...q, vnp_TxnRef: 'P2T1' }, SECRET)).toBe(false);
    expect(verify(q, 'khoa-khac')).toBe(false);
    const { vnp_SecureHash: _h, ...noHash } = q;
    expect(verify(noHash, SECRET)).toBe(false);
    expect(verify({ ...q, vnp_SecureHash: 'zz' }, SECRET)).toBe(false);
  });

  it('TxnRef: chỉ chữ và số, mỗi thời điểm một mã; parse từ chối dạng cũ và dạng lạ', () => {
    const ref = makeTxnRef(42, new Date('2026-11-06T03:00:00Z'));
    expect(ref).toBe('P42T20261106100000');
    expect(ref).toMatch(/^[A-Za-z0-9]{1,100}$/);
    expect(parseTxnRef(ref)).toEqual({ paymentId: 42 });
    for (const bad of ['', 'ALV-1-P1', 'P42', 'P0T20261106100000', 'P99999999999T20261106100000', `${ref}x`])
      expect(parseTxnRef(bad)).toBeNull();
  });

  it('clientIp: luôn dài 7–45 ký tự', () => {
    expect(clientIp('::1')).toBe('127.0.0.1');
    expect(clientIp(undefined)).toBe('127.0.0.1');
    expect(clientIp('::ffff:13.160.92.202')).toBe('13.160.92.202');
    expect(clientIp('2001:db8::8a2e:370:7334')).toBe('2001:db8::8a2e:370:7334');
    expect(clientIp('x'.repeat(60))).toBe('127.0.0.1');
  });

  it('rawFields: chỉ giữ trường vnp_*, bỏ chữ ký', () => {
    expect(
      rawFields({ vnp_Amount: 100, vnp_SecureHash: 'a', vnp_SecureHashType: 'b', password: 'c' }),
    ).toEqual({ vnp_Amount: '100' });
  });
});

describe('VNPAY – querydr (chuỗi checksum nối bằng "|", dữ liệu giả; cần xác nhận với sandbox thật)', () => {
  it('yêu cầu: đúng thứ tự trường của tài liệu ⇒ đúng chữ ký ghi cứng', () => {
    const body = buildQueryRequest(CFG, {
      requestId: 'REQ1',
      txnRef: 'P42T20261106100000',
      transactionDate: '20261106100000',
      orderInfo: 'Truy van don hang ALV20261106000001',
      now: new Date('2026-11-06T03:05:00Z'),
    });
    expect(body).toMatchObject({
      vnp_Command: 'querydr',
      vnp_Version: '2.1.0',
      vnp_CreateDate: '20261106100500',
      vnp_IpAddr: '127.0.0.1',
    });
    // REQ1|2.1.0|querydr|TESTTMN1|P42T20261106100000|20261106100000|20261106100500|127.0.0.1|Truy van don hang ALV20261106000001
    expect(body.vnp_SecureHash).toBe(
      'a87bd53d3e6563923f2474a456dd4e3c0c01616916693e816e55ab53513ce9090762d007b5c2ac9befcbaafc053ef53488c89dbde38c8db6834d9a87b61b7fc5',
    );
  });

  const response = {
    vnp_ResponseId: 'RESP1',
    vnp_Command: 'querydr',
    vnp_ResponseCode: '00',
    vnp_Message: 'QueryDR Success',
    vnp_TmnCode: 'TESTTMN1',
    vnp_TxnRef: 'P42T20261106100000',
    vnp_Amount: '1250000000',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20261106100200',
    vnp_TransactionNo: '14123456',
    vnp_TransactionType: '01',
    vnp_TransactionStatus: '00',
    vnp_OrderInfo: 'Thanh toan',
  };
  // RESP1|querydr|00|QueryDR Success|TESTTMN1|P42T…|1250000000|NCB|20261106100200|14123456|01|00|Thanh toan||
  const hash =
    '7bb2d77da3b9fa7b77cb243a84f127055b992a1a5d1bdfbdbf2d6443cef98ff157571b4211c0df048fe4ae32ec0effde042773f83fc9b81b2b354a44ba4b9684';

  it('phản hồi: trường vắng để rỗng, thứ tự cố định ⇒ đúng chữ ký ghi cứng', () => {
    expect(signQueryResponse(response, SECRET)).toBe(hash);
    expect(verifyQueryResponse({ ...response, vnp_SecureHash: hash }, SECRET)).toBe(true);
  });

  it('phản hồi bị sửa, sai khóa hoặc thiếu chữ ký ⇒ false', () => {
    const signed = { ...response, vnp_SecureHash: hash };
    expect(verifyQueryResponse({ ...signed, vnp_TransactionStatus: '02' }, SECRET)).toBe(false);
    expect(verifyQueryResponse({ ...signed, vnp_Amount: '1' }, SECRET)).toBe(false);
    expect(verifyQueryResponse(signed, 'khoa-khac')).toBe(false);
    expect(verifyQueryResponse(response, SECRET)).toBe(false);
  });
});
