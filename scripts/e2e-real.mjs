// Chạy toàn bộ Playwright với API THẬT bằng một lệnh:  npm run test:e2e:real
//   1. dừng tiến trình test còn sót (API 4002, web 3100) rồi build API
//   2. khởi động API test (DB aurelia_test, cổng 4002)
//   3. với từng nhóm test (tuần tự, đúng thứ tự cần thiết): reset aurelia_test bằng scripts/db-reset.mjs → chạy Playwright
//   4. luôn dọn tiến trình API khi xong (kể cả khi lỗi / Ctrl+C)
// Chỉ đụng aurelia_test; không bao giờ đụng aurelia_dev/aurelia_demo.
// Tùy chọn: E2E_ONLY=admin-m3 (chạy một nhóm theo tên), E2E_API_PORT, E2E_WEB_PORT, SKIP_BUILD=1
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = resolve(root, 'apps/api');
const webDir = resolve(root, 'apps/web');
const API_PORT = process.env.E2E_API_PORT ?? '4002';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '3100';
const DB = 'aurelia_test';
const PG_PORT = process.env.POSTGRES_PORT ?? '55432';
const isWin = process.platform === 'win32';

// --minio: chạy API với MinIO THẬT (bucket riêng aurelia-test-*) và CHỈ nhóm admin-minio (tải lên trực tiếp từ trình duyệt,
// kiểm CORS và presigned PUT). Mặc định (không cờ) dùng driver local để không phụ thuộc container.
const MINIO = process.argv.includes('--minio') || process.env.E2E_STORAGE === 'minio';
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const TEST_PUBLIC = 'aurelia-test-public';
const TEST_PRIVATE = 'aurelia-test-private';

/** Nhóm test: thứ tự quan trọng vì test làm thay đổi dữ liệu (giỏ hàng, đơn…) nên mỗi nhóm chạy trên DB vừa reset */
const GROUPS = MINIO
  ? [{ name: 'admin-minio', files: ['tests/e2e/admin-minio.spec.ts'] }]
  : [
      {
        name: 'khach-hang',
        files: ['tests/e2e/home.spec.ts', 'tests/e2e/screens.spec.ts'],
      },
      {
        name: 'xem-360',
        files: ['tests/e2e/product360.spec.ts', 'tests/e2e/spaces360.spec.ts', 'tests/e2e/admin360.spec.ts'],
      },
      { name: 'admin-m2', files: ['tests/e2e/admin-m2.spec.ts'] },
      { name: 'admin-m3', files: ['tests/e2e/admin-m3.spec.ts'] },
      { name: 'admin-m4', files: ['tests/e2e/admin-m4.spec.ts'] },
      { name: 'admin-m5', files: ['tests/e2e/admin-m5.spec.ts'] },
      // xử lý nền mô hình 3D (cần Redis)
      { name: 'admin-3d', files: ['tests/e2e/admin-models.spec.ts'] },
      // ghi rồi tải lại danh sách khi lần tải tìm kiếm còn đang bay (React Query), xem apps/web/src/lib/query-refresh.ts
      { name: 'admin-race', files: ['tests/e2e/admin-race.spec.ts'] },
      // đổi chất liệu trên mô hình 3D (UC-ADM-14, UC-3D-03)
      { name: 'vat-lieu', files: ['tests/e2e/materials.spec.ts'] },
      // đặt mô hình 3D vào ảnh 360° và Đổi món (UC-ADM-17, UC-SPACE-04/05)
      { name: 'phong-3d', files: ['tests/e2e/placements360.spec.ts', 'tests/e2e/space-source.spec.ts'] },
      // use case Mở rộng nhẹ: nhật ký, vai trò, phiên đăng nhập, xóa tài khoản, gửi thông báo
      { name: 'ext-uc', files: ['tests/e2e/ext-uc.spec.ts'] },
    ];

const log = (m) => console.log(`\n[e2e-real] ${m}`);

// Bằng chứng khi test fail: log response >= 400 của API và trace/screenshot Playwright được giữ trong .e2e-logs/
const logDir = resolve(root, '.e2e-logs');
mkdirSync(logDir, { recursive: true });
const apiErrorLog = resolve(logDir, 'api-errors.log');
writeFileSync(apiErrorLog, '');

