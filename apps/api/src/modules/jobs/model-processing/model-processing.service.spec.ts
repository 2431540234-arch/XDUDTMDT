// Unit test ModelProcessingService (UC-ADM-13): GLB hợp lệ, GLB hỏng, định dạng khác GLB (AR ngoài phạm vi, D-P11), LOD vượt ngưỡng 5 MB. Không cần Redis/Postgres.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UnrecoverableError, type Job } from 'bullmq';
import type { ModelJobData } from '../jobs.constants';
import {
  InvalidModelFileError,
  ModelProcessingService,
  ModelTooLargeError,
} from './model-processing.service';
import { ModelProcessingProcessor } from './model-processing.processor';

const fixture = (name: string) => readFileSync(resolve(__dirname, '../../../../test/fixtures', name));

interface Saved {
  media: Record<string, unknown>[];
  files: Record<string, unknown>[];
  status?: string;
  pipeline?: Record<string, any>;
}

/** Prisma giả đủ dùng cho process()/markFailed(); ghi lại những gì được ghi vào CSDL */
function setup(opts: { serveMaxMb?: number; source: Buffer; status?: string }) {
  const saved: Saved = { media: [], files: [] };
  const uploaded: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const notes: unknown[][] = [];
  let mediaSeq = 0;
  const tx = {
    media: {
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => {
        saved.media.push(create);
        return { id: ++mediaSeq };
      }),
      deleteMany: jest.fn(),
    },
    modelFile: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => {
        saved.files.push(create);
      }),
      count: jest.fn(async () => 0),
    },
    product3DModel: {
      findUnique: jest.fn(async () => model),
      update: jest.fn(async ({ data }: { data: { status: string; viewerConfig?: any } }) => {
        saved.status = data.status;
        if (data.viewerConfig) saved.pipeline = data.viewerConfig.pipeline;
      }),
      updateMany: jest.fn(async ({ data }: { data: { status: string; viewerConfig?: any } }) => {
        saved.status = data.status;
        saved.pipeline = data.viewerConfig.pipeline;
        return { count: 1 };
      }),
    },
  };
  const model = {
    id: 7,
    productId: 1,
    status: opts.status ?? 'processing',
    lengthMm: 1000,
    widthMm: 1000,
    heightMm: 1000,
    viewerConfig: {},
    createdAt: new Date(),
  };
  const prisma = {
    product3DModel: {
      findUnique: jest.fn(async () => model),
      update: jest.fn(async () => model),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const storage = {
    download: jest.fn(async () => opts.source),
    upload: jest.fn(async ({ key }: { key: string }) => {
      uploaded.push(key);
      return key;
    }),
    delete: jest.fn(),
  };
  const config = { get: (k: string) => (k === 'MODEL_SERVE_MAX_MB' ? (opts.serveMaxMb ?? 5) : undefined) };
  const activity = { log: jest.fn(async (i: Record<string, unknown>) => logs.push(i)) };
  const notifications = { notify: jest.fn(async (...a: unknown[]) => notes.push(a)) };
  const service = new ModelProcessingService(
    prisma as never,
    config as never,
    activity as never,
    notifications as never,
    storage as never,
  );
  return { service, saved, uploaded, logs, notes, prisma, storage, tx };
}

const job = (over: Partial<ModelJobData> = {}): ModelJobData => ({
  modelId: 7,
  format: 'glb',
  lod: 'high',
  sourceKey: 'models/incoming/p1/x.glb',
  fileName: 'sphere.glb',
  uploadedBy: 3,
  ...over,
});

describe('ModelProcessingService', () => {
  it('GLB hợp lệ: chuẩn hóa, 3 LOD vào kho PRIVATE rồi chờ duyệt; không tạo media/model_files', async () => {
    const t = setup({ source: fixture('sphere.glb') });
    const r = await t.service.process(job());
    expect(r.files.map((f) => f.lod)).toEqual(['high', 'medium', 'low']);
    expect(t.uploaded).toHaveLength(3);
    for (const key of t.uploaded) expect(key).toMatch(/^models\/pending\/7\/original-(high|medium|low)-/);
    for (const call of t.storage.upload.mock.calls)
      expect((call as unknown as [{ visibility: string }])[0].visibility).toBe('private');
    expect(t.saved.status).toBe('pending_review');
    expect(t.saved.media).toHaveLength(0);
    expect(t.saved.files).toHaveLength(0);
    const files = t.saved.pipeline!.variants.original.files;
    expect(files.high.polygonCount).toBeGreaterThan(files.medium.polygonCount);
    expect(files.medium.polygonCount).toBeGreaterThan(files.low.polygonCount);
    for (const f of Object.values<any>(files)) {
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(f.isCompressed).toBe(true);
    }
    expect(t.saved.pipeline).toMatchObject({ source: 'upload', stage: 'review', rawKey: job().sourceKey });
    expect(t.saved.pipeline!.variants.original.report.targetMm).toEqual({
      length: 1000,
      width: 1000,
      height: 1000,
    });
  }, 60_000);

  it('job cũ chạy lại trên mô hình đã duyệt: bị loại, không đụng gì', async () => {
    const t = setup({ source: fixture('sphere.glb'), status: 'ready' });
    await expect(t.service.process(job())).rejects.toBeInstanceOf(InvalidModelFileError);
    expect(t.storage.download).not.toHaveBeenCalled();
    expect(t.saved.status).toBeUndefined();
  });

  it('GLB hỏng (cắt cụt): InvalidModelFileError, chưa ghi gì, không ready', async () => {
    const t = setup({ source: fixture('broken.glb') });
    await expect(t.service.process(job({ fileName: 'broken.glb' }))).rejects.toBeInstanceOf(
      InvalidModelFileError,
    );
    expect(t.storage.upload).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.saved.status).not.toBe('pending_review');
  });

  it('USDZ (AR ngoài phạm vi): job bị loại với InvalidModelFileError, không đọc kho, không ghi gì', async () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(32, 7)]);
    const t = setup({ source: zip });
    const err = await t.service
      .process(job({ format: 'usdz', lod: 'high', fileName: 'sofa.usdz' }))
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(InvalidModelFileError);
    expect((err as Error).message).toBe('Hệ thống chỉ hỗ trợ tệp GLB');
    expect(t.storage.download).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('LOD vượt MODEL_SERVE_MAX_MB: ModelTooLargeError (không retry), không ghi gì', async () => {
    const t = setup({ source: fixture('sphere.glb'), serveMaxMb: 0.01 }); // 10 KB < LOD nhỏ nhất của sphere.glb
    const err = await t.service.process(job()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(ModelTooLargeError);
    expect(err).toBeInstanceOf(InvalidModelFileError);
    expect((err as Error).message).toContain('0.01 MB');
    expect(t.storage.upload).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.saved.status).not.toBe('pending_review');
  }, 60_000);

  it('lỗi tạm thời (kho lỗi) KHÔNG phải InvalidModelFileError ⇒ được retry', async () => {
    const t = setup({ source: fixture('sphere.glb') });
    t.storage.download.mockRejectedValueOnce(new Error('ECONNRESET'));
    const err = await t.service.process(job()).catch((e: Error) => e);
    expect(err).not.toBeInstanceOf(InvalidModelFileError);
  });

  it('markFailed: failed + activity_logs model.processing_failed + thông báo cho admin tải lên, MỘT transaction', async () => {
    const t = setup({ source: Buffer.alloc(0) });
    await t.service.markFailed(job({ uploadedBy: 3 }), 'LOD quá lớn');
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(t.saved.status).toBe('failed');
    expect(t.logs[0]).toMatchObject({
      actorId: 3,
      action: 'model.processing_failed',
      targetType: 'product3dmodel',
      targetId: 7,
    });
    expect(t.notes[0][1]).toBe(3); // userId = uploadedBy
    expect(t.notes[0][4]).toBe('LOD quá lớn');
  });

  it('markFailed không kéo mô hình đã duyệt về lỗi', async () => {
    const t = setup({ source: Buffer.alloc(0), status: 'ready' });
    await t.service.markFailed(job(), 'job cũ');
    expect(t.saved.status).toBeUndefined();
    expect(t.logs).toHaveLength(0);
  });
});

