// E2E (supertest) Mốc 3 trên aurelia_test: đánh giá có kiểm duyệt,
// thông báo, nội dung (FAQ), không gian mẫu (+ thêm cả bộ vào giỏ), mô hình 3D (upload an toàn),
// phân quyền (khách gọi /admin/* ⇒ 403, không đụng dữ liệu người khác).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Mốc 3 – tương tác khách hàng & nội dung (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';

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
  const tokenOf = async (userId: number) =>
    login((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).email, '123456');

  /** Đặt hàng COD của khách và đẩy tới completed (giao hôm nay); trả về đơn */
  const completedOrder = async (token: string, userId: number, variantId: number, qty = 2) => {
    const addr = await prisma.address.findFirstOrThrow({ where: { userId }, orderBy: { isDefault: 'desc' } });
    await api('delete', '/cart', token);
    expect((await api('post', '/cart/items', token, { variantId, quantity: qty })).status).toBe(201);
    const o = (await api('post', '/orders', token, { addressId: addr.id, paymentMethod: 'cod' })).body.data;
    for (const s of ['confirmed', 'processing']) {
      expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: s })).status).toBe(200);
    }
    // UC-ADM-25: tạo vận đơn → Đang giao → vận đơn lấy hàng, vận chuyển, đã giao (đơn tự hoàn tất)
    const sh = await api('post', `/admin/orders/${o.id}/shipments`, admin, {
      carrier: 'ghn',
      trackingCode: `T${o.id}`,
    });
    expect(sh.status).toBe(201);
    expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: 'shipping' })).status).toBe(
      200,
    );
    for (const s of ['picked_up', 'in_transit', 'delivered']) {
      expect(
        (await api('patch', `/admin/shipments/${sh.body.data.shipment.id}`, admin, { status: s })).status,
      ).toBe(200);
    }
    return o as {
      id: number;
      orderCode: string;
      items: Array<{ id: number; productId: number; productSlug: string; variantId: number }>;
    };
  };
  const stockVariant = (minStock = 12) =>
    prisma.productVariant.findFirstOrThrow({
      where: {
        isActive: true,
        stockQuantity: { gte: minStock },
        product: { status: 'published', deletedAt: null },
      },
      orderBy: { id: 'desc' },
    });

  beforeAll(async () => {
    const [{ db, users }] = await prisma.$queryRaw<
      Array<{ db: string; users: bigint }>
    >`SELECT current_database() AS db, (SELECT count(*) FROM users) AS users`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    if (Number(users) < 30)
      throw new Error('aurelia_test chưa seed: chạy node scripts/db-reset.mjs aurelia_test');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
  describe('phân quyền Mốc 3', () => {
    const paths = ['/admin/reviews', '/admin/faq', '/admin/spaces', '/admin/spaces/1', '/admin/models'];
    it.each(paths)('khách gọi GET %s ⇒ 403', async (p) => {
      const r = await api('get', p, cust);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    });
    it('khách ghi vào admin ⇒ 403; không token ⇒ 401', async () => {
      expect((await api('patch', '/admin/reviews/1/status', cust, { status: 'approved' })).status).toBe(403);
      expect((await api('get', '/admin/reviews')).status).toBe(401);
    });
  });

  // ------------------------------------------------------------ đánh giá
  describe('đánh giá: đặt hàng → completed → đánh giá → admin duyệt → điểm đổi', () => {
    let slug = '';
    let productId = 0;
    let orderId = 0;
    let reviewId = 0;
    let before = { avg: 0, count: 0 };
    const rating = async () => {
      const p = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      return { avg: Number(p.ratingAvg), count: p.ratingCount };
    };
    const content = 'Sản phẩm rất tốt, giao hàng nhanh, đóng gói cẩn thận và đúng mô tả.';

    it('chuẩn bị: khách mua và nhận hàng', async () => {
      const v = await stockVariant();
      const o = await completedOrder(cust, 2, v.id, 1);
      orderId = o.id;
      slug = o.items[0].productSlug;
      productId = o.items[0].productId;
      before = await rating();
    });

    it('chỉ đánh giá được sản phẩm trong đơn đã giao của CHÍNH MÌNH; đơn người khác ⇒ 403 PURCHASE_REQUIRED', async () => {
      const other = await tokenOf(3);
      const r = await api('post', `/products/${slug}/reviews`, other, { orderId, rating: 5, content });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('PURCHASE_REQUIRED');
      // sản phẩm không có trong đơn
      const notIn = await prisma.product.findFirstOrThrow({
        where: { id: { not: productId }, status: 'published', deletedAt: null },
      });
      expect(
        (await api('post', `/products/${notIn.slug}/reviews`, cust, { orderId, rating: 5, content })).status,
      ).toBe(403);
      // đơn chưa completed
      const v = await stockVariant();
      await api('delete', '/cart', cust);
      await api('post', '/cart/items', cust, { variantId: v.id, quantity: 1 });
      const addr = await prisma.address.findFirstOrThrow({ where: { userId: 2 } });
      const pend = (await api('post', '/orders', cust, { addressId: addr.id, paymentMethod: 'cod' })).body
        .data;
      const slug2 = pend.items[0].productSlug;
      expect(
        (await api('post', `/products/${slug2}/reviews`, cust, { orderId: pend.id, rating: 5, content }))
          .status,
      ).toBe(403);
      await api('post', `/orders/${pend.id}/cancel`, cust, {});
    });

    it('validation: số sao, nội dung ≥ 20 ký tự', async () => {
      const bad = await api('post', `/products/${slug}/reviews`, cust, {
        orderId,
        rating: 9,
        content: 'ngắn',
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error.details.rating[0]).toBe('Vui lòng chọn số sao.');
      expect(bad.body.error.details.content[0]).toBe('Nội dung đánh giá tối thiểu 20 ký tự.');
    });

    it('đánh giá mới ở pending: không hiện công khai, điểm trung bình KHÔNG đổi', async () => {
      const r = await api('post', `/products/${slug}/reviews`, cust, {
        orderId,
        rating: 5,
        content,
      });
      expect(r.status).toBe(201);
      reviewId = r.body.data.id;
      expect(r.body.data.status).toBe('pending');
      expect(
        (await api('post', `/products/${slug}/reviews`, cust, { orderId, rating: 4, content })).status,
      ).toBe(409); // 1 đánh giá / sản phẩm / đơn
      const pub = await api('get', `/products/${slug}/reviews?pageSize=100`);
      expect(pub.body.data.some((x: { id: number }) => x.id === reviewId)).toBe(false);
      expect(await rating()).toEqual(before);
      const mine = await api('get', '/reviews/me', cust);
      expect(mine.body.data.find((x: { id: number }) => x.id === reviewId).status).toBe('pending');
    });

    it('admin: tab Chờ duyệt có đánh giá; duyệt ⇒ hiện công khai, điểm và số lượng cập nhật, khách nhận thông báo', async () => {
      const pending = await api('get', '/admin/reviews?status=pending&pageSize=100', admin);
      expect(pending.body.data.some((x: { id: number }) => x.id === reviewId)).toBe(true);
      expect(pending.body.data.every((x: { status: string }) => x.status === 'pending')).toBe(true);
      const notiBefore = await prisma.notification.count({ where: { userId: 2 } });
      const ok = await api('patch', `/admin/reviews/${reviewId}/status`, admin, { status: 'approved' });
      expect(ok.status).toBe(200);
      const after = await rating();
      expect(after.count).toBe(before.count + 1);
      const expectedAvg = (before.avg * before.count + 5) / (before.count + 1);
      expect(after.avg).toBeCloseTo(expectedAvg, 1);
      const pub = await api('get', `/products/${slug}/reviews?pageSize=100`);
      expect(pub.body.data.some((x: { id: number }) => x.id === reviewId)).toBe(true);
      expect(await prisma.notification.count({ where: { userId: 2 } })).toBe(notiBefore + 1);
      const n = (await api('get', '/notifications?type=system&pageSize=5', cust)).body.data[0];
      expect(n.title).toBe('Đánh giá của bạn đã được duyệt');
      // duyệt lại không gửi thông báo thừa
      await api('patch', `/admin/reviews/${reviewId}/status`, admin, { status: 'approved' });
      expect(await prisma.notification.count({ where: { userId: 2 } })).toBe(notiBefore + 1);
    });

    it('ẩn (rejected) ⇒ điểm trả về như cũ; hiện lại (approved) ⇒ tính lại; tab Ẩn/Đã duyệt lọc đúng', async () => {
      expect(
        (await api('patch', `/admin/reviews/${reviewId}/status`, admin, { status: 'rejected' })).body.data
          .status,
      ).toBe('rejected');
      expect(await rating()).toEqual(before);
      expect(
        (await api('get', `/products/${slug}/reviews?pageSize=100`)).body.data.some(
          (x: { id: number }) => x.id === reviewId,
        ),
      ).toBe(false);
      const hidden = await api('get', `/admin/reviews?status=rejected&productId=${productId}`, admin);
      expect(hidden.body.data.map((x: { id: number }) => x.id)).toContain(reviewId);
      await api('patch', `/admin/reviews/${reviewId}/status`, admin, { status: 'approved' });
      expect((await rating()).count).toBe(before.count + 1);
      const appr = await api(
        'get',
        `/admin/reviews?status=approved&productId=${productId}&pageSize=100`,
        admin,
      );
      expect(appr.body.data.every((x: { status: string }) => x.status === 'approved')).toBe(true);
      expect((await api('patch', `/admin/reviews/${reviewId}/status`, admin, { status: 'xyz' })).status).toBe(
        400,
      );
    });

    it('khách sửa đánh giá ⇒ về pending và điểm bỏ đánh giá đó; chỉ sửa được của chính mình', async () => {
      expect(
        (await api('patch', `/reviews/${reviewId}`, await tokenOf(3), { rating: 1, content })).status,
      ).toBe(404);
      const upd = await api('patch', `/reviews/${reviewId}`, cust, {
        rating: 4,
        content: 'Dùng một thời gian vẫn rất hài lòng, chất lượng đúng như mong đợi.',
      });
      expect(upd.body.data.status).toBe('pending');
      expect(await rating()).toEqual(before);
    });
  });

  describe('thông báo', () => {
    it('danh sách theo tab, số chưa đọc, đánh dấu từng cái / tất cả; chỉ của chính mình', async () => {
      const all = await api('get', '/notifications?pageSize=100', cust);
      expect(all.body.data.length).toBeGreaterThan(0);
      for (const type of ['order', 'promo', 'system']) {
        const r = await api('get', `/notifications?type=${type}&pageSize=100`, cust);
        expect(r.body.data.every((n: { data: { type: string } }) => n.data.type === type)).toBe(true);
      }
      const unread = (await api('get', '/notifications/unread-count', cust)).body.data.count as number;
      expect(unread).toBeGreaterThan(0);
      const first = all.body.data.find((n: { readAt: string | null }) => !n.readAt);
      expect((await api('patch', `/notifications/${first.id}/read`, cust)).body.data.readAt).toBeTruthy();
      expect((await api('get', '/notifications/unread-count', cust)).body.data.count).toBe(unread - 1);
      expect((await api('patch', `/notifications/${first.id}/read`, await tokenOf(3))).status).toBe(404);
      expect((await api('patch', '/notifications/read-all', cust)).status).toBe(200);
      expect((await api('get', '/notifications/unread-count', cust)).body.data.count).toBe(0);
    });

    it('chuông admin: đơn mới, đánh giá chờ duyệt', async () => {
      const r = await api('get', '/admin/notifications', admin);
      expect(r.status).toBe(200);
      const links = r.body.data.map((n: { link: string }) => n.link);
      expect(links.some((l: string) => l.startsWith('/admin/orders/'))).toBe(true);
    });
  });

  // ------------------------------------------------------------ nội dung
  describe('nội dung', () => {
    it('FAQ: CRUD cho admin, API công khai cho FE', async () => {
      // FAQ lưu trong settings: PUT thay toàn bộ, văn bản thuần (không tự sinh HTML)
      const before = (await api('get', '/faq')).body.data;
      expect(before.length).toBeGreaterThan(0);
      const put = await api('put', '/admin/faq', admin, {
        topics: [
          ...before,
          { label: 'Chủ đề e2e', items: [{ question: 'Câu hỏi e2e là gì?', answer: 'Trả lời <b>e2e</b>' }] },
        ],
      });
      expect(put.status).toBe(200);
      const pub = (await api('get', '/faq')).body.data.find(
        (x: { label: string }) => x.label === 'Chủ đề e2e',
      );
      expect(pub.key).toBe('chu-de-e2e');
      expect(pub.items[0].answer).toBe('Trả lời <b>e2e</b>'); // lưu nguyên văn, FE hiển thị có escape
      expect(
        (
          await api('put', '/admin/faq', admin, {
            topics: [{ label: 'x', items: [{ question: 'ngắn', answer: 'a' }] }],
          })
        ).status,
      ).toBe(400);
      expect((await api('put', '/admin/faq', admin, { topics: before })).status).toBe(200);
      expect((await api('get', '/faq')).body.data.length).toBe(before.length);
    });
  });

  // ------------------------------------------------------------ không gian mẫu
  describe('không gian mẫu', () => {
    let spaceId = 0;
    let slug = '';
    const prods: number[] = [];
    it('admin tạo đủ 5 tab: thông tin, ảnh 360°, hotspot, sản phẩm gợi ý, cài đặt hiển thị', async () => {
      const ps = await prisma.product.findMany({
        where: {
          status: 'published',
          deletedAt: null,
          productVariants: { some: { isActive: true, stockQuantity: { gte: 8 } } },
        },
        take: 3,
        orderBy: { id: 'asc' },
      });
      prods.push(...ps.map((p) => p.id));
      const body = {
        title: 'Không gian e2e',
        roomType: 'living_room',
        style: 'Hiện đại',
        description: 'Phòng khách hiện đại ấm cúng cho gia đình.',
        status: 'published',
        comboDiscountPercent: 20,
        coverUrl: PNG,
        panoramas: [
          {
            url: PNG,
            title: 'Ảnh 1',
            hotspots: [
              { type: 'product', yaw: 10, pitch: -5, productId: prods[0] },
              { type: 'navigation', yaw: 90, pitch: 0, targetIndex: 1 },
            ],
          },
          {
            url: PNG,
            title: 'Ảnh 2',
            hotspots: [{ type: 'product', yaw: -40, pitch: 5, productId: prods[1] }],
          },
        ],
        productIds: [prods[0], prods[1], prods[2]],
      };
      const r = await api('post', '/admin/spaces', admin, body);
      expect(r.status).toBe(201);
      spaceId = r.body.data.id;
      slug = r.body.data.slug;
      expect(slug).toBe('khong-gian-e2e');
      expect(r.body.data.panoramas).toHaveLength(2);
      expect(
        r.body.data.panoramas[0].hotspots.find((h: { type: string }) => h.type === 'navigation')
          .targetPanoramaId,
      ).toBe(r.body.data.panoramas[1].id);
      expect(r.body.data.products.map((p: { id: number }) => p.id).sort()).toEqual([...prods].sort());
      // giá combo tính ở server từ giá hiện tại và % giảm
      const orig = r.body.data.originalTotal;
      expect(r.body.data.comboDiscountPercent).toBe(20);
      expect(r.body.data.comboTotal).toBe(Math.round((orig * 0.8) / 1000) * 1000);
    });

    it('validation hotspot: sản phẩm không tồn tại, pitch/yaw sai, thiếu mô tả', async () => {
      const base = {
        title: 'Không gian lỗi',
        roomType: 'bedroom',
        description: 'Mô tả đủ dài để hợp lệ nhé',
      };
      const noProd = await api('post', '/admin/spaces', admin, {
        ...base,
        panoramas: [{ url: PNG, hotspots: [{ type: 'product', yaw: 0, pitch: 0, productId: 999999 }] }],
      });
      expect(noProd.status).toBe(400);
      const badAngle = await api('post', '/admin/spaces', admin, {
        ...base,
        panoramas: [{ url: PNG, hotspots: [{ type: 'product', yaw: 0, pitch: 120, productId: prods[0] }] }],
      });
      expect(badAngle.body.error.details['panoramas.0.hotspots.0.pitch'][0]).toContain('-90 đến 90');
      const short = await api('post', '/admin/spaces', admin, {
        title: 'A',
        roomType: 'bedroom',
        description: 'ngắn',
      });
      expect(short.body.error.details.title[0]).toBe('Vui lòng nhập tên không gian.');
      expect(short.body.error.details.description).toBeUndefined(); // mô tả là tuỳ chọn (DAC_TA UC-ADM-15)
    });

    it('API công khai: lọc phong cách/loại phòng, chi tiết theo slug; nháp không công khai', async () => {
      const list = await api(
        'get',
        '/spaces?roomType=living_room&style=Hi%E1%BB%87n%20%C4%91%E1%BA%A1i&pageSize=100',
      );
      expect(list.body.data.some((s: { slug: string }) => s.slug === slug)).toBe(true);
      expect((await api('get', `/spaces/${slug}`)).body.data.panoramas).toHaveLength(2);
      await api('patch', `/admin/spaces/${spaceId}`, admin, { status: 'draft' });
      expect((await api('get', `/spaces/${slug}`)).status).toBe(404);
      expect(
        (await api('get', '/spaces?pageSize=100')).body.data.some((s: { slug: string }) => s.slug === slug),
      ).toBe(false);
      await api('patch', `/admin/spaces/${spaceId}`, admin, { status: 'published' });
    });

    describe('tải ảnh lớn từng tệp (multipart) – trường hợp lớn nhất', () => {
      const MB = 1024 * 1024;
      const pngOf = (bytes: number) =>
        Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(bytes - 4, 7)]);
      const upload = (kind: string, buf: Buffer, mime = 'image/png', token = admin) =>
        http
          .post('/api/admin/media')
          .set('Authorization', `Bearer ${token}`)
          .field('kind', kind)
          .attach('file', buf, { filename: 'anh.png', contentType: mime });

      it('giới hạn theo loại: ảnh 5 MB, frame 360° 2 MB, panorama 20 MB; sai MIME ⇒ 415; khách ⇒ 403', async () => {
        expect((await upload('frame', pngOf(2 * MB))).status).toBe(201);
        expect((await upload('frame', pngOf(2 * MB + 1))).status).toBe(413);
        expect((await upload('image', pngOf(5 * MB))).status).toBe(201);
        expect((await upload('image', pngOf(5 * MB + 1))).status).toBe(413);
        expect((await upload('panorama', pngOf(20 * MB))).status).toBe(201);
        expect((await upload('panorama', pngOf(20 * MB + 1))).status).toBe(413);
        expect((await upload('frame', pngOf(1000), 'application/pdf')).status).toBe(415);
        expect((await upload('frame', pngOf(1000), 'image/png', cust)).status).toBe(403);
      });

      it('2 panorama × 20 MB (vượt body JSON nếu dùng base64) tải từng tệp rồi tạo không gian bằng URL', async () => {
        const urls: string[] = [];
        for (let i = 0; i < 2; i++) {
          const r = await upload('panorama', pngOf(20 * MB - i));
          expect(r.status).toBe(201);
          urls.push(r.body.data.url);
        }
        const r = await api('post', '/admin/spaces', admin, {
          title: 'Không gian hai panorama lớn',
          roomType: 'bedroom',
          description: 'Hai ảnh panorama dung lượng lớn nhất cho phép',
          status: 'draft',
          panoramas: [
            {
              url: urls[0],
              title: 'Góc 1',
              hotspots: [{ type: 'navigation', yaw: 10, pitch: 0, targetIndex: 1 }],
            },
            { url: urls[1], title: 'Góc 2', hotspots: [] },
          ],
          productIds: [prods[0]],
        });
        expect(r.status).toBe(201);
        expect(r.body.data.panoramas).toHaveLength(2);
        await api('delete', `/admin/spaces/${r.body.data.id}`, admin);
      });
    });

    it('slug: đổi tên KHÔNG đổi slug; admin sửa slug trực tiếp (duy nhất, hợp lệ); slug cũ ngừng hoạt động', async () => {
      const keep = await api('patch', `/admin/spaces/${spaceId}`, admin, {
        title: 'Tên hoàn toàn mới cho không gian',
      });
      expect(keep.status).toBe(200);
      expect(keep.body.data.title).toBe('Tên hoàn toàn mới cho không gian');
      expect(keep.body.data.slug).toBe(slug); // giữ nguyên
      expect((await api('get', `/spaces/${slug}`)).status).toBe(200);

      // slug đã dùng bởi không gian khác ⇒ 409 CONFLICT kèm lỗi theo trường slug (DAC_TA UC-ADM-15 2a)
      const other = (await prisma.space.findFirstOrThrow({ where: { id: { not: spaceId } } })).slug;
      const dup = await api('patch', `/admin/spaces/${spaceId}`, admin, { slug: other });
      expect(dup.status).toBe(409);
      expect(JSON.stringify(dup.body.error)).toContain('slug');
      // slug không hợp lệ (toàn ký tự đặc biệt)
      expect((await api('patch', `/admin/spaces/${spaceId}`, admin, { slug: '!!!' })).status).toBe(400);
      // gửi lại đúng slug hiện tại không bị coi là trùng
      expect((await api('patch', `/admin/spaces/${spaceId}`, admin, { slug })).status).toBe(200);

      // đổi slug có chủ đích
      const ch = await api('patch', `/admin/spaces/${spaceId}`, admin, { slug: 'Không Gian E2E Mới' });
      expect(ch.status).toBe(200);
      expect(ch.body.data.slug).toBe('khong-gian-e2e-moi');
      expect((await api('get', `/spaces/${slug}`)).status).toBe(404);
      expect((await api('get', '/spaces/khong-gian-e2e-moi')).status).toBe(200);
      // trả lại slug cũ để các test sau dùng tiếp
      expect((await api('patch', `/admin/spaces/${spaceId}`, admin, { slug })).status).toBe(200);
      await api('patch', `/admin/spaces/${spaceId}`, admin, { title: 'Không gian E2E' });
    });

    it('"Thêm cả bộ vào giỏ" (D-N37): một request, một transaction: có món hết hàng ⇒ 409 và KHÔNG thêm món nào', async () => {
      const all = await prisma.productVariant.findMany({ where: { productId: prods[2] } });
      const saved = all.map((a) => ({ id: a.id, stock: a.stockQuantity }));
      const cartCount = async () => (await api('get', '/cart', cust)).body.data.items.length;
      await api('delete', '/cart', cust);
      try {
        // hết hàng mọi biến thể của món thứ 3 (hai món đầu còn hàng)
        await prisma.productVariant.updateMany({
          where: { id: { in: all.map((a) => a.id) } },
          data: { stockQuantity: 0 },
        });
        const r = await api('post', `/spaces/${slug}/add-to-cart`, cust);
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe('CONFLICT');
        expect(r.body.error.details.unavailable).toHaveLength(1);
        expect(r.body.error.details.unavailable[0]).toMatchObject({ productId: prods[2] });
        expect(r.body.error.details.unavailable[0].reason).toMatch(/hết hàng|Chỉ còn/);
        expect(await cartCount()).toBe(0); // hai món còn hàng cũng KHÔNG được thêm (hoàn tác)

        // chọn một phần (productIds): chỉ các món còn hàng ⇒ thành công, đúng 2 dòng
        const part = await api('post', `/spaces/${slug}/add-to-cart`, cust, {
          productIds: [prods[0], prods[1]],
        });
        expect(part.status).toBe(200);
        expect(part.body.data.added.map((x: { productId: number }) => x.productId).sort()).toEqual(
          [prods[0], prods[1]].sort(),
        );
        expect(part.body.data.unavailable).toEqual([]);
        expect(part.body.data.cart.items).toHaveLength(2);
        // biến thể MẶC ĐỊNH mà endpoint dùng cho món 1 (để dựng tình huống quá tồn bên dưới)
        const defVariant0 = part.body.data.added.find((x: { productId: number }) => x.productId === prods[0])
          .variantId as number;
        await api('delete', '/cart', cust);

        // productIds không thuộc không gian / rỗng ⇒ 400 theo trường, giỏ không đổi
        const bad = await api('post', `/spaces/${slug}/add-to-cart`, cust, { productIds: [999999999] });
        expect(bad.status).toBe(400);
        expect(Object.keys(bad.body.error.details)).toContain('productIds');
        expect((await api('post', `/spaces/${slug}/add-to-cart`, cust, { productIds: [] })).status).toBe(400);
        expect(await cartCount()).toBe(0);

        // món vượt tồn do đã có trong giỏ: món 1 còn đúng 1 cái, giỏ đã có 1 ⇒ thêm nữa là quá tồn ⇒ 409, giỏ không đổi
        await prisma.productVariant.update({ where: { id: defVariant0 }, data: { stockQuantity: 1 } });
        expect((await api('post', '/cart/items', cust, { variantId: defVariant0, quantity: 1 })).status).toBe(
          201,
        );
        const over = await api('post', `/spaces/${slug}/add-to-cart`, cust, {
          productIds: [prods[0], prods[1]],
        });
        expect(over.status).toBe(409);
        expect(over.body.error.details.unavailable.map((u: { productId: number }) => u.productId)).toEqual([
          prods[0],
        ]);
        expect(await cartCount()).toBe(1); // vẫn đúng dòng cũ, món 2 không bị thêm
      } finally {
        for (const x of saved)
          await prisma.productVariant.update({ where: { id: x.id }, data: { stockQuantity: x.stock } });
        await api('delete', '/cart', cust);
      }
      // còn hàng đầy đủ ⇒ thêm cả bộ trong một request
      const okAll = await api('post', `/spaces/${slug}/add-to-cart`, cust);
      expect(okAll.status).toBe(200);
      expect(okAll.body.data.cart.items.length).toBe(okAll.body.data.added.length);
      await api('delete', '/cart', cust);
      expect((await api('post', `/spaces/${slug}/add-to-cart`, undefined)).status).toBe(401);
    });

    it('sửa/xóa không gian', async () => {
      const upd = await api('patch', `/admin/spaces/${spaceId}`, admin, {
        title: 'Không gian e2e (sửa)',
        style: 'Bắc Âu',
      });
      expect(upd.body.data.title).toBe('Không gian e2e (sửa)');
      expect(upd.body.data.panoramas).toHaveLength(2); // không gửi panoramas ⇒ giữ nguyên
      expect((await api('delete', `/admin/spaces/${spaceId}`, admin)).status).toBe(200);
      expect((await api('get', `/admin/spaces/${spaceId}`, admin)).status).toBe(404);
    });
  });
});
