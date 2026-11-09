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

test('thuộc tính: thêm thuộc tính/giá trị (trùng báo lỗi), giá trị đang dùng không xóa được, giá trị mới có trong form biến thể', async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto('/admin/attributes');
  await expect(page.getByRole('heading', { name: 'Thuộc tính', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const color = page.getByRole('region', { name: 'Thuộc tính Màu sắc' });
  await expect(color.getByText('Hệ thống')).toBeVisible();
  await expect(color.getByRole('button', { name: 'Xóa thuộc tính Màu sắc' })).toHaveCount(0); // thuộc tính hệ thống không xóa

  // thêm thuộc tính: mã sai ⇒ lỗi; trùng ⇒ 409 hiện dưới ô
  await page.getByRole('button', { name: 'Thêm thuộc tính' }).click();
  let dlg = page.getByRole('dialog');
  await dlg.getByLabel(/Mã thuộc tính/).fill('Van Go');
  await dlg.getByLabel(/Tên thuộc tính/).fill('Vân gỗ e2e');
  await dlg.getByRole('button', { name: 'Lưu thuộc tính' }).click();
  await expect(dlg.getByText(/Mã chỉ gồm chữ thường/)).toBeVisible();
  await dlg.getByLabel(/Mã thuộc tính/).fill('color');
  await dlg.getByRole('button', { name: 'Lưu thuộc tính' }).click();
  await expect(dlg.getByText('Mã thuộc tính đã tồn tại.')).toBeVisible({ timeout: 30_000 });
  await dlg.getByLabel(/Mã thuộc tính/).fill('van_go_e2e');
  await dlg.getByRole('button', { name: 'Lưu thuộc tính' }).click();
  await expect(page.getByText('Đã thêm thuộc tính.')).toBeVisible({ timeout: 30_000 });
  const mine = page.getByRole('region', { name: 'Thuộc tính Vân gỗ e2e' });
  await expect(mine).toBeVisible();

  // thêm giá trị cho thuộc tính màu (có mã màu) để dùng trong form biến thể
  await color.getByRole('button', { name: 'Thêm giá trị' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel(/^Giá trị/).fill('Xanh e2e');
  await dlg.getByRole('button', { name: 'Lưu giá trị' }).click();
  await expect(page.getByText('Đã thêm giá trị.')).toBeVisible({ timeout: 30_000 });
  await expect(color.getByRole('row', { name: /Xanh e2e/ })).toBeVisible();
  // trùng giá trị ⇒ báo lỗi
  await color.getByRole('button', { name: 'Thêm giá trị' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel(/^Giá trị/).fill('Xanh e2e');
  await dlg.getByRole('button', { name: 'Lưu giá trị' }).click();
  await expect(dlg.getByText('Giá trị này đã có trong thuộc tính.')).toBeVisible({ timeout: 30_000 });
  await dlg.getByRole('button', { name: 'Hủy' }).click();

  // giá trị đang được biến thể dùng: cảnh báo + 409 khi xóa
  const usedRow = color.getByRole('row').filter({ hasText: 'Kem' }).first();
  await expect(usedRow).toBeVisible();
  await usedRow.getByRole('button', { name: /Xóa giá trị/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/đang được \d+ biến thể/);
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText(/đang được \d+ biến thể sử dụng, không thể xóa/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(color.getByRole('row', { name: /Kem/ }).first()).toBeVisible();

  // form biến thể của sản phẩm có giá trị mới trong ô chọn màu
  await page.goto('/admin/products/1');
  await expect(page.getByText(/Sửa:/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Biến thể' }).click();
  await expect(page.getByLabel('Màu').first().locator('option', { hasText: 'Xanh e2e' })).toHaveCount(1, {
    timeout: 30_000,
  });

  // dọn: xóa giá trị chưa dùng và thuộc tính tự tạo
  await page.goto('/admin/attributes');
  const color2 = page.getByRole('region', { name: 'Thuộc tính Màu sắc' });
  await color2.getByRole('button', { name: 'Xóa giá trị Xanh e2e' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText('Đã xóa giá trị.')).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole('region', { name: 'Thuộc tính Vân gỗ e2e' })
    .getByRole('button', { name: 'Xóa thuộc tính Vân gỗ e2e' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByText('Đã xóa thuộc tính.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Thuộc tính Vân gỗ e2e' })).toHaveCount(0);
});

test('media: tải ảnh lên (quá 5 MB bị từ chối), tìm, sửa mô tả, xóa tệp chưa dùng; tệp đang dùng cảnh báo và không xóa được', async ({
  page,
}) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  await adminLogin(page);
  await page.goto('/admin/media');
  await expect(page.getByRole('heading', { name: 'Thư viện media' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('media-card').first()).toBeVisible({ timeout: 30_000 });

  const input = page.locator('input[type="file"]').first();
  // quá 5 MB ⇒ báo ngay, không tải lên
  await input.setInputFiles({
    name: 'qua-lon.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([png, Buffer.alloc(5.5 * 1024 * 1024)]),
  });
  await expect(page.getByText(/vượt quá 5MB/)).toBeVisible();

  // tải lên 2 ảnh
  await input.setInputFiles([
    { name: 'ban-an-e2e.png', mimeType: 'image/png', buffer: png },
    { name: 'ghe-e2e.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(page.getByText('Đã tải lên 2 tệp.')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Tìm media').fill('ban an e2e');
  const card = page.getByTestId('media-card').filter({ hasText: 'ban-an-e2e.png' });
  await expect(card).toHaveCount(1, { timeout: 30_000 });
  await expect(card.getByText('Chưa dùng')).toBeVisible();

  // sửa mô tả
  await card.getByRole('button', { name: /Sửa mô tả/ }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/Mô tả ảnh/)
    .fill('Bàn ăn gỗ sồi');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu mô tả' }).click();
  await expect(page.getByText('Đã lưu mô tả ảnh.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('media-card').filter({ hasText: 'Bàn ăn gỗ sồi' })).toHaveCount(1);

  // xóa tệp chưa dùng (không có cảnh báo)
  await page
    .getByTestId('media-card')
    .filter({ hasText: 'ban-an-e2e.png' })
    .getByRole('button', { name: /^Xóa / })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa tệp' }).click();
  await expect(page.getByText('Đã xóa tệp.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('media-card').filter({ hasText: 'ban-an-e2e.png' })).toHaveCount(0);

  // lọc chỉ tệp chưa dùng: còn ghe-e2e.png
  await page.getByLabel('Tìm media').fill('');
  await page.getByLabel('Chỉ tệp chưa được sử dụng').check();
  await expect(page.getByTestId('media-card').filter({ hasText: 'ghe-e2e.png' })).toHaveCount(1, {
    timeout: 30_000,
  });
  await expect(page.getByText('Đang dùng')).toHaveCount(0);
  await page.getByLabel('Chỉ tệp chưa được sử dụng').uncheck();

  // tệp đang được dùng (ảnh sản phẩm): cảnh báo, xóa ⇒ báo lỗi 409 và tệp còn nguyên
  const used = page.getByTestId('media-card').filter({ hasText: 'Đang dùng' }).first();
  await expect(used).toBeVisible({ timeout: 30_000 });
  const usedName = (await used.locator('p').first().innerText()).trim();
  await used.getByRole('button', { name: /^Xóa / }).click();
  const warn = page.getByRole('dialog').getByRole('alert');
  if (await warn.count()) await expect(warn).toContainText(/đang được sử dụng|ảnh đại diện/);
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa tệp' }).click();
  await expect(page.getByText(/đang được sử dụng|Đã xóa tệp/).first()).toBeVisible({ timeout: 30_000 });
  expect(usedName.length).toBeGreaterThan(0);

  // dọn: xóa ghe-e2e.png
  await page.getByLabel('Tìm media').fill('ghe e2e');
  await page
    .getByTestId('media-card')
    .filter({ hasText: 'ghe-e2e.png' })
    .getByRole('button', { name: /^Xóa / })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa tệp' }).click();
  await expect(page.getByTestId('media-card').filter({ hasText: 'ghe-e2e.png' })).toHaveCount(0, {
    timeout: 30_000,
  });
});

test('vận chuyển: xác nhận → xử lý → tạo vận đơn → giao hàng → đánh dấu đã giao; không còn nút hoàn tất thủ công; giao thất bại thì tạo vận đơn mới', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const login = async (email: string, password: string) =>
    (await (await request.post(`${api}/api/auth/login`, { data: { email, password } })).json()).data.tokens
      .accessToken as string;
  const place = async () => {
    const t = await login('khachhang@aurelia.vn', '123456');
    const h = { Authorization: `Bearer ${t}` };
    const addr = (await (await request.get(`${api}/api/addresses`, { headers: h })).json()).data[0].id;
    const list = (await (await request.get(`${api}/api/products?pageSize=1`)).json()).data[0];
    const detail = (await (await request.get(`${api}/api/products/${list.slug}`)).json()).data;
    await request.delete(`${api}/api/cart`, { headers: h });
    await request.post(`${api}/api/cart/items`, {
      headers: h,
      data: { variantId: detail.variants[0].id, quantity: 1 },
    });
    const o = (
      await (
        await request.post(`${api}/api/orders`, {
          headers: h,
          data: { addressId: addr, paymentMethod: 'cod' },
        })
      ).json()
    ).data;
    return o.orderCode as string;
  };
  const orderStatus = async (code: string) => {
    const t = await login('admin@aurelia.vn', 'admin123');
    return (
      await (
        await request.get(`${api}/api/admin/orders/${code}`, { headers: { Authorization: `Bearer ${t}` } })
      ).json()
    ).data.status as string;
  };
  const code = await place();

  await adminLogin(page);
  await page.goto(`/admin/orders/${code}`);
  await expect(page.getByRole('heading', { name: new RegExp(code) }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Xác nhận đơn hàng' }).click();
  await expect(page.getByText('Đã cập nhật trạng thái đơn hàng.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Chuyển sang .Đang xử lý./ }).click();
  await expect(page.getByRole('button', { name: /Chuyển sang .Đang giao./ })).toBeVisible({
    timeout: 30_000,
  });

  // chưa có vận đơn: không chuyển sang Đang giao được, có hướng dẫn
  await expect(page.getByRole('button', { name: /Chuyển sang .Đang giao./ })).toBeDisabled();
  await expect(page.getByText(/Cần tạo vận đơn trước/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Xác nhận đã giao|Hoàn tất/ })).toHaveCount(0);

  // tạo vận đơn
  const form = page.getByLabel('Tạo vận đơn');
  await form.getByLabel('Đơn vị vận chuyển').selectOption('ghtk');
  await form.getByLabel('Mã vận đơn').fill(`GHTK-${Date.now()}`);
  await form.getByRole('button', { name: 'Tạo vận đơn' }).click();
  await expect(page.getByText('Đã tạo vận đơn.')).toBeVisible({ timeout: 30_000 });
  const row = page.getByTestId('shipment-row').first();
  await expect(row).toContainText('Chờ lấy hàng');
  await expect(page.getByLabel('Tạo vận đơn')).toHaveCount(0); // đã có vận đơn hoạt động

  // Đã lấy hàng chỉ đi tiếp "Đang vận chuyển" (DAC_TA §10.4): không có Đã giao / Giao thất bại / Hoàn hàng ở bước này
  await row.getByRole('button', { name: 'Đã lấy hàng' }).click();
  await expect(row).toContainText('Đã lấy hàng', { timeout: 30_000 });
  for (const name of ['Đánh dấu đã giao', 'Giao thất bại', 'Hoàn hàng'])
    await expect(row.getByRole('button', { name })).toHaveCount(0);
  await row.getByRole('button', { name: 'Đang vận chuyển' }).click();
  await expect(row).toContainText('Đang vận chuyển', { timeout: 30_000 });

  // chưa ở Đang giao: không đánh dấu đã giao được
  await expect(row.getByRole('button', { name: 'Đánh dấu đã giao' })).toBeDisabled();
  await page.getByRole('button', { name: /Chuyển sang .Đang giao./ }).click();
  await expect(page.getByText('Đã cập nhật trạng thái đơn hàng.').first()).toBeVisible({ timeout: 30_000 });
  expect(await orderStatus(code)).toBe('shipping');

  // giao thất bại ⇒ đơn giữ nguyên Đang giao; vận đơn failed còn giao lại được nên CHƯA tạo vận đơn mới
  await row.getByRole('button', { name: 'Giao thất bại' }).click();
  await expect(row).toContainText('Giao thất bại', { timeout: 30_000 });
  expect(await orderStatus(code)).toBe('shipping');
  await expect(page.getByLabel('Tạo vận đơn')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hủy đơn' })).toHaveCount(0); // chưa hoàn về: chưa hủy được

  // Giao lại ⇒ quay về Đang vận chuyển; thất bại lần nữa rồi Hoàn hàng ⇒ vận đơn kết thúc
  await row.getByRole('button', { name: 'Giao lại' }).click();
  await expect(row).toContainText('Đang vận chuyển', { timeout: 30_000 });
  await row.getByRole('button', { name: 'Giao thất bại' }).click();
  await expect(row).toContainText('Giao thất bại', { timeout: 30_000 });
  await row.getByRole('button', { name: 'Hoàn hàng' }).click();
  await expect(row.getByRole('button')).toHaveCount(0, { timeout: 30_000 }); // returned là trạng thái cuối
  await expect(row).toContainText('Hoàn hàng');
  expect(await orderStatus(code)).toBe('shipping');
  // hàng đã hoàn về: admin được hủy đơn (D-T54) và tạo được vận đơn mới
  await expect(page.getByRole('button', { name: 'Hủy đơn' })).toBeVisible();
  await page.getByLabel('Tạo vận đơn').getByRole('button', { name: 'Tạo vận đơn' }).click();
  await expect(page.getByTestId('shipment-row')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Hủy đơn' })).toHaveCount(0); // đã có vận đơn mới đang chạy

  // vận đơn mới: lấy hàng → vận chuyển → đã giao ⇒ đơn tự hoàn tất
  const cur = page.getByTestId('shipment-row').nth(1);
  await cur.getByRole('button', { name: 'Đã lấy hàng' }).click();
  await expect(cur).toContainText('Đã lấy hàng', { timeout: 30_000 });
  await cur.getByRole('button', { name: 'Đang vận chuyển' }).click();
  await expect(cur).toContainText('Đang vận chuyển', { timeout: 30_000 });
  await cur.getByRole('button', { name: 'Đánh dấu đã giao' }).click();
  await expect(page.getByText('Đã đánh dấu đã giao, đơn hàng đã hoàn tất.')).toBeVisible({ timeout: 30_000 });
  await expect(cur).toContainText('Đã giao');
  await expect(page.getByText('Đơn hàng đã tự hoàn tất khi vận đơn được giao.')).toBeVisible();
  expect(await orderStatus(code)).toBe('completed');
});

test('UC-ADM-24 chuyển khoản trên trang đơn: mã giao dịch trùng báo lỗi, xác nhận có mã, đánh dấu thất bại; COD không có nút', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const stamp = Date.now();
  const mk = async (label: string, paymentMethod: string) => {
    const email = `pay-${label}-${stamp}@test.local`;
    await request.post(`${api}/api/auth/register`, {
      data: { fullName: `Khách ${label}`, email, phone: '0911222333', password: 'matkhau-12345' },
    });
    const t = (
      await (
        await request.post(`${api}/api/auth/login`, { data: { email, password: 'matkhau-12345' } })
      ).json()
    ).data.tokens.accessToken as string;
    const h = { Authorization: `Bearer ${t}` };
    const addr = (
      await (
        await request.post(`${api}/api/addresses`, {
          headers: h,
          data: {
            recipientName: 'Nguyễn Văn A',
            phone: '0912345678',
            province: 'TP. Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường Bến Nghé',
            addressLine: '12 Lê Lợi',
          },
        })
      ).json()
    ).data.id;
    const list = (await (await request.get(`${api}/api/products?pageSize=1`)).json()).data[0];
    const detail = (await (await request.get(`${api}/api/products/${list.slug}`)).json()).data;
    await request.post(`${api}/api/cart/items`, {
      headers: h,
      data: { variantId: detail.variants[0].id, quantity: 1 },
    });
    const o = (
      await (
        await request.post(`${api}/api/orders`, { headers: h, data: { addressId: addr, paymentMethod } })
      ).json()
    ).data;
    return o.orderCode as string;
  };
  const a = await mk('a', 'bank_transfer');
  const b = await mk('b', 'bank_transfer');
  const c = await mk('c', 'bank_transfer');
  const cod = await mk('cod', 'cod');
  const txn = `GD-${stamp}`;

  await adminLogin(page);
  // A: xác nhận kèm mã giao dịch
  await page.goto(`/admin/orders/${a}`);
  await expect(page.getByRole('heading', { name: new RegExp(a) }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Mã giao dịch').fill(txn);
  await page.getByRole('button', { name: 'Xác nhận đã thanh toán' }).click();
  await expect(page.getByText('Đã xác nhận thanh toán.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`Mã giao dịch: ${txn}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận đã thanh toán' })).toHaveCount(0);

  // B: dùng lại mã đã có ⇒ báo lỗi, đơn vẫn chờ thanh toán
  await page.goto(`/admin/orders/${b}`);
  await expect(page.getByRole('heading', { name: new RegExp(b) }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Mã giao dịch').fill(txn);
  await page.getByRole('button', { name: 'Xác nhận đã thanh toán' }).click();
  await expect(page.getByText(/Mã giao dịch đã được dùng/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Xác nhận đã thanh toán' })).toBeVisible();

  // C: đánh dấu thất bại (có lý do) ⇒ hết nút xác nhận
  await page.goto(`/admin/orders/${c}`);
  await expect(page.getByRole('heading', { name: new RegExp(c) }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Đánh dấu thất bại' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Lý do (tùy chọn)').fill('Không thấy tiền về');
  await dlg.getByRole('button', { name: 'Đánh dấu thất bại' }).click();
  await expect(page.getByText('Đã đánh dấu giao dịch thất bại.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Xác nhận đã thanh toán' })).toHaveCount(0);

  // COD: không xác nhận thủ công
  await page.goto(`/admin/orders/${cod}`);
  await expect(page.getByRole('heading', { name: new RegExp(cod) }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Xác nhận đã thanh toán' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đánh dấu thất bại' })).toHaveCount(0);
});

test('hoàn hàng → hủy đơn đang giao → hoàn tiền (đơn đã thanh toán): chỉ hủy được khi vận đơn đã hoàn về, hoàn tiền một lần', async ({
  page,
  request,
}) => {
  const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
  const stamp = Date.now();
  const email = `ret-${stamp}@test.local`;
  await request.post(`${api}/api/auth/register`, {
    data: { fullName: 'Khách hoàn hàng', email, phone: '0911222333', password: 'matkhau-12345' },
  });
  const t = (
    await (await request.post(`${api}/api/auth/login`, { data: { email, password: 'matkhau-12345' } })).json()
  ).data.tokens.accessToken as string;
  const h = { Authorization: `Bearer ${t}` };
  const addr = (
    await (
      await request.post(`${api}/api/addresses`, {
        headers: h,
        data: {
          recipientName: 'Nguyễn Văn A',
          phone: '0912345678',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          addressLine: '12 Lê Lợi',
        },
      })
    ).json()
  ).data.id;
  const list = (await (await request.get(`${api}/api/products?pageSize=1`)).json()).data[0];
  const detail = (await (await request.get(`${api}/api/products/${list.slug}`)).json()).data;
  await request.post(`${api}/api/cart/items`, {
    headers: h,
    data: { variantId: detail.variants[0].id, quantity: 1 },
  });
  const order = (
    await (
      await request.post(`${api}/api/orders`, {
        headers: h,
        data: { addressId: addr, paymentMethod: 'bank_transfer' },
      })
    ).json()
  ).data as { id: number; orderCode: string; payment: { id: number } };
  const at = (
    await (
      await request.post(`${api}/api/auth/login`, {
        data: { email: 'admin@aurelia.vn', password: 'admin123', adminOnly: true },
      })
    ).json()
  ).data.tokens.accessToken as string;
  const ah = { Authorization: `Bearer ${at}` };
  const code = order.orderCode;
  expect(
    (
      await request.patch(`${api}/api/admin/payments/${order.payment.id}/confirm`, { headers: ah, data: {} })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.patch(`${api}/api/admin/orders/${order.id}/status`, {
        headers: ah,
        data: { status: 'processing' },
      })
    ).status(),
  ).toBe(200);

  await adminLogin(page);
  await page.goto(`/admin/orders/${code}`);
  await expect(page.getByRole('heading', { name: new RegExp(code) }).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel('Tạo vận đơn').getByRole('button', { name: 'Tạo vận đơn' }).click();
  await expect(page.getByText('Đã tạo vận đơn.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Chuyển sang .Đang giao./ }).click();
  await expect(page.getByText('Đã cập nhật trạng thái đơn hàng.').first()).toBeVisible({ timeout: 30_000 });
  const row = page.getByTestId('shipment-row').first();
  for (const step of ['Đã lấy hàng', 'Đang vận chuyển']) {
    await row.getByRole('button', { name: step }).click();
    await expect(row).toContainText(step, { timeout: 30_000 });
  }
  await expect(page.getByRole('button', { name: 'Hủy đơn' })).toHaveCount(0); // đang giao: chưa hủy được
  await row.getByRole('button', { name: 'Hoàn hàng' }).click();
  await expect(row.getByRole('button')).toHaveCount(0, { timeout: 30_000 });

  // hàng đã hoàn về ⇒ hủy được; đơn đã thanh toán ⇒ sau đó hoàn tiền
  await page.getByRole('button', { name: 'Hủy đơn' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Lý do hủy').fill('Hàng hoàn về kho');
  await dlg.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(page.getByText('Đã hủy đơn hàng.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Lý do hủy: Hàng hoàn về kho')).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn tiền' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn tiền' }).click();
  await expect(page.getByRole('button', { name: 'Hoàn tiền' })).toHaveCount(0, { timeout: 30_000 }); // không hoàn lần hai

  const final = await (await request.get(`${api}/api/admin/orders/${code}`, { headers: ah })).json();
  expect(final.data.status).toBe('refunded');
  expect(final.data.paymentStatus).toBe('refunded');
});