describe('ModelProcessingProcessor (retry)', () => {
  const makeJob = (attemptsMade: number) =>
    ({ data: job(), attemptsMade, opts: { attempts: 3 } }) as unknown as Job<ModelJobData>;

  it('tệp hỏng ⇒ UnrecoverableError (BullMQ không retry); lỗi tạm thời ⇒ ném nguyên để retry', async () => {
    const svc = { process: jest.fn(), markFailed: jest.fn() };
    const p = new ModelProcessingProcessor(svc as never);
    svc.process.mockRejectedValueOnce(new InvalidModelFileError('hỏng'));
    await expect(p.process(makeJob(1))).rejects.toBeInstanceOf(UnrecoverableError);
    svc.process.mockRejectedValueOnce(new Error('ECONNRESET'));
    const err = await p.process(makeJob(1)).catch((e: Error) => e);
    expect(err).not.toBeInstanceOf(UnrecoverableError);
  });

  it('chỉ đánh dấu failed khi lỗi không thể phục hồi hoặc đã hết 3 lần thử', async () => {
    const svc = { process: jest.fn(), markFailed: jest.fn() };
    const p = new ModelProcessingProcessor(svc as never);
    await p.onFailed(makeJob(1), new Error('tạm thời'));
    await p.onFailed(makeJob(2), new Error('tạm thời'));
    expect(svc.markFailed).not.toHaveBeenCalled();
    await p.onFailed(makeJob(3), new Error('hết lần thử'));
    expect(svc.markFailed).toHaveBeenCalledTimes(1);
    await p.onFailed(makeJob(1), new UnrecoverableError('hỏng'));
    expect(svc.markFailed).toHaveBeenCalledTimes(2);
  });
});
