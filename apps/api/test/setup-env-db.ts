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
// CI không có .env: tự đặt khóa JWT của test (máy dev vẫn dùng giá trị trong .env nếu có)
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789';
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

// Test KHÔNG BAO GIỜ dùng khóa VNPAY thật trong apps/api/.env hay .env gốc: đặt rỗng trong process.env (ưu tiên hơn mọi tệp .env).
for (const k of [
  'VNPAY_TMN_CODE',
  'VNPAY_HASH_SECRET',
  'VNPAY_RETURN_URL',
  'VNPAY_PAYMENT_URL',
  'VNPAY_QUERY_URL',
])
  process.env[k] = '';
// Test KHÔNG gọi Hugging Face thật: token rỗng và nhà cung cấp giả lập
process.env.HF_TOKEN = '';
process.env.AI3D_PROVIDER = 'fake';
// hạn mức cố định để kiểm tra được (không phụ thuộc .env của máy)
process.env.AI3D_MAX_JOBS_PER_HOUR = '3';
process.env.AI3D_MAX_JOBS_PER_DAY = '10';
