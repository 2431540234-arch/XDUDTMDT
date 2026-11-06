import { expect, test, type ConsoleMessage, type Page, type Response } from '@playwright/test';

// Màn hình admin của Mốc 3: Đánh giá, Hỏi đáp, Đổi trả, Mô hình 3D, Không gian mẫu, Nội dung.
// Chạy với API thật: npm run test:e2e:real (hoặc E2E_USE_MOCK=false E2E_API_URL=http://localhost:4002).

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

test('admin Mốc 3: các màn hình tương tác khách hàng & nội dung mở được, không lỗi console/HTTP/ảnh vỡ', async ({
  page,
}) => {
  test.setTimeout(400_000);
  await adminLogin(page);
  const pages: Array<[string, string | RegExp]> = [
    ['/admin/reviews', 'Duyệt và quản lý đánh giá'],
    ['/admin/questions', 'Trả lời câu hỏi của khách hàng'],
    ['/admin/returns', 'Duyệt và xử lý yêu cầu đổi trả'],
    ['/admin/models', 'Quản lý các mô hình 3D'],
    ['/admin/spaces', 'Quản lý các không gian'],
    ['/admin/spaces/new', 'Thêm không gian mẫu'],
    ['/admin/spaces/1', /Sửa:/],
    ['/admin/content', 'Banner & slider'],
  ];
  for (const [path, text] of pages) await visit(page, path, text);
});

test('admin: xử lý yêu cầu đổi trả đầu tiên (Chờ duyệt → Đang lấy hàng)', async ({ page }) => {
  test.setTimeout(120_000);
  await adminLogin(page);
  await page.goto('/admin/returns');
  await expect(page.getByText('Duyệt và xử lý yêu cầu đổi trả')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: /Chờ duyệt/ }).click();
  await page.getByRole('row').nth(1).click();
  await page.getByRole('button', { name: /Duyệt & tạo lệnh lấy hàng/ }).click();
  await expect(page.getByText(/Đã cập nhật yêu cầu RT/)).toBeVisible({ timeout: 30_000 });
});

test('admin: tab Nội dung hiển thị banner, bài viết, trang tĩnh từ API', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/content');
  await expect(page.getByText('Banner & slider')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('img').first()).toBeVisible();
});
