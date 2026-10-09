import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { resolveForcePathStyle } from '../config/env.validation';
import type {
  ObjectInfo,
  PresignedPut,
  PresignPutInput,
  StorageService,
  UploadInput,
  Visibility,
} from './storage.service';

/**
 * MinIO (dev) hoặc AWS S3 (production), cùng một lớp: chuyển đổi chỉ bằng biến môi trường
 * (STORAGE_DRIVER, S3_ENDPOINT, S3_FORCE_PATH_STYLE, khóa truy cập, tên bucket, STORAGE_PUBLIC_URL). Hai bucket: public (đọc ẩn danh) và private (chỉ presigned GET).
 * Dùng hai client: `client` gọi nội bộ (S3_ENDPOINT), `signer` ký URL cho trình duyệt (S3_PUBLIC_ENDPOINT).
 * Hai endpoint có thể khác nhau (API trong Docker gọi http://minio:9000, trình duyệt gọi http://localhost:9000).
 */
@Injectable()
export class MinioStorageService implements StorageService {
  readonly driver: 'minio' | 's3';
  private readonly publicUrl: string;
  private readonly expires: number;
  private readonly buckets: Record<Visibility, string>;

  constructor(
    config: AppConfig,
    private readonly client: S3Client = MinioStorageService.createClient(config, false),
    private readonly signer: S3Client = MinioStorageService.createClient(config, true),
  ) {
    this.driver = config.get('STORAGE_DRIVER') === 's3' ? 's3' : 'minio';
    this.publicUrl = config.get('STORAGE_PUBLIC_URL').replace(/\/+$/, '');
    this.expires = config.get('PRESIGN_EXPIRES_SECONDS');
    this.buckets = {
      public: config.get('S3_BUCKET_PUBLIC'),
      private: config.get('S3_BUCKET_PRIVATE'),
    };
  }

  static createClient(config: AppConfig, forBrowser: boolean): S3Client {
    const internal = config.get('S3_ENDPOINT');
    const endpoint = forBrowser ? (config.get('S3_PUBLIC_ENDPOINT') ?? internal) : internal;
    return new S3Client({
      endpoint,
      region: config.get('S3_REGION'),
      // MinIO dùng đường dẫn /bucket/key; S3 thật dùng bucket.s3.<vùng>.amazonaws.com
      forcePathStyle: resolveForcePathStyle({
        STORAGE_DRIVER: config.get('STORAGE_DRIVER'),
        S3_FORCE_PATH_STYLE: config.get('S3_FORCE_PATH_STYLE'),
      }),
      // Không tự thêm header checksum vào URL ký sẵn (trình duyệt PUT thẳng sẽ bị từ chối)
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      // Không đặt khóa thì SDK tự dùng chuỗi thông tin xác thực mặc định (IAM role trên S3 production)
      ...(config.get('S3_ACCESS_KEY') && config.get('S3_SECRET_KEY')
        ? {
            credentials: {
              accessKeyId: config.get('S3_ACCESS_KEY') as string,
              secretAccessKey: config.get('S3_SECRET_KEY') as string,
            },
          }
        : {}),
    });
  }

  async upload({ key, body, contentType, visibility = 'public' }: UploadInput): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.buckets[visibility],
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async download(key: string, visibility: Visibility = 'public'): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.buckets[visibility], Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async delete(key: string, visibility: Visibility = 'public'): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.buckets[visibility], Key: key }));
  }

  async head(key: string, visibility: Visibility = 'public'): Promise<ObjectInfo | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.buckets[visibility], Key: key }),
      );
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (e) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  async presignPut({
    key,
    contentType,
    size,
    visibility = 'private',
  }: PresignPutInput): Promise<PresignedPut> {
    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.buckets[visibility],
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      // content-length và content-type được ký: client gửi sai dung lượng/loại thì MinIO từ chối
      { expiresIn: this.expires, signableHeaders: new Set(['content-type', 'content-length']) },
    );
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      key,
      expiresIn: this.expires,
    };
  }

  presignGet(key: string, visibility: Visibility = 'private', expiresIn = this.expires): Promise<string> {
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.buckets[visibility], Key: key }), {
      expiresIn,
    });
  }

  async ping(): Promise<void> {
    await Promise.all([
      this.client.send(new HeadBucketCommand({ Bucket: this.buckets.public })),
      this.client.send(new HeadBucketCommand({ Bucket: this.buckets.private })),
    ]);
  }
}
