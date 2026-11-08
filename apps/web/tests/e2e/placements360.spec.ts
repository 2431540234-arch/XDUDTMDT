import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// UC-ADM-17 / UC-SPACE-04/05 (API thật): admin đặt mô hình 3D vào ảnh 360° của một không gian chưa có placement, khách thấy
// mô hình (tải SAU khi ảnh 360° hiện, có trạng thái đang tải) và "Đổi món" thử mà KHÔNG lưu vào DB; không gian chưa đặt gì thì
// hiển thị như cũ. Trạng thái đọc từ phần tử `placed-models` (data-*), không so ảnh. Chạy: npm run test:e2e:real (nhóm phong-3d).

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

/** Không gian đã đăng, ảnh đầu chưa có placement nào */
async function emptySpace(request: APIRequestContext) {
  const list = (await (await request.get(`${API}/api/spaces?pageSize=50&sort=title`)).json()).data as Array<{
    slug: string;
  }>;
  for (const it of list) {
    const d = (await (await request.get(`${API}/api/spaces/${it.slug}`)).json()).data;
    const start = d.panoramas.find((p: { isStart: boolean }) => p.isStart) ?? d.panoramas[0];
    if (start && d.panoramas.every((p: { placements: unknown[] }) => p.placements.length === 0))
      return {
        id: d.id as number,
        slug: d.slug as string,
        panoId: start.id as number,
        title: d.title as string,
        yaw: start.defaultYaw as number,
      };
  }
  throw new Error('Không có không gian trống để thử');
}

const placed = (page: Page) => page.getByTestId('placed-models');

