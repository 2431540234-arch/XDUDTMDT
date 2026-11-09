// E2E (supertest) xử lý nền mô hình 3D – UC-ADM-13, D-N21, D-N22 – trên aurelia_test. CẦN REDIS (hàng đợi BullMQ) + Postgres.
// Tải lên ⇒ 202 processing ⇒ job model-processing ⇒ ready/failed. Mỗi nhóm test tự tạo sản phẩm riêng, không dùng dữ liệu mẫu.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { getIO } from '../src/modules/jobs/model-processing/glb-tools';

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name));
const SPHERE = fixture('sphere.glb');
const BROKEN = fixture('broken.glb');
const USDZ = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(64, 9)]);
const b64 = (b: Buffer) => `data:application/octet-stream;base64,${b.toString('base64')}`;

/** GLB có texture nhiễu 2048x2048 (khó nén) ⇒ LOD high > 5 MB, để thử ngưỡng D-N21 mà không cần đổi cấu hình */
async function heavyGlb(): Promise<Buffer> {
  const io = await getIO();
  const doc = await io.readBinary(new Uint8Array(SPHERE));
  const size = 2048;
  const noise = randomBytes(size * size * 3); // nhiễu thật ⇒ PNG không nén được (~12 MB)
  const png = await sharp(noise, { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 1 })
    .toBuffer();
  for (const tex of doc.getRoot().listTextures()) tex.setImage(new Uint8Array(png)).setMimeType('image/png');
  return Buffer.from(await io.writeBinary(doc));
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 60_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Hết thời gian chờ điều kiện (job xử lý mô hình 3D)');
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('Xử lý nền mô hình 3D (UC-ADM-13) – cần Redis', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  let adminId = 0;
  let queue: Queue;
  let seq = 0;

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
  /** Mỗi test tự tạo sản phẩm riêng (published, có slug duy nhất) */
  const newProduct = async (label: string) => {
    const n = `${Date.now()}-${++seq}`;
    return prisma.product.create({
      data: { name: `Sản phẩm 3D ${label} ${n}`, slug: `san-pham-3d-${label}-${n}`, status: 'published' },
    });
  };
  const upload = (productId: number, buf: Buffer, filename: string, extra: Record<string, string> = {}) => {
    const r = http
      .post('/api/admin/models/upload')
      .set('Authorization', `Bearer ${admin}`)
      .field('productId', String(productId));
    for (const [k, v] of Object.entries(extra)) r.field(k, v);
    return r.attach('file', buf, {
      filename,
      contentType: filename.endsWith('.usdz') ? 'model/vnd.usdz+zip' : 'model/gltf-binary',
    });
  };
  const statusOf = async (id: number) => (await prisma.product3DModel.findUnique({ where: { id } }))?.status;
  const waitStatus = (id: number, status: string) => waitFor(async () => (await statusOf(id)) === status);

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    queue = app.get(getQueueToken('model-processing'));
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
    adminId = (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('GLB hợp lệ: 202 processing ⇒ job ⇒ ready; 3 LOD, checksum, nén; public chỉ trả khi ready; cờ has3dModel do trigger', async () => {
    const p = await newProduct('glb');
    const r = await upload(p.id, SPHERE, 'sphere.glb', { scale: '1.5', unit: 'cm' });
    expect(r.status).toBe(202);
    const { modelId, jobId, status } = r.body.data;
    expect(status).toBe('processing');
    expect(typeof jobId).toBe('string');

    // job dùng 3 lần thử, backoff lũy thừa (D-T21)
    const job = await queue.getJob(jobId);
    expect(job?.opts.attempts).toBe(3);
    expect(job?.opts.backoff).toMatchObject({ type: 'exponential' });
    expect(job?.data).toMatchObject({ modelId, format: 'glb', uploadedBy: adminId });

    await waitStatus(modelId, 'ready');
    const files = await prisma.modelFile.findMany({
      where: { modelId },
      include: { media: true },
      orderBy: { id: 'asc' },
    });
    expect(files.map((f) => f.lod).sort()).toEqual(['high', 'low', 'medium']);
    const poly = Object.fromEntries(files.map((f) => [f.lod, f.polygonCount as number]));
    expect(poly.high).toBeGreaterThan(poly.medium);
    expect(poly.medium).toBeGreaterThan(poly.low);
    for (const f of files) {
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(f.isCompressed).toBe(true);
      expect(f.textureResolution).toBeGreaterThan(0);
      expect(f.media.filePath).toBe(`models/${modelId}/sphere-${f.lod}.glb`);
      expect(f.media.fileSize).toBeLessThanOrEqual(5 * 1024 * 1024);
    }
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(true);

    const pub = await api('get', `/products/${p.slug}/model`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('ready');
    expect(pub.body.data.files.map((f: { lod: string }) => f.lod).sort()).toEqual(['high', 'low', 'medium']);
    expect(pub.body.data.glbUrl).toMatch(/sphere-medium\.glb$/); // mặc định LOD medium
    expect(pub.body.data.viewerConfig).toMatchObject({ scale: 1.5, unit: 'cm' });
  }, 90_000);

  it('đang processing: public chưa trả mô hình (null) và sản phẩm chưa có has3dModel', async () => {
    const p = await newProduct('proc');
    // mô hình ở trạng thái processing nhưng chưa có job (tự dựng) ⇒ không bao giờ lộ ra public
    const m = await prisma.product3DModel.create({
      data: {
        productId: p.id,
        lengthMm: 800,
        widthMm: 800,
        heightMm: 800,
        status: 'processing',
        isPrimary: true,
      },
    });
    expect((await api('get', `/products/${p.slug}/model`)).body.data).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(false);
    const list = await api('get', `/admin/models?productId=${p.id}`, admin);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      modelId: m.id,
      status: 'processing',
      fileId: null,
      failureReason: null,
    });
  });

  it('JSON data-URL: 202; thiếu fileData ⇒ 400 (không còn dùng tệp mẫu); từ chối đuôi lạ, sai chữ ký, >100MB, sai định dạng', async () => {
    const p = await newProduct('json');
    const post = (b: object) => api('post', '/admin/models', admin, { productId: p.id, format: 'glb', ...b });
    const ok = await post({ fileName: 'ghe.glb', fileData: b64(SPHERE) });
    expect(ok.status).toBe(202);
    expect(ok.body.data).toMatchObject({ status: 'processing' });
    await waitStatus(ok.body.data.modelId, 'ready');

    const noFile = await post({ fileName: 'a.glb', sizeMB: 1 });
    expect(noFile.status).toBe(400);
    expect(noFile.body.error.details.file[0]).toContain('chọn tệp');
    expect((await post({ fileName: 'a.exe', fileData: b64(SPHERE) })).status).toBe(415);
    expect(
      (await post({ fileName: 'fake.glb', fileData: b64(Buffer.from('<html>fake</html>')) })).status,
    ).toBe(400);
    expect((await post({ fileName: 'big.glb', sizeMB: 110 })).body.error.details.file[0]).toContain('100MB');
    expect((await post({ fileName: 'a.glb', format: 'usdz', fileData: b64(SPHERE) })).status).toBe(415);
    expect(
      (
        await api('post', '/admin/models', admin, {
          productId: 999999,
          fileName: 'a.glb',
          format: 'glb',
          fileData: b64(SPHERE),
        })
      ).body.error.details.productId[0],
    ).toBe('Vui lòng chọn sản phẩm liên kết.');
  }, 90_000);

  it('multipart: tên tệp traversal được làm sạch; sai MIME bị từ chối; không có tệp ⇒ 400; 100 MB + 1 byte ⇒ 400', async () => {
    const p = await newProduct('mp');
    const ok = await upload(p.id, SPHERE, '../../evil.glb');
    expect(ok.status).toBe(202);
    const up = await prisma.activityLog.findFirstOrThrow({
      where: { action: 'model.upload', targetId: ok.body.data.modelId },
    });
    expect((up.changes as { fileName: string }).fileName).toBe('evil.glb');
    expect((up.changes as { sourceKey: string }).sourceKey).toMatch(
      /^models\/incoming\/p\d+\/[0-9a-f-]{36}\.glb$/,
    );
    await waitStatus(ok.body.data.modelId, 'ready');

    const bad = await http
      .post('/api/admin/models/upload')
      .set('Authorization', `Bearer ${admin}`)
      .field('productId', String(p.id))
      .attach('file', SPHERE, { filename: 'x.glb', contentType: 'text/html' });
    expect(bad.status).toBe(400);
    const none = await http
      .post('/api/admin/models/upload')
      .set('Authorization', `Bearer ${admin}`)
      .field('productId', String(p.id));
    expect(none.status).toBe(400);
    const over = await upload(
      p.id,
      Buffer.concat([Buffer.from('glTF'), Buffer.alloc(100 * 1024 * 1024 - 3, 1)]),
      'lon.glb',
    );
    expect(over.status).toBe(400);
    expect(over.body.error.details.file[0]).toContain('100MB');
  }, 120_000);

  it('GLB hỏng: failed, KHÔNG retry, không có model_files; activity_logs + thông báo cho admin tải lên; list có failureReason', async () => {
    const p = await newProduct('broken');
    const r = await upload(p.id, BROKEN, 'broken.glb');
    expect(r.status).toBe(202);
    const { modelId, jobId } = r.body.data;
    await waitStatus(modelId, 'failed');
    expect(await prisma.modelFile.count({ where: { modelId } })).toBe(0);
    const job = await queue.getJob(jobId);
    expect(job?.attemptsMade).toBe(1); // lỗi tệp hỏng không được thử lại

    const log = await prisma.activityLog.findFirstOrThrow({
      where: { action: 'model.processing_failed', targetId: modelId },
    });
    expect(log.actorId).toBe(adminId);
    expect((log.changes as { reason: string }).reason).toMatch(/GLB/);
    const note = await prisma.notification.findFirst({
      where: { userId: adminId, title: { contains: 'broken.glb' } },
      orderBy: { id: 'desc' },
    });
    expect(note).not.toBeNull();

    const list = await api('get', `/admin/models?productId=${p.id}`, admin);
    expect(list.body.data[0]).toMatchObject({ status: 'failed', fileName: 'broken.glb', fileId: null });
    expect(list.body.data[0].failureReason).toMatch(/GLB/);
    expect((await api('get', `/products/${p.slug}/model`)).body.data).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(false);

    // xóa mô hình lỗi (chưa có tệp) qua DELETE /admin/models/model/:modelId
    expect((await api('delete', `/admin/models/model/${modelId}`, admin)).status).toBe(200);
    expect(await statusOf(modelId)).toBeUndefined();
  }, 90_000);

  it('LOD vượt MODEL_SERVE_MAX_MB (D-N21): failed + activity_logs + thông báo trong một transaction, không tạo model_files', async () => {
    const p = await newProduct('heavy');
    const r = await upload(p.id, await heavyGlb(), 'nang.glb');
    expect(r.status).toBe(202);
    const { modelId, jobId } = r.body.data;
    await waitStatus(modelId, 'failed');
    expect(await prisma.modelFile.count({ where: { modelId } })).toBe(0);
    expect((await queue.getJob(jobId))?.attemptsMade).toBe(1); // vượt ngưỡng: chạy lại cũng vậy ⇒ không retry

    const log = await prisma.activityLog.findFirstOrThrow({
      where: { action: 'model.processing_failed', targetId: modelId },
    });
    expect((log.changes as { reason: string }).reason).toMatch(/vượt ngưỡng 5 MB/);
    const note = await prisma.notification.findFirst({
      where: { userId: adminId, title: { contains: 'nang.glb' } },
    });
    expect(note).not.toBeNull();
    expect((note!.data as { content: string }).content).toMatch(/vượt ngưỡng/);
    const list = await api('get', `/admin/models?productId=${p.id}`, admin);
    expect(list.body.data[0].failureReason).toMatch(/vượt ngưỡng 5 MB/);
  }, 120_000);

  it('AR ngoài phạm vi (D-P11): USDZ/GLTF bị từ chối 415 "Hệ thống chỉ hỗ trợ tệp GLB", không tạo mô hình; sản phẩm has_ar luôn false', async () => {
    const p = await newProduct('usdz');
    const before = await prisma.product3DModel.count({ where: { productId: p.id } });
    for (const [buf, name] of [
      [USDZ, 'ghe.usdz'],
      [SPHERE, 'ghe.gltf'],
    ] as const) {
      const bad = await upload(p.id, buf, name);
      expect(bad.status).toBe(415);
      expect(bad.body.error.message).toBe('Hệ thống chỉ hỗ trợ tệp GLB');
    }
    const json = await api('post', '/admin/models', admin, {
      productId: p.id,
      fileName: 'ghe.usdz',
      format: 'usdz',
      fileData: b64(USDZ),
    });
    expect(json.status).toBe(415);
    expect(json.body.error.message).toBe('Hệ thống chỉ hỗ trợ tệp GLB');
    expect(await prisma.product3DModel.count({ where: { productId: p.id } })).toBe(before);

    // luồng presign (MinIO) cũng từ chối USDZ
    const m = await prisma.product3DModel.create({
      data: { productId: p.id, lengthMm: 1, widthMm: 1, heightMm: 1, status: 'failed' },
    });
    const pre = await api('post', `/admin/models/${m.id}/files/presign`, admin, {
      format: 'usdz',
      fileName: 'a.usdz',
      size: 100,
    });
    expect(pre.status).toBe(415);

    // GLB hợp lệ ⇒ ready, has3dModel bật
    const g = await upload(p.id, SPHERE, 'ghe.glb');
    await waitStatus(g.body.data.modelId, 'ready');
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(prod.has3dModel).toBe(true);
    expect(prod).not.toHaveProperty('hasAr'); // AR đã bị loại bỏ khỏi mô hình dữ liệu (D-T50)
    expect((await api('get', `/products/${p.slug}/model`)).body.data).not.toHaveProperty('usdzUrl');
    expect(await prisma.modelFile.count({ where: { modelId: g.body.data.modelId, format: 'usdz' } })).toBe(0);
  }, 90_000);

  it('tải lại cùng định dạng/LOD ghi đè (upsert): không nhân đôi model_files, tệp cũ được dọn', async () => {
    const p = await newProduct('overwrite');
    const a = await upload(p.id, SPHERE, 'ban-mot.glb');
    const modelId = a.body.data.modelId;
    await waitStatus(modelId, 'ready');
    const before = await prisma.modelFile.findMany({ where: { modelId }, include: { media: true } });
    const oldKeys = before.map((f) => f.media.filePath);

    const b = await upload(p.id, SPHERE, 'ban-hai.glb');
    expect(b.body.data.modelId).toBe(modelId);
    expect(await statusOf(modelId)).toBe('processing'); // đặt lại processing ngay khi nhận tệp mới
    await waitFor(async () => {
      const files = await prisma.modelFile.findMany({ where: { modelId }, include: { media: true } });
      return (
        (await statusOf(modelId)) === 'ready' && files.every((f) => f.media.filePath.includes('ban-hai'))
      );
    });
    expect(await prisma.modelFile.count({ where: { modelId, format: 'glb' } })).toBe(3);
    expect(await prisma.media.count({ where: { filePath: { in: oldKeys } } })).toBe(0); // media cũ đã dọn
  }, 120_000);

  it('xử lý lại: chỉ mô hình failed (409 nếu khác); failed → processing → ready, không nhân đôi tệp; 404/403', async () => {
    const p = await newProduct('reproc');
    const a = await upload(p.id, SPHERE, 'ghe.glb');
    const modelId = a.body.data.modelId;
    await waitStatus(modelId, 'ready');
    const checksums = (await prisma.modelFile.findMany({ where: { modelId }, orderBy: { lod: 'asc' } })).map(
      (f) => f.checksum,
    );

    const notFailed = await api('post', `/admin/models/${modelId}/reprocess`, admin);
    expect(notFailed.status).toBe(409);
    expect(notFailed.body.error.code).toBe('INVALID_STATE');
    expect((await api('post', '/admin/models/99999999/reprocess', admin)).status).toBe(404);
    expect((await api('post', `/admin/models/${modelId}/reprocess`, cust)).status).toBe(403);

    // đưa về failed (ví dụ job trước đó hết lần thử); tệp gốc vẫn còn nên xử lý lại được
    await prisma.product3DModel.update({ where: { id: modelId }, data: { status: 'failed' } });
    const r = await api('post', `/admin/models/${modelId}/reprocess`, admin);
    expect(r.status).toBe(202);
    expect(r.body.data).toMatchObject({ modelId, status: 'processing' });
    expect(typeof r.body.data.jobId).toBe('string');
    expect(await prisma.activityLog.count({ where: { action: 'model.reprocess', targetId: modelId } })).toBe(
      1,
    );
    await waitStatus(modelId, 'ready');
    const after = await prisma.modelFile.findMany({ where: { modelId }, orderBy: { lod: 'asc' } });
    expect(after).toHaveLength(3);
    expect(after.map((f) => f.checksum)).toEqual(checksums);
  }, 120_000);

  it('xử lý lại mô hình failed vì vượt ngưỡng: vẫn failed (kết quả không đổi) và vẫn báo lại admin', async () => {
    const p = await newProduct('reproc-heavy');
    const a = await upload(p.id, await heavyGlb(), 'nang.glb');
    const modelId = a.body.data.modelId;
    await waitStatus(modelId, 'failed');
    const r = await api('post', `/admin/models/${modelId}/reprocess`, admin);
    expect(r.status).toBe(202);
    await waitFor(
      async () =>
        (await prisma.activityLog.count({
          where: { action: 'model.processing_failed', targetId: modelId },
        })) === 2,
    );
    expect(await statusOf(modelId)).toBe('failed');
  }, 180_000);

  it('mô hình chính: chỉ một cờ isPrimary mỗi sản phẩm; chỉ đặt được mô hình ready; public trả mô hình chính mới', async () => {
    const p = await newProduct('primary');
    const a = await upload(p.id, SPHERE, 'chinh.glb');
    const A = a.body.data.modelId;
    await waitStatus(A, 'ready');
    const b = await upload(p.id, SPHERE, 'phu.glb', { createNew: 'true' });
    const B = b.body.data.modelId;
    expect(B).not.toBe(A);
    // mô hình đang processing (tự dựng, không có job) ⇒ chưa đặt chính được
    const pending = await prisma.product3DModel.create({
      data: { productId: p.id, lengthMm: 1, widthMm: 1, heightMm: 1, status: 'processing' },
    });
    expect((await api('patch', `/admin/models/${pending.id}/primary`, admin)).status).toBe(409);
    await prisma.product3DModel.delete({ where: { id: pending.id } });
    await waitStatus(B, 'ready');
    expect((await prisma.product3DModel.findUniqueOrThrow({ where: { id: A } })).isPrimary).toBe(true);
    expect((await prisma.product3DModel.findUniqueOrThrow({ where: { id: B } })).isPrimary).toBe(false);

    const r = await api('patch', `/admin/models/${B}/primary`, admin);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ modelId: B, isPrimary: true });
    const rows = await prisma.product3DModel.findMany({ where: { productId: p.id } });
    expect(rows.filter((m) => m.isPrimary).map((m) => m.id)).toEqual([B]);
    const pub = await api('get', `/products/${p.slug}/model`);
    expect(pub.body.data.id).toBe(B);
    expect(await prisma.activityLog.count({ where: { action: 'model.set_primary', targetId: B } })).toBe(1);

    // lặp lại là idempotent; mô hình không tồn tại ⇒ 404; khách ⇒ 403; mô hình failed ⇒ 409
    expect((await api('patch', `/admin/models/${B}/primary`, admin)).status).toBe(200);
    expect((await api('patch', '/admin/models/99999999/primary', admin)).status).toBe(404);
    expect((await api('patch', `/admin/models/${A}/primary`, cust)).status).toBe(403);
    await prisma.product3DModel.update({ where: { id: A }, data: { status: 'failed' } });
    expect((await api('patch', `/admin/models/${A}/primary`, admin)).status).toBe(409);
  }, 150_000);

  it('xóa tệp cuối cùng ⇒ sản phẩm không còn mô hình; xóa lại ⇒ 404', async () => {
    const p = await newProduct('delete');
    const a = await upload(p.id, SPHERE, 'xoa.glb');
    await waitStatus(a.body.data.modelId, 'ready');
    const list = await api('get', `/admin/models?productId=${p.id}&pageSize=100`, admin);
    expect(list.body.data).toHaveLength(3); // một dòng cho mỗi tệp (3 LOD)
    expect(list.body.data.every((x: { status: string }) => x.status === 'ready')).toBe(true);
    for (const row of list.body.data)
      expect((await api('delete', `/admin/models/${row.id}`, admin)).status).toBe(200);
    expect((await api('get', `/admin/models?productId=${p.id}`, admin)).body.data).toHaveLength(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(false);
    expect((await api('get', `/products/${p.slug}/model`)).body.data).toBeNull();
    expect((await api('delete', `/admin/models/${list.body.data[0].id}`, admin)).status).toBe(404);
  }, 90_000);

  it('dữ liệu mẫu sofa-nordic: trang chi tiết, trang 360° và /model cùng trả một mô hình', async () => {
    const r = await api('get', '/products/sofa-nordic/model');
    expect(r.body.data.glbUrl).toMatch(/\.glb$/);
    const d = await api('get', '/products/sofa-nordic');
    expect(d.body.data.model.glbUrl).toBe(r.body.data.glbUrl);
    const v = await api('get', '/products/sofa-nordic/360');
    expect(v.body.data.product.model.glbUrl).toBe(r.body.data.glbUrl);
  });

  it('phân quyền: khách và người chưa đăng nhập không tải lên / đổi mô hình', async () => {
    const p = await newProduct('auth');
    const asCust = await http
      .post('/api/admin/models/upload')
      .set('Authorization', `Bearer ${cust}`)
      .field('productId', String(p.id))
      .attach('file', SPHERE, { filename: 'x.glb', contentType: 'model/gltf-binary' });
    expect(asCust.status).toBe(403);
    expect((await api('post', '/admin/models/1/reprocess')).status).toBe(401);
    expect((await api('patch', '/admin/models/1/primary')).status).toBe(401);
  });
});
