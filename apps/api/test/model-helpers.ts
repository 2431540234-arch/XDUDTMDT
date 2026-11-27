// Dữ liệu seed không có mô hình 3D: test nào cần mô hình đã duyệt thì tự tạo bằng đúng luồng thật
// (tải GLB lên → chuẩn hóa nền → chờ duyệt → duyệt). CẦN REDIS.
import type { PrismaClient } from '@prisma/client';
import type request from 'supertest';
import { buildFakeGlb, type FakeGlbOptions } from '../src/modules/ai3d/fake-glb';

type Http = ReturnType<typeof request>;

export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 60_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Hết thời gian chờ điều kiện (job mô hình 3D)');
    await new Promise((r) => setTimeout(r, 200));
  }
}

export const waitModelStatus = (prisma: PrismaClient, id: number, status: string, ms = 60_000) =>
  waitFor(async () => (await prisma.product3DModel.findUnique({ where: { id } }))?.status === status, ms);

/** Tải GLB lên và chờ tới `pending_review`; trả về id mô hình */
export async function uploadPending(
  http: Http,
  prisma: PrismaClient,
  adminToken: string,
  productId: number,
  glb?: Buffer,
  fields: Record<string, string> = {},
): Promise<number> {
  const body = glb ?? (await buildFakeGlb());
  const r = http
    .post('/api/admin/models/upload')
    .set('Authorization', `Bearer ${adminToken}`)
    .field('productId', String(productId));
  for (const [k, v] of Object.entries(fields)) r.field(k, v);
  const res = await r.attach('file', body, { filename: 'ban.glb', contentType: 'model/gltf-binary' });
  if (res.status !== 202) throw new Error(`Tải mô hình lỗi ${res.status}: ${JSON.stringify(res.body)}`);
  const id = res.body.data.modelId as number;
  await waitModelStatus(prisma, id, 'pending_review');
  return id;
}

/** Tải lên rồi duyệt: sản phẩm có mô hình chính `ready` */
export async function createApprovedModel(
  http: Http,
  prisma: PrismaClient,
  adminToken: string,
  productId: number,
  options: FakeGlbOptions = {},
): Promise<number> {
  const id = await uploadPending(http, prisma, adminToken, productId, await buildFakeGlb(options));
  const res = await http
    .post(`/api/admin/models/${id}/approve`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  if (res.status !== 200) throw new Error(`Duyệt mô hình lỗi ${res.status}: ${JSON.stringify(res.body)}`);
  return id;
}
