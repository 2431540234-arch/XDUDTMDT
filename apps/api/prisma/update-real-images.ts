// Thay ẢNH SẢN PHẨM và ẢNH BÌA KHÔNG GIAN của một DB đã có dữ liệu bằng ảnh thật, ghép theo slug.
// Sản phẩm/không gian đang có ảnh thật nhưng đã bị BỎ khỏi manifest thì được đưa về ảnh minh họa của mock.
// Poster mô hình 3D chỉ đổi khi đang trỏ tới ảnh thật của chính sản phẩm đó. Không đụng dữ liệu khác (đơn hàng, media cũ…
// giữ nguyên). Chạy lại nhiều lần không đổi gì thêm.
// An toàn: chỉ thay ảnh đang là ảnh mẫu (mock/img, mock/photos); sản phẩm/không gian có ảnh tự tải lên thì BỎ QUA.
// TRƯỚC KHI CHẠY: pg_dump DB. DATABASE_URL phải đặt tường minh trong lệnh (không lấy từ .env), --db phải trùng tên DB.
//   (ở apps/api)  DATABASE_URL=postgresql://…/<tên_db> STORAGE_DRIVER=local \
//                 npx ts-node --transpile-only prisma/update-real-images.ts --db <tên_db> [--apply]
// Không có --apply: chỉ in kế hoạch (không ghi DB, không ghi kho). Sau đó nếu dùng MinIO: npm run minio:sync
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WEB_SRC, illustrationKey, renderSvg } from './mock-source';

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

interface Target {
  key: string;
  body: Buffer;
  mime: string;
  alt: string;
  fileName?: string;
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { storeObject } = await import('./seed-storage');
  const manifest: Manifest = JSON.parse(
    await readFile(resolve(WEB_SRC, 'mock-data/photos/manifest.json'), 'utf8'),
  );
  // Bộ ảnh minh họa gốc của mock (ép KHÔNG dùng ảnh thật) – để đưa lại cho mục đã bỏ khỏi manifest
  process.env.NEXT_PUBLIC_MOCK_PHOTOS = '';
  const { buildSeed } = await import('../../web/src/mock-data/db');
  const mock = buildSeed();
  const mockMedia = new Map(mock.media.map((m) => [m.id, m]));

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [{ current }] = await prisma.$queryRaw<Array<{ current: string }>>`
      SELECT current_database() AS current`;
    log(`DB đích: ${current} | STORAGE_DRIVER=${process.env.STORAGE_DRIVER} | ${apply ? 'GHI' : 'chạy thử'}`);
    if (current !== dbName) throw new Error(`Đang nối tới "${current}", không phải "${dbName}" → dừng`);

    const count = {
      products: 0,
      images: 0,
      spaces: 0,
      restoredProducts: 0,
      restoredSpaces: 0,
      same: 0,
      notInDb: 0,
      noFile: 0,
      custom: 0,
    };

    /** Ảnh thật: đọc file đã chuyển; null nếu máy thiếu */
    const photo = async (key: string, alt: string): Promise<Target | null> => {
      const body = await readFile(resolve(PUBLIC_DIR, key)).catch(() => null);
      return body ? { key, body, mime: 'image/webp', alt } : null;
    };
    /** Ảnh minh họa của mock từ URL /mock-img/… */
    const illustration = async (mediaId: number): Promise<Target> => {
      const m = mockMedia.get(mediaId)!;
      const svg = await renderSvg(m.filePath);
      if (svg === null) throw new Error(`Không dựng được ảnh ${m.filePath}`);
      return {
        key: illustrationKey(m.filePath),
        body: Buffer.from(svg, 'utf8'),
        mime: 'image/svg+xml',
        alt: m.altText ?? '',
        fileName: m.fileName,
      };
    };

    /** Đưa tệp lên kho và lấy (hoặc tạo) bản ghi media theo khóa */
    const mediaFor = async (t: Target) => {
      const size = await storeObject(t.key, t.body, t.mime);
      const m = await prisma.media.upsert({
        where: { filePath: t.key },
        update: {},
        create: {
          fileName: t.fileName ?? t.key.split('/').pop()!,
          filePath: t.key,
          mimeType: t.mime,
          fileSize: size,
          altText: t.alt,
        },
      });
      return m.id;
    };

    /** Biến thể đầu tiên của một màu (cùng quy tắc gắn ảnh của mock) */
    const variantOfColor = async (productId: number, color: string | undefined, slug: string) => {
      if (!color) return null;
      const v = await prisma.productVariant.findFirst({
        where: { productId, variantAttributeValues: { some: { attributeValue: { value: color } } } },
        orderBy: { id: 'asc' },
      });
      if (!v) log(`${slug}: không có biến thể màu "${color}" → ảnh để chung`);
      return v?.id ?? null;
    };
    const mockColorOf = (variantId: number | null) => {
      const link = mock.variantAttributeValues.find(
        (x) => x.variantId === variantId && x.attributeCode === 'color',
      );
      return mock.attributeValues.find((x) => x.id === link?.attributeValueId)?.value;
    };

    // mọi sản phẩm trong manifest + mọi sản phẩm trong DB còn đang dùng ảnh thật (đã bị bỏ khỏi manifest)
    const withPhotos = await prisma.product.findMany({
      where: { productImages: { some: { media: { filePath: { startsWith: 'mock/photos/products/' } } } } },
      select: { slug: true },
    });
    const productSlugs = new Set([...Object.keys(manifest.products), ...withPhotos.map((p) => p.slug)]);

