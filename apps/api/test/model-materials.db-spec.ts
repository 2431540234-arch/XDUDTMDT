// E2E (supertest) UC-ADM-14 / UC-3D-03: vật liệu theo biến thể của mô hình 3D, trên aurelia_test.
// Ghi chú về "trùng": UNIQUE (model_id, variant_id) được thực thi bằng upsert nên PUT lần hai CẬP NHẬT chứ không báo 409
// (409 chỉ xảy ra khi hai yêu cầu tạo đồng thời đụng ràng buộc, khi đó bộ lọc lỗi trả 409 CONFLICT); test kiểm không tạo bản trùng.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service';

describe('Vật liệu theo biến thể (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  let modelId = 0;
  let slug = '';
  let variantId = 0;
  let otherVariantId = 0;
  let materialName = '';

  const api = (method: 'get' | 'put' | 'delete' | 'post', path: string, token?: string, body?: object) => {
    const r = (http as never as Record<string, (u: string) => request.Test>)[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) => {
    const r = await api('post', '/auth/login', undefined, { email, password, adminOnly });
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

    // một mô hình chính ready của sản phẩm có ≥ 2 biến thể + một biến thể của SẢN PHẨM KHÁC
    const m = await prisma.product3DModel.findFirstOrThrow({
      where: { isPrimary: true, status: 'ready', product: { productVariants: { some: {} } } },
      include: { product: { include: { productVariants: { orderBy: { id: 'asc' } } } } },
      orderBy: { id: 'asc' },
    });
    modelId = m.id;
    slug = m.product.slug;
    variantId = m.product.productVariants[0].id;
    const other = await prisma.productVariant.findFirstOrThrow({
      where: { productId: { not: m.productId } },
    });
    otherVariantId = other.id;
    // tệp GLB mẫu của seed nằm ở kho khác: ghi tệp fixture (vật liệu tên "mat") vào đúng khóa của LOD medium để đọc tên vật liệu
    const files = await prisma.modelFile.findMany({
      where: { modelId, format: 'glb' },
      include: { media: true },
    });
    const f = files.find((x) => x.lod === 'medium') ?? files[0];
    await app.get<StorageService>(STORAGE_SERVICE).upload({
      key: f.media.filePath,
      body: readFileSync(join(__dirname, 'fixtures', 'sphere.glb')),
      contentType: 'model/gltf-binary',
      visibility: 'public',
    });
    const names = await api('get', `/admin/models/${modelId}/materials`, admin);
    expect(names.status).toBe(200);
    expect(names.body.data.names.length).toBeGreaterThan(0);
    expect(names.body.data.names).toContain('mat'); // đọc từ GLB thật
    materialName = 'mat';
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  const put = (vid: number, body: object, token = admin) =>
    api('put', `/admin/models/${modelId}/material-variants/${vid}`, token, body);
  const count = () => prisma.modelMaterialVariant.count({ where: { modelId, variantId } });
  const logs = (action: string) =>
    prisma.activityLog.count({ where: { action, targetType: 'product3dmodel', targetId: modelId } });

  it('PUT tạo rồi thay thế (không tạo bản trùng), ghi activity_logs; GET danh sách; DELETE; xóa lại ⇒ 404', async () => {
    await prisma.modelMaterialVariant.deleteMany({ where: { modelId, variantId } });
    const created0 = await logs('model.material_create');
    const updated0 = await logs('model.material_update');

    const a = await put(variantId, {
      materialName,
      config: { baseColor: '#112233', roughness: 0.5, metalness: 0.1 },
    });
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({
      modelId,
      variantId,
      materialName,
      config: { baseColor: '#112233', roughness: 0.5, metalness: 0.1 },
    });
    expect(await count()).toBe(1);
    expect(await logs('model.material_create')).toBe(created0 + 1);

    const b = await put(variantId, { materialName, config: { baseColor: '#aabbcc' } }); // chữ thường ⇒ chuẩn hóa hoa
    expect(b.status).toBe(200);
    expect(b.body.data.config).toEqual({ baseColor: '#AABBCC' });
    expect(await count()).toBe(1); // UNIQUE (modelId, variantId): thay thế, không trùng
    expect(await logs('model.material_update')).toBe(updated0 + 1);

    const list = await api('get', `/admin/models/${modelId}/material-variants`, admin);
    expect(list.status).toBe(200);
    expect(
      list.body.data.find((r: { variantId: number }) => r.variantId === variantId).config.baseColor,
    ).toBe('#AABBCC');

    // khách thấy cấu hình trong GET /products/:slug/model (không cần API riêng)
    const pub = await api('get', `/products/${slug}/model`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.materialVariants).toEqual(
      expect.arrayContaining([{ variantId, materialName, config: { baseColor: '#AABBCC' } }]),
    );

    const del = await api('delete', `/admin/models/${modelId}/material-variants/${variantId}`, admin);
    expect(del.status).toBe(200);
    expect(await count()).toBe(0);
    expect(await logs('model.material_delete')).toBeGreaterThanOrEqual(1);
    const again = await api('delete', `/admin/models/${modelId}/material-variants/${variantId}`, admin);
    expect(again.status).toBe(404);
  });

  it('400: biến thể của sản phẩm khác; config sai (màu, khoảng 0–1, khóa lạ, rỗng); thiếu tên vật liệu', async () => {
    const other = await put(otherVariantId, { materialName, config: { baseColor: '#112233' } });
    expect(other.status).toBe(400);
    expect(JSON.stringify(other.body.error)).toContain('variantId');
    expect(await prisma.modelMaterialVariant.count({ where: { modelId, variantId: otherVariantId } })).toBe(
      0,
    );

    for (const config of [{ baseColor: 'đỏ' }, { roughness: 2 }, { metalness: -1 }, { shine: 1 }, {}, 'x']) {
      const r = await put(variantId, { materialName, config: config as never });
      expect(r.status).toBe(400);
    }
    expect((await put(variantId, { materialName: '  ', config: { baseColor: '#112233' } })).status).toBe(400);
    expect((await put(999999999, { materialName, config: { baseColor: '#112233' } })).status).toBe(400);
  });

  it('404 mô hình không tồn tại; 401 chưa đăng nhập; 403 khách hàng', async () => {
    const body = { materialName, config: { baseColor: '#112233' } };
    expect(
      (await api('put', `/admin/models/999999999/material-variants/${variantId}`, admin, body)).status,
    ).toBe(404);
    expect((await api('get', '/admin/models/999999999/materials', admin)).status).toBe(404);
    expect((await put(variantId, body, '')).status).toBe(401);
    for (const r of [
      await put(variantId, body, cust),
      await api('delete', `/admin/models/${modelId}/material-variants/${variantId}`, cust),
      await api('get', `/admin/models/${modelId}/material-variants`, cust),
      await api('get', `/admin/models/${modelId}/materials`, cust),
    ])
      expect(r.status).toBe(403);
  });
});
