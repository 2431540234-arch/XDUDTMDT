// Cho các mô hình 3D mẫu của seed đi qua ĐÚNG luồng xử lý nền (ModelProcessingService, UC-ADM-13): kiểm tra GLB,
// sinh 3 LOD high/medium/low, checksum, ghi media + model_files rồi mới `ready` (D-P10). Chạy ngoài Nest và ngoài
// BullMQ (đồng bộ, tuần tự) nên seed không cần Redis. Mô hình lỗi / vượt ngưỡng KHÔNG bị xóa mà được liệt kê ở cuối.
//
// Tệp gốc: tệp GLB/USDZ mẫu đang có ở bucket public được chép sang bucket private (như khi admin tải lên) và ghi
// activity_logs `model.upload` để nút "Xử lý lại" dùng được. Idempotent: chạy lại thì xử lý lại từ tệp gốc của seed.
import { PrismaClient } from '@prisma/client';
import { ActivityLogService } from '../src/activity-log/activity-log.service';
import { AppConfig } from '../src/config/app-config.service';
import { validateEnv } from '../src/config/env.validation';
import {
  InvalidModelFileError,
  ModelProcessingService,
} from '../src/modules/jobs/model-processing/model-processing.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { LocalStorageService } from '../src/storage/local-storage.service';
import { MinioStorageService } from '../src/storage/minio-storage.service';
import type { StorageService } from '../src/storage/storage.service';

export interface SeedModelProblem {
  modelId: number;
  slug: string;
  fileName: string;
  reason: string;
}

export async function processSeedModels(): Promise<SeedModelProblem[]> {
  const prisma = new PrismaClient();
  try {
    const env = validateEnv(process.env);
    const config = new AppConfig({ get: (k: string) => env[k as never] } as never);
    const storage: StorageService =
      config.get('STORAGE_DRIVER') !== 'local'
        ? new MinioStorageService(config)
        : new LocalStorageService(config);
    const activity = new ActivityLogService(prisma as never);
    const service = new ModelProcessingService(
      prisma as never,
      config,
      activity,
      new NotificationsService(prisma as never),
      storage,
    );
    const admin = await prisma.user.findFirst({ where: { email: 'admin@aurelia.vn' } });
    const adminId = admin?.id ?? null;

    const models = await prisma.product3DModel.findMany({
      orderBy: { id: 'asc' },
      include: { product: true, modelFiles: { include: { media: true }, orderBy: { id: 'asc' } } },
    });
    const problems: SeedModelProblem[] = [];
    let ok = 0;

    for (const m of models) {
      // GLB trước (ra đủ 3 LOD), USDZ sau; mỗi định dạng chỉ lấy tệp nguồn có LOD cao nhất của seed
      const sources = (['glb', 'usdz'] as const)
        .map((format) => m.modelFiles.find((f) => f.format === format))
        .filter((f): f is NonNullable<typeof f> => Boolean(f));
      await prisma.product3DModel.update({ where: { id: m.id }, data: { status: 'processing' } });

      if (!sources.length) {
        // không có tệp nguồn thì không xử lý được: đánh dấu lỗi có lý do để admin thấy và tải lại
        await service.markFailed(
          {
            modelId: m.id,
            format: 'glb',
            lod: 'high',
            sourceKey: '',
            fileName: '(chưa có tệp)',
            uploadedBy: adminId,
          },
          'Mô hình mẫu chưa có tệp nguồn nên không thể xử lý. Hãy tải tệp GLB lên.',
        );
        problems.push({
          modelId: m.id,
          slug: m.product.slug,
          fileName: '(chưa có tệp)',
          reason: 'không có tệp nguồn',
        });
        continue;
      }

      for (const f of sources) {
        const ext = f.format === 'glb' ? 'glb' : 'usdz';
        const fileName = f.media.fileName;
        const sourceKey = `models/incoming/seed/${m.id}-${f.format}.${ext}`;
        const data = {
          modelId: m.id,
          format: f.format,
          lod: f.lod,
          sourceKey,
          fileName,
          uploadedBy: adminId,
        } as const;
        try {
          let body = await storage.download(f.media.filePath, 'public');
          // USDZ mẫu cũ chỉ là chuỗi 22 byte, không phải ZIP: thay bằng ZIP tối thiểu (chỉ minh họa, như seed-storage)
          if (f.format === 'usdz' && body.readUInt32LE(0) !== 0x04034b50)
            body = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0)]);
          await storage.upload({
            key: sourceKey,
            body,
            contentType: f.format === 'glb' ? 'model/gltf-binary' : 'model/vnd.usdz+zip',
            visibility: 'private',
          });
          await activity.log({
            actorId: adminId,
            action: 'model.upload',
            targetType: 'product3dmodel',
            targetId: m.id,
            changes: {
              fileName,
              format: f.format,
              lod: f.lod,
              sizeBytes: body.length,
              sourceKey,
              seed: true,
            },
          });
          await service.process(data);
          ok++;
        } catch (e) {
          const reason = (e as Error).message;
          await service.markFailed(data, reason);
          problems.push({ modelId: m.id, slug: m.product.slug, fileName, reason });
          // lỗi không phải do tệp (kho, mạng...) cũng được liệt kê; không retry trong seed
          if (!(e instanceof InvalidModelFileError))
            console.warn(`  ! lỗi tạm thời khi xử lý mô hình ${m.id}: ${reason}`);
        }
      }
    }

    const [ready, failed] = [
      await prisma.product3DModel.count({ where: { status: 'ready' } }),
      await prisma.product3DModel.count({ where: { status: 'failed' } }),
    ];
    console.log(`Xử lý nền mô hình 3D mẫu: ${ok} tệp xử lý xong; mô hình ready=${ready}, failed=${failed}.`);
    if (problems.length) {
      console.log('Mô hình mẫu có vấn đề (KHÔNG bị xóa):');
      for (const p of problems) console.log(`  - #${p.modelId} ${p.slug} ${p.fileName}: ${p.reason}`);
    }
    return problems;
  } finally {
    await prisma.$disconnect();
  }
}
