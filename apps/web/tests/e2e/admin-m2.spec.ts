import { expect, type ConsoleMessage, type Page, type Response } from '@playwright/test';
import { test } from './helpers/test';

// Màn hình admin của Mốc 2 (Tổng quan, Sản phẩm, Danh mục, Đơn hàng, Khách hàng, Khuyến mãi).
// Chạy được với mock (mặc định) và với API thật: E2E_USE_MOCK=false E2E_API_URL=http://localhost:4000

async function visit(page: Page, path: string, expectText: string | RegExp) {
  const errors: string[] = [];
  const onConsole = (m: ConsoleMessage) => m.type() === 'error' && errors.push(`console: ${m.text()}`);
  const onPage = (e: Error) => errors.push(`pageerror: ${e.message}`);
  const onResp = (r: Response) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`);
  page.on('console', onConsole);
  page.on('pageerror', onPage);
  page.on('response', onResp);
  await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(async () => {
    await page.waitForTimeout(1500);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  });
  errors.length = 0;
  await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src)
      .map((i) => i.src),
  );
  page.off('console', onConsole);
  page.off('pageerror', onPage);
  page.off('response', onResp);
  expect([...errors, ...broken.map((b) => `ảnh vỡ: ${b}`)], path).toEqual([]);
}

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

test('admin Mốc 2: khách bị từ chối, admin vào được các màn hình vận hành', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Tài khoản không có quyền quản trị.')).toBeVisible();

  await adminLogin(page);
  const pages: Array<[string, string | RegExp]> = [
    ['/admin', 'Tổng quan'],
    ['/admin/products', 'Quản lý danh sách sản phẩm'],
    ['/admin/products/new', 'Thêm sản phẩm'],
    ['/admin/products/1', /Sửa:/],
    ['/admin/categories', 'Quản lý danh mục'],
    ['/admin/orders', 'Theo dõi và xử lý đơn hàng'],
    ['/admin/customers', 'Quản lý tài khoản khách hàng'],
    ['/admin/customers/2', 'Trần Thu Hà'],
    ['/admin/promotions', 'Tạo và quản lý mã giảm giá'],
    ['/admin/promotions/new', 'Tạo khuyến mãi'],
  ];
  for (const [path, text] of pages) await visit(page, path, text);
});

test('admin: danh sách sản phẩm tìm kiếm và đơn hàng chuyển trạng thái', async ({ page }) => {
  test.setTimeout(120_000);
  await adminLogin(page);
  await page.goto('/admin/products');
  await expect(page.getByText('Quản lý danh sách sản phẩm')).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder(/Tìm/).first().fill('sofa');
  await expect(page.getByText('Sofa Nordic').first()).toBeVisible({ timeout: 30_000 });

  await page.goto('/admin/orders');
  await page.getByRole('tab', { name: /Chờ xác nhận/ }).click();
  await page.getByRole('link', { name: /#ALV-/ }).first().click();
  await expect(page.getByRole('heading', { name: /Đơn hàng #ALV-/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Xác nhận đơn hàng' }).click();
  await expect(page.getByText('Đã cập nhật trạng thái đơn hàng.')).toBeVisible();
});

test('admin: lưu sản phẩm không sửa ảnh ⇒ ảnh gắn màu còn nguyên', async ({ page, request }) => {
  test.skip(process.env.E2E_USE_MOCK !== 'false', 'cần API thật');
  test.setTimeout(150_000);
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const login = await request.post(`${api}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  const headers = { Authorization: `Bearer ${(await login.json()).data.tokens.accessToken}` };
  type Img = { id: number; mediaId: number; variantId: number | null; isPrimary: boolean; sortOrder: number };
  const detail = async (id: number) =>
    (await (await request.get(`${api}/api/admin/products/${id}`, { headers })).json()).data as {
      id: number;
      images: Img[];
    };
  const list = (await (await request.get(`${api}/api/admin/products?pageSize=100`, { headers })).json())
    .data as Array<{ id: number }>;
  let target: Awaited<ReturnType<typeof detail>> | undefined;
  for (const row of list) {
    const p = await detail(row.id);
    if (p.images.length > 1 && p.images.some((i) => i.variantId !== null)) {
      target = p;
      break;
    }
  }
  expect(target, 'seed phải có sản phẩm có ảnh gắn màu').toBeDefined();
  const key = (p: { images: Img[] }) =>
    p.images.map((i) => [i.id, i.mediaId, i.variantId, i.isPrimary, i.sortOrder]);

  await adminLogin(page);
  await page.goto(`/admin/products/${target!.id}`);
  await expect(page.getByText(/Sửa:/).first()).toBeVisible({ timeout: 45_000 });
  await page.getByRole('tab', { name: 'Hình ảnh' }).click();
  await expect(page.getByRole('group', { name: /^Màu / }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xóa ảnh' })).toHaveCount(target!.images.length);
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().includes(`/admin/products/${target!.id}`),
  );
  await page.getByRole('button', { name: 'Lưu sản phẩm' }).click();
  expect((await saved).status()).toBe(200);
  expect(key(await detail(target!.id))).toEqual(key(target!));
});
