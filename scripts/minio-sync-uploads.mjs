// Chép tệp đã lưu bằng driver `local` (apps/api/uploads/public và /private) lên MinIO, GIỮ NGUYÊN khóa
// (media.file_path không đổi). Idempotent: tệp đã có cùng dung lượng thì bỏ qua. KHÔNG xóa gì ở thư mục nguồn.
//   node scripts/minio-sync-uploads.mjs            (chép)
//   node scripts/minio-sync-uploads.mjs --dry-run  (chỉ đếm)
// Đọc S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_PUBLIC, S3_BUCKET_PRIVATE, STORAGE_PUBLIC_URL từ .env gốc.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(root, 'apps/api/package.json'));
const { config } = require('dotenv');
const { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
config({ path: resolve(root, '.env') });

const env = process.env;
const dry = process.argv.includes('--dry-run');
const buckets = {
  public: env.S3_BUCKET_PUBLIC ?? 'aurelia-public',
  private: env.S3_BUCKET_PRIVATE ?? 'aurelia-private',
};
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY ?? 'aurelia',
    secretAccessKey: env.S3_SECRET_KEY ?? 'aurelia123',
  },
});
const baseDir = resolve(root, 'apps/api', env.STORAGE_LOCAL_DIR ?? './uploads');

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.usdz': 'model/vnd.usdz+zip',
};
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
  );

async function remoteSize(bucket, key) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return r.ContentLength;
  } catch {
    return null;
  }
}

async function countBucket(bucket) {
  let n = 0;
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    n += r.KeyCount ?? 0;
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return n;
}

const summary = {};
for (const vis of ['public', 'private']) {
  const dir = join(baseDir, vis);
  let files = [];
  try {
    files = walk(dir);
  } catch {
    console.log(`(không có thư mục ${dir})`);
  }
  const keys = files.map((f) => ({ file: f, key: relative(dir, f).split('\\').join('/') }));
  const before = await countBucket(buckets[vis]);
  let copied = 0;
  let skipped = 0;
  console.log(
    `\n[${vis}] nguồn ${keys.length} tệp (${dir}); bucket ${buckets[vis]} đang có ${before} đối tượng`,
  );
  if (!dry) {
    for (const { file, key } of keys) {
      const size = statSync(file).size;
      if ((await remoteSize(buckets[vis], key)) === size) {
        skipped++;
        continue;
      }
      await s3.send(
        new PutObjectCommand({
          Bucket: buckets[vis],
          Key: key,
          Body: readFileSync(file),
          ContentType: MIME[extname(key).toLowerCase()] ?? 'application/octet-stream',
        }),
      );
      copied++;
    }
  }
  const after = await countBucket(buckets[vis]);
  // đối chiếu từng khóa nguồn có mặt ở đích
  let missing = 0;
  for (const { key, file } of keys)
    if ((await remoteSize(buckets[vis], key)) !== statSync(file).size) missing++;
  summary[vis] = { source: keys.length, before, copied, skipped, after, missing, keys };
  console.log(
    `[${vis}] chép mới ${copied}, bỏ qua (đã có) ${skipped}; bucket sau: ${after}; khóa nguồn thiếu/khác dung lượng ở đích: ${missing}`,
  );
}

// Kiểm ngẫu nhiên một số URL công khai mở được (bucket public cho đọc ẩn danh)
const pub = (env.STORAGE_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${buckets.public}`).replace(/\/+$/, '');
const sample = [...summary.public.keys].sort(() => Math.random() - 0.5).slice(0, 8);
let okUrls = 0;
for (const { key } of sample) {
  const r = await fetch(`${pub}/${key}`);
  const ok = r.ok;
  if (ok) okUrls++;
  console.log(`  ${ok ? 'OK ' : 'LỖI'} ${r.status} ${pub}/${key}`);
}
console.log(`\nURL công khai mở được: ${okUrls}/${sample.length}`);
const bad = Object.values(summary).some((s) => s.missing > 0) || okUrls !== sample.length;
console.log(
  bad ? 'KẾT QUẢ: CÓ VẤN ĐỀ (xem ở trên)' : dry ? 'KẾT QUẢ: dry-run' : 'KẾT QUẢ: đủ tệp, khóa giữ nguyên',
);
process.exit(bad && !dry ? 1 : 0);
