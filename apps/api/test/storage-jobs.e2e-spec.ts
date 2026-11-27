// E2E với MinIO + Redis + PostgreSQL thật: presign -> PUT thẳng lên MinIO -> xác nhận -> job BullMQ -> kết quả trong DB.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name));

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 45_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Hết thời gian chờ điều kiện');
    await new Promise((r) => setTimeout(r, 300));
  }
}

describe('Storage + Jobs (e2e, MinIO + Redis thật)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let adminToken: string;
  let userToken: string;
  let adminId: number;
  let userId: number;
  let productId: number;
  const publicBase = () => process.env.STORAGE_PUBLIC_URL as string;

  const newModel = () =>
    prisma.product3DModel.create({ data: { productId, lengthMm: 800, widthMm: 800, heightMm: 800 } });

  /** presign -> PUT thẳng lên MinIO (không qua API) -> confirm; trả về phản hồi của confirm */
  async function uploadModel(modelId: number, body: Buffer, format: 'glb' | 'usdz', fileName: string) {
    const presign = await request(app.getHttpServer())
      .post(`/api/admin/models/${modelId}/files/presign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format, fileName, size: body.length })
      .expect(200);
    const { key, uploadUrl, headers } = presign.body.data;
    const put = await fetch(uploadUrl, { method: 'PUT', headers, body: new Uint8Array(body) });
    expect(put.status).toBe(200);
    return request(app.getHttpServer())
      .post(`/api/admin/models/${modelId}/files/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key, format, fileName });
  }

  const statusOf = async (id: number) => (await prisma.product3DModel.findUnique({ where: { id } }))?.status;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(STORAGE_SERVICE);
    const jwt = app.get(JwtService);
    const admin = await prisma.user.create({
      data: {
        fullName: 'Admin test',
        email: `admin-${Date.now()}@test.local`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    adminId = admin.id;
    // Vai trò lấy từ users.role (JwtAuthGuard đọc DB mỗi request): admin thật có đủ quyền theo ROLE_PERMISSIONS
    // người dùng thường RIÊNG (trước đây dùng chung id với admin và chỉ khác vai trò trong JWT)
    const normal = await prisma.user.create({
      data: { fullName: 'User test', email: `user-${Date.now()}@test.local`, passwordHash: 'x' },
    });
    userId = normal.id;
    const sign = (sub: number, roles: string[]) =>
      jwt.sign({ sub, roles }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' });
    adminToken = sign(adminId, ['admin']);
    userToken = sign(userId, ['user']);
    productId = (await prisma.product.create({ data: { name: 'SP test', slug: `sp-test-${Date.now()}` } }))
      .id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health báo database, redis, storage đều up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.checks).toMatchObject({ database: 'up', redis: 'up', storage: 'up' });
  });

  it('presign chỉ dành cho admin; user thường bị 403', async () => {
    const model = await newModel();
    await request(app.getHttpServer())
      .post(`/api/admin/models/${model.id}/files/presign`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ format: 'glb', fileName: 'a.glb', size: 10 })
      .expect(403);
  });

  it('presign từ chối tệp vượt UPLOAD_MAX_MODEL_MB bằng 413 PAYLOAD_TOO_LARGE', async () => {
    const model = await newModel();
    const res = await request(app.getHttpServer())
      .post(`/api/admin/models/${model.id}/files/presign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format: 'glb', fileName: 'big.glb', size: 101 * 1024 * 1024 })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('GLB hợp lệ: PUT lên MinIO -> job -> chờ duyệt (chưa công khai) -> duyệt -> ready, 3 LOD công khai', async () => {
    // sản phẩm ĐANG BÁN riêng cho ca này: khách xem được sản phẩm, nên "chưa thấy mô hình" là do chưa duyệt
    const slug = `sp-glb-${Date.now()}`;
    const product = await prisma.product.create({ data: { name: 'SP GLB', slug, status: 'published' } });
    const model = await prisma.product3DModel.create({
      data: { productId: product.id, lengthMm: 800, widthMm: 800, heightMm: 800 },
    });
    const publicModel = async () =>
      (await request(app.getHttpServer()).get(`/api/products/${slug}/model`).expect(200)).body.data;
    const has3d = async () =>
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).has3dModel;
    const anonStatus = async (url: string) => (await fetch(url)).status;
    const privateUrl = (key: string) => `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_PRIVATE}/${key}`;

    const res = await uploadModel(model.id, fixture('sphere.glb'), 'glb', 'sphere.glb');
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ modelId: model.id, status: 'processing' });

    await waitFor(async () => (await statusOf(model.id)) === 'pending_review');

    // CHƯA DUYỆT: khách không thấy; không có model_files/media; tệp chỉ nằm ở bucket private
    expect(await publicModel()).toBeNull();
    expect(await has3d()).toBe(false);
    expect(await prisma.modelFile.count({ where: { modelId: model.id } })).toBe(0);
    expect(await prisma.media.count({ where: { filePath: { startsWith: `models/${model.id}/` } } })).toBe(0);
    const row = await prisma.product3DModel.findUniqueOrThrow({ where: { id: model.id } });
    const { pipeline } = row.viewerConfig as unknown as {
      pipeline: {
        rawKey: string;
        variants: Record<string, { files: Record<string, { key: string; checksum: string }> }>;
      };
    };
    const pending = Object.values(pipeline.variants).flatMap((v) => Object.entries(v.files));
    expect(pending.length).toBeGreaterThanOrEqual(3);
    const privateKeys = [pipeline.rawKey, ...pending.map(([, f]) => f.key)];
    for (const key of privateKeys) {
      expect(await storage.head(key, 'private')).not.toBeNull();
      expect(await storage.head(key, 'public')).toBeNull();
      expect([403, 404]).toContain(await anonStatus(`${publicBase()}/${key}`));
      expect(await anonStatus(privateUrl(key))).toBe(403); // tệp có thật nhưng không đọc ẩn danh được
    }
    // địa chỉ công khai mà bản duyệt sẽ dùng: lúc này chưa đọc được
    for (const [lod, f] of pending) {
      const future = `models/${model.id}/sphere-${lod}-${f.checksum.slice(0, 12)}.glb`;
      expect([403, 404]).toContain(await anonStatus(`${publicBase()}/${future}`));
    }

    await request(app.getHttpServer())
      .post(`/api/admin/models/${model.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(await statusOf(model.id)).toBe('ready');
    expect(await has3d()).toBe(true);
    expect(await publicModel()).toMatchObject({ status: 'ready' });
    const files = await prisma.modelFile.findMany({ where: { modelId: model.id }, include: { media: true } });
    expect(files.map((f) => f.lod).sort()).toEqual(['high', 'low', 'medium']);
    const by = Object.fromEntries(files.map((f) => [f.lod, f]));
    expect(by.high.polygonCount).toBeGreaterThan(by.medium.polygonCount as number);
    expect(by.medium.polygonCount).toBeGreaterThan(by.low.polygonCount as number);
    expect(by.high.textureResolution).toBeGreaterThan(by.low.textureResolution as number);
    for (const f of files) {
      expect(f.format).toBe('glb');
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      // key (không phải URL), tên mang 12 ký tự đầu của checksum
      expect(f.media.filePath).toBe(`models/${model.id}/sphere-${f.lod}-${f.checksum!.slice(0, 12)}.glb`);
      // đã duyệt: đọc công khai được qua URL ghép từ STORAGE_PUBLIC_URL
      const pub = await fetch(`${publicBase()}/${f.media.filePath}`);
      expect(pub.status).toBe(200);
      expect(Buffer.from(await pub.arrayBuffer()).toString('ascii', 0, 4)).toBe('glTF');
    }
    // duyệt xong: tệp tạm và tệp thô ở bucket private đã được dọn
    for (const key of privateKeys) expect(await storage.head(key, 'private')).toBeNull();
  });

  it('GLB hỏng: job thất bại, status failed, không có model_files', async () => {
    const model = await newModel();
    const res = await uploadModel(model.id, fixture('broken.glb'), 'glb', 'broken.glb');
    expect(res.status).toBe(202);
    await waitFor(async () => (await statusOf(model.id)) === 'failed');
    expect(await prisma.modelFile.count({ where: { modelId: model.id } })).toBe(0);
  });

  it('USDZ bị từ chối 415 ở bước presign (AR ngoài phạm vi, D-P11)', async () => {
    const model = await newModel();
    await request(app.getHttpServer())
      .post(`/api/admin/models/${model.id}/files/presign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format: 'usdz', fileName: 'sofa.usdz', size: 100 })
      .expect(415);
  });

  it('ảnh thường: tải multipart qua API -> lưu MinIO + media, job sinh webp và thumbnail', async () => {
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#a33' } })
      .png()
      .toBuffer();
    const res = await request(app.getHttpServer())
      .post('/api/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('altText', 'Ghế đỏ')
      .attach('file', png, { filename: 'ghe.png', contentType: 'image/png' })
      .expect(201);
    const key: string = res.body.data.filePath;
    expect(key).toMatch(/^images\/\d{4}\/\d{2}\/.+\.png$/);
    expect(res.body.data).toMatchObject({
      url: `${publicBase()}/${key}`,
      altText: 'Ghế đỏ',
      mimeType: 'image/png',
    });

    const stem = key.replace(/\.png$/, '');
    const thumb = await waitFor(async () => {
      const r = await fetch(`${publicBase()}/${stem}_thumb.webp`);
      return r.status === 200 ? r : null;
    });
    const meta = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(400);
  });

  it('ảnh thường vượt UPLOAD_MAX_IMAGE_MB bị 413; sai định dạng bị 415', async () => {
    // MediaService kiểm tra CHỮ KÝ tệp trước dung lượng (415 cho nội dung giả mạo): tệp quá lớn phải có chữ ký JPEG hợp lệ để chạm tới nhánh 413
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6 * 1024 * 1024, 1)]);
    const fake = Buffer.alloc(6 * 1024 * 1024, 1); // khai báo JPEG nhưng không có chữ ký JPEG ⇒ 415, không phải 413
    await request(app.getHttpServer())
      .post('/api/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', fake, { filename: 'fake.jpg', contentType: 'image/jpeg' })
      .expect(415);
    const tooBig = await request(app.getHttpServer())
      .post('/api/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', big, { filename: 'big.jpg', contentType: 'image/jpeg' })
      .expect(413);
    expect(tooBig.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    const wrong = await request(app.getHttpServer())
      .post('/api/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('GIF89a'), { filename: 'a.gif', contentType: 'image/gif' })
      .expect(415);
    expect(wrong.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('panorama: presigned PUT -> confirm tạo media (bucket public) và job sinh webp 8192 + thumbnail', async () => {
    const jpg = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#468' } })
      .jpeg()
      .toBuffer();
    const presign = await request(app.getHttpServer())
      .post('/api/admin/media/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'panorama', fileName: 'phong-khach.jpg', mimeType: 'image/jpeg', size: jpg.length })
      .expect(200);
    const { key, uploadUrl, headers } = presign.body.data;
    expect(key).toMatch(/^panoramas\//);
    expect((await fetch(uploadUrl, { method: 'PUT', headers, body: new Uint8Array(jpg) })).status).toBe(200);

    const confirm = await request(app.getHttpServer())
      .post('/api/admin/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key, kind: 'panorama', fileName: 'phong-khach.jpg', mimeType: 'image/jpeg' })
      .expect(201);
    expect(confirm.body.data.filePath).toBe(key);
    const stem = key.replace(/\.jpg$/, '');
    await waitFor(async () => (await fetch(`${publicBase()}/${stem}_thumb.webp`)).status === 200);
    expect((await fetch(`${publicBase()}/${stem}.webp`)).status).toBe(200);
  });

  it('panorama vượt UPLOAD_MAX_PANORAMA_MB bị 413; kind ảnh thường không được presign', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/media/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'panorama', fileName: 'x.jpg', mimeType: 'image/jpeg', size: 21 * 1024 * 1024 })
      .expect(413);
    await request(app.getHttpServer())
      .post('/api/admin/media/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kind: 'image', fileName: 'x.jpg', mimeType: 'image/jpeg', size: 100 })
      .expect(400);
  });

  it('Bull Board /admin/queues chặn khi không có token admin', async () => {
    await request(app.getHttpServer()).get('/admin/queues').expect(401);
    await request(app.getHttpServer())
      .get('/admin/queues')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});
