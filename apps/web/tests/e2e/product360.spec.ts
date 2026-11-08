import { expect, test, type Page } from '@playwright/test';

// Kiểm tra tính năng "Xem 360°" (docs/PROMPT_360_SAN_PHAM.md, phần 5) với dữ liệu giả.

const angle = async (page: Page) => Number(await page.getByRole('slider', { name: 'Góc xoay' }).inputValue());
const stage = (page: Page) => page.getByRole('application', { name: 'Xem sản phẩm 360 độ' });

async function waitLoaded(page: Page) {
  await expect(stage(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Đang tải ảnh 360°/)).toBeHidden({ timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

test('nút "Xem 360°" chỉ hiện ở sản phẩm có 360°, mang theo biến thể; banner 3D vẫn có; trang 360° nhận biến thể từ URL', async ({
  page,
}) => {
  for (const [slug, name] of [
    ['ke-tivi-hien-dai', 'Kệ tivi hiện đại'],
    ['sofa-nordic', 'Sofa Nordic'],
  ]) {
    await page.goto(`/products/${slug}`);
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Xem 360°' })).toHaveCount(slug === 'sofa-nordic' ? 1 : 0);
    await expect(page.getByRole('link', { name: /Trải nghiệm 3D ngay/ })).toHaveAttribute(
      'href',
      `/products/${slug}/3d`,
    );
  }
  // từ trang chi tiết: chọn Kem + 4 chỗ rồi bấm nút 360° → mở trang 360° đúng biến thể
  await page.goto('/products/sofa-nordic');
  await expect(page.getByRole('heading', { name: 'Sofa Nordic' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Xem sản phẩm 360 độ' })).toBeVisible();
  await page.getByRole('button', { name: 'Kem', exact: true }).click();
  await page.getByRole('button', { name: '4 chỗ' }).click();
  await page.getByRole('link', { name: 'Xem 360°' }).click();
  await expect(page).toHaveURL(/\/products\/sofa-nordic\/360\?color=kem&size=4-cho/);
  await waitLoaded(page);
  await expect(page.getByTestId('color-name')).toHaveText('Kem');
});

test('xoay: bàn phím, thanh trượt, tự xoay, kéo chuột, zoom', async ({ page }) => {
  await page.goto('/products/sofa-nordic/360');
  await waitLoaded(page);
  await stage(page).focus();
  await page.keyboard.press('Space'); // dừng tự xoay
  const a0 = await angle(page);
  await page.keyboard.press('ArrowRight');
  expect(await angle(page)).toBe((a0 + 10) % 360);
  await page.keyboard.press('ArrowLeft');
  expect(await angle(page)).toBe(a0);

  await page.getByRole('slider', { name: 'Góc xoay' }).fill('180');
  expect(await angle(page)).toBe(180);

  // kéo chuột
  const box = (await stage(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + 200, { steps: 8 });
  await page.mouse.up();
  expect(await angle(page)).not.toBe(180);
  await expect(page.getByText('Kéo để xoay 360°')).toBeHidden();

  // tự xoay
  await page.getByRole('button', { name: 'Tự xoay' }).click();
  const before = await angle(page);
  // chờ tối đa 10 s (máy tải nặng có thể làm requestAnimationFrame chậm); trước đây chỉ chờ cố định 1,5 s nên đôi khi đỏ
  await expect.poll(() => angle(page), { timeout: 10_000 }).not.toBe(before);
  await page.getByRole('button', { name: 'Dừng tự xoay' }).click();

  // zoom
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
  await expect(stage(page)).toHaveAttribute('data-zoom', /1\.[1-9]/);
  await page.getByRole('button', { name: 'Đặt lại góc' }).click();
  await expect(stage(page)).toHaveAttribute('data-zoom', '1.00');
  expect(await angle(page)).toBe(0);
});

test('đổi màu/kích thước: giữ góc, URL đổi, không tải lại trang, hết hàng', async ({ page }) => {
  await page.goto('/products/sofa-nordic/360?color=be&size=3-cho');
  await waitLoaded(page);
  await stage(page).focus();
  await page.keyboard.press('Space');
  await page.getByRole('slider', { name: 'Góc xoay' }).fill('120');

  const documents: string[] = [];
  page.on('request', (r) => r.resourceType() === 'document' && documents.push(r.url()));
  const historyBefore = await page.evaluate(() => history.length);

  const price3 = await page.getByTestId('price').innerText();
  const sku3 = await page.getByTestId('sku').innerText();
  await page.getByRole('button', { name: 'Kem', exact: true }).click();
  await expect(page.getByTestId('color-name')).toHaveText('Kem');
  expect(await angle(page)).toBe(120); // giữ góc xoay
  await expect(page).toHaveURL(/color=kem&size=3-cho/);

  await page.getByRole('radio', { name: /^4 chỗ/ }).click();
  await expect(page).toHaveURL(/color=kem&size=4-cho/);
  expect(await page.getByTestId('price').innerText()).not.toBe(price3);
  expect(await page.getByTestId('sku').innerText()).not.toBe(sku3);
  await expect(page.getByTestId('dims')).toContainText('cm');

  // Xám + 4 chỗ hết hàng → tự chuyển sang kích thước còn hàng và báo toast
  await page.getByRole('button', { name: 'Xám', exact: true }).click();
  await expect(page).toHaveURL(/color=xam&size=3-cho/);
  await expect(page.getByText(/đã chuyển sang 3 chỗ/)).toBeVisible();
  await expect(page.getByRole('radio', { name: /^4 chỗ/ })).toBeDisabled();
  expect(await angle(page)).toBe(120);

  expect(documents).toEqual([]); // không có request tải lại document
  expect(await page.evaluate(() => history.length)).toBe(historyBefore); // replaceState: không thêm lịch sử
});

test('Back về trang chi tiết đúng biến thể; link chia sẻ mở đúng biến thể', async ({ page, context }) => {
  await page.goto('/products/sofa-luxury');
  await expect(page.getByRole('heading', { name: 'Sofa Luxury' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Nâu', exact: true }).click();
  await page.goto('/products/sofa-luxury/360?color=nau');
  await waitLoaded(page);
  await page.getByRole('button', { name: 'Kem', exact: true }).click();
  await page.getByRole('radio', { name: /^4 chỗ/ }).click();
  const shared = page.url();
  await page.goBack();
  await expect(page).toHaveURL(/\/products\/sofa-luxury(\?color=nau.*)?$/);
  await expect(page.getByRole('heading', { name: 'Sofa Luxury' })).toBeVisible();

  const tab = await context.newPage();
  await tab.goto(shared);
  await waitLoaded(tab);
  await expect(tab.getByTestId('color-name')).toHaveText('Kem');
  await expect(tab.getByRole('radio', { name: /^4 chỗ/ })).toHaveAttribute('aria-checked', 'true');
});

test('thêm vào giỏ / mua ngay đúng biến thể, chính sách đủ 4 mục', async ({ page }) => {
  await page.goto('/login?next=/products/sofa-nordic/360');
  await page.locator('input[name="email"]').fill('khachhang@aurelia.vn');
  await page.locator('input[name="password"]').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await waitLoaded(page);
  await page.getByRole('button', { name: 'Kem', exact: true }).click();
  await page.getByRole('radio', { name: /^2 chỗ/ }).click();
  const badge = page.getByRole('link', { name: 'Giỏ hàng' });
  const n0 = Number((await badge.innerText()) || 0);
  await page.getByRole('complementary').getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  await expect(page.getByText('Đã thêm Sofa Nordic – Kem, 2 chỗ vào giỏ')).toBeVisible();
  await expect(page).toHaveURL(/\/360/);
  await expect(badge).toHaveText(String(n0 + 1));

  await page.getByRole('tab', { name: 'Chính sách' }).click();
  const pol = page.getByTestId('policies');
  await expect(pol.getByRole('heading')).toHaveCount(4);
  await expect(pol.getByRole('link', { name: /Xem chi tiết/ })).toHaveCount(4);
  await expect(pol.getByRole('link').first()).toHaveAttribute('href', /\/policies\//);
  await page.getByRole('tab', { name: 'Thông số kỹ thuật' }).click();
  await expect(page.getByTestId('specs')).toContainText('Mã SKU');

  await page.getByRole('complementary').getByRole('button', { name: 'Mua ngay' }).click();
  await expect(page).toHaveURL(/\/checkout\?items=\d+/);
});

test('mobile 390px: thanh dưới cố định và tablet 768px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/products/ghe-thu-gian/360');
  await waitLoaded(page);
  await expect(page.getByTestId('mobile-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm tùy chọn' })).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1000 });
  await expect(page.getByTestId('mobile-bar')).toBeHidden();
  await expect(
    page.getByRole('complementary').getByRole('button', { name: 'Thêm vào giỏ hàng' }),
  ).toBeVisible();
});

test('sản phẩm không có 360°: thông báo và nút quay lại', async ({ page }) => {
  await page.goto('/products/ke-tivi-hien-dai/360');
  await expect(page.getByText('Sản phẩm này chưa có ảnh 360°')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Quay lại chi tiết sản phẩm' })).toBeVisible();
});

test('không lỗi console / HTTP / ảnh vỡ ở trang 360°', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await page.goto('/products/den-trang-tri/360');
  await waitLoaded(page);
  await page.getByRole('button', { name: 'Đen', exact: true }).click();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