    for (const slug of productSlugs) {
      const product = await prisma.product.findFirst({
        where: { slug },
        include: { productImages: { include: { media: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!product) {
        count.notInDb++;
        continue;
      }
      if (product.productImages.some((i) => !REPLACEABLE.test(i.media.filePath))) {
        log(`BỎ QUA ${slug}: có ảnh không phải ảnh mẫu (tự tải lên)`);
        count.custom++;
        continue;
      }
      const entry = manifest.products[slug];
      const wanted: Array<{ target: Target | null; variantId: number | null }> = [];
      if (entry) {
        for (const [i, p] of entry.photos.entries()) {
          const alt = p.color ? `${product.name} màu ${p.color}` : `${product.name} – ảnh ${i + 1}`;
          wanted.push({
            target: await photo(`mock/photos/products/${slug}/${p.file}`, alt),
            variantId: await variantOfColor(product.id, p.color, slug),
          });
        }
      } else {
        const source = mock.products.find((p) => p.slug === slug);
        const images = mock.productImages
          .filter((i) => i.productId === source?.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (!images.length) {
          log(`BỎ QUA ${slug}: không có ảnh minh họa trong mock để đưa về`);
          count.noFile++;
          continue;
        }
        for (const img of images)
          wanted.push({
            target: await illustration(img.mediaId),
            variantId: await variantOfColor(product.id, mockColorOf(img.variantId), slug),
          });
      }
      if (wanted.some((w) => !w.target)) {
        log(`BỎ QUA ${slug}: thiếu file ảnh đã chuyển (npm run images:convert)`);
        count.noFile++;
        continue;
      }
      const now = product.productImages.map((i) => `${i.media.filePath}#${i.variantId}`).join('|');
      if (now === wanted.map((w) => `${w.target!.key}#${w.variantId}`).join('|')) {
        count.same++;
        continue;
      }
      log(
        `${slug}: ${product.productImages.length} ảnh → ${wanted.length} ${entry ? 'ảnh thật' : 'ảnh MINH HỌA (đã bỏ khỏi manifest)'}` +
          ` (gắn màu: ${wanted.filter((w) => w.variantId).length})`,
      );
      if (entry) {
        count.products++;
        count.images += wanted.length;
      } else count.restoredProducts++;
      if (!apply) continue;
      const mediaIds: number[] = [];
      for (const w of wanted) mediaIds.push(await mediaFor(w.target!));
      await prisma.$transaction([
        prisma.productImage.deleteMany({ where: { productId: product.id } }),
        prisma.productImage.createMany({
          data: mediaIds.map((mediaId, i) => ({
            productId: product.id,
            variantId: wanted[i].variantId,
            mediaId,
            sortOrder: i + 1,
            isPrimary: i === 0,
          })),
        }),
        // poster 3D đang trỏ tới ảnh thật không còn dùng của sản phẩm → trỏ về ảnh chính mới
        prisma.product3DModel.updateMany({
          where: {
            productId: product.id,
            posterMedia: { filePath: { startsWith: `mock/photos/products/${slug}/` } },
            posterMediaId: { notIn: mediaIds },
          },
          data: { posterMediaId: mediaIds[0] },
        }),
      ]);
    }

    const spacesWithPhotos = await prisma.space.findMany({
      where: { coverMedia: { filePath: { startsWith: 'mock/photos/spaces/' } } },
      select: { slug: true },
    });
    const spaceSlugs = new Set([...Object.keys(manifest.spaces), ...spacesWithPhotos.map((s) => s.slug)]);
    for (const slug of spaceSlugs) {
      const space = await prisma.space.findFirst({ where: { slug }, include: { coverMedia: true } });
      if (!space) {
        count.notInDb++;
        continue;
      }
      if (space.coverMedia && !REPLACEABLE.test(space.coverMedia.filePath)) {
        log(`BỎ QUA không gian ${slug}: ảnh bìa tự tải lên`);
        count.custom++;
        continue;
      }
      const entry = manifest.spaces[slug];
      const sourceCover = mock.spaces.find((s) => s.slug === slug)?.coverMediaId;
      const target = entry
        ? await photo(`mock/photos/spaces/${slug}/${entry.file}`, space.title)
        : sourceCover
          ? await illustration(sourceCover)
          : null;
      if (!target) {
        log(`BỎ QUA không gian ${slug}: không có ảnh để thay`);
        count.noFile++;
        continue;
      }
      if (space.coverMedia?.filePath === target.key) {
        count.same++;
        continue;
      }
      log(`không gian ${slug}: thay ảnh bìa${entry ? '' : ' về ảnh MINH HỌA'}`);
      if (entry) count.spaces++;
      else count.restoredSpaces++;
      if (!apply) continue;
      const coverMediaId = await mediaFor(target);
      await prisma.space.update({ where: { id: space.id }, data: { coverMediaId } });
    }

    log(
      `${apply ? 'ĐÃ thay' : 'SẼ thay'}: ${count.products} sản phẩm (${count.images} ảnh), ${count.spaces} ảnh bìa | ` +
        `về minh họa: ${count.restoredProducts} sản phẩm, ${count.restoredSpaces} bìa | đã đúng sẵn ${count.same} | ` +
        `không có slug trong DB ${count.notInDb} | thiếu file ${count.noFile} | bỏ qua vì ảnh tự tải ${count.custom}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
