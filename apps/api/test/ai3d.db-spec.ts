// UC-ADM-31 tạo mô hình bằng AI (nhà cung cấp GIẢ LẬP – không gọi Hugging Face) trên aurelia_test. CẦN REDIS.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service';
import { waitModelStatus } from './model-helpers';

describe('Tạo mô hình 3D bằng AI (aurelia_test)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let storage: StorageService;
  const prisma = new PrismaClient();
  let admin = '';
  let cust = '';
  let seq = 0;

  const api = (method: 'get' | 'post', path: string, token?: string, body?: object) => {
    const r = http[method](`/api${path}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const login = async (email: string, password: string, adminOnly = false) =>
    (await api('post', '/auth/login', undefined, { email, password, adminOnly })).body.data.tokens
      .accessToken as string;

  /** Sản phẩm riêng, một ảnh chụp PNG thật trong kho, gắn biến thể màu */
  const newProduct = async (mimeType = 'image/png') => {
    const n = `${Date.now()}-${++seq}`;
    const color = await prisma.attributeValue.findFirstOrThrow({
      where: { attributeCode: 'color', value: 'Gỗ sồi' },
    });
    const product = await prisma.product.create({
      data: { name: `Bàn AI ${n}`, slug: `ban-ai-${n}`, status: 'published' },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `AI-${n}`,
        price: 1000000,
        lengthCm: 140,
        widthCm: 65,
        heightCm: 75,
      },
    });
    await prisma.variantAttributeValue.create({
      data: { variantId: variant.id, attributeValueId: color.id, attributeCode: 'color' },
    });
    const key = `test/ai3d/${n}.png`;
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#b98d5c' } })
      .png()
      .toBuffer();
    await storage.upload({ key, body: png, contentType: 'image/png', visibility: 'public' });
    const media = await prisma.media.create({
      data: { fileName: `${n}.png`, filePath: key, mimeType, fileSize: png.length },
    });
    const image = await prisma.productImage.create({
      data: {
        productId: product.id,
        variantId: variant.id,
        mediaId: media.id,
        sortOrder: 1,
        isPrimary: true,
      },
    });
    return { ...product, imageId: image.id, mediaId: media.id };
  };
  const create = (p: { id: number; imageId: number }, over: object = {}) =>
    api('post', '/admin/models/ai', admin, { productId: p.id, imageId: p.imageId, consent: true, ...over });
  const status = async () => (await api('get', '/admin/models/ai/status', admin)).body.data;
  const resetUsage = () =>
    prisma.activityLog.deleteMany({ where: { action: { in: ['model.ai_requested', 'model.ai_failed'] } } });
  const fakeUsage = (n: number, at: Date) =>
    prisma.activityLog.createMany({
      data: Array.from({ length: n }, () => ({ action: 'model.ai_requested', createdAt: at })),
    });

  beforeAll(async () => {
    const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    if (db !== 'aurelia_test') throw new Error(`E2E chỉ được chạy trên aurelia_test (đang kết nối ${db})`);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    storage = app.get(STORAGE_SERVICE);
    admin = await login('admin@aurelia.vn', 'admin123', true);
    cust = await login('khachhang@aurelia.vn', '123456');
  });
  beforeEach(resetUsage);
  afterAll(async () => {
    delete process.env.AI3D_FAKE_ERROR;
    await resetUsage();
    await prisma.$disconnect();
    await app?.close();
  });

  it('test không dùng token thật và nhà cung cấp là giả lập', async () => {
    expect(process.env.HF_TOKEN).toBe('');
    expect(await status()).toMatchObject({
      enabled: true,
      provider: 'fake',
      usage: { usedToday: 0, perHour: 3, perDay: 10 },
      lastError: null,
    });
  });

  it('phân quyền: khách và người chưa đăng nhập không xem trạng thái, không tạo', async () => {
    expect((await api('get', '/admin/models/ai/status')).status).toBe(401);
    expect((await api('get', '/admin/models/ai/status', cust)).status).toBe(403);
    expect((await api('post', '/admin/models/ai', cust, {})).status).toBe(403);
    expect((await api('post', '/admin/models/1/regenerate', cust, {})).status).toBe(403);
  });

  it('bắt buộc xác nhận gửi ảnh cho bên thứ ba; ảnh phải của sản phẩm và là ảnh chụp', async () => {
    const p = await newProduct();
    const noConsent = await create(p, { consent: false });
    expect(noConsent.status).toBe(400);
    expect(noConsent.body.error.details.consent[0]).toContain('Hugging Face');
    expect((await create(p, { imageId: 999999 })).body.error.details.imageId).toBeDefined();
    const svg = await newProduct('image/svg+xml');
    expect((await create(svg)).body.error.details.imageId[0]).toContain('SVG');
    expect((await create(p, { space: 'ai-do/space' })).body.error.details.space).toBeDefined();
    expect(await prisma.product3DModel.count({ where: { productId: { in: [p.id, svg.id] } } })).toBe(0);
    expect((await status()).usage.usedToday).toBe(0);
  });

  it('tạo → chờ duyệt (khách chưa thấy) → duyệt → khách thấy, kèm nguồn và màu; không lộ thông tin quy trình', async () => {
    const p = await newProduct();
    const r = await create(p);
    expect(r.status).toBe(202);
    const { modelId } = r.body.data;
    await waitModelStatus(prisma, modelId, 'pending_review');

    expect((await api('get', `/products/${p.slug}/model`)).body.data).toBeNull();
    expect((await api('get', `/products/${p.slug}`)).body.data.model).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(false);
    expect(await prisma.modelFile.count({ where: { modelId } })).toBe(0);
    expect(
      await prisma.media.count({ where: { filePath: { startsWith: `models/pending/${modelId}/` } } }),
    ).toBe(0);

    const detail = (await api('get', `/admin/models/${modelId}`, admin)).body.data;
    expect(detail).toMatchObject({
      status: 'pending_review',
      source: 'ai',
      space: 'fake/space',
      colorName: 'Gỗ sồi',
      defaultVariant: 'cleaned',
    });
    // mô hình giả có tấm sàn ⇒ có cả hai phiên bản để admin so
    expect(Object.keys(detail.variants).sort()).toEqual(['cleaned', 'original']);
    expect(detail.variants.cleaned.report).toMatchObject({ floorRemoved: true, targetMm: { length: 1400 } });
    expect(JSON.stringify(detail)).not.toMatch(/models\/(pending|incoming)\//);

    const stored = await prisma.product3DModel.findUniqueOrThrow({ where: { id: modelId } });
    const pipeline = (stored.viewerConfig as { pipeline: Record<string, unknown> }).pipeline;
    expect(pipeline).toMatchObject({
      source: 'ai',
      space: 'fake/space',
      sourceImageMediaId: p.mediaId,
      options: { removeFloor: true, yawDeg: 0 },
    });
    expect(typeof pipeline.createdAt).toBe('string');
    const pendingKeys = JSON.stringify(pipeline).match(/models\/pending\/[^"]+\.glb/g)!;
    for (const key of pendingKeys) {
      expect(await storage.head(key, 'private')).not.toBeNull();
      expect(await storage.head(key, 'public')).toBeNull();
    }

    expect((await api('get', `/admin/models/${modelId}/preview?variant=original`)).status).toBe(401);
    expect((await api('get', `/admin/models/${modelId}/preview`, cust)).status).toBe(403);
    const preview = await api('get', `/admin/models/${modelId}/preview?variant=cleaned&lod=low`, admin)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(preview.status).toBe(200);
    expect(preview.headers['content-type']).toContain('model/gltf-binary');
    expect((preview.body as Buffer).toString('ascii', 0, 4)).toBe('glTF');

    // một sản phẩm chỉ một mô hình đang chờ
    expect((await create(p)).status).toBe(409);

    const poster = await sharp({ create: { width: 40, height: 30, channels: 4, background: '#ffffff00' } })
      .png()
      .toBuffer();
    const ok = await api('post', `/admin/models/${modelId}/approve`, admin, {
      variant: 'cleaned',
      posterDataUrl: `data:image/png;base64,${poster.toString('base64')}`,
    });
    expect(ok.status).toBe(200);
    const pub = (await api('get', `/products/${p.slug}`)).body.data.model;
    expect(pub).toMatchObject({ id: modelId, status: 'ready', source: 'ai', colorName: 'Gỗ sồi' });
    expect(pub.viewerConfig).not.toHaveProperty('pipeline');
    expect(JSON.stringify(pub)).not.toMatch(/pipeline|rawKey|models\/(pending|incoming)/);
    expect(pub.files).toHaveLength(3);
    expect(pub.posterUrl).toMatch(/poster-[0-9a-f]{12}\.webp$/);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).has3dModel).toBe(true);
    for (const key of pendingKeys) expect(await storage.head(key, 'private')).toBeNull();
    const approved = await prisma.product3DModel.findUniqueOrThrow({ where: { id: modelId } });
    expect((approved.viewerConfig as { pipeline: Record<string, unknown> }).pipeline).toMatchObject({
      source: 'ai',
      chosen: 'cleaned',
      normalization: { floorRemoved: true, autoYawDeg: 0 },
    });
    // đã duyệt thì không còn xem thử / bỏ / duyệt lại
    expect((await api('get', `/admin/models/${modelId}/preview`, admin)).status).toBe(404);
    expect((await api('post', `/admin/models/${modelId}/approve`, admin, {})).status).toBe(409);
    expect((await api('post', `/admin/models/${modelId}/reject`, admin)).status).toBe(409);
    expect(JSON.stringify((await api('get', `/admin/models?productId=${p.id}`, admin)).body)).not.toContain(
      'rawKey',
    );
  }, 90_000);

  it('hạn mức theo giờ và theo ngày (cả hệ thống): vượt ⇒ 429, không tạo bản ghi', async () => {
    const p = await newProduct();
    await fakeUsage(3, new Date());
    const hour = await create(p);
    expect(hour.status).toBe(429);
    expect(hour.body.error.message).toContain('3 lượt tạo trong một giờ');
    expect((await status()).limitReached).toContain('một giờ');

    await resetUsage();
    // 10 lượt trong hôm nay nhưng đều cũ hơn 1 giờ; ngay đầu ngày (giờ VN) thì dùng thời điểm hiện tại
    const startOfDay = new Date(
      `${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })}T00:00:00+07:00`,
    );
    await fakeUsage(10, new Date(Math.max(startOfDay.getTime(), Date.now() - 2 * 3_600_000)));
    const day = await create(p);
    expect(day.status).toBe(429);
    expect(day.body.error.message).toContain('10 lượt tạo của hôm nay');
    expect((await status()).usage).toMatchObject({ usedToday: 10, perDay: 10 });

    // lượt của hôm qua không tính
    await resetUsage();
    await fakeUsage(10, new Date(startOfDay.getTime() - 60_000));
    expect((await status()).usage.usedToday).toBe(0);
    expect(await prisma.product3DModel.count({ where: { productId: p.id } })).toBe(0);
  });

  it('ảnh đầu vào hỏng: báo lỗi ảnh, chưa gọi máy chủ AI, không hiện là lỗi từ Hugging Face', async () => {
    const p = await newProduct();
    const media = await prisma.media.findUniqueOrThrow({ where: { id: p.mediaId } });
    await storage.upload({ key: media.filePath, body: Buffer.from('không phải ảnh'), visibility: 'public' });
    const { modelId } = (await create(p)).body.data;
    await waitModelStatus(prisma, modelId, 'failed');
    const list = (await api('get', `/admin/models?productId=${p.id}`, admin)).body.data;
    expect(list[0].failureReason).toContain('Không đọc được ảnh đầu vào');
    expect((await status()).lastError).toBeNull();
  }, 60_000);

  it('hết lượt GPU: failed, không tự thử lại; admin thấy câu dễ hiểu + nguyên văn; mô hình đang hiện không đổi', async () => {
    const p = await newProduct();
    process.env.AI3D_FAKE_ERROR = 'quota';
    const r = await create(p);
    const { modelId } = r.body.data;
    await waitModelStatus(prisma, modelId, 'failed');
    delete process.env.AI3D_FAKE_ERROR;
    expect(await prisma.activityLog.count({ where: { action: 'model.ai_failed', targetId: modelId } })).toBe(
      1,
    );
    const s = await status();
    expect(s.lastError.message).toContain('Hết lượt GPU');
    expect(s.lastError.raw).toBe('lỗi giả lập: quota');
    expect(JSON.stringify(s)).not.toContain('hf_');
    expect(s.usage.usedToday).toBe(1); // lượt lỗi vẫn tính
    const list = (await api('get', `/admin/models?productId=${p.id}`, admin)).body.data;
    expect(list[0]).toMatchObject({ status: 'failed', source: 'ai' });
    expect(list[0].failureReason).toContain('Hết lượt GPU');
    expect((await api('get', `/products/${p.slug}/model`)).body.data).toBeNull();

    // "Tạo lại": thiếu xác nhận thì giữ nguyên bản lỗi
    expect((await api('post', `/admin/models/${modelId}/regenerate`, admin, {})).status).toBe(400);
    expect(await prisma.product3DModel.count({ where: { id: modelId } })).toBe(1);
    const again = await api('post', `/admin/models/${modelId}/regenerate`, admin, { consent: true });
    expect(again.status).toBe(202);
    expect(again.body.data.modelId).not.toBe(modelId);
    expect(await prisma.product3DModel.count({ where: { id: modelId } })).toBe(0);
    await waitModelStatus(prisma, again.body.data.modelId, 'pending_review');
    expect((await api('post', `/admin/models/${again.body.data.modelId}/reject`, admin)).status).toBe(200);
    expect(await prisma.product3DModel.count({ where: { productId: p.id } })).toBe(0);
  }, 90_000);
});
