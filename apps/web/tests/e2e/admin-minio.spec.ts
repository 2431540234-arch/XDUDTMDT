import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Tải lên TRỰC TIẾP từ trình duyệt lên MinIO thật (presigned PUT): kiểm CORS, bucket private/public, xử lý nền tới ready.
// Chỉ chạy với: node scripts/e2e-real.mjs --minio  (npm run test:e2e:real:minio). Cần MinIO + Redis đang chạy.

const FIXTURES = join(process.cwd(), '..', 'api', 'test', 'fixtures');
const SPHERE = join(FIXTURES, 'sphere.glb');
const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const S3 = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const WEB_BASE = `http://localhost:${process.env.E2E_PORT ?? 3100}`;

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

async function adminHeaders(request: APIRequestContext) {
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  return { Authorization: `Bearer ${(await login.json()).data.tokens.accessToken}` };
}

/** Sản phẩm cuối danh sách, gỡ hết mô hình mẫu để mô hình trong test là dữ liệu do chính test tạo */
async function freeProduct(request: APIRequestContext, headers: Record<string, string>) {
  const list = (await (await request.get(`${API}/api/products?pageSize=100`)).json()).data as Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  const p = list[list.length - 1];
  const rows = (
    await (await request.get(`${API}/api/admin/models?productId=${p.id}&pageSize=100`, { headers })).json()
  ).data as Array<{ modelId: number }>;
  for (const modelId of new Set(rows.map((r) => r.modelId)))
    expect((await request.delete(`${API}/api/admin/models/model/${modelId}`, { headers })).ok()).toBe(true);
  return p;
}

test('API báo mode presigned (driver minio); admin tải GLB từ trình duyệt: PUT thẳng lên bucket PRIVATE → xử lý nền → sẵn sàng; khách tải LOD từ bucket PUBLIC', async ({
  page,
  request,
  browser,
}) => {
  const headers = await adminHeaders(request);
  const cfg = (await (await request.get(`${API}/api/admin/media/upload-config`, { headers })).json()).data;
  expect(cfg).toMatchObject({ mode: 'presigned', driver: 'minio' });
  const product = await freeProduct(request, headers);

  await adminLogin(page);
  await page.goto(`/admin/models?productId=${product.id}`);
  await expect(page.getByRole('heading', { name: 'Mô hình 3D' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Tải lên mô hình' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[type="file"]').setInputFiles(SPHERE);

  const presign = page.waitForResponse((r) => r.url().endsWith('/api/admin/models/presign'));
  const put = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().includes('/aurelia-test-private/'),
  );
  const confirm = page.waitForResponse((r) => /\/api\/admin\/models\/\d+\/files\/confirm$/.test(r.url()));
  await dlg.getByRole('button', { name: 'Tải lên', exact: true }).click();
  expect((await presign).status()).toBe(200);
  const putRes = await put; // trình duyệt PUT thẳng lên MinIO (nếu CORS sai thì không có phản hồi này)
  expect(putRes.status()).toBe(200);
  expect(putRes.headers()['access-control-allow-origin']).toBe(WEB_BASE);
  expect((await confirm).status()).toBe(202);
  await expect(page.getByText(/đang được xử lý nền/)).toBeVisible({ timeout: 30_000 });

  const statuses = page.getByTestId('model-status');
  await expect(statuses).toHaveCount(3, { timeout: 60_000 });
  for (let i = 0; i < 3; i++)
    await expect(statuses.nth(i)).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });

  // khách xem 3D: GLB (LOD medium) tải từ bucket public của MinIO (khác nguồn gốc với web ⇒ cần CORS cho GET)
  const anon = await browser.newContext({ baseURL: WEB_BASE });
  const cust = await anon.newPage();
  const glb = cust.waitForResponse(
    (r) => /sphere-minio-medium|sphere-medium/.test(r.url()) && r.url().startsWith(S3),
    {
      timeout: 45_000,
    },
  );
  await cust.goto(`/products/${product.slug}/3d`);
  expect((await glb).status()).toBe(200);
  await expect(cust.getByTestId('viewer-3d')).toHaveAttribute('data-lod', 'medium', { timeout: 30_000 });
  await anon.close();
});

test('panorama: trình duyệt PUT thẳng lên bucket PUBLIC qua URL ký (CORS), confirm tạo media và ảnh mở được', async ({
  page,
  request,
}) => {
  const headers = await adminHeaders(request);
  await adminLogin(page); // đứng ở nguồn gốc của web để PUT cùng điều kiện CORS như trang thật
  const bytes = Array.from(
    Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      'base64',
    ),
  );
  const pre = await request.post(`${API}/api/admin/media/presign`, {
    headers,
    data: { kind: 'panorama', fileName: 'pano-web.jpg', mimeType: 'image/jpeg', size: bytes.length },
  });
  expect(pre.status()).toBe(200);
  const { key, uploadUrl, headers: putHeaders } = (await pre.json()).data;
  const result = await page.evaluate(
    async ({ url, h, b }) => {
      const r = await fetch(url, { method: 'PUT', headers: h, body: new Uint8Array(b) });
      return { status: r.status };
    },
    { url: uploadUrl, h: putHeaders, b: bytes },
  );
  expect(result.status).toBe(200);
  const conf = await request.post(`${API}/api/admin/media/confirm`, {
    headers,
    data: { key, kind: 'panorama', fileName: 'pano-web.jpg', mimeType: 'image/jpeg' },
  });
  expect(conf.status()).toBe(201);
  const media = (await conf.json()).data;
  expect(media.url).toContain('/aurelia-test-public/panoramas/');
  const shown = await page.evaluate(async (u) => (await fetch(u)).status, media.url);
  expect(shown).toBe(200);
});
