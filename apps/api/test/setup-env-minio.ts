// Môi trường cho test:e2e:minio: DB aurelia_test (đã seed), Redis, MinIO thật với bucket RIÊNG của test.
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://aurelia:aurelia@localhost:${process.env.POSTGRES_PORT ?? '55432'}/aurelia_test?schema=public`;
process.env.SWAGGER_ENABLED = 'false';
process.env.REDIS_HOST ??= 'localhost';
process.env.THROTTLE_DEFAULT_LIMIT = '100000';
process.env.THROTTLE_AUTH_LIMIT = '100000';
process.env.CACHE_KEY_PREFIX = 'cache-e2e-minio:';
process.env.MAIL_TRANSPORT = 'direct';

process.env.STORAGE_DRIVER = 'minio';
process.env.S3_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_ACCESS_KEY ??= 'aurelia';
process.env.S3_SECRET_KEY ??= 'aurelia123';
process.env.S3_BUCKET_PUBLIC = 'aurelia-test-public';
process.env.S3_BUCKET_PRIVATE = 'aurelia-test-private';
process.env.STORAGE_PUBLIC_URL = `${process.env.S3_ENDPOINT}/aurelia-test-public`;
