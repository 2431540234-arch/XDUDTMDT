import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// UC-ADM-14 / UC-3D-03 (API thật): đổi biến thể màu trên trang 3D thì màu vật liệu của mô hình đổi NGAY (đọc từ scene của
// <model-viewer>, không so ảnh), không tải lại mô hình và không gọi API thêm; admin cấu hình vật liệu theo biến thể.
// Chạy: npm run test:e2e:real (nhóm vat-lieu).

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill('admin@aurelia.vn');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 30_000 });
}

async function adminHeaders(request: APIRequestContext) {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
  });
  return { Authorization: `Bearer ${(await r.json()).data.tokens.accessToken}` };
}

/**
 * Màu thật của vật liệu  trong scene: baseColorFactor nằm ở không gian TUYẾN TÍNH nên đổi về sRGB (#RRGGBB) để so với config.
 */
async function sceneColor(page: Page, name: string) {
  return page.evaluate((n) => {
    const el = document.querySelector('model-viewer') as unknown as {
      model?: { materials: Array<{ name: string; pbrMetallicRoughness: { baseColorFactor: number[] } }> };
    } | null;
    const m = el?.model?.materials.find((x) => x.name === n);
    if (!m) return null;
    const toSrgb = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
    return (
      '#' +
      m.pbrMetallicRoughness.baseColorFactor
        .slice(0, 3)
        .map((c) =>
          Math.round(toSrgb(c) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
        .toUpperCase()
    );
  }, name);
}

/** Khoảng cách lớn nhất giữa các kênh của hai màu #RRGGBB (làm tròn tuyến tính ⇄ sRGB có thể lệch 1–2) */
function colorDistance(a: string | null, b: string) {
  if (!a) return 999;
  const ch = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return Math.max(...x.map((v, k) => Math.abs(v - y[k])));
}

test('khách đổi màu biến thể: vật liệu trong scene đổi ngay, không tải lại mô hình, không gọi API thêm', async ({
  page,
  request,
}) => {
  const slug = 'sofa-nordic';
  const detail = (await (await request.get(`${API}/api/products/${slug}`)).json()).data;
  const mvs = detail.model.materialVariants as Array<{
    variantId: number;
    materialName: string;
    config: { baseColor: string };
  }>;
  expect(mvs.length).toBeGreaterThanOrEqual(2);
  const materialName = mvs[0].materialName;
  // hai màu khác nhau: lấy tên màu từ biến thể
  const colorOf = (id: number) =>
    detail.variants.find((v: { id: number }) => v.id === id).color.name as string;
  const a = mvs[0];
  const b = mvs.find(
    (x) => x.config.baseColor !== a.config.baseColor && colorOf(x.variantId) !== colorOf(a.variantId),
  )!;
  expect(b).toBeTruthy();

  const glbRequests: string[] = [];
  page.on('request', (r) => {
    if (/\.glb(\?|$)/.test(r.url())) glbRequests.push(r.url());
  });
  await page.goto(`/products/${slug}/3d`);
  await expect(page.getByTestId('viewer-3d')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => Boolean((document.querySelector('model-viewer') as never as { model?: unknown })?.model),
    null,
    {
      timeout: 30_000,
    },
  );

  await page.getByRole('button', { name: colorOf(a.variantId), exact: true }).click();
  await expect
    .poll(async () => colorDistance(await sceneColor(page, materialName), a.config.baseColor))
    .toBeLessThanOrEqual(3);
  await expect(page.getByTestId('viewer-3d')).toHaveAttribute(
    'data-material-applied',
    new RegExp(`${materialName}=`),
  );

  const globalGlb = glbRequests.length;
  let apiCalls = 0;
  page.on('request', (r) => {
    if (r.url().startsWith(API)) apiCalls++;
  });
  await page.getByRole('button', { name: colorOf(b.variantId), exact: true }).click();
  await expect
    .poll(async () => colorDistance(await sceneColor(page, materialName), b.config.baseColor))
    .toBeLessThanOrEqual(3);
  expect(glbRequests.length).toBe(globalGlb); // không tải lại mô hình
  expect(apiCalls).toBe(0); // không gọi API thêm
  expect(a.config.baseColor).not.toBe(b.config.baseColor);
});

test('admin cấu hình vật liệu cho biến thể trên trang mô hình 3D; khách thấy màu mới', async ({
  page,
  request,
}) => {
  const h = await adminHeaders(request);
  const slug = 'sofa-nordic';
  const detail = (await (await request.get(`${API}/api/products/${slug}`)).json()).data;
  const variant = detail.variants[0] as { id: number; sku: string };
  const modelId = detail.model.id as number;
  const materialName = detail.model.materialVariants[0].materialName as string;

  await adminLogin(page);
  await page.goto('/admin/models');
  await page.getByPlaceholder('Tìm theo tên tệp, sản phẩm…').fill(detail.name);
  await expect(page.getByRole('row').filter({ hasText: detail.name }).first()).toBeVisible({
    timeout: 30_000,
  });
  const row = page.getByRole('row').filter({ hasText: detail.name }).first();
  await row.getByRole('button', { name: 'Thao tác' }).click();
  await page.getByRole('button', { name: 'Vật liệu theo biến thể' }).click();
  const panel = page.getByTestId('material-variants');
  await expect(panel).toBeVisible();
  const r = panel.getByTestId(`material-row-${variant.id}`);
  await expect(r).toBeVisible();
  // tên vật liệu lấy từ danh sách vật liệu có trong GLB
  await expect(
    r.getByTestId(`material-name-${variant.id}`).locator('option', { hasText: materialName }),
  ).toHaveCount(1);
  await r.getByTestId(`material-color-${variant.id}`).fill('#ff0000');
  await expect(r.getByTestId(`material-preview-${variant.id}`)).toHaveAttribute('style', /rgb\(255, 0, 0\)/);
  await r.getByTestId(`material-save-${variant.id}`).click();
  await expect(page.getByText('Đã lưu vật liệu cho biến thể.')).toBeVisible();

  const saved = (
    await (await request.get(`${API}/api/admin/models/${modelId}/material-variants`, { headers: h })).json()
  ).data as Array<{ variantId: number; config: { baseColor: string } }>;
  expect(saved.find((x) => x.variantId === variant.id)?.config.baseColor).toBe('#FF0000');
  const pub = (await (await request.get(`${API}/api/products/${slug}/model`)).json()).data;
  expect(
    pub.materialVariants.find((x: { variantId: number }) => x.variantId === variant.id).config.baseColor,
  ).toBe('#FF0000');
});
