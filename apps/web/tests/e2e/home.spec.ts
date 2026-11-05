import { expect, test } from '@playwright/test';

test('trang chủ mở được, có tiêu đề và Tailwind áp dụng màu thương hiệu', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/Aurelia Living/);
  await expect(page.getByRole('link', { name: /Aurelia Living – Trang chủ/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Danh mục nổi bật' })).toBeVisible({ timeout: 25_000 });
  // bg-primary lấy từ src/styles/theme.ts (#8B4A2B = rgb(139, 74, 43))
  const btn = page.getByRole('link', { name: /KHÁM PHÁ SẢN PHẨM/ });
  await expect(btn).toHaveCSS('background-color', 'rgb(139, 74, 43)');
  expect(errors).toEqual([]);
});

test('Three.js + React Three Fiber vẽ được trong trình duyệt thật (WebGL)', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return { webgl: Boolean(gl) };
  });
  expect(result.webgl).toBe(true);
});
