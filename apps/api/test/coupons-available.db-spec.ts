// UC-CART-04 + UC-ADM-19 – Mã giảm giá công khai: GET /coupons/available và trường isPublic ở API quản trị.
// Chạy trên aurelia_test. Test tự tạo mã (tiền tố riêng) nên không phụ thuộc mã mẫu của seed.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

interface Available {
  id: number;
  code: string;
  eligible: boolean;
  reason: string | null;
  estimatedDiscount: number;
  isApplied: boolean;
  remainingForUser: number | null;
}

describe('Mã giảm giá công khai (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let seq = 0;
  const tag = String(Date.now()).slice(-6);
  const PASSWORD = 'Matkhau-12345';
  const money = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  type Method = 'get' | 'post' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = http[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };

  const customer = async (label: string) => {
    const email = `${label}-${tag}-${++seq}@test.local`;
    const reg = await api('post', '/auth/register', undefined, {
      fullName: `Khách ${label}`,
      email,
      phone: '0911222333',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(reg.status).toBe(201);
    const login = await api('post', '/auth/login', undefined, { email, password: PASSWORD });
    const u = await prisma.user.findFirstOrThrow({ where: { email } });
    return { id: u.id, token: login.body.data.tokens.accessToken as string };
  };

  const couponBody = (code: string, over: Record<string, unknown> = {}) => ({
    name: `Mã ${code}`,
    code,
    kind: 'percent',
    value: 10,
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2099-12-31T00:00:00Z',
    isPublic: true,
    ...over,
  });
  const coupon = async (suffix: string, over: Record<string, unknown> = {}) => {
    const r = await api('post', '/admin/coupons', admin, couponBody(`AV${suffix}${tag}`, over));
    expect([suffix, r.status]).toEqual([suffix, 201]);
    return r.body.data as { id: number; code: string; isPublic: boolean };
  };

  const available = async (token: string) => {
    const r = await api('get', '/coupons/available', token);
    expect(r.status).toBe(200);
    return r.body.data as Available[];
  };
  const find = (list: Available[], c: { code: string }) => list.find((x) => x.code === c.code);

  const fillCart = async (token: string) => {
    const v = await prisma.productVariant.findFirstOrThrow({
      where: {
        isActive: true,
        stockQuantity: { gte: 5 },
        product: { status: 'published', deletedAt: null },
      },
      orderBy: { id: 'asc' },
    });
    const r = await api('post', '/cart/items', token, { variantId: v.id, quantity: 1 });
    expect(r.status).toBeLessThan(300);
    return (await api('get', '/cart', token)).body.data as { subtotal: number; shippingFee: number };
  };
  const useCoupon = async (couponId: number, userId: number) => {
    const order = await prisma.order.findFirstOrThrow({
      where: { couponUsages: { none: { couponId } } },
      orderBy: { id: 'asc' },
    });
    await prisma.couponUsage.create({ data: { couponId, userId, orderId: order.id } });
  };

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await api('post', '/auth/login', undefined, {
      email: 'admin@aurelia.vn',
      password: 'admin123',
      adminOnly: true,
    });
    admin = r.body.data.tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  describe('GET /coupons/available', () => {
    it('chưa đăng nhập ⇒ 401', async () => {
      expect((await api('get', '/coupons/available')).status).toBe(401);
      expect((await api('get', '/coupons/available', 'khong-phai-token')).status).toBe(401);
    });

    it('chỉ trả mã công khai còn dùng được: ẩn mã riêng tư, tắt, chưa tới ngày, hết hạn, hết lượt tổng, hết lượt của chính khách', async () => {
      const me = await customer('av-me');
      const other = await customer('av-other');
      const ok = await coupon('OK');
      const hidden = {
        private: await coupon('PRI', { isPublic: false }),
        inactive: await coupon('OFF', { isActive: false }),
        future: await coupon('FUT', { startsAt: '2090-01-01T00:00:00Z' }),
        expired: await coupon('EXP', {
          startsAt: '2020-01-01T00:00:00Z',
          endsAt: '2020-12-31T00:00:00Z',
        }),
        full: await coupon('FUL', { usageLimit: 1 }),
      };
      await prisma.coupon.update({ where: { id: hidden.full.id }, data: { usedCount: 1 } });
      const mine = await coupon('PER', { perUserLimit: 1 });
      await useCoupon(mine.id, me.id);
      // không hạn kết thúc vẫn được liệt kê
      const forever = await coupon('NOEND');
      await prisma.coupon.update({ where: { id: forever.id }, data: { endsAt: null } });

      const list = await available(me.token);
      expect(find(list, ok)).toBeDefined();
      expect(find(list, forever)).toBeDefined();
      for (const [why, c] of Object.entries(hidden)) expect([why, find(list, c)]).toEqual([why, undefined]);
      expect(find(list, mine)).toBeUndefined();
      // lượt của người khác không bị ảnh hưởng
      expect(find(await available(other.token), mine)).toMatchObject({ remainingForUser: 1 });
      // mọi mã trả về đều công khai trong CSDL
      const rows = await prisma.coupon.findMany({ where: { id: { in: list.map((x) => x.id) } } });
      expect(rows.every((c) => c.isPublic)).toBe(true);
    });

    it('chỉ trả đúng các trường cần cho khách; remainingForUser giảm theo lượt đã dùng, null khi không giới hạn', async () => {
      const me = await customer('av-fields');
      const limited = await coupon('LIM', { perUserLimit: 3, usageLimit: 50, description: 'Mô tả' });
      const free = await coupon('UNL');
      await useCoupon(limited.id, me.id);
      const list = await available(me.token);
      expect(Object.keys(find(list, limited)!).sort()).toEqual(
        [
          'code',
          'description',
          'eligible',
          'endsAt',
          'estimatedDiscount',
          'id',
          'isApplied',
          'maxDiscount',
          'minOrderValue',
          'name',
          'reason',
          'remainingForUser',
          'type',
          'value',
        ].sort(),
      );
      expect(find(list, limited)).toMatchObject({ remainingForUser: 2, description: 'Mô tả' });
      expect(find(list, free)!.remainingForUser).toBeNull();
    });

    it('giỏ trống ⇒ mọi mã eligible=false, lý do "Giỏ hàng đang trống", giảm dự kiến 0', async () => {
      const me = await customer('av-empty');
      await coupon('EMP');
      const list = await available(me.token);
      expect(list.length).toBeGreaterThan(0);
      for (const c of list)
        expect(c).toMatchObject({
          eligible: false,
          reason: 'Giỏ hàng đang trống',
          estimatedDiscount: 0,
          isApplied: false,
        });
    });

    it('theo giỏ: eligible / reason / estimatedDiscount đúng cho %, tiền cố định, freeship và đơn tối thiểu; sắp xếp đúng', async () => {
      const me = await customer('av-cart');
      const cart = await fillCart(me.token);
      const pct = await coupon('PCT', { value: 10, maxDiscount: 20_000 });
      const fix = await coupon('FIX', { kind: 'fixed', value: 50_000 });
      const ship = await coupon('SHP', { kind: 'freeship', value: 0 });
      const exact = await coupon('EQL', { kind: 'fixed', value: 1_000, minOrderValue: cart.subtotal });
      const far = await coupon('FAR', {
        kind: 'fixed',
        value: 900_000,
        minOrderValue: cart.subtotal + 500_000,
      });

      const list = await available(me.token);
      expect(find(list, pct)).toMatchObject({ eligible: true, reason: null, estimatedDiscount: 20_000 });
      expect(find(list, fix)).toMatchObject({ eligible: true, estimatedDiscount: 50_000 });
      expect(find(list, ship)).toMatchObject({ eligible: true, estimatedDiscount: cart.shippingFee });
      expect(find(list, exact)).toMatchObject({ eligible: true, estimatedDiscount: 1_000 });
      expect(find(list, far)).toMatchObject({
        eligible: false,
        reason: `Mua thêm ${money(500_000)}đ để dùng mã`,
        estimatedDiscount: 0,
      });

      // dùng được đứng trước, trong đó giảm nhiều đứng trước; chưa đủ điều kiện đứng sau
      const firstBlocked = list.findIndex((c) => !c.eligible);
      expect(list.slice(firstBlocked).every((c) => !c.eligible)).toBe(true);
      const amounts = list.slice(0, firstBlocked).map((c) => c.estimatedDiscount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    });

    it('cùng mức giảm: mã hết hạn sớm hơn đứng trước', async () => {
      const me = await customer('av-sort');
      const late = await coupon('SLATE', { minOrderValue: 900_000_000, endsAt: '2098-01-01T00:00:00Z' });
      const soon = await coupon('SSOON', { minOrderValue: 900_000_000, endsAt: '2097-01-01T00:00:00Z' });
      const codes = (await available(me.token)).map((c) => c.code);
      expect(codes.indexOf(soon.code)).toBeLessThan(codes.indexOf(late.code));
    });

    it('isApplied đúng mã đang áp; áp mã công khai cho số giảm khớp estimatedDiscount; mã riêng tư tự nhập vẫn áp được và không lộ trong danh sách', async () => {
      const me = await customer('av-apply');
      await fillCart(me.token);
      const a = await coupon('AAP', { kind: 'fixed', value: 30_000 });
      const b = await coupon('BAP', { kind: 'fixed', value: 10_000 });
      const secret = await coupon('SEC', { kind: 'fixed', value: 40_000, isPublic: false });
      const estimate = find(await available(me.token), a)!.estimatedDiscount;

      const applied = await api('post', '/cart/coupon', me.token, { code: a.code });
      expect(applied.status).toBe(200);
      expect(applied.body.data.discountAmount).toBe(estimate);
      let list = await available(me.token);
      expect(list.filter((c) => c.isApplied).map((c) => c.code)).toEqual([a.code]);
      expect(find(list, b)!.isApplied).toBe(false);

      const typed = await api('post', '/cart/coupon', me.token, { code: secret.code });
      expect(typed.status).toBe(200);
      expect(typed.body.data.coupon.code).toBe(secret.code);
      list = await available(me.token);
      expect(find(list, secret)).toBeUndefined();
      expect(list.some((c) => c.isApplied)).toBe(false);

      expect((await api('delete', '/cart/coupon', me.token)).status).toBe(200);
      expect((await available(me.token)).some((c) => c.isApplied)).toBe(false);
    });

    it('đặt hàng với mã chọn từ danh sách: đơn giảm đúng số dự kiến; hết lượt của khách thì mã biến khỏi danh sách', async () => {
      const me = await customer('av-order');
      await fillCart(me.token);
      const c = await coupon('ORD', { kind: 'fixed', value: 25_000, perUserLimit: 1 });
      const estimate = find(await available(me.token), c)!.estimatedDiscount;
      expect((await api('post', '/cart/coupon', me.token, { code: c.code })).status).toBe(200);
      const address = await api('post', '/addresses', me.token, {
        recipientName: 'Nguyễn Văn A',
        phone: '0912345678',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        addressLine: '12 Lê Lợi',
      });
      expect(address.status).toBe(201);
      const order = await api('post', '/orders', me.token, {
        addressId: address.body.data.id,
        paymentMethod: 'cod',
      });
      expect(order.status).toBe(201);
      expect(order.body.data).toMatchObject({ discountAmount: estimate, couponCode: c.code });
      expect(await prisma.couponUsage.count({ where: { couponId: c.id, userId: me.id } })).toBe(1);
      expect(find(await available(me.token), c)).toBeUndefined();
    });
  });

  describe('quản trị: isPublic', () => {
    const isPublicOf = async (id: number) =>
      (await prisma.coupon.findUniqueOrThrow({ where: { id } })).isPublic;

    it('tạo không gửi isPublic ⇒ riêng tư; gửi true ⇒ công khai; xem và danh sách trả trường này', async () => {
      const body: Record<string, unknown> = couponBody(`AVDEF${tag}`);
      delete body.isPublic;
      const def = await api('post', '/admin/coupons', admin, body);
      expect(def.status).toBe(201);
      expect(def.body.data.isPublic).toBe(false);
      const pub = await coupon('YES');
      expect(pub.isPublic).toBe(true);
      expect((await api('get', `/admin/coupons/${pub.id}`, admin)).body.data.isPublic).toBe(true);
      const list = await api('get', `/admin/coupons?q=${pub.code}`, admin);
      expect(list.body.data[0]).toMatchObject({ code: pub.code, isPublic: true });
    });

    it('sửa: đổi được hai chiều; sửa trường khác không gửi isPublic ⇒ giữ nguyên', async () => {
      const c = await coupon('EDIT');
      const keep = await api('patch', `/admin/coupons/${c.id}`, admin, { description: 'Đổi mô tả' });
      expect(keep.status).toBe(200);
      expect(await isPublicOf(c.id)).toBe(true);
      expect((await api('patch', `/admin/coupons/${c.id}`, admin, { isPublic: false })).status).toBe(200);
      expect(await isPublicOf(c.id)).toBe(false);
      await api('patch', `/admin/coupons/${c.id}`, admin, { isActive: false });
      expect(await isPublicOf(c.id)).toBe(false);
      expect((await api('patch', `/admin/coupons/${c.id}`, admin, { isPublic: true })).status).toBe(200);
      expect(await isPublicOf(c.id)).toBe(true);
    });

    it.each([['true'], ['false'], [1], [0], [null], [{}]])(
      'isPublic sai kiểu (%j) ⇒ 400 theo trường, khi tạo và khi sửa; không ghi gì',
      async (bad) => {
        const code = `AVBAD${tag}`;
        const created = await api('post', '/admin/coupons', admin, couponBody(code, { isPublic: bad }));
        expect(created.status).toBe(400);
        expect(Object.keys(created.body.error.details)).toContain('isPublic');
        expect(await prisma.coupon.count({ where: { code } })).toBe(0);
        const c = await prisma.coupon.findFirstOrThrow({ where: { code: `AVOK${tag}` } });
        const edited = await api('patch', `/admin/coupons/${c.id}`, admin, { isPublic: bad });
        expect(edited.status).toBe(400);
        expect(await isPublicOf(c.id)).toBe(true);
      },
    );

    it('khách không gọi được API quản trị mã (403)', async () => {
      const me = await customer('av-403');
      expect((await api('post', '/admin/coupons', me.token, couponBody(`AVNO${tag}`))).status).toBe(403);
    });
  });
});
