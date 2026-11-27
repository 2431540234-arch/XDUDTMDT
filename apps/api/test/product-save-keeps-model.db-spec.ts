// UC-ADM-09 + UC-ADM-13/32 – Lưu sản phẩm KHÔNG được ảnh hưởng mô hình 3D đang hiện hoặc đang chờ duyệt.
// Chạy trên aurelia_test. CẦN REDIS (job chuẩn hóa mô hình).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service';
import { createApprovedModel, uploadPending } from './model-helpers';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type Body = Record<string, unknown>;

describe('Lưu sản phẩm không ảnh hưởng mô hình 3D (aurelia_test) – cần Redis', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let storage: StorageService;
  const prisma = new PrismaClient();
  let admin = '';
  let seq = 0;

  const get = async (path: string) =>
    (await http.get(`/api${path}`).set('Authorization', `Bearer ${admin}`).expect(200)).body.data;

  /** Mọi thứ thuộc mô hình 3D của sản phẩm: dòng DB (kể cả updatedAt), tệp, cờ has3dModel, dữ liệu khách và admin thấy */
  const snapshot = async (productId: number, slug: string) => ({
    rows: await prisma.product3DModel.findMany({
      where: { productId },
      orderBy: { id: 'asc' },
      include: {
        modelFiles: { orderBy: { id: 'asc' }, include: { media: true } },
        modelMaterialVariants: { orderBy: { id: 'asc' } },
      },
    }),
    has3dModel: (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).has3dModel,
    publicModel: await get(`/products/${slug}/model`),
    // bỏ productName: lấy từ sản phẩm nên được phép đổi khi admin đổi tên
    adminList: ((await get(`/admin/models?productId=${productId}`)) as Body[]).map(
      ({ productName: _productName, ...model }) => model,
    ),
  });

  /** Khóa của các tệp chờ duyệt trong kho private */
  const pendingKeys = async (modelId: number) => {
    const row = await prisma.product3DModel.findUniqueOrThrow({ where: { id: modelId } });
    return JSON.stringify(row.viewerConfig).match(/models\/(pending|incoming)\/[^"]+\.glb/g) ?? [];
  };

  /** Sản phẩm 2 biến thể có một mô hình đang hiện (ready) và một mô hình đang chờ duyệt */
  async function setup() {
    const tag = `${Date.now()}-${++seq}`;
    const variant = (i: number) => ({
      sku: `KEEP3D-${tag}-${i}`,
      color: { name: i ? 'Đen' : 'Kem' },
      size: `1m${6 + i}`,
      price: 2_000_000,
      salePrice: 1_800_000,
      stockQuantity: 5,
    });
    const form: Body = {
      name: `Sản phẩm giữ mô hình ${tag}`,
      categoryId: 3,
      status: 'published',
      shortDescription: 'Mô tả ngắn',
      material: 'Gỗ',
    };
    const created = await http
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...form, variants: [variant(0), variant(1)], images: [{ url: PNG }] });
    if (created.status !== 201) throw new Error(JSON.stringify(created.body));
    const { id, slug } = created.body.data as { id: number; slug: string };
    const live = await createApprovedModel(http, prisma, admin, id);
    const waiting = await uploadPending(http, prisma, admin, id);
    const ids = (
      await prisma.productVariant.findMany({ where: { productId: id }, orderBy: { id: 'asc' } })
    ).map((v) => v.id);
    const variants = ids.map((vid, i) => ({ id: vid, ...variant(i) }));
    const patch = async (body: Body) => {
      const r = await http
        .patch(`/api/admin/products/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send(body);
      if (r.status !== 200) throw new Error(`${r.status} ${JSON.stringify(r.body)}`);
    };
    return { id, slug, live, waiting, form, variants, patch, sku: variants[0].sku };
  }

  /** Trước/sau giống hệt nhau, tệp chờ duyệt còn nguyên và mô hình chờ vẫn duyệt được */
  async function expectModelsUntouched(s: Awaited<ReturnType<typeof setup>>, save: () => Promise<void>) {
    const before = await snapshot(s.id, s.slug);
    expect(before.rows.map((m) => [m.id, m.status])).toEqual([
      [s.live, 'ready'],
      [s.waiting, 'pending_review'],
    ]);
    expect(before.publicModel).toMatchObject({ status: 'ready' });
    const keys = await pendingKeys(s.waiting);
    expect(keys.length).toBeGreaterThan(0);

    await save();

    expect(await snapshot(s.id, s.slug)).toEqual(before);
    for (const key of keys) expect(await storage.head(key, 'private')).not.toBeNull();
    for (const f of before.rows[0].modelFiles)
      expect(await storage.head(f.media.filePath, 'public')).not.toBeNull();
    await http
      .post(`/api/admin/models/${s.waiting}/approve`)
      .set('Authorization', `Bearer ${admin}`)
      .send({})
      .expect(200);
  }

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    storage = app.get(STORAGE_SERVICE);
    const r = await http
      .post('/api/auth/login')
      .send({ email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true });
    admin = r.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('lưu lại nguyên form (đủ trường) ⇒ mô hình đang hiện và chờ duyệt không đổi', async () => {
    const s = await setup();
    await expectModelsUntouched(s, () => s.patch({ ...s.form, variants: s.variants }));
  }, 180_000);

  it('sửa tên, giá, tồn kho và bỏ một biến thể ⇒ mô hình không đổi', async () => {
    const s = await setup();
    await expectModelsUntouched(s, () =>
      s.patch({
        ...s.form,
        name: `${s.form.name as string} (đã sửa)`,
        variants: [{ ...s.variants[0], price: 2_500_000, stockQuantity: 9 }],
      }),
    );
  }, 180_000);

  it('PATCH tối thiểu, không gửi variants ⇒ mô hình không đổi', async () => {
    const s = await setup();
    const { name, categoryId, shortDescription } = s.form;
    await expectModelsUntouched(s, () => s.patch({ name, categoryId, shortDescription }));
  }, 180_000);

  it('xóa hết dòng biến thể (variants = []) ⇒ mô hình không đổi', async () => {
    const s = await setup();
    await expectModelsUntouched(s, () =>
      s.patch({ ...s.form, variants: [], sku: s.sku, price: 1_500_000, stock: 4 }),
    );
  }, 180_000);
});
