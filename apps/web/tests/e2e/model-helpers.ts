// Dữ liệu seed không có mô hình 3D: test API thật nào cần mô hình đã duyệt thì tự tạo bằng đúng luồng thật.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';

export const FIXTURES = join(process.cwd(), '..', 'api', 'test', 'fixtures');
export const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

export async function adminHeaders(request: APIRequestContext) {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  return { Authorization: `Bearer ${(await r.json()).data.tokens.accessToken}` };
}

/** Sản phẩm chưa có mô hình 3D thì tải sphere.glb (vật liệu tên "mat") lên, chờ chuẩn hóa rồi duyệt */
export async function ensureModel(request: APIRequestContext, productId: number) {
  const headers = await adminHeaders(request);
  const rows = (
    await (
      await request.get(`${API}/api/admin/models?productId=${productId}&pageSize=100`, { headers })
    ).json()
  ).data as Array<{ modelId: number; status: string }>;
  if (rows.some((r) => r.status === 'ready')) return;
  const upload = await request.post(`${API}/api/admin/models/upload`, {
    headers,
    multipart: {
      productId: String(productId),
      file: {
        name: 'sphere.glb',
        mimeType: 'model/gltf-binary',
        buffer: readFileSync(join(FIXTURES, 'sphere.glb')),
      },
    },
  });
  expect(upload.status()).toBe(202);
  const modelId = (await upload.json()).data.modelId as number;
  await expect
    .poll(
      async () =>
        (await (await request.get(`${API}/api/admin/models/${modelId}`, { headers })).json()).data.status,
      { timeout: 60_000 },
    )
    .toBe('pending_review');
  const approved = await request.post(`${API}/api/admin/models/${modelId}/approve`, { headers, data: {} });
  expect(approved.status()).toBe(200);
}
