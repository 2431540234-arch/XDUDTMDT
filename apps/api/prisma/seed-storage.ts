// Đưa tệp mẫu của seed lên kho (MinIO hoặc đĩa local) để dữ liệu mẫu trỏ tới tệp thật. Idempotent:
// tệp đã có thì bỏ qua. Chạy ngoài Nest nên tự đọc biến môi trường (dotenv-cli nạp .env gốc).
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const env = process.env;
export const storageDriver = (env.STORAGE_DRIVER ?? 'minio') as 'local' | 'minio';

let s3: S3Client | undefined;
function client(): S3Client {
  s3 ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY as string, secretAccessKey: env.S3_SECRET_KEY as string },
  });
  return s3;
}

async function exists(key: string): Promise<boolean> {
  if (storageDriver === 'local') {
    return stat(localPath(key)).then(
      () => true,
      () => false,
    );
  }
  try {
    await client().send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET_PUBLIC ?? 'aurelia-public', Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

const localPath = (key: string) =>
  resolve(__dirname, '..', env.STORAGE_LOCAL_DIR ?? './uploads', 'public', key);

/** Tạo nội dung giả hợp lệ theo loại tệp: ảnh màu đơn sắc, GLB lấy từ fixture, USDZ là ZIP tối thiểu. */
async function placeholder(key: string, mimeType: string): Promise<Buffer> {
  if (mimeType.startsWith('image/')) {
    const img = sharp({ create: { width: 800, height: 600, channels: 3, background: '#b08d6e' } });
    return mimeType === 'image/png' ? img.png().toBuffer() : img.jpeg({ quality: 70 }).toBuffer();
  }
  if (mimeType === 'model/gltf-binary') {
    return readFile(resolve(__dirname, '../test/fixtures/sphere.glb'));
  }
  // USDZ (ZIP) tối thiểu: chữ ký local file header + phần đệm. Chỉ để minh họa, không dùng để dựng hình.
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0)]);
}

/** Đảm bảo tệp mẫu có trên kho; trả về dung lượng thật nếu vừa tải lên, null nếu đã có sẵn. */
export async function ensureSampleObject(key: string, mimeType: string): Promise<number | null> {
  if (await exists(key)) return null;
  const body = await placeholder(key, mimeType);
  if (storageDriver === 'local') {
    await mkdir(dirname(localPath(key)), { recursive: true });
    await writeFile(localPath(key), body);
  } else {
    await client().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_PUBLIC ?? 'aurelia-public',
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }
  return body.length;
}
