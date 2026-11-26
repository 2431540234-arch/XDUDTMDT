// Chuyển ảnh thật (2 thư mục "sản phẩm/" và "không gia mẫu/" ở gốc repo) sang WebP cho dữ liệu mẫu.
//   npm run images:convert                 (chỉ chuyển file chưa có)
//   npm run images:convert -- --force      (chuyển lại tất cả)
// Chỉ ĐỌC ảnh gốc. Kết quả ghi vào apps/web/public/mock/photos/ (git bỏ qua – ảnh KHÔNG được commit).
// Bảng ghép ảnh ↔ sản phẩm/không gian: apps/web/src/mock-data/photos/manifest.json
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sharp = createRequire(resolve(root, 'apps/api/package.json'))('sharp');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'apps/web/src/mock-data/photos/manifest.json'), 'utf8'),
);
const outDir = resolve(root, 'apps/web/public/mock/photos');
const force = process.argv.includes('--force');
const MAX_SIDE = 1600;
const QUALITY = 80;

const jobs = [
  ...Object.entries(manifest.products).flatMap(([slug, p]) =>
    p.photos.map((x) => ({ source: x.source, out: `products/${slug}/${x.file}` })),
  ),
  ...Object.entries(manifest.spaces).map(([slug, x]) => ({
    source: x.source,
    out: `spaces/${slug}/${x.file}`,
  })),
];

let converted = 0;
let skipped = 0;
const missing = [];
for (const job of jobs) {
  const from = resolve(root, job.source);
  const to = resolve(outDir, job.out);
  if (!force && existsSync(to)) {
    skipped++;
    continue;
  }
  if (!existsSync(from)) {
    missing.push(job.source);
    continue;
  }
  await mkdir(dirname(to), { recursive: true });
  await sharp(from)
    .rotate() // áp hướng EXIF; sharp không chép metadata sang file ra
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(to);
  converted++;
}

console.log(
  `[images] chuyển ${converted}, đã có ${skipped}, thiếu ảnh gốc ${missing.length} / ${jobs.length}`,
);
if (missing.length) {
  console.log('[images] Sản phẩm/không gian thiếu ảnh sẽ dùng ảnh minh họa. Ví dụ file thiếu:');
  missing.slice(0, 5).forEach((m) => console.log(`  - ${m}`));
}
