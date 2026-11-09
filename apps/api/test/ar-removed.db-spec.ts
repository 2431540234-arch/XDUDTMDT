// E2E (supertest) D-T50: AR đã bị loại bỏ hoàn toàn khỏi CSDL và API; 3D/360°/không gian mẫu vẫn hoạt động. Chạy trên aurelia_test.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('Loại bỏ AR (D-T50) và giữ nguyên 3D/360° (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('CSDL không còn bảng, cột, enum chỉ phục vụ AR', async () => {
    const rows = async (sql: string) => prisma.$queryRawUnsafe<Array<{ n: string }>>(sql);
    expect(
      await rows(
        `SELECT table_name AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ar_sessions','ar_snapshots')`,
      ),
    ).toEqual([]);
    expect(
      await rows(
        `SELECT column_name AS n FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('has_ar','ar_session_id','ar_platform')`,
      ),
    ).toEqual([]);
    expect(await rows(`SELECT typname AS n FROM pg_type WHERE typname='ar_mode'`)).toEqual([]);
    expect(
      await rows(`SELECT indexname AS n FROM pg_indexes WHERE indexname='idx_products_has_3d_ar'`),
    ).toEqual([]);
    // Phần 3D vẫn còn nguyên
    expect(
      (
        await rows(
          `SELECT table_name AS n FROM information_schema.tables WHERE table_name IN ('product_3d_models','model_files','product_360_frames')`,
        )
      ).length,
    ).toBe(3);
    expect(
      (
        await rows(
          `SELECT column_name AS n FROM information_schema.columns WHERE table_name='products' AND column_name='has_3d_model'`,
        )
      ).length,
    ).toBe(1);
  });

  it('API không còn đường dẫn AR (404) và dữ liệu sản phẩm không có hasAr', async () => {
    for (const [method, path] of [
      ['post', '/api/ar-sessions'],
      ['patch', '/api/ar-sessions/1'],
      ['get', '/api/ar-snapshots'],
      ['post', '/api/ar-snapshots'],
      ['get', '/api/admin/ar-snapshots'],
      ['get', '/api/ar-overlay'],
    ] as const) {
      const r = await http[method](path).send({});
      expect([401, 404]).toContain(r.status); // 401 nếu guard chặn trước khi tìm route; không bao giờ là 2xx
    }
    const r = await http.get('/api/products?pageSize=100');
    expect(r.status).toBe(200);
    const items = r.body.data as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((x) => !('hasAr' in x))).toBe(true);
    expect(items.some((x) => x.has3dModel === true)).toBe(true);
    // bộ lọc hasAr không tồn tại: tham số lạ bị bỏ qua, không đổi kết quả
    const r2 = await http.get('/api/products?pageSize=100&hasAr=true');
    expect(r2.body.meta.total).toBe(r.body.meta.total);
  });

  it('3D/360° và không gian mẫu vẫn hoạt động', async () => {
    const list = await http.get('/api/products?has3d=true&pageSize=100');
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThan(0);
    const withModel = (list.body.data as Array<{ slug: string }>)[0].slug;
    const model = await http.get(`/api/products/${withModel}/model`);
    expect(model.status).toBe(200);
    expect(model.body.data).toHaveProperty('glbUrl');
    expect(model.body.data).not.toHaveProperty('usdzUrl');
    const has360 = await prisma.product.findFirst({
      where: { product360: { isNot: null }, status: 'published', deletedAt: null },
    });
    expect(has360).not.toBeNull();
    const r360 = await http.get(`/api/products/${has360!.slug}/360`);
    expect(r360.status).toBe(200);
    const spaces = await http.get('/api/spaces?pageSize=100');
    expect(spaces.status).toBe(200);
    expect(spaces.body.data.length).toBeGreaterThan(0);
  });
});
