// UC-ADM-11 – Lưu sản phẩm KHÔNG được làm mất ảnh gắn màu (biến thể). Chạy trên aurelia_test.
// Quy tắc: chỉ gỡ ảnh nằm trong removedImageIds (admin bấm xóa trên form); ảnh không được gửi lên thì giữ nguyên.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

interface Img {
  id: number;
  mediaId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  variantId: number | null;
}
interface Product {
  id: number;
  images: Img[];
  variants: Array<{ id: number }>;
}

describe('Lưu sản phẩm giữ ảnh gắn màu (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  const tag = `${Date.now()}`;
  let seq = 0;

  const send = (method: 'post' | 'patch', path: string, body: object) =>
    http[method](`/api${path}`).set('Authorization', `Bearer ${admin}`).send(body);

  const rows = async (productId: number) =>
    (await prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } })).map(
      (r) => ({
        id: r.id,
        mediaId: r.mediaId,
        variantId: r.variantId,
        isPrimary: r.isPrimary,
        sortOrder: r.sortOrder,
      }),
    );

  /** Sản phẩm 2 màu; 4 ảnh: 2 ảnh chung, 1 ảnh màu Kem, 1 ảnh màu Đen. `primary` = vị trí ảnh đại diện */
  async function setup(primary = 0) {
    const n = ++seq;
    const colors = [
      { name: 'Kem', hex: '#E8DCC8' },
      { name: 'Đen', hex: '#2B2B2B' },
    ];
    const variant = (i: number, id?: number) => ({
      ...(id ? { id } : {}),
      color: colors[i],
      size: '1m6',
      sku: `COLIMG-${tag}-${n}-${i}`,
      price: 1_500_000,
      stockQuantity: 5,
    });
    const base = {
      name: `Sản phẩm ảnh màu ${n} ${tag}`,
      categoryId: 3,
      status: 'published',
      shortDescription: 'Mô tả ngắn',
      description: 'Mô tả',
      material: 'Gỗ',
    };
    const created = await send('post', '/admin/products', {
      ...base,
      variants: [variant(0), variant(1)],
      images: [{ url: PNG }, { url: PNG }, { url: PNG }, { url: PNG }],
    });
    expect(created.status).toBe(201);
    const p = created.body.data as Product;
    const variants = [variant(0, p.variants[0].id), variant(1, p.variants[1].id)];
    const patch = (body: Record<string, unknown>) =>
      send('patch', `/admin/products/${p.id}`, { ...base, variants, ...body });
    const [kem, den] = p.variants.map((v) => v.id);
    const tagged = await patch({
      images: p.images.map((im, i) => ({
        mediaId: im.mediaId,
        variantId: [null, null, kem, den][i],
        isPrimary: i === primary,
      })),
    });
    expect(tagged.status).toBe(200);
    return { id: p.id, patch, kem, den, images: tagged.body.data.images as Img[] };
  }

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

  it('lưu lại đầy đủ mọi ảnh, không đổi gì ⇒ các dòng ảnh y nguyên', async () => {
    const s = await setup();
    const before = await rows(s.id);
    const r = await s.patch({
      images: s.images.map((i) => ({ mediaId: i.mediaId, variantId: i.variantId, isPrimary: i.isPrimary })),
      removedImageIds: [],
    });
    expect(r.status).toBe(200);
    expect(await rows(s.id)).toEqual(before);
  });

  it('chỉ gửi ảnh chung (form không quản lý ảnh gắn màu) ⇒ ảnh gắn màu còn nguyên', async () => {
    const s = await setup();
    const before = await rows(s.id);
    const r = await s.patch({
      images: s.images
        .filter((i) => i.variantId === null)
        .map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
    });
    expect(r.status).toBe(200);
    expect(await rows(s.id)).toEqual(before);
  });

  it('ảnh đại diện là ảnh gắn màu và không được gửi lên ⇒ vẫn là ảnh đại diện', async () => {
    const s = await setup(2);
    const r = await s.patch({
      images: s.images
        .filter((i) => i.variantId === null)
        .map((i) => ({ url: i.url, isPrimary: i.isPrimary })),
    });
    expect(r.status).toBe(200);
    const after = await rows(s.id);
    expect(after).toHaveLength(4);
    expect(after.filter((x) => x.isPrimary).map((x) => x.id)).toEqual([s.images[2].id]);
    expect(after.map((x) => x.sortOrder)).toEqual([1, 2, 3, 4]);
    expect(after.find((x) => x.id === s.images[2].id)!.variantId).toBe(s.kem);
  });

  it('removedImageIds: gỡ đúng ảnh được xóa, kể cả ảnh gắn màu; ảnh khác không gửi lên vẫn giữ; media không bị xóa', async () => {
    const s = await setup();
    const [c1, c2, kem, den] = s.images;
    const r = await s.patch({ images: [{ mediaId: c1.mediaId }], removedImageIds: [den.id] });
    expect(r.status).toBe(200);
    const after = await rows(s.id);
    expect(after.map((x) => x.id)).toEqual([c1.id, c2.id, kem.id]);
    expect(after.map((x) => x.variantId)).toEqual([null, null, s.kem]);
    expect(await prisma.media.count({ where: { id: den.mediaId } })).toBe(1);
  });

  it('xóa ảnh đại diện ⇒ ảnh còn lại làm đại diện; id ảnh của sản phẩm khác trong removedImageIds bị bỏ qua', async () => {
    const s = await setup();
    const other = await setup();
    const [c1, ...rest] = s.images;
    const r = await s.patch({
      images: rest.map((i) => ({ mediaId: i.mediaId, variantId: i.variantId })),
      removedImageIds: [c1.id, other.images[0].id, 'abc'],
    });
    expect(r.status).toBe(200);
    const after = await rows(s.id);
    expect(after.map((x) => x.id)).toEqual(rest.map((i) => i.id));
    expect(after.filter((x) => x.isPrimary).map((x) => x.id)).toEqual([rest[0].id]);
    expect(await rows(other.id)).toHaveLength(4);
  });

  it('xóa hết ảnh của sản phẩm đang đăng ⇒ 400 theo trường images, không mất ảnh nào', async () => {
    const s = await setup();
    const r = await s.patch({ images: [], removedImageIds: s.images.map((i) => i.id) });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.details)).toContain('images');
    expect(await rows(s.id)).toHaveLength(4);
  });
});
