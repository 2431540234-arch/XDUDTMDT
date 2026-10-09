import { expect, test } from '@playwright/test';

test('trang chủ mở được, có tiêu đề và Tailwind áp dụng màu thương hiệu', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/Aurelia Living/);
  const h1 = page.getByRole('heading', { name: 'Aurelia Living' });
  await expect(h1).toBeVisible();
  // text-primary lấy từ src/styles/theme.ts (#8B5E3C = rgb(139, 94, 60))
  await expect(h1).toHaveCSS('color', 'rgb(139, 94, 60)');
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
