// Reset DB làm id mô hình đếm lại từ đầu nhưng kho tệp không được dọn: bucket public của test có thể còn tệp của lượt
// chạy trước ở ĐÚNG địa chỉ mà mô hình mới sẽ dùng. Test nào khẳng định "chưa có gì công khai" phải dọn trước.
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

export async function clearTestPublicPrefix(prefix: string) {
  const bucket = process.env.S3_BUCKET_PUBLIC ?? '';
  if (!bucket.startsWith('aurelia-test-')) throw new Error(`Chỉ được dọn bucket test (nhận "${bucket}")`);
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
  });
  const found = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  for (const o of found.Contents ?? [])
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key! }));
}
