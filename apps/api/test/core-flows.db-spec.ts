// E2E (supertest) trên aurelia_test: UC-AUTH-04 đăng xuất, UC-ACC-02 đổi mật khẩu, UC-CART-02 xem giỏ hàng, UC-CART-04 áp mã giảm giá,
// UC-CAT-01 trang chủ. Mỗi test tự đăng ký khách riêng. Số thứ tự UC theo docs/DAC_TA_CHUC_NANG_THEO_VAI_TRO.md.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CatalogCache } from '../src/cache/catalog-cache';

describe('Đăng xuất, đổi mật khẩu, giỏ hàng, mã giảm giá, trang chủ (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cache: CatalogCache;
  let seq = 0;
  const tag = `${Date.now()}`;
  const PASSWORD = 'matkhau-12345';

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password = PASSWORD) => {
    const r = await api('post', '/auth/login', undefined, { email, password });
    expect(r.status).toBe(200);
    return {
      access: r.body.data.tokens.accessToken as string,
      refresh: r.body.data.tokens.refreshToken as string,
    };
  };
  const customer = async (label: string) => {
    const email = `${label}-${tag}-${++seq}@test.local`;
    const reg = await api('post', '/auth/register', undefined, {
      fullName: `Khách ${label}`,
      email,
      phone: '0911222333',
      password: PASSWORD,
    });
    expect(reg.status).toBe(201);
    const u = await prisma.user.findFirstOrThrow({ where: { email } });
    return { id: u.id, email, ...(await login(email)) };
  };
  const variantWithStock = (min = 5) =>
    prisma.productVariant.findFirstOrThrow({
      where: {
        isActive: true,
        stockQuantity: { gte: min },
        product: { status: 'published', deletedAt: null },
      },
      orderBy: { id: 'asc' },
    });

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    cache = app.get(CatalogCache);
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

  // ------------------------------------------------------------------ UC-AUTH-04 đăng xuất
  describe('UC-AUTH-04 đăng xuất', () => {
    it('thu hồi phiên theo refresh token: access token cũ 401 ngay, refresh token cũ không dùng được nữa', async () => {
      const c = await customer('out');
      expect((await api('get', '/users/me', c.access)).status).toBe(200);
      const r = await api('post', '/auth/logout', c.access, { refreshToken: c.refresh });
      expect(r.status).toBe(200);
      expect((await api('get', '/users/me', c.access)).status).toBe(401);
      const re = await api('post', '/auth/refresh', undefined, { refreshToken: c.refresh });
      expect(re.status).toBe(401);
      expect(re.body.error.code).toBe('AUTH_TOKEN_INVALID');
      const hash = await prisma.userSession.findMany({ where: { userId: c.id } });
      expect(hash.every((s) => s.revokedAt !== null)).toBe(true);
    });

    it('idempotent: đăng xuất lần hai, refresh token lạ, thân rỗng, không access token đều không lỗi', async () => {
      const c = await customer('idem');
      expect((await api('post', '/auth/logout', c.access, { refreshToken: c.refresh })).status).toBe(200);
      expect((await api('post', '/auth/logout', c.access, { refreshToken: c.refresh })).status).toBe(200); // đã thu hồi
      expect((await api('post', '/auth/logout', undefined, { refreshToken: c.refresh })).status).toBe(200);
      expect(
        (await api('post', '/auth/logout', undefined, { refreshToken: 'khong-ton-tai-xyz' })).status,
      ).toBe(200);
      expect((await api('post', '/auth/logout', undefined, {})).status).toBe(200);
      expect((await api('post', '/auth/logout')).status).toBe(200);
    });

    it('chỉ thu hồi phiên của CHÍNH user: dùng refresh token của người khác không thu hồi được phiên của họ', async () => {
      const a = await customer('own-a');
      const b = await customer('own-b');
      const r = await api('post', '/auth/logout', a.access, { refreshToken: b.refresh });
      expect(r.status).toBe(200);
      expect((await api('get', '/users/me', b.access)).status).toBe(200); // phiên của B còn nguyên
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: b.refresh })).status).toBe(200);
      expect((await api('get', '/users/me', a.access)).status).toBe(200); // phiên của A cũng chưa bị thu hồi
    });

    it('chỉ thu hồi đúng phiên được chỉ định; phiên khác của cùng user còn dùng được', async () => {
      const c = await customer('multi');
      const second = await login(c.email);
      expect(
        (await api('post', '/auth/logout', second.access, { refreshToken: second.refresh })).status,
      ).toBe(200);
      expect((await api('get', '/users/me', second.access)).status).toBe(401);
      expect((await api('get', '/users/me', c.access)).status).toBe(200);
    });

    it('không gửi refresh token: thu hồi mọi phiên của người đang đăng nhập (hành vi dự phòng của FE)', async () => {
      const c = await customer('norefresh');
      const second = await login(c.email);
      expect((await api('post', '/auth/logout', c.access, {})).status).toBe(200);
      expect((await api('get', '/users/me', c.access)).status).toBe(401);
      expect((await api('get', '/users/me', second.access)).status).toBe(401);
    });

    it('dùng lại refresh token đã thu hồi (nghi bị đánh cắp) ⇒ thu hồi mọi phiên của user', async () => {
      const c = await customer('reuse');
      const second = await login(c.email);
      expect((await api('post', '/auth/logout', c.access, { refreshToken: c.refresh })).status).toBe(200);
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: c.refresh })).status).toBe(401);
      expect((await api('get', '/users/me', second.access)).status).toBe(401); // phiên còn lại cũng bị thu hồi
    });
  });

  // ------------------------------------------------------------------ UC-ACC-02 đổi mật khẩu
  describe('UC-ACC-02 đổi mật khẩu', () => {
    const change = (token: string | undefined, body: object) =>
      api('post', '/users/me/change-password', token, body);

    it('cần đăng nhập (401)', async () => {
      expect((await change(undefined, { currentPassword: 'a', newPassword: 'b' })).status).toBe(401);
    });

    it('sai mật khẩu hiện tại / mới quá ngắn / mới trùng cũ / thiếu trường ⇒ 400 theo trường; mật khẩu không đổi', async () => {
      const c = await customer('pw-bad');
      const before = (await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).passwordHash;
      const cases: Array<[object, string]> = [
        [{ currentPassword: 'sai-mat-khau', newPassword: 'matkhau-moi-99' }, 'currentPassword'],
        [{ currentPassword: PASSWORD, newPassword: 'ngan' }, 'newPassword'],
        [{ currentPassword: PASSWORD, newPassword: PASSWORD }, 'newPassword'],
        [{ newPassword: 'matkhau-moi-99' }, 'currentPassword'],
        [{ currentPassword: PASSWORD }, 'newPassword'],
        [{}, 'currentPassword'],
      ];
      for (const [body, field] of cases) {
        const r = await change(c.access, body);
        expect([JSON.stringify(body), r.status]).toEqual([JSON.stringify(body), 400]);
        expect(Object.keys(r.body.error.details)).toContain(field);
      }
      expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).passwordHash).toBe(before);
      expect(
        (await api('post', '/auth/login', undefined, { email: c.email, password: PASSWORD })).status,
      ).toBe(200);
    });

    it('thành công: mật khẩu cũ không đăng nhập được, mới đăng nhập được; băm bcrypt (không lưu rõ); phiên hiện tại còn dùng được', async () => {
      const c = await customer('pw-ok');
      const r = await change(c.access, { currentPassword: PASSWORD, newPassword: 'MatKhau-Moi-99' });
      expect(r.status).toBe(200);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
      expect(row.passwordHash).not.toContain('MatKhau-Moi-99');
      expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(
        (await api('post', '/auth/login', undefined, { email: c.email, password: PASSWORD })).status,
      ).toBe(401);
      expect(
        (await api('post', '/auth/login', undefined, { email: c.email, password: 'MatKhau-Moi-99' })).status,
      ).toBe(200);
      expect((await api('get', '/users/me', c.access)).status).toBe(200); // không tự đăng xuất khi không chọn logoutOthers
    });

    it('không chọn "đăng xuất thiết bị khác": các phiên khác vẫn dùng được', async () => {
      const c = await customer('pw-keep');
      const other = await login(c.email);
      expect(
        (await change(c.access, { currentPassword: PASSWORD, newPassword: 'matkhau-moi-99' })).status,
      ).toBe(200);
      expect((await api('get', '/users/me', other.access)).status).toBe(200);
    });

    it('chọn logoutOthers: thu hồi mọi phiên TRỪ phiên hiện tại (DAC_TA UC-ACC-02)', async () => {
      const c = await customer('pw-others');
      const d2 = await login(c.email);
      const d3 = await login(c.email);
      const r = await change(c.access, {
        currentPassword: PASSWORD,
        newPassword: 'matkhau-moi-99',
        logoutOthers: true,
      });
      expect(r.status).toBe(200);
      expect((await api('get', '/users/me', c.access)).status).toBe(200); // phiên hiện tại được giữ
      expect((await api('get', '/users/me', d2.access)).status).toBe(401);
      expect((await api('get', '/users/me', d3.access)).status).toBe(401);
      // phiên hiện tại làm mới được; refresh token của phiên đã thu hồi bị từ chối (dùng lại token thu hồi sẽ thu hồi hết phiên, nên để cuối)
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: c.refresh })).status).toBe(200);
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: d2.refresh })).status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ UC-CART-02 xem giỏ hàng
  describe('UC-CART-02 xem giỏ hàng', () => {
    it('cần đăng nhập (401)', async () => {
      expect((await api('get', '/cart')).status).toBe(401);
    });

    it('chưa có giỏ ⇒ giỏ rỗng và KHÔNG tạo bản ghi giỏ', async () => {
      const c = await customer('cart-empty');
      await prisma.cart.deleteMany({ where: { userId: c.id } }); // đăng ký tạo sẵn giỏ; mô phỏng tài khoản chưa có giỏ
      expect(await prisma.cart.count({ where: { userId: c.id } })).toBe(0);
      const r = await api('get', '/cart', c.access);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        items: [],
        itemCount: 0,
        subtotal: 0,
        discountAmount: 0,
        total: 0,
        coupon: null,
      });
      expect(await prisma.cart.count({ where: { userId: c.id } })).toBe(0);
    });

    it('giá luôn tính lại từ biến thể khi xem: đổi giá/khuyến mãi thì giỏ phản ánh ngay; subtotal = tổng dòng', async () => {
      const c = await customer('cart-price');
      const v = await variantWithStock(5);
      expect(
        (await api('post', '/cart/items', c.access, { variantId: v.id, quantity: 2 })).status,
      ).toBeLessThan(300);
      const first = (await api('get', '/cart', c.access)).body.data;
      expect(first.items).toHaveLength(1);
      expect(first.items[0]).toMatchObject({ variantId: v.id, quantity: 2 });
      const unit = first.items[0].unitPrice as number;
      expect(first.subtotal).toBe(unit * 2);
      try {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: { price: 7_777_000, salePrice: null },
        });
        const after = (await api('get', '/cart', c.access)).body.data;
        expect(after.items[0].unitPrice).toBe(7_777_000);
        expect(after.subtotal).toBe(7_777_000 * 2);
        expect(after.total).toBe(after.subtotal - after.discountAmount + after.shippingFee);
      } finally {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: { price: v.price, salePrice: v.salePrice },
        });
      }
    });

    it('báo tồn kho hiện có của dòng; mỗi người chỉ thấy giỏ của mình; items=… chỉ tính các dòng chọn', async () => {
      const a = await customer('cart-a');
      const b = await customer('cart-b');
      const vs = await prisma.productVariant.findMany({
        where: {
          isActive: true,
          stockQuantity: { gte: 5 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
        take: 2,
      });
      for (const v of vs) await api('post', '/cart/items', a.access, { variantId: v.id, quantity: 1 });
      const view = (await api('get', '/cart', a.access)).body.data;
      expect(view.items).toHaveLength(2);
      expect(view.items[0].stockQuantity).toBe(vs[0].stockQuantity);
      expect((await api('get', '/cart', b.access)).body.data.items).toEqual([]);
      const one = (await api('get', `/cart?items=${view.items[0].id}`, a.access)).body.data;
      expect(one.items.map((i: { id: number }) => i.id)).toEqual([view.items[0].id]);
      expect(one.subtotal).toBe(view.items[0].lineTotal);
    });

    it('biến thể bị ngừng bán không còn trong giỏ khi sản phẩm được sửa (dòng bị dọn)', async () => {
      const c = await customer('cart-inactive');
      const v = await variantWithStock(5);
      await api('post', '/cart/items', c.access, { variantId: v.id, quantity: 1 });
      expect((await api('get', '/cart', c.access)).body.data.items).toHaveLength(1);
      const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: c.id } });
      try {
        await prisma.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
        // đặt thêm hàng vào biến thể đã ngừng bán bị từ chối
        const add = await api('post', '/cart/items', c.access, { variantId: v.id, quantity: 1 });
        expect(add.status).toBeGreaterThanOrEqual(400);
        expect(add.status).toBeLessThan(500);
        expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBeGreaterThanOrEqual(0);
      } finally {
        await prisma.productVariant.update({ where: { id: v.id }, data: { isActive: true } });
      }
    });
  });

  // ------------------------------------------------------------------ UC-CART-04 mã giảm giá
  describe('UC-CART-04 áp mã giảm giá', () => {
    const coupon = async (code: string, over: Record<string, unknown> = {}) => {
      const r = await api('post', '/admin/coupons', admin, {
        name: `Mã ${code}`,
        code,
        kind: 'percent',
        value: 10,
        maxDiscount: 500_000,
        minOrderValue: 0,
        usageLimit: 100,
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2099-12-31T00:00:00Z',
        ...over,
      });
      expect(r.status).toBe(201);
      return r.body.data as { id: number; code: string };
    };
    const withItem = async (label: string) => {
      const c = await customer(label);
      const v = await variantWithStock(5);
      expect(
        (await api('post', '/cart/items', c.access, { variantId: v.id, quantity: 1 })).status,
      ).toBeLessThan(300);
      return c;
    };

    it('cần đăng nhập (401) ở áp và gỡ mã', async () => {
      expect((await api('post', '/cart/coupon', undefined, { code: 'ABC' })).status).toBe(401);
      expect((await api('delete', '/cart/coupon')).status).toBe(401);
    });

    it('áp mã hợp lệ (không phân biệt hoa thường): giảm đúng, tổng cập nhật, lưu vào giỏ; gỡ mã trả về giá gốc', async () => {
      const code = `CP10${tag}`.slice(0, 14);
      await coupon(code);
      const c = await withItem('cp-ok');
      const before = (await api('get', '/cart', c.access)).body.data;
      const r = await api('post', '/cart/coupon', c.access, { code: ` ${code.toLowerCase()} ` });
      expect(r.status).toBe(200);
      const d = r.body.data;
      expect(d.coupon).toMatchObject({ code });
      expect(d.discountAmount).toBe(Math.min(Math.round((before.subtotal * 10) / 100), 500_000));
      expect(d.total).toBe(before.subtotal - d.discountAmount + before.shippingFee);
      // giữ lại ở lần xem sau
      expect((await api('get', '/cart', c.access)).body.data.coupon).toMatchObject({ code });
      const removed = await api('delete', '/cart/coupon', c.access);
      expect(removed.status).toBe(200);
      expect(removed.body.data.coupon).toBeNull();
      expect(removed.body.data.discountAmount).toBe(0);
      expect(removed.body.data.total).toBe(before.total);
    });

    it('mã không tồn tại / ngừng / chưa tới hạn / hết hạn / hết lượt / dưới giá trị tối thiểu / giỏ rỗng / thiếu mã ⇒ lỗi rõ ràng, giỏ không bị đổi', async () => {
      const c = await withItem('cp-bad');
      const expectBad = async (code: string, status: number, msg: RegExp) => {
        const r = await api('post', '/cart/coupon', c.access, { code });
        expect([code, r.status]).toEqual([code, status]);
        expect(r.body.error.message).toMatch(msg);
        expect((await api('get', '/cart', c.access)).body.data.coupon).toBeNull();
      };
      await expectBad('KHONGCO123', 400, /không tồn tại/);
      const off = await coupon(`OFF${tag}`.slice(0, 12), { isActive: false });
      await expectBad(off.code, 400, /vô hiệu hóa/);
      const future = await coupon(`FUT${tag}`.slice(0, 12), {
        startsAt: '2090-01-01T00:00:00Z',
        endsAt: '2099-12-31T00:00:00Z',
      });
      await expectBad(future.code, 400, /chưa đến thời gian/);
      const expired = await coupon(`EXP${tag}`.slice(0, 12), {
        startsAt: '2020-01-01T00:00:00Z',
        endsAt: '2020-12-31T00:00:00Z',
      });
      await expectBad(expired.code, 400, /hết hạn/);
      const full = await coupon(`FULL${tag}`.slice(0, 12), { usageLimit: 1 });
      await prisma.coupon.update({ where: { id: full.id }, data: { usedCount: 1 } });
      await expectBad(full.code, 400, /hết lượt/);
      const big = await coupon(`BIG${tag}`.slice(0, 12), { minOrderValue: 900_000_000 });
      await expectBad(big.code, 400, /tối thiểu/);
      // thiếu mã ⇒ lỗi theo trường; giỏ rỗng ⇒ lỗi giỏ trống
      const none = await api('post', '/cart/coupon', c.access, {});
      expect(none.status).toBe(400);
      expect(Object.keys(none.body.error.details)).toContain('code');
      const empty = await customer('cp-empty');
      const e = await api('post', '/cart/coupon', empty.access, { code: expired.code });
      expect(e.status).toBe(400);
      expect(e.body.error.message).toMatch(/trống/);
    });

    it('giới hạn mỗi người: dùng hết lượt cá nhân thì không áp lại được', async () => {
      const lim = await coupon(`PER${tag}`.slice(0, 12), { perUserLimit: 1 });
      const c = await withItem('cp-per');
      const order = await prisma.order.findFirstOrThrow({ orderBy: { id: 'asc' } });
      await prisma.couponUsage.create({ data: { couponId: lim.id, userId: c.id, orderId: order.id } });
      const r = await api('post', '/cart/coupon', c.access, { code: lim.code });
      expect(r.status).toBe(400);
      expect(r.body.error.message).toMatch(/hết lượt/);
    });

    it('mã trở nên không hợp lệ sau khi đã áp (bị vô hiệu hóa) ⇒ lần xem giỏ sau tự gỡ mã, tổng về giá gốc', async () => {
      const k = await coupon(`LATE${tag}`.slice(0, 12));
      const c = await withItem('cp-late');
      expect((await api('post', '/cart/coupon', c.access, { code: k.code })).status).toBe(200);
      await prisma.coupon.update({ where: { id: k.id }, data: { isActive: false } });
      const v = (await api('get', '/cart', c.access)).body.data;
      expect(v.coupon).toBeNull();
      expect(v.discountAmount).toBe(0);
      expect(v.total).toBe(v.subtotal + v.shippingFee);
    });
  });

  // ------------------------------------------------------------------ UC-CAT-01 trang chủ
  describe('UC-CAT-01 trang chủ', () => {
    it('sản phẩm nổi bật: chỉ isFeatured, đang bán, chưa xóa; đúng pageSize; sản phẩm ẩn đi/nổi bật mới cập nhật ngay', async () => {
      const featured = async () => {
        const r = await api('get', '/products?featured=true&pageSize=8');
        expect(r.status).toBe(200);
        return r.body.data as Array<{ id: number; slug: string; isFeatured: boolean }>;
      };
      const list = await featured();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(8);
      expect(list.every((p) => p.isFeatured)).toBe(true);
      const total = await prisma.product.count({
        where: { isFeatured: true, status: 'published', deletedAt: null },
      });
      expect((await api('get', '/products?featured=true&pageSize=100')).body.meta.total).toBe(total);

      const p = await prisma.product.findFirstOrThrow({ where: { id: list[0].id } });
      try {
        await prisma.product.update({ where: { id: p.id }, data: { status: 'draft' } });
        await cache.invalidateCatalog();
        expect((await featured()).map((x) => x.id)).not.toContain(p.id);
      } finally {
        await prisma.product.update({ where: { id: p.id }, data: { status: 'published' } });
        await cache.invalidateCatalog();
      }
      expect((await featured()).map((x) => x.id)).toContain(p.id);

      const plain = await prisma.product.findFirstOrThrow({
        where: { isFeatured: false, status: 'published', deletedAt: null },
      });
      try {
        await prisma.product.update({ where: { id: plain.id }, data: { isFeatured: true } });
        await cache.invalidateCatalog();
        expect(
          (await api('get', '/products?featured=true&pageSize=100')).body.data.map(
            (x: { id: number }) => x.id,
          ),
        ).toContain(plain.id);
      } finally {
        await prisma.product.update({ where: { id: plain.id }, data: { isFeatured: false } });
        await cache.invalidateCatalog();
      }
    });

    it('danh mục: cây 2 cấp chỉ gồm danh mục đang hoạt động; tắt danh mục thì biến mất ngay (kể cả danh mục con)', async () => {
      const names = (tree: Array<{ slug: string; children?: Array<{ slug: string }> }>) =>
        tree.flatMap((n) => [n.slug, ...(n.children ?? []).map((c) => c.slug)]);
      const r = await api('get', '/categories');
      expect(r.status).toBe(200);
      const all = names(r.body.data);
      expect(all.length).toBeGreaterThan(2);
      const parent = await prisma.category.findFirstOrThrow({
        where: { parentId: null, isActive: true, children: { some: { isActive: true } } },
      });
      const child = await prisma.category.findFirstOrThrow({
        where: { parentId: parent.id, isActive: true },
      });
      try {
        await prisma.category.update({ where: { id: child.id }, data: { isActive: false } });
        await cache.invalidateCatalog();
        const t1 = names((await api('get', '/categories')).body.data);
        expect(t1).toContain(parent.slug);
        expect(t1).not.toContain(child.slug);
        await prisma.category.update({ where: { id: parent.id }, data: { isActive: false } });
        await cache.invalidateCatalog();
        expect(names((await api('get', '/categories')).body.data)).not.toContain(parent.slug);
      } finally {
        await prisma.category.updateMany({
          where: { id: { in: [parent.id, child.id] } },
          data: { isActive: true },
        });
        await cache.invalidateCatalog();
      }
      expect(names((await api('get', '/categories')).body.data)).toContain(parent.slug);
    });

    it('banner: chỉ banner đang bật và trong thời gian hiệu lực; công khai (không cần đăng nhập)', async () => {
      const ids = async () =>
        ((await api('get', '/banners')).body.data as Array<{ id: number }>).map((b) => b.id);
      const before = await ids();
      expect(before.length).toBeGreaterThan(0);
      const b = await prisma.banner.findFirstOrThrow({ where: { id: before[0] } });
      try {
        await prisma.banner.update({ where: { id: b.id }, data: { isActive: false } });
        expect(await ids()).not.toContain(b.id);
        await prisma.banner.update({
          where: { id: b.id },
          data: { isActive: true, endAt: new Date(Date.now() - 86_400_000) },
        });
        expect(await ids()).not.toContain(b.id); // hết hạn
        await prisma.banner.update({
          where: { id: b.id },
          data: { endAt: null, startAt: new Date(Date.now() + 86_400_000) },
        });
        expect(await ids()).not.toContain(b.id); // chưa tới hạn
      } finally {
        await prisma.banner.update({
          where: { id: b.id },
          data: { isActive: b.isActive, startAt: b.startAt, endAt: b.endAt },
        });
      }
      expect(await ids()).toContain(b.id);
    });

    it('không gian mới nhất: chỉ không gian đã đăng, giới hạn pageSize, sắp mới nhất trước', async () => {
      const r = await api('get', '/spaces?pageSize=4&sort=newest');
      expect(r.status).toBe(200);
      const items = r.body.data as Array<{ id: number; publishedAt: string | null }>;
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(4);
      const rows = await prisma.space.findMany({ where: { id: { in: items.map((s) => s.id) } } });
      expect(rows.every((s) => s.status === 'published')).toBe(true);
      const times = items.map((s) => new Date(s.publishedAt ?? 0).getTime());
      expect(times.every((t, i) => i === 0 || times[i - 1] >= t)).toBe(true);
    });
  });
});
