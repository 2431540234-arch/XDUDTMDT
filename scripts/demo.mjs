// Chạy demo bằng MỘT lệnh:  npm run demo      (API cổng 4000 + web cổng 3000, API thật, DB aurelia_demo)
//                           npm run demo:api  (chỉ API)
//                           npm run demo:local (DỰ PHÒNG: lưu tệp trên đĩa, không cần MinIO)
// Tự đặt: DATABASE_URL=aurelia_demo, STORAGE_DRIVER=minio (mặc định, D-P13) hoặc local (--local), STORAGE_PUBLIC_URL,
// PAYMENT_SANDBOX_FAKE=true, NEXT_PUBLIC_USE_MOCK=false. Chế độ minio kiểm tra MinIO trước khi chạy và hướng dẫn nếu chưa bật.
// KHÔNG sửa file .env (các khóa JWT… vẫn lấy từ .env); biến đặt ở đây chỉ có hiệu lực với hai tiến trình này.
// An toàn: luôn dùng aurelia_demo, không bao giờ aurelia_dev. Cần `npm run docker:up` trước. Nạp lại dữ liệu: node scripts/db-reset.mjs aurelia_demo
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiOnly = process.argv.includes('--api-only');
const useLocal = process.argv.includes('--local');
const MINIO_PORT = process.env.MINIO_PORT ?? '9000';
const BUCKET_PUBLIC = process.env.S3_BUCKET_PUBLIC ?? 'aurelia-public';
const PG_PORT = process.env.POSTGRES_PORT ?? '55432';
const API_PORT = process.env.DEMO_API_PORT ?? '4000';
const WEB_PORT = process.env.DEMO_WEB_PORT ?? '3000';
const dotenv = resolve(root, 'node_modules/dotenv-cli/cli.js');
const isWin = process.platform === 'win32';

const apiEnv = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: `postgresql://aurelia:aurelia@localhost:${PG_PORT}/aurelia_demo?schema=public`,
  PORT: API_PORT,
  CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
  APP_URL: `http://localhost:${WEB_PORT}`,
  ...(useLocal
    ? { STORAGE_DRIVER: 'local', STORAGE_PUBLIC_URL: `http://localhost:${API_PORT}/uploads` }
    : {
        STORAGE_DRIVER: 'minio',
        STORAGE_PUBLIC_URL: `http://localhost:${MINIO_PORT}/${BUCKET_PUBLIC}`,
        S3_ENDPOINT: `http://localhost:${MINIO_PORT}`,
      }),
  PAYMENT_SANDBOX_FAKE: 'true',
  JWT_ACCESS_EXPIRES_IN: '15m', // access token 15 phút như production (không để dài hơn khi demo)
  THROTTLE_PREFIX: 'throttle-demo:',
  CACHE_KEY_PREFIX: 'aurelia:cache-demo:', // cache Redis riêng cho demo (D-P14)
  BULL_PREFIX: 'bull-demo', // hàng đợi riêng, không lẫn với API dev/e2e dùng chung Redis
};
const webEnv = {
  ...process.env,
  NEXT_PUBLIC_USE_MOCK: 'false',
  NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
  NEXT_IGNORE_INCORRECT_LOCKFILE: '1',
};

/** Chế độ minio: MinIO phải chạy; nếu không thì dừng sớm với hướng dẫn thay vì để API lỗi khi tải tệp lên */
async function ensureMinio() {
  if (useLocal) return;
  try {
    const r = await fetch(`http://localhost:${MINIO_PORT}/minio/health/live`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) return;
  } catch {
    /* rơi xuống thông báo */
  }
  console.error(
    `\n[demo] Không thấy MinIO ở cổng ${MINIO_PORT}.\n  • Bật:  npm run docker:up   (hoặc: docker compose up -d minio minio-init)\n  • Hoặc chạy DỰ PHÒNG không cần MinIO:  npm run demo:local\n`,
  );
  process.exit(1);
}
await ensureMinio();

const children = [];
const run = (name, args, cwd, env) => {
  const c = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
  c.on('exit', (code) => {
    console.log(`[demo] ${name} thoát (mã ${code ?? 'tín hiệu'})`);
    stop();
  });
  children.push(c);
};
function stop() {
  for (const c of children) {
    if (c.exitCode === null && !c.killed) {
      if (isWin) spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F']);
      else c.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(
  `[demo] API http://localhost:${API_PORT} (Swagger /docs), DB aurelia_demo, storage ${useLocal ? 'local (dự phòng)' : `minio (http://localhost:${MINIO_PORT}/${BUCKET_PUBLIC})`}, thanh toán giả lập BẬT`,
);
run(
  'API',
  [
    dotenv,
    '-e',
    '../../.env',
    '--',
    process.execPath,
    resolve(root, 'node_modules/@nestjs/cli/bin/nest.js'),
    'start',
    '--watch',
  ],
  resolve(root, 'apps/api'),
  apiEnv,
);
if (!apiOnly) {
  console.log(`[demo] Web http://localhost:${WEB_PORT} (admin: /admin/login)`);
  run(
    'Web',
    [resolve(root, 'apps/web/node_modules/next/dist/bin/next'), 'dev', '-p', WEB_PORT],
    resolve(root, 'apps/web'),
    webEnv,
  );
}
