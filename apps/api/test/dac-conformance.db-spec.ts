// E2E (supertest) đối chiếu RÀNG BUỘC ĐẦU VÀO và LUỒNG THAY THẾ của DAC_TA với API thật (đợt hoàn thiện 2026-11-10).
// Mỗi nhóm gom các kiểm tra theo UC; test fail liệt kê MỌI điểm lệch của nhóm đó để xử lý một lượt. Chạy trên aurelia_test (DB mới reset).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { CatalogCache } from '../src/cache/catalog-cache';

describe('Đối chiếu DAC_TA ↔ API (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let seq = 0;
  const tag = `${Date.now()}`;
  const PW = 'Matkhau-12345';
  const issues: string[] = [];

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const api = (method: Method, path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  /** Ghi lại điểm lệch thay vì dừng ở lỗi đầu tiên */
  const expectStatus = (uc: string, what: string, got: number, want: number | number[]) => {
    const ok = Array.isArray(want) ? want.includes(got) : got === want;
    if (!ok) issues.push(`${uc}: ${what} ⇒ nhận ${got}, DAC_TA/quyết định yêu cầu ${JSON.stringify(want)}`);
  };
  const customer = async (label = 'dac') => {
    const email = `${label}-${tag}-${++seq}@test.local`;
    const r = await api('post', '/auth/register', undefined, {
      fullName: `Khách ${label}`,
      email,
      phone: '0911222333',
      password: PW,
      confirmPassword: PW,
    });
    expect(r.status).toBe(201);
    const l = await api('post', '/auth/login', undefined, { email, password: PW });
    const u = await prisma.user.findFirstOrThrow({ where: { email } });
    return {
      id: u.id,
      email,
      token: l.body.data.tokens.accessToken as string,
      refresh: l.body.data.tokens.refreshToken as string,
    };
  };
  const addr = (over: Record<string, unknown> = {}) => ({
    recipientName: 'Nguyễn Văn A',
    phone: '0912345678',
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Phường Bến Nghé',
    addressLine: '12 Lê Lợi',
    ...over,
  });
  const stockVariant = (min = 20) =>
    prisma.productVariant.findFirstOrThrow({
      where: {
        isActive: true,
        stockQuantity: { gte: min },
        product: { status: 'published', deletedAt: null },
      },
      orderBy: { id: 'asc' },
    });
  const flush = () => {
    const out = issues.splice(0, issues.length);
    expect(out).toEqual([]);
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

  it('nhóm xác thực: UC-AUTH-02/03/05/07, UC-ACC-01/05', async () => {
    // AUTH-02: email sai định dạng và mật khẩu rỗng ⇒ 400; sai thông tin ⇒ 401
    expectStatus(
      'UC-AUTH-02',
      'email sai định dạng',
      (await api('post', '/auth/login', undefined, { email: 'khong-hop-le', password: 'x' })).status,
      400,
    );
    expectStatus(
      'UC-AUTH-02',
      'mật khẩu rỗng',
      (await api('post', '/auth/login', undefined, { email: 'a@b.co', password: '' })).status,
      400,
    );
    expectStatus(
      'UC-AUTH-02',
      'sai mật khẩu',
      (await api('post', '/auth/login', undefined, { email: 'admin@aurelia.vn', password: 'sai' })).status,
      401,
    );
    // AUTH-03: thiếu / sai refresh token ⇒ 401
    expectStatus(
      'UC-AUTH-03',
      'thiếu refreshToken',
      (await api('post', '/auth/refresh', undefined, {})).status,
      [400, 401],
    );
    expectStatus(
      'UC-AUTH-03',
      'refreshToken sai',
      (await api('post', '/auth/refresh', undefined, { refreshToken: 'abc' })).status,
      401,
    );
    // AUTH-05: email sai định dạng ⇒ 400
    expectStatus(
      'UC-AUTH-05',
      'email sai định dạng',
      (await api('post', '/auth/forgot-password', undefined, { email: 'khong-hop-le' })).status,
      400,
    );
    // AUTH-07: token sai ⇒ 400
    expectStatus(
      'UC-AUTH-07',
      'token verify sai',
      (await api('post', '/auth/verify-email', undefined, { token: 'abc' })).status,
      400,
    );

    const c = await customer('acc');
    // ACC-01: fullName 2–150, phone 10–11 chữ số
    expectStatus(
      'UC-ACC-01',
      'fullName 1 ký tự',
      (await api('patch', '/users/me', c.token, { fullName: 'A' })).status,
      400,
    );
    expectStatus(
      'UC-ACC-01',
      'fullName 151 ký tự',
      (await api('patch', '/users/me', c.token, { fullName: 'A'.repeat(151) })).status,
      400,
    );
    expectStatus(
      'UC-ACC-01',
      'fullName 150 ký tự',
      (await api('patch', '/users/me', c.token, { fullName: 'A'.repeat(150) })).status,
      200,
    );
    expectStatus(
      'UC-ACC-01',
      'phone 11 chữ số',
      (await api('patch', '/users/me', c.token, { phone: '09112223334' })).status,
      200,
    );
    expectStatus(
      'UC-ACC-01',
      'phone 9 chữ số',
      (await api('patch', '/users/me', c.token, { phone: '091122233' })).status,
      400,
    );
    // ACC-05: thông báo của người khác ⇒ 404
    const other = await customer('acc-o');
    const n = await prisma.notification.create({
      data: { userId: other.id, title: 'Riêng tư', data: { type: 'system', content: 'x', link: null } },
    });
    expectStatus(
      'UC-ACC-05',
      'đánh dấu đã đọc thông báo của người khác',
      (await api('patch', `/notifications/${n.id}/read`, c.token)).status,
      404,
    );
    expectStatus(
      'UC-ACC-05',
      'đánh dấu đã đọc thông báo không tồn tại',
      (await api('patch', '/notifications/999999999/read', c.token)).status,
      404,
    );
    expectStatus('UC-ACC-05', 'chưa đăng nhập', (await api('get', '/notifications')).status, 401);
    flush();
  });

  it('nhóm giỏ hàng & mã giảm giá: UC-CART-01/03/04', async () => {
    const c = await customer('cart');
    const v = await stockVariant();
    expectStatus(
      'UC-CART-01',
      'chưa đăng nhập',
      (await api('post', '/cart/items', undefined, { variantId: v.id, quantity: 1 })).status,
      401,
    );
    expectStatus(
      'UC-CART-01',
      'quantity 0',
      (await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 0 })).status,
      400,
    );
    expectStatus(
      'UC-CART-01',
      'quantity 100',
      (await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 100 })).status,
      [400, 409],
    );
    expectStatus(
      'UC-CART-01',
      'quantity không phải số',
      (await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 'abc' })).status,
      400,
    );
    expectStatus(
      'UC-CART-01',
      'variantId không tồn tại',
      (await api('post', '/cart/items', c.token, { variantId: 999999999, quantity: 1 })).status,
      [400, 404],
    );
    const ok = await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 1 });
    expectStatus('UC-CART-01', 'thêm hợp lệ', ok.status, [200, 201]);
    // cộng dồn khi thêm lại
    await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 2 });
    const cart = (await api('get', '/cart', c.token)).body.data;
    if (cart.items.length !== 1 || cart.items[0].quantity !== 3)
      issues.push(
        `UC-CART-01: thêm trùng biến thể phải cộng dồn (1+2=3), nhận ${JSON.stringify(cart.items.map((i: { quantity: number }) => i.quantity))}`,
      );
    const itemId = cart.items[0].id;
    expectStatus(
      'UC-CART-03',
      'quantity 0',
      (await api('patch', `/cart/items/${itemId}`, c.token, { quantity: 0 })).status,
      400,
    );
    expectStatus(
      'UC-CART-03',
      'quantity 100',
      (await api('patch', `/cart/items/${itemId}`, c.token, { quantity: 100 })).status,
      [400, 409],
    );
    expectStatus(
      'UC-CART-03',
      'quantity vượt tồn kho',
      (await api('patch', `/cart/items/${itemId}`, c.token, { quantity: 99 })).status,
      [400, 409],
    );
    expectStatus(
      'UC-CART-03',
      'dòng của người khác',
      (await api('patch', `/cart/items/${itemId}`, (await customer('cart-o')).token, { quantity: 2 })).status,
      404,
    );
    expectStatus(
      'UC-CART-03',
      'dòng không tồn tại',
      (await api('delete', '/cart/items/999999999', c.token)).status,
      404,
    );
    expectStatus(
      'UC-CART-03',
      'cập nhật hợp lệ',
      (await api('patch', `/cart/items/${itemId}`, c.token, { quantity: 5 })).status,
      200,
    );
    // CART-04: code 1–50 ký tự
    expectStatus(
      'UC-CART-04',
      'code 51 ký tự',
      (await api('post', '/cart/coupon', c.token, { code: 'A'.repeat(51) })).status,
      400,
    );
    expectStatus(
      'UC-CART-04',
      'code rỗng',
      (await api('post', '/cart/coupon', c.token, { code: '' })).status,
      400,
    );
    expectStatus(
      'UC-CART-03',
      'xóa dòng hợp lệ',
      (await api('delete', `/cart/items/${itemId}`, c.token)).status,
      200,
    );
    flush();
  });

  it('nhóm đơn hàng: UC-ORD-01/02/03, UC-PAY-01/03', async () => {
    const c = await customer('ord');
    const v = await stockVariant();
    const a = (await api('post', '/addresses', c.token, addr())).body.data;
    const addToCart = () => api('post', '/cart/items', c.token, { variantId: v.id, quantity: 1 });
    await addToCart();
    expectStatus(
      'UC-ORD-01',
      'paymentMethod sai',
      (await api('post', '/orders', c.token, { addressId: a.id, paymentMethod: 'paypal' })).status,
      400,
    );
    expectStatus(
      'UC-ORD-01',
      'thiếu paymentMethod',
      (await api('post', '/orders', c.token, { addressId: a.id })).status,
      400,
    );
    expectStatus(
      'UC-ORD-01',
      'note 501 ký tự',
      (
        await api('post', '/orders', c.token, {
          addressId: a.id,
          paymentMethod: 'cod',
          note: 'x'.repeat(501),
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-ORD-01',
      'couponCode sai',
      (
        await api('post', '/orders', c.token, {
          addressId: a.id,
          paymentMethod: 'cod',
          couponCode: 'KHONGCO999',
        })
      ).status,
      400,
    );
    const other = await customer('ord-o');
    expectStatus(
      'UC-ORD-01',
      'địa chỉ của người khác',
      (
        await api('post', '/orders', c.token, {
          addressId: (await api('post', '/addresses', other.token, addr())).body.data.id,
          paymentMethod: 'cod',
        })
      ).status,
      404,
    );
    expectStatus(
      'UC-ORD-01',
      'chưa đăng nhập',
      (await api('post', '/orders', undefined, { addressId: a.id, paymentMethod: 'cod' })).status,
      401,
    );
    const ok = await api('post', '/orders', c.token, {
      addressId: a.id,
      paymentMethod: 'cod',
      note: 'x'.repeat(500),
    });
    expectStatus('UC-ORD-01', 'đặt hợp lệ (note 500 ký tự)', ok.status, 201);
    const order = ok.body.data;
    if (order?.status !== 'pending')
      issues.push(`UC-ORD-01: đơn mới phải ở trạng thái pending, nhận ${order?.status}`);
    expectStatus(
      'UC-ORD-01',
      'giỏ rỗng sau khi đặt',
      (await api('post', '/orders', c.token, { addressId: a.id, paymentMethod: 'cod' })).status,
      400,
    );
    // ORD-02
    expectStatus(
      'UC-ORD-02',
      'status sai',
      (await api('get', '/orders?status=khong-co', c.token)).status,
      [200, 400],
    );
    expectStatus(
      'UC-ORD-02',
      'đơn của người khác',
      (await api('get', `/orders/${order.orderCode}`, other.token)).status,
      404,
    );
    expectStatus('UC-ORD-02', 'chưa đăng nhập', (await api('get', '/orders')).status, 401);
    const mine = await api('get', '/orders?status=pending&pageSize=5', c.token);
    if (
      !Array.isArray(mine.body.data) ||
      !mine.body.data.every((o: { status: string }) => o.status === 'pending')
    )
      issues.push('UC-ORD-02: lọc status=pending phải chỉ trả đơn pending');
    // ORD-03: reason bắt buộc 5–500 ký tự
    expectStatus(
      'UC-ORD-03',
      'thiếu lý do',
      (await api('post', `/orders/${order.id}/cancel`, c.token, {})).status,
      400,
    );
    expectStatus(
      'UC-ORD-03',
      'lý do 4 ký tự',
      (await api('post', `/orders/${order.id}/cancel`, c.token, { reason: 'abcd' })).status,
      400,
    );
    expectStatus(
      'UC-ORD-03',
      'lý do 501 ký tự',
      (await api('post', `/orders/${order.id}/cancel`, c.token, { reason: 'x'.repeat(501) })).status,
      400,
    );
    expectStatus(
      'UC-ORD-03',
      'đơn của người khác',
      (await api('post', `/orders/${order.id}/cancel`, other.token, { reason: 'Không cần nữa' })).status,
      404,
    );
    expectStatus(
      'UC-ORD-03',
      'hủy hợp lệ',
      (await api('post', `/orders/${order.id}/cancel`, c.token, { reason: 'Không cần nữa' })).status,
      200,
    );
    expectStatus(
      'UC-ORD-03',
      'hủy lần hai',
      (await api('post', `/orders/${order.id}/cancel`, c.token, { reason: 'Không cần nữa' })).status,
      409,
    );
    // PAY-01 / PAY-03: đơn của người khác, đơn COD
    expectStatus(
      'UC-PAY-01',
      'checkout đơn của người khác',
      (await api('post', `/payments/${order.id}/checkout`, other.token, {})).status,
      404,
    );
    expectStatus(
      'UC-PAY-03',
      'retry đơn của người khác',
      (await api('post', `/payments/${order.id}/retry`, other.token, { method: 'vnpay' })).status,
      404,
    );
    expectStatus(
      'UC-PAY-03',
      'retry đơn đã hủy',
      (await api('post', `/payments/${order.id}/retry`, c.token, { method: 'vnpay' })).status,
      [400, 409],
    );
    flush();
  });

  it('nhóm đánh giá & yêu thích: UC-REV-01/02, UC-ACC-06', async () => {
    const c = await customer('rev');
    const slugRow = await prisma.product.findFirstOrThrow({
      where: { status: 'published', deletedAt: null },
      orderBy: { id: 'asc' },
    });
    expectStatus(
      'UC-REV-01',
      'rating=0',
      (await api('get', `/products/${slugRow.slug}/reviews?rating=0`)).status,
      [200, 400],
    );
    expectStatus(
      'UC-REV-01',
      'rating=6',
      (await api('get', `/products/${slugRow.slug}/reviews?rating=6`)).status,
      [200, 400],
    );
    expectStatus(
      'UC-REV-01',
      'sản phẩm không tồn tại',
      (await api('get', '/products/khong-co-san-pham/reviews')).status,
      404,
    );
    expectStatus(
      'UC-REV-02',
      'chưa đăng nhập',
      (await api('post', `/products/${slugRow.slug}/reviews`, undefined, { orderId: 1, rating: 5 })).status,
      401,
    );
    expectStatus(
      'UC-REV-02',
      'rating 0',
      (await api('post', `/products/${slugRow.slug}/reviews`, c.token, { orderId: 1, rating: 0 })).status,
      400,
    );
    expectStatus(
      'UC-REV-02',
      'rating 6',
      (await api('post', `/products/${slugRow.slug}/reviews`, c.token, { orderId: 1, rating: 6 })).status,
      400,
    );
    expectStatus(
      'UC-REV-02',
      'content 2001 ký tự',
      (
        await api('post', `/products/${slugRow.slug}/reviews`, c.token, {
          orderId: 1,
          rating: 5,
          content: 'x'.repeat(2001),
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-REV-02',
      'đơn không thuộc user/không completed',
      (
        await api('post', `/products/${slugRow.slug}/reviews`, c.token, {
          orderId: 1,
          rating: 5,
          content: 'x'.repeat(30),
        })
      ).status,
      [403, 404, 409, 400],
    );
    expectStatus('UC-ACC-06', 'chưa đăng nhập', (await api('get', '/wishlist')).status, 401);
    flush();
  });

  it('nhóm quản trị 1: UC-ADM-01/03/05/06/08/09/12/18/19', async () => {
    // ADM-01
    const u = await customer('adm01');
    expectStatus(
      'UC-ADM-01',
      'status ngoài enum',
      (await api('patch', `/admin/users/${u.id}/status`, admin, { status: 'khong-co' })).status,
      400,
    );
    expectStatus(
      'UC-ADM-01',
      'user không tồn tại',
      (await api('patch', '/admin/users/999999999/status', admin, { status: 'banned' })).status,
      404,
    );
    expectStatus(
      'UC-ADM-01',
      'khách gọi API quản trị',
      (await api('patch', `/admin/users/${u.id}/status`, u.token, { status: 'banned' })).status,
      403,
    );
    const adminId = (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id;
    expectStatus(
      'UC-ADM-01',
      'admin tự khóa mình',
      (await api('patch', `/admin/users/${adminId}/status`, admin, { status: 'banned' })).status,
      409,
    );
    expectStatus(
      'UC-ADM-01',
      'lý do 501 ký tự',
      (
        await api('patch', `/admin/users/${u.id}/status`, admin, {
          status: 'suspended',
          reason: 'x'.repeat(501),
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-ADM-01',
      'khóa hợp lệ',
      (await api('patch', `/admin/users/${u.id}/status`, admin, { status: 'suspended' })).status,
      200,
    );
    expectStatus(
      'UC-ADM-01',
      'tài khoản bị khóa không dùng được token cũ',
      (await api('get', '/users/me', u.token)).status,
      [401, 403],
    );
    // ADM-03
    expectStatus(
      'UC-ADM-03',
      'khóa không hợp lệ',
      (await api('put', '/admin/settings/khoa_khong_co', admin, { value: 'x' })).status,
      400,
    );
    expectStatus(
      'UC-ADM-03',
      'khách ghi cài đặt',
      (
        await api('put', '/admin/settings/default_shipping_fee', (await customer('adm03')).token, {
          value: 10,
        })
      ).status,
      403,
    );
    // ADM-05 danh mục
    const slug = `dm-dac-${tag}`;
    const cat = await api('post', '/admin/categories', admin, { name: `Danh mục DAC ${tag}`, slug });
    expectStatus('UC-ADM-05', 'tạo danh mục', cat.status, 201);
    expectStatus(
      'UC-ADM-05',
      'slug trùng',
      (await api('post', '/admin/categories', admin, { name: 'Khác', slug })).status,
      409,
    );
    expectStatus(
      'UC-ADM-05',
      'tên 151 ký tự',
      (await api('post', '/admin/categories', admin, { name: 'x'.repeat(151) })).status,
      400,
    );
    const catId = cat.body.data?.id as number;
    const child = await api('post', '/admin/categories', admin, {
      name: `Con DAC ${tag}`,
      slug: `con-${slug}`,
      parentId: catId,
    });
    expectStatus('UC-ADM-05', 'tạo danh mục con', child.status, 201);
    expectStatus(
      'UC-ADM-05',
      'parentId tạo vòng lặp (cha → con)',
      (await api('patch', `/admin/categories/${catId}`, admin, { parentId: child.body.data?.id })).status,
      400,
    );
    expectStatus(
      'UC-ADM-05',
      'parentId = chính nó',
      (await api('patch', `/admin/categories/${catId}`, admin, { parentId: catId })).status,
      400,
    );
    expectStatus(
      'UC-ADM-05',
      'xóa danh mục còn con',
      (await api('delete', `/admin/categories/${catId}`, admin)).status,
      409,
    );
    expectStatus(
      'UC-ADM-05',
      'xóa danh mục con',
      (await api('delete', `/admin/categories/${child.body.data?.id}`, admin)).status,
      200,
    );
    expectStatus(
      'UC-ADM-05',
      'xóa danh mục',
      (await api('delete', `/admin/categories/${catId}`, admin)).status,
      200,
    );
    // ADM-06 thương hiệu
    const bslug = `th-dac-${tag}`;
    expectStatus(
      'UC-ADM-06',
      'tạo thương hiệu',
      (await api('post', '/admin/brands', admin, { name: `TH DAC ${tag}`, slug: bslug })).status,
      201,
    );
    expectStatus(
      'UC-ADM-06',
      'slug trùng',
      (await api('post', '/admin/brands', admin, { name: 'Khác', slug: bslug })).status,
      409,
    );
    expectStatus(
      'UC-ADM-06',
      'tên 151 ký tự',
      (await api('post', '/admin/brands', admin, { name: 'x'.repeat(151) })).status,
      400,
    );
    // ADM-08 thuộc tính
    const acode = `thuoctinh${String(Date.now()).slice(-8)}`;
    expectStatus(
      'UC-ADM-08',
      'tạo thuộc tính',
      (await api('post', '/admin/attributes', admin, { code: acode, name: `Thuộc tính ${acode}` })).status,
      201,
    );
    expectStatus(
      'UC-ADM-08',
      'mã trùng',
      (await api('post', '/admin/attributes', admin, { code: acode, name: 'Khác tên' })).status,
      409,
    );
    expectStatus(
      'UC-ADM-08',
      'mã có chữ hoa',
      (await api('post', '/admin/attributes', admin, { code: 'ChuHoa', name: 'X' })).status,
      400,
    );
    expectStatus(
      'UC-ADM-08',
      'mã 51 ký tự',
      (await api('post', '/admin/attributes', admin, { code: 'a'.repeat(51), name: 'X' })).status,
      400,
    );
    expectStatus(
      'UC-ADM-08',
      'tên 101 ký tự',
      (await api('post', '/admin/attributes', admin, { code: `a${acode}`, name: 'x'.repeat(101) })).status,
      400,
    );
    // ADM-09 sản phẩm
    const baseProd = (over: Record<string, unknown> = {}) => ({
      name: `Sản phẩm DAC ${tag}-${++seq}`,
      categoryId: 3,
      status: 'draft',
      shortDescription: 'Mô tả ngắn',
      description: 'Mô tả',
      variants: [
        {
          color: { name: 'Kem', hex: '#E8DCC8' },
          size: '1m6',
          sku: `DAC-${tag}-${seq}`,
          price: 1_000_000,
          stockQuantity: 3,
        },
      ],
      ...over,
    });
    expectStatus(
      'UC-ADM-09',
      'tên 256 ký tự',
      (await api('post', '/admin/products', admin, baseProd({ name: 'x'.repeat(256) }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-09',
      'mô tả ngắn 501 ký tự',
      (await api('post', '/admin/products', admin, baseProd({ shortDescription: 'x'.repeat(501) }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-09',
      'danh mục không tồn tại',
      (await api('post', '/admin/products', admin, baseProd({ categoryId: 999999999 }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-09',
      'thương hiệu không tồn tại',
      (await api('post', '/admin/products', admin, baseProd({ brandId: 999999999 }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-09',
      'status ngoài enum',
      (await api('post', '/admin/products', admin, baseProd({ status: 'khong-co' }))).status,
      400,
    );
    const pr = await api('post', '/admin/products', admin, baseProd({ slug: `sp-dac-${tag}` }));
    expectStatus('UC-ADM-09', 'tạo sản phẩm (draft)', pr.status, 201);
    expectStatus(
      'UC-ADM-09',
      'slug 281 ký tự',
      (await api('post', '/admin/products', admin, baseProd({ slug: 'a'.repeat(281) }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-09',
      'đăng (published) khi chưa có ảnh đại diện',
      (await api('post', '/admin/products', admin, baseProd({ status: 'published' }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-09',
      'khách ghi sản phẩm',
      (await api('post', '/admin/products', (await customer('adm09')).token, baseProd())).status,
      403,
    );
    // ADM-12 kho
    const v = await stockVariant(5);
    expectStatus(
      'UC-ADM-12',
      'quantityChange = 0',
      (
        await api('post', '/admin/inventory/movements', admin, {
          variantId: v.id,
          type: 'adjustment',
          quantityChange: 0,
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-ADM-12',
      'điều chỉnh âm làm tồn < 0',
      (
        await api('post', '/admin/inventory/movements', admin, {
          variantId: v.id,
          type: 'adjustment',
          quantityChange: -(v.stockQuantity + 1000),
        })
      ).status,
      409,
    );
    expectStatus(
      'UC-ADM-12',
      'biến thể không tồn tại',
      (
        await api('post', '/admin/inventory/movements', admin, {
          variantId: 999999999,
          type: 'adjustment',
          quantityChange: 1,
        })
      ).status,
      [400, 404],
    );
    expectStatus(
      'UC-ADM-12',
      'type ngoài enum',
      (
        await api('post', '/admin/inventory/movements', admin, {
          variantId: v.id,
          type: 'khong-co',
          quantityChange: 1,
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-ADM-12',
      'lý do 256 ký tự',
      (
        await api('post', '/admin/inventory/movements', admin, {
          variantId: v.id,
          type: 'adjustment',
          quantityChange: 1,
          reason: 'x'.repeat(256),
        })
      ).status,
      400,
    );
    // ADM-18
    expectStatus(
      'UC-ADM-18',
      'đánh giá không tồn tại',
      (await api('patch', '/admin/reviews/999999999/status', admin, { status: 'approved' })).status,
      404,
    );
    expectStatus(
      'UC-ADM-18',
      'status ngoài enum',
      (await api('patch', '/admin/reviews/1/status', admin, { status: 'khong-co' })).status,
      [400, 404],
    );
    // ADM-19
    const cc = (over: Record<string, unknown> = {}) => ({
      name: 'Mã DAC',
      code: `DAC${tag}${++seq}`,
      kind: 'percent',
      value: 10,
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2099-01-01T00:00:00Z',
      ...over,
    });
    const c1 = await api('post', '/admin/coupons', admin, cc());
    expectStatus('UC-ADM-19', 'tạo mã', c1.status, 201);
    expectStatus(
      'UC-ADM-19',
      'mã trùng',
      (await api('post', '/admin/coupons', admin, cc({ code: c1.body.data?.code }))).status,
      409,
    );
    expectStatus(
      'UC-ADM-19',
      'percent > 100',
      (await api('post', '/admin/coupons', admin, cc({ value: 101 }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-19',
      'value ≤ 0',
      (await api('post', '/admin/coupons', admin, cc({ value: 0 }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-19',
      'startsAt ≥ endsAt',
      (
        await api(
          'post',
          '/admin/coupons',
          admin,
          cc({ startsAt: '2099-01-02T00:00:00Z', endsAt: '2099-01-01T00:00:00Z' }),
        )
      ).status,
      400,
    );
    expectStatus(
      'UC-ADM-19',
      'code 51 ký tự',
      (await api('post', '/admin/coupons', admin, cc({ code: 'A'.repeat(51) }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-19',
      'usageLimit ≤ 0',
      (await api('post', '/admin/coupons', admin, cc({ usageLimit: 0 }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-19',
      'maxDiscount âm',
      (await api('post', '/admin/coupons', admin, cc({ maxDiscount: -1 }))).status,
      400,
    );
    flush();
  });

  it('nhóm quản trị 2: UC-ADM-20/21/22/23/25, UC-SPACE-01/02/04', async () => {
    const c = await customer('adm2x');
    const v = await stockVariant();
    const a = (await api('post', '/addresses', c.token, addr())).body.data;
    await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 1 });
    const o = (await api('post', '/orders', c.token, { addressId: a.id, paymentMethod: 'cod' })).body.data;
    expectStatus(
      'UC-ADM-20',
      'đơn không tồn tại',
      (await api('get', '/admin/orders/ALV-00000000-0000', admin)).status,
      404,
    );
    expectStatus(
      'UC-ADM-20',
      'khách xem danh sách quản trị',
      (await api('get', '/admin/orders', c.token)).status,
      403,
    );
    expectStatus(
      'UC-ADM-20',
      'status sai trong bộ lọc',
      (await api('get', '/admin/orders?status=khong-co', admin)).status,
      [200, 400],
    );
    const to = (st: string, extra: object = {}) =>
      api('patch', `/admin/orders/${o.id}/status`, admin, { status: st, ...extra });
    expectStatus('UC-ADM-21', 'pending → shipping', (await to('shipping')).status, [400, 409]);
    expectStatus('UC-ADM-21', 'completed trực tiếp', (await to('completed')).status, 409);
    expectStatus('UC-ADM-21', 'status ngoài enum', (await to('khong-co')).status, [400, 409]);
    expectStatus(
      'UC-ADM-21',
      'note 501 ký tự',
      (await to('confirmed', { note: 'x'.repeat(501) })).status,
      400,
    );
    expectStatus('UC-ADM-21', 'pending → confirmed', (await to('confirmed')).status, 200);
    expectStatus(
      'UC-ADM-23',
      'hoàn tiền đơn chưa thanh toán',
      (await api('post', `/admin/orders/${o.id}/refund`, admin)).status,
      409,
    );
    expectStatus(
      'UC-ADM-22',
      'lý do 4 ký tự',
      (await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'abcd' })).status,
      400,
    );
    expectStatus(
      'UC-ADM-22',
      'lý do 501 ký tự',
      (await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'x'.repeat(501) })).status,
      400,
    );
    expectStatus(
      'UC-ADM-22',
      'thiếu lý do',
      (await api('post', `/admin/orders/${o.id}/cancel`, admin, {})).status,
      400,
    );
    expectStatus(
      'UC-ADM-22',
      'hủy hợp lệ',
      (await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'Khách yêu cầu hủy' })).status,
      200,
    );
    expectStatus(
      'UC-ADM-22',
      'hủy hai lần',
      (await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'Khách yêu cầu hủy' })).status,
      409,
    );
    expectStatus('UC-ADM-21', 'đơn đã hủy không đổi được', (await to('processing')).status, 409);
    expectStatus(
      'UC-ADM-25',
      'tạo vận đơn cho đơn đã hủy',
      (await api('post', `/admin/orders/${o.id}/shipments`, admin, { carrier: 'ghn' })).status,
      409,
    );
    expectStatus(
      'UC-ADM-25',
      'carrier sai',
      (await api('post', `/admin/orders/${o.id}/shipments`, admin, { carrier: 'dhl' })).status,
      400,
    );
    expectStatus(
      'UC-SPACE-01',
      'roomType không thuộc enum',
      (await api('get', '/spaces?roomType=khong-co')).status,
      400,
    );
    expectStatus(
      'UC-SPACE-01',
      'không có kết quả',
      (await api('get', '/spaces?q=zzzzzkhongcokqnao')).status,
      200,
    );
    expectStatus(
      'UC-SPACE-02',
      'không gian không tồn tại',
      (await api('get', '/spaces/khong-co-khong-gian')).status,
      404,
    );
    expectStatus(
      'UC-SPACE-04',
      'chưa đăng nhập',
      (await api('put', '/spaces/khong-co/bookmark')).status,
      401,
    );
    flush();
  });

  it('nhóm 3: UC-ORD-01 (nhánh lỗi), UC-PAY-01/03, UC-CAT-04/05', async () => {
    const c = await customer('g3');
    const other = await customer('g3-o');
    const v = await stockVariant();
    const mine = (await api('post', '/addresses', c.token, addr())).body.data;
    const theirs = (await api('post', '/addresses', other.token, addr())).body.data;
    await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 1 });
    // ORD-01: địa chỉ không thuộc user / không tồn tại → 404 (DAC ngoại lệ); thiếu địa chỉ → 400 theo trường (D-N30)
    expectStatus(
      'UC-ORD-01',
      'địa chỉ của người khác',
      (await api('post', '/orders', c.token, { addressId: theirs.id, paymentMethod: 'cod' })).status,
      404,
    );
    expectStatus(
      'UC-ORD-01',
      'địa chỉ không tồn tại',
      (await api('post', '/orders', c.token, { addressId: 999999999, paymentMethod: 'cod' })).status,
      404,
    );
    expectStatus(
      'UC-ORD-01',
      'thiếu addressId',
      (await api('post', '/orders', c.token, { paymentMethod: 'cod' })).status,
      400,
    );
    // ORD-01 4a: dòng không còn bán ⇒ 409, không tạo đơn, giỏ không đổi
    const before = await prisma.order.count({ where: { userId: c.id } });
    await prisma.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
    try {
      const r = await api('post', '/orders', c.token, { addressId: mine.id, paymentMethod: 'cod' });
      expectStatus('UC-ORD-01', 'dòng không còn bán', r.status, 409);
    } finally {
      await prisma.productVariant.update({ where: { id: v.id }, data: { isActive: true } });
    }
    if ((await prisma.order.count({ where: { userId: c.id } })) !== before)
      issues.push('UC-ORD-01: đặt hàng lỗi không được tạo đơn');
    if ((await api('get', '/cart', c.token)).body.data.items.length !== 1)
      issues.push('UC-ORD-01: giỏ phải giữ nguyên khi đặt hàng lỗi');
    // PAY-01 / PAY-03
    const o = (await api('post', '/orders', c.token, { addressId: mine.id, paymentMethod: 'cod' })).body.data;
    // COD không đi qua cổng: giao diện vẫn gọi checkout nên API trả thẳng trang thành công, KHÔNG tạo giao dịch online (mở rộng đã ghi ở CHUAN_MO_RONG)
    const codCheckout = await api('post', `/payments/${o.id}/checkout`, c.token, {});
    expectStatus('UC-PAY-01', 'checkout đơn COD', codCheckout.status, 200);
    if (!String(codCheckout.body.data?.redirectUrl).startsWith('/checkout/success'))
      issues.push('UC-PAY-01: đơn COD phải chuyển thẳng tới /checkout/success');
    if ((await prisma.payment.findFirstOrThrow({ where: { orderId: o.id } })).method !== 'cod')
      issues.push('UC-PAY-01: đơn COD không được đổi phương thức');
    expectStatus(
      'UC-PAY-01',
      'chưa đăng nhập',
      (await api('post', `/payments/${o.id}/checkout`, undefined, {})).status,
      401,
    );
    await api('post', `/orders/${o.id}/cancel`, c.token, { reason: 'Không cần nữa' });
    expectStatus(
      'UC-PAY-03',
      'retry đơn đã hủy',
      (await api('post', `/payments/${o.id}/retry`, c.token, { method: 'vnpay' })).status,
      409,
    );
    await api('post', '/cart/items', c.token, { variantId: v.id, quantity: 1 });
    const o2 = (await api('post', '/orders', c.token, { addressId: mine.id, paymentMethod: 'vnpay' })).body
      .data;
    await prisma.order.update({ where: { id: o2.id }, data: { paymentStatus: 'paid' } });
    expectStatus(
      'UC-PAY-03',
      'retry đơn đã thanh toán',
      (await api('post', `/payments/${o2.id}/retry`, c.token, { method: 'vnpay' })).status,
      409,
    );
    expectStatus(
      'UC-PAY-01',
      'checkout đơn đã thanh toán',
      (await api('post', `/payments/${o2.id}/checkout`, c.token, {})).status,
      409,
    );
    // CAT-04 / CAT-05: sản phẩm nháp và trang nháp ⇒ 404
    const draft = await prisma.product.findFirstOrThrow({
      where: { status: 'published', deletedAt: null },
      orderBy: { id: 'desc' },
    });
    await prisma.product.update({ where: { id: draft.id }, data: { status: 'draft' } });
    await app.get(CatalogCache).invalidateCatalog();
    try {
      expectStatus('UC-CAT-04', 'sản phẩm nháp', (await api('get', `/products/${draft.slug}`)).status, 404);
    } finally {
      await prisma.product.update({ where: { id: draft.id }, data: { status: 'published' } });
      await app.get(CatalogCache).invalidateCatalog();
    }
    expectStatus(
      'UC-CAT-04',
      'sản phẩm bị xóa mềm',
      (
        await (async () => {
          const p = await prisma.product.findFirstOrThrow({
            where: { status: 'published', deletedAt: null },
            orderBy: { id: 'desc' },
          });
          await prisma.product.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
          await app.get(CatalogCache).invalidateCatalog();
          try {
            return await api('get', `/products/${p.slug}`);
          } finally {
            await prisma.product.update({ where: { id: p.id }, data: { deletedAt: null } });
            await app.get(CatalogCache).invalidateCatalog();
          }
        })()
      ).status,
      404,
    );
    const page = await prisma.page.findFirst({ where: { status: 'published' } });
    if (page) {
      await prisma.page.update({ where: { id: page.id }, data: { status: 'draft' } });
      try {
        expectStatus('UC-CAT-05', 'trang nháp', (await api('get', `/pages/${page.slug}`)).status, 404);
      } finally {
        await prisma.page.update({ where: { id: page.id }, data: { status: 'published' } });
      }
    }
    expectStatus('UC-CAT-05', 'trang không tồn tại', (await api('get', '/pages/khong-co-trang')).status, 404);
    flush();
  });

  it('nhóm 4: UC-ADM-07/15/16/26/27/28, UC-SPACE-06', async () => {
    // ADM-07 trang tĩnh
    const pslug = `trang-dac-${tag}`;
    const page = (over: Record<string, unknown> = {}) => ({
      title: `Trang DAC ${tag}`,
      slug: pslug,
      content: 'Nội dung',
      status: 'published',
      type: 'policy',
      ...over,
    });
    expectStatus('UC-ADM-07', 'tạo trang', (await api('post', '/admin/pages', admin, page())).status, 201);
    expectStatus('UC-ADM-07', 'slug trùng', (await api('post', '/admin/pages', admin, page())).status, 409);
    expectStatus(
      'UC-ADM-07',
      'title 256 ký tự',
      (await api('post', '/admin/pages', admin, page({ slug: `${pslug}-2`, title: 'x'.repeat(256) }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-07',
      'thiếu title',
      (await api('post', '/admin/pages', admin, page({ slug: `${pslug}-3`, title: '' }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-07',
      'status ngoài enum',
      (await api('post', '/admin/pages', admin, page({ slug: `${pslug}-4`, status: 'khong-co' }))).status,
      400,
    );
    expectStatus(
      'UC-ADM-07',
      'khách ghi trang',
      (await api('post', '/admin/pages', (await customer('adm07')).token, page({ slug: `${pslug}-5` })))
        .status,
      403,
    );
    // ADM-15 không gian
    expectStatus(
      'UC-ADM-15',
      'thiếu title',
      (await api('post', '/admin/spaces', admin, { roomType: 'living_room', status: 'draft' })).status,
      400,
    );
    expectStatus(
      'UC-ADM-15',
      'title 256 ký tự',
      (
        await api('post', '/admin/spaces', admin, {
          title: 'x'.repeat(256),
          roomType: 'living_room',
          status: 'draft',
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-ADM-15',
      'roomType ngoài enum',
      (
        await api('post', '/admin/spaces', admin, {
          title: `Không gian DAC ${tag}`,
          roomType: 'khong-co',
          status: 'draft',
        })
      ).status,
      400,
    );
    expectStatus(
      'UC-ADM-15',
      'đăng khi chưa có ảnh 360°',
      (
        await api('post', '/admin/spaces', admin, {
          title: `Không gian DAC ${tag}`,
          roomType: 'living_room',
          status: 'published',
        })
      ).status,
      400,
    );
    const sp = await api('post', '/admin/spaces', admin, {
      title: `Không gian DAC ${tag}`,
      slug: `kg-dac-${tag}`,
      roomType: 'living_room',
      status: 'draft',
    });
    expectStatus('UC-ADM-15', 'tạo không gian nháp', sp.status, 201);
    expectStatus(
      'UC-ADM-15',
      'slug trùng',
      (
        await api('post', '/admin/spaces', admin, {
          title: 'Khác',
          slug: `kg-dac-${tag}`,
          roomType: 'living_room',
          status: 'draft',
        })
      ).status,
      409,
    );
    expectStatus(
      'UC-ADM-15',
      'không gian không tồn tại',
      (await api('get', '/admin/spaces/999999999', admin)).status,
      404,
    );
    // SPACE-06: ghi lượt xem không gian chưa đăng / không có
    expectStatus(
      'UC-SPACE-06',
      'không gian không tồn tại',
      (
        await api('post', '/spaces/khong-co-khong-gian/views', undefined, {
          visitorId: '8a1c1f3e-0b1e-4c8c-9d3b-2f6f7c9a1b11',
        })
      ).status,
      404,
    );
    expectStatus(
      'UC-SPACE-06',
      'không gian nháp',
      (
        await api('post', `/spaces/kg-dac-${tag}/views`, undefined, {
          visitorId: '8a1c1f3e-0b1e-4c8c-9d3b-2f6f7c9a1b11',
        })
      ).status,
      404,
    );
    // ADM-26 thông báo
    const u = await customer('adm26');
    expectStatus(
      'UC-ADM-26',
      'thiếu tiêu đề',
      (await api('post', '/admin/notifications', admin, { content: 'x', userIds: [u.id] })).status,
      400,
    );
    expectStatus(
      'UC-ADM-26',
      'thiếu nội dung',
      (await api('post', '/admin/notifications', admin, { title: 'x', userIds: [u.id] })).status,
      400,
    );
    expectStatus(
      'UC-ADM-26',
      'khách gửi thông báo',
      (await api('post', '/admin/notifications', u.token, { title: 'x', content: 'y', userIds: [u.id] }))
        .status,
      403,
    );
    expectStatus(
      'UC-ADM-26',
      'gửi hợp lệ',
      (
        await api('post', '/admin/notifications', admin, {
          title: `TB DAC ${tag}`,
          content: 'Nội dung',
          userIds: [u.id],
        })
      ).status,
      201,
    );
    // ADM-27 nhật ký, ADM-28 thống kê
    expectStatus(
      'UC-ADM-27',
      'khách xem nhật ký',
      (await api('get', '/admin/activity-logs', u.token)).status,
      403,
    );
    expectStatus(
      'UC-ADM-27',
      'xem nhật ký',
      (await api('get', '/admin/activity-logs?pageSize=5', admin)).status,
      200,
    );
    expectStatus(
      'UC-ADM-28',
      'khách xem thống kê',
      (await api('get', '/admin/stats/overview', u.token)).status,
      403,
    );
    expectStatus('UC-ADM-28', 'tổng quan', (await api('get', '/admin/stats/overview', admin)).status, 200);
    expectStatus(
      'UC-ADM-28',
      'from > to',
      (await api('get', '/admin/stats/finance?from=2026-12-31&to=2026-01-01', admin)).status,
      [200, 400],
    );
    flush();
  });
});
