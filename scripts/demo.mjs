// Chạy demo bằng MỘT lệnh:  npm run demo      (API cổng 4000 + web cổng 3000, API thật, DB aurelia_demo)
//                           npm run demo:api  (chỉ API)
// Tự đặt: DATABASE_URL=aurelia_demo, STORAGE_DRIVER=local, STORAGE_PUBLIC_URL, PAYMENT_SANDBOX_FAKE=true, NEXT_PUBLIC_USE_MOCK=false.
// KHÔNG sửa file .env (các khóa JWT… vẫn lấy từ .env); biến đặt ở đây chỉ có hiệu lực với hai tiến trình này.
// An toàn: luôn dùng aurelia_demo, không bao giờ aurelia_dev. Cần `npm run docker:up` trước. Nạp lại dữ liệu: node scripts/db-reset.mjs aurelia_demo
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiOnly = process.argv.includes('--api-only');
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
  STORAGE_DRIVER: 'local',
  STORAGE_PUBLIC_URL: `http://localhost:${API_PORT}/uploads`,
  PAYMENT_SANDBOX_FAKE: 'true',
  THROTTLE_PREFIX: 'throttle-demo:',
  BULL_PREFIX: 'bull-demo', // hàng đợi riêng, không lẫn với API dev/e2e dùng chung Redis
};
const webEnv = {
  ...process.env,
  NEXT_PUBLIC_USE_MOCK: 'false',
  NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
  NEXT_IGNORE_INCORRECT_LOCKFILE: '1',
};

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
  `[demo] API http://localhost:${API_PORT} (Swagger /docs), DB aurelia_demo, storage local, thanh toán giả lập BẬT`,
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
