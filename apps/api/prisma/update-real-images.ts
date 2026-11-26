// Thay ẢNH SẢN PHẨM và ẢNH BÌA KHÔNG GIAN của một DB đã có dữ liệu bằng ảnh thật, ghép theo slug.
// Không đụng dữ liệu khác (poster 3D, đơn hàng, media cũ… giữ nguyên). Chạy lại nhiều lần không đổi gì thêm.
// An toàn: chỉ thay ảnh đang là ảnh mẫu (mock/img, mock/photos); sản phẩm/không gian có ảnh tự tải lên thì BỎ QUA.
// TRƯỚC KHI CHẠY: pg_dump DB. DATABASE_URL phải đặt tường minh trong lệnh (không lấy từ .env), --db phải trùng tên DB.
//   (ở apps/api)  DATABASE_URL=postgresql://…/<tên_db> STORAGE_DRIVER=local \
//                 npx ts-node --transpile-only prisma/update-real-images.ts --db <tên_db> [--apply]
// Không có --apply: chỉ in kế hoạch (không ghi DB, không ghi kho). Sau đó nếu dùng MinIO: npm run minio:sync
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

const log = (m: string) => process.stdout.write(`[real-images] ${m}\n`);
const REPLACEABLE = /^mock\/(img|photos)\//;
const PUBLIC_DIR = resolve(__dirname, '../../web/public');

interface Manifest {
  products: Record<string, { photos: Array<{ file: string; color?: string }> }>;
  spaces: Record<string, { file: string }>;
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { storeObject } = await import('./seed-storage');
  const manifest: Manifest = JSON.parse(
    await readFile(resolve(__dirname, '../../web/src/mock-data/photos/manifest.json'), 'utf8'),
  );
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [{ current }] = await prisma.$queryRaw<Array<{ current: string }>>`
      SELECT current_database() AS current`;
    log(`DB đích: ${current} | STORAGE_DRIVER=${process.env.STORAGE_DRIVER} | ${apply ? 'GHI' : 'chạy thử'}`);
    if (current !== dbName) throw new Error(`Đang nối tới "${current}", không phải "${dbName}" → dừng`);

    const readPhoto = (rel: string) => readFile(resolve(PUBLIC_DIR, rel)).catch(() => null);
    const count = { products: 0, images: 0, spaces: 0, same: 0, notInDb: 0, noFile: 0, custom: 0 };

    /** Đưa file lên kho và lấy (hoặc tạo) bản ghi media theo khóa */
    const mediaFor = async (key: string, body: Buffer, altText: string) => {
      const size = await storeObject(key, body, 'image/webp');
      const m = await prisma.media.upsert({
        where: { filePath: key },
        update: {},
        create: {
          fileName: key.split('/').pop()!,
          filePath: key,
          mimeType: 'image/webp',
          fileSize: size,
          altText,
        },
      });
      return m.id;
    };

    for (const [slug, entry] of Object.entries(manifest.products)) {
      const product = await prisma.product.findFirst({
        where: { slug },
        include: { productImages: { include: { media: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!product) {
        count.notInDb++;
        continue;
      }
      const keys = entry.photos.map((p) => `mock/photos/products/${slug}/${p.file}`);
      if (product.productImages.map((i) => i.media.filePath).join('|') === keys.join('|')) {
        count.same++;
        continue;
      }
      if (product.productImages.some((i) => !REPLACEABLE.test(i.media.filePath))) {
        log(`BỎ QUA ${slug}: có ảnh không phải ảnh mẫu (tự tải lên)`);
        count.custom++;
        continue;
      }
      const bodies = await Promise.all(keys.map(readPhoto));
      if (bodies.some((b) => !b)) {
        log(`BỎ QUA ${slug}: thiếu file ảnh đã chuyển (npm run images:convert)`);
        count.noFile++;
        continue;
      }
      const rows: Array<{ variantId: number | null; alt: string }> = [];
      for (const [i, photo] of entry.photos.entries()) {
        let variantId: number | null = null;
        if (photo.color) {
          const v = await prisma.productVariant.findFirst({
            where: {
              productId: product.id,
              variantAttributeValues: { some: { attributeValue: { value: photo.color } } },
            },
            orderBy: { id: 'asc' },
          });
          variantId = v?.id ?? null;
          if (!v) log(`${slug}: không có biến thể màu "${photo.color}" → ảnh để chung`);
        }
        rows.push({
          variantId,
          alt: photo.color ? `${product.name} màu ${photo.color}` : `${product.name} – ảnh ${i + 1}`,
        });
      }
      log(
        `${slug}: ${product.productImages.length} ảnh mẫu → ${keys.length} ảnh thật` +
          ` (gắn màu: ${rows.filter((r) => r.variantId).length})`,
      );
      count.products++;
      count.images += keys.length;
      if (!apply) continue;
      const mediaIds: number[] = [];
      for (const [i, key] of keys.entries()) mediaIds.push(await mediaFor(key, bodies[i]!, rows[i].alt));
      await prisma.$transaction([
        prisma.productImage.deleteMany({ where: { productId: product.id } }),
        prisma.productImage.createMany({
          data: mediaIds.map((mediaId, i) => ({
            productId: product.id,
            variantId: rows[i].variantId,
            mediaId,
            sortOrder: i + 1,
            isPrimary: i === 0,
          })),
        }),
      ]);
    }

    for (const [slug, entry] of Object.entries(manifest.spaces)) {
      const space = await prisma.space.findFirst({ where: { slug }, include: { coverMedia: true } });
      if (!space) {
        count.notInDb++;
        continue;
      }
      const key = `mock/photos/spaces/${slug}/${entry.file}`;
      if (space.coverMedia?.filePath === key) {
        count.same++;
        continue;
      }
      if (space.coverMedia && !REPLACEABLE.test(space.coverMedia.filePath)) {
        log(`BỎ QUA không gian ${slug}: ảnh bìa tự tải lên`);
        count.custom++;
        continue;
      }
      const body = await readPhoto(key);
      if (!body) {
        log(`BỎ QUA không gian ${slug}: thiếu file ảnh đã chuyển`);
        count.noFile++;
        continue;
      }
      log(`không gian ${slug}: thay ảnh bìa`);
      count.spaces++;
      if (!apply) continue;
      const coverMediaId = await mediaFor(key, body, space.title);
      await prisma.space.update({ where: { id: space.id }, data: { coverMediaId } });
    }

    log(
      `${apply ? 'ĐÃ thay' : 'SẼ thay'}: ${count.products} sản phẩm (${count.images} ảnh), ${count.spaces} ảnh bìa | ` +
        `đã đúng sẵn ${count.same} | không có slug trong DB ${count.notInDb} | thiếu file ${count.noFile} | ` +
        `bỏ qua vì ảnh tự tải ${count.custom}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
