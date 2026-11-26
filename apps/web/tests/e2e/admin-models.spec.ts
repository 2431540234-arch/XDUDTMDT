import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { API, FIXTURES, adminHeaders } from './model-helpers';

// Mô hình 3D với API THẬT + Redis (UC-ADM-13/31/32): nút 3D chỉ hiện khi có mô hình ĐÃ DUYỆT; tải GLB → chờ duyệt →
// xem thử → duyệt; tạo bằng AI (nhà cung cấp GIẢ LẬP, không gọi Hugging Face). Chạy: npm run test:e2e:real (nhóm admin-3d).
// Mỗi test tự chọn sản phẩm riêng.

const SPHERE = join(FIXTURES, 'sphere.glb');
const BROKEN = join(FIXTURES, 'broken.glb');
const BASE = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
/** PNG 1×1: ảnh chụp tối thiểu để thử luồng AI giả lập (máy CI không có ảnh thật) */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPY2RuDFTEMLQkA7GBogUx5vpcAAAAASUVORK5CYII=';

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

/** Sản phẩm riêng cho từng test: thứ `n` từ cuối danh sách, chưa có mô hình */
async function freeProduct(request: APIRequestContext, n: number) {
  const list = (await (await request.get(`${API}/api/products?pageSize=100`)).json()).data as Array<{
    id: number;
    name: string;
    slug: string;
    has3dModel: boolean;
  }>;
  const p = list[list.length - 1 - n];
  expect(p.has3dModel).toBe(false);
  return p;
}

/** Sản phẩm riêng cho luồng AI, có đúng một ảnh chụp (không lưu đè sản phẩm của seed) */
async function newPhotoProduct(request: APIRequestContext) {
  const headers = await adminHeaders(request);
  const categories = (await (await request.get(`${API}/api/categories`)).json()).data as Array<{
    children: Array<{ id: number }>;
  }>;
  const created = await request.post(`${API}/api/admin/products`, {
    headers,
    data: {
      name: `Bàn thử AI ${Date.now()}`,
      categoryId: categories.find((c) => c.children.length)!.children[0].id,
      price: 1_500_000,
      sku: `AI-E2E-${Date.now()}`,
      stock: 5,
      shortDescription: 'Sản phẩm dùng để thử tạo mô hình 3D.',
      status: 'published',
      images: [{ url: PNG, isPrimary: true }],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()).data as { id: number; slug: string };
}

const publicModel = async (request: APIRequestContext, slug: string) =>
  (await (await request.get(`${API}/api/products/${slug}/model`)).json()).data;

/** Khách chưa đăng nhập: có/không có lối vào 3D ở trang sản phẩm */
async function expectCustomer3d(browser: Browser, slug: string, visible: boolean) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await page.goto(`/products/${slug}`);
  // trang có thêm nút này ở khối sản phẩm liên quan ⇒ lấy nút đầu (của sản phẩm đang xem)
  await expect(page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).first()).toBeVisible({
    timeout: 45_000,
  });
  const count = visible ? 1 : 0;
  await expect(page.getByRole('link', { name: /Trải nghiệm 3D ngay/ })).toHaveCount(count);
  await expect(page.getByRole('link', { name: 'Xem mô hình 3D' })).toHaveCount(count);
  await context.close();
}

test.describe.configure({ mode: 'serial' });

let productA: { id: number; name: string; slug: string };

