import { resolveForcePathStyle, ttlSeconds, validateEnv } from './env.validation';

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
    expect(env.MODEL_SERVE_MAX_MB).toBe(5);
  });

  it('access token: mặc định 15m; production không cho dài hơn 15 phút, dev thì được', () => {
    expect(validateEnv({ ...base, ...minio }).JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(() =>
      validateEnv({
        ...base,
        ...minio,
        NODE_ENV: 'production',
        PAYMENT_SANDBOX_FAKE: 'false',
        JWT_ACCESS_EXPIRES_IN: '12h',
      }),
    ).toThrow(/JWT_ACCESS_EXPIRES_IN.*tối đa 15m/s);
    expect(
      validateEnv({
        ...base,
        ...minio,
        NODE_ENV: 'production',
        PAYMENT_SANDBOX_FAKE: 'false',
        JWT_ACCESS_EXPIRES_IN: '10m',
      }).NODE_ENV,
    ).toBe('production');
    expect(
      validateEnv({ ...base, ...minio, NODE_ENV: 'development', JWT_ACCESS_EXPIRES_IN: '12h' })
        .JWT_ACCESS_EXPIRES_IN,
    ).toBe('12h');
    expect([ttlSeconds('15m'), ttlSeconds('12h'), ttlSeconds('900'), ttlSeconds('abc')]).toEqual([
      900,
      43200,
      900,
      Infinity,
    ]);
  });

  it('PAYMENT_SANDBOX_FAKE: dev được bật; NODE_ENV=production mà bật thì app không khởi động', () => {
    expect(validateEnv({ ...base, ...minio, PAYMENT_SANDBOX_FAKE: 'true' }).PAYMENT_SANDBOX_FAKE).toBe(true);
    expect(() =>
      validateEnv({ ...base, ...minio, NODE_ENV: 'production', PAYMENT_SANDBOX_FAKE: 'true' }),
    ).toThrow(/PAYMENT_SANDBOX_FAKE.*production/s);
    expect(() => validateEnv({ ...base, ...minio, NODE_ENV: 'production' })).toThrow(/PAYMENT_SANDBOX_FAKE/);
    expect(
      validateEnv({ ...base, ...minio, NODE_ENV: 'production', PAYMENT_SANDBOX_FAKE: 'false' })
        .PAYMENT_SANDBOX_FAKE,
    ).toBe(false);
  });

  it('SWAGGER_ENABLED: không đặt ⇒ bật ở dev/test, TẮT ở production; chỉ bật ở production khi đặt true rõ ràng', () => {
    const prod = { ...base, ...minio, NODE_ENV: 'production', PAYMENT_SANDBOX_FAKE: 'false' };
    expect(validateEnv({ ...base, ...minio }).SWAGGER_ENABLED).toBe(true);
    expect(validateEnv({ ...base, ...minio, NODE_ENV: 'test' }).SWAGGER_ENABLED).toBe(true);
    expect(validateEnv(prod).SWAGGER_ENABLED).toBe(false);
    expect(validateEnv({ ...prod, SWAGGER_ENABLED: '' }).SWAGGER_ENABLED).toBe(false);
    expect(validateEnv({ ...prod, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
    expect(validateEnv({ ...base, ...minio, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
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
