import { resolveForcePathStyle, validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
};
const minio = { S3_ENDPOINT: 'http://localhost:9000', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 'secret-key' };

describe('validateEnv', () => {
  it('mặc định: STORAGE_DRIVER=minio và MAIL_TRANSPORT=queue, cache bật, throttler có giá trị mặc định', () => {
    const env = validateEnv({ ...base, ...minio });
    expect(env.STORAGE_DRIVER).toBe('minio');
    expect(env.MAIL_TRANSPORT).toBe('queue');
    expect(env.CACHE_ENABLED).toBe(true);
    expect(env.THROTTLE_AUTH_LIMIT).toBe(10);
    expect(env.THROTTLE_DEFAULT_LIMIT).toBe(120);
  });

  it('driver minio thiếu S3_ENDPOINT/khóa truy cập -> báo lỗi rõ ràng', () => {
    expect(() => validateEnv({ ...base })).toThrow(/S3_ENDPOINT.*bắt buộc khi STORAGE_DRIVER=minio/s);
  });

  it('driver s3: S3_ENDPOINT và khóa truy cập là tùy chọn (chuyển S3 chỉ đổi biến môi trường)', () => {
    const env = validateEnv({ ...base, STORAGE_DRIVER: 's3', S3_REGION: 'ap-southeast-1', S3_ENDPOINT: '' });
    expect(env.STORAGE_DRIVER).toBe('s3');
    expect(env.S3_ENDPOINT).toBeUndefined();
    expect(env.S3_REGION).toBe('ap-southeast-1');
  });

  it('S3_FORCE_PATH_STYLE: mặc định true với minio, false với s3, đặt biến thì theo biến', () => {
    expect(resolveForcePathStyle(validateEnv({ ...base, ...minio }))).toBe(true);
    expect(resolveForcePathStyle(validateEnv({ ...base, STORAGE_DRIVER: 's3' }))).toBe(false);
    expect(resolveForcePathStyle(validateEnv({ ...base, ...minio, S3_FORCE_PATH_STYLE: 'false' }))).toBe(
      false,
    );
    expect(
      resolveForcePathStyle(validateEnv({ ...base, STORAGE_DRIVER: 's3', S3_FORCE_PATH_STYLE: 'true' })),
    ).toBe(true);
  });

  it('giá trị sai bị từ chối', () => {
    expect(() => validateEnv({ ...base, ...minio, MAIL_TRANSPORT: 'smtp' })).toThrow(/MAIL_TRANSPORT/);
    expect(() => validateEnv({ ...base, ...minio, STORAGE_DRIVER: 'gcs' })).toThrow(/STORAGE_DRIVER/);
  });
});
