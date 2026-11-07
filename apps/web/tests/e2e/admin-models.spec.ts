import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Xử lý nền mô hình 3D (UC-ADM-13) với API THẬT + Redis: tải lên → đang xử lý → sẵn sàng (hoặc lỗi + xử lý lại),
// đặt mô hình chính, khách xem 3D theo LOD. Chạy: npm run test:e2e:real (nhóm admin-3d).
// Cần Redis (hàng đợi BullMQ). Mỗi test tự chọn sản phẩm riêng chưa có mô hình 3D.

const FIXTURES = join(process.cwd(), '..', 'api', 'test', 'fixtures');
const SPHERE = join(FIXTURES, 'sphere.glb');
const BROKEN = join(FIXTURES, 'broken.glb');
const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

/**
 * Sản phẩm riêng cho từng test: lấy sản phẩm thứ `n` từ cuối danh sách và gỡ hết mô hình mẫu của nó
 * (DB aurelia_test được reset trước nhóm test này), nên mô hình trong test là dữ liệu do chính test tạo.
 */
async function freeProduct(request: APIRequestContext, n: number) {
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).data.tokens.accessToken}` };
  const list = (await (await request.get(`${API}/api/products?pageSize=100`)).json()).data as Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  const p = list[list.length - 1 - n];
  const rows = (
    await (await request.get(`${API}/api/admin/models?productId=${p.id}&pageSize=100`, { headers })).json()
  ).data as Array<{ modelId: number }>;
  for (const modelId of new Set(rows.map((r) => r.modelId)))
    expect((await request.delete(`${API}/api/admin/models/model/${modelId}`, { headers })).ok()).toBe(true);
  return p;
}

async function uploadVia(page: Page, productId: number, file: string, opts: { createNew?: boolean } = {}) {
  await page.goto(`/admin/models?productId=${productId}`);
  await expect(page.getByRole('heading', { name: 'Mô hình 3D' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Tải lên mô hình' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[type="file"]').setInputFiles(file);
  if (opts.createNew) await dlg.getByLabel(/Tạo mô hình mới/).check();
  await dlg.getByRole('button', { name: 'Tải lên', exact: true }).click();
  // 202: máy chủ nhận tệp, mô hình chuyển sang xử lý nền
  await expect(page.getByText(/đang được xử lý nền/)).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

let productA: { id: number; name: string; slug: string };

test('admin tải GLB: được nhận (xử lý nền) rồi tự cập nhật sang Sẵn sàng với đủ 3 LOD; khách xem 3D bằng LOD medium', async ({
  page,
  request,
}) => {
  productA = await freeProduct(request, 0);
  await adminLogin(page);
  await uploadVia(page, productA.id, SPHERE);

  // trang tự cập nhật (polling) tới khi xong: 3 dòng LOD, tất cả Sẵn sàng
  const statuses = page.getByTestId('model-status');
  await expect(statuses).toHaveCount(3, { timeout: 60_000 });
  for (let i = 0; i < 3; i++)
    await expect(statuses.nth(i)).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(page.getByText('LOD high')).toBeVisible();
  await expect(page.getByText('LOD medium')).toBeVisible();
  await expect(page.getByText('LOD low')).toBeVisible();
  await expect(page.getByText('Mô hình chính', { exact: true }).first()).toBeVisible();

  // khách (không đăng nhập) xem 3D: trình xem tải đúng tệp LOD medium
  const anon = await page
    .context()
    .browser()!
    .newContext({ baseURL: `http://localhost:${process.env.E2E_PORT ?? 3100}` });
  const cust = await anon.newPage();
  const req = cust.waitForRequest(/sphere-medium\.glb/, { timeout: 45_000 });
  await cust.goto(`/products/${productA.slug}/3d`);
  await req;
  await expect(cust.getByTestId('viewer-3d')).toHaveAttribute('data-lod', 'medium', { timeout: 30_000 });
  await anon.close();
});

test('khách dùng điện thoại: trình xem chọn LOD low; tải mô hình lỗi thì hiện ảnh thay thế và thông báo', async ({
  browser,
}) => {
  const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
  const phone = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 } });
  const p1 = await phone.newPage();
  const req = p1.waitForRequest(/sphere-low\.glb/, { timeout: 45_000 });
  await p1.goto(`/products/${productA.slug}/3d`);
  await req;
  await expect(p1.getByTestId('viewer-3d')).toHaveAttribute('data-lod', 'low', { timeout: 30_000 });
  await phone.close();

  // tệp mô hình không tải được ⇒ ảnh thay thế + thông báo (UC-3D-01)
  const desktop = await browser.newContext({ baseURL: base });
  const p2 = await desktop.newPage();
  await p2.route(/\.glb(\?|$)/, (r) => r.abort());
  await p2.goto(`/products/${productA.slug}/3d`);
  await expect(p2.getByTestId('viewer-3d-fallback')).toBeVisible({ timeout: 45_000 });
  await expect(p2.getByText(/Không tải được mô hình 3D/)).toBeVisible();
  await expect(p2.getByTestId('viewer-3d-fallback').locator('img')).toBeVisible();
  await desktop.close();
});

test('GLB hỏng: trạng thái Lỗi kèm lý do, nút Xử lý lại chạy được', async ({ page, request }) => {
  const p = await freeProduct(request, 1);
  await adminLogin(page);
  await uploadVia(page, p.id, BROKEN);

  const status = page.getByTestId('model-status').first();
  await expect(status).toHaveAttribute('data-status', 'failed', { timeout: 60_000 });
  await expect(status.getByRole('note')).toContainText('GLB');
  await expect(status.getByText('Lỗi')).toBeVisible();

  await status.getByRole('button', { name: 'Xử lý lại' }).click();
  await expect(page.getByText('Đã đưa mô hình vào hàng đợi xử lý lại.')).toBeVisible({ timeout: 30_000 });
  // tệp gốc vẫn hỏng nên xử lý lại cho kết quả Lỗi (job chạy thật, trạng thái quay lại failed)
  await expect(page.getByTestId('model-status').first()).toHaveAttribute('data-status', 'failed', {
    timeout: 60_000,
  });
});

test('đặt làm mô hình chính: mô hình mới ready ⇒ nút Đặt làm mô hình chính ⇒ huy hiệu chuyển sang mô hình đó', async ({
  page,
  request,
}) => {
  await adminLogin(page);
  await uploadVia(page, productA.id, SPHERE, { createNew: true });
  const statuses = page.getByTestId('model-status');
  await expect(statuses).toHaveCount(6, { timeout: 60_000 });
  for (let i = 0; i < 6; i++)
    await expect(statuses.nth(i)).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });

  const before = (await (await request.get(`${API}/api/products/${productA.slug}/model`)).json()).data
    .id as number;
  await page.getByRole('button', { name: 'Đặt làm mô hình chính' }).first().click();
  await expect(page.getByText('Đã đặt làm mô hình chính của sản phẩm.')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () =>
        (await (await request.get(`${API}/api/products/${productA.slug}/model`)).json()).data.id as number,
      {
        timeout: 30_000,
      },
    )
    .not.toBe(before);
  // mỗi mô hình có 3 dòng: đúng 3 dòng mang huy hiệu "Mô hình chính"
  await expect(page.getByText('Mô hình chính', { exact: true })).toHaveCount(3);
});
