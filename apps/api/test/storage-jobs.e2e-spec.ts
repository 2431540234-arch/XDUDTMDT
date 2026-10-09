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
  let adminToken: string;
  let userToken: string;
  let adminId: number;
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
    const jwt = app.get(JwtService);
    const admin = await prisma.user.create({
      data: { fullName: 'Admin test', email: `admin-${Date.now()}@test.local`, passwordHash: 'x' },
    });
    adminId = admin.id;
    const sign = (sub: number, roles: string[]) =>
      jwt.sign({ sub, roles }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' });
    adminToken = sign(adminId, ['admin']);
    userToken = sign(adminId, ['user']);
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

  it('GLB hợp lệ: PUT thẳng lên MinIO -> job -> 3 LOD, model_files đủ số liệu, status ready', async () => {
    const model = await newModel();
    const res = await uploadModel(model.id, fixture('sphere.glb'), 'glb', 'sphere.glb');
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ modelId: model.id, status: 'processing' });

    await waitFor(async () => (await statusOf(model.id)) === 'ready');

    const files = await prisma.modelFile.findMany({ where: { modelId: model.id }, include: { media: true } });
    expect(files.map((f) => f.lod).sort()).toEqual(['high', 'low', 'medium']);
    const by = Object.fromEntries(files.map((f) => [f.lod, f]));
    expect(by.high.polygonCount).toBeGreaterThan(by.medium.polygonCount as number);
    expect(by.medium.polygonCount).toBeGreaterThan(by.low.polygonCount as number);
    expect(by.high.textureResolution).toBeGreaterThan(by.low.textureResolution as number);
    for (const f of files) {
      expect(f.format).toBe('glb');
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(f.media.filePath).toBe(`models/${model.id}/sphere-${f.lod}.glb`); // key, không phải URL
    }

    // Bản đã xử lý đọc công khai được qua URL ghép từ STORAGE_PUBLIC_URL
    const pub = await fetch(`${publicBase()}/${by.high.media.filePath}`);
    expect(pub.status).toBe(200);
    expect(Buffer.from(await pub.arrayBuffer()).toString('ascii', 0, 4)).toBe('glTF');

    // Bucket private không đọc ẩn danh được
    const anon = await fetch(
      `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_PRIVATE}/models/incoming/${model.id}/x.glb`,
    );
    expect([403, 404]).toContain(anon.status);
  });

  it('GLB hỏng: job thất bại, status failed, không có model_files', async () => {
    const model = await newModel();
    const res = await uploadModel(model.id, fixture('broken.glb'), 'glb', 'broken.glb');
    expect(res.status).toBe(202);
    await waitFor(async () => (await statusOf(model.id)) === 'failed');
    expect(await prisma.modelFile.count({ where: { modelId: model.id } })).toBe(0);
  });

  it('USDZ: chỉ kiểm tra ZIP + checksum rồi chép sang bucket public', async () => {
    const model = await newModel();
    const fakeUsdz = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 7)]);
    const res = await uploadModel(model.id, fakeUsdz, 'usdz', 'sofa.usdz');
    expect(res.status).toBe(202);
    await waitFor(async () => (await statusOf(model.id)) === 'ready');
    const file = await prisma.modelFile.findFirstOrThrow({ where: { modelId: model.id } });
    expect(file).toMatchObject({ format: 'usdz', lod: 'high', isCompressed: false });
    expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
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
    const big = Buffer.alloc(6 * 1024 * 1024, 1);
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
