// E2E (supertest) UC-SPACE-06: tìm không gian CÓ chứa một sản phẩm (để trang sản phẩm liên kết kèm ?from=<slug>) và ghi nhận
// sản phẩm nguồn khi khách rời trang, thể hiện ở thống kê phễu. Chạy trên aurelia_test.
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('Không gian chứa sản phẩm và sản phẩm nguồn (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await http
      .post('/api/auth/login')
      .send({ email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true });
    admin = r.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('GET /spaces?product=<slug>: đúng các không gian có điểm tương tác của sản phẩm đó; slug lạ ⇒ rỗng', async () => {
    const hs = await prisma.spaceHotspot.findMany({
      where: { type: 'product', productId: { not: null }, panorama: { space: { status: 'published' } } },
      include: { product: true, panorama: true },
    });
    expect(hs.length).toBeGreaterThan(0);
    const product = hs[0].product!;
    const expected = [
      ...new Set(hs.filter((h) => h.productId === product.id).map((h) => h.panorama.spaceId)),
    ].sort((a, b) => a - b);
    const r = await http.get(`/api/spaces?product=${product.slug}&pageSize=50`);
    expect(r.status).toBe(200);
    expect((r.body.data as Array<{ id: number }>).map((s) => s.id).sort((a, b) => a - b)).toEqual(expected);
    const all = await http.get('/api/spaces?pageSize=50');
    expect(all.body.data.length).toBeGreaterThan(expected.length); // thật sự có lọc
    const none = await http.get('/api/spaces?product=khong-co-san-pham-nay');
    expect(none.status).toBe(200);
    expect(none.body.data).toEqual([]);
  });

  it('rời trang không gian với sourceProductId = slug sản phẩm ⇒ ghi source_product_id và hiện ở phễu', async () => {
    const h = await prisma.spaceHotspot.findFirstOrThrow({
      where: { type: 'product', productId: { not: null }, panorama: { space: { status: 'published' } } },
      include: { product: true, panorama: { include: { space: true } } },
    });
    const slug = h.panorama.space.slug;
    const visitorId = randomUUID();
    const post = await http
      .post(`/api/spaces/${slug}/views`)
      .send({ visitorId, sourceProductId: h.product!.slug, hotspotClickCount: 1 });
    expect(post.status).toBe(204);
    const row = await prisma.spaceView.findFirstOrThrow({ where: { visitorId } });
    expect(row.sourceProductId).toBe(h.productId);
    // đặt lượt xem vào một ngày riêng (2030) để phễu của ngày đó chỉ có đúng lượt này (top 5/10 nguồn không lẫn dữ liệu seed)
    await prisma.spaceView.update({
      where: { id: row.id },
      data: { createdAt: new Date('2030-03-16T10:00:00+07:00') },
    });
    const stats = await http
      .get('/api/admin/stats/spaces?from=2030-03-16&to=2030-03-16')
      .set('Authorization', `Bearer ${admin}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data.sources).toEqual([
      {
        productId: h.productId,
        name: h.product!.name,
        slug: h.product!.slug,
        views: 1,
        viewers: 1,
        spaces: 1,
      },
    ]);
    expect(stats.body.data.spaces).toHaveLength(1);
    expect(stats.body.data.spaces[0]).toMatchObject({
      spaceId: h.panorama.spaceId,
      views: 1,
      viewers: 1,
      clicked: 1,
    });
    expect(stats.body.data.spaces[0].sources[0]).toMatchObject({ productId: h.productId, views: 1 });
    await prisma.spaceView.deleteMany({ where: { visitorId } });
  });
});
