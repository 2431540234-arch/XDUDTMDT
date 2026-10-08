// Biến môi trường cho test. KHÔNG dùng DB dev: mặc định trỏ tới postgres-test (cổng 5433).
// Ghi đè bằng TEST_DATABASE_URL (ví dụ ở CI).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://aurelia:aurelia@localhost:5433/aurelia_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';
process.env.SWAGGER_ENABLED = 'false';
process.env.STORAGE_LOCAL_DIR = './.tmp-uploads';
