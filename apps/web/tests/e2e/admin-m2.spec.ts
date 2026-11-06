import { expect, test, type ConsoleMessage, type Page, type Response } from '@playwright/test';

// Màn hình admin của Mốc 2 (Tổng quan, Sản phẩm + tab Ảnh 360°, Danh mục, Đơn hàng, Khách hàng, Khuyến mãi).
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

test('admin: sản phẩm có tab Ảnh 360° hiển thị frame đã lưu', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/products/1');
  await expect(page.getByText(/Sửa:/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: /360/ }).click();
  await expect(page.getByText(/frame · kéo thả để đổi thứ tự/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Xem trước xoay')).toBeVisible();
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