test('nút 3D ẩn khi chưa có mô hình; admin tải GLB → chờ duyệt (khách chưa thấy) → duyệt → khách thấy', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  productA = await freeProduct(request, 0);
  await expectCustomer3d(browser, productA.slug, false);
  // vào thẳng trình xem của sản phẩm chưa có mô hình: thông báo rõ ràng, không lỗi
  await page.goto(`/products/${productA.slug}/3d`);
  await expect(page.getByText('Sản phẩm này chưa có mô hình 3D')).toBeVisible({ timeout: 45_000 });

  await adminLogin(page);
  await page.goto(`/admin/products/${productA.id}?tab=model`);
  await page.getByLabel('Chọn tệp GLB').setInputFiles(SPHERE);
  const review = page.getByTestId('model-review');
  await expect(review).toBeVisible({ timeout: 60_000 });
  await expect(review.getByTestId('review-sizes')).toContainText('Kích thước thật');
  await expect(review.getByTestId('review-viewer')).toHaveAttribute('src', /^blob:/, { timeout: 30_000 });
  expect(await publicModel(request, productA.slug)).toBeNull();
  await expectCustomer3d(browser, productA.slug, false);

  const approve = review.getByRole('button', { name: /^Duyệt/ });
  await expect(approve).toBeEnabled({ timeout: 30_000 });
  await approve.click();
  await expect(page.getByText('Đã duyệt. Khách hàng đã thấy nút xem 3D.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Mô hình đang hiện cho khách')).toBeVisible();
  await expectCustomer3d(browser, productA.slug, true);

  // khách xem 3D: trình xem tải đúng tệp LOD medium, không tô màu đè lên mô hình, có ghi chú màu
  const context = await browser.newContext({ baseURL: BASE });
  const cust = await context.newPage();
  const req = cust.waitForRequest(/sphere-medium-\w+\.glb/, { timeout: 45_000 });
  await cust.goto(`/products/${productA.slug}/3d`);
  await req;
  await expect(cust.getByTestId('viewer-3d')).toHaveAttribute('data-lod', 'medium', { timeout: 30_000 });
  await expect(cust.getByTestId('viewer-3d')).toHaveAttribute('data-material-applied', '');
  await expect(cust.getByTestId('model-color-note')).toContainText('không đổi màu mô hình');
  await context.close();
});

test('khách dùng điện thoại: trình xem chọn LOD low; tải mô hình lỗi thì hiện ảnh thay thế và thông báo', async ({
  browser,
}) => {
  const phone = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 } });
  const p1 = await phone.newPage();
  const req = p1.waitForRequest(/sphere-low-\w+\.glb/, { timeout: 45_000 });
  await p1.goto(`/products/${productA.slug}/3d`);
  await req;
  await expect(p1.getByTestId('viewer-3d')).toHaveAttribute('data-lod', 'low', { timeout: 30_000 });
  await phone.close();

  const desktop = await browser.newContext({ baseURL: BASE });
  const p2 = await desktop.newPage();
  await p2.route(/\.glb(\?|$)/, (r) => r.abort());
  await p2.goto(`/products/${productA.slug}/3d`);
  await expect(p2.getByTestId('viewer-3d-fallback')).toBeVisible({ timeout: 45_000 });
  await expect(p2.getByText(/Không tải được mô hình 3D/)).toBeVisible();
  await expect(p2.getByTestId('viewer-3d-fallback').locator('img')).toBeVisible();
  await desktop.close();
});

test('tạo bằng AI (giả lập): bắt buộc xác nhận → chờ duyệt có hai bản → duyệt → khách thấy, kèm ghi chú', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const p = await newPhotoProduct(request);
  await adminLogin(page);
  await page.goto(`/admin/products/${p.id}?tab=model`);
  const ai = page.getByTestId('ai-generate');
  await expect(ai.getByTestId('ai-usage')).toContainText('Hôm nay: 0/', { timeout: 45_000 });
  await expect(ai).toContainText('gửi tới máy chủ Hugging Face');
  const create = ai.getByRole('button', { name: 'Tạo mô hình 3D bằng AI' });
  await expect(create).toBeDisabled();
  await ai.getByLabel(/Tôi đồng ý gửi ảnh/).check();
  await create.click();

  const review = page.getByTestId('model-review');
  await expect(review).toBeVisible({ timeout: 90_000 });
  await expect(review).toContainText('Tạo bằng AI');
  await expect(review.getByRole('tab', { name: 'Đã gỡ tấm sàn' })).toHaveAttribute('aria-selected', 'true');
  await review.getByRole('tab', { name: 'Chưa gỡ (nguyên hình)' }).click();
  await expect(review.getByRole('alert').filter({ hasText: 'lệch hơn 15%' })).toBeVisible();
  await review.getByRole('tab', { name: 'Đã gỡ tấm sàn' }).click();
  await expect(review.getByRole('button', { name: 'Tạo lại' })).toBeVisible();
  await expect(ai.getByTestId('ai-usage')).toContainText('Hôm nay: 1/');
  await expect(ai.getByTestId('ai-blocked')).toContainText('chờ duyệt');
  expect(await publicModel(request, p.slug)).toBeNull();

  const approve = review.getByRole('button', { name: /^Duyệt/ });
  await expect(approve).toBeEnabled({ timeout: 30_000 });
  await approve.click();
  await expect(page.getByText('Đã duyệt. Khách hàng đã thấy nút xem 3D.')).toBeVisible({ timeout: 30_000 });
  // đã xác nhận trong phiên này: không hỏi lại
  await expect(ai.getByLabel(/Tôi đồng ý gửi ảnh/)).toHaveCount(0);
  await expectCustomer3d(browser, p.slug, true);
  const context = await browser.newContext({ baseURL: BASE });
  const cust = await context.newPage();
  await cust.goto(`/products/${p.slug}/3d`);
  await expect(cust.getByTestId('model-color-note')).toContainText('dựng bằng AI', { timeout: 45_000 });
  await context.close();
});

