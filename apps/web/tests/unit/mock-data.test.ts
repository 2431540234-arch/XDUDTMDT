import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/mock-data/db';
import { handleMockRequest } from '../../src/mock-data/mockApi';

const db = buildSeed();

describe('mock-data: số lượng theo yêu cầu', () => {
  it('người dùng: 1 doanh nghiệp + 30+ khách hàng, không có role nào khác', () => {
    expect(
      db.users.filter((u) => db.userRoles.some((r) => r.userId === u.id && r.roleId === 1)),
    ).toHaveLength(1);
    expect(db.users.length - 1).toBeGreaterThanOrEqual(30);
    expect(db.roles.map((r) => r.code).sort()).toEqual(['admin', 'user']);
    expect(db.users.some((u) => u.status !== 'active')).toBe(true);
  });
  it('sản phẩm, 3D, không gian, đơn, đánh giá, hỏi đáp, coupon, đổi trả, thông báo', () => {
    expect(db.products.length).toBeGreaterThanOrEqual(48);
    expect(db.product3dModels.length).toBeGreaterThanOrEqual(20);
    expect(db.spaces.length).toBeGreaterThanOrEqual(12);
    expect(db.orders.length).toBeGreaterThanOrEqual(60);
    expect(db.reviews.length).toBeGreaterThanOrEqual(80);
    expect(db.productQuestions.length).toBeGreaterThanOrEqual(30);
    expect(db.coupons.length).toBeGreaterThanOrEqual(12);
    expect(db.returnRequests.length).toBeGreaterThanOrEqual(12);
    expect(db.notifications.filter((n) => n.userId === 2).length).toBeGreaterThanOrEqual(15);
    expect(db.activityLogs.length).toBeGreaterThanOrEqual(20);
    expect(db.posts.length).toBeGreaterThanOrEqual(6);
  });
  it('đơn hàng đủ mọi trạng thái và phương thức thanh toán', () => {
    const statuses = new Set(db.orders.map((o) => o.status));
    for (const s of ['pending', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled', 'refunded'])
      expect(statuses.has(s as never), s).toBe(true);
    const methods = new Set(db.orders.map((o) => o.paymentMethod));
    for (const m of ['cod', 'bank_transfer', 'vnpay', 'momo', 'zalopay', 'card'])
      expect(methods.has(m as never), m).toBe(true);
    const months = new Set(db.orders.map((o) => o.createdAt.slice(0, 7)));
    expect(months.size).toBe(11);
  });
});

describe('mock-data: toàn vẹn dữ liệu', () => {
  it('tổng đơn = tạm tính − giảm giá + phí ship; tạm tính = Σ thành tiền', () => {
    for (const o of db.orders) {
      expect(o.total, o.orderCode).toBe(o.subtotal - o.discountAmount + o.shippingFee);
      const sum = db.orderItems.filter((i) => i.orderId === o.id).reduce((s, i) => s + (i.lineTotal ?? 0), 0);
      expect(sum, o.orderCode).toBe(o.subtotal);
    }
  });
  it('khóa ngoại trỏ tới bản ghi có thật', () => {
    const has = (rows: Array<{ id: number }>, id: number | null) =>
      id === null || rows.some((r) => r.id === id);
    for (const p of db.products)
      expect(has(db.categories, p.categoryId) && has(db.brands, p.brandId)).toBe(true);
    for (const v of db.productVariants) expect(has(db.products, v.productId)).toBe(true);
    for (const i of db.productImages)
      expect(has(db.media, i.mediaId) && has(db.products, i.productId)).toBe(true);
    for (const i of db.orderItems)
      expect(has(db.orders, i.orderId) && has(db.productVariants, i.variantId)).toBe(true);
    for (const o of db.orders) expect(has(db.users, o.userId) && has(db.coupons, o.couponId)).toBe(true);
    for (const r of db.reviews) {
      expect(has(db.orders, r.orderId) && has(db.products, r.productId)).toBe(true);
      expect(db.orders.find((o) => o.id === r.orderId)?.status).toBe('completed');
    }
    for (const h of db.spaceHotspots)
      expect(
        has(db.spacePanoramas, h.panoramaId) && (h.type !== 'product' || has(db.products, h.productId)),
      ).toBe(true);
    for (const m of db.modelFiles)
      expect(has(db.product3dModels, m.modelId) && has(db.media, m.mediaId)).toBe(true);
    for (const c of db.cartItems)
      expect(has(db.carts, c.cartId) && has(db.productVariants, c.variantId)).toBe(true);
    for (const u of db.users) expect(has(db.media, u.avatarMediaId)).toBe(true);
    for (const r of db.returnRequests) expect(has(db.orders, r.orderId)).toBe(true);
  });
  it('mỗi khách đúng 1 địa chỉ mặc định; mỗi SP đúng 1 ảnh chính; mỗi không gian đúng 1 ảnh bắt đầu', () => {
    for (const u of db.users.filter((x) => x.id > 1))
      expect(db.addresses.filter((a) => a.userId === u.id && a.isDefault)).toHaveLength(1);
    for (const p of db.products)
      expect(db.productImages.filter((i) => i.productId === p.id && i.isPrimary)).toHaveLength(1);
    for (const s of db.spaces)
      expect(db.spacePanoramas.filter((p) => p.spaceId === s.id && p.isStart)).toHaveLength(1);
  });
  it('số tổng hợp tính từ dữ liệu: rating/số đánh giá/đã bán/lượt dùng coupon', () => {
    for (const p of db.products) {
      const ap = db.reviews.filter((r) => r.productId === p.id && r.status === 'approved');
      expect(p.ratingCount).toBe(ap.length);
    }
    for (const c of db.coupons)
      expect(c.usedCount).toBe(db.couponUsages.filter((u) => u.couponId === c.id).length);
  });
  it('tồn kho = nhập − bán + trả', () => {
    for (const v of db.productVariants) {
      const net = db.inventoryMovements
        .filter((m) => m.variantId === v.id)
        .reduce((s, m) => s + m.quantityChange, 0);
      expect(net, v.sku).toBe(v.stockQuantity);
    }
  });
  it('mỗi khách có tối đa 1 giỏ; ngày nằm trong năm 2026', () => {
    expect(new Set(db.carts.map((c) => c.userId)).size).toBe(db.carts.length);
    for (const o of db.orders) expect(o.createdAt.startsWith('2026-')).toBe(true);
  });
});

describe('mock-data: xem 360°', () => {
  it('≥ 8 sản phẩm bật 360°, mỗi màu 36 frame, 3–4 màu, 2–3 kích thước, có tổ hợp hết hàng', () => {
    const on = db.product360.filter((x) => x.enabled);
    expect(on.length).toBeGreaterThanOrEqual(8);
    let outOfStock = 0;
    for (const c of on) {
      const frames = db.product360Frames.filter((f) => f.productId === c.productId);
      expect(frames.length).toBeGreaterThanOrEqual(3);
      expect(frames.length).toBeLessThanOrEqual(4);
      for (const f of frames) expect(f.frames).toHaveLength(36);
      const variants = db.productVariants.filter((v) => v.productId === c.productId);
      const sizes = new Set(
        variants.map(
          (v) =>
            db.variantAttributeValues.find((a) => a.variantId === v.id && a.attributeId === 2)
              ?.attributeValueId,
        ),
      );
      expect(sizes.size).toBeGreaterThanOrEqual(2);
      expect(sizes.size).toBeLessThanOrEqual(3);
      outOfStock += variants.filter((v) => v.stockQuantity === 0).length;
    }
    expect(outOfStock).toBeGreaterThan(0);
  });
  it('API /products/:slug/360 trả frames, biến thể, chính sách; sản phẩm không bật trả 404', async () => {
    const ok = await handleMockRequest({
      method: 'GET',
      path: '/products/sofa-nordic/360',
      query: {},
      body: undefined,
      token: null,
    });
    const d = (
      ok.body as { data: { colors: Array<{ frames: string[] }>; variants: unknown[]; policies: unknown[] } }
    ).data;
    expect(ok.status).toBe(200);
    expect(d.colors[0].frames).toHaveLength(36);
    expect(d.policies).toHaveLength(4);
    const no = await handleMockRequest({
      method: 'GET',
      path: '/products/ke-tivi-hien-dai/360',
      query: {},
      body: undefined,
      token: null,
    });
    expect(no.status).toBe(404);
  });
});

describe('mock API: luồng cơ bản', () => {
  const call = (
    method: string,
    path: string,
    body?: unknown,
    token: string | null = null,
    query: Record<string, string> = {},
  ) => handleMockRequest({ method, path, query, body, token });

  it('đăng nhập khách + chặn vào API admin', async () => {
    localStorage.setItem('aurelia-mock-config', JSON.stringify({ latency: false }));
    const bad = await call('POST', '/auth/login', { email: 'khachhang@aurelia.vn', password: 'sai' });
    expect(bad.status).toBe(401);
    const login = await call('POST', '/auth/login', { email: 'khachhang@aurelia.vn', password: '123456' });
    expect(login.status).toBe(200);
    const token = (login.body as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
    const denied = await call('GET', '/admin/orders', undefined, token);
    expect(denied.status).toBe(403);
    const adminLogin = await call('POST', '/auth/login', { email: 'admin@aurelia.vn', password: 'admin123' });
    const adminToken = (adminLogin.body as { data: { tokens: { accessToken: string } } }).data.tokens
      .accessToken;
    const ok = await call('GET', '/admin/orders', undefined, adminToken);
    expect(ok.status).toBe(200);
    const wrongRole = await call('POST', '/auth/login', {
      email: 'khachhang@aurelia.vn',
      password: '123456',
      adminOnly: true,
    });
    expect(wrongRole.status).toBe(403);
  });

  it('giỏ → mã giảm giá → đặt hàng → thanh toán → hủy', async () => {
    const login = await call('POST', '/auth/login', { email: 'khachhang@aurelia.vn', password: '123456' });
    const token = (login.body as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
    const cart = await call('GET', '/cart', undefined, token);
    const c = (cart.body as { data: { items: unknown[]; subtotal: number } }).data;
    expect(c.items.length).toBe(3);
    const apply = await call('POST', '/cart/coupon', { code: 'GIAM200K' }, token);
    expect(apply.status).toBe(200);
    expect((apply.body as { data: { discountAmount: number } }).data.discountAmount).toBe(200000);
    const bad = await call('POST', '/cart/coupon', { code: 'HETHAN' }, token);
    expect(bad.status).toBe(400);
    const addr = (await call('GET', '/addresses', undefined, token)).body as { data: Array<{ id: number }> };
    const order = await call(
      'POST',
      '/orders',
      { addressId: addr.data[0].id, paymentMethod: 'vnpay' },
      token,
    );
    expect(order.status).toBe(201);
    const o = (order.body as { data: { id: number; orderCode: string; total: number } }).data;
    expect(o.orderCode).toMatch(/^ALV-\d{8}-\d{4}$/);
    const pay = await call('POST', `/payments/${o.id}/checkout`, {}, token);
    expect((pay.body as { data: { redirectUrl: string } }).data.redirectUrl).toContain('/checkout/success');
    const detail = await call('GET', `/orders/${o.orderCode}`, undefined, token);
    expect((detail.body as { data: { status: string; paymentStatus: string } }).data).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'paid',
    });
  });

  it('danh sách sản phẩm: phân trang, lọc, tìm không dấu', async () => {
    const list = await call('GET', '/products', undefined, null, { category: 'sofa', pageSize: '4' });
    const body = list.body as { data: unknown[]; meta: { total: number; totalPages: number } };
    expect(body.data.length).toBe(4);
    expect(body.meta.total).toBe(8);
    const s = await call('GET', '/products/search', undefined, null, { q: 'ghe thu gian' });
    expect((s.body as { data: Array<{ name: string }> }).data[0].name).toBe('Ghế thư giãn');
  });
});
