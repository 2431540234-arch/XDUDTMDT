// Chạy MỘT câu SQL qua Prisma (không cần docker/psql) và in kết quả giống `psql -At`: mỗi dòng các cột nối bằng "|".
// Dùng cho scripts/db-reset.mjs khi chạy trong CI, nơi Postgres là service container (không có tên cố định để `docker exec`).
//   node scripts/sql-exec.cjs <database> "<sql>"      (kết nối theo PG_HOST, POSTGRES_PORT, tài khoản aurelia/aurelia)
const { createRequire } = require('node:module');
const path = require('node:path');

const [db, sql] = process.argv.slice(2);
const req = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
const { PrismaClient } = req('@prisma/client');
const host = process.env.PG_HOST ?? 'localhost';
const port = process.env.POSTGRES_PORT ?? '55432';
const prisma = new PrismaClient({
  datasources: { db: { url: `postgresql://aurelia:aurelia@${host}:${port}/${db}?schema=public` } },
});

(async () => {
  if (/^\s*select/i.test(sql)) {
    const rows = await prisma.$queryRawUnsafe(sql);
    console.log(rows.map((r) => Object.values(r).map(String).join('|')).join('\n'));
  } else {
    await prisma.$executeRawUnsafe(sql);
  }
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
