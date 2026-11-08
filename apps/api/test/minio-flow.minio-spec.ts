// E2E với MinIO THẬT (npm run test:e2e:minio; tự bỏ qua nếu MinIO không chạy): presign → PUT → confirm cho panorama và mô hình,
// mô hình đi hết tới ready, URL ký đúng Content-Type/Content-Length, tệp gốc nằm ở bucket PRIVATE còn LOD ở bucket PUBLIC.
// Đồng thời kiểm THẬT các route presign/confirm từng chỉ được phân tích tĩnh: ActivityLogInterceptor ghi log khi service không ghi.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreateBucketCommand, PutBucketPolicyCommand, S3Client } from '@aws-sdk/client-s3';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const skip = process.env.MINIO_TESTS_SKIP === '1';
const suite = skip ? describe.skip : describe;
const SPHERE = readFileSync(resolve(__dirname, 'fixtures', 'sphere.glb'));
const PUB = 'aurelia-test-public';
const PRIV = 'aurelia-test-private';

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 60_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Hết thời gian chờ điều kiện');
    await new Promise((r) => setTimeout(r, 300));
  }
}

suite('MinIO thật: presign → PUT → confirm (aurelia_test + aurelia-test-* buckets)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let adminId = 0;
  const endpoint = process.env.S3_ENDPOINT as string;
  const s3 = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
  });
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${admin}`);
  const logs = (where: object) => prisma.activityLog.findMany({ where, orderBy: { id: 'asc' } });
  const newProduct = (label: string) => {
    const n = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    return prisma.product.create({
      data: {
        name: `Sản phẩm MinIO ${label} ${n}`,
        slug: `san-pham-minio-${label}-${n}`,
        status: 'published',
      },
    });
  };
  const putRaw = (url: string, body: Buffer, headers: Record<string, string>) =>
    fetch(url, { method: 'PUT', headers, body: new Uint8Array(body) });

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`Chỉ chạy trên aurelia_test (đang kết nối ${db})`);
    // bucket riêng của test: public cho đọc ẩn danh, private giữ nguyên
    for (const b of [PUB, PRIV]) await s3.send(new CreateBucketCommand({ Bucket: b })).catch(() => undefined);
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: PUB,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${PUB}/*`],
            },
          ],
        }),
      }),
    );
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    const r = await http
      .post('/api/auth/login')
      .send({ email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true });
    admin = r.body.data.tokens.accessToken;
    adminId = (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('GET /admin/media/upload-config ⇒ mode presigned khi driver minio', async () => {
    const r = await auth(http.get('/api/admin/media/upload-config'));
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ mode: 'presigned', driver: 'minio' });
    expect(r.body.data.limitsMB).toMatchObject({ image: 5, panorama: 20, model: 100 });
  });

  it('ảnh ≤ 5MB: multipart qua API, lưu bucket PUBLIC và mở được ẩn danh', async () => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#a33' } })
      .png()
      .toBuffer();
    const r = await auth(http.post('/api/admin/media')).attach('file', png, {
      filename: 'anh-minio.png',
      contentType: 'image/png',
    });
    expect(r.status).toBe(201);
    const got = await fetch(r.body.data.url);
    expect(got.status).toBe(200);
    expect(r.body.data.url).toContain(`/${PUB}/`);
  });

  it('panorama: presigned PUT vào bucket public ⇒ confirm tạo media; URL ký Content-Type và Content-Length; hết hạn theo cấu hình', async () => {
    const pano = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#468' } })
      .jpeg()
      .toBuffer();
    const pre = await auth(http.post('/api/admin/media/presign')).send({
      kind: 'panorama',
      fileName: 'pano-minio.jpg',
      mimeType: 'image/jpeg',
      size: pano.length,
    });
    expect(pre.status).toBe(200);
    const { key, uploadUrl, headers, expiresIn } = pre.body.data;
    expect(key).toMatch(/^panoramas\//);
    expect(expiresIn).toBe(Number(process.env.PRESIGN_EXPIRES_SECONDS ?? 900));
    const u = new URL(uploadUrl);
    expect(u.searchParams.get('X-Amz-Expires')).toBe(String(expiresIn));
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toMatch(/content-length/);
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toMatch(/content-type/);

    // sai dung lượng hoặc sai Content-Type ⇒ kho từ chối (chữ ký không khớp)
    const wrongSize = await putRaw(uploadUrl, Buffer.concat([pano, Buffer.from('x')]), headers);
    expect(wrongSize.status).toBe(403);
    const wrongType = await putRaw(uploadUrl, pano, { 'Content-Type': 'text/html' });
    expect(wrongType.status).toBe(403);
    // chưa PUT hợp lệ ⇒ confirm báo chưa thấy tệp
    const early = await auth(http.post('/api/admin/media/confirm')).send({
      key,
      kind: 'panorama',
      fileName: 'pano-minio.jpg',
      mimeType: 'image/jpeg',
    });
    expect(early.status).toBe(404);

    const ok = await putRaw(uploadUrl, pano, headers);
    expect(ok.status).toBe(200);
    const conf = await auth(http.post('/api/admin/media/confirm')).send({
      key,
      kind: 'panorama',
      fileName: 'pano-minio.jpg',
      mimeType: 'image/jpeg',
    });
    expect(conf.status).toBe(201);
    expect(conf.body.data).toMatchObject({ filePath: key, fileSize: pano.length });
    expect((await fetch(conf.body.data.url)).status).toBe(200); // bucket public đọc ẩn danh
    const media = await prisma.media.findFirstOrThrow({ where: { filePath: key } });
    expect(media.uploadedBy).toBe(adminId);

    // route presign/confirm không ghi log trong service ⇒ ActivityLogInterceptor ghi (kiểm THẬT, không chỉ phân tích tĩnh)
    const presignLogs = await logs({ action: 'media.presign', actorId: adminId });
    expect(presignLogs.length).toBeGreaterThanOrEqual(1);
    expect(presignLogs.at(-1)!.changes).toMatchObject({ auto: true, method: 'POST' });
    const confirmLogs = await logs({ action: 'media.confirm', actorId: adminId });
    expect(confirmLogs.length).toBeGreaterThanOrEqual(1);
    expect(confirmLogs.at(-1)!.changes).toMatchObject({ auto: true, method: 'POST' });
  });

  it('panorama quá 20MB bị từ chối ở bước presign (413); loại không phải ảnh bị 415', async () => {
    const big = await auth(http.post('/api/admin/media/presign')).send({
      kind: 'panorama',
      fileName: 'to.jpg',
      mimeType: 'image/jpeg',
      size: 21 * 1024 * 1024,
    });
    expect(big.status).toBe(413);
    const bad = await auth(http.post('/api/admin/media/presign')).send({
      kind: 'panorama',
      fileName: 'a.txt',
      mimeType: 'text/plain',
      size: 100,
    });
    expect(bad.status).toBe(415);
  });

  it('mô hình GLB: presign ⇒ PUT vào bucket PRIVATE ⇒ confirm 202 ⇒ job đọc private, ghi 3 LOD vào PUBLIC ⇒ ready', async () => {
    const p = await newProduct('glb');
    const pre = await auth(http.post('/api/admin/models/presign')).send({
      productId: p.id,
      fileName: 'sphere-minio.glb',
      size: SPHERE.length,
      format: 'glb',
      scale: 1.5,
      unit: 'cm',
    });
    expect(pre.status).toBe(200);
    const { modelId, key, uploadUrl, headers } = pre.body.data;
    expect(key).toMatch(new RegExp(`^models/incoming/${modelId}/[0-9a-f-]{36}\\.glb$`));
    expect(new URL(uploadUrl).pathname.startsWith(`/${PRIV}/`)).toBe(true); // bucket private
    expect((await prisma.product3DModel.findUniqueOrThrow({ where: { id: modelId } })).status).toBe(
      'uploading',
    );

    // đọc ẩn danh bucket private bị từ chối; PUT sai dung lượng bị từ chối
    expect((await fetch(`${endpoint}/${PRIV}/${key}`)).status).toBe(403);
    expect((await putRaw(uploadUrl, Buffer.concat([SPHERE, Buffer.from('x')]), headers)).status).toBe(403);
    // chưa PUT ⇒ confirm báo chưa thấy tệp
    const early = await auth(http.post(`/api/admin/models/${modelId}/files/confirm`)).send({
      key,
      format: 'glb',
      fileName: 'sphere-minio.glb',
    });
    expect(early.status).toBe(404);

    expect((await putRaw(uploadUrl, SPHERE, headers)).status).toBe(200);
    const conf = await auth(http.post(`/api/admin/models/${modelId}/files/confirm`)).send({
      key,
      format: 'glb',
      fileName: 'sphere-minio.glb',
    });
    expect(conf.status).toBe(202);
    expect(conf.body.data).toMatchObject({ modelId, status: 'processing' });

    await waitFor(
      async () => (await prisma.product3DModel.findUnique({ where: { id: modelId } }))?.status === 'ready',
    );
    const files = await prisma.modelFile.findMany({ where: { modelId }, include: { media: true } });
    expect(files.map((f) => f.lod).sort()).toEqual(['high', 'low', 'medium']);
    for (const f of files) {
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      const r = await fetch(`${endpoint}/${PUB}/${f.media.filePath}`); // LOD nằm ở bucket public
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toContain('model/gltf-binary');
    }
    expect((await fetch(`${endpoint}/${PRIV}/${key}`)).status).toBe(403); // tệp gốc vẫn ở private
    const pub = await http.get(`/api/products/${p.slug}/model`);
    expect(pub.body.data.files).toHaveLength(3);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(true);

    // log: confirm có log của service (model.upload); presign không ⇒ interceptor ghi 1 dòng chung
    expect(await logs({ action: 'model.upload', targetId: modelId })).toHaveLength(1);
    const presignLog = await logs({ action: 'models.presign', actorId: adminId });
    expect(presignLog.at(-1)!.changes).toMatchObject({ auto: true });
    expect(await logs({ targetId: modelId, changes: { path: ['auto'], equals: true } })).toHaveLength(0);
  });

  it('mô hình: >100MB ⇒ 413, USDZ ⇒ 415 "Hệ thống chỉ hỗ trợ tệp GLB", không tạo mô hình', async () => {
    const p = await newProduct('bad');
    const big = await auth(http.post('/api/admin/models/presign')).send({
      productId: p.id,
      fileName: 'to.glb',
      size: 101 * 1024 * 1024,
      format: 'glb',
    });
    expect(big.status).toBe(413);
    const usdz = await auth(http.post('/api/admin/models/presign')).send({
      productId: p.id,
      fileName: 'a.usdz',
      size: 100,
      format: 'usdz',
    });
    expect(usdz.status).toBe(415);
    expect(usdz.body.error.message).toBe('Hệ thống chỉ hỗ trợ tệp GLB');
    expect(await prisma.product3DModel.count({ where: { productId: p.id } })).toBe(0);
    expect((await http.post('/api/admin/models/presign').send({})).status).toBe(401);
  });

  it('GLB hỏng qua presigned: confirm 202 ⇒ job failed không retry ⇒ báo lỗi cho admin; xử lý lại dùng tệp gốc ở bucket private', async () => {
    const p = await newProduct('broken');
    const broken = readFileSync(resolve(__dirname, 'fixtures', 'broken.glb'));
    const pre = await auth(http.post('/api/admin/models/presign')).send({
      productId: p.id,
      fileName: 'broken.glb',
      size: broken.length,
      format: 'glb',
    });
    const { modelId, key, uploadUrl, headers } = pre.body.data;
    expect((await putRaw(uploadUrl, broken, headers)).status).toBe(200);
    const conf = await auth(http.post(`/api/admin/models/${modelId}/files/confirm`)).send({
      key,
      format: 'glb',
      fileName: 'broken.glb',
    });
    expect(conf.status).toBe(202);
    await waitFor(
      async () => (await prisma.product3DModel.findUnique({ where: { id: modelId } }))?.status === 'failed',
    );
    const re = await auth(http.post(`/api/admin/models/${modelId}/reprocess`));
    expect(re.status).toBe(202); // tệp gốc còn ở private nên xử lý lại được
    await waitFor(
      async () =>
        (await logs({ action: 'model.processing_failed', targetId: modelId })).length === 2 &&
        (await prisma.product3DModel.findUnique({ where: { id: modelId } }))?.status === 'failed',
    );
  });
});
