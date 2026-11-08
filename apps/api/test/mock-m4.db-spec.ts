// E2E (supertest) Mốc 4 trên aurelia_test: Kho (tồn, biến động, phiếu nhập/xuất nháp-xác nhận-hủy), Thu chi + báo cáo,
// Cài đặt hệ thống, VNPAY (URL + chữ ký, Return URL, IPN, thanh toán lại) kiểm bằng KHÓA GIẢ.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { sign, verify } from '../src/modules/payments/vnpay';

const FAKE = {
  tmn: 'FAKETMN1',
  secret: 'fake-hash-secret-for-tests',
  url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
};
const RETURN_URL = 'http://localhost:4000/api/payments/vnpay/return';

describe('Mốc 4 – kho, thu chi, cài đặt, VNPAY (aurelia_test)', () => {
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
      VNPAY_URL: FAKE.url,
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
      ['get', '/admin/inventory/movements'],
      ['get', '/admin/inventory/receipts'],
      ['get', '/admin/stats/finance'],
      ['get', '/admin/expenses'],
      ['get', '/admin/settings'],
    ] as const)('khách gọi %s %s ⇒ 403; chưa đăng nhập ⇒ 401', async (m, path) => {
      expect((await api(m, path, cust)).status).toBe(403);
      expect((await api(m, path)).status).toBe(401);
    });
    it('khách ghi: tạo phiếu kho, phiếu chi, sửa cài đặt ⇒ 403', async () => {
      expect((await api('post', '/admin/inventory/receipts', cust, { type: 'out', items: [] })).status).toBe(
        403,
      );
      expect((await api('post', '/admin/inventory/movements', cust, {})).status).toBe(403);
      expect((await api('post', '/admin/expenses', cust, {})).status).toBe(403);
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
  describe('kho hàng (UC-ADM-12, phương án b′)', () => {
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

    it('ghi biến động: nhập +, điều chỉnh ±, hàng trả; đúng một movement; quá tồn ⇒ 409 không đổi gì; sai dữ liệu ⇒ 400/404', async () => {
      const v = (await variantWithStock(10))!;
      const s0 = await stockOf(v.id);
      const m0 = await prisma.inventoryMovement.count({ where: { variantId: v.id } });
      const imp = await api('post', '/admin/inventory/movements', admin, {
        variantId: v.id,
        type: 'import',
        quantityChange: 7,
        reason: 'Nhập thử',
        referenceCode: 'CT-001',
      });
      expect(imp.status).toBe(201);
      expect(imp.body.data.stockQuantity).toBe(s0 + 7);
      expect(await stockOf(v.id)).toBe(s0 + 7);
      expect(await prisma.inventoryMovement.count({ where: { variantId: v.id } })).toBe(m0 + 1);
      const mv = await prisma.inventoryMovement.findFirstOrThrow({
        where: { variantId: v.id },
        orderBy: { id: 'desc' },
      });
      expect(mv).toMatchObject({
        type: 'import',
        quantityChange: 7,
        referenceCode: 'CT-001',
        reason: 'Nhập thử',
      });
      expect(mv.performedBy).toBe(1);

      expect(
        (
          await api('post', '/admin/inventory/movements', admin, {
            variantId: v.id,
            type: 'adjustment',
            quantityChange: -3,
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await api('post', '/admin/inventory/movements', admin, {
            variantId: v.id,
            type: 'return',
            quantityChange: 2,
          })
        ).status,
      ).toBe(201);
      expect(await stockOf(v.id)).toBe(s0 + 7 - 3 + 2);

      const m1 = await prisma.inventoryMovement.count({ where: { variantId: v.id } });
      const over = await api('post', '/admin/inventory/movements', admin, {
        variantId: v.id,
        type: 'adjustment',
        quantityChange: -(s0 + 1000),
      });
      expect(over.status).toBe(409);
      expect(over.body.error.code).toBe('OUT_OF_STOCK');
      expect(await stockOf(v.id)).toBe(s0 + 6);
      expect(await prisma.inventoryMovement.count({ where: { variantId: v.id } })).toBe(m1);

      const post = (b: object) => api('post', '/admin/inventory/movements', admin, b);
      expect((await post({ variantId: v.id, type: 'adjustment', quantityChange: 0 })).status).toBe(400);
      expect((await post({ variantId: v.id, type: 'sale', quantityChange: -1 })).status).toBe(400); // sale chỉ do hệ thống
      expect((await post({ variantId: v.id, type: 'import', quantityChange: -5 })).status).toBe(400);
      expect((await post({ variantId: v.id, type: 'import', quantityChange: 1.5 })).status).toBe(400);
      expect((await post({ variantId: 0, type: 'import', quantityChange: 1 })).status).toBe(400);
      expect((await post({ variantId: 999999, type: 'import', quantityChange: 1 })).status).toBe(404);
    });

    it('lịch sử biến động: lọc theo biến thể/loại/ngày, mới nhất trước, có người thực hiện', async () => {
      const v = (await variantWithStock(1))!;
      await api('post', '/admin/inventory/movements', admin, {
        variantId: v.id,
        type: 'import',
        quantityChange: 1,
        reason: 'lịch sử',
      });
      const r = await api(
        'get',
        `/admin/inventory/movements?variantId=${v.id}&type=import&pageSize=5`,
        admin,
      );
      expect(r.status).toBe(200);
      expect(r.body.data[0]).toMatchObject({
        variantId: v.id,
        sku: v.sku,
        type: 'import',
        quantityChange: 1,
        reason: 'lịch sử',
        performedByName: expect.any(String),
      });
      const times = r.body.data.map((m: { createdAt: string }) => m.createdAt);
      expect(times).toEqual([...times].sort().reverse());
      expect(r.body.data.every((m: { type: string }) => m.type === 'import')).toBe(true);
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
      expect(
        (await api('get', `/admin/inventory/movements?variantId=${v.id}&from=${today}&to=${today}`, admin))
          .body.data.length,
      ).toBeGreaterThan(0);
      expect(
        (
          await api(
            'get',
            `/admin/inventory/movements?variantId=${v.id}&from=2000-01-01&to=2000-01-02`,
            admin,
          )
        ).body.data,
      ).toHaveLength(0);
    });

    it('phiếu nhập hoàn tất: tăng tồn, movement import mang mã phiếu, cập nhật giá vốn, sinh phiếu chi giá vốn; thiếu nhà cung cấp ⇒ 400', async () => {
      const a = (await variantWithStock(1, 0))!;
      const b = (await variantWithStock(1, 1))!;
      const sa = await stockOf(a.id);
      const sb = await stockOf(b.id);
      const noSup = await api('post', '/admin/inventory/receipts', admin, {
        type: 'in',
        items: [{ variantId: a.id, quantity: 5, costPrice: 1000 }],
      });
      expect(noSup.status).toBe(400);
      expect(noSup.body.error.details).toHaveProperty('supplierName');
      expect(
        (
          await api('post', '/admin/inventory/receipts', admin, {
            type: 'in',
            supplierName: 'NCC',
            items: [],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await api('post', '/admin/inventory/receipts', admin, {
            type: 'in',
            supplierName: 'NCC',
            items: [{ variantId: a.id, quantity: 0, costPrice: 1 }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await api('post', '/admin/inventory/receipts', admin, {
            type: 'in',
            supplierName: 'NCC',
            items: [{ variantId: 999999, quantity: 1, costPrice: 1 }],
          })
        ).status,
      ).toBe(404);

      const r = await api('post', '/admin/inventory/receipts', admin, {
        type: 'in',
        supplierName: 'Công ty Gỗ Việt',
        items: [
          { variantId: a.id, quantity: 10, costPrice: 1_200_000 },
          { variantId: b.id, quantity: 4, costPrice: 800_000 },
        ],
      });
      expect(r.status).toBe(201);
      expect(r.body.data).toMatchObject({
        type: 'in',
        status: 'completed',
        supplierName: 'Công ty Gỗ Việt',
        itemCount: 2,
        total: 10 * 1_200_000 + 4 * 800_000,
      });
      expect(r.body.data.code).toMatch(/^PN\d{4}$/);
      expect(await stockOf(a.id)).toBe(sa + 10);
      expect(await stockOf(b.id)).toBe(sb + 4);
      const mvs = await prisma.inventoryMovement.findMany({
        where: { referenceCode: r.body.data.code },
        orderBy: { variantId: 'asc' },
      });
      expect(mvs.map((m) => [m.variantId, m.type, m.quantityChange])).toEqual(
        [
          [a.id, 'import', 10],
          [b.id, 'import', 4],
        ].sort((x, y) => (x[0] as number) - (y[0] as number)),
      );
      expect(Number((await prisma.productVariant.findUniqueOrThrow({ where: { id: a.id } })).costPrice)).toBe(
        1_200_000,
      );
      const exp = await prisma.expense.findFirstOrThrow({ where: { receiptId: r.body.data.id } });
      expect(exp).toMatchObject({ category: 'cogs' });
      expect(Number(exp.amount)).toBe(10 * 1_200_000 + 4 * 800_000);
      expect(exp.note).toContain(r.body.data.code);

      const list = await api('get', '/admin/inventory/receipts', admin);
      expect(list.body.data[0].code).toBe(r.body.data.code);
      const detail = await api('get', `/admin/inventory/receipts/${r.body.data.id}`, admin);
      expect(detail.body.data.items).toHaveLength(2);
      expect(detail.body.data.items[0]).toMatchObject({
        sku: expect.any(String),
        quantity: expect.any(Number),
      });
      expect((await api('get', '/admin/inventory/receipts/999999', admin)).status).toBe(404);
    });

    it('phiếu nháp: không đổi tồn/không movement/không phiếu chi; xác nhận ⇒ áp dụng một lần; hủy nháp; không hủy phiếu đã hoàn tất', async () => {
      const v = (await variantWithStock(5, 2))!;
      const s0 = await stockOf(v.id);
      const draft = await api('post', '/admin/inventory/receipts', admin, {
        type: 'in',
        supplierName: 'NCC Nháp',
        status: 'draft',
        items: [{ variantId: v.id, quantity: 6, costPrice: 500_000 }],
      });
      expect(draft.status).toBe(201);
      expect(draft.body.data.status).toBe('draft');
      const id = draft.body.data.id;
      const code = draft.body.data.code;
      expect(await stockOf(v.id)).toBe(s0);
      expect(await prisma.inventoryMovement.count({ where: { referenceCode: code } })).toBe(0);
      expect(await prisma.expense.count({ where: { receiptId: id } })).toBe(0);

      const conf = await api('post', `/admin/inventory/receipts/${id}/confirm`, admin);
      expect(conf.status).toBe(200);
      expect(conf.body.data.status).toBe('completed');
      expect(await stockOf(v.id)).toBe(s0 + 6);
      expect(await prisma.inventoryMovement.count({ where: { referenceCode: code } })).toBe(1);
      expect(await prisma.expense.count({ where: { receiptId: id } })).toBe(1);
      // xác nhận lần hai / hủy phiếu đã hoàn tất ⇒ 409, không đổi tồn
      expect((await api('post', `/admin/inventory/receipts/${id}/confirm`, admin)).status).toBe(409);
      expect((await api('post', `/admin/inventory/receipts/${id}/cancel`, admin)).status).toBe(409);
      expect(await stockOf(v.id)).toBe(s0 + 6);

      const d2 = await api('post', '/admin/inventory/receipts', admin, {
        type: 'out',
        status: 'draft',
        items: [{ variantId: v.id, quantity: 2, costPrice: 0 }],
      });
      expect(d2.body.data.code).toMatch(/^PX\d{4}$/);
      const cancel = await api('post', `/admin/inventory/receipts/${d2.body.data.id}/cancel`, admin);
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe('cancelled');
      expect((await api('post', `/admin/inventory/receipts/${d2.body.data.id}/confirm`, admin)).status).toBe(
        409,
      );
      expect(await stockOf(v.id)).toBe(s0 + 6);
      expect((await api('post', '/admin/inventory/receipts/999999/confirm', admin)).status).toBe(404);
    });

    it('phiếu xuất: giảm tồn bằng movement adjustment âm; thiếu hàng ⇒ 409 và hoàn tác cả phiếu; hai phiếu đồng thời không làm tồn âm', async () => {
      const v = (await variantWithStock(5, 3))!;
      const s0 = await stockOf(v.id);
      const out = await api('post', '/admin/inventory/receipts', admin, {
        type: 'out',
        orderCode: 'ALV-X',
        items: [{ variantId: v.id, quantity: 2, costPrice: 0 }],
      });
      expect(out.status).toBe(201);
      expect(await stockOf(v.id)).toBe(s0 - 2);
      const mv = await prisma.inventoryMovement.findFirstOrThrow({
        where: { referenceCode: out.body.data.code },
      });
      expect(mv).toMatchObject({ type: 'adjustment', quantityChange: -2 });
      expect(await prisma.expense.count({ where: { receiptId: out.body.data.id } })).toBe(0); // phiếu xuất không sinh giá vốn

      const receiptsBefore = await prisma.stockReceipt.count();
      const big = await api('post', '/admin/inventory/receipts', admin, {
        type: 'out',
        items: [{ variantId: v.id, quantity: s0 + 500, costPrice: 0 }],
      });
      expect(big.status).toBe(409);
      expect(big.body.error.code).toBe('OUT_OF_STOCK');
      expect(await prisma.stockReceipt.count()).toBe(receiptsBefore);
      expect(await stockOf(v.id)).toBe(s0 - 2);

      // đồng thời: tồn còn n, hai phiếu xuất cùng n ⇒ đúng một phiếu thành công
      const cur = await stockOf(v.id);
      const body = { type: 'out', items: [{ variantId: v.id, quantity: cur, costPrice: 0 }] };
      const [x, y] = await Promise.all([
        api('post', '/admin/inventory/receipts', admin, body),
        api('post', '/admin/inventory/receipts', admin, body),
      ]);
      expect([x.status, y.status].sort()).toEqual([201, 409]);
      expect(await stockOf(v.id)).toBe(0);
      await api('post', '/admin/inventory/movements', admin, {
        variantId: v.id,
        type: 'import',
        quantityChange: 20,
      });
    });
  });

  // ------------------------------------------------------------------------------------------ Thu chi
  describe('thu chi và báo cáo', () => {
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

    it('phiếu chi nhập tay: kiểm tra dữ liệu; hoàn tiền không nhập tay được; xóa chỉ với phiếu nhập tay', async () => {
      const post = (b: object) => api('post', '/admin/expenses', admin, b);
      const base = { category: 'marketing', amount: 250_000, note: 'Quảng cáo Facebook', date: today };
      const bad = await post({ category: 'refund', amount: 0, note: ' ', date: 'hôm qua' });
      expect(bad.status).toBe(400);
      expect(Object.keys(bad.body.error.details).sort()).toEqual(['amount', 'category', 'date', 'note']);
      expect((await post({ ...base, amount: -5 })).status).toBe(400);
      expect((await post({ ...base, category: 'refund' })).status).toBe(400);
      expect((await post({ ...base, date: '2026-13-45' })).status).toBe(400);
      const ok = await post({ ...base, date: new Date(`${today}T00:00:00.000Z`).toISOString() }); // FE gửi ISO
      expect(ok.status).toBe(201);
      expect(ok.body.data).toMatchObject({
        category: 'marketing',
        amount: 250_000,
        note: 'Quảng cáo Facebook',
      });
      expect(ok.body.data.code).toMatch(/^CH-\d{4}$/);
      const row = await prisma.expense.findUniqueOrThrow({ where: { id: ok.body.data.id } });
      expect(row.date.toISOString().slice(0, 10)).toBe(today);
      const list = await api('get', '/admin/expenses?category=marketing&pageSize=5', admin);
      expect(list.body.data.some((e: { id: number }) => e.id === ok.body.data.id)).toBe(true);
      expect((await api('delete', `/admin/expenses/${ok.body.data.id}`, admin)).status).toBe(200);
      expect((await api('delete', `/admin/expenses/${ok.body.data.id}`, admin)).status).toBe(404);
      const auto = await prisma.expense.findFirstOrThrow({ where: { receiptId: { not: null } } }); // từ phiếu nhập ở trên
      expect((await api('delete', `/admin/expenses/${auto.id}`, admin)).status).toBe(409);
    });

    it('doanh thu = đơn giao thành công theo ngày giao; đơn hủy/chưa giao không tính; phiếu chi làm giảm lợi nhuận', async () => {
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

      const e = await api('post', '/admin/expenses', admin, {
        category: 'shipping',
        amount: 90_000,
        note: 'Phí giao hàng đơn ' + o.orderCode,
        date: today,
      });
      expect(e.status).toBe(201);
      const r2 = await report();
      expect(r2.totalExpense).toBe(r1.totalExpense + 90_000);
      expect(r2.profit).toBe(r2.totalIncome - r2.totalExpense);
      expect(r2.income.profitBeforeTax).toBe(r2.profit);
      expect(r2.expenseBreakdown.reduce((s: number, c: { amount: number }) => s + c.amount, 0)).toBe(
        r2.totalExpense,
      );
      const shipping = r2.expenseBreakdown.find((c: { category: string }) => c.category === 'shipping');
      expect(shipping.amount).toBe(
        r1.expenseBreakdown.find((c: { category: string }) => c.category === 'shipping').amount + 90_000,
      );
      expect(
        r2.ledger.some(
          (l: { code: string; amount: number }) => l.code === e.body.data.code && l.amount === -90_000,
        ),
      ).toBe(true);
      expect(r2.topProducts.length).toBeGreaterThan(0);
      expect(r2.deltas).toMatchObject({
        income: expect.any(Number),
        expense: expect.any(Number),
        profit: expect.any(Number),
        margin: expect.any(Number),
      });
      await api('delete', `/admin/expenses/${e.body.data.id}`, admin);
    });

    it('hoàn tiền tự sinh phiếu chi refund nên trừ vào lợi nhuận; đơn đã hoàn vẫn là doanh thu ngày giao, không nằm trong cơ cấu danh mục', async () => {
      const r0 = await report();
      const o = await deliveredOrder();
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
      const png =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const ret = await api('post', '/returns', cust, {
        orderId: o.id,
        type: 'refund',
        reason: 'defect',
        description: 'Sản phẩm bị lỗi khi nhận hàng',
        images: [png],
        items: [{ orderItemId: item.id, quantity: item.quantity }],
      });
      expect(ret.status).toBe(201);
      for (const st of ['picking', 'inspecting', 'refunded']) {
        expect(
          (await api('patch', `/admin/returns/${ret.body.data.id}`, admin, { status: st, adminNote: 'ok' }))
            .status,
        ).toBe(200);
      }
      const r1 = await report();
      expect(r1.totalIncome).toBe(r0.totalIncome + Number(o.total)); // vẫn là doanh thu ngày giao
      const refund = r1.expenseBreakdown.find((c: { category: string }) => c.category === 'refund').amount;
      expect(refund).toBeGreaterThan(
        r0.expenseBreakdown.find((c: { category: string }) => c.category === 'refund').amount,
      );
      expect(r1.profit).toBe(r1.totalIncome - r1.totalExpense);
      expect(r1.income.discountAndRefund).toBeGreaterThanOrEqual(refund);
    });

    it('giá vốn chỉ trừ MỘT lần: phiếu nhập 10 × 1.200.000 = 12.000.000 làm giá vốn +12.000.000; đơn giao thành công không trừ thêm giá vốn', async () => {
      const r0 = await report();
      const v = (await variantWithStock(1))!;
      const rec = await api('post', '/admin/inventory/receipts', admin, {
        type: 'in',
        supplierName: 'NCC giá vốn',
        items: [{ variantId: v.id, quantity: 10, costPrice: 1_200_000 }],
      });
      expect(rec.status).toBe(201);
      const r1 = await report();
      expect(r1.income.cogs - r0.income.cogs).toBe(12_000_000);
      expect(r1.totalExpense - r0.totalExpense).toBe(12_000_000);
      expect(r1.income.opex).toBe(r0.income.opex); // giá vốn không lẫn vào chi phí vận hành
      expect(r1.income.profitBeforeTax - r0.income.profitBeforeTax).toBe(-12_000_000); // trừ đúng một lần, không phải -24.000.000
      expect(r1.profit - r0.profit).toBe(-12_000_000);

      // giao một đơn: lợi nhuận chỉ tăng đúng bằng doanh thu đơn (giá vốn đã tính ở phiếu nhập, không tính lại theo giá vốn dòng hàng)
      const o = await deliveredOrder();
      const r2 = await report();
      expect(r2.income.cogs).toBe(r1.income.cogs);
      expect(r2.profit - r1.profit).toBe(Number(o.total));
      expect(r2.income.profitBeforeTax - r1.income.profitBeforeTax).toBe(Number(o.total));
    });

    it('phí vận chuyển và phí cổng thanh toán KHÔNG tự sinh phiếu chi', async () => {
      const before = await prisma.expense.count({ where: { category: { in: ['shipping', 'payment_fee'] } } });
      await deliveredOrder();
      expect(await prisma.expense.count({ where: { category: { in: ['shipping', 'payment_fee'] } } })).toBe(
        before,
      );
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
    const callback = (
      o: { orderCode: string; total: number },
      paymentId: number,
      extra: Record<string, string> = {},
      secret = FAKE.secret,
    ) => {
      const p: Record<string, string> = {
        vnp_TmnCode: FAKE.tmn,
        vnp_Amount: String(Math.round(Number(o.total)) * 100),
        vnp_BankCode: 'NCB',
        vnp_TxnRef: `${o.orderCode}-P${paymentId}`,
        vnp_OrderInfo: `Thanh toan don hang ${o.orderCode}`,
        vnp_TransactionNo: String(14_000_000 + paymentId),
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_PayDate: '20261107100000',
        ...extra,
      };
      return { ...p, vnp_SecureHash: sign(p, secret) };
    };
    const qs = (p: Record<string, string>) => new URLSearchParams(p).toString();
    const ipn = (p: Record<string, string>) => http.get(`/api/payments/vnpay/ipn?${qs(p)}`);
    const ret = (p: Record<string, string>) => http.get(`/api/payments/vnpay/return?${qs(p)}`).redirects(0);
    const latestPayment = (orderId: number) =>
      prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { id: 'desc' } });

    it('checkout: URL cổng có chữ ký hợp lệ, số tiền = Order.total × 100 (không nhận từ client), tham chiếu gắn id giao dịch pending', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      expect(pay.status).toBe('pending');
      const r = await api('post', `/payments/${o.id}/checkout`, cust, { amount: 1, outcome: 'success' }); // body bị bỏ qua
      expect(r.status).toBe(200);
      const url = new URL(r.body.data.redirectUrl);
      expect(r.body.data.paymentUrl).toBe(r.body.data.redirectUrl);
      expect(url.origin + url.pathname).toBe(FAKE.url);
      const q = Object.fromEntries(url.searchParams.entries());
      expect(q).toMatchObject({
        vnp_TmnCode: FAKE.tmn,
        vnp_Amount: String(Math.round(Number(o.total)) * 100),
        vnp_TxnRef: `${o.orderCode}-P${pay.id}`,
        vnp_ReturnUrl: RETURN_URL,
        vnp_CurrCode: 'VND',
      });
      expect(verify(q, FAKE.secret)).toBe(true);
      expect(new Date(r.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
      // chưa thanh toán xong: đơn vẫn pending/unpaid
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect([row.status, row.paymentStatus]).toEqual(['pending', 'unpaid']);
    });

    it('điều kiện: đơn người khác ⇒ 404, đơn đã thanh toán ⇒ 409, đơn đã hủy ⇒ 409; COD không qua cổng', async () => {
      const o = await placeOrder();
      const other = await login((await prisma.user.findUniqueOrThrow({ where: { id: 3 } })).email, '123456');
      expect((await api('post', `/payments/${o.id}/checkout`, other)).status).toBe(404);
      const cancelled = await placeOrder();
      expect((await api('post', `/orders/${cancelled.id}/cancel`, cust, { reason: 'Đổi ý' })).status).toBe(
        200,
      );
      expect((await api('post', `/payments/${cancelled.id}/checkout`, cust)).status).toBe(409);
      expect((await api('post', `/payments/${cancelled.id}/retry`, cust)).status).toBe(409);
      const cod = await placeOrder('cod');
      const r = await api('post', `/payments/${cod.id}/checkout`, cust);
      expect(r.body.data.redirectUrl).toBe(`/checkout/success?order=${cod.orderCode}`);
    });

    it('Return URL thành công: kiểm tra chữ ký, ghi nhận paid + confirmed + mã giao dịch cổng, chuyển tới trang thành công', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      const res = await ret(callback(o, pay.id));
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`http://localhost:3000/checkout/success?order=${o.orderCode}`);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect([row.status, row.paymentStatus]).toEqual(['confirmed', 'paid']);
      const p = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
      expect(p).toMatchObject({ status: 'success', transactionCode: String(14_000_000 + pay.id) });
      expect(p.paidAt).not.toBeNull();
      // mở lại Return URL: idempotent, không tạo thêm thông báo/lịch sử
      const hist = await prisma.orderStatusHistory.count({ where: { orderId: o.id } });
      expect((await ret(callback(o, pay.id))).headers.location).toContain('/checkout/success');
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(hist);
    });

    it('Return URL không hợp lệ: sai chữ ký, sửa số tiền, thiếu chữ ký, mã đơn lạ ⇒ về trang thất bại và KHÔNG ghi nhận thanh toán', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      const good = callback(o, pay.id);
      const attempts: Array<Record<string, string>> = [
        callback(o, pay.id, {}, 'khoa-sai'),
        { ...good, vnp_Amount: '100' }, // sửa tiền sau khi ký
        Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'vnp_SecureHash')),
        callback({ orderCode: 'ALV-00000000-0000', total: 1000 }, 1),
      ];
      for (const a of attempts) {
        const res = await ret(a);
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/checkout/failed');
      }
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect([row.status, row.paymentStatus]).toEqual(['pending', 'unpaid']);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('pending');
    });

    it('Return URL thất bại (khách hủy mã 24): payment failed, đơn failed nhưng vẫn pending; trang thất bại có mã đơn', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      const res = await ret(callback(o, pay.id, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
      expect(res.headers.location).toBe(`http://localhost:3000/checkout/failed?order=${o.orderCode}`);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect([row.status, row.paymentStatus]).toEqual(['pending', 'failed']);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('failed');
    });

    it('IPN: 00 thành công; gọi lại ⇒ 02 (idempotent); 97 sai chữ ký; 01 không có đơn; 04 sai số tiền (đơn không đổi)', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      const bad = await ipn(callback(o, pay.id, {}, 'khoa-sai'));
      expect(bad.status).toBe(200);
      expect(bad.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
      expect((await ipn(callback({ orderCode: 'ALV-00000000-0000', total: 1000 }, 1))).body.RspCode).toBe(
        '01',
      );
      expect((await ipn({})).body.RspCode).toBe('97');
      const wrongAmount = await ipn(
        callback(o, pay.id, { vnp_Amount: String((Math.round(Number(o.total)) - 1) * 100) }),
      );
      expect(wrongAmount.body.RspCode).toBe('04');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe('unpaid');

      const ok = await ipn(callback(o, pay.id));
      expect(ok.body).toEqual({ RspCode: '00', Message: 'Confirm Success' }); // không bọc { success, data }
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe('paid');
      const again = await ipn(callback(o, pay.id));
      expect(again.body.RspCode).toBe('02');
      expect(
        await prisma.notification.count({
          where: { userId: 2, title: { contains: `Thanh toán đơn ${o.orderCode} thành công` } },
        }),
      ).toBe(1);
    });

    it('hai IPN cùng lúc cho một giao dịch: đúng một lần ghi nhận (00), lần kia 02; không trùng lịch sử/thông báo', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      const cb = callback(o, pay.id);
      const [a, b] = await Promise.all([ipn(cb), ipn(cb)]);
      expect([a.body.RspCode, b.body.RspCode].sort()).toEqual(['00', '02']);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id, toStatus: 'confirmed' } })).toBe(
        1,
      );
      expect(
        await prisma.notification.count({
          where: { userId: 2, title: { contains: `Thanh toán đơn ${o.orderCode} thành công` } },
        }),
      ).toBe(1);
    });

    it('thanh toán lại: giao dịch cũ failed → tạo giao dịch mới pending; URL mới mang id mới; IPN giao dịch cũ ⇒ 02, giao dịch mới ⇒ 00', async () => {
      const o = await placeOrder();
      const old = await latestPayment(o.id);
      await ipn(callback(o, old.id, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }));
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe('failed');

      const r = await api('post', `/payments/${o.id}/retry`, cust, {});
      expect(r.status).toBe(200);
      const fresh = await latestPayment(o.id);
      expect(fresh.id).not.toBe(old.id);
      expect(fresh.status).toBe('pending');
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('failed');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe('unpaid');
      const q = Object.fromEntries(new URL(r.body.data.redirectUrl).searchParams.entries());
      expect(q.vnp_TxnRef).toBe(`${o.orderCode}-P${fresh.id}`);
      expect(verify(q, FAKE.secret)).toBe(true);

      expect((await ipn(callback(o, old.id))).body.RspCode).toBe('02'); // giao dịch cũ đã đóng
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus).toBe('unpaid');
      expect((await ipn(callback(o, fresh.id))).body.RspCode).toBe('00');
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect([row.status, row.paymentStatus]).toEqual(['confirmed', 'paid']);
      // đã thanh toán ⇒ không thanh toán lại được
      expect((await api('post', `/payments/${o.id}/retry`, cust)).status).toBe(409);
    });

    it('thanh toán đến sau khi đơn đã hủy: đơn vẫn cancelled, Payment = success, paymentStatus = paid, admin nhận thông báo cần hoàn tiền; IPN lặp ⇒ 02', async () => {
      const o = await placeOrder();
      const pay = await latestPayment(o.id);
      expect((await api('post', `/orders/${o.id}/cancel`, cust, { reason: 'Đổi ý' })).status).toBe(200);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('failed'); // đóng lúc hủy
      const histBefore = await prisma.orderStatusHistory.count({ where: { orderId: o.id } });

      const r = await ipn(callback(o, pay.id));
      expect(r.body.RspCode).toBe('00');
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect([row.status, row.paymentStatus]).toEqual(['cancelled', 'paid']);
      const p = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
      expect(p.status).toBe('success');
      expect(p.transactionCode).toBe(String(14_000_000 + pay.id));
      expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(histBefore); // không đổi trạng thái đơn
      const adminNote = await prisma.notification.findFirst({
        where: { userId: 1, title: `Đơn ${o.orderCode} đã hủy nhưng khách đã thanh toán, cần hoàn tiền` },
      });
      expect(adminNote).not.toBeNull();
      expect((adminNote!.data as { link: string }).link).toBe(`/admin/orders/${o.orderCode}`);
      // khách không bị báo "đơn được xác nhận"
      expect((await ipn(callback(o, pay.id))).body.RspCode).toBe('02');
      expect(
        await prisma.notification.count({
          where: { userId: 1, title: { contains: `Đơn ${o.orderCode} đã hủy nhưng` } },
        }),
      ).toBe(1);
    });

    it('thanh toán lại đổi phương thức sang COD: không qua cổng, cập nhật phương thức; phương thức lạ ⇒ 400', async () => {
      const o = await placeOrder();
      expect((await api('post', `/payments/${o.id}/retry`, cust, { method: 'bitcoin' })).status).toBe(400);
      const r = await api('post', `/payments/${o.id}/retry`, cust, { method: 'cod' });
      expect(r.status).toBe(200);
      expect(r.body.data.redirectUrl).toBe(`/checkout/success?order=${o.orderCode}`);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(row.paymentMethod).toBe('cod');
      expect((await latestPayment(o.id)).method).toBe('cod');
    });
  });
});