/** Giữ trace/screenshot của nhóm fail (Playwright xóa test-results ở lần chạy sau) và in đường dẫn */
function keepEvidence(group) {
  const src = resolve(webDir, 'test-results');
  const dst = resolve(logDir, `${group}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  if (existsSync(src)) cpSync(src, dst, { recursive: true });
  if (existsSync(apiErrorLog)) cpSync(apiErrorLog, resolve(dst, 'api-errors.log'));
  const traces = [];
  const walk = (d) => {
    for (const e of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
      const f = resolve(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name === 'trace.zip') traces.push(f);
    }
  };
  walk(dst);
  console.log(`\n[e2e-real] ❌ nhóm ${group} fail. Bằng chứng: ${dst}`);
  for (const t of traces) console.log(`[e2e-real]   trace: npx playwright show-trace ${t}`);
  console.log(`[e2e-real]   log response >= 400 của API: ${apiErrorLog}`);
}

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

/** Tạo bucket test (public cho đọc ẩn danh, private) nếu chưa có; báo rõ nếu MinIO không chạy */
async function ensureTestBuckets() {
  const req = createRequire(resolve(apiDir, 'package.json'));
  const { S3Client, CreateBucketCommand, PutBucketPolicyCommand } = req('@aws-sdk/client-s3');
  try {
    const h = await fetch(`${S3_ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(3000) });
    if (!h.ok) throw new Error(String(h.status));
  } catch {
    throw new Error(`Không thấy MinIO ở ${S3_ENDPOINT}. Bật: docker compose up -d minio minio-init`);
  }
  const s3 = new S3Client({
    endpoint: S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'aurelia',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'aurelia123',
    },
  });
  for (const b of [TEST_PUBLIC, TEST_PRIVATE])
    await s3.send(new CreateBucketCommand({ Bucket: b })).catch(() => undefined);
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: TEST_PUBLIC,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${TEST_PUBLIC}/*`],
          },
        ],
      }),
    }),
  );
}

async function main() {
  // không cho chạy chồng với bộ test khác trên aurelia_test (supertest hoặc một lần e2e:real khác)
  createRequire(import.meta.url)('./test-lock.cjs').acquire('Playwright (npm run test:e2e:real)');
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

  const dbUrl = `postgresql://aurelia:aurelia@${process.env.PG_HOST ?? 'localhost'}:${PG_PORT}/${DB}?schema=public`;
  const apiEnv = {
    ...process.env,
    DATABASE_URL: dbUrl,
    PORT: API_PORT,
    NODE_ENV: 'development',
    CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
    ...(MINIO
      ? {
          STORAGE_DRIVER: 'minio',
          S3_ENDPOINT,
          S3_BUCKET_PUBLIC: TEST_PUBLIC,
          S3_BUCKET_PRIVATE: TEST_PRIVATE,
          STORAGE_PUBLIC_URL: `${S3_ENDPOINT}/${TEST_PUBLIC}`,
        }
      : { STORAGE_DRIVER: 'local', STORAGE_PUBLIC_URL: `http://localhost:${API_PORT}/uploads` }),
    JWT_ACCESS_EXPIRES_IN: '12h',
    THROTTLE_DEFAULT_LIMIT: '100000',
    THROTTLE_AUTH_LIMIT: '100000',
    MAIL_TRANSPORT: 'direct',
    PAYMENT_SANDBOX_FAKE: 'true',
    // hàng đợi riêng: nếu có API demo/dev đang chạy, worker của nó không được nhận job của e2e (xử lý nhầm DB)
    BULL_PREFIX: 'bull-e2e',
    CACHE_KEY_PREFIX: 'aurelia:cache-e2e:', // cache Redis BẬT, tiền tố riêng cho e2e (D-P14)
    THROTTLE_PREFIX: 'throttle-e2e:', // bộ đếm giới hạn tốc độ riêng, không dùng chung với API demo/dev
    HTTP_ERROR_LOG_FILE: apiErrorLog, // mọi response >= 400 của API e2e (xem .e2e-logs/)
  };

  // reset lần đầu để API khởi động trên DB sẵn sàng
  log(`reset ${DB}`);
  const first = spawnSync(process.execPath, ['scripts/db-reset.mjs', DB], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, API_PORT },
  });
  if (first.status !== 0) throw new Error(`Reset ${DB} thất bại`);

  if (MINIO) await ensureTestBuckets();
  log(`khởi động API test (cổng ${API_PORT}, DB ${DB}, storage ${MINIO ? 'MINIO thật' : 'local'})`);
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
    if (p.status !== 0) keepEvidence(g.name);
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
