// UC-CART-04 (API thật): popup chọn mã ở giỏ hàng → áp mã → đặt hàng; trang Mã giảm giá trong tài khoản.
// Chạy: npm run test:e2e:real (nhóm ma-giam-gia).
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test } from './helpers/test';
import { visit } from './helpers/visit';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const money = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

test.skip(process.env.E2E_USE_MOCK !== 'false', 'cần API thật');

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục nổi bật' })).toBeVisible({ timeout: 30_000 });
}

/** Giỏ có đúng một sản phẩm giá 2–5,5 triệu: GIAM200K (từ 2 triệu) dùng được, GIAM500K (từ 6 triệu) chưa đủ */
async function prepareCart(request: APIRequestContext) {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { email: 'khachhang@aurelia.vn', password: '123456' },
  });
  const headers = { Authorization: `Bearer ${(await r.json()).data.tokens.accessToken}` };
  expect((await request.delete(`${API}/api/cart`, { headers })).status()).toBe(200);
  const products = (await (await request.get(`${API}/api/products?pageSize=60`)).json()).data as Array<{
    slug: string;
  }>;
  for (const p of products) {
    const detail = (await (await request.get(`${API}/api/products/${p.slug}`)).json()).data;
    const v = (
      detail.variants as Array<{
        id: number;
        price: number;
        salePrice: number | null;
        stockQuantity: number;
      }>
    ).find((x) => {
      const price = x.salePrice ?? x.price;
      return x.stockQuantity > 3 && price >= 2_000_000 && price <= 5_500_000;
    });
    if (!v) continue;
    const added = await request.post(`${API}/api/cart/items`, {
      headers,
      data: { variantId: v.id, quantity: 1 },
    });
    expect(added.ok()).toBe(true);
    return (await (await request.get(`${API}/api/cart`, { headers })).json()).data as {
      subtotal: number;
      total: number;
    };
  }
  throw new Error('seed không có biến thể giá 2–5,5 triệu còn hàng');
}

const summary = (page: Page) => page.getByRole('complementary').filter({ hasText: 'Tổng tiền giỏ hàng' });
const option = (page: Page, code: string) =>
  page.locator(`[data-testid="coupon-option"][data-code="${code}"]`);

test('giỏ hàng: mở popup, mã chưa đủ điều kiện bị khóa, áp mã đủ điều kiện ⇒ tổng tiền giảm đúng ⇒ đặt hàng thành công', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  const before = await prepareCart(request);
  await login(page);
  await visit(page, '/cart', /Giỏ hàng của bạn \(1 sản phẩm\)/);
  await expect(summary(page)).toContainText(money(before.total));

  await page.getByRole('button', { name: 'Chọn mã giảm giá' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chọn mã giảm giá' });
  await expect(option(page, 'GIAM200K')).toBeVisible({ timeout: 30_000 });
  await expect(option(page, 'GIAM500K')).toContainText(
    `Mua thêm ${money(6_000_000 - before.subtotal)} để dùng mã`,
  );
  await expect(option(page, 'GIAM500K').getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
  await expect(option(page, 'NOITHAT20')).toHaveCount(0); // mã riêng tư không xuất hiện

  // đóng bằng Esc rồi mở lại
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Chọn mã giảm giá' }).click();

  await option(page, 'GIAM200K').getByRole('button', { name: 'Áp dụng' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Đã áp dụng mã GIAM200K')).toBeVisible();
  await expect(summary(page)).toContainText(`-${money(200_000)}`);
  await expect(summary(page)).toContainText(money(before.total - 200_000));

  // mở lại: mã đang áp được đánh dấu và bỏ được; áp lại
  await page.getByRole('button', { name: 'Chọn mã giảm giá' }).click();
  await expect(option(page, 'GIAM200K')).toContainText('Đang áp dụng');
  await option(page, 'GIAM200K').getByRole('button', { name: 'Bỏ mã' }).click();
  await expect(option(page, 'GIAM200K').getByRole('button', { name: 'Áp dụng' })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(summary(page)).toContainText(money(before.total));
  await option(page, 'GIAM200K').getByRole('button', { name: 'Áp dụng' }).click();
  await expect(summary(page)).toContainText(money(before.total - 200_000));

  await page
    .getByRole('link', { name: /Thanh toán/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Thanh toán', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Giảm giá (GIAM200K)')).toBeVisible();
  await page.getByRole('radio', { name: /Thanh toán khi nhận hàng/ }).check();
  await page.getByRole('button', { name: 'Đặt hàng' }).click();
  await expect(page.getByText('Đặt hàng thành công!')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: 'Xem chi tiết đơn hàng' }).click();
  await expect(page.getByRole('heading', { name: /Chi tiết đơn hàng #ALV-/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Giảm giá (GIAM200K)')).toBeVisible();
  await expect(page.getByText(`-${money(200_000)}`).first()).toBeVisible();
});

test('tài khoản: mục Mã giảm giá trong sidebar, danh sách mã công khai, sao chép mã, Dùng ngay sang giỏ hàng', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page);
  await visit(page, '/account/orders', 'Đơn hàng của tôi');
  const menu = page.getByRole('complementary', { name: 'Menu tài khoản' });
  const labels = (await menu.getByRole('link').allInnerTexts()).map((x) => x.trim());
  expect(labels.indexOf('Mã giảm giá')).toBe(labels.indexOf('Đơn hàng của tôi') + 1);
  await menu.getByRole('link', { name: 'Mã giảm giá' }).click();
  await expect(page.getByRole('heading', { name: 'Mã giảm giá', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await visit(page, '/account/coupons', 'Sao chép mã');

  const cards = page.getByTestId('account-coupon');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const codes = await cards.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.code));
  expect(codes).toContain('GIAM500K');
  for (const code of codes) expect(['WELCOME10', 'FREESHIP', 'GIAM200K', 'GIAM500K']).toContain(code);
  await expect(page.getByText(/Mua thêm .* để dùng mã/)).toHaveCount(0);

  const card = page.locator('[data-testid="account-coupon"][data-code="GIAM500K"]');
  await card.getByRole('button', { name: 'Sao chép mã' }).click();
  await expect(page.getByText('Đã sao chép mã GIAM500K')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('GIAM500K');
  await card.getByRole('link', { name: 'Dùng ngay' }).click();
  await expect(page).toHaveURL(/\/cart$/, { timeout: 30_000 });
});
