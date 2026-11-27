// Dọn mô hình 3D MẪU dạng khối hộp khỏi một DB đã có dữ liệu (ví dụ aurelia_demo). Không đụng mô hình thật.
// Mô hình chỉ bị coi là mẫu khi ĐỦ cả: (1) có lần xử lý từ tệp nguồn của seed (models/incoming/seed/…);
// (2) không có lần tải lên nào khác; (3) không thuộc quy trình tạo/duyệt mới; (4) mọi tệp đều nhỏ hơn 100 KB.
// Vị trí đặt trong ảnh 360° được GIỮ (model_id để trống) và tự hiện lại khi sản phẩm có mô hình được duyệt.
//
// TRƯỚC KHI CHẠY: pg_dump DB, và áp migration (npm run db:deploy với cùng DATABASE_URL).
// DATABASE_URL phải đặt tường minh trong lệnh, --db phải trùng tên DB. Không có --apply: chỉ in kế hoạch.
//   (ở apps/api)  DATABASE_URL=postgresql://…/<tên_db> STORAGE_DRIVER=local|minio \
//                 npx ts-node --transpile-only prisma/remove-sample-models.ts --db <tên_db> [--apply]
//   Với MinIO cần thêm các biến S3_* (ví dụ chạy qua: dotenv -e ../../.env -- …  KHÔNG dùng cờ -o).
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dbName = arg('--db');
const apply = process.argv.includes('--apply');

// Kiểm tra TRƯỚC khi nạp Prisma: Prisma Client tự đọc .env khi thiếu biến, không được để việc đó chọn DB
const url = process.env.DATABASE_URL;
if (!dbName || !url) throw new Error('Cần --db <tên_db> và biến DATABASE_URL đặt tường minh');
if (new URL(url).pathname.slice(1) !== dbName)
  throw new Error(`DATABASE_URL trỏ tới "${new URL(url).pathname.slice(1)}", khác --db "${dbName}"`);
if (!process.env.STORAGE_DRIVER) throw new Error('Cần đặt STORAGE_DRIVER (local | minio | s3)');

const log = (m: string) => process.stdout.write(`[sample-models] ${m}\n`);
const SEED_SOURCE = 'models/incoming/seed/';
const SAMPLE_MAX_BYTES = 100 * 1024;

async function removeObject(key: string, visibility: 'public' | 'private') {
  const driver = process.env.STORAGE_DRIVER;
  if (driver === 'local') {
    const { rm } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const root = resolve(__dirname, '..', process.env.STORAGE_LOCAL_DIR ?? './uploads', visibility);
    await rm(resolve(root, key), { force: true });
    return;
  }
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE
      ? process.env.S3_FORCE_PATH_STYLE === 'true'
      : driver === 'minio',
    ...(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY,
          },
        }
      : {}),
  });
  const bucket =
    visibility === 'public'
      ? (process.env.S3_BUCKET_PUBLIC ?? 'aurelia-public')
      : (process.env.S3_BUCKET_PRIVATE ?? 'aurelia-private');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [{ current }] = await prisma.$queryRaw<Array<{ current: string }>>`
      SELECT current_database() AS current`;
    log(`DB đích: ${current} | STORAGE_DRIVER=${process.env.STORAGE_DRIVER} | ${apply ? 'GHI' : 'chạy thử'}`);
    if (current !== dbName) throw new Error(`Đang nối tới "${current}", không phải "${dbName}" → dừng`);

    const models = await prisma.product3DModel.findMany({
      include: { modelFiles: { include: { media: true } }, product: true },
      orderBy: { id: 'asc' },
    });
    const logs = await prisma.activityLog.findMany({
      where: { action: 'model.upload', targetType: 'product3dmodel' },
    });
    const sourcesOf = (id: number) =>
      logs
        .filter((l) => l.targetId === id)
        .map((l) => (l.changes as { sourceKey?: string } | null)?.sourceKey)
        .filter((k): k is string => Boolean(k));

    const sample = [];
    const kept: string[] = [];
    for (const m of models) {
      const sources = sourcesOf(m.id);
      const fromSeed = sources.some((k) => k.startsWith(SEED_SOURCE));
      const otherUpload = sources.some((k) => !k.startsWith(SEED_SOURCE));
      const managed = Boolean((m.viewerConfig as { pipeline?: unknown } | null)?.pipeline);
      const small = m.modelFiles.every((f) => f.media.fileSize < SAMPLE_MAX_BYTES);
      if (fromSeed && !otherUpload && !managed && small) sample.push(m);
      else kept.push(`#${m.id} ${m.product.slug} (${m.status})`);
    }
    const ids = sample.map((m) => m.id);
    const placements = await prisma.spaceProductPlacement.count({ where: { modelId: { in: ids } } });
    const materials = await prisma.modelMaterialVariant.count({ where: { modelId: { in: ids } } });
    log(
      `mô hình mẫu: ${sample.length}/${models.length} | tệp: ${sample.reduce((n, m) => n + m.modelFiles.length, 0)} | ` +
        `cấu hình vật liệu: ${materials} | vị trí 360° sẽ để trống model_id (giữ dòng): ${placements}`,
    );
    log(kept.length ? `GIỮ NGUYÊN ${kept.length} mô hình: ${kept.join(', ')}` : 'không có mô hình nào khác');
    if (!apply) return;

    const files = sample.flatMap((m) => m.modelFiles.map((f) => f.media));
    await prisma.$transaction([
      prisma.spaceProductPlacement.updateMany({ where: { modelId: { in: ids } }, data: { modelId: null } }),
      prisma.modelMaterialVariant.deleteMany({ where: { modelId: { in: ids } } }),
      prisma.modelFile.deleteMany({ where: { modelId: { in: ids } } }),
      prisma.product3DModel.deleteMany({ where: { id: { in: ids } } }),
    ]);

    // tệp của mô hình mẫu và bản gốc mock (mock/models/…): chỉ xóa khi không còn nơi nào dùng
    const mockMedia = await prisma.media.findMany({ where: { filePath: { startsWith: 'mock/models/' } } });
    let removed = 0;
    for (const media of [...files, ...mockMedia]) {
      const used =
        (await prisma.modelFile.count({ where: { mediaId: media.id } })) +
        (await prisma.product3DModel.count({ where: { posterMediaId: media.id } })) +
        (await prisma.productImage.count({ where: { mediaId: media.id } }));
      if (used) continue;
      const deleted = await prisma.media.deleteMany({ where: { id: media.id } });
      if (!deleted.count) continue;
      await removeObject(media.filePath, 'public').catch((e) =>
        log(`không xóa được tệp ${media.filePath}: ${e}`),
      );
      removed++;
    }
    for (const key of new Set(ids.flatMap(sourcesOf)))
      await removeObject(key, 'private').catch(() => undefined);
    const has3d = await prisma.product.count({ where: { has3dModel: true } });
    log(`ĐÃ xóa ${sample.length} mô hình mẫu, ${removed} tệp. Sản phẩm còn cờ 3D: ${has3d}.`);
    log('Nếu API đang chạy: danh sách sản phẩm có cache, tự cập nhật sau vài phút hoặc khởi động lại API.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
