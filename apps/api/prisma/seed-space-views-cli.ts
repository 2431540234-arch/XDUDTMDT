// Thêm lượt xem không gian 30 ngày gần nhất vào DB demo/test ĐÃ CÓ dữ liệu (không reset, không xóa gì). Idempotent: đã có ≥ 100 lượt
// trong 30 ngày thì bỏ qua.   DATABASE_URL=postgresql://.../aurelia_demo npm run db:seed-space-views -w @aurelia-living/api
import { PrismaClient } from '@prisma/client';
import { recentSpaceViews } from './seed-space-views';

const db = /\/([^/?]+)(\?|$)/.exec(process.env.DATABASE_URL ?? '')?.[1];
if (!db || !['aurelia_demo', 'aurelia_test'].includes(db)) {
  console.error(`✖ Từ chối: chỉ chạy trên aurelia_demo hoặc aurelia_test (đang trỏ tới ${db ?? '(trống)'}).`);
  process.exit(1);
}
const prisma = new PrismaClient();
(async () => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const have = await prisma.spaceView.count({ where: { createdAt: { gte: since } } });
  if (have >= 100) return console.log(`Đã có ${have} lượt xem trong 30 ngày, bỏ qua.`);
  const spaces = await prisma.space.findMany({
    where: { status: 'published' },
    orderBy: { id: 'asc' },
    take: 12,
    select: { id: true },
  });
  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: 'published' },
    orderBy: { id: 'asc' },
    take: 16,
    select: { id: true },
  });
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
    take: 10,
    select: { id: true },
  });
  const rows = recentSpaceViews(
    spaces.map((s) => s.id),
    products.map((p) => p.id),
    users.map((u) => u.id),
  );
  await prisma.spaceView.createMany({ data: rows });
  console.log(`Đã thêm ${rows.length} lượt xem không gian (30 ngày gần nhất) vào ${db}.`);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
