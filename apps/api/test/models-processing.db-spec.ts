// E2E (supertest) xử lý và DUYỆT mô hình 3D – UC-ADM-13, UC-ADM-32, D-N21, D-N22 – trên aurelia_test. CẦN REDIS + Postgres.
// Tải lên ⇒ 202 processing ⇒ job chuẩn hóa ⇒ pending_review (khách chưa thấy) ⇒ duyệt ⇒ ready. Mỗi test tự tạo sản phẩm.
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
import { buildFakeGlb } from '../src/modules/ai3d/fake-glb';
import { getIO } from '../src/modules/jobs/model-processing/glb-tools';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service';
import { waitFor, waitModelStatus } from './model-helpers';

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

describe('Xử lý và duyệt mô hình 3D (UC-ADM-13/32) – cần Redis', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let storage: StorageService;
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
  const waitStatus = (id: number, status: string) => waitModelStatus(prisma, id, status);
  /** tải lên và chờ tới chờ duyệt */
  const pending = async (productId: number, buf: Buffer = SPHERE, name = 'ghe.glb') => {
    const r = await upload(productId, buf, name);
    expect(r.status).toBe(202);
    await waitStatus(r.body.data.modelId, 'pending_review');
    return r.body.data.modelId as number;
  };
  const approve = (id: number, body: object = {}) => api('post', `/admin/models/${id}/approve`, admin, body);
  const publicModel = async (slug: string) => (await api('get', `/products/${slug}/model`)).body.data;
  const has3d = async (id: number) => (await prisma.product.findUniqueOrThrow({ where: { id } })).has3dModel;
  const pipelineOf = async (id: number) =>
    (
      (await prisma.product3DModel.findUniqueOrThrow({ where: { id } })).viewerConfig as {
        pipeline: Record<string, unknown>;
      }
    ).pipeline;
  const privateKeys = (pipeline: object) =>
    JSON.stringify(pipeline).match(/models\/(pending|incoming)\/[^"]+\.glb/g) ?? [];

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    storage = app.get(STORAGE_SERVICE);
    queue = app.get(getQueueToken('model-processing'));
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
    adminId = (await prisma.user.findFirstOrThrow({ where: { email: 'admin@aurelia.vn' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app?.close();
  });

  it('GLB hợp lệ: 202 ⇒ chờ duyệt (tệp chỉ ở kho private) ⇒ duyệt ⇒ 3 LOD công khai, has3dModel do trigger', async () => {
    const p = await newProduct('glb');
    const r = await upload(p.id, SPHERE, 'sphere.glb');
    expect(r.status).toBe(202);
    const { modelId, jobId } = r.body.data;
    const job = await queue.getJob(jobId);
    expect(job?.opts.attempts).toBe(3);
    expect(job?.opts.backoff).toMatchObject({ type: 'exponential' });
    expect(job?.data).toMatchObject({ modelId, format: 'glb', uploadedBy: adminId });

    await waitStatus(modelId, 'pending_review');
    expect(await publicModel(p.slug)).toBeNull();
    expect(await has3d(p.id)).toBe(false);
    expect(await prisma.modelFile.count({ where: { modelId } })).toBe(0);
    const keys = privateKeys(await pipelineOf(modelId));
    expect(keys.length).toBeGreaterThanOrEqual(4); // tệp thô + 3 LOD
    for (const key of keys) {
      expect(await storage.head(key, 'private')).not.toBeNull();
      expect(await storage.head(key, 'public')).toBeNull();
    }

    const ok = await approve(modelId);
    expect(ok.status).toBe(200);
    const files = await prisma.modelFile.findMany({ where: { modelId }, include: { media: true } });
    expect(files.map((f) => f.lod).sort()).toEqual(['high', 'low', 'medium']);
    const poly = Object.fromEntries(files.map((f) => [f.lod, f.polygonCount as number]));
    expect(poly.high).toBeGreaterThan(poly.medium);
    expect(poly.medium).toBeGreaterThan(poly.low);
    for (const f of files) {
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(f.isCompressed).toBe(true);
      expect(f.media.filePath).toMatch(new RegExp(`^models/${modelId}/sphere-${f.lod}-[0-9a-f]{12}\\.glb$`));
      expect(await storage.head(f.media.filePath, 'public')).not.toBeNull();
    }
    for (const key of keys) expect(await storage.head(key, 'private')).toBeNull();
    expect(await has3d(p.id)).toBe(true);
    const pub = await publicModel(p.slug);
    expect(pub).toMatchObject({ status: 'ready', source: 'upload' });
    expect(pub.glbUrl).toMatch(/sphere-medium-[0-9a-f]{12}\.glb$/);
    expect(pub.viewerConfig).not.toHaveProperty('pipeline');
    expect(await pipelineOf(modelId)).toMatchObject({ source: 'upload', chosen: 'original' });
  }, 90_000);

  it('đang processing: public chưa trả mô hình và sản phẩm chưa có has3dModel', async () => {
    const p = await newProduct('proc');
    const m = await prisma.product3DModel.create({
      data: { productId: p.id, lengthMm: 800, widthMm: 800, heightMm: 800, status: 'processing' },
    });
    expect(await publicModel(p.slug)).toBeNull();
    expect(await has3d(p.id)).toBe(false);
    const list = await api('get', `/admin/models?productId=${p.id}`, admin);
    expect(list.body.data[0]).toMatchObject({ modelId: m.id, status: 'processing', fileId: null });
    await prisma.product3DModel.delete({ where: { id: m.id } });
  });

  it('JSON data-URL: 202; thiếu fileData ⇒ 400; từ chối đuôi lạ, sai chữ ký, >100MB, sai định dạng', async () => {
    const p = await newProduct('json');
    const post = (b: object) => api('post', '/admin/models', admin, { productId: p.id, format: 'glb', ...b });
    const ok = await post({ fileName: 'ghe.glb', fileData: b64(SPHERE) });
    expect(ok.status).toBe(202);
    await waitStatus(ok.body.data.modelId, 'pending_review');

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

  it('multipart: tên traversal được làm sạch; một sản phẩm một bản chờ (409); sai MIME, không có tệp, > 100 MB bị từ chối', async () => {
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
    await waitStatus(ok.body.data.modelId, 'pending_review');
    const second = await upload(p.id, SPHERE, 'hai.glb');
    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain('chờ duyệt');
    const both = await Promise.all([
      newProduct('dua').then(async (q) =>
        (await Promise.all([upload(q.id, SPHERE, 'a.glb'), upload(q.id, SPHERE, 'b.glb')])).map(
          (r) => r.status,
        ),
      ),
    ]);
    expect(both[0].sort()).toEqual([202, 409]); // đồng thời: đúng một yêu cầu lọt qua

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

  it('GLB hỏng: failed, KHÔNG retry, không có model_files; nhật ký + thông báo; bỏ được', async () => {
    const p = await newProduct('broken');
    const r = await upload(p.id, BROKEN, 'broken.glb');
    const { modelId, jobId } = r.body.data;
    await waitStatus(modelId, 'failed');
    expect(await prisma.modelFile.count({ where: { modelId } })).toBe(0);
    expect((await queue.getJob(jobId))?.attemptsMade).toBe(1);
    const log = await prisma.activityLog.findFirstOrThrow({
      where: { action: 'model.processing_failed', targetId: modelId },
    });
    expect(log.actorId).toBe(adminId);
    expect((log.changes as { reason: string }).reason).toMatch(/GLB/);
    expect(
      await prisma.notification.findFirst({
        where: { userId: adminId, title: { contains: 'broken.glb' } },
      }),
    ).not.toBeNull();
    const list = await api('get', `/admin/models?productId=${p.id}`, admin);
    expect(list.body.data[0]).toMatchObject({ status: 'failed', fileName: 'broken.glb', fileId: null });
    expect(list.body.data[0].failureReason).toMatch(/GLB/);
    expect(await publicModel(p.slug)).toBeNull();
    const keys = privateKeys(await pipelineOf(modelId));
    expect((await api('post', `/admin/models/${modelId}/reject`, admin)).status).toBe(200);
    expect(await statusOf(modelId)).toBeUndefined();
    for (const key of keys) expect(await storage.head(key, 'private')).toBeNull();
  }, 90_000);

  it('LOD vượt MODEL_SERVE_MAX_MB (D-N21): failed, không tạo model_files; xử lý lại vẫn failed và báo lại', async () => {
    const p = await newProduct('heavy');
    const r = await upload(p.id, await heavyGlb(), 'nang.glb');
    const { modelId, jobId } = r.body.data;
    await waitStatus(modelId, 'failed');
    expect(await prisma.modelFile.count({ where: { modelId } })).toBe(0);
    expect((await queue.getJob(jobId))?.attemptsMade).toBe(1);
    const list = await api('get', `/admin/models?productId=${p.id}`, admin);
    expect(list.body.data[0].failureReason).toMatch(/vượt ngưỡng 5 MB/);
    expect((await api('post', `/admin/models/${modelId}/reprocess`, admin)).status).toBe(202);
    await waitFor(
      async () =>
        (await prisma.activityLog.count({
          where: { action: 'model.processing_failed', targetId: modelId },
        })) === 2,
    );
    expect(await statusOf(modelId)).toBe('failed');
  }, 180_000);

  it('AR ngoài phạm vi (D-P11): USDZ/GLTF bị từ chối 415, không tạo mô hình', async () => {
    const p = await newProduct('usdz');
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
    expect(await prisma.product3DModel.count({ where: { productId: p.id } })).toBe(0);
    const m = await prisma.product3DModel.create({
      data: { productId: p.id, lengthMm: 1, widthMm: 1, heightMm: 1, status: 'uploading' },
    });
    const pre = await api('post', `/admin/models/${m.id}/files/presign`, admin, {
      format: 'usdz',
      fileName: 'a.usdz',
      size: 100,
    });
    expect(pre.status).toBe(415);
  });

  it('thay mô hình: bản cũ vẫn hiện khi bản mới chờ duyệt; duyệt thì bản cũ bị xóa, tệp cũ được dọn', async () => {
    const p = await newProduct('thay');
    const first = await pending(p.id, SPHERE, 'ban-mot.glb');
    expect((await approve(first)).status).toBe(200);
    const oldFiles = await prisma.modelFile.findMany({ where: { modelId: first }, include: { media: true } });
    // đã duyệt thì không nhận tệp mới vào bản ghi đó
    expect(
      (
        await api('post', `/admin/models/${first}/files/presign`, admin, {
          format: 'glb',
          fileName: 'x.glb',
          size: 10,
        })
      ).status,
    ).toBe(409);

    const second = await pending(p.id, SPHERE, 'ban-hai.glb');
    expect(second).not.toBe(first);
    expect((await publicModel(p.slug)).id).toBe(first);
    expect(await has3d(p.id)).toBe(true);

    expect((await approve(second)).status).toBe(200);
    expect((await publicModel(p.slug)).id).toBe(second);
    expect(await statusOf(first)).toBeUndefined();
    const rows = await prisma.product3DModel.findMany({ where: { productId: p.id } });
    expect(rows.map((m) => [m.id, m.isPrimary, m.status])).toEqual([[second, true, 'ready']]);
    for (const f of oldFiles) {
      expect(await prisma.media.count({ where: { id: f.mediaId } })).toBe(0);
      expect(await storage.head(f.media.filePath, 'public')).toBeNull();
    }
  }, 120_000);

  it('bỏ bản chờ duyệt: xóa bản ghi và tệp tạm, mô hình đang hiện không đổi; sau đó tải bản khác được', async () => {
    const p = await newProduct('bo');
    const live = await pending(p.id);
    await approve(live);
    const next = await pending(p.id);
    const keys = privateKeys(await pipelineOf(next));
    expect((await api('post', `/admin/models/${next}/reject`, cust)).status).toBe(403);
    expect((await api('post', `/admin/models/${next}/reject`, admin)).status).toBe(200);
    expect(await statusOf(next)).toBeUndefined();
    for (const key of keys) expect(await storage.head(key, 'private')).toBeNull();
    expect((await publicModel(p.slug)).id).toBe(live);
    expect((await api('post', `/admin/models/${live}/reject`, admin)).status).toBe(409);
    await pending(p.id);
  }, 150_000);

  it('chuẩn hóa lại và chọn phiên bản: tệp có tấm sàn cho hai bản; đổi góc/tắt gỡ sàn xử lý lại từ tệp gốc', async () => {
    const p = await newProduct('san');
    const id = await pending(p.id, await buildFakeGlb({ floor: true, jpegAsPng: true, metallic: true }));
    let detail = (await api('get', `/admin/models/${id}`, admin)).body.data;
    expect(Object.keys(detail.variants).sort()).toEqual(['cleaned', 'original']);
    expect(detail.variants.cleaned.report.floorRemoved).toBe(true);
    expect(detail.variants.original.report.distorted).toBe(true);

    expect((await api('post', `/admin/models/${id}/renormalize`, admin, { yawDeg: 45 })).status).toBe(400);
    const r = await api('post', `/admin/models/${id}/renormalize`, admin, { yawDeg: 90, removeFloor: false });
    expect(r.status).toBe(202);
    await waitStatus(id, 'pending_review');
    detail = (await api('get', `/admin/models/${id}`, admin)).body.data;
    expect(Object.keys(detail.variants)).toEqual(['original']);
    expect(detail.options).toEqual({ removeFloor: false, yawDeg: 90 });
    expect(detail.variants.original.report.manualYawDeg).toBe(90);

    await api('post', `/admin/models/${id}/renormalize`, admin, { yawDeg: 0, removeFloor: true });
    await waitStatus(id, 'pending_review');
    expect((await approve(id, { variant: 'khong-co' })).status).toBe(400);
    expect((await approve(id, { variant: 'original' })).status).toBe(200);
    expect(await pipelineOf(id)).toMatchObject({
      chosen: 'original',
      normalization: { floorRemoved: false },
    });
    expect((await api('post', `/admin/models/${id}/renormalize`, admin, { yawDeg: 90 })).status).toBe(409);
  }, 150_000);

  it('xử lý lại: chỉ mô hình failed; failed → processing → chờ duyệt; 404/403', async () => {
    const p = await newProduct('reproc');
    const id = await pending(p.id);
    expect((await api('post', `/admin/models/${id}/reprocess`, admin)).status).toBe(409);
    expect((await api('post', '/admin/models/99999999/reprocess', admin)).status).toBe(404);
    expect((await api('post', `/admin/models/${id}/reprocess`, cust)).status).toBe(403);
    await prisma.product3DModel.update({ where: { id }, data: { status: 'failed' } });
    const r = await api('post', `/admin/models/${id}/reprocess`, admin);
    expect(r.status).toBe(202);
    await waitStatus(id, 'pending_review');
    expect(await prisma.activityLog.count({ where: { action: 'model.reprocess', targetId: id } })).toBe(1);
  }, 120_000);

  it('mô hình chính: chỉ đặt được mô hình ready; đặt lại mô hình đang chính là idempotent', async () => {
    const p = await newProduct('primary');
    const id = await pending(p.id);
    expect((await api('patch', `/admin/models/${id}/primary`, admin)).status).toBe(409);
    await approve(id);
    expect((await api('patch', `/admin/models/${id}/primary`, admin)).status).toBe(200);
    expect((await api('patch', '/admin/models/99999999/primary', admin)).status).toBe(404);
    expect((await api('patch', `/admin/models/${id}/primary`, cust)).status).toBe(403);
  }, 90_000);

  it('xóa tệp cuối cùng ⇒ sản phẩm không còn mô hình; xóa lại ⇒ 404', async () => {
    const p = await newProduct('delete');
    await approve(await pending(p.id, SPHERE, 'xoa.glb'));
    const list = await api('get', `/admin/models?productId=${p.id}&pageSize=100`, admin);
    expect(list.body.data).toHaveLength(3);
    for (const row of list.body.data)
      expect((await api('delete', `/admin/models/${row.id}`, admin)).status).toBe(200);
    expect((await api('get', `/admin/models?productId=${p.id}`, admin)).body.data).toHaveLength(0);
    expect(await has3d(p.id)).toBe(false);
    expect(await publicModel(p.slug)).toBeNull();
    expect((await api('delete', `/admin/models/${list.body.data[0].id}`, admin)).status).toBe(404);
  }, 90_000);

  it('dữ liệu seed không có mô hình mẫu; sản phẩm seed chưa có mô hình ⇒ model = null', async () => {
    expect(
      await prisma.modelFile.count({ where: { media: { filePath: { startsWith: 'mock/models/' } } } }),
    ).toBe(0);
    const r = await api('get', '/products/guong-tron-khung-kim-loai');
    expect(r.status).toBe(200);
    expect(r.body.data.model).toBeNull();
  });

  it('phân quyền: khách và người chưa đăng nhập không tải lên, duyệt, xem thử', async () => {
    const p = await newProduct('auth');
    const asCust = await http
      .post('/api/admin/models/upload')
      .set('Authorization', `Bearer ${cust}`)
      .field('productId', String(p.id))
      .attach('file', SPHERE, { filename: 'x.glb', contentType: 'model/gltf-binary' });
    expect(asCust.status).toBe(403);
    for (const [method, path] of [
      ['post', '/admin/models/1/reprocess'],
      ['patch', '/admin/models/1/primary'],
      ['post', '/admin/models/1/approve'],
      ['post', '/admin/models/1/renormalize'],
      ['get', '/admin/models/1'],
      ['get', '/admin/models/1/preview'],
    ] as const) {
      expect((await api(method, path)).status).toBe(401);
      expect((await api(method, path, cust)).status).toBe(403);
    }
  });
});