async function uploadVia(page: Page, productId: number, file: string) {
  await page.goto(`/admin/models?productId=${productId}`);
  await expect(page.getByRole('heading', { name: 'Mô hình 3D' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Tải lên mô hình' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[type="file"]').setInputFiles(file);
  await dlg.getByRole('button', { name: 'Tải lên', exact: true }).click();
  await expect(page.getByText(/chờ bạn xem thử và duyệt/)).toBeVisible({ timeout: 30_000 });
}

test('GLB hỏng: trạng thái Lỗi kèm lý do, nút Xử lý lại chạy được', async ({ page, request }) => {
  const p = await freeProduct(request, 2);
  await adminLogin(page);
  await uploadVia(page, p.id, BROKEN);

  const status = page.getByTestId('model-status').first();
  await expect(status).toHaveAttribute('data-status', 'failed', { timeout: 60_000 });
  await expect(status.getByRole('note')).toContainText('GLB');
  await status.getByRole('button', { name: 'Xử lý lại' }).click();
  await expect(page.getByText('Đã đưa mô hình vào hàng đợi xử lý lại.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('model-status').first()).toHaveAttribute('data-status', 'failed', {
    timeout: 60_000,
  });
});

test('trang mô hình 3D: bản vừa tải ở trạng thái Chờ duyệt, nút Xem & duyệt mở đúng tab; bỏ được', async ({
  page,
  request,
}) => {
  const p = await freeProduct(request, 3);
  await adminLogin(page);
  await uploadVia(page, p.id, SPHERE);
  const status = page.getByTestId('model-status').first();
  await expect(status).toHaveAttribute('data-status', 'pending_review', { timeout: 60_000 });
  await status.getByRole('link', { name: 'Xem & duyệt' }).click();
  const review = page.getByTestId('model-review');
  await expect(review).toBeVisible({ timeout: 45_000 });
  await review.getByRole('button', { name: 'Bỏ' }).click();
  await expect(page.getByText('Đã bỏ mô hình.')).toBeVisible({ timeout: 30_000 });
  await expect(review).toHaveCount(0);
  expect(await publicModel(request, p.slug)).toBeNull();
});

test('modal tải lên: xem trước đúng tệp GLB đã chọn (blob của tệp); tệp hỏng ⇒ báo lỗi', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/models');
  await expect(page.getByRole('heading', { name: 'Mô hình 3D' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Tải lên mô hình' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Chọn tệp GLB để xem trước')).toBeVisible();

  await dlg.locator('input[type="file"]').setInputFiles(SPHERE);
  const viewer = dlg.locator('model-viewer');
  await expect(viewer).toHaveAttribute('src', /^blob:/, { timeout: 30_000 });
  await expect(viewer).toHaveAttribute('alt', /sphere\.glb/);
  await expect(dlg.getByRole('alert')).toHaveCount(0);

  await dlg.getByRole('button', { name: 'Bỏ tệp' }).click();
  await expect(dlg.getByText('Chọn tệp GLB để xem trước')).toBeVisible();
  await dlg.locator('input[type="file"]').setInputFiles(BROKEN);
  await expect(dlg.getByRole('alert').filter({ hasText: 'Không tải được tệp mô hình' })).toBeVisible({
    timeout: 30_000,
  });
});
