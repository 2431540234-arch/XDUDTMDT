import { expect, test, type Page } from '@playwright/test';

// Mốc 5 (web, API thật): thương hiệu, thuộc tính, media, vận chuyển.
// Chạy: npm run test:e2e:real (nhóm admin-m5) hoặc E2E_USE_MOCK=false E2E_API_URL=http://localhost:4000

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

test('thương hiệu: thêm, trùng slug báo lỗi, sửa, tắt ⇒ ô chọn trong form sản phẩm, xóa có cảnh báo số sản phẩm', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto('/admin/brands');
  await expect(page.getByRole('heading', { name: 'Thương hiệu' })).toBeVisible({ timeout: 30_000 });

  // thêm
  await page.getByRole('button', { name: 'Thêm thương hiệu' }).click();
  let dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Lưu thương hiệu' }).click();
  await expect(dlg.getByText('Vui lòng nhập tên thương hiệu.')).toBeVisible();
  await dlg.getByLabel('Tên thương hiệu').fill('Thương Hiệu E2E');
  await expect(dlg.getByLabel('Slug')).toHaveValue('thuong-hieu-e2e');
  await dlg.getByRole('button', { name: 'Lưu thương hiệu' }).click();
  await expect(page.getByText('Đã thêm thương hiệu.')).toBeVisible({ timeout: 30_000 });
  const row = page.getByRole('row', { name: /Thương Hiệu E2E/ });
  await expect(row).toBeVisible();
  await expect(row.getByText('thuong-hieu-e2e')).toBeVisible();

  // trùng slug ⇒ lỗi dưới ô slug (409)
  await page.getByRole('button', { name: 'Thêm thương hiệu' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel('Tên thương hiệu').fill('Tên khác');
  await dlg.getByLabel('Slug').fill('thuong-hieu-e2e');
  await dlg.getByRole('button', { name: 'Lưu thương hiệu' }).click();
  await expect(dlg.getByText('Slug đã được dùng cho thương hiệu khác.').first()).toBeVisible({
    timeout: 30_000,
  });
  await dlg.getByRole('button', { name: 'Hủy' }).click();

  // sửa tên (slug giữ nguyên)
  await row.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel('Tên thương hiệu').fill('Thương Hiệu E2E Mới');
  await expect(dlg.getByLabel('Slug')).toHaveValue('thuong-hieu-e2e');
  await dlg.getByRole('button', { name: 'Lưu thương hiệu' }).click();
  await expect(page.getByText('Đã cập nhật thương hiệu.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: /Thương Hiệu E2E Mới/ })).toBeVisible();

  // ô chọn thương hiệu trong form sản phẩm có thương hiệu đang hoạt động
  await page.goto('/admin/products/1');
  await expect(page.getByText(/Sửa:/).first()).toBeVisible({ timeout: 30_000 });
  const brandSelect = page.getByLabel(/Thương hiệu/).first();
  await expect(brandSelect.locator('option', { hasText: 'Thương Hiệu E2E Mới' })).toHaveCount(1, {
    timeout: 30_000,
  });

  // tắt ⇒ không còn trong ô chọn
  await page.goto('/admin/brands');
  const row2 = page.getByRole('row', { name: /Thương Hiệu E2E Mới/ });
  await row2.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'Đang hoạt động' }).uncheck();
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu thương hiệu' }).click();
  await expect(page.getByText('Đã cập nhật thương hiệu.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: /Thương Hiệu E2E Mới.*Đã tắt/ })).toBeVisible();
  await page.goto('/admin/products/1');
  await expect(page.getByText(/Sửa:/).first()).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByLabel(/Thương hiệu/)
      .first()
      .locator('option', { hasText: 'Thương Hiệu E2E Mới' }),
  ).toHaveCount(0);

  // xóa thương hiệu đang có sản phẩm ⇒ cảnh báo; hủy không xóa
  await page.goto('/admin/brands');
  const withProducts = page.getByRole('row').filter({ hasText: 'Aurelia Home' }).first();
  await expect(withProducts).toBeVisible({ timeout: 30_000 });
  await withProducts.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/đang có \d+ sản phẩm/);
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy' }).click();
  await expect(withProducts).toBeVisible();

  // xóa thương hiệu của test (không có sản phẩm) ⇒ không có cảnh báo
  const mine = page.getByRole('row', { name: /Thương Hiệu E2E Mới/ });
  await mine.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa thương hiệu' }).click();
  await expect(page.getByText('Đã xóa thương hiệu.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('row', { name: /Thương Hiệu E2E Mới/ })).toHaveCount(0);
});
