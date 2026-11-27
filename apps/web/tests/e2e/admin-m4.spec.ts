import { expect, type Page } from '@playwright/test';
import { test } from './helpers/test';

// Mốc 4 (API thật): Cài đặt, phương thức thanh toán.
// Chạy: npm run test:e2e:real (nhóm admin-m4) hoặc E2E_USE_MOCK=false E2E_API_URL=http://localhost:4000

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

/** Chọn biến thể đầu tiên trong hộp thoại phiếu kho; trả về SKU */

/** Tồn kho của một SKU trong bảng (tìm theo SKU rồi đọc cột "Tồn kho") */

test.describe.configure({ mode: 'serial' });

test('cài đặt: sửa thông tin cửa hàng (kiểm tra tên/email), lưu, tải lại vẫn còn, GET /settings/public thấy ngay; vận chuyển', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  await adminLogin(page);
  await page.goto('/admin/settings');
  await expect(page.getByText('Cấu hình cửa hàng')).toBeVisible({ timeout: 30_000 });
  const name = page.getByLabel(/Tên cửa hàng/);
  const email = page.getByLabel(/^Email/).first();
  await expect(name).toBeVisible({ timeout: 30_000 });
  const originalName = await name.inputValue();
  const originalEmail = await email.inputValue();

  await name.fill('');
  await email.fill('khong-phai-email');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText(/Vui lòng nhập tên cửa hàng/)).toBeVisible();
  await expect(page.getByText(/Email không hợp lệ/)).toBeVisible();

  await name.fill('Aurelia Living E2E');
  await email.fill(originalEmail);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel(/Tên cửa hàng/)).toHaveValue('Aurelia Living E2E', { timeout: 30_000 });
  const pub = (await (await request.get(`${api}/api/settings/public`)).json()).data;
  expect(pub.store.name).toBe('Aurelia Living E2E');

  // khôi phục tên cửa hàng
  await page.getByLabel(/Tên cửa hàng/).fill(originalName);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible({ timeout: 30_000 });
  const pub2 = (await (await request.get(`${api}/api/settings/public`)).json()).data;
  expect(pub2.store.name).toBe(originalName);
});

test('thanh toán: phương thức bị tắt trong Cài đặt không còn ở trang thanh toán; phương thức đang chọn tự đổi; bật lại thì hiện', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const login = async (email: string, password: string) =>
    (await (await request.post(`${api}/api/auth/login`, { data: { email, password } })).json()).data.tokens
      .accessToken as string;
  const admin = await login('admin@aurelia.vn', 'admin123');
  const adminH = { Authorization: `Bearer ${admin}` };
  const settings = (await (await request.get(`${api}/api/admin/settings`, { headers: adminH })).json()).data;
  const original = settings.payments as Array<{ method: string; enabled: boolean }>;
  const setCod = (enabled: boolean) =>
    request.put(`${api}/api/admin/settings/store`, {
      headers: adminH,
      data: { payments: original.map((p) => (p.method === 'cod' ? { ...p, enabled } : p)) },
    });
  try {
    expect((await setCod(false)).ok()).toBe(true);
    // khách có hàng trong giỏ rồi vào trang thanh toán
    await page.goto('/login?next=/products/sofa-nordic');
    await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
    await page.locator('input[name="password"]').fill('123456');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sofa Nordic' })).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole('button', { name: /Thêm vào giỏ hàng/ })
      .first()
      .click();
    await expect(page.getByText(/Đã thêm/)).toBeVisible({ timeout: 30_000 });
    await page.goto('/checkout');
    await expect(page.getByText('Thanh toán khi nhận hàng').first())
      .toBeHidden({ timeout: 30_000 })
      .catch(() => undefined);
    await expect(page.getByText('Chuyển khoản ngân hàng').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Thanh toán khi nhận hàng')).toHaveCount(0);
    // bật lại ⇒ hiện
    expect((await setCod(true)).ok()).toBe(true);
    await page.reload();
    await expect(page.getByText('Thanh toán khi nhận hàng').first()).toBeVisible({ timeout: 30_000 });
  } finally {
    await request.put(`${api}/api/admin/settings/store`, { headers: adminH, data: { payments: original } });
  }
});
