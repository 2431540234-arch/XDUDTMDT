// E2E (supertest) Mốc 3 trên aurelia_test: đánh giá có kiểm duyệt, hỏi đáp, đổi trả → hoàn tiền (tồn kho + phiếu chi),
// thông báo, nội dung (banner/bài viết/trang/FAQ/liên hệ), không gian mẫu (+ thêm cả bộ vào giỏ), mô hình 3D (upload an toàn),
// phân quyền (khách gọi /admin/* ⇒ 403, không đụng dữ liệu người khác).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const b64 = (b: Buffer) => `data:application/octet-stream;base64,${b.toString('base64')}`;
const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(64, 1)]);

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
    for (const s of ['confirmed', 'processing', 'shipping', 'completed']) {
      expect((await api('patch', `/admin/orders/${o.id}/status`, admin, { status: s })).status).toBe(200);
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
    const paths = [
      '/admin/reviews',
      '/admin/questions',
      '/admin/returns',
      '/admin/banners',
      '/admin/posts',
      '/admin/pages',
      '/admin/faq',
      '/admin/contact-messages',
      '/admin/spaces',
      '/admin/spaces/1',
      '/admin/models',
    ];
    it.each(paths)('khách gọi GET %s ⇒ 403', async (p) => {
      const r = await api('get', p, cust);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    });
    it('khách ghi vào admin ⇒ 403; không token ⇒ 401', async () => {
      expect((await api('patch', '/admin/reviews/1/status', cust, { status: 'approved' })).status).toBe(403);
      expect((await api('patch', '/admin/returns/1', cust, { status: 'picking' })).status).toBe(403);
      expect((await api('post', '/admin/banners', cust, { title: 'x' })).status).toBe(403);
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

    it('validation: số sao, nội dung ≥ 20 ký tự, ảnh tối đa 5 và ≤ 5MB/ảnh', async () => {
      const bad = await api('post', `/products/${slug}/reviews`, cust, {
        orderId,
        rating: 9,
        content: 'ngắn',
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error.details.rating[0]).toBe('Vui lòng chọn số sao.');
      expect(bad.body.error.details.content[0]).toBe('Nội dung đánh giá tối thiểu 20 ký tự.');
      const six = await api('post', `/products/${slug}/reviews`, cust, {
        orderId,
        rating: 5,
        content,
        images: Array(6).fill(PNG),
      });
      expect(six.status).toBe(400);
      expect(six.body.error.details.images[0]).toContain('Tối đa 5 ảnh');
      const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(5 * 1024 * 1024 + 10)]);
      const tooBig = await api('post', `/products/${slug}/reviews`, cust, {
        orderId,
        rating: 5,
        content,
        images: [`data:image/png;base64,${big.toString('base64')}`],
      });
      expect(tooBig.status).toBe(413);
      expect(
        (
          await api('post', `/products/${slug}/reviews`, cust, {
            orderId,
            rating: 5,
            content,
            images: ['data:image/png;base64,bm90IGFuIGltYWdl'],
          })
        ).status,
      ).toBe(415);
    });

    it('đánh giá mới ở pending: không hiện công khai, điểm trung bình KHÔNG đổi', async () => {
      const r = await api('post', `/products/${slug}/reviews`, cust, {
        orderId,
        rating: 5,
        content,
        images: [PNG, PNG],
      });
      expect(r.status).toBe(201);
      reviewId = r.body.data.id;
      expect(r.body.data.status).toBe('pending');
      expect(r.body.data.images).toHaveLength(2);
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

  // ------------------------------------------------------------ hỏi đáp
  describe('hỏi đáp', () => {
    const slug = 'sofa-luxury';
    let qid = 0;
    let asker = '';
    it('chống spam: trùng nội dung 409; quá 5 câu/giờ ⇒ 429; cần đăng nhập', async () => {
      expect(
        (
          await api('post', `/products/${slug}/questions`, undefined, {
            content: 'Sofa này giao trong bao lâu vậy?',
          })
        ).status,
      ).toBe(401);
      asker = await tokenOf(12);
      const first = await api('post', `/products/${slug}/questions`, asker, {
        content: 'Sofa này giao trong bao lâu vậy?',
      });
      expect(first.status).toBe(201);
      expect(first.body.data.status).toBe('unanswered');
      qid = first.body.data.id;
      expect(
        (
          await api('post', `/products/${slug}/questions`, asker, {
            content: 'Sofa này giao trong bao lâu vậy?',
          })
        ).status,
      ).toBe(409);
      expect((await api('post', `/products/${slug}/questions`, asker, { content: 'ngắn' })).status).toBe(400);
      for (let i = 2; i <= 5; i++)
        expect(
          (
            await api('post', `/products/${slug}/questions`, asker, {
              content: `Câu hỏi số ${i} về chất liệu vải bọc sofa`,
            })
          ).status,
        ).toBe(201);
      const limited = await api('post', `/products/${slug}/questions`, asker, {
        content: 'Câu hỏi thứ sáu trong cùng một giờ',
      });
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });

    it('chưa trả lời thì không hiện công khai; admin lọc tab theo trạng thái', async () => {
      expect(
        (await api('get', `/products/${slug}/questions`)).body.data.some((x: { id: number }) => x.id === qid),
      ).toBe(false);
      const un = await api('get', '/admin/questions?status=unanswered&pageSize=100', admin);
      expect(un.body.data.some((x: { id: number }) => x.id === qid)).toBe(true);
      expect(un.body.data.every((x: { status: string }) => x.status === 'unanswered')).toBe(true);
    });

    it('trả lời ⇒ hiện công khai + thông báo cho khách; sửa câu trả lời; ẩn/hiện; riêng tư', async () => {
      expect(
        (await api('patch', `/admin/questions/${qid}`, admin, { answer: 'ok', isPublic: true })).status,
      ).toBe(400);
      const notiBefore = await prisma.notification.count({ where: { userId: 12 } });
      const ans = await api('patch', `/admin/questions/${qid}`, admin, {
        answer: 'Giao trong 2–5 ngày làm việc trên toàn quốc ạ.',
        isPublic: true,
      });
      expect(ans.body.data.status).toBe('answered');
      expect(await prisma.notification.count({ where: { userId: 12 } })).toBe(notiBefore + 1);
      expect(
        (await api('get', `/products/${slug}/questions`)).body.data.some((x: { id: number }) => x.id === qid),
      ).toBe(true);
      const edit = await api('patch', `/admin/questions/${qid}`, admin, {
        answer: 'Giao trong 1–2 ngày tại nội thành, 3–5 ngày các tỉnh khác.',
        isPublic: true,
      });
      expect(edit.body.data.answer).toContain('1–2 ngày');
      const hid = await api('patch', `/admin/questions/${qid}`, admin, { status: 'hidden' });
      expect(hid.body.data.status).toBe('hidden');
      expect(
        (await api('get', `/products/${slug}/questions`)).body.data.some((x: { id: number }) => x.id === qid),
      ).toBe(false);
      expect(
        (await api('get', '/admin/questions?status=hidden&pageSize=100', admin)).body.data.some(
          (x: { id: number }) => x.id === qid,
        ),
      ).toBe(true);
      expect(
        (await api('patch', `/admin/questions/${qid}`, admin, { status: 'visible' })).body.data.status,
      ).toBe('answered');
      expect(
        (await api('get', `/products/${slug}/questions`)).body.data.some((x: { id: number }) => x.id === qid),
      ).toBe(true);
      await api('patch', `/admin/questions/${qid}`, admin, {
        answer: 'Giao trong 1–2 ngày tại nội thành, 3–5 ngày các tỉnh khác.',
        isPublic: false,
      });
      expect(
        (await api('get', `/products/${slug}/questions`)).body.data.some((x: { id: number }) => x.id === qid),
      ).toBe(false);
    });
  });

  // ------------------------------------------------------------ đổi trả
  describe('đổi trả → hoàn tiền → tồn kho + phiếu chi', () => {
    let v = { id: 0, stockQuantity: 0 };
    let order: Awaited<ReturnType<typeof completedOrder>>;
    let ret = { id: 0, code: '' };
    const body = (itemId: number, qty: number, type = 'refund') => ({
      type,
      reason: 'defect',
      description: 'Sản phẩm bị trầy xước khi nhận hàng',
      images: [PNG],
      items: [{ orderItemId: itemId, quantity: qty }],
    });
    const stock = async () =>
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: v.id } })).stockQuantity;

    it('chuẩn bị: đơn completed hôm nay (qty 3)', async () => {
      const found = await stockVariant(15);
      v = found;
      order = await completedOrder(cust, 2, found.id, 3);
      expect(order.items).toHaveLength(1);
    });

    it('validation: ảnh minh chứng bắt buộc, mô tả ≥ 10 ký tự, số lượng không vượt số đã mua', async () => {
      const item = order.items[0].id;
      const noImg = await api('post', '/returns', cust, { ...body(item, 1), orderId: order.id, images: [] });
      expect(noImg.body.error.details.images[0]).toBe('Vui lòng tải lên ảnh/video minh chứng.');
      const over = await api('post', '/returns', cust, { ...body(item, 4), orderId: order.id });
      expect(over.status).toBe(400);
      expect(over.body.error.details.items[0]).toContain('tối đa là 3');
    });

    it('tạo yêu cầu: mã RT tăng dần; số lượng tối đa trừ số đã yêu cầu; không đổi trả đơn người khác', async () => {
      const item = order.items[0].id;
      expect(
        (await api('post', '/returns', await tokenOf(3), { ...body(item, 1), orderId: order.id })).status,
      ).toBe(404);
      const a = await api('post', '/returns', cust, { ...body(item, 2), orderId: order.id });
      expect(a.status).toBe(201);
      expect(a.body.data.code).toMatch(/^RT\d{4}$/);
      expect(a.body.data.status).toBe('pending');
      expect(a.body.data.refundAmount).toBeGreaterThan(0);
      ret = a.body.data;
      const left = await api('post', '/returns', cust, { ...body(item, 2), orderId: order.id }); // chỉ còn 1
      expect(left.status).toBe(400);
      expect(left.body.error.details.items[0]).toContain('tối đa là 1');
      const b = await api('post', '/returns', cust, { ...body(item, 1, 'exchange'), orderId: order.id });
      expect(b.status).toBe(201);
      expect(Number(b.body.data.code.slice(2))).toBe(Number(a.body.data.code.slice(2)) + 1);
      expect(
        (await api('post', '/returns', cust, { ...body(item, 1), orderId: order.id })).body.error.code,
      ).toBe('INVALID_STATE');
      // khách chỉ thấy yêu cầu của mình
      const mine = await api('get', '/returns?pageSize=100', cust);
      expect(mine.body.data.every((r: { userId: number }) => r.userId === 2)).toBe(true);
      expect(
        (await api('get', '/returns?pageSize=100', await tokenOf(3))).body.data.some(
          (r: { id: number }) => r.id === ret.id,
        ),
      ).toBe(false);
    });

    it('quá 7 ngày kể từ khi giao ⇒ 409; hợp lệ khi còn trong hạn', async () => {
      const old = await completedOrder(cust, 2, v.id, 1);
      await prisma.shipment.updateMany({
        where: { orderId: old.id },
        data: {
          shippedAt: new Date(Date.now() - 9 * 86_400_000),
          deliveredAt: new Date(Date.now() - 8 * 86_400_000),
        },
      });
      const r = await api('post', '/returns', cust, { ...body(old.items[0].id, 1), orderId: old.id });
      expect(r.status).toBe(409);
      expect(r.body.error.message).toContain('quá hạn 7 ngày');
    });

    it('admin: sai thứ tự ⇒ 409; từ chối cần lý do; luồng đúng đến hoàn tiền', async () => {
      const set = (status: string, extra: object = {}) =>
        api('patch', `/admin/returns/${ret.id}`, admin, { status, ...extra });
      expect((await set('refunded')).status).toBe(409);
      expect((await set('inspecting')).status).toBe(409);
      expect((await set('rejected')).body.error.details.adminNote[0]).toBe('Vui lòng nhập lý do từ chối.');
      const before = await stock();
      const notiBefore = await prisma.notification.count({ where: { userId: 2 } });
      expect((await set('picking')).body.data.status).toBe('picking');
      expect(await stock()).toBe(before); // chưa nhận hàng về
      expect((await set('inspecting')).body.data.status).toBe('inspecting');
      expect(await stock()).toBe(before);
      const done = await set('refunded', { adminNote: 'Đã kiểm tra, hoàn tiền' });
      expect(done.status).toBe(200);
      expect(done.body.data.status).toBe('refunded');
      expect(await stock()).toBe(before + 2); // hàng về kho đúng biến thể
      const mv = await prisma.inventoryMovement.findFirst({
        where: { variantId: v.id, type: 'return', referenceCode: ret.code },
      });
      expect(mv?.quantityChange).toBe(2);
      const exp = await prisma.expense.findFirst({ where: { orderId: order.id, category: 'refund' } });
      expect(Number(exp?.amount)).toBe(done.body.data.refundAmount);
      expect(exp?.code).toMatch(/^CH-\d{4}$/);
      expect(await prisma.notification.count({ where: { userId: 2 } })).toBe(notiBefore + 3); // mỗi lần đổi trạng thái 1 thông báo
      expect((await set('rejected', { adminNote: 'x' })).status).toBe(409); // trạng thái cuối
      expect(
        await prisma.activityLog.count({ where: { action: 'return.update_status', targetId: ret.id } }),
      ).toBe(3);
    });

    it('loại "đổi sản phẩm": hoàn tiền không hợp lệ; đổi hàng cùng biến thể: cộng tồn món cũ, trừ tồn món mới (hiệu 0), KHÔNG tạo phiếu chi', async () => {
      const ex = (await api('get', `/admin/returns?type=exchange&q=${order.orderCode}`, admin)).body.data[0];
      expect((await api('patch', `/admin/returns/${ex.id}`, admin, { status: 'picking' })).status).toBe(200);
      expect((await api('patch', `/admin/returns/${ex.id}`, admin, { status: 'inspecting' })).status).toBe(
        200,
      );
      expect((await api('patch', `/admin/returns/${ex.id}`, admin, { status: 'refunded' })).status).toBe(409);
      const before = await stock();
      const expensesBefore = await prisma.expense.count({ where: { category: 'refund' } });
      expect(
        (await api('patch', `/admin/returns/${ex.id}`, admin, { status: 'exchanged' })).body.data.status,
      ).toBe('exchanged');
      expect(await stock()).toBe(before); // +1 hàng trả về, −1 hàng giao đổi
      expect(
        (
          await prisma.inventoryMovement.findMany({
            where: { variantId: v.id, referenceCode: ex.code },
            orderBy: { id: 'asc' },
          })
        ).map((m) => [m.type, m.quantityChange]),
      ).toEqual([
        ['return', 1],
        ['sale', -1],
      ]);
      expect(await prisma.expense.count({ where: { category: 'refund' } })).toBe(expensesBefore);
    });

    it('hoàn đủ tiền hàng của đơn ⇒ đơn và thanh toán sang refunded', async () => {
      const v2 = await stockVariant(15);
      const o = await completedOrder(cust, 2, v2.id, 1);
      const r = (await api('post', '/returns', cust, { ...body(o.items[0].id, 1), orderId: o.id })).body.data;
      for (const s of ['picking', 'inspecting', 'refunded'])
        await api('patch', `/admin/returns/${r.id}`, admin, { status: s });
      const od = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(od.status).toBe('refunded');
      expect(od.paymentStatus).toBe('refunded');
      expect((await prisma.payment.findFirstOrThrow({ where: { orderId: o.id } })).status).toBe('refunded');
    });

    it('từ chối kèm lý do ⇒ không cộng tồn, không phiếu chi', async () => {
      const v3 = await stockVariant(15);
      const o = await completedOrder(cust, 2, v3.id, 1);
      const r = (await api('post', '/returns', cust, { ...body(o.items[0].id, 1), orderId: o.id })).body.data;
      const before = (await prisma.productVariant.findUniqueOrThrow({ where: { id: v3.id } })).stockQuantity;
      const rej = await api('patch', `/admin/returns/${r.id}`, admin, {
        status: 'rejected',
        adminNote: 'Hàng đã qua sử dụng',
      });
      expect(rej.body.data.status).toBe('rejected');
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: v3.id } })).stockQuantity).toBe(
        before,
      );
      expect(await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } })).toBe(0);
    });
  });

  // ------------------------------------------------------------ thông báo
  // ------------------------------------------------------------ tiền hoàn theo số tiền thực trả; đổi hàng cộng/trừ tồn hai biến thể
  describe('hoàn tiền theo tiền thực trả (coupon, phí ship) và đổi hàng', () => {
    const reqBody = (itemId: number, qty: number, type: string, extra: object = {}) => ({
      type,
      reason: 'defect',
      description: 'Sản phẩm bị trầy xước khi nhận hàng',
      images: [PNG],
      items: [{ orderItemId: itemId, quantity: qty, ...extra }],
    });
    const walk = async (id: number, last: string) => {
      for (const st of ['picking', 'inspecting', last]) {
        const r = await api('patch', `/admin/returns/${id}`, admin, { status: st, adminNote: 'ok' });
        if (r.status !== 200) return r;
      }
      return api('get', '/admin/returns?pageSize=100', admin);
    };
    const stockOf = async (id: number) =>
      (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;

    it('đơn có coupon 10% và phí ship 150.000: tiền hoàn = giá món × 0,9, KHÔNG gồm phí ship; trả hết ⇒ đơn refunded', async () => {
      const v = await stockVariant(15);
      const o = await completedOrder(cust, 2, v.id, 2);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      const subtotal = Number(row.subtotal);
      const discount = Math.round(subtotal * 0.1);
      const ship = 150_000;
      await prisma.order.update({
        where: { id: o.id },
        data: { discountAmount: discount, shippingFee: ship, total: subtotal - discount + ship },
      });
      const unit = subtotal / 2;
      const expected = Math.round((unit * (subtotal - discount)) / subtotal);

      const a = await api('post', '/returns', cust, {
        ...reqBody(o.items[0].id, 1, 'refund'),
        orderId: o.id,
      });
      expect(a.status).toBe(201);
      expect(a.body.data.refundAmount).toBe(expected);
      expect(a.body.data.refundAmount).toBeLessThan(unit); // đã trừ phần coupon
      const expenseBefore = await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } });
      expect((await walk(a.body.data.id, 'refunded')).status).toBe(200);
      const exp = await prisma.expense.findFirstOrThrow({ where: { orderId: o.id, category: 'refund' } });
      expect(Number(exp.amount)).toBe(expected);
      expect(await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } })).toBe(
        expenseBefore + 1,
      );
      // mới trả 1/2 số lượng ⇒ đơn vẫn completed
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('completed');

      const b = await api('post', '/returns', cust, {
        ...reqBody(o.items[0].id, 1, 'refund'),
        orderId: o.id,
      });
      expect(b.status).toBe(201);
      expect((await walk(b.body.data.id, 'refunded')).status).toBe(200);
      const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(after.status).toBe('refunded'); // đã trả hết các dòng
      const total = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: { orderId: o.id, category: 'refund' },
      });
      expect(Number(total._sum.amount)).toBeLessThanOrEqual(subtotal - discount + 1);
      expect(Number(total._sum.amount)).toBeLessThan(Number(after.total)); // không hoàn phí ship
    });

    it('đổi hàng cùng biến thể: cộng tồn món cũ và trừ tồn món mới (hiệu số 0), ghi cả hai movement', async () => {
      const v = await stockVariant(15);
      const o = await completedOrder(cust, 2, v.id, 2);
      const s0 = await stockOf(v.id);
      const r = await api('post', '/returns', cust, {
        ...reqBody(o.items[0].id, 1, 'exchange'),
        orderId: o.id,
      });
      expect(r.status).toBe(201);
      expect(r.body.data.items[0].exchangeVariantId).toBeNull();
      expect((await walk(r.body.data.id, 'exchanged')).status).toBe(200);
      expect(await stockOf(v.id)).toBe(s0);
      const mv = await prisma.inventoryMovement.findMany({
        where: { variantId: v.id, referenceCode: r.body.data.code },
        orderBy: { id: 'asc' },
      });
      expect(mv.map((m) => [m.type, m.quantityChange])).toEqual([
        ['return', 1],
        ['sale', -1],
      ]);
      expect(await prisma.expense.count({ where: { orderId: o.id, category: 'refund' } })).toBe(0); // đổi hàng không chi tiền
    });

    it('đổi sang biến thể khác cùng sản phẩm: cũ +1, mới −1, ghi vào yêu cầu; thiếu hàng ⇒ 409 và không đổi gì', async () => {
      const pair = await prisma.$queryRaw<Array<{ a: number; b: number }>>`
        SELECT a.id AS a, b.id AS b
        FROM product_variants a
        JOIN product_variants b ON b.product_id = a.product_id AND b.id <> a.id
        JOIN products p ON p.id = a.product_id AND p.status = 'published' AND p.deleted_at IS NULL
        WHERE a.is_active AND b.is_active AND a.stock_quantity >= 15 AND b.stock_quantity >= 5
        ORDER BY a.id DESC LIMIT 1`;
      expect(pair).toHaveLength(1);
      const { a, b } = pair[0];
      const o = await completedOrder(cust, 2, a, 2);
      const sa = await stockOf(a);
      const sb = await stockOf(b);

      // biến thể của sản phẩm khác ⇒ 400
      const other = await prisma.productVariant.findFirstOrThrow({
        where: { productId: { not: o.items[0].productId } },
      });
      const bad = await api('post', '/returns', cust, {
        ...reqBody(o.items[0].id, 1, 'exchange', { exchangeVariantId: other.id }),
        orderId: o.id,
      });
      expect(bad.status).toBe(400);

      const r = await api('post', '/returns', cust, {
        ...reqBody(o.items[0].id, 1, 'exchange', { exchangeVariantId: b }),
        orderId: o.id,
      });
      expect(r.status).toBe(201);
      expect(r.body.data.items[0].exchangeVariantId).toBe(b);

      // hết hàng món mới ⇒ 409, giao dịch hoàn tác (trạng thái và tồn không đổi)
      await prisma.productVariant.update({ where: { id: b }, data: { stockQuantity: 0 } });
      const id = r.body.data.id;
      await api('patch', `/admin/returns/${id}`, admin, { status: 'picking' });
      await api('patch', `/admin/returns/${id}`, admin, { status: 'inspecting' });
      const fail = await api('patch', `/admin/returns/${id}`, admin, { status: 'exchanged' });
      expect(fail.status).toBe(409);
      expect(fail.body.error.code).toBe('OUT_OF_STOCK');
      expect((await prisma.returnRequest.findUniqueOrThrow({ where: { id } })).status).toBe('inspecting');
      expect(await stockOf(a)).toBe(sa);
      expect(await stockOf(b)).toBe(0);

      await prisma.productVariant.update({ where: { id: b }, data: { stockQuantity: sb } });
      expect((await api('patch', `/admin/returns/${id}`, admin, { status: 'exchanged' })).status).toBe(200);
      expect(await stockOf(a)).toBe(sa + 1);
      expect(await stockOf(b)).toBe(sb - 1);
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

    it('chuông admin: đơn mới, đổi trả mới, câu hỏi mới, đánh giá chờ duyệt', async () => {
      const r = await api('get', '/admin/notifications', admin);
      expect(r.status).toBe(200);
      const links = r.body.data.map((n: { link: string }) => n.link);
      expect(links.some((l: string) => l.startsWith('/admin/orders/'))).toBe(true);
    });
  });

  // ------------------------------------------------------------ nội dung
  describe('nội dung', () => {
    it('banner: CRUD, upload ảnh, vị trí, thời gian; công khai chỉ trả banner đang bật và trong hạn; kéo thả lưu thứ tự', async () => {
      const mk = (title: string, extra: object = {}) =>
        api('post', '/admin/banners', admin, {
          title,
          imageUrl: PNG,
          position: 'hero-1',
          link: '/products',
          ...extra,
        });
      const a = await mk('Banner A e2e');
      expect(a.status).toBe(201);
      expect(a.body.data.imageUrl).toMatch(/^http/);
      const off = await mk('Banner tắt e2e', { isActive: false });
      const future = await mk('Banner tương lai e2e', { startAt: '2099-01-01T00:00:00Z' });
      const expired = await mk('Banner hết hạn e2e', {
        startAt: '2020-01-01T00:00:00Z',
        endAt: '2020-02-01T00:00:00Z',
      });
      expect((await api('post', '/admin/banners', admin, { title: 'x' })).status).toBe(400);
      expect((await mk('Sai vị trí', { position: 'xyz' })).status).toBe(400);
      const pub = (await api('get', '/banners')).body.data.map((b: { title: string }) => b.title);
      expect(pub).toContain('Banner A e2e');
      for (const hidden of [off, future, expired]) expect(pub).not.toContain(hidden.body.data.title);
      const b = await mk('Banner B e2e');
      const reorder = await api('patch', '/admin/banners/reorder', admin, {
        ids: [b.body.data.id, a.body.data.id],
      });
      expect(reorder.status).toBe(200);
      const list = (await api('get', '/admin/banners', admin)).body.data.filter((x: { id: number }) =>
        [a.body.data.id, b.body.data.id].includes(x.id),
      );
      expect(list.map((x: { id: number }) => x.id)).toEqual([b.body.data.id, a.body.data.id]);
      expect(
        (await api('patch', `/admin/banners/${a.body.data.id}`, admin, { isActive: false })).body.data
          .isActive,
      ).toBe(false);
      expect((await api('get', '/banners')).body.data.map((x: { title: string }) => x.title)).not.toContain(
        'Banner A e2e',
      );
      expect((await api('delete', `/admin/banners/${b.body.data.id}`, admin)).status).toBe(200);
    });

    it('bài viết: Markdown lưu nguyên văn (bỏ ký tự điều khiển), slug unique, nháp không công khai, xuất bản + lượt xem', async () => {
      // Markdown + mã độc dạng chữ: BE lưu nguyên văn (kèm ký tự điều khiển \u0000 bị bỏ); FE tắt HTML thô khi hiển thị
      const xss = '## Tiêu đề\u0000\n\nNội dung <script>alert(1)</script> [x](javascript:alert(1))';
      const p1 = await api('post', '/admin/posts', admin, {
        title: 'Bài viết thử nghiệm e2e',
        category: 'Cảm hứng',
        content: xss,
        status: 'draft',
      });
      expect(p1.status).toBe(201);
      expect(p1.body.data.slug).toBe('bai-viet-thu-nghiem-e2e');
      expect(p1.body.data.content).toBe(
        '## Tiêu đề\n\nNội dung <script>alert(1)</script> [x](javascript:alert(1))',
      );
      const p2 = await api('post', '/admin/posts', admin, {
        title: 'Bài viết thử nghiệm e2e',
        status: 'draft',
      });
      expect(p2.body.data.slug).toBe('bai-viet-thu-nghiem-e2e-2');
      expect((await api('post', '/admin/posts', admin, { title: 'abc' })).body.error.details.title[0]).toBe(
        'Tiêu đề tối thiểu 5 ký tự.',
      );
      expect((await api('get', '/posts')).body.data.map((x: { slug: string }) => x.slug)).not.toContain(
        p1.body.data.slug,
      );
      expect((await api('get', `/posts/${p1.body.data.slug}`)).status).toBe(404);
      const pub = await api('patch', `/admin/posts/${p1.body.data.id}`, admin, { status: 'published' });
      expect(pub.body.data.publishedAt).toBeTruthy();
      const v1 = (await api('get', `/posts/${p1.body.data.slug}`)).body.data.views;
      expect((await api('get', `/posts/${p1.body.data.slug}`)).body.data.views).toBe(v1 + 1);
      expect((await api('get', '/posts')).body.data.map((x: { slug: string }) => x.slug)).toContain(
        p1.body.data.slug,
      );
      expect((await api('delete', `/admin/posts/${p2.body.data.id}`, admin)).status).toBe(200);
    });

    it('trang tĩnh & FAQ: CRUD cho admin, API công khai cho FE', async () => {
      const pg = await api('post', '/admin/pages', admin, {
        title: 'Trang e2e',
        content: '## Xin chào\n\n- Mục một\u0000',
        status: 'published',
        type: 'policy',
      });
      expect(pg.status).toBe(201);
      expect(pg.body.data.content).toBe('## Xin chào\n\n- Mục một');
      expect((await api('get', `/pages/${pg.body.data.slug}`)).body.data.title).toBe('Trang e2e');
      expect(
        (await api('get', '/pages?type=policy')).body.data.map((x: { slug: string }) => x.slug),
      ).toContain(pg.body.data.slug);
      expect((await api('patch', `/admin/pages/${pg.body.data.id}`, admin, { status: 'draft' })).status).toBe(
        200,
      );
      expect((await api('get', `/pages/${pg.body.data.slug}`)).status).toBe(404);
      expect((await api('delete', `/admin/pages/${pg.body.data.id}`, admin)).status).toBe(200);
      const core = await prisma.page.findFirstOrThrow({ where: { slug: 'chinh-sach-doi-tra' } });
      expect((await api('delete', `/admin/pages/${core.id}`, admin)).status).toBe(409);

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

    it('liên hệ: validation, lưu tin nhắn, giới hạn 5 lần/phút, admin xem và đánh dấu đã xử lý', async () => {
      // xóa bộ đếm giới hạn tốc độ còn lại từ lần chạy trước (Redis) để kiểm tra giới hạn 5 lần/phút chính xác
      const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT ?? 6379) });
      const keys = await redis.keys('throttle-test:*');
      if (keys.length) await redis.del(...keys);
      await redis.quit();
      const bad = await api('post', '/contact', undefined, { fullName: 'A' });
      expect(bad.status).toBe(400);
      const good = {
        fullName: 'Nguyễn Văn Liên',
        phone: '0911222333',
        email: 'lienhe@example.com',
        subject: 'Tư vấn sản phẩm',
        content: 'Tôi muốn được tư vấn về sofa phòng khách.',
      };
      const results: number[] = [];
      for (let i = 0; i < 6; i++) results.push((await api('post', '/contact', undefined, good)).status);
      expect(results.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
      expect(results).toContain(429); // vượt 5 lần/phút
      const list = await api('get', '/admin/contact-messages?handled=false&pageSize=100', admin);
      const msg = list.body.data.find((m: { email: string }) => m.email === 'lienhe@example.com');
      expect(msg).toBeTruthy();
      expect(
        (await api('patch', `/admin/contact-messages/${msg.id}/handled`, admin, { handled: true })).body.data
          .handledAt,
      ).toBeTruthy();
      expect(
        (await api('get', '/admin/contact-messages?handled=true&pageSize=100', admin)).body.data.some(
          (m: { id: number }) => m.id === msg.id,
        ),
      ).toBe(true);
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
      expect(short.body.error.details.description[0]).toBe('Mô tả tối thiểu 10 ký tự.');
    });

    it('lượt xem: mở chi tiết KHÔNG tăng view_count; POST /views ghi space_views và trigger tăng view_count', async () => {
      const sp = await prisma.space.findFirstOrThrow({
        where: { status: 'published' },
        orderBy: { id: 'asc' },
      });
      const count = async () => (await prisma.space.findUniqueOrThrow({ where: { id: sp.id } })).viewCount;
      const v0 = await count();
      expect((await api('get', `/spaces/${sp.slug}`)).status).toBe(200);
      expect(await count()).toBe(v0);

      const visitorId = '3f2c1a9e-5b7d-4c88-9a10-0e6d2b4f7a11';
      const guest = await api('post', `/spaces/${sp.slug}/views`, undefined, {
        visitorId,
        hotspotClickCount: 2,
      });
      expect(guest.status).toBe(200);
      expect(await count()).toBe(v0 + 1);
      const row = await prisma.spaceView.findFirstOrThrow({ where: { spaceId: sp.id, visitorId } });
      expect(row.userId).toBeNull();
      expect(row.hotspotClickCount).toBe(2);

      const asUser = await api('post', `/spaces/${sp.slug}/views`, cust, {});
      expect(asUser.status).toBe(200);
      expect(await count()).toBe(v0 + 2);
      expect(
        (await prisma.spaceView.findFirstOrThrow({ where: { spaceId: sp.id, userId: 2 } })).visitorId,
      ).toBeNull();

      // thiếu visitorId khi chưa đăng nhập / UUID sai / số lần bấm sai / không gian không tồn tại
      expect((await api('post', `/spaces/${sp.slug}/views`, undefined, {})).status).toBe(400);
      expect((await api('post', `/spaces/${sp.slug}/views`, undefined, { visitorId: 'abc' })).status).toBe(
        400,
      );
      expect(
        (await api('post', `/spaces/${sp.slug}/views`, undefined, { visitorId, hotspotClickCount: -1 }))
          .status,
      ).toBe(400);
      expect((await api('post', '/spaces/khong-ton-tai/views', undefined, { visitorId })).status).toBe(404);
      expect(await count()).toBe(v0 + 2);
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

    it('slug: đổi tên KHÔNG đổi slug; admin sửa slug trực tiếp (duy nhất, hợp lệ); slug cũ ngừng hoạt động', async () => {
      const keep = await api('patch', `/admin/spaces/${spaceId}`, admin, {
        title: 'Tên hoàn toàn mới cho không gian',
      });
      expect(keep.status).toBe(200);
      expect(keep.body.data.title).toBe('Tên hoàn toàn mới cho không gian');
      expect(keep.body.data.slug).toBe(slug); // giữ nguyên
      expect((await api('get', `/spaces/${slug}`)).status).toBe(200);

      // slug đã dùng bởi không gian khác ⇒ 400 trường slug
      const other = (await prisma.space.findFirstOrThrow({ where: { id: { not: spaceId } } })).slug;
      const dup = await api('patch', `/admin/spaces/${spaceId}`, admin, { slug: other });
      expect(dup.status).toBe(400);
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

    it('"Thêm cả bộ vào giỏ": thêm đúng các biến thể còn hàng, báo rõ món hết hàng', async () => {
      const dv = await prisma.productVariant.findFirstOrThrow({
        where: { productId: prods[2], isActive: true },
        orderBy: { id: 'asc' },
      });
      const all = await prisma.productVariant.findMany({ where: { productId: prods[2] } });
      await prisma.productVariant.updateMany({
        where: { id: { in: all.map((a) => a.id) } },
        data: { stockQuantity: 0 },
      }); // hết hàng mọi biến thể món thứ 3
      await api('delete', '/cart', cust);
      const r = await api('post', `/spaces/${slug}/add-to-cart`, cust);
      expect(r.status).toBe(200);
      expect(r.body.data.added.map((a: { productId: number }) => a.productId).sort()).toEqual(
        [prods[0], prods[1]].sort(),
      );
      expect(r.body.data.unavailable).toHaveLength(1);
      expect(r.body.data.unavailable[0]).toMatchObject({ productId: prods[2] });
      expect(r.body.data.unavailable[0].reason).toMatch(/hết hàng|Chỉ còn/);
      expect(r.body.data.cart.items).toHaveLength(2);
      expect(dv.id).toBeGreaterThan(0);
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

  // ------------------------------------------------------------ mô hình 3D
  describe('mô hình 3D', () => {
    let pid = 0;
    let slug = '';
    let fileId = 0;
    it('chuẩn bị: sản phẩm chưa có mô hình', async () => {
      const p = await prisma.product.create({
        data: { name: 'Ghế mô hình e2e', slug: 'ghe-mo-hinh-e2e', status: 'published' },
      });
      pid = p.id;
      slug = p.slug;
    });

    it('upload GLB (data-URL, kiểm tra chữ ký): liên kết sản phẩm, tỉ lệ, đơn vị, AR; public trả đúng file', async () => {
      const r = await api('post', '/admin/models', admin, {
        productId: pid,
        fileName: 'ghe-e2e.glb',
        format: 'glb',
        sizeMB: 1,
        allowAr: true,
        scale: 1.5,
        unit: 'cm',
        fileData: b64(GLB),
      });
      expect(r.status).toBe(201);
      fileId = r.body.data.id;
      expect(r.body.data.format).toBe('glb');
      expect(r.body.data.productName).toBe('Ghế mô hình e2e');
      expect(r.body.data.glbUrl).toMatch(/^http/);
      expect(r.body.data.viewerConfig).toMatchObject({ scale: 1.5, unit: 'cm' });
      const stored = await prisma.media.findFirstOrThrow({ where: { fileName: 'ghe-e2e.glb' } });
      expect(stored.filePath).toMatch(/^models\/\d+\/[0-9a-f-]{36}\.glb$/); // tên do server sinh
      expect((await prisma.product.findUniqueOrThrow({ where: { id: pid } })).has3dModel).toBe(true);
      const pub = await api('get', `/products/${slug}/model`);
      expect(pub.body.data.glbUrl).toBe(r.body.data.glbUrl);
    });

    it('từ chối: đuôi lạ, sai chữ ký, vượt 50MB, định dạng không khớp, sản phẩm không tồn tại', async () => {
      const post = (b: object) =>
        api('post', '/admin/models', admin, { productId: pid, sizeMB: 1, format: 'glb', ...b });
      expect((await post({ fileName: 'a.exe', format: 'glb' })).status).toBe(400);
      expect(
        (await post({ fileName: 'fake.glb', fileData: b64(Buffer.from('<html>fake</html>')) })).status,
      ).toBe(400);
      expect((await post({ fileName: 'big.glb', sizeMB: 60 })).body.error.details.file[0]).toContain('50MB');
      expect((await post({ fileName: 'a.glb', format: 'usdz' })).status).toBe(400);
      expect(
        (
          await api('post', '/admin/models', admin, {
            productId: 999999,
            fileName: 'a.glb',
            format: 'glb',
            sizeMB: 1,
          })
        ).body.error.details.productId[0],
      ).toBe('Vui lòng chọn sản phẩm liên kết.');
    });

    it('multipart: upload tệp thật; tên tệp traversal được làm sạch; sai MIME bị từ chối', async () => {
      const ok = await http
        .post('/api/admin/models/upload')
        .set('Authorization', `Bearer ${admin}`)
        .field('productId', String(pid))
        .attach('file', GLB, { filename: '../../evil.glb', contentType: 'model/gltf-binary' });
      expect(ok.status).toBe(201);
      expect(ok.body.data.fileName).toBe('evil.glb');
      const bad = await http
        .post('/api/admin/models/upload')
        .set('Authorization', `Bearer ${admin}`)
        .field('productId', String(pid))
        .attach('file', GLB, { filename: 'x.glb', contentType: 'text/html' });
      expect(bad.status).toBe(400);
      const usdz = await http
        .post('/api/admin/models/upload')
        .set('Authorization', `Bearer ${admin}`)
        .field('productId', String(pid))
        .attach('file', Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(16)]), {
          filename: 'ghe.usdz',
          contentType: 'model/vnd.usdz+zip',
        });
      expect(usdz.status).toBe(201);
      expect(usdz.body.data.usdzUrl).toMatch(/\.usdz$/);
      expect(usdz.body.data.glbUrl).toMatch(/\.glb$/); // cùng mô hình có cả GLB và USDZ
    });

    it('danh sách lọc theo sản phẩm/định dạng; xóa tệp cuối ⇒ sản phẩm không còn mô hình', async () => {
      const byProd = await api('get', `/admin/models?productId=${pid}&pageSize=100`, admin);
      expect(byProd.body.data.length).toBeGreaterThanOrEqual(2);
      const usdzOnly = await api('get', `/admin/models?productId=${pid}&format=usdz`, admin);
      expect(usdzOnly.body.data.every((x: { format: string }) => x.format === 'usdz')).toBe(true);
      for (const row of byProd.body.data)
        expect((await api('delete', `/admin/models/${row.id}`, admin)).status).toBe(200);
      expect((await api('get', `/admin/models?productId=${pid}`, admin)).body.data).toHaveLength(0);
      const p = await prisma.product.findUniqueOrThrow({ where: { id: pid } });
      expect(p.has3dModel).toBe(false);
      expect((await api('get', `/products/${slug}/model`)).body.data).toBeNull();
      expect((await api('delete', `/admin/models/${fileId}`, admin)).status).toBe(404);
    });

    it('trình xem 3D và trang 360° nhận đúng file mô hình của sản phẩm có sẵn', async () => {
      const r = await api('get', '/products/sofa-nordic/model');
      expect(r.body.data.glbUrl).toMatch(/\.glb$/);
      const d = await api('get', '/products/sofa-nordic');
      expect(d.body.data.model.glbUrl).toBe(r.body.data.glbUrl);
      const v = await api('get', '/products/sofa-nordic/360');
      expect(v.body.data.product.model.glbUrl).toBe(r.body.data.glbUrl);
    });
  });
});
