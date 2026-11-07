// E2E (supertest) Mốc 5 phần web trên aurelia_test: thương hiệu, thuộc tính, media, vận chuyển.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Mốc 5 (web) – thương hiệu, thuộc tính, media, vận chuyển (aurelia_test)', () => {
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
  const lastLog = (action: string) =>
    prisma.activityLog.findFirst({ where: { action }, orderBy: { id: 'desc' } });

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

  // ------------------------------------------------------------------------------------------ UC-ADM-06 thương hiệu
  describe('thương hiệu (UC-ADM-06)', () => {
    it('phân quyền: khách ⇒ 403, chưa đăng nhập ⇒ 401', async () => {
      for (const [m, p] of [
        ['get', '/admin/brands'],
        ['post', '/admin/brands'],
        ['patch', '/admin/brands/1'],
        ['delete', '/admin/brands/1'],
      ] as const) {
        expect((await api(m, p, cust, {})).status).toBe(403);
        expect((await api(m, p, undefined, {})).status).toBe(401);
      }
    });

    it('thêm: tên bắt buộc ≤ 150, slug tự sinh, slug trùng ⇒ 409, logo lưu thành media, ghi activity_logs', async () => {
      const bad = await api('post', '/admin/brands', admin, { name: '   ' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.details).toHaveProperty('name');
      expect((await api('post', '/admin/brands', admin, { name: 'x'.repeat(151) })).status).toBe(400);

      const ok = await api('post', '/admin/brands', admin, { name: 'Hãng Gỗ Việt', logoUrl: PNG });
      expect(ok.status).toBe(201);
      expect(ok.body.data).toMatchObject({
        name: 'Hãng Gỗ Việt',
        slug: 'hang-go-viet',
        isActive: true,
        productCount: 0,
      });
      expect(ok.body.data.logoUrl).toMatch(/^https?:\/\//);
      const log = await lastLog('brand.create');
      expect(log).toMatchObject({ actorId: 1, targetType: 'brand', targetId: ok.body.data.id });

      const dup = await api('post', '/admin/brands', admin, { name: 'Tên khác', slug: 'hang-go-viet' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.details).toHaveProperty('slug');
      // trùng slug sinh từ tên
      expect((await api('post', '/admin/brands', admin, { name: 'Hãng Gỗ Việt' })).status).toBe(409);
    });

    it('sửa: đổi tên giữ slug; đổi slug trùng ⇒ 409; bật/tắt; gửi lại slug của chính nó không báo trùng; 404', async () => {
      const b = (await api('post', '/admin/brands', admin, { name: 'Hãng A', slug: 'hang-a' })).body.data;
      const other = (await api('post', '/admin/brands', admin, { name: 'Hãng B', slug: 'hang-b' })).body.data;
      const ren = await api('patch', `/admin/brands/${b.id}`, admin, { name: 'Hãng A đổi tên' });
      expect(ren.status).toBe(200);
      expect(ren.body.data).toMatchObject({ name: 'Hãng A đổi tên', slug: 'hang-a' });
      expect((await api('patch', `/admin/brands/${b.id}`, admin, { slug: 'hang-b' })).status).toBe(409);
      expect((await api('patch', `/admin/brands/${b.id}`, admin, { slug: 'hang-a' })).status).toBe(200);
      expect(
        (await api('patch', `/admin/brands/${b.id}`, admin, { slug: 'hang-a-moi' })).body.data.slug,
      ).toBe('hang-a-moi');
      const off = await api('patch', `/admin/brands/${b.id}`, admin, { isActive: false });
      expect(off.body.data.isActive).toBe(false);
      expect((await api('patch', `/admin/brands/${b.id}`, admin, { isActive: 'khong' })).status).toBe(400);
      // thương hiệu tắt không còn ở danh sách công khai (ô chọn của khách), vẫn có ở admin
      expect((await api('get', '/brands')).body.data.some((x: { id: number }) => x.id === b.id)).toBe(false);
      expect(
        (await api('get', '/admin/brands', admin)).body.data.some((x: { id: number }) => x.id === b.id),
      ).toBe(true);
      const log = await lastLog('brand.update');
      expect(log!.changes).toMatchObject({ after: { slug: 'hang-a-moi' } });
      expect((await api('patch', '/admin/brands/999999', admin, { name: 'x' })).status).toBe(404);
      expect(other.id).toBeGreaterThan(0);
    });

    it('danh sách: số sản phẩm đúng, tìm không dấu; xóa thương hiệu đang có sản phẩm ⇒ sản phẩm brandId = NULL, nhật ký cùng transaction', async () => {
      const b = (await api('post', '/admin/brands', admin, { name: 'Thương hiệu để xóa' })).body.data;
      const prods = await prisma.product.findMany({
        where: { deletedAt: null },
        take: 2,
        orderBy: { id: 'asc' },
      });
      await prisma.product.updateMany({
        where: { id: { in: prods.map((p) => p.id) } },
        data: { brandId: b.id },
      });
      const list = await api('get', '/admin/brands?q=thuong%20hieu%20de%20xoa', admin);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].productCount).toBe(2);

      const del = await api('delete', `/admin/brands/${b.id}`, admin);
      expect(del.status).toBe(200);
      expect(del.body.data).toEqual({ id: b.id, productsDetached: 2 });
      expect(await prisma.brand.count({ where: { id: b.id } })).toBe(0);
      for (const p of prods)
        expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).brandId).toBeNull();
      const log = await lastLog('brand.delete');
      expect(log!.changes).toMatchObject({ name: 'Thương hiệu để xóa', productsDetached: 2 });
      expect((await api('delete', `/admin/brands/${b.id}`, admin)).status).toBe(404);
    });

    it('thao tác lỗi giữa chừng không để lại bản ghi nhật ký lẻ (ghi + nhật ký cùng transaction)', async () => {
      const before = await prisma.activityLog.count({ where: { action: 'brand.create' } });
      expect((await api('post', '/admin/brands', admin, { name: 'Hãng Gỗ Việt' })).status).toBe(409); // trùng slug ⇒ không ghi gì
      expect(await prisma.activityLog.count({ where: { action: 'brand.create' } })).toBe(before);
    });
  });
});
