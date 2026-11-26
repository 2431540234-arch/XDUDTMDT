// Chuyển ảnh thật (2 thư mục "sản phẩm/" và "không gia mẫu/" ở gốc repo) sang WebP cho dữ liệu mẫu.
//   npm run images:convert                 (chỉ chuyển file chưa có)
//   npm run images:convert -- --force      (chuyển lại tất cả)
// "crop" trong manifest: tỉ lệ bị cắt ở mỗi mép (0–1, tính trên ảnh gốc). Đổi vùng cắt thì đổi cả tên file ra
// (kho không ghi đè khóa cũ). File .webp không còn trong manifest bị xóa khỏi thư mục kết quả.
// Chỉ ĐỌC ảnh gốc. Kết quả ghi vào apps/web/public/mock/photos/ (git bỏ qua – ảnh KHÔNG được commit).
// Bảng ghép ảnh ↔ sản phẩm/không gian: apps/web/src/mock-data/photos/manifest.json
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';

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
    p.photos.map((x) => ({ source: x.source, crop: x.crop, out: `products/${slug}/${x.file}` })),
  ),
  ...Object.entries(manifest.spaces).map(([slug, x]) => ({
    source: x.source,
    out: `spaces/${slug}/${x.file}`,
  })),
];

/** Ảnh đã áp hướng EXIF và cắt mép theo manifest */
async function load(from, crop) {
  if (!crop) return sharp(from).rotate();
  const { data, info } = await sharp(from).rotate().toBuffer({ resolveWithObject: true });
  const { left = 0, top = 0, right = 0, bottom = 0 } = crop;
  const x = Math.round(info.width * left);
  const y = Math.round(info.height * top);
  return sharp(data).extract({
    left: x,
    top: y,
    width: Math.round(info.width * (1 - right)) - x,
    height: Math.round(info.height * (1 - bottom)) - y,
  });
}

// dọn ảnh đã bị bỏ khỏi manifest (chỉ trong thư mục kết quả do script này sinh ra)
const wanted = new Set(jobs.map((j) => j.out));
let removed = 0;
if (existsSync(outDir)) {
  for (const f of readdirSync(outDir, { recursive: true })) {
    const rel = String(f).split(sep).join('/');
    if (rel.endsWith('.webp') && !wanted.has(rel)) {
      await rm(resolve(outDir, rel));
      removed++;
    }
  }
}

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
  // sharp không chép metadata sang file ra
  await (
    await load(from, job.crop)
  )
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(to);
  converted++;
}

console.log(
  `[images] chuyển ${converted}, đã có ${skipped}, xóa file thừa ${removed}, thiếu ảnh gốc ${missing.length} / ${jobs.length}`,
);
if (missing.length) {
  console.log('[images] Sản phẩm/không gian thiếu ảnh sẽ dùng ảnh minh họa. Ví dụ file thiếu:');
  missing.slice(0, 5).forEach((m) => console.log(`  - ${m}`));
}
