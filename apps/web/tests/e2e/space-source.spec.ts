import { expect, test } from '@playwright/test';

// UC-SPACE-06 (API thật): trang chi tiết sản phẩm có khối "Xem trong không gian mẫu"; mọi liên kết gắn ?from=<slug sản phẩm>; mở không
// gian từ đó rồi rời trang thì trình duyệt gửi lượt xem kèm sourceProductId = slug sản phẩm (phía máy chủ ghi source_product_id và
// đưa lên phễu: xem api/test/space-source.db-spec.ts). Chạy: npm run test:e2e:real (nhóm phong-3d).

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

test('trang sản phẩm liệt kê không gian có sản phẩm, liên kết gắn ?from=<slug>, rời trang gửi sản phẩm nguồn', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);

  // sản phẩm có trong ít nhất một không gian
  const spaces = (await (await request.get(`${API}/api/spaces?pageSize=50`)).json()).data as Array<{
    slug: string;
  }>;
  const detail = (await (await request.get(`${API}/api/spaces/${spaces[0].slug}`)).json()).data;
  const product = detail.products[0] as { id: number; slug: string; name: string };
  const expected = (await (await request.get(`${API}/api/spaces?product=${product.slug}&pageSize=50`)).json())
    .data as Array<{ slug: string }>;
  expect(expected.length).toBeGreaterThan(0);

  await page.goto(`/products/${product.slug}`);
  const block = page.getByTestId('spaces-with-product');
  await expect(block).toBeVisible({ timeout: 30_000 });
  await expect(block.getByRole('heading', { name: 'Xem trong không gian mẫu' })).toBeVisible();
  const links = block.getByRole('link');
  const n = await links.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(3);
  for (let i = 0; i < n; i++) {
    const href = (await links.nth(i).getAttribute('href'))!;
    expect(href).toMatch(new RegExp(`^/spaces/[^/?]+\\?from=${product.slug}$`));
    expect(expected.map((s) => s.slug)).toContain(href.split('?')[0].replace('/spaces/', ''));
  }

  // mở không gian từ liên kết rồi rời trang ⇒ lượt xem gửi kèm sản phẩm nguồn
  const targetSlug = (await links.first().getAttribute('href'))!.split('?')[0].replace('/spaces/', '');
  await links.first().click();
  await expect(page).toHaveURL(new RegExp(`/spaces/[^/?]+\\?from=${product.slug}$`));
  await expect(page.getByLabel('Ảnh 360 độ')).toBeVisible({ timeout: 30_000 });
  const beacon = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith(`/api/spaces/${targetSlug}/views`),
    { timeout: 20_000 },
  );
  await page.goto('/'); // rời trang: gửi lượt xem bằng sendBeacon
  const body = JSON.parse((await beacon).postData() ?? '{}');
  expect(body.sourceProductId).toBe(product.slug);
  expect(body.visitorId).toMatch(/^[0-9a-f-]{36}$/);

  // sản phẩm không có trong không gian nào thì không hiện khối
  const all = (await (await request.get(`${API}/api/products?pageSize=100`)).json()).data as Array<{
    slug: string;
  }>;
  for (const p of all) {
    const has = (await (await request.get(`${API}/api/spaces?product=${p.slug}`)).json()).data.length;
    if (has === 0) {
      await page.goto(`/products/${p.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('spaces-with-product')).toHaveCount(0);
      break;
    }
  }
});
