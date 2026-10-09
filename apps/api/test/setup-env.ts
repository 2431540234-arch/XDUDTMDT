// Biến môi trường cho test. KHÔNG dùng DB/bucket dev: DB postgres-test (cổng 5433), bucket aurelia-test-*, tiền tố Redis riêng.
// Đọc .env gốc để lấy cổng/khóa của máy (ví dụ REDIS_PORT=6380), rồi ghi đè những gì test cần cô lập.
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://aurelia:aurelia@localhost:5433/aurelia_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';
process.env.SWAGGER_ENABLED = 'false';
process.env.STORAGE_LOCAL_DIR = './.tmp-uploads';

// Redis / MinIO: mặc định theo .env, hoặc cổng chuẩn khi chạy ở CI
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
process.env.STORAGE_DRIVER = 'minio';
process.env.S3_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_ACCESS_KEY ??= 'aurelia';
process.env.S3_SECRET_KEY ??= 'aurelia123';
process.env.S3_BUCKET_PUBLIC = 'aurelia-test-public';
process.env.S3_BUCKET_PRIVATE = 'aurelia-test-private';
process.env.STORAGE_PUBLIC_URL = `${process.env.S3_ENDPOINT}/aurelia-test-public`;

// Hạ tầng dùng chung: cô lập khóa Redis của test, hạn mức auth thấp để test 429 nhanh, email đi qua queue
process.env.THROTTLE_AUTH_LIMIT = '3';
process.env.THROTTLE_AUTH_TTL_SECONDS = '60';
process.env.THROTTLE_DEFAULT_LIMIT = '1000';
process.env.CACHE_KEY_PREFIX = 'cache-test:';
process.env.CACHE_ENABLED = 'true';
process.env.MAIL_TRANSPORT = 'queue';
process.env.MAILPIT_API_URL ??= `http://localhost:${process.env.MAILPIT_UI_PORT ?? '8025'}`;
