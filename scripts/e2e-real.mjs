// Chạy toàn bộ Playwright với API THẬT bằng một lệnh:  npm run test:e2e:real
//   1. dừng tiến trình test còn sót (API 4002, web 3100) rồi build API
//   2. khởi động API test (DB aurelia_test, cổng 4002)
//   3. với từng nhóm test (tuần tự, đúng thứ tự cần thiết): reset aurelia_test bằng scripts/db-reset.mjs → chạy Playwright
//   4. luôn dọn tiến trình API khi xong (kể cả khi lỗi / Ctrl+C)
// Chỉ đụng aurelia_test; không bao giờ đụng aurelia_dev/aurelia_demo.
// Tùy chọn: E2E_ONLY=admin-m3 (chạy một nhóm theo tên), E2E_API_PORT, E2E_WEB_PORT, SKIP_BUILD=1
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = resolve(root, 'apps/api');
const webDir = resolve(root, 'apps/web');
const API_PORT = process.env.E2E_API_PORT ?? '4002';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '3100';
const DB = 'aurelia_test';
const PG_PORT = process.env.POSTGRES_PORT ?? '55432';
const isWin = process.platform === 'win32';

/** Nhóm test: thứ tự quan trọng vì test làm thay đổi dữ liệu (giỏ hàng, đơn…) nên mỗi nhóm chạy trên DB vừa reset */
const GROUPS = [
  {
    name: 'khach-hang',
    files: ['tests/e2e/home.spec.ts', 'tests/e2e/screens.spec.ts'],
    grepInvert: 'admin: đăng nhập và duyệt mọi màn hình',
  },
  { name: 'xem-360', files: ['tests/e2e/product360.spec.ts'] },
  { name: 'admin-m2', files: ['tests/e2e/admin-m2.spec.ts'] },
  { name: 'admin-m3', files: ['tests/e2e/admin-m3.spec.ts'] },
];

const log = (m) => console.log(`\n[e2e-real] ${m}`);

function killPort(port) {
  if (isWin) {
    const out = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`,
      ],
      { encoding: 'utf8' },
    );
    return out.status === 0;
  }
  spawnSync('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill -9`]);
  return true;
}

function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (isWin) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
  else child.kill('SIGKILL');
}

async function waitHealth(url, ms = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* chưa sẵn sàng */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`API không sẵn sàng sau ${ms / 1000}s (${url})`);
}

let api = null;
function cleanup() {
  killTree(api);
  killPort(API_PORT);
  killPort(WEB_PORT);
}
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('exit', cleanup);

async function main() {
  log(`dừng tiến trình test còn sót (cổng ${API_PORT}, ${WEB_PORT})`);
  killPort(API_PORT);
  killPort(WEB_PORT);

  if (!process.env.SKIP_BUILD) {
    log('build API');
    const b = spawnSync('npm', ['run', 'build', '-w', '@aurelia-living/api', '--silent'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    if (b.status !== 0) throw new Error('Build API thất bại');
  }

  const dbUrl = `postgresql://aurelia:aurelia@localhost:${PG_PORT}/${DB}?schema=public`;
  const apiEnv = {
    ...process.env,
    DATABASE_URL: dbUrl,
    PORT: API_PORT,
    NODE_ENV: 'development',
    CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
    STORAGE_DRIVER: 'local',
    STORAGE_PUBLIC_URL: `http://localhost:${API_PORT}/uploads`,
    JWT_ACCESS_EXPIRES_IN: '12h',
    THROTTLE_DEFAULT_LIMIT: '100000',
    THROTTLE_AUTH_LIMIT: '100000',
    MAIL_TRANSPORT: 'direct',
    OTP_FIXED_CODE: '123456',
    PAYMENT_SANDBOX_FAKE: 'true',
  };

  // reset lần đầu để API khởi động trên DB sẵn sàng
  log(`reset ${DB}`);
  const first = spawnSync(process.execPath, ['scripts/db-reset.mjs', DB], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, API_PORT },
  });
  if (first.status !== 0) throw new Error(`Reset ${DB} thất bại`);

  log(`khởi động API test (cổng ${API_PORT}, DB ${DB})`);
  const dotenv = resolve(root, 'node_modules/dotenv-cli/cli.js');
  api = spawn(process.execPath, [dotenv, '-e', '../../.env', '--', process.execPath, 'dist/main.js'], {
    cwd: apiDir,
    env: apiEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let apiLog = '';
  api.stdout.on('data', (d) => (apiLog = (apiLog + d).slice(-4000)));
  api.stderr.on('data', (d) => (apiLog = (apiLog + d).slice(-4000)));
  api.on('exit', (c) => c && console.error(`[e2e-real] API thoát mã ${c}\n${apiLog}`));
  await waitHealth(`http://localhost:${API_PORT}/health`);

  const only = process.env.E2E_ONLY;
  const results = [];
  for (const g of GROUPS) {
    if (only && g.name !== only) continue;
    log(`nhóm "${g.name}": reset ${DB} + chạy Playwright`);
    const r = spawnSync(process.execPath, ['scripts/db-reset.mjs', DB], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, API_PORT },
    });
    if (r.status !== 0) throw new Error(`Reset ${DB} thất bại`);
    const args = [
      resolve(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      ...g.files,
      ...(g.grepInvert ? ['--grep-invert', g.grepInvert] : []),
    ];
    const p = spawnSync(process.execPath, args, {
      cwd: webDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_USE_MOCK: 'false',
        E2E_API_URL: `http://localhost:${API_PORT}`,
        E2E_DIST_DIR: '.next-e2e',
        E2E_PORT: WEB_PORT,
      },
    });
    results.push([g.name, p.status === 0]);
    killPort(WEB_PORT);
  }

  console.log('\n[e2e-real] Kết quả:');
  for (const [n, ok] of results) console.log(`  ${ok ? '✅' : '❌'} ${n}`);
  return results.every(([, ok]) => ok) ? 0 : 1;
}

main()
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch((e) => {
    console.error(`[e2e-real] LỖI: ${e.message}`);
    cleanup();
    process.exit(1);
  });
