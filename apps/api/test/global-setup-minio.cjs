// Giữ khóa aurelia_test (như supertest) và dò MinIO: không chạy ⇒ đặt MINIO_TESTS_SKIP=1 để spec tự bỏ qua (không fail).
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('dotenv');
const { acquire } = require('../../../scripts/test-lock.cjs');

module.exports = async () => {
  config({ path: path.resolve(__dirname, '../../../.env') });
  globalThis.__releaseTestLock = acquire('test:e2e:minio');
  const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  try {
    const r = await fetch(`${endpoint}/minio/health/live`, { signal: AbortSignal.timeout(3000) });
    process.env.MINIO_TESTS_SKIP = r.ok ? '0' : '1';
  } catch {
    process.env.MINIO_TESTS_SKIP = '1';
  }
  if (process.env.MINIO_TESTS_SKIP === '1') {
    console.warn(
      `\n[test:e2e:minio] Không thấy MinIO ở ${endpoint}: BỎ QUA bộ test (docker compose up -d minio minio-init).\n`,
    );
  }
  fs.rmSync(path.resolve(__dirname, '../.tmp-uploads-minio'), { recursive: true, force: true });
};
