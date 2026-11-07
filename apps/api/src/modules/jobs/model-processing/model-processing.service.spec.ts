// Unit test ModelProcessingService (UC-ADM-13): GLB hợp lệ, GLB hỏng, USDZ, LOD vượt ngưỡng 5 MB. Không cần Redis/Postgres.
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
}

/** Prisma giả đủ dùng cho process()/markFailed(); ghi lại những gì được ghi vào CSDL */
function setup(opts: { serveMaxMb?: number; source: Buffer; glbCount?: number }) {
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
      update: jest.fn(async ({ data }: { data: { status: string } }) => {
        saved.status = data.status;
      }),
      count: jest.fn(async () => 1),
    },
  };
  const prisma = {
    product3DModel: { findUnique: jest.fn(async () => ({ id: 7 })) },
    modelFile: { count: jest.fn(async () => opts.glbCount ?? 0) },
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
  it('GLB hợp lệ: 3 LOD, polygon giảm dần, checksum SHA-256, nén, ghi một transaction rồi mới ready', async () => {
    const t = setup({ source: fixture('sphere.glb') });
    const r = await t.service.process(job());
    expect(r.files.map((f) => f.lod)).toEqual(['high', 'medium', 'low']);
    expect(t.uploaded).toEqual([
      'models/7/sphere-high.glb',
      'models/7/sphere-medium.glb',
      'models/7/sphere-low.glb',
    ]);
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1); // media + model_files + ready cùng một transaction
    const poly = t.saved.files.map((f) => f.polygonCount as number);
    expect(poly[0]).toBeGreaterThan(poly[1]);
    expect(poly[1]).toBeGreaterThan(poly[2]);
    for (const f of t.saved.files) {
      expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(f.isCompressed).toBe(true);
      expect(f.format).toBe('glb');
    }
    expect(
      (t.saved.files[0].textureResolution as number) >= (t.saved.files[2].textureResolution as number),
    ).toBe(true);
    expect(t.saved.status).toBe('ready');
  }, 60_000);

  it('GLB hỏng (cắt cụt): InvalidModelFileError, chưa ghi gì, không ready', async () => {
    const t = setup({ source: fixture('broken.glb') });
    await expect(t.service.process(job({ fileName: 'broken.glb' }))).rejects.toBeInstanceOf(
      InvalidModelFileError,
    );
    expect(t.storage.upload).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.saved.status).toBeUndefined();
  });

  it('USDZ: chỉ kiểm tra chữ ký ZIP + checksum, một tệp đúng LOD', async () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(32, 7)]);
    const t = setup({ source: zip });
    const r = await t.service.process(job({ format: 'usdz', lod: 'high', fileName: 'sofa.usdz' }));
    expect(r.files).toHaveLength(1);
    expect(t.saved.files[0]).toMatchObject({
      format: 'usdz',
      lod: 'high',
      polygonCount: null,
      isCompressed: false,
    });
    expect(t.saved.files[0].checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(t.saved.status).toBe('ready');
  });

  it('USDZ không phải ZIP: InvalidModelFileError', async () => {
    const t = setup({ source: Buffer.from('not a zip at all') });
    await expect(t.service.process(job({ format: 'usdz', fileName: 'x.usdz' }))).rejects.toBeInstanceOf(
      InvalidModelFileError,
    );
  });

  it('LOD vượt MODEL_SERVE_MAX_MB: ModelTooLargeError (không retry), không ghi gì', async () => {
    const t = setup({ source: fixture('sphere.glb'), serveMaxMb: 0.01 }); // 10 KB < LOD nhỏ nhất của sphere.glb
    const err = await t.service.process(job()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(ModelTooLargeError);
    expect(err).toBeInstanceOf(InvalidModelFileError);
    expect((err as Error).message).toContain('0.01 MB');
    expect(t.storage.upload).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
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

  it('markFailed USDZ khi vẫn còn GLB: giữ ready nhưng vẫn ghi log và báo admin', async () => {
    const t = setup({ source: Buffer.alloc(0), glbCount: 3 });
    await t.service.markFailed(job({ format: 'usdz' }), 'USDZ hỏng');
    expect(t.saved.status).toBeUndefined();
    expect(t.logs).toHaveLength(1);
    expect(t.notes).toHaveLength(1);
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
