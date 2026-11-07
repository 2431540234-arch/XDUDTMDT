// E2E (supertest) Mốc 2 trên DB aurelia_test đã seed từ mock-data:
// phân quyền admin, luồng đặt hàng → admin chuyển trạng thái (giữ/trừ/trả tồn kho), chống bán vượt khi đặt đồng thời,
// mã đơn không trùng, 6 module admin (dashboard, sản phẩm + 360°, danh mục, đơn, khách hàng, khuyến mãi), khóa tài khoản,
// đánh giá có kiểm duyệt.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { MAIL_SERVICE, type MailMessage } from '../src/mail/mail.service';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Mốc 2 – admin vận hành + đặt hàng (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  const outbox: MailMessage[] = []; // thư đã "gửi" (MAIL_SERVICE thay bằng bản ghi nhớ, không cần Mailpit)

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
  const userToken = async (userId: number) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return login(u.email, '123456');
  };

  beforeAll(async () => {
    // an toàn: chỉ chạy trên aurelia_test
    const [{ db, users }] = await prisma.$queryRaw<
      Array<{ db: string; users: bigint }>
    >`SELECT current_database() AS db, (SELECT count(*) FROM users) AS users`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    if (Number(users) < 30)
      throw new Error('aurelia_test chưa seed: chạy node scripts/db-reset.mjs aurelia_test');

    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_SERVICE)
      .useValue({
        send: async (m: MailMessage) => {
          outbox.push(m);
        },
      })
      .compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  // ------------------------------------------------------------ phân quyền
  describe('phân quyền', () => {
    const adminPaths = [
      '/admin/stats/overview',
      '/admin/products',
      '/admin/products/1',
      '/admin/products/1/360',
      '/admin/categories',
      '/admin/orders',
      '/admin/orders/counts',
      '/admin/users',
      '/admin/users/2',
      '/admin/coupons',
      '/admin/notifications',
      '/admin/search?q=a',
    ];
    it.each(adminPaths)('khách gọi GET %s ⇒ 403', async (p) => {
      const r = await api('get', p, cust);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    });
    it('không token ⇒ 401', async () => {
      expect((await api('get', '/admin/orders')).status).toBe(401);
    });
    it('khách ghi vào admin ⇒ 403', async () => {
      expect((await api('post', '/admin/categories', cust, { name: 'x' })).status).toBe(403);
      expect((await api('patch', '/admin/orders/1/status', cust, { status: 'confirmed' })).status).toBe(403);
    });
    it('khách không xem được đơn của người khác (404)', async () => {
      const other = await prisma.order.findFirstOrThrow({ where: { userId: { not: 2 } } });
      const r = await api('get', `/orders/${other.orderCode}`, cust);
      expect(r.status).toBe(404);
    });
  });

  // ------------------------------------------------------------ tồn kho + máy trạng thái
  describe('đặt hàng → xử lý đơn → tồn kho', () => {
    let variantId = 0;
    let addressId = 0;
    let orderId = 0;
    const snap = async () => prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const sold = async () =>
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: (await snap()).productId },
          select: { soldCount: true },
        })
      ).soldCount;

    let shipmentId = 0;
    it('chuẩn bị: chọn biến thể còn nhiều hàng', async () => {
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gte: 12 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
      });
      variantId = v.id;
      addressId = (await prisma.address.findFirstOrThrow({ where: { userId: 2, isDefault: true } })).id;
      await api('delete', '/cart', cust);
    });

    it('tạo đơn COD ⇒ trừ tồn ngay (stock −= qty) và ghi movement "sale"', async () => {
      const before = await snap();
      const soldBefore = await sold();
      expect((await api('post', '/cart/items', cust, { variantId, quantity: 2 })).status).toBe(201);
      const r = await api('post', '/orders', cust, { addressId, paymentMethod: 'cod' });
      expect(await sold()).toBe(soldBefore); // sold_count chưa tăng lúc đặt hàng
      expect(r.status).toBe(201);
      expect(r.body.data.orderCode).toMatch(/^ALV-\d{8}-\d{4}$/);
      expect(r.body.data.status).toBe('pending');
      orderId = r.body.data.id;
      const after = await snap();
      expect(after.stockQuantity).toBe(before.stockQuantity - 2);
      const mv = await prisma.inventoryMovement.findFirst({
        where: { variantId, type: 'sale', referenceCode: r.body.data.orderCode },
      });
      expect(mv?.quantityChange).toBe(-2);
    });

    it('chặn chuyển sai thứ tự ⇒ 409', async () => {
      for (const to of ['shipping', 'completed', 'processing']) {
        const r = await api('patch', `/admin/orders/${orderId}/status`, admin, { status: to });
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe('INVALID_STATE');
      }
    });

    it('pending → confirmed → processing: chưa trừ kho', async () => {
      const before = await snap();
      expect(
        (await api('patch', `/admin/orders/${orderId}/status`, admin, { status: 'confirmed' })).body.data
          .status,
      ).toBe('confirmed');
      expect(
        (await api('patch', `/admin/orders/${orderId}/status`, admin, { status: 'processing' })).body.data
          .status,
      ).toBe('processing');
      const after = await snap();
      expect(after.stockQuantity).toBe(before.stockQuantity);
    });

    it('sang shipping: bắt buộc đã có vận đơn (chưa có ⇒ 400, không tự tạo); có rồi ⇒ tồn không đổi, không thêm movement', async () => {
      const before = await snap();
      const none = await api('patch', `/admin/orders/${orderId}/status`, admin, { status: 'shipping' });
      expect(none.status).toBe(400);
      expect(none.body.error.message).toContain('Cần tạo vận đơn');
      expect(await prisma.shipment.count({ where: { orderId } })).toBe(0); // không tự tạo vận đơn
      const sh = await api('post', `/admin/orders/${orderId}/shipments`, admin, {
        carrier: 'ghtk',
        trackingCode: 'GHTK-E2E-1',
        fee: 25000,
      });
      expect(sh.status).toBe(201);
      expect(sh.body.data.shipment).toMatchObject({
        carrier: 'ghtk',
        status: 'pending',
        trackingCode: 'GHTK-E2E-1',
      });
      shipmentId = sh.body.data.shipment.id;
      const r = await api('patch', `/admin/orders/${orderId}/status`, admin, { status: 'shipping' });
      expect(r.status).toBe(200);
      expect(r.body.data.shipment.status).toBe('pending');
      expect((await snap()).stockQuantity).toBe(before.stockQuantity);
      expect(
        await prisma.inventoryMovement.count({
          where: { variantId, type: 'sale', referenceCode: r.body.data.orderCode },
        }),
      ).toBe(1);
    });

    it('khách không hủy được đơn đang giao; admin cũng không', async () => {
      expect((await api('post', `/orders/${orderId}/cancel`, cust, {})).status).toBe(409);
      expect((await api('post', `/admin/orders/${orderId}/cancel`, admin, { reason: 'x' })).status).toBe(409);
    });

    it('admin KHÔNG đặt đơn completed trực tiếp (409); đơn tự hoàn tất khi vận đơn delivered: sold_count, COD đã thanh toán, lịch sử, thông báo', async () => {
      const direct = await api('patch', `/admin/orders/${orderId}/status`, admin, { status: 'completed' });
      expect(direct.status).toBe(409);
      expect(direct.body.error.message).toBe('Hoàn tất khi vận đơn được đánh dấu đã giao.');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('shipping');

      const notiBefore = await prisma.notification.count({ where: { userId: 2 } });
      const soldBefore = await sold();
      for (const s of ['picked_up', 'in_transit']) {
        expect((await api('patch', `/admin/shipments/${shipmentId}`, admin, { status: s })).status).toBe(200);
      }
      const r = await api('patch', `/admin/shipments/${shipmentId}`, admin, { status: 'delivered' });
      expect(r.status).toBe(200);
      expect(r.body.data.shipment.status).toBe('delivered');
      expect(r.body.data.shipment.deliveredAt).toBeTruthy();
      expect(r.body.data.shipment.shippedAt).toBeTruthy();
      expect(r.body.data.order.status).toBe('completed');
      expect(await sold()).toBe(soldBefore + 2);
      expect(r.body.data.order.paymentStatus).toBe('paid');
      expect(r.body.data.order.payment.status).toBe('success');
      expect(r.body.data.order.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'pending',
        'confirmed',
        'processing',
        'shipping',
        'completed',
      ]);
      const last = r.body.data.order.history[4];
      expect(last.note).toBe('Giao hàng thành công');
      expect(last.actorName).toBe('Admin');
      // thông báo: "đã bàn giao" (picked_up) + "đã giao thành công" (delivered)
      expect(await prisma.notification.count({ where: { userId: 2 } })).toBe(notiBefore + 2);
      expect(
        (await api('patch', `/admin/orders/${orderId}/status`, admin, { status: 'shipping' })).status,
      ).toBe(409);
    });

    it('khách hủy đơn pending ⇒ cộng lại tồn và ghi movement "return"', async () => {
      const before = await snap();
      await api('post', '/cart/items', cust, { variantId, quantity: 3 });
      const o = await api('post', '/orders', cust, { addressId, paymentMethod: 'cod' });
      expect((await snap()).stockQuantity).toBe(before.stockQuantity - 3);
      const soldBefore = await sold();
      const c = await api('post', `/orders/${o.body.data.id}/cancel`, cust, { reason: 'đổi ý' });
      expect(c.status).toBe(200);
      expect(await sold()).toBe(soldBefore); // đơn hủy không làm đổi sold_count
      expect(c.body.data.status).toBe('cancelled');
      const after = await snap();
      expect(after.stockQuantity).toBe(before.stockQuantity);
      expect(
        await prisma.inventoryMovement.count({
          where: { variantId, type: 'return', referenceCode: c.body.data.orderCode },
        }),
      ).toBe(1);
    });

    it('admin hủy đơn đang processing ⇒ cộng lại tồn; khách chỉ hủy được pending/confirmed', async () => {
      const before = await snap();
      await api('post', '/cart/items', cust, { variantId, quantity: 1 });
      const o = await api('post', '/orders', cust, { addressId, paymentMethod: 'cod' });
      await api('patch', `/admin/orders/${o.body.data.id}/status`, admin, { status: 'confirmed' });
      await api('patch', `/admin/orders/${o.body.data.id}/status`, admin, { status: 'processing' });
      expect((await api('post', `/orders/${o.body.data.id}/cancel`, cust, {})).status).toBe(409);
      expect(
        (await api('post', `/admin/orders/${o.body.data.id}/cancel`, admin, { reason: 'hết hàng' })).status,
      ).toBe(200);
      expect((await snap()).stockQuantity).toBe(before.stockQuantity);
    });

    it('đơn vượt tồn khả dụng ⇒ 409 OUT_OF_STOCK', async () => {
      const v = await snap();
      const r = await api('post', '/cart/items', cust, {
        variantId,
        quantity: v.stockQuantity + 1,
      });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('OUT_OF_STOCK');
    });
  });

  // ------------------------------------------------------------ đồng thời
  describe('đặt hàng đồng thời', () => {
    it('hai khách cùng giành 1 sản phẩm cuối ⇒ đúng 1 đơn thành công, không bán vượt', async () => {
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gte: 5 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'desc' },
      });
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { stockQuantity: 1 },
      }); // còn đúng 1
      const users = await prisma.user.findMany({ where: { id: { in: [3, 4] }, status: 'active' } });
      const tokens = await Promise.all(users.map((u) => userToken(u.id)));
      const addrs = await Promise.all(
        users.map((u) => prisma.address.findFirstOrThrow({ where: { userId: u.id } })),
      );
      for (const t of tokens) {
        await api('delete', '/cart', t);
        expect((await api('post', '/cart/items', t, { variantId: v.id, quantity: 1 })).status).toBe(201);
      }
      const results = await Promise.all(
        tokens.map((t, i) => api('post', '/orders', t, { addressId: addrs[i].id, paymentMethod: 'cod' })),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      const fail = results.find((r) => r.status === 409)!;
      expect(fail.body.error.code).toBe('OUT_OF_STOCK');
      const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: v.id } });
      expect(after.stockQuantity).toBe(0);
    });

    it('nhiều đơn đồng thời ⇒ mã đơn không trùng', async () => {
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gte: 12 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
      });
      const users = await prisma.user.findMany({
        where: { id: { in: [5, 6, 7, 8, 9, 10] }, status: 'active' },
      });
      const tokens = await Promise.all(users.map((u) => userToken(u.id)));
      const addrs = await Promise.all(
        users.map((u) => prisma.address.findFirstOrThrow({ where: { userId: u.id } })),
      );
      for (const t of tokens) {
        await api('delete', '/cart', t);
        await api('post', '/cart/items', t, { variantId: v.id, quantity: 1 });
      }
      const results = await Promise.all(
        tokens.map((t, i) => api('post', '/orders', t, { addressId: addrs[i].id, paymentMethod: 'cod' })),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      const codes = results.map((r) => r.body.data.orderCode as string);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  // ------------------------------------------------------------ admin: dashboard
  describe('dashboard', () => {
    it('KPI, doanh thu theo ngày, tỉ lệ trạng thái, bán chạy, hoạt động', async () => {
      const r = await api('get', '/admin/stats/overview?from=2026-10-01&to=2026-11-30', admin);
      expect(r.status).toBe(200);
      const d = r.body.data;
      expect(d.totalOrders).toBeGreaterThan(0);
      expect(d.revenue).toBeGreaterThan(0);
      expect(d.deltas).toEqual(
        expect.objectContaining({
          orders: expect.any(Number),
          revenue: expect.any(Number),
          customers: expect.any(Number),
          products: expect.any(Number),
        }),
      );
      expect(d.revenueSeries.length).toBe(61);
      expect(d.statusBreakdown.map((s: { status: string }) => s.status)).toEqual([
        'pending',
        'confirmed',
        'processing',
        'shipping',
        'completed',
        'cancelled',
        'refunded',
      ]);
      expect(d.statusBreakdown.reduce((s: number, x: { count: number }) => s + x.count, 0)).toBe(
        d.totalOrders,
      );
      expect(d.recentOrders.length).toBe(5);
      expect(d.recentOrders[0].customer).toBeTruthy();
      expect(d.topProducts.length).toBeGreaterThan(0);
      expect(d.recentActivity.length).toBeGreaterThan(0);
      const sum = d.revenueSeries.reduce((s: number, x: { revenue: number }) => s + x.revenue, 0);
      expect(sum).toBe(d.revenue);
    });
  });

  // ------------------------------------------------------------ admin: sản phẩm + 360°
  describe('sản phẩm', () => {
    let pid = 0;
    let slug = '';
    const body = {
      name: 'Ghế e2e',
      sku: 'E2E-001',
      categoryId: 3,
      status: 'published',
      price: 1_500_000,
      stock: 10,
      shortDescription: 'Mô tả ngắn',
      description: 'Mô tả',
      material: 'Gỗ',
      images: [{ url: PNG, isPrimary: true }],
      specs: [{ label: 'Chất liệu', value: 'Gỗ' }],
      features: ['Bền'],
      variants: [
        {
          color: { name: 'Kem', hex: '#E8DCC8' },
          size: '1m6',
          sku: 'E2E-001-K',
          price: 1_500_000,
          salePrice: 1_200_000,
          stockQuantity: 8,
          costPrice: 700_000,
          minStock: 3,
        },
        {
          color: { name: 'Đen', hex: '#2B2B2B' },
          size: '1m6',
          sku: 'E2E-001-D',
          price: 1_500_000,
          stockQuantity: 0,
        },
      ],
    };

    it('thêm sản phẩm đủ biến thể/ảnh/thông số; slug tự sinh; SKU unique', async () => {
      const r = await api('post', '/admin/products', admin, body);
      expect(r.status).toBe(201);
      pid = r.body.data.id;
      slug = r.body.data.slug;
      expect(slug).toBe('ghe-e2e');
      expect(r.body.data.variants).toHaveLength(2);
      expect(r.body.data.images).toHaveLength(1);
      const dup = await api('post', '/admin/products', admin, { ...body, name: 'Ghế khác' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.details.fields).toContain('sku');
    });

    it('validation tiếng Việt theo từng trường; ảnh giả mạo bị từ chối (415)', async () => {
      const r = await api('post', '/admin/products', admin, { name: 'A' });
      expect(r.status).toBe(400);
      expect(r.body.error.details.name[0]).toBe('Vui lòng nhập tên sản phẩm.');
      const bad = await api('post', '/admin/products', admin, {
        ...body,
        name: 'Ghế giả',
        sku: 'E2E-009',
        variants: [],
        images: [{ url: 'data:image/png;base64,bm90IGFuIGltYWdl' }],
      });
      expect(bad.status).toBe(415);
    });

    it('sửa: tồn nhập trực tiếp vào stock_quantity và ghi movement adjustment; biến thể bỏ đi bị ngừng bán', async () => {
      const cur = (await api('get', `/admin/products/${pid}`, admin)).body.data;
      const keep = cur.variants[0];
      const r = await api('patch', `/admin/products/${pid}`, admin, {
        ...body,
        name: 'Ghế e2e (sửa)',
        images: cur.images.map((i: { url: string; isPrimary: boolean }) => ({
          url: i.url,
          isPrimary: i.isPrimary,
        })),
        variants: [
          {
            id: keep.id,
            color: { name: 'Kem', hex: '#E8DCC8' },
            size: '1m6',
            sku: 'E2E-001-K',
            price: 1_500_000,
            salePrice: null,
            stockQuantity: 20,
          },
        ],
      });
      expect(r.status).toBe(200);
      const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: keep.id } });
      expect(v.stockQuantity).toBe(20);
      expect(
        await prisma.inventoryMovement.count({
          where: { variantId: keep.id, type: 'adjustment', referenceCode: 'E2E-001-K' },
        }),
      ).toBe(1);
      const other = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'E2E-001-D' } });
      expect(other.isActive).toBe(false);
      expect(r.body.data.images).toHaveLength(1); // gửi lại URL ⇒ không tạo ảnh mới
    });

    it('tab Ảnh 360°: lưu frame theo màu, công khai xem được; bật mà <2 ảnh bị chặn', async () => {
      const ok = await api('put', `/admin/products/${pid}/360`, admin, {
        enabled: true,
        autoRotate: true,
        colors: [{ name: 'Kem', hex: '#E8DCC8', frames: [PNG, PNG, PNG] }],
      });
      expect(ok.status).toBe(200);
      expect(ok.body.data.frameCount).toBe(3);
      const pub = await api('get', `/products/${slug}/360`);
      expect(pub.status).toBe(200);
      expect(pub.body.data.colors[0].frames).toHaveLength(3);
      const bad = await api('put', `/admin/products/${pid}/360`, admin, {
        enabled: true,
        colors: [{ name: 'Kem', hex: '#E8DCC8', frames: [PNG] }],
      });
      expect(bad.status).toBe(400);
      const get = await api('get', `/admin/products/${pid}/360`, admin);
      expect(get.body.data.colors[0].frames).toHaveLength(3);
      expect(get.body.data.variantColors.map((c: { name: string }) => c.name)).toContain('Kem');
    });

    it('xóa: chưa có trong đơn ⇒ xóa mềm; đã có trong đơn ⇒ chuyển "ngừng bán"', async () => {
      expect((await api('delete', `/admin/products/${pid}`, admin)).status).toBe(200);
      expect((await api('get', `/products/${slug}`)).status).toBe(404);
      expect((await api('get', `/admin/products/${pid}`, admin)).status).toBe(404);
      // chọn CỐ ĐỊNH (id lớn nhất đã có trong đơn): findFirst không có orderBy trả hàng theo thứ tự vật lý nên có lúc chọn trúng
      // sản phẩm mà test khác dùng (sofa-luxury) và làm các test sau 404
      const inOrder = await prisma.product.findFirstOrThrow({
        where: { deletedAt: null, productVariants: { some: { orderItems: { some: {} } } } },
        orderBy: { id: 'desc' },
      });
      expect((await api('delete', `/admin/products/${inOrder.id}`, admin)).status).toBe(200);
      const after = await prisma.product.findUniqueOrThrow({ where: { id: inOrder.id } });
      expect(after.status).toBe('archived');
      expect(after.deletedAt).toBeNull();
      expect((await api('get', `/products/${inOrder.slug}`)).status).toBe(404);
    });

    it('danh sách: lọc/tìm không dấu/phân trang', async () => {
      const r = await api('get', '/admin/products?q=ban%20tra&pageSize=2', admin);
      expect(r.status).toBe(200);
      expect(r.body.meta.pageSize).toBe(2);
      expect(r.body.data.every((p: { name: string }) => /bàn trà/i.test(p.name))).toBe(true);
    });
  });

  // ------------------------------------------------------------ admin: danh mục
  describe('danh mục', () => {
    it('tạo, slug unique tự sinh, 2 cấp, chặn xóa khi còn sản phẩm/danh mục con', async () => {
      const parent = await api('post', '/admin/categories', admin, { name: 'Danh mục E2E' });
      expect(parent.status).toBe(201);
      expect(parent.body.data.slug).toBe('danh-muc-e2e');
      const child = await api('post', '/admin/categories', admin, {
        name: 'Con E2E',
        parentId: parent.body.data.id,
      });
      expect(child.status).toBe(201);
      expect(
        (await api('post', '/admin/categories', admin, { name: 'Cháu E2E', parentId: child.body.data.id }))
          .body.error.details.parentId[0],
      ).toBe('Chỉ hỗ trợ danh mục 2 cấp.');
      expect(
        (await api('post', '/admin/categories', admin, { name: 'Danh mục E2E' })).body.error.details.slug[0],
      ).toBe('Slug đã tồn tại.');
      const del1 = await api('delete', `/admin/categories/${parent.body.data.id}`, admin);
      expect(del1.status).toBe(409);
      expect(del1.body.error.code).toBe('RESOURCE_IN_USE');
      const withProducts = await prisma.product.findFirstOrThrow({
        where: { deletedAt: null, categoryId: { not: null } },
      });
      const del2 = await api('delete', `/admin/categories/${withProducts.categoryId}`, admin);
      expect(del2.status).toBe(409);
      expect((await api('delete', `/admin/categories/${child.body.data.id}`, admin)).status).toBe(200);
      expect((await api('delete', `/admin/categories/${parent.body.data.id}`, admin)).status).toBe(200);
    });
  });

  // ------------------------------------------------------------ admin: khuyến mãi
  describe('khuyến mãi', () => {
    const base = {
      name: 'Khuyến mãi e2e',
      kind: 'percent',
      value: 15,
      maxDiscount: 300_000,
      minOrderValue: 1_000_000,
      usageLimit: 5,
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2099-12-31T00:00:00Z',
    };
    let id = 0;

    it('tạo 3 loại + phạm vi; mã unique không phân biệt hoa thường', async () => {
      const a = await api('post', '/admin/coupons', admin, {
        ...base,
        code: 'e2e15',
        appliesTo: 'category',
        categoryIds: [2],
      });
      expect(a.status).toBe(201);
      id = a.body.data.id;
      expect(a.body.data.code).toBe('E2E15');
      expect(a.body.data.categoryIds).toEqual([2]);
      expect(
        (await api('post', '/admin/coupons', admin, { ...base, code: 'E2E15' })).body.error.details.code[0],
      ).toBe('Mã khuyến mãi đã tồn tại.');
      const f = await api('post', '/admin/coupons', admin, {
        name: 'Fixed',
        code: 'E2EFIX',
        kind: 'fixed',
        value: 200_000,
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2099-01-01T00:00:00Z',
        appliesTo: 'product',
        productIds: [1],
      });
      expect(f.status).toBe(201);
      expect(f.body.data.productIds).toEqual([1]);
      const s = await api('post', '/admin/coupons', admin, {
        name: 'Ship',
        code: 'E2ESHIP',
        kind: 'freeship',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2099-01-01T00:00:00Z',
      });
      expect(s.status).toBe(201);
      expect(s.body.data.kind).toBe('freeship');
      const sp = await api('post', '/admin/coupons', admin, {
        name: 'Space',
        code: 'E2ESPACE',
        kind: 'percent',
        value: 5,
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2099-01-01T00:00:00Z',
        appliesTo: 'space',
        spaceIds: [1],
      });
      expect(sp.body.data.spaceIds).toEqual([1]);
    });

    it('validation: % ngoài 1–100, ngày kết thúc trước ngày bắt đầu', async () => {
      const r = await api('post', '/admin/coupons', admin, { ...base, code: 'E2EBAD', value: 150 });
      expect(r.body.error.details.value[0]).toBe('Phần trăm giảm từ 1 đến 100.');
      const r2 = await api('post', '/admin/coupons', admin, {
        ...base,
        code: 'E2EBAD',
        endsAt: '2025-01-01T00:00:00Z',
      });
      expect(r2.body.error.details.endsAt[0]).toBe('Ngày kết thúc phải sau ngày bắt đầu.');
    });

    it('trạng thái theo thời gian + số lượng từng tab', async () => {
      await api('post', '/admin/coupons', admin, {
        ...base,
        code: 'E2EFUT',
        startsAt: '2098-01-01T00:00:00Z',
        endsAt: '2099-01-01T00:00:00Z',
      });
      const up = await api('get', '/admin/coupons?tab=upcoming&q=e2efut', admin);
      expect(up.body.data.map((c: { code: string }) => c.code)).toEqual(['E2EFUT']);
      expect(up.body.meta).toEqual(
        expect.objectContaining({
          all: expect.any(Number),
          active: expect.any(Number),
          upcoming: expect.any(Number),
          ended: expect.any(Number),
        }),
      );
      const ended = await api('patch', `/admin/coupons/${id}`, admin, { isActive: false });
      expect(ended.body.data.isActive).toBe(false);
      const list = await api('get', '/admin/coupons?tab=ended&q=e2e15', admin);
      expect(list.body.data).toHaveLength(1);
      await api('patch', `/admin/coupons/${id}`, admin, { isActive: true });
    });

    it('không giảm giới hạn lượt dưới số lượt đã dùng; mã đã dùng chỉ bị ngừng kích hoạt khi xóa', async () => {
      const used = await prisma.coupon.findFirstOrThrow({
        where: { usedCount: { gte: 2 }, usageLimit: { not: null } },
      });
      const r = await api('patch', `/admin/coupons/${used.id}`, admin, { usageLimit: used.usedCount - 1 });
      expect(r.status).toBe(400);
      expect(r.body.error.details.usageLimit[0]).toContain('số lượt đã dùng');
      const del = await api('delete', `/admin/coupons/${used.id}`, admin);
      expect(del.status).toBe(200);
      expect(del.body.data.isActive).toBe(false);
      expect((await api('delete', `/admin/coupons/${id}`, admin)).status).toBe(200);
      expect((await api('get', `/admin/coupons/${id}`, admin)).status).toBe(404);
    });

    it('áp mã trong giỏ khách: freeship giảm đúng phí ship; mã hết hạn bị từ chối', async () => {
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          price: { lt: 1_000_000 },
          stockQuantity: { gte: 10 },
          product: { status: 'published', deletedAt: null },
        },
      });
      await api('delete', '/cart', cust);
      await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 });
      const ok = await api('post', '/cart/coupon', cust, { code: 'e2eship' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.discountAmount).toBe(ok.body.data.shippingFee);
      expect(ok.body.data.total).toBe(ok.body.data.subtotal);
      await api('delete', '/cart', cust);
    });
  });

  // ------------------------------------------------------------ admin: khách hàng
  describe('khách hàng', () => {
    it('danh sách lọc/tìm; chi tiết đủ KPI, địa chỉ, hoạt động', async () => {
      const r = await api('get', '/admin/users?q=tran%20thu&pageSize=5', admin);
      expect(r.status).toBe(200);
      expect(r.body.data.some((u: { email: string }) => u.email === 'khachhang@aurelia.vn')).toBe(true);
      const d = await api('get', '/admin/users/2', admin);
      expect(d.body.data).toEqual(
        expect.objectContaining({
          totalOrders: expect.any(Number),
          totalSpent: expect.any(Number),
          customerGroup: expect.any(String),
        }),
      );
      expect(d.body.data.addresses.length).toBeGreaterThan(0);
      expect((await api('get', '/admin/users/1', admin)).status).toBe(404); // admin không phải khách hàng
    });

    it('ghi chú nội bộ lưu được', async () => {
      const r = await api('patch', '/admin/users/3', admin, { adminNote: 'Khách VIP' });
      expect(r.body.data.adminNote).toBe('Khách VIP');
    });

    it('khóa tài khoản ⇒ thu hồi phiên, chặn đăng nhập và token cũ (thông báo tiếng Việt); mở khóa ⇒ đăng nhập lại', async () => {
      const u = await prisma.user.findUniqueOrThrow({ where: { id: 11 } });
      const token = await login(u.email, '123456');
      const refresh = (await api('post', '/auth/login', undefined, { email: u.email, password: '123456' }))
        .body.data.tokens.refreshToken as string;
      expect((await api('get', '/users/me', token)).status).toBe(200);
      const lock = await api('patch', `/admin/users/${u.id}/status`, admin, { status: 'suspended' });
      expect(lock.body.data.status).toBe('suspended');
      const me = await api('get', '/users/me', token);
      expect(me.status).toBe(403);
      expect(me.body.error.code).toBe('AUTH_ACCOUNT_LOCKED');
      const lg = await api('post', '/auth/login', undefined, { email: u.email, password: '123456' });
      expect(lg.status).toBe(403);
      expect(lg.body.error.message).toContain('bị khóa');
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: refresh })).status).toBe(401);
      expect(await prisma.userSession.count({ where: { userId: u.id, revokedAt: null } })).toBe(0);
      await api('patch', `/admin/users/${u.id}/status`, admin, { status: 'active' });
      expect(
        (await api('post', '/auth/login', undefined, { email: u.email, password: '123456' })).status,
      ).toBe(200);
    });

    it('tạo khách hàng; email trùng ⇒ 409', async () => {
      const r = await api('post', '/admin/users', admin, {
        fullName: 'Khách E2E',
        email: 'e2e.khach@example.com',
        phone: '0900000099',
      });
      expect(r.status).toBe(201);
      expect(
        (
          await api('post', '/admin/users', admin, {
            fullName: 'Khách E2E',
            email: 'E2E.khach@example.com',
            phone: '0900000099',
          })
        ).status,
      ).toBe(409);
    });
  });

  // ------------------------------------------------------------ admin: đơn hàng (danh sách, vận đơn, hoàn tiền, hóa đơn)
  describe('đơn hàng (admin)', () => {
    it('danh sách theo tab trạng thái + số lượng từng tab + lọc ngày/thanh toán/tìm kiếm', async () => {
      const counts = (await api('get', '/admin/orders/counts', admin)).body.data as Record<string, number>;
      const { all, ...byStatus } = counts;
      expect(all).toBe(Object.values(byStatus).reduce((s, x) => s + x, 0));
      const pending = await api('get', '/admin/orders?status=pending', admin);
      expect(pending.body.meta.total).toBe(counts.pending);
      expect(pending.body.data.every((o: { status: string }) => o.status === 'pending')).toBe(true);
      const byDate = await api('get', '/admin/orders?from=2026-10-01&to=2026-10-31&pageSize=100', admin);
      expect(
        byDate.body.data.every(
          (o: { createdAt: string }) =>
            o.createdAt >= '2026-09-30T17:00:00' && o.createdAt <= '2026-10-31T17:00:00',
        ),
      ).toBe(true);
      const search = await api('get', '/admin/orders?q=tran%20thu%20ha&pageSize=100', admin);
      expect(search.body.data.length).toBeGreaterThan(0);
      expect(
        search.body.data.every(
          (o: { customer: { fullName: string } }) => o.customer.fullName === 'Trần Thu Hà',
        ),
      ).toBe(true);
    });

    it('vận đơn, ghi chú nội bộ, hóa đơn, xác nhận thanh toán chuyển khoản', async () => {
      const addr = await prisma.address.findFirstOrThrow({ where: { userId: 2, isDefault: true } });
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gte: 12 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
      });
      await api('delete', '/cart', cust);
      await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 });
      const o = (await api('post', '/orders', cust, { addressId: addr.id, paymentMethod: 'bank_transfer' }))
        .body.data;
      // vận đơn (UC-ADM-25): chỉ tạo khi đơn đã processing; đơn pending ⇒ 409
      const early = await api('post', `/admin/orders/${o.id}/shipments`, admin, { carrier: 'ghtk' });
      expect(early.status).toBe(409);
      for (const st of ['confirmed', 'processing'])
        expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: st })).status).toBe(200);
      expect((await api('post', `/admin/orders/${o.id}/shipments`, admin, { carrier: 'xyz' })).status).toBe(
        400,
      );
      const sh = await api('post', `/admin/orders/${o.id}/shipments`, admin, {
        carrier: 'ghtk',
        trackingCode: 'E2E123',
      });
      expect(sh.status).toBe(201);
      expect(sh.body.data.shipment.trackingCode).toBe('E2E123');
      expect(
        (await api('patch', `/admin/orders/${o.id}/note`, admin, { note: 'gọi trước' })).body.data
          .internalNote,
      ).toBe('gọi trước');
      const inv = await api('get', `/admin/orders/${o.orderCode}/invoice`, admin);
      expect(inv.body.data.order.orderCode).toBe(o.orderCode);
      expect(inv.body.data.store.name).toBeTruthy();
      const paid = await api('patch', `/admin/payments/${o.payment.id}/confirm`, admin);
      expect(paid.body.data.paymentStatus).toBe('paid');
      expect(paid.body.data.status).toBe('processing'); // đơn đã processing thì giữ nguyên (chỉ pending → confirmed)
      expect((await api('patch', `/admin/payments/${o.payment.id}/confirm`, admin)).status).toBe(409);
      // hoàn tiền đơn đã hủy đã thanh toán ⇒ phiếu chi + trạng thái refunded
      await api('post', `/admin/orders/${o.id}/cancel`, admin, { reason: 'test' });
      const rf = await api('post', `/admin/orders/${o.id}/refund`, admin);
      expect(rf.body.data.status).toBe('refunded');
      expect(await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } })).toBe(1);
    });
  });

  // ------------------------------------------------------------ đánh giá có kiểm duyệt
  // ------------------------------------------------------------ quên / đặt lại mật khẩu bằng liên kết (D-T29)
  describe('quên mật khẩu bằng liên kết có token', () => {
    const email = `reset-${Date.now()}@example.com`;
    const tokenOf = (m: MailMessage) => /token=([0-9a-f]{64})/.exec(m.text ?? '')?.[1] ?? '';
    let firstToken = '';
    let refresh = '';

    it('email không tồn tại ⇒ vẫn trả sent:true nhưng KHÔNG gửi thư (không lộ tài khoản)', async () => {
      const before = outbox.length;
      const r = await api('post', '/auth/forgot-password', undefined, {
        email: 'khong-co-nguoi-nay@example.com',
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({ sent: true });
      expect(outbox.length).toBe(before);
      expect((await api('post', '/auth/forgot-password', undefined, { email: 'sai' })).status).toBe(400);
    });

    it('gửi liên kết có token 256 bit (DB chỉ lưu bản băm); gửi lại trong 60 giây ⇒ 429', async () => {
      const reg = await api('post', '/auth/register', undefined, {
        fullName: 'Khách Reset',
        email,
        phone: '0987654321',
        password: 'matkhau-cu-1',
      });
      expect(reg.status).toBe(201);
      refresh = reg.body.data.tokens.refreshToken;
      const before = outbox.length;
      expect((await api('post', '/auth/forgot-password', undefined, { email })).status).toBe(200);
      expect(outbox.length).toBe(before + 1);
      const mail = outbox[outbox.length - 1];
      expect(mail.to).toBe(email);
      firstToken = tokenOf(mail);
      expect(firstToken).toMatch(/^[0-9a-f]{64}$/);
      expect(mail.html).toContain('/reset-password?token=' + firstToken);
      const rows = await prisma.passwordReset.findMany({ where: { user: { email } } });
      expect(rows.some((x) => x.tokenHash === firstToken)).toBe(false);
      const again = await api('post', '/auth/forgot-password', undefined, { email });
      expect(again.status).toBe(429);
      expect(again.body.error.code).toBe('RATE_LIMITED');
    });

    it('token sai/ngắn ⇒ 400; mật khẩu mới < 8 ký tự ⇒ 400', async () => {
      const bad = await api('post', '/auth/reset-password', undefined, {
        token: 'f'.repeat(64),
        password: 'matkhau-moi-2',
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error.message).toMatch(/không đúng hoặc đã hết hạn/);
      const short = await api('post', '/auth/reset-password', undefined, {
        token: 'abc',
        password: 'matkhau-moi-2',
      });
      expect(short.status).toBe(400);
      const weak = await api('post', '/auth/reset-password', undefined, {
        token: firstToken,
        password: '123',
      });
      expect(weak.status).toBe(400);
    });

    it('token hết hạn ⇒ 400; gửi lại sau 60 giây thì token cũ bị vô hiệu, token mới dùng được một lần', async () => {
      await prisma.passwordReset.updateMany({
        where: { user: { email } },
        data: { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 120_000) },
      });
      const expired = await api('post', '/auth/reset-password', undefined, {
        token: firstToken,
        password: 'matkhau-moi-2',
      });
      expect(expired.status).toBe(400);
      expect((await api('post', '/auth/forgot-password', undefined, { email })).status).toBe(200);
      const t2 = tokenOf(outbox[outbox.length - 1]);
      expect(t2).not.toBe(firstToken);
      const ok = await api('post', '/auth/reset-password', undefined, {
        token: t2,
        password: 'matkhau-moi-2',
      });
      expect(ok.status).toBe(200);
      // mật khẩu mới đăng nhập được, mật khẩu cũ thì không; phiên cũ bị thu hồi; dùng lại token ⇒ 400
      expect((await api('post', '/auth/login', undefined, { email, password: 'matkhau-moi-2' })).status).toBe(
        200,
      );
      expect((await api('post', '/auth/login', undefined, { email, password: 'matkhau-cu-1' })).status).toBe(
        401,
      );
      expect((await api('post', '/auth/refresh', undefined, { refreshToken: refresh })).status).toBe(401);
      const reuse = await api('post', '/auth/reset-password', undefined, {
        token: t2,
        password: 'matkhau-khac-3',
      });
      expect(reuse.status).toBe(400);
    });
  });

  // ------------------------------------------------------------ xác thực email (UC-AUTH-07)
  describe('xác thực email (JWT verify_email)', () => {
    const email = `verify-${Date.now()}@example.com`;
    let token = '';
    let access = '';
    const linkToken = (m: MailMessage) => /token=([\w.-]+)/.exec(m.text ?? '')?.[1] ?? '';
    const reviewBody = (orderId: number) => ({
      orderId,
      rating: 5,
      content: 'Sản phẩm rất tốt, giao hàng nhanh và đóng gói cẩn thận.',
    });

    it('đăng ký ⇒ gửi email xác thực, tài khoản chưa xác thực', async () => {
      const before = outbox.length;
      const reg = await api('post', '/auth/register', undefined, {
        fullName: 'Khách Xác Thực',
        email,
        phone: '0911222333',
        password: 'matkhau-12345',
      });
      expect(reg.status).toBe(201);
      access = reg.body.data.tokens.accessToken;
      expect(outbox.length).toBe(before + 1);
      token = linkToken(outbox[outbox.length - 1]);
      expect(token.split('.')).toHaveLength(3);
      expect((await prisma.user.findFirstOrThrow({ where: { email } })).emailVerifiedAt).toBeNull();
    });

    it('chưa xác thực ⇒ đánh giá bị chặn 403 EMAIL_NOT_VERIFIED (kiểm tra trước khi xét đã mua)', async () => {
      const p = await prisma.product.findFirstOrThrow({ where: { status: 'published', deletedAt: null } });
      const r = await api('post', `/products/${p.slug}/reviews`, access, reviewBody(1));
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('token sai, token khác mục đích (access token) hoặc thiếu ⇒ 400', async () => {
      expect((await api('post', '/auth/verify-email', undefined, { token: 'abc' })).status).toBe(400);
      expect((await api('post', '/auth/verify-email', undefined, { token: access })).status).toBe(400);
      expect((await api('post', '/auth/verify-email', undefined, {})).status).toBe(400);
    });

    it('gửi lại email (có giới hạn 60 giây), rồi xác thực bằng liên kết ⇒ đã xác thực; xác thực lại vẫn 200', async () => {
      const first = await api('post', '/auth/resend-verification', access);
      expect(first.status).toBe(200);
      expect(first.body.data).toEqual({ sent: true, verified: false });
      expect((await api('post', '/auth/resend-verification', access)).status).toBe(429);
      expect((await api('post', '/auth/resend-verification')).status).toBe(401);

      const ok = await api('post', '/auth/verify-email', undefined, { token });
      expect(ok.status).toBe(200);
      expect(ok.body.data).toEqual({ verified: true });
      expect((await prisma.user.findFirstOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
      expect((await api('post', '/auth/verify-email', undefined, { token })).status).toBe(200);
      const again = await api('post', '/auth/resend-verification', access);
      expect(again.body.data).toEqual({ sent: false, verified: true });
    });

    it('đã xác thực ⇒ qua bước email, chỉ còn bị chặn vì chưa mua hàng (PURCHASE_REQUIRED)', async () => {
      const p = await prisma.product.findFirstOrThrow({ where: { status: 'published', deletedAt: null } });
      const r = await api('post', `/products/${p.slug}/reviews`, access, reviewBody(1));
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('PURCHASE_REQUIRED');
    });

    it('đổi email sau khi nhận liên kết ⇒ liên kết cũ vô hiệu', async () => {
      const e2 = `verify2-${Date.now()}@example.com`;
      await api('post', '/auth/register', undefined, {
        fullName: 'Khách Đổi Email',
        email: e2,
        phone: '0911222444',
        password: 'matkhau-12345',
      });
      const t = linkToken(outbox[outbox.length - 1]);
      await prisma.user.updateMany({ where: { email: e2 }, data: { email: `moi-${e2}` } });
      expect((await api('post', '/auth/verify-email', undefined, { token: t })).status).toBe(400);
    });
  });

  // ------------------------------------------------------------ thanh toán giả lập: khách không tự chọn kết quả
  describe('thanh toán online (giả lập)', () => {
    it('body outcome bị bỏ qua: gửi outcome=success cho đơn có [fail] vẫn thất bại; đơn thường thành công ⇒ confirmed/paid', async () => {
      const v = await prisma.productVariant.findFirstOrThrow({
        where: {
          isActive: true,
          stockQuantity: { gte: 12 },
          product: { status: 'published', deletedAt: null },
        },
        orderBy: { id: 'asc' },
      });
      const addr = (await prisma.address.findFirstOrThrow({ where: { userId: 2, isDefault: true } })).id;
      const place = async (note: string) => {
        await api('delete', '/cart', cust);
        await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 });
        const r = await api('post', '/orders', cust, { addressId: addr, paymentMethod: 'vnpay', note });
        expect(r.status).toBe(201);
        return r.body.data.id as number;
      };
      const failing = await place('thử nghiệm [fail]');
      const f1 = await api('post', `/payments/${failing}/checkout`, cust, { outcome: 'success' });
      expect(f1.status).toBe(200);
      expect(f1.body.data.redirectUrl).toContain('/checkout/failed');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: failing } })).paymentStatus).toBe('failed');

      const good = await place('');
      const g1 = await api('post', `/payments/${good}/checkout`, cust, { outcome: 'failed' });
      expect(g1.body.data.redirectUrl).toContain('/checkout/success');
      const row = await prisma.order.findUniqueOrThrow({ where: { id: good } });
      expect(row.paymentStatus).toBe('paid');
      expect(row.status).toBe('confirmed');
      expect((await api('post', `/payments/${good}/checkout`, cust, {})).status).toBe(409); // đã thanh toán
    });
  });

  describe('đánh giá (có kiểm duyệt)', () => {
    it('đánh giá mới ở trạng thái pending: không hiện công khai, không đổi điểm; khách vẫn thấy ở "Đánh giá của tôi"', async () => {
      const item = await prisma.orderItem.findFirstOrThrow({
        where: { order: { userId: 2, status: 'completed' }, variant: { isNot: null } },
        include: { variant: true, order: true },
      });
      const reviewed = await prisma.review.findMany({
        where: { orderId: item.orderId },
        select: { productId: true },
      });
      const candidates = await prisma.orderItem.findMany({
        where: { order: { userId: 2, status: 'completed' }, variant: { isNot: null } },
        include: { variant: true },
      });
      const target = candidates.find((c) => !reviewed.some((r) => r.productId === c.variant!.productId));
      if (!target) return; // dữ liệu mẫu đã đánh giá hết: bỏ qua
      const prod = await prisma.product.findUniqueOrThrow({ where: { id: target.variant!.productId } });
      const ratingBefore = prod.ratingCount;
      const r = await api('post', `/products/${prod.slug}/reviews`, cust, {
        orderId: target.orderId,
        rating: 5,
        content: 'Sản phẩm rất tốt, giao hàng nhanh, đóng gói cẩn thận.',
      });
      if (r.status === 409) return; // đã đánh giá ở đơn này
      expect(r.status).toBe(201);
      expect(r.body.data.status).toBe('pending');
      const pub = await api('get', `/products/${prod.slug}/reviews?pageSize=100`);
      expect(pub.body.data.some((x: { id: number }) => x.id === r.body.data.id)).toBe(false);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: prod.id } })).ratingCount).toBe(
        ratingBefore,
      );
      const mine = await api('get', '/reviews/me', cust);
      expect(mine.body.data.find((x: { id: number }) => x.id === r.body.data.id)?.status).toBe('pending');
      // sửa đánh giá ⇒ về pending
      const upd = await api('patch', `/reviews/${r.body.data.id}`, cust, {
        rating: 4,
        content: 'Đã dùng một thời gian, vẫn rất hài lòng với chất lượng.',
      });
      expect(upd.body.data.status).toBe('pending');
    });
  });
});
