// Chạy một lần trước e2e: áp migration lên DB test và tạo bucket test (public/private) trên MinIO.
import { execSync } from 'node:child_process';
import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, S3Client } from '@aws-sdk/client-s3';
import './setup-env';

async function ensureBucket(s3: S3Client, bucket: string, isPublic: boolean) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  if (isPublic) {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };
    await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
  }
}

export default async function globalSetup() {
  execSync('npx prisma migrate deploy', { cwd: __dirname + '/..', stdio: 'inherit', env: process.env });

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
  });
  await ensureBucket(s3, process.env.S3_BUCKET_PUBLIC!, true);
  await ensureBucket(s3, process.env.S3_BUCKET_PRIVATE!, false);
}
