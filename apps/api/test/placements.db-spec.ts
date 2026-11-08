// E2E (supertest) UC-ADM-17 / UC-SPACE-05: đặt mô hình 3D vào ảnh 360° và "Đổi món", trên aurelia_test.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('Mô hình 3D trong ảnh 360° (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  let panoId = 0;
  let spaceId = 0;
  let slug = '';
  let productId = 0;
  let variantId = 0;
  let primaryModelId = 0;
  let otherProductVariant = 0;

  const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) => {
    const r = await api('post', '/auth/login', undefined, { email, password, adminOnly });
    expect(r.status).toBe(200);
    return r.body.data.tokens.accessToken as string;
  };
  const base = () => `/admin/panoramas/${panoId}/placements`;
  const good = () => ({ productId, variantId, yaw: 10, pitch: -15, distance: 3, rotationY: 90, scale: 1.2 });
  const logs = (action: string) => prisma.activityLog.count({ where: { action } });

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

    // không gian đã đăng; dùng ảnh đầu tiên. Dọn placement có sẵn để test kiểm đúng số lượng
    const space = await prisma.space.findFirstOrThrow({
      where: { status: 'published', spacePanoramas: { some: {} } },
      include: { spacePanoramas: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { id: 'desc' },
    });
    spaceId = space.id;
    slug = space.slug;
    panoId = space.spacePanoramas[0].id;
    await prisma.spaceProductPlacement.deleteMany({ where: { panoramaId: panoId } });

    // sản phẩm có mô hình chính ready, ≥ 1 biến thể, và có sản phẩm khác cùng danh mục cũng có mô hình ready
    const models = await prisma.product3DModel.findMany({
      where: { isPrimary: true, status: 'ready', product: { status: 'published', deletedAt: null } },
      include: { product: { include: { productVariants: true } } },
      orderBy: { id: 'asc' },
    });
    const pick = models.find(
      (m) =>
        m.product.productVariants.length > 0 &&
        models.some((o) => o.productId !== m.productId && o.product.categoryId === m.product.categoryId),
    )!;
    productId = pick.productId;
    primaryModelId = pick.id;
    variantId = pick.product.productVariants[0].id;
    otherProductVariant = (
      await prisma.productVariant.findFirstOrThrow({ where: { productId: { not: productId } } })
    ).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('POST đặt mô hình (mặc định mô hình chính), PATCH, GET, DELETE; ghi activity_logs', async () => {
    const c0 = await logs('placement.create');
    const created = await api('post', base(), admin, good());
    expect(created.status).toBe(201);
    const p = created.body.data;
    expect(p).toMatchObject({
      panoramaId: panoId,
      productId,
      variantId,
      modelId: primaryModelId, // không chọn modelId ⇒ mô hình chính
      yaw: 10,
      pitch: -15,
      distance: 3,
      rotationX: 0,
      rotationY: 90,
      rotationZ: 0,
      scale: 1.2,
    });
    expect(p.model.id).toBe(primaryModelId);
    expect(p.model.files.length).toBeGreaterThan(0);
    expect(p.model.files[0].url).toMatch(/\.glb/);
    expect(await logs('placement.create')).toBe(c0 + 1);

    const upd = await api('patch', `${base()}/${p.id}`, admin, { yaw: -40, scale: 0.8, rotationZ: 15 });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({
      yaw: -40,
      pitch: -15,
      distance: 3,
      scale: 0.8,
      rotationZ: 15,
      rotationY: 90,
    });
    expect(await logs('placement.update')).toBeGreaterThanOrEqual(1);

    const list = await api('get', base(), admin);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const pub = await api('get', `/spaces/${slug}`);
    expect(pub.status).toBe(200);
    const pubPano = pub.body.data.panoramas.find((x: { id: number }) => x.id === panoId);
    expect(pubPano.placements).toHaveLength(1);
    expect(pubPano.placements[0].model.files.length).toBeGreaterThan(0);

    const del = await api('delete', `${base()}/${p.id}`, admin);
    expect(del.status).toBe(200);
    expect(await prisma.spaceProductPlacement.count({ where: { panoramaId: panoId } })).toBe(0);
    expect(await logs('placement.delete')).toBeGreaterThanOrEqual(1);
    expect((await api('delete', `${base()}/${p.id}`, admin)).status).toBe(404);
    // ảnh chưa có placement ⇒ placements: [] như trước
    const pub2 = await api('get', `/spaces/${slug}`);
    expect(pub2.body.data.panoramas.find((x: { id: number }) => x.id === panoId).placements).toEqual([]);
  });

  it('400: scale ≤ 0, distance ≤ 0, thiếu vị trí, biến thể của sản phẩm khác, mô hình chưa ready / của sản phẩm khác', async () => {
    const bad = async (patch: object) => {
      const r = await api('post', base(), admin, { ...good(), ...patch });
      expect(r.status).toBe(400);
      return JSON.stringify(r.body.error);
    };
    expect(await bad({ scale: 0 })).toContain('scale');
    expect(await bad({ scale: -1 })).toContain('scale');
    expect(await bad({ distance: 0 })).toContain('distance');
    expect(await bad({ distance: -2 })).toContain('distance');
    expect(await bad({ pitch: 120 })).toContain('pitch');
    expect(await bad({ yaw: 'abc' })).toContain('yaw');
    expect(await bad({ variantId: otherProductVariant })).toContain('variantId');
    expect(await bad({ productId: 99999999 })).toContain('productId');
    const { yaw: _y, ...noYaw } = good();
    void _y;
    expect((await api('post', base(), admin, noYaw)).status).toBe(400);

    // mô hình chưa ready của chính sản phẩm; mô hình của sản phẩm khác
    const processing = await prisma.product3DModel.create({
      data: { productId, status: 'processing', isPrimary: false, lengthMm: 1, widthMm: 1, heightMm: 1 },
    });
    expect(await bad({ modelId: processing.id })).toContain('modelId');
    const foreign = await prisma.product3DModel.findFirstOrThrow({
      where: { productId: { not: productId }, status: 'ready' },
    });
    expect(await bad({ modelId: foreign.id })).toContain('modelId');
    await prisma.product3DModel.delete({ where: { id: processing.id } });

    // sản phẩm không có mô hình chính ready (không chọn modelId): tạm đặt mô hình chính của sản phẩm khác về processing
    await prisma.product3DModel.update({ where: { id: foreign.id }, data: { status: 'processing' } });
    try {
      expect(await bad({ productId: foreign.productId, variantId: undefined })).toContain('modelId');
    } finally {
      await prisma.product3DModel.update({ where: { id: foreign.id }, data: { status: 'ready' } });
    }
    expect(await prisma.spaceProductPlacement.count({ where: { panoramaId: panoId } })).toBe(0);
  });

  it('404 ảnh/vị trí không tồn tại; 401 chưa đăng nhập; 403 khách hàng', async () => {
    expect((await api('post', '/admin/panoramas/99999999/placements', admin, good())).status).toBe(404);
    expect((await api('patch', `${base()}/99999999`, admin, { yaw: 1 })).status).toBe(404);
    expect((await api('post', base(), undefined, good())).status).toBe(401);
    expect((await api('post', base(), cust, good())).status).toBe(403);
    expect((await api('get', base(), cust)).status).toBe(403);
  });

  it('GET /spaces/:slug/placements/:id/alternatives: cùng danh mục, có mô hình ready, không lưu vào DB', async () => {
    const created = await api('post', base(), admin, good());
    expect(created.status).toBe(201);
    const id = created.body.data.id as number;
    const before = await prisma.spaceProductPlacement.findUniqueOrThrow({ where: { id } });
    const count0 = await prisma.spaceProductPlacement.count();

    const r = await api('get', `/spaces/${slug}/placements/${id}/alternatives`);
    expect(r.status).toBe(200);
    const items = r.body.data as Array<{ id: number; variantId: number | null; model: { files: unknown[] } }>;
    expect(items.length).toBeGreaterThan(0);
    const cat = (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).categoryId;
    for (const it of items) {
      expect(it.id).not.toBe(productId);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: it.id } })).categoryId).toBe(cat);
      expect(it.model.files.length).toBeGreaterThan(0);
    }
    // KHÔNG lưu vào DB
    expect(await prisma.spaceProductPlacement.count()).toBe(count0);
    const after = await prisma.spaceProductPlacement.findUniqueOrThrow({ where: { id } });
    expect(after).toEqual(before);

    expect((await api('get', `/spaces/${slug}/placements/99999999/alternatives`)).status).toBe(404);
    expect((await api('get', `/spaces/khong-co-slug/placements/${id}/alternatives`)).status).toBe(404);
    await api('delete', `${base()}/${id}`, admin);
  });

  it('sửa không gian (PATCH có panoramas) không làm mất mô hình đã đặt', async () => {
    const created = await api('post', base(), admin, good());
    expect(created.status).toBe(201);
    const detail = await api('get', `/admin/spaces/${spaceId}`, admin);
    expect(detail.status).toBe(200);
    const panoramas = detail.body.data.panoramas.map(
      (p: { url: string; title: string | null; hotspots: object[] }) => ({
        url: p.url,
        title: p.title,
        hotspots: p.hotspots,
      }),
    );
    const upd = await api('patch', `/admin/spaces/${spaceId}`, admin, { panoramas });
    expect(upd.status).toBe(200);
    const kept = upd.body.data.panoramas[0].placements;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ productId, yaw: 10, pitch: -15, distance: 3, scale: 1.2 });
    await prisma.spaceProductPlacement.deleteMany({ where: { panorama: { spaceId } } });
  });
});