test('admin đặt mô hình vào ảnh 360°, khách thấy mô hình và Đổi món thử (không lưu); không gian khác không đổi', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240_000); // luồng dài: đăng nhập admin, đặt, tải mô hình ở editor và ở trang khách
  const h = await adminHeaders(request);
  const space = await emptySpace(request);
  const sofa = (await (await request.get(`${API}/api/products/sofa-nordic`)).json()).data as {
    id: number;
    name: string;
  };

  // không gian chưa đặt gì: khách xem như cũ (không có phần tử mô hình, không có trạng thái đang tải)
  await page.goto(`/spaces/${space.slug}`);
  await expect(page.getByLabel('Ảnh 360 độ')).toBeVisible({ timeout: 30_000 });
  await expect(placed(page)).toHaveCount(0);
  await expect(page.getByTestId('placements-loading')).toHaveCount(0);

  // ---- admin đặt trong editor
  await adminLogin(page);
  await page.goto(`/admin/spaces/${space.id}`);
  await page.getByRole('tab', { name: 'Đặt sản phẩm 3D' }).click();
  const editor = page.getByTestId('placement-editor');
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.getByTestId('open-add-placement').click();
  await editor.getByTestId('add-placement-product').selectOption(String(sofa.id));
  await editor.getByTestId('confirm-add-placement').click();
  await expect(page.getByText('Đã đặt sản phẩm 3D vào ảnh.')).toBeVisible();

  const rows = (
    await (await request.get(`${API}/api/admin/panoramas/${space.panoId}/placements`, { headers: h })).json()
  ).data as Array<{ id: number; productId: number; modelId: number; yaw: number }>;
  expect(rows).toHaveLength(1);
  const pl = rows[0];
  expect(pl.productId).toBe(sofa.id);
  expect(pl.modelId).toBeTruthy(); // không chọn mô hình ⇒ mô hình chính

  // xem trước trực tiếp: mô hình tải xong trong khung editor, chỉnh số thì trạng thái cập nhật ngay, chưa lưu
  await expect(placed(editor)).toHaveAttribute('data-loaded', '1', { timeout: 60_000 });
  await editor.getByTestId(`placement-row-${pl.id}`).click();
  await editor.getByTestId('pl-yaw').fill(String(space.yaw + 5)); // trong tầm nhìn đầu của khách để bấm được ghim
  await editor.getByTestId('pl-scale').fill('1.5');
  expect(
    (
      (
        await (
          await request.get(`${API}/api/admin/panoramas/${space.panoId}/placements`, { headers: h })
        ).json()
      ).data as Array<{
        yaw: number;
      }>
    )[0].yaw,
  ).toBe(pl.yaw); // chưa bấm Lưu ⇒ DB chưa đổi
  await editor.getByTestId('save-placement').click();
  await expect(page.getByText('Đã lưu vị trí.')).toBeVisible();
  const saved = (
    await (await request.get(`${API}/api/admin/panoramas/${space.panoId}/placements`, { headers: h })).json()
  ).data as Array<{ yaw: number; scale: number }>;
  expect(saved[0]).toMatchObject({ yaw: space.yaw + 5, scale: 1.5 });

  // ---- khách (phiên mới, chưa đăng nhập)
  const ctx = await browser.newContext();
  const cust = await ctx.newPage();
  await cust.goto(`/spaces/${space.slug}`);
  await expect(cust.getByLabel('Ảnh 360 độ')).toBeVisible({ timeout: 30_000 });
  await expect(placed(cust)).toHaveAttribute('data-total', '1', { timeout: 30_000 });
  await expect(placed(cust)).toHaveAttribute('data-loaded', '1', { timeout: 60_000 }); // tải sau khi ảnh hiện
  await expect(cust.getByTestId('placements-loading')).toHaveCount(0);
  const items0 = JSON.parse((await placed(cust).getAttribute('data-items'))!) as Array<{ productId: number }>;
  expect(items0[0].productId).toBe(sofa.id);

  await cust.getByTestId(`placement-pin-${pl.id}`).click();
  await expect(cust.getByTestId('placement-name')).toHaveText(sofa.name);
  await cust.getByRole('button', { name: 'Đổi món' }).click();
  const alt = cust.getByTestId('alternatives').locator('[data-testid^="alt-"]').first();
  await expect(alt).toBeVisible({ timeout: 30_000 });
  const altId = Number((await alt.getAttribute('data-testid'))!.replace('alt-', ''));
  expect(altId).not.toBe(sofa.id);
  await alt.click();

  // mô hình mới thay vào ĐÚNG chỗ cũ (cùng placement, cùng vị trí), tải xong, hiện nhãn "xem thử"
  await expect
    .poll(async () => JSON.parse((await placed(cust).getAttribute('data-items'))!)[0])
    .toMatchObject({ id: pl.id, productId: altId, loaded: true });
  await expect(cust.getByText('Đang xem thử — không được lưu lại')).toBeVisible();
  const after = (
    await (await request.get(`${API}/api/admin/panoramas/${space.panoId}/placements`, { headers: h })).json()
  ).data as Array<{ productId: number; yaw: number; scale: number }>;
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ productId: sofa.id, yaw: space.yaw + 5, scale: 1.5 }); // KHÔNG lưu vào DB

  // tải lại trang: về món gốc
  await cust.reload();
  await expect(placed(cust)).toHaveAttribute('data-loaded', '1', { timeout: 60_000 });
  expect(JSON.parse((await placed(cust).getAttribute('data-items'))!)[0].productId).toBe(sofa.id);
  await ctx.close();

  // dọn
  await request.delete(`${API}/api/admin/panoramas/${space.panoId}/placements/${pl.id}`, { headers: h });
});

test('không gian seed có mô hình đặt sẵn hiển thị mô hình; ảnh vẫn xem được khi mô hình lỗi tải', async ({
  page,
  request,
}) => {
  const seeded = (await (await request.get(`${API}/api/spaces?pageSize=50`)).json()).data as Array<{
    slug: string;
  }>;
  let slug = '';
  for (const s of seeded) {
    const d = (await (await request.get(`${API}/api/spaces/${s.slug}`)).json()).data;
    if (d.panoramas.some((p: { placements: unknown[] }) => p.placements.length > 0)) {
      slug = s.slug;
      break;
    }
  }
  expect(slug).not.toBe('');
  // chặn mọi tệp GLB: ảnh 360° và trang vẫn dùng được, mô hình bị bỏ qua
  await page.route(/\.glb(\?|$)/, (r) => r.abort());
  await page.goto(`/spaces/${slug}`);
  await expect(page.getByLabel('Ảnh 360 độ')).toBeVisible({ timeout: 30_000 });
  await expect(placed(page)).toHaveAttribute('data-total', /[1-9]/, { timeout: 30_000 });
  await expect(page.getByTestId('placements-loading')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText('Không tải được ảnh 360°')).toHaveCount(0);
});
