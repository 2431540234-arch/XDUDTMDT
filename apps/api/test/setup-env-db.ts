// Môi trường cho e2e "DB thật" (supertest + Postgres aurelia_test đã seed từ mock-data). KHÔNG dùng aurelia_dev/aurelia_demo.
// Tạo/seed DB: node scripts/db-reset.mjs aurelia_test   (chạy lại trước mỗi lần chạy vì test làm thay đổi dữ liệu)
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://aurelia:aurelia@localhost:${process.env.POSTGRES_PORT ?? '55432'}/aurelia_test?schema=public`;
process.env.SWAGGER_ENABLED = 'false';
// Lưu tệp trên đĩa (không cần MinIO)
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = './.tmp-uploads-db';
process.env.STORAGE_PUBLIC_URL = 'http://localhost:4000/uploads';
process.env.REDIS_HOST ??= 'localhost';
process.env.THROTTLE_DEFAULT_LIMIT = '100000';
process.env.THROTTLE_AUTH_LIMIT = '100000';
process.env.CACHE_KEY_PREFIX = 'cache-e2e-db:';
process.env.MAIL_TRANSPORT = 'direct';
process.env.PAYMENT_SANDBOX_FAKE = 'true';
delete process.env.OTP_FIXED_CODE;
