// E2E (supertest) Mốc 4 trên aurelia_test: Kho (tồn kho theo biến thể), báo cáo doanh thu,
// Cài đặt hệ thống, VNPAY (URL + chữ ký, IPN, return-status, querydr, thanh toán lại) kiểm bằng KHÓA GIẢ.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CACHE_REDIS } from '../src/cache/cache.service';
import { sign, signQueryResponse, verify } from '../src/modules/payments/vnpay';

const FAKE = {
  tmn: 'FAKETMN1',
  secret: 'fake-hash-secret-for-tests',
  url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
};
const RETURN_URL = 'http://localhost:3000/checkout/vnpay-return';
const QUERY_URL = 'https://querydr.invalid/merchant_webapi/api/transaction'; // địa chỉ giả: fetch luôn bị chặn trong test

describe('Mốc 4 – kho, doanh thu, cài đặt, VNPAY (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  const saved: Record<string, string | undefined> = {};

  const api = (
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
    token?: string,
    body?: object,
  ) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) => {
    const r = await api('post', '/auth/login', undefined, { email, password, adminOnly });
    expect(r.status).toBe(200);
    return r.body.data.tokens.accessToken as string;
  };

  beforeAll(async () => {
    const [{ db, users }] = await prisma.$queryRaw<
      Array<{ db: string; users: bigint }>
    >`SELECT current_database() AS db, (SELECT count(*) FROM users) AS users`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    if (Number(users) < 30)
      throw new Error('aurelia_test chưa seed: chạy node scripts/db-reset.mjs aurelia_test');
    // khóa VNPAY GIẢ (chưa có tài khoản sandbox thật); trả lại env sau khi xong để file test khác không bị ảnh hưởng
    for (const [k, v] of Object.entries({
      VNPAY_TMN_CODE: FAKE.tmn,
      VNPAY_HASH_SECRET: FAKE.secret,
      VNPAY_PAYMENT_URL: FAKE.url,
      VNPAY_QUERY_URL: QUERY_URL,
      VNPAY_RETURN_URL: RETURN_URL,
    })) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await prisma.$disconnect();
    await app?.close();
  });

  const stockOf = async (id: number) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
  const variantWithStock = (min: number, skip = 0) =>
    prisma.productVariant
      .findMany({
        where: {
          isActive: true,
          stockQuantity: { gte: min },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
        take: skip + 1,
      })
      .then((r) => r[skip]);

  // ------------------------------------------------------------------------------------------ phân quyền
  describe('phân quyền', () => {
    it.each([
      ['get', '/admin/inventory'],
      ['get', '/admin/inventory/summary'],
      ['get', '/admin/stats/finance'],
      ['get', '/admin/settings'],
    ] as const)('khách gọi %s %s ⇒ 403; chưa đăng nhập ⇒ 401', async (m, path) => {
      expect((await api(m, path, cust)).status).toBe(403);
      expect((await api(m, path)).status).toBe(401);
    });
    it('khách ghi: sửa cài đặt ⇒ 403', async () => {
      expect((await api('put', '/admin/settings/store', cust, {})).status).toBe(403);
      expect((await api('put', '/admin/settings/site_name', cust, { value: 'x' })).status).toBe(403);
    });
  });

  // ------------------------------------------------------------------------------------------ Cài đặt
  describe('cài đặt hệ thống (UC-ADM-03)', () => {
    let original: { store: Record<string, unknown>; payments: unknown[]; shippingZones: unknown[] };

    it('GET trả store, payments, shippingZones và các khóa đơn giản trong general', async () => {
      const r = await api('get', '/admin/settings', admin);
      expect(r.status).toBe(200);
      original = r.body.data;
      expect(original.store).toMatchObject({ name: expect.any(String), email: expect.any(String) });
      expect(original.payments.length).toBeGreaterThan(0);
      expect(r.body.data.general).toMatchObject({
        site_name: expect.any(String),
        default_shipping_fee: expect.any(Number),
      });
      expect(r.body.data.general).not.toHaveProperty('ar_enabled'); // AR ngoài phạm vi (D-P11)
    });

    it('lưu trang cài đặt: sai email/tên trống/hotline trống ⇒ 400 đúng tên ô; hợp lệ ⇒ lưu và GET /settings/public thấy ngay', async () => {
      const bad = await api('put', '/admin/settings/store', admin, {
        store: { ...original.store, name: '  ', email: 'khong-phai-email', hotline: '' },
      });
      expect(bad.status).toBe(400);
      expect(Object.keys(bad.body.error.details)).toEqual(
        expect.arrayContaining(['name', 'email', 'hotline']),
      );
      const ok = await api('put', '/admin/settings/store', admin, {
        store: { ...original.store, name: 'Aurelia Test Store', hotline: '1900 1234' },
      });
      expect(ok.status).toBe(200);
      expect(ok.body.data.store.name).toBe('Aurelia Test Store');
      const pub = await api('get', '/settings/public');
      expect(pub.body.data.store.name).toBe('Aurelia Test Store');
      expect(pub.body.data.store.hotline).toBe('1900 1234');
      // chỉ gửi phần store ⇒ payments/shippingZones giữ nguyên
      expect(pub.body.data.payments).toEqual(original.payments);
      expect(pub.body.data.shippingZones).toEqual(original.shippingZones);
      const log = await prisma.activityLog.findFirst({
        where: { action: 'setting.update', targetType: 'setting' },
        orderBy: { id: 'desc' },
      });
      expect((log!.changes as { key: string }).key).toBe('store');
    });

    it('phương thức thanh toán và vùng vận chuyển được kiểm tra kiểu', async () => {
      const dup = await api('put', '/admin/settings/store', admin, {
        payments: [
          { method: 'cod', enabled: true, description: 'a' },
          { method: 'cod', enabled: false, description: 'b' },
        ],
      });
      expect(dup.status).toBe(400);
      expect(
        (
          await api('put', '/admin/settings/store', admin, {
            payments: [{ method: 'bitcoin', enabled: true }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await api('put', '/admin/settings/store', admin, {
            shippingZones: [{ id: 1, name: 'Vùng', fee: -5, eta: '1 ngày' }],
          })
        ).status,
      ).toBe(400);
      const flip = original.payments.map((p, i) => (i === 0 ? { ...(p as object), enabled: false } : p));
      const ok = await api('put', '/admin/settings/store', admin, { payments: flip });
      expect(ok.status).toBe(200);
      expect(ok.body.data.payments[0].enabled).toBe(false);
      const zones = (original.shippingZones as Array<Record<string, unknown>>).map((z, i) =>
        i === 0 ? { ...z, fee: 35000 } : z,
      );
      expect(
        (await api('put', '/admin/settings/store', admin, { shippingZones: zones })).body.data
          .shippingZones[0].fee,
      ).toBe(35000);
      // khôi phục
      await api('put', '/admin/settings/store', admin, original);
      const after = await api('get', '/admin/settings', admin);
      expect(after.body.data.store).toEqual(original.store);
      expect(after.body.data.payments).toEqual(original.payments);
      expect(after.body.data.shippingZones).toEqual(original.shippingZones);
    });

    it('PUT /admin/settings/:key – khóa ngoài danh sách ⇒ 400; sai kiểu ⇒ 400; hợp lệ ⇒ lưu + nhật ký trước/sau', async () => {
      const put = (key: string, value: unknown) => api('put', `/admin/settings/${key}`, admin, { value });
      expect((await put('khong_ton_tai', 1)).status).toBe(400);
      expect((await put('faq', [])).status).toBe(400); // FAQ có API riêng
      expect((await put('default_shipping_fee', -1)).status).toBe(400);
      expect((await put('default_shipping_fee', 'abc')).status).toBe(400);
      expect((await put('free_shipping_threshold', -100)).status).toBe(400);
      expect((await put('ar_enabled', true)).status).toBe(400); // khóa không còn được phép (D-P11)
      expect((await put('maintenance_mode', 1)).status).toBe(400);
      expect((await put('contact_email', 'sai')).status).toBe(400);
      expect((await put('currency', 'dong')).status).toBe(400);
      expect((await api('put', '/admin/settings/site_name', admin, {})).status).toBe(400); // thiếu value

      const before = (await prisma.setting.findUniqueOrThrow({ where: { key: 'default_shipping_fee' } }))
        .value;
      const ok = await put('default_shipping_fee', 175000);
      expect(ok.status).toBe(200);
      expect(ok.body.data).toEqual({ key: 'default_shipping_fee', value: 175000 });
      expect((await prisma.setting.findUniqueOrThrow({ where: { key: 'default_shipping_fee' } })).value).toBe(
        175000,
      );
      const log = await prisma.activityLog.findFirst({
        where: { action: 'setting.update' },
        orderBy: { id: 'desc' },
      });
      expect(log!.changes).toMatchObject({ key: 'default_shipping_fee', before, after: 175000 });
      expect((await put('default_shipping_fee', before)).status).toBe(200);
    });
  });

  // ------------------------------------------------------------------------------------------ Kho
  describe('kho hàng (UC-ADM-12)', () => {
    it('danh sách tồn: phân trang, tìm, lọc trạng thái, sắp xếp; không còn reservedQty; summary khớp DB', async () => {
      const r = await api('get', '/admin/inventory?pageSize=5&sort=stockQuantity:desc', admin);
      expect(r.status).toBe(200);
      expect(r.body.meta).toMatchObject({ page: 1, pageSize: 5 });
      expect(r.body.data).toHaveLength(5);
      const row = r.body.data[0];
      expect(row).toMatchObject({
        variantId: expect.any(Number),
        sku: expect.any(String),
        costPrice: expect.any(Number),
        stockQuantity: expect.any(Number),
        available: row.stockQuantity,
        minStock: expect.any(Number),
      });
      expect(row).not.toHaveProperty('reservedQty');
      const stocks = r.body.data.map((x: { stockQuantity: number }) => x.stockQuantity);
      expect(stocks).toEqual([...stocks].sort((a, b) => b - a));

      const sku = row.sku as string;
      const found = await api('get', `/admin/inventory?q=${encodeURIComponent(sku.toLowerCase())}`, admin);
      expect(found.body.data.some((x: { sku: string }) => x.sku === sku)).toBe(true);
      for (const state of ['in_stock', 'low', 'out']) {
        const s = await api('get', `/admin/inventory?state=${state}&pageSize=100`, admin);
        expect(s.body.data.every((x: { state: string }) => x.state === state)).toBe(true);
      }

      const sum = (await api('get', '/admin/inventory/summary', admin)).body.data;
      const all = await prisma.productVariant.findMany({
        where: { isActive: true, product: { deletedAt: null } },
      });
      expect(sum.totalStock).toBe(all.reduce((s, v) => s + v.stockQuantity, 0));
      expect(sum.stockValue).toBe(all.reduce((s, v) => s + v.stockQuantity * Number(v.costPrice), 0));
      expect(sum.outCount).toBe(all.filter((v) => v.stockQuantity <= 0).length);
      expect(sum.lowCount).toBe(
        all.filter((v) => v.stockQuantity > 0 && v.stockQuantity <= v.minStock).length,
      );
    });
  });

  // ------------------------------------------------------------------------------------------ Doanh thu
  describe('báo cáo doanh thu', () => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const report = async (from = today, to = today) =>
      (await api('get', `/admin/stats/finance?from=${from}&to=${to}`, admin)).body.data;

    /** Đặt đơn COD rồi chuyển tới completed; trả đơn */
    const deliveredOrder = async (stop = 'completed') => {
      const v = (await variantWithStock(12))!;
      const addr = await prisma.address.findFirstOrThrow({
        where: { userId: 2 },
        orderBy: { isDefault: 'desc' },
      });
      await api('delete', '/cart', cust);
      expect((await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 })).status).toBe(201);
      const o = (await api('post', '/orders', cust, { addressId: addr.id, paymentMethod: 'cod' })).body.data;
      if (stop !== 'cancelled') {
        for (const s of ['confirmed', 'processing'])
          expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: s })).status).toBe(200);
        const sh = await api('post', `/admin/orders/${o.id}/shipments`, admin, { carrier: 'ghn' });
        expect(sh.status).toBe(201);
        expect(
          (await api('patch', `/admin/orders/${o.id}/status`, admin, { status: 'shipping' })).status,
        ).toBe(200);
        for (const s of ['picked_up', 'in_transit', 'delivered'])
          expect(
            (await api('patch', `/admin/shipments/${sh.body.data.shipment.id}`, admin, { status: s })).status,
          ).toBe(200);
      }
      if (stop === 'cancelled')
        expect((await api('post', `/orders/${o.id}/cancel`, cust, { reason: 'Đổi ý' })).status).toBe(200);
      return o as { id: number; orderCode: string; total: number };
    };

    it('doanh thu = đơn giao thành công theo ngày giao; đơn hủy/chưa giao không tính', async () => {
      const r0 = await report();
      const yest0 = await report(yesterday, yesterday);
      await deliveredOrder('cancelled'); // đơn hủy
      expect((await report()).totalIncome).toBe(r0.totalIncome);

      const o = await deliveredOrder();
      const r1 = await report();
      expect(r1.totalIncome).toBe(r0.totalIncome + Number(o.total));
      expect(r1.daily[r1.daily.length - 1]).toMatchObject({
        date: today,
        revenue: r0.daily[r0.daily.length - 1].revenue + Number(o.total),
      });
      expect(
        r1.ledger.some(
          (l: { code: string; type: string; amount: number }) =>
            l.code === `TH-${o.orderCode}` && l.type === 'income' && l.amount === Number(o.total),
        ),
      ).toBe(true);
      expect(r1.byPaymentMethod.reduce((s: number, m: { amount: number }) => s + m.amount, 0)).toBe(
        r1.totalIncome,
      );
      expect(r1.monthly[new Date().getMonth()].income).toBeGreaterThanOrEqual(Number(o.total));
      // khoảng ngày khác (hôm qua) không bị ảnh hưởng
      expect((await report(yesterday, yesterday)).totalIncome).toBe(yest0.totalIncome);

      const r2 = await report();
      expect(r2.topProducts.length).toBeGreaterThan(0);
      expect(r2.deltas).toMatchObject({ income: expect.any(Number) });
      expect(r2).not.toHaveProperty('totalExpense');
    });
  });

  // ------------------------------------------------------------------------------------------ phương thức thanh toán bị tắt
  describe('payments[].enabled trong Cài đặt', () => {
    it('phương thức bị tắt ⇒ đặt hàng bị từ chối với lỗi tiếng Việt rõ ràng; thanh toán lại sang phương thức đó cũng bị từ chối; bật lại thì dùng được', async () => {
      const original = (await api('get', '/admin/settings', admin)).body.data.payments as Array<{
        method: string;
        enabled: boolean;
      }>;
      const setEnabled = (method: string, enabled: boolean) =>
        api('put', '/admin/settings/store', admin, {
          payments: original.map((p) => (p.method === method ? { ...p, enabled } : p)),
        });
      const v = (await variantWithStock(12))!;
      const addr = await prisma.address.findFirstOrThrow({
        where: { userId: 2 },
        orderBy: { isDefault: 'desc' },
      });
      const place = async (paymentMethod: string) => {
        await api('delete', '/cart', cust);
        await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 });
        return api('post', '/orders', cust, { addressId: addr.id, paymentMethod });
      };
      try {
        expect((await setEnabled('cod', false)).status).toBe(200);
        const stock0 = await stockOf(v.id);
        const orders0 = await prisma.order.count();
        const bad = await place('cod');
        expect(bad.status).toBe(400);
        expect(bad.body.error.message).toBe(
          'Phương thức "Thanh toán khi nhận hàng (COD)" hiện không khả dụng. Vui lòng chọn phương thức thanh toán khác.',
        );
        expect(bad.body.error.details.paymentMethod).toHaveLength(1);
        expect(await prisma.order.count()).toBe(orders0); // không tạo đơn
        expect(await stockOf(v.id)).toBe(stock0); // không trừ tồn
        // phương thức khác vẫn đặt được
        const ok = await place('bank_transfer');
        expect(ok.status).toBe(201);
        // đổi sang phương thức đã tắt khi thanh toán lại ⇒ 400
        const retry = await api('post', `/payments/${ok.body.data.id}/retry`, cust, { method: 'cod' });
        expect(retry.status).toBe(400);
        expect((await prisma.order.findUniqueOrThrow({ where: { id: ok.body.data.id } })).paymentMethod).toBe(
          'bank_transfer',
        );
        // bật lại
        expect((await setEnabled('cod', true)).status).toBe(200);
        expect((await place('cod')).status).toBe(201);
        expect(
          (await api('post', `/payments/${ok.body.data.id}/retry`, cust, { method: 'cod' })).status,
        ).toBe(200);
      } finally {
        await api('put', '/admin/settings/store', admin, { payments: original });
      }
    });
  });

  // ------------------------------------------------------------------------------------------ phí ship theo vùng và mặc định (UC-ORD-01)
  describe('phí vận chuyển', () => {
    it('tỉnh thuộc vùng ⇒ phí/ngưỡng của vùng; tỉnh ngoài mọi vùng ⇒ default_shipping_fee và free_shipping_threshold trong Cài đặt', async () => {
      const put = (key: string, value: unknown) => api('put', `/admin/settings/${key}`, admin, { value });
      const oldFee = (await prisma.setting.findUniqueOrThrow({ where: { key: 'default_shipping_fee' } }))
        .value;
      const oldFree = (await prisma.setting.findUniqueOrThrow({ where: { key: 'free_shipping_threshold' } }))
        .value;
      const zones = (await prisma.setting.findUniqueOrThrow({ where: { key: 'shippingZones' } }))
        .value as Array<{
        name: string;
        fee: number;
        freeFrom: number;
      }>;
      const inZone = zones[0];
      const mk = async (province: string) =>
        (
          await api('post', '/addresses', cust, {
            recipientName: 'Người nhận',
            phone: '0912345678',
            province,
            district: 'Quận 1',
            ward: 'Phường 1',
            addressLine: '1 Đường A',
            label: 'Thử phí ship',
          })
        ).body.data.id as number;
      try {
        const out = await mk('Cà Mau'); // không thuộc vùng nào
        const inside = await mk(inZone.name);
        expect((await put('default_shipping_fee', 175_000)).status).toBe(200);
        expect((await put('free_shipping_threshold', 3_000_000)).status).toBe(200);
        const v = await prisma.productVariant.findFirstOrThrow({
          where: {
            isActive: true,
            stockQuantity: { gte: 5 },
            product: { status: 'published', deletedAt: null },
          },
        });
        const fee = async (addressId: number, qty: number) => {
          await api('delete', '/cart', cust);
          await api('post', '/cart/items', cust, { variantId: v.id, quantity: qty });
          const c = (await api('get', `/cart?addressId=${addressId}`, cust)).body.data;
          return { shipping: c.shippingFee as number, subtotal: c.subtotal as number };
        };
        const a1 = await fee(out, 1);
        // ngoài vùng: phí mặc định 175.000 nếu tạm tính < ngưỡng 3.000.000, ngược lại 0
        expect(a1.shipping).toBe(a1.subtotal >= 3_000_000 ? 0 : 175_000);
        // ép tạm tính vượt ngưỡng bằng cách mua nhiều đến khi ≥ 3.000.000 (cùng biến thể)
        const unit = a1.subtotal;
        const need = Math.max(1, Math.ceil(3_000_000 / unit));
        if (need <= 5) expect((await fee(out, need)).shipping).toBe(0);
        // trong vùng: dùng fee/freeFrom của vùng, KHÔNG bị default_shipping_fee ảnh hưởng
        const b1 = await fee(inside, 1);
        expect(b1.shipping).toBe(b1.subtotal >= inZone.freeFrom ? 0 : inZone.fee);
      } finally {
        await put('default_shipping_fee', oldFee);
        await put('free_shipping_threshold', oldFree);
        await prisma.address.deleteMany({ where: { userId: 2, label: 'Thử phí ship' } });
        await api('delete', '/cart', cust);
      }
    });
  });

  // ------------------------------------------------------------------------------------------ VNPAY (khóa giả)
  describe('VNPAY sandbox – khóa giả (UC-PAY-01/02/03)', () => {
    const placeOrder = async (method = 'vnpay', token = cust, userId = 2) => {
      const v = (await variantWithStock(12))!;
      const addr = await prisma.address.findFirstOrThrow({
        where: { userId },
        orderBy: { isDefault: 'desc' },
      });
      await api('delete', '/cart', token);
      expect((await api('post', '/cart/items', token, { variantId: v.id, quantity: 1 })).status).toBe(201);
      const r = await api('post', '/orders', token, { addressId: addr.id, paymentMethod: method });
      expect(r.status).toBe(201);
      return r.body.data as { id: number; orderCode: string; total: number };
    };
    type Order = Awaited<ReturnType<typeof placeOrder>>;
    const latestPayment = (orderId: number) =>
      prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { id: 'desc' } });
    const payRow = (id: number) => prisma.payment.findUniqueOrThrow({ where: { id } });
    const ordRow = (id: number) => prisma.order.findUniqueOrThrow({ where: { id } });
    const state = async (id: number) => {
      const o = await ordRow(id);
      return [o.status, o.paymentStatus];
    };
    /** Tạo URL qua API và trả về tham số đã ký + id giao dịch của lần thử */
    const attemptFrom = async (res: request.Response, orderId: number) => {
      expect(res.status).toBe(200);
      const q = Object.fromEntries(new URL(res.body.data.redirectUrl).searchParams.entries());
      const pay = await latestPayment(orderId);
      return { q, ref: q.vnp_TxnRef, paymentId: pay.id };
    };
    const start = async (o: Order) =>
      attemptFrom(await api('post', `/payments/${o.id}/checkout`, cust), o.id);
    const newOrder = async () => {
      const o = await placeOrder();
      return { o, a: await start(o) };
    };
    /** Tham số cổng gửi về (IPN/Return) ký bằng khóa giả */
    const callback = (
      o: { total: number },
      a: { ref: string; paymentId: number },
      extra: Record<string, string> = {},
      secret = FAKE.secret,
    ) => {
      const p: Record<string, string> = {
        vnp_TmnCode: FAKE.tmn,
        vnp_Amount: String(Math.round(Number(o.total) * 100)),
        vnp_BankCode: 'NCB',
        vnp_TxnRef: a.ref,
        vnp_OrderInfo: 'Thanh toan don hang',
        vnp_TransactionNo: String(14_000_000 + a.paymentId),
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_PayDate: '20261107100000',
        ...extra,
      };
      return { ...p, vnp_SecureHash: sign(p, secret) };
    };
    const FAILED = { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' };
    const qs = (p: Record<string, string>) => new URLSearchParams(p).toString();
    const ipn = (p: Record<string, string>) => http.get(`/api/payments/vnpay/ipn?${qs(p)}`);
    const status = (p: Record<string, string>) => http.get(`/api/payments/vnpay/return-status?${qs(p)}`);
    const paidNotes = (code: string) =>
      prisma.notification.count({ where: { userId: 2, title: `Thanh toán đơn ${code} thành công` } });
    const adminNotes = (title: string) => prisma.notification.count({ where: { userId: 1, title } });
    const redisKey = (k: string) => `${process.env.CACHE_KEY_PREFIX}vnpay:${k}`;
    const redis = () => app.get<Redis>(CACHE_REDIS);
    // các case tạo nhiều URL bằng cùng một khách: xóa bộ đếm trước mỗi case (hạn mức được kiểm ở case Q5)
    beforeEach(() => redis().del(redisKey('url:2')));

    // ---------------- tạo URL
    it('checkout: chữ ký hợp lệ, số tiền = payments.amount × 100 (không nhận từ client), TxnRef lưu theo lần thử', async () => {
      const o = await placeOrder();
      const first = await latestPayment(o.id);
      const r = await api('post', `/payments/${o.id}/checkout`, cust, { amount: 1, outcome: 'success' });
      const a = await attemptFrom(r, o.id);
      expect(a.paymentId).toBe(first.id); // lần đầu dùng dòng tạo lúc đặt hàng
      expect(r.body.data.paymentUrl).toBe(r.body.data.redirectUrl);
      const url = new URL(r.body.data.redirectUrl);
      expect(url.origin + url.pathname).toBe(FAKE.url);
      expect(a.q).toMatchObject({
        vnp_TmnCode: FAKE.tmn,
        vnp_Amount: String(Math.round(Number(o.total) * 100)),
        vnp_ReturnUrl: RETURN_URL,
        vnp_CurrCode: 'VND',
        vnp_OrderInfo: `Thanh toan don hang ${o.orderCode.replace(/-/g, '')}`,
        vnp_IpAddr: '127.0.0.1',
      });
      expect(a.ref).toMatch(new RegExp(`^P${first.id}T\\d{14}$`));
      expect(verify(a.q, FAKE.secret)).toBe(true);
      expect((await payRow(first.id)).gatewayResponse).toEqual({
        request: { txnRef: a.ref, createDate: a.q.vnp_CreateDate, expireDate: a.q.vnp_ExpireDate },
      });
      expect(await state(o.id)).toEqual(['pending', 'unpaid']);
    });

    it('mỗi lần tạo URL là một dòng payments với TxnRef mới; dòng cũ bị đóng nhưng giữ TxnRef', async () => {
      const { o, a } = await newOrder();
      const b = await start(o);
      expect(b.paymentId).not.toBe(a.paymentId);
      expect(b.ref).not.toBe(a.ref);
      const old = await payRow(a.paymentId);
      expect(old.status).toBe('failed');
      expect(old.gatewayResponse).toMatchObject({ request: { txnRef: a.ref } });
      expect(await prisma.payment.count({ where: { orderId: o.id, status: 'pending' } })).toBe(1);
    });

    it('điều kiện: người khác ⇒ 404; đã trả/đã hủy/đang xử lý ⇒ 409; COD không qua cổng', async () => {
      const { o, a } = await newOrder();
      const other = await login((await prisma.user.findUniqueOrThrow({ where: { id: 3 } })).email, '123456');
      expect((await api('post', `/payments/${o.id}/checkout`, other)).status).toBe(404);
      await ipn(callback(o, a));
      expect((await api('post', `/payments/${o.id}/checkout`, cust)).status).toBe(409);
      expect((await api('post', `/payments/${o.id}/retry`, cust)).status).toBe(409);
      const cancelled = await placeOrder();
      await api('post', `/orders/${cancelled.id}/cancel`, cust, { reason: 'Đổi ý' });
      expect((await api('post', `/payments/${cancelled.id}/checkout`, cust)).status).toBe(409);
      expect((await api('post', `/payments/${cancelled.id}/retry`, cust)).status).toBe(409);
      const busy = await placeOrder();
      await prisma.order.update({ where: { id: busy.id }, data: { status: 'processing' } });
      expect((await api('post', `/payments/${busy.id}/checkout`, cust)).status).toBe(409);
      expect((await api('post', `/payments/${busy.id}/retry`, cust)).status).toBe(409);
      const cod = await placeOrder('cod');
      const r = await api('post', `/payments/${cod.id}/checkout`, cust);
      expect(r.body.data.redirectUrl).toBe(`/checkout/success?order=${cod.orderCode}`);
    });

    // ---------------- Return URL (chỉ đọc)
    it('route Return cũ đã bỏ; return-status lần đầu KHÔNG ghi gì, KHÔNG gọi cổng, chỉ trả 4 trường', async () => {
      const { o, a } = await newOrder();
      expect((await http.get(`/api/payments/vnpay/return?${qs(callback(o, a))}`)).status).not.toBe(302);
      const spy = jest.spyOn(globalThis, 'fetch');
      const before = await payRow(a.paymentId);
      const r = await status(callback(o, a)); // tham số báo "thành công" nhưng CSDL chưa ghi nhận
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({
        valid: true,
        orderCode: o.orderCode,
        responseCode: '00',
        paymentStatus: 'unpaid',
      });
      expect(spy).not.toHaveBeenCalled();
      expect(await payRow(a.paymentId)).toEqual(before);
      expect(await state(o.id)).toEqual(['pending', 'unpaid']);
      spy.mockRestore();
    });

    it('return-status: sai chữ ký, sửa tham số, sai TmnCode, TxnRef lạ ⇒ { valid: false }', async () => {
      const { o, a } = await newOrder();
      const good = callback(o, a);
      for (const p of [
        callback(o, a, {}, 'khoa-sai'),
        { ...good, vnp_Amount: '100' },
        callback(o, a, { vnp_TmnCode: 'KHAC0001' }),
        callback(o, { ref: 'P999999999T20260101000000', paymentId: 1 }),
      ]) {
        expect((await status(p)).body.data).toEqual({ valid: false });
      }
      expect(await state(o.id)).toEqual(['pending', 'unpaid']);
    });

    // ---------------- IPN
    it('IPN: 97 sai chữ ký/TmnCode; 01 không có giao dịch; 04 sai số tiền; 00 thành công; gọi lại 02', async () => {
      const { o, a } = await newOrder();
      const bad = await ipn(callback(o, a, {}, 'khoa-sai'));
      expect(bad.status).toBe(200);
      expect(bad.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
      expect((await ipn({})).body.RspCode).toBe('97');
      expect((await ipn(callback(o, a, { vnp_TmnCode: 'KHAC0001' }))).body.RspCode).toBe('97');
      // TxnRef đúng dạng nhưng hệ thống chưa từng gửi (đúng id, sai thời điểm)
      for (const ref of ['P999999999T20260101000000', `P${a.paymentId}T20200101000000`, 'ALV-1-P1'])
        expect((await ipn(callback(o, { ...a, ref }))).body.RspCode).toBe('01');
      const wrong = await ipn(callback(o, a, { vnp_Amount: String((Number(o.total) - 1) * 100) }));
      expect(wrong.body.RspCode).toBe('04');
      expect(await state(o.id)).toEqual(['pending', 'unpaid']);

      const ok = await ipn(callback(o, a));
      expect(ok.body).toEqual({ RspCode: '00', Message: 'Confirm Success' }); // không bọc { success, data }
      expect(await state(o.id)).toEqual(['confirmed', 'paid']);
      const p = await payRow(a.paymentId);
      expect(p).toMatchObject({ status: 'success', transactionCode: String(14_000_000 + a.paymentId) });
      expect(p.paidAt).not.toBeNull();
      const g = p.gatewayResponse as { request: unknown; result: { source: string; raw: object } };
      expect(g.request).toMatchObject({ txnRef: a.ref });
      expect(g.result.source).toBe('ipn');
      expect(g.result.raw).toMatchObject({ vnp_BankCode: 'NCB', vnp_TxnRef: a.ref });
      expect(g.result.raw).not.toHaveProperty('vnp_SecureHash');
      // API đơn hàng không trả dữ liệu thô của cổng
      const view = (await api('get', `/orders/${o.orderCode}`, cust)).body.data;
      expect(view.payment).toMatchObject({ id: a.paymentId, status: 'success' });
      expect(view.payment.gatewayResponse).toEqual({ code: '00', source: 'ipn' });

      expect((await ipn(callback(o, a))).body.RspCode).toBe('02');
      expect(await paidNotes(o.orderCode)).toBe(1);
    });

    it('IPN thất bại ở lần thử hiện hành: payment failed, đơn failed nhưng vẫn pending; gọi lại 02', async () => {
      const { o, a } = await newOrder();
      expect((await ipn(callback(o, a, FAILED))).body.RspCode).toBe('00');
      expect(await state(o.id)).toEqual(['pending', 'failed']);
      expect((await payRow(a.paymentId)).status).toBe('failed');
      expect((await ipn(callback(o, a, FAILED))).body.RspCode).toBe('02');
    });

    it('thiếu vnp_TransactionStatus ⇒ không được coi là thành công', async () => {
      const { o, a } = await newOrder();
      const p: Record<string, string> = callback(o, a);
      delete p.vnp_TransactionStatus;
      delete p.vnp_SecureHash;
      expect((await ipn({ ...p, vnp_SecureHash: sign(p, FAKE.secret) })).body.RspCode).toBe('00');
      expect(await state(o.id)).toEqual(['pending', 'failed']);
    });

    it('hai IPN cùng lúc: đúng một lần ghi nhận (00), lần kia 02; không trùng lịch sử/thông báo', async () => {
      const { o, a } = await newOrder();
      const cb = callback(o, a);
      const [x, y] = await Promise.all([ipn(cb), ipn(cb)]);
      expect([x.body.RspCode, y.body.RspCode].sort()).toEqual(['00', '02']);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id, toStatus: 'confirmed' } })).toBe(
        1,
      );
      expect(await paidNotes(o.orderCode)).toBe(1);
    });

    it('thanh toán lại: TxnRef mới; IPN thất bại của lần cũ chỉ ghi vào giao dịch cũ, không đổi đơn', async () => {
      const { o, a } = await newOrder();
      const b = await attemptFrom(await api('post', `/payments/${o.id}/retry`, cust, {}), o.id);
      expect(b.ref).not.toBe(a.ref);
      expect(verify(b.q, FAKE.secret)).toBe(true);
      expect((await ipn(callback(o, a, FAILED))).body.RspCode).toBe('00');
      expect(await state(o.id)).toEqual(['pending', 'unpaid']);
      expect((await payRow(b.paymentId)).status).toBe('pending');
      expect((await ipn(callback(o, b))).body.RspCode).toBe('00');
      expect(await state(o.id)).toEqual(['confirmed', 'paid']);
    });

    it('Q1: tiền về cho lần thử ĐÃ BỊ THAY THẾ khi đơn chưa trả ⇒ ghi nhận, đơn paid, đóng lần thử khác', async () => {
      const { o, a } = await newOrder();
      const b = await start(o);
      expect((await ipn(callback(o, a))).body.RspCode).toBe('00');
      expect(await state(o.id)).toEqual(['confirmed', 'paid']);
      expect((await payRow(a.paymentId)).status).toBe('success');
      expect((await payRow(b.paymentId)).status).toBe('failed');
    });

    it('Q1: khách đã đổi sang COD rồi tiền VNPAY mới về ⇒ đơn paid và theo lại phương thức đã trả', async () => {
      const { o, a } = await newOrder();
      await api('post', `/payments/${o.id}/retry`, cust, { method: 'cod' });
      expect((await ipn(callback(o, a))).body.RspCode).toBe('00');
      const row = await ordRow(o.id);
      expect([row.status, row.paymentStatus, row.paymentMethod]).toEqual(['confirmed', 'paid', 'vnpay']);
      expect(await prisma.payment.count({ where: { orderId: o.id, status: 'pending' } })).toBe(0);
    });

    it('Q2: trả hai lần ⇒ giao dịch thứ hai success, đơn không đổi, báo admin hoàn khoản dư, trả 00', async () => {
      const { o, a } = await newOrder();
      const b = await start(o);
      await ipn(callback(o, b));
      const history = await prisma.orderStatusHistory.count({ where: { orderId: o.id } });
      const before = await ordRow(o.id);
      const title = `Đơn ${o.orderCode} bị thanh toán hai lần, cần hoàn khoản dư`;
      expect((await ipn(callback(o, a))).body.RspCode).toBe('00');
      expect((await payRow(a.paymentId)).status).toBe('success');
      expect((await payRow(b.paymentId)).status).toBe('success');
      expect(await ordRow(o.id)).toEqual(before);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(history);
      expect(await adminNotes(title)).toBe(1);
      expect(await paidNotes(o.orderCode)).toBe(1);
      expect((await ipn(callback(o, a))).body.RspCode).toBe('02');
      expect(await adminNotes(title)).toBe(1);
    });

    it('D-N28: tiền về sau khi đơn đã hủy ⇒ giữ cancelled, success + paid, báo admin; gọi lại 02', async () => {
      const { o, a } = await newOrder();
      expect((await api('post', `/orders/${o.id}/cancel`, cust, { reason: 'Đổi ý' })).status).toBe(200);
      expect((await payRow(a.paymentId)).status).toBe('failed'); // đóng lúc hủy
      const history = await prisma.orderStatusHistory.count({ where: { orderId: o.id } });
      expect((await ipn(callback(o, a))).body.RspCode).toBe('00');
      expect(await state(o.id)).toEqual(['cancelled', 'paid']);
      expect((await payRow(a.paymentId)).status).toBe('success');
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(history);
      const title = `Đơn ${o.orderCode} đã hủy nhưng khách đã thanh toán, cần hoàn tiền`;
      expect(await adminNotes(title)).toBe(1);
      expect((await ipn(callback(o, a))).body.RspCode).toBe('02');
      expect(await adminNotes(title)).toBe(1);
    });

    // ---------------- querydr
    describe('querydr khi chưa có IPN', () => {
      let spy: jest.SpyInstance;
      afterEach(() => spy?.mockRestore());

      /** Giả cổng: phản hồi ký bằng khóa giả theo yêu cầu nhận được */
      const gateway = (o: { total: number }, extra: Record<string, string> = {}, secret = FAKE.secret) => {
        spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
          const req = JSON.parse(String(init!.body)) as Record<string, string>;
          const body: Record<string, string> = {
            vnp_ResponseId: 'RESP1',
            vnp_Command: 'querydr',
            vnp_ResponseCode: '00',
            vnp_Message: 'QueryDR Success',
            vnp_TmnCode: FAKE.tmn,
            vnp_TxnRef: req.vnp_TxnRef,
            vnp_Amount: String(Math.round(Number(o.total) * 100)),
            vnp_BankCode: 'NCB',
            vnp_PayDate: '20261107100200',
            vnp_TransactionNo: String(15_000_000 + Number(/^P(\d+)T/.exec(req.vnp_TxnRef)![1])),
            vnp_TransactionType: '01',
            vnp_TransactionStatus: '00',
            vnp_OrderInfo: req.vnp_OrderInfo,
            ...extra,
          };
          body.vnp_SecureHash = signQueryResponse(body, secret);
          return new Response(JSON.stringify(body), { status: 200 });
        });
        return spy;
      };
      /** Coi như khách đã quay về từ trước đó quá thời gian chờ */
      const waited = (ref: string) =>
        redis().set(redisKey(`seen:${ref}`), String(Date.now() - 60_000), 'EX', 600);

      it('chưa đủ vài giây ⇒ chưa gọi; đủ ⇒ gọi, yêu cầu ký đúng, ghi nhận với nguồn querydr; IPN sau đó ⇒ 02', async () => {
        const { o, a } = await newOrder();
        const f = gateway(o);
        expect((await status(callback(o, a))).body.data.paymentStatus).toBe('unpaid');
        expect(f).not.toHaveBeenCalled();
        await waited(a.ref);
        expect((await status(callback(o, a))).body.data.paymentStatus).toBe('paid');
        expect(f).toHaveBeenCalledTimes(1);
        const sent = JSON.parse(String(f.mock.calls[0][1]!.body));
        expect(f.mock.calls[0][0]).toBe(QUERY_URL);
        expect(sent).toMatchObject({
          vnp_Command: 'querydr',
          vnp_TxnRef: a.ref,
          vnp_TransactionDate: a.q.vnp_CreateDate,
        });
        expect(sent.vnp_RequestId).toMatch(/^[0-9a-f]{32}$/);
        expect(sent.vnp_SecureHash).toMatch(/^[0-9a-f]{128}$/);
        expect(await state(o.id)).toEqual(['confirmed', 'paid']);
        expect((await payRow(a.paymentId)).gatewayResponse).toMatchObject({ result: { source: 'querydr' } });
        expect((await ipn(callback(o, a))).body.RspCode).toBe('02');
        // đã có kết quả ⇒ không hỏi cổng nữa
        await status(callback(o, a));
        expect(f).toHaveBeenCalledTimes(1);
        expect(await paidNotes(o.orderCode)).toBe(1);
      });

      it('chữ ký phản hồi KHÔNG khớp ⇒ không ghi gì', async () => {
        const { o, a } = await newOrder();
        const f = gateway(o, {}, 'khoa-sai');
        await waited(a.ref);
        const before = await payRow(a.paymentId);
        expect((await status(callback(o, a))).body.data.paymentStatus).toBe('unpaid');
        expect(f).toHaveBeenCalledTimes(1);
        expect(await payRow(a.paymentId)).toEqual(before);
      });

      it.each([
        ['mã truy vấn lỗi (91)', { vnp_ResponseCode: '91' }],
        ['giao dịch chưa hoàn tất (01)', { vnp_TransactionStatus: '01' }],
        ['nghi gian lận (07)', { vnp_TransactionStatus: '07' }],
        ['sai số tiền', { vnp_Amount: '100' }],
        ['TxnRef khác giao dịch đã hỏi', { vnp_TxnRef: 'P1T20260101000000' }],
        ['không phải giao dịch thanh toán', { vnp_TransactionType: '02' }],
      ])('%s ⇒ không ghi gì', async (_name, extra) => {
        const { o, a } = await newOrder();
        gateway(o, extra as Record<string, string>);
        await waited(a.ref);
        const before = await payRow(a.paymentId);
        await status(callback(o, a));
        expect(await payRow(a.paymentId)).toEqual(before);
        expect(await state(o.id)).toEqual(['pending', 'unpaid']);
      });

      it('trạng thái 02 ⇒ ghi thất bại như IPN', async () => {
        const { o, a } = await newOrder();
        gateway(o, { vnp_TransactionStatus: '02' });
        await waited(a.ref);
        expect((await status(callback(o, a, FAILED))).body.data.paymentStatus).toBe('failed');
        expect((await payRow(a.paymentId)).status).toBe('failed');
      });

      it('tối đa 3 lần/phút cho mỗi TxnRef; cổng lỗi mạng không làm hỏng return-status', async () => {
        const { o, a } = await newOrder();
        spy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('mất mạng'));
        await waited(a.ref);
        for (let i = 0; i < 6; i++) expect((await status(callback(o, a))).status).toBe(200);
        expect(spy).toHaveBeenCalledTimes(3);
      });

      it('IPN và querydr đến cùng lúc ⇒ chỉ ghi một lần', async () => {
        const { o, a } = await newOrder();
        gateway(o, { vnp_TransactionNo: String(14_000_000 + a.paymentId) });
        await waited(a.ref);
        const [x] = await Promise.all([ipn(callback(o, a)), status(callback(o, a))]);
        expect(['00', '02']).toContain(x.body.RspCode);
        expect(await state(o.id)).toEqual(['confirmed', 'paid']);
        expect(await paidNotes(o.orderCode)).toBe(1);
      });
    });

    // ---------------- giới hạn, phương thức, đơn chưa trả tiền
    it('Q5: hết hạn mức tạo URL trong phút ⇒ 429 ở cả checkout và retry, retry KHÔNG đổi dữ liệu', async () => {
      const o = await placeOrder();
      await redis().set(redisKey('url:2'), '1000000', 'EX', 60);
      try {
        const before = await prisma.payment.findMany({ where: { orderId: o.id } });
        const c = await api('post', `/payments/${o.id}/checkout`, cust);
        expect([c.status, c.body.error.code]).toEqual([429, 'RATE_LIMITED']);
        expect((await api('post', `/payments/${o.id}/retry`, cust, {})).status).toBe(429);
        expect(await prisma.payment.findMany({ where: { orderId: o.id } })).toEqual(before);
        // đổi sang COD không tạo URL ⇒ không bị chặn
        expect((await api('post', `/payments/${o.id}/retry`, cust, { method: 'cod' })).status).toBe(200);
      } finally {
        await redis().del(redisKey('url:2'));
      }
    });

    it('thanh toán lại đổi sang COD: không qua cổng; phương thức lạ ⇒ 400', async () => {
      const o = await placeOrder();
      expect((await api('post', `/payments/${o.id}/retry`, cust, { method: 'bitcoin' })).status).toBe(400);
      const r = await api('post', `/payments/${o.id}/retry`, cust, { method: 'cod' });
      expect(r.body.data.redirectUrl).toBe(`/checkout/success?order=${o.orderCode}`);
      expect((await ordRow(o.id)).paymentMethod).toBe('cod');
      expect((await latestPayment(o.id)).method).toBe('cod');
    });

    it('Q6: MoMo/ZaloPay bị từ chối ở đơn mới (khách, admin tạo hộ) và khi thanh toán lại; đơn cũ giữ nguyên', async () => {
      const addr = await prisma.address.findFirstOrThrow({ where: { userId: 2 } });
      const v = (await variantWithStock(12))!;
      const o = await placeOrder();
      for (const method of ['momo', 'zalopay']) {
        await api('delete', '/cart', cust);
        await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 });
        const r = await api('post', '/orders', cust, { addressId: addr.id, paymentMethod: method });
        expect(r.status).toBe(400);
        expect(r.body.error.message).toContain('không còn được hỗ trợ');
        const byAdmin = await api('post', '/admin/orders', admin, {
          userId: 2,
          paymentMethod: method,
          items: [{ variantId: v.id, quantity: 1 }],
        });
        expect(byAdmin.status).toBe(400);
        expect((await api('post', `/payments/${o.id}/retry`, cust, { method })).status).toBe(400);
      }
      await prisma.order.update({ where: { id: o.id }, data: { paymentMethod: 'momo' } });
      expect((await api('get', `/orders/${o.orderCode}`, cust)).body.data.paymentMethod).toBe('momo');
      expect((await api('post', `/payments/${o.id}/retry`, cust, {})).status).toBe(400);
      expect((await api('post', `/payments/${o.id}/retry`, cust, { method: 'cod' })).status).toBe(200);
    });

    it('Q7: đơn VNPAY/thẻ chưa paid không chuyển sang processing (409, báo rõ); đã paid thì được', async () => {
      for (const method of ['vnpay', 'card']) {
        const o = await placeOrder(method);
        const set = (s: string) => api('patch', `/admin/orders/${o.id}/status`, admin, { status: s });
        expect((await set('confirmed')).status).toBe(200);
        const blocked = await set('processing');
        expect([blocked.status, blocked.body.error.code]).toEqual([409, 'INVALID_STATE']);
        expect(blocked.body.error.message).toContain('chưa nhận được tiền');
        expect((await ordRow(o.id)).status).toBe('confirmed');
        const a = await start(o);
        await ipn(callback(o, a));
        expect((await set('processing')).status).toBe(200);
      }
      const cod = await placeOrder('cod');
      await api('patch', `/admin/orders/${cod.id}/status`, admin, { status: 'confirmed' });
      expect(
        (await api('patch', `/admin/orders/${cod.id}/status`, admin, { status: 'processing' })).status,
      ).toBe(200);
    });
  });
});
