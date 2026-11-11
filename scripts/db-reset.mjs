// Tạo lại (DROP + CREATE) một DB DEMO/TEST rồi áp migration và seed từ mock-data.
//   node scripts/db-reset.mjs aurelia_demo     (DB phát triển/demo)
//   node scripts/db-reset.mjs aurelia_test     (DB riêng cho e2e/Playwright)
// AN TOÀN: CHỈ chấp nhận đúng hai tên trên. Tuyệt đối không chạy được trên aurelia_dev hay DB khác.
// Trước khi ghi: in tên DB đang kết nối và đếm dòng bằng SELECT count(*) (không dựa vào pg_stat).
import { execFileSync, execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ALLOWED = ['aurelia_demo', 'aurelia_test'];
const name = process.argv[2];
if (!ALLOWED.includes(name)) {
  console.error(`✖ Từ chối: chỉ được reset ${ALLOWED.join(' hoặc ')} (nhận được: ${name ?? '(trống)'}).`);
  process.exit(1);
}

const container = process.env.PG_CONTAINER ?? 'xdudtmdt-postgres-1';
const hostPort = process.env.POSTGRES_PORT ?? '55432';
const apiDir = resolve(import.meta.dirname, '../apps/api');
const pgHost = process.env.PG_HOST ?? 'localhost'; // đặt PG_HOST=127.0.0.1 nếu 'localhost' phân giải sang IPv6 không tới được container
const url = `postgresql://aurelia:aurelia@${pgHost}:${hostPort}/${name}?schema=public`;
const port = process.env.API_PORT ?? '4000';

const psql = (db, sql) =>
  execFileSync('docker', ['exec', container, 'psql', '-U', 'aurelia', '-d', db, '-At', '-c', sql], {
    encoding: 'utf8',
  }).trim();

function count(db) {
  const rows = psql(
    db,
    "select 'DB=' || current_database(), (select count(*) from users), (select count(*) from products), (select count(*) from orders)",
  );
  return rows;
}

const exists = psql('postgres', `select 1 from pg_database where datname='${name}'`) === '1';
if (exists) console.log(`Trước khi reset – ${count(name)}  (users|products|orders)`);
console.log(`→ DROP/CREATE ${name}`);
psql('postgres', `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
psql('postgres', `CREATE DATABASE ${name}`);

const env = {
  ...process.env,
  DATABASE_URL: url,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? 'local',
  STORAGE_PUBLIC_URL: process.env.STORAGE_PUBLIC_URL ?? `http://localhost:${port}/uploads`,
};
const run = (cmd) => execSync(cmd, { cwd: apiDir, stdio: 'inherit', env });
run('npm run db:deploy --silent');
run('npm run db:seed --silent');
console.log(`Sau khi seed – ${count(name)}  (users|products|orders)`);
// Dữ liệu vừa đổi ngoài API ⇒ xóa cache Redis (chỉ là bộ nhớ đệm, API tự dựng lại). Không phải lỗi nếu Redis không chạy.
try {
  const redis = process.env.REDIS_CONTAINER ?? 'xdudtmdt-redis-1';
  execFileSync(
    'docker',
    ['exec', redis, 'sh', '-c', "redis-cli --scan --pattern '*cache*' | xargs -r redis-cli del >/dev/null"],
    { stdio: 'ignore' },
  );
  console.log('Đã xóa cache Redis (khóa *cache*)');
} catch {
  console.log('(bỏ qua xóa cache Redis: không truy cập được container Redis)');
}
