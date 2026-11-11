// E2E (supertest) phễu không gian mẫu: GET /admin/stats/spaces trên aurelia_test, dữ liệu cụ thể trong một khoảng ngày riêng (2020)
// để không lẫn với dữ liệu seed; kiểm đúng số người xem, số bước phễu và tỉ lệ (gộp user và khách theo visitorId).
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('Phễu không gian mẫu (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  const api = (path: string, token?: string) => {
    const r = http.get(`/api${path}`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) => {
    const r = await http.post('/api/auth/login').send({ email, password, adminOnly });
    expect(r.status).toBe(200);
    return r.body.data.tokens.accessToken as string;
  };

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
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

  it('đếm đúng người xem, các bước phễu và tỉ lệ; gộp user và khách theo visitorId; sản phẩm dẫn tới', async () => {
    const stamp = Date.now();
    const mk = (n: string) =>
      prisma.space.create({
        data: {
          title: `Phễu ${n} ${stamp}`,
          slug: `phau-${n}-${stamp}`,
          roomType: 'living_room',
          status: 'published',
        },
      });
    const [A, B] = [await mk('a'), await mk('b')];
    const [prodP, prodQ] = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
      take: 2,
    });
    const user = await prisma.user.findFirstOrThrow({ where: { email: 'khachhang@aurelia.vn' } });
    const user2 = await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } });
    const [X, Y, Z, W] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const at = (d: string) => new Date(`${d}T09:00:00+07:00`);
    type V = {
      spaceId: number;
      visitorId?: string;
      userId?: number;
      clicks: number;
      cart: boolean;
      src?: number;
      d: string;
    };
    const rows: V[] = [
      // không gian A (khoảng 01–31/03/2020): 6 lượt xem, 5 người
      { spaceId: A.id, visitorId: X, clicks: 2, cart: false, d: '2020-03-02' }, // X khách: bấm hotspot
      { spaceId: A.id, visitorId: X, userId: user.id, clicks: 0, cart: true, d: '2020-03-03' }, // X đã đăng nhập (cùng visitorId): thêm giỏ
      { spaceId: A.id, visitorId: Y, clicks: 1, cart: false, src: prodP.id, d: '2020-03-04' },
      { spaceId: A.id, visitorId: Z, clicks: 0, cart: false, d: '2020-03-05' },
      { spaceId: A.id, userId: user2.id, clicks: 0, cart: true, src: prodP.id, d: '2020-03-06' }, // không có visitorId ⇒ gộp theo user
      { spaceId: A.id, visitorId: W, clicks: 3, cart: true, src: prodQ.id, d: '2020-03-31' }, // đúng ngày cuối (kiểm biên)
      // không gian B: 2 lượt, 1 người
      { spaceId: B.id, visitorId: Y, clicks: 1, cart: true, src: prodP.id, d: '2020-03-10' },
      { spaceId: B.id, visitorId: Y, clicks: 0, cart: false, d: '2020-03-11' },
      // ngoài khoảng: không được tính
      { spaceId: A.id, visitorId: randomUUID(), clicks: 5, cart: true, d: '2020-04-01' },
      { spaceId: A.id, visitorId: randomUUID(), clicks: 5, cart: true, d: '2020-02-29' },
    ];
    for (const r of rows)
      await prisma.spaceView.create({
        data: {
          spaceId: r.spaceId,
          visitorId: r.visitorId ?? null,
          userId: r.userId ?? null,
          hotspotClickCount: r.clicks,
          addedToCart: r.cart,
          sourceProductId: r.src ?? null,
          createdAt: at(r.d),
        },
      });

    const res = await api('/admin/stats/spaces?from=2020-03-01&to=2020-03-31', admin);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({ from: '2020-03-01', to: '2020-03-31' });

    const a = d.spaces.find((s: { spaceId: number }) => s.spaceId === A.id);
    // người xem: X (2 lượt gộp), Y, Z, user2, W = 5; bấm hotspot: X, Y, W = 3; thêm giỏ: X, user2, W = 3; cả hai: X, W = 2
    expect(a).toMatchObject({
      title: A.title,
      slug: A.slug,
      views: 6,
      viewers: 5,
      clicked: 3,
      carted: 3,
      clickRate: 0.6,
      cartRate: 0.6,
      clickToCartRate: 0.6667,
    });
    expect(a.sources).toEqual([
      { productId: prodP.id, name: prodP.name, slug: prodP.slug, views: 2, viewers: 2 },
      { productId: prodQ.id, name: prodQ.name, slug: prodQ.slug, views: 1, viewers: 1 },
    ]);

    const b = d.spaces.find((s: { spaceId: number }) => s.spaceId === B.id);
    // Y xem B hai lần ⇒ 1 người, bấm hotspot + thêm giỏ ở lượt đầu ⇒ cả ba bước đều 1/1
    expect(b).toMatchObject({
      views: 2,
      viewers: 1,
      clicked: 1,
      carted: 1,
      clickRate: 1,
      cartRate: 1,
      clickToCartRate: 1,
    });
    expect(b.sources).toEqual([
      { productId: prodP.id, name: prodP.name, slug: prodP.slug, views: 1, viewers: 1 },
    ]);

    // tổng toàn hệ thống trong khoảng: Y xem cả A và B nhưng chỉ tính MỘT người
    // người xem: X, Y, Z, user2, W = 5; bấm: X, Y, W = 3; giỏ: X, user2, W, Y (Y thêm giỏ ở B) = 4; cả hai: X, W, Y = 3
    expect(d.totals).toMatchObject({
      views: 8,
      viewers: 5,
      clicked: 3,
      carted: 4,
      clickRate: 0.6,
      cartRate: 0.8,
      clickToCartRate: 1,
    });
    // nguồn tổng hợp: P dẫn 3 lượt (Y ở A và B, user2 ở A) từ 2 người, 2 không gian; Q 1 lượt
    expect(d.sources).toEqual([
      { productId: prodP.id, name: prodP.name, slug: prodP.slug, views: 3, viewers: 2, spaces: 2 },
      { productId: prodQ.id, name: prodQ.name, slug: prodQ.slug, views: 1, viewers: 1, spaces: 1 },
    ]);

    // khoảng chỉ chứa 1/3 → dữ liệu khác; khoảng không có số liệu ⇒ rỗng, tỉ lệ 0
    const first = await api('/admin/stats/spaces?from=2020-03-02&to=2020-03-02', admin);
    expect(first.body.data.spaces).toHaveLength(1);
    expect(first.body.data.spaces[0]).toMatchObject({
      spaceId: A.id,
      views: 1,
      viewers: 1,
      clicked: 1,
      carted: 0,
      clickRate: 1,
      cartRate: 0,
      clickToCartRate: 0,
    });
    const none = await api('/admin/stats/spaces?from=2019-01-01&to=2019-01-31', admin);
    expect(none.status).toBe(200);
    expect(none.body.data.spaces).toEqual([]);
    expect(none.body.data.totals).toMatchObject({
      views: 0,
      viewers: 0,
      clickRate: 0,
      cartRate: 0,
      clickToCartRate: 0,
    });

    await prisma.spaceView.deleteMany({ where: { spaceId: { in: [A.id, B.id] } } });
    await prisma.space.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  });

  it('400 ngày sai định dạng / đảo ngược; 401 chưa đăng nhập; 403 khách hàng', async () => {
    expect((await api('/admin/stats/spaces?from=2020-13-45&to=2020-03-31', admin)).status).toBe(400);
    expect((await api('/admin/stats/spaces?from=abc', admin)).status).toBe(400);
    expect((await api('/admin/stats/spaces?from=2020-04-01&to=2020-03-01', admin)).status).toBe(400);
    expect((await api('/admin/stats/spaces')).status).toBe(401);
    expect((await api('/admin/stats/spaces', cust)).status).toBe(403);
    expect((await api('/admin/stats/spaces', admin)).status).toBe(200); // mặc định 30 ngày gần nhất
  });
});
